"""
PostureAI Pro — Billing Routes Blueprint
Handles: Stripe, PayMob, usage tracking, proration, dunning, invoices
All pricing logic delegates to config/pricing.py (server-side authoritative)
"""
from flask import Blueprint, request, jsonify, g
import os, sys, threading
from datetime import datetime, timedelta

# Use parent-level imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.middleware import require_auth, require_admin
from config.pricing import (
    get_paymob_amount, get_stripe_amount, validate_plan_request,
    ALL_TIERS, PAID_TIERS,
)
from middleware.errors import safe_error

billing_bp = Blueprint("billing", __name__, url_prefix="/api")


# ── This module contains the blueprint definitions ────────────────
# Routes are registered in backend.py during the migration phase.
# Once fully migrated, backend.py will be replaced by app.py + blueprints.
# For now, this file serves as the canonical reference implementation.

def register_billing_routes(app):
    """Register billing blueprint on a Flask app."""
    app.register_blueprint(billing_bp)
