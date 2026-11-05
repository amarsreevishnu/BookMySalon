import hmac
import hashlib
from decimal import Decimal
from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.test import TestCase
from django.utils import timezone
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from salons.models import Salon
from services.models import ServiceCategory, Service, SalonService
from subscriptions.models import (
    SubscriptionPlan,
    SubscriptionSetting,
    SalonSubscription,
    SubscriptionPayment,
    SubscriptionHistory,
    SuperAdminWallet,
    SuperAdminWalletTransaction,
)
from subscriptions.services import (
    activate_trial_for_salon,
    create_subscription_razorpay_order,
    verify_and_activate_subscription,
    admin_manually_extend_subscription,
)


class SubscriptionsFeatureTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Admin
        self.admin = User.objects.create_user(
            email="admin@bookmysalon.com",
            password="adminpassword123",
            role="ADMIN",
            is_staff=True,
            is_superuser=True,
        )

        # 2. Owner
        self.owner = User.objects.create_user(
            email="owner@bookmysalon.com",
            password="ownerpassword123",
            role="OWNER",
        )

        # 3. Customer
        self.customer = User.objects.create_user(
            email="customer@bookmysalon.com",
            password="customerpassword123",
            role="CUSTOMER",
        )

        # 4. Salon
        self.salon = Salon.objects.create(
            owner=self.owner,
            name="Emerald Luxury Salon",
            city="Kochi",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )

        # 5. Service for booking tests
        self.category = ServiceCategory.objects.create(name="Hair Styling")
        self.service = Service.objects.create(
            category=self.category,
            name="Signature Cut",
            standard_price=500,
        )
        self.salon_service = SalonService.objects.create(
            salon=self.salon,
            service=self.service,
            price=500,
            duration=30,
        )

        # 6. Ensure default plans exist
        self.monthly_plan = SubscriptionPlan.objects.filter(duration_key="MONTHLY").first()
        if not self.monthly_plan:
            self.monthly_plan = SubscriptionPlan.objects.create(
                duration_key="MONTHLY",
                name="Monthly Starter",
                duration_months=1,
                price=Decimal("499.00"),
            )

        self.half_yearly_plan = SubscriptionPlan.objects.filter(duration_key="HALF_YEARLY").first()
        if not self.half_yearly_plan:
            self.half_yearly_plan = SubscriptionPlan.objects.create(
                duration_key="HALF_YEARLY",
                name="Half-Yearly Growth",
                duration_months=6,
                price=Decimal("2499.00"),
            )

    def test_activate_free_trial_once_only(self):
        # First activation grants 30-day trial
        sub = activate_trial_for_salon(self.salon, trial_days=30)
        self.assertIsNotNone(sub)
        self.assertEqual(sub.subscription_type, SalonSubscription.SubscriptionType.TRIAL)
        self.assertEqual(sub.status, SalonSubscription.Status.TRIAL)
        self.assertTrue(sub.is_currently_active)
        self.assertTrue(sub.has_used_free_trial)

        # Attempting second free trial activation must not grant another trial
        old_end_date = sub.end_date
        sub2 = activate_trial_for_salon(self.salon, trial_days=30)
        self.assertEqual(sub.id, sub2.id)
        self.assertEqual(sub2.end_date, old_end_date)

    @patch("subscriptions.services.requests.post")
    def test_create_subscription_razorpay_order(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"id": "order_test_123456"}
        mock_post.return_value = mock_resp

        order_data = create_subscription_razorpay_order(
            salon=self.salon,
            plan_id=self.monthly_plan.id,
            owner_user=self.owner,
        )

        self.assertEqual(order_data["order_id"], "order_test_123456")
        self.assertEqual(order_data["amount"], 499.0)
        self.assertEqual(order_data["amount_paise"], 49900)

        # Verify pending payment record created
        payment = SubscriptionPayment.objects.get(razorpay_order_id="order_test_123456")
        self.assertEqual(payment.status, SubscriptionPayment.Status.PENDING)
        self.assertEqual(payment.amount, Decimal("499.00"))

    def test_verify_and_activate_subscription_and_credit_super_admin_wallet(self):
        # Create pending payment
        payment = SubscriptionPayment.objects.create(
            salon=self.salon,
            owner=self.owner,
            plan=self.monthly_plan,
            amount=self.monthly_plan.price,
            razorpay_order_id="order_verify_999",
            status=SubscriptionPayment.Status.PENDING,
            receipt_number="RCPT-TEST-001",
        )

        order_id = "order_verify_999"
        payment_id = "pay_test_888"
        key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "v30VNXxs9ndbc3nbiltGgCce")
        signature = hmac.new(
            key_secret.encode("utf-8"),
            f"{order_id}|{payment_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        sub, verified_payment = verify_and_activate_subscription(
            salon=self.salon,
            razorpay_order_id=order_id,
            razorpay_payment_id=payment_id,
            razorpay_signature=signature,
        )

        self.assertEqual(verified_payment.status, SubscriptionPayment.Status.SUCCESS)
        self.assertTrue(sub.is_currently_active)
        self.assertEqual(sub.subscription_type, SalonSubscription.SubscriptionType.PAID)
        self.assertEqual(sub.status, SalonSubscription.Status.ACTIVE)

        # Check Super Admin Wallet was credited with 100% of subscription revenue
        wallet = SuperAdminWallet.get_wallet()
        self.assertEqual(wallet.balance, Decimal("499.00"))
        self.assertEqual(wallet.total_subscription_revenue, Decimal("499.00"))

        # Check transaction record
        tx = SuperAdminWalletTransaction.objects.filter(payment=verified_payment).first()
        self.assertIsNotNone(tx)
        self.assertEqual(tx.amount, Decimal("499.00"))
        self.assertEqual(tx.transaction_type, SuperAdminWalletTransaction.TransactionType.SUBSCRIPTION_CREDIT)

    def test_early_renewal_appends_to_current_expiration_date(self):
        # 1. Start with an active trial ending 20 days in the future
        now = timezone.now()
        trial_end = now + timedelta(days=20)
        sub = SalonSubscription.objects.create(
            salon=self.salon,
            plan=None,
            subscription_type=SalonSubscription.SubscriptionType.TRIAL,
            status=SalonSubscription.Status.TRIAL,
            start_date=now - timedelta(days=10),
            end_date=trial_end,
            has_used_free_trial=True,
        )

        # 2. Purchase a 6-month plan before trial expires
        payment = SubscriptionPayment.objects.create(
            salon=self.salon,
            owner=self.owner,
            plan=self.half_yearly_plan,
            amount=self.half_yearly_plan.price,
            razorpay_order_id="order_renewal_777",
            status=SubscriptionPayment.Status.PENDING,
            receipt_number="RCPT-RENEW-002",
        )

        order_id = "order_renewal_777"
        payment_id = "pay_renew_666"
        key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "v30VNXxs9ndbc3nbiltGgCce")
        signature = hmac.new(
            key_secret.encode("utf-8"),
            f"{order_id}|{payment_id}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        renewed_sub, _ = verify_and_activate_subscription(
            salon=self.salon,
            razorpay_order_id=order_id,
            razorpay_payment_id=payment_id,
            razorpay_signature=signature,
        )

        # Verified requirement:
        # "If the owner purchases before expiry, the paid subscription should start after the free trial ends, not immediately."
        # Duration: 6 months * 30 days = 180 days appended to trial_end!
        expected_min_end = trial_end + timedelta(days=179)
        self.assertGreaterEqual(renewed_sub.end_date, expected_min_end)

    def test_admin_manually_extend_subscription(self):
        sub = SalonSubscription.objects.create(
            salon=self.salon,
            subscription_type=SalonSubscription.SubscriptionType.PAID,
            status=SalonSubscription.Status.ACTIVE,
            start_date=timezone.now(),
            end_date=timezone.now() + timedelta(days=5),
        )
        old_end = sub.end_date

        admin_manually_extend_subscription(self.salon, extra_days=15, reason="VIP Extension", admin_user=self.admin)
        sub.refresh_from_db()
        self.assertGreaterEqual(sub.end_date, old_end + timedelta(days=14))

        history = SubscriptionHistory.objects.filter(
            salon=self.salon,
            action=SubscriptionHistory.Action.EXTENDED_BY_ADMIN,
        ).first()
        self.assertIsNotNone(history)
        self.assertIn("VIP Extension", history.notes)

    def test_expired_subscription_blocks_customer_booking(self):
        # Set subscription to EXPIRED
        now = timezone.now()
        sub = SalonSubscription.objects.create(
            salon=self.salon,
            subscription_type=SalonSubscription.SubscriptionType.TRIAL,
            status=SalonSubscription.Status.EXPIRED,
            start_date=now - timedelta(days=35),
            end_date=now - timedelta(days=5),
            has_used_free_trial=True,
        )

        self.client.force_authenticate(user=self.customer)
        response = self.client.post(
            "/api/v1/bookings/create/",
            {
                "salon_id": self.salon.id,
                "service_id": self.salon_service.id,
                "booking_date": (timezone.localdate() + timedelta(days=1)).strftime("%Y-%m-%d"),
                "start_time": "10:00:00",
                "payment_method": "PAY_AT_SALON",
                "client_name": "Test Customer",
                "client_phone": "9876543210",
                "client_email": "customer@bookmysalon.com",
            },
            format="json",
        )

        # Must reject booking
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("subscription has expired", response.data["error"])

    def test_admin_stats_and_wallet_views(self):
        self.client.force_authenticate(user=self.admin)

        # 1. Stats view
        res = self.client.get("/api/v1/subscriptions/admin/stats/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("wallet_balance", res.data)
        self.assertIn("total_revenue", res.data)
        self.assertIn("total_salons", res.data)

        # 2. Wallet view
        res_wallet = self.client.get("/api/v1/subscriptions/admin/wallet/")
        self.assertEqual(res_wallet.status_code, status.HTTP_200_OK)
        self.assertIn("wallet", res_wallet.data)
        self.assertIn("transactions", res_wallet.data)

    def test_expired_salon_hidden_from_public_platform(self):
        """Option 1 test: verify expired salon is completely hidden from public listings and direct customer views."""
        now = timezone.now()
        sub = SalonSubscription.objects.create(
            salon=self.salon,
            subscription_type=SalonSubscription.SubscriptionType.TRIAL,
            status=SalonSubscription.Status.EXPIRED,
            start_date=now - timedelta(days=35),
            end_date=now - timedelta(days=5),
            has_used_free_trial=True,
        )

        # 1. Unauthenticated / Customer listing at /api/v1/salons/ should NOT contain expired salon
        res_approved = self.client.get("/api/v1/salons/")
        self.assertEqual(res_approved.status_code, status.HTTP_200_OK)
        salon_ids_in_approved = [s["id"] for s in res_approved.data]
        self.assertNotIn(self.salon.id, salon_ids_in_approved)

        # 2. Customer Explore /api/v1/salons/explore/ should NOT contain expired salon
        res_explore = self.client.get("/api/v1/salons/explore/")
        self.assertEqual(res_explore.status_code, status.HTTP_200_OK)
        salon_ids_in_explore = [s["id"] for s in res_explore.data.get("salons", [])]
        self.assertNotIn(self.salon.id, salon_ids_in_explore)

        # 3. Direct visit /api/v1/salons/<id>/ by customer should return 404 with is_expired=True
        self.client.force_authenticate(user=self.customer)
        res_detail = self.client.get(f"/api/v1/salons/{self.salon.id}/")
        self.assertEqual(res_detail.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(res_detail.data.get("is_expired"))

        # 4. Now activate subscription
        sub.status = SalonSubscription.Status.ACTIVE
        sub.end_date = now + timedelta(days=30)
        sub.save()

        # Should now appear in approved list
        res_approved_active = self.client.get("/api/v1/salons/")
        self.assertIn(self.salon.id, [s["id"] for s in res_approved_active.data])

        # Should now appear in explore list
        res_explore_active = self.client.get("/api/v1/salons/explore/")
        self.assertIn(self.salon.id, [s["id"] for s in res_explore_active.data.get("salons", [])])

        # Should now be accessible on detail view
        res_detail_active = self.client.get(f"/api/v1/salons/{self.salon.id}/")
        self.assertEqual(res_detail_active.status_code, status.HTTP_200_OK)
