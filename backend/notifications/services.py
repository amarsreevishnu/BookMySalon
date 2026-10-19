import logging
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import Notification

logger = logging.getLogger(__name__)
User = get_user_model()


def create_notification(recipient, notification_type, title, message, data=None, sender=None):
    """
    Safely creates a notification record. Catches and logs errors so that
    notification delivery never breaks primary business workflows.
    """
    if not recipient or not getattr(recipient, "id", None):
        return None

    try:
        return Notification.objects.create(
            recipient=recipient,
            sender=sender,
            notification_type=notification_type,
            title=str(title).strip(),
            message=str(message).strip(),
            data=data or {},
        )
    except Exception as e:
        logger.error(f"Failed to create notification for {recipient}: {e}", exc_info=True)
        return None


def notify_booking_confirmed(booking):
    """Event: Booking confirmed -> Customer receives confirmation."""
    if not booking or not booking.customer:
        return None

    service_title = booking.service_name or "Service"
    salon_name = booking.salon.name if booking.salon else "Salon"
    date_str = str(booking.booking_date)
    time_str = str(booking.booking_time or booking.start_time or "")

    return create_notification(
        recipient=booking.customer,
        notification_type=Notification.NotificationType.BOOKING_CONFIRMED,
        title=f"Booking Confirmed: {service_title}",
        message=f"Your appointment at {salon_name} for {service_title} on {date_str} at {time_str} is confirmed.",
        data={
            "booking_id": booking.id,
            "salon_id": booking.salon_id,
            "salon_name": salon_name,
            "service_name": service_title,
            "date": date_str,
            "time": time_str,
            "link": "/customer/bookings",
        },
    )


def notify_booking_cancelled(booking, cancelled_by=None, reason=""):
    """Event: Booking cancelled -> Customer and affected worker receive cancellation."""
    if not booking:
        return []

    service_title = booking.service_name or "Service"
    salon_name = booking.salon.name if booking.salon else "Salon"
    date_str = str(booking.booking_date)
    time_str = str(booking.booking_time or booking.start_time or "")
    reason_text = f" Reason: {reason}" if reason else ""

    notifications = []

    # 1. Customer receives notification
    if booking.customer:
        c_notif = create_notification(
            recipient=booking.customer,
            notification_type=Notification.NotificationType.BOOKING_CANCELLED,
            title=f"Booking Cancelled: {service_title}",
            message=f"Your appointment at {salon_name} for {service_title} on {date_str} at {time_str} has been cancelled.{reason_text}",
            data={
                "booking_id": booking.id,
                "salon_id": booking.salon_id,
                "salon_name": salon_name,
                "service_name": service_title,
                "date": date_str,
                "link": "/customer/bookings",
            },
            sender=cancelled_by,
        )
        if c_notif:
            notifications.append(c_notif)

    # 2. Worker receives notification
    if booking.worker and booking.worker.user:
        w_notif = create_notification(
            recipient=booking.worker.user,
            notification_type=Notification.NotificationType.BOOKING_CANCELLED,
            title=f"Appointment Cancelled: {service_title}",
            message=f"Appointment with client {booking.client_name} for {service_title} on {date_str} at {time_str} has been cancelled.{reason_text}",
            data={
                "booking_id": booking.id,
                "salon_id": booking.salon_id,
                "client_name": booking.client_name,
                "service_name": service_title,
                "date": date_str,
                "time": time_str,
                "link": "/worker/dashboard",
            },
            sender=cancelled_by,
        )
        if w_notif:
            notifications.append(w_notif)

    return notifications


def notify_booking_rescheduled(booking, previous_date=None, previous_time=None):
    """Event: Booking rescheduled -> Customer and worker receive updated details."""
    if not booking:
        return []

    service_title = booking.service_name or "Service"
    salon_name = booking.salon.name if booking.salon else "Salon"
    new_date = str(booking.booking_date)
    new_time = str(booking.booking_time or booking.start_time or "")
    prev_info = f" (previously {previous_date} {previous_time})" if previous_date else ""

    notifications = []

    # 1. Customer
    if booking.customer:
        c_notif = create_notification(
            recipient=booking.customer,
            notification_type=Notification.NotificationType.BOOKING_RESCHEDULED,
            title=f"Appointment Rescheduled: {service_title}",
            message=f"Your appointment at {salon_name} has been rescheduled to {new_date} at {new_time}{prev_info}.",
            data={
                "booking_id": booking.id,
                "salon_id": booking.salon_id,
                "date": new_date,
                "time": new_time,
                "link": "/customer/bookings",
            },
        )
        if c_notif:
            notifications.append(c_notif)

    # 2. Worker
    if booking.worker and booking.worker.user:
        w_notif = create_notification(
            recipient=booking.worker.user,
            notification_type=Notification.NotificationType.BOOKING_RESCHEDULED,
            title=f"Appointment Rescheduled: {booking.client_name}",
            message=f"Your session with {booking.client_name} for {service_title} is rescheduled to {new_date} at {new_time}{prev_info}.",
            data={
                "booking_id": booking.id,
                "client_name": booking.client_name,
                "date": new_date,
                "time": new_time,
                "link": "/worker/dashboard",
            },
        )
        if w_notif:
            notifications.append(w_notif)

    return notifications


def notify_booking_reassigned(booking, old_worker=None, new_worker=None):
    """Event: Booking reassigned -> Customer and newly assigned worker receive alert."""
    if not booking or not new_worker:
        return []

    service_title = booking.service_name or "Service"
    salon_name = booking.salon.name if booking.salon else "Salon"
    new_stylist_name = (
        new_worker.user.get_full_name()
        if new_worker and new_worker.user
        else (new_worker.specialization or "Specialist")
    )

    notifications = []

    # 1. Customer
    if booking.customer:
        c_notif = create_notification(
            recipient=booking.customer,
            notification_type=Notification.NotificationType.BOOKING_REASSIGNED,
            title=f"Stylist Reassigned: {service_title}",
            message=f"Your appointment at {salon_name} on {booking.booking_date} has been reassigned to specialist {new_stylist_name}.",
            data={
                "booking_id": booking.id,
                "worker_name": new_stylist_name,
                "link": "/customer/bookings",
            },
        )
        if c_notif:
            notifications.append(c_notif)

    # 2. New Worker
    if new_worker and new_worker.user:
        w_notif = create_notification(
            recipient=new_worker.user,
            notification_type=Notification.NotificationType.BOOKING_REASSIGNED,
            title=f"New Appointment Assigned: {booking.client_name}",
            message=f"You have been assigned to service client {booking.client_name} for {service_title} on {booking.booking_date} at {booking.booking_time or booking.start_time}.",
            data={
                "booking_id": booking.id,
                "client_name": booking.client_name,
                "service_name": service_title,
                "date": str(booking.booking_date),
                "link": "/worker/dashboard",
            },
        )
        if w_notif:
            notifications.append(w_notif)

    return notifications


def notify_payment_success(booking, amount=None, payment_id=""):
    """Event: Payment successful -> Customer receives receipt confirmation."""
    if not booking or not booking.customer:
        return None

    paid_amt = amount or booking.service_price or 0.00
    salon_name = booking.salon.name if booking.salon else "Salon"

    return create_notification(
        recipient=booking.customer,
        notification_type=Notification.NotificationType.PAYMENT_SUCCESS,
        title="Payment Successful",
        message=f"Your online payment of ₹{paid_amt} for appointment at {salon_name} has been processed successfully.",
        data={
            "booking_id": booking.id,
            "amount": str(paid_amt),
            "payment_id": payment_id,
            "link": "/customer/bookings",
        },
    )


def notify_payment_failed(booking, amount=None, reason=""):
    """Event: Payment failed -> Customer receives failure notification."""
    if not booking or not booking.customer:
        return None

    paid_amt = amount or getattr(booking, "service_price", 0.00)
    reason_info = f" Reason: {reason}" if reason else " Please retry payment to secure your appointment."

    return create_notification(
        recipient=booking.customer,
        notification_type=Notification.NotificationType.PAYMENT_FAILED,
        title="Payment Failed",
        message=f"Payment of ₹{paid_amt} could not be completed.{reason_info}",
        data={
            "booking_id": getattr(booking, "id", None),
            "amount": str(paid_amt),
            "reason": reason,
            "link": "/customer/bookings",
        },
    )


def notify_refund_completed(booking, amount=None):
    """Event: Refund completed -> Customer receives refund alert."""
    if not booking or not booking.customer:
        return None

    refund_amt = amount or booking.service_price or 0.00
    salon_name = booking.salon.name if booking.salon else "Salon"

    return create_notification(
        recipient=booking.customer,
        notification_type=Notification.NotificationType.REFUND_COMPLETED,
        title="Refund Completed",
        message=f"A refund of ₹{refund_amt} for your appointment at {salon_name} has been completed and will reflect in your account.",
        data={
            "booking_id": booking.id,
            "amount": str(refund_amt),
            "link": "/customer/bookings",
        },
    )


def notify_leave_decision(leave, approved=True, reason=""):
    """Event: Worker leave approved or rejected -> Worker receives notification."""
    if not leave or not leave.worker or not leave.worker.user:
        return None

    date_str = str(leave.date)
    leave_type_str = getattr(leave, "leave_type", "Leave")

    if approved:
        return create_notification(
            recipient=leave.worker.user,
            notification_type=Notification.NotificationType.LEAVE_APPROVED,
            title="Leave Request Approved",
            message=f"Your {leave_type_str} request for {date_str} has been approved by the salon management.",
            data={
                "leave_id": leave.id,
                "date": date_str,
                "status": "APPROVED",
                "link": "/worker/leave",
            },
        )
    else:
        reason_text = f" Reason: {reason}" if reason else ""
        return create_notification(
            recipient=leave.worker.user,
            notification_type=Notification.NotificationType.LEAVE_REJECTED,
            title="Leave Request Rejected",
            message=f"Your {leave_type_str} request for {date_str} has been rejected.{reason_text}",
            data={
                "leave_id": leave.id,
                "date": date_str,
                "status": "REJECTED",
                "reason": reason,
                "link": "/worker/leave",
            },
        )


def notify_new_reviews(salon_review=None, worker_review=None):
    """
    Event: New review received -> Salon owner receives salon review alert;
    worker receives specialist review alert if personally reviewed.
    """
    notifications = []

    # 1. Salon Review -> Salon Owner
    if salon_review and salon_review.salon and salon_review.salon.owner:
        customer_name = (
            salon_review.customer.get_full_name()
            if salon_review.customer
            else "A client"
        )
        comment_snippet = f' "{salon_review.comment[:80]}..."' if salon_review.comment else ""
        s_notif = create_notification(
            recipient=salon_review.salon.owner,
            notification_type=Notification.NotificationType.NEW_REVIEW_SALON,
            title=f"New Salon Review: {salon_review.rating}★",
            message=f"{customer_name} rated your salon {salon_review.rating} stars.{comment_snippet}",
            data={
                "review_id": salon_review.id,
                "rating": salon_review.rating,
                "salon_id": salon_review.salon.id,
                "booking_id": getattr(salon_review, "booking_id", None),
                "link": "/owner/dashboard",
            },
            sender=salon_review.customer,
        )
        if s_notif:
            notifications.append(s_notif)

    # 2. Worker Review -> Worker
    if worker_review and worker_review.worker and worker_review.worker.user:
        customer_name = (
            worker_review.customer.get_full_name()
            if worker_review.customer
            else "A client"
        )
        comment_snippet = f' "{worker_review.comment[:80]}..."' if worker_review.comment else ""
        w_notif = create_notification(
            recipient=worker_review.worker.user,
            notification_type=Notification.NotificationType.NEW_REVIEW_WORKER,
            title=f"New Client Review: {worker_review.rating}★",
            message=f"{customer_name} reviewed your service with {worker_review.rating} stars.{comment_snippet}",
            data={
                "review_id": worker_review.id,
                "rating": worker_review.rating,
                "booking_id": getattr(worker_review, "booking_id", None),
                "link": "/worker/dashboard",
            },
            sender=worker_review.customer,
        )
        if w_notif:
            notifications.append(w_notif)

    return notifications


def notify_salon_created(salon):
    """Event: Salon Created -> Super admins receive notification."""
    if not salon:
        return []

    # Find all platform admins and superusers
    admin_users = User.objects.filter(
        Q(is_superuser=True) | Q(role="ADMIN")
    ).filter(is_active=True).distinct()

    city_str = f" in {salon.city}" if salon.city else ""
    owner_str = f" by {salon.email}" if salon.email else ""

    notifications = []
    for admin_user in admin_users:
        notif = create_notification(
            recipient=admin_user,
            notification_type=Notification.NotificationType.SALON_CREATED,
            title=f"New Salon Registration: {salon.name}",
            message=f"Salon application '{salon.name}'{city_str} has been submitted{owner_str} and awaits administrative approval.",
            data={
                "salon_id": salon.id,
                "salon_name": salon.name,
                "email": salon.email,
                "link": "/admin/salons",
            },
        )
        if notif:
            notifications.append(notif)

    return notifications

