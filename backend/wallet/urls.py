from django.urls import path
from .views import (
    CustomerWalletDetailView,
    CustomerWalletTransactionsView,
    CustomerWalletBalanceCheckView,
    CustomerWalletTopUpView,
    CustomerWalletTopUpCreateOrderView,
    CustomerWalletTopUpVerifyView,
    CustomerWalletTopUpFailedView,
    CustomerWalletPayBookingView,
)

app_name = "wallet"

urlpatterns = [
    path("", CustomerWalletDetailView.as_view(), name="wallet-detail"),
    path("transactions/", CustomerWalletTransactionsView.as_view(), name="wallet-transactions"),
    path("check-balance/", CustomerWalletBalanceCheckView.as_view(), name="wallet-check-balance"),
    
    path("topup/", CustomerWalletTopUpView.as_view(), name="wallet-topup"),
    path("topup/create-order/", CustomerWalletTopUpCreateOrderView.as_view(), name="wallet-topup-create-order"),
    path("topup/verify-payment/", CustomerWalletTopUpVerifyView.as_view(), name="wallet-topup-verify-payment"),
    path("topup/payment-failed/", CustomerWalletTopUpFailedView.as_view(), name="wallet-topup-payment-failed"),
    path("pay-booking/", CustomerWalletPayBookingView.as_view(), name="wallet-pay-booking"),
]

