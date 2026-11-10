from decimal import Decimal
from datetime import datetime, date, time, timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from salons.models import Salon, WorkerProfile, WorkerLeave
from services.models import ServiceCategory, Service, SalonService
from bookings.models import Booking, BookingHistory
from notifications.models import Notification


class WorkerReassignmentTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin
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
            first_name="Ravi",
            last_name="Verma",
        )

        # Customer
        self.customer = User.objects.create_user(
            email="customer@gmail.com",
            password="customerpassword123",
            role="CUSTOMER",
            first_name="Anjali",
            last_name="Nair",
        )

        # Salon
        self.salon = Salon.objects.create(
            owner=self.owner,
            name="Royal Cuts Salon",
            city="Kochi",
            phone="9876543210",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )

        # Workers in same salon
        self.w1_user = User.objects.create_user(
            email="worker1@royalcuts.com",
            password="wpassword123",
            role="WORKER",
            first_name="Arun",
            last_name="Kumar",
        )
        self.worker1 = WorkerProfile.objects.create(
            user=self.w1_user,
            salon=self.salon,
            specialization="Senior Stylist",
            station="Chair #01",
            is_active=True,
        )

        self.w2_user = User.objects.create_user(
            email="worker2@royalcuts.com",
            password="wpassword123",
            role="WORKER",
            first_name="Deepak",
            last_name="Menon",
        )
        self.worker2 = WorkerProfile.objects.create(
            user=self.w2_user,
            salon=self.salon,
            specialization="Master Colorist",
            station="Chair #02",
            is_active=True,
        )

        # Worker in different salon
        self.other_salon = Salon.objects.create(
            name="Different Salon",
            city="Calicut",
            approval_status=Salon.ApprovalStatus.APPROVED,
        )
        self.other_w_user = User.objects.create_user(
            email="otherworker@difffsalon.com",
            password="wpassword123",
            role="WORKER",
        )
        self.other_worker = WorkerProfile.objects.create(
            user=self.other_w_user,
            salon=self.other_salon,
            is_active=True,
        )

        # Service
        self.category = ServiceCategory.objects.create(name="Hair Care")
        self.std_service = Service.objects.create(category=self.category, name="Haircut & Styling")
        self.salon_service = SalonService.objects.create(
            salon=self.salon,
            service=self.std_service,
            price=Decimal("500.00"),
            duration=45,
            is_active=True,
        )

        # Base Booking
        self.appointment_date = timezone.localdate() + timedelta(days=2)
        self.booking = Booking.objects.create(
            salon=self.salon,
            worker=self.worker1,
            customer=self.customer,
            service=self.salon_service,
            client_name="Anjali Nair",
            client_phone="9876500000",
            client_email="customer@gmail.com",
            service_name="Haircut & Styling",
            service_price=Decimal("500.00"),
            total_amount=Decimal("500.00"),
            booking_date=self.appointment_date,
            booking_time="11:00 AM",
            start_time=time(11, 0),
            end_time=time(11, 45),
            duration="45 mins",
            station="Chair #01",
            status=Booking.Status.CONFIRMED,
            payment_method=Booking.PaymentMethod.PAY_AT_SALON,
            payment_status=Booking.PaymentStatus.PENDING,
        )

    def test_owner_can_get_eligible_workers(self):
        """Owner can query eligible candidate workers for a booking."""
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f"/api/v1/salons/owner/bookings/{self.booking.id}/eligible-workers/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertEqual(data["booking_id"], self.booking.id)
        self.assertTrue(data["can_reassign"])
        self.assertIn("workers", data)
        self.assertEqual(len(data["workers"]), 2)

        # Worker1 should be marked is_current
        w1_data = next(w for w in data["workers"] if w["id"] == self.worker1.id)
        self.assertTrue(w1_data["is_current"])
        self.assertFalse(w1_data["can_assign"])

        # Worker2 should be marked can_assign = True
        w2_data = next(w for w in data["workers"] if w["id"] == self.worker2.id)
        self.assertFalse(w2_data["is_current"])
        self.assertTrue(w2_data["can_assign"])
        self.assertEqual(w2_data["availability_status"], "AVAILABLE")

    def test_successful_worker_reassignment_and_history(self):
        """Owner successfully reassigns worker, creating history and dispatching notifications."""
        self.client.force_authenticate(user=self.owner)
        payload = {
            "worker_id": self.worker2.id,
            "reason": "Client requested master colorist",
        }
        res = self.client.post(
            f"/api/v1/salons/owner/bookings/{self.booking.id}/reassign-worker/",
            data=payload,
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Verify booking update
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.worker, self.worker2)
        self.assertEqual(self.booking.station, "Chair #02")
        # Keep existing date, time, service, payment untouched
        self.assertEqual(self.booking.booking_date, self.appointment_date)
        self.assertEqual(self.booking.booking_time, "11:00 AM")
        self.assertEqual(self.booking.service_price, Decimal("500.00"))
        self.assertEqual(self.booking.payment_status, Booking.PaymentStatus.PENDING)

        # Verify BookingHistory created
        history = BookingHistory.objects.filter(booking=self.booking)
        self.assertEqual(history.count(), 1)
        entry = history.first()
        self.assertEqual(entry.action, BookingHistory.Action.WORKER_REASSIGNED)
        self.assertEqual(entry.previous_worker, self.worker1)
        self.assertEqual(entry.new_worker, self.worker2)
        self.assertEqual(entry.previous_worker_name, "Arun Kumar")
        self.assertEqual(entry.new_worker_name, "Deepak Menon")
        self.assertEqual(entry.changed_by, self.owner)
        self.assertEqual(entry.reason, "Client requested master colorist")

        # Verify notifications sent to customer, previous worker, and new worker
        c_notif = Notification.objects.filter(recipient=self.customer)
        self.assertTrue(c_notif.exists())
        self.assertIn("Deepak Menon", c_notif.first().message)

        prev_w_notif = Notification.objects.filter(recipient=self.w1_user)
        self.assertTrue(prev_w_notif.exists())
        self.assertIn("reassigned to Deepak Menon", prev_w_notif.first().message)

        new_w_notif = Notification.objects.filter(recipient=self.w2_user)
        self.assertTrue(new_w_notif.exists())
        self.assertIn("assigned to service client Anjali Nair", new_w_notif.first().message)

    def test_reassignment_blocked_for_in_progress_completed_and_cancelled(self):
        """Status rules: PENDING and CONFIRMED allowed; IN_PROGRESS, COMPLETED, CANCELLED blocked."""
        self.client.force_authenticate(user=self.owner)
        payload = {"worker_id": self.worker2.id}

        for blocked_status in [Booking.Status.IN_PROGRESS, Booking.Status.COMPLETED, Booking.Status.CANCELLED]:
            self.booking.status = blocked_status
            self.booking.save()

            res = self.client.post(
                f"/api/v1/salons/owner/bookings/{self.booking.id}/reassign-worker/",
                data=payload,
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("not permitted", res.data["error"])

    def test_reassignment_conflict_detection(self):
        """Worker cannot be reassigned if already booked during the same appointment slot."""
        # Create an overlapping booking for worker2 on same date and time
        Booking.objects.create(
            salon=self.salon,
            worker=self.worker2,
            client_name="Another Client",
            service_name="Hair Coloring",
            booking_date=self.appointment_date,
            booking_time="11:00 AM",
            start_time=time(11, 0),
            end_time=time(11, 45),
            status=Booking.Status.CONFIRMED,
        )

        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            f"/api/v1/salons/owner/bookings/{self.booking.id}/reassign-worker/",
            data={"worker_id": self.worker2.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("active appointment", res.data["error"])

        # Eligible workers API should also show the conflict
        res_elig = self.client.get(f"/api/v1/salons/owner/bookings/{self.booking.id}/eligible-workers/")
        w2_data = next(w for w in res_elig.data["workers"] if w["id"] == self.worker2.id)
        self.assertFalse(w2_data["can_assign"])
        self.assertEqual(w2_data["availability_status"], "TIME_CONFLICT")
        self.assertIn("active appointment", w2_data["conflict_reason"])

    def test_reassignment_blocked_on_approved_leave(self):
        """Worker cannot be reassigned if on approved leave."""
        WorkerLeave.objects.create(
            worker=self.worker2,
            date=self.appointment_date,
            leave_type=WorkerLeave.LeaveType.SICK,
            status=WorkerLeave.Status.APPROVED,
        )

        self.client.force_authenticate(user=self.owner)
        res = self.client.post(
            f"/api/v1/salons/owner/bookings/{self.booking.id}/reassign-worker/",
            data={"worker_id": self.worker2.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("approved Sick Leave", res.data["error"])

    def test_cannot_assign_worker_from_other_salon_or_inactive(self):
        """Worker must belong to same salon and be active."""
        self.client.force_authenticate(user=self.owner)

        # Worker from other salon
        res = self.client.post(
            f"/api/v1/salons/owner/bookings/{self.booking.id}/reassign-worker/",
            data={"worker_id": self.other_worker.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        # Inactive worker
        self.worker2.is_active = False
        self.worker2.save()
        res = self.client.post(
            f"/api/v1/salons/owner/bookings/{self.booking.id}/reassign-worker/",
            data={"worker_id": self.worker2.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive", res.data["error"])

    def test_super_admin_audit_view_includes_history(self):
        """Super Admin can see worker reassignment history in booking detail audit."""
        # First reassign
        self.client.force_authenticate(user=self.owner)
        self.client.post(
            f"/api/v1/salons/owner/bookings/{self.booking.id}/reassign-worker/",
            data={"worker_id": self.worker2.id, "reason": "VIP Upgrade"},
            format="json",
        )

        # Now authenticate as super admin
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(f"/api/v1/bookings/admin/bookings/{self.booking.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("history", res.data)
        self.assertEqual(len(res.data["history"]), 1)
        h = res.data["history"][0]
        self.assertEqual(h["action"], "WORKER_REASSIGNED")
        self.assertEqual(h["previous_worker_display"], "Arun Kumar")
        self.assertEqual(h["new_worker_display"], "Deepak Menon")
        self.assertEqual(h["reason"], "VIP Upgrade")
