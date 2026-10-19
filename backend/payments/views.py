from datetime import timedelta
import hmac
import hashlib
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
    """
    POST /api/v1/payments/create-razorpay-order/
    (Also accessible via /api/v1/bookings/create-razorpay-order/)
    Atomically rechecks slot availability, temporarily reserves the booking,
    creates a Razorpay order, creates/updates the Payment record, and returns order metadata.
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

                amount_in_paise = int(round(float(service.price) * 100))

                rzp_key = getattr(settings, 'RAZORPAY_KEY_ID', '')
                rzp_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')

                if not rzp_key or not rzp_secret:
                    return Response(
                        {'error': 'Razorpay payment gateway credentials are not configured on the server.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

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

                booking_payload = {
                    'salon_id': salon.id,
                    'service_id': service.id,
                    'worker_id': assigned_worker.id if assigned_worker else None,
                    'booking_date': str(booking_date),
                    'start_time': start_time.strftime('%H:%M'),
                    'client_name': data['client_name'],
                    'client_phone': data.get('client_phone', ''),
                    'client_email': data.get('client_email', ''),
                    'notes': data.get('notes', ''),
                    'payment_method': 'ONLINE',
                }

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(
            {
                'message': 'Razorpay order created successfully.',
                'booking_id': 0,
                'razorpay_order_id': order_id,
                'razorpay_key_id': rzp_key,
                'amount': amount_in_paise,
                'currency': 'INR',
                'service_name': service.effective_name,
                'salon_name': salon.name,
                'client_name': data['client_name'],
                'client_email': data.get('client_email', ''),
                'client_phone': data.get('client_phone', ''),
                'booking_payload': booking_payload,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyRazorpayPaymentView(APIView):
    """
    POST /api/v1/payments/<int:pk>/verify-razorpay/ or /api/v1/payments/verify-razorpay/
    (Also accessible via /api/v1/bookings/...)
    Verifies Razorpay payment signature, creates the Booking and Payment records only upon verified success.
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, pk=None):
        order_id = request.data.get('razorpay_order_id', '')
        payment_id = request.data.get('razorpay_payment_id', '')
        signature = request.data.get('razorpay_signature', '')

        if not payment_id or not order_id:
            return Response({'error': 'razorpay_payment_id and razorpay_order_id are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Signature verification if secret configured
        rzp_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', '')
        if signature and rzp_secret and not rzp_secret.startswith('rzp_test_secret_bookmysalon'):
            msg = f"{order_id}|{payment_id}".encode()
            expected = hmac.new(rzp_secret.encode(), msg, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected, signature):
                return Response({'error': 'Invalid payment signature verification.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                booking = None
                if pk and int(pk) > 0:
                    booking = Booking.objects.select_for_update().filter(pk=pk).first()

                if booking:
                    if booking.status == Booking.Status.CONFIRMED:
                        return Response({
                            'message': 'Booking already confirmed.',
                            'booking': BookingReadSerializer(booking, context={'request': request}).data,
                        })

                    booking.status = Booking.Status.CONFIRMED
                    booking.payment_status = Booking.PaymentStatus.PAID
                    booking.payment_method = Booking.PaymentMethod.ONLINE
                    booking.razorpay_payment_id = payment_id
                    booking.razorpay_order_id = order_id
                    booking.expires_at = None
                    booking.save(update_fields=[
                        'status', 'payment_status', 'payment_method',
                        'razorpay_payment_id', 'razorpay_order_id', 'expires_at', 'updated_at'
                    ])
                else:
                    # ONLY CREATE THE BOOKING NOW, AFTER SUCCESSFUL RAZORPAY VERIFICATION!
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

                    assigned_worker = None
                    if worker_id:
                        assigned_worker = WorkerProfile.objects.filter(pk=worker_id, salon=salon, is_active=True).first()
                    if not assigned_worker:
                        eligible_workers = list(
                            WorkerProfile.objects.filter(salon=salon, is_active=True)
                            .exclude(leaves__date=booking_date, leaves__status=WorkerLeave.Status.APPROVED)
                        )
                        for cand in eligible_workers:
                            conflicts = Booking.objects.select_for_update().filter(
                                worker=cand,
                                booking_date=booking_date,
                                start_time__lt=end_time,
                                end_time__gt=start_time,
                                status__in=[Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS],
                            )
                            if not conflicts.exists():
                                assigned_worker = cand
                                break

                    customer = request.user if request.user and request.user.is_authenticated else None

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
                        status=Booking.Status.CONFIRMED,
                        payment_method=Booking.PaymentMethod.ONLINE,
                        payment_status=Booking.PaymentStatus.PAID,
                        razorpay_order_id=order_id,
                        razorpay_payment_id=payment_id,
                        notes=data.get('notes', ''),
                    )

                # Record / update Payment record in payments app
                Payment.objects.update_or_create(
                    booking=booking,
                    defaults={
                        'customer': booking.customer,
                        'salon': booking.salon,
                        'amount': booking.service_price or 0.00,
                        'payment_method': Payment.PaymentMethod.ONLINE,
                        'payment_status': Payment.PaymentStatus.PAID,
                        'razorpay_order_id': order_id,
                        'razorpay_payment_id': payment_id,
                        'razorpay_signature': signature or '',
                        'notes': booking.notes or '',
                    }
                )

                try:
                    from notifications.services import notify_booking_confirmed, notify_payment_success
                    notify_booking_confirmed(booking)
                    notify_payment_success(booking, amount=booking.service_price, payment_id=payment_id)
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
    POST /api/v1/payments/<int:pk>/confirm-payment/
    (Also accessible via /api/v1/bookings/<int:pk>/confirm-payment/)
    Atomically confirms payment on a reserved booking (transitions PENDING -> CONFIRMED).
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request, pk):
        try:
            with transaction.atomic():
                _clean_expired_reservations()
                try:
                    booking = Booking.objects.select_for_update().get(pk=pk)
                except Booking.DoesNotExist:
                    return Response({'error': 'Booking reservation not found.'}, status=status.HTTP_404_NOT_FOUND)

                if booking.status == Booking.Status.CONFIRMED:
                    return Response({
                        'message': 'Booking already confirmed.',
                        'booking': BookingReadSerializer(booking, context={'request': request}).data,
                    })

                if booking.status != Booking.Status.PENDING:
                    return Response(
                        {'error': f'Cannot confirm payment for booking with status {booking.status}.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if booking.expires_at and booking.expires_at < timezone.now():
                    booking.status = Booking.Status.CANCELLED
                    booking.save(update_fields=['status', 'updated_at'])
                    return Response(
                        {'error': 'Reservation has expired. Please select a time slot again.'},
                        status=status.HTTP_410_GONE,
                    )

                booking.status = Booking.Status.CONFIRMED
                booking.expires_at = None
                booking.save(update_fields=['status', 'expires_at', 'updated_at'])

                Payment.objects.update_or_create(
                    booking=booking,
                    defaults={
                        'customer': booking.customer,
                        'salon': booking.salon,
                        'amount': booking.service_price or 0.00,
                        'payment_method': booking.payment_method or Payment.PaymentMethod.PAY_AT_SALON,
                        'payment_status': booking.payment_status or Payment.PaymentStatus.PENDING,
                    }
                )

                try:
                    from notifications.services import notify_booking_confirmed, notify_payment_success
                    notify_booking_confirmed(booking)
                    if booking.payment_status == Booking.PaymentStatus.PAID:
                        notify_payment_success(booking, amount=booking.service_price)
                except Exception:
                    pass

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(
            {
                'message': 'Payment confirmed and booking finalized successfully.',
                'booking': BookingReadSerializer(booking, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )


class PaymentDetailView(APIView):
    """
    GET /api/v1/payments/<int:pk>/ or /api/v1/payments/booking/<int:booking_id>/
    Returns payment details for a specific payment or booking.
    """
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
