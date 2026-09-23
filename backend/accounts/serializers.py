import secrets
import re

from datetime import timedelta
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import make_password
from django.utils import timezone

from rest_framework import serializers

from .models import PasswordResetOTP, PendingRegistration
from .utils import generate_otp, send_otp_email, send_password_reset_otp_email
from .validators import validate_name

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )
    first_name = serializers.CharField(max_length=100, required=True, validators=[validate_name])
    last_name = serializers.CharField(max_length=100, required=True, validators=[validate_name])

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


class ForgotPasswordRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.strip().lower()
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise serializers.ValidationError(
                "No account found with this email address. Please check and try again."
            )
        if not user.is_active:
            raise serializers.ValidationError(
                "This account is currently inactive. Please contact support."
            )
        return email

    def create(self, validated_data):
        email = validated_data["email"].lower()
        user = User.objects.filter(email__iexact=email).first()

        otp = generate_otp()
        reset_record, _ = PasswordResetOTP.objects.update_or_create(
            email=email,
            defaults={
                "otp": otp,
                "attempts": 0,
                "reset_token": None,
                "token_created_at": None,
            },
        )
        reset_record.otp_created_at = timezone.now()
        reset_record.save(update_fields=["otp_created_at"])

        send_password_reset_otp_email(
            email=email,
            otp=otp,
            first_name=user.first_name if user else "",
        )
        return reset_record


class ForgotPasswordVerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        otp = attrs.get("otp", "").strip()

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise serializers.ValidationError(
                {"email": "No account found with this email address."}
            )

        reset_record = PasswordResetOTP.objects.filter(email__iexact=email).first()
        if not reset_record:
            raise serializers.ValidationError(
                {"email": "No password reset request found. Please request a new code."}
            )

        if reset_record.is_otp_expired():
            raise serializers.ValidationError(
                {"otp": "Verification code has expired. Please click 'Resend code' to get a new code."}
            )

        if reset_record.attempts >= 5:
            raise serializers.ValidationError(
                {"otp": "Too many incorrect attempts. Please request a new code."}
            )

        if reset_record.otp != otp:
            reset_record.attempts += 1
            reset_record.save(update_fields=["attempts"])
            remaining = 5 - reset_record.attempts
            if remaining > 0:
                raise serializers.ValidationError(
                    {"otp": f"Invalid verification code. {remaining} attempt(s) remaining."}
                )
            raise serializers.ValidationError(
                {"otp": "Too many incorrect attempts. Please request a new code."}
            )

        attrs["reset_record"] = reset_record
        attrs["user"] = user
        return attrs

    def save(self):
        reset_record = self.validated_data["reset_record"]
        reset_token = secrets.token_urlsafe(32)
        reset_record.reset_token = reset_token
        reset_record.token_created_at = timezone.now()
        reset_record.save(update_fields=["reset_token", "token_created_at"])
        return reset_token


class ForgotPasswordResendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise serializers.ValidationError(
                {"email": "No account found with this email address."}
            )

        reset_record = PasswordResetOTP.objects.filter(email__iexact=email).first()
        if not reset_record:
            raise serializers.ValidationError(
                {"email": "No password reset request found. Please request a new code."}
            )

        elapsed = (timezone.now() - reset_record.otp_created_at).total_seconds()
        if elapsed < 60:
            remaining = int(60 - elapsed)
            raise serializers.ValidationError(
                {"email": f"Please wait {remaining} second(s) before requesting a new code."}
            )

        attrs["reset_record"] = reset_record
        attrs["user"] = user
        return attrs

    def save(self):
        reset_record = self.validated_data["reset_record"]
        user = self.validated_data["user"]
        otp = generate_otp()
        reset_record.otp = otp
        reset_record.otp_created_at = timezone.now()
        reset_record.attempts = 0
        reset_record.save(update_fields=["otp", "otp_created_at", "attempts"])

        send_password_reset_otp_email(
            email=reset_record.email,
            otp=otp,
            first_name=user.first_name if user else "",
        )
        return reset_record


class ResetPasswordConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    reset_token = serializers.CharField(max_length=128)
    new_password = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(min_length=8, write_only=True)

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        reset_token = attrs.get("reset_token", "").strip()
        new_password = attrs.get("new_password")
        confirm_password = attrs.get("confirm_password")

        if new_password != confirm_password:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise serializers.ValidationError(
                {"email": "No account found with this email address."}
            )

        reset_record = PasswordResetOTP.objects.filter(email__iexact=email).first()
        if not reset_record or not reset_record.reset_token:
            raise serializers.ValidationError(
                {"reset_token": "Password reset session has expired or is invalid. Please start over."}
            )

        if reset_record.reset_token != reset_token or reset_record.is_token_expired():
            raise serializers.ValidationError(
                {"reset_token": "Password reset session has expired or is invalid. Please start over."}
            )

        attrs["user"] = user
        attrs["reset_record"] = reset_record
        return attrs

    def save(self):
        user = self.validated_data["user"]
        reset_record = self.validated_data["reset_record"]
        new_password = self.validated_data["new_password"]

        user.set_password(new_password)
        user.save()

        # Delete the reset record so token can never be reused
        reset_record.delete()
        return user


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
            "avatar",
        ]
        read_only_fields = [
            "id",
            "date_joined",
            "last_login",
            "avatar",
            "full_name",
        ]

    def get_full_name(self, obj):
        name = f"{obj.first_name or ''} {obj.last_name or ''}".strip()
        return name if name else (obj.email.split("@")[0] if obj.email else "User")

    def get_avatar(self, obj):
        try:
            from allauth.socialaccount.models import SocialAccount

            social = SocialAccount.objects.filter(user=obj).first()
            if social and social.extra_data:
                picture = (
                    social.extra_data.get("picture")
                    or social.extra_data.get("avatar_url")
                    or social.extra_data.get("photo")
                )
                if picture:
                    return picture
        except Exception:
            pass
        return None


