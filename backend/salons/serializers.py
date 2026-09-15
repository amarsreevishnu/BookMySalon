from rest_framework import serializers

from .models import Salon

class SalonSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source="owner.email")
    approval_status = serializers.ReadOnlyField()

    class Meta:
        model = Salon
        fields=[
            "id",
            "owner",
            "name",
            "description",
            "address",
            "city",
            "phone",
            "approval_status",
            "created_at",
            "updated_at",
        ]
        