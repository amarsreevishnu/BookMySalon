from django.contrib import admin
from .models import ServiceCategory, Service, SalonService


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "icon", "slug", "is_active", "display_order", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("display_order", "name")


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "gender_target",
        "standard_price",
        "standard_duration",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "gender_target", "category")
    search_fields = ("name", "description", "category__name")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("category__display_order", "name")


@admin.register(SalonService)
class SalonServiceAdmin(admin.ModelAdmin):
    list_display = (
        "effective_name",
        "salon",
        "service",
        "price",
        "duration",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "service__category")
    search_fields = ("custom_name", "salon__name", "service__name")
    ordering = ("salon__name", "service__name")

