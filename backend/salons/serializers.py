from rest_framework import serializers

from .models import Salon


class SalonSerializer(serializers.ModelSerializer):
    owner_email = serializers.ReadOnlyField(source="owner.email")
    approval_status = serializers.ReadOnlyField()

    class Meta:
        model = Salon
        fields = [
            "id",
            "owner",
            "owner_email",
            "name",
            "category",
            "description",
            "email",
            "phone",
            "address",
            "city",
            "state",
            "pincode",
            "latitude",
            "longitude",
            "opening_hours",
            "amenities",
            "cover_image",
            "images",
            "approval_status",
            "admin_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "approval_status", "created_at", "updated_at"]

    def to_internal_value(self, data):
        # Gracefully handle string/float coords with excessive precision before DecimalField check
        data = data.copy() if hasattr(data, "copy") else dict(data)
        for field in ("latitude", "longitude"):
            if field in data:
                val = data[field]
                if val in (None, "", "null"):
                    data[field] = None
                else:
                    try:
                        data[field] = f"{float(val):.6f}"
                    except (ValueError, TypeError):
                        pass
        return super().to_internal_value(data)