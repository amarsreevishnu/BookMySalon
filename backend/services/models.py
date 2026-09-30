from django.db import models
from django.utils.text import slugify


class ServiceCategory(models.Model):
    """
    Top-level grouping for salon services (e.g., Hair, Skin, Spa, Nails).
    Managed primarily by Super Admin.
    """
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    description = models.TextField(blank=True, default="")
    icon = models.CharField(
        max_length=50,
        blank=True,
        default="✂️",
        help_text="Emoji or icon identifier"
    )
    image = models.TextField(
        blank=True,
        default="",
        help_text="Optional category banner/image URL or base64"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Super Admin can deactivate categories"
    )
    display_order = models.PositiveIntegerField(
        default=0,
        help_text="Sort order for catalog browsing"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Service Category"
        verbose_name_plural = "Service Categories"
        ordering = ["display_order", "name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            while ServiceCategory.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.icon} {self.name}"


class Service(models.Model):
    """
    Standard platform service under a category (e.g., Precision Haircut, Hydra Glow Facial).
    Governed by Super Admin to maintain consistency across the platform.
    """
    GENDER_CHOICES = [
        ("ALL", "Unisex / All"),
        ("MALE", "Men"),
        ("FEMALE", "Women"),
        ("KIDS", "Kids"),
    ]

    category = models.ForeignKey(
        ServiceCategory,
        on_delete=models.CASCADE,
        related_name="services"
    )
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=180, unique=True, blank=True)
    description = models.TextField(blank=True, default="")
    standard_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=500.00,
        help_text="Suggested platform benchmark price (INR)"
    )
    standard_duration = models.PositiveIntegerField(
        default=45,
        help_text="Suggested standard duration in minutes"
    )
    gender_target = models.CharField(
        max_length=20,
        choices=GENDER_CHOICES,
        default="ALL"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Super Admin decides if service is available in platform catalog"
    )
    image = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Standard Service"
        verbose_name_plural = "Standard Services"
        ordering = ["category__display_order", "name"]
        unique_together = ("category", "name")

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name)
            slug = base_slug
            counter = 1
            while Service.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.category.name})"


class SalonService(models.Model):
    """
    A salon's specific offering of a standard platform service.
    Allows Salon Owners to customize their own price, duration, and branding notes.
    """
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="salon_services"
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        related_name="salon_offerings"
    )
    custom_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
        help_text="Optional custom branding e.g. 'Signature Botanical Haircut'"
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Salon custom price in INR"
    )
    duration = models.PositiveIntegerField(
        help_text="Salon custom duration in minutes"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Salon owner can activate or deactivate this offering"
    )
    description = models.TextField(
        blank=True,
        default="",
        help_text="Salon-specific notes or description for this service"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Salon Service Offering"
        verbose_name_plural = "Salon Service Offerings"
        ordering = ["service__category__display_order", "service__name"]
        unique_together = ("salon", "service")

    @property
    def effective_name(self):
        return self.custom_name.strip() if self.custom_name else self.service.name

    @property
    def effective_description(self):
        return self.description.strip() if self.description else self.service.description

    def __str__(self):
        return f"{self.salon.name} - {self.effective_name} (₹{self.price})"

