/**
 * Corvus — AI Reports Engine v1.0
 * Automated summaries · PDF executive reports
 * Manager insights · Department comparisons
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { geminiAnalysis, localFallbackAnalysis } from "./gemini.js";
import { getLocalAIStatus } from "./localAI.js";
import { featureTier, qualityFor } from "./lib/tierQuality.js";

// ── helpers ───────────────────────────────────────────────────────
const avg  = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
const sc   = v => v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";
const grade = (v, ar) => v >= 85 ? (ar ? "ممتاز" : "Excellent") : v >= 70 ? (ar ? "جيد" : "Good") : v >= 50 ? (ar ? "مقبول" : "Fair") : (ar ? "ضعيف" : "Poor");
const pct  = (a, b) => b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : "—";
const fmt  = d => { try { return new Date(d?.toDate?.() || d).toLocaleDateString(); } catch { return "—"; } };
// Escapes any string before it's interpolated into the report HTML
// (profile names, AI-generated text, session fields are all untrusted).
const escapeHtml = (str) => String(str ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

async function callGemini(prompt, system, maxTokens = 1200) {
  try {
    return await geminiAnalysis(prompt, { context: { system_prompt: system }, maxTokens });
  } catch (e) {
    if (getLocalAIStatus().ready) return await localFallbackAnalysis(prompt, { systemPrompt: system, maxTokens });
    throw e;
  }
}

function MdText({ text }) {
  const html = (text || "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/^### (.+)$/gm,   "<h4 style='margin:10px 0 4px;font-size:13px;font-weight:700;color:#e8f0fe'>$1</h4>")
    .replace(/^## (.+)$/gm,    "<h3 style='margin:14px 0 6px;font-size:15px;font-weight:800;color:#e8f0fe;font-family:Syne,sans-serif'>$1</h3>")
    .replace(/^- (.+)$/gm,     "<li style='margin:5px 0;line-height:1.6'>$1</li>")
    .replace(/(<li[\s\S]+?<\/li>)/g, "<ul style='padding-left:18px;margin:8px 0'>$1</ul>")
    .replace(/\n\n/g, "<br/><br/>").replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: 1.75 }} />;
}

// ── PDF generator (pure HTML → print) ────────────────────────────
// pdfDetail: "standard" (Professional tier — last 5 sessions, no extra
// stats) or "full" (Elite tier — last 10 sessions + footer detail note).
// Callers must check qualityFor(tier).pdfDetail !== "none" before calling
// this — "none" tiers (standard/basic) are gated out in exportPDF().
function buildPDFHTML({ reportTitle, profile, sessions, summaryText, lang, pdfDetail = "standard", tier = "standard" }) {
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
  const color    = avgScore >= 75 ? "#10b981" : avgScore >= 50 ? "#f59e0b" : "#ef4444";
  const now      = new Date().toLocaleDateString(isAr ? "ar-EG" : "en-US", { year:"numeric", month:"long", day:"numeric" });
  const safeName  = escapeHtml(profile?.name || (isAr ? "المستخدم" : "User"));
  const safeTitle = escapeHtml(reportTitle);
  const planLabel = escapeHtml(qualityFor(profile?.tier).label[isAr ? "ar" : "en"]);

  // ── Dynamic tier label (Fix: was hardcoded "Pro")
  const tierLabel = tier === "elite" ? "Elite" : tier === "professional" ? "Pro" : tier === "basic" ? "Basic" : "";
  const tierColor = tier === "elite" ? "#10b981" : "#0891b2";

  const safeSummaryHtml = escapeHtml(summaryText || "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");

  const rangeLabelEn = reportType === "weekly" ? "This Week's Sessions" : reportType === "monthly" ? "This Month's Sessions" : `Last ${rowLimit} Sessions`;
  const rangeLabelAr = reportType === "weekly" ? "جلسات هذا الأسبوع" : reportType === "monthly" ? "جلسات هذا الشهر" : `آخر ${rowLimit} جلسات`;

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
    <div class="kpi-value" style="color:#f59e0b">${profile?.streak_days || 0}</div>
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
        const dur = s.duration_min ? `${escapeHtml(String(s.duration_min))} ${isAr ? "د" : "min"}` : "—";
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
  const sorted = Object.entries(weeks).slice(-6).map(([wk, scores]) => ({ wk, avg: avg(scores), count: scores.length }));
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
export function AIReports({ profile, sessions = [], allUsers = [], cs, lang = "en", onClose }) {
  const [tab, setTab]           = useState("summary");
  const [aiText, setAiText]     = useState({});  // keyed by tab
  const [loading, setLoading]   = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
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
  const pdfDetail = qualityFor(profile?.tier).pdfDetail;
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

  const system = `You are Corvus's report generation engine. Generate professional, concise reports in ${isAr ? "Arabic" : "English"}.
Use markdown: ## for sections, - for bullets, **bold** for key data. Be data-driven, executive-ready. Max 300 words.`;

  const prompts = {
    summary: () => `Generate a weekly automated summary report for ${profile?.name || "User"}:
Data: avg score ${avgScore}/100, this week: ${weekAvg}/100, last week: ${lastWeekAvg}/100, trend: ${trendPct}, total sessions: ${sessions.length}, this week: ${thisWeek.length}

## Executive Summary
## Performance vs Last Week
## Top 3 Recommendations for Next Week`,

    manager: () => `Generate a manager insights report:
Employee: ${profile?.name || "User"} | Tier: ${profile?.tier || "professional"}
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

  const exportPDF = async () => {
    if (!canExportPdf) {
      setError(isAr
        ? "تصدير PDF متاح فقط لخطط Professional و Elite. قم بترقية خطتك."
        : "PDF export is only available on Professional and Elite plans. Please upgrade your plan.");
      return;
    }
    setPdfLoading(true);
    // Get or generate summary text for PDF
    let summary = aiText["summary"];
    if (!summary) {
      try { summary = await callGemini(prompts.summary(), system, 800); }
      catch { summary = "AI summary unavailable."; }
    }
    const html = buildPDFHTML({
      reportTitle: isAr ? `تقرير الأداء — ${profile?.name || ""}` : `Performance Report — ${profile?.name || "User"}`,
      profile, sessions: filteredSessions, summaryText: summary, lang, pdfDetail,
      tier: profile?.tier || "standard",
    });
    // Use Blob URL to avoid popup blockers (window.open("","_blank") is blocked
    // on most browsers unless triggered synchronously from a user gesture;
    // Blob URL + <a download> works reliably everywhere including iOS Safari).
    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const tab = window.open(blobUrl, "_blank");
      if (tab) {
        tab.onload = () => { tab.focus(); tab.print(); };
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      } else {
        // Popup blocked — trigger direct HTML download as fallback
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `Corvus_Report_${new Date().toISOString().slice(0,10)}.html`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      }
      setPdfLoading(false); setExported(true); setTimeout(() => setExported(false), 3000);
    } catch(e) { console.error("Export error:", e); setPdfLoading(false); }
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
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* PDF Export — gated by canExportPdf (standard/basic plans don't get PDF export) */}
              <button
                onClick={exportPDF}
                disabled={pdfLoading || !sessions.length || !canExportPdf}
                title={!canExportPdf ? (isAr ? "متاح من خطة Professional فأعلى" : "Available on Professional plan and above") : undefined}
                style={{ background: !canExportPdf ? "rgba(255,255,255,.05)" : exported ? "rgba(16,185,129,.15)" : "rgba(5,150,105,.15)", border: `1px solid ${!canExportPdf ? "rgba(255,255,255,.1)" : exported ? "rgba(16,185,129,.35)" : "rgba(5,150,105,.3)"}`, borderRadius: 9, padding: "7px 14px", fontSize: 11, fontWeight: 700, color: !canExportPdf ? "#6b82a6" : exported ? "#34d399" : "#34d399", cursor: pdfLoading || !sessions.length || !canExportPdf ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: !sessions.length ? 0.4 : 1, transition: "all 200ms" }}>
                {pdfLoading
                  ? <><span style={{ animation: "spin 700ms linear infinite", display: "inline-block" }}>⟳</span> {isAr ? "جارٍ..." : "Generating..."}</>
                  : exported
                  ? `✓ ${isAr ? "تم التصدير" : "Exported!"}`
                  : !canExportPdf
                  ? `🔒 ${isAr ? "تصدير PDF (Pro+)" : "Export PDF (Pro+)"}`
                  : `⬇ ${isAr ? "تصدير PDF" : "Export PDF"}`}
              </button>
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", color: "#6b82a6", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
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
                    { l: isAr ? "الخطة" : "Plan",           v: profile?.tier || "professional" },
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
