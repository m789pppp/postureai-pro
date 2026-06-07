"""
PostureAI Pro — Celery Task Queue
Offloads CPU-heavy MediaPipe analysis from the Gunicorn web workers.

Architecture:
  Web worker (Gunicorn)  → accepts request → enqueues task → returns job_id immediately
  Celery worker          → picks up task → runs MediaPipe → stores result in Redis
  Client                 → polls GET /api/analyze/job/{job_id} until status=done

Setup:
  1. Set REDIS_URL env var
  2. Start workers: celery -A backend.services.celery_app worker --concurrency=2 --loglevel=info
  3. Or via Procfile: worker: celery -A backend.services.celery_app worker
"""
import os
import json
import time
import traceback
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "postureai",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,          # Results expire after 1 hour
    task_soft_time_limit=25,      # Soft kill after 25s (return error gracefully)
    task_time_limit=30,           # Hard kill after 30s
    worker_prefetch_multiplier=1, # Process one task at a time per worker (fair for CPU tasks)
    task_acks_late=True,          # Acknowledge only after task completes (safe retry on crash)
    task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
    result_backend_transport_options={
        "retry_policy": {"timeout": 5.0},
    },
)


@celery_app.task(bind=True, name="postureai.analyze_frame", max_retries=2)
def analyze_frame_task(self, frame_data: dict, uid: str, tier: str = "standard") -> dict:
    """
    Run MediaPipe pose + face analysis on a frame.
    Called asynchronously from the web worker.
    
    Args:
        frame_data: {image_b64, mode, lang, ...} from the API request
        uid: authenticated user ID (for blink rate smoothing in Redis)
        tier: user's subscription tier (controls model quality)
    
    Returns:
        Analysis result dict, same schema as the synchronous /api/analyze response
    """
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

        # Import analysis functions lazily (MediaPipe loads on first import)
        from backend import (
            analyze_front, analyze_side, analyze_blink_rate,
            analyze_front_cascade, analyze_side_cascade,
            analyze_with_gemini,
        )
        import base64
        import numpy as np
        import cv2

        image_b64 = frame_data.get("image", "")
        mode      = frame_data.get("mode", "laptop")
        lang      = frame_data.get("lang", "en")
        use_gemini = frame_data.get("use_gemini", False)

        # Decode base64 image
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]
        img_bytes = base64.b64decode(image_b64)
        np_arr    = np.frombuffer(img_bytes, np.uint8)
        image     = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if image is None:
            return {"error": "Could not decode image", "status": "failed"}

        # Run cascade analysis
        out = {}
        if mode in ("side", "side_view"):
            analyze_side_cascade(image, out)
        else:
            analyze_front_cascade(image, mode, out)

        # Blink detection
        if out.get("face_landmarks"):
            h, w = image.shape[:2]
            blink = analyze_blink_rate(out["face_landmarks"], w, h, uid=uid)
            if blink:
                out.update(blink)

        # Optional Gemini narrative (only if explicitly requested + tier allows)
        if use_gemini and tier in ("professional", "elite", "enterprise"):
            narrative = analyze_with_gemini(out, lang=lang)
            if narrative:
                out["ai_narrative"] = narrative

        out["status"] = "done"
        out["processed_at"] = time.time()
        return out

    except Exception as exc:
        tb = traceback.format_exc()
        print(f"[celery] analyze_frame_task failed: {exc}\n{tb}")
        # Retry up to 2 times with backoff
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@celery_app.task(name="postureai.send_email_async")
def send_email_task(to: str, subject: str, html: str) -> dict:
    """Send an email asynchronously — frees web worker immediately."""
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from backend import send_email
        send_email(to, subject, html)
        return {"sent": True, "to": to}
    except Exception as e:
        print(f"[celery] send_email_task error: {e}")
        return {"sent": False, "error": str(e)}


@celery_app.task(name="postureai.fire_webhook_async")
def fire_webhook_task(url: str, payload: dict, secret: str = "") -> dict:
    """Fire a webhook asynchronously with HMAC signature + retry."""
    import requests
    import hmac, hashlib, json, time

    body = json.dumps(payload, default=str)
    headers = {
        "Content-Type": "application/json",
        "User-Agent":   "PostureAI-Webhooks/3.0",
        "X-PostureAI-Timestamp": str(int(time.time())),
    }
    if secret:
        sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-PostureAI-Signature"] = f"sha256={sig}"

    try:
        resp = requests.post(url, data=body, headers=headers, timeout=10)
        return {"status": resp.status_code, "ok": resp.status_code < 400}
    except Exception as e:
        return {"status": 0, "ok": False, "error": str(e)}

# ── Celery Beat Schedule — runs daily/weekly jobs ──────────────────
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    # Daily email jobs: onboarding sequences, win-back, NPS
    "daily-email-jobs": {
        "task": "postureai.daily_email_jobs",
        "schedule": crontab(hour=7, minute=0),   # 09:00 Cairo time (UTC+2)
    },
    # Weekly digest: every Monday at 08:00 UTC
    "weekly-digest": {
        "task": "postureai.weekly_digest_jobs",
        "schedule": crontab(hour=8, minute=0, day_of_week=1),
    },
    # Hourly: fire pending webhooks that failed and need retry
    "webhook-retry": {
        "task": "postureai.retry_failed_webhooks",
        "schedule": crontab(minute=15),          # :15 past every hour
    },
    # Daily: compute churn risk scores for all orgs
    "churn-score-refresh": {
        "task": "postureai.refresh_churn_scores",
        "schedule": crontab(hour=6, minute=0),   # 08:00 Cairo
    },
}
celery_app.conf.timezone = "UTC"



@celery_app.task(bind=True, name="postureai.analyze_frame", max_retries=2)
def analyze_frame_task(self, frame_data: dict, uid: str, tier: str = "standard") -> dict:
    """
    Run MediaPipe pose + face analysis on a frame.
    Called asynchronously from the web worker.
    
    Args:
        frame_data: {image_b64, mode, lang, ...} from the API request
        uid: authenticated user ID (for blink rate smoothing in Redis)
        tier: user's subscription tier (controls model quality)
    
    Returns:
        Analysis result dict, same schema as the synchronous /api/analyze response
    """
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

        # Import analysis functions lazily (MediaPipe loads on first import)
        from backend import (
            analyze_front, analyze_side, analyze_blink_rate,
            analyze_front_cascade, analyze_side_cascade,
            analyze_with_gemini,
        )
        import base64
        import numpy as np
        import cv2

        image_b64 = frame_data.get("image", "")
        mode      = frame_data.get("mode", "laptop")
        lang      = frame_data.get("lang", "en")
        use_gemini = frame_data.get("use_gemini", False)

        # Decode base64 image
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]
        img_bytes = base64.b64decode(image_b64)
        np_arr    = np.frombuffer(img_bytes, np.uint8)
        image     = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if image is None:
            return {"error": "Could not decode image", "status": "failed"}

        # Run cascade analysis
        out = {}
        if mode in ("side", "side_view"):
            analyze_side_cascade(image, out)
        else:
            analyze_front_cascade(image, mode, out)

        # Blink detection
        if out.get("face_landmarks"):
            h, w = image.shape[:2]
            blink = analyze_blink_rate(out["face_landmarks"], w, h, uid=uid)
            if blink:
                out.update(blink)

        # Optional Gemini narrative (only if explicitly requested + tier allows)
        if use_gemini and tier in ("professional", "elite", "enterprise"):
            narrative = analyze_with_gemini(out, lang=lang)
            if narrative:
                out["ai_narrative"] = narrative

        out["status"] = "done"
        out["processed_at"] = time.time()
        return out

    except Exception as exc:
        tb = traceback.format_exc()
        print(f"[celery] analyze_frame_task failed: {exc}\n{tb}")
        # Retry up to 2 times with backoff
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@celery_app.task(name="postureai.send_email_async")
def send_email_task(to: str, subject: str, html: str) -> dict:
    """Send an email asynchronously — frees web worker immediately."""
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from backend import send_email
        send_email(to, subject, html)
        return {"sent": True, "to": to}
    except Exception as e:
        print(f"[celery] send_email_task error: {e}")
        return {"sent": False, "error": str(e)}


@celery_app.task(name="postureai.fire_webhook_async")
def fire_webhook_task(url: str, payload: dict, secret: str = "") -> dict:
    """Fire a webhook asynchronously with HMAC signature + retry."""
    import requests
    import hmac, hashlib, json, time

    body = json.dumps(payload, default=str)
    headers = {
        "Content-Type": "application/json",
        "User-Agent":   "PostureAI-Webhooks/3.0",
        "X-PostureAI-Timestamp": str(int(time.time())),
    }
    if secret:
        sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-PostureAI-Signature"] = f"sha256={sig}"

    try:
        resp = requests.post(url, data=body, headers=headers, timeout=10)
        return {"status": resp.status_code, "ok": resp.status_code < 400}
    except Exception as e:
        return {"status": 0, "ok": False, "error": str(e)}


# ── Celery Beat Schedule — runs daily/weekly jobs ──────────────────
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    # Daily email jobs: onboarding sequences, win-back, NPS
    "daily-email-jobs": {
        "task": "postureai.daily_email_jobs",
        "schedule": crontab(hour=7, minute=0),   # 09:00 Cairo time (UTC+2)
    },
    # Weekly digest: every Monday at 08:00 UTC
    "weekly-digest": {
        "task": "postureai.weekly_digest_jobs",
        "schedule": crontab(hour=8, minute=0, day_of_week=1),
    },
    # Hourly: fire pending webhooks that failed and need retry
    "webhook-retry": {
        "task": "postureai.retry_failed_webhooks",
        "schedule": crontab(minute=15),          # :15 past every hour
    },
    # Daily: compute churn risk scores for all orgs
    "churn-score-refresh": {
        "task": "postureai.refresh_churn_scores",
        "schedule": crontab(hour=6, minute=0),   # 08:00 Cairo
    },
}
celery_app.conf.timezone = "UTC"


@celery_app.task(name="postureai.daily_email_jobs")
def daily_email_jobs_task() -> dict:
    """Run all daily drip email sequences."""
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from services.email_sequences import run_daily_email_jobs
        import firebase_admin
        from google.cloud import firestore as _fs
        db = _fs.Client()
        sent = run_daily_email_jobs(db)
        return {"sent": sent, "status": "done"}
    except Exception as e:
        return {"sent": 0, "error": str(e)}



@celery_app.task(name="postureai.weekly_digest_jobs")
def weekly_digest_jobs_task() -> dict:
    """Send weekly digest emails to all active users."""
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from google.cloud import firestore as _fs
        from services.email_sequences import send_weekly_digest
        db = _fs.Client()
        users = db.collection("users").where("email_unsubscribed","!=",True).get()
        sent = 0
        for doc in users:
            u = doc.to_dict(); u["uid"] = doc.id
            week_stats = u.get("last_week_stats", {})
            if week_stats:
                if send_weekly_digest(db, u, week_stats):
                    sent += 1
        return {"sent": sent, "status": "done"}
    except Exception as e:
        return {"sent": 0, "error": str(e)}



@celery_app.task(name="postureai.retry_failed_webhooks")
def retry_failed_webhooks_task() -> dict:
    """Retry webhook deliveries that failed in the last hour."""
    try:
        import sys, os, json as _json, time
        import requests as _req
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from google.cloud import firestore as _fs
        db = _fs.Client()
        # Find failed webhook deliveries
        failed = (db.collection("webhook_logs")
                    .where("status","==","failed")
                    .where("retry_count","<",3)
                    .limit(50).get())
        retried = 0
        for doc in failed:
            d = doc.to_dict()
            try:
                resp = _req.post(d.get("url",""), json=d.get("payload",{}),
                                 headers={"Content-Type":"application/json"}, timeout=8)
                ok = resp.status_code < 400
                doc.reference.update({
                    "status": "delivered" if ok else "failed",
                    "retry_count": _fs.Increment(1),
                    "last_attempt": time.time(),
                })
                if ok: retried += 1
            except Exception:
                doc.reference.update({"retry_count": _fs.Increment(1), "last_attempt": time.time()})
        return {"retried": retried}
    except Exception as e:
        return {"retried": 0, "error": str(e)}



@celery_app.task(name="postureai.refresh_churn_scores")
def refresh_churn_scores_task() -> dict:
    """Recompute health + churn risk scores for all users and cache in Redis."""
    try:
        import sys, os, json as _json, time
        from datetime import datetime
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from google.cloud import firestore as _fs
        import redis as _redis
        db  = _fs.Client()
        rdb = _redis.from_url(os.getenv("REDIS_URL","redis://localhost:6379/0"))

        users = db.collection("users").get()
        now   = datetime.utcnow()
        processed = 0

        for doc in users:
            u = doc.to_dict(); uid = doc.id
            last_login = u.get("last_login_at")
            inactive_days = 0
            if last_login:
                try:
                    ll = datetime.fromisoformat(str(last_login))
                    inactive_days = (now - ll).days
                except Exception:
                    pass

            sessions_30 = u.get("sessions_30d", 0)
            avg_score   = u.get("avg_score", 0)

            login_freq   = max(0, 100 - inactive_days * 5)
            session_sig  = min(100, sessions_30 * 3)
            payment_sig  = 100 if u.get("payment_ok", True) else 50
            support_sig  = max(0, 100 - u.get("open_tickets", 0) * 10)

            health = int(
                login_freq  * 0.30 + session_sig * 0.25 +
                avg_score   * 0.20 + payment_sig * 0.15 + support_sig * 0.10
            )
            churn_risk = max(0, min(100, int((100 - health) * 0.7 + inactive_days * 1.2)))
            stage = ("champion" if health>=88 else "healthy" if health>=70 else
                     "at_risk" if health>=45 else "critical")

            cache_val = _json.dumps({"health":health,"churn_risk":churn_risk,"stage":stage,"ts":now.isoformat()})
            rdb.setex(f"churn:{uid}", 86400, cache_val)
            processed += 1

        return {"processed": processed, "status": "done"}
    except Exception as e:
        return {"processed": 0, "error": str(e)}

