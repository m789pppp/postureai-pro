// UNROUTED. Kept only so api/misc.js's import does not break.
//
// This never worked: it read users/{uid}/symptom_logs ordered by `createdAt`,
// and nothing writes that collection or that field — symptom logs go to the
// top-level `symptom_logs` with a `date` field (backend.py log_symptom) and
// stress logs to `stress_logs`. It also returned {ok, days, symptoms,
// correlation:"insufficient_data"} while StressPosture.jsx reads
// {enough_data, days_logged, min_required, correlation:<number>}. So a user
// could log stress daily for a month and the card would still say "log 5 more
// days" — and because vercel.json routed /api/stress/correlation here, it
// SHADOWED backend.py's stress_correlation(), which reads the right collection
// and returns the right shape. That route was removed; the path now falls
// through to api/main.py. Do not re-route to this file.
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
