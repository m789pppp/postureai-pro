/**
 * TrialExpiredPage — shown when 7-day trial ends and user hasn't paid
 * Blocks access to app until user subscribes
 */
import { useState } from "react";

export default function TrialExpiredPage({ profile, darkMode, lang, onUpgrade, onLogout, cs }) {
  const isAr = lang === "ar";
  const [hov, setHov] = useState("");

  const dark = darkMode;
  const t = {
    bg:     dark ? "#030b14" : "#f0f4ff",
    card:   dark ? "rgba(15,23,42,.9)" : "#ffffff",
    border: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.07)",
    text:   dark ? "#f0f6ff" : "#0f172a",
    muted:  dark ? "rgba(255,255,255,.4)" : "#64748b",
    acc:    "#1a56db",
    btn:    "linear-gradient(135deg,#1a56db,#0891b2)",
  };

  const plans = isAr ? [
    { id:"professional", name:"احترافي", price:"199 جنيه", period:"/شهر", color:"#0ea5e9",
      features:["✓ AI Coach بدون حدود","✓ تقارير PDF كاملة","✓ تحليل وضعية متقدم","✓ إحصائيات تفصيلية"] },
    { id:"elite", name:"إيليت", price:"399 جنيه", period:"/شهر", color:"#10b981", badge:"الأفضل",
      features:["✓ كل مميزات الاحترافي","✓ AI بالذكاء الاصطناعي العميق","✓ توقع الألم المبكر","✓ دعم أولوية 24/7"] },
  ] : [
    { id:"professional", name:"Professional", price:"$9.99", period:"/mo", color:"#0ea5e9",
      features:["✓ Unlimited AI Coach","✓ Full PDF Reports","✓ Advanced Analysis","✓ Detailed Stats"] },
    { id:"elite", name:"Elite", price:"$19.99", period:"/mo", color:"#10b981", badge:"Best Value",
      features:["✓ Everything in Pro","✓ Deep AI Insights","✓ Pain Onset Prediction","✓ Priority Support 24/7"] },
  ];

  return (
    <div style={{
      minHeight:"100vh", background:t.bg,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Inter','IBM Plex Sans Arabic',system-ui,sans-serif",
      direction:isAr?"rtl":"ltr", padding:"24px 16px",
      position:"relative", overflow:"hidden",
    }}>
      {/* Background glow */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",
        background:dark
          ?"radial-gradient(ellipse 70% 50% at 50% 0%, rgba(26,86,219,.1) 0%, transparent 60%)"
          :"radial-gradient(ellipse 70% 50% at 50% 0%, rgba(219,234,254,.8) 0%, transparent 60%)"
      }}/>

      <div style={{maxWidth:680,width:"100%",position:"relative",zIndex:1}}>
        {/* Header */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{
            width:64,height:64,borderRadius:18,margin:"0 auto 16px",
            background:"linear-gradient(135deg,#1a56db,#0891b2)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:28,boxShadow:"0 12px 40px rgba(26,86,219,.35)",
          }}>◈</div>

          <div style={{
            display:"inline-flex",alignItems:"center",gap:8,
            background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.25)",
            borderRadius:99,padding:"6px 16px",marginBottom:16,
          }}>
            <span style={{fontSize:16}}>⏰</span>
            <span style={{fontSize:13,fontWeight:600,color:"#f59e0b"}}>
              {isAr?"انتهت فترة التجربة المجانية":"Your free trial has ended"}
            </span>
          </div>

          <h1 style={{fontSize:28,fontWeight:800,color:t.text,marginBottom:10,letterSpacing:"-.02em"}}>
            {isAr?"استمر في استخدام Corvus":"Continue Using Corvus"}
          </h1>
          <p style={{fontSize:15,color:t.muted,lineHeight:1.6,maxWidth:480,margin:"0 auto"}}>
            {isAr
              ?`مرحباً ${profile?.name?.split(" ")[0]||""}! لقد استمتعت بـ 7 أيام كاملة من الوصول الاحترافي. اختر خطتك للمتابعة.`
              :`Hey ${profile?.name?.split(" ")[0]||"there"}! You've enjoyed 7 days of full professional access. Choose a plan to keep going.`}
          </p>
        </div>

        {/* Stats reminder */}
        <div style={{
          display:"flex",justifyContent:"center",gap:24,marginBottom:28,flexWrap:"wrap",
        }}>
          {[
            {n: profile?.sessions_count||0, l: isAr?"جلسة مكتملة":"sessions completed"},
            {n: profile?.avg_score ? Math.round(profile.avg_score)+"/100" : "—", l: isAr?"متوسط الوضعية":"avg posture score"},
          ].map((s,i)=>(
            <div key={i} style={{textAlign:"center",
              background:dark?"rgba(255,255,255,.04)":"rgba(26,86,219,.04)",
              border:`1px solid ${dark?"rgba(255,255,255,.07)":"rgba(26,86,219,.1)"}`,
              borderRadius:12,padding:"12px 24px",
            }}>
              <div style={{fontSize:22,fontWeight:800,color:t.text}}>{s.n}</div>
              <div style={{fontSize:12,color:t.muted,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div style={{display:"flex",gap:16,marginBottom:20,flexWrap:"wrap",justifyContent:"center"}}>
          {plans.map(plan=>(
            <div key={plan.id} style={{
              flex:"1 1 280px",maxWidth:320,
              background:t.card,border:`1.5px solid ${hov===plan.id?plan.color:t.border}`,
              borderRadius:16,padding:"24px 22px",position:"relative",
              transition:"all .2s",
              transform:hov===plan.id?"translateY(-3px)":"none",
              boxShadow:hov===plan.id?`0 12px 40px rgba(26,86,219,.15)`:"none",
              cursor:"pointer",
            }}
            onMouseEnter={()=>setHov(plan.id)}
            onMouseLeave={()=>setHov("")}
            onClick={()=>onUpgrade(plan.id)}>
              {plan.badge&&(
                <div style={{
                  position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",
                  background:plan.color,color:"#fff",
                  fontSize:10,fontWeight:700,padding:"2px 12px",borderRadius:99,
                  whiteSpace:"nowrap",letterSpacing:".04em",
                }}>{plan.badge}</div>
              )}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:4}}>{plan.name}</div>
                <div style={{display:"flex",alignItems:"baseline",gap:3}}>
                  <span style={{fontSize:28,fontWeight:800,color:plan.color}}>{plan.price}</span>
                  <span style={{fontSize:13,color:t.muted}}>{plan.period}</span>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:18}}>
                {plan.features.map((f,i)=>(
                  <div key={i} style={{fontSize:13,color:dark?"rgba(255,255,255,.7)":"#374151"}}>
                    {f}
                  </div>
                ))}
              </div>
              <button onClick={e=>{e.stopPropagation();onUpgrade(plan.id);}} style={{
                width:"100%",padding:"12px 0",
                background:hov===plan.id?`linear-gradient(135deg,${plan.color},${plan.color}cc)`:
                  dark?"rgba(255,255,255,.06)":"rgba(26,86,219,.08)",
                border:`1.5px solid ${hov===plan.id?plan.color:dark?"rgba(255,255,255,.1)":"rgba(26,86,219,.15)"}`,
                borderRadius:10,fontSize:14,fontWeight:700,
                color:hov===plan.id?"#fff":(dark?"rgba(255,255,255,.8)":t.acc),
                cursor:"pointer",transition:"all .2s",fontFamily:"inherit",
              }}>
                {isAr?"اشترك الآن →":"Subscribe Now →"}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{textAlign:"center",display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
          <div style={{fontSize:12.5,color:t.muted}}>
            {isAr?"✓ إلغاء في أي وقت  ·  ✓ دفع آمن  ·  ✓ دعم فني كامل"
                 :"✓ Cancel anytime  ·  ✓ Secure payment  ·  ✓ Full support"}
          </div>
          <button onClick={onLogout} style={{
            background:"none",border:"none",
            fontSize:12.5,color:t.muted,cursor:"pointer",
            fontFamily:"inherit",transition:"color .15s",textDecoration:"underline",
            textUnderlineOffset:3,
          }}
          onMouseEnter={e=>e.currentTarget.style.color=t.text}
          onMouseLeave={e=>e.currentTarget.style.color=t.muted}>
            {isAr?"تسجيل الخروج":"Sign out"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        * { box-sizing: border-box; margin:0; padding:0 }
      `}</style>
    </div>
  );
}
