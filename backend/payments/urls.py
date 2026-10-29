from django.urls import path
from .views import (
    CreateRazorpayOrderView,
    VerifyRazorpayPaymentView,
    ConfirmPaymentView,
    PaymentDetailView,
    OwnerRevenueSummaryView,
    OwnerTransactionsListView,
    OwnerWorkerEarningsView,
    OwnerCollectRemainingPaymentView,
    OwnerProcessRefundView,
    WorkerRevenueSummaryView,
    WorkerEarningsListView,
    WorkerTransactionsListView,
    ReconcileBookingRevenueView,
    OwnerUnreconciledBookingsView,
    WorkerUnreconciledBookingsView,
)

urlpatterns = [
    path('create-razorpay-order/', CreateRazorpayOrderView.as_view(), name='payment-create-razorpay-order'),

    path('verify-razorpay/', VerifyRazorpayPaymentView.as_view(), name='payment-verify-razorpay-direct'),
    
    path('<int:pk>/verify-razorpay/', VerifyRazorpayPaymentView.as_view(), name='payment-verify-razorpay'),
    
    path('<int:pk>/confirm-payment/', ConfirmPaymentView.as_view(), name='payment-confirm-payment'),
   
    path('booking/<int:booking_id>/', PaymentDetailView.as_view(), name='payment-booking-detail'),
    
    path('<int:pk>/', PaymentDetailView.as_view(), name='payment-detail'),

    # Reconciliation & Retry
    path('bookings/<int:pk>/reconcile-revenue/', ReconcileBookingRevenueView.as_view(), name='booking-reconcile-revenue'),
    path('owner/unreconciled-bookings/', OwnerUnreconciledBookingsView.as_view(), name='owner-unreconciled-bookings'),
    path('worker/unreconciled-bookings/', WorkerUnreconciledBookingsView.as_view(), name='worker-unreconciled-bookings'),

    # Owner Revenue Management
    path('owner/revenue-summary/', OwnerRevenueSummaryView.as_view(), name='owner-revenue-summary'),
    path('owner/transactions/', OwnerTransactionsListView.as_view(), name='owner-transactions-list'),
    path('owner/worker-earnings/', OwnerWorkerEarningsView.as_view(), name='owner-worker-earnings'),
    path('owner/bookings/<int:pk>/collect-remaining/', OwnerCollectRemainingPaymentView.as_view(), name='owner-collect-remaining'),
    path('owner/bookings/<int:pk>/refund/', OwnerProcessRefundView.as_view(), name='owner-process-refund'),

    # Worker Revenue Management
    path('worker/revenue-summary/', WorkerRevenueSummaryView.as_view(), name='worker-revenue-summary'),
    path('worker/earnings/', WorkerEarningsListView.as_view(), name='worker-earnings-list'),
    path('worker/transactions/', WorkerTransactionsListView.as_view(), name='worker-transactions-list'),
]

