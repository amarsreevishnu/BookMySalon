from decimal import Decimal
from rest_framework import serializers
from .models import CustomerWallet, WalletTransaction, WalletTopUpPayment
from .services import validate_topup_amount, MAX_WALLET_TOPUP_AMOUNT


class WalletTransactionSerializer(serializers.ModelSerializer):
    transaction_type_display = serializers.CharField(source="get_transaction_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    is_credit = serializers.SerializerMethodField()
    booking_id = serializers.IntegerField(source="booking.id", read_only=True)
    booking_service_name = serializers.CharField(source="booking.service_name", read_only=True)
    booking_salon_name = serializers.CharField(source="booking.salon.name", read_only=True)
    booking_date = serializers.DateField(source="booking.booking_date", read_only=True)

    def get_is_credit(self, obj):
        return obj.transaction_type in [
            WalletTransaction.TransactionType.CREDIT,
            WalletTransaction.TransactionType.REFUND,
            WalletTransaction.TransactionType.RESERVATION_RELEASE,
        ]

    class Meta:
        model = WalletTransaction
        fields = [
            "id",
            "transaction_id",
            "transaction_type",
            "transaction_type_display",
            "status",
            "status_display",
            "amount",
            "balance_before",
            "balance_after",
            "is_credit",
            "reason",
            "booking_id",
            "booking_service_name",
            "booking_salon_name",
            "booking_date",
            "created_at",
        ]


class CustomerWalletSerializer(serializers.ModelSerializer):
    total_credited = serializers.SerializerMethodField()
    total_debited = serializers.SerializerMethodField()
    total_refunded = serializers.SerializerMethodField()
    total_transactions = serializers.SerializerMethodField()
    recent_transactions = serializers.SerializerMethodField()

    class Meta:
        model = CustomerWallet
        fields = [
            "id",
            "balance",
            "currency",
            "is_active",
            "is_locked",
            "total_credited",
            "total_debited",
            "total_refunded",
            "total_transactions",
            "recent_transactions",
            "created_at",
            "updated_at",
        ]

    def get_total_credited(self, obj):
        sum_val = obj.transactions.filter(
            transaction_type__in=[
                WalletTransaction.TransactionType.CREDIT,
                WalletTransaction.TransactionType.REFUND,
            ],
            status=WalletTransaction.Status.COMPLETED,
        ).values_list("amount", flat=True)
        return str(sum(sum_val, Decimal("0.00")))

    def get_total_debited(self, obj):
        sum_val = obj.transactions.filter(
            transaction_type__in=[
                WalletTransaction.TransactionType.DEBIT,
                WalletTransaction.TransactionType.BOOKING_PAYMENT,
            ],
            status=WalletTransaction.Status.COMPLETED,
        ).values_list("amount", flat=True)
        return str(sum(sum_val, Decimal("0.00")))

    def get_total_refunded(self, obj):
        sum_val = obj.transactions.filter(
            transaction_type=WalletTransaction.TransactionType.REFUND,
            status=WalletTransaction.Status.COMPLETED,
        ).values_list("amount", flat=True)
        return str(sum(sum_val, Decimal("0.00")))

    def get_total_transactions(self, obj):
        return obj.transactions.count()

    def get_recent_transactions(self, obj):
        txs = obj.transactions.select_related("booking", "booking__salon")[:5]
        return WalletTransactionSerializer(txs, many=True).data


class WalletTopUpSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
        max_value=MAX_WALLET_TOPUP_AMOUNT,
    )
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_amount(self, value):
        return validate_topup_amount(value)


class WalletTopUpCreateOrderSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
        max_value=MAX_WALLET_TOPUP_AMOUNT,
    )

    def validate_amount(self, value):
        return validate_topup_amount(value)


class WalletTopUpVerifySerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField(max_length=100)
    razorpay_payment_id = serializers.CharField(max_length=100)
    razorpay_signature = serializers.CharField(max_length=255)


class WalletTopUpFailedSerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField(max_length=100)
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    error_code = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")


class WalletTopUpPaymentSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = WalletTopUpPayment
        fields = [
            "id",
            "topup_id",
            "amount",
            "currency",
            "razorpay_order_id",
            "razorpay_payment_id",
            "status",
            "status_display",
            "error_description",
            "created_at",
            "updated_at",
        ]


class WalletBalanceCheckSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))

