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
def record_booking_advance_payment(
    booking,
    amount,
    payment_method=Payment.PaymentMethod.ONLINE,
    razorpay_order_id="",
    razorpay_payment_id="",
    notes="",
):
    """
    Records an advance token payment (e.g. ₹100) toward a booking.
    - Updates Booking advance and remaining balances.
    - Creates/updates a Payment record for the advance.
    - Credits the salon's OwnerWallet.
    - Creates an OwnerWalletTransaction with human-readable description.
    Idempotent: will not duplicate if an ADVANCE_RECEIVED transaction already exists for this booking.
    """
    amount = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if amount <= Decimal("0.00"):
        return None

    wallet = OwnerWallet.objects.select_for_update().get_or_create(
        salon=booking.salon,
        defaults={"owner": booking.salon.owner, "balance": Decimal("0.00")},
    )[0]

    # Idempotency check: don't double credit advance
    existing_tx = OwnerWalletTransaction.objects.filter(
        booking=booking,
        transaction_type=OwnerWalletTransaction.TransactionType.ADVANCE_RECEIVED,
    ).first()
    if existing_tx:
        logger.info("Advance payment for Booking #%s already recorded. Skipping duplicate.", booking.id)
        return existing_tx

    total_price = Decimal(str(booking.total_amount if booking.total_amount is not None else booking.service_price))
    remaining = max(Decimal("0.00"), total_price - amount)

    # 1. Create Payment record for advance
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

    # 2. Update booking states
    booking.advance_amount = amount
    booking.remaining_amount = remaining
    booking.is_advance_paid = True
    booking.is_fully_paid = (remaining == Decimal("0.00"))
    booking.payment_status = (
        Booking.PaymentStatus.PAID if remaining == Decimal("0.00") else Booking.PaymentStatus.PARTIALLY_PAID
    )
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
    wallet.total_advances += amount
    wallet.save(update_fields=["balance", "total_collected", "total_advances", "updated_at"])

    # 4. Formulate human-readable description
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
    logger.info("Recorded advance payment tx #%s for booking #%s", tx.id, booking.id)
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
    - Deducts advance already paid and calculates remaining amount.
    - Confirms full payment (e.g. ₹500 total, ₹100 advance, ₹400 remaining).
    - Calculates worker's agreed share (e.g. 60% = ₹300) and salon's share (₹200).
    - Records WorkerEarning and WorkerWalletTransaction.
    - Updates OwnerWallet with net salon share and registers total completed & worker payouts.
    - Records OwnerWalletTransaction with human-readable description matching user requirements.
    - Fully idempotent: checks existing transactions and earnings to avoid duplicate credits.
    """
    wallet = OwnerWallet.objects.select_for_update().get_or_create(
        salon=booking.salon,
        defaults={"owner": booking.salon.owner, "balance": Decimal("0.00")},
    )[0]

    # Idempotency check: don't duplicate completion if both owner tx and worker earning exist
    existing_owner_tx = OwnerWalletTransaction.objects.filter(
        booking=booking,
        transaction_type__in=[
            OwnerWalletTransaction.TransactionType.REMAINING_RECEIVED,
            OwnerWalletTransaction.TransactionType.FULL_PAYMENT_RECEIVED,
        ],
    ).first()

    existing_earning = None
    if booking.worker:
        existing_earning = WorkerEarning.objects.filter(
            booking=booking,
            status=WorkerEarning.Status.CREDITED,
        ).first()

    if existing_owner_tx and (existing_earning or booking.worker is None):
        logger.info("Service completion, owner revenue, and worker earning already fully recorded for Booking #%s.", booking.id)
        if booking.status != Booking.Status.COMPLETED or not booking.is_fully_paid:
            booking.status = Booking.Status.COMPLETED
            booking.payment_status = Booking.PaymentStatus.PAID
            booking.is_fully_paid = True
            booking.remaining_amount = Decimal("0.00")
            booking.save(update_fields=["status", "payment_status", "is_fully_paid", "remaining_amount", "updated_at"])
        return existing_owner_tx, existing_earning

    total_price = Decimal(str(booking.total_amount if booking.total_amount is not None else booking.service_price)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    advance_paid = Decimal(str(booking.advance_amount or "0.00")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    if remaining_amount_paid is None:
        remaining_to_pay = max(Decimal("0.00"), total_price - advance_paid)
    else:
        remaining_to_pay = Decimal(str(remaining_amount_paid)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

    # Worker Commission calculation
    worker = booking.worker
    if worker:
        rate = Decimal(str(getattr(worker, "commission_rate", 60.00))).quantize(Decimal("0.01"))
        worker_share = ((total_price * rate) / Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        rate = Decimal("0.00")
        worker_share = Decimal("0.00")
    salon_share = max(Decimal("0.00"), total_price - worker_share)

    # 1. Record remaining payment if applicable and not already recorded
    payment_rec = Payment.objects.filter(booking=booking, payment_type=Payment.PaymentType.REMAINING).first()
    if not payment_rec and remaining_to_pay > Decimal("0.00"):
        payment_rec = Payment.objects.create(
            booking=booking,
            customer=booking.customer,
            salon=booking.salon,
            amount=remaining_to_pay,
            payment_type=Payment.PaymentType.REMAINING,
            payment_method=payment_method,
            payment_status=Payment.PaymentStatus.PAID,
            notes=notes or f"Remaining service balance paid at counter (₹{remaining_to_pay:g})",
            paid_at=timezone.now(),
        )

    # 2. Record WorkerEarning & WorkerWalletTransaction if worker assigned and earning not yet recorded
    worker_earning = existing_earning
    if worker and not existing_earning:
        worker_name = worker.user.get_full_name() if worker.user else f"Worker #{worker.id}"
        worker_wallet = WorkerWallet.objects.select_for_update().get_or_create(
            worker=worker,
            defaults={"balance": Decimal("0.00"), "total_earned": Decimal("0.00")},
        )[0]

        worker_earning, created = WorkerEarning.objects.get_or_create(
            worker=worker,
            booking=booking,
            defaults={
                "salon": booking.salon,
                "service_price": total_price,
                "commission_rate": rate,
                "earning_amount": worker_share,
                "salon_share": salon_share,
                "status": WorkerEarning.Status.CREDITED,
                "description": f"Commission for Booking #{booking.id} — {booking.service_name} ({rate:g}%)",
            },
        )

        if created:
            worker_wallet.balance += worker_share
            worker_wallet.total_earned += worker_share
            worker_wallet.save(update_fields=["balance", "total_earned", "updated_at"])

            client_name = booking.client_name or (booking.customer.get_full_name() if booking.customer else "Client")
            WorkerWalletTransaction.objects.create(
                wallet=worker_wallet,
                worker=worker,
                salon=booking.salon,
                booking=booking,
                earning=worker_earning,
                transaction_type=WorkerWalletTransaction.TransactionType.COMMISSION_CREDIT,
                flow="CREDIT",
                amount=worker_share,
                balance_after=worker_wallet.balance,
                description=f"Booking #{booking.id} — ₹{format_currency_amount(worker_share)} commission credited for {booking.service_name} ({client_name}).",
            )
    else:
        worker_name = (worker.user.get_full_name() if worker and worker.user else f"Worker #{worker.id}") if worker else "Unassigned Staff"

    # 3. Update OwnerWallet and record OwnerWalletTransaction if not yet recorded
    owner_tx = existing_owner_tx
    if not existing_owner_tx:
        # Note on balance: Advance (e.g. 100) was previously added to wallet.balance.
        # Now customer pays remaining (e.g. 400).
        # Worker share (e.g. 300) is deducted as worker obligation.
        # Net change to wallet balance: + remaining_to_pay - worker_share.
        net_wallet_change = remaining_to_pay - worker_share
        wallet.balance += net_wallet_change
        wallet.total_collected += remaining_to_pay
        wallet.total_completed_services += total_price
        wallet.total_worker_payout += worker_share
        wallet.save(update_fields=[
            "balance", "total_collected", "total_completed_services", "total_worker_payout", "updated_at"
        ])

        customer_name = booking.client_name or (booking.customer.get_full_name() if booking.customer else "Customer")
        if advance_paid > Decimal("0.00"):
            description = (
                f"Booking #{booking.id} — {customer_name} paid ₹{format_currency_amount(remaining_to_pay)} remaining service amount; "
                f"total service price ₹{format_currency_amount(total_price)}; Worker {worker_name} earned ₹{format_currency_amount(worker_share)}; "
                f"Salon share ₹{format_currency_amount(salon_share)}."
            )
            tx_type = OwnerWalletTransaction.TransactionType.REMAINING_RECEIVED
        else:
            description = (
                f"Booking #{booking.id} — {customer_name} paid ₹{format_currency_amount(total_price)} service amount; "
                f"Worker {worker_name} earned ₹{format_currency_amount(worker_share)}; Salon share ₹{format_currency_amount(salon_share)}."
            )
            tx_type = OwnerWalletTransaction.TransactionType.FULL_PAYMENT_RECEIVED

        owner_tx = OwnerWalletTransaction.objects.create(
            wallet=wallet,
            salon=booking.salon,
            booking=booking,
            payment=payment_rec,
            transaction_type=tx_type,
            flow=OwnerWalletTransaction.FlowType.CREDIT,
            amount=remaining_to_pay if remaining_to_pay > Decimal("0.00") else total_price,
            balance_after=wallet.balance,
            description=description,
            metadata={
                "customer_name": customer_name,
                "worker_name": worker_name,
                "service_name": booking.service_name,
                "total_service_price": str(total_price),
                "advance_paid": str(advance_paid),
                "remaining_paid": str(remaining_to_pay),
                "worker_share": str(worker_share),
                "salon_share": str(salon_share),
                "commission_rate": str(rate),
                "payment_method": payment_method,
            },
        )

    # 4. Mark booking finalized and completed
    booking.status = Booking.Status.COMPLETED
    booking.payment_status = Booking.PaymentStatus.PAID
    booking.is_fully_paid = True
    booking.remaining_amount = Decimal("0.00")
    booking.save(update_fields=["status", "payment_status", "is_fully_paid", "remaining_amount", "updated_at"])

    return owner_tx, worker_earning


@transaction.atomic
def reconcile_booking_revenue(booking, reconciled_by=None):
    """
    Audits and synchronizes the financial ledger for a booking.
    - If already synchronized, returns without duplicate ledger entries.
    - If any entries (WorkerEarning or OwnerWalletTransaction) are missing,
      records them atomically and updates balances.
    - Updates booking status to COMPLETED and payment status to PAID.
    """
    has_owner_tx = OwnerWalletTransaction.objects.filter(
        booking=booking,
        transaction_type__in=[
            OwnerWalletTransaction.TransactionType.REMAINING_RECEIVED,
            OwnerWalletTransaction.TransactionType.FULL_PAYMENT_RECEIVED,
        ],
    ).exists()

    has_worker_earning = False
    if booking.worker:
        has_worker_earning = WorkerEarning.objects.filter(
            booking=booking,
            status=WorkerEarning.Status.CREDITED,
        ).exists()
    else:
        has_worker_earning = True

    was_already_synced = has_owner_tx and has_worker_earning and booking.status == Booking.Status.COMPLETED

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
        "owner_transaction_created": not has_owner_tx,
        "worker_earning_created": not has_worker_earning and bool(booking.worker),
        "owner_transaction": owner_tx,
        "worker_earning": worker_earning,
    }


def get_unreconciled_bookings(salon=None, worker=None):
    """
    Returns a queryset of COMPLETED bookings missing either OwnerWalletTransaction
    or WorkerEarning (when a worker is assigned).
    """
    from django.db.models import Q

    qs = Booking.objects.filter(status=Booking.Status.COMPLETED)
    if salon:
        qs = qs.filter(salon=salon)
    if worker:
        qs = qs.filter(worker=worker)

    completed_owner_tx_bids = OwnerWalletTransaction.objects.filter(
        booking__isnull=False,
        transaction_type__in=[
            OwnerWalletTransaction.TransactionType.REMAINING_RECEIVED,
            OwnerWalletTransaction.TransactionType.FULL_PAYMENT_RECEIVED,
        ],
    ).values_list("booking_id", flat=True)

    credited_worker_bids = WorkerEarning.objects.filter(
        booking__isnull=False,
        status=WorkerEarning.Status.CREDITED,
    ).values_list("booking_id", flat=True)

    unreconciled = qs.filter(
        ~Q(id__in=completed_owner_tx_bids) |
        (Q(worker__isnull=False) & ~Q(id__in=credited_worker_bids))
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

    return record_service_completion_and_final_payment(
        booking=booking,
        completed_by_user=completed_by_user,
    )
