// /api/announcements — in-app announcements (stored in Firestore, not Railway)
// Returns empty list gracefully when no announcements exist
import { initFirebaseAdmin } from "../../_lib/firebaseAdmin.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  // POST /api/announcements — admin creates announcement
  if (req.method === "POST") {
    try {
      const { db } = initFirebaseAdmin();
      const body = req.body || {};
      const doc = {
        title: body.title || "",
        message: body.message || body.body || "",
        type: body.type || "info",
        createdAt: new Date().toISOString(),
        active: true,
      };
      await db.collection("announcements").add(doc);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET /api/announcements
  try {
    const { db } = initFirebaseAdmin();
    const snap = await db.collection("announcements")
      .where("active", "==", true)
      .orderBy("createdAt", "desc")
      .limit(5)
      .get();
    const announcements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.status(200).json({ announcements });
  } catch (e) {
    // Return empty list instead of error — announcement bar is non-critical
    return res.status(200).json({ announcements: [] });
  }
}
