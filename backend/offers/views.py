from decimal import Decimal
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
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
    OfferValidateInputSerializer,
    OfferRedemptionSerializer,
)
from .services import validate_and_calculate_offer


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
    """
    Toggles platform promotion (Show on BookMySalon Platform).
    Enforces maximum of 3 active promoted offers per salon without admin approval.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsOwner]

    def patch(self, request, pk):
        salon = get_owner_salon(request.user)
        if not salon:
            return Response({"error": "No salon found."}, status=status.HTTP_404_NOT_FOUND)

        offer = Offer.objects.filter(pk=pk, salon=salon).first()
        if not offer:
            return Response({"error": "Offer not found."}, status=status.HTTP_404_NOT_FOUND)

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
    """
    Lists redemption history for an owner's salon offers.
    """
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


# -------------------------------------------------------------
# Customer & Public Views
# -------------------------------------------------------------

class PublicFeaturedOffersView(APIView):
    """
    Returns platform-promoted featured offers for the Customer Homepage and Dedicated Offers page.
    Automatically excludes expired, inactive, or exhausted offers.
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        today = timezone.localdate()
        offers = Offer.objects.filter(
            show_on_platform=True,
            is_active=True,
            start_date__lte=today,
            end_date__gte=today,
            salon__approval_status=Salon.ApprovalStatus.APPROVED,
        ).select_related("salon").prefetch_related("services")

        # Exclude exhausted
        offers = [o for o in offers if not o.is_exhausted]

        # Filter by city or offer_type if specified
        city = request.query_params.get("city")
        if city:
            offers = [o for o in offers if o.salon.city.lower() == city.lower()]

        offer_type = request.query_params.get("offer_type")
        if offer_type:
            offers = [o for o in offers if o.offer_type == offer_type]

        serializer = OfferPublicSerializer(offers, many=True)
        return Response(serializer.data)


class SalonActiveOffersView(APIView):
    """
    Returns all active, currently valid offers for a specific salon to be displayed
    on their Salon Details page and customer Booking Review page.
    Automatically excludes expired, inactive, or exhausted offers.
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, salon_id):
        today = timezone.localdate()
        offers = Offer.objects.filter(
            salon_id=salon_id,
            is_active=True,
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
            # 1. Total usage limit check (if salon-wide exhausted, exclude)
            if o.is_exhausted:
                continue

            is_eligible = True
            ineligible_reason = ""

            # 2. Per-customer limit check - EMAIL IS VERIFIED & PRIMARY IDENTIFIER
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

            # 3. First-time customer check - EMAIL IS VERIFIED & PRIMARY IDENTIFIER
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
    """
    Validates an offer / coupon code against selected services, date, time, and customer eligibility.
    Returns dynamic pricing calculation (subtotal, discount, tax, final total).
    """
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

        salon = Salon.objects.filter(pk=salon_id).first()
        if not salon:
            return Response({"error": "Salon not found."}, status=status.HTTP_404_NOT_FOUND)

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
