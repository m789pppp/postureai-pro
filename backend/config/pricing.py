"""
Corvus — Server-Side Pricing Configuration
SECURITY: This is the ONLY authoritative source of pricing.
          The frontend MUST NEVER determine payment amounts.
          All amount_cents values are generated here, server-side.
          
Prices are in EGP (Egyptian Pounds) × 100 (cents).
"""

# ── EGP Pricing (PayMob) ──────────────────────────────────────────
# Format: (tier, billing_cycle) → amount_cents
PAYMOB_PRICES_EGP: dict[tuple[str, str], int] = {
    ("standard",      "monthly"):    19900,   #  199 EGP/mo
    ("standard",      "yearly"):    199000,   # 1990 EGP/yr (2 months free)
    ("professional",  "monthly"):   49900,   #  499 EGP/mo
    ("professional",  "yearly"):   499000,   # 4990 EGP/yr
    ("elite",         "monthly"):  119900,   # 1199 EGP/mo
    ("elite",         "yearly"):  1199000,   # 11990 EGP/yr
}

# ── USD Pricing (Stripe) ──────────────────────────────────────────
# Format: (tier, billing_cycle) → amount_cents (USD cents)
STRIPE_PRICES_USD: dict[tuple[str, str], int] = {
    ("standard",      "monthly"):    1999,   #  $19.99/mo
    ("standard",      "yearly"):   19900,   # $199.00/yr
    ("professional",  "monthly"):   4999,   #  $49.99/mo
    ("professional",  "yearly"):   49900,   # $499.00/yr
    ("elite",         "monthly"):  11999,   # $119.99/mo
    ("elite",         "yearly"):  119900,   # $1199.00/yr
}

# ── Stripe Price IDs (set in env for live mode) ───────────────────
import os
STRIPE_PRICE_IDS: dict[tuple[str, str], str] = {
    ("standard",     "monthly"): os.getenv("STRIPE_PRICE_STD_MONTHLY", ""),
    ("standard",     "yearly"):  os.getenv("STRIPE_PRICE_STD_YEARLY",  ""),
    ("professional", "monthly"): os.getenv("STRIPE_PRICE_PRO_MONTHLY", ""),
    ("professional", "yearly"):  os.getenv("STRIPE_PRICE_PRO_YEARLY",  ""),
    ("elite",        "monthly"): os.getenv("STRIPE_PRICE_ELITE_MONTHLY",""),
    ("elite",        "yearly"):  os.getenv("STRIPE_PRICE_ELITE_YEARLY", ""),
}

# ── Valid tiers (paid) ────────────────────────────────────────────
PAID_TIERS    = {"standard", "professional", "elite"}
ALL_TIERS     = {"standard", "professional", "elite", "enterprise"}
TIER_ORDER    = ["standard", "professional", "elite", "enterprise"]
BILLING_MODES = {"monthly", "yearly"}

# ── Seat limits per plan ──────────────────────────────────────────
SEAT_LIMITS: dict[str, int] = {
    "standard":     25,
    "professional": 100,
    "elite":        -1,   # unlimited
    "enterprise":   -1,   # unlimited, custom contract
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
    """Return seat limit for a tier. -1 means unlimited."""
    return SEAT_LIMITS.get((tier or "standard").lower(), 25)


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
    if tier == "enterprise":
        return False, "Enterprise plans require a custom quote — contact sales"
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

