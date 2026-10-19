from django.contrib import admin
from .models import SalonReview, WorkerReview


@admin.register(SalonReview)
class SalonReviewAdmin(admin.ModelAdmin):
    list_display = ['id', 'salon', 'customer', 'booking', 'rating', 'created_at']
    list_filter = ['rating', 'created_at', 'salon']
    search_fields = ['salon__name', 'customer__email', 'comment']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(WorkerReview)
class WorkerReviewAdmin(admin.ModelAdmin):
    list_display = ['id', 'salon', 'worker', 'customer', 'booking', 'rating', 'created_at']
    list_filter = ['rating', 'created_at', 'salon', 'worker']
    search_fields = ['salon__name', 'worker__user__email', 'customer__email', 'comment']
    readonly_fields = ['created_at', 'updated_at']
