from django.shortcuts import render
from rest_framework import generics 
from rest_framework.permissions import IsAuthenticated,BasePermission,AllowAny

from .models import Salon
from .serializers import SalonSerializer

class IsOwner(IsAuthenticated):
    def has_permission(self,request,view):
        authenticated = super().has_permission(request,view)

        return (
            authenticated
            and request.user.role =="OWNER"
        )

class SalonCreateView(generics.CreateAPIView):
    serializer_class = SalonSerializer
    permission_class = [IsOwner]

    def perform_create(self,serializer):
        serializer.save(
            owner=self.request.user,
            approval_status=Salon.ApprovalStatus.PENDING
        )

class IsAdminUserRole(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == "ADMIN"
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

        approval_status = request.data.get(
            "approval_status"
        )

        allowed_statuses = [
            Salon.ApprovalStatus.APPROVED,
            Salon.ApprovalStatus.REJECTED,
        ]

        if approval_status not in allowed_statuses:
            from rest_framework.response import Response
            from rest_framework import status

            return Response(
                {
                    "error": (
                        "Status must be APPROVED "
                        "or REJECTED."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        salon.approval_status = approval_status
        salon.save(
            update_fields=[
                "approval_status",
                "updated_at",
            ]
        )

        serializer = self.get_serializer(salon)

        return Response(serializer.data)


class ApprovedSalonListView(generics.ListAPIView):
    serializer_class = SalonSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Salon.objects.filter(
            approval_status=Salon.ApprovalStatus.APPROVED
        ).order_by("-created_at")