from datetime import timedelta
from django.conf import settings
from django.db import models
from django.utils import timezone


class Salon(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        BLOCKED = "BLOCKED", "Blocked"

    
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="salons",
        limit_choices_to={"role": "OWNER"},
        null=True,
        blank=True,
    )

    name = models.CharField(max_length=150)
    tagline = models.CharField(max_length=255, blank=True, default="")
    category = models.CharField(max_length=100, blank=True, default="Hair & Styling")
    secondary_category = models.CharField(max_length=150, blank=True, default="")
    outlet_code = models.CharField(max_length=50, blank=True, default="")
    established_year = models.CharField(max_length=20, blank=True, default="")
    short_summary = models.TextField(blank=True, default="")
    description = models.TextField(blank=True)
    highlights = models.JSONField(default=list, blank=True)

    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=20)
    whatsapp_number = models.CharField(max_length=30, blank=True, default="")
    instagram_handle = models.CharField(max_length=100, blank=True, default="")
    website = models.CharField(max_length=200, blank=True, default="")

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

    opening_hours = models.JSONField(default=dict, blank=True)
    amenities = models.JSONField(default=list, blank=True)
    services = models.JSONField(default=list, blank=True)

    cover_image = models.TextField(blank=True, default="")
    images = models.JSONField(default=list, blank=True)

    # Salon Registration Information & Document Upload
    registration_certificate = models.TextField(
        blank=True,
        default="",
        help_text="Salon Registration Certificate (Proof of business registration)",
    )
    registration_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Salon Registration / Trade License / MSME Number",
    )
    registration_valid_from = models.DateField(
        null=True,
        blank=True,
        help_text="Salon registration valid from date (start date)",
    )
    registration_valid_to = models.DateField(
        null=True,
        blank=True,
        help_text="Salon registration expiry / valid till date",
    )
    gst_certificate = models.TextField(
        blank=True,
        default="",
        help_text="GST Certificate (Tax registration verification)",
    )
    gst_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="GSTIN / Tax identification number",
    )
    owner_id_proof = models.TextField(
        blank=True,
        default="",
        help_text="Owner ID Proof (Aadhaar/PAN - Verify salon owner identity)",
    )
    owner_id_type = models.CharField(
        max_length=50,
        blank=True,
        default="Aadhaar Card",
        help_text="Owner identification document type (Aadhaar, PAN, Passport, etc.)",
    )
    owner_id_number = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Owner identification document number",
    )
    owner_profile_photo = models.TextField(
        blank=True,
        default="",
        help_text="Owner Profile Photo (Owner identification)",
    )

    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
    )
    admin_notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_registration_expired(self):
        if not self.registration_valid_to:
            return False
        from django.utils import timezone
        return self.registration_valid_to < timezone.now().date()

    @property
    def is_registration_expiring_soon(self):
        if not self.registration_valid_to:
            return False
        from django.utils import timezone
        from datetime import timedelta
        today = timezone.now().date()
        return today <= self.registration_valid_to <= today + timedelta(days=30)

    @property
    def registration_days_left(self):
        if not self.registration_valid_to:
            return None
        from django.utils import timezone
        return (self.registration_valid_to - timezone.now().date()).days

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
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=60.00,
        help_text="Worker commission share percentage (e.g. 60.00 for 60%).",
    )
    
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


class WorkerLeave(models.Model):
    class LeaveType(models.TextChoices):
        WEEK_OFF = "WEEK_OFF", "Week Off"
        MONTH_OFF = "MONTH_OFF", "Month Off"
        PERSONAL = "PERSONAL", "Personal"
        SICK = "SICK", "Sick Leave"
        EMERGENCY = "EMERGENCY", "Emergency Leave"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    worker = models.ForeignKey(
        WorkerProfile,
        on_delete=models.CASCADE,
        related_name="leaves",
    )
    date = models.DateField(db_index=True)
    leave_type = models.CharField(
        max_length=20,
        choices=LeaveType.choices,
    )
    reason = models.TextField(
        blank=True,
        default="",
    )
    rejection_reason = models.TextField(
        blank=True,
        default="",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_worker_leaves",
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["worker", "date"],
                name="unique_worker_leave_date",
            )
        ]
        ordering = ["date"]

    def __str__(self):
        return f"{self.worker} - {self.date} - {self.leave_type}"


class SalonEmailOTP(models.Model):
    email = models.EmailField(unique=True, db_index=True)
    otp = models.CharField(max_length=6)
    attempts = models.PositiveIntegerField(default=0)
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now=True)

    def is_otp_expired(self):
        return timezone.now() > self.created_at + timedelta(seconds=120)

    def is_verification_valid(self):
        if not self.is_verified or not self.verified_at:
            return False
        return timezone.now() <= self.verified_at + timedelta(hours=24)

    def __str__(self):
        return f"Salon OTP for {self.email} (verified={self.is_verified})"