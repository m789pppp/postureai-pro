/**
 * Corvus — AI Insights Panel v1.0
 * Executive summaries · Posture trends · Fatigue analysis
 * Weekly insights · Smart recommendations
 * Uses offline AI engine (no backend, no downloads)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { geminiAnalysis } from "./gemini.js";
import { getCached, setCache, getCachedAsync, setFirestoreCache } from "./aiPreloader.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";
import { tierAtLeast } from "./lib/tierQuality.js";
import {
  metricScore, cervicalLoadKg, neckFlexionDeg, sessionFatigue,
  weekWindows, lifetimeSessions, readingReliability,
} from "./lib/clinicalMetrics.js";

// ── AI call via offline engine ──────────────────────────────────────
// NOTE: previously routed through geminiChat() -> /api/coach/chat, but
// that endpoint ignores any custom system prompt and always answers as
// the hardcoded "PostureAI Coach" persona, so the executive-summary /
// fatigue-analysis prompts below were silently getting answered with
// the wrong persona. geminiAnalysis() -> /api/ai/analyze actually
// honors context.system_prompt.
async function callGemini(prompt, systemPrompt, maxTokens = 1000) {
  return await geminiAnalysis(prompt, { systemPrompt, maxTokens });
}

// ── helpers ───────────────────────────────────────────────────────
const sc = v => v == null ? "#64748b" : v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";
function scoreBand(v, isAr) {
  if (v == null) return isAr ? "غير متاح" : "Not measured";
  if (v >= 75)   return isAr ? "ممتاز"    : "Excellent";
  if (v >= 50)   return isAr ? "متوسط"    : "Fair";
  return isAr ? "يحتاج تحسين" : "Needs work";
}
const avg = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

function MdText({ text, isAr }) {
  // `isAr` used to be referenced below (in the table-header cell) with no
  // closure over it — this component never received it as a prop, only
  // the much-later AIInsights component that renders it has `isAr` in
  // scope. That's a bare undeclared identifier, throwing ReferenceError
  // and crashing the whole modal any time an AI response contains a
  // markdown table (a format this file's own system prompts allow).
  if (!text) return null;

  // Process line by line for correct bullet grouping
  const lines = text.split("\n");
  const elements = [];
  let bulletBuffer = [];
  let key = 0;

  const flushBullets = () => {
    if (!bulletBuffer.length) return;
    elements.push(
      <ul key={key++} style={{
        paddingLeft: 0, margin: "8px 0",
        listStyle: "none", display: "flex", flexDirection: "column", gap: 5,
      }}>
        {bulletBuffer.map((item, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ color: "#3b82f6", flexShrink: 0, marginTop: 2, fontSize: 9 }}>●</span>
            <span style={{ flex: 1, lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: item }}/>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  // Links: markdown [text](url) or a bare http(s) URL, in one pass so a
  // markdown-form URL never also gets caught by the bare-URL branch.
  // Previously not handled at all — a link in AI text just sat there as
  // plain unclickable text.
  const linkify = s => s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/g,
    (m, mdText, mdUrl, bareUrl) => {
      if (mdUrl) return `<a href="${mdUrl}" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline">${mdText}</a>`;
      let url = bareUrl, trail = "";
      const tm = url.match(/([.,;:!?)]+)$/);
      if (tm) { trail = tm[1]; url = url.slice(0, -trail.length); }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline">${url}</a>${trail}`;
    }
  );

  const inlineFormat = s => linkify(s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:#e2eaf6;font-weight:700">$1</strong>`)
    .replace(/\*(.+?)\*/g, `<em style="color:#94a3b8">$1</em>`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { flushBullets(); continue; }

    if (line.startsWith("## ")) {
      flushBullets();
      elements.push(
        <div key={key++} style={{
          fontSize: 13, fontWeight: 700, color: "#e2eaf6",
          fontFamily: "Syne,sans-serif", letterSpacing: "-.01em",
          margin: elements.length > 0 ? "14px 0 5px" : "0 0 5px",
          paddingBottom: 5, borderBottom: "1px solid rgba(255,255,255,.06)",
        }} dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(3)) }} />
      );
    } else if (line.startsWith("### ")) {
      flushBullets();
      elements.push(
        <div key={key++} style={{
          fontSize: 10.5, fontWeight: 700, color: "#60a5fa",
          textTransform: "uppercase", letterSpacing: ".06em",
          margin: "10px 0 4px",
        }} dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(4)) }} />
      );
    } else if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* ")) {
      bulletBuffer.push(inlineFormat(line.slice(2)));
    } else if (/^\d+\./.test(line)) {
      flushBullets();
      const [,num,rest] = line.match(/^(\d+)\.\s(.+)$/) || [null, "", line];
      elements.push(
        <div key={key++} style={{ display:"flex", gap:10, margin:"5px 0", alignItems:"baseline" }}>
          <span style={{ color:"#60a5fa", fontWeight:700, fontSize:12, minWidth:18, flexShrink:0 }}>{num || "•"}.</span>
          <span style={{ color:"#cbd5e1", lineHeight:1.65, fontSize:13 }} dangerouslySetInnerHTML={{ __html: inlineFormat(rest||line) }} />
        </div>
      );
    } else if (line.startsWith("|")) {
      // Table row — collect all table lines then render
      flushBullets();
      const tableLines = [line];
      while (i + 1 < lines.length && lines[i+1].trim().startsWith("|")) {
        i++; tableLines.push(lines[i].trim());
      }
      const tableRows = tableLines.filter(r => !r.match(/^[|\s-]+$/));
      if (tableRows.length >= 2) {
        const headers = tableRows[0].split("|").filter((_,j,a)=>j>0&&j<a.length-1).map(h=>h.trim());
        const dataRows = tableRows.slice(1);
        elements.push(
          <div key={key++} style={{ overflowX:"auto", margin:"12px 0" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
              <thead>
                <tr>{headers.map((h,hi)=>(
                  <th key={hi} style={{ padding:"8px 12px", textAlign:isAr?"right":"left", background:"rgba(99,179,237,.1)", color:"#93c5fd", fontWeight:600, borderBottom:"1px solid rgba(99,179,237,.2)" }}
                    dangerouslySetInnerHTML={{ __html: inlineFormat(h) }}/>
                ))}</tr>
              </thead>
              <tbody>
                {dataRows.map((row,ri)=>{
                  const cells = row.split("|").filter((_,j,a)=>j>0&&j<a.length-1).map(c=>c.trim());
                  return <tr key={ri} style={{ background:ri%2===0?"rgba(255,255,255,.02)":"transparent" }}>
                    {cells.map((c,ci)=>(
                      <td key={ci} style={{ padding:"7px 12px", borderBottom:"1px solid rgba(255,255,255,.05)", color:"#cbd5e1" }}
                        dangerouslySetInnerHTML={{ __html: inlineFormat(c) }}/>
                    ))}
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        );
      }
    } else if (line.startsWith("⚕️") || line.startsWith("⚠️")) {
      flushBullets();
      elements.push(
        <div key={key++} style={{ background:"rgba(239,68,68,.07)", border:"0.5px solid rgba(239,68,68,.22)", borderRadius:8, padding:"10px 14px", margin:"10px 0", fontSize:12.5, color:"#fca5a5", lineHeight:1.6 }}
          dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      );
    } else {
      flushBullets();
      elements.push(
        <p key={key++} style={{
          margin: "4px 0", lineHeight: 1.7,
          color: "#cbd5e1", fontSize: 13.5,
        }} dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      );
    }
  }
  flushBullets();
  return <div style={{ display:"flex", flexDirection:"column", fontFamily:"'IBM Plex Sans Arabic','DM Sans',system-ui,sans-serif" }}>{elements}</div>;
}

// ── Fatigue Gauge ──────────────────────────────────────────────────
function FatigueGauge({ decline, isAr }) {
  // `decline` is points of within-session posture loss (first third vs last),
  // or null when no session was long enough to measure it. A null must not
  // render as a green zero — that reads as "measured, no fatigue".
  const unmeasured = decline == null;
  const level = unmeasured ? 0 : Math.max(0, Math.min(100, decline * 4)); // arc fill only
  const color = unmeasured ? "#64748b" : decline >= 15 ? "#ef4444" : decline >= 5 ? "#f59e0b" : "#10b981";
  const label = unmeasured ? (isAr ? "مش متقاس" : "Not measured")
              : decline >= 15 ? (isAr ? "تراجع كبير" : "Marked decline")
              : decline >= 5  ? (isAr ? "تراجع بسيط" : "Mild drift")
              : (isAr ? "بتحافظ على وضعيتك" : "Holds position");
  const r = 38, circ = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: 96, height: 96 }}>
        <svg width="96" height="96" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(148,163,184,.1)" strokeWidth="7" />
          <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={`${(level / 100) * circ} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 800ms cubic-bezier(.4,0,.2,1)" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Syne,sans-serif", fontSize: unmeasured ? 15 : 20, fontWeight: 800, color, lineHeight: 1 }}>{unmeasured ? "—" : decline}</span>
          <span style={{ fontSize: 8, color: "#6b82a6", marginTop: 2, fontWeight: 600, textTransform: "uppercase" }}>{unmeasured ? (isAr ? "غير متاح" : "no data") : (isAr ? "نقطة/جلسة" : "pts / session")}</span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

// ── Trend Sparkline ────────────────────────────────────────────────
function Sparkline({ scores, color = "#1a56db", h = 44, showArea = true }) {
  if (!scores || scores.length < 2) return null;
  const max = Math.max(...scores, 1);
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * 200;
    const y = ((max - s) / max) * h;
    return [x, y];
  });
  const polyline = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const fillPath = `M0,${h} ${pts.map(([x, y]) => `${x},${y}`).join(" ")} L200,${h} Z`;
  return (
    <svg viewBox={`0 0 200 ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showArea && <path d={fillPath} fill={`url(#sg-${color.replace("#","")})`} />}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* last dot */}
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3" fill={color} />
    </svg>
  );
}

// ── Insight Card ───────────────────────────────────────────────────
function InsightCard({ icon, title, value, sub, trend, color = "#1a56db", delay = 0 }) {
  return (
    <div style={{
      background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)",
      borderRadius: 14, padding: "14px 16px", position: "relative", overflow: "hidden",
      animation: `fadeIn 400ms ${delay}ms both`,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b82a6" }}>{title}</span>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>
      <div style={{ fontFamily: "Syne,sans-serif", fontSize: 26, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.03em" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#6b82a6", marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: trend >= 0 ? "#10b981" : "#ef4444" }}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs prev week
        </div>
      )}
    </div>
  );
}

// ── Risk Meter ─────────────────────────────────────────────────────
function RiskMeter({ score, label }) {
  const color = score >= 70 ? "#ef4444" : score >= 45 ? "#f59e0b" : "#10b981";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "#b0c4de", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{score}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: "rgba(148,163,184,.1)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${score}%`, background: color,
          borderRadius: 99, transition: "width 700ms cubic-bezier(.4,0,.2,1)",
        }} />
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────
function Section({ title, sub, children, action }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 800, color: "#e8f0fe", letterSpacing: "-0.02em" }}>{title}</div>
          {sub && <div style={{ fontSize: 10, color: "#6b82a6", marginTop: 2, fontWeight: 500 }}>{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
// ── LoadingDots ───────────────────────────────────────────────────
function LoadingDots() {
  return (
    <span style={{ display:"inline-flex", gap:3, alignItems:"center" }}>
      {[0,1,2].map(i=>(
        <span key={i} style={{ width:5, height:5, borderRadius:"50%", background:"#1a56db", display:"inline-block", animation:`blink 1.2s ease ${i*0.2}s infinite` }}/>
      ))}
      <style>{`@keyframes blink{0%,80%,100%{opacity:.2}40%{opacity:1}}`}</style>
    </span>
  );
}

// ── AITextSection — AI response area with skeleton + error states ──
function AITextSection({ loading, data, error, onRetry, isAr, D }) {
  const T = D?.t || { label:{fontSize:9,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase"}, small:{fontSize:11}, body:{fontSize:13,lineHeight:1.65} };
  const C = D?.c || { text:"#f0f6ff", sub:"#94a3b8", muted:"#475569", border:"rgba(148,163,184,.08)", danger:"#ef4444" };

  return (
    <div style={{ background:"linear-gradient(135deg,rgba(26,86,219,.06),rgba(8,145,178,.04))", border:"1px solid rgba(26,86,219,.15)", borderRadius:14, padding:"16px 18px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <div style={{ width:26, height:26, borderRadius:8, background:"linear-gradient(135deg,#1a56db,#0891b2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>🧠</div>
        <span style={{ ...T.label, color:"#60a5fa", fontSize:10 }}>{isAr?"تحليل Corvus AI":"Corvus AI Analysis"}</span>
        {loading && <span style={{ marginLeft:"auto" }}><LoadingDots/></span>}
      </div>
      {loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
          <style>{`@keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}} @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}} @keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>
          {[100,88,74,58].map((w,i)=>(
            <div key={i} style={{ height:11, borderRadius:6, width:`${w}%`, background:"linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.05) 75%)", backgroundSize:"400% 100%", animation:`shimmer 1.6s ease ${i*90}ms infinite` }}/>
          ))}
        </div>
      )}
      {!loading && data && (
        <div style={{ ...T.body, color:"#b8cce0", animation:"fadeIn 300ms both" }}>
          <MdText text={data} isAr={isAr}/>
        </div>
      )}
      {!loading && error && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <span style={{ ...T.small, color:C.danger }}>⚠ {error}</span>
          <button onClick={onRetry} style={{ background:"rgba(26,86,219,.12)", border:"1px solid rgba(26,86,219,.22)", borderRadius:8, padding:"6px 14px", ...T.label, color:"#60a5fa", cursor:"pointer", fontSize:10, textTransform:"none" }}>
            {isAr?"⟳ أعد المحاولة":"⟳ Retry"}
          </button>
        </div>
      )}
      {!loading && !data && !error && (
        <div style={{ ...T.small, color:C.muted, fontStyle:"italic" }}>{isAr?"جارٍ التحليل...":"Generating analysis..."}</div>
      )}
    </div>
  );
}

export function AIInsights({ profile, sessions = [], calibration, cs, lang = "en", onClose, effectiveTier, uid = "", onUpgrade }) {
  useBodyScrollLock();
  const [tab, setTab]               = useState("executive");
  const [loading, setLoading]       = useState(false);
  const [data, setData]             = useState(null);   // AI-generated text
  const [error, setError]           = useState("");
  const isAr = lang === "ar";

  // ── Derived session analytics ──────────────────────────────────
  const allScores  = sessions.map(s => s.avg_score || 0).filter(Boolean);
  const avgScore   = avg(allScores);
  // avg([]) is 0, and "no sessions this week" was therefore indistinguishable
  // from "a literal 0/100 score". The earlier fix guarded trendPct but left the
  // two averages themselves, so the SCREEN honestly rendered "—" while the
  // prompt beside it asserted `This week: 0/100 | Last week: 0/100` to a
  // physiotherapist persona — and the trends prompt converted that absence into
  // a specific kilogram load on the cervical spine.
  //
  // These are now null when the week had no sessions, and trendPct is null when
  // either endpoint is missing: "no comparison possible" rather than 0%, which
  // reads as "measured, unchanged". Every consumer below handles null.
  const _wk            = weekWindows(sessions);
  const weekAvg        = _wk.thisWeek.avg;
  const lastWeekAvg    = _wk.lastWeek.avg;
  const trendPct       = _wk.trendPct;

  const last30Scores = sessions.slice(0, 30).map(s => s.avg_score || 0).filter(Boolean).reverse();

  // ── Fatigue model: inverse of avg recent score, weighted by session count ──
  // Same missing-data issue as trendPct above: with no sessions this week,
  // weekAvg=0 read as "score crashed to zero," which alone could push
  // fatigueScore/burnoutRisk into "HIGH RISK — refer for physiotherapy"
  // territory purely from a quiet week, not any real fatigue signal.
  // Fatigue, measured. Every session stores score_history, so the decline from
  // its first third to its last third is an actual observation of posture
  // degrading while the user sat there — which is what the word means.
  //
  // The old expression measured nothing of the sort: (100 - weekAvg) * 0.6 was
  // the weekly posture average inverted, the `sessions.length < 5 ? 30 : 10`
  // term made "fatigue" a function of how many rows the query returned (a user
  // with four sessions and a perfect week read 30%, and dropped to 10% on their
  // fifth session with no change in posture), and the floor of 10 meant a
  // flawless week still reported fatigue. The `thisWeek.length === 0 ? 0` guard
  // that was added for the no-data case made it worse in a different direction:
  // it rendered a confident green "0% — LOW" gauge and told the prompt
  // "Fatigue: 0%" for a user we had simply not observed.
  const _fatigue = sessionFatigue(sessions);
  const fatigueDecline = _fatigue?.declinePoints ?? null;   // pts, or null
  const fatigueFrom    = _fatigue?.from ?? 0;

  // The engine's own Hansraj (2014) implementation: pitch from MEASURED
  // forward-head displacement, load = 4.5/cos(pitch) - 4.5. This is what the
  // four hardcoded `avgScore < 55 ? "18-27 kg"` tables were imitating while the
  // real figure sat unread on every session document.
  const cervLoadKg   = cervicalLoadKg(sessions);
  const cervFlexDeg  = neckFlexionDeg(sessions);
  const reliability  = readingReliability(sessions);
  const lifetime     = lifetimeSessions(profile, sessions);

  // ── Risk scores ────────────────────────────────────────────────
  // Cervical risk from the CERVICAL MEASUREMENT, not from the overall score.
  //
  // It was `100 - avgScore + (avgScore < 60 ? 20 : 0)` — arithmetic on the
  // number displayed beside it, so an overall 49 produced "71% cervical risk"
  // and the two could never disagree. That figure was then fed to the model,
  // which turns it into anatomy: the prompt below reads "71% cervical risk =
  // C5-C7 facet joints under chronic overload — herniation risk elevated". A
  // claim about a named spinal segment, generated from a restatement of the
  // average posture score.
  //
  // Every session stores the engine's own neck_lean score. Averaged over the
  // recent ones that recorded a reliable reading; null when none did, so the
  // prompt can say "not measured" instead of naming a vertebra.
  const _neckSc = metricScore(sessions, "neck_lean");
  const neckRisk = _neckSc == null ? null : Math.max(0, Math.min(100, 100 - _neckSc));
  // Burnout is removed rather than repaired. It was
  //   fatigueScore * 0.8 + (thisWeek.length > 5 ? 15 : 0)
  // which unrolls to 0.48 x (100 - weekAvg): the posture score, printed a third
  // time under the name of an ICD-11 occupational syndrome. The second term
  // RAISED a user's burnout risk for using the posture app more than five times
  // a week. Nothing in this product observes hours, workload, sleep or mood, so
  // there is no honest version of this number.
  //
  // overallRisk previously averaged the real neckRisk with that synthetic
  // figure, which laundered it into a headline "N% — High" badge; and when
  // neckRisk was null the badge showed pure burnout, discarding the null
  // handling entirely. It is now just the cervical measurement, named as such.
  const overallRisk = neckRisk;

  // Recurring alert causes across recent sessions — was never computed
  // here, so ctx.topAlerts was always undefined everywhere below (the
  // system prompt's "Recurring issues" line, the Janda pattern detection,
  // and every tab prompt's "Alerts:" line all silently fell back to "none
  // recorded"/"none" for every user). Saved sessions store this under
  // alert_causes (see App.jsx saveSession calls), not alerts.
  const alertCounts = {};
  sessions.slice(0, 20).forEach(s => {
    (s.alert_causes || s.alerts || []).forEach(a => {
      const k = typeof a === "string" ? a : (a?.cause || a?.label || a?.type || "");
      if (k) alertCounts[k] = (alertCounts[k] || 0) + 1;
    });
  });
  const topAlerts = Object.entries(alertCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);

  // ── AI summary builder ─────────────────────────────────────────
  const buildContext = useCallback(() => ({
    name:         profile?.name?.split(" ")[0] || "User",
    tier:         (effectiveTier || profile?.tier || "standard") || "professional",
    avgScore,
    weekAvg,
    lastWeekAvg,
    trendPct,
    // sessions.length saturates at the query's limit(50), so this told a
    // 300-session user they had 50 — and, because the AI cache key is built
    // from it, the key stopped changing once the array saturated and the cached
    // report was served forever regardless of new sessions.
    totalSessions: lifetime.count,
    sessionsExact: lifetime.exact,
    thisWeekSessions: _wk.thisWeek.n,
    lastWeekSessions: _wk.lastWeek.n,
    fatigueDecline,
    fatigueFrom,
    neckRisk,
    cervLoadKg,
    cervFlexDeg,
    reliabilityPct: reliability?.pct ?? null,
    overallRisk,
    streak: profile?.streak_days || 0,
    calibrated: !!calibration,
    topAlerts,
    lang,
    // calibration and effectiveTier were missing from the deps, so a
    // calibration that resolved after mount left `calibrated` false forever.
  }), [profile, sessions, avgScore, weekAvg, lastWeekAvg, trendPct, fatigueDecline,
       neckRisk, cervLoadKg, topAlerts, lang, calibration, effectiveTier, lifetime.count]);

  const ctx = buildContext();
  // These cut-points must match the card's `sub` label below and sc()'s colour
  // bands, or the card reads "Excellent" while the AI paragraph beneath it says
  // "Good" for the same 78/100. Single source of truth: scoreBand().
  const _scoreL = scoreBand(ctx.avgScore, false);
  // 45 matches the cutoff every risk badge/color in this file's UI already
  // uses (fatigueScore/overallRisk below) — this and the two other "40"
  // comparisons in this prompt used to disagree with it, so e.g. a score
  // of 42 could render a green "Low" badge in the UI while the AI text
  // called it "MODERATE" / "Sustained loading approaching clinical
  // threshold" right next to it.
  const _neckL  = ctx.neckRisk==null?"NOT MEASURED"
                : ctx.neckRisk>=70?"HIGH 🔴":ctx.neckRisk>=45?"MODERATE 🟡":"LOW 🟢";
  const _neckV  = ctx.neckRisk==null?"not measured":`${ctx.neckRisk}%`;
  const systemPrompt = `You are Dr. Corvus — a senior clinical physiotherapist and ergonomics specialist with 15 years of MSK experience.

## PATIENT CLINICAL PROFILE: ${ctx.name}
- Overall score: ${ctx.avgScore}/100 (${_scoreL}) | This week: ${ctx.weekAvg==null?`no sessions (${ctx.thisWeekSessions} recorded) — do NOT report this as 0/100`:`${ctx.weekAvg}/100`} | Last week: ${ctx.lastWeekAvg==null?"no sessions — do NOT report this as 0/100":`${ctx.lastWeekAvg}/100`}
- Week trend: ${ctx.trendPct==null?"no comparison possible (a week has no sessions)":`${ctx.trendPct>0?"+":""}${ctx.trendPct}%`} | Sessions: ${ctx.totalSessions}${ctx.sessionsExact?"":"+"} | This week: ${ctx.thisWeekSessions}
- Cervical risk: ${_neckV} (${_neckL})
- ${ctx.cervLoadKg==null?"Cervical load: NOT MEASURED — do not estimate a flexion angle or quote kilograms":`Cervical load, MEASURED: ${ctx.cervLoadKg} kg above the 4.5 kg neutral${ctx.cervFlexDeg!=null?` at ${ctx.cervFlexDeg}° flexion`:""}`}
- ${ctx.fatigueDecline==null?"Within-session decline: NOT MEASURED — do not describe fatigue as measured":`Within-session posture decline: ${ctx.fatigueDecline} pts (first vs last third of a session, n=${ctx.fatigueFrom})`}
- Occupational burnout is NOT measured by this product and must not be reported as a level or a risk multiplier
- Calibration: ${ctx.calibrated?"Personalized thresholds":"NOT calibrated — population thresholds, not fitted to this user"}${ctx.reliabilityPct!=null?` | ${ctx.reliabilityPct}% of recent metric readings were reliable`:""}
- Recurring issues: ${ctx.topAlerts?.join(", ")||"none recorded"}

## CLINICAL INTERPRETATION GUIDE
**Cervical loading (Hansraj 2014):** the published table maps a MEASURED head-flexion angle to load — 0°=4.5kg, 15°=12kg, 30°=18kg, 45°=22kg, 60°=27kg.
${ctx.cervLoadKg==null
  ? "This patient has NO cervical measurement. Do not estimate their angle or load from the posture score — that score is a composite of thirteen metrics including elbow angle and monitor height, and has no fixed relationship to neck flexion."
  : `This patient MEASURES ${ctx.cervLoadKg} kg above neutral${ctx.cervFlexDeg!=null?` at ${ctx.cervFlexDeg}° flexion`:""}. Cite that figure; do not re-derive one from the score.`}

**Risk interpretation:** ${ctx.neckRisk==null
  ? "No reliable neck measurement in the recent sessions. Do NOT describe cervical loading, name a spinal segment, or estimate a risk level — say the reading is unavailable and why it might be (head or shoulders out of frame)."
  : `${ctx.neckRisk}% cervical risk = ${ctx.neckRisk>=70?"C5-C7 facet joints under chronic overload — herniation risk elevated":ctx.neckRisk>=45?"Sustained loading approaching clinical threshold":"Within safe loading range"}`}

**Disc pressure:** not measured. This product observes posture from a webcam; it does not measure intradiscal pressure. Do not quote a disc-pressure percentage for this patient.

**Postural patterns:** ${ctx.topAlerts?.some(a=>a.toLowerCase().includes("rounded"))
  ? "Rounded shoulders recur in this patient's alerts, which is consistent with — but not diagnostic of — an upper-crossed pattern: tight pecs and upper traps against weak deep neck flexors and rhomboids. Present it as a pattern worth assessing, not a diagnosis."
  : "No recurring alert supports a named postural syndrome for this patient. Do not name one."}
This product measures nothing below the trunk, so a lower-crossed pattern cannot be assessed from this data at all — previously a substring match on "back" or "hip" claimed to screen for it, against alert keys that can never contain either word.

## REPORT STANDARDS:
- Use ## for sections, **bold** clinical terms, numbered protocols
- Every finding = anatomical mechanism + clinical consequence + specific intervention
- Interventions: exact sets×reps, hold time, frequency, weeks to improvement
- ${ctx.topAlerts?.length?"Always reference these specific alerts: " + ctx.topAlerts.slice(0,3).join(", "):"Reference score trajectory and risk levels"}
- ⚕️ Flag anything needing in-person assessment
- Preferred bullets over tables — cleaner rendering

${lang === "ar" ? "LANGUAGE: Respond ENTIRELY in Egyptian Arabic (عامية مصرية). Medical terms + immediate simple explanation." : "LANGUAGE: Clear, precise professional English."}

[CTXDATA:${JSON.stringify({avg:ctx.avgScore??null, sessions:ctx.totalSessions??null, sessionsExact:!!ctx.sessionsExact, weekAvg:ctx.weekAvg??null, lastWeekAvg:ctx.lastWeekAvg??null, weekSessions:ctx.thisWeekSessions??0, trendPct:ctx.trendPct??null, neckRisk:ctx.neckRisk??null, cervicalLoadKg:ctx.cervLoadKg??null, neckFlexionDeg:ctx.cervFlexDeg??null, fatigueDecline:ctx.fatigueDecline??null, reliabilityPct:ctx.reliabilityPct??null, calibrated:!!ctx.calibrated, alerts:(ctx.topAlerts||[]).join("; "), lang})}]`;
  // ^ Without this marker, if the primary LLM path ever failed here, the
  // rule-based fallback in localAI.js (parseData()) would regex-match this
  // free-form prose and get every field wrong — its patterns expect
  // phrases like "Overall avg score:"/"Neck risk:" that don't appear
  // above — silently reporting fabricated data instead of erroring. Same
  // fix already applied to AICoach.jsx and aiPreloader.js.

  // ── Tab prompts ─────────────────────────────────────────────────
  //
  // These were one 6,000-character line, which is part of how the following
  // survived review for so long. Every clinical figure in them was fabricated:
  //
  //   load = ctx.avgScore < 55 ? "18-27 kg" : ...        (Hansraj 2014)
  //   ang  = ctx.avgScore < 55 ? "35-50"    : ...
  //
  // Hansraj's table is a function of MEASURED head flexion. avgScore is a
  // composite of up to thirteen metrics including elbow angle, screen distance
  // and monitor height — so a user with a perfect neck and a bad desk landed at
  // 50/100 and was told "cervical angle ~35-50°, load ~18-27 kg", after which
  // the prompt asked the model to name the structures at risk. Worse, four
  // different bucket tables lived in this object and DISAGREED: the executive
  // and system prompts, sent in the same request, told the model a 90/100 user
  // was at both "<20°/4-12kg" and "<10°/4-6kg".
  //
  // The engine has measured the real figure on every session all along
  // (fhp_index.extra_load_kg, from actual forward-head displacement), so that
  // is what goes in now — and when it is absent, the prompt says so and forbids
  // the estimate rather than falling back to a bucket.
  //
  // Also removed: the Holtermann 2018 "2.3x / 1.4x / 1.1x elevated MSK injury
  // risk" ladder, which attached hazard-ratio-shaped numbers to a citation and
  // keyed them off a burnout score that was 0.48 x (100 - weekAvg). Its lowest
  // branch was 1.1x, so every user including a flawless one was told their
  // injury risk was elevated. Nothing here can support a relative risk, so no
  // multiplier is quoted at all.
  const _fmtWeek = (v, n) => v == null ? `no sessions (${n} recorded) — do NOT report this as a score of 0` : `${v}/100`;
  const _fmtTrend = (t) => t == null ? "no comparison possible (a week has no sessions)" : `${t > 0 ? "+" : ""}${t}%`;
  const _cervLine = (ctx) => ctx.cervLoadKg == null
    ? "Cervical load: NOT MEASURED. Do not estimate a flexion angle, quote a kilogram figure, or name a spinal level."
    : `Cervical load, MEASURED (Hansraj 2014 applied to measured forward-head displacement): ${ctx.cervLoadKg} kg above the 4.5 kg neutral${ctx.cervFlexDeg != null ? `, at ${ctx.cervFlexDeg}° flexion` : ""}. Use these exact figures; do not re-derive them from the posture score.`;
  const _fatigueLine = (ctx) => ctx.fatigueDecline == null
    ? "Within-session decline: NOT MEASURED (no session long enough to compare its start and end). Do not describe fatigue as measured or assign it a percentage."
    : `Within-session posture decline: ${ctx.fatigueDecline} pts from the first third of a session to the last, across ${ctx.fatigueFrom} sessions. This is the only fatigue signal available — there is no separate fatigue index and no burnout measurement.`;
  const _sessLine = (ctx) => `Sessions: ${ctx.totalSessions}${ctx.sessionsExact ? "" : "+ (query truncated)"} total, ${ctx.thisWeekSessions} this week | Streak: ${ctx.streak} days`;
  const _calibLine = (ctx) => ctx.calibrated
    ? "Calibration: personalized thresholds"
    : `Calibration: NOT done — population thresholds, not fitted to this user${ctx.reliabilityPct != null ? ` | ${ctx.reliabilityPct}% of recent metric readings were reliable` : ""}`;

  const tabPrompts = {
    executive: (ctx) => `Write a clinical executive report for ${ctx.name || "Patient"}.

DATA (reference ALL of it; never invent a figure that is not here):
Overall score (all recorded sessions): ${ctx.avgScore}/100
This week: ${_fmtWeek(ctx.weekAvg, ctx.thisWeekSessions)} | Last week: ${_fmtWeek(ctx.lastWeekAvg, ctx.lastWeekSessions)} | Trend: ${_fmtTrend(ctx.trendPct)}
${_sessLine(ctx)}
Cervical risk: ${ctx.neckRisk == null ? "not measured — do not describe cervical loading" : `${ctx.neckRisk}%`}
${_cervLine(ctx)}
${_fatigueLine(ctx)}
${_calibLine(ctx)}
Alerts: ${ctx.topAlerts?.join(", ") || "none recorded"}

## Performance Snapshot
[Interpret the score and the trend. If a cervical load was measured, interpret THAT figure — which structures it loads. If it was not, say the measurement is unavailable and why (head or shoulders out of frame) rather than estimating one.]
## Primary Risk Factors
1. [Most urgent, tied to a figure above: structure involved, consequence if unaddressed]
2. [Second]
3. [Third, or a positive indicator]
## This Week's Protocol
1. [Exercise: name, sets×reps, hold time, target muscle, why it helps ${ctx.name || "this patient"} specifically]
2. [Exercise: same format]
3. [Ergonomic change: specific and measurable]
Max 240 words. No generic statements. No figure that is not in the DATA block.`,

    trends: (ctx) => `Clinical trend analysis for ${ctx.name || "Patient"}.

DATA:
This week: ${_fmtWeek(ctx.weekAvg, ctx.thisWeekSessions)} | Last week: ${_fmtWeek(ctx.lastWeekAvg, ctx.lastWeekSessions)}
Change: ${_fmtTrend(ctx.trendPct)} | All-session average: ${ctx.avgScore}/100 | ${ctx.thisWeekSessions} sessions this week
${_cervLine(ctx)}
Alerts: ${ctx.topAlerts?.join(", ") || "none"}

## What Changed
[Interpret the score movement. A percent change in a bounded composite index has no kilogram equivalent — do NOT convert the trend into a cervical load figure. If a load was measured, you may compare it to the neutral 4.5 kg baseline directly.]
## Root Cause
[Link to the actual alerts: ${ctx.topAlerts?.slice(0, 2).join(", ") || "postural patterns"}. Behavioural + anatomical mechanism, not "poor habits".]
## What To Watch
[Which variable most changes the trajectory. State plainly if there is not enough data to project — do not produce a predicted score range unless the trend above is a real comparison.]
## Acceleration Protocol
1. [Targets the root cause: mechanism + timeline]
2. [Different approach: mechanism + timeline]
Max 210 words.`,

    fatigue: (ctx) => `Clinical fatigue assessment for ${ctx.name || "Patient"}.

DATA:
${_fatigueLine(ctx)}
Overall score: ${ctx.avgScore}/100 | ${ctx.thisWeekSessions} sessions this week | Streak: ${ctx.streak} days
${_cervLine(ctx)}

IMPORTANT: this product measures posture from a webcam. It does not observe hours worked, sleep, workload or mood, so it cannot assess occupational burnout — do not report a burnout level, and do not quote a relative injury risk multiplier. If asked about burnout, say plainly that it is not measured here and what would be needed to assess it.

## Fatigue Profile
[${ctx.fatigueDecline == null
  ? "No within-session decline could be measured. Explain what that means and what would produce the measurement (longer sessions), rather than describing a physiological state."
  : `Posture drops ${ctx.fatigueDecline} pts across a session. Which muscles fail to hold position first, and what that pattern indicates.`}]
## Warning Signs
1. [Specific to the data above]
2. [Different mechanism]
3. [Recovery window estimate, only if the decline was measured]
## Recovery Protocol
1. [Intervention + duration + frequency + weeks to improvement]
2. [Different modality]
3. [Lifestyle/recovery factor]
${ctx.fatigueDecline != null && ctx.fatigueDecline >= 15
  ? "⚕️ Marked within-session decline — suggest an in-person physiotherapy assessment."
  : "⚕️ Re-assess weekly. Seek evaluation for pain that radiates, numbness, or one-sided weakness."}
Max 230 words.`,

    recommendations: (ctx) => `Personalized intervention plan for ${ctx.name || "Patient"}.

STARTING POINT:
Score: ${ctx.avgScore}/100
${_cervLine(ctx)}
Cervical risk: ${ctx.neckRisk == null ? "not measured — do not describe cervical loading" : `${ctx.neckRisk}%`}
${_fatigueLine(ctx)}
Alerts: ${ctx.topAlerts?.slice(0, 3).join(", ") || "none"}
${_calibLine(ctx)}

## Immediate Interventions (Days 1-7)
1. **[Exercise]** — targets: [a specific alert or deficit above] | sets×reps: ___ | hold: ___s | ___×/day | mechanism: [why this one]
2. **[Exercise]** — same format, different muscle group
3. **[Ergonomic fix]** — monitor height, chair angle, keyboard distance, with measurements
## Progressive Protocol (Weeks 2-4)
[Week-by-week progression, each gated on an observable change rather than a fixed score target.]
## Workstation Setup
${ctx.calibrated ? "Personalized:" : "Standard ISO 11226:"}
- Monitor: top at eye level | Chair: 0-5° forward tilt | Keyboard: elbows 90-100°
## What Progress Looks Like
[Describe what improvement will look like in the alerts and measurements above. Do NOT promise specific weekly score targets — the previous version of this prompt hardcoded +5/+10/+18 points regardless of the patient's actual trajectory, which is not a clinical milestone.]
Max 290 words. Specific to ${ctx.name || "this patient"}'s actual data.`,
  };
  // Tracks which tab is actually selected right now, read inside the async
  // continuations below. Without this, switching tabs while a request is
  // still in flight didn't cancel it — loadInsight fires a fresh call on
  // every tab change (see the effect below) but the old call's state
  // updates land whenever its network request happens to resolve. A slow
  // "executive" call finishing after a fast "fatigue" call had already
  // rendered would silently overwrite the visible fatigue content with
  // stale executive text, with the "fatigue" tab still shown as selected.
  const activeTabRef = useRef(tab);
  useEffect(() => { activeTabRef.current = tab; }, [tab]);

  const loadInsight = useCallback(async (tabKey) => {
    if (!sessions.length) return;

    // ── L1: Check memory + sessionStorage first (instant) ────────
    const memCached = uid ? getCached(uid, tabKey, lang, lifetime.count) : null;
    if (memCached) { if (activeTabRef.current===tabKey){ setData(memCached); setLoading(false); } return; }

    // Show loading while checking Firestore
    setLoading(true);
    setError("");
    setData(null);

    // ── L2: Check Firestore (persistent across reloads) ───────────
    if (uid) {
      try {
        const fsCached = await getCachedAsync(uid, tabKey, lang, lifetime.count);
        if (activeTabRef.current!==tabKey) return; // tab changed while awaiting — drop this result
        if (fsCached) {
          setData(fsCached);
          setLoading(false);
          return; // Served from Firestore — no AI call needed
        }
      } catch {}
    }

    // ── L3: Generate fresh (only if nothing cached) ───────────────
    try {
      const ctx    = buildContext();
      const prompt = tabPrompts[tabKey]?.(ctx);
      if (!prompt) return;
      const text = await callGemini(prompt, systemPrompt);
      if (text && uid) {
        setCache(uid, tabKey, lang, text, lifetime.count);
        // Also persist to Firestore for next reload
        try {
          await setFirestoreCache(uid, tabKey, lang, text, lifetime.count);
        } catch {}
      }
      if (activeTabRef.current===tabKey) setData(text);
    } catch (e) {
      if (activeTabRef.current===tabKey) setError(e.message || "Failed to generate insight");
    } finally {
      if (activeTabRef.current===tabKey) setLoading(false);
    }
  }, [buildContext, lifetime.count, profile, lang, uid]);

  // Auto-load when tab changes
  useEffect(() => {
    loadInsight(tab);
  }, [tab]);

  // Was gated only at the sidebar nav level (locked:!elite), which was
  // removed in favor of an "open the feature, upsell inside" pattern —
  // but this component never had any internal gate of its own, so
  // removing the sidebar block made it fully free for every tier.
  if (!tierAtLeast(effectiveTier, "elite")) return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9200, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "rgba(8,14,28,.98)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: "36px 28px", maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>🔒</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#f0f6ff", marginBottom: 8 }}>{isAr ? "رؤى AI — Elite" : "AI Insights — Elite"}</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 22 }}>{isAr ? "ملخصات تنفيذية وتحليل اتجاهات وإرهاق مبني على AI" : "Executive summaries, trend and fatigue analysis powered by AI"}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "rgba(255,255,255,.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{isAr ? "إغلاق" : "Close"}</button>
          <button onClick={()=>{ onClose?.(); onUpgrade?.(); }} style={{ padding: "10px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{isAr ? "الترقية لـ Elite" : "Upgrade to Elite"}</button>
        </div>
      </div>
    </div>
  );

  const TABS = [
    { id: "executive",       icon: "📋", en: "Executive",      ar: "ملخص تنفيذي" },
    { id: "trends",          icon: "📈", en: "Trends",         ar: "الاتجاهات" },
    { id: "fatigue",         icon: "⚡", en: "Fatigue",        ar: "الإرهاق" },
    { id: "recommendations", icon: "💡", en: "Actions",        ar: "التوصيات" },
  ];

  // ── Design tokens — single source of truth ──────────────────────
  const D = {
    // Typography
    displayFont: "'Syne', 'DM Sans', system-ui, sans-serif",
    bodyFont:    "'IBM Plex Sans Arabic', 'DM Sans', system-ui, sans-serif",
    // Type scale
    t: {
      display: { fontSize:22, fontWeight:800, letterSpacing:"-0.03em", lineHeight:1.15, fontFamily:"'Syne','DM Sans',system-ui" },
      h1:      { fontSize:17, fontWeight:700, letterSpacing:"-0.02em", lineHeight:1.25 },
      h2:      { fontSize:14, fontWeight:700, letterSpacing:"-0.01em", lineHeight:1.3  },
      h3:      { fontSize:12, fontWeight:600, letterSpacing:"0",       lineHeight:1.4  },
      body:    { fontSize:13, fontWeight:400,                          lineHeight:1.65 },
      small:   { fontSize:11, fontWeight:400,                          lineHeight:1.55 },
      label:   { fontSize:9,  fontWeight:700, letterSpacing:"0.07em",  lineHeight:1,   textTransform:"uppercase" },
      num:     { fontSize:24, fontWeight:800, letterSpacing:"-0.04em", lineHeight:1,   fontFamily:"'Syne','DM Sans',system-ui" },
      numSm:   { fontSize:15, fontWeight:700, letterSpacing:"-0.02em", lineHeight:1    },
    },
    // Colors
    c: {
      text:    "#f0f6ff",
      sub:     "#94a3b8",
      muted:   "#475569",
      border:  "rgba(148,163,184,.08)",
      card:    "rgba(15,28,52,.9)",
      accent:  "#1a56db",
      success: "#10b981",
      warning: "#f59e0b",
      danger:  "#ef4444",
      cyan:    "#0891b2",
    },
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(2,8,20,.55)", zIndex:9100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{
        background:"#0a1628", border:`1px solid ${D.c.border}`,
        borderRadius:20, width:"min(640px,96vw)", height:"min(720px,94dvh)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        direction: isAr ? "rtl" : "ltr",
        fontFamily: D.bodyFont,
        boxShadow:"0 24px 80px rgba(0,0,0,.6)",
        animation:"slideUp 350ms cubic-bezier(0.16,1,0.3,1) both",
      }}>

        {/* ═══ HEADER ═══════════════════════════════════════════════ */}
        <div style={{ padding:"18px 22px 14px", borderBottom:`1px solid ${D.c.border}`, flexShrink:0 }}>
          {/* Title row */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:11, background:"linear-gradient(135deg,#1a56db,#0891b2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, boxShadow:"0 6px 20px rgba(26,86,219,.35)" }}>🧠</div>
              <div>
                <div style={{ ...D.t.h1, color:D.c.text }}>
                  {isAr ? "طبقة الذكاء الاصطناعي" : "AI Intelligence Layer"}
                </div>
                <div style={{ ...D.t.small, color:D.c.cyan, marginTop:2 }}>
                  {isAr ? "تحليل متقدم — Corvus AI" : "Advanced Analytics — Corvus AI"}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:9, background:"rgba(255,255,255,.05)", border:`1px solid ${D.c.border}`, color:D.c.muted, cursor:"pointer", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center", transition:"background .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.09)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.05)"}>✕</button>
          </div>

          {/* KPI strip */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
            {[
              { lbl:isAr?"المتوسط":"Avg",   val:`${avgScore}`, unit:"/100", col:sc(avgScore) },
              { lbl:isAr?"هذا الأسبوع":"Week", val:weekAvg??"—", unit:weekAvg!=null?"/100":"", col:sc(weekAvg) },
              { lbl:isAr?"الاتجاه":"Trend", val:trendPct==null?"—":(trendPct>0?"+":"")+trendPct+"%", unit:"", col:trendPct==null?D.c.muted:trendPct>=0?D.c.success:D.c.danger },
              // Was a percentage computed from the weekly posture average. Now
              // the measured points of decline across a session, or an em-dash.
              { lbl:isAr?"تراجع الجلسة":"Session decline", val:fatigueDecline==null?"—":`${fatigueDecline}`, unit:fatigueDecline==null?"":isAr?" نقطة":" pts", col:fatigueDecline==null?D.c.muted:fatigueDecline>=15?D.c.danger:fatigueDecline>=5?D.c.warning:D.c.success },
            ].map((m,i)=>(
              <div key={i} style={{ background:"rgba(255,255,255,.04)", border:`1px solid ${D.c.border}`, borderRadius:10, padding:"8px 10px" }}>
                <div style={{ ...D.t.label, color:D.c.muted, marginBottom:5 }}>{m.lbl}</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:2 }}>
                  <span style={{ ...D.t.numSm, color:m.col }}>{m.val}</span>
                  {m.unit && <span style={{ ...D.t.small, color:D.c.muted }}>{m.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ TAB BAR ══════════════════════════════════════════════ */}
        <div style={{ display:"flex", borderBottom:`1px solid ${D.c.border}`, flexShrink:0, overflowX:"auto" }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1, padding:"11px 8px",
              background:"none", border:"none",
              borderBottom:`2px solid ${tab===t.id?D.c.accent:"transparent"}`,
              color:tab===t.id?"#60a5fa":D.c.muted,
              cursor:"pointer", minWidth:70, whiteSpace:"nowrap",
              display:"flex", flexDirection:"column", alignItems:"center", gap:4,
              transition:"color .15s",
            }}>
              <span style={{ fontSize:15 }}>{t.icon}</span>
              <span style={{ ...D.t.label, letterSpacing:"0.04em", textTransform:"none", fontSize:10 }}>{isAr?t.ar:t.en}</span>
            </button>
          ))}
        </div>

        {/* ═══ CONTENT ══════════════════════════════════════════════ */}
        <div style={{ flex:1, overflowY:"auto", padding:"22px 22px 28px" }}>

          {/* Empty state */}
          {sessions.length===0 && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:44, marginBottom:16, opacity:.6 }}>📊</div>
              <div style={{ ...D.t.h1, color:D.c.text, marginBottom:8 }}>{isAr?"لا توجد بيانات بعد":"No data yet"}</div>
              <div style={{ ...D.t.body, color:D.c.sub, maxWidth:280, lineHeight:1.7 }}>
                {isAr?"سجّل 3 جلسات على الأقل لتفعيل التحليل الذكي":"Complete at least 3 sessions to unlock AI insights"}
              </div>
            </div>
          )}

          {/* ── Executive Tab ──────────────────────────────────────── */}
          {tab==="executive" && sessions.length>0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              {/* KPI grid */}
              <div>
                <div style={{ ...D.t.label, color:D.c.muted, marginBottom:12 }}>{isAr?"مؤشرات الأداء الرئيسية":"Key Performance Indicators"}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {[
                    { icon:"🎯", lbl:isAr?"متوسط كل الجلسات":"All-session avg", val:`${avgScore}/100`, sub: scoreBand(avgScore, isAr), col:sc(avgScore) },
                    { icon:"📅", lbl:isAr?"جلسات هذا الأسبوع":"Sessions/Week", val:`${_wk.thisWeek.n}`,    sub:isAr?"هذا الأسبوع":"this week", col:"#60a5fa" },
                    { icon:"📈", lbl:isAr?"التغير الأسبوعي":"Weekly Change",  val:trendPct==null?"—":(trendPct>0?"+":"")+trendPct+"%", sub:trendPct==null?(isAr?"محتاج جلسات في الأسبوعين":"needs sessions in both weeks"):(isAr?"مقارنة بالأسبوع الماضي":"vs last week"), col:trendPct==null?D.c.muted:trendPct>=0?D.c.success:D.c.danger },
                    { icon:"⚡", lbl:isAr?"تراجع داخل الجلسة":"Within-session decline", val:fatigueDecline==null?"—":`${fatigueDecline}${isAr?" نقطة":" pts"}`, sub:fatigueDecline==null?(isAr?"مش متقاس":"Not measured"):fatigueDecline>=15?(isAr?"تراجع كبير":"Marked"):fatigueDecline>=5?(isAr?"تراجع بسيط":"Mild"):(isAr?"بتحافظ على وضعيتك":"Holds position"), col:fatigueDecline==null?D.c.muted:fatigueDecline>=15?D.c.danger:fatigueDecline>=5?D.c.warning:D.c.success },
                  ].map((m,i)=>(
                    <div key={i} style={{ background:D.c.card, border:`1px solid ${D.c.border}`, borderRadius:14, padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                        <div style={{ ...D.t.label, color:D.c.muted }}>{m.lbl}</div>
                        <span style={{ fontSize:16 }}>{m.icon}</span>
                      </div>
                      <div style={{ ...D.t.num, color:m.col, marginBottom:4 }}>{m.val}</div>
                      <div style={{ ...D.t.small, color:D.c.sub }}>{m.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 30-day sparkline */}
              {last30Scores.length>1 && (
                <div>
                  <div style={{ ...D.t.label, color:D.c.muted, marginBottom:12 }}>{isAr?`آخر ${last30Scores.length} جلسة`:`Last ${last30Scores.length} sessions`}</div>
                  <div style={{ background:D.c.card, border:`1px solid ${D.c.border}`, borderRadius:14, padding:"16px 18px" }}>
                    <Sparkline scores={last30Scores} color={D.c.accent} h={52}/>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:10 }}>
                      <span style={{ ...D.t.label, color:D.c.muted }}>{isAr?"الأقدم":"Oldest"}</span>
                      <span style={{ ...D.t.label, color:D.c.muted }}>{isAr?"اليوم":"Today"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* AI text */}
              <AITextSection loading={loading} data={data} error={error} onRetry={()=>loadInsight(tab)} isAr={isAr} D={D}/>
            </div>
          )}

          {/* ── Trends Tab ─────────────────────────────────────────── */}
          {tab==="trends" && sessions.length>0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <div>
                <div style={{ ...D.t.label, color:D.c.muted, marginBottom:12 }}>{isAr?"تحليل الاتجاه — آخر 30 جلسة":"Trend Analysis — Last 30 sessions"}</div>
                <div style={{ background:D.c.card, border:`1px solid ${D.c.border}`, borderRadius:14, padding:"16px 18px", marginBottom:12 }}>
                  {last30Scores.length>1
                    ? <Sparkline scores={last30Scores} color={D.c.accent} h={64}/>
                    : <div style={{ ...D.t.body, color:D.c.muted, textAlign:"center", padding:"24px 0" }}>{isAr?"بيانات غير كافية":"Not enough data"}</div>
                  }
                </div>
                {/* Week-over-week */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {[
                    { lbl:isAr?"هذا الأسبوع":"This week",  val:weekAvg??"—",     col:sc(weekAvg) },
                    { lbl:isAr?"الأسبوع الماضي":"Last week", val:lastWeekAvg??"—", col:sc(lastWeekAvg) },
                    { lbl:isAr?"التغير":"Change",           val:trendPct==null?"—":(trendPct>0?"+":"")+trendPct+"%", col:trendPct==null?D.c.muted:trendPct>=0?D.c.success:D.c.danger },
                  ].map((m,i)=>(
                    <div key={i} style={{ background:D.c.card, border:`1px solid ${D.c.border}`, borderRadius:12, padding:"12px 14px", textAlign:"center" }}>
                      <div style={{ ...D.t.label, color:D.c.muted, marginBottom:8 }}>{m.lbl}</div>
                      <div style={{ ...D.t.numSm, color:m.col }}>{m.val}</div>
                    </div>
                  ))}
                </div>
              </div>
              <AITextSection loading={loading} data={data} error={error} onRetry={()=>loadInsight(tab)} isAr={isAr} D={D}/>
            </div>
          )}

          {/* ── Fatigue Tab ────────────────────────────────────────── */}
          {tab==="fatigue" && sessions.length>0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <div style={{ display:"flex", justifyContent:"center" }}>
                <FatigueGauge decline={fatigueDecline} isAr={isAr}/>
              </div>
              {/* Fatigue breakdown bars */}
              <div>
                <div style={{ ...D.t.label, color:D.c.muted, marginBottom:12 }}>{isAr?"توزيع مستويات الأداء":"Performance Distribution"}</div>
                {[
                  { lbl:isAr?"ممتاز (80+)":"Excellent (80+)", pct:Math.round(last30Scores.filter(s=>s>=80).length/Math.max(last30Scores.length,1)*100), col:D.c.success },
                  { lbl:isAr?"جيد (60-79)":"Good (60-79)",    pct:Math.round(last30Scores.filter(s=>s>=60&&s<80).length/Math.max(last30Scores.length,1)*100), col:D.c.accent },
                  { lbl:isAr?"ضعيف (<60)":"Weak (<60)",      pct:Math.round(last30Scores.filter(s=>s<60).length/Math.max(last30Scores.length,1)*100), col:D.c.danger },
                ].map((b,i)=>(
                  <div key={i} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                      <span style={{ ...D.t.small, color:D.c.sub }}>{b.lbl}</span>
                      <span style={{ ...D.t.small, color:b.col, fontWeight:700 }}>{b.pct}%</span>
                    </div>
                    <div style={{ height:5, background:"rgba(255,255,255,.06)", borderRadius:99 }}>
                      <div style={{ height:"100%", width:`${b.pct}%`, background:b.col, borderRadius:99, transition:"width .5s" }}/>
                    </div>
                  </div>
                ))}
              </div>
              <AITextSection loading={loading} data={data} error={error} onRetry={()=>loadInsight(tab)} isAr={isAr} D={D}/>
            </div>
          )}

          {/* ── Recommendations Tab ────────────────────────────────── */}
          {tab==="recommendations" && sessions.length>0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {/* Was "Overall Risk Level" = mean(neckRisk, burnoutRisk) — half of
                  it fabricated, which laundered the invented half into a headline
                  badge; and when neckRisk was null it showed pure burnout. It is
                  the cervical measurement, so it is labelled as the cervical
                  measurement, and says "not measured" instead of disappearing. */}
              {(
                <div style={{ background:`${sc(overallRisk==null?null:100-overallRisk)}12`, border:`1px solid ${sc(overallRisk==null?null:100-overallRisk)}30`, borderRadius:14, padding:"14px 16px" }}>
                  <div style={{ ...D.t.label, color:sc(overallRisk==null?null:100-overallRisk), marginBottom:8 }}>{isAr?"خطر الرقبة (مقاس)":"Cervical risk (measured)"}</div>
                  <div style={{ ...D.t.numSm, color:sc(overallRisk==null?null:100-overallRisk) }}>{overallRisk==null?(isAr?"مش متقاس — مفيش قراءة رقبة موثوقة في الجلسات الأخيرة":"Not measured — no reliable neck reading in recent sessions"):`${overallRisk}% — ${overallRisk>=70?(isAr?"مرتفع":"High"):overallRisk>=45?(isAr?"متوسط":"Moderate"):(isAr?"منخفض":"Low")}`}</div>
                  {cervLoadKg!=null && <div style={{ ...D.t.label, color:D.c.muted, marginTop:6 }}>{isAr?`حمل مقاس: ${cervLoadKg} كجم فوق المحايد`:`Measured load: ${cervLoadKg} kg above neutral`}{cervFlexDeg!=null?(isAr?` عند ${cervFlexDeg}°`:` at ${cervFlexDeg}°`):""}</div>}
                </div>
              )}
              <AITextSection loading={loading} data={data} error={error} onRetry={()=>loadInsight(tab)} isAr={isAr} D={D}/>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

