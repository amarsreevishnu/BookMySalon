from django.shortcuts import render
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Salon
from .serializers import SalonSerializer


class OptionalJWTAuthentication(JWTAuthentication):
    """
    Authenticate if a valid token is provided, but do not fail with 401
    if token is expired/invalid for AllowAny onboarding endpoints.
    """
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except Exception:
            return None


import secrets
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from .email_utils import send_salon_approval_email, send_salon_rejection_email

User = get_user_model()


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


class SalonCreateView(generics.CreateAPIView):
    serializer_class = SalonSerializer
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        owner = None
        if request.user.is_authenticated and getattr(request.user, "role", None) == "OWNER":
            owner = request.user

        salon = serializer.save(
            owner=owner,
            approval_status=Salon.ApprovalStatus.PENDING,
        )

        headers = self.get_success_headers(serializer.data)
        return Response(
            {
                "message": (
                    "Salon application submitted successfully! Our super admin team "
                    "will review your venue details within 24-48 hours. Once approved, "
                    "login credentials will be emailed to your official email."
                ),
                "salon": serializer.data,
            },
            status=status.HTTP_201_CREATED,
            headers=headers,
        )


class AdminDashboardStatsView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        total_users = User.objects.count()
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

        return Response(
            {
                "registered_users": total_users,
                "active_salons": approved_salons,
                "pending_salons": pending_salons,
                "rejected_salons": rejected_salons,
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
        search = self.request.query_params.get("q")

        if status_param and status_param != "all":
            queryset = queryset.filter(approval_status=status_param.upper())

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(city__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
                | Q(category__icontains=search)
            )

        return queryset


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
        ]

        if approval_status not in allowed_statuses:
            return Response(
                {"error": "Status must be APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        temp_password = None
        owner_created = False

        if approval_status == Salon.ApprovalStatus.APPROVED:
            # Handle owner account creation if not yet linked
            if not salon.owner and salon.email:
                user = User.objects.filter(email=salon.email).first()
                if not user:
                    temp_password = f"Salon@{secrets.randbelow(9000) + 1000}"
                    user = User.objects.create_user(
                        email=salon.email,
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

            salon.approval_status = Salon.ApprovalStatus.APPROVED
            if admin_notes:
                salon.admin_notes = admin_notes
            salon.save()

            # Dispatch notification email with credentials
            if salon.email:
                if not temp_password:
                    temp_password = "Use your existing account password"
                send_salon_approval_email(salon, temp_password)

        elif approval_status == Salon.ApprovalStatus.REJECTED:
            salon.approval_status = Salon.ApprovalStatus.REJECTED
            if admin_notes:
                salon.admin_notes = admin_notes
            salon.save()

            if salon.email:
                send_salon_rejection_email(salon, admin_notes)

        serializer = self.get_serializer(salon)
        return Response(
            {
                "message": (
                    f"Salon {salon.name} has been {approval_status.lower()} successfully."
                ),
                "salon": serializer.data,
                "temp_password": temp_password if owner_created else None,
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

        if user and user.is_authenticated and hasattr(user, "salons"):
            salon = user.salons.first()

        if not salon:
            salon = Salon.objects.first()

        salon_name = salon.name if salon else "ABC Salon & Spa - Indiranagar Flagship"
        salon_city = salon.city if salon else "Indiranagar, Bangalore"
        salon_category = salon.category if salon else "Hair & Styling • Spa"
        outlet_code = f"#{salon.id:02d}" if salon else "#04"

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
            "staff_on_duty": [
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
            ],
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
            "popular_services": [
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
            ],
        }
        return Response(data)


class OwnerQuickWalkInView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def post(self, request):
        client_name = request.data.get("client_name", "").strip()
        service = request.data.get("service", "Haircut & Styling").strip()
        stylist = request.data.get("stylist", "Rahul").strip()
        station = request.data.get("station", "Station 01").strip()
        duration = request.data.get("duration", "45 mins").strip()

        if not client_name:
            return Response(
                {"error": "Client name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        walk_in = {
            "id": int(timezone.now().timestamp()),
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