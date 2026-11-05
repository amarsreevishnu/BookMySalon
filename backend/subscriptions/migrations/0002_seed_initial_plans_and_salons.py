from decimal import Decimal
from django.db import migrations
from django.utils import timezone
from datetime import timedelta


def seed_subscription_data(apps, schema_editor):
    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
    SubscriptionSetting = apps.get_model("subscriptions", "SubscriptionSetting")
    SuperAdminWallet = apps.get_model("subscriptions", "SuperAdminWallet")
    SalonSubscription = apps.get_model("subscriptions", "SalonSubscription")
    SubscriptionHistory = apps.get_model("subscriptions", "SubscriptionHistory")
    Salon = apps.get_model("salons", "Salon")
    User = apps.get_model("accounts", "User")

    # 1. Seed Plans
    plans_data = [
        {
            "duration_key": "MONTHLY",
            "name": "Monthly Starter",
            "duration_months": 1,
            "price": Decimal("499.00"),
            "original_price": Decimal("699.00"),
            "badge_text": "Flexible",
            "description": "Essential salon operational tools with 0% booking commission for 30 days.",
            "features": [
                "Full access to online booking schedule",
                "0% platform booking commission",
                "Unlimited worker specialists and service catalog",
                "Customer reviews & ratings management",
                "Automated customer appointment reminders",
                "Platform Verified Salon badge",
            ],
            "display_order": 1,
        },
        {
            "duration_key": "HALF_YEARLY",
            "name": "Half-Yearly Growth",
            "duration_months": 6,
            "price": Decimal("2499.00"),
            "original_price": Decimal("2994.00"),
            "badge_text": "Most Popular",
            "description": "Save 17% with 6 months of uninterrupted salon access and premium exposure.",
            "features": [
                "All Monthly Starter features included",
                "Priority salon directory listing boost",
                "Dedicated salon marketing promo banners",
                "Advance sales analytics & worker payroll reporting",
                "0% commission on all client payments",
                "Dedicated customer support priority channel",
            ],
            "display_order": 2,
        },
        {
            "duration_key": "YEARLY",
            "name": "Yearly Enterprise",
            "duration_months": 12,
            "price": Decimal("4499.00"),
            "original_price": Decimal("5988.00"),
            "badge_text": "Best Value",
            "description": "Maximum savings of 25% with full year VIP salon partner privileges.",
            "features": [
                "All Half-Yearly Growth features included",
                "Featured partner showcase on BookMySalon explore",
                "Unlimited coupons & festive deal promotions",
                "Direct Super Admin relationship manager",
                "0% booking commission year-round",
                "Early access to new BookMySalon growth tools",
            ],
            "display_order": 3,
        },
    ]

    for p in plans_data:
        SubscriptionPlan.objects.update_or_create(
            duration_key=p["duration_key"],
            defaults=p,
        )

    # 2. Seed Settings
    SubscriptionSetting.objects.get_or_create(
        id=1,
        defaults={
            "default_trial_days": 30,
            "trial_reminder_days": [7, 3, 1],
        },
    )

    # 3. Seed Super Admin Wallet
    admin_user = User.objects.filter(role="ADMIN", is_staff=True).first()
    SuperAdminWallet.objects.get_or_create(
        id=1,
        defaults={
            "user": admin_user,
            "balance": Decimal("0.00"),
            "total_subscription_revenue": Decimal("0.00"),
            "total_payouts": Decimal("0.00"),
            "currency": "INR",
        },
    )

    # 4. Existing Salons: Mark as EXPIRED immediately (per confirmed requirement)
    now = timezone.now()
    past_start = now - timedelta(days=31)
    past_end = now - timedelta(days=1)

    for salon in Salon.objects.all():
        if not hasattr(salon, "subscription") or salon.subscription is None:
            sub = SalonSubscription.objects.create(
                salon=salon,
                plan=None,
                subscription_type="TRIAL",
                status="EXPIRED",
                start_date=past_start,
                end_date=past_end,
                has_used_free_trial=True,
                reminder_sent_intervals=[7, 3, 1],
            )
            SubscriptionHistory.objects.create(
                salon=salon,
                action="EXPIRED",
                start_date=past_start,
                end_date=past_end,
                amount_paid=Decimal("0.00"),
                notes="Initialized as expired per subscription policy rollout. Owner must subscribe to accept bookings.",
            )


def rollback_subscription_data(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("subscriptions", "0001_initial"),
        ("salons", "0001_initial"),
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_subscription_data, rollback_subscription_data),
    ]

