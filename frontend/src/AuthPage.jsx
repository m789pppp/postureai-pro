import { useState, useCallback, useEffect, useRef } from "react";
import {
  signInGoogle, signInMicrosoft, signInEmail, signUpEmail, resetPassword,
  getUserProfile, createUserProfile, SUPPORT_EMAIL,
} from "./firebase.js";

function getErr(msg, isAr) {
  const code = (msg||"").match(/\(auth\/([^)]+)\)/)?.[1]||"";
  const map = {
    "wrong-password":        {en:"Wrong password",                    ar:"كلمة المرور غلط"},
    "invalid-credential":    {en:"Incorrect email or password",       ar:"البريد أو كلمة المرور غلط"},
    "user-not-found":        {en:"No account — sign up first",        ar:"مفيش حساب — سجّل جديد"},
    "email-already-in-use":  {en:"Already registered — sign in",      ar:"مسجّل بالفعل — سجّل دخول"},
    "weak-password":         {en:"Min 6 characters required",         ar:"6 أحرف على الأقل"},
    "too-many-requests":     {en:"Too many attempts — wait a moment", ar:"محاولات كثيرة — انتظر"},
    "network-request-failed":{en:"Network error — check connection",  ar:"مشكلة في الإنترنت"},
    "invalid-email":         {en:"Invalid email address",             ar:"بريد إلكتروني غير صحيح"},
    "popup-closed-by-user":  {en:"Sign-in cancelled",                 ar:"تم إلغاء تسجيل الدخول"},
    "account-exists-with-different-credential":
                             {en:"Account exists with different sign-in method",ar:"الحساب مسجّل بطريقة دخول مختلفة"},
  };
  const e = map[code]||map[Object.keys(map).find(k=>code.includes(k))||""];
  return e?e[isAr?"ar":"en"]:(isAr?"حدث خطأ — حاول تاني":"Something went wrong — try again");
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

// Particle background
function Particles({dark}){
  const canvasRef = useRef(null);
  useEffect(()=>{
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width  = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const dots = Array.from({length:40},()=>({
      x:Math.random()*w, y:Math.random()*h,
      r:Math.random()*1.5+.5,
      vx:(Math.random()-.5)*.3, vy:(Math.random()-.5)*.3,
      o:Math.random()*.4+.1,
    }));
    let af;
    const draw = ()=>{
      ctx.clearRect(0,0,w,h);
      dots.forEach(d=>{
        d.x+=d.vx; d.y+=d.vy;
        if(d.x<0||d.x>w) d.vx*=-1;
        if(d.y<0||d.y>h) d.vy*=-1;
        ctx.beginPath();
        ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
        ctx.fillStyle = dark?`rgba(99,179,237,${d.o})`:`rgba(26,86,219,${d.o*.5})`;
        ctx.fill();
      });
      // Draw connecting lines
      dots.forEach((a,i)=>dots.slice(i+1).forEach(b=>{
        const dist=Math.hypot(a.x-b.x,a.y-b.y);
        if(dist<100){
          ctx.beginPath();
          ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
          ctx.strokeStyle=dark
            ?`rgba(99,179,237,${(1-dist/100)*.08})`
            :`rgba(26,86,219,${(1-dist/100)*.04})`;
          ctx.lineWidth=.5;
          ctx.stroke();
        }
      }));
      af=requestAnimationFrame(draw);
    };
    draw();
    const resize=()=>{w=canvas.width=window.innerWidth;h=canvas.height=window.innerHeight;};
    window.addEventListener('resize',resize);
    return ()=>{ cancelAnimationFrame(af); window.removeEventListener('resize',resize); };
  },[dark]);
  return <canvas ref={canvasRef} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,opacity:.6}}/>;
}

export default function AuthPage({darkMode,setDarkMode,lang,setLang,onAuth,initialView}){
  const isAr   = lang==="ar";
  const isDark = darkMode;

  const [view,    setView]    = useState(initialView||"login");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [name,    setName]    = useState("");
  const [showP,   setShowP]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [social,  setSocial]  = useState(""); // "google"|"microsoft"
  const [err,     setErr]     = useState("");
  const [ok,      setOk]      = useState("");
  const [sent,    setSent]    = useState(false);
  const [focused, setFocused] = useState("");
  const [mounted, setMounted] = useState(false);
  const [shake,   setShake]   = useState(false);

  useEffect(()=>{ const t=setTimeout(()=>setMounted(true),80); return()=>clearTimeout(t); },[]);

  const triggerShake = ()=>{ setShake(true); setTimeout(()=>setShake(false),500); };

  const strength   = pwStrength(pass);
  const sColors    = ["#ef4444","#f97316","#eab308","#22c55e","#22c55e"];
  const sLabels    = {en:["Very weak","Weak","Fair","Strong","Very strong"],ar:["ضعيفة جداً","ضعيفة","مقبولة","قوية","قوية جداً"]};

  // Color scheme
  const c = isDark ? {
    bg:"#030b14", card:"rgba(255,255,255,.03)", border:"rgba(255,255,255,.08)",
    text:"#f0f6ff", muted:"rgba(255,255,255,.4)", faint:"rgba(255,255,255,.12)",
    inp:"rgba(255,255,255,.04)", inpF:"rgba(26,86,219,.08)", inpB:"rgba(255,255,255,.08)", inpBF:"#3b82f6",
    acc:"#3b82f6", accG:"linear-gradient(135deg,#1a56db,#0891b2)",
    pill:"rgba(255,255,255,.05)", pillB:"rgba(255,255,255,.07)",
    subBtn:"rgba(255,255,255,.04)",
  } : {
    bg:"#f0f4ff", card:"#ffffff", border:"rgba(0,0,0,.08)",
    text:"#0f172a", muted:"#64748b", faint:"rgba(0,0,0,.06)",
    inp:"#f8fafc", inpF:"rgba(26,86,219,.05)", inpB:"rgba(0,0,0,.1)", inpBF:"#1a56db",
    acc:"#1a56db", accG:"linear-gradient(135deg,#1a56db,#0891b2)",
    pill:"rgba(0,0,0,.04)", pillB:"rgba(0,0,0,.06)",
    subBtn:"rgba(0,0,0,.03)",
  };

  const go = v=>{ setView(v); setErr(""); setOk(""); setSent(false); };

  const withSocial = async (key, fn)=>{
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait a moment");return;}
    setErr(""); setSocial(key);
    try{
      const r = await fn();
      if(!r) return;
      const p = await getUserProfile(r.user.uid);
      if(!p) await createUserProfile(r.user.uid,{email:r.user.email,name:r.user.displayName||"",company:""});
      onAuth(r.user,!p);
    }catch(e){ setErr(getErr(e.message,isAr)); triggerShake(); }
    finally{ setSocial(""); }
  };

  const handleSubmit = useCallback(async e=>{
    e.preventDefault();
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait a moment");return;}
    setErr(""); setLoading(true);
    try{
      if(view==="login"){
        const c2=await signInEmail(email.trim(),pass); onAuth(c2.user,false);
      }else{
        const c2=await signUpEmail(email.trim(),pass);
        await createUserProfile(c2.user.uid,{email:email.trim(),name:name.trim(),company:""});
        onAuth(c2.user,true);
      }
    }catch(e){ setErr(getErr(e.message,isAr)); triggerShake(); }
    finally{ setLoading(false); }
  },[view,email,pass,name,isAr,onAuth]);

  const handleForgot = useCallback(async e=>{
    e.preventDefault();
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait a moment");return;}
    setErr(""); setLoading(true);
    try{
      await resetPassword(email.trim()); setSent(true);
      setOk(isAr?`✅ تم إرسال رابط إعادة التعيين إلى ${email} — تحقق من بريدك`:`✅ Reset link sent to ${email} — check your inbox`);
    }catch(e){
      const code=(e.message||"").match(/\(auth\/([^)]+)\)/)?.[1]||"";
      if(code==="user-not-found"){ setSent(true); setOk(isAr?"✅ إذا كان البريد مسجّلاً سيصلك رابط":"✅ If registered, a reset link has been sent"); }
      else { setErr(getErr(e.message,isAr)); triggerShake(); }
    }finally{ setLoading(false); }
  },[email,isAr]);

  const busy = loading || !!social;

  const inp = (id,label,type,val,setV,auto,ph)=>(
    <div style={{marginBottom:14}}>
      <label style={{display:"block",marginBottom:6,fontSize:11.5,fontWeight:600,
        color:focused===id?c.acc:c.muted,letterSpacing:".06em",textTransform:"uppercase",transition:"color .2s"}}>
        {label}
      </label>
      <div style={{position:"relative"}}>
        <input type={type} value={val} onChange={e=>setV(e.target.value)}
          onFocus={()=>setFocused(id)} onBlur={()=>setFocused("")}
          autoComplete={auto} required placeholder={ph||""}
          style={{
            width:"100%", padding:"12px 16px",
            paddingRight:id==="pass"?44:16,
            background:focused===id?c.inpF:c.inp,
            border:`1.5px solid ${focused===id?c.inpBF:c.inpB}`,
            borderRadius:10, fontSize:14.5, color:c.text, outline:"none",
            transition:"all .2s", boxSizing:"border-box", fontFamily:"inherit",
          }}/>
        {id==="pass" && (
          <button type="button" onClick={()=>setShowP(v=>!v)} tabIndex={-1}
            style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",
              background:"none",border:"none",color:c.muted,cursor:"pointer",
              fontSize:15,padding:0,lineHeight:1,transition:"color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.color=c.text}
            onMouseLeave={e=>e.currentTarget.style.color=c.muted}>
            {showP?"🙈":"👁"}
          </button>
        )}
      </div>
    </div>
  );

  return(
    <div style={{
      minHeight:"100vh", background:c.bg,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Inter','IBM Plex Sans Arabic',system-ui,sans-serif",
      direction:isAr?"rtl":"ltr", padding:"24px 16px", position:"relative",
      transition:"background .3s",
    }}>
      <Particles dark={isDark}/>

      {/* Top controls */}
      <div style={{position:"fixed",top:20,[isAr?"left":"right"]:20,display:"flex",gap:8,zIndex:10}}>
        <button onClick={()=>setLang(isAr?"en":"ar")} style={{
          background:c.pill, border:`1px solid ${c.pillB}`,
          borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:500,
          color:c.muted, cursor:"pointer", transition:"all .2s",
        }}
        onMouseEnter={e=>{e.currentTarget.style.background=`rgba(26,86,219,.15)`;e.currentTarget.style.color=c.text;}}
        onMouseLeave={e=>{e.currentTarget.style.background=c.pill;e.currentTarget.style.color=c.muted;}}>
          {isAr?"🇬🇧 EN":"🇪🇬 عربي"}
        </button>
        <button onClick={()=>setDarkMode(!isDark)} style={{
          background:c.pill, border:`1px solid ${c.pillB}`,
          borderRadius:8, padding:"6px 10px", fontSize:14, cursor:"pointer", transition:"all .2s",
        }}>{isDark?"☀️":"🌙"}</button>
      </div>

      {/* Card */}
      <div style={{
        width:"100%", maxWidth:420, position:"relative", zIndex:1,
        background:c.card, border:`1px solid ${c.border}`,
        borderRadius:20, padding:"36px 32px",
        boxShadow: isDark
          ?"0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(26,86,219,.08)"
          :"0 20px 60px rgba(26,86,219,.12), 0 4px 20px rgba(0,0,0,.08)",
        opacity:mounted?1:0,
        transform:`translateY(${mounted?0:24}px) ${shake?"translateX(-4px)":""}`,
        transition:`opacity .4s ease, transform .4s ease${shake?", transform .05s ease":""}`,
      }}>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:26}}>
          <div style={{
            width:50,height:50,borderRadius:14,margin:"0 auto 12px",
            background:c.accG,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:24,boxShadow:`0 8px 28px rgba(26,86,219,.35)`,
            animation:"logoFloat 4s ease-in-out infinite",
          }}>◈</div>
          <div style={{fontSize:20,fontWeight:800,color:c.text,letterSpacing:"-.02em"}}>Corvus</div>
          <div style={{fontSize:12,color:c.muted,marginTop:2}}>
            {isAr?"صحة العمل بالذكاء الاصطناعي":"AI Workplace Health"}
          </div>
        </div>

        {/* Forgot view */}
        {view==="forgot"?(
          <>
            <button onClick={()=>go("login")} style={{
              background:"none",border:"none",color:c.muted,cursor:"pointer",
              fontSize:13,display:"flex",alignItems:"center",gap:6,
              marginBottom:18,padding:0,fontFamily:"inherit",transition:"color .15s",
            }}
            onMouseEnter={e=>e.currentTarget.style.color=c.text}
            onMouseLeave={e=>e.currentTarget.style.color=c.muted}>
              ← {isAr?"رجوع":"Back"}
            </button>
            <div style={{fontSize:20,fontWeight:700,color:c.text,marginBottom:6}}>
              {isAr?"إعادة تعيين كلمة المرور":"Reset your password"}
            </div>
            <div style={{fontSize:13.5,color:c.muted,marginBottom:22,lineHeight:1.6}}>
              {isAr?"أدخل بريدك وسنرسل رابط إعادة التعيين":"Enter your email and we'll send a reset link"}
            </div>
          </>
        ):(
          <>
            {/* Tabs */}
            <div style={{
              display:"flex",background:c.faint,
              border:`1px solid ${c.border}`,
              borderRadius:11,padding:4,marginBottom:24,gap:4,
            }}>
              {[["login",isAr?"تسجيل الدخول":"Sign In"],["signup",isAr?"حساب جديد":"Sign Up"]].map(([v,l])=>(
                <button key={v} onClick={()=>go(v)} style={{
                  flex:1,padding:"9px 0",fontSize:13.5,fontWeight:600,
                  color:view===v?"#fff":c.muted,
                  background:view===v?c.accG:"transparent",
                  border:"none",borderRadius:8,cursor:"pointer",
                  transition:"all .25s",fontFamily:"inherit",
                  boxShadow:view===v?"0 3px 14px rgba(26,86,219,.3)":"none",
                }}>{l}</button>
              ))}
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:700,color:c.text,letterSpacing:"-.01em"}}>
                {view==="signup"?(isAr?"إنشاء حساب جديد":"Create your account"):(isAr?"أهلاً بعودتك 👋":"Welcome back 👋")}
              </div>
              <div style={{fontSize:13,color:c.muted,marginTop:3}}>
                {view==="signup"?(isAr?"مجاني — لا بطاقة بنكية":"Free — no credit card needed"):(isAr?"سجّل دخول للمتابعة":"Sign in to continue")}
              </div>
            </div>
          </>
        )}

        {/* Form first */}
        <form onSubmit={view==="forgot"?handleForgot:handleSubmit} noValidate>
          {view==="signup"&&inp("name",isAr?"الاسم الكامل":"Full name","text",name,setName,"name",isAr?"محمد أحمد":"John Doe")}
          {inp("email",isAr?"البريد الإلكتروني":"Email address","email",email,setEmail,"email","you@example.com")}
          {view!=="forgot"&&inp("pass",isAr?"كلمة المرور":"Password",showP?"text":"password",pass,setPass,view==="login"?"current-password":"new-password","••••••••")}

          {/* Strength */}
          {view==="signup"&&pass&&(
            <div style={{marginBottom:14,marginTop:-6}}>
              <div style={{display:"flex",gap:3,marginBottom:3}}>
                {[1,2,3,4,5].map(i=>(
                  <div key={i} style={{flex:1,height:3,borderRadius:99,transition:"background .3s",
                    background:i<=strength?sColors[Math.min(strength-1,4)]:c.faint}}/>
                ))}
              </div>
              <div style={{fontSize:11,color:sColors[Math.min(strength-1,4)]||c.muted,fontWeight:500}}>
                {sLabels[isAr?"ar":"en"][Math.min(strength-1,4)]||(isAr?"ضعيفة جداً":"Very weak")}
              </div>
            </div>
          )}

          {/* Forgot link */}
          {view==="login"&&(
            <div style={{textAlign:isAr?"left":"right",marginBottom:18,marginTop:-4}}>
              <button type="button" onClick={()=>go("forgot")} style={{
                background:"none",border:"none",fontSize:12.5,color:c.acc,
                cursor:"pointer",padding:0,fontFamily:"inherit",transition:"opacity .15s",
              }}
              onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                {isAr?"نسيت كلمة المرور؟":"Forgot password?"}
              </button>
            </div>
          )}

          {/* Error */}
          {err&&(
            <div role="alert" style={{
              background:isDark?"rgba(239,68,68,.08)":"rgba(239,68,68,.06)",
              border:"1px solid rgba(239,68,68,.2)",
              borderRadius:9,padding:"11px 14px",marginBottom:14,
              fontSize:13,color:"#f87171",display:"flex",gap:8,alignItems:"center",
              animation:"slideDown .25s ease",
            }}>⚠️ {err}</div>
          )}

          {/* Success */}
          {ok&&(
            <div role="status" style={{
              background:isDark?"rgba(26,86,219,.08)":"rgba(26,86,219,.05)",
              border:"1px solid rgba(26,86,219,.2)",
              borderRadius:9,padding:"11px 14px",marginBottom:14,
              fontSize:13,color:isDark?"#93c5fd":"#1a56db",lineHeight:1.6,
              animation:"slideDown .25s ease",
            }}>{ok}</div>
          )}

          {/* Submit */}
          {!sent&&(
            <button type="submit" disabled={busy} style={{
              width:"100%",padding:"13px 0",marginBottom:16,
              background:busy?"rgba(26,86,219,.4)":c.accG,
              border:"none",borderRadius:10,
              fontSize:14.5,fontWeight:700,color:"#fff",
              cursor:busy?"wait":"pointer",
              boxShadow:busy?"none":"0 6px 24px rgba(26,86,219,.3)",
              transition:"all .25s",display:"flex",alignItems:"center",
              justifyContent:"center",gap:8,fontFamily:"inherit",
              opacity:busy?.7:1,
            }}
            onMouseEnter={e=>{if(!busy){e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 10px 32px rgba(26,86,219,.4)";}}}
            onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=busy?"none":"0 6px 24px rgba(26,86,219,.3)";}}>
              {loading
                ?<div style={{width:17,height:17,border:"2.5px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                :view==="login"  ?(isAr?"تسجيل الدخول ←":"Sign In →")
                :view==="signup" ?(isAr?"إنشاء الحساب ←":"Create Account →")
                :                 (isAr?"إرسال الرابط ←":"Send Reset Link →")
              }
            </button>
          )}
          {sent&&(
            <button type="button" onClick={()=>{setSent(false);setOk("");}} style={{
              width:"100%",padding:"12px 0",marginBottom:16,
              background:isDark?"rgba(26,86,219,.08)":"rgba(26,86,219,.06)",
              border:"1px solid rgba(26,86,219,.2)",
              borderRadius:10,fontSize:14,fontWeight:500,color:c.acc,
              cursor:"pointer",fontFamily:"inherit",transition:"background .15s",
            }}
            onMouseEnter={e=>e.currentTarget.style.background=isDark?"rgba(26,86,219,.15)":"rgba(26,86,219,.1)"}
            onMouseLeave={e=>e.currentTarget.style.background=isDark?"rgba(26,86,219,.08)":"rgba(26,86,219,.06)"}>
              {isAr?"إعادة إرسال":"Resend link"}
            </button>
          )}
        </form>

        {/* Social — BELOW form */}
        {view!=="forgot"&&(
          <>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <div style={{flex:1,height:1,background:c.border}}/>
              <span style={{fontSize:12,color:c.muted}}>
                {isAr?"أو الدخول بـ":"or sign in with"}
              </span>
              <div style={{flex:1,height:1,background:c.border}}/>
            </div>

            <div style={{display:"flex",gap:10}}>
              {/* Google */}
              {[
                {
                  key:"google",
                  icon:<svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>,
                  label:"Google",
                  fn:signInGoogle,
                },
                {
                  key:"microsoft",
                  icon:<svg width="18" height="18" viewBox="0 0 24 24">
                    <rect x="1"  y="1"  width="10.5" height="10.5" fill="#f25022"/>
                    <rect x="12.5" y="1"  width="10.5" height="10.5" fill="#7fba00"/>
                    <rect x="1"  y="12.5" width="10.5" height="10.5" fill="#00a4ef"/>
                    <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#ffb900"/>
                  </svg>,
                  label:"Microsoft",
                  fn:signInMicrosoft,
                },
              ].map(({key,icon,label,fn})=>(
                <button key={key} type="button" disabled={busy}
                  onClick={()=>withSocial(key,fn)}
                  style={{
                    flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                    padding:"11px 0",
                    background:c.subBtn,
                    border:`1px solid ${c.border}`,
                    borderRadius:10,fontSize:13.5,fontWeight:500,color:c.text,
                    cursor:busy?"wait":"pointer",transition:"all .2s",fontFamily:"inherit",
                    opacity:busy?.6:1,
                  }}
                  onMouseEnter={e=>{if(!busy){e.currentTarget.style.background=isDark?"rgba(255,255,255,.07)":"rgba(26,86,219,.06)";e.currentTarget.style.borderColor=isDark?"rgba(255,255,255,.15)":"rgba(26,86,219,.2)";e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 4px 16px rgba(26,86,219,.1)`;}}}
                  onMouseLeave={e=>{e.currentTarget.style.background=c.subBtn;e.currentTarget.style.borderColor=c.border;e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
                  {social===key
                    ?<div style={{width:16,height:16,border:`2px solid ${c.muted}`,borderTopColor:c.acc,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                    :icon}
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{textAlign:"center",marginTop:18,fontSize:12,color:c.muted}}>
          {isAr?"للدعم:":"Support:"}{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{color:c.acc,textDecoration:"none"}}>{SUPPORT_EMAIL}</a>
        </div>
      </div>

      <style>{`
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
        @keyframes logoFloat { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-6px) rotate(3deg)} }
        input::placeholder   { color:${isDark?"rgba(255,255,255,.2)":"rgba(0,0,0,.25)"}!important }
        input:-webkit-autofill{
          -webkit-box-shadow:0 0 0 100px ${isDark?"#0d1829":"#f0f4ff"} inset!important;
          -webkit-text-fill-color:${c.text}!important;
        }
        * { box-sizing:border-box }
        button:focus-visible,input:focus-visible{ outline:2px solid ${c.acc};outline-offset:2px }
      `}</style>
    </div>
  );
}
