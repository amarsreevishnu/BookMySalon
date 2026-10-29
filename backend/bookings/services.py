import logging
from datetime import datetime, date, time
from django.utils import timezone
from .models import Booking

logger = logging.getLogger(__name__)


def get_booking_start_datetime(booking):
    """
    Computes an aware datetime representing the scheduled start of the appointment.
    Uses booking.booking_date and booking.start_time (or booking.booking_time string).
    """
    if not booking or not booking.booking_date:
        return None

    tz = timezone.get_current_timezone()

    if booking.start_time:
        naive = datetime.combine(booking.booking_date, booking.start_time)
        return timezone.make_aware(naive, tz)

    raw_time = str(booking.booking_time or "").strip()
    if not raw_time:
        return None

    clean = raw_time.split("-")[0].strip().upper()
    for fmt in ("%I:%M %p", "%I:%M%p", "%H:%M:%S", "%H:%M", "%H.%M"):
        try:
            parsed = datetime.strptime(clean, fmt).time()
            naive = datetime.combine(booking.booking_date, parsed)
            return timezone.make_aware(naive, tz)
        except ValueError:
            pass

    return None


def auto_update_no_show_bookings(bookings_qs=None, worker=None, salon=None):
    """
    Rule: If the customer's scheduled appointment time has passed and the customer
    did not arrive (booking is still CONFIRMED or PENDING, not IN_PROGRESS or COMPLETED),
    automatically mark it as NO_SHOW.

    Operates either on the provided bookings queryset, or queries for bookings for
    the given worker/salon.
    Returns the count of updated bookings.
    """
    now = timezone.now()
    today = timezone.localdate()

    if bookings_qs is None:
        bookings_qs = Booking.objects.all()
        if worker is not None:
            bookings_qs = bookings_qs.filter(worker=worker)
        elif salon is not None:
            bookings_qs = bookings_qs.filter(salon=salon)

    # Only inspect active pre-service statuses
    candidates = bookings_qs.filter(
        status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        booking_date__lte=today,
    )

    updated_count = 0
    for booking in candidates:
        is_noshow = False
        if booking.booking_date < today:
            # Past date appointment that was never started
            is_noshow = True
        else:
            # Today's appointment: check if scheduled start time has passed
            start_dt = get_booking_start_datetime(booking)
            if start_dt and start_dt <= now:
                is_noshow = True

        if is_noshow:
            old_status = booking.status
            booking.status = Booking.Status.NO_SHOW
            booking.save(update_fields=["status", "updated_at"])
            updated_count += 1
            logger.info(
                "Auto-marked Booking #%s as NO_SHOW (was %s, scheduled %s %s)",
                booking.id,
                old_status,
                booking.booking_date,
                booking.booking_time,
            )

    return updated_count

