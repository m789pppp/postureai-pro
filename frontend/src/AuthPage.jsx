import { useState, useCallback, useEffect } from "react";
import {
  signInGoogle, signInEmail, signUpEmail, resetPassword,
  getUserProfile, createUserProfile,
  AUTO_APPROVE_DOMAIN, SUPPORT_EMAIL, isAutoApproveEmail,
} from "./firebase.js";

function getErr(msg, isAr) {
  const code = (msg||"").match(/\(auth\/([^)]+)\)/)?.[1]||"";
  const map = {
    "wrong-password":        {en:"Wrong password",                   ar:"كلمة المرور غلط"},
    "invalid-credential":    {en:"Wrong email or password",          ar:"البريد أو كلمة المرور غلط"},
    "user-not-found":        {en:"No account found — sign up first", ar:"مفيش حساب — سجّل جديد"},
    "email-already-in-use":  {en:"Email already registered",         ar:"البريد مسجّل — سجّل دخول"},
    "weak-password":         {en:"Password too weak (min 6 chars)",  ar:"كلمة مرور ضعيفة (6 أحرف)"},
    "too-many-requests":     {en:"Too many attempts — wait",         ar:"محاولات كثيرة — انتظر"},
    "network-request-failed":{en:"Network error",                    ar:"مشكلة في الإنترنت"},
    "invalid-email":         {en:"Invalid email",                    ar:"بريد غير صحيح"},
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

export default function AuthPage({darkMode,setDarkMode,lang,setLang,onAuth,initialView}){
  const isAr=lang==="ar";
  const [view,setView]=useState(initialView||"login");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [name,setName]=useState("");
  const [showP,setShowP]=useState(false);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [ok,setOk]=useState("");
  const [sent,setSent]=useState(false);
  const [focused,setFocused]=useState("");

  const strength=pwStrength(pass);
  const sColors=["#ef4444","#f97316","#eab308","#22c55e","#22c55e"];
  const sLabels={en:["Very weak","Weak","Fair","Strong","Very strong"],ar:["ضعيفة جداً","ضعيفة","مقبولة","قوية","قوية جداً"]};

  const go=v=>{setView(v);setErr("");setOk("");setSent(false);};

  const handleGoogle=useCallback(async()=>{
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait a moment");return;}
    setErr("");setLoading(true);
    try{
      const c=await signInGoogle();
      if(!c){setErr(isAr?"جاري التوجيه…":"Redirecting…");return;}
      const p=await getUserProfile(c.user.uid);
      if(!p) await createUserProfile(c.user.uid,{email:c.user.email,name:c.user.displayName||"",company:""});
      onAuth(c.user,!p);
    }catch(e){setErr(getErr(e.message,isAr));}
    finally{setLoading(false);}
  },[isAr,onAuth]);

  const handleSubmit=useCallback(async e=>{
    e.preventDefault();
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait a moment");return;}
    setErr("");setLoading(true);
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

  const handleForgot=useCallback(async e=>{
    e.preventDefault();
    if(!rateOk()){setErr(isAr?"انتظر دقيقة":"Wait a moment");return;}
    setErr("");setLoading(true);
    try{
      await resetPassword(email.trim());
      setSent(true);
      setOk(isAr?`تم إرسال رابط إعادة التعيين إلى ${email}`:`Reset link sent to ${email}`);
    }catch(e){
      const code=(e.message||"").match(/\(auth\/([^)]+)\)/)?.[1]||"";
      if(code==="user-not-found"){setSent(true);setOk(isAr?"إذا كان البريد مسجّلاً سيصلك رابط":"If registered, a reset link has been sent");}
      else setErr(getErr(e.message,isAr));
    }
    finally{setLoading(false);}
  },[email,isAr]);

  const inp=(id,label,type,val,setVal,auto)=>(
    <div style={{marginBottom:16,position:"relative"}}>
      <label style={{
        display:"block",marginBottom:6,fontSize:12.5,fontWeight:500,
        color:focused===id?"#6366f1":"rgba(255,255,255,.5)",
        letterSpacing:".04em",textTransform:"uppercase",transition:"color .15s",
      }}>{label}</label>
      <div style={{position:"relative"}}>
        <input
          type={type} value={val}
          onChange={e=>setVal(e.target.value)}
          onFocus={()=>setFocused(id)} onBlur={()=>setFocused("")}
          autoComplete={auto} required
          style={{
            width:"100%",padding:"14px 16px",
            paddingRight:id==="pass"?48:16,
            background:"rgba(255,255,255,.05)",
            border:`1.5px solid ${focused===id?"#6366f1":"rgba(255,255,255,.08)"}`,
            borderRadius:12,fontSize:15,color:"#fff",outline:"none",
            transition:"border-color .15s",boxSizing:"border-box",
            fontFamily:"inherit",
          }}
        />
        {id==="pass"&&(
          <button type="button" onClick={()=>setShowP(v=>!v)}
            style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",
              background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",
              fontSize:16,padding:0,lineHeight:1}}>
            {showP?"🙈":"👁"}
          </button>
        )}
      </div>
    </div>
  );

  return(
    <div style={{
      minHeight:"100vh",background:"#0a0a0f",
      display:"flex",alignItems:"stretch",
      fontFamily:"'Inter','IBM Plex Sans Arabic',system-ui,sans-serif",
      direction:isAr?"rtl":"ltr",
    }}>

      {/* ── LEFT PANEL ── */}
      <div style={{
        flex:"0 0 480px",display:"flex",flexDirection:"column",
        padding:"48px 52px",position:"relative",overflow:"hidden",
        background:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)",
      }}>
        {/* Glow orbs */}
        <div style={{position:"absolute",top:-100,left:-100,width:400,height:400,
          background:"radial-gradient(circle,rgba(99,102,241,.3),transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:-50,right:-50,width:300,height:300,
          background:"radial-gradient(circle,rgba(139,92,246,.2),transparent 70%)",pointerEvents:"none"}}/>

        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:60,position:"relative"}}>
          <div style={{
            width:48,height:48,borderRadius:14,
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:24,boxShadow:"0 8px 32px rgba(99,102,241,.4)",
          }}>◈</div>
          <div>
            <div style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-.03em"}}>Corvus</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:1}}>
              {isAr?"صحة العمل بالذكاء الاصطناعي":"AI Workplace Health"}
            </div>
          </div>
        </div>

        {/* Headline */}
        <div style={{position:"relative",flex:1}}>
          <div style={{
            fontSize:42,fontWeight:800,lineHeight:1.15,
            letterSpacing:"-.03em",marginBottom:20,
            background:"linear-gradient(135deg,#fff 60%,rgba(255,255,255,.5))",
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
          }}>
            {isAr?"وضعية أفضل\nحياة أفضل":"Better posture,\nbetter life"}
          </div>
          <div style={{fontSize:16,color:"rgba(255,255,255,.5)",lineHeight:1.7,marginBottom:48}}>
            {isAr
              ?"تحليل ذكي فوري بالكاميرا — بدون أجهزة — يعمل على أي جهاز"
              :"Real-time AI camera analysis — no hardware — any device"}
          </div>

          {/* Features */}
          {[
            {icon:"⚡",t:isAr?"تحليل فوري":"Instant Analysis",d:isAr?"نتائج في أقل من ثانية":"Results in under a second"},
            {icon:"🧠",t:isAr?"مدرب AI شخصي":"Personal AI Coach",d:isAr?"نصائح مخصصة يومياً":"Daily personalized tips"},
            {icon:"📊",t:isAr?"تقارير متقدمة":"Advanced Reports",d:isAr?"PDF مفصّل بتحليل AI":"Detailed AI-powered PDF"},
            {icon:"🔒",t:isAr?"آمن 100%":"100% Private",d:isAr?"بياناتك على جهازك فقط":"Data stays on your device"},
          ].map((f,i)=>(
            <div key={i} style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:22}}>
              <div style={{
                width:40,height:40,flexShrink:0,borderRadius:10,
                background:"rgba(99,102,241,.15)",
                border:"1px solid rgba(99,102,241,.3)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
              }}>{f.icon}</div>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:"#fff",marginBottom:3}}>{f.t}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>{f.d}</div>
              </div>
            </div>
          ))}

          {/* Testimonial */}
          <div style={{
            marginTop:32,padding:"18px 20px",
            background:"rgba(255,255,255,.04)",
            border:"1px solid rgba(255,255,255,.08)",
            borderRadius:14,backdropFilter:"blur(10px)",
          }}>
            <div style={{display:"flex",gap:2,marginBottom:8}}>
              {"★★★★★".split("").map((s,i)=><span key={i} style={{color:"#f59e0b",fontSize:14}}>{s}</span>)}
            </div>
            <div style={{fontSize:13.5,color:"rgba(255,255,255,.6)",lineHeight:1.6,fontStyle:"italic"}}>
              {isAr
                ?'"Corvus غيّر طريقة عمل فريقنا — إنتاجية أعلى بـ 30%"'
                :'"Corvus transformed how our team works — 30% more productive"'}
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.3)",marginTop:8}}>
              {isAr?"أحمد، مدير تقنية — Tech Corp Egypt":"Ahmed, CTO — Tech Corp Egypt"}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        flex:1,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",
        padding:"48px 40px",background:"#0a0a0f",position:"relative",
      }}>
        {/* Top controls */}
        <div style={{position:"absolute",top:24,right:24,display:"flex",gap:8}}>
          <button onClick={()=>setLang(isAr?"en":"ar")}
            style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",
              borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:500,
              color:"rgba(255,255,255,.6)",cursor:"pointer"}}>
            {isAr?"🇬🇧 EN":"🇪🇬 عربي"}
          </button>
          <button onClick={()=>setDarkMode(!darkMode)}
            style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",
              borderRadius:8,padding:"6px 10px",fontSize:13,cursor:"pointer"}}>
            {darkMode?"☀️":"🌙"}
          </button>
        </div>

        {/* Form card */}
        <div style={{width:"100%",maxWidth:400}}>

          {view==="forgot"?(
            <>
              <button onClick={()=>go("login")} style={{
                background:"none",border:"none",color:"rgba(255,255,255,.4)",
                cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",
                gap:6,marginBottom:24,padding:0,fontFamily:"inherit",
              }}>← {isAr?"رجوع":"Back"}</button>
              <div style={{fontSize:28,fontWeight:800,color:"#fff",marginBottom:8,letterSpacing:"-.02em"}}>
                {isAr?"نسيت كلمة المرور؟":"Forgot password?"}
              </div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:32,lineHeight:1.6}}>
                {isAr?"أدخل بريدك وسنرسل رابط إعادة التعيين":"Enter your email and we'll send a reset link"}
              </div>
            </>
          ):(
            <>
              <div style={{fontSize:28,fontWeight:800,color:"#fff",marginBottom:6,letterSpacing:"-.02em"}}>
                {view==="signup"?(isAr?"إنشاء حساب جديد":"Create account"):(isAr?"أهلاً بعودتك 👋":"Welcome back 👋")}
              </div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:28}}>
                {view==="signup"
                  ?(isAr?"انضم إلى آلاف المستخدمين مجاناً":"Join thousands of users for free")
                  :(isAr?"سجّل دخول للمتابعة":"Sign in to continue")}
              </div>

              {/* Tabs */}
              <div style={{
                display:"flex",background:"rgba(255,255,255,.04)",
                border:"1px solid rgba(255,255,255,.06)",
                borderRadius:12,padding:4,marginBottom:24,gap:4,
              }}>
                {[["login",isAr?"دخول":"Sign In"],["signup",isAr?"حساب جديد":"Sign Up"]].map(([v,l])=>(
                  <button key={v} onClick={()=>go(v)} style={{
                    flex:1,padding:"10px 0",fontSize:14,fontWeight:600,
                    color:view===v?"#fff":"rgba(255,255,255,.4)",
                    background:view===v?"linear-gradient(135deg,#6366f1,#8b5cf6)":"transparent",
                    border:"none",borderRadius:9,cursor:"pointer",transition:"all .2s",
                    boxShadow:view===v?"0 4px 20px rgba(99,102,241,.4)":"none",
                    fontFamily:"inherit",
                  }}>{l}</button>
                ))}
              </div>
            </>
          )}

          {/* Google */}
          {view!=="forgot"&&(
            <>
              <button onClick={handleGoogle} disabled={loading} type="button" style={{
                width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:10,
                padding:"13px 0",marginBottom:20,
                background:"rgba(255,255,255,.06)",
                border:"1px solid rgba(255,255,255,.1)",
                borderRadius:12,fontSize:14,fontWeight:500,color:"#fff",
                cursor:loading?"wait":"pointer",transition:"all .15s",fontFamily:"inherit",
              }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.1)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.06)"}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isAr?"الدخول بـ Google":"Continue with Google"}
              </button>

              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                <div style={{flex:1,height:1,background:"rgba(255,255,255,.06)"}}/>
                <span style={{fontSize:12,color:"rgba(255,255,255,.25)"}}>
                  {isAr?"أو بالبريد":"or with email"}
                </span>
                <div style={{flex:1,height:1,background:"rgba(255,255,255,.06)"}}/>
              </div>
            </>
          )}

          {/* Form */}
          <form onSubmit={view==="forgot"?handleForgot:handleSubmit} noValidate>
            {view==="signup"&&inp("name",isAr?"الاسم الكامل":"Full name","text",name,setName,"name")}
            {inp("email",isAr?"البريد الإلكتروني":"Email","email",email,setEmail,"email")}
            {view!=="forgot"&&inp("pass",isAr?"كلمة المرور":"Password",showP?"text":"password",pass,setPass,view==="login"?"current-password":"new-password")}

            {/* Password strength */}
            {view==="signup"&&pass&&(
              <div style={{marginBottom:16,marginTop:-8}}>
                <div style={{display:"flex",gap:3,marginBottom:4}}>
                  {[1,2,3,4,5].map(i=>(
                    <div key={i} style={{
                      flex:1,height:3,borderRadius:99,transition:"background .2s",
                      background:i<=strength?sColors[Math.min(strength-1,4)]:"rgba(255,255,255,.08)",
                    }}/>
                  ))}
                </div>
                <div style={{fontSize:11,color:sColors[Math.min(strength-1,4)]||"rgba(255,255,255,.3)",fontWeight:500}}>
                  {sLabels[isAr?"ar":"en"][Math.min(strength-1,4)]||(isAr?"ضعيفة جداً":"Very weak")}
                </div>
              </div>
            )}

            {/* Forgot link */}
            {view==="login"&&(
              <div style={{textAlign:"right",marginBottom:20,marginTop:-4}}>
                <button type="button" onClick={()=>go("forgot")} style={{
                  background:"none",border:"none",fontSize:13,color:"#6366f1",
                  cursor:"pointer",padding:0,fontFamily:"inherit",
                }}>
                  {isAr?"نسيت كلمة المرور؟":"Forgot password?"}
                </button>
              </div>
            )}

            {/* Error */}
            {err&&(
              <div style={{
                background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",
                borderRadius:10,padding:"12px 14px",marginBottom:16,
                fontSize:13,color:"#fca5a5",display:"flex",gap:8,alignItems:"center",
              }}>⚠️ {err}</div>
            )}

            {/* Success */}
            {ok&&(
              <div style={{
                background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.2)",
                borderRadius:10,padding:"12px 14px",marginBottom:16,
                fontSize:13,color:"#86efac",lineHeight:1.6,
              }}>{ok}</div>
            )}

            {/* Submit */}
            {!sent&&(
              <button type="submit" disabled={loading} style={{
                width:"100%",padding:"14px 0",marginBottom:16,
                background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
                border:"none",borderRadius:12,
                fontSize:15,fontWeight:700,color:"#fff",
                cursor:loading?"wait":"pointer",
                boxShadow:loading?"none":"0 8px 32px rgba(99,102,241,.4)",
                transition:"all .2s",display:"flex",alignItems:"center",
                justifyContent:"center",gap:8,fontFamily:"inherit",
                opacity:loading?.7:1,
              }}>
                {loading
                  ?<div style={{width:18,height:18,border:"2.5px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                  :view==="login"?(isAr?"تسجيل الدخول ←":"Sign In →")
                  :view==="signup"?(isAr?"إنشاء الحساب ←":"Create Account →")
                  :(isAr?"إرسال رابط إعادة التعيين ←":"Send Reset Link →")}
              </button>
            )}

            {sent&&(
              <button type="button" onClick={()=>{setSent(false);setOk("");}} style={{
                width:"100%",padding:"13px 0",
                background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.3)",
                borderRadius:12,fontSize:14,fontWeight:500,color:"#a5b4fc",
                cursor:"pointer",fontFamily:"inherit",
              }}>{isAr?"إعادة إرسال":"Resend link"}</button>
            )}
          </form>

          {/* Footer */}
          <div style={{textAlign:"center",fontSize:12,color:"rgba(255,255,255,.25)",marginTop:8}}>
            {isAr?"دعم:":"Support:"}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{color:"#6366f1",textDecoration:"none"}}>
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        input::placeholder{color:rgba(255,255,255,.2)}
        input:-webkit-autofill{-webkit-box-shadow:0 0 0 100px #1a1a2e inset!important;-webkit-text-fill-color:#fff!important}
        *{box-sizing:border-box}
        button:focus-visible,input:focus-visible{outline:2px solid #6366f1;outline-offset:2px}
        @media(max-width:860px){
          .auth-left{display:none!important}
        }
      `}</style>
    </div>
  );
}
