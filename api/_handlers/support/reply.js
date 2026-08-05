/**
 * POST /api/support/reply
 * Admin-only: send a reply on a support_tickets thread. If the ticket's
 * source is "whatsapp", the reply also goes out over WhatsApp via
 * Twilio — this is the other half of whatsapp-inbound.js (that receives,
 * this sends). Also stamps first_responded_at the first time a ticket
 * gets a reply, which is what the SLA countdown in CustomerSuccess.jsx
 * checks against.
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }) });
  }
  return { auth: getAuth(), db: getFirestore() };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.VITE_APP_URL || "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { auth, db } = getAdmin();
  const idToken = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!idToken) return res.status(401).json({ error: "Auth required" });

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const adminDoc = (await db.collection("users").doc(decoded.uid).get()).data();
    if (!adminDoc?.is_admin) return res.status(403).json({ error: "Admin required" });

    const { ticket_id, body } = req.body || {};
    if (!ticket_id || !body?.trim()) return res.status(400).json({ error: "ticket_id and body required" });

    const ref  = db.collection("support_tickets").doc(ticket_id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Ticket not found" });
    const ticket = snap.data();

    const nowIso = new Date().toISOString();
    let waSent = null;
    if (ticket.source === "whatsapp" && ticket.phone) {
      const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
      const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
      const WA_FROM       = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
      if (TWILIO_SID && TWILIO_TOKEN) {
        try {
          const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
            },
            body: new URLSearchParams({
              To: `whatsapp:${ticket.phone}`, From: WA_FROM, Body: body.trim(),
            }).toString(),
          });
          waSent = r.ok;
        } catch (e) {
          waSent = false;
        }
      }
    }

    await ref.update({
      messages: FieldValue.arrayUnion({ from: "agent", agent_uid: decoded.uid, body: body.trim(), ts: nowIso }),
      last_message_at: nowIso,
      last_message_from: "agent",
      // Only stamp the SLA clock the FIRST time — later replies in the
      // same thread don't move it.
      ...(ticket.first_responded_at ? {} : { first_responded_at: nowIso }),
    });

    return res.json({ ok: true, whatsapp_sent: waSent });
  } catch (e) {
    console.error("[support/reply]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
