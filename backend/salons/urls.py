from django.urls import path

from .views import SalonCreateView


urlpatterns = [
    path(
        "create/",
        SalonCreateView.as_view(),
        name="salon-create",
    ),
]