/**
 * Corvus Developer Portal
 * + Insurance Partnership page
 *
 * Exports:
 *   DeveloperPortalModal  — API key management + docs + usage
 *   InsurancePartnerPage  — insurance partnership info + contact
 */
import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";

// ── DEVELOPER PORTAL MODAL ───────────────────────────────────────
export function DeveloperPortalModal({ profile, cs, isAr, onClose, addToast }) {
  const [tab, setTab]         = useState("overview"); // overview | keys | docs | usage
  const [keys, setKeys]       = useState([]);
  const [creating, setCreating] = useState(false);
  const [usage, setUsage]     = useState(null);
  const [newKeyPlan, setNewKeyPlan] = useState("basic");
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [createdKey, setCreatedKey]   = useState(null); // shown once after creation

  async function getToken() {
    return getAuth().currentUser?.getIdToken() || "";
  }

  async function fetchKeys() {
    try {
      const token = await getToken();
      const res = await fetch("/api/posture-api/keys", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body: JSON.stringify({ action:"list" }),
      });
      const data = await res.json();
      if (data.ok) setKeys(data.keys||[]);
    } catch {}
  }

  async function fetchUsage(key) {
    try {
      const res = await fetch("/api/posture-api/usage", { headers:{"x-api-key": key} });
      const data = await res.json();
      if (data.ok) setUsage(data);
    } catch {}
  }

  useEffect(() => { if (tab === "keys") fetchKeys(); }, [tab]);

  async function createKey() {
    setCreating(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/posture-api/keys", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body: JSON.stringify({ action:"create", plan:newKeyPlan, label:newKeyLabel||undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setCreatedKey(data.key);
        addToast?.(isAr?"✅ تم إنشاء API Key":"✅ API Key created","success");
        fetchKeys();
      } else {
        addToast?.(data.error||"Error","error");
      }
    } catch { addToast?.("Error creating key","error"); }
    setCreating(false);
  }

  async function revokeKey(key_id) {
    try {
      const token = await getToken();
      await fetch("/api/posture-api/keys", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
        body: JSON.stringify({ action:"revoke", key_id }),
      });
      addToast?.(isAr?"تم إلغاء المفتاح":"Key revoked","info");
      fetchKeys();
    } catch {}
  }

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:9999,
    display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const modal = { background:cs.card,border:`1px solid ${cs.border}`,borderRadius:20,
    width:"100%",maxWidth:680,maxHeight:"90vh",overflowY:"auto",fontFamily:"system-ui,sans-serif" };
  const tabBtn = (id,label) => (
    <button key={id} onClick={()=>setTab(id)} style={{
      padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
      background: tab===id?"rgba(26,86,219,.2)":"transparent",
      color: tab===id?"#60a5fa":cs.muted,
    }}>{label}</button>
  );

  const CODE_SAMPLE = `// cURL example
curl -X POST https://corvus.io/api/posture-api/analyze \\
  -H "x-api-key: crv_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "metrics": {
      "neck_tilt": 18.5,
      "shoulder_tilt": 4.2,
      "head_forward": 5.1,
      "back_curve": 35.0,
      "ear_shoulder_offset": 3.8
    }
  }'

// Response
{
  "ok": true,
  "result": {
    "score": 74,
    "grade": "B",
    "risk": "moderate",
    "alerts": [
      { "type": "neck_tilt", "severity": "medium", "message": "..." }
    ],
    "recommendations": ["Position monitor at eye level..."],
    "iso_standard": "ISO 9241-110"
  },
  "usage": { "calls_used": 42, "monthly_limit": 1000, "remaining": 958 }
}`;

  return (
    <div style={overlay} onClick={e=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div style={modal}>

        {/* Header */}
        <div style={{ padding:"24px 28px 0",borderBottom:`1px solid ${cs.border}` }}>
          <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
            <div style={{ width:44,height:44,borderRadius:12,
              background:"linear-gradient(135deg,rgba(26,86,219,.25),rgba(8,145,178,.1))",
              border:"1px solid rgba(26,86,219,.3)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>⚡</div>
            <div>
              <div style={{ fontSize:16,fontWeight:800,color:cs.text }}>
                {isAr?"Corvus Posture API — بوابة المطورين":"Corvus Posture API — Developer Portal"}
              </div>
              <div style={{ fontSize:11,color:cs.muted,marginTop:2 }}>
                {isAr?"ادمج تحليل الوضعية في أي تطبيق":"Integrate posture analysis into any app"}
              </div>
            </div>
            <button onClick={onClose} style={{ marginInlineStart:"auto",background:"none",
              border:"none",color:cs.muted,fontSize:20,cursor:"pointer",padding:4 }}>✕</button>
          </div>
          <div style={{ display:"flex",gap:4,paddingBottom:0 }}>
            {[
              ["overview", isAr?"نظرة عامة":"Overview"],
              ["keys",     isAr?"API Keys":"API Keys"],
              ["docs",     isAr?"التوثيق":"Docs"],
              ["pricing",  isAr?"الأسعار":"Pricing"],
            ].map(([id,label])=>tabBtn(id,label))}
          </div>
        </div>

        <div style={{ padding:"24px 28px" }}>

          {/* OVERVIEW */}
          {tab==="overview" && (
            <div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24 }}>
                {[
                  ["⚡","REST API","isAr?'طلبات JSON بسيطة':'Simple JSON requests'"],
                  ["🔒","Secure","isAr?'مفاتيح API مشفرة':'Encrypted API keys'"],
                  ["📊","Analytics","isAr?'تتبع الاستخدام':'Usage tracking'"],
                  ["🌍","Global","isAr?'Vercel Edge — أقل من 50ms':'Vercel Edge < 50ms'"],
                ].map(([icon,title,desc])=>(
                  <div key={title} style={{ background:"rgba(255,255,255,.03)",
                    border:`1px solid ${cs.border}`,borderRadius:12,padding:"14px 16px" }}>
                    <div style={{ fontSize:20,marginBottom:8 }}>{icon}</div>
                    <div style={{ fontSize:13,fontWeight:700,color:cs.text,marginBottom:4 }}>{title}</div>
                    <div style={{ fontSize:11,color:cs.muted }}>{isAr ? desc.split("'")[1] : desc.split("'")[3]}</div>
                  </div>
                ))}
              </div>

              <div style={{ background:"rgba(10,15,30,.8)",borderRadius:12,padding:"16px 18px",
                border:"1px solid rgba(26,86,219,.2)",marginBottom:16 }}>
                <div style={{ fontSize:10,color:"#60a5fa",fontWeight:700,marginBottom:10 }}>
                  BASE URL
                </div>
                <div style={{ fontSize:13,color:"#10b981",fontFamily:"monospace" }}>
                  POST https://corvus.io/api/posture-api/analyze
                </div>
              </div>

              <div style={{ fontSize:12,color:cs.muted,lineHeight:1.7 }}>
                {isAr
                  ? "Corvus Posture API بتقدر تحلل مقاييس الوضعية وترجعلك score + توصيات + تحذيرات في أقل من 100ms. مثالية للـ fitness apps والـ HR platforms وشركات التأمين."
                  : "The Corvus Posture API analyzes posture metrics and returns a score, insights, and recommendations in under 100ms. Perfect for fitness apps, HR platforms, and insurance companies."}
              </div>

              <button onClick={()=>setTab("keys")}
                style={{ marginTop:20,padding:"11px 24px",
                  background:"linear-gradient(135deg,#1a56db,#0891b2)",
                  border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer" }}>
                {isAr?"احصل على API Key →":"Get Your API Key →"}
              </button>
            </div>
          )}

          {/* API KEYS */}
          {tab==="keys" && (
            <div>
              {/* Created key — show once */}
              {createdKey && (
                <div style={{ background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.3)",
                  borderRadius:12,padding:"16px",marginBottom:20 }}>
                  <div style={{ fontSize:11,fontWeight:700,color:"#10b981",marginBottom:8 }}>
                    ✅ {isAr?"تم إنشاء المفتاح — احفظه دلوقتي، مش هيظهر تاني!":"Key created — save it now, it won't show again!"}
                  </div>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    <code style={{ flex:1,fontSize:12,color:"#f0f6ff",background:"rgba(0,0,0,.3)",
                      borderRadius:8,padding:"8px 12px",wordBreak:"break-all",fontFamily:"monospace" }}>
                      {createdKey}
                    </code>
                    <button onClick={()=>{ navigator.clipboard?.writeText(createdKey);
                      addToast?.(isAr?"تم النسخ":"Copied","success"); }}
                      style={{ padding:"8px 12px",background:"rgba(16,185,129,.15)",border:"1px solid rgba(16,185,129,.3)",
                        borderRadius:8,color:"#10b981",fontSize:11,cursor:"pointer",whiteSpace:"nowrap" }}>
                      {isAr?"نسخ":"Copy"}
                    </button>
                  </div>
                </div>
              )}

              {/* Create new key */}
              <div style={{ background:"rgba(255,255,255,.03)",border:`1px solid ${cs.border}`,
                borderRadius:12,padding:"16px",marginBottom:20 }}>
                <div style={{ fontSize:12,fontWeight:700,color:cs.text,marginBottom:12 }}>
                  {isAr?"إنشاء مفتاح جديد":"Create New Key"}
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12 }}>
                  <input value={newKeyLabel} onChange={e=>setNewKeyLabel(e.target.value)}
                    placeholder={isAr?"اسم المفتاح (اختياري)":"Key label (optional)"}
                    style={{ background:"rgba(255,255,255,.04)",border:`1px solid ${cs.border}`,
                      borderRadius:8,padding:"9px 12px",fontSize:12,color:cs.text,outline:"none" }} />
                  <select value={newKeyPlan} onChange={e=>setNewKeyPlan(e.target.value)}
                    style={{ background:"rgba(255,255,255,.04)",border:`1px solid ${cs.border}`,
                      borderRadius:8,padding:"9px 12px",fontSize:12,color:cs.text,outline:"none",cursor:"pointer" }}>
                    <option value="basic">Starter — 1,000 calls/mo</option>
                    <option value="pro">Pro — 10,000 calls/mo</option>
                    <option value="enterprise">Enterprise — Unlimited</option>
                  </select>
                </div>
                <button onClick={createKey} disabled={creating}
                  style={{ padding:"9px 20px",background:"linear-gradient(135deg,#1a56db,#0891b2)",
                    border:"none",borderRadius:9,color:"#fff",fontSize:12,fontWeight:700,
                    cursor:creating?"not-allowed":"pointer",opacity:creating?.7:1 }}>
                  {creating?"...":(isAr?"+ إنشاء مفتاح":"+ Create Key")}
                </button>
              </div>

              {/* Keys list */}
              {keys.length > 0 ? keys.map((k,i) => (
                <div key={i} style={{ background:"rgba(255,255,255,.02)",border:`1px solid ${cs.border}`,
                  borderRadius:10,padding:"14px 16px",marginBottom:10,
                  display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:cs.text,marginBottom:4 }}>
                      {k.label || `Key ${i+1}`}
                      <span style={{ marginInlineStart:8,fontSize:10,fontWeight:700,
                        color: k.plan==="enterprise"?"#f59e0b":k.plan==="pro"?"#a5b4fc":"#60a5fa",
                        background:"rgba(255,255,255,.06)",borderRadius:99,padding:"2px 7px" }}>
                        {k.plan?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize:11,color:cs.muted,fontFamily:"monospace" }}>{k.key_id}</div>
                    <div style={{ fontSize:10,color:cs.muted,marginTop:4 }}>
                      {k.calls_this_month||0} / {k.monthly_limit||"∞"} {isAr?"استدعاء هذا الشهر":"calls this month"}
                    </div>
                  </div>
                  <button onClick={()=>revokeKey(k.key_id)}
                    style={{ padding:"6px 12px",background:"rgba(239,68,68,.1)",
                      border:"1px solid rgba(239,68,68,.2)",borderRadius:7,
                      color:"#ef4444",fontSize:11,cursor:"pointer" }}>
                    {isAr?"إلغاء":"Revoke"}
                  </button>
                </div>
              )) : (
                <div style={{ textAlign:"center",padding:"20px",color:cs.muted,fontSize:13 }}>
                  {isAr?"مفيش مفاتيح بعد — أنشئ واحد":"No keys yet — create one above"}
                </div>
              )}
            </div>
          )}

          {/* DOCS */}
          {tab==="docs" && (
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:cs.text,marginBottom:12 }}>
                {isAr?"مثال كامل (cURL + Response)":"Full Example (cURL + Response)"}
              </div>
              <pre style={{ background:"rgba(5,10,20,.9)",border:"1px solid rgba(26,86,219,.2)",
                borderRadius:12,padding:"16px",fontSize:11,color:"#a5d8ff",overflowX:"auto",
                lineHeight:1.6,margin:0,fontFamily:"monospace",whiteSpace:"pre-wrap" }}>
                {CODE_SAMPLE}
              </pre>

              <div style={{ marginTop:24,fontSize:13,fontWeight:700,color:cs.text,marginBottom:12 }}>
                {isAr?"حقول الـ metrics:":"Metrics fields:"}
              </div>
              {[
                ["neck_tilt",           "number", "degrees", isAr?"ميل الرقبة (0 = مثالي)":"Neck tilt angle (0 = perfect)"],
                ["shoulder_tilt",       "number", "degrees", isAr?"ميل الكتفين":"Shoulder imbalance"],
                ["head_forward",        "number", "cm",      isAr?"انحناء الرأس للأمام":"Forward head distance"],
                ["back_curve",          "number", "degrees", isAr?"انحناء الظهر (20-40 = طبيعي)":"Lumbar curve (20-40 = normal)"],
                ["ear_shoulder_offset", "number", "cm",      isAr?"توازن الأذن مع الكتف":"Ear-shoulder alignment"],
              ].map(([field,type,unit,desc])=>(
                <div key={field} style={{ display:"grid",gridTemplateColumns:"1.2fr .6fr .5fr 2fr",
                  gap:10,padding:"8px 0",borderBottom:`1px solid ${cs.border}`,alignItems:"start" }}>
                  <code style={{ fontSize:11,color:"#10b981",fontFamily:"monospace" }}>{field}</code>
                  <span style={{ fontSize:10,color:"#a5b4fc" }}>{type}</span>
                  <span style={{ fontSize:10,color:cs.muted }}>{unit}</span>
                  <span style={{ fontSize:11,color:cs.muted }}>{desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* PRICING */}
          {tab==="pricing" && (
            <div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24 }}>
                {[
                  { name:"Starter", calls:"1,000", price:"299", color:"#60a5fa", features:[
                    isAr?"1,000 استدعاء/شهر":"1,000 calls/mo",
                    isAr?"تحليل الوضعية الكاملة":"Full posture analysis",
                    isAr?"توثيق API":"API documentation",
                    isAr?"دعم بالإيميل":"Email support",
                  ]},
                  { name:"Pro", calls:"10,000", price:"999", color:"#a5b4fc", highlight:true, features:[
                    isAr?"10,000 استدعاء/شهر":"10,000 calls/mo",
                    isAr?"كل مميزات Starter":"All Starter features",
                    isAr?"Webhook events":"Webhook events",
                    isAr?"دعم أولوية":"Priority support",
                  ]},
                  { name:"Enterprise", calls:"∞", price:isAr?"تفاوض":"Custom", color:"#f59e0b", features:[
                    isAr?"استدعاءات غير محدودة":"Unlimited calls",
                    isAr?"SLA 99.9%":"99.9% SLA",
                    isAr?"On-premise option":"On-premise option",
                    isAr?"دعم مخصص":"Dedicated support",
                  ]},
                ].map(p=>(
                  <div key={p.name} style={{
                    background: p.highlight?"linear-gradient(135deg,rgba(99,102,241,.12),rgba(99,102,241,.04))":"rgba(255,255,255,.03)",
                    border:`1px solid ${p.highlight?"rgba(99,102,241,.3)":cs.border}`,
                    borderRadius:14,padding:"20px 16px",textAlign:"center" }}>
                    <div style={{ fontSize:15,fontWeight:800,color:p.color,marginBottom:8 }}>{p.name}</div>
                    <div style={{ fontSize:26,fontWeight:900,color:cs.text,lineHeight:1 }}>{p.price}</div>
                    {typeof p.price==="string"&&!isNaN(p.price)&&(
                      <div style={{ fontSize:10,color:cs.muted,marginBottom:12 }}>
                        {isAr?"جنيه / شهر":"EGP / month"}
                      </div>
                    )}
                    <div style={{ marginTop:14,textAlign:"left" }}>
                      {p.features.map(f=>(
                        <div key={f} style={{ fontSize:11,color:cs.muted,padding:"5px 0",
                          borderBottom:`1px solid ${cs.border}`,display:"flex",gap:6,alignItems:"center" }}>
                          <span style={{ color:"#10b981",flexShrink:0 }}>✓</span>{f}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11,color:cs.muted,textAlign:"center" }}>
                {isAr
                  ? "لطلب Enterprise أو الاستفسار: sales@corvus.io"
                  : "For Enterprise or custom pricing: sales@corvus.io"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── INSURANCE PARTNERSHIP MODAL ──────────────────────────────────
export function InsurancePartnerModal({ cs, isAr, onClose, addToast }) {
  const [step, setStep]     = useState("info"); // info | contact | done
  const [form, setForm]     = useState({ name:"", email:"", company:"", role:"", size:"" });
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!form.name || !form.email || !form.company) {
      addToast?.(isAr?"اكمل البيانات":"Fill required fields","warn");
      return;
    }
    setSending(true);
    try {
      await fetch("/api/email/send", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          to: "partnerships@corvus.io",
          subject: `[Insurance Partnership] ${form.company}`,
          html: `<h2>Insurance Partnership Inquiry</h2>
<p><b>Name:</b> ${form.name}</p><p><b>Email:</b> ${form.email}</p>
<p><b>Company:</b> ${form.company}</p><p><b>Role:</b> ${form.role}</p>
<p><b>Insured Size:</b> ${form.size}</p>`,
        }),
      });
      setStep("done");
      addToast?.(isAr?"✅ تم إرسال طلبك":"✅ Request sent","success");
    } catch { addToast?.("Error","error"); }
    setSending(false);
  }

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:9999,
    display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const modal = { background:cs.card,border:`1px solid ${cs.border}`,borderRadius:20,
    padding:28,maxWidth:500,width:"100%",maxHeight:"90vh",overflowY:"auto",fontFamily:"system-ui,sans-serif" };
  const inp = { width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,.04)",
    border:`1px solid ${cs.border}`,borderRadius:9,padding:"10px 13px",
    fontSize:13,color:cs.text,outline:"none",marginBottom:10 };

  return (
    <div style={overlay} onClick={e=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div style={modal}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:22 }}>
          <div style={{ width:44,height:44,borderRadius:12,
            background:"linear-gradient(135deg,rgba(16,185,129,.2),rgba(16,185,129,.06))",
            border:"1px solid rgba(16,185,129,.3)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>🤝</div>
          <div>
            <div style={{ fontSize:16,fontWeight:800,color:cs.text }}>
              {isAr?"شراكة التأمين الصحي":"Health Insurance Partnership"}
            </div>
            <div style={{ fontSize:11,color:cs.muted,marginTop:2 }}>
              {isAr?"اربط Corvus بتأمينك وقلّل تكلفة المطالبات":"Link Corvus to your insurance, reduce claims"}
            </div>
          </div>
          <button onClick={onClose} style={{ marginInlineStart:"auto",background:"none",
            border:"none",color:cs.muted,fontSize:20,cursor:"pointer" }}>✕</button>
        </div>

        {step==="done" ? (
          <div style={{ textAlign:"center",padding:"24px 0" }}>
            <div style={{ fontSize:40,marginBottom:12 }}>🤝</div>
            <div style={{ fontSize:17,fontWeight:800,color:"#10b981",marginBottom:8 }}>
              {isAr?"شكراً لاهتمامك!":"Thank you for your interest!"}
            </div>
            <div style={{ fontSize:12,color:cs.muted,lineHeight:1.7 }}>
              {isAr
                ? "فريق شراكات Corvus هيتواصل معاك خلال 48 ساعة لمناقشة تفاصيل التعاون."
                : "The Corvus partnerships team will reach out within 48 hours to discuss collaboration details."}
            </div>
          </div>
        ) : step==="info" ? (
          <>
            {/* Value prop */}
            <div style={{ background:"linear-gradient(135deg,rgba(16,185,129,.08),rgba(16,185,129,.03))",
              border:"1px solid rgba(16,185,129,.2)",borderRadius:14,padding:"18px",marginBottom:20 }}>
              <div style={{ fontSize:13,fontWeight:700,color:"#10b981",marginBottom:12 }}>
                {isAr?"ليه Corvus + التأمين الصحي؟":"Why Corvus + Health Insurance?"}
              </div>
              {[
                [isAr?"تقليل مطالبات الجهاز الحركي بـ 35%":"Reduce musculoskeletal claims by 35%","📉"],
                [isAr?"بيانات موضوعية للتسعير الدقيق":"Objective data for accurate risk pricing","📊"],
                [isAr?"Corvus تحصل على referral fee":"Corvus earns referral fee per user","💰"],
                [isAr?"العميل يحصل على خصم في التأمين":"Client gets insurance discount","🏷️"],
                [isAr?"Churn أقل — العميل مش هيلغي":"Lower churn — users stay for the discount","🔒"],
              ].map(([text,icon])=>(
                <div key={text} style={{ display:"flex",gap:10,padding:"7px 0",
                  borderBottom:`1px solid rgba(16,185,129,.1)` }}>
                  <span style={{ fontSize:16,flexShrink:0 }}>{icon}</span>
                  <span style={{ fontSize:12,color:cs.muted }}>{text}</span>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12,fontWeight:700,color:cs.text,marginBottom:12 }}>
                {isAr?"إزاي بتشتغل الشراكة:":"How the partnership works:"}
              </div>
              {[
                [isAr?"1":"1", isAr?"الشركة تشترك في Corvus Pro":"Company subscribes to Corvus Pro"],
                [isAr?"2":"2", isAr?"Corvus يشارك تقرير صحة موضوعي مع شركة التأمين":"Corvus shares objective health score with insurer"],
                [isAr?"3":"3", isAr?"شركة التأمين تقدم خصم 5-15% على التأمين":"Insurer offers 5-15% premium discount"],
                [isAr?"4":"4", isAr?"Corvus تحصل على referral fee شهري":"Corvus earns monthly referral fee"],
              ].map(([num,text])=>(
                <div key={num} style={{ display:"flex",gap:12,padding:"8px 0",alignItems:"flex-start" }}>
                  <div style={{ width:22,height:22,borderRadius:"50%",background:"rgba(16,185,129,.15)",
                    border:"1px solid rgba(16,185,129,.3)",display:"flex",alignItems:"center",
                    justifyContent:"center",fontSize:10,fontWeight:900,color:"#10b981",flexShrink:0 }}>{num}</div>
                  <span style={{ fontSize:12,color:cs.muted,paddingTop:2 }}>{text}</span>
                </div>
              ))}
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20 }}>
              {[
                [isAr?"متاح لـ":"Available for", isAr?"MetLife · AXA · Allianz":"MetLife · AXA · Allianz"],
                [isAr?"Referral fee":"Referral fee", isAr?"15–25 EGP/مستخدم/شهر":"15–25 EGP/user/month"],
              ].map(([k,v])=>(
                <div key={k} style={{ background:"rgba(255,255,255,.03)",borderRadius:10,padding:"12px 14px" }}>
                  <div style={{ fontSize:10,color:cs.muted,marginBottom:4 }}>{k}</div>
                  <div style={{ fontSize:12,fontWeight:700,color:cs.text }}>{v}</div>
                </div>
              ))}
            </div>

            <button onClick={()=>setStep("contact")}
              style={{ width:"100%",padding:"13px",
                background:"linear-gradient(135deg,#10b981,#059669)",
                border:"none",borderRadius:12,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer" }}>
              🤝 {isAr?"اتواصل مع فريق الشراكات":"Contact Partnerships Team"}
            </button>
          </>
        ) : (
          <>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
              placeholder={isAr?"اسمك *":"Your name *"} style={inp} />
            <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
              placeholder={isAr?"البريد الإلكتروني *":"Email *"} style={inp} type="email" dir="ltr"/>
            <input value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))}
              placeholder={isAr?"اسم شركة التأمين *":"Insurance company name *"} style={inp}/>
            <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={{...inp,cursor:"pointer"}}>
              <option value="">{isAr?"دورك في الشركة":"Your role"}</option>
              <option value="ceo">CEO / MD</option>
              <option value="actuarial">{isAr?"اكتواري":"Actuarial"}</option>
              <option value="partnerships">{isAr?"شراكات":"Partnerships"}</option>
              <option value="it">IT / Tech</option>
            </select>
            <select value={form.size} onChange={e=>setForm(f=>({...f,size:e.target.value}))} style={{...inp,cursor:"pointer"}}>
              <option value="">{isAr?"حجم المؤمَّن عليهم":"Insured portfolio size"}</option>
              <option value="<5k">{isAr?"أقل من 5,000":"Under 5,000"}</option>
              <option value="5-50k">5,000 – 50,000</option>
              <option value="50k+">50,000+</option>
            </select>
            <div style={{ display:"flex",gap:10 }}>
              <button onClick={()=>setStep("info")}
                style={{ flex:1,padding:"10px",background:"rgba(255,255,255,.05)",
                  border:`1px solid ${cs.border}`,borderRadius:10,color:cs.muted,fontSize:12,cursor:"pointer" }}>
                {isAr?"رجوع":"Back"}
              </button>
              <button onClick={handleSend} disabled={sending}
                style={{ flex:2,padding:"10px",background:"linear-gradient(135deg,#10b981,#059669)",
                  border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,
                  cursor:sending?"not-allowed":"pointer",opacity:sending?.7:1 }}>
                {sending?"...":(isAr?"إرسال →":"Send →")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
