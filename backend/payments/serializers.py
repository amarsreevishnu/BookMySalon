from rest_framework import serializers
from .models import Payment


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
            'payment_method',
            'payment_status',
            'razorpay_order_id',
            'razorpay_payment_id',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


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

