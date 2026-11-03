from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models


class SalonReview(models.Model):
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="salon_reviews",
    )
    booking = models.OneToOneField(
        "bookings.Booking",
        on_delete=models.CASCADE,
        related_name="salon_review",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_salon_reviews",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Rating from 1 to 5 stars",
    )
    comment = models.TextField(blank=True, default="")
    is_hidden = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Whether this review is hidden from public display by admin moderation",
    )
    hidden_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when the review was hidden",
    )
    hidden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="moderated_salon_reviews",
        help_text="Admin user who moderated this review",
    )
    moderation_reason = models.TextField(
        blank=True,
        default="",
        help_text="Reason for hiding the review",
    )
    moderation_history = models.JSONField(
        default=list,
        blank=True,
        help_text="Audit log of moderation events",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Salon Review"
        verbose_name_plural = "Salon Reviews"

    def __str__(self):
        status_tag = " [HIDDEN]" if self.is_hidden else ""
        return f"SalonReview #{self.id} - {self.salon.name} ({self.rating}★ by {self.customer}){status_tag}"


class WorkerReview(models.Model):
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="worker_reviews",
    )
    worker = models.ForeignKey(
        "salons.WorkerProfile",
        on_delete=models.CASCADE,
        related_name="worker_reviews",
    )
    booking = models.OneToOneField(
        "bookings.Booking",
        on_delete=models.CASCADE,
        related_name="worker_review",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_worker_reviews",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Rating from 1 to 5 stars",
    )
    comment = models.TextField(blank=True, default="")
    is_hidden = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Whether this review is hidden from public display by admin moderation",
    )
    hidden_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when the review was hidden",
    )
    hidden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="moderated_worker_reviews",
        help_text="Admin user who moderated this review",
    )
    moderation_reason = models.TextField(
        blank=True,
        default="",
        help_text="Reason for hiding the review",
    )
    moderation_history = models.JSONField(
        default=list,
        blank=True,
        help_text="Audit log of moderation events",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Worker Review"
        verbose_name_plural = "Worker Reviews"

    def __str__(self):
        status_tag = " [HIDDEN]" if self.is_hidden else ""
        return f"WorkerReview #{self.id} - {self.worker} ({self.rating}★ by {self.customer}){status_tag}"
