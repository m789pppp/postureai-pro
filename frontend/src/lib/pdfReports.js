/**
 * pdfReports.js — Posmoz PDF Report System
 * Restored from Design System v5 (ae1b320)
 * Apple Health × Bloomberg Terminal × WHO Medical Reports
 */

import { tierAtLeast } from "./tierQuality.js";

// ── Metric labels (used in PDF tables) ───────────────────────────
const METRIC_LABELS = {
  neck_lean:"Neck Lean", neck_lean_side:"Neck Lean (Side)",
  head_tilt:"Head Tilt", head_yaw:"Head Rotation",
  shoulder:"Shoulder Balance", shoulder_level:"Shoulder Balance",
  spine_lean:"Spine Lean",
  spine_align:"Spine Alignment", fhp:"Forward Head Posture",
  fhp_index:"Forward Head Posture", fhp_side:"Forward Head (Side)",
  rounded:"Rounded Shoulders", rounded_shoulders:"Rounded Shoulders",
  elbow:"Elbow Angle", elbow_angle:"Elbow Angle",
  monitor:"Monitor Height", monitor_height:"Monitor Height",
  distance:"Viewing Distance", screen_distance:"Viewing Distance",
  trunk_lean:"Trunk Lean",
  hip_angle:"Hip Angle", knee_angle:"Knee Angle",
  // v4 engine — tier-gated clinical metrics (Professional/Elite)
  posture_stability:"Posture Stability", symmetry_index:"L/R Symmetry",
  cervical_load:"Cervical Spine Load", ergo_rula:"RULA Ergonomic Risk",
};
const METRIC_LABELS_AR = {
  neck_lean:"ميل الرقبة", neck_lean_side:"ميل الرقبة (جانبي)",
  head_tilt:"انحناء الرأس", head_yaw:"دوران الرأس",
  shoulder:"توازن الكتفين", shoulder_level:"توازن الكتفين",
  spine_lean:"ميل العمود الفقري",
  spine_align:"محاذاة العمود الفقري", fhp:"تقدم الرأس للأمام",
  fhp_index:"تقدم الرأس للأمام", fhp_side:"تقدم الرأس (جانبي)",
  rounded:"تقوس الأكتاف", rounded_shoulders:"تقوس الأكتاف",
  elbow:"زاوية الكوع", elbow_angle:"زاوية الكوع",
  monitor:"ارتفاع الشاشة", monitor_height:"ارتفاع الشاشة",
  distance:"مسافة المشاهدة", screen_distance:"مسافة المشاهدة",
  trunk_lean:"ميل الجذع",
  hip_angle:"زاوية الورك", knee_angle:"زاوية الركبة",
  // v4 engine — tier-gated clinical metrics (Professional/Elite)
  posture_stability:"ثبات الوضعية", symmetry_index:"التماثل الجانبي",
  cervical_load:"حمل الفقرات العنقية", ergo_rula:"مؤشر RULA للمخاطر",
};

// Engine keys that are informational, not posture metrics — never
// rank them as "worst metrics" or feed them into recommendations.
const NON_POSTURE_KEYS = new Set(["session_fatigue","confidence_val"]);


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
// POSMOZ PDF DESIGN SYSTEM v5 — World-Class Medical Intelligence
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
function _riskLabel(v,ar){ return v>=70?(ar?"عالي":"High"):v>=40?(ar?"متوسط":"Moderate"):(ar?"منخفض":"Low"); }
function _riskColor(v){ return v>=70?PDF_TOKENS.danger:v>=40?PDF_TOKENS.warning:PDF_TOKENS.success; }
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

// ── Font helper ────────────────────────────────────────────────────
let _cairoLoaded=false, _cairoCachedB64=null;
async function _ensureCairoFont(doc){
  try{
    if(!_cairoCachedB64){const{CAIRO_B64}=await import("../assets/cairoFont.js");_cairoCachedB64=CAIRO_B64;}
    doc.addFileToVFS("Cairo-Regular.ttf",_cairoCachedB64);
    doc.addFont("Cairo-Regular.ttf","cairo","normal");
    doc.addFileToVFS("Cairo-Bold.ttf",_cairoCachedB64);
    doc.addFont("Cairo-Bold.ttf","cairo","bold");
    _cairoLoaded=true;
  }catch(e){console.warn("Cairo font failed:",e?.message||e);}
}
async function _loadCairo(doc){await _ensureCairoFont(doc);return _cairoLoaded;}

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
  try{const{LOGO_SM_B64,LOGO_MD_B64,LOGO_LG_B64}=await import("../assets/posmozLogo.js");
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
// Alias-aware: the engine emits shoulder_level / fhp_index /
// rounded_shoulders etc. Risk = 100 − mean(scores of PRESENT metrics);
// missing metrics are skipped instead of counting as a perfect 100.
const _ZONE_KEYS = {
  cervical: ["neck_lean","neck_lean_side","head_tilt","head_yaw","fhp","fhp_index","fhp_side"],
  thoracic: ["shoulder","shoulder_level","rounded","rounded_shoulders","spine_lean"],
  lumbar:   ["spine_align","hip_angle","trunk_lean"],
};
function _zonalRisk(metrics){
  const out={cervical:0,thoracic:0,lumbar:0};
  if(!metrics) return out;
  const sc=k=>{
    const v=metrics[k];
    if(v==null) return null;
    if(typeof v==="number") return v;
    return typeof v?.score==="number"?v.score:null;
  };
  for(const zone in _ZONE_KEYS){
    const scores=_ZONE_KEYS[zone].map(sc).filter(s=>s!=null);
    if(scores.length)
      out[zone]=Math.max(0,Math.round(100-Math.min(100,scores.reduce((a,b)=>a+b,0)/scores.length)));
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
  font(doc,13.5,"bold");tc(doc,...PDF_TOKENS.card);doc.text("POSMOZ",ml+36,30);
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
  font(doc,7.5,"bold");tc(doc,...PDF_TOKENS.card);doc.text(label,W-ml,37,{align:"right"});
  if(sub){font(doc,6.5,"normal");tc(doc,130,148,180);doc.text(sub,W-ml,45,{align:"right"});}
  // Bottom divider
  fc(doc,...tierCol);doc.rect(0,73.5,W,2.5,"F");
}

// ── INNER PAGE HEADER ──────────────────────────────────────────────
function _hdr(doc,W,ml,mr,label,isAr){
  fc(doc,...PDF_TOKENS.bg);doc.rect(0,0,W,15,"F");
  fc(doc,...PDF_TOKENS.primary);doc.rect(0,15,W,.35,"F");
  _logo(doc,ml,3.5,8,_logoSm);
  font(doc,7.5,"bold");tc(doc,...PDF_TOKENS.ink2);doc.text("Posmoz",ml+12,10);
  font(doc,6.5,"normal");tc(doc,...PDF_TOKENS.muted);doc.text("Health Intelligence",ml+28,10);
  font(doc,7,"bold");tc(doc,...PDF_TOKENS.primary);doc.text(label,W-mr,10,{align:"right"});
}

// ── FOOTER ─────────────────────────────────────────────────────────
function _ftr(doc,W,ml,mr,H,p,total,name){
  hr(doc,0,H-10,W,PDF_TOKENS.border);
  fc(doc,...PDF_TOKENS.bg);doc.rect(0,H-9.5,W,9.5,"F");
  font(doc,PDF_FLAGS.micro,"normal");tc(doc,...PDF_TOKENS.ghost);
  doc.text("Posmoz Health Intelligence · Confidential · Not a medical diagnosis",ml,H-3.5);
  font(doc,PDF_FLAGS.micro,"bold");tc(doc,...PDF_TOKENS.muted);
  doc.text(name,W/2,H-3.5,{align:"center"});
  doc.text(`${p} / ${total}`,W-mr,H-3.5,{align:"right"});
}

// ── SECTION HEADING with left accent ─────────────────────────────
function _sh(doc,ml,y,title,sub="",col=PDF_TOKENS.primary,isAr=false){
  fc(doc,...col);doc.rect(ml,y,2.2,sub?14:9.5,"F");
  font(doc,PDF_FLAGS.h2,"bold",isAr);tc(doc,...PDF_TOKENS.ink);doc.text(title,ml+7,y+(sub?7:7));
  if(sub){font(doc,PDF_FLAGS.small,"normal",isAr);tc(doc,...PDF_TOKENS.light);doc.text(sub,ml+7,y+13);}
  return y+(sub?21:14);
}

// ── Arc segment (polyline approximation, 12 o'clock start, clockwise)
function _arc(doc,cx,cy,r,frac,col,w=3.5){
  const f=Math.max(0,Math.min(1,frac));
  if(f<=0)return;
  const steps=Math.max(6,Math.round(72*f)), start=-Math.PI/2;
  dc(doc,...col); lw(doc,w);
  let px=cx+r*Math.cos(start), py=cy+r*Math.sin(start);
  for(let i=1;i<=steps;i++){
    const a=start+f*2*Math.PI*(i/steps);
    const nx=cx+r*Math.cos(a), ny=cy+r*Math.sin(a);
    doc.line(px,py,nx,ny); px=nx; py=ny;
  }
  lw(doc,0.3);
}

// ── SCORE RING v5 — with inner glow simulation ─────────────────────
function _ring(doc,cx,cy,r,score,isAr,showGrade=true){
  const col=_sc(score),lbl=_sl(score,isAr);
  // Outer track
  dc(doc,...PDF_TOKENS.borderSoft);lw(doc,3.5);doc.circle(cx,cy,r,"S");lw(doc,0.3);
  // Inner tint
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.06}));
  doc.circle(cx,cy,r-2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Score arc — proportional to score (was a full circle for any score)
  _arc(doc,cx,cy,r,score/100,col,3.5);
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
  font(doc,9,"bold",isAr);tc(doc,...PDF_TOKENS.ink);doc.text(lbl,x+27,y+9.5);
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
  doc.text(String(val),x+w/2,y+h*.56,{align:"center"});
  // Label
  font(doc,PDF_FLAGS.small,"bold");tc(doc,...PDF_TOKENS.muted);
  doc.text(label,x+w/2,y+h*.78,{align:"center"});
  if(sub){font(doc,PDF_FLAGS.micro,"normal");tc(doc,...PDF_TOKENS.light);doc.text(sub,x+w/2,y+h*.9,{align:"center"});}
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
  font(doc,10,"bold",isAr);tc(doc,...PDF_TOKENS.ink);doc.text(title,x+30,y+12);
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
    doc.text(doc.splitTextToSize(s,w-40)[0],x+36,y+22+(i*7));
  });
  return y+h+8;
}

// ── ZONE CARD v5 ─────────────────────────────────────────────────
function _zone(doc,x,y,w,name,region,risk,desc,mlist,isAr){
  const col=_riskColor(risk);
  const lines=doc.splitTextToSize(desc,w-50);
  const h=Math.max(48,lines.length*5+34);
  fc(doc,...PDF_TOKENS.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...col);lw(doc,0.25);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  // Risk badge
  fc(doc,...col);doc.circle(x+18,y+h/2,11,"F");
  font(doc,9.5,"bold");tc(doc,...PDF_TOKENS.card);doc.text(`${risk}%`,x+18,y+h/2+3.5,{align:"center"});
  // Title
  font(doc,10,"bold",isAr);tc(doc,...PDF_TOKENS.ink);doc.text(name,x+35,y+12);
  font(doc,7.5,"bold");tc(doc,...PDF_TOKENS.primary);doc.text(region,x+35,y+19);
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

// ══════════════════════════════════════════════════════════════════
// DARK PREMIUM KIT — shared by Comparison / Longitudinal / Team PDFs
// Mirrors the Elite session report's visual language exactly, so every
// report the user downloads feels like one product family.
// ══════════════════════════════════════════════════════════════════
const DK = {
  BG:[10,15,30], BG2:[16,23,45], CARD:[20,28,55], CARD2:[26,36,68],
  BORDER:[40,55,95], TEXT:[255,255,255], TEXT2:[148,163,200], TEXT3:[80,100,145],
  blue:[59,130,246], green:[34,197,94], amber:[245,158,11], red:[239,68,68],
  violet:[139,92,246], cyan:[6,182,212],
};
const _dkSc = s => s>=80?DK.green:s>=60?DK.amber:DK.red;
const _riskColorDk = v => v>=70?DK.red:v>=40?DK.amber:DK.green;

function _dkPage(doc,W,H){ fc(doc,...DK.BG); doc.rect(0,0,W,H,"F"); }

function _dkCard(doc,x,y,w,h,r=6,col=DK.CARD){
  fc(doc,...col); rr(doc,x,y,w,h,r,"F");
  dc(doc,...DK.BORDER);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
  lw(doc,.3); rr(doc,x,y,w,h,r,"S");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
}

// Full header band (page 1) — identical proportions to the Elite report
function _dkHeader(doc,W,ml,mr,sf,title,sub,badge,badgeCol,rightTxt){
  fc(doc,...DK.BG2); doc.rect(0,0,W,22,"F");
  _logo(doc,ml,5,12,_logoSm);
  sf(8.5,"bold");  tc(doc,...DK.TEXT);  doc.text("POSMOZ",ml+16,11.5);
  sf(5.5,"normal");tc(doc,...DK.TEXT2); doc.text("HEALTH INTELLIGENCE",ml+16,16.5);
  sf(9,"bold");    tc(doc,...DK.TEXT);  doc.text(title,60,10);
  sf(6,"normal");  tc(doc,...DK.TEXT3); doc.text(sub,60,16);
  if(badge){
    const bw=doc.getTextWidth(badge)+10;
    fc(doc,...badgeCol);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.18}));
    rr(doc,W-mr-bw,4,bw,14,3,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    dc(doc,...badgeCol); lw(doc,.5); rr(doc,W-mr-bw,4,bw,14,3,"S"); lw(doc,.3);
    sf(7,"bold"); tc(doc,...badgeCol); doc.text(badge,W-mr-bw/2,13,{align:"center"});
  }
  if(rightTxt){ sf(6,"normal"); tc(doc,...DK.TEXT3); doc.text(rightTxt,W-mr,20,{align:"right"}); }
  fc(doc,...DK.BORDER); doc.rect(0,22,W,.5,"F");
}

// Slim header band (pages 2+)
function _dkSub(doc,W,ml,mr,sf,rightTxt){
  fc(doc,...DK.BG2); doc.rect(0,0,W,15,"F");
  _logo(doc,ml,3,9,_logoSm);
  sf(7.5,"bold");  tc(doc,...DK.TEXT);  doc.text("POSMOZ",ml+13,8);
  sf(4.5,"normal");tc(doc,...DK.TEXT2); doc.text("HEALTH INTELLIGENCE",ml+13,13);
  if(rightTxt){ sf(6,"normal"); tc(doc,...DK.TEXT3); doc.text(rightTxt,W-mr,10,{align:"right"}); }
  fc(doc,...DK.BORDER); doc.rect(0,15,W,.5,"F");
}

function _dkFooter(doc,W,ml,mr,H,sf,p,tp){
  fc(doc,...DK.BORDER);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
  doc.rect(ml,H-9,W-ml-mr,.3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  sf(5.5,"normal"); tc(doc,...DK.TEXT3);
  doc.text("Posmoz Health Intelligence — Confidential · Not a medical diagnosis",ml,H-4.5);
  doc.text(`${p} / ${tp}`,W-mr,H-4.5,{align:"right"});
}

function _dkSection(doc,sf,ml,y,txt){
  sf(7,"bold"); tc(doc,...DK.TEXT); doc.text(txt,ml,y+5);
  return y+9;
}

// Score ring with proportional arc on dark
function _dkRing(doc,sf,cx,cy,r,score){
  const col=_dkSc(score);
  dc(doc,...DK.BORDER); lw(doc,4); doc.circle(cx,cy,r,"S"); lw(doc,.3);
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.08}));
  doc.circle(cx,cy,r-2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  _arc(doc,cx,cy,r,score/100,col,4);
  sf(r>=18?16:12,"bold"); tc(doc,...col); doc.text(String(score),cx,cy+3,{align:"center"});
  sf(5,"normal"); tc(doc,...DK.TEXT3); doc.text("/100",cx,cy+8.5,{align:"center"});
}

function _dkKpi(doc,sf,x,y,w,h,label,val,col){
  _dkCard(doc,x,y,w,h,5,DK.CARD2);
  fc(doc,...col); rr(doc,x,y,w,2.5,1.5,"F"); doc.rect(x,y+1.2,w,1.3,"F");
  sf(11,"bold"); tc(doc,...DK.TEXT);  doc.text(String(val),x+w/2,y+h*.55,{align:"center"});
  sf(5.5,"bold");tc(doc,...DK.TEXT3); doc.text(label,x+w/2,y+h*.8,{align:"center"});
}

// Area line chart on dark background. Returns plotted points.
function _dkChart(doc,sf,vals,x,y,w,h,col,opts={}){
  if(!vals||vals.length<2) return null;
  const lo=opts.lo??Math.max(0,Math.min(...vals)-5);
  const hi=opts.hi??Math.min(100,Math.max(...vals)+5);
  const rng=Math.max(hi-lo,10);
  if(!opts.noGrid){
    [40,60,80].forEach(v=>{
      if(v<lo||v>hi)return;
      const gy=y+h-((v-lo)/rng)*h;
      fc(doc,...DK.BORDER);
      doc.setGState&&doc.setGState(new doc.GState({opacity:.35}));
      doc.rect(x,gy,w,.2,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      sf(4.5,"normal"); tc(doc,...DK.TEXT3); doc.text(String(v),x-2,gy+1.5,{align:"right"});
    });
  }
  const pts=vals.map((s,i)=>({px:x+(i/(vals.length-1))*w,py:y+h-((Math.max(lo,Math.min(hi,s))-lo)/rng)*h}));
  try{
    const segs=pts.slice(1).map((p,i)=>[p.px-pts[i].px,p.py-pts[i].py]);
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
    doc.lines([...segs,[0,y+h-pts[pts.length-1].py],[-(pts[pts.length-1].px-pts[0].px),0]],pts[0].px,pts[0].py,[1,1],"F",false);
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  }catch{}
  dc(doc,...col); lw(doc,1.2);
  pts.forEach((p,i)=>{if(i>0)doc.line(pts[i-1].px,pts[i-1].py,p.px,p.py);}); lw(doc,.3);
  if(!opts.noDots) pts.forEach(p=>{fc(doc,...col);doc.circle(p.px,p.py,1.2,"F");});
  return pts;
}

// Horizontal comparison bar (label + two bars) for zone/metric compares
function _dkDualBar(doc,sf,x,y,w,label,v1,v2,c1,c2,unit="%"){
  sf(6.5,"bold"); tc(doc,...DK.TEXT); doc.text(label,x,y+3);
  const bx=x+46, bw=w-46-24, bh=3.4;
  fc(doc,...DK.BORDER); doc.setGState&&doc.setGState(new doc.GState({opacity:.5}));
  rr(doc,bx,y,bw,bh,1.5,"F"); rr(doc,bx,y+5,bw,bh,1.5,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  fc(doc,...c1); rr(doc,bx,y,Math.max(bw*(Math.min(v1,100)/100),2),bh,1.5,"F");
  fc(doc,...c2); rr(doc,bx,y+5,Math.max(bw*(Math.min(v2,100)/100),2),bh,1.5,"F");
  sf(6,"bold"); tc(doc,...c1); doc.text(`${v1}${unit}`,bx+bw+3,y+3);
  tc(doc,...c2); doc.text(`${v2}${unit}`,bx+bw+3,y+8);
  return y+13;
}




export async function generateSessionPDF({ session, profile, user, lang="en", sessionIndex, allSessions=[], aiSummary="" }) {
  const { jsPDF } = await import("jspdf");
  const isAr   = lang === "ar";
  const _rawTier = profile?.tier || session?.tier || "standard";
  // Normalize aliases: personal_elite/b2b_enterprise → elite, personal_pro/b2b_growth → professional
  const tier     = _rawTier.includes("elite")||_rawTier==="enterprise"||_rawTier==="premium"?"elite"
                 : _rawTier.includes("pro")||_rawTier.includes("professional")||_rawTier==="growth"?"professional"
                 : _rawTier;
  const isElite= tierAtLeast(tier,"elite");
  const isPro  = !isElite && tierAtLeast(tier,"professional");
  console.log("[PDF] tier detection:", {_rawTier, tier, isElite, isPro});
  const doc    = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  await Promise.all([_ensureCairoFont(doc), _ensureLogo()]);

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
    .filter(([k])=>!k.startsWith("_")&&!NON_POSTURE_KEYS.has(k)&&metrics[k])
    .map(([k,v])=>{
      const sc=typeof v==="number"?v:(v?.score??100);
      const lbl=(isAr?METRIC_LABELS_AR[k]:METRIC_LABELS[k])||k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      const val=v?.value, unit=v?.unit||"";
      const pri=sc<40?"High Priority":sc<65?"Medium Priority":"Low Priority";
      const priC=sc<40?[239,68,68]:sc<65?[245,158,11]:[34,197,94];
      return{k,sc,lbl,val,unit,pri,priC};
    }).sort((a,b)=>a.sc-b.sc);

  // ── DARK THEME COLORS ─────────────────────────────────────────
  const BG     = [10,15,30];    // #0a0f1e
  const BG2    = [16,23,45];    // #10172d
  const CARD   = [20,28,55];    // #141c37
  const CARD2  = [26,36,68];    // #1a2444
  const BORDER = [40,55,95];    // #28375f
  const TEXT   = [255,255,255];
  const TEXT2  = [148,163,200]; // #94a3c8
  const TEXT3  = [80,100,145];  // muted

  // ── HELPER: dark rounded card ──────────────────────────────────
  const dCard = (x,y,w,h,r=6,col=CARD) => {
    fc(doc,...col); rr(doc,x,y,w,h,r,"F");
    fc(doc,...BORDER);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
    rr(doc,x,y,w,h,r,"S");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
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
    fc(doc,...BG2); doc.rect(0,0,W,22,"F");
    _logo(doc,ml,5,12,_logoSm);
    sf(8.5,"bold"); tc(doc,...TEXT); doc.text("POSMOZ",ml+16,11.5);
    sf(5.5,"normal"); tc(doc,...TEXT2); doc.text("HEALTH INTELLIGENCE",ml+16,16.5);
    sf(9,"bold"); tc(doc,...TEXT); doc.text(isAr?"تقرير تحليل الوضعية الشخصي":"Personal Posture Analysis Report",60,10);
    sf(6,"normal"); tc(doc,...TEXT3); doc.text("AI-POWERED POSTURE INSIGHTS",60,16);
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
    doc.text(`Generated: ${dateStr}`,W-mr,20,{align:"right"});
    // Bottom border line
    fc(doc,...BORDER); doc.rect(0,22,W,.5,"F");
    let y=28;

    // ── ROW 1: Score ring (left) + KPIs (center) + Info card (right) ──
    const scoreW=60, kpiW=85, infoW=cw-scoreW-kpiW-8;
    const row1H=78;

    // Score card
    dCard(ml,y,scoreW,row1H);
    sf(6.5,"bold"); tc(doc,...TEXT3); doc.text("OVERALL POSTURE SCORE",ml+scoreW/2,y+7,{align:"center"});
    // Score ring
    const cx=ml+scoreW/2, cy=y+42, r1=22;
    dc(doc,...BORDER); lw(doc,5); doc.circle(cx,cy,r1,"S");
    // Colored arc (simulate with layered circles)
    dc(doc,...gradeC); lw(doc,5); doc.circle(cx,cy,r1,"S"); lw(doc,.3);
    fc(doc,...gradeC);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.08}));
    doc.circle(cx,cy,r1-2,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(20,"bold"); tc(doc,...gradeC); doc.text(String(avg),cx,cy+3.5,{align:"center"});
    sf(6.5,"normal"); tc(doc,...TEXT3); doc.text("/100",cx,cy+10,{align:"center"});
    sf(9,"bold"); tc(doc,...gradeC); doc.text(gradeL,cx,cy+r1+9,{align:"center"});
    // Insight
    if(aiText||painSum){
      const tip=(painSum||aiText).split('.')[0]+'.';
      const tipLines=doc.splitTextToSize(tip,scoreW-8);
      sf(5.5,"normal"); tc(doc,...TEXT2);
      tipLines.slice(0,2).forEach((l,i)=>doc.text(l,ml+4,y+row1H-12+i*5.5));
    }

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
      // Icon circle
      fc(doc,...col);
      doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
      doc.circle(kx2+10,ky2+10,8,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      sf(8,"normal"); tc(doc,...col); doc.text(icon,kx2+10,ky2+13.5,{align:"center"});
      sf(11,"bold"); tc(doc,...TEXT); doc.text(String(val),kx2+kw/2,ky2+kh*.6,{align:"center"});
      sf(5.5,"bold"); tc(doc,...TEXT3); doc.text(label,kx2+kw/2,ky2+kh*.82,{align:"center"});
    });

    // Info card (right)
    const ix=kx+kpiW+4;
    dCard(ix,y,infoW,row1H);
    sf(6,"bold"); tc(doc,...TEXT3); doc.text("YOUR INFORMATION",ix+4,y+7);
    [
      ["👤",isAr?"الاسم":"Name",name],
      ["✉",isAr?"البريد":"Email",email.length>22?email.slice(0,22)+"…":email],
      ["🏢",isAr?"الشركة":"Company",company||"—"],
      ["🔑","ID",`local_${session.id?.slice(-8)||Math.random().toString(36).slice(-8)}`],
    ].forEach(([icon,lbl,val],i)=>{
      const ry=y+16+i*14;
      sf(5.5,"normal"); tc(doc,...TEXT3);
      doc.text(icon+" "+lbl,ix+4,ry);
      sf(6,"bold"); tc(doc,...TEXT);
      doc.text(String(val),ix+4,ry+6.5);
      if(i<3){ fc(doc,...BORDER); doc.rect(ix+4,ry+9,infoW-8,.3,"F"); }
    });
    y+=row1H+5;

    // ── SCORE TIMELINE ─────────────────────────────────────────
    dCard(ml,y,cw,46);
    sf(6.5,"bold"); tc(doc,...TEXT3); doc.text("SCORE TIMELINE",ml+4,y+7);
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
      const tipLines=doc.splitTextToSize("💡  "+(aiText.split('.')[0]+'.'),cw-12);
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
      const mx=ml+i*(mw+5);
      const mh=38;
      dCard(mx,y,mw,mh,5);
      // Priority icon
      const iconC=sc<40?[239,68,68]:sc<65?[245,158,11]:[34,197,94];
      fc(doc,...iconC);
      doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
      rr(doc,mx+4,y+5,12,12,3,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      sf(7,"bold"); tc(doc,...iconC); doc.text(sc<40?"↑":sc<65?"→":"✓",mx+10,y+13.5,{align:"center"});
      // Metric name + value
      sf(8,"bold"); tc(doc,...TEXT); doc.text(lbl,mx+20,y+10);
      if(val!==undefined){
        sf(6.5,"normal"); tc(doc,...TEXT2); doc.text(`${Math.round(val*10)/10}${unit}`,mx+20,y+17);
      }
      // Priority badge
      const pw=doc.getTextWidth(pri)+8;
      fc(doc,...iconC);
      doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
      rr(doc,mx+4,y+mh-11,pw,8,2,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      sf(5.5,"bold"); tc(doc,...iconC); doc.text(pri,mx+4+pw/2,y+mh-5.5,{align:"center"});
      // Score ring (right side)
      const rind=mx+mw-16, rcy=y+mh/2;
      dc(doc,...BORDER); lw(doc,3); doc.circle(rind,rcy,10,"S");
      dc(doc,...iconC); lw(doc,3); doc.circle(rind,rcy,10,"S"); lw(doc,.3);
      sf(7.5,"bold"); tc(doc,...iconC); doc.text(String(Math.round(sc)),rind,rcy+2.5,{align:"center"});
      sf(4.5,"normal"); tc(doc,...TEXT3); doc.text("/100",rind,rcy+7.5,{align:"center"});
    });
    y+=mEntries.slice(0,3).length>0?45:0;

    // ── FOOTER ────────────────────────────────────────────────
    fc(doc,...BORDER);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
    doc.rect(ml,H-9,cw,.3,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(5.5,"normal"); tc(doc,...TEXT3);
    doc.text("Posmoz Health Intelligence — Confidential",ml,H-4.5);
    doc.text("1 / 2",W-mr,H-4.5,{align:"right"});

    // ══════════════════════════════════════════════════════════
    // PAGE 2
    // ══════════════════════════════════════════════════════════
    doc.addPage();
    fc(doc,...BG); doc.rect(0,0,W,H,"F");
    fc(doc,...BG2); doc.rect(0,0,W,15,"F");
    _logo(doc,ml,3,9,_logoSm);
    sf(7.5,"bold"); tc(doc,...TEXT); doc.text("POSMOZ",ml+13,8);
    sf(4.5,"normal"); tc(doc,...TEXT2); doc.text("HEALTH INTELLIGENCE",ml+13,13);
    sf(6,"normal"); tc(doc,...TEXT3);
    doc.text(`Session #${realIdx}  •  ${dayStr}, ${timeStr}`,W-mr,10,{align:"right"});
    fc(doc,...BORDER); doc.rect(0,15,W,.5,"F");
    y=22;

    // Row: Radar chart (left) + Insights (center) + Summary (right)
    const radarW=60, insW=75, sumW=cw-radarW-insW-8;
    const rowH=100;

    // Radar chart card (simplified polygon)
    dCard(ml,y,radarW,rowH);
    sf(6,"bold"); tc(doc,...TEXT3); doc.text("POSTURE OVERVIEW",ml+4,y+6);
    const rcx=ml+radarW/2, rcy2=y+rowH/2+6, rad=22;
    const labels2=["Neck\nAlign.","Shoulder\nPosition","Spine\nAlign.","Sitting\nBalance","Screen\nErgonomics"];
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
    const metKeys=["neck_lean","shoulder","spine_align","hip_angle","distance"];
    const userScores=metKeys.map(k=>typeof metrics[k]==="number"?metrics[k]:(metrics[k]?.score??70));
    const uPts=angles.map((a,i)=>({x:rcx+Math.cos(a)*rad*(userScores[i]/100),y:rcy2+Math.sin(a)*rad*(userScores[i]/100)}));
    fc(doc,37,99,235);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.25}));
    const uSegs=uPts.slice(1).map((p,i)=>[p.x-uPts[i].x,p.y-uPts[i].y]);
    try{doc.lines([...uSegs,[uPts[0].x-uPts[uPts.length-1].x,uPts[0].y-uPts[uPts.length-1].y]],uPts[0].x,uPts[0].y,[1,1],"F",false);}catch{}
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    dc(doc,37,99,235); lw(doc,.8);
    try{doc.lines([...uSegs,[uPts[0].x-uPts[uPts.length-1].x,uPts[0].y-uPts[uPts.length-1].y]],uPts[0].x,uPts[0].y,[1,1],"S",false);}catch{}
    lw(doc,.3);
    uPts.forEach(p=>{fc(doc,37,99,235);doc.circle(p.x,p.y,1.5,"F");});
    // Labels
    angles.forEach((a,i)=>{
      const lx=rcx+Math.cos(a)*(rad+7),ly=rcy2+Math.sin(a)*(rad+7);
      sf(4.5,"normal"); tc(doc,...TEXT3);
      doc.text(labels2[i].replace('\n',' '),lx,ly,{align:"center"});
    });
    // Legend
    sf(5,"normal"); tc(doc,37,99,235); doc.text("— You",ml+4,y+rowH-7);
    tc(doc,...TEXT3); doc.text("  - - Optimal Range",ml+4,y+rowH-2.5);

    // Insights card (center)
    const inx=ml+radarW+4;
    dCard(inx,y,insW,rowH);
    sf(6,"bold"); tc(doc,...TEXT3); doc.text("POSTURE INSIGHTS",inx+4,y+6);
    const insights=mEntries.slice(0,3).map(({lbl,sc,val,unit})=>({
      icon:sc<40?"🔴":sc<65?"🟡":"🟢",
      text:`Your ${lbl.toLowerCase()} ${sc<60?"needs attention.":"is acceptable."}${val!==undefined?` ${Math.round(val*10)/10}${unit}`:""}`,
      detail:sc<40?"High priority — address immediately.":sc<65?"Moderate — monitor and improve.":"Looking good — maintain this.",
      col:sc<40?[239,68,68]:sc<65?[245,158,11]:[34,197,94],
    }));
    insights.forEach(({icon,text,detail,col},i)=>{
      const iy=y+12+i*28;
      fc(doc,...col);
      doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
      doc.circle(inx+10,iy+7,8,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      sf(9,"normal"); tc(doc,...col); doc.text(icon,inx+10,iy+10.5,{align:"center"});
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
    sf(6,"bold"); tc(doc,...TEXT3); doc.text("SESSION SUMMARY",sx+4,y+6);
    const sumRows=[
      ["Overall Score",`${avg}/100`,gradeC],
      ["Good Posture",`${goodPct}%`,[34,197,94]],
      ["Alerts",String(alerts),[245,158,11]],
      ["Duration",fmtDurShort(dur),[99,102,241]],
      ["Session",`#${realIdx}`,[99,102,241]],
      ["Date",dayStr.split(',')[0],[148,163,200]],
      ["Time",timeStr,[148,163,200]],
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
    sf(18,"bold"); tc(doc,...tierCol); doc.text("♛",ml+23,y+32,{align:"center"});
    sf(10,"bold"); tc(doc,...TEXT); doc.text(isAr?"رقّي لـ Elite":"Upgrade to Elite",ml+50,y+18);
    sf(7,"normal"); tc(doc,...TEXT2); doc.text(isAr?"افتح تحليلات متقدمة وتقارير كاملة":"Unlock advanced insights and reports",ml+50,y+26);
    // Feature icons
    const feats=[["📋",isAr?"تحليل AI":"Detailed AI"],["📄","Full PDF"],["🫀",isAr?"توقع الألم":"Pain prediction"],["📊",isAr?"مقارنة":"Baseline"]];
    feats.forEach(([ic,lb],i)=>{
      const fx=ml+50+i*34;
      sf(12,"normal"); tc(doc,...tierCol); doc.text(ic,fx+7,y+38,{align:"center"});
      sf(5,"normal"); tc(doc,...TEXT2); doc.text(lb,fx+7,y+46,{align:"center"});
    });
    // CTA button
    fc(doc,...tierCol); rr(doc,W/2-30,y+40,60,12,4,"F");
    sf(7,"bold"); tc(doc,...TEXT); doc.text(isAr?"♛ رقّي الآن":"♛ Upgrade Now",W/2,y+48,{align:"center"});
    y+=57;

    // Footer
    fc(doc,...BORDER);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
    doc.rect(ml,H-9,cw,.3,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(5.5,"normal"); tc(doc,...TEXT3);
    doc.text("Posmoz Health Intelligence — Confidential",ml,H-4.5);
    doc.text("2 / 2",W-mr,H-4.5,{align:"right"});

    await doc.save(`Posmoz_Session_${realIdx}_${new Date().toISOString().slice(0,10)}.pdf`, {returnPromise:true});
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // ELITE/PRO — same premium design, full content, no upsell
  // ══════════════════════════════════════════════════════════════
  fc(doc,...BG); doc.rect(0,0,W,H,"F");

  // Header
  fc(doc,...BG2); doc.rect(0,0,W,22,"F");
  _logo(doc,ml,5,12,_logoSm);
  sf(8.5,"bold"); tc(doc,...TEXT); doc.text("POSMOZ",ml+16,11.5);
  sf(5.5,"normal"); tc(doc,...TEXT2); doc.text("HEALTH INTELLIGENCE",ml+16,16.5);
  sf(9,"bold"); tc(doc,...TEXT); doc.text(isAr?"تقرير تحليل الوضعية الشخصي":"Personal Posture Analysis Report",60,10);
  sf(6,"normal"); tc(doc,...TEXT3); doc.text("AI-POWERED POSTURE INSIGHTS",60,16);
  const tbw2=doc.getTextWidth(tierLbl)+10;
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.18}));
  rr(doc,W-mr-tbw2,4,tbw2,14,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  dc(doc,...tierCol); lw(doc,.5); rr(doc,W-mr-tbw2,4,tbw2,14,3,"S"); lw(doc,.3);
  sf(7,"bold"); tc(doc,...tierCol); doc.text(tierLbl,W-mr-tbw2/2,13,{align:"center"});
  sf(6,"normal"); tc(doc,...TEXT3); doc.text(`Generated: ${dateStr}`,W-mr,20,{align:"right"});
  fc(doc,...BORDER); doc.rect(0,22,W,.5,"F");
  let y=28;

  // Score card row
  const scoreW=60, kpiW=85, infoW=cw-scoreW-kpiW-8, row1H=78;
  // Score
  dCard(ml,y,scoreW,row1H);
  sf(6.5,"bold"); tc(doc,...TEXT3); doc.text("OVERALL POSTURE SCORE",ml+scoreW/2,y+7,{align:"center"});
  const cx2=ml+scoreW/2, cy2=y+42, r2=22;
  dc(doc,...BORDER); lw(doc,5); doc.circle(cx2,cy2,r2,"S");
  dc(doc,...gradeC); lw(doc,5); doc.circle(cx2,cy2,r2,"S"); lw(doc,.3);
  fc(doc,...gradeC);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.08}));
  doc.circle(cx2,cy2,r2-2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  sf(20,"bold"); tc(doc,...gradeC); doc.text(String(avg),cx2,cy2+3.5,{align:"center"});
  sf(6.5,"normal"); tc(doc,...TEXT3); doc.text("/100",cx2,cy2+10,{align:"center"});
  sf(9,"bold"); tc(doc,...gradeC); doc.text(gradeL,cx2,cy2+r2+9,{align:"center"});
  if(painSum){
    const tl2=doc.splitTextToSize(painSum.split('.')[0]+'.',scoreW-8);
    sf(5.5,"normal"); tc(doc,...TEXT2);
    tl2.slice(0,2).forEach((l,i)=>doc.text(l,ml+4,y+row1H-12+i*5.5));
  }
  // KPIs
  const kx3=ml+scoreW+4;
  [[isAr?"وضعية جيدة":"Good Posture",`${goodPct}%`,"✓",[34,197,94]],
   [isAr?"التنبيهات":"Alerts",String(alerts),"⚠",[245,158,11]],
   [isAr?"الجلسة":"Session",`#${realIdx}`,"#",[99,102,241]],
   [isAr?"المدة":"Duration",fmtDurShort(dur),"◷",[6,182,212]]
  ].forEach(([label,val,icon,col],i)=>{
    const kw=(kpiW-4)/2, kh=(row1H-4)/2;
    const kx2b=kx3+(i%2)*(kw+4), ky2=y+(Math.floor(i/2))*(kh+4);
    dCard(kx2b,ky2,kw,kh,5,CARD2);
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
    doc.circle(kx2b+10,ky2+10,8,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(8,"normal"); tc(doc,...col); doc.text(icon,kx2b+10,ky2+13.5,{align:"center"});
    sf(11,"bold"); tc(doc,...TEXT); doc.text(String(val),kx2b+kw/2,ky2+kh*.6,{align:"center"});
    sf(5.5,"bold"); tc(doc,...TEXT3); doc.text(label,kx2b+kw/2,ky2+kh*.82,{align:"center"});
  });
  // Info
  const ix2=kx3+kpiW+4;
  dCard(ix2,y,infoW,row1H);
  sf(6,"bold"); tc(doc,...TEXT3); doc.text("YOUR INFORMATION",ix2+4,y+7);
  [["👤",isAr?"الاسم":"Name",name],["✉",isAr?"البريد":"Email",email.length>22?email.slice(0,22)+"…":email],
   ["🏢",isAr?"الشركة":"Company",company||"—"],["🔑","ID",`local_${session.id?.slice(-8)||"xxxxxxxx"}`]
  ].forEach(([icon,lbl,val],i)=>{
    const ry=y+16+i*14;
    sf(5.5,"normal"); tc(doc,...TEXT3); doc.text(icon+" "+lbl,ix2+4,ry);
    sf(6,"bold"); tc(doc,...TEXT); doc.text(String(val),ix2+4,ry+6.5);
    if(i<3){fc(doc,...BORDER);doc.rect(ix2+4,ry+9,infoW-8,.3,"F");}
  });
  y+=row1H+5;

  // Timeline
  dCard(ml,y,cw,46);
  sf(6.5,"bold"); tc(doc,...TEXT3); doc.text("SCORE TIMELINE",ml+4,y+7);
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
    const tipLines=doc.splitTextToSize("💡  "+(aiText.split('.')[0]+'.'),cw-12);
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
    dCard(mx,y,mw2,mh,5);
    const iconC=sc<40?[239,68,68]:sc<65?[245,158,11]:[34,197,94];
    fc(doc,...iconC);doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
    rr(doc,mx+4,y+5,12,12,3,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(7,"bold");tc(doc,...iconC);doc.text(sc<40?"↑":sc<65?"→":"✓",mx+10,y+13.5,{align:"center"});
    sf(8,"bold");tc(doc,...TEXT);doc.text(lbl,mx+20,y+10);
    if(val!==undefined){sf(6.5,"normal");tc(doc,...TEXT2);doc.text(`${Math.round(val*10)/10}${unit}`,mx+20,y+17);}
    const pw=doc.getTextWidth(pri)+8;
    fc(doc,...iconC);doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
    rr(doc,mx+4,y+mh-11,pw,8,2,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(5.5,"bold");tc(doc,...iconC);doc.text(pri,mx+4+pw/2,y+mh-5.5,{align:"center"});
    const rind=mx+mw2-16,rcy=y+mh/2;
    dc(doc,...BORDER);lw(doc,3);doc.circle(rind,rcy,10,"S");
    dc(doc,...iconC);lw(doc,3);doc.circle(rind,rcy,10,"S");lw(doc,.3);
    sf(7.5,"bold");tc(doc,...iconC);doc.text(String(Math.round(sc)),rind,rcy+2.5,{align:"center"});
    sf(4.5,"normal");tc(doc,...TEXT3);doc.text("/100",rind,rcy+7.5,{align:"center"});
  });
  y+=mshow2.length>0?45:0;

  // Footer p1
  fc(doc,...BORDER);doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
  doc.rect(ml,H-9,cw,.3,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  sf(5.5,"normal");tc(doc,...TEXT3);
  doc.text("Posmoz Health Intelligence — Confidential",ml,H-4.5);doc.text("1 / 2",W-mr,H-4.5,{align:"right"});

  // PAGE 2 — full metrics + AI analysis
  doc.addPage(); fc(doc,...BG); doc.rect(0,0,W,H,"F");
  fc(doc,...BG2);doc.rect(0,0,W,15,"F");
  _logo(doc,ml,3,9,_logoSm);sf(7.5,"bold");tc(doc,...TEXT);doc.text("POSMOZ",ml+13,8);
  sf(4.5,"normal");tc(doc,...TEXT2);doc.text("HEALTH INTELLIGENCE",ml+13,13);
  sf(6,"normal");tc(doc,...TEXT3);doc.text(`Session #${realIdx}  •  ${dayStr}, ${timeStr}`,W-mr,10,{align:"right"});
  fc(doc,...BORDER);doc.rect(0,15,W,.5,"F");
  y=22;

  // Radar + Insights + Summary
  const radarW2=60,insW2=75,sumW2=cw-radarW2-insW2-8,rowH2=100;
  dCard(ml,y,radarW2,rowH2);
  sf(6,"bold");tc(doc,...TEXT3);doc.text("POSTURE OVERVIEW",ml+4,y+6);
  const rcx3=ml+radarW2/2,rcy3=y+rowH2/2+6,rad3=22;
  const lbls3=["Neck\nAlign.","Shoulder\nPosition","Spine\nAlign.","Sitting\nBalance","Screen\nErgonomics"];
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
  const metK3=["neck_lean","shoulder","spine_align","hip_angle","distance"];
  const uS3=metK3.map(k=>typeof metrics[k]==="number"?metrics[k]:(metrics[k]?.score??70));
  const up3=ang3.map((a,i)=>({x:rcx3+Math.cos(a)*rad3*(uS3[i]/100),y:rcy3+Math.sin(a)*rad3*(uS3[i]/100)}));
  fc(doc,37,99,235);doc.setGState&&doc.setGState(new doc.GState({opacity:.25}));
  try{doc.lines([...up3.slice(1).map((p,i)=>[p.x-up3[i].x,p.y-up3[i].y]),[up3[0].x-up3[up3.length-1].x,up3[0].y-up3[up3.length-1].y]],up3[0].x,up3[0].y,[1,1],"F",false);}catch{}
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  dc(doc,37,99,235);lw(doc,.8);
  try{doc.lines([...up3.slice(1).map((p,i)=>[p.x-up3[i].x,p.y-up3[i].y]),[up3[0].x-up3[up3.length-1].x,up3[0].y-up3[up3.length-1].y]],up3[0].x,up3[0].y,[1,1],"S",false);}catch{}
  lw(doc,.3);up3.forEach(p=>{fc(doc,37,99,235);doc.circle(p.x,p.y,1.5,"F");});
  ang3.forEach((a,i)=>{
    const lx=rcx3+Math.cos(a)*(rad3+7),ly=rcy3+Math.sin(a)*(rad3+7);
    sf(4.5,"normal");tc(doc,...TEXT3);doc.text(lbls3[i].replace('\n',' '),lx,ly,{align:"center"});
  });
  sf(5,"normal");tc(doc,37,99,235);doc.text("— You",ml+4,y+rowH2-7);
  tc(doc,...TEXT3);doc.text("  - - Optimal",ml+4,y+rowH2-2.5);

  // Insights
  const inx3=ml+radarW2+4;
  dCard(inx3,y,insW2,rowH2);
  sf(6,"bold");tc(doc,...TEXT3);doc.text("POSTURE INSIGHTS",inx3+4,y+6);
  mEntries.slice(0,3).map(({lbl,sc,val,unit})=>({
    icon:sc<40?"🔴":sc<65?"🟡":"🟢",
    text:`Your ${lbl.toLowerCase()} ${sc<60?"needs attention.":"is acceptable."}`,
    detail:sc<40?"High priority — address immediately.":sc<65?"Moderate — monitor.":"Looking good.",
    col:sc<40?[239,68,68]:sc<65?[245,158,11]:[34,197,94],
  })).forEach(({icon,text,detail,col},i)=>{
    const iy=y+12+i*28;
    fc(doc,...col);doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
    doc.circle(inx3+10,iy+7,8,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(9,"normal");tc(doc,...col);doc.text(icon,inx3+10,iy+10.5,{align:"center"});
    sf(7,"bold");tc(doc,...TEXT);doc.text(text,inx3+21,iy+7);
    sf(6,"normal");tc(doc,...TEXT2);doc.text(detail,inx3+21,iy+13.5);
    if(i<2){fc(doc,...BORDER);doc.rect(inx3+4,iy+22,insW2-8,.25,"F");}
  });

  // Summary
  const sx3=inx3+insW2+4;
  dCard(sx3,y,sumW2,rowH2);
  sf(6,"bold");tc(doc,...TEXT3);doc.text("SESSION SUMMARY",sx3+4,y+6);
  [["Overall Score",`${avg}/100`,gradeC],["Good Posture",`${goodPct}%`,[34,197,94]],
   ["Alerts",String(alerts),[245,158,11]],["Duration",fmtDurShort(dur),[99,102,241]],
   ["Session",`#${realIdx}`,[99,102,241]],["Date",dayStr.split(',')[0],[148,163,200]],["Time",timeStr,[148,163,200]]
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
      sf(6.5,"bold");tc(doc,...iconC);doc.text(sc<40?"↑":sc<65?"→":"✓",ml+9,y+11,{align:"center"});
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

  // AI Analysis
  if(aiText&&y<H-60){
    dCard(ml,y,cw,Math.min(60,H-y-12),5,CARD2);
    sf(7,"bold");tc(doc,...TEXT);doc.text(isAr?"تحليل Posmoz AI":"Posmoz AI Analysis",ml+5,y+8);
    const aiLines=doc.splitTextToSize(aiText.replace(/[#*`]/g,"").trim(),cw-12);
    sf(7,"normal");tc(doc,...TEXT2);
    aiLines.slice(0,7).forEach((l,i)=>{if(y+16+i*5.5<H-14)doc.text(l,ml+5,y+16+i*5.5);});
  }

  // Footer p1
  fc(doc,...BORDER);doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
  doc.rect(ml,H-9,cw,.3,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  sf(5.5,"normal");tc(doc,...TEXT3);
  doc.text("Posmoz Health Intelligence — Confidential",ml,H-4.5);
  // Page numbers
  const tot=doc.internal.getNumberOfPages();
  for(let p=1;p<=tot;p++){
    doc.setPage(p);
    sf(5.5,"normal");tc(doc,...TEXT3);doc.text(`${p} / ${tot}`,W-mr,H-4.5,{align:"right"});
  }

  await doc.save(`Posmoz_Elite_Session_${realIdx}_${new Date().toISOString().slice(0,10)}.pdf`, {returnPromise:true});
}




export async function generateClinicalPDF({ session, profile, user, lang="en", sessionIndex, allSessions=[], aiSummary="" }) {
  const { jsPDF } = await import("jspdf");
  const isAr  = lang === "ar";
  const doc   = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  await Promise.all([_ensureCairoFont(doc), _ensureLogo()]);
  const W=210, H=297, ml=18, mr=18, cw=W-ml-mr;

  const tier    = _t(profile?.tier || session?.tier || "standard");
  // Note: tier gate is enforced in App.jsx downloadPDF() before calling here.
  // We don't re-throw here to avoid silent failures from stale session.tier values.

  // Cairo already loaded via _ensureCairoFont above
  const cairo = _cairoLoaded;
  const fnt = (size, style="normal") => cairo && isAr ? fontAr(doc,size,style,true) : font(doc,size,style);

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
  const dateStr = isAr ? now.toLocaleDateString("ar-EG",{year:"numeric",month:"long",day:"numeric"}) : now.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});

  const realIndex = (() => {
    if (sessionIndex) return sessionIndex;
    if (allSessions.length) {
      const idx = allSessions.findIndex(s=>(s.id||s.session_id)===(session.id||session.session_id));
      if (idx>=0) return allSessions.length - idx;
    }
    return 1;
  })();

  const metricEntries = Object.entries(metrics)
    .filter(([k])=>!k.startsWith("_") && !NON_POSTURE_KEYS.has(k) && metrics[k])
    .map(([k,v])=>{
      const sc  = typeof v==="number" ? v : (v?.score ?? 100);
      const lbl = METRIC_LABELS[k] || v?.label || k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      return { key:k, sc, lbl, value:v?.value, unit:v?.unit||"" };
    })
    .sort((a,b)=>a.sc-b.sc);

  let y=0;

  // ── PAGE 1: Clinical Header + Patient Info ────────────────────
  // Clinical header — formal white + navy, with brand mark and accent
  doc.setFillColor(15,23,42); doc.rect(0,0,W,36,"F");
  doc.setFillColor(14,165,233); doc.rect(0,0,W,1.8,"F");
  _logo(doc,ml,9,18,_logoMd);
  doc.setFontSize(14); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text("POSMOZ POSTURE HEALTH", ml+24, 16);
  doc.setFontSize(8.5); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal");
  doc.text("AI-Assisted Workplace Ergonomics & Posture Assessment", ml+24, 23);
  doc.text("For Clinical Review — Not for Diagnostic Purposes", ml+24, 29.5);

  // Document type badge
  doc.setFillColor(14,165,233); doc.roundedRect(W-mr-42,10,42,14,2,2,"F");
  doc.setFontSize(8); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text("CLINICAL SUMMARY", W-mr-21, 18.5, {align:"center"});
  doc.setFontSize(6.5); doc.setTextColor(186,230,253); doc.setFont("helvetica","normal");
  doc.text("PHYSIOTHERAPIST REPORT", W-mr-21, 23.5, {align:"center"});

  y=46;

  // Patient Info block
  doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,32,3,3,"F");
  doc.setDrawColor(226,232,240); doc.setLineWidth(0.4); doc.roundedRect(ml,y,cw,32,3,3,"S"); doc.setLineWidth(0.3);

  doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","bold");
  doc.text("PATIENT INFORMATION", ml+4, y+7);
  doc.setFontSize(8.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","normal");
  [
    [`Patient Name:`, name, ml+4],
    [`Email:`, email, ml+4],
    [`Date of Assessment:`, dateStr, ml+cw/2+4],
    [`Session Reference:`, `#${realIndex}`, ml+cw/2+4],
    [`Session Duration:`, _fmtDur(dur), ml+4],
    [`Recording Mode:`, session.mode||"Laptop Camera", ml+cw/2+4],
  ].forEach(([lbl,val,x],i) => {
    const row = Math.floor(i/2);
    const yy = y+13+(row*8);
    doc.setFont("helvetica","bold"); doc.setTextColor(100,116,139); doc.setFontSize(7.5);
    doc.text(lbl, x, yy);
    doc.setFont("helvetica","normal"); doc.setTextColor(15,23,42); doc.setFontSize(8.5);
    doc.text(val||"—", x+32, yy);
  });
  y+=40;

  // ── Overall score clinical interpretation ─────────────────────
  doc.setFontSize(11); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Overall Posture Score", ml, y); y+=6;

  doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,36,3,3,"F");
  doc.setDrawColor(...gradeC); doc.setLineWidth(0.5); doc.roundedRect(ml,y,cw,36,3,3,"S"); doc.setLineWidth(0.3);

  const cx2=ml+20, cy2=y+18;
  // Ring with proportional arc (was a solid filled circle)
  doc.setDrawColor(226,232,240); doc.setLineWidth(3); doc.circle(cx2,cy2,13,"S"); doc.setLineWidth(0.3);
  doc.setFillColor(...gradeC);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.08}));
  doc.circle(cx2,cy2,11.5,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  _arc(doc,cx2,cy2,13,avg/100,gradeC,3);
  doc.setFontSize(15); doc.setTextColor(...gradeC); doc.setFont("helvetica","bold");
  doc.text(String(avg), cx2, cy2+2.5, {align:"center"});
  doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text("/100", cx2, cy2+8, {align:"center"});

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
    doc.setFontSize(10); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text("Posture Score Timeline (Full Session)", ml, y); y+=4;
    doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text("Continuous posture quality measurement from session start to end", ml, y); y+=5;
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

  // ── PAGE 2: Zonal Pain Map ────────────────────────────────────
  doc.addPage();
  doc.setFillColor(15,23,42); doc.rect(0,0,W,12,"F");
  doc.setFontSize(8); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal");
  doc.text("Posmoz Posture Health — Clinical Summary", ml, 8.5);
  doc.setFontSize(7.5); doc.setTextColor(14,165,233); doc.setFont("helvetica","bold");
  doc.text("PHYSIOTHERAPIST REPORT", W-mr, 8.5, {align:"right"});
  y=22;

  doc.setFontSize(12); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Spinal Zone Risk Assessment", ml, y); y+=5;
  doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text("Risk percentages are derived computationally from posture metrics. They are not medical diagnoses.", ml, y); y+=9;

  const clinicalZones = [
    {
      key:"cervical", region:"C1–C7", title:"Cervical Spine (Neck)",
      desc:"Assesses head position, neck lean, forward head posture, and rotational deviation. Elevated risk correlates with increased load on cervical discs and potential for tension-type headache, cervicogenic dizziness, or upper trapezius hypertonicity.",
      metrics:"Neck Lean, Forward Head Posture, Head Tilt, Head Rotation",
    },
    {
      key:"thoracic", region:"T1–T12", title:"Thoracic Spine (Upper Back)",
      desc:"Evaluates shoulder symmetry, rounded shoulder posture, and upper spinal curvature. Chronic elevation indicates risk for thoracic kyphosis progression, intercostal restriction, or rotator cuff impingement patterns.",
      metrics:"Shoulder Balance, Rounded Shoulders, Spine Lean, Trunk Lean",
    },
    {
      key:"lumbar", region:"L1–S1", title:"Lumbar Spine (Lower Back)",
      desc:"Measures sagittal and coronal spinal alignment, hip angle, and pelvic positioning relative to trunk. Risk elevation may indicate posterior chain tightness, lumbar flexion intolerance, or disc load asymmetry.",
      metrics:"Spine Alignment, Hip Angle, Trunk Lean",
    },
  ];

  clinicalZones.forEach(({key,region,title,desc,metrics:mlist})=>{
    if(y>H-72){doc.addPage();y=22;}
    const risk=zonal[key]||0;
    const rcol=_riskColor(risk);
    const rlbl=_riskLabel(risk,false);

    doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,52,3,3,"F");
    doc.setDrawColor(...rcol); doc.setLineWidth(0.5); doc.roundedRect(ml,y,cw,52,3,3,"S"); doc.setLineWidth(0.3);

    // Zone identifier
    doc.setFillColor(...rcol); doc.roundedRect(ml+2,y+2,22,22,2,2,"F");
    doc.setFontSize(13); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    doc.text(`${risk}%`, ml+13, y+13.5, {align:"center"});
    doc.setFontSize(6); doc.text("RISK", ml+13, y+20, {align:"center"});

    doc.setFontSize(9.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(title, ml+28, y+8);
    doc.setFontSize(7.5); doc.setTextColor(14,165,233); doc.setFont("helvetica","bold");
    doc.text(region, ml+28, y+14);
    doc.setFontSize(7); doc.setTextColor(...rcol); doc.setFont("helvetica","bold");
    doc.text(`Risk Level: ${rlbl}`, ml+28, y+20);

    // Risk bar
    const bx=ml+cw*0.52, bw2=cw*0.46;
    doc.setFillColor(226,232,240); doc.roundedRect(bx,y+15,bw2,4,1,1,"F");
    doc.setFillColor(...rcol); doc.roundedRect(bx,y+15,Math.max(bw2*(risk/100),3),4,1,1,"F");

    // Description
    doc.setFontSize(7.5); doc.setTextColor(51,65,85); doc.setFont("helvetica","normal");
    const descLines = doc.splitTextToSize(desc, cw-8);
    descLines.slice(0,4).forEach((l,i)=>doc.text(l, ml+4, y+30+(i*5.5)));

    // Metrics source
    doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","bold");
    doc.text("Contributing metrics: ", ml+4, y+53.5);
    doc.setFont("helvetica","normal"); doc.text(mlist, ml+38, y+53.5);

    y+=58;
  });

  // ── PAGE 3: Body Outline + Metrics Detail + Recommendations ─────
  doc.addPage();
  doc.setFillColor(15,23,42); doc.rect(0,0,W,12,"F");
  doc.setFontSize(8); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal");
  doc.text("Posmoz Posture Health — Clinical Summary", ml, 8.5);
  doc.setFontSize(7.5); doc.setTextColor(14,165,233); doc.setFont("helvetica","bold");
  doc.text("PHYSIOTHERAPIST REPORT", W-mr, 8.5, {align:"right"});
  y=22;

  // ── Body Outline Diagram — zonal risk visualization ───────────
  doc.setFontSize(11); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Spinal Zone Risk — Visual Overview", ml, y); y+=6;
  doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text("Risk zones derived computationally from posture measurements", ml, y); y+=8;

  // Draw simplified body silhouette
  const bx = ml+cw*0.55, bodyW=24, headR=7;
  const bodyTop = y+4;
  // Head circle
  doc.setDrawColor(200,210,220); doc.setLineWidth(0.5);
  doc.setFillColor(241,245,249); doc.circle(bx+bodyW/2, bodyTop+headR, headR,"FD");
  // Cervical zone
  const cervCol=_riskColor(zonal.cervical||0);
  doc.setFillColor(...cervCol); doc.setGState&&doc.setGState(new doc.GState({opacity:0.35}));
  doc.roundedRect(bx+4, bodyTop+headR*2, bodyW-8, 12, 2, 2, "F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Thoracic zone
  const thorCol=_riskColor(zonal.thoracic||0);
  doc.setFillColor(...thorCol); doc.setGState&&doc.setGState(new doc.GState({opacity:0.35}));
  doc.roundedRect(bx+2, bodyTop+headR*2+12, bodyW-4, 22, 2, 2, "F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Lumbar zone
  const lumbCol=_riskColor(zonal.lumbar||0);
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
    ["Cervical  C1–C7", _riskLabel(zonal.cervical||0,false), cervCol, zonal.cervical||0],
    ["Thoracic  T1–T12", _riskLabel(zonal.thoracic||0,false), thorCol, zonal.thoracic||0],
    ["Lumbar  L1–S1", _riskLabel(zonal.lumbar||0,false), lumbCol, zonal.lumbar||0],
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
  if(y>H-80){doc.addPage();y=22;}
  doc.setFontSize(11); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Exercise Prescription", ml, y); y+=5;
  doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text("Evidence-based exercises targeting the highest-risk zones identified in this session", ml, y); y+=9;

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
    .sort((a,b)=>(zonal[b]||0)-(zonal[a]||0));

  for(const zk of zonePriority.slice(0,3)){
    if(y>H-55){doc.addPage();y=22;}
    const col = _riskColor(zonal[zk]||0);
    doc.setFillColor(...col); doc.roundedRect(ml,y,cw,9,2,2,"F");
    doc.setFontSize(9); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    doc.text(`${zk.charAt(0).toUpperCase()+zk.slice(1)} Zone Exercises (Risk: ${_riskLabel(zonal[zk]||0,false)} ${zonal[zk]||0}%)`,ml+4,y+6.5); y+=13;
    for(const ex of EXERCISES[zk].slice(0,2)){
      if(y>H-22){doc.addPage();y=22;}
      doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,16,2,2,"F");
      doc.setFontSize(8.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
      doc.text(`${ex.name} — ${ex.sets}`, ml+4, y+7);
      doc.setFontSize(7.5); doc.setTextColor(71,85,105); doc.setFont("helvetica","normal");
      doc.text(ex.desc, ml+4, y+13);
      y+=19;
    }
    y+=4;
  }

  // All metrics in clinical table style
  doc.setFontSize(11); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Posture Metrics Detail", ml, y); y+=7;

  // Table header
  doc.setFillColor(15,23,42); doc.roundedRect(ml,y,cw,9,2,2,"F");
  doc.setFontSize(7); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  ["Measurement","Value","Score","Status"].forEach((h,i)=>{
    const xs=[ml+3, ml+cw*0.38, ml+cw*0.56, ml+cw*0.72];
    doc.text(h, xs[i], y+6);
  });
  y+=11;

  metricEntries.forEach(({lbl,value,unit,sc},i)=>{
    if(y>H-40){doc.addPage();y=22;}
    doc.setFillColor(i%2===0?248:255, i%2===0?250:255, i%2===0?252:255);
    doc.rect(ml,y,cw,9,"F");
    const col=_gc(sc);
    doc.setFontSize(8); doc.setTextColor(15,23,42); doc.setFont("helvetica","normal");
    doc.text(lbl, ml+3, y+6);
    doc.setTextColor(...col); doc.setFont("helvetica","bold");
    if(value!==undefined&&value!==null) doc.text(`${Math.round(value*10)/10} ${unit||""}`, ml+cw*0.38, y+6);
    doc.text(String(Math.round(sc)), ml+cw*0.56, y+6);
    doc.setFontSize(7.5); doc.text(_gl(sc,false), ml+cw*0.72, y+6);
    y+=9;
  });

  y+=10;

  // Clinical recommendations
  if(y>H-80){doc.addPage();y=22;}
  doc.setFontSize(11); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Clinical Notes & Recommendations", ml, y); y+=5;
  doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text("Suggested focus areas based on session measurements. Please apply clinical judgment.", ml, y); y+=9;

  const clinicalRecos = [
  avg < 60
    ? `Overall posture score of ${avg}/100 indicates significant postural deviation across multiple planes. ${zonal.cervical > zonal.thoracic && zonal.cervical > zonal.lumbar ? "Cervical zone is the primary contributor." : zonal.thoracic > zonal.lumbar ? "Thoracic zone shows the most concern." : "Lumbar zone requires the most attention."} Full clinical assessment with manual palpation recommended.`
    : avg < 80
    ? `Moderate postural deviations identified (score: ${avg}/100). ${zonal.cervical > 45 ? "Cervical risk at " + zonal.cervical + "% requires targeted intervention. " : ""}${zonal.thoracic > 45 ? "Thoracic risk at " + zonal.thoracic + "% noted. " : ""}Targeted corrective exercise programming is likely to yield measurable improvement within 4-6 weeks.`
    : `Posture quality is broadly good during monitored sessions (${avg}/100, ${goodPct}% good posture). Reinforce current ergonomic patterns. ${zonal.cervical > zonal.thoracic ? "Monitor cervical zone closely during extended work periods." : "Continue current workstation setup and posture awareness practices."}`,
  zonal.cervical >= 45
    ? `Cervical zone risk: ${zonal.cervical}%. Neck lean and head position metrics require attention. Chin tuck exercises (3x10 reps daily) and monitor height adjustment to eye level are indicated. Consider cervicogenic headache screening if symptoms present.`
    : `Cervical zone within acceptable range (${zonal.cervical}%). Current head and neck positioning is adequate. Maintain 50-70cm screen distance and monitor at eye level.`,
  zonal.thoracic >= 45
    ? `Thoracic zone risk: ${zonal.thoracic}%. Shoulder asymmetry and upper spinal curvature detected. Thoracic extension exercises (foam roller at T6-T9, 2x60s) and scapular retraction drills recommended. Workstation ergonomic review advised.`
    : `Thoracic zone acceptable (${zonal.thoracic}%). Shoulder balance and upper back posture are within normal parameters. Encourage thoracic extension breaks every 45 minutes.`,
  zonal.lumbar >= 45
    ? `Lumbar zone risk: ${zonal.lumbar}%. Spinal alignment and hip angle metrics indicate concern. Posterior pelvic tilt exercises (3x10) and hip flexor stretches (3x30s/side) indicated. Lumbar support cushion and sit-stand desk rotation recommended.`
    : `Lumbar zone within expected range (${zonal.lumbar}%). Current seated posture maintains adequate lumbar support. Continue current chair settings with feet flat and knees at 90 degrees.`,
];

  clinicalRecos.forEach((rec,i)=>{
    if(y>H-35){doc.addPage();y=22;}
    doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,22,2,2,"F");
    doc.setFontSize(8); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    const zones2 = ["General Assessment","Cervical Focus","Thoracic Focus","Lumbar Focus"];
    doc.text(`${i+1}. ${zones2[i]}`, ml+4, y+7);
    doc.setFont("helvetica","normal"); doc.setTextColor(51,65,85);
    const recLines = doc.splitTextToSize(rec, cw-10);
    recLines.slice(0,2).forEach((l,li)=>doc.text(l, ml+4, y+13+(li*5.5)));
    y+=26;
  });

  // ── Disclaimer + Signature block ─────────────────────────────
  y+=8;
  const disc="All measurements in this report are camera-based pose estimates (screening-grade). They reliably capture trends and patterns over time but are not equivalent to goniometric or radiographic measurement. This report is generated by an AI-based postural monitoring system and is intended to supplement, not replace, professional clinical assessment. Findings should be interpreted alongside a full physical examination by a qualified physiotherapist or medical professional. Posmoz is a wellness and ergonomics product, not a medical device; it does not diagnose or treat any medical condition.";
  doc.setFontSize(7.5);
  const discLines=doc.splitTextToSize(disc,cw-8);
  const discH=12+discLines.length*4.2+4;
  if(y>H-discH-12){doc.addPage();y=22;}
  doc.setFillColor(254,243,199); doc.roundedRect(ml,y,cw,discH,2,2,"F");
  doc.setTextColor(146,64,14); doc.setFont("helvetica","bold");
  doc.text("IMPORTANT DISCLAIMER — SCREENING-GRADE MEASUREMENT", ml+4, y+7);
  doc.setFont("helvetica","normal"); doc.setTextColor(120,53,15);
  discLines.forEach((l,i)=>doc.text(l,ml+4,y+12+(i*4.2)));
  y+=discH+6;

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
    doc.text(`Posmoz Posture Health — Clinical Report — ${dateStr} — Confidential`, ml, H-2.5);
    doc.text(`${p} / ${totalPages2}`, W-mr, H-2.5, {align:"right"});
  }

  const filename=`Posmoz_Clinical_Report_Session${realIndex}_${now.toISOString().slice(0,10)}.pdf`;
  await doc.save(filename, {returnPromise:true});
  return filename;
}

// ═══════════════════════════════════════════════════════════════════
// COMPARISON PDF — session vs session, dark premium design
// Same visual family as the Elite session report.
// ═══════════════════════════════════════════════════════════════════
export async function generateComparisonPDF({ session1, session2, sessions=[], profile, user, lang="en", allSessions=[], aiSummary="" }) {
  // Support both old API (session1,session2) and new API (sessions array)
  if (!session1 && sessions.length >= 2) { session1 = sessions[0]; session2 = sessions[1]; }
  if (!session1 || !session2) { console.warn("[PDF] Comparison needs 2 sessions"); return; }

  const { jsPDF } = await import("jspdf");
  const isAr = lang==="ar";
  const tier = _t(profile?.tier||"standard");
  const doc  = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  await Promise.all([_ensureCairoFont(doc), _ensureLogo()]);
  const W=210, H=297, ml=14, mr=14, cw=W-ml-mr;
  const sf  = (sz,st="normal") => font(doc,sz,st,isAr&&_cairoLoaded);
  const now = new Date();
  const nowStr = now.toLocaleDateString(isAr?"ar-EG":"en-US",{year:"numeric",month:"long",day:"numeric"});
  const name   = profile?.name||user?.displayName||user?.email?.split("@")[0]||(isAr?"مستخدم":"User");
  const tierLbl= tierAtLeast(tier,"elite")?"ELITE":tierAtLeast(tier,"professional")?"PROFESSIONAL":"STARTER";
  const tierCol= tierAtLeast(tier,"elite")?DK.green:tierAtLeast(tier,"professional")?DK.violet:DK.blue;

  // ── DATA ──────────────────────────────────────────────────────
  const a1=Math.round(session1.avg_score||0), a2=Math.round(session2.avg_score||0);
  const delta=a2-a1;
  const deltaCol = delta>0?DK.green:delta<0?DK.red:DK.TEXT2;
  const dstr = d => (d>0?"+":"")+d;

  const idx1=allSessions.findIndex(s=>(s.id||s.session_id)===(session1.id||session1.session_id));
  const idx2=allSessions.findIndex(s=>(s.id||s.session_id)===(session2.id||session2.session_id));
  const num1=idx1>=0?allSessions.length-idx1:1;
  const num2=idx2>=0?allSessions.length-idx2:2;

  const m1=session1.metrics||{}, m2=session2.metrics||{};
  const allKeys=[...new Set([...Object.keys(m1),...Object.keys(m2)])].filter(k=>!k.startsWith("_")&&!NON_POSTURE_KEYS.has(k));
  const metRows=allKeys.map(k=>{
    const sc1=Math.round(typeof m1[k]==="number"?m1[k]:(m1[k]?.score??100));
    const sc2=Math.round(typeof m2[k]==="number"?m2[k]:(m2[k]?.score??100));
    const d=sc2-sc1;
    const lbl=(isAr?METRIC_LABELS_AR[k]:METRIC_LABELS[k])||k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
    return{k,lbl,sc1,sc2,d};
  }).sort((a,b)=>a.d-b.d);

  const z1=_zonalRisk(m1), z2=_zonalRisk(m2);
  const d1=session1.duration_s||session1.duration_sec||0;
  const d2=session2.duration_s||session2.duration_sec||0;
  const gp1=Math.round(session1.good_pct||0), gp2=Math.round(session2.good_pct||0);
  const al1=session1.alerts_count||0, al2=session2.alerts_count||0;
  const date1=_fmtDate(session1.created_at,isAr), date2=_fmtDate(session2.created_at,isAr);
  const h1=session1.score_history||[], h2=session2.score_history||[];

  // ══ PAGE 1 ═════════════════════════════════════════════════════
  _dkPage(doc,W,H);
  _dkHeader(doc,W,ml,mr,sf,
    isAr?"تقرير مقارنة الجلسات":"Session Comparison Report",
    "HEAD-TO-HEAD SESSION ANALYSIS",
    tierLbl,tierCol,`Generated: ${nowStr}`);
  let y=28;

  // ── Hero: two session cards + delta badge ──────────────────────
  const heroH=64, half=(cw-26)/2;
  [[ml,num1,a1,date1,gp1,al1,d1],[ml+half+26,num2,a2,date2,gp2,al2,d2]].forEach(([x,num,sc,dt,gp,al,du])=>{
    const col=_dkSc(sc);
    _dkCard(doc,x,y,half,heroH);
    fc(doc,...col); rr(doc,x,y,half,3,3,"F"); doc.rect(x,y+1.5,half,1.5,"F");
    sf(6.5,"bold"); tc(doc,...DK.TEXT2); doc.text(`SESSION #${num}`,x+6,y+11);
    sf(5.5,"normal"); tc(doc,...DK.TEXT3); doc.text(dt,x+6,y+17);
    _dkRing(doc,sf,x+22,y+40,15,sc);
    sf(6,"bold"); tc(doc,...col); doc.text(_scoreLabel(sc,isAr),x+22,y+60,{align:"center"});
    // Side stats
    [[isAr?"جيدة":"Good",`${gp}%`,DK.green],[isAr?"تنبيهات":"Alerts",String(al),DK.amber],[isAr?"المدة":"Duration",_fmtDur(du),DK.cyan]]
      .forEach(([l,v,c],i)=>{
        const sy2=y+27+i*11;
        sf(5.5,"normal"); tc(doc,...DK.TEXT3); doc.text(l,x+44,sy2);
        sf(6.5,"bold");   tc(doc,...c);        doc.text(v,x+half-6,sy2,{align:"right"});
        if(i<2){fc(doc,...DK.BORDER);doc.setGState&&doc.setGState(new doc.GState({opacity:.3}));doc.rect(x+44,sy2+2.6,half-50,.2,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));}
      });
  });
  // Delta badge between the cards
  const dcx=ml+half+13, dcy=y+heroH/2;
  fc(doc,...DK.CARD2); doc.circle(dcx,dcy,11,"F");
  dc(doc,...deltaCol); lw(doc,.8); doc.circle(dcx,dcy,11,"S"); lw(doc,.3);
  sf(9,"bold"); tc(doc,...deltaCol); doc.text(dstr(delta),dcx,dcy+1,{align:"center"});
  sf(4.5,"normal"); tc(doc,...DK.TEXT3); doc.text(isAr?"نقاط":"pts",dcx,dcy+6,{align:"center"});
  sf(6,"bold"); tc(doc,...DK.TEXT3); doc.text("VS",dcx,y+6,{align:"center"});
  y+=heroH+6;

  // ── Delta KPI row ──────────────────────────────────────────────
  const kw=(cw-12)/4;
  [[isAr?"تغير النتيجة":"Score Change",dstr(delta),deltaCol],
   [isAr?"وضعية جيدة":"Good Posture",dstr(gp2-gp1)+"%",gp2-gp1>=0?DK.green:DK.red],
   [isAr?"التنبيهات":"Alerts",dstr(al2-al1),al2-al1<=0?DK.green:DK.red],
   [isAr?"المدة":"Duration",dstr(Math.round((d2-d1)/60))+"m",DK.cyan]]
    .forEach(([l,v,c],i)=>_dkKpi(doc,sf,ml+i*(kw+4),y,kw,22,l,v,c));
  y+=28;

  // ── Timeline overlay ───────────────────────────────────────────
  if(h1.length>2&&h2.length>2){
    _dkCard(doc,ml,y,cw,52);
    sf(6.5,"bold"); tc(doc,...DK.TEXT3); doc.text(isAr?"مسار النقاط — الجلستان":"SCORE TIMELINE — BOTH SESSIONS",ml+5,y+7);
    const lo=Math.max(0,Math.min(...h1,...h2)-5), hi=Math.min(100,Math.max(...h1,...h2)+5);
    _dkChart(doc,sf,h1,ml+10,y+12,cw-20,30,DK.blue,{lo,hi,noDots:true});
    _dkChart(doc,sf,h2,ml+10,y+12,cw-20,30,DK.violet,{lo,hi,noDots:true,noGrid:true});
    sf(5.5,"bold"); tc(doc,...DK.blue);   doc.text(`— Session #${num1}`,ml+10,y+48);
    tc(doc,...DK.violet); doc.text(`— Session #${num2}`,ml+42,y+48);
    y+=58;
  }

  // ── Spine zone comparison ──────────────────────────────────────
  _dkCard(doc,ml,y,cw,46);
  sf(6.5,"bold"); tc(doc,...DK.TEXT3); doc.text(isAr?"مخاطر مناطق العمود الفقري":"SPINAL ZONE RISK — BEFORE vs AFTER",ml+5,y+7);
  let zy=y+13;
  [[isAr?"الرقبة (C1–C7)":"Cervical (C1–C7)","cervical"],
   [isAr?"الظهر العلوي (T1–T12)":"Thoracic (T1–T12)","thoracic"],
   [isAr?"أسفل الظهر (L1–S1)":"Lumbar (L1–S1)","lumbar"]].forEach(([lbl,k])=>{
    zy=_dkDualBar(doc,sf,ml+5,zy,cw-10,lbl,z1[k]||0,z2[k]||0,DK.blue,DK.violet);
  });
  sf(5,"normal"); tc(doc,...DK.TEXT3);
  doc.text(isAr?"شريط أول = الجلسة الأقدم · شريط ثانٍ = الأحدث · أقل = أفضل":"Top bar = older session · bottom bar = newer · lower is better",ml+5,y+43);
  y+=52;

  // ══ PAGE 2 — metric table ══════════════════════════════════════
  doc.addPage(); _dkPage(doc,W,H);
  _dkSub(doc,W,ml,mr,sf,`Session #${num1} vs #${num2} · ${nowStr}`);
  y=22;
  y=_dkSection(doc,sf,ml,y,isAr?"مقارنة المقاييس واحداً بواحد":"METRIC-BY-METRIC BREAKDOWN");
  // Table header
  _dkCard(doc,ml,y,cw,9,3,DK.CARD2);
  sf(5.5,"bold"); tc(doc,...DK.TEXT3);
  doc.text(isAr?"المقياس":"METRIC",ml+5,y+6);
  doc.text(`#${num1}`,ml+cw*.44,y+6,{align:"center"});
  doc.text(`#${num2}`,ml+cw*.56,y+6,{align:"center"});
  doc.text(isAr?"الفرق":"CHANGE",ml+cw*.68,y+6,{align:"center"});
  doc.text(isAr?"الاتجاه":"TREND",ml+cw*.87,y+6,{align:"center"});
  y+=11;
  metRows.forEach((r,i)=>{
    if(y>H-24){
      const tpNow=doc.internal.getNumberOfPages();
      doc.addPage(); _dkPage(doc,W,H); _dkSub(doc,W,ml,mr,sf,"Metric breakdown (cont.)"); y=22;
    }
    const rh=11;
    _dkCard(doc,ml,y,cw,rh,2.5,i%2===0?DK.CARD:DK.CARD2);
    const dCol=r.d>0?DK.green:r.d<0?DK.red:DK.TEXT2;
    fc(doc,...dCol); doc.rect(ml,y,2,rh,"F"); rr(doc,ml,y,2,rh,1,"F");
    sf(7,"bold"); tc(doc,...DK.TEXT); doc.text(r.lbl,ml+6,y+7);
    sf(7,"bold"); tc(doc,..._dkSc(r.sc1)); doc.text(String(r.sc1),ml+cw*.44,y+7,{align:"center"});
    tc(doc,..._dkSc(r.sc2)); doc.text(String(r.sc2),ml+cw*.56,y+7,{align:"center"});
    // Delta pill
    const dl=dstr(r.d); const dw=doc.getTextWidth(dl)+8;
    fc(doc,...dCol);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
    rr(doc,ml+cw*.68-dw/2,y+2.5,dw,6,2,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(6,"bold"); tc(doc,...dCol); doc.text(dl,ml+cw*.68,y+7,{align:"center"});
    // Trend arrow + mini bars
    sf(8,"bold"); tc(doc,...dCol); doc.text(r.d>0?"▲":r.d<0?"▼":"→",ml+cw*.80,y+7.5,{align:"center"});
    const bx=ml+cw*.84, bw2=cw*.13;
    fc(doc,...DK.BORDER); doc.setGState&&doc.setGState(new doc.GState({opacity:.5}));
    rr(doc,bx,y+2.6,bw2,2.4,1,"F"); rr(doc,bx,y+6,bw2,2.4,1,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    fc(doc,...DK.blue);   rr(doc,bx,y+2.6,Math.max(bw2*(r.sc1/100),1.5),2.4,1,"F");
    fc(doc,...DK.violet); rr(doc,bx,y+6,  Math.max(bw2*(r.sc2/100),1.5),2.4,1,"F");
    y+=rh+2.5;
  });

  // ══ PAGE 3 — insights + action plan ════════════════════════════
  doc.addPage(); _dkPage(doc,W,H);
  _dkSub(doc,W,ml,mr,sf,`Session #${num1} vs #${num2} · ${nowStr}`);
  y=22;

  const improvedRows=[...metRows].filter(r=>r.d>0).sort((a,b)=>b.d-a.d);
  const regressed=[...metRows].filter(r=>r.d<0);
  y=_dkSection(doc,sf,ml,y,isAr?"أبرز النتائج":"KEY FINDINGS");
  const findH=26, halfF=(cw-5)/2;
  // Best improvement
  _dkCard(doc,ml,y,halfF,findH,5,DK.CARD2);
  fc(doc,...DK.green); rr(doc,ml,y,halfF,2.5,1.5,"F"); doc.rect(ml,y+1.2,halfF,1.3,"F");
  sf(5.5,"bold"); tc(doc,...DK.green); doc.text(isAr?"أكبر تحسن":"BIGGEST IMPROVEMENT",ml+5,y+8);
  sf(8.5,"bold"); tc(doc,...DK.TEXT);
  doc.text(improvedRows[0]?`${improvedRows[0].lbl}  ${dstr(improvedRows[0].d)}`:(isAr?"لا يوجد تحسن":"No improvements"),ml+5,y+16);
  sf(5.5,"normal"); tc(doc,...DK.TEXT2);
  doc.text(improvedRows[0]?`${improvedRows[0].sc1} → ${improvedRows[0].sc2}`:"—",ml+5,y+22);
  // Biggest regression
  _dkCard(doc,ml+halfF+5,y,halfF,findH,5,DK.CARD2);
  fc(doc,...DK.red); rr(doc,ml+halfF+5,y,halfF,2.5,1.5,"F"); doc.rect(ml+halfF+5,y+1.2,halfF,1.3,"F");
  sf(5.5,"bold"); tc(doc,...DK.red); doc.text(isAr?"أكبر تراجع":"BIGGEST REGRESSION",ml+halfF+10,y+8);
  sf(8.5,"bold"); tc(doc,...DK.TEXT);
  doc.text(regressed[0]?`${regressed[0].lbl}  ${dstr(regressed[0].d)}`:(isAr?"لا يوجد تراجع":"No regressions"),ml+halfF+10,y+16);
  sf(5.5,"normal"); tc(doc,...DK.TEXT2);
  doc.text(regressed[0]?`${regressed[0].sc1} → ${regressed[0].sc2}`:"—",ml+halfF+10,y+22);
  y+=findH+8;

  // ── Action plan (from worst regressed metrics) ─────────────────
  y=_dkSection(doc,sf,ml,y,isAr?"خطة الإجراءات المقترحة":"RECOMMENDED ACTION PLAN");
  const NXT={
    neck_lean:["Raise monitor: top edge at eye level","Chin tuck 10 reps × 3 sets daily","Set posture alert every 20 min"],
    head_tilt:["Level monitor and check seating height","Head levelling exercise 10 reps daily","Ergonomic assessment recommended"],
    shoulder: ["Level armrests to equal height","Shoulder rolls backward 10 reps × 3","Doorway chest stretch 30s × 2 daily"],
    spine_align:["Align ear, shoulder, hip vertically","Lumbar support roll or cushion","Core brace 30s × 5 reps daily"],
    spine_lean:["Check chair tilt and lumbar support","Side stretch 30s each direction × 2","Walk 5 min every 45 min"],
    distance: ["Screen 50–70cm from eyes","Increase font size to reduce forward lean","20-20-20 rule: every 20 min look 20ft away"],
    default:  ["2-min stretch break every 30 min","Roll shoulders backward 5 times","Walk 5 min every hour"],
  };
  const NXT_ALIAS={
    neck_lean_side:"neck_lean", head_yaw:"neck_lean",
    screen_distance:"distance", dist:"distance",
    shoulder_level:"shoulder", rounded_shoulders:"shoulder",
    fhp:"neck_lean", fhp_index:"neck_lean", fhp_side:"neck_lean",
    trunk_lean:"spine_lean",
  };
  const planRows=(regressed.length?regressed:metRows).slice(0,3);
  planRows.forEach((r,idx)=>{
    if(y>H-46){doc.addPage();_dkPage(doc,W,H);_dkSub(doc,W,ml,mr,sf,"Action plan (cont.)");y=22;}
    const col=_dkSc(r.sc2), ph=36;
    _dkCard(doc,ml,y,cw,ph);
    fc(doc,...col); doc.rect(ml,y,2.5,ph,"F"); rr(doc,ml,y,2.5,ph,1.2,"F");
    // Number circle
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
    doc.circle(ml+13,y+ph/2,8,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    dc(doc,...col); lw(doc,.8); doc.circle(ml+13,y+ph/2,8,"S"); lw(doc,.3);
    sf(9,"bold"); tc(doc,...col); doc.text(String(idx+1),ml+13,y+ph/2+3,{align:"center"});
    sf(8.5,"bold"); tc(doc,...DK.TEXT); doc.text(r.lbl,ml+26,y+9);
    sf(6,"normal"); tc(doc,...DK.TEXT3); doc.text(`${r.sc1} → ${r.sc2}  (${dstr(r.d)})`,ml+26,y+15);
    const steps=NXT[r.k]||NXT[NXT_ALIAS[r.k]]||NXT.default;
    sf(6.5,"normal"); tc(doc,...DK.TEXT2);
    steps.slice(0,3).forEach((s,i)=>{
      sf(6.5,"bold"); tc(doc,...col); doc.text(`${i+1}.`,ml+26,y+21+i*5.5);
      sf(6.5,"normal"); tc(doc,...DK.TEXT2); doc.text(doc.splitTextToSize(s,cw-40)[0],ml+31,y+21+i*5.5);
    });
    y+=ph+5;
  });

  // AI summary
  if(aiSummary){
    if(y>H-36){doc.addPage();_dkPage(doc,W,H);_dkSub(doc,W,ml,mr,sf,"");y=22;}
    const lines=doc.splitTextToSize(aiSummary.replace(/[#*`]/g,""),cw-14);
    const ah=Math.min(10+lines.length*5,60);
    _dkCard(doc,ml,y,cw,ah,5,DK.CARD2);
    sf(6,"bold"); tc(doc,...DK.cyan); doc.text(isAr?"ملخص الذكاء الاصطناعي":"AI SUMMARY",ml+5,y+7);
    sf(6.5,"normal"); tc(doc,...DK.TEXT2);
    lines.slice(0,Math.floor((ah-12)/5)).forEach((l,i)=>doc.text(l,ml+5,y+13+i*5));
    y+=ah+5;
  }

  // Footers on every page
  const tp=doc.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++){ doc.setPage(p); _dkFooter(doc,W,ml,mr,H,sf,p,tp); }

  const filename=`Posmoz_Comparison_S${num1}_vs_S${num2}_${now.toISOString().slice(0,10)}.pdf`;
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
// ═══════════════════════════════════════════════════════════════════
// TEAM PDF — HR aggregate report, dark premium design
// Same visual family as the Elite session report.
// ═══════════════════════════════════════════════════════════════════
export async function generateTeamPDF({ users=[], company="", dateRange=30, profile, lang="en", aiSummary="" }) {
  const { jsPDF } = await import("jspdf");
  const isAr = lang==="ar";
  const doc  = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  await Promise.all([_ensureCairoFont(doc), _ensureLogo()]);
  const W=210, H=297, ml=14, mr=14, cw=W-ml-mr;
  const sf  = (sz,st="normal") => font(doc,sz,st,isAr&&_cairoLoaded);
  const now = new Date();
  const nowStr = now.toLocaleDateString(isAr?"ar-EG":"en-US",{year:"numeric",month:"long",day:"numeric"});

  // ── DATA ──────────────────────────────────────────────────────
  const members=[...users].map(u=>({
    name:u.name||u.email?.split("@")[0]||"—",
    email:u.email||"",
    score:Math.round(u.avg_score||0),
    sessions:u.session_count??u.sessions??0,
  })).sort((a,b)=>b.score-a.score);
  const n=members.length;
  const withScore=members.filter(m=>m.score>0);
  const teamAvg=withScore.length?Math.round(withScore.reduce((a,m)=>a+m.score,0)/withScore.length):0;
  const atRisk=members.filter(m=>m.score>0&&m.score<50);
  const strong=members.filter(m=>m.score>=80);
  const inactive=members.filter(m=>!m.sessions);
  const buckets=[
    [isAr?"ممتاز (80+)":"Excellent (80+)",members.filter(m=>m.score>=80).length,DK.green],
    [isAr?"جيد (60–79)":"Good (60–79)",members.filter(m=>m.score>=60&&m.score<80).length,DK.amber],
    [isAr?"مقبول (50–59)":"Fair (50–59)",members.filter(m=>m.score>=50&&m.score<60).length,[251,146,60]],
    [isAr?"خطر (<50)":"At risk (<50)",atRisk.length,DK.red],
    [isAr?"غير نشط":"Inactive",inactive.length,DK.TEXT3],
  ];
  const maxBucket=Math.max(1,...buckets.map(b=>b[1]));

  // ══ PAGE 1 ═════════════════════════════════════════════════════
  _dkPage(doc,W,H);
  _dkHeader(doc,W,ml,mr,sf,
    isAr?`تقرير فريق ${company||""}`:`${company||"Team"} — Workforce Posture Report`,
    `LAST ${dateRange} DAYS · HR AGGREGATE · CONFIDENTIAL`,
    "ENTERPRISE",DK.green,`Generated: ${nowStr}`);
  let y=28;

  // KPI row
  const kw=(cw-12)/4;
  [[isAr?"الأعضاء":"Members",String(n),DK.blue],
   [isAr?"متوسط الفريق":"Team Average",String(teamAvg),_dkSc(teamAvg)],
   [isAr?"معرضون للخطر":"At Risk",String(atRisk.length),atRisk.length?DK.red:DK.green],
   [isAr?"أداء ممتاز":"Top Performers",String(strong.length),DK.green]]
    .forEach(([l,v,c],i)=>_dkKpi(doc,sf,ml+i*(kw+4),y,kw,22,l,v,c));
  y+=28;

  // Distribution + team ring row
  const distW=cw-72;
  _dkCard(doc,ml,y,distW,58);
  sf(6.5,"bold"); tc(doc,...DK.TEXT3); doc.text(isAr?"توزيع مستويات الفريق":"SCORE DISTRIBUTION",ml+5,y+7);
  buckets.forEach(([lbl,count,col],i)=>{
    const by=y+13+i*9;
    sf(6,"normal"); tc(doc,...DK.TEXT2); doc.text(lbl,ml+5,by+3.5);
    const bx=ml+44,bw2=distW-58;
    fc(doc,...DK.BORDER);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.5}));
    rr(doc,bx,by,bw2,4.5,2,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    fc(doc,...col); rr(doc,bx,by,Math.max(bw2*(count/maxBucket),count?3:0),4.5,2,"F");
    sf(6.5,"bold"); tc(doc,...col); doc.text(String(count),bx+bw2+4,by+3.7);
  });
  // Team average ring
  _dkCard(doc,ml+distW+4,y,cw-distW-4,58,6,DK.CARD2);
  sf(6,"bold"); tc(doc,...DK.TEXT3); doc.text(isAr?"متوسط الفريق":"TEAM AVERAGE",ml+distW+4+(cw-distW-4)/2,y+8,{align:"center"});
  _dkRing(doc,sf,ml+distW+4+(cw-distW-4)/2,y+32,15,teamAvg);
  sf(6.5,"bold"); tc(doc,..._dkSc(teamAvg));
  doc.text(_scoreLabel(teamAvg,isAr),ml+distW+4+(cw-distW-4)/2,y+53,{align:"center"});
  y+=64;

  // Leaderboard
  y=_dkSection(doc,sf,ml,y,isAr?"ترتيب الأعضاء":"MEMBER LEADERBOARD");
  _dkCard(doc,ml,y,cw,9,3,DK.CARD2);
  sf(5.5,"bold"); tc(doc,...DK.TEXT3);
  doc.text("#",ml+5,y+6);
  doc.text(isAr?"العضو":"MEMBER",ml+14,y+6);
  doc.text(isAr?"الجلسات":"SESSIONS",ml+cw*.52,y+6);
  doc.text(isAr?"النتيجة":"SCORE",ml+cw*.68,y+6);
  doc.text(isAr?"الحالة":"STATUS",ml+cw-6,y+6,{align:"right"});
  y+=11;
  const rowH=10.5;
  members.forEach((m,i)=>{
    if(y>H-16){
      doc.addPage(); _dkPage(doc,W,H);
      _dkSub(doc,W,ml,mr,sf,`${company||"Team"} · ${nowStr}`);
      y=22;
    }
    const col=m.score?_dkSc(m.score):DK.TEXT3;
    _dkCard(doc,ml,y,cw,rowH,2.5,i%2===0?DK.CARD:DK.CARD2);
    // Rank
    sf(6.5,"bold"); tc(doc,...(i<3?DK.amber:DK.TEXT3)); doc.text(String(i+1),ml+5,y+7);
    // Avatar initial
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.18}));
    doc.circle(ml+17,y+rowH/2,3.6,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(6,"bold"); tc(doc,...col); doc.text((m.name[0]||"?").toUpperCase(),ml+17,y+7,{align:"center"});
    sf(7,"bold"); tc(doc,...DK.TEXT); doc.text(m.name.length>26?m.name.slice(0,26)+"…":m.name,ml+23,y+7);
    sf(6.5,"normal"); tc(doc,...DK.TEXT2); doc.text(String(m.sessions),ml+cw*.52,y+7);
    // Score bar + number
    const bx=ml+cw*.60,bw2=cw*.16;
    fc(doc,...DK.BORDER);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.5}));
    rr(doc,bx,y+3.5,bw2,3.5,1.5,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    if(m.score){ fc(doc,...col); rr(doc,bx,y+3.5,Math.max(bw2*(m.score/100),2),3.5,1.5,"F"); }
    sf(7,"bold"); tc(doc,...col); doc.text(m.score?String(m.score):"—",bx+bw2+4,y+7);
    // Status pill
    const st=m.score>=80?(isAr?"ممتاز":"Excellent"):m.score>=60?(isAr?"جيد":"Good"):m.score>=50?(isAr?"مقبول":"Fair"):m.score>0?(isAr?"خطر":"At risk"):(isAr?"غير نشط":"Inactive");
    const sw2=doc.getTextWidth(st)+7;
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
    rr(doc,ml+cw-6-sw2,y+2.7,sw2,5.6,2,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(5.5,"bold"); tc(doc,...col); doc.text(st,ml+cw-6-sw2/2,y+6.7,{align:"center"});
    y+=rowH+2;
  });

  // At-risk callout
  if(atRisk.length){
    if(y>H-30){doc.addPage();_dkPage(doc,W,H);_dkSub(doc,W,ml,mr,sf,`${company||"Team"} · ${nowStr}`);y=22;}
    const names=atRisk.slice(0,6).map(m=>m.name).join(" · ")+(atRisk.length>6?` +${atRisk.length-6}`:"");
    const lines=doc.splitTextToSize(isAr
      ?`${atRisk.length} أعضاء تحت عتبة الخطر (<50). يُنصح بمراجعة بيئة عملهم وتفعيل تنبيهات الوضعية: ${names}`
      :`${atRisk.length} member(s) below the risk threshold (<50). Recommend a workstation review and enabling posture alerts: ${names}`,cw-14);
    const ah=10+lines.length*5;
    _dkCard(doc,ml,y,cw,ah,5,DK.CARD2);
    fc(doc,...DK.red); doc.rect(ml,y,2.5,ah,"F"); rr(doc,ml,y,2.5,ah,1.2,"F");
    sf(6.5,"normal"); tc(doc,...DK.TEXT2);
    lines.forEach((l,i)=>doc.text(l,ml+7,y+7+i*5));
    y+=ah+5;
  }

  // Footers
  const tp=doc.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++){ doc.setPage(p); _dkFooter(doc,W,ml,mr,H,sf,p,tp); }

  const filename=`Posmoz_Team_Report_${(company||"Team").replace(/\s/g,"_")}_${new Date().toISOString().slice(0,10)}.pdf`;
  await doc.save(filename, {returnPromise:true});
  return filename;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2 — FEATURE 3: White-label PDF support
// Pass companyName + companyLogoBase64 → overrides Posmoz branding in header
// ═══════════════════════════════════════════════════════════════════
// White-label is handled by the shared _logo helper + _coverHdr:
// Pass { companyName, companyLogo } in profile to activate.
// Already wired: _logo() checks profile?.companyLogo before drawing Posmoz logo.
// Nothing additional needed here — the architecture supports it via profile fields.
// To activate: set profile.companyName + profile.companyLogo (base64 PNG) in Firestore.


// ═══════════════════════════════════════════════════════════════════
// PHASE 3 — FEATURE 1: Shareable Web Report
// Creates a Firestore snapshot + returns a shareable URL
// The URL opens SharedReportPage.jsx (public, no login required)
// Link auto-expires in 30 days
// ═══════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════
// LONGITUDINAL PDF — multi-session progress report, dark premium design
// Same visual family as the Elite session report.
// ═══════════════════════════════════════════════════════════════════
export async function generateLongitudinalPDF({ sessions=[], profile, user, lang="en", aiSummary="" }) {
  const { jsPDF } = await import("jspdf");
  if (sessions.length < 2) { console.warn("[PDF] Need more sessions for longitudinal"); }
  const isAr = lang==="ar";
  const tier = _t(profile?.tier||"standard");
  const doc  = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  await Promise.all([_ensureCairoFont(doc), _ensureLogo()]);
  const W=210, H=297, ml=14, mr=14, cw=W-ml-mr;
  const sf  = (sz,st="normal") => font(doc,sz,st,isAr&&_cairoLoaded);
  const now = new Date();
  const nowStr = now.toLocaleDateString(isAr?"ar-EG":"en-US",{year:"numeric",month:"long",day:"numeric"});
  const name   = profile?.name||user?.displayName||user?.email?.split("@")[0]||(isAr?"مستخدم":"User");
  const tierLbl= tierAtLeast(tier,"elite")?"ELITE":tierAtLeast(tier,"professional")?"PROFESSIONAL":"STARTER";
  const tierCol= tierAtLeast(tier,"elite")?DK.green:tierAtLeast(tier,"professional")?DK.violet:DK.blue;

  // ── DATA ──────────────────────────────────────────────────────
  // sessions arrive newest-first from Firestore — chart oldest→newest
  const ss=[...sessions].reverse();
  const scores=ss.map(s=>Math.round(s.avg_score||0));
  const n=scores.length;
  const avgAll = n?Math.round(scores.reduce((a,b)=>a+b,0)/n):0;
  const best   = n?Math.max(...scores):0;
  const deltaAll = n>1?scores[n-1]-scores[0]:0;
  const dstr = d => (d>0?"+":"")+d;
  const deltaCol = deltaAll>0?DK.green:deltaAll<0?DK.red:DK.TEXT2;
  const sd = n>1?Math.sqrt(scores.reduce((s,v)=>s+(v-avgAll)**2,0)/n):0;
  const consistency=Math.max(0,Math.min(100,Math.round(100-sd*3)));
  const totalMin = Math.round(ss.reduce((a,s)=>a+(s.duration_s||s.duration_sec||0),0)/60);

  // Weekday averages
  const dayBuckets=Array.from({length:7},()=>[]);
  ss.forEach(s=>{ try{const d=s.created_at?.toDate?s.created_at.toDate():new Date(s.created_at);dayBuckets[d.getDay()].push(Math.round(s.avg_score||0));}catch{} });
  const dayAvg=dayBuckets.map(b=>b.length?Math.round(b.reduce((a,x)=>a+x,0)/b.length):null);
  const dayNames=isAr?["أحد","اثنين","ثلاثاء","أربعاء","خميس","جمعة","سبت"]:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  // Zone risk averaged over sessions with metrics
  const zonals=ss.filter(s=>s.metrics).map(s=>_zonalRisk(s.metrics));
  const zAvg=k=>zonals.length?Math.round(zonals.reduce((a,z)=>a+(z[k]||0),0)/zonals.length):0;
  const zoneAvg={cervical:zAvg("cervical"),thoracic:zAvg("thoracic"),lumbar:zAvg("lumbar")};
  // First-half vs second-half zone trend
  const halfN=Math.floor(zonals.length/2);
  const zHalf=(arr,k)=>arr.length?Math.round(arr.reduce((a,z)=>a+(z[k]||0),0)/arr.length):0;
  const zoneEarly={cervical:zHalf(zonals.slice(0,halfN),"cervical"),thoracic:zHalf(zonals.slice(0,halfN),"thoracic"),lumbar:zHalf(zonals.slice(0,halfN),"lumbar")};
  const zoneLate ={cervical:zHalf(zonals.slice(halfN),"cervical"), thoracic:zHalf(zonals.slice(halfN),"thoracic"), lumbar:zHalf(zonals.slice(halfN),"lumbar")};

  // ══ PAGE 1 — trend hero ════════════════════════════════════════
  _dkPage(doc,W,H);
  _dkHeader(doc,W,ml,mr,sf,
    isAr?"تقرير التقدم طويل المدى":"Longitudinal Progress Report",
    `${n} SESSIONS ANALYSED · AI-POWERED TREND INTELLIGENCE`,
    tierLbl,tierCol,`Generated: ${nowStr}`);
  let y=28;

  // KPI row
  const kw=(cw-12)/4;
  [[isAr?"الجلسات":"Sessions",String(n),DK.blue],
   [isAr?"المتوسط":"Average",`${avgAll}`,_dkSc(avgAll)],
   [isAr?"الأفضل":"Best",`${best}`,DK.green],
   [isAr?"التغير الكلي":"Overall Change",dstr(deltaAll),deltaCol]]
    .forEach(([l,v,c],i)=>_dkKpi(doc,sf,ml+i*(kw+4),y,kw,22,l,v,c));
  y+=28;

  // Big trend chart
  _dkCard(doc,ml,y,cw,66);
  sf(6.5,"bold"); tc(doc,...DK.TEXT3); doc.text(isAr?"مسار النتيجة عبر الجلسات":"SCORE TREND ACROSS SESSIONS",ml+5,y+7);
  if(n>=2){
    const pts=_dkChart(doc,sf,scores,ml+10,y+13,cw-20,40,DK.blue);
    // Average reference line
    const lo=Math.max(0,Math.min(...scores)-5), hi=Math.min(100,Math.max(...scores)+5), rng=Math.max(hi-lo,10);
    const avgY=y+13+40-((avgAll-lo)/rng)*40;
    dc(doc,...DK.amber); lw(doc,.4);
    for(let gx=ml+10;gx<ml+cw-12;gx+=4) doc.line(gx,avgY,gx+2,avgY);
    lw(doc,.3);
    sf(5,"bold"); tc(doc,...DK.amber); doc.text(`AVG ${avgAll}`,ml+cw-11,avgY-1.5,{align:"right"});
    // First/last labels
    if(pts){
      sf(6,"bold"); tc(doc,...DK.blue);
      doc.text(String(scores[0]),pts[0].px,pts[0].py-3.5,{align:"center"});
      doc.text(String(scores[n-1]),pts[n-1].px,pts[n-1].py-3.5,{align:"center"});
    }
    // X labels: first + last session dates
    sf(4.5,"normal"); tc(doc,...DK.TEXT3);
    doc.text(_fmtDate(ss[0]?.created_at,isAr),ml+10,y+60);
    doc.text(_fmtDate(ss[n-1]?.created_at,isAr),ml+cw-10,y+60,{align:"right"});
  } else {
    sf(7,"normal"); tc(doc,...DK.TEXT2); doc.text(isAr?"جلستان على الأقل مطلوبتان":"At least 2 sessions required",ml+cw/2,y+35,{align:"center"});
  }
  y+=72;

  // Trend verdict + consistency row
  const verdict = deltaAll>5?(isAr?"تحسن واضح":"Clear improvement")
                : deltaAll<-5?(isAr?"تراجع يحتاج انتباه":"Decline — needs attention")
                : (isAr?"أداء مستقر":"Stable performance");
  const halfC=(cw-5)/2;
  _dkCard(doc,ml,y,halfC,34,5,DK.CARD2);
  fc(doc,...deltaCol); rr(doc,ml,y,halfC,2.5,1.5,"F"); doc.rect(ml,y+1.2,halfC,1.3,"F");
  sf(5.5,"bold"); tc(doc,...DK.TEXT3); doc.text(isAr?"الاتجاه العام":"OVERALL TRAJECTORY",ml+5,y+9);
  sf(10,"bold"); tc(doc,...deltaCol); doc.text(verdict,ml+5,y+18);
  sf(6,"normal"); tc(doc,...DK.TEXT2);
  doc.text(`${isAr?"من":"From"} ${scores[0]||0} ${isAr?"إلى":"to"} ${scores[n-1]||0} (${dstr(deltaAll)} ${isAr?"نقطة":"pts"})`,ml+5,y+26);
  _dkCard(doc,ml+halfC+5,y,halfC,34,5,DK.CARD2);
  fc(doc,..._dkSc(consistency)); rr(doc,ml+halfC+5,y,halfC,2.5,1.5,"F"); doc.rect(ml+halfC+5,y+1.2,halfC,1.3,"F");
  sf(5.5,"bold"); tc(doc,...DK.TEXT3); doc.text(isAr?"ثبات الأداء":"CONSISTENCY INDEX",ml+halfC+10,y+9);
  sf(12,"bold"); tc(doc,..._dkSc(consistency)); doc.text(`${consistency}%`,ml+halfC+10,y+19);
  sf(6,"normal"); tc(doc,...DK.TEXT2);
  doc.text(isAr?`تذبذب ±${Math.round(sd)} نقطة · ${totalMin} دقيقة مراقبة`:`±${Math.round(sd)} pts variation · ${totalMin} min monitored`,ml+halfC+10,y+27);
  y+=40;

  // ══ PAGE 2 — patterns + zones ══════════════════════════════════
  doc.addPage(); _dkPage(doc,W,H);
  _dkSub(doc,W,ml,mr,sf,`${name} · ${nowStr}`);
  y=22;

  // Weekday pattern bars
  y=_dkSection(doc,sf,ml,y,isAr?"النمط الأسبوعي":"WEEKLY PATTERN — AVERAGE SCORE BY DAY");
  _dkCard(doc,ml,y,cw,56);
  const bw3=(cw-24)/7, bMaxH=32, bBase=y+44;
  dayAvg.forEach((v,i)=>{
    const bx=ml+8+i*(bw3+1.5);
    if(v==null){
      fc(doc,...DK.BORDER);
      doc.setGState&&doc.setGState(new doc.GState({opacity:.35}));
      rr(doc,bx,bBase-4,bw3-3,4,1.5,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    } else {
      const bh2=Math.max(5,(v/100)*bMaxH), col=_dkSc(v);
      fc(doc,...col);
      doc.setGState&&doc.setGState(new doc.GState({opacity:.85}));
      rr(doc,bx,bBase-bh2,bw3-3,bh2,1.5,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      sf(6,"bold"); tc(doc,...col); doc.text(String(v),bx+(bw3-3)/2,bBase-bh2-2,{align:"center"});
    }
    sf(5,"normal"); tc(doc,...DK.TEXT3); doc.text(dayNames[i],bx+(bw3-3)/2,bBase+5,{align:"center"});
  });
  sf(5,"normal"); tc(doc,...DK.TEXT3);
  doc.text(isAr?"الأيام الرمادية: لا توجد جلسات":"Grey stubs: no sessions on that weekday",ml+5,y+53);
  y+=62;

  // Zone risk trend (early vs late half)
  y=_dkSection(doc,sf,ml,y,isAr?"تطور مخاطر مناطق العمود الفقري":"SPINAL ZONE RISK — EARLY vs RECENT SESSIONS");
  _dkCard(doc,ml,y,cw,50);
  let zy2=y+9;
  [[isAr?"الرقبة (C1–C7)":"Cervical (C1–C7)","cervical"],
   [isAr?"الظهر العلوي (T1–T12)":"Thoracic (T1–T12)","thoracic"],
   [isAr?"أسفل الظهر (L1–S1)":"Lumbar (L1–S1)","lumbar"]].forEach(([lbl,k])=>{
    zy2=_dkDualBar(doc,sf,ml+5,zy2,cw-10,lbl,zoneEarly[k]||0,zoneLate[k]||0,DK.TEXT3,_riskColorDk(zoneLate[k]||0));
  });
  sf(5,"normal"); tc(doc,...DK.TEXT3);
  doc.text(isAr?"شريط أول = النصف الأقدم · شريط ثانٍ = النصف الأحدث · أقل = أفضل":"Top bar = earlier half · bottom bar = recent half · lower is better",ml+5,y+47);
  y+=56;

  // Recent sessions table
  y=_dkSection(doc,sf,ml,y,isAr?"آخر الجلسات":"RECENT SESSIONS");
  const recent=[...ss].reverse().slice(0,8); // newest first
  _dkCard(doc,ml,y,cw,9,3,DK.CARD2);
  sf(5.5,"bold"); tc(doc,...DK.TEXT3);
  doc.text("#",ml+6,y+6);
  doc.text(isAr?"التاريخ":"DATE",ml+18,y+6);
  doc.text(isAr?"المدة":"DURATION",ml+cw*.45,y+6);
  doc.text(isAr?"جيدة":"GOOD %",ml+cw*.63,y+6);
  doc.text(isAr?"النتيجة":"SCORE",ml+cw-6,y+6,{align:"right"});
  y+=11;
  recent.forEach((s,i)=>{
    if(y>H-20) return;
    const sc=Math.round(s.avg_score||0), col=_dkSc(sc);
    _dkCard(doc,ml,y,cw,9.5,2.5,i%2===0?DK.CARD:DK.CARD2);
    sf(6.5,"bold"); tc(doc,...DK.TEXT2); doc.text(String(n-i),ml+6,y+6.5);
    sf(6.5,"normal"); tc(doc,...DK.TEXT); doc.text(_fmtDate(s.created_at,isAr),ml+18,y+6.5);
    tc(doc,...DK.TEXT2); doc.text(_fmtDur(s.duration_s||s.duration_sec||0),ml+cw*.45,y+6.5);
    doc.text(`${Math.round(s.good_pct||0)}%`,ml+cw*.63,y+6.5);
    sf(7,"bold"); tc(doc,...col); doc.text(String(sc),ml+cw-6,y+6.5,{align:"right"});
    y+=11;
  });

  // ══ PAGE 3 — AI narrative + programme ══════════════════════════
  doc.addPage(); _dkPage(doc,W,H);
  _dkSub(doc,W,ml,mr,sf,`${name} · ${nowStr}`);
  y=22;

  y=_dkSection(doc,sf,ml,y,isAr?"قراءة Posmoz AI":"POSMOZ AI READING");
  const narrative = aiSummary && aiSummary.trim() ? aiSummary : (
    deltaAll>5
      ? `Across ${n} sessions your average posture score climbed from ${scores[0]} to ${scores[n-1]} (${dstr(deltaAll)} points). The trend is genuinely positive — the biggest remaining opportunity is consistency: your scores vary by ±${Math.round(sd)} points between sessions. Anchoring your monitor height and taking scheduled micro-breaks will compress that variance and lock in the gains.`
      : deltaAll<-5
      ? `Across ${n} sessions your average posture score declined from ${scores[0]} to ${scores[n-1]} (${dstr(deltaAll)} points). Declines of this size usually track a workspace change or longer unbroken sitting periods. Review the action plan below and treat the highest-risk spinal zone (${Object.entries(zoneAvg).sort((a,b)=>b[1]-a[1])[0][0]}) as the priority.`
      : `Across ${n} sessions your posture score has held steady around ${avgAll}/100 with ±${Math.round(sd)} points of variation. Stability is a good foundation — the fastest route upward is attacking your weakest recurring metric during the ${dayAvg.indexOf(Math.min(...dayAvg.filter(v=>v!=null)))>=0?dayNames[dayAvg.indexOf(Math.min(...dayAvg.filter(v=>v!=null)))]:"lowest-scoring"} sessions.`);
  const narLines=doc.splitTextToSize(narrative.replace(/[#*`]/g,""),cw-14);
  const narH=Math.min(12+narLines.length*5.2,70);
  _dkCard(doc,ml,y,cw,narH,5,DK.CARD2);
  fc(doc,...DK.cyan); doc.rect(ml,y,2.5,narH,"F"); rr(doc,ml,y,2.5,narH,1.2,"F");
  sf(6.5,"normal"); tc(doc,...DK.TEXT2);
  narLines.slice(0,Math.floor((narH-8)/5.2)).forEach((l,i)=>doc.text(l,ml+7,y+8+i*5.2));
  y+=narH+8;

  // 8-week programme
  y=_dkSection(doc,sf,ml,y,isAr?"برنامج 8 أسابيع المقترح":"SUGGESTED 8-WEEK PROGRAMME");
  const prog=[
    ["W1–2",isAr?"التأسيس":"Foundation",   isAr?"ضبط بيئة العمل: ارتفاع الشاشة، مسند قطني، مسافة 50–70سم":"Workstation setup: monitor height, lumbar support, 50–70cm distance",DK.blue],
    ["W3–4",isAr?"بناء العادة":"Habit building", isAr?"تنبيه وضعية كل 20 دقيقة + استراحة حركة كل 45 دقيقة":"Posture alert every 20 min + movement break every 45 min",DK.cyan],
    ["W5–6",isAr?"التقوية":"Strengthening", isAr?"تمارين الرقبة العميقة وشد لوحي الكتف يومياً":"Daily deep-neck flexor + scapular retraction exercises",DK.violet],
    ["W7–8",isAr?"التثبيت":"Consolidation", isAr?"جلسة مراقبة يومية والحفاظ على النتيجة فوق المتوسط الحالي":"Daily monitored session; hold scores above your current average",DK.green],
  ];
  prog.forEach(([wk,title,desc,col],i)=>{
    if(y>H-32){doc.addPage();_dkPage(doc,W,H);_dkSub(doc,W,ml,mr,sf,"");y=22;}
    const ph=22;
    _dkCard(doc,ml,y,cw,ph);
    fc(doc,...col); doc.rect(ml,y,2.5,ph,"F"); rr(doc,ml,y,2.5,ph,1.2,"F");
    // Week chip
    const ww=doc.getTextWidth(wk)+8;
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:.15}));
    rr(doc,ml+6,y+6,ww,9,2,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    sf(6.5,"bold"); tc(doc,...col); doc.text(wk,ml+6+ww/2,y+12,{align:"center"});
    sf(8,"bold"); tc(doc,...DK.TEXT); doc.text(title,ml+6+ww+6,y+10);
    sf(6.5,"normal"); tc(doc,...DK.TEXT2);
    doc.text(doc.splitTextToSize(desc,cw-ww-24)[0],ml+6+ww+6,y+16.5);
    y+=ph+4;
  });

  // Footers
  const tp=doc.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++){ doc.setPage(p); _dkFooter(doc,W,ml,mr,H,sf,p,tp); }

  const filename=`Posmoz_Longitudinal_${now.toISOString().slice(0,10)}.pdf`;
  await doc.save(filename, {returnPromise:true});
  return filename;
}

export async function generateAIPDF({ sessions=[], profile, aiSummary="", lang="en" }) {
  return generateLongitudinalPDF({ sessions, profile, lang, aiSummary });
}
