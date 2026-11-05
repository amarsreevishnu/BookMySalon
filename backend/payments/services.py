import logging
from datetime import datetime, time
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from bookings.models import Booking
from .models import (
    Payment,
    OwnerWallet,
    OwnerWalletTransaction,
    WorkerWallet,
    WorkerEarning,
    WorkerWalletTransaction,
    Refund,
)

logger = logging.getLogger(__name__)


DEFAULT_WORKER_COMMISSION_RATE = Decimal("60.00")


def format_currency_amount(val):
    """Format decimal/numeric amount without unnecessary trailing zeroes (e.g. ₹100, ₹400)."""
    try:
        d = Decimal(str(val))
        if d == d.to_integral():
            return str(int(d))
        return f"{d:.2f}"
    except Exception:
        return str(val)


def get_or_create_owner_wallet(salon):
    """Retrieve or create the OwnerWallet for the given salon."""
    return OwnerWallet.get_or_create_for_salon(salon)


@transaction.atomic
def record_customer_payment_to_owner(
    booking,
    amount=None,
    payment_method=None,
    razorpay_order_id="",
    razorpay_payment_id="",
    notes="",
):
    """
    Credits customer payment in full to the Salon Owner's wallet.
    - Used for:
        1. Online Payment (when verified)
        2. BookMySalon Customer Wallet Payment (when booking confirmed)
        3. Pay at Salon (when service is marked COMPLETED)
    - Enforces idempotency: if customer payment credit already exists for this booking,
      does not duplicate the credit.
    - Updates Booking payment status to PAID and is_fully_paid to True.
    - Creates OwnerWalletTransaction with flow=CREDIT and type=CUSTOMER_PAYMENT_RECEIVED.
    """
    if amount is None:
        total = booking.total_amount if booking.total_amount is not None else booking.service_price
        amount = Decimal(str(total or "0.00"))
    else:
        amount = Decimal(str(amount))
    amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= Decimal("0.00"):
        return None

    wallet = OwnerWallet.objects.select_for_update().get_or_create(
        salon=booking.salon,
        defaults={"owner": booking.salon.owner, "balance": Decimal("0.00")},
    )[0]

    total_price = Decimal(
        str(booking.total_amount if booking.total_amount is not None else booking.service_price or "0.00")
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Idempotency check: don't double credit customer payment if already fully credited
    total_credited = sum(
        Decimal(str(a))
        for a in OwnerWalletTransaction.objects.filter(
            booking=booking,
            flow=OwnerWalletTransaction.FlowType.CREDIT,
        ).values_list("amount", flat=True)
    )
    if total_price > Decimal("0.00") and total_credited >= total_price:
        logger.info(
            "Customer payment for Booking #%s already fully credited to owner wallet. Skipping duplicate.",
            booking.id,
        )
        return OwnerWalletTransaction.objects.filter(
            booking=booking,
            flow=OwnerWalletTransaction.FlowType.CREDIT,
        ).first()

    method = payment_method or booking.payment_method or Payment.PaymentMethod.ONLINE

    # 1. Update or create Payment record
    payment = Payment.objects.filter(booking=booking).first()
    if not payment:
        payment = Payment.objects.create(
            booking=booking,
            customer=booking.customer,
            salon=booking.salon,
            amount=amount,
            payment_type=Payment.PaymentType.FULL,
            payment_method=method,
            payment_status=Payment.PaymentStatus.PAID,
            razorpay_order_id=razorpay_order_id or booking.razorpay_order_id or "",
            razorpay_payment_id=razorpay_payment_id or booking.razorpay_payment_id or "",
            notes=notes or f"Full payment of ₹{format_currency_amount(amount)} received via {method}",
            paid_at=timezone.now(),
        )
    else:
        payment.amount = amount
        payment.payment_type = Payment.PaymentType.FULL
        payment.payment_method = method
        payment.payment_status = Payment.PaymentStatus.PAID
        if razorpay_order_id:
            payment.razorpay_order_id = razorpay_order_id
        if razorpay_payment_id:
            payment.razorpay_payment_id = razorpay_payment_id
        if notes:
            payment.notes = notes
        payment.paid_at = timezone.now()
        payment.save()

    # 2. Update booking states
    booking.advance_amount = Decimal("0.00")
    booking.remaining_amount = Decimal("0.00")
    booking.is_advance_paid = False
    booking.is_fully_paid = True
    booking.payment_status = Booking.PaymentStatus.PAID
    if payment_method:
        booking.payment_method = payment_method
    if razorpay_order_id:
        booking.razorpay_order_id = razorpay_order_id
    if razorpay_payment_id:
        booking.razorpay_payment_id = razorpay_payment_id
    booking.save(update_fields=[
        "advance_amount", "remaining_amount", "is_advance_paid", "is_fully_paid",
        "payment_status", "payment_method", "razorpay_order_id", "razorpay_payment_id", "updated_at"
    ])

    # 3. Credit OwnerWallet
    wallet.balance += amount
    wallet.total_collected += amount
    wallet.save(update_fields=["balance", "total_collected", "updated_at"])

    # 4. Formulate human-readable description
    customer_name = booking.client_name or (booking.customer.get_full_name() if booking.customer else "Customer")
    service_name = booking.service_name or "Salon Service"
    method_display = dict(Payment.PaymentMethod.choices).get(method, method)
    description = f"Booking #{booking.id} — Customer payment received: ₹{format_currency_amount(amount)} via {method_display} for {service_name} ({customer_name})."

    tx = OwnerWalletTransaction.objects.create(
        wallet=wallet,
        salon=booking.salon,
        booking=booking,
        payment=payment,
        transaction_type=OwnerWalletTransaction.TransactionType.CUSTOMER_PAYMENT_RECEIVED,
        flow=OwnerWalletTransaction.FlowType.CREDIT,
        amount=amount,
        balance_after=wallet.balance,
        description=description,
        metadata={
            "customer_name": customer_name,
            "service_name": service_name,
            "total_service_price": str(amount),
            "payment_method": method,
            "payment_type": "FULL",
            "operation": "CUSTOMER_PAYMENT_COLLECTION",
            "razorpay_payment_id": razorpay_payment_id or booking.razorpay_payment_id,
        },
    )
    logger.info("Recorded customer payment tx #%s for booking #%s", tx.id, booking.id)
    return tx


@transaction.atomic
def settle_worker_commission_for_completed_booking(booking, completed_by_user=None, notes=""):
    """
    Settles the worker commission (default 60%) for a completed booking as an independent operation:
    1. Deducts commission from Salon Owner's wallet (flow=DEBIT, type=WORKER_COMMISSION_PAYOUT).
    2. Credits the exact matching commission to worker's earnings & wallet (flow=CREDIT).
    - Idempotent: executed at most once per completed booking.
    - If booking has no worker assigned, returns (None, None).
    """
    if not booking or not booking.worker:
        return None, None

    worker = booking.worker
    salon = booking.salon

    # Acquire row locks
    owner_wallet = OwnerWallet.objects.select_for_update().get_or_create(
        salon=salon,
        defaults={"owner": salon.owner, "balance": Decimal("0.00")},
    )[0]
    worker_wallet = WorkerWallet.objects.select_for_update().get_or_create(
        worker=worker,
        defaults={"balance": Decimal("0.00"), "total_earned": Decimal("0.00")},
    )[0]

    # Idempotency check:
    existing_owner_debit = OwnerWalletTransaction.objects.filter(
        booking=booking,
        flow=OwnerWalletTransaction.FlowType.DEBIT,
        transaction_type__in=[
            OwnerWalletTransaction.TransactionType.WORKER_COMMISSION_PAYOUT,
            OwnerWalletTransaction.TransactionType.WORKER_ALLOCATION,
        ],
    ).first()

    existing_earning = WorkerEarning.objects.filter(
        booking=booking,
        status=WorkerEarning.Status.CREDITED,
    ).first()

    if existing_owner_debit and existing_earning:
        logger.info("Worker commission for Booking #%s already fully settled. Skipping duplicate.", booking.id)
        return existing_owner_debit, existing_earning

    total_price = Decimal(
        str(booking.total_amount if booking.total_amount is not None else booking.service_price or "0.00")
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Commission rate: defaults to 60.00%
    rate = Decimal(str(getattr(worker, "commission_rate", None) or DEFAULT_WORKER_COMMISSION_RATE)).quantize(Decimal("0.01"))
    if rate <= Decimal("0.00"):
        rate = DEFAULT_WORKER_COMMISSION_RATE

    worker_share = ((total_price * rate) / Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    salon_share = max(Decimal("0.00"), total_price - worker_share)

    worker_name = worker.user.get_full_name() if worker.user else f"Worker #{worker.id}"
    customer_name = booking.client_name or (booking.customer.get_full_name() if booking.customer else "Customer")
    service_name = booking.service_name or "Salon Service"

    # 1. Credit Worker Earning and Worker Wallet
    worker_earning = existing_earning
    if not worker_earning and worker_share > Decimal("0.00"):
        worker_earning, created = WorkerEarning.objects.get_or_create(
            worker=worker,
            booking=booking,
            defaults={
                "salon": salon,
                "service_price": total_price,
                "commission_rate": rate,
                "earning_amount": worker_share,
                "salon_share": salon_share,
                "status": WorkerEarning.Status.CREDITED,
                "description": f"Commission for Booking #{booking.id} — {service_name} ({rate:g}%)",
            },
        )
        if created:
            worker_wallet.balance += worker_share
            worker_wallet.total_earned += worker_share
            worker_wallet.save(update_fields=["balance", "total_earned", "updated_at"])

            WorkerWalletTransaction.objects.create(
                wallet=worker_wallet,
                worker=worker,
                salon=salon,
                booking=booking,
                earning=worker_earning,
                transaction_type=WorkerWalletTransaction.TransactionType.COMMISSION_CREDIT,
                flow="CREDIT",
                amount=worker_share,
                balance_after=worker_wallet.balance,
                description=f"Booking #{booking.id} — ₹{format_currency_amount(worker_share)} ({rate:g}%) commission credited for {service_name} ({customer_name}).",
            )

    # 2. Deduct Worker Commission from Salon Owner Wallet
    owner_debit_tx = existing_owner_debit
    if not owner_debit_tx and worker_share > Decimal("0.00"):
        owner_wallet.balance -= worker_share
        owner_wallet.total_worker_payout += worker_share
        owner_wallet.total_completed_services += total_price
        owner_wallet.save(update_fields=[
            "balance", "total_worker_payout", "total_completed_services", "updated_at"
        ])

        description = (
            f"Booking #{booking.id} — Worker commission payout of ₹{format_currency_amount(worker_share)} "
            f"({rate:g}%) deducted for {worker_name} ({service_name})."
        )
        owner_debit_tx = OwnerWalletTransaction.objects.create(
            wallet=owner_wallet,
            salon=salon,
            booking=booking,
            transaction_type=OwnerWalletTransaction.TransactionType.WORKER_COMMISSION_PAYOUT,
            flow=OwnerWalletTransaction.FlowType.DEBIT,
            amount=worker_share,
            balance_after=owner_wallet.balance,
            description=description,
            metadata={
                "worker_id": worker.id,
                "worker_name": worker_name,
                "customer_name": customer_name,
                "service_name": service_name,
                "total_service_price": str(total_price),
                "commission_rate": str(rate),
                "worker_share": str(worker_share),
                "salon_share": str(salon_share),
                "operation": "WORKER_COMMISSION_SETTLEMENT",
            },
        )

    logger.info("Settled worker commission for booking #%s: ₹%s to %s", booking.id, worker_share, worker_name)
    return owner_debit_tx, worker_earning


@transaction.atomic
def record_booking_advance_payment(
    booking,
    amount,
    payment_method=Payment.PaymentMethod.ONLINE,
    razorpay_order_id="",
    razorpay_payment_id="",
    notes="",
):
    """
    Records customer payment credit toward booking.
    Maintained for compatibility with legacy test harness; in BookMySalon,
    payments are full service payments without advance token deductions.
    """
    amount = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= Decimal("0.00"):
        return None

    total_price = Decimal(
        str(booking.total_amount if booking.total_amount is not None else booking.service_price or "0.00")
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    is_partial = (amount < total_price)

    # If full payment, use standard record_customer_payment_to_owner
    if not is_partial:
        return record_customer_payment_to_owner(
            booking=booking,
            amount=amount,
            payment_method=payment_method,
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id,
            notes=notes or "Customer payment in full",
        )

    # If partial amount was explicitly passed in legacy test:
    wallet = OwnerWallet.objects.select_for_update().get_or_create(
        salon=booking.salon,
        defaults={"owner": booking.salon.owner, "balance": Decimal("0.00")},
    )[0]

    existing_tx = OwnerWalletTransaction.objects.filter(
        booking=booking,
        flow=OwnerWalletTransaction.FlowType.CREDIT,
    ).first()
    if existing_tx:
        return existing_tx

    payment = Payment.objects.create(
        booking=booking,
        customer=booking.customer,
        salon=booking.salon,
        amount=amount,
        payment_type=Payment.PaymentType.ADVANCE,
        payment_method=payment_method,
        payment_status=Payment.PaymentStatus.PAID,
        razorpay_order_id=razorpay_order_id or booking.razorpay_order_id,
        razorpay_payment_id=razorpay_payment_id or booking.razorpay_payment_id,
        notes=notes or f"Advance token payment of ₹{amount:g} received",
        paid_at=timezone.now(),
    )

    remaining = max(Decimal("0.00"), total_price - amount)
    booking.advance_amount = amount
    booking.remaining_amount = remaining
    booking.is_advance_paid = True
    booking.is_fully_paid = False
    booking.payment_status = Booking.PaymentStatus.PARTIALLY_PAID
    if payment_method:
        booking.payment_method = payment_method
    booking.save(update_fields=[
        "advance_amount", "remaining_amount", "is_advance_paid", "is_fully_paid",
        "payment_status", "payment_method", "updated_at"
    ])

    wallet.balance += amount
    wallet.total_collected += amount
    wallet.total_advances += amount
    wallet.save(update_fields=["balance", "total_collected", "total_advances", "updated_at"])

    customer_name = booking.client_name or (booking.customer.get_full_name() if booking.customer else "Customer")
    service_name = booking.service_name or "Salon Service"
    description = f"Booking #{booking.id} — {customer_name} paid ₹{format_currency_amount(amount)} advance for {service_name}"

    tx = OwnerWalletTransaction.objects.create(
        wallet=wallet,
        salon=booking.salon,
        booking=booking,
        payment=payment,
        transaction_type=OwnerWalletTransaction.TransactionType.ADVANCE_RECEIVED,
        flow=OwnerWalletTransaction.FlowType.CREDIT,
        amount=amount,
        balance_after=wallet.balance,
        description=description,
        metadata={
            "customer_name": customer_name,
            "service_name": service_name,
            "advance_paid": str(amount),
            "remaining_amount": str(remaining),
            "total_service_price": str(total_price),
            "payment_method": payment_method,
            "razorpay_payment_id": razorpay_payment_id,
        },
    )
    return tx


@transaction.atomic
def record_service_completion_and_final_payment(
    booking,
    remaining_amount_paid=None,
    payment_method=Payment.PaymentMethod.CASH,
    completed_by_user=None,
    notes="",
):
    """
    Invoked when customer completes service at salon.
    1. If customer payment has not yet been credited to Salon Owner's wallet
       (e.g. for Pay at Salon bookings):
       Records full customer payment receipt (+₹1,000 credit).
    2. Settles worker commission (60%):
       Deducts ₹600 from Salon Owner's wallet (-₹600 debit).
       Credits ₹600 to Worker's earning & wallet (+₹600 credit).
    3. Finalizes booking status to COMPLETED and payment status to PAID.
    4. Auto-generates immutable ServiceReceipt.
    - Fully idempotent: will not double credit customer payment or double settle worker commission.
    - Returns (owner_transaction, worker_earning).
    """
    # 1. Customer Payment Collection (if not already collected)
    pay_method = payment_method or booking.payment_method or Payment.PaymentMethod.PAY_AT_SALON

    total_price = Decimal(
        str(booking.total_amount if booking.total_amount is not None else booking.service_price or "0.00")
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    total_credited = sum(
        Decimal(str(a))
        for a in OwnerWalletTransaction.objects.filter(
            booking=booking,
            flow=OwnerWalletTransaction.FlowType.CREDIT,
        ).values_list("amount", flat=True)
    )

    remaining_to_collect = max(Decimal("0.00"), total_price - total_credited)
    if remaining_amount_paid is not None:
        rem_param = Decimal(str(remaining_amount_paid)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if rem_param > Decimal("0.00"):
            remaining_to_collect = rem_param

    customer_payment_tx = None
    if remaining_to_collect > Decimal("0.00"):
        customer_payment_tx = record_customer_payment_to_owner(
            booking=booking,
            amount=remaining_to_collect,
            payment_method=pay_method,
            notes=notes or f"Service payment received at salon upon completion ({pay_method})",
        )
    else:
        customer_payment_tx = OwnerWalletTransaction.objects.filter(
            booking=booking,
            flow=OwnerWalletTransaction.FlowType.CREDIT,
        ).first()

    # 2. Worker Commission Settlement (separate operation)
    owner_debit_tx, worker_earning = settle_worker_commission_for_completed_booking(
        booking=booking,
        completed_by_user=completed_by_user,
        notes=notes,
    )

    # 3. Mark booking finalized and completed
    booking.status = Booking.Status.COMPLETED
    booking.payment_status = Booking.PaymentStatus.PAID
    booking.is_fully_paid = True
    booking.remaining_amount = Decimal("0.00")
    booking.advance_amount = Decimal("0.00")
    booking.save(update_fields=[
        "status", "payment_status", "is_fully_paid", "remaining_amount", "advance_amount", "updated_at"
    ])

    # 4. Auto-generate immutable ServiceReceipt
    try:
        from bookings.models import ServiceReceipt
        ServiceReceipt.get_or_create_for_booking(booking)
    except Exception as receipt_err:
        logger.warning("Could not auto-generate receipt for booking #%s: %s", booking.id, receipt_err)

    primary_owner_tx = owner_debit_tx or customer_payment_tx
    return primary_owner_tx, worker_earning


@transaction.atomic
def reconcile_booking_revenue(booking, reconciled_by=None):
    """
    Audits and synchronizes the financial ledger for a booking.
    - If already synchronized, returns without duplicate ledger entries.
    - If any entries (customer payment credit or worker commission deduction/earning) are missing,
      records them atomically and updates balances.
    - Updates booking status to COMPLETED and payment status to PAID.
    """
    has_owner_credit = OwnerWalletTransaction.objects.filter(
        booking=booking,
        flow=OwnerWalletTransaction.FlowType.CREDIT,
    ).exists()

    has_worker_earning = False
    has_owner_debit = False
    if booking.worker:
        has_earning = WorkerEarning.objects.filter(
            booking=booking,
            status=WorkerEarning.Status.CREDITED,
        ).exists()
        has_owner_debit = OwnerWalletTransaction.objects.filter(
            booking=booking,
            flow=OwnerWalletTransaction.FlowType.DEBIT,
            transaction_type__in=[
                OwnerWalletTransaction.TransactionType.WORKER_COMMISSION_PAYOUT,
                OwnerWalletTransaction.TransactionType.WORKER_ALLOCATION,
            ],
        ).exists()
        has_worker_earning = has_earning and has_owner_debit
    else:
        has_worker_earning = True

    was_already_synced = has_owner_credit and has_worker_earning and booking.status == Booking.Status.COMPLETED

    owner_tx, worker_earning = record_service_completion_and_final_payment(
        booking=booking,
        completed_by_user=reconciled_by,
        notes=f"Revenue reconciled by {reconciled_by.get_full_name() if reconciled_by else 'System'}",
    )

    return {
        "booking_id": booking.id,
        "reconciled": True,
        "already_synced": was_already_synced,
        "status": "ALREADY_SYNCHRONIZED" if was_already_synced else "RECONCILED",
        "message": (
            f"Booking #{booking.id} revenue was already synchronized."
            if was_already_synced
            else f"Booking #{booking.id} revenue successfully reconciled and credited to ledger."
        ),
        "owner_transaction_created": not has_owner_credit,
        "worker_earning_created": not has_worker_earning and bool(booking.worker),
        "owner_transaction": owner_tx,
        "worker_earning": worker_earning,
    }


def get_unreconciled_bookings(salon=None, worker=None):
    """
    Returns a queryset of COMPLETED bookings missing either:
    - Customer payment credit transaction on OwnerWallet
    - Worker commission settlement (OwnerWallet debit & WorkerEarning)
    """
    from django.db.models import Q

    qs = Booking.objects.filter(status=Booking.Status.COMPLETED)
    if salon:
        qs = qs.filter(salon=salon)
    if worker:
        qs = qs.filter(worker=worker)

    credit_owner_bids = OwnerWalletTransaction.objects.filter(
        booking__isnull=False,
        flow=OwnerWalletTransaction.FlowType.CREDIT,
    ).values_list("booking_id", flat=True)

    credited_worker_bids = WorkerEarning.objects.filter(
        booking__isnull=False,
        status=WorkerEarning.Status.CREDITED,
    ).values_list("booking_id", flat=True)

    worker_debit_owner_bids = OwnerWalletTransaction.objects.filter(
        booking__isnull=False,
        flow=OwnerWalletTransaction.FlowType.DEBIT,
        transaction_type__in=[
            OwnerWalletTransaction.TransactionType.WORKER_COMMISSION_PAYOUT,
            OwnerWalletTransaction.TransactionType.WORKER_ALLOCATION,
        ],
    ).values_list("booking_id", flat=True)

    unreconciled = qs.filter(
        ~Q(id__in=credit_owner_bids) |
        (Q(worker__isnull=False) & (~Q(id__in=credited_worker_bids) | ~Q(id__in=worker_debit_owner_bids)))
    ).select_related("salon", "worker", "worker__user", "customer").order_by("-booking_date", "-booking_time")

    return unreconciled


@transaction.atomic
def process_booking_cancellation_and_refund(
    booking,
    reason="Customer cancelled appointment",
    processed_by=None,
    force_refund=False,
):
    """
    Checks cancellation & refund policy, calculates refundable amounts,
    records refund transaction against booking and original payment,
    reverses worker earning if already credited, and debits OwnerWallet.
    Preserves original payment and transaction records.
    """
    wallet = OwnerWallet.objects.select_for_update().get_or_create(
        salon=booking.salon,
        defaults={"owner": booking.salon.owner, "balance": Decimal("0.00")},
    )[0]

    # Idempotency check: don't refund twice
    existing_refund = Refund.objects.filter(
        booking=booking,
        refund_status=Refund.Status.PROCESSED,
    ).first()
    if existing_refund:
        logger.info("Refund already processed for Booking #%s.", booking.id)
        return existing_refund, None

    # Calculate amount paid so far
    paid_payments = Payment.objects.filter(
        booking=booking,
        payment_status__in=[Payment.PaymentStatus.PAID, Payment.PaymentStatus.PARTIALLY_PAID],
    )
    total_paid = Decimal("0.00")
    primary_payment = None
    if paid_payments.exists():
        total_paid = sum(Decimal(str(p.amount)) for p in paid_payments)
        primary_payment = paid_payments.first()
    elif booking.is_advance_paid and booking.advance_amount:
        total_paid = Decimal(str(booking.advance_amount))

    total_paid = total_paid.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Policy check: Free cancellation if cancelled > 2 hours prior, or owner force_refund
    is_refundable = True
    cancellation_reason_note = reason
    try:
        booking_time_str = booking.booking_time or (booking.start_time.strftime("%H:%M") if booking.start_time else "09:00")
        parts = booking_time_str.split(":")
        b_hour = int(parts[0]) if len(parts) > 0 else 9
        b_min = int(parts[1][:2]) if len(parts) > 1 else 0
        b_dt = timezone.make_aware(
            datetime.combine(booking.booking_date, time(b_hour, b_min)),
            timezone.get_current_timezone(),
        )
        hours_before = (b_dt - timezone.now()).total_seconds() / 3600.0
        if hours_before < 2.0 and not force_refund:
            # Policy window check (< 2 hours)
            is_refundable = True # Still allow salon owner to refund or grant token refund
            cancellation_reason_note = f"{reason} (within 2-hr window)"
    except Exception as e:
        logger.warning("Could not calculate exact cancellation lead time: %s", e)

    customer_name = booking.client_name or (booking.customer.get_full_name() if booking.customer else "Customer")

    # If no money was ever paid, simply cancel booking
    if total_paid <= Decimal("0.00"):
        booking.status = Booking.Status.CANCELLED
        booking.save(update_fields=["status", "updated_at"])
        return None, None

    # Check and reverse WorkerEarning if already credited
    worker_reversal_amount = Decimal("0.00")
    credited_earning = WorkerEarning.objects.filter(
        booking=booking,
        status=WorkerEarning.Status.CREDITED,
    ).first()
    if credited_earning:
        worker_reversal_amount = credited_earning.earning_amount
        credited_earning.status = WorkerEarning.Status.REVERSED
        credited_earning.reversal_reason = f"Reversal due to refund on Booking #{booking.id}: {reason}"
        credited_earning.save(update_fields=["status", "reversal_reason", "updated_at"])

        worker_wallet = getattr(credited_earning.worker, "wallet", None)
        if not worker_wallet:
            worker_wallet = WorkerWallet.get_or_create_for_worker(credited_earning.worker)
        worker_wallet.balance = max(Decimal("0.00"), worker_wallet.balance - worker_reversal_amount)
        worker_wallet.save(update_fields=["balance", "updated_at"])

        WorkerWalletTransaction.objects.create(
            wallet=worker_wallet,
            worker=credited_earning.worker,
            salon=booking.salon,
            booking=booking,
            earning=credited_earning,
            transaction_type=WorkerWalletTransaction.TransactionType.COMMISSION_REVERSAL,
            flow="DEBIT",
            amount=worker_reversal_amount,
            balance_after=worker_wallet.balance,
            description=f"Booking #{booking.id} — Commission reversed (₹{format_currency_amount(worker_reversal_amount)}) due to customer refund: {reason}",
        )

    # Update OwnerWallet
    # Wallet is debited by total_paid.
    # If worker commission was previously credited/debited, reverse the worker obligation to the owner.
    wallet.balance -= total_paid
    if worker_reversal_amount > Decimal("0.00"):
        wallet.balance += worker_reversal_amount
        wallet.total_worker_payout = max(Decimal("0.00"), wallet.total_worker_payout - worker_reversal_amount)
    wallet.total_refunded += total_paid
    wallet.save(update_fields=["balance", "total_worker_payout", "total_refunded", "updated_at"])

    # Human readable description strictly matching user specification:
    description = f"Booking #{booking.id} — Refund of ₹{format_currency_amount(total_paid)} processed for {customer_name}. Reason: {cancellation_reason_note}"

    # Create Refund model record
    refund = Refund.objects.create(
        booking=booking,
        payment=primary_payment,
        salon=booking.salon,
        customer=booking.customer,
        amount=total_paid,
        reason=cancellation_reason_note,
        refund_status=Refund.Status.PROCESSED,
        worker_reversal_amount=worker_reversal_amount,
        description=description,
        processed_by=processed_by,
    )

    # Record OwnerWalletTransaction
    owner_tx = OwnerWalletTransaction.objects.create(
        wallet=wallet,
        salon=booking.salon,
        booking=booking,
        payment=primary_payment,
        transaction_type=OwnerWalletTransaction.TransactionType.REFUND_ISSUED,
        flow=OwnerWalletTransaction.FlowType.DEBIT,
        amount=total_paid,
        balance_after=wallet.balance,
        description=description,
        metadata={
            "customer_name": customer_name,
            "refund_amount": str(total_paid),
            "worker_reversal_amount": str(worker_reversal_amount),
            "reason": cancellation_reason_note,
            "refund_id": refund.id,
        },
    )

    # Update booking status to CANCELLED and payment_status to REFUNDED
    booking.status = Booking.Status.CANCELLED
    booking.payment_status = Booking.PaymentStatus.REFUNDED
    booking.save(update_fields=["status", "payment_status", "updated_at"])

    # Automatically credit refund amount into customer's wallet if customer exists and total_paid > 0
    if total_paid > Decimal("0.00") and booking.customer:
        try:
            from wallet.services import refund_to_wallet
            refund_to_wallet(
                booking=booking,
                amount=total_paid,
                reason=cancellation_reason_note,
                processed_by=processed_by,
                idempotency_key=f"REFUND-BKG-{booking.id}-{refund.id}",
            )
        except Exception as wallet_err:
            logger.error("Failed to credit customer wallet for booking #%s: %s", booking.id, wallet_err)

    # If a ServiceReceipt exists for this booking, preserve it and update refund/cancellation audit state
    try:
        from bookings.models import ServiceReceipt
        receipt = ServiceReceipt.objects.filter(booking=booking).first()
        if receipt:
            receipt.is_cancelled = True
            receipt.is_refunded = True
            receipt.refund_amount = total_paid
            receipt.refund_date = timezone.now()
            receipt.cancellation_reason = cancellation_reason_note
            receipt.save(update_fields=["is_cancelled", "is_refunded", "refund_amount", "refund_date", "cancellation_reason", "updated_at"])
    except Exception as sync_err:
        logger.warning("Could not sync receipt refund audit for booking #%s: %s", booking.id, sync_err)

    return refund, owner_tx


@transaction.atomic
def credit_worker_for_completed_booking(booking, completed_by_user=None):
    """
    Credits worker wallet for a completed booking if not already credited.
    Ensures exact idempotency and double-entry consistency.
    """
    if not booking or not booking.worker:
        return None, None

    # Idempotency check: exactly once
    existing_earning = WorkerEarning.objects.filter(
        worker=booking.worker,
        booking=booking,
        status=WorkerEarning.Status.CREDITED,
    ).first()
    if existing_earning:
        return existing_earning, None

    owner_debit_tx, worker_earning = settle_worker_commission_for_completed_booking(
        booking=booking,
        completed_by_user=completed_by_user,
    )
    return worker_earning, owner_debit_tx
