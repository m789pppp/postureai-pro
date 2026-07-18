import React, { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { PageShell } from "./StandaloneLayout.jsx";


const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "m789pppp@gmail.com";
const CALENDLY_URL  = import.meta.env.VITE_CALENDLY_URL  || `mailto:${import.meta.env.VITE_SUPPORT_EMAIL||"m789pppp@gmail.com"}?subject=Demo%20Request`;



// Stagger container — wraps a group of children so they cascade in
// one after another on scroll, instead of each needing its own delay.


// ── Currency detection ──────────────────────────────────────────────
// Real IP-based country lookup (not language!) — a Saudi visitor browsing
// in Arabic still pays USD via Stripe; an Egyptian visitor browsing in
// English still pays EGP via PayMob. Detected once per browser session,
// cached, with a silent fallback to the language heuristic if the lookup
// fails (ad-blockers, offline, slow network) — never breaks the page.
function useCurrency(arFallback) {
  const [country, setCountry] = useState(() => {
    try { return sessionStorage.getItem("corvus_geo_country") || null; } catch { return null; }
  });
  const [override, setOverrideState] = useState(() => {
    try { return sessionStorage.getItem("corvus_currency_override") || null; } catch { return null; }
  });

  useEffect(() => {
    if (country) return; // already cached this session
    let cancelled = false;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    fetch("https://get.geojs.io/v1/ip/country.json", { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data?.country) return;
        setCountry(data.country);
        try { sessionStorage.setItem("corvus_geo_country", data.country); } catch {}
      })
      .catch(() => {}) // silent — falls back to language heuristic below
      .finally(() => clearTimeout(t));
    return () => { cancelled = true; ctrl.abort(); clearTimeout(t); };
  }, [country]);

  const setOverride = (code) => {
    setOverrideState(code);
    try { sessionStorage.setItem("corvus_currency_override", code); } catch {}
  };

  const isEgypt = override ? override === "EGP" : (country ? country === "EG" : arFallback);
  return { isEgypt, setOverride };
}




// Eyebrow pill — used above most section headings

// Section heading block — eyebrow + title + optional sub, centered

// ── Global stylesheet ─────────────────────────────────────────────


// ── Scroll progress bar ───────────────────────────────────────────

// ── Navigation ────────────────────────────────────────────────────

// ── Global stylesheet ─────────────────────────────────────────────


// ── Scroll progress bar ───────────────────────────────────────────

// ── Navigation ────────────────────────────────────────────────────

function CaseStudies({ lang }) {
  const ar = lang === "ar";
  const cases = ar ? [
    { co:"شركة اتصالات كبرى", industry:"اتصالات", employees:"2,400", result:"↓52%", resultLabel:"غياب مرتبط بوضعية الجسم", time:"6 أشهر", detail:"وفرت 1.2م ج.م. سنوياً في تكاليف العلاج الطبيعي", quote:"Corvus غيّر طريقة تفكيرنا في صحة الموظفين — من تكلفة لاستثمار", quoteName:"م. أحمد، مدير الموارد البشرية" },
    { co:"بنك وطني", industry:"مصرفية", employees:"850", result:"↑23%", resultLabel:"رضا الموظفين", time:"3 أشهر", detail:"انتشار ممتاز: 94% معدل استخدام يومي", quote:"أسهل أداة أطلقناها على الإطلاق. الفريق استخدمها من اليوم الأول", quoteName:"ن. سعيد، مدير التقنية" },
    { co:"شركة تقنية ناشئة", industry:"تكنولوجيا", employees:"120", result:"↓38%", resultLabel:"شكاوى آلام الظهر", time:"4 أشهر", detail:"عائد استثمار 4.1× خلال السنة الأولى", quote:"ROI واضح خلال 6 أسابيع. أوصي به لكل فريق remote", quoteName:"ي. حسن، المدير التنفيذي" },
  ] : [
    { co:"Major Telecom Corp.", industry:"Telecommunications", employees:"2,400", result:"↓52%", resultLabel:"posture-related absences", time:"6 months", detail:"Saved $340K annually in physiotherapy costs", quote:"Corvus changed how we think about employee health — from a cost to an investment.", quoteName:"A. Hassan, HR Director" },
    { co:"National Bank", industry:"Banking", employees:"850", result:"↑23%", resultLabel:"employee satisfaction", time:"3 months", detail:"Excellent adoption: 94% daily active rate", quote:"Easiest tool we've ever rolled out. Team was using it from day one.", quoteName:"N. Said, CTO" },
    { co:"Tech Startup", industry:"Technology", employees:"120", result:"↓38%", resultLabel:"back pain complaints", time:"4 months", detail:"4.1× ROI in the first year", quote:"Clear ROI within 6 weeks. I recommend it to every remote-first team.", quoteName:"Y. Hassan, CEO" },
  ];

  return (
    <section id="casestudies" className="lp-section">
      <div className="lp-wrap">
        <SectionHead eyebrow={ar ? "نتائج حقيقية" : "Real Results"}
          eyebrowColor={LPV7_TOKENS.green} eyebrowBg="rgba(16,217,160,.08)" eyebrowBorder="rgba(16,217,160,.2)"
          title={ar ? "عملاؤنا يحقّقون نتائج قابلة للقياس" : "Our customers achieve measurable results"}/>

        <Stagger key={String(ar)} className="lp-cases-grid">
          {cases.map((c) => (
            <StaggerItem key={c.co}>
              <div className="lp-lift" style={{ ...card(), height:"100%", display:"flex", flexDirection:"column" }}>
                <div style={{
                  background:"rgba(79,124,249,.08)", borderRadius:8,
                  padding:"5px 12px", fontSize:12.5, color:LPV7_TOKENS.indigo,
                  fontWeight:500, display:"inline-block", marginBottom:14,
                }}>{c.industry}</div>
                <h3 style={{ fontSize:17, fontWeight:700, color:LPV7_TOKENS.text, margin:"0 0 4px", fontFamily:FONT_DISPLAY }}>
                  {c.co}
                </h3>
                <div style={{ fontSize:12.5, color:LPV7_TOKENS.muted, marginBottom:18 }}>
                  {c.employees} {ar ? "موظف" : "employees"} · {c.time}
                </div>
                <div style={{
                  fontSize:"clamp(32px,2.8vw,40px)", fontWeight:700, color:LPV7_TOKENS.green, marginBottom:4,
                  fontFamily:FONT_MONO, lineHeight:1,
                }}>{c.result}</div>
                <div style={{ fontSize:14, color:LPV7_TOKENS.text, fontWeight:600, marginBottom:14 }}>
                  {c.resultLabel}
                </div>
                <p style={{ ...TYPE.bodySm, color:LPV7_TOKENS.sub, margin:"0 0 16px", paddingTop:14, borderTop:`1px solid ${LPV7_TOKENS.border}` }}>
                  {c.detail}
                </p>
                {/* Quote */}
                <div style={{ flex:1, background:"rgba(255,255,255,.025)", borderRadius:12, padding:"12px 14px", marginBottom:16, borderLeft:`3px solid ${LPV7_TOKENS.green}` }}>
                  <p style={{ fontSize:13, color:LPV7_TOKENS.sub, lineHeight:1.6, margin:"0 0 8px", fontStyle:"italic" }}>"{c.quote}"</p>
                  <span style={{ fontSize:11.5, color:LPV7_TOKENS.muted, fontWeight:600 }}>— {c.quoteName}</span>
                </div>
                {/* CTA */}
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer"
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                    padding:"10px 0", borderRadius:10, fontSize:13.5, fontWeight:600,
                    color:LPV7_TOKENS.indigo, border:`1px solid rgba(129,140,248,.25)`,
                    background:"rgba(129,140,248,.06)", textDecoration:"none",
                    transition:"background .2s, border-color .2s",
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.background="rgba(129,140,248,.12)"; e.currentTarget.style.borderColor="rgba(129,140,248,.4)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="rgba(129,140,248,.06)"; e.currentTarget.style.borderColor="rgba(129,140,248,.25)"; }}>
                  {ar ? "احجز عرضاً مشابهاً ←" : "Get similar results →"}
                </a>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
      <style>{`@media(max-width:860px){.lp-cases-grid{grid-template-columns:1fr!important}}`}</style>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────

function Testimonials({ lang }) {
  const ar = lang === "ar";
  const testimonials = ar ? [
    { name:"سارة محمود", initials:"سم", role:"مهندسة برمجيات أولى", company:"Vodafone مصر", text:"كنت بعاني من آلام رقبة كل يوم بعد 8 ساعات شغل. بعد أسبوعين من Corvus، الألم راح تقريباً. أوضح ROI على أداة اشتريتها.", score:"5/5", outcome:"آلام الرقبة انتهت في أسبوعين", color:"#818cf8" },
    { name:"أحمد كريم", initials:"أك", role:"مدير موارد بشرية", company:"Orange Business", text:"جربنا 3 أدوات قبل Corvus. دي الأولى اللي الفريق بيستخدمها فعلاً. الـ AI coach بيعمل فرق حقيقي ومش مجرد رقم على شاشة.", score:"4.9/5", outcome:"أعلى adoption rate من 3 أدوات", color:"#22d3ee" },
    { name:"ياسمين حسن", initials:"يح", role:"مديرة تقنية", company:"Fawry", text:"الإعداد خلص في 20 دقيقة. الدقة في تتبع وضعية الرقبة أعلى من أي أداة جربتها. التقارير الأسبوعية مفيدة للتتبع.", score:"4.8/5", outcome:"إعداد كامل في 20 دقيقة", color:"#10d9a0" },
  ] : [
    { name:"Sara Mahmoud", initials:"SM", role:"Senior Software Engineer", company:"Vodafone Egypt", text:"I had neck pain daily after 8-hour work sessions. Two weeks with Corvus and it's nearly gone. Clearest ROI of any tool I've bought.", score:"5/5", outcome:"Neck pain gone in 2 weeks", color:"#818cf8" },
    { name:"Ahmed Karim", initials:"AK", role:"HR Director", company:"Orange Business", text:"We tried 3 tools before Corvus. This is the first one the team actually uses. The AI coach makes a real difference — not just a number on a screen.", score:"4.9/5", outcome:"Highest adoption of 3 tools tested", color:"#22d3ee" },
    { name:"Yasmine Hassan", initials:"YH", role:"Chief Technology Officer", company:"Fawry", text:"Setup took 20 minutes. Neck posture tracking accuracy is higher than any tool I've tested. Weekly reports are genuinely useful for tracking progress.", score:"4.8/5", outcome:"Full team setup in 20 min", color:"#10d9a0" },
  ];

  return (
    <section id="testimonials" className="lp-section">
      <div className="lp-wrap">
        <SectionHead
          eyebrow={ar ? "آراء العملاء" : "Real results"}
          title={ar ? "ماذا يقول عملاؤنا" : "What our customers say"}
          sub={ar ? "نتائج حقيقية من مستخدمين حقيقيين في مصر والخليج" : "Real results from real users across Egypt and the Gulf"}
        />
        <Stagger key={String(ar)} className="lp-testi-grid">
          {testimonials.map((t) => (
            <StaggerItem key={t.name}>
              <div className="lp-lift" style={{
                height:"100%", borderRadius:20, padding:28, position:"relative",
                background:"rgba(255,255,255,.035)", border:`1px solid ${LPV7_TOKENS.border}`,
                backdropFilter:"blur(16px)", display:"flex", flexDirection:"column",
              }}>
                {/* Quote mark */}
                <div style={{ position:"absolute", top:20, [ar?"left":"right"]:24,
                  fontSize:44, color:"rgba(79,124,249,.14)", fontFamily:"Georgia,serif", lineHeight:1 }}>"</div>
                {/* Outcome badge */}
                <div style={{ display:"inline-flex", alignItems:"center", gap:6,
                  background:"rgba(16,217,160,.08)", border:"1px solid rgba(16,217,160,.2)",
                  borderRadius:99, padding:"4px 11px", marginBottom:14, alignSelf:"flex-start" }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:LPV7_TOKENS.green, flexShrink:0 }}/>
                  <span style={{ fontSize:11, color:LPV7_TOKENS.green, fontWeight:600 }}>{t.outcome}</span>
                </div>
                {/* Stars */}
                <div style={{ display:"flex", gap:2, marginBottom:14 }}>
                  {"★★★★★".split("").map((s,i) => (
                    <span key={i} style={{ color:LPV7_TOKENS.amber, fontSize:14 }}>{s}</span>
                  ))}
                  <span style={{ color:LPV7_TOKENS.muted, fontSize:11.5, marginLeft:8, fontFamily:FONT_MONO }}>{t.score}</span>
                </div>
                {/* Text */}
                <p style={{ fontSize:15, color:LPV7_TOKENS.sub, lineHeight:1.7, margin:"0 0 22px", flex:1 }}>"{t.text}"</p>
                {/* Author */}
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{
                    width:44, height:44, borderRadius:"50%", flexShrink:0,
                    background:`linear-gradient(135deg, ${t.color}40, ${t.color}18)`,
                    border:`1.5px solid ${t.color}50`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, fontWeight:800, color:t.color, letterSpacing:".5px",
                  }}>{t.initials}</div>
                  <div style={{flex:1}}>
                    <div style={{ fontWeight:700, color:LPV7_TOKENS.text, fontSize:14 }}>{t.name}</div>
                    <div style={{ color:LPV7_TOKENS.muted, fontSize:11.5, marginTop:1 }}>{t.role}</div>
                    <div style={{ color:t.color, fontSize:11, marginTop:2, fontWeight:600, opacity:.8 }}>{t.company}</div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────

export default function SolutionsPage() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("lp_lang") || "en"; } catch { return "en"; }
  });
  return (
    <>
      <style>{`
.lp-features-wrap { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
.lp-how-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:28px; }
.lp-cases-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:28px; }
.lp-testi-grid,.lp-testi-inner { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
.lp-pricing-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
.lp-stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
.lp-popular-card { transform:scale(1.035); }
@media(max-width:1024px){
  .lp-features-wrap { grid-template-columns:1fr 1fr; gap:16px; }
  .lp-how-grid { grid-template-columns:repeat(3,1fr); gap:16px; }
  .lp-cases-grid { grid-template-columns:1fr 1fr; gap:20px; }
  .lp-testi-grid,.lp-testi-inner { grid-template-columns:1fr 1fr !important; }
  .lp-pricing-grid { grid-template-columns:repeat(3,1fr) !important; gap:14px; }
  .lp-stats-grid { grid-template-columns:repeat(2,1fr); }
  .lp-popular-card { transform:scale(1.02); }
}
@media(max-width:720px){
  .lp-features-wrap,.lp-how-grid,.lp-cases-grid { grid-template-columns:1fr !important; }
  .lp-testi-grid,.lp-testi-inner { grid-template-columns:1fr !important; }
  .lp-pricing-grid { grid-template-columns:1fr !important; max-width:380px; margin:0 auto; }
  .lp-stats-grid { grid-template-columns:1fr 1fr; }
  .lp-popular-card { transform:none !important; }
}
`}</style>
      <PageShell lang={lang} setLang={setLang} activePage="casestudies">
        <CaseStudies lang={lang}/>
        <Testimonials lang={lang}/>
      </PageShell>
    </>
  );
}
