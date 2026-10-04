import json
from django.db import transaction
from django.contrib.auth import get_user_model
from rest_framework import serializers

from datetime import timedelta
from django.utils import timezone
from .models import Salon, WorkerProfile, SalonOffDay
from bookings.models import Booking
from .media_utils import save_image_to_media, build_full_media_url

User = get_user_model()


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
            "tagline",
            "category",
            "secondary_category",
            "outlet_code",
            "established_year",
            "short_summary",
            "description",
            "highlights",
            "email",
            "phone",
            "whatsapp_number",
            "instagram_handle",
            "website",
            "address",
            "landmark",
            "city",
            "state",
            "pincode",
            "latitude",
            "longitude",
            "opening_hours",
            "amenities",
            "services",
            "cover_image",
            "images",
            "approval_status",
            "admin_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "approval_status", "created_at", "updated_at"]

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, "copy") else dict(data)

        # Coordinate precision handling
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

        # Save cover image to MEDIA_ROOT if base64 or UploadedFile
        if "cover_image" in data and data["cover_image"]:
            data["cover_image"] = save_image_to_media(data["cover_image"], subfolder="salons/covers")

        # Save gallery images to MEDIA_ROOT if base64 or UploadedFiles
        if "images" in data and data["images"]:
            raw_imgs = data["images"]
            if isinstance(raw_imgs, str):
                try:
                    raw_imgs = json.loads(raw_imgs)
                except Exception:
                    raw_imgs = [raw_imgs]

            if isinstance(raw_imgs, list):
                saved_list = []
                for img in raw_imgs:
                    saved_path = save_image_to_media(img, subfolder="salons/gallery")
                    if saved_path:
                        saved_list.append(saved_path)
                data["images"] = saved_list

                # If cover_image is empty, default to first gallery image path
                if not data.get("cover_image") and saved_list:
                    data["cover_image"] = saved_list[0]

        return super().to_internal_value(data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        if ret.get("cover_image"):
            ret["cover_image"] = build_full_media_url(request, ret["cover_image"])
        if isinstance(ret.get("images"), list):
            ret["images"] = [build_full_media_url(request, img) for img in ret["images"]]
        return ret


class WorkerProfileSerializer(serializers.ModelSerializer):
    email = serializers.ReadOnlyField(source="user.email")
    first_name = serializers.ReadOnlyField(source="user.first_name")
    last_name = serializers.ReadOnlyField(source="user.last_name")
    full_name = serializers.SerializerMethodField()
    salon_name = serializers.ReadOnlyField(source="salon.name")
    assigned_bookings_count = serializers.SerializerMethodField()

    class Meta:
        model = WorkerProfile
        fields = [
            "id",
            "user_id",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "phone_number",
            "specialization",
            "experience",
            "station",
            "employment_status",
            "bio",
            "specializations",
            "assigned_services",
            "shift_hours",
            "commission_tier",
            "id_card_type",
            "id_card_number",
            "id_card_photo",
            "profile_photo",
            "is_active",
            "salon",
            "salon_name",
            "assigned_bookings_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user_id", "email", "salon", "salon_name", "created_at", "updated_at"]

    def get_full_name(self, obj):
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name if name else obj.user.email

    def get_assigned_bookings_count(self, obj):
        return obj.assigned_bookings.count()

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        if ret.get("profile_photo"):
            ret["profile_photo"] = build_full_media_url(request, ret["profile_photo"])
        if ret.get("id_card_photo"):
            ret["id_card_photo"] = build_full_media_url(request, ret["id_card_photo"])
        return ret


class WorkerCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, write_only=True)
    email = serializers.EmailField(write_only=True)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    specialization = serializers.CharField(max_length=150, required=False, allow_blank=True)
    experience = serializers.CharField(max_length=100, required=False, allow_blank=True)
    station = serializers.CharField(max_length=100, required=False, allow_blank=True)
    employment_status = serializers.CharField(max_length=100, required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    specializations = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    assigned_services = serializers.ListField(required=False, default=list)
    shift_hours = serializers.DictField(required=False, default=dict)
    commission_tier = serializers.CharField(max_length=100, required=False, allow_blank=True)
    id_card_type = serializers.CharField(max_length=50, required=False, allow_blank=True)
    id_card_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    id_card_photo = serializers.CharField(required=False, allow_blank=True, write_only=True)
    profile_photo = serializers.CharField(required=False, allow_blank=True, write_only=True)
    password = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate_phone_number(self, value):
        if not value:
            return ""
        val = str(value).strip()
        if len(val) > 20:
            import re
            digits = re.sub(r"\D", "", val)
            if digits.startswith("91") and len(digits) > 10:
                digits = digits[2:]
            val = f"+91 {digits}" if digits else val[:20]
        return val[:20]

    def validate_email(self, value):
        normalized = value.strip().lower()
        existing_user = User.objects.filter(email__iexact=normalized).first()
        if existing_user:
            # If user already has a linked worker profile or has an owner/admin/customer account
            has_profile = WorkerProfile.objects.filter(user=existing_user).exists()
            if has_profile or existing_user.role != User.Role.WORKER:
                raise serializers.ValidationError("An account with this email address already exists.")
        return normalized

    def create(self, validated_data):
        salon = self.context.get("salon")
        if not salon:
            raise serializers.ValidationError({"detail": "Owner and salon must be assigned by the backend."})

        full_name = validated_data.get("full_name", "").strip()
        email = validated_data.get("email", "").strip().lower()
        phone_number = validated_data.get("phone_number", "").strip()
        specialization = validated_data.get("specialization", "").strip()
        experience = validated_data.get("experience", "").strip()
        station = validated_data.get("station", "").strip() or "Chair #01"
        employment_status = validated_data.get("employment_status", "").strip() or "Full-Time Specialist"
        bio = validated_data.get("bio", "").strip()
        specializations = validated_data.get("specializations", [])
        assigned_services = validated_data.get("assigned_services", [])
        shift_hours = validated_data.get("shift_hours", {})
        commission_tier = validated_data.get("commission_tier", "").strip() or "Tier 2 • Senior Specialist"
        profile_photo = validated_data.get("profile_photo", "")

        raw_password = validated_data.get("password", "").strip()
        if not raw_password:
            import secrets
            raw_password = f"Worker@{secrets.randbelow(9000) + 1000}"

        name_parts = full_name.split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        with transaction.atomic():
            # 1. Reuse existing orphaned worker user without profile or create brand new user
            user = User.objects.filter(email__iexact=email, role=User.Role.WORKER).first()
            if user:
                user.first_name = first_name
                user.last_name = last_name
                user.set_password(raw_password)
                user.is_active = True
                user.save()
            else:
                user = User.objects.create_user(
                    email=email,
                    password=raw_password,
                    first_name=first_name,
                    last_name=last_name,
                    role=User.Role.WORKER,
                    is_active=True,
                )

            # 2. Process profile photo & optional ID card if provided
            saved_photo = ""
            if profile_photo:
                saved_photo = save_image_to_media(profile_photo, subfolder="workers/photos") or profile_photo

            id_card_type = validated_data.get("id_card_type", "").strip() or "Aadhaar Card"
            id_card_number = validated_data.get("id_card_number", "").strip()
            id_card_photo = validated_data.get("id_card_photo", "")
            saved_id_card = ""
            if id_card_photo:
                saved_id_card = save_image_to_media(id_card_photo, subfolder="workers/id_cards") or id_card_photo

            # 3. Create worker-specific profile attached to backend salon
            profile = WorkerProfile.objects.create(
                user=user,
                salon=salon,
                phone_number=phone_number,
                specialization=specialization,
                experience=experience,
                station=station,
                employment_status=employment_status,
                bio=bio,
                specializations=specializations,
                assigned_services=assigned_services,
                shift_hours=shift_hours,
                commission_tier=commission_tier,
                id_card_type=id_card_type,
                id_card_number=id_card_number,
                id_card_photo=saved_id_card,
                profile_photo=saved_photo,
                is_active=True,
            )

        # Attach raw password for one-time response display and email sending
        profile._temporary_password = raw_password
        return profile

    def to_representation(self, instance):
        data = WorkerProfileSerializer(instance, context=self.context).data
        if hasattr(instance, "_temporary_password"):
            data["temporary_password"] = instance._temporary_password
        return data


class BookingSerializer(serializers.ModelSerializer):
    worker_name = serializers.SerializerMethodField()
    salon_name = serializers.ReadOnlyField(source="salon.name")

    class Meta:
        model = Booking
        fields = [
            "id",
            "salon",
            "salon_name",
            "worker",
            "worker_name",
            "customer",
            "client_name",
            "client_phone",
            "client_email",
            "service_name",
            "service_price",
            "booking_date",
            "booking_time",
            "duration",
            "station",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_worker_name(self, obj):
        if obj.worker and obj.worker.user:
            return obj.worker.user.get_full_name() or obj.worker.user.email
        return "Unassigned"


class SalonOffDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = SalonOffDay
        fields = ["id", "salon", "date", "reason", "created_at"]
        read_only_fields = ["id", "salon", "created_at"]

    def validate_date(self, value):
        today = timezone.localdate() if hasattr(timezone, "localdate") else timezone.now().date()
        min_allowed_date = today + timedelta(days=7)
        if value < min_allowed_date:
            raise serializers.ValidationError(
                f"Salon off-days must be scheduled at least 7 days in advance from today. Earliest allowed date is {min_allowed_date}."
            )
        return value

    def validate(self, attrs):
        salon = self.context.get("salon") or attrs.get("salon")
        target_date = attrs.get("date")
        if salon and target_date:
            existing = SalonOffDay.objects.filter(salon=salon, date=target_date)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError({"date": "An off-day is already scheduled for this date."})
        return attrs