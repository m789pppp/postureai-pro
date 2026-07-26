/**
 * Vercel Cron relay — GET /api/cron/symptom-pattern-alerts
 *
 * backend/backend.py's /api/push/symptom-pattern-alerts was fully built —
 * real correlation re-check, cooldown logic, push notifications tying the
 * Symptom Correlation Engine to the Physiotherapist Marketplace — and
 * protected by CRON_SECRET, clearly meant to run on a schedule ("intended
 * to run roughly weekly" per its own docstring). But nothing anywhere
 * ever scheduled or called it: no crons entry in vercel.json, no GitHub
 * Actions schedule. It had never run once outside manual testing.
 *
 * Vercel Cron Jobs can only target paths inside the same Vercel
 * deployment (always via GET) — they can't call an external Railway URL
 * directly. This is the thin relay: Vercel Cron hits this on schedule,
 * this makes the real authenticated POST to the Flask backend.
 */
const BACKEND_URL = process.env.VITE_API_URL || process.env.BACKEND_URL || "";
const CRON_SECRET  = process.env.CRON_SECRET || "";

export default async function handler(req, res) {
  // Vercel signs its own cron requests with this header — reject anything else
  // (belt-and-suspenders on top of CRON_SECRET, which the downstream call needs anyway).
  const vercelCronHeader = req.headers["x-vercel-cron"];
  if (!vercelCronHeader && process.env.NODE_ENV === "production") {
    return res.status(401).json({ error: "Not a Vercel Cron request" });
  }
  if (!BACKEND_URL || !CRON_SECRET) {
    return res.status(503).json({ error: "BACKEND_URL or CRON_SECRET not configured" });
  }

  try {
    const resp = await fetch(`${BACKEND_URL}/api/push/symptom-pattern-alerts`, {
      method: "POST",
      headers: { "X-Cron-Secret": CRON_SECRET },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("[cron relay] symptom-pattern-alerts failed:", resp.status, data);
      return res.status(resp.status).json(data);
    }
    return res.status(200).json(data);
  } catch (e) {
    console.error("[cron relay] symptom-pattern-alerts error:", e);
    return res.status(500).json({ error: String(e) });
  }
}
