from datetime import timedelta
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from rest_framework import serializers

from .models import PendingRegistration
from .utils import generate_otp, send_otp_email

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )
    first_name = serializers.CharField(max_length=100, required=True)
    last_name = serializers.CharField(max_length=100, required=True)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return email

    def create(self, validated_data):
        email = validated_data["email"].lower()
        password = validated_data["password"]
        first_name = validated_data.get("first_name", "").strip()
        last_name = validated_data.get("last_name", "").strip()

        otp = generate_otp()
        hashed_password = make_password(password)

        pending, created = PendingRegistration.objects.update_or_create(
            email=email,
            defaults={
                "password": hashed_password,
                "first_name": first_name,
                "last_name": last_name,
                "otp": otp,
                "attempts": 0,
            },
        )

        # Ensure otp_created_at is updated even on update_or_create
        pending.otp_created_at = timezone.now()
        pending.save(update_fields=["otp_created_at"])

        send_otp_email(email=email, otp=otp, first_name=first_name)
        return pending


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        otp = attrs.get("otp", "").strip()

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                {"email": "This email is already registered and verified."}
            )

        pending = PendingRegistration.objects.filter(email__iexact=email).first()
        if not pending:
            raise serializers.ValidationError(
                {"email": "No pending registration found for this email. Please register again."}
            )

        if pending.is_otp_expired():
            raise serializers.ValidationError(
                {"otp": "Verification code has expired. Please request a new one."}
            )

        if pending.attempts >= 5:
            raise serializers.ValidationError(
                {"otp": "Too many incorrect attempts. Please request a new verification code."}
            )

        if pending.otp != otp:
            pending.attempts += 1
            pending.save(update_fields=["attempts"])
            remaining = 5 - pending.attempts
            if remaining > 0:
                raise serializers.ValidationError(
                    {"otp": f"Invalid verification code. {remaining} attempt(s) remaining."}
                )
            raise serializers.ValidationError(
                {"otp": "Too many incorrect attempts. Please request a new verification code."}
            )

        attrs["pending"] = pending
        return attrs


class ResendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                {"email": "This email is already registered."}
            )

        pending = PendingRegistration.objects.filter(email__iexact=email).first()
        if not pending:
            raise serializers.ValidationError(
                {"email": "No pending registration found for this email. Please register first."}
            )

        elapsed = (timezone.now() - pending.otp_created_at).total_seconds()
        if elapsed < 60:
            remaining = int(60 - elapsed)
            raise serializers.ValidationError(
                {"email": f"Please wait {remaining} second(s) before requesting a new code."}
            )

        attrs["pending"] = pending
        return attrs

    def save(self):
        pending = self.validated_data["pending"]
        otp = generate_otp()
        pending.otp = otp
        pending.otp_created_at = timezone.now()
        pending.attempts = 0
        pending.save(update_fields=["otp", "otp_created_at", "attempts"])

        send_otp_email(email=pending.email, otp=otp, first_name=pending.first_name)
        return pending


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = authenticate(
            request=self.context.get("request"),
            email=email,
            password=password,
        )

        if user is None:
            raise serializers.ValidationError("Invalid email or password.")

        if not user.is_active:
            raise serializers.ValidationError("This account is inactive.")

        attrs["user"] = user
        return attrs