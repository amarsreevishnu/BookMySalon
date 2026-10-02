from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from services.models import SalonService

from .models import Salon, WorkerProfile, Booking
from .serializers import (
    SalonSerializer,
    WorkerProfileSerializer,
    WorkerCreateSerializer,
    BookingSerializer,
)
from .media_utils import save_image_to_media, build_full_media_url

import json
import secrets
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from .email_utils import (
    send_salon_approval_email,
    send_salon_rejection_email,
    send_worker_credentials_email,
    verify_salon_resubmit_token,
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

    # 1. Direct owner of an approved salon
    salon = Salon.objects.filter(owner=user, approval_status=Salon.ApprovalStatus.APPROVED).order_by("-id").first()
    if salon:
        return salon

    # 2. Direct owner of any salon (e.g. pending review)
    salon = Salon.objects.filter(owner=user).order_by("-id").first()
    if salon:
        return salon

    # 3. Match by owner user email
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

    # 4. Fallback for ADMIN / OWNER accounts: prioritize APPROVED salons
    if getattr(user, "role", None) in ["ADMIN", "OWNER"] or user.is_superuser or user.is_staff:
        approved = Salon.objects.filter(approval_status=Salon.ApprovalStatus.APPROVED).order_by("-id").first()
        if approved:
            return approved
        return Salon.objects.order_by("-id").first()

    return None


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

        owner = None
        if request.user.is_authenticated and getattr(request.user, "role", None) == "OWNER":
            owner = request.user

        salon = serializer.save(
            owner=owner,
            approval_status=Salon.ApprovalStatus.PENDING,
        )

        # Synchronize services into SalonService model
        sync_salon_services(salon, salon.services)

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
                    temp_password = f"Salon@{secrets.randbelow(9000) + 1000}"
                    user = User.objects.create_user(
                        email=salon.email.lower().strip(),
                        password=temp_password,
                        first_name=salon.name[:30],
                        role=User.Role.OWNER,
                        is_active=True,
                    )
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
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request):
        user = request.user
        salon = None

        if user and user.is_authenticated:
            salon = get_owner_salon(user)

        if not salon:
            salon = Salon.objects.first()

        salon_name = salon.name if salon else "ABC Salon & Spa - Indiranagar Flagship"
        salon_city = salon.city if salon else "Indiranagar, Bangalore"
        salon_category = salon.category if salon else "Hair & Styling • Spa"
        outlet_code = f"#{salon.id:02d}" if salon else "#04"

        staff_on_duty = [
            {
                "id": 1,
                "name": "Rahul Sharma",
                "station": "Station 01",
                "role": "Senior Hair Stylist",
                "rating": 4.9,
                "booked_count": 8,
                "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
                "is_active": True,
            },
            {
                "id": 2,
                "name": "Anjali Sen",
                "station": "Station 02",
                "role": "Skin & Spa Specialist",
                "rating": 4.95,
                "booked_count": 6,
                "avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80",
                "is_active": True,
            },
        ]
        if salon:
            real_workers = WorkerProfile.objects.filter(salon=salon).select_related("user")
            if real_workers.exists():
                staff_on_duty = []
                for idx, w in enumerate(real_workers, start=1):
                    full_name = f"{w.user.first_name} {w.user.last_name}".strip() or w.user.email.split("@")[0].title()
                    staff_on_duty.append({
                        "id": w.id,
                        "worker_id": w.id,
                        "name": full_name,
                        "station": f"Station {idx:02d}",
                        "role": w.specialization or "Stylist",
                        "rating": 4.9,
                        "booked_count": w.assigned_bookings.count(),
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
                {
                    "id": 2,
                    "name": "Facial & Cleanups",
                    "icon": "sparkles",
                    "bookings": 18,
                    "contribution_pct": 32,
                    "avg_price": "₹1,200",
                },
                {
                    "id": 3,
                    "name": "Spa & Hair Rituals",
                    "icon": "lotus",
                    "bookings": 12,
                    "contribution_pct": 21,
                    "avg_price": "₹1,650",
                },
            ]

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
                "bookings": {"value": 24, "trend": "+12% vs yesterday", "trend_type": "positive"},
                "revenue": {"value": 8450, "formatted": "₹8,450", "trend": "+18% target pacing", "trend_type": "positive"},
                "completed": {"value": 15, "trend": "+9% turnaround", "trend_type": "positive"},
                "cancelled": {"value": 2, "trend": "-1% low attrition", "trend_type": "warning"},
                "upcoming": {"value": 7, "trend": "+8% booked slots", "trend_type": "positive"},
            },
            "today_schedule": [
                {
                    "id": 101,
                    "time": "10:00 AM",
                    "client_name": "Vishnu Prasad",
                    "station": "Station 01",
                    "stylist": "Rahul",
                    "service": "Haircut & Styling",
                    "duration": "45 mins",
                    "status": "In Progress",
                    "action_label": "Check In",
                },
                {
                    "id": 102,
                    "time": "10:30 AM",
                    "client_name": "Meera Nair",
                    "station": "Station 02",
                    "stylist": "Anjali",
                    "service": "Hydra Facial",
                    "duration": "60 mins",
                    "status": "Arrived",
                    "action_label": "Seat Client",
                },
                {
                    "id": 103,
                    "time": "11:00 AM",
                    "client_name": "Vikram Singhania",
                    "station": "Station 03",
                    "stylist": "Rahul",
                    "service": "Royal Beard Sculpt",
                    "duration": "30 mins",
                    "status": "Confirmed",
                    "action_label": "Send Reminder",
                },
            ],
            "staff_on_duty": staff_on_duty,
            "revenue_progression": {
                "peak_window": "11 AM - 1 PM",
                "daily_accrued": "₹8,450",
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
        }
        return Response(data)


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

        bookings_qs = Booking.objects.filter(worker=worker).order_by("-booking_date", "-booking_time")

        # Auto-seed sample bookings if newly created worker has none yet
        today = timezone.localdate()
        if not bookings_qs.exists():
            try:
                Booking.objects.create(
                    salon=worker.salon,
                    worker=worker,
                    client_name="Pooja Sharma",
                    client_phone="+91 98450 12345",
                    client_email="pooja@example.com",
                    service_name=worker.specialization or "Haircut & Styling",
                    service_price=550.00,
                    booking_date=today,
                    booking_time="10:30 AM",
                    duration="45 mins",
                    station="Station 01",
                    status=Booking.Status.CONFIRMED,
                    notes="Client requested senior stylist",
                )
                Booking.objects.create(
                    salon=worker.salon,
                    worker=worker,
                    client_name="Karthik Menon",
                    client_phone="+91 97410 98765",
                    client_email="karthik@example.com",
                    service_name="Deep Scalp Therapy & Wash",
                    service_price=850.00,
                    booking_date=today,
                    booking_time="02:00 PM",
                    duration="60 mins",
                    station="Station 02",
                    status=Booking.Status.IN_PROGRESS,
                    notes="Regular client",
                )
                Booking.objects.create(
                    salon=worker.salon,
                    worker=worker,
                    client_name="Ananya Reddy",
                    client_phone="+91 99001 54321",
                    client_email="ananya@example.com",
                    service_name="Express Glow Facial",
                    service_price=1200.00,
                    booking_date=today,
                    booking_time="04:30 PM",
                    duration="45 mins",
                    station="Station 03",
                    status=Booking.Status.PENDING,
                    notes="Arriving by cab, might be 5 mins late",
                )
                bookings_qs = Booking.objects.filter(worker=worker).order_by("-booking_date", "-booking_time")
            except Exception:
                pass

        total_count = bookings_qs.count()
        today_count = bookings_qs.filter(booking_date=today).count()
        completed_count = bookings_qs.filter(status=Booking.Status.COMPLETED).count()
        in_progress_count = bookings_qs.filter(status=Booking.Status.IN_PROGRESS).count()
        upcoming_count = bookings_qs.filter(status__in=[Booking.Status.CONFIRMED, Booking.Status.PENDING]).count()

        serializer = BookingSerializer(bookings_qs, many=True)
        worker_serializer = WorkerProfileSerializer(worker, context={"request": request})

        return Response({
            "worker": worker_serializer.data,
            "salon": {
                "id": worker.salon.id,
                "name": worker.salon.name,
                "category": worker.salon.category,
                "address": worker.salon.address,
                "city": worker.salon.city,
                "phone": worker.salon.phone,
            },
            "kpi_stats": {
                "total_bookings": total_count,
                "today_bookings": today_count,
                "completed_bookings": completed_count,
                "in_progress_bookings": in_progress_count,
                "upcoming_bookings": upcoming_count,
            },
            "assigned_bookings": serializer.data,
        })


class WorkerBookingStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def patch(self, request, pk):
        user = request.user
        new_status = request.data.get("status", "").upper()

        valid_statuses = [choice[0] for choice in Booking.Status.choices]
        if new_status not in valid_statuses:
            return Response(
                {"error": f"Invalid status. Allowed values: {', '.join(valid_statuses)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking = Booking.objects.filter(pk=pk).first()
        if not booking:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        is_worker = hasattr(user, "worker_profile") and booking.worker == user.worker_profile
        is_owner = getattr(user, "role", None) == "OWNER" and booking.salon.owner == user
        is_admin = getattr(user, "role", None) == "ADMIN" or user.is_superuser or user.is_staff

        if not (is_worker or is_owner or is_admin):
            return Response(
                {"error": "Access denied. You can only update bookings assigned to you."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking.status = new_status
        booking.save(update_fields=["status", "updated_at"])

        return Response({
            "message": f"Booking status updated to {new_status}.",
            "booking": BookingSerializer(booking).data,
        })



class CustomerSalonExploreView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request):
        search = request.query_params.get("search", "").strip().lower()
        location_param = request.query_params.get("location", "").strip().lower()
        category_param = request.query_params.get("category", "").strip().lower()
        instant_slots = request.query_params.get("instant_slots", "").strip().lower() == "true"
        min_rating_param = request.query_params.get("min_rating", "")
        price_tier_param = request.query_params.get("price_tier", "") # 1, 2, 3
        atmosphere_param = request.query_params.get("atmosphere", "").strip().lower()

       
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
                        {"day": day, "isOpen": day != "Sunday", "openTime": open_t, "closeTime": close_t}
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
                    {"day": day, "isOpen": day != "Sunday", "openTime": "09:00", "closeTime": "21:00"}
                    for day in weekdays
                ]

            opening_hours_payload = {
                "days": opening_hours_days
            }

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
                "gender_category": "unisex",
                "rating": 4.9,
                
                "review_count": 0,
                "has_instant_slot": True,
                "instant_slot_text": "Instant slot available today • Verified Partner",
                
                "price_tier": 2,
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
                if atmosphere_param in s["gender_category"]
                or any(atmosphere_param in tag.lower() for tag in s["tags"])
            ]

        if instant_slots:
            results = [s for s in results if s.get("has_instant_slot", False)]

        if min_rating_param:
            try:
                min_r = float(min_rating_param)
                results = [s for s in results if s.get("rating", 0) >= min_r]
            except ValueError:
                pass

        if price_tier_param:
            try:
                p_tier = int(price_tier_param)
                results = [s for s in results if s.get("price_tier") == p_tier]
            except ValueError:
                pass

        return Response(
            {
                "salons": results,
                "total_count": len(results),
                "visible_count": len(results),
                "location_default": "All Locations",
            },
            status=status.HTTP_200_OK,
        )


class CustomerSalonDetailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request, pk):
        try:
            salon = Salon.objects.get(pk=pk)
            serializer = SalonSerializer(salon, context={"request": request})
            data = serializer.data

            workers = WorkerProfile.objects.filter(salon=salon, is_active=True).select_related("user")
            workers_data = []
            for w in workers:
                workers_data.append({
                    "id": w.id,
                    "name": w.user.get_full_name() or w.user.email,
                    "specialization": w.specialization or "Master Stylist",
                    "experience": w.experience or "3+ Years",
                    "rating": "4.9",
                    "reviews_count": 48,
                    "profile_photo": w.profile_photo,
                    "station": w.station,
                })
            data["workers_list"] = workers_data

            try:
                salon_services = SalonService.objects.filter(salon=salon, is_active=True).select_related("service", "service__category")
                services_data = []
                for ss in salon_services:
                    services_data.append({
                        "id": ss.id,
                        "name": ss.custom_name or ss.service.name,
                        "category": ss.service.category.name if ss.service and ss.service.category else "General",
                        "price": float(ss.price),
                        "duration": ss.duration,
                        "description": ss.custom_description or (ss.service.description if ss.service else ""),
                    })
                data["services_list"] = services_data
            except Exception:
                data["services_list"] = []

            return Response(data, status=status.HTTP_200_OK)
        except Salon.DoesNotExist:
            return Response({"error": "Salon not found"}, status=status.HTTP_404_NOT_FOUND)