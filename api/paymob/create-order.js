/**
 * Vercel Serverless — PayMob Create Order
 * POST /api/paymob/create-order
 * Body: { tier, billing, payment_type, billing_data, wallet_number, uid, email }
 */

const PAYMOB_SECRET_KEY     = process.env.PAYMOB_SECRET_KEY     || "";
const PAYMOB_CARD_INT       = process.env.PAYMOB_INTEGRATION_CARD    || "";
const PAYMOB_WALLET_INT     = process.env.PAYMOB_INTEGRATION_WALLET  || "";
const PAYMOB_IFRAME_ID      = process.env.PAYMOB_IFRAME_ID      || "";

// ── Prices (EGP cents) ────────────────────────────────────────────
const PRICES = {
  individual: {
    basic:    { monthly: 19900,  yearly: 191040 },   // EGP 199 / mo
    pro:      { monthly: 39900,  yearly: 383040 },   // EGP 399 / mo
    elite:    { monthly: 69900,  yearly: 671040 },   // EGP 699 / mo
  },
  company: {
    team:     { monthly: 24900,  yearly: 239040 },   // EGP 249 / user / mo
    business: { monthly: 39900,  yearly: 383040 },   // EGP 399 / user / mo
  },
};

function getPrice(tier, billing, userCount = 1) {
  const t = tier?.toLowerCase();
  const b = billing?.toLowerCase() === "yearly" ? "yearly" : "monthly";
  const indPrices = PRICES.individual[t];
  const coPrices  = PRICES.company[t];
  if (indPrices) return indPrices[b];
  if (coPrices)  return coPrices[b] * Math.max(1, userCount);
  return null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", process.env.VITE_APP_URL || "https://postureai-pro-omega-nine.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!PAYMOB_SECRET_KEY) {
    return res.status(503).json({ error: "PayMob not configured — add PAYMOB_SECRET_KEY to Vercel env vars" });
  }

  try {
    const {
      tier, billing = "monthly", payment_type = "card",
      billing_data = {}, wallet_number = "",
      uid = "anon", user_count = 1,
    } = req.body || {};

    if (!tier) return res.status(400).json({ error: "tier is required" });

    const amount_cents = getPrice(tier, billing, user_count);
    if (!amount_cents) return res.status(400).json({ error: `Unknown tier: ${tier}` });

    const headers = { "Content-Type": "application/json" };

    // ── Step 1: Auth token ─────────────────────────────────────────
    const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
      method: "POST",
      headers,
      body: JSON.stringify({ api_key: PAYMOB_SECRET_KEY }),
    });
    if (!authRes.ok) {
      const err = await authRes.text();
      return res.status(502).json({ error: `PayMob auth failed: ${err}` });
    }
    const auth_token = (await authRes.json()).token;

    // ── Step 2: Create order ───────────────────────────────────────
    const merchant_order_id = `CORVUS-${uid.slice(0,8)}-${tier}-${billing[0]}-${Date.now()}`;
    const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        auth_token,
        delivery_needed: false,
        amount_cents,
        currency: "EGP",
        merchant_order_id,
        items: [{
          name: `Corvus ${tier.charAt(0).toUpperCase()+tier.slice(1)} (${billing})`,
          amount_cents,
          description: `Corvus PostureAI — ${tier} plan, ${billing} billing`,
          quantity: 1,
        }],
      }),
    });
    if (!orderRes.ok) return res.status(502).json({ error: "PayMob order creation failed" });
    const order_id = (await orderRes.json()).id;

    // ── Step 3: Payment key ────────────────────────────────────────
    const integration_id = payment_type === "mobile_wallet" ? PAYMOB_WALLET_INT : PAYMOB_CARD_INT;
    const pkRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
      method: "POST",
      headers,
      body: JSON.stringify({
        auth_token,
        amount_cents,
        expiration: 3600,
        order_id,
        currency: "EGP",
        integration_id: Number(integration_id),
        billing_data: {
          email:           billing_data.email        || "NA",
          first_name:      billing_data.first_name   || "Customer",
          last_name:       billing_data.last_name    || "NA",
          phone_number:    billing_data.phone_number || "NA",
          apartment: "NA", floor: "NA", street: "NA",
          building:  "NA", shipping_method: "NA",
          postal_code: "NA", city: "Cairo",
          country: "EG", state: "Cairo",
        },
      }),
    });
    if (!pkRes.ok) return res.status(502).json({ error: "PayMob payment key failed" });
    const payment_key = (await pkRes.json()).token;

    // ── Step 4: Wallet redirect (if wallet) ───────────────────────
    if (payment_type === "mobile_wallet" && wallet_number) {
      const walletRes = await fetch("https://accept.paymob.com/api/acceptance/payments/pay", {
        method: "POST",
        headers,
        body: JSON.stringify({
          source: { identifier: wallet_number, subtype: "WALLET" },
          payment_token: payment_key,
        }),
      });
      const wdata = await walletRes.json();
      return res.json({
        payment_key,
        redirect_url: wdata.redirect_url || wdata.iframe_redirection_url,
        order_id,
        merchant_order_id,
        payment_type: "mobile_wallet",
      });
    }

    // ── Card: return key + iframe info ────────────────────────────
    return res.json({
      payment_key,
      order_id,
      merchant_order_id,
      iframe_id: PAYMOB_IFRAME_ID,
      iframe_url: `https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${payment_key}`,
      payment_type: "card",
    });

  } catch (err) {
    console.error("[PayMob create-order]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
