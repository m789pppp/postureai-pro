/**
 * Corvus Auth — World-class authentication UI
 * Inspired by: Stripe, Linear, Vercel, Notion quality
 * Features: Animated gradient mesh, floating labels, micro-animations,
 *           dark/light mode, Google + Microsoft, password strength, shake on error
 */
import { useState, useCallback, useEffect, useRef } from "react";
import {
  signInGoogle, signInMicrosoft, signInEmail, signUpEmail, resetPassword,
  getUserProfile, createUserProfile, SUPPORT_EMAIL, setRememberMe,
  deleteAuthUser,
} from "./firebase.js";

// ── Error messages ─────────────────────────────────────────────────
function getErr(err, isAr) {
  // err can be the raw Error/FirebaseError object OR a plain message string
  // (kept for backward compat with older call sites passing e.message).
  const msg  = typeof err === "string" ? err : (err?.message || "");
  const code = (typeof err === "object" && err?.code)
    ? String(err.code).replace(/^auth\//, "")
    : (msg.match(/\(auth\/([^)]+)\)/)?.[1] || "");
  const map = {
    "wrong-password":        {en:"Incorrect email or password",          ar:"البريد أو كلمة المرور غلط"},
    "invalid-credential":    {en:"Incorrect email or password",          ar:"البريد أو كلمة المرور غلط"},
    "user-not-found":        {en:"Incorrect email or password",          ar:"البريد أو كلمة المرور غلط"},
    "email-already-in-use":  {en:"An account with this email already exists", ar:"البريد مسجّل بالفعل"},
    "weak-password":         {en:"Password must be at least 6 characters", ar:"كلمة المرور 6 أحرف على الأقل"},
    "too-many-requests":     {en:"Too many attempts. Try again in a few minutes.", ar:"محاولات كثيرة. انتظر دقائق."},
    "network-request-failed":{en:"Connection error. Check your internet.", ar:"خطأ في الاتصال. تحقق من الإنترنت."},
    "invalid-email":         {en:"Please enter a valid email address",   ar:"أدخل بريداً إلكترونياً صحيحاً"},
    "popup-closed-by-user":  {en:"Sign-in was cancelled",               ar:"تم إلغاء تسجيل الدخول"},
    "popup-blocked":         {en:"Popup blocked — allow popups for this site", ar:"المتصفح حجب النافذة — لازم تسمح بالـ popups"},
    "unauthorized-domain":   {en:"This domain isn't authorized for sign-in — contact support", ar:"الدومين ده غير مُصرّح له بتسجيل الدخول — تواصل مع الدعم"},
    "operation-not-allowed": {en:"This sign-in method isn't enabled — contact support", ar:"طريقة تسجيل الدخول دي غير مفعّلة — تواصل مع الدعم"},
    "internal-error":        {en:"Sign-in error — contact support if this persists", ar:"خطأ في تسجيل الدخول — تواصل مع الدعم لو استمر"},
    "account-exists-with-different-credential":
                             {en:"This email is linked to a different sign-in method", ar:"هذا البريد مرتبط بطريقة دخول مختلفة"},
    "requires-recent-login": {en:"Please sign in again to continue", ar:"يجب إعادة تسجيل الدخول للمتابعة"},
    "cancelled-popup-request":{en:"Sign-in was cancelled", ar:"تم إلغاء تسجيل الدخول"},
    "operation-not-supported-in-this-environment":
                             {en:"Redirecting to sign in...", ar:"جاري إعادة التوجيه..."},
  };
  const e = map[code]||map[Object.keys(map).find(k=>code.includes(k))||""];
  // Always log full details — internal-error in particular often has more
  // context buried in the full message/customData that's worth checking
  // in devtools when this fires for every sign-in method uniformly.
  console.error("[Auth]", { code: code||"(none)", message: msg, customData: err?.customData });
  if (e) return e[isAr?"ar":"en"];
  return (isAr?"حدث خطأ غير متوقع. حاول مرة أخرى.":"An unexpected error occurred. Please try again.") + (code?` (${code})`:"");
}

// ── Password strength ──────────────────────────────────────────────
function analyzePw(p) {
  return {
    length:   p.length >= 8,
    upper:    /[A-Z]/.test(p),
    lower:    /[a-z]/.test(p),
    number:   /[0-9]/.test(p),
    special:  /[^A-Za-z0-9]/.test(p),
  };
}
function pwScore(p) {
  if (!p) return 0;
  const a = analyzePw(p);
  return Object.values(a).filter(Boolean).length;
}

// ── Rate limiter ───────────────────────────────────────────────────
const _rl = {c:0,t:0};
function rateOk() {
  const now = Date.now();
  if (now - _rl.t > 60000) { _rl.c=0; _rl.t=now; }
  return ++_rl.c <= 8;
}

// ── Animated mesh gradient background ─────────────────────────────
function MeshBg({ dark }) {
  return (
    <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
      {/* Base gradient */}
      <div style={{
        position:"absolute",inset:0,
        background: dark
          ? "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(26,86,219,.12) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 90%, rgba(8,145,178,.08) 0%, transparent 60%), #030b14"
          : "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(219,234,254,.8) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 90%, rgba(186,230,253,.6) 0%, transparent 60%), #f8fafc",
      }}/>
      {/* Floating orbs */}
      {[
        {w:500,h:500,t:-15,l:-10,c:dark?"rgba(26,86,219,.07)":"rgba(59,130,246,.06)",d:20},
        {w:400,h:400,t:60,r:-10,c:dark?"rgba(8,145,178,.06)":"rgba(14,165,233,.05)",d:25},
        {w:350,h:350,b:-10,l:30,c:dark?"rgba(99,102,241,.05)":"rgba(99,102,241,.04)",d:18},
      ].map((o,i)=>(
        <div key={i} style={{
          position:"absolute",
          width:o.w, height:o.h,
          top:o.t!==undefined?`${o.t}%`:undefined,
          bottom:o.b!==undefined?`${o.b}%`:undefined,
          left:o.l!==undefined?`${o.l}%`:undefined,
          right:o.r!==undefined?`${o.r}%`:undefined,
          borderRadius:"50%",
          background:`radial-gradient(circle, ${o.c} 0%, transparent 70%)`,
          animation:`orbFloat${i} ${o.d}s ease-in-out infinite`,
          animationDelay:`${i*3}s`,
        }}/>
      ))}
    </div>
  );
}

// ── Floating label input ───────────────────────────────────────────
function FloatInput({ id, label, type="text", value, onChange, autoComplete,
  required, disabled, error, valid, rightEl, dark, isRtl, hint }) {
  const [focused, setFocused] = useState(false);
  const active = focused || !!value;
  const c = dark
    ? { bg:"rgba(255,255,255,.04)", bgF:"rgba(26,86,219,.07)", border:"rgba(255,255,255,.08)",
        borderF:"#3b82f6", borderE:"rgba(239,68,68,.5)", borderV:"rgba(34,197,94,.5)",
        label:"rgba(255,255,255,.35)", labelF:"#3b82f6", labelE:"#f87171", labelV:"#4ade80",
        text:"#f0f6ff", placeholder:"rgba(255,255,255,.15)" }
    : { bg:"#ffffff", bgF:"rgba(59,130,246,.03)", border:"rgba(0,0,0,.1)",
        borderF:"#1a56db", borderE:"rgba(239,68,68,.5)", borderV:"rgba(34,197,94,.5)",
        label:"#94a3b8", labelF:"#1a56db", labelE:"#ef4444", labelV:"#16a34a",
        text:"#0f172a", placeholder:"rgba(0,0,0,.2)" };

  const borderColor = error ? c.borderE : valid ? c.borderV : focused ? c.borderF : c.border;
  const labelColor  = error ? c.labelE  : valid ? c.labelV  : focused ? c.labelF  : c.label;

  return (
    <div style={{position:"relative",marginBottom:error?4:16}}>
      {/* Floating label */}
      <label htmlFor={id} style={{
        position:"absolute",
        [isRtl?"right":"left"]: 14,
        top: active ? 7 : "50%",
        transform: active ? "none" : "translateY(-50%)",
        fontSize: active ? 10.5 : 14,
        fontWeight: active ? 600 : 400,
        color: labelColor,
        transition:"all .18s cubic-bezier(.4,0,.2,1)",
        pointerEvents:"none", zIndex:1,
        letterSpacing: active ? ".04em" : 0,
        textTransform: active ? "uppercase" : "none",
      }}>{label}</label>

      {/* Input */}
      <input
        id={id} type={type} value={value} required={required} disabled={disabled}
        autoComplete={autoComplete} aria-invalid={!!error} aria-describedby={error?`${id}-err`:undefined}
        onChange={e=>onChange(e.target.value)}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        dir={isRtl?"rtl":"ltr"}
        style={{
          width:"100%",
          paddingTop: 22, paddingBottom: 9,
          paddingLeft: isRtl ? (rightEl?44:14) : 14,
          paddingRight: isRtl ? 14 : (rightEl?44:14),
          background: focused ? c.bgF : c.bg,
          border: `1.5px solid ${borderColor}`,
          borderRadius: 10, fontSize: 14.5, color: c.text,
          outline:"none", transition:"all .2s cubic-bezier(.4,0,.2,1)",
          boxSizing:"border-box", fontFamily:"inherit",
          boxShadow: focused ? `0 0 0 3px ${dark?"rgba(59,130,246,.12)":"rgba(26,86,219,.08)"}` : "none",
        }}
      />

      {/* Right element (show/hide pw) */}
      {rightEl && (
        <div style={{
          position:"absolute", [isRtl?"left":"right"]:12,
          top:"50%", transform:"translateY(-50%)",
        }}>{rightEl}</div>
      )}

      {/* Valid checkmark */}
      {valid && !error && (
        <div style={{
          position:"absolute", [isRtl?"left":"right"]:rightEl?44:12,
          top:"50%", transform:"translateY(-50%)",
          color:"#4ade80", fontSize:14, fontWeight:700,
          animation:"popIn .2s cubic-bezier(.34,1.56,.64,1)",
        }}>✓</div>
      )}

      {/* Error */}
      {error && (
        <div id={`${id}-err`} role="alert" style={{
          fontSize:11.5, color: dark?"#f87171":"#ef4444",
          marginTop:4, paddingLeft:isRtl?0:4, paddingRight:isRtl?4:0,
          animation:"slideDown .15s ease",
        }}>{error}</div>
      )}
      {hint && !error && (
        <div style={{fontSize:11.5,color:dark?"rgba(255,255,255,.3)":"#94a3b8",marginTop:4,paddingLeft:isRtl?0:4}}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ── Password strength display ──────────────────────────────────────
function PwStrength({ pass, dark, isAr }) {
  const score = pwScore(pass);
  const a     = analyzePw(pass);
  const colors = ["","#ef4444","#f97316","#eab308","#22c55e","#16a34a"];
  const labels = {
    en:["","Weak","Fair","Good","Strong","Excellent"],
    ar:["","ضعيفة","مقبولة","جيدة","قوية","ممتازة"],
  };
  const checks = [
    {k:"length",  en:"8+ characters", ar:"8+ أحرف"},
    {k:"upper",   en:"Uppercase",      ar:"حرف كبير"},
    {k:"lower",   en:"Lowercase",      ar:"حرف صغير"},
    {k:"number",  en:"Number",         ar:"رقم"},
    {k:"special", en:"Symbol",         ar:"رمز"},
  ];
  if (!pass) return null;
  const col = colors[Math.min(score,5)];
  const lbl = labels[isAr?"ar":"en"][Math.min(score,5)];
  return (
    <div style={{marginBottom:14,marginTop:-4,padding:"10px 12px",
      background:dark?"rgba(255,255,255,.03)":"rgba(0,0,0,.02)",
      border:`1px solid ${dark?"rgba(255,255,255,.07)":"rgba(0,0,0,.06)"}`,
      borderRadius:10}}>
      {/* Header row */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}>
        <span style={{fontSize:11,fontWeight:600,color:dark?"rgba(255,255,255,.4)":"#94a3b8"}}>
          {isAr?"قوة كلمة المرور":"Password strength"}
        </span>
        <span style={{fontSize:11.5,fontWeight:700,color:col,transition:"color .3s"}}>{lbl}</span>
      </div>
      {/* Bars */}
      <div style={{display:"flex",gap:3,marginBottom:9}}>
        {[1,2,3,4,5].map(i=>(
          <div key={i} style={{
            flex:1,height:4,borderRadius:99,
            background:i<=score?col:(dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"),
            transition:`background .25s ease ${i*.04}s`,
          }}/>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:11.5,fontWeight:600,color:score>0?(col||"#22c55e"):(dark?"rgba(255,255,255,.3)":"#94a3b8")}}>
          {labels[isAr?"ar":"en"][Math.min(score,5)]}
        </span>
      </div>
      {/* Checklist */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 12px"}}>
        {checks.map(ch=>(
          <div key={ch.k} style={{
            display:"flex",alignItems:"center",gap:4,fontSize:10.5,
            color:a[ch.k]?(dark?"#4ade80":"#16a34a"):(dark?"rgba(255,255,255,.3)":"#94a3b8"),
            transition:"color .2s",
          }}>
            <span style={{
              width:14,height:14,borderRadius:"50%",flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,
              background:a[ch.k]?(dark?"rgba(74,222,128,.15)":"rgba(22,163,74,.12)"):"transparent",
              border:`1px solid ${a[ch.k]?(dark?"rgba(74,222,128,.4)":"rgba(22,163,74,.35)"):(dark?"rgba(255,255,255,.1)":"rgba(0,0,0,.1)")}`,
              transition:"all .2s",
            }}>{a[ch.k]?"✓":""}</span>
            {ch[isAr?"ar":"en"]}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Social button ──────────────────────────────────────────────────
function SocialBtn({ icon, label, onClick, loading, disabled, dark }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={disabled||loading}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      aria-label={label}
      style={{
        flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        padding:"11px 12px", fontFamily:"inherit",
        background: hov
          ?(dark?"rgba(255,255,255,.07)":"rgba(26,86,219,.05)")
          :(dark?"rgba(255,255,255,.04)":"#ffffff"),
        border:`1.5px solid ${hov?(dark?"rgba(255,255,255,.15)":"rgba(26,86,219,.25)"):(dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.1)")}`,
        borderRadius:10, fontSize:13.5, fontWeight:500,
        color: dark?"rgba(255,255,255,.8)":"#374151",
        cursor:(disabled||loading)?"not-allowed":"pointer",
        transition:"all .2s cubic-bezier(.4,0,.2,1)",
        transform: hov&&!disabled?"translateY(-1px)":"none",
        boxShadow: hov&&!disabled?(dark?"0 4px 20px rgba(0,0,0,.3)":"0 4px 16px rgba(26,86,219,.1)"):"none",
        opacity:(disabled&&!loading)?.5:1,
      }}>
      {loading
        ? <div style={{width:16,height:16,border:`2px solid ${dark?"rgba(255,255,255,.2)":"rgba(0,0,0,.1)"}`,borderTopColor:dark?"#fff":"#1a56db",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
        : icon}
      <span>{label}</span>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────
export default function AuthPage({ darkMode, setDarkMode, lang, setLang, onAuth, initialView }) {
  const isAr = lang === "ar";
  const dark = darkMode;

  const [view,       setView]      = useState(initialView||"login");
  const [accountType,setAccountType]= useState("individual"); // "individual" | "company"
  const [email,      setEmail]     = useState("");
  const [pass,       setPass]      = useState("");
  const [pass2,      setPass2]     = useState("");
  const [fname,      setFname]     = useState("");
  const [lname,      setLname]     = useState("");
  const [country,    setCountry]   = useState("");
  const [profession, setProfession]= useState("");
  const [companyName,setCompanyName]= useState("");
  const [teamSize,   setTeamSize]  = useState("");
  const [agreeTerms, setAgreeTerms]= useState(false);
  const [newsletter, setNewsletter]= useState(true);
  const [showP,      setShowP]     = useState(false);
  const [showP2,     setShowP2]    = useState(false);
  const [remember,   setRemember]  = useState(true);
  const [loading,    setLoading]   = useState(false);
  const [social,     setSocial]    = useState("");
  const [err,        setErr]       = useState("");
  const errRef = useRef(null);
  const [ok,         setOk]        = useState("");
  const [sent,       setSent]      = useState(false);
  const [touched,    setTouched]   = useState({});
  const [mounted,    setMounted]   = useState(false);
  const [shake,      setShake]     = useState(false);
  const [capsLock,   setCapsLock]  = useState(false);

  const isCompany = accountType === "company";

  useEffect(()=>{ const t=setTimeout(()=>setMounted(true),60); return()=>clearTimeout(t); },[]);
  useEffect(()=>{
    if(err && errRef.current && window.innerWidth < 768){
      errRef.current.scrollIntoView({ behavior:"smooth", block:"center" });
    }
  },[err]);
  useEffect(()=>{
    const h = e => setCapsLock(e.getModifierState?.("CapsLock")??false);
    window.addEventListener("keydown",h);
    window.addEventListener("keyup",h);
    return ()=>{ window.removeEventListener("keydown",h); window.removeEventListener("keyup",h); };
  },[]);

  // Reset form on account type change
  useEffect(()=>{
    setErr(""); setTouched({});
    setCompanyName(""); setTeamSize(""); setProfession("");
  },[accountType]);

  const doShake = () => { setShake(true); setTimeout(()=>setShake(false),600); };
  const go = v => { setView(v); setErr(""); setOk(""); setSent(false); setTouched({}); };
  const touch = k => setTouched(p=>({...p,[k]:true}));

  // ── Validation ───────────────────────────────────────────────────
  const emailValid    = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const passValid     = pass.length >= 6;
  const pass2Valid    = pass === pass2 && pass2.length > 0;
  const fnameValid    = fname.trim().length >= 1;
  const lnameValid    = lname.trim().length >= 1;
  const countryValid  = country.length > 0;
  const termsValid    = agreeTerms;
  const companyValid  = isCompany ? companyName.trim().length >= 2 : true;
  const teamSizeValid = isCompany ? teamSize.length > 0 : true;

  const fieldErr = {
    email:       touched.email       && !emailValid    ? (isAr?"أدخل بريداً إلكترونياً صحيحاً":"Enter a valid email address") : "",
    pass:        touched.pass        && !passValid     ? (isAr?"6 أحرف على الأقل":"At least 6 characters") : "",
    pass2:       touched.pass2       && !pass2Valid    ? (isAr?"كلمتا المرور غير متطابقتين":"Passwords don't match") : "",
    fname:       touched.fname       && !fnameValid    ? (isAr?"الاسم الأول مطلوب":"First name required") : "",
    lname:       touched.lname       && !lnameValid    ? (isAr?"اسم العائلة مطلوب":"Last name required") : "",
    country:     touched.country     && !countryValid  ? (isAr?"اختر الدولة":"Select your country") : "",
    terms:       touched.terms       && !termsValid    ? (isAr?"يجب الموافقة على الشروط":"You must agree to the terms") : "",
    companyName: touched.companyName && !companyValid  ? (isAr?"اسم الشركة مطلوب":"Company name required") : "",
    teamSize:    touched.teamSize    && !teamSizeValid ? (isAr?"اختر حجم الفريق":"Select team size") : "",
  };

  // ── Social auth ──────────────────────────────────────────────────
  const withSocial = async (key, fn) => {
    if (!rateOk()) { setErr(isAr?"انتظر دقيقة":"Too many attempts — wait"); return; }
    setErr(""); setSocial(key);
    try {
      const r = await fn();
      if (!r) return;
      try {
        const p = await getUserProfile(r.user.uid);
        if (!p) await createUserProfile(r.user.uid, {
          email: r.user.email, name: r.user.displayName||"", company: "",
          user_type: isCompany ? "hr_admin" : "individual",
        });
      } catch (profileErr) {
        console.warn("[Auth] profile setup error (non-fatal):", profileErr?.code || profileErr?.message);
      }
      onAuth(r.user, false);
    } catch(e) { setErr(getErr(e,isAr)); doShake(); }
    finally { setSocial(""); }
  };

  // ── Email submit ─────────────────────────────────────────────────
  const handleSubmit = useCallback(async e => {
    e.preventDefault();
    if (view==="login")  setTouched({email:true,pass:true});
    if (view==="signup") {
      const base = {email:true,pass:true,pass2:true,fname:true,lname:true,country:true,terms:true};
      setTouched(isCompany ? {...base,companyName:true,teamSize:true} : {...base});
    }
    const signupValid = emailValid && passValid && pass2Valid && fnameValid && lnameValid && countryValid && termsValid
      && (isCompany ? companyValid && teamSizeValid : true);
    if (view==="login"  && (!emailValid||!passValid)) { doShake(); return; }
    if (view==="signup" && !signupValid) { doShake(); return; }
    if (!rateOk()) { setErr(isAr?"انتظر دقيقة":"Too many attempts"); return; }
    setErr(""); setLoading(true);
    try {
      if (view==="login") {
        await setRememberMe(remember).catch(()=>{});
        const c = await signInEmail(email.trim(), pass);
        onAuth(c.user, false);
      } else {
        const c = await signUpEmail(email.trim(), pass);
        try {
          await createUserProfile(c.user.uid, {
            email:       email.trim(),
            name:        `${fname.trim()} ${lname.trim()}`.trim(),
            first_name:  fname.trim(),
            last_name:   lname.trim(),
            country,
            profession:  isCompany ? "hr_admin" : profession.trim(),
            newsletter,
            company:     isCompany ? companyName.trim() : "",
            team_size:   isCompany ? teamSize : "",
            user_type:   isCompany ? "hr_admin" : "individual",
            account_type: accountType,
          });
        } catch (profileErr) {
          console.error("[Auth] profile creation failed:", profileErr?.code || profileErr?.message);
          try { await deleteAuthUser(); } catch {}
          throw profileErr;
        }
        onAuth(c.user, true);
      }
    } catch(e) {
      setErr(getErr(e,isAr));
      doShake();
      setPass(""); setPass2(""); setShowP(false); setShowP2(false);
    }
    finally { setLoading(false); }
  },[view,email,pass,pass2,fname,lname,emailValid,passValid,pass2Valid,fnameValid,lnameValid,
     countryValid,termsValid,companyValid,teamSizeValid,isCompany,accountType,
     companyName,teamSize,profession,isAr,onAuth,remember,newsletter]);

  // ── Forgot password ──────────────────────────────────────────────
  const handleForgot = useCallback(async e => {
    e.preventDefault();
    setTouched({email:true});
    if (!emailValid) { doShake(); return; }
    if (!rateOk()) { setErr(isAr?"انتظر دقيقة":"Too many attempts"); return; }
    setErr(""); setLoading(true);
    try {
      await resetPassword(email.trim()); setSent(true);
      setOk(isAr?`تم إرسال رابط إعادة التعيين إلى ${email}`:`Reset link sent to ${email}`);
    } catch(e) {
      const code=(e.message||"").match(/\(auth\/([^)]+)\)/)?.[1]||"";
      // Don't reveal if email exists
      setSent(true);
      setOk(isAr?"إذا كان البريد مسجّلاً، ستتلقى رابط إعادة التعيين قريباً":"If this email is registered, you'll receive a reset link shortly");
    } finally { setLoading(false); }
  },[email,emailValid,isAr]);

  const busy = loading||!!social;

  // ── Color tokens ─────────────────────────────────────────────────
  const t = dark ? {
    bg:      "#030b14",
    card:    "rgba(15,23,42,.8)",
    border:  "rgba(255,255,255,.07)",
    text:    "#f0f6ff",
    textSub: "#94a3b8",
    muted:   "rgba(255,255,255,.3)",
    faint:   "rgba(255,255,255,.04)",
    divider: "rgba(255,255,255,.06)",
    pillBg:  "rgba(255,255,255,.05)",
    pillBd:  "rgba(255,255,255,.08)",
    acc:     "#3b82f6",
    accBtn:  "linear-gradient(135deg,#1d4ed8 0%,#0891b2 100%)",
    shadow:  "0 24px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(59,130,246,.08), inset 0 1px 0 rgba(255,255,255,.05)",
    tabAct:  "linear-gradient(135deg,#1d4ed8,#0891b2)",
    tabActS: "0 3px 14px rgba(29,78,216,.4)",
  } : {
    bg:      "#f0f4ff",
    card:    "rgba(255,255,255,.95)",
    border:  "rgba(0,0,0,.07)",
    text:    "#0f172a",
    textSub: "#64748b",
    muted:   "#94a3b8",
    faint:   "rgba(0,0,0,.03)",
    divider: "rgba(0,0,0,.06)",
    pillBg:  "rgba(0,0,0,.04)",
    pillBd:  "rgba(0,0,0,.07)",
    acc:     "#1a56db",
    accBtn:  "linear-gradient(135deg,#1a56db 0%,#0891b2 100%)",
    shadow:  "0 20px 60px rgba(26,86,219,.12), 0 4px 20px rgba(0,0,0,.07), 0 0 0 1px rgba(0,0,0,.05)",
    tabAct:  "linear-gradient(135deg,#1a56db,#0891b2)",
    tabActS: "0 3px 14px rgba(26,86,219,.3)",
  };

  const eyeBtn = (show, toggle) => (
    <button type="button" onClick={toggle} tabIndex={-1}
      aria-label={show?"Hide password":"Show password"}
      style={{background:"none",border:"none",color:t.muted,cursor:"pointer",
        fontSize:15,padding:"2px",lineHeight:1,transition:"color .15s",display:"flex"}}
      onMouseEnter={e=>e.currentTarget.style.color=t.text}
      onMouseLeave={e=>e.currentTarget.style.color=t.muted}>
      {show ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );

  return (
    <div style={{
      minHeight:"100vh", background:t.bg,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Inter','IBM Plex Sans Arabic',system-ui,-apple-system,sans-serif",
      direction:isAr?"rtl":"ltr",
      padding:"24px 16px", position:"relative",
      transition:"background .4s ease",
    }}>
      <MeshBg dark={dark}/>

      {/* Top controls */}
      <div style={{position:"fixed",top:20,[isAr?"left":"right"]:20,display:"flex",gap:8,zIndex:10}}>
        <button onClick={()=>setLang(isAr?"en":"ar")} style={{
          background:t.pillBg, border:`1px solid ${t.pillBd}`,
          borderRadius:8, padding:"5px 11px", fontSize:12, fontWeight:500,
          color:t.textSub, cursor:"pointer", transition:"all .2s", fontFamily:"inherit",
          backdropFilter:"blur(8px)",
        }}
        onMouseEnter={e=>{e.currentTarget.style.background=`rgba(26,86,219,.12)`;e.currentTarget.style.color=t.text;}}
        onMouseLeave={e=>{e.currentTarget.style.background=t.pillBg;e.currentTarget.style.color=t.textSub;}}>
          {isAr?"🇬🇧 English":"🇪🇬 عربي"}
        </button>
        <button onClick={()=>setDarkMode(!dark)} style={{
          background:t.pillBg, border:`1px solid ${t.pillBd}`,
          borderRadius:8, padding:"5px 10px", fontSize:14,
          cursor:"pointer", transition:"all .2s", backdropFilter:"blur(8px)",
        }}
        onMouseEnter={e=>e.currentTarget.style.background=`rgba(26,86,219,.12)`}
        onMouseLeave={e=>e.currentTarget.style.background=t.pillBg}>
          {dark?"☀️":"🌙"}
        </button>
      </div>

      {/* Auth Card */}
      <div style={{
        width:"100%", maxWidth: view==="signup" ? 460 : 420,
        position:"relative", zIndex:1,
        background:t.card,
        border:`1px solid ${t.border}`,
        borderRadius:20,
        padding: view==="signup" ? "36px 32px" : "36px 32px",
        backdropFilter:"blur(24px)",
        opacity:mounted?1:0,
        transform:`translateY(${mounted?0:20}px)${shake?" translateX(-4px)":""}`,
        transition:`opacity .4s cubic-bezier(.4,0,.2,1), transform .4s cubic-bezier(.4,0,.2,1)${shake?", box-shadow .05s":""}, max-width .3s ease, box-shadow .05s`,
        boxShadow: shake
          ? `0 0 0 2px rgba(239,68,68,.4), ${t.shadow}`
          : t.shadow,
      }}>

        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:22}}>
          <div style={{
            width:38,height:38,borderRadius:10,flexShrink:0,
            background:"linear-gradient(135deg,#1a56db 0%,#0891b2 100%)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:19, color:"#fff",
            boxShadow:"0 6px 20px rgba(26,86,219,.35)",
            animation:"logoAnim 4s ease-in-out infinite",
          }}>◈</div>
          <div style={{lineHeight:1.1}}>
            <div style={{fontSize:17,fontWeight:800,color:t.text,letterSpacing:"-.025em"}}>Corvus</div>
            <div style={{fontSize:9.5,color:t.muted,marginTop:2,letterSpacing:".05em",textTransform:"uppercase"}}>
              {isAr?"صحة العمل بالذكاء الاصطناعي":"AI Posture Coaching"}
            </div>
          </div>
        </div>

        {/* ── FORGOT VIEW ─────────────────────────────────────────── */}
        {view==="forgot" && (
          <>
            <button onClick={()=>go("login")} style={{
              background:"none",border:"none",color:t.textSub,cursor:"pointer",
              fontSize:13,display:"flex",alignItems:"center",gap:5,
              marginBottom:16,padding:0,fontFamily:"inherit",transition:"color .15s",
            }}
            onMouseEnter={e=>e.currentTarget.style.color=t.text}
            onMouseLeave={e=>e.currentTarget.style.color=t.textSub}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              {isAr?"رجوع":"Back to sign in"}
            </button>

            {sent ? (
              /* Success state */
              <div style={{textAlign:"center",padding:"24px 0"}}>
                <div style={{
                  width:56,height:56,borderRadius:"50%",margin:"0 auto 16px",
                  background:"rgba(34,197,94,.1)",border:"2px solid rgba(34,197,94,.3)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  animation:"popIn .4s cubic-bezier(.34,1.56,.64,1)",
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div style={{fontSize:18,fontWeight:700,color:t.text,marginBottom:8}}>
                  {isAr?"تحقق من بريدك":"Check your email"}
                </div>
                <div style={{fontSize:13.5,color:t.textSub,lineHeight:1.6,marginBottom:20}}>
                  {ok}
                </div>
                <button onClick={()=>{setSent(false);setOk("");}} style={{
                  background:"none",border:`1px solid ${t.border}`,
                  borderRadius:9,padding:"10px 24px",fontSize:13.5,
                  fontWeight:500,color:t.textSub,cursor:"pointer",
                  fontFamily:"inherit",transition:"all .15s",
                }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=t.acc}
                onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
                  {isAr?"إعادة الإرسال":"Resend email"}
                </button>
              </div>
            ) : (
              <>
                <div style={{fontSize:19,fontWeight:700,color:t.text,marginBottom:6}}>
                  {isAr?"نسيت كلمة المرور؟":"Forgot password?"}
                </div>
                <div style={{fontSize:13.5,color:t.textSub,marginBottom:22,lineHeight:1.6}}>
                  {isAr?"أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"
                       :"No worries. Enter your email and we'll send you a reset link."}
                </div>
                <form onSubmit={handleForgot} noValidate>
                  <FloatInput id="f-email" label={isAr?"البريد الإلكتروني":"Email address"}
                    type="email" value={email} onChange={v=>{setEmail(v);touch("email");}}
                    autoComplete="email" required dark={dark} isRtl={isAr}
                    error={fieldErr.email} valid={emailValid&&touched.email}/>
                  {err&&<div ref={errRef}><AlertBox msg={err} dark={dark}/></div>}
                  <PrimaryBtn loading={loading} disabled={busy} dark={dark}>
                    {loading
                      ? <Spinner dark={dark}/>
                      : (isAr?"إرسال رابط إعادة التعيين":"Send reset link")}
                  </PrimaryBtn>
                </form>
              </>
            )}
          </>
        )}

        {/* ── LOGIN / SIGNUP VIEW ─────────────────────────────────── */}
        {view!=="forgot" && (
          <>
            {/* Tab switcher */}
            <div style={{
              display:"flex",background:t.faint,
              border:`1px solid ${t.border}`,
              borderRadius:11,padding:4,marginBottom:24,gap:4,
            }}>
              {[
                ["login",  isAr?"تسجيل الدخول":"Sign In"],
                ["signup", isAr?"إنشاء حساب":"Sign Up"],
              ].map(([v,l])=>(
                <button key={v} onClick={()=>go(v)} style={{
                  flex:1,padding:"9px 0",fontSize:13.5,fontWeight:600,
                  color:view===v?"#fff":t.textSub,
                  background:view===v?t.tabAct:"transparent",
                  border:"none",borderRadius:8,cursor:"pointer",
                  transition:"all .25s cubic-bezier(.4,0,.2,1)",
                  fontFamily:"inherit",
                  boxShadow:view===v?t.tabActS:"none",
                }}>{l}</button>
              ))}
            </div>

            {/* Heading */}
            <div style={{marginBottom:view==="signup"?16:20}}>
              <h1 style={{fontSize:20,fontWeight:800,color:t.text,letterSpacing:"-.02em",margin:0,marginBottom:4,textAlign:"center"}}>
                {view==="signup"
                  ?(isAr?"ابدأ مجاناً":"Start for free")
                  :(isAr?"أهلاً بعودتك":"Welcome back")}
              </h1>
              {view==="signup" ? (
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                  background:"rgba(16,217,160,.08)",border:"1px solid rgba(16,217,160,.18)",
                  borderRadius:99,padding:"5px 14px",margin:"10px auto 0",width:"fit-content"}}>
                  <span style={{width:5,height:5,borderRadius:"50%",background:"#10d9a0",flexShrink:0}}/>
                  <span style={{fontSize:11.5,color:"#10d9a0",fontWeight:600}}>
                    {isAr?"7 أيام مجانية · بدون بطاقة بنكية":"7-day free trial · No credit card"}
                  </span>
                </div>
              ) : (
                <p style={{fontSize:13,color:t.textSub,margin:0,textAlign:"center"}}>
                  {isAr?"سجّل دخول للمتابعة من حيث توقفت":"Sign in to continue where you left off"}
                </p>
              )}
            </div>

            {/* Role tabs — signup only */}
            {view==="signup" && (
              <div style={{
                display:"flex",background:t.faint,
                border:`1px solid ${t.border}`,
                borderRadius:10,padding:3,marginBottom:16,gap:3,
              }}>
                {[
                  {id:"individual", en:"👤 Individual", ar:"👤 فردي"},
                  {id:"company",    en:"🏢 Company / HR", ar:"🏢 شركات وفرق"},
                ].map(m=>(
                  <button key={m.id} style={{
                    flex:1,padding:"7px 4px",border:"none",borderRadius:7,
                    fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                    background:"transparent",color:t.muted,
                    transition:"all .2s",
                  }}>
                    {isAr?m.ar:m.en}
                  </button>
                ))}
              </div>
            )}

            {/* Social buttons — TOP (industry standard: Google first) */}
            <div style={{display:"flex",gap:10,marginBottom:14}}>
              <SocialBtn
                icon={<svg width="17" height="17" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>}
                label={isAr?"Google":"Google"}
                onClick={()=>withSocial("google",signInGoogle)}
                loading={social==="google"} disabled={busy} dark={dark}/>
              <SocialBtn
                icon={<svg width="17" height="17" viewBox="0 0 24 24">
                  <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                  <rect x="13" y="1" width="10" height="10" fill="#7fba00"/>
                  <rect x="1" y="13" width="10" height="10" fill="#00a4ef"/>
                  <rect x="13" y="13" width="10" height="10" fill="#ffb900"/>
                </svg>}
                label={isAr?"مايكروسوفت":"Microsoft"}
                onClick={()=>withSocial("microsoft",signInMicrosoft)}
                loading={social==="microsoft"} disabled={busy} dark={dark}/>
            </div>

            {/* Divider */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
              <div style={{flex:1,height:1,background:t.divider}}/>
              <span style={{fontSize:11.5,color:t.muted,whiteSpace:"nowrap"}}>
                {isAr?"أو بالبريد الإلكتروني":"or with email"}
              </span>
              <div style={{flex:1,height:1,background:t.divider}}/>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              {view==="signup" && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:0}}>
                  <FloatInput id="fname" label={isAr?"الاسم الأول":"First name"}
                    value={fname} onChange={v=>{setFname(v);touch("fname");}}
                    autoComplete="given-name" required dark={dark} isRtl={isAr}
                    error={fieldErr.fname} valid={fnameValid&&touched.fname}/>
                  <FloatInput id="lname" label={isAr?"اسم العائلة":"Last name"}
                    value={lname} onChange={v=>{setLname(v);touch("lname");}}
                    autoComplete="family-name" required dark={dark} isRtl={isAr}
                    error={fieldErr.lname} valid={lnameValid&&touched.lname}/>
                </div>
              )}

              <FloatInput id="email" label={isAr?"البريد الإلكتروني":"Email address"}
                type="email" value={email} onChange={v=>{setEmail(v);touch("email");}}
                autoComplete="email" required dark={dark} isRtl={isAr}
                error={fieldErr.email} valid={emailValid&&touched.email}/>

              <FloatInput id="pass" label={isAr?"كلمة المرور":"Password"}
                type={showP?"text":"password"} value={pass}
                onChange={v=>{setPass(v);touch("pass");}}
                autoComplete={view==="login"?"current-password":"new-password"}
                required dark={dark} isRtl={isAr}
                error={fieldErr.pass} valid={passValid&&touched.pass}
                rightEl={eyeBtn(showP,()=>setShowP(v=>!v))}
                hint={capsLock?(isAr?"⚠️ Caps Lock مفعّل":"⚠️ Caps Lock is on"):undefined}/>

              {view==="signup" && (
                <>
                  <PwStrength pass={pass} dark={dark} isAr={isAr}/>
                  <FloatInput id="pass2" label={isAr?"تأكيد كلمة المرور":"Confirm password"}
                    type={showP2?"text":"password"} value={pass2}
                    onChange={v=>{setPass2(v);touch("pass2");}}
                    autoComplete="new-password" required dark={dark} isRtl={isAr}
                    error={fieldErr.pass2} valid={pass2Valid&&touched.pass2}
                    rightEl={eyeBtn(showP2,()=>setShowP2(v=>!v))}/>

                  {/* Country */}
                  <div style={{marginBottom:fieldErr.country?4:16}}>
                    <label style={{display:"block",marginBottom:6,fontSize:11.5,fontWeight:600,
                      color:t.textSub,letterSpacing:".06em",textTransform:"uppercase"}}>
                      {isAr?"الدولة":"Country"} *
                    </label>
                    <select value={country} onChange={e=>{setCountry(e.target.value);touch("country");}}
                      required
                      style={{width:"100%",padding:"13px 14px",
                        background:t.card,border:`1.5px solid ${fieldErr.country?"rgba(239,68,68,.5)":t.border}`,
                        borderRadius:10,fontSize:14.5,color:country?t.text:t.textSub,
                        outline:"none",fontFamily:"inherit",cursor:"pointer",
                        boxSizing:"border-box",appearance:"none",
                        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                        backgroundRepeat:"no-repeat",
                        backgroundPosition:isAr?"12px center":"calc(100% - 12px) center",
                      }}>
                      <option value="">{isAr?"اختر الدولة":"Select country"}</option>
                      {[
                        ["EG","🇪🇬 مصر / Egypt"],["SA","🇸🇦 السعودية / Saudi Arabia"],
                        ["AE","🇦🇪 الإمارات / UAE"],["KW","🇰🇼 الكويت / Kuwait"],
                        ["QA","🇶🇦 قطر / Qatar"],["BH","🇧🇭 البحرين / Bahrain"],
                        ["OM","🇴🇲 عُمان / Oman"],["JO","🇯🇴 الأردن / Jordan"],
                        ["LB","🇱🇧 لبنان / Lebanon"],["IQ","🇮🇶 العراق / Iraq"],
                        ["MA","🇲🇦 المغرب / Morocco"],["DZ","🇩🇿 الجزائر / Algeria"],
                        ["TN","🇹🇳 تونس / Tunisia"],["LY","🇱🇾 ليبيا / Libya"],
                        ["SY","🇸🇾 سوريا / Syria"],["YE","🇾🇪 اليمن / Yemen"],
                        ["SD","🇸🇩 السودان / Sudan"],["US","🇺🇸 United States"],
                        ["GB","🇬🇧 United Kingdom"],["DE","🇩🇪 Germany"],
                        ["FR","🇫🇷 France"],["other","🌍 Other"],
                      ].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                    {fieldErr.country&&<div style={{fontSize:11.5,color:dark?"#f87171":"#ef4444",marginTop:4,paddingLeft:4}}>{fieldErr.country}</div>}
                  </div>

                  {/* Profession */}
                  <div style={{marginBottom:16}}>
                    <label style={{display:"block",marginBottom:6,fontSize:11.5,fontWeight:600,
                      color:t.textSub,letterSpacing:".06em",textTransform:"uppercase"}}>
                      {isAr?"المهنة":"Profession"} <span style={{opacity:.5}}>{isAr?"(اختياري)":"(optional)"}</span>
                    </label>
                    <select value={profession} onChange={e=>setProfession(e.target.value)}
                      style={{width:"100%",padding:"13px 14px",
                        background:t.card,border:`1.5px solid ${t.border}`,
                        borderRadius:10,fontSize:14.5,color:profession?t.text:t.textSub,
                        outline:"none",fontFamily:"inherit",cursor:"pointer",
                        boxSizing:"border-box",appearance:"none",
                        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                        backgroundRepeat:"no-repeat",
                        backgroundPosition:isAr?"12px center":"calc(100% - 12px) center",
                      }}>
                      <option value="">{isAr?"اختر مهنتك":"Select your profession"}</option>
                      {[
                        isAr?["software_eng","مهندس برمجيات"]:["software_eng","Software Engineer"],
                        isAr?["doctor","طبيب"]:["doctor","Doctor / Healthcare"],
                        isAr?["hr","موارد بشرية"]:["hr","HR Professional"],
                        isAr?["manager","مدير"]:["manager","Manager / Team Lead"],
                        isAr?["student","طالب"]:["student","Student"],
                        isAr?["designer","مصمم"]:["designer","Designer"],
                        isAr?["accountant","محاسب"]:["accountant","Accountant / Finance"],
                        isAr?["teacher","معلم"]:["teacher","Teacher / Educator"],
                        isAr?["other","أخرى"]:["other","Other"],
                      ].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>

                  {/* Terms — links open mailto instead of void href (#1 fix) */}
                  <div style={{marginBottom:12}}>
                    <label style={{display:"flex",alignItems:"flex-start",gap:11,cursor:"pointer",userSelect:"none",
                      padding:"11px 13px",borderRadius:10,
                      background:fieldErr.terms?"rgba(239,68,68,.05)":agreeTerms?"rgba(26,86,219,.04)":"transparent",
                      border:`1.5px solid ${fieldErr.terms?"rgba(239,68,68,.45)":agreeTerms?"rgba(26,86,219,.3)":t.border}`,
                      transition:"all .2s"}}>
                      <div onClick={()=>{setAgreeTerms(v=>!v);touch("terms");}} style={{
                        width:20,height:20,borderRadius:5,flexShrink:0,marginTop:1,
                        background:agreeTerms?t.accBtn:"transparent",
                        border:`2px solid ${fieldErr.terms?"rgba(239,68,68,.6)":agreeTerms?t.acc:t.border}`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        transition:"all .15s",cursor:"pointer",
                        boxShadow:agreeTerms?`0 0 0 3px ${dark?"rgba(26,86,219,.2)":"rgba(26,86,219,.1)"}`:undefined,
                      }}>
                        {agreeTerms&&<svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <polyline points="2 6 5 9 10 3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>}
                      </div>
                      <span style={{fontSize:13,color:t.textSub,lineHeight:1.55}}>
                        {isAr?"أوافق على":"I agree to the"}{" "}
                        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Terms of Service")}`}
                          style={{color:t.acc,textDecoration:"none",fontWeight:600}}>
                          {isAr?"شروط الاستخدام":"Terms of Service"}
                        </a>
                        {" "}{isAr?"و":"and"}{" "}
                        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Privacy Policy")}`}
                          style={{color:t.acc,textDecoration:"none",fontWeight:600}}>
                          {isAr?"سياسة الخصوصية":"Privacy Policy"}
                        </a>
                        <span style={{color:"#ef4444",marginLeft:2}}>*</span>
                      </span>
                    </label>
                    {fieldErr.terms&&<div style={{fontSize:11.5,color:"#ef4444",marginTop:5,paddingLeft:4,display:"flex",alignItems:"center",gap:4}}>
                      <span>⚠</span>{fieldErr.terms}
                    </div>}
                  </div>

                  {/* Newsletter — #8 fix: full label is clickable */}
                  <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",userSelect:"none",marginBottom:4}}>
                    <input type="checkbox" checked={newsletter} onChange={e=>setNewsletter(e.target.checked)}
                      style={{width:17,height:17,accentColor:t.acc,cursor:"pointer",flexShrink:0}}/>
                    <span style={{fontSize:12.5,color:t.textSub}}>
                      {isAr?"أريد تلقي نصائح وتحديثات الوضعية":"Send me posture tips and product updates"}
                    </span>
                  </label>
                </>
              )}

              {/* Remember me — #8 fix: full label clickable via native input */}
              {view==="login" && (
                <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,cursor:"pointer",userSelect:"none"}}>
                  <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}
                    style={{width:16,height:16,accentColor:t.acc,cursor:"pointer",flexShrink:0}}/>
                  <span style={{fontSize:13,color:t.textSub}}>
                    {isAr?"تذكرني على هذا الجهاز":"Remember me on this device"}
                  </span>
                </label>
              )}

              {/* Forgot link */}
              {view==="login" && (
                <div style={{textAlign:isAr?"left":"right",marginBottom:16,marginTop:-8}}>
                  <button type="button" onClick={()=>go("forgot")} style={{
                    background:"none",border:"none",fontSize:12.5,
                    color:t.acc,cursor:"pointer",padding:0,
                    fontFamily:"inherit",transition:"opacity .15s",
                  }}
                  onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
                  onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                    {isAr?"نسيت كلمة المرور؟":"Forgot password?"}
                  </button>
                </div>
              )}

              {err&&<div ref={errRef}><AlertBox msg={err} dark={dark}/></div>}

              {/* Submit */}
              <button type="submit" disabled={busy} style={{
                width:"100%",padding:"13px 0",marginBottom:16,
                background:busy?"rgba(26,86,219,.4)":t.accBtn,
                border:"none",borderRadius:10,
                fontSize:14.5,fontWeight:700,color:"#fff",
                cursor:busy?"wait":"pointer",
                boxShadow:busy?"none":"0 6px 24px rgba(26,86,219,.28)",
                transition:"all .25s cubic-bezier(.4,0,.2,1)",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                fontFamily:"inherit", letterSpacing:".01em",
              }}
              onMouseEnter={e=>{if(!busy){e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 10px 32px rgba(26,86,219,.38)";}}}
              onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=busy?"none":"0 6px 24px rgba(26,86,219,.28)";}}>
                {loading
                  ? <div style={{width:17,height:17,border:"2.5px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                  : view==="login"
                    ? (isAr?"تسجيل الدخول →":"Sign In →")
                    : (isAr?"إنشاء الحساب →":"Create Account →")}
              </button>
            </form>

          </>
        )}

        {/* Footer */}
        <div style={{textAlign:"center",marginTop:20,fontSize:12,color:t.muted}}>
          {isAr?"للدعم التقني:":"Need help?"}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{
            color:t.acc,textDecoration:"none",fontWeight:500,
            transition:"opacity .15s",
          }}
          onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
          onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>

      {/* Global styles */}
      <style>{`
        @keyframes spin      { to { transform: rotate(360deg) } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:none } }
        @keyframes popIn     { from { opacity:0; transform:scale(.6) } to { opacity:1; transform:scale(1) } }
        @keyframes logoAnim  { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-5px) rotate(4deg)} }
        @keyframes orbFloat0 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,30px) scale(1.05)} }
        @keyframes orbFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-35px,20px) scale(.95)} }
        @keyframes orbFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(25px,-30px) scale(1.03)} }
        input::placeholder   { color:${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.22)"}!important }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px ${dark?"#0d1829":"#f0f4ff"} inset !important;
          -webkit-text-fill-color: ${dark?"#f0f6ff":"#0f172a"} !important;
        }
        * { box-sizing:border-box; margin:0; padding:0 }
        button:focus-visible, input:focus-visible { outline:2px solid ${t.acc}; outline-offset:2px }
        h1,h2,p { margin:0 }
      `}</style>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────
function AlertBox({msg,dark}){
  return(
    <div role="alert" style={{
      background:dark?"rgba(239,68,68,.08)":"rgba(239,68,68,.05)",
      border:"1px solid rgba(239,68,68,.2)",
      borderRadius:9,padding:"11px 14px",marginBottom:14,
      fontSize:13,color:dark?"#f87171":"#dc2626",
      display:"flex",gap:8,alignItems:"flex-start",
      animation:"slideDown .2s ease",
    }}>
      <span style={{flexShrink:0,marginTop:1}}>⚠️</span>
      <span>{msg}</span>
    </div>
  );
}
function Spinner(){
  return <div style={{width:17,height:17,border:"2.5px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>;
}
function PrimaryBtn({children,loading,disabled,dark,onClick,type="submit"}){
  const [hov,setHov]=useState(false);
  return(
    <button type={type} onClick={onClick} disabled={disabled||loading}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        width:"100%",padding:"13px 0",marginBottom:16,
        background:(disabled||loading)?"rgba(26,86,219,.4)":
          hov?"linear-gradient(135deg,#1e40af 0%,#0369a1 100%)":
          "linear-gradient(135deg,#1d4ed8 0%,#0891b2 100%)",
        border:"none",borderRadius:10,
        fontSize:14.5,fontWeight:700,color:"#fff",
        cursor:(disabled||loading)?"wait":"pointer",
        boxShadow:(disabled||loading)?"none":
          hov?"0 10px 32px rgba(26,86,219,.38)":"0 6px 24px rgba(26,86,219,.28)",
        transition:"all .25s cubic-bezier(.4,0,.2,1)",
        display:"flex",alignItems:"center",justifyContent:"center",gap:8,
        fontFamily:"inherit",letterSpacing:".01em",
        transform:hov&&!(disabled||loading)?"translateY(-1px)":"none",
      }}>
      {loading ? <Spinner/> : children}
    </button>
  );
}
