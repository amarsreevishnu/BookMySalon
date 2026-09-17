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
