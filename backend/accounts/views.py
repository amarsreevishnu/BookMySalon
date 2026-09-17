import json
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.shortcuts import redirect, render
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, RegisterSerializer

User = get_user_model()



class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data
        )
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