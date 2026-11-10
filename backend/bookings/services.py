import logging
from datetime import datetime, date, time, timedelta
from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import Avg, Count
from django.utils import timezone
from .models import Booking, BookingHistory
from salons.models import WorkerProfile, WorkerLeave
from salons.media_utils import build_full_media_url

logger = logging.getLogger(__name__)


def _parse_time(t_str):
    """Parse time string to datetime.time object."""
    if not t_str:
        return None
    for fmt in ('%H:%M:%S', '%H:%M', '%I:%M %p', '%I:%M%p'):
        try:
            return datetime.strptime(str(t_str).strip(), fmt).time()
        except (ValueError, AttributeError):
            continue
    return None


def get_booking_start_datetime(booking):
    
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
            is_noshow = True
        else:
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


def validate_worker_for_booking(candidate_worker, booking):
    """
    Validates whether candidate_worker can be assigned to booking.
    Checks:
      1. Belongs to same salon
      2. Worker is active
      3. Worker not already assigned
      4. Not on approved leave on booking_date
      5. Not on scheduled weekly off
      6. Certified / eligible for booking's service(s)
      7. Within shift working hours and not overlapping with scheduled breaks
      8. No conflicting bookings on booking_date and appointment time
    Returns:
      (is_available: bool, status_code: str, reason_text: str)
    """
    if not candidate_worker:
        return False, "INVALID_WORKER", "Worker profile does not exist."

    # 1. Same salon check
    if candidate_worker.salon_id != booking.salon_id:
        return False, "WRONG_SALON", "Worker does not belong to the salon hosting this appointment."

    # 2. Inactive check
    if not candidate_worker.is_active:
        return False, "INACTIVE", "Worker account is currently deactivated."

    # 3. Already assigned
    if booking.worker_id and booking.worker_id == candidate_worker.id:
        return False, "CURRENT", "Worker is already assigned to this appointment."

    # 4. Approved leave check
    leave = WorkerLeave.objects.filter(
        worker=candidate_worker,
        date=booking.booking_date,
        status=WorkerLeave.Status.APPROVED,
    ).first()
    if leave:
        leave_label = leave.get_leave_type_display() if hasattr(leave, "get_leave_type_display") else "Leave"
        return False, "ON_LEAVE", f"Worker is on approved {leave_label} on {booking.booking_date}."

    # 5. Weekly off check
    shift_hours = candidate_worker.shift_hours if isinstance(getattr(candidate_worker, "shift_hours", None), dict) else {}
    weekly_off = shift_hours.get("weekly_off")
    if weekly_off:
        day_name = booking.booking_date.strftime("%A").lower()
        day_short = booking.booking_date.strftime("%a").lower()
        is_off = False
        if isinstance(weekly_off, (list, tuple, set)):
            is_off = any(str(x).strip().lower() in (day_name, day_short) for x in weekly_off)
        elif isinstance(weekly_off, str):
            is_off = weekly_off.strip().lower() in (day_name, day_short) or weekly_off.strip().lower() in day_name
        if is_off:
            return False, "WEEKLY_OFF", f"Worker is scheduled for weekly off on {booking.booking_date.strftime('%A')}."

    # 6. Service eligibility check
    assigned_svcs = [str(s).lower().strip() for s in (candidate_worker.assigned_services or [])]
    if assigned_svcs:
        svcs = list(booking.services.all())
        if not svcs and booking.service:
            svcs = [booking.service]
        if svcs:
            for ss in svcs:
                eff_name = (ss.effective_name or "").lower().strip()
                std_name = (ss.service.name if ss.service else "").lower().strip()
                sid = str(ss.id)
                can_do = (
                    eff_name in assigned_svcs
                    or std_name in assigned_svcs
                    or sid in assigned_svcs
                    or any(eff_name == a or a in eff_name for a in assigned_svcs)
                    or (std_name and any(std_name == a or a in std_name for a in assigned_svcs))
                )
                if not can_do:
                    return False, "NOT_QUALIFIED", f"Worker is not certified for service '{ss.effective_name}'."
        elif booking.service_name:
            s_name = (booking.service_name or "").lower().strip()
            can_do = any(s_name == a or a in s_name for a in assigned_svcs)
            if not can_do:
                return False, "NOT_QUALIFIED", f"Worker is not certified for service '{booking.service_name}'."

    # Compute booking start & end times
    b_start = booking.start_time
    b_end = booking.end_time
    if not b_start and booking.booking_time:
        b_start = _parse_time(str(booking.booking_time).split("-")[0].strip())
    if b_start and not b_end:
        dur_mins = 45
        if booking.duration:
            try:
                dur_mins = int("".join(filter(str.isdigit, str(booking.duration)))) or 45
            except Exception:
                dur_mins = 45
        b_end = (datetime.combine(booking.booking_date, b_start) + timedelta(minutes=dur_mins)).time()

    # 7. Shift hours and breaks check
    if b_start and b_end:
        w_in_raw = shift_hours.get("time_in") or shift_hours.get("start") or shift_hours.get("open")
        w_out_raw = shift_hours.get("time_out") or shift_hours.get("end") or shift_hours.get("close")
        w_start = _parse_time(str(w_in_raw)) if w_in_raw else None
        w_end = _parse_time(str(w_out_raw)) if w_out_raw else None

        if w_start and b_start < w_start:
            return False, "OUTSIDE_SHIFT", f"Appointment starts ({b_start.strftime('%I:%M %p')}) before worker's shift ({w_start.strftime('%I:%M %p')})."
        if w_end and b_end > w_end:
            return False, "OUTSIDE_SHIFT", f"Appointment ends ({b_end.strftime('%I:%M %p')}) after worker's shift ({w_end.strftime('%I:%M %p')})."

        raw_breaks = (
            shift_hours.get("breaks")
            or shift_hours.get("break_hours")
            or shift_hours.get("lunch_break")
            or shift_hours.get("break")
        )
        breaks_list = []
        if isinstance(raw_breaks, dict):
            raw_breaks = [raw_breaks]
        if isinstance(raw_breaks, list):
            for b in raw_breaks:
                if isinstance(b, dict):
                    bs = _parse_time(str(b.get("start") or b.get("time_in") or ""))
                    be = _parse_time(str(b.get("end") or b.get("time_out") or ""))
                    if bs and be and bs < be:
                        breaks_list.append((bs, be))
        direct_bs = _parse_time(str(shift_hours.get("break_start") or ""))
        direct_be = _parse_time(str(shift_hours.get("break_end") or ""))
        if direct_bs and direct_be and direct_bs < direct_be:
            breaks_list.append((direct_bs, direct_be))

        for bs, be in breaks_list:
            if b_start < be and b_end > bs:
                return False, "ON_BREAK", f"Appointment overlaps with worker's break ({bs.strftime('%I:%M %p')} - {be.strftime('%I:%M %p')})."

    # 8. Active Appointment Conflict Check
    conflicts_qs = Booking.objects.filter(
        worker=candidate_worker,
        booking_date=booking.booking_date,
        status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS],
    ).exclude(pk=booking.id)

    if b_start and b_end:
        conflicts = conflicts_qs.filter(
            start_time__lt=b_end,
            end_time__gt=b_start,
        )
        if not conflicts.exists() and booking.booking_time:
            conflicts = conflicts_qs.filter(booking_time=booking.booking_time)
    else:
        conflicts = conflicts_qs.filter(booking_time=booking.booking_time)

    if conflicts.exists():
        c = conflicts.first()
        c_time = c.booking_time or (c.start_time.strftime("%I:%M %p") if c.start_time else "same time slot")
        return False, "TIME_CONFLICT", f"Worker already has an active appointment (#{c.id} at {c_time}) during this time."

    return True, "AVAILABLE", ""


def get_eligible_workers_for_booking(booking, request=None):
    """
    Returns all active salon workers annotated with real-time slot availability,
    eligibility, conflict reasons, and current assignment status for this booking.
    """
    from reviews.models import WorkerReview

    workers = (
        WorkerProfile.objects
        .filter(salon=booking.salon, is_active=True)
        .select_related("user")
        .order_by("user__first_name", "user__last_name")
    )

    results = []
    for w in workers:
        full_name = f"{w.user.first_name} {w.user.last_name}".strip() or w.user.email.split("@")[0].title()
        is_current = bool(booking.worker_id and booking.worker_id == w.id)

        if is_current:
            is_avail = True
            status_code = "CURRENT"
            reason_text = "Currently assigned specialist"
            can_assign = False
        else:
            is_avail, status_code, reason_text = validate_worker_for_booking(w, booking)
            can_assign = is_avail

        # Rating aggregate
        w_agg = WorkerReview.objects.filter(worker=w).aggregate(avg=Avg('rating'), count=Count('id'))
        w_rating = round(float(w_agg['avg']), 1) if w_agg['avg'] is not None else 5.0
        w_reviews_count = w_agg['count'] or 0

        avatar_url = ""
        if w.profile_photo:
            avatar_url = build_full_media_url(request, w.profile_photo)

        results.append({
            "id": w.id,
            "worker_id": w.id,
            "name": full_name,
            "email": w.user.email,
            "phone": w.phone_number,
            "station": w.station or "Station 01",
            "specialization": w.specialization or "Specialist",
            "experience": w.experience or "",
            "avatar": avatar_url,
            "profile_photo": avatar_url,
            "rating": w_rating,
            "reviews_count": w_reviews_count,
            "is_current": is_current,
            "is_available": is_avail,
            "availability_status": status_code,
            "conflict_reason": reason_text,
            "can_assign": can_assign,
        })

    # Sort so currently assigned and available workers appear first
    results.sort(key=lambda x: (not x["is_current"], not x["can_assign"], x["name"]))
    return results


def reassign_booking_worker(booking, new_worker, changed_by_user, reason=""):
    """
    Atomically reassigns booking's assigned worker after validating business rules,
    conflict checking, and logging history.
    """
    # 1. Business status rules:
    # PENDING -> Allowed
    # CONFIRMED -> Allowed
    # IN_PROGRESS -> Not allowed
    # COMPLETED -> Not allowed
    # CANCELLED -> Not allowed
    allowed_statuses = [Booking.Status.PENDING, Booking.Status.CONFIRMED]
    if booking.status not in allowed_statuses:
        status_label = booking.get_status_display()
        raise ValidationError(
            f"Worker reassignment is not permitted for appointments in '{status_label}' status. "
            "Only PENDING or CONFIRMED bookings may have their assigned worker changed."
        )

    if not new_worker or not new_worker.is_active:
        raise ValidationError("Selected specialist is inactive or not found.")

    if new_worker.salon_id != booking.salon_id:
        raise ValidationError("Selected specialist does not belong to this salon.")

    if booking.worker_id and booking.worker_id == new_worker.id:
        raise ValidationError("Worker is already assigned to this appointment.")

    # 2. Atomic reassignment with lock
    with transaction.atomic():
        locked_booking = Booking.objects.select_for_update().get(pk=booking.id)

        # Re-verify status under lock
        if locked_booking.status not in allowed_statuses:
            raise ValidationError(
                f"Booking status has changed to '{locked_booking.get_status_display()}'. Reassignment cancelled."
            )

        locked_worker = WorkerProfile.objects.select_for_update().get(pk=new_worker.id)

        # Perform conflict & eligibility check under lock
        is_valid, status_code, reason_msg = validate_worker_for_booking(locked_worker, locked_booking)
        if not is_valid:
            raise ValidationError(reason_msg)

        old_worker = locked_booking.worker
        old_worker_name = (
            old_worker.user.get_full_name() or old_worker.user.email
            if old_worker and old_worker.user
            else (old_worker.specialization if old_worker else "Unassigned")
        )
        new_worker_name = (
            locked_worker.user.get_full_name() or locked_worker.user.email
            if locked_worker and locked_worker.user
            else (locked_worker.specialization if locked_worker else "Specialist")
        )

        # Update booking assigned worker
        locked_booking.worker = locked_worker
        if locked_worker.station:
            locked_booking.station = locked_worker.station
        locked_booking.save(update_fields=["worker", "station", "updated_at"])

        # Record in BookingHistory (Super Admin & Dispute Investigation)
        history_entry = BookingHistory.objects.create(
            booking=locked_booking,
            action=BookingHistory.Action.WORKER_REASSIGNED,
            previous_status=locked_booking.status,
            new_status=locked_booking.status,
            previous_worker=old_worker,
            new_worker=locked_worker,
            previous_worker_name=old_worker_name,
            new_worker_name=new_worker_name,
            changed_by=changed_by_user,
            reason=str(reason).strip(),
            notes=f"Assigned specialist switched from {old_worker_name} to {new_worker_name}.",
            metadata={
                "appointment_date": str(locked_booking.booking_date),
                "appointment_time": str(locked_booking.booking_time or locked_booking.start_time or ""),
                "service_name": locked_booking.service_name,
                "previous_worker_id": old_worker.id if old_worker else None,
                "new_worker_id": locked_worker.id,
                "changed_by_email": changed_by_user.email if changed_by_user else "",
                "changed_by_name": changed_by_user.get_full_name() if changed_by_user else "System",
            },
        )

    # 3. Trigger notifications (Customer, Previous Worker, New Worker)
    try:
        from notifications.services import notify_booking_reassigned
        notify_booking_reassigned(locked_booking, old_worker=old_worker, new_worker=locked_worker)
    except Exception as notif_err:
        logger.warning("Failed to dispatch reassignment notifications: %s", notif_err)

    return locked_booking, history_entry

