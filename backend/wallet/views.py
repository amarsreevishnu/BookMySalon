import logging
from decimal import Decimal
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework_simplejwt.authentication import JWTAuthentication

from django.core.exceptions import ValidationError
from .models import CustomerWallet, WalletTransaction, WalletTopUpPayment
logger = logging.getLogger(__name__)
from .serializers import (
    CustomerWalletSerializer,
    WalletTransactionSerializer,
    WalletTopUpSerializer,
    WalletBalanceCheckSerializer,
    WalletTopUpCreateOrderSerializer,
    WalletTopUpVerifySerializer,
    WalletTopUpFailedSerializer,
    WalletTopUpPaymentSerializer,
)
from .services import (
    get_customer_wallet,
    validate_wallet_balance,
    topup_wallet,
    process_wallet_booking_payment,
    create_wallet_topup_order,
    verify_wallet_topup_payment,
    record_wallet_topup_failure,
    InsufficientWalletFundsError,
    WalletLockedError,
    WalletInactiveError,
)


class StandardPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = "page_size"
    max_page_size = 100


class CustomerWalletDetailView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet = get_customer_wallet(request.user)
        if not wallet:
            return Response(
                {"error": "Wallet is not available for this account type."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CustomerWalletSerializer(wallet)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CustomerWalletTransactionsView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet = get_customer_wallet(request.user)
        if not wallet:
            return Response(
                {"error": "Wallet not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        queryset = wallet.transactions.select_related("booking", "booking__salon").all()

        tx_type = request.query_params.get("type", "").strip().upper()
        if tx_type:
            queryset = queryset.filter(transaction_type=tx_type)

        search = request.query_params.get("search", "").strip()
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(transaction_id__icontains=search)
                | Q(reason__icontains=search)
                | Q(booking__service_name__icontains=search)
                | Q(booking__salon__name__icontains=search)
            )

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = WalletTransactionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class CustomerWalletBalanceCheckView(APIView):
   
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        raw_amt = request.query_params.get("amount")
        if not raw_amt:
            return Response(
                {"error": "Query parameter 'amount' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            amt = Decimal(str(raw_amt))
            if amt <= Decimal("0.00"):
                raise ValueError()
        except Exception:
            return Response(
                {"error": "Invalid amount value."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = validate_wallet_balance(request.user, amt)
        return Response(result, status=status.HTTP_200_OK)


class CustomerWalletTopUpCreateOrderView(APIView):
   
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletTopUpCreateOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = serializer.validated_data["amount"]

        try:
            order_data = create_wallet_topup_order(user=request.user, amount=amount)
            return Response(order_data, status=status.HTTP_201_CREATED)
        except ValidationError as ve:
            msg = ve.message if hasattr(ve, "message") else str(ve)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        except (WalletInactiveError, WalletLockedError) as we:
            return Response({"error": str(we)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error("Error creating top-up order for user %s: %s", request.user.id, e)
            return Response({"error": "Unable to initiate payment order."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CustomerWalletTopUpVerifyView(APIView):
   
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletTopUpVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        order_id = serializer.validated_data["razorpay_order_id"]
        payment_id = serializer.validated_data["razorpay_payment_id"]
        signature = serializer.validated_data["razorpay_signature"]

        try:
            wallet, tx, topup = verify_wallet_topup_payment(
                user=request.user,
                razorpay_order_id=order_id,
                razorpay_payment_id=payment_id,
                razorpay_signature=signature,
            )
            return Response(
                {
                    "success": True,
                    "message": f"Successfully credited ₹{topup.amount} to your wallet.",
                    "balance": str(wallet.balance),
                    "transaction": WalletTransactionSerializer(tx).data,
                    "topup": WalletTopUpPaymentSerializer(topup).data,
                },
                status=status.HTTP_200_OK,
            )
        except ValidationError as ve:
            msg = ve.message if hasattr(ve, "message") else str(ve)
            record_wallet_topup_failure(request.user, order_id, reason=msg)
            return Response(
                {
                    "error": msg,
                    "message": "Money not credited. Payment verification failed.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except (WalletInactiveError, WalletLockedError) as we:
            record_wallet_topup_failure(request.user, order_id, reason=str(we))
            return Response(
                {
                    "error": str(we),
                    "message": "Money not credited. Wallet is locked or inactive.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        except Exception as e:
            logger.error("Top-up verification failed for user %s: %s", request.user.id, e)
            record_wallet_topup_failure(request.user, order_id, reason=str(e))
            return Response(
                {
                    "error": str(e),
                    "message": "Money not credited. Payment verification failed.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CustomerWalletTopUpFailedView(APIView):
   
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletTopUpFailedSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        order_id = serializer.validated_data["razorpay_order_id"]
        reason = serializer.validated_data.get("reason", "")
        error_code = serializer.validated_data.get("error_code", "")

        record_wallet_topup_failure(
            user=request.user,
            razorpay_order_id=order_id,
            reason=reason,
            error_code=error_code,
        )

        return Response(
            {
                "success": False,
                "message": "Money not credited. Payment failed.",
                "order_id": order_id,
                "reason": reason,
            },
            status=status.HTTP_200_OK,
        )


class CustomerWalletTopUpView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WalletTopUpSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = serializer.validated_data["amount"]
        notes = serializer.validated_data.get("notes", "")

        try:
            wallet, tx = topup_wallet(
                user=request.user,
                amount=amount,
                payment_method="ONLINE",
                notes=notes or f"Instant wallet top-up of ₹{amount}",
            )
            return Response(
                {
                    "message": f"Successfully credited ₹{amount} to your wallet.",
                    "balance": str(wallet.balance),
                    "transaction": WalletTransactionSerializer(tx).data,
                },
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            logger.error("Wallet top-up failed for user %s: %s", request.user.id, e)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CustomerWalletPayBookingView(APIView):
   
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        booking_id = request.data.get("booking_id")
        if not booking_id:
            return Response({"error": "booking_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        from bookings.models import Booking
        booking = Booking.objects.filter(id=booking_id, customer=request.user).first()
        if not booking:
            return Response({"error": "Booking not found or not owned by you."}, status=status.HTTP_404_NOT_FOUND)

        if booking.is_fully_paid or booking.payment_status == Booking.PaymentStatus.PAID:
            return Response({"error": "Booking is already paid."}, status=status.HTTP_400_BAD_REQUEST)

        if booking.status in [Booking.Status.CANCELLED, Booking.Status.COMPLETED]:
            return Response({"error": f"Cannot pay for a {booking.get_status_display().lower()} booking."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            booking, tx = process_wallet_booking_payment(booking, request.user)
            return Response(
                {
                    "message": f"Successfully paid ₹{booking.total_amount} via wallet.",
                    "booking_id": booking.id,
                    "booking_status": booking.status,
                    "payment_status": booking.payment_status,
                    "transaction": WalletTransactionSerializer(tx).data,
                },
                status=status.HTTP_200_OK,
            )
        except InsufficientWalletFundsError as ie:
            return Response({"error": str(ie)}, status=status.HTTP_400_BAD_REQUEST)
        except (WalletLockedError, WalletInactiveError) as we:
            return Response({"error": str(we)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error("Wallet payment failed for booking %s: %s", booking.id, e)
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

