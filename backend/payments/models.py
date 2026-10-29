from decimal import Decimal
from django.conf import settings
from django.db import models


class Payment(models.Model):
    class PaymentMethod(models.TextChoices):
        PAY_AT_SALON = "PAY_AT_SALON", "Pay at Salon"
        ONLINE = "ONLINE", "Online Payment"
        CASH = "CASH", "Cash"
        UPI = "UPI", "UPI"
        CARD = "CARD", "Credit / Debit Card"

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially Paid"
        PAID = "PAID", "Paid"
        FAILED = "FAILED", "Failed"
        REFUNDED = "REFUNDED", "Refunded"

    class PaymentType(models.TextChoices):
        ADVANCE = "ADVANCE", "Advance Token"
        REMAINING = "REMAINING", "Remaining Balance"
        FULL = "FULL", "Full Payment"

    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.CASCADE,
        related_name="payments",
        help_text="The booking associated with this payment transaction.",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
        help_text="Customer who made or is responsible for the payment.",
    )
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="payments",
        help_text="Salon receiving the payment.",
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Payment amount in INR.",
    )
    payment_type = models.CharField(
        max_length=20,
        choices=PaymentType.choices,
        default=PaymentType.FULL,
        help_text="Whether this payment is advance token, remaining balance, or full upfront payment.",
    )
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
    razorpay_signature = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["payment_status"]),
            models.Index(fields=["payment_method"]),
            models.Index(fields=["payment_type"]),
            models.Index(fields=["razorpay_order_id"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"Payment #{self.id} (Booking #{self.booking_id}) - {self.payment_type} - {self.payment_method} [{self.payment_status}] ₹{self.amount}"


class OwnerWallet(models.Model):
    salon = models.OneToOneField(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="wallet",
        help_text="The salon whose revenue this wallet manages.",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owner_wallets",
        help_text="Owner user who owns this salon wallet.",
    )
    balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Current available net balance for the salon.",
    )
    total_collected = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Gross total collected from customers (advances + remaining + full).",
    )
    total_advances = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Total advance payments received to date.",
    )
    total_completed_services = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Gross service value of completed appointments.",
    )
    total_worker_payout = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Total commission allocated or payable to workers.",
    )
    total_refunded = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Total refund amount disbursed back to customers.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["salon"]),
            models.Index(fields=["owner"]),
        ]

    def __str__(self):
        return f"OwnerWallet ({self.salon.name}) - Balance: ₹{self.balance}"

    @classmethod
    def get_or_create_for_salon(cls, salon):
        wallet, _ = cls.objects.get_or_create(
            salon=salon,
            defaults={"owner": salon.owner, "balance": Decimal("0.00")},
        )
        return wallet


class OwnerWalletTransaction(models.Model):
    class TransactionType(models.TextChoices):
        ADVANCE_RECEIVED = "ADVANCE_RECEIVED", "Advance Received"
        REMAINING_RECEIVED = "REMAINING_RECEIVED", "Remaining Service Amount Received"
        FULL_PAYMENT_RECEIVED = "FULL_PAYMENT_RECEIVED", "Full Payment Received"
        WORKER_ALLOCATION = "WORKER_ALLOCATION", "Worker Earning Allocation"
        REFUND_ISSUED = "REFUND_ISSUED", "Refund Issued"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment / Expense"

    class FlowType(models.TextChoices):
        CREDIT = "CREDIT", "Credit (+)"
        DEBIT = "DEBIT", "Debit (-)"

    wallet = models.ForeignKey(
        OwnerWallet,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="wallet_transactions",
    )
    booking = models.ForeignKey(
        "bookings.Booking",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="owner_transactions",
    )
    payment = models.ForeignKey(
        Payment,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="wallet_transactions",
    )
    transaction_type = models.CharField(
        max_length=30,
        choices=TransactionType.choices,
    )
    flow = models.CharField(
        max_length=10,
        choices=FlowType.choices,
        default=FlowType.CREDIT,
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Transaction amount in INR.",
    )
    balance_after = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Wallet available balance after this transaction.",
    )
    description = models.TextField(
        help_text="Clear human-readable description explaining origin, customer, booking, worker, salon share.",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured transaction context (customer, worker, shares, prices, etc.).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["wallet", "-created_at"]),
            models.Index(fields=["salon", "-created_at"]),
            models.Index(fields=["transaction_type"]),
            models.Index(fields=["flow"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"[{self.flow}] ₹{self.amount} - {self.transaction_type} (Wallet: ₹{self.balance_after})"


class WorkerWallet(models.Model):
    worker = models.OneToOneField(
        "salons.WorkerProfile",
        on_delete=models.CASCADE,
        related_name="wallet",
        help_text="The worker whose earnings this wallet maintains.",
    )
    balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Current available earnings balance in worker's wallet.",
    )
    total_earned = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Lifetime cumulative earnings credited to this worker.",
    )
    total_withdrawn = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Total amount withdrawn or paid out to this worker.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["worker"]),
        ]

    def __str__(self):
        return f"WorkerWallet ({self.worker}) - Balance: ₹{self.balance}"

    @classmethod
    def get_or_create_for_worker(cls, worker):
        wallet, _ = cls.objects.get_or_create(
            worker=worker,
            defaults={"balance": Decimal("0.00"), "total_earned": Decimal("0.00")},
        )
        return wallet


class WorkerEarning(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CREDITED = "CREDITED", "Credited"
        REVERSED = "REVERSED", "Reversed"

    worker = models.ForeignKey(
        "salons.WorkerProfile",
        on_delete=models.CASCADE,
        related_name="earnings",
    )
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="worker_earnings",
    )
    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.CASCADE,
        related_name="worker_earnings",
    )
    service_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Gross service price completed.",
    )
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("60.00"),
        help_text="Worker commission share percentage applied (e.g. 60.00 for 60%).",
    )
    earning_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Worker's earned commission share.",
    )
    salon_share = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Salon's remaining share from this service.",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.CREDITED,
    )
    description = models.TextField(blank=True, default="")
    reversal_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("worker", "booking")]
        indexes = [
            models.Index(fields=["worker", "-created_at"]),
            models.Index(fields=["salon", "-created_at"]),
            models.Index(fields=["booking"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"WorkerEarning #{self.id} - {self.worker} earned ₹{self.earning_amount} on Booking #{self.booking_id} [{self.status}]"


class WorkerWalletTransaction(models.Model):
    class TransactionType(models.TextChoices):
        COMMISSION_CREDIT = "COMMISSION_CREDIT", "Commission Credit"
        COMMISSION_REVERSAL = "COMMISSION_REVERSAL", "Commission Reversal"
        PAYOUT = "PAYOUT", "Payout"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"

    wallet = models.ForeignKey(
        WorkerWallet,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="transactions",
    )
    worker = models.ForeignKey(
        "salons.WorkerProfile",
        on_delete=models.CASCADE,
        related_name="wallet_transactions",
    )
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="worker_wallet_transactions",
    )
    booking = models.ForeignKey(
        "bookings.Booking",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="worker_wallet_transactions",
    )
    earning = models.ForeignKey(
        WorkerEarning,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transactions",
    )
    transaction_type = models.CharField(
        max_length=30,
        choices=TransactionType.choices,
    )
    flow = models.CharField(
        max_length=10,
        choices=[("CREDIT", "Credit"), ("DEBIT", "Debit")],
        default="CREDIT",
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )
    balance_after = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Worker wallet balance after this transaction.",
    )
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["worker", "-created_at"]),
            models.Index(fields=["wallet", "-created_at"]),
            models.Index(fields=["transaction_type"]),
            models.Index(fields=["flow"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"WorkerWalletTx #{self.id} - {self.worker} [{self.flow}] ₹{self.amount} ({self.transaction_type})"


class Refund(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Requested"
        APPROVED = "APPROVED", "Approved"
        PROCESSED = "PROCESSED", "Processed"
        REJECTED = "REJECTED", "Rejected"

    booking = models.ForeignKey(
        "bookings.Booking",
        on_delete=models.CASCADE,
        related_name="refund_records",
    )
    payment = models.ForeignKey(
        Payment,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="refund_records",
    )
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="refunds",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="customer_refunds",
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Refund amount in INR.",
    )
    reason = models.TextField()
    refund_status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PROCESSED,
    )
    worker_reversal_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Portion of worker commission reversed due to this refund.",
    )
    description = models.TextField(
        help_text="Clear narrative of why customer received refund and which booking it belongs to.",
    )
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="processed_refunds",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["booking"]),
            models.Index(fields=["salon", "-created_at"]),
            models.Index(fields=["refund_status"]),
        ]

    def __str__(self):
        return f"Refund #{self.id} - ₹{self.amount} for Booking #{self.booking_id} [{self.refund_status}]"
