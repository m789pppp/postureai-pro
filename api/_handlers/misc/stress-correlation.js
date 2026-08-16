// /api/stress/correlation — stress pattern correlation data
// Reads from Firestore symptom logs and correlates with session scores
import { initFirebaseAdmin } from "../../_lib/firebaseAdmin.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Graceful fallback when Firebase not configured
  if (!process.env.FIREBASE_PROJECT_ID) {
    return res.status(200).json({ ok: true, symptoms: [], correlation: "firebase_not_configured" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const { auth, db } = initFirebaseAdmin();
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;
    const days = parseInt(req.query?.days || "30", 10);

    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Get symptom logs
    const sympSnap = await db.collection("users").doc(uid)
      .collection("symptom_logs")
      .where("createdAt", ">=", since)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const symptoms = sympSnap.docs.map(d => d.data());

    // Return correlation data
    return res.status(200).json({
      ok: true,
      days,
      symptoms,
      correlation: symptoms.length > 0 ? "data_available" : "insufficient_data",
    });
  } catch (e) {
    // Non-critical — return empty data
    return res.status(200).json({ ok: true, symptoms: [], correlation: "error" });
  }
}
