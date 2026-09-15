from django.contrib import admin

from .models import Salon

@admin.register(Salon)
class SalonAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "owner",
        "city",
        "approval_status",
        "created_at",
    )
    list_filter =(
        "approval_status",
        "city"
    )
    search_fields=(
        "name",
        "owner__email",
    )