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

function FAQItem({ q, a, isOpen, onToggle, ar }) {
  return (
    <div style={{
      background:LPV7_TOKENS.card, border:`1px solid ${isOpen ? "rgba(79,124,249,.35)" : LPV7_TOKENS.border}`,
      borderRadius:16, overflow:"hidden", transition:"border-color .25s",
    }}>
      <button onClick={onToggle} aria-expanded={isOpen} style={{
        width:"100%", padding:"20px 22px", background:"transparent",
        border:"none", cursor:"pointer",
        display:"flex", justifyContent:"space-between", alignItems:"center", gap:16,
        textAlign: ar ? "right" : "left",
      }}>
        <span style={{ fontWeight:600, color:LPV7_TOKENS.text, fontSize:15.5, flex:1, fontFamily:FONT_DISPLAY }}>{q}</span>
        <span style={{
          width:28, height:28, borderRadius:"50%", flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          background: isOpen ? "rgba(79,124,249,.18)" : "rgba(255,255,255,.05)",
          color:LPV7_TOKENS.blue, fontSize:17,
          transform: isOpen ? "rotate(45deg)" : "none",
          transition:"transform .25s, background .25s",
        }}>+</span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration:.28, ease:[0.22,1,0.36,1] }}
        style={{ overflow:"hidden" }}>
        <p style={{ color:LPV7_TOKENS.sub, fontSize:15, lineHeight:1.7, margin:0, padding:"0 22px 20px" }}>{a}</p>
      </motion.div>
    </div>
  );
}


function FAQ({ lang }) {
  const ar = lang === "ar";
  const [open, setOpen] = useState(0);
  const items = ar ? [
    ["هل أحتاج كاميرا خاصة؟","لا. بيشتغل مع أي كاميرا لابتوب أو ويب كام عادية. مفيش أجهزة إضافية مطلوبة."],
    ["هل بيانات الفيديو بتاعتي بتتحفظ؟","لأ. التحليل بيحصل محلياً في المتصفح بتاعك. مش بنحفظ صور أو فيديو — بس إحداثيات الوضعية المجهولة."],
    ["هل بيشتغل على Mac وWindows؟","أيوه، بيشتغل على أي متصفح حديث — Chrome وSafari وFirefox وEdge — على Mac وWindows وLinux."],
    ["إيه الفرق بين المجاني والمدفوع؟","المجاني يديك 7 أيام كاملة من أي tier. بعدين Basic مجاناً للأبد. Pro وElite بتضيفوا AI Coach وتقارير PDF وتحليل متقدم."],
    ["هل يحتاج الموظفون لأجهزة خاصة؟","لا. بيشتغل على أي كاميرا ويب عادية على اللابتوب أو الموبايل. مفيش أجهزة إضافية."],
    ["ما وقت الإعداد المتوقع؟","15 دقيقة للأفراد. يوم واحد للفرق الكبيرة +500 موظف مع دعمنا الكامل."],
    ["هل متوافق مع SAP HR وWorkday؟","أيوه. عندنا API مفتوح ووثائق تكامل كاملة مع أشهر أنظمة HR."],
  ] : [
    ["Do I need a special camera?","No. Works with any built-in laptop camera or standard webcam. No additional hardware required."],
    ["Is my video data stored?","Never. Analysis runs locally in your browser. We don't store images or video — only anonymized posture coordinates."],
    ["Does it work on Mac and Windows?","Yes, it works in any modern browser — Chrome, Safari, Firefox, Edge — on Mac, Windows, and Linux."],
    ["What's the difference between free and paid?","Free gives you a full 7-day trial of any tier. After that, Basic is free forever. Pro and Elite add AI Coach, PDF reports, and advanced analytics."],
    ["Do employees need special hardware?","No. Works with any standard webcam on laptop or smartphone. No additional devices required."],
    ["What's the expected setup time?","15 minutes for individuals. One business day for 500+ employee teams with our full support."],
    ["Does it integrate with SAP HR and Workday?","Yes. We have an open API and complete integration documentation for major HR systems."],
  ];

  return (
    <section id="faq" className="lp-section" style={{ background:LPV7_TOKENS.bg1 }}>
      <div className="lp-wrap">
        <div style={{ maxWidth:740, margin:"0 auto" }}>
          <SectionHead title={ar ? "أسئلة شائعة" : "Frequently asked questions"} />
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {items.map(([q, a], i) => (
              <Reveal key={i} delay={i * 50} y={16}>
                <FAQItem q={q} a={a} ar={ar} isOpen={open===i} onToggle={() => setOpen(open===i ? null : i)}/>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Mid-page CTA
function MidCTA({ lang, onCTA, variant="features" }) {
  const ar = lang === "ar";
  const msgs = {
    features: {
      en: { h:"Seen enough? Start free in 60 seconds.", sub:"No credit card · Works in your browser · Cancel anytime", cta:"Start Free Trial →" },
      ar: { h:"شفت كفاية؟ ابدأ مجاناً في 60 ثانية.", sub:"بدون بطاقة · في المتصفح · إلغاء في أي وقت", cta:"ابدأ مجاناً ←" },
    },
    cases: {
      en: { h:"Join 50+ teams improving posture with AI.", sub:"7-day free trial, full access, no commitment.", cta:"Try Corvus Free →" },
      ar: { h:"انضم لـ 50+ فريق بيحسّن الوضعية بالـ AI.", sub:"تجربة مجانية 7 أيام، وصول كامل، بدون التزام.", cta:"جرّب Corvus مجاناً ←" },
    },
  };
  const m = (msgs[variant]||msgs.features)[ar?"ar":"en"];
  return (
    <div style={{ margin:"0 0 0", padding:"0 24px" }}>
      <div className="lp-wrap">
        <div style={{
          background:"linear-gradient(120deg,rgba(79,124,249,.08),rgba(16,217,160,.04))",
          border:`1px solid rgba(79,124,249,.18)`, borderRadius:20,
          padding:"28px 32px", display:"flex", alignItems:"center",
          gap:24, flexWrap:"wrap", justifyContent:"space-between",
        }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:LPV7_TOKENS.text, marginBottom:5, fontFamily:FONT_DISPLAY }}>{m.h}</div>
            <div style={{ fontSize:12.5, color:LPV7_TOKENS.muted }}>{m.sub}</div>
          </div>
          <a href="#" className="lp-btn lp-btn-primary" onClick={e=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup");}}
            style={{...btn("primary","md"), whiteSpace:"nowrap", flexShrink:0}}>
            {m.cta}
          </a>
        </div>
      </div>
    </div>
  );
}

function FinalCTA({ lang, onCTA }) {
  const ar = lang === "ar";
  return (
    <section style={{ padding:"clamp(44px,6vw,80px) 16px" }}>
      <div style={{ maxWidth:760, margin:"0 auto" }}>
        <Reveal>
          <div style={{
            background:"linear-gradient(135deg,rgba(26,86,219,.12),rgba(8,145,178,.08))",
            border:`1px solid rgba(79,124,249,.22)`,
            borderRadius:24, padding:"clamp(36px,5vw,64px) clamp(20px,4vw,48px)",
            textAlign:"center",
          }}>
            <div style={{
              width:64, height:64, borderRadius:18, margin:"0 auto 22px",
              background:"linear-gradient(135deg,#1a56db,#0891b2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:30, color:"#fff", fontWeight:800,
              boxShadow:"0 8px 28px rgba(26,86,219,.45)",
            }}>◈</div>
            <h2 style={{ ...TYPE.h2, color:LPV7_TOKENS.text, margin:"0 0 14px", fontFamily:FONT_DISPLAY,
              fontSize:"clamp(22px,3vw,34px)" }}>
              {ar ? "ابدأ تحسين صحة فريقك اليوم" : "Start improving your team's health today"}
            </h2>
            <p style={{ ...TYPE.body, color:LPV7_TOKENS.sub, maxWidth:460, margin:"0 auto 32px",
              fontSize:"clamp(14px,1.2vw,16px)" }}>
              {ar
                ? "انضم إلى الشركات التي تستخدم Corvus. تجربة مجانية 7 أيام."
                : "Join 50+ teams reducing workplace pain with AI posture coaching. 7-day free trial, no credit card."}
            </p>
            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
              <a href="#" className="lp-btn lp-btn-primary"
                onClick={(e)=>{e.preventDefault();onCTA(e);navTo("/auth?mode=signup")}}
                style={btn("primary","lg")}>
                {ar ? "🚀 ابدأ تجربتك المجانية" : "🚀 Start Free Trial"}
              </a>
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer"
                className="lp-btn lp-btn-ghost" style={btn("ghost","lg")}>
                {ar ? "احجز عرضاً" : "Book Demo"}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────

export default function FAQPage() {
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
      <PageShell lang={lang} setLang={setLang} activePage="faq">
        <FAQ lang={lang}/>
      </PageShell>
    </>
  );
}
