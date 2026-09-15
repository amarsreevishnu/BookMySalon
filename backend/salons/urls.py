from django.urls import path

from .views import (
    ApprovedSalonListView,
    PendingSalonListView,
    SalonApprovalView,
    SalonCreateView,
)


urlpatterns = [
    path(
        "create/",
        SalonCreateView.as_view(),
        name="salon-create",
    ),
    path(
        "pending/",
        PendingSalonListView.as_view(),
        name="pending-salons",
    ),
    path(
        "<int:pk>/approval/",
        SalonApprovalView.as_view(),
        name="salon-approval",
    ),
    path(
        "approved/",
        ApprovedSalonListView.as_view(),
        name="approved-salons",
    ),
]