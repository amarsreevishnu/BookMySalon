from django.urls import path
from .views import (
    CreateRazorpayOrderView,
    VerifyRazorpayPaymentView,
    ConfirmPaymentView,
    PaymentDetailView,
)

urlpatterns = [
    path('create-razorpay-order/', CreateRazorpayOrderView.as_view(), name='payment-create-razorpay-order'),
    path('verify-razorpay/', VerifyRazorpayPaymentView.as_view(), name='payment-verify-razorpay-direct'),
    path('<int:pk>/verify-razorpay/', VerifyRazorpayPaymentView.as_view(), name='payment-verify-razorpay'),
    path('<int:pk>/confirm-payment/', ConfirmPaymentView.as_view(), name='payment-confirm-payment'),
    path('booking/<int:booking_id>/', PaymentDetailView.as_view(), name='payment-booking-detail'),
    path('<int:pk>/', PaymentDetailView.as_view(), name='payment-detail'),
]

