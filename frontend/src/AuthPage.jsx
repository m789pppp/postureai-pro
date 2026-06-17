/**
 * PostureAI Pro — AuthPage v31
 * Professional SaaS auth: Login · Sign Up · Forgot Password
 * Design: Notion/Linear quality, dark-first, RTL-ready
 */
import { useState, useCallback } from "react";
import {
  signInGoogle, signInEmail, signUpEmail, resetPassword,
  getUserProfile, createUserProfile, seedDemoUser,
  AUTO_APPROVE_DOMAIN, SUPPORT_EMAIL,
  isAutoApproveEmail,
} from "./firebase.js";

// ── Design tokens ─────────────────────────────────────────────────
const D = {
  dark: {
    bg:     "linear-gradient(135deg, #020d1f 0%, #030b14 50%, #040f1a 100%)",
    card:   "rgba(255,255,255,.04)",
    cardB:  "rgba(255,255,255,.08)",
    border: "rgba(255,255,255,.08)",
    borderH:"rgba(255,255,255,.14)",
    text:   "#f0f6ff",
    muted:  "#64748b",
    muted2: "#94a3b8",
    inp:    "rgba(255,255,255,.05)",
    inpB:   "rgba(255,255,255,.1)",
    inpBH:  "rgba(26,86,219,.6)",
  },
  light: {
    bg:     "linear-gradient(135deg, #f0f4ff 0%, #f8fafc 50%, #f0f9ff 100%)",
    card:   "#ffffff",
    cardB:  "rgba(255,255,255,.95)",
    border: "rgba(0,0,0,.08)",
    borderH:"rgba(26,86,219,.4)",
    text:   "#0f172a",
    muted:  "#94a3b8",
    muted2: "#64748b",
    inp:    "rgba(0,0,0,.03)",
    inpB:   "rgba(0,0,0,.1)",
    inpBH:  "rgba(26,86,219,.5)",
  },
};

const ERRS = {
  "wrong-password":         { en:"Wrong password",                    ar:"كلمة المرور غلط" },
  "invalid-credential":     { en:"Invalid email or password",         ar:"البريد أو كلمة المرور غلط" },
  "user-not-found":         { en:"No account found — sign up first",  ar:"مفيش حساب — سجّل حساب جديد" },
  "email-already-in-use":   { en:"Email already exists — sign in",    ar:"البريد مسجّل — سجّل دخول" },
  "weak-password":          { en:"Password too weak (6+ chars)",      ar:"كلمة المرور ضعيفة (6 أحرف+)" },
  "too-many-requests":      { en:"Too many attempts — try later",     ar:"محاولات كتيرة — حاول بعدين" },
  "network-request-failed": { en:"Network error — check connection",  ar:"مشكلة في الإنترنت" },
  "popup-blocked":          { en:"Popup blocked — trying redirect…",  ar:"تم حجب النافذة — جاري إعادة المحاولة" },
  "popup-closed-by-user":   { en:"Sign-in cancelled",                 ar:"تم إلغاء تسجيل الدخول" },
  "invalid-email":          { en:"Invalid email address",             ar:"بريد إلكتروني غير صحيح" },
};

function getErr(msg, isAr) {
  const code = (msg||"").match(/\(auth\/([^)]+)\)/)?.[1] || (msg||"");
  const e = ERRS[code];
  if (e) return e[isAr ? "ar" : "en"];
  return isAr ? "حدث خطأ — حاول تاني" : "Something went wrong — please try again";
}

function pwStrength(p) {
  let s = 0;
  if (p.length >= 6)  s++;
  if (p.length >= 10) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s; // 0–5
}

// ── Sub-components ────────────────────────────────────────────────
function FloatingInput({ tok, label, type = "text", value, onChange, autoComplete, required, disabled, rightEl, isRtl }) {
  // FIX M-02: RTL-aware label and padding
  const [focused, setFocused] = useState(false);
  const active = focused || value;
  const side = isRtl ? "right" : "left";
  const oppSide = isRtl ? "left" : "right";
  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <label style={{
        position: "absolute", [side]: 14, top: active ? 6 : 14,
        fontSize: active ? 10 : 13, color: active ? "#1a56db" : tok.muted,
        transition: "all .18s", pointerEvents: "none", fontWeight: active ? 500 : 400,
        zIndex: 1, direction: isRtl ? "rtl" : "ltr",
      }}>
        {label}
      </label>
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
        style={{
          width: "100%", paddingTop: 20, paddingBottom: 8,
          paddingLeft: isRtl ? (rightEl ? 44 : 14) : 14,
          paddingRight: isRtl ? 14 : (rightEl ? 44 : 14),
          background: tok.inp,
          border: `1.5px solid ${focused ? tok.inpBH : tok.inpB}`,
          borderRadius: 10, fontSize: 13, color: tok.text,
          outline: "none", transition: "border-color .18s",
          boxSizing: "border-box", textAlign: isRtl ? "right" : "left",
        }}
      />
      {rightEl && (
        <div style={{ position: "absolute", [oppSide]: 12, top: "50%", transform: "translateY(-50%)" }}>
          {rightEl}
        </div>
      )}
    </div>
  );
}

function GoogleButton({ tok, loading, onClick, isAr }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        gap: 10, padding: "12px 0",
        background: hov ? tok.cardB : tok.card,
        border: `1.5px solid ${hov ? tok.borderH : tok.border}`,
        borderRadius: 10, fontSize: 13.5, fontWeight: 500, color: tok.text,
        transition: "all .18s", cursor: loading ? "wait" : "pointer",
        opacity: loading ? .6 : 1,
      }}
    >
      {loading ? (
        <div style={{ width:18,height:18,border:"2px solid rgba(148,163,184,.3)",borderTopColor:"#1a56db",borderRadius:"50%",animation:"spin 1s linear infinite" }}/>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24">
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

// ── Main AuthPage ─────────────────────────────────────────────────
export default function AuthPage({ darkMode, setDarkMode, lang, setLang, onAuth, initialView }) {
  const isAr   = lang === "ar";
  const tok    = D[darkMode ? "dark" : "light"];
  const [view,   setView]   = useState(initialView||"login"); // login | signup | forgot
  const [email,  setEmail]  = useState("");
  const [pass,   setPass]   = useState("");
  const [name,   setName]   = useState("");
  const [co,     setCo]     = useState("");
  const [showP,  setShowP]  = useState(false);
  const [loading,setLoading]= useState(false);
  const [err,    setErr]    = useState("");
  const [ok,     setOk]     = useState("");
  const strength = pwStrength(pass);
  const isAuto   = isAutoApproveEmail(email);

  const go = (v) => { setView(v); setErr(""); setOk(""); };

  const handleGoogle = useCallback(async () => {
    setErr(""); setLoading(true);
    try {
      const c = await signInGoogle();
      if (!c) { setErr(isAr ? "جاري التوجيه إلى Google…" : "Redirecting to Google…"); return; }
      let p = await getUserProfile(c.user.uid);
      const isNew = !p; // FIX BUG-3: detect new user BEFORE creating profile
      if (!p) await createUserProfile(c.user.uid, { email: c.user.email, name: c.user.displayName || "", company: "" });
      onAuth(c.user, isNew); // FIX BUG-3: pass isNew so App routes to setup page
    } catch(e) { setErr(getErr(e.message, isAr)); }
    setLoading(false);
  }, [isAr, onAuth]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      if (view === "login") {
        const c = await signInEmail(email, pass);
        onAuth(c.user);
      } else {
        const c = await signUpEmail(email, pass);
        await createUserProfile(c.user.uid, { email, name: name.trim(), company: co.trim() }, window.__referral_code || null);
        onAuth(c.user, true);
      }
    } catch(e) { setErr(getErr(e.message, isAr)); }
    setLoading(false);
  }, [view, email, pass, name, co, isAr, onAuth]);

  const handleForgot = useCallback(async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    if (!email.trim()) {
      setErr(isAr ? "أدخل بريدك الإلكتروني أولاً" : "Please enter your email address");
      setLoading(false); return;
    }
    try {
      await resetPassword(email.trim());
      setOk(isAr ? "✅ تم إرسال رابط إعادة التعيين — تحقق من بريدك" : "✅ Reset link sent — check your email");
    } catch(e) { setErr(getErr(e.message, isAr)); }
    setLoading(false);
  }, [email, isAr]);

  const strengthColors = ["#ef4444","#f97316","#f59e0b","#10b981","#10b981"];
  const strengthLabels = {
    en: ["Very weak","Weak","Fair","Strong","Very strong"],
    ar: ["ضعيفة جداً","ضعيفة","مقبولة","قوية","قوية جداً"],
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: tok.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
      direction: isAr ? "rtl" : "ltr",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Background blobs */}
      <div style={{ position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0 }}>
        <div style={{ position:"absolute",top:"-20%",left:"-10%",width:600,height:600,background:"radial-gradient(circle,rgba(26,86,219,.12) 0%,transparent 70%)",borderRadius:"50%",animation:"blob 12s ease infinite" }}/>
        <div style={{ position:"absolute",bottom:"-10%",right:"-10%",width:500,height:500,background:"radial-gradient(circle,rgba(8,145,178,.1) 0%,transparent 70%)",borderRadius:"50%",animation:"blob 15s ease 3s infinite" }}/>
      </div>

      <div style={{ width:"100%",maxWidth:420,position:"relative",zIndex:1 }}>

        {/* Top controls */}
        <div style={{ display:"flex",justifyContent:"flex-end",gap:8,marginBottom:20 }}>
          <button
            onClick={() => setLang(isAr ? "en" : "ar")}
            style={{ background:"rgba(148,163,184,.1)",border:"1px solid rgba(148,163,184,.15)",borderRadius:8,padding:"5px 12px",fontSize:11.5,fontWeight:500,color:tok.muted2,cursor:"pointer",transition:"all .18s" }}
          >
            {isAr ? "🇬🇧 EN" : "🇪🇬 عربي"}
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{ background:"rgba(148,163,184,.1)",border:"1px solid rgba(148,163,184,.15)",borderRadius:8,padding:"5px 10px",fontSize:13,cursor:"pointer" }}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Logo */}
        <div style={{ textAlign:"center",marginBottom:28 }}>
          <div style={{
            width:52,height:52,
            background:"linear-gradient(135deg,#1a56db,#0891b2)",
            borderRadius:15,
            display:"inline-flex",alignItems:"center",justifyContent:"center",
            fontSize:26,
            boxShadow:"0 8px 32px rgba(26,86,219,.35)",
            marginBottom:14,
            animation:"glow 3s ease infinite",
          }}>◈</div>
          <div style={{ fontSize:22,fontWeight:800,color:tok.text,letterSpacing:"-.025em",marginBottom:4 }}>
            PostureAI Pro
          </div>
          <div style={{ fontSize:13,color:tok.muted,fontWeight:400 }}>
            {isAr ? "صحة العمل بالذكاء الاصطناعي" : "AI-powered workplace health"}
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: tok.card,
          border: `1px solid ${tok.border}`,
          borderRadius: 20,
          padding: 28,
          backdropFilter: "blur(12px)",
          boxShadow: darkMode ? "0 20px 60px rgba(0,0,0,.4)" : "0 8px 40px rgba(0,0,0,.1)",
          animation: "scaleIn .3s cubic-bezier(.16,1,.3,1) both",
        }}>

          {/* Tabs — login / signup only */}
          {view !== "forgot" && (
            <div style={{
              display:"flex",gap:3,
              background:"rgba(148,163,184,.07)",
              borderRadius:10,padding:4,marginBottom:22,
            }}>
              {[
                ["login",  isAr ? "تسجيل الدخول" : "Sign In"],
                ["signup", isAr ? "إنشاء حساب" : "Sign Up"],
              ].map(([v,l]) => (
                <button
                  key={v}
                  onClick={() => go(v)}
                  style={{
                    flex:1,padding:"9px 0",fontSize:13,fontWeight:600,
                    color:view===v ? "#fff" : tok.muted,
                    background:view===v ? "#1a56db" : "transparent",
                    border:"none",borderRadius:7,
                    transition:"all .2s",cursor:"pointer",
                  }}
                >{l}</button>
              ))}
            </div>
          )}

          {/* Forgot password heading */}
          {view === "forgot" && (
            <div style={{ marginBottom:20 }}>
              <button
                onClick={() => go("login")}
                style={{ background:"none",border:"none",color:tok.muted,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:5,marginBottom:12,padding:0 }}
              >
                ← {isAr ? "رجوع" : "Back"}
              </button>
              <div style={{ fontSize:18,fontWeight:700,color:tok.text,marginBottom:4 }}>
                {isAr ? "نسيت كلمة المرور؟" : "Forgot your password?"}
              </div>
              <div style={{ fontSize:12.5,color:tok.muted }}>
                {isAr ? "أدخل بريدك وسنرسل لك رابط إعادة التعيين" : "Enter your email and we'll send you a reset link"}
              </div>
            </div>
          )}

          {/* Academic badge */}
          {isAuto && view === "signup" && (
            <div style={{
              background:"rgba(16,185,129,.08)",
              border:"1px solid rgba(16,185,129,.2)",
              borderRadius:10,padding:"10px 14px",marginBottom:16,
              display:"flex",gap:10,alignItems:"center",
            }}>
              <span style={{ fontSize:18 }}>🎓</span>
              <div>
                <div style={{ fontSize:12,fontWeight:600,color:"#10b981",marginBottom:1 }}>
                  {isAr ? "نطاق أكاديمي" : "Academic domain detected"}
                </div>
                <div style={{ fontSize:11,color:"#6ee7b7" }}>
                  {isAr ? "Elite مجاناً لـ" : "Elite plan free for"} {AUTO_APPROVE_DOMAIN}
                </div>
              </div>
            </div>
          )}

          {/* Google sign-in — not on forgot */}
          {view !== "forgot" && (
            <>
              <GoogleButton tok={tok} loading={loading} onClick={handleGoogle} isAr={isAr}/>
              <div style={{ display:"flex",alignItems:"center",gap:10,margin:"16px 0" }}>
                <div style={{ flex:1,height:1,background:tok.border }}/>
                <span style={{ fontSize:11,color:tok.muted,whiteSpace:"nowrap" }}>
                  {isAr ? "أو بالبريد الإلكتروني" : "or continue with email"}
                </span>
                <div style={{ flex:1,height:1,background:tok.border }}/>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={view === "forgot" ? handleForgot : handleSubmit}>
            {view === "signup" && (
              <FloatingInput tok={tok} isRtl={isAr}
                label={isAr ? "الاسم الكامل *" : "Full name *"}
                value={name} onChange={setName}
                autoComplete="name" required
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
              type="email" value={email} onChange={setEmail}
              autoComplete="email" required
            />

            {view !== "forgot" && (
              <>
                <FloatingInput tok={tok} isRtl={isAr}
                  label={isAr ? "كلمة المرور" : "Password"}
                  type={showP ? "text" : "password"}
                  value={pass} onChange={setPass}
                  autoComplete={view === "login" ? "current-password" : "new-password"}
                  required
                  rightEl={
                    <button type="button" onClick={() => setShowP(v=>!v)}
                      style={{ background:"none",border:"none",fontSize:15,color:tok.muted,cursor:"pointer",padding:0,lineHeight:1 }}>
                      {showP ? "🙈" : "👁"}
                    </button>
                  }
                />

                {/* Strength bar — signup only */}
                {view === "signup" && pass && (
                  <div style={{ marginBottom:14,marginTop:-6 }}>
                    <div style={{ display:"flex",gap:3,marginBottom:4 }}>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{
                          flex:1,height:3,borderRadius:99,
                          background: i<=strength ? strengthColors[Math.min(strength-1,4)] : "rgba(148,163,184,.15)",
                          transition:"background .25s",
                        }}/>
                      ))}
                    </div>
                    <div style={{ fontSize:10.5,color:strengthColors[Math.min(strength-1,4)]||tok.muted }}>
                      {(strengthLabels[isAr?"ar":"en"])[Math.min(strength-1,4)] || (isAr?"ضعيفة جداً":"Very weak")}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Forgot link */}
            {view === "login" && (
              <div style={{ textAlign: isAr ? "left" : "right", marginBottom: 16, marginTop: -6 }}>
                <button type="button" onClick={() => go("forgot")}
                  style={{ background:"none",border:"none",fontSize:12,color:"#1a56db",cursor:"pointer",padding:0,textDecoration:"underline",textUnderlineOffset:2 }}>
                  {isAr ? "نسيت كلمة المرور؟" : "Forgot password?"}
                </button>
              </div>
            )}

            {/* Error */}
            {err && (
              <div style={{
                background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.2)",
                borderRadius:9,padding:"10px 14px",marginBottom:14,
                fontSize:12.5,color:"#fca5a5",display:"flex",alignItems:"center",gap:8,
              }}>
                <span style={{ fontSize:14,flexShrink:0 }}>⚠️</span> {err}
              </div>
            )}

            {/* Success */}
            {ok && (
              <div style={{
                background:"rgba(16,185,129,.07)",border:"1px solid rgba(16,185,129,.2)",
                borderRadius:9,padding:"10px 14px",marginBottom:14,
                fontSize:12.5,color:"#6ee7b7",
              }}>{ok}</div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width:"100%",
                background: loading ? "rgba(26,86,219,.5)" : "linear-gradient(135deg,#1a56db,#0891b2)",
                border:"none",borderRadius:10,
                padding:"13px 0",
                fontSize:14,fontWeight:700,color:"#fff",
                cursor: loading ? "wait" : "pointer",
                boxShadow: loading ? "none" : "0 4px 20px rgba(26,86,219,.35)",
                transition:"all .2s",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              }}
            >
              {loading
                ? <div style={{ width:18,height:18,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite" }}/>
                : view === "login"
                  ? (isAr ? "تسجيل الدخول" : "Sign In →")
                  : view === "signup"
                    ? (isAr ? `إنشاء حساب${isAuto?" — Elite مجاناً":""}` : `Create Account${isAuto?" — Elite Free":""}`)
                    : (isAr ? "إرسال رابط إعادة التعيين" : "Send Reset Link →")
              }
            </button>
          </form>
        </div>

        {/* Demo accounts — only shown when VITE_SHOW_DEMO=true (dev/demo env) */}
        {view === "login" && import.meta.env.VITE_SHOW_DEMO === "true" && (
          <div style={{ marginTop:20, padding:"14px 16px",
            background:"rgba(99,102,241,.06)", border:"1px solid rgba(99,102,241,.2)",
            borderRadius:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#a5b4fc",
              marginBottom:10, textTransform:"uppercase", letterSpacing:".06em" }}>
              {isAr ? "🎭 حسابات تجريبية" : "🎭 Demo Accounts"}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {[
                { label: isAr ? "👤 مستخدم فردي" : "👤 Individual User", email:"demo.individual@postureai.io", pass:"Demo1234!" },
                { label: isAr ? "🏢 مدير شركة (HR)" : "🏢 HR Admin",        email:"demo.hr@postureai.io",         pass:"Demo1234!" },
              ].map((d,i) => (
                <button key={i} onClick={async () => {
                  setErr(""); setLoading(true);
                  try {
                    const c = await signInEmail(d.email, d.pass);
                    onAuth(c.user);
                  } catch(e) {
                    // Demo account doesn't exist yet - create it
                    try {
                      const c2 = await signUpEmail(d.email, d.pass);
                      await createUserProfile(c2.user.uid, {
                        email: d.email,
                        name: i === 0 ? "Demo User" : "Demo HR Admin",
                        company: i === 1 ? "PostureAI Demo Co." : "",
                        user_type: i === 1 ? "hr_admin" : "individual",
                        is_org_owner: i === 1,
                        tier: i === 1 ? "professional" : "standard",
                        setup_complete: true,
                      });
                      // Seed realistic demo data
                      await seedDemoUser(c2.user.uid, i === 0 ? "individual" : "hr_admin").catch(()=>{});
                      onAuth(c2.user);
                    } catch(e2) { setErr(getErr(e2.message, isAr)); }
                  }
                  setLoading(false);
                }} style={{
                  padding:"8px 12px", background:"rgba(99,102,241,.1)",
                  border:"1px solid rgba(99,102,241,.25)", borderRadius:7,
                  color:"#c7d2fe", fontSize:12, fontWeight:600, cursor:"pointer",
                  textAlign:"left", display:"flex", justifyContent:"space-between",
                  alignItems:"center", transition:"all .15s",
                }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,.2)"}
                onMouseLeave={e=>e.currentTarget.style.background="rgba(99,102,241,.1)"}>
                  <span>{d.label}</span>
                  <span style={{ fontSize:10, color:"rgba(199,210,254,.6)" }}>{isAr?"دخول فوري →":"Quick login →"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign:"center",marginTop:20,fontSize:11.5,color:tok.muted }}>
          {isAr ? "الدعم الفني:" : "Support:"}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color:"#1a56db",textDecoration:"none" }}>{SUPPORT_EMAIL}</a>
        </div>

      </div>
      <style>{`@keyframes glow{0%,100%{box-shadow:0 8px 32px rgba(26,86,219,.3)}50%{box-shadow:0 8px 48px rgba(26,86,219,.55)}} @keyframes blob{0%,100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%}50%{border-radius:30% 60% 70% 40%/50% 60% 30% 60%}} @keyframes scaleIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}


