import { useState, useCallback } from "react";
import {
  signInGoogle, signInEmail, signUpEmail, resetPassword,
  getUserProfile, createUserProfile,
  SUPPORT_EMAIL, isAutoApproveEmail,
} from "./firebase.js";

function getErr(msg, isAr) {
  const code = (msg||"").match(/\(auth\/([^)]+)\)/)?.[1]||"";
  const map = {
    "wrong-password":        {en:"Wrong password",                   ar:"كلمة المرور غلط"},
    "invalid-credential":    {en:"Wrong email or password",          ar:"البريد أو كلمة المرور غلط"},
    "user-not-found":        {en:"No account found — sign up first", ar:"مفيش حساب — سجّل جديد"},
    "email-already-in-use":  {en:"Email already registered",         ar:"البريد مسجّل — سجّل دخول"},
    "weak-password":         {en:"Min 6 characters",                 ar:"6 أحرف على الأقل"},
    "too-many-requests":     {en:"Too many attempts — wait",         ar:"محاولات كثيرة — انتظر"},
    "network-request-failed":{en:"Network error",                    ar:"مشكلة في الإنترنت"},
    "invalid-email":         {en:"Invalid email",                    ar:"بريد غير صحيح"},
    "popup-closed-by-user":  {en:"Sign-in cancelled",                ar:"تم الإلغاء"},
  };
  const e = map[code]||map[Object.keys(map).find(k=>code.includes(k))||""];
  return e ? e[isAr?"ar":"en"] : (isAr?"حدث خطأ — حاول تاني":"Something went wrong");
}

function pwStrength(p) {
  if(!p) return 0;
  let s=0;
  if(p.length>=6) s++;
  if(p.length>=10) s++;
  if(/[A-Z]/.test(p)) s++;
  if(/[0-9]/.test(p)) s++;
  if(/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

const _rate={c:0,t:0};
function rateOk(){
  const now=Date.now();
  if(now-_rate.t>60000){_rate.c=0;_rate.t=now;}
  return ++_rate.c<=8;
}

export default function AuthPage({darkMode,setDarkMode,lang,setLang,onAuth,initialView}){
  const isAr = lang==="ar";
  const [view,    setView]    = useState(initialView||"login");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [name,    setName]    = useState("");
  const [showP,   setShowP]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");
  const [ok,      setOk]      = useState("");
  const [sent,    setSent]    = useState(false);
  const [focused, setFocused] = useState("");
  const [gLoading,setGLoading]= useState(false);

  const strength = pwStrength(pass);
  const sColors  = ["#ef4444","#f97316","#eab308","#22c55e","#22c55e"];
  const sLabels  = {en:["Very weak","Weak","Fair","Strong","Very strong"],ar:["ضعيفة جداً","ضعيفة","مقبولة","قوية","قوية جداً"]};

  const go = v => { setView(v); setErr(""); setOk(""); setSent(false); };

  // ── Google ─────────────────────────────────────────────────────
  const handleGoogle = useCallback(async()=>{
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait a moment");return;}
    setErr(""); setGLoading(true);
    try{
      const c = await signInGoogle();
      if(!c){setErr(isAr?"جاري التوجيه…":"Redirecting…");return;}
      const p = await getUserProfile(c.user.uid);
      if(!p) await createUserProfile(c.user.uid,{email:c.user.email,name:c.user.displayName||"",company:""});
      onAuth(c.user,!p);
    }catch(e){setErr(getErr(e.message,isAr));}
    finally{setGLoading(false);}
  },[isAr,onAuth]);

  // ── Email submit ───────────────────────────────────────────────
  const handleSubmit = useCallback(async e=>{
    e.preventDefault();
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait a moment");return;}
    setErr(""); setLoading(true);
    try{
      if(view==="login"){
        const c = await signInEmail(email.trim(),pass);
        onAuth(c.user,false);
      }else{
        const c = await signUpEmail(email.trim(),pass);
        await createUserProfile(c.user.uid,{email:email.trim(),name:name.trim(),company:""});
        onAuth(c.user,true);
      }
    }catch(e){setErr(getErr(e.message,isAr));}
    finally{setLoading(false);}
  },[view,email,pass,name,isAr,onAuth]);

  // ── Forgot ─────────────────────────────────────────────────────
  const handleForgot = useCallback(async e=>{
    e.preventDefault();
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait a moment");return;}
    setErr(""); setLoading(true);
    try{
      await resetPassword(email.trim());
      setSent(true);
      setOk(isAr?`✅ تم إرسال رابط إعادة التعيين إلى ${email}`:`✅ Reset link sent to ${email} — check inbox`);
    }catch(e){
      const code=(e.message||"").match(/\(auth\/([^)]+)\)/)?.[1]||"";
      if(code==="user-not-found"){setSent(true);setOk(isAr?"✅ إذا كان البريد مسجّلاً سيصلك رابط":"✅ If registered, a reset link has been sent");}
      else setErr(getErr(e.message,isAr));
    }finally{setLoading(false);}
  },[email,isAr]);

  // ── Shared input style ─────────────────────────────────────────
  const inputStyle = id => ({
    width:"100%", padding:"13px 16px",
    paddingRight: id==="pass" ? 46 : 16,
    background: focused===id ? "rgba(99,102,241,.06)" : "rgba(255,255,255,.04)",
    border: `1.5px solid ${focused===id ? "#6366f1" : "rgba(255,255,255,.08)"}`,
    borderRadius: 10, fontSize: 14.5, color: "#fff", outline: "none",
    transition: "all .15s", boxSizing: "border-box", fontFamily: "inherit",
    WebkitAppearance: "none",
  });

  const labelStyle = {
    display:"block", marginBottom:6, fontSize:12, fontWeight:600,
    color:"rgba(255,255,255,.4)", letterSpacing:".06em", textTransform:"uppercase",
  };

  return (
    <div style={{
      minHeight:"100vh", background:"#080810",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Inter','IBM Plex Sans Arabic',system-ui,sans-serif",
      direction:isAr?"rtl":"ltr", padding:"24px 16px",
    }}>
      {/* Controls top-right */}
      <div style={{position:"fixed",top:20,right:20,display:"flex",gap:8,zIndex:10}}>
        <button onClick={()=>setLang(isAr?"en":"ar")} style={{
          background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.1)",
          borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:500,
          color:"rgba(255,255,255,.5)", cursor:"pointer",
        }}>{isAr?"🇬🇧 EN":"🇪🇬 عربي"}</button>
        <button onClick={()=>setDarkMode(!darkMode)} style={{
          background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.1)",
          borderRadius:8, padding:"6px 10px", fontSize:13, cursor:"pointer",
        }}>{darkMode?"☀️":"🌙"}</button>
      </div>

      {/* Card */}
      <div style={{
        width:"100%", maxWidth:440,
        background:"rgba(255,255,255,.03)",
        border:"1px solid rgba(255,255,255,.07)",
        borderRadius:20, padding:"40px 36px",
        boxShadow:"0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(99,102,241,.08)",
      }}>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{
            width:52, height:52, borderRadius:14, margin:"0 auto 14px",
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:26, boxShadow:"0 8px 32px rgba(99,102,241,.35)",
          }}>◈</div>
          <div style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-.02em"}}>Corvus</div>
          <div style={{fontSize:12.5,color:"rgba(255,255,255,.35)",marginTop:3}}>
            {isAr?"صحة العمل بالذكاء الاصطناعي":"AI Workplace Health"}
          </div>
        </div>

        {/* Forgot view */}
        {view==="forgot" ? (
          <>
            <button onClick={()=>go("login")} style={{
              background:"none",border:"none",color:"rgba(255,255,255,.35)",
              cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",
              gap:6,marginBottom:20,padding:0,fontFamily:"inherit",
            }}>← {isAr?"رجوع":"Back"}</button>
            <div style={{fontSize:22,fontWeight:700,color:"#fff",marginBottom:6}}>
              {isAr?"نسيت كلمة المرور؟":"Reset password"}
            </div>
            <div style={{fontSize:13.5,color:"rgba(255,255,255,.35)",marginBottom:24,lineHeight:1.6}}>
              {isAr?"أدخل بريدك وسنرسل رابط إعادة التعيين":"Enter your email and we'll send a reset link"}
            </div>
          </>
        ) : (
          <>
            {/* Tabs */}
            <div style={{
              display:"flex", background:"rgba(255,255,255,.04)",
              border:"1px solid rgba(255,255,255,.06)",
              borderRadius:11, padding:4, marginBottom:28, gap:4,
            }}>
              {[["login",isAr?"تسجيل الدخول":"Sign In"],["signup",isAr?"حساب جديد":"Sign Up"]].map(([v,l])=>(
                <button key={v} onClick={()=>go(v)} style={{
                  flex:1, padding:"9px 0", fontSize:13.5, fontWeight:600,
                  color: view===v ? "#fff" : "rgba(255,255,255,.35)",
                  background: view===v ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "transparent",
                  border:"none", borderRadius:8, cursor:"pointer", transition:"all .2s",
                  boxShadow: view===v ? "0 4px 16px rgba(99,102,241,.35)" : "none",
                  fontFamily:"inherit",
                }}>{l}</button>
              ))}
            </div>

            {/* Welcome text */}
            <div style={{marginBottom:22}}>
              <div style={{fontSize:20,fontWeight:700,color:"#fff",letterSpacing:"-.01em"}}>
                {view==="signup"?(isAr?"إنشاء حساب جديد":"Create your account"):(isAr?"أهلاً بعودتك":"Welcome back")}
              </div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.35)",marginTop:4}}>
                {view==="signup"
                  ?(isAr?"انضم مجاناً — لا بطاقة بنكية":"Free to join — no credit card needed")
                  :(isAr?"سجّل دخول للمتابعة":"Sign in to your account")}
              </div>
            </div>
          </>
        )}

        {/* Social buttons */}
        {view!=="forgot" && (
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
            {/* Google */}
            <button onClick={handleGoogle} disabled={gLoading||loading} type="button" style={{
              width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,
              padding:"12px 0",
              background:"rgba(255,255,255,.06)",
              border:"1px solid rgba(255,255,255,.1)",
              borderRadius:10,fontSize:14,fontWeight:500,color:"#fff",
              cursor:(gLoading||loading)?"wait":"pointer",
              transition:"background .15s",fontFamily:"inherit",
              opacity:(gLoading||loading)?.6:1,
            }}
            onMouseEnter={e=>{ if(!gLoading&&!loading) e.currentTarget.style.background="rgba(255,255,255,.1)"; }}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.06)"}>
              {gLoading
                ? <div style={{width:16,height:16,border:"2px solid rgba(255,255,255,.2)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                : <svg width="17" height="17" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
              }
              {isAr?"المتابعة بـ Google":"Continue with Google"}
            </button>

            {/* GitHub */}
            <button disabled={loading} type="button" onClick={()=>setErr(isAr?"قريباً":"Coming soon")} style={{
              width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,
              padding:"12px 0",
              background:"rgba(255,255,255,.04)",
              border:"1px solid rgba(255,255,255,.08)",
              borderRadius:10,fontSize:14,fontWeight:500,color:"rgba(255,255,255,.6)",
              cursor:"pointer",transition:"background .15s",fontFamily:"inherit",
            }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.04)"}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              {isAr?"المتابعة بـ GitHub":"Continue with GitHub"}
            </button>
          </div>
        )}

        {/* Divider */}
        {view!=="forgot" && (
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <div style={{flex:1,height:1,background:"rgba(255,255,255,.06)"}}/>
            <span style={{fontSize:12,color:"rgba(255,255,255,.2)"}}>
              {isAr?"أو بالبريد الإلكتروني":"or continue with email"}
            </span>
            <div style={{flex:1,height:1,background:"rgba(255,255,255,.06)"}}/>
          </div>
        )}

        {/* Form */}
        <form onSubmit={view==="forgot"?handleForgot:handleSubmit} noValidate>

          {view==="signup" && (
            <div style={{marginBottom:14}}>
              <label style={labelStyle}>{isAr?"الاسم الكامل":"Full name"}</label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)}
                onFocus={()=>setFocused("name")} onBlur={()=>setFocused("")}
                autoComplete="name" required placeholder={isAr?"محمد أحمد":"John Doe"}
                style={inputStyle("name")}/>
            </div>
          )}

          <div style={{marginBottom:14}}>
            <label style={labelStyle}>{isAr?"البريد الإلكتروني":"Email address"}</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              onFocus={()=>setFocused("email")} onBlur={()=>setFocused("")}
              autoComplete="email" required placeholder="you@example.com"
              style={inputStyle("email")}/>
          </div>

          {view!=="forgot" && (
            <div style={{marginBottom:14}}>
              <label style={labelStyle}>{isAr?"كلمة المرور":"Password"}</label>
              <div style={{position:"relative"}}>
                <input type={showP?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)}
                  onFocus={()=>setFocused("pass")} onBlur={()=>setFocused("")}
                  autoComplete={view==="login"?"current-password":"new-password"} required
                  placeholder={view==="login"?"••••••••":isAr?"6 أحرف على الأقل":"Min 6 characters"}
                  style={inputStyle("pass")}/>
                <button type="button" onClick={()=>setShowP(v=>!v)} tabIndex={-1} style={{
                  position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",
                  background:"none",border:"none",color:"rgba(255,255,255,.3)",
                  cursor:"pointer",fontSize:15,padding:0,lineHeight:1,
                }}>{showP?"🙈":"👁"}</button>
              </div>
            </div>
          )}

          {/* Password strength */}
          {view==="signup" && pass && (
            <div style={{marginBottom:14,marginTop:-4}}>
              <div style={{display:"flex",gap:3,marginBottom:3}}>
                {[1,2,3,4,5].map(i=>(
                  <div key={i} style={{
                    flex:1,height:3,borderRadius:99,transition:"background .2s",
                    background:i<=strength?sColors[Math.min(strength-1,4)]:"rgba(255,255,255,.08)",
                  }}/>
                ))}
              </div>
              <div style={{fontSize:11,color:sColors[Math.min(strength-1,4)]||"rgba(255,255,255,.25)",fontWeight:500}}>
                {sLabels[isAr?"ar":"en"][Math.min(strength-1,4)]||(isAr?"ضعيفة جداً":"Very weak")}
              </div>
            </div>
          )}

          {/* Forgot link */}
          {view==="login" && (
            <div style={{textAlign:"right",marginBottom:20,marginTop:-4}}>
              <button type="button" onClick={()=>go("forgot")} style={{
                background:"none",border:"none",fontSize:12.5,
                color:"#818cf8",cursor:"pointer",padding:0,fontFamily:"inherit",
              }}>{isAr?"نسيت كلمة المرور؟":"Forgot password?"}</button>
            </div>
          )}

          {/* Error */}
          {err && (
            <div role="alert" style={{
              background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.15)",
              borderRadius:9,padding:"11px 14px",marginBottom:14,
              fontSize:13,color:"#fca5a5",display:"flex",gap:8,alignItems:"center",
            }}>⚠️ {err}</div>
          )}

          {/* Success */}
          {ok && (
            <div role="status" style={{
              background:"rgba(34,197,94,.07)",border:"1px solid rgba(34,197,94,.15)",
              borderRadius:9,padding:"11px 14px",marginBottom:14,
              fontSize:13,color:"#86efac",lineHeight:1.6,
            }}>{ok}</div>
          )}

          {/* Submit */}
          {!sent && (
            <button type="submit" disabled={loading||gLoading} style={{
              width:"100%",padding:"13px 0",marginBottom:14,
              background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
              border:"none",borderRadius:10,
              fontSize:14.5,fontWeight:700,color:"#fff",
              cursor:(loading||gLoading)?"wait":"pointer",
              boxShadow:(loading||gLoading)?"none":"0 6px 24px rgba(99,102,241,.35)",
              transition:"all .2s",display:"flex",alignItems:"center",
              justifyContent:"center",gap:8,fontFamily:"inherit",
              opacity:(loading||gLoading)?.6:1,
            }}>
              {loading
                ? <div style={{width:17,height:17,border:"2.5px solid rgba(255,255,255,.25)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                : view==="login"  ? (isAr?"تسجيل الدخول ←":"Sign In →")
                : view==="signup" ? (isAr?"إنشاء الحساب ←":"Create Account →")
                :                   (isAr?"إرسال الرابط ←":"Send Reset Link →")
              }
            </button>
          )}

          {sent && (
            <button type="button" onClick={()=>{setSent(false);setOk("");}} style={{
              width:"100%",padding:"12px 0",
              background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.25)",
              borderRadius:10,fontSize:14,fontWeight:500,color:"#a5b4fc",
              cursor:"pointer",fontFamily:"inherit",
            }}>{isAr?"إعادة إرسال":"Resend link"}</button>
          )}
        </form>

        {/* Footer */}
        <div style={{textAlign:"center",marginTop:18,fontSize:12,color:"rgba(255,255,255,.2)"}}>
          {isAr?"للدعم:":"Support:"}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{color:"#818cf8",textDecoration:"none"}}>
            {SUPPORT_EMAIL}
          </a>
        </div>
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        input::placeholder{color:rgba(255,255,255,.18)!important}
        input:-webkit-autofill{
          -webkit-box-shadow:0 0 0 100px #111120 inset!important;
          -webkit-text-fill-color:#fff!important;
        }
        *{box-sizing:border-box}
        button:focus-visible,input:focus-visible{outline:2px solid #6366f1;outline-offset:2px}
      `}</style>
    </div>
  );
}
