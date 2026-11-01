from datetime import datetime, date, time
from decimal import Decimal, ROUND_HALF_UP
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, F
from django.utils import timezone

from .models import Offer, OfferRedemption


def validate_and_calculate_offer(
    salon,
    offer_code_or_id,
    services,
    customer=None,
    customer_phone="",
    customer_email="",
    booking_date=None,
    booking_time=None,
):
    """
    Validates offer applicability and computes exact discount amount.

    - salon: Salon instance or salon_id
    - offer_code_or_id: promo code string (e.g. 'ONAM25') or integer Offer ID
    - services: list/iterable of SalonService instances
    - customer: User instance or None
    - customer_phone: string
    - customer_email: string
    - booking_date: date object or 'YYYY-MM-DD' string
    - booking_time: time object or 'HH:MM' string
    """
    if not offer_code_or_id:
        raise ValidationError("No offer or coupon code specified.")

    if not services:
        raise ValidationError("At least one service must be selected to apply an offer.")

    # Resolve booking date
    if isinstance(booking_date, str):
        try:
            booking_date = datetime.strptime(booking_date, "%Y-%m-%d").date()
        except ValueError:
            booking_date = timezone.localdate()
    elif not isinstance(booking_date, (date, datetime)):
        booking_date = timezone.localdate()

    # Resolve booking time
    if isinstance(booking_time, str):
        try:
            parts = booking_time.split(":")
            booking_time = time(int(parts[0]), int(parts[1]))
        except Exception:
            booking_time = None

    # Retrieve offer from DB
    salon_id = salon.id if hasattr(salon, "id") else salon
    offer = None

    code_str = str(offer_code_or_id).strip()
    if code_str.isdigit():
        offer = Offer.objects.filter(pk=int(code_str), salon_id=salon_id).first()

    if not offer:
        offer = Offer.objects.filter(
            salon_id=salon_id,
            code__iexact=code_str.upper(),
        ).first()

    # Fallback to platform-promoted active offers if code was provided globally
    if not offer and code_str:
        offer = Offer.objects.filter(
            code__iexact=code_str.upper(),
            show_on_platform=True,
            is_active=True,
        ).first()

    # Fallback to legacy COUPON_RULES if not found in dynamic offers
    if not offer:
        from bookings.pricing import COUPON_RULES
        upper_code = code_str.upper()
        if upper_code in COUPON_RULES:
            rule = COUPON_RULES[upper_code]
            subtotal = sum(Decimal(str(s.price or "0.00")) for s in services)
            if subtotal < rule["min_spend"]:
                raise ValidationError(
                    f"Coupon '{upper_code}' requires a minimum booking subtotal of ₹{rule['min_spend']}."
                )
            if rule["type"] == "percent":
                calc_disc = (subtotal * rule["value"]).quantize(Decimal("1"), rounding=ROUND_HALF_UP).quantize(Decimal("0.01"))
                discount_amount = min(subtotal, calc_disc)
            else:
                discount_amount = min(subtotal, rule["value"]).quantize(Decimal("0.01"))

            tax_amount = (subtotal * Decimal("0.05")).quantize(Decimal("1"), rounding=ROUND_HALF_UP).quantize(Decimal("0.01"))
            total_amount = max(Decimal("0.00"), subtotal + tax_amount - discount_amount).quantize(Decimal("1"), rounding=ROUND_HALF_UP).quantize(Decimal("0.01"))

            return {
                "valid": True,
                "offer": None,
                "offer_id": None,
                "offer_title": rule["label"],
                "offer_code": upper_code,
                "offer_type": "COUPON",
                "discount_type": "PERCENTAGE" if rule["type"] == "percent" else "FLAT",
                "discount_value": rule["value"],
                "discount_amount": discount_amount,
                "subtotal": subtotal,
                "tax_amount": tax_amount,
                "total_amount": total_amount,
                "terms": "Standard promotional offer.",
            }

        raise ValidationError(f"Invalid or expired promo code: '{code_str}'.")

    # 1. Active status check
    if not offer.is_active:
        raise ValidationError(f"The offer '{offer.title}' is currently inactive.")

    # 2. Validity date range check
    if booking_date < offer.start_date:
        raise ValidationError(
            f"Offer '{offer.title}' is not valid until {offer.start_date.strftime('%b %d, %Y')}."
        )
    if booking_date > offer.end_date:
        raise ValidationError(
            f"Offer '{offer.title}' expired on {offer.end_date.strftime('%b %d, %Y')}."
        )

    # 3. Applicable days of the week check
    if offer.applicable_days:
        day_abbr = booking_date.strftime("%a").upper()[:3]  # e.g. 'MON', 'TUE'
        allowed_days = [d.strip().upper()[:3] for d in offer.applicable_days if d]
        if day_abbr not in allowed_days:
            allowed_names = ", ".join(offer.applicable_days)
            raise ValidationError(
                f"Offer '{offer.title}' is only valid on: {allowed_names} (Selected date is {booking_date.strftime('%A')})."
            )

    # 4. Applicable time of day check
    if booking_time and offer.start_time and offer.end_time:
        if not (offer.start_time <= booking_time <= offer.end_time):
            start_str = offer.start_time.strftime("%I:%M %p")
            end_str = offer.end_time.strftime("%I:%M %p")
            raise ValidationError(
                f"Offer '{offer.title}' is only valid for appointments between {start_str} and {end_str}."
            )

    # 5. Total usage limit check
    if offer.total_usage_limit is not None and offer.usage_count >= offer.total_usage_limit:
        raise ValidationError(f"Offer '{offer.title}' has reached its maximum total redemptions limit.")

    # 6. Customer eligibility check - EMAIL IS VERIFIED & PRIMARY IDENTIFIER
    if offer.customer_eligibility == Offer.CustomerEligibility.FIRST_TIME:
        from bookings.models import Booking
        booking_filter = Q(salon_id=salon_id) & ~Q(status=Booking.Status.CANCELLED)
        is_repeat = False

        norm_email = (customer_email or "").strip().lower()
        if not norm_email and customer and getattr(customer, "email", None):
            norm_email = customer.email.strip().lower()

        if norm_email:
            is_repeat = Booking.objects.filter(booking_filter & Q(client_email__iexact=norm_email)).exists()

        if not is_repeat and customer and customer.is_authenticated:
            is_repeat = Booking.objects.filter(booking_filter & Q(customer=customer)).exists()

        if not is_repeat and customer_phone:
            is_repeat = Booking.objects.filter(booking_filter & Q(client_phone=customer_phone.strip())).exists()

        if is_repeat:
            raise ValidationError(
                f"Offer '{offer.title}' is exclusively valid for your first appointment at {offer.salon.name}."
            )

    # 7. Per-customer usage limit check - EMAIL IS VERIFIED & PRIMARY IDENTIFIER
    if offer.per_customer_limit is not None:
        user_redemptions = 0
        redemption_qs = offer.redemptions.all()

        norm_email = (customer_email or "").strip().lower()
        if not norm_email and customer and getattr(customer, "email", None):
            norm_email = customer.email.strip().lower()

        if norm_email:
            user_redemptions = redemption_qs.filter(customer_email__iexact=norm_email).count()
        elif customer and customer.is_authenticated:
            user_redemptions = redemption_qs.filter(customer=customer).count()
        elif customer_phone:
            user_redemptions = redemption_qs.filter(customer_phone=customer_phone.strip()).count()

        if user_redemptions >= offer.per_customer_limit:
            raise ValidationError(
                f"You have already redeemed '{offer.title}' the maximum allowed ({offer.per_customer_limit} time{'s' if offer.per_customer_limit > 1 else ''})."
            )

    # Calculate subtotal
    subtotal = sum(Decimal(str(s.price or "0.00")) for s in services)
    subtotal = subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # 8. Minimum spend check
    if subtotal < offer.min_spend:
        raise ValidationError(
            f"Offer '{offer.title}' requires a minimum booking subtotal of ₹{offer.min_spend} (Current subtotal: ₹{subtotal})."
        )

    # 9. Services / Combo check
    applicable_subtotal = subtotal
    combo_services = list(offer.services.all()) if offer.pk else []

    if offer.offer_type == Offer.OfferType.COMBO:
        selected_ids = {s.id for s in services}
        missing = [cs for cs in combo_services if cs.id not in selected_ids]
        if missing:
            missing_names = ", ".join([cs.effective_name for cs in missing])
            combo_names = " + ".join([cs.effective_name for cs in combo_services])
            raise ValidationError(
                f"Combo offer '{offer.title}' requires selecting all combo services: {combo_names}. Missing: {missing_names}."
            )
        applicable_subtotal = sum(
            Decimal(str(s.price or "0.00")) for s in services if s.id in {cs.id for cs in combo_services}
        )
    elif not offer.apply_to_all_services and combo_services:
        offer_service_ids = {cs.id for cs in combo_services}
        matching_services = [s for s in services if s.id in offer_service_ids]
        if not matching_services:
            valid_names = ", ".join([cs.effective_name for cs in combo_services])
            raise ValidationError(
                f"Offer '{offer.title}' applies only to: {valid_names}."
            )
        applicable_subtotal = sum(Decimal(str(s.price or "0.00")) for s in matching_services)

    applicable_subtotal = applicable_subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # 10. Discount Calculation
    discount_amount = Decimal("0.00")

    if offer.discount_type == Offer.DiscountType.FIXED_PRICE:
        # Combo Fixed Price: total combo services original sum - fixed price
        discount_amount = max(Decimal("0.00"), applicable_subtotal - offer.discount_value)
    elif offer.discount_type == Offer.DiscountType.PERCENTAGE:
        raw_pct_disc = (applicable_subtotal * (offer.discount_value / Decimal("100.00"))).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        ).quantize(Decimal("0.01"))
        if offer.max_discount_amount:
            discount_amount = min(raw_pct_disc, offer.max_discount_amount)
        else:
            discount_amount = raw_pct_disc
    elif offer.discount_type == Offer.DiscountType.FLAT:
        discount_amount = min(applicable_subtotal, offer.discount_value)

    discount_amount = min(subtotal, discount_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # 5% GST on subtotal
    tax_amount = (subtotal * Decimal("0.05")).quantize(Decimal("1"), rounding=ROUND_HALF_UP).quantize(Decimal("0.01"))

    # Final Total
    total_amount = max(Decimal("0.00"), subtotal + tax_amount - discount_amount).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    ).quantize(Decimal("0.01"))

    return {
        "valid": True,
        "offer": offer,
        "offer_id": offer.id,
        "offer_title": offer.title,
        "offer_code": offer.code,
        "offer_type": offer.offer_type,
        "discount_type": offer.discount_type,
        "discount_value": offer.discount_value,
        "discount_amount": discount_amount,
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "terms": offer.terms_and_conditions,
    }


def record_offer_redemption(offer, booking, customer=None):
    """
    Records an offer redemption and safely increments offer usage count.
    """
    if not offer or not booking:
        return None

    # Check if already recorded for this booking
    existing = OfferRedemption.objects.filter(offer=offer, booking=booking).first()
    if existing:
        return existing

    redemption = OfferRedemption.objects.create(
        offer=offer,
        customer=customer or booking.customer,
        booking=booking,
        customer_email=booking.client_email or (customer.email if customer else ""),
        customer_phone=booking.client_phone or "",
        discount_amount=booking.discount_amount or Decimal("0.00"),
        order_subtotal=booking.subtotal or Decimal("0.00"),
    )

    # Increment usage count
    Offer.objects.filter(pk=offer.pk).update(usage_count=models.F("usage_count") + 1)
    offer.refresh_from_db(fields=["usage_count"])

    return redemption
