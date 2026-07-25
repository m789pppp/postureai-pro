/**
 * Vercel Serverless — Org Invite endpoints
 * POST /api/org/invite/accept   — accept an invite token, link user to company
 * POST /api/org/invite/consent  — save monitoring consent decision
 * POST /api/org/create-invite   — HR admin creates a new invite (generates token)
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
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
  return { auth: getAuth(), db: getFirestore() };
}

async function requireAuth(req, auth) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) throw Object.assign(new Error("Authentication required"), { status: 401 });
  return await auth.verifyIdToken(token);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  process.env.VITE_APP_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { auth, db } = getAdmin();
  const path = req.url.split("?")[0];

  try {
    const decoded = await requireAuth(req, auth);
    const uid     = decoded.uid;

    // ── Accept Invite ─────────────────────────────────────────────
    if (path.endsWith("/invite/accept")) {
      const { token, company_id } = req.body || {};
      if (!token) return res.status(400).json({ error: "token required" });

      // Validate invite
      const inviteRef  = db.collection("invites").doc(token);
      const inviteSnap = await inviteRef.get();
      if (!inviteSnap.exists()) return res.status(404).json({ error: "Invite not found or expired" });

      const invite = inviteSnap.data();
      if (invite.status === "accepted") return res.status(400).json({ error: "Invite already accepted" });
      if (invite.company_id !== company_id) return res.status(403).json({ error: "Company mismatch" });

      // Check invite expiry (7 days)
      const created = new Date(invite.created_at || 0);
      if (Date.now() - created > 7 * 24 * 3600 * 1000) {
        return res.status(410).json({ error: "Invite expired" });
      }

      // Get company info
      const companySnap = await db.collection("companies").doc(company_id).get();
      const company     = companySnap.exists() ? companySnap.data() : {};

      // Link user to company using Admin SDK (bypasses Firestore client rules)
      await db.collection("users").doc(uid).update({
        company_id,
        company_name: company.name || "",
        user_type:    invite.role === "hr_admin" ? "hr_admin" : "employee",
        is_hr:        invite.role === "hr_admin",
        team:         invite.team || "",
        department:   invite.department || "",
        invited_by:   invite.invited_by || "",
        joined_at:    new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      });

      // Mark invite as accepted
      await inviteRef.update({
        status:      "accepted",
        accepted_by: uid,
        accepted_at: new Date().toISOString(),
      });

      // Add user to company members
      await db.collection("companies").doc(company_id)
        .collection("members").doc(uid).set({
          uid, role: invite.role || "employee",
          email: decoded.email || "",
          joined_at: new Date().toISOString(),
        });

      console.log("[Invite] User", uid, "joined company", company_id);
      return res.json({ ok: true, company_id, role: invite.role || "employee" });
    }

    // ── Save Consent ──────────────────────────────────────────────
    if (path.endsWith("/employee/consent") || path.endsWith("/consent")) {
      const { accepted } = req.body || {};
      await db.collection("users").doc(uid).update({
        monitoring_consent:     !!accepted,
        monitoring_consent_at:  new Date().toISOString(),
        updated_at:             new Date().toISOString(),
      });
      return res.json({ ok: true });
    }

    // ── Create Invite (HR Admin only) ─────────────────────────────
    if (path.endsWith("/create-invite") || path.endsWith("/org/create-invite")) {
      // Verify HR admin
      const userDoc = (await db.collection("users").doc(uid).get()).data();
      if (!userDoc?.is_hr && !userDoc?.is_admin && userDoc?.user_type !== "hr_admin") {
        return res.status(403).json({ error: "HR admin access required" });
      }

      const { email, role = "employee", team = "", department = "" } = req.body || {};
      if (!email) return res.status(400).json({ error: "email required" });

      const inviteId = crypto.randomBytes(16).toString("hex");
      const company_id = userDoc.company_id;
      if (!company_id) return res.status(400).json({ error: "No company associated with your account" });

      await db.collection("invites").doc(inviteId).set({
        company_id, role, team, department,
        email:        email.toLowerCase().trim(),
        invited_by:   uid,
        inviter_name: userDoc.name || "",
        status:       "pending",
        created_at:   new Date().toISOString(),
        expires_at:   new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      });

      const invite_url = (process.env.VITE_APP_URL || "https://postureai-pro-omega-nine.vercel.app")
        + "?invite=" + inviteId;

      return res.json({ ok: true, invite_id: inviteId, invite_url });
    }

    return res.status(404).json({ error: "Unknown endpoint" });

  } catch (e) {
    if (e.status === 401 || e.code === "auth/id-token-expired") {
      return res.status(401).json({ error: "Authentication required" });
    }
    console.error("[Invite]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
