from decimal import Decimal, ROUND_HALF_UP


COUPON_RULES = {
    "SUMMERGLOW": {"type": "fixed", "value": Decimal("50.00"), "min_spend": Decimal("150.00"), "label": "Summer Glow Promo"},
    "FIRSTSPA": {"type": "fixed", "value": Decimal("200.00"), "min_spend": Decimal("500.00"), "label": "First Spa Welcome"},
    "LUXE20": {"type": "percent", "value": Decimal("0.20"), "min_spend": Decimal("300.00"), "label": "20% Luxury Discount"},
    "WELCOME50": {"type": "fixed", "value": Decimal("50.00"), "min_spend": Decimal("200.00"), "label": "Welcome Wellness Discount"},
    "FLAT100": {"type": "fixed", "value": Decimal("100.00"), "min_spend": Decimal("350.00"), "label": "Flat ₹100 Off"},
}

GST_RATE = Decimal("0.05")  # 5% GST & Hygiene Safety


def calculate_pricing(services, voucher_code=None, custom_discount=None):
    """
    Calculate item subtotal, total duration, taxes, discounts, and total amount.
    - services: iterable of SalonService instances (or dicts with 'price' and 'duration')
    - voucher_code: optional coupon/voucher code string
    - custom_discount: optional manual/gift voucher discount Decimal/float
    """
    subtotal = Decimal("0.00")
    total_duration_minutes = 0

    for s in services:
        if hasattr(s, "price"):
            p = Decimal(str(s.price or "0.00"))
        elif isinstance(s, dict):
            p = Decimal(str(s.get("price", "0.00")))
        else:
            p = Decimal("0.00")
        subtotal += p

        if hasattr(s, "duration"):
            d = int(s.duration or 0)
        elif isinstance(s, dict):
            d = int(s.get("duration", 0))
        else:
            d = 0
        total_duration_minutes += d

    subtotal = subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Calculate 5% GST tax (rounded to nearest rupee as per GST Section 170 and standard checkout practice)
    tax_amount = (subtotal * GST_RATE).quantize(Decimal("1"), rounding=ROUND_HALF_UP).quantize(Decimal("0.01"))

    # Calculate discount from coupon or voucher
    discount_amount = Decimal("0.00")
    code = (voucher_code or "").strip().upper()
    valid_code = ""

    if code and code in COUPON_RULES:
        rule = COUPON_RULES[code]
        if subtotal >= rule["min_spend"]:
            valid_code = code
            if rule["type"] == "percent":
                calc_disc = (subtotal * rule["value"]).quantize(Decimal("1"), rounding=ROUND_HALF_UP).quantize(Decimal("0.01"))
                discount_amount = min(subtotal, calc_disc)
            else:
                discount_amount = min(subtotal, rule["value"]).quantize(Decimal("0.01"))
    elif custom_discount is not None:
        try:
            cust = Decimal(str(custom_discount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if cust > 0:
                discount_amount = min(subtotal, cust)
                valid_code = code or "VOUCHER"
        except Exception:
            pass

    # Final Total = subtotal + taxes - discounts (never negative)
    total_amount = max(Decimal("0.00"), subtotal + tax_amount - discount_amount).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    ).quantize(Decimal("0.01"))

    return {
        "subtotal": subtotal,
        "total_duration": max(15, total_duration_minutes),
        "tax_amount": tax_amount,
        "discount_amount": discount_amount,
        "voucher_code": valid_code,
        "total_amount": total_amount,
    }
