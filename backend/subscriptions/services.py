import hmac
import hashlib
import logging
import sys
import uuid
import requests
from datetime import timedelta
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import (
    SubscriptionPlan,
    SubscriptionSetting,
    SalonSubscription,
    SubscriptionPayment,
    SubscriptionHistory,
    SuperAdminWallet,
    SuperAdminWalletTransaction,
    generate_subscription_receipt,
)
from notifications.models import Notification
from notifications.services import create_notification

logger = logging.getLogger(__name__)


def get_razorpay_credentials():
    """Returns Razorpay API credentials."""
    key_id = getattr(settings, "RAZORPAY_KEY_ID", "rzp_test_TOiPL6fBLGzhAD")
    key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "v30VNXxs9ndbc3nbiltGgCce")
    return key_id, key_secret


def activate_trial_for_salon(salon, trial_days=None):
    """
    Activates a 30-day (or configured) free trial for a newly approved salon.
    Enforces rule: Free trial is only available once per salon.
    """
    if not salon:
        return None

    settings_obj = SubscriptionSetting.get_settings()
    duration_days = trial_days or settings_obj.default_trial_days or 30

    existing_sub = getattr(salon, "subscription", None)
    if existing_sub:
        if existing_sub.has_used_free_trial:
            logger.info(f"Salon {salon.id} ({salon.name}) has already used their free trial. Skipping trial activation.")
            return existing_sub

    now = timezone.now()
    start_date = now
    end_date = now + timedelta(days=duration_days)

    with transaction.atomic():
        if existing_sub:
            existing_sub.subscription_type = SalonSubscription.SubscriptionType.TRIAL
            existing_sub.status = SalonSubscription.Status.TRIAL
            existing_sub.start_date = start_date
            existing_sub.end_date = end_date
            existing_sub.has_used_free_trial = True
            existing_sub.plan = None
            existing_sub.reminder_sent_intervals = []
            existing_sub.save()
            sub = existing_sub
        else:
            sub = SalonSubscription.objects.create(
                salon=salon,
                plan=None,
                subscription_type=SalonSubscription.SubscriptionType.TRIAL,
                status=SalonSubscription.Status.TRIAL,
                start_date=start_date,
                end_date=end_date,
                has_used_free_trial=True,
                reminder_sent_intervals=[],
            )

        SubscriptionHistory.objects.create(
            salon=salon,
            plan=None,
            action=SubscriptionHistory.Action.TRIAL_ACTIVATED,
            start_date=start_date,
            end_date=end_date,
            amount_paid=Decimal("0.00"),
            notes=f"30-day Free Trial activated upon salon verification & approval. Valid until {end_date.strftime('%b %d, %Y')}.",
        )

    # In-app notification for owner
    if salon.owner:
        create_notification(
            recipient=salon.owner,
            notification_type=Notification.NotificationType.SUBSCRIPTION_ACTIVATED,
            title="Free Trial Activated! (30 Days)",
            message=f"Welcome to BookMySalon! Your 30-day free trial for {salon.name} is now active with 0% booking commission.",
            data={
                "salon_id": salon.id,
                "trial_days": duration_days,
                "end_date": end_date.strftime("%Y-%m-%d"),
                "link": "/owner/subscription",
            },
        )

    # Email notification to owner
    send_trial_activated_email(salon, sub, duration_days)

    return sub


def create_subscription_razorpay_order(salon, plan_id, owner_user):
    """
    Creates a dedicated Razorpay order for purchasing a salon subscription plan.
    Decoupled from booking payments.
    """
    try:
        plan = SubscriptionPlan.objects.get(pk=plan_id, is_active=True)
    except SubscriptionPlan.DoesNotExist:
        raise ValidationError("Selected subscription plan does not exist or is inactive.")

    amount_paise = int(plan.price * 100)
    if amount_paise <= 0:
        raise ValidationError("Invalid plan price for payment.")

    receipt = generate_subscription_receipt()
    key_id, key_secret = get_razorpay_credentials()

    order_payload = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 1,
        "notes": {
            "type": "SALON_SUBSCRIPTION",
            "salon_id": str(salon.id),
            "salon_name": salon.name,
            "plan_id": str(plan.id),
            "plan_key": plan.duration_key,
            "owner_email": owner_user.email if owner_user else "",
        },
    }

    order_id = None
    is_test_or_debug = "test" in sys.argv or getattr(settings, "TESTING", False) or settings.DEBUG

    try:
        rzp_res = requests.post(
            "https://api.razorpay.com/v1/orders",
            auth=(key_id, key_secret),
            json=order_payload,
            timeout=10,
        )
        if rzp_res.status_code in [200, 201]:
            order_data = rzp_res.json()
            order_id = order_data.get("id")
        else:
            logger.error("Razorpay order creation error (%s): %s", rzp_res.status_code, rzp_res.text)
            if is_test_or_debug:
                order_id = f"order_mock_{uuid.uuid4().hex[:14]}"
            else:
                raise ValidationError("Unable to initiate Razorpay order. Please try again.")
    except requests.RequestException as req_err:
        logger.error("Network error communicating with Razorpay: %s", req_err)
        if is_test_or_debug:
            order_id = f"order_mock_{uuid.uuid4().hex[:14]}"
        else:
            raise ValidationError("Payment gateway connection failed. Please check your internet connection.")

    if not order_id:
        raise ValidationError("Failed to generate payment order reference.")

    payment = SubscriptionPayment.objects.create(
        salon=salon,
        owner=owner_user,
        plan=plan,
        amount=plan.price,
        currency="INR",
        razorpay_order_id=order_id,
        status=SubscriptionPayment.Status.PENDING,
        receipt_number=receipt,
    )

    return {
        "order_id": order_id,
        "amount": float(plan.price),
        "amount_paise": amount_paise,
        "currency": "INR",
        "key_id": getattr(settings, "RAZORPAY_KEY_ID", "rzp_test_TOiPL6fBLGzhAD"),
        "receipt": receipt,
        "payment_id": payment.payment_id,
        "plan": {
            "id": plan.id,
            "name": plan.name,
            "duration_months": plan.duration_months,
            "price": str(plan.price),
        },
    }


def verify_and_activate_subscription(salon, razorpay_order_id, razorpay_payment_id, razorpay_signature):
    """
    Verifies Razorpay payment signature, updates payment status, credits Super Admin Wallet,
    and activates or renews the salon's subscription according to early renewal logic.
    """
    payment = SubscriptionPayment.objects.filter(
        razorpay_order_id=razorpay_order_id,
        salon=salon,
    ).first()

    if not payment:
        raise ValidationError("Subscription payment order not found.")

    if payment.status == SubscriptionPayment.Status.SUCCESS:
        return getattr(salon, "subscription", None), payment

    key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "v30VNXxs9ndbc3nbiltGgCce")
    generated_signature = hmac.new(
        key_secret.encode("utf-8"),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(generated_signature, razorpay_signature):
        payment.status = SubscriptionPayment.Status.FAILED
        payment.error_message = "Razorpay payment signature mismatch."
        payment.save(update_fields=["status", "error_message", "updated_at"])
        raise ValidationError("Payment verification failed. Invalid digital signature.")

    plan = payment.plan
    if not plan:
        raise ValidationError("Subscription plan associated with payment could not be resolved.")

    now = timezone.now()
    plan_days = plan.duration_months * 30  # Standardized 30 days per month

    with transaction.atomic():
        payment.status = SubscriptionPayment.Status.SUCCESS
        payment.razorpay_payment_id = razorpay_payment_id
        payment.razorpay_signature = razorpay_signature
        payment.save(update_fields=["status", "razorpay_payment_id", "razorpay_signature", "updated_at"])

        # 1. Credit Super Admin Platform Wallet
        admin_wallet = SuperAdminWallet.objects.select_for_update().first()
        if not admin_wallet:
            admin_wallet = SuperAdminWallet.get_wallet()
            admin_wallet = SuperAdminWallet.objects.select_for_update().get(id=admin_wallet.id)

        bal_before = admin_wallet.balance
        bal_after = bal_before + payment.amount
        admin_wallet.balance = bal_after
        admin_wallet.total_subscription_revenue += payment.amount
        admin_wallet.save(update_fields=["balance", "total_subscription_revenue", "updated_at"])

        SuperAdminWalletTransaction.objects.create(
            wallet=admin_wallet,
            transaction_type=SuperAdminWalletTransaction.TransactionType.SUBSCRIPTION_CREDIT,
            amount=payment.amount,
            balance_before=bal_before,
            balance_after=bal_after,
            salon=salon,
            payment=payment,
            plan_name=plan.name,
            reason=f"100% Subscription revenue for {plan.name} from {salon.name} (Receipt: {payment.receipt_number})",
        )

        # 2. Early Renewal Logic:
        # If currently active, new plan duration is appended to current end_date!
        current_sub = getattr(salon, "subscription", None)
        is_early_renewal = (
            current_sub is not None
            and current_sub.status in [SalonSubscription.Status.TRIAL, SalonSubscription.Status.ACTIVE]
            and current_sub.end_date > now
        )

        if is_early_renewal:
            new_start_date = current_sub.end_date
            new_end_date = new_start_date + timedelta(days=plan_days)
            action = SubscriptionHistory.Action.RENEWED
            note = f"Early renewal: {plan.name} appended to current period. Valid from {new_start_date.strftime('%b %d, %Y')} to {new_end_date.strftime('%b %d, %Y')}."
        else:
            new_start_date = now
            new_end_date = now + timedelta(days=plan_days)
            action = SubscriptionHistory.Action.PAID_ACTIVATED
            note = f"Subscription activated: {plan.name}. Valid until {new_end_date.strftime('%b %d, %Y')}."

        if current_sub:
            current_sub.plan = plan
            current_sub.subscription_type = SalonSubscription.SubscriptionType.PAID
            current_sub.status = SalonSubscription.Status.ACTIVE
            if not is_early_renewal:
                current_sub.start_date = new_start_date
            current_sub.end_date = new_end_date
            current_sub.reminder_sent_intervals = []
            current_sub.save()
            sub = current_sub
        else:
            sub = SalonSubscription.objects.create(
                salon=salon,
                plan=plan,
                subscription_type=SalonSubscription.SubscriptionType.PAID,
                status=SalonSubscription.Status.ACTIVE,
                start_date=new_start_date,
                end_date=new_end_date,
                reminder_sent_intervals=[],
            )

        SubscriptionHistory.objects.create(
            salon=salon,
            plan=plan,
            action=action,
            start_date=new_start_date,
            end_date=new_end_date,
            amount_paid=payment.amount,
            payment=payment,
            notes=note,
        )

    # In-app notification for owner
    if salon.owner:
        create_notification(
            recipient=salon.owner,
            notification_type=Notification.NotificationType.SUBSCRIPTION_ACTIVATED,
            title=f"Subscription Activated: {plan.name}",
            message=f"Thank you for your payment of ₹{payment.amount}! Your {plan.name} subscription is active until {new_end_date.strftime('%b %d, %Y')}.",
            data={
                "salon_id": salon.id,
                "plan_name": plan.name,
                "amount": str(payment.amount),
                "end_date": new_end_date.strftime("%Y-%m-%d"),
                "receipt": payment.receipt_number,
                "link": "/owner/subscription",
            },
        )

    # Email confirmation
    send_subscription_activated_email(salon, sub, payment)

    return sub, payment


def admin_manually_extend_subscription(salon, extra_days, reason="", admin_user=None):
    """
    Allows Super Admin to grant complimentary duration to a salon's subscription.
    """
    if extra_days <= 0:
        raise ValidationError("Extension duration must be a positive number of days.")

    now = timezone.now()
    sub = getattr(salon, "subscription", None)

    with transaction.atomic():
        if sub and sub.is_currently_active:
            sub.end_date = sub.end_date + timedelta(days=extra_days)
            sub.save(update_fields=["end_date", "updated_at"])
            start_ref = sub.start_date
            end_ref = sub.end_date
        elif sub:
            sub.status = SalonSubscription.Status.ACTIVE
            sub.start_date = now
            sub.end_date = now + timedelta(days=extra_days)
            sub.reminder_sent_intervals = []
            sub.save(update_fields=["status", "start_date", "end_date", "reminder_sent_intervals", "updated_at"])
            start_ref = sub.start_date
            end_ref = sub.end_date
        else:
            sub = SalonSubscription.objects.create(
                salon=salon,
                subscription_type=SalonSubscription.SubscriptionType.PAID,
                status=SalonSubscription.Status.ACTIVE,
                start_date=now,
                end_date=now + timedelta(days=extra_days),
                has_used_free_trial=True,
            )
            start_ref = now
            end_ref = now + timedelta(days=extra_days)

        admin_email = admin_user.email if admin_user else "Super Admin"
        SubscriptionHistory.objects.create(
            salon=salon,
            plan=sub.plan,
            action=SubscriptionHistory.Action.EXTENDED_BY_ADMIN,
            start_date=start_ref,
            end_date=end_ref,
            amount_paid=Decimal("0.00"),
            notes=f"Manually extended by {admin_email} for +{extra_days} days. Reason: {reason or 'Admin courtesy'}.",
        )

    # Notify owner
    if salon.owner:
        create_notification(
            recipient=salon.owner,
            notification_type=Notification.NotificationType.SUBSCRIPTION_ACTIVATED,
            title="Subscription Extended by Admin",
            message=f"Good news! Super Admin has granted an additional {extra_days} days to {salon.name}. Valid until {end_ref.strftime('%b %d, %Y')}.",
            data={
                "salon_id": salon.id,
                "extra_days": extra_days,
                "end_date": end_ref.strftime("%Y-%m-%d"),
                "reason": reason,
                "link": "/owner/subscription",
            },
        )

    return sub


def check_and_send_subscription_reminders():
    """
    Daily audit task to:
    1. Mark expired subscriptions as EXPIRED.
    2. Dispatch notifications and emails 7 days, 3 days, and 1 day before expiry.
    """
    now = timezone.now()
    today = timezone.localdate()

    # 1. Update expired subscriptions
    expired_subs = SalonSubscription.objects.filter(
        status__in=[SalonSubscription.Status.TRIAL, SalonSubscription.Status.ACTIVE],
        end_date__lt=now,
    ).select_related("salon", "salon__owner", "plan")

    for sub in expired_subs:
        sub.status = SalonSubscription.Status.EXPIRED
        sub.save(update_fields=["status", "updated_at"])

        SubscriptionHistory.objects.create(
            salon=sub.salon,
            plan=sub.plan,
            action=SubscriptionHistory.Action.EXPIRED,
            start_date=sub.start_date,
            end_date=sub.end_date,
            amount_paid=Decimal("0.00"),
            notes="Subscription period ended. New customer bookings are restricted until renewal.",
        )

        if sub.salon.owner:
            create_notification(
                recipient=sub.salon.owner,
                notification_type=Notification.NotificationType.SUBSCRIPTION_EXPIRED,
                title="Salon Subscription Expired",
                message=f"Your subscription for {sub.salon.name} has expired. New customer bookings are currently disabled. Please renew now to restore instant booking access.",
                data={"salon_id": sub.salon.id, "link": "/owner/subscription"},
            )
            send_subscription_expired_email(sub.salon, sub)

    # 2. Send reminders for upcoming expirations (7, 3, 1 days)
    settings_obj = SubscriptionSetting.get_settings()
    reminder_days_list = settings_obj.trial_reminder_days or [7, 3, 1]

    active_subs = SalonSubscription.objects.filter(
        status__in=[SalonSubscription.Status.TRIAL, SalonSubscription.Status.ACTIVE],
        end_date__gte=now,
    ).select_related("salon", "salon__owner", "plan")

    for sub in active_subs:
        days_left = sub.days_remaining
        for target_day in reminder_days_list:
            if days_left == target_day:
                sent_intervals = sub.reminder_sent_intervals or []
                if target_day not in sent_intervals:
                    # Dispatch reminder
                    if sub.salon.owner:
                        sub_type_name = "Free Trial" if sub.subscription_type == SalonSubscription.SubscriptionType.TRIAL else "Subscription"
                        create_notification(
                            recipient=sub.salon.owner,
                            notification_type=Notification.NotificationType.SUBSCRIPTION_TRIAL_EXPIRING,
                            title=f"{sub_type_name} Expiring in {days_left} {'Day' if days_left == 1 else 'Days'}",
                            message=f"Reminder: Your {sub_type_name.lower()} for {sub.salon.name} expires on {sub.end_date.strftime('%b %d, %Y')}. Select a plan to ensure uninterrupted customer bookings.",
                            data={
                                "salon_id": sub.salon.id,
                                "days_left": days_left,
                                "end_date": sub.end_date.strftime("%Y-%m-%d"),
                                "link": "/owner/subscription",
                            },
                        )
                        send_subscription_reminder_email(sub.salon, sub, days_left)

                    sent_intervals.append(target_day)
                    sub.reminder_sent_intervals = sent_intervals
                    sub.last_reminder_date = today
                    sub.save(update_fields=["reminder_sent_intervals", "last_reminder_date", "updated_at"])


# ---------------------------------------------------------------------------
# Beautiful HTML Email Templates
# ---------------------------------------------------------------------------

def send_trial_activated_email(salon, subscription, days=30):
    recipient = salon.owner.email if salon.owner else salon.email
    if not recipient:
        return False

    subject = f"Your {days}-Day Free Trial is Active! – BookMySalon"
    end_date_str = subscription.end_date.strftime("%B %d, %Y")
    login_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/owner/dashboard"

    plain = (
        f"Welcome to BookMySalon! Your salon {salon.name} has been approved with a complimentary {days}-day free trial.\n"
        f"Trial Expiry: {end_date_str}\n"
        f"Enjoy 100% booking commission-free operations. Log in to your dashboard: {login_url}"
    )

    html = f"""<!DOCTYPE html>
<html>
<head>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f7f5; margin: 0; padding: 24px; color: #233428; }}
    .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #dbe6de; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
    .badge {{ display: inline-block; padding: 6px 14px; background: #eaf5ee; color: #1e5e34; font-size: 12px; font-weight: 700; border-radius: 20px; text-transform: uppercase; margin-bottom: 16px; }}
    .title {{ font-size: 24px; font-weight: 700; color: #163622; margin-top: 0; margin-bottom: 12px; }}
    .text {{ font-size: 14px; line-height: 1.6; color: #435b4b; margin-bottom: 20px; }}
    .trial-box {{ background: #f7faf8; border: 1.5px dashed #2d5a3d; border-radius: 10px; padding: 20px; margin: 24px 0; }}
    .row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }}
    .label {{ color: #5a7362; font-weight: 600; }}
    .val {{ font-weight: 700; color: #153320; }}
    .btn {{ display: block; text-align: center; background: #234d34; color: #ffffff !important; padding: 14px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; margin-top: 24px; }}
    .footer {{ margin-top: 30px; border-top: 1px solid #e7ede8; padding-top: 16px; font-size: 11px; color: #829588; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">🎉 Welcome to the Partner Network</span>
    <h1 class="title">30-Day Free Trial Activated</h1>
    <p class="text">
      Congratulations! <strong>{salon.name}</strong> is now verified and live on BookMySalon. As a newly approved partner, you get <strong>30 days of free, full-featured access</strong> with zero booking commission.
    </p>
    <div class="trial-box">
      <div class="row"><span class="label">Salon Partner:</span> <span class="val">{salon.name}</span></div>
      <div class="row"><span class="label">Access Level:</span> <span class="val">Full Premium Access (0% Commission)</span></div>
      <div class="row"><span class="label">Trial Duration:</span> <span class="val">{days} Days</span></div>
      <div class="row" style="margin-bottom: 0;"><span class="label">Trial Expiration:</span> <span class="val" style="color: #275d3c;">{end_date_str}</span></div>
    </div>
    <a href="{login_url}" target="_blank" rel="noopener noreferrer" class="btn">Go to Your Salon Dashboard &rarr;</a>
    <div class="footer">
      BookMySalon &bull; Premium Salon Booking Platform &bull; Need support? Contact admin@bookmysalon.com
    </div>
  </div>
</body>
</html>"""

    try:
        send_mail(subject, plain, settings.DEFAULT_FROM_EMAIL, [recipient], html_message=html, fail_silently=True)
        return True
    except Exception as e:
        logger.error(f"Failed to send trial activated email to {recipient}: {e}")
        return False


def send_subscription_activated_email(salon, subscription, payment):
    recipient = salon.owner.email if salon.owner else salon.email
    if not recipient:
        return False

    plan_name = subscription.plan.name if subscription.plan else "Paid Plan"
    subject = f"Subscription Confirmed: {plan_name} – BookMySalon"
    end_date_str = subscription.end_date.strftime("%B %d, %Y")
    receipt_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/owner/subscription"

    plain = (
        f"Thank you for subscribing to BookMySalon!\n"
        f"Salon: {salon.name}\n"
        f"Plan: {plan_name}\n"
        f"Amount: ₹{payment.amount}\n"
        f"Receipt Number: {payment.receipt_number}\n"
        f"Valid Until: {end_date_str}\n"
        f"Manage your subscription: {receipt_url}"
    )

    html = f"""<!DOCTYPE html>
<html>
<head>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f7f5; margin: 0; padding: 24px; color: #233428; }}
    .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #dbe6de; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
    .badge {{ display: inline-block; padding: 6px 14px; background: #eaf5ee; color: #1e5e34; font-size: 12px; font-weight: 700; border-radius: 20px; text-transform: uppercase; margin-bottom: 16px; }}
    .title {{ font-size: 24px; font-weight: 700; color: #163622; margin-top: 0; margin-bottom: 12px; }}
    .text {{ font-size: 14px; line-height: 1.6; color: #435b4b; margin-bottom: 20px; }}
    .invoice-box {{ background: #f7faf8; border: 1.5px solid #2d5a3d; border-radius: 10px; padding: 20px; margin: 24px 0; }}
    .row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }}
    .label {{ color: #5a7362; font-weight: 600; }}
    .val {{ font-weight: 700; color: #153320; }}
    .btn {{ display: block; text-align: center; background: #234d34; color: #ffffff !important; padding: 14px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; margin-top: 24px; }}
    .footer {{ margin-top: 30px; border-top: 1px solid #e7ede8; padding-top: 16px; font-size: 11px; color: #829588; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Payment Successful</span>
    <h1 class="title">Subscription Activated!</h1>
    <p class="text">
      We have received your payment of <strong>₹{payment.amount}</strong>. Your subscription has been activated with uninterrupted booking reception and 100% zero commission.
    </p>
    <div class="invoice-box">
      <div class="row"><span class="label">Invoice Receipt:</span> <span class="val">{payment.receipt_number}</span></div>
      <div class="row"><span class="label">Salon:</span> <span class="val">{salon.name}</span></div>
      <div class="row"><span class="label">Plan:</span> <span class="val">{plan_name}</span></div>
      <div class="row"><span class="label">Amount Paid:</span> <span class="val">₹{payment.amount} INR</span></div>
      <div class="row"><span class="label">Payment ID:</span> <span class="val" style="font-family: monospace;">{payment.razorpay_payment_id or 'Online'}</span></div>
      <div class="row" style="margin-bottom: 0;"><span class="label">Active Until:</span> <span class="val" style="color: #275d3c;">{end_date_str}</span></div>
    </div>
    <a href="{receipt_url}" target="_blank" rel="noopener noreferrer" class="btn">View Invoices & Billing Details &rarr;</a>
    <div class="footer">
      BookMySalon &bull; Verified Partner Network &bull; Need support? Contact admin@bookmysalon.com
    </div>
  </div>
</body>
</html>"""

    try:
        send_mail(subject, plain, settings.DEFAULT_FROM_EMAIL, [recipient], html_message=html, fail_silently=True)
        return True
    except Exception as e:
        logger.error(f"Failed to send subscription activated email to {recipient}: {e}")
        return False


def send_subscription_reminder_email(salon, subscription, days_left):
    recipient = salon.owner.email if salon.owner else salon.email
    if not recipient:
        return False

    sub_type_name = "Free Trial" if subscription.subscription_type == SalonSubscription.SubscriptionType.TRIAL else "Subscription"
    subject = f"Reminder: Your BookMySalon {sub_type_name} expires in {days_left} {'day' if days_left == 1 else 'days'}"
    end_date_str = subscription.end_date.strftime("%B %d, %Y")
    renew_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/owner/subscription"

    plain = (
        f"Notice: Your BookMySalon {sub_type_name.lower()} for {salon.name} will expire in {days_left} days on {end_date_str}.\n"
        f"To avoid booking interruptions and keep receiving client appointments, please renew your subscription:\n"
        f"{renew_url}"
    )

    html = f"""<!DOCTYPE html>
<html>
<head>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f7f5; margin: 0; padding: 24px; color: #233428; }}
    .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #dbe6de; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
    .badge {{ display: inline-block; padding: 6px 14px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; border-radius: 20px; text-transform: uppercase; margin-bottom: 16px; }}
    .title {{ font-size: 24px; font-weight: 700; color: #163622; margin-top: 0; margin-bottom: 12px; }}
    .text {{ font-size: 14px; line-height: 1.6; color: #435b4b; margin-bottom: 20px; }}
    .alert-box {{ background: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 10px; padding: 20px; margin: 24px 0; }}
    .row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }}
    .label {{ color: #78350f; font-weight: 600; }}
    .val {{ font-weight: 700; color: #451a03; }}
    .btn {{ display: block; text-align: center; background: #234d34; color: #ffffff !important; padding: 14px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; margin-top: 24px; }}
    .footer {{ margin-top: 30px; border-top: 1px solid #e7ede8; padding-top: 16px; font-size: 11px; color: #829588; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Action Required &bull; Expiring Soon</span>
    <h1 class="title">{sub_type_name} Expires in {days_left} {'Day' if days_left == 1 else 'Days'}</h1>
    <p class="text">
      This is a friendly reminder that the active <strong>{sub_type_name.lower()}</strong> for <strong>{salon.name}</strong> will conclude on <strong>{end_date_str}</strong>.
    </p>
    <div class="alert-box">
      <div class="row"><span class="label">Salon:</span> <span class="val">{salon.name}</span></div>
      <div class="row"><span class="label">Current Status:</span> <span class="val">Expiring in {days_left} {'day' if days_left == 1 else 'days'}</span></div>
      <div class="row" style="margin-bottom: 0;"><span class="label">Expiration Date:</span> <span class="val">{end_date_str}</span></div>
    </div>
    <p class="text" style="font-size: 13px;">
      💡 <em>Renewing before expiry will seamlessly add your new plan duration starting from your current expiration date, without losing any remaining days.</em>
    </p>
    <a href="{renew_url}" target="_blank" rel="noopener noreferrer" class="btn">Select a Plan & Renew Now &rarr;</a>
    <div class="footer">
      BookMySalon &bull; Partner Network &bull; Need support? Contact admin@bookmysalon.com
    </div>
  </div>
</body>
</html>"""

    try:
        send_mail(subject, plain, settings.DEFAULT_FROM_EMAIL, [recipient], html_message=html, fail_silently=True)
        return True
    except Exception as e:
        logger.error(f"Failed to send reminder email to {recipient}: {e}")
        return False


def send_subscription_expired_email(salon, subscription):
    recipient = salon.owner.email if salon.owner else salon.email
    if not recipient:
        return False

    subject = f"Your BookMySalon Subscription Has Expired – {salon.name}"
    renew_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')}/owner/subscription"

    plain = (
        f"Important Notice: Your BookMySalon subscription for {salon.name} has expired.\n"
        f"Your salon is currently unable to accept new appointments from customers.\n"
        f"You can still log in, review previous appointments, and restore booking access anytime by purchasing a subscription:\n"
        f"{renew_url}"
    )

    html = f"""<!DOCTYPE html>
<html>
<head>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f7f5; margin: 0; padding: 24px; color: #233428; }}
    .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #dbe6de; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
    .badge {{ display: inline-block; padding: 6px 14px; background: #fee2e2; color: #991b1b; font-size: 12px; font-weight: 700; border-radius: 20px; text-transform: uppercase; margin-bottom: 16px; }}
    .title {{ font-size: 24px; font-weight: 700; color: #991b1b; margin-top: 0; margin-bottom: 12px; }}
    .text {{ font-size: 14px; line-height: 1.6; color: #435b4b; margin-bottom: 20px; }}
    .box {{ background: #fef2f2; border: 1.5px solid #ef4444; border-radius: 10px; padding: 20px; margin: 24px 0; font-size: 13px; color: #7f1d1d; }}
    .btn {{ display: block; text-align: center; background: #234d34; color: #ffffff !important; padding: 14px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; margin-top: 24px; }}
    .footer {{ margin-top: 30px; border-top: 1px solid #e7ede8; padding-top: 16px; font-size: 11px; color: #829588; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Bookings Temporarily Restricted</span>
    <h1 class="title">Subscription Expired</h1>
    <p class="text">
      The subscription period for <strong>{salon.name}</strong> has ended. While your salon is expired, clients will not be able to book new appointments with your salon.
    </p>
    <div class="box">
      <strong>What this means:</strong>
      <ul style="margin: 8px 0 0 16px; padding: 0;">
        <li>Existing bookings and appointment history remain safely accessible.</li>
        <li>New appointments are paused until subscription reactivation.</li>
        <li>Your staff accounts, services, and schedules are completely preserved.</li>
      </ul>
    </div>
    <a href="{renew_url}" target="_blank" rel="noopener noreferrer" class="btn">Restore Booking Reception & Renew Now &rarr;</a>
    <div class="footer">
      BookMySalon &bull; Partner Network &bull; Need support? Contact admin@bookmysalon.com
    </div>
  </div>
</body>
</html>"""

    try:
        send_mail(subject, plain, settings.DEFAULT_FROM_EMAIL, [recipient], html_message=html, fail_silently=True)
        return True
    except Exception as e:
        logger.error(f"Failed to send expired email to {recipient}: {e}")
        return False
