import logging
import secrets
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def generate_otp() -> str:
    """Generate a cryptographically secure 6-digit numeric OTP."""
    return f"{secrets.randbelow(900000) + 100000}"


def send_otp_email(email: str, otp: str, first_name: str = "") -> bool:
    """
    Send a 6-digit OTP verification code to the specified email address.
    """
    greeting = f"Hi {first_name}," if first_name else "Hello,"
    subject = f"{otp} is your BookMySalon verification code"

    plain_message = (
        f"{greeting}\n\n"
        f"Thank you for signing up with BookMySalon.\n"
        f"Your 6-digit verification code is: {otp}\n\n"
        f"This code will expire in 60 seconds.\n"
        f"If you did not request this code, please ignore this email.\n\n"
        f"Best regards,\n"
        f"BookMySalon Team"
    )

    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; }}
        .card {{ max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
        .title {{ color: #1f2937; font-size: 20px; font-weight: 700; margin-bottom: 12px; }}
        .text {{ color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }}
        .otp-box {{ background: #f3f4f6; border: 1px dashed #9ca3af; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px; }}
        .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #10b981; margin: 0; font-family: monospace; }}
        .footer {{ color: #9ca3af; font-size: 12px; line-height: 1.5; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <h2 class="title">Verify Your Email</h2>
        <p class="text">{greeting}<br>Thank you for signing up with BookMySalon. Use the verification code below to complete your registration:</p>
        <div class="otp-box">
          <p class="otp-code">{otp}</p>
        </div>
        <p class="text" style="font-size: 13px; color: #6b7280;">This code is valid for <strong>60 seconds</strong>. If you did not request this, please safely ignore this message.</p>
        <div class="footer">
          BookMySalon &bull; Fast, easy, and elegant salon appointments.
        </div>
      </div>
    </body>
    </html>
    """

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon <noreply@bookmysalon.com>")

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=from_email,
            recipient_list=[email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info("Sent OTP to %s successfully.", email)
        return True
    except Exception as exc:
        logger.exception("Failed to send OTP to %s: %s", email, exc)
        print(f"!!! ERROR SENDING OTP TO {email}: {exc}")
        return False


def send_password_reset_otp_email(email: str, otp: str, first_name: str = "") -> bool:
    """
    Send a 6-digit OTP verification code for password reset to the specified email.
    """
    greeting = f"Hi {first_name}," if first_name else "Hello,"
    subject = f"{otp} is your BookMySalon password reset code"

    plain_message = (
        f"{greeting}\n\n"
        f"We received a request to reset your BookMySalon account password.\n"
        f"Your 6-digit verification code is: {otp}\n\n"
        f"This code will expire in 60 seconds.\n"
        f"If you did not request a password reset, please ignore this email.\n\n"
        f"Best regards,\n"
        f"BookMySalon Security Team"
    )

    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; }}
        .card {{ max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
        .title {{ color: #1f2937; font-size: 20px; font-weight: 700; margin-bottom: 12px; }}
        .text {{ color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }}
        .otp-box {{ background: #f3f4f6; border: 1px dashed #9ca3af; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px; }}
        .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563eb; margin: 0; font-family: monospace; }}
        .footer {{ color: #9ca3af; font-size: 12px; line-height: 1.5; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <h2 class="title">Reset Your Password</h2>
        <p class="text">{greeting}<br>We received a request to reset the password for your BookMySalon account. Use the 6-digit verification code below:</p>
        <div class="otp-box">
          <p class="otp-code">{otp}</p>
        </div>
        <p class="text" style="font-size: 13px; color: #6b7280;">This code is valid for <strong>60 seconds</strong>. If you did not request this password reset, please safely ignore this email &mdash; your account remains secure.</p>
        <div class="footer">
          BookMySalon &bull; Fast, easy, and elegant salon appointments.
        </div>
      </div>
    </body>
    </html>
    """

    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "BookMySalon <noreply@bookmysalon.com>")

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=from_email,
            recipient_list=[email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info("Sent password reset OTP to %s successfully.", email)
        return True
    except Exception as exc:
        logger.exception("Failed to send password reset OTP to %s: %s", email, exc)
        print(f"!!! ERROR SENDING PASSWORD RESET OTP TO {email}: {exc}")
        return False

