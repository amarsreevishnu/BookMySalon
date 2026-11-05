from datetime import date, time, timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from bookings.models import Booking
from salons.models import Salon, WorkerProfile
from services.models import ServiceCategory, Service, SalonService
from payments.models import (
    Payment,
    OwnerWallet,
    OwnerWalletTransaction,
    WorkerEarning,
    WorkerWalletTransaction,
    Refund,
)
from payments.services import (
    record_booking_advance_payment,
    record_service_completion_and_final_payment,
    process_booking_cancellation_and_refund,
)

User = get_user_model()


class OwnerRevenueFinancialTests(TestCase):
    def setUp(self):
        # 1. Setup Owner and Salon
        self.owner = User.objects.create_user(
            email="owner@luxe.com",
            password="Password123!",
            first_name="Ramesh",
            last_name="Verma",
            role="OWNER",
        )
        self.salon = Salon.objects.create(
            owner=self.owner,
            name="Luxe Aura Salon",
            city="Bengaluru",
            address="100 Feet Rd, Indiranagar",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )

        # 2. Setup Worker with 60% commission
        self.worker_user = User.objects.create_user(
            email="stylist@luxe.com",
            password="Password123!",
            first_name="Arjun",
            last_name="Kapoor",
            role="WORKER",
        )
        self.worker = WorkerProfile.objects.create(
            user=self.worker_user,
            salon=self.salon,
            specialization="Master Hair Stylist",
            station="Chair #01",
            commission_tier="Tier 2 • Senior Specialist",
            commission_rate=Decimal("60.00"),
            is_active=True,
        )

        # 3. Setup Customer
        self.customer = User.objects.create_user(
            email="customer@gmail.com",
            password="Password123!",
            first_name="Pooja",
            last_name="Sharma",
            role="CUSTOMER",
        )

        # 4. Setup Service (₹500)
        self.category = ServiceCategory.objects.create(name="Hair Care")
        self.base_service = Service.objects.create(
            name="Haircut & Styling",
            category=self.category,
            standard_price=Decimal("400.00"),
            standard_duration=45,
        )
        self.service = SalonService.objects.create(
            salon=self.salon,
            service=self.base_service,
            custom_name="Signature Haircut & Styling",
            price=Decimal("500.00"),
            duration=45,
            is_active=True,
        )

        self.client = APIClient()

    def test_advance_payment_and_service_completion_lifecycle(self):
        """
        User scenario:
        Haircut costs ₹500. Customer pays ₹100 advance online.
        At salon, customer pays remaining ₹400.
        Worker earns ₹300 (60%), Salon share ₹200 (40%).
        Transactions must have the exact requested descriptions.
        """
        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            service=self.service,
            client_name="Pooja Sharma",
            client_phone="9876543210",
            client_email="pooja@gmail.com",
            service_name="Signature Haircut & Styling",
            service_price=Decimal("500.00"),
            subtotal=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            advance_amount=Decimal("100.00"),
            remaining_amount=Decimal("400.00"),
            booking_date=date.today() + timedelta(days=1),
            booking_time="10:00",
            start_time=time(10, 0),
            end_time=time(10, 45),
            status=Booking.Status.CONFIRMED,
            payment_method=Booking.PaymentMethod.ONLINE,
            payment_status=Booking.PaymentStatus.PENDING,
            razorpay_order_id="order_test_123",
            razorpay_payment_id="pay_test_123",
        )

        # Step 1: Record ₹100 advance payment
        adv_tx = record_booking_advance_payment(
            booking=booking,
            amount=Decimal("100.00"),
            payment_method=Payment.PaymentMethod.ONLINE,
            razorpay_order_id="order_test_123",
            razorpay_payment_id="pay_test_123",
        )

        self.assertIsNotNone(adv_tx)
        self.assertEqual(adv_tx.transaction_type, OwnerWalletTransaction.TransactionType.ADVANCE_RECEIVED)
        self.assertEqual(adv_tx.flow, OwnerWalletTransaction.FlowType.CREDIT)
        self.assertEqual(adv_tx.amount, Decimal("100.00"))
        self.assertIn("Pooja Sharma paid ₹100 advance for Signature Haircut & Styling", adv_tx.description)

        wallet = OwnerWallet.objects.get(salon=self.salon)
        self.assertEqual(wallet.balance, Decimal("100.00"))
        self.assertEqual(wallet.total_collected, Decimal("100.00"))
        self.assertEqual(wallet.total_advances, Decimal("100.00"))

        booking.refresh_from_db()
        self.assertTrue(booking.is_advance_paid)
        self.assertFalse(booking.is_fully_paid)
        self.assertEqual(booking.remaining_amount, Decimal("400.00"))
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.PARTIALLY_PAID)

        # Step 2: Customer visits salon and worker completes service. Collect remaining ₹400.
        owner_tx, worker_earning = record_service_completion_and_final_payment(
            booking=booking,
            remaining_amount_paid=Decimal("400.00"),
            payment_method=Payment.PaymentMethod.CASH,
            completed_by_user=self.owner,
        )

        self.assertIsNotNone(owner_tx)
        self.assertIsNotNone(worker_earning)

        # Check worker commission: 60% of ₹500 = ₹300
        self.assertEqual(worker_earning.service_price, Decimal("500.00"))
        self.assertEqual(worker_earning.earning_amount, Decimal("300.00"))
        self.assertEqual(worker_earning.salon_share, Decimal("200.00"))
        self.assertEqual(worker_earning.status, WorkerEarning.Status.CREDITED)

        # Check WorkerWalletTransaction created
        w_tx = WorkerWalletTransaction.objects.filter(booking=booking).first()
        self.assertIsNotNone(w_tx)
        self.assertEqual(w_tx.amount, Decimal("300.00"))
        self.assertEqual(w_tx.flow, "CREDIT")

        # Check OwnerWallet:
        # Initial advance: ₹100
        # Remaining collected: +₹400
        # Worker allocation: -₹300
        # Net wallet balance: ₹100 + ₹400 - ₹300 = ₹200 (exact salon share)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("200.00"))
        self.assertEqual(wallet.total_collected, Decimal("500.00"))
        self.assertEqual(wallet.total_completed_services, Decimal("500.00"))
        self.assertEqual(wallet.total_worker_payout, Decimal("300.00"))

        # Verify separate transactions exist: remaining payment received and worker commission payout
        rem_tx = OwnerWalletTransaction.objects.filter(
            booking=booking,
            flow=OwnerWalletTransaction.FlowType.CREDIT,
            transaction_type=OwnerWalletTransaction.TransactionType.CUSTOMER_PAYMENT_RECEIVED,
        ).first()
        self.assertIsNotNone(rem_tx)
        self.assertEqual(rem_tx.amount, Decimal("400.00"))

        debit_tx = OwnerWalletTransaction.objects.filter(
            booking=booking,
            flow=OwnerWalletTransaction.FlowType.DEBIT,
            transaction_type=OwnerWalletTransaction.TransactionType.WORKER_COMMISSION_PAYOUT,
        ).first()
        self.assertIsNotNone(debit_tx)
        self.assertEqual(debit_tx.amount, Decimal("300.00"))
        self.assertIn("Worker commission payout of ₹300 (60%) deducted for Arjun Kapoor", debit_tx.description)

        # Booking final state
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.COMPLETED)
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.PAID)
        self.assertTrue(booking.is_fully_paid)
        self.assertEqual(booking.remaining_amount, Decimal("0.00"))

    def test_cancellation_and_advance_refund(self):
        """
        Tests cancellation of booking with ₹100 advance.
        OwnerWallet debits ₹100 and transaction narrative explains refund.
        Original payment is retained, not deleted.
        """
        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            service=self.service,
            client_name="Pooja Sharma",
            service_name="Signature Haircut & Styling",
            service_price=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            advance_amount=Decimal("100.00"),
            remaining_amount=Decimal("400.00"),
            booking_date=date.today() + timedelta(days=2),
            booking_time="14:00",
            start_time=time(14, 0),
            end_time=time(14, 45),
            status=Booking.Status.CONFIRMED,
            is_advance_paid=True,
        )

        # Record ₹100 advance
        record_booking_advance_payment(booking, amount=Decimal("100.00"))
        wallet = OwnerWallet.objects.get(salon=self.salon)
        self.assertEqual(wallet.balance, Decimal("100.00"))

        # Customer cancels
        refund, tx = process_booking_cancellation_and_refund(
            booking=booking,
            reason="Change of plans",
            processed_by=self.owner,
        )

        self.assertIsNotNone(refund)
        self.assertEqual(refund.amount, Decimal("100.00"))
        self.assertEqual(refund.refund_status, Refund.Status.PROCESSED)
        self.assertIn("Refund of ₹100 processed for Pooja Sharma. Reason: Change of plans", refund.description)

        # Wallet balance should be 0.00 and total_refunded should be 100.00
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("0.00"))
        self.assertEqual(wallet.total_refunded, Decimal("100.00"))

        # Original payment records still exist
        self.assertTrue(Payment.objects.filter(booking=booking).exists())

    def test_refund_with_worker_earning_reversal(self):
        """
        If a refund is issued after a worker was already credited,
        worker earning must be REVERSED and worker commission deducted.
        """
        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            service=self.service,
            client_name="Pooja Sharma",
            service_name="Signature Haircut & Styling",
            service_price=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            advance_amount=Decimal("100.00"),
            remaining_amount=Decimal("400.00"),
            booking_date=date.today() + timedelta(days=1),
            booking_time="11:00",
            start_time=time(11, 0),
            end_time=time(11, 45),
            status=Booking.Status.CONFIRMED,
        )

        # Complete service (advance + remaining)
        record_booking_advance_payment(booking, Decimal("100.00"))
        record_service_completion_and_final_payment(booking, Decimal("400.00"))

        wallet = OwnerWallet.objects.get(salon=self.salon)
        self.assertEqual(wallet.balance, Decimal("200.00"))
        self.assertEqual(wallet.total_worker_payout, Decimal("300.00"))

        # Customer dispute / owner grants full refund of ₹500
        refund, tx = process_booking_cancellation_and_refund(
            booking=booking,
            reason="Service dissatisfaction warranty claim",
            processed_by=self.owner,
            force_refund=True,
        )

        self.assertEqual(refund.amount, Decimal("500.00"))
        self.assertEqual(refund.worker_reversal_amount, Decimal("300.00"))

        # Worker earning reversed
        earning = WorkerEarning.objects.get(booking=booking)
        self.assertEqual(earning.status, WorkerEarning.Status.REVERSED)

        # WorkerWalletTransaction for reversal
        rev_tx = WorkerWalletTransaction.objects.filter(
            booking=booking,
            transaction_type=WorkerWalletTransaction.TransactionType.COMMISSION_REVERSAL,
        ).first()
        self.assertIsNotNone(rev_tx)
        self.assertEqual(rev_tx.flow, "DEBIT")
        self.assertEqual(rev_tx.amount, Decimal("300.00"))

        # Wallet balance: Was ₹200. Debited ₹500 refund, credited back ₹300 worker obligation reversal.
        # Net balance: 200 - 500 + 300 = 0.00!
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("0.00"))
        self.assertEqual(wallet.total_worker_payout, Decimal("0.00"))
        self.assertEqual(wallet.total_refunded, Decimal("500.00"))

    def test_owner_revenue_api_endpoints(self):
        """
        Verify Owner Revenue API endpoints: summary, transactions, worker-earnings, collect-remaining.
        """
        self.client.force_authenticate(user=self.owner)

        # 1. Check revenue-summary initially
        res_summary = self.client.get("/api/v1/payments/owner/revenue-summary/")
        self.assertEqual(res_summary.status_code, 200)
        self.assertIn("wallet", res_summary.data)
        self.assertIn("metrics", res_summary.data)
        self.assertEqual(res_summary.data["metrics"]["available_balance"], "0.00")

        # 2. Create booking and pay advance
        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            service=self.service,
            client_name="Pooja Sharma",
            service_name="Signature Haircut & Styling",
            service_price=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            advance_amount=Decimal("100.00"),
            remaining_amount=Decimal("400.00"),
            booking_date=date.today(),
            booking_time="15:00",
            start_time=time(15, 0),
            end_time=time(15, 45),
            status=Booking.Status.CONFIRMED,
        )
        record_booking_advance_payment(booking, Decimal("100.00"))

        # 3. Call collect-remaining endpoint
        res_collect = self.client.post(
            f"/api/v1/payments/owner/bookings/{booking.id}/collect-remaining/",
            {"remaining_amount": "400.00", "payment_method": "CASH"},
            format="json",
        )
        self.assertEqual(res_collect.status_code, 200)
        self.assertEqual(res_collect.data["wallet_balance"], "200.00")
        self.assertIsNotNone(res_collect.data["transaction"])
        self.assertIn("deducted for Arjun Kapoor", res_collect.data["transaction"]["description"])

        # 4. Check transactions list endpoint (advance + remaining + worker commission deduction)
        res_txs = self.client.get("/api/v1/payments/owner/transactions/")
        self.assertEqual(res_txs.status_code, 200)
        self.assertEqual(res_txs.data["count"], 3)

        # 5. Check worker-earnings endpoint
        res_workers = self.client.get("/api/v1/payments/owner/worker-earnings/")
        self.assertEqual(res_workers.status_code, 200)
        self.assertEqual(len(res_workers.data["workers"]), 1)
        w_data = res_workers.data["workers"][0]
        self.assertEqual(w_data["name"], "Arjun Kapoor")
        self.assertEqual(w_data["completed_jobs"], 1)
        self.assertEqual(w_data["total_worker_earned"], "300.00")
        self.assertEqual(w_data["total_salon_share"], "200.00")

    def test_worker_revenue_management_lifecycle_and_permissions(self):
        """
        Tests Worker Revenue Management:
        - When booking is completed, worker's wallet is credited exactly once.
        - Worker can view wallet balance, total earnings, range earnings, booking earnings, and transaction history.
        - Non-workers (customers) are denied access (403).
        - Worker isolation: a worker can only see their own revenue data.
        """
        # Create second worker in the same salon
        other_user = User.objects.create_user(
            email="other_stylist@luxe.com",
            password="Password123!",
            first_name="Meera",
            last_name="Nair",
            role="WORKER",
        )
        other_worker = WorkerProfile.objects.create(
            user=other_user,
            salon=self.salon,
            specialization="Colorist",
            station="Chair #02",
            commission_rate=Decimal("50.00"),
            is_active=True,
        )

        # 1. Customer attempts to access worker revenue -> 403 Forbidden
        self.client.force_authenticate(user=self.customer)
        res_denied = self.client.get("/api/v1/payments/worker/revenue-summary/")
        self.assertEqual(res_denied.status_code, 403)

        # 2. Worker #1 checks initial revenue summary
        self.client.force_authenticate(user=self.worker_user)
        res_summary = self.client.get("/api/v1/payments/worker/revenue-summary/")
        self.assertEqual(res_summary.status_code, 200)
        self.assertEqual(res_summary.data["wallet_balance"], "0.00")
        self.assertEqual(res_summary.data["total_earned"], "0.00")
        self.assertEqual(res_summary.data["commission_rate"], "60.00")

        # 3. Create booking for Worker #1 and complete it
        booking1 = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            service=self.service,
            client_name="Pooja Sharma",
            service_name="Signature Haircut & Styling",
            service_price=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            advance_amount=Decimal("100.00"),
            remaining_amount=Decimal("400.00"),
            booking_date=date.today(),
            booking_time="11:00",
            start_time=time(11, 0),
            end_time=time(11, 45),
            status=Booking.Status.CONFIRMED,
        )
        record_service_completion_and_final_payment(booking1, remaining_amount_paid=Decimal("400.00"))

        # Verify Worker #1 wallet credited ₹300 (60% of ₹500)
        res_summary2 = self.client.get("/api/v1/payments/worker/revenue-summary/")
        self.assertEqual(res_summary2.status_code, 200)
        self.assertEqual(res_summary2.data["wallet_balance"], "300.00")
        self.assertEqual(res_summary2.data["total_earned"], "300.00")
        self.assertEqual(res_summary2.data["today_earned"], "300.00")
        self.assertEqual(res_summary2.data["completed_services_count"], 1)

        # Check Worker #1 earnings list
        res_earnings = self.client.get("/api/v1/payments/worker/earnings/")
        self.assertEqual(res_earnings.status_code, 200)
        self.assertEqual(res_earnings.data["count"], 1)
        self.assertEqual(res_earnings.data["results"][0]["earning_amount"], "300.00")
        self.assertEqual(res_earnings.data["results"][0]["booking_client_name"], "Pooja Sharma")

        # Check Worker #1 transactions list
        res_txs = self.client.get("/api/v1/payments/worker/transactions/")
        self.assertEqual(res_txs.status_code, 200)
        self.assertEqual(res_txs.data["count"], 1)
        self.assertEqual(res_txs.data["results"][0]["flow"], "CREDIT")
        self.assertEqual(res_txs.data["results"][0]["amount"], "300.00")
        self.assertEqual(res_txs.data["results"][0]["balance_after"], "300.00")

        # 4. Worker Isolation: Other worker (Meera) must NOT see Arjun's wallet or earnings
        self.client.force_authenticate(user=other_user)
        res_other_summary = self.client.get("/api/v1/payments/worker/revenue-summary/")
        self.assertEqual(res_other_summary.status_code, 200)
        self.assertEqual(res_other_summary.data["wallet_balance"], "0.00")
        self.assertEqual(res_other_summary.data["total_earned"], "0.00")
        self.assertEqual(res_other_summary.data["completed_services_count"], 0)

        res_other_earnings = self.client.get("/api/v1/payments/worker/earnings/")
        self.assertEqual(res_other_earnings.status_code, 200)
        self.assertEqual(res_other_earnings.data["count"], 0)

        res_other_txs = self.client.get("/api/v1/payments/worker/transactions/")
        self.assertEqual(res_other_txs.status_code, 200)
        self.assertEqual(res_other_txs.data["count"], 0)


class RevenueAtomicityAndReconciliationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="salonowner@luxe.com",
            password="Password123!",
            first_name="Ravi",
            last_name="Shankar",
            role="OWNER",
        )
        self.salon = Salon.objects.create(
            owner=self.owner,
            name="Luxe Aura Salon Test",
            city="Bengaluru",
            address="100 Feet Rd",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )
        self.worker_user = User.objects.create_user(
            email="stylist_arjun@luxe.com",
            password="Password123!",
            first_name="Arjun",
            last_name="Kapoor",
            role="WORKER",
        )
        self.worker = WorkerProfile.objects.create(
            user=self.worker_user,
            salon=self.salon,
            specialization="Master Hair Stylist",
            commission_rate=Decimal("60.00"),
        )
        self.customer = User.objects.create_user(
            email="customer_sneha@test.com",
            password="Password123!",
            first_name="Sneha",
            last_name="Patel",
            role="CUSTOMER",
        )
        self.booking = Booking.objects.create(
            salon=self.salon,
            customer=self.customer,
            worker=self.worker,
            client_name="Sneha Patel",
            service_name="Bridal Glow",
            service_price=1000.00,
            total_amount=1000.00,
            advance_amount=200.00,
            remaining_amount=800.00,
            is_advance_paid=True,
            booking_date=date.today(),
            booking_time="14:00",
            status=Booking.Status.IN_PROGRESS,
        )
        self.client = APIClient()

    def test_ledger_failure_rolls_back_status_and_reports_error(self):
        """
        When revenue service raises an error, status update MUST rollback
        and return HTTP 500 with retry_allowed=True. Booking must NOT remain COMPLETED.
        """
        self.client.force_authenticate(user=self.worker_user)

        with patch("payments.services.record_service_completion_and_final_payment", side_effect=RuntimeError("Simulated ledger DB failure")):
            res = self.client.patch(
                f"/api/v1/salons/worker/bookings/{self.booking.id}/status/",
                {"status": "COMPLETED"},
                format="json",
            )

        self.assertEqual(res.status_code, 500)
        self.assertIn("financial ledger sync error", res.data["error"])
        self.assertTrue(res.data.get("retry_allowed"))

        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.IN_PROGRESS)

    def test_reconcile_booking_revenue_service_and_idempotency(self):
        """
        Completed booking missing revenue can be reconciled accurately and idempotently.
        """
        from payments.services import reconcile_booking_revenue, get_unreconciled_bookings

        # Create un-synced completed booking
        unreconciled_booking = Booking.objects.create(
            salon=self.salon,
            customer=self.customer,
            worker=self.worker,
            client_name="Pooja Verma",
            service_name="Keratin Hair Treatment",
            service_price=2000.00,
            total_amount=2000.00,
            advance_amount=400.00,
            remaining_amount=1600.00,
            is_advance_paid=True,
            booking_date=date.today(),
            booking_time="15:00",
            status=Booking.Status.COMPLETED,
        )

        # Confirm it appears in unreconciled query
        unreconciled_qs = get_unreconciled_bookings(salon=self.salon)
        self.assertIn(unreconciled_booking, unreconciled_qs)

        # Run reconciliation
        res = reconcile_booking_revenue(unreconciled_booking, reconciled_by=self.owner)
        self.assertTrue(res["reconciled"])
        self.assertEqual(res["status"], "RECONCILED")
        self.assertTrue(res["owner_transaction_created"])
        self.assertTrue(res["worker_earning_created"])

        # Check balances
        from payments.models import WorkerWallet, OwnerWallet
        worker_wallet = WorkerWallet.objects.get(worker=self.worker)
        self.assertEqual(worker_wallet.balance, Decimal("1200.00"))  # 60% of 2000

        owner_wallet = OwnerWallet.objects.get(salon=self.salon)
        self.assertEqual(owner_wallet.total_worker_payout, Decimal("1200.00"))

        # Idempotency check: run again
        res2 = reconcile_booking_revenue(unreconciled_booking, reconciled_by=self.owner)
        self.assertTrue(res2["reconciled"])
        self.assertTrue(res2["already_synced"])
        self.assertFalse(res2["owner_transaction_created"])
        self.assertFalse(res2["worker_earning_created"])

        # Wallet balance must NOT be doubled
        worker_wallet.refresh_from_db()
        self.assertEqual(worker_wallet.balance, Decimal("1200.00"))

    def test_reconcile_api_endpoint_and_permissions(self):
        """
        Assigned worker and salon owner can call reconcile endpoint;
        unauthorized users receive HTTP 403.
        """
        unreconciled_booking = Booking.objects.create(
            salon=self.salon,
            customer=self.customer,
            worker=self.worker,
            client_name="Tina Sen",
            service_name="Facial",
            service_price=500.00,
            booking_date=date.today(),
            status=Booking.Status.COMPLETED,
        )

        # 1. Customer cannot reconcile (403)
        self.client.force_authenticate(user=self.customer)
        res_cust = self.client.post(f"/api/v1/payments/bookings/{unreconciled_booking.id}/reconcile-revenue/")
        self.assertEqual(res_cust.status_code, 403)

        # 2. Worker can reconcile (200)
        self.client.force_authenticate(user=self.worker_user)
        res_worker = self.client.post(f"/api/v1/payments/bookings/{unreconciled_booking.id}/reconcile-revenue/")
        self.assertEqual(res_worker.status_code, 200)
        self.assertTrue(res_worker.data["reconciled"])
        self.assertEqual(res_worker.data["status"], "RECONCILED")

        # 3. Owner unreconciled bookings list
        self.client.force_authenticate(user=self.owner)
        res_owner_list = self.client.get("/api/v1/payments/owner/unreconciled-bookings/")
        self.assertEqual(res_owner_list.status_code, 200)
        self.assertEqual(res_owner_list.data["count"], 0)  # Already reconciled!


class SalonOwnerWalletPaymentFlowTests(TestCase):
    """
    Comprehensive verification of Salon Owner payment and wallet management flow:
    - NO advance payment functionality
    - 60% worker commission rate
    - Online payment: full credit upon verification, commission deducted only after completion
    - Wallet payment: customer wallet deducted, owner wallet credited, commission deducted after completion
    - Pay at salon: zero wallet credits before completion; at completion customer payment (+1000)
      and worker commission (-600) both processed as separate atomic operations
    - Final financial invariance: all 3 methods yield identical final settlements
    - Cancellation before completion does not process worker commission
    - Idempotency prevents duplicate credits/deductions
    """
    def setUp(self):
        self.owner = User.objects.create_user(
            email="salon_owner_test@domain.com",
            password="Password123!",
            first_name="Rajesh",
            last_name="Khanna",
            role="OWNER",
        )
        self.salon = Salon.objects.create(
            owner=self.owner,
            name="Grand Elegance Salon",
            city="Mumbai",
            address="Linking Road, Bandra",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )

        self.worker_user = User.objects.create_user(
            email="specialist_test@domain.com",
            password="Password123!",
            first_name="Karan",
            last_name="Malhotra",
            role="WORKER",
        )
        self.worker = WorkerProfile.objects.create(
            user=self.worker_user,
            salon=self.salon,
            specialization="Senior Stylist",
            station="Station 01",
            commission_rate=Decimal("60.00"),
            is_active=True,
        )

        self.customer = User.objects.create_user(
            email="customer_test@domain.com",
            password="Password123!",
            first_name="Ananya",
            last_name="Roy",
            role="CUSTOMER",
        )

        self.category = ServiceCategory.objects.create(name="Hair Styling")
        self.base_service = Service.objects.create(
            name="Deluxe Hair Treatment",
            category=self.category,
            standard_price=Decimal("1000.00"),
            standard_duration=60,
        )
        self.salon_service = SalonService.objects.create(
            salon=self.salon,
            service=self.base_service,
            custom_name="Deluxe Hair Treatment",
            price=Decimal("1000.00"),
            duration=60,
            is_active=True,
        )

        self.client = APIClient()

    def test_online_payment_end_to_end_flow(self):
        """
        A. Online Payment Flow:
        1. When customer successfully completes online payment, credit received booking amount (+₹1,000)
           to respective Salon Owner's wallet.
        2. Before service completion, worker commission is NOT processed.
        3. Once service is marked as completed:
           - Worker commission (60% = ₹600) is deducted from Salon Owner's wallet (-₹600).
           - Worker wallet is credited (+₹600).
           - Net in Salon Owner wallet from this booking: ₹400.
        """
        from payments.services import (
            record_customer_payment_to_owner,
            record_service_completion_and_final_payment,
        )

        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            service=self.salon_service,
            client_name="Ananya Roy",
            service_name="Deluxe Hair Treatment",
            service_price=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            booking_date=date.today() + timedelta(days=1),
            booking_time="11:00",
            start_time=time(11, 0),
            end_time=time(12, 0),
            payment_method=Booking.PaymentMethod.ONLINE,
            status=Booking.Status.CONFIRMED,
            payment_status=Booking.PaymentStatus.PENDING,
            razorpay_order_id="order_online_1000",
            razorpay_payment_id="pay_online_1000",
        )

        # 1. Successful verified online payment credits owner wallet
        pay_tx = record_customer_payment_to_owner(
            booking=booking,
            amount=Decimal("1000.00"),
            payment_method=Payment.PaymentMethod.ONLINE,
            razorpay_order_id="order_online_1000",
            razorpay_payment_id="pay_online_1000",
            notes="Verified Razorpay payment",
        )
        self.assertIsNotNone(pay_tx)
        self.assertEqual(pay_tx.flow, OwnerWalletTransaction.FlowType.CREDIT)
        self.assertEqual(pay_tx.amount, Decimal("1000.00"))

        owner_wallet = OwnerWallet.objects.get(salon=self.salon)
        self.assertEqual(owner_wallet.balance, Decimal("1000.00"))

        # Verify worker has NOT received any commission yet
        worker_earning = WorkerEarning.objects.filter(booking=booking).first()
        self.assertIsNone(worker_earning)

        # 2. Service completion settles worker commission
        owner_tx, earning = record_service_completion_and_final_payment(
            booking=booking,
            completed_by_user=self.owner,
        )
        self.assertIsNotNone(earning)
        self.assertEqual(earning.earning_amount, Decimal("600.00"))
        self.assertEqual(earning.commission_rate, Decimal("60.00"))
        self.assertEqual(earning.salon_share, Decimal("400.00"))

        # Check worker wallet
        worker_wallet = self.worker.wallet
        self.assertEqual(worker_wallet.balance, Decimal("600.00"))

        # Check Salon Owner wallet:
        # Received: +₹1,000. Commission deducted: -₹600. Remaining: ₹400.
        owner_wallet.refresh_from_db()
        self.assertEqual(owner_wallet.balance, Decimal("400.00"))
        self.assertEqual(owner_wallet.total_collected, Decimal("1000.00"))
        self.assertEqual(owner_wallet.total_worker_payout, Decimal("600.00"))
        self.assertEqual(owner_wallet.total_completed_services, Decimal("1000.00"))

        # Verify two distinct transactions exist on owner wallet: +1000 credit and -600 debit
        txs = OwnerWalletTransaction.objects.filter(booking=booking).order_by("created_at")
        self.assertEqual(txs.count(), 2)
        credit_op = txs.filter(flow=OwnerWalletTransaction.FlowType.CREDIT).first()
        debit_op = txs.filter(flow=OwnerWalletTransaction.FlowType.DEBIT).first()
        self.assertEqual(credit_op.amount, Decimal("1000.00"))
        self.assertEqual(debit_op.amount, Decimal("600.00"))
        self.assertEqual(debit_op.amount, earning.earning_amount)

    def test_customer_wallet_payment_end_to_end_flow(self):
        """
        B. BookMySalon Customer Wallet Payment Flow:
        1. When customer pays using wallet, deduct ₹1,000 from customer wallet.
        2. Credit received ₹1,000 to Salon Owner's wallet.
        3. Settle worker commission only after service completion (-₹600 owner debit, +₹600 worker credit).
        4. Net Salon Owner wallet: ₹400.
        """
        from wallet.services import credit_wallet, process_wallet_booking_payment
        from payments.services import record_service_completion_and_final_payment

        # Pre-fund customer wallet with ₹2,000
        credit_wallet(self.customer, Decimal("2000.00"), reason="Initial wallet balance")

        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            service=self.salon_service,
            client_name="Ananya Roy",
            service_name="Deluxe Hair Treatment",
            service_price=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            booking_date=date.today() + timedelta(days=2),
            booking_time="14:00",
            start_time=time(14, 0),
            end_time=time(15, 0),
            payment_method=Booking.PaymentMethod.WALLET,
            status=Booking.Status.PENDING,
            payment_status=Booking.PaymentStatus.PENDING,
        )

        # 1. Customer wallet payment processing
        bkg, cust_tx = process_wallet_booking_payment(booking, self.customer)
        self.assertEqual(cust_tx.amount, Decimal("1000.00"))

        # Verify customer wallet debited
        cust_wallet = self.customer.wallet
        cust_wallet.refresh_from_db()
        self.assertEqual(cust_wallet.balance, Decimal("1000.00"))

        # Verify Salon Owner wallet credited +₹1,000
        owner_wallet = OwnerWallet.objects.get(salon=self.salon)
        self.assertEqual(owner_wallet.balance, Decimal("1000.00"))

        # 2. Complete service -> worker commission settled
        record_service_completion_and_final_payment(booking, completed_by_user=self.owner)

        # Salon Owner wallet: +1000 - 600 = ₹400
        owner_wallet.refresh_from_db()
        self.assertEqual(owner_wallet.balance, Decimal("400.00"))

        # Worker wallet: +₹600
        self.worker.wallet.refresh_from_db()
        self.assertEqual(self.worker.wallet.balance, Decimal("600.00"))

    def test_pay_at_salon_end_to_end_flow(self):
        """
        C. Pay at Salon Flow:
        1. When booking created, ZERO credit or deduction to Salon Owner wallet.
        2. Once service marked COMPLETED:
           - Record customer payment received (+₹1,000 credit).
           - Settle worker commission (-₹600 debit).
           - Credit worker wallet (+₹600 credit).
           - Net Salon Owner wallet: ₹400.
        """
        from payments.services import record_service_completion_and_final_payment

        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            service=self.salon_service,
            client_name="Ananya Roy",
            service_name="Deluxe Hair Treatment",
            service_price=Decimal("1000.00"),
            total_amount=Decimal("1000.00"),
            booking_date=date.today() + timedelta(days=3),
            booking_time="16:00",
            start_time=time(16, 0),
            end_time=time(17, 0),
            payment_method=Booking.PaymentMethod.PAY_AT_SALON,
            status=Booking.Status.CONFIRMED,
            payment_status=Booking.PaymentStatus.PENDING,
        )

        # Before completion: Salon Owner wallet has ZERO balance and zero transactions
        owner_wallet = OwnerWallet.get_or_create_for_salon(self.salon)
        self.assertEqual(owner_wallet.balance, Decimal("0.00"))
        self.assertEqual(OwnerWalletTransaction.objects.filter(booking=booking).count(), 0)

        # Complete service
        record_service_completion_and_final_payment(booking, completed_by_user=self.owner)

        # Salon Owner wallet receives customer payment (+1000) and worker commission (-600)
        owner_wallet.refresh_from_db()
        self.assertEqual(owner_wallet.balance, Decimal("400.00"))
        self.assertEqual(owner_wallet.total_collected, Decimal("1000.00"))
        self.assertEqual(owner_wallet.total_worker_payout, Decimal("600.00"))

        # Worker wallet receives +₹600
        self.worker.wallet.refresh_from_db()
        self.assertEqual(self.worker.wallet.balance, Decimal("600.00"))

        # Booking finalized to COMPLETED and PAID
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.COMPLETED)
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.PAID)
        self.assertTrue(booking.is_fully_paid)

    def test_financial_settlement_invariance_across_all_payment_methods(self):
        """
        Final Requirement: All three payment methods must produce the same final financial settlement
        for a completed booking:
        - Customer payment received: ₹1,000
        - Salon Owner wallet credit: +₹1,000
        - Worker commission: ₹600 (60%)
        - Salon Owner wallet deduction: -₹600
        - Worker earnings credit: +₹600
        - Remaining amount in Salon Owner wallet: ₹400
        """
        from wallet.services import credit_wallet, process_wallet_booking_payment
        from payments.services import (
            record_customer_payment_to_owner,
            record_service_completion_and_final_payment,
        )

        credit_wallet(self.customer, Decimal("1000.00"), reason="Wallet funding")

        # Booking 1: Online
        bkg_online = Booking.objects.create(
            salon=self.salon, worker=self.worker, customer=self.customer,
            service=self.salon_service, service_price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
            payment_method=Booking.PaymentMethod.ONLINE, status=Booking.Status.CONFIRMED,
            booking_date=date.today(), start_time=time(10, 0), end_time=time(11, 0),
        )
        record_customer_payment_to_owner(bkg_online)
        record_service_completion_and_final_payment(bkg_online)

        # Booking 2: Customer Wallet
        bkg_wallet = Booking.objects.create(
            salon=self.salon, worker=self.worker, customer=self.customer,
            service=self.salon_service, service_price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
            payment_method=Booking.PaymentMethod.WALLET, status=Booking.Status.PENDING,
            booking_date=date.today(), start_time=time(12, 0), end_time=time(13, 0),
        )
        process_wallet_booking_payment(bkg_wallet, self.customer)
        record_service_completion_and_final_payment(bkg_wallet)

        # Booking 3: Pay at Salon
        bkg_offline = Booking.objects.create(
            salon=self.salon, worker=self.worker, customer=self.customer,
            service=self.salon_service, service_price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
            payment_method=Booking.PaymentMethod.PAY_AT_SALON, status=Booking.Status.CONFIRMED,
            booking_date=date.today(), start_time=time(14, 0), end_time=time(15, 0),
        )
        record_service_completion_and_final_payment(bkg_offline)

        # Final Financial Check across all 3:
        # Salon Owner net per booking = ₹400. Total for 3 bookings = ₹1,200.
        owner_wallet = OwnerWallet.objects.get(salon=self.salon)
        self.assertEqual(owner_wallet.balance, Decimal("1200.00"))
        self.assertEqual(owner_wallet.total_collected, Decimal("3000.00"))
        self.assertEqual(owner_wallet.total_worker_payout, Decimal("1800.00"))

        # Worker total earned = 3 x ₹600 = ₹1,800
        self.worker.wallet.refresh_from_db()
        self.assertEqual(self.worker.wallet.balance, Decimal("1800.00"))

    def test_cancellation_before_completion_does_not_process_commission(self):
        """
        If a booking is cancelled before service completion, do not process worker commission.
        """
        from payments.services import (
            record_customer_payment_to_owner,
            process_booking_cancellation_and_refund,
        )

        # 1. Online booking cancelled before completion
        booking_online = Booking.objects.create(
            salon=self.salon, worker=self.worker, customer=self.customer,
            service=self.salon_service, service_price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
            payment_method=Booking.PaymentMethod.ONLINE, status=Booking.Status.CONFIRMED,
            booking_date=date.today() + timedelta(days=2), start_time=time(10, 0), end_time=time(11, 0),
        )
        record_customer_payment_to_owner(booking_online)
        owner_wallet = OwnerWallet.objects.get(salon=self.salon)
        self.assertEqual(owner_wallet.balance, Decimal("1000.00"))

        refund, owner_tx = process_booking_cancellation_and_refund(
            booking=booking_online, reason="Customer had to travel"
        )
        self.assertIsNotNone(refund)
        self.assertEqual(refund.amount, Decimal("1000.00"))
        self.assertEqual(refund.worker_reversal_amount, Decimal("0.00"))

        # Owner wallet debited ₹1,000 back to 0
        owner_wallet.refresh_from_db()
        self.assertEqual(owner_wallet.balance, Decimal("0.00"))

        # Customer wallet credited with refund
        self.customer.wallet.refresh_from_db()
        self.assertEqual(self.customer.wallet.balance, Decimal("1000.00"))

        # Worker commission was NEVER processed
        self.assertFalse(WorkerEarning.objects.filter(booking=booking_online).exists())
        self.assertEqual(self.worker.wallet.balance, Decimal("0.00"))

        # 2. Pay at Salon booking cancelled before completion
        booking_offline = Booking.objects.create(
            salon=self.salon, worker=self.worker, customer=self.customer,
            service=self.salon_service, service_price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
            payment_method=Booking.PaymentMethod.PAY_AT_SALON, status=Booking.Status.CONFIRMED,
            booking_date=date.today() + timedelta(days=3), start_time=time(15, 0), end_time=time(16, 0),
        )
        refund2, _ = process_booking_cancellation_and_refund(booking=booking_offline)
        self.assertIsNone(refund2)
        self.assertFalse(WorkerEarning.objects.filter(booking=booking_offline).exists())
        owner_wallet.refresh_from_db()
        self.assertEqual(owner_wallet.balance, Decimal("0.00"))

    def test_completion_idempotency_prevents_duplicate_credits_and_deductions(self):
        """
        Calling completion multiple times must not produce duplicate credits or deductions.
        """
        from payments.services import (
            record_customer_payment_to_owner,
            record_service_completion_and_final_payment,
        )

        booking = Booking.objects.create(
            salon=self.salon, worker=self.worker, customer=self.customer,
            service=self.salon_service, service_price=Decimal("1000.00"), total_amount=Decimal("1000.00"),
            payment_method=Booking.PaymentMethod.ONLINE, status=Booking.Status.CONFIRMED,
            booking_date=date.today(), start_time=time(10, 0), end_time=time(11, 0),
        )
        record_customer_payment_to_owner(booking)

        # Call completion 3 times
        for _ in range(3):
            record_service_completion_and_final_payment(booking)

        # Balances must remain exactly ₹400 (owner) and ₹600 (worker)
        owner_wallet = OwnerWallet.objects.get(salon=self.salon)
        self.assertEqual(owner_wallet.balance, Decimal("400.00"))

        self.worker.wallet.refresh_from_db()
        self.assertEqual(self.worker.wallet.balance, Decimal("600.00"))

        # Exactly 1 credit and 1 debit for this booking
        credits = OwnerWalletTransaction.objects.filter(booking=booking, flow=OwnerWalletTransaction.FlowType.CREDIT).count()
        debits = OwnerWalletTransaction.objects.filter(booking=booking, flow=OwnerWalletTransaction.FlowType.DEBIT).count()
        self.assertEqual(credits, 1)
        self.assertEqual(debits, 1)
        self.assertEqual(WorkerEarning.objects.filter(booking=booking).count(), 1)

