from django.conf import settings
from django.db import models


class Salon(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        BLOCKED = "BLOCKED", "Blocked"

    # Owner account is assigned upon Super Admin approval
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="salons",
        limit_choices_to={"role": "OWNER"},
        null=True,
        blank=True,
    )

    # Basic Details
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=100, blank=True, default="Hair & Styling")
    description = models.TextField(blank=True)

    # Contact Details
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=20)

    # Location Details
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True, default="Karnataka")
    pincode = models.CharField(max_length=20, blank=True, default="")
    latitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=10, decimal_places=7, null=True, blank=True
    )

    # Operating Hours & Amenities (JSON storage for flexibility)
    opening_hours = models.JSONField(default=dict, blank=True)
    amenities = models.JSONField(default=list, blank=True)
    services = models.JSONField(default=list, blank=True)

    # Photos
    cover_image = models.TextField(blank=True, default="")
    images = models.JSONField(default=list, blank=True)

    # Verification & Approval Status
    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
    )
    admin_notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name