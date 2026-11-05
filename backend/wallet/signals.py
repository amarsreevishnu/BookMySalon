from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import CustomerWallet


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def auto_create_customer_wallet(sender, instance, created, **kwargs):
    
    if created:
        role = getattr(instance, "role", None)
        if role == "CUSTOMER" or role is None:
            CustomerWallet.objects.get_or_create(user=instance)

