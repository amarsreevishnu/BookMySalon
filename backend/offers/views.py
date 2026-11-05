from decimal import Decimal
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.authentication import CustomJWTAuthentication as JWTAuthentication

from salons.models import Salon
from salons.views import IsOwner, get_owner_salon
from services.models import SalonService
from .models import Offer, OfferRedemption
from .serializers import (
    OfferOwnerSerializer,
    OfferPublicSerializer,
    OfferAdminSerializer,
    OfferValidateInputSerializer,
    OfferRedemptionSerializer,
)
from .services import validate_and_calculate_offer


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


class OptionalJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except Exception:
            return None


class OwnerOfferListCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOwner]

    def get(self, request):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response(
                {"error": "No salon found for your account."},
                status=status.HTTP_404_NOT_FOUND,
            )

        offers = Offer.objects.filter(salon=salon).order_by("-created_at")

        # Stats
        total_offers = offers.count()
        active_offers = offers.filter(is_active=True).count()
        promoted_offers = offers.filter(show_on_platform=True, is_active=True).count()

        redemption_stats = OfferRedemption.objects.filter(offer__salon=salon).aggregate(
            total_redemptions=Count("id"),
            total_discount_given=Sum("discount_amount"),
        )

        serializer = OfferOwnerSerializer(offers, many=True)
        return Response({
            "salon": {
                "id": salon.id,
                "name": salon.name,
            },
            "stats": {
                "total_offers": total_offers,
                "active_offers": active_offers,
                "promoted_offers": promoted_offers,
                "max_promoted_allowed": 3,
                "total_redemptions": redemption_stats["total_redemptions"] or 0,
                "total_discount_given": float(redemption_stats["total_discount_given"] or 0),
            },
            "offers": serializer.data,
        })

    def post(self, request):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response(
                {"error": "No salon found for your account."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = OfferOwnerSerializer(
            data=request.data,
            context={"salon": salon, "request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            offer = serializer.save(salon=salon)
            return Response(
                OfferOwnerSerializer(offer).data,
                status=status.HTTP_201_CREATED,
            )
        except DjangoValidationError as e:
            return Response(
                {"error": e.message_dict if hasattr(e, "message_dict") else str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class OwnerOfferDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOwner]

    def get_object(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return None
        return Offer.objects.filter(pk=pk, salon=salon).first()

    def get(self, request, pk):
        offer = self.get_object(request, pk)
        if not offer:
            return Response({"error": "Offer not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(OfferOwnerSerializer(offer).data)

    def put(self, request, pk):
        offer = self.get_object(request, pk)
        if not offer:
            return Response({"error": "Offer not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = OfferOwnerSerializer(
            offer,
            data=request.data,
            partial=False,
            context={"salon": offer.salon, "request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            updated_offer = serializer.save()
            return Response(OfferOwnerSerializer(updated_offer).data)
        except DjangoValidationError as e:
            return Response(
                {"error": e.message_dict if hasattr(e, "message_dict") else str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request, pk):
        offer = self.get_object(request, pk)
        if not offer:
            return Response({"error": "Offer not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = OfferOwnerSerializer(
            offer,
            data=request.data,
            partial=True,
            context={"salon": offer.salon, "request": request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            updated_offer = serializer.save()
            return Response(OfferOwnerSerializer(updated_offer).data)
        except DjangoValidationError as e:
            return Response(
                {"error": e.message_dict if hasattr(e, "message_dict") else str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        offer = self.get_object(request, pk)
        if not offer:
            return Response({"error": "Offer not found."}, status=status.HTTP_404_NOT_FOUND)

        # If it has redemptions, deactivate instead of hard delete to preserve financial history
        if offer.redemptions.exists():
            offer.is_active = False
            offer.show_on_platform = False
            offer.save(update_fields=["is_active", "show_on_platform"])
            return Response({
                "message": "Offer has prior redemptions. It has been deactivated and removed from platform display.",
                "archived": True,
            })

        offer.delete()
        return Response({"message": "Offer deleted successfully."})


class OwnerOfferToggleActiveView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOwner]

    def patch(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found."}, status=status.HTTP_404_NOT_FOUND)

        offer = Offer.objects.filter(pk=pk, salon=salon).first()
        if not offer:
            return Response({"error": "Offer not found."}, status=status.HTTP_404_NOT_FOUND)

        if offer.is_hidden_by_admin:
            return Response(
                {"error": "This offer has been suspended by platform administration and cannot be activated until unhidden by Super Admin."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        offer.is_active = not offer.is_active
        # If deactivating, also take down from platform promotion
        if not offer.is_active:
            offer.show_on_platform = False

        offer.save()
        return Response({
            "message": f"Offer '{offer.title}' is now {'active' if offer.is_active else 'inactive'}.",
            "is_active": offer.is_active,
            "show_on_platform": offer.show_on_platform,
            "offer": OfferOwnerSerializer(offer).data,
        })


class OwnerOfferTogglePlatformView(APIView):

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOwner]

    def patch(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found."}, status=status.HTTP_404_NOT_FOUND)

        offer = Offer.objects.filter(pk=pk, salon=salon).first()
        if not offer:
            return Response({"error": "Offer not found."}, status=status.HTTP_404_NOT_FOUND)

        if offer.is_hidden_by_admin:
            return Response(
                {"error": "This offer has been hidden by Super Admin and cannot be promoted on the platform until unhidden."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_state = not offer.show_on_platform

        if target_state:
            # Check if active
            if not offer.is_active:
                return Response(
                    {"error": "Cannot promote an inactive offer on the platform. Please activate the offer first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if offer.is_expired:
                return Response(
                    {"error": "Cannot promote an expired offer on the platform."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if offer.is_exhausted:
                return Response(
                    {"error": "Cannot promote an exhausted offer on the platform."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Enforce max 3 limit
            promoted_count = Offer.objects.filter(
                salon=salon,
                show_on_platform=True,
                is_active=True,
            ).exclude(pk=offer.pk).count()

            if promoted_count >= 3:
                return Response(
                    {
                        "error": "Limit reached: You can promote a maximum of 3 active offers on the BookMySalon platform at a time. Please remove platform promotion from another offer first.",
                        "promoted_count": promoted_count,
                        "max_allowed": 3,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        offer.show_on_platform = target_state
        offer.save(update_fields=["show_on_platform"])

        return Response({
            "message": f"Offer '{offer.title}' is {'now promoted on BookMySalon Platform' if offer.show_on_platform else 'no longer promoted on BookMySalon Platform'}.",
            "show_on_platform": offer.show_on_platform,
            "offer": OfferOwnerSerializer(offer).data,
        })


class OwnerOfferRedemptionsView(APIView):
    
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOwner]

    def get(self, request):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found."}, status=status.HTTP_404_NOT_FOUND)

        offer_id = request.query_params.get("offer_id")
        redemptions = OfferRedemption.objects.filter(offer__salon=salon)
        if offer_id:
            redemptions = redemptions.filter(offer_id=offer_id)

        redemptions = redemptions.select_related("offer", "customer", "booking").order_by("-redeemed_at")[:100]
        serializer = OfferRedemptionSerializer(redemptions, many=True)
        return Response(serializer.data)




class PublicFeaturedOffersView(APIView):
   
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        today = timezone.localdate()
        now = timezone.now()
        from subscriptions.models import SalonSubscription
        offers = Offer.objects.filter(
            show_on_platform=True,
            is_active=True,
            is_hidden_by_admin=False,
            start_date__lte=today,
            end_date__gte=today,
            salon__approval_status=Salon.ApprovalStatus.APPROVED,
            salon__subscription__isnull=False,
            salon__subscription__status__in=[SalonSubscription.Status.TRIAL, SalonSubscription.Status.ACTIVE],
            salon__subscription__end_date__gte=now,
        ).select_related("salon", "salon__subscription").prefetch_related("services")

       
        offers = [o for o in offers if not o.is_exhausted]

        
        city = request.query_params.get("city")
        if city:
            offers = [o for o in offers if o.salon.city.lower() == city.lower()]

        offer_type = request.query_params.get("offer_type")
        if offer_type:
            offers = [o for o in offers if o.offer_type == offer_type]

        serializer = OfferPublicSerializer(offers, many=True)
        return Response(serializer.data)


class SalonActiveOffersView(APIView):
   
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, salon_id):
        salon = Salon.objects.filter(pk=salon_id).select_related("subscription").first()
        if not salon:
            return Response({"error": "Salon not found"}, status=status.HTTP_404_NOT_FOUND)

        sub = getattr(salon, "subscription", None)
        if not sub or not sub.is_currently_active:
            return Response([], status=status.HTTP_200_OK)

        today = timezone.localdate()
        offers = Offer.objects.filter(
            salon_id=salon_id,
            is_active=True,
            is_hidden_by_admin=False,
            start_date__lte=today,
            end_date__gte=today,
        ).select_related("salon").prefetch_related("services")

        customer = request.user if request.user and request.user.is_authenticated else None
        phone = request.query_params.get("phone", "").strip()
        email = request.query_params.get("email", "").strip()
        if not email and customer and getattr(customer, "email", None):
            email = customer.email.strip()

        valid_offers = []
        for o in offers:
            
            if o.is_exhausted:
                continue

            is_eligible = True
            ineligible_reason = ""

            
            if o.per_customer_limit is not None and (email or customer or phone):
                redemption_count = 0
                if email:
                    redemption_count = o.redemptions.filter(customer_email__iexact=email).count()
                elif customer:
                    redemption_count = o.redemptions.filter(
                        Q(customer=customer) | Q(customer_email__iexact=getattr(customer, "email", ""))
                    ).count()
                elif phone:
                    redemption_count = o.redemptions.filter(customer_phone=phone).count()

                if redemption_count >= o.per_customer_limit:
                    is_eligible = False
                    ineligible_reason = f"Usage limit reached ({o.per_customer_limit} per customer)"

            
            if is_eligible and o.customer_eligibility == Offer.CustomerEligibility.FIRST_TIME and (email or customer or phone):
                from bookings.models import Booking
                booking_filter = Q(salon_id=salon_id) & ~Q(status=Booking.Status.CANCELLED)
                is_repeat = False
                if email:
                    is_repeat = Booking.objects.filter(booking_filter & Q(client_email__iexact=email)).exists()
                elif customer:
                    is_repeat = Booking.objects.filter(
                        booking_filter & (Q(customer=customer) | Q(client_email__iexact=getattr(customer, "email", "")))
                    ).exists()
                elif phone:
                    is_repeat = Booking.objects.filter(booking_filter & Q(client_phone=phone)).exists()

                if is_repeat:
                    is_eligible = False
                    ineligible_reason = "Valid exclusively for first-time bookings"

            o.is_customer_eligible = is_eligible
            o.customer_ineligibility_reason = ineligible_reason
            valid_offers.append(o)

        serializer = OfferPublicSerializer(valid_offers, many=True)
        return Response(serializer.data)


class ValidateOfferAPIView(APIView):
    
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OfferValidateInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        salon_id = data["salon_id"]
        code = data["code"]
        service_ids = data["service_ids"]
        booking_date = data.get("booking_date")
        booking_time = data.get("booking_time")
        customer_phone = data.get("customer_phone", "")
        customer_email = data.get("customer_email", "")

        salon = Salon.objects.filter(pk=salon_id).select_related("subscription").first()
        if not salon:
            return Response({"error": "Salon not found."}, status=status.HTTP_404_NOT_FOUND)

        sub = getattr(salon, "subscription", None)
        if not sub or not sub.is_currently_active:
            return Response(
                {"error": f"{salon.name} is currently unavailable for offers as their platform subscription has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        services = list(SalonService.objects.filter(pk__in=service_ids, salon=salon, is_active=True))
        if not services:
            return Response(
                {"error": "No valid services selected for this salon."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        customer = request.user if request.user and request.user.is_authenticated else None

        try:
            result = validate_and_calculate_offer(
                salon=salon,
                offer_code_or_id=code,
                services=services,
                customer=customer,
                customer_phone=customer_phone,
                customer_email=customer_email,
                booking_date=booking_date,
                booking_time=booking_time,
            )
            return Response({
                "valid": True,
                "offer_id": result["offer_id"],
                "offer_title": result["offer_title"],
                "offer_code": result["offer_code"],
                "offer_type": result["offer_type"],
                "discount_type": result["discount_type"],
                "discount_value": float(result["discount_value"]),
                "discount_amount": float(result["discount_amount"]),
                "subtotal": float(result["subtotal"]),
                "tax_amount": float(result["tax_amount"]),
                "total_amount": float(result["total_amount"]),
                "terms": result.get("terms", ""),
                "message": f"Offer applied! You save ₹{float(result['discount_amount']):.2f}.",
            })
        except DjangoValidationError as ve:
            err_msg = ve.message if hasattr(ve, "message") else (
                ", ".join(ve.messages) if hasattr(ve, "messages") else str(ve)
            )
            return Response({"valid": False, "error": err_msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"valid": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ==============================================================================
# SUPER ADMIN OFFERS MANAGEMENT VIEWS
# ==============================================================================

class AdminOffersStatsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        today = timezone.localdate()
        total_offers = Offer.objects.count()
        hidden_offers = Offer.objects.filter(is_hidden_by_admin=True).count()
        active_offers = Offer.objects.filter(is_active=True, is_hidden_by_admin=False).count()
        promoted_offers = Offer.objects.filter(
            show_on_platform=True,
            is_active=True,
            is_hidden_by_admin=False,
        ).count()
        expired_offers = Offer.objects.filter(end_date__lt=today).count()
        total_redemptions = OfferRedemption.objects.count()
        total_salons = Salon.objects.count()
        salons_with_offers = Offer.objects.values("salon_id").distinct().count()

        type_counts = Offer.objects.values("offer_type").annotate(count=Count("id"))
        type_breakdown = {t[0]: 0 for t in Offer.OfferType.choices}
        for row in type_counts:
            type_breakdown[row["offer_type"]] = row["count"]

        return Response({
            "total_offers": total_offers,
            "active_offers": active_offers,
            "hidden_offers": hidden_offers,
            "promoted_offers": promoted_offers,
            "expired_offers": expired_offers,
            "total_redemptions": total_redemptions,
            "total_salons": total_salons,
            "salons_with_offers": salons_with_offers,
            "type_breakdown": type_breakdown,
        })


class AdminSalonsOffersSummaryView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        search = request.query_params.get("search", "").strip()
        status_filter = request.query_params.get("status", "ALL").strip().upper()

        salons_qs = Salon.objects.select_related("owner").all().order_by("name")
        if search:
            salons_qs = salons_qs.filter(
                Q(name__icontains=search)
                | Q(city__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
            )

        if status_filter and status_filter != "ALL":
            salons_qs = salons_qs.filter(approval_status=status_filter)

        result = []
        for salon in salons_qs:
            offers_qs = salon.offers.all()
            total_offers = offers_qs.count()
            active_offers = offers_qs.filter(is_active=True, is_hidden_by_admin=False).count()
            hidden_offers = offers_qs.filter(is_hidden_by_admin=True).count()
            promoted_offers = offers_qs.filter(
                show_on_platform=True,
                is_active=True,
                is_hidden_by_admin=False,
            ).count()

            result.append({
                "id": salon.id,
                "name": salon.name,
                "city": salon.city,
                "cover_image": salon.cover_image,
                "approval_status": salon.approval_status,
                "owner_email": (salon.owner.email if salon.owner else salon.email) or "",
                "total_offers": total_offers,
                "active_offers": active_offers,
                "hidden_offers": hidden_offers,
                "promoted_offers": promoted_offers,
            })

        return Response({"salons": result, "count": len(result)})


class AdminOffersListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        today = timezone.localdate()
        qs = Offer.objects.select_related("salon").prefetch_related("services").all()

        salon_id = request.query_params.get("salon_id")
        if salon_id:
            qs = qs.filter(salon_id=salon_id)

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(code__icontains=search)
                | Q(description__icontains=search)
                | Q(salon__name__icontains=search)
                | Q(salon__city__icontains=search)
            )

        offer_type = request.query_params.get("offer_type", "").strip().upper()
        if offer_type and offer_type != "ALL":
            qs = qs.filter(offer_type=offer_type)

        status_param = request.query_params.get("status", "all").strip().lower()
        if status_param == "active":
            qs = qs.filter(is_active=True, is_hidden_by_admin=False)
        elif status_param == "inactive":
            qs = qs.filter(is_active=False, is_hidden_by_admin=False)
        elif status_param == "hidden":
            qs = qs.filter(is_hidden_by_admin=True)
        elif status_param == "promoted":
            qs = qs.filter(show_on_platform=True, is_hidden_by_admin=False)
        elif status_param == "expired":
            qs = qs.filter(end_date__lt=today)

        sort_by = request.query_params.get("sort_by", "newest")
        if sort_by == "newest":
            qs = qs.order_by("-created_at")
        elif sort_by == "oldest":
            qs = qs.order_by("created_at")
        elif sort_by == "discount_high":
            qs = qs.order_by("-discount_value")
        elif sort_by == "discount_low":
            qs = qs.order_by("discount_value")
        elif sort_by == "most_used":
            qs = qs.order_by("-usage_count")
        elif sort_by == "expiring_soon":
            qs = qs.order_by("end_date")
        else:
            qs = qs.order_by("-created_at")

        serializer = OfferAdminSerializer(qs, many=True)
        return Response(serializer.data)


class AdminOfferModerateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUserRole]

    def post(self, request, pk):
        offer = Offer.objects.select_related("salon").filter(pk=pk).first()
        if not offer:
            return Response({"error": "Offer not found."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get("action", "").strip().lower()
        reason = request.data.get("reason", "").strip()

        if action == "hide":
            if not reason:
                reason = "Hidden from platform by Super Admin for compliance review."
            offer.is_hidden_by_admin = True
            offer.admin_hidden_reason = reason
            offer.admin_hidden_at = timezone.now()
            offer.show_on_platform = False
            offer.save(update_fields=["is_hidden_by_admin", "admin_hidden_reason", "admin_hidden_at", "show_on_platform"])

            return Response({
                "message": f"Offer '{offer.title}' has been hidden from platform display.",
                "offer": OfferAdminSerializer(offer).data,
            })

        elif action == "unhide":
            offer.is_hidden_by_admin = False
            offer.admin_hidden_reason = f"Restored by Super Admin on {timezone.now().strftime('%Y-%m-%d %H:%M')}: {reason}" if reason else ""
            offer.admin_hidden_at = None
            offer.save(update_fields=["is_hidden_by_admin", "admin_hidden_reason", "admin_hidden_at"])

            return Response({
                "message": f"Offer '{offer.title}' has been restored to platform view.",
                "offer": OfferAdminSerializer(offer).data,
            })

        else:
            return Response(
                {"error": "Invalid action. Supported actions are 'hide' or 'unhide'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

