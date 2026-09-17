import json
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.shortcuts import redirect
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    LoginSerializer,
    RegisterSerializer,
    ResendOTPSerializer,
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

        # Create permanent user with hashed password from pending record
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
    }

    params = urlencode(
        {
            "access": access_token,
            "refresh": refresh_token,
            "user": json.dumps(user_payload),
        }
    )

    return redirect(f"http://localhost:5173/google-callback?{params}")