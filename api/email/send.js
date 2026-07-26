/**
 * Vercel Serverless — Email Dispatcher
 * POST /api/email/invoice
 * POST /api/email/welcome
 * POST /api/email/weekly-report
 * POST /api/email/weekly-progress
 * POST /api/email/sequence
 *
 * Uses Resend (primary) — add RESEND_API_KEY to Vercel env vars
 * Falls back to console.log if key missing (dev mode)
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }
  return getAuth();
}

const RESEND_KEY   = process.env.RESEND_API_KEY || "";
const FROM_EMAIL   = process.env.EMAIL_FROM     || "Corvus PostureAI <noreply@corvus.io>";
const APP_URL      = process.env.VITE_APP_URL   || "https://postureai-pro-omega-nine.vercel.app";

// ── Send via Resend ───────────────────────────────────────────────
async function sendResend(to, subject, html) {
  if (!RESEND_KEY) {
    console.log("[Email] RESEND_API_KEY not set — dev mode:", { to, subject });
    return { ok: true, dev: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body:    JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    signal:  AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message || "Resend error " + res.status);
  }
  const d = await res.json();
  return { ok: true, id: d.id };
}

// ── Email templates ───────────────────────────────────────────────
function baseLayout(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>
  body { margin:0; padding:0; background:#04080e; font-family:'Segoe UI',system-ui,sans-serif; color:#e6edf3; }
  .wrap { max-width:600px; margin:0 auto; padding:32px 16px; }
  .card { background:#0b1420; border:1px solid rgba(56,139,253,.15); border-radius:16px; padding:32px; }
  .logo { font-size:22px; font-weight:900; color:#388bfd; letter-spacing:-.02em; margin-bottom:8px; }
  .logo span { color:#06b6d4; }
  h1 { font-size:22px; font-weight:800; color:#e6edf3; margin:24px 0 12px; }
  p { font-size:14px; line-height:1.7; color:#8b949e; margin:0 0 16px; }
  .highlight { color:#e6edf3; font-weight:600; }
  .btn { display:inline-block; padding:12px 28px; background:linear-gradient(135deg,#1158c7,#0891b2);
    color:#fff; text-decoration:none; border-radius:10px; font-weight:700; font-size:14px; margin:16px 0; }
  .stat { background:rgba(56,139,253,.07); border:1px solid rgba(56,139,253,.15); border-radius:10px;
    padding:14px 18px; margin:8px 0; display:flex; justify-content:space-between; align-items:center; }
  .stat-val { font-size:20px; font-weight:800; color:#388bfd; }
  .stat-label { font-size:12px; color:#6e7681; }
  .divider { border:none; border-top:1px solid rgba(56,139,253,.1); margin:24px 0; }
  .footer { font-size:11px; color:#6e7681; text-align:center; margin-top:24px; line-height:1.6; }
  .badge { display:inline-block; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:700; }
  .badge-elite { background:rgba(167,139,250,.15); color:#a78bfa; border:1px solid rgba(167,139,250,.3); }
  .badge-pro   { background:rgba(56,139,253,.15);  color:#388bfd;  border:1px solid rgba(56,139,253,.3); }
  .badge-basic { background:rgba(63,185,80,.12);   color:#3fb950;  border:1px solid rgba(63,185,80,.25); }
</style></head><body>
<div class="wrap">
  <div class="logo">Corvus <span>PostureAI</span></div>
  <div class="card">${content}</div>
  <div class="footer">
    Corvus PostureAI Pro · <a href="${APP_URL}" style="color:#388bfd;">Open Dashboard</a><br>
    You're receiving this because you have an account at corvus.io
  </div>
</div></body></html>`;
}

function welcomeTemplate({ name, tier, email }) {
  const tierBadge = tier === "elite" ? "elite" : tier === "professional" ? "pro" : "basic";
  return baseLayout(`
    <h1>Welcome to Corvus, ${name || "there"}! 👋</h1>
    <p>Your account is ready. You're on the <span class="badge badge-${tierBadge}">${tier || "Standard"}</span> plan.</p>
    <p>Start your first posture session to get personalized AI insights from Dr. Corvus, your AI physiotherapy specialist.</p>
    <a class="btn" href="${APP_URL}">Open Dashboard →</a>
    <hr class="divider">
    <p style="font-size:12px;">Account: <span class="highlight">${email}</span></p>
  `);
}

function invoiceTemplate({ name, tier, amount, billing, ref, email }) {
  const amountStr = amount > 0 ? amount.toLocaleString() + " EGP" : "Free";
  const action    = billing === "cancelled" ? "Subscription Cancelled" : "Payment Confirmed";
  const icon      = billing === "cancelled" ? "⚠️" : "✅";
  return baseLayout(`
    <h1>${icon} ${action}</h1>
    <p>Hi <span class="highlight">${name || "there"}</span>,</p>
    ${billing === "cancelled"
      ? `<p>Your <span class="highlight">${tier}</span> subscription has been cancelled. You'll keep access until the end of your billing period.</p>`
      : `<p>Your payment of <span class="highlight">${amountStr}</span> for the <span class="highlight">${tier}</span> plan (${billing}) was processed successfully.</p>`
    }
    <div class="stat"><span class="stat-label">Plan</span><span class="stat-val">${tier || "—"}</span></div>
    <div class="stat"><span class="stat-label">Amount</span><span class="stat-val">${amountStr}</span></div>
    <div class="stat"><span class="stat-label">Reference</span><span class="stat-val" style="font-size:13px">${ref || "—"}</span></div>
    <a class="btn" href="${APP_URL}">View Account →</a>
    <p style="font-size:12px;">Sent to: <span class="highlight">${email}</span></p>
  `);
}

function weeklyReportTemplate({ name, avg_score, sessions, streak, top_alert, trend_pct }) {
  const scoreColor = avg_score >= 80 ? "#3fb950" : avg_score >= 60 ? "#d29922" : "#f85149";
  const trendIcon  = trend_pct > 0 ? "📈" : trend_pct < 0 ? "📉" : "➡️";
  return baseLayout(`
    <h1>Your Weekly Posture Report 📊</h1>
    <p>Hi <span class="highlight">${name || "there"}</span>, here's your summary for this week:</p>
    <div class="stat">
      <span class="stat-label">Avg Posture Score</span>
      <span class="stat-val" style="color:${scoreColor}">${avg_score || 0}/100</span>
    </div>
    <div class="stat">
      <span class="stat-label">Sessions Completed</span>
      <span class="stat-val">${sessions || 0}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Current Streak</span>
      <span class="stat-val">${streak || 0} days 🔥</span>
    </div>
    <div class="stat">
      <span class="stat-label">Week Trend</span>
      <span class="stat-val">${trendIcon} ${trend_pct > 0 ? "+" : ""}${trend_pct || 0}%</span>
    </div>
    ${top_alert ? `<p style="margin-top:16px">⚠️ Top issue this week: <span class="highlight">${top_alert}</span></p>` : ""}
    <a class="btn" href="${APP_URL}">View Full Report →</a>
  `);
}

function sequenceTemplate({ name, step, subject: subj, body }) {
  return baseLayout(`
    <h1>${subj || "A message from Corvus"}</h1>
    <p>Hi <span class="highlight">${name || "there"}</span>,</p>
    <p>${body || "We wanted to check in and make sure you're getting the most out of Corvus PostureAI."}</p>
    <a class="btn" href="${APP_URL}">Open Corvus →</a>
  `);
}

// ── Handler ───────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  APP_URL);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  // Auth — require valid Firebase token
  const idToken = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!idToken) return res.status(401).json({ error: "Authentication required" });
  try { await getAdminAuth().verifyIdToken(idToken); }
  catch { return res.status(401).json({ error: "Invalid token" }); }

  const path = req.url.split("?")[0];
  const body = req.body || {};

  try {
    let to, subject, html;

    if (path.endsWith("/welcome")) {
      to      = body.email;
      subject = "Welcome to Corvus PostureAI 👋";
      html    = welcomeTemplate(body);
    } else if (path.endsWith("/invoice")) {
      to      = body.email;
      subject = body.billing === "cancelled"
        ? "Your Corvus subscription has been cancelled"
        : "Payment confirmed — Corvus PostureAI";
      html    = invoiceTemplate(body);
    } else if (path.endsWith("/weekly-report") || path.endsWith("/weekly-progress")) {
      to      = body.email;
      subject = "Your weekly posture report 📊";
      html    = weeklyReportTemplate(body);
    } else if (path.endsWith("/sequence")) {
      to      = body.email;
      subject = body.subject || "A note from Corvus";
      html    = sequenceTemplate(body);
    } else {
      return res.status(404).json({ error: "Unknown email endpoint" });
    }

    if (!to || !to.includes("@")) {
      return res.status(400).json({ error: "Valid email address required" });
    }

    const result = await sendResend(to, subject, html);
    return res.json(result);

  } catch (e) {
    console.error("[Email]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
