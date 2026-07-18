import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  SUPPORT_EMAIL, CALENDLY_URL, LPV7_TOKENS, FONT_DISPLAY, FONT_MONO,
  TYPE, btn, card, Eyebrow, SectionHead, Reveal, Stagger, StaggerItem, AnimNum,
} from "./sharedTokens.jsx";
import { PageShell } from "./StandaloneLayout.jsx";



function Features({ lang }) {
  const ar = lang === "ar";
  const [active, setActive] = useState(0);
  // Reset to first tab on language change — avoids stale index if array length differs
  useEffect(() => { setActive(0); }, [ar]);

  const features = ar ? [
    { icon:"🎯", title:"تحليل دقيق بالذكاء الاصطناعي",
      desc:"478 نقطة تتبع + تحليل ثلاثي الأبعاد لوضع الرأس بدقة ~96%",
      detail:"تقنية MediaPipe FaceMesh المتقدمة تتتبع 478 نقطة معلم على الوجه والجسم لتقييم الوضعية بدقة لم تكن ممكنة من قبل." },
    { icon:"📊", title:"لوحة HR الذكية",
      desc:"تحليلات فورية لصحة الفريق والمخاطر المهنية",
      detail:"لوحة قيادة متكاملة تعرض مؤشرات الأداء، تنبيهات المخاطر، وتقارير قابلة للتصدير بصيغ PDF وExcel." },
    { icon:"🤖", title:"مدرب AI شخصي",
      desc:"توصيات مخصصة بالذكاء الاصطناعي",
      detail:"محادثة AI تفاعلية تحلل بيانات الجلسة وتقدم توصيات علاجية مخصصة لكل موظف." },
    { icon:"🔗", title:"تكاملات المؤسسات",
      desc:"Slack · Teams · Jira · SAP HR · Webhooks",
      detail:"API متكامل مع أنظمة HR الموجودة. تنبيهات تلقائية على Slack وTeams عند اكتشاف مخاطر عالية." },
    { icon:"🛡️", title:"أمان المستوى المؤسسي",
      desc:"SAML SSO · RBAC · تشفير كامل · سجلات التدقيق",
      detail:"ISO27001 · تشفير AES-256 للبيانات في حالة السكون. سجلات تدقيق شاملة لكل حدث." },
  ] : [
    { icon:"🎯", title:"Precision AI Analysis",
      desc:"478-landmark tracking + 3D head pose at ~96% accuracy",
      detail:"Advanced MediaPipe FaceMesh technology tracks 478 facial and body landmarks to assess posture with medical-grade precision previously only available in clinical settings." },
    { icon:"📊", title:"Smart HR Dashboard",
      desc:"Real-time team health analytics and risk monitoring",
      detail:"Integrated command center showing KPIs, risk alerts, exportable reports in PDF/Excel, and department-level breakdowns." },
    { icon:"🤖", title:"Personal AI Coach",
      desc:"Personalized AI-powered recommendations",
      detail:"Interactive AI chat analyzes session data and provides tailored therapeutic recommendations for each employee." },
    { icon:"🔗", title:"Enterprise Integrations",
      desc:"Slack · Teams · Jira · SAP HR · Webhooks",
      detail:"Full API integration with existing HR systems. Automatic Slack/Teams alerts when high-risk posture is detected." },
    { icon:"🛡️", title:"Enterprise-Grade Security",
      desc:"SAML SSO · RBAC · Full encryption · Audit logs",
      detail:"ISO27001 · AES-256 encryption at rest. Comprehensive audit logs for every system event." },
  ];

  const f = features[active];

  return (
    <section id="features" className="lp-section">
      <div className="lp-wrap">
        <SectionHead eyebrow={ar ? "المنصة" : "Platform"}
          title={ar ? "كل ما تحتاجه لصحة موظفيك" : "Everything your workforce health program needs"}
          sub={ar ? "من التحليل الفوري إلى الرؤى المؤسسية — كل شيء في مكان واحد"
                  : "From real-time analysis to enterprise insights — everything in one platform"}/>

        <div className="lp-features-wrap">
          {/* Feature tabs */}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }} className="lp-features-tabs">
            {features.map((item, i) => (
              <button key={i} onClick={() => setActive(i)} style={{
                background: active === i ? "rgba(79,124,249,.12)" : "transparent",
                border: active === i ? "1px solid rgba(79,124,249,.28)" : "1px solid transparent",
                borderRadius:14, padding:"15px 16px",
                cursor:"pointer", textAlign: ar ? "right" : "left",
                transition:"background .2s,border-color .2s",
                display:"flex", alignItems:"center", gap:13,
              }}>
                <span style={{
                  width:38, height:38, borderRadius:11, flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
                  background: active === i ? LPV7_TOKENS.gBlue : "rgba(255,255,255,.05)",
                  boxShadow: active === i ? "0 4px 14px rgba(79,124,249,.4)" : "none",
                  transition:"background .2s,box-shadow .2s",
                }}>{item.icon}</span>
                <span style={{ fontSize:14.5, fontWeight:500,
                  color: active === i ? LPV7_TOKENS.text : LPV7_TOKENS.sub }}>{item.title}</span>
              </button>
            ))}
          </div>

          {/* Feature detail */}
          <motion.div key={active}
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:.35, ease:[0.22,1,0.36,1] }}
            style={{ ...card(true), display:"flex", flexDirection:"column", gap:16, padding:"clamp(20px,2vw,36px)", minHeight:"auto" }}>
            <span style={{
              width:60, height:60, borderRadius:16, fontSize:28,
              display:"flex", alignItems:"center", justifyContent:"center",
              background:LPV7_TOKENS.gBlue, boxShadow:"0 6px 20px rgba(79,124,249,.4)",
            }}>{f.icon}</span>
            <h3 style={{ ...TYPE.h3, fontSize:26, color:LPV7_TOKENS.text, margin:0, fontFamily:FONT_DISPLAY }}>
              {f.title}
            </h3>
            <p style={{ fontSize:16.5, color:LPV7_TOKENS.indigo, margin:0, fontWeight:500 }}>
              {f.desc}
            </p>
            <p style={{ ...TYPE.bodySm, color:LPV7_TOKENS.sub, margin:0 }}>
              {f.detail}
            </p>
          </motion.div>
        </div>
      </div>
      <style>{`
        @media(max-width:860px){
          .lp-features-grid{grid-template-columns:1fr!important}
          .lp-features-tabs{flex-direction:row!important;overflow-x:auto;gap:8px!important;
            padding-bottom:6px;-webkit-overflow-scrolling:touch}
          .lp-features-tabs button{flex-shrink:0}
          .lp-features-tabs button span:last-child{display:none}
        }
      `}</style>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────

export default function ProductPage() {
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
      <PageShell lang={lang} setLang={setLang} activePage="features">
        <Features lang={lang}/>
      </PageShell>
    </>
  );
}
