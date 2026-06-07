"""
PostureAI Pro — Enterprise Routes Blueprint
Handles: HR import, org management, audit logs, RBAC, seat management
"""
from flask import Blueprint, request, jsonify, g
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.middleware import require_auth, require_admin, require_hr, require_org
from middleware.errors import safe_error

enterprise_bp = Blueprint("enterprise", __name__, url_prefix="/api")

def register_enterprise_routes(app):
    app.register_blueprint(enterprise_bp)
