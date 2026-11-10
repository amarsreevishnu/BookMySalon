import logging
from decimal import Decimal
from django.core.paginator import Paginator, EmptyPage
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication

from salons.models import Salon
from .models import (
    SubscriptionPlan,
    SubscriptionSetting,
    SalonSubscription,
    SubscriptionPayment,
    SubscriptionHistory,
    SuperAdminWallet,
    SuperAdminWalletTransaction,
)
from .serializers import (
    SubscriptionPlanSerializer,
    SubscriptionSettingSerializer,
    SalonSubscriptionSerializer,
    SubscriptionPaymentSerializer,
    SubscriptionHistorySerializer,
    SuperAdminWalletSerializer,
    SuperAdminWalletTransactionSerializer,
)
from .services import (
    create_subscription_razorpay_order,
    verify_and_activate_subscription,
    admin_manually_extend_subscription,
    check_and_send_subscription_reminders,
)

logger = logging.getLogger(__name__)


class IsAdminUserRole(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                getattr(request.user, "role", "") == "ADMIN"
                or request.user.is_superuser
                or request.user.is_staff
            )
        )


class IsOwnerUserRole(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", "") == "OWNER"
        )


def _get_owner_salon(user):
    salon = Salon.objects.filter(owner=user).order_by("-id").first()
    if not salon:
        salon = Salon.objects.filter(email__iexact=user.email).order_by("-id").first()
    return salon



# Super Admin API views


class AdminSubscriptionStatsView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        now = timezone.now()
        wallet = SuperAdminWallet.get_wallet()

        total_salons = Salon.objects.filter(approval_status="APPROVED").count()
        total_revenue = wallet.total_subscription_revenue or Decimal("0.00")
        wallet_balance = wallet.balance or Decimal("0.00")
        
        for sub in SalonSubscription.objects.filter(
            status__in=[SalonSubscription.Status.TRIAL, SalonSubscription.Status.ACTIVE],
            end_date__lt=now,
        ):
            sub.sync_status_with_time()

        active_trials_count = SalonSubscription.objects.filter(
            status=SalonSubscription.Status.TRIAL,
            end_date__gte=now,
        ).count()

        active_paid_count = SalonSubscription.objects.filter(
            status=SalonSubscription.Status.ACTIVE,
            end_date__gte=now,
        ).count()

        expired_count = SalonSubscription.objects.filter(
            Q(status=SalonSubscription.Status.EXPIRED) | Q(end_date__lt=now)
        ).count()

        upcoming_threshold = now + timezone.timedelta(days=7)
        expiring_soon_count = SalonSubscription.objects.filter(
            status__in=[SalonSubscription.Status.TRIAL, SalonSubscription.Status.ACTIVE],
            end_date__gte=now,
            end_date__lte=upcoming_threshold,
        ).count()

        total_successful_payments = SubscriptionPayment.objects.filter(
            status=SubscriptionPayment.Status.SUCCESS
        ).count()

        return Response({
            "total_revenue": str(total_revenue),
            "wallet_balance": str(wallet_balance),
            "total_salons": total_salons,
            "active_trials_count": active_trials_count,
            "active_paid_count": active_paid_count,
            "expiring_soon_count": expiring_soon_count,
            "expired_count": expired_count,
            "total_successful_payments": total_successful_payments,
        })


class AdminSuperAdminWalletView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        wallet = SuperAdminWallet.get_wallet()
        qs = wallet.transactions.select_related("salon", "payment").all().order_by("-created_at")

        try:
            page_num = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page_num = 1

        try:
            page_size = max(1, min(100, int(request.query_params.get("page_size", 10))))
        except (ValueError, TypeError):
            page_size = 10

        paginator = Paginator(qs, page_size)
        total_count = paginator.count
        total_pages = paginator.num_pages

        try:
            page_obj = paginator.page(page_num)
        except EmptyPage:
            page_obj = []

        serializer = SuperAdminWalletTransactionSerializer(page_obj, many=True)
        return Response({
            "wallet": SuperAdminWalletSerializer(wallet).data,
            "transactions": serializer.data,
            "results": serializer.data,
            "count": total_count,
            "total_count": total_count,
            "total_pages": total_pages,
            "current_page": page_num,
            "page_size": page_size,
        })


class AdminSalonsSubscriptionsListView(APIView):
   
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        now = timezone.now()
        search = request.query_params.get("search", "").strip()
        status_filter = request.query_params.get("status", "all").strip().lower()

        # Update any expired records
        for sub in SalonSubscription.objects.filter(
            status__in=[SalonSubscription.Status.TRIAL, SalonSubscription.Status.ACTIVE],
            end_date__lt=now,
        ):
            sub.sync_status_with_time()

        qs = SalonSubscription.objects.select_related("salon", "salon__owner", "plan").filter(salon__approval_status="APPROVED")

        plan_id = request.query_params.get("plan_id")
        if plan_id:
            try:
                qs = qs.filter(plan_id=int(plan_id))
            except (ValueError, TypeError):
                pass

        if search:
            qs = qs.filter(
                Q(salon__name__icontains=search)
                | Q(salon__city__icontains=search)
                | Q(salon__email__icontains=search)
                | Q(salon__owner__email__icontains=search)
            )

        if status_filter == "trial":
            qs = qs.filter(status=SalonSubscription.Status.TRIAL, end_date__gte=now)
        elif status_filter == "active":
            qs = qs.filter(status=SalonSubscription.Status.ACTIVE, end_date__gte=now)
        elif status_filter == "expired":
            qs = qs.filter(Q(status=SalonSubscription.Status.EXPIRED) | Q(end_date__lt=now))
        elif status_filter == "expiring_soon":
            upcoming = now + timezone.timedelta(days=7)
            qs = qs.filter(
                status__in=[SalonSubscription.Status.TRIAL, SalonSubscription.Status.ACTIVE],
                end_date__gte=now,
                end_date__lte=upcoming,
            )

        qs = qs.order_by("end_date")

        try:
            page_num = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page_num = 1

        try:
            page_size = max(1, min(100, int(request.query_params.get("page_size", 10))))
        except (ValueError, TypeError):
            page_size = 10

        paginator = Paginator(qs, page_size)
        total_count = paginator.count
        total_pages = paginator.num_pages

        try:
            page_obj = paginator.page(page_num)
        except EmptyPage:
            page_obj = []

        serializer = SalonSubscriptionSerializer(page_obj, many=True)
        return Response({
            "salons": serializer.data,
            "results": serializer.data,
            "count": total_count,
            "total_count": total_count,
            "total_pages": total_pages,
            "current_page": page_num,
            "page_size": page_size,
        })


class AdminSubscriptionPlansView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        plans = SubscriptionPlan.objects.all().order_by("display_order", "duration_months")
        return Response(SubscriptionPlanSerializer(plans, many=True).data)

    def post(self, request):
        serializer = SubscriptionPlanSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminSubscriptionPlanDetailView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def put(self, request, pk):
        try:
            plan = SubscriptionPlan.objects.get(pk=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({"error": "Plan not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubscriptionPlanSerializer(plan, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        return self.put(request, pk)


class AdminPlanSubscribedSalonsView(APIView):
    """
    Super Admin endpoint to view all salons subscribed to a specific plan.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request, pk):
        try:
            plan = SubscriptionPlan.objects.get(pk=pk)
        except SubscriptionPlan.DoesNotExist:
            return Response({"error": "Plan not found."}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        history_salons_ids = SubscriptionHistory.objects.filter(plan=plan).values_list("salon_id", flat=True)
        all_salons_qs = (
            SalonSubscription.objects.filter(Q(plan=plan) | Q(salon_id__in=history_salons_ids))
            .select_related("salon", "salon__owner", "plan")
            .distinct()
            .order_by("-end_date")
        )

        return Response({
            "plan": SubscriptionPlanSerializer(plan).data,
            "salons": SalonSubscriptionSerializer(all_salons_qs, many=True).data,
            "active_salons_count": all_salons_qs.filter(status=SalonSubscription.Status.ACTIVE, end_date__gte=now).count(),
            "total_salons_count": all_salons_qs.count(),
        })


class AdminSubscriptionSettingsView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        settings_obj = SubscriptionSetting.get_settings()
        return Response(SubscriptionSettingSerializer(settings_obj).data)

    def put(self, request):
        settings_obj = SubscriptionSetting.get_settings()
        serializer = SubscriptionSettingSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminExtendSubscriptionView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def post(self, request, salon_id):
        try:
            salon = Salon.objects.get(pk=salon_id)
        except Salon.DoesNotExist:
            return Response({"error": "Salon not found."}, status=status.HTTP_404_NOT_FOUND)

        extra_days = request.data.get("extra_days")
        reason = request.data.get("reason", "").strip()

        try:
            extra_days = int(extra_days)
            if extra_days <= 0:
                raise ValueError()
        except (TypeError, ValueError):
            return Response(
                {"error": "Please enter a valid positive number of extension days."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            sub = admin_manually_extend_subscription(salon, extra_days, reason=reason, admin_user=request.user)
            return Response({
                "message": f"Successfully extended subscription for {salon.name} by {extra_days} days.",
                "subscription": SalonSubscriptionSerializer(sub).data,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AdminSubscriptionPaymentsListView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        qs = SubscriptionPayment.objects.select_related("salon", "owner", "plan").all().order_by("-created_at")

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(receipt_number__icontains=search)
                | Q(razorpay_payment_id__icontains=search)
                | Q(salon__name__icontains=search)
                | Q(owner__email__icontains=search)
            )

        try:
            page_num = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page_num = 1

        try:
            page_size = max(1, min(100, int(request.query_params.get("page_size", 10))))
        except (ValueError, TypeError):
            page_size = 10

        paginator = Paginator(qs, page_size)
        total_count = paginator.count
        total_pages = paginator.num_pages

        try:
            page_obj = paginator.page(page_num)
        except EmptyPage:
            page_obj = []

        serializer = SubscriptionPaymentSerializer(page_obj, many=True)
        return Response({
            "payments": serializer.data,
            "results": serializer.data,
            "count": total_count,
            "total_count": total_count,
            "total_pages": total_pages,
            "current_page": page_num,
            "page_size": page_size,
        })



# Salon Owner APIs

class OwnerCurrentSubscriptionView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOwnerUserRole]

    def get(self, request):
        salon = _get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found for your account."}, status=status.HTTP_404_NOT_FOUND)

        sub = getattr(salon, "subscription", None)
        if not sub:
            # If salon has no subscription, create an expired placeholder
            now = timezone.now()
            sub = SalonSubscription.objects.create(
                salon=salon,
                subscription_type=SalonSubscription.SubscriptionType.TRIAL,
                status=SalonSubscription.Status.EXPIRED,
                start_date=now - timezone.timedelta(days=31),
                end_date=now - timezone.timedelta(days=1),
                has_used_free_trial=True,
            )
        else:
            sub.sync_status_with_time()

        return Response(SalonSubscriptionSerializer(sub).data)


class OwnerAvailablePlansView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOwnerUserRole]

    def get(self, request):
        plans = SubscriptionPlan.objects.filter(is_active=True).order_by("display_order", "duration_months")
        return Response(SubscriptionPlanSerializer(plans, many=True).data)


class OwnerCreateSubscriptionOrderView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOwnerUserRole]

    def post(self, request):
        salon = _get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found for your account."}, status=status.HTTP_404_NOT_FOUND)

        plan_id = request.data.get("plan_id")
        if not plan_id:
            return Response({"error": "plan_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_data = create_subscription_razorpay_order(salon, plan_id, request.user)
            return Response(order_data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class OwnerVerifySubscriptionPaymentView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOwnerUserRole]

    def post(self, request):
        salon = _get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found for your account."}, status=status.HTTP_404_NOT_FOUND)

        order_id = request.data.get("razorpay_order_id")
        payment_id = request.data.get("razorpay_payment_id")
        signature = request.data.get("razorpay_signature")

        if not order_id or not payment_id or not signature:
            return Response(
                {"error": "Missing Razorpay verification credentials (order_id, payment_id, or signature)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            sub, payment = verify_and_activate_subscription(salon, order_id, payment_id, signature)
            return Response({
                "message": "Subscription payment verified and activated successfully!",
                "subscription": SalonSubscriptionSerializer(sub).data,
                "payment": SubscriptionPaymentSerializer(payment).data,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class OwnerSubscriptionHistoryView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOwnerUserRole]

    def get(self, request):
        salon = _get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found for your account."}, status=status.HTTP_404_NOT_FOUND)

        history = SubscriptionHistory.objects.filter(salon=salon).order_by("-created_at")
        payments = SubscriptionPayment.objects.filter(
            salon=salon,
            status=SubscriptionPayment.Status.SUCCESS,
        ).order_by("-created_at")

        return Response({
            "history": SubscriptionHistorySerializer(history, many=True).data,
            "invoices": SubscriptionPaymentSerializer(payments, many=True).data,
        })
