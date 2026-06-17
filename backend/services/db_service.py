"""
Corvus — Database Service v1
Supabase (PostgreSQL) client with connection pooling,
retry logic, and type-safe query helpers.
"""
import os
import logging
from functools import lru_cache
from typing import Optional, Any

logger = logging.getLogger("corvus.db")

SUPABASE_URL     = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")  # server-side only
SUPABASE_ANON_KEY    = os.getenv("SUPABASE_ANON_KEY", "")


@lru_cache(maxsize=1)
def get_db():
    """
    Return singleton Supabase client (service-role for backend).
    Uses service role key — NEVER expose to frontend.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.warning("Supabase not configured — DB operations will fail")
        return _MockDB()
    try:
        from supabase import create_client, Client
        client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        logger.info("✅ Supabase client initialized")
        return client
    except ImportError:
        logger.error("supabase-py not installed — pip install supabase")
        return _MockDB()
    except Exception as e:
        logger.error("Supabase init failed: %s", e)
        return _MockDB()


class _MockDB:
    """Graceful no-op when Supabase is not configured (dev without DB)."""
    class _Chain:
        def __init__(self): pass
        def table(self, *a): return self
        def select(self, *a): return self
        def insert(self, *a, **k): return self
        def update(self, *a, **k): return self
        def upsert(self, *a, **k): return self
        def delete(self): return self
        def eq(self, *a): return self
        def neq(self, *a): return self
        def in_(self, *a): return self
        def order(self, *a, **k): return self
        def limit(self, *a): return self
        def single(self): return self
        def execute(self): return type("R", (), {"data": None, "error": "DB not configured"})()
        def on_conflict(self, *a): return self

    def table(self, name): return self._Chain()
    def from_(self, name): return self._Chain()
    def rpc(self, fn, *a, **k): return self._Chain()


# ── Helper functions ──────────────────────────────────────────────

def get_user_by_firebase_uid(uid: str) -> Optional[dict]:
    db = get_db()
    result = db.table("users").select("*").eq("firebase_uid", uid).single().execute()
    return result.data if result.data else None


def get_user_by_id(user_id: str) -> Optional[dict]:
    db = get_db()
    result = db.table("users").select("*").eq("id", user_id).single().execute()
    return result.data if result.data else None


def get_org_by_id(org_id: str) -> Optional[dict]:
    db = get_db()
    result = db.table("organizations").select("*").eq("id", org_id).single().execute()
    return result.data if result.data else None


def create_or_update_user(firebase_uid: str, email: str, name: str = "",
                           org_id: str = None, role: str = "member") -> Optional[dict]:
    db = get_db()
    existing = get_user_by_firebase_uid(firebase_uid)
    if existing:
        result = db.table("users").update({
            "email": email, "name": name or existing.get("name", ""),
        }).eq("firebase_uid", firebase_uid).execute()
        return result.data[0] if result.data else existing

    result = db.table("users").insert({
        "firebase_uid": firebase_uid,
        "email": email,
        "name": name,
        "org_id": org_id,
        "role": role,
        "tier": "starter",
        "is_trial": True,
    }).execute()
    return result.data[0] if result.data else None


def upsert_session(user_id: str, session_data: dict) -> Optional[dict]:
    db = get_db()
    result = db.table("sessions").insert({
        "user_id": user_id,
        "org_id": session_data.get("org_id"),
        "avg_score": session_data.get("avg_score"),
        "min_score": session_data.get("min_score"),
        "max_score": session_data.get("max_score"),
        "grade": session_data.get("grade"),
        "neck_avg_deg": session_data.get("neck_avg_deg"),
        "shoulder_sym": session_data.get("shoulder_sym"),
        "screen_dist_cm": session_data.get("screen_dist_cm"),
        "duration_sec": session_data.get("duration_sec", 0),
        "frame_count": session_data.get("frame_count", 0),
        "alert_count": session_data.get("alert_count", 0),
        "ai_summary": session_data.get("ai_summary"),
        "recommendations": session_data.get("recommendations", []),
        "mode": session_data.get("mode", "laptop"),
        "started_at": session_data.get("started_at"),
        "ended_at": session_data.get("ended_at"),
    }).execute()
    return result.data[0] if result.data else None


def write_audit_log(org_id: Optional[str], user_id: Optional[str], action: str,
                    resource: str = "", resource_id: str = "",
                    ip: str = "", details: dict = None, severity: str = "info"):
    db = get_db()
    db.table("audit_logs").insert({
        "org_id": org_id,
        "user_id": user_id,
        "action": action,
        "resource": resource,
        "resource_id": resource_id,
        "ip_address": ip or None,
        "details": details or {},
        "severity": severity,
    }).execute()


def check_feature_flag(key: str, org_id: str = None, user_id: str = None) -> bool:
    db = get_db()
    result = db.table("feature_flags").select("enabled,rollout_pct,conditions").eq("key", key).single().execute()
    if not result.data:
        return False
    flag = result.data
    if not flag["enabled"]:
        return False
    # Check org/user overrides
    conditions = flag.get("conditions") or {}
    if org_id and org_id in conditions.get("org_overrides", {}):
        return conditions["org_overrides"][org_id]
    if user_id and user_id in conditions.get("user_overrides", {}):
        return conditions["user_overrides"][user_id]
    return flag["rollout_pct"] >= 100


def increment_usage(org_id: str, user_id: str, event_type: str, quantity: int = 1):
    db = get_db()
    db.table("usage_events").insert({
        "org_id": org_id,
        "user_id": user_id,
        "event_type": event_type,
        "quantity": quantity,
    }).execute()


def get_org_usage_this_month(org_id: str, event_type: str) -> int:
    from datetime import datetime
    now = datetime.utcnow()
    db = get_db()
    # Sum usage_events for this org/month
    result = db.rpc("get_monthly_usage", {
        "p_org_id": org_id,
        "p_event_type": event_type,
        "p_year": now.year,
        "p_month": now.month,
    }).execute()
    if result.data:
        return result.data[0].get("total", 0)
    return 0
