from unittest.mock import patch, MagicMock
from rest_framework import status
from rest_framework.test import APISimpleTestCase


class CustomerSalonExploreTests(APISimpleTestCase):
    def setUp(self):
        self.explore_url = "/api/v1/salons/explore/"
        self.mock_user = MagicMock()
        self.mock_user.is_authenticated = True

    def test_unauthenticated_access_denied(self):
        response = self.client.get(self.explore_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("salons.views.Salon.objects.filter")
    def test_authenticated_customer_can_explore(self, mock_filter):
        mock_filter.return_value = []
        self.client.force_authenticate(user=self.mock_user)
        response = self.client.get(self.explore_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("salons", response.data)
        self.assertGreaterEqual(len(response.data["salons"]), 4)
        self.assertEqual(response.data["total_count"], 28)

    @patch("salons.views.Salon.objects.filter")
    def test_search_filter(self, mock_filter):
        mock_filter.return_value = []
        self.client.force_authenticate(user=self.mock_user)
        response = self.client.get(self.explore_url, {"search": "Urban Glow"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        salons = response.data["salons"]
        self.assertTrue(all("urban glow" in s["name"].lower() for s in salons))

    @patch("salons.views.Salon.objects.filter")
    def test_category_filter(self, mock_filter):
        mock_filter.return_value = []
        self.client.force_authenticate(user=self.mock_user)
        response = self.client.get(self.explore_url, {"category": "nails"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        salons = response.data["salons"]
        self.assertGreater(len(salons), 0)
        self.assertEqual(salons[0]["name"], "Verdant Nail & Skin Sanctuary")


