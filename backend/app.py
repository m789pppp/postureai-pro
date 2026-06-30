"""
Corvus — Application Entry Point v3
Modular architecture — previously monolithic backend.py (5,539 lines)
is now organized into focused modules.

Module map:
  auth/middleware.py       → Authentication, RBAC decorators
  config/pricing.py        → Server-side pricing (SECURITY CRITICAL)
  middleware/errors.py     → Centralized error handling
  routes/analysis.py       → /api/analyze, /api/session/*
  routes/billing.py        → /api/paymob/*, /api/stripe/*, /api/billing/*
  routes/ai_routes.py      → /api/ai/*, /api/coach/*
  routes/admin.py          → /api/admin/*
  routes/enterprise.py     → /api/hr/*, /api/org/*, /api/audit/*
  routes/analytics.py      → /api/analytics/*, /api/reports/*
  routes/notifications.py  → /api/notify/*, /api/webhooks/*
  
For backward compatibility, backend.py is still loaded — all routes
remain available. New code goes into the module files.
"""
import os
import sys

# Allow imports from this directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the main app from backend.py (backward compat during migration)
from backend import app  # noqa: F401

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5050))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    print(f"🚀 Corvus starting on port {port} (debug={debug})")
    app.run(host="0.0.0.0", port=port, debug=debug)
