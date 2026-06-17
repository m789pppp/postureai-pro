"""
Corvus — Email Service v2
Provider: Resend (production) / SMTP fallback
Handles: Welcome, Verification, Password Reset, Trial Ending,
         Billing Notifications, Weekly HR Reports
"""
import os
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger("corvus.email")

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL     = os.getenv("FROM_EMAIL", "Corvus <noreply@corvus.io>")
SUPPORT_EMAIL  = os.getenv("SUPPORT_EMAIL", "support@corvus.io")
APP_URL        = os.getenv("APP_URL", "https://corvus.io")


def _resend_send(to: str, subject: str, html: str, text: str = "") -> bool:
    """Send via Resend API."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — email not sent to %s", to)
        return False
    try:
        import httpx
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": FROM_EMAIL, "to": [to], "subject": subject, "html": html,
                  **({"text": text} if text else {})},
            timeout=10,
        )
        resp.raise_for_status()
        logger.info("Email sent via Resend to %s | subject: %s", to, subject)
        return True
    except Exception as e:
        logger.error("Resend failed: %s — falling back to SMTP", e)
        return _smtp_send(to, subject, html, text)


def _smtp_send(to: str, subject: str, html: str, text: str = "") -> bool:
    """SMTP fallback."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    if not smtp_host or not smtp_user:
        logger.warning("SMTP not configured — email dropped to %s", to)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = FROM_EMAIL
        msg["To"]      = to
        if text:
            msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(smtp_host, smtp_port) as s:
            s.starttls()
            s.login(smtp_user, smtp_pass)
            s.sendmail(smtp_user, [to], msg.as_string())
        logger.info("Email sent via SMTP to %s", to)
        return True
    except Exception as e:
        logger.error("SMTP send failed to %s: %s", to, e)
        return False


def send_email(to: str, subject: str, html: str, text: str = "") -> bool:
    """Route to best available provider."""
    if RESEND_API_KEY:
        return _resend_send(to, subject, html, text)
    return _smtp_send(to, subject, html, text)


# ── Email templates ────────────────────────────────────────────────

def _base_template(title: str, content: str, cta_text: str = "", cta_url: str = "") -> str:
    cta_block = f"""
    <tr><td align="center" style="padding:24px 0 8px;">
      <a href="{cta_url}" style="
        display:inline-block;padding:14px 32px;
        background:linear-gradient(135deg,#4f7cf9,#22d3ee);
        color:#fff;font-size:16px;font-weight:600;text-decoration:none;
        border-radius:10px;letter-spacing:-.01em;
      ">{cta_text}</a>
    </td></tr>
    """ if cta_text and cta_url else ""

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>
  body{{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f0f4f8}}
  .wrapper{{max-width:600px;margin:40px auto;padding:0 16px}}
  .card{{background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}}
  .header{{background:linear-gradient(135deg,#030b14,#071220);padding:32px 40px;text-align:center}}
  .logo{{font-size:22px;font-weight:800;color:#e8f0ff;letter-spacing:-.02em}}
  .logo span{{background:linear-gradient(90deg,#818cf8,#22d3ee);-webkit-background-clip:text;-webkit-text-fill-color:transparent}}
  .body{{padding:40px}}
  h1{{color:#0f172a;font-size:22px;font-weight:700;margin:0 0 12px;letter-spacing:-.02em}}
  p{{color:#475569;font-size:15px;line-height:1.7;margin:0 0 16px}}
  .highlight{{background:#f0f4ff;border-left:3px solid #4f7cf9;padding:14px 16px;border-radius:0 8px 8px 0;margin:16px 0}}
  .footer{{padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center}}
  .footer p{{font-size:12px;color:#94a3b8;margin:4px 0}}
</style>
</head><body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="logo">Corvus <span>Pro</span></div>
    </div>
    <div class="body">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td>{content}</td></tr>
        {cta_block}
      </table>
    </div>
    <div class="footer">
      <p>Corvus · AI Workforce Health Intelligence</p>
      <p>Questions? <a href="mailto:{SUPPORT_EMAIL}" style="color:#4f7cf9">{SUPPORT_EMAIL}</a></p>
      <p style="margin-top:8px"><a href="{APP_URL}/unsubscribe" style="color:#94a3b8;text-decoration:none">Unsubscribe</a></p>
    </div>
  </div>
</div>
</body></html>"""


def send_welcome(to: str, name: str) -> bool:
    name_display = name or "there"
    content = f"""
    <h1>Welcome to Corvus, {name_display}! 🎉</h1>
    <p>You're all set to start improving your team's posture and productivity with AI-powered analysis.</p>
    <div class="highlight">
      <strong>Your 14-day free trial is now active.</strong><br>
      You have full access to all Professional features.
    </div>
    <p>Here's how to get started:</p>
    <ol style="color:#475569;font-size:15px;line-height:2">
      <li>Complete your profile setup</li>
      <li>Run your first posture analysis session</li>
      <li>Invite your team members</li>
      <li>Review your first AI health report</li>
    </ol>
    """
    html = _base_template("Welcome to Corvus", content,
                          "Start Your First Session →", f"{APP_URL}/app")
    return send_email(to, "Welcome to Corvus 🧘 — Your trial is active", html)


def send_verification(to: str, name: str, token: str) -> bool:
    verify_url = f"{APP_URL}/verify-email?token={token}"
    content = f"""
    <h1>Verify your email address</h1>
    <p>Hi {name or 'there'}, please verify your email to activate your Corvus account.</p>
    <div class="highlight">This link expires in <strong>24 hours</strong>.</div>
    """
    html = _base_template("Verify Email", content, "Verify My Email →", verify_url)
    return send_email(to, "Verify your Corvus email", html)


def send_password_reset(to: str, name: str, token: str) -> bool:
    reset_url = f"{APP_URL}/reset-password?token={token}"
    content = f"""
    <h1>Reset your password</h1>
    <p>Hi {name or 'there'}, we received a request to reset your Corvus password.</p>
    <div class="highlight">This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</div>
    """
    html = _base_template("Reset Password", content, "Reset My Password →", reset_url)
    return send_email(to, "Reset your Corvus password", html)


def send_trial_ending(to: str, name: str, days_left: int) -> bool:
    content = f"""
    <h1>Your trial ends in {days_left} {'day' if days_left == 1 else 'days'}</h1>
    <p>Hi {name or 'there'}, your Corvus free trial is almost over.</p>
    <p>To keep your access to AI posture analysis, team dashboards, and HR reports, upgrade to a paid plan today.</p>
    <div class="highlight">
      Plans start at <strong>$9/month</strong> — less than one physiotherapy appointment.
    </div>
    """
    html = _base_template("Trial Ending Soon", content, "Upgrade My Plan →",
                          f"{APP_URL}/billing?source=trial_email")
    return send_email(to, f"Your Corvus trial ends in {days_left} days", html)


def send_payment_confirmation(to: str, name: str, plan: str, amount: str, next_date: str) -> bool:
    content = f"""
    <h1>Payment confirmed ✓</h1>
    <p>Hi {name or 'there'}, your Corvus subscription has been renewed.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 0;color:#475569;font-size:14px">Plan</td>
        <td style="padding:10px 0;font-weight:600;font-size:14px;text-transform:capitalize">{plan}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 0;color:#475569;font-size:14px">Amount</td>
        <td style="padding:10px 0;font-weight:600;font-size:14px">{amount}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#475569;font-size:14px">Next renewal</td>
        <td style="padding:10px 0;font-weight:600;font-size:14px">{next_date}</td>
      </tr>
    </table>
    """
    html = _base_template("Payment Confirmed", content, "View Invoice →",
                          f"{APP_URL}/billing/invoices")
    return send_email(to, "Corvus — Payment confirmed", html)


def send_payment_failed(to: str, name: str, amount: str, next_attempt: str) -> bool:
    content = f"""
    <h1>Payment failed ⚠️</h1>
    <p>Hi {name or 'there'}, we couldn't process your payment of <strong>{amount}</strong>.</p>
    <p>Please update your payment method to avoid service interruption. We'll retry on <strong>{next_attempt}</strong>.</p>
    """
    html = _base_template("Payment Failed", content, "Update Payment Method →",
                          f"{APP_URL}/billing?action=update_payment")
    return send_email(to, "⚠️ Corvus — Action required: payment failed", html)


def send_weekly_hr_report(to: str, org_name: str, week_data: dict) -> bool:
    avg = week_data.get("avg_score", 0)
    active = week_data.get("active_users", 0)
    alerts = week_data.get("alerts", 0)
    sessions = week_data.get("sessions", 0)

    score_color = "#10d9a0" if avg >= 80 else "#f59e0b" if avg >= 65 else "#f87171"

    content = f"""
    <h1>{org_name} — Weekly Health Report</h1>
    <p>Here's your team's posture health summary for the past 7 days.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#f8fafc">
        <td style="padding:14px 16px;font-size:14px;color:#475569">Average Posture Score</td>
        <td style="padding:14px 16px;font-weight:700;font-size:20px;color:{score_color}">{avg}/100</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:14px;color:#475569">Active Employees</td>
        <td style="padding:14px 16px;font-weight:600;font-size:16px">{active}</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:14px 16px;font-size:14px;color:#475569">Analysis Sessions</td>
        <td style="padding:14px 16px;font-weight:600;font-size:16px">{sessions}</td>
      </tr>
      <tr>
        <td style="padding:14px 16px;font-size:14px;color:#475569">Risk Alerts Sent</td>
        <td style="padding:14px 16px;font-weight:600;font-size:16px;color:#f59e0b">{alerts}</td>
      </tr>
    </table>
    """
    html = _base_template(f"{org_name} Weekly Report", content,
                          "View Full Report →", f"{APP_URL}/app/analytics")
    subject = f"{org_name} — Weekly Posture Health Report ({datetime.now().strftime('%b %d, %Y')})"
    return send_email(to, subject, html)


def send_team_invite(to: str, invited_by: str, org_name: str, role: str, token: str) -> bool:
    accept_url = f"{APP_URL}/invite/{token}"
    content = f"""
    <h1>You've been invited to join {org_name}</h1>
    <p><strong>{invited_by}</strong> has invited you to join <strong>{org_name}</strong> on Corvus as a <strong>{role}</strong>.</p>
    <div class="highlight">This invitation expires in <strong>7 days</strong>.</div>
    """
    html = _base_template("Team Invitation", content, "Accept Invitation →", accept_url)
    return send_email(to, f"You're invited to join {org_name} on Corvus", html)
