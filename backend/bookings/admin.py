from django.contrib import admin
from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['id', 'client_name', 'salon', 'worker', 'service_name', 'booking_date', 'start_time', 'end_time', 'status', 'created_at']
    list_filter = ['status', 'booking_date', 'salon']
    search_fields = ['client_name', 'client_email', 'client_phone', 'service_name']
    ordering = ['-booking_date', '-start_time']
    readonly_fields = ['created_at', 'updated_at']
