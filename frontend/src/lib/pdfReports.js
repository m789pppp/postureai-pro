/**
 * pdfReports.js — Corvus PDF Report System
 * Restored from Design System v5 (ae1b320)
 * Apple Health × Bloomberg Terminal × WHO Medical Reports
 */

import { tierAtLeast } from "./tierQuality.js";

// ── Metric labels (used in PDF tables) ───────────────────────────
const METRIC_LABELS = {
  neck_lean:"Neck Lean", neck_lean_side:"Neck Lean (Side)",
  head_tilt:"Head Tilt", head_yaw:"Head Rotation",
  shoulder:"Shoulder Balance", spine_lean:"Spine Lean",
  spine_align:"Spine Alignment", fhp:"Forward Head Posture",
  fhp_side:"Forward Head (Side)", rounded:"Rounded Shoulders",
  elbow:"Elbow Angle", monitor:"Monitor Height",
  distance:"Viewing Distance", trunk_lean:"Trunk Lean",
  hip_angle:"Hip Angle", knee_angle:"Knee Angle",
};
const METRIC_LABELS_AR = {
  neck_lean:"ميل الرقبة", neck_lean_side:"ميل الرقبة (جانبي)",
  head_tilt:"انحناء الرأس", head_yaw:"دوران الرأس",
  shoulder:"توازن الكتفين", spine_lean:"ميل العمود الفقري",
  spine_align:"محاذاة العمود الفقري", fhp:"تقدم الرأس للأمام",
  fhp_side:"تقدم الرأس (جانبي)", rounded:"تقريس الأكتاف",
  elbow:"زاوية الكوع", monitor:"ارتفاع الشاشة",
  distance:"مسافة المشاهدة", trunk_lean:"ميل الجذع",
  hip_angle:"زاوية الورك", knee_angle:"زاوية الركبة",
};


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
const T = {
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
const F = {
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
function _sc(s){ return s>=80?T.success:s>=60?T.warning:T.danger; }
const _scoreColor = _sc; // alias used in Comparison + Longitudinal + Team PDFs
function _scoreLabel(s,isAr){
  if(s>=80) return isAr?"ممتاز":"Excellent";
  if(s>=60) return isAr?"جيد":"Good";
  if(s>=40) return isAr?"مقبول":"Fair";
  return isAr?"يحتاج تحسين":"Needs Work";
}
// Normalize tier string aliases (personal_elite→elite, b2b_growth→professional, etc.)
const _t = t => (!t?"standard":t.includes("elite")||t==="enterprise"||t==="premium"?"elite":t.includes("pro")||t.includes("professional")||t==="growth"?"professional":t);
function _scLt(s){ return s>=80?T.successLt:s>=60?T.warningLt:T.dangerLt; }
function _sl(s,ar){ return s>=80?(ar?"ممتاز":"Excellent"):s>=60?(ar?"جيد":"Good"):(ar?"يحتاج تحسين":"Needs Work"); }
function _riskLabel(v,ar){ return v>=70?(ar?"عالي":"High"):v>=40?(ar?"متوسط":"Moderate"):(ar?"منخفض":"Low"); }
function _riskColor(v){ return v>=70?T.danger:v>=40?T.warning:T.success; }
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
function hr(doc,x,y,w,col=T.border,thickness=0.18){dc(doc,...col);lw(doc,thickness);doc.line(x,y,x+w,y);lw(doc,0.3);}
function vl(doc,x,y,h,col=T.border){dc(doc,...col);lw(doc,0.18);doc.line(x,y,x,y+h);lw(doc,0.3);}

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
  try{const{LOGO_SM_B64,LOGO_MD_B64,LOGO_LG_B64}=await import("../assets/corvusLogo.js");
    _logoSm=LOGO_SM_B64;_logoMd=LOGO_MD_B64;_logoLg=LOGO_LG_B64;}
  catch(e){console.warn("Logo load failed:",e);}
}
function _logo(doc,x,y,sz,b64){
  if(b64){try{doc.addImage(b64,"PNG",x,y,sz,sz);return;}catch{}}
  fc(doc,3,11,20);rr(doc,x,y,sz,sz,sz*.14,"F");
  fc(doc,...T.primary);rr(doc,x+sz*.19,y+sz*.19,sz*.62,sz*.62,sz*.12,"F");
  font(doc,sz*.42,"bold");tc(doc,...T.card);doc.text("P",x+sz/2,y+sz*.72,{align:"center"});
}

// ── _zonalRisk ─────────────────────────────────────────────────────
function _zonalRisk(metrics){
  if(!metrics) return{cervical:0,thoracic:0,lumbar:0};
  const sc=k=>typeof metrics[k]==="number"?metrics[k]:(metrics[k]?.score??100);
  return{
    cervical:Math.round(100-Math.min(100,(sc("neck_lean")+sc("head_tilt")+sc("head_yaw"))/3)),
    thoracic:Math.round(100-Math.min(100,(sc("shoulder")+sc("rounded_shoulders")+sc("spine_lean"))/3)),
    lumbar:  Math.round(100-Math.min(100,(sc("spine_align")+sc("hip_angle")+sc("trunk_lean"))/3)),
  };
}

// ══════════════════════════════════════════════════════════════════
// v5 PREMIUM COMPONENTS
// ══════════════════════════════════════════════════════════════════

// ── COVER HEADER — cinematic dark with brand gradient ─────────────
function _coverV5(doc,W,ml,tier,tierCol,name,label,sub,now){
  // Full bleed dark
  fc(doc,...T.slate);doc.rect(0,0,W,76,"F");
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
  font(doc,13.5,"bold");tc(doc,...T.card);doc.text("CORVUS",ml+36,30);
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
  font(doc,7.5,"bold");tc(doc,...T.card);doc.text(label,W-ml,37,{align:"right"});
  if(sub){font(doc,6.5,"normal");tc(doc,130,148,180);doc.text(sub,W-ml,45,{align:"right"});}
  // Bottom divider
  fc(doc,...tierCol);doc.rect(0,73.5,W,2.5,"F");
}

// ── INNER PAGE HEADER ──────────────────────────────────────────────
function _hdr(doc,W,ml,mr,label,isAr){
  fc(doc,...T.bg);doc.rect(0,0,W,15,"F");
  fc(doc,...T.primary);doc.rect(0,15,W,.35,"F");
  _logo(doc,ml,3.5,8,_logoSm);
  font(doc,7.5,"bold");tc(doc,...T.ink2);doc.text("Corvus",ml+12,10);
  font(doc,6.5,"normal");tc(doc,...T.muted);doc.text("Health Intelligence",ml+28,10);
  font(doc,7,"bold");tc(doc,...T.primary);doc.text(label,W-mr,10,{align:"right"});
}

// ── FOOTER ─────────────────────────────────────────────────────────
function _ftr(doc,W,ml,mr,H,p,total,name){
  hr(doc,0,H-10,W,T.border);
  fc(doc,...T.bg);doc.rect(0,H-9.5,W,9.5,"F");
  font(doc,F.micro,"normal");tc(doc,...T.ghost);
  doc.text("Corvus Health Intelligence · Confidential · Not a medical diagnosis",ml,H-3.5);
  font(doc,F.micro,"bold");tc(doc,...T.muted);
  doc.text(name,W/2,H-3.5,{align:"center"});
  doc.text(`${p} / ${total}`,W-mr,H-3.5,{align:"right"});
}

// ── SECTION HEADING with left accent ─────────────────────────────
function _sh(doc,ml,y,title,sub="",col=T.primary,isAr=false){
  fc(doc,...col);doc.rect(ml,y,2.2,sub?14:9.5,"F");
  font(doc,F.h2,"bold",isAr);tc(doc,...T.ink);doc.text(title,ml+7,y+(sub?7:7));
  if(sub){font(doc,F.small,"normal",isAr);tc(doc,...T.light);doc.text(sub,ml+7,y+13);}
  return y+(sub?21:14);
}

// ── SCORE RING v5 — with inner glow simulation ─────────────────────
function _ring(doc,cx,cy,r,score,isAr,showGrade=true){
  const col=_sc(score),lbl=_sl(score,isAr);
  // Outer track
  dc(doc,...T.borderSoft);lw(doc,3.5);doc.circle(cx,cy,r,"S");lw(doc,0.3);
  // Inner tint
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.06}));
  doc.circle(cx,cy,r-2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Score arc
  dc(doc,...col);lw(doc,3.5);doc.circle(cx,cy,r,"S");lw(doc,0.3);
  // Number
  font(doc,F.dataXl,"bold");tc(doc,...col);
  doc.text(String(score),cx,cy+4,{align:"center"});
  font(doc,F.micro+.5,"normal");tc(doc,...T.muted);
  doc.text("/100",cx,cy+10,{align:"center"});
  if(showGrade){font(doc,F.small+.5,"bold",isAr);tc(doc,...col);doc.text(lbl,cx,cy+r+8,{align:"center"});}
}

// ── METRIC ROW v5 ─────────────────────────────────────────────────
function _mRow(doc,x,y,w,lbl,value,unit,score,isAr,idx=0){
  const col=_sc(score),colLt=_scLt(score),h=22;
  fc(doc,...(idx%2===0?T.card:T.bg));rr(doc,x,y,w,h,3,"F");
  dc(doc,...T.borderSoft);lw(doc,0.15);rr(doc,x,y,w,h,3,"S");lw(doc,0.3);
  // Left accent
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  // Score chip
  fc(doc,...colLt);rr(doc,x+6,y+5,16,12,2,"F");
  font(doc,8.5,"bold");tc(doc,...col);
  doc.text(String(Math.round(score)),x+14,y+12.5,{align:"center"});
  // Label
  font(doc,9,"bold",isAr);tc(doc,...T.ink);doc.text(lbl,x+27,y+9.5);
  // Value
  if(value!==undefined&&value!==null){
    font(doc,7.5,"normal");tc(doc,...T.muted);
    doc.text(`${Math.round(value*10)/10}${unit||""}`,x+27,y+16.5);
  }
  // Progress bar
  const bx=x+w*.52,bw=w*.44,bh=5;
  fc(doc,...T.borderSoft);rr(doc,bx,y+8.5,bw,bh,2,"F");
  fc(doc,...col);rr(doc,bx,y+8.5,Math.max(bw*(score/100),3),bh,2,"F");
  // Grade
  const gl=_sl(score,isAr);
  const gw=doc.getTextWidth(gl)+7;
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.1}));
  rr(doc,x+w-gw-3,y+14.5,gw,6,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,F.micro+.5,"bold",isAr);tc(doc,...col);
  doc.text(gl,x+w-gw/2-3,y+18.5,{align:"center"});
}

// ── KPI CHIP v5 — elevated with top accent ─────────────────────────
function _kpi(doc,x,y,w,h,val,label,col,sub=""){
  fc(doc,...T.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...T.border);lw(doc,0.15);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  // Top color accent
  fc(doc,...col);rr(doc,x,y,w,3,2,"F");doc.rect(x,y+1.5,w,1.5,"F");
  // Value
  font(doc,F.dataLg,"bold");tc(doc,...col);
  doc.text(String(val),x+w/2,y+h*.56,{align:"center"});
  // Label
  font(doc,F.small,"bold");tc(doc,...T.muted);
  doc.text(label,x+w/2,y+h*.78,{align:"center"});
  if(sub){font(doc,F.micro,"normal");tc(doc,...T.light);doc.text(sub,x+w/2,y+h*.9,{align:"center"});}
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
    dc(doc,...T.borderSoft);lw(doc,0.12);doc.line(x,gy,x+w,gy);
    font(doc,5,"normal");tc(doc,...T.ghost);doc.text(String(v),x-2,gy+1.5,{align:"right"});
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
  fc(doc,...T.card);doc.circle(co[0].px,co[0].py,2,"F");
  dc(doc,...col);lw(doc,0.8);doc.circle(co[0].px,co[0].py,2,"S");lw(doc,0.3);
  fc(doc,...col);doc.circle(co[co.length-1].px,co[co.length-1].py,2.5,"F");
  font(doc,6.5,"bold");tc(doc,...col);
  doc.text(String(pts[0]),co[0].px,co[0].py-4,{align:"center"});
  doc.text(String(pts[pts.length-1]),co[co.length-1].px,co[co.length-1].py-4,{align:"center"});
}

// ── CALLOUT STRIP ─────────────────────────────────────────────────
function _callout(doc,x,y,w,text,type="info",isAr=false){
  const cols={info:T.primary,success:T.success,warning:T.warning,danger:T.danger};
  const col=cols[type]||T.primary;
  const colBg={info:T.primaryBg,success:T.successBg,warning:T.warningBg,danger:T.dangerBg};
  const lines=doc.splitTextToSize(text.replace(/[#*`]/g,""),w-14);
  const h=Math.max(14,lines.length*5.2+8);
  fc(doc,...(colBg[type]||T.bg));rr(doc,x,y,w,h,3,"F");
  dc(doc,...col);lw(doc,0.2);rr(doc,x,y,w,h,3,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  font(doc,F.body,"normal",isAr);tc(doc,...T.sub);
  lines.forEach((l,i)=>doc.text(l,x+7,y+7+(i*5.2)));
  return y+h+6;
}

// ── STEP CARD v5 ─────────────────────────────────────────────────
function _step(doc,x,y,w,num,title,score,steps,isAr){
  const col=_sc(score),colLt=_scLt(score),h=46;
  fc(doc,...T.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...T.border);lw(doc,0.15);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  // Number circle
  fc(doc,...colLt);doc.circle(x+15,y+14,9,"F");
  dc(doc,...col);lw(doc,.8);doc.circle(x+15,y+14,9,"S");lw(doc,0.3);
  font(doc,10,"bold");tc(doc,...col);doc.text(String(num),x+15,y+17.5,{align:"center"});
  // Title + score
  font(doc,10,"bold",isAr);tc(doc,...T.ink);doc.text(title,x+30,y+12);
  const sb=`${Math.round(score)}/100`;const sw=doc.getTextWidth(sb)+7;
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.1}));
  rr(doc,x+w-sw-4,y+5,sw,8,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,6.5,"bold");tc(doc,...col);doc.text(sb,x+w-sw/2-4,y+10.5,{align:"center"});
  // Steps
  font(doc,7.5,"normal",isAr);tc(doc,...T.sub);
  steps.slice(0,3).forEach((s,i)=>{
    font(doc,7.5,"bold");tc(doc,...col);doc.text(`${i+1}.`,x+30,y+22+(i*7));
    font(doc,7.5,"normal",isAr);tc(doc,...T.sub);
    doc.text(doc.splitTextToSize(s,w-40)[0],x+36,y+22+(i*7));
  });
  return y+h+8;
}

// ── ZONE CARD v5 ─────────────────────────────────────────────────
function _zone(doc,x,y,w,name,region,risk,desc,mlist,isAr){
  const col=_riskColor(risk);
  const lines=doc.splitTextToSize(desc,w-50);
  const h=Math.max(48,lines.length*5+34);
  fc(doc,...T.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...col);lw(doc,0.25);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  // Risk badge
  fc(doc,...col);doc.circle(x+18,y+h/2,11,"F");
  font(doc,9.5,"bold");tc(doc,...T.card);doc.text(`${risk}%`,x+18,y+h/2+3.5,{align:"center"});
  // Title
  font(doc,10,"bold",isAr);tc(doc,...T.ink);doc.text(name,x+35,y+12);
  font(doc,7.5,"bold");tc(doc,...T.primary);doc.text(region,x+35,y+19);
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
  fc(doc,...T.borderSoft);rr(doc,bx,y+23,bw,4.5,2,"F");
  fc(doc,...col);rr(doc,bx,y+23,Math.max(bw*(risk/100),3),4.5,2,"F");
  // Desc
  font(doc,7.5,"normal",isAr);tc(doc,...T.sub);
  lines.forEach((l,i)=>doc.text(l,x+7,y+32+(i*5)));
  font(doc,6,"bold");tc(doc,...T.ghost);
  doc.text(`Sources: ${mlist}`,x+7,y+h-4);
  return y+h+6;
}

// ── INFO TABLE ROW ────────────────────────────────────────────────
function _iRow(doc,x,y,w,key,val,even,isAr){
  fc(doc,...(even?T.bg:T.card));doc.rect(x,y,w,8.5,"F");
  font(doc,F.small,"normal",isAr);tc(doc,...T.muted);doc.text(key,x+5,y+5.8);
  font(doc,F.small,"bold");tc(doc,...T.ink);doc.text(String(val),x+w-5,y+5.8,{align:"right"});
}

// ── _drawSparkline alias ──────────────────────────────────────────
function _drawSparkline(doc,hist,x,y,w,h,col){_spark(doc,hist,x,y,w,h,col);}




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
    .filter(([k])=>!k.startsWith("_")&&metrics[k])
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
    sf(8.5,"bold"); tc(doc,...TEXT); doc.text("CORVUS",ml+16,11.5);
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
    doc.text("Corvus Health Intelligence — Confidential",ml,H-4.5);
    doc.text("1 / 2",W-mr,H-4.5,{align:"right"});

    // ══════════════════════════════════════════════════════════
    // PAGE 2
    // ══════════════════════════════════════════════════════════
    doc.addPage();
    fc(doc,...BG); doc.rect(0,0,W,H,"F");
    fc(doc,...BG2); doc.rect(0,0,W,15,"F");
    _logo(doc,ml,3,9,_logoSm);
    sf(7.5,"bold"); tc(doc,...TEXT); doc.text("CORVUS",ml+13,8);
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
    doc.text("Corvus Health Intelligence — Confidential",ml,H-4.5);
    doc.text("2 / 2",W-mr,H-4.5,{align:"right"});

    await doc.save(`Corvus_Session_${realIdx}_${new Date().toISOString().slice(0,10)}.pdf`, {returnPromise:true});
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // ELITE/PRO — same premium design, full content, no upsell
  // ══════════════════════════════════════════════════════════════
  fc(doc,...BG); doc.rect(0,0,W,H,"F");

  // Header
  fc(doc,...BG2); doc.rect(0,0,W,22,"F");
  _logo(doc,ml,5,12,_logoSm);
  sf(8.5,"bold"); tc(doc,...TEXT); doc.text("CORVUS",ml+16,11.5);
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
  doc.text("Corvus Health Intelligence — Confidential",ml,H-4.5);doc.text("1 / 2",W-mr,H-4.5,{align:"right"});

  // PAGE 2 — full metrics + AI analysis
  doc.addPage(); fc(doc,...BG); doc.rect(0,0,W,H,"F");
  fc(doc,...BG2);doc.rect(0,0,W,15,"F");
  _logo(doc,ml,3,9,_logoSm);sf(7.5,"bold");tc(doc,...TEXT);doc.text("CORVUS",ml+13,8);
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
    sf(7,"bold");tc(doc,...TEXT);doc.text(isAr?"تحليل Corvus AI":"Corvus AI Analysis",ml+5,y+8);
    const aiLines=doc.splitTextToSize(aiText.replace(/[#*`]/g,"").trim(),cw-12);
    sf(7,"normal");tc(doc,...TEXT2);
    aiLines.slice(0,7).forEach((l,i)=>{if(y+16+i*5.5<H-14)doc.text(l,ml+5,y+16+i*5.5);});
  }

  // Footer p1
  fc(doc,...BORDER);doc.setGState&&doc.setGState(new doc.GState({opacity:.4}));
  doc.rect(ml,H-9,cw,.3,"F");doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  sf(5.5,"normal");tc(doc,...TEXT3);
  doc.text("Corvus Health Intelligence — Confidential",ml,H-4.5);
  // Page numbers
  const tot=doc.internal.getNumberOfPages();
  for(let p=1;p<=tot;p++){
    doc.setPage(p);
    sf(5.5,"normal");tc(doc,...TEXT3);doc.text(`${p} / ${tot}`,W-mr,H-4.5,{align:"right"});
  }

  await doc.save(`Corvus_Elite_Session_${realIdx}_${new Date().toISOString().slice(0,10)}.pdf`, {returnPromise:true});
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
    .filter(([k])=>!k.startsWith("_") && metrics[k])
    .map(([k,v])=>{
      const sc  = typeof v==="number" ? v : (v?.score ?? 100);
      const lbl = METRIC_LABELS[k] || v?.label || k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      return { key:k, sc, lbl, value:v?.value, unit:v?.unit||"" };
    })
    .sort((a,b)=>a.sc-b.sc);

  let y=0;

  // ── PAGE 1: Clinical Header + Patient Info ────────────────────
  // Clinical header — formal white + navy
  doc.setFillColor(15,23,42); doc.rect(0,0,W,36,"F");
  doc.setFontSize(14); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text("CORVUS POSTURE HEALTH", ml, 16);
  doc.setFontSize(8.5); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal");
  doc.text("AI-Assisted Workplace Ergonomics & Posture Assessment", ml, 23);
  doc.text("For Clinical Review — Not for Diagnostic Purposes", ml, 29.5);

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
  doc.setFillColor(...gradeC); doc.circle(cx2,cy2,13,"F");
  doc.setFontSize(15); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text(String(avg), cx2, cy2+5.5, {align:"center"});
  doc.setFontSize(7); doc.text("/100", cx2, cy2+10.5, {align:"center"});

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
  doc.text("Corvus Posture Health — Clinical Summary", ml, 8.5);
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
  doc.text("Corvus Posture Health — Clinical Summary", ml, 8.5);
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
  if(y>H-50){doc.addPage();y=22;}
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
    doc.text(`Corvus Posture Health — Clinical Report — ${dateStr} — Confidential`, ml, H-2.5);
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
  const tierCol= tierAtLeast(tier,"elite")?T.success:T.cyan;
  const tierLbl= tier.charAt(0).toUpperCase()+tier.slice(1);

  // ── DATA ──────────────────────────────────────────────────────
  const a1=Math.round(session1.avg_score||0), a2=Math.round(session2.avg_score||0);
  const delta=a2-a1, improved=delta>0, declined=delta<0;
  const deltaCol = delta>0?T.success:delta<0?T.danger:T.muted;
  const deltaBg  = delta>0?T.successBg:delta<0?T.dangerBg:T.bg;
  const g1=_scoreColor(a1), g2=_scoreColor(a2);

  const idx1=allSessions.findIndex(s=>(s.id||s.session_id)===(session1.id||session1.session_id));
  const idx2=allSessions.findIndex(s=>(s.id||s.session_id)===(session2.id||session2.session_id));
  const num1=idx1>=0?allSessions.length-idx1:1;
  const num2=idx2>=0?allSessions.length-idx2:2;

  const m1=session1.metrics||{}, m2=session2.metrics||{};
  const allKeys=[...new Set([...Object.keys(m1),...Object.keys(m2)])].filter(k=>!k.startsWith("_"));
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
  fc(doc,...T.slate); doc.rect(0,0,W,72,"F");
  fc(doc,...deltaCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.06}));
  doc.circle(W*0.85,36,55,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.03}));
  doc.circle(W*0.85,36,78,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  fc(doc,...deltaCol); doc.rect(0,0,W,3,"F");

  // Logo + brand
  _logo(doc,ml,16,26,_logoMd);
  font(doc,13,"bold"); tc(doc,...T.card); doc.text("CORVUS",ml+34,28);
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
  font(doc,7.5,"bold"); tc(doc,...T.card);
  doc.text(`Session #${num1} vs #${num2}`,W-mr,36,{align:"right"});

  fc(doc,...deltaCol); doc.rect(0,69.5,W,2.5,"F");

  // Title
  let y=86;
  font(doc,20,"bold"); tc(doc,...T.ink);
  doc.text(isAr?"تقرير المقارنة":"Session Comparison Report",ml,y); y+=9;
  font(doc,9,"normal"); tc(doc,...T.muted);
  doc.text(`${name} · ${isAr?"مقارنة جلستين":"Head-to-head session analysis"}`,ml,y); y+=16;
  hr(doc,ml,y,cw); y+=14;

  // ── HERO SCORE COMPARISON ─────────────────────────────────────
  const heroH=70, half=(cw-14)/2;

  // Session 1 card
  fc(doc,...T.card); rr(doc,ml,y,half,heroH,6,"F");
  dc(doc,...g1); lw(doc,0.3); rr(doc,ml,y,half,heroH,6,"S"); lw(doc,0.3);
  fc(doc,...g1); doc.rect(ml,y,half,3,"F"); rr(doc,ml,y,half,3,3,"F");
  // Session number chip
  const s1lbl=`Session #${num1}`;
  font(doc,7,"bold"); tc(doc,...T.card);
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
  font(doc,7,"normal"); tc(doc,...T.muted);
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
  font(doc,6.5,"bold"); tc(doc,...T.muted);
  doc.text("VS",mx,y+52,{align:"center"});

  // Session 2 card
  const rx=mx+7;
  fc(doc,...T.card); rr(doc,rx,y,half,heroH,6,"F");
  dc(doc,...g2); lw(doc,0.3); rr(doc,rx,y,half,heroH,6,"S"); lw(doc,0.3);
  fc(doc,...g2); doc.rect(rx,y,half,3,"F"); rr(doc,rx,y,half,3,3,"F");
  const s2lbl=`Session #${num2}`;
  font(doc,7,"bold"); tc(doc,...T.card);
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
  font(doc,7,"normal"); tc(doc,...T.muted);
  doc.text("/100",rx+half/2,y+52,{align:"center"});
  font(doc,8.5,"bold"); tc(doc,...g2);
  doc.text(_scoreLabel(a2,isAr),rx+half/2,y+62,{align:"center"});
  y+=heroH+8;

  // ── QUICK STATS STRIP ─────────────────────────────────────────
  const qStats=[
    [isAr?"التاريخ":"Date",_fmtDate(session1.created_at,isAr),_fmtDate(session2.created_at,isAr),T.primary],
    [isAr?"المدة":"Duration",_fmtDur(d1),_fmtDur(d2),T.indigo],
    [isAr?"وضعية جيدة":"Good posture",`${gp1}%`,`${gp2}%`,T.success],
    [isAr?"التنبيهات":"Alerts",String(al1),String(al2),T.warning],
  ];
  qStats.forEach(([lbl,v1,v2,col],i)=>{
    const qy=y+i*12;
    if(i%2===0){fc(doc,...T.bg); doc.rect(ml,qy,cw,12,"F");}
    font(doc,7.5,"normal",isAr); tc(doc,...T.muted); doc.text(lbl,ml+4,qy+8);
    font(doc,7.5,"bold",false); tc(doc,...col); doc.text(v1,ml+cw*0.45,qy+8,{align:"right"});
    font(doc,7.5,"bold",false); tc(doc,...T.muted); doc.text("→",ml+cw*0.5,qy+8,{align:"center"});
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
  font(doc,8.5,"bold"); tc(doc,...deltaCol);
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
  fc(doc,...T.slate); rr(doc,ml,y,cw,10,2,"F");
  font(doc,7.5,"bold"); tc(doc,...T.card);
  [isAr?"المقياس":"Metric",`#${num1}`,`#${num2}`,isAr?"Δ":"Δ",isAr?"الاتجاه":"Trend"]
    .forEach((h,i)=>doc.text(h,colX[i],y+7));
  y+=12;

  metRows.forEach(({lbl,sc1,sc2,d},idx)=>{
    if(y>H-28){doc.addPage();_hdr(doc,W,ml,mr,isAr?"تابع":"Continued",isAr);y=22;}
    const dC=d>2?T.success:d<-2?T.danger:T.muted;
    const rowH=11;
    fc(doc,...(idx%2===0?T.bg:T.card)); doc.rect(ml,y,cw,rowH,"F");
    // Left accent for significant changes
    if(Math.abs(d)>5){ fc(doc,...dC); doc.rect(ml,y,2,rowH,"F"); }
    font(doc,8,"normal",isAr); tc(doc,...T.ink); doc.text(lbl,colX[0]+2,y+7.5);
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
    isAr?"المخاطرة % — منخفض/متوسط/عالي":"Risk % — low/moderate/high",T.danger,isAr);
  y+=16;

  const zones=[
    {k:"cervical",en:"Cervical (Neck)",  ar:"عنق الرحم — الرقبة",  r:"C1–C7"},
    {k:"thoracic",en:"Thoracic (Upper)", ar:"الصدر — الظهر العلوي", r:"T1–T12"},
    {k:"lumbar",  en:"Lumbar (Lower)",   ar:"القطن — الظهر السفلي", r:"L1–S1"},
  ];
  zones.forEach(({k,en,ar,r})=>{
    if(y>H-44){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
    const r1=z1[k]||0, r2=z2[k]||0, dz=r2-r1;
    const rc1=_riskColor(r1), rc2=_riskColor(r2), dzC=dz>0?T.danger:T.success;
    const zh=36;
    fc(doc,...T.card); rr(doc,ml,y,cw,zh,4,"F");
    dc(doc,...rc2); lw(doc,0.25); rr(doc,ml,y,cw,zh,4,"S"); lw(doc,0.3);
    fc(doc,...rc2); doc.rect(ml,y,3,zh,"F"); rr(doc,ml,y,3,zh,1.5,"F");
    // Zone label
    font(doc,9.5,"bold",isAr); tc(doc,...T.ink); doc.text(isAr?ar:en,ml+9,y+10);
    font(doc,7,"bold"); tc(doc,...T.primary); doc.text(r,ml+9,y+17);
    // Two risk bars side by side
    const bw2=(cw-24)/2, barY=y+22;
    // Session 1 bar
    fc(doc,...T.borderSoft); rr(doc,ml+9,barY,bw2,5,2,"F");
    fc(doc,...rc1); rr(doc,ml+9,barY,Math.max(bw2*(r1/100),3),5,2,"F");
    font(doc,6.5,"bold"); tc(doc,...rc1);
    doc.text(`#${num1}: ${r1}%`,ml+9,barY+10);
    // Session 2 bar
    fc(doc,...T.borderSoft); rr(doc,ml+9+bw2+4,barY,bw2,5,2,"F");
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
    _sh(doc,ml,y,isAr?"مقاييس تراجعت — تحتاج اهتماماً":"Regressed Metrics — Needs Attention","",T.danger,isAr);
    y+=14;
    regressed.forEach(({lbl,sc1,sc2,d})=>{
      if(y>H-20){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
      fc(doc,...T.dangerBg); rr(doc,ml,y,cw,14,3,"F");
      dc(doc,...T.danger); lw(doc,0.2); rr(doc,ml,y,cw,14,3,"S"); lw(doc,0.3);
      fc(doc,...T.danger); doc.rect(ml,y,3,14,"F"); rr(doc,ml,y,3,14,1.5,"F");
      font(doc,8.5,"bold",isAr); tc(doc,...T.danger); doc.text(lbl,ml+7,y+5.5);
      font(doc,7.5,"normal",false); tc(doc,...T.sub);
      doc.text(`${Math.round(sc1)} → ${Math.round(sc2)} (${d} pts)`,ml+7,y+11);
      const bw2=cw*0.3;
      fc(doc,...T.danger);
      doc.setGState&&doc.setGState(new doc.GState({opacity:0.2}));
      rr(doc,W-mr-bw2-2,y+3,bw2*(Math.abs(d)/30),8,2,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      y+=18;
    });
    y+=6;
  }

  if(improved2.length>0){
    if(y>H-60){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
    _sh(doc,ml,y,isAr?"مقاييس تحسّنت — استمر":"Improved Metrics — Keep Going","",T.success,isAr);
    y+=14;
    improved2.forEach(({lbl,sc1,sc2,d})=>{
      if(y>H-20){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;}
      fc(doc,...T.successBg); rr(doc,ml,y,cw,14,3,"F");
      dc(doc,...T.success); lw(doc,0.2); rr(doc,ml,y,cw,14,3,"S"); lw(doc,0.3);
      fc(doc,...T.success); doc.rect(ml,y,3,14,"F"); rr(doc,ml,y,3,14,1.5,"F");
      font(doc,8.5,"bold",isAr); tc(doc,...T.success); doc.text(lbl,ml+7,y+5.5);
      font(doc,7.5,"normal",false); tc(doc,...T.sub);
      doc.text(`${Math.round(sc1)} → ${Math.round(sc2)} (+${d} pts)`,ml+7,y+11);
      y+=18;
    });
    y+=6;
  }

  // Action plan
  if(y>H-100){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خطة الإجراءات":"Action Plan",isAr);y=22;}
  _sh(doc,ml,y,isAr?"خطة الإجراءات المقترحة":"Recommended Action Plan",
    isAr?"بناءً على أبرز التغيرات بين الجلستين":"Based on most significant changes between sessions",T.primary,isAr);
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
    fc(doc,...T.card); rr(doc,ml,y,cw,ph,4,"F");
    dc(doc,...T.border); lw(doc,0.18); rr(doc,ml,y,cw,ph,4,"S"); lw(doc,0.3);
    fc(doc,...col); doc.rect(ml,y,3,ph,"F"); rr(doc,ml,y,3,ph,1.5,"F");
    // Number circle
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.15}));
    doc.circle(ml+16,y+14,9,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    dc(doc,...col); lw(doc,1); doc.circle(ml+16,y+14,9,"S"); lw(doc,0.3);
    font(doc,10,"bold"); tc(doc,...col); doc.text(String(idx+1),ml+16,y+17.5,{align:"center"});
    // Title
    font(doc,10,"bold",isAr); tc(doc,...T.ink); doc.text(lbl,ml+30,y+12);
    font(doc,7.5,"normal",isAr); tc(doc,...T.sub);
    steps.slice(0,3).forEach((s,i)=>{
      font(doc,7.5,"bold"); tc(doc,...col);
      doc.text(`${i+1}.`,ml+30,y+22+(i*7));
      font(doc,7.5,"normal",isAr); tc(doc,...T.sub);
      doc.text(doc.splitTextToSize(s,cw-38)[0],ml+36,y+22+(i*7));
    });
    y+=ph+8;
  });

  // ── SESSION SUMMARY TABLE ─────────────────────────────────────
  y+=4; if(y>H-65){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الملخص":"Summary",isAr);y=22;}
  _sh(doc,ml,y,isAr?"ملخص الجلستين":"Session Summary","",T.indigo,isAr);
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
  fc(doc,...T.card); rr(doc,ml,y,cw,th3,4,"F");
  dc(doc,...T.border); lw(doc,0.18); rr(doc,ml,y,cw,th3,4,"S"); lw(doc,0.3);
  // Header row
  fc(doc,...T.slate); doc.rect(ml,y,cw,9,"F"); rr(doc,ml,y,cw,9,2,"F"); doc.rect(ml,y+5,cw,4,"F");
  font(doc,7.5,"bold"); tc(doc,...T.card);
  doc.text(isAr?"البند":"Item",ml+5,y+6.5);
  doc.text(`Session #${num1}`,ml+cw*0.42,y+6.5,{align:"center"});
  doc.text(`Session #${num2}`,ml+cw*0.75,y+6.5,{align:"center"});
  y+=9;
  sumRows.forEach(([k,v1,v2],i)=>{
    if(i%2===0){fc(doc,...T.bg); doc.rect(ml,y,cw,9,"F");}
    font(doc,7.5,"normal",isAr); tc(doc,...T.muted); doc.text(k,ml+5,y+6.5);
    font(doc,7.5,"bold",false);
    tc(doc,...(i===6?deltaCol:T.ink)); doc.text(v1,ml+cw*0.42,y+6.5,{align:"center"});
    tc(doc,...(i===6?deltaCol:T.ink)); doc.text(v2,ml+cw*0.75,y+6.5,{align:"center"});
    y+=9;
  });

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
  fc(doc,...T.ink); doc.rect(0,0,W,64,"F");
  fc(doc,...T.primary); doc.rect(0,62,W,2,"F");
  _logo(doc,ml,14,22,_logoMd);
  sf(9,"normal"); tc(doc,...T.muted);
  doc.text(isAr?"تقرير صحة الوضعية للفريق":"Team Posture Health Report", ml+30,22);
  sf(7,"normal"); doc.text(`${company||profile?.company||"Organisation"} · ${nowStr}`,ml+30,29);
  sf(7,"normal"); doc.text(rangeLabel,ml+30,35);
  let y=78;

  sf(18,"bold"); tc(doc,...T.ink);
  doc.text(isAr?`تقرير الفريق — ${company||"المؤسسة"}`:`Team Report — ${company||"Organisation"}`,ml,y); y+=8;
  sf(8.5,"normal"); tc(doc,...T.muted);
  doc.text(isAr?`${totalU} موظف · ${rangeLabel}`:`${totalU} employees · ${rangeLabel}`,ml,y); y+=14;

  // KPI row
  const kpis = [
    [String(teamAvg), isAr?"متوسط الفريق":"Team Avg", gradeC],
    [String(totalU),  isAr?"إجمالي المستخدمين":"Active Users", T.primary],
    [String(atRisk.length),  isAr?"في خطر":"At Risk", atRisk.length>0?T.danger:T.success],
    [String(excellent.length), isAr?"ممتاز":"Excellent", T.success],
  ];
  kpis.forEach(([v,l,col],i)=>{
    const kx=ml+i*(cw/4);
    fc(doc,...T.bg); rr(doc,kx,y,cw/4-4,28,3,"F");
    sf(16,"bold"); tc(doc,...col);
    doc.text(v, kx+(cw/4-4)/2, y+17,{align:"center"});
    sf(7,"normal"); tc(doc,...T.muted);
    doc.text(l, kx+(cw/4-4)/2, y+24.5,{align:"center"});
  });
  y+=36;

  // Score distribution bar
  sf(10,"bold"); tc(doc,...T.ink);
  doc.text(isAr?"توزيع النقاط":"Score Distribution",ml,y); y+=6;
  const bands=[
    {label:isAr?"ممتاز (80+)":"Excellent (80+)", col:T.success, users:activeUsers.filter(u=>(u.avg_score||0)>=80)},
    {label:isAr?"جيد (65-79)":"Good (65-79)",    col:T.primary, users:activeUsers.filter(u=>(u.avg_score||0)>=65&&(u.avg_score||0)<80)},
    {label:isAr?"متوسط (55-64)":"Fair (55-64)",  col:T.warning, users:activeUsers.filter(u=>(u.avg_score||0)>=55&&(u.avg_score||0)<65)},
    {label:isAr?"ضعيف (<55)":"Poor (<55)",       col:T.danger,  users:atRisk},
  ];
  for(const {label,col,users:bu} of bands){
    if(y>H-30){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"التوزيع":"Distribution"); y=22;}
    const pct=totalU>0?bu.length/totalU:0;
    fc(doc,...T.bg); doc.rect(ml,y,cw,8,"F");
    sf(7.5,"normal"); tc(doc,...T.ink); doc.text(label,ml+2,y+5.5);
    fc(doc,...col); doc.rect(ml+70,y+2,Math.max((cw-74)*pct,0),4,"F");
    sf(7.5,"bold"); tc(doc,...col);
    doc.text(`${bu.length} (${Math.round(pct*100)}%)`,W-mr-2,y+5.5,{align:"right"});
    y+=9;
  }
  y+=8;

  // At-Risk Users list
  if(atRisk.length>0){
    if(y>H-60){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"الموظفون في خطر":"At-Risk Employees"); y=22;}
    sf(10,"bold"); tc(doc,...T.danger);
    doc.text(isAr?`الموظفون في خطر (${atRisk.length})`:`At-Risk Employees (${atRisk.length})`,ml,y); y+=5;
    sf(7.5,"normal"); tc(doc,...T.muted);
    doc.text(isAr?"متوسط الوضعية أقل من 55 — يُنصح بتدخل عاجل":"Posture avg below 55 — immediate ergonomic review recommended",ml,y); y+=7;

    // Table
    fc(doc,...T.ink); rr(doc,ml,y,cw,9,1,"F");
    sf(7,"bold"); tc(doc,255,255,255);
    doc.text(isAr?"الاسم":"Name",ml+3,y+6);
    doc.text(isAr?"النتيجة":"Score",ml+cw*0.55,y+6);
    doc.text(isAr?"آخر جلسة":"Last Session",ml+cw*0.72,y+6);
    y+=11;
    for(const u of atRisk.slice(0,15)){
      if(y>H-18){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"الموظفون في خطر":"At-Risk"); y=22;}
      fc(doc,...T.bg); doc.rect(ml,y,cw,8,"F");
      sf(8,"normal"); tc(doc,...T.ink);
      doc.text(u.name||u.email||"—",ml+3,y+5.5);
      sf(8,"bold"); tc(doc,...T.danger);
      doc.text(String(Math.round(u.avg_score||0)),ml+cw*0.55,y+5.5);
      sf(7.5,"normal"); tc(doc,...T.muted);
      doc.text(u.last_session?_fmtDate(u.last_session,isAr):"—",ml+cw*0.72,y+5.5);
      y+=8;
    }
    if(atRisk.length>15){
      sf(7.5,"normal"); tc(doc,...T.muted);
      doc.text(`+ ${atRisk.length-15} ${isAr?"آخرين":"more"}`,ml,y+5); y+=10;
    }
  }

  // League table — top 10
  y+=6;
  if(y>H-70){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"تصنيف الفريق":"Team Leaderboard"); y=22;}
  sf(10,"bold"); tc(doc,...T.ink);
  doc.text(isAr?"تصنيف الأداء":"Performance Leaderboard",ml,y); y+=7;
  const sorted=[...activeUsers].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0));
  fc(doc,...T.ink); rr(doc,ml,y,cw,9,1,"F");
  sf(7,"bold"); tc(doc,255,255,255);
  doc.text("#",ml+3,y+6); doc.text(isAr?"الاسم":"Name",ml+14,y+6);
  doc.text(isAr?"النتيجة":"Score",ml+cw*0.65,y+6); doc.text(isAr?"التقييم":"Grade",ml+cw*0.82,y+6);
  y+=11;
  for(const [i,u] of sorted.slice(0,10).entries()){
    if(y>H-18){doc.addPage(); y=22;}
    fc(doc,i%2===0?248:255,i%2===0?250:255,i%2===0?252:255); doc.rect(ml,y,cw,8,"F");
    const sc=Math.round(u.avg_score||0); const col=_scoreColor(sc);
    sf(8,"bold"); tc(doc,...(i<3?col:T.muted)); doc.text(String(i+1),ml+3,y+5.5);
    sf(8,"normal"); tc(doc,...T.ink); doc.text(u.name||u.email||"—",ml+14,y+5.5);
    sf(8,"bold"); tc(doc,...col); doc.text(String(sc),ml+cw*0.65,y+5.5);
    sf(7.5,"normal"); doc.text(_scoreLabel(sc,isAr),ml+cw*0.82,y+5.5);
    y+=8;
  }

  // HR Recommendations
  y+=10;
  if(y>H-60){doc.addPage(); await _hdr(doc,W,ml,mr,isAr?"توصيات":"HR Recommendations"); y=22;}
  sf(10,"bold"); tc(doc,...T.ink);
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
    fc(doc,...T.bg); rr(doc,ml,y,cw,16,2,"F");
    sf(8,"normal"); tc(doc,...T.ink);
    const lines=doc.splitTextToSize(rec,cw-8);
    lines.slice(0,2).forEach((l,i)=>doc.text(l,ml+4,y+7+(i*5.5)));
    y+=20;
  }

  // Footer + page numbers
  const tp=doc.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++){
    doc.setPage(p);
    fc(doc,...T.ink); doc.rect(0,H-8,W,8,"F");
    font(doc,6.5,"normal"); tc(doc,100,116,139);
    doc.text(`Corvus — ${isAr?"تقرير الفريق — سري":"Team Report — Confidential"} · ${nowStr}`,ml,H-2.5);
    doc.text(`${p} / ${tp}`,W-mr,H-2.5,{align:"right"});
  }

  const filename=`Corvus_Team_Report_${(company||"Team").replace(/\s/g,"_")}_${new Date().toISOString().slice(0,10)}.pdf`;
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
  const trendCol   = improved?T.success:declined?T.danger:T.muted;
  const trendBg    = improved?T.successBg:declined?T.dangerBg:T.bg;

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
  fc(doc,...T.slate); doc.rect(0,0,W,80,"F");
  // Subtle accent circles
  fc(doc,...T.indigo);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.06}));
  doc.circle(W*0.85,40,60,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.03}));
  doc.circle(W*0.85,40,85,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));

  // Trend color top strip
  fc(doc,...trendCol); doc.rect(0,0,W,3,"F");

  // Logo + brand
  _logo(doc,ml,18,26,_logoMd);
  font(doc,13,"bold"); tc(doc,...T.card);
  doc.text("CORVUS",ml+34,30);
  font(doc,7,"normal"); tc(doc,148,163,184);
  doc.text("Health Intelligence Platform",ml+34,38);

  // ELITE badge
  const elbadge="* ELITE";
  const elw=doc.getTextWidth(elbadge)+12;
  fc(doc,...T.success);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.18}));
  rr(doc,ml+34,43,elw,10,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,7.5,"bold"); tc(doc,...T.success);
  doc.text(elbadge,ml+34+elw/2,50,{align:"center"});

  // Date + session count right
  font(doc,7,"normal"); tc(doc,148,163,184);
  doc.text(nowStr,W-mr,27,{align:"right"});
  font(doc,7.5,"bold"); tc(doc,...T.card);
  doc.text(`${sessions.length} ${isAr?"جلسة":"sessions"} · ${weeksSpan} ${isAr?"أسبوع":"weeks"}`,W-mr,37,{align:"right"});

  // Bottom accent
  fc(doc,...trendCol); doc.rect(0,77.5,W,2.5,"F");

  // Report title block
  let y=96;
  font(doc,22,"bold"); tc(doc,...T.ink);
  doc.text(isAr?"التقرير الطولي":"Longitudinal Health Report",ml,y); y+=10;
  font(doc,10,"normal"); tc(doc,...T.muted);
  doc.text(`${name} · ${isAr?"تحليل متعدد الجلسات":"Multi-session posture analysis"}`,ml,y); y+=16;

  // Thin divider
  hr(doc,ml,y,cw); y+=14;

  // ── KPI GRID (2×3) ─────────────────────────────────────────
  const kpis=[
    [isAr?`${avgAll}`:`${avgAll}`,    isAr?"متوسط الكل":"All-time avg",  _scoreColor(avgAll)],
    [isAr?`${avg90}`:`${avg90}`,      isAr?"آخر 90 يوم":"90-day avg",    _scoreColor(avg90)],
    [`${trendDelta>0?"+":""}${trendDelta}`, isAr?`تغيّر (${avgFirst} - ${avgLast})`:`Trend (${avgFirst} - ${avgLast})`,   trendCol],
    [String(sessions.length),          isAr?"الجلسات":"Sessions",         T.indigo],
    [freqPerWeek,                       isAr?"جلسة/أسبوع":"Per week",     T.cyan],
    [`${avgDurMin}m`,                   isAr?"متوسط المدة":"Avg duration", T.primary],
  ];
  const kw=(cw-10)/3, kh=32;
  kpis.forEach(([v,l,col],i)=>{
    const kx=ml+(i%3)*(kw+5), ky=y+Math.floor(i/3)*(kh+6);
    fc(doc,...T.card); rr(doc,kx,ky,kw,kh,4,"F");
    dc(doc,...T.border); lw(doc,0.18); rr(doc,kx,ky,kw,kh,4,"S"); lw(doc,0.3);
    // Top accent
    fc(doc,...col); rr(doc,kx,ky,kw,3,2,"F"); doc.rect(kx,ky+1.5,kw,1.5,"F");
    // Value
    font(doc,16,"bold"); tc(doc,...col);
    doc.text(v,kx+kw/2,ky+kh*0.58,{align:"center"});
    // Label
    font(doc,7,"bold"); tc(doc,...T.muted);
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
  font(doc,8.5,"bold"); tc(doc,...trendCol);
  doc.text(`${trendIcon}  ${trendText}`,ml+8,y+9.2);
  y+=22;

  // ── SCORE TRAJECTORY ────────────────────────────────────────
  _sh(doc,ml,y,isAr?"مسار النقاط":"Score Trajectory",isAr?"كل الجلسات بالترتيب الزمني":"All sessions in chronological order",_scoreColor(avgAll),isAr);
  y+=14;
  const th=42;
  fc(doc,...T.bg); rr(doc,ml,y,cw,th,4,"F");
  dc(doc,...T.border); lw(doc,0.18); rr(doc,ml,y,cw,th,4,"S"); lw(doc,0.3);

  const spts=allScores.map((sc,i)=>({
    px:ml+6+(i/Math.max(allScores.length-1,1))*(cw-12),
    py:y+th-6-((Math.max(sc,30)-30)/70)*(th-12),
  }));

  // Reference lines
  [50,65,80].forEach(v=>{
    const gy=y+th-6-((v-30)/70)*(th-12);
    dc(doc,...T.border); lw(doc,0.12); doc.line(ml+3,gy,ml+cw-3,gy);
    font(doc,5,"normal"); tc(doc,...T.light);
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
    const rC=slope<0?T.success:T.danger;
    dc(doc,...rC); lw(doc,0.5); doc.setLineDashPattern([2,2],0);
    doc.line(spts[0].px,b2,spts[n2-1].px,b2+slope*(n2-1));
    doc.setLineDashPattern([],0); lw(doc,0.3);

    // Session line + dots
    const lC=_scoreColor(avgLast);
    dc(doc,...lC); lw(doc,1.5);
    spts.forEach((p,i)=>{ if(i>0) doc.line(spts[i-1].px,spts[i-1].py,p.px,p.py); });
    lw(doc,0.3);
    // First & last highlighted
    fc(doc,...T.card); doc.circle(spts[0].px,spts[0].py,2.2,"F");
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
  _sh(doc,ml,y,isAr?"النمط الأسبوعي":"Weekly Pattern",isAr?"متوسط النقاط حسب اليوم":"Average score by day of week",T.primary,isAr);
  y+=16;

  const barZoneH=52;
  fc(doc,...T.bg); rr(doc,ml,y,cw,barZoneH,4,"F");
  dc(doc,...T.border); lw(doc,0.18); rr(doc,ml,y,cw,barZoneH,4,"S"); lw(doc,0.3);

  const maxDayV=Math.max(...(validDA.length?validDA:[80]),80);
  const barW2=(cw-24)/7, barMaxH=barZoneH-18;
  dayAvgs.forEach((avg,di)=>{
    const bx=ml+12+di*(barW2+2);
    if(!avg){
      // No data — ghost bar
      fc(doc,...T.border); rr(doc,bx,y+barZoneH-12-4,barW2,4,1,"F");
      font(doc,5.5,"normal"); tc(doc,...T.light);
      doc.text("—",bx+barW2/2,y+barZoneH-5.5,{align:"center"});
      doc.text(isAr?dayNamesAr[di]:dayNamesEn[di],bx+barW2/2,y+barZoneH-1.5,{align:"center"});
      return;
    }
    const bh=Math.max(((avg-30)/70)*barMaxH,3);
    const bc=di===bestDay?T.success:di===worstDay?T.danger:T.primary;
    // Bar
    fc(doc,...bc);
    doc.setGState&&doc.setGState(new doc.GState({opacity:di===bestDay||di===worstDay?1:0.7}));
    rr(doc,bx,y+barZoneH-12-bh,barW2,bh,1.5,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    // Score label above bar
    font(doc,6.5,"bold"); tc(doc,...bc);
    doc.text(String(avg),bx+barW2/2,y+barZoneH-12-bh-2,{align:"center"});
    // Day label
    font(doc,6,"bold"); tc(doc,...(di===bestDay?T.success:di===worstDay?T.danger:T.muted));
    doc.text(isAr?dayNamesAr[di]:dayNamesEn[di],bx+barW2/2,y+barZoneH-1.5,{align:"center"});
  });
  y+=barZoneH+8;

  // Best/worst day insight strip
  if(bestDay>=0&&worstDay>=0){
    const bdn=isAr?dayNamesAr[bestDay]:dayNamesEn[bestDay];
    const wdn=isAr?dayNamesAr[worstDay]:dayNamesEn[worstDay];
    fc(doc,...T.bg); rr(doc,ml,y,cw,11,2,"F");
    font(doc,7.5,"normal"); tc(doc,...T.sub);
    const ins=isAr
      ?`أفضل يوم: ${bdn} (${dayAvgs[bestDay]}) · أسوأ يوم: ${wdn} (${dayAvgs[worstDay]})`
      :`Best day: ${bdn} (${dayAvgs[bestDay]}) · Worst day: ${wdn} (${dayAvgs[worstDay]})`;
    doc.text(ins,ml+cw/2,y+7.5,{align:"center"});
    y+=18;
  }

  // ── SPINAL ZONE RISK ──────────────────────────────────────────
  y+=4;
  _sh(doc,ml,y,isAr?"خريطة مناطق الخطر":"Spinal Zone Risk Map",isAr?"متوسط من كل الجلسات":"Averaged across all sessions",T.danger,isAr);
  y+=16;

  const zones=[
    {k:"cervical",en:"Cervical (Neck)",   ar:"عنق الرحم — الرقبة",   r:"C1–C7",  desc:isAr?"انحناء الرقبة والرأس للأمام":"Neck lean, FHP, head tilt and rotation"},
    {k:"thoracic",en:"Thoracic (Upper)",  ar:"الصدر — الظهر العلوي",  r:"T1–T12", desc:isAr?"تماثل الكتفين والوضعية العلوية":"Shoulder symmetry and upper spinal curvature"},
    {k:"lumbar",  en:"Lumbar (Lower)",    ar:"القطن — الظهر السفلي",  r:"L1–S1",  desc:isAr?"محاذاة العمود الفقري وزاوية الورك":"Spinal alignment and hip angle"},
  ];
  zones.forEach(({k,en,ar,r,desc})=>{
    if(y>H-42){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خريطة المخاطر":"Risk Map",isAr);y=22;}
    const risk=avgZonal[k]||0, rc=_riskColor(risk);
    const zh=34;
    fc(doc,...T.card); rr(doc,ml,y,cw,zh,4,"F");
    dc(doc,...rc); lw(doc,0.25); rr(doc,ml,y,cw,zh,4,"S"); lw(doc,0.3);
    fc(doc,...rc); doc.rect(ml,y,3,zh,"F"); rr(doc,ml,y,3,zh,1.5,"F");
    // Risk circle
    fc(doc,...rc); doc.circle(ml+18,y+zh/2,10,"F");
    font(doc,9.5,"bold"); tc(doc,...T.card);
    doc.text(`${risk}%`,ml+18,y+zh/2+3.5,{align:"center"});
    // Title + region
    font(doc,10,"bold",isAr); tc(doc,...T.ink);
    doc.text(isAr?ar:en,ml+33,y+10);
    font(doc,7,"bold"); tc(doc,...T.primary); doc.text(r,ml+33,y+17);
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
    fc(doc,...T.borderSoft); rr(doc,bx,y+21,bw2,5,2,"F");
    fc(doc,...rc); rr(doc,bx,y+21,Math.max(bw2*(risk/100),3),5,2,"F");
    // Desc
    font(doc,7,"normal",isAr); tc(doc,...T.muted);
    doc.text(desc,ml+33,y+zh-4);
    y+=zh+7;
  });

  // ── BEST / WORST SESSION CARDS ─────────────────────────────
  y+=6;
  if(y>H-80){doc.addPage();_hdr(doc,W,ml,mr,isAr?"أفضل وأسوأ":"Best & Worst",isAr);y=22;}
  _sh(doc,ml,y,isAr?"أفضل وأسوأ جلسة":"Best & Worst Sessions","",T.success,isAr);
  y+=14;

  [[isAr?"* الجلسة الأفضل":"* Best Session",best,T.success],
   [isAr?"! الجلسة الأسوأ":"! Worst Session",worst,T.danger]
  ].forEach(([label,sess,col])=>{
    if(!sess||y>H-36){if(y>H-36){doc.addPage();_hdr(doc,W,ml,mr,"",isAr);y=22;} else return;}
    const sh2=28;
    fc(doc,...T.card); rr(doc,ml,y,cw,sh2,4,"F");
    dc(doc,...col); lw(doc,0.25); rr(doc,ml,y,cw,sh2,4,"S"); lw(doc,0.3);
    fc(doc,...col); doc.rect(ml,y,3,sh2,"F"); rr(doc,ml,y,3,sh2,1.5,"F");
    // Score badge
    fc(doc,...col); rr(doc,ml+7,y+5,18,18,3,"F");
    font(doc,11,"bold"); tc(doc,...T.card);
    doc.text(String(Math.round(sess.avg_score||0)),ml+16,y+16,{align:"center"});
    // Label
    font(doc,9.5,"bold",isAr); tc(doc,...T.ink); doc.text(label,ml+30,y+11);
    font(doc,7.5,"normal"); tc(doc,...T.muted);
    doc.text(_fmtDate(sess.created_at,isAr),ml+30,y+19);
    // Right stats
    font(doc,7.5,"bold"); tc(doc,...col);
    doc.text(`${isAr?"المدة":"Duration"}: ${_fmtDur(sess.duration_s||sess.duration_sec||0)}`,W-mr-2,y+11,{align:"right"});
    font(doc,7,"normal"); tc(doc,...T.muted);
    doc.text(`${isAr?"تنبيهات":"Alerts"}: ${sess.alerts_count||0}`,W-mr-2,y+19,{align:"right"});
    y+=sh2+8;
  });

  // ══════════════════════════════════════════════════════════════
  // PAGE 3 — AI NARRATIVE + 8-WEEK PROGRAMME
  // ══════════════════════════════════════════════════════════════
  doc.addPage(); _hdr(doc,W,ml,mr,isAr?"التحليل والخطة":"Analysis & Plan",isAr); y=22;

  // AI narrative
  _sh(doc,ml,y,isAr?"تحليل Corvus AI":"Corvus AI Analysis",isAr?"مولّد من بيانات جلساتك":"Generated from your session data",T.primary,isAr);
  y+=16;

  const highestRiskAll = Math.max(avgZonal.cervical, avgZonal.thoracic, avgZonal.lumbar);
const highestRiskName = avgZonal.cervical >= avgZonal.thoracic && avgZonal.cervical >= avgZonal.lumbar
  ? (isAr ? "Cervical (neck)" : "Cervical (neck)")
  : avgZonal.thoracic >= avgZonal.lumbar
    ? (isAr ? "Thoracic (upper back)" : "Thoracic (upper back)")
    : (isAr ? "Lumbar (lower back)" : "Lumbar (lower back)");

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
    ? `مناطق العمود الفقري: Cervical ${avgZonal.cervical}%, Thoracic ${avgZonal.thoracic}%, Lumbar ${avgZonal.lumbar}%. المنطقة الأعلى خطراً: ${highestRiskName}. ${highestRiskAll > 50 ? "يتطلب هذا مستوى الخطر تدخلاً مستهدفاً فورياً." : "المستويات الحالية قابلة للتحسين من خلال تمارين مستهدفة."}`
    : `Spinal zones: Cervical ${avgZonal.cervical}%, Thoracic ${avgZonal.thoracic}%, Lumbar ${avgZonal.lumbar}%. Primary risk: ${highestRiskName}. ${highestRiskAll > 50 ? "This risk level requires immediate targeted intervention." : "Current levels are improvable through targeted exercises."}`),
  (isAr
    ? `معدل التكرار: ${freqPerWeek} جلسة/أسبوع، متوسط المدة: ${avgDurMin} دقيقة. ${parseFloat(freqPerWeek) < 3 ? "زيادة التكرار إلى 3-4 جلسات أسبوعياً ستسرّع التحسين بشكل كبير." : " CONSISTENCY جيدة — حافظ على هذا التكرار لتعزيز المكاسب."} إجمالي التنبيهات: ${totalAlerts} عبر ${sessions.length} جلسة.`
    : `Session frequency: ${freqPerWeek}/week, average duration: ${avgDurMin} minutes. ${parseFloat(freqPerWeek) < 3 ? "Increasing to 3-4 sessions per week would significantly accelerate improvement." : "Good consistency — maintain this frequency to consolidate gains."} Total alerts: ${totalAlerts} across ${sessions.length} sessions.`),
].join("\n\n");

  const narLines=doc.splitTextToSize(narrative.replace(/[#*`]/g,"").trim(),cw-8);
  fc(doc,...T.bg); rr(doc,ml,y,cw,narLines.length*5.4+12,4,"F");
  y+=8;
  font(doc,8.5,"normal",isAr); tc(doc,...T.sub);
  narLines.forEach(l=>{ if(y>H-32){doc.addPage();_hdr(doc,W,ml,mr,"Analysis",isAr);y=22;} doc.text(l,ml+4,y); y+=5.4; });
  y+=14;

  // 8-week programme
  if(y>H-100){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الخطة":"Programme",isAr);y=22;}
  _sh(doc,ml,y,isAr?"برنامج التحسين — 8 أسابيع":"8-Week Improvement Programme",isAr?"خطة مخصصة لنتائجك":"Personalised to your results",T.success,isAr);
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
    fc(doc,...T.card); rr(doc,ml,y,cw,ph,4,"F");
    dc(doc,...T.border); lw(doc,0.18); rr(doc,ml,y,cw,ph,4,"S"); lw(doc,0.3);
    // Week badge
    fc(doc,...T.primary);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
    rr(doc,ml+4,y+5,22,18,3,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    dc(doc,...T.primary); lw(doc,0.8); rr(doc,ml+4,y+5,22,18,3,"S"); lw(doc,0.3);
    font(doc,6.5,"bold"); tc(doc,...T.primary);
    doc.text("W",ml+15,y+11.5,{align:"center"});
    doc.text(wk,ml+15,y+17,{align:"center"});
    // Goal + action
    font(doc,9.5,"bold",isAr); tc(doc,...T.ink); doc.text(goal,ml+32,y+11);
    font(doc,7.5,"normal",isAr); tc(doc,...T.sub);
    const aLines=doc.splitTextToSize(action,cw-36);
    aLines.slice(0,2).forEach((l,i)=>doc.text(l,ml+32,y+18+(i*5)));
    y+=ph+7;
  });

  // ── SESSION STATS TABLE ───────────────────────────────────
  y+=4; if(y>H-70){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الإحصائيات":"Statistics",isAr);y=22;}
  _sh(doc,ml,y,isAr?"ملخص الإحصائيات":"Summary Statistics","",T.indigo,isAr);
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
  fc(doc,...T.card); rr(doc,ml,y,cw,th2,4,"F");
  dc(doc,...T.border); lw(doc,0.18); rr(doc,ml,y,cw,th2,4,"S"); lw(doc,0.3);
  stats.forEach(([k,v],i)=>{
    if(i%2===0){fc(doc,...T.bg); doc.rect(ml,y,cw,8.5,"F");}
    font(doc,7.5,"normal",isAr); tc(doc,...T.muted); doc.text(k,ml+5,y+5.8);
    font(doc,7.5,"bold",false); tc(doc,...T.ink); doc.text(v,ml+cw-5,y+5.8,{align:"right"});
    y+=8.5;
  });

  // ── FOOTERS ───────────────────────────────────────────────
  const tp=doc.internal.getNumberOfPages();
  for(let p=1;p<=tp;p++){
    doc.setPage(p);
    _ftr(doc,W,ml,mr,H,p,tp,name);
  }

  const filename=`Corvus_Longitudinal_${now.toISOString().slice(0,10)}.pdf`;
  await doc.save(filename, {returnPromise:true});
  return filename;
}

// ── AI Executive Report — alias for Longitudinal ─────────────────
export async function generateAIPDF({ sessions=[], profile, aiSummary="", lang="en" }) {
  return generateLongitudinalPDF({ sessions, profile, lang, aiSummary });
}
