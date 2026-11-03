from rest_framework import serializers
from .models import SalonReview, WorkerReview


class SalonReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    customer_photo = serializers.SerializerMethodField()
    salon_name = serializers.ReadOnlyField(source='salon.name')
    service_name = serializers.ReadOnlyField(source='booking.service_name')

    class Meta:
        model = SalonReview
        fields = [
            'id', 'salon', 'salon_name', 'booking', 'customer',
            'customer_name', 'customer_photo', 'rating', 'comment',
            'service_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'salon', 'salon_name', 'booking', 'customer',
            'customer_name', 'customer_photo', 'service_name',
            'created_at', 'updated_at'
        ]

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.get_full_name() or obj.customer.email.split('@')[0].title()
        return 'Anonymous Client'

    def get_customer_photo(self, obj):
        if obj.customer and getattr(obj.customer, 'profile_photo', None):
            request = self.context.get('request')
            from salons.media_utils import build_full_media_url
            return build_full_media_url(request, obj.customer.profile_photo)
        return ''


class WorkerReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    worker_name = serializers.SerializerMethodField()
    salon_name = serializers.ReadOnlyField(source='salon.name')
    service_name = serializers.ReadOnlyField(source='booking.service_name')

    class Meta:
        model = WorkerReview
        fields = [
            'id', 'salon', 'salon_name', 'worker', 'worker_name',
            'booking', 'customer', 'customer_name', 'rating', 'comment',
            'service_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'salon', 'salon_name', 'worker', 'worker_name',
            'booking', 'customer', 'customer_name', 'service_name',
            'created_at', 'updated_at'
        ]

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.get_full_name() or obj.customer.email.split('@')[0].title()
        return 'Anonymous Client'

    def get_worker_name(self, obj):
        if obj.worker and obj.worker.user:
            return obj.worker.user.get_full_name() or obj.worker.user.email
        return 'Specialist'


class ReviewSubmissionSerializer(serializers.Serializer):
    salon_rating = serializers.IntegerField(required=False, min_value=1, max_value=5)
    salon_comment = serializers.CharField(required=False, allow_blank=True, default='')
    worker_rating = serializers.IntegerField(required=False, min_value=1, max_value=5)
    worker_comment = serializers.CharField(required=False, allow_blank=True, default='')
    rating = serializers.IntegerField(required=False, min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        if 'rating' in attrs and 'salon_rating' not in attrs:
            attrs['salon_rating'] = attrs['rating']
        if 'comment' in attrs and not attrs.get('salon_comment'):
            attrs['salon_comment'] = attrs['comment']

        if 'salon_rating' not in attrs and 'worker_rating' not in attrs:
            raise serializers.ValidationError("At least one rating (for salon or worker) must be provided.")
        return attrs


class AdminSalonReviewSerializer(serializers.ModelSerializer):
    salon_name = serializers.ReadOnlyField(source='salon.name')
    salon_city = serializers.ReadOnlyField(source='salon.city')
    salon_status = serializers.ReadOnlyField(source='salon.approval_status')
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.ReadOnlyField(source='customer.email')
    customer_photo = serializers.SerializerMethodField()
    appointment_date = serializers.SerializerMethodField()
    appointment_time = serializers.SerializerMethodField()
    service_name = serializers.ReadOnlyField(source='booking.service_name')
    booking_reference = serializers.ReadOnlyField(source='booking.booking_id')
    booking_total = serializers.SerializerMethodField()
    hidden_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SalonReview
        fields = [
            'id',
            'salon',
            'salon_name',
            'salon_city',
            'salon_status',
            'booking',
            'booking_reference',
            'appointment_date',
            'appointment_time',
            'service_name',
            'booking_total',
            'customer',
            'customer_name',
            'customer_email',
            'customer_photo',
            'rating',
            'comment',
            'is_hidden',
            'hidden_at',
            'hidden_by',
            'hidden_by_name',
            'moderation_reason',
            'moderation_history',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.get_full_name() or obj.customer.email.split('@')[0].title()
        return 'Anonymous Client'

    def get_customer_photo(self, obj):
        if obj.customer and getattr(obj.customer, 'profile_photo', None):
            request = self.context.get('request')
            from salons.media_utils import build_full_media_url
            return build_full_media_url(request, obj.customer.profile_photo)
        return ''

    def get_appointment_date(self, obj):
        if obj.booking and obj.booking.booking_date:
            if hasattr(obj.booking.booking_date, 'strftime'):
                return obj.booking.booking_date.strftime("%Y-%m-%d")
            return str(obj.booking.booking_date)
        return None

    def get_appointment_time(self, obj):
        if obj.booking and obj.booking.booking_time:
            if hasattr(obj.booking.booking_time, 'strftime'):
                return obj.booking.booking_time.strftime("%H:%M")
            return str(obj.booking.booking_time)
        return None

    def get_booking_total(self, obj):
        if obj.booking:
            val = getattr(obj.booking, 'final_amount', None) or getattr(obj.booking, 'total_amount', 0.0)
            return float(val) if val is not None else 0.0
        return 0.0

    def get_hidden_by_name(self, obj):
        if obj.hidden_by:
            return obj.hidden_by.get_full_name() or obj.hidden_by.email
        return None


class AdminReviewModerationSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['hide', 'unhide'])
    reason = serializers.CharField(required=False, allow_blank=True, max_length=1000, default='')

    def validate(self, attrs):
        if attrs.get('action') == 'hide' and not attrs.get('reason', '').strip():
            attrs['reason'] = 'Inappropriate content or violates review policy'
        return attrs


