from rest_framework import serializers
from .models import (
    SubscriptionPlan,
    SubscriptionSetting,
    SalonSubscription,
    SubscriptionPayment,
    SubscriptionHistory,
    SuperAdminWallet,
    SuperAdminWalletTransaction,
)


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "duration_key",
            "name",
            "duration_months",
            "price",
            "original_price",
            "badge_text",
            "description",
            "features",
            "is_active",
            "display_order",
            "created_at",
            "updated_at",
        ]


class SubscriptionSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionSetting
        fields = [
            "id",
            "default_trial_days",
            "trial_reminder_days",
            "updated_at",
        ]


class SalonSubscriptionSerializer(serializers.ModelSerializer):
    salon_id = serializers.IntegerField(source="salon.id", read_only=True)
    salon_name = serializers.CharField(source="salon.name", read_only=True)
    salon_city = serializers.CharField(source="salon.city", read_only=True)
    salon_cover_image = serializers.SerializerMethodField()
    owner_email = serializers.SerializerMethodField()
    plan = SubscriptionPlanSerializer(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)
    is_currently_active = serializers.BooleanField(read_only=True)
    is_expiring_soon = serializers.BooleanField(read_only=True)

    class Meta:
        model = SalonSubscription
        fields = [
            "id",
            "salon_id",
            "salon_name",
            "salon_city",
            "salon_cover_image",
            "owner_email",
            "plan",
            "subscription_type",
            "status",
            "start_date",
            "end_date",
            "days_remaining",
            "is_currently_active",
            "is_expiring_soon",
            "auto_renew",
            "has_used_free_trial",
            "created_at",
            "updated_at",
        ]

    def get_salon_cover_image(self, obj):
        return obj.salon.cover_image if obj.salon else ""

    def get_owner_email(self, obj):
        if obj.salon and obj.salon.owner:
            return obj.salon.owner.email
        return obj.salon.email if obj.salon else ""


class SubscriptionPaymentSerializer(serializers.ModelSerializer):
    salon_id = serializers.IntegerField(source="salon.id", read_only=True)
    salon_name = serializers.CharField(source="salon.name", read_only=True)
    owner_email = serializers.CharField(source="owner.email", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    plan_duration_months = serializers.IntegerField(source="plan.duration_months", read_only=True)

    class Meta:
        model = SubscriptionPayment
        fields = [
            "id",
            "payment_id",
            "salon_id",
            "salon_name",
            "owner_email",
            "plan_name",
            "plan_duration_months",
            "amount",
            "currency",
            "razorpay_order_id",
            "razorpay_payment_id",
            "status",
            "receipt_number",
            "error_message",
            "created_at",
            "updated_at",
        ]


class SubscriptionHistorySerializer(serializers.ModelSerializer):
    salon_id = serializers.IntegerField(source="salon.id", read_only=True)
    salon_name = serializers.CharField(source="salon.name", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)

    class Meta:
        model = SubscriptionHistory
        fields = [
            "id",
            "salon_id",
            "salon_name",
            "plan_name",
            "action",
            "start_date",
            "end_date",
            "amount_paid",
            "notes",
            "created_at",
        ]


class SuperAdminWalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuperAdminWallet
        fields = [
            "id",
            "balance",
            "total_subscription_revenue",
            "total_payouts",
            "currency",
            "updated_at",
        ]


class SuperAdminWalletTransactionSerializer(serializers.ModelSerializer):
    salon_id = serializers.IntegerField(source="salon.id", read_only=True)
    salon_name = serializers.CharField(source="salon.name", read_only=True)
    receipt_number = serializers.CharField(source="payment.receipt_number", read_only=True)

    class Meta:
        model = SuperAdminWalletTransaction
        fields = [
            "id",
            "transaction_id",
            "transaction_type",
            "amount",
            "balance_before",
            "balance_after",
            "salon_id",
            "salon_name",
            "receipt_number",
            "plan_name",
            "reason",
            "created_at",
        ]

