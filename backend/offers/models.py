from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Offer(models.Model):
    class OfferType(models.TextChoices):
        SERVICE = "SERVICE", "Service-specific Offer"
        FIRST_BOOKING = "FIRST_BOOKING", "First-booking Offer"
        COUPON = "COUPON", "Coupon Code Offer"
        COMBO = "COMBO", "Combo Offer"
        FESTIVAL = "FESTIVAL", "Festival Offer"

    class DiscountType(models.TextChoices):
        PERCENTAGE = "PERCENTAGE", "Percentage Discount"
        FLAT = "FLAT", "Flat Discount"
        FIXED_PRICE = "FIXED_PRICE", "Fixed Combo Price"

    class CustomerEligibility(models.TextChoices):
        ALL = "ALL", "All Customers"
        FIRST_TIME = "FIRST_TIME", "First-time Customers Only"

    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="offers",
    )
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True, default="")
    offer_type = models.CharField(
        max_length=30,
        choices=OfferType.choices,
        default=OfferType.SERVICE,
    )
    code = models.CharField(
        max_length=50,
        blank=True,
        default="",
        db_index=True,
        help_text="Promo or coupon code (e.g. GLOW20, ONAM25).",
    )
    discount_type = models.CharField(
        max_length=20,
        choices=DiscountType.choices,
        default=DiscountType.PERCENTAGE,
    )
    discount_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Percentage (e.g. 20.00), Flat discount (e.g. 100.00), or Fixed Combo Price (e.g. 799.00).",
    )
    max_discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum discount cap for percentage offers (e.g. 25% off up to ₹300).",
    )
    min_spend = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Minimum booking subtotal required to apply this offer.",
    )
    customer_eligibility = models.CharField(
        max_length=20,
        choices=CustomerEligibility.choices,
        default=CustomerEligibility.ALL,
    )
    services = models.ManyToManyField(
        "services.SalonService",
        blank=True,
        related_name="applicable_offers",
        help_text="Applicable services for service-specific offer or combo bundle services.",
    )
    apply_to_all_services = models.BooleanField(
        default=False,
        help_text="Whether this offer applies to all services of this salon.",
    )
    total_usage_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Maximum total redemptions across all customers (null for unlimited).",
    )
    per_customer_limit = models.PositiveIntegerField(
        default=1,
        help_text="Maximum redemptions allowed per customer (default 1).",
    )
    usage_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of times this offer has been redeemed.",
    )
    start_date = models.DateField(help_text="Validity start date.")
    end_date = models.DateField(help_text="Validity end date.")
    applicable_days = models.JSONField(
        default=list,
        blank=True,
        help_text="List of applicable day abbreviations e.g. ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']. Empty means all days.",
    )
    start_time = models.TimeField(
        null=True,
        blank=True,
        help_text="Optional daily start time for happy hours/time-specific deals.",
    )
    end_time = models.TimeField(
        null=True,
        blank=True,
        help_text="Optional daily end time for happy hours/time-specific deals.",
    )
    terms_and_conditions = models.TextField(blank=True, default="")
    show_on_platform = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Promote on BookMySalon Platform (homepage & deals page). Maximum 3 per salon.",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    can_combine = models.BooleanField(
        default=False,
        help_text="Whether this offer can be combined with other offers. Default is False.",
    )
    banner_image = models.TextField(
        blank=True,
        default="",
        help_text="Promotional banner image URL or data.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Offer"
        verbose_name_plural = "Offers"

    def clean(self):
        super().clean()
        if self.code:
            self.code = self.code.strip().upper()

        if self.discount_value is not None:
            if self.discount_value <= 0:
                raise ValidationError({"discount_value": "Discount value must be greater than zero."})
            if self.discount_type == self.DiscountType.PERCENTAGE and self.discount_value > 100:
                raise ValidationError({"discount_value": "Percentage discount cannot exceed 100%."})

        if self.max_discount_amount is not None and self.max_discount_amount <= 0:
            raise ValidationError({"max_discount_amount": "Maximum discount cap must be greater than zero."})

        if self.min_spend is not None and self.min_spend < 0:
            raise ValidationError({"min_spend": "Minimum booking spend cannot be negative."})

        if self.total_usage_limit is not None and self.total_usage_limit < 1:
            raise ValidationError({"total_usage_limit": "Total usage limit must be at least 1."})

        if self.per_customer_limit is not None and self.per_customer_limit < 1:
            raise ValidationError({"per_customer_limit": "Per-customer usage limit must be at least 1."})

        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError({"end_date": "End date cannot be earlier than start date."})

        if self.discount_type == self.DiscountType.FIXED_PRICE and self.offer_type != self.OfferType.COMBO:
            raise ValidationError({"discount_type": "Fixed Combo Price discount type is only valid for Combo Offers."})

        # Enforce maximum 3 platform-promoted offers per salon
        if self.show_on_platform and self.is_active and self.salon_id:
            qs = Offer.objects.filter(
                salon_id=self.salon_id,
                show_on_platform=True,
                is_active=True,
            )
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.count() >= 3:
                raise ValidationError({
                    "show_on_platform": "Limit reached: You can promote a maximum of 3 active offers on the BookMySalon platform at a time. Please remove platform promotion from another offer first."
                })

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.strip().upper()
        else:
            # Auto-generate a readable random coupon code
            import secrets, string
            chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
            rand_suffix = "".join(secrets.choice(chars) for _ in range(6))
            prefix = "BMS"
            if self.offer_type == self.OfferType.COMBO:
                prefix = "COMBO"
            elif self.offer_type == self.OfferType.FESTIVAL:
                prefix = "FEST"
            elif self.offer_type == self.OfferType.FIRST_BOOKING:
                prefix = "FIRST"
            self.code = f"{prefix}-{rand_suffix}"

        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        today = timezone.localdate()
        return today > self.end_date

    @property
    def is_exhausted(self):
        if self.total_usage_limit is not None:
            return self.usage_count >= self.total_usage_limit
        return False

    @property
    def is_currently_valid(self):
        today = timezone.localdate()
        return self.is_active and self.start_date <= today <= self.end_date and not self.is_exhausted

    def __str__(self):
        return f"{self.salon.name} - {self.title} ({self.get_offer_type_display()})"


class OfferRedemption(models.Model):
    offer = models.ForeignKey(
        Offer,
        on_delete=models.CASCADE,
        related_name="redemptions",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="offer_redemptions",
    )
    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.CASCADE,
        related_name="offer_redemptions",
    )
    customer_email = models.CharField(max_length=150, blank=True, default="")
    customer_phone = models.CharField(max_length=50, blank=True, default="")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    order_subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    redeemed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-redeemed_at"]
        verbose_name = "Offer Redemption"
        verbose_name_plural = "Offer Redemptions"

    def __str__(self):
        return f"Redemption #{self.id} of '{self.offer.title}' (₹{self.discount_amount}) on Booking #{self.booking_id}"
