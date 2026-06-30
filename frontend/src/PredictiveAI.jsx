/**
 * Corvus — Predictive AI Engine v1.0
 * Burnout prediction · Anomaly detection
 * Posture risk scoring · Trend forecasting
 */
import { useState, useEffect, useCallback } from "react";
import { geminiAnalysis, localFallbackAnalysis } from "./gemini.js";
import { getLocalAIStatus } from "./localAI.js";

// NOTE: previously wrapped geminiChat(), but /api/coach/chat ignores any
// custom system prompt and always answers as the hardcoded "PostureAI
// Coach" persona — so burnout/forecast prompts here were silently being
// answered with the wrong persona. geminiAnalysis() -> /api/ai/analyze
// actually honors context.system_prompt.
async function callGemini(prompt, system, maxTokens = 900) {
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
    .replace(/^### (.+)$/gm, "<h4 style='margin:9px 0 4px;font-size:13px;font-weight:700;color:#e8f0fe'>$1</h4>")
    .replace(/^- (.+)$/gm,   "<li style='margin:4px 0'>$1</li>")
    .replace(/(<li[\s\S]+?<\/li>)/g, "<ul style='padding-left:18px;margin:8px 0'>$1</ul>")
    .replace(/\n\n/g, "<br/><br/>").replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} style={{ lineHeight: 1.75 }} />;
}

function avg(arr) { return arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0; }

// ── Anomaly detector (simple z-score) ─────────────────────────────
function detectAnomalies(scores) {
  if (scores.length < 5) return [];
  const m = avg(scores);
  const sd = Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - m, 2), 0) / scores.length);
  return scores.map((v, i) => ({
    index: i, value: v,
    z: sd > 0 ? Math.abs((v - m) / sd) : 0,
    isAnomaly: sd > 0 && Math.abs((v - m) / sd) > 1.8,
    direction: v > m ? "high" : "low",
  })).filter(p => p.isAnomaly);
}

// ── Linear regression forecast ─────────────────────────────────────
function forecast(scores, days = 7) {
  if (scores.length < 3) return null;
  const n = scores.length;
  const xs = scores.map((_, i) => i);
  const mx = avg(xs), my = avg(scores);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (scores[i] - my), 0);
  const den = xs.reduce((s, x) => s + Math.pow(x - mx, 2), 0);
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  const predicted = Array.from({ length: days }, (_, i) =>
    Math.round(Math.max(0, Math.min(100, intercept + slope * (n + i))))
  );
  return { slope, predicted, trend: slope > 0.5 ? "improving" : slope < -0.5 ? "declining" : "stable" };
}

// ── Risk Card ──────────────────────────────────────────────────────
function RiskCard({ title, score, icon, desc, color, delay = 0 }) {
  const w = score;
  return (
    <div style={{ background: "rgba(15,30,54,.85)", border: `1px solid ${color}22`, borderRadius: 14, padding: 16, animation: `fadeIn 400ms ${delay}ms both` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b82a6" }}>{title}</div>
          <div style={{ fontFamily: "Syne,sans-serif", fontSize: 28, fontWeight: 800, color, lineHeight: 1, marginTop: 4 }}>{score}<span style={{ fontSize: 14, fontWeight: 500, opacity: .6 }}>/100</span></div>
        </div>
        <span style={{ fontSize: 26 }}>{icon}</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: "rgba(148,163,184,.08)", overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 99, transition: "width 800ms cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <div style={{ fontSize: 11, color: "#b0c4de", lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

// ── Anomaly marker ─────────────────────────────────────────────────
function AnomalyItem({ anomaly, sessions, isAr }) {
  const sess = sessions[sessions.length - 1 - anomaly.index];
  const date = sess ? (sess.created_at?.toDate?.() || new Date(sess.created_at || 0)).toLocaleDateString() : "—";
  const isHigh = anomaly.direction === "high";
  const color  = isHigh ? "#10b981" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
        {isHigh ? "📈" : "📉"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#e8f0fe" }}>
          {isAr
            ? `${isHigh ? "أداء استثنائي" : "أداء منخفض"} — ${anomaly.value}/100`
            : `${isHigh ? "Exceptional performance" : "Below-average drop"} — ${anomaly.value}/100`}
        </div>
        <div style={{ fontSize: 10, color: "#6b82a6", marginTop: 2 }}>{date}</div>
      </div>
      <div style={{ background: `${color}15`, border: `1px solid ${color}25`, borderRadius: 99, padding: "3px 9px", fontSize: 9, fontWeight: 700, color, textTransform: "uppercase" }}>
        {isAr ? "شذوذ" : "Anomaly"}
      </div>
    </div>
  );
}

// ── Forecast chart ─────────────────────────────────────────────────
function ForecastChart({ historical, predicted, isAr }) {
  if (!historical?.length || !predicted?.length) return null;
  const allVals  = [...historical.slice(-14), ...predicted];
  const maxV     = Math.max(...allVals, 1);
  const histW    = 60;
  const predW    = 40;
  const h        = 70;
  const histPts  = historical.slice(-14).map((v, i) => {
    const x = (i / (historical.slice(-14).length - 1)) * histW;
    const y = ((maxV - v) / maxV) * h;
    return `${x},${y}`;
  }).join(" ");
  const predPts  = predicted.map((v, i) => {
    const x = histW + (i / (predicted.length - 1)) * predW;
    const y = ((maxV - v) / maxV) * h;
    return `${x},${y}`;
  }).join(" ");
  const lastHistX = histW;
  const lastHistV = historical[historical.length - 1] || 0;
  const lastHistY = ((maxV - lastHistV) / maxV) * h;

  return (
    <div style={{ background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#6b82a6", fontWeight: 600 }}>
          <div style={{ width: 16, height: 2, background: "#1a56db", borderRadius: 1 }} />
          {isAr ? "السجل" : "Historical"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#6b82a6", fontWeight: 600 }}>
          <div style={{ width: 16, height: 2, borderRadius: 1, borderTop: "2px dashed #0891b2", background: "none" }} />
          {isAr ? "التوقع" : "Forecast"}
        </div>
      </div>
      <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block" }}>
        <defs>
          <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a56db" stopOpacity=".2" />
            <stop offset="100%" stopColor="#1a56db" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0891b2" stopOpacity=".15" />
            <stop offset="100%" stopColor="#0891b2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={histPts} fill="none" stroke="#1a56db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={`${lastHistX},${lastHistY} ${predPts}`} fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3,2" />
        {/* divider */}
        <line x1={histW} y1="0" x2={histW} y2={h} stroke="rgba(148,163,184,.15)" strokeWidth="1" strokeDasharray="2,2" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 9, color: "#6b82a6" }}>{isAr ? "14 يوم مضت" : "14 days ago"}</span>
        <span style={{ fontSize: 9, color: "#0891b2", fontWeight: 700 }}>
          {isAr ? `توقع: ${predicted[predicted.length - 1]}/100` : `Forecast: ${predicted[predicted.length - 1]}/100`}
        </span>
        <span style={{ fontSize: 9, color: "#6b82a6" }}>+7d</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
export function PredictiveAI({ profile, sessions = [], cs, lang = "en", onClose }) {
  const [tab, setTab]         = useState("burnout");
  const [aiText, setAiText]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const isAr = lang === "ar";

  const allScores = sessions.map(s => s.avg_score || 0).filter(Boolean);
  const avgScore  = avg(allScores);
  const recent14  = allScores.slice(-14);

  // ── Risk Models ──────────────────────────────────────────────────
  const thisWeek  = sessions.filter(s => (Date.now() - (s.created_at?.toDate?.() || new Date(s.created_at || 0))) < 7 * 86400000);
  const weekAvg   = avg(thisWeek.map(s => s.avg_score || 0));

  const burnoutScore = Math.min(100, Math.round(
    (100 - weekAvg) * 0.5 +
    (thisWeek.length > 6 ? 25 : 0) +
    (avgScore < 50 ? 20 : 0) +
    (allScores.length > 0 && allScores[0] < allScores[allScores.length - 1] * 0.8 ? 15 : 0)
  ));

  const anomalies    = detectAnomalies(allScores);
  const fore         = forecast(recent14.length >= 3 ? recent14 : allScores);
  const forecastTrend = fore?.trend || "stable";

  const riskScore = Math.min(100, Math.round(
    (100 - avgScore) * 0.6 +
    (burnoutScore) * 0.3 +
    (anomalies.filter(a => a.direction === "low").length * 5)
  ));

  const system = `You are Corvus's Predictive Intelligence engine. You analyze posture and ergonomics data to generate predictive health insights.
Respond in ${lang === "ar" ? "Arabic" : "English"}. Use markdown formatting. Be concise, data-driven, and actionable. Max 200 words per response.`;

  const prompts = {
    burnout: () => `Analyze burnout risk for this user:
- Burnout risk score: ${burnoutScore}/100
- Average posture score: ${avgScore}/100
- This week's average: ${weekAvg}/100
- Sessions this week: ${thisWeek.length}
- Total sessions: ${sessions.length}

Generate:
## Burnout Risk Assessment
## Warning Indicators (3 bullets)
## Prevention Plan (3 bullets)`,

    anomaly: () => `Analyze ${anomalies.length} posture anomalies detected:
${anomalies.map(a => `- Session ${a.index + 1}: ${a.value}/100 (${a.direction === "high" ? "unusually high" : "unusually low"}, z-score: ${a.z.toFixed(1)})`).join("\n")}
Overall average: ${avgScore}/100

Explain what these anomalies mean and their likely causes:
## What These Anomalies Mean
## Likely Causes
## Action Steps`,

    risk: () => `Generate posture risk scoring analysis:
- Overall risk score: ${riskScore}/100
- Posture average: ${avgScore}/100
- Burnout component: ${burnoutScore}/100
- Anomaly count: ${anomalies.length} detected
- Trend: ${forecastTrend}

Generate:
## Risk Profile Summary
## Highest Risk Areas (3 bullets)
## Risk Mitigation Plan`,

    forecast: () => `Generate 7-day posture performance forecast:
- Recent 14-day average: ${avg(recent14) || avgScore}/100
- Trend direction: ${forecastTrend}
- Predicted 7-day scores: ${fore?.predicted?.join(", ") || "insufficient data"}
- Week-over-week slope: ${fore?.slope?.toFixed(2) || "N/A"}

Generate:
## 7-Day Forecast
## Key Drivers
## How to Improve the Forecast`,
  };

  const loadAI = useCallback(async (key) => {
    if (!sessions.length) return;
    setLoading(true); setError(""); setAiText("");
    try {
      const text = await callGemini(prompts[key]?.() || "", system);
      setAiText(text);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [sessions, avgScore, burnoutScore, anomalies, riskScore, fore, lang]);

  useEffect(() => { loadAI(tab); }, [tab]);

  const TABS = [
    { id: "burnout",  icon: "🔥", en: "Burnout",   ar: "الإرهاق" },
    { id: "anomaly",  icon: "🔍", en: "Anomalies", ar: "الشذوذات" },
    { id: "risk",     icon: "⚠️", en: "Risk Score", ar: "الخطر" },
    { id: "forecast", icon: "🔮", en: "Forecast",  ar: "التوقع" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,8,20,.9)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0c1528", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, width: "min(640px,96vw)", height: "min(720px,94vh)", display: "flex", flexDirection: "column", overflow: "hidden", direction: isAr ? "rtl" : "ltr", boxShadow: "0 24px 80px rgba(0,0,0,.6)", animation: "slideUp 350ms cubic-bezier(0.16,1,0.3,1) both" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#1a56db)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🔮</div>
              <div>
                <div style={{ fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 800, color: "#e8f0fe", letterSpacing: "-0.02em" }}>
                  {isAr ? "الذكاء التنبؤي" : "Predictive AI Engine"}
                </div>
                <div style={{ fontSize: 10, color: "#7c3aed", fontWeight: 600 }}>
                  {isAr ? "توقعات مبنية على بياناتك" : "Pattern detection & forecasting"}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", color: "#6b82a6", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>

          {/* Top risk strip */}
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {[
              { l: isAr ? "خطر الإرهاق" : "Burnout Risk", v: burnoutScore, c: burnoutScore >= 70 ? "#ef4444" : burnoutScore >= 45 ? "#f59e0b" : "#10b981" },
              { l: isAr ? "الخطر العام" : "Overall Risk",  v: riskScore,   c: riskScore >= 70 ? "#ef4444" : riskScore >= 45 ? "#f59e0b" : "#10b981" },
              { l: isAr ? "الاتجاه" : "Trend",             v: forecastTrend === "improving" ? "▲" : forecastTrend === "declining" ? "▼" : "→", c: forecastTrend === "improving" ? "#10b981" : forecastTrend === "declining" ? "#ef4444" : "#60a5fa", raw: true },
              { l: isAr ? "الشذوذات" : "Anomalies",        v: anomalies.length, c: anomalies.length > 3 ? "#ef4444" : anomalies.length > 0 ? "#f59e0b" : "#10b981" },
            ].map((m, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, padding: "6px 12px" }}>
                <div style={{ fontSize: 9, color: "#6b82a6", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{m.l}</div>
                <div style={{ fontFamily: "Syne,sans-serif", fontSize: 15, fontWeight: 800, color: m.c, lineHeight: 1.2 }}>
                  {m.raw ? m.v : `${m.v}${typeof m.v === "number" ? "/100" : ""}`}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,.07)", flexShrink: 0, overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "12px 8px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? "#7c3aed" : "transparent"}`, color: tab === t.id ? "#a78bfa" : "#6b82a6", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "color 150ms", minWidth: 70 }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span>{isAr ? t.ar : t.en}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {sessions.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔮</div>
              <div style={{ fontFamily: "Syne,sans-serif", fontSize: 18, fontWeight: 800, color: "#e8f0fe", marginBottom: 8 }}>
                {isAr ? "لا توجد بيانات للتنبؤ" : "No data for predictions"}
              </div>
              <div style={{ fontSize: 13, color: "#6b82a6" }}>
                {isAr ? "ابدأ جلساتك لتفعيل التنبؤ الذكي" : "Start your sessions to activate predictive AI"}
              </div>
            </div>
          )}

          {/* Burnout */}
          {tab === "burnout" && sessions.length > 0 && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <RiskCard title={isAr ? "خطر الإرهاق" : "Burnout Risk"} score={burnoutScore} icon="🔥" color={burnoutScore >= 70 ? "#ef4444" : burnoutScore >= 45 ? "#f59e0b" : "#10b981"} desc={burnoutScore >= 70 ? (isAr ? "مستوى مرتفع — يُنصح بالراحة" : "High level — rest recommended") : burnoutScore >= 45 ? (isAr ? "مستوى متوسط — انتبه" : "Moderate — monitor closely") : (isAr ? "مستوى آمن — استمر" : "Safe zone — keep it up")} delay={0} />
                <RiskCard title={isAr ? "حصص هذا الأسبوع" : "Weekly Sessions"} score={Math.min(100, thisWeek.length * 14)} icon="📅" color="#60a5fa" desc={`${thisWeek.length} ${isAr ? "جلسة هذا الأسبوع" : "sessions this week"}`} delay={80} />
              </div>
              <AIBlock loading={loading} data={aiText} error={error} onRetry={() => loadAI(tab)} isAr={isAr} accentColor="#7c3aed" />
            </div>
          )}

          {/* Anomalies */}
          {tab === "anomaly" && sessions.length > 0 && (
            <div>
              <div style={{ background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontFamily: "Syne,sans-serif", fontSize: 14, fontWeight: 800, color: "#e8f0fe" }}>
                    {isAr ? `${anomalies.length} شذوذ مكتشف` : `${anomalies.length} anomalies detected`}
                  </div>
                  <div style={{ background: anomalies.length > 0 ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.12)", border: `1px solid ${anomalies.length > 0 ? "rgba(245,158,11,.25)" : "rgba(16,185,129,.25)"}`, borderRadius: 99, padding: "3px 10px", fontSize: 9, fontWeight: 700, color: anomalies.length > 0 ? "#fbbf24" : "#34d399", textTransform: "uppercase" }}>
                    {anomalies.length > 0 ? (isAr ? "يستحق الانتباه" : "Needs attention") : (isAr ? "طبيعي" : "Normal")}
                  </div>
                </div>
                {anomalies.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#6b82a6", textAlign: "center", padding: "20px 0" }}>
                    {isAr ? "✅ لا توجد شذوذات في بياناتك" : "✅ No anomalies detected in your data"}
                  </div>
                ) : (
                  anomalies.slice(0, 5).map((a, i) => <AnomalyItem key={i} anomaly={a} sessions={sessions} isAr={isAr} />)
                )}
              </div>
              <AIBlock loading={loading} data={aiText} error={error} onRetry={() => loadAI(tab)} isAr={isAr} accentColor="#7c3aed" />
            </div>
          )}

          {/* Risk Score */}
          {tab === "risk" && sessions.length > 0 && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <RiskCard title={isAr ? "الخطر الكلي" : "Overall Risk"} score={riskScore} icon="⚠️" color={riskScore >= 70 ? "#ef4444" : riskScore >= 45 ? "#f59e0b" : "#10b981"} desc={isAr ? "مؤشر مركّب" : "Composite risk indicator"} delay={0} />
                <RiskCard title={isAr ? "الشذوذات" : "Anomalies"} score={Math.min(100, anomalies.length * 20)} icon="🔍" color={anomalies.length > 3 ? "#ef4444" : anomalies.length > 0 ? "#f59e0b" : "#10b981"} desc={`${anomalies.length} ${isAr ? "نقطة شاذة" : "detected"}`} delay={80} />
              </div>
              <AIBlock loading={loading} data={aiText} error={error} onRetry={() => loadAI(tab)} isAr={isAr} accentColor="#7c3aed" />
            </div>
          )}

          {/* Forecast */}
          {tab === "forecast" && sessions.length > 0 && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <ForecastChart historical={recent14.length >= 3 ? recent14 : allScores.slice(-14)} predicted={fore?.predicted || []} isAr={isAr} />
              </div>
              {fore && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    { l: isAr ? "الاتجاه" : "Trend",      v: forecastTrend === "improving" ? (isAr ? "تحسن" : "Improving") : forecastTrend === "declining" ? (isAr ? "تراجع" : "Declining") : (isAr ? "مستقر" : "Stable"), c: forecastTrend === "improving" ? "#10b981" : forecastTrend === "declining" ? "#ef4444" : "#60a5fa" },
                    { l: isAr ? "توقع 7 أيام" : "7-Day Est", v: fore.predicted?.[6] ? `${fore.predicted[6]}/100` : "—", c: fore.predicted?.[6] ? (fore.predicted[6] >= 75 ? "#10b981" : fore.predicted[6] >= 50 ? "#f59e0b" : "#ef4444") : "#6b82a6" },
                    { l: isAr ? "الانحدار" : "Slope",      v: fore.slope >= 0 ? `+${fore.slope.toFixed(1)}` : fore.slope.toFixed(1), c: fore.slope >= 0 ? "#10b981" : "#ef4444" },
                  ].map((m, i) => (
                    <div key={i} style={{ background: "rgba(15,30,54,.85)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "12px 14px", textAlign: "center", animation: `fadeIn 300ms ${i * 70}ms both` }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#6b82a6", marginBottom: 6 }}>{m.l}</div>
                      <div style={{ fontFamily: "Syne,sans-serif", fontSize: 18, fontWeight: 800, color: m.c }}>{m.v}</div>
                    </div>
                  ))}
                </div>
              )}
              <AIBlock loading={loading} data={aiText} error={error} onRetry={() => loadAI(tab)} isAr={isAr} accentColor="#7c3aed" />
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

function AIBlock({ loading, data, error, onRetry, isAr, accentColor = "#1a56db" }) {
  return (
    <div style={{ background: `rgba(124,58,237,.06)`, border: "1px solid rgba(124,58,237,.15)", borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: 7, background: `linear-gradient(135deg,${accentColor},#1a56db)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>🧠</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {isAr ? "تحليل الذكاء التنبؤي" : "Predictive AI Analysis"}
        </span>
        {loading && <span style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
          {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: accentColor, display: "inline-block", animation: `blink 1.2s ${i*.2}s infinite` }} />)}
          <style>{`@keyframes blink{0%,80%,100%{opacity:.3}40%{opacity:1}}`}</style>
        </span>}
      </div>
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[100,85,70].map((w,i) => <div key={i} style={{ height: 12, borderRadius: 6, width: `${w}%`, background: "rgba(124,58,237,.1)", animation: `pulse 1.5s ${i*.1}s infinite` }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.9}}`}</style>
        </div>
      )}
      {!loading && data && <div style={{ fontSize: 13, color: "#b0c4de", lineHeight: 1.7 }}><MdText text={data} /></div>}
      {!loading && error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#f87171" }}>⚠ {error}</span>
          <button onClick={onRetry} style={{ background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.3)", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#a78bfa", cursor: "pointer" }}>
            {isAr ? "⟳ أعد" : "⟳ Retry"}
          </button>
        </div>
      )}
    </div>
  );
}
