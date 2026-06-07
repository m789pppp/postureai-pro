"""
PostureAI — Celery Beat Schedule (ULTIMATE v12)
Runs daily jobs: email sequences, weekly digest, NPS surveys, health score refresh.

Start worker:
  celery -A services.celery_app worker --loglevel=info
Start scheduler:
  celery -A services.celery_beat beat --loglevel=info
Or combined:
  celery -A services.celery_beat worker --beat --loglevel=info --concurrency=2
"""
import os, logging
from celery import Celery
from celery.schedules import crontab

log = logging.getLogger("postureai.beat")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

app = Celery("postureai_beat", broker=REDIS_URL, backend=REDIS_URL)

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
                        subject="Quick question about PostureAI (30 seconds) 🙏",
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
                subject="Action needed — PostureAI payment failed",
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
