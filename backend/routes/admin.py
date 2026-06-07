"""
PostureAI Pro — Admin Routes Blueprint
All routes require @require_auth + @require_admin
"""
from flask import Blueprint, request, jsonify, g
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.middleware import require_auth, require_admin
from middleware.errors import safe_error

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

def register_admin_routes(app):
    app.register_blueprint(admin_bp)
