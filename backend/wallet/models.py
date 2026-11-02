import uuid
from decimal import Decimal
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


def generate_wallet_transaction_id():
    """Generates unique, traceable wallet transaction identifier e.g. WTX-20261103-9A8B7C6D."""
    date_str = timezone.now().strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:8].upper()
    return f"WTX-{date_str}-{short_uuid}"


class CustomerWallet(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_wallet",
        help_text="Customer user who owns this wallet.",
    )
    balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        help_text="Current available balance maintained in INR.",
    )
    currency = models.CharField(max_length=10, default="INR")
    is_active = models.BooleanField(
        default=True,
        help_text="Whether wallet is active for transactions.",
    )
    is_locked = models.BooleanField(
        default=False,
        help_text="Whether wallet is locked during security review or pending hold.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Customer Wallet"
        verbose_name_plural = "Customer Wallets"
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["is_active", "is_locked"]),
        ]

    def __str__(self):
        user_display = self.user.get_full_name() or self.user.email
        return f"Wallet ({user_display}) - ₹{self.balance} {self.currency}"

    @classmethod
    def get_or_create_for_user(cls, user):
        """
        Idempotently returns or creates the customer wallet.
        """
        if not user or not user.is_authenticated:
            return None
        wallet, _ = cls.objects.get_or_create(
            user=user,
            defaults={"balance": Decimal("0.00"), "currency": "INR", "is_active": True},
        )
        return wallet


class WalletTransaction(models.Model):
    class TransactionType(models.TextChoices):
        CREDIT = "CREDIT", "Credit / Top-up"
        DEBIT = "DEBIT", "Debit"
        REFUND = "REFUND", "Booking Refund"
        BOOKING_PAYMENT = "BOOKING_PAYMENT", "Booking Payment"
        RESERVATION = "RESERVATION", "Hold for Payment"
        RESERVATION_RELEASE = "RESERVATION_RELEASE", "Hold Released"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    wallet = models.ForeignKey(
        CustomerWallet,
        on_delete=models.CASCADE,
        related_name="transactions",
        help_text="Customer wallet associated with this transaction.",
    )
    transaction_id = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        default=generate_wallet_transaction_id,
        help_text="Unique transaction reference ID.",
    )
    transaction_type = models.CharField(
        max_length=30,
        choices=TransactionType.choices,
        help_text="Classification of the wallet operation.",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.COMPLETED,
        help_text="State of the transaction.",
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Transaction amount in INR.",
    )
    balance_before = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Wallet balance immediately before transaction execution.",
    )
    balance_after = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Wallet balance immediately after transaction execution.",
    )
    reason = models.TextField(
        help_text="Detailed narrative or reason for the transaction.",
    )
    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="wallet_transactions",
        help_text="Associated booking reference if this was a payment or refund.",
    )
    idempotency_key = models.CharField(
        max_length=128,
        null=True,
        blank=True,
        db_index=True,
        help_text="Unique key to prevent duplicate processing of the same operation.",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured audit context (salon, services, payment details, notes).",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Wallet Transaction"
        verbose_name_plural = "Wallet Transactions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["wallet", "-created_at"]),
            models.Index(fields=["transaction_type", "status"]),
            models.Index(fields=["idempotency_key"]),
            models.Index(fields=["booking"]),
        ]

    def __str__(self):
        sign = "+" if self.transaction_type in [
            self.TransactionType.CREDIT,
            self.TransactionType.REFUND,
            self.TransactionType.RESERVATION_RELEASE,
        ] else "-"
        return f"{self.transaction_id} [{self.transaction_type}] {sign}₹{self.amount} ({self.status})"


def generate_wallet_topup_id():
    """Generates unique top-up reference ID e.g. WTU-20261103-9A8B7C6D."""
    date_str = timezone.now().strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:8].upper()
    return f"WTU-{date_str}-{short_uuid}"


class WalletTopUpPayment(models.Model):
    """
    Dedicated payment log and lifecycle tracking for Razorpay wallet additions.
    Completely decoupled from salon booking payments.
    """
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"

    topup_id = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        default=generate_wallet_topup_id,
        help_text="Unique topup reference ID.",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wallet_topups",
        help_text="Customer user performing the top-up.",
    )
    wallet = models.ForeignKey(
        CustomerWallet,
        on_delete=models.CASCADE,
        related_name="topup_payments",
        help_text="Customer wallet receiving the funds.",
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Amount in INR requested for top-up.",
    )
    currency = models.CharField(max_length=10, default="INR")
    razorpay_order_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Razorpay Order ID.",
    )
    razorpay_payment_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        help_text="Razorpay Payment ID returned upon successful checkout.",
    )
    razorpay_signature = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Razorpay verification signature.",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
        help_text="Current state of the top-up order.",
    )
    error_description = models.TextField(
        blank=True,
        default="",
        help_text="Error or cancellation narrative if payment failed.",
    )
    transaction = models.ForeignKey(
        WalletTransaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="topup_record",
        help_text="WalletTransaction record created when this top-up was credited.",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Wallet Top-Up Payment"
        verbose_name_plural = "Wallet Top-Up Payments"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["razorpay_order_id"]),
            models.Index(fields=["razorpay_payment_id"]),
        ]

    def __str__(self):
        return f"{self.topup_id} - ₹{self.amount} [{self.status}] (Order: {self.razorpay_order_id})"


