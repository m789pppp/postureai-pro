"""
Corvus — Health & Readiness Routes
Provides: /api/health, /api/ready, /api/version
Used by: Docker HEALTHCHECK, Railway, load balancers, monitoring
"""
import os
import sys
import time
import logging
from flask import Blueprint, jsonify

health_bp = Blueprint("health", __name__)
logger = logging.getLogger("corvus.health")

_start_time = time.time()

# Same rule as auth/middleware.py and backend.py: "explicitly development",
# not "not production". An unset FLASK_ENV must not select the lenient branch.
_FLASK_ENV = os.getenv("FLASK_ENV", "").strip().lower()
IS_EXPLICIT_DEV = _FLASK_ENV in ("development", "dev", "debug", "local", "test")

# Variables the deployment cannot do its job without. Reported by NAME only —
# never a value, not even a prefix.
#
# This used to list five. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and
# FIREBASE_PRIVATE_KEY are fields inside the service-account JSON, and
# api/_lib/env.js now derives them from FIREBASE_SERVICE_ACCOUNT_JSON, so
# there are two things to set. They are still checked below, because a
# deployment can have them set individually without the JSON.
REQUIRED_ENV = {
    "FLASK_ENV":                     "production-only behaviour (error detail, webhook signature checks)",
    "FIREBASE_SERVICE_ACCOUNT_JSON": "server-side token verification, and the source the JS handlers' Firebase credentials are derived from",
}

# Not required to run, but each one silently disables a feature the UI still
# offers. These are warnings, not failures — the point is that nobody should
# have to discover "no email is configured" by watching an invite never
# arrive.
OPTIONAL_ENV = {
    "REDIS_URL":        "shared rate limiting (without it, per-process only — on serverless, close to none)",
    "RESEND_API_KEY":   "outbound email: invites, welcome, weekly reports (or set SMTP_HOST instead)",
    "KASHIER_API_KEY":  "card and Vodafone Cash payments (the checkout the UI offers)",
    "VITE_SENTRY_DSN":  "error reporting — without it a crash in front of a user is invisible to you",
}


def _has(name):
    return bool(os.getenv(name, "").strip())


def _config_report():
    """
    Which variables are absent, by name.

    This block exists because every symptom of the real problem was
    misleading. The deployment answered /api/health with 200, /api/ready with
    "ready", /api/announcements with an empty list, and /api/referral/stats
    with an opaque platform crash — while the actual cause was unset
    environment variables. An operator had no single place to look.
    """
    missing = [k for k in REQUIRED_ENV if not _has(k)]

    # The JS handlers need these three. Either set directly, or derived from
    # the service-account JSON by api/_lib/env.js.
    derived = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]
    if not _has("FIREBASE_SERVICE_ACCOUNT_JSON"):
        missing += [k for k in derived if not _has(k)]

    # Email is satisfied by either provider.
    degraded = []
    for k, why in OPTIONAL_ENV.items():
        if k == "RESEND_API_KEY" and (_has("RESEND_API_KEY") or _has("SMTP_HOST")):
            continue
        if not _has(k):
            degraded.append({"name": k, "disables": why})

    return {
        "missing_env": missing,
        "why": {k: REQUIRED_ENV.get(k, "Firestore access from the serverless JS handlers")
                for k in missing},
        "degraded": degraded,
        "ok": not missing,
    }


@health_bp.route("/api/health", methods=["GET"])
def health():
    """
    Liveness probe — responds fast, minimal checks.
    Returns 200 if process is alive.
    """
    cfg = _config_report()
    return jsonify({
        "status": "ok",
        "service": "corvus-backend",
        # The literal value, and "(unset)" when there isn't one. It used to
        # default to "development", which reads like a deliberate setting and
        # hid the fact that nothing was configured at all.
        "env": _FLASK_ENV or "(unset)",
        "config": cfg,
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
        # Without Firebase Admin the server cannot verify a single token, so
        # it is not ready to serve traffic. This used to require
        # FLASK_ENV == "production" to count, which meant the live deployment
        # reported "ready" while no authentication was possible.
        if not _firebase_ok and not IS_EXPLICIT_DEV:
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
        # DB failure IS fatal anywhere that is not an explicit dev box.
        if not IS_EXPLICIT_DEV:
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
        "env": _FLASK_ENV or "(unset)",
        "commit": os.getenv("GIT_COMMIT", "local"),
    }), 200
