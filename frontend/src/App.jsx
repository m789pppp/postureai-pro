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
  doc, updateDoc,
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
      await fetch("/api/auth/mfa/login-verify", {method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+(await getAuthToken().catch(()=>""))},body:JSON.stringify({code:code.trim()})});
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
        <div style={{ fontSize:13, color:cs.textDim, marginBottom:20, lineHeight:1.6 }}>
          {method==="sms"
            ? (isAr?`أرسلنا كود لرقمك المسجل. اضغط "إرسال كود" لو محتاج واحد جديد.`:`We'll text a code to your registered number. Tap "Send code" if you need a new one.`)
            : (isAr?"افتح تطبيق المصادقة وادخل الكود المكون من 6 أرقام":"Open your authenticator app and enter the 6-digit code")}
        </div>
        {method==="sms" && (
          <button onClick={sendSms} disabled={busy} style={{ marginBottom:14, background:"rgba(255,255,255,0.06)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"8px 16px", cursor:"pointer", fontWeight:600, fontSize:12 }}>
            {smsSent ? (isAr?"✓ اتبعت — ابعت تاني":"✓ Sent — resend") : (isAr?"إرسال كود":"Send code")}
          </button>
        )}
        <input
          value={code}
          onChange={e=>setCode(e.target.value.replace(/[^0-9A-Za-z-]/g,""))}
          onKeyDown={e=>e.key==="Enter"&&verify()}
          placeholder={isAr?"الكود":"Code"}
          maxLength={11}
          style={{ width:"100%", boxSizing:"border-box", textAlign:"center", fontSize:20, letterSpacing:3, fontWeight:700, background:"rgba(255,255,255,0.05)", border:`1.5px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"12px", outline:"none", marginBottom:12 }}
          autoFocus
        />
        {error && <div style={{ color:"#C6604F", fontSize:12, marginBottom:12 }}>{error}</div>}
        <button onClick={verify} disabled={busy} style={{ width:"100%", background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:800, fontSize:15, marginBottom:10 }}>
          {busy ? (isAr?"جاري التحقق…":"Verifying…") : (isAr?"تأكيد":"Verify")}
        </button>
        <div style={{ fontSize:11, color:cs.textDim, marginBottom:14 }}>{isAr?"مش عندك وصول للتطبيق أو الرقم؟ استخدم أحد أكواد النسخ الاحتياطي":"Lost access to your app or phone? Use one of your backup codes instead"}</div>
        <button onClick={onSignOut} style={{ background:"transparent", border:"none", color:cs.textDim, cursor:"pointer", fontSize:12, textDecoration:"underline" }}>{isAr?"تسجيل خروج":"Sign out"}</button>
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
  useEffect(()=>{
    const t = setTimeout(()=>{
      setAuthChecked(c=>{ if(!c && !_oauthInProgress.current){ console.warn("[App] Auth never resolved — forcing landing"); setPageRaw("landing"); return true; } return c; });
    }, 6000);
    return ()=>clearTimeout(t);
  },[]);
  // ── Hash-based routing — fixes back button & enables deep links ──
  const VALID_PAGES = new Set(["home","live","setup","pricing","auth","landing","admin","hr","enterprise","report","marketplace","break"]);
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
  const [page, setPageRaw] = useState(() => {
    const h = window.location.hash;
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
  const[sound,setSound]=useState(true);
  // Elite voice coach — persisted preference; actual enablement is tier-gated below
  const[voiceCoach,setVoiceCoach]=useState(()=>{try{return localStorage.getItem("corvus_voice_coach")==="1";}catch{return false;}});
  const[faceBlur,setFaceBlur]=useState(()=>{try{return localStorage.getItem("corvus_face_blur")==="1";}catch{return false;}});
  // Pro-tier Custom Alert Rules — synced from profile once it loads (see effect below)
  const[customAlertRules,setCustomAlertRules]=useState([]);
  const[showCustomAlertRules,setShowCustomAlertRules]=useState(false);
  const[showSkeleton,setShowSkeleton]=useState(()=>{try{return localStorage.getItem("corvus_show_skeleton")!=="0";}catch{return true;}});
  const[showAngles,setShowAngles]=useState(()=>{try{return localStorage.getItem("corvus_show_angles")!=="0";}catch{return true;}});
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
  const[companyId,setCompanyId]=useState(null);
  const[showUpgrade,setShowUpgrade]=useState(false);
  const[upgradeReason,setUpgradeReason]=useState("");
  const[showAcctSelect,setShowAcctSelect]=useState(false);
  const[showDeviceSelect,setShowDeviceSelect]=useState(false);
  const[breakReminder,setBreakReminder]=useState(true);
  const[breakReturnPage,setBreakReturnPage]=useState("live"); // where the break page returns to
  const goToBreak=useCallback(()=>{ setBreakReturnPage(page==="break"?"live":page); setPage("break"); },[page]);
  const[breakIntervalMin,setBreakIntervalMin]=useState(25);
  const[breakTimerSec,setBreakTimerSec]=useState(0);
  const setBreakTimer = setBreakTimerSec; // alias for legacy references
  const[showDashboard,setShowDashboard]=useState(false);

  // Calibration (personal baseline)
  const[showCalibWizard,setShowCalibWizard]=useState(false);
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
  useEffect(()=>{
    if(!calibData?.calibrated_at || !sessions?.length) return;
    const calibTs = new Date(calibData.calibrated_at).getTime();
    const postCalib = sessions
      .filter(s => s.created_at && new Date(s.created_at).getTime() > calibTs)
      .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    if(postCalib.length < 10) return;
    const recentAvg = Math.round(postCalib.slice(0,10).reduce((a,s)=>a+(s.avg_score||0),0)/10);
    const baseline  = calibData.baseline_avg_score;
    if(!baseline || baseline <= 0) return;
    const improvement = recentAvg - baseline;
    setCalibDrift(improvement >= 12 ? { pts: improvement, sessions: postCalib.length } : null);
  },[sessions, calibData]);
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
  const { showBreak, dismiss: dismissBreak, snooze: snoozeBreak } = useBreakTimer(breakIntervalMin, breakReminder);
  const[showBreakAlert,setShowBreakAlert]=useState(false);

  // Sound feedback
  const[muted,setMuted]=useState(false);
  const { alertIfNeeded } = useSoundFeedback(muted);
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

  // Health consent gate — must be accepted once before the first analysis.
  // Corvus is a wellness/awareness tool, NOT a medical device; explicit
  // informed consent protects the user and limits liability.
  const[showHealthConsent,setShowHealthConsent]=useState(false);
  const healthConsentRef=useRef((()=>{try{return localStorage.getItem("corvus_health_consent_v1")==="1";}catch{return false;}})());
  function acceptHealthConsent(){
    try{localStorage.setItem("corvus_health_consent_v1","1");}catch{}
    healthConsentRef.current=true;
    setShowHealthConsent(false);
    if(user?.uid){ updateDoc(doc(db,"users",user.uid),{healthDisclaimerAcceptedAt:new Date().toISOString()}).catch(()=>{}); }
    startCamera();
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
          <ul style={{color:cs.muted,fontSize:12.5,lineHeight:1.6,margin:"0 0 16px",paddingInlineStart:18}}>
            <li>{isAr?"لو عندك ألم أو حالة طبية، استشر طبيباً أو أخصائي علاج طبيعي.":"If you have pain or a medical condition, consult a doctor or physiotherapist."}</li>
            <li>{isAr?"لا تعتمد على النتائج في اتخاذ قرارات طبية.":"Do not rely on results for medical decisions."}</li>
            <li>{isAr?"معالجة الفيديو تتم على جهازك في الوقت اللحظي.":"Video is processed on your device in real time."}</li>
          </ul>
          <div style={{display:"flex",gap:10,flexDirection:isAr?"row-reverse":"row"}}>
            <button onClick={acceptHealthConsent} style={{flex:1,background:"linear-gradient(135deg,#3b82f6,#2563eb)",border:"none",borderRadius:11,padding:"13px 18px",fontSize:13.5,fontWeight:700,color:"#fff",cursor:"pointer"}}>
              {isAr?"أوافق وابدأ":"I agree — start"}
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
  // Fallback-mode health tracking — when local MediaPipe failed to load,
  // /api/analyze IS the only source of scores. If it silently keeps
  // failing (backend down, network), the camera looks "frozen" with zero
  // feedback. Tracks consecutive failures so we can surface a real error
  // after a short grace period instead of retrying forever in silence.
  const backendFailRef  = useRef(0);
  const backendFailShownRef = useRef(false);
  const startingCameraRef = useRef(false); // sync guard — see startCamera()
  const stoppingRef = useRef(false); // sync guard — see stopCamera()
  const lightCheckRef=useRef({t:0,canvas:null,wasLow:false});
  const lightAlRef=useRef(0); // separate cooldown for lighting alerts (60s, not 8s)
  const insightsRef=useRef(null);
  // alertCauseRef: { [causeKey]: { last: timestamp, count: number } }
  // count drives exponential backoff: 1st repeat → 5min, 2nd → 10min, 3rd+ → 20min
  const alertCauseRef=useRef({});
  const histRef=useRef([]);const goodRef=useRef(0);const totalRef=useRef(0);
  const acRef=useRef({total:0,neck:0,dist:0});const alRef=useRef([]);
  const sessRef=useRef(null);const lastAnalRef=useRef(null);
  // Elite: worst-posture snapshots captured during the session (max 3, small JPEGs)
  const worstSnapsRef=useRef([]);const lastSnapMsRef=useRef(0);

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
  useEffect(()=>{ setVoiceCoachEnabled(voiceCoach && tierAtLeast(effectiveTier,"elite")); },[voiceCoach,effectiveTier]);
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
    if(plan&&TIERS[plan]){setDeepPlan(plan);setDeepBilling(bill);}
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
        getUserSessions(u.uid).then(setUserSessions).catch(e=>console.warn("[Sessions]",e.message));
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
      setAuthChecked(c=>{ if(!c){ setPage("landing"); return true; } return c; });
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
              // Re-trigger preloader when sessions arrive (has real data now)
              if (sessions?.length > 0) {
                setTimeout(() => {
                  preloadAIInsights(u.uid, p, sessions, null, p?.is_trial ? p?.trial_tier : p?.tier, lang);
                }, 1500);
              }
            }, err => {
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
                setPage(planParam && TIERS[planParam] ? "pricing" : "home");
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
          setMfaChallengePending(false);
          setPage("landing");
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
          if(!subjectOk){ return; } // drop frame — don't update smoother or score
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
            alertIfNeeded(displayScore);
            checkCustomAlertRules(finalResult.metrics);
            finalResult.pain_prediction = updatePainPrediction(displayScore, finalResult.metrics);
            histRef.current.push(displayScore);
            if(histRef.current.length>40)histRef.current=histRef.current.slice(-40);
            lastAnalRef.current=finalResult;
            startTransition(()=>{ setHistory([...histRef.current]);setAnalysis(finalResult); });
            // Privacy: pixelate the face first so the skeleton draws on top of it.
            if(faceBlur) drawFaceBlur(ctx,vid,lms,W,H);
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
            // Elite: capture the worst 3 moments of the session as small JPEGs
            // (≤20s apart; a new dip replaces the least-bad stored snapshot)
            if(gateScore<60 && tierAtLeast(effectiveTier,"elite")){
              try{
                const _snow=Date.now();
                const _v=vidRef.current;
                const _snaps=worstSnapsRef.current;
                if(_v && _v.readyState>=2 && _snow-lastSnapMsRef.current>20000 &&
                   (_snaps.length<3 || finalResult.overall<Math.max(..._snaps.map(s=>s.score)))){
                  const _sc=document.createElement("canvas");
                  const _sw=320,_sh=Math.max(120,Math.round(320*(_v.videoHeight/Math.max(_v.videoWidth,1))))||240;
                  _sc.width=_sw;_sc.height=_sh;
                  const _sctx=_sc.getContext("2d");
                  _sctx.drawImage(_v,0,0,_sw,_sh);
                  // Always blurred, regardless of the live "Blur face
                  // (privacy)" toggle — these worst-moment snapshots are
                  // saved into Firestore, PDF exports, and the Sessions
                  // list, all places a face is more likely to be seen by
                  // someone other than the user (an HR admin viewing team
                  // reports, a shared/downloaded PDF, etc.) than the live
                  // on-screen feed the toggle otherwise controls.
                  drawFaceBlur(_sctx,_v,lms,_sw,_sh);
                  const _img=_sc.toDataURL("image/jpeg",0.6);
                  lastSnapMsRef.current=_snow;
                  _snaps.push({img:_img,score:finalResult.overall,time:new Date().toLocaleTimeString()});
                  _snaps.sort((a,b)=>a.score-b.score);
                  if(_snaps.length>3)_snaps.length=3;
                }
              }catch{}
            }
            if(lightCheckRef.current.wasLow){
              // Don't trust score-based decisions in poor lighting — neither
              // accumulate nor reset the bad-streak timer, since we can't
              // tell if it's genuinely bad posture or just a bad frame.
              // Separate 60s cooldown so lighting notices don't block posture alerts.
              if(now-lightAlRef.current>60000){
                lightAlRef.current=now;
                setAlertMsg({text:isAr?"الإضاءة ضعيفة جدًا — حسّن الإضاءة لقراءة أدق":"Lighting too low — improve lighting for an accurate reading",type:"warn"});
              }
            }else if(gateScore<65){
              if(!badRef.current)badRef.current=now;
              else if(now-badRef.current>15000){
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

                // Pick the most actionable alert cause
                let causeKey="posture", msg="Sustained poor posture — correct position now", msgAr="وضعية سيئة مستمرة — صحّح وضعيتك الآن";
                if(nl>14){causeKey="neck";msg=`Neck lean ${nl}° — raise monitor to eye level`;msgAr=`ميل رقبة ${nl}° — ارفع الشاشة لمستوى عينيك`;acRef.current.neck++;}
                else if(Math.abs(yaw)>12){causeKey="yaw";msg=`Head turned ${Math.round(Math.abs(yaw))}° — face the monitor`;msgAr=`الرأس مائل ${Math.round(Math.abs(yaw))}° — واجه الشاشة مباشرة`;}
                else if(dist&&dist<lo){causeKey="dist";msg=`Too close (${dist}cm) — move to ${lo}–${hi}cm`;msgAr=`قريب جداً (${dist}سم) — ابتعد إلى ${lo}–${hi}سم`;acRef.current.dist++;}

                // Exponential backoff per cause: 1st=5min, 2nd=10min, 3rd+=20min
                // Prevents repeated same-cause spam while still alerting on genuine persistence
                const causeEntry = alertCauseRef.current[causeKey] || { last: 0, count: 0 };
                const causeCooldown = causeEntry.count === 0 ? 5*60*1000
                                    : causeEntry.count === 1 ? 10*60*1000
                                    : 20*60*1000;
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
                  if(sound)playBeep(sev);
                  speakCoach(displayMsg, isAr?"ar":"en"); // no-op unless Elite + toggle on
                  // Smart permission: show in-app card after first real alert
                  if("Notification" in window && Notification.permission==="default"){
                    setShowNotifCard(true);
                  }
                  sendDesktopNotif(msg,finalResult.overall);
                }
                } // close if(_cool)
              } // close else if(badRef>15000)
            }else{
              badRef.current=null;
              // Good posture — silent status update only, no alert box noise
              // NOTE: was `grade(finalResult.overall,t)` — `grade()` reads
              // t.excellent/t.good/t.fair/t.poor, which this translations
              // object never defined, so scoreStatus.grade was always
              // literally the string "undefined" wherever it got rendered.
              // gradeScore/gradeScoreAr (already imported, already used by
              // the engine's own grading) give the real label.
              startTransition(()=>setScoreStatus({score:finalResult.overall,grade:isAr?gradeScoreAr(finalResult.overall):gradeScore(finalResult.overall)}));
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
    const needsBackend = mpStatus==="fallback" || eliteEquivalent;
    if(needsBackend && totalRef.current%45===0 && canvRef.current){
      const c=canvRef.current,v2=vidRef.current;
      if(v2&&v2.readyState>=2){c.width=v2.videoWidth;c.height=v2.videoHeight;c.getContext("2d").drawImage(v2,0,0);}
      // Non-blocking fire-and-forget with 4s timeout — never stalls local analysis
      const _ctrl = new AbortController();
      const _tmr  = setTimeout(() => _ctrl.abort(), 4000);
      AnalysisAPI.analyze({
        frame:        c.toDataURL("image/jpeg",.88),
        mode,
        lang,
        session_id:   sessionId,
        calibration:  calibData,
        signal:       _ctrl.signal,
      }).then(d=>{
        clearTimeout(_tmr);
          // For Elite-equivalent: send snapshot every ~12 frames for PDF
          if(eliteEquivalent&&totalRef.current%12===0&&d.overall>0){
            AnalysisAPI.addSnapshot(sessionId, c.toDataURL("image/jpeg",.6), d.overall||d.score, new Date().toLocaleTimeString())
              .catch(()=>{});
          }
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
            lastAnalRef.current=result;
            startTransition(()=>{ setHistory([...histRef.current]);setAnalysis(result); });
            const now=Date.now();
            if(smoothed<65){
              if(!badRef.current)badRef.current=now;
              else if(now-badRef.current>15000){
                // Severity-aware cooldown: severe=5s, moderate=15s, mild=30s
                const _sev=result.overall<40?'severe':result.overall<55?'moderate':'mild';
                const _cool=_sev==='severe'?5000:_sev==='moderate'?15000:30000;
                if(now-lastAlRef.current>_cool){
                lastAlRef.current=now;acRef.current.total++;
                // Per-cause exponential backoff (same as local MP loop)
                const causeKeyBE = result.alerts?.[0]?.slice(0,30) || "posture";
                const causeEntryBE = alertCauseRef.current[causeKeyBE] || { last: 0, count: 0 };
                const causeCoolBE = causeEntryBE.count === 0 ? 5*60*1000 : causeEntryBE.count === 1 ? 10*60*1000 : 20*60*1000;
                if(now - causeEntryBE.last > causeCoolBE){
                alertCauseRef.current[causeKeyBE] = { last: now, count: causeEntryBE.count + 1 };
                const msgFb = isAr
                  ? (result.alerts_ar?.[0] || "وضعية سيئة — صحّح وضعيتك")
                  : (result.alerts?.[0] || "Poor posture — correct position");
                setAlertCounts({...acRef.current});
                alRef.current=[{time:new Date().toLocaleTimeString(),msg:msgFb,score:smoothed},...alRef.current].slice(0,20);
                setAlerts([...alRef.current]);setAlertMsg({text:msgFb,type:"warn"});
                if(sound)playBeep();
                speakCoach(msgFb, isAr?"ar":"en"); // no-op unless Elite + toggle on
                sendDesktopNotif(msgFb,smoothed);
                } // close per-cause backoff
                } // close if(_cool)
              } // close else if(badRef>15000)
            }else{
              badRef.current=null;
              startTransition(()=>setScoreStatus({score:smoothed,grade:isAr?gradeScoreAr(smoothed):gradeScore(smoothed)}));
            }
          }
          // Always use local Corvus AI for Elite-equivalent tiers
          if(d.claude_analysis&&eliteEquivalent)setAiInsight(d.claude_analysis);
        }).catch(e=>{
          clearTimeout(_tmr);
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
  },[mode,tier,sessionId,sound,t,calibData,pushScore,alertIfNeeded,checkCustomAlertRules,mpStatus,faceBlur,showSkeleton,showAngles]);

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
    console.log("[Corvus] Starting camera in mode:", effectiveMode);
    setCameraStatus("requesting");
    try{
      const facingMode="user"; // Phone mode removed app-wide — always front camera now
      const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:{ideal:facingMode}}});
      streamRef.current=s;
      if(!vidRef.current){setCameraStatus("idle");return;}
      vidRef.current.srcObject=s;
      let metadataLoaded=true;
      await new Promise((res,rej)=>{
        vidRef.current.onloadedmetadata=res;
        setTimeout(rej,8000); // 8s timeout
      }).catch(()=>{ metadataLoaded=false; });
      if(!vidRef.current){return;}
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
      setCameraStatus(isDenied?"denied":noDevice?"no-device":"idle");
      const errMsg=isDenied
        ?(isAr?"تم رفض الوصول للكاميرا — اضغط 'سماح' في المتصفح":"Camera access denied — click Allow in browser bar")
        :noDevice
        ?(isAr?"لا توجد كاميرا — قم بتوصيل كاميرا والمحاولة مجدداً":"No camera detected — connect one and retry")
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
      lmSmootherRef.current?.reset();
      frameBufferRef.current?.clear();
      distSmootherRef.current?.reset();
      resetProportions();
      resetScore();
      resetPainPrediction();
      insightsRef.current=null;setSessionInsights([]);
      worstSnapsRef.current=[];lastSnapMsRef.current=0;
      backendFailRef.current=0;backendFailShownRef.current=false;setBackendDown(false);
      // Reset all alert cooldowns — exponential backoff from previous
      // sessions must not carry over into a fresh session
      lastAlRef.current=0;
      lightAlRef.current=0;
      badRef.current=null;
      alertCauseRef.current={};
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

  async function stopCamera(){
    // Reentrancy guard: this function isn't actually awaited end-to-end
    // (the Firestore saveSession() call below is fire-and-forget via
    // .then()/.catch(), not awaited) and isSavingSession — the only thing
    // that disables the Stop button — is React state, set asynchronously
    // by this same call. A rapid double-click, or Stop immediately
    // followed by Back, could run this function twice before either of
    // those catches up, and the second call would read the same
    // not-yet-reset hist/avg/session data and fire a SECOND saveSession()
    // for the same session — a duplicate Firestore doc and doubly-applied
    // user stats. stoppingRef is a synchronous ref, reset at the start of
    // the next beginScoring(), so it closes the race regardless of render
    // timing.
    if(stoppingRef.current) return;
    stoppingRef.current = true;
    setIsSavingSession(true); // show saving state on stop button
    stopSpeaking(); // cut any in-flight voice-coach cue
    lmSmootherRef.current?.reset();
    frameBufferRef.current?.clear();
    distSmootherRef.current?.reset();
    resetProportions();
    lightCheckRef.current={t:0,canvas:lightCheckRef.current.canvas,wasLow:false};setLowLight(false);
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
    pausedAtRef.current=null;
    setPreviewPhase(null);
    setTimeout(()=>setIsSavingSession(false), 1500);
    if(countdownIvRef.current){ clearInterval(countdownIvRef.current); countdownIvRef.current=null; }
    setShowHealthConsent(false);

    // Always save — even if no analysis data (backend offline/MediaPipe not loaded)
    const la  = lastAnalRef.current||{};
    const hist = histRef.current||[];
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
          rounded_shoulders:{ en: val!=null?`Shoulders rounded ${val}${unit} — pull shoulder blades together and down (retract + depress)`:"Pull shoulder blades together and down",
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
      // Elite: worst-posture snapshots captured during the session
      worst_snapshots: worstSnapsRef.current.slice(0,3),
    };
    setSessionResult(result);
      if((result.avg_score||0)>=70){
        setShareCardData({score:result.avg_score,grade:result.grade,streak:0});
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
      addToast(isAr?"الجلسة قصيرة جداً (أقل من 5 ثواني)":"Session too short (under 5s) — not saved","info");
    } else if(user && dur >= 5){ // Save if session lasted at least 5 seconds
      addToast(isAr?"جاري حفظ الجلسة...":"Saving session...","info");
      saveSession(user.uid,{
        session_id:sessionId, mode, tier:effectiveTier, avg_score:avg,
        good_pct:gPct, duration_s:dur, duration_sec:dur,
        alerts_count:acRef.current?.total||0,
        score_history:hist.slice(-60),
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
        ...(()=>{
          if(!worstSnapsRef.current.length) return {};
          const snaps = worstSnapsRef.current.slice(0,3);
          // rough byte estimate: JSON.stringify is a good proxy
          const roughBytes = JSON.stringify(snaps).length;
          if(roughBytes > 600_000) return {}; // skip if > ~600KB to leave room for other fields
          return { worst_snapshots: snaps };
        })(),
      }).then(()=>{
        addToast(isAr?"✅ تم حفظ الجلسة":"✅ Session saved","success");
        // Refresh sessions list so the new session appears immediately
        // without waiting for the user to re-login or navigate away.
        if(user) getUserSessions(user.uid).then(setUserSessions).catch(()=>{});
        // #9 Compute weekly pattern from this session's alert causes
        if(alRef.current.length>=3){
          const causeCounts={};
          alRef.current.forEach(a=>{const c=a.cause||"posture";causeCounts[c]=(causeCounts[c]||0)+1;});
          const top=Object.entries(causeCounts).sort(([,a],[,b])=>b-a)[0];
          if(top){
            const[topKey,topCount]=top;
            const pct=Math.round(topCount/alRef.current.length*100);
            const causeLabel={neck:"neck lean",yaw:"head rotation",dist:"screen distance",posture:"general posture"}[topKey]||topKey;
            const hourCounts={};
            alRef.current.filter(a=>(a.cause||"posture")===topKey).forEach(a=>{
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
          queue.push({uid:user.uid,data:{
            session_id:sessionId, mode, tier:effectiveTier, avg_score:avg,
            good_pct:gPct, duration_s:dur, duration_sec:dur,
            alerts_count:acRef.current?.total||0,
            score_history:hist.slice(-60),
            alert_causes: alRef.current.map(a=>({cause:a.cause||"posture",hour:a.time?.split(":")?.[0]||"0",severity:a.severity||"mild"})),
            metrics:la.metrics||{},
            ai_tip: la.ai_tip||la.ai_insight||la.claude_analysis||"",
            improvement_tip: result.improvement_tip||"",
            pain_summary: result.pain_summary||null,
            pain_prediction: la.pain_prediction||null,
            trend: result.trend||"stable",
            ...(worstSnapsRef.current.length?{worst_snapshots:worstSnapsRef.current.slice(0,3)}:{}),
          },queuedAt:Date.now()});
          localStorage.setItem(key, JSON.stringify(queue.slice(-10))); // cap at 10 pending
          addToast(isAr?"⚠️ فشل الحفظ — هنحاول تاني تلقائياً":"⚠️ Save failed — will retry automatically","warn");
        }catch{
          addToast("❌ Save failed: "+(e?.code||e?.message||"unknown"),"error");
        }
      });
    } else if(user && dur < 5){
      addToast(isAr?"الجلسة قصيرة جداً (أقل من 5 ثواني)":"Session too short (under 5s) — not saved","info");
    } else if(!user){
      addToast(isAr?"غير مسجل الدخول":"Not signed in — not saved","error");
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
    stopCamera();
    setPage("home");
    setCamActive(false);
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
    pausedAtRef.current = Date.now();
    setIsPaused(true);
  }

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
  }


  // ── Switch camera mode from the live page ───────────────────────
  // Previously the mode (laptop/phone/side) could only be chosen on the
  // setup screen — users had to leave the session to change it. This lets
  // them switch on the fly; when a session is running we reset the analysis
  // buffers so the new mode (front vs side use different maths) starts clean.
  function switchMode(m){
    if(!m || m===mode) return;
    setMode(m);
    if(camActive){
      lmSmootherRef.current?.reset();
      frameBufferRef.current?.clear();
      distSmootherRef.current?.reset();
      resetProportions();
      resetScore();
      histRef.current=[]; setHistory([]);
      goodRef.current=0; setGoodF(0);
      totalRef.current=0; setTotalF(0);
      setAnalysis(null);
      addToast(isAr?`تم التبديل إلى ${MC[m]?.label||m}`:`Switched to ${MC[m]?.label||m}`,"info");
    }
  }

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
    // Normalise tier string — Firestore sometimes returns "Elite" or "ELITE"
    const normTier = (tier||"standard").toLowerCase();
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
    const hist    = histRef.current || history || [];
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
  const isHRAdmin = isAdmin
    || profile?.is_org_owner === true
    || profile?.user_type === "hr_admin"
    || profile?.acct_type === "company"
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
      fontFamily:"'DM Sans',system-ui,-apple-system,sans-serif",
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
        onStartSession={()=>{ window.__demoMode=true; setPage("live"); setTimeout(()=>startCamera(),200); }}
        onExit={()=>clearDemoOnExit(setPage)}
        onUpgrade={()=>{ clearDemoOnExit(()=>{}); window.__demoMode=false; setPage("auth"); }}
      />
    </ErrorBoundary>
  );
  if(page==="embed")return <EmbedWidget/>;
  if(page==="break")return(
    <ErrorBoundary>
      <BreakPage cs={cs} lang={lang} muted={muted} onExit={()=>setPage(breakReturnPage||"live")}/>
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
      minHeight:"100vh",background:"#0d1a2e",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      gap:16,fontFamily:"'Inter',system-ui,sans-serif",
    }}>
      <div style={{
        width:48,height:48,borderRadius:13,
        background:"linear-gradient(135deg,#1a56db,#0891b2)",
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
        boxShadow:"0 8px 24px rgba(26,86,219,.3)",marginBottom:8,
      }}>◈</div>
      <div style={{width:32,height:32,border:"3px solid rgba(26,86,219,.2)",borderTopColor:"#1a56db",
        borderRadius:"50%",animation:"authSpin 1s linear infinite"}}/>
      <div style={{color:"rgba(255,255,255,.5)",fontSize:14}}>
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
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[
                  {id:"individual",icon:"🧑‍💻",label:isAr?"مستخدم فردي":"Individual",desc:isAr?"تتبع وضعيتك الشخصية، AI Coach، وتقارير شخصية":"Personal posture tracking, AI Coach, personal reports",color:"#3b82f6",features:isAr?["داشبورد شخصي","AI Coach","تقارير PDF"]:["Personal dashboard","AI Coach","PDF reports"]},
                  {id:"company",icon:"🏢",label:isAr?"شركة / فريق":"Company / Team",desc:isAr?"راقب فريقك كاملاً، HR analytics، وتنبيهات الخطر":"Monitor your entire team, HR analytics, at-risk alerts",color:"#4FAE8E",features:isAr?["داشبورد الفريق","HR Panel","تقارير المؤسسة"]:["Team dashboard","HR Panel","Org reports"]},
                ].map(o=>(
                  <button key={o.id}
                    type="button"
                    onClick={()=>setAcctType(o.id)}
                    style={{
                      width:"100%",textAlign:"left",
                      background:acctType===o.id?`linear-gradient(135deg,${o.color}18,${o.color}08)`:cs.card,
                      border:`2px solid ${acctType===o.id?o.color:o.color+"30"}`,
                      borderRadius:14,padding:"18px 18px",cursor:"pointer",
                      transition:"all .2s",
                      boxShadow:acctType===o.id?`0 0 0 4px ${o.color}18`:"none",
                    }}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                      <div style={{width:46,height:46,borderRadius:11,flexShrink:0,
                        background:acctType===o.id?`${o.color}22`:"rgba(255,255,255,.06)",
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
                              background:acctType===o.id?`${o.color}15`:"rgba(255,255,255,.04)",
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
                {!(profile?.acct_type||profile?.user_type==="employee"||profile?.user_type==="hr_admin")&&<button onClick={()=>{setAcctType(null);setDevicePref(null);}} style={{background:"none",border:"none",color:cs.muted,cursor:"pointer",fontSize:11,marginBottom:12}}>{isAr?"← رجوع":"← Back"}</button>}
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
      {showChangePw&&<ChangePasswordPage darkMode={darkMode} lang={lang} onClose={()=>setShowChangePw(false)}/>}
      {showChurnPrediction&&(isAdmin||isHRAdmin)&&<ChurnPrediction profile={profile} cs={cs} lang={lang} onClose={()=>setShowChurnPrediction(false)}/>}
      {showCustomerSuccess&&(isAdmin||isHRAdmin)&&<CustomerSuccess profile={profile} cs={cs} lang={lang} onClose={()=>setShowCustomerSuccess(false)}/>}
      {showAPIMarketplace&&<ErrorBoundary key="apimarketplace"><Suspense fallback={null}><APIMarketplace profile={profile} cs={cs} lang={lang} onClose={()=>setShowAPIMarketplace(false)}/></Suspense></ErrorBoundary>}
      {showWhiteLabel&&<ErrorBoundary key="whitelabel"><Suspense fallback={null}><WhiteLabel profile={profile} cs={cs} lang={lang} onClose={()=>setShowWhiteLabel(false)}/></Suspense></ErrorBoundary>}
      {showMultiTenant&&<ErrorBoundary key="multitenant"><Suspense fallback={null}><MultiTenantManager profile={profile} cs={cs} lang={lang} onClose={()=>setShowMultiTenant(false)}/></Suspense></ErrorBoundary>}
      {showAuditSystem&&(isAdmin||isHRAdmin)&&<AuditSystem profile={profile} cs={cs} lang={lang} onClose={()=>setShowAuditSystem(false)}/>}
    </ErrorBoundary>);
  }


  // Sidebar & card styles
  // #8 Fix-it tips per cause key
  const FIX_TIPS={
    neck:    {icon:"🔼", steps:["Raise monitor so top edge is at eye level","Tuck chin slightly — imagine a string pulling crown of head up","Check chair height — elbows should be at 90°"], img:"↕️"},
    yaw:     {icon:"↔️", steps:["Center monitor directly in front of you","If using dual screens, put primary screen center","Avoid reading from phone while looking sideways"], img:"↔️"},
    dist:    {icon:"📏", steps:["Arm's length from screen (50–70 cm)","Increase font size so you don't lean in","Use zoom shortcut: Ctrl/⌘ + to reduce urge to lean forward"], img:"📏"},
    posture: {icon:"🪑", steps:["Sit back fully — use lumbar support or rolled towel","Feet flat on floor, knees at 90°","Relax shoulders down and back"], img:"🪑"},
    default: {icon:"✅", steps:["Take a 2-minute stretch break","Roll shoulders backward 5 times","Stand up and walk for 60 seconds"], img:"🚶"},
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

  const abox=tp=>({borderRadius:8,padding:"9px 11px",fontSize:10.5,lineHeight:1.5,border:"0.5px solid",
    background:tp==="warn"?"rgba(214,162,76,.07)":tp==="good"?"rgba(79,174,142,.07)":tp==="bad"?"rgba(198,96,79,.07)":"rgba(99,102,241,.07)",
    borderColor:tp==="warn"?"rgba(214,162,76,.3)":tp==="good"?"rgba(79,174,142,.3)":tp==="bad"?"rgba(198,96,79,.3)":"rgba(99,102,241,.3)",
    color:tp==="warn"?"#fcd34d":tp==="good"?"#6ee7b7":tp==="bad"?"#fca5a5":"#a5b4fc"});

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
      }}/>}</ErrorBoundary>}
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
      }}/>}</ErrorBoundary>}
      {showCalibWizard&&<ErrorBoundary key="calibwizard"><CalibrationWizard uid={profile?.uid} cs={cs} lang={lang} onDone={d=>{
        // Attach the user's current avg score as baseline — drift detection
        // uses this to suggest recalibration when posture improves significantly
        const enriched = { ...d, baseline_avg_score: avgScore || null };
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
      
      {showFeatureFlags&&isAdmin&&<ErrorBoundary key="featureflags"><FeatureFlags profile={profile} cs={cs} lang={lang} onClose={()=>setShowFeatureFlags(false)}/></ErrorBoundary>}
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
      <HomePage
        user={user} profile={profile} cs={cs} lang={lang} isAr={isAr} dir={dir}
        userSessions={userSessions} setUserSessions={setUserSessions}
        allUsers={allUsers} setAllUsers={setAllUsers}
        tier={tier} setTier={setTier} mode={mode} setMode={setMode}
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
              <p style={{margin:0,color:"#a5b4fc",fontSize:13}}>
                {lang==="ar"
                  ? `${qualityFor(profile?.tier).label.ar} · سنوي · وفّر 17٪`
                  : `${qualityFor(profile?.tier).label.en} · Annual · 17% off`}
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
      {showShareCard&&shareCardData&&(
      <ShareCard score={shareCardData.score} grade={shareCardData.grade}
        streak={shareCardData.streak||0} percentile={null}
        lang={lang} cs={cs} addToast={addToast} onClose={()=>setShowShareCard(false)}/>
    )}
    </ErrorBoundary>);
  const TN = T_norm;
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

  return(<ErrorBoundary><>
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
    {showCalibWizard&&<ErrorBoundary key="calibwizard-live"><CalibrationWizard uid={profile?.uid} cs={cs} lang={lang} onDone={d=>{setCalibData(d);setShowCalibWizard(false);addToast("Calibration saved ✓","success");}} onSkip={()=>setShowCalibWizard(false)}/></ErrorBoundary>}
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
      // Video panel was a fixed 320px while the stats/history panel took
      // whatever space remained (unbounded 1fr) — on any reasonably wide
      // screen this meant a small camera next to an increasingly empty
      // Score History graph. Camera feed is the thing users actually look
      // at during a live session, so it should read as the primary element:
      // widened to 460px, and the stats panel capped so it can't sprawl.
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
      fontFamily:"'Inter',system-ui,sans-serif",
    }}>

      {/* ── GlobalModals: render on ALL pages ──────────────────── */}
      

      {/* OLD DUPLICATE MODALS REMOVED — see GlobalModals block above */}
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
                    await updateUserProfile(profile?.uid,{last_nps_at:new Date().toISOString()});
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
            <button onClick={()=>setShowNPS(false)} style={{fontSize:12,color:"#94a3b8",background:"none",border:"none",cursor:"pointer"}}>
              {lang==="ar"?"لاحقاً":"Dismiss"}
            </button>
          </div>
        </div>
      )}
      {showProductTour&&<ErrorBoundary key="producttour"><ProductTour profile={profile} cs={cs} lang={lang} onClose={()=>setShowProductTour(false)}/></ErrorBoundary>}
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
          <div style={{background:"rgba(8,14,28,.98)",border:`2px solid ${sessionResult.color}30`,borderRadius:20,padding:"36px 32px",maxWidth:400,width:"100%",maxHeight:"90dvh",overflowY:"auto",textAlign:"center",boxShadow:"0 24px 80px rgba(0,0,0,.6)"}}>
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
              <div style={{background:"rgba(214,162,76,.07)",border:"1px solid rgba(214,162,76,.2)",borderRadius:10,padding:"10px 14px",marginBottom:20,textAlign:isAr?"right":"left"}}>
                <div style={{fontSize:11,color:"#D6A24C",fontWeight:700,marginBottom:3}}>
                  {isAr?"أبرز مشكلة":"Top issue to fix"}
                </div>
                <div style={{fontSize:13,color:"#f0f6ff",fontWeight:500}}>
                  {sessionResult.top_metric[1]?.label} — score {sessionResult.top_metric[1]?.score}/100
                </div>
              </div>
            )}

            {/* Elite: worst-posture snapshots */}
            {sessionResult.worst_snapshots?.length>0&&(
              <div style={{marginBottom:20,textAlign:isAr?"right":"left"}}>
                <div style={{fontSize:11,color:"#4FAE8E",fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                  📸 {isAr?"أسوأ لحظات الجلسة":"Worst posture moments"}
                  <span style={{fontSize:8,background:"rgba(79,174,142,.12)",border:"1px solid rgba(79,174,142,.25)",borderRadius:99,padding:"1px 6px"}}>ELITE</span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {sessionResult.worst_snapshots.map((s,i)=>(
                    <div key={i} style={{flex:1,position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid rgba(198,96,79,.3)"}}>
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
              <div style={{display:"flex",alignItems:"center",gap:8,background:sessionResult.trend==="improving"?"rgba(79,174,142,.08)":"rgba(198,96,79,.08)",border:`1px solid ${sessionResult.trend==="improving"?"rgba(79,174,142,.25)":"rgba(198,96,79,.25)"}`,borderRadius:10,padding:"9px 14px",marginBottom:12}}>
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
              <div style={{background:"rgba(99,102,241,.07)",border:"1px solid rgba(99,102,241,.2)",borderRadius:10,padding:"10px 14px",marginBottom:12,textAlign:isAr?"right":"left"}}>
                <div style={{fontSize:10,color:"#818cf8",fontWeight:700,marginBottom:3}}>
                  💡 {isAr?"نصيحة للتحسين":"Improvement tip"}
                </div>
                <div style={{fontSize:12,color:"#e0e7ff",lineHeight:1.5}}>{sessionResult.improvement_tip}</div>
              </div>
            )}

            {/* Pain prediction */}
            {sessionResult.pain_summary && (
              <div style={{background:"rgba(214,162,76,.07)",border:"1px solid rgba(214,162,76,.25)",borderRadius:10,padding:"9px 14px",marginBottom:12}}>
                <div style={{fontSize:12,color:"#D6A24C",fontWeight:600}}>{sessionResult.pain_summary}</div>
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
                    if(window.__demoMode){ setPage("demo_dashboard"); return; }
                    // Refresh sessions before going home so Sessions tab is up to date
                    if(user) getUserSessions(user.uid).then(setUserSessions).catch(()=>{});
                    setPage("home");
                  }}
                  style={{flex:1,padding:"10px",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  {isAr?"لوحة التحكم":"Dashboard"}
                </button>
<button onClick={async ()=>{
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
                        score_history: histRef.current||[],
                        metrics: lastAnalRef.current?.metrics||sessionResult.metrics||{},
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
                  style={{flex:1,padding:"10px",background:qualityFor(effectiveTier).pdfDetail==="none"?"rgba(255,255,255,.05)":effectiveTier==="elite"?"rgba(79,174,142,.15)":"rgba(99,102,241,.15)",color:qualityFor(effectiveTier).pdfDetail==="none"?"rgba(255,255,255,.4)":effectiveTier==="elite"?"#6ee7b7":"#a5b4fc",border:`1px solid ${qualityFor(effectiveTier).pdfDetail==="none"?"rgba(255,255,255,.1)":effectiveTier==="elite"?"rgba(79,174,142,.3)":"rgba(99,102,241,.3)"}`,borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  {qualityFor(effectiveTier).pdfDetail==="none" ? `🔒 ${isAr?"تنزيل PDF (Pro+)":"Download PDF (Pro+)"}` : `📄 ${effectiveTier==="elite"?(isAr?"تنزيل PDF Elite":"Download Elite PDF"):(isAr?"تنزيل PDF":"Download PDF")}`}
                </button>
                {/* Share button — Elite only. Was gated on raw `tier`, which
                    doesn't reflect trial_tier elevation or the b2b_enterprise
                    -> elite equivalence, so a trialing/B2B-enterprise user
                    could lose this button entirely even though every other
                    Elite check on this same page correctly uses effectiveTier. */}
                {tierAtLeast(effectiveTier,"elite") && (
                  <button onClick={()=>shareReport({
                      avg_score: sessionResult?.avg_score, good_pct: sessionResult?.good_pct,
                      duration_s: sessionResult?.duration_s, alerts_count: sessionResult?.alerts_count,
                      mode, tier: effectiveTier, session_id: sessionId,
                      score_history: histRef.current||[],
                      metrics: lastAnalRef.current?.metrics||{},
                      ai_tip: lastAnalRef.current?.ai_tip||lastAnalRef.current?.ai_insight||"",
                      improvement_tip: lastAnalRef.current?.improvement_tip||"",
                      created_at: new Date(),
                    })}
                    style={{flex:1,padding:"10px",background:"rgba(99,102,241,.12)",
                      color:"#a5b4fc",border:"1px solid rgba(99,102,241,.3)",
                      borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer"}}>
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
        order: isMobile ? 1 : (isAr ? 1 : 0),
        borderRight: isAr ? "none" : `1px solid ${cs.border}`,
        borderLeft:  isAr ? `1px solid ${cs.border}` : "none",
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
                    ? (isAr?"اعمل معايرة سريعة (30 ثانية) للحصول على درجة دقيقة مخصصة لوضعيتك الطبيعية":"A quick 30-second calibration gets you a score tuned to your natural posture")
                    : (isAr?"Corvus هيحلل وضعيتك لحظياً ويديك درجة ونصائح فورية":"Corvus will analyse your posture live and give you a score + instant tips")}
                </div>
                {userSessions?.length > 0 && (
                  <div style={{marginTop:6,fontSize:10.5,color:cs.muted}}>
                    {isAr?`آخر جلسة: ${userSessions[0]?.avg_score||0}/100`:`Last session: ${userSessions[0]?.avg_score||0}/100`}
                  </div>
                )}
              </div>
              {needsCalib && (
                <button onClick={()=>setShowCalibWizard(true)}
                  style={{fontSize:10.5,fontWeight:700,padding:"6px 11px",
                    background:`${col}1a`,border:`1px solid ${col}55`,
                    borderRadius:8,color:col,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                  {isAr?"معايرة الآن":"Calibrate →"}
                </button>
              )}
            </div>
          );
        })()}

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
                      background:"#0a0f1e",border:`1px solid ${cs.border}`,borderRadius:7,padding:"4px 8px",
                      fontSize:10,fontWeight:700,color:"#fff",whiteSpace:"nowrap",zIndex:20,pointerEvents:"none",
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
                    minHeight:3,
                    height: s ? Math.max(3,Math.round(s*.80)) : 3,
                    background: s ? sc(s) : "rgba(148,163,184,.06)",
                    transition:"height .25s ease",
                    opacity: s ? (hoverBarIdx===i ? 1 : 0.85) : 1,
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

        {/* AI insight */}
        {aiInsight&&(
          <div style={{margin:"0 16px 12px",background:"rgba(79,174,142,.06)",border:"1px solid rgba(79,174,142,.2)",borderRadius:12,padding:"12px 14px",animation:"fadeUp .3s ease"}}>
            <div style={{fontSize:9.5,fontWeight:700,color:"#4FAE8E",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>
              {isAr?"تحليل AI":"AI Analysis"}
            </div>
            <div style={{fontSize:11.5,color:cs.text,lineHeight:1.65}}>{aiInsight}</div>
          </div>
        )}
        {/* Below Elite this card just never appeared with zero explanation —
            looked like a missing feature rather than a tier boundary. One
            small locked hint, same compact style as the tools row below. */}
        {!aiInsight&&camActive&&!tierAtLeast(effectiveTier,"elite")&&(
          <div style={{margin:"0 16px 12px",display:"flex"}}>
            <button onClick={()=>{ addToast(isAr?"🧠 تحليل AI اللحظي متاح لباقة Elite فقط":"🧠 Live AI analysis is an Elite feature","warn"); setShowBilling(true); }}
              style={{background:"rgba(255,255,255,.03)",border:`1px solid ${cs.border}`,borderRadius:7,
                padding:"5px 10px",fontSize:10,fontWeight:600,color:cs.muted,cursor:"pointer",
                display:"flex",alignItems:"center",gap:4}}>
              🔒 🧠 {isAr?"تحليل AI":"AI analysis"}
              <span style={{fontSize:8,color:"#4FAE8E",fontWeight:800}}>ELITE</span>
            </button>
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

        {/* Session Insights — pattern-level observations, distinct from real-time alerts */}
        {sessionInsights.length>0&&(
          <div style={{margin:"0 16px 16px",background:cs.card,border:`1px solid ${cs.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${cs.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:9.5,fontWeight:700,color:cs.muted,textTransform:"uppercase",letterSpacing:".06em"}}>
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
              <div style={{fontSize:9.5,fontWeight:700,color:cs.muted,textTransform:"uppercase",letterSpacing:".06em"}}>
                {isAr?"سجل التنبيهات":"Alert Log"}
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                {alerts.length>0&&<button onClick={()=>setAlerts([])} aria-label={isAr?"مسح كل التنبيهات":"Clear all alerts"} style={{fontSize:9,color:cs.muted,background:"none",border:"none",cursor:"pointer",padding:"6px 8px",minHeight:28}}>✕ {isAr?"مسح":"clear"}</button>}
                <span style={{fontSize:10,fontWeight:700,color:"#C6604F",background:"rgba(198,96,79,.12)",borderRadius:99,padding:"1px 7px"}}>{alerts.length}</span>
              </div>
            </div>
            {alerts.slice(0,3).map((a,i)=>{
              const sev = a.severity==="severe"||a.score<40 ? "severe"
                        : a.severity==="moderate"||a.score<55 ? "moderate" : "mild";
              const sevColor = sev==="severe"?"#C6604F":sev==="moderate"?"#f97316":"#D6A24C";
              const sevIcon  = sev==="severe"?"🔴":sev==="moderate"?"🟠":"🟡";
              const sevLabel = sev==="severe"?(isAr?"حرج":"Critical"):sev==="moderate"?(isAr?"متوسط":"Moderate"):(isAr?"خفيف":"Mild");
              const tips = FIX_TIPS[a.cause]||FIX_TIPS.default;
              const isOpen = fixItOpen===i;
              return (
                <div key={i} style={{borderBottom:i<Math.min(alerts.length,3)-1?`1px solid ${cs.border}`:"none",background:i===0?`${sevColor}06`:"transparent"}}>
                  <div style={{display:"flex",gap:8,padding:"8px 14px",alignItems:"flex-start"}}>
                    <span style={{fontSize:10,flexShrink:0,marginTop:1}}>{sevIcon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{fontSize:11,color:cs.text,lineHeight:1.4,display:"block"}}>{a.msg}</span>
                      <span style={{fontSize:9,color:cs.muted}}>{timeAgo(a.time)}</span>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                      <span style={{fontSize:9,fontWeight:700,color:sevColor,background:`${sevColor}15`,borderRadius:4,padding:"1px 5px"}}>{sevLabel}</span>
                      {/* #8 Fix-it button */}
                      <button onClick={()=>setFixItOpen(isOpen?null:i)} style={{
                        fontSize:9,fontWeight:600,color:"#a5b4fc",background:"rgba(99,102,241,.1)",
                        border:"1px solid rgba(99,102,241,.25)",borderRadius:5,padding:"2px 6px",cursor:"pointer",
                      }}>{isOpen?(isAr?"✕":"✕"):(isAr?"كيف أصلح؟":"Fix it →")}</button>
                    </div>
                  </div>
                  {/* #8 Fix-it expanded card */}
                  {isOpen&&(
                    <div style={{margin:"0 10px 8px",background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.2)",borderRadius:8,padding:"10px 12px"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#a5b4fc",marginBottom:6}}>{tips.icon} {isAr?"الحل:":"How to fix:"}</div>
                      {tips.steps.map((s,si)=>(
                        <div key={si} style={{display:"flex",gap:6,marginBottom:4,alignItems:"flex-start"}}>
                          <span style={{fontSize:10,color:"#a5b4fc",fontWeight:700,flexShrink:0}}>{si+1}.</span>
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
            <div style={{fontSize:9.5,fontWeight:700,color:"#a5b4fc",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>
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
        borderLeft:  isAr ? "none" : `1px solid ${cs.border}`,
        borderRight: isAr ? `1px solid ${cs.border}` : "none",
        display:"flex", flexDirection:"column",
        maxHeight: isMobile ? "auto" : "100vh",
        overflowY:"auto",
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
              <div style={{fontSize:11,fontWeight:700,color:"#93c5fd"}}>
                {isAr?"هل تريد جولة سريعة؟":"Want a quick tour?"}
              </div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>
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
            const vfColor = !camActive ? "rgba(255,255,255,.22)" : badQuality ? "#D6A24C" : (TN?.color || "#38bdf8");
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
          <button onClick={toggleFullscreen}
            title={isFs?(isAr?"إنهاء ملء الشاشة":"Exit fullscreen"):(isAr?"ملء الشاشة":"Fullscreen")}
            aria-label={isFs?(isAr?"إنهاء ملء الشاشة":"Exit fullscreen"):(isAr?"ملء الشاشة":"Fullscreen")} style={{
            position:"absolute",bottom:8,right:8,zIndex:20,
            width:32,height:32,borderRadius:8,
            background:"rgba(2,8,16,.8)",border:"1px solid rgba(255,255,255,.15)",
            backdropFilter:"blur(6px)",color:"#e2e8f0",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,
          }}>{isFs?"🗗":"⛶"}</button>

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
              <div style={{fontSize:12.5,color:"#e2e8f0",marginBottom:12,textAlign:"center",padding:"0 20px"}}>
                {isAr?"اتأكد إنك ظاهر كويس في الكاميرا، وابدأ لما تجهز":"Make sure you're framed well, then start when you're ready"}
              </div>
              <div style={{display:"flex",gap:10}}>
                <LiveBtn size="lg" variant="ghost" cs={{muted:"#fff",border:"rgba(255,255,255,.2)"}} onClick={cancelPreview}>
                  {isAr?"إلغاء":"Cancel"}
                </LiveBtn>
                <LiveBtn size="lg" variant="primary" icon="play" cs={{blue:"#1a56db"}} onClick={confirmStartSession}
                  style={{boxShadow:"0 8px 24px rgba(26,86,219,.4)"}}>
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
              <div style={{fontSize:13.5,fontWeight:700,color:"#fff"}}>
                {isAr?"الجلسة متوقفة مؤقتاً":"Session paused"}
              </div>
              <LiveBtn size="lg" variant="primary" icon="play" cs={{blue:"#1a56db"}} onClick={resumeSession}
                style={{boxShadow:"0 8px 24px rgba(26,86,219,.4)"}}>
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
              <GuidanceHint icon="camera"
                title={isAr?"اضغط \"ابدأ التحليل\" أدناه للبدء":"Tap \"Start Analysis\" below to begin"}
                cs={cs}/>
              <div style={{fontSize:16,color:"rgba(255,255,255,.5)",animation:"bounceDown 1.4s infinite"}}>
                <Icon name="chevronDown" size={16} color="rgba(255,255,255,.6)"/>
              </div>
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
              it's visible the entire time the camera is on, and reflects
              qualityScore so it can never show a number that disagrees with
              a "too close/far" warning — it just goes into the warning
              state itself instead of freezing on a stale reading. */}
          {camActive && M_ && (
            <div style={{position:"absolute",top:38,left:isAr?"auto":8,right:isAr?8:"auto",zIndex:11}}>
              {(()=>{
                const badQuality = analysis?.qualityScore != null && analysis.qualityScore < 100;
                const inRange = !badQuality && distCm!=null && distCm>=M_.optDist[0] && distCm<=M_.optDist[1];
                const col = badQuality ? "#D6A24C" : inRange ? "#4FAE8E" : "#8A93A3";
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
                  </div>
                );
              })()}
            </div>
          )}

          {/* Score overlay */}
        {/* Professional live metrics panel */}
        {analysis && score > 0 && (
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
                background:`conic-gradient(${score>=75?"#4FAE8E":score>=55?"#D6A24C":"#C6604F"} ${score*3.6}deg, rgba(255,255,255,.06) 0deg)`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:11,fontWeight:900,color:"#f0f6ff",flexShrink:0,
              }}>{score}</div>
              <div>
                <div style={{fontSize:9,color:"#94a3b8",fontWeight:600,letterSpacing:.5}}>
                  {isAr?"الدرجة الكلية":"ERGONOMIC SCORE"}
                </div>
                <div style={{fontSize:11,fontWeight:700,
                  color:score>=75?"#4FAE8E":score>=55?"#D6A24C":"#C6604F"}}>
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
                score:    analysis?.metrics?.spine_lean?.score,
                value:    analysis?.metrics?.spine_lean?.value,
                unit:     "°",
              },
              {
                label:    isAr?"الأكتاف":"Rounding",
                score:    analysis?.metrics?.rounded_shoulders?.score,
                value:    analysis?.metrics?.rounded_shoulders?.value,
                unit:     "",
              },
              // Distance intentionally omitted here — it has its own dedicated
              // persistent chip pinned on the video (see above) plus the
              // detailed bar further down the page.
            ].map(({label,score:s,value,unit},i)=>{
              const col = s==null?"#475569":s>=80?"#4FAE8E":s>=60?"#D6A24C":"#C6604F";
              const risk= s==null?(isAr?"—":"—"):s>=80?(isAr?"منخفض":"Low"):s>=60?(isAr?"متوسط":"Med"):(isAr?"مرتفع":"High");
              return (
                <div key={i} style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",marginBottom:5}}>
                  <div style={{fontSize:10,color:"#94a3b8",width:60}}>{label}</div>
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

            {/* Session baseline comparison — "better/worse than your first sessions" */}
            {(()=>{
              const sess = userSessions;
              if(sess.length < 4) return null;
              const firstAvg = Math.round(sess.slice(0,3).reduce((a,s)=>a+(s.avg_score||0),0)/3);
              const lastAvg  = Math.round(sess.slice(-3).reduce((a,s)=>a+(s.avg_score||0),0)/3);
              const diff = lastAvg - firstAvg;
              if(Math.abs(diff) < 2) return null; // noise threshold
              const up = diff > 0;
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
            const cue=postureCue(analysis,isAr);
            if(!cue) return null;
            return (
              <div style={{position:"absolute",left:8,right:46,bottom:8,
                background:"rgba(2,8,16,.9)",backdropFilter:"blur(6px)",
                border:`1.5px solid ${cue.col}`,borderRadius:12,
                padding:"10px 12px",display:"flex",alignItems:"center",gap:10,
                boxShadow:`0 4px 18px ${cue.col}55`,animation:"fadeUp .3s ease"}}>
                <span style={{fontSize:24,color:cue.col,fontWeight:900,lineHeight:1,flexShrink:0}}>{cue.icon}</span>
                <span style={{fontSize:13.5,fontWeight:800,color:"#fff",lineHeight:1.3}}>{cue.text}</span>
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
              <button onClick={isPaused?resumeSession:pauseSession} style={{
                minWidth:140,
                background: isPaused ? "linear-gradient(135deg,rgba(79,174,142,.25),rgba(5,150,105,.18))" : "rgba(2,8,16,.72)",
                backdropFilter:"blur(8px)",
                color: isPaused ? "#6ee7b7" : "#fff",
                border:`1px solid ${isPaused?"rgba(79,174,142,.5)":"rgba(255,255,255,.18)"}`,borderRadius:10,
                padding:"12px 18px",fontSize:13,fontWeight:700,cursor:"pointer",
              }}>
                {isPaused ? (isAr?"▶ استكمال":"▶ Resume") : (isAr?"⏸ وقف مؤقت":"⏸ Pause")}
              </button>
              <button onClick={stopCamera} disabled={isSavingSession} style={{
                minWidth:140,
                background: isSavingSession ? "rgba(2,8,16,.5)" : "rgba(198,96,79,.28)",
                backdropFilter:"blur(8px)",
                color: isSavingSession ? "#94a3b8" : "#fca5a5",
                border:`1px solid ${isSavingSession?"rgba(255,255,255,.1)":"rgba(198,96,79,.55)"}`,borderRadius:10,
                padding:"12px 18px",fontSize:13,fontWeight:700,
                cursor: isSavingSession ? "not-allowed" : "pointer",
              }}>
                {isSavingSession ? (isAr?"⏳ جاري الحفظ…":"⏳ Saving…") : (isAr?"⏹ إيقاف وحفظ":"⏹ Stop & Save")}
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
            ? <button
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
                  borderRadius:12, padding:"14px 0",
                  fontSize:14, fontWeight:800,
                  color: cameraStatus==="no-device"||cameraStatus==="denied" ? "#fca5a5"
                    : cameraStatus==="requesting" ? cs.muted : "#fff",
                  cursor: cameraStatus==="requesting" ? "not-allowed" : "pointer",
                  boxShadow: cameraStatus==="requesting"||cameraStatus==="no-device"||cameraStatus==="denied"
                    ? "none" : `0 4px 20px ${TN?.color||"#1a56db"}50`,
                  letterSpacing:"-.01em",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                }}>
                {cameraStatus==="requesting"
                  ? <><span style={{animation:"spin 700ms linear infinite",display:"inline-block"}}>⟳</span> {isAr?"جاري الفتح...":"Opening camera..."}</>
                  : cameraStatus==="denied"
                  ? (isAr?"🔄 حاول تاني — لو سمحت للكاميرا":"🔄 Retry — if you've allowed the camera")
                  : cameraStatus==="no-device"
                  ? (isAr?"🔄 حاول تاني — لو وصّلت كاميرا":"🔄 Retry — if you've connected one")
                  : (isAr?"▶ ابدأ التحليل":"▶ Start Analysis")}
              </button>
            : <div style={{display:"flex",gap:8}}>
                <button onClick={isPaused?resumeSession:pauseSession} style={{
                  flex:1,
                  background: isPaused ? "linear-gradient(135deg,rgba(79,174,142,.18),rgba(5,150,105,.12))" : "rgba(148,163,184,.08)",
                  color: isPaused ? "#6ee7b7" : cs.text,
                  border:`1px solid ${isPaused?"rgba(79,174,142,.4)":cs.border}`,borderRadius:10,
                  padding:"13px 0",fontSize:13,fontWeight:700,cursor:"pointer",
                }}>
                  {isPaused ? (isAr?"▶ استكمال":"▶ Resume") : (isAr?"⏸ وقف مؤقت":"⏸ Pause")}
                </button>
                <button onClick={stopCamera} disabled={isSavingSession} style={{
                  flex:1,
                  background: isSavingSession
                    ? "rgba(255,255,255,.05)"
                    : "linear-gradient(135deg,rgba(198,96,79,.18),rgba(220,38,38,.12))",
                  color: isSavingSession ? "#94a3b8" : "#fca5a5",
                  border:`1px solid ${isSavingSession?"rgba(255,255,255,.08)":"rgba(198,96,79,.5)"}`,borderRadius:10,
                  padding:"13px 0",fontSize:13,fontWeight:700,
                  cursor: isSavingSession ? "not-allowed" : "pointer",
                  boxShadow: isSavingSession ? "none" : "0 2px 12px rgba(198,96,79,.2)",
                  letterSpacing:"-.01em",transition:"all .2s",
                }}>
                  {isSavingSession
                    ? (isAr ? "⏳ جاري الحفظ…" : "⏳ Saving…")
                    : (isAr ? "⏹ إيقاف وحفظ" : "⏹ Stop & Save")}
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
            <ScoreGauge cs={cs} score={scoreStatus?.score||score} grade={scoreStatus?.grade}/>
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
              <div style={{height:3,borderRadius:99,background:"rgba(255,255,255,.08)"}}>
                <div style={{height:"100%",borderRadius:99,width:`${pct}%`,
                  background:col,transition:"width .5s ease"}}/>
              </div>
              <div style={{fontSize:8.5,color:cs.muted,marginTop:3}}>
                {isAr?`الثقة: ${conf} — تقدير توعوي، ليس تشخيصاً طبياً`
                     :`Confidence: ${conf} — awareness estimate, not a medical diagnosis`}
              </div>
            </div>
          );
        })()}

        {/* Live metrics */}
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${cs.border}`}}>
          <div style={{fontSize:9.5,fontWeight:600,color:cs.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>
            {isAr?"القياسات المباشرة":"Live Metrics"}
          </div>
          {analysis?.metrics
            ? (() => {
                const HIDE = new Set(["session_fatigue","confidence_val"]);
                const mEntries = Object.entries(analysis.metrics).filter(([k,m])=>
                  !HIDE.has(k) && m.value!=null && m.label
                );
                // Sort by score ascending (worst first), cap at 3 by default
                const sorted = [...mEntries].sort((a,b)=>(a[1].score??100)-(b[1].score??100));
                const showAll = showAllMetrics;
                const visible = showAll ? sorted : sorted.slice(0,3);
                return (
                  <>
                    {visible.map(([k,m])=>(
                      <MetRow key={k} label={m.label} value={m.value} unit={m.unit} score={m.score} cs={cs}
                        dim={m.reliable===false}
                      />
                    ))}
                    {sorted.length > 3 && (
                      <button onClick={()=>setShowAllMetrics(v=>!v)}
                        style={{width:"100%",background:"none",border:`1px solid ${cs.border}`,borderRadius:8,
                          padding:"5px 0",fontSize:10,color:cs.muted,cursor:"pointer",marginTop:4}}>
                        {showAllMetrics?(isAr?"إخفاء ▲":"Hide ▲"):(isAr?`+ ${sorted.length-3} مقياس ▼`:`+ ${sorted.length-3} more ▼`)}
                      </button>
                    )}
                    {/* ── Detected conditions with severity badges ── */}
                    {analysis.detectedConditions?.length > 0 && (
                      <div style={{marginTop:10,marginBottom:4}}>
                        <div style={{fontSize:9,fontWeight:700,color:cs.muted,textTransform:"uppercase",
                          letterSpacing:".07em",marginBottom:6}}>
                          {isAr?"الحالات المرصودة":"Detected Conditions"}
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          {analysis.detectedConditions.map((cond,i)=>{
                            const sevColor = cond.severity==="severe"?"#C6604F"
                              :cond.severity==="moderate"?"#f97316"
                              :cond.severity==="mild"?"#D6A24C":"#4FAE8E";
                            const sevLabel = cond.severity==="severe"
                              ?(isAr?"شديد":"Severe")
                              :cond.severity==="moderate"
                              ?(isAr?"متوسط":"Moderate")
                              :cond.severity==="mild"
                              ?(isAr?"خفيف":"Mild")
                              :(isAr?"طبيعي":"Normal");
                            return(
                              <div key={i} style={{display:"flex",alignItems:"center",
                                justifyContent:"space-between",gap:6,
                                padding:"4px 8px",borderRadius:7,
                                background:`${sevColor}10`,
                                border:`1px solid ${sevColor}25`,
                              }}>
                                <span style={{fontSize:10.5,color:cs.text,fontWeight:500}}>
                                  {cond.name}
                                </span>
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <span style={{fontSize:9.5,color:cs.muted}}>{cond.value}</span>
                                  <span style={{fontSize:9,fontWeight:700,color:sevColor,
                                    padding:"1px 6px",borderRadius:99,
                                    background:`${sevColor}20`,
                                    textTransform:"uppercase",letterSpacing:".04em",
                                  }}>{sevLabel}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Quality score indicator ── */}
                    {analysis.qualityScore != null && analysis.qualityScore < 100 && (
                      <div style={{fontSize:9.5,padding:"3px 8px",borderRadius:99,
                        background:"rgba(198,96,79,.1)",color:"#f87171",
                        fontWeight:600,marginBottom:4,display:"inline-flex",alignItems:"center",gap:4}}>
                        ⚠️ {analysis.qualityReason === "body_cropped"
                          ? (isAr?"الجسم مقطوع":"Body partially visible")
                          : analysis.qualityReason === "too_close"
                          ? (isAr?"قريب جداً":"Too close to camera")
                          : analysis.qualityReason === "too_far"
                          ? (isAr?"بعيد جداً":"Too far from camera")
                          : (isAr?"جودة منخفضة":"Low quality frame")}
                      </div>
                    )}

                    {/* Confidence + fatigue compact row */}
                    <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                      {analysis.confidence!=null&&(
                        <span style={{fontSize:9.5,padding:"2px 8px",borderRadius:99,
                          background:`rgba(${analysis.confidence>85?"79,174,142":analysis.confidence>70?"214,162,76":"198,96,79"},.12)`,
                          color:analysis.confidence>85?"#4FAE8E":analysis.confidence>70?"#D6A24C":"#C6604F",
                          fontWeight:600}}>
                          📡 {analysis.confidence}% {isAr?"دقة الرصد":"detection"}
                        </span>
                      )}
                      {analysis.metrics?.session_fatigue?.value>0&&(
                        <span style={{fontSize:9.5,padding:"2px 8px",borderRadius:99,
                          background:"rgba(139,92,246,.12)",color:"#8b5cf6",fontWeight:600}}>
                          🕐 {isAr?`تعب −${analysis.metrics.session_fatigue.value}pt`:`Fatigue −${analysis.metrics.session_fatigue.value}pt`}
                        </span>
                      )}
                      {analysis.metrics?.monitor_height?.value>5&&(
                        <span style={{fontSize:9.5,padding:"2px 8px",borderRadius:99,
                          background:"rgba(214,162,76,.12)",color:"#D6A24C",fontWeight:600}}>
                          🖥 {isAr
                            ?(analysis.metrics.monitor_height.direction==="below"?`الشاشة أسفل ${analysis.metrics.monitor_height.value}سم`:`الشاشة أعلى ${analysis.metrics.monitor_height.value}سم`)
                            :(analysis.metrics.monitor_height.direction==="below"?`Monitor ${analysis.metrics.monitor_height.value}cm low`:`Monitor ${analysis.metrics.monitor_height.value}cm high`)
                          }
                        </span>
                      )}
                    </div>
                  </>
                );
              })()
            : (
              <div>
                <div style={{display:"flex",flexDirection:"column",gap:8,padding:"4px 0 8px"}}>
                  {["Neck lean","Head tilt","Shoulder level","Spine lean"].map((m,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:cs.muted,flex:1}}>{isAr?["انحناء الرقبة","إمالة الرأس","مستوى الكتفين","انحناء العمود"][i]:m}</span>
                      <div style={{width:80,height:3,borderRadius:99,
                        background:`rgba(255,255,255,${.03+i*.01})`,overflow:"hidden"}}>
                        <div style={{height:"100%",width: camActive?"40%":"0%",background:"rgba(148,163,184,.15)",
                          animation: camActive?"livePulse 1.4s ease-in-out infinite":"none"}}/>
                      </div>
                      <span style={{fontSize:10,color:"rgba(255,255,255,.15)",minWidth:16,textAlign:"right"}}>—</span>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:camActive?"#D6A24C":cs.muted,textAlign:"center",padding:"2px 0",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  {camActive && (
                    <span style={{width:6,height:6,borderRadius:"50%",background:"#D6A24C",animation:"livePulse 1.2s infinite",flexShrink:0}}/>
                  )}
                  {camActive
                    ? (mpStatus!=="ready"
                        ? (isAr?"جاري تحميل نموذج الذكاء الاصطناعي (أول مرة بس)...":"Loading the AI model (first time only)...")
                        : sessionTime>8
                        ? (isAr?"لسه مش شايفينك — قرّب من الكاميرا وخلي الإضاءة كويسة":"Still not detecting you — move closer and check your lighting")
                        : (isAr?"بنحلل وضعيتك... استنى ثانية":"Detecting your posture... one moment"))
                    : (isAr?"ابدأ الكاميرا للتحليل":"Start camera to see metrics")}
                </div>
                <div style={{background:"rgba(79,174,142,.05)",border:"1px solid rgba(79,174,142,.12)",borderRadius:10,padding:"10px 12px",
                  display: camActive ? "none" : "block" /* #13: hide tips during active session */}}>
                  <div style={{fontSize:9.5,fontWeight:700,color:"#4FAE8E",marginBottom:8,textTransform:"uppercase",letterSpacing:".05em"}}>
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
              <span style={{fontSize:12,fontWeight:700,color:distCm>=M_.optDist[0]&&distCm<=M_.optDist[1]?"#4FAE8E":distCm>=(M_.optDist[0]-15)?"#D6A24C":"#C6604F"}}>
                {Math.round(distCm)}cm
              </span>
            </div>
            <div style={{position:"relative",height:8,background:"rgba(148,163,184,.08)",borderRadius:99,overflow:"hidden"}}>
              <div style={{position:"absolute",left:"28%",top:0,bottom:0,width:"44%",background:"rgba(79,174,142,.15)",borderRadius:99}}/>
              <div style={{
                position:"absolute",top:1,bottom:1,
                left:`${clamp((distCm-20)/(115-20)*100,2,96)}%`,
                width:6,borderRadius:99,
                background:distCm>=M_.optDist[0]&&distCm<=M_.optDist[1]?"#4FAE8E":distCm>=(M_.optDist[0]-15)?"#D6A24C":"#C6604F",
                transition:"left .4s ease",
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
            display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#D6A24C",fontWeight:600}}>
            💡 {isAr?"الإضاءة ضعيفة — حسّن الإضاءة لقراءات أدق":"Low lighting — improve lighting for more accurate readings"}
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
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:"#4FAE8E",flexShrink:0,boxShadow:"0 0 6px #4FAE8E"}}/>
              <span style={{fontSize:11,color:"#6ee7b7",fontWeight:600}}>
                {isAr?`النتيجة ${scoreStatus?.score}/100 — ${scoreStatus?.grade}`:`Score ${scoreStatus?.score}/100 — ${scoreStatus?.grade}`}
                {camActive&&calibData?.tolerances&&(
                  <span style={{color:"#34d399",fontWeight:500}}> · {isAr?"مُخصّص":"Personalised"}</span>
                )}
              </span>
            </div>
            <div style={{fontSize:10,color:cs.muted,marginTop:3,paddingLeft:16,lineHeight:1.4}}>
              {gradeContext(scoreStatus?.score, isAr)}
            </div>
          </div>
        )}

        {!(scoreStatus&&alertMsg.type!=="warn"&&alertMsg.type!=="bad")&&camActive&&calibData?.tolerances&&(
          <div style={{padding:"7px 14px",borderBottom:`1px solid ${cs.border}`,display:"flex",alignItems:"center",gap:8,background:"rgba(79,174,142,.05)"}}>
            <span style={{fontSize:11,color:"#34d399",fontWeight:700}}>✓</span>
            <span style={{fontSize:11,color:"#34d399",fontWeight:600}}>
              {isAr?"التحليل مُخصّص لوضعيتك الطبيعية":"Analysis personalised to your natural posture"}
            </span>
          </div>
        )}

        {/* Alert message — warn/bad/info only */}
        {(alertMsg.type==="warn"||alertMsg.type==="bad"||(alertMsg.type==="info"&&!scoreStatus))&&(
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${cs.border}`}}>
          <div style={abox(alertMsg.type)}>{alertMsg.text}</div>
        </div>
        )}

        {/* Secondary controls (primary Start/Stop moved up under the camera) */}
        {/* Collapsed by default — see showLiveSettings declaration. One row
            to open everything below, instead of 7 rows shown unconditionally
            the moment the page loads. */}
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${cs.border}`}}>
          <button onClick={()=>setShowLiveSettings(v=>!v)} style={{
            width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
            background:cs.inp||"rgba(255,255,255,.03)",border:`1px solid ${cs.inpB||cs.border}`,borderRadius:LT.radius.sm,
            padding:"10px 14px",fontSize:12.5,fontWeight:700,color:cs.text,cursor:"pointer",
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
            <SettingsRow cs={cs} icon={sound?"bell":"bellOff"} label={isAr?"تنبيه الوضعية":"Posture alerts"}
              right={<Switch cs={cs} on={sound} onChange={()=>setSound(s=>!s)} label={isAr?"تنبيه الوضعية":"Posture alerts"}/>}/>
            {tierAtLeast(effectiveTier,"professional") && (
              <SettingsRow cs={cs} icon="target" label={isAr?"وضع التركيز":"Focus Mode"}
                sub={isAr?"يوقف إشعارات الإنجازات وقت الجلسة":"Mutes achievement notifications during the session"}
                right={<Switch cs={cs} tone="purple" on={focusMode} onChange={()=>setFocusMode(f=>!f)} label={isAr?"وضع التركيز":"Focus Mode"}/>}/>
            )}
            {tierAtLeast(effectiveTier,"elite") && (
              <SettingsRow cs={cs} icon="mic" label={isAr?"المدرب الصوتي":"Voice coach"}
                right={<Switch cs={cs} tone="green" on={voiceCoach} label={isAr?"المدرب الصوتي":"Voice coach"} onChange={()=>{
                  setVoiceCoach(v=>{
                    const nv=!v;
                    try{localStorage.setItem("corvus_voice_coach",nv?"1":"0");}catch{}
                    if(nv) speakCoach(isAr?"المدرب الصوتي شغّال. هساعدك تحافظ على وضعية سليمة.":"Voice coach is on. I'll help you keep a healthy posture.", isAr?"ar":"en",{force:true});
                    else stopSpeaking();
                    return nv;
                  });
                }}/>}/>
            )}
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
                  try {
                    const { generateSessionPDF } = await import("./lib/pdfReports.js");
                    await generateSessionPDF({
                      session:{
                        avg_score:sc, duration_s:dur, good_pct:gp,
                        alerts_count:acRef.current?.total||0, mode, tier:effectiveTier,
                        score_history:hist.slice(-60), created_at:new Date(),
                        metrics:lastAnalRef.current?.metrics||{},
                        worst_snapshots:worstSnapsRef.current.slice(0,3),
                      },
                      profile: { ...profile, tier: effectiveTier },
                      allSessions: userSessions,
                      aiSummary: lastAnalRef.current?.ai_tip||lastAnalRef.current?.ai_insight||"",
                    });
                  } catch(e){ addToast("PDF: "+(e?.message||"error"),"error"); }
                }}
                right={<Icon name="chevronDown" size={13} color={cs.muted} style={{transform:isAr?"rotate(90deg)":"rotate(-90deg)"}}/>}/>
            )}
          </div>
          {/* Calibrate for accuracy — personalises scoring to the user's own
              neutral posture; reachable straight from the live session. Kept
              visually distinct (green, not a toggle) since it's a one-time
              setup action, not an on/off switch like everything above it. */}
          <button onClick={()=>setShowCalibWizard(true)} style={{
            background:calibData?"rgba(148,163,184,.06)":"rgba(79,174,142,.1)",
            border:`1px solid ${calibData?cs.border:"rgba(79,174,142,.4)"}`,borderRadius:10,
            padding:"9px 0",fontSize:12,fontWeight:700,color:calibData?cs.muted:"#34d399",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,
          }}>
            <Icon name="target" size={14} color={calibData?cs.muted:"#34d399"}/>
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
            <button onClick={()=>setMuted(v=>!v)}
              title={muted?(isAr?"صوت تذكير الاستراحة: متوقف":"Break-reminder chime: OFF"):(isAr?"صوت تذكير الاستراحة: شغّال":"Break-reminder chime: ON")}
              aria-label={muted?(isAr?"صوت تذكير الاستراحة: متوقف":"Break-reminder chime: off"):(isAr?"صوت تذكير الاستراحة: شغّال":"Break-reminder chime: on")}
              aria-pressed={!muted}
              style={{
                flexShrink:0,width:38,height:36,borderRadius:9,cursor:"pointer",
                background:"rgba(148,163,184,.06)",color:muted?cs.muted:"#4FAE8E",
                border:`1px solid ${muted?cs.border:"rgba(79,174,142,.25)"}`,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
              <Icon name={muted?"bellOff":"bell"} size={15}/>
            </button>
            <div style={{
              flex:1,display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,
              background:"rgba(148,163,184,.06)",border:`1px solid ${cs.border}`,borderRadius:9,
              padding:"0 6px 0 12px",height:36,
            }}>
              <span style={{fontSize:11,color:cs.muted,whiteSpace:"nowrap"}}>{isAr?"استراحة كل":"Break every"}</span>
              <select value={breakIntervalMin} onChange={e=>setBreakIntervalMin(Number(e.target.value))}
                style={{
                  background:"transparent",border:"none",color:cs.text,fontSize:12,fontWeight:700,
                  cursor:"pointer",outline:"none",textAlign:isAr?"left":"right",
                }}>
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
                <button onClick={()=>{
                  addToast(isAr?"⚙️ قواعد التنبيه المخصصة متاحة لباقة Pro فأعلى":"⚙️ Custom Alert Rules is a Pro feature","warn");
                  setShowBilling(true);
                }} style={{
                  background:"rgba(255,255,255,.03)",border:`1px solid ${cs.border}`,borderRadius:7,
                  padding:"5px 10px",fontSize:10,fontWeight:600,color:cs.muted,cursor:"pointer",
                  display:"flex",alignItems:"center",gap:4,
                }}>
                  🔒 ⚙️ {isAr?"قواعد تنبيه":"Alert rules"}
                  <span style={{fontSize:8,color:"#a78bfa",fontWeight:800}}>PRO</span>
                </button>
              )}
              {!tierAtLeast(effectiveTier,"elite")&&(
                <button onClick={()=>{
                  addToast(isAr?"🎙️ المدرب الصوتي متاح لباقة Elite فقط":"🎙️ Voice coach is an Elite feature","warn");
                  setShowBilling(true);
                }} style={{
                  background:"rgba(255,255,255,.03)",border:`1px solid ${cs.border}`,borderRadius:7,
                  padding:"5px 10px",fontSize:10,fontWeight:600,color:cs.muted,cursor:"pointer",
                  display:"flex",alignItems:"center",gap:4,
                }}>
                  🔒 🎙️ {isAr?"مدرب صوتي":"Voice coach"}
                  <span style={{fontSize:8,color:"#4FAE8E",fontWeight:800}}>ELITE</span>
                </button>
              )}
              {histRef.current?.length>0&&qualityFor(effectiveTier).pdfDetail==="none"&&(
                <button onClick={()=>{
                  addToast(isAr?"تصدير PDF متاح من خطة Professional فأعلى":"PDF export requires Professional plan or higher","warn");
                  setShowUpgrade?.(true); setUpgradeReason?.(isAr?"تصدير PDF":"PDF export");
                }} style={{
                  background:"rgba(255,255,255,.03)",border:`1px solid ${cs.border}`,borderRadius:7,
                  padding:"5px 10px",fontSize:10,fontWeight:600,color:cs.muted,cursor:"pointer",
                  display:"flex",alignItems:"center",gap:4,
                }}>
                  🔒 📄 {isAr?"تقرير PDF":"PDF report"}
                  <span style={{fontSize:8,color:"#93c5fd",fontWeight:800}}>PRO</span>
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
            border:"1px solid rgba(99,102,241,.3)",borderRadius:9,padding:"10px 12px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#818cf8",marginBottom:4}}>
              🎯 {isAr?"وضعيتك تحسّنت كثيراً!":"Your posture improved significantly!"}
            </div>
            <div style={{fontSize:10.5,color:cs.muted,lineHeight:1.5,marginBottom:8}}>
              {isAr
                ? `تحسّنت ${calibDrift.pts} نقطة منذ آخر معايرة (${calibDrift.sessions} جلسة). إعادة المعايرة الآن ستضبط الحدود بدقة أعلى.`
                : `You've improved ${calibDrift.pts}pts since calibrating (${calibDrift.sessions} sessions). Recalibrating now gives you tighter, more precise thresholds.`}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setShowCalibWizard(true)}
                style={{flex:1,fontSize:10.5,fontWeight:700,padding:"5px 0",
                  background:"rgba(99,102,241,.15)",border:"1px solid rgba(99,102,241,.4)",
                  borderRadius:7,color:"#818cf8",cursor:"pointer"}}>
                {isAr?"إعادة المعايرة":"Recalibrate"}
              </button>
              <button onClick={()=>setCalibDrift(null)}
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
            border:"1px solid rgba(214,162,76,.3)",borderRadius:9,padding:"9px 12px",
            display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:15,flexShrink:0}}>📐</span>
            <div style={{flex:1}}>
              <div style={{fontSize:10.5,fontWeight:700,color:"#D6A24C",marginBottom:2}}>
                {isAr?"الدقة تتحسن مع المعايرة":"Accuracy improves with calibration"}
              </div>
              <div style={{fontSize:10,color:cs.muted,lineHeight:1.4}}>
                {isAr?"كتفك الفعلي مختلف عن المتوسط — معايرة سريعة تصلح ذلك":"Your build differs from average — a quick calibration fixes this"}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
              <button onClick={()=>{setCalibNudge(false);setShowCalibWizard(true);}}
                style={{fontSize:10,fontWeight:700,padding:"4px 8px",
                  background:"rgba(214,162,76,.15)",border:"1px solid rgba(214,162,76,.4)",
                  borderRadius:6,color:"#D6A24C",cursor:"pointer",whiteSpace:"nowrap"}}>
                {isAr?"معايرة":"Calibrate"}
              </button>
              <button onClick={()=>setCalibNudge(false)}
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
            <button type="button" style={{margin:"10px 14px 0",width:"calc(100% - 28px)",display:"block",fontFamily:"inherit",background:"rgba(214,162,76,.07)",border:"1px solid rgba(214,162,76,.3)",borderRadius:9,padding:"7px 10px",textAlign:"center",fontSize:11,color:"#D6A24C",fontWeight:500,cursor:"pointer"}}
              onClick={()=>setShowCalibWizard(true)}
              title={isAr?"المعايرة أقدم من 30 يوم — يُنصح بإعادتها":"Calibration is over 30 days old — recalibrate for best accuracy"}>
              ⚠️ {isAr?"المعايرة قديمة — أعد المعايرة":"Calibration outdated — recalibrate"}
            </button>
          ) : (
            <div style={{margin:"10px 14px 0",background:"rgba(79,174,142,.07)",border:"1px solid rgba(79,174,142,.2)",borderRadius:9,padding:"7px 10px",textAlign:"center",fontSize:11,color:"#4FAE8E",fontWeight:500}}>
              ✓ {isAr?"المعايرة الشخصية نشطة":"Personal calibration active"}
            </div>
          )
        )}

        {/* Company setup nudge — only for accounts that signed up as a
            company/HR account and haven't finished linking to their org yet,
            not individual paying customers on Pro/Elite */}
        {profile&&profile.acct_type==="company"&&profile.user_type!=="employee"&&!profile.company_id&&(
          <div style={{margin:"10px 14px",background:"rgba(79,174,142,.05)",border:"1px solid rgba(79,174,142,.15)",borderRadius:9,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <span style={{fontSize:11,color:cs.muted}}>🏢 {isAr?"إعداد مساحة الشركة":"Set up company workspace"}</span>
            <button onClick={()=>setShowCompanyOnboard(true)}
              style={{background:"#4FAE8E",border:"none",borderRadius:7,padding:"4px 10px",fontSize:10,fontWeight:700,color:"#fff",cursor:"pointer",flexShrink:0}}>
              {isAr?"ابدأ":"Start"}
            </button>
          </div>
        )}

        {/* #10 Streak protection alert */}
        {streakAlert&&(
          <div style={{margin:"10px 14px",background:"rgba(214,162,76,.08)",border:"1px solid rgba(214,162,76,.35)",borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#fcd34d",marginBottom:4}}>
              ⚡ {isAr?`الـ ${profile?.streak_days}-day streak بتاعتك في خطر!`:`Your ${profile?.streak_days}-day streak is at risk!`}
            </div>
            <div style={{fontSize:11,color:cs.muted,marginBottom:10}}>
              {isAr?"وضعيتك وحشة أكتر من دقيقتين. خذ استراحة صغيرة؟":"Poor posture for 2+ min. Take a quick break to protect it?"}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>{setStreakAlert(false);goToBreak();}} style={{
                flex:1,background:"rgba(214,162,76,.15)",border:"1px solid rgba(214,162,76,.35)",
                borderRadius:8,padding:"7px 0",fontSize:11,fontWeight:700,color:"#fcd34d",cursor:"pointer"}}>
                {isAr?"استراحة الآن 🧘":"Break now 🧘"}
              </button>
              <button onClick={()=>setStreakAlert(false)} style={{
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
            <div style={{fontSize:12,fontWeight:700,color:"#a5b4fc",marginBottom:4}}>
              🔔 {isAr?"تفعيل التنبيهات؟":"Enable background alerts?"}
            </div>
            <div style={{fontSize:10,color:cs.muted,marginBottom:10,lineHeight:1.5}}>
              {isAr?"نبعتلك تنبيه لو وضعيتك وحشت وانت مش شايف الشاشة — مفيش spam.":"Get notified when posture drops even when the tab is in the background. No spam."}
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>{Notification.requestPermission().catch(()=>{});setShowNotifCard(false);}} style={{
                flex:1,background:"rgba(99,102,241,.15)",border:"1px solid rgba(99,102,241,.35)",
                borderRadius:8,padding:"6px 0",fontSize:11,fontWeight:700,color:"#a5b4fc",cursor:"pointer"}}>
                {isAr?"السماح ✓":"Allow ✓"}
              </button>
              <button onClick={()=>setShowNotifCard(false)} style={{
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
            <div style={{fontSize:14,fontWeight:700,color:"#fcd34d",marginBottom:4}}>⏰ {isAr?"وقت استراحة!":"Break time!"}</div>
            <div style={{fontSize:11,color:cs.muted,marginBottom:10}}>
              {isAr?`${breakIntervalMin} دقيقة مرت — استرح دقيقتين`:`${breakIntervalMin} min passed — take a 2-min stretch`}
            </div>
            <div style={{display:"flex",gap:6,justifyContent:"center"}}>
              <button onClick={()=>{dismissBreak();goToBreak();}}
                style={{background:"rgba(214,162,76,.18)",border:"1px solid rgba(214,162,76,.4)",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,color:"#fcd34d",cursor:"pointer"}}>
                {isAr?"ابدأ الاستراحة 🧘":"Start break 🧘"}
              </button>
              <button onClick={()=>snoozeBreak(5)}
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
          <button onClick={goToBreak} style={{
            width:"100%",background:"rgba(14,165,233,.08)",border:"1px solid rgba(14,165,233,.25)",
            borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:700,color:"#38bdf8",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            🧘 {isAr?"خذ استراحة حركة":"Take a movement break"}
          </button>
        </div>

        <div style={{padding:"10px 14px",fontSize:9.5,color:cs.muted,textAlign:"center"}}>
          {isAr ? "☁ تم الحفظ · ⚡ مدعوم بالذكاء الاصطناعي" : "☁ Data saved · ⚡ AI powered"}
        </div>
      </div>
    </div>
  </></ErrorBoundary>);
}









