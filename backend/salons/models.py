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
    tagline = models.CharField(max_length=255, blank=True, default="")
    category = models.CharField(max_length=100, blank=True, default="Hair & Styling")
    secondary_category = models.CharField(max_length=150, blank=True, default="")
    outlet_code = models.CharField(max_length=50, blank=True, default="")
    established_year = models.CharField(max_length=20, blank=True, default="")
    short_summary = models.TextField(blank=True, default="")
    description = models.TextField(blank=True)
    highlights = models.JSONField(default=list, blank=True)

    # Contact Details
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=20)
    whatsapp_number = models.CharField(max_length=30, blank=True, default="")
    instagram_handle = models.CharField(max_length=100, blank=True, default="")
    website = models.CharField(max_length=200, blank=True, default="")

    # Location Details
    address = models.TextField()
    landmark = models.CharField(max_length=255, blank=True, default="")
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


class WorkerProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="worker_profile",
    )
    salon = models.ForeignKey(
        Salon,
        on_delete=models.CASCADE,
        related_name="workers",
    )
    phone_number = models.CharField(max_length=20, blank=True, default="")
    specialization = models.CharField(max_length=150, blank=True, default="")
    experience = models.CharField(max_length=100, blank=True, default="")
    station = models.CharField(max_length=100, blank=True, default="Chair #01")
    employment_status = models.CharField(max_length=100, blank=True, default="Full-Time Specialist")
    bio = models.TextField(blank=True, default="")
    specializations = models.JSONField(default=list, blank=True)
    assigned_services = models.JSONField(default=list, blank=True)
    shift_hours = models.JSONField(default=dict, blank=True)
    commission_tier = models.CharField(max_length=100, blank=True, default="Tier 2 • Senior Specialist")
    id_card_type = models.CharField(max_length=50, blank=True, default="Aadhaar Card")
    id_card_number = models.CharField(max_length=50, blank=True, default="")
    id_card_photo = models.TextField(blank=True, default="")
    profile_photo = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        full_name = self.user.get_full_name() or self.user.email
        return f"{full_name} - {self.specialization} ({self.salon.name})"


class SalonOffDay(models.Model):
    salon = models.ForeignKey(
        Salon,
        on_delete=models.CASCADE,
        related_name="off_days",
    )
    date = models.DateField(db_index=True)
    reason = models.CharField(max_length=200, blank=True, default="Scheduled Closure")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("salon", "date")
        ordering = ["date"]

    def __str__(self):
        return f"{self.salon.name} - Off on {self.date} ({self.reason})"