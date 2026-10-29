import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from bookings.models import Booking
from .models import Payment

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Booking)
def sync_booking_to_payment(sender, instance, created, **kwargs):
    try:
        effective_amount = instance.total_amount if instance.total_amount is not None else (instance.service_price or 0.00)
        existing_payment = Payment.objects.filter(booking=instance).order_by('-created_at').first()
        if not existing_payment:
            payment = Payment.objects.create(
                booking=instance,
                customer=instance.customer,
                salon=instance.salon,
                amount=effective_amount,
                payment_method=instance.payment_method or Payment.PaymentMethod.PAY_AT_SALON,
                payment_status=instance.payment_status or Payment.PaymentStatus.PENDING,
                razorpay_order_id=instance.razorpay_order_id or '',
                razorpay_payment_id=instance.razorpay_payment_id or '',
                notes=instance.notes or '',
            )
        else:
            payment = existing_payment
            updated_fields = []
            if payment.customer != instance.customer:
                payment.customer = instance.customer
                updated_fields.append('customer')
            if payment.salon != instance.salon:
                payment.salon = instance.salon
                updated_fields.append('salon')
            if payment.payment_type == Payment.PaymentType.FULL and payment.amount != effective_amount:
                payment.amount = effective_amount
                updated_fields.append('amount')
            if instance.payment_method and payment.payment_method != instance.payment_method:
                payment.payment_method = instance.payment_method
                updated_fields.append('payment_method')
            if (
                payment.payment_status != Payment.PaymentStatus.PAID
                and instance.payment_status
                and payment.payment_status != instance.payment_status
            ):
                if instance.payment_status in [Payment.PaymentStatus.PAID, Payment.PaymentStatus.REFUNDED, Payment.PaymentStatus.FAILED]:
                    payment.payment_status = instance.payment_status
                    updated_fields.append('payment_status')
            if instance.razorpay_order_id and payment.razorpay_order_id != instance.razorpay_order_id:
                payment.razorpay_order_id = instance.razorpay_order_id
                updated_fields.append('razorpay_order_id')
            if instance.razorpay_payment_id and payment.razorpay_payment_id != instance.razorpay_payment_id:
                payment.razorpay_payment_id = instance.razorpay_payment_id
                updated_fields.append('razorpay_payment_id')
            if updated_fields:
                updated_fields.append('updated_at')
                payment.save(update_fields=updated_fields)
    except Exception as e:
        logger.warning("Failed to sync booking to payment: %s", e)

