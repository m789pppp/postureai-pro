import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  auth, db, signInGoogle, getGoogleRedirectResult, signInEmail, signUpEmail, logOut, resetPassword,
  onAuthStateChanged, createUserProfile, getUserProfile,
  updateUserTier, saveSession, recordPayment, confirmPayment,
  rejectPayment, listenToPayment, getAllPayments, getAllUsers,
  isHREmail, isCompanyDomain, isAutoApproveEmail,
  SUPPORT_EMAIL, PAYMOB_IFRAME_ID,
  AUTO_APPROVE_DOMAIN, serverTimestamp,
  notifyPaymentPending, notifyPaymentConfirmed,
  getCompany, createCompany, getUserSessions, onUserSessions, updateUserProfile,
  checkAndDowngradeTrial, completeOnboardingStep, getReferralStats, getReferralDiscount, checkAndSendNurtureEmails,
  doc, updateDoc,
} from "./firebase.js";
import { HRPanel } from "./HRPanel.jsx";
import { ErrorBoundary } from "./ErrorBoundary.jsx";
import { CalibrationWizard, useCalibration, applyCalibration } from "./PostureCalibration.jsx";
import { AnalyticsDashboard } from "./AnalyticsDashboard.jsx";
import { BreakTimer, useBreakTimer, useScoreSmoothing, useSoundFeedback } from "./PostureUtils.jsx";
import { AICoach } from "./AICoach.jsx";
import { AIInsights } from "./AIInsights.jsx";
import { PredictiveAI } from "./PredictiveAI.jsx";
import { AIReports } from "./AIReports.jsx";
import { WorkforceAnalytics } from "./WorkforceAnalytics.jsx";
import { EnterpriseRBAC } from "./EnterpriseRBAC.jsx";
import { NotificationsHub, useNotifications } from "./NotificationsHub.jsx";
import { OnboardingWizard } from "./OnboardingWizard.jsx";
import { GamificationPanel } from "./Gamification.jsx";
import { BillingModal, PLANS } from "./Billing.jsx";
import { BillingDashboard } from "./BillingDashboard.jsx";
import { AnalysisAPI, ReportAPI, EmailAPI, EnterpriseAPI, AdminAPI, AIAPI, PaymentAPI, NotifyAPI } from "./services/api.js";
import { useToasts, useOnline, useKeyboardShortcut } from "./hooks/index.js";
import { Toasts, Ring, MetRow, Skeleton, TierBadge, EmptyState, Btn, BarChart, OfflineBanner } from "./ui/index.jsx";
import { gradeScore, gradeScoreAr, scoreColor, playBeep, sendDesktopNotif, requestNotificationPermission, MODES, analyzeMP as _engAnalyzeMP, analyzeSideMP as _engAnalyzeSideMP, createLandmarkSmoother } from "./features/analysis/postureEngine.js";
import { getT } from "./lib/i18n.js";
// DESIGN import removed — use COLORS, TYPE, SPACE directly from DesignSystem.js
// ── Phase 12: Enterprise Scale ────────────────────────────────────
import { APIMarketplace }      from "./APIMarketplace.jsx";
import { WhiteLabel }          from "./WhiteLabel.jsx";
import { MultiTenantManager }  from "./MultiTenantManager.jsx";
import { AuditSystem }         from "./AuditSystem.jsx";
import { EnterpriseAdminTools }from "./EnterpriseAdminTools.jsx";
import LandingPageLegacy from "./LandingPage.jsx";
import LandingPageV7 from "./LandingPageV7.jsx";
const Landing = LandingPageV7; // alias so <Landing> works
import { AdminDashboard } from "./AdminDashboard.jsx";
import { CompanyOnboarding, CompanyBar, useCompany } from "./CompanySystem.jsx";
import { handleSSORedirect } from "./EnterpriseSSO.jsx";
// initSentry moved to sentry.js (V12)
import AuthPage from "./AuthPage.jsx";
import HomePage from "./HomePage.jsx";
import AccountSwitcher from "./AccountSwitcher.jsx";
import PricingPage from "./PricingPage.jsx";
import InviteAccept from "./InviteAccept.jsx";
import ProfilePage from "./ProfilePage.jsx";
import { NotFound } from "./ErrorPage.jsx";
import { UsageBilling }     from "./UsageBilling.jsx";
import { ChurnPrediction }  from "./ChurnPrediction.jsx";
import { CustomerSuccess }  from "./CustomerSuccess.jsx";
import { GrowthHub }        from "./GrowthHub.jsx";
import SessionComparison    from "./SessionComparison.jsx";
import TrendChart           from "./TrendChart.jsx";
import { ShareCard }        from "./ShareCard.jsx";
import { CookieConsent, LegalFooter } from "./LegalCompliance.jsx";
import { IntegrationsHub }  from "./IntegrationsHub.jsx";
import { ReferralProgram }  from "./ReferralProgram.jsx";
import { ProductTour, TourTrigger } from "./ProductTour.jsx";
import { MFASetup }         from "./MFASetup.jsx";
import AnnouncementsBar    from "./AnnouncementsBar.jsx";
import SecurityCenter       from "./SecurityCenter.jsx";
import FeatureFlags         from "./FeatureFlags.jsx";
import OnboardingAnalytics  from "./OnboardingAnalytics.jsx";
import { initSentry, identifyUser, captureError } from "./sentry.js";
import { AccountActivity } from "./AccountActivity.jsx";
// ── Merged from v13 & v18 ─────────────────────────────────────────
import { MRRDashboard }   from "./MRRDashboard.jsx";
import { HelpCenter }     from "./HelpCenter.jsx";
import { APIChangelog }   from "./APIChangelog.jsx";
import EmbedWidget        from "./EmbedWidget.jsx";

// API URL: set VITE_API_URL in .env.local for production
// Example: VITE_API_URL=https://corvus-backend.railway.app/api
const API = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

// ── i18n ──────────────────────────────────────────────────────────
// ── i18n: translations loaded from lib/i18n.js ─────────────────
// TR alias kept for backward compatibility — delegates to getT()
const TR = {
  en: getT("en"),
  ar: getT("ar"),
};

// ══════════════════════════════════════════════════════════════════
// CORVUS — Single Source of Truth for Pricing
// EGP = Egypt market (PayMob) · USD = Gulf/International market (Stripe)
// Annual = 20% discount (2 months free) — applied at checkout, not stored here
// ══════════════════════════════════════════════════════════════════
const COUPONS = {}; // Coupons validated server-side via /api/coupon/validate

// ── B2C Pricing (Egypt + Gulf) ────────────────────────────────────
// Egypt: PayMob in EGP | Gulf/Global: Stripe in USD
// Amounts stored in CENTS (EGP cents / USD cents)
const TIERS = {
  standard:{
    id:"standard", name:"Free", color:"#6366f1", colorDim:"rgba(99,102,241,.12)",
    price_egp_monthly:0,     price_egp_yearly:0,
    price_usd_monthly:0,     price_usd_yearly:0,
    features:["5 sessions/month","Posture score","Basic alerts"],
    badge:null
  },
  basic:{
    id:"basic", name:"Basic", color:"#3b82f6", colorDim:"rgba(59,130,246,.12)",
    price_egp_monthly:199, price_egp_yearly:1590,  // 199 EGP/mo | 1,590/yr
    price_usd_monthly:9.99,   price_usd_yearly:79.99,    // $9.99/mo  | $79.99/yr
    features:["Unlimited sessions","AI Coach (10 msgs/mo)","Streak tracking","Goals","Pain prediction"],
    badge:null
  },
  professional:{
    id:"professional", name:"Pro", color:"#8b5cf6", colorDim:"rgba(139,92,246,.12)",
    price_egp_monthly:399, price_egp_yearly:3190,  // 399 EGP/mo | 3,190/yr
    price_usd_monthly:19.99,  price_usd_yearly:159.99,   // $19.99/mo | $159.99/yr
    features:["Everything in Basic","AI Insights","Reports","Session compare","Leaderboard","Export CSV/PDF"],
    badge:"Most Popular"
  },
  elite:{
    id:"elite", name:"Elite", color:"#f59e0b", colorDim:"rgba(245,158,11,.12)",
    price_egp_monthly:699, price_egp_yearly:5590,  // 699 EGP/mo | 5,590/yr
    price_usd_monthly:39.99,  price_usd_yearly:299.99,   // $39.99/mo | $299.99/yr
    features:["Everything in Pro","AI Coach unlimited","Predictive AI","PDF report","Priority support","Calibration"],
    badge:"Best Value"
  }
};

// Legacy field aliases
for(const k in TIERS){
  TIERS[k].price_monthly = TIERS[k].price_egp_monthly;
  TIERS[k].price_yearly  = TIERS[k].price_egp_yearly;
}

// ══════════════════════════════════════════════════════════════════
// B2B TIERS — Companies only. Completely separate from B2C TIERS.
// IDs: b2b_starter / b2b_growth / b2b_enterprise
// FLAT-RATE pricing — one price for the whole plan up to a seat cap, NOT
// per-seat. Egypt: PayMob EGP | Gulf: Stripe USD.
// !! Never mix these IDs with B2C IDs (standard/basic/professional/elite) !!
// ══════════════════════════════════════════════════════════════════
const B2B_TIERS = {
  b2b_starter: {
    id:"b2b_starter", name:"Starter", nameAr:"ستارتر",
    color:"#6366f1", colorDim:"rgba(99,102,241,.12)",
    price_egp_monthly:2499, price_egp_yearly:23990,   // 2,499 EGP/mo flat | 23,990/yr
    price_usd_monthly:79,   price_usd_yearly:758,     // $79/mo flat | $758/yr
    seats:30,
    features:["Up to 30 employees","33-landmark AI pose detection","Real-time posture score","PDF wellness reports","HR analytics dashboard","Email support"],
    featuresAr:["حتى 30 موظف","كشف 33 نقطة بالـAI","نقاط الوضعية الآنية","تقارير PDF صحية","لوحة تحليلات HR","دعم بالبريد"],
    badge:null,
  },
  b2b_growth: {
    id:"b2b_growth", name:"Growth", nameAr:"جروث",
    color:"#1a56db", colorDim:"rgba(26,86,219,.12)",
    price_egp_monthly:6999, price_egp_yearly:67190,   // 6,999 EGP/mo flat | 67,190/yr
    price_usd_monthly:199,  price_usd_yearly:1910,    // $199/mo flat | $1,910/yr
    seats:100,
    features:["Up to 100 employees","Everything in Starter","FaceMesh 478 landmarks","3D solvePnP head pose","Advanced HR analytics","Slack/Teams alerts","Executive HR reports","Priority support"],
    featuresAr:["حتى 100 موظف","كل مزايا ستارتر","كشف 478 نقطة FaceMesh","وضع رأس 3D solvePnP","تحليلات HR متقدمة","تنبيهات Slack/Teams","تقارير HR تنفيذية","دعم أولوية"],
    badge:"Most Popular",
  },
  b2b_enterprise: {
    id:"b2b_enterprise", name:"Enterprise", nameAr:"إنتربرايز",
    color:"#10b981", colorDim:"rgba(16,185,129,.12)",
    price_egp_monthly:null, price_egp_yearly:null,    // Custom — contact sales
    price_usd_monthly:null, price_usd_yearly:null, price_usd_starting_at:499, // Starting at $499/mo
    seats:-1,
    features:["Unlimited employees","Everything in Growth","Gemini AI clinical narrative","SSO / SAML / Azure AD / Okta","White-label branding","API + Webhooks access","Dedicated success manager","Custom SLA guarantee"],
    featuresAr:["موظفون غير محدودون","كل مزايا جروث","تحليل سردي بالـ Gemini AI","SSO / SAML / Azure AD / Okta","علامة تجارية White-label","وصول API + Webhooks","مدير نجاح مخصص","ضمان SLA مخصص"],
    badge:"Custom",
  },
};

// Legacy field aliases (same pattern as B2C TIERS above)
for(const k in B2B_TIERS){
  B2B_TIERS[k].price_monthly = B2B_TIERS[k].price_egp_monthly;
  B2B_TIERS[k].price_yearly  = B2B_TIERS[k].price_egp_yearly;
}

// Helper: is this a B2B tier ID?
const isB2BTier = (id) => id && id.startsWith("b2b_");
// Helper: is this a B2C tier ID?
const isB2CTier = (id) => id && !id.startsWith("b2b_");

// ── Currency-aware price getter ──────────────────────────────────
// region: "EG" → EGP, anything else (Gulf/intl) → USD
function getTierPrice(tierId, period="monthly", region="EG"){
  const t = TIERS[tierId];
  if(!t) return null;
  const currency = region==="EG" ? "egp" : "usd";
  return t[`price_${currency}_${period}`];
}
function getCurrencySymbol(region="EG"){
  return region==="EG" ? "EGP" : "USD";
}

// ── Tier ID normaliser ──────────────────────────────────────────────
const TIER_NORMALIZE={
  // B2C direct
  standard:"standard", basic:"basic", professional:"professional", elite:"elite",
  // B2C aliases
  pro:"professional", premium:"elite",
  personal_basic:"basic", personal_pro:"professional", personal_elite:"elite",
  // B2B — keep as-is (never map to B2C IDs!)
  b2b_starter:"b2b_starter", b2b_growth:"b2b_growth", b2b_enterprise:"b2b_enterprise",
  // Legacy B2C (deprecated)
  starter:"basic", growth:"professional", enterprise:"elite",
};
const normalizeTier=(t)=>TIER_NORMALIZE[t]||t||"standard";

// ── Payment Methods — Automatic PayMob only ───────────────────────
const PAY_METHODS = [
  {id:"visa_card",   name:"Visa / Mastercard", nameAr:"فيزا / ماستركارد",
   icon:"💳", color:"#1a56db", instant:true,
   desc:"Activated immediately after payment",
   descAr:"يُفعَّل الاشتراك فور الدفع",
   type:"card"},
  {id:"vodafone_cash", name:"Vodafone Cash",  nameAr:"Vodafone Cash",
   icon:"📱", color:"#e4002b", instant:true,
   desc:"Pay via PayMob Vodafone Cash wallet",
   descAr:"ادفع عبر Vodafone Cash بـ PayMob",
   type:"wallet"},
];

// Personal/individual users share the same TIERS pricing as companies —
// acct_type ("individual" vs "company") determines seat count display only.
// Legacy personal_basic/personal_pro/personal_elite IDs are normalized via TIER_NORMALIZE.

// Emails that can access HR Panel and Admin Panel
// HR_EMAILS — list of emails with HR admin access
const HR_EMAILS = [];

const DARK  = {bg:"#030b14",card:"#05101f",card2:"#080f1e",border:"rgba(148,163,184,.1)",text:"#f0f4f8",muted:"#64748b",blue:"#1a56db",inp:"rgba(148,163,184,.08)",inpB:"rgba(148,163,184,.15)"};
const LIGHT = {bg:"#f1f5f9",card:"#ffffff",card2:"#f8fafc",border:"rgba(100,116,139,.15)",text:"#0f172a",muted:"#94a3b8",blue:"#1a56db",inp:"rgba(100,116,139,.07)",inpB:"rgba(100,116,139,.2)"};


// ── Helpers ───────────────────────────────────────────────────────
const sc    = v => v>=75?"#10b981":v>=50?"#f59e0b":"#ef4444";
const grade = (v,t) => v>=85?t.excellent:v>=70?t.good:v>=50?t.fair:t.poor;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const LM = {NOSE:0,L_EYE:2,R_EYE:5,L_EAR:7,R_EAR:8,L_SHOULDER:11,R_SHOULDER:12,L_HIP:23,R_HIP:24,L_KNEE:25,R_KNEE:26,L_ANKLE:27,R_ANKLE:28};
// ── API wrappers (use service layer with auth) ────────────────────
async function askGemini(prompt){
  try{
    const d = await import("./services/api.js").then(m => m.AIAPI.geminiAnalysis(prompt));
    return d?.text || null;
  }catch{return null;}
}

async function initPayMob({amount_egp,tier,user_email,user_name,billing,payment_type="card",wallet_number=""}){
  try{
    const { PaymentAPI } = await import("./services/api.js");
    const r = await PaymentAPI.createPayMobPayment({
      amount_cents: amount_egp*100, currency:"EGP", tier, billing,
      payment_type, wallet_number,
      billing_data:{email:user_email,first_name:user_name?.split(" ")[0]||"Customer",
        last_name:user_name?.split(" ")[1]||"",phone_number:wallet_number||"N/A",
        apartment:"NA",floor:"NA",street:"NA",building:"NA",shipping_method:"NA",
        postal_code:"NA",city:"Cairo",country:"EG",state:"Cairo"}
    });
    if(payment_type==="mobile_wallet"&&r?.redirect_url) return{type:"wallet",url:r.redirect_url};
    if(r?.payment_key) return{type:"card",url:`https://accept.paymob.com/api/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${r.payment_key}`};
  }catch(e){console.error("PayMob:",e);}
  return null;
}

// ── Local MediaPipe analysis (adapters for postureEngine result shape) ────
function analyzeMP(lms,W,H,mode){
  // postureEngine returns {score, metrics, alerts, recommendations, detected, lms(named), raw}
  // App expects  {overall, distCm, lo, hi, metrics, lms(landmark refs), raw}
  const eng = _engAnalyzeMP(lms,W,H,mode);
  if(!eng) return null;
  // eng.metrics.screen_distance has the distance data
  const dist = eng.metrics?.screen_distance;
  const[lo,hi]=mode==="phone"?[60,90]:[50,80];
  return{
    overall: eng.score,
    distCm:  dist?.value||null,
    lo, hi,
    metrics: eng.metrics,
    alerts:  eng.alerts,
    // Rebuild lms refs from raw landmarks for drawFront
    lms: _buildLmsRefs(lms,W,H),
    raw: {neckLean:eng.metrics?.neck_lean?.value,headTilt:eng.metrics?.head_tilt?.value,
          shTilt:eng.metrics?.shoulder_level?.value,spineLean:eng.metrics?.spine_lean?.value,
          distCm:dist?.value,lo,hi},
  };
}

function analyzeSideMP(lms,W,H){
  const eng = _engAnalyzeSideMP(lms,W,H);
  if(!eng) return null;
  return{
    overall: eng.score,
    metrics: eng.metrics,
    alerts:  eng.alerts,
    lms: _buildSideLmsRefs(lms,W,H),
    raw: {neckLean:eng.metrics?.neck_lean_side?.value,trunkLean:eng.metrics?.trunk_lean?.value,
          hipA:eng.metrics?.hip_angle?.value,kneeA:eng.metrics?.knee_angle?.value,
          spineAlign:eng.metrics?.spine_align?.value},
  };
}

function _buildLmsRefs(lms,W,H){
  if(!lms||lms.length<25) return {};
  const g=i=>lms[i], px=i=>({x:g(i).x,y:g(i).y});
  const lSh=px(11),rSh=px(12),lEar=px(7),rEar=px(8),lEye=px(2),rEye=px(5),lHip=px(23),rHip=px(24);
  return{lSh,rSh,lEar,rEar,lEye,rEye,
    midSh:{x:(lSh.x+rSh.x)/2,y:(lSh.y+rSh.y)/2},
    midEar:{x:(lEar.x+rEar.x)/2,y:(lEar.y+rEar.y)/2},
    midHip:{x:(lHip.x+rHip.x)/2,y:(lHip.y+rHip.y)/2}};
}

function _buildSideLmsRefs(lms,W,H){
  if(!lms||lms.length<29) return {};
  const g=i=>lms[i];
  const lV=g(11).visibility||0,rV=g(12).visibility||0,S=lV>=rV?"L":"R";
  const si=n=>S==="L"?{L_EAR:7,L_SHOULDER:11,L_HIP:23,L_KNEE:25,L_ANKLE:27}[n]:{R_EAR:8,R_SHOULDER:12,R_HIP:24,R_KNEE:26,R_ANKLE:28}[n];
  return{ear:{x:g(si("L_EAR")).x,y:g(si("L_EAR")).y},sh:{x:g(si("L_SHOULDER")).x,y:g(si("L_SHOULDER")).y},
         hip:{x:g(si("L_HIP")).x,y:g(si("L_HIP")).y},knee:{x:g(si("L_KNEE")).x,y:g(si("L_KNEE")).y},
         ankle:{x:g(si("L_ANKLE")).x,y:g(si("L_ANKLE")).y}};
}

function _riskColor(score){
  if(score==null) return "#94a3b8";
  if(score>=80) return "#10b981";
  if(score>=60) return "#f59e0b";
  return "#ef4444";
}
function _riskLabel(score,isAr){
  if(score==null) return isAr?"غير متاح":"N/A";
  if(score>=80) return isAr?"منخفض":"Low";
  if(score>=60) return isAr?"متوسط":"Medium";
  return isAr?"مرتفع":"High";
}
function _angle2pt(a,b){
  if(!a||!b) return null;
  const dx=b.x-a.x, dy=b.y-a.y;
  return Math.round(Math.abs(Math.atan2(dy,dx)*180/Math.PI));
}
function _angle3pt(a,b,c){
  if(!a||!b||!c) return null;
  const ax=a.x-b.x,ay=a.y-b.y,cx=c.x-b.x,cy=c.y-b.y;
  const dot=ax*cx+ay*cy,mag=Math.sqrt(ax*ax+ay*ay)*Math.sqrt(cx*cx+cy*cy);
  if(!mag) return null;
  return Math.round(Math.acos(Math.min(1,Math.max(-1,dot/mag)))*180/Math.PI);
}

function drawFront(ctx,res,W,H,isAr=false){
  if(!res?.lms) return;
  const{lms:lm,raw,overall,metrics}=res;
  const px=p=>p?[p.x*W,p.y*H]:[0,0];
  const valid=p=>p&&(p.visibility==null||p.visibility>0.3);

  // ── Risk colors per zone ──────────────────────────────────────
  const neckScore = metrics?.neck_lean?.score ?? overall;
  const shScore   = metrics?.shoulder_level?.score ?? overall;
  const backScore = metrics?.spine_lean?.score ?? overall;
  const neckCol   = _riskColor(neckScore);
  const shCol     = _riskColor(shScore);
  const backCol   = _riskColor(backScore);

  ctx.save();

  // ── Connections with zone colors ─────────────────────────────
  const CONNECTIONS = [
    // Head/neck zone
    { pts:[lm.lEye,lm.rEye],       col:neckCol, w:2 },
    { pts:[lm.lEar,lm.rEar],       col:neckCol, w:2 },
    { pts:[lm.lEar,lm.lSh],        col:neckCol, w:2.5 },
    { pts:[lm.rEar,lm.rSh],        col:neckCol, w:2.5 },
    { pts:[lm.midEar,lm.midSh],    col:neckCol, w:3 },
    // Shoulder zone
    { pts:[lm.lSh,lm.rSh],         col:shCol,   w:3 },
    // Spine/back zone
    { pts:[lm.midSh,lm.midHip],    col:backCol, w:3.5 },
    // Hip
    { pts:[lm.lHip,lm.rHip],       col:"#6366f1", w:2.5 },
    { pts:[lm.lSh,lm.lHip],        col:backCol, w:2 },
    { pts:[lm.rSh,lm.rHip],        col:backCol, w:2 },
  ];

  CONNECTIONS.forEach(({pts:[a,b],col,w})=>{
    if(!valid(a)||!valid(b)) return;
    const[ax,ay]=px(a),[bx,by]=px(b);
    ctx.globalAlpha=.9; ctx.lineWidth=w; ctx.strokeStyle=col;
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
  });

  // ── Joints with glow effect ──────────────────────────────────
  const JOINTS = [
    { p:lm.lSh,  col:shCol,   r:6  },
    { p:lm.rSh,  col:shCol,   r:6  },
    { p:lm.lEar, col:neckCol, r:5  },
    { p:lm.rEar, col:neckCol, r:5  },
    { p:lm.midSh,col:backCol, r:7  },
    { p:lm.lHip, col:"#6366f1",r:5 },
    { p:lm.rHip, col:"#6366f1",r:5 },
    { p:lm.lEye, col:neckCol, r:3  },
    { p:lm.rEye, col:neckCol, r:3  },
  ];

  JOINTS.forEach(({p,col,r})=>{
    if(!valid(p)) return;
    const[x,y]=px(p);
    // Glow
    ctx.globalAlpha=.18;
    ctx.beginPath(); ctx.arc(x,y,r*2.5,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
    // Core
    ctx.globalAlpha=1;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill();
    ctx.lineWidth=1.5; ctx.strokeStyle="rgba(255,255,255,.6)";
    ctx.stroke();
  });

  // ── Joint angles labels ───────────────────────────────────────
  ctx.font="bold 10px system-ui"; ctx.globalAlpha=.95;

  // Neck angle (ear-shoulder vertical)
  if(valid(lm.midEar)&&valid(lm.midSh)){
    const neckAng = metrics?.neck_lean?.value ?? _angle2pt(lm.midEar,lm.midSh);
    if(neckAng!=null){
      const[sx,sy]=px(lm.midSh);
      ctx.fillStyle="rgba(0,0,0,.55)";
      ctx.fillRect(sx+6,sy-14,40,16); ctx.fillStyle=neckCol;
      ctx.fillText(`${neckAng}°`,sx+8,sy-2);
    }
  }

  // Shoulder tilt angle
  if(valid(lm.lSh)&&valid(lm.rSh)){
    const[lx,ly]=px(lm.lSh),[rx,ry]=px(lm.rSh);
    const tiltAng=Math.round(Math.abs(Math.atan2(ry-ly,rx-lx)*180/Math.PI));
    const mx=(lx+rx)/2, my=(ly+ry)/2-14;
    ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(mx-20,my-12,42,16);
    ctx.fillStyle=shCol; ctx.fillText(`${tiltAng}°`,mx-18,my);
  }

  // Screen distance
  if(raw?.distCm){
    const dc=raw.distCm>=raw.idealDistLo&&raw.distCm<=raw.idealDistHi?"#10b981":raw.distCm>=(raw.idealDistLo-15)?"#f59e0b":"#ef4444";
    const[sx,sy]=px(lm.midEar||{x:.5,y:.1});
    ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(W-62,H-26,58,18);
    ctx.fillStyle=dc; ctx.font="bold 11px system-ui";
    ctx.fillText(`📏 ${raw.distCm}cm`,W-60,H-12);
  }

  // ── Risk panel (bottom-left) ──────────────────────────────────
  const panelX=8, panelY=H-92, panelW=148, panelH=86;
  ctx.globalAlpha=.82;
  ctx.fillStyle="rgba(2,8,20,.85)";
  _roundRect(ctx,panelX,panelY,panelW,panelH,8);
  ctx.fill();
  ctx.globalAlpha=1;

  const rows=[
    { label:isAr?"الرقبة":"Neck",     col:neckCol, score:neckScore },
    { label:isAr?"الكتفين":"Shoulder", col:shCol,   score:shScore  },
    { label:isAr?"الظهر":"Back",       col:backCol, score:backScore },
  ];
  ctx.font="bold 10px system-ui";
  rows.forEach(({label,col,score},i)=>{
    const ry=panelY+14+i*24;
    // Label
    ctx.fillStyle="#94a3b8"; ctx.fillText(label,panelX+8,ry);
    // Risk bar (50px wide)
    const barX=panelX+60, barW=60, barFill=Math.max(4,(score??0)/100*barW);
    ctx.fillStyle="rgba(255,255,255,.08)";
    _roundRect(ctx,barX,ry-9,barW,10,5); ctx.fill();
    ctx.fillStyle=col;
    _roundRect(ctx,barX,ry-9,barFill,10,5); ctx.fill();
    // Risk text
    ctx.fillStyle=col;
    ctx.font="600 9px system-ui";
    ctx.fillText(_riskLabel(score,isAr),barX+barW+4,ry);
    ctx.font="bold 10px system-ui";
  });

  ctx.restore();
}

function _roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

function drawSide(ctx,res,W,H,isAr=false){
  if(!res?.lms) return;
  const{lms:lm,overall,metrics}=res;
  const px=p=>p?[p.x*W,p.y*H]:[0,0];
  const valid=p=>p&&(p.visibility==null||p.visibility>0.3);

  const neckScore = metrics?.neck_lean?.score  ?? overall;
  const trunkScore= metrics?.trunk_lean?.score ?? overall;
  const hipScore  = metrics?.hip_angle?.score  ?? overall;
  const neckCol   = _riskColor(neckScore);
  const trunkCol  = _riskColor(trunkScore);
  const hipCol    = _riskColor(hipScore);

  ctx.save();

  // ── Connections ───────────────────────────────────────────────
  const SIDE_CONN=[
    {pts:[lm.ear,lm.sh],   col:neckCol,  w:3},
    {pts:[lm.sh,lm.hip],   col:trunkCol, w:3.5},
    {pts:[lm.hip,lm.knee], col:hipCol,   w:3},
    {pts:[lm.knee,lm.ankle],col:"#6366f1",w:2.5},
  ];
  SIDE_CONN.forEach(({pts:[a,b],col,w})=>{
    if(!valid(a)||!valid(b)) return;
    const[ax,ay]=px(a),[bx,by]=px(b);
    ctx.globalAlpha=.9; ctx.lineWidth=w; ctx.strokeStyle=col;
    ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
  });

  // ── Joints ────────────────────────────────────────────────────
  [{p:lm.ear,col:neckCol,r:5},{p:lm.sh,col:neckCol,r:7},
   {p:lm.hip,col:hipCol,r:6},{p:lm.knee,col:"#6366f1",r:5},
   {p:lm.ankle,col:"#6366f1",r:4}].forEach(({p,col,r})=>{
    if(!valid(p)) return;
    const[x,y]=px(p);
    ctx.globalAlpha=.18; ctx.beginPath(); ctx.arc(x,y,r*2.5,0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill();
    ctx.globalAlpha=1; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill();
    ctx.lineWidth=1.5; ctx.strokeStyle="rgba(255,255,255,.6)"; ctx.stroke();
  });

  // ── Angle labels ──────────────────────────────────────────────
  ctx.font="bold 10px system-ui"; ctx.globalAlpha=.95;

  // Neck angle at shoulder
  if(valid(lm.ear)&&valid(lm.sh)){
    const neckAng=metrics?.neck_lean?.value??_angle2pt(lm.ear,lm.sh);
    if(neckAng!=null){
      const[sx,sy]=px(lm.sh);
      ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(sx+8,sy-14,40,16);
      ctx.fillStyle=neckCol; ctx.fillText(`${neckAng}°`,sx+10,sy-2);
    }
  }
  // Hip angle
  if(valid(lm.sh)&&valid(lm.hip)&&valid(lm.knee)){
    const hipAng=_angle3pt(lm.sh,lm.hip,lm.knee);
    if(hipAng!=null){
      const[hx,hy]=px(lm.hip);
      ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(hx+8,hy-14,44,16);
      ctx.fillStyle=hipCol; ctx.fillText(`${hipAng}°`,hx+10,hy-2);
    }
  }
  // Knee angle
  if(valid(lm.hip)&&valid(lm.knee)&&valid(lm.ankle)){
    const kneeAng=_angle3pt(lm.hip,lm.knee,lm.ankle);
    if(kneeAng!=null){
      const[kx,ky]=px(lm.knee);
      ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(kx+8,ky-14,44,16);
      ctx.fillStyle="#6366f1"; ctx.fillText(`${kneeAng}°`,kx+10,ky-2);
    }
  }

  // ── Risk panel ────────────────────────────────────────────────
  const panelX=8,panelY=H-92,panelW=148,panelH=86;
  ctx.globalAlpha=.82; ctx.fillStyle="rgba(2,8,20,.85)";
  _roundRect(ctx,panelX,panelY,panelW,panelH,8); ctx.fill();
  ctx.globalAlpha=1;
  const rows=[
    {label:isAr?"الرقبة":"Neck",  col:neckCol,  score:neckScore},
    {label:isAr?"الجذع":"Trunk",  col:trunkCol, score:trunkScore},
    {label:isAr?"الورك":"Hip",    col:hipCol,   score:hipScore},
  ];
  ctx.font="bold 10px system-ui";
  rows.forEach(({label,col,score},i)=>{
    const ry=panelY+14+i*24;
    ctx.fillStyle="#94a3b8"; ctx.fillText(label,panelX+8,ry);
    const barX=panelX+60,barW=60,barFill=Math.max(4,(score??0)/100*barW);
    ctx.fillStyle="rgba(255,255,255,.08)";
    _roundRect(ctx,barX,ry-9,barW,10,5); ctx.fill();
    ctx.fillStyle=col; _roundRect(ctx,barX,ry-9,barFill,10,5); ctx.fill();
    ctx.fillStyle=col; ctx.font="600 9px system-ui";
    ctx.fillText(_riskLabel(score,isAr),barX+barW+4,ry);
    ctx.font="bold 10px system-ui";
  });

  ctx.restore();
}


// ── Onboarding Tour ───────────────────────────────────────────────
function Onboard({cs,t,done}){
  const[step,setStep]=useState(0);
  const steps=[{e:"◈",ti:t.ob1,d:t.ob1d},{e:"📊",ti:t.ob2,d:t.ob2d},{e:"📷",ti:t.ob3,d:t.ob3d},{e:"🚀",ti:t.ob4,d:t.ob4d}];
  const s=steps[step];
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:8888,backdropFilter:"blur(4px)"}}>
    <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:20,padding:36,maxWidth:400,width:"90%",textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:14}}>{s.e}</div>
      <div style={{fontSize:17,fontWeight:700,color:cs.text,marginBottom:10}}>{s.ti}</div>
      <div style={{fontSize:13,color:cs.muted,lineHeight:1.7,marginBottom:24}}>{s.d}</div>
      <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:22}}>
        {steps.map((_,i)=><div key={i} style={{width:i===step?20:7,height:7,borderRadius:99,background:i===step?"#1a56db":"rgba(148,163,184,.2)",transition:"all .3s"}}/>)}
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"center"}}>
        <button onClick={done} style={{background:"none",border:`0.5px solid ${cs.border}`,borderRadius:9,padding:"9px 18px",fontSize:12,color:cs.muted,cursor:"pointer"}}>{t.skip}</button>
        {step<steps.length-1?<Btn cs={cs} onClick={()=>setStep(step+1)}>{t.next}</Btn>:<Btn cs={cs} onClick={done}>{t.finish}</Btn>}
      </div>
    </div>
  </div>;
}


// ── Auth ──────────────────────────────────────────────────────────
function Auth({cs,t,darkMode,setDarkMode,lang,setLang,onAuth}){
  const[tab,setTab]=useState("login");
  const[email,setEmail]=useState(""),[pass,setPass]=useState("");
  const[name,setName]=useState(""),[company,setCompany]=useState("");
  const[loading,setLoading]=useState(false),[err,setErr]=useState("");
  const[resetSent,setResetSent]=useState(false);
  const[showPass,setShowPass]=useState(false);
  const[passStrength,setPassStrength]=useState(0);
  const isAr=lang==="ar";
  const isAuto=isAutoApproveEmail(email);
  const dir=isAr?"rtl":"ltr";
  const inp={width:"100%",background:cs.inp,border:`0.5px solid ${cs.inpB}`,borderRadius:9,padding:"11px 14px",fontSize:13,color:cs.text,outline:"none",boxSizing:"border-box",marginBottom:10,direction:dir};

  // password strength
  function calcStrength(p){
    let s=0;
    if(p.length>=6)s++;if(p.length>=10)s++;
    if(/[A-Z]/.test(p))s++;if(/[0-9]/.test(p))s++;if(/[^A-Za-z0-9]/.test(p))s++;
    return s;
  }
  function onPassChange(v){setPass(v);if(tab==="signup")setPassStrength(calcStrength(v));}

  const strengthColor=["#ef4444","#f59e0b","#f59e0b","#10b981","#10b981"][passStrength]||"#ef4444";
  const strengthLabel=isAr
    ?["ضعيفة جداً","ضعيفة","مقبولة","قوية","قوية جداً"][Math.min(passStrength,4)]
    :["Very weak","Weak","Fair","Strong","Very strong"][Math.min(passStrength,4)];

  function humanErr(msg){
    const code=(msg||"").match(/\(auth\/([^)]+)\)/)?.[1]||msg;
    const map={
      "wrong-password":         isAr?"كلمة المرور غلط":"Wrong password",
      "invalid-credential":     isAr?"البريد أو كلمة المرور غلط":"Invalid email or password",
      "user-not-found":         isAr?"مفيش حساب — سجّل حساب جديد":"No account found — please sign up",
      "email-already-in-use":   isAr?"البريد مسجّل — سجّل دخول":"Email in use — please sign in",
      "weak-password":          isAr?"كلمة المرور ضعيفة — 6 أحرف على الأقل":"Password too weak — 6+ chars",
      "too-many-requests":      isAr?"محاولات كتيرة — حاول بعد شوية":"Too many attempts — try later",
      "network-request-failed": isAr?"مشكلة في الإنترنت":"Network error",
      "popup-blocked":          isAr?"الـ popup اتحجب — جاري إعادة المحاولة...":"Popup blocked — retrying with redirect...",
      "popup-closed-by-user":   isAr?"أُغلق الـ popup":"Sign-in popup closed",
      "invalid-email":          isAr?"البريد الإلكتروني غير صحيح":"Invalid email",
      "user-disabled":          isAr?"الحساب موقوف":"Account disabled — contact support",
      "auth/internal-error":    isAr?"خطأ داخلي — تأكد من تفعيل Google في Firebase":"Internal error — enable Google in Firebase Console",
    };
    return map[code]||(isAr?"حدث خطأ، حاول تاني":"Something went wrong, please try again");
  }

  async function handleForgotPassword(){
    if(!email.includes("@")){setErr(isAr?"أدخل بريدك أولاً":"Enter your email first");return;}
    setLoading(true);setErr("");
    try{await resetPassword(email);setResetSent(true);}
    catch(e2){setErr(humanErr(e2.message));}
    setLoading(false);
  }

  async function submit(e){
    e.preventDefault();setErr("");setLoading(true);
    if(!email.includes("@")){setErr(isAr?"البريد غير صحيح":"Invalid email");setLoading(false);return;}
    if(pass.length<6){setErr(isAr?"كلمة المرور 6 أحرف على الأقل":"Password must be 6+ chars");setLoading(false);return;}
    try{
      if(tab==="login"){
        const c=await signInEmail(email,pass);
        onAuth(c.user);
      } else {
        const c=await signUpEmail(email,pass);
        const refCode=window.__referral_code||null;
        await createUserProfile(c.user.uid,{email,name:name.trim(),company:company.trim()},refCode);
        onAuth(c.user,true);
      }
    }catch(e2){setErr(humanErr(e2.message));}
    setLoading(false);
  }

  async function google(){
    setErr("");setLoading(true);
    try{
      const c=await signInGoogle();
      if(!c){
        setErr(isAr?"جاري إعادة التوجيه لـ Google...":"Redirecting to Google...");
        return;
      }
      let p=await getUserProfile(c.user.uid);
      if(!p){
        const refCode=window.__referral_code||null;
        await createUserProfile(c.user.uid,{email:c.user.email,name:c.user.displayName||"",company:""},refCode);
      }
      onAuth(c.user);
    }catch(e2){
      // Show FULL raw error for debugging
      const raw = e2?.code || e2?.message || String(e2);
      console.error("🔴 Google auth error:", raw, e2);
      setErr("DEBUG: " + raw);
    }
    setLoading(false);
  }

  return(
    <div dir={dir} style={{minHeight:"100vh",background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:400}}>

        {/* Controls */}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:14}}>
          <button onClick={()=>setLang(lang==="en"?"ar":"en")} style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:7,padding:"5px 12px",fontSize:11,color:cs.text,cursor:"pointer"}}>{lang==="en"?"🇪🇬 عربي":"🇬🇧 EN"}</button>
          <button onClick={()=>setDarkMode(!darkMode)} style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:7,padding:"5px 9px",fontSize:12,cursor:"pointer"}}>{darkMode?"☀️":"🌙"}</button>
        </div>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{width:48,height:48,background:"linear-gradient(135deg,#1a56db,#0891b2)",borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",fontSize:23,margin:"0 auto 10px",boxShadow:"0 8px 24px rgba(26,86,219,.3)"}}>◈</div>
          <div style={{fontSize:20,fontWeight:700,color:cs.text}}>{t.appName}</div>
          <div style={{fontSize:11,color:cs.muted,marginTop:3}}>{t.tagline}</div>
        </div>

        <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:18,padding:24,boxShadow:"0 4px 24px rgba(0,0,0,.08)"}}>

          {/* Tabs */}
          <div style={{display:"flex",gap:3,background:"rgba(148,163,184,.07)",borderRadius:10,padding:4,marginBottom:20}}>
            {[["login",t.signIn],["signup",t.signUp]].map(([tt,l])=>(
              <button key={tt} onClick={()=>{setTab(tt);setErr("");setResetSent(false);}} style={{flex:1,padding:"9px 0",fontSize:12,fontWeight:600,color:tab===tt?"#fff":cs.muted,background:tab===tt?cs.blue:"transparent",border:"none",borderRadius:7,cursor:"pointer",transition:"all .2s"}}>{l}</button>
            ))}
          </div>

          {/* Academic badge */}
          {isAuto&&<div style={{background:"rgba(16,185,129,.08)",border:"0.5px solid rgba(16,185,129,.25)",borderRadius:9,padding:"9px 12px",marginBottom:14,fontSize:11,color:"#6ee7b7",display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:15}}>🎓</span>
            <span><strong>{isAr?"نطاق أكاديمي!":"Academic domain!"}</strong> {isAr?"Elite مجاناً لـ":"Elite free for"} {AUTO_APPROVE_DOMAIN}</span>
          </div>}

          {/* Google */}
          <button onClick={google} disabled={loading} style={{width:"100%",background:cs.card2||"rgba(255,255,255,.04)",border:`1px solid ${cs.border}`,borderRadius:10,padding:"12px 0",fontSize:13,fontWeight:500,color:cs.text,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:9,marginBottom:16,opacity:loading?.7:1,transition:"all .2s"}}>
            <svg width="17" height="17" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading?"...":(isAr?"الدخول بـ Google":"Continue with Google")}
          </button>

          {/* Divider */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{flex:1,height:"0.5px",background:cs.border}}/>
            <div style={{fontSize:10,color:cs.muted}}>{isAr?"أو بالبريد الإلكتروني":"or with email"}</div>
            <div style={{flex:1,height:"0.5px",background:cs.border}}/>
          </div>

          <form onSubmit={submit}>
            {tab==="signup"&&<>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder={isAr?"الاسم الكامل *":"Full name *"} required style={inp}/>
              <input value={company} onChange={e=>setCompany(e.target.value)} placeholder={isAr?"الشركة (اختياري)":"Company (optional)"} style={inp}/>
            </>}

            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder={isAr?"البريد الإلكتروني":"Email address"} type="email" required style={inp} autoComplete="email"/>

            {/* Password + show/hide */}
            <div style={{position:"relative",marginBottom:tab==="signup"&&pass?4:10}}>
              <input value={pass} onChange={e=>onPassChange(e.target.value)} placeholder={isAr?"كلمة المرور":"Password"} type={showPass?"text":"password"} required minLength={6}
                style={{...inp,marginBottom:0,paddingRight:isAr?"14px":"42px",paddingLeft:isAr?"42px":"14px"}} autoComplete={tab==="login"?"current-password":"new-password"}/>
              <button type="button" onClick={()=>setShowPass(v=>!v)}
                style={{position:"absolute",top:"50%",transform:"translateY(-50%)",right:isAr?"auto":"12px",left:isAr?"12px":"auto",background:"none",border:"none",cursor:"pointer",fontSize:15,color:cs.muted,padding:4,lineHeight:1}}>
                {showPass?"🙈":"👁"}
              </button>
            </div>

            {/* Password strength bar */}
            {tab==="signup"&&pass&&<div style={{marginBottom:10}}>
              <div style={{display:"flex",gap:3,marginBottom:3}}>
                {[1,2,3,4,5].map(i=>(
                  <div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=passStrength?strengthColor:"rgba(148,163,184,.2)",transition:"background .3s"}}/>
                ))}
              </div>
              <div style={{fontSize:9.5,color:strengthColor}}>{strengthLabel}</div>
            </div>}

            {/* Forgot password */}
            {tab==="login"&&<div style={{textAlign:isAr?"left":"right",marginBottom:12}}>
              <button type="button" onClick={handleForgotPassword} disabled={loading}
                style={{background:"none",border:"none",fontSize:11,color:cs.blue,cursor:"pointer",padding:0,textDecoration:"underline"}}>
                {isAr?"نسيت كلمة المرور؟":"Forgot password?"}
              </button>
            </div>}

            {/* Reset sent */}
            {resetSent&&<div style={{fontSize:11,color:"#6ee7b7",marginBottom:12,background:"rgba(16,185,129,.07)",padding:"10px 12px",borderRadius:8,border:"0.5px solid rgba(16,185,129,.2)"}}>
              ✅ {isAr?"تم إرسال رابط إعادة تعيين كلمة المرور — راجع بريدك":"Password reset link sent — check your email"}
            </div>}

            {/* Error */}
            {err&&<div style={{fontSize:11,color:"#fca5a5",marginBottom:12,background:"rgba(239,68,68,.07)",padding:"10px 12px",borderRadius:8,border:"0.5px solid rgba(239,68,68,.2)"}}>{err}</div>}

            <button type="submit" disabled={loading}
              style={{width:"100%",background:"linear-gradient(135deg,#1a56db,#0891b2)",border:"none",borderRadius:10,padding:"12px 0",fontSize:13,fontWeight:700,color:"#fff",cursor:loading?"not-allowed":"pointer",opacity:loading?.7:1,marginBottom:4,boxShadow:"0 4px 14px rgba(26,86,219,.3)",transition:"all .2s"}}>
              {loading?"...":(tab==="login"?(isAr?"تسجيل الدخول":"Sign In"):(isAr?"إنشاء حساب":"Create Account")+(isAuto?" — Elite Free":""))}
            </button>
          </form>
        </div>

        <div style={{textAlign:"center",marginTop:14,fontSize:10,color:cs.muted}}>
          {isAr?"الدعم":"Support"}: <a href={`mailto:${SUPPORT_EMAIL}`} style={{color:cs.blue}}>{SUPPORT_EMAIL}</a>
        </div>
      </div>
    </div>
  );
}

// ── Waiting Page ──────────────────────────────────────────────────
function Waiting({paymentId,payMethod,amount,tier,refCode,onSuccess,cs,t}){
  const[status,setStatus]=useState("pending"),[payData,setPayData]=useState(null);
  useEffect(()=>{const unsub=listenToPayment(paymentId,d=>{setPayData(d);if(d.status==="confirmed"){setStatus("confirmed");onSuccess();}else if(d.status==="rejected")setStatus("rejected");});return unsub;},[paymentId]);
  const pm=PAY_METHODS.find(p=>p.id===payMethod),tierInfo=TIERS[tier];
  return <div style={{minHeight:"100vh",background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"system-ui,sans-serif"}}>
    <div style={{maxWidth:480,width:"100%"}}>
      {status==="confirmed"?(<div style={{background:cs.card,border:"0.5px solid rgba(16,185,129,.4)",borderRadius:16,padding:36,textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:12}}>✅</div>
        <div style={{fontSize:20,fontWeight:700,color:cs.text,marginBottom:8}}>{t.payOK}</div>
        <div style={{fontSize:13,color:cs.muted}}>{t.planActive} {tierInfo?.name}</div>
      </div>):status==="rejected"?(<div style={{background:cs.card,border:"0.5px solid rgba(239,68,68,.4)",borderRadius:16,padding:36,textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:12}}>❌</div>
        <div style={{fontSize:20,fontWeight:700,color:cs.text,marginBottom:8}}>{t.payFail}</div>
        <div style={{fontSize:12,color:cs.muted,marginBottom:16}}>{payData?.reject_reason||"Not verified"}</div>
        <Btn cs={cs} onClick={()=>window.location.reload()}>{t.tryAgain}</Btn>
      </div>):(<div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:16,padding:24}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{width:50,height:50,border:"3px solid rgba(245,158,11,.3)",borderTop:"3px solid #f59e0b",borderRadius:"50%",margin:"0 auto 12px",animation:"spin 1.2s linear infinite"}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{fontSize:16,fontWeight:700,color:cs.text,marginBottom:4}}>{t.waitConfirm}</div>
          <div style={{fontSize:11,color:cs.muted}}>{t.adminReview}</div>
        </div>
        <div style={{background:"rgba(148,163,184,.05)",border:`0.5px solid ${cs.border}`,borderRadius:10,padding:14,marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[["Plan",tierInfo?.name],["Amount",`${amount?.toLocaleString()} EGP`],["Method",pm?.name],["Reference",refCode]].map(([k,v])=>(
              <div key={k}><div style={{fontSize:9,color:cs.muted,textTransform:"uppercase",marginBottom:2}}>{k}</div><div style={{fontSize:12,fontWeight:600,color:cs.text,fontFamily:k==="Reference"?"monospace":undefined}}>{v}</div></div>
            ))}
          </div>
        </div>
        <div style={{fontSize:11,color:cs.muted,lineHeight:1.7}}>
          {pm?.number&&<><strong style={{color:cs.text}}>📱 {pm.number}</strong><br/></>}
          {pm?.ipa&&<><strong style={{color:cs.text}}>⚡ {pm.ipa}</strong><br/></>}
          <strong style={{color:"#fcd34d"}}>Ref: {refCode}</strong><br/>
          <span style={{fontSize:10}}>Send proof: <strong>{SUPPORT_EMAIL}</strong> · WhatsApp: <strong>{ADMIN_PHONE}</strong></span>
        </div>
      </div>)}
    </div>
  </div>;
}

// ── Profile Page ──────────────────────────────────────────────────
function Profile({user,profile,sessions,cs,t,onBack,onSave,addToast,lang}){
  const isAr=lang==="ar";
  const[name,setName]=useState(profile?.name||"");
  const[company,setCompany]=useState(profile?.company||"");
  const[saving,setSaving]=useState(false);
  const refLink=`${window.location.origin}?ref=${user.uid.slice(0,8)}&plan=professional`;
  const avgScore=sessions.length?Math.round(sessions.reduce((a,s)=>a+(s.avg_score||0),0)/sessions.length):0;
  const inp={width:"100%",background:cs.inp,border:`0.5px solid ${cs.inpB}`,borderRadius:9,padding:"11px 14px",fontSize:13,color:cs.text,outline:"none",boxSizing:"border-box",marginBottom:12};
  async function save(){
    setSaving(true);
    try{
      await updateUserProfile(user.uid,{name:name.trim(),company:company.trim()});
      onSave({...profile,name:name.trim(),company:company.trim()});addToast(t.save+" ✓","success");
    }catch{addToast(isAr?"خطأ في الحفظ":"Error saving","error");}
    setSaving(false);
  }
  return <div style={{minHeight:"100vh",background:cs.bg,fontFamily:"system-ui,sans-serif",overflowY:"auto"}}>
    <div style={{maxWidth:700,margin:"0 auto",padding:"26px 18px 52px"}}>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:24}}>
        <button onClick={onBack} style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:7,padding:"7px 14px",fontSize:11,color:cs.muted,cursor:"pointer"}}>{t.backToApp}</button>
        <div style={{fontSize:15,fontWeight:700,color:cs.text}}>👤 {t.profile}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:13,marginBottom:13}}>
        <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:13,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,color:cs.text,marginBottom:14}}>{t.editProfile}</div>
          <div style={{width:58,height:58,borderRadius:"50%",background:"linear-gradient(135deg,#1a56db,#0891b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"white",margin:"0 auto 12px"}}>{(profile?.name||user.email||"U")[0].toUpperCase()}</div>
          <div style={{fontSize:11,color:cs.muted,textAlign:"center",marginBottom:16}}>{user.email}</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder={t.fullName} style={inp}/>
          <input value={company} onChange={e=>setCompany(e.target.value)} placeholder={t.company} style={inp}/>
          <Btn cs={cs} style={{width:"100%"}} onClick={save} disabled={saving}>{saving?(isAr?"جاري الحفظ...":"Saving..."):t.save}</Btn>
        </div>
        <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:13,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,color:cs.text,marginBottom:14}}>{t.profileStats||"Statistics"}</div>
          {[[t.totalSess,sessions.length],[t.avgScore,avgScore+"/100"],[t.planLabel||"Plan",(profile?.tier||"standard").toUpperCase()],[t.memberSince,profile?.created_at?.toDate?.()?.toLocaleDateString?.()||"—"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`0.5px solid ${cs.border}`}}>
              <span style={{fontSize:12,color:cs.muted}}>{k}</span><span style={{fontSize:12,fontWeight:600,color:cs.text}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:13,padding:20,marginBottom:13}}>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:11}}>
          <span style={{fontSize:20}}>🤝</span>
          <div><div style={{fontSize:12,fontWeight:700,color:cs.text}}>{t.referral}</div><div style={{fontSize:11,color:cs.muted}}>{t.referralDesc}</div></div>
        </div>
        <div style={{display:"flex",gap:7}}>
          <div style={{flex:1,background:cs.inp,border:`0.5px solid ${cs.inpB}`,borderRadius:8,padding:"8px 11px",fontSize:10,color:cs.muted,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{refLink}</div>
          <Btn cs={cs} onClick={()=>{navigator.clipboard.writeText(refLink);addToast(t.copied,"success");}} style={{padding:"8px 13px",fontSize:11,flexShrink:0}}>{t.copyLink}</Btn>
        </div>
      </div>
      {sessions.length>0&&<div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:13,padding:20,marginBottom:13}}>
        <div style={{fontSize:12,fontWeight:700,color:cs.text,marginBottom:13}}>{t.sessionHist||"Session History"}</div>
        <BarChart data={sessions.slice(-10).map((s,i)=>({l:`S${i+1}`,v:s.avg_score||0}))} color="#1a56db" cs={cs}/>
        <div style={{marginTop:13,display:"grid",gap:5}}>
          {sessions.slice(0,5).map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 0",borderBottom:`0.5px solid ${cs.border}`}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:sc(s.avg_score||0),flexShrink:0}}/>
              <span style={{fontSize:10,color:cs.muted,flex:1}}>{s.created_at?.toDate?.()?.toLocaleDateString?.()}</span>
              <span style={{fontSize:10,color:cs.muted}}>{s.mode} · {s.tier}</span>
              <span style={{fontSize:11,fontWeight:700,color:sc(s.avg_score||0)}}>{s.avg_score||0}/100</span>
            </div>
          ))}
        </div>
      </div>}
      {/* Cancel Subscription */}
      {profile?.tier&&profile.tier!=="standard"&&<CancelSubscriptionCard profile={profile} user={user} cs={cs} addToast={addToast} isAr={isAr}/>}
    </div>
  </div>;
}

// ── Payment Success / Cancelled Screen ───────────────────────────
function PaymentResultScreen({result, cs, lang, onContinue}){
  const isAr=lang==="ar";
  const isSuccess=result==="success";
  return(
    <div style={{minHeight:"100vh",background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"system-ui,sans-serif"}}>
      <div style={{maxWidth:460,width:"100%",textAlign:"center"}}>
        <div style={{
          width:72,height:72,borderRadius:"50%",margin:"0 auto 20px",
          background:isSuccess?"rgba(16,185,129,.12)":"rgba(239,68,68,.08)",
          border:`0.5px solid ${isSuccess?"rgba(16,185,129,.3)":"rgba(239,68,68,.2)"}`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,
          animation:"payment-pop .5s cubic-bezier(.16,1,.3,1)",
        }}>{isSuccess?"🎉":"✕"}</div>
        <h2 style={{fontSize:22,fontWeight:800,color:cs.text,marginBottom:10,letterSpacing:"-.5px"}}>
          {isSuccess?(isAr?"تم تفعيل اشتراكك!":"Subscription Activated!"):(isAr?"تم إلغاء الدفع":"Payment Cancelled")}
        </h2>
        <p style={{fontSize:14,color:cs.muted,lineHeight:1.75,marginBottom:28,maxWidth:340,margin:"0 auto 28px"}}>
          {isSuccess
            ?(isAr?"خطتك الجديدة نشطة الآن. يمكنك بدء مراقبة وضعيتك فوراً.":"Your new plan is active. You can start monitoring your posture right away.")
            :(isAr?"لم يتم خصم أي مبلغ من حسابك. يمكنك اختيار خطة في أي وقت.":"No charge was made. You can choose a plan anytime.")}
        </p>
        {isSuccess&&(
          <div style={{background:"rgba(16,185,129,.06)",border:"0.5px solid rgba(16,185,129,.2)",borderRadius:14,padding:"16px 20px",marginBottom:24,textAlign:isAr?"right":"left"}}>
            {[
              isAr?"✓ تحليل الوضعية بالذكاء الاصطناعي":"✓ AI posture analysis activated",
              isAr?"✓ إشعارات Slack وTeams":"✓ Slack & Teams notifications",
              isAr?"✓ تقارير HR الشهرية":"✓ Monthly HR reports",
            ].map((item,i)=>(
              <div key={i} style={{fontSize:12,color:"#6ee7b7",fontWeight:500,padding:"3px 0"}}>{item}</div>
            ))}
          </div>
        )}
        <button onClick={onContinue} style={{
          background:"linear-gradient(135deg,#1a56db,#0891b2)",
          border:"none",borderRadius:10,padding:"13px 32px",
          fontSize:14,fontWeight:700,color:"#fff",cursor:"pointer",
          boxShadow:"0 6px 24px rgba(26,86,219,.35)",
        }}>
          {isSuccess?(isAr?"ابدأ جلستك الأولى ←":"Start Your First Session →"):(isAr?"العودة إلى التطبيق":"Back to App")}
        </button>
      </div>
      <style>{`@keyframes payment-pop{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

// ── Cancel Subscription — inline confirm (no window.confirm) ──────
function CancelSubscriptionCard({profile,user,cs,addToast,isAr}){
  const[step,setStep]=useState(0); // 0=idle 1=confirm 2=done
  const[loading,setLoading]=useState(false);
  const t={
    title:   isAr?"⚠️ إلغاء الاشتراك":"⚠️ Cancel Subscription",
    desc:    isAr?`سيتم إلغاء خطة ${profile.tier}. ستحتفظ بالوصول حتى نهاية فترة الفوترة ثم تعود للخطة المجانية.`:`Your ${profile.tier} plan will be cancelled. You'll keep access until the end of your billing period, then revert to Standard.`,
    btn:     isAr?"إلغاء الاشتراك":"Cancel subscription",
    sure:    isAr?"هل أنت متأكد؟ هذا لا يمكن التراجع عنه.":"Are you sure? This cannot be undone.",
    confirm: isAr?"تأكيد الإلغاء":"Yes, cancel",
    back:    isAr?"لا، ابقَ":"No, keep it",
    done:    isAr?"تم إرسال طلب الإلغاء — سيتم المعالجة خلال 24 ساعة":"Cancellation request sent — admin will process within 24h",
  };
  const doCancel=async()=>{
    setLoading(true);
    try{
      await EmailAPI.invoice({email:user.email,name:profile.name,tier:profile.tier,amount:0,billing:"cancelled",seats:25,ref:"CANCEL-"+Date.now()});
    }catch{}
    addToast(t.done,"info");
    setStep(2);
    setLoading(false);
  };
  if(step===2)return(
    <div style={{background:"rgba(16,185,129,.05)",border:"0.5px solid rgba(16,185,129,.2)",borderRadius:13,padding:16,marginBottom:13,textAlign:"center"}}>
      <div style={{fontSize:20,marginBottom:6}}>✓</div>
      <div style={{fontSize:12,color:"#6ee7b7"}}>{t.done}</div>
    </div>
  );
  return(
    <div style={{background:"rgba(239,68,68,.04)",border:"0.5px solid rgba(239,68,68,.2)",borderRadius:13,padding:18,marginBottom:13}}>
      <div style={{fontSize:12,fontWeight:700,color:"#fca5a5",marginBottom:6}}>{t.title}</div>
      <div style={{fontSize:11,color:cs.muted,marginBottom:12,lineHeight:1.6}}>{t.desc}</div>
      {step===0&&<button onClick={()=>setStep(1)} style={{background:"rgba(239,68,68,.1)",border:"0.5px solid rgba(239,68,68,.3)",borderRadius:8,padding:"8px 16px",fontSize:11,color:"#fca5a5",cursor:"pointer",fontWeight:600}}>{t.btn}</button>}
      {step===1&&<div>
        <div style={{fontSize:12,fontWeight:600,color:"#fca5a5",marginBottom:10}}>{t.sure}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>setStep(0)} style={{background:"rgba(148,163,184,.1)",border:"0.5px solid rgba(148,163,184,.2)",borderRadius:8,padding:"8px 14px",fontSize:11,color:cs.muted,cursor:"pointer",fontWeight:600}}>{t.back}</button>
          <button onClick={doCancel} disabled={loading} style={{background:"rgba(239,68,68,.15)",border:"0.5px solid rgba(239,68,68,.4)",borderRadius:8,padding:"8px 14px",fontSize:11,color:"#fca5a5",cursor:loading?"not-allowed":"pointer",fontWeight:700,opacity:loading?.7:1}}>
            {loading?"...":`${t.confirm}`}
          </button>
        </div>
      </div>}
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────
function Leaderboard({users,cs,t,onBack,lang}){
  const[deptFilter,setDeptFilter]=useState("all");
  const isAr=lang==="ar";
  const depts=["all",...new Set(users.map(u=>u.department||u.company||"").filter(Boolean))];
  const filtered=users.filter(u=>deptFilter==="all"||(u.department||u.company||"")=== deptFilter);
  const sorted=[...filtered].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0));
  const medals=["🥇","🥈","🥉"];
  return <div dir={isAr?"rtl":"ltr"} style={{minHeight:"100vh",background:cs.bg,fontFamily:"system-ui,sans-serif",overflowY:"auto"}}>
    <div style={{maxWidth:700,margin:"0 auto",padding:"24px 17px 52px"}}>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:18,flexDirection:isAr?"row-reverse":"row"}}>
        <button onClick={onBack} style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:7,padding:"7px 14px",fontSize:11,color:cs.muted,cursor:"pointer"}}>{t.backToApp}</button>
        <div style={{fontSize:15,fontWeight:700,color:cs.text}}>🏆 {t.leaderboard}</div>
        <div style={{marginLeft:"auto",fontSize:10,color:cs.muted}}>{sorted.length} {isAr?"موظف":"employees"}</div>
      </div>
      {depts.length>2&&<div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",flexDirection:isAr?"row-reverse":"row"}}>
        {depts.map(d=><button key={d} onClick={()=>setDeptFilter(d)}
          style={{background:deptFilter===d?cs.blue:"transparent",color:deptFilter===d?"white":cs.muted,
            border:`0.5px solid ${deptFilter===d?cs.blue:cs.border}`,borderRadius:99,padding:"4px 12px",fontSize:10,cursor:"pointer"}}>
          {d==="all"?(isAr?"الكل":"All"):d}
        </button>)}
      </div>}
      <div style={{display:"grid",gap:7}}>
        {sorted.map((u,i)=>(
          <div key={u.id||i} style={{background:cs.card,border:`0.5px solid ${i<3?"rgba(245,158,11,.3)":cs.border}`,borderRadius:11,padding:"11px 16px",display:"flex",alignItems:"center",gap:11,flexDirection:isAr?"row-reverse":"row"}}>
            <div style={{fontSize:i<3?20:12,width:28,textAlign:"center",flexShrink:0}}>{i<3?medals[i]:<span style={{color:cs.muted,fontWeight:700}}>#{i+1}</span>}</div>
            <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${sc(u.avg_score||50)},#0891b2)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"white",flexShrink:0}}>{(u.name||u.email||"?")[0].toUpperCase()}</div>
            <div style={{flex:1,textAlign:isAr?"right":"left"}}>
              <div style={{fontSize:12,fontWeight:600,color:cs.text}}>{u.name||"Anonymous"}</div>
              <div style={{fontSize:10,color:cs.muted}}>{u.department||u.company||"—"}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:isAr?"flex-start":"flex-end",gap:2}}>
              <div style={{fontSize:20,fontWeight:700,color:sc(u.avg_score||0)}}>{u.avg_score||"—"}</div>
              <div style={{fontSize:8,color:cs.muted,background:sc(u.avg_score||0)+"18",padding:"1px 6px",borderRadius:99}}>{u.avg_score>=85?"Excellent":u.avg_score>=70?"Good":u.avg_score>=50?"Fair":"—"}</div>
            </div>
          </div>
        ))}
        {sorted.length===0&&<EmptyState
          icon="🏆"
          title={isAr?"لا يوجد بيانات بعد":"No data yet"}
          desc={isAr?"ابدأ جلسة لتظهر هنا في المتصدرين":"Start a session to appear on the leaderboard"}
          cs={cs}
        />}
      </div>
    </div>
  </div>;
}

// ── Admin Dashboard ───────────────────────────────────────────────
function Admin({adminUser,cs,t,onBack,addToast,lang}){
  const isAr=lang==="ar";
  const[tab,setTab]=useState("pending");
  const[payments,setPayments]=useState([]);
  const[users,setUsers]=useState([]);
  const[loading,setLoading]=useState(false);
  const[proc,setProc]=useState(null);
  const[modal,setModal]=useState(null);
  const[reason,setReason]=useState("");
  const[search,setSearch]=useState("");
  const[filter,setFilter]=useState("all");
  const[selected,setSelected]=useState([]);
  const[aiSum,setAiSum]=useState(null);

  async function load(){
    setLoading(true);
    if(tab!=="users"){const p=await getAllPayments(tab==="pending"?"pending":null);setPayments(p);}
    else{const u=await getAllUsers();setUsers(u);}
    setLoading(false);
  }
  useEffect(()=>{load();},[tab]);
  useEffect(()=>{
    if(tab==="pending"&&payments.length>0&&!aiSum){
      const s=`${payments.length} pending payments totaling ${payments.reduce((a,p)=>a+(p.amount||0),0)} EGP`;
      askGemini(`Summarize in 1 sentence for SaaS admin: ${s}`).then(setAiSum);
    }
  },[payments,tab]);

  async function doConfirm(pay){
    setProc(pay.id);
    await confirmPayment(pay.id,pay.uid,pay.tier,pay.billing_cycle==="yearly"?12:1);
    // Send invoice email automatically
    EmailAPI.invoice({email:pay.user_email,name:pay.user_name,tier:pay.tier,
        amount:pay.amount,billing:pay.billing_cycle,seats:pay.seats||25,
        ref:pay.ref_code||"AUTO"}).catch(()=>{});
    PaymentAPI.notifyConfirmed(pay).catch(()=>{});
    // Mark coupon as used
    if(pay.coupon)PaymentAPI.validateCoupon({code:pay.coupon}).catch(()=>{});
    addToast("✅ Confirmed — Invoice sent to "+pay.user_email,"success");await load();setProc(null);
  }
  async function doReject(){
    setProc(modal.id);
    await rejectPayment(modal.id,reason||"Not verified");
    addToast("Rejected","warn");setModal(null);setReason("");await load();setProc(null);
  }
  async function bulkConfirm(){
    for(const pid of selected){const pay=payments.find(p=>p.id===pid);if(pay)await doConfirm(pay);}
    setSelected([]);addToast(`${selected.length} confirmed`,"success");
  }
  function exportCSV(data,filename){
    if(!data.length)return;
    const h=Object.keys(data[0]).join(",");const rows=data.map(r=>Object.values(r).map(v=>JSON.stringify(v||"")).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([h+"\n"+rows],{type:"text/csv"}));a.download=filename;a.click();addToast("CSV exported","success");
  }

  const tCol=x=>x==="elite"?"#10b981":x==="professional"?"#0ea5e9":"#6366f1";
  const sBg=x=>x==="confirmed"?"rgba(16,185,129,.1)":x==="rejected"?"rgba(239,68,68,.1)":"rgba(245,158,11,.1)";
  const sCol=x=>x==="confirmed"?"#6ee7b7":x==="rejected"?"#fca5a5":"#fcd34d";
  const totalRev=payments.filter(p=>p.status==="confirmed").reduce((a,p)=>a+(p.amount||0),0);

  const filtPays=payments.filter(p=>{
    if(filter!=="all"&&p.status!==filter)return false;
    if(search&&!p.user_email?.includes(search)&&!p.user_name?.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });
  const filtUsers=users.filter(u=>!search||u.email?.includes(search)||u.name?.toLowerCase().includes(search.toLowerCase()));

  const now=new Date();
  const revData=Array.from({length:6},(_,i)=>{
    const d=new Date(now);d.setMonth(d.getMonth()-5+i);
    const dm=d.getMonth(), dy=d.getFullYear();
    return{l:d.toLocaleString("default",{month:"short"}),v:payments.filter(p=>{
      const pd=p.created_at?.toDate?.();
      return p.status==="confirmed"&&pd&&pd.getMonth()===dm&&pd.getFullYear()===dy;
    }).reduce((a,p)=>a+(p.amount||0),0)};
  });

  return <div style={{minHeight:"100vh",background:cs.bg,color:cs.text,fontFamily:"system-ui,sans-serif"}}>
    {modal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
      <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:14,padding:22,width:340}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:11}}>{isAr?"رفض الدفعة":"Reject Payment"}</div>
        <div style={{fontSize:11,color:cs.muted,marginBottom:9}}>{modal.user_name} · {modal.amount?.toLocaleString()} EGP</div>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder={isAr?"السبب (اختياري)":"Reason (optional)"}
          style={{width:"100%",background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:8,padding:"9px 11px",fontSize:12,color:cs.text,resize:"none",height:70,boxSizing:"border-box",outline:"none",marginBottom:11}}/>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>{setModal(null);setReason("");}} style={{flex:1,background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:8,padding:9,fontSize:12,color:cs.muted,cursor:"pointer"}}>Cancel</button>
          <button onClick={doReject} style={{flex:1,background:"rgba(239,68,68,.15)",border:"0.5px solid rgba(239,68,68,.3)",borderRadius:8,padding:9,fontSize:12,fontWeight:600,color:"#fca5a5",cursor:"pointer"}}>{t.reject}</button>
        </div>
      </div>
    </div>}

    <div style={{padding:"12px 19px",borderBottom:`0.5px solid ${cs.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:cs.card}}>
      <div style={{display:"flex",alignItems:"center",gap:9}}>
        <div style={{width:25,height:25,background:"linear-gradient(135deg,#1a56db,#0891b2)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>◈</div>
        <div><div style={{fontSize:12,fontWeight:700}}>Corvus Admin</div><div style={{fontSize:9,color:cs.muted}}>{adminUser?.email}</div></div>
      </div>
      <div style={{display:"flex",gap:9,alignItems:"center"}}>
        <div style={{fontSize:12,color:"#10b981",fontWeight:600}}>{totalRev.toLocaleString()} EGP total</div>
        <button onClick={onBack} style={{background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:7,padding:"5px 13px",fontSize:11,color:cs.muted,cursor:"pointer"}}>{t.backToApp}</button>
      </div>
    </div>

    <div style={{display:"flex",borderBottom:`0.5px solid ${cs.border}`,padding:"0 19px",background:cs.card2,overflowX:"auto"}}>
      {[["pending","⏳ "+t.pending],["all","📋 "+t.allPay],["users","👥 "+t.users],["revenue","📊 "+t.revenue]].map(([tt,l])=>(
        <button key={tt} onClick={()=>setTab(tt)} style={{padding:"10px 15px",fontSize:11,fontWeight:600,color:tab===tt?cs.text:cs.muted,background:"none",border:"none",borderBottom:tab===tt?"2px solid #1a56db":"2px solid transparent",cursor:"pointer",whiteSpace:"nowrap"}}>{l}</button>
      ))}
      {aiSum&&tab==="pending"&&<div style={{marginLeft:"auto",alignSelf:"center",fontSize:9,color:"#a5b4fc",fontStyle:"italic",maxWidth:250,padding:"0 9px"}}>{aiSum}</div>}
    </div>

    <div style={{padding:19,maxWidth:1060,margin:"0 auto"}}>
      {(tab!=="revenue")&&<div style={{display:"flex",gap:7,marginBottom:13,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==="users"?(isAr?"بحث المستخدمين...":"Search users..."):(isAr?"بحث الدفعات...":"Search payments...")}
          style={{flex:1,minWidth:170,background:cs.inp,border:`0.5px solid ${cs.inpB}`,borderRadius:8,padding:"8px 11px",fontSize:12,color:cs.text,outline:"none"}}/>
        {tab==="all"&&<select value={filter} onChange={e=>setFilter(e.target.value)} style={{background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:8,padding:"8px 10px",fontSize:11,color:cs.text,cursor:"pointer"}}>
          <option value="all">{isAr?"الكل":"All"}</option><option value="pending">{isAr?"معلق":"Pending"}</option><option value="confirmed">{isAr?"مؤكد":"Confirmed"}</option><option value="rejected">{isAr?"مرفوض":"Rejected"}</option>
        </select>}
        <button onClick={()=>tab==="users"?exportCSV(filtUsers.map(u=>({id:u.id,name:u.name,email:u.email,tier:u.tier,sessions:u.sessions_count})),"users.csv"):exportCSV(filtPays.map(p=>({id:p.id,user:p.user_email,tier:p.tier,amount:p.amount,method:p.payment_method_name,status:p.status,ref:p.ref_code})),"payments.csv")}
          style={{background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:8,padding:"8px 12px",fontSize:11,color:cs.muted,cursor:"pointer",fontWeight:600}}>{t.exportCSV}</button>
        {selected.length>0&&<Btn cs={cs} bg="#10b981" onClick={bulkConfirm} style={{padding:"8px 13px",fontSize:11}}>✓ Confirm {selected.length}</Btn>}
      </div>}

      {loading?<div style={{textAlign:"center",padding:44,color:cs.muted}}><div style={{width:28,height:28,border:"3px solid rgba(148,163,184,.2)",borderTop:"3px solid #1a56db",borderRadius:"50%",margin:"0 auto",animation:"spin 1s linear infinite"}}/></div>:

      tab==="revenue"?(<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:11,marginBottom:18}}>
          {[[totalRev.toLocaleString()+" EGP",isAr?"إجمالي الإيرادات":"Total Revenue","#10b981"],[payments.filter(p=>p.status==="confirmed").length,isAr?"مؤكد":"Confirmed","#6366f1"],[payments.filter(p=>p.status==="pending").length,isAr?"معلق":"Pending","#f59e0b"],[payments.filter(p=>p.status==="rejected").length,isAr?"مرفوض":"Rejected","#ef4444"]].map(([v,l,c])=>(
            <div key={l} style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:12,padding:15}}><div style={{fontSize:9.5,color:cs.muted,marginBottom:4}}>{l}</div><div style={{fontSize:19,fontWeight:700,color:c}}>{v}</div></div>
          ))}
        </div>
        <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:13,padding:19}}>
          <div style={{fontSize:12,fontWeight:700,color:cs.text,marginBottom:13}}>{isAr?"الإيرادات الشهرية (جنيه)":"Monthly Revenue (EGP)"}</div>
          <BarChart data={revData} color="#1a56db" cs={cs}/>
        </div>
      </div>):

      tab==="users"?(<div>
        <div style={{fontSize:11,color:cs.muted,marginBottom:11}}>{filtUsers.length} {isAr?"مستخدم":"users"}</div>
        <div style={{display:"grid",gap:7}}>
          {filtUsers.map(u=>(
            <div key={u.id} style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:11,flexWrap:"wrap"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${tCol(u.tier)},${tCol(u.tier)}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"white",flexShrink:0}}>{(u.name||u.email||"U")[0].toUpperCase()}</div>
              <div style={{flex:"0 0 180px"}}><div style={{fontSize:12,fontWeight:600,color:cs.text}}>{u.name||"—"}</div><div style={{fontSize:10,color:cs.muted}}>{u.email}</div></div>
              <span style={{background:`rgba(${u.tier==="elite"?"16,185,129":u.tier==="professional"?"14,165,233":"99,102,241"},.12)`,color:tCol(u.tier),borderRadius:99,padding:"2px 8px",fontSize:9,fontWeight:700}}>{(u.tier||"standard").toUpperCase()}</span>
              <div style={{fontSize:10,color:cs.muted}}>{u.company||"—"}</div>
              <div style={{fontSize:10,color:cs.muted,marginLeft:"auto"}}>{u.sessions_count||0} {isAr?"جلسة":"sessions"}</div>
              <select onChange={e=>{if(e.target.value){updateUserTier(u.id,e.target.value,null).then(()=>{load();addToast(isAr?"تم تحديث الباقة":"Tier updated","success");});}}} defaultValue="" style={{background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:6,padding:"4px 7px",fontSize:10,color:cs.muted,cursor:"pointer"}}>
                <option value="">{isAr?"تغيير الباقة...":"Change tier..."}</option><option value="standard">Standard</option><option value="professional">Professional</option><option value="elite">Elite</option>
              </select>
            </div>
          ))}
        </div>
      </div>):

      (<div>
        {filtPays.filter(p=>p.status==="pending").length>0&&<div style={{display:"flex",alignItems:"center",gap:7,marginBottom:11}}>
          <label style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:cs.muted,cursor:"pointer"}}>
            <input type="checkbox" onChange={e=>setSelected(e.target.checked?filtPays.filter(p=>p.status==="pending").map(p=>p.id):[])}/>{t.selectAll}
          </label>
          <div style={{fontSize:11,color:cs.muted}}>{filtPays.filter(p=>p.status==="pending").length} {isAr?"معلق":"pending"}</div>
        </div>}
        {filtPays.length===0?<div style={{textAlign:"center",padding:40,color:cs.muted,background:cs.card,borderRadius:11,fontSize:12}}>No payments found</div>:
        <div style={{display:"grid",gap:8}}>
          {filtPays.map(pay=>(
            <div key={pay.id} style={{background:cs.card,border:`0.5px solid ${pay.status==="pending"?cs.border:pay.status==="confirmed"?"rgba(16,185,129,.25)":"rgba(239,68,68,.2)"}`,borderRadius:11,padding:"12px 16px"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:11,flexWrap:"wrap"}}>
                {pay.status==="pending"&&<input type="checkbox" checked={selected.includes(pay.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,pay.id]:prev.filter(id=>id!==pay.id))} style={{marginTop:3,flexShrink:0}}/>}
                <div style={{flex:"1 1 200px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
                    <div style={{fontSize:13,fontWeight:700,color:cs.text}}>{pay.user_name||pay.user_email}</div>
                    <span style={{background:`rgba(${pay.tier==="elite"?"16,185,129":pay.tier==="professional"?"14,165,233":"99,102,241"},.12)`,color:tCol(pay.tier),borderRadius:99,padding:"1px 7px",fontSize:8.5,fontWeight:700}}>{(pay.tier||"").toUpperCase()}</span>
                    <span style={{background:sBg(pay.status),color:sCol(pay.status),borderRadius:99,padding:"1px 7px",fontSize:8.5,fontWeight:600}}>{pay.status?.toUpperCase()}</span>
                  </div>
                  <div style={{fontSize:10,color:cs.muted,lineHeight:1.7}}>
                    {pay.user_email} · {pay.company||"—"}<br/>
                    {pay.payment_method_name} · <strong style={{color:cs.text}}>{pay.amount?.toLocaleString()} EGP/{pay.billing_cycle==="yearly"?"yr":"mo"}</strong><br/>
                    <span style={{fontFamily:"monospace",color:"#a5b4fc"}}>Ref: {pay.ref_code}</span>
                    {pay.coupon&&<span style={{color:"#6ee7b7",marginLeft:7}}>🏷 {pay.coupon}</span>}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end",flexShrink:0}}>
                  <div style={{fontSize:9,color:cs.muted}}>{pay.created_at?.toDate?.()?.toLocaleString?.()}</div>
                  {pay.status==="pending"&&<div style={{display:"flex",gap:5}}>
                    <button onClick={()=>doConfirm(pay)} disabled={proc===pay.id} style={{background:"rgba(16,185,129,.15)",border:"0.5px solid rgba(16,185,129,.35)",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,color:"#6ee7b7",cursor:"pointer"}}>{proc===pay.id?"...":t.confirm}</button>
                    <button onClick={()=>setModal(pay)} style={{background:"rgba(239,68,68,.1)",border:"0.5px solid rgba(239,68,68,.25)",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,color:"#fca5a5",cursor:"pointer"}}>{t.reject}</button>
                  </div>}
                </div>
              </div>
            </div>
          ))}
        </div>}
      </div>)}
    </div>
  </div>;
}

// ── Pricing Page — Automatic PayMob only ─────────────────────────
function Pricing({user,profile,cs,t,onBack,onPaid,initialPlan,initialBilling,addToast,lang}){
  const isAr=lang==="ar";
  const[selTier,setSelTier]=useState(initialPlan||"professional");
  const[billing,setBilling]=useState(initialBilling||"monthly");
  const[seats,setSeats]=useState(profile?.seats||25);
  const[payMethod,setPayMethod]=useState("visa_card");
  const[step,setStep]=useState(initialPlan?"method":"plan");
  const[paymentId,setPaymentId]=useState(null);
  const[proc,setProc]=useState(false);
  const[aiTip,setAiTip]=useState(null);
  const[paymobUrl,setPaymobUrl]=useState(null);
  const[walletNumber,setWalletNumber]=useState("");
  const[walletStep,setWalletStep]=useState(false);
  const[coupon,setCoupon]=useState("");
  const[couponData,setCouponData]=useState(null);
  const[couponErr,setCouponErr]=useState("");
  const[couponChecking,setCouponChecking]=useState(false);
  const[referralDiscount,setReferralDiscount]=useState(null);

  // Persist paymob URL across accidental back-navigations
  useEffect(()=>{
    const saved=sessionStorage.getItem("paymob_pending_url");
    const savedStep=sessionStorage.getItem("paymob_pending_step");
    if(saved&&savedStep==="paymob"){setPaymobUrl(saved);setStep("paymob");}
  },[]);

  // Auto-apply referral discount from URL
  useEffect(()=>{
    if(window.__referral_code){
      getReferralDiscount(window.__referral_code).then(d=>{
        if(d){setReferralDiscount(d);addToast("✓ Referral discount applied: 20% off","success");}
      }).catch(()=>{});
    }
  },[]);

  // Debounced coupon validation — fires 600ms after user stops typing
  useEffect(()=>{
    if(!coupon.trim()){setCouponData(null);setCouponErr("");return;}
    const id=setTimeout(async()=>{
      setCouponChecking(true);
      try{
        const r=await PaymentAPI.validateCoupon({code:coupon.trim().toUpperCase()});
        const d=await r.json();
        if(d.valid){setCouponData({discount:d.discount,label:d.label});setCouponErr("");}
        else{setCouponErr(t.couponBad);setCouponData(null);}
      }catch{setCouponErr(isAr?"الباك اند مش شغال":"Backend offline");setCouponData(null);}
      setCouponChecking(false);
    },600);
    return()=>clearTimeout(id);
  },[coupon]);

  const tier=TIERS[selTier] || TIERS["standard"];
  const basePrice=billing==="monthly"?tier.price_monthly:tier.price_yearly;
  // B2C: no seat-based pricing
  const subtotal=basePrice?Math.round(basePrice):null;
  const disc=couponData?couponData.discount:(referralDiscount?referralDiscount.discount_pct:0);
  const price=subtotal?Math.round(subtotal*(1-disc/100)):null;
  const seatAddon=0; // B2C: no seat addon

  useEffect(()=>{
    if(step==="plan"&&price&&price>0){
      askGemini(`In 2 sentences, why is ${tier.name} Corvus at ${price} EGP/${billing==="monthly"?"month":"year"} good ROI for Egyptian companies? Focus on sick-leave cost savings.`).then(setAiTip);
    }
  },[selTier,billing,seats,step]);

  // applyCoupon now just triggers the debounce via setCoupon
  async function applyCoupon(){
    const code=coupon.trim().toUpperCase();
    if(!code){setCouponErr(t.couponBad);return;}
    // Force immediate check
    setCouponChecking(true);
    try{
      const r=await PaymentAPI.validateCoupon({code});
      const d=await r.json();
      if(d.valid){setCouponData({discount:d.discount,label:d.label});setCouponErr("");addToast(t.couponOK+` (${d.label})`,"success");}
      else{setCouponErr(t.couponBad);setCouponData(null);}
    }catch{setCouponErr(isAr?"الباك اند مش شغال":"Backend offline");setCouponData(null);}
    setCouponChecking(false);
  }

  async function doPayMob(){
    setProc(true);
    if(payMethod==="vodafone_cash"&&!walletNumber){setWalletStep(true);setProc(false);return;}
    const payType=payMethod==="vodafone_cash"?"mobile_wallet":"card";
    const result=await initPayMob({
      amount_egp:price,tier:selTier,user_email:user.email,
      user_name:profile?.name||"",billing,payment_type:payType,
      wallet_number:walletNumber,seats});
    if(result?.type==="wallet"&&result?.url){
      window.open(result.url,"_blank");
      const pid=await recordPayment(user.uid,{
        tier:selTier,amount:price,currency:"EGP",billing_cycle:billing,
        payment_method:payMethod,ref_code:"AUTO-"+Date.now(),
        user_email:user.email,user_name:profile?.name||"",
        company:profile?.company||"",coupon:couponData?.label||null,seats,
        status:"pending",auto:true});
      setPaymentId(pid);
      PaymentAPI.notifyPayment({tier:selTier,amount:price,user_email:user.email,
          payment_method:payMethod,auto:true,seats}).catch(()=>{});
      setStep("waiting");
    }else if(result?.type==="card"&&result?.url){
      // Save to sessionStorage so Back button doesn't lose state
      sessionStorage.setItem("paymob_pending_url",result.url);
      sessionStorage.setItem("paymob_pending_step","paymob");
      setPaymobUrl(result.url);setStep("paymob");
    }else{
      addToast(isAr?"تأكد من ضبط PayMob في الباك اند":"PayMob not configured — check backend/.env","error");
    }
    setProc(false);
  }

  if(step==="waiting")return <Waiting paymentId={paymentId} payMethod={payMethod} amount={price}
    tier={selTier} refCode={""} onSuccess={()=>{sessionStorage.removeItem("paymob_pending_url");sessionStorage.removeItem("paymob_pending_step");onPaid();}} cs={cs} t={t}/>;

  if(step==="paymob")return <div style={{minHeight:"100vh",background:cs.bg,display:"flex",flexDirection:"column",fontFamily:"system-ui,sans-serif"}}>
    <div style={{padding:"12px 18px",borderBottom:`0.5px solid ${cs.border}`,display:"flex",alignItems:"center",gap:11,background:cs.card}}>
      <button onClick={()=>{sessionStorage.removeItem("paymob_pending_url");sessionStorage.removeItem("paymob_pending_step");setStep("method");}} style={{background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:7,padding:"6px 11px",fontSize:11,color:cs.muted,cursor:"pointer"}}>← {isAr?"رجوع":"Back"}</button>
      <div style={{fontSize:12,fontWeight:600,color:cs.text}}>🔒 {isAr?"دفع آمن عبر PayMob":"Secure payment via PayMob"} — {price?.toLocaleString()} EGP</div>
    </div>
    <iframe src={paymobUrl} style={{flex:1,border:"none",width:"100%"}} title="PayMob Checkout"/>
  </div>;

  return <div dir={isAr?"rtl":"ltr"} style={{minHeight:"100vh",background:cs.bg,fontFamily:"system-ui,sans-serif",overflowY:"auto"}}>
    <div style={{maxWidth:880,margin:"0 auto",padding:"24px 17px 52px"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:20,flexDirection:isAr?"row-reverse":"row"}}>
        <button onClick={onBack} style={{background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:7,padding:"6px 12px",fontSize:11,color:cs.muted,cursor:"pointer"}}>{isAr?"← رجوع":"← Back"}</button>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:cs.text}}>{t.choosePlan}</div>
          <div style={{fontSize:10,color:cs.muted}}>{isAr?"7 أيام مجاناً · إلغاء في أي وقت":"7-day free trial · Cancel anytime"} · {SUPPORT_EMAIL}</div>
        </div>
      </div>

      {/* Payment step progress indicator */}
      {(()=>{
        const steps=[
          {key:"plan",   label:isAr?"اختار الباقة":"Choose Plan"},
          {key:"method", label:isAr?"طريقة الدفع":"Payment"},
          {key:"paymob", label:isAr?"إتمام الدفع":"Checkout"},
        ];
        const currentIdx=steps.findIndex(s=>s.key===step);
        return <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:0,marginBottom:22}}>
          {steps.map((s,i)=>(
            <React.Fragment key={s.key}>
              {i>0&&<div style={{width:32,height:1.5,background:i<=currentIdx?cs.blue:cs.border,transition:"background .3s"}}/>}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <div style={{width:24,height:24,borderRadius:"50%",
                  background:i<currentIdx?"rgba(26,86,219,.2)":i===currentIdx?cs.blue:"transparent",
                  border:`2px solid ${i<=currentIdx?cs.blue:cs.border}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:700,color:i===currentIdx?"#fff":i<currentIdx?cs.blue:cs.muted,
                  transition:"all .3s"}}>
                  {i<currentIdx?"✓":i+1}
                </div>
                <div style={{fontSize:9,color:i===currentIdx?cs.text:cs.muted,fontWeight:i===currentIdx?600:400}}>{s.label}</div>
              </div>
            </React.Fragment>
          ))}
        </div>;
      })()}

      {/* Step: plan selection */}
      {step==="plan"&&<>
        {/* Billing toggle */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:22}}>
          <div style={{display:"flex",gap:3,background:"rgba(148,163,184,.07)",borderRadius:10,padding:4}}>
            {[["monthly",t.monthly],["yearly",t.yearly]].map(([b,l])=>(
              <button key={b} onClick={()=>setBilling(b)} style={{padding:"8px 17px",fontSize:12,fontWeight:600,
                color:billing===b?cs.text:cs.muted,background:billing===b?cs.blue:"transparent",
                border:"none",borderRadius:7,cursor:"pointer",position:"relative"}}>
                {l}{b==="yearly"&&<span style={{position:"absolute",top:-8,right:-4,background:"#10b981",color:"white",fontSize:7,fontWeight:700,padding:"1px 5px",borderRadius:99}}>-17%</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tier cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12,marginBottom:24}}>
          {Object.values(TIERS).map(tt=>{
            const sel=selTier===tt.id;
            const mp=billing==="monthly"?tt.price_monthly:tt.price_yearly;
            const addOn=seatsExtra*(billing==="monthly"?5:50);
            const total=mp?Math.round((mp+addOn)*(1-disc/100)):null;
            return <div key={tt.id} onClick={()=>setSelTier(tt.id)}
              style={{background:sel?tt.colorDim:cs.card,border:`${sel?"1.5":"0.5"}px solid ${sel?tt.color+"60":cs.border}`,
                borderRadius:14,padding:"18px 16px",cursor:"pointer",position:"relative",transition:"all .2s",
                textAlign:isAr?"right":"left"}}>
              {tt.badge&&<div style={{position:"absolute",top:-9,left:"50%",transform:"translateX(-50%)",
                background:tt.color,color:"white",fontSize:8,fontWeight:700,padding:"2px 10px",borderRadius:99}}>
                {isAr&&tt.badge==="Most Popular"?"الأشهر":tt.badge}</div>}
              <div style={{fontSize:13,fontWeight:700,color:sel?cs.text:"#94a3b8",marginBottom:2}}>{tt.name}</div>
              <div style={{fontSize:9,color:cs.muted,marginBottom:8}}>{tt.accuracy} accuracy · up to {tt.seats} seats</div>
              <div style={{fontSize:22,fontWeight:700,color:tt.color,marginBottom:4}}>
                {total?<>{total.toLocaleString()}<span style={{fontSize:11,fontWeight:400}}> EGP/{isAr?"شهر":"mo"}</span></>:<span style={{fontSize:14}}>{isAr?"حسب الطلب":"Custom"}</span>}
              </div>
              <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:3}}>
                {tt.features.map((f,i)=><div key={i} style={{fontSize:10,color:cs.muted,display:"flex",gap:5,alignItems:"flex-start",flexDirection:isAr?"row-reverse":"row"}}>
                  <span style={{color:"#10b981",flexShrink:0}}>✓</span>{f}
                </div>)}
              </div>
            </div>;
          })}
        </div>

        {/* Per-seat slider */}
        <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:12,padding:"16px 18px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexDirection:isAr?"row-reverse":"row"}}>
            <div style={{fontSize:12,fontWeight:600,color:cs.text}}>{isAr?"عدد الموظفين":"Number of employees"}</div>
            <div style={{fontSize:16,fontWeight:700,color:cs.blue}}>{seats} {isAr?"موظف":"seats"}</div>
          </div>
          <input type="range" min={5} max={500} step={5} value={seats}
            onChange={e=>setSeats(Number(e.target.value))}
            style={{width:"100%",accentColor:cs.blue}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:cs.muted,marginTop:4}}>
            <span>5</span>
            <span style={{color:"#10b981",fontSize:10}}>{isAr?"أول 25 موظف مشمولين في السعر":"First 25 included in base price"}</span>
            <span>500</span>
          </div>
          {seatsExtra>0&&<div style={{marginTop:8,fontSize:10,color:cs.muted,background:"rgba(99,102,241,.06)",borderRadius:8,padding:"6px 10px"}}>
            {isAr?`${seatsExtra} موظف إضافي × ${billing==="monthly"?5:50} EGP = +${seatAddon.toLocaleString()} EGP`
              :`${seatsExtra} extra seats × ${billing==="monthly"?5:50} EGP = +${seatAddon.toLocaleString()} EGP`}
          </div>}
        </div>

        {/* Coupon */}
        <div style={{marginBottom:6}}>
          <div style={{display:"flex",gap:7,flexDirection:isAr?"row-reverse":"row"}}>
            <div style={{flex:1,position:"relative"}}>
              <input value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())}
                placeholder={isAr?"كود الخصم (سيُطبَّق تلقائياً)":"Coupon code (auto-validates)"}
                style={{width:"100%",boxSizing:"border-box",background:cs.inp,border:`0.5px solid ${couponErr?cs.red:couponData?"rgba(16,185,129,.5)":cs.border}`,
                  borderRadius:8,padding:"9px 30px 9px 12px",fontSize:12,color:cs.text,outline:"none"}}/>
              {couponChecking&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:cs.muted,animation:"spin 0.7s linear infinite"}}>⟳</div>}
              {!couponChecking&&couponData&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#10b981"}}>✓</div>}
              {!couponChecking&&couponErr&&coupon&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#ef4444"}}>✗</div>}
            </div>
            <button onClick={applyCoupon} disabled={couponChecking||!coupon.trim()} style={{background:coupon.trim()?cs.blue:"rgba(148,163,184,.2)",color:"white",border:"none",borderRadius:8,
              padding:"9px 16px",fontSize:11,fontWeight:600,cursor:coupon.trim()?"pointer":"default",transition:"background .2s"}}>{t.applyCoupon}</button>
          </div>
          {couponErr&&<div style={{fontSize:11,color:"#ef4444",marginTop:4}}>{couponErr}</div>}
          {couponData&&<div style={{fontSize:11,color:"#10b981",marginTop:4}}>✓ {couponData.label} {isAr?"مطبّق":"applied"}</div>}
          {referralDiscount&&!couponData&&<div style={{fontSize:11,color:"#10b981",marginTop:4}}>🔗 {isAr?"خصم الإحالة 20% مطبّق":"Referral discount: 20% off applied"}</div>}
        </div>

        {/* Price summary */}
        {price&&<div style={{background:"rgba(99,102,241,.06)",border:"0.5px solid rgba(99,102,241,.2)",borderRadius:11,padding:"14px 16px",marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:cs.muted,marginBottom:4,flexDirection:isAr?"row-reverse":"row"}}>
            <span>{tier.name} ({billing}){seats>25?` + ${seatsExtra} extra seats`:""}</span>
            <span>{subtotal?.toLocaleString()} EGP</span>
          </div>
          {disc>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#10b981",marginBottom:4,flexDirection:isAr?"row-reverse":"row"}}>
            <span>Discount ({disc}%)</span><span>-{(subtotal-price).toLocaleString()} EGP</span>
          </div>}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700,color:cs.text,paddingTop:8,borderTop:`0.5px solid ${cs.border}`,flexDirection:isAr?"row-reverse":"row"}}>
            <span>{isAr?"الإجمالي":"Total"}</span><span style={{color:"#6366f1"}}>{price.toLocaleString()} EGP/{billing==="monthly"?isAr?"شهر":"mo":isAr?"سنة":"yr"}</span>
          </div>
        </div>}

        {/* AI tip */}
        {aiTip&&<div style={{background:"rgba(16,185,129,.05)",border:"0.5px solid rgba(16,185,129,.2)",borderRadius:10,padding:"11px 14px",marginBottom:20,fontSize:11,color:"#94a3b8",lineHeight:1.6}}>
          🤖 {aiTip}
        </div>}

        <Btn cs={cs} style={{width:"100%",padding:"14px 0",fontSize:13}} disabled={!price}
          onClick={()=>setStep("method")}>{t.continuePay}</Btn>
        <div style={{textAlign:"center",marginTop:12,fontSize:10,color:cs.muted}}>
          {isAr?"دفع آمن عبر PayMob · SSL محمي · لا تُحفَظ بيانات البطاقة":"Secure payment via PayMob · SSL encrypted · Card data never stored"}
        </div>
      </>}

      {/* Step: payment method */}
      {step==="method"&&<>
        <div style={{marginBottom:20,fontSize:13,color:cs.muted,textAlign:"center"}}>
          {tier.name} · {price?.toLocaleString()} EGP/{billing==="monthly"?isAr?"شهر":"mo":isAr?"سنة":"yr"} · {seats} {isAr?"موظف":"seats"}
          <button onClick={()=>setStep("plan")} style={{background:"none",border:"none",color:cs.blue,cursor:"pointer",fontSize:11,marginInlineStart:8}}>{isAr?"تغيير":"Change"}</button>
        </div>

        {/* Only 2 automatic methods */}
        <div style={{display:"grid",gap:10,marginBottom:22}}>
          {PAY_METHODS.map(pm=>(
            <div key={pm.id} onClick={()=>setPayMethod(pm.id)}
              style={{background:payMethod===pm.id?`rgba(${pm.id==="visa_card"?"26,86,219":"228,0,43"},.07)`:cs.card,
                border:`${payMethod===pm.id?"1.5":"0.5"}px solid ${payMethod===pm.id?pm.color+"50":cs.border}`,
                borderRadius:12,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",
                gap:12,flexDirection:isAr?"row-reverse":"row"}}>
              <div style={{fontSize:24,flexShrink:0}}>{pm.icon}</div>
              <div style={{flex:1,textAlign:isAr?"right":"left"}}>
                <div style={{fontSize:13,fontWeight:600,color:cs.text}}>{isAr?pm.nameAr:pm.name}</div>
                <div style={{fontSize:10,color:cs.muted,marginTop:2}}>{isAr?pm.descAr:pm.desc}</div>
              </div>
              {pm.instant&&<span style={{background:"rgba(16,185,129,.12)",color:"#10b981",fontSize:8.5,fontWeight:700,padding:"2px 8px",borderRadius:99}}>{isAr?"فوري":"INSTANT"}</span>}
            </div>
          ))}
        </div>

        {/* Vodafone Cash wallet number input */}
        {payMethod==="vodafone_cash"&&walletStep&&<div style={{marginBottom:16}}>
          <input value={walletNumber} onChange={e=>setWalletNumber(e.target.value)}
            placeholder={isAr?"رقم Vodafone Cash (01XXXXXXXXX)":"Vodafone Cash number (01XXXXXXXXX)"}
            style={{width:"100%",background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:8,
              padding:"10px 12px",fontSize:12,color:cs.text,outline:"none"}}/>
        </div>}

        <Btn cs={cs} style={{width:"100%",padding:"14px 0",fontSize:13}} disabled={proc}
          onClick={doPayMob}>{proc?"...":(isAr?`ادفع ${price?.toLocaleString()} EGP`:`Pay ${price?.toLocaleString()} EGP`)}</Btn>

        <div style={{textAlign:"center",marginTop:14,fontSize:10,color:cs.muted}}>
          🔒 {isAr?"مؤمّن بـ PayMob Egypt — PCI DSS compliant":"Secured by PayMob Egypt — PCI DSS compliant"}
        </div>
      </>}
    </div>
  </div>;
}

// ── Upgrade Prompt ────────────────────────────────────────────────
// ── Nav Avatar Dropdown — replaces 10-button header overload ─────
function NavAvatarDropdown({user,profile,cs,lang,isAr,isAdmin,isHRAdmin,onProfile,onLeaderboard,onHR,onAdmin,onSetup,onOnboarding,onSignOut}){
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  const initial=(profile?.name||user?.email||"U")[0].toUpperCase();
  const tierColor=profile?.tier==="elite"?"#10b981":profile?.tier==="professional"?"#0ea5e9":"#6366f1";

  useEffect(()=>{
    const fn=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",fn);
    return()=>document.removeEventListener("mousedown",fn);
  },[]);

  const items=[
    {label:isAr?"الملف الشخصي":"Profile",icon:"👤",onClick:()=>{onProfile();setOpen(false);}},
    {label:isAr?"المتصدرون":"Leaderboard",icon:"🏆",onClick:()=>{onLeaderboard();setOpen(false);}},
    ...(isHRAdmin?[{label:"HR Panel",icon:"🏢",color:"#6ee7b7",onClick:()=>{onHR();setOpen(false);}}]:[]),
    ...(isAdmin?[{label:isAr?"لوحة الإدارة":"Admin",icon:"🛡️",color:"#fca5a5",onClick:()=>{onAdmin();setOpen(false);}}]:[]),
    {label:isAr?"إعدادات الجهاز":"Device Setup",icon:"⚙️",onClick:()=>{onSetup();setOpen(false);}},
    {label:isAr?"معالج الإعداد":"Setup Wizard",icon:"🚀",color:"#60a5fa",onClick:()=>{onOnboarding?.();setOpen(false);}},
    {label:isAr?"تسجيل خروج":"Sign out",icon:"→",onClick:()=>{onSignOut();setOpen(false);}},
  ];

  return(
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:32,height:32,borderRadius:"50%",
        background:`linear-gradient(135deg,${tierColor},${tierColor}88)`,
        border:`2px solid ${open?tierColor:cs.border}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:13,color:"#fff",fontWeight:700,cursor:"pointer",
        transition:"border-color .18s",flexShrink:0,
        position:"relative",
      }} title={profile?.name||user?.email}>
        {initial}
        {profile?.is_trial&&<span style={{position:"absolute",top:-3,right:-3,width:8,height:8,background:"#f59e0b",borderRadius:"50%",border:`1.5px solid ${cs.bg}`}}/>}
      </button>
      {open&&(
        <div style={{
          position:"absolute",top:"calc(100% + 8px)",right:isAr?"auto":0,left:isAr?0:"auto",
          background:cs.card,border:`0.5px solid ${cs.border}`,
          borderRadius:12,minWidth:190,zIndex:9999,
          boxShadow:"0 8px 32px rgba(0,0,0,.18)",overflow:"hidden",
        }}>
          <div style={{padding:"12px 14px",borderBottom:`0.5px solid ${cs.border}`}}>
            <div style={{fontSize:12,fontWeight:600,color:cs.text}}>{profile?.name || profile?.email?.split("@")[0] || user?.email?.split("@")[0] || "User"}</div>
            <div style={{fontSize:10,color:cs.muted,marginTop:2}}>{user?.email}</div>
            {profile?.tier&&<div style={{display:"inline-block",marginTop:5,background:`${tierColor}18`,border:`0.5px solid ${tierColor}40`,borderRadius:99,padding:"1px 8px",fontSize:9,fontWeight:700,color:tierColor}}>{profile.tier.toUpperCase()}{profile.is_trial?" ⏱":""}</div>}
          </div>
          {items.map((item,i)=>(
            <button key={i} onClick={item.onClick} style={{
              width:"100%",background:"none",border:"none",
              padding:"9px 14px",display:"flex",alignItems:"center",gap:9,
              fontSize:12,color:item.color||cs.muted,cursor:"pointer",
              transition:"background .15s",textAlign:isAr?"right":"left",
              flexDirection:isAr?"row-reverse":"row",
            }}
            onMouseEnter={e=>e.currentTarget.style.background=cs.surface||"rgba(148,163,184,.06)"}
            onMouseLeave={e=>e.currentTarget.style.background="none"}>
              <span style={{fontSize:14,flexShrink:0}}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UpgradePrompt({cs,t,reason,onUpgrade,onDismiss}){
  return <div style={{background:"rgba(99,102,241,.07)",border:"0.5px solid rgba(99,102,241,.3)",borderRadius:12,padding:"14px 16px",marginBottom:18,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
    <div>
      <div style={{fontSize:12,fontWeight:700,color:"#a5b4fc",marginBottom:3}}>🚀 {t.upgrade}</div>
      <div style={{fontSize:11,color:cs.muted}}>{reason||"Unlock advanced features with a higher tier"}</div>
    </div>
    <div style={{display:"flex",gap:7}}>
      <Btn cs={cs} onClick={onUpgrade} style={{padding:"7px 14px",fontSize:11}}>{t.upgrade}</Btn>
      <button onClick={onDismiss} style={{background:"none",border:`0.5px solid ${cs.border}`,borderRadius:8,padding:"7px 12px",fontSize:11,color:cs.muted,cursor:"pointer"}}>✕</button>
    </div>
  </div>;
}

// ── Account Type + Device Onboarding ─────────────────────────────
function AccountTypeSelect({cs,t,lang,onSelect}){
  const isAr=lang==="ar";
  const dir=isAr?"rtl":"ltr";
  return <div dir={dir} style={{position:"fixed",inset:0,background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,fontFamily:"system-ui,sans-serif",padding:24}}>
    <div style={{maxWidth:480,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{width:52,height:52,background:"linear-gradient(135deg,#1a56db,#0891b2)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 14px"}}>◈</div>
        <div style={{fontSize:20,fontWeight:700,color:cs.text,marginBottom:6}}>{t.acctType}</div>
        <div style={{fontSize:12,color:cs.muted}}>Corvus</div>
      </div>
      <div style={{display:"grid",gap:14}}>
        {[
          {key:"company", icon:"🏢", title:t.acctCompany, desc:t.acctCompanyDesc, color:"#1a56db"},
          {key:"personal", icon:"👤", title:t.acctPersonal, desc:t.acctPersonalDesc, color:"#0ea5e9"},
        ].map(opt=>(
          <div key={opt.key} onClick={()=>onSelect(opt.key)}
            style={{background:cs.card,border:`1px solid ${cs.border}`,borderRadius:16,padding:"20px 22px",cursor:"pointer",display:"flex",alignItems:"center",gap:16,flexDirection:isAr?"row-reverse":"row",transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=opt.color;e.currentTarget.style.transform="translateY(-2px)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=cs.border;e.currentTarget.style.transform="none";}}>
            <div style={{fontSize:34,flexShrink:0}}>{opt.icon}</div>
            <div style={{textAlign:isAr?"right":"left"}}>
              <div style={{fontSize:15,fontWeight:700,color:cs.text,marginBottom:4}}>{opt.title}</div>
              <div style={{fontSize:12,color:cs.muted,lineHeight:1.5}}>{opt.desc}</div>
            </div>
            <div style={{marginInlineStart:"auto",color:opt.color,fontSize:20,flexShrink:0}}>›</div>
          </div>
        ))}
      </div>
    </div>
  </div>;
}

function DeviceSelect({cs,t,lang,onSelect}){
  const isAr=lang==="ar";
  const dir=isAr?"rtl":"ltr";
  return <div dir={dir} style={{position:"fixed",inset:0,background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,fontFamily:"system-ui,sans-serif",padding:24}}>
    <div style={{maxWidth:480,width:"100%"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{fontSize:20,fontWeight:700,color:cs.text,marginBottom:6}}>{t.deviceType}</div>
        <div style={{fontSize:12,color:cs.muted}}>{isAr?"اختر الجهاز اللي هتستخدمه":"Choose your primary device"}</div>
      </div>
      <div style={{display:"grid",gap:14}}>
        {[
          {key:"laptop", icon:"💻", title:t.deviceLaptop, desc:t.deviceLaptopDesc, color:"#6366f1"},
          {key:"phone",  icon:"📱", title:t.devicePhone,  desc:t.devicePhoneDesc,  color:"#f59e0b"},
        ].map(opt=>(
          <div key={opt.key} onClick={()=>onSelect(opt.key)}
            style={{background:cs.card,border:`1px solid ${cs.border}`,borderRadius:16,padding:"20px 22px",cursor:"pointer",display:"flex",alignItems:"center",gap:16,flexDirection:isAr?"row-reverse":"row",transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=opt.color;e.currentTarget.style.transform="translateY(-2px)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=cs.border;e.currentTarget.style.transform="none";}}>
            <div style={{fontSize:34,flexShrink:0}}>{opt.icon}</div>
            <div style={{textAlign:isAr?"right":"left"}}>
              <div style={{fontSize:15,fontWeight:700,color:cs.text,marginBottom:4}}>{opt.title}</div>
              <div style={{fontSize:12,color:cs.muted,lineHeight:1.5}}>{opt.desc}</div>
            </div>
            <div style={{marginInlineStart:"auto",color:opt.color,fontSize:20,flexShrink:0}}>›</div>
          </div>
        ))}
      </div>
    </div>
  </div>;
}

// ══════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function App(){
  const[user,setUser]=useState(null);
  const[backendDown,setBackendDown]=useState(false);
  const[profile,setProfile]=useState(null);
  const[authChecked,setAuthChecked]=useState(false);
  const[startupError,setStartupError]=useState(null);

  // ── ABSOLUTE SAFETY NET — app MUST unblock within 6s no matter what ──
  useEffect(()=>{
    const t = setTimeout(()=>{
      setAuthChecked(c=>{ if(!c){ console.warn("[App] Auth never resolved — forcing landing"); setPageRaw("landing"); return true; } return c; });
    }, 6000);
    return ()=>clearTimeout(t);
  },[]); // eslint-disable-line
  // ── Hash-based routing — fixes back button & enables deep links ──
  const hashToPage = (h) => h.replace(/^#\/?/, "") || "landing";
  const [page, setPageRaw] = useState(() => {
    const h = window.location.hash;
    return h ? hashToPage(h) : "landing";
  });
  const setPage = (p) => {
    if (p === "live" || p === "setup") {
      window.history.replaceState({}, "", "#" + p);
    } else {
      window.history.pushState({}, "", "#" + p);
    }
    setPageRaw(p);
  };
  // Listen for browser back/forward
  useEffect(() => {
    const onPop = () => setPageRaw(hashToPage(window.location.hash));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const[mode,setMode]=useState(null);
  const[lowLight,setLowLight]=useState(false);
  useEffect(()=>{ lmSmootherRef.current?.reset(); },[mode]);
  const[tier,setTier]=useState(null);
  const[acctType,setAcctType]=useState(profile?.acct_type||null);
  // Sync acctType when profile loads (e.g. after Google login)
  useEffect(()=>{ if(profile?.acct_type&&!acctType) setAcctType(profile.acct_type); },[profile?.acct_type]);; // "company" | "personal"
  const[devicePref,setDevicePref]=useState(null); // "laptop" | "phone"
  const[camActive,setCamActive]=useState(false);
  const[cameraStatus,setCameraStatus]=useState("idle"); // idle | requesting | ready | denied | no-device
  const[mpStatus,setMpStatus]=useState("loading");
  const[analysis,setAnalysis]=useState(null);
  const[history,setHistory]=useState([]);
  const[sessionTime,setSessionTime]=useState(0);
  const[goodF,setGoodF]=useState(0);
  const[totalF,setTotalF]=useState(0);
  const[alertCounts,setAlertCounts]=useState({total:0,neck:0,dist:0});
  const[alerts,setAlerts]=useState([]);
  const[alertMsg,setAlertMsg]=useState({text:"Select mode to begin",type:"info"});
  const[sound,setSound]=useState(true);
  const playPostureAlert=()=>{try{const ac=new(window.AudioContext||window.webkitAudioContext)();[440,360].forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);o.frequency.value=f;g.gain.setValueAtTime(0,ac.currentTime+i*.32);g.gain.linearRampToValueAtTime(.14,ac.currentTime+i*.32+.06);g.gain.linearRampToValueAtTime(0,ac.currentTime+i*.32+.3);o.start();o.stop(ac.currentTime+i*.32+.35);});}catch{}}; // local fallback
  const[sessionId,setSessionId]=useState(null);
  const[aiInsight,setAiInsight]=useState(null);
  const[darkMode,setDarkMode]=useState(()=>{
    try{const v=localStorage.getItem("darkMode");return v!==null?v==="true":true;}catch{return true;}
  });
  const[lang,setLang]=useState(()=>{
    try{return localStorage.getItem("lang")||"en";}catch{return "en";}
  });

  // Persist preferences
  useEffect(()=>{
    try{localStorage.setItem("darkMode",darkMode);}catch{}
    document.body.classList.toggle("dark",  darkMode);
    document.body.classList.toggle("light", !darkMode);
  }, [darkMode]);
  useEffect(()=>{try{localStorage.setItem("lang",lang);}catch{}}, [lang]);
  const { toasts, addToast, dismiss: dismissToast } = useToasts();
  const toast = addToast; // alias
  const isOnline = useOnline();
  const[showOnboard,setShowOnboard]=useState(false);
  const[showCompanyOnboard,setShowCompanyOnboard]=useState(false);
  // ── Trigger onboarding — ONE-TIME for new users only ────────────
  useEffect(()=>{
    if(!user||!profile||page!=="home") return;
    const done = (profile.onboarding_done?.length||0) > 0;
    if(done) return;
    if(profile.acct_type==="company" && !profile.company_id){
      const t=setTimeout(()=>setShowCompanyOnboard(true),800);
      return()=>clearTimeout(t);
    }
    if(profile.acct_type!=="company"){
      const t=setTimeout(()=>setShowOnboard(true),1200);
      return()=>clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.uid, profile?.onboarding_done?.length, profile?.acct_type, profile?.company_id, page]);
  const[userSessions,setUserSessions]=useState([]);
  const[allUsers,setAllUsers]=useState([]);
  const[deepPlan,setDeepPlan]=useState(null);
  const[deepBilling,setDeepBilling]=useState("monthly");
  const[companyId,setCompanyId]=useState(null);
  const[showUpgrade,setShowUpgrade]=useState(false);
  const[upgradeReason,setUpgradeReason]=useState("");
  const[showAcctSelect,setShowAcctSelect]=useState(false);
  const[showDeviceSelect,setShowDeviceSelect]=useState(false);
  const[breakReminder,setBreakReminder]=useState(true);
  const[breakTimerSec,setBreakTimerSec]=useState(0);
  const setBreakTimer = setBreakTimerSec; // alias for legacy references
  const[showDashboard,setShowDashboard]=useState(false);

  // Calibration (personal baseline)
  const[showCalibWizard,setShowCalibWizard]=useState(false);
  const { calibration: savedCalib } = useCalibration(profile?.uid);
  const [calibData, setCalibData] = useState(null);
  useEffect(()=>{ if(savedCalib && !calibData) setCalibData(savedCalib); }, [savedCalib]);

  // Score smoothing
  const { smoothed: smoothedScore, push: pushScore, reset: resetScore } = useScoreSmoothing(5, 0.35);

  // Break timer
  const { showBreak, dismiss: dismissBreak, snooze: snoozeBreak } = useBreakTimer(30, breakReminder);
  const[showBreakAlert,setShowBreakAlert]=useState(false);

  // Sound feedback
  const[muted,setMuted]=useState(false);
  const { alertIfNeeded } = useSoundFeedback(muted);
  const[showCoach,setShowCoach]=useState(false);
  const[showGamification,setShowGamification]=useState(false);
  // AI Intelligence Layer
  const[showAIInsights,setShowAIInsights]=useState(false);
  const[showPredictiveAI,setShowPredictiveAI]=useState(false);
  const[showAIReports,setShowAIReports]=useState(false);
  const[showWorkforceAnalytics,setShowWorkforceAnalytics]=useState(false);
  const[showEnterpriseRBAC,setShowEnterpriseRBAC]=useState(false);
  const[showNotificationsHub,setShowNotificationsHub]=useState(false);
  const[showNPS,setShowNPS]=useState(false);
  const[showAnnualUpsell,setShowAnnualUpsell]=useState(false);
  const[showUsageBilling,setShowUsageBilling]=useState(false);
  const[showChurnPrediction,setShowChurnPrediction]=useState(false);
  const[showCustomerSuccess,setShowCustomerSuccess]=useState(false);
  const[showGrowthHub,setShowGrowthHub]=useState(false);
  const[showSessionComparison,setShowSessionComparison]=useState(false);
  const[showTrendChart,setShowTrendChart]=useState(false);
  const[showShareCard,setShowShareCard]=useState(false);
  const[shareCardData,setShareCardData]=useState(null);
  const[showProductTour,setShowProductTour]=useState(false);
  const[showMFASetup,setShowMFASetup]=useState(false);
  const[showSecurityCenter,setShowSecurityCenter]=useState(false);
  const[showFeatureFlags,setShowFeatureFlags]=useState(false);
  const[showOnboardingAnalytics,setShowOnboardingAnalytics]=useState(false);
  const[showLegalCompliance,setShowLegalCompliance]=useState(false);
  const[showAccountActivity,setShowAccountActivity]=useState(false);
  const[showBillingDashboard,setShowBillingDashboard]=useState(false);
  // Phase 12 — Enterprise Scale
  const[showAPIMarketplace,setShowAPIMarketplace]=useState(false);
  const[showWhiteLabel,setShowWhiteLabel]=useState(false);
  const[showMultiTenant,setShowMultiTenant]=useState(false);
  const[showAuditSystem,setShowAuditSystem]=useState(false);
  const[showEnterpriseAdmin,setShowEnterpriseAdmin]=useState(false);
  // ── Onboarding Wizard trigger ──────────────────────────────────────
  const handleOnboardComplete = useCallback((onboardProfile) => {
    setShowOnboard(false);
    if(user?.uid) {
      updateDoc(doc(db,"users",user.uid),{
        name: onboardProfile?.name || "",
        userType: onboardProfile?.userType || "individual",
        goals: onboardProfile?.goals || [],
        onboarding_done: ["completed"],          // FIX: array not boolean — trigger checks .length
        onboarding_completed_at: new Date().toISOString(),
        setup_complete: true,                    // FIX: prevent re-routing to setup on next login
        updated_at: serverTimestamp(),
      }).then(()=>{
        setProfile(p=>p?({...p,onboarding_done:["completed"],setup_complete:true}):p);
      }).catch(()=>{});
    }
    setPage("home"); // FIX: go to home first, don't force camera
  },[user]);
  const[showBilling,setShowBilling]=useState(false);
  const[rsiData,setRsiData]=useState(null);
  const[showAdmin,setShowAdmin]=useState(false);
  const[showMRR,setShowMRR]=useState(false);
  const[showHelp,setShowHelp]=useState(false);
  const[showChangelog,setShowChangelog]=useState(false);
  const { company } = useCompany(profile);
  // ── SW update banner ───────────────────────────────────────────
  const [swUpdateReady, setSwUpdateReady] = useState(false);
  useEffect(()=>{
    const fn = () => setSwUpdateReady(true);
    window.addEventListener("sw-update-available", fn);
    return () => window.removeEventListener("sw-update-available", fn);
  },[]);
  // Sentry already init in main.jsx; just handle SSO redirect
  useEffect(()=>{ handleSSORedirect().catch(()=>{}); },[]);
  // Handle payment redirect from PayMob/Stripe
  const [paymentResult, setPaymentResult] = useState(null); // null | "success" | "cancelled"
  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const res=p.get("payment");
    if(res==="success"||res==="cancelled"){
      setPaymentResult(res);
      window.history.replaceState({},"","/");
      // Refresh profile so tier is current
      if(res==="success"&&user) getUserProfile(user.uid).then(setProfile).catch(()=>{});
    }
    if(p.get("payment")==="success"){ toast(isAr?"✅ تم تفعيل خطتك!":"✅ Your plan is now active!","success"); }
    if(p.get("payment")==="cancelled"){ toast(isAr?"تم إلغاء الدفع — لم يتم خصم أي مبلغ":"Payment cancelled — no charge made","info"); }
  },[]);

  const cs=darkMode?DARK:LIGHT;
  const t=TR[lang];
  const isAr=lang==="ar";
  const dir=isAr?"rtl":"ltr";

  // Apply direction globally
  useEffect(()=>{
    document.documentElement.dir=dir;
    document.documentElement.lang=lang;
  },[dir,lang]);

  // Update document title on page change
  useEffect(()=>{
    const titles={landing:"Corvus",auth:"Sign In — Corvus",setup:"Setup — Corvus",
      home:"Dashboard — Corvus",live:"Live Session — Corvus",
      profile:"Profile — Corvus",pricing:"Plans — Corvus",
      leaderboard:"Leaderboard — Corvus",admin:"Admin — Corvus",hr:"HR Panel — Corvus"};
    document.title=titles[page]||"Corvus";
  },[page]);

  const vidRef=useRef();const ovRef=useRef();const canvRef=useRef();
  const streamRef=useRef();const timerRef=useRef();const rafRef=useRef();
  const mpRef=useRef();const badRef=useRef(null);const lastAlRef=useRef(0);
  const lmSmootherRef=useRef(null);
  const lightCheckRef=useRef({t:0,canvas:null,wasLow:false});
  const histRef=useRef([]);const goodRef=useRef(0);const totalRef=useRef(0);
  const acRef=useRef({total:0,neck:0,dist:0});const alRef=useRef([]);
  const sessRef=useRef(null);const lastAnalRef=useRef(null);

  const T_=tier?(TIERS[normalizeTier(tier)]||null):null;
  // Normalize T_ so live dashboard always has .name and .color
  const T_norm=T_?{name:T_.name,color:T_.color,colorDim:T_.colorDim||`${T_.color}18`}:null;
  const MC={
    laptop:{id:"laptop",label:"Laptop",color:"#6366f1",optDist:[50,80]},
    phone:{id:"phone",label:"Phone",color:"#f59e0b",optDist:[60,90]},
    side:{id:"side",label:"Side",color:"#10b981",optDist:[80,120]}
  };
  const M_=mode?MC[mode]:null;

  // addToast / toast alias declared above (L1458)

  // URL deep link
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const plan=params.get("plan"),bill=params.get("billing")||"monthly";
    if(plan&&TIERS[plan]){setDeepPlan(plan);setDeepBilling(bill);}
    const ref=params.get("ref");
    if(ref) window.__referral_code=ref;
    // Handle invite token in URL: ?invite=TOKEN
    const inviteToken = params.get("invite");
    if(inviteToken) {
      window.__invite_token = inviteToken;
      setPage("invite");
    }
    // Handle pending invite after login
    const pendingInvite = sessionStorage.getItem("pending_invite");
    if(pendingInvite) window.__invite_token = pendingInvite;
  },[]);

  // Auth state listener
  useEffect(()=>{
    // Safety net: if Firebase never fires (bad config / offline), unblock the UI after 10s
    // Handle Google redirect result (when popup is blocked)
    getGoogleRedirectResult().then(async result => {
      if (result?.user) {
        const u = result.user;
        let p = await getUserProfile(u.uid);
        if (!p) {
          await createUserProfile(u.uid, { email: u.email, name: u.displayName || "", company: "" });
          p = await getUserProfile(u.uid);
        }
        setUser(u);
        setProfile(p);
        if (p?.tier && p.tier !== "standard") setTier(p.tier);
        if (p?.company_id) setCompanyId(p.company_id);
        getUserSessions(u.uid).then(setUserSessions).catch(() => {});
        setPage("home");
        setAuthChecked(true);
      }
    }).catch(() => {});

    const authTimeout=setTimeout(()=>{
      setAuthChecked(c=>{ if(!c){ setPage("landing"); return true; } return c; });
    }, 5000);

    const unsub=onAuthStateChanged(async u=>{
      clearTimeout(authTimeout);
      // ── Elite promo access ─────────────────────────────────
      const ELITE_FREE = [
        "judyayman36@gmail.com",
        "m789pppp@gmail.com",
        "khaled.elgeneidy@tkh.edu.eg",
        "mennatullah.gamal@tkh.edu.eg",
      ];
      try {
        setUser(u);
        if(u){
          // Load profile — never crash
          let p = null;
          try { p = await getUserProfile(u.uid); } catch(e){ console.warn("[Auth] profile:",e?.code); }

          if(!p){
            try {
              await createUserProfile(u.uid,{email:u.email,name:u.displayName||"",company:""});
              p = await getUserProfile(u.uid);
            } catch(e){ console.warn("[Auth] create:",e?.code); }
            try { EmailAPI.sequence({email:u.email,name:u.displayName||u.email.split("@")[0],
              day:0,tier:"professional",session_count:0,avg_score:0}).catch(()=>{}); } catch{}
          } else {
            try { checkAndDowngradeTrial(u.uid).then(checked=>{ if(checked) setProfile(checked); }).catch(()=>{}); } catch{}
            try { checkAndSendNurtureEmails(u.uid, p, API).catch(()=>{}); } catch{}
          }

          // Override tier to elite for promo emails
          if(u.email && ELITE_FREE.includes(u.email.toLowerCase().trim())){
            if(p) p = {...p, tier:"elite"};
            // Persist elite tier to Firestore (fire-and-forget)
            updateUserTier(u.uid,"elite",12).catch(()=>{});
          }

          if(p){
            setProfile(p);
            try { if(p.tier) setTier(normalizeTier(p.tier)); } catch{}
            try { if(p.company_id) setCompanyId(p.company_id); } catch{}
          }

          // Real-time sessions listener
          try {
            if(window.__unsubSessions){ window.__unsubSessions(); window.__unsubSessions=null; }
            const unsubSessions = onUserSessions(u.uid, sessions=>{ setUserSessions(sessions); });
            window.__unsubSessions = unsubSessions;
          } catch(e){ console.warn("[Auth] sessions:",e?.code); }

          // Load team members
          try {
            if(p?.company_id||p?.is_org_owner){
              getAllUsers(p.company_id||null,false).then(setAllUsers).catch(()=>{});
            }
          } catch{}

          try { const lm=localStorage.getItem("last_mode"); if(lm) setMode(lm); } catch{}

          // Navigate
          try {
            const params=new URLSearchParams(window.location.search);
            const pendingInvite=sessionStorage.getItem("pending_invite");
            if(pendingInvite){ window.__invite_token=pendingInvite; setPage("invite"); }
            else if(p && !p.setup_complete) setPage("setup");
            else setPage(params.get("plan")&&TIERS[params.get("plan")]?"pricing":"home");
          } catch{ setPage("home"); }

        } else {
          try { if(window.__unsubSessions){ window.__unsubSessions(); window.__unsubSessions=null; } } catch{}
          setUserSessions([]);
          setPage("landing");
        }
      } catch(e) {
        console.error("[Auth] fatal:", e);
        setPage("landing");
      } finally {
        setAuthChecked(true);
      }
    });
    return ()=>{ unsub(); clearTimeout(authTimeout); };
  },[]);

  // ── SPA navigation from LandingPageV7 ─────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const path = e.detail?.path || '';
      if (path.includes('/auth')) {
        const params = new URLSearchParams(path.split('?')[1] || '');
        const plan = params.get('plan');
        if (plan) setDeepPlan(plan);
        setPage('auth');
      } else if (path === '/app' || path === '/dashboard') {
        setPage('home');
      } else if (path === '/billing') {
        setPage('pricing');
      }
    };
    window.__spaNavigate = (path) => handler({ detail: { path } });
    window.addEventListener('spa:navigate', handler);
    return () => window.removeEventListener('spa:navigate', handler);
  }, []);

  // MediaPipe loader — tries CDN, falls back to backend-only mode
  useEffect(()=>{
    if(mpRef.current||window.__mpLoading)return;
    window.__mpLoading=true;
    const load=async()=>{
      try{
        const mod=await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs");
        const fr=await mod.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
        // "full" model: meaningfully more accurate landmarks than "lite",
        // especially for subtle angles (neck lean, spine lean). GPU
        // delegate is what makes this affordable in real time — CPU alone
        // is why "lite" was chosen originally. Falls back to CPU delegate
        // (still on the "full" model) if GPU isn't available on this device.
        const MODEL="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
        const opts={
          runningMode:"VIDEO",numPoses:1,
          minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5
        };
        let pl;
        try{
          pl=await mod.PoseLandmarker.createFromOptions(fr,{baseOptions:{modelAssetPath:MODEL,delegate:"GPU"},...opts});
        }catch(gpuErr){
          console.warn("GPU delegate unavailable, falling back to CPU:",gpuErr.message);
          pl=await mod.PoseLandmarker.createFromOptions(fr,{baseOptions:{modelAssetPath:MODEL,delegate:"CPU"},...opts});
        }
        mpRef.current=pl;window.__mpPose=pl;setMpStatus("ready");
      }catch(err){
        console.warn("MediaPipe CDN failed, using backend fallback:",err.message);
        setMpStatus("fallback");
      }
    };
    load();
    setTimeout(()=>{if(!mpRef.current&&mpStatus==="loading")setMpStatus("fallback");},18000);
  // eslint-disable-next-line
  },[]);

  // Analysis loop
  const runLoop=useCallback(()=>{
    const vid=vidRef.current,ov=ovRef.current;
    if(!vid||!ov||vid.readyState<2){rafRef.current=requestAnimationFrame(runLoop);return;}
    const W=vid.videoWidth,H=vid.videoHeight;
    if(!W||!H){rafRef.current=requestAnimationFrame(runLoop);return;}
    ov.width=W;ov.height=H;
    const ctx=ov.getContext("2d");ctx.clearRect(0,0,W,H);

    // ── Lighting quality check ─────────────────────────────────────
    // MediaPipe's own landmark "visibility" is the model's internal
    // confidence, not an objective measure of image quality — in low
    // light it can still report decent visibility on subtly-wrong
    // positions. Sample actual frame brightness independently (cheap:
    // downscaled to 24×18 px, throttled to ~1/sec) and warn the user
    // directly instead of silently feeding the engine noisy input.
    const lc=lightCheckRef.current;
    const nowLight=performance.now();
    if(nowLight-lc.t>1000){
      lc.t=nowLight;
      try{
        if(!lc.canvas){lc.canvas=document.createElement("canvas");lc.canvas.width=24;lc.canvas.height=18;}
        const lctx=lc.canvas.getContext("2d",{willReadFrequently:true});
        lctx.drawImage(vid,0,0,24,18);
        const data=lctx.getImageData(0,0,24,18).data;
        let sum=0;
        for(let i=0;i<data.length;i+=4) sum+=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
        const avgLum=sum/(data.length/4); // 0-255
        // Hysteresis: turn warning on below 45, off above 65 — avoids flicker right at the edge
        const nowLow = lc.wasLow ? avgLum<65 : avgLum<45;
        if(nowLow!==lc.wasLow){ lc.wasLow=nowLow; setLowLight(nowLow); }
      }catch{}
    }

    if(mpRef.current){
      try{
        const det=mpRef.current.detectForVideo(vid,performance.now());
        if(det.landmarks?.length>0){
          if(!lmSmootherRef.current) lmSmootherRef.current=createLandmarkSmoother(0.4);
          const lms=lmSmootherRef.current.smooth(det.landmarks[0]);
          totalRef.current++;setTotalF(totalRef.current);
          const result=mode==="side"?analyzeSideMP(lms,W,H):analyzeMP(lms,W,H,mode);
          if(result){
            // Apply personal calibration if available
            let finalResult = result;
            if(calibData?.tolerances) {
              const adjMets = applyCalibration(result.metrics, calibData);
              const vals = Object.values(adjMets).map(m=>m.score||0);
              const calibScore = Math.round(vals.reduce((a,b)=>a+b,0)/Math.max(vals.length,1));
              finalResult = {...result, overall: Math.round(result.overall*.4 + calibScore*.6), metrics: adjMets};
            }
            if(finalResult.overall>=65){goodRef.current++;setGoodF(goodRef.current);}
            const smoothed1=pushScore(finalResult.overall);
            alertIfNeeded(smoothed1||finalResult.overall);
            histRef.current.push(smoothed1||finalResult.overall);
            if(histRef.current.length>40)histRef.current=histRef.current.slice(-40);
            setHistory([...histRef.current]);setAnalysis(finalResult);lastAnalRef.current=finalResult;
            if(mode==="side")drawSide(ctx,finalResult,W,H,isAr);else drawFront(ctx,finalResult,W,H,isAr);
            const now=Date.now();
            const gateScore=smoothed1||finalResult.overall;
            if(lightCheckRef.current.wasLow){
              // Don't trust score-based decisions in poor lighting — neither
              // accumulate nor reset the bad-streak timer, since we can't
              // tell if it's genuinely bad posture or just a bad frame.
              if(now-lastAlRef.current>8000){
                lastAlRef.current=now;
                setAlertMsg({text:isAr?"الإضاءة ضعيفة جدًا — حسّن الإضاءة لقراءة أدق":"Lighting too low — improve lighting for an accurate reading",type:"warn"});
              }
            }else if(gateScore<65){
              if(!badRef.current)badRef.current=now;
              else if(now-badRef.current>15000&&now-lastAlRef.current>30000){
                lastAlRef.current=now;acRef.current.total++;
                const nlMet=finalResult.metrics?.neck_lean, yawMet=finalResult.metrics?.head_yaw;
                const nl=nlMet?.reliable!==false?(nlMet?.value||0):0;
                const yaw=yawMet?.reliable!==false?(yawMet?.value||0):0;
                const dist=finalResult.distCm||0;
                const[lo,hi]=finalResult.lo&&finalResult.hi?[finalResult.lo,finalResult.hi]:[50,80];
                let msg="Sustained poor posture — correct position now";
                let msgAr="وضعية سيئة مستمرة — صحّح وضعيتك الآن";
                if(nl>14){msg=`Neck lean ${nl}° — raise monitor to eye level`;msgAr=`ميل رقبة ${nl}° — ارفع الشاشة لمستوى عينيك`;acRef.current.neck++;}
                else if(Math.abs(yaw)>12){msg=`Head turned ${Math.round(Math.abs(yaw))}° — face the monitor`;msgAr=`الرأس مائل ${Math.round(Math.abs(yaw))}° — واجه الشاشة مباشرة`;}
                else if(dist&&dist<lo){msg=`Too close (${dist}cm) — move to ${lo}–${hi}cm`;msgAr=`قريب جداً (${dist}سم) — ابتعد إلى ${lo}–${hi}سم`;acRef.current.dist++;}
                const displayMsg = isAr ? msgAr : msg;
                setAlertCounts({...acRef.current});
                alRef.current=[{time:new Date().toLocaleTimeString(),msg:displayMsg,msgEn:msg,msgAr,score:finalResult.overall},...alRef.current].slice(0,20);
                setAlerts([...alRef.current]);setAlertMsg({text:displayMsg,type:"warn"});
                if(sound)playBeep();
                sendDesktopNotif(msg,finalResult.overall);
              }
            }else{
              badRef.current=null;
              if(now-lastAlRef.current>8000)setAlertMsg({text:`Score ${finalResult.overall}/100 — ${grade(finalResult.overall,t)}`,type:"good"});
            }
          }
        }
      }catch(e){}
    }
    // Backend call ONLY when actually needed — not a duplicate of local analysis:
    //  1) Fallback mode (local MediaPipe failed to load) → backend IS the analysis
    //  2) Elite tier → snapshots for PDF report + Gemini AI insights
    // Standard/Pro tiers with working local MediaPipe never touch the backend here.
    const needsBackend = mpStatus==="fallback" || tier==="elite" || tier==="premium";
    if(needsBackend && totalRef.current%30===0 && canvRef.current){
      const c=canvRef.current,v2=vidRef.current;
      if(v2&&v2.readyState>=2){c.width=v2.videoWidth;c.height=v2.videoHeight;c.getContext("2d").drawImage(v2,0,0);}
      AnalysisAPI.analyze(c.toDataURL("image/jpeg",.72),mode,tier,lang,sessionId,null,calibData)
        .then(d=>{
          // For Elite: send snapshot every ~12 frames for PDF
          if((tier==="elite"||tier==="premium")&&totalRef.current%12===0&&d.overall>0){
            AnalysisAPI.addSnapshot(sessionId, c.toDataURL("image/jpeg",.6), d.overall||d.score, new Date().toLocaleTimeString())
              .catch(()=>{});
          }
          // Use backend result if local MP not available (fallback mode)
          if(mpStatus==="fallback"&&d.overall>0){
            const result={...d};
            totalRef.current++;setTotalF(totalRef.current);
            if(result.overall>=65){goodRef.current++;setGoodF(goodRef.current);}
            histRef.current.push(result.overall);
            if(histRef.current.length>40)histRef.current=histRef.current.slice(-40);
            setHistory([...histRef.current]);setAnalysis(result);lastAnalRef.current=result;
            const now=Date.now();
            if(result.overall<65){
              if(!badRef.current)badRef.current=now;
              else if(now-badRef.current>15000&&now-lastAlRef.current>30000){
                lastAlRef.current=now;acRef.current.total++;
                const msgFb = isAr
                  ? (result.alerts_ar?.[0] || "وضعية سيئة — صحّح وضعيتك")
                  : (result.alerts?.[0] || "Poor posture — correct position");
                setAlertCounts({...acRef.current});
                alRef.current=[{time:new Date().toLocaleTimeString(),msg:msgFb,score:result.overall},...alRef.current].slice(0,20);
                setAlerts([...alRef.current]);setAlertMsg({text:msgFb,type:"warn"});
                if(sound)playBeep();
                sendDesktopNotif(msgFb,result.overall);
              }
            }else{
              badRef.current=null;
              if(now-lastAlRef.current>8000)setAlertMsg({text:`Score ${result.overall}/100 — ${grade(result.overall,t)}`,type:"good"});
            }
          }
          // Always use Gemini from backend for Elite
          if(d.claude_analysis&&tier==="elite")setAiInsight(d.claude_analysis);
        }).catch(()=>{});
    }
    rafRef.current=requestAnimationFrame(runLoop);
  },[mode,tier,sessionId,sound,t,calibData,pushScore,alertIfNeeded,mpStatus]);

  async function startCamera(){
    setCameraStatus("requesting");
    try{
      const facingMode=mode==="phone"?"environment":"user";
      const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:{ideal:facingMode}}});
      streamRef.current=s;
      if(!vidRef.current){setCameraStatus("idle");return;}
      vidRef.current.srcObject=s;
      await new Promise((res,rej)=>{
        vidRef.current.onloadedmetadata=res;
        setTimeout(rej,8000); // 8s timeout
      }).catch(()=>{});
      if(!vidRef.current){return;}
      setCameraStatus("ready");
      lmSmootherRef.current?.reset();
      // Request notification permission on first session
      requestNotificationPermission();
      let sid="local_"+Date.now();
      try{const d=await AnalysisAPI.startSession(mode,tier);sid=d.session_id||sid;}catch(e){}
      setSessionId(sid);sessRef.current=Date.now();setCamActive(true);
      setAlertMsg({text:`${M_?.label} camera · ${T_norm?.name||"–"} tier active`,type:"info"});
      if(user?.uid) completeOnboardingStep(user.uid,"first_session").catch(()=>{});
      // Calibration is opt-in — user can trigger from settings
      // Removed auto-popup to prevent overlay conflict with camera
      timerRef.current=setInterval(()=>{
        const elapsed=Math.floor((Date.now()-sessRef.current)/1000);
        setSessionTime(elapsed);
        setBreakTimer(bt=>{
          const next=bt+1;
          if(next>=1500&&breakReminder&&!showBreakAlert){
            setShowBreakAlert(true);
            if(!muted)playPostureAlert();
            sendDesktopNotif("Break time! 25 minutes passed — take a 2-min stretch",0);
          }
          return next;
        });
      },1000);
      rafRef.current=requestAnimationFrame(runLoop);
    }catch(e){
      const isDenied=e.name==="NotAllowedError"||e.name==="PermissionDeniedError";
      const noDevice=e.name==="NotFoundError"||e.name==="DevicesNotFoundError";
      setCameraStatus(isDenied?"denied":noDevice?"no-device":"idle");
      const errMsg=isDenied
        ?(isAr?"تم رفض الوصول للكاميرا — اضغط 'سماح' في المتصفح":"Camera access denied — click Allow in browser bar")
        :noDevice
        ?(isAr?"مفيش كاميرا متصلة":"No camera detected — connect one and retry")
        :(isAr?"خطأ في الكاميرا":"Camera error — please retry");
      setAlertMsg({text:errMsg,type:"bad"});
      addToast(errMsg,"error");
    }
  }

  const[sessionResult,setSessionResult]=useState(null);

  async function stopCamera(){
    lmSmootherRef.current?.reset();
    lightCheckRef.current={t:0,canvas:lightCheckRef.current.canvas,wasLow:false};setLowLight(false);
    if(streamRef.current){
      streamRef.current.getTracks().forEach(x=>{x.stop(); x.enabled=false;});
      streamRef.current = null;
    }
    if(timerRef.current)clearInterval(timerRef.current);
    if(rafRef.current)cancelAnimationFrame(rafRef.current);
    if(ovRef.current)ovRef.current.getContext("2d").clearRect(0,0,ovRef.current.width||0,ovRef.current.height||0);
    setCamActive(false);

    // Always save — even if no analysis data (backend offline/MediaPipe not loaded)
    const la  = lastAnalRef.current||{};
    const hist = histRef.current||[];
    const avg  = hist.length ? Math.round(hist.reduce((a,b)=>a+b,0)/hist.length) : 0;
    const dur  = sessRef.current ? Math.floor((Date.now()-sessRef.current)/1000) : 0;
    const gPct = totalRef.current ? Math.round(goodRef.current/totalRef.current*100) : 0;

    const result={
      avg_score:avg,
      duration_s:dur,
      good_pct:gPct,
      alerts_count:acRef.current?.total||0,
      frames:totalRef.current||0,
      top_metric: la.metrics ? Object.entries(la.metrics)
        .filter(([,v])=>v.score<75)
        .sort(([,a],[,b])=>a.score-b.score)[0] : null,
      grade: avg>=85?"Excellent":avg>=70?"Good":avg>=55?"Fair":"Needs work",
      gradeAr: avg>=85?"ممتاز":avg>=70?"جيد":avg>=55?"مقبول":"يحتاج تحسين",
      color: avg>=75?"#10b981":avg>=50?"#f59e0b":"#ef4444",
      // Trend: compare first vs last 20% of frames
      trend: (()=>{
        if(hist.length<10) return "stable";
        const split=Math.max(3,Math.floor(hist.length/5));
        const early=hist.slice(0,split).reduce((a,b)=>a+b,0)/split;
        const late=hist.slice(-split).reduce((a,b)=>a+b,0)/split;
        const diff=late-early;
        return diff>5?"improving":diff<-5?"declining":"stable";
      })(),
      // Improvement tip for worst metric
      improvement_tip: (()=>{
        const tips={
          neck_lean:"Raise your monitor to eye level to reduce neck flexion.",
          spine_lean:"Sit back fully in your chair and use lumbar support.",
          screen_distance:"Move your screen to 50–70cm from your eyes.",
          head_tilt:"Keep your head level — avoid tilting to one side.",
          shoulder_level:"Relax your shoulders down and back, away from your ears.",
          wrist:"Keep wrists straight and elbows at 90° when typing.",
        };
        const tipAr={
          neck_lean:"ارفع الشاشة لمستوى عينيك لتقليل ميل الرقبة.",
          spine_lean:"اجلس للخلف واستخدم دعم أسفل الظهر.",
          screen_distance:"ضع الشاشة على بُعد 50–70 سم من عينيك.",
          head_tilt:"حافظ على استقامة رأسك — تجنب الميل لأحد الجانبين.",
          shoulder_level:"أرخِ كتفيك للأسفل والخلف.",
          wrist:"حافظ على استقامة معصميك وزاوية 90° للكوعين.",
        };
        if(!la.metrics) return isAr?"خذ استراحة وضعية كل 30 دقيقة.":"Take a posture break every 30 minutes.";
        const worst=Object.entries(la.metrics).filter(([,v])=>v.score<75).sort(([,a],[,b])=>a.score-b.score)[0];
        if(!worst) return isAr?"وضعيتك ممتازة! استمر.":"Great posture! Keep it up.";
        return (isAr?tipAr:tips)[worst[0]] || (isAr?"خذ استراحة كل 30 دقيقة.":"Take a break every 30 minutes.");
      })(),
      // Pain prediction
      pain_summary: (()=>{
        const painMins=la.pain_prediction?.minutes_to_pain;
        if(!painMins) return null;
        if(painMins<30) return isAr?`⚠️ توقع إزعاج خلال ${Math.round(painMins)} دقيقة — خذ استراحة الآن`:`⚠️ Discomfort likely in ${Math.round(painMins)} min — take a break now`;
        if(painMins<90) return isAr?`~${Math.round(painMins)} دقيقة قبل الإزعاج المحتمل`:`~${Math.round(painMins)} min before likely discomfort`;
        return null;
      })(),
    };
    setSessionResult(result);
      if((result.avg_score||0)>=70){
        setShareCardData({score:result.avg_score,grade:result.grade,streak:0});
      }

    if(user && dur >= 5){ // Save if session lasted at least 5 seconds
      addToast(isAr?"جاري حفظ الجلسة...":"Saving session...","info");
      saveSession(user.uid,{
        session_id:sessionId, mode, tier, avg_score:avg,
        good_pct:gPct, duration_s:dur, duration_sec:dur,
        alerts_count:acRef.current?.total||0,
        score_history:hist.slice(-20),
        metrics:la.metrics||{}
      }).then(()=>{
        addToast(isAr?"✅ تم حفظ الجلسة":"✅ Session saved","success");
      }).catch(e=>{
        console.error("saveSession failed:", e?.code, e?.message);
        addToast("❌ Save failed: "+(e?.code||e?.message||"unknown"),"error");
      });
    } else if(user && dur < 5){
      addToast(isAr?"الجلسة قصيرة جداً (أقل من 5 ثواني)":"Session too short (under 5s) — not saved","info");
    } else if(!user){
      addToast(isAr?"غير مسجل الدخول":"Not signed in — not saved","error");
    }
  } // end stopCamera

  // ── Multi-Account Switch ────────────────────────────────────────
  async function handleSwitchAccount(linkedAccount) {
    // linkedAccount = { linked_uid, email, display_name, provider }
    // We sign into the secondary Firebase app with a fresh Google popup
    // then use the credential to sign into the PRIMARY app (replacing current user)
    try {
      const { initializeApp: _initApp, getApp: _getApp } = await import("firebase/app");
      const { getAuth: _getAuth, signInWithPopup: _popup, signInWithEmailAndPassword: _signEmail,
              GoogleAuthProvider: _GP, signInWithCredential: _signCred } = await import("firebase/auth");

      // Get or create secondary app
      let secondaryApp;
      try { secondaryApp = _getApp("secondary"); }
      catch { secondaryApp = _initApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      }, "secondary"); }

      const secondaryAuth = _getAuth(secondaryApp);

      if (linkedAccount.provider === "google" || !linkedAccount.provider) {
        const provider = new _GP();
        provider.setCustomParameters({ prompt: "select_account", login_hint: linkedAccount.email });
        addToast(isAr ? "اختر الأكونت من الـ popup..." : "Select account in popup...", "info");
        const result = await _popup(secondaryAuth, provider);
        // Verify it's the right account
        if (result.user.uid !== linkedAccount.linked_uid) {
          addToast(isAr ? "اختار الأكونت الصح من الـ popup" : "Please select the correct account in the popup", "warn");
          await secondaryAuth.signOut();
          return;
        }
        // Now sign into primary auth with the same credential
        const credential = _GP.credentialFromResult(result);
        await secondaryAuth.signOut();
        await _signCred(auth, credential);
      } else {
        // Email account — can't auto-switch without password; show message
        addToast(
          isAr
            ? `للتبديل لـ ${linkedAccount.email} — سجل خروج وادخل بالبريد وكلمة السر`
            : `To switch to ${linkedAccount.email} — sign out and sign in with email/password`,
          "warn"
        );
      }
      // onAuthStateChanged will fire and reload everything for the new user
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        console.error("Switch account error:", err);
        addToast(isAr ? `خطأ في التبديل: ${err.message}` : `Switch error: ${err.message}`, "error");
      }
    }
  }

  async function downloadPDF(sessionOverride){
    const la=lastAnalRef.current||{};
    const hist=histRef.current||[];
    const avg=hist.length?Math.round(hist.reduce((a,b)=>a+b,0)/hist.length):0;
    const gPctPDF=totalRef.current?Math.round(goodRef.current/totalRef.current*100):0;
    const durS=sessRef.current?Math.floor((Date.now()-sessRef.current)/1000):0;

    const sessionData = sessionOverride || {
      session_id: sessionId,
      avg_score: avg,
      good_pct: gPctPDF,
      duration_s: durS,
      score_history: hist,
      alerts_count: alRef.current?.length||0,
      metrics: la.metrics||{},
      tier, mode,
      created_at: new Date(),
    };

    if(!sessionOverride && hist.length===0){
      addToast(isAr?"ابدأ جلسة أولاً لتنزيل PDF":"No session data yet","warn"); return;
    }

    addToast(isAr?"جاري إنشاء الـ PDF...":"Generating PDF...","info");
    try{
      const { generateSessionPDF } = await import("./firebase.js");
      const idx = sessionOverride
        ? (userSessions.findIndex(s=>s.id===sessionOverride.id)+1 || userSessions.length)
        : (userSessions.length + 1);
      await generateSessionPDF({ session:sessionData, profile, user, lang, sessionIndex:idx });
      addToast(isAr?"✅ تم تحميل الـ PDF":"✅ PDF downloaded","success");
    }catch(err){
      console.error("PDF error:",err);
      addToast(isAr?`خطأ PDF: ${err.message}`:`PDF error: ${err.message}`,"error");
    }
  }

  const score=analysis?.overall||0;
  const gPct=totalRef.current?Math.round(goodRef.current/totalRef.current*100):0;
  const avg=history.length?Math.round(history.reduce((a,b)=>a+b,0)/history.length):0;
  const distCm=analysis?.distCm||(analysis?.metrics?.distance?.value)||null;
  // ── Role Detection ─────────────────────────────────────────────
  // platform_admin: is_admin=true in Firestore (set manually, never by client)
  const isAdmin   = profile?.is_admin === true;
  // hr_admin: org owner OR explicitly set as HR — NOT just having company_id
  const isHRAdmin = isAdmin
    || profile?.is_org_owner === true
    || profile?.user_type === "hr_admin"
    || profile?.is_hr === true
    || (HR_EMAILS||[]).includes(user?.email||"");
  // employee: has company_id but is NOT hr_admin
  // individual: no company_id and not HR

  // Shared props
  const shared={cs,t,darkMode,setDarkMode,lang,setLang,addToast};

  // ── ROUTING ───────────────────────────────────────────────────────
  if(!authChecked)return(
    <div style={{
      minHeight:"100vh",
      background: darkMode ? "#040d1a" : "#f8fafc",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'DM Sans',system-ui,-apple-system,sans-serif",
    }}>
      <style>{`
        @keyframes splash-in  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bar-fill   { from{width:0%} to{width:72%} }
        @keyframes txt-pulse  { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes icon-glow  { 0%,100%{box-shadow:0 0 0 0 rgba(26,86,219,.0)} 50%{box-shadow:0 0 32px 6px rgba(26,86,219,.22)} }
      `}</style>

      {/* Logo icon — large, centred, glowing */}
      <div style={{
        animation: "splash-in .55s cubic-bezier(.16,1,.3,1) both, icon-glow 2.4s ease 0.6s infinite",
        marginBottom: 22,
      }}>
        <div style={{
          width: 80, height: 80,
          background: "linear-gradient(145deg,#1a56db 0%,#0891b2 100%)",
          borderRadius: 22,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 38, color: "#fff", fontWeight: 800,
          boxShadow: "0 8px 32px rgba(26,86,219,.35)",
          userSelect: "none",
        }}>◈</div>
      </div>

      {/* Brand name */}
      <div style={{
        animation: "splash-in .55s cubic-bezier(.16,1,.3,1) .08s both",
        fontSize: 22, fontWeight: 800,
        color: darkMode ? "#f0f6ff" : "#0f172a",
        letterSpacing: "-.03em",
        marginBottom: 6,
      }}>Corvus</div>

      {/* Tagline */}
      <div style={{
        animation: "splash-in .55s cubic-bezier(.16,1,.3,1) .15s both",
        fontSize: 13, color: darkMode ? "#475569" : "#94a3b8",
        marginBottom: 32, fontWeight: 400,
      }}>
        {lang==="ar" ? "جاري تحميل مساحة عملك…" : "Loading your workspace…"}
      </div>

      {/* Progress bar */}
      <div style={{
        animation: "splash-in .4s ease .2s both",
        width: 220, height: 3,
        background: darkMode ? "rgba(148,163,184,.1)" : "rgba(100,116,139,.1)",
        borderRadius: 99, overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          background: "linear-gradient(90deg,#1a56db,#0891b2)",
          borderRadius: 99,
          animation: "bar-fill 2.8s cubic-bezier(.4,0,.2,1) forwards",
        }}/>
      </div>
    </div>
  );

  if(paymentResult)return <PaymentResultScreen result={paymentResult} cs={cs} lang={lang} onContinue={()=>setPaymentResult(null)}/>;
  if(page==="landing")return <ErrorBoundary><Landing {...shared} onStart={()=>setPage(user?"setup":"auth")} lang={lang} setLang={setLang} darkMode={darkMode} setDarkMode={setDarkMode}/></ErrorBoundary>;
  if(page==="embed")return <EmbedWidget/>;
  // ── Auth page ────────────────────────────────────────────────────
  if(page==="auth"&&!user) return(
    <ErrorBoundary>
      <AuthPage
        darkMode={darkMode} setDarkMode={setDarkMode}
        lang={lang} setLang={setLang}
        initialView={new URLSearchParams(window.location.search).get("mode")==="signup" ? "signup" : "login"}
        onAuth={(u,isNew)=>{
          setUser(u);
          getUserProfile(u.uid).then(p=>{
            if(p){setProfile(p);if(p.tier&&p.tier!=="standard")setTier(p.tier);if(p.company_id)setCompanyId(p.company_id);}
            getUserSessions(u.uid).then(setUserSessions).catch(()=>{});
          }).catch(()=>{});
          if(isNew) { setPage("setup"); return; }
          setPage("home");
        }}
      />
    </ErrorBoundary>
  );

  // ── Invite acceptance — works with or without auth ───────────────
  if(page==="invite"&&window.__invite_token) return(
    <ErrorBoundary>
      <InviteAccept
        token={window.__invite_token}
        cs={cs} lang={lang}
        onAccepted={({company_id,role})=>{
          sessionStorage.removeItem("pending_invite");
          delete window.__invite_token;
          setCompanyId(company_id);
          if(profile) setProfile(p=>({...p,company_id,role}));
          setPage("home");
          addToast(isAr?"✅ انضممت للفريق!":"✅ Joined the team!","success");
        }}
        onError={()=>setPage("home")}
      />
    </ErrorBoundary>
  );

  if(!user)return(
    <ErrorBoundary>
      <AuthPage
        darkMode={darkMode} setDarkMode={setDarkMode}
        lang={lang} setLang={setLang}
        onAuth={(u,isNew)=>{
          setUser(u);
          getUserProfile(u.uid).then(p=>{
            if(p){
              setProfile(p);
              if(p.tier)setTier(normalizeTier(p.tier));
              if(p.company_id)setCompanyId(p.company_id);
            }
            getUserSessions(u.uid).then(setUserSessions).catch(()=>{});
          }).catch(()=>{});
          if(isNew){setPage("setup");return;}
          // FIX 5: also check setup_complete for existing users interrupted mid-setup
          getUserProfile(u.uid).then(p=>{
            if(p&&!p.setup_complete) setPage("setup");
            else setPage("home");
          }).catch(()=>setPage("home"));
        }}
      />
    </ErrorBoundary>
  );  if(page==="admin"&&isAdmin)return <ErrorBoundary><Admin {...shared} adminUser={user} onBack={()=>setPage("home")}/></ErrorBoundary>;
  if(page==="hr"&&(isAdmin||isHRAdmin))return <ErrorBoundary><HRPanel {...shared} user={user} profile={profile} companyId={companyId||profile?.company_id} onBack={()=>setPage("home")}/></ErrorBoundary>;
  if(page==="pricing") return(
    <ErrorBoundary>
      <PricingPage
        cs={cs} lang={lang} isAr={isAr} dir={dir}
        profile={profile} darkMode={darkMode}
        onBack={()=>setPage("home")}
        onSelectPlan={(planId,billing)=>{setTier(planId);setShowBilling(true);setPage("home");}}
      />
    </ErrorBoundary>
  );
  if(page==="profile"){setPage("home"); return null; /* Settings handled in HomePage tabs */}
  if(page==="leaderboard")return <ErrorBoundary><Leaderboard {...shared} users={allUsers} onBack={()=>setPage("home")} lang={lang}/></ErrorBoundary>;
  // page==="live" and page==="home" fall through to their renders below

  // ── SETUP SCREEN: account type + device selection ─────────────────
  if(page==="setup"){
    return(<ErrorBoundary>
      <div dir={dir} style={{minHeight:"100vh",background:cs.bg,color:cs.text,fontFamily:"system-ui,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 18px"}}>
        <Toasts toasts={toasts} dismiss={dismissToast} isAr={isAr}/>
        {/* Lang + Dark toggle */}
        <div style={{position:"absolute",top:16,right:16,display:"flex",gap:7}}>
          <button onClick={()=>setLang(isAr?"en":"ar")} style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:7,padding:"5px 10px",fontSize:11,color:cs.text,cursor:"pointer"}}>{isAr?"🇬🇧 EN":"🇪🇬 عربي"}</button>
          <button onClick={()=>setDarkMode(!darkMode)} style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:7,padding:"5px 9px",fontSize:12,cursor:"pointer"}}>{darkMode?"☀️":"🌙"}</button>
        </div>
        <div style={{width:"100%",maxWidth:520}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:32,justifyContent:"center"}}>
            <div style={{width:36,height:36,background:"linear-gradient(135deg,#1a56db,#0891b2)",borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>◈</div>
            <div style={{fontSize:18,fontWeight:700,color:cs.text}}>{t.appName}</div>
          </div>

          {/* Step indicator: 1 of 2 */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:0,marginBottom:28}}>
            {[
              {n:1,lbl:isAr?"نوع الحساب":"Account Type"},
              {n:2,lbl:isAr?"الجهاز":"Device"},
            ].map((s,i)=>(
              <React.Fragment key={s.n}>
                {i>0&&<div style={{width:40,height:1.5,background:acctType?cs.blue:cs.border,margin:"0 4px",transition:"background .3s"}}/>}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <div style={{width:26,height:26,borderRadius:"50%",border:`2px solid ${(i===0&&!acctType)||(i===1&&acctType)?(acctType&&i===1&&devicePref)?cs.blue:cs.blue:(cs.border)}`,background:(i===0&&acctType)||(i===1&&devicePref)?"rgba(26,86,219,.15)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:(i===0&&acctType)||(i===1&&devicePref)?cs.blue:(!acctType&&i===0)?cs.blue:cs.muted,transition:"all .3s"}}>
                    {(i===0&&acctType&&devicePref)||(i===1&&devicePref)?"✓":s.n}
                  </div>
                  <div style={{fontSize:9.5,color:(i===0&&!acctType)||(i===1&&acctType)?cs.text:cs.muted,fontWeight:(i===0&&!acctType)||(i===1&&acctType)?600:400,transition:"all .3s"}}>{s.lbl}</div>
                </div>
              </React.Fragment>
            ))}
          </div>

          {!acctType?(
            <>
              <div style={{textAlign:"center",marginBottom:24}}>
                <div style={{fontSize:20,fontWeight:700,marginBottom:6,color:cs.text}}>{t.acctType}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[
                  {id:"company",icon:"🏢",label:t.acctCompany,desc:t.acctCompanyDesc,color:"#0ea5e9"},
                  {id:"personal",icon:"👤",label:t.acctPersonal,desc:t.acctPersonalDesc,color:"#6366f1"},
                ].map(o=>(
                  <div key={o.id} onClick={()=>setAcctType(o.id)}
                    style={{background:cs.card,border:`1.5px solid ${o.color}40`,borderRadius:14,padding:"20px 16px",cursor:"pointer",textAlign:"center",transition:"all .2s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=o.color}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=o.color+"40"}>
                    <div style={{fontSize:32,marginBottom:10}}>{o.icon}</div>
                    <div style={{fontSize:13,fontWeight:700,color:cs.text,marginBottom:5}}>{o.label}</div>
                    <div style={{fontSize:10.5,color:cs.muted,lineHeight:1.5}}>{o.desc}</div>
                  </div>
                ))}
              </div>
            </>
          ):(
            <>
              <div style={{textAlign:"center",marginBottom:24}}>
                <button onClick={()=>{setAcctType(null);setDevicePref(null);}} style={{background:"none",border:"none",color:cs.muted,cursor:"pointer",fontSize:11,marginBottom:12}}>{isAr?"← رجوع":"← Back"}</button>
                <div style={{fontSize:20,fontWeight:700,marginBottom:6,color:cs.text}}>{t.deviceType}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                {[
                  {id:"laptop",icon:"💻",label:t.deviceLaptop,desc:t.deviceLaptopDesc,color:"#6366f1",modes:["laptop"]},
                  {id:"phone",icon:"📱",label:t.devicePhone,desc:t.devicePhoneDesc,color:"#f59e0b",modes:["phone","side"]},
                ].map(o=>(
                  <div key={o.id} onClick={()=>setDevicePref(o.id)}
                    style={{background:devicePref===o.id?`${o.color}18`:cs.card,border:`1.5px solid ${devicePref===o.id?o.color:o.color+"40"}`,borderRadius:14,padding:"20px 16px",cursor:"pointer",textAlign:"center",transition:"all .2s"}}>
                    <div style={{fontSize:32,marginBottom:10}}>{o.icon}</div>
                    <div style={{fontSize:13,fontWeight:700,color:cs.text,marginBottom:5}}>{o.label}</div>
                    <div style={{fontSize:10.5,color:cs.muted,lineHeight:1.5}}>{o.desc}</div>
                  </div>
                ))}
              </div>
              <button onClick={async ()=>{
                if(!devicePref){addToast(isAr?"اختار جهازك الأول 👆":"Choose your device first 👆","warn");return;}
                const defaultMode=devicePref==="laptop"?"laptop":"phone";
                setMode(defaultMode);
                // Save user_type to Firestore so role detection works
                if(user?.uid){
                  try{
                    await updateDoc(doc(db,"users",user.uid),{
                      user_type: acctType==="company"?"hr_admin":"individual",
                      acct_type: acctType==="company"?"company":"individual",
                      is_org_owner: acctType==="company",
                      setup_complete: true,
                      device_pref: devicePref,
                      updated_at: serverTimestamp(),
                    });
                    setProfile(p=>({...p, user_type: acctType==="company"?"hr_admin":"individual", acct_type: acctType==="company"?"company":"individual", is_org_owner: acctType==="company", setup_complete:true}));
                  }catch(e){ console.warn("setup save failed",e); }
                }
                const freshP=user?.uid?await getUserProfile(user.uid).catch(()=>null):null;
                if(freshP){setProfile(freshP);if(freshP.tier)setTier(normalizeTier(freshP.tier));if(freshP.company_id)setCompanyId(freshP.company_id);}
                else{setProfile(p=>({...p,user_type:acctType==="company"?"hr_admin":"individual",acct_type:acctType==="company"?"company":"individual",is_org_owner:acctType==="company",setup_complete:true}));}
                if(acctType==="company"){setShowCompanyOnboard(true);}
                else{setTimeout(()=>setShowOnboard(true),800);}
                setPage("home");
              }}
                style={{width:"100%",padding:"13px",background:devicePref?cs.blue:"rgba(148,163,184,.2)",color:"white",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:devicePref?"pointer":"not-allowed",transition:"all .2s"}}>
                {isAr?"متابعة →":"Continue →"}
              </button>
              {!devicePref&&<div style={{textAlign:"center",marginTop:8,fontSize:10,color:cs.muted}}>
                {isAr?"↑ اختار جهازك للمتابعة":"↑ Choose your device to continue"}
              </div>}
            </>
          )}
          <div style={{textAlign:"center",marginTop:18,fontSize:10,color:cs.muted}}>
            <button onClick={()=>{logOut();}} style={{background:"none",border:"none",color:cs.muted,cursor:"pointer",fontSize:10}}>{t.signOut}</button>
          </div>
        </div>
      </div>
    </ErrorBoundary>);
  }


  // Sidebar & card styles
  const SB={background:cs.card,borderRight:`0.5px solid ${cs.border}`,display:"flex",flexDirection:"column",overflowY:"auto"};
  const SEC={padding:"10px 12px",borderBottom:`0.5px solid ${cs.border}`};
  const LBL={fontSize:8.5,color:cs.muted,textTransform:"uppercase",letterSpacing:".09em",marginBottom:6,fontWeight:500};
  const SC2={background:cs.card2,border:`0.5px solid ${cs.border}`,borderRadius:8,padding:"9px 10px"};
  const abox=tp=>({borderRadius:8,padding:"9px 11px",fontSize:10.5,lineHeight:1.5,border:"0.5px solid",
    background:tp==="warn"?"rgba(245,158,11,.07)":tp==="good"?"rgba(16,185,129,.07)":tp==="bad"?"rgba(239,68,68,.07)":"rgba(99,102,241,.07)",
    borderColor:tp==="warn"?"rgba(245,158,11,.3)":tp==="good"?"rgba(16,185,129,.3)":tp==="bad"?"rgba(239,68,68,.3)":"rgba(99,102,241,.3)",
    color:tp==="warn"?"#fcd34d":tp==="good"?"#6ee7b7":tp==="bad"?"#fca5a5":"#a5b4fc"});

  // ── HOME PAGE ─────────────────────────────────────────────────────
  const tierList=isAr?Object.values(TIERS).slice().reverse():Object.values(TIERS);
  const allModes=Object.values(MC);
  const filteredModes=devicePref==="laptop"?allModes.filter(m=>m.id==="laptop"):
                      devicePref==="phone"?allModes.filter(m=>m.id!=="laptop"):allModes;
  const modeList=isAr?filteredModes.slice().reverse():filteredModes;

  if(page==="home") return(
    <ErrorBoundary>
      {/* ── ALL MODALS — shown on home page too ────────────────── */}
      {showCompanyOnboard&&<CompanyOnboarding profile={profile} cs={cs} lang={lang} onComplete={async(company)=>{setShowCompanyOnboard(false);setCompanyId(company?.id);setProfile(p=>({...p,company_id:company?.id,company:company?.name,is_org_owner:true,user_type:"hr_admin"}));if(user?.uid&&company?.id){try{const{doc:_d,updateDoc:_u,serverTimestamp:_s}=await import("firebase/firestore");const{db:_db}=await import("./firebase.js");await _u(_d(_db,"users",user.uid),{company_id:company.id,company:company.name||"",is_org_owner:true,user_type:"hr_admin",setup_complete:true,updated_at:_s()});}catch(e){}}addToast(isAr?"✅ تم إنشاء شركتك":"✅ Company created","success");}}/>}
      {showOnboard&&<OnboardingWizard user={user} lang={lang} onComplete={handleOnboardComplete} onSkip={async()=>{
        setShowOnboard(false);
        // Persist skip so wizard never shows again on next login
        if(user?.uid){
          try{
            await updateDoc(doc(db,"users",user.uid),{
              onboarding_done:["skipped"],
              setup_complete:true,
              updated_at:serverTimestamp(),
            });
            setProfile(p=>p?({...p,onboarding_done:["skipped"],setup_complete:true}):p);
          }catch(e){ console.warn("skip onboard:",e?.code); }
        }
      }}/>}
      {showBilling&&<BillingModal profile={profile} currentPlan={tier} cs={cs} lang={lang} onClose={()=>setShowBilling(false)} onSuccess={(plan)=>{setTier(normalizeTier(plan));setShowBilling(false);addToast(isAr?"✅ تم تحديث خطتك":"✅ Plan updated","success");}}/>}
      {showCalibWizard&&<CalibrationWizard uid={profile?.uid} cs={cs} lang={lang} onDone={d=>{setCalibData(d);setShowCalibWizard(false);addToast("Calibration saved ✓","success");}} onSkip={()=>setShowCalibWizard(false)}/>}
      {showDashboard&&<AnalyticsDashboard uid={profile?.uid} profile={profile} sessions={userSessions} cs={cs} lang={lang} onBack={()=>setShowDashboard(false)}/>}
      {showCoach&&<AICoach profile={profile} sessions={userSessions} calibration={calibData} cs={cs} lang={lang} onClose={()=>setShowCoach(false)}/>}
      {showGamification&&<GamificationPanel profile={profile} sessions={userSessions} calibration={calibData} cs={cs} lang={lang} onClose={()=>setShowGamification(false)}/>}
      {showAdmin&&isAdmin&&<AdminDashboard adminProfile={profile} cs={cs} lang={lang} onBack={()=>setShowAdmin(false)} onOpenSecurityCenter={()=>setShowSecurityCenter(true)} onOpenFeatureFlags={()=>setShowFeatureFlags(true)} onOpenOnboardingAnalytics={()=>setShowOnboardingAnalytics(true)}/>}
      {showMRR&&isAdmin&&<MRRDashboard cs={cs} lang={lang} onClose={()=>setShowMRR(false)}/>}
      {showHelp&&<HelpCenter cs={cs} lang={lang} onClose={()=>setShowHelp(false)}/>}
      {showChangelog&&isAdmin&&<APIChangelog cs={cs} onClose={()=>setShowChangelog(false)}/>}
      {showAIInsights&&<AIInsights profile={profile} sessions={userSessions} calibration={calibData} cs={cs} lang={lang} onClose={()=>setShowAIInsights(false)}/>}
      {showPredictiveAI&&<PredictiveAI profile={profile} sessions={userSessions} cs={cs} lang={lang} onClose={()=>setShowPredictiveAI(false)}/>}
      {showAIReports&&<AIReports profile={profile} sessions={userSessions} allUsers={allUsers} cs={cs} lang={lang} onClose={()=>setShowAIReports(false)}/>}
      {showWorkforceAnalytics&&(isAdmin||isHRAdmin)&&<WorkforceAnalytics uid={profile?.uid} profile={profile} sessions={userSessions} allUsers={allUsers} cs={cs} lang={lang} onClose={()=>setShowWorkforceAnalytics(false)}/>}
      {showEnterpriseRBAC&&<EnterpriseRBAC orgId={profile?.company_id||companyId} adminUid={user?.uid} profile={profile} members={allUsers} cs={cs} lang={lang} onClose={()=>setShowEnterpriseRBAC(false)}/>}
      
      {showFeatureFlags&&isAdmin&&<FeatureFlags profile={profile} cs={cs} lang={lang} onClose={()=>setShowFeatureFlags(false)}/>}
      {showNotificationsHub&&<NotificationsHub orgId={profile?.company_id||companyId} profile={profile} sessions={userSessions} allUsers={allUsers} cs={cs} lang={lang} onClose={()=>setShowNotificationsHub(false)}/>}
      {showUpgrade&&<UpgradePrompt reason={upgradeReason} cs={cs} lang={lang} profile={profile} onUpgrade={()=>{setShowUpgrade(false);setShowBilling(true);}} onClose={()=>setShowUpgrade(false)}/>}
      {showOnboardingAnalytics&&<OnboardingAnalytics token={authToken} onClose={()=>setShowOnboardingAnalytics(false)}/>}
      <HomePage
        user={user} profile={profile} cs={cs} lang={lang} isAr={isAr} dir={dir}
        userSessions={userSessions} setUserSessions={setUserSessions}
        allUsers={allUsers} setAllUsers={setAllUsers}
        tier={tier} setTier={setTier} mode={mode} setMode={setMode}
        setPage={setPage} startCamera={startCamera} addToast={addToast}
        setShowDashboard={setShowDashboard} setShowCoach={setShowCoach}
        setShowGamification={setShowGamification} setShowBilling={setShowBilling}
        setShowCompanyOnboard={setShowCompanyOnboard} setShowAdmin={setShowAdmin}
        setShowWorkforceAnalytics={setShowWorkforceAnalytics}
        setShowAIReports={setShowAIReports}
        setShowOnboard={setShowOnboard}
        setShowSessionComparison={setShowSessionComparison}
        setShowTrendChart={setShowTrendChart}
        setShowCalibWizard={setShowCalibWizard}
        setShowAIInsights={setShowAIInsights}
        setShowGrowthHub={setShowGrowthHub}
        setShowSecurityCenter={setShowSecurityCenter}
        setShowCustomerSuccess={setShowCustomerSuccess}
        setShowChurnPrediction={setShowChurnPrediction}
        setShowAPIMarketplace={setShowAPIMarketplace}
        setShowWhiteLabel={setShowWhiteLabel}
        setShowMultiTenant={setShowMultiTenant}
        setShowAuditSystem={setShowAuditSystem}
        setShowPredictiveAI={setShowPredictiveAI}
        setShowMRR={setShowMRR}
        setShowChangelog={setShowChangelog}
        setShowNotificationsHub={setShowNotificationsHub}
        setShowEnterpriseRBAC={setShowEnterpriseRBAC}
        isAdmin={isAdmin} isHRAdmin={isHRAdmin} companyId={companyId}
        darkMode={darkMode} setDarkMode={setDarkMode} setLang={setLang}
        t={t} logOut={logOut} setUser={setUser} setProfile={setProfile}
        showCalibWizard={showCalibWizard}
        showBreak={showBreak} dismissBreak={dismissBreak}
        calibData={calibData} Toasts={Toasts} toasts={toasts} dismissToast={dismissToast}
        NavAvatarDropdown={NavAvatarDropdown} UpgradePrompt={UpgradePrompt}
        showUpgrade={showUpgrade} upgradeReason={upgradeReason}
        setShowUpgrade={setShowUpgrade} BreakTimer={BreakTimer}
        CalibrationWizard={CalibrationWizard} setCalibData={setCalibData}
        toast={addToast}
        downloadPDF={downloadPDF}
        AccountSwitcher={AccountSwitcher}
        onSwitchAccount={handleSwitchAccount}
      />
      {showGrowthHub&&<GrowthHub profile={profile} cs={cs} lang={lang} onClose={()=>setShowGrowthHub(false)}/>}
      {showShareCard&&shareCardData&&(
      <ShareCard score={shareCardData.score} grade={shareCardData.grade}
        streak={shareCardData.streak||0} percentile={null}
        lang={lang} cs={cs} onClose={()=>setShowShareCard(false)}/>
    )}
    {showSessionComparison&&<SessionComparison sessions={userSessions} cs={cs} lang={lang} onClose={()=>setShowSessionComparison(false)}/>}
      {showTrendChart&&<TrendChart sessions={userSessions} cs={cs} lang={lang} onClose={()=>setShowTrendChart(false)}/>}
      {showChurnPrediction&&(isAdmin||isHRAdmin)&&<ChurnPrediction profile={profile} cs={cs} lang={lang} onClose={()=>setShowChurnPrediction(false)}/>}
      {showCustomerSuccess&&(isAdmin||isHRAdmin)&&<CustomerSuccess profile={profile} cs={cs} lang={lang} onClose={()=>setShowCustomerSuccess(false)}/>}
      {showAPIMarketplace&&<APIMarketplace profile={profile} cs={cs} lang={lang} onClose={()=>setShowAPIMarketplace(false)}/>}
      {showWhiteLabel&&<WhiteLabel profile={profile} cs={cs} lang={lang} onClose={()=>setShowWhiteLabel(false)}/>}
      {showMultiTenant&&<MultiTenantManager profile={profile} cs={cs} lang={lang} onClose={()=>setShowMultiTenant(false)}/>}
      {showAuditSystem&&(isAdmin||isHRAdmin)&&<AuditSystem profile={profile} cs={cs} lang={lang} onClose={()=>setShowAuditSystem(false)}/>}
    </ErrorBoundary>
  );
  const TN = T_norm;
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const scoreColor = score ? sc(score) : cs.muted;
  const tier_label = TN?.name || "—";
  const mode_label = M_?.label || "—";

  // Inline ActionBtn for the 4 bottom buttons
  const ActionBtn = ({icon, label, color, dimColor, onClick}) => {
    const [h,setH] = useState(false);
    return (
      <button
        onClick={onClick}
        onMouseEnter={()=>setH(true)}
        onMouseLeave={()=>setH(false)}
        style={{
          flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:5,
          padding:"11px 6px",
          background: h ? `${color}18` : `${color}0c`,
          border:`1px solid ${h?color+"50":color+"25"}`,
          borderRadius:12, cursor:"pointer",
          transition:"all .18s",
        }}>
        <span style={{fontSize:18, lineHeight:1}}>{icon}</span>
        <span style={{fontSize:10.5, fontWeight:600, color: h ? color : dimColor}}>{label}</span>
      </button>
    );
  };

  return(<ErrorBoundary>
    <style>{`
      @keyframes livePulse{0%,100%{opacity:1}50%{opacity:.4}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes spin{to{transform:rotate(360deg)}}
    `}</style>
    <div dir={dir} style={{
      display:"grid",
      gridTemplateColumns: isMobile ? "1fr" : (isAr ? "300px 1fr" : "1fr 300px"),
      minHeight:"100vh",
      background:cs.bg, color:cs.text,
      fontFamily:"'Inter',system-ui,sans-serif",
    }}>
      <Toasts toasts={toasts} dismiss={dismissToast} isAr={isAr}/>
      <OfflineBanner lang={lang}/>

      {/* ── GlobalModals: render on ALL pages ──────────────────── */}
      

      {/* OLD DUPLICATE MODALS REMOVED — see GlobalModals block above */}
                  {showAnnualUpsell && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setShowAnnualUpsell(false)}>
          <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",border:"1px solid rgba(99,102,241,.3)",borderRadius:20,padding:"36px 32px",maxWidth:420,width:"90%",textAlign:"center"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:12,fontWeight:700,letterSpacing:".1em",color:"#6366f1",textTransform:"uppercase",marginBottom:12}}>
              {lang==="ar"?"توفير حصري":"EXCLUSIVE SAVING"}
            </div>
            <h3 style={{fontSize:22,fontWeight:700,color:"#eef2ff",margin:"0 0 8px"}}>
              {lang==="ar"?"وفّر شهرين مجاناً 🎉":"Save 2 months free 🎉"}
            </h3>
            <p style={{fontSize:14,color:"#94a3b8",margin:"0 0 20px",lineHeight:1.6}}>
              {lang==="ar"?"حوّل اشتراكك لخطة سنوية واستمتع بتوفير 20٪":"Switch to annual and save 20% — that's 2 months free."}
            </p>
            <div style={{background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.2)",borderRadius:12,padding:"16px",marginBottom:20}}>
              <p style={{margin:0,color:"#a5b4fc",fontSize:13}}>
                {lang==="ar"
                  ? `${(profile?.tier||"standard")} · سنوي · وفّر 17٪`
                  : `${(profile?.tier||"standard").charAt(0).toUpperCase()+(profile?.tier||"standard").slice(1)} · Annual · 17% off`}
              </p>
            </div>
            <button onClick={()=>{ setShowAnnualUpsell(false); setPage("billing"); }}
              style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#6366f1,#0891b2)",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",marginBottom:10}}>
              {lang==="ar"?"احصل على الخصم السنوي →":"Get annual discount →"}
            </button>
            <button onClick={()=>setShowAnnualUpsell(false)}
              style={{fontSize:12,color:"#475569",background:"none",border:"none",cursor:"pointer"}}>
              {lang==="ar"?"الاستمرار شهرياً":"Keep monthly plan"}
            </button>
          </div>
        </div>
      )}
      {showNPS && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setShowNPS(false)}>
          <div style={{background:"var(--color-background-primary,#0f172a)",border:"1px solid rgba(148,163,184,.15)",borderRadius:20,padding:"36px 32px",maxWidth:440,width:"90%",textAlign:"center"}}
            onClick={e=>e.stopPropagation()}>
            <p style={{fontSize:28,marginBottom:8}}>👋</p>
            <p style={{fontSize:18,fontWeight:700,color:"var(--color-text-primary,#eef2ff)",marginBottom:8}}>
              {lang==="ar"?"كيف تقيّم Corvus؟":"How would you rate Corvus?"}
            </p>
            <p style={{fontSize:13,color:"var(--color-text-secondary,#94a3b8)",marginBottom:24}}>
              {lang==="ar"?"رأيك يساعدنا على التحسين":"Your feedback helps us improve"}
            </p>
            <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:20}}>
              {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                <button key={n} onClick={async()=>{
                  try {
                    await apiFetch("/nps/submit",{method:"POST",body:{score:n,uid:profile?.uid}});
                    await updateProfile(profile?.uid,{last_nps_at:new Date().toISOString()});
                  } catch(_) {}
                  setShowNPS(false);
                  if(n>=9) toast(lang==="ar"?"شكراً! 🎉":"Thank you! 🎉","success");
                }}
                  style={{width:36,height:36,borderRadius:8,border:"1px solid rgba(148,163,184,.2)",background:"rgba(255,255,255,.04)",color:"#e2e8f0",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all .15s"}}
                  onMouseEnter={e=>{e.target.style.background="#6366f1";e.target.style.borderColor="#6366f1";}}
                  onMouseLeave={e=>{e.target.style.background="rgba(255,255,255,.04)";e.target.style.borderColor="rgba(148,163,184,.2)";}}
                >{n}</button>
              ))}
            </div>
            <button onClick={()=>setShowNPS(false)} style={{fontSize:12,color:"#64748b",background:"none",border:"none",cursor:"pointer"}}>
              {lang==="ar"?"لاحقاً":"Dismiss"}
            </button>
          </div>
        </div>
      )}
      {showUsageBilling&&<UsageBilling profile={profile} cs={cs} lang={lang} onClose={()=>setShowUsageBilling(false)}/>}
      {showProductTour&&<ProductTour profile={profile} cs={cs} lang={lang} onClose={()=>setShowProductTour(false)}/>}
      {showSecurityCenter&&<SecurityCenter user={user} profile={profile} cs={cs} lang={lang} onNavigate={setPage} onClose={()=>setShowSecurityCenter(false)} onSignOut={()=>{logOut();setShowSecurityCenter(false);setUser(null);setProfile(null);}}/>}
      {showAccountActivity&&<AccountActivity profile={profile} cs={cs} lang={lang} onClose={()=>setShowAccountActivity(false)}/> }
      {showMFASetup&&<MFASetup profile={profile} cs={cs} lang={lang} onClose={()=>setShowMFASetup(false)} onEnabled={()=>setShowMFASetup(false)}/>}
      {showBillingDashboard&&<BillingDashboard profile={profile} user={user} cs={cs} lang={lang} onClose={()=>setShowBillingDashboard(false)} onUpgrade={(plan)=>{setShowBillingDashboard(false);setShowBilling(true);}}/>}
      {/* Phase 12 — Enterprise Scale */}
      {showEnterpriseAdmin&&isAdmin&&<EnterpriseAdminTools profile={profile} cs={cs} lang={lang} onClose={()=>setShowEnterpriseAdmin(false)}/>}

      {/* ── Session Result Modal ── */}
      {sessionResult&&(
        <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,.82)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"rgba(8,14,28,.98)",border:`2px solid ${sessionResult.color}30`,borderRadius:20,padding:"36px 32px",maxWidth:400,width:"100%",textAlign:"center",boxShadow:"0 24px 80px rgba(0,0,0,.6)"}}>
            {/* Score ring */}
            <div style={{position:"relative",width:130,height:130,margin:"0 auto 20px"}}>
              <svg width="130" height="130" style={{transform:"rotate(-90deg)"}}>
                <circle cx="65" cy="65" r="55" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="9"/>
                <circle cx="65" cy="65" r="55" fill="none" stroke={sessionResult.color} strokeWidth="9"
                  strokeDasharray={`${(sessionResult.avg_score/100)*345.6} 345.6`} strokeLinecap="round"/>
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:36,fontWeight:900,color:sessionResult.color,lineHeight:1}}>{sessionResult.avg_score}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)",fontWeight:600}}>/ 100</div>
              </div>
            </div>

            {/* Grade */}
            <div style={{fontSize:22,fontWeight:800,color:"#f0f6ff",marginBottom:6}}>
              {isAr?sessionResult.gradeAr:sessionResult.grade}
            </div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:24}}>
              {isAr?"متوسط وضعيتك في هذه الجلسة":"Your average posture score this session"}
            </div>

            {/* Stats row */}
            <div style={{display:"flex",gap:12,marginBottom:24}}>
              {[
                {label:isAr?"مدة الجلسة":"Duration", value:`${Math.floor(sessionResult.duration_s/60)}:${String(sessionResult.duration_s%60).padStart(2,"0")}`},
                {label:isAr?"وضعية جيدة":"Good posture", value:`${sessionResult.good_pct}%`},
                {label:isAr?"التنبيهات":"Alerts", value:sessionResult.alerts_count},
              ].map((s,i)=>(
                <div key={i} style={{flex:1,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:10,padding:"10px 8px"}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#f0f6ff"}}>{s.value}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Top issue */}
            {sessionResult.top_metric&&(
              <div style={{background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.2)",borderRadius:10,padding:"10px 14px",marginBottom:20,textAlign:"left"}}>
                <div style={{fontSize:11,color:"#f59e0b",fontWeight:700,marginBottom:3}}>
                  {isAr?"أبرز مشكلة":"Top issue to fix"}
                </div>
                <div style={{fontSize:13,color:"#f0f6ff",fontWeight:500}}>
                  {sessionResult.top_metric[1]?.label} — score {sessionResult.top_metric[1]?.score}/100
                </div>
              </div>
            )}

            {/* Trend badge */}
            {sessionResult.trend && sessionResult.trend !== "stable" && (
              <div style={{display:"flex",alignItems:"center",gap:8,background:sessionResult.trend==="improving"?"rgba(16,185,129,.08)":"rgba(239,68,68,.08)",border:`1px solid ${sessionResult.trend==="improving"?"rgba(16,185,129,.25)":"rgba(239,68,68,.25)"}`,borderRadius:10,padding:"9px 14px",marginBottom:12}}>
                <span style={{fontSize:18}}>{sessionResult.trend==="improving"?"📈":"📉"}</span>
                <div style={{fontSize:12,color:sessionResult.trend==="improving"?"#10b981":"#ef4444",fontWeight:600}}>
                  {sessionResult.trend==="improving"
                    ?(isAr?"وضعيتك تتحسن خلال هذه الجلسة 💪":"Your posture improved during this session 💪")
                    :(isAr?"وضعيتك تراجعت — خذ استراحة":"Posture declined — consider a break")}
                </div>
              </div>
            )}

            {/* Improvement tip */}
            {sessionResult.improvement_tip && (
              <div style={{background:"rgba(99,102,241,.07)",border:"1px solid rgba(99,102,241,.2)",borderRadius:10,padding:"10px 14px",marginBottom:12,textAlign:"left"}}>
                <div style={{fontSize:10,color:"#818cf8",fontWeight:700,marginBottom:3}}>
                  💡 {isAr?"نصيحة للتحسين":"Improvement tip"}
                </div>
                <div style={{fontSize:12,color:"#e0e7ff",lineHeight:1.5}}>{sessionResult.improvement_tip}</div>
              </div>
            )}

            {/* Pain prediction */}
            {sessionResult.pain_summary && (
              <div style={{background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.25)",borderRadius:10,padding:"9px 14px",marginBottom:12}}>
                <div style={{fontSize:12,color:"#f59e0b",fontWeight:600}}>{sessionResult.pain_summary}</div>
              </div>
            )}

            {/* CTAs */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={()=>{setSessionResult(null);setPage("live");setTimeout(()=>startCamera(),300);}}
                style={{padding:"12px",background:`linear-gradient(135deg,#1a56db,#0891b2)`,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"}}>
                {isAr?"▶ جلسة جديدة":"▶ New Session"}
              </button>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>{
                    setSessionResult(null);
                    // Refresh sessions before going home so Sessions tab is up to date
                    if(user) getUserSessions(user.uid).then(setUserSessions).catch(()=>{});
                    setPage("home");
                  }}
                  style={{flex:1,padding:"10px",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  {isAr?"لوحة التحكم":"Dashboard"}
                </button>
                <button onClick={async ()=>{
                  addToast(isAr?"جاري إنشاء PDF...":"Generating PDF...","info");
                  try {
                    const { generateSessionPDF } = await import("./firebase.js");
                    await generateSessionPDF({
                      session: { ...sessionResult, created_at: new Date(), mode, tier,
                        session_id: sessionId, score_history: histRef.current||[] },
                      profile, user, lang,
                      sessionIndex: (userSessions.length||0)+1,
                    });
                    addToast(isAr?"✅ تم تحميل PDF":"✅ PDF downloaded","success");
                  } catch(e) {
                    addToast("PDF error: "+(e?.message||"unknown"),"error");
                  }
                }}
                  style={{flex:1,padding:"10px",background:"rgba(99,102,241,.15)",color:"#a5b4fc",border:"1px solid rgba(99,102,241,.3)",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  📄 {isAr?"تنزيل PDF":"Download PDF"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LEFT PANEL — stats & history ── */}
      <div style={{
        display:"flex", flexDirection:"column",
        overflowY:"auto", background:cs.bg,
        order: isAr ? 1 : 0,
        borderRight: isAr ? "none" : `1px solid ${cs.border}`,
        borderLeft:  isAr ? `1px solid ${cs.border}` : "none",
      }}>
        {/* Top bar */}
        <div style={{
          padding:"12px 16px",
          borderBottom:`1px solid ${cs.border}`,
          background:cs.card,
          display:"flex", alignItems:"center",
          justifyContent:"space-between",
          position:"sticky", top:0, zIndex:10,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button
              onClick={()=>{stopCamera();if(user) getUserSessions(user.uid).then(setUserSessions).catch(()=>{});setPage("home");setCamActive(false);}}
              style={{
                background:"rgba(148,163,184,.08)",
                border:`1px solid ${cs.border}`,
                borderRadius:8,padding:"6px 12px",
                fontSize:12,fontWeight:500,color:cs.muted,cursor:"pointer",
                display:"flex",alignItems:"center",gap:5,
              }}>
              {isAr ? "→" : "←"} {isAr?"رجوع":"Back"}
            </button>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:cs.text}}>
                {isAr ? `${mode_label} · ${tier_label}` : `${tier_label} · ${mode_label}`}
              </div>
              <div style={{fontSize:10.5,color:cs.muted,marginTop:1}}>
                {mpStatus==="ready"
                  ? (isAr?"نموذج AI جاهز — 33 نقطة نشطة":"AI model ready — 33 landmarks active")
                  : (isAr?"جاري تحميل النموذج...":"Loading AI model...")}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={()=>setLang(lang==="en"?"ar":"en")}
              style={{background:"rgba(148,163,184,.08)",border:`1px solid ${cs.border}`,borderRadius:7,padding:"4px 10px",fontSize:11,color:cs.muted,cursor:"pointer"}}>
              {lang==="en"?"عربي":"EN"}
            </button>
            <button onClick={()=>setDarkMode(!darkMode)}
              style={{background:"rgba(148,163,184,.08)",border:`1px solid ${cs.border}`,borderRadius:7,padding:"4px 8px",fontSize:12,cursor:"pointer"}}>
              {darkMode?"☀️":"🌙"}
            </button>
            <button onClick={()=>setPage("pricing")}
              style={{background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.3)",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:600,color:"#a5b4fc",cursor:"pointer"}}>
              ↑ {isAr?"ترقية":"Upgrade"}
            </button>
          </div>
        </div>

        {/* Main 4 stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"14px 16px 8px"}}>
          {[
            {icon:"📊", label:isAr?"متوسط النقاط":"Avg Score",   value:avg||"--",  color:avg?sc(avg):cs.muted},
            {icon:"⏱",  label:isAr?"وقت الجلسة":"Session Time", value:`${Math.floor(sessionTime/60)}:${String(sessionTime%60).padStart(2,"0")}`, color:cs.text},
            {icon:"✅", label:isAr?"وضعية جيدة":"Good Posture",  value:gPct+"%",   color:"#10b981"},
            {icon:"🔔", label:isAr?"التنبيهات":"Alerts",         value:alertCounts.total, color:"#f59e0b"},
          ].map(s=>(
            <div key={s.label} style={{
              background:cs.card, border:`1px solid ${cs.border}`,
              borderRadius:12, padding:"12px 10px",
              display:"flex", flexDirection:"column", gap:4,
            }}>
              <div style={{fontSize:14}}>{s.icon}</div>
              <div style={{fontSize:20,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:9.5,color:cs.muted,fontWeight:500}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Secondary stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,padding:"0 16px 12px"}}>
          {[
            {label:isAr?"تنبيهات الرقبة":"Neck Alerts",  value:alertCounts.neck, color:"#ef4444"},
            {label:isAr?"تنبيهات المسافة":"Dist Alerts",  value:alertCounts.dist, color:"#f59e0b"},
            {label:"Session ID",                            value:sessionId?.slice(-6)||"—", color:cs.muted},
          ].map(s=>(
            <div key={s.label} style={{background:cs.card,border:`1px solid ${cs.border}`,borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:9,color:cs.muted,marginBottom:4}}>{s.label}</div>
              <div style={{fontSize:15,fontWeight:700,color:s.color,fontFamily:"monospace"}}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Score history chart */}
        <div style={{margin:"0 16px 12px",background:cs.card,border:`1px solid ${cs.border}`,borderRadius:14,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:600,color:cs.muted,textTransform:"uppercase",letterSpacing:".08em"}}>
              {isAr?"سجل النقاط":"Score History"}
            </div>
            {history.length>0&&(
              <div style={{fontSize:13,fontWeight:800,color:sc(history[history.length-1]||0)}}>
                {history[history.length-1]||0}/100
              </div>
            )}
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:2,height:68,position:"relative"}}>
            <div style={{position:"absolute",left:0,right:0,top:`${(1-80/100)*68}px`,
              borderTop:"1px dashed rgba(16,185,129,.2)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",left:0,right:0,top:`${(1-60/100)*68}px`,
              borderTop:"1px dashed rgba(245,158,11,.18)",pointerEvents:"none"}}/>
            {(history.length?history:Array(40).fill(0)).map((s,i)=>{
              const isLast=i===history.length-1;
              return (
                <div key={i} style={{
                  flex:1, borderRadius:"3px 3px 0 0",
                  minHeight:3,
                  height: s ? Math.max(3,Math.round(s*.64)) : 3,
                  background: s ? `linear-gradient(to top,${sc(s)},${sc(s)}99)` : "rgba(148,163,184,.07)",
                  transition:"height .25s ease",
                  boxShadow: isLast&&s ? `0 0 6px ${sc(s)}80` : "none",
                }}/>
              );
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:9,color:cs.muted}}>
            <span>{isAr?"الأقدم":"Oldest"}</span>
            <div style={{display:"flex",gap:8}}>
              <span style={{color:"rgba(16,185,129,.6)"}}>━ 80</span>
              <span style={{color:"rgba(245,158,11,.5)"}}>━ 60</span>
            </div>
            <span>{isAr?"الأحدث":"Newest"}</span>
          </div>
        </div>

        {/* AI insight */}
        {aiInsight&&(
          <div style={{margin:"0 16px 12px",background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.2)",borderRadius:12,padding:"12px 14px",animation:"fadeUp .3s ease"}}>
            <div style={{fontSize:9.5,fontWeight:700,color:"#10b981",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>
              {isAr?"تحليل AI":"AI Analysis"}
            </div>
            <div style={{fontSize:11.5,color:cs.text,lineHeight:1.65}}>{aiInsight}</div>
          </div>
        )}

        {/* Recommendations */}
        {analysis?.recommendations&&(
          <div style={{margin:"0 16px 12px",background:cs.card,border:`1px solid ${cs.border}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:9.5,fontWeight:700,color:cs.muted,textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>
              {isAr?"التوصيات":"Recommendations"}
            </div>
            {analysis.recommendations.map((r,i)=>(
              <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:i<analysis.recommendations.length-1?`1px solid ${cs.border}`:"none"}}>
                <span style={{color:"#6ee7b7",flexShrink:0,fontSize:12}}>✓</span>
                <span style={{fontSize:12,color:cs.text,lineHeight:1.5}}>{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* Alert log */}
        {alerts.length>0&&(
          <div style={{margin:"0 16px 16px",background:cs.card,border:`1px solid ${cs.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${cs.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:9.5,fontWeight:700,color:cs.muted,textTransform:"uppercase",letterSpacing:".06em"}}>
                {isAr?"سجل التنبيهات":"Alert Log"}
              </div>
              <span style={{fontSize:10,fontWeight:700,color:"#ef4444",background:"rgba(239,68,68,.12)",
                borderRadius:99,padding:"1px 7px"}}>{alerts.length}</span>
            </div>
            {alerts.slice(0,5).map((a,i)=>{
              const sev = a.score<40?"#ef4444":a.score<60?"#f59e0b":"#10b981";
              return (
                <div key={i} style={{display:"flex",gap:8,padding:"8px 14px",
                  borderBottom:i<Math.min(alerts.length,5)-1?`1px solid ${cs.border}`:"none",
                  alignItems:"center", background:i===0?"rgba(239,68,68,.03)":"transparent"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:sev,flexShrink:0}}/>
                  <span style={{fontSize:9,color:cs.muted,flexShrink:0,fontFamily:"monospace",minWidth:38}}>{a.time}</span>
                  <span style={{fontSize:11,color:cs.text,flex:1,lineHeight:1.4}}>{a.msg}</span>
                  <span style={{fontSize:11,fontWeight:800,color:sev,fontFamily:"monospace"}}>{a.score}</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{height:24}}/>
      </div>

      {/* ── RIGHT SIDEBAR — camera + controls ── */}
      <div style={{
        background:cs.card,
        borderLeft:  isAr ? "none" : `1px solid ${cs.border}`,
        borderRight: isAr ? `1px solid ${cs.border}` : "none",
        display:"flex", flexDirection:"column",
        maxHeight: isMobile ? "auto" : "100vh",
        overflowY:"auto",
        order: isAr ? 0 : 1,
        position: isMobile ? "static" : "sticky",
        top: 0,
      }}>
        {/* Sidebar header */}
        <div style={{
          padding:"10px 14px",
          borderBottom:`1px solid ${cs.border}`,
          display:"flex",alignItems:"center",justifyContent:"space-between",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:22,height:22,background:"linear-gradient(135deg,#1a56db,#0891b2)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>◈</div>
            <span style={{fontSize:12,fontWeight:700,color:cs.text}}>Corvus</span>
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            {TN&&<span style={{background:TN.colorDim,border:`1px solid ${TN.color}40`,borderRadius:5,padding:"2px 7px",fontSize:9.5,fontWeight:700,color:TN.color}}>{TN.name}</span>}
            {M_&&<span style={{background:"rgba(99,102,241,.1)",borderRadius:5,padding:"2px 7px",fontSize:9.5,fontWeight:700,color:M_.color}}>{M_.label}</span>}
          </div>
        </div>

        {/* AI model status */}
        <div style={{padding:"7px 14px",borderBottom:`1px solid ${cs.border}`,display:"flex",alignItems:"center",gap:6}}>
          <div style={{
            width:7,height:7,borderRadius:"50%",flexShrink:0,
            background:mpStatus==="ready"?"#10b981":"#f59e0b",
            boxShadow:mpStatus==="ready"?"0 0 6px #10b981":"0 0 6px #f59e0b",
            animation:mpStatus!=="ready"?"livePulse 1.2s infinite":"none",
          }}/>
          <span style={{fontSize:11,color:mpStatus==="ready"?"#10b981":"#f59e0b",fontWeight:500}}>
            {mpStatus==="ready"?(isAr?"نموذج AI جاهز ✓":"AI model ready ✓"):(isAr?"جاري التحميل...":"Loading model...")}
          </span>
        </div>

        {/* ── Quick Start Banner (for users who skipped onboarding) ─── */}
        {profile?.onboarding_done?.[0]==="skipped" && !score && (
          <div style={{margin:"10px 14px",background:"rgba(26,86,219,.08)",border:"1px solid rgba(26,86,219,.2)",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>👋</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:"#93c5fd"}}>
                {isAr?"هل تريد جولة سريعة؟":"Want a quick tour?"}
              </div>
              <div style={{fontSize:10,color:"#64748b",marginTop:1}}>
                {isAr?"اضغط لإعادة معالج الإعداد":"Tap to restart the setup wizard"}
              </div>
            </div>
            <button onClick={()=>setShowOnboard(true)}
              style={{background:"rgba(26,86,219,.2)",border:"1px solid rgba(26,86,219,.35)",borderRadius:8,padding:"5px 11px",fontSize:10,color:"#93c5fd",cursor:"pointer",fontWeight:700,flexShrink:0}}>
              {isAr?"إعادة":"Restart"}
            </button>
          </div>
        )}

        {/* Camera feed */}
        <div style={{position:"relative",aspectRatio:"4/3",background:"#020810",flexShrink:0}}>
          <video ref={vidRef} autoPlay muted playsInline
            style={{width:"100%",height:"100%",objectFit:"cover",transform:"scaleX(-1)",display:"block"}}/>
          <canvas ref={ovRef} style={{position:"absolute",inset:0,width:"100%",height:"100%",transform:"scaleX(-1)"}}/>
          <canvas ref={canvRef} style={{display:"none"}}/>

          {/* Camera status pill */}
          <div style={{position:"absolute",top:8,left:isAr?"auto":8,right:isAr?8:"auto"}}>
            {(()=>{
              const pill=(dot,label)=>(
                <div style={{
                  background:"rgba(2,8,16,.85)",borderRadius:99,
                  padding:"4px 10px",display:"flex",alignItems:"center",gap:5,
                  fontSize:10,color:"#fff",backdropFilter:"blur(6px)",
                  border:`1px solid ${dot}30`,
                }}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:dot,
                    boxShadow:`0 0 6px ${dot}`,
                    animation:dot==="#f59e0b"?"livePulse 1s infinite":"none"}}/>
                  {label}
                </div>
              );
              if(cameraStatus==="requesting") return pill("#f59e0b",isAr?"جاري الفتح...":"Opening...");
              if(cameraStatus==="denied")     return pill("#ef4444",isAr?"مرفوضة — اضغط سماح":"Denied — Allow camera");
              if(cameraStatus==="no-device")  return pill("#ef4444",isAr?"لا توجد كاميرا":"No camera found");
              if(cameraStatus==="ready"&&camActive) return pill("#10b981",`${M_?.label||""} · Live · ${Math.floor(sessionTime/60)}:${String(sessionTime%60).padStart(2,"0")}`);
              return pill("#64748b",isAr?"الكاميرا متوقفة":"Camera off");
            })()}
          </div>

          {/* Score overlay */}
        {/* Professional live metrics panel */}
        {analysis && score > 0 && (
          <div style={{
            position:"absolute", top:10, right:10,
            background:"rgba(2,8,20,.88)", backdropFilter:"blur(8px)",
            border:"1px solid rgba(255,255,255,.08)", borderRadius:12,
            padding:"10px 14px", minWidth:160, zIndex:10,
          }}>
            {/* Ergonomic Score */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,
              paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,.06)"}}>
              <div style={{
                width:38,height:38,borderRadius:"50%",
                background:`conic-gradient(${score>=75?"#10b981":score>=55?"#f59e0b":"#ef4444"} ${score*3.6}deg, rgba(255,255,255,.06) 0deg)`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:11,fontWeight:900,color:"#f0f6ff",flexShrink:0,
              }}>{score}</div>
              <div>
                <div style={{fontSize:9,color:"#64748b",fontWeight:600,letterSpacing:.5}}>
                  {isAr?"الدرجة الكلية":"ERGONOMIC SCORE"}
                </div>
                <div style={{fontSize:11,fontWeight:700,
                  color:score>=75?"#10b981":score>=55?"#f59e0b":"#ef4444"}}>
                  {score>=75?(isAr?"ممتاز":"Excellent"):score>=55?(isAr?"مقبول":"Fair"):(isAr?"ضعيف":"Poor")}
                </div>
              </div>
            </div>

            {/* Risk zones */}
            {[
              {
                label:    isAr?"الرقبة":"Neck",
                score:    analysis?.metrics?.neck_lean?.score,
                value:    analysis?.metrics?.neck_lean?.value,
                unit:     "°",
              },
              {
                label:    isAr?"الكتفين":"Shoulder",
                score:    analysis?.metrics?.shoulder_level?.score,
                value:    analysis?.metrics?.shoulder_level?.value,
                unit:     "°",
              },
              {
                label:    isAr?"الظهر":"Back",
                score:    analysis?.metrics?.spine_lean?.score ?? analysis?.metrics?.spine_upper?.score,
                value:    analysis?.metrics?.spine_lean?.value,
                unit:     "°",
              },
              {
                label:    isAr?"المسافة":"Distance",
                score:    analysis?.metrics?.screen_distance?.score,
                value:    analysis?.distCm,
                unit:     "cm",
              },
            ].map(({label,score:s,value,unit},i)=>{
              const col = s==null?"#475569":s>=80?"#10b981":s>=60?"#f59e0b":"#ef4444";
              const risk= s==null?(isAr?"—":"—"):s>=80?(isAr?"منخفض":"Low"):s>=60?(isAr?"متوسط":"Med"):(isAr?"مرتفع":"High");
              return (
                <div key={i} style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",marginBottom:5}}>
                  <div style={{fontSize:10,color:"#64748b",width:60}}>{label}</div>
                  <div style={{flex:1,height:4,background:"rgba(255,255,255,.06)",
                    borderRadius:2,margin:"0 6px",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${s??0}%`,
                      background:col,borderRadius:2,transition:"width .4s ease"}}/>
                  </div>
                  <div style={{fontSize:9,fontWeight:700,color:col,width:28,textAlign:"right"}}>
                    {risk}
                  </div>
                </div>
              );
            })}

            {/* Pain prediction */}
            {analysis?.pain_bar?.urgency && analysis.pain_bar.urgency !== "none" && (
              <div style={{marginTop:8,paddingTop:8,
                borderTop:"1px solid rgba(255,255,255,.06)"}}>
                <div style={{fontSize:9,color:analysis.pain_bar.color,fontWeight:700}}>
                  {isAr ? analysis.pain_bar.label_ar : analysis.pain_bar.label}
                </div>
              </div>
            )}
          </div>
        )}
          {score>0&&(
            <div style={{
              position:"absolute",bottom:8,right:isAr?"auto":8,left:isAr?8:"auto",
              background:"rgba(2,8,16,.92)",borderRadius:10,
              padding:"8px 12px",textAlign:"center",
              border:`2px solid ${sc(score)}60`,
              backdropFilter:"blur(8px)",
            }}>
              <div style={{fontSize:28,fontWeight:900,color:sc(score),lineHeight:1}}>{score}</div>
              <div style={{fontSize:9,color:sc(score),marginTop:2,fontWeight:600,opacity:.7}}>/100</div>
              <div style={{fontSize:8,color:"rgba(255,255,255,.5)",marginTop:1}}>
                {score>=80?(isAr?"ممتاز":"Excellent"):score>=60?(isAr?"جيد":"Good"):(isAr?"ضعيف":"Poor")}
              </div>
            </div>
          )}
        </div>

        {/* Score ring + user */}
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${cs.border}`}}>
          {/* User row */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            {profile?.photoURL
              ? <img src={profile.photoURL} style={{width:28,height:28,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>
              : <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,
                  background:`hsl(${(profile?.name||"U").split("").reduce((a,c)=>a+c.charCodeAt(0),0)%360},50%,30%)`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:12,fontWeight:700,color:"#fff"}}>
                  {(profile?.name||profile?.email||"U")[0].toUpperCase()}
                </div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:cs.text,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {profile?.name || profile?.email?.split("@")[0] || user?.email?.split("@")[0] || "User"}
              </div>
              <div style={{fontSize:9.5,color:cs.muted}}>
                {isAr?"المسافة المثلى":"Optimal"}: {M_?.optDist[0]}–{M_?.optDist[1]}cm
              </div>
            </div>
          </div>
          {/* Score + grade */}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Ring score={score} size={52}/>
            <div style={{flex:1}}>
              <div style={{fontSize:18,fontWeight:900,color:scoreColor,lineHeight:1}}>
                {score||0}<span style={{fontSize:10,color:cs.muted,fontWeight:400}}>/100</span>
              </div>
              <div style={{fontSize:12,fontWeight:600,color:scoreColor,marginTop:2}}>
                {score ? grade(score,t) : (isAr?"ابدأ الكاميرا":"Start camera")}
              </div>
              {/* Mini progress bar */}
              <div style={{marginTop:6,height:3,borderRadius:99,background:"rgba(255,255,255,.06)"}}>
                <div style={{height:"100%",width:`${score||0}%`,borderRadius:99,
                  background:`linear-gradient(90deg,${scoreColor}88,${scoreColor})`,
                  transition:"width .4s ease"}}/>
              </div>
            </div>
          </div>
        </div>

        {/* Percentile badge */}
        {analysis?.percentile != null && (
          <div style={{padding:"6px 14px",borderBottom:`1px solid ${cs.border}`,
            background:"rgba(99,102,241,.06)",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:16}}>🏆</span>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:"#a5b4fc"}}>
                {isAr
                  ? `أحسن من ${analysis.percentile}% من المستخدمين`
                  : `Better than ${analysis.percentile}% of users`}
              </div>
            </div>
            <div style={{fontSize:18,fontWeight:900,color:"#818cf8"}}>
              {analysis.percentile}%
            </div>
          </div>
        )}

        {/* Pain bar */}
        {analysis?.pain_bar && analysis.pain_bar.urgency !== "none" && (
          <div style={{padding:"7px 14px",borderBottom:`1px solid ${cs.border}`,
            background:`${analysis.pain_bar.color}12`,
            borderLeft:`3px solid ${analysis.pain_bar.color}`}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              <span style={{fontSize:13}}>
                {analysis.pain_bar.urgency==="imminent"?"🔴":
                 analysis.pain_bar.urgency==="soon"?"🟠":"🟡"}
              </span>
              <div style={{fontSize:10,fontWeight:700,color:analysis.pain_bar.color}}>
                {isAr ? analysis.pain_bar.label_ar : analysis.pain_bar.label}
              </div>
            </div>
            <div style={{height:3,borderRadius:99,background:"rgba(255,255,255,.08)"}}>
              <div style={{height:"100%",borderRadius:99,
                width:`${Math.min(100,analysis.pain_bar.pct||0)}%`,
                background:analysis.pain_bar.color,
                transition:"width .5s ease"}}/>
            </div>
          </div>
        )}

        {/* Live metrics */}
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${cs.border}`}}>
          <div style={{fontSize:9.5,fontWeight:600,color:cs.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>
            {isAr?"القياسات المباشرة":"Live Metrics"}
          </div>
          {analysis?.metrics
            ? Object.entries(analysis.metrics).map(([k,m])=><MetRow key={k} label={m.label} value={m.value} unit={m.unit} score={m.score} cs={cs}/>)
            : (
              <div>
                <div style={{display:"flex",flexDirection:"column",gap:8,padding:"4px 0 8px"}}>
                  {["Neck lean","Head tilt","Shoulder level","Spine lean"].map((m,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:cs.muted,flex:1}}>{isAr?["انحناء الرقبة","إمالة الرأس","مستوى الكتفين","انحناء العمود"][i]:m}</span>
                      <div style={{width:80,height:3,borderRadius:99,
                        background:`rgba(255,255,255,${.03+i*.01})`,overflow:"hidden"}}>
                        <div style={{height:"100%",width:"0%",background:"rgba(148,163,184,.1)"}}/>
                      </div>
                      <span style={{fontSize:10,color:"rgba(255,255,255,.15)",minWidth:16,textAlign:"right"}}>—</span>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:cs.muted,textAlign:"center",padding:"2px 0"}}>
                  {isAr?"ابدأ الكاميرا للتحليل":"Start camera to see metrics"}
                </div>
                <div style={{background:"rgba(16,185,129,.05)",border:"1px solid rgba(16,185,129,.12)",borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:9.5,fontWeight:700,color:"#10b981",marginBottom:8,textTransform:"uppercase",letterSpacing:".05em"}}>
                    {isAr?"نصائح الوضعية الصحيحة":"Correct Posture Tips"}
                  </div>
                  {(isAr?[
                    "👁️ الشاشة على مستوى العين أو أسفل بقليل",
                    "📏 المسافة من الشاشة 50-80 سم",
                    "🦷 الذقن موازٍ للأرض",
                    "💺 الظهر ملاصق للكرسي — دعم أسفل الظهر",
                    "🦵 الركبتين بزاوية 90° — القدمين على الأرض",
                    "💪 الكتفين متساويين ومرتخيين",
                  ]:[
                    "👁️ Monitor top at or slightly below eye level",
                    "📏 Screen distance: 50-80cm",
                    "🦷 Chin parallel to floor — don't tilt head down",
                    "💺 Back fully in chair — use lumbar support",
                    "🦵 Knees at 90° — feet flat on floor",
                    "💪 Shoulders level and relaxed",
                  ]).map((tip,i,arr)=>(
                    <div key={i} style={{
                      fontSize:11,color:cs.muted,padding:"5px 0",lineHeight:1.5,
                      borderBottom:i<arr.length-1?`1px solid ${cs.border}`:"none",
                    }}>{tip}</div>
                  ))}
                </div>
              </div>
            )
          }
        </div>

        {/* Distance bar */}
        {distCm&&M_&&(
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${cs.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:10,color:cs.muted,fontWeight:600}}>{isAr?"المسافة":"Distance"}</span>
              <span style={{fontSize:12,fontWeight:700,color:distCm>=M_.optDist[0]&&distCm<=M_.optDist[1]?"#10b981":distCm>=(M_.optDist[0]-15)?"#f59e0b":"#ef4444"}}>
                {Math.round(distCm)}cm
              </span>
            </div>
            <div style={{position:"relative",height:8,background:"rgba(148,163,184,.08)",borderRadius:99,overflow:"hidden"}}>
              <div style={{position:"absolute",left:"28%",top:0,bottom:0,width:"44%",background:"rgba(16,185,129,.15)",borderRadius:99}}/>
              <div style={{
                position:"absolute",top:1,bottom:1,
                left:`${clamp((distCm-20)/(115-20)*100,2,96)}%`,
                width:6,borderRadius:99,
                background:distCm>=M_.optDist[0]&&distCm<=M_.optDist[1]?"#10b981":distCm>=(M_.optDist[0]-15)?"#f59e0b":"#ef4444",
                transition:"left .4s ease",
              }}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:9,color:cs.muted}}>
              <span>20cm</span><span style={{color:"#10b981"}}>{M_.optDist[0]}–{M_.optDist[1]}cm ✓</span><span>115cm</span>
            </div>
          </div>
        )}

        {/* Lighting warning */}
        {lowLight && (
          <div style={{padding:"8px 14px",background:"rgba(245,158,11,.12)",borderBottom:`1px solid ${cs.border}`,
            display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#f59e0b",fontWeight:600}}>
            💡 {isAr?"الإضاءة ضعيفة — حسّن الإضاءة لقراءات أدق":"Low lighting — improve lighting for more accurate readings"}
          </div>
        )}

        {/* Alert message */}
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${cs.border}`}}>
          <div style={abox(alertMsg.type)}>{alertMsg.text}</div>
        </div>

        {/* Main controls */}
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:8,borderBottom:`1px solid ${cs.border}`}}>
          {!camActive
            ? <button onClick={startCamera} style={{
                width:"100%",background:`linear-gradient(135deg,${TN?.color||"#1a56db"},${TN?.colorDim||"#0891b2"})`,
                border:"none",borderRadius:12,padding:"14px 0",
                fontSize:14,fontWeight:800,color:"#fff",cursor:"pointer",
                boxShadow:`0 4px 20px ${TN?.color||"#1a56db"}50`,
                letterSpacing:"-.01em",
              }}>
                {isAr?"▶ ابدأ التحليل":"▶ Start Analysis"}
              </button>
            : <button onClick={stopCamera} style={{
                width:"100%",
                background:"linear-gradient(135deg,rgba(239,68,68,.18),rgba(220,38,38,.12))",
                color:"#fca5a5",
                border:"1px solid rgba(239,68,68,.5)",borderRadius:10,
                padding:"13px 0",fontSize:14,fontWeight:700,cursor:"pointer",
                boxShadow:"0 2px 12px rgba(239,68,68,.2)",
                letterSpacing:"-.01em",
              }}>
                {isAr?"⏹ إيقاف وحفظ":"⏹ Stop & Save"}
              </button>
          }
          {histRef.current?.length>0&&(
            <button onClick={async ()=>{
              const hist=histRef.current||[];
              const sc=hist.length?Math.round(hist.reduce((a,b)=>a+b,0)/hist.length):0;
              const dur=sessRef.current?Math.floor((Date.now()-sessRef.current)/1000):0;
              const gp=totalRef.current?Math.round(goodRef.current/totalRef.current*100):0;
              try {
                const { generateSessionPDF } = await import("./firebase.js");
                await generateSessionPDF({
                  session:{ avg_score:sc, duration_s:dur, good_pct:gp,
                    alerts_count:acRef.current?.total||0, mode, tier,
                    score_history:hist.slice(-40), created_at:new Date() },
                  profile, user, lang,
                  sessionIndex:(userSessions.length||0)+1,
                });
              } catch(e){ addToast("PDF: "+(e?.message||"error"),"error"); }
            }} style={{
              background:"rgba(59,130,246,.08)",color:"#93c5fd",
              border:"1px solid rgba(59,130,246,.2)",borderRadius:10,
              padding:"10px 0",fontSize:12,fontWeight:600,cursor:"pointer",
            }}>
              {isAr?"📄 تنزيل PDF":"📄 Download PDF"}
            </button>
          )}
          <button onClick={()=>setMuted(v=>!v)} style={{
            background:"rgba(148,163,184,.06)",color:muted?cs.muted:"#10b981",
            border:`1px solid ${muted?cs.border:"rgba(16,185,129,.25)"}`,
            borderRadius:10,padding:"8px 0",fontSize:12,fontWeight:500,cursor:"pointer",
          }}>
            {muted?(isAr?"🔇 الصوت متوقف":"🔇 Sound OFF"):(isAr?"🔊 الصوت شغّال":"🔊 Sound ON")}
          </button>
        </div>

        {/* Tools moved to Dashboard — see HomePage tools tab */}

        {/* Calibration active badge */}
        {calibData&&(
          <div style={{margin:"10px 14px 0",background:"rgba(16,185,129,.07)",border:"1px solid rgba(16,185,129,.2)",borderRadius:9,padding:"7px 10px",textAlign:"center",fontSize:11,color:"#10b981",fontWeight:500}}>
            ✓ {isAr?"المعايرة الشخصية نشطة":"Personal calibration active"}
          </div>
        )}

        {/* Company setup nudge */}
        {profile&&!profile.company_id&&(profile.tier==="professional"||profile.tier==="elite")&&(
          <div style={{margin:"10px 14px",background:"rgba(16,185,129,.05)",border:"1px solid rgba(16,185,129,.15)",borderRadius:9,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <span style={{fontSize:11,color:cs.muted}}>🏢 {isAr?"إعداد مساحة الشركة":"Set up company workspace"}</span>
            <button onClick={()=>setShowCompanyOnboard(true)}
              style={{background:"#10b981",border:"none",borderRadius:7,padding:"4px 10px",fontSize:10,fontWeight:700,color:"#fff",cursor:"pointer",flexShrink:0}}>
              {isAr?"ابدأ":"Start"}
            </button>
          </div>
        )}

        {/* Break reminder */}
        {showBreakAlert&&(
          <div style={{margin:"10px 14px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.3)",borderRadius:12,padding:"12px 14px",textAlign:"center",animation:"fadeUp .3s ease"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#fcd34d",marginBottom:4}}>⏰ {isAr?"وقت استراحة!":"Break time!"}</div>
            <div style={{fontSize:11,color:cs.muted,marginBottom:10}}>
              {isAr?"25 دقيقة مرت — استرح دقيقتين":"25 min passed — take a 2-min stretch"}
            </div>
            <button onClick={()=>{setShowBreakAlert(false);setBreakTimer(0);}}
              style={{background:"rgba(245,158,11,.15)",border:"1px solid rgba(245,158,11,.3)",borderRadius:8,padding:"7px 18px",fontSize:12,fontWeight:600,color:"#fcd34d",cursor:"pointer"}}>
              {isAr?"تم ✓":"Done! Resume →"}
            </button>
          </div>
        )}

        <div style={{padding:"10px 14px",fontSize:9.5,color:cs.muted,textAlign:"center"}}>
          Firebase synced · Local AI
        </div>
      </div>
    </div>
  </ErrorBoundary>);
}









