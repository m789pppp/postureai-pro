/**
 * pdfReports.js — Corvus PDF Report System
 * Restored from Design System v5 (ae1b320)
 * Apple Health × Bloomberg Terminal × WHO Medical Reports
 */

import { tierAtLeast } from "./tierQuality.js";
import { installArabicText } from "./arabicShaper.js";

// ── Metric labels (used in PDF tables) ───────────────────────────
// Keys must match the ACTUAL keys the posture engine emits (see
// postureEngine.js metrics object): fhp_index, shoulder_level,
// rounded_shoulders, elbow_angle, monitor_height, screen_distance …
// Missing aliases previously fell through to a naive title-case that
// produced wrong labels like "Fhp Index".
const METRIC_LABELS = {
  neck_lean:"Neck Lean", neck_lean_side:"Neck Lean (Side)",
  head_tilt:"Head Tilt", head_yaw:"Head Rotation",
  shoulder:"Shoulder Balance", shoulder_level:"Shoulder Level",
  spine_lean:"Spine Lean",
  spine_align:"Spine Alignment", fhp:"Forward Head Posture",
  fhp_index:"Forward Head Posture", fhp_side:"Forward Head (Side)",
  rounded:"Rounded Shoulders", rounded_shoulders:"Rounded Shoulders",
  elbow:"Elbow Angle", elbow_angle:"Elbow Angle",
  monitor:"Monitor Height", monitor_height:"Monitor Height",
  distance:"Viewing Distance", screen_distance:"Screen Distance",
  trunk_lean:"Trunk Lean",
  hip_angle:"Hip Angle", knee_angle:"Knee Angle",
  session_fatigue:"Fatigue Adjustment", confidence_val:"Detection Confidence",
};
const METRIC_LABELS_AR = {
  neck_lean:"ميل الرقبة", neck_lean_side:"ميل الرقبة (جانبي)",
  head_tilt:"انحناء الرأس", head_yaw:"دوران الرأس",
  shoulder:"توازن الكتفين", shoulder_level:"مستوى الكتفين",
  spine_lean:"ميل العمود الفقري",
  spine_align:"محاذاة العمود الفقري", fhp:"تقدم الرأس للأمام",
  fhp_index:"تقدم الرأس للأمام", fhp_side:"تقدم الرأس (جانبي)",
  rounded:"تقوّس الأكتاف", rounded_shoulders:"تقوّس الأكتاف",
  elbow:"زاوية الكوع", elbow_angle:"زاوية الكوع",
  monitor:"ارتفاع الشاشة", monitor_height:"ارتفاع الشاشة",
  distance:"مسافة المشاهدة", screen_distance:"مسافة الشاشة",
  trunk_lean:"ميل الجذع",
  hip_angle:"زاوية الورك", knee_angle:"زاوية الركبة",
  session_fatigue:"تعديل الإجهاد", confidence_val:"دقة الكشف",
};

// session_fatigue and confidence_val are meta/diagnostic fields the engine
// attaches to every metrics object — not real posture metrics with an
// "ideal angle" to correct. Left un-excluded, they were being iterated
// alongside neck_lean/head_tilt/etc in the per-session priority tables AND
// in the cross-session longitudinal trend analysis, where confidence_val's
// naturally lower value could surface as a bogus "recurring pattern" (e.g.
// "Detection Confidence" listed as a top concern next to real posture
// issues). Exclude both from any generic Object.entries(metrics) walk.
const META_METRIC_KEYS = new Set(["session_fatigue", "confidence_val"]);


// ── Elite-extras helpers (goal progress / exercise plan / snapshots) ──
const _exToMs = s => { try { return s.created_at?.toDate?.()?.getTime?.() || new Date(s.created_at||0).getTime(); } catch { return 0; } };

function _exWeekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  return `${y}-W${String(Math.ceil(((t - Date.UTC(y,0,1)) / 86400000 + 1) / 7)).padStart(2,"0")}`;
}

function _exWindowAvg(sessions, fromMs, toMs) {
  const sc = (sessions||[]).filter(s => { const m=_exToMs(s); return m>=fromMs && m<toMs && (s.avg_score||0)>0; }).map(s=>s.avg_score);
  return sc.length ? Math.round(sc.reduce((a,b)=>a+b,0)/sc.length) : null;
}

/** pts/day linear-regression slope over the last `days` days — mirrors EliteGoals.jsx */
function _exSlopePerDay(sessions, days = 30) {
  const cutoff = Date.now() - days*86400000;
  const pts = (sessions||[]).map(s=>({t:_exToMs(s), y:s.avg_score||0})).filter(p=>p.t>=cutoff&&p.y>0).sort((a,b)=>a.t-b.t);
  if (pts.length < 4) return null;
  const xs = pts.map(p=>(p.t-pts[0].t)/86400000), ys = pts.map(p=>p.y), n = xs.length;
  const sx = xs.reduce((a,b)=>a+b,0), sy = ys.reduce((a,b)=>a+b,0);
  const sxy = xs.reduce((a,x,i)=>a+x*ys[i],0), sx2 = xs.reduce((a,x)=>a+x*x,0);
  const denom = n*sx2 - sx*sx;
  return Math.abs(denom) < 1e-6 ? null : (n*sxy - sx*sy) / denom;
}

// Exercise-plan area labels for the PDF (mirrors ExercisePlan.jsx LIB)
const _EX_AREA_LABELS = {
  neck:      { en: "Neck / Forward head",        ar: "الرقبة / تقدم الرأس" },
  shoulders: { en: "Rounded shoulders / chest",  ar: "الأكتاف المدورة / الصدر" },
  spine:     { en: "Spine / trunk",              ar: "العمود الفقري / الجذع" },
  recovery:  { en: "Recovery & habits",          ar: "استشفاء وعادات" },
};

// ── Metric mini-card (session PDF) — label + value + score bar ─────
// Redesigned to eliminate the Arabic/long-label collision with the old
// right-side score ring: label is truncated to the free width, the score
// number is right-aligned, and a horizontal bar sits along the bottom.
function _metricMiniCard(doc,{mx,y,mw,mh,lbl,sc,val,unit,pri,isAr,sf,dCard,BORDER,TEXT,TEXT2,TEXT3}){
  const round=(n)=>Math.round(n);
  const iconC = sc<40?[239,68,68]:sc<65?[245,158,11]:[34,197,94];
  dCard(mx,y,mw,mh,5);
  // Left accent bar
  fc(doc,...iconC); rr(doc,mx,y,2.2,mh,1.1,"F");
  // Label — truncated so it never reaches the right-aligned score
  sf(8,"bold"); tc(doc,...TEXT);
  doc.text(_fit(doc,lbl,mw-26), mx+6, y+9);
  // Value under label
  if(val!==undefined&&val!==null){
    sf(6.5,"normal"); tc(doc,...TEXT2);
    doc.text(_fit(doc,`${round(val*10)/10}${unit||""}`,mw-14), mx+6, y+15.5);
  }
  // Score number (right)
  sf(15,"bold"); tc(doc,...iconC); doc.text(String(round(sc)), mx+mw-6, y+13, {align:"right"});
  sf(5,"normal"); tc(doc,...TEXT3); doc.text("/100", mx+mw-6, y+18, {align:"right"});
  // Progress bar
  const bx=mx+6, bw=mw-12;
  fc(doc,...BORDER); rr(doc,bx,y+21,bw,4,2,"F");
  fc(doc,...iconC); rr(doc,bx,y+21,Math.max(bw*(sc/100),3),4,2,"F");
  // Priority badge
  const pw=doc.getTextWidth(pri)+8;
  fc(doc,...iconC); doc.setGState&&doc.setGState(new doc.GState({opacity:.13}));
  rr(doc,mx+6,y+mh-9,pw,6.5,2,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  sf(5.5,"bold"); tc(doc,...iconC); doc.text(pri, mx+6+pw/2, y+mh-4.5, {align:"center"});
}

// ── Vector glyphs — jsPDF's built-in helvetica has no arrows/triangles,
//    so we draw them (text glyphs render as garbage like "!'" or "Ø=ÜÈ") ──
function _chevronR(doc,x,y,col){ // small right chevron, ~3mm
  dc(doc,...col); lw(doc,0.8);
  doc.line(x,y-1.6,x+2.4,y); doc.line(x+2.4,y,x,y+1.6); lw(doc,0.3);
}
function _triangle(doc,cx,cy,dir,col){ // dir: "up" | "down" | "flat"
  fc(doc,...col);
  if(dir==="flat"){ rr(doc,cx-2.2,cy-0.7,4.4,1.4,0.6,"F"); return; }
  const s=2.2, d=dir==="up"?-1:1;
  try{ doc.triangle(cx-s,cy-d*s*0.9, cx+s,cy-d*s*0.9, cx,cy+d*s*1.1, "F"); }
  catch{ rr(doc,cx-2,cy-0.7,4,1.4,0.6,"F"); }
}

// ── Proportional arc gauge — a real progress arc (not a full ring) that
//    sweeps clockwise from 12 o'clock by `frac` of a full turn. This is
//    the single biggest premium upgrade over the old two-full-circles
//    look. jsPDF has no arc primitive, so we stroke short segments. ──
function _arcGauge(doc,cx,cy,r,frac,col,track,width=3.6){
  frac=Math.max(0,Math.min(1,frac));
  const cap = doc.setLineCap ? true : false;
  // Track ring
  dc(doc,...track); lw(doc,width); doc.circle(cx,cy,r,"S");
  if(frac<=0){ lw(doc,0.3); return; }
  // Progress arc
  if(cap) doc.setLineCap("round");
  dc(doc,...col); lw(doc,width);
  const start=-Math.PI/2, end=start+frac*2*Math.PI;
  const steps=Math.max(2,Math.round(frac*72));
  let px=cx+r*Math.cos(start), py=cy+r*Math.sin(start);
  for(let i=1;i<=steps;i++){
    const a=start+(end-start)*(i/steps);
    const nx=cx+r*Math.cos(a), ny=cy+r*Math.sin(a);
    doc.line(px,py,nx,ny); px=nx; py=ny;
  }
  if(cap) doc.setLineCap("butt");
  lw(doc,0.3);
}

// ── Simple vector KPI icons (helvetica has no usable symbol glyphs) ──
function _icon(doc,type,cx,cy,col,s=3){
  dc(doc,...col); fc(doc,...col); lw(doc,0.9);
  const cap=doc.setLineCap?true:false; if(cap)doc.setLineCap("round");
  if(type==="check"){ doc.line(cx-s*0.7,cy,cx-s*0.15,cy+s*0.6); doc.line(cx-s*0.15,cy+s*0.6,cx+s*0.8,cy-s*0.7); }
  else if(type==="bell"){ doc.line(cx-s*0.8,cy+s*0.5,cx+s*0.8,cy+s*0.5); doc.line(cx-s*0.6,cy+s*0.5,cx-s*0.6,cy-s*0.1); doc.line(cx+s*0.6,cy+s*0.5,cx+s*0.6,cy-s*0.1); dc(doc,...col); doc.circle(cx,cy-s*0.4,s*0.55,"S"); doc.circle(cx,cy+s*0.95,s*0.22,"F"); }
  else if(type==="clock"){ doc.circle(cx,cy,s*0.85,"S"); doc.line(cx,cy,cx,cy-s*0.5); doc.line(cx,cy,cx+s*0.4,cy+s*0.15); }
  else if(type==="hash"){ doc.line(cx-s*0.5,cy-s*0.8,cx-s*0.8,cy+s*0.8); doc.line(cx+s*0.5,cy-s*0.8,cx+s*0.2,cy+s*0.8); doc.line(cx-s,cy-s*0.25,cx+s*0.9,cy-s*0.25); doc.line(cx-s,cy+s*0.3,cx+s*0.9,cy+s*0.3); }
  else if(type==="target"){ doc.circle(cx,cy,s*0.9,"S"); doc.circle(cx,cy,s*0.45,"S"); fc(doc,...col); doc.circle(cx,cy,s*0.12,"F"); }
  else { fc(doc,...col); doc.circle(cx,cy,s*0.5,"F"); }
  if(cap)doc.setLineCap("butt"); lw(doc,0.3);
}

// ── Unified entry point (called from AIReports.jsx + App.jsx) ──────
export async function exportPDFReport({ type, sessions, session, profile, aiSummary, lang="en" }) {
  // Always use the most recent session (first in array = most recent from Firestore)
  const latestSession = session || sessions?.[0];
  switch(type) {
    case "session":      return generateSessionPDF({ session: latestSession, profile, aiSummary, lang, allSessions: sessions });
    case "clinical":     return generateClinicalPDF({ session: latestSession, profile, aiSummary, lang, allSessions: sessions });
    case "comparison":   return generateComparisonPDF({ sessions, profile, aiSummary, lang });
    case "longitudinal": return generateLongitudinalPDF({ sessions, profile, aiSummary, lang });
    case "ai": default:  return generateAIPDF({ sessions, profile, aiSummary, lang });
  }
}

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// CORVUS PDF DESIGN SYSTEM v5 — World-Class Medical Intelligence
// Philosophy: Apple Health × Bloomberg Terminal × WHO Medical Reports
// Every component is purpose-built. Nothing is decorative without meaning.
// ═══════════════════════════════════════════════════════════════════

// ── Extended Design Tokens ─────────────────────────────────────────
const PDF_TOKENS = {
  // Core brand
  primary:   [37,99,235],   primaryDk:[30,64,175],  primaryLt:[239,246,255],
  success:   [34,197,94],   successDk:[21,128,61],  successLt:[240,253,244],
  warning:   [245,158,11],  warningDk:[180,83,9],   warningLt:[255,251,235],
  danger:    [239,68,68],   dangerDk:[185,28,28],   dangerLt:[254,242,242],
  // Neutrals — editorial grade
  ink:       [11,17,32],    ink2:[24,33,54],   sub:[44,55,82],
  muted:     [96,108,135],  light:[152,165,190], ghost:[210,218,235],
  // Surfaces
  bg:        [247,249,252], bgAlt:[242,245,251], bgDeep:[236,240,248],
  card:      [255,255,255], cardHover:[252,253,255],
  border:    [224,229,240], borderSoft:[237,240,248], borderStrong:[196,206,224],
  // Dark surfaces (cover pages)
  slate:     [10,17,35],    slateM:[18,28,52],  slateLt:[28,40,70],
  slateAccent:[38,55,95],
  // Semantic tints
  successBg: [220,252,231], dangerBg:[254,226,226], warningBg:[254,243,199], primaryBg:[219,234,254],
  // Medical spectrum
  riskLow:   [16,185,129],  riskMed:[245,158,11],  riskHigh:[239,68,68],
  // Data viz palette
  indigo:    [99,102,241],  violet:[139,92,246],
  cyan:      [6,182,212],   teal:[20,184,166],
  rose:      [244,63,94],   amber:[251,191,36],
  // Elevation (for layering effect simulation)
  elev1:     [250,251,255], elev2:[245,247,254], elev3:[240,244,252],
};

// ── Typography Scale — 8pt baseline grid ──────────────────────────
const PDF_FLAGS = {
  display:   28,   // Hero numbers, cover title
  h1:        17,   // Page section title
  h2:        13,   // Subsection
  h3:        10.5, // Card title
  body:       9,   // Body text
  small:      7.5, // Labels, captions
  micro:      6,   // Footnotes, page refs
  data:      11,   // Data numbers (tabular)
  dataLg:    18,   // Large KPI numbers
  dataXl:    26,   // Hero scores
};

// ── Spacing — 8pt grid ────────────────────────────────────────────
const SP = { xs:2, sm:4, md:8, lg:12, xl:20, xxl:32, page:18 };


// ── Core helpers ───────────────────────────────────────────────────
function _sc(s){ return s>=80?PDF_TOKENS.success:s>=60?PDF_TOKENS.warning:PDF_TOKENS.danger; }
const _scoreColor = _sc; // alias used in Comparison + Longitudinal + Team PDFs
function _scoreLabel(s,isAr){
  if(s>=80) return isAr?"ممتاز":"Excellent";
  if(s>=60) return isAr?"جيد":"Good";
  if(s>=40) return isAr?"مقبول":"Fair";
  return isAr?"يحتاج تحسين":"Needs Work";
}
// Normalize tier string aliases (personal_elite→elite, b2b_growth→professional, etc.)
const _t = t => (!t?"standard":t.includes("elite")||t==="enterprise"||t==="premium"?"elite":t.includes("pro")||t.includes("professional")||t==="growth"?"professional":t);
function _scLt(s){ return s>=80?PDF_TOKENS.successLt:s>=60?PDF_TOKENS.warningLt:PDF_TOKENS.dangerLt; }
function _sl(s,ar){ return s>=80?(ar?"ممتاز":"Excellent"):s>=60?(ar?"جيد":"Good"):(ar?"يحتاج تحسين":"Needs Work"); }
// null = no reading. Made explicit at the primitives because there are five
// separate zone renderers in this file and each one had its own `|| 0`, which
// turns "we could not see your lower back" into "your lower back scored 0% —
// low risk", the best possible result. Confirmed on a real report: the Spinal
// Zone Risk Map printed "Lumbar L1-S1 · 0% RISK · Risk: Low" for the one zone
// a laptop camera cannot see.
function _riskLabel(v,ar){ return v==null?(ar?"مش متقاس":"not measured")
  :v>=70?(ar?"عالي":"High"):v>=40?(ar?"متوسط":"Moderate"):(ar?"منخفض":"Low"); }
function _riskColor(v){ return v==null?PDF_TOKENS.muted
  :v>=70?PDF_TOKENS.danger:v>=40?PDF_TOKENS.warning:PDF_TOKENS.success; }
function _riskPct(v){ return v==null?"n/a":`${v}%`; }
function _fmtDur(s){ if(!s)return"—"; const m=Math.floor(s/60),r=s%60; return m>0?`${m}m ${r}s`:`${r}s`; }
function _fmtDate(ts,ar){
  if(!ts)return"—";
  try{ const d=ts?.toDate?ts.toDate():new Date(ts);
    return d.toLocaleDateString(ar?"ar-EG":"en-US",{year:"numeric",month:"short",day:"numeric"}); }
  catch{return"—";}
}
function _fmtDateLong(ts,ar){
  if(!ts)return"—";
  try{ const d=ts?.toDate?ts.toDate():new Date(ts);
    return d.toLocaleDateString(ar?"ar-EG":"en-US",{year:"numeric",month:"long",day:"numeric"}); }
  catch{return"—";}
}
const _gc = _sc; // legacy alias
const _gl = _sl; // legacy alias

// ── Draw primitives ────────────────────────────────────────────────
function dc(doc,...c){doc.setDrawColor(...c);}
function fc(doc,...c){doc.setFillColor(...c);}
function tc(doc,...c){doc.setTextColor(...c);}
function lw(doc,w){doc.setLineWidth(w);}
function rr(doc,x,y,w,h,r=3,m="F"){doc.roundedRect(x,y,w,h,r,r,m);}
function hr(doc,x,y,w,col=PDF_TOKENS.border,thickness=0.18){dc(doc,...col);lw(doc,thickness);doc.line(x,y,x+w,y);lw(doc,0.3);}
function vl(doc,x,y,h,col=PDF_TOKENS.border){dc(doc,...col);lw(doc,0.18);doc.line(x,y,x,y+h);lw(doc,0.3);}

// Truncate a single-line string with "…" so it never overflows a fixed-width
// slot (table cell, footer strip, badge) — must be called AFTER the font
// for that text has been set (doc.getTextWidth depends on the active font).
function _fit(doc,text,maxW){
  text = String(text ?? "");
  if (maxW<=0 || doc.getTextWidth(text)<=maxW) return text;
  let t = text;
  while (t.length>1 && doc.getTextWidth(t+"…")>maxW) t = t.slice(0,-1);
  return t.length<=1 ? t : t+"…";
}

// Sanitize free-form text (company name, etc.) for safe use in a filename
// across Windows/macOS/Linux and browser download/upload flows — keeps
// alnum/dash/underscore, collapses everything else to "_", caps length.
function _safeFilename(s){
  return String(s||"")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g,"") // strip accents, keep Arabic as-is
    .replace(/[^\p{L}\p{N}_-]+/gu,"_")
    .replace(/_+/g,"_").replace(/^_|_$/g,"")
    .slice(0,60) || "Report";
}

// ── Font helper ────────────────────────────────────────────────────
let _cairoLoaded=false, _cairoCachedB64=null;
// isAr gate added: registering this font (even completely unused) adds
// real weight to every generated PDF — measured ~50KB+ on a trivial doc,
// and every English-only report was paying that cost with zero benefit
// since Arabic glyphs are never drawn. Skip the load entirely when the
// report isn't Arabic.
async function _ensureCairoFont(doc,isAr=false){
  if(!isAr) return;
  try{
    if(!_cairoCachedB64){const{CAIRO_B64}=await import("../assets/cairoFont.js");_cairoCachedB64=CAIRO_B64;}
    doc.addFileToVFS("Cairo-Regular.ttf",_cairoCachedB64);
    doc.addFont("Cairo-Regular.ttf","cairo","normal");
    doc.addFileToVFS("Cairo-Bold.ttf",_cairoCachedB64);
    doc.addFont("Cairo-Bold.ttf","cairo","bold");
    _cairoLoaded=true;
    // Install the correct Arabic reshaper on this doc. jsPDF 4.x's built-in
    // Arabic processor drops the definite-article alef and mangles lam-alef;
    // our shaper pre-builds presentation forms in visual order, which jsPDF
    // then renders verbatim. English strings pass through untouched.
    installArabicText(doc);
  }catch(e){console.warn("Cairo font failed:",e?.message||e);}
}
async function _loadCairo(doc,isAr=false){await _ensureCairoFont(doc,isAr);return _cairoLoaded;}

function font(doc,size,style="normal",isAr=false){
  doc.setFont(isAr&&_cairoLoaded?"cairo":"helvetica",style);
  doc.setFontSize(size);
}
function fontAr(doc,size,style="normal",useAr=false){
  doc.setFont(useAr&&_cairoLoaded?"cairo":"helvetica",style);
  doc.setFontSize(size);
}

// ── Logo ───────────────────────────────────────────────────────────
let _logoSm=null,_logoMd=null,_logoLg=null;
async function _ensureLogo(){
  if(_logoSm)return;
  try{const{LOGO_SM_B64,LOGO_MD_B64,LOGO_LG_B64}=await import("../assets/corvusLogo.js");
    _logoSm=LOGO_SM_B64;_logoMd=LOGO_MD_B64;_logoLg=LOGO_LG_B64;}
  catch(e){console.warn("Logo load failed:",e);}
}
function _logo(doc,x,y,sz,b64){
  if(b64){try{doc.addImage(b64,"PNG",x,y,sz,sz);return;}catch{}}
  fc(doc,3,11,20);rr(doc,x,y,sz,sz,sz*.14,"F");
  fc(doc,...PDF_TOKENS.primary);rr(doc,x+sz*.19,y+sz*.19,sz*.62,sz*.62,sz*.12,"F");
  font(doc,sz*.42,"bold");tc(doc,...PDF_TOKENS.card);doc.text("P",x+sz/2,y+sz*.72,{align:"center"});
}

// ── _zonalRisk ─────────────────────────────────────────────────────
/**
 * One metric's score, or null when there isn't one.
 *
 * Everything in this file used to read `metrics[k]?.score ?? 100` (or ?? 70),
 * which turns BOTH failure modes into a perfect reading: a key that does not
 * exist, and a metric the engine explicitly marked unmeasurable. Both are
 * common here — see _ZONES below for the keys, and note that every hip-derived
 * metric reports reliable:false at laptop framing, which is every session.
 *
 * null means "no reading". Callers average over what they have and say so when
 * they have nothing, instead of printing a number that came from a default.
 */
export function _metricScore(metrics, k){
  const m = metrics?.[k];
  if (typeof m === "number") return Number.isFinite(m) ? m : null;
  if (!m || m.reliable === false) return null;
  return Number.isFinite(m.score) ? m.score : null;
}

// The engine's real keys. The three zones below previously referenced
// `shoulder`, `spine_align`, `hip_angle` and `trunk_lean` — FOUR names the
// engine has never emitted, in a file that also uses `distance` for
// `screen_distance`. Eighteen references in total, every one resolving to
// undefined and falling through to a full-marks default.
//
// The arithmetic consequence was not subtle: lumbar risk was
// 100 - (100+100+100)/3 = 0 for every user, in every session, always. A
// printed "lower back risk: 0" that was a constant wearing a formula, on the
// Elite clinical report.
const _ZONES = {
  cervical: ["neck_lean", "head_tilt", "head_yaw"],
  thoracic: ["shoulder_level", "rounded_shoulders", "shoulder_elevation"],
  lumbar:   ["spine_lean", "torso_flexion", "trunk_rotation"],
};

/**
 * Risk per body zone, 0-100, or null for a zone with nothing measured.
 * A null zone must be rendered as "not measured", never as 0 — zero risk and
 * no reading are opposite statements.
 */

// Rendering helpers for a zone that has no reading.
//
// Every call site read `zonal[k] || 0`, which prints an unmeasured zone as
// "0%" — and on a risk scale 0% is the BEST possible result. So the clinical
// spine diagram reported "Lumbar L1-S1: 0%, low risk" for the one zone this
// product cannot see from a laptop. Zero risk and no reading are opposite
// statements and must not share a rendering.
const _zNum   = (z,k) => (z?.[k] ?? null);
const _zHas   = (z,k) => _zNum(z,k) !== null;
const _zBar   = (z,k) => _zHas(z,k) ? _zNum(z,k) : 0;          // geometry only
const _zPct   = (z,k,isAr) => _zHas(z,k) ? `${_zNum(z,k)}%` : (isAr?"مش متقاس":"not measured");
const _zColor = (z,k) => _zHas(z,k) ? _riskColor(_zNum(z,k)) : [120,130,145];
const _zLabel = (z,k,isAr) => _zHas(z,k) ? _riskLabel(_zNum(z,k),isAr) : (isAr?"مش متقاس":"not measured");

function _zonalRisk(metrics){
  const out = { cervical:null, thoracic:null, lumbar:null };
  if(!metrics) return out;
  for(const [zone, keys] of Object.entries(_ZONES)){
    const vals = keys.map(k=>_metricScore(metrics,k)).filter(v=>v!==null);
    out[zone] = vals.length
      ? Math.round(100 - Math.min(100, vals.reduce((a,b)=>a+b,0) / vals.length))
      : null;
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════
// v5 PREMIUM COMPONENTS
// ══════════════════════════════════════════════════════════════════

// ── COVER HEADER — cinematic dark with brand gradient ─────────────
function _coverV5(doc,W,ml,tier,tierCol,name,label,sub,now){
  // Full bleed dark
  fc(doc,...PDF_TOKENS.slate);doc.rect(0,0,W,76,"F");
  // Layered depth circles (brand feel)
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.05}));
  doc.circle(W*.88,38,68,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.03}));
  doc.circle(W*.88,38,90,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.015}));
  doc.circle(W*.88,38,112,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Top accent
  fc(doc,...tierCol);doc.rect(0,0,W,2.5,"F");
  // Logo
  _logo(doc,ml,16,28,_logoMd);
  // Brand
  font(doc,13.5,"bold");tc(doc,...PDF_TOKENS.card);doc.text("CORVUS",ml+36,30);
  font(doc,6.5,"normal");tc(doc,130,148,180);doc.text("Health Intelligence Platform",ml+36,38);
  // Tier badge
  const tw=doc.getTextWidth(tier.toUpperCase())+12;
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.16}));
  rr(doc,ml+36,43,tw,10,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,7,"bold");tc(doc,...tierCol);
  doc.text(tier.toUpperCase(),ml+36+tw/2,49.5,{align:"center"});
  // Right: date + label
  font(doc,6.5,"normal");tc(doc,130,148,180);doc.text(now,W-ml,27,{align:"right"});
  font(doc,7.5,"bold");tc(doc,...PDF_TOKENS.card);doc.text(_fit(doc,label,W-2*ml-90),W-ml,37,{align:"right"});
  if(sub){font(doc,6.5,"normal");tc(doc,130,148,180);doc.text(_fit(doc,sub,W-2*ml-90),W-ml,45,{align:"right"});}
  // Bottom divider
  fc(doc,...tierCol);doc.rect(0,73.5,W,2.5,"F");
}

// ── INNER PAGE HEADER ──────────────────────────────────────────────
function _hdr(doc,W,ml,mr,label,isAr){
  fc(doc,...PDF_TOKENS.bg);doc.rect(0,0,W,15,"F");
  fc(doc,...PDF_TOKENS.primary);doc.rect(0,15,W,.35,"F");
  _logo(doc,ml,3.5,8,_logoSm);
  font(doc,7.5,"bold");tc(doc,...PDF_TOKENS.ink2);doc.text("Corvus",ml+12,10);
  font(doc,6.5,"normal");tc(doc,...PDF_TOKENS.muted);doc.text("Health Intelligence",ml+28,10);
  font(doc,7,"bold",isAr);tc(doc,...PDF_TOKENS.primary);doc.text(_fit(doc,label,W-mr-ml-62),W-mr,10,{align:"right"});
}

// ── FOOTER ─────────────────────────────────────────────────────────
function _ftr(doc,W,ml,mr,H,p,total,name){
  hr(doc,0,H-10,W,PDF_TOKENS.border);
  fc(doc,...PDF_TOKENS.bg);doc.rect(0,H-9.5,W,9.5,"F");
  font(doc,PDF_FLAGS.micro,"normal");tc(doc,...PDF_TOKENS.ghost);
  doc.text("Corvus Health Intelligence · Confidential · Not a medical diagnosis",ml,H-3.5);
  font(doc,PDF_FLAGS.micro,"bold");tc(doc,...PDF_TOKENS.muted);
  doc.text(_fit(doc,name,W*0.4),W/2,H-3.5,{align:"center"});
  doc.text(`${p} / ${total}`,W-mr,H-3.5,{align:"right"});
}

// ── SECTION HEADING with left accent ─────────────────────────────
function _sh(doc,ml,y,title,sub="",col=PDF_TOKENS.primary,isAr=false,maxW=175){
  fc(doc,...col);doc.rect(ml,y,2.2,sub?14:9.5,"F");
  font(doc,PDF_FLAGS.h2,"bold",isAr);tc(doc,...PDF_TOKENS.ink);doc.text(_fit(doc,title,maxW),ml+7,y+(sub?7:7));
  if(sub){font(doc,PDF_FLAGS.small,"normal",isAr);tc(doc,...PDF_TOKENS.light);doc.text(_fit(doc,sub,maxW),ml+7,y+13);}
  return y+(sub?21:14);
}

// ── SCORE RING v5 — with inner glow simulation ─────────────────────
function _ring(doc,cx,cy,r,score,isAr,showGrade=true){
  const col=_sc(score),lbl=_sl(score,isAr);
  // Inner tint
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.06}));
  doc.circle(cx,cy,r-2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Proportional score arc (real gauge, not a full ring)
  _arcGauge(doc,cx,cy,r,score/100,col,PDF_TOKENS.borderSoft,3.5);
  // Number
  font(doc,PDF_FLAGS.dataXl,"bold");tc(doc,...col);
  doc.text(String(score),cx,cy+4,{align:"center"});
  font(doc,PDF_FLAGS.micro+.5,"normal");tc(doc,...PDF_TOKENS.muted);
  doc.text("/100",cx,cy+10,{align:"center"});
  if(showGrade){font(doc,PDF_FLAGS.small+.5,"bold",isAr);tc(doc,...col);doc.text(lbl,cx,cy+r+8,{align:"center"});}
}

// ── METRIC ROW v5 ─────────────────────────────────────────────────
function _mRow(doc,x,y,w,lbl,value,unit,score,isAr,idx=0){
  const col=_sc(score),colLt=_scLt(score),h=22;
  fc(doc,...(idx%2===0?PDF_TOKENS.card:PDF_TOKENS.bg));rr(doc,x,y,w,h,3,"F");
  dc(doc,...PDF_TOKENS.borderSoft);lw(doc,0.15);rr(doc,x,y,w,h,3,"S");lw(doc,0.3);
  // Left accent
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  // Score chip
  fc(doc,...colLt);rr(doc,x+6,y+5,16,12,2,"F");
  font(doc,8.5,"bold");tc(doc,...col);
  doc.text(String(Math.round(score)),x+14,y+12.5,{align:"center"});
  // Label
  font(doc,9,"bold",isAr);tc(doc,...PDF_TOKENS.ink);doc.text(_fit(doc,lbl,w*0.52-31),x+27,y+9.5);
  // Value
  if(value!==undefined&&value!==null){
    font(doc,7.5,"normal");tc(doc,...PDF_TOKENS.muted);
    doc.text(`${Math.round(value*10)/10}${unit||""}`,x+27,y+16.5);
  }
  // Progress bar
  const bx=x+w*.52,bw=w*.44,bh=5;
  fc(doc,...PDF_TOKENS.borderSoft);rr(doc,bx,y+8.5,bw,bh,2,"F");
  fc(doc,...col);rr(doc,bx,y+8.5,Math.max(bw*(score/100),3),bh,2,"F");
  // Grade
  const gl=_sl(score,isAr);
  const gw=doc.getTextWidth(gl)+7;
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.1}));
  rr(doc,x+w-gw-3,y+14.5,gw,6,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,PDF_FLAGS.micro+.5,"bold",isAr);tc(doc,...col);
  doc.text(gl,x+w-gw/2-3,y+18.5,{align:"center"});
}

// ── KPI CHIP v5 — elevated with top accent ─────────────────────────
function _kpi(doc,x,y,w,h,val,label,col,sub=""){
  fc(doc,...PDF_TOKENS.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...PDF_TOKENS.border);lw(doc,0.15);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  // Top color accent
  fc(doc,...col);rr(doc,x,y,w,3,2,"F");doc.rect(x,y+1.5,w,1.5,"F");
  // Value
  font(doc,PDF_FLAGS.dataLg,"bold");tc(doc,...col);
  doc.text(_fit(doc,String(val),w-8),x+w/2,y+h*.56,{align:"center"});
  // Label
  font(doc,PDF_FLAGS.small,"bold");tc(doc,...PDF_TOKENS.muted);
  doc.text(_fit(doc,label,w-8),x+w/2,y+h*.78,{align:"center"});
  if(sub){font(doc,PDF_FLAGS.micro,"normal");tc(doc,...PDF_TOKENS.light);doc.text(_fit(doc,sub,w-8),x+w/2,y+h*.9,{align:"center"});}
}

// ── SPARKLINE v5 ─────────────────────────────────────────────────
function _spark(doc,hist,x,y,w,h,col){
  const pts=hist.length>80?hist.filter((_,i)=>i%Math.ceil(hist.length/80)===0):hist;
  if(pts.length<2)return;
  const lo=Math.max(0,Math.min(...pts)-5),hi=Math.min(100,Math.max(...pts)+5);
  const rng=Math.max(hi-lo,10);
  const co=pts.map((s,i,a)=>({px:x+(i/Math.max(a.length-1,1))*w,py:y+h-((s-lo)/rng)*h}));
  // Grid lines
  [50,65,80].forEach(v=>{
    if(v<lo||v>hi)return;
    const gy=y+h-((v-lo)/rng)*h;
    dc(doc,...PDF_TOKENS.borderSoft);lw(doc,0.12);doc.line(x,gy,x+w,gy);
    font(doc,5,"normal");tc(doc,...PDF_TOKENS.ghost);doc.text(String(v),x-2,gy+1.5,{align:"right"});
  });lw(doc,0.3);
  // Area
  try{
    const segs=co.slice(1).map((p,i)=>[p.px-co[i].px,p.py-co[i].py]);
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.07}));
    doc.lines([...segs,[0,h],[-(co[co.length-1].px-co[0].px),0]],co[0].px,co[0].py,[1,1],"F",false);
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  }catch{}
  // Line
  dc(doc,...col);lw(doc,1.4);
  co.forEach((p,i)=>{if(i>0)doc.line(co[i-1].px,co[i-1].py,p.px,p.py);});lw(doc,0.3);
  // Endpoints
  fc(doc,...PDF_TOKENS.card);doc.circle(co[0].px,co[0].py,2,"F");
  dc(doc,...col);lw(doc,0.8);doc.circle(co[0].px,co[0].py,2,"S");lw(doc,0.3);
  fc(doc,...col);doc.circle(co[co.length-1].px,co[co.length-1].py,2.5,"F");
  font(doc,6.5,"bold");tc(doc,...col);
  doc.text(String(pts[0]),co[0].px,co[0].py-4,{align:"center"});
  doc.text(String(pts[pts.length-1]),co[co.length-1].px,co[co.length-1].py-4,{align:"center"});
}

// ── CALLOUT STRIP ─────────────────────────────────────────────────
function _callout(doc,x,y,w,text,type="info",isAr=false){
  const cols={info:PDF_TOKENS.primary,success:PDF_TOKENS.success,warning:PDF_TOKENS.warning,danger:PDF_TOKENS.danger};
  const col=cols[type]||PDF_TOKENS.primary;
  const colBg={info:PDF_TOKENS.primaryBg,success:PDF_TOKENS.successBg,warning:PDF_TOKENS.warningBg,danger:PDF_TOKENS.dangerBg};
  const lines=doc.splitTextToSize(text.replace(/[#*`]/g,""),w-14);
  const h=Math.max(14,lines.length*5.2+8);
  fc(doc,...(colBg[type]||PDF_TOKENS.bg));rr(doc,x,y,w,h,3,"F");
  dc(doc,...col);lw(doc,0.2);rr(doc,x,y,w,h,3,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  font(doc,PDF_FLAGS.body,"normal",isAr);tc(doc,...PDF_TOKENS.sub);
  lines.forEach((l,i)=>doc.text(l,x+7,y+7+(i*5.2)));
  return y+h+6;
}

// ── STEP CARD v5 ─────────────────────────────────────────────────
function _step(doc,x,y,w,num,title,score,steps,isAr){
  const col=_sc(score),colLt=_scLt(score),h=46;
  fc(doc,...PDF_TOKENS.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...PDF_TOKENS.border);lw(doc,0.15);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  // Number circle
  fc(doc,...colLt);doc.circle(x+15,y+14,9,"F");
  dc(doc,...col);lw(doc,.8);doc.circle(x+15,y+14,9,"S");lw(doc,0.3);
  font(doc,10,"bold");tc(doc,...col);doc.text(String(num),x+15,y+17.5,{align:"center"});
  // Title + score
  font(doc,10,"bold",isAr);tc(doc,...PDF_TOKENS.ink);doc.text(_fit(doc,title,w*0.62),x+30,y+12);
  const sb=`${Math.round(score)}/100`;const sw=doc.getTextWidth(sb)+7;
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.1}));
  rr(doc,x+w-sw-4,y+5,sw,8,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,6.5,"bold");tc(doc,...col);doc.text(sb,x+w-sw/2-4,y+10.5,{align:"center"});
  // Steps
  font(doc,7.5,"normal",isAr);tc(doc,...PDF_TOKENS.sub);
  steps.slice(0,3).forEach((s,i)=>{
    font(doc,7.5,"bold");tc(doc,...col);doc.text(`${i+1}.`,x+30,y+22+(i*7));
    font(doc,7.5,"normal",isAr);tc(doc,...PDF_TOKENS.sub);
    doc.text(_fit(doc,s,w-46),x+36,y+22+(i*7));
  });
  return y+h+8;
}

// ── ZONE CARD v5 ─────────────────────────────────────────────────
function _zone(doc,x,y,w,name,region,risk,desc,mlist,isAr){
  const col=_riskColor(risk);
  const _pct=_riskPct(risk);
  const lines=doc.splitTextToSize(desc,w-50);
  const h=Math.max(48,lines.length*5+34);
  fc(doc,...PDF_TOKENS.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...col);lw(doc,0.25);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  // Risk badge
  fc(doc,...col);doc.circle(x+18,y+h/2,11,"F");
  font(doc,risk==null?6:9.5,"bold");tc(doc,...PDF_TOKENS.card);doc.text(risk==null?"n/a":_pct,x+18,y+h/2+3.5,{align:"center"});
  // Title
  font(doc,10,"bold",isAr);tc(doc,...PDF_TOKENS.ink);doc.text(_fit(doc,name,w*0.5),x+35,y+12);
  font(doc,7.5,"bold");tc(doc,...PDF_TOKENS.primary);doc.text(_fit(doc,region,w*0.5),x+35,y+19);
  // Risk label
  const rlbl=_riskLabel(risk,isAr);
  const rw=doc.getTextWidth(rlbl)+8;
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
  rr(doc,x+w-rw-4,y+6,rw,9,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,7.5,"bold",isAr);tc(doc,...col);doc.text(rlbl,x+w-rw/2-4,y+12,{align:"center"});
  // Bar
  const bx=x+35,bw=w*.52;
  fc(doc,...PDF_TOKENS.borderSoft);rr(doc,bx,y+23,bw,4.5,2,"F");
  fc(doc,...col);rr(doc,bx,y+23,Math.max(bw*(risk/100),3),4.5,2,"F");
  // Desc
  font(doc,7.5,"normal",isAr);tc(doc,...PDF_TOKENS.sub);
  lines.forEach((l,i)=>doc.text(l,x+7,y+32+(i*5)));
  font(doc,6,"bold");tc(doc,...PDF_TOKENS.ghost);
  doc.text(`Sources: ${mlist}`,x+7,y+h-4);
  return y+h+6;
}

// ── INFO TABLE ROW ────────────────────────────────────────────────
function _iRow(doc,x,y,w,key,val,even,isAr){
  fc(doc,...(even?PDF_TOKENS.bg:PDF_TOKENS.card));doc.rect(x,y,w,8.5,"F");
  font(doc,PDF_FLAGS.small,"normal",isAr);tc(doc,...PDF_TOKENS.muted);doc.text(key,x+5,y+5.8);
  font(doc,PDF_FLAGS.small,"bold");tc(doc,...PDF_TOKENS.ink);doc.text(String(val),x+w-5,y+5.8,{align:"right"});
}

// ── _drawSparkline alias ──────────────────────────────────────────
function _drawSparkline(doc,hist,x,y,w,h,col){_spark(doc,hist,x,y,w,h,col);}




export async function generateSessionPDF({ session, profile, user, lang="en", sessionIndex, allSessions=[], aiSummary="" }) {
  const isAr0 = lang === "ar";
  if (!session) throw new Error(isAr0 ? "لا توجد بيانات جلسة لعرضها في هذا التقرير." : "No session data available to generate this report.");
  const { jsPDF } = await import("jspdf");
  const isAr   = lang === "ar";
  const _rawTier = profile?.tier || session?.tier || "standard";
  // Normalize aliases: personal_elite/b2b_enterprise → elite, personal_pro/b2b_growth → professional
  const tier     = _rawTier.includes("elite")||_rawTier==="enterprise"||_rawTier==="premium"?"elite"
                 : _rawTier.includes("pro")||_rawTier.includes("professional")||_rawTier==="growth"?"professional"
                 : _rawTier;
  const isElite= tierAtLeast(tier,"elite");
  const isPro  = !isElite && tierAtLeast(tier,"professional");
  const doc    = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  await Promise.all([_ensureCairoFont(doc,isAr), _ensureLogo()]);

  const W=210,H=297,ml=14,mr=14,cw=W-ml-mr;
  const sf = (sz,st="normal") => font(doc,sz,st,isAr&&_cairoLoaded);

  // ── DATA ──────────────────────────────────────────────────────
  const avg      = Math.round(session.avg_score||0);
  const dur      = session.duration_s||session.duration_sec||0;
  const goodPct  = Math.round(session.good_pct||0);
  const alerts   = session.alerts_count||0;
  const hist     = session.score_history||[];
  const metrics  = session.metrics||{};
  const aiText   = session.ai_tip||session.ai_insight||session.claude_analysis||aiSummary||"";
  const painSum  = session.pain_summary||"";
  const name     = profile?.name||user?.displayName||user?.email?.split("@")[0]||(isAr?"مستخدم":"User");
  const email    = user?.email||"";
  const company  = profile?.company_name||profile?.organization||"—";
  const dateStr  = _fmtDateLong(session.created_at||new Date(),isAr);
  const timeStr  = (() => { try { const d=session.created_at?.toDate?session.created_at.toDate():new Date(session.created_at||Date.now()); return d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}); } catch{return"—";} })();
  const dayStr   = (() => { try { const d=session.created_at?.toDate?session.created_at.toDate():new Date(session.created_at||Date.now()); return d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"}); } catch{return dateStr;} })();
  const realIdx  = (()=>{ if(sessionIndex)return sessionIndex; if(allSessions.length){const i=allSessions.findIndex(s=>(s.id||s.session_id)===(session.id||session.session_id));if(i>=0)return allSessions.length-i;} return 1; })();
  const tierLbl  = isElite?"ELITE":isPro?"PROFESSIONAL":"STARTER";
  const tierCol  = isElite?[34,197,94]:isPro?[139,92,246]:[99,102,241];

  const gradeC   = avg>=80?[34,197,94]:avg>=60?[245,158,11]:[239,68,68];
  const gradeL   = avg>=80?(isAr?"ممتاز":"Excellent"):avg>=60?(isAr?"جيد":"Good"):(isAr?"يحتاج تحسين":"Needs Work");

  const mEntries = Object.entries(metrics)
    .filter(([k])=>!k.startsWith("_")&&!META_METRIC_KEYS.has(k)&&metrics[k])
    .map(([k,v])=>{
      const sc=typeof v==="number"?v:(v?.score??100);
      const lbl=(isAr?METRIC_LABELS_AR[k]:METRIC_LABELS[k])||k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      const val=v?.value, unit=v?.unit==="depth"?"":(v?.unit||"");
      const pri=isAr?(sc<40?"أولوية عالية":sc<65?"أولوية متوسطة":"أولوية منخفضة"):(sc<40?"High Priority":sc<65?"Medium Priority":"Low Priority");
      const priC=sc<40?[239,68,68]:sc<65?[245,158,11]:[34,197,94];
      return{k,sc,lbl,val,unit,pri,priC};
    }).sort((a,b)=>a.sc-b.sc);

  // ── LIGHT THEME COLORS (Apple Health × Bloomberg — matches Clinical/
  //    Comparison/Longitudinal reports so all PDFs share one look) ──────
  const BG     = [247,249,252];  // page background — soft gray
  const BG2    = [255,255,255];  // header bar — white
  const CARD   = [255,255,255];  // cards — white
  const CARD2  = [248,250,252];  // subtle inset panels
  const BORDER = [226,232,240];  // hairline borders
  const TEXT   = [15,23,42];      // primary ink
  const TEXT2  = [100,116,139];   // secondary
  const TEXT3  = [148,163,184];   // muted
  const ACCENT = [37,99,235];     // brand blue (top strip)

  // ── HELPER: light rounded card with hairline border ────────────
  const dCard = (x,y,w,h,r=6,col=CARD) => {
    fc(doc,...col); rr(doc,x,y,w,h,r,"F");
    dc(doc,...BORDER); lw(doc,0.4);
    rr(doc,x,y,w,h,r,"S");
    lw(doc,0.3);
  };

  const fmtDurShort = s => {
    if(!s)return"0s";
    const m=Math.floor(s/60),r=s%60;
    return m>0?`${m}m ${r}s`:`${r}s`;
  };

  // ══════════════════════════════════════════════════════════════
  // NON-ELITE — premium 2-page preview
  // ══════════════════════════════════════════════════════════════
  if(!isElite && !isPro) {
    // Full dark background
    fc(doc,...BG); doc.rect(0,0,W,H,"F");

    // ── PAGE 1 HEADER ──────────────────────────────────────────
    fc(doc,...BG2); doc.rect(0,0,W,22,"F"); fc(doc,...ACCENT); doc.rect(0,0,W,2,"F");
    _logo(doc,ml,5,12,_logoSm);
    sf(8.5,"bold"); tc(doc,...TEXT); doc.text("CORVUS",ml+16,11.5);
    sf(5.5,"normal"); tc(doc,...TEXT2); doc.text("HEALTH INTELLIGENCE",ml+16,16.5);
    sf(9,"bold"); tc(doc,...TEXT); doc.text(isAr?"تقرير تحليل الوضعية الشخصي":"Personal Posture Analysis Report",60,10);
    sf(6,"normal"); tc(doc,...TEXT3); doc.text(isAr?"تحليل الوضعية بالذكاء الاصطناعي":"AI-POWERED POSTURE INSIGHTS",60,16);
    // Tier badge
    const tbl=tierLbl; const tbw=doc.getTextWidth(tbl)+10;
    fc(doc,...tierCol);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.18}));
    rr(doc,W-mr-tbw,4,tbw,14,3,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    dc(doc,...tierCol); lw(doc,.5); rr(doc,W-mr-tbw,4,tbw,14,3,"S"); lw(doc,.3);
    sf(7,"bold"); tc(doc,...tierCol); doc.text(tbl,W-mr-tbw/2,13,{align:"center"});
    // Date right
    sf(6,"normal"); tc(doc,...TEXT3);
    doc.text(`${isAr?"أُنشئ في":"Generated"}: ${_fmtDateLong(new Date(),isAr)}`,W-mr,20,{align:"right"});
    // Bottom border line
    fc(doc,...BORDER); doc.rect(0,22,W,.5,"F");
    let y=28;

    // ── ROW 1: Score ring (left) + KPIs (center) + Info card (right) ──
    const scoreW=60, kpiW=85, infoW=cw-scoreW-kpiW-8;
    const row1H=78;

    // Score card
    dCard(ml,y,scoreW,row1H);
    sf(6.5,"bold"); tc(doc,...TEXT3); doc.text(isAr?"النتيجة الكلية للوضعية":"OVERALL POSTURE SCORE",ml+scoreW/2,y+7,{align:"center"});
    // Score gauge (proportional arc)
    const cx=ml+scoreW/2, cy=y+40, r1=21;
    fc(doc,...gradeC);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.07}));
    doc.circle(cx,cy,r1-2.5,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    _arcGauge(doc,cx,cy,r1,avg/100,gradeC,BORDER,4);
    sf(21,"bold"); tc(doc,...gradeC); doc.text(String(avg),cx,cy+3,{align:"center"});
    sf(6,"normal"); tc(doc,...TEXT3); doc.text("/100",cx,cy+9.5,{align:"center"});
    sf(9,"bold"); tc(doc,...gradeC); doc.text(gradeL,cx,cy+r1+9,{align:"center"});
    // (AI insight lives in its own card under the timeline below — a second
    // copy here collided with the grade label in the narrow score card.)

    // KPI chips (2x2 grid)
    const kx=ml+scoreW+4;
    const kpis=[
      [isAr?"وضعية جيدة":"Good Posture",`${goodPct}%`,"✓",[34,197,94]],
      [isAr?"التنبيهات":"Alerts",String(alerts),"⚠",[245,158,11]],
      [isAr?"الجلسة":"Session",`#${realIdx}`,"#",[99,102,241]],
      [isAr?"المدة":"Duration",fmtDurShort(dur),"◷",[6,182,212]],
    ];
    const kw=(kpiW-4)/2, kh=(row1H-4)/2;
    kpis.forEach(([label,val,icon,col],i)=>{
      const kx2=kx+(i%2)*(kw+4), ky2=y+(Math.floor(i/2))*(kh+4);
      dCard(kx2,ky2,kw,kh,5,CARD2);
      // Icon circle — solid dot (emoji/symbol glyphs don't render in helvetica)
      fc(doc,...col);
      doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
      doc.circle(kx2+10,ky2+10,8,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      fc(doc,...col); doc.circle(kx2+10,ky2+10,2.4,"F");
      sf(11,"bold"); tc(doc,...TEXT); doc.text(String(val),kx2+kw/2,ky2+kh*.6,{align:"center"});
      sf(5.5,"bold"); tc(doc,...TEXT3); doc.text(label,kx2+kw/2,ky2+kh*.82,{align:"center"});
    });

    // Info card (right)
    const ix=kx+kpiW+4;
    dCard(ix,y,infoW,row1H);
    sf(6,"bold"); tc(doc,...TEXT3); doc.text(isAr?"بياناتك":"YOUR INFORMATION",ix+4,y+7);
    [
      ["👤",isAr?"الاسم":"Name",name],
      ["✉",isAr?"البريد":"Email",email.length>22?email.slice(0,22)+"…":email],
      ["🏢",isAr?"الشركة":"Company",company||"—"],
      ["🔑","ID",`local_${session.id?.slice(-8)||Math.random().toString(36).slice(-8)}`],
    ].forEach(([icon,lbl,val],i)=>{
      const ry=y+16+i*14;
      sf(5.5,"normal"); tc(doc,...TEXT3);
      doc.text(String(lbl),ix+4,ry);
      sf(6,"bold"); tc(doc,...TEXT);
      doc.text(String(val),ix+4,ry+6.5);
      if(i<3){ fc(doc,...BORDER); doc.rect(ix+4,ry+9,infoW-8,.3,"F"); }
    });
    y+=row1H+5;

    // ── SCORE TIMELINE ─────────────────────────────────────────
    dCard(ml,y,cw,46);
    sf(6.5,"bold"); tc(doc,...TEXT3); doc.text(isAr?"تسلسل النتيجة زمنياً":"SCORE TIMELINE",ml+4,y+7);
    if(hist.length>1){
      const lo=Math.max(0,Math.min(...hist)-5),hi=Math.min(100,Math.max(...hist)+5),rng=hi-lo;
      const gx=ml+8,gw2=cw-16,gh=28,gy=y+13;
      // Grid lines
      [50,65,80,95].forEach(v=>{
        if(v<lo-5||v>hi+5) return;
        const ly=gy+gh-((v-lo)/Math.max(rng,1))*gh;
        fc(doc,...BORDER);
        doc.setGState&&doc.setGState(new doc.GState({opacity:.3}));
        doc.rect(gx,ly,gw2,.2,"F");
        doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
        sf(4.5,"normal"); tc(doc,...TEXT3); doc.text(String(v),gx-2,ly+1.5,{align:"right"});
      });
      // Area fill
      const pts=hist.map((s,i)=>({px:gx+(i/(hist.length-1))*gw2,py:gy+gh-((s-lo)/Math.max(rng,1))*gh}));
      try {
        const segs=pts.slice(1).map((p,i)=>[p.px-pts[i].px,p.py-pts[i].py]);
        fc(doc,37,99,235);
        doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
        doc.lines([...segs,[0,gy+gh-pts[pts.length-1].py],[-(pts[pts.length-1].px-pts[0].px),0]],pts[0].px,pts[0].py,[1,1],"F",false);
        doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      }catch{}
      // Line
      dc(doc,37,99,235); lw(doc,1.2);
      pts.forEach((p,i)=>{if(i>0)doc.line(pts[i-1].px,pts[i-1].py,p.px,p.py);}); lw(doc,.3);
      // Dots every ~10 points
      pts.filter((_,i)=>i%(Math.ceil(pts.length/8))===0||i===pts.length-1).forEach(p=>{
        fc(doc,37,99,235); doc.circle(p.px,p.py,1.5,"F");
      });
      // Last score badge
      const lp=pts[pts.length-1];
      fc(doc,...gradeC);
      doc.setGState&&doc.setGState(new doc.GState({opacity:.9}));
      doc.circle(lp.px,lp.py,4,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      sf(5.5,"bold"); tc(doc,...[10,15,30]); doc.text(String(avg),lp.px,lp.py+1.8,{align:"center"});
      // Time labels
      sf(4.5,"normal"); tc(doc,...TEXT3);
      ["00:00",`00:${Math.floor(dur/4/60).toString().padStart(2,'0')}`,
       `00:${Math.floor(dur/2/60).toString().padStart(2,'0')}`,
       `00:${Math.floor(dur*3/4/60).toString().padStart(2,'0')}`,
       `${String(Math.floor(dur/60)).padStart(2,'0')}:${String(dur%60).padStart(2,'0')}`
      ].forEach((t,i)=>doc.text(t,gx+(i/4)*gw2,gy+gh+5,{align:"center"}));
    }
    // AI tip
    if(aiText){
      const tipLines=doc.splitTextToSize((aiText.split('.')[0]+'.'),cw-12);
      const tipH=tipLines.length*5+7;
      dCard(ml,y+47,cw,tipH,4,CARD2);
      sf(6.5,"normal"); tc(doc,...TEXT2);
      tipLines.forEach((l,i)=>doc.text(l,ml+5,y+47+6+i*5));
      y+=47+tipH+5;
    } else { y+=51; }

    // ── KEY POSTURE METRICS ─────────────────────────────────────
    sf(7,"bold"); tc(doc,...TEXT);
    doc.text(isAr?"مقاييس الوضعية الرئيسية":"KEY POSTURE METRICS",ml,y+5);
    y+=9;
    const mshow=mEntries.slice(0,3);
    const mw=(cw-(mshow.length-1)*5)/mshow.length;
    mshow.forEach(({lbl,sc,val,unit,pri,priC},i)=>{
      const mx=ml+i*(mw+5); const mh=38;
      _metricMiniCard(doc,{mx,y,mw,mh,lbl,sc,val,unit,pri,isAr,sf,dCard,BORDER,TEXT,TEXT2,TEXT3});
    });
    y+=mEntries.slice(0,3).length>0?45:0;

    // ── FOOTER ────────────────────────────────────────────────
    fc(doc,...BORDER);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
    doc.rect(ml,H-9,cw,.3,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(5.5,"normal"); tc(doc,...TEXT3);
    doc.text(isAr?"Corvus Health Intelligence · سري · ليس تشخيصاً طبياً":"Corvus Health Intelligence · Confidential · Not a medical diagnosis",ml,H-4.5);
    doc.text("1 / 2",W-mr,H-4.5,{align:"right"});

    // ══════════════════════════════════════════════════════════
    // PAGE 2
    // ══════════════════════════════════════════════════════════
    doc.addPage();
    fc(doc,...BG); doc.rect(0,0,W,H,"F");
    fc(doc,...BG2); doc.rect(0,0,W,15,"F"); fc(doc,...ACCENT); doc.rect(0,0,W,1.6,"F");
    _logo(doc,ml,3,9,_logoSm);
    sf(7.5,"bold"); tc(doc,...TEXT); doc.text("CORVUS",ml+13,8);
    sf(4.5,"normal"); tc(doc,...TEXT2); doc.text("HEALTH INTELLIGENCE",ml+13,13);
    sf(6,"normal"); tc(doc,...TEXT3);
    doc.text(`${isAr?"جلسة":"Session"} #${realIdx}  •  ${dayStr}, ${timeStr}`,W-mr,10,{align:"right"});
    fc(doc,...BORDER); doc.rect(0,15,W,.5,"F");
    y=22;

    // Row: Radar chart (left) + Insights (center) + Summary (right)
    const radarW=60, insW=75, sumW=cw-radarW-insW-8;
    const rowH=100;

    // Radar chart card (simplified polygon)
    dCard(ml,y,radarW,rowH);
    sf(6,"bold"); tc(doc,...TEXT3); doc.text(isAr?"نظرة عامة على الوضعية":"POSTURE OVERVIEW",ml+4,y+6);
    const rcx=ml+radarW/2, rcy2=y+rowH/2+6, rad=22;
    const labels2=isAr?["الرقبة","الكتفين","العمود الفقري","الاتزان","وضع الشاشة"]:["Neck\nAlign.","Shoulder\nPosition","Spine\nAlign.","Sitting\nBalance","Screen\nErgonomics"];
    const angles=labels2.map((_,i)=>((i/labels2.length)*360-90)*Math.PI/180);
    // Optimal hexagon
    fc(doc,37,99,235);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.08}));
    const optPts=angles.map(a=>({x:rcx+Math.cos(a)*rad,y:rcy2+Math.sin(a)*rad}));
    const optSegs=optPts.slice(1).map((p,i)=>[p.x-optPts[i].x,p.y-optPts[i].y]);
    try{doc.lines([...optSegs,[optPts[0].x-optPts[optPts.length-1].x,optPts[0].y-optPts[optPts.length-1].y]],optPts[0].x,optPts[0].y,[1,1],"F",false);}catch{}
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    // Grid rings
    [.33,.66,1].forEach(f=>{
      dc(doc,...BORDER); lw(doc,.2);
      const gp=angles.map(a=>({x:rcx+Math.cos(a)*rad*f,y:rcy2+Math.sin(a)*rad*f}));
      const gs=gp.slice(1).map((p,i)=>[p.x-gp[i].x,p.y-gp[i].y]);
      try{dc(doc,...BORDER);doc.lines([...gs,[gp[0].x-gp[gp.length-1].x,gp[0].y-gp[gp.length-1].y]],gp[0].x,gp[0].y,[1,1],"S",false);}catch{}
    });
    lw(doc,.3);
    // User data polygon
    // Four of these five were names the engine never emits, so four of the
    // five axes on every radar ever printed were the ?? 70 default — the same
    // pentagon on every report, with one real vertex.
    const metKeys=["neck_lean","shoulder_level","spine_lean","fhp_index","screen_distance"];
    const userScores=metKeys.map(k=>_metricScore(metrics,k));
    // A null axis used to divide into NaN or collapse the vertex to the
    // centre, which draws as "this is terrible" rather than "there is no
    // reading". The polygon is only drawn when every axis has one; otherwise
    // the grid stands empty and a line says which axes were missing.
    const _radarOK = userScores.every(v=>v!==null);
    const uPts=angles.map((a,i)=>{const v=_radarOK?userScores[i]:0;
      return {x:rcx+Math.cos(a)*rad*(v/100),y:rcy2+Math.sin(a)*rad*(v/100)};});
    if(!_radarOK){
      const miss=metKeys.filter((k,i)=>userScores[i]===null)
        .map(k=>(isAr?(METRIC_LABELS_AR[k]||k):(METRIC_LABELS[k]||k)));
      sf(6,"italic"); tc(doc,...TEXT3);
      doc.text(isAr?`مش متقاس في الكادر ده: ${miss.join("، ")}`
                  :`Not measurable at this framing: ${miss.join(", ")}`, rcx, rcy2+rad+9, {align:"center"});
    }
    if(_radarOK){
    fc(doc,37,99,235);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.25}));
    const uSegs=uPts.slice(1).map((p,i)=>[p.x-uPts[i].x,p.y-uPts[i].y]);
    try{doc.lines([...uSegs,[uPts[0].x-uPts[uPts.length-1].x,uPts[0].y-uPts[uPts.length-1].y]],uPts[0].x,uPts[0].y,[1,1],"F",false);}catch{}
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    dc(doc,37,99,235); lw(doc,.8);
    try{doc.lines([...uSegs,[uPts[0].x-uPts[uPts.length-1].x,uPts[0].y-uPts[uPts.length-1].y]],uPts[0].x,uPts[0].y,[1,1],"S",false);}catch{}
    lw(doc,.3);
    uPts.forEach(p=>{fc(doc,37,99,235);doc.circle(p.x,p.y,1.5,"F");});
    }
    // Labels
    angles.forEach((a,i)=>{
      const lx=rcx+Math.cos(a)*(rad+7),ly=rcy2+Math.sin(a)*(rad+7);
      sf(4.5,"normal"); tc(doc,...TEXT3);
      doc.text(labels2[i].replace('\n',' '),lx,ly,{align:"center"});
    });
    // Legend
    sf(5,"normal"); tc(doc,37,99,235); doc.text(isAr?"— أنت":"— You",ml+4,y+rowH-7);
    tc(doc,...TEXT3); doc.text(isAr?"  - - المعدل المثالي":"  - - Optimal Range",ml+4,y+rowH-2.5);

    // Insights card (center)
    const inx=ml+radarW+4;
    dCard(inx,y,insW,rowH);
    sf(6,"bold"); tc(doc,...TEXT3); doc.text(isAr?"أبرز الملاحظات":"POSTURE INSIGHTS",inx+4,y+6);
    const insights=mEntries.slice(0,3).map(({lbl,sc,val,unit})=>({
      text:isAr
        ? `${lbl}: ${sc<60?"يحتاج إلى انتباه":"ضمن المعدل"}${val!==undefined?` — ${Math.round(val*10)/10}${unit}`:""}`
        : `Your ${lbl.toLowerCase()} ${sc<60?"needs attention.":"is acceptable."}${val!==undefined?` ${Math.round(val*10)/10}${unit}`:""}`,
      detail:isAr
        ? (sc<40?"أولوية عالية — عالجها فوراً.":sc<65?"متوسطة — راقبها وحسّنها.":"جيد — حافظ على هذا الوضع.")
        : (sc<40?"High priority — address immediately.":sc<65?"Moderate — monitor and improve.":"Looking good — maintain this."),
      col:sc<40?[239,68,68]:sc<65?[245,158,11]:[34,197,94],
    }));
    insights.forEach(({text,detail,col},i)=>{
      const iy=y+12+i*28;
      fc(doc,...col);
      doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
      doc.circle(inx+10,iy+7,8,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      // Solid status dot — emoji (🔴🟡🟢) don't exist in jsPDF's built-in helvetica and render as mojibake
      fc(doc,...col); doc.circle(inx+10,iy+7,2.4,"F");
      sf(7,"bold"); tc(doc,...TEXT);
      const tlines=doc.splitTextToSize(text,insW-28);
      doc.text(tlines[0],inx+21,iy+7);
      sf(6,"normal"); tc(doc,...TEXT2);
      doc.text(detail,inx+21,iy+13.5);
      if(i<2){ fc(doc,...BORDER); doc.rect(inx+4,iy+22,insW-8,.25,"F"); }
    });

    // Session summary table (right)
    const sx=inx+insW+4;
    dCard(sx,y,sumW,rowH);
    sf(6,"bold"); tc(doc,...TEXT3); doc.text(isAr?"ملخص الجلسة":"SESSION SUMMARY",sx+4,y+6);
    const sumRows=[
      [isAr?"النتيجة الكلية":"Overall Score",`${avg}/100`,gradeC],
      [isAr?"وضعية جيدة":"Good Posture",`${goodPct}%`,[34,197,94]],
      [isAr?"التنبيهات":"Alerts",String(alerts),[245,158,11]],
      [isAr?"المدة":"Duration",fmtDurShort(dur),[99,102,241]],
      [isAr?"الجلسة":"Session",`#${realIdx}`,[99,102,241]],
      [isAr?"التاريخ":"Date",dayStr.split(',')[0],[148,163,200]],
      [isAr?"الوقت":"Time",timeStr,[148,163,200]],
    ];
    sumRows.forEach(([k,v,col],i)=>{
      const ry=y+10+i*12;
      sf(6,"normal"); tc(doc,...TEXT3); doc.text(k,sx+4,ry+5);
      sf(6.5,"bold"); tc(doc,...col); doc.text(v,sx+sumW-4,ry+5,{align:"right"});
      if(i<sumRows.length-1){
        fc(doc,...BORDER);
        doc.setGState&&doc.setGState(new doc.GState({opacity:.2}));
        doc.rect(sx+4,ry+7.5,sumW-8,.2,"F");
        doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      }
    });
    y+=rowH+5;

    // ── UPGRADE CTA ────────────────────────────────────────────
    dCard(ml,y,cw,52,8,CARD2);
    fc(doc,...tierCol);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.07}));
    doc.circle(ml+30,y+26,35,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    // Crown icon area
    fc(doc,...tierCol);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
    rr(doc,ml+5,y+8,36,36,10,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    fc(doc,...tierCol); doc.circle(ml+23,y+26,4.5,"F"); // badge dot (crown glyph doesn't render)
    sf(10,"bold"); tc(doc,...TEXT); doc.text(isAr?"رقّي لـ Elite":"Upgrade to Elite",ml+50,y+18);
    sf(7,"normal"); tc(doc,...TEXT2); doc.text(isAr?"افتح تحليلات متقدمة وتقارير كاملة":"Unlock advanced insights and reports",ml+50,y+26);
    // Feature list — colored dot + label (emoji don't render in helvetica)
    const feats=[[isAr?"تحليل AI":"Detailed AI"],["Full PDF"],[isAr?"توقع الألم":"Pain prediction"],[isAr?"مقارنة":"Baseline"]];
    feats.forEach(([lb],i)=>{
      const fx=ml+50+i*34;
      fc(doc,...tierCol); doc.circle(fx+7,y+37,1.8,"F");
      sf(5,"normal"); tc(doc,...TEXT2); doc.text(lb,fx+7,y+46,{align:"center"});
    });
    // CTA button
    fc(doc,...tierCol); rr(doc,W/2-30,y+40,60,12,4,"F");
    sf(7,"bold"); tc(doc,...[255,255,255]); doc.text(isAr?"رقّي الآن":"Upgrade Now",W/2,y+48,{align:"center"});
    y+=57;

    // Footer
    fc(doc,...BORDER);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
    doc.rect(ml,H-9,cw,.3,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(5.5,"normal"); tc(doc,...TEXT3);
    doc.text(isAr?"Corvus Health Intelligence · سري · ليس تشخيصاً طبياً":"Corvus Health Intelligence · Confidential · Not a medical diagnosis",ml,H-4.5);
    doc.text("2 / 2",W-mr,H-4.5,{align:"right"});

    const _fn = `Corvus_Session_${realIdx}_${new Date().toISOString().slice(0,10)}.pdf`;
    await doc.save(_fn, {returnPromise:true});
    return _fn;
  }

  // ══════════════════════════════════════════════════════════════
  // ELITE/PRO — same premium design, full content, no upsell
  // ══════════════════════════════════════════════════════════════
  fc(doc,...BG); doc.rect(0,0,W,H,"F");

  // Header
  fc(doc,...BG2); doc.rect(0,0,W,22,"F"); fc(doc,...ACCENT); doc.rect(0,0,W,2,"F");
  _logo(doc,ml,5,12,_logoSm);
  sf(8.5,"bold"); tc(doc,...TEXT); doc.text("CORVUS",ml+16,11.5);
  sf(5.5,"normal"); tc(doc,...TEXT2); doc.text("HEALTH INTELLIGENCE",ml+16,16.5);
  sf(9,"bold"); tc(doc,...TEXT); doc.text(isAr?"تقرير تحليل الوضعية الشخصي":"Personal Posture Analysis Report",60,10);
  sf(6,"normal"); tc(doc,...TEXT3); doc.text(isAr?"تحليل الوضعية بالذكاء الاصطناعي":"AI-POWERED POSTURE INSIGHTS",60,16);
  const tbw2=doc.getTextWidth(tierLbl)+10;
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.18}));
  rr(doc,W-mr-tbw2,4,tbw2,14,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  dc(doc,...tierCol); lw(doc,.5); rr(doc,W-mr-tbw2,4,tbw2,14,3,"S"); lw(doc,.3);
  sf(7,"bold"); tc(doc,...tierCol); doc.text(tierLbl,W-mr-tbw2/2,13,{align:"center"});
  sf(6,"normal"); tc(doc,...TEXT3); doc.text(`${isAr?"أُنشئ في":"Generated"}: ${_fmtDateLong(new Date(),isAr)}`,W-mr,20,{align:"right"});
  fc(doc,...BORDER); doc.rect(0,22,W,.5,"F");
  let y=28;

  // Score card row
  const scoreW=60, kpiW=85, infoW=cw-scoreW-kpiW-8, row1H=78;
  // Score
  dCard(ml,y,scoreW,row1H);
  sf(6.5,"bold"); tc(doc,...TEXT3); doc.text(isAr?"النتيجة الكلية للوضعية":"OVERALL POSTURE SCORE",ml+scoreW/2,y+7,{align:"center"});
  const cx2=ml+scoreW/2, cy2=y+40, r2=21;
  // Soft tint fill inside the gauge
  fc(doc,...gradeC);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.07}));
  doc.circle(cx2,cy2,r2-2.5,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Proportional arc gauge
  _arcGauge(doc,cx2,cy2,r2,avg/100,gradeC,BORDER,4);
  sf(21,"bold"); tc(doc,...gradeC); doc.text(String(avg),cx2,cy2+3,{align:"center"});
  sf(6,"normal"); tc(doc,...TEXT3); doc.text("/100",cx2,cy2+9.5,{align:"center"});
  sf(9,"bold"); tc(doc,...gradeC); doc.text(gradeL,cx2,cy2+r2+9,{align:"center"});
  // Trend vs previous session — a compact chip under the grade
  {
    const _prev=(Array.isArray(allSessions)?allSessions:[]).find(s=>(s.id||s.session_id)!==(session.id||session.session_id)&&(s.avg_score||0)>0);
    if(_prev){
      const _d=avg-Math.round(_prev.avg_score||0);
      const _tc=_d>0?[34,197,94]:_d<0?[239,68,68]:[100,116,139];
      const _lbl=`${_d>0?"+":""}${_d} ${isAr?"عن السابقة":"vs previous"}`;
      const _tw=doc.getTextWidth(_lbl)+11, _ty=cy2+r2+13;
      fc(doc,..._tc); doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
      rr(doc,cx2-_tw/2,_ty,_tw,6.5,3,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      _triangle(doc,cx2-_tw/2+4,_ty+3.3,_d>0?"up":_d<0?"down":"flat",_tc);
      sf(5.5,"bold"); tc(doc,..._tc); doc.text(_lbl,cx2+2,_ty+4.4,{align:"center"});
    }
  }
  // KPIs
  const kx3=ml+scoreW+4;
  [[isAr?"وضعية جيدة":"Good Posture",`${goodPct}%`,"check",[34,197,94]],
   [isAr?"التنبيهات":"Alerts",String(alerts),"bell",[245,158,11]],
   [isAr?"الجلسة":"Session",`#${realIdx}`,"hash",[99,102,241]],
   [isAr?"المدة":"Duration",fmtDurShort(dur),"clock",[6,182,212]]
  ].forEach(([label,val,icon,col],i)=>{
    const kw=(kpiW-4)/2, kh=(row1H-4)/2;
    const kx2b=kx3+(i%2)*(kw+4), ky2=y+(Math.floor(i/2))*(kh+4);
    dCard(kx2b,ky2,kw,kh,5,CARD2);
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.13}));
    doc.circle(kx2b+10,ky2+10,7.5,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    _icon(doc,icon,kx2b+10,ky2+10,col,3.4);
    sf(11,"bold"); tc(doc,...TEXT); doc.text(String(val),kx2b+kw/2,ky2+kh*.6,{align:"center"});
    sf(5.5,"bold"); tc(doc,...TEXT3); doc.text(label,kx2b+kw/2,ky2+kh*.82,{align:"center"});
  });
  // Info
  const ix2=kx3+kpiW+4;
  dCard(ix2,y,infoW,row1H);
  sf(6,"bold"); tc(doc,...TEXT3); doc.text(isAr?"بياناتك":"YOUR INFORMATION",ix2+4,y+7);
  [["👤",isAr?"الاسم":"Name",name],["✉",isAr?"البريد":"Email",email.length>22?email.slice(0,22)+"…":email],
   ["🏢",isAr?"الشركة":"Company",company||"—"],["🔑","ID",`local_${session.id?.slice(-8)||"xxxxxxxx"}`]
  ].forEach(([icon,lbl,val],i)=>{
    const ry=y+16+i*14;
    sf(5.5,"normal"); tc(doc,...TEXT3); doc.text(String(lbl),ix2+4,ry);
    sf(6,"bold"); tc(doc,...TEXT); doc.text(String(val),ix2+4,ry+6.5);
    if(i<3){fc(doc,...BORDER);doc.rect(ix2+4,ry+9,infoW-8,.3,"F");}
  });
  y+=row1H+5;

  // Timeline
  dCard(ml,y,cw,46);
  sf(6.5,"bold"); tc(doc,...TEXT3); doc.text(isAr?"تسلسل النتيجة زمنياً":"SCORE TIMELINE",ml+4,y+7);
  if(hist.length>1){
    const lo=Math.max(0,Math.min(...hist)-5),hi=Math.min(100,Math.max(...hist)+5),rng=hi-lo;
    const gx=ml+8,gw2=cw-16,gh=28,gy=y+13;
    [50,65,80,95].forEach(v=>{
      if(v<lo-5||v>hi+5)return;
      const ly=gy+gh-((v-lo)/Math.max(rng,1))*gh;
      fc(doc,...BORDER);doc.setGState&&doc.setGState(new doc.GState({opacity:.3}));
      doc.rect(gx,ly,gw2,.2,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      sf(4.5,"normal");tc(doc,...TEXT3);doc.text(String(v),gx-2,ly+1.5,{align:"right"});
    });
    const pts=hist.map((s,i)=>({px:gx+(i/(hist.length-1))*gw2,py:gy+gh-((s-lo)/Math.max(rng,1))*gh}));
    try{
      const segs=pts.slice(1).map((p,i)=>[p.px-pts[i].px,p.py-pts[i].py]);
      fc(doc,37,99,235);doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
      doc.lines([...segs,[0,gy+gh-pts[pts.length-1].py],[-(pts[pts.length-1].px-pts[0].px),0]],pts[0].px,pts[0].py,[1,1],"F",false);
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    }catch{}
    dc(doc,37,99,235);lw(doc,1.2);
    pts.forEach((p,i)=>{if(i>0)doc.line(pts[i-1].px,pts[i-1].py,p.px,p.py);});lw(doc,.3);
    pts.filter((_,i)=>i%(Math.ceil(pts.length/8))===0||i===pts.length-1).forEach(p=>{fc(doc,37,99,235);doc.circle(p.px,p.py,1.5,"F");});
    const lp=pts[pts.length-1];
    fc(doc,...gradeC);doc.setGState&&doc.setGState(new doc.GState({opacity:.9}));
    doc.circle(lp.px,lp.py,4,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(5.5,"bold");tc(doc,...[10,15,30]);doc.text(String(avg),lp.px,lp.py+1.8,{align:"center"});
    sf(4.5,"normal");tc(doc,...TEXT3);
    ["00:00",`00:${Math.floor(dur/4/60).toString().padStart(2,'0')}`,`00:${Math.floor(dur/2/60).toString().padStart(2,'0')}`,`00:${Math.floor(dur*3/4/60).toString().padStart(2,'0')}`,`${String(Math.floor(dur/60)).padStart(2,'0')}:${String(dur%60).padStart(2,'0')}`]
      .forEach((t,i)=>doc.text(t,gx+(i/4)*gw2,gy+gh+5,{align:"center"}));
  }
  if(aiText){
    const tipLines=doc.splitTextToSize((aiText.split('.')[0]+'.'),cw-12);
    const tipH=tipLines.length*5+7;
    dCard(ml,y+47,cw,tipH,4,CARD2);
    sf(6.5,"normal");tc(doc,...TEXT2);tipLines.forEach((l,i)=>doc.text(l,ml+5,y+47+6+i*5));
    y+=47+tipH+5;
  } else { y+=51; }

  // Metrics
  sf(7,"bold");tc(doc,...TEXT);doc.text(isAr?"مقاييس الوضعية الرئيسية":"KEY POSTURE METRICS",ml,y+5);y+=9;
  const mshow2=mEntries.slice(0,3);
  const mw2=(cw-(mshow2.length-1)*5)/Math.max(mshow2.length,1);
  mshow2.forEach(({lbl,sc,val,unit,pri,priC},i)=>{
    const mx=ml+i*(mw2+5);const mh=38;
    _metricMiniCard(doc,{mx,y,mw:mw2,mh,lbl,sc,val,unit,pri,isAr,sf,dCard,BORDER,TEXT,TEXT2,TEXT3});
  });
  y+=mshow2.length>0?45:0;

  // Footer p1
  fc(doc,...BORDER);doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
  doc.rect(ml,H-9,cw,.3,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  sf(5.5,"normal");tc(doc,...TEXT3);
  doc.text(isAr?"Corvus Health Intelligence · سري · ليس تشخيصاً طبياً":"Corvus Health Intelligence · Confidential · Not a medical diagnosis",ml,H-4.5);doc.text("1 / 2",W-mr,H-4.5,{align:"right"});

  // PAGE 2 — full metrics + AI analysis
  doc.addPage(); fc(doc,...BG); doc.rect(0,0,W,H,"F");
  fc(doc,...BG2);doc.rect(0,0,W,15,"F");fc(doc,...ACCENT);doc.rect(0,0,W,1.6,"F");
  _logo(doc,ml,3,9,_logoSm);sf(7.5,"bold");tc(doc,...TEXT);doc.text("CORVUS",ml+13,8);
  sf(4.5,"normal");tc(doc,...TEXT2);doc.text("HEALTH INTELLIGENCE",ml+13,13);
  sf(6,"normal");tc(doc,...TEXT3);doc.text(`${isAr?"جلسة":"Session"} #${realIdx}  •  ${dayStr}, ${timeStr}`,W-mr,10,{align:"right"});
  fc(doc,...BORDER);doc.rect(0,15,W,.5,"F");
  y=22;

  // Radar + Insights + Summary
  const radarW2=60,insW2=75,sumW2=cw-radarW2-insW2-8,rowH2=100;
  dCard(ml,y,radarW2,rowH2);
  sf(6,"bold");tc(doc,...TEXT3);doc.text(isAr?"نظرة عامة على الوضعية":"POSTURE OVERVIEW",ml+4,y+6);
  const rcx3=ml+radarW2/2,rcy3=y+rowH2/2+6,rad3=22;
  const lbls3=isAr?["الرقبة","الكتفين","العمود الفقري","الاتزان","وضع الشاشة"]:["Neck\nAlign.","Shoulder\nPosition","Spine\nAlign.","Sitting\nBalance","Screen\nErgonomics"];
  const ang3=lbls3.map((_,i)=>((i/lbls3.length)*360-90)*Math.PI/180);
  fc(doc,37,99,235);doc.setGState&&doc.setGState(new doc.GState({opacity:.08}));
  const op3=ang3.map(a=>({x:rcx3+Math.cos(a)*rad3,y:rcy3+Math.sin(a)*rad3}));
  try{const os3=op3.slice(1).map((p,i)=>[p.px-op3[i].px,p.py-op3[i].py]);
    doc.lines([...op3.slice(1).map((p,i)=>[p.x-op3[i].x,p.y-op3[i].y],[op3[0].x-op3[op3.length-1].x,op3[0].y-op3[op3.length-1].y])],op3[0].x,op3[0].y,[1,1],"F",false);}catch{}
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  [.33,.66,1].forEach(f=>{
    const gp=ang3.map(a=>({x:rcx3+Math.cos(a)*rad3*f,y:rcy3+Math.sin(a)*rad3*f}));
    dc(doc,...BORDER);lw(doc,.2);
    try{doc.lines([...gp.slice(1).map((p,i)=>[p.x-gp[i].x,p.y-gp[i].y]),[gp[0].x-gp[gp.length-1].x,gp[0].y-gp[gp.length-1].y]],gp[0].x,gp[0].y,[1,1],"S",false);}catch{}
  });lw(doc,.3);
  // Four of these five were names the engine never emits, so four of the
    // five axes on every radar ever printed were the ?? 70 default — the same
    // pentagon on every report, with one real vertex.
    const metK3=["neck_lean","shoulder_level","spine_lean","fhp_index","screen_distance"];
  const uS3=metK3.map(k=>_metricScore(metrics,k));
  const _radar3OK = uS3.every(v=>v!==null);
  const up3=ang3.map((a,i)=>{const v=_radar3OK?uS3[i]:0;
    return {x:rcx3+Math.cos(a)*rad3*(v/100),y:rcy3+Math.sin(a)*rad3*(v/100)};});
  if(_radar3OK){
  fc(doc,37,99,235);doc.setGState&&doc.setGState(new doc.GState({opacity:.25}));
  try{doc.lines([...up3.slice(1).map((p,i)=>[p.x-up3[i].x,p.y-up3[i].y]),[up3[0].x-up3[up3.length-1].x,up3[0].y-up3[up3.length-1].y]],up3[0].x,up3[0].y,[1,1],"F",false);}catch{}
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  dc(doc,37,99,235);lw(doc,.8);
  try{doc.lines([...up3.slice(1).map((p,i)=>[p.x-up3[i].x,p.y-up3[i].y]),[up3[0].x-up3[up3.length-1].x,up3[0].y-up3[up3.length-1].y]],up3[0].x,up3[0].y,[1,1],"S",false);}catch{}
  lw(doc,.3);up3.forEach(p=>{fc(doc,37,99,235);doc.circle(p.x,p.y,1.5,"F");});
  }
  if(!_radar3OK){
    const miss3=metK3.filter((k,i)=>uS3[i]===null)
      .map(k=>(isAr?(METRIC_LABELS_AR[k]||k):(METRIC_LABELS[k]||k)));
    sf(5,"italic");tc(doc,...TEXT3);
    doc.text(isAr?`مش متقاس: ${miss3.join("، ")}`:`Not measurable: ${miss3.join(", ")}`,
             rcx3,rcy3+rad3+8,{align:"center"});
  }
  ang3.forEach((a,i)=>{
    const lx=rcx3+Math.cos(a)*(rad3+7),ly=rcy3+Math.sin(a)*(rad3+7);
    sf(4.5,"normal");tc(doc,...TEXT3);doc.text(lbls3[i].replace('\n',' '),lx,ly,{align:"center"});
  });
  sf(5,"normal");tc(doc,37,99,235);doc.text(isAr?"— أنت":"— You",ml+4,y+rowH2-7);
  tc(doc,...TEXT3);doc.text("  - - Optimal",ml+4,y+rowH2-2.5);

  // Insights
  const inx3=ml+radarW2+4;
  dCard(inx3,y,insW2,rowH2);
  sf(6,"bold");tc(doc,...TEXT3);doc.text(isAr?"أبرز الملاحظات":"POSTURE INSIGHTS",inx3+4,y+6);
  mEntries.slice(0,3).map(({lbl,sc,val,unit})=>({
    text:isAr
      ? `${lbl}: ${sc<60?"يحتاج إلى انتباه":"ضمن المعدل"}`
      : `Your ${lbl.toLowerCase()} ${sc<60?"needs attention.":"is acceptable."}`,
    detail:isAr
      ? (sc<40?"أولوية عالية — عالجها فوراً.":sc<65?"متوسطة — راقبها.":"جيد.")
      : (sc<40?"High priority — address immediately.":sc<65?"Moderate — monitor.":"Looking good."),
    col:sc<40?[239,68,68]:sc<65?[245,158,11]:[34,197,94],
  })).forEach(({text,detail,col},i)=>{
    const iy=y+12+i*28;
    fc(doc,...col);doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
    doc.circle(inx3+10,iy+7,8,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    // Solid status dot — emoji (🔴🟡🟢) don't exist in jsPDF's built-in helvetica and render as mojibake
    fc(doc,...col);doc.circle(inx3+10,iy+7,2.4,"F");
    sf(7,"bold");tc(doc,...TEXT);doc.text(text,inx3+21,iy+7);
    sf(6,"normal");tc(doc,...TEXT2);doc.text(detail,inx3+21,iy+13.5);
    if(i<2){fc(doc,...BORDER);doc.rect(inx3+4,iy+22,insW2-8,.25,"F");}
  });

  // Summary
  const sx3=inx3+insW2+4;
  dCard(sx3,y,sumW2,rowH2);
  sf(6,"bold");tc(doc,...TEXT3);doc.text(isAr?"ملخص الجلسة":"SESSION SUMMARY",sx3+4,y+6);
  [[isAr?"النتيجة الكلية":"Overall Score",`${avg}/100`,gradeC],[isAr?"وضعية جيدة":"Good Posture",`${goodPct}%`,[34,197,94]],
   [isAr?"التنبيهات":"Alerts",String(alerts),[245,158,11]],[isAr?"المدة":"Duration",fmtDurShort(dur),[99,102,241]],
   [isAr?"الجلسة":"Session",`#${realIdx}`,[99,102,241]],[isAr?"التاريخ":"Date",dayStr.split(',')[0],[148,163,200]],[isAr?"الوقت":"Time",timeStr,[148,163,200]]
  ].forEach(([k,v,col],i)=>{
    const ry=y+10+i*12;
    sf(6,"normal");tc(doc,...TEXT3);doc.text(k,sx3+4,ry+5);
    sf(6.5,"bold");tc(doc,...col);doc.text(v,sx3+sumW2-4,ry+5,{align:"right"});
    if(i<6){fc(doc,...BORDER);doc.setGState&&doc.setGState(new doc.GState({opacity:.2}));
      doc.rect(sx3+4,ry+7.5,sumW2-8,.2,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));}
  });
  y+=rowH2+5;

  // Full metrics (Elite only)
  if(mEntries.length>0){
    sf(7,"bold");tc(doc,...TEXT);doc.text(isAr?"جميع المقاييس":"ALL POSTURE METRICS",ml,y+5);y+=9;
    mEntries.forEach(({lbl,sc,val,unit,pri,priC},i)=>{
      if(y>H-45){doc.addPage();fc(doc,...BG);doc.rect(0,0,W,H,"F");y=14;}
      const mh=26;const iconC=sc<40?[239,68,68]:sc<65?[245,158,11]:[34,197,94];
      dCard(ml,y,cw,mh,4);
      fc(doc,...iconC);doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
      rr(doc,ml+4,y+4,10,10,2,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      // Solid status dot — arrow/check glyphs don't exist in helvetica
      fc(doc,...iconC);doc.circle(ml+9,y+9,1.8,"F");
      sf(8.5,"bold");tc(doc,...TEXT);doc.text(lbl,ml+18,y+10);
      if(val!==undefined){sf(6.5,"normal");tc(doc,...TEXT2);doc.text(`${Math.round(val*10)/10}${unit}`,ml+18,y+17.5);}
      // Progress bar
      const bx=ml+70,bw=cw-90;
      fc(doc,...BORDER);rr(doc,bx,y+9,bw,5,2,"F");
      fc(doc,...iconC);rr(doc,bx,y+9,Math.max(bw*(sc/100),3),5,2,"F");
      sf(7.5,"bold");tc(doc,...iconC);doc.text(`${Math.round(sc)}/100`,ml+cw-22,y+13.5,{align:"right"});
      // Priority
      const pw2=doc.getTextWidth(pri)+8;
      fc(doc,...iconC);doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
      rr(doc,ml+cw-pw2-24,y+mh-10,pw2,7,2,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      sf(5.5,"bold");tc(doc,...iconC);doc.text(pri,ml+cw-pw2/2-24,y+mh-5,{align:"center"});
      y+=mh+4;
    });
    y+=4;
  }

  // AI Analysis — card height fits the text (was fixed at 60mm, which left a
  // large empty box under short summaries).
  if(aiText&&y<H-60){
    const aiLines=doc.splitTextToSize(aiText.replace(/[#*`]/g,"").trim(),cw-12).slice(0,7);
    const aiCardH=Math.min(H-y-12, Math.max(24, 15+aiLines.length*5.5));
    dCard(ml,y,cw,aiCardH,5,CARD2);
    sf(7,"bold");tc(doc,...TEXT);doc.text(isAr?"تحليل Corvus AI":"Corvus AI Analysis",ml+5,y+8);
    sf(7,"normal");tc(doc,...TEXT2);
    aiLines.forEach((l,i)=>{if(y+16+i*5.5<H-14)doc.text(l,ml+5,y+16+i*5.5);});
  }

  // ── Inner-page header for Elite exclusive pages ───────────────
  const _ePage = (label) => {
    doc.addPage(); fc(doc,...BG); doc.rect(0,0,W,H,"F");
    fc(doc,...BG2); doc.rect(0,0,W,15,"F"); fc(doc,...ACCENT); doc.rect(0,0,W,1.6,"F");
    _logo(doc,ml,3,9,_logoSm);
    sf(7.5,"bold"); tc(doc,...TEXT); doc.text("CORVUS",ml+13,8);
    sf(4.5,"normal"); tc(doc,...TEXT2); doc.text("HEALTH INTELLIGENCE",ml+13,13);
    sf(6,"bold"); tc(doc,...tierCol); doc.text(String(label),W-mr,10,{align:"right"});
    fc(doc,...BORDER); doc.rect(0,15,W,.5,"F");
    return 24;
  };
  const _eSection = (yy,title,sub,col) => {
    fc(doc,...(col||ACCENT)); rr(doc,ml,yy,2.4,sub?12:8,1.2,"F");
    sf(12,"bold"); tc(doc,...TEXT); doc.text(String(title),ml+7,yy+(sub?5:6));
    if(sub){ sf(6,"normal"); tc(doc,...TEXT2); doc.text(String(sub),ml+7,yy+11); }
    return yy+(sub?18:12);
  };

  // ══════════════════════════════════════════════════════════════
  // PRO stops here — Elite unlocks clinical + ergonomic + progress pages
  // ══════════════════════════════════════════════════════════════
  if (isPro && !isElite) {
    if (y<H-32) {
      const uy=H-30;
      fc(doc,...CARD2); rr(doc,ml,uy,cw,18,4,"F");
      dc(doc,...[34,197,94]); lw(doc,0.5); rr(doc,ml,uy,cw,18,4,"S"); lw(doc,0.3);
      fc(doc,...[34,197,94]); doc.circle(ml+10,uy+9,4.5,"F");
      sf(8.5,"bold"); tc(doc,...TEXT); doc.text(isAr?"رقّ إلى Elite لتقرير أعمق":"Upgrade to Elite for the full report",ml+20,uy+7.5);
      sf(6.3,"normal"); tc(doc,...TEXT2);
      doc.text(isAr?"خريطة العمود الفقري السريرية · بطاقة الإرجونوميكس · خطة تمارين أسبوعية · تتبّع الأهداف · لقطات الوضعية":"Clinical spinal map · Ergonomic scorecard · Weekly exercise plan · Goal tracking · Posture snapshots",ml+20,uy+13);
    }
    fc(doc,...BORDER);doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
    doc.rect(ml,H-9,cw,.3,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(5.5,"normal");tc(doc,...TEXT3);doc.text(isAr?"Corvus Health Intelligence · سري · ليس تشخيصاً طبياً":"Corvus Health Intelligence · Confidential · Not a medical diagnosis",ml,H-4.5);
    const ptot=doc.internal.getNumberOfPages();
    for(let p=1;p<=ptot;p++){doc.setPage(p);sf(5.5,"normal");tc(doc,...TEXT3);doc.text(`${p} / ${ptot}`,W-mr,H-4.5,{align:"right"});}
    const _fn = `Corvus_Pro_Session_${realIdx}_${new Date().toISOString().slice(0,10)}.pdf`;
    await doc.save(_fn, {returnPromise:true});
    return _fn;
  }

  // ══════════════════════════════════════════════════════════════
  // ELITE EXCLUSIVE — CLINICAL SPINAL ZONE MAP
  // ══════════════════════════════════════════════════════════════
  {
    let ey=_ePage(isAr?"الخريطة السريرية":"CLINICAL MAP");
    ey=_eSection(ey,isAr?"خريطة مخاطر العمود الفقري":"Spinal Zone Risk Map",
      isAr?"مشتقّة حسابياً من مقاييس الجلسة — ليست تشخيصاً طبياً":"Computed from this session's metrics — not a medical diagnosis",[239,68,68]);
    ey+=4;
    const zonal=_zonalRisk(metrics);
    // Body silhouette (right column)
    const bx=ml+cw*0.66, bw3=30, headR=9, bodyTop=ey+2;
    dc(doc,...BORDER); lw(doc,0.5);
    fc(doc,...CARD2); doc.circle(bx+bw3/2, bodyTop+headR, headR, "FD"); lw(doc,0.3);
    const segs=[["cervical",bodyTop+headR*2,15],["thoracic",bodyTop+headR*2+15,28],["lumbar",bodyTop+headR*2+43,18]];
    segs.forEach(([k,zy,zh])=>{
      const c=_zColor(zonal,k);
      fc(doc,...c); doc.setGState&&doc.setGState(new doc.GState({opacity:0.4}));
      rr(doc,bx+4,zy,bw3-8,zh-2,2.5,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    });
    sf(5,"normal"); tc(doc,...TEXT3); doc.text(isAr?"مُلوّنة حسب الخطر":"coloured by zone risk",bx+bw3/2,bodyTop+headR*2+68,{align:"center"});
    // Zone cards (left column)
    const zoneMeta=[
      ["cervical","Cervical Spine (Neck)","الفقرات العنقية","C1–C7"],
      ["thoracic","Thoracic Spine (Upper)","الفقرات الصدرية","T1–T12"],
      ["lumbar","Lumbar Spine (Lower)","الفقرات القطنية","L1–S1"],
    ];
    const zcw=cw*0.60;
    zoneMeta.forEach(([k,en,ar,seg],i)=>{
      const risk=_zBar(zonal,k), c=_zColor(zonal,k), zy=ey+i*26, zh=22;
      dCard(ml,zy,zcw,zh,4);
      fc(doc,...c); rr(doc,ml,zy,2.4,zh,1.2,"F");
      // risk disc
      fc(doc,...c); doc.circle(ml+16,zy+zh/2,9,"F");
      sf(10,"bold"); tc(doc,...[255,255,255]); doc.text(`${risk}%`,ml+16,zy+zh/2+1.5,{align:"center"});
      sf(4.5,"normal"); tc(doc,...[255,255,255]); doc.text("RISK",ml+16,zy+zh/2+6,{align:"center"});
      // labels
      sf(9,"bold"); tc(doc,...TEXT); doc.text(isAr?ar:en,ml+30,zy+8);
      sf(6.5,"bold"); tc(doc,...ACCENT); doc.text(seg,ml+30,zy+14);
      const rl=_riskLabel(risk,isAr);
      sf(6.5,"bold"); tc(doc,...c); doc.text(`${isAr?"مستوى الخطر":"Risk"}: ${rl}`,ml+30,zy+19.5);
      // bar
      const bbx=ml+zcw*0.60, bbw=zcw*0.34;
      fc(doc,...BORDER); rr(doc,bbx,zy+zh/2-1.5,bbw,4,2,"F");
      fc(doc,...c); rr(doc,bbx,zy+zh/2-1.5,Math.max(bbw*(risk/100),3),4,2,"F");
    });

    // ── Priority Focus banner (fills the page, gives the map meaning) ──
    let ez = ey + zoneMeta.length*26 + 8;
    const _zoneInfo = {
      cervical: { en:["Cervical Spine (Neck)","Neck lean, forward-head translation and rotation load the cervical discs and upper trapezius — the most common driver of tension-type headache and neck fatigue at a desk."],
                  ar:["الفقرات العنقية","ميل الرقبة وتقدّم الرأس والدوران يحمّلون الفقرات العنقية والعضلة شبه المنحرفة — أكثر مسبب لصداع التوتر وإجهاد الرقبة أثناء العمل."] },
      thoracic: { en:["Thoracic Spine (Upper)","Shoulder asymmetry and rounded-shoulder posture load the upper back; chronic elevation risks thoracic kyphosis and rotator-cuff impingement."],
                  ar:["الفقرات الصدرية","عدم تناظر الكتفين وتقوّس الأكتاف يحمّلان أعلى الظهر؛ استمرارها يرفع خطر تحدّب الظهر وانحشار الكفة المدوّرة."] },
      lumbar:   { en:["Lumbar Spine (Lower)","Sagittal and coronal alignment with hip positioning govern lower-back load; deviation may indicate posterior-chain tightness or uneven disc loading."],
                  ar:["الفقرات القطنية","المحاذاة الأمامية والجانبية مع وضع الورك تتحكّم في حمل أسفل الظهر؛ الانحراف قد يشير إلى شدّ السلسلة الخلفية أو تحميل غير متساوٍ للأقراص."] },
    };
    // Only zones with a reading can be "the worst"; ranking an unmeasured
    // zone as 0 quietly guaranteed it was never named.
    const _measuredZones = ["cervical","thoracic","lumbar"].filter(k=>_zHas(zonal,k));
    const _worstKey = (_measuredZones.length?_measuredZones:["cervical"])
      .sort((a,b)=>(_zNum(zonal,b)??0)-(_zNum(zonal,a)??0))[0];
    const _wc = _zColor(zonal,_worstKey);
    const bnH2 = 30;
    fc(doc,..._wc); doc.setGState&&doc.setGState(new doc.GState({opacity:0.08})); rr(doc,ml,ez,cw,bnH2,5,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    fc(doc,..._wc); rr(doc,ml,ez,3.2,bnH2,1.6,"F");
    sf(6.5,"bold"); tc(doc,..._wc); doc.text(isAr?"منطقة التركيز ذات الأولوية":"PRIORITY FOCUS ZONE",ml+9,ez+8);
    sf(11,"bold"); tc(doc,...TEXT); doc.text(`${isAr?_zoneInfo[_worstKey].ar[0]:_zoneInfo[_worstKey].en[0]} — ${_zPct(zonal,_worstKey,isAr)}`,ml+9,ez+18);
    sf(7.5,"normal"); tc(doc,...TEXT2);
    doc.text(doc.splitTextToSize(isAr?"ابدأ التمارين التصحيحية من هذه المنطقة أولاً للحصول على أسرع تحسّن.":"Start corrective exercise here first for the fastest overall improvement.",cw-16)[0],ml+9,ez+26);
    ez += bnH2 + 10;

    // ── Zone Insights (clinical descriptions per region) ──
    ez=_eSection(ez,isAr?"ماذا تعني كل منطقة":"What Each Zone Means","",[99,102,241]); ez+=2;
    ["cervical","thoracic","lumbar"].forEach((k)=>{
      const info=isAr?_zoneInfo[k].ar:_zoneInfo[k].en, c=_zColor(zonal,k);
      const lines=doc.splitTextToSize(info[1],cw-14);
      const ih=8+lines.length*4.6+4;
      dCard(ml,ez,cw,ih,4);
      fc(doc,...c); rr(doc,ml,ez,2.4,ih,1.2,"F");
      sf(8.5,"bold"); tc(doc,...TEXT); doc.text(info[0],ml+7,ez+7);
      sf(6.5,"bold"); tc(doc,...c); doc.text(_zPct(zonal,k,isAr),ml+cw-6,ez+7,{align:"right"});
      sf(7,"normal"); tc(doc,...TEXT2);
      lines.forEach((l,li)=>doc.text(l,ml+7,ez+12.5+li*4.6));
      ez += ih + 5;
    });
    // page footer handled by global page-number loop at end
  }

  // ══════════════════════════════════════════════════════════════
  // ELITE EXCLUSIVE — ERGONOMIC WORKSTATION SCORECARD
  // ══════════════════════════════════════════════════════════════
  {
    let ey=_ePage(isAr?"بطاقة الإرجونوميكس":"ERGONOMICS");
    ey=_eSection(ey,isAr?"بطاقة إعداد محطة العمل":"Ergonomic Workstation Scorecard",
      isAr?"تقييم إعدادك الفيزيائي مقابل المعايير المكتبية":"Your physical setup vs. desk-ergonomics standards",[6,182,212]);
    ey+=4;
    const _mv=(k)=>metrics[k]||{};
    const ergo=[
      { key:"monitor_height", en:"Monitor Height", ar:"ارتفاع الشاشة",
        fixEn:"Raise/lower the top of the screen to eye level.", fixAr:"اضبط أعلى الشاشة عند مستوى العين." },
      { key:"screen_distance", en:"Screen Distance", ar:"مسافة الشاشة",
        fixEn:"Sit an arm's length (50–70cm) from the screen.", fixAr:"اجلس على مسافة ذراع (50–70سم) من الشاشة." },
      { key:"elbow_angle", en:"Elbow Angle", ar:"زاوية الكوع",
        fixEn:"Keep elbows near 90–100° with forearms supported.", fixAr:"حافظ على زاوية الكوع 90–100° مع دعم الساعد." },
      { key:"neck_lean", en:"Neck Position", ar:"وضعية الرقبة",
        fixEn:"Stack ears over shoulders; tuck the chin slightly.", fixAr:"اجعل الأذن فوق الكتف؛ أدخل الذقن قليلاً." },
    ];
    ergo.forEach((e,i)=>{
      const m=_mv(e.key), sc=Math.round(m.score??100), c=sc<40?[239,68,68]:sc<65?[245,158,11]:[34,197,94];
      const pass=sc>=65, cy=ey+i*30, ch=26;
      dCard(ml,cy,cw,ch,4);
      fc(doc,...c); rr(doc,ml,cy,2.4,ch,1.2,"F");
      // status pill
      const stl=pass?(isAr?"جيد":"Good"):(isAr?"يحتاج ضبط":"Adjust");
      const stw=doc.getTextWidth(stl)+10;
      fc(doc,...c); doc.setGState&&doc.setGState(new doc.GState({opacity:.14})); rr(doc,ml+8,cy+6,stw,7,2,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      sf(6,"bold"); tc(doc,...c); doc.text(stl,ml+8+stw/2,cy+10.7,{align:"center"});
      // title + value — measure the title width at ITS font before switching
      sf(9.5,"bold"); tc(doc,...TEXT); const _et=isAr?e.ar:e.en; doc.text(_et,ml+8,cy+21);
      const _etw=doc.getTextWidth(_et);
      if(m.value!==undefined&&m.value!==null){ sf(6.5,"normal"); tc(doc,...TEXT2); doc.text(`${Math.round(m.value*10)/10}${m.unit==="depth"?"":(m.unit||"")}`,ml+8+_etw+5,cy+21); }
      // score number
      sf(15,"bold"); tc(doc,...c); doc.text(String(sc),ml+cw*0.52,cy+15,{align:"right"});
      sf(5,"normal"); tc(doc,...TEXT3); doc.text("/100",ml+cw*0.52+1,cy+15);
      // recommendation
      sf(6.3,"normal"); tc(doc,...TEXT2);
      const fx=doc.splitTextToSize(isAr?e.fixAr:e.fixEn,cw*0.42);
      fx.slice(0,2).forEach((l,j)=>doc.text(l,ml+cw*0.56,cy+9+j*5));
    });
    ey+=ergo.length*30+2;
    // Overall ergonomic index
    // ?? 100 again: an ergonomic index that rose toward perfect for every
    // metric the session could not measure.
    const _eVals=ergo.map(e=>_metricScore(metrics,e.key)).filter(v=>v!==null);
    const eIdx=_eVals.length?Math.round(_eVals.reduce((a,b)=>a+b,0)/_eVals.length):null;
    const eC=eIdx<40?[239,68,68]:eIdx<65?[245,158,11]:[34,197,94];
    if(ey<H-24){
      dCard(ml,ey,cw,16,4,CARD2);
      fc(doc,...eC); rr(doc,ml,ey,2.4,16,1.2,"F");
      sf(7,"bold"); tc(doc,...TEXT); doc.text(isAr?"مؤشر الإرجونوميكس العام":"Overall Ergonomic Index",ml+8,ey+10);
      sf(13,"bold"); tc(doc,...eC); doc.text(`${eIdx}/100`,ml+cw-6,ey+11,{align:"right"});
      ey+=24;
    }

    // ── Desk Setup Essentials (best-practice checklist, fills the page) ──
    ey=_eSection(ey,isAr?"أساسيات إعداد المكتب":"Desk Setup Essentials",
      isAr?"معايير مرجعية لمحطة عمل صحية":"Reference standards for a healthy workstation",[6,182,212]); ey+=2;
    const _ess=[
      isAr?"الشاشة: أعلى الشاشة عند مستوى العين، على مسافة ذراع (50–70سم).":"Monitor: top of screen at eye level, about an arm's length (50–70cm) away.",
      isAr?"الكرسي: ادعم أسفل الظهر، القدمان مسطّحتان، الركبتان بزاوية ~90°.":"Chair: lumbar support engaged, feet flat on the floor, knees at ~90°.",
      isAr?"لوحة المفاتيح والفأرة: المرفقان ~90° والمعصمان في وضع محايد.":"Keyboard & mouse: elbows ~90°, wrists neutral and floating-free.",
      isAr?"الإضاءة: تجنّب الوهج على الشاشة، وطابق سطوعها مع الغرفة.":"Lighting: avoid glare on the screen; match its brightness to the room.",
      isAr?"الحركة: قف وتمدّد كل 30 دقيقة، وطبّق قاعدة 20-20-20 للعينين.":"Movement: stand and stretch every 30 min; apply the 20-20-20 rule for the eyes.",
    ];
    _ess.forEach((t)=>{
      const lines=doc.splitTextToSize(t,cw-20);
      const rh=Math.max(13,6+lines.length*4.6);
      dCard(ml,ey,cw,rh,3.5);
      fc(doc,...PDF_TOKENS.cyan||[6,182,212]); doc.circle(ml+8,ey+rh/2,2.2,"F");
      sf(7.5,"normal"); tc(doc,...TEXT2);
      lines.forEach((l,li)=>doc.text(l,ml+15,ey+rh/2-((lines.length-1)*2.3)+li*4.6+0.8));
      ey+=rh+4;
    });
  }

  // ═══ ELITE INSIGHTS: snapshots + weekly goal + exercise plan ═══
  const _snaps   = Array.isArray(session.worst_snapshots) ? session.worst_snapshots.slice(0,3) : [];
  const _goal    = Number(profile?.goal_score) || null;
  const _plan    = profile?.exercise_plan?.week === _exWeekKey() ? profile.exercise_plan : null;
  if (_snaps.length || _goal || _plan) {
    doc.addPage(); fc(doc,...BG); doc.rect(0,0,W,H,"F");
    fc(doc,...BG2);doc.rect(0,0,W,15,"F");fc(doc,...ACCENT);doc.rect(0,0,W,1.6,"F");
    _logo(doc,ml,3,9,_logoSm);sf(7.5,"bold");tc(doc,...TEXT);doc.text("CORVUS",ml+13,8);
    sf(4.5,"normal");tc(doc,...TEXT2);doc.text("HEALTH INTELLIGENCE",ml+13,13);
    sf(6,"normal");tc(doc,...TEXT3);doc.text(isAr?"رؤى Elite":"ELITE INSIGHTS",W-mr,10,{align:"right"});
    fc(doc,...BORDER);doc.rect(0,15,W,.5,"F");
    y=24;

    // ── Worst-posture snapshots ──────────────────────────────────
    if(_snaps.length){
      sf(7,"bold");tc(doc,...TEXT);doc.text(isAr?"أسوأ لحظات الجلسة":"WORST POSTURE MOMENTS",ml,y);
      sf(5.5,"normal");tc(doc,...TEXT3);doc.text(isAr?"لقطات تلقائية عند أدنى سكور":"Auto-captured at the lowest scores",ml,y+5.5);
      y+=10;
      const gap=6, iw=(cw-gap*2)/3, ih=iw*0.75;
      _snaps.forEach((s,i)=>{
        const sx=ml+i*(iw+gap);
        dCard(sx-1,y-1,iw+2,ih+13,4);
        try{ doc.addImage(s.img,"JPEG",sx,y,iw,ih); }catch{
          sf(6,"normal");tc(doc,...TEXT3);doc.text("—",sx+iw/2,y+ih/2,{align:"center"});
        }
        const scol=s.score<40?[239,68,68]:[245,158,11];
        sf(7.5,"bold");tc(doc,...scol);doc.text(`${s.score}/100`,sx+3,y+ih+8);
        sf(5.5,"normal");tc(doc,...TEXT3);doc.text(String(s.time||""),sx+iw-3,y+ih+8,{align:"right"});
      });
      y+=(cw-12)/3*0.75+22;
    }

    // ── Weekly goal progress ─────────────────────────────────────
    if(_goal){
      const now=Date.now(), WK=7*86400000;
      const cur7=_exWindowAvg(allSessions,now-WK,now+1);
      const prev7=_exWindowAvg(allSessions,now-2*WK,now-WK);
      const slope=_exSlopePerDay(allSessions);
      const reached=cur7!=null&&cur7>=_goal;
      const gh=34;
      dCard(ml,y,cw,gh,5,CARD2);
      sf(7,"bold");tc(doc,...TEXT);doc.text(isAr?"هدفك الأسبوعي":"WEEKLY GOAL",ml+5,y+8);
      const gcol=reached?[34,197,94]:[37,99,235];
      sf(11,"bold");tc(doc,...gcol);doc.text(`${cur7??"—"}`,ml+5,y+21);
      sf(6.5,"normal");tc(doc,...TEXT3);doc.text(`/ ${_goal}`,ml+5+doc.getTextWidth(`${cur7??"—"}`)+2,y+21);
      // Progress bar
      const gbx=ml+45,gbw=cw-95;
      fc(doc,...BORDER);rr(doc,gbx,y+16,gbw,5,2,"F");
      fc(doc,...gcol);rr(doc,gbx,y+16,Math.max(gbw*Math.min(1,(cur7||0)/_goal),3),5,2,"F");
      // Delta vs last week
      if(cur7!=null&&prev7!=null){
        const d=cur7-prev7,dcol=d>0?[34,197,94]:d<0?[239,68,68]:TEXT3;
        sf(7,"bold");tc(doc,...dcol);
        // "+/-" only — ▲▼ glyphs don't exist in jsPDF's built-in helvetica
        doc.text(`${d>0?"+":d<0?"-":""}${Math.abs(d)}`,ml+cw-5,y+13,{align:"right"});
        sf(5,"normal");tc(doc,...TEXT3);doc.text(isAr?"عن الأسبوع الماضي":"vs last week",ml+cw-5,y+18.5,{align:"right"});
      }
      // ETA line
      let eta=reached?(isAr?"وصلت لهدفك — ثبّته أسبوعاً كاملاً":"Goal reached — hold it for a full week")
        : slope!=null&&slope>0.05?(isAr?`بمعدلك الحالي (+${slope.toFixed(1)}/يوم) تصل خلال ~${Math.ceil((_goal-(cur7||0))/slope)} يوم`:`At +${slope.toFixed(1)} pts/day you'll reach it in ~${Math.ceil((_goal-(cur7||0))/slope)} days`)
        : slope!=null&&slope<-0.05?(isAr?"الاتجاه نازل — راجع خطة التمارين":"Trending down — revisit the exercise plan")
        : (isAr?"المعدل ثابت — جلسة إضافية يومياً تحرك المؤشر":"Flat trend — one extra daily session moves the needle");
      sf(6,"normal");tc(doc,...TEXT2);doc.text(eta,ml+5,y+gh-5);
      y+=gh+8;
    }

    // ── This week's exercise plan ────────────────────────────────
    if(_plan?.days?.length){
      let done=0,total=0;_plan.days.forEach(d=>d.exercises.forEach(e=>{total++;if(e.done)done++;}));
      sf(7,"bold");tc(doc,...TEXT);doc.text(isAr?"خطة تمارين الأسبوع":"THIS WEEK'S EXERCISE PLAN",ml,y);
      const pcol=done===total?[34,197,94]:[99,102,241];
      sf(7,"bold");tc(doc,...pcol);doc.text(`${done}/${total}`,ml+cw,y,{align:"right"});
      sf(5.5,"normal");tc(doc,...TEXT3);
      doc.text((_plan.focus||[]).map(a=>_EX_AREA_LABELS[a]?.[isAr?"ar":"en"]||a).join("  •  "),ml,y+5.5);
      y+=10;
      _plan.days.forEach(d=>{
        if(y>H-24){doc.addPage();fc(doc,...BG);doc.rect(0,0,W,H,"F");y=14;}
        const rh=6+d.exercises.length*5.5;
        dCard(ml,y,cw,rh,3);
        const allDone=d.exercises.every(e=>e.done);
        sf(6,"bold");tc(doc,...(allDone?[34,197,94]:TEXT2));
        doc.text(isAr?`اليوم ${d.day}`:`Day ${d.day}`,ml+4,y+5.5);
        sf(5,"normal");tc(doc,...TEXT3);
        doc.text(_EX_AREA_LABELS[d.area]?.[isAr?"ar":"en"]||d.area,ml+4,y+rh-2.5);
        d.exercises.forEach((e,i)=>{
          const ey=y+4.5+i*5.5;
          // Vector check circles — ✓/○ glyphs don't exist in helvetica
          if(e.done){ fc(doc,34,197,94); doc.circle(ml+27,ey,1.6,"F"); }
          else { dc(doc,...TEXT3); lw(doc,0.3); doc.circle(ml+27,ey,1.6,"S"); }
          sf(6,"normal");tc(doc,...(e.done?TEXT3:TEXT2));
          doc.text(doc.splitTextToSize(isAr?e.ar:e.en,cw-38)[0],ml+32,ey+1);
        });
        y+=rh+3;
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  // ELITE EXCLUSIVE — ACHIEVEMENTS & CONSISTENCY
  // ══════════════════════════════════════════════════════════════
  {
    const all=Array.isArray(allSessions)?allSessions:[];
    const scores=all.map(s=>Math.round(s.avg_score||0)).filter(Boolean);
    const totalSess=all.length||1;
    const bestScore=scores.length?Math.max(...scores):avg;
    const allAvg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):avg;
    const days=[...new Set(all.map(s=>{try{return(s.created_at?.toDate?.()||new Date(s.created_at||0)).toISOString().slice(0,10);}catch{return null;}}).filter(Boolean))].sort();
    let strk=days.length?1:0;
    for(let i=days.length-2;i>=0;i--){ if((new Date(days[i+1])-new Date(days[i]))/86400000<=1.6) strk++; else break; }
    const spanDays=days.length>1?Math.max(1,(new Date(days[days.length-1])-new Date(days[0]))/86400000):1;
    const perWeek=(totalSess/Math.max(spanDays/7,0.5)).toFixed(1);

    let ey=_ePage(isAr?"الإنجازات":"ACHIEVEMENTS");
    ey=_eSection(ey,isAr?"إنجازاتك والاستمرارية":"Achievements & Consistency",
      isAr?"تقدّمك عبر كل الجلسات":"Your progress across every session",[139,92,246]);
    ey+=4;
    const tiles=[
      [String(totalSess), isAr?"إجمالي الجلسات":"Total sessions",[99,102,241]],
      [String(bestScore), isAr?"أفضل نتيجة":"Best score",[34,197,94]],
      [`${strk}`, isAr?"سلسلة الأيام":"Day streak",[245,158,11]],
      [`${allAvg}`, isAr?"المتوسط العام":"All-time avg",[6,182,212]],
      [`${perWeek}`, isAr?"جلسة/أسبوع":"Per week",[139,92,246]],
      [`${days.length}`, isAr?"أيام نشطة":"Active days",[236,72,153]],
    ];
    const tw=(cw-2*6)/3, th=26;
    tiles.forEach(([v,l,c],i)=>{
      const tx=ml+(i%3)*(tw+6), ty=ey+Math.floor(i/3)*(th+6);
      dCard(tx,ty,tw,th,4);
      fc(doc,...c); rr(doc,tx,ty,tw,2.6,1.3,"F"); doc.rect(tx,ty+1.3,tw,1.3,"F");
      sf(15,"bold"); tc(doc,...c); doc.text(String(v),tx+tw/2,ty+15,{align:"center"});
      sf(6,"bold"); tc(doc,...TEXT3); doc.text(String(l),tx+tw/2,ty+21.5,{align:"center"});
    });
    ey+=2*(th+6)+8;
    ey=_eSection(ey,isAr?"الأوسمة":"Milestone Badges","",[139,92,246]); ey+=4;
    const badges=[
      [totalSess>=1,  isAr?"البداية":"First Step",   isAr?"أول جلسة":"1st session"],
      [totalSess>=10, isAr?"منتظم":"Committed",       isAr?"10 جلسات":"10 sessions"],
      [totalSess>=25, isAr?"مثابر":"Dedicated",       isAr?"25 جلسة":"25 sessions"],
      [bestScore>=80, isAr?"تميّز":"Excellence",      isAr?"نتيجة 80+":"Scored 80+"],
      [strk>=3,       isAr?"سلسلة":"On a Roll",        isAr?"3 أيام متتالية":"3-day streak"],
      [strk>=7,       isAr?"أسبوع كامل":"Full Week",   isAr?"7 أيام متتالية":"7-day streak"],
    ];
    const bw4=(cw-2*6)/3, bh=24;
    badges.forEach(([earned,title,sub],i)=>{
      const bx4=ml+(i%3)*(bw4+6), by=ey+Math.floor(i/3)*(bh+6);
      const c=earned?[139,92,246]:[203,213,225];
      dCard(bx4,by,bw4,bh,4,earned?CARD:CARD2);
      fc(doc,...c); doc.setGState&&doc.setGState(new doc.GState({opacity:earned?1:.35})); doc.circle(bx4+12,by+bh/2,6.5,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      fc(doc,...(earned?[255,255,255]:CARD2)); doc.circle(bx4+12,by+bh/2,2.6,"F");
      sf(8,"bold"); tc(doc,...(earned?TEXT:TEXT3)); doc.text(String(title),bx4+22,by+bh/2-1);
      sf(5.5,"normal"); tc(doc,...TEXT3); doc.text(String(sub),bx4+22,by+bh/2+5);
      if(!earned){ sf(5,"bold"); tc(doc,...TEXT3); doc.text(isAr?"مقفل":"locked",bx4+bw4-4,by+5,{align:"right"}); }
    });
  }

  // Footer + page numbers on EVERY page (the confidential/disclaimer line
  // used to be drawn on the current page only, so the Elite exclusive pages
  // showed a bare page number with no footer text).
  const tot=doc.internal.getNumberOfPages();
  for(let p=1;p<=tot;p++){
    doc.setPage(p);
    fc(doc,...BORDER);doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
    doc.rect(ml,H-9,cw,.3,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(5.5,"normal");tc(doc,...TEXT3);
    doc.text(isAr?"Corvus Health Intelligence · سري · ليس تشخيصاً طبياً":"Corvus Health Intelligence · Confidential · Not a medical diagnosis",ml,H-4.5);
    doc.text(`${p} / ${tot}`,W-mr,H-4.5,{align:"right"});
  }

  const _fn = `Corvus_Elite_Session_${realIdx}_${new Date().toISOString().slice(0,10)}.pdf`;
  await doc.save(_fn, {returnPromise:true});
  return _fn;
}




export async function generateClinicalPDF({ session, profile, user, lang="en", sessionIndex, allSessions=[], aiSummary="" }) {
  if (!session) throw new Error(lang==="ar" ? "لا توجد بيانات جلسة لعرضها في هذا التقرير." : "No session data available to generate this report.");
  const { jsPDF } = await import("jspdf");
  const doc   = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  // Clinical report is rendered entirely in helvetica/English regardless of
  // `lang` (see date-formatting notes below) — Cairo is never used here, so
  // it's never loaded. This alone was ~90% of this report's file size.
  await _ensureLogo();
  const W=210, H=297, ml=18, mr=18, cw=W-ml-mr;

  const tier    = _t(profile?.tier || session?.tier || "standard");
  // Note: tier gate is enforced in App.jsx downloadPDF() before calling here.
  // We don't re-throw here to avoid silent failures from stale session.tier values.


  // New clinical page WITH the navy header bar — the conditional page
  // breaks used to call doc.addPage() bare, leaving continued pages
  // (metrics table, recommendations) with no header at all.
  const _clinPage = () => {
    doc.addPage();
    doc.setFillColor(15,23,42); doc.rect(0,0,W,12,"F");
    doc.setFontSize(8); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal");
    doc.text("Corvus Posture Health — Clinical Summary", ml, 8.5);
    const _badgeColPg = tier==="elite" ? [180,141,60] : [14,165,233];
    doc.setFontSize(7.5); doc.setTextColor(..._badgeColPg); doc.setFont("helvetica","bold");
    doc.text(tier==="elite"?"ELITE PHYSIOTHERAPIST REPORT":"PHYSIOTHERAPIST REPORT", W-mr, 8.5, {align:"right"});
    return 22;
  };

  // Consistent, designed section header — accent bar + title (+ optional
  // subtitle). Replaces the plain bold-text headings for a nicer, more
  // deliberate typographic rhythm throughout the clinical report.
  const _clinSec = (yy, title, sub, col=[14,165,233]) => {
    doc.setFillColor(...col); doc.roundedRect(ml, yy-4.6, 2.6, sub?11:7.5, 1.2, 1.2, "F");
    doc.setFontSize(12.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(String(title), ml+7, yy);
    if(sub){ doc.setFontSize(7.5); doc.setTextColor(120,134,156); doc.setFont("helvetica","normal"); doc.text(String(sub), ml+7, yy+5); return yy+14; }
    return yy+9;
  };
  // Small uppercase tracked label (section eyebrow / table captions)
  const _clinLabel = (xx, yy, txt, col=[120,134,156]) => {
    doc.setFontSize(6.5); doc.setTextColor(...col); doc.setFont("helvetica","bold");
    doc.text(String(txt).toUpperCase(), xx, yy, { charSpace: 0.4 });
  };

  const avg     = Math.round(session.avg_score || 0);
  const dur     = session.duration_s || session.duration_sec || 0;
  const goodPct = session.good_pct || 0;
  const metrics = session.metrics || {};
  const hist    = session.score_history || [];
  const _rawName2 = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Patient";
  const name    = _rawName2.replace(/[\r\n]+/g,' ').replace(/\s{2,}/g,' ').trim();
  const email   = user?.email || "";
  const dob     = profile?.dob || "—";
  const gradeC  = _gc(avg);
  const zonal   = _zonalRisk(metrics);
  const now     = new Date();
  // Clinical report is a helvetica/English document end-to-end — keep the
  // date English so it never renders as garbled Arabic glyphs.
  const dateStr = now.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});

  const realIndex = (() => {
    if (sessionIndex) return sessionIndex;
    if (allSessions.length) {
      const idx = allSessions.findIndex(s=>(s.id||s.session_id)===(session.id||session.session_id));
      if (idx>=0) return allSessions.length - idx;
    }
    return 1;
  })();

  const metricEntries = Object.entries(metrics)
    .filter(([k])=>!k.startsWith("_") && !META_METRIC_KEYS.has(k) && metrics[k])
    .map(([k,v])=>{
      const sc  = typeof v==="number" ? v : (v?.score ?? 100);
      // English labels — clinical report is rendered in helvetica which can't
      // shape Arabic (METRIC_LABELS now includes the engine's real keys, so
      // fhp_index → "Forward Head Posture" instead of "Fhp Index").
      const lbl = METRIC_LABELS[k] || v?.label || k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      // "depth" is an internal 0–30 index, not a physical unit — it reads
      // unprofessionally as "7depth" in a clinical table, so show it as a
      // bare index value.
      const unit = v?.unit==="depth" ? "" : (v?.unit||"");
      return { key:k, sc, lbl, value:v?.value, unit };
    })
    .sort((a,b)=>a.sc-b.sc);

  let y=0;

  // ── PAGE 1: Clinical Header + Patient Info ────────────────────
  // Clinical header — formal white + navy
  const _isElite = tier==="elite";
  const _badgeCol = _isElite ? [180,141,60] : [14,165,233]; // gold for Elite, cyan otherwise
  doc.setFillColor(15,23,42); doc.rect(0,0,W,36,"F");
  // Premium accent underline — thin brand rule beneath the navy band
  doc.setFillColor(..._badgeCol); doc.rect(0,36,W,1,"F");
  doc.setFontSize(14); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text("CORVUS POSTURE HEALTH", ml, 16);
  doc.setFontSize(8.5); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal");
  doc.text("AI-Assisted Workplace Ergonomics & Posture Assessment", ml, 23);
  doc.text("For Clinical Review — Not for Diagnostic Purposes", ml, 29.5);

  // Document type badge — gold accent for Elite tier, cyan otherwise
  doc.setFillColor(..._badgeCol); doc.roundedRect(W-mr-42,10,42,14,2,2,"F");
  doc.setFontSize(8); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text(_isElite?"ELITE CLINICAL":"CLINICAL SUMMARY", W-mr-21, 18.5, {align:"center"});
  doc.setFontSize(6.5); doc.setTextColor(255,255,255); doc.setFont("helvetica","normal");
  doc.text("PHYSIOTHERAPIST REPORT", W-mr-21, 23.5, {align:"center"});

  y=47;

  // Patient Info block
  doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,32,3,3,"F");
  doc.setDrawColor(226,232,240); doc.setLineWidth(0.4); doc.roundedRect(ml,y,cw,32,3,3,"S"); doc.setLineWidth(0.3);

  doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","bold");
  doc.text("PATIENT INFORMATION", ml+4, y+7);
  doc.setFontSize(8.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","normal");
  // Interleaved left/right so Math.floor(i/2) maps each pair to one row —
  // the old order was [left,left,right,right,...] which drew Email over
  // Patient Name and the date over the session reference.
  // NOTE: this clinical report is rendered entirely in helvetica (English),
  // which cannot shape Arabic — so these labels stay English in every
  // language (Arabic here rendered as garbage like "þåþªþûþ•").
  [
    [`Patient Name:`,       name,                           ml+4],
    [`Date of Assessment:`, dateStr,                        ml+cw/2+4],
    [`Email:`,              email,                          ml+4],
    [`Session Ref:`,        `#${realIndex}`,                ml+cw/2+4],
    [`Session Duration:`,   _fmtDur(dur),                   ml+4],
    [`Recording Mode:`,     session.mode||"Laptop Camera",  ml+cw/2+4],
  ].forEach(([lbl,val,x],i) => {
    const row = Math.floor(i/2);
    const yy = y+13+(row*8);
    doc.setFont("helvetica","bold"); doc.setTextColor(100,116,139); doc.setFontSize(7.5);
    doc.text(String(lbl), x, yy);
    doc.setFont("helvetica","normal"); doc.setTextColor(15,23,42); doc.setFontSize(8.5);
    // Value sits after the label's real width (not a fixed 32mm) so long
    // labels never collide with their value — and is capped to the
    // column's own width so a long value (patient name, email) can't run
    // into the adjacent column's label (verified overlap via pdftotext
    // -bbox: a long name's "Ibrahim Hassan Al-Masri" was literally drawn
    // through "Date of Assessment:" before this cap was added).
    const lblW = doc.getTextWidth(String(lbl))+3;
    const valX = x+Math.max(30,lblW);
    const colEndX = ml+cw - (x < ml+cw/2 ? cw/2 : 0) - 4; // right edge of this value's own column
    doc.text(_fit(doc,String(val||"—"),colEndX-valX), valX, yy);
  });
  y+=40;

  // ── Overall score clinical interpretation ─────────────────────
  y=_clinSec(y+2,"Overall Posture Score","Session-level posture quality and clinical interpretation");

  doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,36,3,3,"F");
  doc.setDrawColor(...gradeC); doc.setLineWidth(0.5); doc.roundedRect(ml,y,cw,36,3,3,"S"); doc.setLineWidth(0.3);

  const cx2=ml+22, cy2=y+18;
  // Proportional gauge (was a flat filled disc)
  doc.setFillColor(...gradeC); doc.setGState&&doc.setGState(new doc.GState({opacity:.08}));
  doc.circle(cx2,cy2,12,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  _arcGauge(doc,cx2,cy2,12,avg/100,gradeC,[226,232,240],3.2);
  doc.setFontSize(14); doc.setTextColor(...gradeC); doc.setFont("helvetica","bold");
  doc.text(String(avg), cx2, cy2+3, {align:"center"});
  doc.setFontSize(6); doc.setTextColor(148,163,184); doc.text("/100", cx2, cy2+8, {align:"center"});

  const interpretation = avg>=80
    ? "Posture quality is consistently good. Preventive ergonomic advice appropriate."
    : avg>=60
    ? "Moderate posture deviations observed. Targeted ergonomic intervention recommended."
    : "Significant postural deficits detected across multiple planes. Clinical assessment advised.";
  doc.setFontSize(9); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text(_gl(avg,false), ml+38, y+12);
  doc.setFontSize(8); doc.setTextColor(51,65,85); doc.setFont("helvetica","normal");
  const interpLines = doc.splitTextToSize(interpretation, cw-44);
  interpLines.forEach((l,i)=>doc.text(l, ml+38, y+20+(i*6)));
  doc.setFontSize(7.5); doc.setTextColor(100,116,139);
  doc.text(`Good posture maintained: ${goodPct}% of session  |  Alerts triggered: ${session.alerts_count||0}`, ml+38, y+33);
  y+=44;

  // ── Score timeline ────────────────────────────────────────────
  if (hist.length>2) {
    y=_clinSec(y,"Posture Score Timeline","Continuous posture quality from session start to end");
    const sh=28;
    doc.setFillColor(241,245,249); doc.roundedRect(ml,y,cw,sh,2,2,"F");
    [50,65,80,95].forEach(v=>{
      const gy=y+sh-2-((v-40)/60)*(sh-4);
      doc.setDrawColor(200,210,220); doc.setLineWidth(0.15); doc.line(ml+2,gy,ml+cw-2,gy);
      doc.setFontSize(4.5); doc.setTextColor(160,174,192); doc.text(String(v),ml,gy+1.5,{align:"right"});
    });
    _drawSparkline(doc,hist,ml+3,y+2,cw-6,sh-4,gradeC);
    y+=sh+10;
  }

  // ── KEY CLINICAL FINDINGS (fills the lower half of page 1) ─────
  y=_clinSec(y,"Key Clinical Findings","The measurements furthest from the clinical norm this session");
  y+=2;
  const _findInterp={
    neck_lean:"Forward neck flexion increases cervical disc load and is a common driver of tension headache.",
    fhp_index:"Forward head posture — every 2.5cm of anterior translation adds ~4.5kg of effective load to the cervical spine.",
    head_tilt:"Lateral head tilt suggests asymmetric muscle tone or an uneven working surface.",
    head_yaw:"Sustained head rotation loads one side of the cervical spine; reposition the monitor to face the user.",
    rounded_shoulders:"Protracted shoulders shorten pectorals and lengthen mid-trapezius, predisposing to thoracic kyphosis.",
    shoulder_level:"Shoulder height asymmetry points to armrest or seat imbalance.",
    spine_lean:"Trunk deviation from vertical increases paraspinal muscle demand and lumbar shear.",
    spine_align:"Deviation of the shoulder from the ear–hip line indicates loss of neutral spinal curvature.",
    elbow_angle:"Elbow angle outside 90–110° raises shoulder and forearm loading.",
    monitor_height:"Monitor off eye level drives compensatory neck flexion or extension.",
    screen_distance:"Viewing distance outside 50–70cm affects both posture and visual strain.",
  };
  const _worst=metricEntries.slice(0,3);
  _worst.forEach(({lbl,value,unit,sc,key},i)=>{
    const col=_gc(sc), rowH=17, ry=y+i*(rowH+3);
    doc.setFillColor(248,250,252); doc.roundedRect(ml,ry,cw,rowH,3,3,"F");
    doc.setFillColor(...col); doc.roundedRect(ml,ry,2.4,rowH,1.2,1.2,"F");
    // rank number
    doc.setFillColor(...col); doc.setGState&&doc.setGState(new doc.GState({opacity:.14})); doc.circle(ml+12,ry+rowH/2,5.5,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    doc.setFontSize(9); doc.setTextColor(...col); doc.setFont("helvetica","bold"); doc.text(String(i+1),ml+12,ry+rowH/2+3,{align:"center"});
    // metric + value
    doc.setFontSize(9); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold"); doc.text(String(lbl),ml+22,ry+7);
    if(value!==undefined&&value!==null){ doc.setFontSize(7); doc.setTextColor(120,134,156); doc.setFont("helvetica","normal"); doc.text(`${Math.round(value*10)/10}${unit||""}`,ml+22,ry+13); }
    // interpretation (kept clear of the right-hand score badge)
    doc.setFontSize(7); doc.setTextColor(71,85,105); doc.setFont("helvetica","normal");
    const _txt=_findInterp[key]||"Deviation from the recommended range — see detailed metrics.";
    doc.splitTextToSize(_txt,cw*0.48).slice(0,2).forEach((l,j)=>doc.text(l,ml+cw*0.36,ry+6.5+j*4.5));
    // score badge
    doc.setFontSize(11); doc.setTextColor(...col); doc.setFont("helvetica","bold"); doc.text(String(Math.round(sc)),ml+cw-5,ry+8,{align:"right"});
    doc.setFontSize(5.5); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal"); doc.text("/100",ml+cw-5,ry+13,{align:"right"});
  });
  y+=_worst.length*20+6;

  // ── PAGE 2: Zonal Pain Map ────────────────────────────────────
  doc.addPage();
  doc.setFillColor(15,23,42); doc.rect(0,0,W,12,"F");
  doc.setFontSize(8); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal");
  doc.text("Corvus Posture Health — Clinical Summary", ml, 8.5);
  doc.setFontSize(7.5); doc.setTextColor(14,165,233); doc.setFont("helvetica","bold");
  doc.text("PHYSIOTHERAPIST REPORT", W-mr, 8.5, {align:"right"});
  y=22;

  y=_clinSec(y,"Spinal Zone Risk Assessment","Risk % derived computationally from posture metrics — not a medical diagnosis",[239,68,68]);

  const clinicalZones = [
    {
      key:"cervical", region:"C1–C7", title:"Cervical Spine (Neck)",
      desc:"Assesses head position, neck lean, forward head posture, and rotational deviation. Elevated risk correlates with increased load on cervical discs and potential for tension-type headache, cervicogenic dizziness, or upper trapezius hypertonicity.",
      metrics:"Neck Lean, Forward Head Posture, Head Tilt, Head Rotation",
    },
    {
      key:"thoracic", region:"T1–T12", title:"Thoracic Spine (Upper Back)",
      desc:"Evaluates shoulder symmetry, rounded shoulder posture, and upper spinal curvature. Chronic elevation indicates risk for thoracic kyphosis progression, intercostal restriction, or rotator cuff impingement patterns.",
      metrics:"Shoulder Level, Rounded Shoulders, Shoulder Elevation",
    },
    {
      key:"lumbar", region:"L1–S1", title:"Lumbar Spine (Lower Back)",
      desc:"Measures trunk lean, forward flexion and axial rotation relative to the hips. Risk elevation may indicate posterior chain tightness, lumbar flexion intolerance, or disc load asymmetry. All three require the hips to be inside the camera frame, which a laptop webcam at typical desk distance cannot achieve — see the coverage note on the session page.",
      metrics:"Spine Lean, Forward Slouch, Trunk Rotation",
    },
  ];

  clinicalZones.forEach(({key,region,title,desc,metrics:mlist})=>{
    if(y>H-72){y=_clinPage();}
    const risk=_zNum(zonal,key);           // nullable — see _riskLabel
    const rcol=_riskColor(risk);
    const rlbl=_riskLabel(risk,false);

    const cardH=58;
    doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,cardH,3,3,"F");
    doc.setDrawColor(...rcol); doc.setLineWidth(0.5); doc.roundedRect(ml,y,cw,cardH,3,3,"S"); doc.setLineWidth(0.3);

    // Zone identifier
    doc.setFillColor(...rcol); doc.roundedRect(ml+2,y+2,22,22,2,2,"F");
    doc.setFontSize(risk==null?7:13); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    doc.text(_riskPct(risk), ml+13, y+13.5, {align:"center"});
    doc.setFontSize(6); doc.text("RISK", ml+13, y+20, {align:"center"});

    doc.setFontSize(9.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(title, ml+28, y+8);
    doc.setFontSize(7.5); doc.setTextColor(14,165,233); doc.setFont("helvetica","bold");
    doc.text(region, ml+28, y+14);
    doc.setFontSize(7); doc.setTextColor(...rcol); doc.setFont("helvetica","bold");
    doc.text(risk==null?"Not measured this session":`Risk Level: ${rlbl}`, ml+28, y+20);

    // Risk bar
    const bx=ml+cw*0.52, bw2=cw*0.46;
    doc.setFillColor(226,232,240); doc.roundedRect(bx,y+15,bw2,4,1,1,"F");
    if(risk!=null) { doc.setFillColor(...rcol); doc.roundedRect(bx,y+15,Math.max(bw2*(risk/100),3),4,1,1,"F"); }

    // Description
    doc.setFontSize(7.5); doc.setTextColor(51,65,85); doc.setFont("helvetica","normal");
    const descLines = doc.splitTextToSize(desc, cw-8);
    descLines.slice(0,3).forEach((l,i)=>doc.text(l, ml+4, y+30+(i*5.5)));

    // Metrics source — kept inside the card (was drawn at y+53.5, past the
    // old 52mm bottom edge, so it clipped through the border)
    doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","bold");
    doc.text("Contributing metrics:", ml+4, y+cardH-4);
    const cmW=doc.getTextWidth("Contributing metrics:")+3;
    doc.setFont("helvetica","normal"); doc.text(String(mlist), ml+4+cmW, y+cardH-4);

    y+=cardH+6;
  });

  // ── PAGE 3: Body Outline + Metrics Detail + Recommendations ─────
  doc.addPage();
  doc.setFillColor(15,23,42); doc.rect(0,0,W,12,"F");
  doc.setFontSize(8); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal");
  doc.text("Corvus Posture Health — Clinical Summary", ml, 8.5);
  doc.setFontSize(7.5); doc.setTextColor(14,165,233); doc.setFont("helvetica","bold");
  doc.text("PHYSIOTHERAPIST REPORT", W-mr, 8.5, {align:"right"});
  y=22;

  // ── Body Outline Diagram — zonal risk visualization ───────────
  y=_clinSec(y,"Spinal Zone Risk — Visual Overview","Risk zones mapped onto the spine from posture measurements",[239,68,68]);

  // Draw simplified body silhouette
  const bx = ml+cw*0.55, bodyW=24, headR=7;
  const bodyTop = y+4;
  // Head circle
  doc.setDrawColor(200,210,220); doc.setLineWidth(0.5);
  doc.setFillColor(241,245,249); doc.circle(bx+bodyW/2, bodyTop+headR, headR,"FD");
  // Cervical zone
  const cervCol=_zColor(zonal,"cervical");
  doc.setFillColor(...cervCol); doc.setGState&&doc.setGState(new doc.GState({opacity:0.35}));
  doc.roundedRect(bx+4, bodyTop+headR*2, bodyW-8, 12, 2, 2, "F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Thoracic zone
  const thorCol=_zColor(zonal,"thoracic");
  doc.setFillColor(...thorCol); doc.setGState&&doc.setGState(new doc.GState({opacity:0.35}));
  doc.roundedRect(bx+2, bodyTop+headR*2+12, bodyW-4, 22, 2, 2, "F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Lumbar zone
  const lumbCol=_zColor(zonal,"lumbar");
  doc.setFillColor(...lumbCol); doc.setGState&&doc.setGState(new doc.GState({opacity:0.35}));
  doc.roundedRect(bx+3, bodyTop+headR*2+34, bodyW-6, 14, 2, 2, "F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Body outline stroke
  doc.setFillColor(0,0,0,0);
  doc.setDrawColor(200,210,220); doc.setLineWidth(0.3);
  doc.roundedRect(bx+2, bodyTop+headR*2, bodyW-4, 48, 3, 3, "S");

  // Legend
  const lx = ml; let ly = y+2;
  [
    ["Cervical  C1–C7", _zLabel(zonal,"cervical",false), cervCol, _zBar(zonal,"cervical"), _zHas(zonal,"cervical")],
    ["Thoracic  T1–T12", _zLabel(zonal,"thoracic",false), thorCol, _zBar(zonal,"thoracic"), _zHas(zonal,"thoracic")],
    ["Lumbar  L1–S1", _zLabel(zonal,"lumbar",false), lumbCol, _zBar(zonal,"lumbar"), _zHas(zonal,"lumbar")],
  ].forEach(([zone,rl,col,pct])=>{
    doc.setFillColor(...col); doc.roundedRect(lx,ly,8,8,1,1,"F");
    doc.setFontSize(8.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(zone, lx+11, ly+5.5);
    doc.setFontSize(8); doc.setTextColor(...col);
    doc.text(`${pct}% — ${rl}`, lx+11, ly+12);
    // Mini horizontal bar
    doc.setFillColor(226,232,240); doc.roundedRect(lx+11, ly+14, 60, 3.5, 1,1,"F");
    doc.setFillColor(...col); doc.roundedRect(lx+11, ly+14, Math.max(60*(pct/100),2), 3.5, 1,1,"F");
    ly+=24;
  });
  y = Math.max(y+62, bodyTop+headR*2+56); y+=8;

  // ── Exercise Prescription ──────────────────────────────────────
  if(y>H-80){y=_clinPage();}
  y=_clinSec(y,"Exercise Prescription","Evidence-based exercises targeting the highest-risk zones",[34,197,94]);

  const EXERCISES = {
    cervical:[
      {name:"Chin Tuck",sets:"3×10",desc:"Retract head parallel to floor, hold 5s. Activates deep neck flexors."},
      {name:"Cervical Rotation",sets:"2×10/side",desc:"Slow rotation L/R to end range. Reduces upper trapezius hypertonicity."},
      {name:"Doorway Chest Stretch",sets:"3×30s",desc:"Open chest, reduce FHP. Targets pec minor and anterior scalenes."},
    ],
    thoracic:[
      {name:"Thoracic Extension (foam roller)",sets:"2×60s",desc:"Over foam roller at T6–T9. Restores thoracic extension lost to sustained flexion."},
      {name:"W-Y-T Raises (prone)",sets:"3×12",desc:"Prone scapular retraction + depression. Activates lower/mid trapezius."},
      {name:"Wall Angels",sets:"2×10",desc:"Scapular mobilisation against wall. Targets serratus anterior + posterior deltoid."},
    ],
    lumbar:[
      {name:"Posterior Pelvic Tilt",sets:"3×10",desc:"Supine lumbar flattening. Resets neutral spine and inhibits hip flexors."},
      {name:"Bird-Dog",sets:"3×10/side",desc:"Quadruped opposite arm/leg extension. Core stability + lumbar unloading."},
      {name:"Hip Flexor Stretch",sets:"3×30s/side",desc:"Kneeling lunge stretch. Addresses anterior pelvic tilt from prolonged sitting."},
    ],
  };

  // Prioritise exercises by zone risk
  const zonePriority = ["cervical","thoracic","lumbar"]
    .filter(k=>_zHas(zonal,k)).sort((a,b)=>(_zNum(zonal,b))-(_zNum(zonal,a)));

  for(const zk of zonePriority.slice(0,3)){
    if(y>H-55){y=_clinPage();}
    const col = _zColor(zonal,zk);
    doc.setFillColor(...col); doc.roundedRect(ml,y,cw,9,2,2,"F");
    doc.setFontSize(9); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    doc.text(`${zk.charAt(0).toUpperCase()+zk.slice(1)} Zone Exercises (Risk: ${_zLabel(zonal,zk,false)} ${_zPct(zonal,zk,false)})`,ml+4,y+6.5); y+=13;
    for(const ex of EXERCISES[zk].slice(0,2)){
      if(y>H-24){y=_clinPage();}
      doc.setFontSize(7.5); doc.setFont("helvetica","normal");
      const descLines = doc.splitTextToSize(ex.desc, cw-8).slice(0,2);
      const cardH = descLines.length>1 ? 21 : 16;
      doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,cardH,2,2,"F");
      doc.setFontSize(8.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
      doc.text(`${ex.name} — ${ex.sets}`, ml+4, y+7);
      doc.setFontSize(7.5); doc.setTextColor(71,85,105); doc.setFont("helvetica","normal");
      descLines.forEach((l,i)=>doc.text(l, ml+4, y+13+(i*4.5)));
      y+=cardH+3;
    }
    y+=4;
  }

  // All metrics in clinical table style
  y=_clinSec(y,"Posture Metrics Detail","Every measured metric with its score and clinical status",[99,102,241]);
  y+=1;

  // Table header — repeated whenever the table flows onto a new page
  const _clinTblHead=()=>{
    doc.setFillColor(15,23,42); doc.roundedRect(ml,y,cw,9,2,2,"F");
    doc.setFontSize(7); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    ["Measurement","Value","Score","Status"].forEach((h,i)=>{
      const xs=[ml+3, ml+cw*0.38, ml+cw*0.58, ml+cw*0.74];
      doc.text(h, xs[i], y+6);
    });
    y+=11;
  };
  _clinTblHead();

  metricEntries.forEach(({lbl,value,unit,sc},i)=>{
    if(y>H-16){ y=_clinPage(); _clinTblHead(); }
    doc.setFillColor(i%2===0?248:255, i%2===0?250:255, i%2===0?252:255);
    doc.rect(ml,y,cw,9,"F");
    const col=_gc(sc);
    doc.setFontSize(8); doc.setTextColor(15,23,42); doc.setFont("helvetica","normal");
    doc.text(lbl, ml+3, y+6);
    doc.setTextColor(...col); doc.setFont("helvetica","bold");
    if(value!==undefined&&value!==null) doc.text(`${Math.round(value*10)/10}${unit||""}`, ml+cw*0.38, y+6);
    doc.text(String(Math.round(sc)), ml+cw*0.58, y+6);
    doc.setFontSize(7.5); doc.text(_gl(sc,false), ml+cw*0.74, y+6);
    y+=9;
  });

  y+=10;

  // ── Industry Benchmark Comparison ─────────────────────────────
  // Reference cohort figures — aggregated/estimated ranges, not a
  // live population statistic. Relabel once real anonymized cohort
  // volume backs these numbers.
  if(y>H-90){y=_clinPage();}
  y=_clinSec(y,"Industry Benchmark Comparison","This session's scores against reference cohort averages",[168,85,247]);
  y+=1;

  const CLINICAL_BENCHMARKS = [
    { label:"This Session",              value:avg,               isUser:true },
    { label:"Office Workers (avg.)",     value:61,                isUser:false },
    { label:"Remote/Hybrid Workers (avg.)", value:57,             isUser:false },
    { label:"Top 10% Corvus Users",      value:88,                isUser:false },
  ];
  const bLabelW = cw*0.42, bBarX = ml+bLabelW, bBarW = cw-bLabelW-16;
  CLINICAL_BENCHMARKS.forEach(({label,value,isUser})=>{
    const rc = isUser ? gradeC : [100,116,139];
    doc.setFontSize(8); doc.setFont("helvetica", isUser?"bold":"normal"); doc.setTextColor(...(isUser?gradeC:[15,23,42]));
    doc.text(label, ml, y+5.5);
    doc.setFillColor(226,232,240); doc.roundedRect(bBarX,y+1.5,bBarW,4.6,1.2,1.2,"F");
    const fillW = Math.max(2, bBarW*(Math.max(0,Math.min(100,value))/100));
    doc.setFillColor(...rc); doc.roundedRect(bBarX,y+1.5,fillW,4.6,1.2,1.2,"F");
    doc.setFontSize(7.5); doc.setFont("helvetica","bold"); doc.setTextColor(15,23,42);
    doc.text(String(Math.round(value)), bBarX+bBarW+3, y+5.2);
    y+=9.5;
  });
  doc.setFontSize(6.5); doc.setTextColor(148,163,184); doc.setFont("helvetica","italic");
  doc.text("Benchmark figures are reference cohort estimates and may vary with sample size and role.", ml, y+3);
  y+=12;

  // Clinical recommendations — keep all four notes together on one page
  // (they used to split 2/2 across a page break, leaving the next page
  // almost empty). ~135mm covers the section header + four 26mm cards.
  if(y>H-135){y=_clinPage();}
  y=_clinSec(y,"Clinical Notes & Recommendations","Suggested focus areas — please apply clinical judgment",[99,102,241]);

  // The narrative compared and interpolated zone numbers directly. With a zone
  // that has no reading those comparisons are all false and the template
  // prints the word "null" into a clinical report — and before that, when
  // every unmeasured zone silently became 0, the text confidently named the
  // lumbar spine as the healthiest region of every user it had never seen.
  // Only zones with an actual reading are described.
  const _zc = _zNum(zonal,"cervical"), _zt2 = _zNum(zonal,"thoracic"), _zl = _zNum(zonal,"lumbar");
  const _measured = [["Cervical",_zc],["Thoracic",_zt2],["Lumbar",_zl]].filter(([,v])=>v!==null);
  const _unmeasured = [["Cervical",_zc],["Thoracic",_zt2],["Lumbar",_zl]].filter(([,v])=>v===null).map(([n])=>n);
  const _worstZone = _measured.slice().sort((a,b)=>b[1]-a[1])[0] || null;
  const _covNote = _unmeasured.length
    ? ` This session could not measure the ${_unmeasured.join(" and ").toLowerCase()} zone${_unmeasured.length>1?"s":""} — the landmarks they derive from were outside the camera frame, so no statement is made about them.`
    : "";

  const clinicalRecos = [
  (avg < 60
    ? `Overall posture score of ${avg}/100 indicates significant postural deviation across the planes that were measured.${_worstZone?` ${_worstZone[0]} zone is the largest measured contributor at ${_worstZone[1]}%.`:""} Full clinical assessment with manual palpation recommended.`
    : avg < 80
    ? `Moderate postural deviations identified (score: ${avg}/100).${_measured.filter(([,v])=>v>45).map(([n,v])=>` ${n} risk at ${v}% requires targeted intervention.`).join("")} Targeted corrective exercise programming is likely to yield measurable improvement within 4-6 weeks.`
    : `Posture quality is broadly good during monitored sessions (${avg}/100, ${goodPct}% good posture). Reinforce current ergonomic patterns.${_worstZone?` ${_worstZone[0]} zone carries the highest measured risk at ${_worstZone[1]}%.`:""}`) + _covNote,
  _zc === null
    ? `Cervical zone was not measured in this session; no neck or head-position finding is available.`
    : _zc >= 45
    ? `Cervical zone risk: ${_zc}%. Neck lean and head position metrics require attention. Chin tuck exercises (3x10 reps daily) and monitor height adjustment to eye level are indicated. Consider cervicogenic headache screening if symptoms present.`
    : `Cervical zone within acceptable range (${_zc}%). Current head and neck positioning is adequate. Maintain 50-70cm screen distance and monitor at eye level.`,
  ];

  clinicalRecos.forEach((rec,i)=>{
    if(y>H-35){y=_clinPage();}
    doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,22,2,2,"F");
    doc.setFontSize(8); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    const zones2 = ["General Assessment","Cervical Focus","Thoracic Focus","Lumbar Focus"];
    doc.text(`${i+1}. ${zones2[i]}`, ml+4, y+7);
    doc.setFont("helvetica","normal"); doc.setTextColor(51,65,85);
    const recLines = doc.splitTextToSize(rec, cw-10);
    recLines.slice(0,2).forEach((l,li)=>doc.text(l, ml+4, y+13+(li*5.5)));
    y+=26;
  });

  // ── RECOMMENDED ERGONOMIC ADJUSTMENTS ──
  // Flow right after the notes so the page fills naturally; only break to a
  // new page when there isn't room for the whole block (~100mm).
  if(y>H-110){y=_clinPage();} else {y+=4;}
  y=_clinSec(y,"Recommended Ergonomic Adjustments","Actionable workstation changes, prioritised for this user");
  y+=2;
  const _adj=[
    ["Raise monitor to eye level","Top of the screen at or just below eye height — use a stand or riser.",(metrics.monitor_height?.score??100)<65],
    ["Set viewing distance to 50–70cm","About an arm's length; enlarge on-screen text rather than leaning in.",(metrics.screen_distance?.score??100)<65],
    ["Support elbows at 90–110°","Adjust chair and armrests so forearms rest level with the desk.",(metrics.elbow_angle?.score??100)<65],
    ["Engage lumbar support","Sit fully back; use the chair's lumbar support or a cushion.",(_zNum(zonal,"lumbar")??0)>=40],
    ["Micro-break every 30 minutes","Stand, reset posture, and look 6m away for 20 seconds.",true],
  ];
  _adj.forEach(([t,d,flag],i)=>{
    const ay=y+i*15, c=flag?[14,165,233]:[34,197,94];
    doc.setFillColor(248,250,252); doc.roundedRect(ml,ay,cw,13,2.5,2.5,"F");
    doc.setFillColor(...c); doc.roundedRect(ml,ay,2.2,13,1.1,1.1,"F");
    doc.setDrawColor(...c); doc.setLineWidth(0.5); doc.roundedRect(ml+6,ay+3.5,6,6,1.2,1.2,"S"); doc.setLineWidth(0.3);
    _icon(doc,"check",ml+9,ay+6.6,c,2.3);
    doc.setFontSize(8.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold"); doc.text(t,ml+17,ay+6);
    doc.setFontSize(7); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal"); doc.text(doc.splitTextToSize(d,cw-70)[0],ml+17,ay+11);
    if(flag){ doc.setFontSize(5.5); doc.setTextColor(14,165,233); doc.setFont("helvetica","bold"); doc.text("PRIORITY",ml+cw-5,ay+7.5,{align:"right"}); }
  });
  y+=_adj.length*15+8;

  // ── FOLLOW-UP & MONITORING PLAN (timeline) ────────────────────
  // Keep the follow-up timeline together with the disclaimer + signature
  // block that follows it (~135mm) so they land on the same page.
  if(y>H-140){y=_clinPage();}
  y=_clinSec(y,"Follow-up & Monitoring Plan","Recommended re-assessment schedule");
  y+=3;
  const _fu=[
    ["2 weeks","Re-scan after applying the adjustments above; expect early symptom relief.",[14,165,233]],
    ["6 weeks","Progress review — corrective exercises should yield measurable metric gains.",[245,158,11]],
    ["12 weeks","Full re-assessment; consolidate gains and update the exercise programme.",[34,197,94]],
  ];
  _fu.forEach(([w,d,c],i)=>{
    const fy=y+i*16;
    if(i<_fu.length-1){ doc.setDrawColor(203,213,225); doc.setLineWidth(0.6); doc.line(ml+6,fy+7,ml+6,fy+16); doc.setLineWidth(0.3); }
    doc.setFillColor(...c); doc.circle(ml+6,fy+5,3.2,"F");
    doc.setFillColor(255,255,255); doc.circle(ml+6,fy+5,1.2,"F");
    doc.setFontSize(9); doc.setTextColor(...c); doc.setFont("helvetica","bold"); doc.text(w,ml+15,fy+4);
    doc.setFontSize(7.5); doc.setTextColor(71,85,105); doc.setFont("helvetica","normal"); doc.text(doc.splitTextToSize(d,cw-22)[0],ml+15,fy+10);
  });
  y+=_fu.length*16+8;

  // ── Disclaimer + Signature block ─────────────────────────────
  y+=2;
  if(y>H-50){y=_clinPage();}
  doc.setFillColor(254,243,199); doc.roundedRect(ml,y,cw,20,2,2,"F");
  doc.setFontSize(7.5); doc.setTextColor(146,64,14); doc.setFont("helvetica","bold");
  doc.text("IMPORTANT DISCLAIMER", ml+4, y+7);
  doc.setFont("helvetica","normal"); doc.setTextColor(120,53,15);
  const disc="This report is generated by an AI-based postural monitoring system and is intended to supplement, not replace, professional clinical assessment. Findings should be interpreted alongside a full physical examination by a qualified physiotherapist or medical professional.";
  const discLines=doc.splitTextToSize(disc,cw-8);
  discLines.forEach((l,i)=>doc.text(l,ml+4,y+13+(i*4.5)));
  y+=26;

  // Signature block
  y+=8;
  doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,28,3,3,"F");
  doc.setFontSize(8); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Reviewing Clinician:", ml+4, y+8);
  doc.text("Signature:", ml+cw/2+4, y+8);
  doc.setDrawColor(100,116,139); doc.setLineWidth(0.3);
  doc.line(ml+4, y+18, ml+cw/2-4, y+18);
  doc.line(ml+cw/2+4, y+18, ml+cw-4, y+18);
  doc.setFontSize(7); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text("Name / Clinic", ml+4, y+23);
  doc.text("Date reviewed", ml+cw/2+4, y+23);

  // Page numbers
  const totalPages2=doc.internal.getNumberOfPages();
  for(let p=1;p<=totalPages2;p++){
    doc.setPage(p);
    doc.setFillColor(15,23,42); doc.rect(0,H-8,W,8,"F");
    doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    // English date — this footer is helvetica and can't shape the Arabic dateStr
    const _footDate = now.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"});
    doc.text(`Corvus Posture Health — Clinical Report — ${_footDate} — Confidential — Not a medical diagnosis`, ml, H-2.5);
    doc.text(`${p} / ${totalPages2}`, W-mr, H-2.5, {align:"right"});
  }

  const filename=`Corvus_Clinical_Report_Session${realIndex}_${now.toISOString().slice(0,10)}.pdf`;
  await doc.save(filename, {returnPromise:true});
  return filename;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2 — FEATURE 1: Comparison PDF (session vs session)
// Shows delta between two sessions: scores, metrics, zones, AI narrative
// ═══════════════════════════════════════════════════════════════════
export async function generateComparisonPDF({ session1, session2, sessions=[], profile, user, lang="en", allSessions=[], aiSummary="" }) {
  // Support both old API (session1,session2) and new API (sessions array)
  if (!session1 && sessions.length >= 2) { session1 = sessions[0]; session2 = sessions[1]; }
  if (!session1 || !session2) {
    throw new Error(lang==="ar" ? "محتاج جلستين على الأقل لإنشاء تقرير المقارنة." : "Need at least 2 sessions to generate a comparison report.");
  }

  const { jsPDF } = await import("jspdf");
  const isAr = lang==="ar";
  const tier = _t(profile?.tier||"standard");
  // tier check handled in UI — proceed regardless

  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  await Promise.all([_ensureCairoFont(doc,isAr), _ensureLogo()]);
  const W=210, H=297, ml=18, mr=18, cw=W-ml-mr;
  const sf  = (sz,st="normal") => font(doc,sz,st,isAr&&_cairoLoaded);
  const now = new Date();
  const nowStr = now.toLocaleDateString(isAr?"ar-EG":"en-US",{year:"numeric",month:"long",day:"numeric"});
  const name   = profile?.name||user?.displayName||user?.email?.split("@")[0]||(isAr?"مستخدم":"User");
  const tierCol= tierAtLeast(tier,"elite")?PDF_TOKENS.success:PDF_TOKENS.cyan;
  const tierLbl= tier.charAt(0).toUpperCase()+tier.slice(1);

  // ── DATA ──────────────────────────────────────────────────────
  const a1=Math.round(session1.avg_score||0), a2=Math.round(session2.avg_score||0);
  const delta=a2-a1, improved=delta>0, declined=delta<0;
  const deltaCol = delta>0?PDF_TOKENS.success:delta<0?PDF_TOKENS.danger:PDF_TOKENS.muted;
  const deltaBg  = delta>0?PDF_TOKENS.successBg:delta<0?PDF_TOKENS.dangerBg:PDF_TOKENS.bg;
  const g1=_scoreColor(a1), g2=_scoreColor(a2);

  const idx1=allSessions.findIndex(s=>(s.id||s.session_id)===(session1.id||session1.session_id));
  const idx2=allSessions.findIndex(s=>(s.id||s.session_id)===(session2.id||session2.session_id));
  const num1=idx1>=0?allSessions.length-idx1:1;
  const num2=idx2>=0?allSessions.length-idx2:2;

  const m1=session1.metrics||{}, m2=session2.metrics||{};
  const allKeys=[...new Set([...Object.keys(m1),...Object.keys(m2)])].filter(k=>!k.startsWith("_"));
  const metRows=allKeys.map(k=>{
    const has1 = m1[k]!=null, has2 = m2[k]!=null;
    const sc1=typeof m1[k]==="number"?m1[k]:(m1[k]?.score??null);
    const sc2=typeof m2[k]==="number"?m2[k]:(m2[k]?.score??null);
    const lbl=(isAr?METRIC_LABELS_AR[k]:METRIC_LABELS[k])||k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
    // A metric tracked in only one session has no real delta — don't fabricate
    // one by assuming a perfect 100 for the untracked side (that produced
    // phantom "-60 point regression" style false alarms).
    if(!has1||!has2){
      return{k,lbl,sc1,sc2,d:null,isNew:!has1&&has2,isRemoved:has1&&!has2};
    }
    const d=Math.round(sc2-sc1);
    return{k,lbl,sc1,sc2,d};
  }).sort((a,b)=>(a.d??0)-(b.d??0));

  const z1=_zonalRisk(m1), z2=_zonalRisk(m2);
  const d1=session1.duration_s||session1.duration_sec||0;
  const d2=session2.duration_s||session2.duration_sec||0;
  const gp1=Math.round(session1.good_pct||0), gp2=Math.round(session2.good_pct||0);
  const al1=session1.alerts_count||0, al2=session2.alerts_count||0;

  // ══════════════════════════════════════════════════════════════
  // PAGE 1 — PREMIUM COVER
  // ══════════════════════════════════════════════════════════════

  // Dark header
  fc(doc,...PDF_TOKENS.slate); doc.rect(0,0,W,72,"F");
  fc(doc,...deltaCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.06}));
  doc.circle(W*0.85,36,55,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.03}));
  doc.circle(W*0.85,36,78,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  fc(doc,...deltaCol); doc.rect(0,0,W,3,"F");

  // Logo + brand
  _logo(doc,ml,16,26,_logoMd);
  font(doc,13,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.card); doc.text("CORVUS",ml+34,28);
  font(doc,7,"normal",isAr&&_cairoLoaded); tc(doc,148,163,184); doc.text("Health Intelligence Platform",ml+34,36);

  // Tier badge
  const tlw=doc.getTextWidth(tierLbl)+12;
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.18}));
  rr(doc,ml+34,41,tlw,10,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...tierCol);
  doc.text(tierLbl,ml+34+tlw/2,48,{align:"center"});

  // Date right
  font(doc,7,"normal",isAr&&_cairoLoaded); tc(doc,148,163,184); doc.text(nowStr,W-mr,26,{align:"right"});
  font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.card);
  doc.text(`${isAr?"جلسة":"Session"} #${num1} vs #${num2}`,W-mr,36,{align:"right"});

  fc(doc,...deltaCol); doc.rect(0,69.5,W,2.5,"F");

  // Title
  let y=86;
  font(doc,20,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.ink);
  doc.text(isAr?"تقرير المقارنة":"Session Comparison Report",ml,y); y+=9;
  font(doc,9,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
  doc.text(`${name} · ${isAr?"مقارنة جلستين":"Head-to-head session analysis"}`,ml,y); y+=16;
  hr(doc,ml,y,cw); y+=14;

  // ── HERO SCORE COMPARISON ─────────────────────────────────────
  const heroH=70, half=(cw-14)/2;

  // Session 1 card
  fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,half,heroH,6,"F");
  dc(doc,...g1); lw(doc,0.3); rr(doc,ml,y,half,heroH,6,"S"); lw(doc,0.3);
  fc(doc,...g1); doc.rect(ml,y,half,3,"F"); rr(doc,ml,y,half,3,3,"F");
  // Session number chip
  const s1lbl=`${isAr?"جلسة":"Session"} #${num1}`;
  font(doc,7,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.card);
  fc(doc,...g1); rr(doc,ml+6,y+8,half-12,10,2,"F");
  doc.text(s1lbl,ml+6+(half-12)/2,y+14.5,{align:"center"});
  // Score gauge (proportional arc)
  fc(doc,...g1);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.08}));
  doc.circle(ml+half/2,y+40,14,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  _arcGauge(doc,ml+half/2,y+40,16,a1/100,g1,PDF_TOKENS.borderSoft,3);
  font(doc,20,"bold",isAr&&_cairoLoaded); tc(doc,...g1);
  doc.text(String(a1),ml+half/2,y+45,{align:"center"});
  font(doc,7,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
  doc.text("/100",ml+half/2,y+52,{align:"center"});
  font(doc,8.5,"bold",isAr&&_cairoLoaded); tc(doc,...g1);
  doc.text(_scoreLabel(a1,isAr),ml+half/2,y+62,{align:"center"});

  // VS divider + delta
  const mx=ml+half+7;
  // Delta circle
  fc(doc,...deltaBg);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.9}));
  doc.circle(mx,y+35,10,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  dc(doc,...deltaCol); lw(doc,1); doc.circle(mx,y+35,10,"S"); lw(doc,0.3);
  // Bigger delta value — the up/down arrow glyph doesn't render in helvetica,
  // so the signed number (+16 / -9 / 0) carries the direction on its own.
  font(doc,11,"bold",isAr&&_cairoLoaded); tc(doc,...deltaCol);
  doc.text(delta===0?"=":`${delta>0?"+":""}${delta}`,mx,y+38,{align:"center"});
  // VS label
  font(doc,6.5,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
  doc.text("VS",mx,y+52,{align:"center"});

  // Session 2 card
  const rx=mx+7;
  fc(doc,...PDF_TOKENS.card); rr(doc,rx,y,half,heroH,6,"F");
  dc(doc,...g2); lw(doc,0.3); rr(doc,rx,y,half,heroH,6,"S"); lw(doc,0.3);
  fc(doc,...g2); doc.rect(rx,y,half,3,"F"); rr(doc,rx,y,half,3,3,"F");
  const s2lbl=`${isAr?"جلسة":"Session"} #${num2}`;
  font(doc,7,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.card);
  fc(doc,...g2); rr(doc,rx+6,y+8,half-12,10,2,"F");
  doc.text(s2lbl,rx+6+(half-12)/2,y+14.5,{align:"center"});
  // Score gauge (proportional arc)
  fc(doc,...g2);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.08}));
  doc.circle(rx+half/2,y+40,14,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  _arcGauge(doc,rx+half/2,y+40,16,a2/100,g2,PDF_TOKENS.borderSoft,3);
  font(doc,20,"bold",isAr&&_cairoLoaded); tc(doc,...g2);
  doc.text(String(a2),rx+half/2,y+45,{align:"center"});
  font(doc,7,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
  doc.text("/100",rx+half/2,y+52,{align:"center"});
  font(doc,8.5,"bold",isAr&&_cairoLoaded); tc(doc,...g2);
  doc.text(_scoreLabel(a2,isAr),rx+half/2,y+62,{align:"center"});
  y+=heroH+8;

  // ── QUICK STATS — clean 3-column comparison table ─────────────
  // Values are centred under two aligned columns (was label-left / v1 at
  // 45% right-aligned / v2 at 98% right-aligned — which pushed the two
  // numbers to opposite edges with a large empty gap between them).
  const qStats=[
    [isAr?"التاريخ":"Date",_fmtDate(session1.created_at,isAr),_fmtDate(session2.created_at,isAr)],
    [isAr?"المدة":"Duration",_fmtDur(d1),_fmtDur(d2)],
    [isAr?"وضعية جيدة":"Good posture",`${gp1}%`,`${gp2}%`],
    [isAr?"التنبيهات":"Alerts",String(al1),String(al2)],
  ];
  const qc1=ml+cw*0.52, qc2=ml+cw*0.82; // centred value columns
  const qRowH=11;
  // header row
  fc(doc,...PDF_TOKENS.slate); rr(doc,ml,y,cw,9,2,"F");
  font(doc,7,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.card);
  doc.text(isAr?"المقياس":"Metric",ml+5,y+6);
  doc.text(`#${num1}`,qc1,y+6,{align:"center"});
  doc.text(`#${num2}`,qc2,y+6,{align:"center"});
  y+=9;
  qStats.forEach(([lbl,v1,v2],i)=>{
    const qy=y+i*qRowH;
    if(i%2===0){fc(doc,...PDF_TOKENS.bg); doc.rect(ml,qy,cw,qRowH,"F");}
    font(doc,7.5,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted); doc.text(String(lbl),ml+5,qy+7);
    font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.ink); doc.text(String(v1),qc1,qy+7,{align:"center"});
    tc(doc,...PDF_TOKENS.ink); doc.text(String(v2),qc2,qy+7,{align:"center"});
  });
  y+=qStats.length*qRowH+10;

  // ── INSIGHT BANNER ────────────────────────────────────────────
  const insText=improved
    ?(isAr?`تحسّن +${delta} نقطة — ${_scoreLabel(a2,isAr)} مقارنةً بـ ${_scoreLabel(a1,isAr)}`:`+${delta} point improvement — ${_scoreLabel(a2,isAr)} vs ${_scoreLabel(a1,isAr)}`)
    :declined
    ?(isAr?`انخفاض ${Math.abs(delta)} نقطة — راجع المقاييس المتراجعة أدناه`:`${Math.abs(delta)} point decline — review regressed metrics below`)
    :(isAr?"النتيجة مستقرة بين الجلستين":"Score stable between sessions");
  fc(doc,...deltaBg); rr(doc,ml,y,cw,14,3,"F");
  dc(doc,...deltaCol); lw(doc,0.25); rr(doc,ml,y,cw,14,3,"S"); lw(doc,0.3);
  fc(doc,...deltaCol); doc.rect(ml,y,3,14,"F"); rr(doc,ml,y,3,14,1.5,"F");
  font(doc,8.5,"bold",isAr&&_cairoLoaded); tc(doc,...deltaCol);
  doc.text(insText,ml+8,y+9.5);
  y+=22;

  // ══════════════════════════════════════════════════════════════
  // PAGE 2 — METRIC COMPARISON TABLE + ZONE MAP
  // ══════════════════════════════════════════════════════════════
  doc.addPage(); _hdr(doc,W,ml,mr,isAr?"مقارنة المقاييس":"Metric Comparison",isAr); y=22;

  _sh(doc,ml,y,isAr?"مقارنة مفصّلة للمقاييس":"Detailed Metric Breakdown",
    isAr?"مرتبة من الأسوأ تراجعاً إلى الأفضل تحسناً":"Sorted worst regression to best improvement",deltaCol,isAr);
  y+=16;

  // Column headers
  const colX=[ml+3,ml+cw*0.42,ml+cw*0.56,ml+cw*0.70,ml+cw*0.85];
  fc(doc,...PDF_TOKENS.slate); rr(doc,ml,y,cw,10,2,"F");
  font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.card);
  [isAr?"المقياس":"Metric",`#${num1}`,`#${num2}`,isAr?"الفرق":"Diff",isAr?"الاتجاه":"Trend"]
    .forEach((h,i)=>doc.text(h,colX[i],y+7));
  y+=12;

  metRows.forEach(({lbl,sc1,sc2,d,isNew,isRemoved},idx)=>{
    if(y>H-28){doc.addPage();_hdr(doc,W,ml,mr,isAr?"تابع":"Continued",isAr);y=22;}
    const rowH=11;
    fc(doc,...(idx%2===0?PDF_TOKENS.bg:PDF_TOKENS.card)); doc.rect(ml,y,cw,rowH,"F");
    font(doc,8,"normal",isAr); tc(doc,...PDF_TOKENS.ink); doc.text(lbl,colX[0]+2,y+7.5);

    if(d===null){
      // Metric tracked in only one session — showing a fabricated delta here
      // previously produced false "-60 point regression" alarms. Show each
      // side plainly and label it instead of comparing.
      if(sc1!=null){ const c1=_scoreColor(sc1); fc(doc,...c1); doc.circle(colX[1]-3,y+5.5,2.5,"F");
        font(doc,8,"bold",isAr&&_cairoLoaded); tc(doc,...c1); doc.text(String(Math.round(sc1)),colX[1]+2,y+7.5); }
      else { font(doc,7.5,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted); doc.text("—",colX[1]+2,y+7.5); }
      if(sc2!=null){ const c2=_scoreColor(sc2); fc(doc,...c2); doc.circle(colX[2]-3,y+5.5,2.5,"F");
        font(doc,8,"bold",isAr&&_cairoLoaded); tc(doc,...c2); doc.text(String(Math.round(sc2)),colX[2]+2,y+7.5); }
      else { font(doc,7.5,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted); doc.text("—",colX[2]+2,y+7.5); }
      font(doc,7,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
      doc.text(isNew?(isAr?"جديد":"NEW"):(isAr?"غير متتبع":"N/T"),colX[3],y+7.5);
      y+=rowH;
      return;
    }

    const dC=d>2?PDF_TOKENS.success:d<-2?PDF_TOKENS.danger:PDF_TOKENS.muted;
    // Left accent for significant changes
    if(Math.abs(d)>5){ fc(doc,...dC); doc.rect(ml,y,2,rowH,"F"); }
    // Score 1 with mini dot
    const c1=_scoreColor(sc1),c2=_scoreColor(sc2);
    fc(doc,...c1); doc.circle(colX[1]-3,y+5.5,2.5,"F");
    font(doc,8,"bold",isAr&&_cairoLoaded); tc(doc,...c1); doc.text(String(Math.round(sc1)),colX[1]+2,y+7.5);
    fc(doc,...c2); doc.circle(colX[2]-3,y+5.5,2.5,"F");
    font(doc,8,"bold",isAr&&_cairoLoaded); tc(doc,...c2); doc.text(String(Math.round(sc2)),colX[2]+2,y+7.5);
    // Delta
    font(doc,8.5,"bold",isAr&&_cairoLoaded); tc(doc,...dC);
    doc.text(`${d>0?"+":""}${d}`,colX[3],y+7.5);
    // Trend arrow pill — drawn triangle (glyph arrows don't render)
    fc(doc,...dC);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
    rr(doc,colX[4]-2,y+2,14,7,2,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    _triangle(doc,colX[4]+5,y+5.5,d>2?"up":d<-2?"down":"flat",dC);
    y+=rowH;
  });
  y+=10;

  // ── SPINAL ZONE COMPARISON ────────────────────────────────────
  // Keep all three zone cards together (~150mm: header + 3×43mm). They used
  // to split 2/1 across a page break, leaving a page with a single card.
  if(y>H-150){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خريطة المناطق":"Zone Map",isAr);y=22;}
  _sh(doc,ml,y,isAr?"مقارنة مناطق العمود الفقري":"Spinal Zone Comparison",
    isAr?"المخاطرة % — منخفض/متوسط/عالي":"Risk % — low/moderate/high",PDF_TOKENS.danger,isAr);
  y+=16;

  const zones=[
    {k:"cervical",en:"Cervical (Neck)",  ar:"عنق الرحم — الرقبة",  r:"C1–C7"},
    {k:"thoracic",en:"Thoracic (Upper)", ar:"الصدر — الظهر العلوي", r:"T1–T12"},
    {k:"lumbar",  en:"Lumbar (Lower)",   ar:"القطن — الظهر السفلي", r:"L1–S1"},
  ];
  zones.forEach(({k,en,ar,r})=>{
    if(y>H-44){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
    const r1=z1[k]||0, r2=z2[k]||0, dz=r2-r1;
    const rc1=_riskColor(r1), rc2=_riskColor(r2), dzC=dz>0?PDF_TOKENS.danger:dz<0?PDF_TOKENS.success:PDF_TOKENS.muted;
    const zh=36;
    fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,zh,4,"F");
    dc(doc,...rc2); lw(doc,0.25); rr(doc,ml,y,cw,zh,4,"S"); lw(doc,0.3);
    fc(doc,...rc2); doc.rect(ml,y,3,zh,"F"); rr(doc,ml,y,3,zh,1.5,"F");
    // Zone label
    font(doc,9.5,"bold",isAr); tc(doc,...PDF_TOKENS.ink); doc.text(isAr?ar:en,ml+9,y+10);
    font(doc,7,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.primary); doc.text(r,ml+9,y+17);
    // Two risk bars side by side
    const bw2=(cw-24)/2, barY=y+22;
    // Session 1 bar
    fc(doc,...PDF_TOKENS.borderSoft); rr(doc,ml+9,barY,bw2,5,2,"F");
    fc(doc,...rc1); rr(doc,ml+9,barY,Math.max(bw2*(r1/100),3),5,2,"F");
    font(doc,6.5,"bold",isAr&&_cairoLoaded); tc(doc,...rc1);
    doc.text(`#${num1}: ${r1}%`,ml+9,barY+10);
    // Session 2 bar
    fc(doc,...PDF_TOKENS.borderSoft); rr(doc,ml+9+bw2+4,barY,bw2,5,2,"F");
    fc(doc,...rc2); rr(doc,ml+9+bw2+4,barY,Math.max(bw2*(r2/100),3),5,2,"F");
    font(doc,6.5,"bold",isAr&&_cairoLoaded); tc(doc,...rc2);
    doc.text(`#${num2}: ${r2}%`,ml+9+bw2+4,barY+10);
    // Delta badge top right
    const dzlbl=dz===0?"0%":`${dz>0?"+":"-"}${Math.abs(dz)}%`;
    const dzw=doc.getTextWidth(dzlbl)+8;
    fc(doc,...dzC);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
    rr(doc,W-mr-dzw-2,y+7,dzw,9,2,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...dzC);
    doc.text(dzlbl,W-mr-dzw/2-2,y+13,{align:"center"});
    y+=zh+7;
  });

  // ══════════════════════════════════════════════════════════════
  // PAGE 3 — REGRESSED METRICS + INSIGHTS + ACTIONS
  // ══════════════════════════════════════════════════════════════
  doc.addPage(); _hdr(doc,W,ml,mr,isAr?"التوصيات":"Recommendations",isAr); y=22;

  // Regressed & improved metrics summary
  const regressed=metRows.filter(r=>r.d<-3).slice(0,5);
  const improved2=metRows.filter(r=>r.d>3).slice(0,3);

  if(regressed.length>0){
    _sh(doc,ml,y,isAr?"مقاييس تراجعت — تحتاج اهتماماً":"Regressed Metrics — Needs Attention","",PDF_TOKENS.danger,isAr);
    y+=14;
    regressed.forEach(({lbl,sc1,sc2,d})=>{
      if(y>H-20){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
      fc(doc,...PDF_TOKENS.dangerBg); rr(doc,ml,y,cw,14,3,"F");
      dc(doc,...PDF_TOKENS.danger); lw(doc,0.2); rr(doc,ml,y,cw,14,3,"S"); lw(doc,0.3);
      fc(doc,...PDF_TOKENS.danger); doc.rect(ml,y,3,14,"F"); rr(doc,ml,y,3,14,1.5,"F");
      font(doc,8.5,"bold",isAr); tc(doc,...PDF_TOKENS.danger); doc.text(lbl,ml+7,y+5.5);
      font(doc,7.5,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
      doc.text(`${Math.round(sc1)} -> ${Math.round(sc2)}`,ml+7,y+11);
      // Delta chip (right-aligned, solid) — replaces a faint partial bar that
      // read as an empty placeholder box.
      const dl=`${d} ${isAr?"نقطة":"pts"}`;
      const dw=doc.getTextWidth(dl)+9;
      fc(doc,...PDF_TOKENS.danger); doc.setGState&&doc.setGState(new doc.GState({opacity:0.14})); rr(doc,W-mr-dw-2,y+3,dw,8,2,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.danger); doc.text(dl,W-mr-dw/2-2,y+8.4,{align:"center"});
      y+=18;
    });
    y+=6;
  }

  if(improved2.length>0){
    if(y>H-60){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
    _sh(doc,ml,y,isAr?"مقاييس تحسّنت — استمر":"Improved Metrics — Keep Going","",PDF_TOKENS.success,isAr);
    y+=14;
    improved2.forEach(({lbl,sc1,sc2,d})=>{
      if(y>H-20){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
      fc(doc,...PDF_TOKENS.successBg); rr(doc,ml,y,cw,14,3,"F");
      dc(doc,...PDF_TOKENS.success); lw(doc,0.2); rr(doc,ml,y,cw,14,3,"S"); lw(doc,0.3);
      fc(doc,...PDF_TOKENS.success); doc.rect(ml,y,3,14,"F"); rr(doc,ml,y,3,14,1.5,"F");
      font(doc,8.5,"bold",isAr); tc(doc,...PDF_TOKENS.success); doc.text(lbl,ml+7,y+5.5);
      font(doc,7.5,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
      doc.text(`${Math.round(sc1)} -> ${Math.round(sc2)}`,ml+7,y+11);
      const gl=`+${d} ${isAr?"نقطة":"pts"}`;
      const gw=doc.getTextWidth(gl)+9;
      fc(doc,...PDF_TOKENS.success); doc.setGState&&doc.setGState(new doc.GState({opacity:0.14})); rr(doc,W-mr-gw-2,y+3,gw,8,2,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.success); doc.text(gl,W-mr-gw/2-2,y+8.4,{align:"center"});
      y+=18;
    });
    y+=6;
  }

  // Action plan
  if(y>H-100){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خطة الإجراءات":"Action Plan",isAr);y=22;}
  _sh(doc,ml,y,isAr?"خطة الإجراءات المقترحة":"Recommended Action Plan",
    isAr?"بناءً على أبرز التغيرات بين الجلستين":"Based on most significant changes between sessions",PDF_TOKENS.primary,isAr);
  y+=16;

  const NXT={
    neck_lean:["Raise monitor: top edge at eye level","Chin tuck 10 reps × 3 sets daily","Set posture alert every 20 min"],
    head_tilt:["Level monitor and check seating height","Head levelling exercise 10 reps daily","Ergonomic assessment recommended"],
    shoulder: ["Level armrests to equal height","Shoulder rolls backward 10 reps × 3","Doorway chest stretch 30s × 2 daily"],
    spine_align:["Align ear, shoulder, hip vertically","Lumbar support roll or cushion","Core brace 30s × 5 reps daily"],
    spine_lean:["Check chair tilt and lumbar support","Side stretch 30s each direction × 2","Walk 5 min every 45 min"],
    distance: ["Screen 50–70cm from eyes","Increase font size to reduce forward lean","20-20-20 rule: every 20 min look 20ft away"],
    default:  ["2-min stretch break every 30 min","Roll shoulders backward 5 times","Walk 5 min every hour"],
  };

  const topRegressed=regressed.slice(0,3);
  if(topRegressed.length===0){
    // No regressions — general maintenance actions
    topRegressed.push({k:"default",lbl:isAr?"الصيانة العامة":"General Maintenance",sc2:Math.min(a1,a2)});
  }
  topRegressed.forEach(({k,lbl,sc2},idx)=>{
    if(y>H-42){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
    const col=_scoreColor(sc2||50);
    const steps=NXT[k]||NXT.default;
    const ph=44;
    fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,ph,4,"F");
    dc(doc,...PDF_TOKENS.border); lw(doc,0.18); rr(doc,ml,y,cw,ph,4,"S"); lw(doc,0.3);
    fc(doc,...col); doc.rect(ml,y,3,ph,"F"); rr(doc,ml,y,3,ph,1.5,"F");
    // Number circle
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.15}));
    doc.circle(ml+16,y+14,9,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    dc(doc,...col); lw(doc,1); doc.circle(ml+16,y+14,9,"S"); lw(doc,0.3);
    font(doc,10,"bold",isAr&&_cairoLoaded); tc(doc,...col); doc.text(String(idx+1),ml+16,y+17.5,{align:"center"});
    // Title
    font(doc,10,"bold",isAr); tc(doc,...PDF_TOKENS.ink); doc.text(lbl,ml+30,y+12);
    font(doc,7.5,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
    steps.slice(0,3).forEach((s,i)=>{
      font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...col);
      doc.text(`${i+1}.`,ml+30,y+22+(i*7));
      font(doc,7.5,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
      doc.text(doc.splitTextToSize(s,cw-38)[0],ml+36,y+22+(i*7));
    });
    y+=ph+8;
  });

  // ── SESSION SUMMARY TABLE ─────────────────────────────────────
  y+=4; if(y>H-65){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الملخص":"Summary",isAr);y=22;}
  _sh(doc,ml,y,isAr?"ملخص الجلستين":"Session Summary","",PDF_TOKENS.indigo,isAr);
  y+=14;

  const sumRows=[
    [isAr?"رقم الجلسة":"Session number",`#${num1}`,`#${num2}`],
    [isAr?"التاريخ":"Date",_fmtDate(session1.created_at,isAr),_fmtDate(session2.created_at,isAr)],
    [isAr?"المجموع":"Score",`${a1}/100`,`${a2}/100`],
    [isAr?"وضعية جيدة":"Good posture",`${gp1}%`,`${gp2}%`],
    [isAr?"المدة":"Duration",_fmtDur(d1),_fmtDur(d2)],
    [isAr?"التنبيهات":"Alerts",String(al1),String(al2)],
    [isAr?"التغيّر":"Change","—",`${delta>0?"+":""}${delta} ${isAr?"نقطة":"pts"}`],
  ];
  const rowH4=12;
  const th3=sumRows.length*rowH4+9;
  fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,th3,4,"F");
  dc(doc,...PDF_TOKENS.border); lw(doc,0.18); rr(doc,ml,y,cw,th3,4,"S"); lw(doc,0.3);
  // Header row
  fc(doc,...PDF_TOKENS.slate); doc.rect(ml,y,cw,9,"F"); rr(doc,ml,y,cw,9,2,"F"); doc.rect(ml,y+5,cw,4,"F");
  font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.card);
  doc.text(isAr?"البند":"Item",ml+5,y+6.5);
  doc.text(`${isAr?"جلسة":"Session"} #${num1}`,ml+cw*0.42,y+6.5,{align:"center"});
  doc.text(`${isAr?"جلسة":"Session"} #${num2}`,ml+cw*0.75,y+6.5,{align:"center"});
  y+=9;
  sumRows.forEach(([k,v1,v2],i)=>{
    if(i%2===0){fc(doc,...PDF_TOKENS.bg); doc.rect(ml,y,cw,rowH4,"F");}
    font(doc,8,"normal",isAr); tc(doc,...PDF_TOKENS.muted); doc.text(k,ml+6,y+rowH4/2+1.5);
    font(doc,8.5,"bold",isAr);
    tc(doc,...(i===6?deltaCol:PDF_TOKENS.ink)); doc.text(v1,ml+cw*0.42,y+rowH4/2+1.5,{align:"center"});
    tc(doc,...(i===6?deltaCol:PDF_TOKENS.ink)); doc.text(v2,ml+cw*0.75,y+rowH4/2+1.5,{align:"center"});
    y+=rowH4;
  });
  y+=12;

  // ── CLOSING VERDICT BANNER ────────────────────────────────
  const _vcol = improved?PDF_TOKENS.success:declined?PDF_TOKENS.danger:PDF_TOKENS.muted;
  const vbnH=32;
  fc(doc,..._vcol); doc.setGState&&doc.setGState(new doc.GState({opacity:0.08})); rr(doc,ml,y,cw,vbnH,5,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  fc(doc,..._vcol); rr(doc,ml,y,3.2,vbnH,1.6,"F");
  font(doc,8,"bold",isAr&&_cairoLoaded); tc(doc,..._vcol); doc.text(isAr?"الخلاصة":"VERDICT",ml+9,y+9);
  font(doc,11,"bold",isAr); tc(doc,...PDF_TOKENS.ink);
  const _vhead = improved
    ? (isAr?`تحسّن بمقدار ${delta} نقطة بين الجلستين`:`Improved ${delta} points between sessions`)
    : declined
    ? (isAr?`تراجع بمقدار ${Math.abs(delta)} نقطة — راجع المقاييس المتراجعة`:`Down ${Math.abs(delta)} points — review the regressed metrics`)
    : (isAr?`النتيجة ثابتة بين الجلستين`:`Score held steady between sessions`);
  doc.text(_vhead,ml+9,y+19);
  font(doc,8,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
  doc.text(`#${num1} ${a1}/100  ·  #${num2} ${a2}/100`,ml+9,y+27);

  // Footers
  const tp=doc.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++){
    doc.setPage(p);
    _ftr(doc,W,ml,mr,H,p,tp,name);
  }

  const filename=`Corvus_Comparison_S${num1}_vs_S${num2}_${now.toISOString().slice(0,10)}.pdf`;
  await doc.save(filename, {returnPromise:true});
  return filename;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2 — FEATURE 2: HR Team Aggregate PDF
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// PHASE 2 — FEATURE 2: HR Team Aggregate PDF
// Aggregate report for HR admins: team scores, at-risk, dept breakdown
// ═══════════════════════════════════════════════════════════════════
export async function generateTeamPDF({ users=[], company="", dateRange=30, profile, lang="en", aiSummary="" }) {
  const { jsPDF } = await import("jspdf");
  const isAr = lang==="ar";
  const tier = _t(profile?.tier||"standard");
  // tier check handled in UI — proceed regardless

  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const W=210,H=297,ml=18,mr=18,cw=W-ml-mr;
  const cairo = await _loadCairo(doc,isAr);
  const sf = (sz,st="normal") => cairo&&isAr ? fontAr(doc,sz,st,true) : font(doc,sz,st);

  const now = new Date();
  const nowStr = now.toLocaleDateString(isAr?"ar-EG":"en-US",{year:"numeric",month:"long",day:"numeric"});
  const rangeLabel = isAr?`آخر ${dateRange} يوم`:`Last ${dateRange} days`;

  // Filter users with data
  const activeUsers = users.filter(u=>u.avg_score!=null);
  const totalU = activeUsers.length;
  const teamAvg = totalU>0 ? Math.round(activeUsers.reduce((s,u)=>s+(u.avg_score||0),0)/totalU) : 0;
  const atRisk  = activeUsers.filter(u=>(u.avg_score||0)<55);
  const excellent = activeUsers.filter(u=>(u.avg_score||0)>=80);
  const gradeC = _scoreColor(teamAvg);

  // ── COVER ─────────────────────────────────────────────────────
  fc(doc,...PDF_TOKENS.ink); doc.rect(0,0,W,64,"F");
  fc(doc,...PDF_TOKENS.primary); doc.rect(0,62,W,2,"F");
  _logo(doc,ml,14,22,_logoMd);
  sf(9,"normal"); tc(doc,...PDF_TOKENS.muted);
  doc.text(isAr?"تقرير صحة الوضعية للفريق":"Team Posture Health Report", ml+30,22);
  sf(7,"normal"); doc.text(`${company||profile?.company||"Organisation"} · ${nowStr}`,ml+30,29);
  sf(7,"normal"); doc.text(rangeLabel,ml+30,35);
  let y=78;

  sf(18,"bold"); tc(doc,...PDF_TOKENS.ink);
  doc.text(isAr?`تقرير الفريق — ${company||"المؤسسة"}`:`Team Report — ${company||"Organisation"}`,ml,y); y+=8;
  sf(8.5,"normal"); tc(doc,...PDF_TOKENS.muted);
  doc.text(isAr?`${totalU} موظف · ${rangeLabel}`:`${totalU} employees · ${rangeLabel}`,ml,y); y+=14;

  // KPI row
  const kpis = [
    [String(teamAvg), isAr?"متوسط الفريق":"Team Avg", gradeC],
    [String(totalU),  isAr?"إجمالي المستخدمين":"Active Users", PDF_TOKENS.primary],
    [String(atRisk.length),  isAr?"في خطر":"At Risk", atRisk.length>0?PDF_TOKENS.danger:PDF_TOKENS.success],
    [String(excellent.length), isAr?"ممتاز":"Excellent", PDF_TOKENS.success],
  ];
  kpis.forEach(([v,l,col],i)=>{
    const kx=ml+i*(cw/4);
    fc(doc,...PDF_TOKENS.bg); rr(doc,kx,y,cw/4-4,28,3,"F");
    sf(16,"bold"); tc(doc,...col);
    doc.text(v, kx+(cw/4-4)/2, y+17,{align:"center"});
    sf(7,"normal"); tc(doc,...PDF_TOKENS.muted);
    doc.text(l, kx+(cw/4-4)/2, y+24.5,{align:"center"});
  });
  y+=36;

  // Score distribution bar
  sf(10,"bold"); tc(doc,...PDF_TOKENS.ink);
  doc.text(isAr?"توزيع النقاط":"Score Distribution",ml,y); y+=6;
  const bands=[
    {label:isAr?"ممتاز (80+)":"Excellent (80+)", col:PDF_TOKENS.success, users:activeUsers.filter(u=>(u.avg_score||0)>=80)},
    {label:isAr?"جيد (65-79)":"Good (65-79)",    col:PDF_TOKENS.primary, users:activeUsers.filter(u=>(u.avg_score||0)>=65&&(u.avg_score||0)<80)},
    {label:isAr?"متوسط (55-64)":"Fair (55-64)",  col:PDF_TOKENS.warning, users:activeUsers.filter(u=>(u.avg_score||0)>=55&&(u.avg_score||0)<65)},
    {label:isAr?"ضعيف (<55)":"Poor (<55)",       col:PDF_TOKENS.danger,  users:atRisk},
  ];
  for(const {label,col,users:bu} of bands){
    if(y>H-30){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"التوزيع":"Distribution",isAr); y=22;}
    const pct=totalU>0?bu.length/totalU:0;
    fc(doc,...PDF_TOKENS.bg); doc.rect(ml,y,cw,8,"F");
    sf(7.5,"normal"); tc(doc,...PDF_TOKENS.ink); doc.text(label,ml+2,y+5.5);
    fc(doc,...col); doc.rect(ml+70,y+2,Math.max((cw-74)*pct,0),4,"F");
    sf(7.5,"bold"); tc(doc,...col);
    doc.text(`${bu.length} (${Math.round(pct*100)}%)`,W-mr-2,y+5.5,{align:"right"});
    y+=9;
  }
  y+=8;

  // At-Risk Users list
  if(atRisk.length>0){
    if(y>H-60){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"الموظفون في خطر":"At-Risk Employees",isAr); y=22;}
    sf(10,"bold"); tc(doc,...PDF_TOKENS.danger);
    doc.text(isAr?`الموظفون في خطر (${atRisk.length})`:`At-Risk Employees (${atRisk.length})`,ml,y); y+=5;
    sf(7.5,"normal"); tc(doc,...PDF_TOKENS.muted);
    doc.text(isAr?"متوسط الوضعية أقل من 55 — يُنصح بتدخل عاجل":"Posture avg below 55 — immediate ergonomic review recommended",ml,y); y+=7;

    // Table
    fc(doc,...PDF_TOKENS.ink); rr(doc,ml,y,cw,9,1,"F");
    sf(7,"bold"); tc(doc,255,255,255);
    doc.text(isAr?"الاسم":"Name",ml+3,y+6);
    doc.text(isAr?"النتيجة":"Score",ml+cw*0.55,y+6);
    doc.text(isAr?"آخر جلسة":"Last Session",ml+cw*0.72,y+6);
    y+=11;
    for(const u of atRisk.slice(0,15)){
      if(y>H-18){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"الموظفون في خطر":"At-Risk",isAr); y=22;}
      fc(doc,...PDF_TOKENS.bg); doc.rect(ml,y,cw,8,"F");
      sf(8,"normal"); tc(doc,...PDF_TOKENS.ink);
      doc.text(_fit(doc,u.name||u.email||"—",cw*0.55-6),ml+3,y+5.5);
      sf(8,"bold"); tc(doc,...PDF_TOKENS.danger);
      doc.text(String(Math.round(u.avg_score||0)),ml+cw*0.55,y+5.5);
      sf(7.5,"normal"); tc(doc,...PDF_TOKENS.muted);
      doc.text(u.last_session?_fmtDate(u.last_session,isAr):"—",ml+cw*0.72,y+5.5);
      y+=8;
    }
    if(atRisk.length>15){
      sf(7.5,"normal"); tc(doc,...PDF_TOKENS.muted);
      doc.text(`+ ${atRisk.length-15} ${isAr?"آخرين":"more"}`,ml,y+5); y+=10;
    }
  }

  // League table — top 10
  y+=6;
  if(y>H-70){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"تصنيف الفريق":"Team Leaderboard",isAr); y=22;}
  sf(10,"bold"); tc(doc,...PDF_TOKENS.ink);
  doc.text(isAr?"تصنيف الأداء":"Performance Leaderboard",ml,y); y+=7;
  const sorted=[...activeUsers].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0));
  fc(doc,...PDF_TOKENS.ink); rr(doc,ml,y,cw,9,1,"F");
  sf(7,"bold"); tc(doc,255,255,255);
  doc.text("#",ml+3,y+6); doc.text(isAr?"الاسم":"Name",ml+14,y+6);
  doc.text(isAr?"النتيجة":"Score",ml+cw*0.65,y+6); doc.text(isAr?"التقييم":"Grade",ml+cw*0.82,y+6);
  y+=11;
  for(const [i,u] of sorted.slice(0,10).entries()){
    if(y>H-18){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"تصنيف الفريق":"Team Leaderboard",isAr); y=22;}
    fc(doc,i%2===0?248:255,i%2===0?250:255,i%2===0?252:255); doc.rect(ml,y,cw,8,"F");
    const sc=Math.round(u.avg_score||0); const col=_scoreColor(sc);
    sf(8,"bold"); tc(doc,...(i<3?col:PDF_TOKENS.muted)); doc.text(String(i+1),ml+3,y+5.5);
    sf(8,"normal"); tc(doc,...PDF_TOKENS.ink); doc.text(_fit(doc,u.name||u.email||"—",cw*0.65-17),ml+14,y+5.5);
    sf(8,"bold"); tc(doc,...col); doc.text(String(sc),ml+cw*0.65,y+5.5);
    sf(7.5,"normal"); doc.text(_scoreLabel(sc,isAr),ml+cw*0.82,y+5.5);
    y+=8;
  }
  if(sorted.length===0){
    fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,14,2,"F");
    sf(8,"normal"); tc(doc,...PDF_TOKENS.muted);
    doc.text(isAr?"لا يوجد مستخدمون نشطون بعد — سيظهر الترتيب بمجرد بدء الفريق في تسجيل جلسات":"No active users yet — the leaderboard will populate once the team starts logging sessions",ml+cw/2,y+8,{align:"center"});
    y+=18;
  }

  // HR Recommendations
  y+=10;
  if(y>H-60){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"توصيات":"HR Recommendations",isAr); y=22;}
  sf(10,"bold"); tc(doc,...PDF_TOKENS.ink);
  doc.text(isAr?"توصيات لمدير الموارد البشرية":"HR Recommendations",ml,y); y+=7;
  const hrRecs = totalU===0 ? [
    isAr
      ? "لا يوجد مستخدمون نشطون في الفترة المحددة بعد — شارك رابط الدعوة مع الفريق لبدء تسجيل الجلسات"
      : "No active users in this period yet — share the team invite link to get employees logging sessions",
  ] : [
    atRisk.length>totalU*0.3
      ? (isAr?`${Math.round(atRisk.length/totalU*100)}% من الفريق في خطر — يُنصح بتدخل جماعي: ورشة ارغونوميكس وتقييم محطات العمل`
              :`${Math.round(atRisk.length/totalU*100)}% of team at-risk — recommend group intervention: ergonomics workshop + workstation audit`)
      : (isAr?"معظم الفريق في نطاق مقبول — ركّز على تحسين المجموعة الضعيفة"
              :"Most team members in acceptable range — focus ergonomic support on the at-risk group"),
    teamAvg < 65
      ? (isAr?"متوسط الفريق منخفض — راجع إعدادات المكاتب والكراسي وارتفاع الشاشات في كامل المساحة"
              :"Team average is low — conduct office-wide workstation setup review: monitors, chairs, keyboard height")
      : (isAr?"متوسط الفريق مقبول — حافظ على برامج التوعية بالوضعية وجلسات التمدد الجماعية"
              :"Team average acceptable — maintain posture awareness programs and group stretch sessions"),
    excellent.length > 0
      ? (isAr?`${excellent.length} موظفين بأداء ممتاز — استخدمهم كسفراء الوضعية الصحية في الفريق`
              :`${excellent.length} employees with excellent posture — leverage as posture wellness champions`)
      : (isAr?"لا يوجد موظفون بأداء ممتاز — ضع برنامج تحفيز (نقاط/جوائز) لتشجيع التحسين"
              :"No employees at excellent level — consider incentive program (points/rewards) to encourage improvement"),
  ];
  for(const rec of hrRecs){
    if(y>H-22){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"توصيات":"HR Recommendations",isAr); y=22;}
    fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,16,2,"F");
    sf(8,"normal"); tc(doc,...PDF_TOKENS.ink);
    const lines=doc.splitTextToSize(rec,cw-8);
    lines.slice(0,2).forEach((l,i)=>doc.text(l,ml+4,y+7+(i*5.5)));
    y+=20;
  }

  // Footer + page numbers
  const tp=doc.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++){
    doc.setPage(p);
    fc(doc,...PDF_TOKENS.ink); doc.rect(0,H-8,W,8,"F");
    sf(6.5,"normal"); tc(doc,100,116,139); // sf → Arabic font so nowStr/label don't garble
    doc.text(`Corvus — ${isAr?"تقرير الفريق — سري — ليس تشخيصاً طبياً":"Team Report — Confidential — Not a medical diagnosis"} · ${nowStr}`,ml,H-2.5);
    doc.text(`${p} / ${tp}`,W-mr,H-2.5,{align:"right"});
  }

  const filename=`Corvus_Team_Report_${_safeFilename(company)}_${new Date().toISOString().slice(0,10)}.pdf`;
  await doc.save(filename, {returnPromise:true});
  return filename;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2 — FEATURE 3: White-label PDF support
// Pass companyName + companyLogoBase64 → overrides Corvus branding in header
// ═══════════════════════════════════════════════════════════════════
// White-label is handled by the shared _logo helper + _coverHdr:
// Pass { companyName, companyLogo } in profile to activate.
// Already wired: _logo() checks profile?.companyLogo before drawing Corvus logo.
// Nothing additional needed here — the architecture supports it via profile fields.
// To activate: set profile.companyName + profile.companyLogo (base64 PNG) in Firestore.


// ═══════════════════════════════════════════════════════════════════
// PHASE 3 — FEATURE 1: Shareable Web Report
// Creates a Firestore snapshot + returns a shareable URL
// The URL opens SharedReportPage.jsx (public, no login required)
// Link auto-expires in 30 days
// ═══════════════════════════════════════════════════════════════════


export async function generateLongitudinalPDF({ sessions=[], profile, user, lang="en", aiSummary="", reportKind="longitudinal" }) {
  if (sessions.length === 0) throw new Error(lang==="ar" ? "لا توجد جلسات لإنشاء التقرير الطولي." : "No sessions available to generate a longitudinal report.");
  const { jsPDF } = await import("jspdf");
  if (sessions.length < 2) { console.warn("[PDF] Need more sessions for longitudinal"); }
  const isAr = lang==="ar";
  const tier = _t(profile?.tier||"standard");
  // tier check handled in UI — proceed regardless

  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  await Promise.all([_ensureCairoFont(doc,isAr), _ensureLogo()]);
  const W=210,H=297,ml=18,mr=18,cw=W-ml-mr;
  const sf = (sz,st="normal") => font(doc,sz,st,isAr&&_cairoLoaded);
  const _rawName4 = profile?.name||user?.displayName||(isAr?"مستخدم":"User");
  const name   = _rawName4.replace(/[\r\n]+/g,' ').replace(/\s{2,}/g,' ').trim();
  const now    = new Date();
  const nowStr = now.toLocaleDateString(isAr?"ar-EG":"en-US",{year:"numeric",month:"long",day:"numeric"});

  // ── DATA ──────────────────────────────────────────────────────
  const toMs = s => s.created_at?.toDate?.()?.getTime?.() || new Date(s.created_at||0).getTime();
  const sorted     = [...sessions].sort((a,b)=>toMs(a)-toMs(b)); // oldest first
  const allScores  = sorted.map(s=>Math.round(s.avg_score||0)).filter(Boolean);
  const cutoff90   = Date.now()-90*86400000;
  const window90   = sorted.filter(s=>toMs(s)>=cutoff90);
  const scores90   = window90.map(s=>s.avg_score||0).filter(Boolean);
  const avg90      = scores90.length ? Math.round(scores90.reduce((a,b)=>a+b,0)/scores90.length) : 0;
  const avgAll     = allScores.length ? Math.round(allScores.reduce((a,b)=>a+b,0)/allScores.length) : 0;
  const n3         = Math.max(1,Math.floor(allScores.length/3));
  const avgFirst   = Math.round(allScores.slice(0,n3).reduce((a,b)=>a+b,0)/n3);
  const avgLast    = Math.round(allScores.slice(-n3).reduce((a,b)=>a+b,0)/n3);
  const trendDelta = avgLast-avgFirst;
  const improved   = trendDelta>2, declined=trendDelta<-2;
  const trendCol   = improved?PDF_TOKENS.success:declined?PDF_TOKENS.danger:PDF_TOKENS.muted;
  const trendBg    = improved?PDF_TOKENS.successBg:declined?PDF_TOKENS.dangerBg:PDF_TOKENS.bg;

  // Weekly day pattern
  const byDay=Array(7).fill(null).map(()=>({scores:[]}));
  sorted.forEach(s=>{
    const ms=toMs(s); if(!ms||isNaN(ms)) return;
    const d=new Date(ms).getDay(); if(d<0||d>6) return;
    if(s.avg_score) byDay[d].scores.push(s.avg_score);
  });
  const dayAvgs   = byDay.map(d=>d.scores.length?Math.round(d.scores.reduce((a,b)=>a+b,0)/d.scores.length):null);
  const dayNamesEn= ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dayNamesAr= ["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"];
  const validDA   = dayAvgs.filter(Boolean);
  const bestDay   = validDA.length?dayAvgs.indexOf(Math.max(...validDA)):-1;
  const worstDay  = validDA.length?dayAvgs.indexOf(Math.min(...validDA)):-1;

  const weeksSpan   = Math.max(1,Math.ceil((Date.now()-toMs(sorted[0]))/(7*86400000)));
  const freqPerWeek = (sessions.length/weeksSpan).toFixed(1);
  const totalAlerts = sessions.reduce((a,s)=>a+(s.alerts_count||0),0);
  const avgDurMin   = Math.round(sessions.reduce((a,s)=>a+(s.duration_s||s.duration_sec||0),0)/sessions.length/60);

  const allZonal = sessions.filter(s=>s.metrics).map(s=>_zonalRisk(s.metrics));
  // Average only the sessions that actually measured a zone. `a + null` is `a`
  // in JS, so summing straight through turned an all-unmeasured lumbar into a
  // clean 0 — the same 0% "low risk" as a single session, but now averaged
  // across a whole history and presented as a trend.
  const _avgZone = k => {
    const vals = allZonal.map(z => z[k]).filter(v => v !== null && v !== undefined);
    return vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
  };
  const avgZonal = { cervical:_avgZone("cervical"), thoracic:_avgZone("thoracic"), lumbar:_avgZone("lumbar") };
  const best  = [...sessions].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0))[0];
  const worst = [...sessions].sort((a,b)=>(a.avg_score||0)-(b.avg_score||0))[0];

  // ══════════════════════════════════════════════════════════════
  // PAGE 1 — PREMIUM COVER
  // ══════════════════════════════════════════════════════════════

  // Full dark header band
  fc(doc,...PDF_TOKENS.slate); doc.rect(0,0,W,80,"F");
  // Subtle accent circles
  fc(doc,...PDF_TOKENS.indigo);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.06}));
  doc.circle(W*0.85,40,60,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.03}));
  doc.circle(W*0.85,40,85,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));

  // Trend color top strip
  fc(doc,...trendCol); doc.rect(0,0,W,3,"F");

  // Logo + brand
  _logo(doc,ml,18,26,_logoMd);
  font(doc,13,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.card);
  doc.text("CORVUS",ml+34,30);
  font(doc,7,"normal",isAr&&_cairoLoaded); tc(doc,148,163,184);
  doc.text("Health Intelligence Platform",ml+34,38);

  // ELITE badge
  const elbadge="ELITE";
  const elw=doc.getTextWidth(elbadge)+12;
  fc(doc,...PDF_TOKENS.success);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.18}));
  rr(doc,ml+34,43,elw,10,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.success);
  doc.text(elbadge,ml+34+elw/2,50,{align:"center"});

  // Date + session count right
  font(doc,7,"normal",isAr&&_cairoLoaded); tc(doc,148,163,184);
  doc.text(nowStr,W-mr,27,{align:"right"});
  font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.card);
  doc.text(`${sessions.length} ${isAr?"جلسة":"sessions"} · ${weeksSpan} ${isAr?"أسبوع":"weeks"}`,W-mr,37,{align:"right"});

  // Bottom accent
  fc(doc,...trendCol); doc.rect(0,77.5,W,2.5,"F");

  // Report title block
  let y=96;
  font(doc,22,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.ink);
  doc.text(reportKind==="ai" ? (isAr?"تقرير AI التنفيذي":"AI Executive Report") : (isAr?"التقرير الطولي":"Longitudinal Health Report"),ml,y); y+=10;
  font(doc,10,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
  doc.text(`${name} · ${isAr?"تحليل متعدد الجلسات":"Multi-session posture analysis"}`,ml,y); y+=16;

  // Thin divider
  hr(doc,ml,y,cw); y+=14;

  // ── KPI GRID (2×3) ─────────────────────────────────────────
  const kpis=[
    [isAr?`${avgAll}`:`${avgAll}`,    isAr?"متوسط الكل":"All-time avg",  _scoreColor(avgAll)],
    [isAr?`${avg90}`:`${avg90}`,      isAr?"آخر 90 يوم":"90-day avg",    _scoreColor(avg90)],
    [`${trendDelta>0?"+":""}${trendDelta}`, isAr?`تغيّر (${avgFirst} - ${avgLast})`:`Trend (${avgFirst} - ${avgLast})`,   trendCol],
    [String(sessions.length),          isAr?"الجلسات":"Sessions",         PDF_TOKENS.indigo],
    [freqPerWeek,                       isAr?"جلسة/أسبوع":"Per week",     PDF_TOKENS.cyan],
    [`${avgDurMin}m`,                   isAr?"متوسط المدة":"Avg duration", PDF_TOKENS.primary],
  ];
  const kw=(cw-10)/3, kh=32;
  kpis.forEach(([v,l,col],i)=>{
    const kx=ml+(i%3)*(kw+5), ky=y+Math.floor(i/3)*(kh+6);
    fc(doc,...PDF_TOKENS.card); rr(doc,kx,ky,kw,kh,4,"F");
    dc(doc,...PDF_TOKENS.border); lw(doc,0.18); rr(doc,kx,ky,kw,kh,4,"S"); lw(doc,0.3);
    // Top accent
    fc(doc,...col); rr(doc,kx,ky,kw,3,2,"F"); doc.rect(kx,ky+1.5,kw,1.5,"F");
    // Value
    font(doc,16,"bold",isAr&&_cairoLoaded); tc(doc,...col);
    doc.text(v,kx+kw/2,ky+kh*0.58,{align:"center"});
    // Label
    font(doc,7,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
    doc.text(l,kx+kw/2,ky+kh*0.82,{align:"center"});
  });
  y+=kh*2+6*2+12;

  // ── TREND BANNER ───────────────────────────────────────────
  const trendText = improved
    ? (isAr?`تحسّن مستمر +${trendDelta} نقطة منذ البداية — أنت على المسار الصحيح`:`Consistent improvement +${trendDelta}pts since start`)
    : declined
    ? (isAr?`انخفاض ${Math.abs(trendDelta)} نقطة — راجع إعداد محطة العمل`:`${Math.abs(trendDelta)}pt decline — review workstation setup`)
    : (isAr?"الوضعية مستقرة — الاتساق إيجابي":"Posture stable — consistency is positive");
  fc(doc,...trendBg); rr(doc,ml,y,cw,14,3,"F");
  dc(doc,...trendCol); lw(doc,0.25); rr(doc,ml,y,cw,14,3,"S"); lw(doc,0.3);
  fc(doc,...trendCol); doc.rect(ml,y,3,14,"F"); rr(doc,ml,y,3,14,1.5,"F");
  // Drawn trend triangle instead of the "[UP]" text placeholder
  _triangle(doc,ml+11,y+7,improved?"up":declined?"down":"flat",trendCol);
  font(doc,8.5,"bold",isAr&&_cairoLoaded); tc(doc,...trendCol);
  doc.text(trendText,ml+17,y+9.2);
  y+=22;

  // ── AI EXECUTIVE SUMMARY (reportKind==="ai" only) ───────────────
  // This is what actually makes "AI Executive Report" distinct from
  // "Longitudinal Report" rather than being the exact same document with
  // a different cover title — leads with the AI-generated narrative and
  // prioritized actions before the detailed trend/zone pages that follow.
  if (reportKind === "ai") {
    if (y > H - 70) { doc.addPage(); await _hdr(doc, W, ml, mr, isAr?"ملخص تنفيذي":"Executive Summary", isAr); y = 22; }
    y = _sh(doc, ml, y, isAr?"الملخص التنفيذي":"Executive Summary",
      isAr?"أهم النتائج والإجراءات الموصى بها":"Key findings and recommended actions", PDF_TOKENS.primary, isAr);

    const worstZoneKey = Object.entries(avgZonal).filter(([,v])=>v!=null).sort((a,b)=>b[1]-a[1])[0]?.[0] || "cervical";
    const zoneLabel = { cervical: isAr?"الرقبة والعمود العنقي":"Neck & cervical spine",
                         thoracic: isAr?"أعلى الظهر":"Upper back / thoracic",
                         lumbar:   isAr?"أسفل الظهر":"Lower back / lumbar" }[worstZoneKey];

    const summaryText = (aiSummary || "").trim() ||
      (isAr
        ? `على مدار ${sessions.length} جلسة (${weeksSpan} أسبوع)، كان المتوسط العام ${avgAll}/100. المنطقة الأكثر احتياجًا للمتابعة هي ${zoneLabel}. ${improved?"الاتجاه العام إيجابي.":declined?"الاتجاه العام في انخفاض ويحتاج مراجعة.":"الوضعية مستقرة نسبيًا."}`
        : `Across ${sessions.length} sessions over ${weeksSpan} weeks, the overall average was ${avgAll}/100. ${zoneLabel} is the area needing the most attention. ${improved?"The overall trend is improving.":declined?"The overall trend is declining and warrants review.":"Posture has stayed relatively stable."}`);
    y = _callout(doc, ml, y, cw, summaryText, declined?"warning":improved?"success":"info", isAr) + 8;

    if (y > H - 60) { doc.addPage(); await _hdr(doc, W, ml, mr, isAr?"ملخص تنفيذي":"Executive Summary", isAr); y = 22; }
    const actions = [
      declined
        ? (isAr?`ركّز الأسبوعين القادمين على ${zoneLabel} — هي أكثر منطقة تراجعًا`:`Focus the next two weeks on ${zoneLabel} — it's declined the most`)
        : (isAr?`حافظ على نفس الروتين الحالي لـ ${zoneLabel}، وهو بيتحسن`:`Keep the current routine for ${zoneLabel} — it's trending well`),
      freqPerWeek < 3
        ? (isAr?`زوّد تكرار الجلسات (حاليًا ${freqPerWeek}/أسبوع) — الاتساق أهم من المدة`:`Increase session frequency (currently ${freqPerWeek}/week) — consistency matters more than duration`)
        : (isAr?`معدل الجلسات الحالي (${freqPerWeek}/أسبوع) كويس — حافظ عليه`:`Current session frequency (${freqPerWeek}/week) is solid — maintain it`),
      isAr?`راجع أسوأ جلسة (${worst?.avg_score||0}/100) وقارنها بأفضل جلسة (${best?.avg_score||0}/100) لتحديد إيه اللي بيفرق`
          :`Compare the worst session (${worst?.avg_score||0}/100) against the best (${best?.avg_score||0}/100) to identify what's different`,
    ];
    y = _sh(doc, ml, y, isAr?"إجراءات موصى بها":"Recommended Actions", "", PDF_TOKENS.success, isAr);
    actions.forEach((a,i) => {
      if (y > H - 20) { doc.addPage(); _hdr(doc, W, ml, mr, isAr?"إجراءات موصى بها":"Recommended Actions", isAr); y = 22; }
      font(doc,7.5,"bold"); tc(doc,...PDF_TOKENS.success); doc.text(`${i+1}.`, ml, y);
      font(doc,8.5,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.sub);
      const lines = doc.splitTextToSize(a, cw-8);
      lines.forEach((l,li)=>doc.text(l, ml+6, y+(li*4.5)));
      y += lines.length*4.5 + 4;
    });
    y += 8;
    doc.addPage(); _hdr(doc, W, ml, mr, isAr?"التفاصيل الكاملة":"Full Detail", isAr); y = 22;
    font(doc,9,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
    doc.text(isAr?"الصفحات التالية فيها نفس التحليل التفصيلي متاح في التقرير الطولي":"The following pages carry the same detailed analysis available in the Longitudinal report", ml, y);
    y += 14;
  }


  // ── ELITE: WEEKLY GOAL PROGRESS ─────────────────────────────
  const _lgGoal = Number(profile?.goal_score) || null;
  if (_lgGoal) {
    if(y>H-45){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الهدف":"Goal",isAr);y=22;}
    const _lgNow=Date.now(), _WK=7*86400000;
    const _lgCur=_exWindowAvg(sessions,_lgNow-_WK,_lgNow+1);
    const _lgPrev=_exWindowAvg(sessions,_lgNow-2*_WK,_lgNow-_WK);
    const _lgSlope=_exSlopePerDay(sessions);
    const _lgReached=_lgCur!=null&&_lgCur>=_lgGoal;
    const _lgCol=_lgReached?PDF_TOKENS.success:PDF_TOKENS.primary;
    fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,26,4,"F");
    dc(doc,..._lgCol); lw(doc,0.25); rr(doc,ml,y,cw,26,4,"S"); lw(doc,0.3);
    fc(doc,..._lgCol); doc.rect(ml,y,3,26,"F"); rr(doc,ml,y,3,26,1.5,"F");
    font(doc,8.5,"bold",isAr); tc(doc,...PDF_TOKENS.ink);
    doc.text(isAr?"هدفك الأسبوعي":"Weekly Goal",ml+8,y+8);
    font(doc,12,"bold",isAr&&_cairoLoaded); tc(doc,..._lgCol);
    doc.text(`${_lgCur??"—"} / ${_lgGoal}`,ml+8,y+19);
    const _gbx=ml+cw*0.35,_gbw=cw*0.38;
    fc(doc,...PDF_TOKENS.borderSoft); rr(doc,_gbx,y+13,_gbw,5,2,"F");
    fc(doc,..._lgCol); rr(doc,_gbx,y+13,Math.max(_gbw*Math.min(1,(_lgCur||0)/_lgGoal),3),5,2,"F");
    if(_lgCur!=null&&_lgPrev!=null){
      const _d=_lgCur-_lgPrev,_dc=_d>0?PDF_TOKENS.success:_d<0?PDF_TOKENS.danger:PDF_TOKENS.muted;
      font(doc,8,"bold",isAr&&_cairoLoaded); tc(doc,..._dc);
      doc.text(`${_d>0?"+":""}${_d} ${isAr?"عن الأسبوع الماضي":"vs last wk"}`,W-mr-5,y+9,{align:"right"});
    }
    const _eta=_lgReached?(isAr?"وصلت لهدفك — ثبّته":"Goal reached — hold it")
      : _lgSlope!=null&&_lgSlope>0.05?(isAr?`متوقع الوصول خلال ~${Math.ceil((_lgGoal-(_lgCur||0))/_lgSlope)} يوم`:`ETA ~${Math.ceil((_lgGoal-(_lgCur||0))/_lgSlope)} days at current pace`)
      : (isAr?"المعدل ثابت — زد عدد الجلسات":"Flat pace — add sessions");
    font(doc,7,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
    doc.text(_eta,W-mr-5,y+19,{align:"right"});
    y+=32;
  }

  // ── SCORE TRAJECTORY ────────────────────────────────────────
  // Chart needs ~70mm — break first so it never clips the page bottom
  if(y>H-75){doc.addPage();_hdr(doc,W,ml,mr,isAr?"مسار النقاط":"Trajectory",isAr);y=22;}
  _sh(doc,ml,y,isAr?"مسار النقاط":"Score Trajectory",isAr?"كل الجلسات بالترتيب الزمني":"All sessions in chronological order",_scoreColor(avgAll),isAr);
  y+=14;
  const th=64;
  fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,th,4,"F");
  dc(doc,...PDF_TOKENS.border); lw(doc,0.18); rr(doc,ml,y,cw,th,4,"S"); lw(doc,0.3);

  const spts=allScores.map((sc,i)=>({
    px:ml+6+(i/Math.max(allScores.length-1,1))*(cw-12),
    py:y+th-6-((Math.max(sc,30)-30)/70)*(th-12),
  }));

  // Reference lines
  [50,65,80].forEach(v=>{
    const gy=y+th-6-((v-30)/70)*(th-12);
    dc(doc,...PDF_TOKENS.border); lw(doc,0.12); doc.line(ml+3,gy,ml+cw-3,gy);
    font(doc,5,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.light);
    doc.text(String(v),ml+1,gy+1.5,{align:"right"});
  }); lw(doc,0.3);

  // Area fill
  if(spts.length>1){
    const tC=_scoreColor(avgLast);
    try{
      const segs=spts.slice(1).map((p,i)=>[p.px-spts[i].px,p.py-spts[i].py]);
      fc(doc,...tC);
      doc.setGState&&doc.setGState(new doc.GState({opacity:0.07}));
      doc.lines([...segs,[0,y+th-6-spts[spts.length-1].py],[-(spts[spts.length-1].px-spts[0].px),0]],spts[0].px,spts[0].py,[1,1],"F",false);
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    }catch{}

    // Trend regression line
    const n2=spts.length;
    const sx=spts.reduce((a,_,i)=>a+i,0), sy=spts.reduce((a,p)=>a+p.py,0);
    const sxy=spts.reduce((a,p,i)=>a+i*p.py,0), sx2=spts.reduce((a,_,i)=>a+i*i,0);
    const slope=(n2*sxy-sx*sy)/(n2*sx2-sx*sx)||0;
    const b2=(sy-slope*sx)/n2;
    const rC=slope<0?PDF_TOKENS.success:PDF_TOKENS.danger;
    dc(doc,...rC); lw(doc,0.5); doc.setLineDashPattern([2,2],0);
    doc.line(spts[0].px,b2,spts[n2-1].px,b2+slope*(n2-1));
    doc.setLineDashPattern([],0); lw(doc,0.3);

    // Session line + dots
    const lC=_scoreColor(avgLast);
    dc(doc,...lC); lw(doc,1.5);
    spts.forEach((p,i)=>{ if(i>0) doc.line(spts[i-1].px,spts[i-1].py,p.px,p.py); });
    lw(doc,0.3);
    // First & last highlighted
    fc(doc,...PDF_TOKENS.card); doc.circle(spts[0].px,spts[0].py,2.2,"F");
    dc(doc,...lC); lw(doc,1); doc.circle(spts[0].px,spts[0].py,2.2,"S"); lw(doc,0.3);
    fc(doc,...lC); doc.circle(spts[spts.length-1].px,spts[spts.length-1].py,2.8,"F");
    // Score labels
    font(doc,6,"bold",isAr&&_cairoLoaded); tc(doc,...lC);
    doc.text(String(allScores[0]),spts[0].px,spts[0].py-4,{align:"center"});
    doc.text(String(allScores[allScores.length-1]),spts[spts.length-1].px,spts[spts.length-1].py-4,{align:"center"});
  }
  y+=th+12;

  // ── BEST / WORST SESSION CARDS (share the trajectory page) ──
  _sh(doc,ml,y,isAr?"أفضل وأسوأ جلسة":"Best & Worst Sessions","",PDF_TOKENS.success,isAr);
  y+=14;
  [[isAr?"الجلسة الأفضل":"Best Session",best,PDF_TOKENS.success],
   [isAr?"الجلسة الأسوأ":"Worst Session",worst,PDF_TOKENS.danger]
  ].forEach(([label,sess,col])=>{
    if(!sess) return;
    if(y>H-40){doc.addPage();_hdr(doc,W,ml,mr,isAr?"أفضل وأسوأ":"Best & Worst",isAr);y=22;}
    const sh2=30;
    fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,sh2,4,"F");
    dc(doc,...col); lw(doc,0.25); rr(doc,ml,y,cw,sh2,4,"S"); lw(doc,0.3);
    fc(doc,...col); doc.rect(ml,y,3,sh2,"F"); rr(doc,ml,y,3,sh2,1.5,"F");
    // Score badge
    fc(doc,...col); rr(doc,ml+7,y+6,18,18,3,"F");
    font(doc,11,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.card);
    doc.text(String(Math.round(sess.avg_score||0)),ml+16,y+17,{align:"center"});
    // Label
    font(doc,9.5,"bold",isAr); tc(doc,...PDF_TOKENS.ink); doc.text(label,ml+30,y+12);
    font(doc,7.5,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
    doc.text(_fmtDate(sess.created_at,isAr),ml+30,y+20);
    // Right stats
    font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...col);
    doc.text(`${isAr?"المدة":"Duration"}: ${_fmtDur(sess.duration_s||sess.duration_sec||0)}`,W-mr-2,y+12,{align:"right"});
    font(doc,7,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
    doc.text(`${isAr?"تنبيهات":"Alerts"}: ${sess.alerts_count||0}`,W-mr-2,y+20,{align:"right"});
    y+=sh2+9;
  });

  // ══════════════════════════════════════════════════════════════
  // PAGE 3 — WEEKLY PATTERN + ZONE RISK
  // ══════════════════════════════════════════════════════════════
  doc.addPage(); _hdr(doc,W,ml,mr,isAr?"التحليل التفصيلي":"Detailed Analysis",isAr); y=22;

  // ── WEEKLY DAY BARS ──────────────────────────────────────────
  _sh(doc,ml,y,isAr?"النمط الأسبوعي":"Weekly Pattern",isAr?"متوسط النقاط حسب اليوم":"Average score by day of week",PDF_TOKENS.primary,isAr);
  y+=16;

  const barZoneH=52;
  fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,barZoneH,4,"F");
  dc(doc,...PDF_TOKENS.border); lw(doc,0.18); rr(doc,ml,y,cw,barZoneH,4,"S"); lw(doc,0.3);

  const maxDayV=Math.max(...(validDA.length?validDA:[80]),80);
  const barW2=(cw-24)/7, barMaxH=barZoneH-18;
  dayAvgs.forEach((avg,di)=>{
    const bx=ml+12+di*(barW2+2);
    if(!avg){
      // No data — ghost bar
      fc(doc,...PDF_TOKENS.border); rr(doc,bx,y+barZoneH-12-4,barW2,4,1,"F");
      font(doc,5.5,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.light);
      doc.text("—",bx+barW2/2,y+barZoneH-5.5,{align:"center"});
      doc.text(isAr?dayNamesAr[di]:dayNamesEn[di],bx+barW2/2,y+barZoneH-1.5,{align:"center"});
      return;
    }
    const bh=Math.max(((avg-30)/70)*barMaxH,3);
    const bc=di===bestDay?PDF_TOKENS.success:di===worstDay?PDF_TOKENS.danger:PDF_TOKENS.primary;
    // Bar
    fc(doc,...bc);
    doc.setGState&&doc.setGState(new doc.GState({opacity:di===bestDay||di===worstDay?1:0.7}));
    rr(doc,bx,y+barZoneH-12-bh,barW2,bh,1.5,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    // Score label above bar
    font(doc,6.5,"bold",isAr&&_cairoLoaded); tc(doc,...bc);
    doc.text(String(avg),bx+barW2/2,y+barZoneH-12-bh-2,{align:"center"});
    // Day label
    font(doc,6,"bold",isAr&&_cairoLoaded); tc(doc,...(di===bestDay?PDF_TOKENS.success:di===worstDay?PDF_TOKENS.danger:PDF_TOKENS.muted));
    doc.text(isAr?dayNamesAr[di]:dayNamesEn[di],bx+barW2/2,y+barZoneH-1.5,{align:"center"});
  });
  y+=barZoneH+8;

  // Best/worst day insight strip
  if(bestDay>=0&&worstDay>=0&&bestDay!==worstDay){
    const bdn=isAr?dayNamesAr[bestDay]:dayNamesEn[bestDay];
    const wdn=isAr?dayNamesAr[worstDay]:dayNamesEn[worstDay];
    fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,11,2,"F");
    font(doc,7.5,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.sub);
    const ins=isAr
      ?`أفضل يوم: ${bdn} (${dayAvgs[bestDay]}) · أسوأ يوم: ${wdn} (${dayAvgs[worstDay]})`
      :`Best day: ${bdn} (${dayAvgs[bestDay]}) · Worst day: ${wdn} (${dayAvgs[worstDay]})`;
    doc.text(ins,ml+cw/2,y+7.5,{align:"center"});
    y+=18;
  } else if(bestDay>=0&&bestDay===worstDay){
    fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,11,2,"F");
    font(doc,7.5,"italic",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
    doc.text(isAr?"بيانات غير كافية لتحديد نمط أسبوعي — سجّل جلسات في أيام مختلفة لرؤية الاتجاه":"Not enough data across different days yet to identify a weekly pattern — log sessions on more days to see a trend",ml+cw/2,y+7.5,{align:"center"});
    y+=18;
  }

  // ── SPINAL ZONE RISK ──────────────────────────────────────────
  y+=4;
  _sh(doc,ml,y,isAr?"خريطة مناطق الخطر":"Spinal Zone Risk Map",isAr?"متوسط من كل الجلسات":"Averaged across all sessions",PDF_TOKENS.danger,isAr);
  y+=16;

  const zones=[
    {k:"cervical",en:"Cervical (Neck)",   ar:"عنق الرحم — الرقبة",   r:"C1–C7",  desc:isAr?"انحناء الرقبة والرأس للأمام":"Neck lean, FHP, head tilt and rotation"},
    {k:"thoracic",en:"Thoracic (Upper)",  ar:"الصدر — الظهر العلوي",  r:"T1–T12", desc:isAr?"تماثل الكتفين والوضعية العلوية":"Shoulder symmetry and upper spinal curvature"},
    {k:"lumbar",  en:"Lumbar (Lower)",    ar:"القطن — الظهر السفلي",  r:"L1–S1",  desc:isAr?"محاذاة العمود الفقري وزاوية الورك":"Spinal alignment and hip angle"},
  ];
  zones.forEach(({k,en,ar,r,desc})=>{
    if(y>H-42){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خريطة المخاطر":"Risk Map",isAr);y=22;}
    const risk=avgZonal[k], rc=_riskColor(risk);   // nullable
    const zh=34;
    fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,zh,4,"F");
    dc(doc,...rc); lw(doc,0.25); rr(doc,ml,y,cw,zh,4,"S"); lw(doc,0.3);
    fc(doc,...rc); doc.rect(ml,y,3,zh,"F"); rr(doc,ml,y,3,zh,1.5,"F");
    // Risk circle
    fc(doc,...rc); doc.circle(ml+18,y+zh/2,10,"F");
    font(doc,9.5,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.card);
    doc.text(_riskPct(risk),ml+18,y+zh/2+3.5,{align:"center"});
    // Title + region
    font(doc,10,"bold",isAr); tc(doc,...PDF_TOKENS.ink);
    doc.text(isAr?ar:en,ml+33,y+10);
    font(doc,7,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.primary); doc.text(r,ml+33,y+17);
    // Risk label pill
    const rlbl=_riskLabel(risk,isAr);
    const rw=doc.getTextWidth(rlbl)+8;
    fc(doc,...rc);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
    rr(doc,W-mr-rw-2,y+6,rw,9,2,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    font(doc,7.5,"bold",isAr&&_cairoLoaded); tc(doc,...rc);
    doc.text(rlbl,W-mr-rw/2-2,y+11.8,{align:"center"});
    // Progress bar
    const bx=ml+33, bw2=cw*0.42;
    fc(doc,...PDF_TOKENS.borderSoft); rr(doc,bx,y+21,bw2,5,2,"F");
    fc(doc,...rc); rr(doc,bx,y+21,Math.max(bw2*(risk/100),3),5,2,"F");
    // Desc
    font(doc,7,"normal",isAr); tc(doc,...PDF_TOKENS.muted);
    doc.text(desc,ml+33,y+zh-4);
    y+=zh+7;
  });

  // ══════════════════════════════════════════════════════════════
  // PAGE 3 — AI NARRATIVE + 8-WEEK PROGRAMME
  // ══════════════════════════════════════════════════════════════
  doc.addPage(); _hdr(doc,W,ml,mr,isAr?"التحليل والخطة":"Analysis & Plan",isAr); y=22;

  // AI narrative
  _sh(doc,ml,y,isAr?"تحليل Corvus AI":"Corvus AI Analysis",isAr?"مولّد من بيانات جلساتك":"Generated from your session data",PDF_TOKENS.primary,isAr);
  y+=16;

  const highestRiskAll = Math.max(...[avgZonal.cervical, avgZonal.thoracic, avgZonal.lumbar].filter(v=>v!=null), 0);
const highestRiskName = avgZonal.cervical >= avgZonal.thoracic && avgZonal.cervical >= avgZonal.lumbar
  ? (isAr ? "Cervical (neck)" : "Cervical (neck)")
  : avgZonal.thoracic >= avgZonal.lumbar
    ? (isAr ? "Thoracic (upper back)" : "Thoracic (upper back)")
    : (isAr ? "Lumbar (lower back)" : "Lumbar (lower back)");

const narrative=[
  improved
    ? (isAr
      ? `عبر ${sessions.length} جلسة، حقق ${name} تحسناً مستمراً +${trendDelta} نقطة في جودة الوضعية. الاتجاه التصاعدي يؤكد تكوين عادات فعالة.${bestDay >= 0 && bestDay !== worstDay ? ` جلسات يوم ${(isAr ? dayNamesAr[bestDay] : dayNamesEn[bestDay])} تتفوق باستمرار.` : ""} متوسط 90 يوم: ${avg90}/100.`
      : `Over ${sessions.length} sessions, ${name} achieved a consistent +${trendDelta} point improvement. 90-day average: ${avg90}/100. Upward trajectory confirms effective habit formation.${bestDay >= 0 && bestDay !== worstDay ? ` ${(isAr?dayNamesAr[bestDay]:dayNamesEn[bestDay])} sessions consistently outperform others.` : ""}`)
    : declined
    ? (isAr
      ? `عبر ${sessions.length} جلسة، لوحظ انخفاض ${Math.abs(trendDelta)} نقطة. هذا النمط يتبع عادةً زيادة في عبء العمل أو تغييرات في الإرغونوميكس. أعلى منطقة خطر: ${highestRiskName} (${highestRiskAll}%).`
      : `Across ${sessions.length} sessions, a ${Math.abs(trendDelta)}-point decline was observed. This pattern typically follows increased workload or ergonomic changes. Highest-risk zone: ${highestRiskName} (${highestRiskAll}%).`)
    : (isAr
      ? `جودة الوضعية ظلت مستقرة عبر ${sessions.length} جلسة (متوسط ${avgAll}/100). الاتساق إيجابي، لكن هناك إمكانية لتحسين 10-15 نقطة. أعلى منطقة خطر: ${highestRiskName} (${highestRiskAll}%).`
      : `Posture quality remained stable across ${sessions.length} sessions (avg ${avgAll}/100). While consistency is positive, 10-15 point improvement is achievable. Highest-risk zone: ${highestRiskName} (${highestRiskAll}%).`),
  (isAr
    ? `مناطق العمود الفقري: Cervical ${avgZonal.cervical}%, Thoracic ${avgZonal.thoracic}%, Lumbar ${avgZonal.lumbar}%. المنطقة الأعلى خطراً: ${highestRiskName}. ${highestRiskAll > 50 ? "يتطلب هذا مستوى الخطر تدخلاً مستهدفاً فورياً." : "المستويات الحالية قابلة للتحسين من خلال تمارين مستهدفة."}`
    : `Spinal zones: Cervical ${avgZonal.cervical}%, Thoracic ${avgZonal.thoracic}%, Lumbar ${avgZonal.lumbar}%. Primary risk: ${highestRiskName}. ${highestRiskAll > 50 ? "This risk level requires immediate targeted intervention." : "Current levels are improvable through targeted exercises."}`),
  (isAr
    ? `معدل التكرار: ${freqPerWeek} جلسة/أسبوع، متوسط المدة: ${avgDurMin} دقيقة. ${parseFloat(freqPerWeek) < 3 ? "زيادة التكرار إلى 3-4 جلسات أسبوعياً ستسرّع التحسين بشكل كبير." : " CONSISTENCY جيدة — حافظ على هذا التكرار لتعزيز المكاسب."} إجمالي التنبيهات: ${totalAlerts} عبر ${sessions.length} جلسة.`
    : `Session frequency: ${freqPerWeek}/week, average duration: ${avgDurMin} minutes. ${parseFloat(freqPerWeek) < 3 ? "Increasing to 3-4 sessions per week would significantly accelerate improvement." : "Good consistency — maintain this frequency to consolidate gains."} Total alerts: ${totalAlerts} across ${sessions.length} sessions.`),
].join("\n\n");

  const narLines=doc.splitTextToSize(narrative.replace(/[#*`]/g,"").trim(),cw-8);
  fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,narLines.length*5.4+12,4,"F");
  y+=8;
  font(doc,8.5,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
  narLines.forEach(l=>{ if(y>H-32){doc.addPage();_hdr(doc,W,ml,mr,"Analysis",isAr);y=22;} doc.text(l,ml+4,y); y+=5.4; });
  y+=14;

  // 8-week programme
  if(y>H-100){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الخطة":"Programme",isAr);y=22;}
  _sh(doc,ml,y,isAr?"برنامج التحسين — 8 أسابيع":"8-Week Improvement Programme",isAr?"خطة مخصصة لنتائجك":"Personalised to your results",PDF_TOKENS.success,isAr);
  y+=16;

  const highestRiskZone = avgZonal.cervical >= avgZonal.thoracic && avgZonal.cervical >= avgZonal.lumbar ? "cervical" : avgZonal.thoracic >= avgZonal.lumbar ? "thoracic" : "lumbar";
const zoneExercises = {
  cervical: isAr ? "chin tuck 3x10 + cervical rotation 2x10/ji + stretch pectoral 3x30s" : "chin tucks 3x10 + cervical rotation 2x10/side + doorway chest stretch 3x30s",
  thoracic: isAr ? "thoracic extension (foam roller) 2x60s + W-Y-T raises 3x12 + wall angels 2x10" : "thoracic extension (foam roller) 2x60s + W-Y-T raises 3x12 + wall angels 2x10",
  lumbar: isAr ? "posterior pelvic tilt 3x10 + bird-dog 3x10/ji + hip flexor stretch 3x30s/ji" : "posterior pelvic tilt 3x10 + bird-dog 3x10/side + hip flexor stretch 3x30s/side",
};
const targetZone = highestRiskZone === "cervical" ? (isAr ? "عنق الرقبة" : "neck/cervical") : highestRiskZone === "thoracic" ? (isAr ? "الصدر" : "thoracic/upper back") : (isAr ? "القطن" : "lumbar/lower back");
const programme=[
    {wk:"1-2",goal: isAr ? "Posture Awareness" : "Posture Awareness",
     action: isAr
       ? `3 sessions x 20 min daily. Focus on self-correction. Current ${targetZone} risk: ${avgZonal[highestRiskZone]}%.`
       : `3 sessions/day x 20 min. Observe alerts without forced correction. Current ${targetZone} risk: ${avgZonal[highestRiskZone]}%.`},
    {wk:"3-4",goal: isAr ? "Workstation + Exercises" : "Workstation + Exercises",
     action: isAr
       ? `Adjust monitor to eye level + chair height. Start: ${zoneExercises[highestRiskZone]}. Target: +5 pts weekly avg.`
       : `Adjust monitor to eye level + chair height. Start: ${zoneExercises[highestRiskZone]}. Target: +5pt weekly average.`},
    {wk:"5-6",goal: isAr ? "Habit Building" : "Habit Building",
     action: isAr
       ? `Continue exercises daily. Add break reminder every 30 min. Expected ${targetZone} improvement: 5-10%.`
       : `Continue exercises daily. Add break reminder every 30 min. Expected ${targetZone} improvement: 5-10%.`},
    {wk:"7-8",goal: isAr ? "Measure & Adjust" : "Consolidation & Measure",
     action: isAr
       ? `Compare avg with weeks 1-2. Target: +10 pts minimum. Reassess ${targetZone} risk zone.`
       : `Compare avg to weeks 1-2 baseline. Target: +10 points minimum. Reassess ${targetZone} risk zone.`},
  ];

  programme.forEach(({wk,goal,action},idx)=>{
    if(y>H-32){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الخطة":"Programme",isAr);y=22;}
    const ph=28;
    fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,ph,4,"F");
    dc(doc,...PDF_TOKENS.border); lw(doc,0.18); rr(doc,ml,y,cw,ph,4,"S"); lw(doc,0.3);
    // Week badge
    fc(doc,...PDF_TOKENS.primary);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
    rr(doc,ml+4,y+5,22,18,3,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    dc(doc,...PDF_TOKENS.primary); lw(doc,0.8); rr(doc,ml+4,y+5,22,18,3,"S"); lw(doc,0.3);
    font(doc,6.5,"bold",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.primary);
    doc.text("W",ml+15,y+11.5,{align:"center"});
    doc.text(wk,ml+15,y+17,{align:"center"});
    // Goal + action
    font(doc,9.5,"bold",isAr); tc(doc,...PDF_TOKENS.ink); doc.text(goal,ml+32,y+11);
    font(doc,7.5,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
    const aLines=doc.splitTextToSize(action,cw-36);
    aLines.slice(0,2).forEach((l,i)=>doc.text(l,ml+32,y+18+(i*5)));
    y+=ph+7;
  });

  // ── SESSION STATS TABLE ───────────────────────────────────
  y+=4; if(y>H-70){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الإحصائيات":"Statistics",isAr);y=22;}
  _sh(doc,ml,y,isAr?"ملخص الإحصائيات":"Summary Statistics","",PDF_TOKENS.indigo,isAr);
  y+=14;

  const stats=[
    [isAr?"إجمالي الجلسات":"Total sessions",         String(sessions.length)],
    [isAr?"المدة الإجمالية":"Total duration",         `${Math.round(sessions.reduce((a,s)=>a+(s.duration_s||s.duration_sec||0),0)/60)} ${isAr?"دقيقة":"min"}`],
    [isAr?"متوسط الدرجة (الكل)":"All-time avg score",`${avgAll}/100`],
    [isAr?"متوسط الدرجة (90 يوم)":"90-day avg score",`${avg90}/100`],
    [isAr?"إجمالي التنبيهات":"Total alerts",          String(totalAlerts)],
    [isAr?"أعلى نقطة":"Best score",                   `${best?.avg_score||0}/100 · ${_fmtDate(best?.created_at,isAr)}`],
    [isAr?"أدنى نقطة":"Worst score",                  `${worst?.avg_score||0}/100 · ${_fmtDate(worst?.created_at,isAr)}`],
    [isAr?"التغيّر الكلي":"Overall trend",             `${trendDelta>0?"+":""}${trendDelta} ${isAr?"نقطة":"pts"} · ${improved?(isAr?"تحسّن":"Improving"):declined?(isAr?"تراجع":"Declining"):(isAr?"مستقر":"Stable")}`],
  ];
  const rowH3=13;
  const th2=stats.length*rowH3+2;
  fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,th2,4,"F");
  dc(doc,...PDF_TOKENS.border); lw(doc,0.18); rr(doc,ml,y,cw,th2,4,"S"); lw(doc,0.3);
  stats.forEach(([k,v],i)=>{
    if(i%2===0){fc(doc,...PDF_TOKENS.bg); doc.rect(ml,y,cw,rowH3,"F");}
    font(doc,8.5,"normal",isAr); tc(doc,...PDF_TOKENS.muted); doc.text(k,ml+6,y+rowH3/2+1.6);
    font(doc,9,"bold",isAr); tc(doc,...PDF_TOKENS.ink); doc.text(v,ml+cw-6,y+rowH3/2+1.6,{align:"right"});
    if(i<stats.length-1){ dc(doc,...PDF_TOKENS.border); lw(doc,0.1); doc.line(ml+4,y+rowH3,ml+cw-4,y+rowH3); lw(doc,0.3); }
    y+=rowH3;
  });
  y+=12;

  // ── CLOSING HIGHLIGHT BANNER ──────────────────────────────
  // Anchors the final page and turns the summary into a clear takeaway
  // instead of a table floating in whitespace.
  const _tcol = improved?PDF_TOKENS.success:declined?PDF_TOKENS.danger:PDF_TOKENS.muted;
  const bnH=34;
  fc(doc,..._tcol); doc.setGState&&doc.setGState(new doc.GState({opacity:0.08})); rr(doc,ml,y,cw,bnH,5,"F"); doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  fc(doc,..._tcol); rr(doc,ml,y,3.2,bnH,1.6,"F");
  font(doc,8,"bold",isAr&&_cairoLoaded); tc(doc,..._tcol);
  doc.text(isAr?"الخلاصة":"KEY TAKEAWAY",ml+9,y+9);
  font(doc,11,"bold",isAr); tc(doc,...PDF_TOKENS.ink);
  const _head = improved
    ? (isAr?`تحسّن بمقدار ${trendDelta} نقطة عبر ${sessions.length} جلسة`:`Improved ${trendDelta} points across ${sessions.length} sessions`)
    : declined
    ? (isAr?`تراجع بمقدار ${Math.abs(trendDelta)} نقطة — راجع خطة التمارين`:`Down ${Math.abs(trendDelta)} points — revisit the exercise plan`)
    : (isAr?`الأداء مستقر عبر ${sessions.length} جلسة`:`Performance steady across ${sessions.length} sessions`);
  doc.text(_head,ml+9,y+19);
  font(doc,8,"normal",isAr&&_cairoLoaded); tc(doc,...PDF_TOKENS.muted);
  const _sub = isAr
    ? `متوسط 90 يوم ${avg90}/100 · التزام ${(sessions.length/Math.max(1,7)).toFixed(1)} جلسة/أسبوع · راجع بعد أسبوعين`
    : `90-day average ${avg90}/100 · ${(sessions.length/Math.max(1,7)).toFixed(1)} sessions/week · re-assess in 2 weeks`;
  doc.text(doc.splitTextToSize(_sub,cw-16)[0],ml+9,y+27);

  // ── FOOTERS ───────────────────────────────────────────────
  const tp=doc.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++){
    doc.setPage(p);
    _ftr(doc,W,ml,mr,H,p,tp,name);
  }

  const filename=`Corvus_${reportKind==="ai"?"AI_Executive":"Longitudinal"}_${now.toISOString().slice(0,10)}.pdf`;
  await doc.save(filename, {returnPromise:true});
  return filename;
}

// ── AI Executive Report — alias for Longitudinal ─────────────────
// AI Executive Report: shares its detailed trend/zone analysis pages with
// generateLongitudinalPDF (same underlying data, same computation — no need
// to duplicate that), but reportKind="ai" gives it a distinct cover title,
// filename, AND a dedicated Executive Summary section right after the KPI/
// trend banner (uses aiSummary — which was accepted as a parameter here
// long before this fix but never actually rendered anywhere — plus the
// worst-risk-zone and 3 prioritized actions) before the detailed pages.
export async function generateAIPDF({ sessions=[], profile, aiSummary="", lang="en" }) {
  return generateLongitudinalPDF({ sessions, profile, lang, aiSummary, reportKind:"ai" });
}

// ══════════════════════════════════════════════════════════════════════════════
// CORPORATE WELLNESS QUARTERLY REPORT
// Executive-grade PDF for HR — 5,000–15,000 EGP/quarter
// ══════════════════════════════════════════════════════════════════════════════
export async function generateQuarterlyWellnessReport({
  users = [], company = "", quarter = "", lang = "en",
  profile, org = null, aiExecutiveSummary = "",
}) {
  const { jsPDF } = await import("jspdf");
  const isAr = lang === "ar";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297, ml = 18, mr = 18, cw = W - ml - mr;
  const cairo = await _loadCairo(doc, isAr);
  const sf = (sz, st = "normal") => cairo && isAr ? fontAr(doc, sz, st, true) : font(doc, sz, st);

  const now = new Date();
  const nowStr = now.toLocaleDateString(isAr ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  const activeUsers = users.filter(u => (u.avg_score || 0) > 0);
  const totalU = activeUsers.length;
  const teamAvg = totalU > 0 ? Math.round(activeUsers.reduce((s, u) => s + (u.avg_score || 0), 0) / totalU) : 0;
  const atRisk = activeUsers.filter(u => (u.avg_score || 0) < 55);
  const excellent = activeUsers.filter(u => (u.avg_score || 0) >= 80);
  const moderate = activeUsers.filter(u => (u.avg_score || 0) >= 55 && (u.avg_score || 0) < 80);

  // ── Financial projection — only from the customer's own figures ───────
  //
  // This section used to print a sick-leave cost, a productivity loss and a
  // Projected ROI percentage from three constants written into this file:
  //
  //     AVG_SALARY_EGP        = 8000    a salary this app does not know
  //     SICK_DAYS_AT_RISK     = 4.2     "extra sick days per quarter", no source
  //     PRODUCTIVITY_LOSS_PCT = 0.18    18% lost output, no source
  //
  // multiplied by the count of employees whose average POSTURE SCORE is under
  // 55 — a score from an engine that has never been measured against a human
  // body with known ground truth. So the chain from an unvalidated reading to
  // a currency figure and an ROI percentage ran end to end, and the ROI was
  // the largest number on the cover.
  //
  // It was also structurally unable to look bad. The "risk" side scales with
  // headcount while B2B pricing is flat, so the percentage mostly measures how
  // many people work there:
  //
  //     30 staff, 10 flagged   ->  296%
  //     100 staff, 30 flagged  ->  324%
  //
  // A company deciding whether to buy would be acting on that number.
  //
  // Now: nothing is projected unless the organisation has entered its own
  // figures on its company document. When it has, every input is printed
  // beside the result so the reader can see whose assumption produced it.
  const _num = v => (typeof v === "number" && Number.isFinite(v) && v > 0) ? v : null;
  // "18" and "0.18" both mean eighteen percent to whoever typed it. Taken
  // literally the first inflates the whole projection a hundredfold and then
  // prints "1800% productivity loss" as the customer's own stated figure —
  // the exact failure this section was rewritten to prevent. Anything above 1
  // is read as a percentage; anything at or above 100 is not a rate at all.
  const _rate = v => {
    const n = _num(v);
    if (n === null) return null;
    if (n < 1) return n;
    if (n < 100) return n / 100;
    return null;
  };
  // The organisation's own document is the source. profile is the HR admin's
  // user record and is only a fallback for a single-tenant setup.
  const _in = k => org?.[k] ?? profile?.[k];
  const roiIn = {
    salary:   _num(_in("roi_avg_salary_egp")),
    sickDays: _num(_in("roi_sick_days_at_risk")),
    prodLoss: _rate(_in("roi_productivity_loss_pct")),
    workDays: _num(_in("roi_working_days_per_month")) ?? 22,
  };
  const roiReady = roiIn.salary !== null && roiIn.sickDays !== null && roiIn.prodLoss !== null;
  const projectedSickLeaveCost = roiReady
    ? Math.round(atRisk.length * roiIn.sickDays * (roiIn.salary / roiIn.workDays)) : null;
  const productivityLoss = roiReady
    ? Math.round(atRisk.length * roiIn.salary * roiIn.prodLoss) : null;
  const totalRisk = roiReady ? projectedSickLeaveCost + productivityLoss : null;
  // Was `totalU * 499 * 3` — treating the cost as PER-USER, at a price
  // (499 EGP) that doesn't match any real tier either (individual Pro is
  // 399 EGP/mo; the 499 figure was actually the unrelated USD Enterprise
  // "starting at $499/mo" number, reused here as an EGP per-user rate).
  // This report is for a company (B2B) account, and B2B pricing is
  // FLAT-RATE regardless of headcount (confirmed against
  // backend/config/pricing.py / App.jsx B2B_TIERS) — so the real cost is
  // just the org's actual flat monthly fee × 3, not multiplied by totalU.
  const _B2B_FLAT_EGP_MONTHLY = { b2b_starter: 2499, b2b_growth: 6999 };
  const corvusCost = Math.round((_B2B_FLAT_EGP_MONTHLY[profile?.tier] || _B2B_FLAT_EGP_MONTHLY.b2b_starter) * 3);
  const roi = (roiReady && corvusCost > 0)
    ? Math.round(((totalRisk - corvusCost) / corvusCost) * 100) : null;

  // ── COVER PAGE ────────────────────────────────────────────────────────────
  // Dark navy header block
  fc(doc, 10, 15, 30); doc.rect(0, 0, W, 80, "F");
  fc(doc, 26, 86, 219); doc.rect(0, 78, W, 2, "F");

  // Corvus logo area
  sf(11, "bold"); tc(doc, 212, 175, 55);
  doc.text("🦅  CORVUS HEALTH INTELLIGENCE", ml, 20);
  sf(7, "normal"); tc(doc, 140, 150, 170);
  doc.text(isAr ? "منصة ذكاء صحة بيئة العمل" : "Workplace Health Intelligence Platform", ml, 27);

  // Report title
  sf(20, "bold"); tc(doc, 240, 246, 255);
  doc.text(
    isAr ? "تقرير الصحة المؤسسية الربع سنوي" : "Corporate Wellness Quarterly Report",
    W / 2, 50, { align: "center" }
  );
  sf(10, "normal"); tc(doc, 212, 175, 55);
  doc.text(quarter || (isAr ? `الربع الثالث ${now.getFullYear()}` : `Q3 ${now.getFullYear()}`), W / 2, 61, { align: "center" });

  sf(8, "normal"); tc(doc, 140, 150, 170);
  doc.text(`${company || (isAr ? "المؤسسة" : "Organisation")} · ${nowStr}`, W / 2, 70, { align: "center" });

  let y = 95;

  // ── EXECUTIVE SUMMARY ──────────────────────────────────────────────────────
  sf(13, "bold"); tc(doc, 10, 15, 30);
  doc.text(isAr ? "الملخص التنفيذي" : "Executive Summary", ml, y); y += 8;

  // 4 KPI boxes
  const kpis = [
    { v: String(totalU),        l: isAr ? "إجمالي الموظفين" : "Employees Tracked", col: PDF_TOKENS.primary },
    { v: String(teamAvg),       l: isAr ? "متوسط درجة الوضعية" : "Avg Posture Score",  col: _sc(teamAvg) },
    { v: `${atRisk.length}`,    l: isAr ? "موظف في خطر" : "At-Risk Employees",       col: PDF_TOKENS.danger },
    // The fourth tile is the ROI only when the customer supplied the figures
    // behind it. Otherwise it shows something this report can actually
    // measure — how many of the tracked employees are scoring well.
    roiReady
      ? { v: `${roi}%`, l: isAr ? "العائد على الاستثمار" : "Projected ROI", col: PDF_TOKENS.success }
      : { v: String(excellent.length), l: isAr ? "موظف بدرجة ممتازة" : "Scoring Well", col: PDF_TOKENS.success },
  ];
  const bw = (cw - 9) / 4;
  kpis.forEach(({ v, l, col }, i) => {
    const kx = ml + i * (bw + 3);
    fc(doc, ...PDF_TOKENS.bg); rr(doc, kx, y, bw, 28, 3, "F");
    fc(doc, ...col); doc.setLineWidth(0.4);
    rr(doc, kx, y + 26, bw, 2, 0, "F");
    sf(17, "bold"); tc(doc, ...col);
    doc.text(v, kx + bw / 2, y + 16, { align: "center" });
    sf(6.5, "normal"); tc(doc, ...PDF_TOKENS.muted);
    doc.text(l, kx + bw / 2, y + 23, { align: "center" });
  });
  y += 38;

  // ── AI EXECUTIVE SUMMARY BOX ──────────────────────────────────────────────
  if (aiExecutiveSummary) {
    fc(doc, 17, 24, 39); rr(doc, ml, y, cw, 1, 0, "F"); // top border
    fc(doc, 26, 86, 219); rr(doc, ml, y, 3, 34, 1, "F"); // left accent
    fc(doc, 17, 24, 39); rr(doc, ml + 3, y, cw - 3, 34, 2, "F");
    sf(7, "bold"); tc(doc, 96, 165, 250);
    doc.text("🧠  " + (isAr ? "تحليل الذكاء الاصطناعي" : "AI Analysis"), ml + 7, y + 7);
    sf(6.5, "normal"); tc(doc, 180, 190, 210);
    const lines = doc.splitTextToSize(aiExecutiveSummary, cw - 14);
    doc.text(lines.slice(0, 5), ml + 7, y + 14);
    y += 42;
  }

  // ── RISK BREAKDOWN ────────────────────────────────────────────────────────
  sf(11, "bold"); tc(doc, 10, 15, 30);
  doc.text(isAr ? "تحليل المخاطر" : "Risk Analysis", ml, y); y += 7;

  const bands = [
    { label: isAr ? "ممتاز (80+)" : "Excellent (80+)",  col: PDF_TOKENS.success, count: excellent.length },
    { label: isAr ? "متوسط (55-79)" : "Good (55-79)",   col: PDF_TOKENS.warning, count: moderate.length },
    { label: isAr ? "خطر (<55)" : "At Risk (<55)",       col: PDF_TOKENS.danger,  count: atRisk.length },
  ];
  for (const { label, col, count } of bands) {
    const pct = totalU > 0 ? count / totalU : 0;
    fc(doc, ...PDF_TOKENS.bg); rr(doc, ml, y, cw, 9, 2, "F");
    fc(doc, ...col); rr(doc, ml, y, Math.max(cw * pct, 3), 9, 2, "F");
    fc(doc, ...PDF_TOKENS.bg); rr(doc, ml + cw * pct + 1, y, cw - cw * pct - 1, 9, 0, "F");
    sf(6.5, "bold"); tc(doc, 240, 246, 255);
    doc.text(`${label}  (${count} / ${Math.round(pct * 100)}%)`, ml + 3, y + 6);
    y += 12;
  }
  y += 6;

  // ── FINANCIAL IMPACT ──────────────────────────────────────────────────────
  sf(11, "bold"); tc(doc, 10, 15, 30);
  doc.text(isAr ? "التأثير المالي المتوقع" : "Projected Financial Impact", ml, y); y += 7;

  // Without the customer's own figures there is no projection to print — so
  // the section says what it needs instead of inventing it.
  if (!roiReady) {
    fc(doc, ...PDF_TOKENS.bg); rr(doc, ml, y, cw, 34, 3, "F");
    fc(doc, ...PDF_TOKENS.warning); rr(doc, ml, y, 2.5, 34, 1.2, "F");
    sf(7.5, "bold"); tc(doc, ...PDF_TOKENS.ink);
    doc.text(isAr ? "مفيش توقّع مالي في التقرير ده"
                  : "No financial projection in this report", ml + 7, y + 8);
    sf(6.3, "normal"); tc(doc, ...PDF_TOKENS.sub);
    const _need = isAr
      ? "التوقّع محتاج أرقام شركتك نفسها: متوسط الراتب الشهري، أيام المرض الإضافية المتوقعة للموظف المعرّض، ونسبة الخسارة في الإنتاجية. من غيرهم أي رقم هيكون افتراض من عندنا مش قياس من عندكم — واتشال."
      : "A projection needs your organisation's own figures: average monthly salary, the extra sick days you attribute to an at-risk employee, and the productivity loss you assign to one. Without them any currency figure would be our assumption rather than your measurement, so none is shown.";
    doc.splitTextToSize(_need, cw - 14).slice(0, 3)
      .forEach((l, i) => doc.text(l, ml + 7, y + 15 + i * 5));
    y += 42;
  } else {
  const _fmtPct = v => `${Math.round(v * 100)}%`;
  const financials = [
    [isAr ? "تكلفة الإجازات المرضية المتوقعة" : "Projected sick-leave cost", `${projectedSickLeaveCost.toLocaleString()} EGP`],
    [isAr ? "خسارة الإنتاجية المقدّرة" : "Estimated productivity loss",     `${productivityLoss.toLocaleString()} EGP`],
    [isAr ? "إجمالي الخسارة بدون Corvus" : "Total risk without Corvus",      `${totalRisk.toLocaleString()} EGP`],
    [isAr ? "تكلفة Corvus (الربع)" : "Corvus cost (quarter)",        `${corvusCost.toLocaleString()} EGP`],
    [isAr ? "العائد على الاستثمار المتوقع" : "Projected ROI",                `${roi}%`],
  ];
  financials.forEach(([k, v], i) => {
    const isLast = i === financials.length - 1;
    const isTotal = i === 2;
    fc(doc, ...(isLast ? PDF_TOKENS.successLt : isTotal ? PDF_TOKENS.dangerLt : PDF_TOKENS.bg));
    rr(doc, ml, y, cw, 9, 2, "F");
    sf(6.5, isLast || isTotal ? "bold" : "normal"); tc(doc, ...PDF_TOKENS.ink);
    doc.text(k, ml + 4, y + 6);
    tc(doc, ...(isLast ? PDF_TOKENS.success : isTotal ? PDF_TOKENS.danger : PDF_TOKENS.ink));
    doc.text(v, ml + cw - 4, y + 6, { align: "right" });
    y += 11;
  });
  // Whose assumptions these are, printed with the result rather than buried.
  sf(5.8, "italic"); tc(doc, ...PDF_TOKENS.muted);
  const _basis = isAr
    ? `محسوبة من أرقامكم: راتب ${roiIn.salary.toLocaleString()} ج.م/شهر · ${roiIn.sickDays} يوم مرض إضافي للموظف المعرّض · ${_fmtPct(roiIn.prodLoss)} خسارة إنتاجية · ${roiIn.workDays} يوم عمل/شهر · ${atRisk.length} موظف درجتهم أقل من 55.`
    : `From figures your organisation supplied: ${roiIn.salary.toLocaleString()} EGP/month salary · ${roiIn.sickDays} extra sick days per at-risk employee · ${_fmtPct(roiIn.prodLoss)} productivity loss · ${roiIn.workDays} working days/month · applied to the ${atRisk.length} employee(s) averaging under 55.`;
  doc.splitTextToSize(_basis, cw - 4).slice(0, 3).forEach((l, i) => doc.text(l, ml, y + 3 + i * 4));
  y += 4 + Math.min(3, doc.splitTextToSize(_basis, cw - 4).length) * 4;
  sf(5.8, "italic"); tc(doc, ...PDF_TOKENS.muted);
  doc.text(isAr
    ? "الخسارة بتكبر مع عدد الموظفين والتكلفة ثابتة، فالنسبة بتعكس حجم الفريق بقدر ما تعكس الوضعية."
    : "The risk side scales with headcount while the licence is flat-rate, so this percentage reflects team size as much as posture.",
    ml, y + 3);
  y += 8;
  }
  y += 8;

  // ── DEPARTMENT BREAKDOWN (if available) ───────────────────────────────────
  const depts = {};
  activeUsers.forEach(u => {
    const d = u.department || (isAr ? "غير محدد" : "General");
    if (!depts[d]) depts[d] = [];
    depts[d].push(u);
  });
  const deptList = Object.entries(depts).sort((a, b) => b[1].length - a[1].length).slice(0, 6);

  if (deptList.length > 1) {
    if (y > H - 80) { doc.addPage(); y = 22; }
    sf(11, "bold"); tc(doc, 10, 15, 30);
    doc.text(isAr ? "تفاصيل الأقسام" : "Department Breakdown", ml, y); y += 7;

    // Header row
    fc(doc, 17, 24, 39); rr(doc, ml, y, cw, 8, 2, "F");
    sf(6, "bold"); tc(doc, 140, 150, 170);
    doc.text(isAr ? "القسم" : "Department", ml + 3, y + 5.5);
    doc.text(isAr ? "الموظفون" : "Employees", ml + cw * 0.45, y + 5.5, { align: "center" });
    doc.text(isAr ? "متوسط الدرجة" : "Avg Score",  ml + cw * 0.65, y + 5.5, { align: "center" });
    doc.text(isAr ? "في خطر" : "At Risk",           ml + cw * 0.85, y + 5.5, { align: "center" });
    y += 10;

    deptList.forEach(([dept, dUsers], i) => {
      const dAvg  = Math.round(dUsers.reduce((s, u) => s + (u.avg_score || 0), 0) / dUsers.length);
      const dRisk = dUsers.filter(u => (u.avg_score || 0) < 55).length;
      fc(doc, ...(i % 2 === 0 ? PDF_TOKENS.bg : [17, 24, 39]));
      rr(doc, ml, y, cw, 8, 2, "F");
      sf(6.5, "normal"); tc(doc, ...PDF_TOKENS.ink);
      doc.text(dept, ml + 3, y + 5.5);
      doc.text(String(dUsers.length), ml + cw * 0.45, y + 5.5, { align: "center" });
      tc(doc, ..._sc(dAvg));
      doc.text(String(dAvg), ml + cw * 0.65, y + 5.5, { align: "center" });
      tc(doc, ...(dRisk > 0 ? PDF_TOKENS.danger : PDF_TOKENS.success));
      doc.text(dRisk > 0 ? String(dRisk) : "✓", ml + cw * 0.85, y + 5.5, { align: "center" });
      y += 9;
    });
    y += 8;
  }

  // ── TOP AT-RISK EMPLOYEES ────────────────────────────────────────────────
  // Names eight employees with their department and score. The company
  // dashboard suppresses exactly this under aggregate_only and this report
  // never consulted it, so the setting could be on and the quarterly PDF
  // would still hand the list over. Same switch, same default: named output
  // only where the organisation has opted in explicitly.
  const namesAllowed = org?.aggregate_only === false;
  if (atRisk.length > 0 && !namesAllowed) {
    if (y > H - 40) { doc.addPage(); y = 22; }
    fc(doc, ...PDF_TOKENS.bg); rr(doc, ml, y, cw, 22, 3, "F");
    fc(doc, ...PDF_TOKENS.muted); rr(doc, ml, y, 2.5, 22, 1.2, "F");
    sf(7.5, "bold"); tc(doc, ...PDF_TOKENS.ink);
    doc.text(isAr ? `${atRisk.length} موظف تحت 55 — مش متسمّيين هنا`
                  : `${atRisk.length} employee(s) scoring under 55 — not named here`, ml + 7, y + 8);
    sf(6.3, "normal"); tc(doc, ...PDF_TOKENS.sub);
    doc.text(isAr
      ? "المؤسسة دي مضبوطة على التقارير المجمّعة، فدرجة كل شخص بيشوفها هو بس."
      : "This organisation is configured for aggregate reporting, so each person's score is visible only to them.",
      ml + 7, y + 15, { maxWidth: cw - 14 });
    y += 30;
  }
  if (atRisk.length > 0 && namesAllowed) {
    if (y > H - 70) { doc.addPage(); y = 22; }
    sf(11, "bold"); tc(doc, 10, 15, 30);
    doc.text(isAr ? "الموظفون الأكثر عرضة للخطر" : "Highest-Risk Employees", ml, y); y += 4;
    sf(6.5, "normal"); tc(doc, ...PDF_TOKENS.muted);
    doc.text(isAr ? "يُنصح بالتدخل الفوري" : "Immediate intervention recommended", ml, y + 4); y += 10;

    atRisk.slice(0, 8).forEach((u, i) => {
      const col = _sc(u.avg_score || 0);
      fc(doc, 17, 24, 39); rr(doc, ml, y, cw, 9, 2, "F");
      fc(doc, ...col); rr(doc, ml, y, 2.5, 9, 0, "F");
      sf(6.5, "bold"); tc(doc, ...PDF_TOKENS.ink);
      doc.text(`${i + 1}. ${u.name || u.email || "Employee"}`, ml + 6, y + 6);
      sf(6.5, "normal"); tc(doc, ...PDF_TOKENS.muted);
      if (u.department) doc.text(u.department, ml + cw * 0.5, y + 6);
      tc(doc, ...col); sf(7, "bold");
      doc.text(String(u.avg_score || 0), ml + cw - 4, y + 6, { align: "right" });
      y += 10;
    });
    y += 6;
  }

  // ── RECOMMENDATIONS ───────────────────────────────────────────────────────
  if (y > H - 70) { doc.addPage(); y = 22; }
  sf(11, "bold"); tc(doc, 10, 15, 30);
  doc.text(isAr ? "التوصيات" : "Recommendations", ml, y); y += 8;

  const recs = isAr ? [
    ["🔴", "تدخل فوري",  `${atRisk.length} موظف بحاجة لتقييم إرجونوميكس فوري ودعم من Dr. Corvus AI`],
    ["🟡", "تدريب",      "جلسة إرجونوميكس جماعية لتحسين وضعية الجلوس — متاحة عبر Corvus"],
    ["🟢", "صيانة",      `الحفاظ على مستوى الـ ${excellent.length} موظف الممتاز بتحديات أسبوعية`],
    ["📊", "متابعة",     "إعادة تقييم بعد 30 يومًا وقياس التحسن مقارنةً بهذا التقرير"],
  ] : [
    ["🔴", "Immediate",  `${atRisk.length} employees need ergonomics assessment + Dr. Corvus AI coaching`],
    ["🟡", "Training",   "Group ergonomics session to improve posture habits — available via Corvus"],
    ["🟢", "Maintain",   `Preserve the ${excellent.length} excellent performers with weekly challenges`],
    ["📊", "Follow-up",  "Re-assess in 30 days and benchmark against this report"],
  ];

  recs.forEach(([icon, title, desc]) => {
    fc(doc, 17, 24, 39); rr(doc, ml, y, cw, 14, 3, "F");
    sf(8, "bold"); tc(doc, 240, 246, 255);
    doc.text(`${icon}  ${title}`, ml + 4, y + 6);
    sf(6.5, "normal"); tc(doc, 140, 150, 170);
    doc.text(desc, ml + 4, y + 11, { maxWidth: cw - 8 });
    y += 17;
  });

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const pgs = doc.getNumberOfPages();
  for (let p = 1; p <= pgs; p++) {
    doc.setPage(p);
    fc(doc, 10, 15, 30); doc.rect(0, H - 14, W, 14, "F");
    sf(5.5, "normal"); tc(doc, 140, 150, 170);
    doc.text(isAr ? "🦅 Corvus Health Intelligence · corvus.io · ليس تشخيصاً طبياً" : "🦅 Corvus Health Intelligence · corvus.io · Not a medical diagnosis", ml, H - 6);
    doc.text(isAr ? `صفحة ${p} من ${pgs}` : `Page ${p} of ${pgs}`, W - mr, H - 6, { align: "right" });
    doc.text(isAr ? "سري — للاستخدام الداخلي فقط" : "CONFIDENTIAL — Internal Use Only", W / 2, H - 6, { align: "center" });
  }

  const filename = `Corvus-Wellness-Report-${(quarter || "Q").replace(/\s/g, "-")}-${company.replace(/\s/g, "-") || "Company"}.pdf`;
  doc.save(filename);
}

// ══════════════════════════════════════════════════════════════════
// POSTURE DNA REPORT (Elite) — comprehensive quarterly individual report
// ══════════════════════════════════════════════════════════════════
// Unlike every other report in this file (single session, comparison,
// team/corporate aggregate), this looks across the user's full recent
// history to answer three things none of the others do:
//   1. Which specific pattern (not just "score") shows up most
//   2. How that compares to general reference ranges for their
//      profession — NOT a comparison to other real Corvus users (we
//      don't have reliable per-profession sample sizes for that), so
//      this is explicitly labeled as general ergonomics guidance.
//   3. A heuristic classification of whether the dominant pattern
//      looks more habit-driven (correlates with session length/fatigue)
//      or more structural/consistent (same offset regardless of
//      duration) — informational framing only, not a diagnosis.

// General reference ranges by profession category — published ergonomics
// guidance (typical office/occupational-health literature ranges), NOT a
// comparison against other Corvus users' real data.
const DNA_PROFESSION_BENCHMARKS = {
  desk_worker: {
    en: "Desk / Software work", ar: "عمل مكتبي / برمجة",
    typical_range: [58, 74], common_issues: ["fhp_index", "rounded_shoulders", "screen_distance"],
  },
  driver: {
    en: "Driving / Transport", ar: "قيادة / نقل",
    typical_range: [52, 68], common_issues: ["spine_lean", "shoulder_level", "neck_lean"],
  },
  healthcare: {
    en: "Healthcare worker", ar: "عامل رعاية صحية",
    typical_range: [55, 72], common_issues: ["trunk_lean", "shoulder_level", "rounded_shoulders"],
  },
  teacher: {
    en: "Teaching / Education", ar: "تدريس / تعليم",
    typical_range: [56, 73], common_issues: ["neck_lean", "spine_align", "fhp_index"],
  },
  retail_service: {
    en: "Retail / Customer service", ar: "مبيعات / خدمة عملاء",
    typical_range: [54, 70], common_issues: ["trunk_lean", "spine_lean", "shoulder_level"],
  },
  manual_labor: {
    en: "Manual / Physical labor", ar: "عمل يدوي / بدني",
    typical_range: [50, 68], common_issues: ["spine_align", "trunk_lean", "hip_angle"],
  },
  student: {
    en: "Student", ar: "طالب",
    typical_range: [55, 72], common_issues: ["fhp_index", "neck_lean", "screen_distance"],
  },
  other: {
    en: "General / Other", ar: "عام / أخرى",
    typical_range: [55, 72], common_issues: ["fhp_index", "rounded_shoulders", "neck_lean"],
  },
};

function _dnaAnalyze(sessions) {
  const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
  const recent = (sessions || []).filter(s => {
    const t = (s.created_at?.toDate?.() ?? new Date(s.created_at || 0)).getTime();
    return t >= cutoff && (s.avg_score || 0) > 0;
  });

  const durations = recent.map(s => s.duration_min ?? (s.duration_s || s.duration_sec || 0) / 60).filter(m => m > 0);
  const sortedDur = [...durations].sort((a, b) => a - b);
  const shortCut = sortedDur[Math.floor(sortedDur.length * 0.33)] ?? 0;
  const longCut  = sortedDur[Math.floor(sortedDur.length * 0.67)] ?? Infinity;

  // Per-metric aggregation across all recent sessions
  const byMetric = {}; // key -> { scores:[], shortScores:[], longScores:[] }
  recent.forEach(s => {
    const mins = s.duration_min ?? (s.duration_s || s.duration_sec || 0) / 60;
    const metrics = s.metrics || {};
    Object.entries(metrics).forEach(([k, v]) => {
      if (k.startsWith("_") || META_METRIC_KEYS.has(k)) return;
      const sc = typeof v === "number" ? v : (v?.score ?? null);
      if (sc == null) return;
      if (!byMetric[k]) byMetric[k] = { scores: [], shortScores: [], longScores: [] };
      byMetric[k].scores.push(sc);
      if (mins > 0 && mins <= shortCut) byMetric[k].shortScores.push(sc);
      if (mins >= longCut) byMetric[k].longScores.push(sc);
    });
  });

  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const stdev = a => {
    if (a.length < 2) return null;
    const m = avg(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
  };

  const metricStats = Object.entries(byMetric)
    .map(([k, d]) => ({
      key: k,
      avgScore: avg(d.scores),
      stdev: stdev(d.scores),
      shortAvg: avg(d.shortScores),
      longAvg: avg(d.longScores),
      n: d.scores.length,
    }))
    .filter(m => m.avgScore != null && m.n >= 2) // need at least 2 samples per metric
    .sort((a, b) => a.avgScore - b.avgScore);

  const topConcerns = metricStats.slice(0, 3);

  // Classification heuristic across the top concerns
  let fatigueSignals = 0, structuralSignals = 0, evaluated = 0;
  topConcerns.forEach(m => {
    if (m.shortAvg == null || m.longAvg == null) return;
    evaluated++;
    const drop = m.shortAvg - m.longAvg; // positive = worse when session is longer
    if (drop >= 8) fatigueSignals++;
    else if (m.stdev != null && m.stdev < 9) structuralSignals++;
  });

  let profileType = "mixed";
  if (evaluated > 0) {
    if (fatigueSignals > structuralSignals) profileType = "behavioral";
    else if (structuralSignals > fatigueSignals) profileType = "structural";
  }

  const overallAvg = avg(recent.map(s => s.avg_score));
  const totalMinutes = durations.reduce((a, b) => a + b, 0);

  return {
    recent, overallAvg, totalMinutes, sessionCount: recent.length,
    daySpan: recent.length ? Math.round((Date.now() - Math.min(...recent.map(s => (s.created_at?.toDate?.() ?? new Date(s.created_at || 0)).getTime()))) / 86400000) : 0,
    metricStats, topConcerns, profileType, evaluated,
  };
}

// Elite-only AI narrative for the Posture DNA report — a real Gemini
// (server-side, via backendAnalysisOnly -> POST /api/llm) reading of the
// *actual* computed stats (top concerns, their real avg/stdev/short-vs-
// long numbers, profile classification, profession benchmark), not a
// generic canned paragraph. Returns "" (never throws) if no genuine AI
// answer comes back, so callers can just omit the section — see
// backendAnalysisOnly's own comment for why the rule-based offline
// fallback is deliberately NOT used here.
async function _dnaAINarrative(A, bench, isAr) {
  try {
    const { backendAnalysisOnly } = await import("../localAI.js");
    const topLines = A.topConcerns.map((m, i) => {
      const lbl = (isAr ? METRIC_LABELS_AR[m.key] : METRIC_LABELS[m.key]) || m.key.replace(/_/g, " ");
      const short = m.shortAvg != null ? Math.round(m.shortAvg) : "n/a";
      const long  = m.longAvg  != null ? Math.round(m.longAvg)  : "n/a";
      const sd    = m.stdev    != null ? m.stdev.toFixed(1)     : "n/a";
      return `${i + 1}. ${lbl}: avg ${Math.round(m.avgScore)}/100 across ${m.n} sessions (stdev ${sd}; short-session avg ${short}, long-session avg ${long})`;
    }).join("\n");

    const prompt = [
      `Posture tracking data, last ${A.daySpan} days: ${A.sessionCount} sessions, ${Math.round(A.totalMinutes)} total minutes, overall avg score ${Math.round(A.overallAvg)}/100.`,
      `Computed pattern classification: ${A.profileType} (behavioral = gets worse the longer a session runs, points to fatigue/habit; structural = stays consistent regardless of session length, points to a fixed factor; mixed = not enough signal to tell).`,
      `Top 3 recurring low-scoring areas:\n${topLines}`,
      `Profession benchmark ("${isAr ? bench.ar : bench.en}"): typical healthy range ${bench.typical_range[0]}-${bench.typical_range[1]}/100.`,
      `Write a 120-180 word expert narrative for the "AI Expert Analysis" section of this person's Posture DNA report. Reference the specific numbers above — do not write generic advice that could apply to anyone. Explain what this pattern most likely means for THIS person specifically, then give exactly 2 concrete next steps tailored to their #1 concern above. Do not add medical-disclaimer language — that already appears elsewhere on the report. Confident, warm, expert clinical tone, no bullet points, no markdown.`,
    ].join("\n\n");

    const systemPrompt = "You are a senior physiotherapist writing the expert-analysis section of a premium posture report for a paying Elite-tier user. Be precise and specific to the numbers given.";

    const text = await backendAnalysisOnly(prompt, systemPrompt, 500);
    return (text || "").trim();
  } catch {
    return "";
  }
}

export async function generatePostureDNAReport({ sessions = [], profile, user, profession = "other", lang = "en" }) {
  const { jsPDF } = await import("jspdf");
  const isAr = lang === "ar";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297, ml = 18, mr = 18, cw = W - ml - mr;
  const cairo = await _loadCairo(doc, isAr);
  const sf = (sz, st = "normal") => cairo && isAr ? fontAr(doc, sz, st, true) : font(doc, sz, st);

  const A = _dnaAnalyze(sessions);
  const bench = DNA_PROFESSION_BENCHMARKS[profession] || DNA_PROFESSION_BENCHMARKS.other;
  const nowStr = new Date().toLocaleDateString(isAr ? "ar-EG" : "en-US", { year: "numeric", month: "long", day: "numeric" });

  const footer = () => {
    const pgs = doc.getNumberOfPages();
    for (let p = 1; p <= pgs; p++) {
      doc.setPage(p);
      sf(6, "normal"); tc(doc, ...PDF_TOKENS.light);
      doc.text("🦅 Corvus Health Intelligence", ml, H - 8);
      doc.text(isAr ? `صفحة ${p} من ${pgs}` : `Page ${p} of ${pgs}`, W - mr, H - 8, { align: "right" });
    }
  };

  // ── COVER ──────────────────────────────────────────────────────
  fc(doc, ...PDF_TOKENS.slate); doc.rect(0, 0, W, H, "F");
  fc(doc, 212, 175, 55); doc.rect(0, 78, W, 1.5, "F");
  sf(11, "bold"); tc(doc, 212, 175, 55);
  doc.text("🦅  CORVUS", ml, 24);
  sf(24, "bold"); tc(doc, 240, 246, 255);
  doc.text(isAr ? "تقرير بصمة الوضعية" : "Posture DNA Report", W / 2, 130, { align: "center" });
  sf(11, "normal"); tc(doc, 180, 190, 210);
  doc.text(isAr ? "تحليل شامل — آخر 90 يوم" : "Comprehensive analysis — last 90 days", W / 2, 141, { align: "center" });
  sf(9, "normal"); tc(doc, 140, 150, 170);
  doc.text(`${profile?.name || user?.email || ""} · ${nowStr}`, W / 2, 152, { align: "center" });
  sf(7, "normal"); tc(doc, 120, 130, 150);
  const disclaimerCover = isAr
    ? "أداة توعية عامة للوضعية — ليست جهازًا طبيًا وليست بديلاً عن استشارة أخصائي"
    : "General posture awareness tool — not a medical device, not a substitute for professional advice";
  doc.text(disclaimerCover, W / 2, 270, { align: "center", maxWidth: cw });

  // Not enough data — say so plainly on the cover instead of a report full
  // of unreliable numbers, and stop here.
  if (A.sessionCount < 5 || A.daySpan < 7) {
    doc.addPage();
    fc(doc, ...PDF_TOKENS.bg); doc.rect(0, 0, W, H, "F");
    sf(13, "bold"); tc(doc, ...PDF_TOKENS.ink);
    doc.text(isAr ? "مفيش بيانات كافية لسه" : "Not enough data yet", ml, 40);
    sf(9, "normal"); tc(doc, ...PDF_TOKENS.muted);
    const msg = isAr
      ? `محتاجين على الأقل 5 جلسات موزعة على أسبوع قبل ما نقدر نطلع تحليل موثوق. عندك دلوقتي ${A.sessionCount} جلسة على مدى ${A.daySpan} يوم. كمّل جلساتك وارجع قريبًا.`
      : `We need at least 5 sessions spread across one week before this analysis is meaningful. You currently have ${A.sessionCount} sessions over ${A.daySpan} days. Keep logging sessions and check back soon.`;
    doc.text(msg, ml, 52, { maxWidth: cw, lineHeightFactor: 1.6 });
    footer();
    await doc.save(`Corvus-Posture-DNA-${(profile?.name || "report").replace(/\s/g, "-")}.pdf`, {returnPromise:true});
    return;
  }

  // Fetch the AI expert narrative now (server round-trip, ~2-5s typically)
  // while there's real data to analyze — the "Analyzing your last 90 days"
  // toast shown by the caller already sets that expectation. "" if no
  // genuine AI answer came back; the render call below just skips the
  // section in that case rather than showing generic filler.
  const aiNarrative = await _dnaAINarrative(A, bench, isAr);

  // ── PAGE 2: Overview ──────────────────────────────────────────
  doc.addPage();
  fc(doc, ...PDF_TOKENS.bg); doc.rect(0, 0, W, H, "F");
  let y = 22;
  sf(15, "bold"); tc(doc, ...PDF_TOKENS.ink);
  doc.text(isAr ? "نظرة عامة" : "Overview", ml, y); y += 10;

  const ov = [
    { v: Math.round(A.overallAvg || 0), l: isAr ? "متوسط الدرجة" : "Avg Score", col: _sc(A.overallAvg || 0) },
    { v: String(A.sessionCount), l: isAr ? "عدد الجلسات" : "Sessions", col: PDF_TOKENS.primary },
    { v: `${Math.round(A.totalMinutes)}`, l: isAr ? "دقيقة متابعة" : "Minutes tracked", col: PDF_TOKENS.indigo },
    { v: `${A.daySpan}`, l: isAr ? "يوم" : "Days span", col: PDF_TOKENS.teal },
  ];
  const bw = (cw - 9) / 4;
  ov.forEach(({ v, l, col }, i) => {
    const kx = ml + i * (bw + 3);
    fc(doc, ...PDF_TOKENS.card); rr(doc, kx, y, bw, 26, 3, "F");
    dc(doc, ...PDF_TOKENS.border); doc.setLineWidth(0.3); rr(doc, kx, y, bw, 26, 3, "S");
    sf(15, "bold"); tc(doc, ...col);
    doc.text(v, kx + bw / 2, y + 14, { align: "center" });
    sf(6, "normal"); tc(doc, ...PDF_TOKENS.muted);
    doc.text(l, kx + bw / 2, y + 21, { align: "center" });
  });
  y += 38;

  // ── Pattern breakdown ─────────────────────────────────────────
  sf(13, "bold"); tc(doc, ...PDF_TOKENS.ink);
  doc.text(isAr ? "أكتر 3 أنماط ملاحظة" : "Top 3 recurring patterns", ml, y); y += 4;
  sf(7, "normal"); tc(doc, ...PDF_TOKENS.muted);
  doc.text(isAr ? "الأقل درجة = الأكتر تكرارًا كمشكلة" : "Lowest score = most frequently flagged", ml, y); y += 8;

  A.topConcerns.forEach((m, i) => {
    const lbl = (isAr ? METRIC_LABELS_AR[m.key] : METRIC_LABELS[m.key]) || m.key.replace(/_/g, " ");
    const col = _sc(m.avgScore);
    fc(doc, ...PDF_TOKENS.card); rr(doc, ml, y, cw, 16, 2, "F");
    sf(9, "bold"); tc(doc, ...PDF_TOKENS.ink);
    doc.text(`${i + 1}. ${lbl}`, ml + 5, y + 10);
    sf(11, "bold"); tc(doc, ...col);
    doc.text(String(Math.round(m.avgScore)), W - mr - 5, y + 10, { align: "right" });
    y += 19;
  });
  y += 8;

  // ── Profession benchmark ──────────────────────────────────────
  sf(13, "bold"); tc(doc, ...PDF_TOKENS.ink);
  doc.text(isAr ? "مقارنة بمعايير المهنة" : "Profession benchmark", ml, y); y += 4;
  sf(7, "normal"); tc(doc, ...PDF_TOKENS.muted);
  const benchNote = isAr
    ? `مدى مرجعي عام لمهنة "${bench.ar}" من إرشادات صحة مهنية منشورة — مش مقارنة ببيانات مستخدمين حقيقيين`
    : `General reference range for "${bench.en}" from published occupational-health guidance — not a comparison to real Corvus users`;
  doc.text(benchNote, ml, y, { maxWidth: cw }); y += 12;

  const [lo, hi] = bench.typical_range;
  const barX = ml, barW = cw, barY = y, barH = 10;
  fc(doc, ...PDF_TOKENS.borderSoft); rr(doc, barX, barY, barW, barH, 2, "F");
  const loX = barX + (lo / 100) * barW, hiX = barX + (hi / 100) * barW;
  fc(doc, ...PDF_TOKENS.primaryLt); doc.rect(loX, barY, hiX - loX, barH, "F");
  const userX = barX + (Math.min(100, Math.max(0, A.overallAvg || 0)) / 100) * barW;
  fc(doc, ...PDF_TOKENS.primaryDk); doc.circle(userX, barY + barH / 2, 2.2, "F");
  sf(6, "normal"); tc(doc, ...PDF_TOKENS.muted);
  doc.text("0", barX, barY + barH + 5); doc.text("100", barX + barW, barY + barH + 5, { align: "right" });
  doc.text(isAr ? "المدى المرجعي المعتاد" : "typical reference range", barX + (loX + hiX) / 2 - barX, barY + barH + 5, { align: "center" });
  y += 22;

  footer();

  // ── PAGE 3: Posture Profile + Recommendations ──────────────────
  doc.addPage();
  fc(doc, ...PDF_TOKENS.bg); doc.rect(0, 0, W, H, "F");
  y = 22;
  sf(15, "bold"); tc(doc, ...PDF_TOKENS.ink);
  doc.text(isAr ? "بروفايل الوضعية" : "Posture Profile", ml, y); y += 10;

  const profileCopy = {
    behavioral: {
      en: { title: "Habit-driven pattern", body: "The patterns above get noticeably worse the longer your sessions run, and don't stay consistent — that points toward fatigue and habit (how you sit as the day goes on) rather than a fixed structural issue. Good news: habit-driven patterns respond well to reminders and short breaks." },
      ar: { title: "نمط سلوكي/عادة", body: "الأنماط اللي فوق بتزيد سوءًا كل ما الجلسة طالت، ومش ثابتة — ده بيرشّح إجهاد وعادة (طريقة جلوسك مع مرور اليوم) مش مشكلة هيكلية ثابتة. الخبر الحلو: الأنماط دي بتستجيب كويس للتذكيرات والاستراحات القصيرة." },
    },
    structural: {
      en: { title: "Consistent pattern", body: "The patterns above stay fairly consistent regardless of session length — the same offset shows up whether you've been sitting 5 minutes or 50. That's more suggestive of a structural or muscular factor than a pure habit, and worth mentioning specifically if you see a physiotherapist." },
      ar: { title: "نمط ثابت/هيكلي محتمل", body: "الأنماط اللي فوق ثابتة نسبيًا بغض النظر عن مدة الجلسة — نفس الانحراف بيظهر سواء قعدت 5 دقايق أو 50. ده بيرشّح عامل هيكلي أو عضلي أكتر من عادة بحتة، ويستاهل تذكره تحديدًا لو زرت فيزيوثيرابيست." },
    },
    mixed: {
      en: { title: "Mixed pattern", body: "The data doesn't lean clearly toward either fatigue-driven or structural — likely a mix of both, or not enough signal yet to tell them apart. More sessions over time will sharpen this." },
      ar: { title: "نمط مختلط", body: "البيانات مش بتميل بوضوح لا للإجهاد ولا للعامل الهيكلي — على الأرجح مزيج من الاتنين، أو لسه مفيش إشارة كفاية نفرّق بيها. جلسات أكتر مع الوقت هتوضّح الصورة." },
    },
  };
  const pc = profileCopy[A.profileType][isAr ? "ar" : "en"];

  fc(doc, ...PDF_TOKENS.primaryLt); rr(doc, ml, y, cw, 42, 4, "F");
  sf(11, "bold"); tc(doc, ...PDF_TOKENS.primaryDk);
  doc.text(pc.title, ml + 8, y + 12);
  sf(8.5, "normal"); tc(doc, ...PDF_TOKENS.ink2);
  doc.text(pc.body, ml + 8, y + 20, { maxWidth: cw - 16, lineHeightFactor: 1.5 });
  y += 52;

  sf(7, "italic"); tc(doc, ...PDF_TOKENS.muted);
  doc.text(isAr
    ? "ملاحظة: ده تصنيف استكشافي مبني على أنماط الجلسات، مش تشخيص طبي."
    : "Note: this is an exploratory classification based on session patterns, not a medical diagnosis.", ml, y, { maxWidth: cw });
  y += 14;

  // ── AI Expert Analysis — Elite only, real Gemini reading of the actual
  //    computed stats above (see _dnaAINarrative). Omitted entirely (not
  //    a placeholder/error box) when no genuine AI answer came back, so
  //    the report degrades to exactly what it was before this feature.
  if (aiNarrative) {
    const lines = doc.splitTextToSize(aiNarrative, cw - 16);
    const boxH = lines.length * 4.6 + 10;
    if (y + boxH + 30 > H) { doc.addPage(); fc(doc, ...PDF_TOKENS.bg); doc.rect(0, 0, W, H, "F"); y = 22; }
    sf(13, "bold"); tc(doc, ...PDF_TOKENS.ink);
    doc.text(isAr ? "تحليل الخبير — AI" : "AI Expert Analysis", ml, y); y += 4;
    sf(7, "normal"); tc(doc, ...PDF_TOKENS.muted);
    doc.text(isAr ? "مبني على بياناتك الفعلية أعلاه، بواسطة Gemini" : "Generated from your actual data above, by Gemini", ml, y); y += 8;
    fc(doc, ...PDF_TOKENS.card); rr(doc, ml, y, cw, boxH, 3, "F");
    dc(doc, ...PDF_TOKENS.border); doc.setLineWidth(0.3); rr(doc, ml, y, cw, boxH, 3, "S");
    sf(8.5, "normal"); tc(doc, ...PDF_TOKENS.ink2);
    doc.text(lines, ml + 8, y + 9, { lineHeightFactor: 1.5 });
    y += boxH + 12;
    if (y + 60 > H) { doc.addPage(); fc(doc, ...PDF_TOKENS.bg); doc.rect(0, 0, W, H, "F"); y = 22; }
  }

  sf(13, "bold"); tc(doc, ...PDF_TOKENS.ink);
  doc.text(isAr ? "التوصيات" : "Recommendations", ml, y); y += 8;

  const recs = A.profileType === "behavioral"
    ? [isAr ? "خد استراحة 2-3 دقايق كل 25-30 دقيقة جلوس" : "Take a 2-3 min break every 25-30 minutes of sitting",
       isAr ? "فعّل تذكيرات الوضعية في الجلسات الطويلة تحديدًا" : "Enable posture reminders specifically for longer sessions",
       isAr ? "جرب تمارين إطالة قصيرة نص اليوم" : "Try short stretches at the midpoint of your workday"]
    : A.profileType === "structural"
    ? [isAr ? "شارك التقرير ده مع فيزيوثيرابيست في أول زيارة" : "Share this report with a physiotherapist at your first visit",
       isAr ? "راجع إعداد مكان شغلك (ارتفاع الشاشة، الكرسي)" : "Review your workstation setup (monitor height, chair)",
       isAr ? "ركّز التمارين على المنطقة المتكررة فوق" : "Focus targeted exercises on the recurring area above"]
    : [isAr ? "كمّل تسجيل الجلسات كام أسبوع كمان لصورة أوضح" : "Keep logging sessions for a few more weeks for a clearer picture",
       isAr ? "راجع إعداد مكان شغلك كخطوة عامة أولى" : "Review your workstation setup as a general first step"];
  recs.forEach(r => {
    sf(8.5, "normal"); tc(doc, ...PDF_TOKENS.ink2);
    doc.text(`•  ${r}`, ml + 2, y, { maxWidth: cw - 4 }); y += 8;
  });

  footer();
  await doc.save(`Corvus-Posture-DNA-${(profile?.name || "report").replace(/\s/g, "-")}-${new Date().toISOString().slice(0,7)}.pdf`, {returnPromise:true});
}
