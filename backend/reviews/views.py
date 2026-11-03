from django.db import transaction, IntegrityError
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny, BasePermission
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
    AdminSalonReviewSerializer,
    AdminReviewModerationSerializer,
)


class OptionalJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except Exception:
            return None


class IsAdminUserRole(BasePermission):
    """
    Allows access only to authenticated admin users (role='ADMIN', is_superuser, or is_staff).
    """
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                getattr(request.user, "role", None) == "ADMIN"
                or request.user.is_superuser
                or request.user.is_staff
            )
        )


class BookingReviewCreateView(APIView):

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
   
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request, salon_id):
        try:
            salon = Salon.objects.get(pk=salon_id)
        except Salon.DoesNotExist:
            return Response({'error': 'Salon not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Public listing strictly excludes hidden reviews so they do not contribute to rating
        reviews_qs = SalonReview.objects.filter(salon=salon, is_hidden=False).select_related('customer', 'booking').order_by('-created_at')
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
    
    permission_classes = [AllowAny]
    authentication_classes = [OptionalJWTAuthentication]

    def get(self, request, worker_id):
        try:
            worker = WorkerProfile.objects.select_related('user', 'salon').get(pk=worker_id)
        except WorkerProfile.DoesNotExist:
            return Response({'error': 'Worker not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Public specialist reviews exclude hidden reviews
        reviews_qs = WorkerReview.objects.filter(worker=worker, is_hidden=False).select_related('customer', 'booking').order_by('-created_at')
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


class AdminReviewsStatsView(APIView):
    """
    Returns platform-wide statistics for Super Admin dashboard:
    total reviews, average platform rating, 5-star reviews, 1-star reviews, etc.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        total_reviews = SalonReview.objects.count()
        visible_qs = SalonReview.objects.filter(is_hidden=False)
        hidden_count = SalonReview.objects.filter(is_hidden=True).count()
        visible_count = visible_qs.count()

        agg = visible_qs.aggregate(avg=Avg('rating'))
        avg_platform_rating = round(float(agg['avg']), 2) if (agg['avg'] is not None and visible_count > 0) else 5.0

        five_stars = visible_qs.filter(rating=5).count()
        four_stars = visible_qs.filter(rating=4).count()
        three_stars = visible_qs.filter(rating=3).count()
        two_stars = visible_qs.filter(rating=2).count()
        one_stars = visible_qs.filter(rating=1).count()

        total_salons = Salon.objects.count()
        salons_with_reviews = visible_qs.values('salon').distinct().count()

        return Response({
            'total_reviews': total_reviews,
            'visible_reviews': visible_count,
            'hidden_reviews': hidden_count,
            'average_platform_rating': avg_platform_rating,
            'five_star_reviews': five_stars,
            'four_star_reviews': four_stars,
            'three_star_reviews': three_stars,
            'two_star_reviews': two_stars,
            'one_star_reviews': one_stars,
            'rating_breakdown': {
                5: five_stars,
                4: four_stars,
                3: three_stars,
                2: two_stars,
                1: one_stars,
            },
            'total_salons': total_salons,
            'salons_with_reviews': salons_with_reviews,
        })


class AdminSalonsReviewsSummaryView(APIView):
    """
    Lists all registered salons with their average star rating, total review counts,
    and moderation status for Super Admin.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        search_query = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip().upper()

        salons_qs = Salon.objects.select_related('owner').all()

        if search_query:
            salons_qs = salons_qs.filter(
                Q(name__icontains=search_query) |
                Q(city__icontains=search_query) |
                Q(owner__first_name__icontains=search_query) |
                Q(owner__last_name__icontains=search_query) |
                Q(owner__email__icontains=search_query)
            )

        if status_filter and status_filter != 'ALL':
            salons_qs = salons_qs.filter(approval_status=status_filter)

        salons_qs = salons_qs.order_by('name')

        from salons.media_utils import build_full_media_url
        salons_list = []

        for s in salons_qs:
            all_reviews = SalonReview.objects.filter(salon=s)
            visible_reviews = all_reviews.filter(is_hidden=False)

            agg = visible_reviews.aggregate(avg=Avg('rating'), count=Count('id'))
            visible_count = agg['count'] or 0
            avg_rating = round(float(agg['avg']), 2) if (agg['avg'] is not None and visible_count > 0) else 5.0
            hidden_count = all_reviews.filter(is_hidden=True).count()
            total_count = all_reviews.count()

            five_stars = visible_reviews.filter(rating=5).count()
            one_stars = visible_reviews.filter(rating=1).count()

            latest_rev = all_reviews.order_by('-created_at').first()
            latest_review_date = latest_rev.created_at.isoformat() if latest_rev else None

            cover_img = ""
            if s.cover_image:
                cover_img = build_full_media_url(request, s.cover_image)
            elif s.images and isinstance(s.images, list) and len(s.images) > 0:
                cover_img = build_full_media_url(request, s.images[0])

            salons_list.append({
                'id': s.id,
                'name': s.name,
                'city': s.city or '',
                'address': s.address or '',
                'approval_status': s.approval_status,
                'cover_image': cover_img,
                'owner_name': s.owner.get_full_name() or s.owner.email if s.owner else 'Unknown',
                'owner_email': s.owner.email if s.owner else '',
                'average_rating': avg_rating,
                'total_reviews': total_count,
                'visible_reviews_count': visible_count,
                'hidden_reviews_count': hidden_count,
                'five_star_count': five_stars,
                'one_star_count': one_stars,
                'latest_review_date': latest_review_date,
            })

        return Response({
            'count': len(salons_list),
            'salons': salons_list,
        })


class AdminReviewsListView(APIView):
    """
    Lists customer reviews across the entire platform or for a selected salon,
    with comprehensive filtering (salon name, rating, date, salon status) and sorting.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        salon_id = request.query_params.get('salon_id')
        search_query = request.query_params.get('search', '').strip()
        rating_param = request.query_params.get('rating')
        status_param = request.query_params.get('status', '').strip().upper()
        start_date = request.query_params.get('start_date', '').strip()
        end_date = request.query_params.get('end_date', '').strip()
        date_type = request.query_params.get('date_type', 'created').strip().lower()
        hidden_param = request.query_params.get('is_hidden', 'all').strip().lower()
        sort_by = request.query_params.get('sort', 'newest').strip().lower()

        reviews_qs = SalonReview.objects.select_related(
            'salon', 'customer', 'booking', 'hidden_by'
        )

        # 1. Salon filter
        if salon_id and salon_id.lower() != 'all':
            try:
                reviews_qs = reviews_qs.filter(salon_id=int(salon_id))
            except (ValueError, TypeError):
                pass

        # 2. Search
        if search_query:
            reviews_qs = reviews_qs.filter(
                Q(salon__name__icontains=search_query) |
                Q(customer__first_name__icontains=search_query) |
                Q(customer__last_name__icontains=search_query) |
                Q(customer__email__icontains=search_query) |
                Q(comment__icontains=search_query)
            )

        # 3. Rating filter
        if rating_param and rating_param != 'all':
            try:
                rating_val = int(rating_param)
                if 1 <= rating_val <= 5:
                    reviews_qs = reviews_qs.filter(rating=rating_val)
            except (ValueError, TypeError):
                pass

        # 4. Salon status filter
        if status_param and status_param != 'ALL':
            reviews_qs = reviews_qs.filter(salon__approval_status=status_param)

        # 5. Date filter
        target_date_field = 'booking__booking_date' if date_type == 'appointment' else 'created_at__date'
        if start_date:
            try:
                reviews_qs = reviews_qs.filter(**{f"{target_date_field}__gte": start_date})
            except Exception:
                pass
        if end_date:
            try:
                reviews_qs = reviews_qs.filter(**{f"{target_date_field}__lte": end_date})
            except Exception:
                pass

        # 6. Hidden status filter
        if hidden_param == 'true':
            reviews_qs = reviews_qs.filter(is_hidden=True)
        elif hidden_param == 'false':
            reviews_qs = reviews_qs.filter(is_hidden=False)

        # 7. Sorting
        if sort_by == 'oldest':
            reviews_qs = reviews_qs.order_by('created_at')
        elif sort_by == 'highest_rated':
            reviews_qs = reviews_qs.order_by('-rating', '-created_at')
        elif sort_by == 'lowest_rated':
            reviews_qs = reviews_qs.order_by('rating', '-created_at')
        elif sort_by == 'appointment_newest':
            reviews_qs = reviews_qs.order_by('-booking__booking_date', '-created_at')
        elif sort_by == 'appointment_oldest':
            reviews_qs = reviews_qs.order_by('booking__booking_date', 'created_at')
        else: # default 'newest'
            reviews_qs = reviews_qs.order_by('-created_at')

        serializer = AdminSalonReviewSerializer(reviews_qs, many=True, context={'request': request})
        return Response({
            'count': reviews_qs.count(),
            'reviews': serializer.data,
        })


class AdminReviewModerationView(APIView):
    """
    Super Admin endpoint to hide inappropriate reviews without permanently deleting them,
    or unhide previously hidden reviews. Maintains moderation history for auditing.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def post(self, request, pk):
        try:
            review = SalonReview.objects.select_related('salon', 'customer', 'booking', 'hidden_by').get(pk=pk)
        except SalonReview.DoesNotExist:
            return Response({'error': 'Review not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminReviewModerationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data['action']
        reason = serializer.validated_data.get('reason', '').strip()

        admin_name = request.user.get_full_name() or request.user.email

        with transaction.atomic():
            history = list(review.moderation_history or [])
            if action == 'hide':
                review.is_hidden = True
                review.hidden_at = timezone.now()
                review.hidden_by = request.user
                review.moderation_reason = reason or 'Moderated by admin'
                history.append({
                    'action': 'HIDDEN',
                    'admin_id': request.user.id,
                    'admin_name': admin_name,
                    'reason': review.moderation_reason,
                    'timestamp': timezone.now().isoformat(),
                })
            elif action == 'unhide':
                review.is_hidden = False
                review.hidden_at = None
                review.hidden_by = request.user
                unhide_reason = reason or 'Restored to public visibility'
                review.moderation_reason = ''
                history.append({
                    'action': 'UNHIDDEN',
                    'admin_id': request.user.id,
                    'admin_name': admin_name,
                    'reason': unhide_reason,
                    'timestamp': timezone.now().isoformat(),
                })

            review.moderation_history = history
            review.save()

        updated_serializer = AdminSalonReviewSerializer(review, context={'request': request})
        action_text = "hidden from public view" if review.is_hidden else "restored to public view"
        return Response({
            'message': f'Review #{review.id} has been successfully {action_text}.',
            'review': updated_serializer.data,
        }, status=status.HTTP_200_OK)
