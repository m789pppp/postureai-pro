"""
Corvus — Centralized Error Handling
SECURITY: Stack traces are NEVER returned to API clients in production.
          All tracebacks are logged to stderr only.
"""
import os
import sys
import traceback
import logging
from flask import jsonify

logger = logging.getLogger("corvus.errors")

IS_PRODUCTION = os.getenv("FLASK_ENV", "development") == "production"


def safe_error(e: Exception, msg: str = "Internal server error", status: int = 500):
    """
    Return a safe error response.
    - Production: generic message only, traceback to stderr
    - Development: includes traceback in response for debugging
    """
    tb = traceback.format_exc()
    print(f"[error] {type(e).__name__}: {e}\n{tb}", file=sys.stderr, flush=True)

    if IS_PRODUCTION:
        return jsonify({"error": msg, "status": status}), status
    else:
        return jsonify({"error": str(e), "trace": tb, "status": status}), status


def safe_error_json(e: Exception, msg: str = "Internal server error", status: int = 500):
    """Same as safe_error but returns the dict (for use inside already-built responses)."""
    tb = traceback.format_exc()
    print(f"[error] {type(e).__name__}: {e}\n{tb}", file=sys.stderr, flush=True)
    if IS_PRODUCTION:
        return {"error": msg, "status": status}, status
    return {"error": str(e), "trace": tb, "status": status}, status


def register_error_handlers(app):
    """Register Flask global error handlers on the app instance."""
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Endpoint not found", "status": 404}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed", "status": 405}), 405

    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        return jsonify({"error": "Rate limit exceeded — please slow down", "status": 429}), 429

    @app.errorhandler(500)
    def internal_error(e):
        print(f"[500] Unhandled: {e}\n{traceback.format_exc()}", file=sys.stderr)
        return jsonify({"error": "Internal server error", "status": 500}), 500
