from datetime import datetime, timedelta
from rest_framework import serializers
from .models import Booking, SalonReview, WorkerReview
from salons.models import WorkerProfile, SalonOffDay, WorkerLeave
from services.models import SalonService


class BookingCreateSerializer(serializers.Serializer):
    salon_id = serializers.IntegerField()
    service_id = serializers.IntegerField()
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
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        from salons.models import Salon
        salon_id = attrs['salon_id']
        service_id = attrs['service_id']
        booking_date = attrs['booking_date']

        # Validate salon exists and is approved
        try:
            from salons.models import Salon
            salon = Salon.objects.get(pk=salon_id, approval_status=Salon.ApprovalStatus.APPROVED)
        except Salon.DoesNotExist:
            raise serializers.ValidationError({'salon_id': 'Salon not found or not approved.'})

        # Validate salon off day
        if SalonOffDay.objects.filter(salon_id=salon_id, date=booking_date).exists():
            off_day = SalonOffDay.objects.get(salon_id=salon_id, date=booking_date)
            raise serializers.ValidationError({'booking_date': f'Salon is closed on this date: {off_day.reason}'})

        # Validate service
        try:
            service = SalonService.objects.get(pk=service_id, salon_id=salon_id, is_active=True)
        except SalonService.DoesNotExist:
            raise serializers.ValidationError({'service_id': 'Service not found for this salon.'})

        # Calculate end_time
        start_time = attrs['start_time']
        start_dt = datetime.combine(booking_date, start_time)
        end_dt = start_dt + timedelta(minutes=service.duration)
        attrs['end_time'] = end_dt.time()
        attrs['service'] = service
        attrs['salon'] = salon
        return attrs


class BookingReadSerializer(serializers.ModelSerializer):
    worker_name = serializers.SerializerMethodField()
    worker_photo = serializers.SerializerMethodField()
    salon_name = serializers.ReadOnlyField(source='salon.name')
    service_display_name = serializers.SerializerMethodField()
    duration_minutes = serializers.SerializerMethodField()
    has_salon_review = serializers.SerializerMethodField()
    salon_review = serializers.SerializerMethodField()
    has_worker_review = serializers.SerializerMethodField()
    worker_review = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'salon', 'salon_name',
            'worker', 'worker_name', 'worker_photo',
            'customer',
            'client_name', 'client_phone', 'client_email',
            'service_name', 'service_display_name', 'service_price',
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

    def get_service_display_name(self, obj):
        if obj.service:
            return obj.service.effective_name
        return obj.service_name

    def get_duration_minutes(self, obj):
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


# Re-export review serializers for backward compatibility
from reviews.serializers import (
    SalonReviewSerializer,
    WorkerReviewSerializer,
    ReviewSubmissionSerializer,
)

