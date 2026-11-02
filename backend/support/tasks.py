import logging
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from .models import SupportTicket, TicketMessage

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_ticket_created_emails_task(self, ticket_id):
    """
    Asynchronously sends confirmation email to the salon owner
    and alert email to the platform super admin when a new ticket is raised.
    """
    try:
        ticket = (
            SupportTicket.objects
            .select_related("salon", "created_by")
            .get(id=ticket_id)
        )
    except SupportTicket.DoesNotExist:
        logger.warning("Support ticket #%s not found for created emails.", ticket_id)
        return False

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon Support <support@bookmysalon.com>")
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")

    # 1. Email to Salon Owner
    owner_email = ticket.created_by.email or getattr(ticket.salon, "email", None)
    if owner_email:
        owner_name = ticket.created_by.get_full_name() or "Salon Owner"
        owner_subject = f"[BookMySalon Support] Ticket #{ticket.ticket_number} Received: {ticket.subject}"
        owner_body = (
            f"Hello {owner_name},\n\n"
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
        try:
            send_mail(
                subject=owner_subject,
                message=owner_body,
                from_email=from_email,
                recipient_list=[owner_email],
                fail_silently=False,
            )
            logger.info("Sent ticket created email to owner %s for ticket #%s", owner_email, ticket.ticket_number)
        except Exception as exc:
            logger.exception("Failed to send ticket created email to owner: %s", exc)

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
    try:
        send_mail(
            subject=admin_subject,
            message=admin_body,
            from_email=from_email,
            recipient_list=[admin_email],
            fail_silently=False,
        )
        logger.info("Sent ticket alert email to admin %s for ticket #%s", admin_email, ticket.ticket_number)
    except Exception as exc:
        logger.exception("Failed to send ticket created email to admin: %s", exc)

    return True


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_admin_reply_email_task(self, ticket_id, message_id):
    """
    Asynchronously notifies the salon owner that Super Admin has replied to their ticket.
    """
    try:
        ticket = SupportTicket.objects.select_related("salon", "created_by").get(id=ticket_id)
        msg_obj = TicketMessage.objects.get(id=message_id)
    except (SupportTicket.DoesNotExist, TicketMessage.DoesNotExist) as e:
        logger.warning("Ticket or Message not found for admin reply email: %s", e)
        return False

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon Support <support@bookmysalon.com>")
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    owner_email = ticket.created_by.email or getattr(ticket.salon, "email", None)

    if owner_email:
        owner_name = ticket.created_by.get_full_name() or "Salon Owner"
        subject = f"[Support Update] New Reply on Ticket #{ticket.ticket_number}: {ticket.subject}"
        body = (
            f"Hello {owner_name},\n\n"
            f"The BookMySalon Super Admin support team has replied to your ticket #{ticket.ticket_number}.\n\n"
            f"Latest Reply:\n"
            f"-----------------------------------------\n"
            f"{msg_obj.message}\n"
            f"-----------------------------------------\n\n"
            f"Current Status: {ticket.get_status_display()}\n\n"
            f"View conversation & respond here:\n"
            f"{frontend_url}/owner/support\n\n"
            f"Best regards,\n"
            f"BookMySalon Support Team"
        )
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[owner_email],
                fail_silently=False,
            )
            logger.info("Sent admin reply email to owner %s for ticket #%s", owner_email, ticket.ticket_number)
            return True
        except Exception as exc:
            logger.exception("Failed to send admin reply email: %s", exc)
            raise exc

    return False


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_owner_reply_email_task(self, ticket_id, message_id):
    """
    Asynchronously notifies the Super Admin that the salon owner has responded.
    """
    try:
        ticket = SupportTicket.objects.select_related("salon", "created_by").get(id=ticket_id)
        msg_obj = TicketMessage.objects.get(id=message_id)
    except (SupportTicket.DoesNotExist, TicketMessage.DoesNotExist) as e:
        logger.warning("Ticket or Message not found for owner reply email: %s", e)
        return False

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon Support <support@bookmysalon.com>")
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    admin_email = getattr(settings, "EMAIL_HOST_USER", None) or from_email

    subject = f"[Salon Reply] #{ticket.ticket_number} - {ticket.salon.name}"
    body = (
        f"Super Admin Alert:\n\n"
        f"Salon '{ticket.salon.name}' has posted a new reply to Ticket #{ticket.ticket_number}.\n\n"
        f"Reply Content:\n"
        f"-----------------------------------------\n"
        f"{msg_obj.message}\n"
        f"-----------------------------------------\n\n"
        f"Open ticket in Admin Dashboard:\n"
        f"{frontend_url}/admin/support\n"
    )
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=from_email,
            recipient_list=[admin_email],
            fail_silently=False,
        )
        logger.info("Sent owner reply email alert to admin %s for ticket #%s", admin_email, ticket.ticket_number)
        return True
    except Exception as exc:
        logger.exception("Failed to send owner reply alert to admin: %s", exc)
        raise exc


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_status_update_email_task(self, ticket_id, old_status, new_status):
    """
    Asynchronously notifies the salon owner when ticket status changes (e.g. Resolved, Closed).
    """
    try:
        ticket = SupportTicket.objects.select_related("salon", "created_by").get(id=ticket_id)
    except SupportTicket.DoesNotExist:
        logger.warning("Ticket #%s not found for status update email.", ticket_id)
        return False

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon Support <support@bookmysalon.com>")
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    owner_email = ticket.created_by.email or getattr(ticket.salon, "email", None)

    if owner_email:
        owner_name = ticket.created_by.get_full_name() or "Salon Owner"
        subject = f"[Status Update] Ticket #{ticket.ticket_number} is now {ticket.get_status_display()}"
        reopen_note = ""
        if new_status in ["RESOLVED", "CLOSED"]:
            reopen_note = (
                "\n\nIf you believe this issue has not been completely resolved, you can reopen "
                "this ticket at any time from your dashboard."
            )

        body = (
            f"Hello {owner_name},\n\n"
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
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[owner_email],
                fail_silently=False,
            )
            logger.info("Sent status update email to owner %s for ticket #%s", owner_email, ticket.ticket_number)
            return True
        except Exception as exc:
            logger.exception("Failed to send status update email: %s", exc)
            raise exc

    return False

