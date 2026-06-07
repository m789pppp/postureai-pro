"""
PostureAI Pro — Redis Service
Unified Redis wrapper for: sessions, caching, rate limiting, queues, realtime buffers
Supports: Railway Redis, Upstash Redis, local Redis
Falls back to in-memory if Redis unavailable (development mode)
"""
import os
import json
import time
import hashlib
from typing import Any, Optional

# ── Connection ─────────────────────────────────────────────────────
REDIS_URL = (
    os.getenv("REDIS_URL") or
    os.getenv("REDIS_PRIVATE_URL") or
    os.getenv("UPSTASH_REDIS_REST_URL") or
    ""
)

_redis = None
_redis_ok = False

def _connect_redis():
    global _redis, _redis_ok
    if not REDIS_URL:
        print("ℹ️  Redis: No REDIS_URL — using in-memory fallback")
        return False
    try:
        import redis
        r = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=3, socket_timeout=3)
        r.ping()
        _redis = r
        _redis_ok = True
        print(f"✅ Redis connected: {REDIS_URL[:30]}...")
        return True
    except ImportError:
        print("⚠️  redis-py not installed — run: pip install redis")
        return False
    except Exception as e:
        print(f"⚠️  Redis connection failed: {e} — using in-memory fallback")
        return False

_connect_redis()

# ── In-memory fallback ─────────────────────────────────────────────
_mem: dict = {}
_mem_ttls: dict = {}

def _mem_get(key: str) -> Optional[str]:
    ttl = _mem_ttls.get(key)
    if ttl and time.time() > ttl:
        _mem.pop(key, None); _mem_ttls.pop(key, None); return None
    return _mem.get(key)

def _mem_set(key: str, val: str, ttl_s: int = 0):
    _mem[key] = val
    if ttl_s > 0: _mem_ttls[key] = time.time() + ttl_s

def _mem_delete(key: str):
    _mem.pop(key, None); _mem_ttls.pop(key, None)

def _mem_incr(key: str) -> int:
    v = int(_mem.get(key, 0)) + 1
    _mem[key] = str(v)
    return v

def _mem_expire(key: str, ttl_s: int):
    if key in _mem: _mem_ttls[key] = time.time() + ttl_s

def _mem_keys(pattern: str) -> list:
    import fnmatch
    now = time.time()
    return [k for k in _mem if fnmatch.fnmatch(k, pattern) and (k not in _mem_ttls or _mem_ttls[k] > now)]

# ── Core Redis operations ──────────────────────────────────────────
def rget(key: str) -> Optional[str]:
    if _redis_ok:
        try: return _redis.get(key)
        except Exception: pass
    return _mem_get(key)

def rset(key: str, value: str, ttl_s: int = 0) -> bool:
    if _redis_ok:
        try:
            if ttl_s > 0: _redis.setex(key, ttl_s, value)
            else:          _redis.set(key, value)
            return True
        except Exception: pass
    _mem_set(key, value, ttl_s)
    return True

def rdel(key: str) -> bool:
    if _redis_ok:
        try: _redis.delete(key); return True
        except Exception: pass
    _mem_delete(key)
    return True

def rincr(key: str, ttl_s: int = 0) -> int:
    if _redis_ok:
        try:
            v = _redis.incr(key)
            if ttl_s > 0 and v == 1: _redis.expire(key, ttl_s)
            return v
        except Exception: pass
    v = _mem_incr(key)
    if ttl_s > 0 and v == 1: _mem_expire(key, ttl_s)
    return v

def rkeys(pattern: str) -> list:
    if _redis_ok:
        try: return list(_redis.keys(pattern))
        except Exception: pass
    return _mem_keys(pattern)

def rpush(key: str, value: str, max_len: int = 100) -> int:
    if _redis_ok:
        try:
            v = _redis.lpush(key, value)
            _redis.ltrim(key, 0, max_len - 1)
            return v
        except Exception: pass
    lst = json.loads(_mem.get(key, "[]"))
    lst.insert(0, value)
    _mem[key] = json.dumps(lst[:max_len])
    return len(lst)

def rlist(key: str, limit: int = 100) -> list:
    if _redis_ok:
        try: return _redis.lrange(key, 0, limit - 1)
        except Exception: pass
    return json.loads(_mem.get(key, "[]"))[:limit]

# ── Cache helpers ──────────────────────────────────────────────────
def cache_get(key: str) -> Any:
    v = rget(f"cache:{key}")
    if v is None: return None
    try: return json.loads(v)
    except: return v

def cache_set(key: str, value: Any, ttl_s: int = 300):
    rset(f"cache:{key}", json.dumps(value), ttl_s)

def cache_delete(key: str):
    rdel(f"cache:{key}")

def cache_delete_pattern(pattern: str):
    for k in rkeys(f"cache:{pattern}"):
        rdel(k)

# ── Session management ─────────────────────────────────────────────
SESSION_TTL = 3600 * 24 * 7  # 7 days

def session_set(session_id: str, data: dict):
    rset(f"session:{session_id}", json.dumps(data), SESSION_TTL)

def session_get(session_id: str) -> Optional[dict]:
    v = rget(f"session:{session_id}")
    return json.loads(v) if v else None

def session_delete(session_id: str):
    rdel(f"session:{session_id}")

# ── Posture score buffer (realtime smoothing) ──────────────────────
def push_score(uid: str, score: int):
    """Push score to per-user buffer for smoothing."""
    rpush(f"scores:{uid}", str(score), max_len=10)

def get_smoothed_score(uid: str) -> Optional[float]:
    """Get exponentially smoothed score from buffer."""
    scores = [int(s) for s in rlist(f"scores:{uid}", 10) if s.isdigit()]
    if not scores: return None
    alpha = 0.35
    smoothed = scores[-1]
    for s in reversed(scores[:-1]):
        smoothed = alpha * s + (1 - alpha) * smoothed
    return round(smoothed, 1)

# ── Blink rate buffer (eye strain) ────────────────────────────────
def push_blink(uid: str, ear: float, ts: float = None):
    """Record eye aspect ratio for blink detection."""
    ts = ts or time.time()
    rpush(f"blinks:{uid}", json.dumps({"ear": ear, "ts": ts}), max_len=120)

def get_blink_rate(uid: str) -> dict:
    """Calculate blink rate per minute from buffer."""
    entries = []
    for item in rlist(f"blinks:{uid}", 120):
        try: entries.append(json.loads(item))
        except: pass

    now = time.time()
    recent = [e for e in entries if now - e["ts"] < 60]
    if len(recent) < 5:
        return {"rate": None, "risk": "unknown", "samples": len(recent)}

    blinks = 0
    was_closed = False
    for e in reversed(recent):
        ear = e["ear"]
        if ear < 0.25 and not was_closed:
            blinks += 1; was_closed = True
        elif ear >= 0.25:
            was_closed = False

    risk = "high" if blinks < 8 else "moderate" if blinks < 12 else "normal"
    return {"rate": blinks, "risk": risk, "samples": len(recent)}

# ── Rate limiting ──────────────────────────────────────────────────
def check_rate_limit(key: str, max_calls: int, window_s: int) -> tuple[bool, int]:
    """Returns (allowed, current_count)."""
    rk  = f"rl:{key}"
    cnt = rincr(rk, window_s)
    return cnt <= max_calls, cnt

# ── Risk tracker (webhook triggers) ───────────────────────────────
def set_risk_start(uid: str, score: int):
    """Record when low score started for webhook threshold."""
    existing = rget(f"risk:{uid}")
    if not existing:
        rset(f"risk:{uid}", json.dumps({"score": score, "since": time.time()}), 600)

def clear_risk(uid: str):
    rdel(f"risk:{uid}")

def get_risk_duration(uid: str) -> Optional[float]:
    v = rget(f"risk:{uid}")
    if not v: return None
    data = json.loads(v)
    return time.time() - data["since"]

# ── Queue system (background jobs) ────────────────────────────────
def queue_job(queue_name: str, job: dict) -> bool:
    """Push a job to a named queue."""
    job["queued_at"] = time.time()
    rpush(f"queue:{queue_name}", json.dumps(job), max_len=1000)
    return True

def dequeue_job(queue_name: str) -> Optional[dict]:
    """Pop a job from queue (FIFO)."""
    if _redis_ok:
        try:
            v = _redis.rpop(f"queue:{queue_name}")
            return json.loads(v) if v else None
        except Exception: pass
    # In-memory: get from list
    lst = json.loads(_mem.get(f"queue:{queue_name}", "[]"))
    if not lst: return None
    job = lst.pop(-1)
    _mem[f"queue:{queue_name}"] = json.dumps(lst)
    return job

def queue_length(queue_name: str) -> int:
    if _redis_ok:
        try: return _redis.llen(f"queue:{queue_name}")
        except Exception: pass
    return len(json.loads(_mem.get(f"queue:{queue_name}", "[]")))

# ── Health check ───────────────────────────────────────────────────
def redis_health() -> dict:
    if _redis_ok:
        try:
            _redis.ping()
            info = _redis.info("server") if hasattr(_redis, "info") else {}
            return {
                "status":  "connected",
                "version": info.get("redis_version", "unknown"),
                "url":     REDIS_URL[:25] + "..." if REDIS_URL else "",
                "memory_keys": len(list(_redis.keys("*")[:100])),
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}
    return {
        "status":  "memory_fallback",
        "keys":    len(_mem),
        "note":    "Add REDIS_URL to enable persistent Redis",
    }
