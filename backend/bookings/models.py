from django.conf import settings
from django.db import models


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONFIRMED = "CONFIRMED", "Confirmed"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    worker = models.ForeignKey(
        "salons.WorkerProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_bookings",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customer_bookings",
    )
    service = models.ForeignKey(
        'services.SalonService',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
    )
    client_name = models.CharField(max_length=150)
    client_phone = models.CharField(max_length=20, blank=True, default="")
    client_email = models.EmailField(blank=True, default="")
    service_name = models.CharField(max_length=150)
    service_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    booking_date = models.DateField()
    booking_time = models.CharField(max_length=50)
    start_time = models.TimeField(null=True, blank=True, help_text='Start time for online bookings')
    end_time = models.TimeField(null=True, blank=True, help_text='End time (auto-calculated from service duration)')
    duration = models.CharField(max_length=50, blank=True, default="45 mins")
    station = models.CharField(max_length=50, blank=True, default="Station 01")
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.CONFIRMED,
    )
    notes = models.TextField(blank=True, default="")
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Reservation expiration time for pending bookings",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['worker', 'booking_date', 'start_time']),
        ]

    def __str__(self):
        return f"Booking #{self.id} - {self.client_name} - {self.service_name} ({self.status})"
