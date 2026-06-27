/**
 * ResetPasswordPage — handles Firebase password reset link
 * URL: /?mode=resetPassword&oobCode=XXX
 */
import { useState, useEffect } from "react";
import { verifyResetCode, confirmReset } from "./firebase.js";

function pwScore(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8)           s++;
  if (/[A-Z]/.test(p))         s++;
  if (/[a-z]/.test(p))         s++;
  if (/[0-9]/.test(p))         s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

export default function ResetPasswordPage({ oobCode, darkMode, lang, onDone }) {
  const isAr = lang === "ar";
  const dark  = darkMode;

  const [step,     setStep]    = useState("loading"); // loading|form|success|error
  const [email,    setEmail]   = useState("");
  const [pass,     setPass]    = useState("");
  const [pass2,    setPass2]   = useState("");
  const [showP,    setShowP]   = useState(false);
  const [loading,  setLoading] = useState(false);
  const [err,      setErr]     = useState("");

  const c = dark ? {
    bg:"#030b14", card:"rgba(15,23,42,.9)", border:"rgba(255,255,255,.08)",
    text:"#f0f6ff", muted:"rgba(255,255,255,.4)", inp:"rgba(255,255,255,.05)",
    inpB:"rgba(255,255,255,.1)", inpBF:"#3b82f6", acc:"#3b82f6",
    btn:"linear-gradient(135deg,#1d4ed8,#0891b2)",
  } : {
    bg:"#f0f4ff", card:"#ffffff", border:"rgba(0,0,0,.08)",
    text:"#0f172a", muted:"#64748b", inp:"#f8fafc",
    inpB:"rgba(0,0,0,.1)", inpBF:"#1a56db", acc:"#1a56db",
    btn:"linear-gradient(135deg,#1a56db,#0891b2)",
  };

  // Verify the code on mount
  useEffect(() => {
    if (!oobCode) { setStep("error"); return; }
    verifyResetCode(oobCode)
      .then(email => { setEmail(email); setStep("form"); })
      .catch(() => setStep("error"));
  }, [oobCode]);

  const handleSubmit = async e => {
    e.preventDefault();
    if (pass.length < 6) { setErr(isAr?"6 أحرف على الأقل":"Min 6 characters"); return; }
    if (pass !== pass2)  { setErr(isAr?"كلمتا المرور غير متطابقتين":"Passwords don't match"); return; }
    setErr(""); setLoading(true);
    try {
      await confirmReset(oobCode, pass);
      setStep("success");
    } catch(e) {
      if (e.code === "auth/expired-action-code")
        setErr(isAr?"انتهت صلاحية الرابط — اطلب رابطاً جديداً":"Link expired — request a new one");
      else
        setErr(isAr?"حدث خطأ — حاول مرة أخرى":"Something went wrong — try again");
    } finally { setLoading(false); }
  };

  const score  = pwScore(pass);
  const sColor = ["#ef4444","#f97316","#eab308","#22c55e","#22c55e"][Math.min(score,5)-1] || c.muted;

  const inp = (value, onChange, placeholder, type="text") => (
    <input type={type} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} required
      style={{
        width:"100%", padding:"13px 16px", marginBottom:12,
        background:c.inp, border:`1.5px solid ${c.inpB}`,
        borderRadius:10, fontSize:14.5, color:c.text, outline:"none",
        boxSizing:"border-box", fontFamily:"inherit",
      }}
      onFocus={e=>e.target.style.borderColor=c.inpBF}
      onBlur={e=>e.target.style.borderColor=c.inpB}
    />
  );

  return (
    <div style={{
      minHeight:"100vh", background:c.bg, display:"flex",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Inter',system-ui,sans-serif", padding:24,
      direction:isAr?"rtl":"ltr",
    }}>
      <div style={{
        width:"100%", maxWidth:400,
        background:c.card, border:`1px solid ${c.border}`,
        borderRadius:20, padding:"36px 32px",
        boxShadow:dark?"0 24px 80px rgba(0,0,0,.6)":"0 20px 60px rgba(26,86,219,.12)",
      }}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{width:48,height:48,borderRadius:13,margin:"0 auto 12px",
            background:"linear-gradient(135deg,#1a56db,#0891b2)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,
            boxShadow:"0 8px 24px rgba(26,86,219,.3)"}}>◈</div>
          <div style={{fontSize:18,fontWeight:800,color:c.text}}>Corvus</div>
        </div>

        {/* Loading */}
        {step==="loading" && (
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{width:32,height:32,border:"3px solid rgba(26,86,219,.2)",borderTopColor:"#1a56db",
              borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 12px"}}/>
            <div style={{color:c.muted,fontSize:14}}>{isAr?"جاري التحقق…":"Verifying link…"}</div>
          </div>
        )}

        {/* Error */}
        {step==="error" && (
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
            <div style={{fontSize:18,fontWeight:700,color:c.text,marginBottom:8}}>
              {isAr?"رابط غير صالح":"Invalid or Expired Link"}
            </div>
            <div style={{fontSize:13.5,color:c.muted,marginBottom:24,lineHeight:1.6}}>
              {isAr?"هذا الرابط منتهي الصلاحية أو استُخدم بالفعل. اطلب رابطاً جديداً."
                   :"This link has expired or already been used. Please request a new reset link."}
            </div>
            <button onClick={onDone} style={{
              background:c.btn,border:"none",borderRadius:10,
              padding:"12px 28px",fontSize:14,fontWeight:600,color:"#fff",
              cursor:"pointer",fontFamily:"inherit",
            }}>{isAr?"طلب رابط جديد":"Request New Link"}</button>
          </div>
        )}

        {/* Form */}
        {step==="form" && (
          <>
            <div style={{fontSize:19,fontWeight:700,color:c.text,marginBottom:6}}>
              {isAr?"إنشاء كلمة مرور جديدة":"Create New Password"}
            </div>
            <div style={{fontSize:13.5,color:c.muted,marginBottom:20,lineHeight:1.6}}>
              {isAr?`إنشاء كلمة مرور جديدة لـ ${email}`:`Creating new password for ${email}`}
            </div>
            <form onSubmit={handleSubmit} noValidate>
              <div style={{position:"relative",marginBottom:0}}>
                {inp(pass, setPass, isAr?"كلمة المرور الجديدة":"New password", showP?"text":"password")}
                <button type="button" onClick={()=>setShowP(v=>!v)} style={{
                  position:"absolute",right:14,top:14,background:"none",border:"none",
                  color:c.muted,cursor:"pointer",fontSize:15,padding:0,
                }}>
                  {showP?"🙈":"👁"}
                </button>
              </div>

              {/* Strength */}
              {pass && (
                <div style={{marginBottom:12}}>
                  <div style={{display:"flex",gap:3,marginBottom:3}}>
                    {[1,2,3,4,5].map(i=>(
                      <div key={i} style={{flex:1,height:3,borderRadius:99,
                        background:i<=score?sColor:(dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"),
                        transition:"background .3s"}}/>
                    ))}
                  </div>
                </div>
              )}

              {inp(pass2, setPass2, isAr?"تأكيد كلمة المرور":"Confirm new password", "password")}

              {err && (
                <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",
                  borderRadius:8,padding:"10px 12px",marginBottom:12,
                  fontSize:13,color:dark?"#f87171":"#dc2626"}}>
                  ⚠️ {err}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width:"100%",padding:"13px 0",
                background:loading?"rgba(26,86,219,.4)":c.btn,
                border:"none",borderRadius:10,fontSize:14.5,fontWeight:700,
                color:"#fff",cursor:loading?"wait":"pointer",
                boxShadow:loading?"none":"0 6px 24px rgba(26,86,219,.3)",
                display:"flex",alignItems:"center",justifyContent:"center",
                gap:8,fontFamily:"inherit",transition:"all .2s",
              }}>
                {loading
                  ? <div style={{width:17,height:17,border:"2.5px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                  : (isAr?"تعيين كلمة المرور الجديدة →":"Set New Password →")}
              </button>
            </form>
          </>
        )}

        {/* Success */}
        {step==="success" && (
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{width:56,height:56,borderRadius:"50%",margin:"0 auto 16px",
              background:"rgba(34,197,94,.1)",border:"2px solid rgba(34,197,94,.3)",
              display:"flex",alignItems:"center",justifyContent:"center",
              animation:"popIn .4s cubic-bezier(.34,1.56,.64,1)"}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={{fontSize:19,fontWeight:700,color:c.text,marginBottom:8}}>
              {isAr?"تم تغيير كلمة المرور!":"Password Changed!"}
            </div>
            <div style={{fontSize:13.5,color:c.muted,marginBottom:24,lineHeight:1.6}}>
              {isAr?"تم تعيين كلمة مرور جديدة بنجاح. يمكنك الآن تسجيل الدخول."
                   :"Your password has been changed successfully. You can now sign in."}
            </div>
            <button onClick={onDone} style={{
              background:c.btn,border:"none",borderRadius:10,
              padding:"13px 28px",fontSize:14.5,fontWeight:700,color:"#fff",
              cursor:"pointer",fontFamily:"inherit",
              boxShadow:"0 6px 24px rgba(26,86,219,.3)",
            }}>{isAr?"تسجيل الدخول →":"Sign In →"}</button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes popIn  { from { opacity:0; transform:scale(.6) } to { opacity:1; transform:scale(1) } }
        * { box-sizing: border-box }
        input::placeholder { color:${dark?"rgba(255,255,255,.2)":"rgba(0,0,0,.25)"}!important }
      `}</style>
    </div>
  );
}
