import logging
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from .models import TicketActivity

logger = logging.getLogger(__name__)


def log_ticket_activity(ticket, user, activity_type, details="", old_value="", new_value=""):
    """
    Creates an immutable audit log entry for ticket events.
    """
    try:
        return TicketActivity.objects.create(
            ticket=ticket,
            user=user if user and user.is_authenticated else None,
            activity_type=activity_type,
            details=details,
            old_value=str(old_value or ""),
            new_value=str(new_value or ""),
        )
    except Exception as e:
        logger.warning(f"Failed to log ticket activity: {e}")
        return None


def create_in_app_notification(recipient, title, message, data=None):
    """
    Creates an in-app Notification record if the notifications app is available.
    """
    try:
        from notifications.models import Notification
        Notification.objects.create(
            recipient=recipient,
            notification_type="GENERAL",
            title=title,
            message=message,
            data=data or {},
        )
    except Exception as e:
        logger.debug(f"Failed to create in-app notification: {e}")


def send_ticket_created_emails(ticket):
    """
    Sends confirmation email to salon owner and alert email to super admin.
    """
    try:
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon Support <support@bookmysalon.com>")
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")

        # 1. Email to Salon Owner
        owner_email = ticket.created_by.email or getattr(ticket.salon, "email", None)
        if owner_email:
            owner_subject = f"[BookMySalon Support] Ticket #{ticket.ticket_number} Received: {ticket.subject}"
            owner_body = (
                f"Hello {ticket.created_by.get_full_name() or 'Salon Owner'},\n\n"
                f"Your support ticket #{ticket.ticket_number} has been received by our BookMySalon Support Team.\n\n"
                f"Ticket Details:\n"
                f"• Ticket Number: {ticket.ticket_number}\n"
                f"• Salon: {ticket.salon.name}\n"
                f"• Subject: {ticket.subject}\n"
                f"• Category: {ticket.get_category_display()}\n"
                f"• Priority: {ticket.get_priority_display()}\n"
                f"• Status: {ticket.get_status_display()}\n\n"
                f"Description:\n{ticket.description}\n\n"
                f"You can view and reply to this ticket directly from your Salon Owner dashboard:\n"
                f"{frontend_url}/owner/support\n\n"
                f"Best regards,\n"
                f"BookMySalon Support Team"
            )
            send_mail(
                subject=owner_subject,
                message=owner_body,
                from_email=from_email,
                recipient_list=[owner_email],
                fail_silently=True,
            )

        # In-app notification for owner
        create_in_app_notification(
            recipient=ticket.created_by,
            title=f"Ticket #{ticket.ticket_number} Raised",
            message=f"Your ticket '{ticket.subject}' has been submitted.",
            data={"ticket_id": ticket.id, "ticket_number": ticket.ticket_number},
        )

        # 2. Email alert to Super Admin
        admin_email = getattr(settings, "EMAIL_HOST_USER", None) or from_email
        admin_subject = f"[New Support Ticket] #{ticket.ticket_number} ({ticket.get_priority_display()}) - {ticket.salon.name}"
        admin_body = (
            f"Super Admin Notification:\n\n"
            f"A new support ticket has been submitted on BookMySalon.\n\n"
            f"• Ticket Number: {ticket.ticket_number}\n"
            f"• Salon Name: {ticket.salon.name} (ID: {ticket.salon_id})\n"
            f"• Owner: {ticket.created_by.get_full_name()} ({ticket.created_by.email})\n"
            f"• Category: {ticket.get_category_display()}\n"
            f"• Priority: {ticket.get_priority_display()}\n"
            f"• Subject: {ticket.subject}\n\n"
            f"Description:\n{ticket.description}\n\n"
            f"Manage this ticket in the Super Admin dashboard:\n"
            f"{frontend_url}/admin/support\n"
        )
        send_mail(
            subject=admin_subject,
            message=admin_body,
            from_email=from_email,
            recipient_list=[admin_email],
            fail_silently=True,
        )

    except Exception as e:
        logger.warning(f"Error in send_ticket_created_emails: {e}")


def send_admin_reply_email(ticket, message_obj):
    """
    Notifies salon owner that Super Admin has replied to their ticket.
    """
    try:
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon Support <support@bookmysalon.com>")
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        owner_email = ticket.created_by.email or getattr(ticket.salon, "email", None)

        if owner_email:
            subject = f"[Support Update] New Reply on Ticket #{ticket.ticket_number}: {ticket.subject}"
            body = (
                f"Hello {ticket.created_by.get_full_name() or 'Salon Owner'},\n\n"
                f"The BookMySalon Super Admin support team has replied to your ticket #{ticket.ticket_number}.\n\n"
                f"Latest Reply:\n"
                f"-----------------------------------------\n"
                f"{message_obj.message}\n"
                f"-----------------------------------------\n\n"
                f"Current Status: {ticket.get_status_display()}\n\n"
                f"View conversation & respond here:\n"
                f"{frontend_url}/owner/support\n\n"
                f"Best regards,\n"
                f"BookMySalon Support Team"
            )
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[owner_email],
                fail_silently=True,
            )

        create_in_app_notification(
            recipient=ticket.created_by,
            title=f"New Reply on Ticket #{ticket.ticket_number}",
            message=message_obj.message[:120],
            data={"ticket_id": ticket.id, "ticket_number": ticket.ticket_number},
        )
    except Exception as e:
        logger.warning(f"Error in send_admin_reply_email: {e}")


def send_owner_reply_email(ticket, message_obj):
    """
    Notifies Super Admin that salon owner has responded.
    """
    try:
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon Support <support@bookmysalon.com>")
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        admin_email = getattr(settings, "EMAIL_HOST_USER", None) or from_email

        subject = f"[Salon Reply] #{ticket.ticket_number} - {ticket.salon.name}"
        body = (
            f"Super Admin Alert:\n\n"
            f"Salon '{ticket.salon.name}' has posted a new reply to Ticket #{ticket.ticket_number}.\n\n"
            f"Reply Content:\n"
            f"-----------------------------------------\n"
            f"{message_obj.message}\n"
            f"-----------------------------------------\n\n"
            f"Open ticket in Admin Dashboard:\n"
            f"{frontend_url}/admin/support\n"
        )
        send_mail(
            subject=subject,
            message=body,
            from_email=from_email,
            recipient_list=[admin_email],
            fail_silently=True,
        )
    except Exception as e:
        logger.warning(f"Error in send_owner_reply_email: {e}")


def send_status_update_email(ticket, old_status, new_status):
    """
    Notifies salon owner when ticket status changes (e.g. Resolved, Closed).
    """
    try:
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon Support <support@bookmysalon.com>")
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
        owner_email = ticket.created_by.email or getattr(ticket.salon, "email", None)

        if owner_email:
            subject = f"[Status Update] Ticket #{ticket.ticket_number} is now {ticket.get_status_display()}"
            reopen_note = ""
            if new_status in ["RESOLVED", "CLOSED"]:
                reopen_note = (
                    "\n\nIf you believe this issue has not been completely resolved, you can reopen "
                    "this ticket at any time from your dashboard."
                )

            body = (
                f"Hello {ticket.created_by.get_full_name() or 'Salon Owner'},\n\n"
                f"The status of your support ticket #{ticket.ticket_number} has been updated:\n\n"
                f"• Previous Status: {old_status}\n"
                f"• New Status: {ticket.get_status_display()}\n"
                f"• Subject: {ticket.subject}\n"
                f"{reopen_note}\n\n"
                f"View details:\n"
                f"{frontend_url}/owner/support\n\n"
                f"Best regards,\n"
                f"BookMySalon Support Team"
            )
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[owner_email],
                fail_silently=True,
            )

        create_in_app_notification(
            recipient=ticket.created_by,
            title=f"Ticket #{ticket.ticket_number} Status: {ticket.get_status_display()}",
            message=f"Status changed from {old_status} to {ticket.get_status_display()}.",
            data={"ticket_id": ticket.id, "ticket_number": ticket.ticket_number, "status": new_status},
        )
    except Exception as e:
        logger.warning(f"Error in send_status_update_email: {e}")

