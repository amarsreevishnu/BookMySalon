import logging
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_salon_approval_email(salon, temp_password, login_url="http://localhost:5173/login"):
    subject = f"Congratulations! Your Salon '{salon.name}' has been Approved"
    recipient = salon.email
    if not recipient:
        return False

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
    <a href="{login_url}" class="btn">Log In to Your Salon Dashboard &rarr;</a>
    <p class="text" style="font-size: 12px; color: #728779; margin-top: 18px;">
      Please keep these credentials safe and change your password upon your first sign in.
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
    subject = f"Update regarding your salon application for '{salon.name}'"
    recipient = salon.email
    if not recipient:
        return False

    reason_text = f"\nReason: {reason}\n" if reason else ""

    plain_message = f"""
Dear Salon Applicant,

Thank you for your interest in listing '{salon.name}' on BookMySalon.

After review by our compliance and verification team, we are unable to approve your application at this time.
{reason_text}
If you believe this was in error or if you would like to update your documents and reapply, please contact support at admin@bookmysalon.com.

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
    .card {{ max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; }}
    .title {{ font-size: 20px; font-weight: 700; color: #991b1b; margin-top: 0; margin-bottom: 12px; }}
    .text {{ font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 16px; }}
    .reason-box {{ background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #991b1b; }}
    .footer {{ margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 14px; font-size: 11px; color: #9ca3af; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <h1 class="title">Application Status Update</h1>
    <p class="text">
      Thank you for your interest in joining the BookMySalon Partner Network with <strong>{salon.name}</strong>.
    </p>
    <p class="text">
      After review by our verification team, we regret to inform you that your application could not be approved at this time.
    </p>
    {"<div class='reason-box'><strong>Feedback from Admin:</strong> " + reason + "</div>" if reason else ""}
    <p class="text" style="font-size: 13px;">
      If you have questions or would like to submit updated information, please contact our support desk at <strong>admin@bookmysalon.com</strong>.
    </p>
    <div class="footer">
      BookMySalon Platform Operations
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
        logger.info(f"Rejection email sent to {recipient} for salon {salon.id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send rejection email to {recipient}: {e}")
        return False

