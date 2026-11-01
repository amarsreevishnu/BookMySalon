from decimal import Decimal
from rest_framework import serializers
from django.utils import timezone

from .models import Offer, OfferRedemption
from services.models import SalonService


class SalonServiceMiniSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="effective_name", read_only=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    duration = serializers.IntegerField(read_only=True)

    class Meta:
        model = SalonService
        fields = ["id", "name", "price", "duration", "is_active"]


class OfferOwnerSerializer(serializers.ModelSerializer):
    services_detail = SalonServiceMiniSerializer(source="services", many=True, read_only=True)
    service_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=SalonService.objects.all(),
        source="services",
        required=False,
    )
    is_expired = serializers.BooleanField(read_only=True)
    is_exhausted = serializers.BooleanField(read_only=True)
    is_currently_valid = serializers.BooleanField(read_only=True)
    offer_type_display = serializers.CharField(source="get_offer_type_display", read_only=True)
    discount_type_display = serializers.CharField(source="get_discount_type_display", read_only=True)

    class Meta:
        model = Offer
        fields = [
            "id",
            "salon",
            "title",
            "description",
            "offer_type",
            "offer_type_display",
            "code",
            "discount_type",
            "discount_type_display",
            "discount_value",
            "max_discount_amount",
            "min_spend",
            "customer_eligibility",
            "apply_to_all_services",
            "services",
            "service_ids",
            "services_detail",
            "total_usage_limit",
            "per_customer_limit",
            "usage_count",
            "start_date",
            "end_date",
            "applicable_days",
            "start_time",
            "end_time",
            "terms_and_conditions",
            "show_on_platform",
            "is_active",
            "can_combine",
            "banner_image",
            "is_expired",
            "is_exhausted",
            "is_currently_valid",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "salon", "usage_count", "created_at", "updated_at"]

    def validate_code(self, value):
        if value:
            return value.strip().upper()
        return ""

    def validate(self, attrs):
        salon = self.context.get("salon") or getattr(self.instance, "salon", None)
        if not salon and "salon" in attrs:
            salon = attrs["salon"]

        offer_type = attrs.get("offer_type", getattr(self.instance, "offer_type", Offer.OfferType.SERVICE))
        discount_type = attrs.get("discount_type", getattr(self.instance, "discount_type", Offer.DiscountType.PERCENTAGE))
        discount_value = attrs.get("discount_value", getattr(self.instance, "discount_value", Decimal("0.00")))
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        show_on_platform = attrs.get("show_on_platform", getattr(self.instance, "show_on_platform", False))
        is_active = attrs.get("is_active", getattr(self.instance, "is_active", True))
        services = attrs.get("services", None)
        apply_to_all = attrs.get("apply_to_all_services", getattr(self.instance, "apply_to_all_services", False))

        # Dates validation
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than start date."})

        # Discount type validation
        if discount_type == Offer.DiscountType.FIXED_PRICE and offer_type != Offer.OfferType.COMBO:
            raise serializers.ValidationError({
                "discount_type": "Fixed Combo Price discount type is only valid for Combo Offers."
            })

        if discount_type == Offer.DiscountType.PERCENTAGE:
            if discount_value <= 0 or discount_value > 100:
                raise serializers.ValidationError({
                    "discount_value": "Percentage discount must be between 1% and 100%."
                })
        elif discount_type in (Offer.DiscountType.FLAT, Offer.DiscountType.FIXED_PRICE):
            if discount_value <= 0:
                raise serializers.ValidationError({
                    "discount_value": "Discount value must be greater than zero."
                })

        # Non-negative validation for limits and amounts
        max_discount = attrs.get("max_discount_amount", getattr(self.instance, "max_discount_amount", None))
        if max_discount is not None and max_discount <= 0:
            raise serializers.ValidationError({
                "max_discount_amount": "Maximum discount cap must be greater than zero."
            })

        min_spend = attrs.get("min_spend", getattr(self.instance, "min_spend", Decimal("0.00")))
        if min_spend is not None and min_spend < 0:
            raise serializers.ValidationError({
                "min_spend": "Minimum booking spend cannot be negative."
            })

        total_limit = attrs.get("total_usage_limit", getattr(self.instance, "total_usage_limit", None))
        if total_limit is not None and total_limit < 1:
            raise serializers.ValidationError({
                "total_usage_limit": "Total usage limit must be at least 1."
            })

        per_customer = attrs.get("per_customer_limit", getattr(self.instance, "per_customer_limit", 1))
        if per_customer is not None and per_customer < 1:
            raise serializers.ValidationError({
                "per_customer_limit": "Per-customer usage limit must be at least 1."
            })

        # Auto-generate random coupon code if none was provided
        code = (attrs.get("code") or getattr(self.instance, "code", "") or "").strip().upper()
        if not code:
            import secrets
            chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
            rand_suffix = "".join(secrets.choice(chars) for _ in range(6))
            prefix = "BMS"
            if offer_type == Offer.OfferType.COMBO:
                prefix = "COMBO"
            elif offer_type == Offer.OfferType.FESTIVAL:
                prefix = "FEST"
            elif offer_type == Offer.OfferType.FIRST_BOOKING:
                prefix = "FIRST"
            attrs["code"] = f"{prefix}-{rand_suffix}"
        else:
            attrs["code"] = code

        # Combo validations
        if offer_type == Offer.OfferType.COMBO:
            if apply_to_all:
                raise serializers.ValidationError({
                    "apply_to_all_services": "Combo offers require selecting specific services bundled together."
                })
            # Check services if passed in attrs
            if services is not None:
                if len(services) < 2:
                    raise serializers.ValidationError({
                        "service_ids": "Combo offers require combining at least 2 services."
                    })
            elif self.instance and self.instance.services.count() < 2:
                raise serializers.ValidationError({
                    "service_ids": "Combo offers require combining at least 2 services."
                })

        # Service-specific validation
        if offer_type == Offer.OfferType.SERVICE and not apply_to_all:
            if services is not None and len(services) == 0:
                raise serializers.ValidationError({
                    "service_ids": "Please select at least one service or choose 'Apply to All Services'."
                })

        # Verify services belong to this salon
        if services is not None and salon:
            for s in services:
                if s.salon_id != salon.id:
                    raise serializers.ValidationError({
                        "service_ids": f"Service '{s.effective_name}' does not belong to your salon."
                    })

        # Max 3 platform-promoted offers per salon
        if show_on_platform and is_active and salon:
            qs = Offer.objects.filter(
                salon=salon,
                show_on_platform=True,
                is_active=True,
            )
            if self.instance and self.instance.pk:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.count() >= 3:
                raise serializers.ValidationError({
                    "show_on_platform": "Limit reached: You can promote a maximum of 3 active offers on the BookMySalon platform at a time. Please remove platform promotion from another offer first."
                })

        return attrs


class OfferPublicSerializer(serializers.ModelSerializer):
    salon_id = serializers.IntegerField(source="salon.id", read_only=True)
    salon_name = serializers.CharField(source="salon.name", read_only=True)
    salon_city = serializers.CharField(source="salon.city", read_only=True)
    salon_cover_image = serializers.CharField(source="salon.cover_image", read_only=True)
    services_detail = SalonServiceMiniSerializer(source="services", many=True, read_only=True)
    service_ids = serializers.PrimaryKeyRelatedField(source="services", many=True, read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    is_exhausted = serializers.BooleanField(read_only=True)
    is_currently_valid = serializers.BooleanField(read_only=True)
    offer_type_display = serializers.CharField(source="get_offer_type_display", read_only=True)
    discount_type_display = serializers.CharField(source="get_discount_type_display", read_only=True)
    is_customer_eligible = serializers.SerializerMethodField()
    customer_ineligibility_reason = serializers.SerializerMethodField()

    def get_is_customer_eligible(self, obj):
        return getattr(obj, "is_customer_eligible", True)

    def get_customer_ineligibility_reason(self, obj):
        return getattr(obj, "customer_ineligibility_reason", "")

    class Meta:
        model = Offer
        fields = [
            "id",
            "salon_id",
            "salon_name",
            "salon_city",
            "salon_cover_image",
            "title",
            "description",
            "offer_type",
            "offer_type_display",
            "code",
            "discount_type",
            "discount_type_display",
            "discount_value",
            "max_discount_amount",
            "min_spend",
            "customer_eligibility",
            "apply_to_all_services",
            "service_ids",
            "services_detail",
            "total_usage_limit",
            "per_customer_limit",
            "usage_count",
            "start_date",
            "end_date",
            "applicable_days",
            "start_time",
            "end_time",
            "terms_and_conditions",
            "show_on_platform",
            "is_active",
            "can_combine",
            "banner_image",
            "is_expired",
            "is_exhausted",
            "is_currently_valid",
            "is_customer_eligible",
            "customer_ineligibility_reason",
        ]


class OfferValidateInputSerializer(serializers.Serializer):
    salon_id = serializers.IntegerField(required=True)
    code = serializers.CharField(required=True, trim_whitespace=True)
    service_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        allow_empty=False,
    )
    booking_date = serializers.DateField(required=False, allow_null=True)
    booking_time = serializers.CharField(required=False, allow_blank=True, default="")
    customer_phone = serializers.CharField(required=False, allow_blank=True, default="")
    customer_email = serializers.EmailField(required=False, allow_blank=True, default="")


class OfferRedemptionSerializer(serializers.ModelSerializer):
    offer_title = serializers.CharField(source="offer.title", read_only=True)
    offer_code = serializers.CharField(source="offer.code", read_only=True)
    customer_name = serializers.SerializerMethodField()
    booking_date = serializers.DateField(source="booking.booking_date", read_only=True)

    class Meta:
        model = OfferRedemption
        fields = [
            "id",
            "offer",
            "offer_title",
            "offer_code",
            "customer",
            "customer_name",
            "customer_email",
            "customer_phone",
            "booking",
            "booking_date",
            "discount_amount",
            "order_subtotal",
            "redeemed_at",
        ]

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.get_full_name() or obj.customer.email
        return obj.booking.client_name if obj.booking else "Customer"

