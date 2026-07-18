import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  SUPPORT_EMAIL, CALENDLY_URL, LPV7_TOKENS, FONT_DISPLAY, FONT_MONO,
  TYPE, btn, card, Eyebrow, SectionHead, Reveal, Stagger, StaggerItem, AnimNum,
} from "./sharedTokens.jsx";
import { PageShell } from "./StandaloneLayout.jsx";



function HowItWorks({ lang }) {
  const ar = lang === "ar";
  const steps = ar ? [
    { n:"01", title:"الإعداد السريع", desc:"أضف موظفيك بالCSV أو رابط الدعوة. الإعداد الكامل في 15 دقيقة.", time:"~15 دقيقة", icon:"🚀" },
    { n:"02", title:"التحليل الفوري", desc:"يستخدم الموظفون الكاميرا للتحليل. لا يلزم أي جهاز خاص.", time:"~2 دقيقة/موظف", icon:"📡" },
    { n:"03", title:"رؤى قابلة للتنفيذ", desc:"احصل على تقارير HR أسبوعية وتنبيهات فورية للمخاطر المهنية.", time:"تلقائي · أسبوعياً", icon:"📊" },
  ] : [
    { n:"01", title:"Quick Setup", desc:"Add your team via CSV or invite link. Full onboarding in 15 minutes.", time:"~15 min", icon:"🚀" },
    { n:"02", title:"Instant Analysis", desc:"Employees use their webcam for analysis. No special hardware needed.", time:"~2 min/employee", icon:"📡" },
    { n:"03", title:"Actionable Insights", desc:"Get weekly HR reports and real-time alerts for occupational risks.", time:"Automated · Weekly", icon:"📊" },
  ];

  return (
    <section id="how" className="lp-section" style={{ background:LPV7_TOKENS.bg1 }}>
      <div className="lp-wrap">
        <SectionHead eyebrow={ar ? "كيف يعمل" : "How It Works"}
          title={ar ? "ابدأ في 3 خطوات بسيطة" : "Up and running in 3 simple steps"}
          sub={ar ? "ثلاث خطوات بسيطة لبداية موثوقة" : "Three simple steps to a healthier team"}/>

        <Stagger key={String(ar)} className="lp-how-grid" gap={0.12}>
          {steps.map((s, i) => {
            const cols = [LPV7_TOKENS.blue, LPV7_TOKENS.indigo, LPV7_TOKENS.green];
            const col = cols[i];
            return (
              <StaggerItem key={s.n}>
                <div className="lp-lift" style={{
                  ...card(), textAlign:"center", padding:"36px 28px 32px",
                  borderTop:`2px solid ${col}`,
                  position:"relative", overflow:"hidden",
                }}>
                  {/* Glow bg */}
                  <div style={{
                    position:"absolute", top:0, left:0, right:0, height:80,
                    background:`radial-gradient(ellipse at 50% 0%,${col}14,transparent 70%)`,
                    pointerEvents:"none",
                  }}/>
                  {/* Step number */}
                  <div style={{
                    width:48, height:48, borderRadius:"50%", margin:"0 auto 16px",
                    background:`${col}18`, border:`1.5px solid ${col}40`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:FONT_MONO, fontSize:16, fontWeight:700, color:col,
                    position:"relative",
                  }}>{s.n}</div>
                  {/* Icon */}
                  <div style={{ fontSize:28, marginBottom:14 }}>{s.icon}</div>
                  <h3 style={{ ...TYPE.h3, color:LPV7_TOKENS.text, margin:"0 0 10px", fontFamily:FONT_DISPLAY }}>
                    {s.title}
                  </h3>
                  <p style={{ ...TYPE.bodySm, color:LPV7_TOKENS.sub, margin:"0 0 18px", lineHeight:1.65 }}>
                    {s.desc}
                  </p>
                  <div style={{
                    display:"inline-flex", alignItems:"center", gap:5,
                    background:`${col}10`, border:`1px solid ${col}28`,
                    borderRadius:99, padding:"5px 14px",
                  }}>
                    <span style={{ fontSize:11.5, color:col, fontWeight:600, fontFamily:FONT_MONO }}>⏱ {s.time}</span>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

// ── Case Studies ──────────────────────────────────────────────────

export default function HowItWorksPage() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("lp_lang") || "en"; } catch { return "en"; }
  });
  return (
    <>
      <style>{`.lp-features-wrap{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.lp-how-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.lp-cases-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.lp-testi-grid,.lp-testi-inner{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.lp-pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.lp-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.lp-popular-card{transform:scale(1.035)}
@media(max-width:1024px){
  .lp-features-wrap{grid-template-columns:1fr 1fr;gap:16px}
  .lp-how-grid{grid-template-columns:repeat(3,1fr);gap:16px}
  .lp-cases-grid{grid-template-columns:1fr 1fr;gap:20px}
  .lp-testi-grid,.lp-testi-inner{grid-template-columns:1fr 1fr!important}
  .lp-pricing-grid{grid-template-columns:repeat(3,1fr)!important;gap:14px}
  .lp-stats-grid{grid-template-columns:repeat(2,1fr)}
  .lp-popular-card{transform:scale(1.02)}
}
@media(max-width:720px){
  .lp-features-wrap,.lp-how-grid,.lp-cases-grid{grid-template-columns:1fr!important}
  .lp-testi-grid,.lp-testi-inner{grid-template-columns:1fr!important}
  .lp-pricing-grid{grid-template-columns:1fr!important;max-width:380px;margin:0 auto}
  .lp-stats-grid{grid-template-columns:1fr 1fr}
  .lp-popular-card{transform:none!important}
}`}</style>
      <PageShell lang={lang} setLang={setLang} activePage="how">
        <HowItWorks lang={lang}/>
      </PageShell>
    </>
  );
}
