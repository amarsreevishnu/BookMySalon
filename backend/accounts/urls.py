from django.urls import path

from .views import RegisterView, LoginView, google_success


urlpatterns = [
    path(
        "register/",
        RegisterView.as_view(),
        name="register",
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