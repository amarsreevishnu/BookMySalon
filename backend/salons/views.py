import json
import logging
import math
import re
import secrets
import string

logger = logging.getLogger(__name__)
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, Count, Sum, Avg
from django.http import JsonResponse
from django.utils import timezone
from django.shortcuts import render
from rest_framework.views import APIView
from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from django.core.signing import TimestampSigner
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from accounts.authentication import CustomJWTAuthentication as JWTAuthentication

from services.models import SalonService

from .models import Salon, WorkerProfile, SalonOffDay, WorkerLeave, SalonEmailOTP
from bookings.models import Booking
from reviews.models import SalonReview, WorkerReview
from .serializers import (
    SalonSerializer,
    WorkerProfileSerializer,
    WorkerCreateSerializer,
    BookingSerializer,
    SalonOffDaySerializer,
    WorkerLeaveSerializer,
    SalonSendEmailOTPSerializer,
    SalonVerifyEmailOTPSerializer,
)
from .media_utils import save_image_to_media, build_full_media_url
from .email_utils import (
    send_salon_approval_email,
    send_salon_rejection_email,
    send_worker_credentials_email,
    verify_salon_resubmit_token,
    send_salon_email_otp,
)

User = get_user_model()

class OptionalJWTAuthentication(JWTAuthentication):
    
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except Exception:
            return None

class IsOwner(IsAuthenticated):
    def has_permission(self, request, view):
        authenticated = super().has_permission(request, view)
        return authenticated and getattr(request.user, "role", None) == "OWNER"


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



class IsWorker(IsAuthenticated):
    def has_permission(self, request, view):
        authenticated = super().has_permission(request, view)
        return authenticated and getattr(request.user, "role", None) == "WORKER"


def sync_salon_services(salon, services_data):
    """
    Synchronizes service items configured by the owner into the platform catalog
    (ServiceCategory, Service, SalonService).
    """
    if not salon or not services_data:
        return
    import re
    from decimal import Decimal
    from services.models import ServiceCategory, Service, SalonService

    if not isinstance(services_data, list):
        return

    for item in services_data:
        if not isinstance(item, dict):
            continue
        srv_name = str(item.get("name", "")).strip()
        if not srv_name:
            continue
        cat_name = str(item.get("category", "")).strip() or "General"
        raw_price = str(item.get("price", "0"))
        clean_price_str = re.sub(r"[^\d.]", "", raw_price)
        try:
            price_val = Decimal(clean_price_str) if clean_price_str else Decimal("250.00")
        except Exception:
            price_val = Decimal("250.00")

        raw_dur = str(item.get("duration", "30"))
        dur_match = re.search(r"\d+", raw_dur)
        dur_val = int(dur_match.group(0)) if dur_match else 30

        try:
            category, _ = ServiceCategory.objects.get_or_create(
                name=cat_name,
                defaults={"description": f"{cat_name} services"}
            )
            service, _ = Service.objects.get_or_create(
                category=category,
                name=srv_name,
                defaults={
                    "standard_price": price_val,
                    "standard_duration": dur_val,
                }
            )
            SalonService.objects.update_or_create(
                salon=salon,
                service=service,
                defaults={
                    "custom_name": srv_name,
                    "price": price_val,
                    "duration": dur_val,
                    "is_active": True,
                }
            )
        except Exception as e:
            print(f"Error syncing service '{srv_name}' for salon {salon.id}: {e}")


def get_owner_salon(user):
    if not user or not user.is_authenticated:
        return None

    
    salon = Salon.objects.filter(owner=user, approval_status=Salon.ApprovalStatus.APPROVED).order_by("-id").first()
    if salon:
        return salon

    
    salon = Salon.objects.filter(owner=user).order_by("-id").first()
    if salon:
        return salon

    
    if getattr(user, "email", None):
        salon = Salon.objects.filter(email__iexact=user.email, approval_status=Salon.ApprovalStatus.APPROVED).order_by("-id").first()
        if not salon:
            salon = Salon.objects.filter(email__iexact=user.email).order_by("-id").first()
        if salon:
            try:
                if not salon.owner:
                    salon.owner = user
                    salon.save(update_fields=["owner"])
            except Exception:
                pass
            try:
                if getattr(user, "role", None) != User.Role.OWNER and not user.is_superuser:
                    user.role = User.Role.OWNER
                    user.save(update_fields=["role"])
            except Exception:
                pass
            return salon

   
    if getattr(user, "role", None) in ["ADMIN", "OWNER"] or user.is_superuser or user.is_staff:
        approved = Salon.objects.filter(approval_status=Salon.ApprovalStatus.APPROVED).order_by("-id").first()
        if approved:
            return approved
        return Salon.objects.order_by("-id").first()

    return None


class SalonSendEmailOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SalonSendEmailOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        otp = f"{secrets.randbelow(900000) + 100000}"

        otp_record, _ = SalonEmailOTP.objects.get_or_create(email=email)
        otp_record.otp = otp
        otp_record.attempts = 0
        otp_record.is_verified = False
        otp_record.verified_at = None
        otp_record.save()

        sent = send_salon_email_otp(email, otp)
        if not sent:
            return Response(
                {"error": "Failed to send verification code. Please check your email address and try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "message": f"A 6-digit verification code has been sent to {email}.",
                "email": email,
            },
            status=status.HTTP_200_OK,
        )


class SalonVerifyEmailOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SalonVerifyEmailOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        otp = serializer.validated_data["otp"]

        otp_record = SalonEmailOTP.objects.filter(email=email).first()
        if not otp_record:
            return Response(
                {"error": "No verification request found for this email. Please request a code first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_record.attempts >= 5:
            return Response(
                {"error": "Too many failed attempts. Please request a new verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_record.is_otp_expired():
            return Response(
                {"error": "Verification code has expired. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_record.otp != otp:
            otp_record.attempts += 1
            otp_record.save(update_fields=["attempts"])
            remaining = 5 - otp_record.attempts
            return Response(
                {"error": f"Invalid verification code. {remaining} attempt(s) remaining."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp_record.is_verified = True
        otp_record.verified_at = timezone.now()
        otp_record.attempts = 0
        otp_record.save(update_fields=["is_verified", "verified_at", "attempts"])

        return Response(
            {
                "message": "Official email successfully verified!",
                "is_verified": True,
                "email": email,
            },
            status=status.HTTP_200_OK,
        )


class SalonResendEmailOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SalonSendEmailOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        otp_record = SalonEmailOTP.objects.filter(email=email).first()
        if otp_record and (timezone.now() - otp_record.created_at).total_seconds() < 30:
            remaining = int(30 - (timezone.now() - otp_record.created_at).total_seconds())
            return Response(
                {"error": f"Please wait {remaining} seconds before requesting another code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        otp = f"{secrets.randbelow(900000) + 100000}"
        if not otp_record:
            otp_record = SalonEmailOTP(email=email)

        otp_record.otp = otp
        otp_record.attempts = 0
        otp_record.is_verified = False
        otp_record.verified_at = None
        otp_record.save()

        sent = send_salon_email_otp(email, otp)
        if not sent:
            return Response(
                {"error": "Failed to send verification code. Please check your email address and try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "message": f"A new 6-digit verification code has been sent to {email}.",
                "email": email,
            },
            status=status.HTTP_200_OK,
        )


class SalonCreateView(generics.CreateAPIView):
    serializer_class = SalonSerializer
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def create(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if "cover_image" in request.FILES:
            data["cover_image"] = request.FILES["cover_image"]
        if "images" in request.FILES:
            data["images"] = request.FILES.getlist("images")

        serializer = self.get_serializer(data=data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        # Enforce email verification
        email = (serializer.validated_data.get("email") or data.get("email", "")).strip().lower()
        if email:
            is_authenticated_owner = (
                request.user.is_authenticated
                and getattr(request.user, "email", "").lower() == email
            )
            if not is_authenticated_owner:
                otp_record = SalonEmailOTP.objects.filter(email__iexact=email).first()
                if not otp_record or not otp_record.is_verification_valid():
                    return Response(
                        {
                            "email": [
                                "Official contact email must be verified with an OTP before submitting the salon application."
                            ]
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        else:
            return Response(
                {"email": ["Official contact email is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        owner = None
        if request.user.is_authenticated and getattr(request.user, "role", None) == "OWNER":
            owner = request.user

        salon = serializer.save(
            owner=owner,
            approval_status=Salon.ApprovalStatus.PENDING,
        )


        # Synchronize services into SalonService model
        sync_salon_services(salon, salon.services)

        try:
            from notifications.services import notify_salon_created
            notify_salon_created(salon)
        except Exception:
            pass

        headers = self.get_success_headers(serializer.data)
        return Response(
            {
                "message": (
                    "Salon application submitted successfully! Our super admin team "
                    "will review your venue details within 24-48 hours. Once approved, "
                    "login credentials will be emailed to your official email."
                ),
                "salon": SalonSerializer(salon, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
            headers=headers,
        )


class SalonResubmitDataView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request, pk):
        try:
            salon = Salon.objects.get(pk=pk)
        except Salon.DoesNotExist:
            return Response(
                {"error": "Salon not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Resubmission links are strictly one-time and expire once the salon is resubmitted
        if salon.approval_status != Salon.ApprovalStatus.REJECTED:
            if salon.approval_status == Salon.ApprovalStatus.PENDING:
                return Response(
                    {
                        "error": (
                            "This resubmission link has expired because your application has already "
                            "been resubmitted and is currently pending review by our Super Admin team."
                        ),
                        "status_code": "ALREADY_SUBMITTED",
                        "salon_name": salon.name,
                    },
                    status=status.HTTP_410_GONE,
                )
            elif salon.approval_status == Salon.ApprovalStatus.APPROVED:
                return Response(
                    {
                        "error": "This salon has already been approved! You can log in to your owner dashboard.",
                        "status_code": "ALREADY_APPROVED",
                        "salon_name": salon.name,
                    },
                    status=status.HTTP_410_GONE,
                )
            else:
                return Response(
                    {
                        "error": "This resubmission link is no longer active.",
                        "status_code": "LINK_INACTIVE",
                        "salon_name": salon.name,
                    },
                    status=status.HTTP_410_GONE,
                )

        token = request.query_params.get("token")
        is_owner = request.user.is_authenticated and salon.owner == request.user
        is_admin = request.user.is_authenticated and (
            getattr(request.user, "role", None) == "ADMIN"
            or request.user.is_superuser
            or request.user.is_staff
        )
        is_valid_token = token and verify_salon_resubmit_token(salon, token)

        if not (is_valid_token or is_owner or is_admin):
            return Response(
                {"error": "Invalid or expired resubmission link. Please use the link sent to your email."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SalonSerializer(salon, context={"request": request})
        return Response(serializer.data)


class SalonResubmitView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def post(self, request, pk):
        try:
            salon = Salon.objects.get(pk=pk)
        except Salon.DoesNotExist:
            return Response(
                {"error": "Salon not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if salon.approval_status != Salon.ApprovalStatus.REJECTED:
            return Response(
                {
                    "error": (
                        "This application cannot be resubmitted because it is no longer in rejected status "
                        f"(current status: {salon.approval_status.lower()})."
                    ),
                    "status_code": "NOT_REJECTED",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        token = request.query_params.get("token") or request.data.get("token")
        is_owner = request.user.is_authenticated and salon.owner == request.user
        is_admin = request.user.is_authenticated and (
            getattr(request.user, "role", None) == "ADMIN"
            or request.user.is_superuser
            or request.user.is_staff
        )
        is_valid_token = token and verify_salon_resubmit_token(salon, token)

        if not (is_valid_token or is_owner or is_admin):
            return Response(
                {"error": "Invalid or expired resubmission token."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if "cover_image" in request.FILES:
            data["cover_image"] = request.FILES["cover_image"]
        if "images" in request.FILES:
            data["images"] = request.FILES.getlist("images")

        serializer = SalonSerializer(
            salon,
            data=data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        updated_salon = serializer.save(approval_status=Salon.ApprovalStatus.PENDING)

        return Response(
            {
                "message": (
                    "Application updated and resubmitted successfully! Our super admin team "
                    "will re-review your updated details."
                ),
                "salon": SalonSerializer(updated_salon, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request, pk):
        return self.post(request, pk)


class AdminDashboardStatsView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        total_users = User.objects.filter(role=User.Role.CUSTOMER).count()
        total_salons = Salon.objects.count()
        pending_salons = Salon.objects.filter(
            approval_status=Salon.ApprovalStatus.PENDING
        ).count()
        approved_salons = Salon.objects.filter(
            approval_status=Salon.ApprovalStatus.APPROVED
        ).count()
        rejected_salons = Salon.objects.filter(
            approval_status=Salon.ApprovalStatus.REJECTED
        ).count()
        blocked_salons = Salon.objects.filter(
            approval_status=Salon.ApprovalStatus.BLOCKED
        ).count()

        return Response(
            {
                "registered_users": total_users,
                "active_salons": approved_salons,
                "pending_salons": pending_salons,
                "rejected_salons": rejected_salons,
                "blocked_salons": blocked_salons,
                "total_salons": total_salons,
                "month_bookings": 1280,
                "completed_sessions": 32500,
                "platform_gmv": "₹45,20,000",
            }
        )


class AdminSalonListView(generics.ListAPIView):
    serializer_class = SalonSerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        queryset = Salon.objects.all().order_by("-created_at")
        status_param = self.request.query_params.get("status")
        search = self.request.query_params.get("search") or self.request.query_params.get("q")
        category = self.request.query_params.get("category")
        ordering = self.request.query_params.get("ordering")
        
        if status_param and status_param.lower() != "all":
            queryset = queryset.filter(approval_status=status_param.upper())

        if category and category.lower() != "all":
            queryset = queryset.filter(category__iexact=category)

        if search:
            search = search.strip()
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(city__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
                | Q(category__icontains=search)
            )

        if ordering:
            allowed_orderings = ["-created_at", "created_at", "name", "-name", "city", "-city"]
            if ordering in allowed_orderings:
                queryset = queryset.order_by(ordering)

        return queryset


class AdminSalonDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SalonSerializer
    permission_classes = [IsAdminUserRole]
    queryset = Salon.objects.all()


class SalonApprovalView(generics.UpdateAPIView):
    serializer_class = SalonSerializer
    permission_classes = [IsAdminUserRole]
    queryset = Salon.objects.all()
    http_method_names = ["patch", "post"]

    def patch(self, request, *args, **kwargs):
        return self._process_decision(request)

    def post(self, request, *args, **kwargs):
        return self._process_decision(request)

    def _process_decision(self, request):
        salon = self.get_object()
        approval_status = request.data.get("approval_status")
        admin_notes = request.data.get("admin_notes", "")

        allowed_statuses = [
            Salon.ApprovalStatus.APPROVED,
            Salon.ApprovalStatus.REJECTED,
            Salon.ApprovalStatus.PENDING,
            Salon.ApprovalStatus.BLOCKED,
        ]

        if approval_status not in allowed_statuses:
            return Response(
                {"error": "Status must be APPROVED, REJECTED, PENDING, or BLOCKED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        temp_password = None
        owner_created = False
        email_sent = False

        if approval_status == Salon.ApprovalStatus.APPROVED:
            # Handle owner account creation if not yet linked
            if not salon.owner and salon.email:
                user = User.objects.filter(email__iexact=salon.email).first()
                if not user:

                    characters = string.ascii_letters + string.digits + "@#$!%&*"
                    temp_password = ''.join(secrets.choice(characters) for _ in range(8))

                    user = User.objects.create_user(
                        email=salon.email.lower().strip(),
                        password=temp_password,
                        first_name=salon.name[:30],
                        role=User.Role.OWNER,
                        is_active=True,
                    )
                    user.must_change_password = True
                    user.save(update_fields=["must_change_password"])
                    owner_created = True
                else:
                    if user.role != User.Role.OWNER:
                        user.role = User.Role.OWNER
                        user.save(update_fields=["role"])

                salon.owner = user
            elif salon.owner:
                # If owner was already set, ensure role is OWNER
                if salon.owner.role != User.Role.OWNER:
                    salon.owner.role = User.Role.OWNER
                    salon.owner.save(update_fields=["role"])

            salon.approval_status = Salon.ApprovalStatus.APPROVED
            if admin_notes:
                salon.admin_notes = admin_notes
            salon.save()

            # Synchronize services into SalonService model
            sync_salon_services(salon, salon.services)

            # Dispatch notification email with credentials
            if salon.email:
                if not temp_password:
                    temp_password = "Use your existing account password"
                email_sent = send_salon_approval_email(salon, temp_password)

        elif approval_status == Salon.ApprovalStatus.REJECTED:
            salon.approval_status = Salon.ApprovalStatus.REJECTED
            if admin_notes:
                salon.admin_notes = admin_notes
            salon.save()

            if salon.email:
                email_sent = send_salon_rejection_email(salon, admin_notes)

        elif approval_status == Salon.ApprovalStatus.BLOCKED:
            salon.approval_status = Salon.ApprovalStatus.BLOCKED
            if admin_notes:
                salon.admin_notes = admin_notes
            salon.save()

        elif approval_status == Salon.ApprovalStatus.PENDING:
            salon.approval_status = Salon.ApprovalStatus.PENDING
            if admin_notes:
                salon.admin_notes = admin_notes
            salon.save()

        serializer = self.get_serializer(salon)
        return Response(
            {
                "message": (
                    f"Salon {salon.name} status updated to {approval_status.lower()} successfully."
                ),
                "salon": serializer.data,
                "email_sent": email_sent,
                "temp_password": temp_password or "Send through Email",
            }
        )


class PendingSalonListView(generics.ListAPIView):
    serializer_class = SalonSerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        return Salon.objects.filter(
            approval_status=Salon.ApprovalStatus.PENDING
        ).order_by("-created_at")


class ApprovedSalonListView(generics.ListAPIView):
    serializer_class = SalonSerializer
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get_queryset(self):
        status_param = self.request.query_params.get("status")
        if status_param == "all":
            return Salon.objects.all().order_by("-created_at")

        approved = Salon.objects.filter(
            approval_status=Salon.ApprovalStatus.APPROVED
        )
        if approved.exists():
            return approved.order_by("-created_at")
        # Fallback for preview/testing before admin approval
        return Salon.objects.all().order_by("-created_at")


class OwnerDashboardView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request):
        user = request.user
        salon = None
        salon_id = request.query_params.get("salon_id")
        if salon_id:
            salon = Salon.objects.filter(pk=salon_id).first()
        elif user and user.is_authenticated:
            salon = get_owner_salon(user)
            if not salon and (getattr(user, "role", None) in ["ADMIN", "OWNER"] or user.is_superuser or user.is_staff):
                salon = Salon.objects.filter(approval_status=Salon.ApprovalStatus.APPROVED).first() or Salon.objects.first()

        salon_name = salon.name if salon else ""
        salon_city = salon.city if salon else ""
        salon_category = salon.category if salon else ""
        outlet_code = f"#{salon.id:02d}" if salon else "#04"

        staff_on_duty = [ ]
        if salon:
            real_workers = (
                WorkerProfile.objects
                .filter(salon=salon)
                .select_related("user")
                .annotate(booked_count=Count("assigned_bookings"))
            )
            from reviews.models import WorkerReview
            staff_on_duty = []
            for idx, w in enumerate(real_workers, start=1):
                full_name = f"{w.user.first_name} {w.user.last_name}".strip() or w.user.email.split("@")[0].title()
                w_agg = WorkerReview.objects.filter(worker=w).aggregate(avg=Avg('rating'), count=Count('id'))
                w_rating = round(float(w_agg['avg']), 1) if w_agg['avg'] is not None else 5.0
                w_reviews_count = w_agg['count'] or 0
                staff_on_duty.append({
                    "id": w.id,
                    "worker_id": w.id,
                    "name": full_name,
                    "station": w.station or f"Station {idx:02d}",
                    "role": w.specialization or "Stylist",
                    "rating": w_rating,
                    "reviews_count": w_reviews_count,
                    "booked_count": w.booked_count,
                    "avatar": build_full_media_url(request, w.profile_photo) if w.profile_photo else "",
                    "is_active": w.is_active,
                    "phone": w.phone_number,
                    "experience": w.experience,
                })

        popular_services = []
        if salon:
            try:
                from services.models import SalonService
                salon_services_qs = SalonService.objects.filter(salon=salon, is_active=True).select_related("service", "service__category")
                if salon_services_qs.exists():
                    total_count = salon_services_qs.count()
                    pct = 100 // min(total_count, 5)
                    for idx, ss in enumerate(salon_services_qs[:5], start=1):
                        cat_name = getattr(ss.service.category, "name", "").lower() if ss.service and ss.service.category else ""
                        icon = "✂" if "hair" in cat_name else ("💆" if "skin" in cat_name or "facial" in cat_name else ("🌿" if "spa" in cat_name else "✨"))
                        popular_services.append({
                            "id": ss.id,
                            "name": ss.effective_name,
                            "icon": icon,
                            "bookings": 0,
                            "contribution_pct": pct,
                            "avg_price": f"₹{int(ss.price)}",
                        })
            except Exception:
                pass

        if not popular_services:
            popular_services = [
                {
                    "id": 1,
                    "name": "Haircut & Styling",
                    "icon": "scissors",
                    "bookings": 32,
                    "contribution_pct": 58,
                    "avg_price": "₹450",
                },
            ]

        today = timezone.localdate()
        today_schedule = []
        all_bookings = []

        total_bookings_count = 0
        today_bookings_count = 0
        total_revenue = 0
        completed_count = 0
        cancelled_count = 0
        upcoming_count = 0

        if salon:
            salon_bookings = (
                Booking.objects
                .filter(salon=salon)
                .select_related("worker", "worker__user", "service")
                .order_by("-booking_date", "-start_time", "-booking_time")
            )
            total_bookings_count = salon_bookings.count()
            completed_count = salon_bookings.filter(status=Booking.Status.COMPLETED).count()
            cancelled_count = salon_bookings.filter(status=Booking.Status.CANCELLED).count()
            upcoming_count = salon_bookings.filter(
                status__in=[Booking.Status.CONFIRMED, Booking.Status.PENDING, Booking.Status.IN_PROGRESS]
            ).count()

            revenue_agg = salon_bookings.filter(
                Q(status=Booking.Status.COMPLETED) | Q(payment_status="PAID")
            ).aggregate(total=Sum("service_price"))
            total_revenue = revenue_agg["total"] or 0

            wallet_data = None
            try:
                from payments.models import OwnerWallet
                wallet = OwnerWallet.get_or_create_for_salon(salon)
                if wallet.total_completed_services > 0 or wallet.total_collected > 0:
                    total_revenue = wallet.total_completed_services or wallet.total_collected
                wallet_data = {
                    "balance": str(wallet.balance),
                    "total_collected": str(wallet.total_collected),
                    "total_advances": str(wallet.total_advances),
                    "total_completed_services": str(wallet.total_completed_services),
                    "total_worker_payout": str(wallet.total_worker_payout),
                    "total_refunded": str(wallet.total_refunded),
                }
                
            except Exception:
                pass

            today_qs = (
                salon_bookings
                .filter(booking_date=today)
                .order_by("start_time", "booking_time")
            )
            today_bookings_count = today_qs.count()

            for b in today_qs:
                worker_name = "Any Available"
                if b.worker and b.worker.user:
                    worker_name = b.worker.user.get_full_name() or b.worker.user.email.split("@")[0].title()

                time_val = b.booking_time
                period_val = "AM"
                if b.start_time:
                    time_val = b.start_time.strftime("%I:%M").lstrip("0")
                    period_val = b.start_time.strftime("%p")
                elif b.booking_time:
                    parts = b.booking_time.split(" ")
                    time_val = parts[0]
                    if len(parts) > 1:
                        period_val = parts[1]

                status_type = b.status.lower().replace("_", "-")
                if b.status == Booking.Status.CONFIRMED:
                    action_label = "Seat Client"
                elif b.status == Booking.Status.IN_PROGRESS:
                    action_label = "Complete Session"
                elif b.status == Booking.Status.PENDING:
                    action_label = "Confirm"
                elif b.status == Booking.Status.COMPLETED:
                    action_label = "Completed"
                else:
                    action_label = b.get_status_display()

                today_schedule.append({
                    "id": b.id,
                    "time": time_val,
                    "period": period_val,
                    "booking_time": b.booking_time,
                    "start_time": str(b.start_time) if b.start_time else "",
                    "end_time": str(b.end_time) if b.end_time else "",
                    "client_name": b.client_name,
                    "client_phone": b.client_phone,
                    "client_email": b.client_email,
                    "station": b.station or (b.worker.station if b.worker else "Station 01"),
                    "stylist": worker_name,
                    "worker_id": b.worker_id,
                    "service": b.service_name,
                    "duration": b.duration or "45 mins",
                    "price": f"₹{int(b.service_price)}",
                    "status": b.get_status_display(),
                    "raw_status": b.status,
                    "status_type": status_type,
                    "action_label": action_label,
                    "payment_method": b.payment_method,
                    "payment_status": b.payment_status,
                    "notes": b.notes,
                })

            for b in salon_bookings:
                worker_name = "Any Available"
                worker_photo = ""
                if b.worker and b.worker.user:
                    worker_name = b.worker.user.get_full_name() or b.worker.user.email.split("@")[0].title()
                    if b.worker.profile_photo:
                        worker_photo = build_full_media_url(request, b.worker.profile_photo)

                time_val = b.booking_time
                period_val = "AM"
                if b.start_time:
                    time_val = b.start_time.strftime("%I:%M").lstrip("0")
                    period_val = b.start_time.strftime("%p")
                elif b.booking_time:
                    parts = b.booking_time.split(" ")
                    time_val = parts[0]
                    if len(parts) > 1:
                        period_val = parts[1]

                status_type = b.status.lower().replace("_", "-")
                if b.status == Booking.Status.CONFIRMED:
                    action_label = "Seat Client"
                elif b.status == Booking.Status.IN_PROGRESS:
                    action_label = "Complete Session"
                elif b.status == Booking.Status.PENDING:
                    action_label = "Confirm"
                elif b.status == Booking.Status.COMPLETED:
                    action_label = "Completed"
                else:
                    action_label = b.get_status_display()

                all_bookings.append({
                    "id": b.id,
                    "time": time_val,
                    "period": period_val,
                    "client_name": b.client_name,
                    "client_phone": b.client_phone,
                    "client_email": b.client_email,
                    "stylist": worker_name,
                    "worker_name": worker_name,
                    "worker_id": b.worker_id,
                    "worker_photo": worker_photo,
                    "service": b.service_name,
                    "service_name": b.service_name,
                    "service_price": float(b.service_price),
                    "price": f"₹{int(b.service_price)}",
                    "booking_date": str(b.booking_date),
                    "booking_time": b.booking_time,
                    "start_time": str(b.start_time) if b.start_time else "",
                    "end_time": str(b.end_time) if b.end_time else "",
                    "duration": b.duration,
                    "station": b.station or (b.worker.station if b.worker else "Station 01"),
                    "status": b.get_status_display(),
                    "raw_status": b.status,
                    "status_type": status_type,
                    "action_label": action_label,
                    "status_display": b.get_status_display(),
                    "payment_method": b.payment_method,
                    "payment_status": b.payment_status,
                    "notes": b.notes,
                    "created_at": b.created_at.isoformat() if b.created_at else None,
                })

            # Dynamic Reviews & Ratings for Salon Owner
            reviews_data = []
            worker_reviews_data = []
            salon_rating = 5.0
            salon_reviews_count = 0
            rating_breakdown = {5: {"count": 0, "percentage": 0}, 4: {"count": 0, "percentage": 0}, 3: {"count": 0, "percentage": 0}, 2: {"count": 0, "percentage": 0}, 1: {"count": 0, "percentage": 0}}

            if salon:
                salon_reviews_qs = SalonReview.objects.filter(salon=salon).select_related('customer', 'booking').order_by('-created_at')
                salon_agg = salon_reviews_qs.aggregate(avg=Avg('rating'), count=Count('id'))
                salon_reviews_count = salon_agg['count'] or 0
                if salon_reviews_count > 0 and salon_agg['avg'] is not None:
                    salon_rating = round(float(salon_agg['avg']), 2)

                breakdown = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
                for r in salon_reviews_qs:
                    if r.rating in breakdown:
                        breakdown[r.rating] += 1

                for star in range(1, 6):
                    cnt = breakdown[star]
                    pct = round((cnt / salon_reviews_count * 100)) if salon_reviews_count > 0 else 0
                    rating_breakdown[star] = {"count": cnt, "percentage": pct}

                for r in salon_reviews_qs:
                    author_name = r.customer.get_full_name() or r.customer.email.split("@")[0].title()
                    initial = (r.customer.get_full_name() or r.customer.email or "C")[0].upper()
                    photo_url = build_full_media_url(request, getattr(r.customer, 'profile_photo', None)) if getattr(r.customer, 'profile_photo', None) else ""
                    treatment = r.booking.service_name if r.booking else "Salon Service"
                    reviews_data.append({
                        "id": r.id,
                        "author": author_name,
                        "customer_name": author_name,
                        "customer_email": r.customer.email,
                        "initial": initial,
                        "avatar": photo_url,
                        "rating": r.rating,
                        "comment": r.comment,
                        "treatment": treatment,
                        "booking_id": r.booking_id,
                        "date": r.created_at.strftime("%b %d, %Y"),
                        "created_at": r.created_at.isoformat(),
                    })

                worker_reviews_qs = WorkerReview.objects.filter(salon=salon).select_related('customer', 'worker', 'worker__user', 'booking').order_by('-created_at')
                for wr in worker_reviews_qs:
                    c_name = wr.customer.get_full_name() or wr.customer.email.split("@")[0].title()
                    w_name = wr.worker.user.get_full_name() or wr.worker.user.email.split("@")[0].title() if wr.worker and wr.worker.user else "Specialist"
                    treatment = wr.booking.service_name if wr.booking else "Specialist Service"
                    worker_reviews_data.append({
                        "id": wr.id,
                        "worker_id": wr.worker_id,
                        "worker_name": w_name,
                        "author": c_name,
                        "customer_name": c_name,
                        "rating": wr.rating,
                        "comment": wr.comment,
                        "treatment": treatment,
                        "booking_id": wr.booking_id,
                        "date": wr.created_at.strftime("%b %d, %Y"),
                        "created_at": wr.created_at.isoformat(),
                    })

        data = {
            "salon_info": {
                "id": salon.id if salon else 1,
                "name": salon_name,
                "city": salon_city,
                "category": salon_category,
                "outlet_code": outlet_code,
                "is_open": True,
                "approval_status": salon.approval_status if salon else "APPROVED",
            },
            "kpi_stats": {
                "bookings": {"value": total_bookings_count, "trend": f"{today_bookings_count} today", "trend_type": "positive"},
                "revenue": {"value": int(total_revenue), "formatted": f"₹{int(total_revenue):,}", "trend": "Accrued Revenue", "trend_type": "positive"},
                "completed": {"value": completed_count, "trend": f"{completed_count} completed", "trend_type": "positive"},
                "cancelled": {"value": cancelled_count, "trend": f"{cancelled_count} cancelled", "trend_type": "warning" if cancelled_count > 0 else "positive"},
                "upcoming": {"value": upcoming_count, "trend": f"{upcoming_count} active slots", "trend_type": "positive"},
                "rating": {"value": f"{salon_rating}★", "numeric": salon_rating, "trend": f"{salon_reviews_count} reviews", "trend_type": "positive"},
            },
            "rating": salon_rating,
            "reviews_count": salon_reviews_count,
            "rating_breakdown": rating_breakdown,
            "reviews": reviews_data,
            "worker_reviews": worker_reviews_data,
            "today_schedule": today_schedule,
            "all_bookings": all_bookings,
            "staff_on_duty": staff_on_duty,
            "revenue_progression": {
                "peak_window": "11 AM - 1 PM",
                "daily_accrued": f"₹{int(total_revenue):,}",
                "target": "₹12,000",
                "hours": [
                    {"time": "9 AM", "amount": 650, "height_pct": 35, "is_peak": False, "pos_amount": 450, "online_amount": 200},
                    {"time": "10 AM", "amount": 1400, "height_pct": 60, "is_peak": False, "pos_amount": 900, "online_amount": 500},
                    {"time": "11 AM", "amount": 2600, "height_pct": 95, "is_peak": True, "pos_amount": 1800, "online_amount": 800},
                    {"time": "12 PM", "amount": 2100, "height_pct": 82, "is_peak": False, "pos_amount": 1400, "online_amount": 700},
                    {"time": "1 PM", "amount": 1100, "height_pct": 50, "is_peak": False, "pos_amount": 700, "online_amount": 400},
                    {"time": "2 PM", "amount": 600, "height_pct": 25, "is_peak": False, "pos_amount": 400, "online_amount": 200},
                ],
            },
            "popular_services": popular_services,
            "wallet": wallet_data,
        }
        return Response(data)


class OwnerBookingsView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        user = request.user
        salon = get_owner_salon(user)
        if not salon:
            return Response({"error": "No salon found for this owner."}, status=status.HTTP_404_NOT_FOUND)

        bookings_qs = (
            Booking.objects
            .filter(salon=salon)
            .select_related("worker", "worker__user", "service", "customer")
            .order_by("-booking_date", "-start_time", "-booking_time")
        )

        worker_id = request.query_params.get("worker_id")
        if worker_id and worker_id != "all":
            bookings_qs = bookings_qs.filter(worker_id=worker_id)

        booking_status = request.query_params.get("status")
        if booking_status and booking_status != "all":
            bookings_qs = bookings_qs.filter(status=booking_status.upper())

        date_filter = request.query_params.get("date")
        if date_filter and date_filter != "all":
            today = timezone.localdate()
            if date_filter == "today":
                bookings_qs = bookings_qs.filter(booking_date=today)
            elif date_filter == "tomorrow":
                bookings_qs = bookings_qs.filter(booking_date=today + timedelta(days=1))
            elif date_filter == "week":
                bookings_qs = bookings_qs.filter(
                    booking_date__gte=today,
                    booking_date__lte=today + timedelta(days=7),
                )
            else:
                try:
                    from datetime import datetime
                    parsed_d = datetime.strptime(date_filter, "%Y-%m-%d").date()
                    bookings_qs = bookings_qs.filter(booking_date=parsed_d)
                except Exception:
                    pass

        search_q = request.query_params.get("search", "").strip()
        if search_q:
            bookings_qs = bookings_qs.filter(
                Q(client_name__icontains=search_q)
                | Q(client_phone__icontains=search_q)
                | Q(client_email__icontains=search_q)
                | Q(service_name__icontains=search_q)
                | Q(worker__user__first_name__icontains=search_q)
                | Q(worker__user__last_name__icontains=search_q)
            )

        serializer = BookingSerializer(bookings_qs, many=True)
        return Response({
            "count": bookings_qs.count(),
            "bookings": serializer.data,
        })


class OwnerSalonProfileView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    serializer_class = SalonSerializer

    def get(self, request):
        try:
            salon = get_owner_salon(request.user)
            if not salon:
                return Response(
                    {"error": "No registered salon found for your account."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            serializer = SalonSerializer(salon, context={"request": request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            import logging, traceback
            logging.getLogger(__name__).error(f"Error fetching salon profile: {e}\n{traceback.format_exc()}")
            return Response(
                {"error": f"Failed to retrieve salon profile: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def patch(self, request):
        try:
            salon = get_owner_salon(request.user)
            if not salon:
                return Response(
                    {"error": "No registered salon found for your account."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
            if "cover_image" in request.FILES:
                data["cover_image"] = request.FILES["cover_image"]
            if "images" in request.FILES:
                data["images"] = request.FILES.getlist("images")

            serializer = SalonSerializer(salon, data=data, partial=True, context={"request": request})
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            updated_salon = serializer.save()

            if "services" in data and data["services"]:
                try:
                    sync_salon_services(updated_salon, updated_salon.services)
                except Exception as sync_err:
                    import logging
                    logging.getLogger(__name__).warning(f"Services sync warning: {sync_err}")

            return Response(
                {
                    "message": "Salon profile updated successfully!",
                    "salon": SalonSerializer(updated_salon, context={"request": request}).data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            import logging, traceback
            logging.getLogger(__name__).error(f"Error updating salon profile: {e}\n{traceback.format_exc()}")
            return Response(
                {"error": f"Failed to update salon profile: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def put(self, request):
        return self.patch(request)


class OwnerQuickWalkInView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def post(self, request):
        client_name = request.data.get("client_name", "").strip()
        service = request.data.get("service", "Haircut & Styling").strip()
        stylist = request.data.get("stylist", "Rahul").strip()
        station = request.data.get("station", "Station 01").strip()
        duration = request.data.get("duration", "45 mins").strip()
        phone = request.data.get("phone", "").strip()

        if not client_name:
            return Response(
                {"error": "Client name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        salon = get_owner_salon(request.user) if (request.user and request.user.is_authenticated) else Salon.objects.first()

        worker = None
        if salon:
            worker = WorkerProfile.objects.filter(
                Q(salon=salon) & (
                    Q(user__first_name__icontains=stylist)
                    | Q(user__last_name__icontains=stylist)
                    | Q(specialization__icontains=stylist)
                )
            ).first()
            if not worker:
                worker = WorkerProfile.objects.filter(salon=salon).first()

        booking = None
        if salon:
            try:
                booking = Booking.objects.create(
                    salon=salon,
                    worker=worker,
                    client_name=client_name,
                    client_phone=phone,
                    service_name=service,
                    booking_date=timezone.localdate(),
                    booking_time=timezone.now().strftime("%I:%M %p"),
                    duration=duration,
                    station=station,
                    status=Booking.Status.IN_PROGRESS,
                    notes="Walk-in registered by salon owner",
                )
            except Exception:
                pass

        walk_in = {
            "id": booking.id if booking else int(timezone.now().timestamp()),
            "time": timezone.now().strftime("%I:%M %p"),
            "client_name": client_name,
            "station": station,
            "stylist": stylist,
            "service": service,
            "duration": duration,
            "status": "In Progress",
            "action_label": "Check In",
        }
        return Response(
            {
                "message": f"Walk-in for {client_name} registered successfully!",
                "appointment": walk_in,
            },
            status=status.HTTP_201_CREATED,
        )


class OwnerWorkerListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        user = request.user
        salon = get_owner_salon(user)
        is_owner_or_admin = (
            getattr(user, "role", None) in ["OWNER", "ADMIN"]
            or user.is_superuser
            or user.is_staff
            or (salon and salon.owner == user)
        )
        if not is_owner_or_admin:
            return Response(
                {"error": "Access denied. Only salon owners can view workers."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not salon:
            return Response(
                {"error": "No registered salon found for this account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workers = (
            WorkerProfile.objects.filter(salon=salon)
            .select_related("user", "salon")
            .order_by("-created_at")
        )

        query = request.query_params.get("q", "").strip()
        if query:
            workers = workers.filter(
                Q(user__first_name__icontains=query)
                | Q(user__last_name__icontains=query)
                | Q(user__email__icontains=query)
                | Q(phone_number__icontains=query)
                | Q(specialization__icontains=query)
            )

        serializer = WorkerProfileSerializer(workers, many=True, context={"request": request})
        return Response({
            "workers": serializer.data,
            "count": workers.count(),
            "salon": {
                "id": salon.id,
                "name": salon.name,
                "city": salon.city,
                "services": salon.services or [],
            },
        }, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        salon = get_owner_salon(user)
        is_owner_or_admin = (
            getattr(user, "role", None) in ["OWNER", "ADMIN"]
            or user.is_superuser
            or user.is_staff
            or (salon and salon.owner == user)
        )
        if not is_owner_or_admin:
            return Response(
                {"error": "Access denied. Only salon owners can create worker accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not salon:
            return Response(
                {"error": "Cannot add worker: You do not have an approved or registered salon."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Create worker: owner and salon are assigned strictly by the backend
        serializer = WorkerCreateSerializer(
            data=request.data,
            context={"salon": salon, "request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        worker = serializer.save()
        temp_pwd = getattr(worker, "_temporary_password", "Worker@123")

        # Send worker ID and password through email
        email_sent = False
        try:
            email_sent = send_worker_credentials_email(
                worker=worker,
                temp_password=temp_pwd,
                salon=salon,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to dispatch worker email: {e}")

        worker_data = WorkerProfileSerializer(worker, context={"request": request}).data

        return Response(
            {
                "message": "Worker created successfully! Login credentials have been sent via email.",
                "worker": worker_data,
                "email_sent": email_sent,
                "credentials": {
                    "email": worker.user.email,
                    "password": temp_pwd,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class OwnerWorkerDetailView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get_salon_worker(self, user, pk):
        salon = get_owner_salon(user)
        if not salon:
            return None, None
        worker = (
            WorkerProfile.objects.filter(pk=pk, salon=salon)
            .select_related("user", "salon")
            .first()
        )
        return salon, worker

    def get(self, request, pk):
        _, worker = self.get_salon_worker(request.user, pk)
        if not worker:
            return Response({"error": "Worker not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = WorkerProfileSerializer(worker, context={"request": request})
        return Response(serializer.data)

    def patch(self, request, pk):
        _, worker = self.get_salon_worker(request.user, pk)
        if not worker:
            return Response({"error": "Worker not found."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if "specialization" in data:
            worker.specialization = data["specialization"].strip()
        if "experience" in data:
            worker.experience = data["experience"].strip()
        if "phone_number" in data:
            worker.phone_number = data["phone_number"].strip()
        if "station" in data:
            worker.station = data["station"].strip()
        if "employment_status" in data:
            worker.employment_status = data["employment_status"].strip()
        if "bio" in data:
            worker.bio = data["bio"].strip()
        if "specializations" in data:
            worker.specializations = data["specializations"]
        if "assigned_services" in data:
            worker.assigned_services = data["assigned_services"]
        if "shift_hours" in data:
            worker.shift_hours = data["shift_hours"]
        if "commission_tier" in data:
            worker.commission_tier = data["commission_tier"].strip()
        if "is_active" in data:
            worker.is_active = bool(data["is_active"])
            worker.user.is_active = worker.is_active
            worker.user.save(update_fields=["is_active"])
        if "full_name" in data and data["full_name"]:
            parts = data["full_name"].strip().split(" ", 1)
            worker.user.first_name = parts[0]
            worker.user.last_name = parts[1] if len(parts) > 1 else ""
            worker.user.save(update_fields=["first_name", "last_name"])
        if "profile_photo" in data and data["profile_photo"]:
            saved = save_image_to_media(data["profile_photo"], subfolder="workers/photos")
            if saved:
                worker.profile_photo = saved

        worker.save()
        serializer = WorkerProfileSerializer(worker, context={"request": request})
        return Response({
            "message": "Worker profile updated successfully.",
            "worker": serializer.data,
        })

    def delete(self, request, pk):
        _, worker = self.get_salon_worker(request.user, pk)
        if not worker:
            return Response({"error": "Worker not found."}, status=status.HTTP_404_NOT_FOUND)

        user = worker.user
        worker.is_active = False
        worker.save(update_fields=["is_active"])
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response({"message": "Worker account deactivated successfully."})


class WorkerDashboardView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        user = request.user
        worker = getattr(user, "worker_profile", None)

        if not worker and (getattr(user, "role", None) in ["ADMIN", "OWNER"] or user.is_superuser or user.is_staff):
            worker_id = request.query_params.get("worker_id")
            if worker_id:
                worker = WorkerProfile.objects.filter(pk=worker_id).first()
            else:
                worker = WorkerProfile.objects.first()

        if not worker:
            return Response(
                {"error": "No worker profile found for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Enforce automatic No-Show rule: if scheduled time has passed and customer did not arrive, mark as NO_SHOW
        from bookings.services import auto_update_no_show_bookings
        auto_update_no_show_bookings(worker=worker)

        bookings_qs = (
            Booking.objects
            .filter(Q(worker=worker) | (Q(salon=worker.salon) & Q(worker__isnull=True)))
            .select_related("salon", "service", "customer")
            .order_by("booking_date", "start_time", "booking_time")
        )
        
        today = timezone.localdate()
        total_count = bookings_qs.count()
        today_count = bookings_qs.filter(booking_date=today).count()
        completed_count = bookings_qs.filter(status=Booking.Status.COMPLETED).count()
        in_progress_count = bookings_qs.filter(status=Booking.Status.IN_PROGRESS).count()
        upcoming_count = bookings_qs.filter(
            status__in=[Booking.Status.CONFIRMED, Booking.Status.PENDING, Booking.Status.IN_PROGRESS]
        ).count()

        settled_rev_agg = bookings_qs.filter(
            Q(status=Booking.Status.COMPLETED) | Q(payment_status="PAID")
        ).aggregate(total=Sum("service_price"))
        settled_earnings = settled_rev_agg["total"] or 0

        serializer = BookingSerializer(bookings_qs, many=True)
        worker_serializer = WorkerProfileSerializer(worker, context={"request": request})

        from reviews.models import WorkerReview
        w_agg = WorkerReview.objects.filter(worker=worker).aggregate(avg=Avg('rating'), count=Count('id'))
        w_rating = round(float(w_agg['avg']), 1) if w_agg['avg'] is not None else 5.0
        w_count = w_agg['count'] or 0

        latest_review = WorkerReview.objects.filter(worker=worker).select_related('customer', 'booking').order_by('-created_at').first()
        latest_review_data = None
        if latest_review:
            latest_review_data = {
                "rating": latest_review.rating,
                "comment": latest_review.comment,
                "author": latest_review.customer.get_full_name() or latest_review.customer.email.split('@')[0].title(),
                "service_name": latest_review.booking.service_name if latest_review.booking else "Specialist Service",
                "date": latest_review.created_at.strftime("%b %d, %Y"),
            }

        return Response({
            "worker": worker_serializer.data,
            "salon": {
                "id": worker.salon.id if worker.salon else None,
                "name": worker.salon.name if worker.salon else "Salon",
                "category": worker.salon.category if worker.salon else "",
                "address": worker.salon.address if worker.salon else "",
                "city": worker.salon.city if worker.salon else "",
                "phone": worker.salon.phone if worker.salon else "",
            },
            "kpi_stats": {
                "total_bookings": total_count,
                "today_bookings": today_count,
                "completed_bookings": completed_count,
                "in_progress_bookings": in_progress_count,
                "upcoming_bookings": upcoming_count,
                "settled_earnings": float(settled_earnings),
                "rating": w_rating,
                "reviews_count": w_count,
            },
            "latest_review": latest_review_data,
            "assigned_bookings": serializer.data,
        })


class WorkerBookingStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def patch(self, request, pk):
        user = request.user
        new_status = request.data.get("status", "").upper()
        new_payment_status = request.data.get("payment_status", "").upper()

        valid_statuses = [choice[0] for choice in Booking.Status.choices]
        if new_status and new_status not in valid_statuses:
            return Response(
                {"error": f"Invalid status. Allowed values: {', '.join(valid_statuses)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking = Booking.objects.filter(pk=pk).first()
        if not booking:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        worker_profile = getattr(user, "worker_profile", None)
        is_worker = bool(
            worker_profile
            and (booking.worker == worker_profile or (booking.salon == worker_profile.salon and booking.worker is None))
        )
        is_owner = getattr(user, "role", None) == "OWNER" and (
            booking.salon.owner == user or get_owner_salon(user) == booking.salon
        )
        is_admin = getattr(user, "role", None) == "ADMIN" or user.is_superuser or user.is_staff

        if not (is_worker or is_owner or is_admin):
            return Response(
                {"error": "Access denied. You do not have permission to update this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if is_worker and not (is_owner or is_admin):
            # Let workers update service progress, but keep payment verification and refunds under owner/admin
            new_payment_status = None

        try:
            with transaction.atomic():
                update_fields = ["updated_at"]
                old_status = booking.status
                if new_status:
                    booking.status = new_status
                    update_fields.append("status")
                    if new_status == Booking.Status.IN_PROGRESS and not booking.service_started_at:
                        booking.service_started_at = timezone.now()
                        update_fields.append("service_started_at")

                # Worker consultation remarks
                worker_remarks = request.data.get("worker_remarks")
                if worker_remarks is not None:
                    booking.worker_remarks = str(worker_remarks).strip()
                    update_fields.append("worker_remarks")

                if new_payment_status:
                    valid_pay_statuses = [choice[0] for choice in Booking.PaymentStatus.choices]
                    if new_payment_status in valid_pay_statuses:
                        booking.payment_status = new_payment_status
                        update_fields.append("payment_status")
                elif new_status == Booking.Status.COMPLETED and booking.payment_method == Booking.PaymentMethod.PAY_AT_SALON:
                    booking.payment_status = Booking.PaymentStatus.PAID
                    update_fields.append("payment_status")

                if is_worker and worker_profile and booking.worker is None and booking.salon == worker_profile.salon:
                    booking.worker = worker_profile
                    if worker_profile.station:
                        booking.station = worker_profile.station
                        update_fields.append("station")
                    update_fields.append("worker")

                booking.save(update_fields=update_fields)

                # Financial ledger sync
                if new_status == Booking.Status.COMPLETED:
                    from payments.services import record_service_completion_and_final_payment
                    record_service_completion_and_final_payment(
                        booking=booking,
                        completed_by_user=request.user,
                    )
                elif new_status == Booking.Status.CANCELLED and old_status != Booking.Status.CANCELLED:
                    from payments.services import process_booking_cancellation_and_refund
                    process_booking_cancellation_and_refund(
                        booking=booking,
                        reason="Booking cancelled by staff",
                        processed_by=request.user,
                    )
        except Exception as fin_err:
            logger.error(
                "Financial ledger sync error in WorkerBookingStatusUpdateView for booking %s: %s",
                pk,
                fin_err,
                exc_info=True,
            )
            return Response(
                {
                    "error": f"Failed to update booking status: financial ledger sync error ({str(fin_err)})",
                    "detail": str(fin_err),
                    "retry_allowed": True,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            from notifications.services import notify_booking_cancelled, notify_refund_completed
            if new_status == Booking.Status.CANCELLED and old_status != Booking.Status.CANCELLED:
                notify_booking_cancelled(booking, cancelled_by=request.user)
            if new_status == "REFUNDED" or new_payment_status == Booking.PaymentStatus.REFUNDED:
                notify_refund_completed(booking)
        except Exception:
            pass

        from bookings.serializers import WorkerAppointmentSerializer
        return Response({
            "message": f"Booking status updated to {booking.status}.",
            "booking": WorkerAppointmentSerializer(booking, context={"request": request}).data,
        })

    def post(self, request, pk):
        return self.patch(request, pk)


class WorkerAppointmentsListView(APIView):
    """
    Dedicated table view of appointments assigned to the authenticated salon worker.
    - Workers only see appointments assigned to them.
    - Automatic No-Show rule: if customer scheduled start time has passed and customer did not arrive,
      backend automatically marks booking as NO_SHOW.
    - Supports search (by booking ID, customer name, customer phone, service name).
    - Supports date filters (all, today, tomorrow, week, custom date, start_date/end_date).
    - Supports status filters (all, confirmed, in_progress, completed, cancelled, no_show).
    - Returns dynamic available actions per booking status according to specs.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        user = request.user
        worker = getattr(user, "worker_profile", None)
        if not worker and (getattr(user, "role", None) in ["ADMIN", "OWNER"] or user.is_superuser or user.is_staff):
            worker_id = request.query_params.get("worker_id")
            if worker_id:
                worker = WorkerProfile.objects.filter(pk=worker_id).first()
            else:
                worker = WorkerProfile.objects.first()

        if not worker:
            return Response(
                {"error": "Access denied. Only registered salon specialists can access worker appointments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 1. Enforce automatic No-Show rule: if scheduled time has passed and customer did not arrive, mark as NO_SHOW
        from bookings.services import auto_update_no_show_bookings
        auto_update_no_show_bookings(worker=worker)

        # 2. Query strictly assigned bookings
        bookings_qs = (
            Booking.objects.filter(worker=worker)
            .select_related("salon", "service", "customer")
            .prefetch_related("services")
        )

        # 3. Status filter
        status_filter = request.query_params.get("status", "").strip().upper()
        if status_filter and status_filter != "ALL":
            bookings_qs = bookings_qs.filter(status=status_filter)

        # 4. Date filter
        date_filter = request.query_params.get("date", "").strip().lower()
        today = timezone.localdate()
        if date_filter == "today":
            bookings_qs = bookings_qs.filter(booking_date=today)
        elif date_filter == "tomorrow":
            bookings_qs = bookings_qs.filter(booking_date=today + timedelta(days=1))
        elif date_filter == "week":
            bookings_qs = bookings_qs.filter(booking_date__gte=today, booking_date__lte=today + timedelta(days=7))
        elif date_filter and date_filter != "all":
            try:
                from datetime import datetime as dt
                parsed_d = dt.strptime(date_filter, "%Y-%m-%d").date()
                bookings_qs = bookings_qs.filter(booking_date=parsed_d)
            except ValueError:
                pass

        start_date = request.query_params.get("start_date", "").strip()
        end_date = request.query_params.get("end_date", "").strip()
        if start_date:
            try:
                from datetime import datetime as dt
                s_d = dt.strptime(start_date, "%Y-%m-%d").date()
                bookings_qs = bookings_qs.filter(booking_date__gte=s_d)
            except ValueError:
                pass
        if end_date:
            try:
                from datetime import datetime as dt
                e_d = dt.strptime(end_date, "%Y-%m-%d").date()
                bookings_qs = bookings_qs.filter(booking_date__lte=e_d)
            except ValueError:
                pass

        # 5. Search filter (booking ID, customer name, customer phone, service name)
        search = request.query_params.get("search", "").strip()
        if search:
            clean_search = search.replace("#", "").replace("BK", "").replace("bk", "").strip()
            q_filter = (
                Q(client_name__icontains=search)
                | Q(client_phone__icontains=search)
                | Q(service_name__icontains=search)
            )
            if clean_search.isdigit():
                q_filter |= Q(id=int(clean_search))
            bookings_qs = bookings_qs.filter(q_filter)

        # 6. Ordering (default: chronological upcoming first if today/future, otherwise descending)
        ordering = request.query_params.get("ordering", "-booking_date")
        if ordering == "date_asc":
            bookings_qs = bookings_qs.order_by("booking_date", "start_time", "booking_time")
        elif ordering == "date_desc":
            bookings_qs = bookings_qs.order_by("-booking_date", "-start_time", "-booking_time")
        else:
            bookings_qs = bookings_qs.order_by("-booking_date", "start_time", "booking_time")

        # 7. Summary counts for UI badges
        base_qs = Booking.objects.filter(worker=worker)
        counts = {
            "all": base_qs.count(),
            "today": base_qs.filter(booking_date=today).count(),
            "confirmed": base_qs.filter(status=Booking.Status.CONFIRMED).count(),
            "in_progress": base_qs.filter(status=Booking.Status.IN_PROGRESS).count(),
            "completed": base_qs.filter(status=Booking.Status.COMPLETED).count(),
            "cancelled": base_qs.filter(status=Booking.Status.CANCELLED).count(),
            "no_show": base_qs.filter(status=Booking.Status.NO_SHOW).count(),
        }

        # 8. Pagination
        from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
        try:
            page_num = int(request.query_params.get("page", 1))
        except (ValueError, TypeError):
            page_num = 1

        try:
            page_size = int(request.query_params.get("page_size", 10))
        except (ValueError, TypeError):
            page_size = 10

        page_size = min(max(page_size, 1), 100)
        paginator = Paginator(bookings_qs, page_size)

        try:
            page_obj = paginator.page(page_num)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages) if paginator.num_pages > 0 else []

        from bookings.serializers import WorkerAppointmentSerializer
        serializer = WorkerAppointmentSerializer(page_obj, many=True, context={"request": request})

        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_num,
            "page_size": page_size,
            "counts": counts,
            "results": serializer.data,
        }, status=status.HTTP_200_OK)


class WorkerAppointmentDetailView(APIView):
    """
    Returns detailed booking info for a specific appointment assigned to the worker.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def get(self, request, pk):
        user = request.user
        worker = getattr(user, "worker_profile", None)
        if not worker and (getattr(user, "role", None) in ["ADMIN", "OWNER"] or user.is_superuser or user.is_staff):
            worker_id = request.query_params.get("worker_id")
            if worker_id:
                worker = WorkerProfile.objects.filter(pk=worker_id).first()
            else:
                worker = WorkerProfile.objects.first()

        if not worker:
            return Response(
                {"error": "Access denied. Only registered salon specialists can access worker appointments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking = Booking.objects.filter(pk=pk).select_related("salon", "service", "customer").prefetch_related("services").first()
        if not booking:
            return Response({"error": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)

        is_owner = getattr(user, "role", None) == "OWNER" and (
            booking.salon.owner == user or get_owner_salon(user) == booking.salon
        )
        is_admin = getattr(user, "role", None) == "ADMIN" or user.is_superuser or user.is_staff
        if booking.worker != worker and not (is_owner or is_admin):
            return Response(
                {"error": "Access denied. You can only view appointments assigned to you."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Auto No-Show check for this specific booking
        from bookings.services import auto_update_no_show_bookings
        auto_update_no_show_bookings(Booking.objects.filter(pk=booking.pk))
        booking.refresh_from_db()

        from bookings.serializers import WorkerAppointmentSerializer
        serializer = WorkerAppointmentSerializer(booking, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        user = request.user
        worker = getattr(user, "worker_profile", None)
        if not worker and (getattr(user, "role", None) in ["ADMIN", "OWNER"] or user.is_superuser or user.is_staff):
            worker_id = request.query_params.get("worker_id")
            if worker_id:
                worker = WorkerProfile.objects.filter(pk=worker_id).first()
            else:
                worker = WorkerProfile.objects.first()

        if not worker:
            return Response(
                {"error": "Access denied."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking = Booking.objects.filter(pk=pk).first()
        if not booking:
            return Response({"error": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)

        is_owner = getattr(user, "role", None) == "OWNER" and (
            booking.salon.owner == user or get_owner_salon(user) == booking.salon
        )
        is_admin = getattr(user, "role", None) == "ADMIN" or user.is_superuser or user.is_staff
        if booking.worker != worker and not (is_owner or is_admin):
            return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

        update_fields = ["updated_at"]
        if "worker_remarks" in request.data:
            booking.worker_remarks = str(request.data["worker_remarks"]).strip()
            update_fields.append("worker_remarks")

        new_status = request.data.get("status", "").upper()

        try:
            with transaction.atomic():
                if new_status:
                    if new_status in [Booking.Status.IN_PROGRESS, Booking.Status.COMPLETED]:
                        booking.status = new_status
                        update_fields.append("status")
                        if new_status == Booking.Status.IN_PROGRESS and not booking.service_started_at:
                            booking.service_started_at = timezone.now()
                            update_fields.append("service_started_at")
                        if new_status == Booking.Status.COMPLETED and booking.payment_method == Booking.PaymentMethod.PAY_AT_SALON:
                            booking.payment_status = Booking.PaymentStatus.PAID
                            update_fields.append("payment_status")

                        booking.save(update_fields=update_fields)

                        if new_status == Booking.Status.COMPLETED:
                            from payments.services import record_service_completion_and_final_payment
                            record_service_completion_and_final_payment(
                                booking=booking,
                                completed_by_user=request.user,
                            )
                    else:
                        booking.status = new_status
                        update_fields.append("status")
                        booking.save(update_fields=update_fields)
                elif len(update_fields) > 1:
                    booking.save(update_fields=update_fields)
        except Exception as fin_err:
            logger.error(
                "Financial ledger sync error in WorkerAppointmentDetailView for booking %s: %s",
                pk,
                fin_err,
                exc_info=True,
            )
            return Response(
                {
                    "error": f"Failed to complete appointment: financial ledger sync error ({str(fin_err)})",
                    "detail": str(fin_err),
                    "retry_allowed": True,
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        from bookings.serializers import WorkerAppointmentSerializer
        return Response({
            "message": "Appointment updated successfully.",
            "booking": WorkerAppointmentSerializer(booking, context={"request": request}).data,
        }, status=status.HTTP_200_OK)



class CustomerSalonExploreView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request):
        search = request.query_params.get("search", "").strip().lower()
        location_param = request.query_params.get("location", "").strip().lower()
        category_param = request.query_params.get("category", "").strip().lower()
        services_param = request.query_params.get("services", "").strip().lower()
        instant_slots = request.query_params.get("instant_slots", "").strip().lower() == "true"
        min_rating_param = request.query_params.get("min_rating", "")
        price_tier_param = request.query_params.get("price_tier", "") # 1, 2, 3
        atmosphere_param = request.query_params.get("atmosphere", "").strip().lower()
        sort_by = request.query_params.get("sort_by", "").strip()
        distance_radius = request.query_params.get("distance_radius", "").strip()
        purity_param = request.query_params.get("purity", "").strip()
        time_window = request.query_params.get("time_window", "").strip()
        page_param = request.query_params.get("page", "1")
        page_size_param = request.query_params.get("page_size", "8")

       
        db_salons = Salon.objects.filter(
            approval_status=Salon.ApprovalStatus.APPROVED
        ).order_by("-created_at")
        
        registered_salons = []
        count=0
        for s in db_salons:
    
            tags = []

            if s.category:
                tags.append(s.category)

            if s.amenities and isinstance(s.amenities, list):
                for am in s.amenities[:2]:
                    if am not in tags:
                        tags.append(am)

            if not tags:
                tags = ["Hair & Beauty", "AC", "Certified"]

            # Service list based on category
            services = [
                {"name": "Haircut & Styling", "price": "₹349", "category": "hair"},
                {"name": "Organic Detox Spa", "price": "₹899", "category": "spa"},
                {"name": "Hydra Facial Glow", "price": "₹999", "category": "skin"},
            ]
            cat_lower = (s.category or "").lower()
            if "nail" in cat_lower:
                services = [
                    {"name": "Gel Manicure", "price": "₹399", "category": "nails"},
                    {"name": "Pedicure Spa", "price": "₹599", "category": "nails"},
                    {"name": "Nail Art Custom", "price": "₹799", "category": "nails"},
                ]
            elif "spa" in cat_lower or "massage" in cat_lower:
                services = [
                    {"name": "Ayurvedic Spa Ritual", "price": "₹1,200", "category": "spa"},
                    {"name": "Aromatherapy Massage", "price": "₹1,400", "category": "spa"},
                    {"name": "Head & Shoulder Spa", "price": "₹600", "category": "spa"},
                ]
            # Service list: first query live SalonService offerings from services app, then fallback to JSON s.services
            services = []
            try:
                salon_service_objs = SalonService.objects.filter(
                    salon=s, is_active=True
                ).select_related("service", "service__category")
                for sso in salon_service_objs:
                    srv_cat = sso.service.category.name if sso.service and sso.service.category else (s.category or "hair")
                    services.append({
                        "id": sso.id,
                        "name": sso.custom_name or (sso.service.name if sso.service else "Service"),
                        "price": f"₹{int(sso.price)}" if sso.price else "₹349+",
                        "category": srv_cat.lower(),
                    })
            except Exception:
                pass

            if not services and isinstance(s.services, list) and s.services:
                for item in s.services:
                    if isinstance(item, dict):
                        services.append({
                            "id": item.get("id") or item.get("name"),
                            "name": item.get("name") or "Service",
                            "price": str(item.get("price") or "₹349+"),
                            "category": item.get("category") or (s.category or "hair"),
                        })
                    elif isinstance(item, str):
                        services.append({
                            "name": item,
                            "price": "₹349+",
                            "category": s.category or "hair",
                        })

            if not services:
                cat_lower = (s.category or "").lower()
                if "nail" in cat_lower:
                    services = [
                        {"name": "Gel Manicure", "price": "₹399", "category": "nails"},
                        {"name": "Pedicure Spa", "price": "₹599", "category": "nails"},
                        {"name": "Nail Art Custom", "price": "₹799", "category": "nails"},
                    ]
                elif "spa" in cat_lower or "massage" in cat_lower:
                    services = [
                        {"name": "Ayurvedic Spa Ritual", "price": "₹1,200", "category": "spa"},
                        {"name": "Aromatherapy Massage", "price": "₹1,400", "category": "spa"},
                        {"name": "Head & Shoulder Spa", "price": "₹600", "category": "spa"},
                    ]
                else:
                    services = [
                        {"name": "Haircut & Styling", "price": "₹349", "category": "hair"},
                        {"name": "Organic Detox Spa", "price": "₹899", "category": "spa"},
                        {"name": "Hydra Facial Glow", "price": "₹999", "category": "skin"},
                    ]

            # Parse dynamic opening hours days structure
            opening_hours_days = []
            if isinstance(s.opening_hours, dict) and s.opening_hours:
                if "days" in s.opening_hours and isinstance(s.opening_hours["days"], list):
                    opening_hours_days = s.opening_hours["days"]
                elif "openTime" in s.opening_hours and "closeTime" in s.opening_hours:
                    open_t = s.opening_hours.get("openTime", "09:00")
                    close_t = s.opening_hours.get("closeTime", "21:00")
                    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                    opening_hours_days = [
                        {"day": day, "isOpen":True, "openTime": open_t, "closeTime": close_t}
                        for day in weekdays
                    ]
            elif isinstance(s.opening_hours, str) and s.opening_hours:
                try:
                    parsed = json.loads(s.opening_hours)
                    if isinstance(parsed, dict) and "days" in parsed:
                        opening_hours_days = parsed["days"]
                    elif isinstance(parsed, list):
                        opening_hours_days = parsed
                except Exception:
                    opening_hours_days = []

            if not opening_hours_days:
                weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                opening_hours_days = [
                    {"day": day, "isOpen": True, "openTime": "09:00", "closeTime": "21:00"}
                    for day in weekdays
                ]

            opening_hours_payload = {
                "days": opening_hours_days
            }

            # Compute real rating & review_count
            avg_review_dict = SalonReview.objects.filter(salon=s).aggregate(avg=Avg('rating'))
            avg_review_val = avg_review_dict['avg']
            salon_rating = round(float(avg_review_val), 1) if avg_review_val is not None else None
            review_count = SalonReview.objects.filter(salon=s).count()

            # Compute dynamic price tier based on actual service prices
            numeric_prices = []
            for srv in services:
                raw_p = srv.get("price", "")
                clean_p = re.sub(r"[^\d.]", "", str(raw_p))
                try:
                    p_val = float(clean_p)
                    if p_val > 0:
                        numeric_prices.append(p_val)
                except ValueError:
                    pass

            if numeric_prices:
                min_p = min(numeric_prices)
                if min_p < 500:
                    salon_price_tier = 1
                elif min_p <= 1500:
                    salon_price_tier = 2
                else:
                    salon_price_tier = 3
            else:
                salon_price_tier = 1

            # Compute dynamic atmosphere / gender category
            salon_text = f"{s.name} {s.category or ''} {s.secondary_category or ''} {s.description or ''} {s.tagline or ''}".lower()
            service_names = " ".join(srv.get("name", "") for srv in services).lower()

            is_women = any(w in salon_text for w in ["women", "female", "ladies", "bridal"])
            is_men = any(w in salon_text for w in ["men", "grooming", "barber", "beard", "gentlemen"]) or any(w in service_names for w in ["beard", "shave", "fade", "grooming"])

            if "unisex" in salon_text:
                gender_cat = "unisex"
            elif is_women and not is_men:
                gender_cat = "women-only"
            elif is_men and not is_women:
                gender_cat = "men's care"
            else:
                gender_cat = "unisex"

            registered_salons.append({
                "id": s.id,
                "name": s.name,
                "badge": "● Verified Partner",
                "badge_type": "partner",
                "distance_km": 1.5,
                "address_line": s.address or s.city,
                "city": (
                    f"{s.city}, {s.state}".strip().replace(",,", ",").strip(", ")
                    if s.city or s.state
                    else "Kerala"
                ),
                "tags": tags,
                "gender_category": gender_cat,
                "rating": salon_rating,
                "review_count": review_count,
                "has_instant_slot": True,
                "instant_slot_text": "Instant slot available today • Verified Partner",
                
                "price_tier": salon_price_tier,
                "services": services,
                
                "purity_note": s.description or "Certified clean & botanical hygiene standards",
                "image": build_full_media_url(
                    request,
                    s.cover_image or (
                        s.images[0]
                        if s.images and isinstance(s.images, list)
                        else "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80"
                    )
                ),
                "is_clean_purity": True,
                "phone": s.phone or "+91 88481 94536",
                
                "opening_hours": opening_hours_payload,
            })

        # Curated mockup partner salons
        
        # Apply filtering on real registered salons
        results = registered_salons

        

        if search:
            results = [
                s for s in results
                if search in s["name"].lower()
                or search in s["address_line"].lower()
                or search in s["city"].lower()
                or any(search in srv["name"].lower() for srv in s["services"])
                or any(search in tag.lower() for tag in s["tags"])
            ]

        if category_param and category_param != "all":
            results = [
                s for s in results
                if any(category_param in srv["name"].lower() or category_param in srv["category"].lower() for srv in s["services"])
                or any(category_param in tag.lower() for tag in s["tags"])
            ]

        if atmosphere_param and atmosphere_param != "all salons" and atmosphere_param != "all":
            results = [
                s for s in results
                if atmosphere_param in s["gender_category"].lower()
                or (atmosphere_param == "men's care" and (
                    "men" in s["gender_category"].lower()
                    or any(any(w in tag.lower() for w in ["men", "grooming", "barber", "beard"]) for tag in s["tags"])
                    or any(any(w in srv["name"].lower() for w in ["beard", "shave", "grooming", "men"]) for srv in s["services"])
                ))
                or (atmosphere_param == "women-only" and (
                    "women" in s["gender_category"].lower()
                    or any(any(w in tag.lower() for w in ["women", "female", "ladies", "bridal"]) for tag in s["tags"])
                ))
                or (atmosphere_param == "unisex" and (
                    "unisex" in s["gender_category"].lower()
                    or not any(w in s["gender_category"].lower() for w in ["women", "men"])
                ))
                or any(atmosphere_param in tag.lower() for tag in s["tags"])
            ]

        if instant_slots:
            results = [s for s in results if s.get("has_instant_slot", False)]

        if min_rating_param:
            try:
                min_r = float(min_rating_param)
                results = [
                    s for s in results
                    if s.get("review_count", 0) > 0 and s.get("rating") is not None and float(s.get("rating", 0)) >= min_r
                ]
            except ValueError:
                pass

        if price_tier_param:
            try:
                p_tier = int(price_tier_param)
                results = [
                    s for s in results
                    if s.get("price_tier") == p_tier or any(
                        (p_tier == 1 and p < 500) or
                        (p_tier == 2 and 500 <= p <= 1500) or
                        (p_tier == 3 and p > 1500)
                        for p in [
                            float(re.sub(r"[^\d.]", "", str(srv.get("price", ""))))
                            for srv in s.get("services", [])
                            if re.sub(r"[^\d.]", "", str(srv.get("price", "")))
                        ]
                    )
                ]
            except ValueError:
                pass

        if location_param and location_param != "all locations" and location_param != "all":
            results = [
                s for s in results
                if location_param in s["city"].lower() or location_param in s["address_line"].lower()
            ]

        if services_param:
            req_srvs = [srv.strip().lower() for srv in services_param.split(",") if srv.strip()]
            if req_srvs:
                results = [
                    s for s in results
                    if any(
                        req in (s.get("category") or "").lower()
                        or any(req in tag.lower() for tag in s.get("tags", []))
                        or any(req in srv.get("name", "").lower() or req in srv.get("category", "").lower() for srv in s.get("services", []))
                        for req in req_srvs
                    )
                ]

        if distance_radius and distance_radius.lower() != "any":
            try:
                max_d = float(distance_radius)
                results = [s for s in results if float(s.get("distance_km", 1.5)) <= max_d]
            except ValueError:
                pass

        if purity_param:
            purities = [p.strip().lower() for p in purity_param.split(",") if p.strip()]
            if purities:
                results = [
                    s for s in results
                    if any(
                        ("clean" in p and (s.get("is_clean_purity") or "clean" in s.get("purity_note", "").lower()))
                        or ("promo" in p and (s.get("badge_type") == "partner" or s.get("has_instant_slot")))
                        or ("scalp" in p and any("spa" in srv.get("name", "").lower() or "scalp" in srv.get("name", "").lower() for srv in s.get("services", [])))
                        for p in purities
                    )
                ]

        if sort_by == "Highest Rated":
            results.sort(key=lambda s: float(s.get("rating") or 0), reverse=True)
        elif sort_by == "Nearest Distance":
            results.sort(key=lambda s: float(s.get("distance_km") or 999))

        total_count = len(results)
        try:
            page = max(1, int(page_param))
        except (ValueError, TypeError):
            page = 1

        try:
            page_size = max(1, int(page_size_param))
        except (ValueError, TypeError):
            page_size = 8

        total_pages = max(1, math.ceil(total_count / page_size)) if total_count > 0 else 1
        if page > total_pages and total_count > 0:
            page = total_pages

        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        paged_salons = results[start_index:end_index]

        all_cities = []
        for s in db_salons:
            if s.city and s.city.strip() and s.city.strip() not in all_cities:
                all_cities.append(s.city.strip())

        return Response(
            {
                "salons": paged_salons,
                "total_count": total_count,
                "total_pages": total_pages,
                "current_page": page,
                "page_size": page_size,
                "locations": ["All Locations"] + all_cities,
                "location_default": "All Locations",
            },
            status=status.HTTP_200_OK,
        )


class CustomerSalonDetailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request, pk):
        try:
            salon = Salon.objects.get(pk=pk,approval_status=Salon.ApprovalStatus.APPROVED,)
            serializer = SalonSerializer(salon, context={"request": request})
            data = serializer.data

            today = timezone.localdate() if hasattr(timezone, "localdate") else timezone.now().date()
            from reviews.models import SalonReview, WorkerReview
            from salons.media_utils import build_full_media_url
            workers = WorkerProfile.objects.filter(salon=salon, is_active=True).select_related("user")
            workers_data = []
            for w in workers:
                leaves_dates = list(
                    WorkerLeave.objects.filter(
                        worker=w,
                        status=WorkerLeave.Status.APPROVED,
                        date__gte=today,
                    ).values_list("date", flat=True)
                )
                w_agg = WorkerReview.objects.filter(worker=w).aggregate(avg=Avg('rating'), count=Count('id'))
                w_reviews_count = w_agg['count'] or 0
                w_rating = round(float(w_agg['avg']), 2) if (w_agg['avg'] is not None and w_reviews_count > 0) else 5.0

                workers_data.append({
                    "id": w.id,
                    "name": w.user.get_full_name() or w.user.email.split('@')[0].title(),
                    "specialization": w.specialization or "Stylist",
                    "experience": w.experience or "",
                    "rating": w_rating,
                    "reviews_count": w_reviews_count,
                    "profile_photo": build_full_media_url(request, w.profile_photo) if w.profile_photo else "",
                    "station": w.station or "",
                    "approved_leaves": [d.isoformat() for d in leaves_dates],
                })
            data["workers_list"] = workers_data
            data["workers"] = workers_data

            try:
                salon_services = SalonService.objects.filter(salon=salon, is_active=True).select_related("service", "service__category")
                services_data = []
                for ss in salon_services:
                    services_data.append({
                        "id": ss.id,
                        "name": ss.custom_name.strip() if ss.custom_name else ss.service.name,
                        "category": ss.service.category.name if ss.service and ss.service.category else "General",
                        "price": float(ss.price),
                        "duration": ss.duration,
                        "description": ss.description.strip() if ss.description else (ss.service.description if ss.service else ""),
                    })

                # Fallback to salon.services JSONField if no SalonService records exist
                if not services_data and isinstance(salon.services, list) and salon.services:
                    for idx, s in enumerate(salon.services):
                        if isinstance(s, dict):
                            raw_p = s.get("price", 0)
                            if isinstance(raw_p, str):
                                raw_p = raw_p.replace("₹", "").replace(",", "").strip()
                            try:
                                price_val = float(raw_p)
                            except (ValueError, TypeError):
                                price_val = 0.0

                            raw_d = s.get("duration", "45")
                            if isinstance(raw_d, str):
                                raw_d = "".join(filter(str.isdigit, raw_d)) or "45"
                            try:
                                dur_val = int(raw_d)
                            except (ValueError, TypeError):
                                dur_val = 45

                            services_data.append({
                                "id": idx + 1,
                                "name": s.get("name", "Service"),
                                "category": s.get("category", "General"),
                                "price": price_val,
                                "duration": dur_val,
                                "description": s.get("description", ""),
                            })

                data["services_list"] = services_data
                data["services"] = services_data
            except Exception as e:
                data["services_list"] = []
                data["services"] = []

            try:
                today = timezone.localdate() if hasattr(timezone, "localdate") else timezone.now().date()
                off_days = SalonOffDay.objects.filter(salon=salon, date__gte=today).order_by("date")
                data["off_days"] = [
                    {"id": od.id, "date": od.date.isoformat(), "reason": od.reason}
                    for od in off_days
                ]
            except Exception:
                data["off_days"] = []

            # Dynamic Salon Reviews and Rating Breakdown
            salon_reviews_qs = SalonReview.objects.filter(salon=salon).select_related('customer', 'booking').order_by('-created_at')
            salon_agg = salon_reviews_qs.aggregate(avg=Avg('rating'), count=Count('id'))
            salon_reviews_count = salon_agg['count'] or 0
            salon_rating = round(float(salon_agg['avg']), 2) if (salon_agg['avg'] is not None and salon_reviews_count > 0) else 5.0

            breakdown = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
            for r in salon_reviews_qs:
                if r.rating in breakdown:
                    breakdown[r.rating] += 1

            breakdown_pct = {}
            for star in range(1, 6):
                cnt = breakdown[star]
                pct = round((cnt / salon_reviews_count * 100)) if salon_reviews_count > 0 else 0
                breakdown_pct[star] = {"count": cnt, "percentage": pct}

            reviews_data = []
            for r in salon_reviews_qs:
                author_name = r.customer.get_full_name() or r.customer.email.split("@")[0].title()
                initial = (r.customer.get_full_name() or r.customer.email or "C")[0].upper()
                photo_url = build_full_media_url(request, getattr(r.customer, 'profile_photo', None)) if getattr(r.customer, 'profile_photo', None) else ""
                treatment = r.booking.service_name if r.booking else "Salon Service"
                reviews_data.append({
                    "id": r.id,
                    "author": author_name,
                    "initial": initial,
                    "avatar": photo_url,
                    "rating": r.rating,
                    "comment": r.comment,
                    "treatment": treatment,
                    "date": r.created_at.strftime("%b %d, %Y"),
                    "created_at": r.created_at.isoformat(),
                })

            data["rating"] = salon_rating
            data["reviews_count"] = salon_reviews_count
            data["rating_breakdown"] = breakdown_pct
            data["reviews"] = reviews_data

            # Real platform promotional offers from pricing engine
            try:
                from bookings.pricing import COUPON_RULES
                offers_data = []
                for code, rule in COUPON_RULES.items():
                    if rule["type"] == "percent":
                        pct = int(rule["value"] * 100)
                        title = f"{pct}% OFF - {rule['label']}"
                        desc = f"Valid on bookings above ₹{int(rule['min_spend'])}"
                        discount_rate = rule["value"]
                        discount_fixed = None
                    else:
                        title = f"Flat ₹{int(rule['value'])} OFF - {rule['label']}"
                        desc = f"Valid on bookings above ₹{int(rule['min_spend'])}"
                        discount_rate = None
                        discount_fixed = float(rule["value"])
                    offers_data.append({
                        "code": code,
                        "title": title,
                        "desc": desc,
                        "discountRate": discount_rate,
                        "discountFixed": discount_fixed,
                        "minSpend": float(rule["min_spend"]),
                    })
                data["offers"] = offers_data
            except Exception:
                data["offers"] = []

            return Response(data, status=status.HTTP_200_OK)
        except Salon.DoesNotExist:
            return Response({"error": "Salon not found"}, status=status.HTTP_404_NOT_FOUND)


class OwnerSalonOffDayListView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found for this owner."}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.localdate() if hasattr(timezone, "localdate") else timezone.now().date()
        off_days = SalonOffDay.objects.filter(salon=salon, date__gte=today).order_by("date")
        serializer = SalonOffDaySerializer(off_days, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found for this owner."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SalonOffDaySerializer(
            data=request.data,
            context={"salon": salon, "request": request}
        )
        if serializer.is_valid():
            serializer.save(salon=salon)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OwnerSalonOffDayDetailView(APIView):
    permission_classes = [IsOwner]

    def delete(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found for this owner."}, status=status.HTTP_404_NOT_FOUND)

        off_day = SalonOffDay.objects.filter(pk=pk, salon=salon).first()
        if not off_day:
            return Response({"error": "Off day not found."}, status=status.HTTP_404_NOT_FOUND)

        off_day.delete()
        return Response({"message": "Off-day removed successfully."}, status=status.HTTP_200_OK)


def get_worker_for_request(request):
    user = request.user
    if not user or not user.is_authenticated:
        return None
    worker = getattr(user, "worker_profile", None) or WorkerProfile.objects.filter(user=user).first()
    if not worker and (getattr(user, "role", None) in ["ADMIN", "OWNER"] or user.is_superuser or user.is_staff):
        worker_id = request.query_params.get("worker_id")
        if worker_id:
            worker = WorkerProfile.objects.filter(pk=worker_id).first()
        else:
            worker = WorkerProfile.objects.first()
    return worker


class WorkerLeaveListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        worker = get_worker_for_request(request)
        if not worker:
            return Response(
                {"error": "No worker profile found for this user."},
                status=status.HTTP_404_NOT_FOUND,
            )
        leaves = WorkerLeave.objects.filter(worker=worker).order_by("-date", "-created_at")
        serializer = WorkerLeaveSerializer(leaves, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        worker = get_worker_for_request(request)
        if not worker:
            return Response(
                {"error": "No worker profile found for this user."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = WorkerLeaveSerializer(
            data=request.data,
            context={"request": request, "worker": worker}
        )
        if serializer.is_valid():
            leave = serializer.save(
                worker=worker,
                status=WorkerLeave.Status.PENDING,
            )
            return Response(
                WorkerLeaveSerializer(leave, context={"request": request}).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkerLeaveCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        worker = get_worker_for_request(request)
        if not worker:
            return Response({"error": "No worker profile found."}, status=status.HTTP_404_NOT_FOUND)
        leave = WorkerLeave.objects.filter(pk=pk, worker=worker).first()
        if not leave:
            return Response({"error": "Leave request not found."}, status=status.HTTP_404_NOT_FOUND)
        if leave.status == WorkerLeave.Status.CANCELLED:
            return Response({"error": "Leave request is already cancelled."}, status=status.HTTP_400_BAD_REQUEST)
        if leave.status != WorkerLeave.Status.PENDING:
            return Response({"error": "Only pending leave requests can be cancelled."}, status=status.HTTP_400_BAD_REQUEST)
        leave.status = WorkerLeave.Status.CANCELLED
        leave.save(update_fields=["status", "updated_at"])
        return Response({
            "message": "Leave request cancelled successfully.",
            "leave": WorkerLeaveSerializer(leave, context={"request": request}).data,
        }, status=status.HTTP_200_OK)


class OwnerWorkerLeaveListView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found for this owner."}, status=status.HTTP_404_NOT_FOUND)

        leaves = WorkerLeave.objects.filter(worker__salon=salon)
        worker_id = request.query_params.get("worker_id")
        if worker_id and worker_id != "all":
            leaves = leaves.filter(worker_id=worker_id)

        month = request.query_params.get("month")
        if month and month != "all":
            leaves = leaves.filter(date__startswith=month)

        status_filter = request.query_params.get("status")
        if status_filter and status_filter != "all":
            leaves = leaves.filter(status=status_filter)

        leaves = leaves.order_by("date", "created_at")
        serializer = WorkerLeaveSerializer(leaves, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found for this owner."}, status=status.HTTP_400_BAD_REQUEST)

        worker_id = request.data.get("worker") or request.data.get("worker_id")
        worker = WorkerProfile.objects.filter(pk=worker_id, salon=salon).first()
        if not worker:
            return Response({"worker": "Please select a valid worker from your salon."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = WorkerLeaveSerializer(
            data=request.data,
            context={"request": request, "worker": worker}
        )
        if serializer.is_valid():
            leave = serializer.save(
                worker=worker,
                status=WorkerLeave.Status.APPROVED,
                approved_by=request.user,
                approved_at=timezone.now(),
            )
            return Response(
                WorkerLeaveSerializer(leave, context={"request": request}).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OwnerWorkerLeaveBookingsView(APIView):
    permission_classes = [IsOwner]

    def get(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found."}, status=status.HTTP_404_NOT_FOUND)

        leave = WorkerLeave.objects.filter(pk=pk, worker__salon=salon).first()
        if not leave:
            return Response({"error": "Leave request not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WorkerLeaveSerializer(leave, context={"request": request})
        return Response({
            "leave": serializer.data,
            "affected_bookings": serializer.data.get("affected_bookings", []),
            "affected_bookings_count": serializer.data.get("affected_bookings_count", 0),
        }, status=status.HTTP_200_OK)


class OwnerWorkerLeaveApproveView(APIView):
    permission_classes = [IsOwner]

    def post(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found."}, status=status.HTTP_404_NOT_FOUND)

        leave = WorkerLeave.objects.filter(pk=pk, worker__salon=salon).first()
        if not leave:
            return Response({"error": "Leave request not found."}, status=status.HTTP_404_NOT_FOUND)

        leave.status = WorkerLeave.Status.APPROVED
        leave.approved_by = request.user
        leave.approved_at = timezone.now()
        leave.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

        try:
            from notifications.services import notify_leave_decision
            notify_leave_decision(leave, approved=True)
        except Exception:
            pass

        return Response({
            "message": "Leave request approved successfully.",
            "leave": WorkerLeaveSerializer(leave, context={"request": request}).data,
        }, status=status.HTTP_200_OK)


class OwnerWorkerLeaveRejectView(APIView):
    permission_classes = [IsOwner]

    def post(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found."}, status=status.HTTP_404_NOT_FOUND)

        leave = WorkerLeave.objects.filter(pk=pk, worker__salon=salon).first()
        if not leave:
            return Response({"error": "Leave request not found."}, status=status.HTTP_404_NOT_FOUND)

        rejection_reason = request.data.get("rejection_reason") or request.data.get("reason") or ""
        leave.status = WorkerLeave.Status.REJECTED
        leave.rejection_reason = str(rejection_reason).strip()
        leave.approved_by = request.user
        leave.approved_at = timezone.now()
        leave.save(update_fields=["status", "rejection_reason", "approved_by", "approved_at", "updated_at"])

        try:
            from notifications.services import notify_leave_decision
            notify_leave_decision(leave, approved=False, reason=leave.rejection_reason)
        except Exception:
            pass

        return Response({
            "message": "Leave request rejected.",
            "leave": WorkerLeaveSerializer(leave, context={"request": request}).data,
        }, status=status.HTTP_200_OK)


class OwnerWorkerLeaveDetailView(APIView):
    permission_classes = [IsOwner]

    def delete(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found."}, status=status.HTTP_404_NOT_FOUND)

        leave = WorkerLeave.objects.filter(pk=pk, worker__salon=salon).first()
        if not leave:
            return Response({"error": "Leave not found."}, status=status.HTTP_404_NOT_FOUND)

        leave.delete()
        return Response({"message": "Leave deleted successfully."}, status=status.HTTP_200_OK)


class WorkerProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        worker = get_worker_for_request(request)
        if not worker:
            return Response({"error": "Worker profile not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WorkerProfileSerializer(worker, context={"request": request})
        data = serializer.data
        data["salon_details"] = {
            "id": worker.salon.id,
            "name": worker.salon.name,
            "category": worker.salon.category,
            "address": worker.salon.address,
            "city": worker.salon.city,
            "phone": worker.salon.phone,
        }
        return Response(data, status=status.HTTP_200_OK)

    def patch(self, request):
        worker = get_worker_for_request(request)
        if not worker:
            return Response({"error": "Worker profile not found."}, status=status.HTTP_404_NOT_FOUND)

        user = worker.user
        data = request.data
        errors = {}

        if "first_name" in data:
            first_name = str(data["first_name"]).strip()
            if not first_name:
                errors["first_name"] = "First name is required."
            elif len(first_name) < 2:
                errors["first_name"] = "First name must be at least 2 characters."
            elif not re.match(r"^[A-Za-z\s]+$", first_name):
                errors["first_name"] = "First name should only contain letters and spaces."
            else:
                user.first_name = first_name

        if "last_name" in data:
            last_name = str(data["last_name"]).strip()
            if last_name and not re.match(r"^[A-Za-z\s]+$", last_name):
                errors["last_name"] = "Last name should only contain letters and spaces."
            else:
                user.last_name = last_name

        if "phone_number" in data:
            raw_phone = str(data["phone_number"]).strip()
            clean_phone = re.sub(r"[\s\-\+]", "", raw_phone)
            if clean_phone.startswith("91") and len(clean_phone) == 12:
                clean_phone = clean_phone[2:]
            if not clean_phone:
                errors["phone_number"] = "Phone number is required."
            elif not re.match(r"^[6-9]\d{9}$", clean_phone):
                errors["phone_number"] = "Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9."
            else:
                user.phone_number = clean_phone
                worker.phone_number = clean_phone

        if "specialization" in data:
            spec = str(data["specialization"]).strip()
            if not spec:
                errors["specialization"] = "Specialization cannot be empty."
            elif len(spec) > 150:
                errors["specialization"] = "Specialization cannot exceed 150 characters."
            else:
                worker.specialization = spec

        if "experience" in data:
            exp = str(data["experience"]).strip()
            if len(exp) > 100:
                errors["experience"] = "Experience cannot exceed 100 characters."
            else:
                worker.experience = exp

        if "bio" in data:
            bio_text = str(data["bio"]).strip()
            if len(bio_text) > 500:
                errors["bio"] = "Bio cannot exceed 500 characters."
            else:
                worker.bio = bio_text

        if "profile_photo" in data and data["profile_photo"]:
            photo_val = data["profile_photo"]
            if isinstance(photo_val, str) and (photo_val.startswith("data:image/") or photo_val.startswith("http")):
                saved_path = save_image_to_media(photo_val, subfolder="avatars")
                if saved_path:
                    worker.profile_photo = saved_path
            elif photo_val:
                worker.profile_photo = str(photo_val).strip()

        if errors:
            return Response(
                {"errors": errors, "error": next(iter(errors.values()))},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.save()
        worker.save()

        updated_data = WorkerProfileSerializer(worker, context={"request": request}).data
        updated_data["salon_details"] = {
            "id": worker.salon.id,
            "name": worker.salon.name,
            "category": worker.salon.category,
            "address": worker.salon.address,
            "city": worker.salon.city,
            "phone": worker.salon.phone,
        }
        return Response({
            "message": "Profile updated successfully.",
            "profile": updated_data,
        }, status=status.HTTP_200_OK)