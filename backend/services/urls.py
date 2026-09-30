from django.urls import path
from .views import (
    AdminCategoryListCreateView,
    AdminCategoryDetailView,
    AdminServiceListCreateView,
    AdminServiceDetailView,
    AdminServicesStatsView,
    AdminSeedInitialServicesView,
    OwnerStandardCatalogListView,
    OwnerSalonServiceListCreateView,
    OwnerSalonServiceDetailView,
    PublicCategoriesListView,
    PublicSalonServicesListView,
)

urlpatterns = [
    # -------------------------------------------------------------------------
    # Super Admin: Platform Catalog Management
    # -------------------------------------------------------------------------
    path("admin/stats/", AdminServicesStatsView.as_view(), name="admin-services-stats"),
    path("admin/categories/", AdminCategoryListCreateView.as_view(), name="admin-categories-list-create"),
    path("admin/categories/<int:pk>/", AdminCategoryDetailView.as_view(), name="admin-category-detail"),
    path("admin/services/", AdminServiceListCreateView.as_view(), name="admin-services-list-create"),
    path("admin/services/<int:pk>/", AdminServiceDetailView.as_view(), name="admin-service-detail"),
    path("admin/seed/", AdminSeedInitialServicesView.as_view(), name="admin-seed-services"),

    # -------------------------------------------------------------------------
    # Salon Owner: Offerings Management
    # -------------------------------------------------------------------------
    path("owner/catalog/", OwnerStandardCatalogListView.as_view(), name="owner-standard-catalog"),
    path("owner/services/", OwnerSalonServiceListCreateView.as_view(), name="owner-salon-services-list-create"),
    path("owner/services/<int:pk>/", OwnerSalonServiceDetailView.as_view(), name="owner-salon-service-detail"),

    # -------------------------------------------------------------------------
    # Public / Customer: Browse & Compare
    # -------------------------------------------------------------------------
    path("public/categories/", PublicCategoriesListView.as_view(), name="public-categories-list"),
    path("public/salons/<int:salon_id>/services/", PublicSalonServicesListView.as_view(), name="public-salon-services-list"),
]

