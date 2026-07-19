"""
Corvus — Celery Beat Schedule (ULTIMATE v12)
Runs daily jobs: email sequences, weekly digest, NPS surveys, health score refresh.

Start worker:
  celery -A services.celery_app worker --loglevel=info
Start scheduler:
  celery -A services.celery_beat beat --loglevel=info
Or combined:
  celery -A services.celery_beat worker --beat --loglevel=info --concurrency=2
"""
import os, logging
from datetime import datetime
from celery import Celery
from celery.schedules import crontab

log = logging.getLogger("corvus.beat")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

app = Celery("corvus_beat", broker=REDIS_URL, backend=REDIS_URL)

app.conf.update(
    timezone                 = "Africa/Cairo",
    enable_utc               = True,
    task_serializer          = "json",
    result_serializer        = "json",
    accept_content           = ["json"],
    task_track_started       = True,
    task_acks_late           = True,
    worker_prefetch_multiplier = 1,
)

app.conf.beat_schedule = {
    # Daily nurture emails at 09:00 Cairo time
    "daily-email-sequences": {
        "task":     "services.celery_beat.run_daily_sequences",
        "schedule": crontab(hour=9, minute=0),
    },
    # Weekly digest every Monday 08:00
    "weekly-digest": {
        "task":     "services.celery_beat.send_weekly_digests",
        "schedule": crontab(hour=8, minute=0, day_of_week="monday"),
    },
    # NPS survey at Day 30 + Day 90 (checked daily)
    "nps-triggers": {
        "task":     "services.celery_beat.trigger_nps_surveys",
        "schedule": crontab(hour=10, minute=30),
    },
    # Payment dunning — check failed payments every 6h
    "payment-dunning": {
        "task":     "services.celery_beat.run_payment_dunning",
        "schedule": crontab(minute=0, hour="*/6"),
    },
    # Refresh org health scores every 4h
    "org-health-refresh": {
        "task":     "services.celery_beat.refresh_org_health",
        "schedule": crontab(minute=15, hour="*/4"),
    },
    # Smart streak reminders — runs every hour; the task itself passes the
    # current hour to /api/push/streak-reminder, which only actually
    # notifies users whose own computed usual-session hour matches. This
    # replaces a single fixed 19:00-for-everyone send with a per-user time.
    "smart-streak-reminders": {
        "task":     "services.celery_beat.run_smart_streak_reminders",
        "schedule": crontab(minute=0, hour="*"),
    },
}


@app.task(bind=True, max_retries=3, default_retry_delay=300)
def run_daily_sequences(self):
    """Pull all active users from Firestore and run email lifecycle."""
    try:
        import firebase_admin
        from firebase_admin import firestore as fb_firestore
        if not firebase_admin._apps:
            log.error("[beat] Firebase not initialized")
            return {"status": "error", "reason": "firebase_not_initialized"}

        db  = fb_firestore.client()
        now = __import__("datetime").datetime.utcnow()
        processed, sent, failed = 0, 0, 0

        # Process in batches of 100
        users = db.collection("users").where("tier", "!=", "").stream()
        for doc in users:
            u = doc.to_dict() or {}
            if not u.get("email"):
                continue
            try:
                result = __import__("services.email_sequences", fromlist=["run_sequence"]).run_sequence(
                    uid         = u.get("uid", doc.id),
                    email       = u["email"],
                    name        = u.get("name", ""),
                    plan        = u.get("tier", "starter"),
                    created_at  = u.get("created_at", now.isoformat()),
                    last_active = u.get("last_active_at"),
                    extra       = {
                        "avg_score": u.get("avg_score", 0),
                        "sessions":  u.get("total_sessions", 0),
                        "streak":    u.get("streak", 0),
                    },
                )
                sent    += len(result.get("sent", []))
                failed  += len(result.get("skipped", []))
                processed += 1
            except Exception as e:
                log.error("[beat] Sequence error for %s: %s", u.get("email"), e)

        log.info("[beat] Daily sequences: %d users, %d sent, %d failed", processed, sent, failed)
        return {"processed": processed, "sent": sent, "failed": failed}
    except Exception as exc:
        log.error("[beat] run_daily_sequences failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=600)
def send_weekly_digests(self):
    """Send weekly posture digest to all active users."""
    try:
        from services.email_sequences import EmailCtx, send_email
        import firebase_admin
        from firebase_admin import firestore as fb_firestore
        db  = fb_firestore.client()
        sent = 0
        for doc in db.collection("users").where("tier", "!=", "").stream():
            u = doc.to_dict() or {}
            if not u.get("email"):
                continue
            ctx = EmailCtx(
                to_email=u["email"], to_name=u.get("name",""),
                uid=doc.id, plan=u.get("tier","starter"),
                template_key="weekly_digest",
                subject="Your weekly posture digest 📊",
                data={"avg_score": u.get("avg_score",0), "streak": u.get("streak",0)},
            )
            if send_email(ctx):
                sent += 1
        log.info("[beat] Weekly digest: %d sent", sent)
        return {"sent": sent}
    except Exception as exc:
        log.error("[beat] weekly_digest failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=2)
def trigger_nps_surveys(self):
    """Send NPS surveys at Day 30 and Day 90."""
    try:
        from services.email_sequences import EmailCtx, send_email
        import firebase_admin
        from firebase_admin import firestore as fb_firestore
        from datetime import datetime, timedelta
        db  = fb_firestore.client()
        now = datetime.utcnow()
        sent = 0
        for doc in db.collection("users").stream():
            u = doc.to_dict() or {}
            if not u.get("email") or not u.get("created_at"):
                continue
            try:
                created = datetime.fromisoformat(u["created_at"].rstrip("Z"))
                days    = (now - created).days
                if days in (30, 90) and not u.get(f"nps_sent_day{days}"):
                    ctx = EmailCtx(
                        to_email=u["email"], to_name=u.get("name",""),
                        uid=doc.id, plan=u.get("tier","starter"),
                        template_key="nps_survey",
                        subject="Quick question about Corvus (30 seconds) 🙏",
                        data={"uid": doc.id},
                    )
                    if send_email(ctx):
                        db.collection("users").document(doc.id).update({f"nps_sent_day{days}": True})
                        sent += 1
            except Exception:
                pass
        log.info("[beat] NPS surveys sent: %d", sent)
        return {"sent": sent}
    except Exception as exc:
        log.error("[beat] nps_surveys failed: %s", exc)
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=2)
def run_payment_dunning(self):
    """Notify users with failed payments."""
    try:
        from services.email_sequences import EmailCtx, send_email
        import firebase_admin
        from firebase_admin import firestore as fb_firestore
        db = fb_firestore.client()
        sent = 0
        snap = db.collection("users").where("payment_ok", "==", False).stream()
        for doc in snap:
            u = doc.to_dict() or {}
            if not u.get("email"):
                continue
            ctx = EmailCtx(
                to_email=u["email"], to_name=u.get("name",""),
                uid=doc.id, plan=u.get("tier","starter"),
                template_key="payment_failed",
                subject="Action needed — Corvus payment failed",
            )
            if send_email(ctx):
                sent += 1
        log.info("[beat] Dunning emails sent: %d", sent)
        return {"sent": sent}
    except Exception as exc:
        log.error("[beat] dunning failed: %s", exc)
        raise self.retry(exc=exc)


@app.task
def refresh_org_health():
    """Recompute and cache org health scores in Redis."""
    try:
        import firebase_admin
        from firebase_admin import firestore as fb_firestore
        import redis, json, os
        db  = fb_firestore.client()
        rdb = redis.from_url(os.getenv("REDIS_URL","redis://localhost:6379/0"), decode_responses=True)
        companies = set()
        for doc in db.collection("users").where("company_id", "!=", "").stream():
            u = doc.to_dict() or {}
            if u.get("company_id"):
                companies.add(u["company_id"])
        for cid in companies:
            snap   = db.collection("users").where("company_id","==",cid).stream()
            scores = [d.to_dict().get("avg_score",0) for d in snap if d.to_dict().get("avg_score")]
            avg    = round(sum(scores)/len(scores),1) if scores else 0
            rdb.setex(f"org_health:{cid}", 14400, json.dumps({"avg": avg, "members": len(scores)}))
        log.info("[beat] Health scores refreshed for %d companies", len(companies))
        return {"companies": len(companies)}
    except Exception as e:
        log.error("[beat] health refresh failed: %s", e)
        return {"error": str(e)}


@app.task(bind=True, max_retries=2)
def run_smart_streak_reminders(self):
    """
    Runs hourly. Sends a streak reminder only to users whose own computed
    usual-session hour (from their session history, or a manual override
    in push_preferences) matches the current UTC hour — replacing a single
    fixed 19:00-for-everyone send with a per-user smart time, and
    respecting each user's "streak" notification category preference.
    """
    from collections import Counter
    try:
        import firebase_admin
        from firebase_admin import firestore as fb_firestore, messaging as fb_messaging
        db = fb_firestore.client()
        current_hour = datetime.utcnow().hour
        today = datetime.utcnow().date()

        def compute_preferred_hour(uid):
            docs = (db.collection("sessions").where("uid", "==", uid)
                      .order_by("created_at", direction=fb_firestore.Query.DESCENDING)
                      .limit(30).stream())
            hours = [d.to_dict().get("created_at").hour for d in docs
                     if d.to_dict().get("created_at") and hasattr(d.to_dict().get("created_at"), "hour")]
            if len(hours) < 5:
                return 19
            return Counter(hours).most_common(1)[0][0]

        token_docs = db.collection("push_tokens").where("active", "==", True).limit(1000).stream()
        uids_seen, sent, skipped = set(), 0, 0

        for tdoc in token_docs:
            td = tdoc.to_dict()
            uid, tok, lang = td.get("uid"), td.get("token"), td.get("lang", "en")
            if not uid or not tok or uid in uids_seen:
                continue
            uids_seen.add(uid)

            pref_doc = db.collection("push_preferences").document(uid).get()
            pdata = pref_doc.to_dict() if pref_doc.exists else {}
            if not pdata.get("categories", {}).get("streak", True):
                skipped += 1
                continue
            user_hour = pdata.get("preferred_hour_override")
            if user_hour is None:
                user_hour = compute_preferred_hour(uid)
            if int(user_hour) != current_hour:
                skipped += 1
                continue

            today_sessions = (db.collection("sessions").where("uid", "==", uid)
                                 .where("created_at", ">=", datetime.utcnow().replace(hour=0, minute=0, second=0))
                                 .limit(1).stream())
            if any(True for _ in today_sessions):
                skipped += 1
                continue

            is_ar = lang == "ar"
            title = "💪 تحقق من وضعيتك اليوم" if is_ar else "💪 Check your posture today"
            body  = "حافظ على سلسلتك اليومية" if is_ar else "Keep your daily streak going"
            try:
                msg = fb_messaging.Message(
                    notification=fb_messaging.Notification(title=title, body=body),
                    data={"type": "streak_reminder"}, token=tok,
                )
                fb_messaging.send(msg)
                sent += 1
            except Exception:
                pass

        log.info("[beat] Smart streak reminders — sent:%d skipped:%d hour:%d", sent, skipped, current_hour)
        return {"sent": sent, "skipped": skipped, "hour": current_hour}
    except Exception as exc:
        log.error("[beat] smart streak reminders failed: %s", exc)
        raise self.retry(exc=exc)
