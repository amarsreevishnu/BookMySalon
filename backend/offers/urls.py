from django.urls import path
from .views import (
    OwnerOfferListCreateView,
    OwnerOfferDetailView,
    OwnerOfferToggleActiveView,
    OwnerOfferTogglePlatformView,
    OwnerOfferRedemptionsView,
    PublicFeaturedOffersView,
    SalonActiveOffersView,
    ValidateOfferAPIView,
    AdminOffersStatsView,
    AdminSalonsOffersSummaryView,
    AdminOffersListView,
    AdminOfferModerateView,
)

app_name = "offers"

urlpatterns = [
    # Super Admin
    path("admin/stats/", AdminOffersStatsView.as_view(), name="admin-offers-stats"),
    path("admin/salons/", AdminSalonsOffersSummaryView.as_view(), name="admin-salons-offers-summary"),
    path("admin/offers/", AdminOffersListView.as_view(), name="admin-offers-list"),
    path("admin/offers/<int:pk>/moderate/", AdminOfferModerateView.as_view(), name="admin-offer-moderate"),

    # Owner
    path("owner/", OwnerOfferListCreateView.as_view(), name="owner-offers-list-create"),
    path("owner/<int:pk>/", OwnerOfferDetailView.as_view(), name="owner-offer-detail"),
    path("owner/<int:pk>/toggle-active/", OwnerOfferToggleActiveView.as_view(), name="owner-offer-toggle-active"),
    path("owner/<int:pk>/toggle-platform/", OwnerOfferTogglePlatformView.as_view(), name="owner-offer-toggle-platform"),
    path("owner/redemptions/", OwnerOfferRedemptionsView.as_view(), name="owner-offer-redemptions"),

    # Customer 
    path("featured/", PublicFeaturedOffersView.as_view(), name="public-featured-offers"),
    path("salon/<int:salon_id>/", SalonActiveOffersView.as_view(), name="salon-active-offers"),
    path("validate/", ValidateOfferAPIView.as_view(), name="validate-offer"),
]

