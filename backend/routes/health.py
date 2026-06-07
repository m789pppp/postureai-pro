"""
PostureAI Pro — Health & Readiness Routes
Provides: /api/health, /api/ready, /api/version
Used by: Docker HEALTHCHECK, Railway, load balancers, monitoring
"""
import os
import sys
import time
import logging
from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__)
logger = logging.getLogger("postureai.health")

_start_time = time.time()


@health_bp.route("/api/health", methods=["GET"])
def health():
    """
    Liveness probe — responds fast, minimal checks.
    Returns 200 if process is alive.
    """
    return jsonify({
        "status": "ok",
        "service": "postureai-backend",
        "env": os.getenv("FLASK_ENV", "development"),
        "uptime_sec": round(time.time() - _start_time),
    }), 200


@health_bp.route("/api/ready", methods=["GET"])
def ready():
    """
    Readiness probe — checks all dependencies.
    Returns 503 if not ready to serve traffic.
    """
    checks = {}
    overall = True

    # ── Firebase check ─────────────────────────────────────────
    try:
        from auth.middleware import _firebase_ok
        checks["firebase"] = "ok" if _firebase_ok else "not_configured"
        if not _firebase_ok and os.getenv("FLASK_ENV") == "production":
            overall = False
    except Exception as e:
        checks["firebase"] = f"error: {e}"
        overall = False

    # ── Redis check ────────────────────────────────────────────
    try:
        from services.redis_service import redis_health
        rh = redis_health()
        checks["redis"] = rh.get("status", "unknown")
    except Exception as e:
        checks["redis"] = f"error: {e}"
        # Redis failure is non-fatal (graceful degradation)

    # ── Supabase / DB check ────────────────────────────────────
    try:
        from services.db_service import get_db
        db = get_db()
        # Quick ping: select 1 from platform_settings limit 1
        result = db.table("platform_settings").select("key").limit(1).execute()
        checks["supabase"] = "ok" if result else "degraded"
    except Exception as e:
        checks["supabase"] = f"error: {str(e)[:80]}"
        # DB failure IS fatal in production
        if os.getenv("FLASK_ENV") == "production":
            overall = False

    # ── Stripe check ───────────────────────────────────────────
    stripe_key = os.getenv("STRIPE_SECRET_KEY", "")
    checks["stripe"] = "configured" if stripe_key.startswith("sk_") else "not_configured"

    # ── Email check ────────────────────────────────────────────
    checks["email"] = "resend" if os.getenv("RESEND_API_KEY") else \
                      "smtp" if os.getenv("SMTP_HOST") else "not_configured"

    status_code = 200 if overall else 503
    return jsonify({
        "status": "ready" if overall else "not_ready",
        "checks": checks,
        "uptime_sec": round(time.time() - _start_time),
    }), status_code


@health_bp.route("/api/version", methods=["GET"])
def version():
    """Return build info."""
    return jsonify({
        "version": os.getenv("APP_VERSION", "17.0.0"),
        "python": sys.version.split()[0],
        "env": os.getenv("FLASK_ENV", "development"),
        "commit": os.getenv("GIT_COMMIT", "local"),
    }), 200
