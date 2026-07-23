/**
 * Vercel Serverless — Kashier Webhook
 * POST /api/kashier/webhook
 * Kashier sends JSON body with payment result
 * Docs: https://developers.kashier.io/payment/webhooks
 *
 * SECURITY HARDENING (see audit notes below):
 *   1. Signature verification is now MANDATORY in production — if
 *      KASHIER_API_KEY is missing, the webhook hard-fails (503) instead of
 *      silently accepting unsigned requests. Previously a missing env var
 *      meant ANY POST body would be trusted, letting anyone activate a paid
 *      tier for free by forging a "SUCCESS" payload.
 *   2. The signature is now computed over the actual raw request bytes
 *      (bodyParser disabled + manual stream read), not
 *      `JSON.stringify(req.body)`. Re-serializing an already-parsed object
 *      can produce different bytes than what Kashier originally signed
 *      (key order, whitespace), which silently breaks verification — this
 *      was likely why signature checking was made "soft" in the first place.
 *   3. Replay protection: each transactionId is only ever applied once. A
 *      captured valid webhook call replayed later no longer resets/extends
 *      subscription_expiry.
 *   4. Defense in depth: the uid fragment embedded in orderId at checkout
 *      time (CORVUS-{uid8}-...) is now cross-checked against the uid found
 *      via email lookup — a mismatch is logged and rejected rather than
 *      silently trusting whatever email the payload happens to carry.
 */
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Disable Vercel's automatic JSON body parsing so we can verify the HMAC
// signature against the exact bytes Kashier sent.
export const config = { api: { bodyParser: false } };

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function isProduction() {
  // Vercel sets VERCEL_ENV to "production" | "preview" | "development".
  return (process.env.VERCEL_ENV || process.env.NODE_ENV || "development") === "production";
}

/**
 * Verify Kashier webhook signature
 * Kashier sends X-Kashier-Signature header
 * Signature = HMAC-SHA256(rawBody, apiKey) in hex
 */
function verifyKashierSignature(rawBodyBuf, receivedSig, apiKey) {
  if (!apiKey || !receivedSig) return false;
  const computed = crypto.createHmac("sha256", apiKey).update(rawBodyBuf).digest("hex");
  let a, b;
  try {
    a = Buffer.from(computed,    "hex");
    b = Buffer.from(receivedSig, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Parse orderId: CORVUS-{uid8}-{tier}-{billingChar}-{timestamp}
 */
function parseOrderId(orderId) {
  const parts = (orderId || "").split("-");
  if (parts.length >= 5 && parts[0] === "CORVUS") {
    return {
      uid8:    parts[1],
      tier:    parts[2],
      billing: parts[3] === "y" ? "yearly" : "monthly",
    };
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const KASHIER_API_KEY = process.env.KASHIER_API_KEY || "";

  try {
    const rawBodyBuf  = await readRawBody(req);
    const receivedSig = req.headers["x-kashier-signature"] || "";

    // ── Signature is MANDATORY in production ──────────────────────────
    if (!KASHIER_API_KEY) {
      if (isProduction()) {
        console.error("🚨 CRITICAL: KASHIER_API_KEY not configured in production — rejecting webhook");
        return res.status(503).json({ error: "Kashier not configured — set KASHIER_API_KEY in Vercel env vars" });
      }
      console.warn("⚠️  DEV: KASHIER_API_KEY not set — skipping signature check");
    } else if (!verifyKashierSignature(rawBodyBuf, receivedSig, KASHIER_API_KEY)) {
      console.error("[Kashier Webhook] Invalid signature — possible spoofing attempt");
      return res.status(403).json({ error: "Invalid signature" });
    }

    let payload;
    try {
      payload = JSON.parse(rawBodyBuf.toString("utf8") || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    // Kashier statuses: SUCCESS, PENDING, FAILED, EXPIRED
    const status = (payload.status || payload.transactionStatus || "").toUpperCase();
    if (status !== "SUCCESS") {
      console.log("[Kashier Webhook] Non-success status:", status);
      return res.json({ received: true, action: "ignored", status });
    }

    const orderId       = payload.orderId || payload.merchantOrderId || "";
    const transactionId = String(payload.transactionId || payload.id || "");
    const amount        = payload.amount || 0;
    const email         = payload.shopperEmail || payload.email || "";

    if (!transactionId) {
      console.warn("[Kashier Webhook] Missing transactionId — cannot dedupe, refusing");
      return res.json({ received: true, action: "missing_transaction_id" });
    }

    console.log("[Kashier Webhook] Payment success:", orderId, amount, "EGP");

    const parsed = parseOrderId(orderId);
    if (!parsed) {
      console.warn("[Kashier Webhook] Could not parse orderId:", orderId);
      return res.json({ received: true, action: "parse_failed" });
    }

    const { tier, billing, uid8 } = parsed;
    const db = getAdminDb();

    // ── Replay protection ───────────────────────────────────────────────
    // A previously-processed transactionId (whether redelivered by Kashier
    // or replayed by an attacker who captured a valid signed payload) must
    // never re-apply the subscription update — otherwise every replay
    // resets subscription_expiry to "now + 1 period", granting free time.
    const dedupeRef  = db.collection("processed_kashier_transactions").doc(transactionId);
    const dedupeSnap = await dedupeRef.get();
    if (dedupeSnap.exists) {
      console.warn("[Kashier Webhook] transactionId already processed — ignoring replay:", transactionId);
      return res.json({ received: true, action: "duplicate_ignored" });
    }

    if (!email) {
      return res.json({ received: true, action: "no_email_in_payload" });
    }

    const snap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (snap.empty) {
      console.warn("[Kashier Webhook] No user found with email:", email);
      return res.json({ received: true, action: "no_user_matched" });
    }

    const userDoc = snap.docs[0];
    const uid     = userDoc.id;

    // Defense in depth: cross-check the uid fragment embedded in orderId
    // (set server-side at checkout creation) against the uid resolved via
    // email. A mismatch means the email on the payment doesn't correspond
    // to the account the checkout session was created for — reject rather
    // than silently trusting the payload's email. Skip this for the
    // anonymous-checkout placeholder ("anon"), which create-order.js uses
    // when no authenticated uid was supplied and has no real uid to bind to.
    if (uid8 && uid8 !== "anon" && !uid.startsWith(uid8)) {
      console.error(
        `🚨 [Kashier Webhook] uid mismatch — orderId was created for uid8=${uid8} ` +
        `but email ${email} resolves to uid=${uid}. Refusing to activate tier.`
      );
      return res.json({ received: true, action: "uid_mismatch_refused" });
    }

    const now    = new Date();
    const expiry = new Date(now);
    if (billing === "yearly") {
      expiry.setFullYear(expiry.getFullYear() + 1);
    } else {
      expiry.setMonth(expiry.getMonth() + 1);
    }

    // Mark the transaction as processed FIRST so a concurrent/retried
    // delivery arriving mid-flight can't double-apply the update.
    await dedupeRef.set({
      uid, tier, billing, order_id: orderId,
      processed_at: now.toISOString(),
    });

    await userDoc.ref.update({
      tier,
      billing,
      subscription_status: "active",
      subscription_start:  now.toISOString(),
      subscription_expiry: expiry.toISOString(),
      payment_method:      "kashier",
      last_payment_amount: amount,
      last_payment_date:   now.toISOString(),
      last_transaction_id: transactionId,
      updated_at:          now.toISOString(),
    });

    await db.collection("users").doc(uid)
      .collection("payments").doc(transactionId).set({
        tier, billing,
        amount,
        order_id: orderId,
        payment_method: "kashier",
        status: "success",
        created_at: now.toISOString(),
      });

    console.log("[Kashier Webhook] Updated user", uid, "=> tier=" + tier + " billing=" + billing);
    return res.json({ received: true, action: "subscription_activated", uid, tier });

  } catch (err) {
    console.error("[Kashier Webhook] Error:", err);
    // Always 200 so Kashier doesn't retry indefinitely
    return res.status(200).json({ received: true, error: err.message });
  }
}
