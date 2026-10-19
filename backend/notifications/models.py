from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        BOOKING_CONFIRMED = "BOOKING_CONFIRMED", "Booking Confirmed"
        BOOKING_CANCELLED = "BOOKING_CANCELLED", "Booking Cancelled"
        BOOKING_RESCHEDULED = "BOOKING_RESCHEDULED", "Booking Rescheduled"
        BOOKING_REASSIGNED = "BOOKING_REASSIGNED", "Booking Reassigned"
        PAYMENT_SUCCESS = "PAYMENT_SUCCESS", "Payment Successful"
        PAYMENT_FAILED = "PAYMENT_FAILED", "Payment Failed"
        REFUND_COMPLETED = "REFUND_COMPLETED", "Refund Completed"
        LEAVE_APPROVED = "LEAVE_APPROVED", "Leave Approved"
        LEAVE_REJECTED = "LEAVE_REJECTED", "Leave Rejected"
        NEW_REVIEW_SALON = "NEW_REVIEW_SALON", "New Salon Review"
        NEW_REVIEW_WORKER = "NEW_REVIEW_WORKER", "New Specialist Review"
        SALON_CREATED = "SALON_CREATED", "Salon Created"
        GENERAL = "GENERAL", "General Notification"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_notifications",
    )
    notification_type = models.CharField(
        max_length=40,
        choices=NotificationType.choices,
        default=NotificationType.GENERAL,
        db_index=True,
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"]),
        ]

    def __str__(self):
        return f"[{self.notification_type}] {self.recipient.email} - {self.title}"

    def mark_as_read(self, save=True):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            if save:
                self.save(update_fields=["is_read", "read_at", "updated_at"])
