/**
 * Vercel Serverless — Kashier Webhook
 * POST /api/kashier/webhook
 * No Firebase auth here — this is called by Kashier servers, not users.
 * Security: X-Kashier-Signature HMAC-SHA256 verification (always required).
 * Docs: https://developers.kashier.io/payment/webhooks
 */
import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Vercel's default body parser JSON-parses the request before this handler
// runs, discarding the original bytes — the handler below used to
// re-serialize that parsed object with JSON.stringify() and sign THAT
// instead of what Kashier actually signed. re-stringifying isn't guaranteed
// byte-identical to the original request (key order, number formatting like
// trailing zeros, unicode escaping can all differ), so a real, successful
// payment could fail signature verification and get logged as "possible
// spoofing" — the subscription would then never activate despite the
// customer being charged. Disabling the parser and reading the true raw
// bytes ourselves makes signature verification match what Kashier actually
// sent, byte for byte.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

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

/**
 * Parse a marketplace booking orderId: BOOKING-{uid8}-{bookingId}-{timestamp}
 * (Firestore auto-IDs are alphanumeric, no hyphens, so index 2 is safe.)
 */
function parseBookingOrderId(orderId) {
  const parts = (orderId || "").split("-");
  if (parts.length >= 4 && parts[0] === "BOOKING") {
    return { bookingId: parts[2] };
  }
  return null;
}

/**
 * Confirm a marketplace booking payment. Ported from the old PayMob
 * webhook's equivalent branch (backend.py's paymob_webhook) when booking
 * payments moved to Kashier — same idempotency and amount-mismatch
 * protections, just running in this runtime instead.
 */
async function confirmBookingPayment(db, orderId, amount, transactionId) {
  const parsed = parseBookingOrderId(orderId);
  if (!parsed) {
    console.warn("[Kashier Webhook] Could not parse booking orderId:", orderId);
    return { received: true, action: "booking_parse_failed" };
  }
  const bookingRef = db.collection("marketplace_bookings").doc(parsed.bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) {
    console.warn("[Kashier Webhook] marketplace_bookings/" + parsed.bookingId + " not found");
    return { received: true, action: "booking_not_found" };
  }
  const booking = bookingSnap.data();

  // Idempotency — Kashier can legitimately retry the webhook
  if (booking.status === "confirmed") {
    console.log("[Kashier Webhook] Booking", parsed.bookingId, "already confirmed — skipping duplicate");
    return { received: true, note: "already processed" };
  }

  // Defense in depth — confirm the charged amount matches what this
  // booking was created for (Kashier's amount is EGP, booking stores cents).
  const paidCents = Math.round(Number(amount) * 100);
  if (booking.amount_cents !== paidCents) {
    console.error(
      "🚨 [Kashier Webhook] Booking amount mismatch: expected=" + booking.amount_cents +
      " got=" + paidCents + " booking_id=" + parsed.bookingId + " — flagged for review"
    );
    return { received: true, warning: "amount mismatch — flagged for review" };
  }

  await bookingRef.update({
    status:               "confirmed",
    kashier_transaction_id: transactionId,
    confirmed_at:          new Date().toISOString(),
  });

  if (booking.discount_code) {
    try {
      await db.collection("discount_codes").doc(booking.discount_code)
        .update({ redemption_count: FieldValue.increment(1) });
    } catch (e) {
      console.error("[Kashier Webhook] discount redemption tracking failed:", e);
    }
  }

  console.log("[Kashier Webhook] ✅ Marketplace booking", parsed.bookingId, "confirmed");
  return { received: true, action: "booking_confirmed", booking_id: parsed.bookingId };
}

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}


export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const KASHIER_API_KEY = process.env.KASHIER_API_KEY || "";

  try {
    // Kashier sends raw JSON — need the TRUE raw bytes for signature
    // verification (see the config/readRawBody comment above). bodyParser
    // is disabled for this route now, so req.body no longer exists —
    // parse rawBody ourselves instead.
    const rawBody = await readRawBody(req);
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

    let payload = {};
    try { payload = JSON.parse(rawBody || "{}"); }
    catch (e) { console.error("[Kashier Webhook] Body is not valid JSON:", e.message); return res.status(400).json({ error: "Invalid JSON body" }); }

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

    // Marketplace booking payments use a DIFFERENT orderId shape
    // (BOOKING-{uid8}-{bookingId}-{ts}) than subscription payments
    // (CORVUS-{uid8}-{tier}-{billing}-{ts}). Must be checked FIRST —
    // otherwise parseOrderId below would either misparse it or reject it,
    // and a real successful charge would never mark the booking paid.
    const db = getAdminDb();
    if (orderId.startsWith("BOOKING-")) {
      const result = await confirmBookingPayment(db, orderId, amount, transactionId);
      return res.json(result);
    }

    const parsed = parseOrderId(orderId);
    if (!parsed) {
      console.warn("[Kashier Webhook] Could not parse orderId:", orderId);
      return res.json({ received: true, action: "parse_failed" });
    }

    const { tier, billing } = parsed;

    if (email) {
      const snap = await db.collection("users").where("email", "==", email).limit(1).get();

      if (!snap.empty) {
        const userDoc = snap.docs[0];
        const uid     = userDoc.id;

        // Idempotency — same protection confirmBookingPayment() above
        // already has for marketplace bookings, was missing here. Kashier
        // can legitimately retry a webhook call (timeout, cold start, 5xx)
        // for the SAME successful payment; without this check, every retry
        // recomputed `expiry = now + 1 month/year` and overwrote it, so a
        // single real charge could silently extend a subscription by
        // multiple billing periods for free.
        if (userDoc.data().last_transaction_id === transactionId) {
          console.log("[Kashier Webhook] Transaction", transactionId, "already processed for user", uid, "— skipping duplicate");
          return res.json({ received: true, note: "already processed", uid });
        }

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
          // Feeds ChurnPrediction's health score (payment_ok, 15% weight)
          payment_ok:          true,
          payment_failed_at:   null,
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

        // ── Referral / clinic-discount reconciliation (best-effort — never blocks the webhook) ──
        try {
          const pendingRef  = db.collection("pending_orders").doc(orderId);
          const pendingSnap = await pendingRef.get();
          if (pendingSnap.exists) {
            const pendingData = pendingSnap.data();
            const creditApplied = Number(pendingData.credit_applied_egp || 0);
            if (creditApplied > 0) {
              await userDoc.ref.update({ referral_credits: FieldValue.increment(-creditApplied) });
            }
            if (pendingData.discount_code) {
              await db.collection("discount_codes").doc(pendingData.discount_code)
                .update({ redemption_count: FieldValue.increment(1) })
                .catch(e => console.error("[Kashier Webhook] discount redemption tracking failed:", e));
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
