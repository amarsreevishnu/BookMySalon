import re
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class SupportTicket(models.Model):
    class Category(models.TextChoices):
        TECHNICAL = "TECHNICAL", "Technical Issue"
        PAYMENT = "PAYMENT", "Payment Problem"
        BOOKING = "BOOKING", "Booking Issue"
        ACCOUNT = "ACCOUNT", "Account-related Problem"
        OTHER = "OTHER", "Other Difficulties"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        WAITING_FOR_CUSTOMER = "WAITING_FOR_CUSTOMER", "Waiting for Customer"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"

    ticket_number = models.CharField(
        max_length=32,
        unique=True,
        db_index=True,
        blank=True,
        help_text="Unique identifier like TKT-1001",
    )
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="support_tickets",
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="support_tickets_created",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="support_tickets_assigned",
    )
    subject = models.CharField(max_length=255)
    category = models.CharField(
        max_length=40,
        choices=Category.choices,
        default=Category.TECHNICAL,
        db_index=True,
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True,
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    description = models.TextField()
    attachment = models.FileField(
        upload_to="support/tickets/%Y/%m/",
        null=True,
        blank=True,
        help_text="Optional document or screenshot attachment",
    )

    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["salon", "status", "-updated_at"]),
            models.Index(fields=["status", "priority", "-updated_at"]),
        ]

    def __str__(self):
        return f"[{self.ticket_number or 'PENDING'}] {self.subject} ({self.get_status_display()})"

    @classmethod
    def generate_next_ticket_number(cls):
        """
        Generates next sequential ticket number like TKT-1001, TKT-1002, etc.
        """
        last_ticket = cls.objects.order_by("-id").first()
        if not last_ticket:
            return "TKT-1001"
        try:
            match = re.search(r"\d+", str(last_ticket.ticket_number or ""))
            next_num = (int(match.group()) + 1) if match else (last_ticket.id + 1000)
        except Exception:
            next_num = last_ticket.id + 1001

        candidate = f"TKT-{next_num}"
        while cls.objects.filter(ticket_number=candidate).exists():
            next_num += 1
            candidate = f"TKT-{next_num}"
        return candidate

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = self.generate_next_ticket_number()
        super().save(*args, **kwargs)

    @property
    def unread_count_for_owner(self):
        """Number of unread messages sent by Admin to this ticket."""
        return self.messages.filter(
            sender_type=TicketMessage.SenderType.SUPER_ADMIN,
            is_read=False,
        ).count()

    @property
    def unread_count_for_admin(self):
        """Number of unread messages sent by Salon Owner to this ticket."""
        return self.messages.filter(
            sender_type=TicketMessage.SenderType.SALON_OWNER,
            is_read=False,
        ).count()


class TicketMessage(models.Model):
    class SenderType(models.TextChoices):
        SALON_OWNER = "SALON_OWNER", "Salon Owner"
        SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"

    ticket = models.ForeignKey(
        SupportTicket,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ticket_messages_sent",
    )
    sender_type = models.CharField(
        max_length=20,
        choices=SenderType.choices,
        db_index=True,
    )
    message = models.TextField()
    attachment = models.FileField(
        upload_to="support/messages/%Y/%m/",
        null=True,
        blank=True,
        help_text="Optional screenshot or attachment for this message",
    )
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["ticket", "is_read", "created_at"]),
        ]

    def __str__(self):
        return f"Msg #{self.id} on {self.ticket.ticket_number} by {self.sender_type}"

    def mark_as_read(self, save=True):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            if save:
                self.save(update_fields=["is_read", "read_at"])


class TicketActivity(models.Model):
    class ActivityType(models.TextChoices):
        CREATED = "CREATED", "Ticket Created"
        STATUS_CHANGED = "STATUS_CHANGED", "Status Changed"
        PRIORITY_CHANGED = "PRIORITY_CHANGED", "Priority Changed"
        ASSIGNED = "ASSIGNED", "Ticket Assigned"
        OWNER_REPLIED = "OWNER_REPLIED", "Owner Replied"
        ADMIN_REPLIED = "ADMIN_REPLIED", "Admin Replied"
        REOPENED = "REOPENED", "Ticket Reopened"
        RESOLVED = "RESOLVED", "Ticket Resolved"
        CLOSED = "CLOSED", "Ticket Closed"

    ticket = models.ForeignKey(
        SupportTicket,
        on_delete=models.CASCADE,
        related_name="activities",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ticket_activities",
    )
    activity_type = models.CharField(
        max_length=40,
        choices=ActivityType.choices,
        db_index=True,
    )
    details = models.TextField(blank=True, default="")
    old_value = models.CharField(max_length=100, blank=True, default="")
    new_value = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Activity {self.activity_type} on {self.ticket.ticket_number}"
