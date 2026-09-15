from django.db import models

# Create your models here.
from django.conf import settings
from django.db import models


class Salon(models.Model):
    class ApprovalStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="salons",
        limit_choices_to={"role": "OWNER"},
    )

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)

    address = models.TextField()
    city = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)

    approval_status = models.CharField(
        max_length=20,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name