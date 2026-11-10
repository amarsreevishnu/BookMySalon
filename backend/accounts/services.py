import logging
from decimal import Decimal
from datetime import datetime, time
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


def get_customer_blocking_summary(customer):
    """
    Computes a pre-block summary for Super Admin confirmation modal:
    - Lists upcoming CONFIRMED and PENDING bookings to be cancelled.
    - Estimates the 100% refund total for paid bookings (online & wallet).
    - Identifies any ongoing IN_PROGRESS services (which won't be cancelled).
    - Identifies COMPLETED bookings (which won't be touched).
    """
    if not customer:
        return {
            "customer_id": None,
            "customer_email": "",
            "customer_name": "",
            "upcoming_count": 0,
            "upcoming_bookings": [],
            "in_progress_count": 0,
            "completed_count": 0,
            "estimated_refund_amount": "0.00",
        }

    try:
        from bookings.models import Booking
        from payments.models import Payment
    except Exception as imp_err:
        logger.error("Could not import models in get_customer_blocking_summary: %s", imp_err)
        return {
            "customer_id": getattr(customer, "id", None),
            "customer_email": getattr(customer, "email", ""),
            "customer_name": customer.get_full_name() if hasattr(customer, "get_full_name") else "",
            "upcoming_count": 0,
            "upcoming_bookings": [],
            "in_progress_count": 0,
            "completed_count": 0,
            "estimated_refund_amount": "0.00",
        }

    today = timezone.localdate()

    try:
        upcoming_qs = Booking.objects.filter(
            customer=customer,
            status__in=[Booking.Status.CONFIRMED, Booking.Status.PENDING],
            booking_date__gte=today,
        ).select_related("salon").order_by("booking_date", "start_time")

        upcoming_list = []
        total_estimated_refund = Decimal("0.00")

        for b in upcoming_qs:
            # Determine actual amount paid
            paid_amount = Decimal("0.00")
            paid_payments = Payment.objects.filter(
                booking=b,
                payment_status__in=[Payment.PaymentStatus.PAID, Payment.PaymentStatus.PARTIALLY_PAID],
            )
            if paid_payments.exists():
                paid_amount = sum(Decimal(str(p.amount)) for p in paid_payments)
            elif b.is_advance_paid and b.advance_amount:
                paid_amount = Decimal(str(b.advance_amount))
            elif b.is_fully_paid or b.payment_status == Booking.PaymentStatus.PAID:
                total_val = b.total_amount if b.total_amount is not None else b.service_price
                paid_amount = Decimal(str(total_val or "0.00"))

            total_estimated_refund += paid_amount

            time_str = b.booking_time or (b.start_time.strftime("%I:%M %p") if b.start_time else "")
            upcoming_list.append({
                "id": b.id,
                "salon_id": b.salon_id,
                "salon_name": b.salon.name if b.salon else "Salon",
                "service_name": b.service_name or "Service",
                "booking_date": str(b.booking_date),
                "booking_time": time_str,
                "status": b.status,
                "payment_method": b.payment_method,
                "payment_status": b.payment_status,
                "paid_amount": str(paid_amount.quantize(Decimal("0.01"))),
            })

        in_progress_count = Booking.objects.filter(
            customer=customer,
            status=Booking.Status.IN_PROGRESS,
        ).count()

        completed_count = Booking.objects.filter(
            customer=customer,
            status=Booking.Status.COMPLETED,
        ).count()

        return {
            "customer_id": customer.id,
            "customer_email": customer.email,
            "customer_name": customer.get_full_name() if hasattr(customer, "get_full_name") else customer.email,
            "upcoming_count": len(upcoming_list),
            "upcoming_bookings": upcoming_list,
            "in_progress_count": in_progress_count,
            "completed_count": completed_count,
            "estimated_refund_amount": str(total_estimated_refund.quantize(Decimal("0.01"))),
        }
    except Exception as err:
        logger.warning("Error computing customer blocking summary for user %s: %s", getattr(customer, "id", None), err)
        return {
            "customer_id": getattr(customer, "id", None),
            "customer_email": getattr(customer, "email", ""),
            "customer_name": "",
            "upcoming_count": 0,
            "upcoming_bookings": [],
            "in_progress_count": 0,
            "completed_count": 0,
            "estimated_refund_amount": "0.00",
        }


def send_customer_blocked_email(customer, cancelled_count=0, total_refunded=Decimal("0.00"), reason="USER_BLOCKED_BY_ADMIN"):
    """
    Sends an administrative notification email to the customer explaining their account suspension
    and booking cancellations / wallet refunds.
    """
    if not customer or not getattr(customer, "email", None):
        return False

    name = customer.get_full_name() or customer.email.split("@")[0]
    subject = "Account Notification: Your BookMySalon Customer Account Has Been Suspended"
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon Administration <noreply@bookmysalon.com>")
    refund_str = f"₹{Decimal(str(total_refunded)).quantize(Decimal('0.01'))}"

    cancellation_details_html = ""
    if cancelled_count > 0:
        cancellation_details_html = f"""
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 18px 0; border-radius: 4px;">
            <p style="margin: 0; color: #991b1b; font-weight: 600; font-size: 14px;">
                Appointments Cancelled: {cancelled_count} upcoming booking(s)
            </p>
            <p style="margin: 6px 0 0 0; color: #7f1d1d; font-size: 13px;">
                All upcoming appointment slots have been released. A 100% full refund of <strong>{refund_str}</strong> has been credited to your BookMySalon Wallet.
            </p>
        </div>
        """

    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7faf8; color: #172a1d; padding: 24px; }}
        .card {{ background: #ffffff; max-width: 600px; margin: 0 auto; border-radius: 12px; border: 1px solid #e1ece4; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }}
        .badge {{ display: inline-block; background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }}
        h2 {{ color: #172a1d; margin-top: 14px; font-size: 22px; }}
        p {{ font-size: 14px; line-height: 1.6; color: #405648; }}
        .footer {{ margin-top: 28px; padding-top: 16px; border-top: 1px solid #edf2ee; font-size: 12px; color: #738a7c; }}
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge">Administrative Account Restriction</span>
        <h2>Account Suspension Notice</h2>
        <p>Dear {name},</p>
        <p>
          We are writing to notify you that your BookMySalon customer account has been suspended by administration. 
          As a result, access to your account and customer booking features is currently restricted.
        </p>

        {cancellation_details_html}

        <p>
          If you have active appointments currently in-progress at a salon venue, those will conclude safely according to salon guidelines.
        </p>
        <p>
          If you believe this suspension is in error or have inquiries regarding your wallet balance, please contact our administrative support helpdesk.
        </p>
        <div class="footer">
          BookMySalon Administration &bull; Automated Platform Governance
        </div>
      </div>
    </body>
    </html>
    """

    plain_message = (
        f"Dear {name},\n\n"
        f"Your BookMySalon customer account has been suspended by administration.\n"
        f"Upcoming bookings cancelled: {cancelled_count}.\n"
        f"Total refunded to your BookMySalon Wallet: {refund_str}.\n\n"
        f"If you believe this is in error, please contact BookMySalon support.\n"
    )

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=from_email,
            recipient_list=[customer.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info("Sent customer suspension email to %s.", customer.email)
        return True
    except Exception as e:
        logger.warning("Failed to send customer suspension email to %s: %s", customer.email, e)
        return False


def handle_customer_blocked(customer, admin_user=None, admin_notes="", reason="USER_BLOCKED_BY_ADMIN"):
    """
    Automated workflow when Super Admin blocks a customer:
    1. Blocks customer account immediately: sets is_active=False.
    2. Identifies all upcoming bookings (status in CONFIRMED, PENDING, booking_date >= today).
       - IN_PROGRESS bookings are never interrupted or auto-cancelled.
       - COMPLETED bookings are never touched.
    3. Cancels upcoming bookings with cancellation reason: USER_BLOCKED_BY_ADMIN.
       - Automatically releases time slots for other customers.
    4. Issues 100% full refund for paid bookings (online / wallet) directly into customer wallet.
       - Pay-at-salon bookings cancelled without refund (no payment collected).
       - Processed independently per booking to prevent duplicate refunds (idempotent).
       - Debits applicable refund from salon owner's wallet.
    5. Records cancellation in BookingHistory with action=CANCELLED, reason=USER_BLOCKED_BY_ADMIN.
    6. Sends notifications:
       - Customer: booking cancellation & refund confirmation.
       - Salon owner: notification detailing customer restriction and slot release.
       - Worker: appointment cancellation notification.
       - Customer account suspension notification.
    7. Sends notification email to customer.
    """
    if not customer:
        return {
            "cancelled_bookings_count": 0,
            "refunded_bookings_count": 0,
            "total_refunded_amount": Decimal("0.00"),
            "in_progress_bookings_count": 0,
            "email_sent": False,
        }

    # 1. Immediately deactivate customer account
    customer.is_active = False
    try:
        customer.save(update_fields=["is_active"])
    except Exception as save_err:
        logger.warning("Failed to save is_active status in handle_customer_blocked: %s", save_err)

    # Required model imports
    try:
        from bookings.models import Booking, BookingHistory
        from payments.services import process_booking_cancellation_and_refund
        from notifications.services import (
            notify_booking_cancelled,
            notify_refund_completed,
            create_notification,
        )
        from notifications.models import Notification
    except Exception as imp_err:
        logger.error("Failed to import required modules for handle_customer_blocked: %s", imp_err)
        return {
            "cancelled_bookings_count": 0,
            "refunded_bookings_count": 0,
            "total_refunded_amount": Decimal("0.00"),
            "in_progress_bookings_count": 0,
            "email_sent": False,
        }

    customer_id = getattr(customer, "id", None)
    if not customer_id or not isinstance(customer_id, int):
        return {
            "cancelled_bookings_count": 0,
            "refunded_bookings_count": 0,
            "total_refunded_amount": Decimal("0.00"),
            "in_progress_bookings_count": 0,
            "email_sent": False,
        }

    today = timezone.localdate()

    # Query upcoming CONFIRMED and PENDING bookings
    try:
        upcoming_qs = list(
            Booking.objects.filter(
                customer_id=customer_id,
                status__in=[Booking.Status.CONFIRMED, Booking.Status.PENDING],
                booking_date__gte=today,
            ).select_related("salon", "salon__owner", "worker", "worker__user").order_by("booking_date", "start_time")
        )
    except Exception as q_err:
        logger.warning("Could not query upcoming bookings for customer %s: %s", customer_id, q_err)
        upcoming_qs = []

    # Count in-progress bookings (ongoing services are explicitly preserved)
    try:
        in_progress_count = Booking.objects.filter(
            customer_id=customer_id,
            status=Booking.Status.IN_PROGRESS,
        ).count()
    except Exception:
        in_progress_count = 0

    cancelled_count = 0
    refunded_count = 0
    total_refunded = Decimal("0.00")

    cancel_reason = "USER_BLOCKED_BY_ADMIN"
    cancel_detail = (
        f"USER_BLOCKED_BY_ADMIN: {admin_notes}".strip()
        if admin_notes
        else "USER_BLOCKED_BY_ADMIN: Customer account restricted by Super Admin"
    )

    for booking in upcoming_qs:
        old_status = booking.status
        try:
            # Process cancellation and full 100% refund (force_refund=True ensures 100% refund)
            refund, owner_tx = process_booking_cancellation_and_refund(
                booking=booking,
                reason=cancel_detail,
                processed_by=admin_user,
                force_refund=True,
            )
            cancelled_count += 1
            refund_amount = Decimal("0.00")
            if refund and getattr(refund, "amount", None) and refund.amount > Decimal("0.00"):
                refunded_count += 1
                refund_amount = refund.amount
                total_refunded += refund_amount

            # 5. Maintain BookingHistory record
            try:
                BookingHistory.objects.create(
                    booking=booking,
                    action=BookingHistory.Action.CANCELLED,
                    previous_status=old_status,
                    new_status=Booking.Status.CANCELLED,
                    changed_by=admin_user,
                    reason=cancel_reason,
                    notes=(
                        f"Auto-cancelled due to customer account blocked by Super Admin. "
                        f"Payment method: {booking.payment_method}. Refund: ₹{refund_amount}."
                    ),
                    metadata={
                        "cancelled_by": "SUPER_ADMIN",
                        "admin_id": getattr(admin_user, "id", None) if admin_user else None,
                        "customer_id": customer_id,
                        "customer_email": getattr(customer, "email", ""),
                        "salon_id": getattr(booking.salon, "id", None),
                        "salon_name": getattr(booking.salon, "name", ""),
                        "payment_method": booking.payment_method,
                        "refund_amount": str(refund_amount),
                        "refund_id": getattr(refund, "id", None) if refund else None,
                        "action_reason": cancel_reason,
                    },
                )
            except Exception as hist_err:
                logger.warning("Could not record BookingHistory for booking #%s: %s", booking.id, hist_err)

            # 6. Notify Customer & Worker
            try:
                notify_booking_cancelled(
                    booking=booking,
                    cancelled_by=admin_user,
                    reason="Customer account restricted by administrative action (USER_BLOCKED_BY_ADMIN)",
                )
                if refund and getattr(refund, "amount", None) and refund.amount > Decimal("0.00"):
                    notify_refund_completed(booking=booking, amount=refund.amount)
            except Exception as notif_err:
                logger.warning("Failed to send booking cancellation notification for #%s: %s", booking.id, notif_err)

            # 7. Notify Salon Owner
            owner = getattr(booking.salon, "owner", None)
            if owner:
                try:
                    time_display = booking.booking_time or (booking.start_time.strftime("%I:%M %p") if booking.start_time else "")
                    create_notification(
                        recipient=owner,
                        notification_type=Notification.NotificationType.BOOKING_CANCELLED,
                        title="Booking Cancelled: Customer Account Restricted",
                        message=(
                            f"Appointment #{booking.id} for {booking.client_name} ({booking.service_name}) "
                            f"on {booking.booking_date} at {time_display} was automatically cancelled due to an "
                            f"administrative account restriction on the customer. The salon time slot has been released."
                        ),
                        data={
                            "booking_id": booking.id,
                            "salon_id": booking.salon_id,
                            "customer_id": customer_id,
                            "reason": cancel_reason,
                        },
                        sender=admin_user,
                    )
                except Exception as owner_notif_err:
                    logger.warning("Failed to send salon owner notification for booking #%s: %s", booking.id, owner_notif_err)

        except Exception as b_err:
            logger.error("Failed to cancel booking #%s during customer block: %s", booking.id, b_err, exc_info=True)

    # Send general account suspension notification to customer
    try:
        create_notification(
            recipient=customer,
            notification_type=Notification.NotificationType.GENERAL,
            title="Account Suspended by Administration",
            message=(
                f"Your customer account has been suspended by administration. "
                f"{cancelled_count} upcoming appointment(s) have been cancelled and "
                f"₹{total_refunded} has been credited to your BookMySalon wallet."
                if cancelled_count > 0
                else "Your customer account has been suspended by administration."
            ),
            data={
                "reason": cancel_reason,
                "cancelled_count": cancelled_count,
                "refunded_amount": str(total_refunded),
            },
            sender=admin_user,
        )
    except Exception as cust_notif_err:
        logger.warning("Failed to send customer general suspension notification: %s", cust_notif_err)

    # Send notification email to customer
    email_sent = False
    try:
        email_sent = send_customer_blocked_email(
            customer=customer,
            cancelled_count=cancelled_count,
            total_refunded=total_refunded,
            reason=cancel_reason,
        )
    except Exception as email_err:
        logger.warning("Failed to dispatch customer suspension email: %s", email_err)

    return {
        "cancelled_bookings_count": cancelled_count,
        "refunded_bookings_count": refunded_count,
        "total_refunded_amount": total_refunded,
        "in_progress_bookings_count": in_progress_count,
        "email_sent": email_sent,
    }
