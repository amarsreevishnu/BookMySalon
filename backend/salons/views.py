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


class IsOwner(IsAuthenticated):
    def has_permission(self, request, view):
        authenticated = super().has_permission(request, view)
        return authenticated and getattr(request.user, "role", None) == "OWNER"


class IsAdminUserRole(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and getattr(request.user, "role", None) == "ADMIN"
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


class PendingSalonListView(generics.ListAPIView):
    serializer_class = SalonSerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        return Salon.objects.filter(
            approval_status=Salon.ApprovalStatus.PENDING
        ).order_by("-created_at")


class SalonApprovalView(generics.UpdateAPIView):
    serializer_class = SalonSerializer
    permission_classes = [IsAdminUserRole]
    queryset = Salon.objects.all()
    http_method_names = ["patch"]

    def patch(self, request, *args, **kwargs):
        salon = self.get_object()
        approval_status = request.data.get("approval_status")

        allowed_statuses = [
            Salon.ApprovalStatus.APPROVED,
            Salon.ApprovalStatus.REJECTED,
        ]

        if approval_status not in allowed_statuses:
            return Response(
                {"error": "Status must be APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        salon.approval_status = approval_status
        admin_notes = request.data.get("admin_notes")
        if admin_notes is not None:
            salon.admin_notes = admin_notes
            salon.save(update_fields=["approval_status", "admin_notes", "updated_at"])
        else:
            salon.save(update_fields=["approval_status", "updated_at"])

        serializer = self.get_serializer(salon)
        return Response(serializer.data)


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