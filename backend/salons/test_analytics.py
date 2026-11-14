from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from salons.models import Salon
from bookings.models import Booking
from subscriptions.models import SubscriptionPlan, SalonSubscription, SubscriptionPayment
from support.models import SupportTicket

User = get_user_model()

class AdminAnalyticsDashboardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email="superadmin@bookmysalon.com",
            password="adminpassword123",
            role=User.Role.ADMIN,
        )
        self.owner = User.objects.create_user(
            email="salonowner@example.com",
            password="ownerpassword123",
            role=User.Role.OWNER,
        )
        self.customer = User.objects.create_user(
            email="customer@example.com",
            password="customerpassword123",
            role=User.Role.CUSTOMER,
        )

        self.salon = Salon.objects.create(
            name="Emerald Luxe Salon",
            owner=self.owner,
            city="Bengaluru",
            phone="9876543210",
            address="100 Feet Rd, Indiranagar",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )

        self.plan = SubscriptionPlan.objects.create(
            name="Quarterly Pro",
            duration_months=3,
            price=Decimal("4999.00"),
            is_active=True,
        )

        self.sub = SalonSubscription.objects.create(
            salon=self.salon,
            plan=self.plan,
            status=SalonSubscription.Status.ACTIVE,
            subscription_type=SalonSubscription.SubscriptionType.PAID,
            start_date=timezone.now(),
            end_date=timezone.now() + timezone.timedelta(days=90),
        )

        self.payment = SubscriptionPayment.objects.create(
            salon=self.salon,
            owner=self.owner,
            plan=self.plan,
            amount=Decimal("4999.00"),
            status=SubscriptionPayment.Status.SUCCESS,
            razorpay_order_id="order_test_123",
            razorpay_payment_id="pay_test_123",
        )

        self.booking = Booking.objects.create(
            salon=self.salon,
            customer=self.customer,
            client_name="Test Client",
            service_name="Royal Hair Spa",
            service_price=Decimal("1500.00"),
            total_amount=Decimal("1500.00"),
            booking_date=timezone.now().date(),
            booking_time="11:00 AM",
            status=Booking.Status.COMPLETED,
        )

        self.ticket = SupportTicket.objects.create(
            ticket_number="TKT-ANALYTICS-01",
            salon=self.salon,
            created_by=self.owner,
            subject="Payout verification assistance",
            status=SupportTicket.Status.OPEN,
            priority=SupportTicket.Priority.HIGH,
        )

    def test_unauthenticated_access_rejected(self):
        res = self.client.get("/api/v1/salons/admin/analytics/")
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_customer_access_forbidden(self):
        self.client.force_authenticate(user=self.customer)
        res = self.client.get("/api/v1/salons/admin/analytics/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_access_success(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/v1/salons/admin/analytics/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        self.assertIn("overview", data)
        self.assertIn("overview_charts", data)
        self.assertIn("user_analytics", data)
        self.assertIn("salon_analytics", data)
        self.assertIn("booking_analytics", data)
        self.assertIn("revenue_analytics", data)
        self.assertIn("review_analytics", data)
        self.assertIn("offer_analytics", data)
        self.assertIn("subscription_analytics", data)
        self.assertIn("support_analytics", data)
        self.assertIn("platform_activity", data)

        # Platform Overview (7 Requested Cards)
        self.assertIn("total_revenue", data["overview"])
        self.assertIn("total_bookings", data["overview"])
        self.assertIn("total_salons", data["overview"])
        self.assertIn("total_customers", data["overview"])
        self.assertIn("total_reviews", data["overview"])
        self.assertIn("total_offers", data["overview"])
        self.assertIn("total_support_tickets", data["overview"])

        self.assertEqual(data["overview"]["total_revenue"]["value"], 4999.0)
        self.assertEqual(data["overview"]["total_bookings"]["value"], 1)
        self.assertGreaterEqual(data["overview"]["total_salons"]["value"], 1)
        self.assertGreaterEqual(data["overview"]["total_customers"]["value"], 1)

        # Platform Overview (7 Requested Charts)
        self.assertIn("revenue_trends", data["overview_charts"])
        self.assertIn("booking_trends", data["overview_charts"])
        self.assertIn("salon_growth", data["overview_charts"])
        self.assertIn("customer_growth", data["overview_charts"])
        self.assertIn("review_trends", data["overview_charts"])
        self.assertIn("offer_usage", data["overview_charts"])
        self.assertIn("ticket_distribution", data["overview_charts"])

        # Revenue checks
        self.assertEqual(data["revenue_analytics"]["gross_subscription_revenue"], 4999.0)
        self.assertEqual(data["revenue_analytics"]["all_time_revenue"], 4999.0)

        # Booking checks
        self.assertEqual(data["booking_analytics"]["total_bookings"], 1)
        self.assertEqual(data["booking_analytics"]["completed"], 1)

    def test_different_timeframes(self):
        self.client.force_authenticate(user=self.admin)
        for tf in ["today", "7d", "30d", "3m", "year"]:
            res = self.client.get(f"/api/v1/salons/admin/analytics/?timeframe={tf}")
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data["timeframe"]["selected"], tf)

    def test_custom_timeframe(self):
        self.client.force_authenticate(user=self.admin)
        today_str = timezone.now().strftime("%Y-%m-%d")
        res = self.client.get(f"/api/v1/salons/admin/analytics/?timeframe=custom&start_date={today_str}&end_date={today_str}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["timeframe"]["selected"], "custom")
