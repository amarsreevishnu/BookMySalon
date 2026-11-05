from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from salons.models import Salon, WorkerProfile
from services.models import ServiceCategory, Service, SalonService
from bookings.models import Booking


class AdminBookingsManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin User
        self.admin = User.objects.create_user(
            email="superadmin@bookmysalon.com",
            password="adminpassword123",
            role="ADMIN",
            is_staff=True,
            is_superuser=True,
        )

        # Salon Owner
        self.owner = User.objects.create_user(
            email="owner@royalcuts.com",
            password="ownerpassword123",
            role="OWNER",
        )

        # Regular Customer
        self.customer = User.objects.create_user(
            email="customer@gmail.com",
            password="customerpassword123",
            role="CUSTOMER",
        )

        # Salons
        self.salon1 = Salon.objects.create(
            owner=self.owner,
            name="Royal Cuts",
            city="Kochi",
            phone="9876543210",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )
        self.salon2 = Salon.objects.create(
            name="Botanical Aura Spa",
            city="Calicut",
            phone="9876543211",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )

        # Services
        self.category = ServiceCategory.objects.create(name="Hair Styling")
        self.service = Service.objects.create(
            category=self.category,
            name="Haircut",
            standard_price=300,
        )
        self.salon_service = SalonService.objects.create(
            salon=self.salon1,
            service=self.service,
            price=Decimal("300.00"),
            duration=30,
        )

        # Create Bookings for Salon 1
        today = timezone.localdate()
        self.b1 = Booking.objects.create(
            salon=self.salon1,
            customer=self.customer,
            service=self.salon_service,
            client_name="Arun",
            client_email="customer@gmail.com",
            client_phone="9876543210",
            service_name="Haircut",
            service_price=Decimal("300.00"),
            total_amount=Decimal("300.00"),
            booking_date=today,
            booking_time="10:00 AM",
            status=Booking.Status.COMPLETED,
            payment_status=Booking.PaymentStatus.PAID,
            payment_method=Booking.PaymentMethod.ONLINE,
        )

        self.b2 = Booking.objects.create(
            salon=self.salon1,
            customer=self.customer,
            service=self.salon_service,
            client_name="Rahul",
            client_email="rahul@gmail.com",
            client_phone="9876543212",
            service_name="Facial",
            service_price=Decimal("800.00"),
            total_amount=Decimal("800.00"),
            booking_date=today + timedelta(days=1),
            booking_time="11:30 AM",
            status=Booking.Status.CONFIRMED,
            payment_status=Booking.PaymentStatus.PENDING,
            payment_method=Booking.PaymentMethod.PAY_AT_SALON,
        )

        self.b3 = Booking.objects.create(
            salon=self.salon1,
            customer=self.customer,
            service=self.salon_service,
            client_name="Anu",
            client_email="anu@gmail.com",
            client_phone="9876543213",
            service_name="Hair Spa",
            service_price=Decimal("600.00"),
            total_amount=Decimal("600.00"),
            booking_date=today + timedelta(days=2),
            booking_time="02:00 PM",
            status=Booking.Status.CANCELLED,
            payment_status=Booking.PaymentStatus.REFUNDED,
            payment_method=Booking.PaymentMethod.ONLINE,
            notes="Customer had emergency",
        )

    def test_admin_permissions_enforced(self):
        # 1. Unauthenticated gets 401
        res = self.client.get("/api/v1/bookings/admin/stats/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Customer gets 403
        self.client.force_authenticate(user=self.customer)
        res = self.client.get("/api/v1/bookings/admin/stats/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Owner gets 403
        self.client.force_authenticate(user=self.owner)
        res = self.client.get("/api/v1/bookings/admin/stats/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # 4. Super Admin gets 200
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/v1/bookings/admin/stats/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_bookings"], 3)
        self.assertEqual(res.data["completed_bookings"], 1)
        self.assertEqual(res.data["confirmed_bookings"], 1)
        self.assertEqual(res.data["cancelled_bookings"], 1)

    def test_salons_summary_breakdown(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/v1/bookings/admin/salons-summary/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        summaries = res.data
        self.assertTrue(len(summaries) >= 2)

        royal_cuts = next((s for s in summaries if s["id"] == self.salon1.id), None)
        self.assertIsNotNone(royal_cuts)
        self.assertEqual(royal_cuts["name"], "Royal Cuts")
        self.assertEqual(royal_cuts["total_bookings"], 3)
        self.assertEqual(royal_cuts["completed_bookings"], 1)
        self.assertEqual(royal_cuts["confirmed_bookings"], 1)
        self.assertEqual(royal_cuts["cancelled_bookings"], 1)

        botanical_spa = next((s for s in summaries if s["id"] == self.salon2.id), None)
        self.assertIsNotNone(botanical_spa)
        self.assertEqual(botanical_spa["total_bookings"], 0)

    def test_bookings_list_filtering(self):
        self.client.force_authenticate(user=self.admin)

        # 1. All bookings
        res = self.client.get("/api/v1/bookings/admin/bookings/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 3)

        # 2. Filter by salon
        res_salon = self.client.get(f"/api/v1/bookings/admin/bookings/?salon_id={self.salon1.id}")
        self.assertEqual(res_salon.status_code, status.HTTP_200_OK)
        self.assertEqual(res_salon.data["count"], 3)
        self.assertEqual(res_salon.data["selected_salon"]["name"], "Royal Cuts")

        # 3. Filter by status: COMPLETED
        res_completed = self.client.get("/api/v1/bookings/admin/bookings/?status=COMPLETED")
        self.assertEqual(res_completed.status_code, status.HTTP_200_OK)
        self.assertEqual(res_completed.data["count"], 1)
        self.assertEqual(res_completed.data["results"][0]["client_name"], "Arun")

        # 4. Search by client name
        res_search = self.client.get("/api/v1/bookings/admin/bookings/?search=Rahul")
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        self.assertEqual(res_search.data["count"], 1)
        self.assertEqual(res_search.data["results"][0]["client_name"], "Rahul")

    def test_booking_detail_and_read_only(self):
        self.client.force_authenticate(user=self.admin)

        # 1. Detail inspection
        res = self.client.get(f"/api/v1/bookings/admin/bookings/{self.b1.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["id"], self.b1.id)
        self.assertEqual(res.data["formatted_booking_id"], f"BK{self.b1.id:04d}")
        self.assertEqual(res.data["client_name"], "Arun")
        self.assertEqual(res.data["salon_name"], "Royal Cuts")

        # 2. Cancelled booking cancellation details
        res_cancel = self.client.get(f"/api/v1/bookings/admin/bookings/{self.b3.id}/")
        self.assertEqual(res_cancel.status_code, status.HTTP_200_OK)
        self.assertTrue(res_cancel.data["cancellation_details"]["is_cancelled"])
        self.assertEqual(res_cancel.data["cancellation_details"]["reason"], "Customer had emergency")
        self.assertTrue(res_cancel.data["refund_details"]["is_refunded"])

        # 3. Read-only verification: POST/PUT/PATCH/DELETE should be 405 Method Not Allowed
        post_res = self.client.post("/api/v1/bookings/admin/bookings/", {"some": "data"})
        self.assertEqual(post_res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        put_res = self.client.put(f"/api/v1/bookings/admin/bookings/{self.b1.id}/", {"status": "CANCELLED"})
        self.assertEqual(put_res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

