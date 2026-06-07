"""
PostureAI Pro — AI Routes Blueprint  
Handles: Gemini proxy, AI analytics, coach chat, predictive, heatmaps
"""
from flask import Blueprint, request, jsonify, g
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.middleware import require_auth, require_tier
from middleware.errors import safe_error

ai_bp = Blueprint("ai", __name__, url_prefix="/api")

def register_ai_routes(app):
    app.register_blueprint(ai_bp)
