/**
 * Corvus — Predictive AI Engine v2.0
 * Typography + layout overhaul: consistent font scale, spacing, hierarchy
 */
import { useState, useEffect, useCallback } from "react";
import { geminiAnalysis } from "./gemini.js";
import { getCached, setCache } from "./aiPreloader.js";
import { SymptomAPI } from "./services/api.js";
import { updateUserProfile } from "./firebase.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";
import { tierAtLeast } from "./lib/tierQuality.js";
import { weekKey } from "./lib/exercisePlanLib.js";

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

// ── Weekly Preventive Forecast ───────────────────────────────────
// Different from the general trend Forecast tab above — this looks for
// a SPECIFIC recurring day-of-week x time-of-day x body-region pattern,
// not just an overall trajectory. "Next week, ~62% chance of right
// shoulder discomfort Wednesday after 3pm" instead of "your score is
// trending down".
const WEEKDAY_LABELS = {
  en: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
  ar: ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"],
};
const DAY_PART = {
  morning:   { en: "morning",   ar: "الصبح",    range: [6, 12] },
  afternoon: { en: "afternoon", ar: "بعد الضهر", range: [12, 17] },
  evening:   { en: "evening",   ar: "بالليل",    range: [17, 21] },
  night:     { en: "late night",ar: "بالليل بدري",range: [21, 24] },
};
function _dayPartOf(hour) {
  for (const [k, v] of Object.entries(DAY_PART)) {
    if (hour >= v.range[0] && hour < v.range[1]) return k;
  }
  return "night";
}
const WF_REGION_LABEL = {
  fhp_index: { en: "neck", ar: "رقبتك" }, neck_lean: { en: "neck", ar: "رقبتك" },
  rounded_shoulders: { en: "shoulders", ar: "كتفك" }, shoulder_level: { en: "right shoulder", ar: "كتفك اليمين" },
  spine_lean: { en: "lower back", ar: "أسفل ظهرك" }, spine_align: { en: "back", ar: "ظهرك" },
  trunk_lean: { en: "back", ar: "ظهرك" }, hip_angle: { en: "hips", ar: "الحوض" },
  screen_distance: { en: "eyes/neck", ar: "عينك ورقبتك" },
};

function computeWeeklyForecast(sessions) {
  // KNOWN LIMITATION (found in QA review): weekday/hour here are read via
  // Date.getDay()/getHours(), i.e. the BROWSER's local timezone — correct
  // for "which day does this user's own schedule tend to go wrong". But
  // the delivery side (api/habits/whatsapp-cron.js) checks against a
  // Cairo-fixed clock (UTC+3), not the user's own timezone. For a user
  // whose device is actually set to Cairo/similar (the large majority for
  // an Egypt/MENA product) these match. For a user traveling or with a
  // different device timezone, the reminder could fire a day off. Proper
  // fix would be storing the user's timezone and having the cron check
  // against it per-user instead of one fixed offset — flagging rather
  // than silently leaving unfixed.
  const scored = (sessions || []).filter(s => (s.avg_score || 0) > 0);
  if (scored.length < 20) return { ready: false, reason: "not_enough_sessions", n: scored.length };

  const buckets = {}; // "weekday-part" -> { scores:[], metricSums:{}, metricCounts:{} }
  const weeksSeen = new Set();
  scored.forEach(s => {
    const d = s.created_at?.toDate?.() ?? new Date(s.created_at || 0);
    if (isNaN(d.getTime())) return;
    const weekday = d.getDay();
    const part = _dayPartOf(d.getHours());
    const key = `${weekday}-${part}`;
    // Was `${year}-W${floor(dayOfMonth/7)}` — no month component, so
    // sessions from different months whose day-of-month fell in the same
    // 0-6/7-13/etc range collided into the same "week" (e.g. Jan 3, Feb 2
    // and Mar 1 all produced "2026-W0"), while a genuinely tight cluster
    // spanning 8 calendar days could count as "3 distinct weeks". Use a
    // real ISO week key (same helper exercisePlanLib.js already uses) so
    // the "at least 3 distinct weeks of data" gate below means what it says.
    weeksSeen.add(weekKey(d));
    if (!buckets[key]) buckets[key] = { weekday, part, scores: [], metricSums: {}, metricCounts: {} };
    buckets[key].scores.push(s.avg_score);
    Object.entries(s.metrics || {}).forEach(([k, v]) => {
      // session_fatigue/confidence_val are meta/diagnostic fields, not
      // real posture metrics — without this exclusion either could win
      // "worstMetric" below purely from e.g. poor lighting hurting
      // detection confidence, silently replacing the actual worst body
      // region with a generic fallback (see WF_REGION_LABEL lookup).
      if (k.startsWith("_") || k === "session_fatigue" || k === "confidence_val") return;
      const sc = typeof v === "number" ? v : (v?.score ?? null);
      if (sc == null) return;
      buckets[key].metricSums[k] = (buckets[key].metricSums[k] || 0) + sc;
      buckets[key].metricCounts[k] = (buckets[key].metricCounts[k] || 0) + 1;
    });
  });

  if (weeksSeen.size < 3) return { ready: false, reason: "not_enough_weeks", n: scored.length };

  const candidates = Object.values(buckets)
    .filter(b => b.scores.length >= 3)
    .map(b => {
      const avgScore = b.scores.reduce((a, c) => a + c, 0) / b.scores.length;
      const badCount = b.scores.filter(s => s < 65).length;
      const problemPct = Math.round((badCount / b.scores.length) * 100);
      const worstMetric = Object.entries(b.metricSums)
        .map(([k, sum]) => ({ key: k, avg: sum / b.metricCounts[k] }))
        .sort((a, c) => a.avg - c.avg)[0];
      return { ...b, avgScore, problemPct, worstMetric, n: b.scores.length };
    })
    .sort((a, c) => c.problemPct - a.problemPct || a.avgScore - c.avgScore);

  const top = candidates[0];
  if (!top || top.problemPct < 35) return { ready: false, reason: "no_clear_pattern", n: scored.length };

  return { ready: true, ...top };
}

// Links: markdown [text](url) or a bare http(s) URL, in one pass so a
// markdown-form URL never also gets caught by the bare-URL branch.
function linkifyP(t) {
  return t.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/g,
    (m, mdText, mdUrl, bareUrl) => {
      if (mdUrl) return `<a href="${mdUrl}" target="_blank" rel="noopener noreferrer" style="color:#c4b5fd;text-decoration:underline">${mdText}</a>`;
      let url = bareUrl, trail = "";
      const tm = url.match(/([.,;:!?)]+)$/);
      if (tm) { trail = tm[1]; url = url.slice(0, -trail.length); }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#c4b5fd;text-decoration:underline">${url}</a>${trail}`;
    }
  );
}

// Inline markdown — NO T. references (avoids minifier collision)
function inlineMdP(t) {
  return linkifyP((t||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"))
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
    <div style={{ fontFamily:"'IBM Plex Sans Arabic','DM Sans',system-ui,sans-serif", padding:'2px 0' }}
         dangerouslySetInnerHTML={{ __html: out.join("") }} />
  );
}

function avg(arr) { return arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0; }

function detectAnomalies(scoredSessions) {
  if (scoredSessions.length < 5) return [];
  const scores = scoredSessions.map(x => x.score);
  const m  = avg(scores);
  const sd = Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - m, 2), 0) / scores.length);
  return scoredSessions.map((x, i) => ({
    index: i, value: x.score, session: x.session,
    z: sd > 0 ? Math.abs((x.score - m) / sd) : 0,
    isAnomaly: sd > 0 && Math.abs((x.score - m) / sd) > 1.8,
    direction: x.score > m ? "high" : "low",
  })).filter(p => p.isAnomaly);
}

function forecast(scores, days = 7) {
  if (!scores || scores.length < 3) return null;
  const n = scores.length;
  // Exponentially-weighted regression: recent sessions influence the trend
  // more than old ones, so a sudden recent change shows up faster than in
  // a plain unweighted OLS fit.
  const HALF_LIFE = 5; // sessions
  const weights = scores.map((_, i) => Math.pow(0.5, (n - 1 - i) / HALF_LIFE));
  const wSum   = weights.reduce((a, w) => a + w, 0);
  const xMean  = scores.reduce((s, _, x) => s + x * weights[x], 0) / wSum;
  const yMean  = scores.reduce((s, y, x) => s + y * weights[x], 0) / wSum;
  const num = scores.reduce((s, y, x) => s + weights[x] * (x - xMean) * (y - yMean), 0);
  const den = scores.reduce((s, _, x) => s + weights[x] * Math.pow(x - xMean, 2), 0);
  const slope = den ? num / den : 0;
  const intercept = yMean - slope * xMean;

  // Confidence band from the weighted residual spread — wider band the
  // noisier the recent history has been, narrower when scores are steady.
  const residuals = scores.map((y, x) => y - (intercept + slope * x));
  const wResidVar = residuals.reduce((s, r, x) => s + weights[x] * r * r, 0) / wSum;
  const stdErr = Math.sqrt(Math.max(0, wResidVar));

  const predicted  = [];
  const upperBound  = [];
  const lowerBound  = [];
  for (let i = 0; i < days; i++) {
    const point = intercept + slope * (n + i);
    // Uncertainty grows the further out the forecast reaches
    const spread = stdErr * (1 + i * 0.15);
    predicted.push(Math.round(Math.max(0, Math.min(100, point))));
    upperBound.push(Math.round(Math.max(0, Math.min(100, point + spread))));
    lowerBound.push(Math.round(Math.max(0, Math.min(100, point - spread))));
  }
  const trend = slope > 0.3 ? "improving" : slope < -0.3 ? "declining" : "stable";
  // Simple confidence label from how wide the 7-day band is relative to the scale
  const bandWidth = (upperBound[days-1] || 0) - (lowerBound[days-1] || 0);
  const confidence = bandWidth <= 10 ? "high" : bandWidth <= 25 ? "medium" : "low";
  return { slope: Math.round(slope * 100) / 100, predicted, upperBound, lowerBound, trend, confidence };
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
function AnomalyRow({ anomaly, isAr }) {
  const sess = anomaly.session;
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

// ── Risk factor breakdown ────────────────────────────────────────────
function RiskBreakdown({ factors, total, isAr }) {
  if (!factors?.length) return null;
  return (
    <div style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`,
      borderRadius: 14, padding: TOKENS.sp4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: TOKENS.sp3 }}>
        <div style={{ fontSize: TOKENS.base, fontWeight: TOKENS.bold, color: TOKENS.text }}>
          {isAr ? "تفصيل مؤشر الخطر" : "Risk Score Breakdown"}
        </div>
        <div style={{ fontSize: TOKENS.base, fontWeight: TOKENS.bold, color: riskColor(total) }}>
          {total}/100
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: TOKENS.sp3 }}>
        {factors.map(f => {
          const contribution = Math.round(f.raw * f.weight);
          return (
            <div key={f.key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: TOKENS.xs, color: TOKENS.textSub, fontWeight: TOKENS.semibold }}>
                  {f.label} <span style={{ color: TOKENS.textMuted }}>({Math.round(f.weight*100)}%)</span>
                </span>
                <span style={{ fontSize: TOKENS.xs, color: riskColor(f.raw), fontWeight: TOKENS.bold }}>
                  +{contribution}
                </span>
              </div>
              <div style={{ height: 5, background: "rgba(148,163,184,.12)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, f.raw)}%`,
                  background: riskColor(f.raw), borderRadius: 99, transition: "width .3s" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: TOKENS.xs, color: TOKENS.textMuted, marginTop: TOKENS.sp3, lineHeight: 1.6 }}>
        {isAr
          ? "\"ربط الأعراض الحقيقي\" مبني على تسجيلاتك الفعلية في محرك ربط الأعراض، مش بس زوايا الوضعية."
          : "\"Real symptom correlation\" is based on your actual check-ins in the Symptom Correlation Engine, not just posture angles."}
      </div>
    </div>
  );
}

// ── Forecast chart ───────────────────────────────────────────────────
function ForecastChart({ historical, predicted, upperBound, lowerBound, confidence, isAr }) {
  if (!historical?.length || !predicted?.length) return null;
  const all   = [...historical.slice(-14), ...predicted, ...(upperBound||[]), ...(lowerBound||[])];
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

  // Confidence band as a closed polygon: upper bound out, lower bound back —
  // starts/ends at the last historical point so it doesn't float disconnected.
  const bandPolygon = (upperBound && lowerBound) ? (() => {
    const upPts = upperBound.map((v, i) => {
      const x = histW + (i / Math.max(upperBound.length - 1, 1)) * predW;
      const y = H - ((v - minV) / range) * H;
      return `${x},${y}`;
    });
    const downPts = lowerBound.map((v, i) => {
      const x = histW + (i / Math.max(lowerBound.length - 1, 1)) * predW;
      const y = H - ((v - minV) / range) * H;
      return `${x},${y}`;
    }).reverse();
    return [`${lastX},${lastY}`, ...upPts, ...downPts, `${lastX},${lastY}`].join(" ");
  })() : null;

  const CONF_LABEL = {
    high:   { en: "High confidence",   ar: "ثقة عالية",   color: "#10b981" },
    medium: { en: "Medium confidence", ar: "ثقة متوسطة",  color: "#f59e0b" },
    low:    { en: "Low confidence",    ar: "ثقة منخفضة",  color: "#ef4444" },
  };
  const confMeta = CONF_LABEL[confidence] || null;

  return (
    <div style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.border}`,
      borderRadius: 14, padding: TOKENS.sp4 }}>

      {/* Legend */}
      <div style={{ display: "flex", gap: TOKENS.sp4, marginBottom: TOKENS.sp3, alignItems: "center", flexWrap: "wrap" }}>
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
        {confMeta && (
          <div style={{ marginInlineStart: "auto", fontSize: TOKENS.xs, fontWeight: TOKENS.bold,
            color: confMeta.color, background: `${confMeta.color}15`, padding: "2px 8px", borderRadius: 99 }}>
            {isAr ? confMeta.ar : confMeta.en}
          </div>
        )}
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
        {/* Confidence band — drawn before the lines so it sits underneath */}
        {bandPolygon && (
          <polygon points={bandPolygon} fill="#0891b2" fillOpacity="0.12" stroke="none" />
        )}
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
            ? `التوقع بعد 7 أيام: ${predicted[predicted.length - 1]}/100${upperBound ? ` (${lowerBound[lowerBound.length-1]}–${upperBound[upperBound.length-1]})` : ""}`
            : `7-day forecast: ${predicted[predicted.length - 1]}/100${upperBound ? ` (${lowerBound[lowerBound.length-1]}–${upperBound[upperBound.length-1]})` : ""}`}
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
export function PredictiveAI({ profile, sessions = [], cs, lang = "en", onClose , effectiveTier, uid = "", onUpgrade}) {
  useBodyScrollLock();
  const [tab, setTab]         = useState("burnout");
  const [aiText, setAiText]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [symptomInsights, setSymptomInsights] = useState(null); // from the symptom correlation engine
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderSaved,  setReminderSaved]  = useState(!!profile?.predictive_stretch_reminder?.enabled);
  const [reminderError,  setReminderError]  = useState(false);
  const isAr = lang === "ar";

  useEffect(() => {
    SymptomAPI.correlation("90d").then(d => setSymptomInsights(d?.insights || [])).catch(() => setSymptomInsights([]));
  }, []);

  // sessions are newest-first (see getUserSessions: sorted tb-ta descending).
  const scoredSessions = sessions.map(s => ({ session: s, score: s.avg_score || 0 })).filter(x => x.score > 0);
  const allScores = scoredSessions.map(x => x.score); // still newest-first
  const avgScore  = avg(allScores);
  // Most recent 14 sessions, reordered oldest->newest for the regression in forecast(),
  // which assumes index 0 = earliest. (allScores.slice(-14) would grab the OLDEST 14
  // instead and feed them in reverse-chronological order — inverting the trend.)
  const recent14  = allScores.slice(0, 14).slice().reverse();

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

  const anomalies    = detectAnomalies(scoredSessions);
  const fore         = forecast(recent14.length >= 3 ? recent14 : allScores.slice().reverse());
  const forecastTrend = fore?.trend || "stable";
  const weeklyForecast = computeWeeklyForecast(sessions);

  // Risk scoring — a weighted sum of explainable factors rather than one
  // opaque number. The "symptom correlation" factor pulls in the real
  // self-reported data from the Symptom Correlation Engine (a separate
  // feature) instead of only inferring risk from posture-angle metrics —
  // two different signals corroborating each other are more trustworthy
  // than posture data alone.
  const worstSymptomGap = symptomInsights?.length
    ? Math.max(0, ...symptomInsights.filter(i => i.direction === "worse").map(i => i.score_gap))
    : 0;
  const riskFactors = [
    { key: "avgScore",  label: isAr ? "متوسط السكور" : "Average score",       weight: 0.40, raw: Math.max(0, 100 - avgScore) },
    { key: "burnout",   label: isAr ? "مؤشر الإرهاق" : "Burnout indicator",   weight: 0.25, raw: burnoutScore },
    { key: "anomalies", label: isAr ? "شذوذ مكتشف" : "Detected anomalies",    weight: 0.15, raw: Math.min(100, anomalies.filter(a => a.direction === "low").length * 20) },
    { key: "trend",     label: isAr ? "اتجاه التوقع" : "Forecast trend",      weight: 0.10, raw: forecastTrend === "declining" ? 100 : forecastTrend === "stable" ? 40 : 0 },
    { key: "symptoms",  label: isAr ? "ربط الأعراض الحقيقي" : "Real symptom correlation", weight: 0.10, raw: Math.min(100, worstSymptomGap * 4) },
  ];
  const riskScore = Math.min(100, Math.round(riskFactors.reduce((s, f) => s + f.raw * f.weight, 0)));

  const _scoreL = avgScore>=85?"Excellent":avgScore>=70?"Good":avgScore>=55?"Fair":"Needs Attention";
  // These narrative thresholds used to be 40 while riskColor() — used for
  // every risk-related color/badge in this file's UI, 10+ call sites —
  // and _cervAngle/_cervLoad just above use 45. A score of 42 rendered
  // green "safe zone" in the UI while the AI-generated clinical text
  // narrated it as "MODERATE" / "1.4x elevated risk — early intervention
  // critical", directly contradicting the color-coded UI next to it.
  // Aligned to the same 45 cutoff the UI already uses everywhere.
  const _cervAngle = riskScore>=70?"35-50":riskScore>=45?"20-35":"<20";
  const _cervLoad  = riskScore>=70?"18-27 kg":riskScore>=45?"12-18 kg":"4-12 kg";

  const system = `You are Dr. Corvus — senior clinical physiotherapist and MSK specialist with 15 years experience.

PATIENT PROFILE:
- Posture: ${avgScore}/100 (${_scoreL}) | This week: ${weekAvg}/100 | Sessions: ${sessions.length}
- Burnout: ${burnoutScore}% (${burnoutScore>=70?"HIGH":burnoutScore>=45?"MODERATE":"LOW"}) | Risk index: ${riskScore}/100 | Anomalies: ${anomalies.length}

CLINICAL INTERPRETATION FOR THIS PATIENT:
Score ${avgScore}/100 → cervical angle ~${_cervAngle}° → load ~${_cervLoad} (Hansraj 2014, neutral=4.5kg)
${riskScore>=70?"C5-C7 facet joints under chronic overload — disc dehydration accelerated":riskScore>=45?"Approaching chronic cervicalgia threshold":"Within safe loading parameters"}
Burnout ${burnoutScore}% → ${burnoutScore>=70?"2.3x elevated MSK injury risk (Holtermann 2018) — muscles in chronic guarding":burnoutScore>=45?"1.4x elevated risk — early intervention critical":"minimal elevated risk"}
Anomalies: ${anomalies.length>=3?"Pattern = inconsistent postural control, likely fatigue spikes":anomalies.length>=1?"Isolated deviations — identify trigger events":"No significant anomalies"}

STANDARDS:
- Interpret numbers as anatomical consequences — not just scores
- Give week-by-week timelines based on data trajectory
- Anomaly z-scores: z>2 = clinically significant deviation
- Recovery protocols: sets x reps, hold time, frequency, weeks to improvement
- ${riskScore>=70||burnoutScore>=70?"⚕️ HIGH RISK — recommend professional evaluation":"⚕️ Flag any red flag symptoms"}
- No preamble, max 220 words, start immediately
${lang === "ar" ? "LANGUAGE: Egyptian Arabic (عامية مصرية) + medical terms with simple explanation." : "LANGUAGE: Clear professional English."}

[CTXDATA:${JSON.stringify({avg:avgScore||0, sessions:sessions.length||0, weekAvg:weekAvg||0, weekSessions:thisWeek.length||0, burnout:burnoutScore||0, lang})}]`;
  // ^ Without this marker, if the primary LLM path ever failed here, the
  // rule-based fallback in localAI.js (parseData()) would regex-match this
  // free-form prose and get every field wrong or default to 0 — same fix
  // already applied to AICoach.jsx, aiPreloader.js, AIInsights.jsx and
  // AIReports.jsx.

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
    const cached = uid ? getCached(uid, cacheTabKey, lang, sessions.length) : null;
    if (cached) { setAiText(cached); return; }
    setLoading(true); setError(""); setAiText("");
    try {
      const text = await callGemini(prompts[key]?.() || "", system);
      if (text && uid) setCache(uid, cacheTabKey, lang, text, sessions.length);
      setAiText(text);
    }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [sessions.length, avgScore, burnoutScore, riskScore, fore?.trend, lang, profile]);

  useEffect(() => { if (tab !== "weekplan") loadAI(tab); }, [tab]);

  // Was gated only at the sidebar nav level (locked:!elite), which was
  // removed in favor of an "open the feature, upsell inside" pattern —
  // but this component never actually used its effectiveTier prop for
  // anything, so removing the sidebar block made it fully free for
  // every tier.
  if (!tierAtLeast(effectiveTier, "elite")) return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9200, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "rgba(8,14,28,.98)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: "36px 28px", maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>🔒</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#f0f6ff", marginBottom: 8 }}>{isAr ? "AI تنبؤي — Elite" : "Predictive AI — Elite"}</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 22 }}>{isAr ? "توقّع الإرهاق والألم قبل ما يحصل، بناءً على بيانات وضعيتك" : "Predict burnout and pain before it happens, based on your posture data"}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "rgba(255,255,255,.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{isAr ? "إغلاق" : "Close"}</button>
          <button onClick={()=>{ onClose?.(); onUpgrade?.(); }} style={{ padding: "10px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{isAr ? "الترقية لـ Elite" : "Upgrade to Elite"}</button>
        </div>
      </div>
    </div>
  );

  const saveStretchReminder = async () => {
    if (!weeklyForecast?.ready || !uid) return;
    if (!profile?.whatsapp_phone) return; // nothing to deliver to — button below stays disabled + note stays visible
    setReminderSaving(true); setReminderError(false);
    try {
      const region = WF_REGION_LABEL[weeklyForecast.worstMetric?.key] || { en: "your posture", ar: "وضعيتك" };
      // Reminder fires 1 day before the predicted risk window, at a fixed
      // 10am slot — reuses the same hourly whatsapp-cron.js infra as the
      // daily session reminder (api/habits/whatsapp-cron.js), just keyed
      // to a specific weekday instead of every day.
      const reminderWeekday = (weeklyForecast.weekday + 6) % 7; // day before
      await updateUserProfile(uid, {
        predictive_stretch_reminder: {
          enabled: true,
          weekday: reminderWeekday,
          hour: 14, // 2pm Cairo time
          target_weekday: weeklyForecast.weekday,
          target_part: weeklyForecast.part,
          region_en: region.en, region_ar: region.ar,
        },
      });
      setReminderSaved(true);
    } catch (e) {
      console.error("[predictive reminder]", e);
      setReminderError(true);
    } finally {
      setReminderSaving(false);
    }
  };

  const TABS = [
    { id: "burnout",  icon: "🔥", en: "Burnout",   ar: "الإرهاق"  },
    { id: "anomaly",  icon: "🔍", en: "Anomalies", ar: "الشذوذات" },
    { id: "risk",     icon: "⚠️", en: "Risk",      ar: "الخطر"    },
    { id: "forecast", icon: "🔮", en: "Forecast",  ar: "التوقع"   },
    { id: "weekplan", icon: "🗓️", en: "Weekly Plan", ar: "الخطة الأسبوعية" },
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
      background: "rgba(2,8,20,.55)", zIndex: 9100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#0b1525", border: `1px solid ${TOKENS.border}`,
        borderRadius: 20, width: "min(660px,96vw)", height: "min(740px,94dvh)",
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
            }} aria-label="Close">✕</button>
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
              <RiskBreakdown factors={riskFactors} total={riskScore} isAr={isAr} />
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
                      <AnomalyRow key={i} anomaly={a} isAr={isAr} />)
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
                historical={recent14.length >= 3 ? recent14 : allScores.slice(0,14).slice().reverse()}
                predicted={fore?.predicted || []}
                upperBound={fore?.upperBound} lowerBound={fore?.lowerBound}
                confidence={fore?.confidence} isAr={isAr} />

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

          {tab === "weekplan" && (
            <div style={{ display: "flex", flexDirection: "column", gap: TOKENS.sp4 }}>
              {!weeklyForecast?.ready ? (
                <div style={{ textAlign: "center", padding: "50px 20px" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🗓️</div>
                  <div style={{ fontSize: TOKENS.base, color: TOKENS.textSub, marginBottom: 6 }}>
                    {weeklyForecast?.reason === "not_enough_weeks"
                      ? (isAr ? "محتاجين بيانات موزعة على 3 أسابيع على الأقل عشان نطلع نمط أسبوعي موثوق" : "Need data spread across at least 3 weeks for a reliable weekly pattern")
                      : weeklyForecast?.reason === "no_clear_pattern"
                      ? (isAr ? "مفيش نمط أسبوعي واضح لسه — وضعيتك متسقة، أو مش متكررة كفاية بنفس اليوم/الوقت" : "No clear weekly pattern yet — your posture is either consistent, or not repeating enough at the same day/time")
                      : (isAr ? "محتاجين على الأقل 20 جلسة قبل ما نقدر نطلع خطة أسبوعية موثوقة" : "Need at least 20 sessions before a reliable weekly plan is possible")}
                  </div>
                  <div style={{ fontSize: TOKENS.xs, color: TOKENS.textMuted }}>
                    {isAr ? `عندك دلوقتي ${weeklyForecast?.n || 0} جلسة` : `You currently have ${weeklyForecast?.n || 0} sessions`}
                  </div>
                </div>
              ) : (() => {
                const region = WF_REGION_LABEL[weeklyForecast.worstMetric?.key] || { en: "posture", ar: "وضعيتك" };
                const dayName = WEEKDAY_LABELS[isAr ? "ar" : "en"][weeklyForecast.weekday];
                const partName = DAY_PART[weeklyForecast.part][isAr ? "ar" : "en"];
                const reminderDay = WEEKDAY_LABELS[isAr ? "ar" : "en"][(weeklyForecast.weekday + 6) % 7];
                return (
                  <>
                    <div style={{
                      background: `linear-gradient(135deg, ${riskColor(weeklyForecast.problemPct)}18, transparent)`,
                      border: `1px solid ${riskColor(weeklyForecast.problemPct)}40`,
                      borderRadius: 16, padding: TOKENS.sp5,
                    }}>
                      <div style={{ fontSize: TOKENS.xs, fontWeight: TOKENS.bold, color: TOKENS.textMuted,
                        letterSpacing: ".07em", textTransform: "uppercase", marginBottom: TOKENS.sp3 }}>
                        {isAr ? "الأسبوع الجاي" : "Next Week"}
                      </div>
                      <div style={{ fontSize: TOKENS.md, color: TOKENS.text, lineHeight: 1.6, marginBottom: TOKENS.sp3 }}>
                        {isAr
                          ? <>لو اشتغلت بنفس النمط، احتمال <strong style={{color:riskColor(weeklyForecast.problemPct)}}>{weeklyForecast.problemPct}%</strong> تحس بألم في {region.ar} يوم {dayName} {partName}.</>
                          : <>If you keep the same pattern, there's a <strong style={{color:riskColor(weeklyForecast.problemPct)}}>{weeklyForecast.problemPct}%</strong> chance of {region.en} discomfort {dayName} {partName}.</>}
                      </div>
                      <div style={{ fontSize: TOKENS.sm, color: TOKENS.textSub, lineHeight: 1.6,
                        borderTop: `1px solid ${TOKENS.border}`, paddingTop: TOKENS.sp3 }}>
                        {isAr
                          ? <>توصيتنا: stretch 10 دقايق كل {reminderDay}، وهننبهك {reminderDay} الساعة 2 الضهر.</>
                          : <>Our recommendation: 10-min stretch every {reminderDay}, and we'll remind you {reminderDay} at 2pm.</>}
                      </div>
                    </div>

                    <div style={{ fontSize: TOKENS.xs, color: TOKENS.textMuted, lineHeight: 1.6, padding: `0 ${TOKENS.sp1}px` }}>
                      {isAr
                        ? `مبني على ${weeklyForecast.n} جلسة سابقة يوم ${dayName} ${partName} — ده نمط استكشافي مش تشخيص طبي.`
                        : `Based on ${weeklyForecast.n} previous sessions on ${dayName} ${partName} — this is an exploratory pattern, not a medical diagnosis.`}
                    </div>

                    {!profile?.whatsapp_phone && !reminderSaved && (
                      <div style={{ fontSize: TOKENS.xs, color: TOKENS.textMuted }}>
                        {isAr ? "محتاج تضيف رقم واتساب في الإعدادات الأول عشان التذكير يوصلك" : "Add your WhatsApp number in Settings first so the reminder can reach you"}
                      </div>
                    )}
                    <button
                      onClick={saveStretchReminder}
                      disabled={reminderSaving || reminderSaved || !profile?.whatsapp_phone}
                      style={{
                        padding: `${TOKENS.sp3}px ${TOKENS.sp4}px`, borderRadius: 12,
                        background: reminderSaved ? "rgba(16,185,129,.12)" : (!profile?.whatsapp_phone ? "rgba(255,255,255,.06)" : TOKENS.accent),
                        border: reminderSaved ? "1px solid rgba(16,185,129,.35)" : "none",
                        color: reminderSaved ? "#10b981" : (!profile?.whatsapp_phone ? TOKENS.textMuted : "#fff"),
                        fontSize: TOKENS.base, fontWeight: TOKENS.bold,
                        cursor: (reminderSaved || !profile?.whatsapp_phone) ? "default" : "pointer",
                      }}>
                      {reminderSaved
                        ? (isAr ? `✓ مفعّل — هننبهك ${reminderDay} الساعة 2` : `✓ Enabled — we'll remind you ${reminderDay} at 2pm`)
                        : reminderSaving
                        ? "…"
                        : (isAr ? `🔔 فعّل التذكير عبر واتساب` : `🔔 Enable WhatsApp reminder`)}
                    </button>
                    {reminderError && (
                      <div style={{ fontSize: TOKENS.xs, color: "#ef4444" }}>
                        {isAr ? "تعذر حفظ التذكير — حاول تاني" : "Couldn't save the reminder — please try again"}
                      </div>
                    )}
                  </>
                );
              })()}
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
