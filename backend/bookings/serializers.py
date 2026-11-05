from datetime import datetime, timedelta
from decimal import Decimal
from rest_framework import serializers
from .models import Booking, SalonReview, WorkerReview, ServiceReceipt
from .pricing import calculate_pricing, COUPON_RULES
from salons.models import WorkerProfile, SalonOffDay, WorkerLeave
from services.models import SalonService

from reviews.serializers import (
    SalonReviewSerializer,
    WorkerReviewSerializer,
    ReviewSubmissionSerializer,
)

class BookingCreateSerializer(serializers.Serializer):
    salon_id = serializers.IntegerField()
    service_id = serializers.IntegerField(required=False, allow_null=True)
    service_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
    )
    booking_date = serializers.DateField()
    start_time = serializers.TimeField()  # HH:MM format
    worker_id = serializers.IntegerField(required=False, allow_null=True)  # null = 'any'
    client_name = serializers.CharField(max_length=150)
    client_phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    client_email = serializers.EmailField(required=False, allow_blank=True, default='')
    payment_method = serializers.ChoiceField(
        choices=['PAY_AT_SALON', 'ONLINE', 'WALLET'],
        default='PAY_AT_SALON',
        required=False,
    )
    voucher_code = serializers.CharField(required=False, allow_blank=True, default='')
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            data = data.copy()
        elif isinstance(data, dict):
            data = dict(data)
        if isinstance(data, dict):
            w = data.get('worker_id')
            if w in ('auto', 'any', 'null', 'undefined', '', None):
                data['worker_id'] = None
        return super().to_internal_value(data)

    def validate(self, attrs):
        from salons.models import Salon
        salon_id = attrs['salon_id']
        booking_date = attrs['booking_date']

        try:
            salon = Salon.objects.get(pk=salon_id, approval_status=Salon.ApprovalStatus.APPROVED)
        except Salon.DoesNotExist:
            raise serializers.ValidationError({'salon_id': 'Salon not found or not approved.'})

        if SalonOffDay.objects.filter(salon_id=salon_id, date=booking_date).exists():
            off_day = SalonOffDay.objects.get(salon_id=salon_id, date=booking_date)
            raise serializers.ValidationError({'booking_date': f'Salon is closed on this date: {off_day.reason}'})

        svc_ids = []
        if attrs.get('service_ids'):
            for sid in attrs['service_ids']:
                try:
                    val = int(sid)
                    if val not in svc_ids:
                        svc_ids.append(val)
                except (ValueError, TypeError):
                    pass
        elif attrs.get('service_id'):
            svc_ids = [attrs['service_id']]

        if not svc_ids:
            raise serializers.ValidationError({'service_ids': 'At least one service must be selected.'})

        services = list(SalonService.objects.filter(pk__in=svc_ids, salon_id=salon_id, is_active=True))
        if not services or len(services) != len(svc_ids):
            raise serializers.ValidationError({'service_ids': 'One or more selected services were not found or are inactive.'})

        services_dict = {s.id: s for s in services}
        ordered_services = [services_dict[sid] for sid in svc_ids if sid in services_dict]

        # Validate voucher / offer code strictly against Offer engine and approved server rules
        raw_code = (attrs.get('voucher_code') or '').strip().upper()
        applied_offer = None
        if raw_code:
            from django.core.exceptions import ValidationError as DjangoValidationError
            from offers.services import validate_and_calculate_offer
            request = self.context.get('request')
            customer_user = request.user if request and request.user.is_authenticated else None
            try:
                offer_calc = validate_and_calculate_offer(
                    salon=salon,
                    offer_code_or_id=raw_code,
                    services=ordered_services,
                    customer=customer_user,
                    customer_phone=attrs.get('client_phone', ''),
                    customer_email=attrs.get('client_email', ''),
                    booking_date=booking_date,
                    booking_time=attrs.get('start_time'),
                )
                applied_offer = offer_calc.get('offer')
                tot_dur = sum(int(s.duration or 0) for s in ordered_services)
                pricing = {
                    'subtotal': offer_calc['subtotal'],
                    'total_duration': max(15, tot_dur),
                    'tax_amount': offer_calc['tax_amount'],
                    'discount_amount': offer_calc['discount_amount'],
                    'voucher_code': offer_calc['offer_code'],
                    'total_amount': offer_calc['total_amount'],
                }
            except DjangoValidationError as ve:
                err_msg = ve.message if hasattr(ve, 'message') else (', '.join(ve.messages) if hasattr(ve, 'messages') else str(ve))
                raise serializers.ValidationError({'voucher_code': err_msg})
        else:
            pricing = calculate_pricing(
                ordered_services,
                voucher_code='',
            )

        total_duration = pricing['total_duration']
        start_time = attrs['start_time']
        start_dt = datetime.combine(booking_date, start_time)
        end_dt = start_dt + timedelta(minutes=total_duration)

        attrs['end_time'] = end_dt.time()
        attrs['service'] = ordered_services[0]
        attrs['services_list'] = ordered_services
        attrs['salon'] = salon
        attrs['pricing'] = pricing
        attrs['subtotal'] = pricing['subtotal']
        attrs['tax_amount'] = pricing['tax_amount']
        attrs['discount_amount'] = pricing['discount_amount']
        attrs['total_amount'] = pricing['total_amount']
        attrs['voucher_code'] = pricing['voucher_code']
        attrs['applied_offer'] = applied_offer
        attrs['total_duration'] = total_duration

        return attrs


class BookingReadSerializer(serializers.ModelSerializer):
    worker_name = serializers.SerializerMethodField()
    worker_photo = serializers.SerializerMethodField()
    salon_name = serializers.ReadOnlyField(source='salon.name')
    salon_id = serializers.ReadOnlyField(source='salon.id')
    service_display_name = serializers.SerializerMethodField()
    duration_minutes = serializers.SerializerMethodField()
    services_detail = serializers.SerializerMethodField()
    applied_offer_title = serializers.SerializerMethodField()
    has_salon_review = serializers.SerializerMethodField()
    salon_review = serializers.SerializerMethodField()
    has_worker_review = serializers.SerializerMethodField()
    worker_review = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()
    receipt_available = serializers.SerializerMethodField()
    receipt_number = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'salon', 'salon_id', 'salon_name',
            'worker', 'worker_name', 'worker_photo',
            'customer',
            'client_name', 'client_phone', 'client_email',
            'service_name', 'service_display_name', 'service_price',
            'subtotal', 'tax_amount', 'discount_amount', 'voucher_code', 'applied_offer', 'applied_offer_title', 'total_amount',
            'advance_amount', 'remaining_amount', 'is_advance_paid', 'is_fully_paid',
            'services_detail',
            'booking_date',
            'booking_time', 'start_time', 'end_time',
            'duration', 'duration_minutes',
            'station', 'status', 'notes', 'worker_remarks', 'service_started_at',
            'payment_method', 'payment_status', 'razorpay_order_id',
            'expires_at',
            'has_salon_review', 'salon_review',
            'has_worker_review', 'worker_review',
            'can_review',
            'receipt_available', 'receipt_number',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_worker_name(self, obj):
        if obj.worker and obj.worker.user:
            return obj.worker.user.get_full_name() or obj.worker.user.email
        return 'Any Available'

    def get_worker_photo(self, obj):
        if obj.worker and obj.worker.profile_photo:
            request = self.context.get('request')
            from salons.media_utils import build_full_media_url
            return build_full_media_url(request, obj.worker.profile_photo)
        return ''

    def get_applied_offer_title(self, obj):
        if obj.applied_offer:
            return obj.applied_offer.title
        return obj.voucher_code or ''

    def get_services_detail(self, obj):
        svcs = list(obj.services.all())
        if not svcs and obj.service:
            svcs = [obj.service]
        return [
            {
                'id': s.id,
                'name': s.effective_name,
                'price': str(s.price),
                'duration': s.duration,
                'category': s.service.category.name if s.service and s.service.category else '',
            }
            for s in svcs
        ]

    def get_service_display_name(self, obj):
        svcs = list(obj.services.all())
        if svcs:
            return " + ".join([s.effective_name for s in svcs])
        if obj.service:
            return obj.service.effective_name
        return obj.service_name

    def get_duration_minutes(self, obj):
        svcs = list(obj.services.all())
        if svcs:
            return sum([s.duration for s in svcs])
        if obj.service:
            return obj.service.duration
        import re
        if obj.duration:
            m = re.search(r'\d+', obj.duration)
            if m:
                return int(m.group())
        return None

    def get_has_salon_review(self, obj):
        try:
            return hasattr(obj, 'salon_review') and obj.salon_review is not None
        except Exception:
            return False

    def get_salon_review(self, obj):
        try:
            if hasattr(obj, 'salon_review') and obj.salon_review is not None:
                return {
                    'id': obj.salon_review.id,
                    'rating': obj.salon_review.rating,
                    'comment': obj.salon_review.comment,
                    'created_at': obj.salon_review.created_at.isoformat(),
                }
        except Exception:
            pass
        return None

    def get_has_worker_review(self, obj):
        try:
            return hasattr(obj, 'worker_review') and obj.worker_review is not None
        except Exception:
            return False

    def get_worker_review(self, obj):
        try:
            if hasattr(obj, 'worker_review') and obj.worker_review is not None:
                return {
                    'id': obj.worker_review.id,
                    'rating': obj.worker_review.rating,
                    'comment': obj.worker_review.comment,
                    'created_at': obj.worker_review.created_at.isoformat(),
                }
        except Exception:
            pass
        return None

    def get_can_review(self, obj):
        return obj.status == Booking.Status.COMPLETED

    def get_receipt_available(self, obj):
        # Eligible only when service is COMPLETED and payment is PAID/fully paid, or already exists
        if hasattr(obj, "service_receipt") and obj.service_receipt is not None:
            return True
        is_completed = (obj.status == Booking.Status.COMPLETED)
        is_paid = (obj.payment_status == Booking.PaymentStatus.PAID or obj.is_fully_paid)
        return is_completed and is_paid

    def get_receipt_number(self, obj):
        if hasattr(obj, "service_receipt") and obj.service_receipt is not None:
            return obj.service_receipt.receipt_number
        if obj.status == Booking.Status.COMPLETED and (obj.payment_status == Booking.PaymentStatus.PAID or obj.is_fully_paid):
            from django.utils import timezone
            return f"BMS-REC-{timezone.now().year}-{obj.id:05d}"
        return None


class WorkerAppointmentSerializer(BookingReadSerializer):
    booking_id_display = serializers.SerializerMethodField()
    formatted_date = serializers.SerializerMethodField()
    formatted_time = serializers.SerializerMethodField()
    formatted_date_time = serializers.SerializerMethodField()
    formatted_amount = serializers.SerializerMethodField()
    duration_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    available_actions = serializers.SerializerMethodField()
    customer_profile = serializers.SerializerMethodField()
    elapsed_service_minutes = serializers.SerializerMethodField()
    is_revenue_synced = serializers.SerializerMethodField()

    class Meta(BookingReadSerializer.Meta):
        fields = BookingReadSerializer.Meta.fields + [
            'booking_id_display',
            'formatted_date',
            'formatted_time',
            'formatted_date_time',
            'formatted_amount',
            'duration_display',
            'status_display',
            'available_actions',
            'customer_profile',
            'elapsed_service_minutes',
            'is_revenue_synced',
        ]

    def get_booking_id_display(self, obj):
        return f"#BK{obj.id}"

    def get_formatted_date(self, obj):
        if obj.booking_date:
            return obj.booking_date.strftime("%b %d, %Y")
        return ""

    def get_formatted_time(self, obj):
        if obj.start_time:
            return obj.start_time.strftime("%I:%M %p")
        return obj.booking_time or ""

    def get_formatted_date_time(self, obj):
        d_str = self.get_formatted_date(obj)
        t_str = self.get_formatted_time(obj)
        if d_str and t_str:
            return f"{d_str} • {t_str}"
        return d_str or t_str or ""

    def get_formatted_amount(self, obj):
        amt = obj.total_amount if obj.total_amount is not None else obj.service_price
        try:
            d = Decimal(str(amt))
            if d == d.to_integral():
                return f"₹{int(d)}"
            return f"₹{d:.2f}"
        except Exception:
            return f"₹{amt}"

    def get_duration_display(self, obj):
        mins = self.get_duration_minutes(obj)
        if mins:
            return f"{mins} mins"
        return obj.duration or "45 mins"

    def get_status_display(self, obj):
        return obj.get_status_display()

    def get_is_revenue_synced(self, obj):
        if obj.status != Booking.Status.COMPLETED:
            return True
        try:
            from payments.models import OwnerWalletTransaction
            if obj.worker_id:
                from payments.models import WorkerEarning
                has_earning = WorkerEarning.objects.filter(booking_id=obj.id, status=WorkerEarning.Status.CREDITED).exists()
                has_worker_debit = OwnerWalletTransaction.objects.filter(
                    booking_id=obj.id,
                    flow=OwnerWalletTransaction.FlowType.DEBIT,
                    transaction_type__in=[
                        OwnerWalletTransaction.TransactionType.WORKER_COMMISSION_PAYOUT,
                        OwnerWalletTransaction.TransactionType.WORKER_ALLOCATION,
                    ],
                ).exists()
                if not (has_earning and has_worker_debit):
                    return False
            has_owner_tx = OwnerWalletTransaction.objects.filter(
                booking_id=obj.id,
                flow=OwnerWalletTransaction.FlowType.CREDIT,
                transaction_type__in=[
                    OwnerWalletTransaction.TransactionType.CUSTOMER_PAYMENT_RECEIVED,
                    OwnerWalletTransaction.TransactionType.FULL_PAYMENT_RECEIVED,
                    OwnerWalletTransaction.TransactionType.REMAINING_RECEIVED,
                    OwnerWalletTransaction.TransactionType.ADVANCE_RECEIVED,
                ],
            ).exists()
            return has_owner_tx
        except Exception:
            return True

    def get_available_actions(self, obj):
        st = obj.status
        if st == Booking.Status.CONFIRMED:
            return ["view", "start"]
        elif st == Booking.Status.IN_PROGRESS:
            return ["view", "complete"]
        elif st == Booking.Status.COMPLETED:
            if not self.get_is_revenue_synced(obj):
                return ["view", "reconcile"]
            return ["view"]
        else:
            return ["view"]

    def get_customer_profile(self, obj):
        from django.utils import timezone
        name = obj.client_name
        phone = obj.client_phone
        email = obj.client_email
        avatar = ""
        total_visits = 1
        member_since = ""

        if obj.customer:
            if not name:
                name = obj.customer.get_full_name() or obj.customer.email.split("@")[0].title()
            if not email:
                email = obj.customer.email
            if hasattr(obj.customer, "customer_profile") and obj.customer.customer_profile:
                if not phone and obj.customer.customer_profile.phone_number:
                    phone = obj.customer.customer_profile.phone_number
                avatar = obj.customer.customer_profile.avatar or ""

            try:
                total_visits = Booking.objects.filter(
                    customer=obj.customer,
                    salon=obj.salon,
                    status=Booking.Status.COMPLETED,
                ).count()
            except Exception:
                total_visits = 1

            if obj.customer.date_joined:
                member_since = obj.customer.date_joined.strftime("%b %Y")

        return {
            "name": name or "Customer",
            "phone": phone or "",
            "email": email or "",
            "avatar": avatar,
            "total_visits": max(1, total_visits),
            "member_since": member_since or "Recent Client",
        }

    def get_elapsed_service_minutes(self, obj):
        from django.utils import timezone
        if obj.service_started_at and obj.status == Booking.Status.IN_PROGRESS:
            diff = timezone.now() - obj.service_started_at
            return max(0, int(diff.total_seconds() / 60))
        return 0


class ServiceReceiptSerializer(serializers.ModelSerializer):
    salon_details = serializers.SerializerMethodField()
    customer_details = serializers.SerializerMethodField()
    appointment_details = serializers.SerializerMethodField()
    pricing_details = serializers.SerializerMethodField()
    payment_details = serializers.SerializerMethodField()
    audit_details = serializers.SerializerMethodField()

    class Meta:
        model = ServiceReceipt
        fields = [
            "id",
            "receipt_number",
            "booking",
            "booking_id",
            "salon_details",
            "customer_details",
            "appointment_details",
            "services_snapshot",
            "pricing_details",
            "payment_details",
            "audit_details",
            "created_at",
            "updated_at",
        ]

    def get_salon_details(self, obj):
        return {
            "id": obj.salon_id,
            "name": obj.salon_name,
            "address": obj.salon_address,
            "city": obj.salon_city,
            "state": obj.salon_state,
            "zip_code": obj.salon_zip_code,
            "phone": obj.salon_phone,
            "email": obj.salon_email,
            "gst_number": obj.salon_gst_number,
        }

    def get_customer_details(self, obj):
        return {
            "id": obj.customer_id,
            "name": obj.customer_name,
            "email": obj.customer_email,
            "phone": obj.customer_phone,
        }

    def get_appointment_details(self, obj):
        return {
            "booking_date": str(obj.booking_date),
            "booking_time": obj.booking_time,
            "start_time": str(obj.start_time) if obj.start_time else "",
            "end_time": str(obj.end_time) if obj.end_time else "",
            "duration": obj.duration,
            "station": obj.station,
            "specialist_name": obj.specialist_name,
        }

    def get_pricing_details(self, obj):
        def fmt_val(v):
            try:
                return f"{Decimal(str(v or '0.00')):.2f}"
            except Exception:
                return str(v or "0.00")

        return {
            "subtotal": fmt_val(obj.subtotal),
            "discount_amount": fmt_val(obj.discount_amount),
            "applied_offer_title": obj.applied_offer_title,
            "voucher_code": obj.voucher_code,
            "tax_amount": fmt_val(obj.tax_amount),
            "total_amount": fmt_val(obj.total_amount),
            "advance_amount": fmt_val(obj.advance_amount),
            "remaining_amount": fmt_val(obj.remaining_amount),
            "amount_paid": fmt_val(obj.amount_paid),
        }

    def get_payment_details(self, obj):
        return {
            "payment_method": obj.payment_method,
            "payment_status": obj.payment_status,
            "transaction_id": obj.transaction_id,
            "paid_at": obj.paid_at.isoformat() if obj.paid_at else "",
        }

    def get_audit_details(self, obj):
        return {
            "is_cancelled": obj.is_cancelled,
            "is_refunded": obj.is_refunded,
            "refund_amount": str(obj.refund_amount),
            "refund_date": obj.refund_date.isoformat() if obj.refund_date else None,
            "cancellation_reason": obj.cancellation_reason,
        }


class AdminBookingSerializer(BookingReadSerializer):
    """
    Comprehensive read-only booking representation for Super Admin monitoring and audits.
    """
    formatted_booking_id = serializers.SerializerMethodField()
    salon_city = serializers.ReadOnlyField(source='salon.city')
    salon_address = serializers.ReadOnlyField(source='salon.address')
    salon_phone = serializers.ReadOnlyField(source='salon.phone')
    salon_owner_name = serializers.SerializerMethodField()
    salon_owner_email = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    customer_avatar = serializers.SerializerMethodField()
    receipt_id = serializers.SerializerMethodField()
    cancellation_details = serializers.SerializerMethodField()
    refund_details = serializers.SerializerMethodField()
    payments_history = serializers.SerializerMethodField()

    class Meta(BookingReadSerializer.Meta):
        fields = BookingReadSerializer.Meta.fields + [
            'formatted_booking_id',
            'salon_city',
            'salon_address',
            'salon_phone',
            'salon_owner_name',
            'salon_owner_email',
            'customer_name',
            'customer_email',
            'customer_phone',
            'customer_avatar',
            'receipt_id',
            'cancellation_details',
            'refund_details',
            'payments_history',
            'razorpay_payment_id',
        ]

    def get_formatted_booking_id(self, obj):
        return f"BK{obj.id:04d}"

    def get_salon_owner_name(self, obj):
        if obj.salon and obj.salon.owner:
            return obj.salon.owner.get_full_name() or obj.salon.owner.email.split("@")[0].title()
        return ""

    def get_salon_owner_email(self, obj):
        if obj.salon and obj.salon.owner:
            return obj.salon.owner.email
        return ""

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.get_full_name() or obj.client_name or obj.customer.email.split("@")[0].title()
        return obj.client_name or "Walk-in Client"

    def get_customer_email(self, obj):
        if obj.customer and obj.customer.email:
            return obj.customer.email
        return obj.client_email or ""

    def get_customer_phone(self, obj):
        if obj.customer and hasattr(obj.customer, 'customer_profile') and obj.customer.customer_profile:
            phone = getattr(obj.customer.customer_profile, 'phone_number', '')
            if phone:
                return phone
        return obj.client_phone or ""

    def get_customer_avatar(self, obj):
        if obj.customer and hasattr(obj.customer, 'customer_profile') and obj.customer.customer_profile:
            return getattr(obj.customer.customer_profile, 'avatar', '') or ""
        return ""

    def get_receipt_id(self, obj):
        receipt = getattr(obj, 'service_receipt', None)
        return receipt.id if receipt else None

    def get_cancellation_details(self, obj):
        if obj.status != Booking.Status.CANCELLED:
            return None
        receipt = getattr(obj, 'service_receipt', None)
        reason = (receipt.cancellation_reason if receipt and receipt.cancellation_reason else None) or obj.notes or "Cancelled"
        return {
            "is_cancelled": True,
            "reason": reason,
            "cancelled_at": obj.updated_at.isoformat() if obj.updated_at else None,
        }

    def get_refund_details(self, obj):
        receipt = getattr(obj, 'service_receipt', None)
        is_refunded = bool(
            (receipt and receipt.is_refunded)
            or (obj.payment_status == Booking.PaymentStatus.REFUNDED)
        )
        refund_amount = (
            str(receipt.refund_amount)
            if receipt and receipt.refund_amount
            else (str(obj.total_amount) if is_refunded else "0.00")
        )
        refund_date = (
            receipt.refund_date.isoformat()
            if receipt and receipt.refund_date
            else None
        )
        return {
            "is_refunded": is_refunded,
            "refund_amount": refund_amount,
            "refund_date": refund_date,
            "payment_status": obj.payment_status,
        }

    def get_payments_history(self, obj):
        try:
            payments = obj.payments.all().order_by("-created_at")
            return [
                {
                    "id": p.id,
                    "amount": str(p.amount),
                    "payment_method": p.payment_method,
                    "payment_status": p.payment_status,
                    "payment_type": p.payment_type,
                    "razorpay_order_id": getattr(p, "razorpay_order_id", ""),
                    "razorpay_payment_id": getattr(p, "razorpay_payment_id", ""),
                    "paid_at": p.paid_at.isoformat() if getattr(p, "paid_at", None) else None,
                    "created_at": p.created_at.isoformat() if getattr(p, "created_at", None) else None,
                }
                for p in payments
            ]
        except Exception:
            return []


class AdminSalonBookingSummarySerializer(serializers.Serializer):
    """
    Aggregated salon performance summary for the Super Admin booking directory.
    """
    id = serializers.IntegerField()
    name = serializers.CharField()
    city = serializers.CharField(allow_blank=True, default="")
    address = serializers.CharField(allow_blank=True, default="")
    phone = serializers.CharField(allow_blank=True, default="")
    email = serializers.EmailField(allow_blank=True, default="")
    approval_status = serializers.CharField()
    owner_name = serializers.CharField(allow_blank=True, default="")
    owner_email = serializers.EmailField(allow_blank=True, default="")
    total_bookings = serializers.IntegerField(default=0)
    completed_bookings = serializers.IntegerField(default=0)
    confirmed_bookings = serializers.IntegerField(default=0)
    in_progress_bookings = serializers.IntegerField(default=0)
    cancelled_bookings = serializers.IntegerField(default=0)
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    latest_booking_date = serializers.DateField(allow_null=True, required=False)







