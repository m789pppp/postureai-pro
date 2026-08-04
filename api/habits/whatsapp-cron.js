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

  // Current hour/weekday in Cairo (UTC+3)
  const cairoDate = new Date(Date.now() + 3 * 3600000);
  const cairoHour = cairoDate.toISOString().slice(11, 16); // "09:00"
  const cairoHourNum = cairoDate.getUTCHours();
  const cairoWeekday = cairoDate.getUTCDay(); // 0=Sun..6=Sat, matches computeWeeklyForecast in PredictiveAI.jsx

  const results = [];

  async function sendWhatsApp(to, body) {
    const dest = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
        },
        body: new URLSearchParams({ To: dest, From: WA_FROM, Body: body }).toString(),
      }
    );
    return r.ok;
  }

  // ── Daily session reminder ────────────────────────────────────
  const snap = await db.collection("users")
    .where("whatsapp_reminder_enabled", "==", true)
    .where("reminder_time", "==", cairoHour)
    .limit(100)
    .get();

  for (const doc of snap.docs) {
    const u = doc.data();
    if (!u.whatsapp_phone) continue;
    const lang = u.lang || "en";
    const name = u.name || "User";
    const body = lang === "ar"
      ? `🦅 صباح الخير ${name}!\n\nوقت جلسة الوضعية اليومية بتاعتك مع Corvus 💪\n\nافتح التطبيق وابدأ جلستك دلوقتي.`
      : `🦅 Good morning ${name}!\n\nTime for your daily posture session with Corvus 💪\n\nOpen the app and start your session now.`;
    try {
      results.push({ uid: doc.id, type: "daily", ok: await sendWhatsApp(u.whatsapp_phone, body) });
    } catch (e) {
      results.push({ uid: doc.id, type: "daily", ok: false, error: e.message });
    }
  }

  // ── Predictive AI weekly stretch reminder (Elite) ──────────────
  // Set by the Weekly Plan tab in PredictiveAI.jsx (frontend/src/
  // PredictiveAI.jsx computeWeeklyForecast + saveStretchReminder) — fires
  // once, the day before the predicted risk window, at a fixed 2pm slot.
  const wfSnap = await db.collection("users")
    .where("predictive_stretch_reminder.enabled", "==", true)
    .limit(200)
    .get();

  for (const doc of wfSnap.docs) {
    const u = doc.data();
    const pr = u.predictive_stretch_reminder;
    if (!pr || !u.whatsapp_phone) continue;
    if (pr.weekday !== cairoWeekday || pr.hour !== cairoHourNum) continue;

    const lang = u.lang || "en";
    const name = u.name || "User";
    const region = lang === "ar" ? (pr.region_ar || "وضعيتك") : (pr.region_en || "your posture");
    const body = lang === "ar"
      ? `🦅 تذكير وقائي من Corvus\n\nبناءً على نمطك المعتاد، بكرة ممكن تحس بألم في ${region}. خد 10 دقايق stretch دلوقتي عشان تقلل الاحتمال.\n\nافتح التطبيق لتمارين مقترحة.`
      : `🦅 Preventive reminder from Corvus\n\nBased on your usual pattern, tomorrow may bring some ${region} discomfort. Take 10 minutes to stretch now to lower the odds.\n\nOpen the app for suggested stretches.`;
    try {
      results.push({ uid: doc.id, type: "predictive", ok: await sendWhatsApp(u.whatsapp_phone, body) });
    } catch (e) {
      results.push({ uid: doc.id, type: "predictive", ok: false, error: e.message });
    }
  }

  return res.status(200).json({ sent: results.length, results });
}
