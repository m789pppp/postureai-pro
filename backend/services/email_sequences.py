"""
email_sequences.py — PostureAI Phase 15
Drip email automation: welcome, activation, upsell, win-back, weekly digest
Run with APScheduler or Celery — called from backend.py scheduler
"""
import os, json, logging
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import List, Optional
import sendgrid
from sendgrid.helpers.mail import Mail, To, DynamicTemplateData

log = logging.getLogger("postureai.email")
sg  = sendgrid.SendGridAPIClient(api_key=os.getenv("SENDGRID_API_KEY",""))

# ── Template IDs (set in SendGrid dashboard) ─────────────────────
TEMPLATES = {
    "welcome":           os.getenv("SG_T_WELCOME",     "d-welcome"),
    "day1_tip":          os.getenv("SG_T_DAY1",        "d-day1tip"),
    "day3_activate":     os.getenv("SG_T_DAY3",        "d-day3act"),
    "day7_report":       os.getenv("SG_T_DAY7",        "d-day7rep"),
    "day14_upsell":      os.getenv("SG_T_DAY14",       "d-upsell"),
    "day30_milestone":   os.getenv("SG_T_DAY30",       "d-month"),
    "weekly_digest":     os.getenv("SG_T_WEEKLY",      "d-weekly"),
    "win_back_7d":       os.getenv("SG_T_WINBACK7",    "d-wb7"),
    "win_back_14d":      os.getenv("SG_T_WINBACK14",   "d-wb14"),
    "win_back_30d":      os.getenv("SG_T_WINBACK30",   "d-wb30"),
    "payment_failed":    os.getenv("SG_T_PAYFAIL",     "d-payfail"),
    "payment_retry":     os.getenv("SG_T_PAYRETRY",    "d-payretry"),
    "trial_ending":      os.getenv("SG_T_TRIAL",       "d-trial"),
    "seat_limit":        os.getenv("SG_T_SEATWARN",    "d-seat"),
    "usage_80pct":       os.getenv("SG_T_USAGE80",     "d-usage80"),
    "streak_broken":     os.getenv("SG_T_STREAK",      "d-streak"),
    "new_feature":       os.getenv("SG_T_FEATURE",     "d-feature"),
    "referral_joined":   os.getenv("SG_T_REFERRAL",    "d-referral"),
    "nps_survey":        os.getenv("SG_T_NPS",         "d-nps"),
}

FROM_EMAIL = os.getenv("EMAIL_FROM",      "noreply@postureai.com")
FROM_NAME  = os.getenv("EMAIL_FROM_NAME", "PostureAI")


@dataclass
class EmailContext:
    to_email:     str
    to_name:      str
    user_id:      str
    plan:         str
    template_key: str
    data:         dict   # dynamic template data


def send_email(ctx: EmailContext) -> bool:
    """Send a single transactional email via SendGrid dynamic template."""
    template_id = TEMPLATES.get(ctx.template_key)
    if not template_id:
        log.error(f"Unknown template key: {ctx.template_key}")
        return False

    msg = Mail(
        from_email=(FROM_EMAIL, FROM_NAME),
        to_emails=To(ctx.to_email, ctx.to_name),
    )
    msg.template_id = template_id
    msg.dynamic_template_data = {
        "first_name":   ctx.to_name.split()[0],
        "plan":         ctx.plan,
        "app_url":      "https://app.postureai.com",
        "unsubscribe":  f"https://app.postureai.com/unsubscribe?uid={ctx.user_id}",
        **ctx.data,
    }

    try:
        resp = sg.send(msg)
        ok = resp.status_code in (200, 202)
        log.info(f"Email {'sent' if ok else 'failed'}: {ctx.template_key} → {ctx.to_email} [{resp.status_code}]")
        return ok
    except Exception as e:
        log.error(f"SendGrid error for {ctx.template_key} → {ctx.to_email}: {e}")
        return False


# ════════════════════════════════════════════════════════════════
# SEQUENCE DEFINITIONS
# Each sequence = list of (delay_days, template_key, condition_fn)
# condition_fn receives user_stats dict → bool (send or skip)
# ════════════════════════════════════════════════════════════════

def _always(_): return True
def _no_sessions(s): return s.get("total_sessions", 0) == 0
def _few_sessions(s): return s.get("total_sessions", 0) < 3
def _on_starter(s): return s.get("plan") == "starter"
def _on_growth_or_below(s): return s.get("plan") in ("starter", "growth")
def _low_avg_score(s): return s.get("avg_score", 100) < 70
def _near_seat_limit(s): return s.get("seat_usage_pct", 0) >= 80


ONBOARDING_SEQUENCE = [
    (0,   "welcome",       _always),
    (1,   "day1_tip",      _always),
    (3,   "day3_activate", _no_sessions),
    (7,   "day7_report",   _always),
    (14,  "day14_upsell",  _on_starter),
    (30,  "day30_milestone", _always),
]

WIN_BACK_SEQUENCE = [
    (7,  "win_back_7d",  _always),
    (14, "win_back_14d", _always),
    (30, "win_back_30d", _always),
]

EXPANSION_SEQUENCE = [
    (0,  "seat_limit",  _near_seat_limit),
    (7,  "day14_upsell", _on_growth_or_below),
]


def run_onboarding_sequence(db, user: dict) -> List[str]:
    """
    Called by daily scheduler. Checks which onboarding emails
    to send based on days since signup.
    Returns list of sent template keys.
    """
    created_at = user.get("created_at")
    if not created_at:
        return []

    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)

    days_since = (datetime.utcnow() - created_at).days
    sent_keys  = set(user.get("emails_sent", []))
    sent_now   = []

    stats = {
        "total_sessions": user.get("total_sessions", 0),
        "avg_score":      user.get("avg_score", 0),
        "plan":           user.get("plan", "starter"),
        "seat_usage_pct": user.get("seat_usage_pct", 0),
    }

    for delay, key, condition in ONBOARDING_SEQUENCE:
        if days_since >= delay and key not in sent_keys and condition(stats):
            ctx = EmailContext(
                to_email=user["email"], to_name=user.get("name",""),
                user_id=user["uid"], plan=user.get("plan","starter"),
                template_key=key,
                data={
                    "avg_score":      stats["avg_score"],
                    "total_sessions": stats["total_sessions"],
                    "streak":         user.get("streak", 0),
                    "days_since":     days_since,
                }
            )
            if send_email(ctx):
                sent_keys.add(key)
                sent_now.append(key)
                # Persist to DB
                if db:
                    db.collection("users").document(user["uid"]).update({
                        "emails_sent": list(sent_keys)
                    })

    return sent_now


def send_win_back(db, user: dict, inactive_days: int) -> bool:
    """Send win-back email when user hasn't logged in."""
    if inactive_days == 7:
        key = "win_back_7d"
    elif inactive_days == 14:
        key = "win_back_14d"
    elif inactive_days == 30:
        key = "win_back_30d"
    else:
        return False

    sent_keys = set(user.get("emails_sent", []))
    if key in sent_keys:
        return False

    ctx = EmailContext(
        to_email=user["email"], to_name=user.get("name",""),
        user_id=user["uid"], plan=user.get("plan","starter"),
        template_key=key,
        data={"inactive_days": inactive_days, "last_score": user.get("last_score", "—")}
    )
    ok = send_email(ctx)
    if ok and db:
        db.collection("users").document(user["uid"]).update({
            "emails_sent": list(sent_keys | {key})
        })
    return ok


def send_weekly_digest(db, user: dict, week_stats: dict) -> bool:
    """Send weekly digest every Monday."""
    ctx = EmailContext(
        to_email=user["email"], to_name=user.get("name",""),
        user_id=user["uid"], plan=user.get("plan","starter"),
        template_key="weekly_digest",
        data={
            "week_avg":      week_stats.get("avg_score", 0),
            "sessions":      week_stats.get("sessions", 0),
            "streak":        week_stats.get("streak", 0),
            "top_alert":     week_stats.get("top_alert", "neck_tilt"),
            "improvement":   week_stats.get("improvement", 0),
            "rank_in_team":  week_stats.get("rank", "—"),
        }
    )
    return send_email(ctx)


def send_payment_failed(user: dict, invoice_id: str, amount: float, retry_date: str) -> bool:
    ctx = EmailContext(
        to_email=user["email"], to_name=user.get("name",""),
        user_id=user["uid"], plan=user.get("plan","starter"),
        template_key="payment_failed",
        data={"invoice_id": invoice_id, "amount": amount, "retry_date": retry_date}
    )
    return send_email(ctx)


def send_trial_ending(user: dict, days_left: int) -> bool:
    ctx = EmailContext(
        to_email=user["email"], to_name=user.get("name",""),
        user_id=user["uid"], plan=user.get("plan","starter"),
        template_key="trial_ending",
        data={"days_left": days_left, "upgrade_url": "https://app.postureai.com/billing"}
    )
    return send_email(ctx)


def send_nps_survey(user: dict) -> bool:
    """Send NPS survey after 30 days of usage."""
    ctx = EmailContext(
        to_email=user["email"], to_name=user.get("name",""),
        user_id=user["uid"], plan=user.get("plan","starter"),
        template_key="nps_survey",
        data={"survey_url": f"https://app.postureai.com/nps?uid={user['uid']}"}
    )
    return send_email(ctx)


# ── Batch runner (called by APScheduler daily at 09:00 UTC) ─────
def run_daily_email_jobs(db):
    """
    Main entry point for scheduler.
    Called once per day — processes all users efficiently.
    """
    log.info("Daily email job started")
    now = datetime.utcnow()
    sent_total = 0

    try:
        users_ref = db.collection("users").stream()
        for doc in users_ref:
            u = doc.to_dict()
            u["uid"] = doc.id

            # Skip unsubscribed
            if u.get("email_unsubscribed"):
                continue

            # 1. Onboarding sequence
            sent = run_onboarding_sequence(db, u)
            sent_total += len(sent)

            # 2. Win-back for inactive users
            last_login = u.get("last_login_at")
            if last_login:
                if isinstance(last_login, str):
                    last_login = datetime.fromisoformat(last_login)
                inactive_days = (now - last_login).days
                if inactive_days in (7, 14, 30):
                    if send_win_back(db, u, inactive_days):
                        sent_total += 1

            # 3. Weekly digest (Mondays only)
            if now.weekday() == 0:  # Monday
                week_stats = u.get("last_week_stats", {})
                if week_stats and send_weekly_digest(db, u, week_stats):
                    sent_total += 1

            # 4. NPS at 30 days
            created_at = u.get("created_at")
            if created_at:
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                days = (now - created_at).days
                if days == 30 and "nps_survey" not in set(u.get("emails_sent", [])):
                    if send_nps_survey(u):
                        sent_total += 1

            # 5. Trial ending warnings (3 days before)
            trial_end = u.get("trial_ends_at")
            if trial_end:
                if isinstance(trial_end, str):
                    trial_end = datetime.fromisoformat(trial_end)
                days_left = (trial_end - now).days
                if days_left in (3, 1):
                    send_trial_ending(u, days_left)
                    sent_total += 1

    except Exception as e:
        log.error(f"Daily email job error: {e}")

    log.info(f"Daily email job complete — {sent_total} emails sent")
    return sent_total
