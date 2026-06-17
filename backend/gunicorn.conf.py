"""
Corvus — Gunicorn Configuration
Optimized for Railway/Render deployment with Redis session store.
"""
import os
import multiprocessing

# ── Binding ────────────────────────────────────────────────────────
port    = int(os.getenv("PORT", 5050))
bind    = f"0.0.0.0:{port}"

# ── Workers ────────────────────────────────────────────────────────
# NOTE: CPU-bound MediaPipe analysis is now in Celery workers.
# Web workers only handle lightweight request routing.
# Keep low to avoid memory pressure (MediaPipe uses ~500MB per worker).
# With MediaPipe now lazy-loaded, web workers don't load it at startup.
# Keep worker count low: 2 web workers handle routing, Celery workers do CPU-heavy analysis.
# This prevents OOM crashes on Railway Starter plan (512MB).
workers     = int(os.getenv("WEB_CONCURRENCY", 2))
worker_class = "sync"
threads     = 2  # Allow 2 threads per worker for I/O-bound tasks

# ── Timeouts ───────────────────────────────────────────────────────
timeout          = int(os.getenv("GUNICORN_TIMEOUT", 60))
keepalive        = 5
graceful_timeout = 30

# ── Logging ────────────────────────────────────────────────────────
accesslog   = "-"   # stdout
errorlog    = "-"   # stderr
loglevel    = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s %(D)sμs'

# ── Process Name ───────────────────────────────────────────────────
proc_name = "corvus-web"

# ── Pre-fork hooks ─────────────────────────────────────────────────
def on_starting(server):
    print(f"🚀 Corvus starting: {workers} workers on :{port}")

def worker_exit(server, worker):
    print(f"Worker {worker.pid} exited")

def post_fork(server, worker):
    """
    Called after each worker is forked.
    Re-initialize per-worker resources here.
    """
    pass
