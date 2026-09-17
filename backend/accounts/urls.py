from django.urls import path

from .views import (
    LoginView,
    RegisterView,
    ResendOTPView,
    VerifyOTPView,
    google_success,
)

urlpatterns = [
    path(
        "register/",
        RegisterView.as_view(),
        name="register",
    ),
    path(
        "verify-otp/",
        VerifyOTPView.as_view(),
        name="verify_otp",
    ),
    path(
        "resend-otp/",
        ResendOTPView.as_view(),
        name="resend_otp",
    ),
    path(
        "login/",
        LoginView.as_view(),
        name="login",
    ),
    path(
        "google-success/",
        google_success,
        name="google_success",
    ),
]