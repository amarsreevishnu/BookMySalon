import hmac
import hashlib
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from salons.models import Salon, WorkerProfile
from services.models import SalonService, Service, ServiceCategory
from bookings.models import Booking
from wallet.models import CustomerWallet, WalletTransaction, WalletTopUpPayment
from wallet.services import (
    get_customer_wallet,
    validate_wallet_balance,
    validate_topup_amount,
    credit_wallet,
    debit_wallet,
    refund_to_wallet,
    process_wallet_booking_payment,
    topup_wallet,
    create_wallet_topup_order,
    verify_wallet_topup_payment,
    record_wallet_topup_failure,
    InsufficientWalletFundsError,
    MAX_WALLET_TOPUP_AMOUNT,
)

User = get_user_model()


class CustomerWalletModelAndServiceTests(TestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email="cust_test@example.com",
            first_name="Jane",
            last_name="Doe",
            role="CUSTOMER",
            password="testpassword123",
        )
        self.owner = User.objects.create_user(
            email="owner_test@example.com",
            first_name="Alice",
            last_name="Owner",
            role="SALON_OWNER",
            password="testpassword123",
        )
        self.salon = Salon.objects.create(
            owner=self.owner,
            name="Glow Salon",
            address="123 High Street",
            city="Metropolis",
            phone="9876543210",
            email="glow@example.com",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )
        self.category = ServiceCategory.objects.create(name="Hair Care", slug="hair-care")
        self.base_service = Service.objects.create(
            category=self.category,
            name="Haircut",
            slug="haircut",
            standard_price=Decimal("500.00"),
            standard_duration=45,
        )
        self.service = SalonService.objects.create(
            salon=self.salon,
            service=self.base_service,
            custom_name="Signature Haircut",
            price=Decimal("500.00"),
            duration=45,
            is_active=True,
        )

    def test_customer_wallet_auto_created_via_signal(self):
        """User with CUSTOMER role automatically gets an active CustomerWallet with 0 balance."""
        wallet = CustomerWallet.objects.filter(user=self.customer).first()
        self.assertIsNotNone(wallet)
        self.assertEqual(wallet.balance, Decimal("0.00"))
        self.assertEqual(wallet.currency, "INR")
        self.assertTrue(wallet.is_active)
        self.assertFalse(wallet.is_locked)

    def test_credit_wallet_increases_balance_and_records_tx(self):
        wallet, tx = credit_wallet(
            user=self.customer,
            amount=Decimal("1500.00"),
            transaction_type=WalletTransaction.TransactionType.CREDIT,
            reason="Promotional Credit",
        )
        self.assertEqual(wallet.balance, Decimal("1500.00"))
        self.assertEqual(tx.balance_before, Decimal("0.00"))
        self.assertEqual(tx.balance_after, Decimal("1500.00"))
        self.assertEqual(tx.status, WalletTransaction.Status.COMPLETED)
        self.assertTrue(tx.transaction_id.startswith("WTX-"))

    def test_credit_wallet_idempotency(self):
        key = "IDEM-TEST-1001"
        w1, tx1 = credit_wallet(user=self.customer, amount=Decimal("200.00"), idempotency_key=key)
        self.assertEqual(w1.balance, Decimal("200.00"))

        # Repeating same key should not credit twice
        w2, tx2 = credit_wallet(user=self.customer, amount=Decimal("200.00"), idempotency_key=key)
        self.assertEqual(w2.balance, Decimal("200.00"))
        self.assertEqual(tx1.id, tx2.id)

    def test_debit_wallet_decreases_balance_and_validates(self):
        credit_wallet(user=self.customer, amount=Decimal("1000.00"))
        wallet, tx = debit_wallet(
            user=self.customer,
            amount=Decimal("350.00"),
            reason="Service fee",
        )
        self.assertEqual(wallet.balance, Decimal("650.00"))
        self.assertEqual(tx.balance_before, Decimal("1000.00"))
        self.assertEqual(tx.balance_after, Decimal("650.00"))

    def test_debit_wallet_fails_on_insufficient_funds(self):
        credit_wallet(user=self.customer, amount=Decimal("100.00"))
        with self.assertRaises(InsufficientWalletFundsError):
            debit_wallet(user=self.customer, amount=Decimal("500.00"))

    def test_refund_to_wallet_success(self):
        booking = Booking.objects.create(
            salon=self.salon,
            service=self.service,
            customer=self.customer,
            client_name="Jane Doe",
            service_name="Signature Haircut",
            service_price=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            booking_date="2026-12-01",
            booking_time="10:00",
            start_time="10:00:00",
            end_time="10:45:00",
            status=Booking.Status.PENDING,
            payment_method=Booking.PaymentMethod.ONLINE,
            payment_status=Booking.PaymentStatus.PAID,
        )

        wallet, tx = refund_to_wallet(
            booking=booking,
            amount=Decimal("500.00"),
            reason="Customer requested cancellation",
        )
        self.assertEqual(wallet.balance, Decimal("500.00"))
        self.assertEqual(tx.transaction_type, WalletTransaction.TransactionType.REFUND)
        self.assertEqual(tx.booking, booking)

    def test_process_wallet_booking_payment(self):
        # Credit sufficient amount first
        credit_wallet(user=self.customer, amount=Decimal("800.00"))

        booking = Booking.objects.create(
            salon=self.salon,
            service=self.service,
            customer=self.customer,
            client_name="Jane Doe",
            service_name="Signature Haircut",
            service_price=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            booking_date="2026-12-02",
            booking_time="11:00",
            start_time="11:00:00",
            end_time="11:45:00",
            status=Booking.Status.PENDING,
            payment_method=Booking.PaymentMethod.WALLET,
            payment_status=Booking.PaymentStatus.PENDING,
        )

        bkg, tx = process_wallet_booking_payment(booking, self.customer)
        self.assertEqual(bkg.status, Booking.Status.CONFIRMED)
        self.assertEqual(bkg.payment_status, Booking.PaymentStatus.PAID)
        self.assertTrue(bkg.is_fully_paid)

        wallet = get_customer_wallet(self.customer)
        self.assertEqual(wallet.balance, Decimal("300.00"))
        self.assertEqual(tx.transaction_type, WalletTransaction.TransactionType.BOOKING_PAYMENT)


class CustomerWalletAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = User.objects.create_user(
            email="cust_api@example.com",
            first_name="John",
            last_name="Smith",
            role="CUSTOMER",
            password="testpassword123",
        )
        self.client.force_authenticate(user=self.customer)

        self.owner = User.objects.create_user(
            email="owner_api@example.com",
            first_name="Bob",
            last_name="Owner",
            role="SALON_OWNER",
            password="testpassword123",
        )
        self.salon = Salon.objects.create(
            owner=self.owner,
            name="Velvet Salon",
            address="456 Avenue",
            city="Metropolis",
            phone="9876543211",
            email="velvet@example.com",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )
        self.category = ServiceCategory.objects.create(name="Spa", slug="spa")
        self.base_service = Service.objects.create(
            category=self.category,
            name="Spa Therapy",
            slug="spa-therapy",
            standard_price=Decimal("1200.00"),
            standard_duration=60,
        )
        self.service = SalonService.objects.create(
            salon=self.salon,
            service=self.base_service,
            custom_name="Aroma Spa",
            price=Decimal("1200.00"),
            duration=60,
            is_active=True,
        )

    def test_get_wallet_detail(self):
        credit_wallet(self.customer, Decimal("450.00"))
        response = self.client.get("/api/v1/wallet/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data["balance"], "450.00")
        self.assertEqual(data["currency"], "INR")
        self.assertTrue(data["is_active"])

    def test_get_wallet_transactions(self):
        credit_wallet(self.customer, Decimal("1000.00"), reason="Deposit")
        debit_wallet(self.customer, Decimal("300.00"), transaction_type=WalletTransaction.TransactionType.DEBIT, reason="Quick Trim")

        response = self.client.get("/api/v1/wallet/transactions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["results"]
        self.assertEqual(len(results), 2)
        # Transactions are ordered by -created_at
        self.assertEqual(results[0]["transaction_type"], "DEBIT")
        self.assertEqual(results[1]["transaction_type"], "CREDIT")

    def test_check_balance_endpoint(self):
        credit_wallet(self.customer, Decimal("700.00"))

        # Sufficient check
        res1 = self.client.get("/api/v1/wallet/check-balance/?amount=500")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertTrue(res1.data["has_sufficient_funds"])

        # Insufficient check
        res2 = self.client.get("/api/v1/wallet/check-balance/?amount=1200")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertFalse(res2.data["has_sufficient_funds"])
        self.assertEqual(Decimal(str(res2.data["shortfall"])), Decimal("500.00"))

    def test_topup_wallet_endpoint(self):
        response = self.client.post("/api/v1/wallet/topup/", {
            "amount": "1000.00",
            "payment_method": "ONLINE",
            "notes": "Adding funds for weekend pampering",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["balance"], "1000.00")
        self.assertEqual(response.data["transaction"]["status"], "COMPLETED")

    def test_pay_booking_endpoint_success(self):
        credit_wallet(self.customer, Decimal("1500.00"))

        booking = Booking.objects.create(
            salon=self.salon,
            service=self.service,
            customer=self.customer,
            client_name="John Smith",
            service_name="Aroma Spa",
            service_price=Decimal("1200.00"),
            total_amount=Decimal("1200.00"),
            booking_date="2026-12-05",
            booking_time="14:00",
            start_time="14:00:00",
            end_time="15:00:00",
            status=Booking.Status.PENDING,
            payment_method=Booking.PaymentMethod.WALLET,
            payment_status=Booking.PaymentStatus.PENDING,
        )

        response = self.client.post("/api/v1/wallet/pay-booking/", {
            "booking_id": booking.id,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.PAID)

        wallet = get_customer_wallet(self.customer)
        self.assertEqual(wallet.balance, Decimal("300.00"))

    def test_unauthenticated_wallet_access_denied(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/v1/wallet/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_booking_create_with_insufficient_wallet_fails(self):
        credit_wallet(self.customer, Decimal("100.00"))
        response = self.client.post("/api/v1/bookings/create/", {
            "salon_id": self.salon.id,
            "service_id": self.service.id,
            "booking_date": "2026-12-10",
            "start_time": "10:00",
            "client_name": "John Smith",
            "client_phone": "9876543210",
            "payment_method": "WALLET",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Insufficient wallet balance", response.data.get("error", ""))

    def test_booking_cancellation_auto_refunds_to_customer_wallet(self):
        from datetime import date
        from payments.services import process_booking_cancellation_and_refund
        # Customer booking created with PAID status (signal automatically creates single Payment record)
        booking = Booking.objects.create(
            salon=self.salon,
            service=self.service,
            customer=self.customer,
            client_name="John Smith",
            service_name="Aroma Spa",
            service_price=Decimal("1200.00"),
            total_amount=Decimal("1200.00"),
            booking_date=date(2026, 12, 15),
            booking_time="14:00",
            start_time="14:00:00",
            end_time="15:00:00",
            status=Booking.Status.CONFIRMED,
            payment_method=Booking.PaymentMethod.ONLINE,
            payment_status=Booking.PaymentStatus.PAID,
            is_fully_paid=True,
        )

        refund, owner_tx = process_booking_cancellation_and_refund(
            booking=booking,
            reason="Schedule conflict",
            force_refund=True,
        )
        self.assertIsNotNone(refund)
        wallet = get_customer_wallet(self.customer)
        self.assertEqual(wallet.balance, Decimal("1200.00"))

        last_tx = wallet.transactions.first()
        self.assertEqual(last_tx.transaction_type, WalletTransaction.TransactionType.REFUND)
        self.assertEqual(last_tx.amount, Decimal("1200.00"))

    def test_topup_amount_validation(self):
        # Empty / None
        with self.assertRaises(ValidationError):
            validate_topup_amount(None)
        with self.assertRaises(ValidationError):
            validate_topup_amount("")

        # Negative & Zero
        with self.assertRaises(ValidationError):
            validate_topup_amount(0)
        with self.assertRaises(ValidationError):
            validate_topup_amount(-500)

        # Non-numeric
        with self.assertRaises(ValidationError):
            validate_topup_amount("abc")

        # More than 2 decimal places
        with self.assertRaises(ValidationError):
            validate_topup_amount("100.999")

        # Exceeds limit
        with self.assertRaises(ValidationError):
            validate_topup_amount(10001)

        # Valid amounts
        amt = validate_topup_amount("2500")
        self.assertEqual(amt, Decimal("2500.00"))
        amt_max = validate_topup_amount("10000.00")
        self.assertEqual(amt_max, Decimal("10000.00"))

    def test_create_wallet_topup_order_endpoint(self):
        response = self.client.post("/api/v1/wallet/topup/create-order/", {
            "amount": "2500.00",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("order_id", response.data)
        self.assertEqual(response.data["amount"], "2500.00")
        self.assertEqual(response.data["amount_in_paise"], 250000)
        self.assertEqual(response.data["currency"], "INR")

        # Check DB record
        topup_rec = WalletTopUpPayment.objects.filter(razorpay_order_id=response.data["order_id"]).first()
        self.assertIsNotNone(topup_rec)
        self.assertEqual(topup_rec.status, WalletTopUpPayment.Status.PENDING)
        self.assertEqual(topup_rec.amount, Decimal("2500.00"))

    def test_create_wallet_topup_order_rejects_above_10000(self):
        response = self.client.post("/api/v1/wallet/topup/create-order/", {
            "amount": "10000.50",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        error_str = str(response.data)
        self.assertTrue("10000" in error_str or "10,000" in error_str)

    def test_verify_wallet_topup_payment_success(self):
        wallet = get_customer_wallet(self.customer)
        self.assertEqual(wallet.balance, Decimal("0.00"))

        order_id = "order_test_topup_101"
        payment_id = "pay_test_topup_202"
        topup = WalletTopUpPayment.objects.create(
            user=self.customer,
            wallet=wallet,
            amount=Decimal("1500.00"),
            currency="INR",
            razorpay_order_id=order_id,
            status=WalletTopUpPayment.Status.PENDING,
        )

        rzp_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "dummy_secret")
        msg = f"{order_id}|{payment_id}".encode()
        valid_signature = hmac.new(rzp_secret.encode(), msg, hashlib.sha256).hexdigest()

        response = self.client.post("/api/v1/wallet/topup/verify-payment/", {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_signature,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["success"])

        # Check wallet balance updated
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1500.00"))

        # Check transaction record
        tx = wallet.transactions.first()
        self.assertEqual(tx.transaction_type, WalletTransaction.TransactionType.CREDIT)
        self.assertEqual(tx.reason, "WALLET_TOPUP")
        self.assertEqual(tx.amount, Decimal("1500.00"))

        # Check topup record updated to SUCCESS
        topup.refresh_from_db()
        self.assertEqual(topup.status, WalletTopUpPayment.Status.SUCCESS)
        self.assertEqual(topup.razorpay_payment_id, payment_id)

    def test_verify_wallet_topup_payment_invalid_signature_fails(self):
        wallet = get_customer_wallet(self.customer)
        order_id = "order_test_topup_bad"
        payment_id = "pay_test_topup_bad"
        topup = WalletTopUpPayment.objects.create(
            user=self.customer,
            wallet=wallet,
            amount=Decimal("1000.00"),
            currency="INR",
            razorpay_order_id=order_id,
            status=WalletTopUpPayment.Status.PENDING,
        )

        response = self.client.post("/api/v1/wallet/topup/verify-payment/", {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": "invalid_forged_signature_12345",
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get("message"), "Money not credited. Payment verification failed.")

        # Wallet balance should remain 0
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("0.00"))

        # Topup marked as FAILED
        topup.refresh_from_db()
        self.assertEqual(topup.status, WalletTopUpPayment.Status.FAILED)

    def test_verify_wallet_topup_idempotency_prevents_duplicate_credit(self):
        wallet = get_customer_wallet(self.customer)
        order_id = "order_test_idem_001"
        payment_id = "pay_test_idem_001"
        topup = WalletTopUpPayment.objects.create(
            user=self.customer,
            wallet=wallet,
            amount=Decimal("800.00"),
            currency="INR",
            razorpay_order_id=order_id,
            status=WalletTopUpPayment.Status.PENDING,
        )

        rzp_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "dummy_secret")
        msg = f"{order_id}|{payment_id}".encode()
        valid_signature = hmac.new(rzp_secret.encode(), msg, hashlib.sha256).hexdigest()

        # 1st call -> verifies and credits
        res1 = self.client.post("/api/v1/wallet/topup/verify-payment/", {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_signature,
        })
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("800.00"))

        # 2nd call (e.g. duplicate webhook or network retry) -> should NOT credit again
        res2 = self.client.post("/api/v1/wallet/topup/verify-payment/", {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_signature,
        })
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("800.00"))
        # Only 1 CREDIT transaction should exist
        self.assertEqual(wallet.transactions.filter(transaction_type="CREDIT").count(), 1)

    def test_wallet_topup_payment_failed_endpoint(self):
        wallet = get_customer_wallet(self.customer)
        order_id = "order_test_fail_999"
        topup = WalletTopUpPayment.objects.create(
            user=self.customer,
            wallet=wallet,
            amount=Decimal("500.00"),
            currency="INR",
            razorpay_order_id=order_id,
            status=WalletTopUpPayment.Status.PENDING,
        )

        response = self.client.post("/api/v1/wallet/topup/payment-failed/", {
            "razorpay_order_id": order_id,
            "reason": "Payment window closed by customer",
            "error_code": "CUSTOMER_CANCELLED",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("message"), "Money not credited. Payment failed.")

        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("0.00"))

        topup.refresh_from_db()
        self.assertEqual(topup.status, WalletTopUpPayment.Status.FAILED)
        self.assertIn("Payment window closed", topup.error_description)
