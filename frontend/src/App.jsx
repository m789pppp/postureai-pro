// BUILD:

// Global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[Corvus] Unhandled promise rejection:', e.reason);
    // Prevent blank screen crashes from promise rejections
    e.preventDefault();
  });
}
import React, { lazy, Suspense, useState, useEffect, useRef, useCallback, startTransition } from "react";
import { API_BASE_URL, apiHealthCheck } from "./config/api.js";
import { CAMERA_VERSION, consentDocPath, makeConsentGrant, hasCurrentConsent } from "./lib/consent.js";
import { decimate, sessionTrend } from "./lib/clinicalMetrics.js";
import {
  auth, db, signInGoogle, getGoogleRedirectResult, signInEmail, signUpEmail, logOut, resetPassword,
  onAuthStateChanged, createUserProfile, getUserProfile,
  updateUserTier, saveSession, recordPayment, confirmPayment,
  rejectPayment, listenToPayment, getAllPayments, getAllUsers,
  isHREmail, isCompanyDomain, isAutoApproveEmail,
  SUPPORT_EMAIL, ADMIN_PHONE,
  AUTO_APPROVE_DOMAIN, serverTimestamp,
  notifyPaymentPending, notifyPaymentConfirmed,
  getCompany, createCompany, getUserSessions, onUserSessions, onUserProfile, updateUserProfile,
  checkAndDowngradeTrial, completeOnboardingStep, getReferralStats, checkAndSendNurtureEmails,
  doc, updateDoc, getDoc, setDoc,
} from "./firebase.js";
import { HRPanel } from "./HRPanel.jsx";
const TherapistMarketplace = lazy(()=>import("./TherapistMarketplace.jsx").then(m=>({default:m.TherapistMarketplace})));
const SymptomCorrelation = lazy(()=>import("./SymptomCorrelation.jsx").then(m=>({default:m.SymptomCorrelation})));
import { ErrorBoundary } from "./ErrorBoundary.jsx";
import { CalibrationWizard, useCalibration, applyCalibration } from "./PostureCalibration.jsx";
import { BreakTimer, useBreakTimer, useScoreSmoothing, useSoundFeedback, usePainPrediction } from "./PostureUtils.jsx";
import { AICoach } from "./AICoach.jsx";
import { preloadAIInsights } from "./aiPreloader.js";
import { NotificationsHub, useNotifications } from "./NotificationsHub.jsx";
import { OnboardingWizard } from "./OnboardingWizard.jsx";
const GamificationPanel = lazy(()=>import("./Gamification.jsx").then(m=>({default:m.GamificationPanel})));
import { BillingModal, PLANS } from "./Billing.jsx";
import { AnalysisAPI, ReportAPI, EmailAPI, EnterpriseAPI, AdminAPI, AIAPI, PaymentAPI, NotifyAPI, FamilyAPI, apiFetch } from "./services/api.js";
import { geminiAnalysis as _aiAnalysis } from "./gemini.js";
import { getLocalAIStatus, onLocalAIStatus } from "./localAI.js";
import { useToasts, useOnline, useKeyboardShortcut } from "./hooks/index.js";
import { Toasts, Ring, MetRow, Skeleton, TierBadge, EmptyState, Btn, BarChart, OfflineBanner, SessionDetailModal, ModalPortal } from "./ui/index.jsx";
import {
  LT, Icon, IconBtn, Btn as LiveBtn, StatusPill, SectionCard, StatTile, MetricRow,
  LiveHeader, ScoreGauge, AICoachCard, CameraFrame, CameraOverlay, OverlayCard, StartingRing,
  CountdownRing, GuidanceHint, useLiveUICSS, fmtTime, scoreTierColor, alpha as liveAlpha,
  Switch, SettingsRow, SettingsDivider,
} from "./LiveUI.jsx";
import { gradeScore, gradeScoreAr, gradeContext, scoreColor, playBeep, playBreakChime, primeAudio, sendDesktopNotif, requestNotificationPermission, notificationState, MODES, analyzeMP as _engAnalyzeMP, createLandmarkSmoother, createFrameBuffer, createDistanceSmoother, resetProportions } from "./features/analysis/postureEngine.js";
import { speakCoach, setVoiceCoachEnabled, stopSpeaking, isVoiceCoachEnabled, primeSpeech, hasVoiceFor, resetSpeechCooldown } from "./lib/voiceCoach.js";
// Rendered inline in the Live session-settings panel (and, as a full card, on
// the account settings page) so the coach's accent/voice/speed are reachable
// without leaving the session.
const VoiceCoachSettings = lazy(() => import("./VoiceCoachSettings.jsx"));
// Turns the engine's metrics into explained findings — what is wrong, how
// serious, why it matters, what to do, then the numbers. One source of truth
// for that wording, so the live panel, the session summary and the reports
// cannot describe the same measurement three different ways.
const FindingsPanel = lazy(() => import("./FindingsPanel.jsx"));
import { CustomAlertRulesPanel, useCustomAlertRuleEngine, ALERT_METRICS } from "./CustomAlertRules.jsx";
import { getT } from "./lib/i18n.js";
import { tierAtLeast, qualityFor } from "./lib/tierQuality.js";
// DESIGN import removed — use COLORS, TYPE, SPACE directly from DesignSystem.js
// ── Phase 12: Enterprise Scale ────────────────────────────────────
import { EnterpriseAdminTools }from "./EnterpriseAdminTools.jsx";
import LandingPageV7 from "./LandingPageV7.jsx";
import { DemoWelcome, DemoDashboard, clearDemoOnExit } from "./DemoModeUI.jsx";
import { saveDemoSession } from "./DemoMode.js";
const Landing = LandingPageV7; // alias so <Landing> works
import { CompanyOnboarding, CompanyBar, useCompany } from "./CompanySystem.jsx";
import { handleSSORedirect } from "./EnterpriseSSO.jsx";
// initSentry moved to sentry.js (V12)
const CertBadgeModal = lazy(()=>import("./CertificatePage.jsx").then(m=>({default:m.CertBadgeModal})));
const QuarterlyReportModal = lazy(()=>import("./CorporateWellness.jsx").then(m=>({default:m.QuarterlyReportModal})));
const SchoolsModal = lazy(()=>import("./CorporateWellness.jsx").then(m=>({default:m.SchoolsModal})));
const DeveloperPortalModal = lazy(()=>import("./DeveloperPortal.jsx").then(m=>({default:m.DeveloperPortalModal})));
const InsurancePartnerModal = lazy(()=>import("./DeveloperPortal.jsx").then(m=>({default:m.InsurancePartnerModal})));
import AuthPage            from "./AuthPage.jsx";
import ResetPasswordPage    from "./ResetPasswordPage.jsx";
import EmailVerificationPage from "./EmailVerificationPage.jsx";
import ChangePasswordPage    from "./ChangePasswordPage.jsx";
import TrialExpiredPage      from "./TrialExpiredPage.jsx";
import HomePage from "./HomePage.jsx";
import BreakPage from "./BreakPage.jsx";
import { drawFaceBlur } from "./lib/faceBlur.js";
import AccountSwitcher from "./AccountSwitcher.jsx";
import PricingPage from "./PricingPage.jsx";
import InviteAccept from "./InviteAccept.jsx";
import { NotFound } from "./ErrorPage.jsx";
import SessionComparison from "./SessionComparison.jsx";
import TrendChart from "./TrendChart.jsx";
import { ShareCard }        from "./ShareCard.jsx";
import { CookieConsent, LegalFooter } from "./LegalCompliance.jsx";
import { QAAccuracyTest } from "./QAAccuracyTest.jsx";
import { ProductTour, TourTrigger } from "./ProductTour.jsx";
import AnnouncementsBar    from "./AnnouncementsBar.jsx";
import SecurityCenter       from "./SecurityCenter.jsx";
import FeatureFlags         from "./FeatureFlags.jsx";
import OnboardingAnalytics  from "./OnboardingAnalytics.jsx";
import { initSentry, identifyUser, captureError } from "./sentry.js";
import { AccountActivity } from "./AccountActivity.jsx";
// ── Merged from v13 & v18 ─────────────────────────────────────────
import { HelpCenter }     from "./HelpCenter.jsx";
import { APIChangelog }   from "./APIChangelog.jsx";
import EmbedWidget        from "./EmbedWidget.jsx";

// API URL: set VITE_API_URL in .env.local for production
// Example: VITE_API_URL=https://corvus-backend.onrender.com/api
const API = API_BASE_URL;

// ── i18n ──────────────────────────────────────────────────────────
// ── i18n: translations loaded from lib/i18n.js ─────────────────
// TR alias kept for backward compatibility — delegates to getT()
const TR = {
  en: getT("en"),
  ar: getT("ar"),
};

// ══════════════════════════════════════════════════════════════════
// CORVUS — Single Source of Truth for Pricing
// EGP = Egypt market (Kashier) · USD = Gulf/International market (Stripe)
// Annual = 20% discount (2 months free) — applied at checkout, not stored here
// ══════════════════════════════════════════════════════════════════
const COUPONS = {}; // Coupons validated server-side via /api/coupon/validate

// ── B2C Pricing (Egypt + Gulf) ────────────────────────────────────
// Egypt: Kashier in EGP | Gulf/Global: Stripe in USD
// Amounts stored in CENTS (EGP cents / USD cents)
/**
 * Arabic copy for a live posture alert, keyed by the engine's cause.
 *
 * The engine builds its alert text in English only. Before the live loop used
 * that list it had hand-written Arabic for its three hardcoded causes; routing
 * through the engine would otherwise have shown English mid-session to Arabic
 * users, which is a regression even though the advice got better. Values are
 * filled from the same metrics the English copy uses, so the two stay in step.
 */
function msgArFor(causeKey, res) {
  const m = res?.metrics || {};
  const v = k => m[k]?.value;
  switch (causeKey) {
    // Lateral measurement, lateral instruction — see the neck alerts in
    // postureEngine.js for why "raise the screen" was the wrong correction.
    case "neck":    return `راسك مايلة ${v("neck_lean")}° على جنب — رجّعها فوق كتفيك`;
    case "fhp":     return `الرأس لقدام ${v("fhp_index")}سم — ارجع دقنك لورا وارفع الشاشة`;
    case "spine":   return `مايل ${(m.spine_lean?.signed ?? 0) > 0 ? "يمين" : "شمال"} ${v("spine_lean")}° — اقعد في النص وثبّت وزنك على الجنبين`;
    case "slouch":  return `منحني لقدام — رصّ ضهرك على الكرسي وخلي صدرك فوق حوضك`;
    case "twist":
    case "rot":     return `جذعك ملتوي ${v("trunk_rotation")}° — لف الكرسي ناحية الشاشة بدل ما تلف جسمك`;
    case "shrug":   return `كتافك مرفوعة — رخّيهم لتحت ولورا`;
    case "round":   return `كتافك لقدام — افتح صدرك وقرّب لوحي كتفك`;
    case "tilt":    return `راسك مايلة ${v("head_tilt")}° — راجع ارتفاع الكرسي`;
    case "sh":      return `فرق في مستوى الكتفين ${v("shoulder_level")}° — اظبط مساند الذراع`;
    case "yaw":     return `الرأس مائل ${Math.abs(v("head_yaw") || 0)}° — واجه الشاشة مباشرة`;
    case "dist":    return `المسافة ${v("screen_distance")}سم — اظبط بعدك عن الشاشة`;
    case "elbow":   return `زاوية الكوع ${v("elbow_angle")}° — اظبط ارتفاع الكيبورد`;
    case "mon":     return `ارتفاع الشاشة مش مظبوط — خلي أعلى الشاشة عند مستوى عينيك`;
    default:        return null;
  }
}

const TIERS = {
  standard:{
    id:"standard", name:"Free", color:"#6366f1", colorDim:"rgba(99,102,241,.12)",
    price_egp_monthly:0,     price_egp_yearly:0,
    price_usd_monthly:0,     price_usd_yearly:0,
    features:["5 sessions/month (max 3/day)","Posture score","Basic alerts"],
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
    id:"elite", name:"Elite", color:"#D6A24C", colorDim:"rgba(214,162,76,.12)",
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
// per-seat. Egypt: Kashier EGP | Gulf: Stripe USD.
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
    features:["Up to 100 employees","Everything in Starter","Custom alert rules","Clinical PDF reports","Advanced HR analytics","Slack/Teams alerts","Executive HR reports","Priority support"],
    featuresAr:["حتى 100 موظف","كل مزايا ستارتر","قواعد تنبيه مخصّصة","تقارير PDF إكلينيكية","تحليلات HR متقدمة","تنبيهات Slack/Teams","تقارير HR تنفيذية","دعم أولوية"],
    badge:"Most Popular",
  },
  b2b_enterprise: {
    id:"b2b_enterprise", name:"Enterprise", nameAr:"إنتربرايز",
    color:"#4FAE8E", colorDim:"rgba(79,174,142,.12)",
    price_egp_monthly:null, price_egp_yearly:null,    // Custom — contact sales
    price_usd_monthly:null, price_usd_yearly:null, price_usd_starting_at:499, // Starting at $499/mo
    seats:-1,
    features:["Unlimited employees","Everything in Growth","Corvus AI clinical narrative","SAML SSO (Azure AD / Okta) — provisioned with our team","White-label branding","API + Webhooks access","Dedicated success manager","Negotiated availability commitment"],
    featuresAr:["موظفون غير محدودون","كل مزايا جروث","تحليل سردي بالذكاء الاصطناعي","SAML SSO (Azure AD / Okta) — بإعداد من فريقنا","علامة تجارية White-label","وصول API + Webhooks","مدير نجاح مخصص","التزام تشغيل بالاتفاق"],
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
// Lowercase first — Firestore docs sometimes carry "Elite"/"ELITE"/"Professional",
// which otherwise skip the map and break TIERS[...] lookups downstream.
const normalizeTier=(t)=>{const k=String(t||"").toLowerCase().trim();return TIER_NORMALIZE[k]||k||"standard";};

// ── Payment Methods — Kashier ─────────────────────────────────────
const PAY_METHODS = [
  {id:"visa_card",   name:"Visa / Mastercard", nameAr:"فيزا / ماستركارد",
   icon:"💳", color:"#1a56db", instant:true,
   desc:"Activated immediately after payment",
   descAr:"يُفعَّل الاشتراك فور الدفع",
   type:"card"},
  {id:"vodafone_cash", name:"Vodafone Cash",  nameAr:"Vodafone Cash",
   icon:"📱", color:"#e4002b", instant:true,
   desc:"Pay via Kashier Vodafone Cash wallet",
   descAr:"ادفع عبر Vodafone Cash بـ Kashier",
   type:"wallet"},
];

// Personal/individual users share the same TIERS pricing as companies —
// acct_type ("individual" vs "company") determines seat count display only.
// Legacy personal_basic/personal_pro/personal_elite IDs are normalized via TIER_NORMALIZE.

// Emails that can access HR Panel and Admin Panel
// HR_EMAILS — list of emails with HR admin access
const HR_EMAILS = [];

// textDim and red: used in 11 files (MFASetup, WhiteLabel, APIMarketplace,
// MultiTenantManager, EnterpriseAdminTools, IntegrationsHub,
// ReferralProgram, AccountActivity, APIChangelog, and here in App.jsx)
// as `cs.textDim`/`cs.red` — neither key ever existed here, so every one
// of those was `color: undefined`, silently dropped by React and falling
// back to inherited text color in both themes, not just light mode.
// textDim's real usage everywhere is identical to `muted` (de-emphasized
// secondary text), so it's aliased to the same value per theme rather
// than introducing a new, unreviewed shade. red is a dedicated error/
// danger accent (currently only App.jsx:1675's coupon-error input
// border) — not aliased to the existing #f87171 danger-text color used
// elsewhere in this file, since a 0.5px border needs more contrast than
// text does, especially against LIGHT's white card background.
const DARK  = {bg:"#030b14",card:"#05101f",card2:"#080f1e",border:"rgba(148,163,184,.1)",text:"#f0f4f8",muted:"#7b8aa3",textDim:"#7b8aa3",red:"#ef4444",blue:"#1a56db",inp:"rgba(148,163,184,.08)",inpB:"rgba(148,163,184,.15)"};
const LIGHT = {bg:"#f1f5f9",card:"#ffffff",card2:"#f8fafc",border:"rgba(100,116,139,.15)",text:"#0f172a",muted:"#5b6b80",textDim:"#5b6b80",red:"#dc2626",blue:"#1a56db",inp:"rgba(100,116,139,.07)",inpB:"rgba(100,116,139,.2)"};


// ── Helpers ───────────────────────────────────────────────────────
const sc    = v => v>=70?"#4FAE8E":v>=55?"#D6A24C":"#C6604F"; // aligned to gradeScore's tier boundaries (85/70/55/40) — see postureEngine.js
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const LM = {NOSE:0,L_EYE:2,R_EYE:5,L_EAR:7,R_EAR:8,L_SHOULDER:11,R_SHOULDER:12,L_HIP:23,R_HIP:24,L_KNEE:25,R_KNEE:26,L_ANKLE:27,R_ANKLE:28};
// ── API wrappers (use service layer with auth) ────────────────────
async function askGemini(prompt){
  try{
    const text = await _aiAnalysis(prompt, { maxTokens: 600 });
    return text || null;
  }catch{return null;}
}

async function initKashier({tier,user_email,user_name,billing,uid="",coupon_code,discount_code,discount_pct=0}){
  try{
    const {getAuthToken} = await import("./firebase.js");
    const tok = await getAuthToken().catch(()=>null);
    const r = await fetch("/api/kashier/create-order",{
      method:"POST",
      headers:{"Content-Type":"application/json",...(tok?{Authorization:"Bearer "+tok}:{})},
      body:JSON.stringify({
        tier, billing, uid,
        coupon_code: coupon_code||undefined,
        discount_code: discount_code||undefined,
        discount_pct: discount_pct||0,
        billing_data:{
          email:user_email,
          first_name:user_name?.split(" ")[0]||"Customer",
          last_name:user_name?.split(" ").slice(1).join(" ")||"",
        }
      })
    });
    const d = await r.json();
    if(d?.redirect_url) return{type:"redirect",url:d.redirect_url,creditApplied:d.credit_applied_egp||0};
    if(d?.error) console.error("Kashier error:",d.error);
  }catch(e){console.error("Kashier:",e);}
  return null;
}

// ── Local MediaPipe analysis (adapters for postureEngine result shape) ────
function analyzeMP(lms,W,H,mode,distCalibFactor,sessionStartMs,calibKnownDistCm,calib){
  // postureEngine returns {score, metrics, alerts, recommendations, detected, lms(named), raw}
  // App expects  {overall, distCm, lo, hi, metrics, lms(landmark refs), raw}
  const eng = _engAnalyzeMP(lms,W,H,mode,distCalibFactor,sessionStartMs,calibKnownDistCm,calib);
  if(!eng) return null;
  const dist = eng.metrics?.screen_distance;
  // lo/hi come from engine (no duplication)
  // The engine computes a posture-drift/fatigue penalty (real physical
  // degradation over a 10+ min session) into fatigue_adjusted_score, but
  // until now nothing downstream ever read it — the live score, the
  // saved session's avg_score, alert severity, and the PDF report all
  // used the pre-penalty eng.score, so the penalty was computed every
  // frame (a real per-frame cost) and shown only as an inert "Fatigue
  // −Npt" badge that never affected the number beside it. Use the
  // fatigue-adjusted score as the one true "overall" everywhere — the
  // badge now describes a real adjustment instead of a decorative one.
  return{
    overall: eng.fatigue_adjusted_score ?? eng.score,
    rawScore: eng.score,
    distCm:  dist?.value || eng.distCm || null,
    lo:      eng.lo,
    hi:      eng.hi,
    metrics:            eng.metrics,
    alerts:             eng.alerts,
    bodyModules:        eng.bodyModules,
    detectedConditions: eng.detectedConditions,
    qualityScore:       eng.qualityScore,
    qualityReason:      eng.qualityReason,
    confidence:         eng.confidence,
    calibrationStatus:  eng.calibrationStatus,
    personalised:       eng.personalised,
    fatigue_adjusted_score: eng.fatigue_adjusted_score,
    // Rebuild lms refs for drawFront overlay
    lms: _buildLmsRefs(lms,W,H),
    raw: {neckLean:eng.metrics?.neck_lean?.value, headTilt:eng.metrics?.head_tilt?.value,
          shTilt:eng.metrics?.shoulder_level?.value, spineLean:eng.metrics?.spine_lean?.value,
          distCm:eng.distCm, lo:eng.lo, hi:eng.hi},
  };
}

// analyzeSideMP wrapper and _buildSideLmsRefs removed — Side mode was
// removed app-wide, these had no remaining callers.

function _buildLmsRefs(lms,W,H){
  if(!lms||lms.length<25) return {};
  const g=i=>lms[i], px=i=>({x:g(i).x,y:g(i).y});
  const lSh=px(11),rSh=px(12),lEar=px(7),rEar=px(8),lEye=px(2),rEye=px(5),lHip=px(23),rHip=px(24);
  return{lSh,rSh,lEar,rEar,lEye,rEye,
    midSh:{x:(lSh.x+rSh.x)/2,y:(lSh.y+rSh.y)/2},
    midEar:{x:(lEar.x+rEar.x)/2,y:(lEar.y+rEar.y)/2},
    midHip:{x:(lHip.x+rHip.x)/2,y:(lHip.y+rHip.y)/2}};
}

// ── Session pattern tracking: creep, chronic asymmetry, breathing ──
// These are session-LEVEL observations, not single-frame thresholds —
// a fresh tracker is created per camera session (see _newInsightsTracker)
// and fed one sample per analyzed frame via _trackSessionPatterns,
// which returns a new insight to surface (or null).
function _newInsightsTracker(){
  return {
    sessionStart: 0,
    neck: { curMinute:-1, curSum:0, curCount:0, minuteAvgs:[] },
    shAsym: { curMinute:-1, curSum:0, curCount:0, minuteAvgs:[] },
    breath: { buf:[], lastPush:0 },
    lastFire: { creep:0, asym:0, breath:0 },
  };
}

function _trackSessionPatterns(tr, now, midShY, neckLeanVal, neckReliable, shTiltSigned, shReliable, isAr, flags={creep:true,asymmetry:true,breathing:true}){
  if(!tr.sessionStart) tr.sessionStart = now;
  const insights = [];

  // ── #4 Micro-posture creep: slow drift vs the session's first ~2 min ──
  // Gated to Professional+ (tier quality) — see frontend/src/lib/tierQuality.js
  if(flags.creep && neckReliable && Number.isFinite(neckLeanVal)){
    const b = tr.neck;
    const minuteIdx = Math.floor((now - tr.sessionStart)/60000);
    if(minuteIdx !== b.curMinute){
      if(b.curCount>0) b.minuteAvgs.push(b.curSum/b.curCount);
      b.curMinute=minuteIdx; b.curSum=0; b.curCount=0;
    }
    b.curSum += neckLeanVal; b.curCount++;
    if(b.minuteAvgs.length>=15 && now-tr.lastFire.creep>600000){
      const baseline = (b.minuteAvgs[0]+b.minuteAvgs[1])/2;
      const recent = (b.minuteAvgs[b.minuteAvgs.length-1]+b.minuteAvgs[b.minuteAvgs.length-2])/2;
      const drift = recent - baseline;
      if(drift > 8){
        tr.lastFire.creep = now;
        insights.push({
          icon:"📉",
          text:`Posture creep detected: neck lean drifted +${Math.round(drift)}° vs the start of this session — worth a conscious reset, not just a single bad moment`,
          textAr:`ملاحظة: وضعيتك بتزيد ميلها تدريجيًا — رقبتك زادت ${Math.round(drift)}° عن بداية الجلسة. مش لحظة سيئة واحدة، ده انحدار بطيء يستاهل تصحيح واعي`,
        });
      }
    }
  }

  // ── #5 Chronic asymmetry: consistent SAME-direction shoulder tilt over the session ──
  // Gated to Professional+ (tier quality)
  if(flags.asymmetry && shReliable && Number.isFinite(shTiltSigned)){
    const b = tr.shAsym;
    const minuteIdx = Math.floor((now - tr.sessionStart)/60000);
    if(minuteIdx !== b.curMinute){
      if(b.curCount>0) b.minuteAvgs.push(b.curSum/b.curCount);
      b.curMinute=minuteIdx; b.curSum=0; b.curCount=0;
    }
    b.curSum += shTiltSigned; b.curCount++;
    if(b.minuteAvgs.length>=20 && now-tr.lastFire.asym>900000){
      const sameSign = b.minuteAvgs.filter(v=>Math.sign(v)===Math.sign(b.minuteAvgs[0])).length;
      const consistency = sameSign / b.minuteAvgs.length;
      const avgMag = Math.abs(b.minuteAvgs.reduce((a,c)=>a+c,0)/b.minuteAvgs.length);
      if(consistency>0.8 && avgMag>4){
        tr.lastFire.asym = now;
        const side = b.minuteAvgs[0]>0 ? (isAr?"الأيمن":"right") : (isAr?"الأيسر":"left");
        insights.push({
          icon:"⚖️",
          text:`Consistent shoulder asymmetry this session: ${side} shoulder lower on average (~${Math.round(avgMag)}°). Could be chair/monitor setup, habit, or worth mentioning to a physiotherapist if it persists across sessions — not a diagnosis`,
          textAr:`ميل ثابت في الكتف ${side} طول الجلسة (~${Math.round(avgMag)}°). ممكن يكون سبب الكرسي/مكان الشاشة أو عادة، ولو استمر في جلسات كتير يستاهل تتكلم مع أخصائي علاج طبيعي — مش تشخيص`,
        });
      }
    }
  }

  // ── #6 Breathing rate (EXPERIMENTAL) — shoulder-Y oscillation ──
  // Webcam-based breathing estimation from shoulder movement is a known
  // but noisy technique (typing/fidgeting easily swamps it). Kept
  // intentionally conservative: long window, plausible-range filter,
  // long cooldown, and the surfaced text says "experimental" outright.
  // Gated to Elite-equivalent only (tier quality).
  if(flags.breathing && Number.isFinite(midShY)){
    const br = tr.breath;
    if(now - br.lastPush > 150){ // downsample to ~6-7 samples/sec
      br.lastPush = now;
      br.buf.push({t:now, y:midShY});
      const cutoff = now - 45000;
      while(br.buf.length && br.buf[0].t < cutoff) br.buf.shift();
    }
    if(br.buf.length>=120 && now-tr.lastFire.breath>900000){
      const ys = br.buf.map(s=>s.y);
      const meanY = ys.reduce((a,b)=>a+b,0)/ys.length;
      const detrended = ys.map(y=>y-meanY);
      const amplitude = Math.max(...detrended)-Math.min(...detrended);
      let crossings=0;
      for(let i=1;i<detrended.length;i++) if(detrended[i-1]<0 && detrended[i]>=0) crossings++;
      const durSec = (br.buf[br.buf.length-1].t - br.buf[0].t)/1000;
      const bpm = durSec>0 ? (crossings/durSec)*60 : 0;
      // Only surface a fast+shallow reading — normal breathing isn't worth interrupting for,
      // and the technique is too noisy to confidently call out "normal" anyway.
      if(bpm>=18 && bpm<=32 && amplitude>0 && amplitude<0.012){
        tr.lastFire.breath = now;
        insights.push({
          icon:"🫁",
          text:`Breathing pattern detected as fast & shallow (~${Math.round(bpm)}/min). This often signals tension or forward-head posture compressing your diaphragm. Try 3 slow deep breaths now.`,
          textAr:`نمط تنفسك سريع وضحل (~${Math.round(bpm)}/دقيقة). ده غالباً بيحصل مع التوتر أو وضعية الرأس للأمام اللي بتضغط على الحجاب الحاجز. جرب 3 أنفاس عميقة وبطيئة دلوقتي.`,
        });
      }
    }
  }

  return insights;
}

function _riskColor(score){
  if(score==null) return "#94a3b8";
  if(score>=80) return "#4FAE8E";
  if(score>=60) return "#D6A24C";
  return "#C6604F";
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

// Arabic labels for the Live Metrics list and Detected Conditions list —
// postureEngine.js's `metrics`/`detectedConditions` output is English-only
// (it's a pure computation module with no isAr/lang concept, and shouldn't
// need one just to label its own output). Every other piece of copy on the
// Live page already branches on isAr, but these two lists rendered the raw
// English `label`/`name` strings unconditionally even in Arabic mode.
// Keyed by the engine's own stable metric ids (METRIC_LABEL_AR) and literal
// condition-name strings (CONDITION_NAME_AR — detectedConditions carries no
// id, only the name itself) — see postureEngine.js's `metrics`/
// `detectedConditions` blocks for the exact source strings this must match.
const METRIC_LABEL_AR = {
  neck_lean:          "ميل الرقبة",
  head_tilt:           "ميل الرأس",
  shoulder_level:      "توازن الكتفين",
  spine_lean:          "ميل العمود الفقري",
  head_yaw:            "دوران الرأس",
  screen_distance:     "المسافة من الشاشة",
  fhp_index:           "بروز الرأس للأمام",
  rounded_shoulders:   "انحناء الكتفين",
  shoulder_elevation:  "ارتفاع الكتفين (شد)",
  elbow_angle:         "زاوية الكوع",
  monitor_height:      "ارتفاع الشاشة",
  torso_flexion:       "انحناء الجذع للأمام",
  trunk_rotation:      "التفاف الجذع",
};
const CONDITION_NAME_AR = {
  "Neck Lean":          "ميل الرقبة",
  "Forward Head":       "بروز الرأس للأمام",
  "Head Tilt":          "ميل الرأس",
  "Shoulder Imbalance": "عدم توازن الكتفين",
  "Rounded Shoulders":  "انحناء الكتفين",
  "Spine Lean":         "ميل العمود الفقري",
  "Shoulder Elevation": "ارتفاع الكتفين",
  "Monitor/Gaze Angle": "زاوية الشاشة/النظر",
  "Hand/Chin Prop":     "إسناد اليد على الذقن",
  "Forward Slouch":     "انحناء للأمام",
  "Trunk Rotation":     "التفاف الجذع",
};

// Pick the single most actionable correction cue from the current analysis —
// the worst-scoring metric that's genuinely off — and phrase it as a direct,
// directional instruction ("Raise screen to eye level") instead of a number.
// Returns null when posture is fine so no cue is shown.
function postureCue(analysis, isAr){
  const m=analysis?.metrics; if(!m) return null;
  const raw=analysis.raw||{};
  const cands=[];
  const add=(k,en,ar,icon)=>{ const sc=m[k]?.score; if(typeof sc==="number"&&sc<55&&m[k]?.reliable!==false) cands.push({sc,en,ar,icon}); };
  add("fhp_index","Tuck your chin back","أدخل ذقنك للخلف","⟲");
  // NOT "raise your screen". analyzeNeckLean() measures the ear-to-shoulder
  // angle in the IMAGE plane, and from a front camera that is a LATERAL
  // measurement — the engine's own weight table says so, and the rig confirms
  // it: 20° of forward neck flexion moves this metric by 0.0°, while 15° of
  // sideways lean moves it to 14°. So the one cue this metric could produce
  // was advice about monitor height for a fault that has nothing to do with
  // monitor height. Caught on camera: a user with his head tilted roughly 40°
  // toward one shoulder was told three times to raise his screen.
  //
  // This is the same defect already fixed for spine_lean directly below, which
  // was left in place here — the heavier of the two metrics, at 0.14 of the
  // score against spine_lean's 0.088.
  // No side is named. shoulder_level and spine_lean are the only metrics that
  // carry a `signed` field, and at laptop framing spine_lean is unmeasurable —
  // so there is no reliable way to say "leaning right" here, and guessing the
  // side is worse than not saying it.
  add("neck_lean","Head is leaning to one side — bring it over your shoulders",
      "راسك مايلة على جنب — رجّعها فوق كتفيك","⟲");
  // spine_lean is geometrically a LATERAL (sideways) lean signal — the
  // engine's angleVert() is documented 2D-only (ignores Z), so it barely
  // reacts to forward slouch (fhp_index/neck_lean already cover that) but
  // reacts strongly to leaning toward one armrest/side. The old copy —
  // "sit up straight — support your back" — described a forward-slouch
  // correction for what's actually a sideways lean; now names the real
  // side using m.spine_lean.signed (positive = leaning right).
  if(typeof m.spine_lean?.score==="number" && m.spine_lean.score<55 && m.spine_lean?.reliable!==false){
    const rightLean = (m.spine_lean.signed ?? 0) > 0;
    cands.push({sc:m.spine_lean.score,
      en:rightLean?"Leaning right — sit centered":"Leaning left — sit centered",
      ar:rightLean?"مايل لليمين — اتوسط في الكرسي":"مايل للشمال — اتوسط في الكرسي",
      icon:rightLean?"⇥":"⇤"});
  }
  // The two most common desk postures the engine can now actually see:
  // a forward slump (the main driver of lower-back complaints) and sitting
  // twisted toward an off-centre monitor. Both used to be invisible here —
  // there was no metric to key a cue off.
  add("torso_flexion","Sit tall — hips back in the seat","اقعد مفرود — رجّع وركك لآخر الكرسي","↥");
  add("trunk_rotation","Square your chair to the screen","وجّه كرسيك ناحية الشاشة","⟳");
  add("rounded_shoulders","Roll your shoulders back","افرد كتفيك للخلف","↔");
  add("shoulder_level","Level your shoulders","سوِّ كتفيك","⇄");
  add("shoulder_elevation","Drop your shoulders — let them relax down","ارخي كتفيك للأسفل — رخي عضلات الرقبة","↓");
  add("head_tilt","Level your head","سوِّ رأسك","⟲");
  if(typeof m.screen_distance?.score==="number" && m.screen_distance.score<55 && raw.distCm!=null && raw.lo!=null){
    if(raw.distCm<raw.lo)      cands.push({sc:m.screen_distance.score,en:"Move back from the screen",ar:"ابعد عن الشاشة شوية",icon:"⟵"});
    else if(raw.distCm>raw.hi) cands.push({sc:m.screen_distance.score,en:"Move closer to the screen",ar:"اقترب من الشاشة شوية",icon:"⟶"});
  }
  if(!cands.length) return null;
  cands.sort((a,b)=>a.sc-b.sc);
  const w=cands[0];
  // Was its own 40-point split with a third color (#f97316) found nowhere
  // else on this page — every candidate here already scored <55 by the
  // add()/spine_lean filters above, i.e. already in scoreTierColor()'s
  // "bad" tier (<55), so this cue should always read as bad/red like every
  // other indicator on the page, not invent an intermediate severity.
  return { text:isAr?w.ar:w.en, icon:w.icon, col:scoreTierColor(w.sc) };
}

function drawFront(ctx,res,W,H,isAr=false,opts={}){
  if(!res?.lms) return;
  const showSkel=opts.skeleton!==false, showAng=opts.angles!==false;
  const{lms:lm,raw,overall,metrics}=res;
  const px=p=>p?[p.x*W,p.y*H]:[0,0];
  const valid=p=>p&&(p.visibility==null||p.visibility>0.5); // raised from 0.3 to match engine VIS_MIN

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

  if(showSkel) CONNECTIONS.forEach(({pts:[a,b],col,w})=>{
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

  if(showSkel) JOINTS.forEach(({p,col,r})=>{
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

  // ── Joint angles labels + HUD annotations (gated by showAng) ──
  if(showAng){
  ctx.font="bold 10px system-ui"; ctx.globalAlpha=.95;

  // Neck angle (ear-shoulder vertical)
  // The canvas element carries `transform: scaleX(-1)` so the skeleton lines
  // up with the mirrored video the user sees. Everything drawn on it is
  // therefore flipped — including text, which comes out written backwards.
  // Confirmed from a real session: the distance label rendered as "mɔ1E"
  // instead of "31cm", in both bottom corners.
  //
  // Lines and dots do not care about handedness, so the fix is per-string
  // rather than a re-plumb of every coordinate: flip the context back around
  // the text's own anchor, draw, and restore. The anchor is expressed in
  // canvas space exactly as before, so nothing moves.
  const mtext = (str, x, y) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.fillText(str, 0, 0);
    ctx.restore();
  };

  if(valid(lm.midEar)&&valid(lm.midSh)){
    const neckAng = metrics?.neck_lean?.value ?? _angle2pt(lm.midEar,lm.midSh);
    if(neckAng!=null){
      const[sx,sy]=px(lm.midSh);
      ctx.fillStyle="rgba(0,0,0,.55)";
      ctx.fillRect(sx+6,sy-14,40,16); ctx.fillStyle=neckCol;
      mtext(`${neckAng}°`, sx + 8, sy - 2);
    }
  }

  // Shoulder tilt angle
  if(valid(lm.lSh)&&valid(lm.rSh)){
    const[lx,ly]=px(lm.lSh),[rx,ry]=px(lm.rSh);
    // Prefer the engine's shoulder-tilt value so the on-video label matches
    // the metrics panel instead of showing a separately-computed angle.
    const tiltAng=metrics?.shoulder_level?.value ?? Math.round(Math.abs(Math.atan2(ry-ly,rx-lx)*180/Math.PI));
    const mx=(lx+rx)/2, my=(ly+ry)/2-14;
    ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(mx-20,my-12,42,16);
    ctx.fillStyle=shCol; mtext(`${tiltAng}°`, mx - 18, my);
  }

  // REMOVED: the second distance readout.
  //
  // This drew `raw.distCm` from the frame being rendered, while the pinned
  // React chip above the video shows `analysis.distCm` from React state, which
  // is pushed at 4Hz. Two labels, one measurement, different sampling — and on
  // camera they disagreed by 7cm (65 vs 72) in a single frame, on a metric
  // whose whole ideal band is 30cm wide. A user reading both has no reason to
  // trust either. The chip is the better of the two: it carries the colour,
  // the "too close / too far" reason from the quality gate, and the direction
  // to move. This one is gone rather than resynchronised.

  // ── FHP visual line ───────────────────────────────────────────
  // Draws a horizontal line from the shoulder midpoint to a projected
  // "ideal" ear position (directly above shoulder) and shows the gap
  // in cm with the extra neck load. Makes Forward Head Posture
  // immediately obvious to the user without explaining angles.
  const fhpMet = metrics?.fhp_index;
  if(fhpMet?.reliable!==false && valid(lm.midSh) && valid(lm.midEar)){
    const[sx,sy]=px(lm.midSh); const[ex,ey]=px(lm.midEar);
    const fhpCm   = fhpMet?.value ?? 0;
    const loadKg  = fhpMet?.extra_load_kg ?? 0;
    const fhpCol  = fhpCm > 6 ? "#C6604F" : fhpCm > 3 ? "#D6A24C" : "#4FAE8E";

    // Ideal ear position (directly above shoulder midpoint)
    const idealX = sx, idealY = ey;

    // Dashed reference vertical from shoulder up to eye level
    ctx.save();
    ctx.globalAlpha = .35;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, ey); ctx.stroke();
    ctx.setLineDash([]);

    if(fhpCm > 1.5){
      // Horizontal displacement arrow
      ctx.globalAlpha = .85;
      ctx.lineWidth = 2;
      ctx.strokeStyle = fhpCol;
      ctx.beginPath(); ctx.moveTo(idealX, idealY); ctx.lineTo(ex, ey); ctx.stroke();
      // Arrowhead at ear end
      const dir = ex > idealX ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - dir*8, ey - 4);
      ctx.lineTo(ex - dir*8, ey + 4);
      ctx.closePath(); ctx.fillStyle = fhpCol; ctx.fill();
      // The canvas carries transform:scaleX(-1) so it matches the mirrored
      // video, which means a box drawn at canvas x lands at screen W-x. Every
      // badge in this file was positioned as though that flip did not happen:
      // this one is commented "top-right of screen" and rendered at the top
      // LEFT, underneath the "Live" status pill and the distance chip, with
      // "FHP 3.5cm / +0.1kg load" legible only where it stuck out from behind
      // them. Fixing the glyph direction earlier did not fix the anchors.
      //
      // SX() converts a screen-space x to the canvas x that lands there, so
      // these coordinates now mean what they say. Placed in the free column
      // below the distance chip rather than the top-right, which is occupied
      // by the score panel.
      const SX = x => W - x;
      const bx = isAr ? W - 118 : 8;          // screen-space left edge
      ctx.globalAlpha = .88;
      ctx.fillStyle = "rgba(2,8,20,.85)";
      // Y is in CANVAS pixels (the backing store is the video's native size,
      // typically 720 tall) while the React chips above are positioned in CSS
      // pixels against a container that is usually shorter — so a canvas y that
      // looks clear of them at 1:1 rides up into them once the video is scaled
      // down. Sat low enough to clear the chips at any sane scale factor.
      _roundRect(ctx, SX(bx + 110), 150, 110, 30, 6); ctx.fill();
      ctx.fillStyle = fhpCol; ctx.font = "bold 10px system-ui";
      mtext(`FHP ${fhpCm}cm`, SX(bx + 6), 164);
      ctx.fillStyle = "#94a3b8"; ctx.font = "9px system-ui";
      mtext(`+${loadKg}kg load`, SX(bx + 6), 175);
    }
    ctx.restore();
  }

  // ── Ideal posture arc hint at neck ────────────────────────────
  // Draws a small arc at the shoulder showing the ideal 0-6° zone
  if(valid(lm.midSh) && valid(lm.midEar)){
    const[sx,sy]=px(lm.midSh);
    const R = 32;
    // Shade the "ok zone" (0–6° from vertical) as a faint green arc
    ctx.save();
    ctx.globalAlpha = .12;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, R, -Math.PI/2 - (6*Math.PI/180), -Math.PI/2 + (6*Math.PI/180));
    ctx.closePath();
    ctx.fillStyle = "#4FAE8E"; ctx.fill();
    ctx.restore();
  }

  // ── Rounded shoulders badge ───────────────────────────────────
  // Was gated on the raw `value>5` (a depth number on its own 0-30ish
  // scale), completely independent of the score-based Low/Med/High
  // classification the side panel's "Rounding" row uses (score>=80 Low,
  // >=60 Med, else High). Since THR.ROUNDED={ok:10,bad:22}, a depth of
  // 6-9 already scores 80-90 ("Low" in the side panel) while still being
  // >5 here — so this badge could show "⚠ Rounded" on top of the video
  // at the exact same time the side panel said "Rounding: Low", a
  // confirmed live contradiction (seen in a user screenshot). Now driven
  // by the same score thresholds as the side panel, so the two can never
  // disagree.
  const rsMet = metrics?.rounded_shoulders;
  if(rsMet?.reliable!==false && rsMet?.score!=null && rsMet.score < 80){
    const rsCol = rsMet.score < 60 ? "#C6604F" : "#D6A24C";
    ctx.save();
    ctx.globalAlpha = .88;
    ctx.fillStyle = "rgba(2,8,20,.85)";
    const _bx = isAr ? W - 118 : 8;
    _roundRect(ctx, W - (_bx + 110), 186, 110, 20, 5); ctx.fill();
    ctx.fillStyle = rsCol; ctx.font = "bold 9px system-ui";
    mtext(`⚠ Rounded ${Math.round(rsMet.value??0)}`, W - (_bx + 6), 199);
    ctx.restore();
  }

  // REMOVED: the second risk panel.
  //
  // Authored as a "bottom-left" panel, it rendered at the bottom RIGHT because
  // the canvas is CSS-mirrored — and each of its labels, anchored at canvas
  // x=8, landed at screen x=W-8 and grew rightward off the edge, so on camera
  // the user saw "Ne", "Sho", "Bac" clipped against the frame border with the
  // bars and numbers gone entirely.
  //
  // It is not being repositioned, because it duplicated the React score panel
  // above it row for row (neck, shoulder, back, distance) with a second set of
  // colour thresholds, and inherited the same defect that panel had: it read
  // `.score` without `.reliable`, so it drew a full green bar for spine_lean
  // and rounded_shoulders — two metrics the camera cannot see at laptop
  // framing. One panel, which now says when it has no view.
  } // end showAng

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

// drawSide() removed — Side mode removed app-wide, no remaining callers.



// ── Onboarding Tour ───────────────────────────────────────────────
function Onboard({cs,t,done}){
  const[step,setStep]=useState(0);
  const steps=[{e:"◈",ti:t.ob1,d:t.ob1d},{e:"📊",ti:t.ob2,d:t.ob2d},{e:"📷",ti:t.ob3,d:t.ob3d},{e:"🚀",ti:t.ob4,d:t.ob4d}];
  const s=steps[step];
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.50)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:8888}}>
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

  const strengthColor=["#C6604F","#D6A24C","#D6A24C","#4FAE8E","#4FAE8E"][passStrength]||"#C6604F";
  const strengthLabel=isAr
    ?["ضعيفة جداً","ضعيفة","مقبولة","قوية","قوية جداً"][Math.min(passStrength,4)]
    :["Very weak","Weak","Fair","Strong","Very strong"][Math.min(passStrength,4)];

  function humanErr(msg){
    // Firebase can return errors as: "Firebase: Error (auth/code)." or just the code
    const code = (msg||"").match(/\(auth\/([^)]+)\)/)?.[1]
               || (msg||"").replace(/^auth\//,"")
               || msg || "";
    const map={
      "wrong-password":                         isAr?"كلمة المرور غلط":"Wrong password",
      "invalid-credential":                     isAr?"البريد أو كلمة المرور غلط":"Invalid email or password",
      "user-not-found":                         isAr?"مفيش حساب — سجّل حساب جديد":"No account found — please sign up",
      "email-already-in-use":                   isAr?"البريد مسجّل — سجّل دخول":"Email already registered — sign in",
      "weak-password":                          isAr?"كلمة المرور ضعيفة — 6 أحرف على الأقل":"Password too weak — 6+ chars",
      "too-many-requests":                      isAr?"محاولات كتيرة — حاول بعد شوية":"Too many attempts — try later",
      "network-request-failed":                 isAr?"مشكلة في الإنترنت":"Network error — check your connection",
      "popup-blocked":                          isAr?"الـ popup اتحجب — جاري إعادة المحاولة...":"Popup blocked — trying redirect...",
      "popup-closed-by-user":                   isAr?"أُغلق الـ popup":"Sign-in popup closed",
      "cancelled-popup-request":                isAr?"أُغلق الـ popup":"Sign-in popup closed",
      "invalid-email":                          isAr?"البريد الإلكتروني غير صحيح":"Invalid email address",
      "user-disabled":                          isAr?"الحساب موقوف":"Account disabled — contact support",
      "internal-error":                         isAr?"خطأ في Firebase — تأكد من الإعدادات":"Firebase error — check your configuration",
      "operation-not-supported-in-this-environment": isAr?"جاري التوجيه...":"Redirecting to sign in...",
      "account-exists-with-different-credential": isAr?"هذا البريد مسجّل بطريقة دخول مختلفة":"Account exists with a different sign-in method",
      "requires-recent-login":                  isAr?"يجب إعادة تسجيل الدخول":"Please sign in again to continue",
      "credential-already-in-use":              isAr?"هذا الحساب مرتبط بمستخدم آخر":"Credential already linked to another account",
      "timeout":                                isAr?"انتهى الوقت — حاول تاني":"Timeout — please try again",
    };
    return map[code] || map[Object.keys(map).find(k => code.includes(k)) || ""]
      || (isAr?"حدث خطأ — حاول تاني":"Something went wrong — please try again");
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
      const raw = e2?.code || e2?.message || String(e2);
      console.error("🔴 Google auth error:", raw, e2);
      setErr(humanErr(raw));
    }
    setLoading(false);
  }

  return(
    <div dir={dir} style={{minHeight:"100vh",background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif"}}>
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
          {isAuto&&<div style={{background:"rgba(79,174,142,.08)",border:"0.5px solid rgba(79,174,142,.25)",borderRadius:9,padding:"9px 12px",marginBottom:14,fontSize:11,color:darkMode?"#6ee7b7":"#15803d",display:"flex",gap:8,alignItems:"center"}}>
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
            {resetSent&&<div style={{fontSize:11,color:darkMode?"#6ee7b7":"#15803d",marginBottom:12,background:"rgba(79,174,142,.07)",padding:"10px 12px",borderRadius:8,border:"0.5px solid rgba(79,174,142,.2)"}}>
              ✅ {isAr?"تم إرسال رابط إعادة تعيين كلمة المرور — راجع بريدك":"Password reset link sent — check your email"}
            </div>}

            {/* Error */}
            {err&&<div style={{fontSize:11,color:"#fca5a5",marginBottom:12,background:"rgba(198,96,79,.07)",padding:"10px 12px",borderRadius:8,border:"0.5px solid rgba(198,96,79,.2)"}}>{err}</div>}

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
  return <div style={{minHeight:"100vh",background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif"}}>
    <div style={{maxWidth:480,width:"100%"}}>
      {status==="confirmed"?(<div style={{background:cs.card,border:"0.5px solid rgba(79,174,142,.4)",borderRadius:16,padding:36,textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:12}}>✅</div>
        <div style={{fontSize:20,fontWeight:700,color:cs.text,marginBottom:8}}>{t.payOK}</div>
        <div style={{fontSize:13,color:cs.muted}}>{t.planActive} {tierInfo?.name}</div>
      </div>):status==="rejected"?(<div style={{background:cs.card,border:"0.5px solid rgba(198,96,79,.4)",borderRadius:16,padding:36,textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:12}}>❌</div>
        <div style={{fontSize:20,fontWeight:700,color:cs.text,marginBottom:8}}>{t.payFail}</div>
        <div style={{fontSize:12,color:cs.muted,marginBottom:16}}>{payData?.reject_reason||"Not verified"}</div>
        <Btn cs={cs} onClick={()=>window.location.reload()}>{t.tryAgain}</Btn>
      </div>):(<div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:16,padding:24}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{width:50,height:50,border:"3px solid rgba(214,162,76,.3)",borderTop:"3px solid #D6A24C",borderRadius:"50%",margin:"0 auto 12px",animation:"spin 1.2s linear infinite"}}/>
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
  const[refStats,setRefStats]=useState(null);
  const[showReferralProgram,setShowReferralProgram]=useState(false);
  const[showIntegrationsHub,setShowIntegrationsHub]=useState(false);
  const[viewSession,setViewSession]=useState(null);
  const isElite=tierAtLeast(profile?.tier,"elite");
  useEffect(()=>{ getReferralStats(user.uid).then(setRefStats).catch(()=>{}); },[user.uid]);
  const refLink=refStats?.ref_code?`${window.location.origin}?ref=${refStats.ref_code}`:"";
  // BUG FIX: these used to be derived from `sessions` (the capped
  // 50-session array), not the authoritative persistent counters that
  // firebase.js's saveSession() already maintains on every save. Any user
  // with more than 50 lifetime sessions saw "Total Sessions: 50" frozen
  // forever, and an average computed only over their 50 most recent
  // sessions instead of their true lifetime average.
  const totalSessions=profile?.sessions_count ?? sessions?.length ?? 0;
  const avgScore=profile?.avg_score ?? (sessions?.length?Math.round(sessions?.reduce((a,s)=>a+(s.avg_score||0),0)/sessions?.length):0);
  const inp={width:"100%",background:cs.inp,border:`0.5px solid ${cs.inpB}`,borderRadius:9,padding:"11px 14px",fontSize:13,color:cs.text,outline:"none",boxSizing:"border-box",marginBottom:12};
  async function save(){
    setSaving(true);
    try{
      await updateUserProfile(user.uid,{name:name.trim(),company:company.trim()});
      onSave({...profile,name:name.trim(),company:company.trim()});addToast(t.save+" ✓","success");
    }catch{addToast(isAr?"خطأ في الحفظ":"Error saving","error");}
    setSaving(false);
  }
  return <div style={{minHeight:"100vh",background:cs.bg,fontFamily:"'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif",overflowY:"auto"}}>
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
          {[[t.totalSess,totalSessions],[t.avgScore,avgScore+"/100"],[t.planLabel||"Plan",qualityFor(profile?.tier).label[isAr?"ar":"en"]],[t.memberSince,profile?.created_at?.toDate?.()?.toLocaleDateString?.()||"—"]].map(([k,v])=>(
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
        <div style={{display:"flex",gap:7,marginBottom:refStats?.credits>0?8:0}}>
          <div style={{flex:1,background:cs.inp,border:`0.5px solid ${cs.inpB}`,borderRadius:8,padding:"8px 11px",fontSize:10,color:cs.muted,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{refLink||"…"}</div>
          <Btn cs={cs} onClick={()=>{navigator.clipboard.writeText(refLink);addToast(t.copied,"success");}} disabled={!refLink} style={{padding:"8px 13px",fontSize:11,flexShrink:0}}>{t.copyLink}</Btn>
          <Btn cs={cs} onClick={()=>setShowReferralProgram(true)} style={{padding:"8px 13px",fontSize:11,flexShrink:0}}>{isAr?"التفاصيل":"Details"}</Btn>
        </div>
        {refStats?.credits>0&&<div style={{fontSize:11,color:"#4FAE8E",fontWeight:700}}>💰 {refStats.credits} EGP {isAr?"رصيد متاح":"credit available"}</div>}
      </div>
      {showReferralProgram&&<ErrorBoundary key="referralprogram"><Suspense fallback={null}><ReferralProgram profile={profile} cs={cs} lang={lang} onClose={()=>setShowReferralProgram(false)}/></Suspense></ErrorBoundary>}
      <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:13,padding:20,marginBottom:13}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <span style={{fontSize:20}}>🔌</span>
            <div><div style={{fontSize:12,fontWeight:700,color:cs.text}}>{isAr?"التكاملات":"Integrations"}</div><div style={{fontSize:11,color:cs.muted}}>{isAr?"Slack، Teams، Zapier، Webhooks وأكتر":"Slack, Teams, Zapier, Webhooks & more"}</div></div>
          </div>
          <Btn cs={cs} onClick={()=>setShowIntegrationsHub(true)} style={{padding:"8px 13px",fontSize:11,flexShrink:0}}>{isAr?"فتح":"Open"}</Btn>
        </div>
      </div>
      {showIntegrationsHub&&<ErrorBoundary key="integrationshub"><Suspense fallback={null}><IntegrationsHub profile={profile} cs={cs} lang={lang} onClose={()=>setShowIntegrationsHub(false)}/></Suspense></ErrorBoundary>}
      {sessions?.length>0&&<div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:13,padding:20,marginBottom:13}}>
        <div style={{fontSize:12,fontWeight:700,color:cs.text,marginBottom:13}}>{t.sessionHist||"Session History"}</div>
        <BarChart data={sessions?.slice(0,10).reverse().map((s,i)=>({l:`S${i+1}`,v:s.avg_score||0}))} color="#1a56db" cs={cs}/>
        <div style={{marginTop:13,display:"grid",gap:5}}>
          {sessions?.slice(0,5).map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"6px 0",borderBottom:`0.5px solid ${cs.border}`}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:sc(s.avg_score||0),flexShrink:0}}/>
              <span style={{fontSize:10,color:cs.muted,flex:1}}>{s.created_at?.toDate?.()?.toLocaleDateString?.()}</span>
              <span style={{fontSize:10,color:cs.muted}}>{s.mode} · {s.tier}</span>
              <span style={{fontSize:11,fontWeight:700,color:sc(s.avg_score||0)}}>{s.avg_score||0}/100</span>
              {isElite
                ? <button onClick={()=>setViewSession(s)} title={isAr?"كل بيانات الجلسة":"Full session data"}
                    style={{background:"none",border:"none",color:cs.muted,cursor:"pointer",fontSize:13,padding:2}}
                    aria-label={isAr?"عرض تفاصيل الجلسة":"View session details"}>ℹ️</button>
                : <span title={isAr?"متاح لأعضاء Elite فقط":"Elite members only"}
                    style={{fontSize:11,opacity:.35}}>🔒</span>}
            </div>
          ))}
        </div>
      </div>}
      {viewSession&&<SessionDetailModal session={viewSession} allSessions={sessions} profile={profile} cs={cs} isAr={isAr} addToast={addToast} onClose={()=>setViewSession(null)}/>}
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
    <div style={{minHeight:"100vh",background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif"}}>
      <div style={{maxWidth:460,width:"100%",textAlign:"center"}}>
        <div style={{
          width:72,height:72,borderRadius:"50%",margin:"0 auto 20px",
          background:isSuccess?"rgba(79,174,142,.12)":"rgba(198,96,79,.08)",
          border:`0.5px solid ${isSuccess?"rgba(79,174,142,.3)":"rgba(198,96,79,.2)"}`,
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
          <div style={{background:"rgba(79,174,142,.06)",border:"0.5px solid rgba(79,174,142,.2)",borderRadius:14,padding:"16px 20px",marginBottom:24,textAlign:isAr?"right":"left"}}>
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
      EmailAPI.invoice({email:user.email,name:profile?.name||"",tier:profile?.tier||"",amount:0,billing:"cancelled",ref:"CANCEL-"+Date.now()}).catch(e=>console.warn("[Email]",e.message));
    }catch(e){ console.warn("[cancel] email failed:",e?.code||e?.message); }
    addToast(t.done,"info");
    setStep(2);
    setLoading(false);
  };
  if(step===2)return(
    <div style={{background:"rgba(79,174,142,.05)",border:"0.5px solid rgba(79,174,142,.2)",borderRadius:13,padding:16,marginBottom:13,textAlign:"center"}}>
      <div style={{fontSize:20,marginBottom:6}}>✓</div>
      <div style={{fontSize:12,color:"#6ee7b7"}}>{t.done}</div>
    </div>
  );
  return(
    <div style={{background:"rgba(198,96,79,.04)",border:"0.5px solid rgba(198,96,79,.2)",borderRadius:13,padding:18,marginBottom:13}}>
      <div style={{fontSize:12,fontWeight:700,color:"#fca5a5",marginBottom:6}}>{t.title}</div>
      <div style={{fontSize:11,color:cs.muted,marginBottom:12,lineHeight:1.6}}>{t.desc}</div>
      {step===0&&<button onClick={()=>setStep(1)} style={{background:"rgba(198,96,79,.1)",border:"0.5px solid rgba(198,96,79,.3)",borderRadius:8,padding:"8px 16px",fontSize:11,color:"#fca5a5",cursor:"pointer",fontWeight:600}}>{t.btn}</button>}
      {step===1&&<div>
        <div style={{fontSize:12,fontWeight:600,color:"#fca5a5",marginBottom:10}}>{t.sure}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>setStep(0)} style={{background:"rgba(148,163,184,.1)",border:"0.5px solid rgba(148,163,184,.2)",borderRadius:8,padding:"8px 14px",fontSize:11,color:cs.muted,cursor:"pointer",fontWeight:600}}>{t.back}</button>
          <button onClick={doCancel} disabled={loading} style={{background:"rgba(198,96,79,.15)",border:"0.5px solid rgba(198,96,79,.4)",borderRadius:8,padding:"8px 14px",fontSize:11,color:"#fca5a5",cursor:loading?"not-allowed":"pointer",fontWeight:700,opacity:loading?.7:1}}>
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
  return <div dir={isAr?"rtl":"ltr"} style={{minHeight:"100vh",background:cs.bg,fontFamily:"'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif",overflowY:"auto"}}>
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
          <div key={u.id||i} style={{background:cs.card,border:`0.5px solid ${i<3?"rgba(214,162,76,.3)":cs.border}`,borderRadius:11,padding:"11px 16px",display:"flex",alignItems:"center",gap:11,flexDirection:isAr?"row-reverse":"row"}}>
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
    // The confirmation write was not wrapped, so a Firestore failure left the
    // row stuck on `proc` with nothing surfaced — the admin saw a spinner that
    // never resolved and no reason why. And the toast asserted "Invoice sent"
    // regardless: both the invoice email and the notification are
    // fire-and-forget with swallowed errors, so the admin could tell a customer
    // their invoice was on its way when nothing had been sent. Report the
    // payment confirmation and the email separately, because they are separate
    // facts and only one of them is confirmed here.
    try {
      await confirmPayment(pay.id,pay.uid,pay.tier,pay.billing_cycle==="yearly"?12:1);
    } catch(e) {
      addToast("Couldn't confirm this payment — "+(e?.message||"try again"),"error");
      setProc(null);
      return false;
    }
    let invoiceSent = false;
    try {
      await EmailAPI.invoice({email:pay.user_email,name:pay.user_name,tier:pay.tier,
        amount:pay.amount,billing:pay.billing_cycle,seats:pay.seats||25,
        ref:pay.ref_code||"AUTO"});
      invoiceSent = true;
    } catch(e) { console.warn("[admin] invoice email failed:",e?.message); }
    PaymentAPI.notifyConfirmed(pay).catch(()=>{});
    // Mark coupon as used
    if(pay.coupon)PaymentAPI.validateCoupon({code:pay.coupon}).catch(()=>{});
    addToast(invoiceSent
      ? "✅ Confirmed — invoice sent to "+pay.user_email
      : "✅ Confirmed — but the invoice email did NOT send. Send it manually to "+pay.user_email,
      invoiceSent ? "success" : "warn");
    await load();setProc(null);
    return true;
  }
  async function doReject(){
    setProc(modal.id);
    await rejectPayment(modal.id,reason||"Not verified");
    addToast("Rejected","warn");setModal(null);setReason("");await load();setProc(null);
  }
  async function bulkConfirm(){
    // Reported `selected.length` confirmed even when the loop aborted partway,
    // so a run that failed on the second of ten still claimed ten.
    let ok=0, failed=0;
    for(const pid of selected){
      const pay=payments.find(p=>p.id===pid);
      if(!pay) continue;
      // Sequential on purpose — each confirmation writes to Firestore and
      // sends an invoice, and firing them all at once both hammers the
      // backend and scrambles the per-payment error reporting below.
      // (No eslint-disable here: `no-await-in-loop` is not enabled in this
      // config, so the directive was reported as unused and failed the lint
      // run under --report-unused-disable-directives.)
      const done=await doConfirm(pay);
      done?ok++:failed++;
    }
    setSelected([]);
    addToast(failed
      ? `${ok} confirmed, ${failed} failed — check the list and retry the failures`
      : `${ok} confirmed`,
      failed ? "warn" : "success");
  }
  function exportCSV(data,filename){
    if(!data.length)return;
    const h=Object.keys(data[0]).join(",");const rows=data.map(r=>Object.values(r).map(v=>JSON.stringify(v||"")).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([h+"\n"+rows],{type:"text/csv"}));a.download=filename;a.click();addToast("CSV exported","success");
  }

  const tCol=x=>x==="elite"?"#4FAE8E":x==="professional"?"#0ea5e9":"#6366f1";
  const sBg=x=>x==="confirmed"?"rgba(79,174,142,.1)":x==="rejected"?"rgba(198,96,79,.1)":"rgba(214,162,76,.1)";
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

  return <div style={{minHeight:"100vh",background:cs.bg,color:cs.text,fontFamily:"'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif"}}>
    {modal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
      <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:14,padding:22,width:340}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:11}}>{isAr?"رفض الدفعة":"Reject Payment"}</div>
        <div style={{fontSize:11,color:cs.muted,marginBottom:9}}>{modal.user_name} · {modal.amount?.toLocaleString()} EGP</div>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder={isAr?"السبب (اختياري)":"Reason (optional)"}
          style={{width:"100%",background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:8,padding:"9px 11px",fontSize:12,color:cs.text,resize:"none",height:70,boxSizing:"border-box",outline:"none",marginBottom:11}}/>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>{setModal(null);setReason("");}} style={{flex:1,background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:8,padding:9,fontSize:12,color:cs.muted,cursor:"pointer"}}>Cancel</button>
          <button onClick={doReject} style={{flex:1,background:"rgba(198,96,79,.15)",border:"0.5px solid rgba(198,96,79,.3)",borderRadius:8,padding:9,fontSize:12,fontWeight:600,color:"#fca5a5",cursor:"pointer"}}>{t.reject}</button>
        </div>
      </div>
    </div>}

    <div style={{padding:"12px 19px",borderBottom:`0.5px solid ${cs.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:cs.card}}>
      <div style={{display:"flex",alignItems:"center",gap:9}}>
        <div style={{width:25,height:25,background:"linear-gradient(135deg,#1a56db,#0891b2)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>◈</div>
        <div><div style={{fontSize:12,fontWeight:700}}>Corvus Admin</div><div style={{fontSize:9,color:cs.muted}}>{adminUser?.email}</div></div>
      </div>
      <div style={{display:"flex",gap:9,alignItems:"center"}}>
        <div style={{fontSize:12,color:"#4FAE8E",fontWeight:600}}>{totalRev.toLocaleString()} EGP total</div>
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
        {selected.length>0&&<Btn cs={cs} bg="#4FAE8E" onClick={bulkConfirm} style={{padding:"8px 13px",fontSize:11}}>✓ Confirm {selected.length}</Btn>}
      </div>}

      {loading?<div style={{textAlign:"center",padding:44,color:cs.muted}}><div style={{width:28,height:28,border:"3px solid rgba(148,163,184,.2)",borderTop:"3px solid #1a56db",borderRadius:"50%",margin:"0 auto",animation:"spin 1s linear infinite"}}/></div>:

      tab==="revenue"?(<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:11,marginBottom:18}}>
          {[[totalRev.toLocaleString()+" EGP",isAr?"إجمالي الإيرادات":"Total Revenue","#4FAE8E"],[payments.filter(p=>p.status==="confirmed").length,isAr?"مؤكد":"Confirmed","#6366f1"],[payments.filter(p=>p.status==="pending").length,isAr?"معلق":"Pending","#D6A24C"],[payments.filter(p=>p.status==="rejected").length,isAr?"مرفوض":"Rejected","#C6604F"]].map(([v,l,c])=>(
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
              <span style={{background:`rgba(${u.tier==="elite"?"79,174,142":u.tier==="professional"?"14,165,233":"99,102,241"},.12)`,color:tCol(u.tier),borderRadius:99,padding:"2px 8px",fontSize:9,fontWeight:700}}>{(u.tier||"standard").toUpperCase()}</span>
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
            <div key={pay.id} style={{background:cs.card,border:`0.5px solid ${pay.status==="pending"?cs.border:pay.status==="confirmed"?"rgba(79,174,142,.25)":"rgba(198,96,79,.2)"}`,borderRadius:11,padding:"12px 16px"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:11,flexWrap:"wrap"}}>
                {pay.status==="pending"&&<input type="checkbox" checked={selected.includes(pay.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,pay.id]:prev.filter(id=>id!==pay.id))} style={{marginTop:3,flexShrink:0}}/>}
                <div style={{flex:"1 1 200px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
                    <div style={{fontSize:13,fontWeight:700,color:cs.text}}>{pay.user_name||pay.user_email}</div>
                    <span style={{background:`rgba(${pay.tier==="elite"?"79,174,142":pay.tier==="professional"?"14,165,233":"99,102,241"},.12)`,color:tCol(pay.tier),borderRadius:99,padding:"1px 7px",fontSize:8.5,fontWeight:700}}>{(pay.tier||"").toUpperCase()}</span>
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
                    <button onClick={()=>doConfirm(pay)} disabled={proc===pay.id} style={{background:"rgba(79,174,142,.15)",border:"0.5px solid rgba(79,174,142,.35)",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,color:"#6ee7b7",cursor:"pointer"}}>{proc===pay.id?"...":t.confirm}</button>
                    <button onClick={()=>setModal(pay)} style={{background:"rgba(198,96,79,.1)",border:"0.5px solid rgba(198,96,79,.25)",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,color:"#fca5a5",cursor:"pointer"}}>{t.reject}</button>
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

// ── Pricing Page — Automatic Kashier only ───────────────────────────
// ⚠️ DEAD CODE — this component is defined but never rendered anywhere in
// this file (no <Pricing .../> usage exists). The actual pricing UI used in
// production is PricingPage.jsx (a separate file), reached via page==="pricing".
// Kept here rather than deleted in case it's intentionally staged for a future
// flow — but do not assume changes here affect what users see today.
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
  const[kashierUrl,setKashierUrl]=useState(null);
  const[walletNumber,setWalletNumber]=useState("");
  const[walletStep,setWalletStep]=useState(false);
  const[coupon,setCoupon]=useState("");
  const[couponData,setCouponData]=useState(null);
  const[couponErr,setCouponErr]=useState("");
  const[couponChecking,setCouponChecking]=useState(false);
  // Referral credit (EGP, from a prior /api/referral/track welcome credit or
  // a converted referral) is applied automatically server-side in
  // /api/kashier/create-order — no client-side discount math needed here.
  const[referralCreditApplied,setReferralCreditApplied]=useState(0);

  // Persist kashier URL across accidental back-navigations
  useEffect(()=>{
    const saved=sessionStorage.getItem("kashier_pending_url");
    const savedStep=sessionStorage.getItem("kashier_pending_step");
    if(saved&&savedStep==="kashier"){setKashierUrl(saved);setStep("kashier");}
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
  const disc=couponData?couponData.discount:0;
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

  async function doKashier(){
    setProc(true);
    const result=await initKashier({
      tier:selTier,user_email:user.email,
      user_name:profile?.name||"",billing,
      uid:user?.uid||"",
      coupon_code: couponData ? coupon.trim().toUpperCase() : undefined,
      discount_code: couponData ? coupon.trim().toUpperCase() : undefined,
      discount_pct: disc || 0});
    if(result?.creditApplied) setReferralCreditApplied(result.creditApplied);
    if(result?.type==="redirect"&&result?.url){
      sessionStorage.setItem("kashier_pending_url",result.url);
      sessionStorage.setItem("kashier_pending_step","kashier");
      setKashierUrl(result.url);setStep("kashier");
    }else{
      // This is what a customer sees when the payment provider is not
      // reachable, so it says something a customer can act on. The previous
      // text — "Kashier not configured — check Vercel env vars" — was an
      // instruction to the developer, shown to the person trying to pay.
      // The diagnostic detail is still logged in initKashier above.
      addToast(isAr
        ? "تعذّر بدء عملية الدفع دلوقتي. لسه محدش اتخصم منه حاجة — جرّب تاني، ولو فضلت المشكلة كلّمنا."
        : "We couldn't start the payment right now. Nothing has been charged — please try again, or contact us if it keeps happening.",
        "error");
    }
    setProc(false);
  }

  if(step==="waiting")return <Waiting paymentId={paymentId} payMethod={payMethod} amount={price}
    tier={selTier} refCode={""} onSuccess={()=>{sessionStorage.removeItem("kashier_pending_url");sessionStorage.removeItem("kashier_pending_step");onPaid();}} cs={cs} t={t}/>;

  if(step==="kashier")return <div style={{minHeight:"100vh",background:cs.bg,display:"flex",flexDirection:"column",fontFamily:"'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif"}}>
    <div style={{padding:"12px 18px",borderBottom:"0.5px solid "+cs.border,display:"flex",alignItems:"center",gap:11,background:cs.card}}>
      <button aria-label="Go back" onClick={()=>{sessionStorage.removeItem("kashier_pending_url");sessionStorage.removeItem("kashier_pending_step");setStep("method");}} style={{background:cs.inp,border:"0.5px solid "+cs.border,borderRadius:7,padding:"6px 11px",fontSize:11,color:cs.muted,cursor:"pointer"}}>{isAr?"→ ":"← "}{isAr?"رجوع":"Back"}</button>
      <div style={{fontSize:12,fontWeight:600,color:cs.text}}>{"🔒 "}{isAr?"دفع آمن عبر Kashier":"Secure payment via Kashier"}{" — "}{price?.toLocaleString()}{" EGP"}</div>
    </div>
    <iframe src={kashierUrl} style={{flex:1,border:"none",width:"100%"}} title="Kashier Checkout"/>
  </div>;

  return <div dir={isAr?"rtl":"ltr"} style={{minHeight:"100vh",background:cs.bg,fontFamily:"'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif",overflowY:"auto"}}>
    <div style={{maxWidth:880,margin:"0 auto",padding:"24px 17px 52px"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:20,flexDirection:isAr?"row-reverse":"row"}}>
        <button onClick={onBack} style={{background:cs.inp,border:`0.5px solid ${cs.border}`,borderRadius:7,padding:"6px 12px",fontSize:11,color:cs.muted,cursor:"pointer"}}>{isAr?"→ رجوع":"← Back"}</button>
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
          {key:"kashier", label:isAr?"إتمام الدفع":"Checkout"},
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
                {l}{b==="yearly"&&<span style={{position:"absolute",top:-8,right:-4,background:"#4FAE8E",color:"white",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:99}}>-17%</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tier cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12,marginBottom:24}}>
          {Object.values(TIERS).map(tt=>{
            const sel=selTier===tt.id;
            const mp=billing==="monthly"?tt.price_monthly:tt.price_yearly;
            const total=mp?Math.round(mp*(1-disc/100)):null;
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
                  <span style={{color:"#4FAE8E",flexShrink:0}}>✓</span>{f}
                </div>)}
              </div>
            </div>;
          })}
        </div>

        {/* Seat info — flat-rate pricing, no per-seat addon. Each tier has a
            fixed employee cap (see tier.seats) included in the base price. */}
        <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:12,padding:"14px 18px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexDirection:isAr?"row-reverse":"row"}}>
            <div style={{fontSize:12,fontWeight:600,color:cs.text}}>{isAr?"الموظفون المشمولون":"Employees included"}</div>
            <div style={{fontSize:14,fontWeight:700,color:cs.blue}}>
              {tier.seats<0?(isAr?"غير محدود":"Unlimited"):`${isAr?"حتى":"Up to"} ${tier.seats}`}
            </div>
          </div>
          <div style={{fontSize:10,color:cs.muted,marginTop:4}}>
            {isAr?"السعر ثابت للباقة بالكامل — بدون رسوم إضافية للمقعد":"Flat price for the whole plan — no per-seat fees"}
          </div>
        </div>

        {/* Coupon */}
        <div style={{marginBottom:6}}>
          <div style={{display:"flex",gap:7,flexDirection:isAr?"row-reverse":"row"}}>
            <div style={{flex:1,position:"relative"}}>
              <input value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())}
                placeholder={isAr?"كود الخصم (سيُطبَّق تلقائياً)":"Coupon code (auto-validates)"}
                style={{width:"100%",boxSizing:"border-box",background:cs.inp,border:`0.5px solid ${couponErr?"#C6604F":couponData?"rgba(79,174,142,.5)":cs.border}`,
                  borderRadius:8,padding:"9px 30px 9px 12px",fontSize:12,color:cs.text,outline:"none"}}/>
              {couponChecking&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:cs.muted,animation:"spin 0.7s linear infinite"}}>⟳</div>}
              {!couponChecking&&couponData&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#4FAE8E"}}>✓</div>}
              {!couponChecking&&couponErr&&coupon&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#C6604F"}}>✗</div>}
            </div>
            <button onClick={applyCoupon} disabled={couponChecking||!coupon.trim()} style={{background:coupon.trim()?cs.blue:"rgba(148,163,184,.2)",color:"white",border:"none",borderRadius:8,
              padding:"9px 16px",fontSize:11,fontWeight:600,cursor:coupon.trim()?"pointer":"default",transition:"background .2s"}}>{t.applyCoupon}</button>
          </div>
          {couponErr&&<div style={{fontSize:11,color:"#C6604F",marginTop:4}}>{couponErr}</div>}
          {couponData&&<div style={{fontSize:11,color:"#4FAE8E",marginTop:4}}>✓ {couponData.label} {isAr?"مطبّق":"applied"}</div>}
          {referralCreditApplied>0&&<div style={{fontSize:11,color:"#4FAE8E",marginTop:4}}>🔗 {isAr?`تم تطبيق ${referralCreditApplied} جنيه من رصيد الإحالة`:`${referralCreditApplied} EGP referral credit applied`}</div>}
        </div>

        {/* Price summary */}
        {price&&<div style={{background:"rgba(99,102,241,.06)",border:"0.5px solid rgba(99,102,241,.2)",borderRadius:11,padding:"14px 16px",marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:cs.muted,marginBottom:4,flexDirection:isAr?"row-reverse":"row"}}>
            <span>{tier.name} ({billing})</span>
            <span>{subtotal?.toLocaleString()} EGP</span>
          </div>
          {disc>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#4FAE8E",marginBottom:4,flexDirection:isAr?"row-reverse":"row"}}>
            <span>Discount ({disc}%)</span><span>-{(subtotal-price).toLocaleString()} EGP</span>
          </div>}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:15,fontWeight:700,color:cs.text,paddingTop:8,borderTop:`0.5px solid ${cs.border}`,flexDirection:isAr?"row-reverse":"row"}}>
            <span>{isAr?"الإجمالي":"Total"}</span><span style={{color:"#6366f1"}}>{price.toLocaleString()} EGP/{billing==="monthly"?isAr?"شهر":"mo":isAr?"سنة":"yr"}</span>
          </div>
        </div>}

        {/* AI tip */}
        {aiTip&&<div style={{background:"rgba(79,174,142,.05)",border:"0.5px solid rgba(79,174,142,.2)",borderRadius:10,padding:"11px 14px",marginBottom:20,fontSize:11,color:"#94a3b8",lineHeight:1.6}}>
          🤖 {aiTip}
        </div>}

        <Btn cs={cs} style={{width:"100%",padding:"14px 0",fontSize:13}} disabled={!price}
          onClick={()=>setStep("method")}>{t.continuePay}</Btn>
        <div style={{textAlign:"center",marginTop:12,fontSize:10,color:cs.muted}}>
          {isAr?"دفع آمن عبر Kashier · SSL محمي · لا تُحفَظ بيانات البطاقة":"Secure payment via Kashier · SSL encrypted · Card data never stored"}
        </div>
      </>}

      {/* Step: payment method */}
      {step==="method"&&<>
        <div style={{marginBottom:20,fontSize:13,color:cs.muted,textAlign:"center"}}>
          {tier.name} · {price?.toLocaleString()} EGP/{billing==="monthly"?isAr?"شهر":"mo":isAr?"سنة":"yr"} · {tier.seats<0?(isAr?"موظفون غير محدودون":"unlimited employees"):`${isAr?"حتى":"up to"} ${tier.seats} ${isAr?"موظف":"employees"}`}
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
              {pm.instant&&<span style={{background:"rgba(79,174,142,.12)",color:"#4FAE8E",fontSize:8.5,fontWeight:700,padding:"2px 8px",borderRadius:99}}>{isAr?"فوري":"INSTANT"}</span>}
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
          onClick={doKashier}>{proc?"...":(isAr?`ادفع ${price?.toLocaleString()} EGP`:`Pay ${price?.toLocaleString()} EGP`)}</Btn>

        <div style={{textAlign:"center",marginTop:14,fontSize:10,color:cs.muted}}>
          🔒 {isAr?"مؤمّن بـ Kashier — PCI DSS compliant":"Secured by Kashier — PCI DSS compliant"}
        </div>
      </>}
    </div>
  </div>;
}

// ── Validation readout ────────────────────────────────────────────────
//
// Every accuracy figure this engine reports was measured against a synthetic
// subject — a rigid-body model with known joint angles, written in this repo.
// That model has been wrong five separate times, and every time it flattered
// the engine: the z sign was inverted, the nose sat in the wrong plane,
// distance was measured from the shoulders instead of the eyes, the arms were
// posed straight instead of typing, and jitter() left the depth channel
// noise-free. Each was found by checking the instrument rather than the
// result.
//
// The one check that has never been run is the obvious one: point a real
// camera at a real person holding a known pose and see whether the number
// matches. This panel exists so that takes twenty minutes instead of a
// research project. It is off unless explicitly asked for — ?validate=1, or
// localStorage corvus_validate=1 — and it renders nothing otherwise, so it
// cannot appear in front of a participant by accident.
function ValidationReadout({ analysis, isAr }) {
  const [copied, setCopied] = useState(false);
  const rows = [
    ["head_yaw",           "Head yaw",        "°"],
    ["fhp_index",          "Forward head",    "cm"],
    ["rounded_shoulders",  "Rounded (protraction)", "cm"],
    ["screen_distance",    "Screen distance", "cm"],
    ["neck_lean",          "Neck lean",       "°"],
    ["spine_lean",         "Lateral lean",    "°"],
    ["trunk_rotation",     "Trunk rotation",  "°"],
    ["torso_flexion",      "Forward slouch",  "%"],
    ["shoulder_elevation", "Shoulder shrug",  "%"],
    ["elbow_angle",        "Elbow angle",     "°"],
  ];
  const m = analysis?.metrics || {};
  const dump = () => {
    const lines = rows.map(([k, label, unit]) => {
      const v = m[k];
      return `${label.padEnd(24)} ${v?.value ?? "—"}${unit}  reliable=${v?.reliable}`;
    });
    lines.push(`overall score            ${analysis?.overall ?? "—"}`);
    return lines.join("\n");
  };
  return (
    <div style={{
      position: "fixed", bottom: 12, insetInlineStart: 12, zIndex: 9999,
      background: "rgba(8,14,12,.93)", border: "1px solid rgba(120,200,175,.35)",
      borderRadius: 10, padding: "10px 12px", minWidth: 268, maxWidth: 320,
      fontFamily: "'IBM Plex Mono',ui-monospace,monospace", fontSize: 11,
      color: "#d6efe6", direction: "ltr", textAlign: "left",
      boxShadow: "0 8px 30px rgba(0,0,0,.5)", backdropFilter: "blur(6px)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 7, paddingBottom: 6, borderBottom: "1px solid rgba(120,200,175,.18)" }}>
        <strong style={{ fontSize: 10.5, letterSpacing: ".08em", color: "#7fd6bb" }}>VALIDATION READOUT</strong>
        <button onClick={() => { try { navigator.clipboard.writeText(dump()); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {} }}
          style={{ background: "none", border: "1px solid rgba(120,200,175,.35)", borderRadius: 5,
            color: "#7fd6bb", fontSize: 9.5, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit" }}>
          {copied ? "copied" : "copy"}
        </button>
      </div>
      {rows.map(([k, label, unit]) => {
        const v = m[k];
        const ok = v?.reliable;
        return (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, lineHeight: 1.75 }}>
            <span style={{ color: ok ? "#9fb8ae" : "#6a7f77" }}>{label}</span>
            <span style={{ color: ok ? "#eaf6f1" : "#6a7f77", fontVariantNumeric: "tabular-nums" }}>
              {v?.value ?? "—"}{v?.value != null ? unit : ""}
              <span style={{ color: ok ? "#4FAE8E" : "#8a5f52", marginInlineStart: 6 }}>{ok ? "ok" : "n/a"}</span>
            </span>
          </div>
        );
      })}
      <div style={{ marginTop: 7, paddingTop: 6, borderTop: "1px solid rgba(120,200,175,.18)",
        display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#9fb8ae" }}>overall</span>
        <span style={{ color: "#eaf6f1", fontVariantNumeric: "tabular-nums" }}>{analysis?.overall ?? "—"}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 9.5, color: "#6a7f77", lineHeight: 1.5 }}>
        {isAr ? "لوحة تحقق — مش ظاهرة للمشاركين" : "validation only — not shown to participants"}
      </div>
    </div>
  );
}

// ── Upgrade Prompt ────────────────────────────────────────────────
// ── Nav Avatar Dropdown — replaces 10-button header overload ─────
function NavAvatarDropdown({user,profile,cs,lang,isAr,isAdmin,isHRAdmin,onProfile,onLeaderboard,onHR,onAdmin,onSetup,onOnboarding,onTour,onSignOut}){
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  const initial=(profile?.name||user?.email||"U")[0].toUpperCase();
  const tierColor=profile?.tier==="elite"?"#4FAE8E":profile?.tier==="professional"?"#0ea5e9":"#6366f1";

  // Trial days remaining
  const trialDaysLeft = profile?.is_trial && profile?.trial_expires_at
    ? Math.max(0, Math.ceil((profile.trial_expires_at.toDate?.()?.getTime?.() || 0 - Date.now()) / 86400000))
    : null;

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
    {label:isAr?"جولة تعريفية بالموقع":"Take a Tour",icon:"🧭",onClick:()=>{onTour?.();setOpen(false);}},
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
        {profile?.is_trial&&<span style={{position:"absolute",top:-3,right:-3,width:8,height:8,background:"#D6A24C",borderRadius:"50%",border:`1.5px solid ${cs.bg}`}}/>}
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
            {profile?.is_trial&&trialDaysLeft!==null&&(
              <div style={{marginTop:4,fontSize:9.5,color:"#D6A24C",fontWeight:600}}>
                {isAr?`${trialDaysLeft} يوم متبقي`:`${trialDaysLeft} days left`}
              </div>
            )}
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

function UpgradePrompt({cs,t,reason,onUpgrade,onDismiss,onClose,lang}){
  const close = onDismiss || onClose || (()=>{});
  const isAr = lang==="ar";
  // Close on Escape key
  useEffect(()=>{
    const h = e => { if(e.key==="Escape") close(); };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  },[]);
  return(
    <div
      style={{position:"fixed",inset:0,zIndex:8999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.55)"}}
      onClick={e=>{ if(e.target===e.currentTarget) close(); }}
    >
      <div style={{background:cs.card||"#0f1e2e",border:`1px solid rgba(99,102,241,.4)`,borderRadius:16,padding:"24px 24px 20px",maxWidth:360,width:"calc(100% - 48px)",position:"relative"}}>
        <button onClick={close} style={{position:"absolute",top:12,right:12,background:"none",border:"none",color:cs.muted||"#64748b",fontSize:18,cursor:"pointer",lineHeight:1}}>✕</button>
        <div style={{fontSize:28,marginBottom:12}}>🚀</div>
        <div style={{fontSize:15,fontWeight:700,color:cs.text||"#f1f5f9",marginBottom:6}}>{isAr?"ترقية للاستمرار":"Upgrade to continue"}</div>
        <div style={{fontSize:12,color:cs.muted||"#94a3b8",marginBottom:20,lineHeight:1.6}}>{reason||(isAr?"افتح المميزات المتقدمة بخطة أعلى":"Unlock advanced features with a higher tier")}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onUpgrade} style={{flex:1,padding:"10px 0",background:"#1a56db",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer"}}>
            {isAr?"ترقية الآن":"Upgrade Now"}
          </button>
          <button onClick={close} style={{padding:"10px 14px",background:"none",border:`0.5px solid ${cs.border||"#334155"}`,borderRadius:10,fontSize:12,color:cs.muted||"#94a3b8",cursor:"pointer"}}>
            {isAr?"لاحقاً":"Later"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Account Type + Device Onboarding ─────────────────────────────
function AccountTypeSelect({cs,t,lang,onSelect}){
  const isAr=lang==="ar";
  const dir=isAr?"rtl":"ltr";
  return <div dir={dir} style={{position:"fixed",inset:0,background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9000,fontFamily:"'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif",padding:24}}>
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

// DeviceSelect component removed — was defined but never rendered
// anywhere (showDeviceSelect was never set to true), and offered Phone
// which has been removed app-wide.

// ══════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ══════════════════════════════════════════════════════════════════


// ── Lazy-loaded components ──────────────────────────────────────
// lazyNamed(): wraps React.lazy() so that if the dynamic import DOES
// resolve (no network failure — that's already handled by the
// vite:preloadError listener in main.jsx) but the named export we
// expect isn't on the module, we don't feed `undefined` into
// React.lazy — which is exactly what produces the minified React
// error #306 ("Element type is invalid. Received a promise that
// resolves to: undefined.") that crashed the app in production.
// This happens when a tab is left open across a new deploy and the
// CDN briefly serves a stale/mismatched chunk for the same hashed
// filename. Instead of crashing, force one guarded reload — same
// recovery pattern as the preloadError handler — so the user just
// gets the current build instead of a dead error screen.
function lazyNamed(importFn, exportName) {
  return React.lazy(() =>
    importFn().then(m => {
      const Comp = m && m[exportName];
      if (typeof Comp !== "function" && typeof Comp !== "object") {
        console.error(`[lazyNamed] "${exportName}" missing from chunk — forcing reload to recover`);
        const key = "corvus_stale_export_reload";
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          window.location.reload();
        }
        return { default: () => null }; // inert placeholder while reload kicks in
      }
      return { default: Comp };
    })
  );
}
const AnalyticsDashboard = lazyNamed(() => import("./AnalyticsDashboard.jsx"), "AnalyticsDashboard");
const WorkforceAnalytics = lazyNamed(() => import("./WorkforceAnalytics.jsx"), "WorkforceAnalytics");
const AIReports = lazyNamed(() => import("./AIReports.jsx"), "AIReports");
const PredictiveAI = lazyNamed(() => import("./PredictiveAI.jsx"), "PredictiveAI");
const AIInsights = lazyNamed(() => import("./AIInsights.jsx"), "AIInsights");
const EnterpriseRBAC = lazyNamed(() => import("./EnterpriseRBAC.jsx"), "EnterpriseRBAC");
const WhiteLabel = lazyNamed(() => import("./WhiteLabel.jsx"), "WhiteLabel");
const MultiTenantManager = lazyNamed(() => import("./MultiTenantManager.jsx"), "MultiTenantManager");
const APIMarketplace = lazyNamed(() => import("./APIMarketplace.jsx"), "APIMarketplace");
const IntegrationsHub = lazyNamed(() => import("./IntegrationsHub.jsx"), "IntegrationsHub");
const AuditSystem = lazyNamed(() => import("./AuditSystem.jsx"), "AuditSystem");
const MFASetup = lazyNamed(() => import("./MFASetup.jsx"), "MFASetup");
const ChurnPrediction = lazyNamed(() => import("./ChurnPrediction.jsx"), "ChurnPrediction");
const CustomerSuccess = lazyNamed(() => import("./CustomerSuccess.jsx"), "CustomerSuccess");
const GrowthHub = lazyNamed(() => import("./GrowthHub.jsx"), "GrowthHub");
const ReferralProgram = lazyNamed(() => import("./ReferralProgram.jsx"), "ReferralProgram");
const MRRDashboard = lazyNamed(() => import("./MRRDashboard.jsx"), "MRRDashboard");
const AdminDashboard = lazyNamed(() => import("./AdminDashboard.jsx"), "AdminDashboard");
const BillingDashboard = lazyNamed(() => import("./BillingDashboard.jsx"), "BillingDashboard");

// MFA login gate — shown after a successful Firebase sign-in when the
// account has 2FA enabled. This is new: previously nothing anywhere
// checked mfa_enabled at sign-in at all, so 2FA gave no real protection.
function MFALoginChallenge({ user, profile, cs, lang, onVerified, onSignOut }) {
  const isAr = lang === "ar";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const method = profile?.mfa_method === "sms" ? "sms" : "totp";

  const sendSms = async () => {
    setBusy(true); setError("");
    try {
      const {getAuthToken} = await import("./firebase.js");
      await fetch("/api/auth/mfa/sms/send", {method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+(await getAuthToken().catch(()=>""))},body:JSON.stringify({phone:profile?.mfa_phone||""})});
      setSmsSent(true);
    } catch(e) { setError(e?.message || (isAr?"تعذر إرسال الكود":"Couldn't send code")); }
    setBusy(false);
  };

  const verify = async () => {
    if (code.trim().length < 6) { setError(isAr?"أدخل الكود كاملاً":"Enter the full code"); return; }
    setBusy(true); setError("");
    try {
      const {getAuthToken} = await import("./firebase.js");
      // SECURITY FIX: this used to `await fetch(...)` and then call
      // onVerified() unconditionally. fetch does not reject on a 4xx, so a
      // 401 "Invalid code" resolved normally and cleared the challenge —
      // ANY six-character string signed the user in. MFASetup.jsx:33 already
      // checks res.ok; this call site did not.
      const res = await fetch("/api/auth/mfa/login-verify", {method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+(await getAuthToken().catch(()=>""))},body:JSON.stringify({code:code.trim()})});
      if(!res.ok){
        let msg="";
        try{ msg=(await res.json())?.error||""; }catch{}
        setError(msg || (isAr?"كود غير صحيح":"Invalid code"));
        setCode("");
        setBusy(false);
        return;
      }
      onVerified();
    } catch(e) {
      setError(e?.message || (isAr?"كود غير صحيح":"Invalid code"));
      setCode("");
    }
    setBusy(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:cs.bg, zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:400, background:cs.card, border:`1px solid ${cs.border}`, borderRadius:18, padding:28, textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:10 }}>🛡</div>
        <div style={{ fontWeight:800, fontSize:18, color:cs.text, marginBottom:6 }}>{isAr?"تأكيد الدخول":"Verify it's you"}</div>
        <div style={{ fontSize:13, color:cs.muted, marginBottom:20, lineHeight:1.6 }}>
          {method==="sms"
            ? (isAr?`أرسلنا كود لرقمك المسجل. اضغط "إرسال كود" لو محتاج واحد جديد.`:`We'll text a code to your registered number. Tap "Send code" if you need a new one.`)
            : (isAr?"افتح تطبيق المصادقة وادخل الكود المكون من 6 أرقام":"Open your authenticator app and enter the 6-digit code")}
        </div>
        {method==="sms" && (
          <button onClick={sendSms} disabled={busy} style={{ marginBottom:14, background:cs.inp, border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"8px 16px", cursor:"pointer", fontWeight:600, fontSize:12 }}>
            {smsSent ? (isAr?"✓ اتبعت — ابعت تاني":"✓ Sent — resend") : (isAr?"إرسال كود":"Send code")}
          </button>
        )}
        <input
          value={code}
          onChange={e=>setCode(e.target.value.replace(/[^0-9A-Za-z-]/g,""))}
          onKeyDown={e=>e.key==="Enter"&&verify()}
          placeholder={isAr?"الكود":"Code"}
          maxLength={11}
          style={{ width:"100%", boxSizing:"border-box", textAlign:"center", fontSize:20, letterSpacing:3, fontWeight:700, background:cs.inp, border:`1.5px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"12px", outline:"none", marginBottom:12 }}
          autoFocus
        />
        {error && <div style={{ color:"#C6604F", fontSize:12, marginBottom:12 }}>{error}</div>}
        <button onClick={verify} disabled={busy} style={{ width:"100%", background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:800, fontSize:15, marginBottom:10 }}>
          {busy ? (isAr?"جاري التحقق…":"Verifying…") : (isAr?"تأكيد":"Verify")}
        </button>
        <div style={{ fontSize:11, color:cs.muted, marginBottom:14 }}>{isAr?"مش عندك وصول للتطبيق أو الرقم؟ استخدم أحد أكواد النسخ الاحتياطي":"Lost access to your app or phone? Use one of your backup codes instead"}</div>
        <button onClick={onSignOut} style={{ background:"transparent", border:"none", color:cs.muted, cursor:"pointer", fontSize:12, textDecoration:"underline" }}>{isAr?"تسجيل خروج":"Sign out"}</button>
      </div>
    </div>
  );
}

export default function App(){
  useLiveUICSS(); // one-time keyframe injection for the Live page's redesigned UI (LiveUI.jsx)
  const[user,setUser]=useState(null);
  const[mfaChallengePending,setMfaChallengePending]=useState(false);
  const[backendDown,setBackendDown]=useState(false); // true when /api/analyze fails repeatedly in fallback mode — see runLoop
  const[profile,setProfile]=useState(null);
  const[authChecked,setAuthChecked]=useState(false);
  const[startupError,setStartupError]=useState(null);

  // ── ABSOLUTE SAFETY NET — app MUST unblock within 6s no matter what ──
  // Calls goLandingUnlessDeepLinked, which is declared further down. That is
  // fine and not a temporal-dead-zone hazard: the reference lives inside a
  // setTimeout callback, which cannot run until the whole component body has
  // finished evaluating.
  useEffect(()=>{
    const t = setTimeout(()=>{
      setAuthChecked(c=>{ if(!c && !_oauthInProgress.current){ console.warn("[App] Auth never resolved — forcing landing"); goLandingUnlessDeepLinked(setPageRaw); return true; } return c; });
    }, 6000);
    return ()=>clearTimeout(t);
  },[]);
  // ── Hash-based routing — fixes back button & enables deep links ──
  // Every page that has a render branch below, and nothing that doesn't.
  //
  // This list had drifted apart from reality in BOTH directions, and each
  // direction produced its own bug:
  //   · "leaderboard" and "invite" are navigated to by the app but were
  //     missing, so hashToPage fell through to "home" — a refresh or a shared
  //     link silently dropped the user somewhere else.
  //   · "report" had no branch at all and "enterprise" only has one for
  //     LOGGED-OUT visitors, so a signed-in user on either fell past every
  //     `if (page===...)` to the unconditional live-analysis return at the
  //     bottom — an old bookmark to #report opened a camera session. Both stay
  //     in the set (enterprise is a real marketing route) and now have explicit
  //     signed-in redirects below.
  // "profile" and "embed" have branches and are added so they stop being dead.
  const VALID_PAGES = new Set(["home","live","setup","pricing","auth","landing","admin","hr","enterprise","report","marketplace","break","demo","demo_dashboard","leaderboard","invite","profile","embed"]);
  const hashToPage = (h) => {
    const p = h.replace(/^#\/?/, "") || "landing";
    // Map known aliases
    const ALIAS = { settings:"home", analytics:"home", dashboard:"home", billing:"home", subscription:"home" };
    // Landing-page in-page section anchors (e.g. "/#casestudies" linked
    // from ProductPage.jsx) aren't separate app pages — they were
    // falling through to the "home" dashboard fallback below, a dead
    // end for a logged-out visitor. Route them back to "landing";
    // LandingPageV7's own mount effect scrolls to the anchor.
    const LANDING_SECTIONS = new Set(["features","casestudies","how","faq"]);
    if (LANDING_SECTIONS.has(p)) return "landing";
    return ALIAS[p] || (VALID_PAGES.has(p) ? p : "home");
  };
  // Pages a signed-out visitor can legitimately be looking at, so that
  // "auth resolved and there is no user" does not throw them off one.
  //
  // The useState initializer below already recognises /auth and normalises it
  // to #auth. That fix worked — and was then undone a few hundred
  // milliseconds later by onAuthStateChanged, which called setPage("landing")
  // unconditionally for every signed-out visitor. Traced in a browser:
  //
  //   0. START pathname=/auth hash=
  //   1. replaceState("#auth")     <- the initializer, correct
  //   2. pushState("#landing")     <- the auth listener, overriding it
  //
  // So every conversion link on the marketing site — the pricing page's
  // "Start 7-day trial" buttons are href="/auth?mode=signup&plan=..." —
  // dropped the visitor back on the homepage with the chosen plan silently
  // discarded, and invite links did the same. Signing out from a signed-in
  // page still lands on the landing page, because those pages are not in
  // this set.
  const SIGNED_OUT_PAGES = new Set(["auth","landing","pricing","invite","demo","report","embed","leaderboard"]);
  const goLandingUnlessDeepLinked = (set) => {
    let current = "landing";
    // Read the hash rather than the `page` state: this runs from inside
    // long-lived callbacks whose closure over `page` is stale by then.
    try { current = hashToPage(window.location.hash); } catch {}
    if (!SIGNED_OUT_PAGES.has(current)) set("landing");
  };
  const [page, setPageRaw] = useState(() => {
    const h = window.location.hash;
    // setPage("live") writes its hash with replaceState, so #live is what the
    // URL still reads after any session — and this initializer then reopened
    // the camera page on the next load or the next sign-in, in front of a user
    // who had asked for their dashboard. A fresh mount cannot have a session in
    // progress by definition: streamRef is null, nothing is scoring, the
    // <video> has not been created yet. So #live here is always stale.
    //
    // onAuthStateChanged has its own copy of this check, but it only runs once
    // Firebase resolves — on a slow connection that is several seconds of the
    // live page sitting there first, which is exactly what a user reports as
    // "I logged in and it went straight to the live page".
    if (h === "#live") { window.history.replaceState({}, "", "#home"); return "home"; }
    if (h) return hashToPage(h);
    // BUG FIX: every standalone marketing page (Product/Solutions/Pricing/
    // HowItWorks/FAQ + their shared StandaloneLayout header) links Sign In
    // and Sign Up as real paths — href="/auth" and href="/auth?mode=signup"
    // — not hashes. Those paths aren't in main.jsx's STANDALONE_ROUTES, so
    // they fall through to loading this App with an empty hash, which
    // always defaulted to "landing" and silently dropped the user back on
    // the homepage instead of the sign-in/sign-up form they clicked for.
    // This was effectively breaking every conversion CTA on the marketing
    // site. Recognize the real path here too, then normalize to the hash
    // form so back/forward and the rest of the app's hash-based routing
    // keep working exactly as before.
    if (/^\/auth\/?$/.test(window.location.pathname)) {
      window.history.replaceState({}, "", "#auth");
      return "auth";
    }
    // #5 FIX: returning user (was previously logged in) shows login page not full landing
    try { if (localStorage.getItem("corvus_was_logged") === "1") return "auth"; } catch {}
    return "landing";
  });
  // ── White Label: load company branding and apply to cs ──────────────
  useEffect(()=>{
    if(!user?.uid) return;
    // Admin-only server-side (backend checks user_type/is_org_owner/is_admin)
    // — skip the request entirely for accounts that clearly aren't going to
    // be authorized, instead of firing it for every logged-in user and
    // eating a 403/500 + console error on every load.
    const canHaveBranding = profile?.company_id || profile?.is_org_owner || profile?.is_admin
      || ["platform_admin","hr_admin"].includes(profile?.user_type);
    if(!canHaveBranding) return;
    fetch("/api/company/branding", {
      headers:{ Authorization: `Bearer ${user.accessToken||""}` }
    })
    .then(r=>r.ok?r.json():null)
    .then(d=>{
      const b = d?.branding;
      if(!b || !Object.keys(b).length) return;
      // Apply primary color as CSS variable
      if(b.primaryColor) document.documentElement.style.setProperty("--brand-primary", b.primaryColor);
      if(b.bgColor)      document.documentElement.style.setProperty("--brand-bg", b.bgColor);
      if(b.fontFamily)   document.documentElement.style.setProperty("--brand-font", b.fontFamily);
      // Apply favicon
      if(b.faviconUrl){
        let link = document.querySelector("link[rel~='icon']");
        if(!link){ link=document.createElement("link"); link.rel="icon"; document.head.appendChild(link); }
        link.href = b.faviconUrl;
      }
      // Apply page title
      if(b.companyName) document.title = `${b.companyName} | Powered by Corvus`;
    })
    .catch(()=>{});
  },[user?.uid, profile?.company_id, profile?.is_org_owner, profile?.is_admin, profile?.user_type]);

  // Firebase action URLs (password reset / email verify from email links)
  const _fbp = new URLSearchParams(window.location.search);
  const [fbMode]    = useState(_fbp.get("mode")    || null);
  const [fbOobCode] = useState(_fbp.get("oobCode") || null);
  // Family/Partner Mode invite link (?family_invite=TOKEN) — processed
  // once the user is authenticated, see the effect below.
  const [pendingFamilyInvite, setPendingFamilyInvite] = useState(_fbp.get("family_invite") || null);
  const [showEmailVerify, setShowEmailVerify] = useState(false);
  const [showChangePw,    setShowChangePw]    = useState(false);
  const setPage = (p) => {
    if (p === "live" || p === "setup") {
      window.history.replaceState({}, "", "#" + p);
    } else {
      window.history.pushState({}, "", "#" + p);
    }
    setPageRaw(p);
    // Every other screen that changes its own sub-view resets scroll
    // manually (see AuthPage's view switcher) — the page router itself
    // never did, so navigating here while scrolled down on the previous
    // page (e.g. tapping "Start Session" from partway down the Home
    // dashboard) landed the user mid-scroll on the new page instead of at
    // its top. On the Live page specifically this was severe: the camera
    // preview sits at the very top of the layout, so a carried-over scroll
    // position could push it fully off-screen behind stats/tips/settings,
    // leaving the one thing a "live" session is actually for invisible.
    try { window.scrollTo(0, 0); } catch {}
  };
  // Listen for browser back/forward
  useEffect(() => {
    const onPop = () => {
      const newPage = hashToPage(window.location.hash);
      // Physical/mobile back button used to just swap the page underneath an
      // active camera session: stream kept running, camera indicator light
      // stayed on, RAF loop kept burning CPU in the background, and the
      // session was never saved -- none of that happened only through the
      // in-app Back buttons, which explicitly call stopCamera() themselves.
      // streamRef.current (not just camActiveRef) is the real source of
      // truth for "is a camera stream open right now" — the preview/
      // countdown phase opens the stream and shows it live BEFORE camActive
      // ever becomes true, so checking camActive alone would miss that
      // window entirely.
      if(newPage!=="live" && (camActiveRef.current || streamRef.current)){ stopCamera(); }
      // showHealthConsent can be open BEFORE any stream exists (it's the
      // very first check in startCamera(), before getUserMedia is even
      // called) — reset unconditionally so it can't get stuck open and
      // block clicks on whatever page the back button lands on.
      if(newPage!=="live"){ setShowHealthConsent(false); setPreviewPhase(null); }
      setPageRaw(newPage);
      try { window.scrollTo(0, 0); } catch {}
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const[mode,_setMode]=useState(()=>{
    try{
      const saved=localStorage.getItem("last_mode");
      // Phone and Side modes were removed app-wide — a value saved before
      // that change would otherwise silently select a mode the UI no
      // longer offers a way back out of.
      return saved==="laptop" ? saved : null;
    }catch{return null;}
  });
  const setMode=(m)=>{ _setMode(m); try{localStorage.setItem("last_mode",m);}catch{} };
  const[lowLight,setLowLight]=useState(false);
  const[multiPersonWarning,setMultiPersonWarning]=useState(false); // see subjectRejectStreakRef in runLoop
  const[sessionInsights,setSessionInsights]=useState([]);
  useEffect(()=>{ lmSmootherRef.current?.reset(); frameBufferRef.current?.clear(); distSmootherRef.current?.reset(); resetProportions(); },[mode]);
  const[tier,setTier]=useState(null);
  const[acctType,setAcctType]=useState(null); // null until known — user chooses only if signup didn't already tell us
  // Sync acctType from the profile whenever it's already known — this used
  // to only apply for page!=="setup", plus a special-cased employee rule,
  // which meant a fresh company (hr_admin) signup — who just explicitly
  // chose "Company/Team" and typed their company name during signup — saw
  // the *exact same* individual-vs-company question again on the very next
  // screen, with nothing distinguishing it from the individual flow. Any
  // account type already known from signup now skips the picker outright,
  // on setup or not — it was only ever meant to ask when we don't know yet.
  useEffect(()=>{
    if(profile?.acct_type && !acctType) setAcctType(profile.acct_type);
    else if((profile?.user_type==="employee"||profile?.user_type==="hr_admin") && !acctType) setAcctType("company");
  },[profile?.acct_type,profile?.user_type,acctType]); // "company" | "individual"
  const[devicePref,setDevicePref]=useState(null); // "laptop" only now — Phone option removed app-wide
  const[camActive,setCamActive]=useState(false);
  // Popstate (browser/mobile back button) fires from a listener registered
  // once on mount — without a ref, its closure would only ever see camActive
  // as it was at that first render (false), so it could never detect "camera
  // is currently running" no matter what actually happens later.
  const camActiveRef=useRef(false);
  useEffect(()=>{ camActiveRef.current=camActive; },[camActive]);


  // Catch-all safety net, independent of the popstate handler above: force
  // these two modals closed on ANY transition away from the live page, via
  // any mechanism (not just back-button).
  useEffect(()=>{
    if(page!=="live"){ setShowHealthConsent(false); setPreviewPhase(null); setStartingSession(false); }
  },[page]);
  const[cameraStatus,setCameraStatus]=useState("idle"); // idle | requesting | ready | denied | no-device
  // Camera preview → 3-2-1 countdown flow, cancellable the whole time.
  const[previewPhase,setPreviewPhase]=useState(null); // null | "preview" | "countdown"
  const[countdownN,setCountdownN]=useState(3);
  const countdownIvRef=useRef(null);
  // Bridges the gap between the 3-2-1 countdown finishing (previewPhase→null)
  // and camActive actually flipping true inside beginScoring() — that gap can
  // be up to ~1.2s (see the startSession race comment below) and, without
  // this flag, the idle "Tap Start Analysis" guidance would flash back on
  // screen during it, reading to the user as the page freezing/breaking.
  const[startingSession,setStartingSession]=useState(false);
  // True pause/resume — freezes the RAF analysis loop and the session
  // timer without ending or saving the session. Camera stream stays
  // attached (video keeps showing) so resuming is instant, no re-request.
  const[isPaused,setIsPaused]=useState(false);
  const pausedAtRef=useRef(null);
  const[mpStatus,setMpStatus]=useState("loading");
  // AI Coach status — previously the sidebar dot was hardcoded to always show
  // "AI Coach (local, free)" regardless of whether WebLLM had actually loaded.
  // Now wired to the real localAI.js state via its subscription API.
  const[aiCoachStatus,setAiCoachStatus]=useState(()=>getLocalAIStatus());
  useEffect(()=>{
    setAiCoachStatus(getLocalAIStatus());
    return onLocalAIStatus(setAiCoachStatus);
  },[]);
  const[analysis,setAnalysis]=useState(null);
  const[history,setHistory]=useState([]);
  const[sessionTime,setSessionTime]=useState(0);
  const[goodF,setGoodF]=useState(0);
  const[totalF,setTotalF]=useState(0);
  const[alertCounts,setAlertCounts]=useState({total:0,neck:0,dist:0});
  const[alerts,setAlerts]=useState([]);
  // "Select mode to begin" was the default before Phone/Side modes were
  // removed app-wide (Laptop is now the only mode, auto-selected — see the
  // "Camera-mode switcher removed" note further down). Left as-is, every
  // new live session opened with an instruction to do something there was
  // no longer any UI for. Default now matches what a user actually needs
  // to do first. `lang` isn't initialized yet at this point in the
  // component, so read the same localStorage key it uses rather than
  // depending on it.
  const[alertMsg,setAlertMsg]=useState(()=>{
    let ar=false; try{ ar = localStorage.getItem("lang")==="ar"; }catch{}
    return { text: ar ? "اضبط وضعيتك أمام الكاميرا ثم اضغط ابدأ" : "Position yourself in frame, then press Start", type:"info" };
  });
  const[scoreStatus,setScoreStatus]=useState(null); // silent good-posture score display
  const[fixItOpen,setFixItOpen]=useState(null);     // #8 which alert idx has fix-it open
  const[streakAlert,setStreakAlert]=useState(false); // #10 streak protection shown
  const[weeklyPattern,setWeeklyPattern]=useState(null); // #9 computed on session end
  const[showNotifCard,setShowNotifCard]=useState(false); // contextual notif permission
  const[sound,setSound]=useState(()=>{try{return localStorage.getItem("corvus_sound")!=="0";}catch{return true;}});
  useEffect(()=>{try{localStorage.setItem("corvus_sound",sound?"1":"0");}catch{}},[sound]);

  // OS notifications while the tab is in the background. There was no control
  // for this at all: the alert path fired one whenever document.hidden, and
  // the only way to stop it was to revoke permission in browser settings.
  const[desktopNotifs,setDesktopNotifs]=useState(()=>{try{return localStorage.getItem("corvus_desktop_notifs")!=="0";}catch{return true;}});
  useEffect(()=>{try{localStorage.setItem("corvus_desktop_notifs",desktopNotifs?"1":"0");}catch{}},[desktopNotifs]);
  const[notifPerm,setNotifPerm]=useState(()=>notificationState());

  // How hard the coach pushes. Everything below was hardcoded — the score gate
  // (65), how long a fault had to persist before it counted (15s), and the
  // per-cause backoff — so "stricter alerts" was not something a user could
  // ask for. Persisted, and genuinely read by the analysis loop (it is in
  // runLoop's dep array, which rebinds the RAF closure on change).
  const[alertSensitivity,setAlertSensitivity]=useState(()=>{
    try{ const v=localStorage.getItem("corvus_alert_sensitivity"); return v==="strict"||v==="relaxed"?v:"balanced"; }catch{ return "balanced"; }
  });
  useEffect(()=>{try{localStorage.setItem("corvus_alert_sensitivity",alertSensitivity);}catch{}},[alertSensitivity]);
  // strict  — notices a 70 and speaks up after 8s, repeats sooner
  // relaxed — only genuinely poor posture (55), held for half a minute
  const SENS = alertSensitivity==="strict"
    ? { gate:72, dwellMs: 8000, base:3*60*1000, mildBeeps:true  }
    : alertSensitivity==="relaxed"
    ? { gate:55, dwellMs:30000, base:12*60*1000, mildBeeps:false }
    : { gate:65, dwellMs:15000, base:5*60*1000, mildBeeps:false };
  // Elite voice coach — persisted preference; actual enablement is tier-gated below
  const[voiceCoach,setVoiceCoach]=useState(()=>{try{return localStorage.getItem("corvus_voice_coach")==="1";}catch{return false;}});
  const[faceBlur,setFaceBlur]=useState(()=>{try{return localStorage.getItem("corvus_face_blur")==="1";}catch{return false;}});
  // Pro-tier Custom Alert Rules — synced from profile once it loads (see effect below)
  const[customAlertRules,setCustomAlertRules]=useState([]);
  const[showCustomAlertRules,setShowCustomAlertRules]=useState(false);
  const[showSkeleton,setShowSkeleton]=useState(()=>{try{return localStorage.getItem("corvus_show_skeleton")!=="0";}catch{return true;}});
  const[showAngles,setShowAngles]=useState(()=>{try{return localStorage.getItem("corvus_show_angles")!=="0";}catch{return true;}});
  // Was an inline `new AudioContext()` per break reminder, never closed — the
  // same leak playBeep() had. Both now share the engine's single context.
  const playPostureAlert=()=>{ try{ playBreakChime(); }catch{} };
  const[sessionId,setSessionId]=useState(null);
  const[aiInsight,setAiInsight]=useState(null);
  const[darkMode,setDarkMode]=useState(()=>{
    try{const v=localStorage.getItem("darkMode");return v!==null?v==="true":true;}catch{return true;}
  });
  // Stored preference wins; otherwise fall back to the browser locale so an
  // Arabic-locale visitor (the primary market) lands in Arabic on first visit.
  // The landing page used to do this detection privately off navigator.language
  // while ignoring the lang prop passed to it — which is why toggling language
  // there never followed you into sign-up. Now that it reads this value, the
  // locale fallback has to live here or first-visit auto-detection is lost.
  const[lang,setLang]=useState(()=>{
    try{
      const saved = localStorage.getItem("lang");
      if (saved) return saved;
    }catch{}
    try{
      return (typeof navigator!=="undefined" && navigator.language||"").toLowerCase().startsWith("ar") ? "ar" : "en";
    }catch{return "en";}
  });

  // Persist preferences
  useEffect(()=>{
    try{localStorage.setItem("darkMode",darkMode);}catch{}
    document.body.classList.toggle("dark",  darkMode);
    document.body.classList.toggle("light", !darkMode);
  }, [darkMode]);
  useEffect(()=>{try{localStorage.setItem("lang",lang);}catch{}}, [lang]);
  const { toasts, addToast: _rawAddToast, dismiss: dismissToast } = useToasts();
  // ── Focus Mode ────────────────────────────────────────────────
  // Was a Professional-tier pricing-page promise with zero
  // implementation anywhere in the codebase. Real, scoped behavior:
  // while active, suppresses the generic toast queue (achievements,
  // streak celebrations, upsell nudges, etc.) so a session feels
  // distraction-free — it does NOT touch actual posture-correction
  // alerts, which already live on a completely separate mechanism
  // (setAlertMsg/speakCoach/sendDesktopNotif in the live-analysis loop,
  // not addToast) — those are the whole point of using the app and
  // are never suppressed by this.
  const [focusMode, setFocusMode] = useState(() => {
    try { return localStorage.getItem("corvus_focus_mode") === "1"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("corvus_focus_mode", focusMode ? "1" : "0"); } catch {} }, [focusMode]);
  const addToast = useCallback((text, type = "info", duration) => {
    if (focusMode && type !== "error") return null; // errors always get through
    return _rawAddToast(text, type, duration);
  }, [focusMode, _rawAddToast]);
  const toast = addToast; // alias

  // ── Family/Partner Mode invite acceptance ────────────────────────
  // ?family_invite=TOKEN in the URL (from the invite email) — processed
  // once we know who's logged in, then cleared from the URL either way
  // so a refresh doesn't try to re-accept it.
  useEffect(() => {
    if (!pendingFamilyInvite || !user) return;
    const token = pendingFamilyInvite;
    setPendingFamilyInvite(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("family_invite");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    FamilyAPI.accept(token)
      .then(() => {
        addToast(isAr ? "🎉 اتربط حسابك بنجاح — عندك دلوقتي نفس صلاحيات الباقة" : "🎉 Account linked — you now have the same plan access", "success");
      })
      .catch(e => {
        addToast(e?.message || (isAr ? "تعذر قبول الدعوة" : "Couldn't accept the invite"), "error");
      });
  }, [pendingFamilyInvite, user]);

  const isOnline = useOnline();
  const[showOnboard,setShowOnboard]=useState(false);
  const[showCompanyOnboard,setShowCompanyOnboard]=useState(false);
  // ── Trigger onboarding — ONE-TIME for new users only ────────────
  useEffect(()=>{
    if(!user||!profile||page!=="home") return;
    const done = (profile.onboarding_done?.length||0) > 0;
    if(done) return;
    if(profile.acct_type==="company" && profile.user_type!=="employee" && !profile.company_id){
      const t=setTimeout(()=>setShowCompanyOnboard(true),800);
      return()=>clearTimeout(t);
    }
    if(profile.acct_type!=="company"){
      const t=setTimeout(()=>setShowOnboard(true),1200);
      return()=>clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.uid, profile?.onboarding_done?.length, profile?.acct_type, profile?.user_type, profile?.company_id, page]);
  const[userSessions,setUserSessions]=useState([]);
  // "We have not fetched yet" is a different fact from "there is nothing".
  //
  // `userSessions` starts as [] and every empty state in the product keys off
  // `userSessions.length === 0`, so for the whole first round-trip to Firestore
  // a returning user with fifty sessions is shown "No sessions yet — start
  // your first session". On a fast connection that is a flicker; on a slow one,
  // or on a demo laptop on conference wifi, it is the first thing anyone sees.
  // Set false by every path that resolves the query, including the failure
  // paths — an error is also "no longer loading", and leaving it true forever
  // would trade a wrong empty state for an infinite spinner.
  const[sessionsLoading,setSessionsLoading]=useState(true);
  const[allUsers,setAllUsers]=useState([]);
  const[deepPlan,setDeepPlan]=useState(null);
  const[showQuarterlyReport,setShowQuarterlyReport]=useState(false);

  // Track referral clicks — fire-and-forget on mount
  useEffect(()=>{
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) {
        fetch("/api/referral/track",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ref_code:ref})}).catch(()=>{});
        try { sessionStorage.setItem("corvus_ref",ref); } catch {}
      }
    } catch {}
  },[]);
  const[showSchoolsModal,setShowSchoolsModal]=useState(false);
  const[showDevPortal,setShowDevPortal]=useState(false);
  const[showInsuranceModal,setShowInsuranceModal]=useState(false);
  const[showCertModal,setShowCertModal]=useState(()=>{
    try{return new URLSearchParams(window.location.search).get("cert_issued")==="1";}catch{return false;}
  });
  const[authMode,setAuthMode]=useState(()=>new URLSearchParams(window.location.search).get("mode")==="signup"?"signup":"login");
  const[deepBilling,setDeepBilling]=useState("monthly");
  // Human-readable name for a plan deep-linked from the marketing site, so
  // the signup form can show the visitor that their choice came with them.
  // Built here rather than in AuthPage because the tier maps live in this
  // module and cover both the B2C and B2B id spaces.
  const deepPlanLabel = (()=>{
    const tier = deepPlan && (TIERS[deepPlan] || B2B_TIERS[deepPlan]);
    if(!tier) return null;
    // lang, not isAr: `const isAr` is declared ~170 lines below this point
    // inside the same component body, and this runs during render, so
    // referencing it here throws "Cannot access 'isAr' before
    // initialization" — a white screen on every page load. eslint does not
    // flag it (the name IS in scope, just later; that is no-use-before-define,
    // which is off in this config), and the build succeeds. Only loading the
    // page catches it.
    const billLabel = deepBilling==="yearly"
      ? (lang==="ar"?"سنوي":"yearly")
      : (lang==="ar"?"شهري":"monthly");
    return tier.price_egp_monthly===0 ? tier.name : `${tier.name} · ${billLabel}`;
  })();
  const[companyId,setCompanyId]=useState(null);
  const[showUpgrade,setShowUpgrade]=useState(false);
  const[upgradeReason,setUpgradeReason]=useState("");
  const[showAcctSelect,setShowAcctSelect]=useState(false);
  const[showDeviceSelect,setShowDeviceSelect]=useState(false);
  // Persisted. It was `useState(true)` with no setter call anywhere in the
  // codebase, so "remind me to take breaks" was a permanent, unreachable yes.
  const[breakReminder,setBreakReminder]=useState(()=>{
    try { return localStorage.getItem("corvus_break_reminder") !== "0"; } catch { return true; }
  });
  useEffect(()=>{
    try { localStorage.setItem("corvus_break_reminder", breakReminder ? "1" : "0"); } catch {}
  },[breakReminder]);
  const[breakReturnPage,setBreakReturnPage]=useState("live"); // where the break page returns to
  // Leaving Live for the break page unmounts the <video>, but nothing here used
  // to stop or pause anything: the camera tracks kept running (OS indicator
  // light on for the whole break), the session timer and the rAF loop kept
  // going, and on return a fresh <video> mounted with no srcObject — black feed
  // forever, while the UI still showed "Live", a running clock and Pause/Stop.
  // Stopping then saved a session whose duration included the break.
  // These refs are assigned by the effect below, because pauseSession/camActive
  // are declared several thousand lines further down.
  const pauseForBreakRef = useRef(null);
  const goToBreak=useCallback(()=>{
    pauseForBreakRef.current?.();
    setBreakReturnPage(page==="break"?"live":page);
    setPage("break");
  },[page]);
  // Also persisted — it reset to 25 on every reload, so a user who chose 60
  // was back to being interrupted every 25 minutes the next time they opened
  // the app, with no indication their setting had been discarded.
  const[breakIntervalMin,setBreakIntervalMin]=useState(()=>{
    try { const v = parseInt(localStorage.getItem("corvus_break_interval")||"25",10);
          return [15,25,45,60,90].includes(v) ? v : 25; } catch { return 25; }
  });
  useEffect(()=>{
    try { localStorage.setItem("corvus_break_interval", String(breakIntervalMin)); } catch {}
  },[breakIntervalMin]);
  const[showDashboard,setShowDashboard]=useState(false);

  // Calibration (personal baseline)
  const[showCalibWizard,setShowCalibWizard]=useState(false);
  const[showQATest,setShowQATest]=useState(false); // dev-only structured accuracy test
  const { calibration: savedCalib } = useCalibration(profile?.uid);
  const [calibData, setCalibData] = useState(null);
  const [calibStale, setCalibStale] = useState(false); // true when calibration >30 days old
  const [calibNudge, setCalibNudge] = useState(false);  // in-session nudge after 3 min without calib
  const [calibDrift, setCalibDrift] = useState(null);   // { pts, sessions } when drift detected

  // Show calibration nudge after 3 min of an uncalibrated session
  useEffect(()=>{
    if(!camActive || calibData){ setCalibNudge(false); return; }
    const t = setTimeout(()=>setCalibNudge(true), 3*60*1000);
    return ()=>clearTimeout(t);
  },[camActive, calibData]);

  // Calibration drift detection — suggest recalibration when posture improves ≥12pts
  //
  // This referenced a bare `sessions` identifier that doesn't exist anywhere
  // in this component's scope — the actual state variable (declared at line
  // 491) is `userSessions`. Because this effect runs unconditionally near
  // the top of App() (not gated to any one page), the resulting
  // `ReferenceError: sessions is not defined` crashed the ENTIRE app on
  // load, not just the Live page — confirmed live via the deployed site's
  // error boundary ("Something went wrong / sessions is not defined",
  // pointing into the production App-*.js bundle).
  useEffect(()=>{
    if(!calibData?.calibrated_at || !userSessions?.length) return;
    const calibTs = new Date(calibData.calibrated_at).getTime();
    const postCalib = userSessions
      .filter(s => s.created_at && new Date(s.created_at).getTime() > calibTs)
      .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    if(postCalib.length < 10) return;
    const recentAvg = Math.round(postCalib.slice(0,10).reduce((a,s)=>a+(s.avg_score||0),0)/10);
    const baseline  = calibData.baseline_avg_score;
    if(!baseline || baseline <= 0) return;
    const improvement = recentAvg - baseline;
    setCalibDrift(improvement >= 12 ? { pts: improvement, sessions: postCalib.length } : null);
  },[userSessions, calibData]);
  // Show calibration nudge after 3 min of an uncalibrated session
  useEffect(()=>{
    if(!camActive || calibData){ setCalibNudge(false); return; }
    const t = setTimeout(()=>setCalibNudge(true), 3*60*1000);
    return ()=>clearTimeout(t);
  },[camActive, calibData]);
  useEffect(()=>{
    if(savedCalib && !calibData){
      setCalibData(savedCalib);
      // Warn if calibration is older than 30 days — setup changes over time
      // (new chair, desk rearrangement, posture improvement) can make old
      // baselines misleading. 30 days is a reasonable recalibration cadence.
      if(savedCalib.calibrated_at){
        const ageMs = Date.now() - new Date(savedCalib.calibrated_at).getTime();
        setCalibStale(ageMs > 30 * 24 * 60 * 60 * 1000);
      }
    }
  }, [savedCalib]);

  // Score smoothing
  const { smoothed: smoothedScore, push: pushScore, reset: resetScore } = useScoreSmoothing(10000, 6000);

  // Break timer
  const { showBreak, dismiss: dismissBreak, snooze: snoozeBreak } =
    useBreakTimer(breakIntervalMin, breakReminder && camActive && !isPaused);

  // Sound feedback
  const[muted,setMuted]=useState(false);
  // useSoundFeedback's beep fires whenever the live score drops below 60 —
  // that's a posture-alert sound in every meaningful sense, so it belongs
  // under the "Posture alerts" toggle (`sound`, below) like the other
  // cause-based alert beeps (playBeep() calls elsewhere in this file). It
  // used to be gated by `muted` instead — a state whose only UI control is
  // the "Break-reminder chime" toggle further down (scoped to
  // breakReminder&&!showBreak, and even fully hidden from the settings
  // panel whenever the user has break reminders turned off entirely) — so
  // turning "Posture alerts" off did nothing to this beep, and there was no
  // way to silence it at all once break reminders were disabled. `muted`
  // itself is left as-is: it still correctly gates BreakPage's own sounds
  // and the break-reminder chime (see the showBreak effect above).
  // `alertIfNeeded` was the score<60 beep removed from the frame loop
  // below; the hook is still used for playSuccessChime elsewhere.
  useSoundFeedback(!sound);
  const { update: updatePainPrediction, reset: resetPainPrediction } = usePainPrediction();

  // Pro-tier Custom Alert Rules — sync local copy once profile loads/changes
  useEffect(()=>{ if(profile?.custom_alert_rules) setCustomAlertRules(profile.custom_alert_rules); },[profile?.custom_alert_rules]);
  const { checkRules: checkCustomAlertRules } = useCustomAlertRuleEngine(customAlertRules, {
    onTrigger: (rule, val) => {
      const mCfg = ALERT_METRICS.find(m=>m.id===rule.metric);
      const label = mCfg ? (isAr?mCfg.label_ar:mCfg.label) : rule.metric;
      const msg = isAr
        ? `⚠️ ${label} تعدّى ${rule.thresholdDeg}° لأكتر من ${Math.round(rule.durationSec/60)} دقيقة`
        : `⚠️ ${label} exceeded ${rule.thresholdDeg}° for over ${Math.round(rule.durationSec/60)} min`;
      addToast(msg,"warn");
      // Was {force:true}, which bypassed the Elite entitlement as well as the
      // cooldown — a Pro user with a voice rule got spoken alerts they had not
      // paid for. A custom rule is a legitimate reason to skip the 25s rate
      // limit (the user asked for this specific alert), not to skip the gate.
      if(rule.voice) speakCoach(msg, isAr?"ar":"en", {force:true});
    },
  });

  const[showCoach,setShowCoach]=useState(false);
  const[showGamification,setShowGamification]=useState(false);
  // AI Intelligence Layer
  const[showAIInsights,setShowAIInsights]=useState(false);
  const[showSymptomCorrelation,setShowSymptomCorrelation]=useState(false);
  const[showPredictiveAI,setShowPredictiveAI]=useState(false);
  const[showAIReports,setShowAIReports]=useState(false);
  const[showWorkforceAnalytics,setShowWorkforceAnalytics]=useState(false);
  const[showEnterpriseRBAC,setShowEnterpriseRBAC]=useState(false);
  const[showNotificationsHub,setShowNotificationsHub]=useState(false);
  const[showNPS,setShowNPS]=useState(false);
  const[showAnnualUpsell,setShowAnnualUpsell]=useState(false);
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
  const[authToken,setAuthToken]=useState(null);
  // Fetch the Firebase ID token once a user is on the home page (needed for
  // AnnouncementsBar, which every user sees) or when the admin-only
  // Onboarding Analytics panel is opened — avoids an unnecessary token
  // refresh on every render for users who never reach either.
  useEffect(()=>{
    if((page==="home"||showOnboardingAnalytics)&&user&&!authToken){
      import("./services/api.js").then(({getAuthToken})=>getAuthToken().then(setAuthToken));
    }
  },[page,showOnboardingAnalytics,user,authToken]);
  const[showLegalCompliance,setShowLegalCompliance]=useState(false);

  // ── Core derived constants (moved up: must be declared before any JSX
  // that references them — healthConsentModalEl below uses cs/isAr/dir
  // and would throw a TDZ ReferenceError if these were defined later). ──
  const cs=darkMode?DARK:LIGHT;
  const t=TR[lang];
  const isAr=lang==="ar";
  const dir=isAr?"rtl":"ltr";

  // Sound + desktop notification when the REAL, user-configured break timer
  // fires (showBreak, from useBreakTimer(breakIntervalMin, breakReminder)
  // above). This replaces a duplicate, hardcoded-25-minute break-alert
  // system that used to live inline in the two session-loop setInterval
  // callbacks (initial start + pause/resume) — it fired playPostureAlert()/
  // sendDesktopNotif() at a fixed 1500s regardless of the user's actual
  // breakIntervalMin setting (15/25/45/60/90min), running in parallel with
  // this correctly-configured hook and its own visible break-reminder UI
  // (the "{isAr?...}" card below, `showBreak&&(...)`). Its `showBreakAlert`
  // latch was set but never read in JSX and never reset, and `breakTimerSec`
  // itself was never read anywhere — both fully dead state kept alive only
  // to gate this wrongly-scheduled duplicate. Firing only on the false->true
  // transition (not on every muted/breakIntervalMin/isAr change) is
  // intentional, so the deps list is deliberately narrowed to showBreak.
  useEffect(()=>{
    if(!showBreak) return;
    if(!muted) playPostureAlert();
    // Respect the notification toggle, and pass a score of 100 rather than 0 —
    // a break reminder is not a posture failure, and 0 rendered it with the
    // red "your posture is critical" dot.
    if(desktopNotifs) sendDesktopNotif(
      isAr?`وقت الاستراحة! مرّت ${breakIntervalMin} دقيقة — خذ استراحة دقيقتين`
          :`Break time! ${breakIntervalMin} min passed — take a 2-min stretch`,
      100, { lang: isAr?"ar":"en" }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[showBreak]);

  // Health consent gate — must be accepted once before the first analysis.
  // Corvus is a wellness/awareness tool, NOT a medical device; explicit
  // informed consent protects the user and limits liability.
  const[showHealthConsent,setShowHealthConsent]=useState(false);
  // Consent is now a per-ACCOUNT record, not a localStorage flag.
  //
  // It used to key off localStorage("corvus_health_consent_v1"), which made
  // it per-browser: the same person was re-prompted on a second device with
  // no link to the earlier acknowledgement, clearing site data silently
  // reset it, and — the part that matters for an ethics review — the only
  // thing stored server-side was a bare timestamp with no version and no
  // scope. Asked to produce a participant's consent record, we had nothing.
  //
  // The ref still starts from localStorage so a returning user on the same
  // browser isn't blocked while the profile loads; the effect below is what
  // decides, and it re-prompts whenever the stored record is missing or
  // predates the current CAMERA_VERSION.
  const healthConsentRef=useRef((()=>{try{return localStorage.getItem("corvus_health_consent_v1")==="1";}catch{return false;}})());
  useEffect(()=>{
    if(!user?.uid) return;
    let cancelled=false;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,...consentDocPath(user.uid)));
        const rec=snap.exists()?snap.data():null;
        const ok=hasCurrentConsent(rec,"camera",CAMERA_VERSION);
        if(!cancelled){
          healthConsentRef.current=ok;
          try{ ok?localStorage.setItem("corvus_health_consent_v1","1")
                :localStorage.removeItem("corvus_health_consent_v1"); }catch{}
        }
      }catch{
        // Read failed (offline, rules). Leave the local value alone rather
        // than locking a consenting user out of their own camera.
      }
    })();
    return()=>{cancelled=true;};
  },[user?.uid]);

  async function acceptHealthConsent(){
    healthConsentRef.current=true;
    try{localStorage.setItem("corvus_health_consent_v1","1");}catch{}
    setShowHealthConsent(false);
    if(user?.uid){
      // setDoc with merge so granting camera consent never clobbers a terms
      // record written elsewhere.
      setDoc(doc(db,...consentDocPath(user.uid)),{
        uid: user.uid,
        camera: makeConsentGrant(CAMERA_VERSION),
        updated_at: new Date().toISOString(),
      },{merge:true}).catch(e=>console.warn("consent record write failed",e?.code));
      updateDoc(doc(db,"users",user.uid),{healthDisclaimerAcceptedAt:new Date().toISOString()}).catch(()=>{});
    }
    startCamera();
  }

  /** Withdraw camera consent. The invite page has always told users they
      "can revoke consent at any time from your account settings" — there was
      no such control anywhere, and the backend revoke endpoint had no
      caller. */
  async function revokeCameraConsent(){
    healthConsentRef.current=false;
    try{localStorage.removeItem("corvus_health_consent_v1");}catch{}
    if(user?.uid){
      try{
        await setDoc(doc(db,...consentDocPath(user.uid)),{
          uid: user.uid,
          camera: { granted:false, version:CAMERA_VERSION, revoked_at:new Date().toISOString() },
          updated_at: new Date().toISOString(),
        },{merge:true});
        addToast(isAr?"تم سحب الموافقة على استخدام الكاميرا":"Camera consent withdrawn","success");
      }catch(e){
        addToast(isAr?"تعذّر حفظ سحب الموافقة — حاول تاني":"Couldn't save the withdrawal — please try again","error");
        console.warn("consent revoke failed",e?.code);
      }
    }
  }
  // Rendered from BOTH the page==="home" block and the page==="live" block —
  // startCamera() (called from the live page) is what sets showHealthConsent
  // to true, but the home block's early `return` meant the modal only ever
  // painted while page==="home". A first-time user clicking "Start Analysis"
  // from the live page got a completely silent no-op: state flipped, nothing
  // rendered, button looked dead. Defining it once here and mounting it in
  // both branches fixes that regardless of which page triggered it.
  const healthConsentModalEl = showHealthConsent&&(
    <div dir={dir} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10000,padding:20}}>
      <div style={{background:cs.card,border:`0.5px solid ${cs.border}`,borderRadius:20,maxWidth:460,width:"100%",padding:0,overflow:"hidden",boxShadow:"0 24px 60px rgba(0,0,0,.4)"}}>
        <div style={{background:"linear-gradient(135deg,#3b82f6,#2563eb)",padding:"22px 26px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:26,lineHeight:1}}>🩺</div>
          <div>
            <div style={{color:"#fff",fontSize:16,fontWeight:800,letterSpacing:.2}}>{isAr?"قبل ما نبدأ التحليل":"Before we start"}</div>
            <div style={{color:"rgba(255,255,255,.85)",fontSize:11.5,marginTop:2}}>{isAr?"إقرار سريع لمرة واحدة":"A one-time acknowledgement"}</div>
          </div>
        </div>
        <div style={{padding:"22px 26px"}}>
          <p style={{color:cs.text,fontSize:13.5,lineHeight:1.7,margin:"0 0 14px"}}>
            {isAr
              ? "Corvus أداة توعية بوضعية الجسم للاستخدام العام — وليست جهازاً طبياً ولا بديلاً عن استشارة أخصائي. القياسات والتقارير تقريبية والغرض منها التوعية فقط."
              : "Corvus is a general wellness tool for posture awareness — not a medical device and not a substitute for professional advice. Measurements and reports are approximate and for informational purposes only."}
          </p>
          {/* This modal used to be a medical disclaimer with one passing
              mention of on-device processing. For a webcam product that is
              the wrong shape: the thing the user is actually being asked to
              permit is camera processing of images of their body, and a
              reviewer expects that stated separately, specifically, and with
              what is kept and who can see it. */}
          <ul style={{color:cs.muted,fontSize:12.5,lineHeight:1.6,margin:"0 0 12px",paddingInlineStart:18}}>
            <li>{isAr?"لو عندك ألم أو حالة طبية، استشر طبيباً أو أخصائي علاج طبيعي.":"If you have pain or a medical condition, consult a doctor or physiotherapist."}</li>
            <li>{isAr?"لا تعتمد على النتائج في اتخاذ قرارات طبية.":"Do not rely on results for medical decisions."}</li>
          </ul>
          <div style={{
            background:"rgba(59,130,246,.07)",border:"1px solid rgba(59,130,246,.22)",
            borderRadius:12,padding:"13px 15px",marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:800,color:cs.text,marginBottom:7}}>
              📷 {isAr?"الموافقة على استخدام الكاميرا":"Camera consent"}
            </div>
            <ul style={{color:cs.muted,fontSize:12,lineHeight:1.65,margin:0,paddingInlineStart:17}}>
              <li>{isAr?"الكاميرا هتشتغل عشان تحلّل وضعية جسمك أثناء الجلسة.":"Your camera is used to analyse your posture during a session."}</li>
              <li>{isAr?"التحليل بيتم على جهازك. مفيش صور ولا فيديو بيترفع أو يتخزن.":"Analysis runs on your device. No image or video is uploaded or stored."}</li>
              <li>{isAr?"اللي بيتحفظ هو أرقام بس: درجة الوضعية وقياسات الزوايا.":"What is saved is numbers only: your posture score and angle measurements."}</li>
              <li>{isAr?"تقدر تسحب الموافقة في أي وقت من الإعدادات.":"You can withdraw this consent at any time in Settings."}</li>
            </ul>
          </div>
          <div style={{display:"flex",gap:10,flexDirection:isAr?"row-reverse":"row"}}>
            <button onClick={acceptHealthConsent} style={{flex:1,background:"linear-gradient(135deg,#3b82f6,#2563eb)",border:"none",borderRadius:11,padding:"13px 18px",fontSize:13.5,fontWeight:700,color:"#fff",cursor:"pointer"}}>
              {isAr?"أوافق على الاتنين وابدأ":"I agree to both — start"}
            </button>
            <button onClick={()=>{setShowHealthConsent(false); if(page==="live") setPage("home");}} style={{background:"none",border:`0.5px solid ${cs.border}`,borderRadius:11,padding:"13px 18px",fontSize:13,color:cs.muted,cursor:"pointer"}}>
              {isAr?"إلغاء":"Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  const[showAccountActivity,setShowAccountActivity]=useState(false);
  // Live-page settings panel (posture alerts, voice coach, overlays, PDF,
  // calibrate, break chime) — collapsed by default. Elite users have every
  // one of these unlocked with nothing to compact away via tier-gating, so
  // without a collapse they're looking at 7 full rows the instant they open
  // the page, whether they came here to change a setting or just start a
  // session.
  const[showLiveSettings,setShowLiveSettings]=useState(false);
  const[isSavingSession,setIsSavingSession]=useState(false);
  const[hoverBarIdx,setHoverBarIdx]=useState(null);
  const[showAllMetrics,setShowAllMetrics]=useState(false);
  const[showBillingDashboard,setShowBillingDashboard]=useState(false);
  const[showReferralProgram,setShowReferralProgram]=useState(false);
  const[showIntegrationsHub,setShowIntegrationsHub]=useState(false);
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
        userType: onboardProfile?.userType || onboardProfile?.acct_type || "individual",
        acct_type: onboardProfile?.acct_type || "individual",
        user_type: onboardProfile?.acct_type === "company" ? "hr_admin" : "individual",
        is_org_owner: onboardProfile?.acct_type === "company" ? true : false,
        company: onboardProfile?.company || "",
        industry: onboardProfile?.industry || "",
        jobTitle: onboardProfile?.jobTitle || "",
        goals: onboardProfile?.goals || [],
        onboarding_done: ["completed"],
        onboarding_completed_at: new Date().toISOString(),
        setup_complete: true,
        updated_at: serverTimestamp(),
      }).then(()=>{
        setProfile(p=>p?({
          ...p,
          onboarding_done:["completed"],
          setup_complete:true,
          acct_type: onboardProfile?.acct_type || "individual",
          user_type: onboardProfile?.acct_type === "company" ? "hr_admin" : "individual",
          is_org_owner: onboardProfile?.acct_type === "company",
          company: onboardProfile?.company || p?.company || "",
        }):p);
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
  useEffect(()=>{ handleSSORedirect().catch(e=>console.error("[SSO]",e.message)); },[]);
  // Handle payment redirect from Kashier/Stripe
  const [paymentResult, setPaymentResult] = useState(null); // null | "success" | "cancelled"
  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const res=p.get("payment");
    if(res==="success"||res==="cancelled"){
      setPaymentResult(res);
      window.history.replaceState({},"","/");
      // Refresh profile so tier is current
      if(res==="success"&&user) getUserProfile(user.uid).then(setProfile).catch(e=>console.warn("[Profile]",e.message));
    }
    if(p.get("payment")==="success"){
      toast(isAr?"✅ تم تفعيل خطتك!":"✅ Your plan is now active!","success");
      // Refresh profile — backend webhook may have updated tier already
      if(user?.uid){
        setTimeout(()=>{
          getUserProfile(user.uid).then(p=>{
            if(p){ setProfile(p); if(p.tier) setTier(normalizeTier(p.tier)); }
          }).catch(()=>{});
        }, 2000); // wait 2s for webhook to process
      }
    }
    if(p.get("payment")==="cancelled"){ toast(isAr?"تم إلغاء الدفع — لم يتم خصم أي مبلغ":"Payment cancelled — no charge made","info"); }
  },[]);

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

  const vidRef=useRef();const ovRef=useRef();const canvRef=useRef();const camWrapRef=useRef();
  const[isFs,setIsFs]=useState(false);
  useEffect(()=>{
    const onFs=()=>setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange",onFs);
    return ()=>document.removeEventListener("fullscreenchange",onFs);
  },[]);
  const toggleFullscreen=()=>{
    const el=camWrapRef.current; if(!el) return;
    if(document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(()=>{});
  };
  const streamRef=useRef();const timerRef=useRef();const rafRef=useRef();
  const mpRef=useRef();const badRef=useRef(null);const lastAlRef=useRef(0);
  const lmSmootherRef   = useRef(null);
  const frameBufferRef  = useRef(null); // 60-frame aggregation buffer
  const distSmootherRef = useRef(null); // sliding-median distance smoother
  const lastAnalysisTsRef = useRef(0);  // throttles the analysis loop — see runLoop
  const lastUiPushRef     = useRef(0);  // throttles the React re-render — see runLoop
  // Fallback-mode health tracking — when local MediaPipe failed to load,
  // /api/analyze IS the only source of scores. If it silently keeps
  // failing (backend down, network), the camera looks "frozen" with zero
  // feedback. Tracks consecutive failures so we can surface a real error
  // after a short grace period instead of retrying forever in silence.
  const backendFailRef  = useRef(0);
  const backendFailShownRef = useRef(false);
  // When posture recovered, nothing ever took the warning back down.
  //
  // The alert box is driven by alertMsg.type: the analysis loop sets it to
  // "warn" when a fault has persisted for 15s, and the good-posture branch
  // then only updated scoreStatus — it never touched alertMsg. But the score
  // readout is rendered by `scoreStatus && alertMsg.type!=="warn"`, so once a
  // warning fired, the score row stayed hidden and the warning stayed on
  // screen for the rest of the session no matter what the user did. That is
  // the "Drop your shoulders" still showing at 79/Excellent with the shoulder
  // metric reading Low: the score had recovered, the sentence had not.
  //
  // Cleared only after the posture has been good for a sustained stretch, so
  // a single lucky frame in the middle of a genuine slump does not blink the
  // warning away and back.
  // The correction cue had no persistence requirement at all.
  //
  // postureCue() re-derives from `analysis` on every render and surfaces
  // whichever metric is worst AT THAT INSTANT, with no minimum duration and no
  // clearing delay — while the alert box beside it demands 15 seconds of
  // sustained bad posture plus a per-cause cooldown before it says anything.
  // Two systems, opposite standards, and the cue is the one that owns the
  // biggest red element on the screen.
  //
  // That is how a single noisy frame put "Drop your shoulders" over a user who
  // was sitting straight. The metric itself is not the problem: on the rig,
  // shoulder elevation on a subject who never shrugs stays under 2.4% even at
  // 6px of landmark noise, against the 6.1% that fires the red cue. But real
  // ear landmarks on a real head — hair over the ears, a hand near the face,
  // the head tilted — jump in a way no synthetic subject reproduces, and one
  // such frame was enough. Raising the threshold would blind the metric to
  // genuine shrugging; requiring the fault to persist does not.
  //
  // ~2s to appear and ~2s to clear, counted in UI pushes (4Hz, see
  // lastUiPushRef). Asymmetric on purpose: a cue that flickers off while you
  // are still doing the thing is as useless as one that flickers on.
  const cueStateRef = useRef({ key:null, on:0, off:0, shown:null, seen:null });
  const CUE_ON_PUSHES = 8, CUE_OFF_PUSHES = 8;
  // Counts ANALYSIS pushes, not renders. This runs during render, and the live
  // page re-renders for reasons that have nothing to do with the camera — the
  // one-second session clock, a hover, a settings toggle — so counting renders
  // would let a cue age without a single new measurement behind it. Keyed on
  // the analysis object's identity, which changes only when the loop pushes a
  // new reading (and which makes a StrictMode double-render a no-op).
  const stabilizeCue = useCallback((cue, analysisObj)=>{
    const st = cueStateRef.current;
    if (st.seen === analysisObj) return st.shown;
    st.seen = analysisObj;
    const key = cue?.text ?? null;
    if (key && key === st.key) { st.on++; st.off = 0; }
    else if (key)              { st.key = key; st.on = 1; st.off = 0; }
    else                       { st.off++; }
    if (key && st.on >= CUE_ON_PUSHES) st.shown = cue;
    if (!key && st.off >= CUE_OFF_PUSHES) { st.shown = null; st.key = null; }
    // A different fault taking over replaces the old one only once it has
    // earned its own hold, so the two cannot alternate frame to frame.
    if (key && st.shown && st.shown.text !== key && st.on < CUE_ON_PUSHES) return st.shown;
    return st.shown;
  },[]);
  // Consecutive frames on which face blur was requested and could not be
  // applied. See the call site in runLoop.
  const blurMissRef = useRef(0);
  const goodSinceRef = useRef(0);
  const ALERT_CLEAR_MS = 4000;
  const clearStaleAlert = useCallback((now)=>{
    if(!goodSinceRef.current){ goodSinceRef.current = now; return; }
    if(now - goodSinceRef.current < ALERT_CLEAR_MS) return;
    setAlertMsg(m => (m?.type==="warn"||m?.type==="bad") ? {text:"",type:"info"} : m);
  },[]);
  const startingCameraRef = useRef(false); // sync guard — see startCamera()
  const stoppingRef = useRef(false); // sync guard — see stopCamera()
  // Wall-clock pacing for the backend /analyze call, replacing a frame-counter
  // gate that could either freeze analysis permanently or flood the network —
  // see the comment at the call site in runLoop().
  const lastBackendMsRef = useRef(0);
  const backendInFlightRef = useRef(false);
  const lightCheckRef=useRef({t:0,canvas:null,wasLow:false});
  const lightAlRef=useRef(0); // separate cooldown for lighting alerts (60s, not 8s)
  // Streak counter for the subject-switch guard below (a different/second
  // person's centroid jump silently drops frames — previously with zero
  // user feedback, so the display just looked frozen while it happened).
  // Same debounce reasoning as RELIABILITY_HYSTERESIS_FRAMES in
  // postureEngine.js: a couple of single-frame rejects shouldn't flash a
  // banner, only a sustained run of them.
  const subjectRejectStreakRef=useRef(0);
  const multiPersonShownRef=useRef(false); // avoids reading multiPersonWarning state inside runLoop's closure
  const insightsRef=useRef(null);
  // alertCauseRef: { [causeKey]: { last: timestamp, count: number } }
  // count drives exponential backoff: 1st repeat → 5min, 2nd → 10min, 3rd+ → 20min
  const alertCauseRef=useRef({});
  const histRef=useRef([]);const goodRef=useRef(0);const totalRef=useRef(0);
  // histRef is the 40-entry SPARKLINE buffer (it feeds the 40-bar chart, so it
  // is capped at 40). It was also being used as the session record — but
  // analysis runs at ~20fps, so 40 samples is about TWO SECONDS. Every saved
  // avg_score, trend and score_history therefore described only the last ~2s of
  // the session: a 45-minute session was graded on its final two seconds, and
  // the chart tooltip's "score at MM:SS" spread the whole session clock across
  // those 2 seconds. fullHistRef keeps the actual session, sampled ~every 2s so
  // an hour costs ~1800 numbers.
  const fullHistRef=useRef([]); const fullHistLastMsRef=useRef(0);
  const pushSessionScore=useCallback((v)=>{
    if(!Number.isFinite(v)) return;
    const now=Date.now();
    if(now-fullHistLastMsRef.current < 2000) return;
    fullHistLastMsRef.current=now;
    fullHistRef.current.push(v);
    // Hard ceiling for a very long session: halve by keeping every 2nd sample,
    // which preserves the shape while bounding memory.
    if(fullHistRef.current.length>2400) fullHistRef.current=fullHistRef.current.filter((_,i)=>i%2===0);
  },[]);
  const acRef=useRef({total:0,neck:0,dist:0});const alRef=useRef([]);
  const sessRef=useRef(null);const lastAnalRef=useRef(null);
  // Elite: worst-posture snapshots captured during the session (max 3, small JPEGs)

  // ── Effective tier — single source of truth ──────────────────
  // Rules:
  //   1. tier state (set after billing) takes priority if set
  //   2. is_trial users experience trial_tier (e.g. professional) not their stored tier (standard)
  //   3. Fallback to profile.tier then "standard"
  // This means feature gating throughout the app should use `effectiveTier`
  // instead of the raw `tier` state (which starts null on load).
  const effectiveTier = (() => {
    if (tier && tier !== "standard") return normalizeTier(tier);
    if (profile?.is_trial && profile?.trial_tier) return normalizeTier(profile.trial_tier);
    return normalizeTier(tier || profile?.tier || "standard");
  })();
  const T_=TIERS[effectiveTier]||TIERS["standard"];

  // Voice coach is Elite-only — sync the lib's enabled flag with both the
  // user preference and the (possibly late-loading) tier
  useEffect(()=>{
    setVoiceCoachEnabled(voiceCoach && tierAtLeast(effectiveTier,"elite"));
    // Unmount teardown: without this a cue queued as the user navigates away
    // keeps speaking over whatever page they landed on, with no visible source
    // and no way to stop it short of a reload.
    return ()=>{ try{ stopSpeaking(); }catch{} };
  },[voiceCoach,effectiveTier]);

  // Keep the notification-permission chip honest: the user can grant or block
  // it from the browser's own UI at any time, and a cached value would keep
  // telling them notifications are on while the OS silently drops every one.
  useEffect(()=>{
    const sync=()=>setNotifPerm(notificationState());
    sync();
    document.addEventListener("visibilitychange",sync);
    let unsub=null;
    try{
      navigator.permissions?.query?.({name:"notifications"}).then(st=>{
        st.onchange=sync; unsub=()=>{ st.onchange=null; };
      }).catch(()=>{});
    }catch{}
    return ()=>{ document.removeEventListener("visibilitychange",sync); unsub?.(); };
  },[]);
  // Normalize T_ so live dashboard always has .name and .color
  const T_norm=T_?{name:T_.name,color:T_.color,colorDim:T_.colorDim||`${T_.color}18`}:null;
  const [isMobile, setIsMobile] = React.useState(()=> typeof window !== "undefined" && window.innerWidth < 768);
  React.useEffect(()=>{ const fn=()=>setIsMobile(window.innerWidth<768); window.addEventListener("resize",fn); return ()=>window.removeEventListener("resize",fn); },[]);
  const MC={
    laptop:{id:"laptop",label:isAr?"لابتوب":"Laptop",icon:"💻",color:"#6366f1",optDist:[50,80]},
  };
  const M_=mode?MC[mode]:null;

  // addToast / toast alias declared above (L1458)

  // URL deep link
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const plan=params.get("plan"),bill=params.get("billing")||"monthly";
    // Was `TIERS[plan]` only — TIERS holds just the B2C ids (standard/basic/
    // professional/elite), so a marketing link deep-linking a B2B plan
    // (?plan=b2b_starter etc.) silently failed this check and deepPlan never
    // got set, even though B2B_TIERS[plan] is valid. See the matching fix
    // at the onAuthStateChanged routing check below.
    if(plan&&(TIERS[plan]||B2B_TIERS[plan])){setDeepPlan(plan);setDeepBilling(bill);}
    const ref=params.get("ref");
    if(ref) window.__referral_code=ref;
    // Handle invite token in URL: ?invite=TOKEN
    const inviteToken = params.get("invite");
    if(inviteToken) {
      window.__invite_token = inviteToken;
      try{ sessionStorage.setItem("pending_invite", inviteToken); }catch{}
      setPage("invite");
      // Clean the URL immediately — sessionStorage (above) is the resume
      // mechanism if the page reloads mid-flow, so the token never needs
      // to live in the URL itself, where it would otherwise resurface on
      // ANY later, unrelated page reload (manual refresh, SW update, the
      // stale-chunk auto-reload, etc.) and replay this whole flow again.
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
    // Handle pending invite after login
    const pendingInvite = sessionStorage.getItem("pending_invite");
    if(pendingInvite) window.__invite_token = pendingInvite;
  },[]);

  // Auth state listener
  // Track if auth came from OAuth redirect — prevents timeout from firing
  const _oauthRedirect = useRef(false);
  // Was referenced in 6 places (safety-net timeout, popstate-adjacent auth
  // flow, and the pre-auth render guard) but never actually declared
  // anywhere — a leftover from the loading-screen fix that turned "stuck
  // loading" into "crashes on load for everyone" the moment it shipped,
  // since every one of those reads threw ReferenceError on first render.
  const _oauthInProgress = useRef(false);
  // Which uid we've already run the forced setPage("home"/"setup"/"invite")
  // routing for — onAuthStateChanged can legitimately refire for the SAME
  // signed-in user (token refresh, tab visibility changes), and that must
  // NOT re-trigger navigation away from wherever the user currently is.
  const routedUidRef = useRef(null);

  useEffect(()=>{
    // Handle Google/Microsoft OAuth redirect result
    getGoogleRedirectResult().then(async result => {
      if (result?.user) {
        _oauthRedirect.current = true;
        _oauthInProgress.current = false;
        try { sessionStorage.removeItem("__pendingOAuth"); sessionStorage.removeItem("__pendingOAuthTs"); } catch {}
        const u = result.user;
        let p = null;
        try { p = await getUserProfile(u.uid); } catch{}
        const isNew = !p;
        if (!p) {
          try {
            await createUserProfile(u.uid, { email: u.email, name: u.displayName||"", company:"", setup_complete: false });
            p = await getUserProfile(u.uid);
          } catch{}
        }
        setUser(u);
        if(p) {
          setProfile(p);
          if(p.tier) setTier(normalizeTier(p.tier));
          if(p.company_id) setCompanyId(p.company_id);
        }
        getUserSessions(u.uid).then(setUserSessions)
          .catch(e=>console.warn("[Sessions]",e.message))
          .finally(()=>setSessionsLoading(false));
        // Pending-session retry used to live here too — moved to the main
        // onAuthStateChanged success path below, which fires for every
        // login method (this redirect flow included, once Firebase's own
        // listener picks up the session set above) instead of only this
        // one narrow path. Keeping it in both places would race two
        // concurrent read-modify-writes of the same localStorage queue.
        setAuthChecked(true);
        if (isNew) setPage("setup");
        else setPage("home");
        if (window.location.search)
          window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      }
    }).catch(()=>{});

    const authTimeout=setTimeout(()=>{
      // Don't redirect to landing if we know we're processing an OAuth redirect
      if (_oauthRedirect.current || _oauthInProgress.current) return;
      setAuthChecked(c=>{ if(!c){ goLandingUnlessDeepLinked(setPage); return true; } return c; });
    }, 8000);

    const unsub=onAuthStateChanged(async u=>{
      clearTimeout(authTimeout);
      // Stale "#live" from a previous tab/reload must never be allowed to
      // render the live page while auth/profile are still loading — see
      // commit message for the exact flash-of-live-page bug this caused.
      // Must happen HERE, synchronously, before any of the awaits below —
      // moving it to the bottom of this handler (where it used to live)
      // left a real window where user+profile were already set but page
      // hadn't been redirected yet, during which the live page's guard
      // passed and the full live UI (camera request included) rendered.
      if (u && window.location.hash === "#live" && !camActiveRef.current && !streamRef.current) {
        window.history.replaceState({}, "", "#home");
        setPageRaw("home");
      }
      // onAuthStateChanged is the SINGLE source of truth for routing
      // Clear OAuth pending flag — we now have definitive auth state
      try { if(u) { sessionStorage.removeItem("__pendingOAuth"); sessionStorage.removeItem("__pendingOAuthTs"); } } catch{}
      // NOTE: Elite tier elevation is handled SERVER-SIDE only in
      // backend/auth/middleware.py (ELITE_DOMAINS + ELITE_EMAILS).
      // Do NOT add email lists here — client JS is visible in DevTools.
      try {
        setUser(u);
        if(u){
          // Load profile — never crash
          let p = null;
          try { p = await getUserProfile(u.uid); } catch(e){ console.warn("[Auth] profile:",e?.code); }

          // Real login tracking — feeds ChurnPrediction's health score
          // (login recency, 25% weight — the single biggest factor). Nothing
          // anywhere wrote this before, so every customer was scored as if
          // they hadn't logged in for 30 days, regardless of actual activity.
          try { updateUserProfile(u.uid, { last_login_at: new Date().toISOString() }); } catch{}
          // #5: persist returning-user flag so next visit skips the full landing page
          try { localStorage.setItem("corvus_was_logged", "1"); } catch {}

          if(!p){
            // Profile might not be written yet (race with AuthPage signup) — wait & retry once
            await new Promise(r=>setTimeout(r,1200));
            try { p = await getUserProfile(u.uid); } catch{}
          }
          if(!p){
            try {
              await createUserProfile(u.uid,{email:u.email,name:u.displayName||"",company:"",setup_complete:false});
              p = await getUserProfile(u.uid);
            } catch(e){ console.warn("[Auth] create:",e?.code); }
            try { EmailAPI.sequence({email:u.email,name:u.displayName||u.email.split("@")[0],
              day:0,tier:"professional",session_count:0,avg_score:0}).catch(()=>{}); } catch{}
          } else {
            try { checkAndDowngradeTrial(u.uid).then(checked=>{ if(checked){ setProfile(checked); if(checked.tier) setTier(normalizeTier(checked.tier)); } }).catch(e=>console.warn("[Trial]",e.message)); } catch{}
            try { checkAndSendNurtureEmails(u.uid, p, API).catch(()=>{}); } catch{}
          }
          // Give require_auth's server-side role check (elite-domain/email
          // auto-elevation, subscription-expiry downgrade) a real
          // touchpoint. Without this call, that logic never actually runs
          // for a normal user: the dashboard loads entirely via direct
          // Firestore reads and never hits any @require_auth backend
          // route, so an eligible email's elite status (or an expired
          // subscription's downgrade) would sit correct on the backend but
          // never make it into what the user's own Firestore document
          // says — which is what the UI actually reads.
          try {
            const token = await u.getIdToken();
            const res = await fetch(`${API}/auth/whoami`, { headers:{ Authorization:`Bearer ${token}` } });
            if (res.ok) {
              const who = await res.json().catch(()=>null);
              if (who?.tier && p && who.tier !== p.tier) {
                const fresh = await getUserProfile(u.uid).catch(()=>null);
                if (fresh) { p = fresh; }
              }
            }
          } catch(e) { console.warn("[Auth] whoami:", e?.message); }

          let mfaPending = false;
          if(p){
            setProfile(p);
            if(p.tier)       setTier(normalizeTier(p.tier));
            if(p.company_id) setCompanyId(p.company_id);
            // MFA login gate — a Firebase sign-in only proves password;
            // if this account has 2FA enabled, hold the app behind a
            // challenge screen until a valid code/backup code is verified.
            // (See mfaChallengePending render gate near the AuthPage
            // return below.) sessionStorage flag lets a page refresh in
            // the same tab skip re-challenging every reload.
            mfaPending = p.mfa_enabled && sessionStorage.getItem(`mfa_verified_${u.uid}`)!=="1";
            setMfaChallengePending(mfaPending);
          }

          // Real-time sessions listener
          // BUG FIX: this used to start unconditionally, so a user's session
          // history (posture/health data) was already pulled into browser
          // memory before they'd verified their MFA second factor — the
          // challenge screen only gated what rendered, not what was fetched.
          // Now it waits until MFA is verified (see the onVerified handler
          // on MFALoginChallenge, which starts it once verification succeeds).
          if(!mfaPending){
          try {
            if(window.__unsubSessions){ window.__unsubSessions(); window.__unsubSessions=null; }
            const unsubSessions = onUserSessions(u.uid, sessions=>{
              setUserSessions(sessions);
              setSessionsLoading(false);
              // Re-trigger preloader when sessions arrive (has real data now)
              if (sessions?.length > 0) {
                setTimeout(() => {
                  preloadAIInsights(u.uid, p, sessions, null, p?.is_trial ? p?.trial_tier : p?.tier, lang);
                }, 1500);
              }
            }, err => {
              // An error resolves the question too: stop claiming to be loading,
              // or the UI spins forever behind a failure it already knows about.
              setSessionsLoading(false);
              console.error("[Auth] sessions listener failed:", err.code, err.message);
              addToast?.(isAr
                ? "تعذر تحميل جلساتك — حاول تحديث الصفحة"
                : "Couldn't load your sessions — try refreshing the page", "error");
            });
            window.__unsubSessions = unsubSessions;
          } catch(e){ console.warn("[Auth] sessions:",e?.code); }
          }

          // Live profile listener — reflects server-side profile/tier changes
          // (e.g. the subscription-expiry downgrade in _get_user_role()) as
          // soon as Firestore updates, instead of only on next full reload.
          if(!mfaPending){
          try {
            if(window.__unsubProfile){ window.__unsubProfile(); window.__unsubProfile=null; }
            window.__unsubProfile = onUserProfile(u.uid, freshProfile=>{
              setProfile(prev => ({ ...prev, ...freshProfile }));
              if(freshProfile.tier) setTier(normalizeTier(freshProfile.tier));
            });
          } catch(e){ console.warn("[Auth] profile listener:",e?.code); }
          }

          // Load team members
          if(!mfaPending){
          try {
            if(p?.company_id||p?.is_org_owner){
              getAllUsers(p.company_id||null,false).then(setAllUsers).catch(e=>console.warn("[HR Users]",e.message));
            }
          } catch{}
          }

          // Phone and Side modes were removed app-wide — only restore "laptop"
          try { const lm=localStorage.getItem("last_mode"); if(lm==="laptop") setMode(lm); } catch{}

          // Navigate — always land on home or setup, never on live (live requires user interaction)
          // ONLY on the first resolution for this uid. onAuthStateChanged
          // legitimately refires during an active session (ID token refresh,
          // and on mobile, tab visibility changes right after things like
          // the getUserMedia() camera-permission prompt) -- every refire
          // used to run this same forced setPage("home"/"setup") again,
          // which is exactly what was yanking users on the LIVE page back
          // to Home mid-session, camera still running, session unsaved.
          if(routedUidRef.current!==u.uid){
            routedUidRef.current=u.uid;
            try {
              const params=new URLSearchParams(window.location.search);
              const pendingInvite=sessionStorage.getItem("pending_invite");
              // Clear #live hash if present — live page should only open via explicit user action
              if(window.location.hash === "#live") window.history.replaceState({},"","#home");
              if(pendingInvite){ window.__invite_token=pendingInvite; setPage("invite"); }
              else if(!p || !p.setup_complete) setPage("setup");
              else {
                const planParam = params.get("plan");
                // Was `TIERS[planParam]` only, so a freshly-signed-up user who
                // deep-linked a B2B plan (?plan=b2b_starter/b2b_growth) got
                // silently routed to "home" instead of "pricing" — TIERS only
                // has the B2C ids. Now checks both maps, matching the
                // deepPlan/deepBilling wiring above and the defaultSeg passed
                // into PricingPage below.
                setPage(planParam && (TIERS[planParam]||B2B_TIERS[planParam]) ? "pricing" : "home");
              }
            } catch{ setPage("home"); }
            // Retry any sessions that failed to save last time (see the
            // saveSession catch in stopCamera). This used to only run inside
            // the OAuth-*redirect*-specific handler above, which meant it
            // never fired for the far more common paths — email/password
            // login, Google/Microsoft *popup* login, or simply reopening the
            // app with an already-persisted session. onAuthStateChanged is
            // the one handler that genuinely fires on every login path
            // (including the redirect one, right after it sets the user), so
            // this is the single correct place for it — gated on
            // routedUidRef so it runs once per real login, not on every
            // token-refresh refire, and on !mfaPending so it doesn't touch
            // session data before the 2FA challenge clears.
            if(!mfaPending) (async()=>{
              try{
                const key="corvus_pending_sessions";
                const queue=JSON.parse(localStorage.getItem(key)||"[]");
                if(!queue.length) return;
                const mine=queue.filter(q=>q.uid===u.uid);
                if(!mine.length) return;
                const others=queue.filter(q=>q.uid!==u.uid);
                const stillFailed=[];
                for(const q of mine){
                  try{ await saveSession(u.uid,q.data); }
                  catch{ if(Date.now()-q.queuedAt < 7*86400000) stillFailed.push(q); } // drop after 7 days
                }
                localStorage.setItem(key, JSON.stringify([...others,...stillFailed]));
                if(mine.length>stillFailed.length){
                  addToast?.(isAr?`✅ اتحفظت ${mine.length-stillFailed.length} جلسة كانت متعلقة`:`✅ Saved ${mine.length-stillFailed.length} previously pending session(s)`,"success");
                  getUserSessions(u.uid).then(setUserSessions).catch(()=>{});
                }
              }catch{}
            })();
          }
          setAuthChecked(true); // always mark checked when user is logged in
          // Pre-generate AI insights in background (3s delay so auth fully settles)
          setTimeout(() => {
            preloadAIInsights(
              u.uid, p, [], null, effectiveTier, lang
            );
          }, 3000);

        } else {
          // u===null: user signed out OR Firebase is still processing OAuth redirect
          // Don't go to landing if we know we're in the middle of an OAuth redirect
          if (_oauthRedirect.current || _oauthInProgress.current) {
            // Still waiting for getGoogleRedirectResult to resolve — do nothing
            return;
          }
          try { if(window.__unsubSessions){ window.__unsubSessions(); window.__unsubSessions=null; } } catch{}
          try { if(window.__unsubProfile){ window.__unsubProfile(); window.__unsubProfile=null; } } catch{}
          routedUidRef.current=null;
          setUser(null);
          setProfile(null);
          setUserSessions([]);
          // Signed out: there is genuinely nothing, and that is now known.
          setSessionsLoading(false);
          setMfaChallengePending(false);
          goLandingUnlessDeepLinked(setPage);
        }
      } catch(e) {
        console.error("[Auth] fatal:", e);
        if (!_oauthRedirect.current && !_oauthInProgress.current) setPage("landing");
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
        const mode = params.get('mode');
        if (plan) setDeepPlan(plan);
        if (mode === 'signup') setAuthMode('signup');
        else setAuthMode('login');
        setPage('auth');
      } else if (path === '/app' || path === '/dashboard') {
        setPage('home');
      } else if (path === '/billing') {
        setPage('pricing');
      }
    };
    window.__spaNavigate = (path) => { window.__spaNavigateHandled = true; handler({ detail: { path } }); };
    window.addEventListener('spa:navigate', handler);
    return () => window.removeEventListener('spa:navigate', handler);
  }, []);

  // Cleanup on unmount — stop camera, cancel animation loop, release stream
  useEffect(() => {
    return () => {
      if(rafRef.current){ cancelAnimationFrame(rafRef.current); rafRef.current=null; }
      if(streamRef.current){ streamRef.current.getTracks().forEach(t=>{t.stop();t.enabled=false;}); streamRef.current=null; }
      if(vidRef.current && vidRef.current.srcObject){ vidRef.current.srcObject=null; }
      if(timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // MediaPipe loader — self-hosted first, CDN only as a fallback.
  //
  // This used to import the bundle from cdn.jsdelivr.net and pull the model
  // from storage.googleapis.com. A network that filters either host — which
  // is normal on university and corporate wifi — sent the app into
  // backend-analysis mode, where /api/analyze is a stub returning
  // `overall: null` with a 200, so the score froze silently and the
  // "can't reach the analysis server" overlay never fired either.
  //
  // The assets are now staged into public/mediapipe by
  // scripts/fetch-mediapipe.mjs at build time (they are ~28MB, so they are
  // gitignored rather than committed). The CDN is kept as a second attempt
  // for the case where that staging step was skipped or failed.
  useEffect(()=>{
    if(mpRef.current||window.__mpLoading)return;
    window.__mpLoading=true;
    const CDN_BASE="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
    const SOURCES=[
      { name:"self-hosted",
        bundle:"/mediapipe/vision_bundle.mjs",
        wasm:"/mediapipe/wasm",
        model:"/mediapipe/pose_landmarker_full.task" },
      { name:"cdn",
        bundle:`${CDN_BASE}/vision_bundle.mjs`,
        wasm:`${CDN_BASE}/wasm`,
        model:"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task" },
    ];
    const load=async()=>{
      let lastErr=null;
      for(const src of SOURCES){
      try{
        const mod=await import(/* @vite-ignore */ src.bundle);
        const fr=await mod.FilesetResolver.forVisionTasks(src.wasm);
        // "full" model: meaningfully more accurate landmarks than "lite",
        // especially for subtle angles (neck lean, spine lean). GPU
        // delegate is what makes this affordable in real time — CPU alone
        // is why "lite" was chosen originally. Falls back to CPU delegate
        // (still on the "full" model) if GPU isn't available on this device.
        const MODEL=src.model;
        const opts={
          runningMode:"VIDEO",numPoses:1,
          minPoseDetectionConfidence:.3,minPosePresenceConfidence:.3,minTrackingConfidence:.3
        };
        let pl;
        try{
          pl=await mod.PoseLandmarker.createFromOptions(fr,{baseOptions:{modelAssetPath:MODEL,delegate:"GPU"},...opts});
        }catch(gpuErr){
          console.warn("GPU delegate unavailable, falling back to CPU:",gpuErr.message);
          pl=await mod.PoseLandmarker.createFromOptions(fr,{baseOptions:{modelAssetPath:MODEL,delegate:"CPU"},...opts});
        }
        mpRef.current=pl;window.__mpPose=pl;setMpStatus("ready");
        if(src.name!=="self-hosted"){
          console.warn("[mediapipe] loaded from the CDN — the self-hosted assets in public/mediapipe are missing. Run `npm run build` (or scripts/fetch-mediapipe.mjs) so filtered networks still work.");
        }
        return; // loaded — stop trying sources
      }catch(err){
        lastErr=err;
        console.warn(`[mediapipe] ${src.name} source failed:`,err?.message);
      }
      }
      // Every source failed. The backend is the analysis from here, and the
      // user needs to know the reading may be degraded rather than silently
      // watching a frozen number.
      console.warn("MediaPipe unavailable from all sources, using backend fallback:",lastErr?.message);
      setMpStatus("fallback");
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

    // ── Analysis-rate throttle ───────────────────────────────────────
    // This loop is driven by requestAnimationFrame, which fires at the
    // display's refresh rate (60Hz normally, but 120/144Hz+ on gaming
    // monitors) — NOT at any analysis-appropriate rate. Every tick was
    // running MediaPipe's detectForVideo (a WASM pose-inference call,
    // genuinely expensive — tens of ms), the full posture-analysis
    // pipeline, and a React state update, uncapped. On a 120Hz display
    // that's roughly double the intended work every second; the buffer
    // sizes elsewhere in this file (createFrameBuffer(30) below) already
    // assume "~15fps" per their own comment, so nothing else in the
    // pipeline needed a rate faster than that. Throttling here to a
    // fixed real-world interval (not frame count, so it behaves the same
    // on 60Hz/120Hz/144Hz screens) directly cuts MediaPipe inference
    // calls and downstream work by up to ~4x — this was the single
    // biggest source of live-session lag/stutter.
    // Skipped ticks just re-request the next frame; the last drawn
    // skeleton overlay and score simply persist for that ~50ms, which
    // is imperceptible for posture (a slow-changing signal).
    const _nowTs = performance.now();
    if (_nowTs - lastAnalysisTsRef.current < 50) { // ~20fps ceiling
      rafRef.current = requestAnimationFrame(runLoop);
      return;
    }
    lastAnalysisTsRef.current = _nowTs;

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
        const det=mpRef.current.detectForVideo(vidRef.current,performance.now());
        if(det.landmarks?.length>0){
          window.__frameHadLandmarksOnce=true;
          const quality = qualityFor(effectiveTier);
          if(!lmSmootherRef.current) lmSmootherRef.current=createLandmarkSmoother(quality.smoothingAlpha, quality.outlierMaxConsecutive);
          if(!frameBufferRef.current) frameBufferRef.current=createFrameBuffer(30); // 2s at 15fps
          if(!distSmootherRef.current) distSmootherRef.current=createDistanceSmoother(30);
          const rawLms = det.landmarks[0];
          // ── Multi-person / subject-switch guard ─────────────────────
          // If the shoulder centroid jumps > 30% of the frame width in
          // one detection cycle, it's almost certainly a different person
          // entering the frame (or a MediaPipe tracking reset). Reject the
          // frame entirely rather than feeding bad data into the smoother.
          let subjectOk = true;
          const prevCentroid = lmSmootherRef.current?._prevCentroid;
          const lShX = rawLms[11]?.x ?? 0.5;
          const rShX = rawLms[12]?.x ?? 0.5;
          const curCentroidX = (lShX + rShX) / 2;
          if(prevCentroid != null && Math.abs(curCentroidX - prevCentroid) > 0.30) subjectOk = false;
          if(lmSmootherRef.current) lmSmootherRef.current._prevCentroid = curCentroidX;
          if(!subjectOk){
            // This guard used to fail completely silently: the frame gets
            // dropped, `analysis`/`scoreStatus` never update, and from the
            // user's side the whole display just looks frozen for however
            // long a second person (a coworker walking past, someone
            // sitting down next to them) keeps triggering it — a real,
            // plausible workplace scenario with zero explanation on screen.
            //
            // CRITICAL bug found in this branch (2-agent audit): unlike
            // every other early-return in this function, this one used to
            // `return` WITHOUT re-scheduling requestAnimationFrame(runLoop)
            // first — so the very first time this guard fired in a session
            // (which can be as mundane as leaning sideways or briefly
            // stepping out of frame, not just a second person), the entire
            // self-rescheduling analysis loop died permanently: score,
            // skeleton and alerts froze silently while the camera preview
            // kept playing normally, with zero on-screen indication why,
            // and no recovery short of stopping and restarting the session.
            rafRef.current=requestAnimationFrame(runLoop);
            subjectRejectStreakRef.current++;
            if(subjectRejectStreakRef.current>=5 && !multiPersonShownRef.current){
              multiPersonShownRef.current=true; setMultiPersonWarning(true);
            }
            return; // drop frame — don't update smoother or score
          }
          if(subjectRejectStreakRef.current>0){
            subjectRejectStreakRef.current=0;
            if(multiPersonShownRef.current){
              multiPersonShownRef.current=false; setMultiPersonWarning(false);
            }
          }
          const lms=lmSmootherRef.current.smooth(rawLms);
          totalRef.current++;setTotalF(totalRef.current);
          const rawResult=analyzeMP(lms,W,H,mode,calibData?.distCalibFactor,sessRef.current,calibData?.knownDistCm,calibData); // Side mode removed app-wide
          // Stabilize distance via sliding median — fixes ±10pt IPD jitter
          if(rawResult?.distCm && distSmootherRef.current){
            const stableDistCm=distSmootherRef.current.push(rawResult.distCm);
            rawResult.distCm=stableDistCm;
            if(rawResult.metrics?.screen_distance) rawResult.metrics.screen_distance.value=stableDistCm;
          }
          // Push raw metrics into buffer — use trimmed mean score after 10+ frames
          // NOTE: analyzeMP/analyzeSideMP wrappers above return field `overall`,
          // NOT `score` (the engine's raw field name) — must read `overall` here
          // or this entire 60-frame trimmed-mean pipeline silently never fires.
          let result = rawResult;
          if(rawResult?.overall != null && frameBufferRef.current){
            frameBufferRef.current.push({score: rawResult.overall});
            const buffered = frameBufferRef.current.trimmedMean("score");
            if(buffered != null){
              result = {...rawResult, overall: Math.round(buffered), score: Math.round(buffered)};
            }
          }
          // If frame quality failed (too_close/too_far/body_cropped), show warning but don't block
          if(result && result.overall == null && result.qualityReason){
            // BUG: qualityScore was never included in this spread, so it kept
            // whatever value the LAST successful analysis left it at (always
            // 100 on success). The warning banner below only renders when
            // qualityScore < 100, so once a session had one good frame, this
            // gate silently stopped showing "too close/too far/body cropped"
            // ever again — the screen just froze on the last good reading
            // with zero explanation while the user moved around in front of
            // the camera. Also reset the distance readout and current score
            // status so stale numbers don't sit on screen looking "live".
            startTransition(()=>{
              setAnalysis(prev=>({...(prev||{}), qualityReason:result.qualityReason, qualityScore:result.qualityScore ?? 0, detected:false, overall:null}));
              setScoreStatus(null);
            });
            rafRef.current=requestAnimationFrame(runLoop);return;
          }
          // If no qualityReason but overall is null, skip silently (not enough frames yet)
          if(result && result.overall == null){ rafRef.current=requestAnimationFrame(runLoop);return; }
          if(result){
            // Apply personal calibration if available
            let finalResult = result;
            if(calibData?.tolerances) {
              const adjMets = applyCalibration(result.metrics, calibData, "front"); // Side mode removed app-wide — always front now
              const vals = Object.values(adjMets).map(m=>m.score||0);
              const calibScore = Math.round(vals.reduce((a,b)=>a+b,0)/Math.max(vals.length,1));
              finalResult = {...result, overall: Math.round(result.overall*.4 + calibScore*.6), metrics: adjMets};
            }
            if(finalResult.overall>=65){goodRef.current++;setGoodF(goodRef.current);}
            // Score pipeline: buffer(60frames) → calibration → EMA smoother → UI
            const smoothed1=pushScore(finalResult.overall);
            const displayScore = smoothed1 ?? finalResult.overall;
            // A SECOND beep system used to fire here: useSoundFeedback calls
            // playPostureAlert() on every frame where the score is under 60, on
            // its own 45s cooldown, with no idea which fault is responsible and
            // no per-cause backoff. It ran in parallel with the cause-based
            // alert path below, so a user sitting below 60 got that beep every
            // 45 seconds PLUS whatever the cause path did — two independent
            // sounds for one posture, which is the noise complaint in
            // miniature and defeats the channel arbitration below.
            //
            // Removed rather than gated: a raw score threshold has nothing to
            // add over a path that knows the cause, escalates per cause, and
            // now picks exactly one channel per event.
            checkCustomAlertRules(finalResult.metrics);
            finalResult.pain_prediction = updatePainPrediction(displayScore, finalResult.metrics);
            histRef.current.push(displayScore);
            if(histRef.current.length>40)histRef.current=histRef.current.slice(-40);
            pushSessionScore(displayScore);
            lastAnalRef.current=finalResult;
            // Push to React at ~4Hz, not on every analysed frame.
            //
            // The analysis loop runs at a 20fps ceiling and this used to call
            // setAnalysis + setHistory every single time, so the whole live
            // page — score ring, metrics panel, history chart, alert bar —
            // re-rendered twenty times a second. That is the lag: the work is
            // not the pose estimation, it is React reconciling a large tree
            // against numbers no one can read that fast.
            //
            // The skeleton and the on-video labels are drawn imperatively to
            // the canvas below and are unaffected, so the camera feed stays
            // smooth at full rate. Only the numbers people read settle at four
            // updates a second, which is faster than anyone reads them.
            // lastAnalRef keeps the newest result available to everything that
            // needs it immediately, including session save.
            if (_nowTs - lastUiPushRef.current >= 250) {
              lastUiPushRef.current = _nowTs;
              // `overall` carries the SMOOTHED score to the UI, because that is
              // the number everything else in the product already uses.
              //
              // What this fixes: the badge and the gauge read
              // analysis.overall, which was the RAW per-frame score, while the
              // history chart, the session average and the saved session all
              // used `displayScore` (smoothed). Three numbers from two
              // pipelines on one screen, and the one the user watched climbing
              // was the jumpy one the smoother exists to tame — a single frame
              // of a good angle spiked it several points and it fell straight
              // back. `overall_raw` is kept for anything that genuinely wants
              // the instantaneous value.
              const uiResult = { ...finalResult, overall: displayScore, overall_raw: finalResult.overall };
              startTransition(()=>{ setHistory([...histRef.current]);setAnalysis(uiResult); });
            }
            // Privacy: pixelate the face first so the skeleton draws on top of it.
            //
            // The return value was thrown away, and drawFaceBlur() returns
            // false on five separate paths — no ear visible, too few head
            // landmarks, a degenerate box, a canvas exception. On every one of
            // them nothing was drawn, the toggle stayed lit, and the user went
            // on believing their face was hidden. A privacy control must not
            // fail by staying quiet, so a frame it could not cover is counted
            // and surfaced.
            if(faceBlur){
              const _blurred = drawFaceBlur(ctx,vid,lms,W,H);
              if(_blurred) blurMissRef.current = 0;
              else if(++blurMissRef.current === 30) {   // ~1s of uncovered frames
                addToast(isAr
                  ? "إخفاء الوجه مش شغال دلوقتي — الكاميرا مش شايفة وشك كفاية. اقعد مواجه الكاميرا أو اقفل الخاصية."
                  : "Face blur can't cover your face right now — your head isn't fully visible. Face the camera, or turn the setting off.",
                  "warn");
              }
            }
            const _drawOpts={skeleton:showSkeleton,angles:showAngles};
            drawFront(ctx,finalResult,W,H,isAr,_drawOpts); // Side mode removed app-wide
            const now=Date.now();

            // Session-level pattern tracking (creep, chronic asymmetry, experimental breathing)
            // Side mode removed app-wide — this always runs now.
            {
              if(!insightsRef.current) insightsRef.current=_newInsightsTracker();
              const midShY=(lms[11]?.y+lms[12]?.y)/2;
              const neckMet=finalResult.metrics?.neck_lean, shMet=finalResult.metrics?.shoulder_level;
              const newInsights=_trackSessionPatterns(
                insightsRef.current, now, midShY,
                neckMet?.value, neckMet?.reliable!==false,
                shMet?.signed, shMet?.reliable!==false,
                isAr, quality.sessionInsights
              );
              if(newInsights.length){
                setSessionInsights(prev=>[
                  ...newInsights.map(ins=>({...ins,time:new Date().toLocaleTimeString()})),
                  ...prev,
                ].slice(0,10));
              }
            }

            const gateScore=smoothed1||finalResult.overall;
            // REMOVED: "worst 3 moments" JPEG capture.
            //
            // This drew the live <video> to a canvas, pixelated the face box
            // and pushed base64 JPEGs into worstSnapsRef, which saveSession()
            // then wrote into the Firestore session document as
            // `worst_snapshots` — visible in the Sessions list, PDF exports
            // and to an HR admin viewing team reports.
            //
            // Six places in the product state that video/images never leave
            // the device (privacy policy §2, the landing page, the FAQ, How
            // It Works, the product page, and the security section). That was
            // false while this ran. The face blur was a real mitigation but a
            // partial one: it covers the face box only, leaving body, clothing
            // and room identifiable, and drawFaceBlur() returns false without
            // blurring anything when the ear landmark is missing or the box is
            // degenerate — with the failure swallowed by the empty catch this
            // block used to end with, so an unblurred frame could be stored
            // with nothing to indicate it.
            //
            // The product decision is that the claim is worth more than the
            // feature, so nothing is captured any more. Analysis is unaffected
            // — it runs on-device and never needed these.
            if(lightCheckRef.current.wasLow){
              // Don't trust score-based decisions in poor lighting — neither
              // accumulate nor reset the bad-streak timer, since we can't
              // tell if it's genuinely bad posture or just a bad frame.
              // Separate 60s cooldown so lighting notices don't block posture alerts.
              goodSinceRef.current=0;
              if(now-lightAlRef.current>60000){
                lightAlRef.current=now;
                setAlertMsg({text:isAr?"الإضاءة ضعيفة جدًا — حسّن الإضاءة لقراءة أدق":"Lighting too low — improve lighting for an accurate reading",type:"warn"});
              }
            }else if(gateScore<SENS.gate){
              goodSinceRef.current=0;
              if(!badRef.current)badRef.current=now;
              else if(now-badRef.current>SENS.dwellMs){
                // Severity-aware cooldown: severe=5s, moderate=15s, mild=30s
                const _sev=finalResult.overall<40?'severe':finalResult.overall<55?'moderate':'mild';
                const _cool=_sev==='severe'?5000:_sev==='moderate'?15000:30000;
                if(now-lastAlRef.current>_cool){
                lastAlRef.current=now;acRef.current.total++;
                const nlMet=finalResult.metrics?.neck_lean, yawMet=finalResult.metrics?.head_yaw;
                const nl=nlMet?.reliable!==false?(nlMet?.value||0):0;
                const yaw=yawMet?.reliable!==false?(yawMet?.value||0):0;
                const dist=finalResult.distCm||0;
                const[lo,hi]=finalResult.lo&&finalResult.hi?[finalResult.lo,finalResult.hi]:[50,80];

                // Pick the most actionable alert cause.
                //
                // This used to be a hardcoded three-way chain — neck, then
                // yaw, then distance — completely separate from the alert list
                // the engine builds. Two consequences, both bad:
                //
                //  1. It led with neck lean, which from a front camera is
                //     largely a duplicate of spine lean, so a user leaning
                //     sideways was told to "raise the monitor to eye level" —
                //     the wrong correction, spoken aloud and pushed as a
                //     desktop notification.
                //  2. It knew nothing about forward head, slouching, trunk
                //     rotation or shoulder shrug. Someone sitting with 8cm of
                //     forward head got the generic "Sustained poor posture",
                //     while the engine had already worked out exactly what was
                //     wrong and how to fix it.
                //
                // The engine's list is now sorted by how much each fault is
                // actually costing the score, so its first entry IS the most
                // actionable cause. Use it, and keep the hardcoded chain only
                // as a fallback for the case where no specific alert fired.
                let causeKey="posture", msg="Sustained poor posture — correct position now", msgAr="وضعية سيئة مستمرة — صحّح وضعيتك الآن";
                const _top = finalResult.alerts?.detailed?.[0];
                if(_top?.text){
                  // Cause key drives the per-cause cooldown below; collapse the
                  // engine's severity suffixes so "fhp_sev" and "fhp_mid" are
                  // one cause and cannot alternate past the cooldown.
                  causeKey = String(_top.key||"posture").replace(/_(sev|mid|cl|c|f|hi|lo|low|prop|calib_tip)$/,"");
                  msg = _top.text;
                  // The engine emits one language; the Arabic UI keeps the
                  // localised fallback rather than showing English mid-session.
                  msgAr = isAr ? (msgArFor(causeKey, finalResult) || msg) : msg;
                  if(causeKey==="neck") acRef.current.neck++;
                  else if(causeKey==="dist") acRef.current.dist++;
                }
                else if(nl>14){causeKey="neck";msg=`Head leaning ${nl}° to one side — level it over your shoulders`;msgAr=`راسك مايلة ${nl}° على جنب — رجّعها فوق كتفيك`;acRef.current.neck++;}
                else if(Math.abs(yaw)>12){causeKey="yaw";msg=`Head turned ${Math.round(Math.abs(yaw))}° — face the monitor`;msgAr=`الرأس مائل ${Math.round(Math.abs(yaw))}° — واجه الشاشة مباشرة`;}
                else if(dist&&dist<lo){causeKey="dist";msg=`Too close (${dist}cm) — move to ${lo}–${hi}cm`;msgAr=`قريب جداً (${dist}سم) — ابتعد إلى ${lo}–${hi}سم`;acRef.current.dist++;}

                // Exponential backoff per cause: 1st=5min, 2nd=10min, 3rd+=20min
                // Prevents repeated same-cause spam while still alerting on genuine persistence
                // Backoff scaled by the sensitivity setting (strict repeats
                // sooner, relaxed later) instead of a fixed 5/10/20.
                const causeEntry = alertCauseRef.current[causeKey] || { last: 0, count: 0 };
                const causeCooldown = SENS.base * (causeEntry.count === 0 ? 1 : causeEntry.count === 1 ? 2 : 4);
                if(now - causeEntry.last > causeCooldown){
                  alertCauseRef.current[causeKey] = { last: now, count: causeEntry.count + 1 };
                  const displayMsg = isAr ? msgAr : msg;
                  const sev = finalResult.overall<40?"severe":finalResult.overall<55?"moderate":"mild";
                  setAlertCounts({...acRef.current});
                  alRef.current=[{time:new Date().toLocaleTimeString(),msg:displayMsg,msgEn:msg,msgAr,score:finalResult.overall,severity:sev,cause:causeKey},...alRef.current].slice(0,30);
                  // #10 Streak protection — fire once per session if streak at risk
                  const userStreak = profile?.streak_days||0;
                  if(userStreak>=5 && !streakAlert && now-badRef.current>120000){
                    setStreakAlert(true);
                  }
                  setAlerts([...alRef.current]);setAlertMsg({text:displayMsg,type:"warn"});

                  // Channel arbitration. Exactly one thing speaks per event.
                  //
                  //   tab hidden        -> OS notification (nothing on screen
                  //                        is being looked at)
                  //   voice available   -> speak it; the banner already carries
                  //                        the text, so a beep on top is a
                  //                        third copy of one message
                  //   otherwise         -> a beep, and only for severe/moderate
                  //
                  // The banner and the alert log are not channels in this sense
                  // — they are silent, on-screen, and dismissible by looking
                  // away. The noisy ones are the three below.
                  const tabHidden = typeof document !== "undefined" && document.hidden;
                  const voiceOn   = isVoiceCoachEnabled();
                  // `displayMsg`, not `msg`. The OS notification was the one
                  // channel still hardcoded to the English string, so an
                  // Arabic user's screen lit up in English.
                  let handled = false;
                  if(tabHidden && desktopNotifs){
                    handled = sendDesktopNotif(displayMsg, finalResult.overall,
                      { lang: isAr?"ar":"en", onClick: ()=>{} });
                  }
                  // A notification that could not be shown — permission denied,
                  // an unsupported browser, or the toggle off — used to end the
                  // event silently: no sound, no speech, and a banner on a tab
                  // nobody is looking at. Fall through to something audible.
                  if(!handled){
                    // speakCoach can decline — its own severity cooldown, a
                    // browser with no speech support, a hidden tab. Discarding
                    // the answer meant a genuine alert from a NEW cause could
                    // vanish because an unrelated cue happened to speak a few
                    // seconds earlier.
                    const spoke = (voiceOn && !tabHidden)
                      ? speakCoach(displayMsg, isAr?"ar":"en", {severity:sev}) === "spoken"
                      : false;
                    // Mild faults normally get the banner only — unless the
                    // user asked for strict, which is exactly a request to hear
                    // about small drifts too. A beep for every small drift is
                    // otherwise what trains people to ignore the beep.
                    //
                    // A HIDDEN tab is the exception: the banner is not a
                    // channel there, nobody can see it. With no notification
                    // (denied, unsupported, or switched off) and no beep, that
                    // alert reached the user through nothing at all — which is
                    // the failure this whole arbitration exists to prevent.
                    if(!spoke && sound && (sev !== "mild" || SENS.mildBeeps || tabHidden)){
                      playBeep(sev);
                    }
                  }

                  // Smart permission: show in-app card after first real alert
                  if("Notification" in window && Notification.permission==="default"){
                    setShowNotifCard(true);
                  }
                }
                } // close if(_cool)
              } // close else if(badRef>15000)
            }else{
              badRef.current=null;
              clearStaleAlert(now);
              // Good posture — silent status update only, no alert box noise
              // NOTE: was `grade(finalResult.overall,t)` — `grade()` reads
              // t.excellent/t.good/t.fair/t.poor, which this translations
              // object never defined, so scoreStatus.grade was always
              // literally the string "undefined" wherever it got rendered.
              // gradeScore/gradeScoreAr (already imported, already used by
              // the engine's own grading) give the real label.
              startTransition(()=>setScoreStatus({score:displayScore,grade:isAr?gradeScoreAr(displayScore):gradeScore(displayScore)}));
            }
          }
        } else {
          // No person/landmarks detected in this frame at all.
          const nowNoLm = performance.now();
          if(!window.__lastNoLandmarksLog || nowNoLm - window.__lastNoLandmarksLog > 5000){
            window.__lastNoLandmarksLog = nowNoLm;
            console.warn("[DIAG] No landmarks detected this frame. det=", det, "video ready:", vid.readyState, vid.videoWidth, vid.videoHeight, "hadLandmarksEver:", !!window.__frameHadLandmarksOnce);
          }
        }
      }catch(e){
        // Analysis loop errors are non-fatal — log for debugging but never crash the RAF.
        // DIAG: temporarily also surface the FIRST error in production (throttled to
        // once per session) since silent swallowing here was hiding the exact cause
        // of "camera runs, metrics never populate".
        if(import.meta.env.DEV) console.warn("[postureEngine]", e?.message||e);
        else if(!window.__firstAnalysisErrorLogged){
          window.__firstAnalysisErrorLogged=true;
          console.error("[DIAG] First analysis-loop error (was being silently swallowed):", e?.message, e?.stack);
        }
      }
    }
    // Backend call ONLY when actually needed — not a duplicate of local analysis:
    //  1) Fallback mode (local MediaPipe failed to load) → backend IS the analysis
    //  2) Elite-equivalent tier (elite/premium/b2b_enterprise) → snapshots for PDF + Corvus AI insights
    // Standard/Basic/Professional tiers with working local MediaPipe never touch the backend here.
    const eliteEquivalent = tierAtLeast(effectiveTier, "elite");
    // PRIVACY: Elite users used to upload a full-resolution, quality-0.88
    // JPEG of themselves every 2.5s purely to enrich insights — while six
    // pages of copy stated that no video or images ever leave the device.
    // That upload is gone. The backend is now contacted ONLY in fallback
    // mode, where local MediaPipe failed to load and the server genuinely is
    // the analysis; with MediaPipe self-hosted (see index.html) that path
    // should effectively never be taken.
    //
    // Cost note: at 100 concurrent Elite users this was roughly 40 req/s of
    // ~200KB uploads to an endpoint that discarded them.
    const needsBackend = mpStatus==="fallback";
    // Gate on ELAPSED TIME, not on `totalRef % 45`.
    //
    // In fallback mode (local MediaPipe failed to load) mpRef is null, so the
    // local block above never runs and totalRef is incremented ONLY inside this
    // request's own .then(). That made the old counter gate self-defeating in
    // both directions:
    //   - backend responding: totalRef 0 -> gate open -> a request every tick
    //     (~20/s) until the first response sets totalRef=1, after which the
    //     gate is shut and the only thing that could reopen it lives behind
    //     the gate. Analysis stopped permanently — feed still playing, score
    //     frozen on its first value, and no "backend down" overlay because
    //     nothing had actually failed.
    //   - backend failing: totalRef never increments at all -> gate never
    //     closes -> ~20 POSTs/sec, each a full-frame JPEG (~150-250KB), all
    //     with a 20s timeout. Hundreds of concurrent uploads; the tab dies.
    // A wall-clock interval is independent of which code path increments what,
    // so it behaves the same whether the backend is healthy, slow or down.
    // (It also fixes the Elite case, where leaving frame froze totalRef on a
    // multiple of 45 and fired a request every tick until the user returned.)
    const _bnow = Date.now();
    const BACKEND_MIN_INTERVAL_MS = mpStatus==="fallback" ? 1200 : 2500;
    const backendDue = _bnow - (lastBackendMsRef.current||0) >= BACKEND_MIN_INTERVAL_MS;
    if(needsBackend && backendDue && !backendInFlightRef.current && canvRef.current){
      lastBackendMsRef.current = _bnow;
      backendInFlightRef.current = true;
      const c=canvRef.current,v2=vidRef.current;
      if(v2&&v2.readyState>=2){c.width=v2.videoWidth;c.height=v2.videoHeight;c.getContext("2d").drawImage(v2,0,0);}
      // Non-blocking fire-and-forget. The timeout is passed as a real option
      // (AnalysisAPI.analyze forwards it to apiFetch, which owns the abort
      // controller) — it used to be an AbortSignal placed inside the payload,
      // which was JSON-serialised into the request body and listened to by
      // nothing, so these requests actually hung for apiFetch's 20s default.
      AnalysisAPI.analyze({
        frame:        c.toDataURL("image/jpeg",.88),
        mode,
        lang,
        session_id:   sessionId,
        calibration:  calibData,
        timeout:      4000,
      }).then(d=>{
        backendInFlightRef.current = false;
          // REMOVED: an `AnalysisAPI.addSnapshot(...)` call used to fire here
          // every ~12 frames for Elite-equivalent users, uploading a JPEG +
          // running a full backend analyze_front() pass purely to POST it to
          // /api/session/snapshot. Traced where that data actually goes:
          // add_snapshot() (backend.py) only ever appends to an in-memory
          // session_snapshots dict that NOTHING reads back — no route,
          // no PDF code, no session-summary code ever queries it; the only
          // other reference to session_snapshots is the cleanup delete at
          // session end. The real "worst 3 moments" feature shown in the
          // PDF (worstSnapsRef below) is a completely separate, already
          // frontend-scored mechanism using this same engine's own
          // finalResult.overall — self-consistent with the live score by
          // construction. So this call bought nothing: it was pure extra
          // backend compute (a second full MediaPipe pass), bandwidth, and
          // server-side memory for every Elite session, for data no one
          // ever displayed. Deleting it changes zero user-visible behavior.
          // (Left the /api/session/snapshot route itself alone in
          // backend.py — removing a live API route has a different, higher
          // risk profile than removing its one caller.)
          // Use backend result if local MP not available (fallback mode)
          if(mpStatus==="fallback"&&d.overall>0){
            backendFailRef.current=0; // reset — backend is responding fine
            if(backendFailShownRef.current){ backendFailShownRef.current=false; setBackendDown(false); }
            const rawScore = d.overall;
            const smoothed = pushScore(rawScore) || rawScore; // same 15s window as local MP
            const result={...d, overall: smoothed};
            result.pain_prediction = updatePainPrediction(smoothed, result.metrics);
            totalRef.current++;setTotalF(totalRef.current);
            if(smoothed>=65){goodRef.current++;setGoodF(goodRef.current);}
            histRef.current.push(smoothed);
            if(histRef.current.length>40)histRef.current=histRef.current.slice(-40);
            pushSessionScore(smoothed);
            lastAnalRef.current=result;
            startTransition(()=>{ setHistory([...histRef.current]);setAnalysis(result); });
            const now=Date.now();
            if(smoothed<65){
              goodSinceRef.current=0;
              if(!badRef.current)badRef.current=now;
              else if(now-badRef.current>15000){
                // Severity-aware cooldown: severe=5s, moderate=15s, mild=30s
                const _sev=result.overall<40?'severe':result.overall<55?'moderate':'mild';
                const _cool=_sev==='severe'?5000:_sev==='moderate'?15000:30000;
                if(now-lastAlRef.current>_cool){
                lastAlRef.current=now;acRef.current.total++;
                // Per-cause exponential backoff (same as local MP loop)
                // Strip the digits so one fault is one cause however its
                // numbers drift; then collapse to a short stable key.
                const causeKeyBE = (result.alerts?.[0] || "posture")
                  .toLowerCase().replace(/[\d.]+\s*(cm|°|deg|%)?/g, "").replace(/\s+/g, " ").trim().slice(0, 24) || "posture";
                const causeEntryBE = alertCauseRef.current[causeKeyBE] || { last: 0, count: 0 };
                const causeCoolBE = SENS.base * (causeEntryBE.count === 0 ? 1 : causeEntryBE.count === 1 ? 2 : 4);
                if(now - causeEntryBE.last > causeCoolBE){
                alertCauseRef.current[causeKeyBE] = { last: now, count: causeEntryBE.count + 1 };
                const msgFb = isAr
                  ? (result.alerts_ar?.[0] || "وضعية سيئة — صحّح وضعيتك")
                  : (result.alerts?.[0] || "Poor posture — correct position");
                setAlertCounts({...acRef.current});
                alRef.current=[{time:new Date().toLocaleTimeString(),msg:msgFb,score:smoothed},...alRef.current].slice(0,20);
                setAlerts([...alRef.current]);setAlertMsg({text:msgFb,type:"warn"});
                // One channel per event — see the arbitration note in the local
                // MediaPipe loop above. This path had the same banner + beep +
                // speech + OS-notification pile-up.
                {
                  const _sevFb = smoothed<40?"severe":smoothed<55?"moderate":"mild";
                  const _hidden = typeof document !== "undefined" && document.hidden;
                  let _handledFb = false;
                  if(_hidden && desktopNotifs)
                    _handledFb = sendDesktopNotif(msgFb, smoothed, { lang: isAr?"ar":"en" });
                  if(!_handledFb){
                    const _spokeFb = (isVoiceCoachEnabled() && !_hidden)
                      ? speakCoach(msgFb, isAr?"ar":"en", {severity:_sevFb}) === "spoken"
                      : false;
                    // See the note in the local-engine path above: a hidden tab
                    // has no visible banner, so mild cannot be left silent.
                    if(!_spokeFb && sound && (_sevFb !== "mild" || SENS.mildBeeps || _hidden)) playBeep(_sevFb);
                  }
                }
                } // close per-cause backoff
                } // close if(_cool)
              } // close else if(badRef>15000)
            }else{
              badRef.current=null;
              clearStaleAlert(now);
              startTransition(()=>setScoreStatus({score:smoothed,grade:isAr?gradeScoreAr(smoothed):gradeScore(smoothed)}));
            }
          }
          // Always use local Corvus AI for Elite-equivalent tiers
          if(d.claude_analysis&&eliteEquivalent)setAiInsight(d.claude_analysis);
        }).catch(e=>{
          backendInFlightRef.current = false;
          // In fallback mode the backend call IS the only analysis — a
          // silent failure here means zero score updates, ever, with the
          // camera looking "frozen." For the Elite-parallel case (local
          // MediaPipe already working) this stays silent on purpose since
          // local analysis genuinely continues unaffected.
          if(mpStatus==="fallback"){
            backendFailRef.current+=1;
            if(backendFailRef.current>=3 && !backendFailShownRef.current){
              backendFailShownRef.current=true;
              setBackendDown(true);
              const msg=isAr
                ?"تعذر الوصول لخادم التحليل — تأكد من اتصال الإنترنت وحاول تاني"
                :"Can't reach the analysis server — check your connection and retry";
              setAlertMsg({text:msg,type:"bad"});
              addToast(msg,"error");
            }
          }
        });
    }
    rafRef.current=requestAnimationFrame(runLoop);
    // SENS.* and desktopNotifs are read inside this closure, so they belong in
    // the dep array — a rAF loop keeps the closure it was scheduled with, and
    // the effect below rebinds it on a new identity. Without them, changing
    // sensitivity mid-session would silently do nothing until the next session.
  },[mode,tier,sessionId,sound,t,calibData,pushScore,checkCustomAlertRules,mpStatus,faceBlur,showSkeleton,showAngles,
     SENS.gate,SENS.dwellMs,SENS.base,SENS.mildBeeps,desktopNotifs]);

  // Keep the analysis loop bound to the latest state. runLoop is a useCallback
  // whose identity changes when mode / sound / faceBlur / calib change; without
  // this, the self-rescheduling requestAnimationFrame keeps running the closure
  // captured at session start and silently ignores mid-session changes (camera-
  // mode switch, face-blur toggle, sound). Rebinds the RAF to the fresh closure
  // whenever it changes. Buffers live in refs, so restarting a frame is harmless.
  // NOTE: must be declared AFTER runLoop — its dep array reads runLoop, which
  // is in the temporal dead zone until the useCallback above initialises it.
  useEffect(() => {
    // isPaused must gate this too, not just camActive: pauseSession() cancels
    // rafRef and sets it to null, but changing any of runLoop's own deps
    // (sound/faceBlur/showSkeleton/showAngles/mode/calibData — all editable
    // from the still-interactive Session Settings panel while paused) gives
    // runLoop a new identity and re-fires this effect. It used to reschedule
    // requestAnimationFrame(runLoop) unconditionally, silently resuming
    // detection/scoring/alerts behind the "Session paused" overlay — the
    // user sees "paused" while analysis is actually still running.
    if(!camActive || isPaused) return;
    if(rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(runLoop);
    return () => { if(rafRef.current){ cancelAnimationFrame(rafRef.current); rafRef.current=null; } };
  }, [runLoop, camActive, isPaused]);

  async function startCamera(){
    // Guards a real bug: cameraStatus==="requesting" is the only thing that
    // disables this button, but setCameraStatus() is async — a fast
    // double-click/double-tap can fire startCamera() twice before React
    // re-renders the disabled state. The second call's openPreview() then
    // resolves LATER, well after the first call has already gone through
    // the countdown and started real scoring (camActive=true), and its
    // stray setPreviewPhase("preview") re-shows the Cancel/Start-session
    // overlay on top of an already-running session — it just sits there,
    // overlapping the live coaching-tip banner, for the rest of the
    // session since nothing else ever clears it. A synchronous ref (not
    // state, so no render-lag window) closes that gap.
    if(startingCameraRef.current || camActive || previewPhase) return;
    startingCameraRef.current=true;
    // Health consent gate — block the very first analysis until the user has
    // acknowledged this is a wellness tool, not a medical diagnosis. Uses a
    // ref (not state) so acceptHealthConsent() can re-invoke synchronously.
    if(!healthConsentRef.current){ setShowHealthConsent(true); startingCameraRef.current=false; return; }
    try{ await openPreview(); } finally { startingCameraRef.current=false; }
  }

  // Opens the camera and shows a live, non-scoring preview so the user can
  // see themselves and adjust framing before anything is recorded. A
  // Cancel button is visible the whole time this is showing.
  async function openPreview(){
    const effectiveMode = mode || "laptop";
    if (!mode) { setMode("laptop"); }
    setCameraStatus("requesting");
    try{
      const facingMode="user"; // Phone mode removed app-wide — always front camera now
      // Over plain HTTP (or any insecure origin) navigator.mediaDevices is
      // undefined, so this threw a bare TypeError that fell through to the
      // generic "Camera error — please retry" — advice the user can never act
      // on, because retrying can't fix the page's protocol.
      if(!navigator.mediaDevices?.getUserMedia){
        setCameraStatus("no-device");
        setAlertMsg({ text: isAr
          ? "الكاميرا محتاجة اتصال آمن (HTTPS). افتح الموقع من رابط https."
          : "Camera access requires a secure connection (HTTPS). Please open this site over https.", type:"bad" });
        startingCameraRef.current=false;
        return;
      }
      // Anything already in streamRef is about to be overwritten by the line
      // below, and an overwritten MediaStream can never be stopped again — its
      // tracks stay live and the OS camera light stays on until the tab is
      // closed. beginScoring()'s catch path is one way to get here with a
      // stream still parked in the ref. Release it first; this is a no-op in
      // the normal flow, where stopCamera()/cancelPreview() already cleared it.
      if(streamRef.current){
        try{ streamRef.current.getTracks().forEach(t=>{t.stop();t.enabled=false;}); }catch{}
        streamRef.current=null;
      }
      const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:{ideal:facingMode}}});
      streamRef.current=s;
      // Both of these bail-outs used to leave the just-granted MediaStream
      // running in streamRef with nothing attached to it — the OS camera light
      // stayed on with no way to turn it off short of a reload. The second one
      // also left cameraStatus pinned on "requesting", which is the exact state
      // that disables the Start button, so the page read "Opening camera…"
      // forever. vidRef goes null whenever the live subtree unmounts during the
      // permission prompt or the metadata wait — pressing Back, browser-back,
      // or any break button.
      const _releaseStream = () => {
        try { s.getTracks().forEach(t=>t.stop()); } catch {}
        if(streamRef.current === s) streamRef.current = null;
      };
      if(!vidRef.current){ _releaseStream(); setCameraStatus("idle"); return; }
      vidRef.current.srcObject=s;
      let metadataLoaded=true;
      await new Promise((res,rej)=>{
        vidRef.current.onloadedmetadata=res;
        setTimeout(rej,8000); // 8s timeout
      }).catch(()=>{ metadataLoaded=false; });
      if(!vidRef.current){ _releaseStream(); setCameraStatus("idle"); return; }
      // The 8s timeout above used to be swallowed silently and this
      // function proceeded to "ready" regardless of whether metadata ever
      // arrived. If the stream never actually delivered a frame (driver
      // hiccup, a device that grants permission but never starts
      // streaming), videoWidth/videoHeight stay 0 forever — the countdown
      // would still run, beginScoring() would still flip camActive=true
      // (nothing in that path depends on the video actually being ready),
      // and runLoop()'s own `vid.readyState<2` guard would then just
      // reschedule itself via requestAnimationFrame forever with no error,
      // no retry, and no visible sign anything was wrong: the "Starting
      // session..." transition would clear right on schedule, but the
      // camera panel behind it would just sit there frozen — exactly the
      // intermittent "starting session hangs" reports. Treat a stream that
      // never produced a real frame the same as any other camera failure
      // instead of silently proceeding.
      if(!metadataLoaded || !vidRef.current.videoWidth || !vidRef.current.videoHeight){
        setCameraStatus("idle");
        if(streamRef.current){ streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; }
        if(vidRef.current) vidRef.current.srcObject=null;
        const errMsg=isAr
          ?"الكاميرا اتفتحت بس مفيش صورة وصلت — جرب تاني"
          :"Camera opened but no video signal arrived — please retry";
        setAlertMsg({text:errMsg,type:"bad"});
        addToast(errMsg,"error");
        return;
      }
      setCameraStatus("ready");
      setPreviewPhase("preview"); // shows live feed + "Start"/"Cancel" — NOT scoring yet
    }catch(e){
      const isDenied=e.name==="NotAllowedError"||e.name==="PermissionDeniedError";
      const noDevice=e.name==="NotFoundError"||e.name==="DevicesNotFoundError";
      // BUG FIX: NotReadableError/TrackStartError — what the browser
      // actually throws when the camera is locked by another app (Zoom,
      // Teams, another tab) — used to fall through to a generic "Camera
      // error, please retry" that never told the user WHY, so retrying
      // (without closing the other app) would just fail again the same way.
      const inUse=e.name==="NotReadableError"||e.name==="TrackStartError";
      setCameraStatus(isDenied?"denied":noDevice?"no-device":"idle");
      const errMsg=isDenied
        ?(isAr?"تم رفض الوصول للكاميرا — اضغط 'سماح' في المتصفح":"Camera access denied — click Allow in browser bar")
        :noDevice
        ?(isAr?"لا توجد كاميرا — قم بتوصيل كاميرا والمحاولة مجدداً":"No camera detected — connect one and retry")
        :inUse
        ?(isAr?"الكاميرا مستخدمة في برنامج تاني (زوم، تيمز، تاب تاني...) — قفلها وحاول تاني":"Your camera is in use by another app or browser tab (Zoom, Teams, etc.) — close it and try again")
        :(isAr?"خطأ في الكاميرا":"Camera error — please retry");
      setAlertMsg({text:errMsg,type:"bad"});
      addToast(errMsg,"error");
    }
  }

  // Cancels out of preview or countdown — same cleanup as the normal Back
  // button, just doesn't navigate away from the live page.
  function cancelPreview(){
    if(countdownIvRef.current){ clearInterval(countdownIvRef.current); countdownIvRef.current=null; }
    setPreviewPhase(null);
    if(streamRef.current){ streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; }
    if(vidRef.current) vidRef.current.srcObject=null;
    setCameraStatus("idle");
  }

  // User tapped "Start session" from the live preview — run a 3-2-1
  // countdown (gives a moment to get in frame / sit down), cancellable the
  // whole time, then hand off to beginScoring().
  function confirmStartSession(){
    // Reentrancy guard: a fast double-click/double-tap on "Start session
    // now" used to run this twice before React re-rendered previewPhase
    // away from "preview" — the second call overwrote countdownIvRef with
    // a fresh interval WITHOUT clearing the first, leaking an orphaned
    // countdown that independently called beginScoring() again when it
    // reached 0, duplicating the whole session-start flow. countdownIvRef
    // is a ref (synchronous, unlike previewPhase state), so checking it
    // here closes the race regardless of render timing.
    if(countdownIvRef.current) return;
    // This is the last real user gesture before the session runs, and both
    // audio and speech are gesture-gated by Chrome. Without priming here, the
    // first alert arrives minutes later with no gesture on the stack: the
    // AudioContext stays suspended and speechSynthesis.speak() is refused —
    // both silently, with no error and no event. That is the single most
    // likely reason the coach and the beep could be wired correctly end to
    // end and still never make a sound.
    try { primeAudio(); } catch {}
    if(voiceCoach && tierAtLeast(effectiveTier,"elite")) { try { primeSpeech(); } catch {} }

    setPreviewPhase("countdown");
    setCountdownN(3);
    let n=3;
    countdownIvRef.current=setInterval(()=>{
      n-=1;
      if(n<=0){
        clearInterval(countdownIvRef.current);
        countdownIvRef.current=null;
        setPreviewPhase(null);
        setStartingSession(true);
        beginScoring();
      } else {
        setCountdownN(n);
      }
    },1000);
  }

  // The actual session start — reuses the stream already opened by
  // openPreview(), so no second camera-permission round trip.
  async function beginScoring(){
    const effectiveMode = mode || "laptop";
    try{
      // Stale isPaused from a previous session must not leak into this one —
      // see commit message for the exact double-timer bug this caused.
      setIsPaused(false);
      pausedAtRef.current = null;
      stoppingRef.current = false; // clears stopCamera()'s reentrancy guard for this new session
      // Per-session counters. These were NOT reset here, and stopCamera didn't
      // reset them either (the only reset lived in a switchMode() that had no
      // caller and has since been deleted). So a second session in the same page
      // load was written to
      // Firestore with session 1's data pooled in: good_pct averaged across
      // both, `frames` and `alerts_count` cumulative, and alert_causes (which
      // drives the weekly pattern) still holding the previous session's alerts.
      // The result modal's own "New Session" button reaches this in one click.
      histRef.current=[]; setHistory([]);
      fullHistRef.current=[]; fullHistLastMsRef.current=0;
      goodRef.current=0; setGoodF(0);
      totalRef.current=0; setTotalF(0);
      acRef.current={total:0,neck:0,dist:0};
      alRef.current=[]; setAlerts([]);
      lmSmootherRef.current?.reset();
      frameBufferRef.current?.clear();
      distSmootherRef.current?.reset();
      resetProportions();
      resetScore();
      resetPainPrediction();
      insightsRef.current=null;setSessionInsights([]);
      backendFailRef.current=0;backendFailShownRef.current=false;setBackendDown(false);
      lastBackendMsRef.current=0; backendInFlightRef.current=false;
      // Reset all alert cooldowns — exponential backoff from previous
      // sessions must not carry over into a fresh session
      lastAlRef.current=0;
      lightAlRef.current=0;
      badRef.current=null;
      alertCauseRef.current={};
      // Same reasoning, for the spoken channel: its cooldown lives in the
      // voiceCoach module, so it was the one alert timer NOT on this list and
      // the only one that leaked across sessions. Stop a session and start
      // another twenty seconds later and the new session's first cue — the
      // one that matters, because the user has just sat down — was swallowed.
      try{ resetSpeechCooldown(); }catch{}
      // Found alongside the runLoop-freeze bug above: subjectRejectStreakRef/
      // multiPersonShownRef/multiPersonWarning were only ever written inside
      // runLoop's subject-switch guard and never reset anywhere — including
      // here, unlike every other alert-cooldown ref on this list. That meant
      // the "another person detected" banner (rendered with no session-scope
      // guard at all) could survive Stop & Save and stay visible through the
      // idle screen and into a brand-new session, falsely claiming someone
      // else was in frame, until pure chance cleared it inside runLoop.
      subjectRejectStreakRef.current=0;
      multiPersonShownRef.current=false;
      setMultiPersonWarning(false);
      // Same bug class as multiPersonWarning above: alertMsg is set to
      // type:"warn"/"bad" whenever a real issue fires during a session, but
      // was never reset back to neutral anywhere — not here, not in
      // stopCamera(). The last warning/error from a PREVIOUS session (e.g.
      // "Lighting too low") stayed pinned in the status strip through Stop &
      // Save and into a brand-new session, and — because that row is gated
      // on alertMsg.type!=="warn"&&!=="bad" — permanently blocked the
      // positive "Score X/100 — Grade" status row from ever showing again
      // this browser session.
      setAlertMsg({text:isAr?"جاري تحليل وضعيتك...":"Analyzing your posture...",type:"info"});
      // Notification permission requested contextually after first alert (not cold on start)
      let sid="local_"+Date.now();
      // Previously this network call was awaited unconditionally, which meant
      // a slow or cold-starting backend directly delayed camActive/timer/RAF
      // from starting at all — the 3-2-1 countdown would finish and the
      // screen would just sit there until this resolved. Capped at 1.2s: if
      // the backend responds in time we still get the real session_id and
      // the 403/paywall check runs normally; if it's slow, we proceed
      // immediately with the local id and let the real response (including
      // a late paywall block) resolve in the background instead of stalling
      // the whole session start on it.
      let paywallBlocked=false;
      const startSessionP = AnalysisAPI.startSession({mode:effectiveMode})
        .then(d=>{ sid=d.session_id||sid; if(camActiveRef.current) setSessionId(sid); return d; })
        .catch(e=>{
          if(e?.status===403 && e?.upgrade){
            paywallBlocked=true;
            setCameraStatus("idle");
            streamRef.current?.getTracks?.().forEach(t=>t.stop());
            setCamActive(false);
            setStartingSession(false);
            if(rafRef.current) cancelAnimationFrame(rafRef.current);
            if(timerRef.current) clearInterval(timerRef.current);
            const hitDaily=(e?.body?.used_daily??0)>=(e?.body?.limit_daily??Infinity);
            const msg=hitDaily
              ?(isAr?`وصلت لحد ${e.body.limit_daily} جلسات في اليوم للخطة المجانية. جرّب تاني بكرة أو رقّي الخطة`:`You've hit today's ${e.body.limit_daily}-session Free plan cap. Try again tomorrow or upgrade`)
              :(isAr?"وصلت لحد جلسات الخطة المجانية الشهري. قم بالترقية للمتابعة":"You've reached the Free plan's monthly session limit. Upgrade to continue");
            addToast(msg,"warn");
            setShowUpgrade?.(true);setUpgradeReason?.(isAr?(hitDaily?"حد الجلسات اليومي":"حد الجلسات الشهري"):(hitDaily?"Daily session limit":"Monthly session limit"));
          }
        });
      await Promise.race([startSessionP, new Promise(r=>setTimeout(r,1200))]);
      if(paywallBlocked) return;
      // If the user backed out (Back button / browser back) during this
      // ~1.2s await, stopCamera() already ran and tore down streamRef —
      // nothing else ever nulls it in a normal flow. Without this check,
      // this continuation would resurrect camActive=true and schedule a
      // fresh timer/RAF loop for a page the user already left: it runs
      // forever in the background (nothing on Home ever calls
      // stopCamera() again), and worse, the next time they open Live and
      // hit Start, startCamera()'s own `camActive && return` guard would
      // silently refuse to start a new session at all.
      if(!streamRef.current){ setStartingSession(false); return; }

      setSessionId(sid);sessRef.current=Date.now();setCamActive(true);
      setStartingSession(false);
      // NOTE: previously showed an info toast here ("{mode} camera · {tier}
      // tier active") on every session start. Removed — that fact is already
      // permanently visible in both the header and the sidebar badges, so the
      // toast was a third repetition of the same two words with zero new
      // information, right as the user is trying to focus on getting into frame.
      if(user?.uid) completeOnboardingStep(user.uid,"first_session").catch(e=>console.warn("[Onboarding]",e.message));
      // Calibration is opt-in — user can trigger from settings
      // Removed auto-popup to prevent overlay conflict with camera
      timerRef.current=setInterval(()=>{
        const elapsed=Math.floor((Date.now()-sessRef.current)/1000);
        setSessionTime(elapsed);
        // Break reminder itself is handled by the real useBreakTimer hook
        // (breakIntervalMin-aware) — see the showBreak effect near isAr/dir.
      },1000);
      rafRef.current=requestAnimationFrame(runLoop);
    }catch(e){
      const isDenied=e.name==="NotAllowedError"||e.name==="PermissionDeniedError";
      const noDevice=e.name==="NotFoundError"||e.name==="DevicesNotFoundError";
      setCameraStatus(isDenied?"denied":noDevice?"no-device":"idle");
      setStartingSession(false);
      const errMsg=isDenied
        ?(isAr?"تم رفض الوصول للكاميرا — اضغط 'سماح' في المتصفح":"Camera access denied — click Allow in browser bar")
        :noDevice
        ?(isAr?"لا توجد كاميرا — قم بتوصيل كاميرا والمحاولة مجدداً":"No camera detected — connect one and retry")
        :(isAr?"خطأ في الكاميرا":"Camera error — please retry");
      setAlertMsg({text:errMsg,type:"bad"});
      addToast(errMsg,"error");
    }
  }

  const[sessionResult,setSessionResult]=useState(null);
  // requestFullscreen() promotes the camera wrapper into the browser's TOP
  // LAYER, which paints above every stacking context on the page. Nothing in
  // this app can out-rank it: the session-summary modal sits at z-index 2000,
  // the health-consent and calibration dialogs at 9000-10000, toasts at 9999,
  // and in fullscreen all of them render behind the video, invisible and
  // unclickable. Stopping a session while fullscreen therefore saved it and
  // then showed nothing at all — and because sessionResult is only cleared by
  // that modal's own buttons, there was no way out of the state either.
  // Anything that needs to be read or answered drops fullscreen first.
  const _fsBlocking = !!sessionResult || showHealthConsent || showCalibWizard || showUpgrade || showBilling;
  useEffect(()=>{
    if(_fsBlocking && document.fullscreenElement) document.exitFullscreen?.().catch(()=>{});
  },[_fsBlocking]);

  async function stopCamera(){
    // The UI update is throttled to 4Hz during a session, so the last analysed
    // frame may not have reached React yet. Flush it before anything reads
    // `analysis`, or the summary can be built from a reading up to 250ms
    // stale.
    if (lastAnalRef.current) {
      lastUiPushRef.current = 0;
      setAnalysis(lastAnalRef.current);
    }
    // Reentrancy guard: this function isn't actually awaited end-to-end
    // (the Firestore saveSession() call below is fire-and-forget via
    // .then()/.catch(), not awaited) and isSavingSession — the only thing
    // that disables the Stop button — is React state, set asynchronously
    // by this same call. A rapid double-click, or Stop immediately
    // followed by Back, could run this function twice before either of
    // those catches up, and the second call would read the same
    // not-yet-reset hist/avg/session data and fire a SECOND saveSession()
    // for the same session — a duplicate Firestore doc and doubly-applied
    // user stats. stoppingRef is a synchronous ref that closes the race
    // regardless of render timing.
    //
    // It used to be cleared ONLY in beginScoring(), i.e. only when a brand-new
    // session actually started scoring — so after any completed session the
    // flag stayed true and every later stopCamera() early-returned as a silent
    // no-op. Repro: finish a session -> press Start (opens the camera, preview
    // only, camActive still false) -> press Back. backFromLive skips its
    // confirm because camActive is false, calls stopCamera(), which returns
    // immediately: the stream is never stopped and you land on Home with the
    // camera still capturing and the indicator light on, unrecoverable without
    // a reload. It also disabled the browser-back teardown safety net.
    // Now released in the finally below, so it guards only this invocation.
    if(stoppingRef.current) return;
    stoppingRef.current = true;
    try {
    setIsSavingSession(true); // show saving state on stop button
    stopSpeaking(); // cut any in-flight voice-coach cue
    lmSmootherRef.current?.reset();
    frameBufferRef.current?.clear();
    distSmootherRef.current?.reset();
    resetProportions();
    lightCheckRef.current={t:0,canvas:lightCheckRef.current.canvas,wasLow:false};setLowLight(false);
    // Also clear on Stop (not just at the next session's beginScoring()) so
    // the "another person detected" banner doesn't linger on the idle
    // "Start Analysis" screen with the camera off — see the matching reset
    // in beginScoring() for the full bug explanation.
    cueStateRef.current={ key:null, on:0, off:0, shown:null, seen:null };
    blurMissRef.current=0;
    subjectRejectStreakRef.current=0;
    multiPersonShownRef.current=false;
    setMultiPersonWarning(false);
    // Same reasoning as multiPersonWarning above — alertMsg previously stuck
    // at whatever warn/bad message last fired (e.g. "Lighting too low")
    // straight through onto the idle "Start Analysis" screen with the
    // camera off. Reset to the same neutral instruction the app opens with.
    setAlertMsg({text:isAr?"اضبط وضعيتك أمام الكاميرا ثم اضغط ابدأ":"Position yourself in frame, then press Start",type:"info"});
    // Stop camera stream tracks
    if(streamRef.current){
      streamRef.current.getTracks().forEach(x=>{x.stop(); x.enabled=false;});
      streamRef.current = null;
    }
    // Detach srcObject from video element (releases camera indicator light)
    if(vidRef.current && vidRef.current.srcObject){
      vidRef.current.srcObject = null;
    }
    // Cancel animation loop
    if(timerRef.current)clearInterval(timerRef.current);
    if(rafRef.current){cancelAnimationFrame(rafRef.current); rafRef.current=null;}
    // Clear overlay canvas
    if(ovRef.current)ovRef.current.getContext("2d").clearRect(0,0,ovRef.current.width||0,ovRef.current.height||0);
    // Close PoseLandmarker only if it was created locally (not the shared window.__mpPose)
    // We never close window.__mpPose — it's reused across sessions to avoid 3s reload cost
    setCamActive(false);
    setIsPaused(false);
    backendFailRef.current=0;backendFailShownRef.current=false;setBackendDown(false);
    // Settle any open pause BEFORE clearing the marker, exactly as
    // resumeSession does. Stop is enabled while paused (only isSavingSession
    // disables it), and pausedAtRef was simply discarded here — so pausing a
    // 2-minute session, walking away for an hour and hitting Stop & Save wrote
    // duration_s = 62 minutes while the on-screen timer still read 2:00.
    if(pausedAtRef.current && sessRef.current){
      sessRef.current += (Date.now() - pausedAtRef.current);
    }
    pausedAtRef.current=null;
    setPreviewPhase(null);
    // NOTE: the "Saving…" flag is cleared where the write actually settles
    // (the saveSession .then/.catch below), not on a timer. This 1500ms
    // fallback only covers the branches that never call saveSession at all
    // (too-short session, signed out), so the button can't stay stuck.
    setTimeout(()=>setIsSavingSession(false), 1500);
    if(countdownIvRef.current){ clearInterval(countdownIvRef.current); countdownIvRef.current=null; }
    setShowHealthConsent(false);

    // Always save — even if no analysis data (backend offline/MediaPipe not loaded)
    const la  = lastAnalRef.current||{};
    // Full session, not the 40-frame sparkline window (see fullHistRef).
    // Falls back to the sparkline for a session too short to have sampled yet.
    const hist = (fullHistRef.current&&fullHistRef.current.length ? fullHistRef.current : histRef.current)||[];
    // Recency-weighted average: later frames get up to 3× the weight of
    // the earliest frames. This means 45 min of slumping after 5 min of
    // good posture is correctly reflected — not averaged away.
    // Weight grows linearly from 1 (first frame) to 3 (last frame).
    const avg = hist.length ? (() => {
      const n = hist.length;
      let wSum = 0, wTotal = 0;
      hist.forEach((s, i) => {
        const w = 1 + (i / Math.max(n - 1, 1)) * 2; // 1..3
        wSum   += s * w;
        wTotal += w;
      });
      return Math.round(wSum / wTotal);
    })() : 0;
    const dur  = sessRef.current ? Math.floor((Date.now()-sessRef.current)/1000) : 0;
    const gPct = totalRef.current ? Math.round(goodRef.current/totalRef.current*100) : 0;
    // session_fatigue/confidence_val are meta/diagnostic fields the engine
    // attaches to every metrics object, not real posture metrics — without
    // this exclusion they could get picked as the session's "top issue to
    // fix" (e.g. "Detection Confidence — score 62/100"), which is
    // meaningless and unfixable feedback to show right after a session.
    const NON_POSTURAL_METRICS = new Set(["session_fatigue","confidence_val"]);
    const _realMetricEntries = la.metrics ? Object.entries(la.metrics).filter(([k])=>!NON_POSTURAL_METRICS.has(k)) : [];

    const result={
      avg_score:avg,
      duration_s:dur,
      good_pct:gPct,
      alerts_count:acRef.current?.total||0,
      frames:totalRef.current||0,
      top_metric: _realMetricEntries
        .filter(([,v])=>v.score<75)
        .sort(([,a],[,b])=>a.score-b.score)[0] || null,
      grade: avg>=85?"Excellent":avg>=70?"Good":avg>=55?"Fair":"Needs work",
      gradeAr: avg>=85?"ممتاز":avg>=70?"جيد":avg>=55?"مقبول":"يحتاج تحسين",
      color: avg>=75?"#4FAE8E":avg>=50?"#D6A24C":"#C6604F",
      // Trend: compare first vs last 20% of frames
      trend: (()=>{
        if(hist.length<10) return "stable";
        const split=Math.max(3,Math.floor(hist.length/5));
        const early=hist.slice(0,split).reduce((a,b)=>a+b,0)/split;
        const late=hist.slice(-split).reduce((a,b)=>a+b,0)/split;
        const diff=late-early;
        return diff>5?"improving":diff<-5?"declining":"stable";
      })(),
      // Improvement tip for worst metric — specific with actual angles/values
      improvement_tip: (()=>{
        if(!la.metrics) return isAr?"خذ استراحة وضعية كل 30 دقيقة.":"Take a posture break every 30 minutes.";
        const worst=_realMetricEntries.filter(([,v])=>v.score<75).sort(([,a],[,b])=>a.score-b.score)[0];
        if(!worst) return isAr?"وضعيتك ممتازة! استمر.":"Great posture! Keep it up.";
        const [key, m] = worst;
        const val = m.value != null ? Math.round(m.value*10)/10 : null;
        const unit = m.unit || "";
        // Build specific, values-based tip
        const specific = {
          neck_lean:       { en: val!=null?`Neck lean ${val}${unit} — raise monitor ${Math.round(Math.max(5,val*1.5))}cm to bring it to eye level`:"Raise your monitor to eye level",
                             ar: val!=null?`ميل الرقبة ${val}${unit} — ارفع الشاشة ${Math.round(Math.max(5,val*1.5))} سم لمستوى العين`:"ارفع الشاشة لمستوى العين" },
          spine_lean:      { en: val!=null?`Trunk lean ${val}${unit} — push hips to back of chair, engage lumbar support`:"Sit fully back with lumbar support",
                             ar: val!=null?`ميل الجذع ${val}${unit} — ادفع الوركين للخلف في الكرسي واستخدم الدعم القطني`:"اجلس للخلف مع دعم قطني" },
          screen_distance: { en: val!=null?`Screen is ${val}cm — ideal is 50–70cm (${val<50?"move screen further":"move closer"})`:"Move screen to 50–70cm",
                             ar: val!=null?`المسافة ${val}سم — المثالي 50–70 سم (${val<50?"أبعد الشاشة":"اقترب أكثر"})`:"اضبط مسافة الشاشة 50–70 سم" },
          head_tilt:       { en: val!=null?`Head tilting ${val}${unit} — imagine a plumb line through your ear and drop shoulders evenly`:"Level your head — equal weight on both sitting bones",
                             ar: val!=null?`رأسك مائل ${val}${unit} — تخيّل خط رأسي يمر بأذنك وسوّ كتفيك`:"سوّي رأسك وحافظ على التوازن" },
          shoulder_level:  { en: val!=null?`Shoulder imbalance ${val}${unit} — drop the higher shoulder, check armrest height`:"Level armrests so both shoulders sit evenly",
                             ar: val!=null?`عدم توازن الكتفين ${val}${unit} — انزّل الكتف الأعلى واضبط ارتفاع مسند الذراع`:"اضبط مسند الذراع لتسوية الكتفين" },
          rounded_shoulders:{ en: val!=null?`Shoulders rounded ${val}${unit} — pull shoulder blades together and down`:"Pull shoulder blades together and down",
                              ar: val!=null?`كتفان مدوّران ${val}${unit} — اسحب لوحَي الكتف للداخل وللأسفل`:"اسحب كتفيك للداخل وللأسفل" },
          head_yaw:        { en: val!=null?`Head turned ${val}${unit} — reposition monitor or keyboard to face you directly`:"Face your monitor directly — avoid turning head",
                             ar: val!=null?`رأسك مدار ${val}${unit} — حرّك الشاشة أو الكيبورد ليكونا أمامك مباشرة`:"اجعل الشاشة أمامك مباشرة" },
          fhp:             { en: val!=null?`Forward head ${val}cm (+${Math.round((4.5/Math.cos(Math.atan2(val,15))-4.5)*10)/10}kg neck load) — tuck chin, pull head directly above shoulders`:"Tuck chin — ear should be above shoulder",
                             ar: val!=null?`الرأس متقدم ${val}سم — أدخل ذقنك للداخل حتى تكون الأذن فوق الكتف مباشرة`:"أدخل ذقنك — الأذن فوق الكتف" },
        };
        const tipObj = specific[key];
        if(tipObj) return isAr ? tipObj.ar : tipObj.en;
        return isAr?"خذ استراحة كل 30 دقيقة.":"Take a break every 30 minutes.";
      })(),
      // Pain prediction
      pain_summary: (()=>{
        const painMins=la.pain_prediction?.minutes_to_pain;
        if(painMins==null) return null;
        if(painMins<30) return isAr?`⚠️ توقع إزعاج خلال ${Math.round(painMins)} دقيقة — خذ استراحة الآن`:`⚠️ Discomfort likely in ${Math.round(painMins)} min — take a break now`;
        if(painMins<90) return isAr?`~${Math.round(painMins)} دقيقة قبل الإزعاج المحتمل`:`~${Math.round(painMins)} min before likely discomfort`;
        return null;
      })(),
      // No longer captured — see the note in the analysis loop. Kept as an
      // empty array so the summary screen's `?.length>0` guard and any
      // historical session document still render correctly.
      worst_snapshots: [],
      // Snapshotted here so the summary modal's PDF and Share buttons do not
      // have to read histRef/lastAnalRef live — which is what stopped the live
      // page's own session state from being cleared when the session ended.
      score_history: hist.slice(-600),
      // Read by the summary's FindingsPanel: the whole metrics object, so the
      // summary can EXPLAIN the session rather than name its worst number.
      metrics: la.metrics || {},
    };
    // A report on a session that never happened.
    //
    // `dur` is 0 whenever Stop is pressed before beginScoring() set sessRef —
    // the live preview and the 3-2-1 countdown are both inside that window,
    // and so is the case where the user opens Live, thinks better of it, and
    // stops. The modal opened anyway and presented 0/100, "Duration 0:00", 0%
    // good posture and no metrics as if they were measurements. Nothing below
    // 5 seconds is saved either (see the branches underneath), so a session
    // that was not worth recording is not worth reporting on: the "session too
    // short" toast already says what happened.
    if(dur >= 5) setSessionResult(result);
    else setSessionResult(null);
      if(dur >= 5 && (result.avg_score||0)>=70){
        // sessions/name were never set here — ShareCard destructures both
        // and draws them directly onto the card (session count, name
        // badge), so every shared card silently showed "Sessions: 0" and
        // no name regardless of the user's actual data.
        setShareCardData({score:result.avg_score,grade:result.grade,streak:0,
          avgScore:result.avg_score, sessions:(userSessions?.length||0), name:profile?.name||""});
      }

    if(window.__demoMode && dur >= 5){
      // Demo Mode — same analysis engine, but the result is saved to
      // localStorage only (see DemoMode.js), never touches Firestore/auth.
      import("./DemoMode.js").then(({ saveDemoSession }) => {
        saveDemoSession({
          mode, avg_score: avg, good_pct: gPct,
          duration_s: dur, duration_sec: dur,
          alerts_count: acRef.current?.total || 0,
          score_history: hist.slice(-20),
        });
      });
      addToast(isAr?"✅ تم حفظ الجلسة (محلياً)":"✅ Session saved (locally)","success");
    } else if(window.__demoMode && dur < 5){
      if(dur > 0 || totalRef.current > 0)
        addToast(isAr?"الجلسة قصيرة جداً (أقل من 5 ثواني)":"Session too short (under 5s) — not saved","info");
    } else if(user && dur >= 5){ // Save if session lasted at least 5 seconds
      addToast(isAr?"جاري حفظ الجلسة...":"Saving session...","info");
      setIsSavingSession(true);
      // Snapshot the payload synchronously. The .catch below used to rebuild it
      // by re-reading alRef/worstSnapsRef AT REJECTION TIME — and beginScoring
      // now clears those, so starting a new session inside the rejection window
      // (the result modal's "New Session" button fires startCamera 300ms after
      // stop) silently dropped the alerts and snapshots from the queued retry.
      // One object, used for both the write and the retry queue.
      const _sessionPayload = {
        session_id:sessionId, mode, tier:effectiveTier, avg_score:avg,
        good_pct:gPct, duration_s:dur, duration_sec:dur,
        alerts_count:acRef.current?.total||0,
        score_history:hist.slice(-60),
        // score_history is a TAIL slice (and firebase.js caps it again to the
        // last 30), so a session document has only ever carried the final
        // minute of a session at one sample per two seconds. Anything computed
        // from it and described as "across the session" would be measuring the
        // last minute. score_curve is the same 30 points spread across the
        // WHOLE session, so within-session change is actually observable.
        score_curve:decimate(hist, 30),
        score_curve_span_s:dur,
        alert_causes: alRef.current.map(a=>({cause:a.cause||"posture",hour:a.time?.split(":")?.[0]||"0",severity:a.severity||"mild"})), // #9
        metrics:la.metrics||{},
        ai_tip:       la.ai_tip||la.ai_insight||la.claude_analysis||"",
        improvement_tip: result.improvement_tip||"",
        pain_summary:    result.pain_summary||null,
        pain_prediction: la.pain_prediction||null,
        trend:           result.trend||"stable",
        // Elite: worst 3 posture snapshots — only include if total payload
        // stays under ~800KB (Firestore hard-limits docs to 1MB; base64
        // images are the main risk factor that caused silent addDoc failures).
        // REMOVED: worst_snapshots. Base64 webcam JPEGs are no longer
        // captured, so nothing image-shaped is written to Firestore at all.
        // This is what makes "no video or images leave your device" true.
        // (Session documents written before this change may still contain
        // the field; they are the user's own data and still display, but
        // nothing new is created.)
      };
      // The weekly pattern is derived from this session's alerts, which are
      // also reset by the next beginScoring — capture them now too.
      const _alertsAtSave = alRef.current.slice();
      saveSession(user.uid, _sessionPayload).then(()=>{
        setIsSavingSession(false);
        addToast(isAr?"✅ تم حفظ الجلسة":"✅ Session saved","success");
        // Refresh sessions list so the new session appears immediately
        // without waiting for the user to re-login or navigate away.
        if(user) getUserSessions(user.uid).then(setUserSessions).catch(()=>{});
        // #9 Compute weekly pattern from this session's alert causes
        if(_alertsAtSave.length>=3){
          const causeCounts={};
          _alertsAtSave.forEach(a=>{const c=a.cause||"posture";causeCounts[c]=(causeCounts[c]||0)+1;});
          const top=Object.entries(causeCounts).sort(([,a],[,b])=>b-a)[0];
          if(top){
            const[topKey,topCount]=top;
            const pct=Math.round(topCount/_alertsAtSave.length*100);
            const causeLabel={neck:"neck lean",yaw:"head rotation",dist:"screen distance",posture:"general posture"}[topKey]||topKey;
            const hourCounts={};
            _alertsAtSave.filter(a=>(a.cause||"posture")===topKey).forEach(a=>{
              const h=a.time?.split(":")?.[0]||"?";
              hourCounts[h]=(hourCounts[h]||0)+1;
            });
            const peakHour=Object.entries(hourCounts).sort(([,a],[,b])=>b-a)?.[0]?.[0];
            setWeeklyPattern({
              summary:isAr
                ?`${pct}% من تنبيهات هذه الجلسة كانت ${causeLabel}${peakHour?` — معظمها الساعة ${peakHour}:00`:""}. ده ممكن يكون موضع الشاشة أو تعب.`
                :`${pct}% of alerts this session were ${causeLabel}${peakHour?` — mostly around ${peakHour}:00`:""}. Likely monitor position or fatigue.`,
              topCause:causeLabel,
              pct,
              tip:isAr?"راجع ارتفاع الشاشة ومسافتها في بداية كل جلسة.":"Check monitor height and distance at the start of each session.",
            });
          }
        }
      }).catch(e=>{
        setIsSavingSession(false);
        console.error("saveSession failed:", e?.code, e?.message);
        // Firestore's persistent cache (see firebase.js) now absorbs most
        // transient network failures automatically, but for whatever still
        // gets here (quota, permission, doc-too-large) the session's data
        // used to just be gone with only an error toast to show for it.
        // Queue it in localStorage and retry automatically next time this
        // user's session list loads (see flushPendingSessions below).
        try{
          const key="corvus_pending_sessions";
          const queue=JSON.parse(localStorage.getItem(key)||"[]");
          // Same object that was sent, captured before the write — not rebuilt
          // from refs that a newly started session may already have cleared.
          queue.push({uid:user.uid,data:_sessionPayload,queuedAt:Date.now()});
          localStorage.setItem(key, JSON.stringify(queue.slice(-10))); // cap at 10 pending
          // The code goes in the message. It used to reach only console.error,
          // so a user reporting "my sessions aren't saving" could not tell
          // anyone WHY, and neither could we — permission-denied,
          // resource-exhausted and a rejected write all looked identical.
          const _code = e?.code || e?.message || "unknown";
          addToast(isAr
            ? `⚠️ فشل حفظ الجلسة (${_code}) — محفوظة عندك وهنحاول تاني`
            : `⚠️ Session save failed (${_code}) — kept locally, will retry`, "warn");
        }catch{
          addToast("❌ Save failed: "+(e?.code||e?.message||"unknown"),"error");
        }
      });
    } else if(user && dur < 5){
      // dur===0 with no frames means scoring never began — the user backed out
      // of the preview or the countdown. Nothing was cut short, so there is
      // nothing to apologise for; telling them their session was "too short"
      // implies they lost something they never started.
      if(dur > 0 || totalRef.current > 0){
        addToast(isAr?"الجلسة قصيرة جداً (أقل من 5 ثواني)":"Session too short (under 5s) — not saved","info");
      }
    } else if(!user){
      if(dur > 0 || totalRef.current > 0)
        addToast(isAr?"غير مسجل الدخول":"Not signed in — not saved","error");
    }
    } finally {
      // The session clock is over. It was left set, and both PDF paths
      // recompute duration live from it (`Date.now() - sessRef.current`), with
      // the `sessionResult.duration_s` fallback unreachable because the ref
      // stayed truthy — so exporting a PDF ten minutes after a five-minute
      // session printed fifteen minutes, growing for as long as the tab stayed
      // open. Clearing it here makes those paths fall back to the real
      // recorded duration.
      sessRef.current = null;

      // The session was over in the data and still running on the screen.
      //
      // Every per-session counter — history, good/total frames, alert list,
      // alert counts, the session clock — was reset only by beginScoring(), at
      // the START of the next session. So after Stop & Save the Live page went
      // on showing the finished session in full: the Session Summary tiles,
      // the score-history chart and the alert log, with nothing to say it had
      // ended. Reported as "I come back and I'm in the same session even
      // though I ended it" — and that is exactly what it looks like, because
      // the only thing that changes is a modal you can dismiss.
      //
      // Cleared here instead, now that `result` and the save payload above are
      // both snapshots and the summary modal reads its PDF/Share data from
      // sessionResult rather than from these refs.
      histRef.current=[]; setHistory([]);
      fullHistRef.current=[]; fullHistLastMsRef.current=0;
      goodRef.current=0; setGoodF(0);
      totalRef.current=0; setTotalF(0);
      acRef.current={total:0,neck:0,dist:0}; setAlertCounts({total:0,neck:0,dist:0});
      alRef.current=[]; setAlerts([]);
      setSessionTime(0);
      setScoreStatus(null);
      // `analysis` drives the live metrics list and the on-video panel. Left
      // set, it kept describing the finished session on an idle page.
      // lastAnalRef is deliberately NOT cleared — the summary modal's PDF and
      // Share still read it.
      setAnalysis(null);
      setSessionInsights([]); insightsRef.current=null;

      // Release the reentrancy guard for THIS invocation. Anything that throws
      // above must not leave the flag stuck true, or every subsequent stop —
      // including the browser-back camera teardown — becomes a no-op and the
      // camera keeps running.
      stoppingRef.current = false;
    }
  } // end stopCamera

  // Back button while ACTIVELY scoring (not paused, not idle) used to
  // silently end + save the session with zero warning — an easy accidental
  // click away, given it's the very first button in the top-left corner.
  // Paused/idle sessions skip the confirm since the user already
  // deliberately stepped away.
  function backFromLive(){
    if(camActive && !isPaused){
      const ok=window.confirm(isAr
        ?"الجلسة شغالة دلوقتي. تأكيد الرجوع هيوقف الجلسة ويحفظها. متأكد؟"
        :"Your session is currently running. Going back will stop and save it. Continue?");
      if(!ok) return;
    }
    const hadSession = camActive;
    stopCamera();
    setPage("home");
    setCamActive(false);
    // stopCamera() sets sessionResult, but the summary modal is only mounted in
    // the live branch — and sessionResult is only cleared by that modal's own
    // buttons. Leaving via Back therefore saved the session but never showed
    // the summary, AND left the stale modal armed so it popped over the page
    // the next time the user opened Live. Clear it here and confirm the save
    // with a toast instead, so nothing is silently swallowed or deferred.
    if(hadSession){
      setSessionResult(null);
      addToast(isAr?"اتحفظت الجلسة":"Session saved","success");
    }
  }

  // Freezes analysis + the session timer WITHOUT ending/saving the session.
  // Camera stream stays attached (video keeps showing) — resuming just
  // restarts the loop, no re-request, no permission prompt again.
  function pauseSession(){
    if(!camActive || isPaused) return;
    if(rafRef.current){ cancelAnimationFrame(rafRef.current); rafRef.current=null; }
    if(timerRef.current){ clearInterval(timerRef.current); timerRef.current=null; }
    // Freeze the actual video *playback* too, not just the analysis loop.
    // vidRef keeps its live srcObject either way (camera hardware stays on,
    // resume never re-requests permission) — but without this, the feed
    // visibly kept moving under the "Session paused" overlay, which reads
    // as "pause did nothing, the camera/analysis is still running" even
    // though scoring had genuinely stopped underneath.
    try{ vidRef.current?.pause?.(); }catch{}
    // A cue queued a moment before Pause kept talking over the "Session
    // paused" overlay — the one thing pause is meant to guarantee.
    stopSpeaking();
    pausedAtRef.current = Date.now();
    setIsPaused(true);
  }

  // Wire goToBreak (declared far above, before these functions exist) to the
  // real pauseSession, so navigating to the break page freezes the session and
  // its timer instead of abandoning it with the camera running.
  useEffect(()=>{ pauseForBreakRef.current = () => { if(camActive && !isPaused) pauseSession(); }; });

  // Every navigation away from Live that does NOT go through backFromLive().
  //
  // Only two things ever stopped the camera: the in-app Back button, and the
  // popstate listener for the browser/hardware back button. setPage() uses
  // pushState, which does not fire popstate — so every other way off this page
  // left the stream running with the OS indicator light on and the rAF loop
  // burning CPU behind whatever screen the user landed on. That includes the
  // session-summary modal's own "Dashboard" button, the header/sidebar nav, the
  // upgrade and billing redirects, and anything else that calls setPage.
  //
  // "break" is deliberately exempt: goToBreak() pauses the session and keeps
  // the stream attached so returning does not re-prompt for camera permission
  // (see the effect directly below, which re-attaches it).
  useEffect(()=>{
    if(page==="live" || page==="break") return;
    if(!camActiveRef.current && !streamRef.current) return;
    const hadSession = camActiveRef.current;
    stopCamera();
    // stopCamera() arms the summary modal, which is only mounted in the live
    // branch — same reasoning as backFromLive(), which confirms the save with a
    // toast instead and clears the modal so it cannot pop over an unrelated
    // page later.
    if(hadSession){
      setSessionResult(null);
      addToast(isAr?"اتحفظت الجلسة":"Session saved","success");
    }
    setShowHealthConsent(false);
    setPreviewPhase(null);
  },[page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Last resort: the whole app unmounting (route swap, hot reload, an
  // ErrorBoundary swallowing this subtree) with a stream still open. Nothing
  // above can catch that, and the result is a camera light that stays on with
  // no UI left anywhere to turn it off.
  useEffect(()=>()=>{
    try{ streamRef.current?.getTracks?.().forEach(t=>{t.stop();t.enabled=false;}); }catch{}
    streamRef.current=null;
  },[]);

  // Returning from the break page remounts the <video>, which comes back with
  // no srcObject — the stream object itself is still live in streamRef. Without
  // this the feed was permanently black while the UI still claimed to be live.
  useEffect(()=>{
    if(page!=="live") return;
    const v=vidRef.current, st=streamRef.current;
    if(!v || !st || v.srcObject) return;
    // Only re-attach a stream whose tracks are still usable.
    if(!st.getVideoTracks?.().some(t=>t.readyState==="live")) return;
    v.srcObject=st;
    if(!isPaused) { try{ v.play?.().catch(()=>{}); }catch{} }
  },[page,isPaused]);

  function resumeSession(){
    // Reentrancy guard: isPaused is React state, so a genuine double-click
    // can fire this twice with both invocations still reading the same
    // stale (pre-render) isPaused===true closure — each would then create
    // its own setInterval + requestAnimationFrame(runLoop) below, and the
    // second call's refs silently overwrite the first's without cancelling
    // them, leaking an uncancellable duplicate timer/analysis loop that
    // outlives the session. pausedAtRef is a ref (always current, no
    // batching lag) and is cleared synchronously below, so checking —
    // and clearing — it here is what actually closes the race.
    if(!camActive || !pausedAtRef.current) return;
    // Shift the session's start timestamp forward by however long the
    // pause lasted, so sessionTime keeps counting from where it left off
    // instead of jumping ahead by the paused duration.
    sessRef.current += (Date.now() - pausedAtRef.current);
    pausedAtRef.current = null;
    try{ vidRef.current?.play?.().catch(()=>{}); }catch{}
    setIsPaused(false);
    timerRef.current=setInterval(()=>{
      const elapsed=Math.floor((Date.now()-sessRef.current)/1000);
      setSessionTime(elapsed);
      // Break reminder itself is handled by the real useBreakTimer hook
      // (breakIntervalMin-aware) — see the showBreak effect near isAr/dir.
    },1000);
    rafRef.current=requestAnimationFrame(runLoop);
  }


  // ── Switch camera mode from the live page ───────────────────────
  // Previously the mode (laptop/phone/side) could only be chosen on the
  // setup screen — users had to leave the session to change it. This lets
  // them switch on the fly; when a session is running we reset the analysis
  // buffers so the new mode (front vs side use different maths) starts clean.
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
        addToast(isAr ? "تعذر تبديل الحساب — جرب تاني" : "Couldn't switch accounts — try again", "error");
      }
    }
  }

  async function shareReport(sessionData) {
    const _eTier = effectiveTier || tier;
    const normalizedTier = _eTier?.includes?.("elite") ? "elite" : _eTier?.includes?.("pro") ? "professional" : _eTier;
    if (!tierAtLeast(normalizedTier,"elite")) {
      addToast(isAr?"المشاركة متاحة لباقة Elite فقط":"Shareable reports require Elite tier","warn");
      setShowBilling(true); return;
    }
    addToast(isAr?"جاري إنشاء الرابط...":"Creating share link...","info");
    try {
      const { createShareableReport } = await import("./firebase.js");
      const { url, expiresAt } = await createShareableReport({
        session: sessionData, profile, user, lang,
        allSessions: userSessions,
        effectiveTier: normalizedTier,
      });
      // Copy to clipboard
      await navigator.clipboard.writeText(url).catch(()=>{});
      addToast(isAr?`✅ الرابط جاهز — تم النسخ! (صالح 30 يوم)`:`✅ Link ready — copied! (expires in 30 days)`,"success");
      // Also open the report in a new tab
      window.open(url,"_blank","noopener");
    } catch(e) {
      console.error("[Share]", e);
      addToast(isAr?"تعذر إنشاء الرابط — جرب تاني":"Couldn't create the link — try again","error");
    }
  }

  async function downloadLongitudinalPDF() {
    if (!tierAtLeast(effectiveTier,"elite")) {
      addToast(isAr?"التقرير الطولي متاح لباقة Elite فقط":"Longitudinal report requires Elite tier","warn");
      setShowBilling(true); return;
    }
    if (userSessions.length < 5) {
      addToast(isAr?"محتاج 5 جلسات على الأقل للتقرير الطولي":"Need at least 5 sessions for longitudinal report","warn");
      return;
    }
    addToast(isAr?"جاري إنشاء التقرير الطولي...":"Generating longitudinal report...","info");
    try {
      const { generateLongitudinalPDF } = await import("./lib/pdfReports.js");
      await generateLongitudinalPDF({ sessions: userSessions, profile, aiSummary: "" });
      addToast(isAr?"✅ تم تحميل التقرير الطولي":"✅ Longitudinal PDF downloaded","success");
    } catch(e) {
      console.error("[Longitudinal PDF]", e);
      addToast(isAr?"تعذر إنشاء التقرير الطولي — جرب تاني":"Couldn't generate the longitudinal report — try again", "error");
    }
  }

  async function downloadPostureDNAReport() {
    if (!tierAtLeast(effectiveTier,"elite")) {
      addToast(isAr?"تقرير بصمة الوضعية متاح لباقة Elite فقط":"Posture DNA report requires Elite tier","warn");
      setShowBilling(true); return;
    }
    addToast(isAr?"جاري تحليل بيانات آخر 90 يوم...":"Analyzing your last 90 days of data...","info");
    try {
      const { generatePostureDNAReport } = await import("./lib/pdfReports.js");
      await generatePostureDNAReport({ sessions: userSessions, profile, user, profession: profile?.profession || "other", lang });
      addToast(isAr?"✅ تم تحميل تقرير بصمة الوضعية":"✅ Posture DNA report downloaded","success");
    } catch(e) {
      console.error("[Posture DNA PDF]", e);
      addToast((isAr?"تعذر إنشاء التقرير: ":"Couldn't generate the report: ")+(e?.message||String(e)), "error");
    }
  }

  async function downloadComparisonPDF(session1, session2) {
    if (!tierAtLeast(effectiveTier,"professional")) {
      addToast(isAr?"المقارنة متاحة لباقة Pro وElite فقط":"Comparison PDF requires Pro or Elite","warn");
      setShowBilling(true); return;
    }
    if (!session1 || !session2) {
      addToast(isAr?"محتاج جلستين على الأقل للمقارنة":"Need at least 2 sessions to compare","warn");
      return;
    }
    addToast(isAr?"جاري إنشاء تقرير المقارنة...":"Generating comparison PDF...","info");
    try {
      const { generateComparisonPDF } = await import("./lib/pdfReports.js");
      await generateComparisonPDF({ session1, session2, sessions: userSessions, profile, lang: isAr?"ar":"en", aiSummary: "" });
      addToast(isAr?"✅ تم تحميل تقرير المقارنة":"✅ Comparison PDF downloaded","success");
    } catch(e) {
      console.error("[Comparison PDF]", e);
      addToast(isAr?"تعذر إنشاء تقرير المقارنة — جرب تاني":"Couldn't generate the comparison report — try again", "error");
    }
  }

  async function downloadTeamPDF() {
    if (!tierAtLeast(effectiveTier,"professional")) {
      addToast(isAr?"تقرير الفريق متاح لـ HR Admin فقط":"Team PDF requires HR Admin + Pro","warn");
      setShowBilling(true); return;
    }
    if (!allUsers || allUsers.length===0) {
      addToast(isAr?"لا يوجد أعضاء فريق محمّلين بعد":"No team members loaded yet","warn");
      return;
    }
    addToast(isAr?"جاري إنشاء تقرير الفريق...":"Generating team PDF...","info");
    try {
      const { generateTeamPDF } = await import("./lib/pdfReports.js");
      const teamUsers = allUsers.map(u => ({ ...u, last_session: u.last_session_at || u.last_session }));
      await generateTeamPDF({ users: teamUsers, company: profile?.company||profile?.company_name||(isAr?"الشركة":"Company"), dateRange: 30, profile, lang: isAr?"ar":"en" });
      addToast(isAr?"✅ تم تحميل تقرير الفريق":"✅ Team PDF downloaded","success");
    } catch(e) {
      console.error("[Team PDF]", e);
      addToast(isAr?"تعذر إنشاء تقرير الفريق — جرب تاني":"Couldn't generate the team report — try again","error");
    }
  }

async function downloadPDF(sessionOverride, isClinical=false){
    // Was (tier||"standard") — raw tier state, not effectiveTier, so a
    // trial Elite/Pro user (whose entitlement only lives in
    // profile.trial_tier, which raw `tier` never reflects) got wrongly
    // blocked from PDF/Clinical PDF export here even though the inline
    // Download-PDF button elsewhere on this same page already correctly
    // uses qualityFor(effectiveTier) for the identical check.
    const normTier = (effectiveTier||"standard").toLowerCase();
    const isEliteTier = tierAtLeast(normTier,"elite");
    const isProTier   = tierAtLeast(normTier,"professional");

    // Clinical PDF: Elite only — check first, before pdfDetail gate
    if (isClinical && !isEliteTier) {
      addToast(isAr?"التقرير الطبي متاح لباقة Elite فقط":"Clinical PDF requires Elite tier","warn");
      setShowBilling(true);
      return;
    }

    // pdfDetail gate — standard/basic get no PDF (except clinical already gated above)
    if(qualityFor(normTier).pdfDetail === "none" && !isClinical){
      addToast(isAr?"تصدير PDF متاح من خطة Professional فأعلى":"PDF export requires Professional plan or higher","warn");
      setShowUpgrade?.(true); setUpgradeReason?.(isAr?"تصدير PDF":"PDF export");
      return;
    }

    // Non-clinical PDF: Pro+ gate
    if (!isClinical && !isProTier && !sessionOverride) {
      addToast(isAr?"PDF متاح لباقة Pro وElite فقط — قم بالترقية":"PDF available on Pro & Elite — upgrade to download","warn");
      setShowBilling(true);
      return;
    }

    const la=lastAnalRef.current||{};
    const hist    = (fullHistRef.current?.length ? fullHistRef.current : histRef.current) || history || [];
    const durS    = sessRef.current ? Math.floor((Date.now()-sessRef.current)/1000) : (sessionResult?.duration_s ?? 0);
    const gPctPDF = totalRef.current ? Math.round(goodRef.current/totalRef.current*100) : (sessionResult?.good_pct ?? 0);

    if(!sessionOverride && hist.length===0 && !userSessions?.length){
      addToast(isAr?"ابدأ جلسة أولاً لتنزيل PDF":"No session data yet","warn"); return;
    }

    // For Elite — generate AI tip in background (non-blocking for PDF)
    let aiTip = la.ai_tip||la.ai_insight||la.claude_analysis||"";
    if (isEliteTier && !sessionOverride && !aiTip && avg>0) {
      // Fire and forget — PDF generates immediately, AI tip added if it arrives fast enough
      const aiPromise = (async()=>{
        try {
          const { geminiAnalysis } = await import("./gemini.js");
          const topMetrics = Object.entries(la.metrics||{})
            .filter(([k,v])=>v?.score!==undefined && !["session_fatigue","confidence_val"].includes(k))
            .sort(([,a],[,b])=>(a.score??100)-(b.score??100))
            .slice(0,3)
            .map(([k,v])=>`${k}: score ${Math.round(v.score)}, value ${v.value}${v.unit||""}`)
            .join("; ");
          return await geminiAnalysis(
            `Posture session: score ${avg}/100, duration ${Math.round(durS/60)}min, ` +
            `good posture ${gPctPDF}%, alerts ${alRef.current?.length||0}. ` +
            `Worst metrics: ${topMetrics}. ` +
            `Write a 2-3 sentence clinical-style posture analysis and personalised recommendation. ` +
            `Be specific, professional, and actionable. No bullet points.`
          );
        } catch { return ""; }
      })();
      // Wait max 4s for AI tip — then proceed without it
      aiTip = await Promise.race([aiPromise, new Promise(r=>setTimeout(()=>r(""),4000))]);
    }

    const sessionData = sessionOverride || {
      session_id: sessionId,
      avg_score: avg,
      good_pct: gPctPDF,
      duration_s: durS,
      score_history: hist,
      score_curve: decimate(hist, 30),   // whole-session shape; see the note at the other save site
      score_curve_span_s: durS,
      alerts_count: alRef.current?.length||0,
      metrics: la.metrics||{},
      tier, mode,
      created_at: new Date(),
      ai_tip:          aiTip,
      improvement_tip: la.improvement_tip||"",
      pain_summary:    la.pain_prediction?.minutes_to_pain < 90
        ? (isAr?`⚠️ توقع إزعاج خلال ${Math.round(la.pain_prediction.minutes_to_pain)} دقيقة`
                :`⚠️ Discomfort in ~${Math.round(la.pain_prediction.minutes_to_pain)} min`)
        : null,
      pain_prediction: la.pain_prediction||null,
    };

    addToast(isClinical
      ? (isAr?"جاري إنشاء التقرير الطبي...":"Generating Clinical PDF...")
      : (isAr?"جاري إنشاء الـ PDF...":"Generating PDF..."), "info");

    try{
      const { generateSessionPDF, generateClinicalPDF } = await import("./lib/pdfReports.js");
      const fn = isClinical ? generateClinicalPDF : generateSessionPDF;
      await fn({
        session: sessionData,
        sessions: userSessions,
        profile: { ...profile, tier: effectiveTier },
        allSessions: userSessions,
        aiSummary: sessionData.ai_tip || sessionData.ai_insight || "",
      });
      addToast(isClinical
        ? (isAr?"✅ تم تحميل التقرير الطبي":"✅ Clinical PDF downloaded")
        : (isAr?"✅ تم تحميل الـ PDF":"✅ PDF downloaded"), "success");
    }catch(err){
      console.error("PDF error:",err);
      addToast(isAr?"تعذر تحميل الـ PDF — جرب تاني":"Couldn't download the PDF — try again","error");
    }
  }

  const score=analysis?.overall||0;
  const gPct=totalRef.current?Math.round(goodRef.current/totalRef.current*100):0;
  const avg=history.length?Math.round(history.reduce((a,b)=>a+b,0)/history.length):0;
  const distCm=analysis?.distCm||(analysis?.metrics?.distance?.value)||null;
  // ── Role Detection ─────────────────────────────────────────────
  // platform_admin: is_admin=true in Firestore (set manually, never by client)
  const isAdmin   = profile?.is_admin === true;
  // hr_admin: org owner OR explicitly set as HR OR signed up as company
  // Was also `|| profile?.acct_type === "company"` — but every EMPLOYEE
  // profile is written with acct_type:"company" too (see the onboarding
  // write below and org-invite.js's accept handler: both set
  // acct_type:"company" for employees AND hr_admins alike, distinguishing
  // them only via user_type/is_org_owner/is_hr). That made this condition
  // true for every employee, not just HR admins, so every company employee
  // was silently treated as an HR admin app-wide (this flows straight into
  // HomePage.jsx's role() router too) — full, unfiltered access to
  // Invite/Billing/Workforce Analytics/team rosters/the alert-dispatch
  // tool, and every coworker's posture data with none of the field-
  // stripping real employees are supposed to get. The three remaining
  // conditions already fully cover "is HR admin" — every HR-admin-signup
  // path sets user_type:"hr_admin" AND is_org_owner:true together with
  // acct_type, so this line drops zero real HR admins.
  const isHRAdmin = isAdmin
    || profile?.is_org_owner === true
    || profile?.user_type === "hr_admin"
    || profile?.is_hr === true
    || (HR_EMAILS||[]).includes(user?.email||"");
  // employee: has company_id but NOT hr_admin → role() handles this
  // individual: no company_id, not HR → role() default

  // Shared props
  const shared={cs,t,darkMode,setDarkMode,lang,setLang,addToast};

  // ── ROUTING ───────────────────────────────────────────────────────
  if(!authChecked)return(
    <div style={{
      minHeight:"100vh",
      background: darkMode ? "#040d1a" : "#f8fafc",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'IBM Plex Sans Arabic','DM Sans',system-ui,-apple-system,sans-serif",
    }}>
      <style>{`
        @keyframes splash-in  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bar-fill   { from{transform:scaleX(0)} to{transform:scaleX(.72)} }
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
          height: "100%", width:"100%", transformOrigin:"0% 50%",
          background: "linear-gradient(90deg,#1a56db,#0891b2)",
          borderRadius: 99,
          animation: "bar-fill 2.8s cubic-bezier(.4,0,.2,1) forwards",
        }}/>
      </div>
    </div>
  );

  if(paymentResult)return <PaymentResultScreen result={paymentResult} cs={cs} lang={lang} onContinue={()=>setPaymentResult(null)}/>;
  if(page==="landing")return <ErrorBoundary><Landing {...shared} onStart={()=>setPage(user?"setup":"auth")} lang={lang} setLang={setLang} darkMode={darkMode} setDarkMode={setDarkMode}/></ErrorBoundary>;
  // ── Demo Mode — completely isolated, no auth, no Firestore ─────
  // window.__demoMode flags the live-session save logic to write to
  // localStorage (via DemoMode.js) instead of calling saveSession()/Firestore.
  if(page==="demo")return(
    <ErrorBoundary>
      <DemoWelcome isAr={isAr}
        onBack={()=>setPage("landing")}
        onStart={()=>{ window.__demoMode=true; setPage("demo_dashboard"); }}
      />
    </ErrorBoundary>
  );
  if(page==="demo_dashboard")return(
    <ErrorBoundary>
      <DemoDashboard isAr={isAr}
        onStartSession={()=>{
          // The live page requires an authenticated user (see the guard further
          // down: `page==="live" && (!user||!profile)` returns null). A demo
          // visitor has neither, so sending them there rendered a blank page
          // while startCamera() went on to open the camera against a <video>
          // that was never mounted — white screen, camera light on, no controls.
          // Route them to sign-up instead of a dead end.
          if(!user||!profile){ setPage("auth"); return; }
          window.__demoMode=true; setPage("live"); setTimeout(()=>startCamera(),200);
        }}
        onExit={()=>clearDemoOnExit(setPage)}
        onUpgrade={()=>{ clearDemoOnExit(()=>{}); window.__demoMode=false; setPage("auth"); }}
      />
    </ErrorBoundary>
  );
  if(page==="embed")return <EmbedWidget/>;
  if(page==="break")return(
    <ErrorBoundary>
      <BreakPage cs={cs} lang={lang} muted={muted}
        alertCauses={(alRef.current||[]).map(a=>a?.cause).filter(Boolean)}
        onExit={()=>setPage(breakReturnPage||"live")}/>
    </ErrorBoundary>
  );

  // ── Trial expired gate ──────────────────────────────────────────────
  const trialExpired = user && profile && !profile.is_trial &&
    profile.tier === "standard" &&
    profile.created_at &&
    !profile.is_admin;

  // Check if user ever had a trial (created_at exists = they went through signup)
  const hadTrial = profile?.email_day2_sent !== undefined ||
    (profile?.created_at && profile?.sessions_count >= 0);

  if (trialExpired && hadTrial && page === "home") return (
    <ErrorBoundary>
      <TrialExpiredPage
        profile={profile}
        darkMode={darkMode}
        lang={lang}
        cs={cs}
        onUpgrade={(planId)=>{
          setDeepPlan(planId);
          setShowBilling(true);
        }}
        onLogout={async()=>{
          await logOut();
          setUser(null);
          setProfile(null);
          setPage("landing");
        }}
      />
      {/* This whole block is an early return that bails out of the normal
          home/live render entirely — so it never reaches the BillingModal
          mount down in the "home" branch below. onUpgrade above set
          showBilling=true, but with no BillingModal anywhere in THIS
          tree, clicking "Upgrade" here did nothing: trialExpired is a
          plain derived const re-evaluated every render (recomputed from
          profile.tier==="standard"), and the only thing that ever clears
          it is BillingModal's onSuccess calling setTier(...) — which
          could never run because the modal it lives on never mounted. A
          standard-tier user whose trial expired was permanently stuck on
          this screen with a literally-dead Upgrade button. */}
      {showBilling&&<ErrorBoundary key="billing-trialexpired"><BillingModal profile={profile} currentPlan={tier} cs={cs} lang={lang} onClose={()=>setShowBilling(false)} onSuccess={async(plan)=>{
        const newTier = normalizeTier(plan);
        setShowBilling(false);
        // The success toast used to fire BEFORE the write, and the write's
        // only failure handling was a console.warn. `tier` is on the
        // noPrivilegeEscalation blocklist in firestore.rules, so the client
        // write is DENIED — the user saw "Plan updated", kept the unlocked
        // UI from setTier() until they reloaded, and then silently landed
        // back on the trial-expired screen. Claim success only if it stuck.
        let persisted = false;
        if(user?.uid){
          try{
            const{doc:_d,updateDoc:_u,serverTimestamp:_s}=await import("firebase/firestore");
            const{db:_db}=await import("./firebase.js");
            await _u(_d(_db,"users",user.uid),{
              tier: newTier,
              tier_updated_at: new Date().toISOString(),
              updated_at: _s(),
            });
            setProfile(p=>p?({...p,tier:newTier}):p);
            persisted = true;
          }catch(e){ console.warn("tier update failed",e?.code); }
        }
        if(persisted){
          setTier(newTier);
          addToast(isAr?"✅ تم تحديث خطتك":"✅ Plan updated","success");
        }else{
          addToast(isAr
            ?"تم استلام الدفع، لكن تفعيل الخطة محتاج يتم من عندنا. كلّمنا وهنفعّلها فوراً."
            :"Payment received, but the plan has to be activated on our side. Contact us and we'll switch it on right away.","error");
        }
        if(user?.uid){
          getUserProfile(user.uid).then(p=>{
            if(p){ setProfile(p); if(p.tier) setTier(normalizeTier(p.tier)); }
          }).catch(()=>{});
        }
      }}/></ErrorBoundary>}
    </ErrorBoundary>
  );

  // ── Firebase action URL: password reset from email link ──────────
  if(fbMode==="resetPassword" && fbOobCode) return(
    <ErrorBoundary>
      <ResetPasswordPage
        oobCode={fbOobCode} darkMode={darkMode} lang={lang}
        onDone={()=>{
          // Clear URL params and go to auth
          window.history.replaceState({},""," /");
          window.location.href="/?mode=resetDone";
        }}
      />
    </ErrorBoundary>
  );

  // ── Firebase action URL: email verification from email link ──────
  if(fbMode==="verifyEmail" && fbOobCode) return(
    <ErrorBoundary>
      <EmailVerificationPage
        oobCode={fbOobCode} darkMode={darkMode} lang={lang}
        onVerified={()=>{ window.history.replaceState({},""," /"); setPage("home"); }}
        onSkip={()=>{ window.history.replaceState({},""," /"); setPage("home"); }}
      />
    </ErrorBoundary>
  );

  // ── Email verification after signup ──────────────────────────────
  if(showEmailVerify && user && !user.emailVerified) return(
    <ErrorBoundary>
      <EmailVerificationPage
        user={user} darkMode={darkMode} lang={lang}
        onVerified={()=>setShowEmailVerify(false)}
        onSkip={()=>setShowEmailVerify(false)}
      />
    </ErrorBoundary>
  );

  // ── Auth page ────────────────────────────────────────────────────
  if(page==="auth"&&!user) return(
    <ErrorBoundary>
      <AuthPage
        darkMode={darkMode} setDarkMode={setDarkMode}
        lang={lang} setLang={setLang}
        initialView={authMode}
        planLabel={deepPlanLabel}
        onAuth={(u,isNew)=>{
          setUser(u);
          if(isNew) {
            // Send verification email for new signups (fire & forget)
            import("./firebase.js").then(({sendVerificationEmail})=>{
              sendVerificationEmail(u).catch(e=>console.warn("[VerifyEmail]",e.message));
            });
            setShowEmailVerify(true);
            // Let onAuthStateChanged handle routing — it will read the
            // profile we just created and go to setup automatically.
            // Don't setPage here — avoids race where profile isn't loaded yet.
            return;
          }
          // Existing user — onAuthStateChanged will route to home.
          // setPage("home") here as a fast-path for immediate feedback.
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
          // Clear ?invite=TOKEN from the URL — otherwise ANY later reload
          // (manual refresh, SW update, or the stale-chunk auto-reload)
          // re-reads the same URL and replays this entire consent flow
          // again, unprompted, however far into the app the user is by then.
          window.history.replaceState({}, "", window.location.pathname + window.location.hash);
          setCompanyId(company_id);
          if(profile) setProfile(p=>({...p,company_id,role}));
          setPage("home");
          addToast(isAr?"✅ انضممت للفريق!":"✅ Joined the team!","success");
        }}
        onError={()=>{
          delete window.__invite_token;
          window.history.replaceState({}, "", window.location.pathname + window.location.hash);
          setPage("home");
        }}
      />
    </ErrorBoundary>
  );

  // During OAuth redirect: user is temporarily null — show spinner NOT auth page
  if(!user && (_oauthInProgress.current || _oauthRedirect?.current)) return(
    <div style={{
      minHeight:"100vh",background:cs.bg,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      gap:16,fontFamily:"'IBM Plex Sans Arabic','Inter',system-ui,sans-serif",
    }}>
      <div style={{
        width:48,height:48,borderRadius:13,
        background:"linear-gradient(135deg,#1a56db,#0891b2)",
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
        boxShadow:"0 8px 24px rgba(26,86,219,.3)",marginBottom:8,
      }}>◈</div>
      <div style={{width:32,height:32,border:"3px solid rgba(26,86,219,.2)",borderTopColor:"#1a56db",
        borderRadius:"50%",animation:"authSpin 1s linear infinite"}}/>
      <div style={{color:cs.muted,fontSize:14}}>
        {lang==="ar"?"جاري تسجيل الدخول…":"Signing you in…"}
      </div>
      <style>{"@keyframes authSpin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );

  // ── Public pages — accessible without login ─────────────────────────
  // IMPORTANT: these must come BEFORE the !user guard below, otherwise
  // visitors are always redirected to AuthPage before they can see pricing.
  if(!user && (page==="pricing" || page==="enterprise" || page==="landing")) {
    if(page==="pricing") return(
      <ErrorBoundary>
        <PricingPage
          cs={cs} lang={lang} isAr={isAr} dir={dir}
          profile={null} darkMode={darkMode}
          onBack={()=>{ window.location.hash=""; setPage("auth"); }}
          onSelectPlan={()=>{ setPage("auth"); }}
          // deepPlan/deepBilling come from the ?plan=&billing= URL params
          // (parsed above) — pre-select the right segment/billing cycle and
          // highlight the linked-to plan instead of always dropping the
          // visitor on the default B2C-monthly view regardless of which
          // marketing link they actually clicked.
          defaultSeg={deepPlan && B2B_TIERS[deepPlan] ? "b2b" : "b2c"}
          defaultBilling={deepBilling}
          highlightPlanId={deepPlan}
        />
      </ErrorBoundary>
    );
    // enterprise / landing fall through to AuthPage with hash preserved
  }

  if(!user)return(
    <ErrorBoundary>
      <AuthPage
        darkMode={darkMode} setDarkMode={setDarkMode}
        lang={lang} setLang={setLang}
        initialView={authMode}
        planLabel={deepPlanLabel}
        onAuth={(u,isNew)=>{
          setUser(u);
          if(isNew){ /* onAuthStateChanged will route to setup */ return;}
          setPage("home");
        }}
      />
    </ErrorBoundary>
  );

  if(mfaChallengePending)return(
    <ErrorBoundary>
      <MFALoginChallenge
        user={user} profile={profile} cs={cs} lang={lang}
        onVerified={()=>{
          try{ sessionStorage.setItem(`mfa_verified_${user.uid}`,"1"); }catch{}
          setMfaChallengePending(false);
          // Data fetches were held back at sign-in until MFA verification —
          // start them now that the second factor is confirmed.
          try {
            if(window.__unsubSessions){ window.__unsubSessions(); window.__unsubSessions=null; }
            window.__unsubSessions = onUserSessions(user.uid, sessions=>{
              setUserSessions(sessions);
              setSessionsLoading(false);
              if (sessions?.length > 0) {
                setTimeout(() => {
                  preloadAIInsights(user.uid, profile, sessions, null, profile?.is_trial ? profile?.trial_tier : profile?.tier, lang);
                }, 1500);
              }
            }, err => {
              console.error("[Auth/MFA] sessions listener failed:", err.code, err.message);
              addToast?.(isAr
                ? "تعذر تحميل جلساتك — حاول تحديث الصفحة"
                : "Couldn't load your sessions — try refreshing the page", "error");
            });
          } catch(e){ console.warn("[Auth] sessions:",e?.code); }
          try {
            if(window.__unsubProfile){ window.__unsubProfile(); window.__unsubProfile=null; }
            window.__unsubProfile = onUserProfile(user.uid, freshProfile=>{
              setProfile(prev => ({ ...prev, ...freshProfile }));
              if(freshProfile.tier) setTier(normalizeTier(freshProfile.tier));
            });
          } catch(e){ console.warn("[Auth] profile listener:",e?.code); }
          try {
            if(profile?.company_id||profile?.is_org_owner){
              getAllUsers(profile.company_id||null,false).then(setAllUsers).catch(()=>{});
            }
          } catch{}
        }}
        onSignOut={()=>{ logOut(); setUser(null); setProfile(null); setMfaChallengePending(false); }}
      />
    </ErrorBoundary>
  );  if(page==="admin"&&isAdmin)return <ErrorBoundary><Admin {...shared} adminUser={user} onBack={()=>setPage("home")}/></ErrorBoundary>;
  if(page==="hr"&&(isAdmin||isHRAdmin))return <ErrorBoundary><HRPanel {...shared} user={user} profile={profile} companyId={companyId||profile?.company_id} onBack={()=>setPage("home")}/></ErrorBoundary>;
  if(page==="marketplace"&&user)return <ErrorBoundary><TherapistMarketplace {...shared} user={user} isAdmin={isAdmin} tier={effectiveTier} onBack={()=>setPage("home")}/></ErrorBoundary>;
  if(page==="pricing") return(
    <ErrorBoundary>
      <PricingPage
        cs={cs} lang={lang} isAr={isAr} dir={dir}
        profile={profile} darkMode={darkMode}
        onBack={()=>setPage("home")}
        // Same deep-link wiring as the logged-out pricing page above — this
        // is the branch a freshly-signed-up user actually lands on when
        // they followed a ?plan=&billing= marketing link (see the routing
        // check in onAuthStateChanged).
        defaultSeg={deepPlan && B2B_TIERS[deepPlan] ? "b2b" : "b2c"}
        defaultBilling={deepBilling}
        highlightPlanId={deepPlan}
        onSelectPlan={(planId,billing)=>{
          // SECURITY/CORRECTNESS: do NOT setTier() here. Selecting a plan on the
          // pricing page must only open the payment flow — the tier is committed
          // to state only inside BillingModal's onSuccess callback, which fires
          // after a real payment actually completes. Setting it here would let a
          // user's UI show "Growth" access immediately, with zero payment made,
          // until the next profile refresh silently reverted it (a confusing and
          // exploitable race condition).
          setShowBilling(true);
          setPage("home");
        }}
      />
    </ErrorBoundary>
  );
  if(page==="profile"){setPage("home"); return null; /* Settings handled in HomePage tabs */}
  // Signed-in fallbacks. Without these, both fell through to the live-camera
  // return at the bottom of this component: #report had no branch anywhere,
  // and #enterprise is only handled for logged-out visitors above.
  if(page==="report" || page==="enterprise"){ setPage("home"); return null; }
  if(page==="leaderboard")return <ErrorBoundary><Leaderboard {...shared} users={allUsers} onBack={()=>setPage("home")} lang={lang}/></ErrorBoundary>;

  // Guard: live page requires user + profile — prevent crash on #live URL before auth resolves
  if(page==="live" && (!user || !profile)){
    // Don't setPage here — onAuthStateChanged will navigate correctly once auth resolves
    return null;
  }

  // page==="live" and page==="home" fall through to their renders below

  // ── SETUP SCREEN: account type + device selection ─────────────────
  if(page==="setup"){
    return(<ErrorBoundary>
      <div dir={dir} style={{minHeight:"100vh",background:cs.bg,color:cs.text,fontFamily:"'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 18px"}}>
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
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[
                  {id:"individual",icon:"🧑‍💻",label:isAr?"مستخدم فردي":"Individual",desc:isAr?"تتبع وضعيتك الشخصية، AI Coach، وتقارير شخصية":"Personal posture tracking, AI Coach, personal reports",color:"#3b82f6",features:isAr?["داشبورد شخصي","AI Coach","تقارير PDF"]:["Personal dashboard","AI Coach","PDF reports"]},
                  {id:"company",icon:"🏢",label:isAr?"شركة / فريق":"Company / Team",desc:isAr?"راقب فريقك كاملاً، HR analytics، وتنبيهات الخطر":"Monitor your entire team, HR analytics, at-risk alerts",color:"#4FAE8E",features:isAr?["داشبورد الفريق","HR Panel","تقارير المؤسسة"]:["Team dashboard","HR Panel","Org reports"]},
                ].map(o=>(
                  <button key={o.id}
                    type="button"
                    onClick={()=>setAcctType(o.id)}
                    style={{
                      width:"100%",textAlign:isAr?"right":"left",
                      background:acctType===o.id?`linear-gradient(135deg,${o.color}18,${o.color}08)`:cs.card,
                      border:`2px solid ${acctType===o.id?o.color:o.color+"30"}`,
                      borderRadius:14,padding:"18px 18px",cursor:"pointer",
                      transition:"all .2s",
                      boxShadow:acctType===o.id?`0 0 0 4px ${o.color}18`:"none",
                    }}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                      <div style={{width:46,height:46,borderRadius:11,flexShrink:0,
                        background:acctType===o.id?`${o.color}22`:cs.inp,
                        border:`1.5px solid ${acctType===o.id?o.color+"55":"rgba(148,163,184,.12)"}`,
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{o.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <span style={{fontSize:15,fontWeight:800,color:acctType===o.id?o.color:cs.text}}>{o.label}</span>
                          {acctType===o.id&&<span style={{fontSize:9,fontWeight:700,color:o.color,background:`${o.color}18`,border:`1px solid ${o.color}44`,borderRadius:99,padding:"2px 7px"}}>{isAr?"✓ محدد":"✓ Selected"}</span>}
                        </div>
                        <div style={{fontSize:11.5,color:cs.muted,lineHeight:1.55,marginBottom:8}}>{o.desc}</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                          {o.features.map((f,i)=>(
                            <span key={i} style={{fontSize:9.5,fontWeight:600,padding:"2px 8px",borderRadius:99,
                              background:acctType===o.id?`${o.color}15`:cs.inp,
                              color:acctType===o.id?o.color:cs.muted,
                              border:`1px solid ${acctType===o.id?o.color+"30":"rgba(148,163,184,.08)"}`}}>{f}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ):(
            <>
              <div style={{textAlign:"center",marginBottom:24}}>
                {!(profile?.acct_type||profile?.user_type==="employee"||profile?.user_type==="hr_admin")&&<button onClick={()=>{setAcctType(null);setDevicePref(null);}} style={{background:"none",border:"none",color:cs.muted,cursor:"pointer",fontSize:11,marginBottom:12}}>{isAr?"→ رجوع":"← Back"}</button>}
                <div style={{fontSize:20,fontWeight:700,marginBottom:6,color:cs.text}}>{t.deviceType}</div>
                {acctType==="company"&&<div style={{fontSize:12,color:cs.muted,marginTop:4}}>
                  {isAr?`لفريق ${profile?.company||"شركتك"}`:`For ${profile?.company||"your team"}`}
                </div>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12,marginBottom:20}}>
                {[
                  {id:"laptop",icon:"💻",label:t.deviceLaptop,desc:t.deviceLaptopDesc,color:"#6366f1",modes:["laptop"]},
                  // Phone option removed — Phone/Side modes removed app-wide.
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
                const defaultMode="laptop"; // Phone/Side removed app-wide
                setMode(defaultMode);
                // An employee's role/company link comes from their invite (see
                // AuthPage.jsx signup + org_invite_accept), never from this
                // generic individual/company picker — preserve it exactly.
                const isEmployee = profile?.user_type==="employee";
                const roleFields = isEmployee
                  ? { user_type: "employee", acct_type: "company", is_org_owner: false }
                  : { user_type: acctType==="company"?"hr_admin":"individual", acct_type: acctType==="company"?"company":"individual", is_org_owner: acctType==="company" };
                // Save user_type to Firestore so role detection works
                if(user?.uid){
                  try{
                    await updateDoc(doc(db,"users",user.uid),{
                      ...roleFields,
                      setup_complete: true,
                      device_pref: devicePref,
                      updated_at: serverTimestamp(),
                    });
                    setProfile(p=>({...p, ...roleFields, setup_complete:true}));
                  }catch(e){ console.warn("setup save failed",e); }
                }
                const freshP=user?.uid?await getUserProfile(user.uid).catch(()=>null):null;
                if(freshP){setProfile(freshP);if(freshP.tier)setTier(normalizeTier(freshP.tier));if(freshP.company_id)setCompanyId(freshP.company_id);}
                else{setProfile(p=>({...p,...roleFields,setup_complete:true}));}
                if(acctType==="company"&&!isEmployee){setShowCompanyOnboard(true);}
                else{setTimeout(()=>setShowOnboard(true),800);}
                setPage("home");
              }}
                style={{width:"100%",padding:"13px",background:devicePref?cs.blue:"rgba(148,163,184,.2)",color:"white",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:devicePref?"pointer":"not-allowed",transition:"all .2s"}}>
                {isAr?"متابعة ←":"Continue →"}
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
      {showChangePw&&<ChangePasswordPage darkMode={darkMode} lang={lang} onClose={()=>setShowChangePw(false)}/>}
      {showChurnPrediction&&(isAdmin||isHRAdmin)&&<ChurnPrediction profile={profile} cs={cs} lang={lang} onClose={()=>setShowChurnPrediction(false)}/>}
      {showCustomerSuccess&&(isAdmin||isHRAdmin)&&<CustomerSuccess profile={profile} cs={cs} lang={lang} token={authToken} onClose={()=>setShowCustomerSuccess(false)}/>}
      {showAPIMarketplace&&<ErrorBoundary key="apimarketplace"><Suspense fallback={null}><APIMarketplace profile={profile} cs={cs} lang={lang} onClose={()=>setShowAPIMarketplace(false)}/></Suspense></ErrorBoundary>}
      {showWhiteLabel&&<ErrorBoundary key="whitelabel"><Suspense fallback={null}><WhiteLabel profile={profile} cs={cs} lang={lang} onClose={()=>setShowWhiteLabel(false)}/></Suspense></ErrorBoundary>}
      {showMultiTenant&&<ErrorBoundary key="multitenant"><Suspense fallback={null}><MultiTenantManager profile={profile} cs={cs} lang={lang} onClose={()=>setShowMultiTenant(false)}/></Suspense></ErrorBoundary>}
      {showAuditSystem&&(isAdmin||isHRAdmin)&&<AuditSystem profile={profile} cs={cs} lang={lang} token={authToken} onClose={()=>setShowAuditSystem(false)}/>}
    </ErrorBoundary>);
  }


  // Sidebar & card styles
  // #8 Fix-it tips per cause key
  // stepsAr added — this panel's header ("How to fix:") already branched on
  // isAr, but the actual steps underneath it were English-only regardless
  // of language, so an Arabic user got a translated heading over untranslated
  // instructions.
  const FIX_TIPS={
    neck:    {icon:"🔼", steps:["Raise monitor so top edge is at eye level","Tuck chin slightly — imagine a string pulling crown of head up","Check chair height — elbows should be at 90°"],
              stepsAr:["ارفع الشاشة بحيث يكون حرفها العلوي عند مستوى عينك","ادخل ذقنك شوية للداخل — تخيل خيط بيشد قمة رأسك لأعلى","اتأكد من ارتفاع الكرسي — المرفقين لازم يبقوا بزاوية 90°"], img:"↕️"},
    yaw:     {icon:"↔️", steps:["Center monitor directly in front of you","If using dual screens, put primary screen center","Avoid reading from phone while looking sideways"],
              stepsAr:["حط الشاشة بالظبط قدامك في النص","لو بتستخدم شاشتين، خلي الشاشة الأساسية في النص","تجنب القراءة من الموبايل وانت باصص على الجنب"], img:"↔️"},
    dist:    {icon:"📏", steps:["Arm's length from screen (50–70 cm)","Increase font size so you don't lean in","Use zoom shortcut: Ctrl/⌘ + to reduce urge to lean forward"],
              stepsAr:["ابعد عن الشاشة بطول ذراعك (50–70 سم)","كبّر حجم الخط عشان متحتاجش تقرب","استخدم اختصار التكبير: Ctrl/⌘ + عشان تقلل رغبتك في الميل للأمام"], img:"📏"},
    posture: {icon:"🪑", steps:["Sit back fully — use lumbar support or rolled towel","Feet flat on floor, knees at 90°","Relax shoulders down and back"],
              stepsAr:["اتكي على الكرسي بالكامل — استخدم مسند لأسفل الظهر أو فوطة ملفوفة","رجليك تلامسوا الأرض بالكامل، والركب بزاوية 90°","ارخي كتفيك لأسفل وللخلف"], img:"🪑"},
    fhp:     {icon:"⬅️", steps:["Tuck your chin straight back — make a double chin, don't tip your head down","Raise the monitor so its top edge is at eye level","Sit back so the chair supports you instead of hovering forward"],
              stepsAr:["ارجع بذقنك لورا في خط مستقيم — اعمل دقن مزدوجة، متنزلش راسك","ارفع الشاشة لحد ما حرفها العلوي يبقى في مستوى عينك","ارجع لورا وخلي الكرسي يشيلك بدل ما تكون مايل لقدام"], img:"⬅️"},
    round:   {icon:"🤸", steps:["Draw your shoulder blades together and down, as if holding a pencil between them","Open the chest: clasp your hands low behind your back and lift","Move the keyboard closer so you stop reaching for it"],
              stepsAr:["قرّب لوحي كتفيك من بعض ولتحت، كأنك ماسك قلم بينهم","افتح صدرك: شبّك إيديك ورا ظهرك من تحت وارفع","قرّب الكيبورد ناحيتك عشان تبطل تمدّ دراعك"], img:"🤸"},
    shrug:   {icon:"⬇️", steps:["Let both shoulders drop — exhale and feel them settle","Lower the armrests, or move them in so your elbows rest without lifting","Check the desk height: a high desk keeps the traps switched on all day"],
              stepsAr:["سيب كتفيك ينزلوا — ازفر وحسّ بيهم بيرتاحوا","نزّل مساند الدراع، أو قرّبهم عشان كوعك يرتاح من غير رفع","بُص لارتفاع المكتب: المكتب العالي بيخلّي عضلات الكتف شغالة طول اليوم"], img:"⬇️"},
    spine:   {icon:"⚖️", steps:["Sit centred — weight even on both sit bones","Move whatever you're reaching for (mouse, phone, notes) closer","If you rest on one armrest, level both or use neither"],
              stepsAr:["اقعد في النص — وزنك متوزّع على الجنبين بالتساوي","قرّب الحاجة اللي بتمدّ ناحيتها (الماوس، الموبايل، الورق)","لو بتتكي على مسند واحد، ظبّط الاتنين أو سيبهم"], img:"⚖️"},
    slouch:  {icon:"🪑", steps:["Stack your ribs over your hips — think 'grow taller', not 'pull shoulders back'","Slide your hips all the way into the seat back","Raise the screen: slouching is often the body following a low monitor"],
              stepsAr:["حط قفصك الصدري فوق حوضك — فكّر إنك بتطوّل، مش بتشد كتفك لورا","زقّ حوضك لآخر الكرسي من ورا","ارفع الشاشة: الترهّل غالباً الجسم بيتبع شاشة واطية"], img:"🪑"},
    twist:   {icon:"🔄", steps:["Square your chair to the screen instead of turning your body","Centre the monitor you look at most — a side monitor twists you all day","Move the phone or documents you keep turning to"],
              stepsAr:["ظبّط كرسيك في مواجهة الشاشة بدل ما تلف جسمك","حط الشاشة اللي بتبص عليها أكتر في النص — الشاشة الجانبية بتلفّك طول اليوم","حرّك الموبايل أو الورق اللي بتلف ناحيته"], img:"🔄"},
    mon:     {icon:"🔼", steps:["Raise the monitor until its top edge is level with your eyes","A stack of books works; a stand works better","If you're looking down at a phone or notes rather than the screen, keep it short"],
              stepsAr:["ارفع الشاشة لحد ما حرفها العلوي يبقى في مستوى عينك","كذا كتاب فوق بعض بيعملها؛ الاستاند أحسن","لو بتبص لموبايل أو ورق مش للشاشة، خليها فترة قصيرة"], img:"🔼"},
    elbow:   {icon:"⌨️", steps:["Set the keyboard so your elbows sit at 90-100° with forearms level","Lower the desk or raise the chair — whichever you can actually adjust","If the chair goes up, add a footrest so your feet stay flat"],
              stepsAr:["ظبّط الكيبورد بحيث كوعك يبقى ٩٠°-١٠٠° والساعد أفقي","نزّل المكتب أو ارفع الكرسي — أي واحد فيهم تقدر تظبطه","لو رفعت الكرسي، حط مسند رجل عشان رجليك تفضل على الأرض"], img:"⌨️"},
    tilt:    {icon:"↕️", steps:["Level your head — both ears the same height","Check chair and armrest height: an uneven rest tips the head","If you cradle a phone against your shoulder, use a headset"],
              stepsAr:["ظبّط راسك — الودنين في نفس المستوى","بُص لارتفاع الكرسي والمساند: المسند غير المستوي بيميّل الراس","لو بتحط الموبايل بين كتفك وودنك، استخدم سماعة"], img:"↕️"},
    sh:      {icon:"⚖️", steps:["Level both shoulders — check whether one armrest sits higher","Move anything you reach for repeatedly to the centre","A bag or wallet in one back pocket tilts the whole chain — take it out"],
              stepsAr:["ظبّط الكتفين في نفس المستوى — شوف لو مسند دراع أعلى من التاني","حط أي حاجة بتمدّ ناحيتها كتير في النص","محفظة أو حاجة في جيب واحد بتميّل الجسم كله — طلّعها"], img:"⚖️"},
    hand:    {icon:"🤚", steps:["Take your hand off your face — propping your chin hides real neck strain from the camera","If you're leaning into your hand because you're tired, that's the signal to take the break","Rest both forearms on the desk instead"],
              stepsAr:["شيل إيدك من على وشك — سند الدقن بيخفي إجهاد الرقبة الحقيقي عن الكاميرا","لو بتتكي على إيدك عشان تعبان، دي إشارة إنك محتاج استراحة","سيب ساعديك الاتنين على المكتب بدلها"], img:"🤚"},
    default: {icon:"✅", steps:["Take a 2-minute stretch break","Roll shoulders backward 5 times","Stand up and walk for 60 seconds"],
              stepsAr:["خذ استراحة تمدد لمدة دقيقتين","لف كتفيك للخلف 5 مرات","قوم امشي لمدة 60 ثانية"], img:"🚶"},
  };
  // #9 Time-ago helper
  const timeAgo=(timeStr)=>{
    try{
      const [h,m]=timeStr.split(":").map(Number);
      const now=new Date();
      const then=new Date();then.setHours(h,m,0,0);
      const diffMin=Math.round((now-then)/60000);
      if(diffMin<1) return isAr?"الآن":"just now";
      if(diffMin<60) return isAr?`${diffMin} د`:`${diffMin}m ago`;
      const diffH=Math.round(diffMin/60);
      return isAr?`${diffH} س`:`${diffH}h ago`;
    }catch{return timeStr;}
  };

  // Text colors used to be the same washed-out light-mode-only shades
  // (#fcd34d/#6ee7b7/#fca5a5/#a5b4fc) regardless of theme — against the
  // light theme's near-white background these sit around ~1.6:1 contrast
  // (WCAG wants >=4.5:1) on what's the primary "something's wrong right
  // now" alert box during a live session. Darker variants for light mode.
  const abox=tp=>({borderRadius:8,padding:"9px 11px",fontSize:10.5,lineHeight:1.5,border:"0.5px solid",
    background:tp==="warn"?"rgba(214,162,76,.07)":tp==="good"?"rgba(79,174,142,.07)":tp==="bad"?"rgba(198,96,79,.07)":"rgba(99,102,241,.07)",
    borderColor:tp==="warn"?"rgba(214,162,76,.3)":tp==="good"?"rgba(79,174,142,.3)":tp==="bad"?"rgba(198,96,79,.3)":"rgba(99,102,241,.3)",
    color:tp==="warn"?(darkMode?"#fcd34d":"#b45309"):tp==="good"?(darkMode?"#6ee7b7":"#15803d"):tp==="bad"?(darkMode?"#fca5a5":"#b91c1c"):(darkMode?"#a5b4fc":"#4338ca")});

  // Single source of truth for "how far is the user from the screen"
  // color, used by the on-video distance chip, the Distance bar's number,
  // and the Distance bar's position marker. These three used to compute
  // color independently: the chip derived its color from the analysis
  // engine's qualityScore/qualityReason (falling back to a calm grey
  // whenever the quality gate hadn't failed), while the bar derived color
  // from a simple distCm-vs-optDist threshold — so the same live distance
  // reading could show as a calm grey pill on the video while the bar
  // just below it showed amber/red for that identical number. The old bar
  // threshold was also asymmetric: it only ever escalated to red on the
  // "too close" side (distCm below optDist[0]-15) — no matter how far the
  // user sat back, it topped out at amber. Symmetric on both sides now.
  const distColor = (d, m) => {
    if (d==null || !m) return cs.muted;
    if (d>=m.optDist[0] && d<=m.optDist[1]) return "#4FAE8E";
    if (d>=(m.optDist[0]-15) && d<=(m.optDist[1]+30)) return "#D6A24C";
    return "#C6604F";
  };

  // ── HOME PAGE ─────────────────────────────────────────────────────
  const tierList=isAr?Object.values(TIERS).slice().reverse():Object.values(TIERS);
  const allModes=Object.values(MC); // Phone/Side removed app-wide — MC now only has laptop
  const modeList=allModes; // no filtering needed with a single mode

  if(page==="home") return(
    <ErrorBoundary key="page-home">
      <ModalPortal>
      {/* ── ALL MODALS — shown on home page too ────────────────── */}
      {showCompanyOnboard&&<ErrorBoundary key="companyonboard"><CompanyOnboarding profile={profile} cs={cs} lang={lang} addToast={addToast} onComplete={async(company)=>{setShowCompanyOnboard(false);setCompanyId(company?.id);setProfile(p=>({...p,company_id:company?.id,company:company?.name,is_org_owner:true,user_type:"hr_admin"}));if(user?.uid&&company?.id){try{const{doc:_d,updateDoc:_u,serverTimestamp:_s}=await import("firebase/firestore");const{db:_db}=await import("./firebase.js");await _u(_d(_db,"users",user.uid),{company_id:company.id,company:company.name||"",is_org_owner:true,user_type:"hr_admin",setup_complete:true,updated_at:_s()});}catch(e){}}addToast(isAr?"✅ تم إنشاء شركتك":"✅ Company created","success");}}/></ErrorBoundary>}
      {showOnboard&&<ErrorBoundary key="onboard"><OnboardingWizard user={user} lang={lang} onComplete={handleOnboardComplete} onSkip={async()=>{
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
      }}/></ErrorBoundary>}
      {showBilling&&<ErrorBoundary key="billing"><BillingModal profile={profile} currentPlan={tier} cs={cs} lang={lang} onClose={()=>setShowBilling(false)} onSuccess={async(plan)=>{
        const newTier = normalizeTier(plan);
        setTier(newTier);
        setShowBilling(false);
        addToast(isAr?"✅ تم تحديث خطتك":"✅ Plan updated","success");
        // Persist tier to Firestore so it survives refresh
        if(user?.uid){
          try{
            const{doc:_d,updateDoc:_u,serverTimestamp:_s}=await import("firebase/firestore");
            const{db:_db}=await import("./firebase.js");
            await _u(_d(_db,"users",user.uid),{
              tier: newTier,
              tier_updated_at: new Date().toISOString(),
              updated_at: _s(),
            });
            setProfile(p=>p?({...p,tier:newTier}):p);
          }catch(e){ console.warn("tier update failed",e?.code); }
        }
        // Refresh profile from Firestore to get any backend-updated fields
        if(user?.uid){
          getUserProfile(user.uid).then(p=>{
            if(p){ setProfile(p); if(p.tier) setTier(normalizeTier(p.tier)); }
          }).catch(()=>{});
        }
      }}/></ErrorBoundary>}
      {showCalibWizard&&<ErrorBoundary key="calibwizard"><CalibrationWizard uid={profile?.uid} cs={cs} lang={lang} onDone={d=>{
        // Attach the user's current avg score as baseline — drift detection
        // uses this to suggest recalibration when posture improves significantly.
        //
        // `avgScore` doesn't exist in this scope — that name is a local const
        // inside the unrelated <Profile> component (line ~1042 — profile stats
        // page). This handler lives in App() itself, so it needs its own
        // computation from App()'s own state (profile/userSessions), mirroring
        // Profile's own avgScore formula (persistent counter first, else a
        // live average over the loaded session list).
        const currentAvgScore = profile?.avg_score ?? (userSessions?.length
          ? Math.round(userSessions.reduce((a,s)=>a+(s.avg_score||0),0)/userSessions.length)
          : 0);
        const enriched = { ...d, baseline_avg_score: currentAvgScore || null };
        setCalibData(enriched);
        setCalibStale(false);
        setShowCalibWizard(false);
        addToast(isAr?"تم حفظ المعايرة ✓":"Calibration saved ✓","success");
      }} onSkip={()=>setShowCalibWizard(false)}/></ErrorBoundary>}
      {showDashboard&&<ErrorBoundary key="dashboard"><Suspense fallback={null}><AnalyticsDashboard uid={profile?.uid} profile={profile} sessions={userSessions} cs={cs} lang={lang} onBack={()=>setShowDashboard(false)}/></Suspense></ErrorBoundary>}
      {showCoach&&<ErrorBoundary key="aicoach"><AICoach profile={profile} sessions={userSessions} calibration={calibData} cs={cs} lang={lang} effectiveTier={effectiveTier} onClose={()=>setShowCoach(false)}/></ErrorBoundary>}
      {showGamification&&<ErrorBoundary key="gamification"><Suspense fallback={null}><GamificationPanel profile={profile} sessions={userSessions} calibration={calibData} employees={allUsers} cs={cs} lang={lang} tier={effectiveTier} onAchievementsUpdate={(achievements)=>setProfile(p=>p?({...p,achievements}):p)} onClose={()=>setShowGamification(false)}/></Suspense></ErrorBoundary>}
      {showCustomAlertRules&&<CustomAlertRulesPanel isAr={isAr} cs={cs} rules={customAlertRules}
        onSave={(next)=>{
          setCustomAlertRules(next);
          setProfile(p=>p?({...p,custom_alert_rules:next}):p);
          if(user?.uid) updateUserProfile(user.uid,{custom_alert_rules:next}).catch(()=>{});
        }}
        onClose={()=>setShowCustomAlertRules(false)}/>}
      {showAdmin&&isAdmin&&<ErrorBoundary key="admin"><AdminDashboard adminProfile={profile} cs={cs} lang={lang} onBack={()=>setShowAdmin(false)} onOpenSecurityCenter={()=>setShowSecurityCenter(true)} onOpenFeatureFlags={()=>setShowFeatureFlags(true)} onOpenOnboardingAnalytics={()=>setShowOnboardingAnalytics(true)}/></ErrorBoundary>}
      {showMRR&&isAdmin&&<ErrorBoundary key="mrr"><MRRDashboard cs={cs} lang={lang} onClose={()=>setShowMRR(false)}/></ErrorBoundary>}
      {showHelp&&<ErrorBoundary key="help"><Suspense fallback={null}><HelpCenter cs={cs} lang={lang} onClose={()=>setShowHelp(false)}/></Suspense></ErrorBoundary>}
      {showChangelog&&isAdmin&&<ErrorBoundary key="changelog"><APIChangelog cs={cs} onClose={()=>setShowChangelog(false)}/></ErrorBoundary>}
      {showAIInsights&&<ErrorBoundary key="aiinsights"><Suspense fallback={null}><AIInsights profile={profile} sessions={userSessions} calibration={calibData} cs={cs} lang={lang} effectiveTier={effectiveTier} uid={user?.uid} onUpgrade={()=>setShowBilling(true)} onClose={()=>setShowAIInsights(false)}/></Suspense></ErrorBoundary>}
      {showSymptomCorrelation&&<ErrorBoundary key="symptom"><SymptomCorrelation cs={cs} lang={lang} onClose={()=>setShowSymptomCorrelation(false)}/></ErrorBoundary>}
      {showPredictiveAI&&<ErrorBoundary key="predictiveai"><Suspense fallback={null}><PredictiveAI profile={profile} sessions={userSessions} cs={cs} lang={lang} effectiveTier={effectiveTier} uid={user?.uid} onUpgrade={()=>setShowBilling(true)} onClose={()=>setShowPredictiveAI(false)}/></Suspense></ErrorBoundary>}
      {showAIReports&&<ErrorBoundary key="aireports"><Suspense fallback={null}><AIReports profile={profile} sessions={userSessions} allUsers={allUsers} cs={cs} lang={lang} effectiveTier={effectiveTier} uid={user?.uid} onClose={()=>setShowAIReports(false)}/></Suspense></ErrorBoundary>}
      {showSessionComparison&&<ErrorBoundary key="sessioncomparison"><SessionComparison sessions={userSessions} cs={cs} lang={lang} effectiveTier={effectiveTier} onUpgrade={()=>setShowBilling(true)} onClose={()=>setShowSessionComparison(false)}/></ErrorBoundary>}
      {showTrendChart&&<ErrorBoundary key="trendchart"><TrendChart sessions={userSessions} cs={cs} lang={lang} effectiveTier={effectiveTier} onUpgrade={()=>setShowBilling(true)} onClose={()=>setShowTrendChart(false)}/></ErrorBoundary>}
      {showWorkforceAnalytics&&(isAdmin||isHRAdmin)&&<ErrorBoundary key="workforceanalytics"><Suspense fallback={null}><WorkforceAnalytics uid={profile?.uid} profile={profile} sessions={userSessions} allUsers={allUsers} cs={cs} lang={lang} onClose={()=>setShowWorkforceAnalytics(false)}/></Suspense></ErrorBoundary>}
      {showEnterpriseRBAC&&<ErrorBoundary key="enterpriserbac"><Suspense fallback={null}><EnterpriseRBAC orgId={profile?.company_id||companyId} adminUid={user?.uid} profile={profile} members={allUsers} cs={cs} lang={lang} onClose={()=>setShowEnterpriseRBAC(false)}/></Suspense></ErrorBoundary>}
      
      {showFeatureFlags&&isAdmin&&<ErrorBoundary key="featureflags"><FeatureFlags profile={profile} cs={cs} lang={lang} token={authToken} onClose={()=>setShowFeatureFlags(false)}/></ErrorBoundary>}
      {showNotificationsHub&&<ErrorBoundary key="notificationshub"><Suspense fallback={null}><NotificationsHub orgId={profile?.company_id||companyId} profile={profile} sessions={userSessions} allUsers={allUsers} cs={cs} lang={lang} onClose={()=>setShowNotificationsHub(false)}/></Suspense></ErrorBoundary>}
      {showUpgrade&&<ErrorBoundary key="upgrade"><UpgradePrompt reason={upgradeReason} cs={cs} lang={lang} profile={profile} onUpgrade={()=>{setShowUpgrade(false);setShowBilling(true);}} onClose={()=>setShowUpgrade(false)}/></ErrorBoundary>}
      {healthConsentModalEl}
      {showOnboardingAnalytics&&<ErrorBoundary key="onboardinganalytics"><Suspense fallback={null}><OnboardingAnalytics token={authToken} onClose={()=>setShowOnboardingAnalytics(false)}/></Suspense></ErrorBoundary>}
      </ModalPortal>
      {authToken && (
        <div style={{maxWidth:960,margin:"0 auto",padding:"12px 20px 0"}}>
          <AnnouncementsBar token={authToken}/>
        </div>
      )}
      {/* HomePage's `tier` prop below was `tier={tier}` — the raw tier
          state, not the `effectiveTier` this same file's own comment (a few
          hundred lines up, at its definition) says every feature gate
          should use instead, because raw `tier` starts null on load and
          never gets set to a trial user's trial_tier at all (grep confirms:
          no setTier() call site anywhere references trial_tier). HomePage
          has zero trial-awareness of its own — no is_trial/trial_tier
          reference anywhere in it — it just threads whatever `tier` it's
          given straight into isPro()/isElite()/tierAtLeast() and the tier
          badge/plan-name text everywhere. Net effect: every Elite trial
          user saw "Free"/"Standard" branding and had every Elite-gated
          button in this component — including the Posture DNA button this
          fix was prompted by — silently missing, despite
          downloadPostureDNAReport() itself correctly checking effectiveTier
          and being willing to run for them. */}
      <HomePage
        user={user} profile={profile} cs={cs} lang={lang} isAr={isAr} dir={dir}
        userSessions={userSessions} setUserSessions={setUserSessions} sessionsLoading={sessionsLoading}
        allUsers={allUsers} setAllUsers={setAllUsers}
        tier={effectiveTier} setTier={setTier} mode={mode} setMode={setMode}
        setPage={setPage} startCamera={startCamera} addToast={addToast} goToBreak={goToBreak}
        setShowCertModal={setShowCertModal}
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
        setShowSymptomCorrelation={setShowSymptomCorrelation}
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
        setShowBillingDashboard={setShowBillingDashboard}
        setShowReferralProgram={setShowReferralProgram}
        setShowIntegrationsHub={setShowIntegrationsHub}
        setShowMFASetup={setShowMFASetup}
        setShowHelp={setShowHelp}
        setShowChangePw={setShowChangePw}
        setShowProductTour={setShowProductTour}
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
        downloadClinicalPDF={(s)=>downloadPDF(s,true)}
        downloadComparisonPDF={downloadComparisonPDF}
        downloadTeamPDF={downloadTeamPDF}
        downloadLongitudinalPDF={downloadLongitudinalPDF}
        downloadPostureDNAReport={downloadPostureDNAReport}
        shareReport={shareReport}
        AccountSwitcher={AccountSwitcher}
        onSwitchAccount={handleSwitchAccount}
        onQuarterlyReport={()=>setShowQuarterlyReport(true)}
        onSchools={()=>setShowSchoolsModal(true)}
        onDevPortal={()=>setShowDevPortal(true)}
        onInsurance={()=>setShowInsuranceModal(true)}
      />
      {showGrowthHub&&<ErrorBoundary key="growthhub"><Suspense fallback={null}><GrowthHub profile={profile} cs={cs} lang={lang} onClose={()=>setShowGrowthHub(false)}/></Suspense></ErrorBoundary>}
      {showCertModal&&<ErrorBoundary key="certmodal"><Suspense fallback={null}><CertBadgeModal profile={profile} cs={cs} isAr={isAr} addToast={addToast} onClose={()=>setShowCertModal(false)}/></Suspense></ErrorBoundary>}
      {showQuarterlyReport&&<ErrorBoundary key="quarterlyreport"><Suspense fallback={null}><QuarterlyReportModal profile={profile} allUsers={allUsers} cs={cs} isAr={isAr} addToast={addToast} onClose={()=>setShowQuarterlyReport(false)}/></Suspense></ErrorBoundary>}
      {showSchoolsModal&&<ErrorBoundary key="schoolsmodal"><Suspense fallback={null}><SchoolsModal cs={cs} isAr={isAr} addToast={addToast} onClose={()=>setShowSchoolsModal(false)}/></Suspense></ErrorBoundary>}
      {showDevPortal&&<ErrorBoundary key="devportal"><Suspense fallback={null}><DeveloperPortalModal profile={profile} cs={cs} isAr={isAr} addToast={addToast} onClose={()=>setShowDevPortal(false)}/></Suspense></ErrorBoundary>}
      {showInsuranceModal&&<ErrorBoundary key="insurancemodal"><Suspense fallback={null}><InsurancePartnerModal cs={cs} isAr={isAr} addToast={addToast} onClose={()=>setShowInsuranceModal(false)}/></Suspense></ErrorBoundary>}
      {/* Moved here from the live-analysis render branch — modals must render on the
          home page only, never over the live camera/analysis screen (interrupts the Stop button). */}
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
              <p style={{margin:0,color:darkMode?"#a5b4fc":"#4338ca",fontSize:13}}>
                {lang==="ar"
                  ? `${qualityFor(profile?.tier).label.ar} · سنوي · وفّر 17٪`
                  : `${qualityFor(profile?.tier).label.en} · Annual · 17% off`}
              </p>
            </div>
            {/* Was setPage("billing") — there is no page==="billing" route
                anywhere in this file's page switch (billing is a modal,
                gated by showBilling, not a page), so this fell through
                every if-branch to the unconditional Live/camera fallback
                at the bottom of this function: clicking "Get annual
                discount" silently dumped the user onto the live camera
                screen instead of opening billing. setShowBilling(true) is
                the actual mechanism every other "open billing" button in
                this file uses. */}
            <button onClick={()=>{ setShowAnnualUpsell(false); setShowBilling(true); }}
              style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#6366f1,#0891b2)",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",marginBottom:10}}>
              {lang==="ar"?"احصل على الخصم السنوي ←":"Get annual discount →"}
            </button>
            <button onClick={()=>setShowAnnualUpsell(false)}
              style={{fontSize:12,color:"#475569",background:"none",border:"none",cursor:"pointer"}}>
              {lang==="ar"?"الاستمرار شهرياً":"Keep monthly plan"}
            </button>
          </div>
        </div>
      )}
      {showShareCard&&shareCardData&&(
      <ShareCard score={shareCardData.score} grade={shareCardData.grade}
        streak={shareCardData.streak||0} percentile={null}
        sessions={shareCardData.sessions} avgScore={shareCardData.avgScore} name={shareCardData.name}
        lang={lang} cs={cs} addToast={addToast} onClose={()=>setShowShareCard(false)}/>
    )}
      {/* Same class of bug already fixed once for BillingModal/CalibrationWizard/
          CustomAlertRulesPanel/OnboardingWizard/CompanyOnboarding: each of these
          11 modals below is only mounted in the Live page branch or the one-time
          Setup branch, but the button that opens it lives in HomePage's sidebar/
          settings tabs — which only render inside page==="home". Clicking any of
          them from Home set the show-state and nothing ever rendered. Mirrored
          each one's exact mount here (verbatim from its Live/Setup-branch copy)
          rather than moving it, matching the pattern already used above. */}
      {showSecurityCenter&&<ErrorBoundary key="securitycenter-home"><Suspense fallback={null}><SecurityCenter user={user} profile={profile} cs={cs} lang={lang} onNavigate={setPage} onClose={()=>setShowSecurityCenter(false)} onSignOut={()=>{logOut();setShowSecurityCenter(false);setUser(null);setProfile(null);}}/></Suspense></ErrorBoundary>}
      {showMFASetup&&<ErrorBoundary key="mfasetup-home"><Suspense fallback={null}><MFASetup profile={profile} cs={cs} lang={lang} onClose={()=>setShowMFASetup(false)} onEnabled={()=>setShowMFASetup(false)} onProfileChange={p=>setProfile(prev=>({...prev,...p}))}/></Suspense></ErrorBoundary>}
      {showBillingDashboard&&<ErrorBoundary key="billingdashboard-home"><Suspense fallback={null}><BillingDashboard profile={profile} user={user} isAr={lang==="ar"} isAdmin={isAdmin} onClose={()=>setShowBillingDashboard(false)} onUpgrade={(plan)=>{setShowBillingDashboard(false);setShowBilling(true);}}/></Suspense></ErrorBoundary>}
      {showReferralProgram&&<ErrorBoundary key="referralprogram-home"><Suspense fallback={null}><ReferralProgram profile={profile} cs={cs} lang={lang} onClose={()=>setShowReferralProgram(false)}/></Suspense></ErrorBoundary>}
      {showIntegrationsHub&&<ErrorBoundary key="integrationshub-home"><Suspense fallback={null}><IntegrationsHub profile={profile} cs={cs} lang={lang} onClose={()=>setShowIntegrationsHub(false)}/></Suspense></ErrorBoundary>}
      {showChurnPrediction&&(isAdmin||isHRAdmin)&&<ChurnPrediction profile={profile} cs={cs} lang={lang} onClose={()=>setShowChurnPrediction(false)}/>}
      {showCustomerSuccess&&(isAdmin||isHRAdmin)&&<CustomerSuccess profile={profile} cs={cs} lang={lang} token={authToken} onClose={()=>setShowCustomerSuccess(false)}/>}
      {showAPIMarketplace&&<ErrorBoundary key="apimarketplace-home"><Suspense fallback={null}><APIMarketplace profile={profile} cs={cs} lang={lang} onClose={()=>setShowAPIMarketplace(false)}/></Suspense></ErrorBoundary>}
      {showWhiteLabel&&<ErrorBoundary key="whitelabel-home"><Suspense fallback={null}><WhiteLabel profile={profile} cs={cs} lang={lang} onClose={()=>setShowWhiteLabel(false)}/></Suspense></ErrorBoundary>}
      {showMultiTenant&&<ErrorBoundary key="multitenant-home"><Suspense fallback={null}><MultiTenantManager profile={profile} cs={cs} lang={lang} onClose={()=>setShowMultiTenant(false)}/></Suspense></ErrorBoundary>}
      {showAuditSystem&&(isAdmin||isHRAdmin)&&<AuditSystem profile={profile} cs={cs} lang={lang} token={authToken} onClose={()=>setShowAuditSystem(false)}/>}
      {/* Both of these were mounted in the wrong branch, so their triggers on
          this page did nothing at all:
          - ChangePasswordPage was mounted only inside page==="setup", while the
            only button that opens it is Settings → Security → Change, which
            lives here.
          - ProductTour was mounted only in the live-camera fallback return,
            while its only trigger ("Take a Tour") is in the nav avatar
            dropdown, which HomePage renders and therefore only exists here.
          Same bug class as the Live-page modals fixed earlier. */}
      {showChangePw&&<ErrorBoundary key="changepw-home"><ChangePasswordPage darkMode={darkMode} lang={lang} onClose={()=>setShowChangePw(false)}/></ErrorBoundary>}
      {showProductTour&&<ErrorBoundary key="producttour-home"><ProductTour profile={profile} cs={cs} lang={lang} onComplete={()=>setShowProductTour(false)}/></ErrorBoundary>}
    </ErrorBoundary>);
  const TN = T_norm;

  // Opt-in only: ?validate=1 or localStorage corvus_validate=1.
  const _showValidation = (() => {
    try {
      if (new URLSearchParams(window.location.search).get("validate") === "1") return true;
      return localStorage.getItem("corvus_validate") === "1";
    } catch { return false; }
  })();

  return(<ErrorBoundary><>
    {_showValidation && <ValidationReadout analysis={analysis} isAr={isAr}/>}
    <style>{`
      @keyframes livePulse{0%,100%{opacity:1}50%{opacity:.4}}
      @keyframes countdownPop{0%{opacity:0;transform:scale(1.5)}30%{opacity:1;transform:scale(1)}100%{opacity:.85;transform:scale(1)}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes bounceDown{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
    `}</style>
    {/* Fixed overlays — outside grid so they don't consume grid columns */}
    {/* Toasts default to a fixed 16px corner, positioned for a normal
        full-width page. On desktop the Live page docks a 320px-wide
        control sidebar (camera settings, calibrate, alert rules...) to
        that exact corner, so any toast — a saved session, a calibration
        confirmation, the backend-down retry message, achievement
        unlocks, all of them — rendered directly on top of that sidebar's
        button stack, covering whichever ones happened to be at that
        scroll position. Push it clear of the sidebar on desktop; mobile
        stacks the sidebar above the main content instead, so the default
        corner is already clear there. */}
    <Toasts toasts={toasts} dismiss={dismissToast} isAr={isAr} edgeOffset={isMobile?16:336}/>
    <OfflineBanner lang={lang}/>
    {healthConsentModalEl}
    {/* The Live page has four separate "Calibrate" entry points (the
        "not calibrated" banner, the sidebar shortcut, the calibration
        nudge, and re-calibrate) that all just call setShowCalibWizard(true)
        — but the actual <CalibrationWizard> was only ever mounted inside
        the page==="home" branch's own return. Clicking any of them here
        set the state and nothing happened: no modal, no error, just a
        dead button. Mounted here too so it actually opens on this page. */}
    {showCalibWizard&&<ErrorBoundary key="calibwizard-live"><CalibrationWizard uid={profile?.uid} cs={cs} lang={lang} onDone={d=>{setCalibData(d);setShowCalibWizard(false);addToast(isAr?"تم حفظ المعايرة ✓":"Calibration saved ✓","success");}} onSkip={()=>setShowCalibWizard(false)}/></ErrorBoundary>}
    {showQATest&&<ErrorBoundary key="qatest-live"><QAAccuracyTest analysis={analysis} camActive={camActive} isAr={isAr} cs={cs} onClose={()=>setShowQATest(false)}/></ErrorBoundary>}
    {/* The 4 modals below are triggered from buttons on THIS page (Billing/
        Upgrade, Custom Alert Rules, Onboarding restart, Company setup) but
        were previously only ever mounted inside the page==="home" branch —
        the exact same bug already fixed for CalibrationWizard above. Their
        setShowX(true) calls did nothing here; these mirror-mounts are the
        fix, reusing the identical handlers already defined for the home
        branch's copies (see page==="home" above) so behaviour is identical,
        not reimplemented. */}
    {showBilling&&<ErrorBoundary key="billing-live"><BillingModal profile={profile} currentPlan={tier} cs={cs} lang={lang} onClose={()=>setShowBilling(false)} onSuccess={async(plan)=>{
      const newTier = normalizeTier(plan);
      setTier(newTier);
      setShowBilling(false);
      addToast(isAr?"✅ تم تحديث خطتك":"✅ Plan updated","success");
      if(user?.uid){
        try{
          const{doc:_d,updateDoc:_u,serverTimestamp:_s}=await import("firebase/firestore");
          const{db:_db}=await import("./firebase.js");
          await _u(_d(_db,"users",user.uid),{
            tier: newTier,
            tier_updated_at: new Date().toISOString(),
            updated_at: _s(),
          });
          setProfile(p=>p?({...p,tier:newTier}):p);
        }catch(e){ console.warn("tier update failed",e?.code); }
      }
      if(user?.uid){
        getUserProfile(user.uid).then(p=>{
          if(p){ setProfile(p); if(p.tier) setTier(normalizeTier(p.tier)); }
        }).catch(()=>{});
      }
    }}/></ErrorBoundary>}
    {showCustomAlertRules&&<CustomAlertRulesPanel isAr={isAr} cs={cs} rules={customAlertRules}
      onSave={(next)=>{
        setCustomAlertRules(next);
        setProfile(p=>p?({...p,custom_alert_rules:next}):p);
        if(user?.uid) updateUserProfile(user.uid,{custom_alert_rules:next}).catch(()=>{});
      }}
      onClose={()=>setShowCustomAlertRules(false)}/>}
    {showOnboard&&<ErrorBoundary key="onboard-live"><OnboardingWizard user={user} lang={lang} onComplete={handleOnboardComplete} onSkip={async()=>{
      setShowOnboard(false);
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
    }}/></ErrorBoundary>}
    {showCompanyOnboard&&<ErrorBoundary key="companyonboard-live"><CompanyOnboarding profile={profile} cs={cs} lang={lang} addToast={addToast} onComplete={async(company)=>{setShowCompanyOnboard(false);setCompanyId(company?.id);setProfile(p=>({...p,company_id:company?.id,company:company?.name,is_org_owner:true,user_type:"hr_admin"}));if(user?.uid&&company?.id){try{const{doc:_d,updateDoc:_u,serverTimestamp:_s}=await import("firebase/firestore");const{db:_db}=await import("./firebase.js");await _u(_d(_db,"users",user.uid),{company_id:company.id,company:company.name||"",is_org_owner:true,user_type:"hr_admin",setup_complete:true,updated_at:_s()});}catch(e){}}addToast(isAr?"✅ تم إنشاء شركتك":"✅ Company created","success");}}/></ErrorBoundary>}
    <div dir={dir} style={{
      display:"grid",
      // Camera panel is the narrow (320px) fixed track; the stats/history
      // panel takes the remaining wide (1fr) space. Restored per explicit
      // user preference after a later pass briefly swapped this so the
      // camera took the wide track instead — kept here, reverted back.
      gridTemplateColumns: isMobile ? "1fr" : (isAr ? "320px 1fr" : "1fr 320px"),
      // The sidebar column below is `position:sticky, maxHeight:100vh,
      // overflowY:auto` on purpose — a standard sticky-sidebar-next-to-
      // scrolling-main-content layout, meant to stay pinned to the
      // viewport while the main column scrolls normally past it. Two
      // separate grid defaults fight that on a short/idle session where
      // the main column has barely any content: `align-content:stretch`
      // stretches the single row to fill the container's minHeight:100vh
      // before either column is even laid out, and `align-items:stretch`
      // then stretches the shorter (main) column to match that inflated
      // row. Together they turned "not much content yet" into a large
      // empty area with a border running through nothing below "Score
      // History". Both need to be `start` — one alone still leaves the
      // row padded out to the container's full height.
      alignContent: isMobile ? undefined : "start",
      alignItems: isMobile ? undefined : "start",
      minHeight:"100vh",
      background:cs.bg, color:cs.text,
      fontFamily:"'IBM Plex Sans Arabic','Inter',system-ui,sans-serif",
    }}>

      {/* ── GlobalModals: render on ALL pages ──────────────────── */}
      

      {/* OLD DUPLICATE MODALS REMOVED — see GlobalModals block above */}
      {showNPS && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>setShowNPS(false)}>
          <div style={{background:cs.card,border:`1px solid ${cs.border}`,borderRadius:20,padding:"36px 32px",maxWidth:440,width:"90%",textAlign:"center"}}
            onClick={e=>e.stopPropagation()}>
            <p style={{fontSize:28,marginBottom:8}}>👋</p>
            <p style={{fontSize:18,fontWeight:700,color:cs.text,marginBottom:8}}>
              {lang==="ar"?"كيف تقيّم Corvus؟":"How would you rate Corvus?"}
            </p>
            <p style={{fontSize:13,color:cs.muted,marginBottom:24}}>
              {lang==="ar"?"رأيك يساعدنا على التحسين":"Your feedback helps us improve"}
            </p>
            <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:20}}>
              {[1,2,3,4,5,6,7,8,9,10].map(n=>(
                <button className="liveui-focusable" key={n} onClick={async()=>{
                  try {
                    await apiFetch("/nps/submit",{method:"POST",body:{score:n,uid:profile?.uid}});
                    await updateUserProfile(profile?.uid,{last_nps_at:new Date().toISOString()});
                  } catch(_) {}
                  setShowNPS(false);
                  if(n>=9) toast(lang==="ar"?"شكراً! 🎉":"Thank you! 🎉","success");
                }}
                  style={{width:36,height:36,borderRadius:8,border:`1px solid ${cs.border}`,background:cs.inp,color:cs.text,cursor:"pointer",fontSize:13,fontWeight:600,transition:"all .15s"}}
                  onMouseEnter={e=>{e.target.style.background=cs.blue;e.target.style.borderColor=cs.blue;}}
                  onMouseLeave={e=>{e.target.style.background=cs.inp;e.target.style.borderColor=cs.border;}}
                >{n}</button>
              ))}
            </div>
            <button className="liveui-focusable" onClick={()=>setShowNPS(false)} style={{fontSize:12,color:cs.muted,background:"none",border:"none",cursor:"pointer"}}>
              {lang==="ar"?"لاحقاً":"Dismiss"}
            </button>
          </div>
        </div>
      )}
      {/* ProductTour destructures onComplete, not onClose — was previously
          unreachable (no trigger called setShowProductTour(true) anywhere).
          Now wired to a "Take a Tour" item in the nav avatar dropdown. */}
      {showProductTour&&<ErrorBoundary key="producttour"><ProductTour profile={profile} cs={cs} lang={lang} onComplete={()=>setShowProductTour(false)}/></ErrorBoundary>}
      {showSecurityCenter&&<ErrorBoundary key="securitycenter"><Suspense fallback={null}><SecurityCenter user={user} profile={profile} cs={cs} lang={lang} onNavigate={setPage} onClose={()=>setShowSecurityCenter(false)} onSignOut={()=>{logOut();setShowSecurityCenter(false);setUser(null);setProfile(null);}}/></Suspense></ErrorBoundary>}
      {showAccountActivity&&<AccountActivity profile={profile} cs={cs} lang={lang} onClose={()=>setShowAccountActivity(false)}/> }
      {showMFASetup&&<ErrorBoundary key="mfasetup"><Suspense fallback={null}><MFASetup profile={profile} cs={cs} lang={lang} onClose={()=>setShowMFASetup(false)} onEnabled={()=>setShowMFASetup(false)} onProfileChange={p=>setProfile(prev=>({...prev,...p}))}/></Suspense></ErrorBoundary>}
      {showBillingDashboard&&<ErrorBoundary key="billingdashboard"><Suspense fallback={null}><BillingDashboard profile={profile} user={user} isAr={lang==="ar"} isAdmin={isAdmin} onClose={()=>setShowBillingDashboard(false)} onUpgrade={(plan)=>{setShowBillingDashboard(false);setShowBilling(true);}}/></Suspense></ErrorBoundary>}
      {showReferralProgram&&<ErrorBoundary key="referralprogram"><Suspense fallback={null}><ReferralProgram profile={profile} cs={cs} lang={lang} onClose={()=>setShowReferralProgram(false)}/></Suspense></ErrorBoundary>}
      {showIntegrationsHub&&<ErrorBoundary key="integrationshub"><Suspense fallback={null}><IntegrationsHub profile={profile} cs={cs} lang={lang} onClose={()=>setShowIntegrationsHub(false)}/></Suspense></ErrorBoundary>}
      {/* Phase 12 — Enterprise Scale */}
      {showEnterpriseAdmin&&isAdmin&&<EnterpriseAdminTools profile={profile} cs={cs} lang={lang} onClose={()=>setShowEnterpriseAdmin(false)}/>}

      {/* ── Session Result Modal ── */}
      {sessionResult&&(
        <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          {/* maxHeight+overflowY — this card has no cap on how much it can
              grow (top issue, worst-moment photos, trend badge, improvement
              tip, and pain summary are all optional, additive sections, and
              Elite sessions show every one of them at once), so on a
              shorter viewport the bottom of the card — down to the New
              Session / Dashboard / Download PDF / Share Report buttons —
              was pushed past the visible screen with no way to reach it. */}
          <div style={{background:"rgba(8,14,28,.98)",border:`1px solid ${sessionResult.color}55`,borderRadius:20,padding:"36px 32px",maxWidth:400,width:"100%",maxHeight:"90dvh",overflowY:"auto",textAlign:"center",boxShadow:"0 24px 80px rgba(0,0,0,.6)"}}>
            {/* Score ring */}
            <div style={{position:"relative",width:130,height:130,margin:"0 auto 20px"}}>
              <svg width="130" height="130" style={{transform:"rotate(-90deg)"}}>
                <circle cx="65" cy="65" r="55" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="9"/>
                <circle cx="65" cy="65" r="55" fill="none" stroke={sessionResult.color} strokeWidth="9"
                  strokeDasharray={`${(sessionResult?.avg_score/100)*345.6} 345.6`} strokeLinecap="round"/>
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <div style={{fontSize:36,fontWeight:800,color:sessionResult.color,lineHeight:1}}>{sessionResult?.avg_score}</div>
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
                {label:isAr?"مدة الجلسة":"Duration", value:`${Math.floor(sessionResult?.duration_s/60)}:${String(sessionResult?.duration_s%60).padStart(2,"0")}`},
                {label:isAr?"وضعية جيدة":"Good posture", value:`${sessionResult?.good_pct}%`},
                {label:isAr?"التنبيهات":"Alerts", value:sessionResult?.alerts_count},
              ].map((s,i)=>(
                <div key={i} style={{flex:1,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"10px 8px"}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#f0f6ff"}}>{s.value}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Top issue */}
            {sessionResult.top_metric&&(
              <div style={{background:"rgba(214,162,76,.07)",border:"1px solid rgba(214,162,76,.2)",borderRadius:12,padding:"10px 14px",marginBottom:20,textAlign:isAr?"right":"left"}}>
                <div style={{fontSize:11,color:darkMode?"#D6A24C":"#b45309",fontWeight:700,marginBottom:3}}>
                  {isAr?"أبرز مشكلة":"Top issue to fix"}
                </div>
                <div style={{fontSize:13,color:"#f0f6ff",fontWeight:500}}>
                  {isAr
                    ? `${METRIC_LABEL_AR[sessionResult.top_metric[0]]||sessionResult.top_metric[1]?.label} — النتيجة ${sessionResult.top_metric[1]?.score}/100`
                    : `${sessionResult.top_metric[1]?.label} — score ${sessionResult.top_metric[1]?.score}/100`}
                </div>
              </div>
            )}

            {/* The findings, explained. Naming the lowest-scoring metric tells
                a user which number was worst; it does not tell them what to
                change. Same panel, same wording, as the live session — so the
                summary cannot describe a measurement differently from the
                screen the user was just looking at. */}
            {sessionResult?.metrics && Object.keys(sessionResult.metrics).length > 0 && (
              <div style={{marginTop:14}}>
                <Suspense fallback={null}>
                  <FindingsPanel
                    metrics={sessionResult.metrics}
                    cs={cs} isAr={isAr}
                    calibrated={!!calibData?.tolerances}
                    variant="full"
                    onCalibrate={()=>{setSessionResult(null);setShowCalibWizard(true);}}
                  />
                </Suspense>
              </div>
            )}

            {/* Elite: worst-posture snapshots */}
            {sessionResult.worst_snapshots?.length>0&&(
              <div style={{marginBottom:20,textAlign:isAr?"right":"left"}}>
                <div style={{fontSize:11,color:"#4FAE8E",fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                  📸 {isAr?"أسوأ لحظات الجلسة":"Worst posture moments"}
                  <span style={{fontSize:8,background:"rgba(79,174,142,.12)",border:"1px solid rgba(79,174,142,.25)",borderRadius:99,padding:"1px 6px",fontWeight:800,letterSpacing:".04em"}}>ELITE</span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {(sessionResult.worst_snapshots||[]).map((s,i)=>(
                    <div key={i} style={{flex:1,position:"relative",borderRadius:12,overflow:"hidden",border:"1px solid rgba(198,96,79,.3)"}}>
                      <img src={s.img} alt={`posture ${s.score}`} style={{width:"100%",display:"block",transform:"scaleX(-1)"}}/>
                      <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,.65)",padding:"3px 6px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:10,fontWeight:800,color:s.score<40?"#C6604F":"#D6A24C"}}>{s.score}</span>
                        <span style={{fontSize:8,color:"rgba(255,255,255,.6)"}}>{s.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trend badge */}
            {sessionResult.trend && sessionResult.trend !== "stable" && (
              <div style={{display:"flex",alignItems:"center",gap:8,background:sessionResult.trend==="improving"?"rgba(79,174,142,.08)":"rgba(198,96,79,.08)",border:`1px solid ${sessionResult.trend==="improving"?"rgba(79,174,142,.25)":"rgba(198,96,79,.25)"}`,borderRadius:12,padding:"9px 14px",marginBottom:12}}>
                <span style={{fontSize:18}}>{sessionResult.trend==="improving"?"📈":"📉"}</span>
                <div style={{fontSize:12,color:sessionResult.trend==="improving"?"#4FAE8E":"#C6604F",fontWeight:600}}>
                  {sessionResult.trend==="improving"
                    ?(isAr?"وضعيتك تتحسن خلال هذه الجلسة 💪":"Your posture improved during this session 💪")
                    :(isAr?"وضعيتك تراجعت — خذ استراحة":"Posture declined — consider a break")}
                </div>
              </div>
            )}

            {/* Improvement tip */}
            {sessionResult.improvement_tip && (
              <div style={{background:"rgba(99,102,241,.07)",border:"1px solid rgba(99,102,241,.2)",borderRadius:12,padding:"10px 14px",marginBottom:12,textAlign:isAr?"right":"left"}}>
                <div style={{fontSize:10,color:darkMode?"#818cf8":"#4338ca",fontWeight:700,marginBottom:3}}>
                  💡 {isAr?"نصيحة للتحسين":"Improvement tip"}
                </div>
                <div style={{fontSize:12,color:"#e0e7ff",lineHeight:1.5}}>{sessionResult.improvement_tip}</div>
              </div>
            )}

            {/* Pain prediction */}
            {sessionResult.pain_summary && (
              <div style={{background:"rgba(214,162,76,.07)",border:"1px solid rgba(214,162,76,.25)",borderRadius:12,padding:"9px 14px",marginBottom:12}}>
                <div style={{fontSize:12,color:darkMode?"#D6A24C":"#b45309",fontWeight:600}}>{sessionResult.pain_summary}</div>
              </div>
            )}

            {/* CTAs */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {/* Share card.
                  ShareCard is fully built, and after every session scoring 70+
                  the app assembles shareCardData for it — but
                  setShowShareCard(true) existed nowhere, so the modal had never
                  once opened. Someone even fixed a data bug inside it. This is
                  the product's only organic growth loop and it was one call
                  away from working. */}
              {shareCardData && (
                <button className="liveui-focusable" onClick={()=>setShowShareCard(true)}
                  style={{padding:"12px",background:"transparent",color:cs.text,
                    border:`1px solid ${cs.border}`,borderRadius:12,fontSize:14,
                    fontWeight:700,cursor:"pointer"}}>
                  {isAr?"📤 شارك نتيجتك":"📤 Share your score"}
                </button>
              )}
              <button className="liveui-focusable" onClick={()=>{setSessionResult(null);setPage("live");setTimeout(()=>startCamera(),300);}}
                style={{padding:"12px",background:`linear-gradient(135deg,#1a56db,#0891b2)`,color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer"}}>
                {isAr?"▶ جلسة جديدة":"▶ New Session"}
              </button>
              <div style={{display:"flex",gap:10}}>
                <button className="liveui-focusable" onClick={()=>{
                    setSessionResult(null);
                    if(window.__demoMode){ setPage("demo_dashboard"); return; }
                    // Refresh sessions before going home so Sessions tab is up to date
                    if(user) getUserSessions(user.uid).then(setUserSessions).catch(()=>{});
                    setPage("home");
                  }}
                  style={{flex:1,padding:"10px",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  {isAr?"لوحة التحكم":"Dashboard"}
                </button>
<button className="liveui-focusable" onClick={async ()=>{
                  // Same canonical gate as downloadPDF() — this button bypassed it
                  // entirely by calling generateSessionPDF() directly.
                  if(qualityFor(effectiveTier).pdfDetail === "none"){
                    addToast(isAr?"تصدير PDF متاح من خطة Professional فأعلى":"PDF export requires Professional plan or higher","warn");
                    setShowUpgrade?.(true); setUpgradeReason?.(isAr?"تصدير PDF":"PDF export");
                    return;
                  }
                  addToast(isAr?"جاري إنشاء PDF...":"Generating PDF...","info");
                  try {
                    const { generateSessionPDF } = await import("./lib/pdfReports.js");
                    await generateSessionPDF({
                      session: {
                        ...sessionResult,
                        created_at: new Date(), mode, tier: effectiveTier,
                        session_id: sessionId,
                        score_history: sessionResult.score_history||histRef.current||[],
                        metrics: sessionResult.metrics||lastAnalRef.current?.metrics||{},
                      },
                      profile: { ...profile, tier: effectiveTier },
                      allSessions: userSessions,
                      aiSummary: lastAnalRef.current?.ai_tip||lastAnalRef.current?.ai_insight||sessionResult.ai_tip||"",
                    });
                    addToast(isAr?"✅ تم تحميل PDF":"✅ PDF downloaded","success");
                  } catch(e) {
                    addToast("PDF error: "+(e?.message||"unknown"),"error");
                  }
                }}
                  style={{flex:1,padding:"10px",background:qualityFor(effectiveTier).pdfDetail==="none"?"rgba(255,255,255,.05)":effectiveTier==="elite"?"rgba(79,174,142,.15)":"rgba(99,102,241,.15)",color:qualityFor(effectiveTier).pdfDetail==="none"?"rgba(255,255,255,.4)":effectiveTier==="elite"?"#6ee7b7":"#a5b4fc",border:`1px solid ${qualityFor(effectiveTier).pdfDetail==="none"?"rgba(255,255,255,.1)":effectiveTier==="elite"?"rgba(79,174,142,.3)":"rgba(99,102,241,.3)"}`,borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  {qualityFor(effectiveTier).pdfDetail==="none" ? `🔒 ${isAr?"تنزيل PDF (Pro+)":"Download PDF (Pro+)"}` : `📄 ${effectiveTier==="elite"?(isAr?"تنزيل PDF Elite":"Download Elite PDF"):(isAr?"تنزيل PDF":"Download PDF")}`}
                </button>
                {/* Share button — Elite only. Was gated on raw `tier`, which
                    doesn't reflect trial_tier elevation or the b2b_enterprise
                    -> elite equivalence, so a trialing/B2B-enterprise user
                    could lose this button entirely even though every other
                    Elite check on this same page correctly uses effectiveTier. */}
                {tierAtLeast(effectiveTier,"elite") && (
                  <button className="liveui-focusable" onClick={()=>shareReport({
                      avg_score: sessionResult?.avg_score, good_pct: sessionResult?.good_pct,
                      duration_s: sessionResult?.duration_s, alerts_count: sessionResult?.alerts_count,
                      mode, tier: effectiveTier, session_id: sessionId,
                      score_history: sessionResult?.score_history||histRef.current||[],
                      metrics: lastAnalRef.current?.metrics||{},
                      ai_tip: lastAnalRef.current?.ai_tip||lastAnalRef.current?.ai_insight||"",
                      improvement_tip: lastAnalRef.current?.improvement_tip||"",
                      created_at: new Date(),
                    })}
                    style={{flex:1,padding:"10px",background:"rgba(99,102,241,.12)",
                      color:darkMode?"#a5b4fc":"#4338ca",border:"1px solid rgba(99,102,241,.3)",
                      borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                    🔗 {isAr?"شارك التقرير":"Share Report"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LEFT PANEL — stats & history ──
          On mobile, order is decoupled from language: this panel (deeper
          history/back-button/detailed stats) always renders SECOND so users
          land on the camera + Start button first, not a wall of empty stats.
          Previously order was isAr-only, which meant Arabic (this app's
          default language) mobile users saw the camera full-width first
          anyway but with no way back except scrolling past it; English
          mobile users saw the opposite (stats first, camera unreachable
          without scrolling) — inconsistent either way. */}
      <div style={{
        display:"flex", flexDirection:"column",
        overflowY:"auto", background:cs.bg,
        // Reverted per explicit user preference: camera small (320px) on
        // the right, stats panel wide — the original arrangement. This
        // panel (stats) goes in the WIDE 1fr track again.
        order: isMobile ? 1 : (isAr ? 1 : 0),
        // No border here: the camera sidebar next to it already draws the
        // divider on this exact seam, so both painted and the column edge came
        // out 2px where every other rule on the page is 1px. On mobile the two
        // panels stack full-width, where this rendered as a stray vertical line
        // down the side of the stats block.
        borderRight:"none",
        borderLeft:"none",
        minWidth:0,
      }}>
        {/* Session Summary — clearly secondary to the live camera view (per
            design brief): compact stat tiles instead of a full-bleed 4-up
            grid competing for visual weight. */}
        <SectionCard title={isAr?"ملخص الجلسة":"Session Summary"} icon="barChart" cs={cs} style={{margin:"14px 16px 0"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <StatTile cs={cs} label={isAr?"متوسط النقاط":"Avg Score"} value={avg||"--"} tone={avg?(avg>=70?"good":avg>=55?"warn":"bad"):"neutral"}/>
            <StatTile cs={cs} label={isAr?"وقت الجلسة":"Session Time"} value={fmtTime(sessionTime)} tone="neutral"/>
            <StatTile cs={cs} label={isAr?"وضعية جيدة":"Good Posture"} value={gPct+"%"} tone="good"/>
            <StatTile cs={cs} label={isAr?"التنبيهات":"Alerts"} value={alertCounts.total} tone={alertCounts.total>0?"warn":"neutral"}/>
          </div>
        </SectionCard>

        {/* Onboarding / calibration guidance — single card, priority-ordered.
            Previously this was two separate stacked banners (calibration +
            "press start" empty state) that both rendered at once for a
            first-time uncalibrated user — two bordered boxes making the
            same basic point ("do something before you start") right on
            top of each other. Now it's one card: calibration takes
            priority when it applies (it's the higher-value action), the
            plain welcome only shows for an already-calibrated user who
            simply hasn't run a session yet. */}
        {!camActive && (!calibData ? true : sessionTime===0 && avg===0) && (()=>{
          const needsCalib = !calibData;
          const col = needsCalib ? "#D6A24C" : (TN?.color || "#1a56db");
          return (
            <div style={{margin:"10px 16px",background:`${col}0f`,
              border:`1px solid ${col}40`,borderRadius:12,padding:"12px 14px",
              display:"flex",alignItems:"flex-start",gap:11}}>
              <span style={{fontSize:18,flexShrink:0,lineHeight:1.3}}>{needsCalib?"⚙️":"▶"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:col,marginBottom:3}}>
                  {needsCalib
                    ? (isAr?"الوضعية غير معايرة — النتائج تقريبية":"Not calibrated — results are approximate")
                    : (isAr?"اضغط ابدأ التحليل للبدء":"Press Start Analysis to begin")}
                </div>
                <div style={{fontSize:11,color:cs.muted,lineHeight:1.55}}>
                  {needsCalib
                    ? (isAr?"اعمل معايرة سريعة (10 ثواني) للحصول على درجة دقيقة مخصصة لوضعيتك الطبيعية":"A quick 10-second calibration gets you a score tuned to your natural posture")
                    : (isAr?"Corvus هيحلل وضعيتك لحظياً ويديك درجة ونصائح فورية":"Corvus will analyse your posture live and give you a score + instant tips")}
                </div>
                {userSessions?.length > 0 && (
                  <div style={{marginTop:6,fontSize:10,color:cs.muted}}>
                    {isAr?`آخر جلسة: ${userSessions[0]?.avg_score||0}/100`:`Last session: ${userSessions[0]?.avg_score||0}/100`}
                  </div>
                )}
              </div>
              {needsCalib && (
                <button className="liveui-focusable" onClick={()=>setShowCalibWizard(true)}
                  style={{fontSize:10,fontWeight:700,padding:"6px 11px",
                    background:`${col}1a`,border:`1px solid ${col}55`,
                    borderRadius:8,color:col,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                  {isAr?"معايرة الآن":"Calibrate →"}
                </button>
              )}
            </div>
          );
        })()}

        {/* Score history chart */}
        <div style={{margin:"0 16px 12px",background:cs.card,border:`1px solid ${cs.border}`,borderRadius:12,padding:"12px 14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:cs.muted,textTransform:"uppercase",letterSpacing:".05em"}}>
              {isAr?"سجل النقاط":"Score History"}
            </div>
            {history.length>0&&(
              <div style={{fontSize:13,fontWeight:800,color:sc(history[history.length-1]||0),fontVariantNumeric:"tabular-nums"}}>
                {history[history.length-1]||0}/100
              </div>
            )}
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:2,height:68,position:"relative"}}>
            <div style={{position:"absolute",left:0,right:0,top:`${(1-80/100)*68}px`,
              borderTop:"1px dashed rgba(79,174,142,.2)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",left:0,right:0,top:`${(1-60/100)*68}px`,
              borderTop:"1px dashed rgba(214,162,76,.18)",pointerEvents:"none"}}/>
            {(history.length?history:Array(40).fill(0)).map((s,i)=>{
              const isLast=i===history.length-1;
              // Bars are pushed at a roughly even cadence across the session,
              // so distributing elapsed time evenly across them gives a
              // reasonable "when was this" estimate for the tooltip without
              // needing to store a timestamp per sample.
              const barsAgo = history.length-1-i;
              const secAgo = history.length>1 ? Math.round(barsAgo*(sessionTime/(history.length-1))) : 0;
              const atSec = Math.max(0, sessionTime-secAgo);
              return (
                <div key={i}
                  onMouseEnter={()=>history.length&&setHoverBarIdx(i)}
                  onMouseLeave={()=>setHoverBarIdx(null)}
                  onClick={()=>history.length&&setHoverBarIdx(prev=>prev===i?null:i)}
                  style={{flex:1, position:"relative", height:"100%", display:"flex", alignItems:"flex-end", cursor:history.length?"pointer":"default"}}>
                  {hoverBarIdx===i && s>0 && (
                    <div style={{
                      position:"absolute",bottom:"calc(100% + 6px)",insetInlineStart:"50%",transform:"translateX(-50%)",
                      background:cs.card2||cs.card,border:`1px solid ${cs.border}`,borderRadius:8,padding:"4px 8px",
                      fontSize:10,fontWeight:700,color:cs.text,whiteSpace:"nowrap",zIndex:20,pointerEvents:"none",
                      fontVariantNumeric:"tabular-nums",
                      boxShadow:"0 4px 12px rgba(0,0,0,.4)",
                    }}>
                      {isAr?`النتيجة: ${s} عند ${Math.floor(atSec/60)}:${String(atSec%60).padStart(2,"0")}`:`Score: ${s} at ${Math.floor(atSec/60)}:${String(atSec%60).padStart(2,"0")}`}
                    </div>
                  )}
                  {isLast && s>0 && (
                    <div style={{
                      position:"absolute",bottom:"calc(100% + 4px)",insetInlineEnd:-2,
                      fontSize:8,fontWeight:800,color:sc(s),letterSpacing:".03em",
                      opacity:hoverBarIdx===i?0:1,
                    }}>
                      {isAr?"الآن":"Now"}
                    </div>
                  )}
                  <div style={{
                    width:"100%", borderRadius:"3px 3px 0 0",
                    minHeight:2,
                    height: s ? Math.max(2,Math.round(s*.64)) : 2,
                    background: s ? sc(s) : cs.inp,
                    transition:"height .3s ease",
                    opacity: s ? (hoverBarIdx===i ? 1 : 0.8) : 1,
                    boxShadow: isLast&&s ? `0 0 8px ${sc(s)}60` : "none",
                  }}/>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:5,fontSize:9,color:cs.muted}}>
            <span>{isAr?"الأقدم":"Oldest"}</span>
            <div style={{display:"flex",gap:8}}>
              <span style={{color:"rgba(79,174,142,.6)"}}>━ 80</span>
              <span style={{color:"rgba(214,162,76,.5)"}}>━ 60</span>
            </div>
            <span>{isAr?"الأحدث":"Newest"}</span>
          </div>
        </div>

        {/* AI insight now lives ONLY in the right sidebar's <AICoachCard>
            (see "AI Coach" below, next to the camera) — this left-panel copy
            used to render the exact same `aiInsight` text under a different
            heading ("AI Analysis") whenever camActive, and its own separate
            "upgrade to Elite" locked-hint duplicated the sidebar card's own
            locked state too, so non-Elite users during a live session could
            see two different "upgrade to unlock AI" prompts on screen at
            once. Removed here; the sidebar version already covers both the
            shown-insight and locked states. */}

        {/* Recommendations */}
        {analysis?.recommendations&&(
          <div style={{margin:"0 16px 12px",background:cs.card,border:`1px solid ${cs.border}`,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:10,fontWeight:700,color:cs.muted,textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>
              {isAr?"التوصيات":"Recommendations"}
            </div>
            {analysis.recommendations.map((r,i)=>(
              <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:i<analysis.recommendations.length-1?`1px solid ${cs.border}`:"none"}}>
                <span style={{color:darkMode?"#6ee7b7":"#15803d",flexShrink:0,fontSize:12}}>✓</span>
                <span style={{fontSize:12,color:cs.text,lineHeight:1.5}}>{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* Session Insights — pattern-level observations, distinct from real-time alerts */}
        {sessionInsights.length>0&&(
          <div style={{margin:"0 16px 16px",background:cs.card,border:`1px solid ${cs.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${cs.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:10,fontWeight:700,color:cs.muted,textTransform:"uppercase",letterSpacing:".05em"}}>
                {isAr?"ملاحظات الجلسة":"Session Insights"}
              </div>
              <span style={{fontSize:10,fontWeight:700,color:"#6366f1",background:"rgba(99,102,241,.12)",
                borderRadius:99,padding:"1px 7px"}}>{sessionInsights.length}</span>
            </div>
            {sessionInsights.slice(0,5).map((ins,i)=>(
              <div key={i} style={{display:"flex",gap:8,padding:"10px 14px",
                borderBottom:i<Math.min(sessionInsights.length,5)-1?`1px solid ${cs.border}`:"none",
                alignItems:"flex-start", background:i===0?"rgba(99,102,241,.04)":"transparent"}}>
                <span style={{fontSize:14,flexShrink:0}}>{ins.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:cs.text,lineHeight:1.5}}>{isAr?ins.textAr:ins.text}</div>
                  <div style={{fontSize:9,color:cs.muted,fontFamily:"monospace",marginTop:3}}>{ins.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Alert log */}
        {alerts.length>0&&(
          <div style={{margin:"0 16px 16px",background:cs.card,border:`1px solid ${cs.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${cs.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:10,fontWeight:700,color:cs.muted,textTransform:"uppercase",letterSpacing:".05em"}}>
                {isAr?"سجل التنبيهات":"Alert Log"}
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                {alerts.length>0&&<button className="liveui-focusable" onClick={()=>setAlerts([])} aria-label={isAr?"مسح كل التنبيهات":"Clear all alerts"} style={{fontSize:9,color:cs.muted,background:"none",border:"none",cursor:"pointer",padding:"6px 8px",minHeight:28}}>✕ {isAr?"مسح":"clear"}</button>}
                <span style={{fontSize:10,fontWeight:700,color:"#C6604F",background:"rgba(198,96,79,.12)",borderRadius:99,padding:"1px 7px"}}>{alerts.length}</span>
              </div>
            </div>
            {alerts.slice(0,3).map((a,i)=>{
              const sev = a.severity==="severe"||a.score<40 ? "severe"
                        : a.severity==="moderate"||a.score<55 ? "moderate" : "mild";
              const sevColor = sev==="severe"?"#C6604F":sev==="moderate"?"#f97316":"#D6A24C";
              const sevLabel = sev==="severe"?(isAr?"حرج":"Critical"):sev==="moderate"?(isAr?"متوسط":"Moderate"):(isAr?"خفيف":"Mild");
              const tips = FIX_TIPS[a.cause]||FIX_TIPS.default;
              const isOpen = fixItOpen===i;
              return (
                <div key={i} style={{borderBottom:i<Math.min(alerts.length,3)-1?`1px solid ${cs.border}`:"none",background:i===0?`${sevColor}06`:"transparent"}}>
                  <div style={{display:"flex",gap:8,padding:"8px 14px",alignItems:"flex-start"}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:sevColor,flexShrink:0,marginTop:5}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{fontSize:11,color:cs.text,lineHeight:1.4,display:"block"}}>{a.msg}</span>
                      <span style={{fontSize:9,color:cs.muted}}>{timeAgo(a.time)}</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                      <span style={{fontSize:9,fontWeight:700,color:sevColor,background:`${sevColor}15`,borderRadius:8,padding:"1px 5px"}}>{sevLabel}</span>
                      {/* #8 Fix-it button */}
                      <button className="liveui-focusable" onClick={()=>setFixItOpen(isOpen?null:i)} style={{
                        fontSize:9,fontWeight:600,color:darkMode?"#a5b4fc":"#4338ca",background:"rgba(99,102,241,.1)",
                        border:"1px solid rgba(99,102,241,.25)",borderRadius:8,padding:"2px 6px",cursor:"pointer",
                      }}>{isOpen?(isAr?"✕":"✕"):(isAr?"كيف أصلح؟":"Fix it →")}</button>
                    </div>
                  </div>
                  {/* #8 Fix-it expanded card */}
                  {isOpen&&(
                    <div style={{margin:"0 10px 8px",background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.2)",borderRadius:8,padding:"10px 12px"}}>
                      <div style={{fontSize:10,fontWeight:700,color:darkMode?"#a5b4fc":"#4338ca",marginBottom:6}}>{tips.icon} {isAr?"الحل:":"How to fix:"}</div>
                      {(isAr?(tips.stepsAr||tips.steps):tips.steps).map((s,si)=>(
                        <div key={si} style={{display:"flex",gap:6,marginBottom:4,alignItems:"flex-start"}}>
                          <span style={{fontSize:10,color:darkMode?"#a5b4fc":"#4338ca",fontWeight:700,flexShrink:0}}>{si+1}.</span>
                          <span style={{fontSize:10,color:cs.text,lineHeight:1.5}}>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {alerts.length > 3 && (
              <div style={{padding:"8px 14px",borderTop:`1px solid ${cs.border}`,textAlign:"center"}}>
                <span style={{fontSize:10,color:cs.muted}}>
                  {isAr?`+ ${alerts.length-3} تنبيه آخر`:`+ ${alerts.length-3} more alerts`}
                  {" — "}{isAr?"الأحدث في الأعلى":"newest shown above"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* #9 Weekly pattern card */}
        {weeklyPattern&&!camActive&&(
          <div style={{margin:"0 16px 16px",background:"rgba(99,102,241,.05)",border:"1px solid rgba(99,102,241,.2)",borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:10,fontWeight:700,color:darkMode?"#a5b4fc":"#4338ca",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>
              📊 {isAr?"نمط هذا الأسبوع":"This Week's Pattern"}
            </div>
            <div style={{fontSize:11,color:cs.text,lineHeight:1.6,marginBottom:6}}>{weeklyPattern.summary}</div>
            {weeklyPattern.topCause&&(
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:10,color:"#C6604F",fontWeight:700}}>{weeklyPattern.pct}%</span>
                <span style={{fontSize:10,color:cs.muted}}>{weeklyPattern.topCause}</span>
              </div>
            )}
            <div style={{fontSize:9,color:cs.muted}}>{weeklyPattern.tip}</div>
          </div>
        )}

        <div style={{height:24}}/>
      </div>

      {/* ── RIGHT SIDEBAR — camera + controls ── */}
      <div style={{
        background:cs.card,
        // sole owner of the column divider (see the stats panel above); dropped
        // on mobile, where the columns stack and there is no seam to divide
        borderLeft:  isMobile ? "none" : (isAr ? "none" : `1px solid ${cs.border}`),
        borderRight: isMobile ? "none" : (isAr ? `1px solid ${cs.border}` : "none"),
        display:"flex", flexDirection:"column",
        maxHeight: isMobile ? "auto" : "100vh",
        overflowY:"auto",
        // Reverted per explicit user preference: camera stays small (320px)
        // on the right, matching the stats panel's order revert above.
        order: isMobile ? 0 : (isAr ? 0 : 1),
        position: isMobile ? "static" : "sticky",
        top: 0,
      }}>
        {/* Unified Live Header — replaces the old sidebar header + separate
            status-bar row + the desktop-only top bar that used to live in
            the left panel. One compact, always-visible (sticky sidebar)
            header instead of three fragments repeating the same facts
            (back nav, tier/mode, AI status, timer) in different places. */}
        <LiveHeader
          isAr={isAr} cs={cs} darkMode={darkMode}
          onBack={backFromLive}
          onToggleDark={()=>setDarkMode(!darkMode)}
          onToggleLang={()=>setLang(lang==="en"?"ar":"en")}
          mpStatus={mpStatus}
          aiCoachStatus={aiCoachStatus}
          camActive={camActive}
          timeLabel={fmtTime(sessionTime)}
          tierLabel={[TN?.name,M_?.label].filter(Boolean).join(" · ")}
          showUpgrade={!camActive && !tierAtLeast(effectiveTier,"basic")}
          onUpgrade={()=>setShowBilling(true)}
        />

        {/* ── Quick Start Banner (for users who skipped onboarding) ─── */}
        {profile?.onboarding_done?.[0]==="skipped" && !score && (
          <div style={{margin:"10px 14px",background:"rgba(26,86,219,.08)",border:"1px solid rgba(26,86,219,.2)",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>👋</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:darkMode?"#93c5fd":"#1e40af"}}>
                {isAr?"هل تريد جولة سريعة؟":"Want a quick tour?"}
              </div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>
                {isAr?"اضغط لإعادة معالج الإعداد":"Tap to restart the setup wizard"}
              </div>
            </div>
            <button className="liveui-focusable" onClick={()=>setShowOnboard(true)}
              style={{background:"rgba(26,86,219,.2)",border:"1px solid rgba(26,86,219,.35)",borderRadius:8,padding:"5px 11px",fontSize:10,color:darkMode?"#93c5fd":"#1e40af",cursor:"pointer",fontWeight:700,flexShrink:0}}>
              {isAr?"إعادة":"Restart"}
            </button>
          </div>
        )}

        {/* Camera feed */}
        <div ref={camWrapRef} style={{position:"relative",background:"#020810",flexShrink:0,
          ...(isFs?{width:"100vw",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}:{aspectRatio:"4/3"})}}>
          <video ref={vidRef} autoPlay muted playsInline
            style={{width:"100%",height:"100%",objectFit:isFs?"contain":"cover",transform:"scaleX(-1)",display:"block"}}/>
          <canvas ref={ovRef} style={{position:"absolute",inset:0,width:"100%",height:"100%",transform:"scaleX(-1)",objectFit:isFs?"contain":"cover"}}/>
          <canvas ref={canvRef} style={{display:"none"}}/>

          {/* Viewfinder frame — this is a computer-vision scanner, so the
              signature visual treatment is a scan reticle (not a generic
              rounded video box). Corners read as a status light: dim while
              idle, brand color while a good-quality frame is being read,
              warm amber when the current frame fails the quality gate
              (too close/far/cropped) — the same signal as the text badge
              below, but visible at a glance without reading anything. */}
          {(()=>{
            const badQuality = camActive && analysis?.qualityScore != null && analysis.qualityScore < 100;
            const vfColor = !camActive ? "rgba(255,255,255,.22)" : badQuality ? "#D6A24C" : (TN?.color || cs.blue);
            const corner = (top, left) => ({
              position:"absolute", width:26, height:26, [top?"top":"bottom"]:10, [left?"left":"right"]:10,
              borderTop: top ? `2.5px solid ${vfColor}` : "none",
              borderBottom: !top ? `2.5px solid ${vfColor}` : "none",
              borderLeft: left ? `2.5px solid ${vfColor}` : "none",
              borderRight: !left ? `2.5px solid ${vfColor}` : "none",
              borderRadius: top&&left?"8px 0 0 0":top&&!left?"0 8px 0 0":!top&&left?"0 0 0 8px":"0 0 8px 0",
              opacity: camActive && !badQuality ? 1 : 0.65,
              transition:"border-color .3s ease, opacity .3s ease",
              pointerEvents:"none", zIndex:12,
            });
            return (
              <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:12}}>
                <div style={corner(true,true)}/><div style={corner(true,false)}/>
                <div style={corner(false,true)}/><div style={corner(false,false)}/>
              </div>
            );
          })()}

          {/* Fullscreen / focus-mode toggle */}
          <button className="liveui-focusable" onClick={toggleFullscreen}
            title={isFs?(isAr?"إنهاء ملء الشاشة":"Exit fullscreen"):(isAr?"ملء الشاشة":"Fullscreen")}
            aria-label={isFs?(isAr?"إنهاء ملء الشاشة":"Exit fullscreen"):(isAr?"ملء الشاشة":"Fullscreen")} style={{
            // Was hardcoded right:8 — unlike its sibling overlays on this
            // same video (status pill, distance chip) which mirror for isAr.
            position:"absolute",bottom:8,
            left:isAr?8:"auto", right:isAr?"auto":8, zIndex:20,
            width:32,height:32,borderRadius:8,
            background:"rgba(2,8,16,.8)",border:"1px solid rgba(255,255,255,.15)",
            backdropFilter:"blur(6px)",color:"#e2e8f0",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,
          }}><Icon name={isFs?"collapse":"expand"} size={15} color="#e2e8f0"/></button>

          {/* QA accuracy-test trigger — dev/founder tool, not part of the
              normal user flow. Deliberately small and unlabeled-by-default
              (icon only) so it doesn't read as a real feature to regular
              users, but still reachable without digging through devtools. */}
          {camActive && (
            <button className="liveui-focusable" onClick={()=>setShowQATest(true)}
              title={isAr?"اختبار دقة QA":"QA accuracy test"}
              aria-label={isAr?"اختبار دقة QA":"QA accuracy test"} style={{
              position:"absolute",bottom:8,
              left:isAr?"auto":8, right:isAr?8:"auto", zIndex:20,
              width:32,height:32,borderRadius:8,
              background:"rgba(2,8,16,.8)",border:"1px solid rgba(255,255,255,.15)",
              backdropFilter:"blur(6px)",color:"#e2e8f0",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,
            }}>🧪</button>
          )}

          {/* AI model loading overlay — the camera permission/feed itself
              resolves in a couple seconds, but the pose-detection model
              (a few MB, first load only, then cached) can take up to a
              minute on a slower connection. Until now the ONLY feedback for
              that wait was a small pulsing status dot — the camera looked
              "on" with a live feed and zero scores updating, which reads as
              broken/frozen rather than "still loading, one moment." */}
          {camActive && mpStatus==="loading" && (
            <div style={{
              position:"absolute",inset:0,display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",gap:14,
              background:"rgba(2,8,16,.88)",backdropFilter:"blur(4px)",zIndex:15,
            }}>
              <div style={{width:44,height:44,border:"3px solid rgba(255,255,255,.08)",
                borderTopColor:TN?.color||"#1a56db",borderRadius:"50%",animation:"spin .9s linear infinite"}}/>
              <div style={{textAlign:"center",padding:"0 28px"}}>
                <div style={{fontSize:15,fontWeight:800,color:"#f0f6ff",marginBottom:6}}>
                  {isAr?"جاري تحميل نموذج الـ AI…":"Loading AI model…"}
                </div>
                <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.6}}>
                  {isAr?"بيحصل بس أول مرة — المرات الجاية فورية":"First time only — future sessions are instant"}
                </div>
              </div>
              {/* Animated progress bar. The actual work happening behind this
                  screen — WASM compile + GPU delegate init for the pose
                  model — can genuinely stall the JS main thread for a
                  stretch on a slower device. Animating `width` needs a
                  layout pass on that same main thread every frame, so the
                  bar itself would freeze mid-fill for exactly that stretch
                  — the one moment this screen exists to reassure the user
                  it's "still loading, one moment" instead reads as "even
                  the loading bar is stuck." `transform:scaleX` is handled
                  by the compositor and keeps animating smoothly regardless
                  of what the main thread is doing (same reason the spinner
                  above, which already animates `transform`, doesn't have
                  this problem). */}
              <div style={{width:200}}>
                <div style={{height:5,background:"rgba(255,255,255,.07)",borderRadius:99,overflow:"hidden"}}>
                  <div style={{
                    height:"100%",width:"100%",borderRadius:99,transformOrigin:"0% 50%",
                    background:`linear-gradient(90deg,${TN?.color||"#1a56db"},#0891b2)`,
                    animation:"modelLoad 12s ease-in-out forwards",
                  }}/>
                </div>
                <style>{`@keyframes modelLoad{0%{transform:scaleX(.04)}30%{transform:scaleX(.4)}70%{transform:scaleX(.75)}90%{transform:scaleX(.9)}100%{transform:scaleX(.95)}}`}</style>
                <div style={{fontSize:10,color:"#94a3b8",textAlign:"center",marginTop:7}}>
                  {isAr?"يُحفظ تلقائياً — المرة الجاية يفتح فورًا":"Cached automatically after this"}
                </div>
              </div>
            </div>
          )}

          {/* Backend-fallback failure overlay — local MediaPipe isn't
              available (mpStatus==="fallback") and /api/analyze has failed
              3 times in a row. Without this the camera feed just sits
              there with no score ever updating and zero explanation. */}
          {camActive && backendDown && (
            <CameraOverlay align="center">
              <div style={{width:44,height:44,borderRadius:LT.radius.md,background:liveAlpha(LT.color.bad,0.14),
                border:`1px solid ${liveAlpha(LT.color.bad,0.35)}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon name="alertTriangle" size={22} color={LT.color.bad}/>
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:"#f0f6ff",marginBottom:6}}>
                  {isAr?"تعذر الوصول لخادم التحليل":"Can't reach the analysis server"}
                </div>
                <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.6,maxWidth:280}}>
                  {isAr?"جهازك مش شغال بالتحليل المحلي دلوقتي، والسيرفر مش بيرد. تأكد من الإنترنت وحاول تاني":"Local analysis isn't available on this device right now, and the server isn't responding. Check your connection and retry"}
                </div>
              </div>
              <LiveBtn variant="ghost" icon="refresh" cs={{muted:"#e2e8f0",border:"rgba(148,163,184,.25)"}}
                onClick={()=>{ backendFailRef.current=0; backendFailShownRef.current=false; setBackendDown(false); }}>
                {isAr?"حاول تاني":"Retry"}
              </LiveBtn>
            </CameraOverlay>
          )}


          {previewPhase==="preview" && (
            <div style={{
              position:"absolute",inset:0,display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"flex-end",padding:"0 0 22px",
              background:"linear-gradient(to top, rgba(2,8,16,.85), transparent 45%)",zIndex:15,
              animation:`liveuiFadeIn ${LT.duration.base}ms ease`,
            }}>
              <div style={{fontSize:12,color:"#e2e8f0",marginBottom:12,textAlign:"center",padding:"0 20px"}}>
                {isAr?"اتأكد إنك ظاهر كويس في الكاميرا، وابدأ لما تجهز":"Make sure you're framed well, then start when you're ready"}
              </div>
              <div style={{display:"flex",gap:10}}>
                <LiveBtn size="lg" variant="ghost" cs={{muted:"#fff",border:"rgba(255,255,255,.2)"}} onClick={cancelPreview}>
                  {isAr?"إلغاء":"Cancel"}
                </LiveBtn>
                <LiveBtn size="lg" variant="primary" icon="play" cs={{blue:"#1a56db"}} onClick={confirmStartSession}
                  style={{boxShadow:"0 4px 14px rgba(26,86,219,.33)"}}>
                  {isAr?"ابدأ الجلسة الآن":"Start session now"}
                </LiveBtn>
              </div>
            </div>
          )}

          {/* Paused — analysis + timer frozen, camera stays attached so
              resume is instant. Distinct from "Break now", which keeps the
              session running invisibly in the background; this actually
              stops. Excludes backendDown: both are full-bleed CameraOverlay
              instances with no mutual exclusion, so pausing during a real
              backend outage used to stack "Session paused" directly on top
              of "Can't reach the analysis server" — two scrims, two
              messages, unreadable. The backend error (with its own Retry
              action) takes priority while it's showing; this overlay
              reappears as soon as backendDown clears, since isPaused is
              untouched either way. */}
          {camActive && isPaused && !backendDown && (
            <CameraOverlay align="center">
              <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon name="pause" size={22} color="#fff"/>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>
                {isAr?"الجلسة متوقفة مؤقتاً":"Session paused"}
              </div>
              <LiveBtn size="lg" variant="primary" icon="play" cs={{blue:"#1a56db"}} onClick={resumeSession}
                style={{boxShadow:"0 4px 14px rgba(26,86,219,.33)"}}>
                {isAr?"استكمال":"Resume"}
              </LiveBtn>
            </CameraOverlay>
          )}

          {/* 3-2-1 countdown right before scoring actually begins — Cancel
              stays visible and cancels the countdown + closes the camera,
              same as during preview. */}
          {previewPhase==="countdown" && (
            <CameraOverlay align="center">
              <CountdownRing n={countdownN} />
              <LiveBtn variant="ghost" cs={{muted:"#fff",border:"rgba(255,255,255,.2)"}} onClick={cancelPreview}>
                {isAr?"إلغاء":"Cancel"}
              </LiveBtn>
            </CameraOverlay>
          )}

          {/* Starting-session transition — bridges the 3-2-1 countdown ending
              (previewPhase→null) and camActive actually flipping true, which
              can take up to ~1.2s (see the startSession race comment in
              beginScoring()). Without this, the idle-cue overlay right below
              briefly flashed back on during that gap, reading as the page
              freezing or resetting rather than starting normally. */}
          {startingSession && (
            <CameraOverlay align="center">
              <StartingRing label={isAr?"جاري بدء الجلسة...":"Starting session..."} />
            </CameraOverlay>
          )}

          {/* Idle-state visual cue — previously the camera area was just a black box
              with no indication a click was needed. First-time users had no way to
              know to press "Start Analysis" below. Must NOT show during preview/
              countdown/starting — camActive is still false during all three (correct,
              scoring hasn't started), so without excluding them this rendered on
              top of those overlays' own text simultaneously, garbled — and during
              the starting gap specifically, it read as the session resetting. */}
          {!camActive && !previewPhase && !startingSession && cameraStatus!=="requesting" && (
            <div style={{
              position:"absolute",inset:0,display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",gap:10,
              background:"rgba(2,8,16,.55)",backdropFilter:"blur(2px)",
              pointerEvents:"none",
            }}>
              {/* Was one static "Tap Start Analysis" message regardless of
                  cameraStatus — including while the status pill (below) was
                  already saying "Denied" and the Start button (further
                  below) had switched to "🔄 Retry". Match this overlay's
                  copy to the actual error instead of repeating the generic
                  first-run instruction over it. */}
              <GuidanceHint icon="camera"
                title={
                  cameraStatus==="denied"
                    ? (isAr?"الوصول للكاميرا مرفوض — اسمح بالوصول من إعدادات المتصفح":"Camera access denied — allow it in your browser settings")
                    : cameraStatus==="no-device"
                      ? (isAr?"مفيش كاميرا متاحة على الجهاز ده":"No camera found on this device")
                      : (isAr?"اضغط \"ابدأ التحليل\" أدناه للبدء":"Tap \"Start Analysis\" below to begin")
                }
                cs={cs}/>
              <div style={{fontSize:16,color:"rgba(255,255,255,.5)",animation:"bounceDown 1.4s infinite"}}>
                <Icon name="chevronDown" size={16} color="rgba(255,255,255,.6)"/>
              </div>
            </div>
          )}

          {/* BUG FIX: while the browser's own permission prompt is up, the
              only on-screen feedback used to be a small "Opening..." corner
              pill — nothing told a first-time user (who may not recognize
              the browser's native permission bar, especially Safari's
              compact address-bar prompt) to actually look for a popup and
              click Allow. */}
          {cameraStatus==="requesting" && (
            <div style={{
              position:"absolute",inset:0,display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",gap:10,
              background:"rgba(2,8,16,.55)",backdropFilter:"blur(2px)",
              pointerEvents:"none",
            }}>
              <GuidanceHint icon="camera"
                title={isAr?"دوّر على نافذة إذن الكاميرا اللي فتحها المتصفح فوق واضغط \"سماح\"":"Look for your browser's permission popup and click \"Allow\""}
                cs={cs}/>
            </div>
          )}

          {/* Camera status pill — aria-live so screen-reader users get
              "camera denied" / "too close" etc. announced as they happen,
              instead of only being able to discover it by re-reading the
              page. */}
          <div aria-live="polite" style={{position:"absolute",top:8,left:isAr?"auto":8,right:isAr?8:"auto"}}>
            {(()=>{
              const pill=(dot,label)=>(
                <div style={{
                  background:"rgba(2,8,16,.85)",borderRadius:99,
                  padding:"4px 10px",display:"flex",alignItems:"center",gap:5,
                  fontSize:10,color:"#fff",backdropFilter:"blur(6px)",
                  border:`1px solid ${dot}30`,
                  fontVariantNumeric:"tabular-nums",
                }}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:dot,
                    boxShadow:`0 0 6px ${dot}`,
                    animation:dot==="#D6A24C"?"livePulse 1s infinite":"none"}}/>
                  {label}
                </div>
              );
              if(cameraStatus==="requesting") return pill("#D6A24C",isAr?"جاري الفتح...":"Opening...");
              if(cameraStatus==="denied")     return pill("#C6604F",isAr?"مرفوضة — اضغط سماح":"Denied — Allow camera");
              // #17: no-device pill removed — the Start Analysis button below already
              // shows "❌ No camera found" clearly; showing it twice was confusing.
              if(cameraStatus==="ready"&&camActive) return pill("#4FAE8E",`${M_?.label||""} · Live · ${Math.floor(sessionTime/60)}:${String(sessionTime%60).padStart(2,"0")}`);
              // cameraStatus reaches "ready" as soon as getUserMedia resolves,
              // which happens during the framing/preview step — well before
              // camActive flips true on "Start session now". That whole
              // window (stream open, video clearly playing on screen) was
              // falling through to the same "Camera off" pill shown before
              // the camera was ever requested, telling users their camera
              // was off while they were looking directly at their own feed.
              // #60a5fa matches the "fallback" tone already used by the
              // mpStatus strip below (see mpStatus==="fallback").
              if(cameraStatus==="ready"&&!camActive) return pill("#60a5fa",isAr?"معاينة":"Previewing");
              return pill("#94a3b8",isAr?"الكاميرا متوقفة":"Camera off");
            })()}
          </div>

          {/* Persistent live distance chip — same info as the "Distance" bar
              further down the page, but that one needs a scroll past ~8
              sections to reach, which is useless for something the user is
              meant to react to while looking at THIS video. Pinned here so
              it's visible the entire time the camera is on. Color now comes
              from the same distColor() the Distance bar further down uses —
              this chip used to color itself off the analysis engine's
              qualityScore/qualityReason instead (falling back to a calm
              grey whenever the quality gate hadn't failed), so the same
              live distance reading could show a calm grey pill here while
              the Distance bar showed amber/red for that identical number.
              badQuality/qualityReason are still used for the LABEL text
              (an actually more specific "too close"/"too far"/"body
              cropped" reason from the engine), just not for color anymore. */}
          {camActive && M_ && (
            <div style={{position:"absolute",top:38,left:isAr?"auto":8,right:isAr?8:"auto",zIndex:11}}>
              {(()=>{
                const badQuality = analysis?.qualityScore != null && analysis.qualityScore < 100;
                const inRange = !badQuality && distCm!=null && distCm>=M_.optDist[0] && distCm<=M_.optDist[1];
                const col = distColor(distCm, M_);
                const label = badQuality
                  ? (analysis.qualityReason==="too_close" ? (isAr?"قريب جداً":"Too close")
                    : analysis.qualityReason==="too_far" ? (isAr?"بعيد جداً":"Too far")
                    : (isAr?"الجسم مقطوع":"Body cropped"))
                  : distCm!=null ? `${Math.round(distCm)}cm` : (isAr?"جاري القياس…":"Measuring…");
                return (
                  <div style={{
                    background:"rgba(2,8,16,.85)",borderRadius:99,padding:"4px 10px",
                    display:"flex",alignItems:"center",gap:5,fontSize:10,fontWeight:700,
                    color:col,backdropFilter:"blur(6px)",border:`1px solid ${col}40`,
                  }}>
                    📏 {label}
                    {!badQuality && distCm!=null && !inRange && (
                      <span style={{opacity:.7,fontWeight:500}}>
                        {distCm<M_.optDist[0] ? (isAr?"↩ ابعد":"↩ back up") : (isAr?"↪ اقترب":"↪ move in")}
                      </span>
                    )}
                    {badQuality && (analysis.qualityReason==="too_close" || analysis.qualityReason==="too_far") && (
                      <span style={{opacity:.7,fontWeight:500}}>
                        {analysis.qualityReason==="too_close" ? (isAr?"↩ ابعد":"↩ back up") : (isAr?"↪ اقترب":"↪ move in")}
                      </span>
                    )}
                    {/* Say what the mispositioning is costing. The warning used
                        to appear while the score sat unchanged next to it, so
                        it read as a cosmetic notice rather than something that
                        actually affects the reading. */}
                    {analysis?.positionPenalty > 0 && (
                      <span style={{fontWeight:800,fontVariantNumeric:"tabular-nums"}}>
                        −{analysis.positionPenalty}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Score overlay */}
        {/* Professional live metrics panel.
            Gated on camActive && !previewPhase. It used to render whenever an
            `analysis` object existed with a score, which outlives the session:
            during the framing preview it sat over the "Make sure you're framed
            well" instructions showing the PREVIOUS session's numbers, so the
            user read a score, a grade and five risk rows for a session that had
            already ended, layered under the buttons for the one about to
            start. */}
        {analysis && score > 0 && camActive && !previewPhase && (
          <div style={{
            // Mirrors the persistent distance chip above (which correctly
            // flips left:isAr?"auto":8 / right:isAr?8:"auto"). This panel
            // was hardcoded right:10 in both languages — in Arabic that put
            // it in the exact same top-right corner as the now-mirrored
            // chip, overlapping its own "ERGONOMIC SCORE" header.
            position:"absolute", top:10, left:isAr?10:"auto", right:isAr?"auto":10,
            background:"rgba(2,8,20,.55)", backdropFilter:"blur(8px)",
            border:"1px solid rgba(255,255,255,.08)", borderRadius:12,
            padding:"10px 14px", minWidth:160, zIndex:10,
          }}>
            {/* Ergonomic Score */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,
              paddingBottom:8,borderBottom:"1px solid rgba(255,255,255,.06)"}}>
              <div style={{
                width:38,height:38,borderRadius:"50%",
                // Aligned to the same scoreTierColor() thresholds (70/55) used
                // by ScoreGauge elsewhere on this page — this badge used to key
                // off its own hardcoded 75/55 split, which disagreed with the
                // gauge's color for any score in [70,75).
                background:`conic-gradient(${scoreTierColor(score)} ${score*3.6}deg, rgba(255,255,255,.06) 0deg)`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:11,fontWeight:800,color:"#f0f6ff",flexShrink:0,fontVariantNumeric:"tabular-nums",
              }}>{score}</div>
              <div>
                <div style={{fontSize:9,color:"#94a3b8",fontWeight:600,letterSpacing:.5}}>
                  {isAr?"الدرجة الكلية":"ERGONOMIC SCORE"}
                </div>
                {/* This had its own three-tier ladder — Excellent at 70,
                    Fair at 55, Poor below — while the engine's gradeScore()
                    (85 / 70 / 55) and the session-summary modal both call
                    70-84 "Good". So the band this user spent most of a real
                    session in, 70 to 84, was labelled "Excellent" on the
                    video and "Good" in the report on the same session, and a
                    reading of 70 out of 100 — with a metric sitting in the
                    High-risk tier right underneath it — was announced as
                    excellent posture. One grader now, the engine's. */}
                <div style={{fontSize:11,fontWeight:700,
                  color:scoreTierColor(score)}}>
                  {isAr?gradeScoreAr(score):gradeScore(score)}
                </div>
                {/* Which of the thirteen is actually costing the points.
                    The five rows below are the five the panel has room for,
                    and they cannot account for the number above them: on
                    camera, one frame read 91 with all four rows Low and a
                    later frame read 71 with all four rows Low — the twenty
                    points were in metrics this panel does not show, and a user
                    looking for the reason had nowhere to find it. */}
                {(()=>{
                  const HIDE = new Set(["session_fatigue","confidence_val"]);
                  const worst = Object.entries(analysis?.metrics||{})
                    .filter(([k,v])=>!HIDE.has(k) && v && v.reliable!==false && typeof v.score==="number")
                    .sort(([,a],[,b])=>a.score-b.score)[0];
                  if(!worst || worst[1].score >= 80) return null;
                  const label = isAr ? (METRIC_LABEL_AR[worst[0]]||worst[1].label) : worst[1].label;
                  return (
                    <div style={{fontSize:9,color:"#94a3b8",marginTop:2,whiteSpace:"nowrap"}}>
                      {isAr?"أكبر خصم: ":"biggest drop: "}
                      <span style={{color:scoreTierColor(worst[1].score),fontWeight:600}}>{label}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Risk zones */}
            {/* Two of these four rows were reporting on metrics the camera
                could not see.

                "Back" is spine_lean and "Rounding" is rounded_shoulders, and
                both are measured from the hips — which sit below the bottom
                edge of the frame at any laptop distance. The engine correctly
                marks them reliable:false and drops them from the score; this
                panel read only `.score`, got each module's default, and drew a
                full green bar labelled "Low" next to the word Back. Every
                session, for every user, the app was telling people their back
                was fine while having no view of their back at all. That is a
                worse failure than a wrong number.

                The row names were also imprecise in a way that produced a
                visible contradiction: "Shoulder" is shoulder_level (one
                shoulder higher than the other), but the coaching cue "Drop
                your shoulders" comes from shoulder_elevation (both shrugged) —
                a metric with no row here. So the screen could read
                "Shoulder — Low" while instructing the user to drop their
                shoulders. Both are now named for what they measure, and the
                shrug has its own row. */}

            {/* When the user is too close the engine keeps scoring (soft-block)
                but depth-dependent metrics (FHP, rounded shoulders) are less
                accurate. Say so rather than showing confident-looking numbers. */}
            {analysis?.qualityReason === "too_close" && (
              <div style={{
                display:"flex", alignItems:"center", gap:5,
                padding:"4px 8px", borderRadius:6, marginBottom:6,
                background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.25)",
              }}>
                <span style={{fontSize:10}}>⚠️</span>
                <span style={{fontSize:9, color:"#fbbf24", lineHeight:1.3}}>
                  {isAr
                    ? "أنت قريب جداً — الأرقام دي تقريبية. ابعد عن الكاميرا للحصول على قراءة دقيقة."
                    : "Too close — readings are approximate. Back up for accurate measurements."}
                </span>
              </div>
            )}

            {[
              {
                label:    isAr?"ميل الرقبة":"Neck tilt",
                m:        analysis?.metrics?.neck_lean,
                unit:     "°",
              },
              {
                label:    isAr?"استواء الكتفين":"Shoulder level",
                m:        analysis?.metrics?.shoulder_level,
                unit:     "°",
              },
              {
                label:    isAr?"رفع الكتفين":"Shoulder shrug",
                m:        analysis?.metrics?.shoulder_elevation,
                unit:     "%",
              },
              {
                label:    isAr?"ميل الظهر":"Back lean",
                m:        analysis?.metrics?.spine_lean,
                unit:     "°",
              },
              {
                label:    isAr?"تدوير الكتفين":"Rounding",
                m:        analysis?.metrics?.rounded_shoulders,
                unit:     "",
              },
              // Distance intentionally omitted here — it has its own dedicated
              // persistent chip pinned on the video (see above) plus the
              // detailed bar further down the page.
            ].map(({label,m,unit},i)=>{
              const unseen   = !m || m.reliable === false;
              // learning:true means the engine is accumulating its per-person
              // baseline and has not yet produced a reading — distinct from
              // "no view" where landmarks are simply not visible.
              const learning = unseen && m?.learning === true;
              const s = unseen ? null : m.score;
              // Same scoreTierColor() thresholds (70/55) as the badge above and
              // ScoreGauge — these bars used to use their own 80/60 split, a
              // third disagreeing color scheme on the same screen.
              const col = learning ? "#818cf8"            // indigo — "in progress"
                        : unseen   ? "#64748b"            // slate  — "no data"
                        : scoreTierColor(s);
              const risk= learning ? (isAr?"يتعلم":"Settling")
                        : unseen   ? (isAr?"مش ظاهر":"no view")
                        : s>=70    ? (isAr?"منخفض":"Low")
                        : s>=55    ? (isAr?"متوسط":"Med")
                        :            (isAr?"مرتفع":"High");
              return (
                <div key={i} style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",marginBottom:5,opacity:unseen?.6:1}}>
                  <div style={{fontSize:10,color:"#94a3b8",width:64}}>{label}</div>
                  <div style={{flex:1,height:4,borderRadius:8,margin:"0 6px",overflow:"hidden",
                    background: learning
                      ? "rgba(129,140,248,.18)"     // soft indigo fill while settling
                      : unseen
                      ? "repeating-linear-gradient(90deg,rgba(255,255,255,.14) 0 3px,transparent 3px 6px)"
                      : "rgba(255,255,255,.06)"}}>
                    {learning && <div style={{height:"100%",width:"40%",
                      background:"rgba(129,140,248,.5)",borderRadius:8,
                      animation:"pulse 1.6s ease-in-out infinite"}}/>}
                    {!unseen && !learning && <div style={{height:"100%",width:`${s??0}%`,
                      background:col,borderRadius:8,transition:"width .4s ease"}}/>}
                  </div>
                  <div style={{fontSize:9,fontWeight:700,color:col,width:44,textAlign:"right"}}>
                    {risk}
                  </div>
                </div>
              );
            })}

            {/* Session baseline comparison — "better/worse than your first sessions" */}
            {(()=>{
              // The comparison was backwards, and said so out loud on every
              // frame of every session.
              //
              // userSessions is sorted NEWEST FIRST — both getUserSessions()
              // and onUserSessions() query orderBy("created_at","desc") and
              // then sort by (tb - ta) again on top. So slice(0,3) is the three
              // most RECENT sessions and slice(-3) the three OLDEST, while the
              // names here said the opposite and diff was computed as
              // oldest − newest. A user who had improved by 51 points was told,
              // continuously, in amber, that he was "51 pts worse than your
              // first sessions".
              // See sessionTrend() — the guards it applies, and why each one
              // exists, are documented there and covered by tests.
              const tr = sessionTrend(userSessions);
              if(!tr) return null;
              const diff = tr.diff;
              const up = tr.improving;
              return (
                <div style={{
                  marginTop:8, paddingTop:8,
                  borderTop:"1px solid rgba(255,255,255,.06)",
                }}>
                  {/* Was reading as a direct contradiction of the "Excellent"
                      label right above it — this compares OVERALL history
                      (first 3 vs last 3 sessions ever), not today's score,
                      but with no label saying so it looked like the app was
                      calling this session both excellent and worse at once. */}
                  <div style={{fontSize:8,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".05em",marginBottom:3}}>
                    {isAr?"الاتجاه العام (كل الجلسات)":"Overall trend (all sessions)"}
                  </div>
                  <div style={{display:"flex", alignItems:"center", gap:5}}>
                    <span style={{fontSize:13}}>{up?"📈":"📉"}</span>
                    <div style={{fontSize:9, lineHeight:1.35,
                      color: up ? "#10d9a0" : "#D6A24C", fontWeight:600}}>
                      {isAr
                        ? `${up?"أحسن":"أسوأ"} بـ ${Math.abs(diff)} نقطة من أول جلساتك`
                        : `${Math.abs(diff)} pts ${up?"better":"worse"} than your first sessions`}
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        )}
          {/* (Removed the redundant bottom-left score box — the score already
              shows in the on-video panel header and in the left column ring.) */}

          {/* Big actionable correction cue — the single most useful "do this
              now" instruction, shown over the video when a metric is clearly
              off. Excludes isPaused: `analysis` isn't cleared on pause, so
              without this the last cue stayed rendered — a second, stale
              message layered right alongside the "Session paused" overlay. */}
          {camActive && !previewPhase && !isPaused && (()=>{
            const cue=stabilizeCue(postureCue(analysis,isAr), analysis);
            if(!cue) return null;
            return (
              // bottom:8 put this right underneath the fullscreen Pause/Stop
              // bar (which sits at bottom:20 with ~40px-tall buttons, so it
              // occupies roughly the 20-60px band) — nothing here excluded
              // rendering both at once (this cue has no `!isFs` guard, the
              // control bar has no cue-aware guard either), so reaching for
              // Pause/Stop while a cue was showing meant tapping through
              // overlapping text. Clear the control bar's band in fullscreen.
              // left:8/right:46 was hardcoded — the asymmetric 46 exists to
              // dodge the fullscreen button, which now mirrors to the
              // opposite side for isAr (see its fix above), so this must
              // mirror too or the two will start overlapping in Arabic.
              <div style={{position:"absolute",
                left:isAr?46:8, right:isAr?8:46, bottom:isFs?68:8,
                background:"rgba(2,8,16,.9)",backdropFilter:"blur(6px)",
                border:`1.5px solid ${cue.col}`,borderRadius:12,
                padding:"10px 12px",display:"flex",alignItems:"center",gap:10,
                boxShadow:`0 4px 18px ${cue.col}55`,animation:"fadeUp .3s ease"}}>
                <span style={{fontSize:24,color:cue.col,fontWeight:800,lineHeight:1,flexShrink:0}}>{cue.icon}</span>
                <span style={{fontSize:14,fontWeight:800,color:"#fff",lineHeight:1.3}}>{cue.text}</span>
              </div>
            );
          })()}

          {/* Fullscreen-only control bar. toggleFullscreen() calls the real
              W3C Fullscreen API on camWrapRef — only ITS subtree paints while
              active, so the primary Pause/Resume + Stop & Save bar below
              (a sibling outside this div) simply disappears once fullscreen
              engages. Without this, entering fullscreen silently took away
              the only way to pause or stop a session short of exiting
              fullscreen first (Esc / the same corner button). */}
          {isFs && camActive && !previewPhase && (
            <div style={{position:"absolute",left:0,right:0,bottom:20,zIndex:20,
              display:"flex",justifyContent:"center",gap:10,padding:"0 24px"}}>
              <button className="liveui-focusable" onClick={isPaused?resumeSession:pauseSession} style={{
                minWidth:140,
                background: isPaused ? "linear-gradient(135deg,rgba(79,174,142,.25),rgba(5,150,105,.18))" : "rgba(2,8,16,.72)",
                backdropFilter:"blur(8px)",
                color: isPaused ? "#6ee7b7" : "#fff",
                border:`1px solid ${isPaused?"rgba(79,174,142,.5)":"rgba(255,255,255,.18)"}`,borderRadius:12,
                padding:"12px 18px",fontSize:13,fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                transition:`filter ${LT.duration.fast}ms ease`,
              }}>
                <Icon name={isPaused?"play":"pause"} size={14} color="currentColor"/>{isPaused ? (isAr?"استكمال":"Resume") : (isAr?"وقف مؤقت":"Pause")}
              </button>
              <button className="liveui-focusable" onClick={stopCamera} disabled={isSavingSession} style={{
                minWidth:140,
                background: isSavingSession ? "rgba(2,8,16,.5)" : "rgba(198,96,79,.28)",
                backdropFilter:"blur(8px)",
                color: isSavingSession ? "#94a3b8" : "#fca5a5",
                border:`1px solid ${isSavingSession?"rgba(255,255,255,.1)":"rgba(198,96,79,.55)"}`,borderRadius:12,
                padding:"12px 18px",fontSize:13,fontWeight:700,
                cursor: isSavingSession ? "not-allowed" : "pointer",
                opacity: isSavingSession ? .5 : 1,
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                transition:`filter ${LT.duration.fast}ms ease, opacity ${LT.duration.fast}ms ease`,
              }}>
                {isSavingSession ? (isAr?"جاري الحفظ…":"Saving…") : (<><Icon name="stop" size={14} color="currentColor"/>{isAr?"إيقاف وحفظ":"Stop & Save"}</>)}
              </button>
            </div>
          )}
        </div>

        {/* Primary control — placed directly under the camera so Start / Stop
            is always visible without scrolling past the metrics list. */}
        <div style={{padding:"12px 14px 0"}}>
          {previewPhase || startingSession
            ? null /* overlay's own Start/Cancel buttons (or the "Starting
                       session..." overlay) are the CTA here — without also
                       excluding startingSession, this button briefly
                       reappeared during the countdown→camActive gap,
                       right alongside the new "Starting session..." overlay,
                       which is exactly the confusing double-state the fix
                       for the reported lag/freeze was meant to remove. */
            : !camActive
            ? <button className="liveui-focusable"
                onClick={cameraStatus==="requesting" ? undefined : startCamera}
                disabled={cameraStatus==="requesting"}
                style={{
                  width:"100%",
                  background: cameraStatus==="no-device"||cameraStatus==="denied"
                    ? "rgba(198,96,79,.15)"
                    : cameraStatus==="requesting"
                    ? "rgba(148,163,184,.1)"
                    : `linear-gradient(135deg,${TN?.color||"#1a56db"},${TN?.colorDim||"#0891b2"})`,
                  border: cameraStatus==="no-device"||cameraStatus==="denied" ? "1px solid rgba(198,96,79,.4)" : "none",
                  borderRadius:12, padding:"12px 0", minHeight:46,
                  fontSize:14, fontWeight:800,
                  color: cameraStatus==="no-device"||cameraStatus==="denied" ? "#fca5a5"
                    : cameraStatus==="requesting" ? cs.muted : "#fff",
                  cursor: cameraStatus==="requesting" ? "not-allowed" : "pointer",
                  opacity: cameraStatus==="requesting" ? .5 : 1,
                  boxShadow: cameraStatus==="requesting"||cameraStatus==="no-device"||cameraStatus==="denied"
                    ? "none" : `0 4px 14px ${TN?.color||"#1a56db"}33`,
                  letterSpacing:"-.01em",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                }}>
                {cameraStatus==="requesting"
                  ? <><span style={{animation:"spin 700ms linear infinite",display:"inline-flex"}}><Icon name="refresh" size={15} color="currentColor"/></span>{isAr?"جاري الفتح...":"Opening camera..."}</>
                  : cameraStatus==="denied"
                  ? (<><Icon name="refresh" size={14} color="currentColor"/>{isAr?"حاول تاني — لو سمحت للكاميرا":"Retry — if you've allowed the camera"}</>)
                  : cameraStatus==="no-device"
                  ? (<><Icon name="refresh" size={14} color="currentColor"/>{isAr?"حاول تاني — لو وصّلت كاميرا":"Retry — if you've connected one"}</>)
                  : (<><Icon name="play" size={15} color="currentColor"/>{isAr?"ابدأ التحليل":"Start Analysis"}</>)}
              </button>
            : <div style={{display:"flex",gap:8}}>
                <button className="liveui-focusable" onClick={isPaused?resumeSession:pauseSession} style={{
                  flex:1,
                  background: isPaused ? "linear-gradient(135deg,rgba(79,174,142,.18),rgba(5,150,105,.12))" : "rgba(148,163,184,.08)",
                  color: isPaused ? "#6ee7b7" : cs.text,
                  border:`1px solid ${isPaused?"rgba(79,174,142,.4)":cs.border}`,borderRadius:12,
                  padding:"12px 0",fontSize:13,fontWeight:700,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                  transition:`filter ${LT.duration.fast}ms ease`,
                }}>
                  <Icon name={isPaused?"play":"pause"} size={14} color="currentColor"/>{isPaused ? (isAr?"استكمال":"Resume") : (isAr?"وقف مؤقت":"Pause")}
                </button>
                <button className="liveui-focusable" onClick={stopCamera} disabled={isSavingSession} style={{
                  flex:1,
                  background: isSavingSession
                    ? "rgba(255,255,255,.05)"
                    : "linear-gradient(135deg,rgba(198,96,79,.18),rgba(220,38,38,.12))",
                  color: isSavingSession ? "#94a3b8" : "#fca5a5",
                  border:`1px solid ${isSavingSession?"rgba(255,255,255,.08)":"rgba(198,96,79,.5)"}`,borderRadius:12,
                  padding:"12px 0",fontSize:13,fontWeight:700,
                  cursor: isSavingSession ? "not-allowed" : "pointer",
                  opacity: isSavingSession ? .5 : 1,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                  letterSpacing:"-.01em",transition:`filter ${LT.duration.fast}ms ease, opacity ${LT.duration.fast}ms ease`,
                }}>
                  {isSavingSession
                    ? (isAr ? "جاري الحفظ…" : "Saving…")
                    : (<><Icon name="stop" size={14} color="currentColor"/>{isAr?"إيقاف وحفظ":"Stop & Save"}</>)}
                </button>
              </div>
          }
        </div>

        {/* Prominent Posture Score — the on-video badge above is a compact
            glanceable overlay for while you're looking at the camera; this
            is the "score never small" primary read-out the design brief
            calls for, shown once real analysis is flowing (same gating the
            on-video badge already uses: `analysis && score>0`). */}
        {analysis && score>0 && (
          <div style={{padding:"16px 14px 4px",display:"flex",justifyContent:"center"}}>
            <ScoreGauge cs={cs} score={score} grade={isAr?gradeScoreAr(score):gradeScore(score)}/>
          </div>
        )}

        {/* AI Coach — short, actionable live guidance. Reuses the same
            `aiInsight` data + Elite tier-gate already used by the left
            panel's history-style AI card; this is the live-session-facing
            copy of it, placed where the design brief wants AI feedback:
            directly beside the camera, not buried below the fold. */}
        {camActive && (
          <div style={{padding:"4px 14px 12px"}}>
            <AICoachCard cs={cs} isAr={isAr} text={aiInsight}
              locked={!aiInsight && !tierAtLeast(effectiveTier,"elite")}
              onUnlock={()=>{ addToast(isAr?"🧠 تحليل AI اللحظي متاح لباقة Elite فقط":"🧠 Live AI analysis is an Elite feature","warn"); setShowBilling(true); }}/>
          </div>
        )}

        {/* Optimal distance hint — score/user shown in left panel & video overlay */}
        {M_ && !camActive && (
          <div style={{padding:"8px 14px",borderBottom:`1px solid ${cs.border}`,
            display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13}}>📏</span>
            <span style={{fontSize:11,color:cs.muted}}>
              {isAr?`اجلس على مسافة ${M_.optDist[0]}–${M_.optDist[1]}cm من الكاميرا`:`Sit ${M_.optDist[0]}–${M_.optDist[1]}cm from camera`}
            </span>
          </div>
        )}
        {/* Strain / discomfort prediction — wired to the real pain_prediction
            data (minutes_to_pain / primary_driver / confidence). Previously
            this section read analysis.pain_bar, which nothing ever set, so it
            never appeared and the computed prediction was thrown away. */}
        {analysis?.pain_prediction?.minutes_to_pain != null && (()=>{
          const pp=analysis.pain_prediction, m=pp.minutes_to_pain;
          const col=m<=10?"#C6604F":m<=30?"#f97316":"#D6A24C";
          const icon=m<=10?"🔴":m<=30?"🟠":"🟡";
          const pct=Math.max(4,Math.min(100,100-(m/60)*100)); // nearer to strain = fuller
          const conf=isAr?(pp.confidence==="high"?"عالية":pp.confidence==="medium"?"متوسطة":"منخفضة"):pp.confidence;
          return (
            <div style={{padding:"7px 14px",borderBottom:`1px solid ${cs.border}`,
              background:`${col}12`,borderInlineStart:`3px solid ${col}`}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <span style={{fontSize:13}}>{icon}</span>
                <div style={{fontSize:10,fontWeight:700,color:col}}>
                  {isAr?`احتمال إجهاد خلال ~${m} دقيقة`:`Discomfort likely in ~${m} min`}
                  {pp.primary_driver?` · ${pp.primary_driver}`:""}
                </div>
              </div>
              <div style={{height:3,borderRadius:99,background:cs.inp}}>
                <div style={{height:"100%",borderRadius:99,width:`${pct}%`,
                  background:col,transition:"width .5s ease"}}/>
              </div>
              <div style={{fontSize:10,color:cs.muted,marginTop:3}}>
                {isAr?`الثقة: ${conf} — تقدير توعوي، ليس تشخيصاً طبياً`
                     :`Confidence: ${conf} — awareness estimate, not a medical diagnosis`}
              </div>
            </div>
          );
        })()}

        {/* ── What this framing can and cannot measure ──────────────────
            The single most important thing this page was not saying.

            Four of the twelve posture modules — spine lean, rounded
            shoulders, forward slouch and trunk rotation — are all measured
            RELATIVE TO THE HIPS. On a laptop the hips are not in shot: on the
            synthetic rig the hip midpoint sits at y=1.46 of frame height at
            60cm and 1.22 at 80cm, and only enters the frame at about 130cm.
            The app asks the user to sit at 50-80cm. So on the hardware this
            product is built for, those four modules report reliable:false for
            the entire session, the engine correctly drops them from the
            weighted mean, and the result — a genuine measurement of the upper
            body — was displayed as a complete posture score.

            The four it cannot see are precisely the ones that measure leaning
            and slumping FORWARD, which is why a user slouching hard a foot
            from the lens can be told 79/100: side-to-side was measured,
            forward was not. Saying so is the difference between a partial
            reading and a wrong one. */}
        {camActive && analysis?.coverageDetail && analysis.coverageDetail.weightPct < 88 && (()=>{
          const cov = analysis.coverageDetail;
          const names = isAr
            ? {spine_lean:"ميل الجذع",rounded_shoulders:"تدوير الكتفين",torso_flexion:"الانحناء للأمام",trunk_rotation:"لفّ الجذع",fhp_index:"تقدّم الرأس",neck_lean:"ميل الرقبة",elbow_angle:"زاوية الكوع",monitor_height:"ارتفاع الشاشة",head_yaw:"لفّ الرأس",head_tilt:"ميل الرأس",shoulder_level:"استواء الكتفين",shoulder_elevation:"رفع الكتفين"}
            : {spine_lean:"spine lean",rounded_shoulders:"rounded shoulders",torso_flexion:"forward slouch",trunk_rotation:"trunk rotation",fhp_index:"forward head",neck_lean:"neck lean",elbow_angle:"elbow angle",monitor_height:"monitor height",head_yaw:"head turn",head_tilt:"head tilt",shoulder_level:"shoulder level",shoulder_elevation:"shoulder shrug"};
          const missing = (cov.missing||[]).map(k=>names[k]||k);
          const col = cov.weightPct < 65 ? "#C6604F" : "#D6A24C";
          return (
            <div style={{padding:"9px 14px",borderBottom:`1px solid ${cs.border}`,
              background:`${col}12`,borderInlineStart:`3px solid ${col}`}}>
              <div style={{fontSize:11,fontWeight:700,color:col}}>
                {isAr
                  ? `الدرجة محسوبة من ${cov.measured} من ${cov.total} مقاييس (${cov.weightPct}%)`
                  : `Score measured from ${cov.measured} of ${cov.total} metrics (${cov.weightPct}%)`}
              </div>
              {missing.length>0 && (
                <div style={{fontSize:10,color:cs.muted,marginTop:3,lineHeight:1.5}}>
                  {isAr?"مش متقاسة دلوقتي: ":"Not being measured: "}{missing.join(isAr?"، ":", ")}
                </div>
              )}
              {!cov.hipsInFrame && (
                <div style={{fontSize:10,color:cs.muted,marginTop:3,lineHeight:1.5}}>
                  {isAr
                    ? "وسطك مش ظاهر في الكادر، وده اللي بيتقاس منه الانحناء للأمام. ابعد شوية عن الكاميرا أو نزّل اللابتوب لحد ما كتفك ووسطك يبانوا مع بعض."
                    : "Your hips are out of frame, and forward lean is measured from them. Sit further back or lower the laptop until your shoulders and waist are both in shot."}
                </div>
              )}
            </div>
          );
        })()}

        {/* Live metrics */}
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${cs.border}`}}>
          <div style={{fontSize:10,fontWeight:700,color:cs.muted,textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>
            {isAr?"القياسات المباشرة":"Live Metrics"}
          </div>
          {analysis?.metrics
            ? (
                // Was thirteen rows of "label … value … bar". A reading is not
                // a finding: it never said whether the number was bad, why it
                // would matter, or what to do differently — every screen either
                // invented an answer or left the user to guess. FindingsPanel
                // is that answer, written once, for every screen.
                <Suspense fallback={<div style={{fontSize:11,color:cs.muted,padding:"8px 0"}}>
                  {isAr?"جاري التحليل…":"Analysing…"}</div>}>
                  <FindingsPanel
                    metrics={analysis.metrics}
                    cs={cs} isAr={isAr}
                    calibrated={!!calibData?.tolerances}
                    variant="compact"
                    onCalibrate={()=>setShowCalibWizard(true)}
                  />
                </Suspense>
              )
            : <div style={{fontSize:11,color:cs.muted}}>{isAr?"جودة الصورة منخفضة":"Low quality frame"}</div>}
        </div>

        {/* Distance bar */}
        {distCm&&M_&&(
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${cs.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:10,color:cs.muted,fontWeight:600}}>{isAr?"المسافة":"Distance"}</span>
              <span style={{fontSize:12,fontWeight:700,color:distColor(distCm, M_),fontVariantNumeric:"tabular-nums"}}>
                {Math.round(distCm)}cm
              </span>
            </div>
            <div style={{position:"relative",height:8,background:"rgba(148,163,184,.08)",borderRadius:99,overflow:"hidden"}}>
              {/* The "20cm ... 115cm" labels below auto-mirror under dir="rtl"
                  (a flex row with justifyContent:"space-between"), so in
                  Arabic "20cm" renders on the right and "115cm" on the left —
                  but these two bars were positioned with a physical `left`
                  percentage, which never flipped. That put the near/close-zone
                  marker at the visual left (under the now-far "115cm" label)
                  in RTL — backwards. insetInlineStart resolves against the
                  same dir the labels already mirror by, so both stay in sync
                  in both languages (matches the pattern already used for the
                  Score History chart above). */}
              <div style={{position:"absolute",insetInlineStart:"28%",top:0,bottom:0,width:"44%",background:"rgba(79,174,142,.15)",borderRadius:99}}/>
              <div style={{
                position:"absolute",top:1,bottom:1,
                insetInlineStart:`${clamp((distCm-20)/(115-20)*100,2,96)}%`,
                width:6,borderRadius:99,
                background:distColor(distCm, M_),
                transition:"inset-inline-start .4s ease",
              }}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:9,color:cs.muted}}>
              <span>20cm</span><span style={{color:"#4FAE8E"}}>{M_.optDist[0]}–{M_.optDist[1]}cm ✓</span><span>115cm</span>
            </div>
          </div>
        )}

        {/* Lighting warning */}
        {lowLight && (
          <div style={{padding:"8px 14px",background:"rgba(214,162,76,.12)",borderBottom:`1px solid ${cs.border}`,
            display:"flex",alignItems:"center",gap:8,fontSize:12,color:darkMode?"#D6A24C":"#b45309",fontWeight:600}}>
            💡 {isAr?"الإضاءة ضعيفة — حسّن الإضاءة لقراءات أدق":"Low lighting — improve lighting for more accurate readings"}
          </div>
        )}

        {/* Multi-person / subject-switch warning — see subjectRejectStreakRef
            in runLoop. Tracking silently pauses when a second person's
            centroid displaces the tracked subject; this makes that visible
            instead of the display just looking frozen. */}
        {multiPersonWarning && (
          <div style={{padding:"8px 14px",background:"rgba(214,162,76,.12)",borderBottom:`1px solid ${cs.border}`,
            display:"flex",alignItems:"center",gap:8,fontSize:12,color:darkMode?"#D6A24C":"#b45309",fontWeight:600}}>
            👥 {isAr?"تم رصد شخص آخر أو حركة مفاجئة — التتبع متوقف مؤقتًا. تأكد إنك انت بس في الكادر":
                     "Another person or sudden movement detected — tracking paused. Make sure only you are in frame"}
          </div>
        )}

        {/* Status strip — score status, personalisation note, and any active
            alert used to each render as their own separately-bordered row
            with slightly different padding/sizes even though they're all
            "one line of status text under the camera". When a personalised
            calibration applies AND posture is currently good, that's now
            one row instead of two stacked ones; it only gets its own row
            when there's no score-status row to attach to. */}
        {scoreStatus&&alertMsg.type!=="warn"&&alertMsg.type!=="bad"&&(
          <div style={{padding:"7px 14px",borderBottom:`1px solid ${cs.border}`}}>
            {/* Was hardcoded to always render green regardless of the actual
                score — this row can render whenever there's no active
                warn/bad alert, which isn't the same as the score always
                being in the "good" tier. Now uses the same scoreTierColor()
                (70/55) as ScoreGauge and the on-video overlay, so this text
                readout agrees with the other two score displays instead of
                being an independent, unconditionally-green 4th system. */}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:scoreTierColor(scoreStatus?.score??100),flexShrink:0,boxShadow:`0 0 6px ${scoreTierColor(scoreStatus?.score??100)}`}}/>
              <span style={{fontSize:11,color:scoreTierColor(scoreStatus?.score??100),fontWeight:600}}>
                {isAr?`النتيجة ${scoreStatus?.score}/100 — ${scoreStatus?.grade}`:`Score ${scoreStatus?.score}/100 — ${scoreStatus?.grade}`}
                {camActive&&calibData?.tolerances&&(
                  <span style={{color:darkMode?"#34d399":"#15803d",fontWeight:500}}> · {isAr?"مُخصّص":"Personalised"}</span>
                )}
              </span>
            </div>
            {/* paddingLeft was hardcoded — meant to indent this line under the
                dot+text row above, which sits at the physical right edge in
                RTL, so a physical-left indent no longer lines up under it. */}
            <div style={{fontSize:10,color:cs.muted,marginTop:3,paddingLeft:isAr?0:16,paddingRight:isAr?16:0,lineHeight:1.4}}>
              {gradeContext(scoreStatus?.score, isAr)}
            </div>
          </div>
        )}

        {!(scoreStatus&&alertMsg.type!=="warn"&&alertMsg.type!=="bad")&&camActive&&calibData?.tolerances&&(
          <div style={{padding:"7px 14px",borderBottom:`1px solid ${cs.border}`,display:"flex",alignItems:"center",gap:8,background:"rgba(79,174,142,.05)"}}>
            <span style={{fontSize:11,color:darkMode?"#34d399":"#15803d",fontWeight:700}}>✓</span>
            <span style={{fontSize:11,color:darkMode?"#34d399":"#15803d",fontWeight:600}}>
              {isAr?"التحليل مُخصّص لوضعيتك الطبيعية":"Analysis personalised to your natural posture"}
            </span>
          </div>
        )}

        {/* Alert message — warn/bad/info only */}
        {!!alertMsg.text&&(alertMsg.type==="warn"||alertMsg.type==="bad"||(alertMsg.type==="info"&&!scoreStatus))&&(
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${cs.border}`}}>
          <div style={abox(alertMsg.type)}>{alertMsg.text}</div>
        </div>
        )}

        {/* Secondary controls (primary Start/Stop moved up under the camera) */}
        {/* Collapsed by default — see showLiveSettings declaration. One row
            to open everything below, instead of 7 rows shown unconditionally
            the moment the page loads. */}
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${cs.border}`}}>
          <button className="liveui-focusable" onClick={()=>setShowLiveSettings(v=>!v)} style={{
            width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
            background:cs.inp||"rgba(255,255,255,.03)",border:`1px solid ${cs.inpB||cs.border}`,borderRadius:LT.radius.sm,
            padding:"10px 14px",fontSize:12,fontWeight:700,color:cs.text,cursor:"pointer",
          }}>
            <span style={{display:"flex",alignItems:"center",gap:7}}>
              <Icon name="settings" size={14} color={cs.muted}/> {isAr?"إعدادات الجلسة":"Session settings"}
            </span>
            <span style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:cs.muted}}>
              {showLiveSettings?(isAr?"إخفاء":"Hide"):(isAr?"عرض":"Show")}
              <Icon name={showLiveSettings?"chevronUp":"chevronDown"} size={12} color={cs.muted}/>
            </span>
          </button>
        </div>
        {showLiveSettings && (
        <div style={{padding:"0 14px 12px",display:"flex",flexDirection:"column",gap:8,borderBottom:`1px solid ${cs.border}`}}>
          {/* Settings list — was a grid of same-size buttons whose labels
              ("Focus Mode", "Voice coach") wrapped onto 2 lines inside a
              fixed-width box, reading as cramped/broken. An iOS-style row
              list (icon + label + switch, one row height regardless of
              label length) fixes that while keeping every handler, every
              localStorage side effect, and every tier gate byte-identical
              to before — this is a visual swap only. */}
          <div style={{display:"flex",flexDirection:"column"}}>
            <SettingsRow cs={cs} icon={sound?"bell":"bellOff"} label={isAr?"صوت التنبيه":"Alert sound"}
              sub={isAr?"صفّارة قصيرة لما الوضعية تسوء":"A short tone when your posture slips"}
              right={<Switch cs={cs} on={sound} onChange={()=>setSound(s=>!s)} label={isAr?"صوت التنبيه":"Alert sound"}/>}/>

            {/* Alert strictness. Everything this drives — the score gate, how
                long a fault must persist, how soon a cue repeats, whether mild
                drifts make a sound — was hardcoded, so "make the alerts
                stricter" was not something a user could ask for. */}
            <div style={{padding:"10px 2px 12px"}}>
              <div style={{fontSize:11,fontWeight:600,color:cs.muted,marginBottom:7,letterSpacing:".03em"}}>
                {isAr?"حساسية التنبيه":"Alert sensitivity"}
              </div>
              <div style={{display:"flex",gap:6}}>
                {[
                  {id:"relaxed", en:"Relaxed", ar:"مرن"},
                  {id:"balanced",en:"Balanced",ar:"متوازن"},
                  {id:"strict",  en:"Strict",  ar:"صارم"},
                ].map(o=>(
                  <button key={o.id} className="liveui-focusable"
                    aria-pressed={alertSensitivity===o.id}
                    onClick={()=>setAlertSensitivity(o.id)}
                    style={{flex:1,padding:"7px 0",borderRadius:LT.radius.sm,cursor:"pointer",
                      fontSize:11.5,fontWeight:700,
                      border:`1px solid ${alertSensitivity===o.id?"rgba(79,174,142,.45)":cs.border}`,
                      background:alertSensitivity===o.id?"rgba(79,174,142,.12)":"transparent",
                      color:alertSensitivity===o.id?(darkMode?"#34d399":"#15803d"):cs.muted}}>
                    {isAr?o.ar:o.en}
                  </button>
                ))}
              </div>
              <div style={{fontSize:10,color:cs.muted,marginTop:6,lineHeight:1.55}}>
                {alertSensitivity==="strict"
                  ? (isAr?`ينبّه تحت ${SENS.gate} بعد ${SENS.dwellMs/1000} ثانية — وكمان على الانحرافات الصغيرة.`
                        :`Alerts below ${SENS.gate}, held for ${SENS.dwellMs/1000}s — small drifts included.`)
                  : alertSensitivity==="relaxed"
                  ? (isAr?`ينبّه بس تحت ${SENS.gate} وبعد ${SENS.dwellMs/1000} ثانية متواصلة.`
                        :`Only below ${SENS.gate}, and only after ${SENS.dwellMs/1000}s of it.`)
                  : (isAr?`ينبّه تحت ${SENS.gate} بعد ${SENS.dwellMs/1000} ثانية متواصلة.`
                        :`Alerts below ${SENS.gate}, held for ${SENS.dwellMs/1000}s.`)}
              </div>
            </div>

            {/* OS notifications. This fired whenever the tab was hidden with no
                setting to stop it — and when permission was denied it fired
                nothing at all and no other channel took over, so a
                backgrounded session was completely silent. */}
            <SettingsRow cs={cs} icon="bell" label={isAr?"إشعارات النظام":"Desktop notifications"}
              sub={notifPerm==="denied"
                    ? (isAr?"محظورة من المتصفح — فعّلها من إعدادات الموقع":"Blocked in your browser — enable it in site settings")
                    : notifPerm==="unsupported"
                    ? (isAr?"المتصفح ده مش بيدعمها":"Not supported by this browser")
                    : (isAr?"لما تكون في تاب تاني":"When you're in another tab")}
              right={notifPerm==="granted"
                ? <Switch cs={cs} on={desktopNotifs} label={isAr?"إشعارات النظام":"Desktop notifications"}
                    onChange={()=>setDesktopNotifs(v=>!v)}/>
                : notifPerm==="default"
                ? <button className="liveui-focusable" onClick={async()=>{
                    const r=await requestNotificationPermission();
                    setNotifPerm(r);
                    if(r==="granted"){ setDesktopNotifs(true); addToast(isAr?"تمام — هتوصلك إشعارات وانت في تاب تاني":"Done — you'll get alerts while in another tab","success"); }
                    else if(r==="denied") addToast(isAr?"اترفضت. تقدر تفعّلها من إعدادات الموقع في المتصفح":"Blocked. You can enable it from your browser's site settings","info");
                  }} style={{padding:"6px 12px",borderRadius:99,fontSize:11,fontWeight:700,cursor:"pointer",
                    border:"1px solid rgba(79,174,142,.4)",background:"rgba(79,174,142,.1)",
                    color:darkMode?"#34d399":"#15803d"}}>
                    {isAr?"تفعيل":"Enable"}
                  </button>
                : <span style={{fontSize:10.5,color:cs.muted}}>{isAr?"غير متاح":"Unavailable"}</span>}/>
            {tierAtLeast(effectiveTier,"professional") && (
              <SettingsRow cs={cs} icon="target" label={isAr?"وضع التركيز":"Focus Mode"}
                sub={isAr?"يوقف إشعارات الإنجازات وقت الجلسة":"Mutes achievement notifications during the session"}
                right={<Switch cs={cs} tone="purple" on={focusMode} onChange={()=>setFocusMode(f=>!f)} label={isAr?"وضع التركيز":"Focus Mode"}/>}/>
            )}
            {tierAtLeast(effectiveTier,"elite") ? (
              <SettingsRow cs={cs} icon="mic" label={isAr?"المدرب الصوتي":"Voice coach"}
                right={<Switch cs={cs} tone="green" on={voiceCoach} label={isAr?"المدرب الصوتي":"Voice coach"} onChange={()=>{
                  setVoiceCoach(v=>{
                    const nv=!v;
                    try{localStorage.setItem("corvus_voice_coach",nv?"1":"0");}catch{}
                    if(nv){
                      // Turning it on IS a user gesture — the only reliable
                      // moment to unlock speech synthesis in Chrome.
                      try{ primeSpeech(); }catch{}
                      const r=speakCoach(isAr?"المدرب الصوتي شغّال. هساعدك تحافظ على وضعية سليمة.":"Voice coach is on. I'll help you keep a healthy posture.", isAr?"ar":"en",{preview:true});
                      // It used to announce itself and, if the browser refused,
                      // say nothing — leaving the switch green over a coach
                      // that would never speak for the whole session.
                      if(r==="unsupported") addToast(isAr?"المتصفح ده مش بيدعم النطق الصوتي":"This browser doesn't support speech","error");
                      else if(!hasVoiceFor(isAr?"ar":"en")) addToast(isAr?"مفيش صوت عربي متثبّت على الجهاز — شوف الإعدادات تحت":"No Arabic voice installed on this device — see settings below","info");
                    }
                    else stopSpeaking();
                    return nv;
                  });
                }}/>}/>
            ) : (
              /* Show the row for all tiers so users know it exists — tapping
                 it explains the upgrade path instead of silently doing nothing. */
              <SettingsRow cs={cs} icon="mic" label={isAr?"المدرب الصوتي":"Voice coach"}
                sub={isAr?"متاح في باقة Elite":"Available on Elite plan"}
                onClick={()=>setPage("pricing")}
                right={<span style={{fontSize:10,background:"rgba(99,102,241,.18)",color:"#818cf8",padding:"2px 7px",borderRadius:8,fontWeight:600,whiteSpace:"nowrap"}}>Elite ↗</span>}/>
            )}
            {/* The controls that decide how it sounds were only in the account
                settings page — a user mid-session had to end the session, go
                and change them, and start over. */}
            {tierAtLeast(effectiveTier,"elite") && voiceCoach && (
              <Suspense fallback={null}>
                <VoiceCoachSettings cs={cs} isAr={isAr} lang={lang} addToast={addToast} compact />
              </Suspense>
            )}
            <SettingsDivider cs={cs}/>
            {/* Desktop notification permission — show a one-tap enable row so
                users don't have to wait for a bad-posture alert to get prompted. */}
            {"Notification" in window && (() => {
              const perm = Notification.permission;
              if (perm === "granted") return (
                <SettingsRow cs={cs} icon="bell" label={isAr?"إشعارات سطح المكتب":"Desktop notifications"}
                  sub={isAr?"مفعّلة — ستصلك تنبيهات عند إخفاء التبويب":"Enabled — alerts sent when tab is hidden"}
                  right={<span style={{fontSize:10,color:"#10b981",fontWeight:600}}>✓ {isAr?"مفعّل":"On"}</span>}/>
              );
              if (perm === "denied") return (
                <SettingsRow cs={cs} icon="bellOff" label={isAr?"إشعارات سطح المكتب":"Desktop notifications"}
                  sub={isAr?"محظورة — افتح إعدادات المتصفح للسماح":"Blocked — allow in browser settings"}
                  right={<span style={{fontSize:10,color:"#ef4444",fontWeight:600}}>✗ {isAr?"محظور":"Blocked"}</span>}/>
              );
              return (
                <SettingsRow cs={cs} icon="bell" label={isAr?"إشعارات سطح المكتب":"Desktop notifications"}
                  sub={isAr?"تنبيهات عند إخفاء التبويب":"Alerts when the tab is hidden"}
                  onClick={()=>requestNotificationPermission()}
                  right={<span style={{fontSize:10,background:"rgba(245,158,11,.15)",color:"#fbbf24",padding:"2px 7px",borderRadius:8,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{isAr?"تفعيل":"Enable"}</span>}/>
              );
            })()}
            <SettingsDivider cs={cs}/>
            <SettingsRow cs={cs} icon={faceBlur?"eyeOff":"eye"} label={isAr?"إخفاء الوجه":"Face blur"}
              right={<Switch cs={cs} tone="purple" on={faceBlur} label={isAr?"إخفاء الوجه":"Face blur"} onChange={()=>{ setFaceBlur(v=>{ const nv=!v; try{localStorage.setItem("corvus_face_blur",nv?"1":"0");}catch{} return nv; }); }}/>}/>
            <SettingsRow cs={cs} icon="skeleton" label={isAr?"الهيكل":"Skeleton"}
              right={<Switch cs={cs} tone="teal" on={showSkeleton} label={isAr?"الهيكل":"Skeleton"} onChange={()=>{ setShowSkeleton(v=>{ const nv=!v; try{localStorage.setItem("corvus_show_skeleton",nv?"1":"0");}catch{} return nv; }); }}/>}/>
            <SettingsRow cs={cs} icon="angle" label={isAr?"الزوايا":"Angles"}
              right={<Switch cs={cs} tone="teal" on={showAngles} label={isAr?"الزوايا":"Angles"} onChange={()=>{ setShowAngles(v=>{ const nv=!v; try{localStorage.setItem("corvus_show_angles",nv?"1":"0");}catch{} return nv; }); }}/>}/>
            {(tierAtLeast(effectiveTier,"professional")||(histRef.current?.length>0&&qualityFor(effectiveTier).pdfDetail!=="none")) && <SettingsDivider cs={cs}/>}
            {tierAtLeast(effectiveTier,"professional") && (
              <SettingsRow cs={cs} icon="settings" label={isAr?"قواعد تنبيه":"Alert rules"}
                sub={customAlertRules.some(r=>r.enabled)?(isAr?"مفعّلة":"Active"):undefined}
                onClick={()=>setShowCustomAlertRules(true)}
                right={<Icon name="chevronDown" size={13} color={cs.muted} style={{transform:isAr?"rotate(90deg)":"rotate(-90deg)"}}/>}/>
            )}
            {histRef.current?.length>0&&qualityFor(effectiveTier).pdfDetail!=="none"&&(
              <SettingsRow cs={cs} icon="download" label={isAr?"تنزيل PDF":"Download PDF"}
                onClick={async ()=>{
                  const hist=histRef.current||[];
                  const sc=hist.length?Math.round(hist.reduce((a,b)=>a+b,0)/hist.length):0;
                  const dur=sessRef.current?Math.floor((Date.now()-sessRef.current)/1000):0;
                  const gp=totalRef.current?Math.round(goodRef.current/totalRef.current*100):0;
                  // Was silent while working and on success — only errors ever
                  // showed a toast, unlike the near-identical PDF button in the
                  // session-result modal (see its "Generating PDF..."/"✅
                  // downloaded" toasts above). A user clicking this mid-session
                  // had zero feedback until the browser's download popped up
                  // (or silently didn't).
                  addToast(isAr?"جاري إنشاء PDF...":"Generating PDF...","info");
                  try {
                    const { generateSessionPDF } = await import("./lib/pdfReports.js");
                    await generateSessionPDF({
                      session:{
                        avg_score:sc, duration_s:dur, good_pct:gp,
                        alerts_count:acRef.current?.total||0, mode, tier:effectiveTier,
                        score_history:hist.slice(-60), created_at:new Date(),
                        metrics:lastAnalRef.current?.metrics||{},
                        worst_snapshots:[],   // no longer captured
                      },
                      profile: { ...profile, tier: effectiveTier },
                      allSessions: userSessions,
                      aiSummary: lastAnalRef.current?.ai_tip||lastAnalRef.current?.ai_insight||"",
                    });
                    addToast(isAr?"✅ تم تحميل PDF":"✅ PDF downloaded","success");
                  } catch(e){ addToast("PDF: "+(e?.message||"error"),"error"); }
                }}
                // Was the same rotated-chevron affordance used for "Alert
                // rules" one row up — that row opens another panel, so a
                // chevron ("more to see") fits. This row triggers an
                // immediate file download, not navigation, so the leading
                // download icon is repeated instead of implying there's a
                // sub-view to expand into.
                right={<Icon name="download" size={13} color={cs.muted}/>}/>
            )}
          </div>
          {/* Calibrate for accuracy — personalises scoring to the user's own
              neutral posture; reachable straight from the live session. Kept
              visually distinct (green, not a toggle) since it's a one-time
              setup action, not an on/off switch like everything above it. */}
          <button className="liveui-focusable" onClick={()=>setShowCalibWizard(true)} style={{
            background:calibData?"rgba(148,163,184,.06)":"rgba(79,174,142,.1)",
            border:`1px solid ${calibData?cs.border:"rgba(79,174,142,.4)"}`,borderRadius:12,
            padding:"9px 0",fontSize:12,fontWeight:700,color:calibData?cs.muted:(darkMode?"#34d399":"#15803d"),cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,
          }}>
            <Icon name="target" size={14} color={calibData?cs.muted:(darkMode?"#34d399":"#15803d")}/>
            {calibData?(isAr?"إعادة المعايرة":"Re-calibrate"):(isAr?"عايِر للدقة (مُوصى به)":"Calibrate for accuracy")}
          </button>
          {/* Break-reminder chime toggle + interval picker — used to be a
              full-width "Break-reminder chime: ON/OFF" text button sitting
              on its own row, plus 5 separate interval buttons further down
              (moved in below). Both configure the exact same reminder, so
              they're one compact row now: a small icon toggle for the
              chime, a dropdown for the interval — 6 buttons down to 2
              controls. */}
          {breakReminder&&!showBreak&&(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button className="liveui-focusable" onClick={()=>setMuted(v=>!v)}
              title={muted?(isAr?"صوت تذكير الاستراحة: متوقف":"Break-reminder chime: OFF"):(isAr?"صوت تذكير الاستراحة: شغّال":"Break-reminder chime: ON")}
              aria-label={muted?(isAr?"صوت تذكير الاستراحة: متوقف":"Break-reminder chime: off"):(isAr?"صوت تذكير الاستراحة: شغّال":"Break-reminder chime: on")}
              aria-pressed={!muted}
              style={{
                flexShrink:0,width:38,height:36,borderRadius:8,cursor:"pointer",
                background:"rgba(148,163,184,.06)",color:muted?cs.muted:"#4FAE8E",
                border:`1px solid ${muted?cs.border:"rgba(79,174,142,.25)"}`,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
              <Icon name={muted?"bellOff":"bell"} size={15}/>
            </button>
            <div style={{
              flex:1,display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,
              background:"rgba(148,163,184,.06)",border:`1px solid ${cs.border}`,borderRadius:8,
              padding:"0 6px 0 12px",height:36,
            }}>
              <span style={{fontSize:11,color:cs.muted,whiteSpace:"nowrap"}}>{isAr?"استراحة كل":"Break every"}</span>
              {/* The interval picker was the only break control and it had no
                  "off". The reminder itself was hardcoded on with no setter
                  anywhere in the codebase, so a user who did not want it had
                  nowhere to go. "Off" is now a value of the same control, which
                  is where someone would look for it. */}
              <select value={breakReminder?breakIntervalMin:0}
                onChange={e=>{
                  const v=Number(e.target.value);
                  if(v===0){ setBreakReminder(false); }
                  else { setBreakReminder(true); setBreakIntervalMin(v); }
                }}
                className="liveui-focusable"
                style={{
                  background:"transparent",border:"none",color:cs.text,fontSize:12,fontWeight:700,
                  cursor:"pointer",outline:"none",textAlign:isAr?"left":"right",
                }}>
                <option value={0} style={{background:cs.bg,color:cs.text}}>
                  {isAr?"مقفول":"Off"}
                </option>
                {[15,25,45,60,90].map(m=>(
                  <option key={m} value={m} style={{background:cs.bg,color:cs.text}}>
                    {isAr?`${m} دقيقة`:`${m} min`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          )}
          {/* Compact locked-tools strip — everything this tier can't use yet
              lives HERE as small inline chips, instead of each one getting
              its own full-width button mixed in with the tools the user can
              actually press. Same colors/behaviour (still opens billing on
              tap) — just visually demoted so the page doesn't read as "100
              options, none of them mine" for Free/Basic/Pro users. */}
          {(!tierAtLeast(effectiveTier,"elite")||!tierAtLeast(effectiveTier,"professional")||(histRef.current?.length>0&&qualityFor(effectiveTier).pdfDetail==="none"))&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:6,paddingTop:2}}>
              {!tierAtLeast(effectiveTier,"professional")&&(
                <button className="liveui-focusable" onClick={()=>{
                  addToast(isAr?"⚙️ قواعد التنبيه المخصصة متاحة لباقة Pro فأعلى":"⚙️ Custom Alert Rules is a Pro feature","warn");
                  setShowBilling(true);
                }} style={{
                  background:cs.inp,border:`1px solid ${cs.border}`,borderRadius:8,
                  padding:"5px 10px",fontSize:10,fontWeight:600,color:cs.muted,cursor:"pointer",
                  display:"flex",alignItems:"center",gap:4,
                }}>
                  <Icon name="lock" size={11} color={cs.muted}/>{isAr?"قواعد تنبيه":"Alert rules"}
                  <span style={{fontSize:8,color:"#a78bfa",fontWeight:800,letterSpacing:".04em"}}>PRO</span>
                </button>
              )}
              {!tierAtLeast(effectiveTier,"elite")&&(
                <button className="liveui-focusable" onClick={()=>{
                  addToast(isAr?"🎙️ المدرب الصوتي متاح لباقة Elite فقط":"🎙️ Voice coach is an Elite feature","warn");
                  setShowBilling(true);
                }} style={{
                  background:cs.inp,border:`1px solid ${cs.border}`,borderRadius:8,
                  padding:"5px 10px",fontSize:10,fontWeight:600,color:cs.muted,cursor:"pointer",
                  display:"flex",alignItems:"center",gap:4,
                }}>
                  <Icon name="lock" size={11} color={cs.muted}/>{isAr?"مدرب صوتي":"Voice coach"}
                  <span style={{fontSize:8,color:"#4FAE8E",fontWeight:800,letterSpacing:".04em"}}>ELITE</span>
                </button>
              )}
              {histRef.current?.length>0&&qualityFor(effectiveTier).pdfDetail==="none"&&(
                <button className="liveui-focusable" onClick={()=>{
                  addToast(isAr?"تصدير PDF متاح من خطة Professional فأعلى":"PDF export requires Professional plan or higher","warn");
                  setShowUpgrade?.(true); setUpgradeReason?.(isAr?"تصدير PDF":"PDF export");
                }} style={{
                  background:cs.inp,border:`1px solid ${cs.border}`,borderRadius:8,
                  padding:"5px 10px",fontSize:10,fontWeight:600,color:cs.muted,cursor:"pointer",
                  display:"flex",alignItems:"center",gap:4,
                }}>
                  <Icon name="lock" size={11} color={cs.muted}/>{isAr?"تقرير PDF":"PDF report"}
                  <span style={{fontSize:8,color:"#a78bfa",fontWeight:800,letterSpacing:".04em"}}>PRO</span>
                </button>
              )}
            </div>
          )}
        </div>
        )}

        {/* Calibration drift suggestion — shown when posture improved ≥12pts
            since last calibration. Recalibrating tightens the baseline. */}
        {calibDrift && !calibStale && calibData && !camActive && (
          <div style={{margin:"10px 14px 0",background:"rgba(99,102,241,.07)",
            border:"1px solid rgba(99,102,241,.3)",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:11,fontWeight:700,color:darkMode?"#818cf8":"#4338ca",marginBottom:4}}>
              🎯 {isAr?"وضعيتك تحسّنت كثيراً!":"Your posture improved significantly!"}
            </div>
            <div style={{fontSize:10,color:cs.muted,lineHeight:1.5,marginBottom:8}}>
              {isAr
                ? `تحسّنت ${calibDrift.pts} نقطة منذ آخر معايرة (${calibDrift.sessions} جلسة). إعادة المعايرة الآن ستضبط الحدود بدقة أعلى.`
                : `You've improved ${calibDrift.pts}pts since calibrating (${calibDrift.sessions} sessions). Recalibrating now gives you tighter, more precise thresholds.`}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button className="liveui-focusable" onClick={()=>setShowCalibWizard(true)}
                style={{flex:1,fontSize:10,fontWeight:700,padding:"5px 0",
                  background:"rgba(99,102,241,.15)",border:"1px solid rgba(99,102,241,.4)",
                  borderRadius:8,color:darkMode?"#818cf8":"#4338ca",cursor:"pointer"}}>
                {isAr?"إعادة المعايرة":"Recalibrate"}
              </button>
              <button className="liveui-focusable" onClick={()=>setCalibDrift(null)}
                style={{fontSize:10,padding:"5px 10px",background:"transparent",
                  border:"none",color:cs.muted,cursor:"pointer"}}>
                {isAr?"لاحقاً":"Later"}
              </button>
            </div>
          </div>
        )}

        {/* Tools moved to Dashboard — see HomePage tools tab */}

        {/* In-session calibration nudge — appears after 3 min without calibration.
            Dismissible so it doesn't block the interface. */}
        {calibNudge && !calibData && camActive && (
          <div style={{margin:"10px 14px 0",background:"rgba(214,162,76,.07)",
            border:"1px solid rgba(214,162,76,.3)",borderRadius:8,padding:"9px 12px",
            display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:15,flexShrink:0}}>📐</span>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:700,color:darkMode?"#D6A24C":"#b45309",marginBottom:2}}>
                {isAr?"الدقة تتحسن مع المعايرة":"Accuracy improves with calibration"}
              </div>
              <div style={{fontSize:10,color:cs.muted,lineHeight:1.4}}>
                {isAr?"كتفك الفعلي مختلف عن المتوسط — معايرة سريعة تصلح ذلك":"Your build differs from average — a quick calibration fixes this"}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
              <button className="liveui-focusable" onClick={()=>{setCalibNudge(false);setShowCalibWizard(true);}}
                style={{fontSize:10,fontWeight:700,padding:"4px 8px",
                  background:"rgba(214,162,76,.15)",border:"1px solid rgba(214,162,76,.4)",
                  borderRadius:8,color:darkMode?"#D6A24C":"#b45309",cursor:"pointer",whiteSpace:"nowrap"}}>
                {isAr?"معايرة":"Calibrate"}
              </button>
              <button className="liveui-focusable" onClick={()=>setCalibNudge(false)}
                style={{fontSize:10,padding:"3px 8px",background:"transparent",
                  border:"none",color:cs.muted,cursor:"pointer"}}>
                {isAr?"تجاهل":"Dismiss"}
              </button>
            </div>
          </div>
        )}

        {/* Calibration active badge — hidden when the more specific
            "personalised analysis" badge above is already showing, so the two
            don't stack during a calibrated front-mode session. */}
        {calibData&&!(camActive&&calibData?.tolerances)&&( /* Side mode removed app-wide */
          calibStale ? (
            <button className="liveui-focusable" type="button" style={{margin:"10px 14px 0",width:"calc(100% - 28px)",display:"block",fontFamily:"inherit",background:"rgba(214,162,76,.07)",border:"1px solid rgba(214,162,76,.3)",borderRadius:8,padding:"7px 10px",textAlign:"center",fontSize:11,color:darkMode?"#D6A24C":"#b45309",fontWeight:500,cursor:"pointer"}}
              onClick={()=>setShowCalibWizard(true)}
              title={isAr?"المعايرة أقدم من 30 يوم — يُنصح بإعادتها":"Calibration is over 30 days old — recalibrate for best accuracy"}>
              ⚠️ {isAr?"المعايرة قديمة — أعد المعايرة":"Calibration outdated — recalibrate"}
            </button>
          ) : (
            <div style={{margin:"10px 14px 0",background:"rgba(79,174,142,.07)",border:"1px solid rgba(79,174,142,.2)",borderRadius:8,padding:"7px 10px",textAlign:"center",fontSize:11,color:"#4FAE8E",fontWeight:500}}>
              ✓ {isAr?"المعايرة الشخصية نشطة":"Personal calibration active"}
            </div>
          )
        )}

        {/* Company setup nudge — only for accounts that signed up as a
            company/HR account and haven't finished linking to their org yet,
            not individual paying customers on Pro/Elite */}
        {profile&&profile.acct_type==="company"&&profile.user_type!=="employee"&&!profile.company_id&&(
          <div style={{margin:"10px 14px",background:"rgba(79,174,142,.05)",border:"1px solid rgba(79,174,142,.15)",borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <span style={{fontSize:11,color:cs.muted}}>🏢 {isAr?"إعداد مساحة الشركة":"Set up company workspace"}</span>
            <button className="liveui-focusable" onClick={()=>setShowCompanyOnboard(true)}
              style={{background:"#4FAE8E",border:"none",borderRadius:8,padding:"4px 10px",fontSize:10,fontWeight:700,color:"#fff",cursor:"pointer",flexShrink:0}}>
              {isAr?"ابدأ":"Start"}
            </button>
          </div>
        )}

        {/* #10 Streak protection alert */}
        {streakAlert&&(
          <div style={{margin:"10px 14px",background:"rgba(214,162,76,.08)",border:"1px solid rgba(214,162,76,.35)",borderRadius:12,padding:"12px 14px"}}>
            {/* #fcd34d is a light-mode-illegible shade on its own (~1.6:1
                against this app's near-white light background) — darker
                variant for light mode, same pattern as the abox() fix above. */}
            <div style={{fontSize:13,fontWeight:700,color:darkMode?"#fcd34d":"#b45309",marginBottom:4}}>
              ⚡ {isAr?`سلسلة الـ ${profile?.streak_days} يوم بتاعتك في خطر!`:`Your ${profile?.streak_days}-day streak is at risk!`}
            </div>
            <div style={{fontSize:11,color:cs.muted,marginBottom:10}}>
              {isAr?"وضعيتك وحشة أكتر من دقيقتين. خذ استراحة صغيرة؟":"Poor posture for 2+ min. Take a quick break to protect it?"}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button className="liveui-focusable" onClick={()=>{setStreakAlert(false);goToBreak();}} style={{
                flex:1,background:"rgba(214,162,76,.15)",border:"1px solid rgba(214,162,76,.35)",
                borderRadius:8,padding:"7px 0",fontSize:11,fontWeight:700,color:darkMode?"#fcd34d":"#b45309",cursor:"pointer"}}>
                {isAr?"استراحة الآن 🧘":"Break now 🧘"}
              </button>
              <button className="liveui-focusable" onClick={()=>setStreakAlert(false)} style={{
                background:"rgba(148,163,184,.06)",border:`1px solid ${cs.border}`,
                borderRadius:8,padding:"7px 12px",fontSize:11,color:cs.muted,cursor:"pointer"}}>
                {isAr?"تجاهل":"Ignore"}
              </button>
            </div>
          </div>
        )}

        {/* #4 Contextual notification permission card */}
        {showNotifCard&&"Notification" in window&&Notification.permission==="default"&&(
          <div style={{margin:"10px 14px",background:"rgba(99,102,241,.07)",border:"1px solid rgba(99,102,241,.25)",borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:12,fontWeight:700,color:darkMode?"#a5b4fc":"#4338ca",marginBottom:4}}>
              🔔 {isAr?"تفعيل التنبيهات؟":"Enable background alerts?"}
            </div>
            <div style={{fontSize:10,color:cs.muted,marginBottom:10,lineHeight:1.5}}>
              {isAr?"نبعتلك تنبيه لو وضعيتك وحشت وانت مش شايف الشاشة — مفيش spam.":"Get notified when posture drops even when the tab is in the background. No spam."}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button className="liveui-focusable" onClick={async()=>{const r=await requestNotificationPermission();setNotifPerm(r);if(r==="granted")setDesktopNotifs(true);setShowNotifCard(false);}} style={{
                flex:1,background:"rgba(99,102,241,.15)",border:"1px solid rgba(99,102,241,.35)",
                borderRadius:8,padding:"6px 0",fontSize:11,fontWeight:700,color:darkMode?"#a5b4fc":"#4338ca",cursor:"pointer"}}>
                {isAr?"السماح ✓":"Allow ✓"}
              </button>
              <button className="liveui-focusable" onClick={()=>setShowNotifCard(false)} style={{
                background:"rgba(148,163,184,.06)",border:`1px solid ${cs.border}`,
                borderRadius:8,padding:"6px 10px",fontSize:11,color:cs.muted,cursor:"pointer"}}>
                {isAr?"مش دلوقتي":"Not now"}
              </button>
            </div>
          </div>
        )}

        {/* Break reminder */}
        {showBreak&&(
          <div style={{margin:"10px 14px",background:"rgba(214,162,76,.08)",border:"1px solid rgba(214,162,76,.3)",borderRadius:12,padding:"12px 14px",textAlign:"center",animation:"fadeUp .3s ease"}}>
            <div style={{fontSize:14,fontWeight:700,color:darkMode?"#fcd34d":"#b45309",marginBottom:4}}>⏰ {isAr?"وقت استراحة!":"Break time!"}</div>
            <div style={{fontSize:11,color:cs.muted,marginBottom:10}}>
              {isAr?`${breakIntervalMin} دقيقة مرت — استرح دقيقتين`:`${breakIntervalMin} min passed — take a 2-min stretch`}
            </div>
            <div style={{display:"flex",gap:6,justifyContent:"center"}}>
              <button className="liveui-focusable" onClick={()=>{dismissBreak();goToBreak();}}
                style={{background:"rgba(214,162,76,.18)",border:"1px solid rgba(214,162,76,.4)",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,color:darkMode?"#fcd34d":"#b45309",cursor:"pointer"}}>
                {isAr?"ابدأ الاستراحة 🧘":"Start break 🧘"}
              </button>
              <button className="liveui-focusable" onClick={()=>snoozeBreak(5)}
                style={{background:"rgba(148,163,184,.06)",border:`1px solid ${cs.border}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:500,color:cs.muted,cursor:"pointer"}}>
                {isAr?"5 دقايق":"5 min"}
              </button>
            </div>
          </div>
        )}
        {/* Break interval selector moved into the collapsible Session
            settings block above — see the comment there. */}

        {/* Manual break entry — the guided break is always one tap away */}
        <div style={{padding:"10px 14px 0"}}>
          <button className="liveui-focusable" onClick={goToBreak} style={{
            width:"100%",background:"rgba(14,165,233,.08)",border:"1px solid rgba(14,165,233,.25)",
            borderRadius:12,padding:"10px 0",fontSize:12,fontWeight:700,color:darkMode?"#38bdf8":"#0369a1",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            🧘 {isAr?"خذ استراحة حركة":"Take a movement break"}
          </button>
        </div>

        <div style={{padding:"10px 14px",fontSize:10,color:cs.muted,textAlign:"center"}}>
          {isAr ? "☁ تم الحفظ · ⚡ مدعوم بالذكاء الاصطناعي" : "☁ Data saved · ⚡ AI powered"}
        </div>
      </div>
    </div>
  </></ErrorBoundary>);
}









