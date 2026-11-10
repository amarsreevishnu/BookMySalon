from unittest import TestCase
from django.utils import timezone
from datetime import timedelta

from .utils import generate_otp
from .models import PendingRegistration


class OTPUtilsTestCase(TestCase):
    def test_generate_otp(self):
        otp = generate_otp()
        self.assertEqual(len(otp), 6)
        self.assertTrue(otp.isdigit())

    def test_is_otp_expired(self):
        # 65 seconds ago should be expired
        pending = PendingRegistration(
            email="test@example.com",
            otp="123456",
            otp_created_at=timezone.now() - timedelta(seconds=65),
        )
        self.assertTrue(pending.is_otp_expired())

        # 30 seconds ago should NOT be expired
        fresh_pending = PendingRegistration(
            email="test2@example.com",
            otp="123456",
            otp_created_at=timezone.now() - timedelta(seconds=30),
        )
        self.assertFalse(fresh_pending.is_otp_expired())


from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()

class AdminUserManagementTestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email="admin@example.com",
            password="adminpassword123",
            first_name="Admin",
            last_name="Super",
        )
        self.customer = User.objects.create_user(
            email="customer@example.com",
            password="customerpassword123",
            first_name="John",
            last_name="Doe",
            role=User.Role.CUSTOMER,
        )
        self.owner = User.objects.create_user(
            email="owner@example.com",
            password="ownerpassword123",
            first_name="Jane",
            last_name="Owner",
            role=User.Role.OWNER,
        )

    def test_list_users_unauthorized(self):
        res = self.client.get("/api/v1/accounts/admin/users/")
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_list_customers_only(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/v1/accounts/admin/users/?role=CUSTOMER")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Should contain customer, but not owner
        emails = [u["email"] for u in res.data]
        self.assertIn(self.customer.email, emails)
        self.assertNotIn(self.owner.email, emails)

    def test_toggle_block_user(self):
        self.client.force_authenticate(user=self.admin)
        self.assertTrue(self.customer.is_active)

        # Block customer
        res = self.client.post(f"/api/v1/accounts/admin/users/{self.customer.id}/toggle-block/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertFalse(self.customer.is_active)

        # Unblock customer
        res = self.client.post(f"/api/v1/accounts/admin/users/{self.customer.id}/toggle-block/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertTrue(self.customer.is_active)


class OwnerChangePasswordTestCase(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="salonowner@example.com",
            password="currentPassword123",
            first_name="Salon",
            last_name="Owner",
            role=User.Role.OWNER,
        )
        self.customer = User.objects.create_user(
            email="customer@example.com",
            password="customerPassword123",
            first_name="Customer",
            last_name="User",
            role=User.Role.CUSTOMER,
        )

    def test_unauthenticated_cannot_change_password(self):
        res = self.client.post(
            "/api/v1/accounts/owner/change-password/",
            {
                "current_password": "currentPassword123",
                "new_password": "newSecurePassword123",
                "confirm_password": "newSecurePassword123",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_cannot_use_owner_change_password(self):
        self.client.force_authenticate(user=self.customer)
        res = self.client.post(
            "/api/v1/accounts/owner/change-password/",
            {
                "current_password": "customerPassword123",
                "new_password": "newSecurePassword123",
                "confirm_password": "newSecurePassword123",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_change_password_invalid_current_password(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            "/api/v1/accounts/owner/change-password/",
            {
                "current_password": "wrongPassword123",
                "new_password": "newSecurePassword123",
                "confirm_password": "newSecurePassword123",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Current password does not match", res.data["error"])

    def test_owner_change_password_same_password(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            "/api/v1/accounts/owner/change-password/",
            {
                "current_password": "currentPassword123",
                "new_password": "currentPassword123",
                "confirm_password": "currentPassword123",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot be the same", res.data["error"])

    def test_owner_change_password_mismatch(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            "/api/v1/accounts/owner/change-password/",
            {
                "current_password": "currentPassword123",
                "new_password": "newSecurePassword123",
                "confirm_password": "differentPassword123",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("do not match", res.data["error"])

    def test_owner_change_password_too_short(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            "/api/v1/accounts/owner/change-password/",
            {
                "current_password": "currentPassword123",
                "new_password": "short",
                "confirm_password": "short",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("at least 8 characters", res.data["error"])

    def test_owner_change_password_success(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            "/api/v1/accounts/owner/change-password/",
            {
                "current_password": "currentPassword123",
                "new_password": "brandNewPassword123",
                "confirm_password": "brandNewPassword123",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password("brandNewPassword123"))
        self.assertFalse(self.owner.check_password("currentPassword123"))

    def test_salons_endpoint_alias_success(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            "/api/v1/salons/owner/change-password/",
            {
                "current_password": "currentPassword123",
                "new_password": "brandNewPassword456",
                "confirm_password": "brandNewPassword456",
            },
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password("brandNewPassword456"))


class LoginBlockedUserTestCase(APITestCase):
    def setUp(self):
        self.active_user = User.objects.create_user(
            email="activeuser@example.com",
            password="correctPassword123",
            first_name="Active",
            last_name="User",
        )
        self.blocked_user = User.objects.create_user(
            email="blockeduser@example.com",
            password="correctPassword123",
            first_name="Blocked",
            last_name="User",
            is_active=False,
        )

    def test_active_user_login_success(self):
        res = self.client.post(
            "/api/v1/accounts/login/",
            {"email": "activeuser@example.com", "password": "correctPassword123"},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)

    def test_blocked_user_login_returns_user_blocked(self):
        res = self.client.post(
            "/api/v1/accounts/login/",
            {"email": "blockeduser@example.com", "password": "correctPassword123"},
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        # Verify it returns USER_BLOCKED code, not Invalid email or password
        self.assertIn("code", res.data)
        code = res.data["code"]
        code_val = code[0] if isinstance(code, list) else code
        self.assertEqual(code_val, "USER_BLOCKED")

    def test_wrong_password_returns_invalid_credentials(self):
        res = self.client.post(
            "/api/v1/accounts/login/",
            {"email": "blockeduser@example.com", "password": "wrongPassword999"},
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        error_str = str(res.data)
        self.assertIn("Invalid email or password", error_str)


class CustomerBlockedWorkflowTests(APITestCase):
    def setUp(self):
        from decimal import Decimal
        from salons.models import Salon
        from bookings.models import Booking
        from wallet.models import CustomerWallet
        from payments.models import OwnerWallet

        self.admin = User.objects.create_superuser(
            email="superadmin_wf@bookmysalon.com",
            password="AdminPassword123!",
            first_name="Super",
            last_name="Admin",
            role=User.Role.ADMIN,
        )
        self.owner_user = User.objects.create_user(
            email="salonowner_block@example.com",
            password="OwnerPassword123!",
            first_name="Salon",
            last_name="Owner",
            role=User.Role.OWNER,
        )
        self.salon = Salon.objects.create(
            owner=self.owner_user,
            name="Glamour Studio",
            email="glamour@example.com",
            phone="9876543210",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )
        self.owner_wallet, _ = OwnerWallet.objects.get_or_create(
            salon=self.salon,
            defaults={"owner": self.owner_user, "balance": Decimal("5000.00")},
        )
        self.customer = User.objects.create_user(
            email="activecustomer_wf@example.com",
            password="CustomerPassword123!",
            first_name="Alice",
            last_name="Wonder",
            role=User.Role.CUSTOMER,
        )
        self.customer_wallet, _ = CustomerWallet.objects.get_or_create(
            user=self.customer,
            defaults={"balance": Decimal("0.00")},
        )

        today = timezone.localdate()
        tomorrow = today + timedelta(days=1)
        next_week = today + timedelta(days=7)

        # 1. Upcoming Confirmed Online Booking (Paid ₹900)
        self.booking_online = Booking.objects.create(
            customer=self.customer,
            salon=self.salon,
            service_name="Hair Styling",
            service_price=Decimal("900.00"),
            total_amount=Decimal("900.00"),
            booking_date=tomorrow,
            booking_time="10:00",
            payment_method=Booking.PaymentMethod.ONLINE,
            payment_status=Booking.PaymentStatus.PAID,
            status=Booking.Status.CONFIRMED,
            is_fully_paid=True,
        )

        # 2. Upcoming Pending Pay-at-salon Booking (Unpaid ₹500)
        self.booking_pas = Booking.objects.create(
            customer=self.customer,
            salon=self.salon,
            service_name="Beard Grooming",
            service_price=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            booking_date=next_week,
            booking_time="14:00",
            payment_method=Booking.PaymentMethod.PAY_AT_SALON,
            payment_status=Booking.PaymentStatus.PENDING,
            status=Booking.Status.PENDING,
            is_fully_paid=False,
        )

        # 3. Ongoing In-Progress Booking (Should NOT be cancelled)
        self.booking_in_progress = Booking.objects.create(
            customer=self.customer,
            salon=self.salon,
            service_name="Facial Treatment",
            service_price=Decimal("1200.00"),
            total_amount=Decimal("1200.00"),
            booking_date=today,
            booking_time="09:00",
            payment_method=Booking.PaymentMethod.ONLINE,
            payment_status=Booking.PaymentStatus.PAID,
            status=Booking.Status.IN_PROGRESS,
            is_fully_paid=True,
        )

        # 4. Past Completed Booking (Should NOT be cancelled)
        self.booking_completed = Booking.objects.create(
            customer=self.customer,
            salon=self.salon,
            service_name="Pedicure",
            service_price=Decimal("700.00"),
            total_amount=Decimal("700.00"),
            booking_date=today - timedelta(days=3),
            booking_time="11:00",
            payment_method=Booking.PaymentMethod.ONLINE,
            payment_status=Booking.PaymentStatus.PAID,
            status=Booking.Status.COMPLETED,
            is_fully_paid=True,
        )

    def test_get_customer_blocking_summary(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(f"/api/v1/accounts/admin/users/{self.customer.id}/toggle-block/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("summary", res.data)
        summary = res.data["summary"]
        self.assertEqual(summary["upcoming_count"], 2)
        self.assertEqual(summary["in_progress_count"], 1)
        self.assertEqual(summary["completed_count"], 1)
        self.assertEqual(summary["estimated_refund_amount"], "900.00")

    def test_block_customer_cancels_upcoming_and_refunds_wallet(self):
        from decimal import Decimal
        from bookings.models import Booking, BookingHistory

        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            f"/api/v1/accounts/admin/users/{self.customer.id}/toggle-block/",
            {"admin_notes": "Policy violation"},
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["cancelled_bookings_count"], 2)
        self.assertEqual(res.data["refunded_bookings_count"], 1)
        self.assertEqual(res.data["total_refunded_amount"], "900.00")

        self.customer.refresh_from_db()
        self.assertFalse(self.customer.is_active)

        # Check online booking was cancelled and refunded
        self.booking_online.refresh_from_db()
        self.assertEqual(self.booking_online.status, Booking.Status.CANCELLED)
        self.assertEqual(self.booking_online.payment_status, Booking.PaymentStatus.REFUNDED)

        # Check pay at salon booking was cancelled without refund
        self.booking_pas.refresh_from_db()
        self.assertEqual(self.booking_pas.status, Booking.Status.CANCELLED)

        # Check in-progress booking was NOT cancelled
        self.booking_in_progress.refresh_from_db()
        self.assertEqual(self.booking_in_progress.status, Booking.Status.IN_PROGRESS)

        # Check completed booking was NOT cancelled
        self.booking_completed.refresh_from_db()
        self.assertEqual(self.booking_completed.status, Booking.Status.COMPLETED)

        # Check customer wallet was credited 100% refund
        self.customer_wallet.refresh_from_db()
        self.assertEqual(self.customer_wallet.balance, Decimal("900.00"))

        # Check BookingHistory was recorded with USER_BLOCKED_BY_ADMIN
        histories = BookingHistory.objects.filter(
            booking=self.booking_online,
            action=BookingHistory.Action.CANCELLED,
        )
        self.assertTrue(histories.exists())
        self.assertEqual(histories.first().reason, "USER_BLOCKED_BY_ADMIN")

        # Verify blocked customer cannot log in
        login_res = self.client.post(
            "/api/v1/accounts/login/",
            {"email": "activecustomer_wf@example.com", "password": "CustomerPassword123!"},
        )
        self.assertEqual(login_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("code", login_res.data)
        code_val = login_res.data["code"][0] if isinstance(login_res.data["code"], list) else login_res.data["code"]
        self.assertEqual(str(code_val), "USER_BLOCKED")

    def test_unblock_customer_restores_active_status(self):
        self.client.force_authenticate(user=self.admin)
        # 1. Block
        self.client.post(f"/api/v1/accounts/admin/users/{self.customer.id}/toggle-block/")
        self.customer.refresh_from_db()
        self.assertFalse(self.customer.is_active)

        # 2. Unblock
        res = self.client.post(f"/api/v1/accounts/admin/users/{self.customer.id}/toggle-block/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.customer.refresh_from_db()
        self.assertTrue(self.customer.is_active)



