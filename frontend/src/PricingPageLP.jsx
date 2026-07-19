import React, { useState, useEffect, useRef } from "react";
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

function Reveal({ children, delay=0, y=20 }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { rootMargin:"-40px" });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <motion.div ref={ref}
      initial={{ opacity:0, y }}
      animate={vis ? { opacity:1, y:0 } : {}}
      transition={{ duration:.5, delay, ease:[0.22,1,0.36,1] }}>
      {children}
    </motion.div>
  );
}

// ── Individual Plans ──────────────────────────────────────────────
const IND_PLANS = [
  {
    name:"Free", color:"#64748b", popular:false,
    price:{ egp:0, usd:0 }, period:"forever",
    desc:"Try Corvus with no commitment.",
    features:[
      { t:"Posture sessions", v:"5 / month" },
      { t:"AI Coach messages", v:"5 / day" },
      { t:"Session history", v:"7 days" },
      { t:"Basic score dashboard", v:true },
      { t:"Weekly reports", v:false },
      { t:"Stretch programs", v:false },
      { t:"Priority support", v:false },
    ],
    cta:"Get started free", href:"/auth?mode=signup",
  },
  {
    name:"Pro", color:"#4f7cf9", popular:true,
    price:{ egp:149, usd:9 }, period:"month",
    desc:"For individuals serious about posture health.",
    features:[
      { t:"Posture sessions", v:"Unlimited" },
      { t:"AI Coach messages", v:"Unlimited" },
      { t:"Session history", v:"90 days" },
      { t:"Full analytics dashboard", v:true },
      { t:"Weekly progress reports", v:true },
      { t:"Stretch program library", v:true },
      { t:"Priority support", v:true },
    ],
    cta:"Start 14-day trial", href:"/auth?mode=signup",
  },
  {
    name:"Clinical", color:"#10d9a0", popular:false,
    price:{ egp:299, usd:19 }, period:"month",
    desc:"For physios and health professionals.",
    features:[
      { t:"Posture sessions", v:"Unlimited" },
      { t:"AI Coach messages", v:"Unlimited" },
      { t:"Client management", v:"Up to 20" },
      { t:"Clinical posture reports", v:true },
      { t:"PDF export (patient files)", v:true },
      { t:"Advanced analytics", v:true },
      { t:"Early feature access", v:true },
    ],
    cta:"Start 14-day trial", href:"/auth?mode=signup",
  },
];

// ── Company Plans ─────────────────────────────────────────────────
const CO_PLANS = [
  {
    name:"Team", color:"#4f7cf9", popular:false,
    price:{ egp:89, usd:5 }, period:"user / month", min:10,
    desc:"For teams of 10–100 employees.",
    features:[
      { t:"Employees", v:"10–100" },
      { t:"HR dashboard", v:true },
      { t:"Department management", v:true },
      { t:"Weekly auto-reports", v:true },
      { t:"Slack / Teams alerts", v:true },
      { t:"CSV import", v:true },
      { t:"SSO / SAML 2.0", v:false },
      { t:"HR system connectors", v:false },
    ],
    cta:"Start free trial", href:"/auth?mode=signup",
  },
  {
    name:"Business", color:"#818cf8", popular:true,
    price:{ egp:129, usd:8 }, period:"user / month", min:10,
    desc:"For mid-size companies that need more control.",
    features:[
      { t:"Employees", v:"10–5,000" },
      { t:"HR dashboard + heatmaps", v:true },
      { t:"Department management", v:true },
      { t:"Weekly auto-reports", v:true },
      { t:"Slack / Teams alerts", v:true },
      { t:"SSO / SAML 2.0", v:true },
      { t:"HR system connectors", v:"SAP, Workday" },
      { t:"Dedicated onboarding", v:true },
    ],
    cta:"Start free trial", href:"/auth?mode=signup",
  },
  {
    name:"Enterprise", color:"#22d3ee", popular:false,
    price:null, period:"custom",
    desc:"For 500+ employee organisations.",
    features:[
      { t:"Employees", v:"Unlimited" },
      { t:"Everything in Business", v:true },
      { t:"On-premise option", v:true },
      { t:"Custom SLA", v:true },
      { t:"Dedicated CSM", v:true },
      { t:"Volume pricing", v:true },
      { t:"Legal & compliance pack", v:true },
      { t:"Custom reporting", v:true },
    ],
    cta:"Contact sales", href:`mailto:${SUPPORT}?subject=Corvus Enterprise`,
  },
];

// ── Compare table data ────────────────────────────────────────────
const COMPARE = [
  { cat:"Core Analysis", rows:[
    ["Sessions / month","5","Unlimited","Unlimited"],
    ["Landmark tracking","478","478","478"],
    ["Session history","7 days","90 days","90 days"],
    ["Confidence scoring","✓","✓","✓"],
  ]},
  { cat:"AI Coach", rows:[
    ["Daily AI messages","5","Unlimited","Unlimited"],
    ["Scientific citations","✗","✓","✓"],
    ["Personalised programs","✗","✓","✓"],
    ["Progress tracking","✗","✓","✓"],
  ]},
  { cat:"Reports", rows:[
    ["Weekly reports","✗","✓","✓"],
    ["PDF export","✗","✓","✓"],
    ["Clinical format","✗","✗","✓"],
    ["Client management","✗","✗","Up to 20"],
  ]},
];

function Check({ val, color }) {
  if (val === true)  return <span style={{ color:"#10d9a0", fontWeight:700, fontSize:16 }}>✓</span>;
  if (val === false) return <span style={{ color:"#334155", fontSize:15 }}>—</span>;
  return <span style={{ color:T.text, fontFamily:FM, fontSize:13 }}>{val}</span>;
}

function PlanCard({ plan, isEgypt, billing }) {
  const rawPrice = plan.price ? (isEgypt ? plan.price.egp : plan.price.usd) : null;
  const discounted = rawPrice && billing === "yearly" ? Math.round(rawPrice * .8) : rawPrice;

  return (
    <div style={{
      background: plan.popular
        ? `linear-gradient(160deg,${plan.color}10 0%,${T.card} 60%)`
        : T.card,
      border:`1.5px solid ${plan.popular ? plan.color+"45" : T.border}`,
      borderRadius:20, padding:"32px 28px",
      position:"relative", display:"flex", flexDirection:"column",
      transform: plan.popular ? "scale(1.04)" : "none",
      boxShadow: plan.popular
        ? `0 0 80px ${plan.color}0e, 0 12px 48px rgba(0,0,0,.4)`
        : "0 4px 24px rgba(0,0,0,.2)",
      transition:"transform .2s, box-shadow .2s",
    }}>
      {plan.popular && (
        <div style={{
          position:"absolute", top:-13, left:"50%", transform:"translateX(-50%)",
          background:`linear-gradient(135deg,${plan.color},${plan.color}bb)`,
          color:"#fff", fontSize:11, fontWeight:700, letterSpacing:".07em",
          textTransform:"uppercase", padding:"5px 16px", borderRadius:99,
          fontFamily:FM, whiteSpace:"nowrap", boxShadow:`0 4px 16px ${plan.color}55`,
        }}>✦ Most Popular</div>
      )}

      {/* Plan name + desc */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <div style={{
            width:36, height:36, borderRadius:10, flexShrink:0,
            background:`${plan.color}14`, border:`1px solid ${plan.color}28`,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <div style={{ width:10, height:10, borderRadius:"50%", background:plan.color }}/>
          </div>
          <span style={{ fontSize:17, fontWeight:800, color:T.text, fontFamily:FD }}>{plan.name}</span>
        </div>
        <p style={{ fontSize:13.5, color:T.muted, lineHeight:1.55, margin:0 }}>{plan.desc}</p>
      </div>

      {/* Price */}
      <div style={{ marginBottom:28, paddingBottom:24, borderBottom:`1px solid rgba(148,163,184,.07)` }}>
        {rawPrice === null ? (
          <div>
            <div style={{ fontSize:34, fontWeight:800, color:T.text, fontFamily:FM, letterSpacing:"-.02em" }}>Custom</div>
            <div style={{ fontSize:13, color:T.muted, marginTop:4 }}>Contact us for pricing</div>
          </div>
        ) : rawPrice === 0 ? (
          <div>
            <div style={{ fontSize:34, fontWeight:800, color:T.text, fontFamily:FM }}>Free</div>
            <div style={{ fontSize:13, color:T.muted, marginTop:4 }}>No credit card needed</div>
          </div>
        ) : (
          <div>
            <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
              {billing==="yearly" && (
                <span style={{ fontSize:16, color:T.muted, textDecoration:"line-through", fontFamily:FM }}>{isEgypt?"EGP ":"$"}{rawPrice}</span>
              )}
              <span style={{ fontSize:36, fontWeight:800, color:T.text, fontFamily:FM, letterSpacing:"-.025em" }}>
                {isEgypt?"EGP ":"$"}{discounted}
              </span>
              <span style={{ fontSize:13, color:T.muted }}>/ {plan.period}</span>
            </div>
            {billing==="yearly" && (
              <div style={{ fontSize:12, color:T.green, fontWeight:700, marginTop:5, fontFamily:FM }}>
                ↓ Save 20% with annual billing
              </div>
            )}
            {plan.min && <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>Min. {plan.min} users</div>}
          </div>
        )}
      </div>

      {/* Features */}
      <ul style={{ listStyle:"none", padding:0, margin:"0 0 28px", display:"flex", flexDirection:"column", gap:12, flex:1 }}>
        {plan.features.map(({ t, v }) => (
          <li key={t} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
            <span style={{ fontSize:13.5, color:T.sub }}>{t}</span>
            <Check val={v} color={plan.color}/>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <a href={plan.href} style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:6,
        padding:"13px 20px", borderRadius:12, fontSize:14.5, fontWeight:700,
        background: plan.popular ? "linear-gradient(135deg,#1a56db,#0891b2)" : `${plan.color}10`,
        color: plan.popular ? "#fff" : plan.color,
        border: plan.popular ? "none" : `1.5px solid ${plan.color}28`,
        textDecoration:"none", transition:"all .2s",
        boxShadow: plan.popular ? "0 4px 20px rgba(26,86,219,.4)" : "none",
      }}
      onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.opacity=".9"; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform="none"; e.currentTarget.style.opacity="1"; }}>
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
      if (cached) { setIsEgypt(cached==="EG"); return; }
    } catch {}
    fetch("https://get.geojs.io/v1/ip/country.json")
      .then(r=>r.json()).then(d => {
        const eg = d?.country==="EG";
        setIsEgypt(eg);
        try { sessionStorage.setItem("corvus_geo_country", d?.country||""); } catch {}
      }).catch(()=>{});
  }, []);

  const plans = mode==="individual" ? IND_PLANS : CO_PLANS;

  return (
    <PageShell lang={lang} setLang={setLang} activePage="pricing">
      <style>{`
        body { background:#030b14; }
        .pr-wrap { max-width:1120px; margin:0 auto; padding:0 40px; }
        .pr-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; align-items:start; }
        .pr-compare-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; }
        @media(max-width:960px){
          .pr-grid { grid-template-columns:1fr !important; max-width:420px; margin:0 auto; }
          .pr-compare-grid { grid-template-columns:1.5fr 1fr 1fr 1fr; }
        }
        @media(max-width:700px){
          .pr-wrap { padding:0 20px; }
          .pr-compare-grid { display:none; }
        }
        @media(max-width:480px){ .pr-wrap { padding:0 16px; } }
      `}</style>

      {/* ── Hero ── */}
      <div style={{ padding:"100px 0 72px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, pointerEvents:"none",
          background:"radial-gradient(ellipse 70% 50% at 50% -10%,rgba(245,158,11,.09),transparent)" }}/>
        <div className="pr-wrap" style={{ position:"relative" }}>
          <Reveal>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, marginBottom:24,
              padding:"6px 18px", borderRadius:99,
              background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.22)" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:T.amber, display:"inline-block" }}/>
              <span style={{ fontSize:12, fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:T.amber, fontFamily:FM }}>Pricing</span>
            </div>
          </Reveal>
          <Reveal delay={.07}>
            <h1 style={{ fontSize:"clamp(40px,5.5vw,68px)", fontWeight:800, color:T.text,
              margin:"0 0 20px", letterSpacing:"-.035em", lineHeight:1.05, fontFamily:FD }}>
              Simple, transparent{" "}
              <span style={{ background:T.gHero, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>pricing</span>
            </h1>
          </Reveal>
          <Reveal delay={.13}>
            <p style={{ fontSize:18.5, color:T.sub, maxWidth:520, margin:"0 auto 44px", lineHeight:1.75 }}>
              Start free. Scale when you're ready.
              {isEgypt ? " Prices shown in Egyptian Pounds." : " No hidden fees, no lock-in."}
            </p>
          </Reveal>

          {/* Controls */}
          <Reveal delay={.18}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>

              {/* Mode toggle */}
              <div style={{ display:"inline-flex", background:"rgba(255,255,255,.04)",
                border:"1px solid rgba(255,255,255,.09)", borderRadius:14, padding:5, gap:4 }}>
                {[["individual","👤 Individual"],["company","🏢 For Teams"]].map(([val,label])=>(
                  <button key={val} onClick={()=>setMode(val)} style={{
                    padding:"10px 24px", borderRadius:10, fontSize:14.5, fontWeight:600,
                    background: mode===val ? "rgba(79,124,249,.18)" : "transparent",
                    border: mode===val ? "1px solid rgba(79,124,249,.38)" : "1px solid transparent",
                    color: mode===val ? T.text : T.muted,
                    cursor:"pointer", fontFamily:FD, transition:"all .18s",
                  }}>{label}</button>
                ))}
              </div>

              {/* Billing + currency row */}
              <div style={{ display:"flex", alignItems:"center", gap:20, flexWrap:"wrap", justifyContent:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10,
                  background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)",
                  borderRadius:99, padding:"6px 16px" }}>
                  {["monthly","yearly"].map(b=>(
                    <button key={b} onClick={()=>setBilling(b)} style={{
                      background:"none", border:"none", cursor:"pointer", padding:"4px 12px",
                      borderRadius:99, fontSize:13.5, fontWeight: billing===b ? 700 : 500,
                      color: billing===b ? T.text : T.muted, fontFamily:FD,
                      background: billing===b ? "rgba(255,255,255,.07)" : "transparent",
                      transition:"all .18s",
                    }}>{b.charAt(0).toUpperCase()+b.slice(1)}</button>
                  ))}
                  {billing==="yearly" && (
                    <span style={{ fontSize:11.5, fontWeight:700, color:T.green,
                      background:"rgba(16,217,160,.1)", border:"1px solid rgba(16,217,160,.25)",
                      borderRadius:99, padding:"3px 10px", fontFamily:FM, marginLeft:4 }}>
                      Save 20%
                    </span>
                  )}
                </div>

                <button onClick={()=>setIsEgypt(v=>!v)} style={{
                  background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.09)",
                  borderRadius:99, padding:"8px 16px", cursor:"pointer",
                  fontSize:13, color:T.muted, fontFamily:FD, transition:"all .18s",
                }}
                onMouseEnter={e=>e.currentTarget.style.color=T.sub}
                onMouseLeave={e=>e.currentTarget.style.color=T.muted}>
                  {isEgypt ? "🌍 Switch to USD" : "🇪🇬 Switch to EGP"}
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── Plans grid ── */}
      <div className="pr-wrap" style={{ paddingBottom:20 }}>
        <AnimatePresence mode="wait">
          <motion.div key={mode} className="pr-grid"
            initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-8 }} transition={{ duration:.3 }}>
            {plans.map(plan=>(
              <PlanCard key={plan.name} plan={plan} isEgypt={isEgypt} billing={billing}/>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Trust badges */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
          gap:24, flexWrap:"wrap", padding:"40px 0 16px" }}>
          {["✓ 14-day free trial","✓ No credit card","✓ Cancel anytime","✓ Egyptian payment methods"].map(t=>(
            <span key={t} style={{ fontSize:13, color:T.muted }}>{t}</span>
          ))}
        </div>
      </div>

      {/* ── Compare table (Individual only) ── */}
      {mode==="individual" && (
        <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", padding:"80px 0" }}>
          <div className="pr-wrap">
            <Reveal>
              <h2 style={{ fontSize:"clamp(24px,3vw,38px)", fontWeight:800, color:T.text,
                margin:"0 0 48px", fontFamily:FD, letterSpacing:"-.025em", textAlign:"center" }}>
                Compare all features
              </h2>
            </Reveal>
            <div style={{ background:T.card, borderRadius:20, overflow:"hidden",
              border:"1px solid rgba(148,163,184,.07)" }}>
              {/* Header */}
              <div className="pr-compare-grid" style={{
                background:"rgba(255,255,255,.025)", borderBottom:"1px solid rgba(148,163,184,.07)" }}>
                <div style={{ padding:"18px 28px", fontSize:11.5, color:T.muted,
                  fontWeight:700, fontFamily:FM, textTransform:"uppercase", letterSpacing:".1em" }}>Feature</div>
                {["Free","Pro","Clinical"].map((p,i)=>(
                  <div key={p} style={{ padding:"18px 20px", textAlign:"center",
                    fontSize:14, fontWeight:800, color:IND_PLANS[i].color, fontFamily:FD }}>
                    {p}
                  </div>
                ))}
              </div>
              {COMPARE.map(({ cat, rows })=>(
                <div key={cat}>
                  <div style={{ padding:"12px 28px",
                    background:"rgba(255,255,255,.012)",
                    borderBottom:"1px solid rgba(148,163,184,.05)",
                    fontSize:11, fontWeight:700, color:T.muted,
                    textTransform:"uppercase", letterSpacing:".1em", fontFamily:FM }}>
                    {cat}
                  </div>
                  {rows.map(([label,...vals],ri)=>(
                    <div key={label} className="pr-compare-grid" style={{
                      borderBottom:"1px solid rgba(148,163,184,.04)",
                      transition:"background .15s",
                    }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.015)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{ padding:"15px 28px", fontSize:14, color:T.sub }}>{label}</div>
                      {vals.map((v,vi)=>(
                        <div key={vi} style={{ padding:"15px 20px", textAlign:"center" }}>
                          <Check val={v} color={IND_PLANS[vi].color}/>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FAQ ── */}
      <div className="pr-wrap" style={{ padding:"80px 0" }}>
        <Reveal>
          <h2 style={{ fontSize:"clamp(22px,2.8vw,34px)", fontWeight:800, color:T.text,
            margin:"0 0 36px", fontFamily:FD, letterSpacing:"-.02em" }}>
            Pricing FAQ
          </h2>
        </Reveal>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 64px" }}>
          {[
            ["Can I switch plans anytime?","Yes. Upgrades are instant and pro-rated. Downgrades take effect at end of billing period. No penalties."],
            ["What payment methods?","Credit/debit cards, Vodafone Cash, Fawry, and bank transfer for annual plans. EGP accepted via PayMob."],
            ["What happens after the trial?","You choose a paid plan or move to Free automatically. All your data and history is preserved either way."],
            ["Discounts for NGOs or universities?","Yes — 50% off for verified educational institutions and NGOs. Contact us with your organisation details."],
            ["Is the company plan per active user?","Yes, you're billed only for active users each month. Inactive accounts don't count toward your bill."],
            ["Can I get a custom quote?","Yes. For teams over 200 employees we offer volume discounts. Book a call and we'll build a package for you."],
          ].map(([q,a],i)=>(
            <Reveal key={q} delay={i*.04}>
              <div style={{ padding:"24px 0", borderTop:"1px solid rgba(148,163,184,.07)" }}>
                <div style={{ fontSize:15, fontWeight:700, color:T.text, marginBottom:10, lineHeight:1.4 }}>{q}</div>
                <p style={{ fontSize:14, color:T.muted, margin:0, lineHeight:1.75 }}>{a}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div style={{ marginTop:20 }}>
          <a href="/faq" style={{ fontSize:14, color:T.blue, textDecoration:"none", fontWeight:600,
            display:"inline-flex", alignItems:"center", gap:6 }}>
            See all FAQ →
          </a>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ background:T.bg1, borderTop:"1px solid rgba(148,163,184,.06)", padding:"88px 0", textAlign:"center" }}>
        <div className="pr-wrap">
          <Reveal>
            <div style={{ display:"inline-flex", alignItems:"center", gap:10, marginBottom:24,
              padding:"8px 20px", borderRadius:99,
              background:"rgba(16,217,160,.08)", border:"1px solid rgba(16,217,160,.2)" }}>
              <span style={{ fontSize:14 }}>🎉</span>
              <span style={{ fontSize:13, color:T.green, fontWeight:600 }}>14-day free trial — no credit card required</span>
            </div>
            <h2 style={{ fontSize:"clamp(28px,3.5vw,48px)", fontWeight:800, color:T.text,
              margin:"0 0 18px", fontFamily:FD, letterSpacing:"-.025em" }}>
              Start for free today
            </h2>
            <p style={{ fontSize:17.5, color:T.sub, margin:"0 auto 40px", maxWidth:480, lineHeight:1.75 }}>
              Join teams across Egypt and MENA cutting sick leave with AI posture coaching.
            </p>
            <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
              <a href="/auth?mode=signup" style={{
                display:"inline-flex", alignItems:"center", gap:8,
                padding:"15px 36px", borderRadius:12, fontSize:16, fontWeight:700,
                background:"linear-gradient(135deg,#1a56db,#0891b2)", color:"#fff",
                textDecoration:"none", boxShadow:"0 4px 24px rgba(26,86,219,.4)",
                transition:"all .2s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 32px rgba(26,86,219,.5)"}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 4px 24px rgba(26,86,219,.4)"}}>
                Get started free
              </a>
              <a href={`mailto:${SUPPORT}?subject=Corvus Demo`} style={{
                display:"inline-flex", alignItems:"center", gap:8,
                padding:"15px 28px", borderRadius:12, fontSize:16, fontWeight:600,
                background:"rgba(255,255,255,.05)", color:T.sub,
                border:"1px solid rgba(255,255,255,.1)", textDecoration:"none",
                transition:"all .2s",
              }}
              onMouseEnter={e=>{e.currentTarget.style.color=T.text;e.currentTarget.style.borderColor="rgba(255,255,255,.22)"}}
              onMouseLeave={e=>{e.currentTarget.style.color=T.sub;e.currentTarget.style.borderColor="rgba(255,255,255,.1)"}}>
                Book a demo →
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </PageShell>
  );
}
