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
  font(doc,9,"bold",isAr);tc(doc,...PDF_TOKENS.ink);
  doc.text(doc.splitTextToSize(lbl,w*0.52-32)[0],x+27,y+9.5); // clamped — never collides with the bar
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
  // Title + score — title clamped so it never runs under the score badge
  font(doc,10,"bold",isAr);tc(doc,...PDF_TOKENS.ink);
  doc.text(doc.splitTextToSize(title,w-72)[0],x+30,y+12);
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
// Two-column layout: risk circle in a fixed left rail, ALL text in the
// right column — nothing can overlap the circle any more.
function _zone(doc,x,y,w,name,region,risk,desc,mlist,isAr){
  const col=_riskColor(risk);
  const txtX=x+37, txtW=w-44;
  const lines=doc.splitTextToSize(desc,txtW);
  const h=Math.max(52,32+lines.length*4.8+11);
  fc(doc,...PDF_TOKENS.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...col);lw(doc,0.25);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  // Risk badge — fixed left rail
  fc(doc,...col);doc.circle(x+19,y+24,11,"F");
  font(doc,9.5,"bold");tc(doc,...PDF_TOKENS.card);doc.text(`${risk}%`,x+19,y+26,{align:"center"});
  font(doc,5,"bold");doc.text(isAr?"خطر":"RISK",x+19,y+31,{align:"center"});
  // Title + region
  font(doc,10,"bold",isAr);tc(doc,...PDF_TOKENS.ink);
  doc.text(doc.splitTextToSize(name,txtW-30)[0],txtX,y+11);
  font(doc,7.5,"bold");tc(doc,...PDF_TOKENS.primary);doc.text(region,txtX,y+18);
  // Risk label pill (top right)
  const rlbl=_riskLabel(risk,isAr);
  const rw=doc.getTextWidth(rlbl)+8;
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
  rr(doc,x+w-rw-4,y+6,rw,9,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,7.5,"bold",isAr);tc(doc,...col);doc.text(rlbl,x+w-rw/2-4,y+12,{align:"center"});
  // Bar
  const bx=txtX,bw=w*.5;
  fc(doc,...PDF_TOKENS.borderSoft);rr(doc,bx,y+22,bw,4.5,2,"F");
  fc(doc,...col);rr(doc,bx,y+22,Math.max(bw*(risk/100),3),4.5,2,"F");
  // Desc — right column only
  font(doc,7.5,"normal",isAr);tc(doc,...PDF_TOKENS.sub);
  lines.forEach((l,i)=>doc.text(l,txtX,y+33+(i*4.8)));
  font(doc,6,"bold");tc(doc,...PDF_TOKENS.light);
  doc.text(doc.splitTextToSize(`Sources: ${mlist}`,txtW)[0],txtX,y+h-4.5);
  return y+h+6;
}

// ── INFO TABLE ROW ────────────────────────────────────────────────
function _iRow(doc,x,y,w,key,val,even,isAr){
  fc(doc,...(even?PDF_TOKENS.bg:PDF_TOKENS.card));doc.rect(x,y,w,8.5,"F");
  font(doc,PDF_FLAGS.small,"normal",isAr);tc(doc,...PDF_TOKENS.muted);
  doc.text(doc.splitTextToSize(String(key),w*0.38)[0],x+5,y+5.8);
  font(doc,PDF_FLAGS.small,"bold");tc(doc,...PDF_TOKENS.ink);
  doc.text(doc.splitTextToSize(String(val),w*0.58)[0],x+w-5,y+5.8,{align:"right"});
}

// ── _drawSparkline alias ──────────────────────────────────────────
function _drawSparkline(doc,hist,x,y,w,h,col){_spark(doc,hist,x,y,w,h,col);}

// ── Cover (page 1) ─────────────────────────────────────────────────
function _cover(doc,W,ml,tier,tierCol,name,sessionNum,dateStr,avg,isAr){
  // Full-bleed dark header — slate gradient feel
  fc(doc,...PDF_TOKENS.slate); doc.rect(0,0,W,68,"F");
  // Geometric circles for depth
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.07}));
  doc.circle(W*0.88,34,55,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.04}));
  doc.circle(W*0.88,34,80,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Thin top accent
  fc(doc,...tierCol); doc.rect(0,0,W,2.5,"F");

  // Logo
  _logo(doc,ml,18,32,_logoMd);

  // Brand + tagline
  font(doc,14,"bold"); tc(doc,...PDF_TOKENS.card);
  doc.text("POSMOZ",ml+40,30);
  font(doc,7,"normal"); tc(doc,148,163,184);
  doc.text("Health Intelligence Platform",ml+40,38);

  // Tier badge — pill
  const tl=tier.toUpperCase();
  font(doc,7,"bold"); tc(doc,...tierCol);
  const tw=doc.getTextWidth(tl)+10;
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.18}));
  rr(doc,ml+40,42,tw,10,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  tc(doc,...tierCol); font(doc,7,"bold");
  doc.text(tl,ml+40+tw/2,49,{align:"center"});

  // Right: date + session number
  font(doc,7,"normal"); tc(doc,148,163,184);
  doc.text(dateStr,W-ml,28,{align:"right"});
  font(doc,8,"bold"); tc(doc,...PDF_TOKENS.card);
  doc.text(`Session #${sessionNum}`,W-ml,37,{align:"right"});

  // Bottom accent bar
  fc(doc,...tierCol); doc.rect(0,65.5,W,2.5,"F");
}


// ═══════════════════════════════════════════════════════════════════
// generateSessionPDF — v4
// ═══════════════════════════════════════════════════════════════════


export async function generateSessionPDF({ session, profile, user, lang="en", sessionIndex, allSessions=[], aiSummary="" }) {
  const { jsPDF } = await import("jspdf");
  const isAr  = lang==="ar";
  const tier  = profile?.tier||session?.tier||"standard";
  const isElite = tierAtLeast(tier,"elite");
  const isPro   = !isElite && tierAtLeast(tier,"professional");
  const doc   = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});

  // Load assets (parallel)
  await Promise.all([_ensureCairoFont(doc), _ensureLogo()]);

  const W=210, H=297, ml=18, mr=18, cw=W-ml-mr;
  const tierCol = isElite?PDF_TOKENS.success:isPro?PDF_TOKENS.cyan:PDF_TOKENS.indigo;
  const avg     = Math.round(session.avg_score||0);
  const dur     = session.duration_s||session.duration_sec||0;
  const goodPct = Math.round(session.good_pct||0);
  const gradeC  = _sc(avg);
  const metrics = session.metrics||{};
  const hist    = session.score_history||[];
  const aiText  = session.ai_tip||session.ai_insight||session.claude_analysis||"";
  const painSum = session.pain_summary||"";
  const impTip  = session.improvement_tip||"";
  const name    = profile?.name||user?.displayName||user?.email?.split("@")[0]||(isAr?"مستخدم":"User");
  const email   = user?.email||"";
  const dateStr = _fmtDate(session.created_at||new Date(), isAr);
  const realIdx = (()=>{
    if(sessionIndex)return sessionIndex;
    if(allSessions.length){const i=allSessions.findIndex(s=>(s.id||s.session_id)===(session.id||session.session_id));if(i>=0)return allSessions.length-i;}
    return 1;
  })();

  const mEntries = Object.entries(metrics)
    .filter(([k])=>!k.startsWith("_")&&!NON_POSTURE_KEYS.has(k)&&metrics[k])
    .map(([k,v])=>{
      const sc=typeof v==="number"?v:(v?.score??100);
      const lbl=(isAr?METRIC_LABELS_AR[k]:METRIC_LABELS[k])||v?.label||k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      return{key:k,sc,lbl,value:v?.value,unit:v?.unit||""};
    }).sort((a,b)=>a.sc-b.sc);

  // ── NON-ELITE: premium preview + upsell ───────────────────────
  if(!isElite){
    _cover(doc,W,ml,tier,tierCol,name,realIdx,dateStr,avg,isAr);
    let y=76;

    // Report title
    font(doc,PDF_FLAGS.h1,"bold",isAr); tc(doc,...PDF_TOKENS.ink);
    doc.text(isAr?"تقرير تحليل الوضعية":"Posture Analysis Report",ml,y);
    font(doc,PDF_FLAGS.body,"normal",isAr); tc(doc,...PDF_TOKENS.muted);
    doc.text(`${name} · ${dateStr}`,ml,y+8); y+=20;
    hr(doc,ml,y,cw); y+=12;

    // Score ring + KPI chips — 3 chips of 36mm + 6mm gaps fill exactly
    // the space up to the right margin (54+3*36+2*6 = 174 = cw). The old
    // 46mm/52mm spacing pushed the last chip past the page edge.
    _ring(doc,ml+22,y+24,19,avg,isAr);
    [[`${goodPct}%`,isAr?"جيدة":"Good",PDF_TOKENS.success],
     [String(session.alerts_count||0),isAr?"تنبيهات":"Alerts",PDF_TOKENS.warning],
     [_fmtDur(dur),isAr?"المدة":"Duration",PDF_TOKENS.primary]]
      .forEach(([v,l,col],i)=>_kpi(doc,ml+54+i*42,y+4,36,30,v,l,col));
    y+=62; hr(doc,ml,y,cw); y+=12;

    // Sparkline
    if(hist.length>2){
      y=_sh(doc,ml,y,isAr?"مسار النقاط":"Score Timeline","",gradeC,isAr);
      fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,40,4,"F");
      dc(doc,...PDF_TOKENS.border); lw(doc,0.15); rr(doc,ml,y,cw,40,4,"S"); lw(doc,0.3);
      _spark(doc,hist,ml+12,y+7,cw-24,26,gradeC);
      y+=48;
    }

    // Top 3 metrics
    y=_sh(doc,ml,y,isAr?"أبرز المقاييس":"Key Metrics",isAr?"الأسوأ أداءً":"Worst first",gradeC,isAr);
    mEntries.slice(0,3).forEach(({lbl,value,unit,sc},i)=>{
      if(y>H-52)return;
      _mRow(doc,ml,y,cw,lbl,value,unit,sc,isAr,i); y+=25;
    });
    if(mEntries.length>3){
      fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,12,2,"F");
      font(doc,PDF_FLAGS.small,"normal",isAr); tc(doc,...PDF_TOKENS.muted);
      doc.text(`+ ${mEntries.length-3} ${isAr?"مقاييس — رقّي لـ Elite":"more metrics — upgrade to Elite"}`,ml+cw/2,y+8,{align:"center"});
      y+=16;
    }

    // PAGE 2 — Upsell
    doc.addPage();
    fc(doc,...PDF_TOKENS.slate); doc.rect(0,0,W,H,"F");
    fc(doc,...PDF_TOKENS.primary);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.05}));
    doc.circle(W*.85,H*.3,90,"F"); doc.circle(W*.1,H*.75,60,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    fc(doc,...PDF_TOKENS.primary); doc.rect(0,0,W,3,"F");
    _logo(doc,W/2-16,42,32,_logoMd);
    font(doc,PDF_FLAGS.display,"bold",isAr); tc(doc,...PDF_TOKENS.card);
    doc.text(isAr?"افتح تقريرك الكامل":"Unlock Your Full Report",W/2,92,{align:"center"});
    font(doc,PDF_FLAGS.body+1,"normal",isAr); tc(doc,148,163,184);
    doc.text(isAr?"رقّي لـ Elite للوصول لكامل تجربة Posmoz":"Upgrade to Posmoz Elite for the complete experience",W/2,101,{align:"center"});
    hr(doc,ml+24,109,cw-48,[55,65,81]);
    const feats=[
      [PDF_TOKENS.success,"Complete Metrics Breakdown","All posture metrics with angles, trends & scores"],
      [PDF_TOKENS.primary,"Posmoz AI Analysis","Personalised AI-generated clinical narrative"],
      [PDF_TOKENS.warning,"Spinal Zone Risk Map","Cervical · Thoracic · Lumbar risk assessment"],
      [PDF_TOKENS.cyan,"Prioritised Next Steps","3 tailored action cards from worst metrics"],
      [PDF_TOKENS.indigo,"Clinical PDF Report","Physiotherapist-ready report with full clinical detail"],
    ];
    let fy=117;
    feats.forEach(([col,title,desc])=>{
      fc(doc,...col); rr(doc,ml,fy,3,22,1.5,"F");
      font(doc,9.5,"bold",false); tc(doc,...PDF_TOKENS.card); doc.text(title,ml+10,fy+10);
      font(doc,7.5,"normal",false); tc(doc,100,116,139); doc.text(desc,ml+10,fy+17);
      fy+=27;
    });
    fy+=6;
    fc(doc,...PDF_TOKENS.success); rr(doc,ml,fy,cw,16,4,"F");
    font(doc,10,"bold",false); tc(doc,...PDF_TOKENS.card);
    doc.text("postureai-pro-omega-nine.vercel.app  →  Upgrade to Elite",W/2,fy+10.5,{align:"center"});

    const tot=doc.internal.getNumberOfPages();
    for(let p=1;p<=tot;p++){doc.setPage(p);_ftr(doc,W,ml,mr,H,p,tot,name);}
    await doc.save(`Posmoz_Session${realIdx}_${new Date().toISOString().slice(0,10)}.pdf`, {returnPromise:true}); return;
  }

  // ═══════════════════════════════════════════════════════════════
  // ELITE PAGE 1 — Cover + Summary
  // ═══════════════════════════════════════════════════════════════
  _cover(doc,W,ml,tier,tierCol,name,realIdx,dateStr,avg,isAr);
  let y=76;

  font(doc,PDF_FLAGS.h1,"bold",isAr); tc(doc,...PDF_TOKENS.ink);
  doc.text(isAr?"تقرير وضعية احترافي":"Professional Posture Report",ml,y);
  font(doc,PDF_FLAGS.body,"normal",isAr); tc(doc,...PDF_TOKENS.muted);
  doc.text(doc.splitTextToSize(`${name} · ${email||"—"} · ${dateStr}`,cw)[0],ml,y+8); y+=20;
  hr(doc,ml,y,cw); y+=12;

  // Ring + 3 KPI chips — 36mm chips + 6mm gaps end exactly at the right
  // margin. The old 4th chip (Session #) started AT the margin and was
  // rendered entirely off the page; the session number already appears
  // on the cover band top-right.
  _ring(doc,ml+22,y+24,19,avg,isAr);
  [[`${goodPct}%`,isAr?"جيدة":"Good",PDF_TOKENS.success],
   [String(session.alerts_count||0),isAr?"تنبيهات":"Alerts",PDF_TOKENS.warning],
   [_fmtDur(dur),isAr?"المدة":"Duration",PDF_TOKENS.primary]]
    .forEach(([v,l,col],i)=>_kpi(doc,ml+54+i*42,y+4,36,30,v,l,col));
  y+=62; hr(doc,ml,y,cw); y+=12;

  // Sparkline
  if(hist.length>2){
    y=_sh(doc,ml,y,isAr?"مسار النقاط":"Score Timeline",isAr?"الجلسة الكاملة":"Full session",gradeC,isAr);
    fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,42,4,"F");
    dc(doc,...PDF_TOKENS.border); lw(doc,0.15); rr(doc,ml,y,cw,42,4,"S"); lw(doc,0.3);
    _spark(doc,hist,ml+12,y+7,cw-24,28,gradeC);
    y+=50;
  }

  if(painSum){ y=_callout(doc,ml,y,cw,painSum,"warning",isAr); }
  if(impTip)  { y=_callout(doc,ml,y,cw,impTip,"success",isAr); }

  // Only start the Key Metrics preview if the heading AND at least one
  // row fit — a lone heading at the page bottom looked broken.
  if(y<=H-72){
    y=_sh(doc,ml,y,isAr?"أبرز المقاييس":"Key Metrics",isAr?"مرتبة حسب أولوية التحسين":"Prioritised — highest improvement opportunity first",gradeC,isAr);
    mEntries.slice(0,4).forEach(({lbl,value,unit,sc},i)=>{
      if(y>H-46)return;
      _mRow(doc,ml,y,cw,lbl,value,unit,sc,isAr,i); y+=25;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ELITE PAGE 2 — All metrics + Zonal map
  // ═══════════════════════════════════════════════════════════════
  doc.addPage(); _hdr(doc,W,ml,mr,isAr?"تفاصيل المقاييس":"Metrics Detail",isAr); y=24;
  y=_sh(doc,ml,y,isAr?"جميع مقاييس الوضعية":"Complete Posture Metrics",isAr?"مرتبة حسب أولوية التحسين":"Prioritised by improvement opportunity",gradeC,isAr);
  mEntries.forEach(({lbl,value,unit,sc},i)=>{
    if(y>H-38){doc.addPage();_hdr(doc,W,ml,mr,isAr?"تابع":"Continued",isAr);y=24;}
    _mRow(doc,ml,y,cw,lbl,value,unit,sc,isAr,i); y+=25;
  });

  y+=4; if(y>H-100){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خريطة المخاطر":"Risk Map",isAr);y=24;}
  y=_sh(doc,ml,y,isAr?"خريطة مناطق الخطر":"Spinal Zone Risk Map",isAr?"من بيانات الجلسة — ليس تشخيصاً طبياً":"Derived from session data · not a medical diagnosis",PDF_TOKENS.danger,isAr);
  const zonal=_zonalRisk(metrics);
  [{k:"cervical",en:"Cervical (Neck)",ar:"منطقة الرقبة",r:"C1–C7",
    desc:"Neck lean, FHP, and rotational deviation. Elevation increases cervical disc load and headache risk.",m:"Neck Lean, FHP, Head Tilt/Yaw"},
   {k:"thoracic",en:"Thoracic (Upper Back)",ar:"الظهر العلوي",r:"T1–T12",
    desc:"Shoulder symmetry and upper spinal curvature. Sustained elevation indicates kyphosis or rotator cuff risk.",m:"Shoulder Balance, Rounded Shoulders, Spine"},
   {k:"lumbar",en:"Lumbar (Lower Back)",ar:"أسفل الظهر",r:"L1–S1",
    desc:"Spinal alignment, hip angle, and pelvic positioning. Risk elevation may indicate disc asymmetry or flexion intolerance.",m:"Spine Alignment, Hip Angle, Trunk Lean"},
  ].forEach(({k,en,ar,r,desc,m})=>{
    if(y>H-65){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خريطة المخاطر":"Risk Map",isAr);y=24;}
    y=_zone(doc,ml,y,cw,isAr?ar:en,r,zonal[k]||0,desc,m,isAr);
  });

  // ═══════════════════════════════════════════════════════════════
  // ELITE PAGE 3 — AI + Next Steps + Stats
  // ═══════════════════════════════════════════════════════════════
  doc.addPage(); _hdr(doc,W,ml,mr,isAr?"التحليل والتوصيات":"Analysis & Recommendations",isAr); y=24;

  if(aiText){
    y=_sh(doc,ml,y,isAr?"تحليل Posmoz AI":"Posmoz AI Analysis",isAr?"مولّد خصيصاً لجلستك":"Generated specifically for this session",PDF_TOKENS.primary,isAr);
    fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,6,2,"F"); y+=9;
    const aiLines=doc.splitTextToSize(aiText.replace(/[#*`]/g,"").trim(),cw-6);
    font(doc,PDF_FLAGS.body,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
    aiLines.forEach(l=>{
      if(y>H-28){doc.addPage();_hdr(doc,W,ml,mr,"AI Analysis",isAr);y=24;}
      doc.text(l,ml+3,y); y+=5.2;
    });
    y+=10; hr(doc,ml,y,cw); y+=12;
  }

  if(y>H-110){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الخطوات التالية":"Next Steps",isAr);y=24;}
  y=_sh(doc,ml,y,isAr?"الخطوات العملية المقترحة":"Prioritised Next Steps",isAr?"بناءً على أسوأ المقاييس":"Based on worst-performing metrics",PDF_TOKENS.success,isAr);

  const NXT={
    neck:["Raise monitor: top edge at eye level","Chin tuck gently — ear over shoulder","Set a posture alert every 20 min"],
    neck_lean:["Raise monitor: top edge at eye level","Chin tuck gently — ear over shoulder","Cervical retraction: 10 reps × 3 sets daily"],
    yaw:["Centre monitor directly in front","Avoid sustained head rotation","Chin tucks: 10 reps × 3 sets daily"],
    dist:["Maintain 50–70cm screen distance","Increase font size to avoid leaning","20-20-20 rule: every 20 min look 20ft away"],
    posture:["Sit fully back against lumbar support","Feet flat, knees at 90°","Stand 5 min every 45 min"],
    shoulder:["Level armrests to equal height","Shoulder rolls backward 10 reps × 3","Doorway chest stretch 30s × 2 daily"],
    spine:["Align ear, shoulder, hip vertically","Use lumbar roll or support cushion","Core brace 30s × 5 reps daily"],
    rounded:["Retract shoulder blades together","Band pull-aparts 15 reps × 3","Pec doorway stretch 30s × 2 daily"],
    elbow:["Lower keyboard so elbows rest at 90°","Keep keyboard close to body","Wrist break every 45 min"],
    monitor:["Top of screen at eye level","Use laptop stand + external keyboard","Reduce neck flexion with tray adjustment"],
    distance:["Screen 50-80cm from eyes","Larger font = less lean","20-20-20 rule every 20 min"],
    default:["2-min stretch break every 30 min","Roll shoulders backward 5 times","Walk 5 min every hour"],
  };
  // Engine metric keys → NXT action-card keys. Without this map almost
  // every metric fell through to NXT.default generic advice.
  const NXT_ALIAS={
    neck_lean_side:"neck_lean", head_yaw:"yaw", head_tilt:"neck",
    screen_distance:"distance", dist:"distance",
    shoulder_level:"shoulder", rounded_shoulders:"rounded",
    fhp:"neck_lean", fhp_index:"neck_lean", fhp_side:"neck_lean",
    elbow_angle:"elbow", monitor_height:"monitor",
    spine_lean:"spine", spine_align:"spine", trunk_lean:"spine",
    hip_angle:"posture", knee_angle:"posture",
  };
  mEntries.slice(0,3).forEach(({key,lbl,sc},i)=>{
    if(y>H-54){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الخطوات التالية":"Next Steps",isAr);y=24;}
    y=_step(doc,ml,y,cw,i+1,lbl,sc,NXT[key]||NXT[NXT_ALIAS[key]]||NXT.default,isAr);
  });

  y+=4; if(y>H-75){doc.addPage();_hdr(doc,W,ml,mr,isAr?"إحصائيات":"Statistics",isAr);y=24;}
  y=_sh(doc,ml,y,isAr?"إحصائيات الجلسة":"Session Statistics","",gradeC,isAr);
  fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,72,4,"F");
  dc(doc,...PDF_TOKENS.border); lw(doc,0.15); rr(doc,ml,y,cw,72,4,"S"); lw(doc,0.3);
  [
    [isAr?"النتيجة الكلية":"Overall Score",`${avg}/100 — ${_sl(avg,isAr)}`],
    [isAr?"المدة":"Duration",_fmtDur(dur)],
    [isAr?"وضعية جيدة":"Good Posture",`${goodPct}%`],
    [isAr?"التنبيهات":"Alerts",String(session.alerts_count||0)],
    [isAr?"وضع الكاميرا":"Camera Mode",(session.mode||"laptop").toUpperCase()],
    [isAr?"المستوى":"Tier",tier.toUpperCase()],
    [isAr?"تاريخ الجلسة":"Date",dateStr],
    [isAr?"رقم الجلسة":"Session #",String(realIdx)],
  ].forEach(([k,v],i)=>{_iRow(doc,ml,y,cw,k,v,i%2===0,isAr);y+=8.5;});

  const tot2=doc.internal.getNumberOfPages();
  for(let p=1;p<=tot2;p++){doc.setPage(p);_ftr(doc,W,ml,mr,H,p,tot2,name);}
  await doc.save(`Posmoz_Elite_Report_${realIdx}_${new Date().toISOString().slice(0,10)}.pdf`, {returnPromise:true});
}


export async function generateClinicalPDF({ session, profile, user, lang="en", sessionIndex, allSessions=[], aiSummary="" }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  await Promise.all([_ensureCairoFont(doc), _ensureLogo()]);
  const W=210, H=297, ml=12, cw=W-ml*2;

  // ── palette (approved portrait design) ────────────────────────
  const NAVY=[11,18,32], INKC=[15,23,42], SUBC=[71,85,105], MUTEC=[124,138,160], GHOSTC=[168,180,200];
  const BGC=[246,248,252], CARDC=[255,255,255], BORDC=[228,233,242], BORD2C=[238,242,248];
  const BLUEC=[37,99,235], VIOLETC=[124,58,237], GREENC=[34,197,94], AMBERC=[245,158,11], REDC=[239,68,68];
  const GREENBGC=[236,253,244], AMBERBGC=[255,251,235], REDBGC=[254,242,242], BLUEBGC=[239,246,255], VIOLETBGC=[245,243,255];

  // ── inner helpers (self-contained; no module collisions) ──────
  const F=(s,st="normal",ar=false)=>{doc.setFont(ar&&_cairoLoaded?"cairo":"helvetica",st);doc.setFontSize(s);};
  const T=(t,x,yy,o)=>doc.text(String(t),x,yy,o);
  const hasAr=s=>/[؀-ۿ]/.test(String(s||""));
  const card=(x,yy,w,h,r=4)=>{fc(doc,...CARDC);rr(doc,x,yy,w,h,r,"F");dc(doc,...BORDC);lw(doc,.35);rr(doc,x,yy,w,h,r,"S");lw(doc,.3);};
  const clamp1=(s,wd)=>doc.splitTextToSize(String(s??"—"),wd)[0];
  const lerpC=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
  const op=o=>doc.setGState&&doc.setGState(new doc.GState({opacity:o}));
  const scCol=s=>s>=80?GREENC:s>=60?AMBERC:REDC;
  const scBg=s=>s>=80?GREENBGC:s>=60?AMBERBGC:REDBGC;
  const stTxt=s=>s>=80?"Excellent":s>=60?"Good":"Needs Improvement";
  function gradArc(cx,cy,r,frac,w,c1=BLUEC,c2=VIOLETC){
    const f=Math.max(0,Math.min(1,frac)), steps=Math.max(10,Math.round(90*f)), start=-Math.PI/2;
    lw(doc,w); doc.setLineCap("round");
    let px=cx+r*Math.cos(start), py=cy+r*Math.sin(start);
    for(let i=1;i<=steps;i++){
      const a=start+f*2*Math.PI*(i/steps);
      const nx=cx+r*Math.cos(a), ny=cy+r*Math.sin(a);
      dc(doc,...lerpC(c1,c2,i/steps)); doc.line(px,py,nx,ny); px=nx; py=ny;
    }
    doc.setLineCap("butt"); lw(doc,.3);
  }
  const solidArc=(cx,cy,r,frac,w,col)=>gradArc(cx,cy,r,frac,w,col,col);
  function icoCheck(x,yy,s,col){dc(doc,...col);lw(doc,s*.22);doc.line(x-s*.4,yy,x-s*.08,yy+s*.32);doc.line(x-s*.08,yy+s*.32,x+s*.45,yy-s*.35);lw(doc,.3);}
  function icoClock(x,yy,s,col){dc(doc,...col);lw(doc,s*.16);doc.circle(x,yy,s*.5,"S");doc.line(x,yy,x,yy-s*.28);doc.line(x,yy,x+s*.2,yy+s*.08);lw(doc,.3);}
  function icoCal(x,yy,s,col){dc(doc,...col);lw(doc,s*.14);rr(doc,x-s*.45,yy-s*.35,s*.9,s*.75,s*.1,"S");doc.line(x-s*.45,yy-s*.12,x+s*.45,yy-s*.12);doc.line(x-s*.2,yy-s*.48,x-s*.2,yy-s*.28);doc.line(x+s*.2,yy-s*.48,x+s*.2,yy-s*.28);lw(doc,.3);}
  function icoShield(x,yy,s,col){dc(doc,...col);lw(doc,s*.14);doc.lines([[s*.42,s*.14],[0,s*.5],[-s*.42,s*.32],[-s*.42,-s*.32],[0,-s*.5]],x,yy-s*.48,[1,1],"S",true);icoCheck(x,yy+s*.02,s*.5,col);}
  function icoUser(x,yy,s,col){dc(doc,...col);lw(doc,s*.14);doc.circle(x,yy-s*.18,s*.22,"S");doc.ellipse&&doc.ellipse(x,yy+s*.3,s*.34,s*.18,"S");lw(doc,.3);}
  function pillC(x,yy,txt,col,bg,alignRight=false){F(6,"bold");const w=doc.getTextWidth(txt)+8;const px=alignRight?x-w:x;fc(doc,...bg);rr(doc,px,yy,w,7.5,2.5,"F");tc(doc,...col);T(txt,px+w/2,yy+5.1,{align:"center"});return w;}
  function pictogram(x,yy,s,pose,col){
    fc(doc,...BLUEBGC);rr(doc,x,yy,s,s,2.5,"F");dc(doc,...col);lw(doc,.7);
    const cx=x+s/2, cy=yy+s/2;
    if(pose==="chin"){doc.circle(cx+s*.12,cy-s*.22,s*.13,"S");doc.line(cx+s*.06,cy-s*.1,cx-s*.05,cy+s*.18);doc.line(cx-s*.05,cy+.18*s,cx-s*.05,cy+s*.34);doc.line(cx+s*.02,cy,cx+s*.24,cy+s*.1);dc(doc,...GREENC);doc.line(cx+s*.3,cy-s*.22,cx+s*.18,cy-s*.22);}
    else if(pose==="rot"){doc.circle(cx,cy-s*.2,s*.13,"S");doc.line(cx,cy-s*.07,cx,cy+s*.2);doc.line(cx-s*.2,cy+s*.02,cx+s*.2,cy+s*.02);dc(doc,...GREENC);for(let i=0;i<10;i++){const a=-.5+i*.16;doc.line(cx+Math.cos(a)*s*.22,cy-s*.2+Math.sin(a)*s*.22,cx+Math.cos(a+.12)*s*.22,cy-s*.2+Math.sin(a+.12)*s*.22);}}
    else if(pose==="foam"){doc.circle(cx-s*.05,cy+s*.12,s*.09,"S");doc.line(cx-s*.3,cy+s*.02,cx+s*.28,cy-s*.08);doc.circle(cx+s*.33,cy-s*.14,s*.1,"S");doc.line(cx-s*.3,cy+s*.02,cx-s*.36,cy+s*.3);}
    else if(pose==="wyt"){doc.line(cx,cy-s*.05,cx,cy+s*.3);doc.circle(cx,cy-s*.18,s*.12,"S");doc.line(cx,cy,cx-s*.22,cy-s*.18);doc.line(cx,cy,cx+s*.22,cy-s*.18);}
    else if(pose==="tilt"){doc.line(cx-s*.3,cy+s*.14,cx+s*.1,cy+s*.14);doc.circle(cx+s*.24,cy+s*.02,s*.1,"S");doc.line(cx-s*.2,cy+s*.14,cx+s*.14,cy+s*.06);dc(doc,...GREENC);doc.line(cx-s*.05,cy-s*.02,cx-s*.05,cy+s*.1);}
    else {doc.line(cx-s*.22,cy+s*.1,cx+s*.18,cy+s*.1);doc.circle(cx+s*.28,cy+s*.02,s*.09,"S");doc.line(cx-s*.22,cy+s*.1,cx-s*.38,cy-s*.04);doc.line(cx+s*.18,cy+s*.1,cx+s*.34,cy-s*.06);}
    lw(doc,.3);
  }

  // ── data ──────────────────────────────────────────────────────
  const avg     = Math.round(session.avg_score||0);
  const dur     = session.duration_s||session.duration_sec||0;
  const goodPct = Math.round(session.good_pct||0);
  const alerts  = session.alerts_count||0;
  const metrics = session.metrics||{};
  const hist    = session.score_history||[];
  const _rawNm  = profile?.name||user?.displayName||user?.email?.split("@")[0]||"Patient";
  const name    = _rawNm.replace(/[\r\n]+/g,' ').replace(/\s{2,}/g,' ').trim();
  const email   = user?.email||"—";
  const zonal   = _zonalRisk(metrics);
  const now     = new Date();
  const dateStr = now.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
  const mode    = String(session.mode||"laptop");
  const modeLbl = mode.charAt(0).toUpperCase()+mode.slice(1);
  const realIndex=(()=>{ if(sessionIndex)return sessionIndex;
    if(allSessions.length){const i=allSessions.findIndex(s=>(s.id||s.session_id)===(session.id||session.session_id));if(i>=0)return allSessions.length-i;}
    return 1; })();
  const mEntries=Object.entries(metrics)
    .filter(([k])=>!k.startsWith("_")&&!NON_POSTURE_KEYS.has(k)&&metrics[k])
    .map(([k,v])=>{
      const sc=Math.round(typeof v==="number"?v:(v?.score??100));
      const lbl=METRIC_LABELS[k]||v?.label||k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      const val=(v?.value!==undefined&&v?.value!==null)?`${Math.round(v.value*10)/10} ${v?.unit||""}`.trim():"—";
      return {k,sc,lbl,val};
    }).sort((a,b)=>a.sc-b.sc);
  const riskLvl=p=>p>=40?"Moderate":p>=20?"Elevated":"Low";
  const riskCol=p=>p>=40?REDC:p>=20?AMBERC:GREENC;
  const riskBg =p=>p>=40?REDBGC:p>=20?AMBERBGC:GREENBGC;
  const interpretation = avg>=80
    ? "Posture quality is consistently good across the monitored session. Preventive ergonomic advice is appropriate."
    : avg>=60
    ? "Moderate posture deviations observed. Targeted ergonomic intervention recommended."
    : "Significant postural deviations detected across multiple planes. Clinical correlation advised.";

  // ── page furniture ────────────────────────────────────────────
  const SECTIONS=[];
  function pageBase(section){
    SECTIONS.push(section);
    fc(doc,...BGC);doc.rect(0,0,W,H,"F");
    fc(doc,...NAVY);doc.rect(0,0,W,20,"F");
    fc(doc,...BLUEC);doc.rect(0,0,W,1.2,"F");
    _logo(doc,ml,4,12,_logoSm);
    F(8,"bold");tc(doc,255,255,255);T("POSMOZ",ml+15,9.5);
    F(4.4,"normal");tc(doc,...GHOSTC);T("POSTURE HEALTH",ml+15,13.5);
    fc(doc,...VIOLETC);rr(doc,ml+43,6.5,15,7,2,"F");
    F(5.4,"bold");tc(doc,255,255,255);T("ELITE",ml+50.5,11.2,{align:"center"});
    F(6.2,"bold");tc(doc,...GHOSTC);T(section,W/2+12,11.5,{align:"center"});
    F(5.6,"bold");
    const bt="PHYSIOTHERAPIST REPORT", bw=doc.getTextWidth(bt)+6;
    fc(doc,...VIOLETBGC);rr(doc,W-ml-bw,6.5,bw,7,2,"F");
    tc(doc,...VIOLETC);T(bt,W-ml-bw/2,11.2,{align:"center"});
  }
  let y=0;
  const brk=(need,section)=>{ if(y>H-need-12){doc.addPage();pageBase(section);y=28;return true;} return false; };
  function title(t,sub){
    F(13,"bold");tc(doc,...INKC);T(t,ml,y+2);
    F(6.4,"normal");tc(doc,...SUBC);T(clamp1(sub,cw),ml,y+8.5);
    y+=14;
  }

  // ══ PAGE 1 — Overview ═════════════════════════════════════════
  pageBase("OVERVIEW");
  y=28;
  F(15,"bold");tc(doc,...INKC);T("Professional Posture Report",ml,y+2);
  F(6.6,"normal");tc(doc,...SUBC);
  T("AI-Assisted Workplace Ergonomics & Posture Assessment  ·  For Clinical Review — Not for Diagnostic Purposes",ml,y+8.5);
  y+=14;
  // patient strip
  card(ml,y,cw,18,3.5);
  fc(doc,...BLUEC);doc.circle(ml+9,y+9,5,"F");
  F(7.5,"bold");tc(doc,255,255,255);T((name[0]||"P").toUpperCase(),ml+9,y+11.3,{align:"center"});
  F(8,"bold",hasAr(name));tc(doc,...INKC);T(clamp1(name,60),ml+17,y+8);
  F(6,"normal");tc(doc,...MUTEC);T(clamp1(email,60),ml+17,y+13.5);
  [["Session","#"+realIndex],["Date",dateStr],["Duration",_fmtDur(dur)],["Camera",modeLbl]].forEach(([k,v],i)=>{
    const x=ml+86+i*25;
    F(5.4,"normal");tc(doc,...MUTEC);T(k,x,y+7);
    F(6.8,"bold");tc(doc,...INKC);T(clamp1(v,23),x,y+13);
    if(i<3){dc(doc,...BORD2C);lw(doc,.25);doc.line(x+21,y+4,x+21,y+14);lw(doc,.3);}
  });
  y+=24;
  // ring + KPI grid
  card(ml,y,86,74,5);
  F(6.5,"bold");tc(doc,...SUBC);T("Overall Posture Score",ml+43,y+8,{align:"center"});
  dc(doc,...BORD2C);lw(doc,4.2);doc.circle(ml+43,y+36,18.5,"S");lw(doc,.3);
  gradArc(ml+43,y+36,18.5,avg/100,4.2);
  F(20,"bold");tc(doc,...INKC);T(String(avg),ml+43,y+38,{align:"center"});
  F(5.6,"normal");tc(doc,...MUTEC);T("/100",ml+43,y+43.5,{align:"center"});
  F(8.5,"bold");tc(doc,...scCol(avg));T(_gl(avg,false),ml+43,y+61,{align:"center"});
  F(5.6,"normal");tc(doc,...SUBC);
  doc.splitTextToSize(interpretation,80).slice(0,2).forEach((l,i)=>T(l,ml+43,y+66.5+i*4,{align:"center"}));
  const kx=ml+90, kw=(cw-90-4)/2, kh=35;
  function kpi(x,yy,ic,icol,label,val,sub,subCol){
    card(x,yy,kw,kh,4);
    fc(doc,...BLUEBGC);rr(doc,x+4.5,yy+4.5,8.5,8.5,2.5,"F");ic(x+8.7,yy+8.7,4.6,icol);
    F(5.8,"normal");tc(doc,...MUTEC);T(label,x+16,yy+8.5);
    F(12,"bold");tc(doc,...INKC);T(clamp1(val,kw-10),x+4.5,yy+23);
    F(5.8,"bold");tc(doc,...subCol);T(clamp1(sub,kw-10),x+4.5,yy+29.5);
  }
  kpi(kx,y,icoCheck,GREENC,"Good Posture",goodPct+"%",goodPct>=80?"Excellent":goodPct>=60?"Good":"Needs work",goodPct>=80?GREENC:goodPct>=60?AMBERC:REDC);
  kpi(kx+kw+4,y,icoClock,BLUEC,"Session Duration",_fmtDur(dur),dur<300?"Short Session":dur<1800?"Standard Session":"Long Session",MUTEC);
  kpi(kx,y+kh+4,icoShield,alerts===0?GREENC:AMBERC,"Alerts Triggered",String(alerts),alerts===0?"Perfect":alerts<5?"Minor":"Review posture habits",alerts===0?GREENC:AMBERC);
  kpi(kx+kw+4,y+kh+4,icoCal,VIOLETC,"Assessment Date",dateStr.replace(/, \d{4}$/,""),`Session #${realIndex}`,MUTEC);
  y+=80;
  // timeline
  if(hist.length>2){
    card(ml,y,cw,66,5);
    F(8,"bold");tc(doc,...INKC);T("Posture Score Timeline",ml+6,y+9);
    F(6,"normal");tc(doc,...MUTEC);T("(Full Session) — continuous posture quality from session start to end",ml+45,y+9);
    const tlx=ml+13,tly=y+15,tlw=cw-24,tlh=38;
    const lo=Math.max(0,Math.min(...hist)-5),hi=Math.min(100,Math.max(...hist)+5),rng=Math.max(hi-lo,10);
    [Math.round(lo+rng*.2),Math.round(lo+rng*.5),Math.round(lo+rng*.8)].forEach(v=>{
      const gy=tly+tlh-((v-lo)/rng)*tlh;
      dc(doc,...BORD2C);lw(doc,.25);doc.line(tlx,gy,tlx+tlw,gy);
      F(5,"normal");tc(doc,...GHOSTC);T(String(v),tlx-2.5,gy+1.5,{align:"right"});
    });
    const hv=hist.length>90?hist.filter((_,i)=>i%Math.ceil(hist.length/90)===0):hist;
    const pts=hv.map((v,i)=>({x:tlx+(i/(hv.length-1))*tlw,y:tly+tlh-((Math.max(lo,Math.min(hi,v))-lo)/rng)*tlh}));
    try{const segs=pts.slice(1).map((p,i)=>[p.x-pts[i].x,p.y-pts[i].y]);
    fc(doc,...BLUEC);op(.09);doc.lines([...segs,[0,tly+tlh-pts[pts.length-1].y],[-(pts[pts.length-1].x-pts[0].x),0]],pts[0].x,pts[0].y,[1,1],"F",false);op(1);}catch{}
    dc(doc,...BLUEC);lw(doc,1);pts.forEach((p,i)=>{if(i>0)doc.line(pts[i-1].x,pts[i-1].y,p.x,p.y);});lw(doc,.3);
    pts.filter((_,i)=>i%2===0).forEach(p=>{fc(doc,...BLUEC);doc.circle(p.x,p.y,.85,"F");});
    fc(doc,...BLUEC);doc.circle(pts[pts.length-1].x,pts[pts.length-1].y,3.2,"F");
    F(6.2,"bold");tc(doc,255,255,255);T(String(avg),pts[pts.length-1].x,pts[pts.length-1].y+1.9,{align:"center"});
    F(5,"normal");tc(doc,...GHOSTC);
    const fmtT=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(Math.round(s%60)).padStart(2,"0")}`;
    for(let i=0;i<=5;i++)T(fmtT(dur*i/5),tlx+(i/5)*tlw,tly+tlh+5.5,{align:"center"});
  }

  // ══ PAGE 2 — Spinal zone risk ═════════════════════════════════
  doc.addPage();pageBase("RISK ASSESSMENT");y=28;
  title("Spinal Zone Risk Assessment","Risk percentages are derived computationally from posture metrics. They are not medical diagnoses.");
  // body card
  card(ml,y,74,150,5);
  const bx=ml+30, by=y+12;
  fc(doc,230,236,246);
  doc.circle(bx,by+8,8,"F");
  doc.lines([[9,5],[5,9],[3,14],[1,16],[-1,14],[-2,12],[-32,0],[-2,-12],[-1,-14],[1,-16],[3,-14],[5,-9],[9,-5]],bx-17,by+19,[1,1],"F",true);
  rr(doc,bx-11,by+76,9,40,4,"F"); rr(doc,bx+2,by+76,9,40,4,"F");
  const zoneOf=i=>i<7?"cervical":i<19?"thoracic":"lumbar";
  [["cervical",by+17,7*3.9],["thoracic",by+17+7*3.9,12*3.9],["lumbar",by+17+19*3.9,5*3.9]].forEach(([z,zy,zh])=>{fc(doc,...riskCol(zonal[z]||0));op(.12);rr(doc,bx-6.5,zy-1,13,zh+1,4,"F");op(1);});
  for(let i=0;i<24;i++){const vy=by+17+i*3.9;fc(doc,...riskCol(zonal[zoneOf(i)]||0));op(.9);rr(doc,bx-2.4,vy,4.8,3,1.1,"F");op(1);}
  function riskBadge(zy,pct,col){
    dc(doc,...col);lw(doc,.5);doc.line(bx+6,zy,bx+22,zy);lw(doc,.3);
    fc(doc,...CARDC);doc.circle(bx+30,zy,7.8,"F");dc(doc,...col);lw(doc,.85);doc.circle(bx+30,zy,7.8,"S");lw(doc,.3);
    F(7.2,"bold");tc(doc,...col);T(pct+"%",bx+30,zy-.3,{align:"center"});
    F(4.3,"bold");tc(doc,...MUTEC);T("RISK",bx+30,zy+4,{align:"center"});
  }
  riskBadge(by+26,zonal.cervical||0,riskCol(zonal.cervical||0));
  riskBadge(by+58,zonal.thoracic||0,riskCol(zonal.thoracic||0));
  riskBadge(by+88,zonal.lumbar||0,riskCol(zonal.lumbar||0));
  F(5.6,"normal");tc(doc,...MUTEC);T("Vertebrae coloured by computed zone risk",ml+37,y+145,{align:"center"});
  // zone cards
  const zx=ml+79, zw=cw-79;
  const ZDATA=[
   ["cervical","Cervical Spine (Neck)","C1–C7",
    "Assesses head position, neck lean, forward head posture, and rotational deviation. Elevated risk correlates with increased load on cervical discs and potential for tension-type headache, cervicogenic dizziness, or upper trapezius hypertonicity.",
    "Neck Lean, FHP, Head Tilt, Head Rotation"],
   ["thoracic","Thoracic Spine (Upper Back)","T1–T12",
    "Evaluates shoulder symmetry, rounded shoulder posture, and upper spinal curvature. Chronic elevation indicates risk for thoracic kyphosis progression or rotator cuff impingement patterns.",
    "Shoulder Balance, Rounded Shoulders, Spine Lean"],
   ["lumbar","Lumbar Spine (Lower Back)","L1–S1",
    "Measures sagittal and coronal spinal alignment, hip angle, and pelvic positioning relative to trunk. Risk elevation may indicate posterior chain tightness or disc load asymmetry.",
    "Spine Alignment, Hip Angle, Trunk Lean"],
  ];
  let zy2=y;
  ZDATA.forEach(([key,t,reg,desc,mets])=>{
    const pct=zonal[key]||0, col=riskCol(pct), bg=riskBg(pct);
    card(zx,zy2,zw,48,4);
    fc(doc,...bg);rr(doc,zx+4.5,zy2+4.5,10,10,3,"F");icoUser(zx+9.5,zy2+9.5,5.2,col);
    F(8.4,"bold");tc(doc,...INKC);T(t,zx+18,zy2+9);
    F(6,"normal");tc(doc,...MUTEC);T(reg,zx+18,zy2+14.5);
    pillC(zx+zw-4.5,zy2+4.5,`Risk: ${riskLvl(pct)} (${pct}%)`,col,bg,true);
    F(6.2,"normal");tc(doc,...SUBC);
    doc.splitTextToSize(desc,zw-23).slice(0,4).forEach((l,i)=>T(l,zx+18,zy2+20.5+i*4.4));
    F(5.6,"normal");tc(doc,...MUTEC);
    T(clamp1("Contributing:  "+mets,zw-23),zx+18,zy2+43.5);
    zy2+=51;
  });

  // ══ PAGE 3 — Exercise prescription + metrics table ════════════
  doc.addPage();pageBase("EXERCISE PLAN");y=28;
  title("Exercise Prescription","Evidence-based exercises targeting the highest-risk zones identified in this session.");
  const EX=[
   ["cervical","CERVICAL ZONE",[
     ["chin","Chin Tuck","3×10","Retract head parallel to floor, hold 5s. Activates deep neck flexors."],
     ["rot","Cervical Rotation","2×10/side","Slow rotation L/R to end range. Reduces upper trapezius hypertonicity."]]],
   ["thoracic","THORACIC ZONE",[
     ["foam","Thoracic Extension (foam roller)","2×60s","Over foam roller at T6–T9. Restores extension lost to sustained flexion."],
     ["wyt","W-Y-T Raises (prone)","3×12","Prone scapular retraction + depression. Activates lower/mid trapezius."]]],
   ["lumbar","LUMBAR ZONE",[
     ["tilt","Posterior Pelvic Tilt","3×10","Supine lumbar flattening. Resets neutral spine, inhibits hip flexors."],
     ["bird","Bird-Dog","3×10/side","Quadruped opposite arm/leg extension. Core stability + lumbar unloading."]]],
  ];
  const colW=(cw-6)/2;
  EX.forEach(([key,zt,items])=>{
    const pct=zonal[key]||0, col=riskCol(pct), bg=riskBg(pct);
    const risk=`Risk: ${riskLvl(pct)} (${pct}%)`;
    F(7,"bold");tc(doc,...col);T(zt,ml,y+4);
    F(5.6,"bold");const rw=doc.getTextWidth(risk)+6;fc(doc,...bg);rr(doc,ml+cw-rw,y,rw,6.5,2,"F");tc(doc,...col);T(risk,ml+cw-rw/2,y+4.4,{align:"center"});
    y+=8;
    items.forEach(([pose,nm,reps,desc],ii)=>{
      const x=ml+ii*(colW+6);
      card(x,y,colW,24,3.5);
      pictogram(x+3.5,y+3.5,17,pose,BLUEC);
      F(7.6,"bold");tc(doc,...INKC);T(clamp1(nm,colW-42),x+24.5,y+8);
      F(5.8,"bold");const rpw=doc.getTextWidth(reps)+5;fc(doc,...BLUEBGC);rr(doc,x+colW-rpw-3.5,y+3.5,rpw,6,2,"F");tc(doc,...BLUEC);T(reps,x+colW-rpw/2-3.5,y+7.6,{align:"center"});
      F(6,"normal");tc(doc,...SUBC);
      doc.splitTextToSize(desc,colW-29).slice(0,3).forEach((l,i)=>T(l,x+24.5,y+13.5+i*4));
    });
    y+=30;
  });
  // metrics table
  y+=2;
  F(10,"bold");tc(doc,...INKC);T("Posture Metrics Detail",ml,y+4); y+=8;
  const rowsFit=Math.floor((H-14-y-16)/8.8);
  function tblHead(){
    F(6,"bold");tc(doc,...MUTEC);
    T("METRIC",ml+14,y+4);T("VALUE",ml+cw*.5,y+4);T("SCORE",ml+cw*.66,y+4);T("STATUS",ml+cw*.78,y+4);
    dc(doc,...BORDC);lw(doc,.25);doc.line(ml+3,y+6.5,ml+cw-3,y+6.5);lw(doc,.3);
    y+=11;
  }
  const tblH=Math.min(mEntries.length,rowsFit)*8.8+16;
  card(ml,y,cw,tblH,4); y+=3;
  tblHead();
  mEntries.forEach(({lbl,val,sc},i)=>{
    if(y>H-24){
      doc.addPage();pageBase("POSTURE METRICS");y=28;
      const remain=mEntries.length-i;
      card(ml,y,cw,Math.min(remain,26)*8.8+16,4); y+=3;
      tblHead();
    }
    const col=scCol(sc), st=stTxt(sc);
    if(i%2===0){fc(doc,...BGC);doc.rect(ml+2,y-4,cw-4,8.8,"F");}
    fc(doc,...BLUEBGC);doc.circle(ml+8.5,y-.4,2.5,"F");dc(doc,...BLUEC);lw(doc,.45);doc.circle(ml+8.5,y-.4,2.5,"S");lw(doc,.3);
    F(7,"normal");tc(doc,...INKC);T(clamp1(lbl,cw*.34),ml+14,y+1);
    F(6.6,"normal");tc(doc,...SUBC);T(clamp1(val,cw*.14),ml+cw*.5,y+1);
    F(7.6,"bold");tc(doc,...col);T(String(sc),ml+cw*.66,y+1.3);
    pillC(ml+cw*.78,y-4,st,col,scBg(sc));
    y+=8.8;
  });

  // ══ PAGE 4 — Clinical notes + statistics ══════════════════════
  doc.addPage();pageBase("RECOMMENDATIONS");y=28;
  title("Clinical Notes & Recommendations","Suggested focus areas based on session measurements. Please apply clinical judgment.");
  const NOTES=[
   ["General Assessment",BLUEC, avg<60
     ? `Overall posture score of ${avg}/100 indicates significant postural deviation across multiple planes. ${zonal.cervical>=zonal.thoracic&&zonal.cervical>=zonal.lumbar?"The cervical zone is the primary contributor.":zonal.thoracic>=zonal.lumbar?"The thoracic zone shows the most concern.":"The lumbar zone requires the most attention."} A full clinical assessment with manual palpation is recommended.`
     : avg<80
     ? `Moderate postural deviations identified (score: ${avg}/100). Targeted corrective exercise programming is likely to yield measurable improvement within 4–6 weeks.`
     : `Posture quality is broadly good during monitored sessions (${avg}/100, ${goodPct}% good posture). Reinforce current ergonomic patterns and monitor for creep during extended work periods.`],
   ["Cervical Focus", riskCol(zonal.cervical||0), (zonal.cervical||0)>=40
     ? `Cervical zone risk ${zonal.cervical}%. Neck lean and head-position metrics require attention. Chin-tuck exercises (3×10 daily) and monitor raised to eye level are indicated. Screen for cervicogenic headache if symptomatic.`
     : `Cervical zone within acceptable range (${zonal.cervical||0}%). Current head and neck positioning is adequate. Maintain 50–70 cm screen distance with the monitor top edge at eye level.`],
   ["Thoracic Focus", riskCol(zonal.thoracic||0), (zonal.thoracic||0)>=40
     ? `Thoracic zone risk ${zonal.thoracic}%. Shoulder asymmetry and upper spinal curvature detected. Thoracic extension work (foam roller T6–T9, 2×60 s) and scapular retraction drills recommended.`
     : `Thoracic zone acceptable (${zonal.thoracic||0}%). Shoulder balance and upper-back posture are within normal parameters. Encourage thoracic extension breaks every 45 minutes.`],
   ["Lumbar Focus", riskCol(zonal.lumbar||0), (zonal.lumbar||0)>=40
     ? `Lumbar zone risk ${zonal.lumbar}%. Spinal alignment and hip-angle metrics indicate concern. Posterior pelvic tilts (3×10) and hip-flexor stretches (3×30 s/side) indicated; consider lumbar support and sit-stand rotation.`
     : `Lumbar zone within expected range (${zonal.lumbar||0}%). Current seated posture maintains adequate lumbar support. Continue current chair settings with feet flat and knees at 90 degrees.`],
  ];
  const noteW=cw-66;
  NOTES.forEach(([t,col,body],i)=>{
    F(6.6,"normal");
    const lines=doc.splitTextToSize(body,noteW-22);
    const nh=14+lines.length*4.6;
    brk(nh+4,"RECOMMENDATIONS");
    card(ml,y,noteW,nh,3.5);
    fc(doc,...col);doc.circle(ml+8.5,y+8.5,4,"F");
    F(7,"bold");tc(doc,255,255,255);T(String(i+1),ml+8.5,y+10.7,{align:"center"});
    F(8,"bold");tc(doc,...INKC);T(t,ml+16,y+10.5);
    F(6.6,"normal");tc(doc,...SUBC);lines.forEach((l,li)=>T(l,ml+16,y+17+li*4.6));
    y+=nh+5;
  });
  // statistics (right column of page 4)
  doc.setPage(doc.internal.getNumberOfPages());
  const stx=ml+noteW+6, stw=cw-noteW-6;
  card(stx,42,stw,116,4);
  F(8,"bold");tc(doc,...INKC);T("Session Statistics",stx+5,50.5);
  dc(doc,...BORDC);lw(doc,.25);doc.line(stx+4,53.5,stx+stw-4,53.5);lw(doc,.3);
  const STATS=[["Overall Score",`${avg}/100`,scCol(avg)],["Good Posture",goodPct+"%",goodPct>=80?GREENC:AMBERC],
   ["Duration",_fmtDur(dur),SUBC],["Alerts",String(alerts),alerts===0?GREENC:AMBERC],
   ["Camera",modeLbl,SUBC],["Tier","ELITE",VIOLETC],
   ["Date",dateStr.replace(/, \d{4}$/,""),SUBC],["Session",`#${realIndex}`,SUBC]];
  STATS.forEach(([k,v,col],i)=>{
    const ry=61+i*12;
    F(6.2,"normal");tc(doc,...MUTEC);T(k,stx+5,ry);
    F(7.2,"bold");tc(doc,...col);T(clamp1(v,stw-28),stx+stw-5,ry,{align:"right"});
    if(i<STATS.length-1){dc(doc,...BORD2C);lw(doc,.22);doc.line(stx+4,ry+4,stx+stw-4,ry+4);lw(doc,.3);}
  });

  // ══ PAGE 5 — Disclaimer + workstation + signature ═════════════
  doc.addPage();pageBase("SUMMARY");y=28;
  fc(doc,...VIOLETBGC);rr(doc,ml,y,cw,27,4,"F");dc(doc,...VIOLETC);lw(doc,.35);rr(doc,ml,y,cw,27,4,"S");lw(doc,.3);
  icoShield(ml+9,y+13.5,7,VIOLETC);
  F(7.5,"bold");tc(doc,...VIOLETC);T("IMPORTANT DISCLAIMER — SCREENING-GRADE MEASUREMENT",ml+18,y+7.5);
  F(6.2,"normal");tc(doc,...SUBC);
  doc.splitTextToSize("This report is generated by an AI-based postural monitoring system using screening-grade camera pose estimation, and is intended to supplement, not replace, professional clinical assessment. Findings should be interpreted alongside a full physical examination by a qualified physiotherapist or medical professional. Posmoz is a wellness and ergonomics product, not a medical device; it does not diagnose or treat any medical condition.",cw-24).forEach((l,i)=>T(l,ml+18,y+13+i*4.2));
  y+=33;
  card(ml,y,cw,120,5);
  F(9,"bold");tc(doc,...INKC);T("Recommended Workstation Setup",ml+6,y+9);
  const dx=ml+12, dy=y+18;
  dc(doc,...SUBC);lw(doc,.8);
  doc.line(dx,dy+64,dx+104,dy+64);
  doc.line(dx+8,dy+64,dx+8,dy+94); doc.line(dx+96,dy+64,dx+96,dy+94);
  rr(doc,dx+58,dy+20,32,23,2,"S");
  doc.line(dx+74,dy+43,dx+74,dy+50); doc.line(dx+66,dy+50,dx+82,dy+50);
  doc.line(dx+36,dy+60,dx+52,dy+60);
  doc.circle(dx+20,dy+16,5.6,"S");
  doc.line(dx+20,dy+22,dx+20,dy+46);
  doc.line(dx+20,dy+30,dx+36,dy+38); doc.line(dx+36,dy+38,dx+47,dy+56);
  doc.line(dx+20,dy+46,dx+31,dy+46); doc.line(dx+31,dy+46,dx+31,dy+78); doc.line(dx+31,dy+78,dx+42,dy+78);
  rr(doc,dx+7,dy+38,6.5,42,2.5,"S");
  dc(doc,...GREENC);lw(doc,.4);for(let gx=dx+26;gx<dx+58;gx+=4)doc.line(gx,dy+14,gx+2,dy+14);lw(doc,.3);
  [["Monitor at eye level"],["Screen distance 50–70 cm"],["Elbows at 90°"],["Feet flat · Knees 90°"]].forEach(([t],i)=>{
    const cyy=dy+2+i*24;
    fc(doc,...GREENBGC);rr(doc,ml+126,cyy,58,16,3,"F");dc(doc,...GREENC);lw(doc,.3);rr(doc,ml+126,cyy,58,16,3,"S");lw(doc,.3);
    fc(doc,...GREENC);doc.circle(ml+133,cyy+8,3.4,"F");icoCheck(ml+133,cyy+8,3,[255,255,255]);
    F(6.6,"bold");tc(doc,...INKC);T(t,ml+139,cyy+9.8);
  });
  y+=126;
  card(ml,y,(cw-6)/2,26,3.5);
  icoUser(ml+9,y+9,6,SUBC);
  F(7.5,"bold");tc(doc,...INKC);T("Reviewing Clinician",ml+16,y+9);
  dc(doc,...MUTEC);lw(doc,.3);doc.line(ml+6,y+18,ml+(cw-6)/2-6,y+18);
  F(5.6,"normal");tc(doc,...MUTEC);T("Name / Clinic",ml+6,y+22.5);
  card(ml+(cw-6)/2+6,y,(cw-6)/2,26,3.5);
  F(7.5,"bold");tc(doc,...INKC);T("Signature & Date",ml+(cw-6)/2+13,y+9);
  dc(doc,...MUTEC);doc.line(ml+(cw-6)/2+12,y+18,ml+cw-6,y+18);
  F(5.6,"normal");tc(doc,...MUTEC);T("Signed on physical review",ml+(cw-6)/2+12,y+22.5);

  // ── footer band on every page ─────────────────────────────────
  const tp=doc.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++){
    doc.setPage(p);
    fc(doc,...NAVY);doc.rect(0,H-8,W,8,"F");
    F(5.2,"normal");tc(doc,...GHOSTC);
    T(`Posmoz Posture Health  ·  Clinical Report  ·  ${dateStr}  ·  Confidential — Not a medical diagnosis`,ml,H-3);
    T(`${p} / ${tp}`,W-ml,H-3,{align:"right"});
  }

  const filename=`Posmoz_Clinical_Report_Session${realIndex}_${now.toISOString().slice(0,10)}.pdf`;
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
  if (!session1 || !session2) { console.warn("[PDF] Comparison needs 2 sessions"); return; }

  const { jsPDF } = await import("jspdf");
  const isAr = lang==="ar";
  const tier = _t(profile?.tier||"standard");
  // tier check handled in UI — proceed regardless

  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  await Promise.all([_ensureCairoFont(doc), _ensureLogo()]);
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
  const allKeys=[...new Set([...Object.keys(m1),...Object.keys(m2)])].filter(k=>!k.startsWith("_")&&!NON_POSTURE_KEYS.has(k));
  const metRows=allKeys.map(k=>{
    const sc1=typeof m1[k]==="number"?m1[k]:(m1[k]?.score??100);
    const sc2=typeof m2[k]==="number"?m2[k]:(m2[k]?.score??100);
    const d=Math.round(sc2-sc1);
    const lbl=(isAr?METRIC_LABELS_AR[k]:METRIC_LABELS[k])||k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
    return{k,lbl,sc1,sc2,d};
  }).sort((a,b)=>a.d-b.d);

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
  font(doc,13,"bold"); tc(doc,...PDF_TOKENS.card); doc.text("POSMOZ",ml+34,28);
  font(doc,7,"normal"); tc(doc,148,163,184); doc.text("Health Intelligence Platform",ml+34,36);

  // Tier badge
  const tlw=doc.getTextWidth(tierLbl)+12;
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.18}));
  rr(doc,ml+34,41,tlw,10,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,7.5,"bold"); tc(doc,...tierCol);
  doc.text(tierLbl,ml+34+tlw/2,48,{align:"center"});

  // Date right
  font(doc,7,"normal"); tc(doc,148,163,184); doc.text(nowStr,W-mr,26,{align:"right"});
  font(doc,7.5,"bold"); tc(doc,...PDF_TOKENS.card);
  doc.text(`Session #${num1} vs #${num2}`,W-mr,36,{align:"right"});

  fc(doc,...deltaCol); doc.rect(0,69.5,W,2.5,"F");

  // Title
  let y=86;
  font(doc,20,"bold"); tc(doc,...PDF_TOKENS.ink);
  doc.text(isAr?"تقرير المقارنة":"Session Comparison Report",ml,y); y+=9;
  font(doc,9,"normal"); tc(doc,...PDF_TOKENS.muted);
  doc.text(`${name} · ${isAr?"مقارنة جلستين":"Head-to-head session analysis"}`,ml,y); y+=16;
  hr(doc,ml,y,cw); y+=14;

  // ── HERO SCORE COMPARISON ─────────────────────────────────────
  const heroH=70, half=(cw-14)/2;

  // Session 1 card
  fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,half,heroH,6,"F");
  dc(doc,...g1); lw(doc,0.3); rr(doc,ml,y,half,heroH,6,"S"); lw(doc,0.3);
  fc(doc,...g1); doc.rect(ml,y,half,3,"F"); rr(doc,ml,y,half,3,3,"F");
  // Session number chip
  const s1lbl=`Session #${num1}`;
  font(doc,7,"bold"); tc(doc,...PDF_TOKENS.card);
  fc(doc,...g1); rr(doc,ml+6,y+8,half-12,10,2,"F");
  doc.text(s1lbl,ml+6+(half-12)/2,y+14.5,{align:"center"});
  // Score ring
  dc(doc,...g1); lw(doc,3); doc.circle(ml+half/2,y+40,16,"S"); lw(doc,0.3);
  fc(doc,...g1);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.08}));
  doc.circle(ml+half/2,y+40,14.5,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,20,"bold"); tc(doc,...g1);
  doc.text(String(a1),ml+half/2,y+45,{align:"center"});
  font(doc,7,"normal"); tc(doc,...PDF_TOKENS.muted);
  doc.text("/100",ml+half/2,y+52,{align:"center"});
  font(doc,8.5,"bold"); tc(doc,...g1);
  doc.text(_scoreLabel(a1,isAr),ml+half/2,y+62,{align:"center"});

  // VS divider + delta
  const mx=ml+half+7;
  // Delta circle
  fc(doc,...deltaBg);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.9}));
  doc.circle(mx,y+35,10,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  dc(doc,...deltaCol); lw(doc,1); doc.circle(mx,y+35,10,"S"); lw(doc,0.3);
  font(doc,9,"bold"); tc(doc,...deltaCol);
  doc.text(delta===0?"=":(improved?"↑":"↓"),mx,y+33.5,{align:"center"});
  font(doc,7,"bold"); tc(doc,...deltaCol);
  doc.text(`${delta>0?"+":""}${delta}`,mx,y+41,{align:"center"});
  // VS label
  font(doc,6.5,"bold"); tc(doc,...PDF_TOKENS.muted);
  doc.text("VS",mx,y+52,{align:"center"});

  // Session 2 card
  const rx=mx+7;
  fc(doc,...PDF_TOKENS.card); rr(doc,rx,y,half,heroH,6,"F");
  dc(doc,...g2); lw(doc,0.3); rr(doc,rx,y,half,heroH,6,"S"); lw(doc,0.3);
  fc(doc,...g2); doc.rect(rx,y,half,3,"F"); rr(doc,rx,y,half,3,3,"F");
  const s2lbl=`Session #${num2}`;
  font(doc,7,"bold"); tc(doc,...PDF_TOKENS.card);
  fc(doc,...g2); rr(doc,rx+6,y+8,half-12,10,2,"F");
  doc.text(s2lbl,rx+6+(half-12)/2,y+14.5,{align:"center"});
  // Score ring
  dc(doc,...g2); lw(doc,3); doc.circle(rx+half/2,y+40,16,"S"); lw(doc,0.3);
  fc(doc,...g2);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.08}));
  doc.circle(rx+half/2,y+40,14.5,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,20,"bold"); tc(doc,...g2);
  doc.text(String(a2),rx+half/2,y+45,{align:"center"});
  font(doc,7,"normal"); tc(doc,...PDF_TOKENS.muted);
  doc.text("/100",rx+half/2,y+52,{align:"center"});
  font(doc,8.5,"bold"); tc(doc,...g2);
  doc.text(_scoreLabel(a2,isAr),rx+half/2,y+62,{align:"center"});
  y+=heroH+8;

  // ── QUICK STATS STRIP ─────────────────────────────────────────
  const qStats=[
    [isAr?"التاريخ":"Date",_fmtDate(session1.created_at,isAr),_fmtDate(session2.created_at,isAr),PDF_TOKENS.primary],
    [isAr?"المدة":"Duration",_fmtDur(d1),_fmtDur(d2),PDF_TOKENS.indigo],
    [isAr?"وضعية جيدة":"Good posture",`${gp1}%`,`${gp2}%`,PDF_TOKENS.success],
    [isAr?"التنبيهات":"Alerts",String(al1),String(al2),PDF_TOKENS.warning],
  ];
  qStats.forEach(([lbl,v1,v2,col],i)=>{
    const qy=y+i*12;
    if(i%2===0){fc(doc,...PDF_TOKENS.bg); doc.rect(ml,qy,cw,12,"F");}
    font(doc,7.5,"normal",isAr); tc(doc,...PDF_TOKENS.muted); doc.text(lbl,ml+4,qy+8);
    font(doc,7.5,"bold",false); tc(doc,...col); doc.text(v1,ml+cw*0.45,qy+8,{align:"right"});
    font(doc,7.5,"bold",false); tc(doc,...PDF_TOKENS.muted); doc.text("→",ml+cw*0.5,qy+8,{align:"center"});
    font(doc,7.5,"bold",false); tc(doc,...col); doc.text(v2,ml+cw*0.98,qy+8,{align:"right"});
  });
  y+=qStats.length*12+10;

  // ── INSIGHT BANNER ────────────────────────────────────────────
  const insText=improved
    ?(isAr?`📈 تحسّن +${delta} نقطة — ${_scoreLabel(a2,isAr)} مقارنةً بـ ${_scoreLabel(a1,isAr)}`:`📈 +${delta} point improvement — ${_scoreLabel(a2,isAr)} vs ${_scoreLabel(a1,isAr)}`)
    :declined
    ?(isAr?`📉 انخفاض ${Math.abs(delta)} نقطة — راجع المقاييس المتراجعة أدناه`:`📉 ${Math.abs(delta)} point decline — review regressed metrics below`)
    :(isAr?"📊 النتيجة مستقرة بين الجلستين":"📊 Score stable between sessions");
  fc(doc,...deltaBg); rr(doc,ml,y,cw,14,3,"F");
  dc(doc,...deltaCol); lw(doc,0.25); rr(doc,ml,y,cw,14,3,"S"); lw(doc,0.3);
  fc(doc,...deltaCol); doc.rect(ml,y,3,14,"F"); rr(doc,ml,y,3,14,1.5,"F");
  font(doc,8.5,"bold",isAr); tc(doc,...deltaCol);
  doc.text(doc.splitTextToSize(insText,cw-14)[0],ml+8,y+9.5);
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
  font(doc,7.5,"bold"); tc(doc,...PDF_TOKENS.card);
  [isAr?"المقياس":"Metric",`#${num1}`,`#${num2}`,isAr?"Δ":"Δ",isAr?"الاتجاه":"Trend"]
    .forEach((h,i)=>doc.text(h,colX[i],y+7));
  y+=12;

  metRows.forEach(({lbl,sc1,sc2,d},idx)=>{
    if(y>H-28){doc.addPage();_hdr(doc,W,ml,mr,isAr?"تابع":"Continued",isAr);y=22;}
    const dC=d>2?PDF_TOKENS.success:d<-2?PDF_TOKENS.danger:PDF_TOKENS.muted;
    const rowH=11;
    fc(doc,...(idx%2===0?PDF_TOKENS.bg:PDF_TOKENS.card)); doc.rect(ml,y,cw,rowH,"F");
    // Left accent for significant changes
    if(Math.abs(d)>5){ fc(doc,...dC); doc.rect(ml,y,2,rowH,"F"); }
    font(doc,8,"normal",isAr); tc(doc,...PDF_TOKENS.ink);
    doc.text(doc.splitTextToSize(lbl,cw*0.42-14)[0],colX[0]+2,y+7.5); // clamped to its column
    // Score 1 with mini dot
    const c1=_scoreColor(sc1),c2=_scoreColor(sc2);
    fc(doc,...c1); doc.circle(colX[1]-3,y+5.5,2.5,"F");
    font(doc,8,"bold"); tc(doc,...c1); doc.text(String(Math.round(sc1)),colX[1]+2,y+7.5);
    fc(doc,...c2); doc.circle(colX[2]-3,y+5.5,2.5,"F");
    font(doc,8,"bold"); tc(doc,...c2); doc.text(String(Math.round(sc2)),colX[2]+2,y+7.5);
    // Delta
    font(doc,8.5,"bold"); tc(doc,...dC);
    doc.text(`${d>0?"+":""}${d}`,colX[3],y+7.5);
    // Trend arrow pill
    const arrow=d>2?"▲":d<-2?"▼":"–";
    fc(doc,...dC);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
    rr(doc,colX[4]-2,y+2,14,7,2,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    font(doc,8.5,"bold"); tc(doc,...dC);
    doc.text(arrow,colX[4]+5,y+7.5,{align:"center"});
    y+=rowH;
  });
  y+=10;

  // ── SPINAL ZONE COMPARISON ────────────────────────────────────
  if(y>H-90){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خريطة المناطق":"Zone Map",isAr);y=22;}
  _sh(doc,ml,y,isAr?"مقارنة مناطق العمود الفقري":"Spinal Zone Comparison",
    isAr?"المخاطرة % — منخفض/متوسط/عالي":"Risk % — low/moderate/high",PDF_TOKENS.danger,isAr);
  y+=16;

  // NOTE: previous Arabic labels used "عنق الرحم" (cervix) — a serious
  // medical mistranslation of "cervical". Corrected to الفقرات العنقية.
  const zones=[
    {k:"cervical",en:"Cervical (Neck)",  ar:"الفقرات العنقية (الرقبة)",     r:"C1–C7"},
    {k:"thoracic",en:"Thoracic (Upper)", ar:"الفقرات الصدرية (أعلى الظهر)", r:"T1–T12"},
    {k:"lumbar",  en:"Lumbar (Lower)",   ar:"الفقرات القطنية (أسفل الظهر)", r:"L1–S1"},
  ];
  zones.forEach(({k,en,ar,r})=>{
    if(y>H-44){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
    const r1=z1[k]||0, r2=z2[k]||0, dz=r2-r1;
    const rc1=_riskColor(r1), rc2=_riskColor(r2), dzC=dz>0?PDF_TOKENS.danger:PDF_TOKENS.success;
    const zh=36;
    fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,zh,4,"F");
    dc(doc,...rc2); lw(doc,0.25); rr(doc,ml,y,cw,zh,4,"S"); lw(doc,0.3);
    fc(doc,...rc2); doc.rect(ml,y,3,zh,"F"); rr(doc,ml,y,3,zh,1.5,"F");
    // Zone label
    font(doc,9.5,"bold",isAr); tc(doc,...PDF_TOKENS.ink); doc.text(isAr?ar:en,ml+9,y+10);
    font(doc,7,"bold"); tc(doc,...PDF_TOKENS.primary); doc.text(r,ml+9,y+17);
    // Two risk bars side by side
    const bw2=(cw-24)/2, barY=y+22;
    // Session 1 bar
    fc(doc,...PDF_TOKENS.borderSoft); rr(doc,ml+9,barY,bw2,5,2,"F");
    fc(doc,...rc1); rr(doc,ml+9,barY,Math.max(bw2*(r1/100),3),5,2,"F");
    font(doc,6.5,"bold"); tc(doc,...rc1);
    doc.text(`#${num1}: ${r1}%`,ml+9,barY+10);
    // Session 2 bar
    fc(doc,...PDF_TOKENS.borderSoft); rr(doc,ml+9+bw2+4,barY,bw2,5,2,"F");
    fc(doc,...rc2); rr(doc,ml+9+bw2+4,barY,Math.max(bw2*(r2/100),3),5,2,"F");
    font(doc,6.5,"bold"); tc(doc,...rc2);
    doc.text(`#${num2}: ${r2}%`,ml+9+bw2+4,barY+10);
    // Delta badge top right
    const dzlbl=`${dz>0?"↑":"↓"} ${Math.abs(dz)}%`;
    const dzw=doc.getTextWidth(dzlbl)+8;
    fc(doc,...dzC);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
    rr(doc,W-mr-dzw-2,y+7,dzw,9,2,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    font(doc,7.5,"bold"); tc(doc,...dzC);
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
      font(doc,8.5,"bold",isAr); tc(doc,...PDF_TOKENS.danger);
      doc.text(doc.splitTextToSize(lbl,cw*0.58)[0],ml+7,y+5.5); // clear of the delta bar
      font(doc,7.5,"normal",false); tc(doc,...PDF_TOKENS.sub);
      doc.text(`${Math.round(sc1)} → ${Math.round(sc2)} (${d} pts)`,ml+7,y+11);
      const bw2=cw*0.3;
      fc(doc,...PDF_TOKENS.danger);
      doc.setGState&&doc.setGState(new doc.GState({opacity:0.2}));
      // Ratio clamped — deltas beyond 30 pts previously drew a bar wider
      // than its own track, escaping the card to the right.
      rr(doc,W-mr-bw2-2,y+3,Math.max(3,bw2*Math.min(1,Math.abs(d)/30)),8,2,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
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
      font(doc,8.5,"bold",isAr); tc(doc,...PDF_TOKENS.success);
      doc.text(doc.splitTextToSize(lbl,cw-14)[0],ml+7,y+5.5);
      font(doc,7.5,"normal",false); tc(doc,...PDF_TOKENS.sub);
      doc.text(`${Math.round(sc1)} → ${Math.round(sc2)} (+${d} pts)`,ml+7,y+11);
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
  // Engine metric keys → NXT action-card keys. Without this map most
  // engine metrics fell through to NXT.default generic advice.
  const NXT_ALIAS={
    neck_lean_side:"neck_lean", head_yaw:"neck_lean",
    screen_distance:"distance", dist:"distance",
    shoulder_level:"shoulder", rounded_shoulders:"shoulder",
    fhp:"neck_lean", fhp_index:"neck_lean", fhp_side:"neck_lean",
    trunk_lean:"spine_lean",
  };

  const topRegressed=regressed.slice(0,3);
  if(topRegressed.length===0){
    // No regressions — general maintenance actions
    topRegressed.push({k:"default",lbl:isAr?"الصيانة العامة":"General Maintenance",sc2:Math.min(a1,a2)});
  }
  topRegressed.forEach(({k,lbl,sc2},idx)=>{
    if(y>H-42){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
    const col=_scoreColor(sc2||50);
    const steps=NXT[k]||NXT[NXT_ALIAS[k]]||NXT.default;
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
    font(doc,10,"bold"); tc(doc,...col); doc.text(String(idx+1),ml+16,y+17.5,{align:"center"});
    // Title — clamped clear of the card edge
    font(doc,10,"bold",isAr); tc(doc,...PDF_TOKENS.ink);
    doc.text(doc.splitTextToSize(lbl,cw-44)[0],ml+30,y+12);
    font(doc,7.5,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
    steps.slice(0,3).forEach((s,i)=>{
      font(doc,7.5,"bold"); tc(doc,...col);
      doc.text(`${i+1}.`,ml+30,y+22+(i*7));
      font(doc,7.5,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
      doc.text(doc.splitTextToSize(s,cw-44)[0],ml+36,y+22+(i*7));
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
    [isAr?"التغيّر":"Change","—",`${delta>0?"+":""}${delta} pts`],
  ];
  const th3=sumRows.length*9+3;
  fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,th3,4,"F");
  dc(doc,...PDF_TOKENS.border); lw(doc,0.18); rr(doc,ml,y,cw,th3,4,"S"); lw(doc,0.3);
  // Header row
  fc(doc,...PDF_TOKENS.slate); doc.rect(ml,y,cw,9,"F"); rr(doc,ml,y,cw,9,2,"F"); doc.rect(ml,y+5,cw,4,"F");
  font(doc,7.5,"bold"); tc(doc,...PDF_TOKENS.card);
  doc.text(isAr?"البند":"Item",ml+5,y+6.5);
  doc.text(`Session #${num1}`,ml+cw*0.42,y+6.5,{align:"center"});
  doc.text(`Session #${num2}`,ml+cw*0.75,y+6.5,{align:"center"});
  y+=9;
  sumRows.forEach(([k,v1,v2],i)=>{
    if(i%2===0){fc(doc,...PDF_TOKENS.bg); doc.rect(ml,y,cw,9,"F");}
    font(doc,7.5,"normal",isAr); tc(doc,...PDF_TOKENS.muted); doc.text(k,ml+5,y+6.5);
    font(doc,7.5,"bold",false);
    tc(doc,...(i===6?deltaCol:PDF_TOKENS.ink)); doc.text(v1,ml+cw*0.42,y+6.5,{align:"center"});
    tc(doc,...(i===6?deltaCol:PDF_TOKENS.ink)); doc.text(v2,ml+cw*0.75,y+6.5,{align:"center"});
    y+=9;
  });

  // Footers
  const tp=doc.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++){
    doc.setPage(p);
    _ftr(doc,W,ml,mr,H,p,tp,name);
  }

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
export async function generateTeamPDF({ users=[], company="", dateRange=30, profile, lang="en", aiSummary="" }) {
  const { jsPDF } = await import("jspdf");
  const isAr = lang==="ar";
  const tier = _t(profile?.tier||"standard");
  // tier check handled in UI — proceed regardless

  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const W=210,H=297,ml=18,mr=18,cw=W-ml-mr;
  const cairo = await _loadCairo(doc);
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
    if(y>H-30){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"التوزيع":"Distribution"); y=22;}
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
    if(y>H-60){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"الموظفون في خطر":"At-Risk Employees"); y=22;}
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
      if(y>H-18){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"الموظفون في خطر":"At-Risk"); y=22;}
      fc(doc,...PDF_TOKENS.bg); doc.rect(ml,y,cw,8,"F");
      sf(8,"normal"); tc(doc,...PDF_TOKENS.ink);
      doc.text(u.name||u.email||"—",ml+3,y+5.5);
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
  if(y>H-70){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"تصنيف الفريق":"Team Leaderboard"); y=22;}
  sf(10,"bold"); tc(doc,...PDF_TOKENS.ink);
  doc.text(isAr?"تصنيف الأداء":"Performance Leaderboard",ml,y); y+=7;
  const sorted=[...activeUsers].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0));
  fc(doc,...PDF_TOKENS.ink); rr(doc,ml,y,cw,9,1,"F");
  sf(7,"bold"); tc(doc,255,255,255);
  doc.text("#",ml+3,y+6); doc.text(isAr?"الاسم":"Name",ml+14,y+6);
  doc.text(isAr?"النتيجة":"Score",ml+cw*0.65,y+6); doc.text(isAr?"التقييم":"Grade",ml+cw*0.82,y+6);
  y+=11;
  for(const [i,u] of sorted.slice(0,10).entries()){
    if(y>H-18){doc.addPage(); y=22;}
    fc(doc,i%2===0?248:255,i%2===0?250:255,i%2===0?252:255); doc.rect(ml,y,cw,8,"F");
    const sc=Math.round(u.avg_score||0); const col=_scoreColor(sc);
    sf(8,"bold"); tc(doc,...(i<3?col:PDF_TOKENS.muted)); doc.text(String(i+1),ml+3,y+5.5);
    sf(8,"normal"); tc(doc,...PDF_TOKENS.ink); doc.text(u.name||u.email||"—",ml+14,y+5.5);
    sf(8,"bold"); tc(doc,...col); doc.text(String(sc),ml+cw*0.65,y+5.5);
    sf(7.5,"normal"); doc.text(_scoreLabel(sc,isAr),ml+cw*0.82,y+5.5);
    y+=8;
  }

  // HR Recommendations
  y+=10;
  if(y>H-60){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"توصيات":"HR Recommendations"); y=22;}
  sf(10,"bold"); tc(doc,...PDF_TOKENS.ink);
  doc.text(isAr?"توصيات لمدير الموارد البشرية":"HR Recommendations",ml,y); y+=7;
  const hrRecs = [
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
    if(y>H-22){doc.addPage(); y=22;}
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
    font(doc,6.5,"normal"); tc(doc,100,116,139);
    doc.text(`Posmoz — ${isAr?"تقرير الفريق — سري":"Team Report — Confidential"} · ${nowStr}`,ml,H-2.5);
    doc.text(`${p} / ${tp}`,W-mr,H-2.5,{align:"right"});
  }

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


export async function generateLongitudinalPDF({ sessions=[], profile, user, lang="en", aiSummary="" }) {
  const { jsPDF } = await import("jspdf");
  if (sessions.length < 2) { console.warn("[PDF] Need more sessions for longitudinal"); }
  const isAr = lang==="ar";
  const tier = _t(profile?.tier||"standard");
  // tier check handled in UI — proceed regardless

  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  await Promise.all([_ensureCairoFont(doc), _ensureLogo()]);
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

  // Guard: an empty sessions list must render an empty report, not crash
  const weeksSpan   = Math.max(1,Math.ceil((Date.now()-(sorted.length?toMs(sorted[0]):Date.now()))/(7*86400000)));
  const freqPerWeek = (sessions.length/weeksSpan).toFixed(1);
  const totalAlerts = sessions.reduce((a,s)=>a+(s.alerts_count||0),0);
  const avgDurMin   = sessions.length?Math.round(sessions.reduce((a,s)=>a+(s.duration_s||s.duration_sec||0),0)/sessions.length/60):0;

  const allZonal = sessions.filter(s=>s.metrics).map(s=>_zonalRisk(s.metrics));
  const avgZonal = {
    cervical: allZonal.length?Math.round(allZonal.reduce((a,b)=>a+b.cervical,0)/allZonal.length):0,
    thoracic: allZonal.length?Math.round(allZonal.reduce((a,b)=>a+b.thoracic,0)/allZonal.length):0,
    lumbar:   allZonal.length?Math.round(allZonal.reduce((a,b)=>a+b.lumbar,0)/allZonal.length):0,
  };
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
  font(doc,13,"bold"); tc(doc,...PDF_TOKENS.card);
  doc.text("POSMOZ",ml+34,30);
  font(doc,7,"normal"); tc(doc,148,163,184);
  doc.text("Health Intelligence Platform",ml+34,38);

  // ELITE badge
  const elbadge="* ELITE";
  const elw=doc.getTextWidth(elbadge)+12;
  fc(doc,...PDF_TOKENS.success);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.18}));
  rr(doc,ml+34,43,elw,10,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,7.5,"bold"); tc(doc,...PDF_TOKENS.success);
  doc.text(elbadge,ml+34+elw/2,50,{align:"center"});

  // Date + session count right
  font(doc,7,"normal"); tc(doc,148,163,184);
  doc.text(nowStr,W-mr,27,{align:"right"});
  font(doc,7.5,"bold"); tc(doc,...PDF_TOKENS.card);
  doc.text(`${sessions.length} ${isAr?"جلسة":"sessions"} · ${weeksSpan} ${isAr?"أسبوع":"weeks"}`,W-mr,37,{align:"right"});

  // Bottom accent
  fc(doc,...trendCol); doc.rect(0,77.5,W,2.5,"F");

  // Report title block
  let y=96;
  font(doc,22,"bold"); tc(doc,...PDF_TOKENS.ink);
  doc.text(isAr?"التقرير الطولي":"Longitudinal Health Report",ml,y); y+=10;
  font(doc,10,"normal"); tc(doc,...PDF_TOKENS.muted);
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
    font(doc,16,"bold"); tc(doc,...col);
    doc.text(v,kx+kw/2,ky+kh*0.58,{align:"center"});
    // Label
    font(doc,7,"bold"); tc(doc,...PDF_TOKENS.muted);
    doc.text(l,kx+kw/2,ky+kh*0.82,{align:"center"});
  });
  y+=kh*2+6*2+12;

  // ── TREND BANNER ───────────────────────────────────────────
  const trendIcon = improved?"[UP]":declined?"[DOWN]":"[STABLE]";
  const trendText = improved
    ? (isAr?`تحسّن مستمر +${trendDelta} نقطة منذ البداية — أنت على المسار الصحيح`:`Consistent improvement +${trendDelta}pts since start`)
    : declined
    ? (isAr?`انخفاض ${Math.abs(trendDelta)} نقطة — راجع إعداد محطة العمل`:`${Math.abs(trendDelta)}pt decline — review workstation setup`)
    : (isAr?"الوضعية مستقرة — الاتساق إيجابي":"Posture stable — consistency is positive");
  fc(doc,...trendBg); rr(doc,ml,y,cw,14,3,"F");
  dc(doc,...trendCol); lw(doc,0.25); rr(doc,ml,y,cw,14,3,"S"); lw(doc,0.3);
  fc(doc,...trendCol); doc.rect(ml,y,3,14,"F"); rr(doc,ml,y,3,14,1.5,"F");
  font(doc,8.5,"bold",isAr); tc(doc,...trendCol);
  doc.text(doc.splitTextToSize(`${trendIcon}  ${trendText}`,cw-14)[0],ml+8,y+9.2);
  y+=22;

  // ── SCORE TRAJECTORY ────────────────────────────────────────
  _sh(doc,ml,y,isAr?"مسار النقاط":"Score Trajectory",isAr?"كل الجلسات بالترتيب الزمني":"All sessions in chronological order",_scoreColor(avgAll),isAr);
  y+=14;
  const th=42;
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
    font(doc,5,"normal"); tc(doc,...PDF_TOKENS.light);
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
    font(doc,6,"bold"); tc(doc,...lC);
    doc.text(String(allScores[0]),spts[0].px,spts[0].py-4,{align:"center"});
    doc.text(String(allScores[allScores.length-1]),spts[spts.length-1].px,spts[spts.length-1].py-4,{align:"center"});
  }
  y+=th+10;

  // ══════════════════════════════════════════════════════════════
  // PAGE 2 — WEEKLY PATTERN + ZONE RISK
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
      font(doc,5.5,"normal"); tc(doc,...PDF_TOKENS.light);
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
    font(doc,6.5,"bold"); tc(doc,...bc);
    doc.text(String(avg),bx+barW2/2,y+barZoneH-12-bh-2,{align:"center"});
    // Day label
    font(doc,6,"bold"); tc(doc,...(di===bestDay?PDF_TOKENS.success:di===worstDay?PDF_TOKENS.danger:PDF_TOKENS.muted));
    doc.text(isAr?dayNamesAr[di]:dayNamesEn[di],bx+barW2/2,y+barZoneH-1.5,{align:"center"});
  });
  y+=barZoneH+8;

  // Best/worst day insight strip
  if(bestDay>=0&&worstDay>=0){
    const bdn=isAr?dayNamesAr[bestDay]:dayNamesEn[bestDay];
    const wdn=isAr?dayNamesAr[worstDay]:dayNamesEn[worstDay];
    fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,11,2,"F");
    font(doc,7.5,"normal"); tc(doc,...PDF_TOKENS.sub);
    const ins=isAr
      ?`أفضل يوم: ${bdn} (${dayAvgs[bestDay]}) · أسوأ يوم: ${wdn} (${dayAvgs[worstDay]})`
      :`Best day: ${bdn} (${dayAvgs[bestDay]}) · Worst day: ${wdn} (${dayAvgs[worstDay]})`;
    doc.text(ins,ml+cw/2,y+7.5,{align:"center"});
    y+=18;
  }

  // ── SPINAL ZONE RISK ──────────────────────────────────────────
  y+=4;
  _sh(doc,ml,y,isAr?"خريطة مناطق الخطر":"Spinal Zone Risk Map",isAr?"متوسط من كل الجلسات":"Averaged across all sessions",PDF_TOKENS.danger,isAr);
  y+=16;

  // NOTE: previous Arabic labels used "عنق الرحم" (cervix) — corrected.
  const zones=[
    {k:"cervical",en:"Cervical (Neck)",   ar:"الفقرات العنقية (الرقبة)",     r:"C1–C7",  desc:isAr?"ميل الرقبة وتقدم الرأس للأمام ودورانه":"Neck lean, FHP, head tilt and rotation"},
    {k:"thoracic",en:"Thoracic (Upper)",  ar:"الفقرات الصدرية (أعلى الظهر)", r:"T1–T12", desc:isAr?"توازن الكتفين وانحناء أعلى الظهر":"Shoulder symmetry and upper spinal curvature"},
    {k:"lumbar",  en:"Lumbar (Lower)",    ar:"الفقرات القطنية (أسفل الظهر)", r:"L1–S1",  desc:isAr?"محاذاة العمود الفقري وزاوية الورك":"Spinal alignment and hip angle"},
  ];
  zones.forEach(({k,en,ar,r,desc})=>{
    if(y>H-42){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خريطة المخاطر":"Risk Map",isAr);y=22;}
    const risk=avgZonal[k]||0, rc=_riskColor(risk);
    const zh=34;
    fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,zh,4,"F");
    dc(doc,...rc); lw(doc,0.25); rr(doc,ml,y,cw,zh,4,"S"); lw(doc,0.3);
    fc(doc,...rc); doc.rect(ml,y,3,zh,"F"); rr(doc,ml,y,3,zh,1.5,"F");
    // Risk circle
    fc(doc,...rc); doc.circle(ml+18,y+zh/2,10,"F");
    font(doc,9.5,"bold"); tc(doc,...PDF_TOKENS.card);
    doc.text(`${risk}%`,ml+18,y+zh/2+3.5,{align:"center"});
    // Title + region
    font(doc,10,"bold",isAr); tc(doc,...PDF_TOKENS.ink);
    doc.text(isAr?ar:en,ml+33,y+10);
    font(doc,7,"bold"); tc(doc,...PDF_TOKENS.primary); doc.text(r,ml+33,y+17);
    // Risk label pill
    const rlbl=_riskLabel(risk,isAr);
    const rw=doc.getTextWidth(rlbl)+8;
    fc(doc,...rc);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
    rr(doc,W-mr-rw-2,y+6,rw,9,2,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    font(doc,7.5,"bold"); tc(doc,...rc);
    doc.text(rlbl,W-mr-rw/2-2,y+11.8,{align:"center"});
    // Progress bar
    const bx=ml+33, bw2=cw*0.42;
    fc(doc,...PDF_TOKENS.borderSoft); rr(doc,bx,y+21,bw2,5,2,"F");
    fc(doc,...rc); rr(doc,bx,y+21,Math.max(bw2*(risk/100),3),5,2,"F");
    // Desc — clamped to the card
    font(doc,7,"normal",isAr); tc(doc,...PDF_TOKENS.muted);
    doc.text(doc.splitTextToSize(desc,cw-42)[0],ml+33,y+zh-4);
    y+=zh+7;
  });

  // ── BEST / WORST SESSION CARDS ─────────────────────────────
  y+=6;
  if(y>H-80){doc.addPage();_hdr(doc,W,ml,mr,isAr?"أفضل وأسوأ":"Best & Worst",isAr);y=22;}
  _sh(doc,ml,y,isAr?"أفضل وأسوأ جلسة":"Best & Worst Sessions","",PDF_TOKENS.success,isAr);
  y+=14;

  [[isAr?"* الجلسة الأفضل":"* Best Session",best,PDF_TOKENS.success],
   [isAr?"! الجلسة الأسوأ":"! Worst Session",worst,PDF_TOKENS.danger]
  ].forEach(([label,sess,col])=>{
    // Old guard fell through with a null session after a page break → crash
    if(!sess) return;
    if(y>H-36){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
    const sh2=28;
    fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,sh2,4,"F");
    dc(doc,...col); lw(doc,0.25); rr(doc,ml,y,cw,sh2,4,"S"); lw(doc,0.3);
    fc(doc,...col); doc.rect(ml,y,3,sh2,"F"); rr(doc,ml,y,3,sh2,1.5,"F");
    // Score badge
    fc(doc,...col); rr(doc,ml+7,y+5,18,18,3,"F");
    font(doc,11,"bold"); tc(doc,...PDF_TOKENS.card);
    doc.text(String(Math.round(sess.avg_score||0)),ml+16,y+16,{align:"center"});
    // Label
    font(doc,9.5,"bold",isAr); tc(doc,...PDF_TOKENS.ink); doc.text(label,ml+30,y+11);
    font(doc,7.5,"normal"); tc(doc,...PDF_TOKENS.muted);
    doc.text(_fmtDate(sess.created_at,isAr),ml+30,y+19);
    // Right stats
    font(doc,7.5,"bold"); tc(doc,...col);
    doc.text(`${isAr?"المدة":"Duration"}: ${_fmtDur(sess.duration_s||sess.duration_sec||0)}`,W-mr-2,y+11,{align:"right"});
    font(doc,7,"normal"); tc(doc,...PDF_TOKENS.muted);
    doc.text(`${isAr?"تنبيهات":"Alerts"}: ${sess.alerts_count||0}`,W-mr-2,y+19,{align:"right"});
    y+=sh2+8;
  });

  // ══════════════════════════════════════════════════════════════
  // PAGE 3 — AI NARRATIVE + 8-WEEK PROGRAMME
  // ══════════════════════════════════════════════════════════════
  doc.addPage(); _hdr(doc,W,ml,mr,isAr?"التحليل والخطة":"Analysis & Plan",isAr); y=22;

  // AI narrative
  _sh(doc,ml,y,isAr?"تحليل Posmoz AI":"Posmoz AI Analysis",isAr?"مولّد من بيانات جلساتك":"Generated from your session data",PDF_TOKENS.primary,isAr);
  y+=16;

  const highestRiskAll = Math.max(avgZonal.cervical, avgZonal.thoracic, avgZonal.lumbar);
const highestRiskName = avgZonal.cervical >= avgZonal.thoracic && avgZonal.cervical >= avgZonal.lumbar
  ? (isAr ? "الفقرات العنقية (الرقبة)" : "Cervical (neck)")
  : avgZonal.thoracic >= avgZonal.lumbar
    ? (isAr ? "الفقرات الصدرية (أعلى الظهر)" : "Thoracic (upper back)")
    : (isAr ? "الفقرات القطنية (أسفل الظهر)" : "Lumbar (lower back)");

const narrative=[
  improved
    ? (isAr
      ? `عبر ${sessions.length} جلسة، حقق ${name} تحسناً مستمراً +${trendDelta} نقطة في جودة الوضعية. الاتجاه التصاعدي يؤكد تكوين عادات فعالة.${bestDay >= 0 ? ` جلسات يوم ${(isAr ? dayNamesAr[bestDay] : dayNamesEn[bestDay])} تتفوق باستمرار.` : ""} متوسط 90 يوم: ${avg90}/100.`
      : `Over ${sessions.length} sessions, ${name} achieved a consistent +${trendDelta} point improvement. 90-day average: ${avg90}/100. Upward trajectory confirms effective habit formation.${bestDay >= 0 ? ` ${(isAr?dayNamesAr[bestDay]:dayNamesEn[bestDay])} sessions consistently outperform others.` : ""}`)
    : declined
    ? (isAr
      ? `عبر ${sessions.length} جلسة، لوحظ انخفاض ${Math.abs(trendDelta)} نقطة. هذا النمط يتبع عادةً زيادة في عبء العمل أو تغييرات في الإرغونوميكس. أعلى منطقة خطر: ${highestRiskName} (${highestRiskAll}%).`
      : `Across ${sessions.length} sessions, a ${Math.abs(trendDelta)}-point decline was observed. This pattern typically follows increased workload or ergonomic changes. Highest-risk zone: ${highestRiskName} (${highestRiskAll}%).`)
    : (isAr
      ? `جودة الوضعية ظلت مستقرة عبر ${sessions.length} جلسة (متوسط ${avgAll}/100). الاتساق إيجابي، لكن هناك إمكانية لتحسين 10-15 نقطة. أعلى منطقة خطر: ${highestRiskName} (${highestRiskAll}%).`
      : `Posture quality remained stable across ${sessions.length} sessions (avg ${avgAll}/100). While consistency is positive, 10-15 point improvement is achievable. Highest-risk zone: ${highestRiskName} (${highestRiskAll}%).`),
  (isAr
    ? `مناطق العمود الفقري: العنقية ${avgZonal.cervical}٪، الصدرية ${avgZonal.thoracic}٪، القطنية ${avgZonal.lumbar}٪. المنطقة الأعلى خطراً: ${highestRiskName}. ${highestRiskAll > 50 ? "مستوى الخطر هذا يتطلب تدخلاً مستهدفاً فورياً." : "المستويات الحالية قابلة للتحسين من خلال تمارين مستهدفة."}`
    : `Spinal zones: Cervical ${avgZonal.cervical}%, Thoracic ${avgZonal.thoracic}%, Lumbar ${avgZonal.lumbar}%. Primary risk: ${highestRiskName}. ${highestRiskAll > 50 ? "This risk level requires immediate targeted intervention." : "Current levels are improvable through targeted exercises."}`),
  (isAr
    ? `معدل الجلسات: ${freqPerWeek} جلسة/أسبوع، ومتوسط المدة: ${avgDurMin} دقيقة. ${parseFloat(freqPerWeek) < 3 ? "زيادة المعدل إلى 3–4 جلسات أسبوعياً ستسرّع التحسن بشكل ملحوظ." : "الاستمرارية جيدة — حافظ على هذا المعدل لتثبيت المكاسب."} إجمالي التنبيهات: ${totalAlerts} عبر ${sessions.length} جلسة.`
    : `Session frequency: ${freqPerWeek}/week, average duration: ${avgDurMin} minutes. ${parseFloat(freqPerWeek) < 3 ? "Increasing to 3-4 sessions per week would significantly accelerate improvement." : "Good consistency — maintain this frequency to consolidate gains."} Total alerts: ${totalAlerts} across ${sessions.length} sessions.`),
].join("\n\n");

  // Chunked rendering: the old code drew ONE box sized to the full text
  // (overflowing past the page bottom) and then paginated the text
  // WITHOUT a box — text floating outside any container. Now each page
  // gets its own correctly-sized box around exactly the lines it holds.
  const narLines=doc.splitTextToSize(narrative.replace(/[#*`]/g,"").trim(),cw-12);
  let li=0;
  while(li<narLines.length){
    const avail=H-24-y;
    const fit=Math.max(1,Math.min(narLines.length-li,Math.floor((avail-10)/5.4)));
    const boxH=fit*5.4+9;
    fc(doc,...PDF_TOKENS.bg); rr(doc,ml,y,cw,boxH,4,"F");
    dc(doc,...PDF_TOKENS.border); lw(doc,0.15); rr(doc,ml,y,cw,boxH,4,"S"); lw(doc,0.3);
    font(doc,8.5,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
    for(let j=0;j<fit;j++){ doc.text(narLines[li+j],ml+5,y+7+j*5.4); }
    li+=fit; y+=boxH+4;
    if(li<narLines.length){ doc.addPage(); _hdr(doc,W,ml,mr,isAr?"التحليل":"Analysis",isAr); y=22; }
  }
  y+=10;

  // 8-week programme
  if(y>H-100){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الخطة":"Programme",isAr);y=22;}
  _sh(doc,ml,y,isAr?"برنامج التحسين — 8 أسابيع":"8-Week Improvement Programme",isAr?"خطة مخصصة لنتائجك":"Personalised to your results",PDF_TOKENS.success,isAr);
  y+=16;

  const highestRiskZone = avgZonal.cervical >= avgZonal.thoracic && avgZonal.cervical >= avgZonal.lumbar ? "cervical" : avgZonal.thoracic >= avgZonal.lumbar ? "thoracic" : "lumbar";
const zoneExercises = {
  cervical: isAr ? "إدخال الذقن 3×10 + دوران الرقبة 2×10 لكل جانب + إطالة الصدر على إطار الباب 3×30 ثانية" : "chin tucks 3x10 + cervical rotation 2x10/side + doorway chest stretch 3x30s",
  thoracic: isAr ? "بسط الظهر العلوي على الفوم رولر 2×60 ثانية + رفعات W-Y-T ‏3×12 + ملائكة الحائط 2×10" : "thoracic extension (foam roller) 2x60s + W-Y-T raises 3x12 + wall angels 2x10",
  lumbar: isAr ? "إمالة الحوض الخلفية 3×10 + تمرين bird-dog ‏3×10 لكل جانب + إطالة عضلات الورك 3×30 ثانية لكل جانب" : "posterior pelvic tilt 3x10 + bird-dog 3x10/side + hip flexor stretch 3x30s/side",
};
const targetZone = highestRiskZone === "cervical" ? (isAr ? "الرقبة" : "neck/cervical") : highestRiskZone === "thoracic" ? (isAr ? "أعلى الظهر" : "thoracic/upper back") : (isAr ? "أسفل الظهر" : "lumbar/lower back");
const programme=[
    {wk:"1-2",goal: isAr ? "الوعي بالوضعية" : "Posture Awareness",
     action: isAr
       ? `جلسة مراقبة يومية 20 دقيقة على الأقل. راقب التنبيهات وصحح وضعيتك ذاتياً. مخاطر ${targetZone} الحالية: ${avgZonal[highestRiskZone]}٪.`
       : `Daily 20-min monitored session. Observe alerts and self-correct. Current ${targetZone} risk: ${avgZonal[highestRiskZone]}%.`},
    {wk:"3-4",goal: isAr ? "بيئة العمل + التمارين" : "Workstation + Exercises",
     action: isAr
       ? `اضبط الشاشة لمستوى العين وارتفاع الكرسي. ابدأ: ${zoneExercises[highestRiskZone]}. الهدف: +5 نقاط في المتوسط الأسبوعي.`
       : `Adjust monitor to eye level + chair height. Start: ${zoneExercises[highestRiskZone]}. Target: +5pt weekly average.`},
    {wk:"5-6",goal: isAr ? "بناء العادة" : "Habit Building",
     action: isAr
       ? `واصل التمارين يومياً وأضف تذكير استراحة كل 30 دقيقة. التحسن المتوقع في ${targetZone}: ‏5–10٪.`
       : `Continue exercises daily. Add break reminder every 30 min. Expected ${targetZone} improvement: 5-10%.`},
    {wk:"7-8",goal: isAr ? "القياس والتثبيت" : "Consolidation & Measure",
     action: isAr
       ? `قارن متوسطك بأسبوعي البداية. الهدف: +10 نقاط على الأقل، ثم أعد تقييم مخاطر ${targetZone}.`
       : `Compare avg to weeks 1-2 baseline. Target: +10 points minimum. Reassess ${targetZone} risk zone.`},
  ];

  programme.forEach(({wk,goal,action},idx)=>{
    // Dynamic card height — the old fixed 28mm card truncated the action
    // text to 2 lines, cutting sentences mid-word.
    font(doc,7.5,"normal",isAr);
    const aLines=doc.splitTextToSize(action,cw-40).slice(0,3);
    const ph=Math.max(28, 14+aLines.length*5+7);
    if(y>H-ph-14){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الخطة":"Programme",isAr);y=22;}
    fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,ph,4,"F");
    dc(doc,...PDF_TOKENS.border); lw(doc,0.18); rr(doc,ml,y,cw,ph,4,"S"); lw(doc,0.3);
    // Week badge
    fc(doc,...PDF_TOKENS.primary);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
    rr(doc,ml+4,y+5,22,18,3,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    dc(doc,...PDF_TOKENS.primary); lw(doc,0.8); rr(doc,ml+4,y+5,22,18,3,"S"); lw(doc,0.3);
    font(doc,6.5,"bold"); tc(doc,...PDF_TOKENS.primary);
    doc.text("W",ml+15,y+11.5,{align:"center"});
    doc.text(wk,ml+15,y+17,{align:"center"});
    // Goal + action
    font(doc,9.5,"bold",isAr); tc(doc,...PDF_TOKENS.ink);
    doc.text(doc.splitTextToSize(goal,cw-40)[0],ml+32,y+11);
    font(doc,7.5,"normal",isAr); tc(doc,...PDF_TOKENS.sub);
    aLines.forEach((l,i)=>doc.text(l,ml+32,y+18+(i*5)));
    y+=ph+7;
  });

  // ── SESSION STATS TABLE ───────────────────────────────────
  y+=4; if(y>H-70){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الإحصائيات":"Statistics",isAr);y=22;}
  _sh(doc,ml,y,isAr?"ملخص الإحصائيات":"Summary Statistics","",PDF_TOKENS.indigo,isAr);
  y+=14;

  const stats=[
    [isAr?"إجمالي الجلسات":"Total sessions",         String(sessions.length)],
    [isAr?"المدة الإجمالية":"Total duration",         `${Math.round(sessions.reduce((a,s)=>a+(s.duration_s||s.duration_sec||0),0)/60)} min`],
    [isAr?"متوسط الدرجة (الكل)":"All-time avg score",`${avgAll}/100`],
    [isAr?"متوسط الدرجة (90 يوم)":"90-day avg score",`${avg90}/100`],
    [isAr?"إجمالي التنبيهات":"Total alerts",          String(totalAlerts)],
    [isAr?"أعلى نقطة":"Best score",                   `${best?.avg_score||0}/100 · ${_fmtDate(best?.created_at,isAr)}`],
    [isAr?"أدنى نقطة":"Worst score",                  `${worst?.avg_score||0}/100 · ${_fmtDate(worst?.created_at,isAr)}`],
    [isAr?"التغيّر الكلي":"Overall trend",             `${trendDelta>0?"+":""}${trendDelta} pts · ${improved?"Improving":declined?"Declining":"Stable"}`],
  ];
  const th2=stats.length*8.5+2;
  fc(doc,...PDF_TOKENS.card); rr(doc,ml,y,cw,th2,4,"F");
  dc(doc,...PDF_TOKENS.border); lw(doc,0.18); rr(doc,ml,y,cw,th2,4,"S"); lw(doc,0.3);
  stats.forEach(([k,v],i)=>{
    if(i%2===0){fc(doc,...PDF_TOKENS.bg); doc.rect(ml,y,cw,8.5,"F");}
    font(doc,7.5,"normal",isAr); tc(doc,...PDF_TOKENS.muted); doc.text(k,ml+5,y+5.8);
    font(doc,7.5,"bold",false); tc(doc,...PDF_TOKENS.ink); doc.text(v,ml+cw-5,y+5.8,{align:"right"});
    y+=8.5;
  });

  // ── FOOTERS ───────────────────────────────────────────────
  const tp=doc.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++){
    doc.setPage(p);
    _ftr(doc,W,ml,mr,H,p,tp,name);
  }

  const filename=`Posmoz_Longitudinal_${now.toISOString().slice(0,10)}.pdf`;
  await doc.save(filename, {returnPromise:true});
  return filename;
}

// ── AI Executive Report — alias for Longitudinal ─────────────────
export async function generateAIPDF({ sessions=[], profile, aiSummary="", lang="en" }) {
  return generateLongitudinalPDF({ sessions, profile, lang, aiSummary });
}
