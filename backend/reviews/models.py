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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Salon Review"
        verbose_name_plural = "Salon Reviews"

    def __str__(self):
        return f"SalonReview #{self.id} - {self.salon.name} ({self.rating}★ by {self.customer})"


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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Worker Review"
        verbose_name_plural = "Worker Reviews"

    def __str__(self):
        return f"WorkerReview #{self.id} - {self.worker} ({self.rating}★ by {self.customer})"
