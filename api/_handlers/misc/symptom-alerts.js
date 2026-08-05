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
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\n/g, "\n"),
    }) });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  // Vercel Cron authentication
  const vercelCronHeader = req.headers["x-vercel-cron"];
  if (!vercelCronHeader && process.env.NODE_ENV === "production") {
    return res.status(401).json({ error: "Not a Vercel Cron request" });
  }

  try {
    const db = getAdmin();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // Find users with high neck risk (score < 60 in last 30 days)
    const usersSnap = await db.collection("users")
      .where("subscription_status", "==", "active")
      .limit(200).get();

    let alertsSent = 0;
    const batch = db.batch();

    for (const userDoc of usersSnap.docs) {
      const uid  = userDoc.id;
      const user = userDoc.data();

      // Get recent sessions
      const sessSnap = await db.collection("sessions")
        .where("uid", "==", uid)
        .orderBy("created_at", "desc")
        .limit(10).get();

      if (sessSnap.empty) continue;

      const scores = sessSnap.docs.map(d => d.data().avg_score || 0);
      const avgScore = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length);
      const trend    = scores.length > 1 ? scores[0] - scores[scores.length-1] : 0;

      // Alert if: avg < 60 and declining trend
      if (avgScore < 60 && trend < -5) {
        const notifRef = db.collection("users").doc(uid)
          .collection("notifications").doc();
        batch.set(notifRef, {
          type:       "risk_alert",
          icon:       "🚨",
          title:      "Posture Risk Alert",
          body:       "Your posture score has declined " + Math.abs(trend) + " points recently. Time for a check-in with Dr. Corvus.",
          color:      "#f85149",
          read:       false,
          created_at: new Date().toISOString(),
        });
        alertsSent++;
      }
    }

    if (alertsSent > 0) await batch.commit();

    const data = { ok: true, alerts_sent: alertsSent, users_checked: usersSnap.size };
    console.log("[cron] symptom-pattern-alerts:", data);
    return res.status(200).json(data);
    return res.status(200).json(data);
  } catch (e) {
    console.error("[cron relay] symptom-pattern-alerts error:", e);
    return res.status(500).json({ error: String(e) });
  }
}
