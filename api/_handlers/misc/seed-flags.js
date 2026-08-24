/**
 * Vercel Serverless — Seed Feature Flags
 * POST /api/admin/seed-flags
 * Admin-only: creates default feature_flags documents in Firestore
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

const DEFAULT_FLAGS = [
  { id:"ai_coach",          label:"AI Coach",               enabled:true,  rollout_pct:100, tiers:["pro","elite"],           description:"Dr. Corvus AI chat" },
  { id:"ai_insights",       label:"AI Insights",            enabled:true,  rollout_pct:100, tiers:["standard","pro","elite"],description:"AI posture insight tabs" },
  { id:"ai_reports",        label:"AI Reports",             enabled:true,  rollout_pct:100, tiers:["pro","elite"],           description:"PDF reports with AI" },
  { id:"predictive_ai",     label:"Predictive AI",          enabled:true,  rollout_pct:100, tiers:["elite"],                 description:"Burnout & risk forecasting" },
  { id:"notifications_hub", label:"Notifications Hub",      enabled:true,  rollout_pct:100, tiers:["standard","pro","elite"],description:"Slack/Teams/Jira" },
  { id:"hr_dashboard",      label:"HR Dashboard",           enabled:true,  rollout_pct:100, tiers:["business","enterprise"], description:"Workforce analytics" },
  { id:"web_push",          label:"Web Push",               enabled:true,  rollout_pct:100, tiers:["standard","pro","elite"],description:"Browser push notifications" },
  { id:"mfa",               label:"MFA",                    enabled:true,  rollout_pct:100, tiers:["standard","pro","elite"],description:"TOTP and SMS 2FA" },
  { id:"white_label",       label:"White Label",            enabled:false, rollout_pct:0,   tiers:["enterprise"],            description:"Custom branding" },
  { id:"embed_widget",      label:"Embed Widget",           enabled:true,  rollout_pct:50,  tiers:["business","enterprise"], description:"Embeddable widget" },
  { id:"bulk_import",       label:"Bulk Import",            enabled:true,  rollout_pct:100, tiers:["business","enterprise"], description:"CSV employee import" },
  { id:"churn_prediction",  label:"Churn Prediction",       enabled:true,  rollout_pct:100, tiers:["platform_admin"],        description:"Churn & health dashboard" },
  { id:"growth_hub",        label:"Growth Hub",             enabled:true,  rollout_pct:100, tiers:["platform_admin"],        description:"Revenue analytics" },
  { id:"customer_success",  label:"Customer Success",       enabled:true,  rollout_pct:100, tiers:["platform_admin"],        description:"CS playbooks" },
  { id:"offline_kb",        label:"Offline KB Fallback",    enabled:true,  rollout_pct:100, tiers:["standard","pro","elite"],description:"Rule-based AI fallback" },
  { id:"dark_mode",         label:"Dark Mode",              enabled:true,  rollout_pct:100, tiers:["standard","pro","elite"],description:"Theme toggle" },
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.VITE_APP_URL || "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  const { auth, db } = getAdmin();
  const idToken = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!idToken) return res.status(401).json({ error: "Auth required" });

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const userDoc = (await db.collection("users").doc(decoded.uid).get()).data();
    if (!userDoc?.is_admin) return res.status(403).json({ error: "Admin required" });

    const { force = false } = req.body || {};
    const batch = db.batch();
    const results = [];

    for (const flag of DEFAULT_FLAGS) {
      const ref  = db.collection("feature_flags").doc(flag.id);
      const snap = await ref.get();
      // Same `.exists()` vs `.exists` bug as org-invite.js — a property in
      // this (Node admin) SDK, not a method. Threw on every call, breaking
      // this admin utility entirely.
      if (snap.exists && !force) { results.push({ id: flag.id, action:"skipped" }); continue; }
      batch.set(ref, { ...flag, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { merge: true });
      results.push({ id: flag.id, action: snap.exists ? "updated" : "created" });
    }

    await batch.commit();
    return res.json({
      ok: true,
      summary: {
        created: results.filter(r=>r.action==="created").length,
        updated: results.filter(r=>r.action==="updated").length,
        skipped: results.filter(r=>r.action==="skipped").length,
      },
      results,
    });
  } catch (e) {
    if (e.code === "auth/id-token-expired") return res.status(401).json({ error: "Session expired" });
    return res.status(500).json({ error: e.message });
  }
}
