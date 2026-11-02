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
    Creates an in-app notification immediately and dispatches
    ticket creation emails asynchronously via Celery.
    """
    try:
        # In-app notification for owner
        create_in_app_notification(
            recipient=ticket.created_by,
            title=f"Ticket #{ticket.ticket_number} Raised",
            message=f"Your ticket '{ticket.subject}' has been submitted.",
            data={"ticket_id": ticket.id, "ticket_number": ticket.ticket_number},
        )
    except Exception as e:
        logger.warning(f"Error creating in-app notification: {e}")

    try:
        from .tasks import send_ticket_created_emails_task
        send_ticket_created_emails_task.delay(ticket.id)
    except Exception as e:
        logger.warning("Celery dispatch failed (%s), running synchronously.", e)
        try:
            from .tasks import send_ticket_created_emails_task
            send_ticket_created_emails_task(ticket.id)
        except Exception as sync_e:
            logger.error("Synchronous ticket created emails also failed: %s", sync_e)


def send_admin_reply_email(ticket, message_obj):
    """
    Creates an in-app notification immediately and dispatches
    the admin reply email to the salon owner asynchronously via Celery.
    """
    try:
        create_in_app_notification(
            recipient=ticket.created_by,
            title=f"New Reply on Ticket #{ticket.ticket_number}",
            message=message_obj.message[:120],
            data={"ticket_id": ticket.id, "ticket_number": ticket.ticket_number},
        )
    except Exception as e:
        logger.warning(f"Error creating in-app reply notification: {e}")

    try:
        from .tasks import send_admin_reply_email_task
        send_admin_reply_email_task.delay(ticket.id, message_obj.id)
    except Exception as e:
        logger.warning("Celery dispatch failed (%s), running synchronously.", e)
        try:
            from .tasks import send_admin_reply_email_task
            send_admin_reply_email_task(ticket.id, message_obj.id)
        except Exception as sync_e:
            logger.error("Synchronous admin reply email also failed: %s", sync_e)


def send_owner_reply_email(ticket, message_obj):
    """
    Dispatches owner reply notification to the super admin asynchronously via Celery.
    """
    try:
        from .tasks import send_owner_reply_email_task
        send_owner_reply_email_task.delay(ticket.id, message_obj.id)
    except Exception as e:
        logger.warning("Celery dispatch failed (%s), running synchronously.", e)
        try:
            from .tasks import send_owner_reply_email_task
            send_owner_reply_email_task(ticket.id, message_obj.id)
        except Exception as sync_e:
            logger.error("Synchronous owner reply email also failed: %s", sync_e)


def send_status_update_email(ticket, old_status, new_status):
    """
    Creates an in-app status notification immediately and dispatches
    status update email to the salon owner asynchronously via Celery.
    """
    try:
        create_in_app_notification(
            recipient=ticket.created_by,
            title=f"Ticket #{ticket.ticket_number} Status: {ticket.get_status_display()}",
            message=f"Status changed from {old_status} to {ticket.get_status_display()}.",
            data={"ticket_id": ticket.id, "ticket_number": ticket.ticket_number, "status": new_status},
        )
    except Exception as e:
        logger.warning(f"Error creating in-app status notification: {e}")

    try:
        from .tasks import send_status_update_email_task
        send_status_update_email_task.delay(ticket.id, old_status, new_status)
    except Exception as e:
        logger.warning("Celery dispatch failed (%s), running synchronously.", e)
        try:
            from .tasks import send_status_update_email_task
            send_status_update_email_task(ticket.id, old_status, new_status)
        except Exception as sync_e:
            logger.error("Synchronous status update email also failed: %s", sync_e)


