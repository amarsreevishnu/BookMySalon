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

    @patch("salons.views.SalonReview.objects.filter")
    @patch("salons.views.Salon.objects.filter")
    def test_salon_explore_card_dynamic_data(self, mock_salon_filter, mock_review_filter):
        mock_salon = MagicMock()
        mock_salon.id = 101
        mock_salon.name = "Aura Botanic Salon"
        mock_salon.tagline = "Nature's touch"
        mock_salon.category = "Hair & Styling"
        mock_salon.secondary_category = ""
        mock_salon.description = "Certified organic salon"
        mock_salon.established_year = "2021"
        mock_salon.landmark = "Near metro"
        mock_salon.address = "123 Green Way"
        mock_salon.city = "Kochi"
        mock_salon.state = "Kerala"
        mock_salon.phone = "9876543210"
        mock_salon.amenities = ["AC", "WiFi"]
        mock_salon.services = [{"name": "Hair Cut", "price": "₹450"}]
        mock_salon.opening_hours = {}
        mock_salon.cover_image = ""
        mock_salon.images = []

        mock_qs = MagicMock()
        mock_qs.select_related.return_value.order_by.return_value = [mock_salon]
        mock_salon_filter.return_value = mock_qs

        # Mock review aggregations
        mock_rev_qs = MagicMock()
        mock_rev_qs.aggregate.return_value = {"avg": 4.8}
        mock_rev_qs.count.return_value = 5

        # Mock latest review
        mock_latest_rev = MagicMock()
        mock_latest_rev.rating = 5
        mock_latest_rev.comment = "Super experience and wonderful stylist!"
        mock_latest_rev.customer.get_full_name.return_value = "Priya M"
        mock_latest_rev.created_at.strftime.return_value = "Nov 2026"
        mock_rev_qs.select_related.return_value.order_by.return_value.first.return_value = mock_latest_rev

        mock_review_filter.return_value = mock_rev_qs

        response = self.client.get(self.explore_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        salons = response.data.get("salons", [])
        self.assertEqual(len(salons), 1)
        s = salons[0]
        self.assertEqual(s["name"], "Aura Botanic Salon")
        self.assertEqual(s["rating"], 4.8)
        self.assertEqual(s["review_count"], 5)
        self.assertEqual(s["badge"], "★ Top Rated")
        self.assertEqual(s["badge_type"], "top-rated")
        self.assertIsNotNone(s["latest_review"])
        self.assertEqual(s["latest_review"]["customer_name"], "Priya M")
        self.assertEqual(s["starting_price"], 450)


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

    @patch("cloudinary.uploader.upload")
    def test_save_image_to_media_cloudinary_enabled(self, mock_upload):
        from salons.media_utils import save_image_to_media
        from django.conf import settings
        mock_upload.return_value = {
            "secure_url": "https://res.cloudinary.com/testcloud/image/upload/v12345/salons/test/img_123.jpg"
        }
        with self.settings(USE_CLOUDINARY=True, CLOUDINARY_CLOUD_NAME="testcloud"):
            sample_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            result = save_image_to_media(sample_b64, subfolder="salons/test")
            self.assertEqual(result, "https://res.cloudinary.com/testcloud/image/upload/v12345/salons/test/img_123.jpg")
            mock_upload.assert_called_once()

    @patch("cloudinary.uploader.upload")
    def test_save_document_to_media_cloudinary_enabled(self, mock_upload):
        from salons.media_utils import save_document_to_media
        from django.conf import settings
        mock_upload.return_value = {
            "secure_url": "https://res.cloudinary.com/testcloud/image/upload/v12345/salons/documents/doc_123.pdf"
        }
        with self.settings(USE_CLOUDINARY=True, CLOUDINARY_CLOUD_NAME="testcloud"):
            tiny_pdf = "data:application/pdf;base64,JVBERi0xLjAKMSAwIG9iajw8L1BhZ2VzIDIgMCBSPj5lbmRvYmoKMiAwIG9iajw8L0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvTWVkaWFCb3hbMCAwIDMgM10+PmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYKMDAwMDAwMDAwOSAwMDAwMCBuCjAwMDAwMDAwNTYgMDAwMDAgbgowMDAwMDAwMTExIDAwMDAwIG4KdHJhaWxlcjw8L1Jvb3QgMSAwIFIvU2l6ZSA0Pj4Kc3RhcnR4cmVmCjE2NAolJUVPRgo="
            result = save_document_to_media(tiny_pdf, subfolder="salons/documents")
            self.assertEqual(result, "https://res.cloudinary.com/testcloud/image/upload/v12345/salons/documents/doc_123.pdf")
            mock_upload.assert_called_once()


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
    databases = {"default"}
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

    @patch("salons.views.SalonEmailOTP.objects.filter")
    def test_create_salon_blocks_missing_required_documents(self, mock_filter):
        mock_record = MagicMock()
        mock_record.is_verification_valid.return_value = True
        mock_qs = MagicMock()
        mock_qs.first.return_value = mock_record
        mock_filter.return_value = mock_qs

        salon_payload = {
            "name": "Emerald Spa",
            "email": "verified@test.com",
            "phone": "+91 9876543210",
            "address": "123 MG Road",
            "city": "Bengaluru",
        }
        response = self.client.post("/api/v1/salons/create/", salon_payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("registration_certificate", response.data)
        self.assertIn("owner_id_proof", response.data)
        self.assertIn("owner_profile_photo", response.data)

    @patch("salons.views.SalonEmailOTP.objects.filter")
    def test_create_salon_blocks_unsupported_document_format(self, mock_filter):
        mock_record = MagicMock()
        mock_record.is_verification_valid.return_value = True
        mock_qs = MagicMock()
        mock_qs.first.return_value = mock_record
        mock_filter.return_value = mock_qs

        salon_payload = {
            "name": "Emerald Spa",
            "email": "verified@test.com",
            "phone": "+91 9876543210",
            "address": "123 MG Road",
            "city": "Bengaluru",
            "registration_certificate": "data:text/plain;base64,aGVsbG8=",
            "owner_id_proof": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
            "owner_profile_photo": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        }
        response = self.client.post("/api/v1/salons/create/", salon_payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("salons.views.SalonEmailOTP.objects.filter")
    def test_create_salon_success_with_valid_documents(self, mock_filter):
        mock_record = MagicMock()
        mock_record.is_verification_valid.return_value = True
        mock_qs = MagicMock()
        mock_qs.first.return_value = mock_record
        mock_filter.return_value = mock_qs

        # Minimal 1x1 PNG and tiny PDF payload
        tiny_png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        tiny_pdf = "data:application/pdf;base64,JVBERi0xLjEKJcKlwrHDqwoKMSAwIG9iagogIDw8IC9UeXBlIC9DYXRhbG9nCiAgICAgL1BhZ2VzIDIgMCBSCiAgPj4KZW5kb2JqCg=="

        salon_payload = {
            "name": "Emerald Spa",
            "email": "verified@test.com",
            "phone": "+91 9876543210",
            "address": "123 MG Road",
            "city": "Bengaluru",
            "registration_certificate": tiny_pdf,
            "gst_certificate": tiny_pdf,
            "owner_id_proof": tiny_png,
            "owner_profile_photo": tiny_png,
        }
        response = self.client.post("/api/v1/salons/create/", salon_payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        salon_data = response.data["salon"]
        self.assertTrue(salon_data["registration_certificate"])
        self.assertTrue(salon_data["gst_certificate"])
        self.assertTrue(salon_data["owner_id_proof"])
        self.assertTrue(salon_data["owner_profile_photo"])


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

    def test_salon_owner_worker_creation(self):
        """
        Tests that a salon owner can successfully create a worker account,
        receive credentials and serialized worker profile with subscription_status.
        """
        self.client.force_authenticate(user=self.owner)
        payload = {
            "full_name": "New Specialist Worker",
            "email": "newspecialist@salon.com",
            "phone_number": "+91 9123456789",
            "specialization": "Master Colorist",
            "experience": "5 Years",
            "station": "Chair #03",
            "employment_status": "Full-Time Specialist",
            "bio": "Experienced colorist and stylist.",
            "specializations": ["Hair Coloring", "Balayage"],
            "assigned_services": [],
            "shift_hours": {"time_in": "09:00", "time_out": "19:00", "weekly_off": "Tuesday"},
        }
        res = self.client.post("/api/v1/salons/owner/workers/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn("worker", res.data)
        self.assertEqual(res.data["worker"]["email"], "newspecialist@salon.com")
        self.assertIn("subscription_status", res.data["worker"])
        self.assertIn("is_subscription_active", res.data["worker"])
        self.assertIn("credentials", res.data)
        self.assertEqual(res.data["credentials"]["email"], "newspecialist@salon.com")

        # Verify listing works
        list_res = self.client.get("/api/v1/salons/owner/workers/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        worker_emails = [w["email"] for w in list_res.data["workers"]]
        self.assertIn("newspecialist@salon.com", worker_emails)

    def test_salon_owner_booking_actions_start_complete_and_cancel(self):
        """
        Verify that Salon Owner can start, complete, and cancel bookings for any worker,
        and that payment status and method are correctly maintained and serialized.
        """
        self.client.force_authenticate(user=self.owner)

        # 1. Create a booking assigned to worker1
        booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker1,
            customer=self.customer,
            client_name="Kavya Sharma",
            client_phone="+919876500000",
            service_name="Balayage & Styling",
            service_price=1200.00,
            total_amount=1200.00,
            advance_amount=200.00,
            remaining_amount=1000.00,
            is_advance_paid=True,
            payment_method=Booking.PaymentMethod.WALLET,
            payment_status=Booking.PaymentStatus.PARTIALLY_PAID,
            booking_date=timezone.localdate(),
            booking_time="14:00",
            start_time=time(14, 0),
            status=Booking.Status.CONFIRMED,
        )

        # 2. Salon owner starts the appointment
        start_res = self.client.patch(
            f"/api/v1/salons/owner/bookings/{booking.id}/status/",
            {"status": "IN_PROGRESS"},
            format="json",
        )
        self.assertEqual(start_res.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.IN_PROGRESS)
        self.assertIsNotNone(booking.service_started_at)

        # 3. Salon owner completes the appointment
        complete_res = self.client.patch(
            f"/api/v1/salons/owner/bookings/{booking.id}/status/",
            {"status": "COMPLETED"},
            format="json",
        )
        self.assertEqual(complete_res.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.COMPLETED)

        # 4. Create another booking for worker2 and test cancellation by owner
        booking2 = Booking.objects.create(
            salon=self.salon,
            worker=self.worker2,
            customer=self.customer,
            client_name="Rohan Verma",
            client_phone="+919876511111",
            service_name="Beard Grooming",
            service_price=400.00,
            total_amount=400.00,
            payment_method=Booking.PaymentMethod.PAY_AT_SALON,
            payment_status=Booking.PaymentStatus.PENDING,
            booking_date=timezone.localdate(),
            booking_time="16:00",
            start_time=time(16, 0),
            status=Booking.Status.CONFIRMED,
        )

        cancel_res = self.client.patch(
            f"/api/v1/salons/owner/bookings/{booking2.id}/status/",
            {"status": "CANCELLED", "reason": "Client requested reschedule"},
            format="json",
        )
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)
        booking2.refresh_from_db()
        self.assertEqual(booking2.status, Booking.Status.CANCELLED)

        # 5. Verify serialization in Owner Bookings API
        owner_bookings_res = self.client.get("/api/v1/salons/owner/bookings/")
        self.assertEqual(owner_bookings_res.status_code, status.HTTP_200_OK)
        b_ids = [b["id"] for b in owner_bookings_res.data["bookings"]]
        self.assertIn(booking.id, b_ids)
        self.assertIn(booking2.id, b_ids)

        found_b1 = next(b for b in owner_bookings_res.data["bookings"] if b["id"] == booking.id)
        self.assertEqual(found_b1["payment_method"], "WALLET")
        self.assertEqual(found_b1["status"], "COMPLETED")

    def test_owner_bookings_backend_pagination(self):
        """
        Tests backend pagination on /api/v1/salons/owner/bookings/:
        - creates 15 bookings
        - fetches page 1 with page_size=5 -> returns 5 bookings, total_count=15, total_pages=3
        - fetches page 2 with page_size=5 -> returns next 5 bookings
        - verifies filter and search with pagination
        """
        self.client.force_authenticate(user=self.owner)
        today = timezone.localdate()

        # Create 15 bookings
        created_bookings = []
        for i in range(15):
            b = Booking.objects.create(
                salon=self.salon,
                worker=self.worker1 if i % 2 == 0 else self.worker2,
                customer=self.customer,
                client_name=f"Client {i+1:02d}",
                client_phone=f"+9198765{i:05d}",
                service_name="Hair Styling" if i < 10 else "Nail Art",
                service_price=500.00,
                total_amount=500.00,
                payment_method=Booking.PaymentMethod.PAY_AT_SALON if i % 3 == 0 else Booking.PaymentMethod.WALLET,
                status=Booking.Status.CONFIRMED if i % 2 == 0 else Booking.Status.PENDING,
                booking_date=today + timedelta(days=i),
                booking_time="10:00",
                start_time=time(10, 0),
            )
            created_bookings.append(b)

        # 1. Page 1, page_size=5
        res = self.client.get("/api/v1/salons/owner/bookings/", {"page": 1, "page_size": 5})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["total_count"], 15)
        self.assertEqual(res.data["total_pages"], 3)
        self.assertEqual(res.data["current_page"], 1)
        self.assertEqual(res.data["page_size"], 5)
        self.assertEqual(len(res.data["bookings"]), 5)
        self.assertIn("stats", res.data)
        self.assertEqual(res.data["stats"]["total"], 15)

        # 2. Page 2, page_size=5
        res2 = self.client.get("/api/v1/salons/owner/bookings/", {"page": 2, "page_size": 5})
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data["current_page"], 2)
        self.assertEqual(len(res2.data["bookings"]), 5)

        # Disjoint sets between page 1 and page 2
        p1_ids = {b["id"] for b in res.data["bookings"]}
        p2_ids = {b["id"] for b in res2.data["bookings"]}
        self.assertEqual(len(p1_ids.intersection(p2_ids)), 0)

        # 3. Status filter with pagination
        res_pending = self.client.get("/api/v1/salons/owner/bookings/", {"status": "PENDING", "page_size": 10})
        self.assertEqual(res_pending.status_code, status.HTTP_200_OK)
        for b in res_pending.data["bookings"]:
            self.assertEqual(b["raw_status"], "PENDING")

        # 4. Search query with pagination
        res_search = self.client.get("/api/v1/salons/owner/bookings/", {"search": "Client 05"})
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        self.assertEqual(res_search.data["total_count"], 1)
        self.assertEqual(res_search.data["bookings"][0]["client_name"], "Client 05")


class SalonBlockAutomatedProcessTests(TestCase):
    def setUp(self):
        from decimal import Decimal
        from datetime import date, time, timedelta
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient

        from salons.models import Salon, WorkerProfile
        from services.models import ServiceCategory, Service, SalonService
        from bookings.models import Booking, BookingHistory
        from payments.models import Payment, OwnerWallet, OwnerWalletTransaction, Refund
        from wallet.models import CustomerWallet

        User = get_user_model()

        self.client = APIClient()

        # Admin
        self.admin = User.objects.create_superuser(
            email="superadmin@bookmysalon.com",
            password="AdminPassword123!",
            first_name="Super",
            last_name="Admin",
            role="ADMIN",
        )

        # Owner
        self.owner = User.objects.create_user(
            email="salonowner@test.com",
            password="OwnerPassword123!",
            first_name="Sanjay",
            last_name="Kumar",
            role="OWNER",
        )

        # Salon
        self.salon = Salon.objects.create(
            owner=self.owner,
            name="Glamour Studio Indiranagar",
            email="glamour@test.com",
            phone="9988776655",
            city="Bengaluru",
            address="123 100ft Road",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )

        # Owner Wallet with ₹2,000 balance
        self.owner_wallet = OwnerWallet.objects.create(
            salon=self.salon,
            owner=self.owner,
            balance=Decimal("2000.00"),
        )

        # Customer
        self.customer = User.objects.create_user(
            email="client@test.com",
            password="ClientPassword123!",
            first_name="Neha",
            last_name="Sharma",
            role="CUSTOMER",
        )
        self.customer_wallet, _ = CustomerWallet.objects.get_or_create(
            user=self.customer,
            defaults={"balance": Decimal("100.00")},
        )
        self.customer_wallet.balance = Decimal("100.00")
        self.customer_wallet.save()

        # Worker
        self.worker_user = User.objects.create_user(
            email="worker@glamour.com",
            password="WorkerPassword123!",
            first_name="Ravi",
            last_name="Teja",
            role="WORKER",
        )
        self.worker = WorkerProfile.objects.create(
            user=self.worker_user,
            salon=self.salon,
            specialization="Stylist",
            commission_rate=Decimal("50.00"),
            is_active=True,
        )

        # Service
        cat = ServiceCategory.objects.create(name="Hair Care")
        base_svc = Service.objects.create(name="Hair Cut", category=cat, standard_price=Decimal("500.00"))
        self.salon_service = SalonService.objects.create(
            salon=self.salon,
            service=base_svc,
            custom_name="Signature Cut",
            price=Decimal("500.00"),
            duration=30,
        )

        today = date.today()

        # Booking 1: Online payment, Confirmed, upcoming
        self.b1_online = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            client_name="Neha Sharma",
            service=self.salon_service,
            service_price=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            payment_method=Booking.PaymentMethod.ONLINE,
            payment_status=Booking.PaymentStatus.PAID,
            status=Booking.Status.CONFIRMED,
            booking_date=today + timedelta(days=2),
            start_time=time(11, 0),
        )

        # Booking 2: Wallet payment, Confirmed, upcoming
        self.b2_wallet = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            client_name="Neha Sharma",
            service=self.salon_service,
            service_price=Decimal("400.00"),
            total_amount=Decimal("400.00"),
            payment_method=Booking.PaymentMethod.WALLET,
            payment_status=Booking.PaymentStatus.PAID,
            status=Booking.Status.CONFIRMED,
            booking_date=today + timedelta(days=3),
            start_time=time(14, 0),
        )

        # Booking 3: Pay at salon (unpaid), Confirmed, upcoming
        self.b3_payatsalon = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            client_name="Neha Sharma",
            service=self.salon_service,
            service_price=Decimal("300.00"),
            total_amount=Decimal("300.00"),
            payment_method=Booking.PaymentMethod.PAY_AT_SALON,
            payment_status=Booking.PaymentStatus.PENDING,
            status=Booking.Status.CONFIRMED,
            booking_date=today + timedelta(days=4),
            start_time=time(16, 0),
        )

        # Booking 4: In Progress (should NOT be cancelled)
        self.b4_inprogress = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            client_name="Neha Sharma",
            service=self.salon_service,
            service_price=Decimal("600.00"),
            total_amount=Decimal("600.00"),
            payment_method=Booking.PaymentMethod.PAY_AT_SALON,
            payment_status=Booking.PaymentStatus.PENDING,
            status=Booking.Status.IN_PROGRESS,
            booking_date=today,
            start_time=time(10, 0),
        )

        # Booking 5: Completed (should NOT be affected)
        self.b5_completed = Booking.objects.create(
            salon=self.salon,
            worker=self.worker,
            customer=self.customer,
            client_name="Neha Sharma",
            service=self.salon_service,
            service_price=Decimal("700.00"),
            total_amount=Decimal("700.00"),
            payment_method=Booking.PaymentMethod.ONLINE,
            payment_status=Booking.PaymentStatus.PAID,
            status=Booking.Status.COMPLETED,
            booking_date=today - timedelta(days=1),
            start_time=time(12, 0),
        )

    def test_salon_blocking_automatic_cancellation_and_refunds(self):
        from decimal import Decimal
        from bookings.models import Booking, BookingHistory
        from payments.models import OwnerWalletTransaction, Refund
        from notifications.models import Notification

        self.client.force_authenticate(user=self.admin)

        with patch("salons.email_utils.send_mail") as mock_send_mail:
            mock_send_mail.return_value = 1
            res = self.client.post(
                f"/api/v1/salons/admin/{self.salon.id}/decision/",
                {"approval_status": "BLOCKED", "admin_notes": "Terms of service violation"},
                format="json",
            )

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["cancelled_bookings_count"], 3)
        self.assertEqual(res.data["refunded_bookings_count"], 2)
        self.assertEqual(res.data["total_refunded_amount"], "900.00")
        self.assertEqual(res.data["in_progress_bookings_count"], 1)

        # 1. Salon is blocked
        self.salon.refresh_from_db()
        self.assertEqual(self.salon.approval_status, Salon.ApprovalStatus.BLOCKED)
        self.assertEqual(self.salon.admin_notes, "Terms of service violation")

        # 2. Upcoming bookings cancelled
        self.b1_online.refresh_from_db()
        self.assertEqual(self.b1_online.status, Booking.Status.CANCELLED)
        self.assertEqual(self.b1_online.payment_status, Booking.PaymentStatus.REFUNDED)

        self.b2_wallet.refresh_from_db()
        self.assertEqual(self.b2_wallet.status, Booking.Status.CANCELLED)
        self.assertEqual(self.b2_wallet.payment_status, Booking.PaymentStatus.REFUNDED)

        self.b3_payatsalon.refresh_from_db()
        self.assertEqual(self.b3_payatsalon.status, Booking.Status.CANCELLED)

        # 3. In-progress and completed bookings remain untouched
        self.b4_inprogress.refresh_from_db()
        self.assertEqual(self.b4_inprogress.status, Booking.Status.IN_PROGRESS)

        self.b5_completed.refresh_from_db()
        self.assertEqual(self.b5_completed.status, Booking.Status.COMPLETED)

        # 4. Customer wallet credited with 100% refunds: ₹500 + ₹400 = ₹900
        # Initial balance was ₹100, now should be ₹1,000
        self.customer_wallet.refresh_from_db()
        self.assertEqual(self.customer_wallet.balance, Decimal("1000.00"))

        # 5. Salon owner wallet debited ₹900 (₹2,000 - ₹900 = ₹1,100)
        self.owner_wallet.refresh_from_db()
        self.assertEqual(self.owner_wallet.balance, Decimal("1100.00"))
        self.assertEqual(self.owner_wallet.total_refunded, Decimal("900.00"))

        # OwnerWalletTransaction created
        owner_txs = OwnerWalletTransaction.objects.filter(
            salon=self.salon,
            flow=OwnerWalletTransaction.FlowType.DEBIT,
            transaction_type=OwnerWalletTransaction.TransactionType.REFUND_ISSUED,
        )
        self.assertEqual(owner_txs.count(), 2)

        # 6. BookingHistory records created
        histories = BookingHistory.objects.filter(
            booking__in=[self.b1_online, self.b2_wallet, self.b3_payatsalon],
            action=BookingHistory.Action.CANCELLED,
        )
        self.assertEqual(histories.count(), 3)

        # 7. In-app notifications sent to customer and owner
        c_notifs = Notification.objects.filter(recipient=self.customer)
        self.assertTrue(c_notifs.exists())

        owner_notifs = Notification.objects.filter(recipient=self.owner)
        self.assertTrue(owner_notifs.exists())

        # 8. Email sent to salon owner
        mock_send_mail.assert_called()

    def test_blocking_is_idempotent(self):
        from decimal import Decimal
        from payments.models import Refund

        self.client.force_authenticate(user=self.admin)

        with patch("salons.email_utils.send_mail"):
            # First block
            res1 = self.client.post(
                f"/api/v1/salons/admin/{self.salon.id}/decision/",
                {"approval_status": "BLOCKED", "admin_notes": "First block"},
                format="json",
            )
            self.assertEqual(res1.status_code, 200)
            self.assertEqual(res1.data["cancelled_bookings_count"], 3)
            self.assertEqual(res1.data["refunded_bookings_count"], 2)

            self.customer_wallet.refresh_from_db()
            self.assertEqual(self.customer_wallet.balance, Decimal("1000.00"))

            # Second block (idempotency check)
            res2 = self.client.post(
                f"/api/v1/salons/admin/{self.salon.id}/decision/",
                {"approval_status": "BLOCKED", "admin_notes": "Second block attempt"},
                format="json",
            )
            self.assertEqual(res2.status_code, 200)
            # Already cancelled, so count is 0
            self.assertEqual(res2.data["cancelled_bookings_count"], 0)
            self.assertEqual(res2.data["refunded_bookings_count"], 0)

            # Customer wallet should NOT be refunded twice
            self.customer_wallet.refresh_from_db()
            self.assertEqual(self.customer_wallet.balance, Decimal("1000.00"))

            # Owner wallet should NOT be debited twice
            self.owner_wallet.refresh_from_db()
            self.assertEqual(self.owner_wallet.balance, Decimal("1100.00"))

            # Exactly 2 refunds exist in DB
            self.assertEqual(Refund.objects.filter(salon=self.salon).count(), 2)

    def test_blocked_salon_prevents_new_bookings(self):
        from datetime import date, timedelta
        from rest_framework.test import APIClient
        from salons.models import Salon

        # Block the salon
        self.salon.approval_status = Salon.ApprovalStatus.BLOCKED
        self.salon.save()

        # Customer tries to create a booking
        cust_client = APIClient()
        cust_client.force_authenticate(user=self.customer)
        res = cust_client.post(
            "/api/v1/bookings/create/",
            {
                "salon_id": self.salon.id,
                "service_id": self.salon_service.id,
                "booking_date": str(date.today() + timedelta(days=5)),
                "start_time": "10:00",
                "client_name": "Neha Sharma",
                "payment_method": "PAY_AT_SALON",
            },
            format="json",
        )
        # Should be rejected with 400 validation error (Salon not found or not approved)
        self.assertEqual(res.status_code, 400)






