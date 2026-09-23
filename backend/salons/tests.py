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
        self.assertGreaterEqual(len(response.data["salons"]), 4)
        self.assertEqual(response.data["total_count"], 28)

    @patch("salons.views.Salon.objects.filter")
    def test_search_filter(self, mock_filter):
        mock_qs = MagicMock()
        mock_qs.order_by.return_value = []
        mock_filter.return_value = mock_qs
        response = self.client.get(self.explore_url, {"search": "Urban Glow"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        salons = response.data["salons"]
        self.assertTrue(all("urban glow" in s["name"].lower() for s in salons))

    @patch("salons.views.Salon.objects.filter")
    def test_category_filter(self, mock_filter):
        mock_qs = MagicMock()
        mock_qs.order_by.return_value = []
        mock_filter.return_value = mock_qs
        response = self.client.get(self.explore_url, {"category": "nails"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        salons = response.data["salons"]
        self.assertGreater(len(salons), 0)
        self.assertEqual(salons[0]["name"], "Verdant Nail & Skin Sanctuary")


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


