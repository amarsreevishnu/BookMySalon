from django.contrib import admin
from .models import CustomerWallet, WalletTransaction, WalletTopUpPayment


@admin.register(CustomerWallet)
class CustomerWalletAdmin(admin.ModelAdmin):
    list_display = ("id", "user_email", "balance", "currency", "is_active", "is_locked", "created_at")
    list_filter = ("is_active", "is_locked", "currency")
    search_fields = ("user__email", "user__first_name", "user__last_name")
    readonly_fields = ("created_at", "updated_at")

    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = "Customer Email"


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "transaction_id",
        "wallet_user",
        "transaction_type",
        "amount",
        "balance_before",
        "balance_after",
        "status",
        "booking_id",
        "created_at",
    )
    list_filter = ("transaction_type", "status", "created_at")
    search_fields = ("transaction_id", "wallet__user__email", "reason", "booking__id")
    readonly_fields = (
        "transaction_id",
        "created_at",
        "balance_before",
        "balance_after",
    )

    def wallet_user(self, obj):
        return obj.wallet.user.email
    wallet_user.short_description = "Customer"

    def booking_id(self, obj):
        return obj.booking.id if obj.booking else "-"
    booking_id.short_description = "Booking #"


@admin.register(WalletTopUpPayment)
class WalletTopUpPaymentAdmin(admin.ModelAdmin):
    list_display = (
        "topup_id",
        "user_email",
        "amount",
        "status",
        "razorpay_order_id",
        "razorpay_payment_id",
        "created_at",
    )
    list_filter = ("status", "created_at")
    search_fields = (
        "topup_id",
        "user__email",
        "razorpay_order_id",
        "razorpay_payment_id",
    )
    readonly_fields = ("topup_id", "created_at", "updated_at")

    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = "Customer Email"


