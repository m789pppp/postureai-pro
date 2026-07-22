/**
 * Vercel Serverless — PayMob Webhook
 * POST /api/paymob/webhook?hmac=xxx
 * Verifies HMAC, updates Firestore subscription
 */
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── Firebase Admin (server-side) ─────────────────────────────────
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

// ── Tier mapping from merchant_order_id ──────────────────────────
// Format: CORVUS-{uid8}-{tier}-{billingChar}-{timestamp}
function parseMerchantId(merchant_order_id) {
  const parts = (merchant_order_id || "").split("-");
  // CORVUS - uid8 - tier - billingChar - ts
  if (parts.length >= 5 && parts[0] === "CORVUS") {
    return {
      uid_prefix: parts[1],
      tier:       parts[2],
      billing:    parts[3] === "y" ? "yearly" : "monthly",
    };
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET || "";
  const received_hmac = req.query.hmac || "";

  try {
    // ── HMAC verification ─────────────────────────────────────────
    if (HMAC_SECRET) {
      const raw = req.body ? JSON.stringify(req.body) : "";
      const computed = crypto
        .createHmac("sha512", HMAC_SECRET)
        .update(raw)
        .digest("hex");
      if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(received_hmac))) {
        console.error("[Webhook] Invalid HMAC — possible spoofing");
        return res.status(403).json({ error: "Invalid HMAC" });
      }
    } else {
      console.warn("[Webhook] PAYMOB_HMAC_SECRET not set — skipping HMAC check");
    }

    const payload = req.body || {};
    const obj     = payload.obj || {};
    const success = obj.success === true;

    if (!success) {
      console.log("[Webhook] Payment not successful — ignoring");
      return res.json({ received: true, action: "ignored" });
    }

    const order          = obj.order || {};
    const merchant_id    = order.merchant_order_id || "";
    const amount_cents   = obj.amount_cents || 0;
    const email          = obj.billing_data?.email || "";
    const transaction_id = String(obj.id || "");

    console.log(`[Webhook] ✅ Payment success — ${merchant_id} — ${amount_cents} EGP`);

    const parsed = parseMerchantId(merchant_id);
    if (!parsed) {
      console.warn("[Webhook] Could not parse merchant_order_id:", merchant_id);
      return res.json({ received: true, action: "parse_failed" });
    }

    const { tier, billing } = parsed;

    // ── Update Firestore ──────────────────────────────────────────
    const db = getAdminDb();

    // Find user by email (since we have email from billing_data)
    if (email && email !== "NA") {
      const usersRef = db.collection("users");
      const snap = await usersRef.where("email", "==", email).limit(1).get();

      if (!snap.empty) {
        const userDoc = snap.docs[0];
        const uid = userDoc.id;

        const now = new Date();
        const expiry = new Date(now);
        if (billing === "yearly") {
          expiry.setFullYear(expiry.getFullYear() + 1);
        } else {
          expiry.setMonth(expiry.getMonth() + 1);
        }

        await userDoc.ref.update({
          tier,
          billing,
          subscription_status:  "active",
          subscription_start:   now.toISOString(),
          subscription_expiry:  expiry.toISOString(),
          payment_method:       "paymob",
          last_payment_amount:  amount_cents,
          last_payment_date:    now.toISOString(),
          last_transaction_id:  transaction_id,
          updated_at:           now.toISOString(),
        });

        // Also write to payments subcollection for audit trail
        await db.collection("users").doc(uid)
          .collection("payments").doc(transaction_id).set({
            tier, billing, amount_cents,
            merchant_order_id: merchant_id,
            payment_method: "paymob",
            status: "success",
            created_at: now.toISOString(),
          });

        console.log(`[Webhook] ✅ Updated user ${uid} → tier=${tier} billing=${billing}`);
        return res.json({ received: true, action: "subscription_activated", uid, tier });
      } else {
        console.warn(`[Webhook] No user found with email: ${email}`);
      }
    }

    return res.json({ received: true, action: "no_user_matched" });

  } catch (err) {
    console.error("[Webhook] Error:", err);
    // Always return 200 to PayMob so they don't retry
    return res.status(200).json({ received: true, error: err.message });
  }
}
