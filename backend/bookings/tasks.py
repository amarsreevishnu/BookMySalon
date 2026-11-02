import logging
from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from .models import Booking

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def send_booking_confirmation_email_task(self, booking_id):
    """
    Asynchronously builds and delivers a professional HTML/text booking confirmation email
    to the customer upon successful appointment confirmation or payment.
    """
    try:
        booking = (
            Booking.objects
            .select_related("salon", "customer", "worker", "worker__user")
            .prefetch_related("services")
            .get(id=booking_id)
        )
    except Booking.DoesNotExist:
        logger.warning("Booking #%s not found for confirmation email.", booking_id)
        return False

    recipient_email = booking.client_email or (booking.customer.email if booking.customer else "")
    if not recipient_email:
        logger.warning("No recipient email found for booking #%s.", booking_id)
        return False

    client_name = booking.client_name or (booking.customer.get_full_name() if booking.customer else "Valued Client")
    salon_name = booking.salon.name if booking.salon else "BookMySalon Partner"
    salon_address = f"{booking.salon.address}, {booking.salon.city}" if booking.salon else "Salon Location"

    # Stylist
    stylist_name = "Any Available Stylist"
    if booking.worker and booking.worker.user:
        stylist_name = booking.worker.user.get_full_name() or booking.worker.user.email.split("@")[0].title()

    # Services
    services_list = list(booking.services.all())
    if services_list:
        services_text = ", ".join([s.effective_name for s in services_list])
    else:
        services_text = booking.service_name or "Salon Service"

    # Date & Time
    date_formatted = booking.booking_date.strftime("%A, %B %d, %Y") if booking.booking_date else "Scheduled Date"
    time_val = booking.booking_time or (booking.start_time.strftime("%I:%M %p") if booking.start_time else "Scheduled Time")

    # Payment & pricing
    total = float(booking.total_amount if (booking.total_amount and booking.total_amount > 0) else (booking.service_price or 0))
    pay_mode = "Pay at Salon" if booking.payment_method == Booking.PaymentMethod.PAY_AT_SALON else "Online Payment"
    pay_status = "Paid" if booking.payment_status == Booking.PaymentStatus.PAID else "Pending at Counter"

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon <noreply@bookmysalon.com>")
    subject = f"Booking Confirmed: {booking.service_name or 'Appointment'} at {salon_name} (#{booking.id})"

    plain_message = (
        f"Hello {client_name},\n\n"
        f"Your salon appointment has been successfully confirmed!\n\n"
        f"Booking Summary:\n"
        f"• Booking ID: #{booking.id}\n"
        f"• Salon: {salon_name}\n"
        f"• Location: {salon_address}\n"
        f"• Service: {services_text}\n"
        f"• Stylist: {stylist_name}\n"
        f"• Date: {date_formatted}\n"
        f"• Time: {time_val}\n"
        f"• Duration: {booking.duration or '45 mins'}\n"
        f"• Total Amount: ₹{int(total):,}\n"
        f"• Payment Mode: {pay_mode} ({pay_status})\n\n"
        f"View and manage your booking at:\n"
        f"{frontend_url}/customer/my-bookings\n\n"
        f"Thank you for booking with BookMySalon!\n"
    )

    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }}
        .email-container {{ max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }}
        .header {{ background: linear-gradient(135deg, #1e3a29 0%, #2e5644 100%); color: #ffffff; padding: 32px 28px; text-align: center; }}
        .header h1 {{ margin: 0 0 6px; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }}
        .header p {{ margin: 0; font-size: 13px; opacity: 0.9; }}
        .content {{ padding: 28px; }}
        .status-pill {{ display: inline-block; background: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; margin-bottom: 20px; }}
        .detail-card {{ background: #f8fafc; border: 1px solid #edf2f7; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px; }}
        .detail-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }}
        .detail-row:last-child {{ border-bottom: none; }}
        .detail-label {{ color: #64748b; font-weight: 500; }}
        .detail-value {{ color: #0f172a; font-weight: 600; text-align: right; }}
        .cta-btn {{ display: block; width: 100%; text-align: center; background: #1e3a29; color: #ffffff !important; text-decoration: none; padding: 12px 0; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 24px; }}
        .footer {{ padding: 20px 28px; background: #fafafa; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>Booking Confirmed!</h1>
          <p>We are excited to see you at {salon_name}</p>
        </div>
        <div class="content">
          <div style="text-align: center;">
            <span class="status-pill">● Appointment #{booking.id} Confirmed</span>
          </div>
          <p style="font-size: 15px; color: #334155; margin-top: 0;">Hi <strong>{client_name}</strong>,</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">
            Your appointment has been confirmed. Below are your booking details:
          </p>
          <div class="detail-card">
            <div class="detail-row">
              <span class="detail-label">Salon</span>
              <span class="detail-value">{salon_name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Location</span>
              <span class="detail-value">{salon_address}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Service</span>
              <span class="detail-value">{services_text}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Stylist</span>
              <span class="detail-value">{stylist_name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date</span>
              <span class="detail-value">{date_formatted}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Time Slot</span>
              <span class="detail-value">{time_val} ({booking.duration or '45 mins'})</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Payment</span>
              <span class="detail-value">{pay_mode} ({pay_status})</span>
            </div>
            <div class="detail-row" style="font-size: 15px; color: #1e3a29;">
              <span class="detail-label" style="font-weight: 700; color: #1e3a29;">Total Amount</span>
              <span class="detail-value" style="font-size: 16px; color: #1e3a29;">₹{int(total):,}</span>
            </div>
          </div>
          <a href="{frontend_url}/customer/my-bookings" class="cta-btn">View My Bookings</a>
        </div>
        <div class="footer">
          BookMySalon &bull; Premium salon &amp; wellness appointments.<br>
          If you need to reschedule or cancel, please visit your dashboard in advance.
        </div>
      </div>
    </body>
    </html>
    """

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=from_email,
            recipient_list=[recipient_email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info("Sent booking confirmation email for Booking #%s to %s", booking_id, recipient_email)
        return True
    except Exception as exc:
        logger.exception("Failed to send booking confirmation email for #%s: %s", booking_id, exc)
        raise exc


def trigger_booking_confirmation_email(booking_id):
    """
    Helper function to dispatch send_booking_confirmation_email_task asynchronously via Celery,
    with a graceful synchronous fallback if the message broker is temporarily unreachable.
    """
    try:
        send_booking_confirmation_email_task.delay(booking_id)
    except Exception as err:
        logger.warning(
            "Celery dispatch failed for booking confirmation email #%s (%s). Executing synchronously.",
            booking_id,
            err,
        )
        try:
            send_booking_confirmation_email_task(booking_id)
        except Exception as sync_err:
            logger.error("Synchronous booking confirmation email also failed: %s", sync_err)

