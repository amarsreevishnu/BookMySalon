from django.contrib import admin
from .models import SupportTicket, TicketMessage, TicketActivity


class TicketMessageInline(admin.TabularInline):
    model = TicketMessage
    extra = 0
    readonly_fields = ("created_at", "read_at")
    fields = ("sender", "sender_type", "message", "attachment", "is_read", "created_at")


class TicketActivityInline(admin.TabularInline):
    model = TicketActivity
    extra = 0
    readonly_fields = ("activity_type", "user", "details", "old_value", "new_value", "created_at")


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = (
        "ticket_number",
        "subject",
        "salon",
        "created_by",
        "category",
        "priority",
        "status",
        "created_at",
        "updated_at",
    )
    list_filter = ("status", "priority", "category", "created_at")
    search_fields = ("ticket_number", "subject", "salon__name", "created_by__email")
    readonly_fields = ("ticket_number", "created_at", "updated_at", "resolved_at", "closed_at")
    inlines = [TicketMessageInline, TicketActivityInline]


@admin.register(TicketMessage)
class TicketMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "sender", "sender_type", "is_read", "created_at")
    list_filter = ("sender_type", "is_read", "created_at")
    search_fields = ("ticket__ticket_number", "sender__email", "message")


@admin.register(TicketActivity)
class TicketActivityAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "activity_type", "user", "created_at")
    list_filter = ("activity_type", "created_at")
    search_fields = ("ticket__ticket_number", "details")
