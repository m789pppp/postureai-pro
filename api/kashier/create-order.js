/**
 * Vercel Serverless — Kashier Create Order
 * POST /api/kashier/create-order
 * Body: { tier, billing, uid, user_count, billing_data }
 * Returns: { redirect_url, order_id, merchant_order_id }
 *
 * Kashier hosted-payment flow:
 *   1. Build order params
 *   2. Generate SHA-256 hash signature
 *   3. Redirect user to Kashier hosted page
 */
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const KASHIER_MERCHANT_ID  = process.env.KASHIER_MERCHANT_ID  || "";
const KASHIER_API_KEY      = process.env.KASHIER_API_KEY      || "";
const KASHIER_MODE         = process.env.KASHIER_MODE         || "live";   // "test" | "live"
const APP_URL              = process.env.VITE_APP_URL         || "https://postureai-pro-omega-nine.vercel.app";

function getAdminApp() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
}
function getAdminAuth() { getAdminApp(); return getAuth(); }
function getAdminDb()   { getAdminApp(); return getFirestore(); }

// Referral credit (EGP) applied as a checkout discount. Not deducted from
// the balance here — only once the webhook confirms the payment actually
// succeeded, so an abandoned/failed checkout doesn't burn it. See
// api/kashier/webhook.js for the reconciliation step.
async function applyReferralDiscount(db, uid, amount, minChargeEGP = 1) {
  if (!uid || uid === "anon") return { amount, creditAppliedEGP: 0 };
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const credits = Number(userDoc.exists ? (userDoc.data().referral_credits || 0) : 0);
    if (credits <= 0) return { amount, creditAppliedEGP: 0 };
    const maxDiscount = Math.max(0, amount - minChargeEGP);
    const creditAppliedEGP = Math.min(Math.floor(credits), Math.floor(maxDiscount));
    if (creditAppliedEGP <= 0) return { amount, creditAppliedEGP: 0 };
    return { amount: amount - creditAppliedEGP, creditAppliedEGP };
  } catch (e) {
    console.error("[Kashier create-order] referral discount lookup failed:", e);
    return { amount, creditAppliedEGP: 0 };
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

  // Require Firebase auth token
  const idToken = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!idToken) return res.status(401).json({ error: "Authentication required" });
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    // Inject verified uid (don't trust client-supplied uid)
    if (req.body) req.body.uid = decoded.uid;
    if (req.body) req.body.user_email = decoded.email || req.body.billing_data?.email || "";
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired session — please log in again" });
  }

  if (!KASHIER_MERCHANT_ID || !KASHIER_API_KEY) {
    return res.status(503).json({ error: "Kashier not configured — add KASHIER_MERCHANT_ID and KASHIER_API_KEY to Vercel env vars" });
  }

  try {
    const {
      tier,
      billing     = "monthly",
      uid         = "anon",
      user_count   = 1,
      coupon_code  = "",
      discount_pct = 0,
      billing_data = {},
    } = req.body || {};

    if (!tier) return res.status(400).json({ error: "tier is required" });

    // Sanitize user_count: must be positive integer, cap at 10000
    const safeUserCount = Math.min(10000, Math.max(1, Math.floor(Number(user_count) || 1)));

    let amount = getPrice(tier, billing, safeUserCount);
    if (!amount) return res.status(400).json({ error: "Unknown tier: " + tier });

    // Apply discount — cap at 50% (prevent abuse even if coupon API is hacked)
    const safeDsc = Math.min(50, Math.max(0, Number(discount_pct) || 0));
    if (safeDsc > 0) {
      amount = Math.round(amount * (1 - safeDsc / 100));
    }

    // Minimum charge: 1 EGP (Kashier rejects 0)
    amount = Math.max(1, amount);

    // Kashier expects amount as string with 2 decimal places
    const db = getAdminDb();
    const { amount: discountedAmount, creditAppliedEGP } = await applyReferralDiscount(db, uid, amount);
    const amountStr  = discountedAmount.toFixed(2);
    const currency   = "EGP";
    const orderId    = "CORVUS-" + uid.slice(0, 8) + "-" + tier + "-" + (billing[0]) + "-" + Date.now();
    const hash       = kashierSignature(KASHIER_MERCHANT_ID, orderId, amountStr, currency, KASHIER_API_KEY);

    if (creditAppliedEGP > 0) {
      try {
        await db.collection("pending_orders").doc(orderId).set({
          uid, tier, billing, credit_applied_egp: creditAppliedEGP,
          base_amount_egp: amount,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("[Kashier create-order] failed to record pending order credit:", e);
      }
    }

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
      ...(billing_data.email && { email: billing_data.email }),
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
      credit_applied_egp: creditAppliedEGP,
    });

  } catch (err) {
    console.error("[Kashier create-order]", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
