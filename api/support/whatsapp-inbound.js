/**
 * POST /api/support/whatsapp-inbound
 * Twilio WhatsApp inbound webhook — set this as the "A message comes in"
 * webhook on the Twilio WhatsApp sender in the Twilio console.
 *
 * What this does (and doesn't do):
 * - Verifies the request is genuinely from Twilio (signature check).
 * - Looks up the sender by whatsapp_phone on the users collection to
 *   attach uid/tier/name if they're a known Corvus user.
 * - Creates or threads a support_tickets doc (frontend/src/
 *   CustomerSuccess.jsx already reads this collection for the admin
 *   panel, but nothing was ever writing to it — this is the first
 *   real writer).
 * - Elite senders get priority:"high" and a 1-hour SLA target
 *   (first_response_due_at); everyone else gets priority:"medium" and
 *   24h. This is a TRACKED target, not an enforced guarantee — nothing
 *   in code can force a human to actually reply within the hour. What
 *   this DOES do is make a breach immediately visible (see
 *   CustomerSuccess.jsx's SLA countdown/overdue badge) instead of
 *   silently missing it.
 * - Sends an immediate auto-ack so the Elite SLA promise is stated
 *   honestly (an ack, not a resolution) rather than leaving the user
 *   wondering if the message even arrived.
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import crypto from "crypto";

function getAdmin() {
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

// Twilio signs: HMAC-SHA1(authToken, fullURL + sorted "key"+"value" pairs
// concatenated), base64-encoded. https://www.twilio.com/docs/usage/security
function validTwilioSignature(url, params, signature, authToken) {
  if (!signature || !authToken) return false;
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url);
  const expected = crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false; // length mismatch etc — treat as invalid, not a crash
  }
}

async function sendWhatsApp(sid, token, from, to, body) {
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  return r.ok;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const WA_FROM       = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  if (!TWILIO_SID || !TWILIO_TOKEN) return res.status(503).send("Twilio not configured");

  // Twilio webhooks send application/x-www-form-urlencoded — Vercel
  // parses this into req.body automatically for that content-type.
  const params = req.body || {};
  const signature = req.headers["x-twilio-signature"];
  const fullUrl = `https://${req.headers.host}${req.url}`;
  if (!validTwilioSignature(fullUrl, params, signature, TWILIO_TOKEN)) {
    return res.status(403).send("Invalid signature");
  }

  const fromRaw = params.From || ""; // "whatsapp:+201234567890"
  const body    = (params.Body || "").trim();
  if (!fromRaw || !body) {
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send("<Response></Response>");
  }
  const phoneDigits = fromRaw.replace("whatsapp:", "");

  const db = getAdmin();

  // Look up the sender — try exact match first (most whatsapp_phone
  // values are stored with the leading + already), then a loose match.
  let uid = null, tier = "standard", name = null, lang = "en";
  try {
    const q = await db.collection("users").where("whatsapp_phone", "==", phoneDigits).limit(1).get();
    if (!q.empty) {
      const u = q.docs[0].data();
      uid = q.docs[0].id; tier = (u.tier || "standard").toLowerCase();
      name = u.name || null; lang = u.lang || "en";
    }
  } catch (e) {
    console.error("[whatsapp-inbound] user lookup failed:", e.message);
  }
  const isElite = ["elite", "premium"].includes(tier);
  const nowIso = new Date().toISOString();

  try {
    // Thread into an existing OPEN ticket from this phone if one exists,
    // otherwise open a new one.
    const existingQ = await db.collection("support_tickets")
      .where("phone", "==", phoneDigits)
      .where("status", "==", "open")
      .orderBy("created_at", "desc")
      .limit(1)
      .get();

    let ticketId, isNew = false, dueAt = nowIso;
    if (!existingQ.empty) {
      ticketId = existingQ.docs[0].id;
      dueAt = existingQ.docs[0].data().first_response_due_at || nowIso;
      await db.collection("support_tickets").doc(ticketId).update({
        messages: FieldValue.arrayUnion({ from: "user", body, ts: nowIso }),
        last_message_at: nowIso,
        last_message_from: "user",
      });
    } else {
      isNew = true;
      const slaHours = isElite ? 1 : 24;
      dueAt = new Date(Date.now() + slaHours * 3600000).toISOString();
      const ref = await db.collection("support_tickets").add({
        subject: body.length > 60 ? body.slice(0, 60) + "…" : body,
        user: name || phoneDigits,
        email: null,
        uid, phone: phoneDigits, tier,
        status: "open",
        priority: isElite ? "high" : "medium",
        source: "whatsapp",
        sla_hours: slaHours,
        first_response_due_at: dueAt,
        first_responded_at: null,
        messages: [{ from: "user", body, ts: nowIso }],
        last_message_at: nowIso,
        last_message_from: "user",
        created_at: FieldValue.serverTimestamp(),
      });
      ticketId = ref.id;
    }

    // Honest auto-ack — states the SLA as a target, not a resolution promise.
    if (isNew) {
      const ackBody = isElite
        ? (lang === "ar"
            ? `🦅 وصلتنا رسالتك! فريق دعم Elite بيراجعها دلوقتي وهيردّ خلال ساعة.`
            : `🦅 Got your message! Our Elite support team is on it — you'll hear back within an hour.`)
        : (lang === "ar"
            ? `🦅 وصلتنا رسالتك، فريقنا هيراجعها ويرد عليك قريب.`
            : `🦅 Got your message — our team will get back to you soon.`);
      await sendWhatsApp(TWILIO_SID, TWILIO_TOKEN, WA_FROM, fromRaw, ackBody).catch(() => {});
    }

    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send("<Response></Response>");
  } catch (e) {
    console.error("[whatsapp-inbound] failed:", e.message);
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send("<Response></Response>"); // still 200 — Twilio retries on non-2xx
  }
}
