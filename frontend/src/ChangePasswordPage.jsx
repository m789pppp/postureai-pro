/**
 * ChangePasswordPage — for logged-in users to change their password
 * Requires re-authentication with current password
 */
import { useState } from "react";
import { changePassword } from "./firebase.js";

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

export default function ChangePasswordPage({ darkMode, lang, onClose }) {
  const isAr = lang === "ar";
  const dark  = darkMode;

  const [current,  setCurrent]  = useState("");
  const [newPass,  setNewPass]  = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showC,    setShowC]    = useState(false);
  const [showN,    setShowN]    = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");
  const [success,  setSuccess]  = useState(false);

  const c = dark ? {
    bg:"rgba(15,23,42,.95)", border:"rgba(255,255,255,.08)",
    text:"#f0f6ff", muted:"rgba(255,255,255,.4)",
    inp:"rgba(255,255,255,.05)", inpB:"rgba(255,255,255,.1)", inpBF:"#3b82f6",
    btn:"linear-gradient(135deg,#1d4ed8,#0891b2)", acc:"#3b82f6",
  } : {
    bg:"#ffffff", border:"rgba(0,0,0,.08)",
    text:"#0f172a", muted:"#64748b",
    inp:"#f8fafc", inpB:"rgba(0,0,0,.1)", inpBF:"#1a56db",
    btn:"linear-gradient(135deg,#1a56db,#0891b2)", acc:"#1a56db",
  };

  const score   = pwScore(newPass);
  const sColors = ["#ef4444","#f97316","#eab308","#22c55e","#22c55e"];

  const handleSubmit = async e => {
    e.preventDefault();
    if (!current)              { setErr(isAr?"أدخل كلمة المرور الحالية":"Enter current password"); return; }
    if (newPass.length < 6)    { setErr(isAr?"كلمة المرور الجديدة 6 أحرف على الأقل":"New password: min 6 characters"); return; }
    if (newPass !== confirm)   { setErr(isAr?"كلمتا المرور غير متطابقتين":"Passwords don't match"); return; }
    if (newPass === current)   { setErr(isAr?"كلمة المرور الجديدة مطابقة للقديمة":"New password must be different"); return; }

    setErr(""); setLoading(true);
    try {
      await changePassword(current, newPass);
      setSuccess(true);
    } catch(e) {
      const code = e.code || "";
      if (code.includes("wrong-password") || code.includes("invalid-credential"))
        setErr(isAr?"كلمة المرور الحالية غلط":"Wrong current password");
      else if (code.includes("too-many-requests"))
        setErr(isAr?"محاولات كثيرة — انتظر":"Too many attempts — wait");
      else
        setErr(isAr?"حدث خطأ — حاول مرة أخرى":"Something went wrong — try again");
    } finally { setLoading(false); }
  };

  const inp = (id, label, type, val, setV, show, setShow) => (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",marginBottom:5,fontSize:11.5,fontWeight:600,
        color:c.muted,letterSpacing:".06em",textTransform:"uppercase"}}>
        {label}
      </label>
      <div style={{position:"relative"}}>
        <input type={show?"text":type} value={val}
          onChange={e=>setV(e.target.value)}
          required autoComplete={id==="current"?"current-password":"new-password"}
          style={{width:"100%",padding:"12px 44px 12px 14px",
            background:c.inp,border:`1.5px solid ${c.inpB}`,
            borderRadius:10,fontSize:14.5,color:c.text,outline:"none",
            boxSizing:"border-box",fontFamily:"inherit",transition:"border .2s",
          }}
          onFocus={e=>e.target.style.borderColor=c.inpBF}
          onBlur={e=>e.target.style.borderColor=c.inpB}
        />
        <button type="button" onClick={()=>setShow(v=>!v)} tabIndex={-1} style={{
          position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",
          background:"none",border:"none",color:c.muted,cursor:"pointer",
          fontSize:15,padding:0,lineHeight:1,
        }}>{show?"🙈":"👁"}</button>
      </div>
    </div>
  );

  return (
    <div style={{
      position:"fixed",inset:0,zIndex:1000,
      display:"flex",alignItems:"center",justifyContent:"center",
      background:"rgba(0,0,0,.6)",backdropFilter:"blur(8px)",
      padding:16,fontFamily:"'Inter',system-ui,sans-serif",
      direction:isAr?"rtl":"ltr",
    }} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{
        width:"100%",maxWidth:400,
        background:c.bg,border:`1px solid ${c.border}`,
        borderRadius:20,padding:"32px 28px",
        boxShadow:"0 24px 80px rgba(0,0,0,.5)",
        animation:"slideUp .3s cubic-bezier(.34,1.56,.64,1)",
      }}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:c.text}}>{isAr?"تغيير كلمة المرور":"Change Password"}</div>
            <div style={{fontSize:12.5,color:c.muted,marginTop:2}}>
              {isAr?"أدخل كلمة مرورك الحالية للتحقق":"Enter your current password to verify"}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",
            color:c.muted,cursor:"pointer",fontSize:20,lineHeight:1,padding:4,
            borderRadius:6,transition:"color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.color=c.text}
            onMouseLeave={e=>e.currentTarget.style.color=c.muted}>✕</button>
        </div>

        {success ? (
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{width:52,height:52,borderRadius:"50%",margin:"0 auto 14px",
              background:"rgba(34,197,94,.1)",border:"2px solid rgba(34,197,94,.3)",
              display:"flex",alignItems:"center",justifyContent:"center",
              animation:"popIn .4s cubic-bezier(.34,1.56,.64,1)"}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={{fontSize:17,fontWeight:700,color:c.text,marginBottom:6}}>
              {isAr?"تم تغيير كلمة المرور!":"Password Changed!"}
            </div>
            <div style={{fontSize:13,color:c.muted,marginBottom:20}}>
              {isAr?"تم تحديث كلمة المرور بنجاح":"Your password has been updated successfully"}
            </div>
            <button onClick={onClose} style={{
              background:c.btn,border:"none",borderRadius:10,
              padding:"11px 24px",fontSize:14,fontWeight:600,color:"#fff",
              cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 16px rgba(26,86,219,.3)",
            }}>{isAr?"إغلاق":"Close"}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {inp("current", isAr?"كلمة المرور الحالية":"Current Password", "password", current, setCurrent, showC, setShowC)}

            <div style={{height:1,background:dark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)",margin:"16px 0"}}/>

            {inp("new", isAr?"كلمة المرور الجديدة":"New Password", "password", newPass, setNewPass, showN, setShowN)}

            {/* Strength */}
            {newPass && (
              <div style={{marginBottom:14,marginTop:-6}}>
                <div style={{display:"flex",gap:3,marginBottom:3}}>
                  {[1,2,3,4,5].map(i=>(
                    <div key={i} style={{flex:1,height:3,borderRadius:99,
                      background:i<=score?sColors[Math.min(score,5)-1]:(dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"),
                      transition:"background .3s"}}/>
                  ))}
                </div>
                <div style={{fontSize:11,color:sColors[Math.min(score,5)-1]||c.muted,fontWeight:500}}>
                  {["","Weak","Fair","Good","Strong","Excellent"][Math.min(score,5)]}
                </div>
              </div>
            )}

            {inp("confirm", isAr?"تأكيد كلمة المرور الجديدة":"Confirm New Password", "password", confirm, setConfirm, false, ()=>{})}

            {err && (
              <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",
                borderRadius:8,padding:"10px 12px",marginBottom:14,
                fontSize:13,color:dark?"#f87171":"#dc2626"}}>
                ⚠️ {err}
              </div>
            )}

            <div style={{display:"flex",gap:10}}>
              <button type="button" onClick={onClose} style={{
                flex:1,padding:"12px",background:"transparent",
                border:`1px solid ${c.border}`,borderRadius:10,
                fontSize:13.5,fontWeight:500,color:c.muted,
                cursor:"pointer",fontFamily:"inherit",transition:"all .15s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=c.acc;e.currentTarget.style.color=c.text;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=c.border;e.currentTarget.style.color=c.muted;}}>
                {isAr?"إلغاء":"Cancel"}
              </button>
              <button type="submit" disabled={loading} style={{
                flex:2,padding:"12px",
                background:loading?"rgba(26,86,219,.4)":c.btn,
                border:"none",borderRadius:10,
                fontSize:13.5,fontWeight:700,color:"#fff",
                cursor:loading?"wait":"pointer",fontFamily:"inherit",
                boxShadow:loading?"none":"0 4px 16px rgba(26,86,219,.25)",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                transition:"all .2s",
              }}>
                {loading
                  ? <div style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                  : (isAr?"تغيير كلمة المرور":"Change Password")}
              </button>
            </div>
          </form>
        )}
      </div>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:none } }
        @keyframes popIn   { from { opacity:0; transform:scale(.6) } to { opacity:1; transform:scale(1) } }
        * { box-sizing: border-box }
        input::placeholder { color:${dark?"rgba(255,255,255,.2)":"rgba(0,0,0,.25)"}!important }
      `}</style>
    </div>
  );
}
