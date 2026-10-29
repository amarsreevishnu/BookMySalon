from unittest.mock import patch, MagicMock
from rest_framework import status
from rest_framework.test import APISimpleTestCase, APIRequestFactory, force_authenticate


class CustomerSalonExploreTests(APISimpleTestCase):
    def setUp(self):
        self.explore_url = "/api/v1/salons/explore/"
        self.mock_user = MagicMock()
        self.mock_user.is_authenticated = True

    @patch("salons.views.Salon.objects.filter")
    def test_public_user_can_explore(self, mock_filter):
        mock_qs = MagicMock()
        mock_qs.order_by.return_value = []
        mock_filter.return_value = mock_qs
        response = self.client.get(self.explore_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("salons", response.data)
        self.assertIn("total_count", response.data)
        self.assertIn("total_pages", response.data)
        self.assertIn("current_page", response.data)
        self.assertIn("page_size", response.data)

    @patch("salons.views.Salon.objects.filter")
    def test_pagination_params(self, mock_filter):
        mock_qs = MagicMock()
        mock_qs.order_by.return_value = []
        mock_filter.return_value = mock_qs
        response = self.client.get(self.explore_url, {"page": 2, "page_size": 4})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["page_size"], 4)


class UploadMiddlewareAndMediaTests(APISimpleTestCase):
    def test_upload_limit_middleware_catches_request_data_too_big(self):
        from django.core.exceptions import RequestDataTooBig
        from salons.middleware import HandleDataUploadLimitMiddleware
        from django.test import RequestFactory

        rf = RequestFactory()
        request = rf.post("/api/v1/salons/create/")

        def raising_view(req):
            raise RequestDataTooBig("Request body exceeded settings.DATA_UPLOAD_MAX_MEMORY_SIZE")

        middleware = HandleDataUploadLimitMiddleware(raising_view)
        response = middleware(request)

        self.assertEqual(response.status_code, 413)
        import json
        data = json.loads(response.content.decode("utf-8"))
        self.assertIn("error", data)
        self.assertIn("too large", data["error"].lower())

    def test_save_image_to_media_base64(self):
        from salons.media_utils import save_image_to_media
        # 1x1 transparent PNG as base64
        sample_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        result_path = save_image_to_media(sample_b64, subfolder="salons/test")
        self.assertTrue(result_path.startswith("/media/salons/test/"))
        self.assertTrue(result_path.endswith(".png"))


class AdminSalonManagementTests(APISimpleTestCase):
    def setUp(self):
        self.mock_admin = MagicMock()
        self.mock_admin.is_authenticated = True
        self.mock_admin.role = "ADMIN"
        self.mock_admin.is_superuser = True
        self.mock_admin.is_staff = True

    @patch("salons.views.Salon.objects.all")
    def test_admin_can_list_salons(self, mock_all):
        mock_qs = MagicMock()
        mock_qs.order_by.return_value = []
        mock_all.return_value = mock_qs

        self.client.force_authenticate(user=self.mock_admin)
        response = self.client.get("/api/v1/salons/admin/salons/?status=all")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_admin_access_denied(self):
        response = self.client.get("/api/v1/salons/admin/salons/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("salons.views.SalonApprovalView.get_object")
    def test_admin_can_block_salon(self, mock_get_object):
        from salons.models import Salon
        from salons.views import SalonApprovalView

        mock_salon = MagicMock()
        mock_salon.id = 12
        mock_salon.name = "Prestige Salon"
        mock_salon.category = "Hair & Styling"
        mock_salon.email = "owner@prestige.com"
        mock_salon.phone = "9876543210"
        mock_salon.address = "123 Main St"
        mock_salon.city = "Bangalore"
        mock_salon.state = "Karnataka"
        mock_salon.pincode = "560001"
        mock_salon.latitude = None
        mock_salon.longitude = None
        mock_salon.opening_hours = {}
        mock_salon.amenities = []
        mock_salon.services = []
        mock_salon.cover_image = ""
        mock_salon.images = []
        mock_salon.admin_notes = ""
        mock_salon.owner = None
        mock_salon.created_at = None
        mock_salon.updated_at = None
        mock_salon.approval_status = Salon.ApprovalStatus.APPROVED
        mock_get_object.return_value = mock_salon

        factory = APIRequestFactory()
        request = factory.post(
            "/api/v1/salons/admin/12/decision/",
            {"approval_status": "BLOCKED", "admin_notes": "Temporary violation"},
            format="json",
        )
        force_authenticate(request, user=self.mock_admin)
        view = SalonApprovalView.as_view()
        response = view(request, pk=12)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(mock_salon.approval_status, Salon.ApprovalStatus.BLOCKED)
        self.assertEqual(mock_salon.admin_notes, "Temporary violation")
        mock_salon.save.assert_called()

    @patch("salons.views.SalonApprovalView.get_object")
    def test_admin_can_unblock_salon(self, mock_get_object):
        from salons.models import Salon
        from salons.views import SalonApprovalView

        mock_salon = MagicMock()
        mock_salon.id = 12
        mock_salon.name = "Prestige Salon"
        mock_salon.category = "Hair & Styling"
        mock_salon.email = "owner@prestige.com"
        mock_salon.phone = "9876543210"
        mock_salon.address = "123 Main St"
        mock_salon.city = "Bangalore"
        mock_salon.state = "Karnataka"
        mock_salon.pincode = "560001"
        mock_salon.latitude = None
        mock_salon.longitude = None
        mock_salon.opening_hours = {}
        mock_salon.amenities = []
        mock_salon.services = []
        mock_salon.cover_image = ""
        mock_salon.images = []
        mock_salon.admin_notes = ""
        mock_salon.owner = MagicMock(id=99)
        mock_salon.created_at = None
        mock_salon.updated_at = None
        mock_salon.approval_status = Salon.ApprovalStatus.BLOCKED
        mock_get_object.return_value = mock_salon

        factory = APIRequestFactory()
        request = factory.post(
            "/api/v1/salons/admin/12/decision/",
            {"approval_status": "APPROVED"},
            format="json",
        )
        force_authenticate(request, user=self.mock_admin)
        view = SalonApprovalView.as_view()
        with patch("salons.views.send_salon_approval_email"):
            response = view(request, pk=12)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(mock_salon.approval_status, Salon.ApprovalStatus.APPROVED)
        mock_salon.save.assert_called()

    @patch("salons.views.Salon.objects")
    @patch("salons.views.User.objects")
    def test_admin_stats_includes_blocked_salons(self, mock_user_objects, mock_salon_objects):
        from salons.views import AdminDashboardStatsView

        mock_user_objects.count.return_value = 10
        mock_salon_objects.count.return_value = 5
        mock_qs = MagicMock()
        mock_qs.count.side_effect = [2, 1, 1, 1]  # pending, approved, rejected, blocked
        mock_salon_objects.filter.return_value = mock_qs

        factory = APIRequestFactory()
        request = factory.get("/api/v1/salons/admin/stats/")
        force_authenticate(request, user=self.mock_admin)
        view = AdminDashboardStatsView.as_view()
        response = view(request)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("blocked_salons", response.data)
        self.assertEqual(response.data["blocked_salons"], 1)


class SalonEmailAndResubmitTests(APISimpleTestCase):
    @patch("salons.email_utils.send_mail")
    def test_approval_email_opens_login_in_next_tab(self, mock_send_mail):
        from salons.email_utils import send_salon_approval_email

        mock_salon = MagicMock()
        mock_salon.id = 42
        mock_salon.name = "Royal Glam Studio"
        mock_salon.email = "owner@royalglam.com"

        success = send_salon_approval_email(mock_salon, "TempPass@123")
        self.assertTrue(success)
        mock_send_mail.assert_called_once()

        kwargs = mock_send_mail.call_args.kwargs
        html = kwargs.get("html_message", "")
        self.assertIn('target="_blank"', html)
        self.assertIn("rel=\"noopener noreferrer\"", html)
        self.assertIn("TempPass@123", html)

    @patch("salons.email_utils.send_mail")
    def test_rejection_email_contains_prefilled_resubmit_link_in_next_tab(self, mock_send_mail):
        from salons.email_utils import send_salon_rejection_email, verify_salon_resubmit_token

        mock_salon = MagicMock()
        mock_salon.id = 88
        mock_salon.name = "Aura Spa & Salon"
        mock_salon.email = "applicant@auraspa.com"

        reason = "Please provide higher resolution salon photos and updated phone number."
        success = send_salon_rejection_email(mock_salon, reason=reason)
        self.assertTrue(success)
        mock_send_mail.assert_called_once()

        kwargs = mock_send_mail.call_args.kwargs
        html = kwargs.get("html_message", "")
        plain = kwargs.get("message", "")

        # Must open in new tab
        self.assertIn('target="_blank"', html)
        self.assertIn("rel=\"noopener noreferrer\"", html)

        # Must include the resubmission URL with salon id and token
        self.assertIn("salon-application?resubmit=88&token=", html)
        self.assertIn("salon-application?resubmit=88&token=", plain)
        self.assertIn(reason, html)

    def test_token_generation_and_verification(self):
        from salons.email_utils import generate_salon_resubmit_token, verify_salon_resubmit_token

        mock_salon = MagicMock()
        mock_salon.id = 99

        token = generate_salon_resubmit_token(mock_salon)
        self.assertTrue(verify_salon_resubmit_token(99, token))
        self.assertFalse(verify_salon_resubmit_token(100, token))
        self.assertFalse(verify_salon_resubmit_token(99, "invalid-tampered-token"))

    @patch("salons.views.Salon.objects.get")
    def test_resubmit_link_expires_when_not_rejected(self, mock_get):
        from salons.models import Salon

        mock_salon = MagicMock()
        mock_salon.id = 55
        mock_salon.name = "Indiranagar Salon"
        mock_salon.approval_status = Salon.ApprovalStatus.PENDING  # Already resubmitted
        mock_get.return_value = mock_salon

        # Trying to load resubmit-data on an already resubmitted salon returns 410 GONE
        response = self.client.get("/api/v1/salons/55/resubmit-data/?token=test-token")
        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response.data.get("status_code"), "ALREADY_SUBMITTED")
        self.assertIn("already been resubmitted", response.data.get("error"))

        # Trying to POST resubmit on an already resubmitted salon returns 400 BAD REQUEST
        post_res = self.client.post("/api/v1/salons/55/resubmit/?token=test-token", {"name": "Test"})
        self.assertEqual(post_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(post_res.data.get("status_code"), "NOT_REJECTED")


class SalonEmailVerificationTests(APISimpleTestCase):
    @patch("salons.serializers.Salon.objects.filter")
    @patch("salons.views.send_salon_email_otp")
    @patch("salons.views.SalonEmailOTP.objects.get_or_create")
    def test_send_email_otp_success(self, mock_get_or_create, mock_send_email, mock_salon_filter):
        mock_salon_qs = MagicMock()
        mock_salon_qs.exists.return_value = False
        mock_salon_filter.return_value = mock_salon_qs

        mock_record = MagicMock()
        mock_get_or_create.return_value = (mock_record, True)
        mock_send_email.return_value = True


        response = self.client.post(
            "/api/v1/salons/verify-email/send-otp/",
            {"email": "partner@luxesalon.com"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("verification code has been sent", response.data["message"])
        mock_send_email.assert_called_once()

    @patch("salons.views.SalonEmailOTP.objects.filter")
    def test_verify_email_otp_invalid_code(self, mock_filter):
        mock_record = MagicMock()
        mock_record.otp = "123456"
        mock_record.attempts = 0
        mock_record.is_otp_expired.return_value = False
        mock_qs = MagicMock()
        mock_qs.first.return_value = mock_record
        mock_filter.return_value = mock_qs

        response = self.client.post(
            "/api/v1/salons/verify-email/verify-otp/",
            {"email": "partner@luxesalon.com", "otp": "999999"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid verification code", response.data["error"])

    @patch("salons.views.SalonEmailOTP.objects.filter")
    def test_verify_email_otp_correct_code(self, mock_filter):
        mock_record = MagicMock()
        mock_record.otp = "123456"
        mock_record.attempts = 0
        mock_record.is_otp_expired.return_value = False
        mock_qs = MagicMock()
        mock_qs.first.return_value = mock_record
        mock_filter.return_value = mock_qs

        response = self.client.post(
            "/api/v1/salons/verify-email/verify-otp/",
            {"email": "partner@luxesalon.com", "otp": "123456"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_verified"])

    @patch("salons.views.SalonEmailOTP.objects.filter")
    def test_create_salon_blocks_unverified_email(self, mock_filter):
        mock_qs = MagicMock()
        mock_qs.first.return_value = None  # No verified record
        mock_filter.return_value = mock_qs

        salon_payload = {
            "name": "Emerald Spa",
            "email": "unverified@test.com",
            "phone": "+91 9876543210",
            "address": "123 MG Road",
            "city": "Bengaluru",
        }
        response = self.client.post("/api/v1/salons/create/", salon_payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertIn("must be verified", str(response.data["email"]))


from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime, date, time, timedelta
from salons.models import Salon, WorkerProfile
from bookings.models import Booking
from services.models import ServiceCategory, Service, SalonService
from rest_framework.test import APIClient

User = get_user_model()


class WorkerAppointmentManagementTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="salon_owner@test.com",
            password="Password123!",
            first_name="Vikram",
            role="OWNER",
        )
        self.salon = Salon.objects.create(
            owner=self.owner,
            name="Crown Luxe Salon",
            city="Bengaluru",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )

        self.worker1_user = User.objects.create_user(
            email="stylist_arjun@test.com",
            password="Password123!",
            first_name="Arjun",
            role="WORKER",
        )
        self.worker1 = WorkerProfile.objects.create(
            user=self.worker1_user,
            salon=self.salon,
            specialization="Master Hair Stylist",
            station="Chair #01",
            commission_rate=60.00,
            is_active=True,
        )

        self.worker2_user = User.objects.create_user(
            email="stylist_priya@test.com",
            password="Password123!",
            first_name="Priya",
            role="WORKER",
        )
        self.worker2 = WorkerProfile.objects.create(
            user=self.worker2_user,
            salon=self.salon,
            specialization="Colorist",
            station="Chair #02",
            commission_rate=50.00,
            is_active=True,
        )

        self.customer = User.objects.create_user(
            email="client@test.com",
            password="Password123!",
            first_name="Sneha",
            role="CUSTOMER",
        )

        self.client = APIClient()

    def test_automatic_no_show_rule_when_customer_not_came_on_time(self):
        """
        Main rule: if the customer time is 9 am but the customer did not arrive on time,
        the backend automatically marks the booking as NO_SHOW.
        """
        past_9am_booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker1,
            customer=self.customer,
            client_name="Sneha Kapoor",
            client_phone="+919876543210",
            service_name="Signature Haircut",
            service_price=500.00,
            total_amount=500.00,
            booking_date=timezone.localdate(),
            start_time=time(9, 0),
            booking_time="09:00",
            status=Booking.Status.CONFIRMED,
        )

        # Worker calls the appointments list endpoint when current time is after 9:00 AM
        self.client.force_authenticate(user=self.worker1_user)
        after_9am = timezone.make_aware(datetime.combine(timezone.localdate(), time(10, 0)))
        with patch("bookings.services.timezone.now", return_value=after_9am):
            response = self.client.get("/api/v1/salons/worker/appointments/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify backend automatically updated status to NO_SHOW in database
        past_9am_booking.refresh_from_db()
        self.assertEqual(past_9am_booking.status, Booking.Status.NO_SHOW)

        # Verify returned data shows NO_SHOW with view-only action
        results = response.data["results"]
        matching = [r for r in results if r["id"] == past_9am_booking.id]
        self.assertEqual(len(matching), 1)
        self.assertEqual(matching[0]["status"], "NO_SHOW")
        self.assertEqual(matching[0]["available_actions"], ["view"])

    def test_worker_isolation_only_sees_assigned_appointments(self):
        """
        Workers should only see appointments assigned to them, not other workers'.
        """
        tomorrow = timezone.localdate() + timedelta(days=1)
        b1 = Booking.objects.create(
            salon=self.salon,
            worker=self.worker1,
            client_name="Client For Arjun",
            service_name="Haircut",
            service_price=500.00,
            booking_date=tomorrow,
            booking_time="10:00",
            start_time=time(10, 0),
            status=Booking.Status.CONFIRMED,
        )
        b2 = Booking.objects.create(
            salon=self.salon,
            worker=self.worker2,
            client_name="Client For Priya",
            service_name="Balayage Color",
            service_price=2500.00,
            booking_date=tomorrow,
            booking_time="14:00",
            start_time=time(14, 0),
            status=Booking.Status.CONFIRMED,
        )

        # Worker 1 logs in
        self.client.force_authenticate(user=self.worker1_user)
        res1 = self.client.get("/api/v1/salons/worker/appointments/")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        worker1_booking_ids = [item["id"] for item in res1.data["results"]]
        self.assertIn(b1.id, worker1_booking_ids)
        self.assertNotIn(b2.id, worker1_booking_ids)

        # Worker 2 logs in
        self.client.force_authenticate(user=self.worker2_user)
        res2 = self.client.get("/api/v1/salons/worker/appointments/")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        worker2_booking_ids = [item["id"] for item in res2.data["results"]]
        self.assertIn(b2.id, worker2_booking_ids)
        self.assertNotIn(b1.id, worker2_booking_ids)

    def test_dynamic_actions_and_service_progress_updates(self):
        """
        Dynamic Actions:
        - Confirmed: View, Start Service
        - In Progress: View, Complete Service
        - Completed: View
        """
        tomorrow = timezone.localdate() + timedelta(days=1)
        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker1,
            client_name="Dynamic Action Client",
            service_name="Beard Grooming & Hair Spa",
            service_price=800.00,
            total_amount=800.00,
            booking_date=tomorrow,
            booking_time="11:30",
            start_time=time(11, 30),
            duration="45 mins",
            status=Booking.Status.CONFIRMED,
        )

        self.client.force_authenticate(user=self.worker1_user)

        # 1. Confirmed status -> actions: View, Start Service
        res_list = self.client.get(f"/api/v1/salons/worker/appointments/?search={booking.id}")
        appt = res_list.data["results"][0]
        self.assertEqual(appt["booking_id_display"], f"#BK{booking.id}")
        self.assertEqual(appt["status"], "CONFIRMED")
        self.assertEqual(appt["available_actions"], ["view", "start"])

        # 2. Worker starts service -> status becomes IN_PROGRESS
        res_start = self.client.patch(
            f"/api/v1/salons/worker/bookings/{booking.id}/status/",
            {"status": "IN_PROGRESS"},
            format="json",
        )
        self.assertEqual(res_start.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.IN_PROGRESS)
        self.assertEqual(res_start.data["booking"]["available_actions"], ["view", "complete"])

        # 3. Worker completes service -> status becomes COMPLETED
        res_complete = self.client.patch(
            f"/api/v1/salons/worker/bookings/{booking.id}/status/",
            {"status": "COMPLETED"},
            format="json",
        )
        self.assertEqual(res_complete.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.COMPLETED)
        self.assertEqual(res_complete.data["booking"]["available_actions"], ["view"])

    def test_worker_cannot_bypass_permissions_to_refund(self):
        """
        Workers can update service progress, but refunds and direct payment overrides
        remain strictly under owner/admin permissions.
        """
        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker1,
            client_name="Refund Test Client",
            service_name="Styling",
            service_price=400.00,
            booking_date=timezone.localdate() + timedelta(days=2),
            booking_time="12:00",
            start_time=time(12, 0),
            status=Booking.Status.CONFIRMED,
            payment_status=Booking.PaymentStatus.PAID,
        )

        self.client.force_authenticate(user=self.worker1_user)
        # Attempt to set payment_status to REFUNDED as worker
        res = self.client.patch(
            f"/api/v1/salons/worker/bookings/{booking.id}/status/",
            {"status": "IN_PROGRESS", "payment_status": "REFUNDED"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        # Status became IN_PROGRESS, but payment_status was NOT modified to REFUNDED!
        self.assertEqual(booking.status, Booking.Status.IN_PROGRESS)
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.PAID)




