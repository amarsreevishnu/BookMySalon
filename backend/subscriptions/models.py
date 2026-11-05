import uuid
from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


def generate_subscription_payment_id():
    """Generates unique payment tracking ID e.g. SUBPAY-20261105-A1B2C3D4."""
    date_str = timezone.now().strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:8].upper()
    return f"SUBPAY-{date_str}-{short_uuid}"


def generate_admin_wallet_tx_id():
    """Generates unique platform admin wallet transaction ID e.g. ATX-20261105-A1B2C3D4."""
    date_str = timezone.now().strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:8].upper()
    return f"ATX-{date_str}-{short_uuid}"


def generate_subscription_receipt():
    """Generates unique subscription invoice/receipt ID e.g. INV-SUB-202611-ABCD."""
    date_str = timezone.now().strftime("%Y%m")
    short_uuid = uuid.uuid4().hex[:6].upper()
    return f"INV-SUB-{date_str}-{short_uuid}"


class SubscriptionPlan(models.Model):
    """
    Tiered subscription durations offered to salon owners.
    Configurable from Super Admin dashboard.
    """
    class DurationKey(models.TextChoices):
        MONTHLY = "MONTHLY", "1 Month"
        HALF_YEARLY = "HALF_YEARLY", "6 Months"
        YEARLY = "YEARLY", "1 Year"

    duration_key = models.CharField(
        max_length=20,
        choices=DurationKey.choices,
        unique=True,
        help_text="Key identifying the billing cycle duration.",
    )
    name = models.CharField(max_length=100, help_text="User-facing plan name.")
    duration_months = models.PositiveIntegerField(
        help_text="Duration in months (e.g. 1, 6, 12)."
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Current plan price in INR.",
    )
    original_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional strikethrough price in INR.",
    )
    badge_text = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Optional marketing badge like 'Most Popular' or 'Best Value'.",
    )
    description = models.TextField(
        blank=True,
        default="Full access to BookMySalon platform with 0% booking commission.",
    )
    features = models.JSONField(
        default=list,
        blank=True,
        help_text="Bullet points displayed on plan cards.",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this plan is visible and purchasable by salon owners.",
    )
    display_order = models.PositiveIntegerField(
        default=0,
        help_text="Order in which plans are displayed.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order", "duration_months"]
        verbose_name = "Subscription Plan"
        verbose_name_plural = "Subscription Plans"

    def __str__(self):
        return f"{self.name} ({self.duration_months} mo) - ₹{self.price}"


class SubscriptionSetting(models.Model):
    """
    Singleton configuration for platform trial duration and reminder policies.
    """
    default_trial_days = models.PositiveIntegerField(
        default=30,
        help_text="Default number of free trial days granted upon salon approval.",
    )
    trial_reminder_days = models.JSONField(
        default=list,
        blank=True,
        help_text="List of days before expiry to dispatch reminders e.g. [7, 3, 1].",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Subscription Setting"
        verbose_name_plural = "Subscription Settings"

    def __str__(self):
        return f"Subscription Settings (Trial: {self.default_trial_days} days)"

    @classmethod
    def get_settings(cls):
        obj, created = cls.objects.get_or_create(
            id=1,
            defaults={
                "default_trial_days": 30,
                "trial_reminder_days": [7, 3, 1],
            },
        )
        return obj


class SalonSubscription(models.Model):
    
    class SubscriptionType(models.TextChoices):
        TRIAL = "TRIAL", "Free Trial"
        PAID = "PAID", "Paid Subscription"

    class Status(models.TextChoices):
        TRIAL = "TRIAL", "Free Trial Active"
        ACTIVE = "ACTIVE", "Paid Active"
        EXPIRED = "EXPIRED", "Expired"
        CANCELLED = "CANCELLED", "Cancelled"

    salon = models.OneToOneField(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="subscription",
        help_text="The salon this subscription belongs to.",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subscriptions",
        help_text="Current plan subscribed to (null during free trial).",
    )
    subscription_type = models.CharField(
        max_length=20,
        choices=SubscriptionType.choices,
        default=SubscriptionType.TRIAL,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.TRIAL,
        db_index=True,
    )
    start_date = models.DateTimeField(help_text="Subscription or trial start timestamp.")
    end_date = models.DateTimeField(help_text="Subscription or trial expiration timestamp.")
    auto_renew = models.BooleanField(
        default=False,
        help_text="Whether subscription is set to automatically renew.",
    )
    has_used_free_trial = models.BooleanField(
        default=True,
        help_text="Guarantees free trial is only granted once per salon.",
    )
    reminder_sent_intervals = models.JSONField(
        default=list,
        blank=True,
        help_text="Day intervals (e.g. [7, 3, 1]) for which reminders have been dispatched in current cycle.",
    )
    last_reminder_date = models.DateField(
        null=True,
        blank=True,
        help_text="Last date a reminder notification/email was dispatched.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Salon Subscription"
        verbose_name_plural = "Salon Subscriptions"
        indexes = [
            models.Index(fields=["status", "end_date"]),
            models.Index(fields=["subscription_type"]),
        ]

    def __str__(self):
        return f"{self.salon.name} - [{self.status}] (Ends {self.end_date.strftime('%Y-%m-%d')})"

    @property
    def is_currently_active(self):
        """Returns True if the salon subscription or trial is currently active and unexpired."""
        now = timezone.now()
        if self.status in [self.Status.TRIAL, self.Status.ACTIVE]:
            return self.end_date >= now
        return False

    @property
    def days_remaining(self):
        """Number of full days remaining until expiration. Returns 0 if expired."""
        now = timezone.now()
        if self.end_date <= now:
            return 0
        diff = self.end_date - now
        return max(0, diff.days)

    @property
    def is_expiring_soon(self):
        """Returns True if active and expiration is within 7 days."""
        return self.is_currently_active and self.days_remaining <= 7

    def sync_status_with_time(self, save=True):
        """Idempotently updates status to EXPIRED if end_date has elapsed."""
        now = timezone.now()
        if self.status in [self.Status.TRIAL, self.Status.ACTIVE] and self.end_date < now:
            self.status = self.Status.EXPIRED
            if save:
                self.save(update_fields=["status", "updated_at"])
            return True
        return False


class SubscriptionPayment(models.Model):
    """
    Razorpay payment records specifically for salon subscriptions.
    Completely decoupled from customer appointment booking payments.
    """
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"

    payment_id = models.CharField(
        max_length=64,
        unique=True,
        default=generate_subscription_payment_id,
        db_index=True,
    )
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="subscription_payments",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="subscription_payments",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Amount paid in INR.",
    )
    currency = models.CharField(max_length=10, default="INR")
    razorpay_order_id = models.CharField(max_length=100, unique=True, db_index=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    razorpay_signature = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    receipt_number = models.CharField(
        max_length=64,
        unique=True,
        default=generate_subscription_receipt,
    )
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Subscription Payment"
        verbose_name_plural = "Subscription Payments"

    def __str__(self):
        return f"{self.payment_id} - {self.salon.name} - ₹{self.amount} ({self.status})"


class SubscriptionHistory(models.Model):
    """
    Audit log of all subscription transitions, purchases, renewals and admin extensions.
    """
    class Action(models.TextChoices):
        TRIAL_ACTIVATED = "TRIAL_ACTIVATED", "Free Trial Activated"
        PAID_ACTIVATED = "PAID_ACTIVATED", "Paid Subscription Activated"
        RENEWED = "RENEWED", "Subscription Renewed"
        EXTENDED_BY_ADMIN = "EXTENDED_BY_ADMIN", "Manually Extended by Admin"
        EXPIRED = "EXPIRED", "Subscription Expired"
        CANCELLED = "CANCELLED", "Subscription Cancelled"

    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="subscription_history",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    amount_paid = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    payment = models.ForeignKey(
        SubscriptionPayment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Subscription History"
        verbose_name_plural = "Subscription Histories"

    def __str__(self):
        return f"{self.salon.name} - {self.action} on {self.created_at.strftime('%Y-%m-%d')}"


class SuperAdminWallet(models.Model):
    """
    Central Platform Wallet for BookMySalon Super Admin.
    100% of subscription revenue collected from salon owners is credited here.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="platform_admin_wallet",
        help_text="Primary super admin user associated with this platform wallet.",
    )
    balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Current available platform balance in INR.",
    )
    total_subscription_revenue = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Gross cumulative subscription revenue collected.",
    )
    total_payouts = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Total withdrawals or disbursements from platform wallet.",
    )
    currency = models.CharField(max_length=10, default="INR")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Super Admin Platform Wallet"
        verbose_name_plural = "Super Admin Platform Wallets"

    def __str__(self):
        return f"SuperAdminWallet - Balance: ₹{self.balance} {self.currency} (Total Revenue: ₹{self.total_subscription_revenue})"

    @classmethod
    def get_wallet(cls):
        """Returns or creates the platform central wallet."""
        from accounts.models import User
        admin_user = User.objects.filter(role="ADMIN", is_staff=True).first()
        wallet = cls.objects.first()
        if not wallet:
            wallet = cls.objects.create(
                user=admin_user,
                balance=Decimal("0.00"),
                total_subscription_revenue=Decimal("0.00"),
                currency="INR",
            )
        elif not wallet.user and admin_user:
            wallet.user = admin_user
            wallet.save(update_fields=["user"])
        return wallet


class SuperAdminWalletTransaction(models.Model):
    """
    Audited transactions for the Super Admin Platform Wallet.
    Every subscription purchase generates an immutable CREDIT record.
    """
    class TransactionType(models.TextChoices):
        SUBSCRIPTION_CREDIT = "SUBSCRIPTION_CREDIT", "Subscription Payment Credit"
        PAYOUT = "PAYOUT", "Withdrawal / Payout"
        ADJUSTMENT = "ADJUSTMENT", "Balance Adjustment"

    wallet = models.ForeignKey(
        SuperAdminWallet,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    transaction_id = models.CharField(
        max_length=64,
        unique=True,
        default=generate_admin_wallet_tx_id,
        db_index=True,
    )
    transaction_type = models.CharField(
        max_length=30,
        choices=TransactionType.choices,
        default=TransactionType.SUBSCRIPTION_CREDIT,
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Transaction amount in INR.",
    )
    balance_before = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        help_text="Wallet balance prior to this transaction.",
    )
    balance_after = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        help_text="Wallet balance immediately after this transaction.",
    )
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_wallet_credits",
    )
    payment = models.ForeignKey(
        SubscriptionPayment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_wallet_transactions",
    )
    plan_name = models.CharField(max_length=100, blank=True, default="")
    reason = models.TextField(help_text="Detailed audit reason for the wallet transaction.")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Super Admin Wallet Transaction"
        verbose_name_plural = "Super Admin Wallet Transactions"
        indexes = [
            models.Index(fields=["wallet", "-created_at"]),
            models.Index(fields=["transaction_type"]),
        ]

    def __str__(self):
        return f"{self.transaction_id} [+{self.amount}] - {self.salon.name if self.salon else 'Platform'}"
