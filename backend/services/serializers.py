from rest_framework import serializers
from .models import ServiceCategory, Service, SalonService


class ServiceCategorySerializer(serializers.ModelSerializer):
    total_services = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = ServiceCategory
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "icon",
            "image",
            "is_active",
            "display_order",
            "total_services",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]


class ServiceSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_icon = serializers.CharField(source="category.icon", read_only=True)

    class Meta:
        model = Service
        fields = [
            "id",
            "category",
            "category_name",
            "category_icon",
            "name",
            "slug",
            "description",
            "standard_price",
            "standard_duration",
            "gender_target",
            "is_active",
            "image",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]


class ServiceCategoryWithServicesSerializer(serializers.ModelSerializer):
    services = serializers.SerializerMethodField()

    class Meta:
        model = ServiceCategory
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "icon",
            "image",
            "is_active",
            "display_order",
            "services",
        ]

    def get_services(self, obj):
        services = obj.services.filter(is_active=True)
        return ServiceSerializer(services, many=True).data


class SalonServiceSerializer(serializers.ModelSerializer):
    service_details = ServiceSerializer(source="service", read_only=True)
    category_name = serializers.CharField(source="service.category.name", read_only=True)
    category_icon = serializers.CharField(source="service.category.icon", read_only=True)
    effective_name = serializers.CharField(read_only=True)
    effective_description = serializers.CharField(read_only=True)

    class Meta:
        model = SalonService
        fields = [
            "id",
            "salon",
            "service",
            "service_details",
            "category_name",
            "category_icon",
            "custom_name",
            "effective_name",
            "price",
            "duration",
            "is_active",
            "description",
            "effective_description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

