from django.contrib import admin
from .models import (
    Payment,
    OwnerWallet,
    OwnerWalletTransaction,
    WorkerEarning,
    WorkerWalletTransaction,
    Refund,
)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'booking',
        'customer',
        'salon',
        'amount',
        'payment_type',
        'payment_method',
        'payment_status',
        'razorpay_order_id',
        'razorpay_payment_id',
        'created_at',
    ]
    list_filter = ['payment_type', 'payment_method', 'payment_status', 'created_at']
    search_fields = [
        'booking__id',
        'booking__client_name',
        'customer__email',
        'salon__name',
        'razorpay_order_id',
        'razorpay_payment_id',
    ]
    readonly_fields = ['created_at', 'updated_at']


@admin.register(OwnerWallet)
class OwnerWalletAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'salon',
        'owner',
        'balance',
        'total_collected',
        'total_advances',
        'total_completed_services',
        'total_worker_payout',
        'total_refunded',
        'updated_at',
    ]
    search_fields = ['salon__name', 'owner__email', 'owner__first_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(OwnerWalletTransaction)
class OwnerWalletTransactionAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'salon',
        'transaction_type',
        'flow',
        'amount',
        'balance_after',
        'booking',
        'created_at',
    ]
    list_filter = ['transaction_type', 'flow', 'created_at']
    search_fields = ['salon__name', 'booking__id', 'description']
    readonly_fields = ['created_at']


@admin.register(WorkerEarning)
class WorkerEarningAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'worker',
        'salon',
        'booking',
        'service_price',
        'commission_rate',
        'earning_amount',
        'salon_share',
        'status',
        'created_at',
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['worker__user__first_name', 'worker__user__last_name', 'salon__name', 'booking__id']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(WorkerWalletTransaction)
class WorkerWalletTransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'worker', 'salon', 'transaction_type', 'flow', 'amount', 'created_at']
    list_filter = ['transaction_type', 'flow', 'created_at']
    search_fields = ['worker__user__email', 'description']
    readonly_fields = ['created_at']


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'booking',
        'salon',
        'customer',
        'amount',
        'worker_reversal_amount',
        'refund_status',
        'created_at',
    ]
    list_filter = ['refund_status', 'created_at']
    search_fields = ['booking__id', 'salon__name', 'customer__email', 'reason']
    readonly_fields = ['created_at', 'updated_at']
