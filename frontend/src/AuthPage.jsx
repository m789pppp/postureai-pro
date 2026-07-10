/**
 * Corvus AuthPage v4 — Clean rebuild
 * Individual vs Company fully separated
 * All Firestore fields consistent with role detection
 */
import { useState, useCallback, useEffect, useRef } from "react";
import {
  signInGoogle, signInMicrosoft, signInEmail, signUpEmail, resetPassword,
  getUserProfile, createUserProfile, SUPPORT_EMAIL, setRememberMe,
  deleteAuthUser,
} from "./firebase.js";

// ── Error messages ──────────────────────────────────────────────────
function getErr(err, isAr) {
  const msg  = typeof err === "string" ? err : (err?.message || "");
  const code = typeof err === "object" && err?.code
    ? String(err.code).replace(/^auth\//, "")
    : (msg.match(/\(auth\/([^)]+)\)/)?.[1] || "");
  const map = {
    "wrong-password":        {en:"Incorrect email or password",ar:"البريد أو كلمة المرور غلط"},
    "invalid-credential":    {en:"Incorrect email or password",ar:"البريد أو كلمة المرور غلط"},
    "user-not-found":        {en:"Incorrect email or password",ar:"البريد أو كلمة المرور غلط"},
    "email-already-in-use":  {en:"An account with this email already exists",ar:"البريد مسجّل بالفعل"},
    "weak-password":         {en:"Password must be at least 6 characters",ar:"كلمة المرور 6 أحرف على الأقل"},
    "too-many-requests":     {en:"Too many attempts. Try again in a few minutes.",ar:"محاولات كثيرة. انتظر دقائق."},
    "network-request-failed":{en:"Connection error. Check your internet.",ar:"خطأ في الاتصال. تحقق من الإنترنت."},
    "invalid-email":         {en:"Please enter a valid email address",ar:"أدخل بريداً إلكترونياً صحيحاً"},
    "popup-closed-by-user":  {en:"Sign-in was cancelled",ar:"تم إلغاء تسجيل الدخول"},
    "popup-blocked":         {en:"Popup blocked — allow popups for this site",ar:"المتصفح حجب النافذة — اسمح بالـ popups"},
    "account-exists-with-different-credential": {en:"This email is linked to a different sign-in method",ar:"هذا البريد مرتبط بطريقة دخول مختلفة"},
  };
  console.error("[Auth]", { code: code||"(none)", message: msg });
  const e = map[code] || map[Object.keys(map).find(k=>code.includes(k))||""];
  if (e) return e[isAr?"ar":"en"];
  return (isAr?"حدث خطأ. حاول مرة أخرى.":"An error occurred. Please try again.") + (code?` (${code})`:"");
}

// ── Password helpers ────────────────────────────────────────────────
function pwScore(p) {
  if (!p) return 0;
  return [p.length>=8, /[A-Z]/.test(p), /[a-z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
}

// ── Rate limiter ────────────────────────────────────────────────────
const _rl = {c:0,t:0};
function rateOk() {
  const now = Date.now();
  if (now - _rl.t > 60000) { _rl.c=0; _rl.t=now; }
  return ++_rl.c <= 8;
}

// ── Mesh background ─────────────────────────────────────────────────
function MeshBg({ dark }) {
  return (
    <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
      <div style={{
        position:"absolute",inset:0,
        background: dark
          ? "radial-gradient(ellipse 80% 60% at 20% 10%,rgba(26,86,219,.12) 0%,transparent 60%),radial-gradient(ellipse 60% 50% at 80% 90%,rgba(8,145,178,.08) 0%,transparent 60%),#030b14"
          : "radial-gradient(ellipse 80% 60% at 20% 10%,rgba(219,234,254,.8) 0%,transparent 60%),radial-gradient(ellipse 60% 50% at 80% 90%,rgba(186,230,253,.6) 0%,transparent 60%),#f0f4ff",
      }}/>
    </div>
  );
}

// ── Social button ───────────────────────────────────────────────────
function SocialBtn({ icon, label, onClick, loading, disabled, dark, t }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={disabled||loading}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
        padding:"11px 12px",fontFamily:"inherit",
        background:hov?(dark?"rgba(255,255,255,.07)":"rgba(26,86,219,.05)"):(dark?"rgba(255,255,255,.04)":"#ffffff"),
        border:`1.5px solid ${hov?(dark?"rgba(255,255,255,.15)":"rgba(26,86,219,.25)"):(dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.1)")}`,
        borderRadius:10,fontSize:13.5,fontWeight:500,
        color:dark?"rgba(255,255,255,.8)":"#374151",
        cursor:(disabled||loading)?"not-allowed":"pointer",
        transition:"all .2s",opacity:(disabled&&!loading)?.5:1,
      }}>
      {loading
        ? <div style={{width:16,height:16,border:"2px solid rgba(100,100,100,.2)",borderTopColor:dark?"#fff":"#1a56db",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
        : icon}
      <span>{label}</span>
    </button>
  );
}

// ── Password strength ───────────────────────────────────────────────
function PwStrength({ pass, dark, isAr }) {
  const score = pwScore(pass);
  const colors = ["","#ef4444","#f97316","#eab308","#22c55e","#16a34a"];
  const labels = {en:["","Weak","Fair","Good","Strong","Excellent"],ar:["","ضعيفة","مقبولة","جيدة","قوية","ممتازة"]};
  if (!pass) return null;
  const col = colors[Math.min(score,5)];
  return (
    <div style={{marginBottom:12,padding:"10px 12px",
      background:dark?"rgba(255,255,255,.03)":"rgba(0,0,0,.02)",
      border:`1px solid ${dark?"rgba(255,255,255,.07)":"rgba(0,0,0,.06)"}`,borderRadius:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
        <span style={{fontSize:11,color:dark?"rgba(255,255,255,.4)":"#94a3b8"}}>{isAr?"قوة كلمة المرور":"Password strength"}</span>
        <span style={{fontSize:11.5,fontWeight:700,color:col}}>{labels[isAr?"ar":"en"][Math.min(score,5)]}</span>
      </div>
      <div style={{display:"flex",gap:3}}>
        {[1,2,3,4,5].map(i=>(
          <div key={i} style={{flex:1,height:4,borderRadius:99,
            background:i<=score?col:(dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"),
            transition:`background .25s ease ${i*.04}s`}}/>
        ))}
      </div>
    </div>
  );
}

// ── Alert box ───────────────────────────────────────────────────────
function AlertBox({ msg, dark }) {
  return (
    <div role="alert" style={{
      background:dark?"rgba(239,68,68,.08)":"rgba(239,68,68,.05)",
      border:"1px solid rgba(239,68,68,.2)",borderRadius:9,
      padding:"11px 14px",marginBottom:14,fontSize:13,
      color:dark?"#f87171":"#dc2626",display:"flex",gap:8,alignItems:"flex-start",
      animation:"slideDown .2s ease",
    }}>
      <span style={{flexShrink:0}}>⚠️</span><span>{msg}</span>
    </div>
  );
}

// ── Eye button ──────────────────────────────────────────────────────
function EyeBtn({ show, toggle, dark }) {
  return (
    <button type="button" onClick={toggle} tabIndex={-1}
      style={{background:"none",border:"none",color:dark?"rgba(255,255,255,.35)":"#94a3b8",
        cursor:"pointer",fontSize:15,padding:"2px",lineHeight:1,display:"flex"}}>
      {show
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </button>
  );
}

// ── Styled select ────────────────────────────────────────────────────
function Select({ label, value, onChange, options, required, error, dark, t, placeholder }) {
  return (
    <div style={{marginBottom:fieldErrMb(error)}}>
      <label style={{display:"block",marginBottom:6,fontSize:11.5,fontWeight:600,
        color:t.textSub,letterSpacing:".06em",textTransform:"uppercase"}}>
        {label}{required&&<span style={{color:"#ef4444",marginLeft:3}}>*</span>}
      </label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{width:"100%",padding:"13px 14px",background:t.card,
          border:`1.5px solid ${error?"rgba(239,68,68,.5)":t.border}`,
          borderRadius:10,fontSize:14,color:value?t.text:t.textSub,
          outline:"none",fontFamily:"inherit",cursor:"pointer",appearance:"none",
          backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat:"no-repeat",backgroundPosition:"calc(100% - 12px) center",
          boxSizing:"border-box"}}>
        <option value="">{placeholder}</option>
        {options.map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
      {error&&<div style={{fontSize:11.5,color:"#f87171",marginTop:4}}>{error}</div>}
    </div>
  );
}
const fieldErrMb = e => e ? 4 : 14;

// ── FloatInput ──────────────────────────────────────────────────────
function FloatInput({ id, label, type="text", value, onChange, autoComplete,
  required, disabled, error, valid, rightEl, dark, isRtl, t }) {
  const [focused, setFocused] = useState(false);
  const active = focused || !!value;
  const borderColor = error?"rgba(239,68,68,.5)":valid?"rgba(34,197,94,.5)":focused?"#3b82f6":t.border;
  return (
    <div style={{position:"relative",marginBottom:error?4:14}}>
      <label htmlFor={id} style={{
        position:"absolute",[isRtl?"right":"left"]:14,
        top:active?7:"50%",transform:active?"none":"translateY(-50%)",
        fontSize:active?10.5:14,fontWeight:active?600:400,
        color:error?"#f87171":valid?"#4ade80":focused?"#3b82f6":t.muted,
        transition:"all .18s cubic-bezier(.4,0,.2,1)",
        pointerEvents:"none",zIndex:1,
        letterSpacing:active?".04em":0,textTransform:active?"uppercase":"none",
      }}>{label}</label>
      <input id={id} type={type} value={value} required={required} disabled={disabled}
        autoComplete={autoComplete}
        onChange={e=>onChange(e.target.value)}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        dir={isRtl?"rtl":"ltr"}
        style={{
          width:"100%",paddingTop:22,paddingBottom:9,
          paddingLeft:isRtl?(rightEl?44:14):14,
          paddingRight:isRtl?14:(rightEl?44:14),
          background:focused?(dark?"rgba(26,86,219,.07)":"rgba(59,130,246,.03)"):t.card,
          border:`1.5px solid ${borderColor}`,
          borderRadius:10,fontSize:14.5,color:t.text,
          outline:"none",transition:"all .2s",
          boxSizing:"border-box",fontFamily:"inherit",
          boxShadow:focused?`0 0 0 3px ${dark?"rgba(59,130,246,.12)":"rgba(26,86,219,.08)"}`:undefined,
        }}/>
      {rightEl&&<div style={{position:"absolute",[isRtl?"left":"right"]:12,top:"50%",transform:"translateY(-50%)"}}>{rightEl}</div>}
      {valid&&!error&&<div style={{position:"absolute",[isRtl?"left":"right"]:rightEl?44:12,top:"50%",transform:"translateY(-50%)",color:"#4ade80",fontSize:14,fontWeight:700}}>✓</div>}
      {error&&<div style={{fontSize:11.5,color:dark?"#f87171":"#ef4444",marginTop:4,paddingLeft:isRtl?0:4}}>{error}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════
export default function AuthPage({ darkMode, setDarkMode, lang, setLang, onAuth, initialView }) {
  const isAr = lang === "ar";
  const dark = darkMode;

  // ── State ──────────────────────────────────────────────────────────
  const [view,        setView]       = useState(initialView||"login");
  const [acctType,    setAcctType]   = useState("individual"); // "individual" | "company"
  const [email,       setEmail]      = useState("");
  const [pass,        setPass]       = useState("");
  const [pass2,       setPass2]      = useState("");
  const [fname,       setFname]      = useState("");
  const [lname,       setLname]      = useState("");
  // Individual fields
  const [country,     setCountry]    = useState("");
  const [profession,  setProfession] = useState("");
  // Company fields
  const [companyName, setCompanyName]= useState("");
  const [teamSize,    setTeamSize]   = useState("");
  const [companyRole, setCompanyRole]= useState("hr_admin"); // "hr_admin"|"employee"
  // UI
  const [agreeTerms,  setAgreeTerms] = useState(false);
  const [newsletter,  setNewsletter] = useState(true);
  const [showP,       setShowP]      = useState(false);
  const [showP2,      setShowP2]     = useState(false);
  const [remember,    setRemember]   = useState(true);
  const [loading,     setLoading]    = useState(false);
  const [social,      setSocial]     = useState("");
  const [err,         setErr]        = useState("");
  const [ok,          setOk]         = useState("");
  const [sent,        setSent]       = useState(false);
  const [touched,     setTouched]    = useState({});
  const [mounted,     setMounted]    = useState(false);
  const [shake,       setShake]      = useState(false);
  const errRef = useRef(null);

  const isCompany = acctType === "company";
  const busy = loading || !!social;

  useEffect(()=>{const t=setTimeout(()=>setMounted(true),60);return()=>clearTimeout(t);},[]);
  // Reset on account type change
  useEffect(()=>{
    setErr(""); setTouched({});
    setCompanyName(""); setTeamSize(""); setProfession(""); setCountry("");
    setCompanyRole("hr_admin");
  },[acctType]);

  const doShake = ()=>{ setShake(true); setTimeout(()=>setShake(false),600); };
  const go = v => { setView(v); setErr(""); setOk(""); setSent(false); setTouched({}); };
  const touch = k => setTouched(p=>({...p,[k]:true}));

  // ── Validation ─────────────────────────────────────────────────────
  const emailValid   = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const passValid    = pass.length >= 6;
  const pass2Valid   = pass === pass2 && pass2.length > 0;
  const fnameValid   = fname.trim().length >= 1;
  const lnameValid   = lname.trim().length >= 1;
  const termsValid   = agreeTerms;
  // Individual specific
  const countryValid = !isCompany ? country.length > 0 : true;
  // Company specific
  const companyValid   = isCompany ? companyName.trim().length >= 2 : true;
  const teamSizeValid  = isCompany ? teamSize.length > 0 : true;

  const fieldErr = {
    email:       touched.email       && !emailValid    ? (isAr?"أدخل بريداً صحيحاً":"Enter a valid email") : "",
    pass:        touched.pass        && !passValid     ? (isAr?"6 أحرف على الأقل":"At least 6 characters") : "",
    pass2:       touched.pass2       && !pass2Valid    ? (isAr?"كلمتا المرور غير متطابقتين":"Passwords don't match") : "",
    fname:       touched.fname       && !fnameValid    ? (isAr?"الاسم الأول مطلوب":"First name required") : "",
    lname:       touched.lname       && !lnameValid    ? (isAr?"اسم العائلة مطلوب":"Last name required") : "",
    terms:       touched.terms       && !termsValid    ? (isAr?"يجب الموافقة على الشروط":"You must agree to the terms") : "",
    country:     touched.country     && !countryValid  ? (isAr?"اختر الدولة":"Select your country") : "",
    companyName: touched.companyName && !companyValid  ? (isAr?"اسم الشركة مطلوب":"Company name required") : "",
    teamSize:    touched.teamSize    && !teamSizeValid ? (isAr?"اختر حجم الفريق":"Select team size") : "",
  };

  // ── Build Firestore profile ─────────────────────────────────────────
  // Single source of truth — used by both email and social signup
  const buildProfile = (user, displayName) => {
    const name = displayName || `${fname.trim()} ${lname.trim()}`.trim();
    const base = {
      email:          user.email || email.trim(),
      name,
      first_name:     fname.trim() || name.split(" ")[0] || "",
      last_name:      lname.trim() || name.split(" ").slice(1).join(" ") || "",
      newsletter,
      setup_complete: false,
    };
    if (isCompany) {
      return {
        ...base,
        acct_type:    "company",
        account_type: "company",
        user_type:    companyRole,           // "hr_admin" or "employee"
        is_org_owner: companyRole === "hr_admin",
        is_hr:        companyRole === "hr_admin",
        company:      companyName.trim(),
        team_size:    teamSize,
        country:      "",
        profession:   "",
      };
    } else {
      return {
        ...base,
        acct_type:    "individual",
        account_type: "individual",
        user_type:    "individual",
        is_org_owner: false,
        is_hr:        false,
        company:      "",
        team_size:    "",
        country,
        profession:   profession.trim(),
      };
    }
  };

  // ── Social auth ─────────────────────────────────────────────────────
  const withSocial = async (key, fn) => {
    if (!rateOk()) { setErr(isAr?"انتظر دقيقة":"Too many attempts — wait"); return; }
    setErr(""); setSocial(key);
    try {
      const r = await fn();
      if (!r) return;
      try {
        const existing = await getUserProfile(r.user.uid);
        if (!existing) {
          await createUserProfile(r.user.uid, buildProfile(r.user, r.user.displayName));
        }
      } catch(profileErr) {
        console.warn("[Auth] social profile error (non-fatal):", profileErr?.message);
      }
      onAuth(r.user, false);
    } catch(e) { setErr(getErr(e,isAr)); doShake(); }
    finally { setSocial(""); }
  };

  // ── Email submit ────────────────────────────────────────────────────
  const handleSubmit = useCallback(async e => {
    e.preventDefault();
    if (view==="login") {
      setTouched({email:true,pass:true});
      if (!emailValid||!passValid) { doShake(); return; }
    } else {
      const allTouched = {email:true,pass:true,pass2:true,fname:true,lname:true,terms:true,
        ...(isCompany?{companyName:true,teamSize:true}:{country:true})};
      setTouched(allTouched);
      const valid = emailValid&&passValid&&pass2Valid&&fnameValid&&lnameValid&&termsValid
        &&companyValid&&teamSizeValid&&countryValid;
      if (!valid) { doShake(); return; }
    }
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
          await createUserProfile(c.user.uid, buildProfile(c.user));
        } catch(profileErr) {
          console.error("[Auth] profile creation failed:", profileErr?.message);
          try { await deleteAuthUser(); } catch {}
          throw profileErr;
        }
        onAuth(c.user, true);
      }
    } catch(e) {
      setErr(getErr(e,isAr)); doShake();
      setPass(""); setPass2(""); setShowP(false); setShowP2(false);
    } finally { setLoading(false); }
  },[view,email,pass,pass2,fname,lname,emailValid,passValid,pass2Valid,fnameValid,lnameValid,
     termsValid,companyValid,teamSizeValid,countryValid,isCompany,isAr,onAuth,remember,
     companyName,teamSize,profession,country,companyRole,newsletter,acctType]);

  // ── Forgot password ─────────────────────────────────────────────────
  const handleForgot = useCallback(async e => {
    e.preventDefault();
    setTouched({email:true});
    if (!emailValid) { doShake(); return; }
    if (!rateOk()) { setErr(isAr?"انتظر دقيقة":"Too many attempts"); return; }
    setErr(""); setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
      setOk(isAr?`تم إرسال رابط إعادة التعيين إلى ${email}`:`Reset link sent to ${email}`);
    } catch {
      setSent(true);
      setOk(isAr?"إذا كان البريد مسجّلاً ستتلقى رابط الإعادة قريباً":"If this email is registered, you'll receive a reset link shortly.");
    } finally { setLoading(false); }
  },[email,emailValid,isAr]);

  // ── Color tokens ────────────────────────────────────────────────────
  const t = dark ? {
    bg:"#030b14", card:"rgba(15,23,42,.85)", border:"rgba(255,255,255,.07)",
    text:"#f0f6ff", textSub:"#94a3b8", muted:"rgba(255,255,255,.3)",
    faint:"rgba(255,255,255,.04)", divider:"rgba(255,255,255,.06)",
    pillBg:"rgba(255,255,255,.05)", pillBd:"rgba(255,255,255,.08)",
    acc:"#3b82f6", accBtn:"linear-gradient(135deg,#1d4ed8 0%,#0891b2 100%)",
    shadow:"0 24px 80px rgba(0,0,0,.7),0 0 0 1px rgba(59,130,246,.08),inset 0 1px 0 rgba(255,255,255,.05)",
    tabAct:"linear-gradient(135deg,#1d4ed8,#0891b2)",tabActS:"0 3px 14px rgba(29,78,216,.4)",
  } : {
    bg:"#f0f4ff", card:"rgba(255,255,255,.95)", border:"rgba(0,0,0,.07)",
    text:"#0f172a", textSub:"#64748b", muted:"#94a3b8",
    faint:"rgba(0,0,0,.03)", divider:"rgba(0,0,0,.06)",
    pillBg:"rgba(0,0,0,.04)", pillBd:"rgba(0,0,0,.07)",
    acc:"#1a56db", accBtn:"linear-gradient(135deg,#1a56db 0%,#0891b2 100%)",
    shadow:"0 20px 60px rgba(26,86,219,.12),0 4px 20px rgba(0,0,0,.07),0 0 0 1px rgba(0,0,0,.05)",
    tabAct:"linear-gradient(135deg,#1a56db,#0891b2)",tabActS:"0 3px 14px rgba(26,86,219,.3)",
  };

  // ── COUNTRIES ───────────────────────────────────────────────────────
  const COUNTRIES = [
    ["EG","🇪🇬 مصر / Egypt"],["SA","🇸🇦 السعودية / Saudi Arabia"],
    ["AE","🇦🇪 الإمارات / UAE"],["KW","🇰🇼 الكويت / Kuwait"],
    ["QA","🇶🇦 قطر / Qatar"],["BH","🇧🇭 البحرين / Bahrain"],
    ["OM","🇴🇲 عُمان / Oman"],["JO","🇯🇴 الأردن / Jordan"],
    ["LB","🇱🇧 لبنان / Lebanon"],["IQ","🇮🇶 العراق / Iraq"],
    ["MA","🇲🇦 المغرب / Morocco"],["DZ","🇩🇿 الجزائر / Algeria"],
    ["TN","🇹🇳 تونس / Tunisia"],["US","🇺🇸 United States"],
    ["GB","🇬🇧 United Kingdom"],["DE","🇩🇪 Germany"],
    ["FR","🇫🇷 France"],["other","🌍 Other"],
  ];

  const PROFESSIONS = [
    ["software_eng",isAr?"مهندس برمجيات":"Software Engineer"],
    ["doctor",isAr?"طبيب":"Doctor / Healthcare"],
    ["hr",isAr?"موارد بشرية":"HR Professional"],
    ["manager",isAr?"مدير":"Manager / Team Lead"],
    ["student",isAr?"طالب":"Student"],
    ["designer",isAr?"مصمم":"Designer"],
    ["accountant",isAr?"محاسب":"Accountant / Finance"],
    ["teacher",isAr?"معلم":"Teacher / Educator"],
    ["other",isAr?"أخرى":"Other"],
  ];

  const TEAM_SIZES = [
    ["1-10","1–10"],["11-50","11–50"],["51-200","51–200"],
    ["201-500","201–500"],["500+","500+"],
  ];

  // ── Google icon ─────────────────────────────────────────────────────
  const GoogleIcon = (
    <svg width="17" height="17" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
  const MSIcon = (
    <svg width="17" height="17" viewBox="0 0 24 24">
      <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
      <rect x="13" y="1" width="10" height="10" fill="#7fba00"/>
      <rect x="1" y="13" width="10" height="10" fill="#00a4ef"/>
      <rect x="13" y="13" width="10" height="10" fill="#ffb900"/>
    </svg>
  );

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight:"100vh",background:t.bg,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontFamily:"'Inter','IBM Plex Sans Arabic',system-ui,-apple-system,sans-serif",
      direction:isAr?"rtl":"ltr",padding:"24px 16px",position:"relative",
    }}>
      <MeshBg dark={dark}/>

      {/* Top controls */}
      <div style={{position:"fixed",top:20,[isAr?"left":"right"]:20,display:"flex",gap:8,zIndex:10}}>
        <button onClick={()=>setLang(isAr?"en":"ar")} style={{
          background:t.pillBg,border:`1px solid ${t.pillBd}`,
          borderRadius:8,padding:"5px 11px",fontSize:12,fontWeight:500,
          color:t.textSub,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(8px)",
        }}>{isAr?"🇬🇧 English":"🇪🇬 عربي"}</button>
        <button onClick={()=>setDarkMode(!dark)} style={{
          background:t.pillBg,border:`1px solid ${t.pillBd}`,
          borderRadius:8,padding:"5px 10px",fontSize:14,cursor:"pointer",backdropFilter:"blur(8px)",
        }}>{dark?"☀️":"🌙"}</button>
      </div>

      {/* Card */}
      <div style={{
        width:"100%",maxWidth:view==="signup"?470:420,
        position:"relative",zIndex:1,
        background:t.card,border:`1px solid ${t.border}`,borderRadius:20,
        padding:"36px 32px",backdropFilter:"blur(24px)",
        opacity:mounted?1:0,
        transform:`translateY(${mounted?0:20}px)${shake?" translateX(-4px)":""}`,
        transition:`opacity .4s,transform .4s${shake?", box-shadow .05s":""}`,
        boxShadow:shake?`0 0 0 2px rgba(239,68,68,.4),${t.shadow}`:t.shadow,
      }}>

        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:22}}>
          <div style={{
            width:38,height:38,borderRadius:10,flexShrink:0,
            background:"linear-gradient(135deg,#1a56db 0%,#0891b2 100%)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:19,color:"#fff",boxShadow:"0 6px 20px rgba(26,86,219,.35)",
          }}>◈</div>
          <div style={{lineHeight:1.1}}>
            <div style={{fontSize:17,fontWeight:800,color:t.text,letterSpacing:"-.025em"}}>Corvus</div>
            <div style={{fontSize:9.5,color:t.muted,marginTop:2,letterSpacing:".05em",textTransform:"uppercase"}}>
              {isAr?"ذكاء الوضعية بالـ AI":"AI Posture Coaching"}
            </div>
          </div>
        </div>

        {/* ── FORGOT ─────────────────────────────────────────────── */}
        {view==="forgot" && (
          <>
            <button onClick={()=>go("login")} style={{
              background:"none",border:"none",color:t.textSub,cursor:"pointer",
              fontSize:13,display:"flex",alignItems:"center",gap:5,
              marginBottom:16,padding:0,fontFamily:"inherit",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              {isAr?"رجوع":"Back to sign in"}
            </button>
            {sent ? (
              <div style={{textAlign:"center",padding:"24px 0"}}>
                <div style={{width:56,height:56,borderRadius:"50%",margin:"0 auto 16px",
                  background:"rgba(34,197,94,.1)",border:"2px solid rgba(34,197,94,.3)",
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div style={{fontSize:18,fontWeight:700,color:t.text,marginBottom:8}}>{isAr?"تحقق من بريدك":"Check your email"}</div>
                <div style={{fontSize:13.5,color:t.textSub,lineHeight:1.6}}>{ok}</div>
              </div>
            ) : (
              <>
                <div style={{fontSize:19,fontWeight:700,color:t.text,marginBottom:6}}>{isAr?"نسيت كلمة المرور؟":"Forgot password?"}</div>
                <div style={{fontSize:13.5,color:t.textSub,marginBottom:22,lineHeight:1.6}}>
                  {isAr?"أدخل بريدك وسنرسل رابط إعادة التعيين":"Enter your email and we'll send a reset link."}
                </div>
                <form onSubmit={handleForgot} noValidate>
                  <FloatInput id="f-email" label={isAr?"البريد الإلكتروني":"Email address"}
                    type="email" value={email} onChange={v=>{setEmail(v);touch("email");}}
                    autoComplete="email" required dark={dark} isRtl={isAr} t={t}
                    error={fieldErr.email} valid={emailValid&&touched.email}/>
                  {err&&<AlertBox msg={err} dark={dark}/>}
                  <button type="submit" disabled={busy} style={{
                    width:"100%",padding:"13px 0",background:t.accBtn,
                    border:"none",borderRadius:10,fontSize:14.5,fontWeight:700,
                    color:"#fff",cursor:busy?"wait":"pointer",fontFamily:"inherit",
                    boxShadow:"0 6px 24px rgba(26,86,219,.28)",
                  }}>
                    {loading?<div style={{width:17,height:17,border:"2.5px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto"}}/>:(isAr?"إرسال رابط إعادة التعيين":"Send reset link")}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {/* ── LOGIN / SIGNUP ──────────────────────────────────────── */}
        {view!=="forgot" && (
          <>
            {/* Tab Sign In / Sign Up */}
            <div style={{display:"flex",background:t.faint,border:`1px solid ${t.border}`,borderRadius:11,padding:4,marginBottom:22,gap:4}}>
              {[["login",isAr?"تسجيل الدخول":"Sign In"],["signup",isAr?"إنشاء حساب":"Sign Up"]].map(([v,l])=>(
                <button key={v} onClick={()=>go(v)} style={{
                  flex:1,padding:"9px 0",fontSize:13.5,fontWeight:600,
                  color:view===v?"#fff":t.textSub,
                  background:view===v?t.tabAct:"transparent",
                  border:"none",borderRadius:8,cursor:"pointer",
                  transition:"all .25s",fontFamily:"inherit",
                  boxShadow:view===v?t.tabActS:"none",
                }}>{l}</button>
              ))}
            </div>

            {/* Title */}
            <div style={{textAlign:"center",marginBottom:view==="signup"?14:20}}>
              <h1 style={{fontSize:20,fontWeight:800,color:t.text,letterSpacing:"-.02em",margin:"0 0 8px"}}>
                {view==="signup"?(isAr?"ابدأ مجاناً":"Start for free"):(isAr?"أهلاً بعودتك":"Welcome back")}
              </h1>
              {view==="signup"
                ? <div style={{display:"inline-flex",alignItems:"center",gap:6,
                    background:"rgba(16,217,160,.08)",border:"1px solid rgba(16,217,160,.18)",
                    borderRadius:99,padding:"5px 14px"}}>
                    <span style={{width:5,height:5,borderRadius:"50%",background:"#10d9a0",flexShrink:0}}/>
                    <span style={{fontSize:11.5,color:"#10d9a0",fontWeight:600}}>
                      {isAr?"7 أيام مجانية · بدون بطاقة بنكية":"7-day free trial · No credit card"}
                    </span>
                  </div>
                : <p style={{fontSize:13,color:t.textSub,margin:0}}>
                    {isAr?"سجّل دخول للمتابعة من حيث توقفت":"Sign in to continue where you left off"}
                  </p>
              }
            </div>

            {/* ── ACCOUNT TYPE TOGGLE (signup only) ── */}
            {view==="signup" && (
              <div style={{display:"flex",background:t.faint,border:`1px solid ${t.border}`,
                borderRadius:10,padding:3,marginBottom:16,gap:3}}>
                {[
                  {id:"individual",en:"👤 Individual",ar:"👤 مستخدم فردي",color:"rgba(59,130,246,.4)",colorBg:"rgba(59,130,246,.14)",textColor:"#60a5fa"},
                  {id:"company",en:"🏢 Company / HR",ar:"🏢 شركة / فريق",color:"rgba(16,185,129,.4)",colorBg:"rgba(16,185,129,.14)",textColor:"#34d399"},
                ].map(m=>(
                  <button key={m.id} type="button" onClick={()=>setAcctType(m.id)}
                    style={{
                      flex:1,padding:"8px 4px",border:"none",borderRadius:8,
                      fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                      background:acctType===m.id?m.colorBg:"transparent",
                      color:acctType===m.id?m.textColor:t.muted,
                      boxShadow:acctType===m.id?`inset 0 0 0 1.5px ${m.color}`:"none",
                      transition:"all .2s",
                    }}>
                    {isAr?m.ar:m.en}
                  </button>
                ))}
              </div>
            )}

            {/* Social buttons */}
            <div style={{display:"flex",gap:10,marginBottom:14}}>
              <SocialBtn icon={GoogleIcon} label="Google"
                onClick={()=>withSocial("google",signInGoogle)}
                loading={social==="google"} disabled={busy} dark={dark} t={t}/>
              <SocialBtn icon={MSIcon} label={isAr?"مايكروسوفت":"Microsoft"}
                onClick={()=>withSocial("microsoft",signInMicrosoft)}
                loading={social==="microsoft"} disabled={busy} dark={dark} t={t}/>
            </div>

            {/* Divider */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{flex:1,height:1,background:t.divider}}/>
              <span style={{fontSize:11.5,color:t.muted,whiteSpace:"nowrap"}}>{isAr?"أو بالبريد الإلكتروني":"or with email"}</span>
              <div style={{flex:1,height:1,background:t.divider}}/>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>

              {/* Name row — signup only */}
              {view==="signup" && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <FloatInput id="fname" label={isAr?"الاسم الأول":"First name"}
                    value={fname} onChange={v=>{setFname(v);touch("fname");}}
                    autoComplete="given-name" required dark={dark} isRtl={isAr} t={t}
                    error={fieldErr.fname} valid={fnameValid&&touched.fname}/>
                  <FloatInput id="lname" label={isAr?"اسم العائلة":"Last name"}
                    value={lname} onChange={v=>{setLname(v);touch("lname");}}
                    autoComplete="family-name" required dark={dark} isRtl={isAr} t={t}
                    error={fieldErr.lname} valid={lnameValid&&touched.lname}/>
                </div>
              )}

              {/* Email */}
              <FloatInput id="email"
                label={isAr?"البريد الإلكتروني":(isCompany&&view==="signup"?"Work email":"Email address")}
                type="email" value={email} onChange={v=>{setEmail(v);touch("email");}}
                autoComplete="email" required dark={dark} isRtl={isAr} t={t}
                error={fieldErr.email} valid={emailValid&&touched.email}/>

              {/* Password */}
              <FloatInput id="pass" label={isAr?"كلمة المرور":"Password"}
                type={showP?"text":"password"} value={pass}
                onChange={v=>{setPass(v);touch("pass");}}
                autoComplete={view==="login"?"current-password":"new-password"}
                required dark={dark} isRtl={isAr} t={t}
                error={fieldErr.pass} valid={passValid&&touched.pass}
                rightEl={<EyeBtn show={showP} toggle={()=>setShowP(v=>!v)} dark={dark}/>}/>

              {/* Signup-only fields */}
              {view==="signup" && (<>
                <PwStrength pass={pass} dark={dark} isAr={isAr}/>

                {/* Confirm password */}
                <FloatInput id="pass2" label={isAr?"تأكيد كلمة المرور":"Confirm password"}
                  type={showP2?"text":"password"} value={pass2}
                  onChange={v=>{setPass2(v);touch("pass2");}}
                  autoComplete="new-password" required dark={dark} isRtl={isAr} t={t}
                  error={fieldErr.pass2} valid={pass2Valid&&touched.pass2}
                  rightEl={<EyeBtn show={showP2} toggle={()=>setShowP2(v=>!v)} dark={dark}/>}/>

                {/* ══ INDIVIDUAL FIELDS ══════════════════════════════ */}
                {!isCompany && (<>
                  <Select
                    label={isAr?"الدولة":"Country"}
                    value={country} onChange={v=>{setCountry(v);touch("country");}}
                    options={COUNTRIES} required error={fieldErr.country}
                    dark={dark} t={t}
                    placeholder={isAr?"اختر الدولة":"Select your country"}/>
                  <Select
                    label={isAr?"المهنة":"Profession"}
                    value={profession} onChange={v=>setProfession(v)}
                    options={PROFESSIONS} error="" dark={dark} t={t}
                    placeholder={isAr?"اختر مهنتك (اختياري)":"Select profession (optional)"}/>
                </>)}

                {/* ══ COMPANY FIELDS ═════════════════════════════════ */}
                {isCompany && (<>
                  {/* Company name */}
                  <FloatInput id="companyName" label={isAr?"اسم الشركة":"Company name"}
                    value={companyName} onChange={v=>{setCompanyName(v);touch("companyName");}}
                    autoComplete="organization" required dark={dark} isRtl={isAr} t={t}
                    error={fieldErr.companyName} valid={companyValid&&touched.companyName}/>

                  {/* Team size */}
                  <Select
                    label={isAr?"حجم الفريق":"Team size"}
                    value={teamSize} onChange={v=>{setTeamSize(v);touch("teamSize");}}
                    options={TEAM_SIZES} required error={fieldErr.teamSize}
                    dark={dark} t={t}
                    placeholder={isAr?"اختر حجم الفريق":"Select team size"}/>

                  {/* Role in company */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11.5,fontWeight:600,color:t.textSub,
                      letterSpacing:".06em",textTransform:"uppercase",marginBottom:8}}>
                      {isAr?"دورك في الشركة":"Your role"}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {[
                        {id:"hr_admin",icon:"👔",en:"HR / Admin",ar:"HR / مسؤول",desc:isAr?"أدير الفريق وأرى التقارير":"Manage team & view reports"},
                        {id:"employee",icon:"🧑‍💻",en:"Employee",ar:"موظف",desc:isAr?"أستخدم التطبيق شخصياً":"Use the app personally"},
                      ].map(r=>(
                        <button key={r.id} type="button" onClick={()=>setCompanyRole(r.id)}
                          style={{
                            padding:"12px 10px",borderRadius:10,cursor:"pointer",
                            background:companyRole===r.id?"rgba(26,86,219,.12)":t.faint,
                            border:`1.5px solid ${companyRole===r.id?"rgba(26,86,219,.5)":t.border}`,
                            textAlign:"center",transition:"all .18s",fontFamily:"inherit",
                            boxShadow:companyRole===r.id?"0 0 0 3px rgba(26,86,219,.1)":"none",
                          }}>
                          <div style={{fontSize:20,marginBottom:4}}>{r.icon}</div>
                          <div style={{fontSize:13,fontWeight:700,color:companyRole===r.id?"#60a5fa":t.text,marginBottom:2}}>{isAr?r.ar:r.en}</div>
                          <div style={{fontSize:10.5,color:t.textSub,lineHeight:1.3}}>{r.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>)}

                {/* Terms */}
                <div style={{marginBottom:10}}>
                  <label style={{display:"flex",alignItems:"flex-start",gap:11,cursor:"pointer",
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
                    }}>
                      {agreeTerms&&<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{fontSize:13,color:t.textSub,lineHeight:1.55}}>
                      {isAr?"أوافق على":"I agree to the"}{" "}
                      <a href={`mailto:${SUPPORT_EMAIL}?subject=Terms`} style={{color:t.acc,textDecoration:"none",fontWeight:600}}>{isAr?"شروط الاستخدام":"Terms of Service"}</a>
                      {" "}{isAr?"و":"and"}{" "}
                      <a href={`mailto:${SUPPORT_EMAIL}?subject=Privacy`} style={{color:t.acc,textDecoration:"none",fontWeight:600}}>{isAr?"سياسة الخصوصية":"Privacy Policy"}</a>
                      <span style={{color:"#ef4444",marginLeft:2}}>*</span>
                    </span>
                  </label>
                  {fieldErr.terms&&<div style={{fontSize:11.5,color:"#ef4444",marginTop:5,display:"flex",alignItems:"center",gap:4}}><span>⚠</span>{fieldErr.terms}</div>}
                </div>

                {/* Newsletter */}
                <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:6}}>
                  <input type="checkbox" checked={newsletter} onChange={e=>setNewsletter(e.target.checked)}
                    style={{width:17,height:17,accentColor:t.acc,cursor:"pointer",flexShrink:0}}/>
                  <span style={{fontSize:12.5,color:t.textSub}}>
                    {isAr?"أريد تلقي نصائح وتحديثات Corvus":"Send me Corvus tips and updates"}
                  </span>
                </label>
              </>)}

              {/* Remember me — login only */}
              {view==="login" && (
                <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,cursor:"pointer"}}>
                  <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}
                    style={{width:16,height:16,accentColor:t.acc,cursor:"pointer",flexShrink:0}}/>
                  <span style={{fontSize:13,color:t.textSub}}>{isAr?"تذكرني على هذا الجهاز":"Remember me on this device"}</span>
                </label>
              )}

              {/* Forgot link — login only */}
              {view==="login" && (
                <div style={{textAlign:isAr?"left":"right",marginBottom:14,marginTop:-6}}>
                  <button type="button" onClick={()=>go("forgot")} style={{
                    background:"none",border:"none",fontSize:12.5,
                    color:t.acc,cursor:"pointer",padding:0,fontFamily:"inherit",
                  }}>{isAr?"نسيت كلمة المرور؟":"Forgot password?"}</button>
                </div>
              )}

              {err&&<div ref={errRef}><AlertBox msg={err} dark={dark}/></div>}

              {/* Submit */}
              <button type="submit" disabled={busy} style={{
                width:"100%",padding:"13px 0",marginBottom:12,
                background:busy?"rgba(26,86,219,.4)":t.accBtn,
                border:"none",borderRadius:10,fontSize:14.5,fontWeight:700,
                color:"#fff",cursor:busy?"wait":"pointer",
                boxShadow:busy?"none":"0 6px 24px rgba(26,86,219,.28)",
                transition:"all .25s",display:"flex",alignItems:"center",
                justifyContent:"center",gap:8,fontFamily:"inherit",
              }}>
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
        <div style={{textAlign:"center",marginTop:16,fontSize:12,color:t.muted}}>
          {isAr?"للدعم:":"Need help?"}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{color:t.acc,textDecoration:"none",fontWeight:500}}>{SUPPORT_EMAIL}</a>
        </div>
      </div>

      <style>{`
        @keyframes spin      { to { transform:rotate(360deg) } }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none} }
        @keyframes popIn     { from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)} }
        input::placeholder   { color:${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.22)"}!important }
        input:-webkit-autofill {
          -webkit-box-shadow:0 0 0 100px ${dark?"#0d1829":"#f0f4ff"} inset!important;
          -webkit-text-fill-color:${dark?"#f0f6ff":"#0f172a"}!important;
        }
        *{box-sizing:border-box;margin:0;padding:0}
        button:focus-visible,input:focus-visible{outline:2px solid ${t.acc};outline-offset:2px}
        h1,h2,p{margin:0}
      `}</style>
    </div>
  );
}
