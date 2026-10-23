"""
Corvus — MFA Backend (ULTIMATE v5)
TOTP (Google Authenticator) + SMS via Twilio + Backup codes

Endpoints (registered in backend.py):
  POST /api/auth/mfa/totp/setup     → generate secret + QR URI
  POST /api/auth/mfa/totp/verify    → verify TOTP code + enable MFA
  POST /api/auth/mfa/sms/send       → send SMS verification code
  POST /api/auth/mfa/sms/verify     → verify SMS code + enable MFA
  POST /api/auth/mfa/disable        → disable MFA (requires password re-confirm)
  GET  /api/auth/mfa/backup-codes   → regenerate backup codes
"""
import os, base64, hashlib, secrets, time
from typing import Optional

# ── TOTP ─────────────────────────────────────────────────────────
try:
    import pyotp
    PYOTP_OK = True
except ImportError:
    PYOTP_OK = False

# ── Twilio SMS ────────────────────────────────────────────────────
TWILIO_SID   = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM  = os.getenv("TWILIO_PHONE_NUMBER", "")

try:
    if TWILIO_SID and TWILIO_TOKEN:
        from twilio.rest import Client as TwilioClient
        _twilio = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
        TWILIO_OK = True
    else:
        _twilio   = None
        TWILIO_OK = False
except ImportError:
    _twilio   = None
    TWILIO_OK = False


# ── SMS code store (Redis-backed, in-memory fallback) ─────────────
# Was `from services.redis_service import get_redis` — that name doesn't
# exist in that module at all (get_redis() is a different, unrelated
# connection-pool helper defined directly in backend.py, used by
# flask-limiter's storage backend). The import always raised ImportError,
# silently caught below, so _redis was unconditionally None — not just
# when Redis is unconfigured (this deployment's actual, intentional
# state), but always, everywhere, regardless of REDIS_URL.
#
# Net effect: send_sms_code() below skipped storing the code (its `if
# _redis:` guard was always false) but still sent the real, Twilio-billed
# SMS and returned True — "Code sent" — while verify_sms_code()'s `if
# not _redis: return False` meant NO code could ever verify. SMS MFA was
# 100% broken for every user who ever tried to set it up: real SMS sent,
# guaranteed "Invalid or expired code" on entry, no way to succeed.
#
# rset/rget/rdel are this same services.redis_service module's own
# helpers and already have an in-memory fallback when Redis itself isn't
# configured — exactly what this needed instead of a raw client handle.
try:
    from services.redis_service import rset as _rset, rget as _rget, rdel as _rdel
    _SMS_STORE_OK = True
except Exception:
    _SMS_STORE_OK = False

SMS_CODE_TTL = 600  # 10 minutes


def generate_totp_secret() -> str:
    """Generate a new TOTP secret and return it base32-encoded."""
    if not PYOTP_OK:
        raise RuntimeError("pyotp not installed")
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str, issuer: str = "Corvus") -> str:
    """Return an otpauth:// URI for QR code rendering."""
    if not PYOTP_OK:
        raise RuntimeError("pyotp not installed")
    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    """Verify a 6-digit TOTP code. Allows ±1 window for clock skew."""
    if not PYOTP_OK or not secret or not code:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(code.strip(), valid_window=1)


def send_sms_code(phone: str, uid: str) -> bool:
    """Generate and send a 6-digit SMS verification code."""
    if not TWILIO_OK or not _twilio:
        return False
    if not _SMS_STORE_OK:
        # Sending a code nobody can ever verify is worse than not sending
        # it — this used to still text the user and claim success here.
        return False
    code = str(secrets.randbelow(900000) + 100000)
    _rset(f"mfa:sms:{uid}", code, SMS_CODE_TTL)
    try:
        _twilio.messages.create(
            body=f"Your Corvus verification code: {code}. Expires in 10 minutes.",
            from_=TWILIO_FROM,
            to=phone,
        )
        return True
    except Exception as e:
        import sys
        print(f"[mfa] Twilio error: {e}", file=sys.stderr)
        _rdel(f"mfa:sms:{uid}")  # don't leave a code stored for a text that never sent
        return False


def verify_sms_code(uid: str, code: str) -> bool:
    """Verify the SMS code stored for this user."""
    if not _SMS_STORE_OK:
        return False
    stored = _rget(f"mfa:sms:{uid}")
    if not stored:
        return False
    ok = secrets.compare_digest(stored.decode() if isinstance(stored, bytes) else stored, code.strip())
    if ok:
        _rdel(f"mfa:sms:{uid}")  # one-time use
    return ok


def generate_backup_codes(count: int = 8) -> list[str]:
    """Generate one-time backup codes in format XXXX-XXXX."""
    codes = []
    for _ in range(count):
        part1 = secrets.token_hex(2).upper()
        part2 = secrets.token_hex(2).upper()
        codes.append(f"{part1}-{part2}")
    return codes


def hash_backup_code(code: str) -> str:
    """Hash a backup code for secure storage."""
    return hashlib.sha256(code.strip().upper().encode()).hexdigest()
