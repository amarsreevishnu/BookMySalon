from decimal import Decimal
from types import SimpleNamespace
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from django.core.exceptions import ValidationError

from accounts.models import User
from salons.models import Salon
from offers.models import Offer
from offers.services import validate_and_calculate_offer


class AdminOffersManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin = User.objects.create_user(
            email="admin@bookmysalon.com",
            password="adminpassword123",
            role="ADMIN",
            is_staff=True,
            is_superuser=True,
        )

        # Salon owner user
        self.owner = User.objects.create_user(
            email="owner@bookmysalon.com",
            password="ownerpassword123",
            role="OWNER",
        )

        # Customer user
        self.customer = User.objects.create_user(
            email="customer@bookmysalon.com",
            password="customerpassword123",
            role="CUSTOMER",
        )

        # Salon
        self.salon = Salon.objects.create(
            owner=self.owner,
            name="Luxe Glamour Salon",
            city="Bangalore",
            approval_status="APPROVED",
        )

        # Active offer
        self.offer = Offer.objects.create(
            salon=self.salon,
            title="Summer Special 20% Off",
            description="Get 20% discount on all salon grooming services.",
            code="SUMMER20",
            offer_type="SERVICE",
            discount_type="PERCENTAGE",
            discount_value=20,
            start_date=timezone.now(),
            end_date=timezone.now() + timedelta(days=30),
            is_active=True,
            show_on_platform=True,
        )

    def test_admin_stats_view(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/offers/admin/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_offers"], 1)
        self.assertEqual(response.data["active_offers"], 1)
        self.assertEqual(response.data["hidden_offers"], 0)
        self.assertEqual(response.data["promoted_offers"], 1)

    def test_admin_salons_summary_view(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/offers/admin/salons/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        salon_entry = response.data["salons"][0]
        self.assertEqual(salon_entry["id"], self.salon.id)
        self.assertEqual(salon_entry["total_offers"], 1)
        self.assertEqual(salon_entry["active_offers"], 1)
        self.assertEqual(salon_entry["hidden_offers"], 0)

    def test_admin_offers_list_view(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/offers/admin/offers/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.offer.id)
        self.assertEqual(response.data[0]["code"], "SUMMER20")

    def test_admin_moderate_hide_offer(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/v1/offers/admin/offers/{self.offer.id}/moderate/",
            {"action": "hide", "reason": "Misleading pricing details"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.offer.refresh_from_db()
        self.assertTrue(self.offer.is_hidden_by_admin)
        self.assertEqual(self.offer.admin_hidden_reason, "Misleading pricing details")
        self.assertIsNotNone(self.offer.admin_hidden_at)
        # Promoted on platform should automatically be disabled when hidden
        self.assertFalse(self.offer.show_on_platform)

    def test_hidden_offer_excluded_from_public_offers(self):
        self.offer.is_hidden_by_admin = True
        self.offer.show_on_platform = False
        self.offer.save()

        # Public deals endpoint
        res = self.client.get("/api/v1/offers/featured/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

        # Salon storefront active offers endpoint
        res = self.client.get(f"/api/v1/offers/salon/{self.salon.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 0)

    def test_hidden_offer_cannot_be_redeemed_in_checkout(self):
        self.offer.is_hidden_by_admin = True
        self.offer.show_on_platform = False
        self.offer.save()

        dummy_service = SimpleNamespace(price=Decimal("1000.00"), effective_price=Decimal("1000.00"))
        with self.assertRaises(ValidationError) as ctx:
            validate_and_calculate_offer(
                salon=self.salon,
                offer_code_or_id="SUMMER20",
                services=[dummy_service],
                customer=self.customer,
            )
        self.assertIn("suspended", str(ctx.exception).lower())

    def test_admin_moderate_unhide_offer(self):
        self.offer.is_hidden_by_admin = True
        self.offer.show_on_platform = False
        self.offer.admin_hidden_reason = "Test reason"
        self.offer.save()

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f"/api/v1/offers/admin/offers/{self.offer.id}/moderate/",
            {"action": "unhide"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.offer.refresh_from_db()
        self.assertFalse(self.offer.is_hidden_by_admin)
        self.assertEqual(self.offer.admin_hidden_reason, "")

    def test_owner_cannot_promote_admin_hidden_offer(self):
        self.offer.is_hidden_by_admin = True
        self.offer.show_on_platform = False
        self.offer.save()

        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(
            f"/api/v1/offers/owner/{self.offer.id}/toggle-platform/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.offer.refresh_from_db()
        self.assertFalse(self.offer.show_on_platform)
