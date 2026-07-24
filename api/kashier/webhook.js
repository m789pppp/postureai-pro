/**
 * Vercel Serverless — Kashier Webhook
 * POST /api/kashier/webhook
 * Kashier sends JSON body with payment result
 * Docs: https://developers.kashier.io/payment/webhooks
 */
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const BACKEND_URL = process.env.VITE_API_URL || process.env.BACKEND_URL || "";
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || "";

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

/**
 * Verify Kashier webhook signature
 * Kashier sends X-Kashier-Signature header
 * Signature = HMAC-SHA256(rawBody, apiKey) in hex
 */
function verifyKashierSignature(rawBody, receivedSig, apiKey) {
  if (!apiKey || !receivedSig) return false;
  const computed = crypto.createHmac("sha256", apiKey).update(rawBody).digest("hex");
  const a = Buffer.from(computed,     "hex");
  const b = Buffer.from(receivedSig,  "hex");
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
    // Kashier sends raw JSON — need raw body for signature verification
    const rawBody = JSON.stringify(req.body || {});
    const receivedSig = req.headers["x-kashier-signature"] || "";

    // Verify signature — ALWAYS required (never skip in production)
    if (!KASHIER_API_KEY) {
      console.error("[Kashier Webhook] KASHIER_API_KEY not set — rejecting all webhook calls");
      return res.status(503).json({ error: "Webhook not configured" });
    }
    if (!verifyKashierSignature(rawBody, receivedSig, KASHIER_API_KEY)) {
      console.error("[Kashier Webhook] Invalid signature — possible spoofing");
      return res.status(403).json({ error: "Invalid signature" });
    }

    const payload  = req.body || {};

    // Kashier statuses: SUCCESS, PENDING, FAILED, EXPIRED
    const status   = (payload.status || payload.transactionStatus || "").toUpperCase();
    if (status !== "SUCCESS") {
      console.log("[Kashier Webhook] Non-success status:", status);
      return res.json({ received: true, action: "ignored", status });
    }

    const orderId        = payload.orderId || payload.merchantOrderId || "";
    const transactionId  = String(payload.transactionId || payload.id || "");
    const amount         = payload.amount || 0;
    const email          = payload.shopperEmail || payload.email || "";

    console.log("[Kashier Webhook] Payment success:", orderId, amount, "EGP");

    const parsed = parseOrderId(orderId);
    if (!parsed) {
      console.warn("[Kashier Webhook] Could not parse orderId:", orderId);
      return res.json({ received: true, action: "parse_failed" });
    }

    const { tier, billing } = parsed;
    const db = getAdminDb();

    if (email) {
      const snap = await db.collection("users").where("email", "==", email).limit(1).get();

      if (!snap.empty) {
        const userDoc = snap.docs[0];
        const uid     = userDoc.id;
        const now     = new Date();
        const expiry  = new Date(now);
        if (billing === "yearly") {
          expiry.setFullYear(expiry.getFullYear() + 1);
        } else {
          expiry.setMonth(expiry.getMonth() + 1);
        }

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

        // ── Referral reconciliation (best-effort — never blocks the webhook) ──
        try {
          const pendingRef  = db.collection("pending_orders").doc(orderId);
          const pendingSnap = await pendingRef.get();
          if (pendingSnap.exists) {
            const creditApplied = Number(pendingSnap.data().credit_applied_egp || 0);
            if (creditApplied > 0) {
              await userDoc.ref.update({ referral_credits: FieldValue.increment(-creditApplied) });
            }
            await pendingRef.delete();
          }
          if (BACKEND_URL && INTERNAL_API_SECRET) {
            await fetch(`${BACKEND_URL}/api/referral/convert`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Internal-Secret": INTERNAL_API_SECRET },
              body: JSON.stringify({ uid, plan: tier }),
            }).catch(e => console.error("[Kashier Webhook] referral convert call failed:", e));
          }
        } catch (refErr) {
          console.error("[Kashier Webhook] referral reconciliation error:", refErr);
        }

        return res.json({ received: true, action: "subscription_activated", uid, tier });
      } else {
        console.warn("[Kashier Webhook] No user found with email:", email);
      }
    }

    return res.json({ received: true, action: "no_user_matched" });

  } catch (err) {
    console.error("[Kashier Webhook] Error:", err);
    // Always 200 so Kashier doesn't retry indefinitely
    return res.status(200).json({ received: true, error: err.message });
  }
}
