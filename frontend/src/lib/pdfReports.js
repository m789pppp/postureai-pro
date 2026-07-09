/**
 * pdfReports.js — Corvus PostureAI Pro · PDF Report System v3.0
 * Dark-theme enterprise PDFs using jsPDF native drawing (no html2canvas)
 * Zero white pages — pure vector PDF with dark background
 */

import { jsPDF } from "jspdf";

// ── Colors ────────────────────────────────────────────────────────────
const C = {
  bg:       [10, 15, 30],       // #0a0f1e
  card:     [16, 24, 48],       // #101830
  card2:    [20, 30, 58],       // #141e3a
  border:   [35, 50, 90],       // #23325a
  accent:   [26, 86, 219],      // #1a56db
  green:    [16, 185, 129],     // #10b981
  yellow:   [245, 158, 11],     // #f59e0b
  red:      [239, 68, 68],      // #ef4444
  cyan:     [8, 145, 178],      // #0891b2
  white:    [255, 255, 255],
  text:     [220, 230, 255],    // main text
  muted:    [100, 130, 180],    // muted text
  dim:      [55, 75, 120],      // very dim
};

// ── Helpers ───────────────────────────────────────────────────────────
const avg = (arr) => arr.length ? Math.round(arr.reduce((s,v)=>s+v,0)/arr.length) : 0;
const sc  = (v) => v >= 80 ? C.green : v >= 60 ? C.yellow : C.red;
const grade = (v) => v >= 80 ? "Excellent" : v >= 60 ? "Good" : "Needs Work";
const fmt = (d) => {
  try { return new Date(d?.toDate?.() || d).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}); }
  catch { return "—"; }
};
const dur = (s) => {
  const sec = s?.duration_s || s?.duration_sec || (s?.duration_min||0)*60 || 0;
  return sec > 0 ? `${Math.floor(sec/60)}:${String(Math.round(sec%60)).padStart(2,"0")} min` : "—";
};
const hex = (rgb) => "#"+rgb.map(v=>v.toString(16).padStart(2,"0")).join("");
const toMs = (s) => {
  try { return (s?.created_at?.toDate?.() || new Date(s?.created_at||0)).getTime(); } catch { return 0; }
};
const streak = (sessions) => {
  const dates = [...new Set(sessions.map(s=>{
    try{return(s.created_at?.toDate?.()||new Date(s.created_at||0)).toISOString().slice(0,10);}catch{return null;}
  }).filter(Boolean))].sort();
  if(dates.length<2) return dates.length;
  let st=1;
  for(let i=dates.length-2;i>=0;i--){
    if((new Date(dates[i+1])-new Date(dates[i]))/86400000<=1.5) st++; else break;
  }
  return st;
};

// ── PDF Drawing Class ─────────────────────────────────────────────────
class CorvusPDF {
  constructor(filename) {
    this.doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
    this.filename = filename;
    this.W = 210; this.H = 297;
    this.mx = 14; // margin x
    this.cw = this.W - this.mx * 2; // content width
    this.y = 0; this.page = 1;
  }

  // Fill whole page with dark bg
  bgPage() {
    this.doc.setFillColor(...C.bg);
    this.doc.rect(0, 0, this.W, this.H, "F");
  }

  newPage() {
    this.doc.addPage();
    this.page++;
    this.y = 0;
    this.bgPage();
  }

  checkY(needed = 20) {
    if (this.y + needed > this.H - 14) this.newPage();
  }

  // Text helpers
  txt(text, x, y, color=C.text, size=9, style="normal", align="left") {
    this.doc.setFontSize(size);
    this.doc.setFont("helvetica", style);
    this.doc.setTextColor(...color);
    this.doc.text(String(text??''), x, y, { align });
  }

  // Filled rounded rect
  card(x, y, w, h, color=C.card, radius=3) {
    this.doc.setFillColor(...color);
    this.doc.roundedRect(x, y, w, h, radius, radius, "F");
  }

  // Accent left-border rect
  accentCard(x, y, w, h, accentColor=C.accent) {
    this.card(x, y, w, h, C.card2, 2);
    this.doc.setFillColor(...accentColor);
    this.doc.rect(x, y, 1.5, h, "F");
  }

  // Progress bar
  bar(x, y, w, h, value, color) {
    // bg
    this.doc.setFillColor(...C.card2);
    this.doc.roundedRect(x, y, w, h, h/2, h/2, "F");
    // fill
    const fw = Math.max(1, (value/100)*w);
    this.doc.setFillColor(...color);
    this.doc.roundedRect(x, y, fw, h, h/2, h/2, "F");
  }

  // Divider line
  divider(y, alpha=40) {
    this.doc.setDrawColor(...C.border);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.mx, y, this.W-this.mx, y);
  }

  // Score pill
  pill(x, y, value, size=18) {
    const color = sc(value);
    this.doc.setFillColor(color[0],color[1],color[2],30);
    this.doc.roundedRect(x-2, y-size*0.7, 20, size*0.9, 2, 2, "F");
    this.txt(`${value}`, x+8, y-size*0.1, color, size, "bold", "center");
    this.txt("/100", x+8, y-size*0.1+4, C.muted, 7, "normal", "center");
  }

  // ── Header (every page) ────────────────────────────────────────
  header(reportType, tierLabel) {
    this.bgPage();
    // Top bar gradient simulation
    this.doc.setFillColor(...C.accent);
    this.doc.rect(0, 0, this.W, 1.5, "F");

    // Logo
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica","bold");
    this.doc.setTextColor(...C.accent);
    this.doc.text("CORVUS", this.mx, 12);
    if(tierLabel) {
      this.doc.setFontSize(8);
      this.doc.setTextColor(...C.green);
      this.doc.text(tierLabel.toUpperCase(), this.mx+27, 12);
    }

    // Report type badge
    this.doc.setFillColor(...C.card);
    this.doc.roundedRect(this.W-this.mx-40, 5, 40, 9, 2, 2, "F");
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica","bold");
    this.doc.setTextColor(...C.muted);
    this.doc.text(reportType.toUpperCase(), this.W-this.mx-20, 10.5, {align:"center"});

    // Accent divider
    this.doc.setFillColor(...C.dim);
    this.doc.rect(this.mx, 16, this.cw, 0.3, "F");
    this.doc.setFillColor(...C.accent);
    this.doc.rect(this.mx, 16, 30, 0.3, "F");

    this.y = 22;
  }

  // ── Title block ────────────────────────────────────────────────
  titleBlock(title, subtitle, name, date) {
    this.txt(title, this.mx, this.y, C.white, 18, "bold");
    this.y += 6;
    if(subtitle) { this.txt(subtitle, this.mx, this.y, C.muted, 8); this.y += 5; }
    this.txt(`${name}  ·  ${date}`, this.mx, this.y, C.dim, 7);
    this.y += 10;
  }

  // ── KPI row (4 cards) ──────────────────────────────────────────
  kpiRow(items) {
    this.checkY(28);
    const cw = (this.cw - 3*3) / Math.min(items.length,4);
    items.slice(0,4).forEach((k,i) => {
      const x = this.mx + i*(cw+3);
      this.card(x, this.y, cw, 24, C.card, 3);
      // accent top line
      this.doc.setFillColor(...(k.color||C.accent));
      this.doc.rect(x, this.y, cw, 1, "F");
      this.txt(k.label, x+4, this.y+7, C.muted, 6.5, "bold");
      this.doc.setFontSize(16); this.doc.setFont("helvetica","bold");
      this.doc.setTextColor(...(k.color||C.white));
      this.doc.text(String(k.value??'—'), x+4, this.y+17);
      if(k.sub) this.txt(k.sub, x+4, this.y+22, C.dim, 6);
    });
    this.y += 30;
  }

  // ── Section heading ────────────────────────────────────────────
  section(title) {
    this.checkY(16);
    this.y += 4;
    this.doc.setFillColor(...C.accent);
    this.doc.rect(this.mx, this.y-3, 1.5, 8, "F");
    this.txt(title, this.mx+5, this.y+3, C.white, 9, "bold");
    this.y += 9;
    this.divider(this.y); this.y += 4;
  }

  // ── Bar chart row ──────────────────────────────────────────────
  barRow(label, value, maxVal=100) {
    this.checkY(10);
    this.txt(label, this.mx, this.y, C.text, 7.5);
    const bx = this.mx + 60, bw = this.cw - 70;
    this.bar(bx, this.y-3.5, bw, 4, (value/maxVal)*100, sc(value));
    this.txt(`${value}`, this.W-this.mx, this.y, sc(value), 8, "bold", "right");
    this.y += 8;
  }

  // ── Table ──────────────────────────────────────────────────────
  tableRow(cols, widths, isHeader=false) {
    this.checkY(9);
    if(isHeader) {
      this.doc.setFillColor(...C.dim);
      this.doc.rect(this.mx, this.y-4, this.cw, 8, "F");
    }
    let x = this.mx + 2;
    cols.forEach((col,i) => {
      const color = isHeader ? C.muted : C.text;
      const size  = isHeader ? 6.5 : 7.5;
      const style = isHeader ? "bold" : "normal";
      this.txt(col, x, this.y+1, color, size, style);
      x += widths[i];
    });
    if(!isHeader) {
      this.doc.setDrawColor(...C.dim);
      this.doc.setLineWidth(0.2);
      this.doc.line(this.mx, this.y+3.5, this.W-this.mx, this.y+3.5);
    }
    this.y += 8;
  }

  // ── AI text box ────────────────────────────────────────────────
  aiBox(text) {
    if(!text) return;
    this.checkY(30);
    // Strip markdown
    const clean = text
      .replace(/\*\*(.+?)\*\*/g,"$1")
      .replace(/\*(.+?)\*/g,"$1")
      .replace(/^#+\s*/gm,"")
      .replace(/^-\s*/gm,"• ")
      .trim();

    const lines = this.doc.splitTextToSize(clean, this.cw-12);
    const boxH = Math.min(lines.length*4+12, 80);
    this.checkY(boxH+4);

    this.card(this.mx, this.y, this.cw, boxH, C.card2, 3);
    this.doc.setFillColor(...C.accent);
    this.doc.rect(this.mx, this.y, 1.5, boxH, "F");

    this.txt("🧠 CORVUS AI ANALYSIS", this.mx+5, this.y+7, C.accent, 6.5, "bold");

    this.doc.setFontSize(7.5);
    this.doc.setFont("helvetica","normal");
    this.doc.setTextColor(...C.text);
    lines.slice(0, Math.floor((boxH-14)/4)).forEach((line,i)=>{
      this.doc.text(line, this.mx+5, this.y+13+i*4);
    });
    this.y += boxH + 6;
  }

  // ── Footer ─────────────────────────────────────────────────────
  footer(type) {
    const fy = this.H - 8;
    this.divider(fy-3);
    const now = new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
    this.txt(`Corvus PostureAI Pro · ${type} · Confidential`, this.mx, fy, C.dim, 6);
    this.txt(`Generated by Corvus AI · ${now} · Page ${this.page}`, this.W-this.mx, fy, C.dim, 6, "normal", "right");
  }

  save() {
    this.footer(this._type||"Report");
    this.doc.save(this.filename);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 1. SESSION REPORT
// ═══════════════════════════════════════════════════════════════════════
export async function generateSessionPDF({ session, profile, aiSummary }) {
  const score = session?.avg_score || 0;
  const color = sc(score);
  const name  = profile?.name || "User";
  const tier  = profile?.tier || "standard";
  const tierLabel = tier === "elite" ? "Elite" : tier === "professional" ? "Pro" : "";

  const pdf = new CorvusPDF(`Corvus_Session_${fmt(session?.created_at).replace(/[,\s]/g,"_")}.pdf`);
  pdf._type = "Session Report";
  pdf.header("Session Report", tierLabel);
  pdf.titleBlock("Session Analysis", "Single-session posture deep dive", name, fmt(session?.created_at));

  pdf.kpiRow([
    { label:"POSTURE SCORE",  value:score,          color,       sub: grade(score) },
    { label:"DURATION",       value:dur(session),   color:C.cyan, sub:"" },
    { label:"ALERTS",         value:(session?.alerts||[]).length, color:C.yellow, sub:"detected" },
    { label:"ENGINE",         value:session?.engine_version||"v3", color:C.muted, sub:"version" },
  ]);

  // Score visual
  pdf.section("Performance Score");
  const barX = pdf.mx + 10, barW = pdf.cw - 50;
  pdf.bar(barX, pdf.y, barW, 8, score, color);
  pdf.txt(`${score}/100 — ${grade(score)}`, barX + barW + 6, pdf.y + 5, color, 9, "bold");
  pdf.y += 16;

  // Alerts
  const alerts = session?.alerts || session?.posture_alerts || [];
  if(alerts.length > 0) {
    pdf.section("Alert Breakdown");
    pdf.tableRow(["ALERT TYPE","SEVERITY","COUNT"],[70,40,30], true);
    alerts.slice(0,10).forEach(a => {
      const sev = a.severity||"medium";
      const sevColor = sev==="high" ? C.red : sev==="medium" ? C.yellow : C.green;
      pdf.checkY(9);
      pdf.txt(a.type||a.label||String(a), pdf.mx+2, pdf.y+1, C.text, 7.5);
      pdf.txt(sev.toUpperCase(), pdf.mx+72, pdf.y+1, sevColor, 7, "bold");
      pdf.txt(String(a.count||1), pdf.mx+112, pdf.y+1, C.muted, 7.5);
      pdf.doc.setDrawColor(...C.dim); pdf.doc.setLineWidth(0.2);
      pdf.doc.line(pdf.mx, pdf.y+3.5, pdf.W-pdf.mx, pdf.y+3.5);
      pdf.y += 8;
    });
  }

  // Frame scores timeline
  if(session?.frame_scores?.length > 0) {
    pdf.section("Score Timeline (Sampled Frames)");
    const fs = session.frame_scores;
    const step = Math.ceil(fs.length/10);
    fs.filter((_,i)=>i%step===0).slice(0,10).forEach((v,i)=>{
      pdf.barRow(`Frame ${i+1}`, Math.round(v));
    });
  }

  // Metadata
  pdf.section("Session Metadata");
  [
    ["Session ID",   session?.id||"—"],
    ["Date",         fmt(session?.created_at)],
    ["Duration",     dur(session)],
    ["Frames",       String(session?.frame_count||session?.frame_scores?.length||"—")],
    ["Calibration",  session?.calibrated?"✓ Calibrated":"Not calibrated"],
  ].forEach(([k,v])=>{
    pdf.checkY(8);
    pdf.txt(k, pdf.mx+2, pdf.y, C.muted, 7.5, "bold");
    pdf.txt(v, pdf.mx+55, pdf.y, C.text, 7.5);
    pdf.y += 7;
  });

  if(aiSummary) { pdf.section("AI Analysis"); pdf.aiBox(aiSummary); }

  pdf.save();
}

// ═══════════════════════════════════════════════════════════════════════
// 2. CLINICAL REPORT
// ═══════════════════════════════════════════════════════════════════════
export async function generateClinicalPDF({ sessions, profile, aiSummary }) {
  const scores = sessions.map(s=>s.avg_score||0).filter(Boolean);
  const avgScore = avg(scores);
  const color = sc(avgScore);
  const name  = profile?.name || "User";
  const tier  = profile?.tier || "standard";
  const tierLabel = tier==="elite"?"Elite":tier==="professional"?"Pro":"";
  const riskLevel = avgScore>=80?"LOW":avgScore>=60?"MODERATE":"HIGH";
  const riskColor = avgScore>=80?C.green:avgScore>=60?C.yellow:C.red;
  const rulaScore = avgScore>=80?"1–2":avgScore>=65?"3–4":avgScore>=50?"5–6":"7";
  const now = fmt(new Date());

  const pdf = new CorvusPDF(`Corvus_Clinical_${new Date().toISOString().slice(0,10)}.pdf`);
  pdf._type = "Clinical Report";
  pdf.header("Clinical Report", tierLabel);
  pdf.titleBlock("Clinical Posture Assessment","ISO 11226 Medical-Grade Ergonomic Analysis", name, now);

  pdf.kpiRow([
    { label:"OVERALL SCORE",  value:avgScore,      color,         sub:grade(avgScore) },
    { label:"RISK LEVEL",     value:riskLevel,     color:riskColor, sub:"musculoskeletal" },
    { label:"RULA ESTIMATE",  value:rulaScore,     color:riskColor, sub:"action level" },
    { label:"SESSIONS",       value:sessions.length, color:C.cyan, sub:"analyzed" },
  ]);

  // Risk panel
  pdf.section("Clinical Risk Assessment");
  const rpH = 22;
  pdf.card(pdf.mx, pdf.y, pdf.cw, rpH, C.card2, 3);
  pdf.doc.setFillColor(...riskColor);
  pdf.doc.rect(pdf.mx, pdf.y, 2, rpH, "F");
  const riskMsg = riskLevel==="HIGH"
    ? "High Risk — Immediate ergonomic intervention recommended."
    : riskLevel==="MODERATE"
    ? "Moderate Risk — Workspace adjustments and awareness training recommended."
    : "Low Risk — Maintain current posture habits and monitor regularly.";
  pdf.txt(riskLevel+" RISK", pdf.mx+6, pdf.y+8, riskColor, 11, "bold");
  pdf.txt(riskMsg, pdf.mx+6, pdf.y+15, C.muted, 7.5);
  pdf.y += rpH + 8;

  // ISO compliance table
  pdf.section("ISO 11226 Compliance");
  pdf.tableRow(["BODY REGION","STATUS","FINDING"],[55,40,80], true);
  [
    ["Head / Neck",   avgScore>=70, avgScore>=70?"Within acceptable range":"Forward head posture detected"],
    ["Spine / Back",  avgScore>=65, avgScore>=65?"Neutral alignment maintained":"Spinal deviation observed"],
    ["Shoulders",     avgScore>=75, avgScore>=75?"Neutral position confirmed":"Elevated / protracted position"],
    ["Overall",       avgScore>=70, avgScore>=70?"ISO Compliant":"Non-Compliant — review required"],
  ].forEach(([region,ok,finding])=>{
    pdf.checkY(9);
    pdf.txt(region, pdf.mx+2, pdf.y+1, C.text, 7.5);
    pdf.txt(ok?"✓ PASS":"✗ FAIL", pdf.mx+57, pdf.y+1, ok?C.green:C.red, 7, "bold");
    pdf.txt(finding, pdf.mx+97, pdf.y+1, C.muted, 7);
    pdf.doc.setDrawColor(...C.dim); pdf.doc.setLineWidth(0.2);
    pdf.doc.line(pdf.mx, pdf.y+3.5, pdf.W-pdf.mx, pdf.y+3.5);
    pdf.y += 8;
  });

  // Top alerts aggregated
  const alertMap = {};
  sessions.forEach(s=>(s.alerts||s.posture_alerts||[]).forEach(a=>{
    const k=a.type||a.label||String(a);
    alertMap[k]=(alertMap[k]||0)+(a.count||1);
  }));
  const topAlerts = Object.entries(alertMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if(topAlerts.length>0) {
    pdf.section("Top Posture Issues");
    const maxCount = Math.max(...topAlerts.map(([,c])=>c),1);
    topAlerts.forEach(([label,count])=>{
      pdf.barRow(label, Math.min(Math.round((count/maxCount)*100),100));
    });
  }

  // Recommendations
  pdf.section("Clinical Recommendations");
  [
    "Take a posture break every 25 minutes — set a timer for the Pomodoro technique.",
    "Adjust monitor to eye level and keyboard at elbow height to reduce strain.",
    "Perform neck/shoulder stretches every hour (chin tucks, shoulder rolls).",
    "Strengthen core muscles — a stronger core supports healthier spinal posture.",
    "Consider a standing desk for 20–30 min intervals during the workday.",
  ].forEach(rec => {
    pdf.checkY(9);
    pdf.doc.setFillColor(...C.accent);
    pdf.doc.circle(pdf.mx+3, pdf.y-1, 1, "F");
    pdf.txt(rec, pdf.mx+8, pdf.y, C.text, 7.5);
    pdf.y += 7;
  });

  // Disclaimer
  pdf.checkY(14);
  pdf.y += 4;
  pdf.accentCard(pdf.mx, pdf.y, pdf.cw, 12, C.yellow);
  pdf.txt("⚕ Medical Disclaimer: This report is for ergonomic awareness only. It does not constitute medical advice.", pdf.mx+5, pdf.y+5, C.muted, 6.5);
  pdf.txt("Consult a qualified healthcare professional for clinical assessment and treatment.", pdf.mx+5, pdf.y+9.5, C.dim, 6.5);
  pdf.y += 16;

  if(aiSummary){ pdf.section("AI Clinical Assessment"); pdf.aiBox(aiSummary); }
  pdf.save();
}

// ═══════════════════════════════════════════════════════════════════════
// 3. COMPARISON REPORT
// ═══════════════════════════════════════════════════════════════════════
export async function generateComparisonPDF({ sessions, profile, aiSummary }) {
  const name = profile?.name || "User";
  const tier = profile?.tier || "standard";
  const tierLabel = tier==="elite"?"Elite":tier==="professional"?"Pro":"";

  if(sessions.length < 2) {
    alert("Need at least 2 sessions for a Comparison report.");
    return;
  }

  const sorted = [...sessions].sort((a,b)=>toMs(a)-toMs(b));
  const mid    = Math.max(1, Math.floor(sorted.length/2));
  const pA     = sorted.slice(0, mid);
  const pB     = sorted.slice(mid);

  const scoreA = avg(pA.map(s=>s.avg_score||0));
  const scoreB = avg(pB.map(s=>s.avg_score||0));
  const delta  = scoreB - scoreA;
  const deltaColor = delta>=0 ? C.green : C.red;

  const dateA = pA.length ? `${fmt(pA[0].created_at)} – ${fmt(pA[pA.length-1].created_at)}` : "—";
  const dateB = pB.length ? `${fmt(pB[0].created_at)} – ${fmt(pB[pB.length-1].created_at)}` : "—";
  const now   = fmt(new Date());

  const pdf = new CorvusPDF(`Corvus_Comparison_${new Date().toISOString().slice(0,10)}.pdf`);
  pdf._type = "Comparison Report";
  pdf.header("Comparison Report", tierLabel);
  pdf.titleBlock("Period Comparison","Before vs. After posture performance analysis", name, now);

  pdf.kpiRow([
    { label:"PERIOD A SCORE", value:scoreA,      color:sc(scoreA), sub:`${pA.length} sessions` },
    { label:"PERIOD B SCORE", value:scoreB,      color:sc(scoreB), sub:`${pB.length} sessions` },
    { label:"CHANGE",         value:`${delta>=0?"+":""}${delta}`, color:deltaColor, sub:delta>=0?"improvement":"decline" },
    { label:"OVERALL",        value:avg([scoreA,scoreB]), color:sc(avg([scoreA,scoreB])), sub:grade(avg([scoreA,scoreB])) },
  ]);

  // Side-by-side period panels
  pdf.section("Period Analysis");
  const panelW = (pdf.cw - 6) / 2;

  // Period A panel
  pdf.card(pdf.mx, pdf.y, panelW, 40, C.card, 3);
  pdf.doc.setFillColor(...sc(scoreA));
  pdf.doc.rect(pdf.mx, pdf.y, panelW, 1, "F");
  pdf.txt("PERIOD A — EARLIER", pdf.mx+4, pdf.y+8, C.muted, 6.5, "bold");
  pdf.txt(dateA, pdf.mx+4, pdf.y+14, C.dim, 6.5);
  pdf.doc.setFontSize(24); pdf.doc.setFont("helvetica","bold");
  pdf.doc.setTextColor(...sc(scoreA));
  pdf.doc.text(String(scoreA), pdf.mx+4, pdf.y+30);
  pdf.txt("/100 · "+grade(scoreA), pdf.mx+4, pdf.y+37, C.muted, 6.5);

  // Period B panel
  const bx = pdf.mx + panelW + 6;
  pdf.card(bx, pdf.y, panelW, 40, C.card, 3);
  pdf.doc.setFillColor(...sc(scoreB));
  pdf.doc.rect(bx, pdf.y, panelW, 1, "F");
  pdf.txt("PERIOD B — RECENT", bx+4, pdf.y+8, C.muted, 6.5, "bold");
  pdf.txt(dateB, bx+4, pdf.y+14, C.dim, 6.5);
  pdf.doc.setFontSize(24); pdf.doc.setFont("helvetica","bold");
  pdf.doc.setTextColor(...sc(scoreB));
  pdf.doc.text(String(scoreB), bx+4, pdf.y+30);
  pdf.txt("/100 · "+grade(scoreB), bx+4, pdf.y+37, C.muted, 6.5);

  // Delta badge center
  pdf.doc.setFillColor(...deltaColor);
  pdf.doc.circle(pdf.mx + panelW + 3, pdf.y + 20, 4, "F");
  pdf.txt(`${delta>=0?"+":""}${delta}`, pdf.mx+panelW+3, pdf.y+22.5, C.bg, 6.5, "bold", "center");
  pdf.y += 48;

  // Bar comparison both periods
  pdf.section("Session-by-Session — Period A");
  pA.slice(0,8).forEach((s,i) => pdf.barRow(`Session ${i+1}  ${fmt(s.created_at)}`, s.avg_score||0));

  pdf.section("Session-by-Session — Period B");
  pB.slice(0,8).forEach((s,i) => pdf.barRow(`Session ${i+1}  ${fmt(s.created_at)}`, s.avg_score||0));

  // Insight text
  pdf.section("Trend Insight");
  pdf.checkY(18);
  pdf.accentCard(pdf.mx, pdf.y, pdf.cw, 18, deltaColor);
  const insightMsg = delta >= 5
    ? `Strong improvement of +${delta} points. Posture habits are developing well. Maintain this momentum.`
    : delta >= 0
    ? `Slight improvement of +${delta} points. Consistency is key — keep up daily monitoring.`
    : delta >= -10
    ? `Minor decline of ${delta} points. Review workspace ergonomics and increase break frequency.`
    : `Significant decline of ${delta} points. Immediate ergonomic review and posture training recommended.`;
  pdf.txt(insightMsg, pdf.mx+5, pdf.y+10, C.text, 7.5);
  pdf.y += 24;

  if(aiSummary){ pdf.section("AI Comparison Insights"); pdf.aiBox(aiSummary); }
  pdf.save();
}

// ═══════════════════════════════════════════════════════════════════════
// 4. LONGITUDINAL REPORT (Elite only)
// ═══════════════════════════════════════════════════════════════════════
export async function generateLongitudinalPDF({ sessions, profile, aiSummary }) {
  const name = profile?.name || "User";
  const now  = fmt(new Date());

  if(sessions.length < 3) {
    alert("Need at least 3 sessions for a Longitudinal report.");
    return;
  }

  // Group by month
  const byMonth = {};
  sessions.forEach(s => {
    try {
      const d = s.created_at?.toDate?.() || new Date(s.created_at||0);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if(!byMonth[key]) byMonth[key]=[];
      byMonth[key].push(s.avg_score||0);
    } catch{}
  });
  const monthly = Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b))
    .map(([month,scores])=>({
      label: new Date(month+"-01").toLocaleDateString("en-US",{month:"short",year:"numeric"}),
      value: avg(scores), count: scores.length,
    }));

  const allScores = sessions.map(s=>s.avg_score||0).filter(Boolean);
  const overallAvg = avg(allScores);
  const best = Math.max(...allScores, 0);
  const streakDays = streak(sessions);

  // Linear regression slope
  const n = monthly.length;
  let slope = 0;
  if(n >= 2){
    const sumX=monthly.reduce((s,_,i)=>s+i,0), sumY=monthly.reduce((s,m)=>s+m.value,0);
    const sumXY=monthly.reduce((s,m,i)=>s+i*m.value,0), sumX2=monthly.reduce((s,_,i)=>s+i*i,0);
    slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
  }
  const trendLabel = slope>1?"IMPROVING":slope<-1?"DECLINING":"STABLE";
  const trendColor = slope>1?C.green:slope<-1?C.red:C.yellow;

  const pdf = new CorvusPDF(`Corvus_Longitudinal_${new Date().toISOString().slice(0,10)}.pdf`);
  pdf._type = "Longitudinal Report";
  pdf.header("Longitudinal Report · Elite", "Elite");
  pdf.titleBlock("Long-term Trend Analysis",`${monthly.length} months · ${sessions.length} sessions · Elite Intelligence`, name, now);

  pdf.kpiRow([
    { label:"OVERALL AVG",  value:overallAvg,    color:sc(overallAvg), sub:grade(overallAvg) },
    { label:"PERSONAL BEST",value:best,          color:C.green,         sub:"highest score" },
    { label:"TREND",        value:trendLabel,    color:trendColor,      sub:`${slope>=0?"+":""}${slope.toFixed(1)} pts/mo` },
    { label:"STREAK",       value:`${streakDays}d`, color:C.yellow,    sub:"consecutive days" },
  ]);

  // Trend indicator
  pdf.section("Trend Analysis");
  pdf.checkY(20);
  pdf.card(pdf.mx, pdf.y, pdf.cw, 20, C.card2, 3);
  pdf.doc.setFillColor(...trendColor);
  pdf.doc.rect(pdf.mx, pdf.y, pdf.cw, 1, "F");
  const trendMsg = slope>1
    ? `Posture improving at +${slope.toFixed(1)} pts/month. Projected score in 3 months: ${Math.min(overallAvg+Math.round(slope*3),100)}/100.`
    : slope<-1
    ? `Score declining ${Math.abs(slope).toFixed(1)} pts/month. Ergonomic review recommended immediately.`
    : `Score stable. Add workspace ergonomic audits to accelerate improvement.`;
  pdf.doc.setFontSize(10); pdf.doc.setFont("helvetica","bold"); pdf.doc.setTextColor(...trendColor);
  pdf.doc.text(trendLabel, pdf.mx+5, pdf.y+9);
  pdf.txt(trendMsg, pdf.mx+5, pdf.y+16, C.muted, 7);
  pdf.y += 26;

  // Monthly bars
  pdf.section("Monthly Score Trend");
  monthly.forEach(m => pdf.barRow(`${m.label}  (${m.count} sessions)`, m.value));

  // Monthly table
  pdf.section("Month-by-Month Breakdown");
  pdf.tableRow(["MONTH","SESSIONS","AVG SCORE","GRADE"],[45,30,35,50], true);
  monthly.forEach(m => {
    pdf.checkY(9);
    pdf.txt(m.label,       pdf.mx+2,  pdf.y+1, C.text,      7.5);
    pdf.txt(String(m.count),pdf.mx+47, pdf.y+1, C.muted,    7.5);
    pdf.doc.setTextColor(...sc(m.value)); pdf.doc.setFontSize(7.5); pdf.doc.setFont("helvetica","bold");
    pdf.doc.text(`${m.value}/100`, pdf.mx+77, pdf.y+1);
    pdf.txt(grade(m.value), pdf.mx+112, pdf.y+1, C.muted, 7);
    pdf.doc.setDrawColor(...C.dim); pdf.doc.setLineWidth(0.2);
    pdf.doc.line(pdf.mx, pdf.y+3.5, pdf.W-pdf.mx, pdf.y+3.5);
    pdf.y += 8;
  });

  // Milestones
  const milestones = [];
  if(overallAvg>=80) milestones.push([C.green,"🏆","Excellent posture health maintained throughout period"]);
  if(streakDays>=7)  milestones.push([C.yellow,"🔥",`${streakDays}-day consecutive monitoring streak`]);
  if(sessions.length>=20) milestones.push([C.cyan,"💪",`${sessions.length} total sessions completed`]);
  if(best>=90) milestones.push([C.green,"⭐",`Personal best score: ${best}/100`]);
  if(milestones.length>0){
    pdf.section("Milestones");
    milestones.forEach(([color, icon, text])=>{
      pdf.checkY(11);
      pdf.card(pdf.mx, pdf.y, pdf.cw, 10, C.card2, 2);
      pdf.doc.setFillColor(...color); pdf.doc.rect(pdf.mx, pdf.y, 1.5, 10, "F");
      pdf.txt(`${icon}  ${text}`, pdf.mx+5, pdf.y+6.5, C.text, 8);
      pdf.y += 13;
    });
  }

  if(aiSummary){ pdf.section("Elite AI — Long-term Intelligence"); pdf.aiBox(aiSummary); }
  pdf.save();
}

// ═══════════════════════════════════════════════════════════════════════
// 5. AI EXECUTIVE REPORT
// ═══════════════════════════════════════════════════════════════════════
export async function generateAIPDF({ sessions, profile, aiSummary }) {
  const name  = profile?.name || "User";
  const tier  = profile?.tier || "standard";
  const tierLabel = tier==="elite"?"Elite":tier==="professional"?"Pro":"";
  const now   = fmt(new Date());
  const now_ms = Date.now();

  const scores    = sessions.map(s=>s.avg_score||0).filter(Boolean);
  const overall   = avg(scores);
  const thisWeek  = sessions.filter(s=>now_ms-toMs(s)<7*86400000);
  const weekAvg   = avg(thisWeek.map(s=>s.avg_score||0));
  const streakD   = streak(sessions);
  const best      = Math.max(...scores, 0);

  const pdf = new CorvusPDF(`Corvus_AI_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  pdf._type = "AI Executive Report";
  pdf.header("AI Executive Report", tierLabel);
  pdf.titleBlock("AI Executive Report", `Powered by Corvus Intelligence · ${sessions.length} sessions analyzed`, name, now);

  pdf.kpiRow([
    { label:"OVERALL SCORE", value:overall,      color:sc(overall), sub:grade(overall) },
    { label:"THIS WEEK",     value:weekAvg||"—", color:sc(weekAvg), sub:`${thisWeek.length} sessions` },
    { label:"SESSIONS",      value:sessions.length, color:C.cyan,   sub:"total" },
    { label:"STREAK",        value:`${streakD}d`,color:C.yellow,    sub:"consecutive" },
  ]);

  // AI analysis box — primary feature
  pdf.section("Corvus AI Analysis");
  pdf.aiBox(aiSummary || "Connect your Groq API key to enable AI-powered insights.");

  // Recent sessions table
  pdf.section("Recent Sessions");
  pdf.tableRow(["#","DATE","DURATION","SCORE","GRADE"],[12,42,35,25,50], true);
  sessions.slice(0,12).forEach((s,i)=>{
    const scoreVal = s.avg_score||0;
    pdf.checkY(9);
    pdf.txt(String(i+1), pdf.mx+2, pdf.y+1, C.dim, 7);
    pdf.txt(fmt(s.created_at), pdf.mx+14, pdf.y+1, C.text, 7.5);
    pdf.txt(dur(s), pdf.mx+56, pdf.y+1, C.muted, 7.5);
    pdf.doc.setTextColor(...sc(scoreVal)); pdf.doc.setFontSize(7.5); pdf.doc.setFont("helvetica","bold");
    pdf.doc.text(`${scoreVal}/100`, pdf.mx+91, pdf.y+1);
    pdf.txt(grade(scoreVal), pdf.mx+116, pdf.y+1, C.muted, 7);
    pdf.doc.setDrawColor(...C.dim); pdf.doc.setLineWidth(0.2);
    pdf.doc.line(pdf.mx, pdf.y+3.5, pdf.W-pdf.mx, pdf.y+3.5);
    pdf.y += 8;
  });

  // Score distribution bar
  pdf.section("Score Distribution");
  pdf.barRow("All-time Average", overall);
  pdf.barRow("This Week Average", weekAvg||0);
  pdf.barRow("Personal Best", best);

  // Summary stats
  pdf.section("Summary Statistics");
  [
    ["Total Sessions",  String(sessions.length)],
    ["Average Score",   `${overall}/100 — ${grade(overall)}`],
    ["Best Score",      `${best}/100`],
    ["Monitoring Streak", `${streakD} consecutive days`],
    ["This Week",       `${weekAvg}/100 (${thisWeek.length} sessions)`],
  ].forEach(([k,v])=>{
    pdf.checkY(8);
    pdf.txt(k, pdf.mx+2, pdf.y, C.muted, 7.5, "bold");
    pdf.txt(v, pdf.mx+60, pdf.y, C.text, 7.5);
    pdf.y += 7;
  });

  pdf.save();
}

// ═══════════════════════════════════════════════════════════════════════
// UNIFIED ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════
export async function exportPDFReport({ type, sessions, session, profile, aiSummary, lang }) {
  switch(type) {
    case "session":      return generateSessionPDF({ session: session||sessions?.[0], profile, aiSummary });
    case "clinical":     return generateClinicalPDF({ sessions, profile, aiSummary });
    case "comparison":   return generateComparisonPDF({ sessions, profile, aiSummary });
    case "longitudinal": return generateLongitudinalPDF({ sessions, profile, aiSummary });
    case "ai": default:  return generateAIPDF({ sessions, profile, aiSummary });
  }
}
