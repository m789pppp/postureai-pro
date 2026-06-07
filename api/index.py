# PostureAI Pro — Vercel Serverless Entry Point
# Vercel runs this file as a Python serverless function
# All /api/* requests are routed here via vercel.json

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Import the Flask app from backend
from backend import app

# Vercel expects the WSGI app to be named 'app'
# backend.py already exports 'app' so we're good
