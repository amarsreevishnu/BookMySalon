from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone


class Booking(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONFIRMED = "CONFIRMED", "Confirmed"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        NO_SHOW = "NO_SHOW", "No Show"

    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    worker = models.ForeignKey(
        "salons.WorkerProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_bookings",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="customer_bookings",
    )
    service = models.ForeignKey(
        'services.SalonService',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
    )
    services = models.ManyToManyField(
        'services.SalonService',
        blank=True,
        related_name='multi_service_bookings',
        help_text='All services selected for this appointment',
    )
    client_name = models.CharField(max_length=150)
    client_phone = models.CharField(max_length=20, blank=True, default="")
    client_email = models.EmailField(blank=True, default="")
    service_name = models.CharField(max_length=150)
    service_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Sum of all services prices')
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Taxes (GST & hygiene)')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Discounts/coupons/vouchers')
    applied_offer = models.ForeignKey(
        'offers.Offer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
        help_text='Applied promotional or discount offer',
    )
    voucher_code = models.CharField(max_length=50, blank=True, default="", help_text='Applied promo or voucher code')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Final payable total')
    advance_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Token advance paid online (e.g. ₹100)')
    remaining_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Remaining service amount due at salon')
    is_advance_paid = models.BooleanField(default=False, help_text='Whether advance payment has been confirmed')
    is_fully_paid = models.BooleanField(default=False, help_text='Whether total service price is fully paid')
    booking_date = models.DateField()
    booking_time = models.CharField(max_length=50)
    start_time = models.TimeField(null=True, blank=True, help_text='Start time for online bookings')
    end_time = models.TimeField(null=True, blank=True, help_text='End time (auto-calculated from service duration)')
    duration = models.CharField(max_length=50, blank=True, default="45 mins")
    station = models.CharField(max_length=50, blank=True, default="Station 01")
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.CONFIRMED,
    )
    class PaymentMethod(models.TextChoices):
        PAY_AT_SALON = "PAY_AT_SALON", "Pay at Salon"
        ONLINE = "ONLINE", "Online Payment"
        WALLET = "WALLET", "Wallet Payment"

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PARTIALLY_PAID = "PARTIALLY_PAID", "Partially Paid (Advance)"
        PAID = "PAID", "Paid"
        FAILED = "FAILED", "Failed"
        REFUNDED = "REFUNDED", "Refunded"

    payment_method = models.CharField(
        max_length=30,
        choices=PaymentMethod.choices,
        default=PaymentMethod.PAY_AT_SALON,
    )
    payment_status = models.CharField(
        max_length=30,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    razorpay_order_id = models.CharField(max_length=100, blank=True, default="")
    razorpay_payment_id = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    worker_remarks = models.TextField(
        blank=True,
        default="",
        help_text="Specialist treatment remarks and consultation notes",
    )
    service_started_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when specialist started the appointment service",
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Reservation expiration time for pending bookings",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['worker', 'booking_date', 'start_time']),
        ]

    def __str__(self):
        return f"Booking #{self.id} - {self.client_name} - {self.service_name} ({self.status})"

    @property
    def payment(self):
        """Returns the primary/latest payment record for backward compatibility."""
        return self.payments.order_by("-created_at").first()

    def calculate_remaining_amount(self):
        """
        Calculates remaining service balance due based on total_amount, advance_amount,
        payment method, and payment status.
        - If fully paid or payment_status is PAID: returns Decimal('0.00').
        - If an advance token was paid: returns max(Decimal('0.00'), total_amount - advance_amount).
        - If Pay at Salon and not yet completed: returns total_amount.
        - If Online payment: returns Decimal('0.00') (full amount is settled online).
        """
        if self.is_fully_paid or self.payment_status == self.PaymentStatus.PAID:
            return Decimal("0.00")

        total = Decimal(str(self.total_amount if self.total_amount is not None else self.service_price or "0.00"))

        if self.is_advance_paid and self.advance_amount and self.advance_amount > Decimal("0.00"):
            return max(Decimal("0.00"), total - Decimal(str(self.advance_amount)))

        if self.payment_method == self.PaymentMethod.PAY_AT_SALON:
            return total

        return Decimal("0.00")

    def calculate_advance_amount(self):
        """
        Returns the advance amount paid online.
        If payment was full online or pay at salon, returns Decimal('0.00').
        """
        if self.is_advance_paid and self.advance_amount and self.advance_amount > Decimal("0.00"):
            return Decimal(str(self.advance_amount))
        return Decimal("0.00")

    def recalculate_payment_amounts(self):
        """
        Recalculates advance_amount, remaining_amount, and payment flags based on current state.
        """
        total = Decimal(str(self.total_amount if self.total_amount is not None else self.service_price or "0.00"))
        if self.payment_status == self.PaymentStatus.PAID or self.is_fully_paid:
            self.remaining_amount = Decimal("0.00")
            self.is_fully_paid = True
            if self.payment_method == self.PaymentMethod.ONLINE and not self.is_advance_paid:
                self.advance_amount = Decimal("0.00")
        elif self.is_advance_paid and self.advance_amount and self.advance_amount > Decimal("0.00"):
            self.remaining_amount = max(Decimal("0.00"), total - Decimal(str(self.advance_amount)))
            self.is_fully_paid = (self.remaining_amount == Decimal("0.00"))
        elif self.payment_method == self.PaymentMethod.PAY_AT_SALON:
            self.advance_amount = Decimal("0.00")
            self.remaining_amount = total
            self.is_advance_paid = False
            self.is_fully_paid = False
        elif self.payment_method == self.PaymentMethod.ONLINE:
            self.advance_amount = Decimal("0.00")
            self.remaining_amount = Decimal("0.00")
            self.is_advance_paid = False
            self.is_fully_paid = False


class ServiceReceipt(models.Model):
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name="service_receipt",
        help_text="The completed booking for which this receipt was issued.",
    )
    receipt_number = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Unique invoice/bill identifier e.g. BMS-REC-2026-00042",
    )
    salon = models.ForeignKey(
        "salons.Salon",
        on_delete=models.CASCADE,
        related_name="issued_receipts",
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_receipts",
    )

    # Salon Snapshot
    salon_name = models.CharField(max_length=200)
    salon_address = models.TextField(blank=True, default="")
    salon_city = models.CharField(max_length=100, blank=True, default="")
    salon_state = models.CharField(max_length=100, blank=True, default="")
    salon_zip_code = models.CharField(max_length=20, blank=True, default="")
    salon_phone = models.CharField(max_length=30, blank=True, default="")
    salon_email = models.EmailField(blank=True, default="")
    salon_gst_number = models.CharField(max_length=50, blank=True, default="")

    # Customer Snapshot
    customer_name = models.CharField(max_length=150)
    customer_phone = models.CharField(max_length=30, blank=True, default="")
    customer_email = models.EmailField(blank=True, default="")

    # Specialist / Worker
    specialist_name = models.CharField(max_length=150, blank=True, default="")

    # Appointment Snapshot
    booking_date = models.DateField()
    booking_time = models.CharField(max_length=50, blank=True, default="")
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    duration = models.CharField(max_length=50, blank=True, default="")
    station = models.CharField(max_length=50, blank=True, default="")

    # Itemized Services Snapshot
    services_snapshot = models.JSONField(
        default=list,
        blank=True,
        help_text="List of booked services snapshot [{name, price, duration}]",
    )

    # Financial breakdown (accurate historical amounts)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    applied_offer_title = models.CharField(max_length=150, blank=True, default="")
    voucher_code = models.CharField(max_length=50, blank=True, default="")
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    advance_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    remaining_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    # Payment details snapshot
    payment_method = models.CharField(max_length=50, default="Pay at Salon")
    payment_status = models.CharField(max_length=30, default="PAID")
    transaction_id = models.CharField(max_length=100, blank=True, default="")
    paid_at = models.DateTimeField(null=True, blank=True)

    # Refund / Cancellation audit status
    is_cancelled = models.BooleanField(default=False)
    is_refunded = models.BooleanField(default=False)
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    refund_date = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["receipt_number"]),
            models.Index(fields=["salon", "-created_at"]),
            models.Index(fields=["customer", "-created_at"]),
        ]

    def __str__(self):
        return f"Receipt {self.receipt_number} (Booking #{self.booking_id}) - ₹{self.amount_paid}"

    @classmethod
    def get_or_create_for_booking(cls, booking):
        """
        Idempotently generates or returns the ServiceReceipt for a booking.
        Enforces strict constraints:
        1. Service must be COMPLETED.
        2. Payment must be PAID / fully paid.
        3. If already generated, returns existing receipt without modification.
        4. If booking was later cancelled or refunded, preserves original receipt but reflects audit status.
        """
        # Return existing receipt if already generated
        existing = cls.objects.filter(booking=booking).first()
        if existing:
            needs_save = False

            # Repair zero amounts if previously generated with 0.00
            if existing.total_amount <= Decimal("0.00") or existing.subtotal <= Decimal("0.00"):
                existing_svcs = existing.services_snapshot or []
                s_sum = sum(
                    (Decimal(str(item.get("price", "0.00"))) for item in existing_svcs if isinstance(item, dict)),
                    Decimal("0.00"),
                )
                recomputed_subtot = (
                    (booking.subtotal if booking.subtotal and booking.subtotal > Decimal("0.00") else None)
                    or (s_sum if s_sum > Decimal("0.00") else None)
                    or (booking.service_price if booking.service_price and booking.service_price > Decimal("0.00") else None)
                    or (booking.total_amount if booking.total_amount and booking.total_amount > Decimal("0.00") else None)
                    or Decimal("0.00")
                )
                discount_val = Decimal(str(booking.discount_amount or "0.00"))
                tax_val = Decimal(str(booking.tax_amount or "0.00"))
                recomputed_total = (
                    (booking.total_amount if booking.total_amount and booking.total_amount > Decimal("0.00") else None)
                    or (recomputed_subtot - discount_val + tax_val if (recomputed_subtot - discount_val + tax_val) > Decimal("0.00") else None)
                    or recomputed_subtot
                )
                adv_amt = Decimal(str(booking.advance_amount or "0.00"))
                rem_amt = max(Decimal("0.00"), recomputed_total - adv_amt) if adv_amt > Decimal("0.00") else Decimal("0.00")

                existing.subtotal = recomputed_subtot.quantize(Decimal("0.01"))
                existing.discount_amount = discount_val.quantize(Decimal("0.01"))
                existing.tax_amount = tax_val.quantize(Decimal("0.01"))
                existing.total_amount = recomputed_total.quantize(Decimal("0.01"))
                existing.advance_amount = adv_amt.quantize(Decimal("0.01"))
                existing.remaining_amount = rem_amt.quantize(Decimal("0.01"))
                existing.amount_paid = recomputed_total.quantize(Decimal("0.01"))
                needs_save = True

            # Sync cancellation / refund status if booking was updated later
            if booking.status == Booking.Status.CANCELLED and not existing.is_cancelled:
                existing.is_cancelled = True
                needs_save = True
            if booking.payment_status == Booking.PaymentStatus.REFUNDED and not existing.is_refunded:
                existing.is_refunded = True
                refund_rel = getattr(booking, "refunds", None)
                if refund_rel and refund_rel.exists():
                    ref = refund_rel.first()
                    existing.refund_amount = ref.amount
                    existing.refund_date = ref.created_at
                else:
                    existing.refund_amount = existing.total_amount
                    existing.refund_date = timezone.now()
                needs_save = True
            if needs_save:
                existing.save()
            return existing, False

        # Constraint 1: Check service completion
        if booking.status != Booking.Status.COMPLETED:
            raise ValidationError(
                f"Receipt cannot be generated: Booking status is '{booking.get_status_display()}'. "
                "The appointment service must be completed before generating a final receipt."
            )

        # Constraint 2: Check payment completion
        is_paid = (
            booking.payment_status == Booking.PaymentStatus.PAID
            or booking.is_fully_paid
        )
        if not is_paid:
            raise ValidationError(
                f"Receipt cannot be generated: Payment status is '{booking.get_payment_status_display()}'. "
                "Full payment must be confirmed before generating a final receipt."
            )

        # Build snapshot
        salon = booking.salon
        customer = booking.customer

        # Services breakdown snapshot
        svcs = list(booking.services.all())
        if not svcs and booking.service:
            svcs = [booking.service]

        if svcs:
            services_data = [
                {
                    "name": s.effective_name,
                    "price": str(s.price),
                    "duration": f"{s.duration} mins" if isinstance(s.duration, int) else str(s.duration),
                }
                for s in svcs
            ]
        else:
            services_data = [
                {
                    "name": booking.service_name or "Salon Service",
                    "price": str(
                        booking.service_price
                        if booking.service_price and booking.service_price > Decimal("0.00")
                        else (booking.total_amount or "0.00")
                    ),
                    "duration": booking.duration or "",
                }
            ]

        # Calculate accurate financial values
        services_sum = sum(
            (Decimal(str(item.get("price", "0.00"))) for item in services_data if isinstance(item, dict)),
            Decimal("0.00"),
        )

        # 1. Subtotal
        if booking.subtotal and booking.subtotal > Decimal("0.00"):
            subtot = Decimal(str(booking.subtotal))
        elif services_sum > Decimal("0.00"):
            subtot = services_sum
        elif booking.service_price and booking.service_price > Decimal("0.00"):
            subtot = Decimal(str(booking.service_price))
        elif booking.total_amount and booking.total_amount > Decimal("0.00"):
            subtot = Decimal(str(booking.total_amount))
        else:
            subtot = Decimal("0.00")

        discount_amt = Decimal(str(booking.discount_amount or "0.00"))
        tax_amt = Decimal(str(booking.tax_amount or "0.00"))

        # 2. Total payable amount
        if booking.total_amount and booking.total_amount > Decimal("0.00"):
            tot_amt = Decimal(str(booking.total_amount))
        else:
            calc_tot = subtot - discount_amt + tax_amt
            if calc_tot > Decimal("0.00"):
                tot_amt = calc_tot
            elif subtot > Decimal("0.00"):
                tot_amt = subtot
            elif booking.service_price and booking.service_price > Decimal("0.00"):
                tot_amt = Decimal(str(booking.service_price))
            else:
                tot_amt = Decimal("0.00")

        # 3. Amount paid
        paid_record = booking.payments.filter(payment_status="PAID").order_by("-created_at").first()
        paid_sum = booking.payments.filter(payment_status="PAID").aggregate(models.Sum("amount"))["amount__sum"]
        if paid_sum and paid_sum > Decimal("0.00"):
            amt_paid = max(paid_sum, tot_amt)
        elif tot_amt > Decimal("0.00"):
            amt_paid = tot_amt
        else:
            amt_paid = subtot

        # 4. Advance and Counter settlement amounts
        adv_amt = Decimal(str(booking.advance_amount or "0.00"))
        if adv_amt > Decimal("0.00"):
            rem_amt = max(Decimal("0.00"), tot_amt - adv_amt)
        else:
            rem_amt = Decimal("0.00")

        subtot = subtot.quantize(Decimal("0.01"))
        discount_amt = discount_amt.quantize(Decimal("0.01"))
        tax_amt = tax_amt.quantize(Decimal("0.01"))
        tot_amt = tot_amt.quantize(Decimal("0.01"))
        adv_amt = adv_amt.quantize(Decimal("0.01"))
        rem_amt = rem_amt.quantize(Decimal("0.01"))
        amt_paid = amt_paid.quantize(Decimal("0.01"))

        # Payment details
        pay_method_label = booking.get_payment_method_display()
        txn_id = booking.razorpay_payment_id or (paid_record.razorpay_payment_id if paid_record else "")
        if not txn_id and booking.payment_method == Booking.PaymentMethod.PAY_AT_SALON:
            txn_id = f"POS-CASH-{booking.id}"

        if paid_record and paid_record.paid_at:
            paid_at_time = paid_record.paid_at
        else:
            paid_at_time = booking.updated_at or timezone.now()

        # Specialist name (guaranteed non-null string)
        spec_name = ""
        if booking.worker:
            if booking.worker.user:
                spec_name = (
                    booking.worker.user.get_full_name()
                    or getattr(booking.worker.user, "email", "")
                    or f"Specialist #{booking.worker.id}"
                )
            else:
                spec_name = f"Specialist #{booking.worker.id}"
        spec_name = str(spec_name or "")

        year = timezone.now().year
        receipt_no = f"BMS-REC-{year}-{booking.id:05d}"

        # Salon address text
        salon_addr = salon.address or ""
        salon_pin = getattr(salon, "pincode", "") or getattr(salon, "zip_code", "") or ""
        if salon.city:
            salon_addr = f"{salon_addr}, {salon.city}" if salon_addr else salon.city
        if salon.state:
            salon_addr = f"{salon_addr}, {salon.state}" if salon_addr else salon.state
        if salon_pin:
            salon_addr = f"{salon_addr} - {salon_pin}"

        receipt = cls.objects.create(
            booking=booking,
            receipt_number=receipt_no,
            salon=salon,
            customer=customer,
            salon_name=salon.name,
            salon_address=salon_addr,
            salon_city=salon.city or "",
            salon_state=salon.state or "",
            salon_zip_code=salon_pin,
            salon_phone=salon.phone or "",
            salon_email=salon.email or (salon.owner.email if salon.owner else ""),
            salon_gst_number=getattr(salon, "gst_number", "") or "",
            customer_name=booking.client_name or (customer.get_full_name() if customer else "Customer"),
            customer_phone=booking.client_phone or getattr(customer, "phone_number", "") or "",
            customer_email=booking.client_email or (customer.email if customer else ""),
            specialist_name=spec_name,
            booking_date=booking.booking_date,
            booking_time=booking.booking_time,
            start_time=booking.start_time,
            end_time=booking.end_time,
            duration=booking.duration,
            station=booking.station,
            services_snapshot=services_data,
            subtotal=subtot,
            discount_amount=discount_amt,
            applied_offer_title=booking.applied_offer.title if booking.applied_offer else "",
            voucher_code=booking.voucher_code or "",
            tax_amount=tax_amt,
            total_amount=tot_amt,
            advance_amount=adv_amt,
            remaining_amount=rem_amt,
            amount_paid=amt_paid,
            payment_method=pay_method_label,
            payment_status=booking.get_payment_status_display(),
            transaction_id=txn_id,
            paid_at=paid_at_time,
            is_cancelled=(booking.status == Booking.Status.CANCELLED),
            is_refunded=(booking.payment_status == Booking.PaymentStatus.REFUNDED),
        )
        return receipt, True



# Re-export for backward compatibility
from reviews.models import SalonReview, WorkerReview

