from datetime import datetime, timedelta
from rest_framework import serializers
from .models import Booking, SalonReview, WorkerReview
from .pricing import calculate_pricing
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
        choices=['PAY_AT_SALON', 'ONLINE'],
        default='PAY_AT_SALON',
        required=False,
    )
    voucher_code = serializers.CharField(required=False, allow_blank=True, default='')
    discount_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0.00)
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

        pricing = calculate_pricing(
            ordered_services,
            voucher_code=attrs.get('voucher_code', ''),
            custom_discount=attrs.get('discount_amount', 0.00),
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
    has_salon_review = serializers.SerializerMethodField()
    salon_review = serializers.SerializerMethodField()
    has_worker_review = serializers.SerializerMethodField()
    worker_review = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'salon', 'salon_id', 'salon_name',
            'worker', 'worker_name', 'worker_photo',
            'customer',
            'client_name', 'client_phone', 'client_email',
            'service_name', 'service_display_name', 'service_price',
            'subtotal', 'tax_amount', 'discount_amount', 'voucher_code', 'total_amount',
            'services_detail',
            'booking_date',
            'booking_time', 'start_time', 'end_time',
            'duration', 'duration_minutes',
            'station', 'status', 'notes',
            'payment_method', 'payment_status', 'razorpay_order_id',
            'expires_at',
            'has_salon_review', 'salon_review',
            'has_worker_review', 'worker_review',
            'can_review',
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




