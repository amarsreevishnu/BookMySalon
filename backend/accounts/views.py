import json
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
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

        # Delete pending registration record
        pending.delete()

        # Generate tokens
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
            "http://localhost:5173/login?error=Google+login+failed.+Please+try+again."
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

    return redirect(f"http://localhost:5173/google-callback?{params}")


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
        # Default to CUSTOMER role as requested
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

        # Do not allow blocking superusers or oneself
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



