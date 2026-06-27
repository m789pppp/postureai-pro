/**
 * Corvus — ProfilePage v32
 * Full profile: edit info, stats, subscription, payments, password, referral
 */
import { useState, useEffect } from "react";
import {
  updateUserProfile, getUserSessions, SUPPORT_EMAIL, ADMIN_PHONE,
  getAuthToken,
} from "./firebase.js";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, getAuth } from "firebase/auth";
import { tierAtLeast } from "./lib/tierQuality.js";

const sc = v => v>=75?"#10b981":v>=50?"#f59e0b":"#ef4444";
const API = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

function Card({ children, style={} }) {
  return <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:16, padding:"20px 22px", marginBottom:14, ...style }}>{children}</div>;
}
function Label({ children }) {
  return <div style={{ fontSize:10, color:"#64748b", fontWeight:600, textTransform:"uppercase", letterSpacing:".07em", marginBottom:8 }}>{children}</div>;
}
function Row({ label, value, color }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,.05)" }}>
      <span style={{ fontSize:12, color:"#64748b" }}>{label}</span>
      <span style={{ fontSize:12.5, fontWeight:600, color:color||"#f0f6ff" }}>{value||"—"}</span>
    </div>
  );
}
function Inp({ value, onChange, placeholder, type="text", disabled=false }) {
  return (
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type} disabled={disabled}
      style={{ width:"100%", background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.08)", borderRadius:9, padding:"10px 14px", fontSize:13, color:"#f0f6ff", outline:"none", fontFamily:"inherit", boxSizing:"border-box", opacity:disabled?.5:1 }}/>
  );
}

export default function ProfilePage({ user, profile, sessions=[], cs, lang="en", onBack, onSave, addToast, setPage, onSignOut, t }) {
  const isAr = lang==="ar";
  const [name,    setName]    = useState(profile?.name||"");
  const [company, setComp]    = useState(profile?.company||"");
  const [saving,  setSaving]  = useState(false);
  const [tab,     setTab]     = useState("profile");
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loadingPay, setLoadingPay] = useState(false);
  const [cancelStep, setCancelStep] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const avg = sessions.length
    ? Math.round(sessions.reduce((a,s)=>a+(s.avg_score||0),0)/sessions.length)
    : (profile?.avg_score||0);

  const refLink = `${window.location.origin}?ref=${user.uid.slice(0,8)}&plan=professional`;

  // Load payment history
  useEffect(()=>{
    if(tab!=="billing") return;
    setLoadingPay(true);
    getAuthToken().then(tok=>{
      return fetch(`${API}/user/payments`,{
        headers:{ ...(tok?{Authorization:`Bearer ${tok}`}:{}) }
      });
    }).then(r=>r.ok?r.json():null)
      .then(d=>{ if(d?.payments) setPayments(d.payments); })
      .catch(()=>{})
      .finally(()=>setLoadingPay(false));
  },[tab]);

  async function save() {
    setSaving(true);
    try {
      await updateUserProfile(user.uid,{ name:name.trim(), company:company.trim() });
      onSave?.({ ...profile, name:name.trim(), company:company.trim() });
      addToast(isAr?"تم الحفظ ✓":"Saved ✓","success");
    } catch { addToast(isAr?"خطأ في الحفظ":"Save error","error"); }
    setSaving(false);
  }

  async function changePassword() {
    if(!oldPass||!newPass) { setPassMsg(isAr?"أدخل كلمتي المرور":"Enter both passwords"); return; }
    if(newPass.length<6)   { setPassMsg(isAr?"كلمة المرور الجديدة قصيرة جداً (6+ أحرف)":"New password too short (6+ chars)"); return; }
    setChangingPass(true); setPassMsg("");
    try {
      const auth = getAuth();
      const cred = EmailAuthProvider.credential(user.email, oldPass);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPass);
      setPassMsg(isAr?"✅ تم تغيير كلمة المرور":"✅ Password changed");
      setOldPass(""); setNewPass("");
    } catch(e) {
      const code = e.code||"";
      if(code.includes("wrong-password")||code.includes("invalid-credential"))
        setPassMsg(isAr?"كلمة المرور الحالية غلط":"Current password is incorrect");
      else setPassMsg(isAr?"خطأ — حاول تاني":"Error — try again");
    }
    setChangingPass(false);
  }

  async function cancelSubscription() {
    setCancelling(true);
    try {
      const tok = await getAuthToken();
      await fetch(`${API}/subscription/cancel`,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(tok?{Authorization:`Bearer ${tok}`}:{})},
        body: JSON.stringify({ uid:user.uid, email:user.email, tier:profile.tier }),
      });
      addToast(isAr?"تم إرسال طلب الإلغاء — سيتم المعالجة خلال 24 ساعة":"Cancellation sent — will process within 24h","info");
      setCancelStep(2);
    } catch { addToast(isAr?"خطأ":"Error","error"); }
    setCancelling(false);
  }

  const tierColor = tierAtLeast(profile?.tier,"elite")?"#f59e0b":tierAtLeast(profile?.tier,"professional")?"#0ea5e9":"#6366f1";

  const tabs = [
    ["profile",  isAr?"الملف الشخصي":"Profile",   "👤"],
    ["stats",    isAr?"الإحصائيات":"Statistics",  "📊"],
    ["billing",  isAr?"الاشتراك":"Subscription",  "💳"],
    ["security", isAr?"الأمان":"Security",         "🔒"],
    ["referral", isAr?"الإحالة":"Referral",        "🔗"],
  ];

  return (
    <div dir={isAr?"rtl":"ltr"} style={{minHeight:"100vh",background:"#030b14",color:"#f0f6ff",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Top nav */}
      <div style={{ padding:"0 20px",height:54,background:"rgba(5,16,31,.95)",borderBottom:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50,backdropFilter:"blur(12px)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <button onClick={onBack} style={{ background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,padding:"6px 12px",fontSize:12,color:"#94a3b8",cursor:"pointer" }}>
            ← {isAr?"رجوع":"Back"}
          </button>
          <button onClick={()=>{ onSignOut?.(); }} style={{ background:"rgba(239,68,68,.1)",
            border:"1px solid rgba(239,68,68,.2)", borderRadius:8, padding:"6px 14px",
            fontSize:12, color:"#f87171", cursor:"pointer", fontWeight:600, marginLeft:8 }}>
            {isAr ? "⏻ تسجيل الخروج" : "⏻ Sign Out"}
          </button>
          <div style={{ fontSize:14,fontWeight:700 }}>👤 {isAr?"الملف الشخصي":"Profile"}</div>
        </div>
        <button onClick={()=>setPage("pricing")} style={{ background:"rgba(26,86,219,.12)",border:"1px solid rgba(26,86,219,.3)",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,color:"#60a5fa",cursor:"pointer" }}>
          ↑ {isAr?"ترقية":"Upgrade"}
        </button>
      </div>

      <div style={{ maxWidth:640,margin:"0 auto",padding:"20px 20px 80px" }}>

        {/* Avatar + name */}
        <div style={{ display:"flex",alignItems:"center",gap:16,padding:"20px 22px",background:"rgba(26,86,219,.06)",border:"1px solid rgba(26,86,219,.18)",borderRadius:18,marginBottom:20 }}>
          <div style={{ width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#1a56db,#0891b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"#fff",flexShrink:0 }}>
            {(profile?.name||user.email||"U")[0].toUpperCase()}
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:16,fontWeight:800,color:"#f0f6ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{profile?.name||user.email?.split("@")[0]}</div>
            <div style={{ fontSize:11.5,color:"#64748b",marginTop:2 }}>{user.email}</div>
            <div style={{ display:"inline-flex",alignItems:"center",gap:5,marginTop:6,background:`${tierColor}15`,border:`1px solid ${tierColor}30`,borderRadius:99,padding:"2px 10px" }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:tierColor }}/>
              <span style={{ fontSize:10,fontWeight:700,color:tierColor,textTransform:"uppercase" }}>{profile?.tier||"standard"}</span>
            </div>
          </div>
          {avg>0&&<div style={{ textAlign:"center",flexShrink:0 }}>
            <div style={{ fontSize:24,fontWeight:900,color:sc(avg),lineHeight:1 }}>{avg}</div>
            <div style={{ fontSize:9,color:"#64748b",marginTop:2 }}>/100 avg</div>
          </div>}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex",gap:3,background:"rgba(148,163,184,.06)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:4,marginBottom:18,overflowX:"auto" }}>
          {tabs.map(([id,label,icon])=>(
            <button key={id} onClick={()=>setTab(id)}
              style={{ flex:"0 0 auto",padding:"8px 14px",fontSize:11.5,fontWeight:tab===id?700:500,background:tab===id?"#1a56db":"transparent",color:tab===id?"#fff":"#64748b",border:"none",borderRadius:9,cursor:"pointer",transition:"all .18s",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap" }}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {tab==="profile"&&(
          <Card>
            <Label>{isAr?"تعديل المعلومات":"Edit Information"}</Label>
            <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:14 }}>
              <Inp value={name} onChange={setName} placeholder={isAr?"الاسم الكامل":"Full name"}/>
              <Inp value={company} onChange={setComp} placeholder={isAr?"الشركة (اختياري)":"Company (optional)"}/>
              <Inp value={user.email} onChange={()=>{}} placeholder="Email" disabled/>
            </div>
            <button onClick={save} disabled={saving}
              style={{ background:"#1a56db",border:"none",borderRadius:10,padding:"11px 0",width:"100%",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",opacity:saving?.6:1 }}>
              {saving?"...":(isAr?"حفظ التغييرات":"Save Changes")}
            </button>
          </Card>
        )}

        {/* ── STATS TAB ── */}
        {tab==="stats"&&(
          <>
            <Card>
              <Label>{isAr?"إحصائيات الجلسات":"Session Statistics"}</Label>
              <Row label={isAr?"إجمالي الجلسات":"Total Sessions"} value={sessions.length}/>
              <Row label={isAr?"متوسط النقاط":"Average Score"} value={avg?`${avg}/100`:isAr?"لا توجد بيانات":"No data"} color={avg?sc(avg):undefined}/>
              <Row label={isAr?"أفضل نقاط":"Best Score"} value={sessions.length?`${Math.max(...sessions.map(s=>s.avg_score||0))}/100`:undefined} color="#10b981"/>
              <Row label={isAr?"جلسات هذا الشهر":"This Month"} value={sessions.filter(s=>{const d=s.created_at?.toDate?.()??new Date(s.created_at||0);const n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();}).length}/>
              <Row label={isAr?"أيام متتالية":"Streak"} value={profile?.streak_days||(sessions.length>0?1:0)} color="#f59e0b"/>
              <Row label={isAr?"عضو منذ":"Member Since"} value={profile?.created_at?.toDate?.()?.toLocaleDateString?.()||"—"}/>
            </Card>
            {sessions.length>0&&(
              <Card>
                <Label>{isAr?"آخر 10 جلسات":"Last 10 Sessions"}</Label>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {sessions.slice(0,10).map((s,i)=>{
                    const d=s.created_at?.toDate?.()??new Date(s.created_at||0);
                    return(
                      <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.05)" }}>
                        <div style={{ width:7,height:7,borderRadius:"50%",background:sc(s.avg_score||0),flexShrink:0 }}/>
                        <span style={{ fontSize:11,color:"#64748b",width:80,flexShrink:0 }}>{d.toLocaleDateString()}</span>
                        <span style={{ fontSize:11,color:"#475569",flex:1 }}>{s.mode||"laptop"} · {s.tier||"standard"}</span>
                        <span style={{ fontSize:13,fontWeight:700,color:sc(s.avg_score||0) }}>{s.avg_score||0}/100</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── BILLING TAB ── */}
        {tab==="billing"&&(
          <>
            <Card>
              <Label>{isAr?"الخطة الحالية":"Current Plan"}</Label>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:10 }}>
                <div>
                  <div style={{ fontSize:18,fontWeight:800,color:tierColor,textTransform:"capitalize" }}>{profile?.tier||"Standard"}</div>
                  <div style={{ fontSize:11,color:"#64748b",marginTop:2 }}>
                    {profile?.subscription_end
                      ? `${isAr?"ينتهي":"Expires"}: ${new Date(profile.subscription_end).toLocaleDateString()}`
                      : profile?.is_trial
                        ? (isAr?"تجربة مجانية":"Free Trial")
                        : (isAr?"خطة مجانية":"Free Plan")}
                  </div>
                </div>
                <button onClick={()=>setPage("pricing")}
                  style={{ background:"#1a56db",border:"none",borderRadius:9,padding:"9px 18px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer" }}>
                  {tierAtLeast(profile?.tier,"elite")?(isAr?"إدارة الخطة":"Manage Plan"):(isAr?"ترقية ←":"Upgrade →")}
                </button>
              </div>
              <Row label={isAr?"طريقة الفوترة":"Billing"} value={profile?.subscription_billing==="yearly"?(isAr?"سنوي":"Yearly"):(isAr?"شهري":"Monthly")}/>
              <Row label={isAr?"آخر دفع":"Last Payment"} value={profile?.last_payment_amount?`${profile.last_payment_amount.toLocaleString()} EGP`:undefined}/>
              <Row label={isAr?"تاريخ آخر دفع":"Last Payment Date"} value={profile?.last_payment_at?new Date(profile.last_payment_at).toLocaleDateString():undefined}/>
            </Card>

            {/* Payment history */}
            <Card>
              <Label>{isAr?"سجل المدفوعات":"Payment History"}</Label>
              {loadingPay?(
                <div style={{ textAlign:"center",padding:"20px 0" }}>
                  <div style={{ width:24,height:24,border:"2px solid rgba(26,86,219,.3)",borderTopColor:"#1a56db",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto" }}/>
                </div>
              ):payments.length===0?(
                <div style={{ fontSize:12,color:"#475569",textAlign:"center",padding:"16px 0" }}>
                  {isAr?"لا توجد مدفوعات مسجلة بعد":"No payments recorded yet"}
                </div>
              ):(
                payments.map((p,i)=>(
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,.05)" }}>
                    <span style={{ fontSize:14 }}>💳</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12,fontWeight:600 }}>{p.tier?.charAt(0).toUpperCase()+p.tier?.slice(1)} — {p.billing}</div>
                      <div style={{ fontSize:10,color:"#64748b" }}>{new Date(p.created_at?.seconds?p.created_at.seconds*1000:p.created_at||0).toLocaleDateString()}</div>
                    </div>
                    <span style={{ fontSize:13,fontWeight:700,color:"#10b981" }}>{Number(p.amount).toLocaleString()} EGP</span>
                    <span style={{ fontSize:9,background:"rgba(16,185,129,.1)",color:"#10b981",padding:"2px 8px",borderRadius:99,fontWeight:700 }}>
                      {p.status==="confirmed"?(isAr?"مؤكد":"Confirmed"):(isAr?"معلق":"Pending")}
                    </span>
                  </div>
                ))
              )}
            </Card>

            {/* Cancel subscription */}
            {profile?.tier&&profile.tier!=="standard"&&profile.tier!=="free"&&cancelStep<2&&(
              <Card style={{ background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.15)" }}>
                <Label>{isAr?"إلغاء الاشتراك":"Cancel Subscription"}</Label>
                <div style={{ fontSize:12,color:"#94a3b8",lineHeight:1.6,marginBottom:12 }}>
                  {isAr?`سيتم إلغاء خطة ${profile.tier}. ستحتفظ بالوصول حتى نهاية فترة الفوترة.`:`Your ${profile.tier} plan will be cancelled. You'll keep access until the billing period ends.`}
                </div>
                {cancelStep===0&&(
                  <button onClick={()=>setCancelStep(1)} style={{ background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.25)",borderRadius:9,padding:"8px 16px",fontSize:12,color:"#fca5a5",cursor:"pointer",fontWeight:600 }}>
                    {isAr?"إلغاء الاشتراك":"Cancel Subscription"}
                  </button>
                )}
                {cancelStep===1&&(
                  <div>
                    <div style={{ fontSize:12,fontWeight:600,color:"#fca5a5",marginBottom:10 }}>
                      {isAr?"هل أنت متأكد؟ لا يمكن التراجع.":"Are you sure? This cannot be undone."}
                    </div>
                    <div style={{ display:"flex",gap:8 }}>
                      <button onClick={()=>setCancelStep(0)} style={{ background:"rgba(148,163,184,.1)",border:"1px solid rgba(148,163,184,.2)",borderRadius:8,padding:"8px 16px",fontSize:12,color:"#94a3b8",cursor:"pointer",fontWeight:600 }}>
                        {isAr?"لا، ابقَ":"No, keep it"}
                      </button>
                      <button onClick={cancelSubscription} disabled={cancelling} style={{ background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.4)",borderRadius:8,padding:"8px 16px",fontSize:12,color:"#fca5a5",cursor:"pointer",fontWeight:700,opacity:cancelling?.6:1 }}>
                        {cancelling?"...":(isAr?"نعم، إلغاء":"Yes, Cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )}
            {cancelStep===2&&(
              <div style={{ background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.2)",borderRadius:14,padding:"14px 18px",textAlign:"center",fontSize:12,color:"#6ee7b7" }}>
                ✓ {isAr?"تم إرسال طلب الإلغاء — سيتم المعالجة خلال 24 ساعة":"Cancellation request sent — will process within 24h"}
              </div>
            )}
          </>
        )}

        {/* ── SECURITY TAB ── */}
        {tab==="security"&&(
          <Card>
            <Label>{isAr?"تغيير كلمة المرور":"Change Password"}</Label>
            <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:14 }}>
              <Inp value={oldPass} onChange={setOldPass} placeholder={isAr?"كلمة المرور الحالية":"Current password"} type="password"/>
              <Inp value={newPass} onChange={setNewPass} placeholder={isAr?"كلمة المرور الجديدة (6+ أحرف)":"New password (6+ chars)"} type="password"/>
            </div>
            {passMsg&&(
              <div style={{ fontSize:12,marginBottom:12,padding:"8px 12px",borderRadius:8,background:passMsg.includes("✅")?"rgba(16,185,129,.08)":"rgba(239,68,68,.08)",color:passMsg.includes("✅")?"#6ee7b7":"#fca5a5",border:`1px solid ${passMsg.includes("✅")?"rgba(16,185,129,.2)":"rgba(239,68,68,.2)"}` }}>
                {passMsg}
              </div>
            )}
            <button onClick={changePassword} disabled={changingPass||!oldPass||!newPass}
              style={{ background:"#1a56db",border:"none",borderRadius:10,padding:"11px 0",width:"100%",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",opacity:(changingPass||!oldPass||!newPass)?.5:1 }}>
              {changingPass?"...":(isAr?"تغيير كلمة المرور":"Change Password")}
            </button>
            <div style={{ marginTop:24,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.07)" }}>
              <Label>{isAr?"معلومات الأمان":"Security Info"}</Label>
              <Row label={isAr?"البريد الإلكتروني":"Email"} value={user.email}/>
              <Row label={isAr?"المصادقة الثنائية":"2FA"} value={isAr?"غير مفعّل":"Not enabled"} color="#f59e0b"/>
              <Row label={isAr?"آخر تسجيل دخول":"Last Sign-in"} value={user.metadata?.lastSignInTime?new Date(user.metadata.lastSignInTime).toLocaleString():undefined}/>
            </div>
          </Card>
        )}

        {/* ── REFERRAL TAB ── */}
        {tab==="referral"&&(
          <Card>
            <Label>{isAr?"رابط الإحالة":"Referral Link"}</Label>
            <div style={{ fontSize:12.5,color:"#94a3b8",lineHeight:1.6,marginBottom:16 }}>
              {isAr?"شارك الرابط واحصل على خصم 20% لكل مشترك يشترك من خلالك":"Share your link and earn 20% discount for every subscriber you refer"}
            </div>
            <div style={{ display:"flex",gap:8,marginBottom:16 }}>
              <div style={{ flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,padding:"10px 14px",fontSize:11,color:"#64748b",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                {refLink}
              </div>
              <button onClick={()=>{navigator.clipboard.writeText(refLink);addToast(isAr?"تم نسخ الرابط":"Link copied!","success");}}
                style={{ background:"#1a56db",border:"none",borderRadius:9,padding:"0 16px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",whiteSpace:"nowrap" }}>
                {isAr?"نسخ":"Copy"}
              </button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10 }}>
              {[
                { icon:"👥", label:isAr?"المُحالون":"Referred", value:profile?.referral_count||0, color:"#60a5fa" },
                { icon:"💰", label:isAr?"المكتسب":"Earned",    value:`${(profile?.referral_earnings||0).toLocaleString()} EGP`, color:"#10b981" },
                { icon:"⏳", label:isAr?"معلّق":"Pending",     value:profile?.referral_pending||0, color:"#f59e0b" },
              ].map(s=>(
                <div key={s.label} style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"14px 12px",textAlign:"center" }}>
                  <div style={{ fontSize:18,marginBottom:6 }}>{s.icon}</div>
                  <div style={{ fontSize:16,fontWeight:800,color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:9.5,color:"#64748b",marginTop:3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
