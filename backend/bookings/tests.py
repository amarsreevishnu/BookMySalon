from decimal import Decimal
from datetime import date, time, timedelta
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from salons.models import Salon, WorkerProfile
from services.models import ServiceCategory, Service, SalonService
from bookings.models import Booking


@patch("notifications.services.notify_booking_confirmed")
@patch("bookings.tasks.trigger_booking_confirmation_email")
class BookingCoreLogicTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.owner = User.objects.create_user(
            email="owner@salon.com",
            password="testpassword123",
            role="OWNER",
        )
        self.customer = User.objects.create_user(
            email="customer@gmail.com",
            password="testpassword123",
            role="CUSTOMER",
            first_name="Customer",
            last_name="One",
        )
        self.worker_user = User.objects.create_user(
            email="worker@salon.com",
            password="testpassword123",
            role="WORKER",
            first_name="Stylist",
            last_name="Expert",
        )

        # Salon
        self.salon = Salon.objects.create(
            owner=self.owner,
            name="Elite Salon",
            city="Kochi",
            phone="9876543210",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )

        # Worker Profile
        self.worker = WorkerProfile.objects.create(
            user=self.worker_user,
            salon=self.salon,
            specialization="Stylist",
            station="Station 01",
            is_active=True,
            assigned_services=[],  # Empty means capable of all services
        )

        # Service 1: price 500.00
        self.category = ServiceCategory.objects.create(name="Hair")
        self.service_model = Service.objects.create(
            category=self.category,
            name="Classic Haircut",
            standard_price=500,
        )
        self.salon_service = SalonService.objects.create(
            salon=self.salon,
            service=self.service_model,
            price=Decimal("500.00"),
            duration=30,
            is_active=True,
        )

        # Service 2: price 200.00
        self.service_model2 = Service.objects.create(
            category=self.category,
            name="Beard Trim",
            standard_price=200,
        )
        self.salon_service2 = SalonService.objects.create(
            salon=self.salon,
            service=self.service_model2,
            price=Decimal("200.00"),
            duration=20,
            is_active=True,
        )

        # Authenticate client as customer
        self.client.force_authenticate(user=self.customer)
        self.target_date = timezone.localdate() + timedelta(days=2)

    def _get_base_payload(self):
        return {
            "salon_id": self.salon.id,
            "service_id": self.salon_service.id,
            "booking_date": self.target_date.strftime("%Y-%m-%d"),
            "start_time": "10:00",
            "worker_id": self.worker.id,
            "client_name": "Customer One",
            "client_phone": "9876543210",
            "client_email": "customer@gmail.com",
            "payment_method": "PAY_AT_SALON",
        }

    def test_client_price_tampering_is_prevented(self, mock_email, mock_notify):
        """Verify client cannot inject fraudulent subtotal, discount, or total_amount."""
        payload = self._get_base_payload()
        # Malicious client sends arbitrary price manipulation
        payload["subtotal"] = "10.00"
        payload["total_amount"] = "10.00"
        payload["discount_amount"] = "490.00"

        response = self.client.post("/api/v1/bookings/create/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        booking = Booking.objects.get(pk=response.data["booking"]["id"])
        # Backend must use true service price (500.00) + 5% tax (25.00), not the injected 10.00
        self.assertEqual(booking.subtotal, Decimal("500.00"))
        self.assertEqual(booking.tax_amount, Decimal("25.00"))
        self.assertEqual(booking.total_amount, Decimal("525.00"))
        self.assertEqual(booking.discount_amount, Decimal("0.00"))
        self.assertNotEqual(booking.total_amount, Decimal("10.00"))

    def test_booking_confirmation_message_pay_at_salon(self, mock_email, mock_notify):
        """PAY_AT_SALON bookings should be CONFIRMED and return 'Booking confirmed successfully!'."""
        payload = self._get_base_payload()
        payload["payment_method"] = "PAY_AT_SALON"
        payload["start_time"] = "11:00"

        response = self.client.post("/api/v1/bookings/create/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["booking"]["status"], "CONFIRMED")
        self.assertEqual(response.data["message"], "Booking confirmed successfully!")

    def test_booking_confirmation_message_online(self, mock_email, mock_notify):
        """ONLINE payment bookings should be PENDING and return 'Booking initiated. Please complete online payment to confirm.'."""
        payload = self._get_base_payload()
        payload["payment_method"] = "ONLINE"
        payload["start_time"] = "12:00"

        response = self.client.post("/api/v1/bookings/create/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["booking"]["status"], "PENDING")
        self.assertEqual(
            response.data["message"],
            "Booking initiated. Please complete online payment to confirm.",
        )

    def test_worker_slot_conflict_prevention(self, mock_email, mock_notify):
        """Simultaneous or overlapping slot for the same worker must return 409 Conflict."""
        payload1 = self._get_base_payload()
        payload1["start_time"] = "14:00"  # 14:00 - 14:30

        # First booking succeeds
        res1 = self.client.post("/api/v1/bookings/create/", payload1, format="json")
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Overlapping booking for same worker at 14:15 must fail with 409 Conflict
        payload2 = self._get_base_payload()
        payload2["start_time"] = "14:15"

        res2 = self.client.post("/api/v1/bookings/create/", payload2, format="json")
        self.assertEqual(res2.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("no longer available", res2.data.get("error", "").lower())

    def test_multi_service_booking_pricing_calculation(self, mock_email, mock_notify):
        """Multi-service bookings must calculate total subtotal and total_amount as sum of services + tax."""
        payload = self._get_base_payload()
        payload.pop("service_id", None)
        payload["service_ids"] = [self.salon_service.id, self.salon_service2.id]
        payload["start_time"] = "15:00"

        response = self.client.post("/api/v1/bookings/create/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        booking = Booking.objects.get(pk=response.data["booking"]["id"])
        expected_subtotal = Decimal("500.00") + Decimal("200.00")  # 700.00
        expected_tax = Decimal("35.00")  # 5% of 700.00
        expected_total = Decimal("735.00")
        self.assertEqual(booking.subtotal, expected_subtotal)
        self.assertEqual(booking.tax_amount, expected_tax)
        self.assertEqual(booking.total_amount, expected_total)
        self.assertEqual(booking.services.count(), 2)

    def test_booking_reserve_view_and_conflict(self, mock_email, mock_notify):
        """Temporary slot reservation must hold slot and reject conflicting bookings."""
        payload = self._get_base_payload()
        payload["start_time"] = "16:00"

        res_reserve = self.client.post("/api/v1/bookings/reserve/", payload, format="json")
        self.assertEqual(res_reserve.status_code, status.HTTP_201_CREATED)
        self.assertIn("temporarily reserved", res_reserve.data.get("message", "").lower())
        self.assertIn("reservation_id", res_reserve.data)

        # Now regular booking attempt for that same slot must fail due to active reservation
        res_conflict = self.client.post("/api/v1/bookings/create/", payload, format="json")
        self.assertEqual(res_conflict.status_code, status.HTTP_409_CONFLICT)
