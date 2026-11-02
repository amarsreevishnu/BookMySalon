import hashlib
import hmac
from datetime import date, time, timedelta
from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from bookings.models import Booking
from bookings.views import _clean_expired_reservations
from payments.models import Payment
from salons.models import Salon, WorkerProfile
from services.models import SalonService, ServiceCategory, Service

User = get_user_model()


class BookingPaymentStatusFlowTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner_flow@test.com", password="password123", role="OWNER", first_name="Salon", last_name="Owner"
        )
        self.customer = User.objects.create_user(
            email="customer_flow@test.com", password="password123", role="CUSTOMER", first_name="Priya", last_name="Sharma"
        )
        self.other_customer = User.objects.create_user(
            email="other_flow@test.com", password="password123", role="CUSTOMER", first_name="Ravi", last_name="Verma"
        )

        self.salon = Salon.objects.create(
            name="Style Studio",
            owner=self.owner,
            phone="9876543210",
            email="stylestudio@test.com",
            address="45 Indiranagar",
            city="Bengaluru",
            state="Karnataka",
            pincode="560038",
            approval_status=Salon.ApprovalStatus.APPROVED,
            opening_hours={
                "monday": {"isOpen": True, "open": "09:00", "close": "20:00"},
                "tuesday": {"isOpen": True, "open": "09:00", "close": "20:00"},
                "wednesday": {"isOpen": True, "open": "09:00", "close": "20:00"},
                "thursday": {"isOpen": True, "open": "09:00", "close": "20:00"},
                "friday": {"isOpen": True, "open": "09:00", "close": "20:00"},
                "saturday": {"isOpen": True, "open": "09:00", "close": "20:00"},
                "sunday": {"isOpen": True, "open": "09:00", "close": "20:00"},
            },
        )

        self.cat = ServiceCategory.objects.create(name="Hair Care")
        self.master = Service.objects.create(name="Haircut & Styling", category=self.cat)
        self.salon_service = SalonService.objects.create(
            salon=self.salon,
            service=self.master,
            price=Decimal("650.00"),
            duration=30,
            is_active=True,
        )

        self.worker_user = User.objects.create_user(
            email="worker_flow@test.com",
            password="password123",
            role="WORKER",
            first_name="Vikram",
            last_name="Singh",
        )
        self.worker = WorkerProfile.objects.create(
            user=self.worker_user,
            salon=self.salon,
            phone_number="9123456789",
            is_active=True,
            station="Station 01",
            assigned_services=["Haircut & Styling"],
        )

        self.client = APIClient()

    def test_pay_at_salon_creates_confirmed_booking(self):
        """
        Requirement: customer side booking if the payment mode select as payatsalon
        status goes immediately to CONFIRMED.
        """
        self.client.force_authenticate(user=self.customer)
        payload = {
            "salon_id": self.salon.id,
            "service_id": self.salon_service.id,
            "service_ids": [self.salon_service.id],
            "worker_id": self.worker.id,
            "booking_date": (date.today() + timedelta(days=2)).isoformat(),
            "start_time": "11:00",
            "client_name": "Priya Sharma",
            "client_phone": "9876543210",
            "client_email": "customer_flow@test.com",
            "payment_method": "PAY_AT_SALON",
            "notes": "Regular appointment",
        }

        response = self.client.post("/api/v1/bookings/create/", payload, format="json")
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED], response.data)

        booking_id = response.data["booking"]["id"]
        booking = Booking.objects.get(pk=booking_id)

        self.assertEqual(booking.payment_method, Booking.PaymentMethod.PAY_AT_SALON)
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.PENDING)

    @patch("requests.post")
    def test_online_payment_initial_status_is_pending(self, mock_post):
        """
        Requirement: online payment only first pending.
        """
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"id": "order_test_123456", "status": "created"},
        )

        self.client.force_authenticate(user=self.customer)
        booking_date = (date.today() + timedelta(days=3)).isoformat()
        payload = {
            "salon_id": self.salon.id,
            "service_id": self.salon_service.id,
            "service_ids": [self.salon_service.id],
            "worker_id": self.worker.id,
            "booking_date": booking_date,
            "start_time": "14:00",
            "client_name": "Priya Sharma",
            "client_phone": "9876543210",
            "client_email": "customer_flow@test.com",
            "payment_method": "ONLINE",
            "notes": "Online prepaid",
        }

        response = self.client.post("/api/v1/bookings/create-razorpay-order/", payload, format="json")
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED], response.data)

        booking_id = response.data["booking_id"]
        booking = Booking.objects.get(pk=booking_id)

        self.assertEqual(booking.payment_method, Booking.PaymentMethod.ONLINE)
        self.assertEqual(booking.status, Booking.Status.PENDING)
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.PENDING)
        self.assertEqual(booking.total_amount, Decimal("683.00"))
        self.assertEqual(booking.remaining_amount, Decimal("0.00"))
        self.assertEqual(response.data["amount"], 68300)  # full amount in paise (650 + 5% tax = 683)
        self.assertEqual(booking.razorpay_order_id, "order_test_123456")
        self.assertIsNotNone(booking.expires_at)

    def test_online_payment_success_transitions_to_confirmed(self):
        """
        Requirement: after razorpay success status CONFIRMED.
        """
        order_id = "order_test_success_999"
        payment_id = "pay_test_success_999"
        rzp_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "dummy_secret")

        msg = f"{order_id}|{payment_id}".encode()
        valid_signature = hmac.new(rzp_secret.encode(), msg, hashlib.sha256).hexdigest()

        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            client_name="Priya Sharma",
            client_email="customer_flow@test.com",
            service_name="Haircut & Styling",
            service_price=Decimal("650.00"),
            subtotal=Decimal("650.00"),
            total_amount=Decimal("650.00"),
            remaining_amount=Decimal("0.00"),
            booking_date=date.today() + timedelta(days=4),
            booking_time="15:00",
            start_time=time(15, 0),
            end_time=time(15, 30),
            payment_method=Booking.PaymentMethod.ONLINE,
            status=Booking.Status.PENDING,
            payment_status=Booking.PaymentStatus.PENDING,
            razorpay_order_id=order_id,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        self.client.force_authenticate(user=self.customer)
        verify_payload = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": valid_signature,
        }

        with patch("requests.get") as mock_get:
            mock_get.return_value = MagicMock(
                status_code=200,
                json=lambda: {
                    "id": payment_id,
                    "order_id": order_id,
                    "status": "captured",
                    "amount": 65000,
                },
            )
            response = self.client.post(f"/api/v1/bookings/{booking.id}/verify-razorpay/", verify_payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data if hasattr(response, "data") else response.content)
        booking.refresh_from_db()

        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.PAID)
        self.assertEqual(booking.razorpay_payment_id, payment_id)
        self.assertIsNone(booking.expires_at)

    def test_online_payment_failure_transitions_to_cancelled(self):
        """
        Requirement: if failed CANCELLED.
        When payment fails on client/gateway and notifies payment-failed endpoint,
        booking status transitions to CANCELLED and payment_status to FAILED.
        """
        order_id = "order_test_fail_111"
        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            client_name="Priya Sharma",
            client_email="customer_flow@test.com",
            service_name="Haircut & Styling",
            service_price=Decimal("650.00"),
            subtotal=Decimal("650.00"),
            total_amount=Decimal("650.00"),
            remaining_amount=Decimal("650.00"),
            booking_date=date.today() + timedelta(days=5),
            booking_time="16:00",
            start_time=time(16, 0),
            end_time=time(16, 30),
            payment_method=Booking.PaymentMethod.ONLINE,
            status=Booking.Status.PENDING,
            payment_status=Booking.PaymentStatus.PENDING,
            razorpay_order_id=order_id,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        Payment.objects.create(
            booking=booking,
            customer=self.customer,
            salon=self.salon,
            amount=Decimal("650.00"),
            payment_method=Payment.PaymentMethod.ONLINE,
            payment_status=Payment.PaymentStatus.PENDING,
            razorpay_order_id=order_id,
        )

        self.client.force_authenticate(user=self.customer)
        fail_payload = {
            "razorpay_order_id": order_id,
            "reason": "Payment declined by issuing bank",
            "error_code": "BAD_REQUEST_ERROR",
        }

        response = self.client.post(f"/api/v1/bookings/{booking.id}/payment-failed/", fail_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data if hasattr(response, "data") else response.content)

        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.FAILED)
        self.assertIsNone(booking.expires_at)
        self.assertIn("Payment Failed: Payment declined by issuing bank", booking.notes)

        # Ensure slot is now unlocked and can be booked by someone else
        active_conflicts = Booking.objects.filter(
            worker=self.worker,
            booking_date=booking.booking_date,
            start_time__lt=booking.end_time,
            end_time__gt=booking.start_time,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS],
        )
        self.assertFalse(active_conflicts.exists())

    def test_invalid_signature_cancels_pending_booking(self):
        """
        Requirement: if verification fails (invalid signature), booking is cancelled.
        """
        order_id = "order_test_tamper_222"
        payment_id = "pay_test_tamper_222"

        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            client_name="Priya Sharma",
            service_name="Haircut & Styling",
            service_price=Decimal("650.00"),
            total_amount=Decimal("650.00"),
            booking_date=date.today() + timedelta(days=6),
            booking_time="10:00",
            start_time=time(10, 0),
            end_time=time(10, 30),
            payment_method=Booking.PaymentMethod.ONLINE,
            status=Booking.Status.PENDING,
            payment_status=Booking.PaymentStatus.PENDING,
            razorpay_order_id=order_id,
            expires_at=timezone.now() + timedelta(minutes=10),
        )

        self.client.force_authenticate(user=self.customer)
        tampered_payload = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": "fake_or_tampered_signature",
        }

        response = self.client.post(f"/api/v1/bookings/{booking.id}/verify-razorpay/", tampered_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.FAILED)

    def test_expired_online_reservation_is_cleaned_to_cancelled(self):
        """
        Requirement: an abandoned/expired online reservation is marked CANCELLED with FAILED payment status.
        """
        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            client_name="Priya Sharma",
            service_name="Haircut & Styling",
            service_price=Decimal("650.00"),
            total_amount=Decimal("650.00"),
            booking_date=date.today() + timedelta(days=7),
            booking_time="12:00",
            start_time=time(12, 0),
            end_time=time(12, 30),
            payment_method=Booking.PaymentMethod.ONLINE,
            status=Booking.Status.PENDING,
            payment_status=Booking.PaymentStatus.PENDING,
            expires_at=timezone.now() - timedelta(minutes=5),  # expired
        )

        _clean_expired_reservations()

        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CANCELLED)
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.FAILED)

