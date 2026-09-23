import logging
from django.conf import settings
from django.core.mail import send_mail
from django.core.signing import TimestampSigner

logger = logging.getLogger(__name__)


def generate_salon_resubmit_token(salon):
    """
    Generates a secure, tamper-proof signature for resubmitting
    a rejected salon application. The salt incorporates the salon ID
    and the updated_at timestamp so that once the application is resubmitted,
    the token automatically and permanently expires.
    """
    salon_id = getattr(salon, "id", salon)
    updated_at = getattr(salon, "updated_at", None)
    timestamp_key = 0
    if updated_at and hasattr(updated_at, "timestamp") and callable(updated_at.timestamp):
        try:
            ts = updated_at.timestamp()
            if isinstance(ts, (int, float)):
                timestamp_key = int(ts)
        except (TypeError, ValueError):
            timestamp_key = 0

    signer = TimestampSigner(salt=f"salon-resubmit-{salon_id}-{timestamp_key}")
    return signer.sign(str(salon_id))


def verify_salon_resubmit_token(salon, token, max_age=86400 * 30):
    """
    Verifies that the provided token belongs to the specified salon and matches
    its rejection state. If the salon was resubmitted, updated_at changed and this
    will return False.
    """
    if not token or salon is None:
        return False

    salon_id = getattr(salon, "id", salon)
    updated_at = getattr(salon, "updated_at", None)
    timestamp_key = 0
    if updated_at and hasattr(updated_at, "timestamp") and callable(updated_at.timestamp):
        try:
            ts = updated_at.timestamp()
            if isinstance(ts, (int, float)):
                timestamp_key = int(ts)
        except (TypeError, ValueError):
            timestamp_key = 0

    signer = TimestampSigner(salt=f"salon-resubmit-{salon_id}-{timestamp_key}")
    try:
        val = signer.unsign(token, max_age=max_age)
        return str(val) == str(salon_id)
    except Exception:
        # Fallback check against zero timestamp_key or legacy salt
        try:
            fallback_signer = TimestampSigner(salt=f"salon-resubmit-{salon_id}-0")
            val = fallback_signer.unsign(token, max_age=max_age)
            return str(val) == str(salon_id)
        except Exception:
            try:
                fallback_signer2 = TimestampSigner(salt="salon-resubmit")
                val = fallback_signer2.unsign(token, max_age=max_age)
                return str(val) == str(salon_id)
            except Exception:
                return False


def send_salon_approval_email(salon, temp_password, login_url=None):
    subject = f"Congratulations! Your Salon '{salon.name}' has been Approved"
    recipient = salon.email
    if not recipient:
        return False

    frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    if not login_url:
        login_url = f"{frontend_base}/login"

    plain_message = f"""
Dear Salon Partner,

Congratulations! Your application for '{salon.name}' has been reviewed and APPROVED by the BookMySalon Super Admin team.

Here are your official Owner account login credentials:
--------------------------------------------------
Login URL: {login_url}
Email (Username): {recipient}
Temporary Password: {temp_password}
--------------------------------------------------

Please log in using these credentials to access your salon management dashboard, add services, and configure staff.
For security, we recommend changing your password after your first login.

Welcome to the BookMySalon Partner Network!

Best regards,
BookMySalon Super Admin Operations
"""

    html_message = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f4; margin: 0; padding: 24px; color: #1e2e23; }}
    .card {{ max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #d8e5dc; border-radius: 14px; padding: 36px; box-shadow: 0 4px 12px rgba(22, 45, 30, 0.06); }}
    .badge {{ display: inline-block; background: #eaf5ee; color: #215535; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; }}
    .title {{ font-size: 22px; font-weight: 700; color: #142a1b; margin-top: 0; margin-bottom: 12px; }}
    .text {{ font-size: 14px; line-height: 1.6; color: #435b4b; margin-bottom: 20px; }}
    .credentials-box {{ background: #f7faf8; border: 1.5px dashed #2d5a3d; border-radius: 10px; padding: 20px; margin: 24px 0; }}
    .cred-row {{ display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }}
    .cred-label {{ color: #5a7362; font-weight: 600; }}
    .cred-val {{ font-family: monospace; font-size: 14px; font-weight: 700; color: #153320; }}
    .btn {{ display: block; text-align: center; background: #234d35; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; margin-top: 24px; }}
    .footer {{ margin-top: 30px; border-top: 1px solid #e7ede8; padding-top: 16px; font-size: 11px; color: #829588; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Application Approved</span>
    <h1 class="title">Welcome to BookMySalon!</h1>
    <p class="text">
      Congratulations! Your salon application for <strong>{salon.name}</strong> has been verified and approved by the Super Admin team.
    </p>
    <div class="credentials-box">
      <div style="font-size: 12px; font-weight: 700; color: #204b31; text-transform: uppercase; margin-bottom: 12px;">Your Owner Login Credentials</div>
      <div class="cred-row"><span class="cred-label">Login Email:</span> <span class="cred-val">{recipient}</span></div>
      <div class="cred-row"><span class="cred-label">Temporary Password:</span> <span class="cred-val">{temp_password}</span></div>
      <div class="cred-row" style="margin-bottom: 0;"><span class="cred-label">Access Level:</span> <span class="cred-val" style="color: #275d3c;">Salon Owner</span></div>
    </div>
    <a href="{login_url}" target="_blank" rel="noopener noreferrer" class="btn">Log In to Your Salon Dashboard &rarr;</a>
    <p class="text" style="font-size: 12px; color: #728779; margin-top: 18px; text-align: center;">
      (Opens your owner login portal in a new tab)
    </p>
    <div class="footer">
      BookMySalon Partner Network &bull; Need support? Contact admin@bookmysalon.com
    </div>
  </div>
</body>
</html>
"""

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Approval email sent to {recipient} for salon {salon.id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send approval email to {recipient}: {e}")
        return False


def send_salon_rejection_email(salon, reason=""):
    subject = f"Action Required: Application update regarding '{salon.name}'"
    recipient = salon.email
    if not recipient:
        return False

    frontend_base = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    token = generate_salon_resubmit_token(salon)
    resubmit_url = f"{frontend_base}/salon-application?resubmit={salon.id}&token={token}"

    reason_text = f"\nSuper Admin Feedback:\n{reason}\n" if reason else ""

    plain_message = f"""
Dear Salon Applicant,

Thank you for your interest in listing '{salon.name}' on BookMySalon.

After review by our compliance and verification team, we are unable to approve your application in its current state.
{reason_text}
You can easily review, correct, and resubmit your application. We have preserved all your previous details so the form will be fully pre-filled for you:
{resubmit_url}

Please update the requested details and resubmit for priority review.

If you have any questions, please contact our support desk at admin@bookmysalon.com.

Best regards,
BookMySalon Super Admin Operations
"""

    html_message = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 24px; color: #1f2937; }}
    .card {{ max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
    .badge {{ display: inline-block; background: #fef2f2; color: #991b1b; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 12px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; }}
    .title {{ font-size: 20px; font-weight: 700; color: #991b1b; margin-top: 0; margin-bottom: 12px; }}
    .text {{ font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 16px; }}
    .reason-box {{ background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #991b1b; }}
    .btn {{ display: inline-block; text-align: center; background: #234d34; color: #ffffff !important; padding: 13px 28px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; margin-top: 10px; }}
    .footer {{ margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 11px; color: #9ca3af; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Application Update</span>
    <h1 class="title">Action Required: Update Your Application</h1>
    <p class="text">
      Thank you for your interest in joining the BookMySalon Partner Network with <strong>{salon.name}</strong>.
    </p>
    <p class="text">
      After review by our verification team, we found some details that need your attention or correction before we can approve your venue.
    </p>
    {"<div class='reason-box'><strong>Feedback from Super Admin:</strong><br>" + reason + "</div>" if reason else ""}
    <p class="text">
      We have saved your existing application data. Click the button below to review your <strong>pre-filled application</strong> in a new tab, update the necessary details, and resubmit for priority verification:
    </p>
    <div style="text-align: center; margin: 26px 0;">
      <a href="{resubmit_url}" target="_blank" rel="noopener noreferrer" class="btn">
        Correct &amp; Resubmit Application &rarr;
      </a>
    </div>
    <p class="text" style="font-size: 12px; color: #6b7280; text-align: center; margin-top: -12px;">
      (Opens your pre-filled form in a new tab)
    </p>
    <div class="footer">
      BookMySalon Platform Operations &bull; Support: admin@bookmysalon.com
    </div>
  </div>
</body>
</html>
"""

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Rejection email with resubmission link sent to {recipient} for salon {salon.id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send rejection email to {recipient}: {e}")
        return False
