"""
PostureAI Pro — Analytics Routes Blueprint
Handles: posture insights, heatmaps, gamification, reports
"""
from flask import Blueprint, request, jsonify, g
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.middleware import require_auth, require_tier
from middleware.errors import safe_error

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api")

def register_analytics_routes(app):
    app.register_blueprint(analytics_bp)
