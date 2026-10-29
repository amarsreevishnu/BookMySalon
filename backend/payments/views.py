from decimal import Decimal
from datetime import timedelta
import hmac
import hashlib
import logging
import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.authentication import CustomJWTAuthentication as JWTAuthentication
from bookings.models import Booking
from bookings.serializers import BookingCreateSerializer, BookingReadSerializer
from bookings.views import (
    OptionalJWTAuthentication,
    _get_salon_day_hours,
    _get_worker_working_intervals,
    _clean_expired_reservations,
    RESERVATION_TIMEOUT_MINUTES,
)
from salons.models import SalonOffDay, WorkerProfile, WorkerLeave
from .models import Payment
from .serializers import PaymentSerializer


class CreateRazorpayOrderView(APIView):
  
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        salon = data['salon']
        service = data['service']
        services_list = data.get('services_list', [service])
        booking_date = data['booking_date']
        start_time = data['start_time']
        end_time = data['end_time']
        worker_id = data.get('worker_id')
        duration = data.get('total_duration', service.duration)
        subtotal = data.get('subtotal', service.price)
        tax_amount = data.get('tax_amount', Decimal('0.00'))
        discount_amount = data.get('discount_amount', Decimal('0.00'))
        total_amount = data.get('total_amount', service.price)
        voucher_code = data.get('voucher_code', '')

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

                    # Verify worker can perform all services
                    assigned = [str(s).lower() for s in (worker.assigned_services or [])]
                    if assigned:
                        can_do_all = True
                        for ss in services_list:
                            s_name = ss.effective_name.lower()
                            s_std = ss.service.name.lower() if ss.service else ''
                            if not (
                                any(s_name in a or a in s_name for a in assigned)
                                or any(s_std in a or a in s_std for a in assigned)
                                or str(ss.id) in assigned
                            ):
                                can_do_all = False
                                break
                        if not can_do_all:
                            return Response(
                                {'error': 'The selected specialist does not perform all chosen services.'},
                                status=status.HTTP_400_BAD_REQUEST,
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
                    capable_candidates = []
                    for w in eligible_workers:
                        assigned = [str(s).lower() for s in (w.assigned_services or [])]
                        if not assigned:
                            capable_candidates.append(w)
                        else:
                            can_do_all = True
                            for ss in services_list:
                                s_name = ss.effective_name.lower()
                                s_std = ss.service.name.lower() if ss.service else ''
                                if not (
                                    any(s_name in a or a in s_name for a in assigned)
                                    or any(s_std in a or a in s_std for a in assigned)
                                    or str(ss.id) in assigned
                                ):
                                    can_do_all = False
                                    break
                            if can_do_all:
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

                # Check if advance token only was requested (e.g. ₹100 token)
                is_token_only = bool(data.get('is_token_only') or data.get('payment_type') == 'ADVANCE')
                if is_token_only:
                    advance_charge = min(Decimal("100.00"), total_amount)
                    amount_in_paise = max(100, int(round(float(advance_charge) * 100)))
                    remaining_after_advance = max(Decimal("0.00"), total_amount - advance_charge)
                else:
                    advance_charge = total_amount
                    amount_in_paise = max(100, int(round(float(total_amount) * 100)))
                    remaining_after_advance = Decimal("0.00")

                rzp_key = getattr(settings, 'RAZORPAY_KEY_ID', '')
                rzp_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')

                if not rzp_key or not rzp_secret:
                    return Response(
                        {'error': 'Razorpay payment gateway credentials are not configured on the server.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

                service_display = " + ".join(s.effective_name for s in services_list)
                receipt_id = f"rcpt_{salon.id}_{int(timezone.now().timestamp())}"
                try:
                    rzp_res = requests.post(
                        "https://api.razorpay.com/v1/orders",
                        auth=(rzp_key, rzp_secret),
                        json={
                            "amount": amount_in_paise,
                            "currency": "INR",
                            "receipt": receipt_id,
                            "notes": {
                                "salon_id": str(salon.id),
                                "service_id": str(service.id),
                                "service_ids": ",".join(str(s.id) for s in services_list),
                                "service_names": service_display[:200],
                                "subtotal": str(subtotal),
                                "tax_amount": str(tax_amount),
                                "discount_amount": str(discount_amount),
                                "total_amount": str(total_amount),
                                "is_token_only": "true" if is_token_only else "false",
                                "advance_amount": str(advance_charge),
                                "voucher_code": str(voucher_code),
                                "worker_id": str(assigned_worker.id) if assigned_worker else "",
                                "client_name": str(data['client_name']),
                                "booking_date": str(booking_date),
                                "start_time": str(start_time),
                            },
                        },
                        timeout=12,
                    )
                except Exception as net_err:
                    return Response(
                        {'error': f'Unable to connect to Razorpay payment gateway: {str(net_err)}. Please try again or choose Pay at Salon.'},
                        status=status.HTTP_502_BAD_GATEWAY,
                    )

                if rzp_res.status_code not in (200, 201):
                    err_desc = 'Failed to create Razorpay payment order'
                    try:
                        err_json = rzp_res.json()
                        err_desc = err_json.get('error', {}).get('description') or err_json.get('error', {}).get('code') or err_desc
                    except Exception:
                        err_desc = rzp_res.text or err_desc
                    return Response(
                        {'error': f'Razorpay Error: {err_desc}. Please check payment gateway keys or choose Pay at Salon.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                order_id = rzp_res.json().get("id")
                if not order_id:
                    return Response(
                        {'error': 'Razorpay order creation did not return a valid order ID.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

                customer = request.user if request.user and request.user.is_authenticated else None
                expires_at = timezone.now() + timedelta(minutes=RESERVATION_TIMEOUT_MINUTES)

                # 1. Create PENDING booking with slot lock
                booking = Booking.objects.create(
                    salon=salon,
                    service=service,
                    worker=assigned_worker,
                    customer=customer,
                    client_name=data['client_name'],
                    client_phone=data.get('client_phone', ''),
                    client_email=data.get('client_email', ''),
                    service_name=service_display,
                    service_price=subtotal,
                    subtotal=subtotal,
                    tax_amount=tax_amount,
                    discount_amount=discount_amount,
                    voucher_code=voucher_code,
                    total_amount=total_amount,
                    advance_amount=advance_charge,
                    remaining_amount=remaining_after_advance,
                    is_advance_paid=False,
                    is_fully_paid=False,
                    booking_date=booking_date,
                    booking_time=start_time.strftime('%H:%M'),
                    start_time=start_time,
                    end_time=end_time,
                    duration=f'{duration} mins',
                    station=assigned_worker.station if assigned_worker else 'Station 01',
                    status=Booking.Status.PENDING,
                    payment_method=Booking.PaymentMethod.ONLINE,
                    payment_status=Booking.PaymentStatus.PENDING,
                    razorpay_order_id=order_id,
                    expires_at=expires_at,
                    notes=data.get('notes', ''),
                )
                booking.services.set(services_list)

                # 2. Create corresponding Payment record
                Payment.objects.update_or_create(
                    booking=booking,
                    defaults={
                        'customer': customer,
                        'salon': salon,
                        'amount': advance_charge,
                        'payment_type': Payment.PaymentType.ADVANCE if is_token_only else Payment.PaymentType.FULL,
                        'payment_method': Payment.PaymentMethod.ONLINE,
                        'payment_status': Payment.PaymentStatus.PENDING,
                        'razorpay_order_id': order_id,
                        'notes': booking.notes or '',
                    }
                )

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(
            {
                'message': 'Razorpay order created successfully.',
                'booking_id': booking.id,
                'razorpay_order_id': order_id,
                'razorpay_key_id': rzp_key,
                'amount': amount_in_paise,
                'currency': 'INR',
                'service_name': service_display,
                'services_list': [
                    {'id': s.id, 'name': s.effective_name, 'price': str(s.price), 'duration': s.duration}
                    for s in services_list
                ],
                'subtotal': str(subtotal),
                'tax_amount': str(tax_amount),
                'discount_amount': str(discount_amount),
                'total_amount': str(total_amount),
                'voucher_code': voucher_code,
                'total_duration': duration,
                'salon_name': salon.name,
                'client_name': data['client_name'],
                'client_email': data.get('client_email', ''),
                'client_phone': data.get('client_phone', ''),
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyRazorpayPaymentView(APIView):
    
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, pk=None):
        order_id = str(request.data.get('razorpay_order_id', '')).strip()
        payment_id = str(request.data.get('razorpay_payment_id', '')).strip()
        signature = str(request.data.get('razorpay_signature', '')).strip()

        # Step 1: Require all three Razorpay fields unconditionally
        if not order_id or not payment_id or not signature:
            return Response(
                {'error': 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are all strictly required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 2: Mandatory HMAC-SHA256 signature verification
        rzp_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')
        if not rzp_secret:
            return Response(
                {'error': 'Razorpay payment gateway secret is not configured on the server.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        msg = f"{order_id}|{payment_id}".encode()
        expected = hmac.new(rzp_secret.encode(), msg, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            return Response(
                {'error': 'Invalid payment signature. Verification failed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Step 3: Look up the pending booking by its stored razorpay_order_id
        try:
            with transaction.atomic():
                _clean_expired_reservations()

                booking_query = Booking.objects.select_for_update().filter(razorpay_order_id=order_id)
                if pk and int(pk) > 0:
                    booking_query = booking_query.filter(pk=pk)

                booking = booking_query.first()
                if not booking:
                    return Response(
                        {'error': 'No pending booking found matching this payment order.'},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                # Idempotent response if already confirmed with this payment
                if booking.status == Booking.Status.CONFIRMED:
                    if booking.razorpay_payment_id == payment_id and booking.payment_status == Booking.PaymentStatus.PAID:
                        return Response({
                            'message': 'Payment already verified and booking confirmed.',
                            'booking': BookingReadSerializer(booking, context={'request': request}).data,
                        }, status=status.HTTP_200_OK)
                    return Response(
                        {'error': 'This booking has already been finalized.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Check if pending reservation has expired
                if booking.expires_at and booking.expires_at < timezone.now():
                    booking.status = Booking.Status.CANCELLED
                    booking.save(update_fields=['status', 'updated_at'])
                    return Response(
                        {'error': 'Booking reservation has expired. Please select a time slot and try again.'},
                        status=status.HTTP_410_GONE,
                    )

                # Customer authorization check if customer is bound to booking
                if booking.customer and request.user and request.user.is_authenticated:
                    if booking.customer != request.user and not request.user.is_staff:
                        return Response(
                            {'error': 'You are not authorized to verify this booking.'},
                            status=status.HTTP_403_FORBIDDEN,
                        )

                # Step 4: Verify payment status & amount directly with Razorpay API (Server-to-Server)
                rzp_key = getattr(settings, 'RAZORPAY_KEY_ID', '')
                if rzp_key and rzp_secret:
                    try:
                        rzp_verify_res = requests.get(
                            f"https://api.razorpay.com/v1/payments/{payment_id}",
                            auth=(rzp_key, rzp_secret),
                            timeout=10,
                        )
                        if rzp_verify_res.status_code == 200:
                            payment_json = rzp_verify_res.json()
                            rzp_status = payment_json.get("status")
                            rzp_order_id = payment_json.get("order_id")
                            rzp_amount = payment_json.get("amount")

                            if rzp_status not in ("captured", "authorized"):
                                return Response(
                                    {'error': f'Payment is not confirmed by Razorpay (status: {rzp_status}).'},
                                    status=status.HTTP_400_BAD_REQUEST,
                                )

                            if rzp_order_id != order_id:
                                return Response(
                                    {'error': 'Payment order mismatch between Razorpay and booking.'},
                                    status=status.HTTP_400_BAD_REQUEST,
                                )

                            expected_charge = booking.advance_amount if (booking.advance_amount and booking.advance_amount > 0) else (booking.total_amount if booking.total_amount is not None else booking.service_price)
                            expected_amount_paise = max(100, int(round(float(expected_charge) * 100)))
                            if rzp_amount is not None and rzp_amount != expected_amount_paise:
                                return Response(
                                    {'error': f'Payment amount mismatch. Expected ₹{expected_amount_paise/100:.2f}, got ₹{rzp_amount/100:.2f}.'},
                                    status=status.HTTP_400_BAD_REQUEST,
                                )
                        elif rzp_verify_res.status_code == 404:
                            return Response(
                                {'error': 'Payment ID not found on Razorpay gateway.'},
                                status=status.HTTP_400_BAD_REQUEST,
                            )
                    except requests.RequestException as api_err:
                        logging.getLogger(__name__).warning("Razorpay API check network warning: %s", api_err)

                # Step 5: Finalize and confirm only that matching pending booking
                booking.status = Booking.Status.CONFIRMED
                booking.payment_method = Booking.PaymentMethod.ONLINE
                booking.razorpay_payment_id = payment_id
                booking.razorpay_order_id = order_id
                booking.expires_at = None
                booking.is_advance_paid = True
                booking.is_fully_paid = (booking.remaining_amount == Decimal("0.00"))
                booking.payment_status = Booking.PaymentStatus.PAID if booking.is_fully_paid else Booking.PaymentStatus.PARTIALLY_PAID
                booking.save(update_fields=[
                    'status', 'payment_status', 'payment_method',
                    'razorpay_payment_id', 'razorpay_order_id', 'expires_at',
                    'is_advance_paid', 'is_fully_paid', 'updated_at'
                ])

                # Record in Owner Revenue ledger
                from payments.services import record_booking_advance_payment
                expected_charge = booking.advance_amount if (booking.advance_amount and booking.advance_amount > 0) else (booking.total_amount if booking.total_amount is not None else booking.service_price)
                record_booking_advance_payment(
                    booking=booking,
                    amount=expected_charge,
                    payment_method=Payment.PaymentMethod.ONLINE,
                    razorpay_order_id=order_id,
                    razorpay_payment_id=payment_id,
                    notes="Verified online payment via Razorpay",
                )

                try:
                    from notifications.services import notify_booking_confirmed, notify_payment_success
                    notify_booking_confirmed(booking)
                    notify_payment_success(
                        booking,
                        amount=booking.total_amount if booking.total_amount is not None else booking.service_price,
                        payment_id=payment_id,
                    )
                except Exception:
                    pass

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(
            {
                'message': 'Online payment verified! Your appointment is successfully booked.',
                'booking': BookingReadSerializer(booking, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class ConfirmPaymentView(APIView):
    """
    Staff-only endpoint to confirm in-person/cash payment for PAY_AT_SALON bookings.
    ONLINE payments MUST NEVER be confirmed here; online bookings require Razorpay gateway verification.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            with transaction.atomic():
                _clean_expired_reservations()
                try:
                    booking = Booking.objects.select_for_update().select_related('salon', 'worker', 'worker__user', 'customer').get(pk=pk)
                except Booking.DoesNotExist:
                    return Response({'error': 'Booking reservation not found.'}, status=status.HTTP_404_NOT_FOUND)

                # 1. STRICT ENFORCEMENT: Never finalize an ONLINE payment here
                if booking.payment_method == Booking.PaymentMethod.ONLINE:
                    return Response(
                        {
                            'error': 'Online payments cannot be finalized manually. '
                                     'Confirmation requires Razorpay gateway signature and order verification.'
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # 2. STRICT PERMISSION: Only salon owner, assigned worker, or admin can confirm offline payment
                user = request.user
                is_admin = bool(user.is_staff or getattr(user, 'role', '') == 'ADMIN')
                is_owner = bool(
                    getattr(user, 'role', '') == 'OWNER'
                    and (booking.salon.owner == user or getattr(booking.salon, 'owner_id', None) == user.id)
                )
                is_assigned_worker = bool(
                    booking.worker and getattr(booking.worker, 'user_id', None) == user.id
                )

                if not (is_admin or is_owner or is_assigned_worker):
                    return Response(
                        {'error': 'You do not have permission to confirm payment for this salon.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                if booking.status == Booking.Status.CONFIRMED and booking.payment_status == Booking.PaymentStatus.PAID:
                    return Response({
                        'message': 'Payment already confirmed.',
                        'booking': BookingReadSerializer(booking, context={'request': request}).data,
                    })

                if booking.status not in (Booking.Status.PENDING, Booking.Status.CONFIRMED):
                    return Response(
                        {'error': f'Cannot confirm payment for booking with status {booking.status}.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if booking.status == Booking.Status.PENDING and booking.expires_at and booking.expires_at < timezone.now():
                    booking.status = Booking.Status.CANCELLED
                    booking.save(update_fields=['status', 'updated_at'])
                    return Response(
                        {'error': 'Reservation has expired. Please select a time slot again.'},
                        status=status.HTTP_410_GONE,
                    )

                # Finalize in-person payment
                booking.status = Booking.Status.CONFIRMED
                booking.payment_status = Booking.PaymentStatus.PAID
                booking.expires_at = None
                booking.save(update_fields=['status', 'payment_status', 'expires_at', 'updated_at'])

                Payment.objects.update_or_create(
                    booking=booking,
                    defaults={
                        'customer': booking.customer,
                        'salon': booking.salon,
                        'amount': booking.total_amount if booking.total_amount is not None else (booking.service_price or 0.00),
                        'payment_method': booking.payment_method or Payment.PaymentMethod.PAY_AT_SALON,
                        'payment_status': Payment.PaymentStatus.PAID,
                    }
                )

                try:
                    from notifications.services import notify_booking_confirmed, notify_payment_success
                    notify_booking_confirmed(booking)
                    notify_payment_success(
                        booking,
                        amount=booking.total_amount if booking.total_amount is not None else booking.service_price,
                    )
                except Exception:
                    pass

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(
            {
                'message': 'In-person payment confirmed and booking finalized successfully.',
                'booking': BookingReadSerializer(booking, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class PaymentDetailView(APIView):
    
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, pk=None, booking_id=None):
        payment = None
        if pk:
            payment = Payment.objects.filter(pk=pk).first()
        elif booking_id:
            payment = Payment.objects.filter(booking_id=booking_id).first()

        if not payment:
            return Response({'error': 'Payment record not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'payment': PaymentSerializer(payment).data}, status=status.HTTP_200_OK)


class OwnerRevenueSummaryView(APIView):
    """
    Returns owner salon revenue metrics:
    - Available balance (net funds available to salon)
    - Total gross collected (advances + remaining + full)
    - Total advances received
    - Total completed service turnover
    - Total worker earnings payout obligation
    - Total refunds disbursed
    - Net salon revenue
    - Recent transactions and quick counts
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        from salons.views import get_owner_salon
        from salons.models import Salon
        salon = get_owner_salon(user)
        salon_id = request.query_params.get("salon_id")
        if salon_id and (getattr(user, "role", None) in ["ADMIN", "OWNER"] or user.is_staff or user.is_superuser):
            s = Salon.objects.filter(pk=salon_id).first()
            if s:
                salon = s

        if not salon:
            return Response({"error": "No salon found for your account."}, status=status.HTTP_404_NOT_FOUND)

        from .models import OwnerWallet, OwnerWalletTransaction, WorkerEarning, Refund
        from .serializers import OwnerWalletSerializer, OwnerWalletTransactionSerializer

        wallet = OwnerWallet.get_or_create_for_salon(salon)

        pending_settlements_count = Booking.objects.filter(
            salon=salon,
            is_advance_paid=True,
            is_fully_paid=False,
            status__in=[Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS]
        ).count()

        completed_bookings_count = Booking.objects.filter(
            salon=salon,
            status=Booking.Status.COMPLETED
        ).count()

        refunds_count = Refund.objects.filter(salon=salon).count()
        recent_txs = OwnerWalletTransaction.objects.filter(salon=salon).select_related('booking')[:10]

        from .services import get_unreconciled_bookings
        unreconciled_count = get_unreconciled_bookings(salon=salon).count()

        net_salon_revenue = max(
            Decimal("0.00"),
            wallet.total_completed_services - wallet.total_worker_payout - wallet.total_refunded
        )

        return Response({
            "wallet": OwnerWalletSerializer(wallet).data,
            "metrics": {
                "available_balance": str(wallet.balance),
                "total_collected": str(wallet.total_collected),
                "total_advances": str(wallet.total_advances),
                "total_completed_services": str(wallet.total_completed_services),
                "total_worker_payout": str(wallet.total_worker_payout),
                "total_refunded": str(wallet.total_refunded),
                "net_salon_revenue": str(net_salon_revenue),
                "pending_settlements_count": pending_settlements_count,
                "completed_bookings_count": completed_bookings_count,
                "refunds_count": refunds_count,
                "unreconciled_bookings_count": unreconciled_count,
            },
            "recent_transactions": OwnerWalletTransactionSerializer(recent_txs, many=True).data,
            "salon": {
                "id": salon.id,
                "name": salon.name,
                "category": salon.category,
                "city": salon.city,
            }
        }, status=status.HTTP_200_OK)


class OwnerTransactionsListView(APIView):
    """
    Paginated list of OwnerWalletTransactions with filtering by type, flow, search term.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        from salons.views import get_owner_salon
        from salons.models import Salon
        from django.db.models import Q
        from django.core.paginator import Paginator

        salon = get_owner_salon(user)
        salon_id = request.query_params.get("salon_id")
        if salon_id and (getattr(user, "role", None) in ["ADMIN", "OWNER"] or user.is_staff or user.is_superuser):
            s = Salon.objects.filter(pk=salon_id).first()
            if s:
                salon = s

        if not salon:
            return Response({"error": "No salon found for your account."}, status=status.HTTP_404_NOT_FOUND)

        from .models import OwnerWalletTransaction
        from .serializers import OwnerWalletTransactionSerializer

        qs = OwnerWalletTransaction.objects.filter(salon=salon).select_related('booking', 'payment')

        tx_type = request.query_params.get("type", "").strip()
        if tx_type:
            qs = qs.filter(transaction_type=tx_type)

        flow = request.query_params.get("flow", "").strip().upper()
        if flow:
            qs = qs.filter(flow=flow)

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(description__icontains=search) |
                Q(booking__client_name__icontains=search) |
                Q(booking__id__icontains=search)
            )

        try:
            page_num = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page_num = 1
        try:
            page_size = max(1, min(100, int(request.query_params.get("page_size", 15))))
        except (ValueError, TypeError):
            page_size = 15

        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page_num)

        serializer = OwnerWalletTransactionSerializer(page_obj.object_list, many=True)
        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_num,
            "page_size": page_size,
            "results": serializer.data,
        }, status=status.HTTP_200_OK)


class OwnerWorkerEarningsView(APIView):
    """
    Returns worker commission performance, earnings ledger, and salon retention.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        from salons.views import get_owner_salon
        from salons.models import Salon, WorkerProfile
        from django.db.models import Sum

        salon = get_owner_salon(user)
        salon_id = request.query_params.get("salon_id")
        if salon_id and (getattr(user, "role", None) in ["ADMIN", "OWNER"] or user.is_staff or user.is_superuser):
            s = Salon.objects.filter(pk=salon_id).first()
            if s:
                salon = s

        if not salon:
            return Response({"error": "No salon found for your account."}, status=status.HTTP_404_NOT_FOUND)

        from .models import WorkerEarning
        from .serializers import WorkerEarningSerializer

        workers = WorkerProfile.objects.filter(salon=salon).select_related("user")
        worker_stats = []

        for w in workers:
            earnings_qs = WorkerEarning.objects.filter(worker=w, salon=salon)
            credited_earnings = earnings_qs.filter(status=WorkerEarning.Status.CREDITED)
            reversals = earnings_qs.filter(status=WorkerEarning.Status.REVERSED)

            gross_sum = credited_earnings.aggregate(Sum("service_price"))["service_price__sum"] or Decimal("0.00")
            worker_sum = credited_earnings.aggregate(Sum("earning_amount"))["earning_amount__sum"] or Decimal("0.00")
            salon_sum = credited_earnings.aggregate(Sum("salon_share"))["salon_share__sum"] or Decimal("0.00")
            rev_sum = reversals.aggregate(Sum("earning_amount"))["earning_amount__sum"] or Decimal("0.00")

            recent_earnings = earnings_qs.order_by("-created_at")[:5]

            worker_stats.append({
                "id": w.id,
                "name": w.user.get_full_name() or w.user.email if w.user else f"Worker #{w.id}",
                "email": w.user.email if w.user else "",
                "phone": w.phone_number,
                "specialization": w.specialization,
                "station": w.station,
                "commission_tier": w.commission_tier,
                "commission_rate": f"{Decimal(str(w.commission_rate)):.2f}",
                "completed_jobs": credited_earnings.count(),
                "gross_service_value": f"{Decimal(str(gross_sum)):.2f}",
                "total_worker_earned": f"{Decimal(str(worker_sum)):.2f}",
                "total_salon_share": f"{Decimal(str(salon_sum)):.2f}",
                "reversals_count": reversals.count(),
                "reversals_amount": f"{Decimal(str(rev_sum)):.2f}",
                "recent_earnings": WorkerEarningSerializer(recent_earnings, many=True).data,
            })

        return Response({
            "workers": worker_stats,
        }, status=status.HTTP_200_OK)


class OwnerCollectRemainingPaymentView(APIView):
    """
    Confirms remaining payment at salon and finalizes service.
    Calculates worker share, salon share, and records full descriptive ledger.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        try:
            booking = Booking.objects.select_related('salon', 'worker', 'worker__user', 'customer').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        from salons.views import get_owner_salon
        owner_salon = get_owner_salon(user)
        is_owner = (booking.salon.owner == user or owner_salon == booking.salon)
        is_admin = getattr(user, "role", None) in ["ADMIN"] or user.is_staff or user.is_superuser
        if not (is_owner or is_admin):
            return Response(
                {"error": "You do not have permission to manage this booking's revenue."},
                status=status.HTTP_403_FORBIDDEN,
            )

        remaining_amount = request.data.get("remaining_amount")
        payment_method = request.data.get("payment_method", Payment.PaymentMethod.CASH)
        notes = request.data.get("notes", "")

        from .services import record_service_completion_and_final_payment
        owner_tx, worker_earning = record_service_completion_and_final_payment(
            booking=booking,
            remaining_amount_paid=remaining_amount,
            payment_method=payment_method,
            completed_by_user=user,
            notes=notes,
        )

        from .serializers import OwnerWalletTransactionSerializer, WorkerEarningSerializer
        from .models import OwnerWallet
        wallet = OwnerWallet.get_or_create_for_salon(booking.salon)

        return Response({
            "message": "Remaining payment collected and service finalized successfully.",
            "booking": BookingReadSerializer(booking, context={"request": request}).data,
            "transaction": OwnerWalletTransactionSerializer(owner_tx).data if owner_tx else None,
            "worker_earning": WorkerEarningSerializer(worker_earning).data if worker_earning else None,
            "wallet_balance": str(wallet.balance),
        }, status=status.HTTP_200_OK)


class OwnerProcessRefundView(APIView):
    """
    Processes refund with reason, reverses worker commission if applicable,
    and logs detailed refund ledger entry.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        try:
            booking = Booking.objects.select_related('salon', 'worker', 'worker__user', 'customer').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        from salons.views import get_owner_salon
        owner_salon = get_owner_salon(user)
        is_owner = (booking.salon.owner == user or owner_salon == booking.salon)
        is_admin = getattr(user, "role", None) in ["ADMIN"] or user.is_staff or user.is_superuser
        if not (is_owner or is_admin):
            return Response(
                {"error": "You do not have permission to process refunds for this salon."},
                status=status.HTTP_403_FORBIDDEN,
            )

        reason = request.data.get("reason", "").strip() or "Cancelled by salon owner"
        force_refund = bool(request.data.get("force_refund", True))

        from .services import process_booking_cancellation_and_refund
        refund, owner_tx = process_booking_cancellation_and_refund(
            booking=booking,
            reason=reason,
            processed_by=user,
            force_refund=force_refund,
        )

        from .serializers import RefundSerializer, OwnerWalletTransactionSerializer
        from .models import OwnerWallet
        wallet = OwnerWallet.get_or_create_for_salon(booking.salon)

        return Response({
            "message": f"Refund of ₹{refund.amount:g} processed successfully." if refund else "Booking cancelled.",
            "refund": RefundSerializer(refund).data if refund else None,
            "transaction": OwnerWalletTransactionSerializer(owner_tx).data if owner_tx else None,
            "booking": BookingReadSerializer(booking, context={"request": request}).data,
            "wallet_balance": str(wallet.balance),
        }, status=status.HTTP_200_OK)


def _get_authenticated_worker_for_request(request):
    user = request.user
    worker = getattr(user, "worker_profile", None)
    if not worker:
        worker = WorkerProfile.objects.filter(user=user).first()
    if not worker and (user.is_staff or user.is_superuser or getattr(user, "role", None) == "ADMIN"):
        worker_id = request.query_params.get("worker_id")
        if worker_id:
            worker = WorkerProfile.objects.filter(pk=worker_id).first()
        if not worker:
            worker = WorkerProfile.objects.first()
    return worker


class WorkerRevenueSummaryView(APIView):
    """
    Returns worker's wallet balance, total lifetime earnings, earnings for date ranges,
    completed service metrics, commission rate, and recent transactions.
    Worker-isolated permission enforcement: worker can only see their own metrics.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        worker = _get_authenticated_worker_for_request(request)
        if not worker:
            return Response(
                {"error": "Access denied. Only registered salon workers can access worker revenue."},
                status=status.HTTP_403_FORBIDDEN,
            )

        from .models import WorkerWallet, WorkerEarning, WorkerWalletTransaction
        from .serializers import WorkerWalletTransactionSerializer, WorkerEarningSerializer
        from django.db.models import Sum

        wallet = WorkerWallet.get_or_create_for_worker(worker)

        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        all_credited = WorkerEarning.objects.filter(
            worker=worker,
            status=WorkerEarning.Status.CREDITED,
        )

        today = timezone.localdate()
        today_earned = all_credited.filter(
            created_at__date=today,
        ).aggregate(Sum("earning_amount"))["earning_amount__sum"] or Decimal("0.00")

        # Range filter
        range_qs = all_credited
        has_custom_range = False
        if start_date_str and end_date_str:
            try:
                from datetime import datetime
                s_date = datetime.strptime(start_date_str.strip(), "%Y-%m-%d").date()
                e_date = datetime.strptime(end_date_str.strip(), "%Y-%m-%d").date()
                range_qs = range_qs.filter(created_at__date__gte=s_date, created_at__date__lte=e_date)
                has_custom_range = True
            except Exception:
                pass

        range_earned = range_qs.aggregate(Sum("earning_amount"))["earning_amount__sum"] or Decimal("0.00")
        range_services_count = range_qs.count()

        # Recent transactions (latest 5)
        recent_txs = WorkerWalletTransaction.objects.filter(
            worker=worker,
        ).select_related("booking", "wallet").order_by("-created_at")[:5]

        # Recent earnings (latest 5)
        recent_earnings = all_credited.select_related("booking").order_by("-created_at")[:5]

        from .services import get_unreconciled_bookings
        unreconciled_count = get_unreconciled_bookings(worker=worker).count()

        worker_name = worker.user.get_full_name() or worker.user.email if worker.user else f"Worker #{worker.id}"

        return Response({
            "worker_id": worker.id,
            "worker_name": worker_name,
            "salon_id": worker.salon_id,
            "salon_name": worker.salon.name if worker.salon else "",
            "commission_rate": f"{Decimal(str(worker.commission_rate)):.2f}",
            "commission_tier": worker.commission_tier or "Standard",
            "station": worker.station or "",
            "wallet_balance": f"{Decimal(str(wallet.balance)):.2f}",
            "total_earned": f"{Decimal(str(wallet.total_earned)):.2f}",
            "today_earned": f"{Decimal(str(today_earned)):.2f}",
            "range_earned": f"{Decimal(str(range_earned)):.2f}",
            "has_custom_range": has_custom_range,
            "completed_services_count": all_credited.count(),
            "range_services_count": range_services_count,
            "unreconciled_bookings_count": unreconciled_count,
            "recent_transactions": WorkerWalletTransactionSerializer(recent_txs, many=True).data,
            "recent_earnings": WorkerEarningSerializer(recent_earnings, many=True).data,
        }, status=status.HTTP_200_OK)


class WorkerEarningsListView(APIView):
    """
    Returns paginated, searchable, date-filtered list of earnings for the authenticated worker.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        worker = _get_authenticated_worker_for_request(request)
        if not worker:
            return Response(
                {"error": "Access denied. Only registered salon workers can access worker revenue."},
                status=status.HTTP_403_FORBIDDEN,
            )

        from .models import WorkerEarning
        from .serializers import WorkerEarningSerializer
        from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
        from django.db.models import Q

        qs = WorkerEarning.objects.filter(worker=worker).select_related("booking", "salon")

        # Status filter
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        # Date range filter
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        if start_date_str:
            try:
                from datetime import datetime
                s_date = datetime.strptime(start_date_str.strip(), "%Y-%m-%d").date()
                qs = qs.filter(created_at__date__gte=s_date)
            except Exception:
                pass
        if end_date_str:
            try:
                from datetime import datetime
                e_date = datetime.strptime(end_date_str.strip(), "%Y-%m-%d").date()
                qs = qs.filter(created_at__date__lte=e_date)
            except Exception:
                pass

        # Search filter
        search = request.query_params.get("search", "").strip()
        if search:
            q_filter = (
                Q(description__icontains=search)
                | Q(booking__client_name__icontains=search)
                | Q(booking__service_name__icontains=search)
            )
            if search.isdigit():
                q_filter |= Q(booking_id=int(search)) | Q(id=int(search))
            qs = qs.filter(q_filter)

        qs = qs.order_by("-created_at")

        # Pagination
        try:
            page_num = int(request.query_params.get("page", 1))
        except (ValueError, TypeError):
            page_num = 1

        try:
            page_size = int(request.query_params.get("page_size", 10))
        except (ValueError, TypeError):
            page_size = 10

        page_size = min(max(page_size, 1), 100)
        paginator = Paginator(qs, page_size)

        try:
            page_obj = paginator.page(page_num)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages) if paginator.num_pages > 0 else []

        serializer = WorkerEarningSerializer(page_obj, many=True)

        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_num,
            "page_size": page_size,
            "results": serializer.data,
        }, status=status.HTTP_200_OK)


class WorkerTransactionsListView(APIView):
    """
    Returns paginated, searchable, flow-filtered list of wallet transactions for the authenticated worker.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        worker = _get_authenticated_worker_for_request(request)
        if not worker:
            return Response(
                {"error": "Access denied. Only registered salon workers can access worker revenue."},
                status=status.HTTP_403_FORBIDDEN,
            )

        from .models import WorkerWalletTransaction
        from .serializers import WorkerWalletTransactionSerializer
        from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
        from django.db.models import Q

        qs = WorkerWalletTransaction.objects.filter(worker=worker).select_related("booking", "wallet", "earning")

        flow = request.query_params.get("flow")
        if flow:
            qs = qs.filter(flow=flow.upper())

        tx_type = request.query_params.get("transaction_type")
        if tx_type:
            qs = qs.filter(transaction_type=tx_type.upper())

        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        if start_date_str:
            try:
                from datetime import datetime
                s_date = datetime.strptime(start_date_str.strip(), "%Y-%m-%d").date()
                qs = qs.filter(created_at__date__gte=s_date)
            except Exception:
                pass
        if end_date_str:
            try:
                from datetime import datetime
                e_date = datetime.strptime(end_date_str.strip(), "%Y-%m-%d").date()
                qs = qs.filter(created_at__date__lte=e_date)
            except Exception:
                pass

        search = request.query_params.get("search", "").strip()
        if search:
            q_filter = Q(description__icontains=search)
            if search.isdigit():
                q_filter |= Q(booking_id=int(search)) | Q(id=int(search))
            qs = qs.filter(q_filter)

        qs = qs.order_by("-created_at")

        try:
            page_num = int(request.query_params.get("page", 1))
        except (ValueError, TypeError):
            page_num = 1

        try:
            page_size = int(request.query_params.get("page_size", 10))
        except (ValueError, TypeError):
            page_size = 10

        page_size = min(max(page_size, 1), 100)
        paginator = Paginator(qs, page_size)

        try:
            page_obj = paginator.page(page_num)
        except PageNotAnInteger:
            page_obj = paginator.page(1)
        except EmptyPage:
            page_obj = paginator.page(paginator.num_pages) if paginator.num_pages > 0 else []

        serializer = WorkerWalletTransactionSerializer(page_obj, many=True)

        return Response({
            "count": paginator.count,
            "total_pages": paginator.num_pages,
            "current_page": page_num,
            "page_size": page_size,
            "results": serializer.data,
        }, status=status.HTTP_200_OK)


class ReconcileBookingRevenueView(APIView):
    """
    Dedicated reconciliation endpoint to retry or finalize financial ledger recording
    for a completed or pending booking without revenue records.
    Accessible by:
    - The worker assigned to the booking
    - The salon owner
    - Platform admin / staff
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        try:
            booking = Booking.objects.select_related(
                "salon", "salon__owner", "worker", "worker__user", "customer"
            ).get(pk=pk)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        from salons.views import get_owner_salon
        worker_profile = getattr(user, "worker_profile", None)
        is_worker = bool(worker_profile and booking.worker == worker_profile)
        is_owner = (
            getattr(user, "role", None) == "OWNER"
            and (booking.salon.owner == user or get_owner_salon(user) == booking.salon)
        )
        is_admin = getattr(user, "role", None) == "ADMIN" or user.is_staff or user.is_superuser

        if not (is_worker or is_owner or is_admin):
            return Response(
                {"error": "Access denied. You do not have permission to reconcile revenue for this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        from .services import reconcile_booking_revenue
        from .serializers import OwnerWalletTransactionSerializer, WorkerEarningSerializer
        from bookings.serializers import WorkerAppointmentSerializer

        try:
            result = reconcile_booking_revenue(booking=booking, reconciled_by=user)
        except Exception as rec_err:
            logger.error("Failed to reconcile revenue for booking %s: %s", pk, rec_err, exc_info=True)
            return Response(
                {"error": f"Failed to reconcile revenue: {str(rec_err)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        booking.refresh_from_db()

        return Response({
            "message": result["message"],
            "reconciled": result["reconciled"],
            "status": result["status"],
            "already_synced": result["already_synced"],
            "owner_transaction_created": result["owner_transaction_created"],
            "worker_earning_created": result["worker_earning_created"],
            "booking": WorkerAppointmentSerializer(booking, context={"request": request}).data,
            "owner_transaction": (
                OwnerWalletTransactionSerializer(result["owner_transaction"]).data
                if result.get("owner_transaction")
                else None
            ),
            "worker_earning": (
                WorkerEarningSerializer(result["worker_earning"]).data
                if result.get("worker_earning")
                else None
            ),
        }, status=status.HTTP_200_OK)


class OwnerUnreconciledBookingsView(APIView):
    """
    Returns list of completed bookings for the owner's salon that are missing revenue ledger entries.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        from salons.views import get_owner_salon
        salon = get_owner_salon(user)
        if not salon and not (user.is_staff or user.is_superuser):
            return Response(
                {"error": "Access denied. Only salon owners can view salon unreconciled bookings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        from .services import get_unreconciled_bookings
        from bookings.serializers import WorkerAppointmentSerializer

        unreconciled_qs = get_unreconciled_bookings(salon=salon)
        return Response({
            "count": unreconciled_qs.count(),
            "unreconciled_bookings": WorkerAppointmentSerializer(
                unreconciled_qs, many=True, context={"request": request}
            ).data,
        }, status=status.HTTP_200_OK)


class WorkerUnreconciledBookingsView(APIView):
    """
    Returns list of completed bookings assigned to the authenticated worker that are missing earnings.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        worker = _get_authenticated_worker_for_request(request)
        if not worker:
            return Response(
                {"error": "Access denied. Only registered salon workers can view worker unreconciled bookings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        from .services import get_unreconciled_bookings
        from bookings.serializers import WorkerAppointmentSerializer

        unreconciled_qs = get_unreconciled_bookings(worker=worker)
        return Response({
            "count": unreconciled_qs.count(),
            "unreconciled_bookings": WorkerAppointmentSerializer(
                unreconciled_qs, many=True, context={"request": request}
            ).data,
        }, status=status.HTTP_200_OK)

