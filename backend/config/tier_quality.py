"""
Corvus — Server-Side Tier Quality Configuration
SOURCE OF TRUTH for how AI Coach depth (tokens/persona) scales with
the user's NORMALIZED feature tier.

g.tier is already normalized by auth/middleware.py _normalize_tier()
before any route sees it — b2b_starter/b2b_growth/b2b_enterprise have
already collapsed onto standard/professional/elite by the time the
keys below are looked up. Do NOT re-map b2b_* here.

LOCAL-ONLY AI: every tier shares the same local Ollama model
(LOCAL_LLM_MODEL in backend.py) — there's no cloud model tier to pick
between, so "quality" differentiation here is token budget (longer
budget = more thorough answer) and the depth/persona instruction
appended to the system prompt, not which model answers.

MUST match (numerically, for monthly_limit) the existing Redis
counters this file's monthly_limit values are derived from:
  backend/backend.py coach_chat()
MUST mirror (tokens/depth dimensions):
  frontend/src/lib/tierQuality.js -> QUALITY
Keep both in sync if the ladder ever changes.
"""

AI_COACH_QUALITY: dict[str, dict] = {
    "standard":     {"monthly_limit": 5,  "max_tokens": 350,  "depth": "brief"},
    "basic":        {"monthly_limit": 10, "max_tokens": 450,  "depth": "brief"},
    "professional": {"monthly_limit": 50, "max_tokens": 700,  "depth": "standard"},
    "elite":        {"monthly_limit": -1, "max_tokens": 1100, "depth": "clinical"},
    # ── legacy aliases kept for old Firestore docs / older code paths ──
    "pro":          {"monthly_limit": 30, "max_tokens": 700,  "depth": "standard"},
    "premium":      {"monthly_limit": -1, "max_tokens": 1100, "depth": "clinical"},
    "enterprise":   {"monthly_limit": -1, "max_tokens": 1100, "depth": "clinical"},
}

# Appended to the existing sys_prompt built in coach_chat() — adjusts
# HOW the answer is written, not WHAT data it references (the existing
# avg_score/sessions/top_alerts context block stays identical for everyone).
DEPTH_INSTRUCTIONS: dict[str, str] = {
    "brief": (
        "Tone & length: this user is on the free/entry tier — keep your reply SHORT "
        "(1-2 short paragraphs), with exactly one clear, simple, actionable tip. "
        "No deep clinical explanation."
    ),
    "standard": (
        "Tone & length: give a clear, well-organized answer (2-4 short paragraphs) "
        "with specific, actionable steps that reference their actual data."
    ),
    "clinical": (
        "Tone & length: this user is on the top tier and expects depth comparable to "
        "a paid physiotherapy consult. Explain the underlying ergonomic/biomechanical "
        "mechanism briefly, reference their specific trend data, give a concrete "
        "multi-step personalized plan, and suggest what to monitor next session."
    ),
}


def get_coach_quality(tier: str) -> dict:
    """Returns the AI Coach quality dict for an already-normalized tier string."""
    return AI_COACH_QUALITY.get(tier, AI_COACH_QUALITY["standard"])


def get_depth_instruction(tier: str) -> str:
    depth = get_coach_quality(tier).get("depth", "brief")
    return DEPTH_INSTRUCTIONS.get(depth, DEPTH_INSTRUCTIONS["brief"])
