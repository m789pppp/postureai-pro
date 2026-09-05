/**
 * Corvus — AI Reports Engine v1.0
 * Automated summaries · PDF executive reports
 * Manager insights · Department comparisons
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  cervicalLoadKg, neckFlexionDeg, sessionFatigue,
  weekWindows, lifetimeSessions, readingReliability,
} from "./lib/clinicalMetrics.js";
import { geminiAnalysis, localFallbackAnalysis } from "./gemini.js";
import { getLocalAIStatus } from "./localAI.js";
import { featureTier, qualityFor } from "./lib/tierQuality.js";
import { exportPDFReport } from "./lib/pdfReports.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";
import { weekKey } from "./lib/exercisePlanLib.js";

// ── helpers ───────────────────────────────────────────────────────
const avg  = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
const sc   = v => v == null ? "#6b82a6" : v >= 80 ? "#10b981" : v >= 60 ? "#f59e0b" : "#ef4444";
const grade = (v, ar) => v >= 80 ? (ar ? "ممتاز" : "Excellent") : v >= 60 ? (ar ? "جيد" : "Good") : (ar ? "يحتاج تحسين" : "Needs Improvement");
const pct  = (a, b) => (a == null || b == null || !b) ? "—" : `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%`;
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

function linkifyR(t) { return t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/g, (m, mdText, mdUrl, bareUrl) => { if (mdUrl) return '<a href="' + mdUrl + '" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline">' + mdText + '</a>'; let url = bareUrl, trail = ""; const tm = url.match(/([.,;:!?)]+)$/); if (tm) { trail = tm[1]; url = url.slice(0, -trail.length); } return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline">' + url + '</a>' + trail; }); }
function inlineR(t) {  return linkifyR((t||"")    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"))    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e2e8f0;font-weight:600">$1</strong>')    .replace(/\*(.+?)\*/g, '<em style="color:#cbd5e1">$1</em>')    .replace(/`(.+?)`/g, '<code style="background:rgba(99,179,237,.13);padding:1px 6px;border-radius:4px;font-size:.9em;font-family:monospace">$1</code>');}function MdText({ text }) {  if (!text) return null;  const lns = text.split("\n");  const out = [];  let i = 0;  let fh2 = true;  while (i < lns.length) {    const l = lns[i].trim();    if (l.startsWith("## ")) {      const mt = fh2 ? "4px" : "22px"; fh2=false;      out.push('<div style="margin:' + mt + ' 0 10px;display:flex;align-items:center;gap:10px"><div style="width:3px;height:18px;background:linear-gradient(180deg,#3b82f6,#06b6d4);border-radius:99px;flex-shrink:0"></div><span style="font-size:14px;font-weight:700;color:#e2e8f0;letter-spacing:-.02em">' + inlineR(l.slice(3)) + '</span></div>');    } else if (l.startsWith("### ")) {      out.push('<div style="font-size:10.5px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 6px">' + inlineR(l.slice(4)) + '</div>');    } else if (/^[0-9]+\.\s/.test(l)) {      const m = l.match(/^([0-9]+)\.\s(.+)$/);      const num = m?m[1]:"1"; const rest = m?m[2]:l;      out.push('<div style="display:flex;gap:10px;margin:7px 0;align-items:flex-start"><span style="background:rgba(59,130,246,.15);color:#60a5fa;font-weight:700;font-size:11px;min-width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">' + num + '</span><span style="color:#cbd5e1;line-height:1.65;font-size:13px">' + inlineR(rest) + '</span></div>');    } else if (/^[-•*>]\s/.test(l)) {      out.push('<div style="display:flex;gap:10px;margin:5px 0;align-items:flex-start"><span style="color:#3b82f6;font-size:16px;line-height:1;flex-shrink:0;margin-top:1px">·</span><span style="color:#cbd5e1;line-height:1.65;font-size:13px">' + inlineR(l.slice(2)) + '</span></div>');    } else if (l.startsWith("|")) {      const tbl=[l]; while(i+1<lns.length&&lns[i+1].trim().startsWith("|")){i++;tbl.push(lns[i].trim());}      const rows=tbl.filter(r=>!/^[\s|:-]+$/.test(r));      if(rows.length>=2){        const hdrs=rows[0].split("|").filter((_,j,a)=>j>0&&j<a.length-1).map(h=>h.trim());        const drows=rows.slice(1);        const ths=hdrs.map(h=>'<th style="padding:8px 12px;text-align:left;background:rgba(59,130,246,.1);color:#60a5fa;font-weight:600;font-size:12px;border-bottom:1px solid rgba(59,130,246,.2)">'+inlineR(h)+'</th>').join('');        const tds=drows.map((row,ri)=>{const cells=row.split("|").filter((_,j,a)=>j>0&&j<a.length-1).map(c=>c.trim());return'<tr style="background:'+(ri%2===0?"rgba(255,255,255,.02)":"transparent")+'">'+cells.map(c=>'<td style="padding:7px 12px;border-bottom:1px solid rgba(255,255,255,.04);color:#94a3b8;font-size:12.5px">'+inlineR(c)+'</td>').join('')+'</tr>';}).join('');        out.push('<div style="margin:10px 0;border-radius:8px;overflow:hidden;border:1px solid rgba(59,130,246,.15)"><table style="width:100%;border-collapse:collapse"><thead><tr>'+ths+'</tr></thead><tbody>'+tds+'</tbody></table></div>');      }    } else if (l.startsWith("⚕️")||l.startsWith("⚠️")) {      out.push('<div style="background:rgba(239,68,68,.07);border:0.5px solid rgba(239,68,68,.2);border-radius:8px;padding:10px 14px;margin:10px 0;font-size:12.5px;color:#fca5a5;line-height:1.6">'+inlineR(l)+'</div>');    } else if (l==="") {      out.push('<div style="height:4px"></div>');    } else {      out.push('<p style="margin:3px 0 5px;line-height:1.7;color:#94a3b8;font-size:13px">'+inlineR(l)+'</p>');    }    i++;  }  return <div style={{fontFamily:"'IBM Plex Sans Arabic','DM Sans',system-ui,sans-serif",padding:"2px 0"}} dangerouslySetInnerHTML={{__html:out.join("")}}/>;}
// ── PDF generator (pure HTML → print) ────────────────────────────
// pdfDetail: "standard" (Professional tier — last 5 sessions, no extra
// stats) or "full" (Elite tier — last 10 sessions + footer detail note).
// Callers must check qualityFor(tier).pdfDetail !== "none" before calling
// this — "none" tiers (standard/basic) are gated out in exportPDF().
// buildPDFHTML() lived here — 166 lines, no call site anywhere in the repo.
// exportPDF() below uses exportPDFReport() from lib/pdfReports.js instead.
// It was deleted rather than left in place: it computed its headline KPIs
// over ALL sessions while its header said "This Week's Sessions", and it
// still used the raw-tier string map that the comment block inside it
// claimed had been replaced by featureTier() — so it would have shipped a
// blank plan badge for b2b_enterprise. Two divergent PDF builders in one
// file, one of them unreachable, is a trap for whoever wires it up next.


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
    // Was year + week-of-month only (no month component) — sessions from
    // different months whose day-of-month fell in the same 0-6/7-13/etc
    // range collided into one bucket (e.g. Feb 3 and Apr 4, 2026 both
    // produced "2026-W1"). Use a real ISO week key instead (same helper
    // exercisePlanLib.js already uses for this).
    const wk = weekKey(d);
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
export function AIReports({ profile, sessions = [], allUsers = [], cs, lang = "en", effectiveTier, onClose, uid }) {
  useBodyScrollLock();
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
  // avg([]) is 0, so a week with no sessions was passed to the clinical LLM as
  // a literal "Last week: 0/100" — a user who took a week off was described to
  // a senior-physiotherapist persona as having scored zero out of a hundred,
  // and that produced "Trend: -100%" in alarm red plus the report's decline and
  // overuse language. The UI tiles already rendered an honest em-dash; only the
  // prompt asserted the zero.
  const _wk        = weekWindows(sessions);
  // Counts come from the same windows as the averages, so the two can never
  // disagree about which sessions are in a week.
  const thisWeek   = { length: _wk.thisWeek.n };
  const lastWeek   = { length: _wk.lastWeek.n };
  const weekAvg    = _wk.thisWeek.avg;      // null when no sessions this week
  const lastWeekAvg = _wk.lastWeek.avg;     // null when none last week
  const trendPct   = pct(weekAvg, lastWeekAvg);
  const lifetime   = lifetimeSessions(profile, sessions);
  const reliability = readingReliability(sessions);
  const _fatigue   = sessionFatigue(sessions);
  // pct() returns a display-formatted STRING like "+20%"/"-15%"/"—" (used
  // correctly below at trendPct.startsWith("+") for the UI trend chips).
  // The clinical-narrative interpretation further down was comparing that
  // string against numbers (trendPct>5, trendPct<-5, …) — Number("+20%")
  // is NaN, so every one of those comparisons was always false, which
  // silently collapsed every trend interpretation to "Plateau" and meant
  // the "declining score = overuse/fatigue" safety flag could never fire.
  // Use a real number for those comparisons instead.
  // null, not 0, when either week is missing: "no comparison possible" rather
  // than "measured, unchanged". Every consumer below now checks for null.
  const trendPctNum = _wk.trendPct;

  const _name = profile?.name?.split(" ")[0] || (isAr ? "المستخدم" : "Patient");
  const _scoreL = avgScore>=85?"Excellent":avgScore>=70?"Good":avgScore>=55?"Fair":"Needs Attention";
  const _wkL    = weekAvg==null?"no sessions":weekAvg>=85?"Excellent":weekAvg>=70?"Good":weekAvg>=55?"Fair":"Needs Attention";

  // MEASURED cervical load, from the engine's own Hansraj (2014) implementation
  // against real forward-head displacement.
  //
  // What was here:
  //   cervAngle = avgScore<55 ? "35-50"    : ...
  //   cervLoad  = avgScore<55 ? "18-27 kg" : ...
  //   discLoad  = avgScore<55 ? "185-220%" : ...
  // Three hardcoded lookup tables keyed on the composite score, rendered into
  // the prompt as "Cervical loading (Hansraj 2014)" and "Disc pressure
  // (Nachemson)" — real citations wrapped around numbers that were not
  // measurements. Hansraj maps a MEASURED flexion angle to load; avgScore is a
  // weighted blend of thirteen metrics including elbow angle, monitor height
  // and screen distance, so a user with a perfect neck and a bad desk was
  // reported at "20-35° flexion, 12-18 kg". Nachemson's figures are per posture,
  // not a function of any score — and `discLoad` had no branch above 85, so a
  // user scoring 100/100 was still told their disc pressure was 140-150% of
  // standing. The report could never say it was normal.
  //
  // These reports become PDFs that go to doctors.
  const cervLoad  = cervicalLoadKg(sessions);
  const cervAngle = neckFlexionDeg(sessions);

  const system = `You are Dr. Corvus — senior physiotherapist and occupational health specialist, 15 years MSK clinical experience.

PATIENT: ${_name} | Tier: ${_tier}
Score: ${avgScore}/100 (${_scoreL}) | This week: ${weekAvg==null?`no sessions (${thisWeek.length} recorded) — do NOT report this as 0/100`:`${weekAvg}/100`} | Last week: ${lastWeekAvg==null?"no sessions — do NOT report this as 0/100":`${lastWeekAvg}/100`}
Trend: ${trendPct} | Sessions: ${lifetime.count}${lifetime.exact?"":"+ (query truncated)"} total, ${thisWeek.length} this week, ${lastWeek.length} last week
${reliability!=null?`Reading reliability: ${reliability.pct}% of recent metric readings were reliable`:""}

CLINICAL INTERPRETATION FOR THIS REPORT:
${cervLoad==null
  ? "Cervical load: NOT MEASURED for this patient. Do not estimate a flexion angle, quote a kilogram figure, cite Hansraj against this patient, or name a spinal level — say the measurement is unavailable and why (head or shoulders out of frame)."
  : `Cervical loading, MEASURED (Hansraj 2014 applied to measured forward-head displacement): ~${cervLoad} kg above the 4.5 kg neutral${cervAngle!=null?` at ~${cervAngle}° flexion`:""}. Use this figure; do not re-derive one from the posture score.
${cervLoad>=15?"Sustained loading at this magnitude warrants clinical assessment.":cervLoad>=8?"Elevated loading — ergonomic correction indicated.":"Within a manageable loading range."}`}

Disc pressure: NOT MEASURED. This product observes posture from a webcam and does not measure intradiscal pressure — do not quote a disc-pressure percentage for this patient.

${_fatigue
  ? `Within-session posture decline: ${_fatigue.declinePoints} pts from the first third of a session to the last, across ${_fatigue.from} sessions. This is the only fatigue signal available; there is no fatigue index and no burnout measurement.`
  : "Within-session decline: NOT MEASURED — do not describe fatigue as measured."}

Trend: ${trendPctNum==null?"no week-over-week comparison possible (a week has no sessions) — do not describe a decline or an improvement":trendPctNum>5?"Meaningful improvement — reinforce what changed":trendPctNum>0?"Marginal progress — consider protocol upgrade":trendPctNum<-5?"⚠️ Significant decline — immediate corrective action":trendPctNum<0?"Slight decline — early intervention recommended":"Plateau — progression protocol needed"}
Adherence: ${thisWeek.length}/week sessions ${thisWeek.length>=5?"(Excellent)":thisWeek.length>=3?"(Good)":thisWeek.length>=1?"(Below optimal — target 4-5/week)":"(None this week — re-engagement needed)"}
${trendPctNum!=null&&trendPctNum<-5&&thisWeek.length>4?"⚠️ High frequency + declining score = overuse/fatigue pattern":""}

STANDARDS:
1. Every section must use ${_name}'s actual numbers — zero generic statements
2. Interventions must be PRECISE: exercise name, sets×reps, hold time, daily frequency, weeks to improvement
3. Clinical flow: identify issue → anatomical mechanism → specific intervention → expected outcome + timeline
4. ## for sections, **bold** key terms, numbered protocols — prefer bullets over tables
5. ⚕️ Flag anything requiring in-person physiotherapy
6. Start immediately — no preamble
${isAr?"LANGUAGE: Egyptian Arabic (عامية مصرية) — medical terms + simple explanation.":"LANGUAGE: Professional clinical English."}

[CTXDATA:${JSON.stringify({avg:avgScore??null, sessions:lifetime.count??null, sessionsExact:lifetime.exact, weekAvg:weekAvg??null, lastWeekAvg:lastWeekAvg??null, weekSessions:thisWeek.length??0, trendPct:trendPctNum??null, cervicalLoadKg:cervLoad??null, neckFlexionDeg:cervAngle??null, fatigueDecline:_fatigue?.declinePoints??null, reliabilityPct:reliability?.pct??null, lang:isAr?"ar":"en"})}]`;
  // ^ Without this marker, if the primary LLM path ever failed here, the
  // rule-based fallback in localAI.js (parseData()) would regex-match this
  // free-form prose and get every field wrong or default to 0 — same fix
  // already applied to AICoach.jsx, aiPreloader.js and AIInsights.jsx.

  const prompts = {
    summary: () => `Generate a weekly clinical posture summary for ${_name}.

## Executive Summary — ${_name}
[2-3 sentences: ${weekAvg==null||lastWeekAvg==null
  ? "one of these weeks has NO sessions, so there is no week-over-week comparison to interpret. Say that plainly and describe the weeks that do have data — do not treat a missing week as a score of zero or as a decline."
  : `interpret ${weekAvg}/100 this week vs ${lastWeekAvg}/100 last week (${trendPct} trend). What does this mean clinically for MSK load?`}]

## Performance vs Last Week
[Specific comparison with clinical interpretation. Reference session count: ${thisWeek.length} this week vs last week.]

## Top 3 Clinical Priorities for Next Week
[3 numbered, specific, evidence-based interventions — not generic advice. Include WHY and TIMEFRAME for each.]`,

    manager: () => `Generate a manager insights report:
Patient: ${_name} | Tier: ${_tier}
Avg score: ${avgScore}/100 | This week: ${weekAvg==null?"no sessions":`${weekAvg}/100`} | Sessions/week: ${thisWeek.length} | Total: ${lifetime.exact ? lifetime.count : `${lifetime.count}+`}
Trend: ${trendPctNum==null?"no comparison possible — a week has no sessions":`${trendPct} week-over-week`}

## Employee Posture Health Assessment
## Risk Indicators (if any)
## Manager Recommendations
## Suggested Interventions`,

    department: () => `Generate a department health comparison report.
Available user data: ${allUsers.length} team members
Average team score: ${deptData.length ? `${avg(deptData.map(d => d.score))}/100 (across ${deptData.length} members who have recorded sessions${_myDept ? ` in ${_myDept}` : ""})` : "not available — no colleagues have recorded sessions"}
Top score on the team: ${deptData.length ? `${Math.max(...deptData.map(d => d.score))}/100` : "not available"}
NOTE: team figures are lifetime averages from each member's profile. This patient's ${avgScore}/100 above is the mean of their most recent sessions, so the two are not exactly like-for-like — do not present a small gap between them as a meaningful ranking.
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

  // With no company data, this used to invent three departments —
  // Engineering 74, Marketing 61, Operations 68 — and place the user's REAL
  // score beside them, unlabelled. A reader had no way to tell which of the
  // four numbers was theirs and which were fiction, and the comparison they
  // drew from it was meaningless. An empty state is honest; a populated fake
  // one is what ends up in a screenshot.
  //
  // id carries the Firestore users/{uid} doc id (see getAllUsers in
  // firebase.js) so "Your Rank" below can identify the current user by
  // identity instead of by score value, which broke on ties.
  // getAllUsers() is `orderBy("created_at","desc") limit(500)`, so
  // `allUsers.slice(0,6)` was THE SIX NEWEST SIGNUPS — labelled "Department",
  // badged "6 members", and its mean labelled "Team Avg". For a 40-person org
  // that was the average of whoever joined most recently.
  //
  // Two further problems came with it: `u.avg_score || 0` rendered a colleague
  // who signed up and never ran a session as "0/100 — Needs Improvement" in a
  // manager-visible ranking (and dragged the team average down), and "Your
  // Rank" searched those six for the current user, so any established user got
  // "—" essentially always.
  //
  // Now: the actual department when the profile carries one, members who have
  // actually recorded a session, and a disclosed count.
  const _deptOf = u => u.department || u.dept || null;
  const _myDept = profile?.department || profile?.dept || null;
  const _deptMembers = allUsers.filter(u =>
    Number.isFinite(u.avg_score) && (u.sessions_count ?? 1) > 0 &&
    (!_myDept || _deptOf(u) === _myDept)
  );
  const deptData = _deptMembers.length > 0
    ? _deptMembers.map(u => ({ id: u.id, name: u.name || u.email?.split("@")[0] || "User", score: u.avg_score }))
    : [];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,8,20,.55)", zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, width: "min(680px,96vw)", height: "min(760px,95dvh)", display: "flex", flexDirection: "column", overflow: "hidden", direction: isAr ? "rtl" : "ltr", boxShadow: "0 24px 80px rgba(0,0,0,.6)", animation: "slideUp 350ms cubic-bezier(0.16,1,0.3,1) both" }}>

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
              // Same as AIInsights: zero sessions is not an average of zero.
              // This file already guards its LLM prompt against exactly this
              // (see the score-validity checks above) — the guard just never
              // reached the tile the user actually looks at.
              { l: isAr ? "المتوسط" : "Avg",       v: sessions?.length ? `${avgScore}/100` : "—", c: sessions?.length ? sc(avgScore) : "#6b82a6" },
              { l: isAr ? "هذا الأسبوع" : "Week",   v: weekAvg ? `${weekAvg}/100` : "—", c: sc(weekAvg) },
              // BUG FIX: was missing the "no data" branch that the identical
              // Trend tile further down (line ~654) has — a user with no
              // prior week to compare (trendPct === "—") saw this tile
              // rendered in alarm-red, as if their posture were declining,
              // instead of neutral.
              { l: isAr ? "الاتجاه" : "Trend",      v: trendPct,             c: trendPct.startsWith("+") ? "#10b981" : trendPct === "—" ? "#6b82a6" : "#ef4444" },
              { l: isAr ? "الجلسات" : "Sessions",   v: lifetime.exact ? lifetime.count : `${lifetime.count}+`,      c: "#60a5fa" },
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
                    { l: isAr ? "إجمالي الجلسات" : "Total", v: lifetime.exact ? lifetime.count : `${lifetime.count}+` },
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
          {tab === "department" && isCompany && deptData.length === 0 && (
            <div style={{ background:"rgba(15,30,54,.85)", border:"1px solid rgba(255,255,255,.07)",
              borderRadius:14, padding:"28px 20px", textAlign:"center" }}>
              <div style={{ fontSize:26, marginBottom:10 }}>👥</div>
              <div style={{ fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:800, color:"#e8f0fe", marginBottom:6 }}>
                {isAr ? "لسه مفيش بيانات فريق" : "No team data yet"}
              </div>
              <div style={{ fontSize:12.5, color:"#94a3b8", lineHeight:1.65, maxWidth:"44ch", margin:"0 auto" }}>
                {isAr
                  ? "المقارنة هتظهر أول ما أعضاء الفريق يسجّلوا جلسات."
                  : "Comparisons appear once your team members have recorded sessions."}
              </div>
            </div>
          )}

          {tab === "department" && isCompany && deptData.length > 0 && (
            <div>
              <div style={{ background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontFamily: "Syne,sans-serif", fontSize: 13, fontWeight: 800, color: "#e8f0fe" }}>
                    {isAr ? "مقارنة الأداء" : "Performance Comparison"}
                  </div>
                  <div style={{ background: "rgba(5,150,105,.12)", border: "1px solid rgba(5,150,105,.22)", borderRadius: 99, padding: "3px 10px", fontSize: 9, fontWeight: 700, color: "#34d399", textTransform: "uppercase" }}>
                    {deptData.length} {isAr ? (_myDept ? `عضو في ${_myDept}` : "عضو سجّلوا جلسات") : (_myDept ? `in ${_myDept}` : "members with sessions")}
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
                  // Match by identity (uid) when we have one — matching by
                  // score value alone broke on ties (whichever tied member
                  // sorted first got credited as "you"), or silently picked
                  // a coworker's rank if the current user wasn't in
                  // allUsers at all. Falls back to the score/"You" match
                  // for the mock dataset above, which has no ids.
                  (() => {
                    const ranked = [...deptData].sort((a, b) => b.score - a.score);
                    const i = uid ? ranked.findIndex(d => d.id === uid) : -1;
                    return { l: isAr ? "ترتيبك" : "Your Rank",
                             v: i >= 0 ? `#${i + 1} ${isAr ? `من ${ranked.length}` : `of ${ranked.length}`}` : "—",
                             c: "#60a5fa" };
                  })(),
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
