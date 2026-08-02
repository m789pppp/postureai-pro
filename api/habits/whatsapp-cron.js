/**
 * POST /api/habits/whatsapp-cron
 * Called by Vercel Cron every hour — sends WhatsApp reminders to users
 * whose reminder_time matches the current hour (Egypt time, UTC+3).
 *
 * Add to vercel.json:
 * "crons": [{ "path": "/api/habits/whatsapp-cron", "schedule": "0 * * * *" }]
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const WA_FROM      = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  if (!TWILIO_SID || !TWILIO_TOKEN) return res.status(503).json({ error: "Twilio not configured" });

  const db = getAdmin();

  // Current hour in Cairo (UTC+3)
  const cairoHour = new Date(Date.now() + 3 * 3600000).toISOString().slice(11, 16); // "09:00"

  // Get users with whatsapp reminders enabled at this hour
  const snap = await db.collection("users")
    .where("whatsapp_reminder_enabled", "==", true)
    .where("reminder_time", "==", cairoHour)
    .limit(100)
    .get();

  const results = [];
  for (const doc of snap.docs) {
    const u = doc.data();
    if (!u.whatsapp_phone) continue;

    const to = u.whatsapp_phone.startsWith("whatsapp:")
      ? u.whatsapp_phone : `whatsapp:${u.whatsapp_phone}`;
    const lang = u.lang || "en";
    const name = u.name || "User";

    const body = lang === "ar"
      ? `🦅 صباح الخير ${name}!\n\nوقت جلسة الوضعية اليومية بتاعتك مع Corvus 💪\n\nافتح التطبيق وابدأ جلستك دلوقتي.`
      : `🦅 Good morning ${name}!\n\nTime for your daily posture session with Corvus 💪\n\nOpen the app and start your session now.`;

    try {
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
          },
          body: new URLSearchParams({ To: to, From: WA_FROM, Body: body }).toString(),
        }
      );
      results.push({ uid: doc.id, ok: r.ok });
    } catch (e) {
      results.push({ uid: doc.id, ok: false, error: e.message });
    }
  }

  return res.status(200).json({ sent: results.length, results });
}
