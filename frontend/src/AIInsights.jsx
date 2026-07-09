/**
 * Corvus — AI Insights Panel v1.0
 * Executive summaries · Posture trends · Fatigue analysis
 * Weekly insights · Smart recommendations
 * Uses offline AI engine (no backend, no downloads)
 */
import { useState, useEffect, useCallback } from "react";
import { geminiAnalysis } from "./gemini.js";

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
const sc = v => v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";
const pct = (a, b) => b ? Math.round(((a - b) / b) * 100) : 0;
const avg = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

function MdText({ text }) {
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

  const inlineFormat = s => s
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
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      bulletBuffer.push(inlineFormat(line.slice(2)));
    } else {
      flushBullets();
      elements.push(
        <p key={key++} style={{
          margin: "4px 0", lineHeight: 1.7,
          color: "#94a3b8", fontSize: 13,
        }} dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      );
    }
  }
  flushBullets();
  return <div style={{ display: "flex", flexDirection: "column" }}>{elements}</div>;
}

// ── Fatigue Gauge ──────────────────────────────────────────────────
function FatigueGauge({ level }) {
  const color = level >= 70 ? "#ef4444" : level >= 45 ? "#f59e0b" : "#10b981";
  const label = level >= 70 ? "High Risk" : level >= 45 ? "Moderate" : "Low";
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
          <span style={{ fontFamily: "Syne,sans-serif", fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{level}%</span>
          <span style={{ fontSize: 8, color: "#6b82a6", marginTop: 2, fontWeight: 600, textTransform: "uppercase" }}>Fatigue</span>
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
          <MdText text={data}/>
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

export function AIInsights({ profile, sessions = [], calibration, cs, lang = "en", onClose }) {
  const [tab, setTab]               = useState("executive");
  const [loading, setLoading]       = useState(false);
  const [data, setData]             = useState(null);   // AI-generated text
  const [error, setError]           = useState("");
  const isAr = lang === "ar";

  // ── Derived session analytics ──────────────────────────────────
  const allScores  = sessions.map(s => s.avg_score || 0).filter(Boolean);
  const avgScore   = avg(allScores);
  const thisWeek   = sessions.filter(s => {
    const d = s.created_at?.toDate?.() || new Date(s.created_at || 0);
    return (Date.now() - d) < 7 * 86400000;
  });
  const lastWeek   = sessions.filter(s => {
    const d = s.created_at?.toDate?.() || new Date(s.created_at || 0);
    const ms = Date.now() - d;
    return ms >= 7 * 86400000 && ms < 14 * 86400000;
  });
  const weekScores     = thisWeek.map(s => s.avg_score || 0);
  const lastWeekScores = lastWeek.map(s => s.avg_score || 0);
  const weekAvg        = avg(weekScores);
  const lastWeekAvg    = avg(lastWeekScores);
  const trendPct       = pct(weekAvg, lastWeekAvg);

  const last30Scores = sessions.slice(0, 30).map(s => s.avg_score || 0).filter(Boolean).reverse();

  // ── Fatigue model: inverse of avg recent score, weighted by session count ──
  const fatigueScore = Math.min(100, Math.max(0, Math.round(
    sessions.length === 0 ? 0 :
    (100 - weekAvg) * 0.6 + (sessions.length < 5 ? 30 : 10)
  )));

  // ── Risk scores ────────────────────────────────────────────────
  const neckRisk    = Math.min(100, Math.round(100 - avgScore + (avgScore < 60 ? 20 : 0)));
  const burnoutRisk = Math.min(100, Math.round(fatigueScore * 0.8 + (thisWeek.length > 5 ? 15 : 0)));
  const overallRisk = Math.round((neckRisk + burnoutRisk) / 2);

  // ── AI summary builder ─────────────────────────────────────────
  const buildContext = useCallback(() => ({
    name:         profile?.name?.split(" ")[0] || "User",
    tier:         profile?.tier || "professional",
    avgScore,
    weekAvg,
    lastWeekAvg,
    trendPct,
    totalSessions: sessions.length,
    thisWeekSessions: thisWeek.length,
    fatigueScore,
    neckRisk,
    burnoutRisk,
    overallRisk,
    streak: profile?.streak_days || 0,
    calibrated: !!calibration,
    lang,
  }), [profile, sessions, avgScore, weekAvg, fatigueScore, lang]);

  const systemPrompt = `You are Dr. Corvus — the clinical AI physiotherapist inside Corvus PostureAI Pro.

ROLE: Generate structured, evidence-based clinical posture reports.

CLINICAL KNOWLEDGE:
- Hansraj (2014): cervical load at 0°=4.5kg, 15°=12kg, 30°=18kg, 45°=22kg, 60°=27kg
- Nachemson disc pressure model: sitting unsupported=140% vs standing baseline
- Janda's Upper Crossed Syndrome: tight pecs/upper traps + weak deep neck flexors/rhomboids → FHP + rounded shoulders
- ISO 11226: acceptable neck flexion <25°, shoulder elevation <60°, trunk inclination <20°
- NIOSH: continuous sitting >45 min without movement = significantly elevated MSK injury risk

REPORT STANDARDS:
- Use ## section headers, **bold** clinical terms, numbered protocols
- Explain WHY each finding matters anatomically — never just state the number
- Reference the patient's actual numbers in EVERY section — no generic statements
- Interventions must be precise: sets × reps, hold times, frequency, expected weeks to improvement
- Flag ⚕️ any findings warranting professional consultation
- Never say "maintain good posture" — describe the specific correction and target muscle group

${lang === "ar" ? "LANGUAGE: Respond ENTIRELY in Egyptian Arabic (عامية مصرية). Use medical terms then immediately explain them simply." : "LANGUAGE: Respond in clear, professional English."}`;

  const tabPrompts = {
    executive: (ctx) => `Generate a clinical executive summary for ${ctx.name || "the patient"}.

PATIENT DATA:
- Posture score: ${ctx.avgScore}/100 (${ctx.avgScore >= 85 ? "Excellent" : ctx.avgScore >= 70 ? "Good" : ctx.avgScore >= 55 ? "Fair" : "Needs Attention"}) | This week: ${ctx.weekAvg}/100
- Trend: ${ctx.trendPct > 0 ? "+" : ""}${ctx.trendPct}% vs last week | Sessions: ${ctx.totalSessions} total (${ctx.thisWeekSessions} this week) | Streak: ${ctx.streak} days
- Fatigue index: ${ctx.fatigueScore}% (${ctx.fatigueScore >= 70 ? "HIGH" : ctx.fatigueScore >= 45 ? "MODERATE" : "LOW"}) | Cervical risk: ${ctx.neckRisk}% | Burnout risk: ${ctx.burnoutRisk}%
- Calibration: ${ctx.calibrated ? "complete — personalized thresholds active" : "NOT DONE — generic thresholds only"}

Write these EXACT sections:

## Performance Snapshot
[2-3 sentences. Use the specific numbers. Interpret what the score means physiologically — which structures are under what level of load.]

## Primary Risk Factors  
[2-3 bullets with %, anatomical explanation, and consequence if unaddressed. E.g. "Cervical risk at ${ctx.neckRisk}% suggests sustained neck flexion loading the C5-C7 facet joints..."]

## This Week's Priority Actions
[3 numbered interventions. Include: what to do, why it targets the identified risk, expected benefit timeline.]

Max 230 words. Be clinically specific.`,

    trends: (ctx) => `Perform a clinical trend analysis for ${ctx.name || "the patient"}.

TREND DATA:
- 30-day average: ${ctx.avgScore}/100
- This week: ${ctx.weekAvg}/100 | Last week: ${ctx.lastWeekAvg}/100
- Week-over-week delta: ${ctx.trendPct > 0 ? "+" : ""}${ctx.trendPct}% (${ctx.trendPct > 2 ? "improving" : ctx.trendPct < -2 ? "declining" : "stable"})
- Session frequency this week: ${ctx.thisWeekSessions}

Generate:

## Trend Direction & Clinical Significance
[Interpret the ${ctx.trendPct}% change. A ${Math.abs(ctx.trendPct)}% ${ctx.trendPct >= 0 ? "improvement" : "decline"} in posture score corresponds to what change in musculoskeletal load? What does this trajectory mean long-term?]

## Root Cause Analysis
[What behavioral or environmental factors likely explain this trend? Be specific — not "poor habits."]

## Evidence-Based Forecast
[Project next week's outcome based on current trajectory. Give a realistic score range.]

## Course Correction Protocol
[2-3 specific interventions to improve or sustain the trend this week. Include mechanism.]

Max 210 words.`,

    fatigue: (ctx) => `Perform a clinical fatigue and occupational burnout assessment for ${ctx.name || "the patient"}.

CLINICAL INDICATORS:
- Fatigue index: ${ctx.fatigueScore}% (${ctx.fatigueScore >= 70 ? "HIGH" : ctx.fatigueScore >= 45 ? "MODERATE" : "LOW"} risk)
- Occupational burnout score: ${ctx.burnoutRisk}%
- Posture average: ${ctx.avgScore}/100
- Weekly session frequency: ${ctx.thisWeekSessions} sessions | Streak: ${ctx.streak} days

Generate:

## Fatigue Profile Assessment
[Distinguish acute vs chronic load accumulation. A fatigue index of ${ctx.fatigueScore}% suggests what physiological state? How does it relate to the posture score of ${ctx.avgScore}/100? What MSK structures are most affected?]

## Occupational Risk Indicators
[3 specific warning signs derived from this patient's data — link each to a clinical consequence. E.g. fatigue + low session frequency = progressive deconditioning of postural stabilizers.]

## Evidence-Based Recovery Protocol
[3 interventions with duration, frequency, and expected improvement timeline. Cite relevant research.]

Max 230 words.`,

    recommendations: (ctx) => `Generate a personalized clinical ergonomic intervention plan for ${ctx.name || "the patient"}.

PATIENT PROFILE:
- Posture score: ${ctx.avgScore}/100 | Calibration: ${ctx.calibrated ? "anthropometrically calibrated — precise thresholds" : "UNCALIBRATED — using generic population norms, may under/over-report"}
- Cervical risk: ${ctx.neckRisk}% | Fatigue: ${ctx.fatigueScore}% | Session frequency: ${ctx.thisWeekSessions}/week

Create a prioritized clinical intervention plan:

## Immediate Clinical Interventions (This Week)
[Top 2-3 highest-impact corrections. For each: the specific biomechanical deficit, the corrective action with precise parameters, the mechanism of how it helps, expected benefit.]

## Workstation Modification Protocol
[Specific adjustments with measurements — monitor height relative to eye level, chair seat pan angle, keyboard distance from edge of desk, monitor distance in cm. Base on the patient's calibration status.]

## Neuromuscular Re-education Program
[4-5 exercises targeting the identified deficits. Each: name, sets × reps or hold time, frequency per day/week, which muscle imbalance it addresses.]

## 30-Day Outcome Milestones
[Realistic score targets at Week 1, Week 2, Week 4. What symptoms should improve and when.]

Max 280 words.`,
  };

  const loadInsight = useCallback(async (tabKey) => {
    if (!sessions.length) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const ctx    = buildContext();
      const prompt = tabPrompts[tabKey]?.(ctx);
      if (!prompt) return;
      const text = await callGemini(prompt, systemPrompt);
      setData(text);
    } catch (e) {
      setError(e.message || "Failed to generate insight");
    } finally {
      setLoading(false);
    }
  }, [buildContext, sessions.length]);

  // Auto-load when tab changes
  useEffect(() => {
    loadInsight(tab);
  }, [tab]);

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
    bodyFont:    "'DM Sans', system-ui, sans-serif",
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
    <div style={{ position:"fixed", inset:0, background:"rgba(2,8,20,.88)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", zIndex:9100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{
        background:"#0a1628", border:`1px solid ${D.c.border}`,
        borderRadius:20, width:"min(640px,96vw)", height:"min(720px,94vh)",
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
              { lbl:isAr?"هذا الأسبوع":"Week", val:weekAvg||"—", unit:weekAvg?"/100":"", col:sc(weekAvg||0) },
              { lbl:isAr?"الاتجاه":"Trend", val:weekAvg&&lastWeekAvg?(trendPct>0?"+":"")+trendPct+"%":"—", unit:"", col:trendPct>=0?D.c.success:D.c.danger },
              { lbl:isAr?"الإرهاق":"Fatigue", val:`${fatigueScore}`, unit:"%", col:fatigueScore>=70?D.c.danger:fatigueScore>=45?D.c.warning:D.c.success },
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
                    { icon:"🎯", lbl:isAr?"المتوسط الكلي":"Overall Avg",     val:`${avgScore}/100`, sub: avgScore>=75?(isAr?"ممتاز":"Excellent"):avgScore>=50?(isAr?"مقبول":"Fair"):(isAr?"يحتاج تحسين":"Needs work"), col:sc(avgScore) },
                    { icon:"📅", lbl:isAr?"جلسات هذا الأسبوع":"Sessions/Week", val:`${thisWeek.length}`,    sub:isAr?"هذا الأسبوع":"this week", col:"#60a5fa" },
                    { icon:"📈", lbl:isAr?"التغير الأسبوعي":"Weekly Change",  val:weekAvg&&lastWeekAvg?(trendPct>0?"+":"")+trendPct+"%":"—", sub:isAr?"مقارنة بالأسبوع الماضي":"vs last week", col:trendPct>=0?D.c.success:D.c.danger },
                    { icon:"⚡", lbl:isAr?"مؤشر الإرهاق":"Fatigue Index",    val:`${fatigueScore}%`, sub:fatigueScore>=70?(isAr?"مرتفع":"High"):fatigueScore>=45?(isAr?"متوسط":"Moderate"):(isAr?"منخفض":"Low"), col:fatigueScore>=70?D.c.danger:fatigueScore>=45?D.c.warning:D.c.success },
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
                  <div style={{ ...D.t.label, color:D.c.muted, marginBottom:12 }}>{isAr?"مسار 30 يوم":"30-Day Trend"}</div>
                  <div style={{ background:D.c.card, border:`1px solid ${D.c.border}`, borderRadius:14, padding:"16px 18px" }}>
                    <Sparkline scores={last30Scores} color={D.c.accent} h={52}/>
                    <div style={{ display:"flex", justifyContent:"space-between", marginTop:10 }}>
                      <span style={{ ...D.t.label, color:D.c.muted }}>{isAr?"30 يوم مضت":"30 days ago"}</span>
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
                    { lbl:isAr?"هذا الأسبوع":"This week",  val:weekAvg||"—",     col:sc(weekAvg||0) },
                    { lbl:isAr?"الأسبوع الماضي":"Last week", val:lastWeekAvg||"—", col:sc(lastWeekAvg||0) },
                    { lbl:isAr?"التغير":"Change",           val:weekAvg&&lastWeekAvg?(trendPct>0?"+":"")+trendPct+"%":"—", col:trendPct>=0?D.c.success:D.c.danger },
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
                <FatigueGauge level={fatigueScore}/>
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
              {overallRisk > 0 && (
                <div style={{ background:`${overallRisk>=70?D.c.danger:overallRisk>=45?D.c.warning:D.c.success}12`, border:`1px solid ${overallRisk>=70?D.c.danger:overallRisk>=45?D.c.warning:D.c.success}30`, borderRadius:14, padding:"14px 16px" }}>
                  <div style={{ ...D.t.label, color:overallRisk>=70?D.c.danger:overallRisk>=45?D.c.warning:D.c.success, marginBottom:8 }}>{isAr?"مستوى الخطر الإجمالي":"Overall Risk Level"}</div>
                  <div style={{ ...D.t.numSm, color:overallRisk>=70?D.c.danger:overallRisk>=45?D.c.warning:D.c.success }}>{overallRisk}% — {overallRisk>=70?(isAr?"مرتفع":"High"):overallRisk>=45?(isAr?"متوسط":"Moderate"):(isAr?"منخفض":"Low")}</div>
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

