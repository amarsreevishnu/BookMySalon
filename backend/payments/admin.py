from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'booking',
        'customer',
        'salon',
        'amount',
        'payment_method',
        'payment_status',
        'razorpay_order_id',
        'razorpay_payment_id',
        'created_at',
    ]
    list_filter = ['payment_method', 'payment_status', 'created_at']
    search_fields = [
        'booking__id',
        'booking__client_name',
        'customer__email',
        'salon__name',
        'razorpay_order_id',
        'razorpay_payment_id',
    ]
    readonly_fields = ['created_at', 'updated_at']
