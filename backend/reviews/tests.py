from datetime import date, time, timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from bookings.models import Booking
from reviews.models import SalonReview, WorkerReview
from salons.models import Salon, WorkerProfile

User = get_user_model()


class ReviewsManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        
        self.admin_user = User.objects.create_superuser(
            email="admin@bookmysalon.com",
            password="adminpassword123",
            first_name="Super",
            last_name="Admin",
            role="ADMIN",
        )

        
        self.owner_user = User.objects.create_user(
            email="owner@salona.com",
            password="ownerpassword123",
            first_name="Salon",
            last_name="Owner",
            role="OWNER",
        )

        
        self.customer1 = User.objects.create_user(
            email="customer1@example.com",
            password="customerpassword123",
            first_name="Alice",
            last_name="Smith",
            role="CUSTOMER",
        )

        
        self.customer2 = User.objects.create_user(
            email="customer2@example.com",
            password="customerpassword123",
            first_name="Bob",
            last_name="Jones",
            role="CUSTOMER",
        )

        
        self.salon_a = Salon.objects.create(
            owner=self.owner_user,
            name="Luxe Glamour Salon",
            city="Kochi",
            address="Marine Drive, Kochi",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )

        
        self.salon_b = Salon.objects.create(
            owner=self.owner_user,
            name="Urban Hair Studio",
            city="Trivandrum",
            address="MG Road, Trivandrum",
            approval_status=Salon.ApprovalStatus.PENDING,
        )

        
        self.booking_completed_1 = Booking.objects.create(
            salon=self.salon_a,
            customer=self.customer1,
            client_name="Alice Smith",
            service_name="Hair Styling Deluxe",
            booking_date=date.today() - timedelta(days=5),
            booking_time="10:00 AM",
            status=Booking.Status.COMPLETED,
            total_amount=1500,
        )

        self.booking_completed_2 = Booking.objects.create(
            salon=self.salon_a,
            customer=self.customer2,
            client_name="Bob Jones",
            service_name="Facial Glow",
            booking_date=date.today() - timedelta(days=2),
            booking_time="02:00 PM",
            status=Booking.Status.COMPLETED,
            total_amount=2000,
        )

        self.booking_pending = Booking.objects.create(
            salon=self.salon_a,
            customer=self.customer1,
            client_name="Alice Smith",
            service_name="Manicure",
            booking_date=date.today() + timedelta(days=1),
            booking_time="11:00 AM",
            status=Booking.Status.PENDING,
            total_amount=800,
        )

    def test_customer_cannot_review_pending_booking(self):
        self.client.force_authenticate(user=self.customer1)
        url = f"/api/v1/reviews/bookings/{self.booking_pending.id}/"
        res = self.client.post(url, {"salon_rating": 5, "salon_comment": "Great!"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("completed", res.data.get("error", "").lower())

    def test_other_customer_cannot_review_booking(self):
        self.client.force_authenticate(user=self.customer2)
        url = f"/api/v1/reviews/bookings/{self.booking_completed_1.id}/"
        res = self.client.post(url, {"salon_rating": 5, "salon_comment": "Not my booking"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_can_review_completed_booking_once(self):
        self.client.force_authenticate(user=self.customer1)
        url = f"/api/v1/reviews/bookings/{self.booking_completed_1.id}/"
        res = self.client.post(url, {"salon_rating": 5, "salon_comment": "Amazing experience!"})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(SalonReview.objects.filter(booking=self.booking_completed_1).exists())

        
        res2 = self.client.post(url, {"salon_rating": 4, "salon_comment": "Trying again"})
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_super_admin_stats_and_salons_summary(self):
        
        r1 = SalonReview.objects.create(
            salon=self.salon_a,
            booking=self.booking_completed_1,
            customer=self.customer1,
            rating=5,
            comment="Perfection!",
        )
        r2 = SalonReview.objects.create(
            salon=self.salon_a,
            booking=self.booking_completed_2,
            customer=self.customer2,
            rating=1,
            comment="Terrible attitude.",
        )

        self.client.force_authenticate(user=self.admin_user)
        stats_res = self.client.get("/api/v1/reviews/admin/stats/")
        self.assertEqual(stats_res.status_code, status.HTTP_200_OK)
        self.assertEqual(stats_res.data["total_reviews"], 2)
        self.assertEqual(stats_res.data["five_star_reviews"], 1)
        self.assertEqual(stats_res.data["one_star_reviews"], 1)
        self.assertEqual(stats_res.data["average_platform_rating"], 3.0)

        salons_res = self.client.get("/api/v1/reviews/admin/salons/")
        self.assertEqual(salons_res.status_code, status.HTTP_200_OK)
        salon_a_data = next((s for s in salons_res.data["salons"] if s["id"] == self.salon_a.id), None)
        self.assertIsNotNone(salon_a_data)
        self.assertEqual(salon_a_data["average_rating"], 3.0)
        self.assertEqual(salon_a_data["total_reviews"], 2)

    def test_super_admin_review_filters_and_sorting(self):
        r1 = SalonReview.objects.create(
            salon=self.salon_a,
            booking=self.booking_completed_1,
            customer=self.customer1,
            rating=5,
            comment="Super fast service",
        )
        r2 = SalonReview.objects.create(
            salon=self.salon_a,
            booking=self.booking_completed_2,
            customer=self.customer2,
            rating=2,
            comment="Poor cleanliness",
        )

        self.client.force_authenticate(user=self.admin_user)

        # Filter by rating 5
        res_r5 = self.client.get("/api/v1/reviews/admin/reviews/?rating=5")
        self.assertEqual(res_r5.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_r5.data["reviews"]), 1)
        self.assertEqual(res_r5.data["reviews"][0]["id"], r1.id)

        # Search by keyword
        res_search = self.client.get("/api/v1/reviews/admin/reviews/?search=cleanliness")
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_search.data["reviews"]), 1)
        self.assertEqual(res_search.data["reviews"][0]["id"], r2.id)

        # Sort lowest rated first
        res_sort = self.client.get("/api/v1/reviews/admin/reviews/?sort=lowest_rated")
        self.assertEqual(res_sort.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sort.data["reviews"][0]["rating"], 2)

    def test_super_admin_moderation_hide_and_unhide(self):
        r1 = SalonReview.objects.create(
            salon=self.salon_a,
            booking=self.booking_completed_1,
            customer=self.customer1,
            rating=5,
            comment="Awesome!",
        )
        r2 = SalonReview.objects.create(
            salon=self.salon_a,
            booking=self.booking_completed_2,
            customer=self.customer2,
            rating=1,
            comment="Spam abusive text",
        )

        self.client.force_authenticate(user=self.admin_user)

        # Moderate r2: Hide
        mod_url = f"/api/v1/reviews/admin/reviews/{r2.id}/moderate/"
        mod_res = self.client.post(mod_url, {
            "action": "hide",
            "reason": "Abusive language violating community policy",
        })
        self.assertEqual(mod_res.status_code, status.HTTP_200_OK)
        r2.refresh_from_db()
        self.assertTrue(r2.is_hidden)
        self.assertEqual(r2.moderation_reason, "Abusive language violating community policy")
        self.assertEqual(len(r2.moderation_history), 1)
        self.assertEqual(r2.moderation_history[0]["action"], "HIDDEN")

        # Verify that hidden review does NOT contribute to public average rating
        pub_res = self.client.get(f"/api/v1/reviews/salons/{self.salon_a.id}/")
        self.assertEqual(pub_res.status_code, status.HTTP_200_OK)
        # Average rating should now be 5.0 (since 1-star review is hidden)
        self.assertEqual(pub_res.data["rating"], 5.0)
        self.assertEqual(pub_res.data["reviews_count"], 1)
        self.assertEqual(len(pub_res.data["reviews"]), 1)
        self.assertEqual(pub_res.data["reviews"][0]["id"], r1.id)

        # Super admin unhides review
        unhide_res = self.client.post(mod_url, {
            "action": "unhide",
            "reason": "Resolved by reviewer",
        })
        self.assertEqual(unhide_res.status_code, status.HTTP_200_OK)
        r2.refresh_from_db()
        self.assertFalse(r2.is_hidden)
        self.assertEqual(len(r2.moderation_history), 2)
        self.assertEqual(r2.moderation_history[1]["action"], "UNHIDDEN")

        # Now public average rating includes r2 again: (5 + 1) / 2 = 3.0
        pub_res2 = self.client.get(f"/api/v1/reviews/salons/{self.salon_a.id}/")
        self.assertEqual(pub_res2.data["rating"], 3.0)
        self.assertEqual(pub_res2.data["reviews_count"], 2)

    def test_owner_cannot_access_super_admin_reviews_endpoints(self):
        self.client.force_authenticate(user=self.owner_user)
        # Stats
        res1 = self.client.get("/api/v1/reviews/admin/stats/")
        self.assertEqual(res1.status_code, status.HTTP_403_FORBIDDEN)
        # Salons summary
        res2 = self.client.get("/api/v1/reviews/admin/salons/")
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)
        # Moderation
        r1 = SalonReview.objects.create(
            salon=self.salon_a,
            booking=self.booking_completed_1,
            customer=self.customer1,
            rating=5,
            comment="Awesome!",
        )
        res3 = self.client.post(f"/api/v1/reviews/admin/reviews/{r1.id}/moderate/", {"action": "hide"})
        self.assertEqual(res3.status_code, status.HTTP_403_FORBIDDEN)
