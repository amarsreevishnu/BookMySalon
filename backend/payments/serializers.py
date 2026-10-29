from rest_framework import serializers
from .models import (
    Payment,
    OwnerWallet,
    OwnerWalletTransaction,
    WorkerWallet,
    WorkerEarning,
    WorkerWalletTransaction,
    Refund,
)


class PaymentSerializer(serializers.ModelSerializer):
    booking_id = serializers.ReadOnlyField(source='booking.id')
    client_name = serializers.ReadOnlyField(source='booking.client_name')
    service_name = serializers.ReadOnlyField(source='booking.service_name')
    salon_name = serializers.ReadOnlyField(source='salon.name')

    class Meta:
        model = Payment
        fields = [
            'id',
            'booking_id',
            'customer',
            'salon',
            'salon_name',
            'client_name',
            'service_name',
            'amount',
            'payment_type',
            'payment_method',
            'payment_status',
            'razorpay_order_id',
            'razorpay_payment_id',
            'paid_at',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class OwnerWalletSerializer(serializers.ModelSerializer):
    salon_name = serializers.ReadOnlyField(source='salon.name')
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = OwnerWallet
        fields = [
            'id',
            'salon',
            'salon_name',
            'owner',
            'owner_name',
            'balance',
            'total_collected',
            'total_advances',
            'total_completed_services',
            'total_worker_payout',
            'total_refunded',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_owner_name(self, obj):
        if obj.owner:
            return obj.owner.get_full_name() or obj.owner.email
        return ""


class OwnerWalletTransactionSerializer(serializers.ModelSerializer):
    salon_name = serializers.ReadOnlyField(source='salon.name')
    booking_client_name = serializers.ReadOnlyField(source='booking.client_name')
    booking_service_name = serializers.ReadOnlyField(source='booking.service_name')
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        model = OwnerWalletTransaction
        fields = [
            'id',
            'wallet',
            'salon',
            'salon_name',
            'booking',
            'booking_client_name',
            'booking_service_name',
            'payment',
            'transaction_type',
            'flow',
            'amount',
            'balance_after',
            'description',
            'metadata',
            'created_at',
            'formatted_date',
        ]
        read_only_fields = fields

    def get_formatted_date(self, obj):
        if obj.created_at:
            return obj.created_at.strftime("%b %d, %Y • %I:%M %p")
        return ""


class WorkerEarningSerializer(serializers.ModelSerializer):
    worker_name = serializers.SerializerMethodField()
    worker_station = serializers.ReadOnlyField(source='worker.station')
    worker_commission_tier = serializers.ReadOnlyField(source='worker.commission_tier')
    booking_client_name = serializers.ReadOnlyField(source='booking.client_name')
    booking_service_name = serializers.ReadOnlyField(source='booking.service_name')
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        model = WorkerEarning
        fields = [
            'id',
            'worker',
            'worker_name',
            'worker_station',
            'worker_commission_tier',
            'salon',
            'booking',
            'booking_client_name',
            'booking_service_name',
            'service_price',
            'commission_rate',
            'earning_amount',
            'salon_share',
            'status',
            'description',
            'reversal_reason',
            'created_at',
            'updated_at',
            'formatted_date',
        ]
        read_only_fields = fields

    def get_worker_name(self, obj):
        if obj.worker and obj.worker.user:
            return obj.worker.user.get_full_name() or obj.worker.user.email
        return "Specialist"

    def get_formatted_date(self, obj):
        if obj.created_at:
            return obj.created_at.strftime("%b %d, %Y • %I:%M %p")
        return ""


class WorkerWalletSerializer(serializers.ModelSerializer):
    worker_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkerWallet
        fields = [
            'id',
            'worker',
            'worker_name',
            'balance',
            'total_earned',
            'total_withdrawn',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_worker_name(self, obj):
        if obj.worker and obj.worker.user:
            return obj.worker.user.get_full_name() or obj.worker.user.email
        return "Specialist"


class WorkerWalletTransactionSerializer(serializers.ModelSerializer):
    booking_id = serializers.ReadOnlyField(source='booking.id')
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        model = WorkerWalletTransaction
        fields = [
            'id',
            'wallet',
            'worker',
            'salon',
            'booking',
            'booking_id',
            'earning',
            'transaction_type',
            'flow',
            'amount',
            'balance_after',
            'description',
            'created_at',
            'formatted_date',
        ]
        read_only_fields = fields

    def get_formatted_date(self, obj):
        if obj.created_at:
            return obj.created_at.strftime("%b %d, %Y • %I:%M %p")
        return ""


class RefundSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    booking_service_name = serializers.ReadOnlyField(source='booking.service_name')
    processed_by_name = serializers.SerializerMethodField()
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        model = Refund
        fields = [
            'id',
            'booking',
            'booking_service_name',
            'payment',
            'salon',
            'customer',
            'customer_name',
            'amount',
            'reason',
            'refund_status',
            'worker_reversal_amount',
            'description',
            'processed_by',
            'processed_by_name',
            'created_at',
            'updated_at',
            'formatted_date',
        ]
        read_only_fields = fields

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.get_full_name() or obj.customer.email
        if obj.booking:
            return obj.booking.client_name
        return "Customer"

    def get_processed_by_name(self, obj):
        if obj.processed_by:
            return obj.processed_by.get_full_name() or obj.processed_by.email
        return "System"

    def get_formatted_date(self, obj):
        if obj.created_at:
            return obj.created_at.strftime("%b %d, %Y • %I:%M %p")
        return ""


class RazorpayOrderResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    booking_id = serializers.IntegerField()
    payment_id = serializers.IntegerField(required=False)
    razorpay_order_id = serializers.CharField()
    razorpay_key_id = serializers.CharField()
    amount = serializers.IntegerField()
    currency = serializers.CharField()
    service_name = serializers.CharField()
    salon_name = serializers.CharField()
    client_name = serializers.CharField()
    client_email = serializers.CharField()
    client_phone = serializers.CharField()
    expires_at = serializers.CharField()
    expires_in_seconds = serializers.IntegerField()


class RazorpayVerifyRequestSerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField(required=False, allow_blank=True, default="")
    razorpay_payment_id = serializers.CharField(required=True)
    razorpay_signature = serializers.CharField(required=False, allow_blank=True, default="")
