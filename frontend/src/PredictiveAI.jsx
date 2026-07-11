/**
 * Corvus — Predictive AI Engine v2.0
 * Typography + layout overhaul: consistent font scale, spacing, hierarchy
 */
import { useState, useEffect, useCallback } from "react";
import { geminiAnalysis } from "./gemini.js";
import { getCached, setCache } from "./aiPreloader.js";

async function callGemini(prompt, system, maxTokens = 900) {
  try {
    return await geminiAnalysis(prompt, { systemPrompt: system, maxTokens });
  } catch (e) { throw e; }
}

// ── Design tokens (consistent across entire component) ─────────────
const TOKENS = {
  // Font sizes — strict 3-level hierarchy
  xs:   9.5,   // metadata, labels, badges
  sm:   11.5,  // secondary text, hints
  base: 13.5,  // body text
  md:   15,    // card values, section titles
  lg:   20,    // primary numbers
  xl:   28,    // hero numbers

  // Font weights
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 800,

  // Spacing (multiples of 4px)
  sp1: 4, sp2: 8, sp3: 12, sp4: 16, sp5: 20, sp6: 24,

  // Colors — consistent palette
  text:     "#e2eaf6",      // primary text
  textSub:  "#94a3b8",      // secondary text
  textMuted:"#5a7090",      // muted/disabled
  accent:   "#7c3aed",      // purple accent
  accentL:  "#a78bfa",      // light purple
  border:   "rgba(255,255,255,.07)",
  borderM:  "rgba(255,255,255,.12)",
  surface:  "rgba(15,28,50,.9)",
  surfaceL: "rgba(255,255,255,.04)",
};

const riskColor = v => v >= 70 ? "#ef4444" : v >= 45 ? "#f59e0b" : "#10b981";

// Inline markdown — NO T. references (avoids minifier collision)
function inlineMdP(t) {
  return (t||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e2eaf6;font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#94a3b8">$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(124,58,237,.15);padding:1px 6px;border-radius:4px;font-size:.88em;font-family:monospace;color:#c4b5fd">$1</code>');
}

function MdText({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  const il = inlineMdP;
  let firstH2 = true;

  while (i < lines.length) {
    const l = lines[i].trim();

    // ## Section heading — card-like with left accent border
    if (l.startsWith("## ")) {
      const marginTop = firstH2 ? '4px' : '20px';
      firstH2 = false;
      out.push(
        '<div style="margin:' + marginTop + ' 0 10px;display:flex;align-items:center;gap:10px">' +
          '<div style="width:3px;height:18px;background:linear-gradient(180deg,#7c3aed,#a78bfa);border-radius:99px;flex-shrink:0"></div>' +
          '<span style="font-size:13.5px;font-weight:700;color:#e2eaf6;letter-spacing:-.01em">' + il(l.slice(3)) + '</span>' +
        '</div>'
      );
    }
    // ### Sub-section label
    else if (l.startsWith("### ")) {
      out.push('<div style="font-size:10px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.1em;margin:14px 0 6px;opacity:.9">' + il(l.slice(4)) + '</div>');
    }
    // Numbered list — pill number badge
    else if (/^\d+\.\s/.test(l)) {
      const m = l.match(/^(\d+)\.\s(.+)$/);
      const num = m ? m[1] : '1';
      const rest = m ? m[2] : l;
      out.push(
        '<div style="display:flex;gap:10px;margin:7px 0;align-items:flex-start">' +
          '<span style="background:rgba(124,58,237,.2);color:#a78bfa;font-weight:700;font-size:11px;min-width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">' + num + '</span>' +
          '<span style="color:#cbd5e1;line-height:1.65;font-size:13px">' + il(rest) + '</span>' +
        '</div>'
      );
    }
    // Bullet list
    else if (/^[-•*]\s/.test(l)) {
      out.push(
        '<div style="display:flex;gap:10px;margin:5px 0;align-items:flex-start">' +
          '<span style="color:#7c3aed;font-size:16px;line-height:1;flex-shrink:0;margin-top:1px">·</span>' +
          '<span style="color:#cbd5e1;line-height:1.65;font-size:13px">' + il(l.slice(2)) + '</span>' +
        '</div>'
      );
    }
    // Table
    else if (l.startsWith("|")) {
      const tbl = [l];
      while (i+1 < lines.length && lines[i+1].trim().startsWith("|")) { i++; tbl.push(lines[i].trim()); }
      const rows = tbl.filter(r => !/^[\s|:-]+$/.test(r));
      if (rows.length >= 2) {
        const hdrs = rows[0].split("|").filter((_,j,a)=>j>0&&j<a.length-1).map(h=>h.trim());
        const drows = rows.slice(1);
        const ths = hdrs.map(h=>'<th style="padding:8px 12px;text-align:left;background:rgba(124,58,237,.12);color:#a78bfa;font-weight:600;font-size:12px;border-bottom:1px solid rgba(124,58,237,.2)">' + il(h) + '</th>').join('');
        const tds = drows.map((row,ri)=>{
          const cells = row.split("|").filter((_,j,a)=>j>0&&j<a.length-1).map(c=>c.trim());
          return '<tr style="background:' + (ri%2===0?'rgba(255,255,255,.02)':'transparent') + '">' +
            cells.map(c=>'<td style="padding:7px 12px;border-bottom:1px solid rgba(255,255,255,.04);color:#94a3b8;font-size:12.5px">' + il(c) + '</td>').join('') + '</tr>';
        }).join('');
        out.push('<div style="overflow-x:auto;margin:10px 0;border-radius:8px;overflow:hidden;border:1px solid rgba(124,58,237,.15)"><table style="width:100%;border-collapse:collapse"><thead><tr>' + ths + '</tr></thead><tbody>' + tds + '</tbody></table></div>');
      }
    }
    // Warning / red flag
    else if (l.startsWith("⚕️") || l.startsWith("⚠️")) {
      out.push('<div style="background:rgba(239,68,68,.07);border:0.5px solid rgba(239,68,68,.2);border-radius:8px;padding:10px 14px;margin:10px 0;font-size:12.5px;color:#fca5a5;line-height:1.6;display:flex;gap:8px;align-items:flex-start">' + il(l) + '</div>');
    }
    // Empty line
    else if (l === "") {
      out.push('<div style="height:4px"></div>');
    }
    // Normal paragraph
    else {
      out.push('<p style="margin:3px 0 6px;line-height:1.7;color:#94a3b8;font-size:13px">' + il(l) + '</p>');
    }
    i++;
  }
  return (
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", padding:'2px 0' }}
         dangerouslySetInnerHTML={{ __html: out.join("") }} />
  );
}

function avg(arr) { return arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0; }

function detectAnomalies(scores) {
  if (scores.length < 5) return [];
  const m  = avg(scores);
  const sd = Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - m, 2), 0) / scores.length);
  return scores.map((v, i) => ({
    index: i, value: v,
    z: sd > 0 ? Math.abs((v - m) / sd) : 0,
    isAnomaly: sd > 0 && Math.abs((v - m) / sd) > 1.8,
    direction: v > m ? "high" : "low",
  })).filter(p => p.isAnomaly);
}

function forecast(scores, days = 7) {
  if (!scores || scores.length < 3) return null;
  const n = scores.length;
  const xMean = (n - 1) / 2;
  const yMean = avg(scores);
  const num = scores.reduce((s, y, x) => s + (x - xMean) * (y - yMean), 0);
  const den = scores.reduce((s, _, x) => s + Math.pow(x - xMean, 2), 0);
  const slope = den ? num / den : 0;
  const intercept = yMean - slope * xMean;
  const predicted = Array.from({ length: days }, (_, i) =>
    Math.round(Math.max(0, Math.min(100, intercept + slope * (n + i))))
  );
  const trend = slope > 0.3 ? "improving" : slope < -0.3 ? "declining" : "stable";
  return { slope: Math.round(slope * 100) / 100, predicted, trend };
}

// ── Metric chip ─────────────────────────────────────────────────────
function MetricChip({ label, value, color, raw }) {
  return (
    <div style={{
      background: TOKENS.surfaceL, border: `1px solid ${TOKENS.border}`,
      borderRadius: 10, padding: `${TOKENS.sp2}px ${TOKENS.sp3}px`,
      flex: "1 1 auto", minWidth: 72,
    }}>
      <div style={{ fontSize: TOKENS.xs, color: TOKENS.textMuted, fontWeight: TOKENS.bold,
        letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: TOKENS.md, fontWeight: TOKENS.black, color, lineHeight: 1 }}>
        {raw ? value : `${value}/100`}
      </div>
    </div>
  );
}

// ── Risk card ────────────────────────────────────────────────────────
function RiskCard({ title, score, icon, color, desc }) {
  const pct = typeof score === "number" ? score : 0;
  return (
    <div style={{
      background: TOKENS.surface, border: `1px solid ${TOKENS.border}`,
      borderRadius: 14, padding: TOKENS.sp4, display: "flex", flexDirection: "column", gap: TOKENS.sp3,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: TOKENS.sp2 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: TOKENS.sm, fontWeight: TOKENS.bold, color: TOKENS.textSub,
          textTransform: "uppercase", letterSpacing: ".06em" }}>
          {title}
        </span>
      </div>
      <div style={{ fontSize: TOKENS.xl, fontWeight: TOKENS.black, color, lineHeight: 1 }}>
        {pct}
        <span style={{ fontSize: TOKENS.sm, fontWeight: TOKENS.medium, color: TOKENS.textMuted,
          marginLeft: 3 }}>/100</span>
      </div>
      {/* Progress bar */}
      <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 99,
          background: color, transition: "width .6s cubic-bezier(.16,1,.3,1)",
        }} />
      </div>
      <div style={{ fontSize: TOKENS.sm, color: TOKENS.textSub, lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

// ── Anomaly row ──────────────────────────────────────────────────────
function AnomalyRow({ anomaly, sessions, isAr }) {
  const sess = sessions[sessions.length - 1 - anomaly.index];
  const date = sess
    ? (sess.created_at?.toDate?.() || new Date(sess.created_at || 0))
        .toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric" })
    : "—";
  const isHigh = anomaly.direction === "high";
  const color  = isHigh ? "#10b981" : "#ef4444";
  // T removed — using TOKENS directly
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: TOKENS.sp3,
      padding: `${TOKENS.sp3}px 0`, borderBottom: `1px solid ${TOKENS.border}`,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      }}>
        {isHigh ? "📈" : "📉"}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: TOKENS.base, fontWeight: TOKENS.semibold, color: TOKENS.text, lineHeight: 1.3 }}>
          {isAr
            ? `${isHigh ? "أداء استثنائي" : "انخفاض ملحوظ"} — ${anomaly.value}/100`
            : `${isHigh ? "Exceptional session" : "Below-average drop"} — ${anomaly.value}/100`}
        </div>
        <div style={{ fontSize: TOKENS.xs, color: TOKENS.textMuted, marginTop: 3 }}>
          {date} · {isAr ? `Z-score: ${anomaly.z.toFixed(1)}` : `z-score ${anomaly.z.toFixed(1)}`}
        </div>
      </div>
      <div style={{
        background: `${color}18`, border: `1px solid ${color}30`,
        borderRadius: 99, padding: "3px 10px",
        fontSize: TOKENS.xs, fontWeight: TOKENS.bold, color,
        textTransform: "uppercase", letterSpacing: ".05em",
      }}>
        {isAr ? "شذوذ" : "Anomaly"}
      </div>
    </div>
  );
}

// ── Forecast chart ───────────────────────────────────────────────────
function ForecastChart({ historical, predicted, isAr }) {
  if (!historical?.length || !predicted?.length) return null;
  const all   = [...historical.slice(-14), ...predicted];
  const maxV  = Math.max(...all, 1);
  const minV  = Math.max(0, Math.min(...all) - 5);
  const range = maxV - minV || 1;
  const H = 80, histW = 60, predW = 40;

  const pt = (v, i, total, startX = 0) => {
    const x = startX + (i / Math.max(total - 1, 1)) * (i < total - 1 || startX === 0 ? (startX === 0 ? histW : predW) : predW);
    const y = H - ((v - minV) / range) * H;
    return `${x},${y}`;
  };

  const hist14 = historical.slice(-14);
  const histPts = hist14.map((v, i) => pt(v, i, hist14.length, 0)).join(" ");
  const lastX   = histW;
  const lastY   = H - ((hist14[hist14.length - 1] - minV) / range) * H;
  const predPts = predicted.map((v, i) => {
    const x = histW + (i / Math.max(predicted.length - 1, 1)) * predW;
    const y = H - ((v - minV) / range) * H;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`,
      borderRadius: 14, padding: TOKENS.sp4 }}>

      {/* Legend */}
      <div style={{ display: "flex", gap: TOKENS.sp4, marginBottom: TOKENS.sp3 }}>
        {[
          { color: "#1a56db", label: isAr ? "السجل" : "Historical", dashed: false },
          { color: "#0891b2", label: isAr ? "التوقع" : "Forecast",   dashed: true },
        ].map(({ color, label, dashed }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: TOKENS.sp2 }}>
            <svg width={20} height={8} viewBox="0 0 20 8">
              <line x1="0" y1="4" x2="20" y2="4" stroke={color} strokeWidth="2"
                strokeDasharray={dashed ? "4,3" : "none"} strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: TOKENS.xs, color: TOKENS.textSub, fontWeight: TOKENS.semibold }}>{label}</span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none"
        style={{ width: "100%", height: H, display: "block" }}>
        {/* Reference lines */}
        {[60, 80].map(ref => {
          const y = H - ((ref - minV) / range) * H;
          return <line key={ref} x1="0" y1={y} x2="100" y2={y}
            stroke={ref >= 80 ? "rgba(16,185,129,.18)" : "rgba(245,158,11,.18)"}
            strokeWidth=".6" strokeDasharray="3,3" />;
        })}
        {/* Historical line */}
        <polyline points={histPts} fill="none" stroke="#1a56db"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Forecast line */}
        <polyline points={`${lastX},${lastY} ${predPts}`} fill="none"
          stroke="#0891b2" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" strokeDasharray="4,3" />
        {/* Divider */}
        <line x1={histW} y1="0" x2={histW} y2={H}
          stroke="rgba(148,163,184,.2)" strokeWidth=".8" strokeDasharray="3,3" />
      </svg>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: TOKENS.sp2 }}>
        <span style={{ fontSize: TOKENS.xs, color: TOKENS.textMuted }}>
          {isAr ? "14 يوم مضت" : "14 days ago"}
        </span>
        <span style={{ fontSize: TOKENS.xs, color: "#0891b2", fontWeight: TOKENS.bold }}>
          {isAr
            ? `التوقع بعد 7 أيام: ${predicted[predicted.length - 1]}/100`
            : `7-day forecast: ${predicted[predicted.length - 1]}/100`}
        </span>
        <span style={{ fontSize: TOKENS.xs, color: TOKENS.textMuted }}>+7d</span>
      </div>
    </div>
  );
}

// ── AI output block ──────────────────────────────────────────────────
function AIBlock({ loading, data, error, onRetry, isAr }) {
  return (
    <div style={{
      background: "rgba(124,58,237,.05)", border: "1px solid rgba(124,58,237,.18)",
      borderRadius: 14, padding: TOKENS.sp4,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: TOKENS.sp2, marginBottom: TOKENS.sp3 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: "linear-gradient(135deg,#7c3aed,#1a56db)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13,
        }}>🧠</div>
        <span style={{ fontSize: TOKENS.sm, fontWeight: TOKENS.bold, color: TOKENS.accentL,
          letterSpacing: ".05em", textTransform: "uppercase" }}>
          {isAr ? "تحليل الذكاء التنبؤي" : "Predictive AI Analysis"}
        </span>
        {loading && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: TOKENS.accent, display: "inline-block",
                animation: `blink 1.2s ${i * .2}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Skeleton */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: TOKENS.sp2 }}>
          {[100, 82, 65].map((w, i) => (
            <div key={i} style={{
              height: 11, borderRadius: 6, width: `${w}%`,
              background: "rgba(124,58,237,.12)",
              animation: `pulse 1.5s ${i * .15}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Content */}
      {!loading && data && <MdText text={data} />}

      {/* Error */}
      {!loading && error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: TOKENS.sp3 }}>
          <span style={{ fontSize: TOKENS.base, color: "#f87171" }}>⚠ {error}</span>
          <button onClick={onRetry} style={{
            background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.3)",
            borderRadius: 8, padding: `${TOKENS.sp1}px ${TOKENS.sp3}px`,
            fontSize: TOKENS.sm, fontWeight: TOKENS.bold, color: TOKENS.accentL, cursor: "pointer",
          }}>
            {isAr ? "⟳ أعد المحاولة" : "⟳ Retry"}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
export function PredictiveAI({ profile, sessions = [], cs, lang = "en", onClose , effectiveTier, uid = ""}) {
  const [tab, setTab]         = useState("burnout");
  const [aiText, setAiText]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const isAr = lang === "ar";

  const allScores = sessions.map(s => s.avg_score || 0).filter(Boolean);
  const avgScore  = avg(allScores);
  const recent14  = allScores.slice(-14);

  const thisWeek = sessions.filter(s =>
    (Date.now() - (s.created_at?.toDate?.() || new Date(s.created_at || 0))) < 7 * 86400000
  );
  const weekAvg = avg(thisWeek.map(s => s.avg_score || 0));

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
    burnoutScore * 0.3 +
    anomalies.filter(a => a.direction === "low").length * 5
  ));

  const system = `You are Dr. Corvus — the clinical AI physiotherapist and predictive health engine inside Corvus PostureAI Pro.

ROLE: Generate evidence-based predictive health insights from posture analytics data.

CLINICAL KNOWLEDGE:
- Hansraj (2014): cervical load increases exponentially with neck flexion — at 45° = 22kg (5× neutral)
- Nachemson disc pressure: sustained sitting = 140% vs standing; poor posture accelerates disc degeneration
- Burnout-MSK link: occupational burnout correlates with 2.3× higher MSK injury risk (Holtermann 2018)
- NIOSH: fatigue accumulation without recovery = progressive musculoskeletal deconditioning

PATIENT DATA:
- Overall posture score: ${avgScore}/100 (${avgScore >= 85 ? "Excellent" : avgScore >= 70 ? "Good" : avgScore >= 55 ? "Fair" : "Needs Attention"})
- This week: ${weekAvg}/100 | Total sessions: ${sessions.length} | This week: ${thisWeek?.length || 0}
- Burnout risk: ${burnoutScore}% | Risk score: ${riskScore}/100

RESPONSE STANDARDS:
- Use ## headers, **bold** clinical terms, numbered or bulleted lists
- Always reference the specific numbers — never speak in generalities
- Give precise interventions: what, why, how, expected timeframe
- Flag ⚕️ any findings needing professional attention
${lang === "ar" ? "LANGUAGE: Respond ENTIRELY in Egyptian Arabic (عامية مصرية)." : "LANGUAGE: Respond in clear, professional English."}`;

  const prompts = {
    burnout: () => `Burnout & fatigue analysis for ${sessions.length} sessions.
Data: burnout=${burnoutScore}%, posture avg=${avgScore}/100, this week=${weekAvg}/100, sessions this week=${thisWeek.length}

YOU MUST USE EXACTLY THIS STRUCTURE (use ## for section headers):

## Burnout Assessment
[2 sentences: interpret ${burnoutScore}% clinically. What does this mean for MSK health?]

## Warning Signs
1. [specific warning with clinical mechanism]
2. [specific warning with clinical mechanism]
3. [specific warning with clinical mechanism]

## Recovery Protocol
1. [specific action with duration/frequency]
2. [specific action with duration/frequency]
3. [specific action with duration/frequency]

## Timeline
[When to expect improvement with consistent protocol]

Max 220 words. Start immediately — no preamble.`,

    anomaly: () => `Analyze ${anomalies.length} posture anomalies detected in sessions.
Data: ${anomalies.map(a => `Session ${a.index+1}: ${a.value}/100 (${a.direction==="high"?"HIGH":"LOW"}, z=${a.z.toFixed(1)})`).join(", ")}
Overall avg: ${avgScore}/100

YOU MUST USE EXACTLY THIS STRUCTURE:

## What These Anomalies Mean
[Clinical interpretation — what z-scores indicate about postural instability]

## Root Causes
1. [specific cause]
2. [specific cause]
3. [specific cause]

## Correction Protocol
1. [specific action]
2. [specific action]
3. [specific action]

Max 200 words. Start immediately.`,

    risk: () => `Posture risk analysis.
Data: risk score=${riskScore}/100, burnout=${burnoutScore}%, anomalies=${anomalies.length}, trend=${forecastTrend}

YOU MUST USE EXACTLY THIS STRUCTURE:

## Risk Profile
[Overall risk interpretation — what ${riskScore}/100 means clinically]

## Highest Risk Areas
1. [specific risk + consequence]
2. [specific risk + consequence]
3. [specific risk + consequence]

## Mitigation Plan
1. [specific action + timeline]
2. [specific action + timeline]
3. [specific action + timeline]

Max 200 words. Start immediately.`,

    forecast: () => `7-day posture forecast.
Data: 14-day avg=${avg(recent14)||avgScore}/100, trend=${forecastTrend}, predicted=${fore?.predicted?.join(", ")||"insufficient data"}

YOU MUST USE EXACTLY THIS STRUCTURE:

## 7-Day Forecast
[Interpret the trend: ${forecastTrend}. What score range is expected?]

## Key Drivers
1. [driver affecting trajectory]
2. [driver affecting trajectory]

## How to Improve Forecast
1. [specific daily action]
2. [specific daily action]
3. [specific daily action]

Max 180 words. Start immediately.`,
  };

  const loadAI = useCallback(async (key) => {
    if (!sessions.length) return;
    const cacheTabKey = `predictive_${key}`;
    const cached = uid ? getCached(uid, cacheTabKey, lang) : null;
    if (cached) { setAiText(cached); return; }
    setLoading(true); setError(""); setAiText("");
    try {
      const text = await callGemini(prompts[key]?.() || "", system);
      if (text && uid) setCache(uid, cacheTabKey, lang, text);
      setAiText(text);
    }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [sessions.length, avgScore, burnoutScore, riskScore, fore?.trend, lang, profile]);

  useEffect(() => { loadAI(tab); }, [tab]);

  const TABS = [
    { id: "burnout",  icon: "🔥", en: "Burnout",   ar: "الإرهاق"  },
    { id: "anomaly",  icon: "🔍", en: "Anomalies", ar: "الشذوذات" },
    { id: "risk",     icon: "⚠️", en: "Risk",      ar: "الخطر"    },
    { id: "forecast", icon: "🔮", en: "Forecast",  ar: "التوقع"   },
  ];

  const trendLabel = forecastTrend === "improving"
    ? (isAr ? "تحسن ▲" : "Improving ▲")
    : forecastTrend === "declining"
    ? (isAr ? "تراجع ▼" : "Declining ▼")
    : (isAr ? "مستقر →" : "Stable →");
  const trendColor = forecastTrend === "improving" ? "#10b981" : forecastTrend === "declining" ? "#ef4444" : "#60a5fa";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(2,8,20,.88)", backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)", zIndex: 9100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#0b1525", border: `1px solid ${TOKENS.border}`,
        borderRadius: 20, width: "min(660px,96vw)", height: "min(740px,94vh)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        direction: isAr ? "rtl" : "ltr",
        boxShadow: "0 32px 80px rgba(0,0,0,.7)",
        animation: "slideUp 320ms cubic-bezier(0.16,1,0.3,1) both",
      }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{
          padding: `${TOKENS.sp4}px ${TOKENS.sp5}px`, flexShrink: 0,
          borderBottom: `1px solid ${TOKENS.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: TOKENS.sp4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: TOKENS.sp3 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: "linear-gradient(135deg,#7c3aed,#1a56db)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>🔮</div>
              <div>
                <div style={{ fontSize: TOKENS.md, fontWeight: TOKENS.black, color: TOKENS.text,
                  letterSpacing: "-.02em", fontFamily: "Syne,sans-serif" }}>
                  {isAr ? "الذكاء التنبؤي" : "Predictive AI Engine"}
                </div>
                <div style={{ fontSize: TOKENS.xs, color: TOKENS.accentL, fontWeight: TOKENS.semibold, marginTop: 2 }}>
                  {isAr ? "توقعات مبنية على أنماط بياناتك" : "Pattern detection & performance forecasting"}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: TOKENS.surfaceL, border: `1px solid ${TOKENS.border}`,
              color: TOKENS.textSub, cursor: "pointer", fontSize: 15,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>

          {/* Metric chips */}
          <div style={{ display: "flex", gap: TOKENS.sp2, flexWrap: "wrap" }}>
            <MetricChip label={isAr ? "خطر الإرهاق" : "Burnout Risk"}
              value={burnoutScore} color={riskColor(burnoutScore)} />
            <MetricChip label={isAr ? "الخطر العام" : "Overall Risk"}
              value={riskScore}   color={riskColor(riskScore)} />
            <MetricChip label={isAr ? "الاتجاه" : "Trend"}
              value={trendLabel}  color={trendColor} raw />
            <MetricChip label={isAr ? "الشذوذات" : "Anomalies"}
              value={anomalies.length}
              color={anomalies.length > 3 ? "#ef4444" : anomalies.length > 0 ? "#f59e0b" : "#10b981"}
              raw />
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <div style={{
          display: "flex", borderBottom: `1px solid ${TOKENS.border}`,
          flexShrink: 0, overflowX: "auto",
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: `${TOKENS.sp3}px ${TOKENS.sp2}px`,
              background: "none", border: "none",
              borderBottom: `2px solid ${tab === t.id ? TOKENS.accent : "transparent"}`,
              color: tab === t.id ? TOKENS.accentL : TOKENS.textMuted,
              fontSize: TOKENS.sm, fontWeight: tab === t.id ? TOKENS.bold : TOKENS.medium,
              cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", gap: TOKENS.sp1, transition: "color 150ms",
              minWidth: 72,
            }}>
              <span style={{ fontSize: 17 }}>{t.icon}</span>
              <span>{isAr ? t.ar : t.en}</span>
            </button>
          ))}
        </div>

        {/* ── Content ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: TOKENS.sp5 }}>

          {/* Empty state */}
          {sessions.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 52, marginBottom: TOKENS.sp4 }}>🔮</div>
              <div style={{ fontSize: TOKENS.md, fontWeight: TOKENS.black, color: TOKENS.text,
                marginBottom: TOKENS.sp2, fontFamily: "Syne,sans-serif" }}>
                {isAr ? "لا توجد بيانات للتنبؤ" : "No data for predictions"}
              </div>
              <div style={{ fontSize: TOKENS.base, color: TOKENS.textSub }}>
                {isAr ? "أكمل بعض الجلسات لتفعيل الذكاء التنبؤي" : "Complete a few sessions to activate predictive AI"}
              </div>
            </div>
          )}

          {/* Burnout tab */}
          {tab === "burnout" && sessions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: TOKENS.sp4 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: TOKENS.sp3 }}>
                <RiskCard
                  title={isAr ? "خطر الإرهاق" : "Burnout Risk"}
                  score={burnoutScore} icon="🔥"
                  color={riskColor(burnoutScore)}
                  desc={burnoutScore >= 70
                    ? (isAr ? "مستوى مرتفع — يُنصح بالراحة" : "High — rest recommended")
                    : burnoutScore >= 45
                    ? (isAr ? "مستوى متوسط — راقب نفسك" : "Moderate — monitor closely")
                    : (isAr ? "مستوى آمن — استمر" : "Safe zone — keep it up")} />
                <RiskCard
                  title={isAr ? "جلسات الأسبوع" : "Weekly Sessions"}
                  score={Math.min(100, thisWeek.length * 14)} icon="📅"
                  color="#60a5fa"
                  desc={`${thisWeek.length} ${isAr ? "جلسة هذا الأسبوع" : "sessions this week"}`} />
              </div>
              <AIBlock loading={loading} data={aiText} error={error}
                onRetry={() => loadAI(tab)} isAr={isAr} />
            </div>
          )}

          {/* Anomalies tab */}
          {tab === "anomaly" && sessions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: TOKENS.sp4 }}>
              <div style={{
                background: TOKENS.surface, border: `1px solid ${TOKENS.border}`,
                borderRadius: 14, padding: TOKENS.sp4,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: TOKENS.sp3 }}>
                  <div style={{ fontSize: TOKENS.base, fontWeight: TOKENS.bold, color: TOKENS.text }}>
                    {isAr ? `${anomalies.length} شذوذ مكتشف` : `${anomalies.length} anomalies detected`}
                  </div>
                  <div style={{
                    background: anomalies.length > 0 ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.12)",
                    border: `1px solid ${anomalies.length > 0 ? "rgba(245,158,11,.3)" : "rgba(16,185,129,.3)"}`,
                    borderRadius: 99, padding: "3px 10px",
                    fontSize: TOKENS.xs, fontWeight: TOKENS.bold,
                    color: anomalies.length > 0 ? "#fbbf24" : "#34d399",
                    textTransform: "uppercase", letterSpacing: ".05em",
                  }}>
                    {anomalies.length > 0 ? (isAr ? "يستحق الانتباه" : "Needs attention") : (isAr ? "طبيعي" : "Normal")}
                  </div>
                </div>
                {anomalies.length === 0
                  ? <div style={{ fontSize: TOKENS.base, color: TOKENS.textSub, textAlign: "center", padding: "20px 0" }}>
                      {isAr ? "✅ لا توجد شذوذات في بياناتك" : "✅ No anomalies detected in your data"}
                    </div>
                  : anomalies.slice(0, 5).map((a, i) =>
                      <AnomalyRow key={i} anomaly={a} sessions={sessions} isAr={isAr} />)
                }
              </div>
              <AIBlock loading={loading} data={aiText} error={error}
                onRetry={() => loadAI(tab)} isAr={isAr} />
            </div>
          )}

          {/* Risk tab */}
          {tab === "risk" && sessions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: TOKENS.sp4 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: TOKENS.sp3 }}>
                <RiskCard
                  title={isAr ? "الخطر الكلي" : "Overall Risk"}
                  score={riskScore} icon="⚠️"
                  color={riskColor(riskScore)}
                  desc={isAr ? "مؤشر مركّب من وضعيتك وأنماط بياناتك" : "Composite: posture + burnout + anomalies"} />
                <RiskCard
                  title={isAr ? "الشذوذات" : "Anomaly Weight"}
                  score={Math.min(100, anomalies.length * 20)} icon="🔍"
                  color={anomalies.length > 3 ? "#ef4444" : anomalies.length > 0 ? "#f59e0b" : "#10b981"}
                  desc={`${anomalies.length} ${isAr ? "نقطة شاذة مكتشفة" : "anomalous sessions detected"}`} />
              </div>
              <AIBlock loading={loading} data={aiText} error={error}
                onRetry={() => loadAI(tab)} isAr={isAr} />
            </div>
          )}

          {/* Forecast tab */}
          {tab === "forecast" && sessions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: TOKENS.sp4 }}>
              <ForecastChart
                historical={recent14.length >= 3 ? recent14 : allScores.slice(-14)}
                predicted={fore?.predicted || []} isAr={isAr} />

              {fore && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: TOKENS.sp2 }}>
                  {[
                    {
                      l: isAr ? "الاتجاه" : "Trend",
                      v: trendLabel, c: trendColor,
                    },
                    {
                      l: isAr ? "توقع 7 أيام" : "7-Day Est.",
                      v: fore.predicted?.[6] ? `${fore.predicted[6]}/100` : "—",
                      c: fore.predicted?.[6]
                        ? riskColor(100 - fore.predicted[6])
                        : TOKENS.textMuted,
                    },
                    {
                      l: isAr ? "الميل اليومي" : "Daily Slope",
                      v: fore.slope >= 0 ? `+${fore.slope.toFixed(1)}` : fore.slope.toFixed(1),
                      c: fore.slope >= 0 ? "#10b981" : "#ef4444",
                    },
                  ].map((m, i) => (
                    <div key={i} style={{
                      background: TOKENS.surface, border: `1px solid ${TOKENS.border}`,
                      borderRadius: 12, padding: `${TOKENS.sp3}px ${TOKENS.sp4}px`,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: TOKENS.xs, fontWeight: TOKENS.bold, color: TOKENS.textMuted,
                        letterSpacing: ".07em", textTransform: "uppercase", marginBottom: TOKENS.sp2 }}>
                        {m.l}
                      </div>
                      <div style={{ fontSize: TOKENS.lg, fontWeight: TOKENS.black, color: m.c,
                        fontFamily: "Syne,sans-serif" }}>
                        {m.v}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <AIBlock loading={loading} data={aiText} error={error}
                onRetry={() => loadAI(tab)} isAr={isAr} />
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes slideUp  { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:none } }
        @keyframes blink    { 0%,80%,100% { opacity:.25 } 40% { opacity:1 } }
        @keyframes pulse    { 0%,100% { opacity:.35 } 50% { opacity:.8 } }
      `}</style>
    </div>
  );
}
