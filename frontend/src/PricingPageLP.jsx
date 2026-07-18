import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell } from "./StandaloneLayout.jsx";

const T = {
  bg:"#030b14", bg1:"#040d18", card:"#0d1f33",
  border:"rgba(148,163,184,.08)",
  text:"#e8f0ff", sub:"#94a3b8", muted:"#475569",
  blue:"#4f7cf9", indigo:"#818cf8", sky:"#22d3ee", green:"#10d9a0",
  amber:"#f59e0b",
  gHero:"linear-gradient(130deg,#818cf8 0%,#22d3ee 45%,#10d9a0 100%)",
};
const FD = "'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif";
const FM = "'IBM Plex Mono','Segoe UI',monospace";
const SUPPORT = import.meta.env.VITE_SUPPORT_EMAIL || "m789pppp@gmail.com";

function Reveal({ children, delay=0, y=24 }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { rootMargin:"-60px" });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <motion.div ref={ref}
      initial={{ opacity:0, y }}
      animate={vis ? { opacity:1, y:0 } : {}}
      transition={{ duration:.55, delay, ease:[0.22,1,0.36,1] }}>
      {children}
    </motion.div>
  );
}

const INDIVIDUAL_PLANS = [
  { name:"Free", price:{ egp:0, usd:0 }, period:"forever", color:"#64748b", popular:false,
    desc:"Try Corvus with no commitment.",
    features:["5 posture sessions/month","Basic score dashboard","AI Coach (5 msgs/day)","Email support"],
    cta:"Get started free", ctaHref:"/auth?mode=signup",
  },
  { name:"Pro", price:{ egp:149, usd:9 }, period:"month", color:"#4f7cf9", popular:true,
    desc:"For individuals serious about posture health.",
    features:["Unlimited sessions","Full posture history","AI Coach (unlimited)","Weekly progress reports","Stretch program library","Priority support"],
    cta:"Start 14-day trial", ctaHref:"/auth?mode=signup",
  },
  { name:"Clinical", price:{ egp:299, usd:19 }, period:"month", color:"#10d9a0", popular:false,
    desc:"For physios and health professionals.",
    features:["Everything in Pro","Client management (up to 20)","Clinical posture reports","PDF export for patient files","Advanced analytics","Early feature access"],
    cta:"Start 14-day trial", ctaHref:"/auth?mode=signup",
  },
];

const COMPANY_PLANS = [
  { name:"Team", price:{ egp:89, usd:5 }, period:"user/month", min:10, color:"#4f7cf9", popular:false,
    desc:"For teams of 10–100 employees.",
    features:["Everything in Individual Pro","HR dashboard","Department management","Weekly auto-reports","Slack/Teams alerts","CSV import","API access (read)"],
    cta:"Start free trial", ctaHref:"/auth?mode=signup",
  },
  { name:"Business", price:{ egp:129, usd:8 }, period:"user/month", min:10, color:"#818cf8", popular:true,
    desc:"For mid-size companies that need more control.",
    features:["Everything in Team","SSO / SAML 2.0","Custom risk thresholds","Webhook integrations","HR system connectors (SAP, Workday)","Dedicated onboarding","SLA 99.9%"],
    cta:"Start free trial", ctaHref:"/auth?mode=signup",
  },
  { name:"Enterprise", price:null, color:"#22d3ee", popular:false,
    desc:"For 500+ employee organisations with custom needs.",
    features:["Everything in Business","Custom contract & SLA","On-premise deployment option","Dedicated CSM","Custom reporting","Volume pricing","Legal & compliance package"],
    cta:"Contact sales", ctaHref:`mailto:${SUPPORT}?subject=Corvus Enterprise`,
  },
];

const COMPARE_FEATURES = [
  { category:"Analysis", items:[
    ["Posture sessions/month","5","Unlimited","Unlimited"],
    ["Landmark tracking","478 points","478 points","478 points"],
    ["Session history","7 days","90 days","90 days"],
    ["Accuracy level","Standard","High","High"],
  ]},
  { category:"AI Coach", items:[
    ["Daily AI messages","5","Unlimited","Unlimited"],
    ["Evidence citations","✗","✓","✓"],
    ["Personalised programs","✗","✓","✓"],
  ]},
  { category:"Reports", items:[
    ["Weekly reports","✗","✓","✓"],
    ["PDF export","✗","✓","✓"],
    ["Clinical format","✗","✗","✓"],
  ]},
];

function PlanCard({ plan, isEgypt, billing, mode }) {
  const price = plan.price;
  const yearlyDiscount = .2;
  const rawPrice = isEgypt ? price?.egp : price?.usd;
  const displayPrice = rawPrice === undefined ? null
    : rawPrice === 0 ? 0
    : billing === "yearly" ? Math.round(rawPrice * (1 - yearlyDiscount))
    : rawPrice;

  return (
    <div style={{
      background: plan.popular ? `linear-gradient(160deg,${plan.color}12,${T.card})` : T.card,
      border:`1.5px solid ${plan.popular ? plan.color+"50" : T.border}`,
      borderRadius:20, padding:"28px 24px", position:"relative",
      transform: plan.popular ? "scale(1.03)" : "none",
      boxShadow: plan.popular ? `0 0 60px ${plan.color}14, 0 8px 32px rgba(0,0,0,.35)` : "0 4px 24px rgba(0,0,0,.2)",
      display:"flex", flexDirection:"column",
    }}>
      {plan.popular && (
        <div style={{
          position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)",
          background:`linear-gradient(135deg,${plan.color},${plan.color}cc)`,
          color:"#fff", fontSize:11, fontWeight:700, letterSpacing:".06em",
          textTransform:"uppercase", padding:"4px 14px", borderRadius:99,
          fontFamily:FM, whiteSpace:"nowrap",
          boxShadow:`0 4px 14px ${plan.color}50`,
        }}>✦ Most Popular</div>
      )}

      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, color:plan.color, marginBottom:6,
          fontFamily:FM, textTransform:"uppercase", letterSpacing:".06em" }}>{plan.name}</div>
        <div style={{ fontSize:12.5, color:T.muted, lineHeight:1.5 }}>{plan.desc}</div>
      </div>

      <div style={{ marginBottom:24 }}>
        {displayPrice === null ? (
          <div style={{ fontSize:28, fontWeight:800, color:T.text, fontFamily:FM }}>Custom</div>
        ) : displayPrice === 0 ? (
          <div style={{ fontSize:28, fontWeight:800, color:T.text, fontFamily:FM }}>Free</div>
        ) : (
          <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
            <span style={{ fontSize:32, fontWeight:800, color:T.text, fontFamily:FM, letterSpacing:"-.02em" }}>
              {isEgypt ? "EGP " : "$"}{displayPrice}
            </span>
            <span style={{ fontSize:13, color:T.muted }}>/ {plan.period}</span>
          </div>
        )}
        {billing==="yearly" && rawPrice > 0 && (
          <div style={{ fontSize:11.5, color:T.green, fontWeight:600, marginTop:4, fontFamily:FM }}>
            Save 20% vs monthly
          </div>
        )}
        {plan.min && (
          <div style={{ fontSize:11.5, color:T.muted, marginTop:4 }}>Minimum {plan.min} users</div>
        )}
      </div>

      <ul style={{ listStyle:"none", padding:0, margin:"0 0 28px", display:"flex", flexDirection:"column", gap:10, flex:1 }}>
        {plan.features.map(f => (
          <li key={f} style={{ display:"flex", gap:9, fontSize:13.5, color:T.sub, lineHeight:1.5 }}>
            <span style={{ color:plan.color, flexShrink:0, fontWeight:700 }}>✓</span>{f}
          </li>
        ))}
      </ul>

      <a href={plan.ctaHref} style={{
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:"12px", borderRadius:12, fontSize:14, fontWeight:700,
        background: plan.popular ? `linear-gradient(135deg,#1a56db,#0891b2)` : `${plan.color}12`,
        color: plan.popular ? "#fff" : plan.color,
        border: plan.popular ? "none" : `1px solid ${plan.color}30`,
        textDecoration:"none", transition:"all .2s",
        boxShadow: plan.popular ? "0 4px 18px rgba(26,86,219,.35)" : "none",
      }}
      onMouseEnter={e=>{ e.currentTarget.style.opacity=".88"; e.currentTarget.style.transform="translateY(-1px)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.opacity="1"; e.currentTarget.style.transform="none"; }}>
        {plan.cta}
      </a>
    </div>
  );
}

export default function PricingPageStandalone() {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("lp_lang")||"en"; } catch { return "en"; } });
  const [mode, setMode] = useState("individual");
  const [billing, setBilling] = useState("yearly");
  const [isEgypt, setIsEgypt] = useState(false);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("corvus_geo_country");
      if (cached) { setIsEgypt(cached === "EG"); return; }
    } catch {}
    fetch("https://get.geojs.io/v1/ip/country.json")
      .then(r => r.json())
      .then(d => {
        const eg = d?.country === "EG";
        setIsEgypt(eg);
        try { sessionStorage.setItem("corvus_geo_country", d?.country||""); } catch {}
      }).catch(() => {});
  }, []);

  const plans = mode === "individual" ? INDIVIDUAL_PLANS : COMPANY_PLANS;

  return (
    <PageShell lang={lang} setLang={setLang} activePage="pricing">
      <style>{`
        body{background:#030b14}
        .pr-wrap{max-width:1100px;margin:0 auto;padding:0 32px}
        .pr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
        @media(max-width:960px){.pr-grid{grid-template-columns:1fr!important;max-width:440px;margin:0 auto}}
        @media(max-width:860px){.pr-wrap{padding:0 20px}}
        @media(max-width:600px){.pr-wrap{padding:0 16px}}
      `}</style>

      {/* ── Hero ── */}
      <div style={{ padding:"96px 0 64px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background:"radial-gradient(ellipse 70% 50% at 50% -10%,rgba(245,158,11,.08),transparent)" }}/>
        <div className="pr-wrap" style={{ position:"relative" }}>
          <Reveal>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginBottom:24,
              padding:"6px 16px", borderRadius:99,
              background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.2)" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:T.amber, display:"inline-block" }}/>
              <span style={{ fontSize:12, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:T.amber, fontFamily:FM }}>
                Pricing
              </span>
            </div>
          </Reveal>
          <Reveal delay={.08}>
            <h1 style={{ fontSize:"clamp(36px,5vw,62px)", fontWeight:800, color:T.text,
              margin:"0 0 18px", letterSpacing:"-.03em", lineHeight:1.06, fontFamily:FD }}>
              Simple, transparent{" "}
              <span style={{ background:T.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                pricing
              </span>
            </h1>
          </Reveal>
          <Reveal delay={.12}>
            <p style={{ fontSize:17, color:T.sub, maxWidth:500, margin:"0 auto 36px", lineHeight:1.75 }}>
              Start free. Scale when you're ready. No hidden fees, no lock-in.
              {isEgypt && " Prices shown in Egyptian Pounds."}
            </p>
          </Reveal>

          {/* Mode + Billing toggles */}
          <Reveal delay={.16}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
              {/* Mode toggle */}
              <div style={{ display:"flex", background:"rgba(255,255,255,.05)",
                border:"1px solid rgba(255,255,255,.1)", borderRadius:12, padding:4, gap:4 }}>
                {[["individual","👤 Individual"],["company","🏢 For Teams"]].map(([val, label]) => (
                  <button key={val} onClick={() => setMode(val)}
                    style={{
                      padding:"9px 22px", borderRadius:9, fontSize:14, fontWeight:600,
                      background: mode===val ? "rgba(79,124,249,.2)" : "transparent",
                      border: mode===val ? "1px solid rgba(79,124,249,.35)" : "1px solid transparent",
                      color: mode===val ? T.text : T.muted,
                      cursor:"pointer", fontFamily:FD, transition:"all .18s",
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Billing toggle */}
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                {["monthly","yearly"].map(b => (
                  <button key={b} onClick={() => setBilling(b)}
                    style={{
                      background:"none", border:"none", cursor:"pointer",
                      fontSize:13.5, fontWeight: billing===b ? 700 : 500,
                      color: billing===b ? T.text : T.muted, fontFamily:FD,
                      transition:"color .18s",
                    }}>
                    {b.charAt(0).toUpperCase()+b.slice(1)}
                  </button>
                ))}
                {billing==="yearly" && (
                  <span style={{ fontSize:11, fontWeight:700, color:T.green,
                    background:"rgba(16,217,160,.1)", border:"1px solid rgba(16,217,160,.25)",
                    borderRadius:99, padding:"3px 10px", fontFamily:FM }}>
                    Save 20%
                  </span>
                )}
              </div>

              {/* Currency toggle */}
              <button onClick={() => setIsEgypt(v => !v)} style={{
                background:"none", border:"none", cursor:"pointer",
                fontSize:12.5, color:T.muted, fontFamily:FD, textDecoration:"underline",
                transition:"color .18s",
              }}
              onMouseEnter={e=>e.currentTarget.style.color=T.sub}
              onMouseLeave={e=>e.currentTarget.style.color=T.muted}>
                {isEgypt ? "Switch to USD" : "Switch to EGP"}
              </button>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── Plans ── */}
      <div className="pr-wrap" style={{ paddingBottom:80 }}>
        <AnimatePresence mode="wait">
          <motion.div key={mode} className="pr-grid"
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0 }} transition={{ duration:.3 }}
            style={{ alignItems:"start" }}>
            {plans.map(plan => (
              <PlanCard key={plan.name} plan={plan} isEgypt={isEgypt} billing={billing} mode={mode}/>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Trust line */}
        <div style={{ textAlign:"center", marginTop:36, display:"flex",
          alignItems:"center", justifyContent:"center", gap:20, flexWrap:"wrap" }}>
          {["✓ 14-day free trial","✓ No credit card required","✓ Cancel anytime","✓ Egyptian payment methods"].map(t => (
            <span key={t} style={{ fontSize:13, color:T.muted }}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── Compare table ── */}
      <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", padding:"80px 0" }}>
        <div className="pr-wrap">
          <Reveal>
            <h2 style={{ fontSize:"clamp(24px,2.8vw,38px)", fontWeight:800, color:T.text,
              margin:"0 0 48px", fontFamily:FD, textAlign:"center" }}>
              Compare Individual plans
            </h2>
          </Reveal>
          <div style={{ background:T.card, borderRadius:20, overflow:"hidden", border:"1px solid rgba(148,163,184,.08)" }}>
            {/* Header */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr",
              background:"rgba(255,255,255,.03)", borderBottom:"1px solid rgba(148,163,184,.08)" }}>
              <div style={{ padding:"18px 24px", fontSize:12, color:T.muted, fontWeight:600,
                fontFamily:FM, textTransform:"uppercase", letterSpacing:".08em" }}>Feature</div>
              {["Free","Pro","Clinical"].map(p => (
                <div key={p} style={{ padding:"18px 16px", textAlign:"center",
                  fontSize:13, fontWeight:700, color:T.text, fontFamily:FM }}>{p}</div>
              ))}
            </div>
            {COMPARE_FEATURES.map(({ category, items }) => (
              <div key={category}>
                <div style={{ padding:"12px 24px", background:"rgba(255,255,255,.015)",
                  borderBottom:"1px solid rgba(148,163,184,.05)",
                  fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase",
                  letterSpacing:".1em", fontFamily:FM }}>
                  {category}
                </div>
                {items.map(([label, free, pro, clinical]) => (
                  <div key={label} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr",
                    borderBottom:"1px solid rgba(148,163,184,.04)" }}>
                    <div style={{ padding:"14px 24px", fontSize:13.5, color:T.sub }}>{label}</div>
                    {[free, pro, clinical].map((val, i) => (
                      <div key={i} style={{ padding:"14px 16px", textAlign:"center",
                        fontSize:13.5, color: val==="✗" ? T.muted : val==="✓" ? T.green : T.text,
                        fontFamily: val==="✓"||val==="✗" ? "inherit" : FM,
                        fontWeight: val==="✓" ? 700 : "normal",
                      }}>{val}</div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FAQ snippet ── */}
      <div className="pr-wrap" style={{ padding:"72px 0" }}>
        <Reveal>
          <h2 style={{ fontSize:"clamp(22px,2.5vw,34px)", fontWeight:800, color:T.text,
            margin:"0 0 36px", fontFamily:FD }}>Pricing FAQ</h2>
        </Reveal>
        {[
          ["Can I switch plans?","Yes, anytime. Upgrades are instant. Downgrades take effect at end of billing period."],
          ["What payment methods are accepted?","Credit/debit cards, Vodafone Cash, Fawry, and bank transfer for annual plans."],
          ["Is there a discount for large teams?","Yes. Teams over 200 employees get volume discounts. Contact us for a custom quote."],
          ["What happens after the trial?","You choose a plan or downgrade to Free. Your data is preserved either way."],
        ].map(([q, a], i) => (
          <div key={q} style={{ borderTop:"1px solid rgba(148,163,184,.06)", padding:"18px 0" }}>
            <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:8 }}>{q}</div>
            <p style={{ fontSize:14.5, color:T.sub, margin:0, lineHeight:1.7 }}>{a}</p>
          </div>
        ))}
        <div style={{ marginTop:24 }}>
          <a href="/faq" style={{ fontSize:14, color:T.blue, textDecoration:"none", fontWeight:600 }}>
            See all FAQ →
          </a>
        </div>
      </div>

      {/* ── CTA ── */}
      <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", padding:"80px 0", textAlign:"center" }}>
        <div className="pr-wrap">
          <Reveal>
            <h2 style={{ fontSize:"clamp(24px,3vw,40px)", fontWeight:800, color:T.text,
              margin:"0 0 14px", fontFamily:FD }}>Start your free trial today</h2>
            <p style={{ fontSize:16, color:T.sub, margin:"0 auto 32px", maxWidth:400, lineHeight:1.7 }}>
              14 days, full access, no credit card.
              Cancel with one click if it's not for you.
            </p>
            <a href="/auth?mode=signup" style={{
              display:"inline-flex", alignItems:"center", gap:8,
              padding:"14px 36px", borderRadius:12, fontSize:16, fontWeight:700,
              background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
              textDecoration:"none", boxShadow:"0 4px 20px rgba(26,86,219,.35)",
            }}>Get started — it's free</a>
          </Reveal>
        </div>
      </div>
    </PageShell>
  );
}
