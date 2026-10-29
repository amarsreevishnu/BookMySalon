from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONFIRMED = "CONFIRMED", "Confirmed"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        NO_SHOW = "NO_SHOW", "No Show"

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
    services = models.ManyToManyField(
        'services.SalonService',
        blank=True,
        related_name='multi_service_bookings',
        help_text='All services selected for this appointment',
    )
    client_name = models.CharField(max_length=150)
    client_phone = models.CharField(max_length=20, blank=True, default="")
    client_email = models.EmailField(blank=True, default="")
    service_name = models.CharField(max_length=150)
    service_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Sum of all services prices')
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Taxes (GST & hygiene)')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Discounts/coupons/vouchers')
    voucher_code = models.CharField(max_length=50, blank=True, default="", help_text='Applied promo or voucher code')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Final payable total')
    advance_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Token advance paid online (e.g. ₹100)')
    remaining_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Remaining service amount due at salon')
    is_advance_paid = models.BooleanField(default=False, help_text='Whether advance payment has been confirmed')
    is_fully_paid = models.BooleanField(default=False, help_text='Whether total service price is fully paid')
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
    class PaymentMethod(models.TextChoices):
        PAY_AT_SALON = "PAY_AT_SALON", "Pay at Salon"
        ONLINE = "ONLINE", "Online Payment"

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially Paid (Advance)"
        PAID = "PAID", "Paid"
        FAILED = "FAILED", "Failed"
        REFUNDED = "REFUNDED", "Refunded"

    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
        default=PaymentMethod.PAY_AT_SALON,
    )
    payment_status = models.CharField(
        max_length=30,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    razorpay_order_id = models.CharField(max_length=100, blank=True, default="")
    razorpay_payment_id = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    worker_remarks = models.TextField(
        blank=True,
        default="",
        help_text="Specialist treatment remarks and consultation notes",
    )
    service_started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when specialist started the appointment service",
    )
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

    @property
    def payment(self):
        """Returns the primary/latest payment record for backward compatibility."""
        return self.payments.order_by("-created_at").first()


# Re-export for backward compatibility
from reviews.models import SalonReview, WorkerReview

