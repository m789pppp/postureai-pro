/**
 * POST /api/habits/whatsapp-test
 * Sends a test WhatsApp reminder via Twilio
 * Body: { phone, name, lang }
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }) });
  }
  return getAuth();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Was completely unauthenticated — this sends a real, Twilio-billed
  // WhatsApp message to whatever phone number is in the request body,
  // which the caller fully controls. Anyone who found this URL could
  // spam arbitrary numbers at the business's expense with no rate limit
  // or attribution. Require a valid Firebase token, same as every other
  // endpoint in this codebase that spends money or messages a third party.
  const idToken = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!idToken) return res.status(401).json({ error: "Authentication required" });
  try { await getAdminAuth().verifyIdToken(idToken); }
  catch { return res.status(401).json({ error: "Invalid or expired token" }); }

  const { phone, name = "User", lang = "en" } = req.body || {};
  if (!phone) return res.status(400).json({ error: "phone required" });

  const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const WA_FROM      = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886"; // Twilio sandbox default

  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return res.status(503).json({ error: "Twilio not configured" });
  }

  const to = phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;

  const body = lang === "ar"
    ? `🦅 مرحباً ${name}!\n\nكورفوس بيذكّرك تبدأ جلسة الوضعية بتاعتك النهارده 💪\n\nجلسة واحدة كل يوم بتصنع الفرق.\n\n— فريق Corvus PostureAI`
    : `🦅 Hey ${name}!\n\nCorvus reminder: time for your daily posture session 💪\n\nOne session a day makes all the difference.\n\n— Corvus PostureAI Team`;

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
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: data.message || "Twilio error" });
    return res.status(200).json({ ok: true, sid: data.sid });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
