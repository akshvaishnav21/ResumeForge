import sys
import os

# Add the backend directory to Python path so app.* imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.main import app  # noqa: F401 — Vercel detects this ASGI app automatically
