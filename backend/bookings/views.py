from datetime import datetime, timedelta, date
import hmac
import hashlib
import requests
from django.conf import settings
from django.db import transaction
from django.db.models import Q, Avg, Count, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.authentication import CustomJWTAuthentication as JWTAuthentication
from bookings.models import Booking, SalonReview, WorkerReview
from bookings.serializers import (
    BookingCreateSerializer,
    BookingReadSerializer,
    SalonReviewSerializer,
    WorkerReviewSerializer,
    ReviewSubmissionSerializer,
)
from salons.models import Salon, WorkerProfile, SalonOffDay, WorkerLeave
from services.models import SalonService


class OptionalJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except Exception:
            return None


DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']


def _get_weekday_key(d: date) -> str:
    return DAYS[d.weekday()]


def _get_salon_day_hours(salon, booking_date: date):
    """
    Robustly extract (open_time, close_time, is_closed, reason) for the given salon and date.
    Handles:
    - {"days": [{"day": "Monday", "isOpen": true, "openTime": "09:00", "closeTime": "21:00"}, ...]}
    - {"monday": {"open": "09:00", "close": "21:00", "closed": false}, ...}
    - {"openTime": "09:00", "closeTime": "21:00"}
    - empty / None / unconfigured (defaults to 09:00 - 21:00 open)
    """
    weekday_lower = _get_weekday_key(booking_date)
    day_name = booking_date.strftime("%A")

    raw_hours = getattr(salon, "opening_hours", None) or {}
    if isinstance(raw_hours, str):
        try:
            import json
            raw_hours = json.loads(raw_hours)
        except Exception:
            raw_hours = {}

    days_list = []
    if isinstance(raw_hours, dict):
        if "days" in raw_hours and isinstance(raw_hours["days"], list):
            days_list = raw_hours["days"]
        elif "openTime" in raw_hours and "closeTime" in raw_hours:
            open_t = _parse_time(str(raw_hours.get("openTime", "09:00"))) or _parse_time("09:00")
            close_t = _parse_time(str(raw_hours.get("closeTime", "21:00"))) or _parse_time("21:00")
            return open_t, close_t, False, ""
    elif isinstance(raw_hours, list):
        days_list = raw_hours

    # 1. If we have a list of day objects
    if days_list:
        matched = None
        for item in days_list:
            if not isinstance(item, dict):
                continue
            item_day = str(item.get("day", "")).strip().lower()
            if item_day == weekday_lower or item_day == day_name.lower():
                matched = item
                break

        if matched:
            is_open = matched.get("isOpen")
            if is_open is False or str(is_open).lower() == "false":
                return None, None, True, f"Salon is closed on {day_name}"
            open_t = _parse_time(str(matched.get("openTime") or matched.get("open") or "09:00")) or _parse_time("09:00")
            close_t = _parse_time(str(matched.get("closeTime") or matched.get("close") or "21:00")) or _parse_time("21:00")
            return open_t, close_t, False, ""
        else:
            # If day list exists but this day isn't explicitly configured as closed, default open 09:00-21:00
            # (unless it's Sunday and empty, default Sunday open 10:00-19:00)
            open_t = _parse_time("09:00")
            close_t = _parse_time("21:00")
            return open_t, close_t, False, ""

    # 2. If it's a dict keyed by day: {"monday": {"open": "09:00", ...}}
    if isinstance(raw_hours, dict) and weekday_lower in raw_hours:
        day_info = raw_hours.get(weekday_lower) or {}
        if isinstance(day_info, dict):
            if day_info.get("closed") is True or day_info.get("isOpen") is False:
                return None, None, True, f"Salon is closed on {day_name}"
            open_t = _parse_time(str(day_info.get("open") or day_info.get("openTime") or "09:00")) or _parse_time("09:00")
            close_t = _parse_time(str(day_info.get("close") or day_info.get("closeTime") or "21:00")) or _parse_time("21:00")
            return open_t, close_t, False, ""

    # 3. Default fallback for salons with no custom hours: 09:00 to 21:00
    open_t = _parse_time("09:00")
    close_t = _parse_time("21:00")
    return open_t, close_t, False, ""


def _parse_time(t_str):
    """Parse HH:MM or H:MM time string to time object."""
    for fmt in ('%H:%M', '%I:%M %p', '%I:%M%p'):
        try:
            return datetime.strptime(t_str.strip(), fmt).time()
        except (ValueError, AttributeError):
            continue
    return None


RESERVATION_TIMEOUT_MINUTES = 10


def _clean_expired_reservations():
    """Cancel any PENDING bookings whose expires_at has passed."""
    Booking.objects.filter(
        status=Booking.Status.PENDING,
        expires_at__isnull=False,
        expires_at__lt=timezone.now(),
    ).update(status=Booking.Status.CANCELLED)


def _generate_slots(open_time, close_time, duration_minutes, interval_minutes=30):
    """
    Generate candidate start times at 30-minute intervals (or min(30, duration)),
    ensuring slot_start + duration <= close_time.
    For a 60-minute service, candidate start times are still generated at 30-min intervals,
    and each slot checks the full 60-minute duration.
    """
    step_minutes = min(interval_minutes, duration_minutes) if (duration_minutes and duration_minutes < interval_minutes) else interval_minutes
    slots = []
    current = datetime.combine(date.today(), open_time)
    close_dt = datetime.combine(date.today(), close_time)
    step = timedelta(minutes=step_minutes)
    dur = timedelta(minutes=duration_minutes)
    while current + dur <= close_dt:
        slots.append(current.time())
        current += step
    return slots


def _worker_is_on_leave(worker_id, booking_date):
    """Check if worker has an approved leave on the given date."""
    return WorkerLeave.objects.filter(
        worker_id=worker_id,
        date=booking_date,
        status=WorkerLeave.Status.APPROVED,
    ).exists()


def _worker_is_on_weekly_off(worker, booking_date: date) -> bool:
    """Check if booking_date matches worker's configured weekly off day."""
    if not worker or not worker.shift_hours:
        return False
    shift_hours = worker.shift_hours if isinstance(worker.shift_hours, dict) else {}
    weekly_off = shift_hours.get("weekly_off")
    if not weekly_off:
        return False

    day_name = booking_date.strftime("%A").lower()
    day_short = booking_date.strftime("%a").lower()

    if isinstance(weekly_off, (list, tuple, set)):
        return any(
            str(x).strip().lower() in (day_name, day_short)
            for x in weekly_off
        )
    off_str = str(weekly_off).strip().lower()
    return off_str == day_name or off_str == day_short or off_str in day_name


def _get_worker_working_intervals(worker, booking_date: date, salon_open_time, salon_close_time):
    """
    Returns (work_start, work_end, breaks_list) for this worker on this date.
    Returns (None, None, []) if worker is off or hours are invalid.
    """
    if _worker_is_on_weekly_off(worker, booking_date):
        return None, None, []

    shift = worker.shift_hours if isinstance(getattr(worker, 'shift_hours', None), dict) else {}
    
    # Extract shift start/end
    raw_in = shift.get("time_in") or shift.get("start") or shift.get("open")
    raw_out = shift.get("time_out") or shift.get("end") or shift.get("close")

    w_start = _parse_time(str(raw_in)) if raw_in else salon_open_time
    w_end = _parse_time(str(raw_out)) if raw_out else salon_close_time

    if not w_start:
        w_start = salon_open_time
    if not w_end:
        w_end = salon_close_time

    # Constrain within salon opening hours
    effective_start = max(w_start, salon_open_time)
    effective_end = min(w_end, salon_close_time)

    if effective_start >= effective_end:
        return None, None, []

    # Parse any breaks configured: e.g. [{"start": "13:00", "end": "14:00"}] or {"start": "...", "end": "..."}
    breaks = []
    raw_breaks = (
        shift.get("breaks")
        or shift.get("break_hours")
        or shift.get("lunch_break")
        or shift.get("break")
    )
    if isinstance(raw_breaks, dict):
        raw_breaks = [raw_breaks]
    if isinstance(raw_breaks, list):
        for b in raw_breaks:
            if isinstance(b, dict):
                b_s = _parse_time(str(b.get("start") or b.get("time_in", "") or b.get("open", "")))
                b_e = _parse_time(str(b.get("end") or b.get("time_out", "") or b.get("close", "")))
                if b_s and b_e and b_s < b_e:
                    breaks.append((b_s, b_e))

    direct_b_s = _parse_time(str(shift.get("break_start", "")))
    direct_b_e = _parse_time(str(shift.get("break_end", "")))
    if direct_b_s and direct_b_e and direct_b_s < direct_b_e:
        breaks.append((direct_b_s, direct_b_e))

    return effective_start, effective_end, breaks


def _get_booked_slots_for_worker(worker_id, booking_date):
    """Return list of (start_time, end_time) tuples for active bookings, excluding expired pending reservations."""
    _clean_expired_reservations()
    active_statuses = [Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS]
    bookings = Booking.objects.filter(
        worker_id=worker_id,
        booking_date=booking_date,
        start_time__isnull=False,
        status__in=active_statuses,
    ).values_list('start_time', 'end_time')
    return list(bookings)


def _check_slot_status(slot_start, slot_end, booked_slots, worker_start=None, worker_end=None, breaks=None):
    """
    Return (is_free: bool, reason: str).
    Reasons: '' (available), 'Outside working hours', 'Break', 'Already booked'
    """
    if worker_start and slot_start < worker_start:
        return False, "Outside working hours"
    if worker_end and slot_end > worker_end:
        return False, "Outside working hours"

    if breaks:
        for b_start, b_end in breaks:
            if slot_start < b_end and slot_end > b_start:
                return False, "Break"

    for b_start, b_end in booked_slots:
        if b_start is None or b_end is None:
            continue
        if slot_start < b_end and slot_end > b_start:
            return False, "Already booked"

    return True, ""


def _slot_is_free(slot_start, slot_end, booked_slots, worker_start=None, worker_end=None, breaks=None):
    """Backward compatible wrapper returning boolean."""
    is_free, _ = _check_slot_status(slot_start, slot_end, booked_slots, worker_start, worker_end, breaks)
    return is_free


class SalonOffDaysView(APIView):
    """GET /api/v1/bookings/salons/{salon_id}/off-days/ - list salon off-days."""
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request, salon_id):
        try:
            salon = Salon.objects.get(pk=salon_id)
        except Salon.DoesNotExist:
            return Response({'error': 'Salon not found.'}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.localdate()
        off_days = SalonOffDay.objects.filter(salon=salon, date__gte=today).order_by('date')
        data = [
            {'date': str(od.date), 'reason': od.reason or 'Scheduled Closure'}
            for od in off_days
        ]
        return Response({'off_days': data})


class SalonServicesView(APIView):
    """GET /api/v1/bookings/salons/{salon_id}/services/ - list active services."""
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request, salon_id):
        try:
            salon = Salon.objects.get(pk=salon_id)
        except Salon.DoesNotExist:
            return Response({'error': 'Salon not found.'}, status=status.HTTP_404_NOT_FOUND)

        services = SalonService.objects.filter(
            salon=salon, is_active=True
        ).select_related('service', 'service__category').order_by(
            'service__category__display_order', 'service__name'
        )
        data = [
            {
                'id': ss.id,
                'name': ss.effective_name,
                'category': ss.service.category.name if ss.service and ss.service.category else '',
                'price': str(ss.price),
                'duration': ss.duration,
                'description': ss.effective_description,
            }
            for ss in services
        ]
        return Response({'services': data})


class SalonWorkersView(APIView):
    """
    GET /api/v1/bookings/salons/{salon_id}/workers/
    Query params:
    - service_id (optional): only return workers who perform this service
    - date (optional, YYYY-MM-DD): checks if worker has advance bookings, is on leave, or is fully booked on this date
    """
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request, salon_id):
        try:
            salon = Salon.objects.get(pk=salon_id)
        except Salon.DoesNotExist:
            return Response({'error': 'Salon not found.'}, status=status.HTTP_404_NOT_FOUND)

        service_id = request.query_params.get('service_id')
        date_str = request.query_params.get('date')
        time_str = request.query_params.get('time')  # HH:MM format optional

        target_date = None
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                target_date = None

        service_obj = None
        if service_id:
            try:
                service_obj = SalonService.objects.get(pk=service_id, salon=salon)
            except SalonService.DoesNotExist:
                service_obj = None

        req_time = _parse_time(time_str) if time_str else None

        open_time, close_time, is_salon_closed, _ = (
            _get_salon_day_hours(salon, target_date) if target_date else (None, None, False, "")
        )

        workers_qs = WorkerProfile.objects.filter(salon=salon, is_active=True).select_related('user')
        active_statuses = [Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS]

        data = []
        for w in workers_qs:
            # If service_id provided, only include workers who can do it
            if service_obj:
                service_name = service_obj.effective_name.lower()
                service_std_name = service_obj.service.name.lower() if service_obj.service else ''
                assigned = [str(s).lower() for s in (w.assigned_services or [])]
                can_do = (
                    any(service_name in a or a in service_name for a in assigned)
                    or any(service_std_name in a or a in service_std_name for a in assigned)
                    or str(service_obj.id) in [str(s) for s in (w.assigned_services or [])]
                )
                if not can_do and assigned:  # worker has assigned services but not this one
                    continue

            # Advance bookings & schedule check
            is_on_leave = False
            is_weekly_off = False
            advance_bookings = []
            advance_bookings_count = 0
            has_advance_bookings = False
            available_slots_count = 0
            is_fully_booked = False
            is_available_at_time = None

            if target_date:
                is_on_leave = _worker_is_on_leave(w.id, target_date)
                w_start, w_end, w_breaks = (
                    _get_worker_working_intervals(w, target_date, open_time, close_time)
                    if open_time and close_time else (None, None, [])
                )
                is_weekly_off = (not w_start or not w_end)

                bookings_qs = Booking.objects.filter(
                    worker=w,
                    booking_date=target_date,
                    status__in=active_statuses,
                ).order_by('start_time')

                advance_bookings_count = bookings_qs.count()
                has_advance_bookings = advance_bookings_count > 0

                booked_tuples = []
                for b in bookings_qs:
                    b_start = b.start_time.strftime('%H:%M') if b.start_time else b.booking_time
                    b_end = b.end_time.strftime('%H:%M') if b.end_time else ''
                    advance_bookings.append({
                        'id': b.id,
                        'service_name': b.service_name,
                        'start_time': b_start,
                        'end_time': b_end,
                        'time_display': datetime.combine(target_date, b.start_time).strftime('%I:%M %p').lstrip('0') if b.start_time else b.booking_time,
                    })
                    if b.start_time and b.end_time:
                        booked_tuples.append((b.start_time, b.end_time))

                if not is_salon_closed and not is_on_leave and not is_weekly_off and open_time and close_time and service_obj:
                    duration = service_obj.duration
                    cand_slots = _generate_slots(open_time, close_time, duration)
                    now = datetime.now().time() if target_date == timezone.localdate() else None
                    free_count = 0
                    for s_start in cand_slots:
                        if now and s_start <= now:
                            continue
                        s_end = (datetime.combine(target_date, s_start) + timedelta(minutes=duration)).time()
                        if _slot_is_free(s_start, s_end, booked_tuples, worker_start=w_start, worker_end=w_end, breaks=w_breaks):
                            free_count += 1
                    available_slots_count = free_count
                    if len(cand_slots) > 0 and free_count == 0:
                        is_fully_booked = True

                    # If specific time requested, check if free at that specific slot
                    if req_time:
                        slot_end = (datetime.combine(target_date, req_time) + timedelta(minutes=duration)).time()
                        is_available_at_time = _slot_is_free(
                            req_time, slot_end, booked_tuples,
                            worker_start=w_start, worker_end=w_end, breaks=w_breaks
                        )
                elif req_time:
                    is_available_at_time = False
            else:
                # If no date specified, count total upcoming advance bookings
                upcoming_qs = Booking.objects.filter(
                    worker=w,
                    booking_date__gte=timezone.localdate(),
                    status__in=active_statuses,
                )
                advance_bookings_count = upcoming_qs.count()
                has_advance_bookings = advance_bookings_count > 0

            full_name = w.user.get_full_name() or w.user.email.split('@')[0].title()
            from salons.media_utils import build_full_media_url

            # A worker is available on this date if not on leave, not on weekly off, and has at least one open slot
            is_available = not is_on_leave and not is_weekly_off and not is_fully_booked if target_date else True

            data.append({
                'id': w.id,
                'name': full_name,
                'specialization': w.specialization or 'Stylist',
                'experience': w.experience or '',
                'station': w.station or '',
                'profile_photo': build_full_media_url(request, w.profile_photo) if w.profile_photo else '',
                'assigned_services': w.assigned_services or [],
                'has_advance_bookings': has_advance_bookings,
                'advance_bookings_count': advance_bookings_count,
                'advance_bookings': advance_bookings,
                'is_on_leave': is_on_leave,
                'is_weekly_off': is_weekly_off,
                'is_fully_booked': is_fully_booked,
                'available_slots_count': available_slots_count,
                'is_available': is_available,
                'is_available_at_time': is_available_at_time,
            })

        return Response({'workers': data})


class AvailableSlotsView(APIView):
    """
    GET /api/v1/bookings/slots/
    Query params: salon_id, service_id, date (YYYY-MM-DD), worker_id (optional, omit = any)
    Returns available time slots, respecting salon off-days, worker leaves, and existing bookings.
    """
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request):
        salon_id = request.query_params.get('salon_id')
        service_id = request.query_params.get('service_id')
        date_str = request.query_params.get('date')
        worker_id = request.query_params.get('worker_id')  # None = 'any'

        # Validate required params
        if not all([salon_id, service_id, date_str]):
            return Response(
                {'error': 'salon_id, service_id, and date are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            booking_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if booking_date < timezone.localdate():
            return Response({'error': 'Cannot book for a past date.'}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch salon
        try:
            salon = Salon.objects.get(pk=salon_id)
        except Salon.DoesNotExist:
            return Response({'error': 'Salon not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check salon off-day
        off_day = SalonOffDay.objects.filter(salon=salon, date=booking_date).first()
        if off_day:
            reason_text = f"Salon is closed on this date: {off_day.reason}" if off_day.reason else "Salon is closed on this date"
            return Response({
                'closed': True,
                'is_salon_closed': True,
                'reason': reason_text,
                'slots': [],
            })

        # Fetch service
        try:
            service = SalonService.objects.get(pk=service_id, salon=salon, is_active=True)
        except SalonService.DoesNotExist:
            return Response({'error': 'Service not found for this salon.'}, status=status.HTTP_404_NOT_FOUND)

        duration = service.duration  # minutes

        # Get salon opening hours for this date
        weekday = _get_weekday_key(booking_date)
        open_time, close_time, is_salon_closed, closed_reason = _get_salon_day_hours(salon, booking_date)

        if is_salon_closed or not open_time or not close_time:
            return Response({
                'closed': True,
                'is_salon_closed': True,
                'reason': closed_reason or f'Salon is closed on {booking_date.strftime("%A")}',
                'slots': [],
            })

        candidate_slots = _generate_slots(open_time, close_time, duration)

        # Determine eligible workers
        specific_worker = None
        if worker_id and worker_id != 'any':
            try:
                specific_worker = WorkerProfile.objects.get(pk=int(worker_id), salon=salon, is_active=True)
            except (WorkerProfile.DoesNotExist, ValueError):
                return Response({'error': 'Worker not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Build slot availability
        slots = []
        now = datetime.now().time() if booking_date == timezone.localdate() else None

        if specific_worker:
            worker_name = specific_worker.user.get_full_name() or specific_worker.user.email
            # Specific worker chosen
            on_leave = _worker_is_on_leave(specific_worker.id, booking_date)
            if on_leave:
                return Response({
                    'closed': False,
                    'worker_unavailable': True,
                    'reason': f'{worker_name} is on approved leave on this date.',
                    'slots': [],
                })
            
            w_start, w_end, w_breaks = _get_worker_working_intervals(
                specific_worker, booking_date, open_time, close_time
            )
            if not w_start or not w_end:
                return Response({
                    'closed': False,
                    'worker_unavailable': True,
                    'reason': f'{worker_name} is off on this day.',
                    'slots': [],
                })

            booked = _get_booked_slots_for_worker(specific_worker.id, booking_date)
            for slot_start in candidate_slots:
                if now and slot_start <= now:
                    continue
                slot_end = (datetime.combine(booking_date, slot_start) + timedelta(minutes=duration)).time()
                is_free, reason = _check_slot_status(
                    slot_start, slot_end, booked,
                    worker_start=w_start, worker_end=w_end, breaks=w_breaks
                )
                slots.append({
                    'time': slot_start.strftime('%H:%M'),
                    'time_display': datetime.combine(booking_date, slot_start).strftime('%I:%M %p').lstrip('0'),
                    'end_time': slot_end.strftime('%H:%M'),
                    'end_time_display': datetime.combine(booking_date, slot_end).strftime('%I:%M %p').lstrip('0'),
                    'available': is_free,
                    'reason': reason,
                })
        else:
            # Any available worker
            eligible_workers_qs = WorkerProfile.objects.filter(salon=salon, is_active=True).select_related('user')
            
            # Filter workers by assigned service if worker has specific assigned_services
            service_name = service.effective_name.lower()
            service_std_name = service.service.name.lower() if service.service else ''
            service_id_str = str(service.id)
            
            capable_workers = []
            for w in eligible_workers_qs:
                assigned = [str(s).lower() for s in (w.assigned_services or [])]
                if not assigned:
                    capable_workers.append(w)
                else:
                    can_do = (
                        any(service_name in a or a in service_name for a in assigned)
                        or any(service_std_name in a or a in service_std_name for a in assigned)
                        or service_id_str in [str(s) for s in (w.assigned_services or [])]
                    )
                    if can_do:
                        capable_workers.append(w)

            # Filter out workers on leave that day or on weekly off
            workers_on_leave = set(
                WorkerLeave.objects.filter(
                    worker__in=capable_workers,
                    date=booking_date,
                    status=WorkerLeave.Status.APPROVED,
                ).values_list('worker_id', flat=True)
            )

            available_workers = []
            worker_intervals = {}
            for w in capable_workers:
                if w.id in workers_on_leave:
                    continue
                w_start, w_end, w_breaks = _get_worker_working_intervals(w, booking_date, open_time, close_time)
                if w_start and w_end:
                    available_workers.append(w)
                    worker_intervals[w.id] = (w_start, w_end, w_breaks)

            if not available_workers:
                return Response({
                    'closed': False,
                    'worker_unavailable': True,
                    'reason': 'No eligible workers available on this date.',
                    'slots': [],
                })

            # Build booked slots per worker
            worker_booked = {}
            for w in available_workers:
                worker_booked[w.id] = _get_booked_slots_for_worker(w.id, booking_date)

            for slot_start in candidate_slots:
                if now and slot_start <= now:
                    continue
                slot_end = (datetime.combine(booking_date, slot_start) + timedelta(minutes=duration)).time()
                # Slot available if at least one worker is free within their working interval
                any_free = False
                for w in available_workers:
                    w_start, w_end, w_breaks = worker_intervals[w.id]
                    if _slot_is_free(
                        slot_start, slot_end, worker_booked[w.id],
                        worker_start=w_start, worker_end=w_end, breaks=w_breaks
                    ):
                        any_free = True
                        break

                slots.append({
                    'time': slot_start.strftime('%H:%M'),
                    'time_display': datetime.combine(booking_date, slot_start).strftime('%I:%M %p').lstrip('0'),
                    'end_time': slot_end.strftime('%H:%M'),
                    'end_time_display': datetime.combine(booking_date, slot_end).strftime('%I:%M %p').lstrip('0'),
                    'available': any_free,
                    'reason': '' if any_free else 'Unavailable',
                })

        return Response({
            'closed': False,
            'date': date_str,
            'weekday': weekday,
            'open_time': open_time.strftime('%H:%M'),
            'close_time': close_time.strftime('%H:%M'),
            'duration_minutes': duration,
            'slots': slots,
        })


class BookingCreateView(APIView):
    """
    POST /api/v1/bookings/create/
    Creates a booking with double-booking prevention via SELECT FOR UPDATE inside a transaction.
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        salon = data['salon']
        service = data['service']
        booking_date = data['booking_date']
        start_time = data['start_time']
        end_time = data['end_time']
        worker_id = data.get('worker_id')
        duration = service.duration

        weekday = _get_weekday_key(booking_date)
        salon_open_time, salon_close_time, is_salon_closed, closed_reason = _get_salon_day_hours(salon, booking_date)
        if is_salon_closed or not salon_open_time or not salon_close_time:
            return Response(
                {'error': closed_reason or f'Salon is closed on {booking_date.strftime("%A")}.'},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                _clean_expired_reservations()

                # -- Re-check salon off-day inside transaction --
                if SalonOffDay.objects.filter(salon=salon, date=booking_date).exists():
                    off = SalonOffDay.objects.get(salon=salon, date=booking_date)
                    return Response(
                        {'error': f'Salon is closed on this date: {off.reason}'},
                        status=status.HTTP_409_CONFLICT,
                    )

                active_statuses = [Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS]

                if worker_id:
                    # Specific worker requested
                    try:
                        worker = WorkerProfile.objects.get(pk=worker_id, salon=salon, is_active=True)
                    except WorkerProfile.DoesNotExist:
                        return Response({'error': 'Worker not found.'}, status=status.HTTP_404_NOT_FOUND)

                    # Re-check worker leave
                    if WorkerLeave.objects.filter(
                        worker=worker, date=booking_date, status=WorkerLeave.Status.APPROVED
                    ).exists():
                        return Response(
                            {'error': 'Worker is on approved leave on this date.'},
                            status=status.HTTP_409_CONFLICT,
                        )

                    # Re-check worker working shift / off-day / breaks
                    w_start, w_end, w_breaks = _get_worker_working_intervals(
                        worker, booking_date, salon_open_time, salon_close_time
                    )
                    if not w_start or not w_end:
                        return Response(
                            {'error': 'Worker is not scheduled to work on this day.'},
                            status=status.HTTP_409_CONFLICT,
                        )

                    # Validate slot is inside worker shift and not on break
                    if start_time < w_start or end_time > w_end:
                        return Response(
                            {'error': f'Selected slot is outside worker working hours ({w_start.strftime("%I:%M %p")} - {w_end.strftime("%I:%M %p")}).'},
                            status=status.HTTP_409_CONFLICT,
                        )

                    if w_breaks:
                        for b_s, b_e in w_breaks:
                            if start_time < b_e and end_time > b_s:
                                return Response(
                                    {'error': 'Selected slot overlaps with the specialist scheduled break.'},
                                    status=status.HTTP_409_CONFLICT,
                                )

                    # Lock conflicting rows and check overlap
                    conflicts = Booking.objects.select_for_update().filter(
                        worker=worker,
                        booking_date=booking_date,
                        start_time__lt=end_time,
                        end_time__gt=start_time,
                        status__in=active_statuses,
                    )
                    if conflicts.exists():
                        return Response(
                            {'error': 'This time slot is no longer available. Please choose another slot.'},
                            status=status.HTTP_409_CONFLICT,
                        )
                    assigned_worker = worker

                else:
                    # Any available worker — find first free one
                    eligible_workers = list(
                        WorkerProfile.objects.filter(salon=salon, is_active=True)
                        .exclude(
                            leaves__date=booking_date,
                            leaves__status=WorkerLeave.Status.APPROVED,
                        )
                    )
                    
                    # Filter by assigned service capability
                    service_name = service.effective_name.lower()
                    service_std_name = service.service.name.lower() if service.service else ''
                    service_id_str = str(service.id)
                    capable_candidates = []
                    for w in eligible_workers:
                        assigned = [str(s).lower() for s in (w.assigned_services or [])]
                        if not assigned:
                            capable_candidates.append(w)
                        else:
                            can_do = (
                                any(service_name in a or a in service_name for a in assigned)
                                or any(service_std_name in a or a in service_std_name for a in assigned)
                                or service_id_str in [str(s) for s in (w.assigned_services or [])]
                            )
                            if can_do:
                                capable_candidates.append(w)

                    if not capable_candidates:
                        return Response(
                            {'error': 'No eligible workers available on this date.'},
                            status=status.HTTP_409_CONFLICT,
                        )

                    assigned_worker = None
                    for candidate in capable_candidates:
                        w_start, w_end, w_breaks = _get_worker_working_intervals(
                            candidate, booking_date, salon_open_time, salon_close_time
                        )
                        if not w_start or not w_end:
                            continue
                        if start_time < w_start or end_time > w_end:
                            continue
                        # Check break overlap
                        has_break_overlap = False
                        if w_breaks:
                            for b_s, b_e in w_breaks:
                                if start_time < b_e and end_time > b_s:
                                    has_break_overlap = True
                                    break
                        if has_break_overlap:
                            continue

                        # Lock and check this worker's conflicts
                        conflicts = Booking.objects.select_for_update().filter(
                            worker=candidate,
                            booking_date=booking_date,
                            start_time__lt=end_time,
                            end_time__gt=start_time,
                            status__in=active_statuses,
                        )
                        if not conflicts.exists():
                            assigned_worker = candidate
                            break

                    if not assigned_worker:
                        return Response(
                            {'error': 'No workers are available for this time slot. Please choose another slot.'},
                            status=status.HTTP_409_CONFLICT,
                        )

                # Determine customer
                customer = request.user if request.user and request.user.is_authenticated else None

                # Create the booking
                booking = Booking.objects.create(
                    salon=salon,
                    service=service,
                    worker=assigned_worker,
                    customer=customer,
                    client_name=data['client_name'],
                    client_phone=data.get('client_phone', ''),
                    client_email=data.get('client_email', ''),
                    service_name=service.effective_name,
                    service_price=service.price,
                    booking_date=booking_date,
                    booking_time=start_time.strftime('%H:%M'),  # keep backward compat
                    start_time=start_time,
                    end_time=end_time,
                    duration=f'{duration} mins',
                    station=assigned_worker.station if assigned_worker else 'Station 01',
                    status=Booking.Status.CONFIRMED,
                    payment_method=data.get('payment_method', Booking.PaymentMethod.PAY_AT_SALON),
                    payment_status=Booking.PaymentStatus.PENDING if data.get('payment_method') != Booking.PaymentMethod.ONLINE else Booking.PaymentStatus.PAID,
                    notes=data.get('notes', ''),
                )

                from payments.models import Payment
                Payment.objects.update_or_create(
                    booking=booking,
                    defaults={
                        'customer': customer,
                        'salon': salon,
                        'amount': service.price or 0.00,
                        'payment_method': booking.payment_method,
                        'payment_status': booking.payment_status,
                        'notes': data.get('notes', ''),
                    }
                )

                try:
                    from notifications.services import notify_booking_confirmed
                    notify_booking_confirmed(booking)
                except Exception:
                    pass

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                'message': 'Booking confirmed successfully!',
                'booking': BookingReadSerializer(booking, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class BookingReserveView(APIView):
    """
    POST /api/v1/bookings/reserve/
    Atomically rechecks availability and temporarily reserves the slot (status=PENDING, expires_at=now+10m)
    so no other customer can book it while processing payment.
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        salon = data['salon']
        service = data['service']
        booking_date = data['booking_date']
        start_time = data['start_time']
        end_time = data['end_time']
        worker_id = data.get('worker_id')
        duration = service.duration

        salon_open_time, salon_close_time, is_salon_closed, closed_reason = _get_salon_day_hours(salon, booking_date)
        if is_salon_closed or not salon_open_time or not salon_close_time:
            return Response(
                {'error': closed_reason or f'Salon is closed on {booking_date.strftime("%A")}.'},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic():
                _clean_expired_reservations()

                if SalonOffDay.objects.filter(salon=salon, date=booking_date).exists():
                    off = SalonOffDay.objects.get(salon=salon, date=booking_date)
                    return Response(
                        {'error': f'Salon is closed on this date: {off.reason}'},
                        status=status.HTTP_409_CONFLICT,
                    )

                active_statuses = [Booking.Status.PENDING, Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS]

                if worker_id:
                    try:
                        worker = WorkerProfile.objects.get(pk=worker_id, salon=salon, is_active=True)
                    except WorkerProfile.DoesNotExist:
                        return Response({'error': 'Worker not found.'}, status=status.HTTP_404_NOT_FOUND)

                    if WorkerLeave.objects.filter(
                        worker=worker, date=booking_date, status=WorkerLeave.Status.APPROVED
                    ).exists():
                        return Response(
                            {'error': 'Worker is on approved leave on this date.'},
                            status=status.HTTP_409_CONFLICT,
                        )

                    w_start, w_end, w_breaks = _get_worker_working_intervals(
                        worker, booking_date, salon_open_time, salon_close_time
                    )
                    if not w_start or not w_end:
                        return Response(
                            {'error': 'Worker is not scheduled to work on this day.'},
                            status=status.HTTP_409_CONFLICT,
                        )

                    if start_time < w_start or end_time > w_end:
                        return Response(
                            {'error': 'Selected slot is outside worker working hours.'},
                            status=status.HTTP_409_CONFLICT,
                        )

                    if w_breaks:
                        for b_s, b_e in w_breaks:
                            if start_time < b_e and end_time > b_s:
                                return Response(
                                    {'error': 'Selected slot overlaps with the specialist scheduled break.'},
                                    status=status.HTTP_409_CONFLICT,
                                )

                    conflicts = Booking.objects.select_for_update().filter(
                        worker=worker,
                        booking_date=booking_date,
                        start_time__lt=end_time,
                        end_time__gt=start_time,
                        status__in=active_statuses,
                    )
                    if conflicts.exists():
                        return Response(
                            {'error': 'This time slot is no longer available. Please choose another slot.'},
                            status=status.HTTP_409_CONFLICT,
                        )
                    assigned_worker = worker

                else:
                    eligible_workers = list(
                        WorkerProfile.objects.filter(salon=salon, is_active=True)
                        .exclude(
                            leaves__date=booking_date,
                            leaves__status=WorkerLeave.Status.APPROVED,
                        )
                    )
                    service_name = service.effective_name.lower()
                    service_std_name = service.service.name.lower() if service.service else ''
                    service_id_str = str(service.id)
                    capable_candidates = []
                    for w in eligible_workers:
                        assigned = [str(s).lower() for s in (w.assigned_services or [])]
                        if not assigned:
                            capable_candidates.append(w)
                        else:
                            can_do = (
                                any(service_name in a or a in service_name for a in assigned)
                                or any(service_std_name in a or a in service_std_name for a in assigned)
                                or service_id_str in [str(s) for s in (w.assigned_services or [])]
                            )
                            if can_do:
                                capable_candidates.append(w)

                    if not capable_candidates:
                        return Response(
                            {'error': 'No eligible workers available on this date.'},
                            status=status.HTTP_409_CONFLICT,
                        )

                    assigned_worker = None
                    for candidate in capable_candidates:
                        w_start, w_end, w_breaks = _get_worker_working_intervals(
                            candidate, booking_date, salon_open_time, salon_close_time
                        )
                        if not w_start or not w_end:
                            continue
                        if start_time < w_start or end_time > w_end:
                            continue
                        has_break_overlap = any(
                            start_time < b_e and end_time > b_s
                            for b_s, b_e in (w_breaks or [])
                        )
                        if has_break_overlap:
                            continue

                        conflicts = Booking.objects.select_for_update().filter(
                            worker=candidate,
                            booking_date=booking_date,
                            start_time__lt=end_time,
                            end_time__gt=start_time,
                            status__in=active_statuses,
                        )
                        if not conflicts.exists():
                            assigned_worker = candidate
                            break

                    if not assigned_worker:
                        return Response(
                            {'error': 'No workers are available for this time slot. Please choose another slot.'},
                            status=status.HTTP_409_CONFLICT,
                        )

                customer = request.user if request.user and request.user.is_authenticated else None
                expires_at = timezone.now() + timedelta(minutes=RESERVATION_TIMEOUT_MINUTES)

                booking = Booking.objects.create(
                    salon=salon,
                    service=service,
                    worker=assigned_worker,
                    customer=customer,
                    client_name=data['client_name'],
                    client_phone=data.get('client_phone', ''),
                    client_email=data.get('client_email', ''),
                    service_name=service.effective_name,
                    service_price=service.price,
                    booking_date=booking_date,
                    booking_time=start_time.strftime('%H:%M'),
                    start_time=start_time,
                    end_time=end_time,
                    duration=f'{duration} mins',
                    station=assigned_worker.station if assigned_worker else 'Station 01',
                    status=Booking.Status.PENDING,
                    expires_at=expires_at,
                    notes=data.get('notes', ''),
                )

                from payments.models import Payment
                Payment.objects.update_or_create(
                    booking=booking,
                    defaults={
                        'customer': customer,
                        'salon': salon,
                        'amount': service.price or 0.00,
                        'payment_method': booking.payment_method or Payment.PaymentMethod.PAY_AT_SALON,
                        'payment_status': Payment.PaymentStatus.PENDING,
                        'notes': data.get('notes', ''),
                    }
                )

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(
            {
                'message': f'Slot temporarily reserved for {RESERVATION_TIMEOUT_MINUTES} minutes. Please proceed with payment.',
                'reservation_id': booking.id,
                'expires_at': booking.expires_at.isoformat(),
                'expires_in_seconds': RESERVATION_TIMEOUT_MINUTES * 60,
                'booking': BookingReadSerializer(booking, context={'request': request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class BookingConfirmPaymentView(APIView):
    """
    POST /api/v1/bookings/<int:pk>/confirm-payment/
    Delegates payment confirmation to the payments app ConfirmPaymentView.
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        from payments.views import ConfirmPaymentView
        return ConfirmPaymentView().post(request, *args, **kwargs)



class BookingReleaseView(APIView):
    """
    POST /api/v1/bookings/<int:pk>/release/
    Releases a temporarily reserved slot if payment fails or user cancels.
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, pk):
        try:
            with transaction.atomic():
                try:
                    booking = Booking.objects.select_for_update().get(pk=pk)
                except Booking.DoesNotExist:
                    return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

                if booking.status == Booking.Status.PENDING:
                    booking.status = Booking.Status.CANCELLED
                    booking.payment_status = Booking.PaymentStatus.FAILED
                    booking.save(update_fields=['status', 'payment_status', 'updated_at'])
                    from payments.models import Payment
                    Payment.objects.filter(booking=booking).update(
                        payment_status=Payment.PaymentStatus.FAILED,
                        updated_at=timezone.now(),
                    )
                    return Response({'message': 'Reservation released successfully.', 'booking_id': booking.id})
                elif booking.status == Booking.Status.CANCELLED:
                    return Response({'message': 'Reservation already cancelled.', 'booking_id': booking.id})
                else:
                    return Response(
                        {'error': f'Cannot release a booking with status {booking.status}.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BookingCreateRazorpayOrderView(APIView):
    """
    POST /api/v1/bookings/create-razorpay-order/
    Delegates Razorpay order creation to payments app CreateRazorpayOrderView.
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        from payments.views import CreateRazorpayOrderView
        return CreateRazorpayOrderView().post(request, *args, **kwargs)


class BookingVerifyRazorpayView(APIView):
    """
    POST /api/v1/bookings/<int:pk>/verify-razorpay/
    Delegates Razorpay signature verification and confirmation to payments app VerifyRazorpayPaymentView.
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, pk=None, *args, **kwargs):
        from payments.views import VerifyRazorpayPaymentView
        return VerifyRazorpayPaymentView().post(request, pk=pk, *args, **kwargs)



class MyBookingsView(APIView):
    """GET /api/v1/bookings/my/ - List the authenticated customer's bookings."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        bookings = Booking.objects.filter(
            customer=request.user
        ).select_related(
            'salon', 'worker', 'worker__user', 'service', 'service__service', 'salon_review', 'worker_review'
        ).order_by('-booking_date', '-start_time')
        serializer = BookingReadSerializer(bookings, many=True, context={'request': request})
        return Response({'bookings': serializer.data})


class BookingCancelView(APIView):
    """PATCH /api/v1/bookings/{pk}/cancel/ - Customer cancels their booking."""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            booking = Booking.objects.get(pk=pk, customer=request.user)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        if booking.status in [Booking.Status.COMPLETED, Booking.Status.CANCELLED]:
            return Response(
                {'error': f'Cannot cancel a booking that is already {booking.status.lower()}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = Booking.Status.CANCELLED
        booking.save(update_fields=['status', 'updated_at'])

        try:
            from notifications.services import notify_booking_cancelled
            notify_booking_cancelled(booking, cancelled_by=request.user)
        except Exception:
            pass

        return Response({'message': 'Booking cancelled successfully.', 'booking_id': booking.id})


# Re-export review views for backward compatibility
from reviews.views import (
    BookingReviewCreateView,
    SalonReviewsListView,
    WorkerReviewsListView,
)



class BookingStatusUpdateView(APIView):
    """
    PATCH /api/v1/bookings/<int:pk>/status/
    Ensure salon owner, assigned salon worker, or admin can mark bookings as COMPLETED, IN_PROGRESS, CANCELLED, etc.,
    or reassign specialist / reschedule.
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = [JWTAuthentication]

    def patch(self, request, pk):
        user = request.user
        new_status = request.data.get("status", "").upper()
        new_payment_status = request.data.get("payment_status", "").upper()

        try:
            booking = Booking.objects.select_related('salon', 'worker', 'worker__user', 'customer').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        worker_profile = getattr(user, "worker_profile", None)
        is_worker = bool(
            worker_profile
            and (booking.worker == worker_profile or (booking.salon == worker_profile.salon and booking.worker is None))
        )
        from salons.views import get_owner_salon
        is_owner = getattr(user, "role", None) == "OWNER" and (
            booking.salon.owner == user or get_owner_salon(user) == booking.salon
        )
        is_admin = getattr(user, "role", None) == "ADMIN" or user.is_superuser or user.is_staff

        if not (is_worker or is_owner or is_admin):
            return Response(
                {"error": "Access denied. You do not have permission to update this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        update_fields = ["updated_at"]
        old_status = booking.status
        old_worker = booking.worker
        old_date = str(booking.booking_date)
        old_time = str(booking.booking_time or booking.start_time or "")

        if new_status:
            valid_statuses = [choice[0] for choice in Booking.Status.choices]
            if new_status not in valid_statuses:
                return Response(
                    {"error": f"Invalid status. Allowed values: {', '.join(valid_statuses)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            booking.status = new_status
            update_fields.append("status")

        if new_payment_status:
            valid_pay_statuses = [choice[0] for choice in Booking.PaymentStatus.choices]
            if new_payment_status in valid_pay_statuses:
                booking.payment_status = new_payment_status
                update_fields.append("payment_status")
        elif new_status == Booking.Status.COMPLETED and booking.payment_method == Booking.PaymentMethod.PAY_AT_SALON:
            booking.payment_status = Booking.PaymentStatus.PAID
            update_fields.append("payment_status")

        # Worker self-claim or owner reassignment
        new_worker_id = request.data.get("worker_id")
        reassigned_worker = None
        if new_worker_id and (is_owner or is_admin):
            try:
                candidate_worker = WorkerProfile.objects.get(pk=int(new_worker_id), salon=booking.salon, is_active=True)
                if booking.worker != candidate_worker:
                    reassigned_worker = candidate_worker
                    booking.worker = candidate_worker
                    if candidate_worker.station:
                        booking.station = candidate_worker.station
                        update_fields.append("station")
                    update_fields.append("worker")
            except Exception:
                pass
        elif is_worker and worker_profile and booking.worker is None and booking.salon == worker_profile.salon:
            booking.worker = worker_profile
            if worker_profile.station:
                booking.station = worker_profile.station
                update_fields.append("station")
            update_fields.append("worker")

        # Reschedule support (date / start_time)
        rescheduled = False
        new_booking_date = request.data.get("booking_date")
        new_start_time = request.data.get("start_time") or request.data.get("booking_time")
        if new_booking_date:
            try:
                from datetime import datetime
                parsed_d = datetime.strptime(str(new_booking_date).strip(), "%Y-%m-%d").date()
                if parsed_d != booking.booking_date:
                    booking.booking_date = parsed_d
                    update_fields.append("booking_date")
                    rescheduled = True
            except Exception:
                pass
        if new_start_time:
            booking.booking_time = str(new_start_time).strip()
            update_fields.append("booking_time")
            rescheduled = True

        booking.save(update_fields=update_fields)

        # Trigger notifications
        try:
            from notifications.services import (
                notify_booking_cancelled,
                notify_booking_rescheduled,
                notify_booking_reassigned,
                notify_refund_completed,
            )

            # 1. Cancellation
            if new_status == Booking.Status.CANCELLED and old_status != Booking.Status.CANCELLED:
                notify_booking_cancelled(booking, cancelled_by=request.user)

            # 2. Reassignment
            if reassigned_worker:
                notify_booking_reassigned(booking, old_worker=old_worker, new_worker=reassigned_worker)

            # 3. Rescheduled
            if rescheduled:
                notify_booking_rescheduled(booking, previous_date=old_date, previous_time=old_time)

            # 4. Refund
            if (
                new_status == "REFUNDED"
                or new_payment_status == Booking.PaymentStatus.REFUNDED
            ):
                notify_refund_completed(booking)
        except Exception:
            pass

        return Response({
            "message": f"Booking status updated to {booking.status}.",
            "booking": BookingReadSerializer(booking, context={"request": request}).data,
        })
