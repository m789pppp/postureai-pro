/**
 * Corvus — AuthPage v32
 * Full audit: auth flow, password reset, security, desktop design
 * Fixes: race condition, input validation, rate limiting UI, desktop layout
 */
import { useState, useCallback, useEffect, useRef } from "react";
import {
  signInGoogle, signInEmail, signUpEmail, resetPassword,
  getUserProfile, createUserProfile, seedDemoUser,
  AUTO_APPROVE_DOMAIN, SUPPORT_EMAIL,
  isAutoApproveEmail,
} from "./firebase.js";

// ── Design tokens ──────────────────────────────────────────────────
const D = {
  dark: {
    bg:      "#030b14",
    panel:   "rgba(255,255,255,.03)",
    card:    "rgba(255,255,255,.05)",
    border:  "rgba(255,255,255,.08)",
    borderH: "rgba(26,86,219,.7)",
    text:    "#f0f6ff",
    muted:   "#64748b",
    muted2:  "#94a3b8",
    inp:     "rgba(255,255,255,.04)",
    inpB:    "rgba(255,255,255,.1)",
    inpBH:   "rgba(26,86,219,.6)",
    divider: "rgba(255,255,255,.06)",
  },
  light: {
    bg:      "#f8fafc",
    panel:   "#f1f5f9",
    card:    "#ffffff",
    border:  "rgba(0,0,0,.08)",
    borderH: "rgba(26,86,219,.5)",
    text:    "#0f172a",
    muted:   "#94a3b8",
    muted2:  "#64748b",
    inp:     "#f8fafc",
    inpB:    "rgba(0,0,0,.1)",
    inpBH:   "rgba(26,86,219,.5)",
    divider: "rgba(0,0,0,.06)",
  },
};

// ── Error map ──────────────────────────────────────────────────────
const ERRS = {
  "wrong-password":         { en:"Wrong password",                    ar:"كلمة المرور غلط" },
  "invalid-credential":     { en:"Invalid email or password",         ar:"البريد أو كلمة المرور غلط" },
  "user-not-found":         { en:"No account found — sign up first",  ar:"مفيش حساب — سجّل حساب جديد" },
  "email-already-in-use":   { en:"Email already registered — sign in",ar:"البريد مسجّل بالفعل — سجّل دخول" },
  "weak-password":          { en:"Password too weak (min 6 chars)",   ar:"كلمة المرور ضعيفة (6 أحرف كحد أدنى)" },
  "too-many-requests":      { en:"Too many attempts — wait a moment", ar:"محاولات كثيرة — انتظر قليلاً" },
  "network-request-failed": { en:"Network error — check connection",  ar:"مشكلة في الإنترنت" },
  "popup-blocked":          { en:"Popup blocked — trying redirect…",  ar:"تم حجب النافذة — جاري التحويل" },
  "popup-closed-by-user":   { en:"Sign-in cancelled",                 ar:"تم إلغاء تسجيل الدخول" },
  "invalid-email":          { en:"Invalid email address",             ar:"بريد إلكتروني غير صحيح" },
  "operation-not-allowed":  { en:"Email sign-in not enabled",         ar:"تسجيل الدخول بالبريد غير مفعّل" },
};

function getErr(msg, isAr) {
  const code = (msg || "").match(/\(auth\/([^)]+)\)/)?.[1] || (msg || "");
  const e = ERRS[code] || ERRS[Object.keys(ERRS).find(k => code.includes(k)) || ""];
  if (e) return e[isAr ? "ar" : "en"];
  if (code.includes("network") || code.includes("fetch"))
    return isAr ? "مشكلة في الإنترنت" : "Network error — check connection";
  return isAr ? "حدث خطأ — حاول تاني" : "Something went wrong — try again";
}

// ── Password strength ──────────────────────────────────────────────
function pwStrength(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 6)            s++;
  if (p.length >= 10)           s++;
  if (/[A-Z]/.test(p))         s++;
  if (/[0-9]/.test(p))         s++;
  if (/[^A-Za-z0-9]/.test(p))  s++;
  return s;
}

function validateEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
}

// ── FloatingInput ──────────────────────────────────────────────────
function FloatingInput({ tok, label, type="text", value, onChange, autoComplete, required, disabled, rightEl, isRtl, error }) {
  const [focused, setFocused] = useState(false);
  const active = focused || !!value;
  const side    = isRtl ? "right" : "left";
  const oppSide = isRtl ? "left"  : "right";
  return (
    <div style={{ position:"relative", marginBottom: error ? 6 : 14 }}>
      <label style={{
        position:"absolute", [side]:14, top: active ? 7 : 15,
        fontSize: active ? 10 : 13, color: error ? "#ef4444" : active ? "#1a56db" : tok.muted,
        transition:"all .15s", pointerEvents:"none", fontWeight: active ? 500 : 400,
        zIndex:1, direction: isRtl ? "rtl" : "ltr", letterSpacing: active ? ".03em" : 0,
      }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        type={type}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        dir={isRtl ? "rtl" : "ltr"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-invalid={!!error}
        style={{
          width:"100%", paddingTop:22, paddingBottom:9,
          paddingLeft:  isRtl ? (rightEl ? 44 : 14) : 14,
          paddingRight: isRtl ? 14 : (rightEl ? 44 : 14),
          background: tok.inp,
          border: `1.5px solid ${error ? "rgba(239,68,68,.5)" : focused ? tok.inpBH : tok.inpB}`,
          borderRadius:10, fontSize:14, color:tok.text,
          outline:"none", transition:"border-color .15s",
          boxSizing:"border-box", textAlign: isRtl ? "right" : "left",
          fontFamily:"inherit",
        }}
      />
      {rightEl && (
        <div style={{ position:"absolute", [oppSide]:12, top:"50%", transform:"translateY(-50%)" }}>
          {rightEl}
        </div>
      )}
      {error && <div style={{ fontSize:11, color:"#ef4444", marginTop:3, paddingLeft: isRtl ? 0 : 4 }}>{error}</div>}
    </div>
  );
}

// ── Google button ──────────────────────────────────────────────────
function GoogleButton({ tok, loading, onClick, isAr }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} disabled={loading} type="button"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      aria-label={isAr ? "الدخول بـ Google" : "Continue with Google"}
      style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
        gap:10, padding:"13px 0",
        background: hov ? (tok.inp === "#f8fafc" ? "#f1f5f9" : "rgba(255,255,255,.07)") : tok.card,
        border:`1.5px solid ${hov ? tok.borderH : tok.border}`,
        borderRadius:10, fontSize:14, fontWeight:500, color:tok.text,
        transition:"all .15s", cursor: loading ? "wait" : "pointer",
        opacity: loading ? .6 : 1, fontFamily:"inherit",
      }}
    >
      {loading ? (
        <div style={{ width:18,height:18,border:"2px solid rgba(148,163,184,.3)",borderTopColor:"#1a56db",borderRadius:"50%",animation:"spin 1s linear infinite" }}/>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      {isAr ? "الدخول بـ Google" : "Continue with Google"}
    </button>
  );
}

// ── Rate limiter (client-side) ─────────────────────────────────────
const _attempts = { count: 0, firstAt: 0 };
function checkRateLimit() {
  const now = Date.now();
  if (now - _attempts.firstAt > 60000) { _attempts.count = 0; _attempts.firstAt = now; }
  _attempts.count++;
  return _attempts.count > 8; // 8 attempts per minute
}

// ── Feature panel (desktop left side) ─────────────────────────────
function FeaturePanel({ tok, isAr }) {
  const features = isAr ? [
    { icon:"◈", title:"تحليل الوضعية الذكي", desc:"تحليل فوري بالكاميرا بدون أجهزة إضافية" },
    { icon:"🧠", title:"مدرب AI شخصي", desc:"نصائح مخصصة لتحسين وضعيتك يومياً" },
    { icon:"📊", title:"تقارير متقدمة", desc:"PDF مفصّل مع تحليل Groq AI" },
    { icon:"🏢", title:"لوحة HR متكاملة", desc:"إدارة صحة الفريق بالكامل من مكان واحد" },
  ] : [
    { icon:"◈", title:"AI Posture Analysis", desc:"Real-time camera analysis, no hardware needed" },
    { icon:"🧠", title:"Personal AI Coach", desc:"Daily personalized tips to improve posture" },
    { icon:"📊", title:"Advanced Reports", desc:"Detailed PDF with Groq AI narrative" },
    { icon:"🏢", title:"HR Dashboard", desc:"Manage team health from one place" },
  ];

  return (
    <div style={{
      flex:"0 0 380px", padding:"48px 40px",
      display:"flex", flexDirection:"column", justifyContent:"center",
      background: tok.panel, borderRight:`1px solid ${tok.divider}`,
    }}>
      {/* Logo */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:40 }}>
        <div style={{
          width:44, height:44,
          background:"linear-gradient(135deg,#1a56db,#0891b2)",
          borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:22, boxShadow:"0 4px 20px rgba(26,86,219,.3)",
        }}>◈</div>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:tok.text, letterSpacing:"-.02em" }}>Corvus</div>
          <div style={{ fontSize:11.5, color:tok.muted, marginTop:1 }}>
            {isAr ? "صحة العمل بالذكاء الاصطناعي" : "AI Workplace Health"}
          </div>
        </div>
      </div>

      {/* Headline */}
      <div style={{ fontSize:26, fontWeight:700, color:tok.text, lineHeight:1.3, marginBottom:10, letterSpacing:"-.02em" }}>
        {isAr ? "حسّن وضعيتك\nوصحتك في العمل" : "Better posture,\nbetter work life"}
      </div>
      <div style={{ fontSize:13.5, color:tok.muted2, marginBottom:36, lineHeight:1.6 }}>
        {isAr
          ? "تحليل ذكي فوري — بدون أجهزة — يعمل على أي جهاز"
          : "Instant AI analysis — no hardware — works on any device"}
      </div>

      {/* Features */}
      <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
        {features.map((f, i) => (
          <div key={i} style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
            <div style={{
              width:36, height:36, flexShrink:0,
              background:"rgba(26,86,219,.1)", borderRadius:9,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:16, border:"1px solid rgba(26,86,219,.15)",
            }}>{f.icon}</div>
            <div>
              <div style={{ fontSize:13.5, fontWeight:600, color:tok.text, marginBottom:2 }}>{f.title}</div>
              <div style={{ fontSize:12, color:tok.muted, lineHeight:1.5 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Social proof */}
      <div style={{ marginTop:40, padding:"14px 16px", background:"rgba(26,86,219,.06)", borderRadius:10, border:"1px solid rgba(26,86,219,.12)" }}>
        <div style={{ display:"flex", gap:3, marginBottom:6 }}>
          {"★★★★★".split("").map((s,i) => <span key={i} style={{ color:"#f59e0b", fontSize:13 }}>{s}</span>)}
        </div>
        <div style={{ fontSize:12.5, color:tok.muted2, lineHeight:1.5, fontStyle:"italic" }}>
          {isAr
            ? "\"Corvus غيّر طريقة عملنا كاملاً — فريقنا أكثر نشاطاً الآن\""
            : '"Corvus transformed how our team works — productivity up 30%"'}
        </div>
        <div style={{ fontSize:11, color:tok.muted, marginTop:5 }}>
          {isAr ? "أحمد — مدير تقنية" : "Ahmed, CTO — Tech Corp Egypt"}
        </div>
      </div>
    </div>
  );
}

// ── Main AuthPage ──────────────────────────────────────────────────
export default function AuthPage({ darkMode, setDarkMode, lang, setLang, onAuth, initialView }) {
  const isAr  = lang === "ar";
  const tok   = D[darkMode ? "dark" : "light"];
  const dir   = isAr ? "rtl" : "ltr";

  const [view,    setView]    = useState(initialView || "login");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [name,    setName]    = useState("");
  const [co,      setCo]      = useState("");
  const [showP,   setShowP]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");
  const [ok,      setOk]      = useState("");
  const [fieldErr,setFieldErr]= useState({});
  const [resetSent, setResetSent] = useState(false);

  // Desktop detection
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 900);
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const strength = pwStrength(pass);
  const isAuto   = isAutoApproveEmail(email);

  const go = (v) => { setView(v); setErr(""); setOk(""); setFieldErr({}); setResetSent(false); };

  // ── Validation ────────────────────────────────────────────────
  function validateForm() {
    const errs = {};
    if (!validateEmail(email)) errs.email = isAr ? "بريد إلكتروني غير صحيح" : "Invalid email address";
    if (view !== "forgot") {
      if (!pass) errs.pass = isAr ? "ادخل كلمة المرور" : "Password required";
      else if (pass.length < 6) errs.pass = isAr ? "6 أحرف على الأقل" : "Min 6 characters";
    }
    if (view === "signup") {
      if (!name.trim()) errs.name = isAr ? "الاسم مطلوب" : "Name required";
      if (name.trim().length > 60) errs.name = isAr ? "الاسم طويل جداً" : "Name too long";
    }
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Google sign-in ────────────────────────────────────────────
  const handleGoogle = useCallback(async () => {
    if (checkRateLimit()) {
      setErr(isAr ? "محاولات كثيرة — انتظر دقيقة" : "Too many attempts — wait a moment");
      return;
    }
    setErr(""); setLoading(true);
    try {
      const c = await signInGoogle();
      if (!c) {
        setErr(isAr ? "جاري التوجيه إلى Google…" : "Redirecting to Google…");
        return;
      }
      let p = await getUserProfile(c.user.uid);
      const isNew = !p;
      if (!p) {
        await createUserProfile(c.user.uid, {
          email: c.user.email,
          name: c.user.displayName || "",
          company: "",
        });
      }
      onAuth(c.user, isNew);
    } catch(e) {
      setErr(getErr(e.message, isAr));
    } finally {
      setLoading(false);
    }
  }, [isAr, onAuth]);

  // ── Email submit ──────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (checkRateLimit()) {
      setErr(isAr ? "محاولات كثيرة — انتظر دقيقة" : "Too many attempts — wait a moment");
      return;
    }
    setErr(""); setLoading(true);
    try {
      if (view === "login") {
        const c = await signInEmail(email.trim(), pass);
        onAuth(c.user, false);
      } else {
        const c = await signUpEmail(email.trim(), pass);
        await createUserProfile(
          c.user.uid,
          { email: email.trim(), name: name.trim(), company: co.trim() },
          window.__referral_code || null
        );
        onAuth(c.user, true);
      }
    } catch(e) {
      setErr(getErr(e.message, isAr));
    } finally {
      setLoading(false);
    }
  }, [view, email, pass, name, co, isAr, onAuth]);

  // ── Forgot password ───────────────────────────────────────────
  const handleForgot = useCallback(async (e) => {
    e.preventDefault();
    const errs = {};
    if (!validateEmail(email)) errs.email = isAr ? "أدخل بريداً صحيحاً أولاً" : "Enter a valid email first";
    if (Object.keys(errs).length) { setFieldErr(errs); return; }

    if (checkRateLimit()) {
      setErr(isAr ? "محاولات كثيرة — انتظر دقيقة" : "Too many attempts — wait a moment");
      return;
    }
    setErr(""); setLoading(true);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
      setOk(
        isAr
          ? `✅ تم إرسال رابط إعادة التعيين إلى ${email.trim()} — تحقق من بريدك (وخانة Spam)`
          : `✅ Reset link sent to ${email.trim()} — check your inbox (and spam folder)`
      );
    } catch(e) {
      const code = (e.message || "").match(/\(auth\/([^)]+)\)/)?.[1] || "";
      // Firebase returns success even for non-existent emails (security: don't reveal)
      if (code === "user-not-found") {
        setResetSent(true);
        setOk(isAr ? `✅ إذا كان البريد مسجّلاً سيصلك رابط إعادة التعيين` : `✅ If this email is registered, a reset link has been sent`);
      } else {
        setErr(getErr(e.message, isAr));
      }
    } finally {
      setLoading(false);
    }
  }, [email, isAr]);

  const strengthColors = ["#ef4444","#f97316","#f59e0b","#10b981","#10b981"];
  const strengthLabels = {
    en:["Very weak","Weak","Fair","Strong","Very strong"],
    ar:["ضعيفة جداً","ضعيفة","مقبولة","قوية","قوية جداً"],
  };

  // ── Form panel ────────────────────────────────────────────────
  const formPanel = (
    <div style={{
      flex:"1 1 0",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      padding: isDesktop ? "48px 48px" : "32px 20px",
      minHeight: isDesktop ? "auto" : "100vh",
      overflowY:"auto",
    }}>
      {/* Top controls */}
      <div style={{ width:"100%", maxWidth:420, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        {/* Mobile logo */}
        {!isDesktop && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:32,height:32,background:"linear-gradient(135deg,#1a56db,#0891b2)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>◈</div>
            <span style={{ fontSize:16, fontWeight:700, color:tok.text }}>Corvus</span>
          </div>
        )}
        {isDesktop && <div/>}
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={() => setLang(isAr ? "en" : "ar")}
            style={{ background:"rgba(148,163,184,.1)",border:"1px solid rgba(148,163,184,.15)",borderRadius:8,padding:"5px 11px",fontSize:12,fontWeight:500,color:tok.muted2,cursor:"pointer" }}>
            {isAr ? "🇬🇧 EN" : "🇪🇬 عربي"}
          </button>
          <button onClick={() => setDarkMode(!darkMode)}
            style={{ background:"rgba(148,163,184,.1)",border:"1px solid rgba(148,163,184,.15)",borderRadius:8,padding:"5px 9px",fontSize:13,cursor:"pointer" }}>
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>

      {/* Card */}
      <div style={{ width:"100%", maxWidth:420 }}>
        {/* Forgot heading */}
        {view === "forgot" ? (
          <div style={{ marginBottom:24 }}>
            <button onClick={() => go("login")}
              style={{ background:"none",border:"none",color:tok.muted,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:6,marginBottom:16,padding:0 }}>
              {isAr ? "→ رجوع" : "← Back"}
            </button>
            <div style={{ fontSize:24, fontWeight:700, color:tok.text, marginBottom:6, letterSpacing:"-.02em" }}>
              {isAr ? "نسيت كلمة المرور؟" : "Reset your password"}
            </div>
            <div style={{ fontSize:13.5, color:tok.muted, lineHeight:1.6 }}>
              {isAr
                ? "أدخل بريدك وسنرسل لك رابط إعادة التعيين فوراً"
                : "Enter your email and we'll send you a reset link instantly"}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop: just the tab switcher (logo is on left panel) */}
            {/* Mobile: heading */}
            {!isDesktop && (
              <div style={{ marginBottom:20, textAlign:isAr?"right":"left" }}>
                <div style={{ fontSize:22, fontWeight:700, color:tok.text, letterSpacing:"-.02em" }}>
                  {view === "signup"
                    ? (isAr ? "إنشاء حساب جديد" : "Create your account")
                    : (isAr ? "أهلاً بعودتك" : "Welcome back")}
                </div>
              </div>
            )}

            {/* Tab switcher */}
            <div style={{
              display:"flex", gap:3,
              background:"rgba(148,163,184,.08)",
              borderRadius:11, padding:4, marginBottom:24,
            }}>
              {[
                ["login",  isAr ? "تسجيل الدخول" : "Sign In"],
                ["signup", isAr ? "إنشاء حساب"   : "Sign Up"],
              ].map(([v, l]) => (
                <button key={v} onClick={() => go(v)}
                  style={{
                    flex:1, padding:"10px 0", fontSize:13.5, fontWeight:600,
                    color: view===v ? "#fff" : tok.muted,
                    background: view===v ? "#1a56db" : "transparent",
                    border:"none", borderRadius:8,
                    transition:"all .2s", cursor:"pointer",
                    boxShadow: view===v ? "0 2px 12px rgba(26,86,219,.3)" : "none",
                  }}
                >{l}</button>
              ))}
            </div>
          </>
        )}

        {/* Academic badge */}
        {isAuto && view === "signup" && (
          <div style={{
            background:"rgba(16,185,129,.07)", border:"1px solid rgba(16,185,129,.2)",
            borderRadius:10, padding:"10px 14px", marginBottom:16,
            display:"flex", gap:10, alignItems:"center",
          }}>
            <span style={{ fontSize:18 }}>🎓</span>
            <div>
              <div style={{ fontSize:12.5, fontWeight:600, color:"#10b981", marginBottom:1 }}>
                {isAr ? "نطاق أكاديمي" : "Academic domain detected"}
              </div>
              <div style={{ fontSize:11.5, color:"#6ee7b7" }}>
                {isAr ? `Elite مجاناً لـ ${AUTO_APPROVE_DOMAIN}` : `Elite plan free for ${AUTO_APPROVE_DOMAIN}`}
              </div>
            </div>
          </div>
        )}

        {/* Google button */}
        {view !== "forgot" && (
          <>
            <GoogleButton tok={tok} loading={loading} onClick={handleGoogle} isAr={isAr}/>
            <div style={{ display:"flex", alignItems:"center", gap:10, margin:"16px 0" }}>
              <div style={{ flex:1, height:1, background:tok.border }}/>
              <span style={{ fontSize:12, color:tok.muted, whiteSpace:"nowrap" }}>
                {isAr ? "أو بالبريد الإلكتروني" : "or with email"}
              </span>
              <div style={{ flex:1, height:1, background:tok.border }}/>
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={view === "forgot" ? handleForgot : handleSubmit} noValidate>
          {view === "signup" && (
            <FloatingInput tok={tok} isRtl={isAr}
              label={isAr ? "الاسم الكامل *" : "Full name *"}
              value={name} onChange={v => { setName(v); setFieldErr(p => ({...p, name:""})); }}
              autoComplete="name" required error={fieldErr.name}
            />
          )}
          {view === "signup" && (
            <FloatingInput tok={tok} isRtl={isAr}
              label={isAr ? "الشركة (اختياري)" : "Company (optional)"}
              value={co} onChange={setCo}
              autoComplete="organization"
            />
          )}

          <FloatingInput tok={tok} isRtl={isAr}
            label={isAr ? "البريد الإلكتروني" : "Email address"}
            type="email" value={email}
            onChange={v => { setEmail(v); setFieldErr(p => ({...p, email:""})); }}
            autoComplete="email" required error={fieldErr.email}
          />

          {view !== "forgot" && (
            <>
              <FloatingInput tok={tok} isRtl={isAr}
                label={isAr ? "كلمة المرور" : "Password"}
                type={showP ? "text" : "password"}
                value={pass}
                onChange={v => { setPass(v); setFieldErr(p => ({...p, pass:""})); }}
                autoComplete={view === "login" ? "current-password" : "new-password"}
                required error={fieldErr.pass}
                rightEl={
                  <button type="button" onClick={() => setShowP(v => !v)} tabIndex={-1}
                    aria-label={showP ? (isAr?"إخفاء":"Hide password") : (isAr?"إظهار":"Show password")}
                    style={{ background:"none",border:"none",fontSize:16,color:tok.muted,cursor:"pointer",padding:0,lineHeight:1 }}>
                    {showP ? "🙈" : "👁"}
                  </button>
                }
              />

              {/* Password strength — signup only */}
              {view === "signup" && pass && (
                <div style={{ marginBottom:14, marginTop:-4 }}>
                  <div style={{ display:"flex", gap:3, marginBottom:4 }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{
                        flex:1, height:3, borderRadius:99,
                        background: i<=strength ? strengthColors[Math.min(strength-1,4)] : "rgba(148,163,184,.15)",
                        transition:"background .2s",
                      }}/>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color: strengthColors[Math.min(strength-1,4)] || tok.muted, fontWeight:500 }}>
                    {(strengthLabels[isAr?"ar":"en"])[Math.min(strength-1,4)] || (isAr?"ضعيفة جداً":"Very weak")}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Forgot link */}
          {view === "login" && (
            <div style={{ textAlign: isAr ? "left" : "right", marginBottom:16, marginTop:-4 }}>
              <button type="button" onClick={() => go("forgot")}
                style={{ background:"none",border:"none",fontSize:12.5,color:"#1a56db",cursor:"pointer",padding:0,textDecoration:"underline",textUnderlineOffset:2,fontFamily:"inherit" }}>
                {isAr ? "نسيت كلمة المرور؟" : "Forgot password?"}
              </button>
            </div>
          )}

          {/* Error */}
          {err && (
            <div role="alert" style={{
              background:"rgba(239,68,68,.07)", border:"1px solid rgba(239,68,68,.2)",
              borderRadius:9, padding:"10px 14px", marginBottom:14,
              fontSize:13, color:"#fca5a5", display:"flex", alignItems:"flex-start", gap:8,
            }}>
              <span style={{ fontSize:15, flexShrink:0, marginTop:1 }}>⚠️</span>
              <span>{err}</span>
            </div>
          )}

          {/* Success */}
          {ok && (
            <div role="status" style={{
              background:"rgba(16,185,129,.07)", border:"1px solid rgba(16,185,129,.25)",
              borderRadius:9, padding:"12px 14px", marginBottom:14,
              fontSize:13, color:"#6ee7b7", lineHeight:1.6,
            }}>{ok}</div>
          )}

          {/* Submit */}
          {!resetSent && (
            <button type="submit" disabled={loading}
              style={{
                width:"100%",
                background: loading ? "rgba(26,86,219,.5)" : "linear-gradient(135deg,#1a56db,#0891b2)",
                border:"none", borderRadius:10,
                padding:"14px 0",
                fontSize:14.5, fontWeight:700, color:"#fff",
                cursor: loading ? "wait" : "pointer",
                boxShadow: loading ? "none" : "0 4px 20px rgba(26,86,219,.3)",
                transition:"all .2s",
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                fontFamily:"inherit", letterSpacing:".01em",
              }}
            >
              {loading
                ? <div style={{ width:18,height:18,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite" }}/>
                : view === "login"
                  ? (isAr ? "تسجيل الدخول ←" : "Sign In →")
                  : view === "signup"
                    ? (isAr ? `إنشاء حساب${isAuto?" — Elite مجاناً":""}` : `Create Account${isAuto?" — Elite Free":""}`)
                    : (isAr ? "إرسال رابط إعادة التعيين ←" : "Send Reset Link →")
              }
            </button>
          )}

          {/* Resend reset */}
          {resetSent && (
            <button type="button" onClick={() => { setResetSent(false); setOk(""); }}
              style={{ width:"100%",background:"rgba(26,86,219,.08)",border:"1px solid rgba(26,86,219,.2)",borderRadius:10,padding:"12px 0",fontSize:13.5,fontWeight:500,color:"#1a56db",cursor:"pointer",fontFamily:"inherit" }}>
              {isAr ? "إعادة إرسال الرابط" : "Resend reset link"}
            </button>
          )}
        </form>

        {/* Demo accounts */}
        {view === "login" && import.meta.env.VITE_SHOW_DEMO === "true" && (
          <div style={{ marginTop:20, padding:"14px 16px",
            background:"rgba(99,102,241,.06)", border:"1px solid rgba(99,102,241,.2)", borderRadius:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#a5b4fc", marginBottom:10, letterSpacing:".06em" }}>
              {isAr ? "🎭 حسابات تجريبية" : "🎭 DEMO ACCOUNTS"}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {[
                { label: isAr ? "👤 مستخدم فردي" : "👤 Individual User", email:"demo.individual@corvus.io", pw:"Demo1234!", type:"individual" },
                { label: isAr ? "🏢 مدير HR"      : "🏢 HR Admin",        email:"demo.hr@corvus.io",         pw:"Demo1234!", type:"hr_admin" },
              ].map((d,i) => (
                <button key={i} type="button" onClick={async () => {
                  setErr(""); setLoading(true);
                  try {
                    const c = await signInEmail(d.email, d.pw);
                    onAuth(c.user, false);
                  } catch {
                    try {
                      const c2 = await signUpEmail(d.email, d.pw);
                      await createUserProfile(c2.user.uid, {
                        email:d.email, name: i===0?"Demo User":"Demo HR", company: i===1?"Corvus Demo Co.":"",
                        user_type:d.type, is_org_owner:i===1, tier:i===1?"professional":"standard", setup_complete:true,
                      });
                      await seedDemoUser(c2.user.uid, d.type).catch(()=>{});
                      onAuth(c2.user, false);
                    } catch(e2) { setErr(getErr(e2.message, isAr)); }
                  }
                  setLoading(false);
                }} style={{
                  padding:"9px 12px", background:"rgba(99,102,241,.1)",
                  border:"1px solid rgba(99,102,241,.25)", borderRadius:8,
                  color:"#c7d2fe", fontSize:12.5, fontWeight:500, cursor:"pointer",
                  textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center",
                  transition:"background .15s", fontFamily:"inherit",
                }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,.2)"}
                onMouseLeave={e=>e.currentTarget.style.background="rgba(99,102,241,.1)"}>
                  <span>{d.label}</span>
                  <span style={{ fontSize:11, color:"rgba(199,210,254,.6)" }}>{isAr?"دخول سريع ←":"Quick login →"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign:"center", marginTop:20, fontSize:12, color:tok.muted }}>
          {isAr ? "دعم:" : "Support:"}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color:"#1a56db", textDecoration:"none" }}>{SUPPORT_EMAIL}</a>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight:"100vh",
      background: tok.bg,
      direction: dir,
      fontFamily:"'IBM Plex Sans Arabic','Inter',system-ui,sans-serif",
      display:"flex",
      flexDirection: isDesktop ? (isAr ? "row-reverse" : "row") : "column",
    }}>
      {/* Desktop left panel */}
      {isDesktop && <FeaturePanel tok={tok} isAr={isAr}/>}

      {/* Form panel */}
      {formPanel}

      <style>{`
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes scaleIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        * { box-sizing:border-box }
        button:focus-visible, input:focus-visible { outline:2px solid #1a56db; outline-offset:2px }
      `}</style>
    </div>
  );
}
