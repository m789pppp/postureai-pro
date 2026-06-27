import { useState, useCallback, useEffect } from "react";
import {
  signInGoogle, signInEmail, signUpEmail, resetPassword,
  getUserProfile, createUserProfile,
  SUPPORT_EMAIL,
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
  return e?e[isAr?"ar":"en"]:(isAr?"حدث خطأ — حاول تاني":"Something went wrong");
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

// Animated background dots
function BgDots() {
  return (
    <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
      {[...Array(6)].map((_,i)=>(
        <div key={i} style={{
          position:"absolute",
          width: [300,200,250,180,320,150][i],
          height:[300,200,250,180,320,150][i],
          borderRadius:"50%",
          background:`radial-gradient(circle, rgba(26,86,219,${[.08,.06,.05,.07,.04,.06][i]}) 0%, transparent 70%)`,
          top:   [`-10%`,`60%`,`30%`,`80%`,`-5%`,`45%`][i],
          left:  [`-5%`,`70%`,`80%`,`-5%`,`55%`,`35%`][i],
          animation:`float${i} ${[12,15,18,14,20,16][i]}s ease-in-out infinite`,
          animationDelay:`${[0,2,4,1,3,5][i]}s`,
        }}/>
      ))}
    </div>
  );
}

export default function AuthPage({darkMode,setDarkMode,lang,setLang,onAuth,initialView}){
  const isAr = lang==="ar";
  const [view,    setView]    = useState(initialView||"login");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [name,    setName]    = useState("");
  const [showP,   setShowP]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading,setGLoading]= useState(false);
  const [err,     setErr]     = useState("");
  const [ok,      setOk]      = useState("");
  const [sent,    setSent]    = useState(false);
  const [focused, setFocused] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(()=>{ setTimeout(()=>setMounted(true),50); },[]);

  const strength = pwStrength(pass);
  const sColors  = ["#ef4444","#f97316","#eab308","#22c55e","#22c55e"];
  const sLabels  = {en:["Very weak","Weak","Fair","Strong","Very strong"],ar:["ضعيفة جداً","ضعيفة","مقبولة","قوية","قوية جداً"]};

  const go = v => { setView(v); setErr(""); setOk(""); setSent(false); };

  const handleGoogle = useCallback(async()=>{
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait");return;}
    setErr(""); setGLoading(true);
    try{
      const c=await signInGoogle();
      if(!c){setErr(isAr?"جاري التوجيه…":"Redirecting…");return;}
      const p=await getUserProfile(c.user.uid);
      if(!p) await createUserProfile(c.user.uid,{email:c.user.email,name:c.user.displayName||"",company:""});
      onAuth(c.user,!p);
    }catch(e){setErr(getErr(e.message,isAr));}
    finally{setGLoading(false);}
  },[isAr,onAuth]);

  const handleSubmit = useCallback(async e=>{
    e.preventDefault();
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait");return;}
    setErr(""); setLoading(true);
    try{
      if(view==="login"){
        const c=await signInEmail(email.trim(),pass);
        onAuth(c.user,false);
      }else{
        const c=await signUpEmail(email.trim(),pass);
        await createUserProfile(c.user.uid,{email:email.trim(),name:name.trim(),company:""});
        onAuth(c.user,true);
      }
    }catch(e){setErr(getErr(e.message,isAr));}
    finally{setLoading(false);}
  },[view,email,pass,name,isAr,onAuth]);

  const handleForgot = useCallback(async e=>{
    e.preventDefault();
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait");return;}
    setErr(""); setLoading(true);
    try{
      await resetPassword(email.trim());
      setSent(true);
      setOk(isAr?`✅ تم إرسال الرابط إلى ${email}`:`✅ Reset link sent to ${email}`);
    }catch(e){
      const code=(e.message||"").match(/\(auth\/([^)]+)\)/)?.[1]||"";
      if(code==="user-not-found"){setSent(true);setOk(isAr?"✅ إذا كان البريد مسجّلاً سيصلك رابط":"✅ If registered, a link has been sent");}
      else setErr(getErr(e.message,isAr));
    }finally{setLoading(false);}
  },[email,isAr]);

  const cs = {
    bg:     "#030b14",
    card:   "rgba(255,255,255,.03)",
    border: "rgba(255,255,255,.07)",
    text:   "#f0f6ff",
    muted:  "rgba(255,255,255,.35)",
    inp:    "rgba(255,255,255,.04)",
    inpH:   "rgba(26,86,219,.08)",
    inpB:   "rgba(255,255,255,.07)",
    inpBH:  "#1a56db",
    accent: "#1a56db",
    accentH:"#1e40af",
    btn:    "linear-gradient(135deg,#1a56db,#0891b2)",
  };

  const inputStyle = id => ({
    width:"100%", padding:"13px 16px",
    paddingRight: id==="pass"?46:16,
    background: focused===id ? cs.inpH : cs.inp,
    border:`1.5px solid ${focused===id ? cs.inpBH : cs.inpB}`,
    borderRadius:10, fontSize:14.5, color:cs.text, outline:"none",
    transition:"all .2s", boxSizing:"border-box", fontFamily:"inherit",
  });

  const btnDisabled = loading||gLoading;

  const socialBtn = (onClick, icon, label, isLoading) => (
    <button type="button" onClick={onClick} disabled={btnDisabled} style={{
      width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10,
      padding:"12px 0",
      background:"rgba(255,255,255,.04)",
      border:`1px solid ${cs.border}`,
      borderRadius:10, fontSize:14, fontWeight:500, color:cs.text,
      cursor:btnDisabled?"wait":"pointer", transition:"all .2s", fontFamily:"inherit",
      opacity:btnDisabled?.6:1,
    }}
    onMouseEnter={e=>{ if(!btnDisabled){e.currentTarget.style.background="rgba(255,255,255,.08)"; e.currentTarget.style.borderColor="rgba(26,86,219,.4)"; e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow="0 4px 20px rgba(26,86,219,.15)"; }}}
    onMouseLeave={e=>{ e.currentTarget.style.background="rgba(255,255,255,.04)"; e.currentTarget.style.borderColor=cs.border; e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=""; }}>
      {isLoading
        ? <div style={{width:16,height:16,border:"2px solid rgba(255,255,255,.2)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
        : icon}
      {label}
    </button>
  );

  return (
    <div style={{
      minHeight:"100vh", background:cs.bg,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Inter','IBM Plex Sans Arabic',system-ui,sans-serif",
      direction:isAr?"rtl":"ltr", padding:"24px 16px", position:"relative",
    }}>
      <BgDots/>

      {/* Controls */}
      <div style={{position:"fixed",top:20,[isAr?"left":"right"]:20,display:"flex",gap:8,zIndex:10}}>
        <button onClick={()=>setLang(isAr?"en":"ar")} style={{
          background:"rgba(255,255,255,.05)", border:`1px solid ${cs.border}`,
          borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:500,
          color:cs.muted, cursor:"pointer", transition:"all .2s",
        }}
        onMouseEnter={e=>{e.currentTarget.style.background="rgba(26,86,219,.15)"; e.currentTarget.style.color="#fff";}}
        onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)"; e.currentTarget.style.color=cs.muted;}}>
          {isAr?"🇬🇧 EN":"🇪🇬 عربي"}
        </button>
        <button onClick={()=>setDarkMode(!darkMode)} style={{
          background:"rgba(255,255,255,.05)", border:`1px solid ${cs.border}`,
          borderRadius:8, padding:"6px 10px", fontSize:13, cursor:"pointer",
        }}>{darkMode?"☀️":"🌙"}</button>
      </div>

      {/* Card */}
      <div style={{
        width:"100%", maxWidth:420, position:"relative", zIndex:1,
        background:cs.card,
        border:`1px solid ${cs.border}`,
        borderRadius:20, padding:"36px 32px",
        boxShadow:"0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(26,86,219,.06)",
        opacity: mounted?1:0,
        transform: mounted?"translateY(0)":"translateY(20px)",
        transition:"opacity .4s ease, transform .4s ease",
      }}>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{
            width:50,height:50,borderRadius:13,margin:"0 auto 12px",
            background:"linear-gradient(135deg,#1a56db,#0891b2)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:24,boxShadow:"0 8px 28px rgba(26,86,219,.3)",
            animation:"logoFloat 3s ease-in-out infinite",
          }}>◈</div>
          <div style={{fontSize:20,fontWeight:800,color:cs.text,letterSpacing:"-.02em"}}>Corvus</div>
          <div style={{fontSize:12,color:cs.muted,marginTop:2}}>
            {isAr?"صحة العمل بالذكاء الاصطناعي":"AI Workplace Health"}
          </div>
        </div>

        {/* Forgot */}
        {view==="forgot" ? (
          <>
            <button onClick={()=>go("login")} style={{
              background:"none",border:"none",color:cs.muted,cursor:"pointer",
              fontSize:13,display:"flex",alignItems:"center",gap:6,
              marginBottom:18,padding:0,fontFamily:"inherit",transition:"color .15s",
            }}
            onMouseEnter={e=>e.currentTarget.style.color="#fff"}
            onMouseLeave={e=>e.currentTarget.style.color=cs.muted}>
              ← {isAr?"رجوع":"Back"}
            </button>
            <div style={{fontSize:20,fontWeight:700,color:cs.text,marginBottom:6}}>
              {isAr?"نسيت كلمة المرور؟":"Reset password"}
            </div>
            <div style={{fontSize:13.5,color:cs.muted,marginBottom:22,lineHeight:1.6}}>
              {isAr?"أدخل بريدك وسنرسل رابط إعادة التعيين":"We'll send a reset link to your email"}
            </div>
          </>
        ) : (
          <>
            {/* Tabs */}
            <div style={{
              display:"flex", background:"rgba(255,255,255,.04)",
              border:`1px solid ${cs.border}`,
              borderRadius:11, padding:4, marginBottom:24, gap:4,
            }}>
              {[["login",isAr?"تسجيل الدخول":"Sign In"],["signup",isAr?"حساب جديد":"Sign Up"]].map(([v,l])=>(
                <button key={v} onClick={()=>go(v)} style={{
                  flex:1,padding:"9px 0",fontSize:13.5,fontWeight:600,
                  color:view===v?"#fff":"rgba(255,255,255,.35)",
                  background:view===v?cs.btn:"transparent",
                  border:"none",borderRadius:8,cursor:"pointer",
                  transition:"all .25s",fontFamily:"inherit",
                  boxShadow:view===v?"0 4px 16px rgba(26,86,219,.3)":"none",
                }}>{l}</button>
              ))}
            </div>

            <div style={{marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:700,color:cs.text,letterSpacing:"-.01em"}}>
                {view==="signup"?(isAr?"إنشاء حساب جديد":"Create your account"):(isAr?"أهلاً بعودتك 👋":"Welcome back 👋")}
              </div>
              <div style={{fontSize:13,color:cs.muted,marginTop:3}}>
                {view==="signup"?(isAr?"مجاني — لا بطاقة بنكية":"Free — no credit card needed"):(isAr?"سجّل دخول للمتابعة":"Sign in to continue")}
              </div>
            </div>
          </>
        )}

        {/* Social logins */}
        {view!=="forgot" && (
          <>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
              {socialBtn(handleGoogle,
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>,
                isAr?"المتابعة بـ Google":"Continue with Google",
                gLoading
              )}
              {socialBtn(()=>setErr(isAr?"قريباً — جاري الربط بـ Microsoft":"Coming soon — Microsoft SSO"),
                <svg width="17" height="17" viewBox="0 0 24 24">
                  <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                  <rect x="13" y="1" width="10" height="10" fill="#7fba00"/>
                  <rect x="1" y="13" width="10" height="10" fill="#00a4ef"/>
                  <rect x="13" y="13" width="10" height="10" fill="#ffb900"/>
                </svg>,
                isAr?"المتابعة بـ Microsoft":"Continue with Microsoft",
                false
              )}
            </div>

            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,.06)"}}/>
              <span style={{fontSize:12,color:"rgba(255,255,255,.2)"}}>
                {isAr?"أو بالبريد الإلكتروني":"or with email"}
              </span>
              <div style={{flex:1,height:1,background:"rgba(255,255,255,.06)"}}/>
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={view==="forgot"?handleForgot:handleSubmit} noValidate>
          {view==="signup" && (
            <div style={{marginBottom:13}}>
              <label style={{display:"block",marginBottom:5,fontSize:12,fontWeight:600,color:cs.muted,letterSpacing:".05em",textTransform:"uppercase"}}>
                {isAr?"الاسم الكامل":"Full name"}
              </label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)}
                onFocus={()=>setFocused("name")} onBlur={()=>setFocused("")}
                autoComplete="name" required placeholder={isAr?"محمد أحمد":"John Doe"}
                style={inputStyle("name")}/>
            </div>
          )}

          <div style={{marginBottom:13}}>
            <label style={{display:"block",marginBottom:5,fontSize:12,fontWeight:600,color:cs.muted,letterSpacing:".05em",textTransform:"uppercase"}}>
              {isAr?"البريد الإلكتروني":"Email"}
            </label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              onFocus={()=>setFocused("email")} onBlur={()=>setFocused("")}
              autoComplete="email" required placeholder="you@example.com"
              style={inputStyle("email")}/>
          </div>

          {view!=="forgot" && (
            <div style={{marginBottom:13}}>
              <label style={{display:"block",marginBottom:5,fontSize:12,fontWeight:600,color:cs.muted,letterSpacing:".05em",textTransform:"uppercase"}}>
                {isAr?"كلمة المرور":"Password"}
              </label>
              <div style={{position:"relative"}}>
                <input type={showP?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)}
                  onFocus={()=>setFocused("pass")} onBlur={()=>setFocused("")}
                  autoComplete={view==="login"?"current-password":"new-password"} required
                  placeholder="••••••••" style={inputStyle("pass")}/>
                <button type="button" onClick={()=>setShowP(v=>!v)} tabIndex={-1} style={{
                  position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",
                  background:"none",border:"none",color:"rgba(255,255,255,.25)",
                  cursor:"pointer",fontSize:15,padding:0,lineHeight:1,transition:"color .15s",
                }}
                onMouseEnter={e=>e.currentTarget.style.color="#fff"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.25)"}>
                  {showP?"🙈":"👁"}
                </button>
              </div>
            </div>
          )}

          {/* Strength */}
          {view==="signup" && pass && (
            <div style={{marginBottom:14,marginTop:-4}}>
              <div style={{display:"flex",gap:3,marginBottom:3}}>
                {[1,2,3,4,5].map(i=>(
                  <div key={i} style={{
                    flex:1,height:3,borderRadius:99,transition:"background .3s",
                    background:i<=strength?sColors[Math.min(strength-1,4)]:"rgba(255,255,255,.07)",
                  }}/>
                ))}
              </div>
              <div style={{fontSize:11,color:sColors[Math.min(strength-1,4)]||"rgba(255,255,255,.2)",fontWeight:500}}>
                {sLabels[isAr?"ar":"en"][Math.min(strength-1,4)]||(isAr?"ضعيفة جداً":"Very weak")}
              </div>
            </div>
          )}

          {view==="login" && (
            <div style={{textAlign:"right",marginBottom:18,marginTop:-4}}>
              <button type="button" onClick={()=>go("forgot")} style={{
                background:"none",border:"none",fontSize:12.5,color:cs.accent,
                cursor:"pointer",padding:0,fontFamily:"inherit",transition:"opacity .15s",
              }}
              onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                {isAr?"نسيت كلمة المرور؟":"Forgot password?"}
              </button>
            </div>
          )}

          {err && (
            <div style={{
              background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.15)",
              borderRadius:9,padding:"11px 14px",marginBottom:14,
              fontSize:13,color:"#fca5a5",display:"flex",gap:8,alignItems:"center",
              animation:"slideDown .2s ease",
            }}>⚠️ {err}</div>
          )}

          {ok && (
            <div style={{
              background:"rgba(26,86,219,.07)",border:"1px solid rgba(26,86,219,.2)",
              borderRadius:9,padding:"11px 14px",marginBottom:14,
              fontSize:13,color:"#93c5fd",lineHeight:1.6,
              animation:"slideDown .2s ease",
            }}>{ok}</div>
          )}

          {!sent && (
            <button type="submit" disabled={btnDisabled} style={{
              width:"100%",padding:"13px 0",marginBottom:12,
              background: btnDisabled?"rgba(26,86,219,.4)":cs.btn,
              border:"none",borderRadius:10,
              fontSize:14.5,fontWeight:700,color:"#fff",
              cursor:btnDisabled?"wait":"pointer",
              boxShadow:btnDisabled?"none":"0 6px 24px rgba(26,86,219,.3)",
              transition:"all .25s",display:"flex",alignItems:"center",
              justifyContent:"center",gap:8,fontFamily:"inherit",
            }}
            onMouseEnter={e=>{ if(!btnDisabled){e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow="0 10px 32px rgba(26,86,219,.4)"; }}}
            onMouseLeave={e=>{ e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=btnDisabled?"none":"0 6px 24px rgba(26,86,219,.3)"; }}>
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
              background:"rgba(26,86,219,.08)",border:"1px solid rgba(26,86,219,.2)",
              borderRadius:10,fontSize:14,fontWeight:500,color:"#93c5fd",
              cursor:"pointer",fontFamily:"inherit",transition:"background .15s",
            }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(26,86,219,.15)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(26,86,219,.08)"}>
              {isAr?"إعادة إرسال":"Resend link"}
            </button>
          )}
        </form>

        <div style={{textAlign:"center",marginTop:16,fontSize:12,color:"rgba(255,255,255,.18)"}}>
          {isAr?"للدعم:":"Support:"}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{color:cs.accent,textDecoration:"none"}}>{SUPPORT_EMAIL}</a>
        </div>
      </div>

      <style>{`
        @keyframes spin     { to { transform: rotate(360deg) } }
        @keyframes slideDown{ from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }
        @keyframes logoFloat{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes float0   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,20px)} }
        @keyframes float1   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-25px,15px)} }
        @keyframes float2   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-20px)} }
        @keyframes float3   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,25px)} }
        @keyframes float4   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(25px,10px)} }
        @keyframes float5   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-15px,-15px)} }
        input::placeholder  { color:rgba(255,255,255,.18)!important }
        input:-webkit-autofill {
          -webkit-box-shadow:0 0 0 100px #0d1829 inset!important;
          -webkit-text-fill-color:#f0f6ff!important;
        }
        * { box-sizing:border-box }
        button:focus-visible,input:focus-visible { outline:2px solid #1a56db;outline-offset:2px }
      `}</style>
    </div>
  );
}
