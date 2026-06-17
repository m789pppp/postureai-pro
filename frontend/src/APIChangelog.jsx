/**
 * APIChangelog.jsx — Corvus public changelog
 * Shows API versions, breaking changes, new features.
 * Linked from API Marketplace docs. Builds developer trust.
 */
import { useState } from "react";

const CHANGELOG = [
  {
    version: "v1.5.0",
    date: "2026-06-01",
    type: "minor",
    title: "Phase 15 — Enterprise Complete",
    breaking: false,
    items: [
      { type: "new",        text: "POST /api/auth/mfa/totp/setup — TOTP MFA setup endpoint" },
      { type: "new",        text: "POST /api/auth/mfa/sms/send — SMS MFA via Twilio" },
      { type: "new",        text: "GET  /api/org/health-scores — ML churn risk per user" },
      { type: "new",        text: "POST /api/billing/portal — Stripe Customer Portal redirect" },
      { type: "new",        text: "POST /api/admin/users/bulk-import — HR CSV import" },
      { type: "new",        text: "GET  /api/ai/usage — AI meter tracking per plan" },
      { type: "improved",   text: "POST /api/analyze — Result HMAC signing added (_sig field)" },
      { type: "improved",   text: "POST /api/billing/usage/meter — Stripe metered billing integrated" },
    ],
  },
  {
    version: "v1.4.0",
    date: "2026-05-01",
    type: "minor",
    title: "Phase 12 — API Marketplace",
    breaking: false,
    items: [
      { type: "new",        text: "GET  /api/api-keys — List API keys" },
      { type: "new",        text: "POST /api/api-keys — Create API key" },
      { type: "new",        text: "POST /v1/analyze/frame — Public API endpoint" },
      { type: "new",        text: "POST /api/webhooks — Register webhook" },
      { type: "new",        text: "GET  /api/integrations — List connected integrations" },
      { type: "improved",   text: "Rate limiting now Redis-backed (per API key per second)" },
    ],
  },
  {
    version: "v1.3.0",
    date: "2026-04-01",
    type: "minor",
    title: "Phase 11 — Audit + Multi-tenant",
    breaking: false,
    items: [
      { type: "new",        text: "POST /api/audit/logs/query — Filterable audit log query" },
      { type: "new",        text: "GET  /api/admin/tenants — Multi-tenant management" },
      { type: "new",        text: "POST /api/referral/track — Referral attribution" },
      { type: "new",        text: "GET  /api/nps/results — NPS survey results" },
    ],
  },
  {
    version: "v1.2.0",
    date: "2026-03-01",
    type: "minor",
    title: "Phase 10 — Enterprise Features",
    breaking: false,
    items: [
      { type: "new",        text: "POST /api/org/members/invite — Team invitation" },
      { type: "new",        text: "GET  /api/leaderboard — Team leaderboard" },
      { type: "new",        text: "POST /api/reports/ai — Gemini AI narrative report" },
      { type: "improved",   text: "Analysis: low-light enhancement auto-applied" },
      { type: "improved",   text: "Scoring: exponential smoothing over last 10 frames" },
    ],
  },
  {
    version: "v1.1.0",
    date: "2026-02-01",
    type: "minor",
    title: "Billing + PayMob",
    breaking: false,
    items: [
      { type: "new",        text: "POST /api/billing/paymob/create-order — EGP payments" },
      { type: "new",        text: "POST /api/stripe/webhook — Stripe subscription management" },
      { type: "improved",   text: "All plan amounts now computed server-side (no client trust)" },
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-01-01",
    type: "major",
    title: "Initial Release",
    breaking: false,
    items: [
      { type: "new", text: "POST /api/analyze — Real-time posture analysis via MediaPipe" },
      { type: "new", text: "GET  /api/sessions — Session history" },
      { type: "new", text: "GET  /api/profile — User profile" },
      { type: "new", text: "GET  /api/health — Health check" },
      { type: "new", text: "Firebase Auth integration (Google + Email)" },
    ],
  },
];

const TYPE_CONFIG = {
  major:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",    label: "Major" },
  minor:   { color: "#6366f1", bg: "rgba(99,102,241,0.1)",   label: "Minor" },
  patch:   { color: "#10b981", bg: "rgba(16,185,129,0.1)",   label: "Patch" },
};

const ITEM_COLORS = {
  new:       { color: "#10b981", icon: "✦" },
  improved:  { color: "#6366f1", icon: "▲" },
  fixed:     { color: "#f59e0b", icon: "●" },
  breaking:  { color: "#ef4444", icon: "⚠" },
  deprecated:{ color: "#64748b", icon: "↓" },
};

export function APIChangelog({ cs, onClose }) {
  const [expanded, setExpanded] = useState({ "v1.5.0": true });

  const toggle = (v) => setExpanded(p => ({ ...p, [v]: !p[v] }));

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.76)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:780, height:"88vh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        <div style={{ padding:"20px 28px", borderBottom:`1px solid ${cs.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#6366f1,#0ea5e9)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>📋</div>
            <div>
              <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>API Changelog</div>
              <div style={{ fontSize:12, color:cs.textDim }}>Corvus API v1.5.0 · Current stable</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:24 }}>
          <div style={{ background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:12, padding:14, marginBottom:20, fontSize:13, color:cs.textDim }}>
            📢 Subscribe to changelog: <a href="/api/changelog/rss" style={{ color:"#6366f1" }}>RSS Feed</a> · <a href="https://corvus.com/changelog" style={{ color:"#6366f1" }}>Web view</a>
          </div>

          {CHANGELOG.map((entry) => {
            const tc   = TYPE_CONFIG[entry.type] || TYPE_CONFIG.minor;
            const open = expanded[entry.version];
            return (
              <div key={entry.version} style={{ marginBottom:16, border:`1px solid ${cs.border}`, borderRadius:14, overflow:"hidden" }}>
                {/* Version header */}
                <div onClick={() => toggle(entry.version)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", background:"rgba(255,255,255,0.02)", cursor:"pointer" }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", flex:1 }}>
                    <span style={{ fontFamily:"monospace", fontWeight:800, fontSize:15, color:cs.text }}>{entry.version}</span>
                    <span style={{ fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20, background:tc.bg, color:tc.color }}>{tc.label}</span>
                    {entry.breaking && <span style={{ fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20, background:"rgba(239,68,68,0.12)", color:"#ef4444" }}>⚠ Breaking</span>}
                    <span style={{ fontSize:13, fontWeight:700, color:cs.text }}>{entry.title}</span>
                  </div>
                  <span style={{ fontSize:11, color:cs.textDim }}>{entry.date}</span>
                  <span style={{ color:cs.textDim, fontSize:16 }}>{open?"▼":"▶"}</span>
                </div>

                {/* Items */}
                {open && (
                  <div style={{ padding:"4px 18px 16px" }}>
                    {entry.items.map((item, i) => {
                      const ic = ITEM_COLORS[item.type] || ITEM_COLORS.new;
                      return (
                        <div key={i} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:i<entry.items.length-1?`1px solid ${cs.border}`:undefined }}>
                          <span style={{ fontSize:12, fontWeight:700, color:ic.color, flexShrink:0, width:14, textAlign:"center" }}>{ic.icon}</span>
                          <code style={{ fontSize:12, color:cs.text, lineHeight:1.6 }}>{item.text}</code>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
