/**
 * EmailVerificationPage — shown after signup, prompts user to verify email
 * Also handles the Firebase email verification link (?mode=verifyEmail&oobCode=XXX)
 */
import { useState, useEffect } from "react";
import { sendVerificationEmail, applyAction, auth } from "./firebase.js";

export default function EmailVerificationPage({ oobCode, user, darkMode, lang, onVerified, onSkip }) {
  const isAr = lang === "ar";
  const dark  = darkMode;

  const [step,    setStep]   = useState(oobCode ? "verifying" : "pending");
  const [sending, setSending]= useState(false);
  const [sent,    setSent]   = useState(false);
  const [err,     setErr]    = useState("");

  const c = dark ? {
    bg:"#030b14", card:"rgba(15,23,42,.9)", border:"rgba(255,255,255,.08)",
    text:"#f0f6ff", muted:"rgba(255,255,255,.4)", acc:"#3b82f6",
    btn:"linear-gradient(135deg,#1d4ed8,#0891b2)",
    secondary:"rgba(255,255,255,.06)",
  } : {
    bg:"#f0f4ff", card:"#ffffff", border:"rgba(0,0,0,.08)",
    text:"#0f172a", muted:"#64748b", acc:"#1a56db",
    btn:"linear-gradient(135deg,#1a56db,#0891b2)",
    secondary:"rgba(0,0,0,.05)",
  };

  // Apply verification code if arrived from email link
  useEffect(() => {
    if (!oobCode) return;
    applyAction(oobCode)
      .then(() => setStep("success"))
      .catch(() => setStep("error"));
  }, [oobCode]);

  const handleResend = async () => {
    setSending(true); setErr("");
    try {
      await sendVerificationEmail(user || auth.currentUser);
      setSent(true);
    } catch(e) {
      setErr(isAr?"فشل الإرسال — انتظر دقيقة وحاول مرة أخرى":"Failed — wait a minute and try again");
    } finally { setSending(false); }
  };

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
        borderRadius:20, padding:"36px 32px", textAlign:"center",
        boxShadow:dark?"0 24px 80px rgba(0,0,0,.6)":"0 20px 60px rgba(26,86,219,.12)",
      }}>
        {/* Logo */}
        <div style={{width:48,height:48,borderRadius:13,margin:"0 auto 20px",
          background:"linear-gradient(135deg,#1a56db,#0891b2)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,
          boxShadow:"0 8px 24px rgba(26,86,219,.3)"}}>◈</div>

        {/* Verifying */}
        {step==="verifying" && (
          <>
            <div style={{width:32,height:32,border:"3px solid rgba(26,86,219,.2)",borderTopColor:"#1a56db",
              borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/>
            <div style={{fontSize:16,color:c.muted}}>{isAr?"جاري التحقق من البريد…":"Verifying your email…"}</div>
          </>
        )}

        {/* Pending verification */}
        {step==="pending" && (
          <>
            <div style={{fontSize:40,marginBottom:12}}>📧</div>
            <div style={{fontSize:19,fontWeight:700,color:c.text,marginBottom:8}}>
              {isAr?"تحقق من بريدك":"Verify your email"}
            </div>
            <div style={{fontSize:13.5,color:c.muted,marginBottom:6,lineHeight:1.6}}>
              {isAr?"أرسلنا رابط التحقق إلى:":"We sent a verification link to:"}
            </div>
            <div style={{fontSize:14,fontWeight:600,color:c.text,marginBottom:24,
              padding:"8px 14px",background:c.secondary,borderRadius:8,display:"inline-block"}}>
              {user?.email || "your email"}
            </div>
            <div style={{fontSize:13,color:c.muted,marginBottom:20,lineHeight:1.6}}>
              {isAr?"افتح البريد واضغط على الرابط لتفعيل حسابك"
                   :"Open your email and click the link to activate your account"}
            </div>

            {err && (
              <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",
                borderRadius:8,padding:"10px",marginBottom:16,fontSize:13,color:dark?"#f87171":"#dc2626"}}>
                {err}
              </div>
            )}

            {sent ? (
              <div style={{color:dark?"#4ade80":"#16a34a",fontSize:13,marginBottom:16,fontWeight:500}}>
                ✓ {isAr?"تم إرسال بريد التحقق مرة أخرى":"Verification email resent"}
              </div>
            ) : (
              <button onClick={handleResend} disabled={sending} style={{
                width:"100%",padding:"12px",marginBottom:12,
                background:sending?"rgba(26,86,219,.4)":c.btn,
                border:"none",borderRadius:10,fontSize:14,fontWeight:600,
                color:"#fff",cursor:sending?"wait":"pointer",fontFamily:"inherit",
                boxShadow:sending?"none":"0 6px 24px rgba(26,86,219,.25)",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              }}>
                {sending
                  ? <div style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                  : (isAr?"إعادة إرسال البريد":"Resend verification email")}
              </button>
            )}

            <button onClick={onSkip} style={{
              width:"100%",padding:"11px",
              background:c.secondary,border:`1px solid ${c.border}`,
              borderRadius:10,fontSize:13.5,fontWeight:500,
              color:c.muted,cursor:"pointer",fontFamily:"inherit",transition:"all .15s",
            }}
            onMouseEnter={e=>e.currentTarget.style.color=c.text}
            onMouseLeave={e=>e.currentTarget.style.color=c.muted}>
              {isAr?"تخطي الآن (تحقق لاحقاً)":"Skip for now (verify later)"}
            </button>
          </>
        )}

        {/* Success */}
        {step==="success" && (
          <>
            <div style={{width:56,height:56,borderRadius:"50%",margin:"0 auto 16px",
              background:"rgba(34,197,94,.1)",border:"2px solid rgba(34,197,94,.3)",
              display:"flex",alignItems:"center",justifyContent:"center",
              animation:"popIn .4s cubic-bezier(.34,1.56,.64,1)"}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={{fontSize:19,fontWeight:700,color:c.text,marginBottom:8}}>
              {isAr?"تم التحقق بنجاح!":"Email Verified!"}
            </div>
            <div style={{fontSize:13.5,color:c.muted,marginBottom:24,lineHeight:1.6}}>
              {isAr?"تم التحقق من بريدك الإلكتروني. حسابك مفعّل الآن."
                   :"Your email has been verified. Your account is now active."}
            </div>
            <button onClick={onVerified} style={{
              background:c.btn,border:"none",borderRadius:10,
              padding:"13px 28px",fontSize:14.5,fontWeight:700,color:"#fff",
              cursor:"pointer",fontFamily:"inherit",
              boxShadow:"0 6px 24px rgba(26,86,219,.3)",
            }}>{isAr?"الدخول إلى Corvus →":"Enter Corvus →"}</button>
          </>
        )}

        {/* Error */}
        {step==="error" && (
          <>
            <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
            <div style={{fontSize:19,fontWeight:700,color:c.text,marginBottom:8}}>
              {isAr?"رابط غير صالح":"Invalid Link"}
            </div>
            <div style={{fontSize:13.5,color:c.muted,marginBottom:24,lineHeight:1.6}}>
              {isAr?"هذا الرابط منتهي الصلاحية. اطلب رابطاً جديداً من الإعدادات."
                   :"This link has expired. Request a new one from settings."}
            </div>
            <button onClick={onSkip} style={{
              background:c.btn,border:"none",borderRadius:10,
              padding:"12px 24px",fontSize:14,fontWeight:600,color:"#fff",
              cursor:"pointer",fontFamily:"inherit",
            }}>{isAr?"متابعة":"Continue"}</button>
          </>
        )}
      </div>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes popIn { from { opacity:0; transform:scale(.6) } to { opacity:1; transform:scale(1) } }
        * { box-sizing: border-box }
      `}</style>
    </div>
  );
}
