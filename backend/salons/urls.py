from django.urls import path

from .views import (
    AdminDashboardStatsView,
    AdminSalonListView,
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
        "admin/stats/",
        AdminDashboardStatsView.as_view(),
        name="admin-dashboard-stats",
    ),
    path(
        "admin/salons/",
        AdminSalonListView.as_view(),
        name="admin-salon-list",
    ),
    path(
        "admin/<int:pk>/decision/",
        SalonApprovalView.as_view(),
        name="admin-salon-decision",
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
    path(
        "",
        ApprovedSalonListView.as_view(),
        name="salon-list",
    ),
]