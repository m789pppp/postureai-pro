/**
 * Corvus — AI Insights Panel v1.0
 * Executive summaries · Posture trends · Fatigue analysis
 * Weekly insights · Smart recommendations
 * Uses local WebLLM AI directly (no backend needed)
 */
import { useState, useEffect, useCallback } from "react";
import { geminiAnalysis } from "./gemini.js";

// ── AI call via local WebLLM ────────────────────────────────────────
// NOTE: previously routed through geminiChat() -> /api/coach/chat, but
// that endpoint ignores any custom system prompt and always answers as
// the hardcoded "PostureAI Coach" persona, so the executive-summary /
// fatigue-analysis prompts below were silently getting answered with
// the wrong persona. geminiAnalysis() -> /api/ai/analyze actually
// honors context.system_prompt.
async function callGemini(prompt, systemPrompt, maxTokens = 1000) {
  // geminiAnalysis() now runs fully local (WebLLM) — no backend needed.
  // initLocalAI() blocks until the model is ready (downloads on first call).
  return await geminiAnalysis(prompt, { systemPrompt, maxTokens });
}

// ── helpers ───────────────────────────────────────────────────────
const sc = v => v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";
const pct = (a, b) => b ? Math.round(((a - b) / b) * 100) : 0;
const avg = arr => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

function MdText({ text }) {
  const html = (text || "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,     "<em>$1</em>")
    .replace(/^### (.+)$/gm,   "<h4 style='margin:10px 0 4px;font-size:13px;font-weight:700;color:#e8f0fe'>$1</h4>")
    .replace(/^## (.+)$/gm,    "<h3 style='margin:12px 0 5px;font-size:15px;font-weight:800;color:#e8f0fe;font-family:Syne,sans-serif'>$1</h3>")
    .replace(/^- (.+)$/gm,     "<li style='margin:4px 0;padding-left:4px'>$1</li>")
    .replace(/(<li[\s\S]+?<\/li>)/g, "<ul style='padding-left:18px;margin:8px 0'>$1</ul>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g,   "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: 1.75 }} />;
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

  const systemPrompt = `You are an AI health analytics engine for Corvus — an ergonomic monitoring platform.
You analyze posture data and generate professional, actionable, empathetic insights.
Always respond in ${lang === "ar" ? "Arabic" : "English"}.
Keep responses concise, data-driven, and formatted with markdown (** for bold, ## for headers, - for bullets).
Never mention you're an AI assistant or which AI model powers you. Refer to yourself as "Corvus Intelligence".`;

  const tabPrompts = {
    executive: (ctx) => `Generate an executive summary for ${ctx.name}:
- Overall avg score: ${ctx.avgScore}/100 | This week: ${ctx.weekAvg}/100 | Trend: ${ctx.trendPct > 0 ? "+" : ""}${ctx.trendPct}% vs last week
- Total sessions: ${ctx.totalSessions} | This week: ${ctx.thisWeekSessions} | Streak: ${ctx.streak} days
- Fatigue index: ${ctx.fatigueScore}% | Neck risk: ${ctx.neckRisk}% | Burnout risk: ${ctx.burnoutRisk}%

Write a 3-section executive summary:
## Performance Snapshot
## Key Risk Areas  
## This Week's Priority Actions (3 bullet points max)

Be specific, professional, use the numbers. Max 200 words.`,

    trends: (ctx) => `Analyze posture trends for ${ctx.name}:
- 30-day average: ${ctx.avgScore}/100
- This week avg: ${ctx.weekAvg}/100
- Last week avg: ${ctx.lastWeekAvg}/100
- Week-over-week change: ${ctx.trendPct > 0 ? "+" : ""}${ctx.trendPct}%
- Sessions this week: ${ctx.thisWeekSessions}

Generate trend analysis covering:
## Trend Direction
## What's Driving This
## Forecast for Next Week

Use specific numbers. Max 180 words.`,

    fatigue: (ctx) => `Analyze fatigue and burnout risk for ${ctx.name}:
- Fatigue index: ${ctx.fatigueScore}% (${ctx.fatigueScore >= 70 ? "HIGH" : ctx.fatigueScore >= 45 ? "MODERATE" : "LOW"} risk)
- Posture avg score: ${ctx.avgScore}/100
- Burnout risk score: ${ctx.burnoutRisk}%
- Sessions per week: ${ctx.thisWeekSessions}
- Streak: ${ctx.streak} days

Provide:
## Fatigue Assessment
## Warning Signs to Watch (3 bullets)
## Recovery Recommendations (3 actionable bullets)

Be practical and health-focused. Max 200 words.`,

    recommendations: (ctx) => `Generate smart ergonomic recommendations for ${ctx.name}:
- Current posture score: ${ctx.avgScore}/100
- Calibration done: ${ctx.calibrated ? "Yes" : "No"}
- Neck risk: ${ctx.neckRisk}%
- Fatigue: ${ctx.fatigueScore}%
- Weekly sessions: ${ctx.thisWeekSessions}

Create a personalized action plan:
## Immediate Fixes (this week)
## Workstation Adjustments
## Habit Improvements

Be specific and practical. Reference the actual scores. Max 220 words.`,
  };

  const loadInsight = useCallback(async (tabKey) => {
    if (!sessions.length) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      // Ensure local AI is ready (downloads on first use, instant after)
      const { initLocalAI } = await import("./localAI.js");
      await initLocalAI();
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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,8,20,.88)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{
        background: "#0c1528", border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 20, width: "min(640px,96vw)", height: "min(720px,94vh)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        direction: isAr ? "rtl" : "ltr",
        boxShadow: "0 24px 80px rgba(0,0,0,.6)",
        animation: "slideUp 350ms cubic-bezier(0.16,1,0.3,1) both",
      }}>

        {/* ── Header ── */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#1a56db,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: "0 4px 16px rgba(26,86,219,.4)" }}>🧠</div>
              <div>
                <div style={{ fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 800, color: "#e8f0fe", letterSpacing: "-0.02em" }}>
                  {isAr ? "طبقة الذكاء الاصطناعي" : "AI Intelligence Layer"}
                </div>
                <div style={{ fontSize: 10, color: "#0891b2", fontWeight: 600 }}>
                  {isAr ? "تحليل متقدم — Powered by Corvus AI" : "Advanced Analytics — Powered by Corvus AI"}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", color: "#6b82a6", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>

          {/* Quick metrics strip */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            {[
              { label: isAr ? "المتوسط" : "Avg Score",   value: `${avgScore}/100`,         color: sc(avgScore) },
              { label: isAr ? "هذا الأسبوع" : "This Week",   value: weekAvg ? `${weekAvg}/100` : "—",    color: sc(weekAvg) },
              { label: isAr ? "الاتجاه" : "Trend",       value: weekAvg && lastWeekAvg ? `${trendPct > 0 ? "+" : ""}${trendPct}%` : "—", color: trendPct >= 0 ? "#10b981" : "#ef4444" },
              { label: isAr ? "الإرهاق" : "Fatigue",    value: `${fatigueScore}%`,         color: fatigueScore >= 70 ? "#ef4444" : fatigueScore >= 45 ? "#f59e0b" : "#10b981" },
            ].map((m, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, padding: "6px 12px" }}>
                <div style={{ fontSize: 9, color: "#6b82a6", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{m.label}</div>
                <div style={{ fontFamily: "Syne,sans-serif", fontSize: 14, fontWeight: 800, color: m.color, lineHeight: 1.2 }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0, overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: "12px 8px", background: "none", border: "none",
              borderBottom: `2px solid ${tab === t.id ? "#1a56db" : "transparent"}`,
              color: tab === t.id ? "#60a5fa" : "#6b82a6",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              transition: "color 150ms", whiteSpace: "nowrap",
              minWidth: 70,
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span>{isAr ? t.ar : t.en}</span>
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

          {/* No sessions state */}
          {sessions.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <div style={{ fontFamily: "Syne,sans-serif", fontSize: 18, fontWeight: 800, color: "#e8f0fe", marginBottom: 8 }}>
                {isAr ? "لا توجد بيانات بعد" : "No data yet"}
              </div>
              <div style={{ fontSize: 13, color: "#6b82a6", lineHeight: 1.7 }}>
                {isAr ? "سجّل 3 جلسات على الأقل لتفعيل التحليل الذكي" : "Complete at least 3 sessions to unlock AI insights"}
              </div>
            </div>
          )}

          {/* Tab: Executive */}
          {tab === "executive" && sessions.length > 0 && (
            <div>
              <Section title={isAr ? "مؤشرات الأداء الرئيسية" : "Key Performance Indicators"}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  <InsightCard icon="🎯" title={isAr ? "المتوسط الكلي" : "Overall Avg"} value={`${avgScore}/100`} color={sc(avgScore)} sub={avgScore >= 75 ? (isAr ? "ممتاز" : "Excellent") : avgScore >= 50 ? (isAr ? "مقبول" : "Fair") : (isAr ? "يحتاج تحسين" : "Needs work")} delay={0} />
                  <InsightCard icon="📅" title={isAr ? "جلسات هذا الأسبوع" : "Sessions/Week"} value={thisWeek.length} color="#60a5fa" sub={isAr ? "هذا الأسبوع" : "this week"} delay={60} />
                  <InsightCard icon="📈" title={isAr ? "التغير الأسبوعي" : "Weekly Change"} value={weekAvg && lastWeekAvg ? `${trendPct > 0 ? "+" : ""}${trendPct}%` : "—"} color={trendPct >= 0 ? "#10b981" : "#ef4444"} sub={isAr ? "مقارنة بالأسبوع الماضي" : "vs last week"} delay={120} />
                  <InsightCard icon="⚡" title={isAr ? "مؤشر الإرهاق" : "Fatigue Index"} value={`${fatigueScore}%`} color={fatigueScore >= 70 ? "#ef4444" : fatigueScore >= 45 ? "#f59e0b" : "#10b981"} sub={fatigueScore >= 70 ? (isAr ? "مرتفع" : "High") : fatigueScore >= 45 ? (isAr ? "متوسط" : "Moderate") : (isAr ? "منخفض" : "Low")} delay={180} />
                </div>
              </Section>

              {last30Scores.length > 1 && (
                <Section title={isAr ? "مسار 30 يوم" : "30-Day Trend"}>
                  <div style={{ background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "14px 16px" }}>
                    <Sparkline scores={last30Scores} color="#1a56db" h={52} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                      <span style={{ fontSize: 9, color: "#6b82a6", fontWeight: 600 }}>{isAr ? "30 يوم مضت" : "30 days ago"}</span>
                      <span style={{ fontSize: 9, color: "#6b82a6", fontWeight: 600 }}>{isAr ? "اليوم" : "Today"}</span>
                    </div>
                  </div>
                </Section>
              )}

              <AITextSection
                loading={loading} data={data} error={error}
                onRetry={() => loadInsight(tab)} isAr={isAr}
              />
            </div>
          )}

          {/* Tab: Trends */}
          {tab === "trends" && sessions.length > 0 && (
            <div>
              <Section title={isAr ? "تحليل الاتجاه" : "Trend Analysis"} sub={isAr ? "آخر 30 جلسة" : "Last 30 sessions"}>
                <div style={{ background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
                  {last30Scores.length > 1
                    ? <Sparkline scores={last30Scores} color="#1a56db" h={64} />
                    : <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#6b82a6" }}>
                        {isAr ? "تحتاج مزيداً من الجلسات" : "Need more sessions for trend data"}
                      </div>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                  <InsightCard icon="⬆️" title={isAr ? "أفضل أسبوع" : "Best Week"} value={`${Math.max(...(weekScores.length ? weekScores : [avgScore]), 0)}/100`} color="#10b981" delay={0} />
                  <InsightCard icon="📊" title={isAr ? "هذا الأسبوع" : "This Week"} value={weekAvg ? `${weekAvg}/100` : "—"} color="#60a5fa" delay={60} />
                  <InsightCard icon="📉" title={isAr ? "التغير" : "Change"} value={weekAvg && lastWeekAvg ? `${trendPct > 0 ? "+" : ""}${trendPct}%` : "—"} color={trendPct >= 0 ? "#10b981" : "#ef4444"} delay={120} />
                </div>
              </Section>

              <AITextSection loading={loading} data={data} error={error} onRetry={() => loadInsight(tab)} isAr={isAr} />
            </div>
          )}

          {/* Tab: Fatigue */}
          {tab === "fatigue" && sessions.length > 0 && (
            <div>
              <Section title={isAr ? "مؤشرات الإرهاق والخطر" : "Fatigue & Risk Indicators"}>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap" }}>
                  <FatigueGauge level={fatigueScore} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <RiskMeter score={neckRisk} label={isAr ? "خطر الرقبة والكتف" : "Neck & Shoulder Risk"} />
                    <RiskMeter score={burnoutRisk} label={isAr ? "خطر الإرهاق الوظيفي" : "Burnout Risk"} />
                    <RiskMeter score={overallRisk} label={isAr ? "الخطر الإجمالي" : "Overall Risk Score"} />
                  </div>
                </div>

                <div style={{ background: `rgba(${overallRisk >= 70 ? "239,68,68" : overallRisk >= 45 ? "245,158,11" : "16,185,129"},.06)`, border: `1px solid rgba(${overallRisk >= 70 ? "239,68,68" : overallRisk >= 45 ? "245,158,11" : "16,185,129"},.15)`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: overallRisk >= 70 ? "#f87171" : overallRisk >= 45 ? "#fbbf24" : "#34d399", marginBottom: 6 }}>
                    {overallRisk >= 70
                      ? (isAr ? "⚠️ مستوى خطر مرتفع — يُنصح بالراحة" : "⚠️ High risk — rest recommended")
                      : overallRisk >= 45
                      ? (isAr ? "⚡ خطر متوسط — راقب وضعيتك" : "⚡ Moderate risk — monitor posture")
                      : (isAr ? "✅ وضعك جيد — استمر" : "✅ Looking good — keep it up")}
                  </div>
                  <div style={{ fontSize: 11, color: "#b0c4de", lineHeight: 1.6 }}>
                    {overallRisk >= 70
                      ? (isAr ? "نشاطك يُظهر مؤشرات إجهاد. فكر في تقليل ساعات الجلوس وزيادة فترات الراحة." : "Your activity shows strain indicators. Consider reducing sitting hours and increasing break frequency.")
                      : overallRisk >= 45
                      ? (isAr ? "وضعيتك في المنتصف. التحسينات البسيطة ستحدث فرقاً كبيراً." : "Your posture is in the middle zone. Small improvements will make a big difference.")
                      : (isAr ? "وضعيتك ضمن المعدل الصحي. استمر على هذا النهج." : "Your posture is within healthy range. Maintain this approach.")}
                  </div>
                </div>
              </Section>

              <AITextSection loading={loading} data={data} error={error} onRetry={() => loadInsight(tab)} isAr={isAr} />
            </div>
          )}

          {/* Tab: Recommendations */}
          {tab === "recommendations" && sessions.length > 0 && (
            <div>
              <Section title={isAr ? "توصيات مخصصة" : "Smart Recommendations"}
                sub={isAr ? "مبنية على بياناتك الفعلية" : "Based on your actual data"}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    { icon: "🖥️", title: isAr ? "ارتفاع الشاشة" : "Monitor Height",  ok: calibration,                   msg: isAr ? "ضبط معايرة الشاشة" : "Set up monitor calibration" },
                    { icon: "⏰", title: isAr ? "تكرار الراحة" : "Break Frequency",   ok: fatigueScore < 45,             msg: isAr ? "كل 45 دقيقة" : "Every 45 minutes" },
                    { icon: "🎯", title: isAr ? "هدف النقاط" : "Score Target",        ok: avgScore >= 75,                msg: `${isAr ? "استهدف" : "Target"} ${Math.min(avgScore + 10, 95)}/100` },
                    { icon: "📅", title: isAr ? "تكرار الجلسات" : "Session Frequency", ok: thisWeek.length >= 4,          msg: isAr ? "4 جلسات/أسبوع" : "4 sessions/week" },
                  ].map((item, i) => (
                    <div key={i} style={{ background: "rgba(15,30,54,.85)", border: `1px solid ${item.ok ? "rgba(16,185,129,.2)" : "rgba(245,158,11,.2)"}`, borderRadius: 12, padding: "12px 14px", animation: `fadeIn 300ms ${i * 70}ms both` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 18 }}>{item.icon}</span>
                        <span style={{ fontSize: 14 }}>{item.ok ? "✅" : "⚠️"}</span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#e8f0fe", marginBottom: 3 }}>{item.title}</div>
                      <div style={{ fontSize: 10, color: item.ok ? "#34d399" : "#fbbf24", fontWeight: 600 }}>{item.msg}</div>
                    </div>
                  ))}
                </div>
              </Section>

              <AITextSection loading={loading} data={data} error={error} onRetry={() => loadInsight(tab)} isAr={isAr} />
            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── AI Text block (shared across tabs) ───────────────────────────
function AITextSection({ loading, data, error, onRetry, isAr }) {
  return (
    <div style={{ background: "linear-gradient(135deg,rgba(26,86,219,.06),rgba(8,145,178,.04))", border: "1px solid rgba(26,86,219,.14)", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg,#1a56db,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>🧠</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {isAr ? "تحليل Corvus AI" : "Corvus AI Analysis"}
        </span>
        {loading && <span style={{ marginLeft: "auto" }}><LoadingDots /></span>}
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[100, 85, 70, 55].map((w, i) => (
            <div key={i} style={{ height: 12, borderRadius: 6, width: `${w}%`, background: "linear-gradient(90deg,rgba(255,255,255,.06) 25%,rgba(255,255,255,.1) 50%,rgba(255,255,255,.06) 75%)", backgroundSize: "400% 100%", animation: `shimmer 1.6s ease ${i*80}ms infinite` }} />
          ))}
          <style>{`@keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
        </div>
      )}

      {!loading && data && (
        <div style={{ fontSize: 13, color: "#b0c4de", lineHeight: 1.7, animation: "fadeIn 300ms both" }}>
          <MdText text={data} />
        </div>
      )}

      {!loading && error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#f87171" }}>⚠ {error}</span>
          <button onClick={onRetry} style={{ background: "rgba(26,86,219,.15)", border: "1px solid rgba(26,86,219,.25)", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#60a5fa", cursor: "pointer" }}>
            {isAr ? "⟳ أعد المحاولة" : "⟳ Retry"}
          </button>
        </div>
      )}

      {!loading && !data && !error && (
        <div style={{ fontSize: 12, color: "#6b82a6", fontStyle: "italic" }}>
          {isAr ? "جارٍ التحليل..." : "Generating analysis..."}
        </div>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {[0,1,2].map(i => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#1a56db", display: "inline-block", animation: `blink 1.2s ease ${i*0.2}s infinite` }} />
      ))}
      <style>{`@keyframes blink{0%,80%,100%{opacity:.3}40%{opacity:1}}`}</style>
    </span>
  );
}
