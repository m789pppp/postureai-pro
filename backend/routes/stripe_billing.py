"""
PostureAI Pro — Stripe Billing Routes v2
Handles: Checkout sessions, webhooks, portal, subscription management
Security: Webhook signature verification, server-side pricing, idempotency
"""
import os
import json
import logging
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g

logger = logging.getLogger("postureai.billing")

stripe_bp = Blueprint("stripe", __name__)

STRIPE_SECRET_KEY    = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
APP_URL = os.getenv("APP_URL", "https://postureai.io")

# ── Server-side pricing (NEVER trust client amount) ───────────────
STRIPE_PRICES = {
    "professional": {
        "monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY", ""),
        "yearly":  os.getenv("STRIPE_PRICE_PRO_YEARLY", ""),
    },
    "business": {
        "monthly": os.getenv("STRIPE_PRICE_BUSINESS_MONTHLY", ""),
        "yearly":  os.getenv("STRIPE_PRICE_BUSINESS_YEARLY", ""),
    },
    "enterprise": {
        "monthly": os.getenv("STRIPE_PRICE_ENTERPRISE_MONTHLY", ""),
        "yearly":  os.getenv("STRIPE_PRICE_ENTERPRISE_YEARLY", ""),
    },
}

def _get_stripe():
    if not STRIPE_SECRET_KEY:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")
    import stripe
    stripe.api_key = STRIPE_SECRET_KEY
    return stripe


def _db():
    """Get database client — Supabase if configured, else Firestore shim."""
    import os
    if os.getenv("SUPABASE_URL"):
        from services.db_service import get_db
        return get_db()
    # Firestore shim for backwards compatibility
    from services.db_service import _MockDB
    return _MockDB()


@stripe_bp.route("/create-checkout", methods=["POST"])
def create_checkout():
    """Create Stripe Checkout session."""
    try:
        data = request.get_json() or {}
        plan     = data.get("plan", "professional")
        billing  = data.get("billing", "monthly")
        user_id  = getattr(g, "user_id", None)
        org_id   = getattr(g, "org_id", None)
        email    = getattr(g, "user_email", None)

        if not user_id:
            return jsonify({"error": "Authentication required"}), 401

        # Server-side price lookup
        price_id = STRIPE_PRICES.get(plan, {}).get(billing)
        if not price_id:
            return jsonify({"error": f"Invalid plan or billing cycle: {plan}/{billing}"}), 400

        stripe = _get_stripe()

        # Get or create Stripe customer
        db = _db()
        user = db.table("users").select("stripe_customer_id,email,name").eq("id", user_id).single().execute()
        customer_id = user.data.get("stripe_customer_id") if user.data else None

        if not customer_id:
            customer = stripe.Customer.create(
                email=email or user.data.get("email"),
                name=user.data.get("name"),
                metadata={"user_id": str(user_id), "org_id": str(org_id) if org_id else ""},
            )
            customer_id = customer.id
            db.table("users").update({"stripe_customer_id": customer_id}).eq("id", user_id).execute()

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            allow_promotion_codes=True,
            subscription_data={
                "trial_period_days": 0,  # trial already started
                "metadata": {"user_id": str(user_id), "org_id": str(org_id) if org_id else "", "plan": plan},
            },
            success_url=f"{APP_URL}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{APP_URL}/billing?canceled=1",
            metadata={"user_id": str(user_id), "plan": plan, "billing": billing},
        )

        logger.info("Checkout session created: %s for user %s plan %s", session.id, user_id, plan)
        return jsonify({"url": session.url, "session_id": session.id})

    except Exception as e:
        logger.error("Checkout creation failed: %s", e)
        return jsonify({"error": str(e)}), 500


@stripe_bp.route("/create-portal", methods=["POST"])
def create_portal():
    """Create Stripe Customer Portal session."""
    try:
        user_id = getattr(g, "user_id", None)
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401

        db = _db()
        user = db.table("users").select("stripe_customer_id").eq("id", user_id).single().execute()
        customer_id = user.data.get("stripe_customer_id") if user.data else None
        if not customer_id:
            return jsonify({"error": "No billing account found"}), 404

        stripe = _get_stripe()
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{APP_URL}/billing",
        )
        return jsonify({"url": session.url})

    except Exception as e:
        logger.error("Portal session failed: %s", e)
        return jsonify({"error": str(e)}), 500


@stripe_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    """
    Stripe webhook handler.
    SECURITY: Always verify signature before processing.
    All state changes are idempotent.
    """
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature")

    if not STRIPE_WEBHOOK_SECRET:
        logger.error("STRIPE_WEBHOOK_SECRET not set — rejecting webhook")
        return jsonify({"error": "Webhook not configured"}), 500

    try:
        stripe = _get_stripe()
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        logger.warning("Webhook signature verification failed: %s", e)
        return jsonify({"error": "Invalid signature"}), 400

    event_type = event["type"]
    obj = event["data"]["object"]

    logger.info("Stripe webhook: %s (id=%s)", event_type, event["id"])

    try:
        db = _db()

        if event_type == "checkout.session.completed":
            _handle_checkout_completed(db, obj)

        elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
            _handle_subscription_update(db, obj)

        elif event_type == "customer.subscription.deleted":
            _handle_subscription_deleted(db, obj)

        elif event_type == "invoice.paid":
            _handle_invoice_paid(db, obj)

        elif event_type == "invoice.payment_failed":
            _handle_invoice_failed(db, obj)

        elif event_type == "customer.subscription.trial_will_end":
            _handle_trial_ending(db, obj)

    except Exception as e:
        logger.error("Webhook handler error for %s: %s", event_type, e, exc_info=True)
        # Return 200 to prevent Stripe retries for non-signature errors
        return jsonify({"status": "error", "message": str(e)}), 200

    return jsonify({"status": "ok"})


def _plan_from_price(price_id: str) -> str:
    """Map Stripe price ID → plan name."""
    for plan, cycles in STRIPE_PRICES.items():
        if price_id in cycles.values():
            return plan
    return "professional"


def _handle_checkout_completed(db, session):
    user_id = session.get("metadata", {}).get("user_id")
    plan    = session.get("metadata", {}).get("plan", "professional")
    sub_id  = session.get("subscription")
    if not user_id or not sub_id:
        return

    import stripe
    stripe.api_key = STRIPE_SECRET_KEY
    sub = stripe.Subscription.retrieve(sub_id)

    db.table("users").update({
        "tier": plan,
        "is_trial": False,
        "stripe_subscription_id": sub_id,
    }).eq("id", user_id).execute()

    db.table("subscriptions").upsert({
        "user_id": user_id,
        "plan": plan,
        "status": sub["status"],
        "stripe_subscription_id": sub_id,
        "stripe_customer_id": sub["customer"],
        "billing_cycle": "yearly" if sub["items"]["data"][0].get("plan", {}).get("interval") == "year" else "monthly",
        "current_period_start": datetime.fromtimestamp(sub["current_period_start"], tz=timezone.utc).isoformat(),
        "current_period_end": datetime.fromtimestamp(sub["current_period_end"], tz=timezone.utc).isoformat(),
    }, on_conflict="stripe_subscription_id").execute()

    # Send confirmation email
    user = db.table("users").select("email,name").eq("id", user_id).single().execute()
    if user.data:
        from services.email_service import send_payment_confirmation
        next_date = datetime.fromtimestamp(sub["current_period_end"]).strftime("%B %d, %Y")
        send_payment_confirmation(user.data["email"], user.data.get("name",""),
                                   plan, "", next_date)
    logger.info("Checkout completed: user %s → %s", user_id, plan)


def _handle_subscription_update(db, sub):
    sub_id = sub["id"]
    status = sub["status"]
    customer_id = sub["customer"]

    price_id = sub["items"]["data"][0]["price"]["id"] if sub["items"]["data"] else ""
    plan = _plan_from_price(price_id)

    # Find user by Stripe customer ID
    user = db.table("users").select("id,email,name").eq("stripe_customer_id", customer_id).single().execute()
    if not user.data:
        return

    user_id = user.data["id"]

    db.table("users").update({
        "tier": plan if status == "active" else "starter",
        "is_trial": status == "trialing",
    }).eq("id", user_id).execute()

    db.table("subscriptions").upsert({
        "user_id": user_id,
        "plan": plan,
        "status": status,
        "stripe_subscription_id": sub_id,
        "stripe_customer_id": customer_id,
        "current_period_start": datetime.fromtimestamp(sub["current_period_start"], tz=timezone.utc).isoformat(),
        "current_period_end": datetime.fromtimestamp(sub["current_period_end"], tz=timezone.utc).isoformat(),
        "cancel_at_period_end": sub.get("cancel_at_period_end", False),
    }, on_conflict="stripe_subscription_id").execute()


def _handle_subscription_deleted(db, sub):
    sub_id = sub["id"]
    customer_id = sub["customer"]

    user = db.table("users").select("id").eq("stripe_customer_id", customer_id).single().execute()
    if not user.data:
        return

    db.table("users").update({"tier": "starter", "is_trial": False}).eq("id", user.data["id"]).execute()
    db.table("subscriptions").update({"status": "canceled", "canceled_at": datetime.utcnow().isoformat()}).eq(
        "stripe_subscription_id", sub_id
    ).execute()

    logger.info("Subscription canceled: %s", sub_id)


def _handle_invoice_paid(db, invoice):
    customer_id = invoice["customer"]
    user = db.table("users").select("id").eq("stripe_customer_id", customer_id).single().execute()
    if not user.data:
        return

    db.table("invoices").upsert({
        "user_id": user.data["id"],
        "stripe_invoice_id": invoice["id"],
        "status": "paid",
        "amount_cents": invoice["amount_paid"],
        "amount_paid_cents": invoice["amount_paid"],
        "currency": invoice.get("currency", "usd").upper(),
        "pdf_url": invoice.get("invoice_pdf"),
        "hosted_url": invoice.get("hosted_invoice_url"),
        "paid_at": datetime.utcnow().isoformat(),
    }, on_conflict="stripe_invoice_id").execute()


def _handle_invoice_failed(db, invoice):
    customer_id = invoice["customer"]
    user = db.table("users").select("id,email,name").eq("stripe_customer_id", customer_id).single().execute()
    if not user.data:
        return

    db.table("subscriptions").update({"status": "past_due"}).eq(
        "user_id", user.data["id"]
    ).execute()

    from services.email_service import send_payment_failed
    next_attempt = invoice.get("next_payment_attempt")
    next_str = datetime.fromtimestamp(next_attempt).strftime("%B %d, %Y") if next_attempt else "N/A"
    amount = f"${invoice['amount_due'] / 100:.2f}"
    send_payment_failed(user.data["email"], user.data.get("name",""), amount, next_str)


def _handle_trial_ending(db, sub):
    """Subscription trial ending in 3 days."""
    customer_id = sub["customer"]
    user = db.table("users").select("id,email,name").eq("stripe_customer_id", customer_id).single().execute()
    if not user.data:
        return
    from services.email_service import send_trial_ending
    send_trial_ending(user.data["email"], user.data.get("name",""), 3)
