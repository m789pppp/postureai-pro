/**
 * Vercel Serverless — Kashier Create Order
 * POST /api/kashier/create-order
 * Headers: Authorization: Bearer <Firebase ID token>  (optional — anonymous checkout allowed)
 * Body: { tier, billing, user_count, billing_data }
 * Returns: { redirect_url, order_id, merchant_order_id }
 *
 * Kashier hosted-payment flow:
 *   1. Build order params
 *   2. Generate SHA-256 hash signature
 *   3. Redirect user to Kashier hosted page
 *
 * SECURITY HARDENING: the uid and email embedded in the order (and later
 * used by /api/kashier/webhook to decide which account gets upgraded) used
 * to come straight from the client-supplied `uid` / `billing_data.email`
 * fields with no verification — anyone could claim to be any uid or email.
 * The webhook's uid8 cross-check is only meaningful if the uid was verified
 * here, so a signed-in caller's uid/email are now taken from their verified
 * Firebase ID token, not from the request body. Anonymous checkout (no
 * Authorization header) is still allowed and falls back to the "anon"
 * placeholder, which the webhook explicitly exempts from the uid check.
 */
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const KASHIER_MERCHANT_ID  = process.env.KASHIER_MERCHANT_ID  || "";
const KASHIER_API_KEY      = process.env.KASHIER_API_KEY      || "";
const KASHIER_MODE         = process.env.KASHIER_MODE         || "live";   // "test" | "live"
const APP_URL              = process.env.VITE_APP_URL         || "https://postureai-pro-omega-nine.vercel.app";

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
  return getAuth();
}

/** Verify the caller's Firebase ID token, if one was supplied. Returns
 *  { uid, email } for a verified caller, or null for anonymous checkout. */
async function resolveCaller(req) {
  const authHeader = req.headers["authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice(7).trim();
  if (!idToken) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email || "" };
  } catch (err) {
    console.warn("[Kashier create-order] Invalid/expired ID token:", err.message);
    return null;
  }
}

// ── Prices (EGP) ─────────────────────────────────────────────────
const PRICES = {
  individual: {
    basic:    { monthly: 199,  yearly: 1910 },
    pro:      { monthly: 399,  yearly: 3830 },
    elite:    { monthly: 699,  yearly: 6710 },
  },
  company: {
    team:     { monthly: 249,  yearly: 2390 },
    business: { monthly: 399,  yearly: 3830 },
  },
};

function getPrice(tier, billing, userCount = 1) {
  const t = (tier || "").toLowerCase();
  const b = billing === "yearly" ? "yearly" : "monthly";
  const ind = PRICES.individual[t];
  const co  = PRICES.company[t];
  if (ind) return ind[b];
  if (co)  return co[b] * Math.max(1, userCount);
  return null;
}

/**
 * Kashier signature:
 * HMAC-SHA256( merchantId + "." + orderId + "." + amount + "." + currency , apiKey )
 * Returns lowercase hex
 */
function kashierSignature(merchantId, orderId, amount, currency, apiKey) {
  const msg = [merchantId, orderId, amount, currency].join(".");
  return crypto.createHmac("sha256", apiKey).update(msg).digest("hex");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  APP_URL);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  if (!KASHIER_MERCHANT_ID || !KASHIER_API_KEY) {
    return res.status(503).json({ error: "Kashier not configured — add KASHIER_MERCHANT_ID and KASHIER_API_KEY to Vercel env vars" });
  }

  try {
    const {
      tier,
      billing      = "monthly",
      user_count   = 1,
      billing_data = {},
    } = req.body || {};

    if (!tier) return res.status(400).json({ error: "tier is required" });

    const amount = getPrice(tier, billing, user_count);
    if (!amount) return res.status(400).json({ error: "Unknown tier: " + tier });

    // Verified caller identity — never trust a client-supplied uid/email for
    // the account that will receive the tier upgrade.
    const caller = await resolveCaller(req);
    const uid    = caller ? caller.uid   : "anon";
    const email  = caller ? caller.email : (billing_data.email || "");

    // Kashier expects amount as string with 2 decimal places
    const amountStr  = amount.toFixed(2);
    const currency   = "EGP";
    const orderId    = "CORVUS-" + uid.slice(0, 8) + "-" + tier + "-" + (billing[0]) + "-" + Date.now();
    const hash       = kashierSignature(KASHIER_MERCHANT_ID, orderId, amountStr, currency, KASHIER_API_KEY);

    const successUrl  = APP_URL + "/payment/success";
    const failureUrl  = APP_URL + "/payment/failure";
    const webhookUrl  = APP_URL + "/api/kashier/webhook";

    // Build Kashier hosted-payment URL
    const baseUrl = KASHIER_MODE === "test"
      ? "https://checkout.kashier.io"
      : "https://checkout.kashier.io";

    const params = new URLSearchParams({
      merchantId:   KASHIER_MERCHANT_ID,
      orderId,
      amount:       amountStr,
      currency,
      hash,
      merchantRedirect:  successUrl,
      failureRedirect:   failureUrl,
      serverWebhook:     webhookUrl,
      display:      "en",
      // Optional metadata
      description:  "Corvus PostureAI — " + tier + " plan (" + billing + ")",
      // Shopper info (optional but improves UX)
      shopperReference: uid,
      ...(email && { email }),
    });

    // Pass mode param for test environment
    if (KASHIER_MODE === "test") params.set("mode", "test");

    const redirect_url = baseUrl + "/?" + params.toString();

    return res.json({
      redirect_url,
      order_id: orderId,
      merchant_order_id: orderId,
      amount: amountStr,
      currency,
    });

  } catch (err) {
    console.error("[Kashier create-order]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
