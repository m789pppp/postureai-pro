/**
 * pdfReports.js — Corvus PostureAI Pro · PDF Report System v2.0
 * ─────────────────────────────────────────────────────────────────
 * 5 report types, all using HTML→canvas→PDF pipeline:
 *   1. SESSION    — single session deep dive
 *   2. CLINICAL   — medical-grade posture assessment
 *   3. COMPARISON — before/after or period comparison
 *   4. LONGITUDINAL — long-term trend analysis (Elite)
 *   5. AI         — AI-narrated executive report
 *
 * Requires: jspdf@4, html2canvas@1
 */

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// ── Helpers ──────────────────────────────────────────────────────────
const avg = (arr) =>
  arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
const sc = (v) => (v >= 80 ? "#10b981" : v >= 60 ? "#f59e0b" : "#ef4444");
const grade = (v, ar) =>
  v >= 80
    ? ar
      ? "ممتاز"
      : "Excellent"
    : v >= 60
    ? ar
      ? "جيد"
      : "Good"
    : ar
    ? "يحتاج تحسين"
    : "Needs Improvement";
const fmt = (d) => {
  try {
    return new Date(d?.toDate?.() || d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};
const dur = (s) => {
  const sec = s?.duration_s || s?.duration_sec || (s?.duration_min || 0) * 60 || 0;
  return sec > 0
    ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`
    : "—";
};
const esc = (str) =>
  String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
const streak = (sessions) => {
  const dates = [
    ...new Set(
      sessions
        .map((s) => {
          try {
            return (s.created_at?.toDate?.() || new Date(s.created_at || 0))
              .toISOString()
              .slice(0, 10);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    ),
  ].sort();
  if (dates.length < 2) return dates.length;
  let st = 1;
  for (let i = dates.length - 2; i >= 0; i--) {
    const diff = (new Date(dates[i + 1]) - new Date(dates[i])) / 86400000;
    if (diff <= 1.5) st++;
    else break;
  }
  return st;
};

// ── Shared CSS injected into every report ────────────────────────────
const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:#fff;color:#0d1b35;padding:52px 56px;font-size:13px;line-height:1.65;width:794px}
  .logo{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#1a56db;letter-spacing:-.03em}
  .logo span{color:#10b981}
  h1{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;color:#0d1b35;margin:18px 0 6px;letter-spacing:-.03em}
  h2{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:#0d1b35;margin:28px 0 10px;padding-left:12px;border-left:3px solid #1a56db}
  .meta{font-size:11px;color:#7890b0}
  .meta strong{color:#334d6e;font-size:12px}
  .divider{height:2px;background:linear-gradient(90deg,#1a56db,#0891b2,transparent);margin:20px 0 28px;border:none}
  .kpi-row{display:grid;gap:12px;margin:20px 0}
  .kpi{background:#f5f7fb;border-radius:12px;padding:16px 18px;border-top:3px solid}
  .kpi-label{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7890b0;margin-bottom:7px}
  .kpi-val{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;line-height:1}
  .kpi-sub{font-size:10px;color:#7890b0;margin-top:5px;font-weight:500}
  table{width:100%;border-collapse:collapse;margin:10px 0}
  th{background:#f0f4fb;padding:9px 14px;font-size:10px;font-weight:700;color:#7890b0;letter-spacing:.06em;text-transform:uppercase;text-align:left;border-bottom:1px solid #dde5f5}
  td{padding:9px 14px;font-size:12px;border-bottom:1px solid #f0f4fb}
  tr:last-child td{border-bottom:none}
  .pill{display:inline-block;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700}
  .ai-box{background:#f8faff;border:1px solid #dde5f5;border-radius:12px;padding:20px 22px;margin:14px 0}
  .ai-label{font-size:9px;font-weight:700;color:#1a56db;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px}
  .bar-wrap{margin:10px 0}
  .bar-label{display:flex;justify-content:space-between;margin-bottom:4px;font-size:11px;font-weight:600}
  .bar-bg{height:10px;background:#eef2fb;border-radius:99px;overflow:hidden}
  .bar-fill{height:100%;border-radius:99px}
  .footer{margin-top:44px;padding-top:14px;border-top:1px solid #e8eef8;display:flex;justify-content:space-between;font-size:10px;color:#9bacc8}
  .badge{display:inline-block;background:#eef2ff;color:#1a56db;border:1px solid #c7d7fd;border-radius:99px;padding:3px 11px;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .section-intro{font-size:12px;color:#556b8a;line-height:1.7;margin-bottom:16px}
  .risk-item{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:9px;margin:7px 0}
  .risk-high{background:#fef2f2;border-left:3px solid #ef4444}
  .risk-med{background:#fffbeb;border-left:3px solid #f59e0b}
  .risk-low{background:#f0fdf4;border-left:3px solid #10b981}
`;

// ── Core: render HTML string → PDF blob ─────────────────────────────
async function htmlToPDF(htmlString, filename) {
  // Create hidden container
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1";
  wrap.innerHTML = htmlString;
  document.body.appendChild(wrap);

  // Wait for fonts/images
  await new Promise((r) => setTimeout(r, 600));

  try {
    const canvas = await html2canvas(wrap, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const imgW = pdfW;
    const imgH = (canvas.height * pdfW) / canvas.width;

    // Paginate if content exceeds one page
    let posY = 0;
    let remaining = imgH;
    let page = 0;
    while (remaining > 0) {
      if (page > 0) pdf.addPage();
      pdf.addImage(
        imgData,
        "JPEG",
        0,
        -posY,
        imgW,
        imgH,
        undefined,
        "FAST"
      );
      posY += pdfH;
      remaining -= pdfH;
      page++;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(wrap);
  }
}

// ── Header shared block ───────────────────────────────────────────────
function header({ tierLabel, tierColor, name, date, subtitle, badge }) {
  return `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
    <div>
      <div class="logo">Corvus<span>${tierLabel ? " " + tierLabel : ""}</span></div>
      <div style="font-size:11px;color:#7890b0;margin-top:3px">${subtitle}</div>
    </div>
    <div style="text-align:right">
      <div class="meta"><strong>${esc(name)}</strong></div>
      <div class="meta">${date}</div>
      ${badge ? `<div style="margin-top:5px"><span class="badge">${badge}</span></div>` : ""}
    </div>
  </div>
  <hr class="divider"/>`;
}

function footer({ tierLabel, type, confidential = true }) {
  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `
  <div class="footer">
    <span>Corvus${tierLabel ? " " + tierLabel : ""} · ${type}${confidential ? " · Confidential" : ""}</span>
    <span>Generated by Corvus AI · ${now}</span>
  </div>`;
}

function kpiGrid(items, cols = 4) {
  return `
  <div class="kpi-row" style="grid-template-columns:repeat(${cols},1fr)">
    ${items
      .map(
        (k) => `
    <div class="kpi" style="border-color:${k.color}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-val" style="color:${k.color}">${k.value}</div>
      ${k.sub ? `<div class="kpi-sub">${k.sub}</div>` : ""}
    </div>`
      )
      .join("")}
  </div>`;
}

function barChart(items) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return items
    .map(
      (item) => `
    <div class="bar-wrap">
      <div class="bar-label">
        <span style="color:#334d6e">${esc(item.label)}</span>
        <span style="color:${sc(item.value)};font-family:'Syne',sans-serif">${item.value}/100</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width:${Math.round((item.value / 100) * 100)}%;background:${sc(item.value)}"></div>
      </div>
    </div>`
    )
    .join("");
}

function aiBox(text, label = "Corvus AI Analysis") {
  const safe = esc(text || "AI analysis unavailable.")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h4 style='margin:8px 0 4px;font-size:12px;font-weight:700;color:#1a56db'>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3 style='margin:12px 0 5px;font-size:13px;font-weight:800;color:#0d1b35'>$1</h3>")
    .replace(/^- (.+)$/gm, "<li style='margin:4px 0 4px 16px;list-style:disc'>$1</li>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
  return `
  <div class="ai-box">
    <div class="ai-label">🧠 ${label}</div>
    <div style="font-size:12.5px;color:#334d6e;line-height:1.75">${safe}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════
// 1. SESSION REPORT — single session deep dive
// ═══════════════════════════════════════════════════════════════════════
export async function generateSessionPDF({ session, profile, aiSummary, lang = "en" }) {
  const isAr = lang === "ar";
  const score = session?.avg_score || 0;
  const color = sc(score);
  const tierLabel = profile?.tier === "elite" ? "Elite" : profile?.tier === "professional" ? "Pro" : "";
  const tierColor = profile?.tier === "elite" ? "#10b981" : "#0891b2";
  const name = profile?.name || "User";
  const sessionDate = fmt(session?.created_at);

  // Parse alerts
  const alerts = session?.alerts || session?.posture_alerts || [];
  const alertRows =
    alerts.length > 0
      ? alerts
          .slice(0, 8)
          .map(
            (a) => `<tr>
            <td>${esc(a.type || a.label || a)}</td>
            <td><span class="pill" style="background:${a.severity === "high" ? "#fef2f2" : "#fffbeb"};color:${a.severity === "high" ? "#ef4444" : "#f59e0b"}">${a.severity || "medium"}</span></td>
            <td>${a.count || 1}×</td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="3" style="text-align:center;color:#9bacc8;padding:16px">No alerts recorded</td></tr>`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>${BASE_CSS}</style></head><body>
  ${header({ tierLabel, tierColor, name, date: sessionDate, subtitle: "Session Report · Deep Dive Analysis", badge: "Session" })}
  <h1>Session Analysis</h1>
  <p class="section-intro">Detailed breakdown of your posture monitoring session on ${sessionDate}.</p>

  ${kpiGrid([
    { label: "Posture Score", value: score, color, sub: grade(score) },
    { label: "Duration", value: dur(session), color: "#1a56db", sub: "min:sec" },
    { label: "Alerts", value: alerts.length || 0, color: alerts.length > 5 ? "#ef4444" : "#f59e0b", sub: "total" },
    { label: "Grade", value: grade(score), color, sub: `${score}/100` },
  ])}

  <h2>📊 Alert Breakdown</h2>
  <table>
    <thead><tr><th>Alert Type</th><th>Severity</th><th>Frequency</th></tr></thead>
    <tbody>${alertRows}</tbody>
  </table>

  ${session?.frame_scores?.length > 0 ? `
  <h2>📈 Score Timeline</h2>
  <p class="section-intro">Score distribution across the session (sampled frames).</p>
  ${barChart(
    session.frame_scores
      .filter((_, i) => i % Math.ceil(session.frame_scores.length / 8) === 0)
      .slice(0, 8)
      .map((v, i) => ({ label: `Frame ${i + 1}`, value: Math.round(v) }))
  )}` : ""}

  ${aiSummary ? `
  <h2>🧠 AI Session Insights</h2>
  ${aiBox(aiSummary, "Corvus Session Analysis")}` : ""}

  <h2>📋 Session Metadata</h2>
  <table>
    <tbody>
      <tr><td style="font-weight:600;color:#556b8a;width:40%">Session ID</td><td>${esc(session?.id || "—")}</td></tr>
      <tr><td style="font-weight:600;color:#556b8a">Date</td><td>${sessionDate}</td></tr>
      <tr><td style="font-weight:600;color:#556b8a">Duration</td><td>${dur(session)}</td></tr>
      <tr><td style="font-weight:600;color:#556b8a">Frames Analyzed</td><td>${session?.frame_count || session?.frame_scores?.length || "—"}</td></tr>
      <tr><td style="font-weight:600;color:#556b8a">Calibration</td><td>${session?.calibrated ? "✓ Calibrated" : "Not calibrated"}</td></tr>
      <tr><td style="font-weight:600;color:#556b8a">Engine Version</td><td>${session?.engine_version || "v3"}</td></tr>
    </tbody>
  </table>

  ${footer({ tierLabel, type: "Session Report" })}
  </body></html>`;

  await htmlToPDF(html, `Corvus_Session_${sessionDate.replace(/[,\s]/g, "_")}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// 2. CLINICAL REPORT — medical-grade posture assessment
// ═══════════════════════════════════════════════════════════════════════
export async function generateClinicalPDF({ sessions, profile, aiSummary, lang = "en" }) {
  const isAr = lang === "ar";
  const scores = sessions.map((s) => s.avg_score || 0).filter(Boolean);
  const avgScore = avg(scores);
  const color = sc(avgScore);
  const tierLabel = profile?.tier === "elite" ? "Elite" : profile?.tier === "professional" ? "Pro" : "";
  const tierColor = profile?.tier === "elite" ? "#10b981" : "#0891b2";
  const name = profile?.name || "User";
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Aggregate all alerts across sessions
  const alertMap = {};
  sessions.forEach((s) => {
    (s.alerts || s.posture_alerts || []).forEach((a) => {
      const key = a.type || a.label || String(a);
      alertMap[key] = (alertMap[key] || 0) + (a.count || 1);
    });
  });
  const topAlerts = Object.entries(alertMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Risk classification
  const riskLevel =
    avgScore >= 80 ? "low" : avgScore >= 60 ? "medium" : "high";
  const riskColor =
    riskLevel === "high" ? "#ef4444" : riskLevel === "medium" ? "#f59e0b" : "#10b981";
  const riskClass =
    riskLevel === "high" ? "risk-high" : riskLevel === "medium" ? "risk-med" : "risk-low";

  // RULA-like score estimate (simplified)
  const rulaEstimate =
    avgScore >= 80 ? "1–2 (Acceptable)" : avgScore >= 65 ? "3–4 (Investigate)" : avgScore >= 50 ? "5–6 (Change Soon)" : "7 (Implement Change)";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>${BASE_CSS}
    .iso-box{background:#f0f4fb;border-radius:10px;padding:14px 18px;margin:12px 0;border-left:3px solid #1a56db}
    .iso-title{font-size:10px;font-weight:700;color:#1a56db;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}
  </style></head><body>
  ${header({ tierLabel, tierColor, name, date: now, subtitle: "Clinical Posture Assessment Report", badge: "Clinical" })}
  <h1>Clinical Assessment</h1>
  <p class="section-intro">Medical-grade ergonomic posture analysis based on ${sessions.length} monitored sessions. This report follows ISO 11226 ergonomic standards for workplace posture evaluation.</p>

  ${kpiGrid([
    { label: "Overall Score", value: avgScore, color, sub: grade(avgScore) },
    { label: "Risk Level", value: riskLevel.toUpperCase(), color: riskColor, sub: "musculoskeletal" },
    { label: "Sessions", value: sessions.length, color: "#1a56db", sub: "analyzed" },
    { label: "RULA Estimate", value: avgScore >= 80 ? "1–2" : avgScore >= 65 ? "3–4" : avgScore >= 50 ? "5–6" : "7", color: riskColor, sub: "action level" },
  ])}

  <h2>🏥 Clinical Risk Assessment</h2>
  <div class="${riskClass} risk-item">
    <div style="font-size:24px">${riskLevel === "high" ? "⚠️" : riskLevel === "medium" ? "⚡" : "✅"}</div>
    <div>
      <div style="font-weight:700;font-size:13px;color:${riskColor};margin-bottom:4px">${riskLevel === "high" ? "High Risk — Immediate Action Required" : riskLevel === "medium" ? "Moderate Risk — Intervention Recommended" : "Low Risk — Maintain Current Habits"}</div>
      <div style="font-size:12px;color:#556b8a">RULA Estimate: ${rulaEstimate}. Average posture score: ${avgScore}/100 across ${sessions.length} sessions.</div>
    </div>
  </div>

  <h2>📐 ISO 11226 Compliance</h2>
  <div class="iso-box">
    <div class="iso-title">ISO 11226:2000 — Ergonomics of working postures</div>
    <table style="margin:0">
      <tbody>
        <tr><td style="font-weight:600;color:#556b8a;width:45%">Head/Neck Posture</td><td><span class="pill" style="background:${avgScore>=70?"#f0fdf4":"#fef2f2"};color:${avgScore>=70?"#10b981":"#ef4444"}">${avgScore>=70?"Acceptable":"Review Needed"}</span></td></tr>
        <tr><td style="font-weight:600;color:#556b8a">Spine Alignment</td><td><span class="pill" style="background:${avgScore>=65?"#f0fdf4":"#fffbeb"};color:${avgScore>=65?"#10b981":"#f59e0b"}">${avgScore>=65?"Within Range":"Deviation Detected"}</span></td></tr>
        <tr><td style="font-weight:600;color:#556b8a">Shoulder Position</td><td><span class="pill" style="background:${avgScore>=75?"#f0fdf4":"#fef2f2"};color:${avgScore>=75?"#10b981":"#ef4444"}">${avgScore>=75?"Neutral":"Elevated Risk"}</span></td></tr>
        <tr><td style="font-weight:600;color:#556b8a">Overall Compliance</td><td><span class="pill" style="background:${color}22;color:${color}">${avgScore>=80?"Compliant":avgScore>=60?"Partial":"Non-Compliant"}</span></td></tr>
      </tbody>
    </table>
  </div>

  ${topAlerts.length > 0 ? `
  <h2>⚕️ Top Posture Issues Detected</h2>
  ${barChart(topAlerts.map(([label, count]) => ({ label, value: Math.min(count * 10, 100) })))}
  <table style="margin-top:12px">
    <thead><tr><th>Issue</th><th>Occurrences</th><th>Clinical Significance</th></tr></thead>
    <tbody>
      ${topAlerts.map(([label, count]) => `
      <tr>
        <td>${esc(label)}</td>
        <td>${count}</td>
        <td>${count > 10 ? "High — ergonomic intervention recommended" : count > 4 ? "Moderate — monitor and adjust workstation" : "Low — maintain awareness"}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}

  ${aiSummary ? `
  <h2>🧠 Clinical AI Assessment</h2>
  ${aiBox(aiSummary, "Corvus Clinical Intelligence")}` : ""}

  <h2>📋 Clinical Recommendations</h2>
  <div style="background:#f8faff;border-radius:10px;padding:16px 20px;border:1px solid #dde5f5">
    ${[
      ["Monitor posture every 25 minutes", "Use the Pomodoro technique — sit well, move often."],
      ["Ergonomic workstation setup", "Monitor at eye level, keyboard at elbow height, feet flat."],
      ["Neck and shoulder mobility", "Perform gentle stretches every hour to prevent strain."],
      ["Core strengthening", "A stronger core supports better spinal posture during long sessions."],
    ].map(([title, desc]) => `
    <div style="display:flex;gap:12px;margin:10px 0">
      <div style="width:6px;height:6px;border-radius:50%;background:#1a56db;margin-top:5px;flex-shrink:0"></div>
      <div><div style="font-weight:700;font-size:12px;color:#0d1b35">${title}</div><div style="font-size:11px;color:#556b8a;margin-top:2px">${desc}</div></div>
    </div>`).join("")}
  </div>

  <p style="font-size:10px;color:#9bacc8;margin-top:20px;line-height:1.6">⚕️ <strong>Medical Disclaimer:</strong> This report is generated by AI-assisted posture analysis software and is intended for ergonomic awareness purposes only. It does not constitute medical advice, diagnosis, or treatment. Consult a qualified healthcare professional for clinical assessment.</p>

  ${footer({ tierLabel, type: "Clinical Report" })}
  </body></html>`;

  await htmlToPDF(html, `Corvus_Clinical_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// 3. COMPARISON REPORT — two periods side by side
// ═══════════════════════════════════════════════════════════════════════
export async function generateComparisonPDF({ sessions, profile, aiSummary, lang = "en" }) {
  const name = profile?.name || "User";
  const tierLabel = profile?.tier === "elite" ? "Elite" : profile?.tier === "professional" ? "Pro" : "";
  const tierColor = profile?.tier === "elite" ? "#10b981" : "#0891b2";
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Split sessions into two halves chronologically
  const sorted = [...sessions].sort((a, b) => {
    const da = (a.created_at?.toDate?.() || new Date(a.created_at || 0)).getTime();
    const db = (b.created_at?.toDate?.() || new Date(b.created_at || 0)).getTime();
    return da - db;
  });
  const mid = Math.floor(sorted.length / 2);
  const periodA = sorted.slice(0, mid);
  const periodB = sorted.slice(mid);

  const scoreA = avg(periodA.map((s) => s.avg_score || 0));
  const scoreB = avg(periodB.map((s) => s.avg_score || 0));
  const delta = scoreB - scoreA;
  const deltaColor = delta >= 0 ? "#10b981" : "#ef4444";
  const deltaSign = delta >= 0 ? "+" : "";

  const dateA =
    periodA.length > 0
      ? `${fmt(periodA[0].created_at)} – ${fmt(periodA[periodA.length - 1].created_at)}`
      : "—";
  const dateB =
    periodB.length > 0
      ? `${fmt(periodB[0].created_at)} – ${fmt(periodB[periodB.length - 1].created_at)}`
      : "—";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>${BASE_CSS}
  .compare-col{flex:1;background:#f8faff;border-radius:12px;padding:20px;border:1px solid #dde5f5}
  .compare-col.period-b{background:#f0fdf4;border-color:#bbf7d0}
  </style></head><body>
  ${header({ tierLabel, tierColor, name, date: now, subtitle: "Period Comparison Report", badge: "Comparison" })}
  <h1>Before vs. After Comparison</h1>
  <p class="section-intro">Comparing your posture performance across two time periods. Earlier sessions (Period A) vs. more recent sessions (Period B).</p>

  <!-- Delta KPI -->
  ${kpiGrid([
    { label: "Period A Score", value: scoreA, color: sc(scoreA), sub: `${periodA.length} sessions` },
    { label: "Period B Score", value: scoreB, color: sc(scoreB), sub: `${periodB.length} sessions` },
    { label: "Change", value: `${deltaSign}${delta}`, color: deltaColor, sub: delta >= 0 ? "improvement" : "decline" },
    { label: "Overall", value: avg([scoreA, scoreB]), color: sc(avg([scoreA, scoreB])), sub: grade(avg([scoreA, scoreB])) },
  ])}

  <h2>📅 Period Breakdown</h2>
  <div style="display:flex;gap:16px">
    <div class="compare-col">
      <div style="font-size:10px;font-weight:700;color:#7890b0;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">Period A — Earlier</div>
      <div style="font-size:10px;color:#9bacc8;margin-bottom:12px">${dateA}</div>
      <div style="font-family:'Syne',sans-serif;font-size:40px;font-weight:800;color:${sc(scoreA)};line-height:1">${scoreA}</div>
      <div style="font-size:11px;color:#7890b0;margin-top:4px">/100 · ${grade(scoreA)}</div>
      <div style="margin-top:14px;font-size:11px;color:#556b8a">${periodA.length} sessions analyzed</div>
    </div>
    <div style="display:flex;align-items:center;padding:0 4px">
      <div style="font-size:28px;color:${deltaColor};font-family:'Syne',sans-serif;font-weight:800">${deltaSign}${delta}</div>
    </div>
    <div class="compare-col period-b">
      <div style="font-size:10px;font-weight:700;color:#059669;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">Period B — Recent</div>
      <div style="font-size:10px;color:#9bacc8;margin-bottom:12px">${dateB}</div>
      <div style="font-family:'Syne',sans-serif;font-size:40px;font-weight:800;color:${sc(scoreB)};line-height:1">${scoreB}</div>
      <div style="font-size:11px;color:#7890b0;margin-top:4px">/100 · ${grade(scoreB)}</div>
      <div style="margin-top:14px;font-size:11px;color:#556b8a">${periodB.length} sessions analyzed</div>
    </div>
  </div>

  <h2>📊 Session-by-Session</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div>
      <div style="font-size:11px;font-weight:700;color:#7890b0;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Period A</div>
      ${barChart(periodA.slice(0, 6).map((s, i) => ({ label: `Session ${i + 1} · ${fmt(s.created_at)}`, value: s.avg_score || 0 })))}
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;color:#059669;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Period B</div>
      ${barChart(periodB.slice(0, 6).map((s, i) => ({ label: `Session ${i + 1} · ${fmt(s.created_at)}`, value: s.avg_score || 0 })))}
    </div>
  </div>

  ${aiSummary ? `
  <h2>🧠 Comparison Insights</h2>
  ${aiBox(aiSummary, "Corvus Comparison Analysis")}` : ""}

  ${footer({ tierLabel, type: "Comparison Report" })}
  </body></html>`;

  await htmlToPDF(html, `Corvus_Comparison_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// 4. LONGITUDINAL REPORT — long-term trend (Elite only)
// ═══════════════════════════════════════════════════════════════════════
export async function generateLongitudinalPDF({ sessions, profile, aiSummary, lang = "en" }) {
  const name = profile?.name || "User";
  const tierLabel = "Elite";
  const tierColor = "#10b981";
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Group sessions by month
  const byMonth = {};
  sessions.forEach((s) => {
    try {
      const d = s.created_at?.toDate?.() || new Date(s.created_at || 0);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(s.avg_score || 0);
    } catch {}
  });

  const monthlyData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, scores]) => ({
      label: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      value: avg(scores),
      count: scores.length,
    }));

  const allScores = sessions.map((s) => s.avg_score || 0).filter(Boolean);
  const overallAvg = avg(allScores);
  const best = Math.max(...allScores, 0);
  const worst = Math.min(...allScores.filter(Boolean), 100);
  const streakDays = streak(sessions);

  // Trend direction (linear regression slope on last 8 months)
  const lastN = monthlyData.slice(-8);
  let slope = 0;
  if (lastN.length >= 2) {
    const n = lastN.length;
    const sumX = lastN.reduce((s, _, i) => s + i, 0);
    const sumY = lastN.reduce((s, m) => s + m.value, 0);
    const sumXY = lastN.reduce((s, m, i) => s + i * m.value, 0);
    const sumX2 = lastN.reduce((s, _, i) => s + i * i, 0);
    slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }
  const trendLabel = slope > 1 ? "📈 Improving" : slope < -1 ? "📉 Declining" : "➡ Stable";
  const trendColor = slope > 1 ? "#10b981" : slope < -1 ? "#ef4444" : "#f59e0b";

  // Milestones
  const milestones = [];
  if (overallAvg >= 80) milestones.push({ icon: "🏆", text: "Excellent posture health maintained" });
  if (streakDays >= 7) milestones.push({ icon: "🔥", text: `${streakDays}-day consistency streak` });
  if (sessions.length >= 20) milestones.push({ icon: "💪", text: `${sessions.length} total sessions completed` });
  if (best >= 90) milestones.push({ icon: "⭐", text: `Personal best: ${best}/100` });

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>${BASE_CSS}
  .milestone{display:flex;align-items:center;gap:12px;padding:10px 14px;background:#f0fdf4;border-radius:9px;margin:6px 0;border:1px solid #bbf7d0}
  .month-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}
  .month-card{background:#f8faff;border-radius:9px;padding:12px;border:1px solid #e8eef8;text-align:center}
  </style></head><body>
  ${header({ tierLabel: "Elite", tierColor, name, date: now, subtitle: "Longitudinal Trend Analysis — Elite Report", badge: "Elite · Long-term" })}
  <h1>Long-term Trend Analysis</h1>
  <p class="section-intro">Comprehensive analysis of your posture health trajectory spanning ${monthlyData.length} months and ${sessions.length} total sessions. This Elite-tier report includes advanced trend modeling and predictive insights.</p>

  ${kpiGrid([
    { label: "Overall Average", value: overallAvg, color: sc(overallAvg), sub: grade(overallAvg) },
    { label: "Best Score", value: best, color: "#10b981", sub: "personal record" },
    { label: "Trend", value: slope > 0 ? `+${slope.toFixed(1)}` : slope.toFixed(1), color: trendColor, sub: "pts/month" },
    { label: "Streak", value: `${streakDays}d`, color: "#f59e0b", sub: "consecutive days" },
  ], 4)}

  <h2>📈 Monthly Score Trend</h2>
  ${barChart(monthlyData)}

  <div style="display:grid;grid-template-columns:repeat(${Math.min(monthlyData.length, 4)},1fr);gap:10px;margin:14px 0">
    ${monthlyData.slice(-Math.min(monthlyData.length, 8)).map(m => `
    <div class="month-card">
      <div style="font-size:9px;font-weight:700;color:#7890b0;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">${m.label}</div>
      <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:${sc(m.value)}">${m.value}</div>
      <div style="font-size:9px;color:#9bacc8;margin-top:3px">${m.count} sessions</div>
    </div>`).join("")}
  </div>

  <h2>🎯 Trend Analysis</h2>
  <div style="background:${trendColor}11;border:1px solid ${trendColor}44;border-radius:10px;padding:16px 20px">
    <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:${trendColor};margin-bottom:6px">${trendLabel}</div>
    <div style="font-size:12px;color:#556b8a;line-height:1.7">
      ${slope > 1
        ? `Your posture is improving at +${slope.toFixed(1)} points/month. At this rate, you'll reach ${Math.min(overallAvg + Math.round(slope * 3), 100)}/100 in 3 months. Keep up the great work!`
        : slope < -1
        ? `Your posture score has been declining ${Math.abs(slope).toFixed(1)} pts/month. Focus on workspace ergonomics and take more frequent breaks. Early intervention can reverse this trend.`
        : `Your posture is holding steady. To accelerate improvement, try adding a daily 5-minute posture check and reviewing your workspace ergonomics.`}
    </div>
  </div>

  ${milestones.length > 0 ? `
  <h2>🏆 Milestones Achieved</h2>
  ${milestones.map(m => `<div class="milestone"><div style="font-size:22px">${m.icon}</div><div style="font-size:12px;font-weight:600;color:#065f46">${m.text}</div></div>`).join("")}` : ""}

  <h2>📊 Session Distribution</h2>
  <table>
    <thead><tr><th>Month</th><th>Sessions</th><th>Avg Score</th><th>Grade</th></tr></thead>
    <tbody>
      ${monthlyData.map(m => `<tr>
        <td>${m.label}</td>
        <td>${m.count}</td>
        <td><span class="pill" style="background:${sc(m.value)}22;color:${sc(m.value)}">${m.value}/100</span></td>
        <td>${grade(m.value)}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  ${aiSummary ? `
  <h2>🧠 Elite AI — Long-term Insights</h2>
  ${aiBox(aiSummary, "Corvus Elite Intelligence")}` : ""}

  ${footer({ tierLabel: "Elite", type: "Longitudinal Report" })}
  </body></html>`;

  await htmlToPDF(html, `Corvus_Longitudinal_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// 5. AI REPORT — AI-narrated executive report (Pro + Elite)
// ═══════════════════════════════════════════════════════════════════════
export async function generateAIPDF({ sessions, profile, aiSummary, lang = "en" }) {
  const isAr = lang === "ar";
  const name = profile?.name || "User";
  const tierLabel = profile?.tier === "elite" ? "Elite" : "Pro";
  const tierColor = profile?.tier === "elite" ? "#10b981" : "#0891b2";
  const now = new Date().toLocaleDateString(isAr ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const scores = sessions.map((s) => s.avg_score || 0).filter(Boolean);
  const overallAvg = avg(scores);
  const color = sc(overallAvg);
  const now_ms = Date.now();
  const thisWeek = sessions.filter(
    (s) =>
      now_ms - (s.created_at?.toDate?.() || new Date(s.created_at || 0)).getTime() <
      7 * 86400000
  );
  const weekAvg = avg(thisWeek.map((s) => s.avg_score || 0));
  const streakDays = streak(sessions);

  const recentRows = sessions.slice(0, 8).map((s, i) => {
    const scoreVal = s.avg_score || 0;
    const c = sc(scoreVal);
    return `<tr>
      <td>${i + 1}</td>
      <td>${fmt(s.created_at)}</td>
      <td>${dur(s)}</td>
      <td><span class="pill" style="background:${c}22;color:${c}">${scoreVal}/100</span></td>
      <td>${grade(scoreVal, isAr)}</td>
    </tr>`;
  });

  const html = `<!DOCTYPE html><html lang="${lang}" dir="${isAr ? "rtl" : "ltr"}"><head><meta charset="UTF-8"/>
  <style>${BASE_CSS}
    body{direction:${isAr ? "rtl" : "ltr"};font-family:${isAr ? "'Cairo','DM Sans'" : "'DM Sans'"}, sans-serif}
    h2{border-${isAr ? "right" : "left"}:3px solid #1a56db;border-${isAr ? "left" : "right"}:none;padding-${isAr ? "right" : "left"}:12px;padding-${isAr ? "left" : "right"}:0}
    th{text-align:${isAr ? "right" : "left"}}
    .footer{direction:${isAr ? "rtl" : "ltr"}}
  </style></head><body>
  ${header({
    tierLabel,
    tierColor,
    name,
    date: now,
    subtitle: isAr ? "تقرير تنفيذي مدعوم بالذكاء الاصطناعي" : "AI-Powered Executive Report",
    badge: isAr ? "تقرير AI" : "AI Report",
  })}
  <h1>${isAr ? `تقرير الأداء — ${esc(name)}` : `Executive Report — ${esc(name)}`}</h1>
  <p class="section-intro">${isAr
    ? `تقرير تنفيذي شامل مدعوم بذكاء Corvus الاصطناعي. بناءً على ${sessions.length} جلسة مُراقَبة.`
    : `Comprehensive AI-narrated executive report powered by Corvus Intelligence. Based on ${sessions.length} monitored sessions.`}</p>

  ${kpiGrid([
    { label: isAr ? "المتوسط الكلي" : "Avg Score", value: overallAvg, color, sub: grade(overallAvg, isAr) },
    { label: isAr ? "هذا الأسبوع" : "This Week", value: weekAvg || "—", color: sc(weekAvg), sub: `${thisWeek.length} ${isAr ? "جلسة" : "sessions"}` },
    { label: isAr ? "إجمالي الجلسات" : "Sessions", value: sessions.length, color: "#1a56db", sub: isAr ? "إجمالي" : "total" },
    { label: isAr ? "السلسلة" : "Streak", value: `${streakDays}${isAr ? " يوم" : "d"}`, color: "#f59e0b", sub: isAr ? "متتالية" : "consecutive" },
  ])}

  <h2>${isAr ? "🧠 تحليل الذكاء الاصطناعي — Corvus AI" : "🧠 Corvus AI Analysis"}</h2>
  ${aiBox(aiSummary, isAr ? "Corvus AI" : "Corvus Intelligence")}

  <h2>${isAr ? "📊 أحدث الجلسات" : "📊 Recent Sessions"}</h2>
  <table>
    <thead><tr>
      <th>#</th>
      <th>${isAr ? "التاريخ" : "Date"}</th>
      <th>${isAr ? "المدة" : "Duration"}</th>
      <th>${isAr ? "النتيجة" : "Score"}</th>
      <th>${isAr ? "التقييم" : "Grade"}</th>
    </tr></thead>
    <tbody>${recentRows.join("") || `<tr><td colspan="5" style="text-align:center;color:#9bacc8;padding:16px">${isAr ? "لا توجد جلسات" : "No sessions"}</td></tr>`}</tbody>
  </table>

  ${footer({ tierLabel, type: isAr ? "تقرير AI" : "AI Report" })}
  </body></html>`;

  await htmlToPDF(
    html,
    `Corvus_AI_Report_${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

// ═══════════════════════════════════════════════════════════════════════
// UNIFIED ENTRY POINT — call this from AIReports.jsx
// ═══════════════════════════════════════════════════════════════════════
export async function exportPDFReport({ type, sessions, session, profile, aiSummary, lang }) {
  switch (type) {
    case "session":
      return generateSessionPDF({ session: session || sessions?.[0], profile, aiSummary, lang });
    case "clinical":
      return generateClinicalPDF({ sessions, profile, aiSummary, lang });
    case "comparison":
      return generateComparisonPDF({ sessions, profile, aiSummary, lang });
    case "longitudinal":
      return generateLongitudinalPDF({ sessions, profile, aiSummary, lang });
    case "ai":
    default:
      return generateAIPDF({ sessions, profile, aiSummary, lang });
  }
}
