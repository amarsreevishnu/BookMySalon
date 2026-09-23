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

