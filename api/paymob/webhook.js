/**
 * Vercel Serverless — PayMob Webhook
 * POST /api/paymob/webhook?hmac=xxx
 * Verifies HMAC using PayMob's concatenated-fields method, updates Firestore
 */
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── Firebase Admin ────────────────────────────────────────────────
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

// ── PayMob HMAC: concatenate specific fields in exact order ───────
// Ref: https://docs.paymob.com/docs/hmac-calculation
function computePaymobHmac(obj, secret) {
  const t = obj || {};
  const order = t.order || {};
  const billingData = t.billing_data || {};

  const fields = [
    t.amount_cents,
    t.created_at,
    t.currency,
    t.error_occured,
    t.has_parent_transaction,
    t.id,
    t.integration_id,
    t.is_3d_secure,
    t.is_auth,
    t.is_capture,
    t.is_refunded,
    t.is_standalone_payment,
    t.is_voided,
    order.id,
    order.created_at,
    t.owner,
    t.pending,
    billingData.apartment,
    billingData.city,
    billingData.country,
    billingData.email,
    billingData.first_name,
    billingData.floor,
    billingData.last_name,
    billingData.phone_number,
    billingData.postal_code,
    billingData.shipping_method,
    billingData.state,
    billingData.street,
    t.source_data?.pan,
    t.source_data?.sub_type,
    t.source_data?.type,
    t.success,
  ];

  const concatenated = fields.map(v => (v === undefined || v === null) ? "" : String(v)).join("");
  return crypto.createHmac("sha512", secret).update(concatenated).digest("hex");
}

// ── Tier mapping from merchant_order_id ──────────────────────────
// Format: CORVUS-{uid8}-{tier}-{billingChar}-{timestamp}
function parseMerchantId(merchant_order_id) {
  const parts = (merchant_order_id || "").split("-");
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

  const HMAC_SECRET    = process.env.PAYMOB_HMAC_SECRET || "";
  const received_hmac  = req.query.hmac || "";

  try {
    const payload = req.body || {};
    const obj     = payload.obj || {};

    // ── HMAC verification (PayMob field-concatenation method) ─────
    if (HMAC_SECRET) {
      if (!received_hmac) {
        console.error("[Webhook] No HMAC in query string");
        return res.status(403).json({ error: "Missing HMAC" });
      }
      const computed = computePaymobHmac(obj, HMAC_SECRET);
      // timingSafeEqual requires same length buffers
      const a = Buffer.from(computed,       "hex");
      const b = Buffer.from(received_hmac,  "hex");
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        console.error("[Webhook] HMAC mismatch — possible spoofing");
        return res.status(403).json({ error: "Invalid HMAC" });
      }
    } else {
      console.warn("[Webhook] PAYMOB_HMAC_SECRET not set — skipping HMAC check");
    }

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

    console.log(`[Webhook] Payment success — ${merchant_id} — ${amount_cents} EGP cents`);

    const parsed = parseMerchantId(merchant_id);
    if (!parsed) {
      console.warn("[Webhook] Could not parse merchant_order_id:", merchant_id);
      return res.json({ received: true, action: "parse_failed" });
    }

    const { tier, billing } = parsed;
    const db = getAdminDb();

    // Find user by email
    if (email && email !== "NA") {
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
          subscription_status:  "active",
          subscription_start:   now.toISOString(),
          subscription_expiry:  expiry.toISOString(),
          payment_method:       "paymob",
          last_payment_amount:  amount_cents,
          last_payment_date:    now.toISOString(),
          last_transaction_id:  transaction_id,
          updated_at:           now.toISOString(),
        });

        await db.collection("users").doc(uid)
          .collection("payments").doc(transaction_id).set({
            tier, billing, amount_cents,
            merchant_order_id: merchant_id,
            payment_method: "paymob",
            status: "success",
            created_at: now.toISOString(),
          });

        console.log(`[Webhook] Updated user ${uid} => tier=${tier} billing=${billing}`);
        return res.json({ received: true, action: "subscription_activated", uid, tier });
      } else {
        console.warn(`[Webhook] No user found with email: ${email}`);
      }
    }

    return res.json({ received: true, action: "no_user_matched" });

  } catch (err) {
    console.error("[Webhook] Error:", err);
    // Always 200 so PayMob doesn't retry
    return res.status(200).json({ received: true, error: err.message });
  }
}
