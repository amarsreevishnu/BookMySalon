import hmac
import hashlib
import logging
import requests
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from django.conf import settings
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import CustomerWallet, WalletTransaction, WalletTopUpPayment

logger = logging.getLogger(__name__)

MAX_WALLET_TOPUP_AMOUNT = Decimal("10000.00")


class InsufficientWalletFundsError(ValidationError):
    """Raised when customer wallet balance is less than required deduction."""
    pass


class WalletLockedError(ValidationError):
    """Raised when customer wallet is locked."""
    pass


class WalletInactiveError(ValidationError):
    """Raised when customer wallet is deactivated."""
    pass


def get_customer_wallet(user, lock=False):
    """
    Retrieves or auto-creates the customer's wallet.
    Optionally applies select_for_update() row lock inside an atomic transaction.
    """
    if not user or not user.is_authenticated:
        return None

    if lock:
        wallet, _ = CustomerWallet.objects.select_for_update().get_or_create(
            user=user,
            defaults={"balance": Decimal("0.00"), "currency": "INR", "is_active": True},
        )
    else:
        wallet = CustomerWallet.get_or_create_for_user(user)

    return wallet


def validate_wallet_balance(user, required_amount):
    """
    Validates if customer has sufficient available funds for an operation.
    Returns dict:
      {
        "has_sufficient_funds": bool,
        "available_balance": Decimal,
        "required_amount": Decimal,
        "shortfall": Decimal,
      }
    """
    wallet = get_customer_wallet(user)
    req = Decimal(str(required_amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    available = wallet.balance if wallet else Decimal("0.00")
    has_sufficient = bool(wallet and wallet.is_active and not wallet.is_locked and available >= req)
    shortfall = max(Decimal("0.00"), req - available)

    return {
        "has_sufficient_funds": has_sufficient,
        "available_balance": available,
        "required_amount": req,
        "shortfall": shortfall,
        "is_active": bool(wallet and wallet.is_active),
        "is_locked": bool(wallet and wallet.is_locked),
    }


@transaction.atomic
def credit_wallet(
    user,
    amount,
    transaction_type=WalletTransaction.TransactionType.CREDIT,
    reason="",
    booking=None,
    idempotency_key=None,
    metadata=None,
):
    """
    Atomically credits funds to the customer wallet.
    Enforces idempotency, locks row against concurrency, updates balance and records transaction.
    """
    amount = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= Decimal("0.00"):
        raise ValidationError("Credit amount must be greater than zero.")

    # Idempotency check: don't double credit
    if idempotency_key:
        existing_tx = WalletTransaction.objects.filter(
            idempotency_key=idempotency_key,
            status=WalletTransaction.Status.COMPLETED,
        ).first()
        if existing_tx:
            logger.info("Wallet credit with idempotency_key %s already processed. Returning existing.", idempotency_key)
            return existing_tx.wallet, existing_tx

    wallet = get_customer_wallet(user, lock=True)
    if not wallet.is_active:
        raise WalletInactiveError("Cannot credit to an inactive wallet.")

    balance_before = wallet.balance
    wallet.balance = (wallet.balance + amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    balance_after = wallet.balance
    wallet.save(update_fields=["balance", "updated_at"])

    tx = WalletTransaction.objects.create(
        wallet=wallet,
        transaction_type=transaction_type,
        status=WalletTransaction.Status.COMPLETED,
        amount=amount,
        balance_before=balance_before,
        balance_after=balance_after,
        reason=reason or f"Wallet credited with ₹{amount}",
        booking=booking,
        idempotency_key=idempotency_key,
        metadata=metadata or {},
    )

    logger.info("Wallet credited: User %s, Amount ₹%s, Balance: ₹%s -> ₹%s [Tx %s]",
                user.id, amount, balance_before, balance_after, tx.transaction_id)
    return wallet, tx


@transaction.atomic
def debit_wallet(
    user,
    amount,
    transaction_type=WalletTransaction.TransactionType.BOOKING_PAYMENT,
    reason="",
    booking=None,
    idempotency_key=None,
    metadata=None,
):
    """
    Atomically debits funds from the customer wallet.
    Enforces concurrency lock, balance check, idempotency, updates balance and records transaction.
    """
    amount = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= Decimal("0.00"):
        raise ValidationError("Debit amount must be greater than zero.")

    # Idempotency check: don't double debit
    if idempotency_key:
        existing_tx = WalletTransaction.objects.filter(
            idempotency_key=idempotency_key,
            status=WalletTransaction.Status.COMPLETED,
        ).first()
        if existing_tx:
            logger.info("Wallet debit with idempotency_key %s already processed. Returning existing.", idempotency_key)
            return existing_tx.wallet, existing_tx

    wallet = get_customer_wallet(user, lock=True)
    if not wallet.is_active:
        raise WalletInactiveError("Customer wallet is inactive.")
    if wallet.is_locked:
        raise WalletLockedError("Customer wallet is temporarily locked.")

    if wallet.balance < amount:
        raise InsufficientWalletFundsError(
            f"Insufficient wallet funds. Required: ₹{amount}, Available: ₹{wallet.balance}"
        )

    balance_before = wallet.balance
    wallet.balance = (wallet.balance - amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    balance_after = wallet.balance
    wallet.save(update_fields=["balance", "updated_at"])

    tx = WalletTransaction.objects.create(
        wallet=wallet,
        transaction_type=transaction_type,
        status=WalletTransaction.Status.COMPLETED,
        amount=amount,
        balance_before=balance_before,
        balance_after=balance_after,
        reason=reason or f"Wallet debited for ₹{amount}",
        booking=booking,
        idempotency_key=idempotency_key,
        metadata=metadata or {},
    )

    logger.info("Wallet debited: User %s, Amount ₹%s, Balance: ₹%s -> ₹%s [Tx %s]",
                user.id, amount, balance_before, balance_after, tx.transaction_id)
    return wallet, tx


@transaction.atomic
def refund_to_wallet(
    booking,
    amount=None,
    reason="",
    processed_by=None,
    idempotency_key=None,
):
    """
    Credits refund directly into customer's wallet when a booking or service is cancelled.
    Called by payment refund processor.
    """
    customer = booking.customer
    if not customer:
        logger.warning("Cannot refund to wallet for booking #%s: No customer user attached.", booking.id)
        return None, None

    refund_amount = Decimal(str(amount if amount is not None else booking.total_amount or booking.service_price))
    refund_amount = refund_amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if refund_amount <= Decimal("0.00"):
        return None, None

    key = idempotency_key or f"REFUND-BKG-{booking.id}-{refund_amount}"
    narrative = (
        f"Refund for cancelled Booking #{booking.id} ({booking.service_name} at {booking.salon.name})"
        + (f" — Reason: {reason}" if reason else "")
    )

    meta = {
        "booking_id": booking.id,
        "salon_name": booking.salon.name,
        "service_name": booking.service_name,
        "processed_by_id": processed_by.id if processed_by else None,
        "reason": reason,
    }

    wallet, tx = credit_wallet(
        user=customer,
        amount=refund_amount,
        transaction_type=WalletTransaction.TransactionType.REFUND,
        reason=narrative,
        booking=booking,
        idempotency_key=key,
        metadata=meta,
    )

    return wallet, tx


@transaction.atomic
def process_wallet_booking_payment(booking, customer_user):
    """
    Processes full payment for a salon booking using the customer's wallet balance.
    - Atomically debits customer wallet.
    - Updates booking status to CONFIRMED, payment_status to PAID, is_fully_paid to True.
    - Creates corresponding Payment record with payment_method=WALLET.
    - Credits salon owner revenue ledger.
    """
    amount = Decimal(str(booking.total_amount if booking.total_amount is not None else booking.service_price))
    amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    key = f"BOOKING-WALLET-PAY-{booking.id}"
    narrative = f"Full payment for Booking #{booking.id} — {booking.service_name} at {booking.salon.name}"

    meta = {
        "booking_id": booking.id,
        "salon_id": booking.salon.id,
        "salon_name": booking.salon.name,
        "service_name": booking.service_name,
        "booking_date": str(booking.booking_date),
        "booking_time": str(booking.booking_time),
    }

    # 1. Debit customer wallet
    wallet, tx = debit_wallet(
        user=customer_user,
        amount=amount,
        transaction_type=WalletTransaction.TransactionType.BOOKING_PAYMENT,
        reason=narrative,
        booking=booking,
        idempotency_key=key,
        metadata=meta,
    )

    # 2. Update booking states
    from bookings.models import Booking
    booking.status = Booking.Status.CONFIRMED
    booking.payment_method = Booking.PaymentMethod.WALLET
    booking.payment_status = Booking.PaymentStatus.PAID
    booking.is_advance_paid = False
    booking.is_fully_paid = True
    booking.remaining_amount = Decimal("0.00")
    booking.advance_amount = Decimal("0.00")
    booking.expires_at = None
    booking.save(update_fields=[
        "status", "payment_method", "payment_status",
        "is_advance_paid", "is_fully_paid", "remaining_amount",
        "advance_amount", "expires_at", "updated_at"
    ])

    # 3. Create or update Payment record
    from payments.models import Payment
    Payment.objects.update_or_create(
        booking=booking,
        defaults={
            "customer": customer_user,
            "salon": booking.salon,
            "amount": amount,
            "payment_type": Payment.PaymentType.FULL,
            "payment_method": "WALLET",
            "payment_status": Payment.PaymentStatus.PAID,
            "notes": f"Full payment debited from Customer Wallet ({tx.transaction_id})",
            "paid_at": timezone.now(),
        },
    )

    # 4. Credit salon owner's revenue wallet
    try:
        from payments.services import record_booking_advance_payment
        record_booking_advance_payment(
            booking=booking,
            amount=amount,
            payment_method="WALLET",
            notes=f"Full customer payment via Wallet ({tx.transaction_id})",
        )
    except Exception as owner_ledger_err:
        logger.warning("Could not credit owner ledger for wallet payment on booking #%s: %s", booking.id, owner_ledger_err)

    return booking, tx


@transaction.atomic
def topup_wallet(user, amount, payment_method="ONLINE", notes="", idempotency_key=None):
    """
    Credits customer wallet for a top-up / deposit operation.
    """
    amount = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= Decimal("0.00"):
        raise ValidationError("Top-up amount must be greater than zero.")

    narrative = notes or f"Wallet top-up of ₹{amount} via {payment_method}"
    meta = {
        "payment_method": payment_method,
        "channel": "CUSTOMER_TOPUP",
    }

    return credit_wallet(
        user=user,
        amount=amount,
        transaction_type=WalletTransaction.TransactionType.CREDIT,
        reason=narrative,
        idempotency_key=idempotency_key,
        metadata=meta,
    )


def validate_topup_amount(raw_amount):
    """
    Validates entered wallet top-up amount:
      - Must be provided
      - Valid numeric decimal
      - Strictly positive (> 0.00)
      - At most 2 decimal places
      - Maximum ₹10,000 per transaction
    """
    if raw_amount is None or str(raw_amount).strip() == "":
        raise ValidationError("Amount must be entered.")

    clean_str = str(raw_amount).strip().replace(",", "")
    try:
        amt = Decimal(clean_str)
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError("Amount must be a valid numeric value.")

    if not amt.is_finite():
        raise ValidationError("Invalid decimal amount value.")

    if amt <= Decimal("0.00"):
        raise ValidationError("Amount must be a valid positive number. Negative values and zero are not accepted.")

    if amt > MAX_WALLET_TOPUP_AMOUNT:
        raise ValidationError(f"Maximum top-up amount per transaction is ₹{MAX_WALLET_TOPUP_AMOUNT:,.2f}.")

    # Reject malformed inputs with more than 2 decimal places (e.g. 10.999)
    exponent = amt.as_tuple().exponent
    if isinstance(exponent, int) and exponent < -2:
        raise ValidationError("Amount cannot have more than 2 decimal places.")

    return amt.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def create_wallet_topup_order(user, amount):
    """
    Initiates a separate Razorpay order dedicated strictly for customer wallet top-up.
    Validates amount limits (<= ₹10,000) and creates a PENDING WalletTopUpPayment record.
    """
    if not user or not user.is_authenticated:
        raise ValidationError("Authentication required to top up wallet.")

    validated_amount = validate_topup_amount(amount)
    wallet = get_customer_wallet(user)
    if not wallet or not wallet.is_active:
        raise WalletInactiveError("Your wallet is deactivated. Please contact support.")
    if wallet.is_locked:
        raise WalletLockedError("Your wallet is locked for security review.")

    rzp_key = getattr(settings, "RAZORPAY_KEY_ID", "")
    rzp_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "")
    if not rzp_key or not rzp_secret:
        raise ValidationError("Razorpay gateway credentials are not configured on the server.")

    amount_in_paise = int(round(float(validated_amount) * 100))
    receipt_id = f"wtop_{user.id}_{int(timezone.now().timestamp())}"

    order_id = None
    import sys
    is_test_or_debug = "test" in sys.argv or getattr(settings, "TESTING", False) or settings.DEBUG
    try:
        rzp_res = requests.post(
            "https://api.razorpay.com/v1/orders",
            auth=(rzp_key, rzp_secret),
            json={
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": receipt_id,
                "notes": {
                    "type": "WALLET_TOPUP",
                    "user_id": str(user.id),
                    "wallet_id": str(wallet.id),
                    "amount": str(validated_amount),
                },
            },
            timeout=10,
        )
        if rzp_res.status_code in [200, 201]:
            order_data = rzp_res.json()
            order_id = order_data.get("id")
        else:
            logger.error("Razorpay order creation error (%s): %s", rzp_res.status_code, rzp_res.text)
            if is_test_or_debug:
                import uuid
                order_id = f"order_mock_{uuid.uuid4().hex[:14]}"
            else:
                raise ValidationError("Unable to initiate Razorpay order. Please try again.")
    except requests.RequestException as req_err:
        logger.error("Network error communicating with Razorpay: %s", req_err)
        if is_test_or_debug:
            import uuid
            order_id = f"order_mock_{uuid.uuid4().hex[:14]}"
        else:
            raise ValidationError("Payment gateway connection failed. Please check your internet connection.")

    if not order_id:
        raise ValidationError("Failed to generate payment order reference.")

    topup_payment = WalletTopUpPayment.objects.create(
        user=user,
        wallet=wallet,
        amount=validated_amount,
        currency="INR",
        razorpay_order_id=order_id,
        status=WalletTopUpPayment.Status.PENDING,
    )

    return {
        "order_id": order_id,
        "amount": str(validated_amount),
        "amount_in_paise": amount_in_paise,
        "currency": "INR",
        "key_id": rzp_key,
        "topup_id": topup_payment.topup_id,
        "customer": {
            "name": user.get_full_name() or user.email.split("@")[0],
            "email": user.email,
            "phone": getattr(user, "phone", "") or "",
        },
    }


@transaction.atomic
def verify_wallet_topup_payment(user, razorpay_order_id, razorpay_payment_id, razorpay_signature):
    """
    Verifies Razorpay payment signature and order details.
    Upon successful verification:
      - Validates order ownership and expected currency (INR)
      - Atomically updates wallet balance with select_for_update() row lock
      - Creates a CREDIT transaction with reason "WALLET_TOPUP"
      - Updates WalletTopUpPayment to SUCCESS with payment reference
      - Guarantees idempotency (no duplicate wallet credits for same payment)
    """
    if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        raise ValidationError("razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.")

    # 1. Fetch & lock WalletTopUpPayment record
    topup_payment = WalletTopUpPayment.objects.select_for_update().filter(
        razorpay_order_id=razorpay_order_id,
        user=user,
    ).first()

    if not topup_payment:
        raise ValidationError("No wallet top-up order found matching this reference.")

    if topup_payment.currency != "INR":
        raise ValidationError(f"Invalid currency: {topup_payment.currency}. Expected INR.")

    # 2. Idempotency: If already credited successfully, return existing result without double-crediting
    if topup_payment.status == WalletTopUpPayment.Status.SUCCESS:
        logger.info("Topup %s (order: %s) already completed successfully.", topup_payment.topup_id, razorpay_order_id)
        return topup_payment.wallet, topup_payment.transaction, topup_payment

    if topup_payment.status == WalletTopUpPayment.Status.FAILED:
        raise ValidationError("This payment order was marked as failed.")

    # 3. Cryptographic HMAC-SHA256 signature verification
    rzp_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "")
    if not rzp_secret:
        raise ValidationError("Razorpay gateway secret is not configured on the server.")

    msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode()
    expected_sig = hmac.new(rzp_secret.encode(), msg, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_sig, razorpay_signature):
        topup_payment.status = WalletTopUpPayment.Status.FAILED
        topup_payment.error_description = "Invalid Razorpay payment signature."
        topup_payment.save(update_fields=["status", "error_description", "updated_at"])
        logger.warning("Invalid payment signature for topup %s [order: %s]", topup_payment.topup_id, razorpay_order_id)
        raise ValidationError("Invalid payment signature. Verification failed.")

    # 4. Lock customer wallet row and check status
    wallet = CustomerWallet.objects.select_for_update().get(id=topup_payment.wallet_id)
    if not wallet.is_active:
        raise WalletInactiveError("Your wallet is deactivated.")
    if wallet.is_locked:
        raise WalletLockedError("Your wallet is locked.")

    # 5. Credit wallet balance with reason "WALLET_TOPUP"
    idempotency_key = f"TOPUP-RZP-{razorpay_payment_id}"
    reason = "WALLET_TOPUP"
    meta = {
        "razorpay_order_id": razorpay_order_id,
        "razorpay_payment_id": razorpay_payment_id,
        "topup_id": topup_payment.topup_id,
        "source": "RAZORPAY",
    }

    wallet, tx = credit_wallet(
        user=user,
        amount=topup_payment.amount,
        transaction_type=WalletTransaction.TransactionType.CREDIT,
        reason=reason,
        idempotency_key=idempotency_key,
        metadata=meta,
    )

    # 6. Commit top-up status to SUCCESS
    topup_payment.status = WalletTopUpPayment.Status.SUCCESS
    topup_payment.razorpay_payment_id = razorpay_payment_id
    topup_payment.razorpay_signature = razorpay_signature
    topup_payment.transaction = tx
    topup_payment.save(update_fields=[
        "status",
        "razorpay_payment_id",
        "razorpay_signature",
        "transaction",
        "updated_at",
    ])

    logger.info("Wallet top-up verified: User %s credited ₹%s [Tx %s, TopUp %s]",
                user.id, topup_payment.amount, tx.transaction_id, topup_payment.topup_id)
    return wallet, tx, topup_payment


@transaction.atomic
def record_wallet_topup_failure(user, razorpay_order_id, reason="", error_code=""):
    """
    Safely records a failed or cancelled wallet top-up payment.
    Ensures wallet balance is never credited.
    """
    if not razorpay_order_id:
        return None

    topup_payment = WalletTopUpPayment.objects.select_for_update().filter(
        razorpay_order_id=razorpay_order_id,
        user=user,
    ).first()

    if not topup_payment:
        return None

    # Do not overwrite already successful payment
    if topup_payment.status == WalletTopUpPayment.Status.SUCCESS:
        return topup_payment

    topup_payment.status = WalletTopUpPayment.Status.FAILED
    desc = f"{reason} (code: {error_code})".strip() if error_code else (reason or "Payment failed or cancelled")
    topup_payment.error_description = desc
    topup_payment.save(update_fields=["status", "error_description", "updated_at"])
    logger.info("Topup %s marked as FAILED: %s", topup_payment.topup_id, desc)
    return topup_payment

