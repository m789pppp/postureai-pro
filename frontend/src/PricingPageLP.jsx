import React, { useState, useEffect, useRef } from "react";
import { ONLINE_PAYMENT_LIVE, SALES_WHATSAPP, SALES_WHATSAPP_DISPLAY,
         whatsappActivationLink, activationPromise, activateLabel } from "./lib/salesWhatsapp.js";

import { motion, AnimatePresence } from "framer-motion";
import { PageShell } from "./StandaloneLayout.jsx";

const T = {
  bg:"#030b14", bg1:"#040d18", card:"#0d1f33",
  border:"rgba(148,163,184,.08)",
  text:"#e8f0ff", sub:"#94a3b8", muted:"#8896ac",
  blue:"#4f7cf9", indigo:"#818cf8", sky:"#22d3ee", green:"#10d9a0",
  amber:"#f59e0b",
  gHero:"linear-gradient(130deg,#818cf8 0%,#22d3ee 45%,#10d9a0 100%)",
};
const FD = "'IBM Plex Sans Arabic','Segoe UI',system-ui,sans-serif";
const FM = "'IBM Plex Mono','Segoe UI',monospace";
const SUPPORT = import.meta.env.VITE_SUPPORT_EMAIL || "support@corvus.io";

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
// #4f7cf9 (brand blue) only reaches ~4.2:1 on these card backgrounds — just
// under WCAG AA's 4.5:1 for normal-size text. Badges/borders/backgrounds
// keep the original brand blue; this lightened variant is for BLUE TEXT
// specifically, so contrast is fixed without changing the brand accent.
const _txtSafe = (c) => c === "#4f7cf9" ? "#6b8ffa" : c;

const IND_PLANS = [
  {
    name:"Free", color:"#8896ac", popular:false,
    price:{ egp:0, usd:0 }, period:"forever",
    desc:"Try Corvus with no commitment.",
    features:[
      { t:"Sessions / month",      v:"5" },
      { t:"Posture Score",         v:true },
      { t:"Demo Session",          v:true },
      { t:"Pain Self-Report",      v:true },
      { t:"First Session Badge",   v:true },
      { t:"Weekly Email Report",   v:true },
      { t:"AI Coach",              v:false },
      { t:"WhatsApp Reminders",    v:false },
    ],
    cta:"Get started free", href:"/auth?mode=signup&plan=standard",
  },
  {
    name:"Basic", color:"#94a3b8", popular:false,
    price:{ egp:199, usd:9.99 }, priceYearly:{ egp:1590, usd:79.99 }, period:"month",
    desc:"For individuals building better posture habits.",
    features:[
      { t:"Sessions / month",      v:"Unlimited" },
      { t:"Daily Check-in",        v:true },
      { t:"Weekly Challenge",      v:true },
      { t:"Pain Prediction Card",  v:true },
      { t:"Streak Freeze",         v:true },
      { t:"Posture Habit Score",   v:true },
      { t:"WhatsApp Reminders",    v:true },
      { t:"AI Coach messages",     v:"10 / month" },
    ],
    cta:"Start 7-day trial", href:"/auth?mode=signup&plan=basic",
  },
  {
    name:"Pro", color:"#4f7cf9", popular:true,
    price:{ egp:399, usd:19.99 }, priceYearly:{ egp:3190, usd:159.99 }, period:"month",
    desc:"For individuals serious about posture health.",
    features:[
      { t:"Everything in Basic",          v:true },
      { t:"AI Coach messages",            v:"30 / month" },
      { t:"Weekly Intelligence Report",   v:true },
      { t:"Shareable PDF Report",         v:true },
      { t:"Body Heatmap",                 v:true },
      { t:"Focus Mode Integration",       v:true },
      { t:"Custom Alert Rules",           v:true },
      { t:"Family / Partner Mode (+1)",   v:true },
    ],
    cta:"Start 7-day trial", href:"/auth?mode=signup&plan=professional",
  },
  {
    name:"Elite", color:"#10d9a0", popular:false,
    price:{ egp:699, usd:39.99 }, priceYearly:{ egp:5590, usd:299.99 }, period:"month",
    desc:"For power users and health professionals.",
    features:[
      { t:"Everything in Pro",              v:true },
      { t:"AI Coach messages",              v:"Unlimited" },
      { t:"Predictive AI (detailed)",       v:true },
      { t:"Voice Coach (Arabic)",           v:true },
      { t:"Monthly Physiotherapist",        v:true },
      { t:"Posture DNA Report (quarterly)", v:true },
      { t:"Priority WhatsApp Support",      v:true },
      { t:"Elite Early Access",             v:true },
    ],
    cta:"Start 7-day trial", href:"/auth?mode=signup&plan=elite",
  },
];

// ── Company Plans ─────────────────────────────────────────────────
// Was a per-seat model ("$5-8/user/mo", "Team"/"Business" names, ids that
// don't exist in the backend) that didn't match what the backend actually
// charges: flat-rate regardless of headcount, up to a seat cap. Replaced
// with the real plans (App.jsx B2B_TIERS / backend/config/pricing.py),
// confirmed with the user which model is correct.
const CO_PLANS = [
  {
    name:"Starter", color:"#4f7cf9", popular:false,
    price:{ egp:2499, usd:79 }, priceYearly:{ egp:23990, usd:758 }, period:"month",
    desc:"Flat-rate, for teams up to 30 employees.",
    features:[
      { t:"Employees", v:"Up to 30" },
      { t:"33-landmark AI pose detection", v:true },
      { t:"HR analytics dashboard", v:true },
      { t:"Weekly auto-reports", v:true },
      { t:"Slack / Teams alerts", v:true },
      { t:"CSV import", v:true },
      { t:"SSO / SAML 2.0", v:false },
      { t:"HR system connectors", v:false },
    ],
    cta:"Start free trial", href:"/auth?mode=signup&plan=b2b_starter",
  },
  {
    name:"Growth", color:"#818cf8", popular:true,
    price:{ egp:6999, usd:199 }, priceYearly:{ egp:67190, usd:1910 }, period:"month",
    desc:"Flat-rate, for teams up to 100 employees.",
    features:[
      { t:"Employees", v:"Up to 100" },
      { t:"Everything in Starter", v:true },
      { t:"FaceMesh 478-landmark detection", v:true },
      { t:"3D solvePnP head pose", v:true },
      { t:"Advanced HR analytics", v:true },
      { t:"Slack / Teams alerts", v:true },
      { t:"Executive HR reports", v:true },
      { t:"Priority support", v:true },
    ],
    cta:"Start free trial", href:"/auth?mode=signup&plan=b2b_growth",
  },
  {
    name:"Enterprise", color:"#22d3ee", popular:false,
    price:null, period:"custom",
    desc:"For unlimited-headcount organisations. Starting at $499/mo.",
    features:[
      { t:"Employees", v:"Unlimited" },
      { t:"Everything in Growth", v:true },
      { t:"Corvus AI clinical narrative", v:true },
      { t:"SAML SSO (Azure AD / Okta) — provisioned with our team", v:true },
      { t:"White-label branding", v:true },
      { t:"API + Webhooks access", v:true },
      { t:"Dedicated success manager", v:true },
      { t:"Custom SLA guarantee", v:true },
    ],
    cta:"Contact sales", href:`mailto:${SUPPORT}?subject=Corvus Enterprise`,
  },
];

// ── Compare table data (all 26 features) ─────────────────────────
const COMPARE = [
  { cat:"Core", rows:[
    ["Sessions / month",       "5",  "Unlimited","Unlimited","Unlimited"],
    ["Posture Score",          "✓",  "✓",        "✓",        "✓"],
    ["Demo Session",           "✓",  "—",        "—",        "—"],
    ["Sessions Countdown",     "✓",  "—",        "—",        "—"],
    ["Pain Self-Report",       "✓",  "✓",        "✓",        "✓"],
    ["First Session Badge",    "✓",  "✓",        "✓",        "✓"],
    ["Weekly Email Report",    "✓",  "✓",        "✓",        "✓"],
  ]},
  { cat:"Basic Habits", rows:[
    ["Daily Check-in",         "—",  "✓",        "✓",        "✓"],
    ["Weekly Challenge",       "—",  "✓",        "✓",        "✓"],
    ["Pain Prediction Card",   "—",  "✓",        "✓",        "✓"],
    ["Streak Freeze",          "—",  "✓",        "✓",        "✓"],
    ["Posture Habit Score",    "—",  "✓",        "✓",        "✓"],
    ["WhatsApp Reminders",     "—",  "✓",        "✓",        "✓"],
    ["AI Coach",               "—",  "10/mo",    "30/mo",    "Unlimited"],
  ]},
  { cat:"Pro Intelligence", rows:[
    ["Weekly Intelligence Report",  "—","—",     "✓",        "✓"],
    ["Shareable PDF Report",        "—","—",     "✓",        "✓"],
    ["Body Heatmap",                "—","—",     "✓",        "✓"],
    ["Focus Mode Integration",      "—","—",     "✓",        "✓"],
    ["Custom Alert Rules",          "—","—",     "✓",        "✓"],
    ["Family / Partner Mode (+1)",  "—","—",     "✓",        "✓"],
  ]},
  { cat:"Elite Exclusive", rows:[
    ["Predictive AI (detailed)",         "—","—","—",        "✓"],
    ["Voice Coach (Arabic)",             "—","—","—",        "✓"],
    ["Monthly Physiotherapist",          "—","—","—",        "✓"],
    ["Posture DNA Report (quarterly)",   "—","—","—",        "✓"],
    ["Priority WhatsApp Support",        "—","—","—",        "✓"],
    ["Elite Early Access",               "—","—","—",        "✓"],
  ]},
];

function Check({ val, color }) {
  if (val === true)  return <span style={{ color:"#10d9a0", fontWeight:700, fontSize:16 }}>✓</span>;
  if (val === false) return <span style={{ color:"#8896ac", fontSize:15 }}>—</span>;
  return <span style={{ color:T.text, fontFamily:FM, fontSize:13 }}>{val}</span>;
}

function PlanCard({ plan, isEgypt, billing }) {
  const rawPrice = plan.price ? (isEgypt ? plan.price.egp : plan.price.usd) : null;
  // Was a flat *.8 (a hardcoded, wrong "20% off everything" assumption) —
  // the real annual total (plan.priceYearly) isn't a fixed 20% off monthly
  // for every plan: individual plans are priced at 8× the monthly rate
  // (~33% off), company plans genuinely are ~20% off. Deriving both the
  // displayed monthly-equivalent and the "Save X%" label directly from the
  // real annual total keeps them correct for either case and can't drift
  // out of sync with the actual charge again.
  const yearlyRaw = plan.priceYearly ? (isEgypt ? plan.priceYearly.egp : plan.priceYearly.usd) : null;
  const discounted = rawPrice && billing === "yearly" && yearlyRaw ? Math.round(yearlyRaw / 12) : rawPrice;
  const discountPct = rawPrice && yearlyRaw ? Math.round((1 - yearlyRaw / (rawPrice * 12)) * 100) : null;

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
            {billing==="yearly" && discountPct != null && (
              <div style={{ fontSize:12, color:T.green, fontWeight:700, marginTop:5, fontFamily:FM }}>
                ↓ Save {discountPct}% with annual billing
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

      {/* CTA — toggling Yearly changes the price shown above but this link
          never carried that choice, so an annual selection was silently
          dropped before the user got anywhere near checkout. Only append
          &billing= to links that actually take a plan id (not the free
          Get-started/Contact-sales links, which have nothing to bill). */}
      <a href={plan.price && rawPrice>0 ? `${plan.href}&billing=${billing}` : plan.href} style={{
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

      {/* Paid plans get a second, quieter button that opens WhatsApp with THIS
          plan already written into the message. The free trial above stays the
          primary action; this is for someone who has decided and wants to pay
          now, while online checkout is still off. Without it they would have
          to scroll to the shared block below and then say which plan they
          meant — the round trip this whole route exists to avoid. */}
      {!ONLINE_PAYMENT_LIVE && plan.price && rawPrice > 0 && (
        <a href={whatsappActivationLink({
             planName: plan.name, billing,
             price: discounted, currency: isEgypt ? "EGP" : "USD", isAr: false,
           })}
           target="_blank" rel="noopener noreferrer"
           style={{
             display:"flex", alignItems:"center", justifyContent:"center", gap:7,
             marginTop:9, padding:"10px 14px", borderRadius:11,
             fontSize:12.5, fontWeight:700, color:"#25D366",
             background:"rgba(37,211,102,.07)", border:"1px solid rgba(37,211,102,.28)",
             textDecoration:"none", transition:"background .18s",
           }}
           onMouseEnter={e=>{ e.currentTarget.style.background="rgba(37,211,102,.14)"; }}
           onMouseLeave={e=>{ e.currentTarget.style.background="rgba(37,211,102,.07)"; }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink:0 }}>
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.22-8.24 8.22z"/>
          </svg>
          Pay for {plan.name} on WhatsApp
        </a>
      )}
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
  // Individual plans are priced at 8x monthly (~33% off); company plans are
  // genuinely ~20% off — this toggle-level badge used to say a flat "Save
  // 20%" regardless of mode, which was only ever true for one of the two.
  // Derived from the first paid plan of whichever list is active so it
  // can't drift from the real numbers again.
  const _refPlan = plans.find(p=>p.priceYearly);
  const badgeDiscountPct = _refPlan
    ? Math.round((1 - (_refPlan.priceYearly.usd / (_refPlan.price.usd*12))) * 100)
    : 20;

  return (
    <PageShell lang={lang} setLang={setLang} activePage="pricing">
      <style>{`
        body { background:#030b14; }
        .pr-wrap { max-width:1120px; margin:0 auto; padding:0 40px; }
        .pr-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; align-items:start; min-width:0; }
        .pr-grid > * { min-width:0; }
        .pr-compare-grid { display:grid; grid-template-columns:1.6fr 1fr 1fr 1fr 1fr; }
        @media(max-width:960px){
          .pr-grid { grid-template-columns:1fr 1fr !important; max-width:720px; margin:0 auto; }
          .pr-compare-grid { grid-template-columns:1.4fr 1fr 1fr 1fr 1fr; }
        }
        @media(max-width:700px){
          .pr-wrap { padding:0 20px; }
          .pr-compare-grid { display:none; }
          .pr-grid { grid-template-columns:1fr !important; max-width:420px; }
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
                      border:"none", cursor:"pointer", padding:"4px 12px",
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
                      Save {badgeDiscountPct}%
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
          {/* BUG FIX: said 14 days here but "7-day trial" everywhere else
              on this same page (and across the rest of the app) — fixed to
              match the real trial length. */}
          {/* "Egyptian payment methods" was in this list. No payment provider
              is configured, so it advertised something that does not work —
              the same reassurance strip that is meant to remove doubt was
              creating a promise the checkout could not keep. */}
          {["✓ 7-day free trial","✓ No credit card","✓ Cancel anytime","✓ Free plan forever"].map(t=>(
            <span key={t} style={{ fontSize:13, color:T.muted }}>{t}</span>
          ))}
        </div>

        {/* Online payment is not live yet. Better said here, next to the
            prices, than discovered at the checkout. Same number and same
            30-minute commitment as the in-app billing screen — both read
            VITE_SALES_WHATSAPP so they cannot drift apart. */}
        {!ONLINE_PAYMENT_LIVE && (
          <div className="pr-wrap" style={{ marginTop:36 }}>
            <div style={{ maxWidth:620, margin:"0 auto", padding:"16px 20px", borderRadius:14,
              background:"rgba(37,211,102,.06)", border:"1px solid rgba(37,211,102,.22)",
              textAlign:"center", lineHeight:1.8 }}>
              <div style={{ fontSize:13.5, fontWeight:700, color:T.text }}>
                Online payment is coming soon — to start a paid plan now, send us the plan you want on WhatsApp
              </div>
              <a href={whatsappActivationLink({ isAr: false })} target="_blank" rel="noopener noreferrer"
                 style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:9,
                   width:"100%", maxWidth:340, margin:"10px auto 0", boxSizing:"border-box",
                   background:"#25D366", border:"none", borderRadius:12,
                   padding:"13px 18px", fontSize:14.5, fontWeight:800, color:"#06281a",
                   textDecoration:"none", direction:"ltr", cursor:"pointer",
                   boxShadow:"0 4px 16px rgba(37,211,102,.28)", transition:"transform .18s, box-shadow .18s" }}
                 onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 22px rgba(37,211,102,.36)"; }}
                 onMouseLeave={e=>{ e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="0 4px 16px rgba(37,211,102,.28)"; }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink:0 }}><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.470 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z"/><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.22-8.24 8.22z"/></svg>
                <span>{activateLabel(false)}</span>
                <span style={{ opacity:.72, fontWeight:700 }}>· {SALES_WHATSAPP_DISPLAY}</span>
              </a>
              <div style={{ fontSize:12, color:T.muted, marginTop:8 }}>
                {activationPromise(false)}
              </div>
            </div>
          </div>
        )}
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
                {["Free","Basic","Pro","Elite"].map((p,i)=>(
                  <div key={p} style={{ padding:"18px 16px", textAlign:"center",
                    fontSize:14, fontWeight:800, color:_txtSafe(IND_PLANS[i].color), fontFamily:FD }}>
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
                        <div key={vi} style={{ padding:"15px 16px", textAlign:"center" }}>
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
            ["What payment methods?","Credit/debit cards, Vodafone Cash, Fawry, and bank transfer for annual plans. EGP accepted via Kashier."],
            ["What happens after the trial?","You choose a paid plan or move to Free automatically. All your data and history is preserved either way."],
            ["Discounts for NGOs or universities?","Yes — 50% off for verified educational institutions and NGOs. Contact us with your organisation details."],
            ["Is the company plan per active user?","No — company plans are flat-rate: one fixed monthly price covers your whole team up to that plan's employee cap (30 for Starter, 100 for Growth), regardless of how many are actively using it."],
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
              <span style={{ fontSize:13, color:T.green, fontWeight:600 }}>7-day free trial — no credit card required</span>
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
