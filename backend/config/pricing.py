"""
Corvus — Server-Side Pricing Configuration
SECURITY: This is the ONLY authoritative source of pricing.
          The frontend MUST NEVER determine payment amounts.
          All amount_cents values are generated here, server-side.

⚠️  THIS FILE IS THE ACTUAL SOURCE OF TRUTH — backend.py imports from here.
    If backend.py also defines _PAYMOB_PRICES/_STRIPE_PRICES locally, those
    are ONLY a fallback used if this import fails. Always update THIS file
    first, then keep backend.py's fallback copy in sync as a safety net.

    MUST match (exactly, including cents math):
      - frontend/src/Billing.jsx        (PLANS + B2B_PLANS)
      - frontend/src/App.jsx            (TIERS + B2B_TIERS)
      - frontend/src/PricingPage.jsx    (B2C_PLANS + B2B_PLANS)

Prices are in EGP (Egyptian Pounds) × 100 (cents) for PayMob,
and USD × 100 (cents) for Stripe.
"""

# ── B2C (Individual) Pricing — EGP via PayMob ─────────────────────
# Format: (tier, billing_cycle) → amount_cents
PAYMOB_PRICES_EGP: dict[tuple[str, str], int] = {
    ("basic",         "monthly"):    19900,   #   199 EGP/mo
    ("basic",         "yearly"):    159000,   # 1,590 EGP/yr  (20% off)
    ("professional",  "monthly"):   39900,   #   399 EGP/mo
    ("professional",  "yearly"):   319000,   # 3,190 EGP/yr  (20% off)
    ("elite",         "monthly"):   69900,   #   699 EGP/mo
    ("elite",         "yearly"):   559000,   # 5,590 EGP/yr  (20% off)
    # ── B2B (Company) — flat-rate, NOT per-seat ──
    ("b2b_starter",    "monthly"):  249900,   # 2,499 EGP/mo
    ("b2b_starter",    "yearly"):  2399000,   # 23,990 EGP/yr (20% off)
    ("b2b_growth",     "monthly"):  699900,   # 6,999 EGP/mo
    ("b2b_growth",     "yearly"):  6719000,   # 67,190 EGP/yr (20% off)
    # b2b_enterprise intentionally absent — always contact-sales/custom
}

# ── B2C (Individual) + B2B Pricing — USD via Stripe (Gulf/Global) ──
# Format: (tier, billing_cycle) → amount_cents (USD cents)
STRIPE_PRICES_USD: dict[tuple[str, str], int] = {
    ("basic",         "monthly"):     999,   #   $9.99/mo
    ("basic",         "yearly"):     7999,   #  $79.99/yr
    ("professional",  "monthly"):    1999,   #  $19.99/mo
    ("professional",  "yearly"):    15999,   # $159.99/yr
    ("elite",         "monthly"):    3999,   #  $39.99/mo
    ("elite",         "yearly"):    29999,   # $299.99/yr
    # ── B2B (Company) — flat-rate, NOT per-seat ──
    ("b2b_starter",    "monthly"):    7900,   #  $79/mo
    ("b2b_starter",    "yearly"):    75800,   # $758/yr
    ("b2b_growth",     "monthly"):   19900,   # $199/mo
    ("b2b_growth",     "yearly"):   191000,   # $1,910/yr
    # b2b_enterprise intentionally absent — always contact-sales, starts at $499/mo
}

# ── Stripe Price IDs (set in env for live mode) ───────────────────
import os
STRIPE_PRICE_IDS: dict[tuple[str, str], str] = {
    ("basic",         "monthly"): os.getenv("VITE_STRIPE_PRICE_BASIC_MONTHLY", ""),
    ("basic",         "yearly"):  os.getenv("VITE_STRIPE_PRICE_BASIC_YEARLY",  ""),
    ("professional",  "monthly"): os.getenv("VITE_STRIPE_PRICE_PRO_MONTHLY", ""),
    ("professional",  "yearly"):  os.getenv("VITE_STRIPE_PRICE_PRO_YEARLY",  ""),
    ("elite",         "monthly"): os.getenv("VITE_STRIPE_PRICE_ELITE_MONTHLY",""),
    ("elite",         "yearly"):  os.getenv("VITE_STRIPE_PRICE_ELITE_YEARLY", ""),
    ("b2b_starter",   "monthly"): os.getenv("VITE_STRIPE_PRICE_B2B_STARTER_MONTHLY", ""),
    ("b2b_starter",   "yearly"):  os.getenv("VITE_STRIPE_PRICE_B2B_STARTER_YEARLY",  ""),
    ("b2b_growth",    "monthly"): os.getenv("VITE_STRIPE_PRICE_B2B_GROWTH_MONTHLY", ""),
    ("b2b_growth",    "yearly"):  os.getenv("VITE_STRIPE_PRICE_B2B_GROWTH_YEARLY",  ""),
}

# ── Valid tiers (paid) ────────────────────────────────────────────
# B2C: basic / professional / elite — individual buyers
# B2B: b2b_starter / b2b_growth / b2b_enterprise — company buyers
# Distinct ids are deliberate — never let a B2C and B2B tier share an id,
# that has been the root cause of every pricing regression in this codebase.
PAID_TIERS    = {"basic", "professional", "elite", "b2b_starter", "b2b_growth"}
ALL_TIERS     = {"basic", "professional", "elite", "b2b_starter", "b2b_growth", "b2b_enterprise"}
TIER_ORDER    = ["basic", "professional", "elite"]
B2B_TIER_ORDER = ["b2b_starter", "b2b_growth", "b2b_enterprise"]
BILLING_MODES = {"monthly", "yearly"}

# ── Seat limits per plan ──────────────────────────────────────────
# B2C tiers have no seat concept (-1 = not applicable / single user).
# B2B tiers have real employee caps.
SEAT_LIMITS: dict[str, int] = {
    "basic":          -1,
    "professional":   -1,
    "elite":          -1,
    "b2b_starter":     30,
    "b2b_growth":      100,
    "b2b_enterprise":  -1,   # unlimited, custom contract
}

def get_paymob_amount(tier: str, billing: str) -> int | None:
    """
    Return the authoritative EGP amount in cents for a PayMob payment.
    Returns None if the tier/billing combination is not valid.
    NEVER accept an amount from the client — always call this.
    """
    tier    = (tier or "").strip().lower()
    billing = (billing or "monthly").strip().lower()
    if billing not in BILLING_MODES:
        return None
    if tier not in PAID_TIERS:
        return None
    return PAYMOB_PRICES_EGP.get((tier, billing))


def get_stripe_amount(tier: str, billing: str) -> int | None:
    """Return authoritative USD amount in cents for a Stripe payment."""
    tier    = (tier or "").strip().lower()
    billing = (billing or "monthly").strip().lower()
    if billing not in BILLING_MODES:
        return None
    if tier not in PAID_TIERS:
        return None
    return STRIPE_PRICES_USD.get((tier, billing))


def get_seat_limit(tier: str) -> int:
    """Return seat limit for a tier. -1 means unlimited / not applicable."""
    return SEAT_LIMITS.get((tier or "basic").lower(), -1)


def validate_plan_request(tier: str, billing: str) -> tuple[bool, str]:
    """
    Validate a plan upgrade request.
    Returns (is_valid, error_message).
    """
    tier    = (tier or "").strip().lower()
    billing = (billing or "").strip().lower()
    if not tier:
        return False, "tier is required"
    if tier not in ALL_TIERS:
        return False, f"Invalid tier '{tier}'. Valid: {sorted(ALL_TIERS)}"
    if tier == "b2b_enterprise" or tier == "enterprise":
        return False, "Enterprise plans require a custom contract — contact sales@corvus.io"
    if billing not in BILLING_MODES:
        return False, f"Invalid billing '{billing}'. Valid: monthly, yearly"
    return True, ""

# ── Usage-based / metered billing (Stripe Meters API) ────────────────
# These Stripe price IDs should be created with billing_scheme=per_unit
# and aggregate_usage=sum for metered billing.
# Overage is charged when usage exceeds the included_units in the plan.
STRIPE_METERED_PRICES = {
    # Analysis frames over the included quota
    "analysis_frames": os.getenv("STRIPE_METER_FRAMES",  ""),
    # AI reports over quota
    "ai_reports":      os.getenv("STRIPE_METER_AI",      ""),
    # API calls over quota (for marketplace customers)
    "api_calls":       os.getenv("STRIPE_METER_API",     ""),
    # Seats over the plan limit
    "seats":           os.getenv("STRIPE_METER_SEATS",   ""),
}

# ── Stripe usage records ──────────────────────────────────────────────
def record_stripe_usage(subscription_item_id: str, quantity: int, timestamp: int = None) -> bool:
    """
    Report metered usage to Stripe.
    Called by /api/billing/usage/meter when a user exceeds their plan limits.
    """
    import stripe as _stripe, time as _t
    _stripe.api_key = os.getenv("STRIPE_SECRET_KEY","")
    if not _stripe.api_key or not subscription_item_id:
        return False
    try:
        _stripe.SubscriptionItem.create_usage_record(
            subscription_item_id,
            quantity=quantity,
            timestamp=timestamp or int(_t.time()),
            action="increment",
        )
        return True
    except Exception as e:
        import logging
        logging.getLogger("corvus").warning(f"Stripe usage record failed: {e}")
        return False

