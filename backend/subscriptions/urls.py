from django.urls import path
from .views import (
    # Admin
    AdminSubscriptionStatsView,
    AdminSuperAdminWalletView,
    AdminSalonsSubscriptionsListView,
    AdminSubscriptionPlansView,
    AdminSubscriptionPlanDetailView,
    AdminSubscriptionSettingsView,
    AdminExtendSubscriptionView,
    AdminSubscriptionPaymentsListView,
    # Owner
    OwnerCurrentSubscriptionView,
    OwnerAvailablePlansView,
    OwnerCreateSubscriptionOrderView,
    OwnerVerifySubscriptionPaymentView,
    OwnerSubscriptionHistoryView,
)

app_name = "subscriptions"

urlpatterns = [
    # Super Admin Endpoints
    path("admin/stats/", AdminSubscriptionStatsView.as_view(), name="admin-stats"),
    path("admin/wallet/", AdminSuperAdminWalletView.as_view(), name="admin-wallet"),
    path("admin/salons/", AdminSalonsSubscriptionsListView.as_view(), name="admin-salons"),
    path("admin/plans/", AdminSubscriptionPlansView.as_view(), name="admin-plans"),
    path("admin/plans/<int:pk>/", AdminSubscriptionPlanDetailView.as_view(), name="admin-plan-detail"),
    path("admin/settings/", AdminSubscriptionSettingsView.as_view(), name="admin-settings"),
    path("admin/salons/<int:salon_id>/extend/", AdminExtendSubscriptionView.as_view(), name="admin-extend"),
    path("admin/payments/", AdminSubscriptionPaymentsListView.as_view(), name="admin-payments"),

    # Salon Owner Endpoints
    path("owner/current/", OwnerCurrentSubscriptionView.as_view(), name="owner-current"),
    path("owner/plans/", OwnerAvailablePlansView.as_view(), name="owner-plans"),
    path("owner/create-order/", OwnerCreateSubscriptionOrderView.as_view(), name="owner-create-order"),
    path("owner/verify-payment/", OwnerVerifySubscriptionPaymentView.as_view(), name="owner-verify-payment"),
    path("owner/history/", OwnerSubscriptionHistoryView.as_view(), name="owner-history"),
]
