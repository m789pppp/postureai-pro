/**
 * Corvus — AI Reports Engine v1.0
 * Automated summaries · PDF executive reports
 * Manager insights · Department comparisons
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { geminiAnalysis, localFallbackAnalysis } from "./gemini.js";
import { getLocalAIStatus } from "./localAI.js";
import { featureTier, qualityFor } from "./lib/tierQuality.js";
import { exportPDFReport } from "./lib/pdfReports.js";

// ── helpers ───────────────────────────────────────────────────────
const avg  = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
const sc   = v => v >= 80 ? "#10b981" : v >= 60 ? "#f59e0b" : "#ef4444";
const grade = (v, ar) => v >= 80 ? (ar ? "ممتاز" : "Excellent") : v >= 60 ? (ar ? "جيد" : "Good") : (ar ? "يحتاج تحسين" : "Needs Improvement");
const pct  = (a, b) => b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : "—";
const fmt  = d => { try { return new Date(d?.toDate?.() || d).toLocaleDateString(); } catch { return "—"; } };
// Escapes any string before it's interpolated into the report HTML
// (profile names, AI-generated text, session fields are all untrusted).
const escapeHtml = (str) => String(str ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

async function callGemini(prompt, system, maxTokens = 1200) {
  try {
    return await geminiAnalysis(prompt, { systemPrompt: system, maxTokens });
  } catch (e) {
    if (getLocalAIStatus().ready) return await localFallbackAnalysis(prompt, { systemPrompt: system, maxTokens });
    throw e;
  }
}

function inlineR(t) {  return (t||"")    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e2e8f0;font-weight:600">$1</strong>')    .replace(/\*(.+?)\*/g, '<em style="color:#cbd5e1">$1</em>')    .replace(/`(.+?)`/g, '<code style="background:rgba(99,179,237,.13);padding:1px 6px;border-radius:4px;font-size:.9em;font-family:monospace">$1</code>');}function MdText({ text }) {  if (!text) return null;  const lns = text.split("\n");  const out = [];  let i = 0;  let fh2 = true;  while (i < lns.length) {    const l = lns[i].trim();    if (l.startsWith("## ")) {      const mt = fh2 ? "4px" : "22px"; fh2=false;      out.push('<div style="margin:' + mt + ' 0 10px;display:flex;align-items:center;gap:10px"><div style="width:3px;height:18px;background:linear-gradient(180deg,#3b82f6,#06b6d4);border-radius:99px;flex-shrink:0"></div><span style="font-size:14px;font-weight:700;color:#e2e8f0;letter-spacing:-.02em">' + inlineR(l.slice(3)) + '</span></div>');    } else if (l.startsWith("### ")) {      out.push('<div style="font-size:10.5px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 6px">' + inlineR(l.slice(4)) + '</div>');    } else if (/^[0-9]+\.\s/.test(l)) {      const m = l.match(/^([0-9]+)\.\s(.+)$/);      const num = m?m[1]:"1"; const rest = m?m[2]:l;      out.push('<div style="display:flex;gap:10px;margin:7px 0;align-items:flex-start"><span style="background:rgba(59,130,246,.15);color:#60a5fa;font-weight:700;font-size:11px;min-width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">' + num + '</span><span style="color:#cbd5e1;line-height:1.65;font-size:13px">' + inlineR(rest) + '</span></div>');    } else if (/^[-•*>]\s/.test(l)) {      out.push('<div style="display:flex;gap:10px;margin:5px 0;align-items:flex-start"><span style="color:#3b82f6;font-size:16px;line-height:1;flex-shrink:0;margin-top:1px">·</span><span style="color:#cbd5e1;line-height:1.65;font-size:13px">' + inlineR(l.slice(2)) + '</span></div>');    } else if (l.startsWith("|")) {      const tbl=[l]; while(i+1<lns.length&&lns[i+1].trim().startsWith("|")){i++;tbl.push(lns[i].trim());}      const rows=tbl.filter(r=>!/^[\s|:-]+$/.test(r));      if(rows.length>=2){        const hdrs=rows[0].split("|").filter((_,j,a)=>j>0&&j<a.length-1).map(h=>h.trim());        const drows=rows.slice(1);        const ths=hdrs.map(h=>'<th style="padding:8px 12px;text-align:left;background:rgba(59,130,246,.1);color:#60a5fa;font-weight:600;font-size:12px;border-bottom:1px solid rgba(59,130,246,.2)">'+inlineR(h)+'</th>').join('');        const tds=drows.map((row,ri)=>{const cells=row.split("|").filter((_,j,a)=>j>0&&j<a.length-1).map(c=>c.trim());return'<tr style="background:'+(ri%2===0?"rgba(255,255,255,.02)":"transparent")+'">'+cells.map(c=>'<td style="padding:7px 12px;border-bottom:1px solid rgba(255,255,255,.04);color:#94a3b8;font-size:12.5px">'+inlineR(c)+'</td>').join('')+'</tr>';}).join('');        out.push('<div style="margin:10px 0;border-radius:8px;overflow:hidden;border:1px solid rgba(59,130,246,.15)"><table style="width:100%;border-collapse:collapse"><thead><tr>'+ths+'</tr></thead><tbody>'+tds+'</tbody></table></div>');      }    } else if (l.startsWith("⚕️")||l.startsWith("⚠️")) {      out.push('<div style="background:rgba(239,68,68,.07);border:0.5px solid rgba(239,68,68,.2);border-radius:8px;padding:10px 14px;margin:10px 0;font-size:12.5px;color:#fca5a5;line-height:1.6">'+inlineR(l)+'</div>');    } else if (l==="") {      out.push('<div style="height:4px"></div>');    } else {      out.push('<p style="margin:3px 0 5px;line-height:1.7;color:#94a3b8;font-size:13px">'+inlineR(l)+'</p>');    }    i++;  }  return <div style={{fontFamily:"'DM Sans',system-ui,sans-serif",padding:"2px 0"}} dangerouslySetInnerHTML={{__html:out.join("")}}/>;}
// ── PDF generator (pure HTML → print) ────────────────────────────
// pdfDetail: "standard" (Professional tier — last 5 sessions, no extra
// stats) or "full" (Elite tier — last 10 sessions + footer detail note).
// Callers must check qualityFor(tier).pdfDetail !== "none" before calling
// this — "none" tiers (standard/basic) are gated out in exportPDF().
function buildPDFHTML({ reportTitle, profile, sessions, summaryText, lang, pdfDetail = "standard", tier = "standard", reportType = "all" }) {
  const isAr = lang === "ar";
  const isFull = pdfDetail === "full";
  const allScores = sessions.map(s => s.avg_score || 0).filter(Boolean);
  const avgScore  = avg(allScores);

  // ── Date-range filter (Fix: was always sessions.slice(0,N) regardless of report type)
  const now_ms = Date.now();
  const toMs   = s => s.created_at?.toDate?.()?.getTime?.() || new Date(s.created_at || 0).getTime();
  const rangeMs = reportType === "monthly" ? 30*86400000 : reportType === "weekly" ? 7*86400000 : null;
  const filteredSessions = rangeMs ? sessions.filter(s => now_ms - toMs(s) <= rangeMs) : sessions;
  const rowLimit   = isFull ? 10 : 5;
  const tableRows  = filteredSessions.slice(0, rowLimit);

  const thisWeek = sessions.filter(s => now_ms - toMs(s) <= 7*86400000);
  const weekAvg  = avg(thisWeek.map(s => s.avg_score || 0));
  const color    = avgScore >= 80 ? "#10b981" : avgScore >= 60 ? "#f59e0b" : "#ef4444";
  const now      = new Date().toLocaleDateString(isAr ? "ar-EG" : "en-US", { year:"numeric", month:"long", day:"numeric" });
  const _cleanName = (profile?.name || (isAr ? "المستخدم" : "User")).replace(/[\r\n]+/g,' ').replace(/\s{2,}/g,' ').trim();
  const safeName  = escapeHtml(_cleanName);
  const safeTitle = escapeHtml(reportTitle);
  const planLabel = escapeHtml(qualityFor(tier).label[isAr ? "ar" : "en"]);

  // ── Dynamic tier label (Fix: was hardcoded "Pro")
  const tierLabel = tier === "elite" ? "Elite" : tier === "professional" ? "Pro" : tier === "basic" ? "Basic" : "";
  const tierColor = tier === "elite" ? "#10b981" : "#0891b2";

  const safeSummaryHtml = (() => {
  let raw = summaryText || "";
  // Escape HTML first
  raw = escapeHtml(raw);
  // Then parse markdown (safe now since HTML entities are escaped)
  raw = raw
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h4 style='margin:10px 0 4px;font-size:13px;font-weight:700;color:#1a56db'>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3 style='margin:12px 0 6px;font-size:14px;font-weight:800;color:#1a56db'>$1</h3>")
    .replace(/^- (.+)$/gm, "<li style='margin:4px 0;line-height:1.6'>$1</li>")
    .replace(/(<li[\s\S]+?<\/li>)/g, "<ul style='padding-left:18px;margin:8px 0'>$1</ul>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
  return raw;
})();

  const rangeLabelEn = reportType === "weekly" ? "This Week's Sessions" : reportType === "monthly" ? "This Month's Sessions" : `Sessions (showing ${tableRows.length} of ${filteredSessions.length})`;
  const rangeLabelAr = reportType === "weekly" ? "جلسات هذا الأسبوع" : reportType === "monthly" ? "جلسات هذا الشهر" : `الجلسات (${tableRows.length} من ${filteredSessions.length})`;

  return `<!DOCTYPE html>
<html dir="${isAr ? "rtl" : "ltr"}" lang="${lang}">
<head>
<meta charset="UTF-8"/>
<title>${reportTitle}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&family=Cairo:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${isAr ? "'Cairo','DM Sans'" : "'DM Sans'"}, sans-serif; background:#fff; color:#0d1b35; padding:48px; font-size:13px; line-height:1.6; direction:${isAr?"rtl":"ltr"}; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1a56db; padding-bottom:24px; margin-bottom:32px; }
  .logo { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:#1a56db; }
  .logo span { color:${tierColor}; }
  .meta { text-align:${isAr?"left":"right"}; font-size:11px; color:#7890b0; }
  .meta strong { color:#334d6e; font-size:12px; }
  h1 { font-family:${isAr?"'Cairo'":"'Syne'"},sans-serif; font-size:26px; font-weight:800; color:#0d1b35; margin-bottom:6px; }
  h2 { font-family:${isAr?"'Cairo'":"'Syne'"},sans-serif; font-size:16px; font-weight:700; color:#0d1b35; margin:28px 0 12px; border-${isAr?"right":"left"}:3px solid #1a56db; padding-${isAr?"right":"left"}:12px; }
  .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin:24px 0; }
  .kpi { background:#f0f4fb; border-radius:12px; padding:16px; text-align:center; border-top:3px solid; }
  .kpi-label { font-size:9px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:#7890b0; margin-bottom:8px; }
  .kpi-value { font-family:'Syne',sans-serif; font-size:28px; font-weight:800; line-height:1; }
  .kpi-sub { font-size:10px; color:#7890b0; margin-top:5px; font-weight:500; }
  .ai-box { background:#f8faff; border:1px solid #dde5f5; border-radius:12px; padding:20px; margin:16px 0; }
  .ai-label { font-size:10px; font-weight:700; color:#1a56db; letter-spacing:.08em; text-transform:uppercase; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
  .session-table { width:100%; border-collapse:collapse; margin:12px 0; }
  .session-table th { background:#f0f4fb; padding:9px 14px; font-size:10px; font-weight:700; color:#7890b0; letter-spacing:.06em; text-transform:uppercase; text-align:${isAr?"right":"left"}; border-bottom:1px solid #dde5f5; }
  .session-table td { padding:10px 14px; font-size:12px; border-bottom:1px solid #f0f4fb; }
  .score-pill { display:inline-block; padding:3px 10px; border-radius:99px; font-size:10px; font-weight:700; }
  .footer { margin-top:48px; padding-top:16px; border-top:1px solid #dde5f5; display:flex; justify-content:space-between; font-size:10px; color:#7890b0; }
  @media print { body { padding:24px; } @page { margin:1cm; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">Corvus <span>${{elite:"Elite",professional:"Pro",standard:"",basic:""}[tier]||""}</span></div>
    <div style="font-size:11px;color:#7890b0;margin-top:4px;">${isAr ? "تقرير الأداء التنفيذي" : "Executive Performance Report"}</div>
  </div>
  <div class="meta">
    <strong>${safeName}</strong><br/>
    ${isAr ? "التاريخ:" : "Date:"} ${now}<br/>
    ${isAr ? "الخطة:" : "Plan:"} ${planLabel}<br/>
    ${isAr ? "إجمالي الجلسات:" : "Total sessions:"} ${sessions.length}
    ${filteredSessions.length !== sessions.length ? `<br/>${isAr?"الجلسات في النطاق:":"In range:"} ${filteredSessions.length}` : ""}
    ${rangeMs ? `<br/>${isAr?"نطاق التقرير:":"Range:"} ${reportType === "weekly" ? (isAr?"أسبوع":"1 week") : (isAr?"شهر":"1 month")} (${tableRows.length} ${isAr?"جلسة":"sessions"})` : ""}
  </div>
</div>

<h1>${safeTitle}</h1>

<div class="kpi-grid">
  <div class="kpi" style="border-color:${color}">
    <div class="kpi-label">${isAr ? "المتوسط الكلي" : "Avg Score"}</div>
    <div class="kpi-value" style="color:${color}">${avgScore}</div>
    <div class="kpi-sub">${grade(avgScore, isAr)}</div>
  </div>
  <div class="kpi" style="border-color:#1a56db">
    <div class="kpi-label">${isAr ? "الجلسات" : "Sessions"}</div>
    <div class="kpi-value" style="color:#1a56db">${sessions.length}</div>
    <div class="kpi-sub">${isAr ? "إجمالي" : "total"}</div>
  </div>
  <div class="kpi" style="border-color:#0891b2">
    <div class="kpi-label">${isAr ? "هذا الأسبوع" : "This Week"}</div>
    <div class="kpi-value" style="color:#0891b2">${weekAvg || "—"}</div>
    <div class="kpi-sub">${thisWeek.length} ${isAr ? "جلسة" : "sessions"}</div>
  </div>
  <div class="kpi" style="border-color:#f59e0b">
    <div class="kpi-label">${isAr ? "السلسلة" : "Streak"}</div>
    <div class="kpi-value" style="color:#f59e0b">${(() => { const dates = [...new Set(sessions.map(s => { try { const d = s.created_at?.toDate?.() || new Date(s.created_at || 0); return d.toISOString().slice(0,10); } catch { return null; } }).filter(Boolean))].sort(); if (dates.length < 2) return 0; let streak = 1; for (let i = dates.length - 2; i >= 0; i--) { const diff = (new Date(dates[i+1]) - new Date(dates[i])) / 86400000; if (diff <= 1.5) streak++; else break; } return streak; })()}</div>
    <div class="kpi-sub">${isAr ? "يوم" : "days"}</div>
  </div>
</div>

<h2>${isAr ? "🧠 التحليل الذكي — Corvus AI" : "🧠 AI Analysis — Corvus AI"}</h2>
<div class="ai-box">
  <div class="ai-label">🧠 Corvus Intelligence</div>
  <div style="font-size:13px;color:#334d6e;line-height:1.75;">${safeSummaryHtml}</div>
</div>

<h2>${isAr ? `📅 ${rangeLabelAr}` : `📅 ${rangeLabelEn}`}</h2>
<table class="session-table">
  <thead><tr>
    <th>#</th>
    <th>${isAr ? "التاريخ" : "Date"}</th>
    <th>${isAr ? "المدة" : "Duration"}</th>
    <th>${isAr ? "النتيجة" : "Score"}</th>
    <th>${isAr ? "التقييم" : "Grade"}</th>
  </tr></thead>
  <tbody>
    ${tableRows.length === 0
      ? `<tr><td colspan="5" style="text-align:center;color:#7890b0;padding:20px;">${isAr?"لا توجد جلسات في هذه الفترة":"No sessions in this date range"}</td></tr>`
      : tableRows.map((s, i) => {
        const scoreVal = s.avg_score || 0;
        const col = sc(scoreVal);
        const durSec = s.duration_s || s.duration_sec || s.duration_min * 60 || 0;
        const dur = durSec > 0 ? `${Math.floor(durSec/60)}:${String(Math.round(durSec%60)).padStart(2,'0')}` : "—";
        return `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(fmt(s.created_at))}</td>
          <td>${dur}</td>
          <td><span class="score-pill" style="background:${col}22;color:${col}">${scoreVal}/100</span></td>
          <td>${grade(scoreVal, isAr)}</td>
        </tr>`;
      }).join("")}
  </tbody>
</table>

<div class="footer">
  <span>Corvus${tierLabel ? " " + tierLabel : ""} — ${isAr ? "تقرير سري" : "Confidential Report"}${isFull ? (isAr ? " · تفصيل كامل (Elite)" : " · Full Detail (Elite)") : ""}</span>
  <span>${isAr ? "أُنشئ بواسطة Corvus AI" : "Generated by Corvus AI"} · ${now}</span>
</div>
</body>
</html>`;
}

// ── Department comparison chart ───────────────────────────────────
function DeptBar({ name, score, color, max = 100 }) {
  const w = Math.round((score / max) * 100);
  const c = sc(score);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "#b0c4de", fontWeight: 500, flex: 1, minWidth: 0 }}>{name}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: c, fontFamily: "Syne,sans-serif", flexShrink: 0, marginLeft: 12 }}>{score}/100</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: "rgba(148,163,184,.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: `linear-gradient(90deg,${c},${c}aa)`, borderRadius: 99, transition: "width 700ms cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}

// ── Weekly summary card ───────────────────────────────────────────
function WeekSummaryCard({ sessions, isAr }) {
  const weeks = {};
  sessions.forEach(s => {
    const d = s.created_at?.toDate?.() || new Date(s.created_at || 0);
    const wk = `${d.getFullYear()}-W${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)}`;
    if (!weeks[wk]) weeks[wk] = [];
    weeks[wk].push(s.avg_score || 0);
  });
  // weeks keys are inserted newest-first (sessions are newest-first) — take the
  // FIRST 6 (most recent), not the last 6 (which were the oldest weeks).
  const sorted = Object.entries(weeks).slice(0,6).map(([wk, scores]) => ({ wk, avg: avg(scores), count: scores.length }));
  return (
    <div>
      {sorted.reverse().map((w, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,.05)", animation: `fadeIn 300ms ${i * 60}ms both` }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(26,86,219,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#60a5fa", flexShrink: 0, fontFamily: "Syne,sans-serif" }}>{w.count}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#e8f0fe" }}>{w.wk}</div>
            <div style={{ fontSize: 10, color: "#6b82a6", marginTop: 2 }}>{w.count} {isAr ? "جلسة" : "sessions"}</div>
          </div>
          <div style={{ fontFamily: "Syne,sans-serif", fontSize: 18, fontWeight: 800, color: sc(w.avg) }}>{w.avg}/100</div>
        </div>
      ))}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────
function ReportSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[100, 90, 80, 70, 60].map((w, i) => (
        <div key={i} style={{ height: 13, borderRadius: 6, width: `${w}%`, background: "rgba(255,255,255,.06)", animation: `pulse 1.5s ${i * 80}ms infinite` }} />
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.9}}`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
export function AIReports({ profile, sessions = [], allUsers = [], cs, lang = "en", effectiveTier, onClose }) {
  const [tab, setTab]           = useState("summary");
  const [aiText, setAiText]     = useState({});  // keyed by tab
  const [loading, setLoading]   = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfType, setPdfType]   = useState("ai"); // "session"|"clinical"|"comparison"|"longitudinal"|"ai"
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [error, setError]       = useState("");
  const [exported, setExported] = useState(false);
  const [dateRange, setDateRange] = useState("week"); // "week" | "month" | "all"
  const isAr = lang === "ar";

  // ── Date range filter ─────────────────────────────────────────
  const _msAgo = (ms) => (ts) => {
    const d = ts?.toDate ? ts.toDate() : new Date(ts || 0);
    return Date.now() - d.getTime() < ms;
  };
  const filteredSessions = dateRange === "week"
    ? sessions.filter(s => _msAgo(7 * 86400000)(s.created_at))
    : dateRange === "month"
    ? sessions.filter(s => _msAgo(30 * 86400000)(s.created_at))
    : sessions;

  // Canonical tier gating — single source of truth is tierQuality.js.
  // standard/basic → pdfDetail "none" (no export); professional → "standard";
  // elite → "full". Keep in sync with backend/config/tier_quality.py.
  // effectiveTier accounts for trial (e.g. is_trial with trial_tier="elite") 
  const _tier = effectiveTier || profile?.tier || "standard";
  const pdfDetail = qualityFor(_tier).pdfDetail;
  const canExportPdf = pdfDetail !== "none";

  // Individual vs Company — same detection pattern used everywhere else.
  // Manager Insights and Department comparisons are company-only concepts —
  // an individual has no department or manager to compare against.
  const isCompany = profile?.user_type === "hr_admin"
    || profile?.user_type === "employee"
    || !!profile?.is_org_owner
    || !!profile?.company_id
    || profile?.acct_type === "company";

  const allScores  = sessions.map(s => s.avg_score || 0).filter(Boolean);
  const avgScore   = avg(allScores);
  const thisWeek   = sessions.filter(s => (Date.now() - (s.created_at?.toDate?.() || new Date(s.created_at || 0))) < 7 * 86400000);
  const lastWeek   = sessions.filter(s => { const ms = Date.now() - (s.created_at?.toDate?.() || new Date(s.created_at || 0)); return ms >= 7 * 86400000 && ms < 14 * 86400000; });
  const weekAvg    = avg(thisWeek.map(s => s.avg_score || 0));
  const lastWeekAvg = avg(lastWeek.map(s => s.avg_score || 0));
  const trendPct   = pct(weekAvg, lastWeekAvg);

  const _name = profile?.name?.split(" ")[0] || (isAr ? "المستخدم" : "Patient");
  const _scoreL = avgScore>=85?"Excellent":avgScore>=70?"Good":avgScore>=55?"Fair":"Needs Attention";
  const _wkL    = weekAvg>=85?"Excellent":weekAvg>=70?"Good":weekAvg>=55?"Fair":"Needs Attention";
  const cervAngle = avgScore<55?"35-50":avgScore<70?"20-35":avgScore<85?"10-20":"<10";
  const cervLoad  = avgScore<55?"18-27 kg":avgScore<70?"12-18 kg":avgScore<85?"6-12 kg":"4-6 kg";
  const discLoad  = avgScore<55?"185-220%":avgScore<70?"150-185%":"140-150%";

  const system = `You are Dr. Corvus — senior physiotherapist and occupational health specialist, 15 years MSK clinical experience.

PATIENT: ${_name} | Tier: ${_tier}
Score: ${avgScore}/100 (${_scoreL}) | This week: ${weekAvg}/100 | Last week: ${lastWeekAvg}/100
Trend: ${trendPct>0?"+":""}${trendPct}% | Sessions: ${sessions.length} total, ${thisWeek.length} this week, ${lastWeek.length} last week

CLINICAL INTERPRETATION FOR THIS REPORT:
Cervical loading (Hansraj 2014): Score ${avgScore}/100 → ~${cervAngle}° flexion → ~${cervLoad} load (neutral = 4.5 kg)
${avgScore<55?"C5-C7 facet joint chronic overload — disc dehydration risk elevated — URGENT":avgScore<70?"Approaching cumulative load threshold — preventive intervention indicated":avgScore<85?"Moderate load — ergonomic adjustment sufficient":"Within safe loading parameters"}

Disc pressure (Nachemson): ${discLoad} vs standing baseline
${avgScore<60?"⚠️ Sustained high disc pressure — annular breakdown risk":"Disc pressure manageable"}

Trend: ${trendPct>5?"Meaningful improvement — reinforce what changed":trendPct>0?"Marginal progress — consider protocol upgrade":trendPct<-5?"⚠️ Significant decline — immediate corrective action":trendPct<0?"Slight decline — early intervention recommended":"Plateau — progression protocol needed"}
Adherence: ${thisWeek.length}/week sessions ${thisWeek.length>=5?"(Excellent)":thisWeek.length>=3?"(Good)":thisWeek.length>=1?"(Below optimal — target 4-5/week)":"(None this week — re-engagement needed)"}
${trendPct<-5&&thisWeek.length>4?"⚠️ High frequency + declining score = overuse/fatigue pattern":""}

STANDARDS:
1. Every section must use ${_name}'s actual numbers — zero generic statements
2. Interventions must be PRECISE: exercise name, sets×reps, hold time, daily frequency, weeks to improvement
3. Clinical flow: identify issue → anatomical mechanism → specific intervention → expected outcome + timeline
4. ## for sections, **bold** key terms, numbered protocols — prefer bullets over tables
5. ⚕️ Flag anything requiring in-person physiotherapy
6. Start immediately — no preamble
${isAr?"LANGUAGE: Egyptian Arabic (عامية مصرية) — medical terms + simple explanation.":"LANGUAGE: Professional clinical English."}`;

  const prompts = {
    summary: () => `Generate a weekly clinical posture summary for ${_name}.

## Executive Summary — ${_name}
[2-3 sentences: interpret ${weekAvg}/100 this week vs ${lastWeekAvg}/100 last week (${trendPct > 0 ? "+" : ""}${trendPct}% trend). What does this mean clinically for MSK load?]

## Performance vs Last Week
[Specific comparison with clinical interpretation. Reference session count: ${thisWeek.length} this week vs last week.]

## Top 3 Clinical Priorities for Next Week
[3 numbered, specific, evidence-based interventions — not generic advice. Include WHY and TIMEFRAME for each.]`,

    manager: () => `Generate a manager insights report:
Patient: ${_name} | Tier: ${_tier}
Avg score: ${avgScore}/100 | This week: ${weekAvg}/100 | Sessions/week: ${thisWeek.length} | Total: ${sessions.length}
Trend: ${trendPct} week-over-week

## Employee Posture Health Assessment
## Risk Indicators (if any)
## Manager Recommendations
## Suggested Interventions`,

    department: () => `Generate a department health comparison report.
Available user data: ${allUsers.length} team members
Average team score: ${allUsers.length ? avg(allUsers.map(u => u.avg_score || 0)) : avgScore}/100
Top performer score: ${allUsers.length ? Math.max(...allUsers.map(u => u.avg_score || 0)) : avgScore}/100
This user score: ${avgScore}/100

## Department Health Overview
## High-Risk Areas
## Department Recommendations
## Recognition & Improvement Plan`,
  };

  const loadReport = useCallback(async (key) => {
    if (aiText[key]) return; // cached
    if (!sessions.length && key !== "department") return;
    setLoading(true); setError("");
    try {
      const text = await callGemini(prompts[key]?.() || "", system, 1200);
      setAiText(prev => ({ ...prev, [key]: text }));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [sessions, avgScore, weekAvg, allUsers, lang]);

  useEffect(() => { loadReport(tab); }, [tab]);

  // PDF type definitions — longitudinal gated to Elite only
  const PDF_TYPES = [
    { id: "ai",           icon: "🧠", en: "AI Executive",    ar: "تقرير AI",        elite: false },
    { id: "session",      icon: "📋", en: "Session Report",  ar: "تقرير جلسة",      elite: false },
    { id: "clinical",     icon: "⚕️",  en: "Clinical",        ar: "سريري",           elite: false },
    { id: "comparison",   icon: "📊", en: "Comparison",      ar: "مقارنة",          elite: false },
    { id: "longitudinal", icon: "📈", en: "Longitudinal",    ar: "اتجاه طويل",      elite: true  },
  ];

  const exportPDF = async (type = pdfType) => {
    if (!canExportPdf) {
      setError(isAr
        ? "تصدير PDF متاح فقط لخطط Professional و Elite. قم بترقية خطتك."
        : "PDF export is only available on Professional and Elite plans. Please upgrade your plan.");
      return;
    }
    // Longitudinal is Elite-only
    if (type === "longitudinal" && pdfDetail !== "full") {
      setError(isAr ? "تقرير الاتجاه الطويل متاح فقط لخطة Elite." : "Longitudinal report is available on Elite plan only.");
      return;
    }
    setShowPdfMenu(false);
    setPdfLoading(true);
    // Get or generate AI summary
    let summary = aiText["summary"];
    if (!summary) {
      try { summary = await callGemini(prompts.summary(), system, 800); }
      catch { summary = "AI summary unavailable."; }
    }
    try {
      await exportPDFReport({
        type,
        sessions: type === "longitudinal" ? sessions : filteredSessions,
        session: filteredSessions[0] || sessions[0],
        profile: { ...profile, tier: _tier },
        aiSummary: summary,
        lang,
      });
      setExported(true); setTimeout(() => setExported(false), 3000);
    } catch(e) {
      console.error("PDF export error:", e);
      setError(isAr ? "فشل تصدير PDF — " + e.message : "PDF export failed — " + e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const TABS = [
    { id: "summary",    icon: "📋", en: "Weekly Summary",    ar: "ملخص أسبوعي" },
    // Manager Insights and Department comparison are company-only — an
    // individual has no manager or department to be compared against.
    ...(isCompany ? [
      { id: "manager",    icon: "👔", en: "Manager Insights",  ar: "تقرير المدير" },
      { id: "department", icon: "🏢", en: "Department",        ar: "المقارنة" },
    ] : []),
  ];

  // Mock dept data if no allUsers
  const deptData = allUsers.length > 0
    ? allUsers.slice(0, 6).map(u => ({ name: u.name || u.email?.split("@")[0] || "User", score: u.avg_score || 0 }))
    : [
        { name: isAr ? "فريق التطوير" : "Engineering",  score: 74 },
        { name: isAr ? "فريق التسويق" : "Marketing",    score: 61 },
        { name: isAr ? "فريق العمليات" : "Operations",  score: 68 },
        { name: isAr ? "أنت" : "You",                   score: avgScore },
      ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,8,20,.9)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0c1528", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, width: "min(680px,96vw)", height: "min(760px,95vh)", display: "flex", flexDirection: "column", overflow: "hidden", direction: isAr ? "rtl" : "ltr", boxShadow: "0 24px 80px rgba(0,0,0,.6)", animation: "slideUp 350ms cubic-bezier(0.16,1,0.3,1) both" }}>

        {/* ── Header ── */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#059669,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "0 4px 16px rgba(5,150,105,.3)" }}>📊</div>
              <div>
                <div style={{ fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 800, color: "#e8f0fe", letterSpacing: "-0.02em" }}>
                  {isAr ? "تقارير الذكاء الاصطناعي" : "AI Reports Engine"}
                </div>
                <div style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>
                  {isCompany
                    ? (isAr ? "تقارير تلقائية · PDF تنفيذي · مقارنة أقسام" : "Automated summaries · Executive PDF · Dept comparisons")
                    : (isAr ? "تقارير تلقائية · ملخص أسبوعي شخصي" : "Automated summaries · Personal weekly wrap-up")}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
              {/* PDF Export dropdown */}
              {canExportPdf ? (
                <div
                  style={{ position: "relative" }}
                  tabIndex={-1}
                  onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setShowPdfMenu(false); }}
                >
                  <div style={{ display: "flex", border: "1px solid rgba(5,150,105,.3)", borderRadius: 9, overflow: "hidden" }}>
                    {/* Main export button */}
                    <button
                      onClick={() => exportPDF(pdfType)}
                      disabled={pdfLoading || !sessions.length}
                      style={{ background: exported ? "rgba(16,185,129,.15)" : "rgba(5,150,105,.12)", padding: "7px 12px", fontSize: 11, fontWeight: 700, color: "#34d399", cursor: pdfLoading || !sessions.length ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, border: "none", opacity: !sessions.length ? 0.4 : 1, transition: "all 200ms" }}>
                      {pdfLoading
                        ? <><span style={{ display:"inline-block", animation:"spin 700ms linear infinite" }}>⟳</span> {isAr ? "جارٍ..." : "Generating..."}</>
                        : exported
                        ? `✓ ${isAr ? "تم!" : "Done!"}`
                        : <>⬇ {PDF_TYPES.find(p => p.id === pdfType)?.icon || "📄"} {isAr ? "تصدير PDF" : "Export PDF"}</>}
                    </button>
                    {/* Dropdown toggle */}
                    <button
                      onClick={() => setShowPdfMenu(v => !v)}
                      style={{ background: showPdfMenu ? "rgba(5,150,105,.2)" : "rgba(5,150,105,.08)", borderLeft: "1px solid rgba(5,150,105,.2)", padding: "7px 10px", fontSize: 10, color: "#34d399", cursor: "pointer", border: "none", transition: "all 200ms", minWidth: 28 }}>
                      {showPdfMenu ? "▲" : "▼"}
                    </button>
                  </div>
                  {/* Dropdown menu */}
                  {showPdfMenu && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#0a1020", border: "1px solid rgba(26,86,219,.25)", borderRadius: 10, overflow: "hidden", zIndex: 9999, width: 210, boxShadow: "0 16px 48px rgba(0,0,0,.7)" }}>
                      <div style={{ padding: "8px 12px 6px", fontSize: 9, fontWeight: 700, color: "#4a6090", letterSpacing: ".1em", textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,.06)", background: "#060e1e" }}>
                        {isAr ? "نوع التقرير" : "Select Report Type"}
                      </div>
                      {PDF_TYPES.map(pt => {
                        const locked = pt.elite && pdfDetail !== "full";
                        const active = pdfType === pt.id;
                        return (
                          <button key={pt.id}
                            onClick={() => {
                              if (locked) return;
                              setPdfType(pt.id);
                              setShowPdfMenu(false);
                              exportPDF(pt.id);
                            }}
                            style={{
                              width: "100%", display: "flex", alignItems: "center", gap: 10,
                              padding: "10px 14px",
                              background: active ? "rgba(26,86,219,.15)" : locked ? "rgba(255,255,255,.01)" : "transparent",
                              border: "none",
                              color: locked ? "#2d3e5a" : active ? "#60a5fa" : "#94b4d8",
                              cursor: locked ? "not-allowed" : "pointer",
                              fontSize: 11.5, fontWeight: active ? 700 : 500,
                              textAlign: "left",
                              borderBottom: "1px solid rgba(255,255,255,.04)",
                              transition: "background 120ms",
                            }}>
                            <span style={{ fontSize: 14, opacity: locked ? 0.3 : 1 }}>{pt.icon}</span>
                            <span style={{ flex: 1 }}>{isAr ? pt.ar : pt.en}</span>
                            {locked
                              ? <span style={{ fontSize: 8, color: "#10b981", background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.15)", borderRadius: 99, padding: "2px 7px", fontWeight: 700 }}>ELITE</span>
                              : active
                              ? <span style={{ fontSize: 9, color: "#34d399" }}>✓</span>
                              : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  disabled
                  style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 9, padding: "7px 14px", fontSize: 11, fontWeight: 700, color: "#3a4a66", cursor: "not-allowed", display: "flex", alignItems: "center", gap: 6 }}>
                  🔒 {isAr ? "تصدير PDF (Pro+)" : "Export PDF (Pro+)"}
                </button>
              )}
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", color: "#6b82a6", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Close">✕</button>
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {[
              { l: isAr ? "المتوسط" : "Avg",       v: `${avgScore}/100`,     c: sc(avgScore) },
              { l: isAr ? "هذا الأسبوع" : "Week",   v: weekAvg ? `${weekAvg}/100` : "—", c: sc(weekAvg) },
              { l: isAr ? "الاتجاه" : "Trend",      v: trendPct,             c: trendPct.startsWith("+") ? "#10b981" : "#ef4444" },
              { l: isAr ? "الجلسات" : "Sessions",   v: sessions.length,      c: "#60a5fa" },
            ].map((m, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, padding: "6px 12px" }}>
                <div style={{ fontSize: 9, color: "#6b82a6", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{m.l}</div>
                <div style={{ fontFamily: "Syne,sans-serif", fontSize: 14, fontWeight: 800, color: m.c, lineHeight: 1.2 }}>{m.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Date Range Selector ── */}
        <div style={{ display:"flex", gap:6, padding:"8px 16px", borderBottom:"1px solid rgba(255,255,255,.07)", flexShrink:0, alignItems:"center" }}>
          <span style={{ fontSize:10, color:"#6b82a6", fontWeight:600, marginRight:4 }}>{isAr?"الفترة:":"Range:"}</span>
          {[["week",isAr?"آخر 7 أيام":"Last 7 days"],["month",isAr?"آخر 30 يوم":"Last 30 days"],["all",isAr?"كل الجلسات":"All sessions"]].map(([r,l])=>(
            <button key={r} onClick={()=>setDateRange(r)} style={{
              fontSize:10, fontWeight:700, padding:"4px 10px", borderRadius:6, cursor:"pointer",
              background: dateRange===r?"rgba(5,150,105,.18)":"rgba(255,255,255,.04)",
              border: `1px solid ${dateRange===r?"#059669":"rgba(255,255,255,.08)"}`,
              color: dateRange===r?"#34d399":"#6b82a6",
            }}>{l}{dateRange===r&&<span style={{marginLeft:4,opacity:.7}}>({filteredSessions.length})</span>}</button>
          ))}
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "12px 8px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? "#059669" : "transparent"}`, color: tab === t.id ? "#34d399" : "#6b82a6", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "color 150ms" }}>
              <span style={{ fontSize: 17 }}>{t.icon}</span>
              <span>{isAr ? t.ar : t.en}</span>
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {filteredSessions.length === 0 && tab !== "department" && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <div style={{ fontFamily: "Syne,sans-serif", fontSize: 18, fontWeight: 800, color: "#e8f0fe", marginBottom: 8 }}>
                {isAr ? "لا توجد جلسات بعد" : "No sessions yet"}
              </div>
              <div style={{ fontSize: 13, color: "#6b82a6", lineHeight: 1.7 }}>
                {isAr ? "ابدأ جلساتك لتوليد التقارير التلقائية" : "Start your sessions to generate automated reports"}
              </div>
            </div>
          )}

          {/* ── Weekly Summary ── */}
          {tab === "summary" && filteredSessions.length > 0 && (
            <div>
              <div style={{ background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ fontFamily: "Syne,sans-serif", fontSize: 13, fontWeight: 800, color: "#e8f0fe", marginBottom: 14 }}>
                  {isAr ? "ملخص الأسابيع الأخيرة" : "Recent Weeks Summary"}
                </div>
                <WeekSummaryCard sessions={filteredSessions} isAr={isAr} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { icon: "📅", l: isAr ? "هذا الأسبوع" : "This Week",    v: weekAvg ? `${weekAvg}/100` : "—",    c: sc(weekAvg), sub: `${thisWeek.length} sessions` },
                  { icon: "📈", l: isAr ? "الأسبوع الماضي" : "Last Week",  v: lastWeekAvg ? `${lastWeekAvg}/100` : "—", c: sc(lastWeekAvg), sub: `${lastWeek.length} sessions` },
                  { icon: "📊", l: isAr ? "الاتجاه" : "Trend",            v: trendPct,  c: trendPct.startsWith("+") ? "#10b981" : trendPct === "—" ? "#6b82a6" : "#ef4444", sub: "week-over-week" },
                ].map((m, i) => (
                  <div key={i} style={{ background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "12px 14px", animation: `fadeIn 300ms ${i*70}ms both` }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#6b82a6", marginBottom: 6 }}>{m.l}</div>
                    <div style={{ fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, color: m.c, lineHeight: 1 }}>{m.v}</div>
                    <div style={{ fontSize: 9, color: "#6b82a6", marginTop: 4 }}>{m.sub}</div>
                  </div>
                ))}
              </div>

              <AIReportBlock loading={loading} data={aiText["summary"]} error={error} onRetry={() => { setAiText(p => ({ ...p, summary: "" })); loadReport("summary"); }} isAr={isAr} label={isAr ? "الملخص التلقائي" : "Automated Summary"} />
            </div>
          )}

          {/* ── Manager Insights — company only ── */}
          {tab === "manager" && isCompany && filteredSessions.length > 0 && (
            <div>
              <div style={{ background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ fontFamily: "Syne,sans-serif", fontSize: 13, fontWeight: 800, color: "#e8f0fe", marginBottom: 12 }}>
                  {isAr ? "بطاقة الموظف" : "Employee Card"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { l: isAr ? "الاسم" : "Name",          v: profile?.name || "—" },
                    { l: isAr ? "الخطة" : "Plan",           v: _tier },
                    { l: isAr ? "إجمالي الجلسات" : "Total", v: sessions.length },
                    { l: isAr ? "آخر جلسة" : "Last Session", v: sessions[0] ? fmt(sessions[0].created_at) : "—" },
                    { l: isAr ? "المعدل الكلي" : "Avg Score", v: `${avgScore}/100` },
                    { l: isAr ? "الاتجاه" : "Trend",         v: trendPct },
                  ].map((m, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                      <span style={{ fontSize: 11, color: "#6b82a6", fontWeight: 500 }}>{m.l}</span>
                      <span style={{ fontSize: 12, color: "#e8f0fe", fontWeight: 700 }}>{m.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <AIReportBlock loading={loading} data={aiText["manager"]} error={error} onRetry={() => { setAiText(p => ({ ...p, manager: "" })); loadReport("manager"); }} isAr={isAr} label={isAr ? "رؤى المدير" : "Manager Insights"} />
            </div>
          )}

          {/* ── Department Comparison — company only ── */}
          {tab === "department" && isCompany && (
            <div>
              <div style={{ background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontFamily: "Syne,sans-serif", fontSize: 13, fontWeight: 800, color: "#e8f0fe" }}>
                    {isAr ? "مقارنة الأداء" : "Performance Comparison"}
                  </div>
                  <div style={{ background: "rgba(5,150,105,.12)", border: "1px solid rgba(5,150,105,.22)", borderRadius: 99, padding: "3px 10px", fontSize: 9, fontWeight: 700, color: "#34d399", textTransform: "uppercase" }}>
                    {deptData.length} {isAr ? "عضو" : "members"}
                  </div>
                </div>
                {deptData.sort((a, b) => b.score - a.score).map((d, i) => (
                  <DeptBar key={i} name={d.name} score={d.score} />
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { l: isAr ? "متوسط الفريق" : "Team Avg",   v: `${avg(deptData.map(d => d.score))}/100`, c: sc(avg(deptData.map(d => d.score))) },
                  { l: isAr ? "الأفضل" : "Top Score",         v: `${Math.max(...deptData.map(d => d.score))}/100`, c: "#10b981" },
                  { l: isAr ? "أنت" : "Your Rank",            v: `#${deptData.sort((a, b) => b.score - a.score).findIndex(d => d.score === avgScore || d.name === (isAr ? "أنت" : "You")) + 1 || "—"}`, c: "#60a5fa" },
                ].map((m, i) => (
                  <div key={i} style={{ background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#6b82a6", marginBottom: 6 }}>{m.l}</div>
                    <div style={{ fontFamily: "Syne,sans-serif", fontSize: 22, fontWeight: 800, color: m.c }}>{m.v}</div>
                  </div>
                ))}
              </div>

              <AIReportBlock loading={loading} data={aiText["department"]} error={error} onRetry={() => { setAiText(p => ({ ...p, department: "" })); loadReport("department"); }} isAr={isAr} label={isAr ? "تقرير المقارنة" : "Department Report"} />
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

function AIReportBlock({ loading, data, error, onRetry, isAr, label }) {
  return (
    <div style={{ background: "rgba(5,150,105,.05)", border: "1px solid rgba(5,150,105,.15)", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg,#059669,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>📊</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {label}
        </span>
        {loading && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
            {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#059669", display: "inline-block", animation: `blink 1.2s ${i*.2}s infinite` }} />)}
            <style>{`@keyframes blink{0%,80%,100%{opacity:.3}40%{opacity:1}}`}</style>
          </span>
        )}
      </div>
      {loading && <ReportSkeleton />}
      {!loading && data && (
        <div style={{ fontSize: 13, color: "#b0c4de", lineHeight: 1.75, animation: "fadeIn 300ms both" }}>
          <MdText text={data} />
        </div>
      )}
      {!loading && error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#f87171" }}>⚠ {error}</span>
          <button onClick={onRetry} style={{ background: "rgba(5,150,105,.15)", border: "1px solid rgba(5,150,105,.3)", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#34d399", cursor: "pointer" }}>
            {isAr ? "⟳ أعد" : "⟳ Retry"}
          </button>
        </div>
      )}
      {!loading && !data && !error && (
        <div style={{ fontSize: 12, color: "#6b82a6", fontStyle: "italic" }}>
          {isAr ? "جارٍ توليد التقرير..." : "Generating report..."}
        </div>
      )}
    </div>
  );
}
