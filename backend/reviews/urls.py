from django.urls import path
from .views import (
    BookingReviewCreateView,
    SalonReviewsListView,
    WorkerReviewsListView,
)

urlpatterns = [
    path('salons/<int:salon_id>/', SalonReviewsListView.as_view(), name='salon-reviews-list'),
    path('workers/<int:worker_id>/', WorkerReviewsListView.as_view(), name='worker-reviews-list'),
    path('bookings/<int:pk>/', BookingReviewCreateView.as_view(), name='booking-review-create'),
    path('bookings/<int:pk>/salon-review/', BookingReviewCreateView.as_view(), name='booking-salon-review-create'),
    path('bookings/<int:pk>/worker-review/', BookingReviewCreateView.as_view(), name='booking-worker-review-create'),
]

