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


