from django.db import transaction, IntegrityError
from django.db.models import Avg, Count
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.authentication import CustomJWTAuthentication as JWTAuthentication
from bookings.models import Booking
from salons.models import Salon, WorkerProfile
from .models import SalonReview, WorkerReview
from .serializers import (
    SalonReviewSerializer,
    WorkerReviewSerializer,
    ReviewSubmissionSerializer,
)


class OptionalJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except Exception:
            return None


class BookingReviewCreateView(APIView):
    """
    GET /api/v1/reviews/bookings/<int:pk>/
    POST /api/v1/reviews/bookings/<int:pk>/
    (Also accessible via /api/v1/bookings/<int:pk>/reviews/ for backward compatibility)

    Enforces backend eligibility:
    1. Customer authentication required.
    2. Customer can only review bookings made from their own account (cannot review other customers' bookings).
    3. Customer can only review a booking that has been marked as COMPLETED.
    4. Exactly one salon review per booking.
    5. Exactly one worker review per booking (booking must have an assigned worker).
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            booking = Booking.objects.select_related(
                'salon', 'worker', 'worker__user', 'salon_review', 'worker_review'
            ).get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_customer = booking.customer == request.user
        is_worker = booking.worker and booking.worker.user == request.user
        is_owner = getattr(request.user, 'role', None) == 'OWNER' and booking.salon.owner == request.user
        is_admin = getattr(request.user, 'role', None) == 'ADMIN' or request.user.is_superuser or request.user.is_staff

        if not (is_customer or is_worker or is_owner or is_admin):
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        worker_info = None
        if booking.worker:
            worker_info = {
                'id': booking.worker.id,
                'name': booking.worker.user.get_full_name() or booking.worker.user.email,
                'specialization': booking.worker.specialization or 'Stylist',
                'station': booking.worker.station or '',
            }

        salon_rev_data = None
        if hasattr(booking, 'salon_review') and booking.salon_review:
            salon_rev_data = SalonReviewSerializer(booking.salon_review, context={'request': request}).data

        worker_rev_data = None
        if hasattr(booking, 'worker_review') and booking.worker_review:
            worker_rev_data = WorkerReviewSerializer(booking.worker_review, context={'request': request}).data

        return Response({
            'booking_id': booking.id,
            'can_review': is_customer and booking.status == Booking.Status.COMPLETED,
            'status': booking.status,
            'salon_id': booking.salon.id,
            'salon_name': booking.salon.name,
            'service_name': booking.service_name,
            'worker': worker_info,
            'has_salon_review': salon_rev_data is not None,
            'salon_review': salon_rev_data,
            'has_worker_review': worker_rev_data is not None,
            'worker_review': worker_rev_data,
        })

    def post(self, request, pk):
        try:
            booking = Booking.objects.select_related('salon', 'worker', 'worker__user').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=status.HTTP_404_NOT_FOUND)

        # 1. Enforce ownership: customer can only review their own booking
        if not booking.customer or booking.customer != request.user:
            return Response(
                {'error': 'You can only review bookings made from your own account.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 2. Enforce completion: customer can only review completed bookings
        if booking.status != Booking.Status.COMPLETED:
            return Response(
                {
                    'error': f'Reviews can only be submitted after your booking is completed. Current status is {booking.status}.'
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ReviewSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        salon_rating = data.get('salon_rating')
        salon_comment = data.get('salon_comment', '')
        worker_rating = data.get('worker_rating')
        worker_comment = data.get('worker_comment', '')

        # 3. Exactly one salon review per booking
        if salon_rating is not None and SalonReview.objects.filter(booking=booking).exists():
            return Response(
                {'error': 'A salon review has already been submitted for this booking.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 4. Exactly one worker review per booking (must have assigned worker)
        if worker_rating is not None:
            if not booking.worker:
                return Response(
                    {'error': 'This booking does not have an assigned specialist to review.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if WorkerReview.objects.filter(booking=booking).exists():
                return Response(
                    {'error': 'A specialist review has already been submitted for this booking.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            with transaction.atomic():
                created_salon_review = None
                created_worker_review = None

                if salon_rating is not None:
                    created_salon_review = SalonReview.objects.create(
                        salon=booking.salon,
                        booking=booking,
                        customer=request.user,
                        rating=salon_rating,
                        comment=salon_comment.strip(),
                    )

                if worker_rating is not None:
                    created_worker_review = WorkerReview.objects.create(
                        salon=booking.salon,
                        worker=booking.worker,
                        booking=booking,
                        customer=request.user,
                        rating=worker_rating,
                        comment=worker_comment.strip(),
                    )
        except IntegrityError:
            return Response(
                {'error': 'A review has already been registered for this booking.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from notifications.services import notify_new_reviews
            notify_new_reviews(
                salon_review=created_salon_review,
                worker_review=created_worker_review,
            )
        except Exception:
            pass

        response_data = {
            'message': 'Thank you! Your feedback has been submitted successfully.',
            'booking_id': booking.id,
        }
        if created_salon_review:
            response_data['salon_review'] = SalonReviewSerializer(created_salon_review, context={'request': request}).data
        if created_worker_review:
            response_data['worker_review'] = WorkerReviewSerializer(created_worker_review, context={'request': request}).data

        return Response(response_data, status=status.HTTP_201_CREATED)


class SalonReviewsListView(APIView):
    """
    GET /api/v1/reviews/salons/<int:salon_id>/
    (Also accessible via /api/v1/bookings/salons/<int:salon_id>/reviews/ for backward compatibility)
    Returns dynamic overall rating, review count, rating breakdown, and list of reviews.
    Calculates overall rating as: sum of ratings / total review count (rounded to 2 decimal places).
    """
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request, salon_id):
        try:
            salon = Salon.objects.get(pk=salon_id)
        except Salon.DoesNotExist:
            return Response({'error': 'Salon not found.'}, status=status.HTTP_404_NOT_FOUND)

        reviews_qs = SalonReview.objects.filter(salon=salon).select_related('customer', 'booking').order_by('-created_at')
        agg = reviews_qs.aggregate(avg=Avg('rating'), count=Count('id'))
        total_reviews = agg['count'] or 0
        avg_rating = round(float(agg['avg']), 2) if (agg['avg'] is not None and total_reviews > 0) else 5.0

        breakdown = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        for r in reviews_qs:
            if r.rating in breakdown:
                breakdown[r.rating] += 1

        breakdown_pct = {}
        for star in range(1, 6):
            cnt = breakdown[star]
            pct = round((cnt / total_reviews * 100)) if total_reviews > 0 else 0
            breakdown_pct[star] = {'count': cnt, 'percentage': pct}

        reviews_list = []
        from salons.media_utils import build_full_media_url
        for r in reviews_qs:
            author_name = r.customer.get_full_name() or r.customer.email.split('@')[0].title()
            initial = (r.customer.get_full_name() or r.customer.email or "C")[0].upper()
            photo_url = build_full_media_url(request, getattr(r.customer, 'profile_photo', None)) if getattr(r.customer, 'profile_photo', None) else ""
            treatment = r.booking.service_name if r.booking else "Salon Service"
            reviews_list.append({
                'id': r.id,
                'author': author_name,
                'initial': initial,
                'avatar': photo_url,
                'rating': r.rating,
                'comment': r.comment,
                'treatment': treatment,
                'date': r.created_at.strftime("%b %d, %Y"),
                'created_at': r.created_at.isoformat(),
            })

        return Response({
            'salon_id': salon.id,
            'salon_name': salon.name,
            'rating': avg_rating,
            'reviews_count': total_reviews,
            'rating_breakdown': breakdown_pct,
            'reviews': reviews_list,
        })


class WorkerReviewsListView(APIView):
    """
    GET /api/v1/reviews/workers/<int:worker_id>/
    (Also accessible via /api/v1/bookings/workers/<int:worker_id>/reviews/ for backward compatibility)
    Returns dynamic average rating, review count, and list of reviews for an assigned worker.
    """
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request, worker_id):
        try:
            worker = WorkerProfile.objects.select_related('user', 'salon').get(pk=worker_id)
        except WorkerProfile.DoesNotExist:
            return Response({'error': 'Worker not found.'}, status=status.HTTP_404_NOT_FOUND)

        reviews_qs = WorkerReview.objects.filter(worker=worker).select_related('customer', 'booking').order_by('-created_at')
        agg = reviews_qs.aggregate(avg=Avg('rating'), count=Count('id'))
        total_reviews = agg['count'] or 0
        avg_rating = round(float(agg['avg']), 2) if (agg['avg'] is not None and total_reviews > 0) else 5.0

        reviews_list = []
        from salons.media_utils import build_full_media_url
        for r in reviews_qs:
            author_name = r.customer.get_full_name() or r.customer.email.split('@')[0].title()
            initial = (r.customer.get_full_name() or r.customer.email or "C")[0].upper()
            photo_url = build_full_media_url(request, getattr(r.customer, 'profile_photo', None)) if getattr(r.customer, 'profile_photo', None) else ""
            treatment = r.booking.service_name if r.booking else "Salon Service"
            reviews_list.append({
                'id': r.id,
                'author': author_name,
                'initial': initial,
                'avatar': photo_url,
                'rating': r.rating,
                'comment': r.comment,
                'treatment': treatment,
                'date': r.created_at.strftime("%b %d, %Y"),
                'created_at': r.created_at.isoformat(),
            })

        worker_name = worker.user.get_full_name() or worker.user.email
        return Response({
            'worker_id': worker.id,
            'worker_name': worker_name,
            'specialization': worker.specialization or 'Stylist',
            'salon_id': worker.salon.id if worker.salon else None,
            'salon_name': worker.salon.name if worker.salon else '',
            'rating': avg_rating,
            'reviews_count': total_reviews,
            'reviews': reviews_list,
        })
