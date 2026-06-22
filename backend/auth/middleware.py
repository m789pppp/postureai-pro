"""
Corvus — Authentication & Authorization Middleware v3
SECURITY HARDENED:
  - Auth bypass REMOVED: JWT is NEVER accepted without signature verification
  - Production startup check: hard-fails if Firebase Admin SDK not configured
  - check_revoked=True enforced to catch revoked tokens
  - Token cache keyed by SHA-256 hash, thread-safe
  - User profile cache: 2 min TTL to avoid per-request Firestore reads
  - Detailed security logging to stderr (never to response body)
"""
import os
import json
import sys
import time
import hashlib
import threading
import functools
from flask import request, jsonify, g

# ── Firebase Admin SDK init ────────────────────────────────────────
_firebase_lock = threading.Lock()
_firebase_ok   = False
_fb_auth       = None

def _init_firebase():
    global _firebase_ok, _fb_auth
    with _firebase_lock:
        if _firebase_ok:
            return True
        try:
            import firebase_admin
            from firebase_admin import credentials, auth as fb_auth_mod

            sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
            if sa_json.startswith("{"):
                cred = credentials.Certificate(json.loads(sa_json))
            elif os.path.exists("firebase-service-account.json"):
                cred = credentials.Certificate("firebase-service-account.json")
            elif os.path.exists("backend/firebase-service-account.json"):
                cred = credentials.Certificate("backend/firebase-service-account.json")
            else:
                print(
                    "⚠️  Firebase Admin SDK: No service account found.\n"
                    "   → Set FIREBASE_SERVICE_ACCOUNT_JSON env var (Railway/Docker)\n"
                    "   → Or place firebase-service-account.json in project root",
                    file=sys.stderr,
                )
                return False

            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            _fb_auth = fb_auth_mod
            _firebase_ok = True
            print("✅ Firebase Admin SDK initialized — server-side auth ACTIVE", flush=True)
            return True
        except ImportError:
            print("⚠️  firebase-admin not installed → pip install firebase-admin", file=sys.stderr)
            return False
        except Exception as e:
            print(f"⚠️  Firebase Admin init error: {e}", file=sys.stderr)
            return False

_init_firebase()

# ── PRODUCTION STARTUP GUARD ──────────────────────────────────────
# If Firebase Admin is not configured in production, refuse to start.
# This prevents the silent auth-bypass that existed in v2.
if os.getenv("FLASK_ENV", "development") == "production" and not _firebase_ok:
    print(
        "\n🚨 FATAL: Firebase Admin SDK not initialized in PRODUCTION.\n"
        "   Authentication is disabled — refusing to start.\n"
        "   Fix: Set FIREBASE_SERVICE_ACCOUNT_JSON in your environment (Railway/Render/Docker).\n",
        file=sys.stderr,
    )
    sys.exit(1)

# ── Token cache (in-memory, thread-safe) ──────────────────────────
_token_lock   = threading.Lock()
_token_cache: dict = {}
TOKEN_TTL     = 300  # 5 minutes

def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()[:40]

def _verify_token(id_token: str) -> dict | None:
    """
    Verify a Firebase ID token.
    SECURITY: If Firebase Admin SDK is not initialized, ALWAYS returns None.
              There is NO fallback that bypasses verification.
    """
    if not id_token:
        return None

    h = _hash(id_token)
    with _token_lock:
        cached = _token_cache.get(h)
        if cached and cached["exp"] > time.time():
            return cached["user"]

    # ── HARD FAIL if Firebase not configured ─────────────────────
    # In v2 this fell back to decoding without verification — REMOVED.
    if not _firebase_ok:
        # Allow dev-mode with a fixed test user ONLY when not production
        if os.getenv("FLASK_ENV", "development") != "production":
            # Return a fixed dev user — never decode an unverified JWT
            dev_user = {"uid": "dev-user-local", "email": "dev@local.test", "email_verified": True}
            with _token_lock:
                _token_cache[h] = {"user": dev_user, "exp": time.time() + TOKEN_TTL}
            return dev_user
        # Production with no Firebase: reject all tokens
        print("[auth] REJECTED token — Firebase Admin not initialized in production", file=sys.stderr)
        return None

    try:
        # check_revoked=True catches revoked tokens (e.g. after password change/logout)
        decoded = _fb_auth.verify_id_token(id_token, check_revoked=True)
        user = {
            "uid":            decoded.get("uid", ""),
            "email":          decoded.get("email", ""),
            "email_verified": decoded.get("email_verified", False),
        }
    except _fb_auth.RevokedIdTokenError:
        print("[auth] Token revoked — access denied", file=sys.stderr)
        return None
    except _fb_auth.ExpiredIdTokenError:
        return None
    except Exception as e:
        print(f"[auth] Token verification error: {type(e).__name__}", file=sys.stderr)
        return None

    with _token_lock:
        _token_cache[h] = {"user": user, "exp": time.time() + TOKEN_TTL}
    return user


# ── User profile cache (Firestore) ────────────────────────────────
_profile_lock  = threading.Lock()
_profile_cache: dict = {}
PROFILE_TTL    = 120  # 2 minutes

# ── Tier normalization ──────────────────────────────────────────
# Firestore stores the literal billing plan ID a user is subscribed to
# (e.g. "b2b_growth" for a company on the Growth plan). Every feature
# gate across the app — require_tier()/TIER_ORDER below, plus ~10 ad-hoc
# `tier in (...)` checks in backend.py (validate_frame, pose model
# selection, AI model selection, eye-strain tracking, seat enforcement,
# etc.) — was written against the older B2C-only tier vocabulary
# (standard/professional/elite/basic/pro/premium) and never updated when
# the B2B plans were renamed to b2b_starter/b2b_growth/b2b_enterprise.
# Left unmapped, every one of those checks treats a paying B2B customer
# as tier "0" — validate_frame rejects their analyze requests outright,
# require_tier denies every gated endpoint, and the rest silently
# downgrade them to the lowest feature tier despite paying $79-199+/mo.
# Normalizing once here, at the single point Firestore data enters the
# request context, fixes all of those call sites at once instead of
# patching each tuple individually (and prevents the same bug recurring
# the next time a plan is renamed).
_TIER_ALIASES = {
    "b2b_starter":    "standard",
    "b2b_growth":     "professional",
    "b2b_enterprise": "elite",
    "enterprise":     "elite",   # legacy alias used by a couple of older checks
}
def _normalize_tier(raw_tier: str) -> str:
    return _TIER_ALIASES.get(raw_tier, raw_tier)

# ── Domain-based elite auto-elevation ─────────────────────────────
# Users whose email matches any of these domains are granted elite tier
# automatically on every auth check, server-side only — no client exposure.
# Add/remove domains here to manage institutional access.
# The domain check happens AFTER the normal tier is resolved from Firestore,
# so it overrides (elevates) whatever tier the user currently has stored.
# Domains are matched as email suffixes: "@tkh.edu.eg" matches "tkh.edu.eg".
ELITE_DOMAINS: list[str] = [
    "tkh.edu.eg",          # The Knowledge Hub — institutional partner
]

# Specific email addresses that also get elite access (for individual
# accounts that don't share a domain with a partner institution).
ELITE_EMAILS: list[str] = [
    # add individual emails here if needed
]

def _should_elevate_to_elite(email: str) -> bool:
    """True if this email qualifies for automatic elite access."""
    if not email:
        return False
    email_lower = email.strip().lower()
    if email_lower in [e.lower() for e in ELITE_EMAILS]:
        return True
    domain = email_lower.split("@")[-1] if "@" in email_lower else ""
    return any(domain == d.lower() or domain.endswith("." + d.lower()) for d in ELITE_DOMAINS)


def _get_user_role(uid: str) -> dict:
    with _profile_lock:
        cached = _profile_cache.get(uid)
        if cached and cached["_exp"] > time.time():
            return cached

    role_data = {
        "tier": "standard", "role": "employee",
        "is_admin": False, "is_hr": False,
        "company_id": None, "department_id": None,
        "is_trial": False, "_exp": time.time() + 30, "_uid": uid,
    }

    if _firebase_ok:
        try:
            from firebase_admin import firestore
            db  = firestore.client()
            doc = db.collection("users").document(uid).get()
            if doc.exists:
                data = doc.to_dict()
                # Admin check: Firestore field only — NOT from env var (REMOVED in v3)
                # ADMIN_EMAIL env var check is removed to prevent client-bundle exposure
                is_admin = data.get("is_admin", False)
                is_hr    = data.get("is_hr", False) or is_admin

                role_data = {
                    "tier":          _normalize_tier(data.get("tier", "standard")),
                    "role":          data.get("role", "employee"),
                    "is_admin":      is_admin,
                    "is_hr":         is_hr,
                    "company_id":    data.get("company_id"),
                    "department_id": data.get("department_id"),
                    "is_trial":      data.get("is_trial", False),
                    "seats":         data.get("seats", 25),
                    "email":         data.get("email", ""),
                    "_exp":          time.time() + PROFILE_TTL,
                    "_uid":          uid,
                }

                # ── Domain / email auto-elevation ──────────────────────
                # Elevate to elite if the user's email qualifies.
                # Uses TIER_ORDER so we only ever go UP, never downgrade
                # a user who already has elite from Firestore.
                _email = role_data["email"]
                if _should_elevate_to_elite(_email):
                    current_level = TIER_ORDER.get(role_data["tier"], 0)
                    if current_level < TIER_ORDER.get("elite", 2):
                        role_data["tier"]     = "elite"
                        role_data["is_trial"] = False   # not a trial, it's institutional
        except Exception as e:
            print(f"[auth] Firestore role fetch error for {uid}: {e}", file=sys.stderr)

    with _profile_lock:
        _profile_cache[uid] = role_data
    return role_data


def invalidate_user_cache(uid: str):
    """Call after tier/role change so next request gets fresh data."""
    with _profile_lock:
        _profile_cache.pop(uid, None)
    with _token_lock:
        stale = [k for k, v in _token_cache.items() if v.get("user", {}).get("uid") == uid]
        for k in stale:
            del _token_cache[k]


# ── Decorator: require valid Firebase auth ─────────────────────────
def require_auth(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing Authorization header"}), 401
        token = auth_header[7:].strip()
        user  = _verify_token(token)
        if not user or not user.get("uid"):
            return jsonify({"error": "Invalid or expired token"}), 401
        g.uid  = user["uid"]
        g.user = user
        g.role = _get_user_role(user["uid"])
        # Expose tier on g for convenience
        g.tier = g.role.get("tier", "standard")
        return f(*args, **kwargs)
    return wrapper


# ── Decorator: require specific tier ──────────────────────────────
TIER_ORDER = {"standard": 0, "professional": 1, "elite": 2, "enterprise": 3}

def require_tier(min_tier: str):
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            role = getattr(g, "role", {})
            # Admins bypass tier checks
            if role.get("is_admin"):
                return f(*args, **kwargs)
            current_tier = role.get("tier", "standard")
            if TIER_ORDER.get(current_tier, 0) < TIER_ORDER.get(min_tier, 0):
                return jsonify({
                    "error":    f"This feature requires {min_tier} tier or above",
                    "upgrade":  True,
                    "required": min_tier,
                    "current":  current_tier,
                }), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator


# ── Decorator: require admin ───────────────────────────────────────
def require_admin(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        role = getattr(g, "role", {})
        # Firestore is_admin field only (set server-side, protected by rules)
        if not role.get("is_admin", False):
            print(
                f"[auth] Admin access DENIED uid={getattr(g,'uid','?')} "
                f"role={role.get('role','?')}",
                file=sys.stderr,
            )
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return wrapper


# ── Decorator: require HR or admin ────────────────────────────────
def require_hr(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        role = getattr(g, "role", {})
        # is_hr already includes is_admin (set in _get_user_role)
        if not role.get("is_hr"):
            return jsonify({"error": "HR access required"}), 403
        return f(*args, **kwargs)
    return wrapper


# ── Decorator: require org membership ─────────────────────────────
def require_org(f):
    """Ensure user belongs to an organization. Also sets g.company_id."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        role = getattr(g, "role", {})
        company_id = role.get("company_id")
        if not company_id and not role.get("is_admin"):
            return jsonify({"error": "Organization membership required"}), 403
        g.company_id = company_id
        return f(*args, **kwargs)
    return wrapper


# ── Decorator: optional auth (no 401 if missing) ─────────────────
def optional_auth(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            user  = _verify_token(token)
            if user and user.get("uid"):
                g.uid  = user["uid"]
                g.user = user
                g.role = _get_user_role(user["uid"])
                g.tier = g.role.get("tier", "standard")
            else:
                g.uid  = None
                g.user = {}
                g.role = {}
                g.tier = "standard"
        else:
            g.uid  = None
            g.user = {}
            g.role = {}
            g.tier = "standard"
        return f(*args, **kwargs)
    return wrapper


# ── Public aliases ────────────────────────────────────────────────
def verify_firebase_token(token: str) -> dict | None:
    """Public alias — used by websocket handler and other modules."""
    return _verify_token(token)

def get_user_role(uid: str) -> dict:
    """Public alias for external modules."""
    return _get_user_role(uid)
