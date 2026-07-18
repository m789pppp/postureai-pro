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

function Pricing({ lang, onCTA, mode: modeProp, isEgypt, setCurrencyOverride }) {
  const ar = lang === "ar";
  const [billing, setBilling] = useState("yearly");
  const [localMode, setLocalMode] = useState(modeProp || "company");

  // Sync if parent changes mode (e.g. nav toggle)
  useEffect(() => { if (modeProp) setLocalMode(modeProp); }, [modeProp]);

  const isCompany = localMode === "company";

  // ── Single source of truth — MUST match App.jsx TIERS/B2B_TIERS,
  //    Billing.jsx PLANS/B2B_PLANS, and PricingPage.jsx exactly ──
  const b2cPlans = [
    {
      id:"basic", name: ar?"أساسي":"Basic",
      priceUSD:{ monthly:9.99, yearly:79.99 }, priceEGP:{ monthly:199, yearly:1590 },
      color:LPV7_TOKENS.sub,
      features: ar
        ? ["جلسات غير محدودة","مدرب AI (10 رسائل/شهر)","سلسلة وأهداف","توقع الألم","المتصدرين","بطاقة مشاركة"]
        : ["Unlimited sessions","AI Coach (10 msgs/mo)","Streak & Goals","Pain prediction","Leaderboard","Share card"],
    },
    {
      id:"professional", name: ar?"احترافي":"Pro",
      priceUSD:{ monthly:19.99, yearly:159.99 }, priceEGP:{ monthly:399, yearly:3190 },
      popular:true, color:LPV7_TOKENS.blue,
      features: ar
        ? ["كل Basic","رؤى AI","تقارير كاملة","مقارنة الجلسات","تصدير CSV/PDF","تقرير أسبوعي","تنبيهات الشذوذ"]
        : ["Everything in Basic","AI Insights","Full Reports","Session compare","Export CSV/PDF","Weekly report","Anomaly alerts"],
    },
    {
      id:"elite", name: ar?"إيليت":"Elite",
      priceUSD:{ monthly:39.99, yearly:299.99 }, priceEGP:{ monthly:699, yearly:5590 },
      color:LPV7_TOKENS.green,
      features: ar
        ? ["كل Pro","مدرب AI غير محدود","AI تنبؤي","تقرير PDF","دعم أولوية","معايرة","سرد الجلسة"]
        : ["Everything in Pro","AI Coach unlimited","Predictive AI","PDF report","Priority support","Calibration","Session narrative"],
    },
  ];

  const b2bPlans = [
    {
      id:"b2b_starter", name: ar?"ستارتر":"Starter",
      priceUSD:{ monthly:79, yearly:758 }, priceEGP:{ monthly:2499, yearly:23990 },
      color:LPV7_TOKENS.sub,
      features: ar
        ? ["حتى 30 موظف","كشف 33 نقطة بالـAI","تقارير PDF","لوحة تحليلات HR","تجربة مجانية 7 أيام","دعم بالبريد"]
        : ["Up to 30 employees","33-point AI pose detection","PDF reports","HR analytics dashboard","7-day free trial","Email support"],
    },
    {
      id:"b2b_growth", name: ar?"جروث":"Growth",
      priceUSD:{ monthly:199, yearly:1910 }, priceEGP:{ monthly:6999, yearly:67190 },
      popular:true, color:LPV7_TOKENS.blue,
      features: ar
        ? ["حتى 100 موظف","FaceMesh 478 نقطة","وضع رأس ثلاثي الأبعاد","تنبيهات Slack/Teams","تقرير HR تنفيذي","دعم أولوية + SLA"]
        : ["Up to 100 employees","FaceMesh 478 landmarks","3D head pose","Slack/Teams alerts","Executive HR reports","Priority support + SLA"],
    },
    {
      id:"b2b_enterprise", name: ar?"إنتربرايز":"Enterprise",
      priceUSD:{ monthly:null, yearly:null, startingAt:499 }, priceEGP:{ monthly:null, yearly:null },
      isEnterprise:true, color:LPV7_TOKENS.green,
      features: ar
        ? ["موظفون غير محدودون","AI clinical narrative","SAML SSO / Azure AD","White-label","SLA مخصص","مدير نجاح مخصص"]
        : ["Unlimited employees","AI clinical narrative","SAML SSO / Azure AD","White-label","Custom SLA","Dedicated success manager"],
    },
  ];

  const plans = isCompany ? b2bPlans : b2cPlans;

  return (
    <section id="pricing" className="lp-section" style={{ background:LPV7_TOKENS.bg1 }}>
      <div className="lp-wrap">
        <Reveal>
          <div style={{ textAlign:"center", marginBottom:48 }}>
            <h2 style={{ ...TYPE.h2, color:LPV7_TOKENS.text, margin:"0 0 16px", fontFamily:FONT_DISPLAY }}>
              {ar ? "أسعار بسيطة وشفافة" : "Simple, transparent pricing"}
            </h2>
            <p style={{ ...TYPE.body, color:LPV7_TOKENS.sub, marginBottom:30 }}>
              {ar ? "تجربة مجانية 7 أيام · لا بطاقة ائتمان" : "7-day free trial · No credit card required"}
            </p>

            {/* Individual / Company toggle */}
            <div style={{
              display:"inline-flex", alignItems:"center", gap:4,
              background:"rgba(255,255,255,.06)", borderRadius:12,
              padding:4, border:`1px solid ${LPV7_TOKENS.border}`,
              marginBottom:20,
            }}>
              {[
                { id:"individual", icon:"👤", en:"Individual", ar:"فرد" },
                { id:"company",    icon:"🏢", en:"Company / HR", ar:"شركة / HR" },
              ].map(seg => (
                <button key={seg.id} onClick={() => setLocalMode(seg.id)} style={{
                  background: localMode === seg.id
                    ? (seg.id === "company" ? LPV7_TOKENS.indigo : LPV7_TOKENS.blue)
                    : "transparent",
                  color: localMode === seg.id ? "#fff" : LPV7_TOKENS.muted,
                  border:"none", borderRadius:9,
                  padding:"9px 22px",
                  cursor:"pointer", fontWeight:600, fontSize:14,
                  transition:"background .18s,color .18s",
                  whiteSpace:"nowrap",
                }}>
                  {seg.icon} {ar ? seg.ar : seg.en}
                </button>
              ))}
            </div>

            {/* Monthly / Yearly toggle */}
            <div style={{
              display:"inline-flex", alignItems:"center",
              background:"rgba(255,255,255,.05)", borderRadius:100,
              padding:4, border:`1px solid ${LPV7_TOKENS.border}`,
            }}>
              {["monthly","yearly"].map(b => (
                <button key={b} onClick={() => setBilling(b)} style={{
                  background: billing === b ? LPV7_TOKENS.blue : "transparent",
                  color: billing === b ? "#fff" : LPV7_TOKENS.sub,
                  border:"none", borderRadius:100, padding:"10px 22px",
                  cursor:"pointer", fontWeight:500, fontSize:14.5,
                  transition:"background .2s,color .2s",
                }}>
                  {b === "monthly"
                    ? (ar ? "شهري" : "Monthly")
                    : (ar ? "سنوي (وفّر 20%)" : "Yearly (save 20%)")}
                </button>
              ))}
            </div>

            <div style={{ marginTop:16, fontSize:13, color:LPV7_TOKENS.muted }}>
              {isEgypt
                ? (ar ? "🇪🇬 الأسعار معروضة بالجنيه المصري" : "🇪🇬 Prices shown in EGP")
                : (ar ? "🌍 الأسعار معروضة بالدولار الأمريكي" : "🌍 Prices shown in USD")}
              {" · "}
              <button onClick={() => setCurrencyOverride(isEgypt ? "USD" : "EGP")} style={{
                background:"none", border:"none", color:LPV7_TOKENS.indigo, cursor:"pointer",
                fontSize:13, textDecoration:"underline", padding:0, fontFamily:"inherit",
              }}>
                {isEgypt
                  ? (ar ? "اعرض بالدولار" : "Show in USD")
                  : (ar ? "اعرض بالجنيه" : "Show in EGP")}
              </button>
            </div>
          </div>
        </Reveal>

        <Stagger key={`${localMode}-${billing}`} className="lp-pricing-grid" style={{ alignItems:"start" }}>
          {plans.map((p) => (
            <StaggerItem key={p.id}>
              <div className={p.popular ? "lp-lift lp-glow" : "lp-lift"} style={{
                ...card(p.popular),
                border: p.popular ? `1px solid rgba(79,124,249,.45)` : `1px solid ${LPV7_TOKENS.border}`,
                position:"relative", height:"100%", display:"flex", flexDirection:"column",
                padding:"clamp(28px,2.6vw,36px)",
                transform: p.popular ? "scale(1.035)" : "none",
              }} className={p.popular ? "lp-lift lp-popular-card" : "lp-lift"}>
                {p.popular && (
                  <div style={{
                    position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)",
                    background:LPV7_TOKENS.gBlue, color:"#fff", borderRadius:100,
                    padding:"5px 18px", fontSize:12.5, fontWeight:600, whiteSpace:"nowrap",
                    boxShadow:"0 4px 16px rgba(79,124,249,.5)",
                  }}>{ar ? "✦ الأكثر شيوعاً" : "✦ Most Popular"}</div>
                )}
                <div style={{ marginBottom:24 }}>
                  <div style={{ fontSize:13.5, color:p.color, fontWeight:600,
                    marginBottom:10, textTransform:"uppercase", letterSpacing:".06em" }}>
                    {p.name}
                  </div>
                  {p.isEnterprise ? (
                    <div>
                      <div style={{ fontSize:32, fontWeight:800, color:LPV7_TOKENS.text, fontFamily:FONT_DISPLAY }}>
                        {ar ? "تواصل معنا" : "Contact us"}
                      </div>
                      {p.priceUSD?.startingAt && (
                        <div style={{ fontSize:12.5, color:LPV7_TOKENS.muted, marginTop:6, fontFamily:FONT_MONO }}>
                          {ar ? `يبدأ من $${p.priceUSD.startingAt}/شهر` : `Starting at $${p.priceUSD.startingAt}/mo`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {isEgypt ? (
                        <>
                          <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
                            <span style={{ fontSize:40, fontWeight:800, color:LPV7_TOKENS.text, fontFamily:FONT_MONO, letterSpacing:"-.02em" }}>
                              {billing==="monthly"
                                ? (p.priceEGP.monthly ?? 0).toLocaleString()
                                : p.priceEGP.yearly
                                  ? Math.round(p.priceEGP.yearly/12).toLocaleString()
                                  : (p.priceEGP.monthly ?? 0).toLocaleString()}
                            </span>
                            <span style={{ fontSize:14.5, color:LPV7_TOKENS.muted }}>{ar ? "ج.م./شهر" : "EGP/mo"}</span>
                          </div>
                          {billing==="yearly" && p.priceEGP.yearly && (
                            <div style={{ fontSize:12.5, color:LPV7_TOKENS.muted, marginTop:6, fontFamily:FONT_MONO }}>
                              {(p.priceEGP.yearly).toLocaleString()} {ar?"سنوياً":"EGP/yr"}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ display:"flex", alignItems:"baseline", gap:6, flexWrap:"wrap" }}>
                            <span style={{ fontSize:40, fontWeight:800, color:LPV7_TOKENS.text, fontFamily:FONT_MONO, letterSpacing:"-.02em" }}>
                              ${p.priceUSD[billing] ?? p.priceUSD.monthly ?? "—"}
                            </span>
                            <span style={{ fontSize:14.5, color:LPV7_TOKENS.muted }}>/{ar ? "شهر" : "mo"}</span>
                          </div>
                          {p.priceEGP.yearly || p.priceEGP.monthly ? (
                            <div style={{ fontSize:12.5, color:LPV7_TOKENS.muted, marginTop:6, fontFamily:FONT_MONO }}>
                              ≈ {billing==="monthly" || !p.priceEGP.yearly
                                ? (p.priceEGP.monthly ?? 0).toLocaleString()
                                : Math.round(p.priceEGP.yearly/12).toLocaleString()
                              } {ar ? "ج.م./شهر" : "EGP/mo"}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <ul style={{ listStyle:"none", padding:0, margin:"0 0 28px", flex:1 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ display:"flex", gap:10, alignItems:"flex-start",
                      marginBottom:12, fontSize:14.5, color:LPV7_TOKENS.sub }}>
                      <span style={{
                        width:18, height:18, borderRadius:"50%", flexShrink:0, marginTop:1,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background:"rgba(255,255,255,.08)",
                        color:p.color, fontSize:11, fontWeight:700,
                      }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {p.isEnterprise ? (
                  <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn-outline"
                    style={{ ...btn("outline","lg"), display:"flex", width:"100%" }}>
                    {ar ? "احجز عرضاً" : "Book a Demo"}
                  </a>
                ) : (
                  <a href={`/auth?mode=signup&plan=${p.id}`} onClick={onCTA}
                    className={p.popular ? "lp-btn lp-btn-primary" : "lp-btn lp-btn-ghost"}
                    style={{ ...(p.popular ? btn("primary","lg") : btn("ghost","lg")),
                      display:"flex", width:"100%" }}>
                    {ar ? "ابدأ الآن" : "Get started"}
                  </a>
                )}
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
      <style>{`
        @media(max-width:600px){.lp-pricing-grid{grid-template-columns:1fr!important}
        .lp-pricing-grid > div > div{transform:none!important}}`}</style>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────

export default function PricingPageStandalone() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("lp_lang") || "en"; } catch { return "en"; }
  });
  const onCTA = () => window.location.href = "/auth?mode=signup";
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
      <PageShell lang={lang} setLang={setLang} activePage="pricing">
        <Pricing lang={lang} onCTA={onCTA} isEgypt={false} setCurrencyOverride={()=>{}}/>
      </PageShell>
    </>
  );
}
