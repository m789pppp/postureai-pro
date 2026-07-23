/**
 * Vercel Serverless — Kashier Webhook
 * POST /api/kashier/webhook
 * Kashier sends JSON body with payment result
 * Docs: https://developers.kashier.io/payment/webhooks
 */
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

    // Verify signature
    if (KASHIER_API_KEY) {
      if (!verifyKashierSignature(rawBody, receivedSig, KASHIER_API_KEY)) {
        console.error("[Kashier Webhook] Invalid signature — possible spoofing");
        return res.status(403).json({ error: "Invalid signature" });
      }
    } else {
      console.warn("[Kashier Webhook] KASHIER_API_KEY not set — skipping signature check");
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
