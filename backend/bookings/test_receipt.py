import io
from datetime import date, time
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from bookings.models import Booking, ServiceReceipt
from salons.models import Salon, WorkerProfile
from services.models import SalonService, ServiceCategory, Service

User = get_user_model()


class ServiceReceiptTests(TestCase):
    def setUp(self):
        # 1. Users
        self.owner = User.objects.create_user(
            email="owner@test.com", password="password123", role="OWNER", first_name="Owner", last_name="Salon"
        )
        self.customer = User.objects.create_user(
            email="customer@test.com", password="password123", role="CUSTOMER", first_name="Alice", last_name="Smith"
        )
        self.other_customer = User.objects.create_user(
            email="other@test.com", password="password123", role="CUSTOMER", first_name="Bob", last_name="Jones"
        )

        # 2. Salon
        self.salon = Salon.objects.create(
            name="Luxe Glamour Salon",
            owner=self.owner,
            phone="9876543210",
            email="luxe@test.com",
            address="123 Luxury Avenue",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
        )

        # 3. Category & Service
        self.cat = ServiceCategory.objects.create(name="Hair Care")
        self.master = Service.objects.create(name="Luxury Hair Spa", category=self.cat)
        self.salon_service = SalonService.objects.create(
            salon=self.salon,
            service=self.master,
            price=Decimal("1200.00"),
            duration=45,
        )

        # 4. Booking
        self.booking = Booking.objects.create(
            salon=self.salon,
            customer=self.customer,
            client_name="Alice Smith",
            client_email="customer@test.com",
            client_phone="9876543210",
            service_name="Luxury Hair Spa",
            service_price=Decimal("1200.00"),
            subtotal=Decimal("1200.00"),
            total_amount=Decimal("1200.00"),
            booking_date=date(2026, 11, 10),
            booking_time="10:00 AM",
            start_time=time(10, 0),
            end_time=time(10, 45),
            duration="45 mins",
            payment_method=Booking.PaymentMethod.PAY_AT_SALON,
            status=Booking.Status.CONFIRMED,
            payment_status=Booking.PaymentStatus.PENDING,
        )

        self.client = APIClient()

    def test_cannot_generate_bill_for_incomplete_service(self):
        """Constraint 1: Do not generate a bill for pending, confirmed, or incomplete service."""
        self.client.force_authenticate(user=self.customer)
        response = self.client.get(f"/api/v1/bookings/{self.booking.id}/receipt/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertFalse(response.data.get("eligible"))
        self.assertFalse(ServiceReceipt.objects.filter(booking=self.booking).exists())

    def test_cannot_generate_bill_for_completed_service_with_unpaid_status(self):
        """Constraint 2: Do not generate a bill when service is COMPLETED but payment is still PENDING/FAILED."""
        self.booking.status = Booking.Status.COMPLETED
        self.booking.payment_status = Booking.PaymentStatus.PENDING
        self.booking.save()

        self.client.force_authenticate(user=self.customer)
        response = self.client.get(f"/api/v1/bookings/{self.booking.id}/receipt/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertFalse(ServiceReceipt.objects.filter(booking=self.booking).exists())

    def test_bill_generation_succeeds_when_completed_and_paid(self):
        """Constraint 3 & 4: Generates unique bill when completed and paid with accurate details."""
        self.booking.status = Booking.Status.COMPLETED
        self.booking.payment_status = Booking.PaymentStatus.PAID
        self.booking.is_fully_paid = True
        self.booking.save()

        self.client.force_authenticate(user=self.customer)
        response = self.client.get(f"/api/v1/bookings/{self.booking.id}/receipt/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        receipt_data = response.data["receipt"]

        # Check unique receipt number format
        self.assertTrue(receipt_data["receipt_number"].startswith("BMS-REC-"))
        self.assertIn(str(self.booking.id), receipt_data["receipt_number"])

        # Check details
        self.assertEqual(receipt_data["salon_details"]["name"], "Luxe Glamour Salon")
        self.assertEqual(receipt_data["customer_details"]["name"], "Alice Smith")
        self.assertEqual(receipt_data["customer_details"]["email"], "customer@test.com")
        self.assertEqual(receipt_data["pricing_details"]["total_amount"], "1200.00")
        self.assertEqual(receipt_data["pricing_details"]["amount_paid"], "1200.00")

    def test_one_bill_per_booking_idempotency(self):
        """Constraint 9: Subsequent requests return existing bill without duplicates."""
        self.booking.status = Booking.Status.COMPLETED
        self.booking.payment_status = Booking.PaymentStatus.PAID
        self.booking.is_fully_paid = True
        self.booking.save()

        self.client.force_authenticate(user=self.customer)
        resp1 = self.client.get(f"/api/v1/bookings/{self.booking.id}/receipt/")
        num1 = resp1.data["receipt"]["receipt_number"]

        resp2 = self.client.get(f"/api/v1/bookings/{self.booking.id}/receipt/")
        num2 = resp2.data["receipt"]["receipt_number"]

        self.assertEqual(num1, num2)
        self.assertEqual(ServiceReceipt.objects.filter(booking=self.booking).count(), 1)

    def test_security_unauthorized_customer_blocked(self):
        """Constraint 13: Another customer cannot access the bill."""
        self.booking.status = Booking.Status.COMPLETED
        self.booking.payment_status = Booking.PaymentStatus.PAID
        self.booking.is_fully_paid = True
        self.booking.save()

        self.client.force_authenticate(user=self.other_customer)
        response = self.client.get(f"/api/v1/bookings/{self.booking.id}/receipt/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_and_staff_cannot_access_customer_bill(self):
        """Constraint: Bill is only for the customer, salon owner and staff are blocked."""
        self.booking.status = Booking.Status.COMPLETED
        self.booking.payment_status = Booking.PaymentStatus.PAID
        self.booking.is_fully_paid = True
        self.booking.save()

        # Salon owner tries to access
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f"/api/v1/bookings/{self.booking.id}/receipt/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_pdf_generation_endpoint(self):
        """Constraint 10: PDF download endpoint streams valid PDF bytes."""
        self.booking.status = Booking.Status.COMPLETED
        self.booking.payment_status = Booking.PaymentStatus.PAID
        self.booking.is_fully_paid = True
        self.booking.save()

        self.client.force_authenticate(user=self.customer)
        response = self.client.get(f"/api/v1/bookings/{self.booking.id}/receipt/pdf/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_bill_preserved_after_subsequent_refund(self):
        """Constraint 12: A generated bill remains available if booking is later refunded."""
        self.booking.status = Booking.Status.COMPLETED
        self.booking.payment_status = Booking.PaymentStatus.PAID
        self.booking.is_fully_paid = True
        self.booking.save()

        receipt, _ = ServiceReceipt.get_or_create_for_booking(self.booking)

        # Later, booking is refunded
        self.booking.payment_status = Booking.PaymentStatus.REFUNDED
        self.booking.status = Booking.Status.CANCELLED
        self.booking.save()

        self.client.force_authenticate(user=self.customer)
        response = self.client.get(f"/api/v1/bookings/{self.booking.id}/receipt/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        audit = response.data["receipt"]["audit_details"]
        self.assertTrue(audit["is_refunded"])
        self.assertTrue(audit["is_cancelled"])
