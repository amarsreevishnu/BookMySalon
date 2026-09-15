from django.contrib.auth import get_user_model
from rest_framework import serializers


User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8
    )

    class Meta:
        model = User
        fields = [
            "email",
            "password",
            "first_name",
            "last_name",
            "role",
        ]

    def validate_role(self, value):
        allowed_roles = [
            User.Role.CUSTOMER,
            User.Role.OWNER,
        ]

        if value not in allowed_roles:
            raise serializers.ValidationError(
                "Only CUSTOMER or OWNER registration is allowed."
            )

        return value

    def create(self, validated_data):
        password = validated_data.pop("password")

        return User.objects.create_user(
            password=password,
            **validated_data
        )