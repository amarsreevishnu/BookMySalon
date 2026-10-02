import json
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.conf import settings
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect

from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    ForgotPasswordRequestSerializer,
    ForgotPasswordResendOTPSerializer,
    ForgotPasswordVerifyOTPSerializer,
    LoginSerializer,
    RegisterSerializer,
    ResendOTPSerializer,
    ResetPasswordConfirmSerializer,
    UserSerializer,
    VerifyOTPSerializer,
)

User = get_user_model()


class RegisterView(generics.GenericAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pending = serializer.save()
        return Response(
            {
                "message": "A verification code has been sent to your email. Please verify to complete registration.",
                "email": pending.email,
            },
            status=status.HTTP_200_OK,
        )


class VerifyOTPView(generics.GenericAPIView):
    serializer_class = VerifyOTPSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        pending = serializer.validated_data["pending"]

        
        user = User(
            email=pending.email,
            first_name=pending.first_name,
            last_name=pending.last_name,
            role=User.Role.CUSTOMER,
            is_active=True,
        )
        user.password = pending.password
        user.save()

        pending.delete()
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "Registration completed successfully.",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "role": user.role,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                },
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class ResendOTPView(generics.GenericAPIView):
    serializer_class = ResendOTPSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "message": "A new verification code has been sent to your email.",
            },
            status=status.HTTP_200_OK,
        )


class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        
        return Response(
            {
                "message": "Login successful",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "role": user.role,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "is_superuser": user.is_superuser,
                    "is_staff": user.is_staff,
                },
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_200_OK,
        )


def google_success(request):
    if not request.user.is_authenticated:
        return redirect(
            f"{settings.FRONTEND_URL}/login"
            "?error=Google+login+failed.+Please+try+again."
        )

    user = request.user
    if not getattr(user, "role", None):
        user.role = User.Role.CUSTOMER
        user.save(update_fields=["role"])

    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)

    user_payload = {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_superuser": user.is_superuser,
        "is_staff": user.is_staff,
    }

    params = urlencode(
        {
            "access": access_token,
            "refresh": refresh_token,
            "user": json.dumps(user_payload),
        }
    )

    return redirect(f"{settings.FRONTEND_URL}/google-callback?{params}")


class ForgotPasswordRequestView(generics.GenericAPIView):
    serializer_class = ForgotPasswordRequestSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset_record = serializer.save()

        return Response(
            {
                "message": (
                    "A 6-digit verification code has been sent to your registered email address."
                ),
                "email": reset_record.email,
            },
            status=status.HTTP_200_OK,
        )


class ForgotPasswordVerifyOTPView(generics.GenericAPIView):
    serializer_class = ForgotPasswordVerifyOTPSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset_token = serializer.save()

        return Response(
            {
                "message": "Verification code verified successfully.",
                "email": serializer.validated_data["email"],
                "reset_token": reset_token,
            },
            status=status.HTTP_200_OK,
        )


class ForgotPasswordResendOTPView(generics.GenericAPIView):
    serializer_class = ForgotPasswordResendOTPSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "message": "A new verification code has been sent to your email.",
            },
            status=status.HTTP_200_OK,
        )


class ResetPasswordConfirmView(generics.GenericAPIView):
    serializer_class = ResetPasswordConfirmSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "message": (
                    "Password has been reset successfully! You can now log in with your new password."
                ),
            },
            status=status.HTTP_200_OK,
        )


class IsAdminUserRole(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                getattr(request.user, "role", None) == "ADMIN"
                or request.user.is_superuser
                or request.user.is_staff
            )
        )


class AdminUserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        role = self.request.query_params.get("role", "CUSTOMER")
        qs = User.objects.all()
        if role and role.upper() != "ALL":
            qs = qs.filter(role__iexact=role)

        status_param = self.request.query_params.get("status")
        if status_param == "active":
            qs = qs.filter(is_active=True)
        elif status_param == "blocked":
            qs = qs.filter(is_active=False)

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        return qs.order_by("-date_joined")


class AdminUserDetailView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAdminUserRole]
    queryset = User.objects.all()


class AdminUserToggleBlockView(APIView):
    permission_classes = [IsAdminUserRole]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk)

        if user == request.user:
            return Response(
                {"error": "You cannot block your own super admin account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_superuser:
            return Response(
                {"error": "Super admin accounts cannot be blocked."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        status_text = "active" if user.is_active else "blocked"
        return Response(
            {
                "message": f"User {user.email} is now {status_text}.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


from rest_framework.permissions import IsAuthenticated
from .models import CustomerProfile
from salons.models import Booking, Salon
from salons.media_utils import save_image_to_media
from datetime import datetime
from django.utils import timezone


class CustomerProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def _build_profile_response(self, request, user, profile):
        today = timezone.localdate() if hasattr(timezone, "localdate") else timezone.now().date()
        upcoming_booking = (
            Booking.objects.filter(
                customer=user,
                booking_date__gte=today,
                status__in=[Booking.Status.CONFIRMED, Booking.Status.PENDING],
            )
            .select_related("salon")
            .order_by("booking_date", "booking_time")
            .first()
        )

        next_ritual = None
        if upcoming_booking:
            delta_days = (upcoming_booking.booking_date - today).days
            if delta_days == 0:
                time_str = f"Today • {upcoming_booking.booking_time}"
            elif delta_days == 1:
                time_str = f"Tomorrow • {upcoming_booking.booking_time}"
            else:
                time_str = f"In {delta_days} days • {upcoming_booking.booking_time}"
            next_ritual = {
                "id": upcoming_booking.id,
                "salon_id": upcoming_booking.salon.id,
                "salon_name": upcoming_booking.salon.name,
                "service_name": upcoming_booking.service_name,
                "booking_time_text": time_str,
                "booking_date": upcoming_booking.booking_date.strftime("%Y-%m-%d"),
                "booking_time": upcoming_booking.booking_time,
                "status": upcoming_booking.status,
            }

        saved_count = profile.favorite_salons.count()
        completed_count = Booking.objects.filter(
            customer=user, status=Booking.Status.COMPLETED
        ).count()
        total_bookings = Booking.objects.filter(customer=user).count()

        member_since_str = (
            user.date_joined.strftime("%B %Y")
            if user.date_joined
            else "October 2025"
        )

        avatar_url = profile.avatar
        if avatar_url and avatar_url.startswith("/media/"):
            avatar_url = request.build_absolute_uri(avatar_url)

        full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        if not full_name:
            full_name = user.email.split("@")[0].capitalize()

        return {
            "id": user.id,
            "full_name": full_name,
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "email": user.email,
            "is_email_verified": True,
            "avatar": avatar_url,
            "phone_number": profile.phone_number or "+91 98765 43210",
            "is_phone_verified": profile.is_phone_verified,
            "date_of_birth": (
                profile.date_of_birth.strftime("%Y-%m-%d")
                if profile.date_of_birth
                else ""
            ),
            "gender": profile.gender or "Male (He/Him)",
            "primary_location": profile.primary_location or "Indiranagar, Bengaluru",
            "upi_id": profile.upi_id or f"{user.email.split('@')[0]}@okicici",
            "membership_tier": profile.membership_tier or "Emerald Member",
            "member_since": member_since_str,
            "stats": {
                "next_ritual": next_ritual,
                "saved_places_count": saved_count,
                "completed_count": completed_count,
                "total_bookings_count": total_bookings,
                "reviews_count": completed_count or 5,
                "default_pay": profile.upi_id or f"{user.email.split('@')[0]}@okicici",
            },
            "wellness_preferences": profile.get_wellness_preferences(),
            "notification_channels": profile.get_notification_channels(),
        }

    def get(self, request):
        user = request.user
        profile, _ = CustomerProfile.objects.get_or_create(user=user)
        data = self._build_profile_response(request, user, profile)
        return Response(data, status=status.HTTP_200_OK)

    def put(self, request):
        user = request.user
        profile, _ = CustomerProfile.objects.get_or_create(user=user)

        data = request.data
        if "first_name" in data:
            user.first_name = str(data["first_name"]).strip()
        if "last_name" in data:
            user.last_name = str(data["last_name"]).strip()
        user.save(update_fields=["first_name", "last_name"])

        if "phone_number" in data:
            profile.phone_number = str(data["phone_number"]).strip()
        if "gender" in data:
            profile.gender = str(data["gender"]).strip()
        if "primary_location" in data:
            profile.primary_location = str(data["primary_location"]).strip()
        if "upi_id" in data:
            profile.upi_id = str(data["upi_id"]).strip()

        if "date_of_birth" in data:
            dob_val = data["date_of_birth"]
            if dob_val:
                try:
                    profile.date_of_birth = datetime.strptime(
                        str(dob_val)[:10], "%Y-%m-%d"
                    ).date()
                except Exception:
                    pass
            else:
                profile.date_of_birth = None

        if "avatar" in data and data["avatar"]:
            new_avatar = save_image_to_media(data["avatar"], subfolder="avatars")
            if new_avatar:
                profile.avatar = new_avatar

        profile.save()

        res_data = self._build_profile_response(request, user, profile)
        res_data["user"] = UserSerializer(user).data
        return Response(res_data, status=status.HTTP_200_OK)


class CustomerAvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        profile, _ = CustomerProfile.objects.get_or_create(user=user)

        file_obj = request.FILES.get("avatar") or request.FILES.get("image")
        data_str = request.data.get("avatar") or request.data.get("image")

        target = file_obj if file_obj else data_str
        if not target:
            return Response(
                {"error": "No avatar file or image data provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        saved_path = save_image_to_media(target, subfolder="avatars")
        if not saved_path:
            return Response(
                {"error": "Failed to save avatar image"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile.avatar = saved_path
        profile.save(update_fields=["avatar"])

        full_url = (
            request.build_absolute_uri(saved_path)
            if saved_path.startswith("/media/")
            else saved_path
        )
        return Response(
            {
                "message": "Avatar updated successfully",
                "avatar": full_url,
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        user = request.user
        profile, _ = CustomerProfile.objects.get_or_create(user=user)
        profile.avatar = ""
        profile.save(update_fields=["avatar"])

        return Response(
            {
                "message": "Avatar removed successfully",
                "avatar": "",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class CustomerPreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        user = request.user
        profile, _ = CustomerProfile.objects.get_or_create(user=user)

        data = request.data
        if "wellness_preferences" in data and isinstance(
            data["wellness_preferences"], dict
        ):
            current = profile.get_wellness_preferences()
            current.update(data["wellness_preferences"])
            profile.wellness_preferences = current

        if "notification_channels" in data and isinstance(
            data["notification_channels"], dict
        ):
            current_channels = profile.get_notification_channels()
            current_channels.update(data["notification_channels"])
            profile.notification_channels = current_channels

        profile.save()

        return Response(
            {
                "message": "Preferences updated successfully",
                "wellness_preferences": profile.get_wellness_preferences(),
                "notification_channels": profile.get_notification_channels(),
            },
            status=status.HTTP_200_OK,
        )


class CustomerChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")

        if not current_password or not new_password:
            return Response(
                {"error": "Current and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(current_password):
            return Response(
                {"error": "Current password does not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"error": "New password must be at least 8 characters long."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()

        return Response(
            {"message": "Password changed successfully."},
            status=status.HTTP_200_OK,
        )


class CustomerToggleFavoriteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        profile, _ = CustomerProfile.objects.get_or_create(user=user)
        salon_id = request.data.get("salon_id")

        if not salon_id:
            return Response(
                {"error": "salon_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            salon = Salon.objects.get(id=salon_id)
        except Salon.DoesNotExist:
            return Response(
                {"error": "Salon not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if profile.favorite_salons.filter(id=salon.id).exists():
            profile.favorite_salons.remove(salon)
            is_fav = False
            msg = f"Removed {salon.name} from favorites"
        else:
            profile.favorite_salons.add(salon)
            is_fav = True
            msg = f"Added {salon.name} to favorites"

        return Response(
            {
                "message": msg,
                "is_favorite": is_fav,
                "saved_places_count": profile.favorite_salons.count(),
            },
            status=status.HTTP_200_OK,
        )


class CustomerBookingsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        bookings = (
            Booking.objects.filter(customer=user)
            .select_related("salon")
            .order_by("-booking_date", "-booking_time")
        )
        results = []
        for b in bookings:
            results.append(
                {
                    "id": b.id,
                    "salon_id": b.salon.id,
                    "salon_name": b.salon.name,
                    "salon_image": b.salon.cover_image or "",
                    "salon_city": b.salon.city,
                    "service_name": b.service_name,
                    "service_price": float(b.service_price),
                    "booking_date": b.booking_date.strftime("%Y-%m-%d"),
                    "booking_time": b.booking_time,
                    "status": b.status,
                    "duration": b.duration,
                }
            )
        return Response(
            {"bookings": results, "total_count": len(results)},
            status=status.HTTP_200_OK,
        )


class CustomerFavoritesListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile, _ = CustomerProfile.objects.get_or_create(user=user)
        salons = profile.favorite_salons.all().order_by("-created_at")
        results = []
        for s in salons:
            results.append(
                {
                    "id": s.id,
                    "name": s.name,
                    "city": s.city,
                    "category": s.category,
                    "cover_image": s.cover_image or "",
                    "address": s.address,
                    "phone": s.phone,
                }
            )
        return Response(
            {"favorites": results, "total_count": len(results)},
            status=status.HTTP_200_OK,
        )




