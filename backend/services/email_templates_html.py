"""
email_templates.py — Corvus
Production-ready HTML email templates.
Used by email_sequences.py as fallback when SendGrid dynamic templates are not set.
Also used to seed SendGrid templates via the /api/admin/email-templates/seed route.
"""
import os

APP_URL   = os.getenv("APP_URL",   "https://app.corvus.com")
BRAND_CLR = os.getenv("BRAND_COLOR","#6366f1")
FROM_NAME = os.getenv("EMAIL_FROM_NAME","Corvus")

def _base(title: str, body: str, unsubscribe: str = "") -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>{title}</title>
  <style>
    body{{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}}
    .wrap{{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.07)}}
    .hdr{{background:{BRAND_CLR};padding:32px 40px;text-align:center}}
    .hdr h1{{margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-.3px}}
    .body{{padding:36px 40px;color:#1e293b;font-size:15px;line-height:1.7}}
    .body h2{{margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a}}
    .body p{{margin:0 0 16px;color:#475569}}
    .btn{{display:inline-block;background:{BRAND_CLR};color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;margin:8px 0}}
    .score-ring{{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,{BRAND_CLR},#0ea5e9);display:inline-flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#fff;margin:16px 0}}
    .stat-row{{display:flex;gap:16px;margin:20px 0}}
    .stat{{flex:1;background:#f8fafc;border-radius:10px;padding:14px;text-align:center;border:1px solid #e2e8f0}}
    .stat .val{{font-size:22px;font-weight:900;color:{BRAND_CLR}}}
    .stat .lbl{{font-size:11px;color:#64748b;margin-top:4px}}
    .footer{{background:#f8fafc;padding:20px 40px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0}}
    .footer a{{color:#6366f1}}
    .tip{{background:#f0f9ff;border-left:4px solid {BRAND_CLR};border-radius:0 8px 8px 0;padding:14px 18px;margin:20px 0;font-size:14px;color:#0369a1}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr"><h1>🧘 {FROM_NAME}</h1></div>
    <div class="body">{body}</div>
    <div class="footer">
      <p>© 2026 Corvus Ltd · <a href="{APP_URL}/privacy">Privacy</a> · <a href="{APP_URL}/terms">Terms</a></p>
      {f'<p><a href="{unsubscribe}">Unsubscribe</a></p>' if unsubscribe else ""}
    </div>
  </div>
</body>
</html>"""


def welcome(first_name: str, app_url: str = APP_URL, **_) -> tuple[str, str]:
    """Subject + HTML body for welcome email."""
    subject = f"Welcome to Corvus, {first_name}! 🧘"
    body = f"""
      <h2>Hey {first_name}, welcome aboard! 🎉</h2>
      <p>Your Corvus account is ready. You're one click away from discovering how your posture affects your health, energy, and focus.</p>
      <p style="text-align:center">
        <a class="btn" href="{app_url}">Start your first session →</a>
      </p>
      <div class="tip">💡 <b>Quick tip:</b> Your first session takes under 3 minutes. Just allow camera access and sit naturally.</div>
      <p>Here's what you can do with Corvus:</p>
      <ul style="color:#475569;line-height:2">
        <li>📷 Real-time posture analysis while you work</li>
        <li>🤖 AI coaching that adapts to your patterns</li>
        <li>📊 Weekly reports showing your progress</li>
        <li>👥 Compare scores with your team</li>
      </ul>
      <p>Any questions? Reply to this email — we read every message.</p>
      <p>To great posture,<br/><b>The Corvus Team</b></p>
    """
    return subject, _base(subject, body)


def day1_tip(first_name: str, app_url: str = APP_URL, **_) -> tuple[str, str]:
    subject = f"Your Day 1 posture tip, {first_name} 💡"
    body = f"""
      <h2>One small change, big impact 💡</h2>
      <p>Hi {first_name},</p>
      <p>The #1 mistake people make at their desk: <b>monitor too low</b>. Your eyes should hit the top third of the screen naturally.</p>
      <div class="tip">📐 <b>Quick fix:</b> Raise your monitor 5–10 cm. If you're on a laptop, get a stand or a stack of books. Your neck will thank you.</div>
      <p>Ready to see your posture score?</p>
      <p style="text-align:center">
        <a class="btn" href="{app_url}">Analyze my posture now →</a>
      </p>
    """
    return subject, _base(subject, body)


def day3_activate(first_name: str, app_url: str = APP_URL, **_) -> tuple[str, str]:
    subject = f"{first_name}, your posture is waiting 👀"
    body = f"""
      <h2>You haven't analyzed yet, {first_name}</h2>
      <p>It's been 3 days and we haven't seen your first session yet. No worries — it happens.</p>
      <p>Your first analysis takes <b>under 60 seconds</b>. Here's all you need:</p>
      <ol style="color:#475569;line-height:2.2;padding-left:20px">
        <li>Open Corvus on your computer</li>
        <li>Click <b>"Start Session"</b></li>
        <li>Allow camera access</li>
        <li>Sit normally for 60 seconds</li>
      </ol>
      <p style="text-align:center">
        <a class="btn" href="{app_url}">Start my first session →</a>
      </p>
      <p style="color:#94a3b8;font-size:13px">If something's blocking you, just reply to this email. We'll help.</p>
    """
    return subject, _base(subject, body)


def day7_report(first_name: str, avg_score: int = 75, sessions: int = 3,
                streak: int = 2, app_url: str = APP_URL, **_) -> tuple[str, str]:
    grade = "A" if avg_score >= 90 else "B" if avg_score >= 80 else "C" if avg_score >= 70 else "D"
    subject = f"Your Week 1 posture report is ready, {first_name} 📊"
    body = f"""
      <h2>Week 1 complete! Here's how you did 📊</h2>
      <p>Hi {first_name}, you made it through your first week. Here's your summary:</p>
      <div class="stat-row">
        <div class="stat"><div class="val">{avg_score}</div><div class="lbl">Avg Score</div></div>
        <div class="stat"><div class="val">{grade}</div><div class="lbl">Grade</div></div>
        <div class="stat"><div class="val">{sessions}</div><div class="lbl">Sessions</div></div>
        <div class="stat"><div class="val">{streak}d</div><div class="lbl">Streak</div></div>
      </div>
      {"<div class='tip'>🔥 You're on a streak! Keep it going — consistency is the key to lasting posture change.</div>" if streak >= 3 else ""}
      <p>Your biggest opportunity: most users improve by <b>8–12 points</b> in their second week just by doing daily sessions.</p>
      <p style="text-align:center">
        <a class="btn" href="{app_url}">Start Week 2 →</a>
      </p>
    """
    return subject, _base(subject, body)


def day14_upsell(first_name: str, avg_score: int = 75,
                  app_url: str = APP_URL, **_) -> tuple[str, str]:
    subject = f"Unlock AI coaching for your posture, {first_name} 🤖"
    body = f"""
      <h2>You're ready for AI coaching, {first_name}</h2>
      <p>Your average score is <b>{avg_score}/100</b>. Users who upgrade to Professional at this stage improve <b>2.3× faster</b>.</p>
      <p>With Professional you get:</p>
      <ul style="color:#475569;line-height:2.2;padding-left:20px">
        <li>🤖 Gemini AI coaching — personalized narrative each session</li>
        <li>📄 Unlimited PDF health reports</li>
        <li>📊 Advanced analytics + trend detection</li>
        <li>👥 Team leaderboard</li>
        <li>🔔 Smart posture alerts</li>
      </ul>
      <p style="text-align:center">
        <a class="btn" href="{app_url}/billing">Upgrade to Professional →</a>
      </p>
      <p style="color:#94a3b8;font-size:13px">No commitment. Cancel any time. 14-day money-back guarantee.</p>
    """
    return subject, _base(subject, body)


def weekly_digest(first_name: str, week_avg: int = 75, sessions: int = 5,
                   streak: int = 4, top_alert: str = "neck_tilt",
                   improvement: int = 3, rank: str = "3rd",
                   app_url: str = APP_URL, **_) -> tuple[str, str]:
    alert_labels = {
        "neck_tilt":"Neck Tilt","forward_head":"Forward Head",
        "shoulder_imbalance":"Shoulder Imbalance","body_lean":"Body Lean",
    }
    alert_label = alert_labels.get(top_alert, top_alert.replace("_"," ").title())
    trend = "📈" if improvement > 0 else "📉" if improvement < 0 else "➡️"
    subject = f"Your weekly posture digest — {first_name}"
    body = f"""
      <h2>Weekly Summary {trend}</h2>
      <div class="stat-row">
        <div class="stat"><div class="val">{week_avg}</div><div class="lbl">Week Avg</div></div>
        <div class="stat"><div class="val">{sessions}</div><div class="lbl">Sessions</div></div>
        <div class="stat"><div class="val">{streak}d</div><div class="lbl">Streak</div></div>
        <div class="stat"><div class="val">{rank}</div><div class="lbl">Team Rank</div></div>
      </div>
      {"<div class='tip'>📈 You improved by " + str(improvement) + " points this week. Keep going!</div>" if improvement > 0 else ""}
      <p><b>Most common issue this week:</b> {alert_label}. Try a short neck stretch every 90 minutes.</p>
      <p style="text-align:center">
        <a class="btn" href="{app_url}">View Full Report →</a>
      </p>
    """
    return subject, _base(subject, body)


def win_back_7d(first_name: str, last_score: int = 0,
                app_url: str = APP_URL, **_) -> tuple[str, str]:
    subject = f"We miss you, {first_name} 👋"
    body = f"""
      <h2>It's been a week, {first_name}</h2>
      <p>Your posture doesn't take a break — even when you do! 😄</p>
      {f"<p>Your last score was <b>{last_score}/100</b>. Let's see if we can beat it.</p>" if last_score else ""}
      <p style="text-align:center">
        <a class="btn" href="{app_url}">Come back →</a>
      </p>
    """
    return subject, _base(subject, body)


def win_back_14d(first_name: str, app_url: str = APP_URL, **_) -> tuple[str, str]:
    subject = f"{first_name}, your posture needs you 🪑"
    body = f"""
      <h2>2 weeks without a session</h2>
      <p>Research shows posture habits decay within 10 days without reinforcement. Let's get back on track.</p>
      <div class="tip">🎁 <b>Special offer:</b> Come back this week and get a free AI report on your posture history.</div>
      <p style="text-align:center">
        <a class="btn" href="{app_url}">Resume my streak →</a>
      </p>
    """
    return subject, _base(subject, body)


def win_back_30d(first_name: str, app_url: str = APP_URL, **_) -> tuple[str, str]:
    subject = f"Last chance — your Corvus trial is expiring, {first_name}"
    body = f"""
      <h2>We don't want to lose you</h2>
      <p>It's been 30 days. We're offering you <b>30% off</b> your first paid month if you come back this week.</p>
      <p style="text-align:center">
        <a class="btn" href="{app_url}/billing?promo=COMEBACK30">Claim 30% off →</a>
      </p>
      <p style="color:#94a3b8;font-size:13px">Offer expires in 7 days. No credit card required to restart.</p>
    """
    return subject, _base(subject, body)


def payment_failed(first_name: str, invoice_id: str = "", amount: float = 0,
                    retry_date: str = "", app_url: str = APP_URL, **_) -> tuple[str, str]:
    subject = f"Action required: payment failed for your Corvus account"
    body = f"""
      <h2>⚠️ Payment failed</h2>
      <p>Hi {first_name}, we couldn't process your payment{f' for invoice {invoice_id}' if invoice_id else ''}.</p>
      {f"<p><b>Amount:</b> ${amount:.2f}</p>" if amount else ""}
      {f"<p>We'll retry on <b>{retry_date}</b>. To avoid interruption, please update your payment method now.</p>" if retry_date else ""}
      <p style="text-align:center">
        <a class="btn" href="{app_url}/billing">Update payment method →</a>
      </p>
      <p style="color:#94a3b8;font-size:13px">Your account will remain active during the retry period. Questions? Reply to this email.</p>
    """
    return subject, _base(subject, body)


def trial_ending(first_name: str, days_left: int = 3,
                  app_url: str = APP_URL, **_) -> tuple[str, str]:
    subject = f"Your Corvus trial ends in {days_left} day{'s' if days_left != 1 else ''}"
    body = f"""
      <h2>⏰ Trial ending soon</h2>
      <p>Hi {first_name}, your free trial ends in <b>{days_left} day{'s' if days_left != 1 else ''}</b>.</p>
      <p>Upgrade now to keep your streak, history, and AI coaching without interruption.</p>
      <p style="text-align:center">
        <a class="btn" href="{app_url}/billing">Upgrade now →</a>
      </p>
      <p style="color:#94a3b8;font-size:13px">Starter plan is always free. No credit card required.</p>
    """
    return subject, _base(subject, body)


def nps_survey(first_name: str, survey_url: str = "", **_) -> tuple[str, str]:
    subject = f"Quick question for you, {first_name} (30 seconds)"
    url = survey_url or f"{APP_URL}/nps"
    body = f"""
      <h2>How are we doing? 🙏</h2>
      <p>Hi {first_name}, you've been using Corvus for 30 days. We'd love your honest feedback.</p>
      <p><b>On a scale of 0–10, how likely are you to recommend Corvus to a colleague?</b></p>
      <p style="text-align:center;font-size:28px;letter-spacing:6px">
        {"".join(f'<a href="{url}?score={i}" style="color:#6366f1;text-decoration:none">{i}</a> ' for i in range(11))}
      </p>
      <p style="text-align:center;font-size:12px;color:#94a3b8">0 = Not at all · 10 = Definitely</p>
    """
    return subject, _base(subject, body)


# ── Template registry ─────────────────────────────────────────────
TEMPLATE_FUNCS = {
    "welcome":        welcome,
    "day1_tip":       day1_tip,
    "day3_activate":  day3_activate,
    "day7_report":    day7_report,
    "day14_upsell":   day14_upsell,
    "weekly_digest":  weekly_digest,
    "win_back_7d":    win_back_7d,
    "win_back_14d":   win_back_14d,
    "win_back_30d":   win_back_30d,
    "payment_failed": payment_failed,
    "trial_ending":   trial_ending,
    "nps_survey":     nps_survey,
}


def render(template_key: str, **context) -> tuple[str, str] | None:
    """Render a template. Returns (subject, html) or None if key not found."""
    fn = TEMPLATE_FUNCS.get(template_key)
    if fn is None:
        return None
    return fn(**context)
