from datetime import timedelta
from django.utils import timezone
from .models import Salon


def get_expiring_salon_registrations(days_threshold=30):
    """
    Returns salons whose business registration has expired or is expiring within `days_threshold` days.
    """
    today = timezone.now().date()
    threshold_date = today + timedelta(days=days_threshold)

    expiring = Salon.objects.filter(
        registration_valid_to__isnull=False,
        registration_valid_to__gte=today,
        registration_valid_to__lte=threshold_date,
    ).order_by("registration_valid_to")

    expired = Salon.objects.filter(
        registration_valid_to__isnull=False,
        registration_valid_to__lt=today,
    ).order_by("registration_valid_to")

    return {
        "expiring_soon": expiring,
        "expired": expired,
        "today": today,
    }


def send_registration_expiry_alert(salon):
    """
    Sends an in-app notification and email to the salon owner about their expiring/expired registration.
    """
    if not salon:
        return False

    today = timezone.now().date()
    valid_to = salon.registration_valid_to
    if not valid_to:
        return False

    days_left = (valid_to - today).days

    if days_left < 0:
        title = "⚠️ Salon Registration Expired"
        message = (
            f"Your salon registration certificate for '{salon.name}' expired on {valid_to.strftime('%d-%m-%Y')}. "
            "Please upload your renewed certificate and validity dates to maintain your verified venue status."
        )
    elif days_left <= 30:
        title = f"⚠️ Salon Registration Expiring in {days_left} Days"
        message = (
            f"Your registration certificate for '{salon.name}' will expire on {valid_to.strftime('%d-%m-%Y')} "
            f"({days_left} days remaining). Please prepare your renewed certificate."
        )
    else:
        return False

    # Send in-app notification if owner exists
    if salon.owner:
        try:
            from notifications.services import create_notification
            create_notification(
                recipient=salon.owner,
                notification_type="SYSTEM",
                title=title,
                message=message,
                data={
                    "salon_id": salon.id,
                    "salon_name": salon.name,
                    "valid_to": str(valid_to),
                    "days_left": days_left,
                    "action": "renew_registration",
                },
            )
        except Exception:
            pass

    return True


def handle_salon_blocked(salon, admin_user=None, admin_notes=""):
    """
    Automated process triggered when Super Admin blocks a salon:
    1. Blocks and disables salon: immediately sets approval_status to BLOCKED.
    2. Identifies and cancels all upcoming bookings (status in CONFIRMED, PENDING, booking_date >= today):
       - Completed bookings are not affected.
       - In-progress bookings are handled separately (not automatically cancelled).
    3. Issues 100% full refunds for paid bookings (online / wallet) directly into customer wallet.
       - Pay-at-salon bookings cancelled without refund.
       - Deducts refund amounts from salon owner's wallet with proper transaction records.
       - Idempotent: safe against duplicate runs.
    4. Records cancellation in BookingHistory for dispute and admin audit trail.
    5. Sends notifications to affected customers, worker, and salon owner.
    6. Sends official notification email to salon owner that the salon is blocked.
    """
    import logging
    from decimal import Decimal
    from django.utils import timezone

    logger = logging.getLogger(__name__)

    if not salon:
        return {
            "cancelled_bookings_count": 0,
            "refunded_bookings_count": 0,
            "total_refunded_amount": Decimal("0.00"),
            "in_progress_bookings_count": 0,
            "email_sent": False,
        }

    # 1. Update Salon status
    salon.approval_status = Salon.ApprovalStatus.BLOCKED
    if admin_notes:
        salon.admin_notes = admin_notes
    try:
        salon.save()
    except Exception as save_err:
        logger.warning(f"Failed to save salon status update in handle_salon_blocked: {save_err}")

    # Imports
    try:
        from bookings.models import Booking, BookingHistory
        from payments.services import process_booking_cancellation_and_refund
        from notifications.services import (
            notify_booking_cancelled,
            notify_refund_completed,
            create_notification,
        )
        from notifications.models import Notification
        from salons.email_utils import send_salon_blocked_email
    except Exception as imp_err:
        logger.error(f"Failed to import required modules for handle_salon_blocked: {imp_err}")
        return {
            "cancelled_bookings_count": 0,
            "refunded_bookings_count": 0,
            "total_refunded_amount": Decimal("0.00"),
            "in_progress_bookings_count": 0,
            "email_sent": False,
        }

    salon_id = getattr(salon, "id", None)
    if not salon_id or not isinstance(salon_id, int):
        return {
            "cancelled_bookings_count": 0,
            "refunded_bookings_count": 0,
            "total_refunded_amount": Decimal("0.00"),
            "in_progress_bookings_count": 0,
            "email_sent": False,
        }

    today = timezone.localdate()

    # Upcoming bookings query:
    # Exclude completed, in_progress, cancelled, no_show
    # Include confirmed and pending where booking_date >= today
    try:
        bookings_qs = list(
            Booking.objects.filter(
                salon_id=salon_id,
                status__in=[Booking.Status.CONFIRMED, Booking.Status.PENDING],
                booking_date__gte=today,
            ).order_by("booking_date", "start_time")
        )
    except Exception as q_err:
        logger.warning(f"Could not query upcoming bookings for salon {salon_id}: {q_err}")
        bookings_qs = []

    try:
        in_progress_count = Booking.objects.filter(
            salon_id=salon_id,
            status=Booking.Status.IN_PROGRESS,
        ).count()
    except Exception:
        in_progress_count = 0

    cancelled_count = 0
    refunded_count = 0
    total_refunded = Decimal("0.00")

    cancel_reason = (
        f"Salon suspended by Super Admin: {admin_notes}".strip()
        if admin_notes
        else "Salon suspended by Super Admin"
    )

    for booking in bookings_qs:
        old_status = booking.status
        try:
            # Cancel booking and process refund if paid
            refund, owner_tx = process_booking_cancellation_and_refund(
                booking=booking,
                reason=cancel_reason,
                processed_by=admin_user,
                force_refund=True,
            )
            cancelled_count += 1
            refund_amount = Decimal("0.00")
            if refund and getattr(refund, "amount", None) and refund.amount > Decimal("0.00"):
                refunded_count += 1
                refund_amount = refund.amount
                total_refunded += refund_amount

            # Record in BookingHistory
            try:
                BookingHistory.objects.create(
                    booking=booking,
                    action=BookingHistory.Action.CANCELLED,
                    previous_status=old_status,
                    new_status=Booking.Status.CANCELLED,
                    changed_by=admin_user,
                    reason=cancel_reason,
                    notes=(
                        f"Auto-cancelled due to salon suspension. Payment method: {booking.payment_method}. "
                        f"Refund: ₹{refund_amount}."
                    ),
                    metadata={
                        "cancelled_by": "SUPER_ADMIN",
                        "admin_id": getattr(admin_user, "id", None) if admin_user else None,
                        "salon_id": salon_id,
                        "salon_name": getattr(salon, "name", ""),
                        "payment_method": booking.payment_method,
                        "refund_amount": str(refund_amount),
                        "refund_id": getattr(refund, "id", None) if refund else None,
                    },
                )
            except Exception as hist_err:
                logger.warning(f"Could not record BookingHistory for booking #{booking.id}: {hist_err}")

            # Notify Customer & Worker
            try:
                notify_booking_cancelled(booking, cancelled_by=admin_user, reason=cancel_reason)
                if refund and getattr(refund, "amount", None) and refund.amount > Decimal("0.00"):
                    notify_refund_completed(booking, amount=refund.amount)
            except Exception as notif_err:
                logger.warning(f"Failed to send booking cancellation notification for #{booking.id}: {notif_err}")

        except Exception as b_err:
            logger.error(f"Failed to cancel booking #{booking.id} during salon block: {b_err}", exc_info=True)

    # 3. Notify Salon Owner (in-app)
    owner = getattr(salon, "owner", None)
    if owner:
        try:
            create_notification(
                recipient=owner,
                notification_type=Notification.NotificationType.GENERAL,
                title=f"Salon Suspended: {salon.name}",
                message=(
                    f"Your salon '{salon.name}' has been suspended / blocked by administration. "
                    f"{cancelled_count} upcoming booking(s) were automatically cancelled and refunded where applicable."
                    + (f" Reason: {admin_notes}" if admin_notes else "")
                ),
                data={
                    "salon_id": salon_id,
                    "salon_name": getattr(salon, "name", ""),
                    "cancelled_bookings_count": cancelled_count,
                    "refunded_bookings_count": refunded_count,
                    "total_refunded_amount": str(total_refunded),
                    "admin_notes": admin_notes,
                },
                sender=admin_user,
            )
        except Exception as owner_notif_err:
            logger.warning(f"Failed to send in-app notification to salon owner: {owner_notif_err}")

    # 4. Dispatch Email to Salon Owner
    email_sent = False
    try:
        email_sent = send_salon_blocked_email(
            salon=salon,
            reason=admin_notes,
            cancelled_count=cancelled_count,
            total_refunded=total_refunded,
        )
    except Exception as email_err:
        logger.error(f"Failed to dispatch salon blocked email for salon {salon_id}: {email_err}")

    return {
        "cancelled_bookings_count": cancelled_count,
        "refunded_bookings_count": refunded_count,
        "total_refunded_amount": total_refunded,
        "in_progress_bookings_count": in_progress_count,
        "email_sent": email_sent,
    }
