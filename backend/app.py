"""
Corvus — Application Entry Point v3

backend.py is the actual application: nearly all routes live there
in one file (16,000+ lines). A 2025 attempt to split it into
routes/admin.py, ai_routes.py, analytics.py, billing.py, and
enterprise.py was abandoned before any routes were actually moved —
those files were empty Blueprint shells, never registered, and have
been removed (2026-07) rather than left as misleading scaffolding.

What's real and actually in use:
  auth/middleware.py        → Authentication, RBAC decorators — used throughout backend.py
  config/pricing.py         → Server-side pricing (SECURITY CRITICAL) — used throughout backend.py
  middleware/errors.py      → Centralized error handling — used throughout backend.py
  routes/health.py          → /api/health/* — registered blueprint
  routes/stripe_billing.py  → /api/stripe/* — registered blueprint

Everything else (/api/admin/*, /api/ai/*, /api/analytics/*, /api/hr/*,
/api/paymob/*, /api/audit/*, and the rest) is defined directly in
backend.py. If a real modularization is attempted again, do it by
actually moving routes into a module AND registering the blueprint
in the same change — not by adding an empty shell for someone else
to fill in later.
"""
import os
import sys

# Allow imports from this directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# backend.py is the real application — not a legacy compat shim.
from backend import app  # noqa: F401

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5050))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    print(f"🚀 Corvus starting on port {port} (debug={debug})")
    app.run(host="0.0.0.0", port=port, debug=debug)
