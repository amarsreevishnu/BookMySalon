from django.urls import path
from .views import (
    SalonOffDaysView,
    SalonServicesView,
    SalonWorkersView,
    AvailableSlotsView,
    BookingCreateView,
    BookingReserveView,
    BookingConfirmPaymentView,
    BookingReleaseView,
    BookingCreateRazorpayOrderView,
    BookingVerifyRazorpayView,
    MyBookingsView,
    BookingCancelView,
)

urlpatterns = [
    path('salons/<int:salon_id>/off-days/', SalonOffDaysView.as_view(), name='booking-salon-off-days'),
    path('salons/<int:salon_id>/services/', SalonServicesView.as_view(), name='booking-salon-services'),
    path('salons/<int:salon_id>/workers/', SalonWorkersView.as_view(), name='booking-salon-workers'),
    path('slots/', AvailableSlotsView.as_view(), name='booking-slots'),
    path('create/', BookingCreateView.as_view(), name='booking-create'),
    path('reserve/', BookingReserveView.as_view(), name='booking-reserve'),
    path('create-razorpay-order/', BookingCreateRazorpayOrderView.as_view(), name='booking-create-razorpay-order'),
    path('<int:pk>/verify-razorpay/', BookingVerifyRazorpayView.as_view(), name='booking-verify-razorpay'),
    path('<int:pk>/confirm-payment/', BookingConfirmPaymentView.as_view(), name='booking-confirm-payment'),
    path('<int:pk>/release/', BookingReleaseView.as_view(), name='booking-release'),
    path('my/', MyBookingsView.as_view(), name='booking-my'),
    path('<int:pk>/cancel/', BookingCancelView.as_view(), name='booking-cancel'),
]
