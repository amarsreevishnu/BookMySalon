import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from bookings.models import Booking
from .models import Payment

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Booking)
def sync_booking_to_payment(sender, instance, created, **kwargs):
    
    try:
        payment, was_created = Payment.objects.get_or_create(
            booking=instance,
            defaults={
                'customer': instance.customer,
                'salon': instance.salon,
                'amount': instance.service_price or 0.00,
                'payment_method': instance.payment_method or Payment.PaymentMethod.PAY_AT_SALON,
                'payment_status': instance.payment_status or Payment.PaymentStatus.PENDING,
                'razorpay_order_id': instance.razorpay_order_id or '',
                'razorpay_payment_id': instance.razorpay_payment_id or '',
                'notes': instance.notes or '',
            }
        )
        if not was_created:
            updated_fields = []
            if payment.customer != instance.customer:
                payment.customer = instance.customer
                updated_fields.append('customer')
            if payment.salon != instance.salon:
                payment.salon = instance.salon
                updated_fields.append('salon')
            if payment.amount != (instance.service_price or 0.00):
                payment.amount = instance.service_price or 0.00
                updated_fields.append('amount')
            if instance.payment_method and payment.payment_method != instance.payment_method:
                payment.payment_method = instance.payment_method
                updated_fields.append('payment_method')
            if instance.payment_status and payment.payment_status != instance.payment_status:
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

