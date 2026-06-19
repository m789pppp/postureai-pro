import React from "react";

// ═══════════════════════════════════════════════════════════════════
// PricingPage.jsx — SINGLE SOURCE OF TRUTH for B2C + B2B pricing
// B2C: basic/professional/elite (199/399/699 EGP | $9.99/$19.99/$39.99)
// B2B: b2b_starter/b2b_growth/b2b_enterprise (per seat)
// Egypt: PayMob EGP | Gulf/Global: Stripe USD
// !! DO NOT change prices here without updating App.jsx TIERS and
//    Billing.jsx PLANS and backend _PAYMOB_PRICES/_STRIPE_PRICES !!
// ═══════════════════════════════════════════════════════════════════

const PAID_PLANS = [
  {
    id: "basic",
    name:    { en: "Basic",       ar: "أساسي" },
    tagline: { en: "Start your posture journey", ar: "ابدأ رحلة وضعيتك" },
    color:   "#3b82f6",
    badge:   null,
    price: {
      egp_monthly: 199,   egp_yearly: 1590,
      usd_monthly: 9.99,  usd_yearly: 79.99,
    },
    features: {
      en: ["Unlimited sessions", "AI Coach (10 msgs/mo)", "Streak & Goals",
           "Pain prediction", "Leaderboard", "Share card"],
      ar: ["جلسات غير محدودة", "مدرب AI (10 رسائل/شهر)", "سلسلة وأهداف",
           "توقع الألم", "المتصدرين", "بطاقة مشاركة"],
    },
  },
  {
    id: "professional",
    name:    { en: "Pro",          ar: "احترافي" },
    tagline: { en: "For serious posture improvement", ar: "لتحسين الوضعية بجدية" },
    color:   "#8b5cf6",
    badge:   { en: "Most Popular", ar: "الأكثر طلباً" },
    price: {
      egp_monthly: 399,   egp_yearly: 3190,
      usd_monthly: 19.99, usd_yearly: 159.99,
    },
    features: {
      en: ["Everything in Basic", "AI Insights", "Full Reports",
           "Session compare", "Export CSV/PDF", "Weekly report", "Anomaly alerts"],
      ar: ["كل Basic", "رؤى AI", "تقارير كاملة",
           "مقارنة الجلسات", "تصدير CSV/PDF", "تقرير أسبوعي", "تنبيهات الشذوذ"],
    },
  },
  {
    id: "elite",
    name:    { en: "Elite",       ar: "إيليت" },
    tagline: { en: "Maximum AI for your health", ar: "أقصى قوة AI لصحتك" },
    color:   "#f59e0b",
    badge:   { en: "Best Value",  ar: "أفضل قيمة" },
    price: {
      egp_monthly: 699,   egp_yearly: 5590,
      usd_monthly: 39.99, usd_yearly: 299.99,
    },
    features: {
      en: ["Everything in Pro", "AI Coach unlimited", "Predictive AI",
           "PDF report", "Priority support", "Calibration", "Session narrative"],
      ar: ["كل Pro", "مدرب AI غير محدود", "AI تنبؤي",
           "تقرير PDF", "دعم أولوية", "معايرة", "سرد الجلسة"],
    },
  },
];

const B2B_PAID_PLANS = [
  {
    id: "b2b_starter",
    name:    { en: "Starter",    ar: "ستارتر" },
    tagline: { en: "For small teams (5-10 seats)", ar: "للفرق الصغيرة (5-10 مقاعد)" },
    color:   "#6366f1", badge: null,
    perSeat: { egp_monthly: 249, egp_yearly: 2390, usd_monthly: 7.99, usd_yearly: 76.99 },
    features: {
      en: ["Up to 10 seats", "HR Dashboard", "Posture analytics", "Email alerts", "Basic reports"],
      ar: ["حتى 10 مقاعد", "لوحة HR", "تحليلات الوضعية", "تنبيهات بريدية", "تقارير أساسية"],
    },
  },
  {
    id: "b2b_growth",
    name:    { en: "Growth",     ar: "نمو" },
    tagline: { en: "For growing teams (11-50 seats)", ar: "للفرق النامية (11-50 مقعداً)" },
    color:   "#0ea5e9", badge: { en: "Most Popular", ar: "الأكثر طلباً" },
    perSeat: { egp_monthly: 199, egp_yearly: 1990, usd_monthly: 5.99, usd_yearly: 57.99 },
    features: {
      en: ["Up to 50 seats", "Everything in Starter", "WhatsApp alerts", "AI Coach/employee", "Weekly report", "Anomaly detection"],
      ar: ["حتى 50 مقعداً", "كل Starter", "تنبيهات واتساب", "مدرب AI لكل موظف", "تقرير أسبوعي", "كشف الشذوذ"],
    },
  },
  {
    id: "b2b_enterprise",
    name:    { en: "Enterprise", ar: "إنتربرايز" },
    tagline: { en: "For large organizations (50+ seats)", ar: "للمنظمات الكبيرة (50+ مقعداً)" },
    color:   "#10b981", badge: { en: "Custom",       ar: "مخصص" },
    perSeat: null,  // Custom pricing
    features: {
      en: ["Unlimited seats", "Everything in Growth", "SSO/SAML", "API access", "White-label", "Custom SLA", "Dedicated CSM"],
      ar: ["مقاعد غير محدودة", "كل Growth", "SSO/SAML", "وصول API", "علامة تجارية", "SLA مخصص", "مدير نجاح"],
    },
  },
];

function PlanCard({ plan, billing, region, onSelect, currentPlan, lang, cs }) {
  const isAr    = lang === "ar";
  const isEGP   = region === "egypt";
  const isCurr  = currentPlan === plan.id;
  const isPopular = !!plan.badge;

  const isB2BPlan = plan.id && plan.id.startsWith("b2b_");
  const priceObj  = isB2BPlan ? plan.perSeat : plan.price;
  const price     = priceObj
    ? (isEGP
        ? (billing==="yearly" ? priceObj.egp_yearly : priceObj.egp_monthly)
        : (billing==="yearly" ? priceObj.usd_yearly : priceObj.usd_monthly))
    : null;
  const currency  = isEGP ? "EGP" : "$";
  const perMonth  = (billing==="yearly" && price)
    ? (isEGP ? Math.round(price/12) : (price/12).toFixed(2))
    : null;

  return (
    <div style={{
      background: isPopular ? `${plan.color}08` : "rgba(255,255,255,.03)",
      border: `1.5px solid ${isPopular ? plan.color : "rgba(255,255,255,.08)"}`,
      borderRadius: 16, padding: "28px 24px", flex: 1, minWidth: 240, maxWidth: 320,
      position: "relative", transition: "transform .2s",
    }}>
      {isPopular && (
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          background: plan.color, color: "#fff", fontSize: 11, fontWeight: 700,
          padding: "3px 14px", borderRadius: 20,
        }}>
          {isAr ? plan.badge?.ar : plan.badge?.en}
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: plan.color, marginBottom: 4, letterSpacing: 1 }}>
        {isAr ? plan.name.ar : plan.name.en}
      </div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 20 }}>
        {isAr ? plan.tagline.ar : plan.tagline.en}
      </div>

      {/* Price */}
      <div style={{ marginBottom: 20 }}>
        {price == null ? (
          <div style={{ fontSize:22, fontWeight:800, color:"#f0f6ff" }}>
            {isAr ? "تواصل معنا" : "Contact Sales"}
          </div>
        ) : (
          <>
            <span style={{ fontSize: 40, fontWeight: 900, color: "#f0f6ff" }}>
              {!isEGP && "$"}{billing === "yearly" ? perMonth : price}
            </span>
            <span style={{ fontSize: 13, color: "#64748b", marginLeft: 4 }}>
              {isEGP && "EGP "}/{isB2BPlan ? (isAr?"مقعد/شهر":"seat/mo") : (isAr?"شهر":"mo")}
            </span>
            {billing === "yearly" && (
              <div style={{ fontSize: 11, color: "#10b981", marginTop: 4 }}>
                {isAr ? `${isEGP?price+" EGP":"$"+price} / سنة — وفّر 20%`
                       : `${isEGP?price+" EGP":"$"+price} / year — Save 20%`}
              </div>
            )}
          </>
        )}
      </div>

      {/* Features */}
      <div style={{ marginBottom: 24 }}>
        {(isAr ? plan.features.ar : plan.features.en).map((f, i) => (
          <div key={i} style={{ fontSize: 12, color: "#94a3b8", marginBottom: 7, display: "flex", gap: 8 }}>
            <span style={{ color: plan.color }}>✓</span> {f}
          </div>
        ))}
      </div>

      <button
        onClick={() => onSelect(plan.id)}
        disabled={isCurr}
        style={{
          width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
          background: isCurr ? "rgba(255,255,255,.06)" : plan.color,
          color: isCurr ? "#64748b" : "#fff", fontWeight: 700, fontSize: 14,
          cursor: isCurr ? "default" : "pointer",
        }}
      >
        {isCurr
          ? (isAr ? "خطتك الحالية" : "Current Plan")
          : (isAr ? "اشترك الآن" : "Get Started")}
      </button>
    </div>
  );
}

export function PricingPage({ lang = "en", darkMode, currentPlan, onSelect, onSelectPlan, cs: csProp, defaultSeg }) {
  const [billing, setBilling] = React.useState("monthly");
  const [region,  setRegion]  = React.useState("gulf");
  const [seg,     setSeg]     = React.useState(defaultSeg || "b2c");  // "b2c" | "b2b"
  const isAr   = lang === "ar";
  const isB2B  = seg === "b2b";
  const plans  = isB2B ? B2B_PAID_PLANS : PAID_PLANS;

  const D = { bg:"#020d1f", card:"#05101f", border:"rgba(148,163,184,.1)", text:"#f0f6ff", muted:"#64748b" };
  const L = { bg:"#f8fafc", card:"#ffffff", border:"rgba(0,0,0,.08)", text:"#0f172a", muted:"#64748b" };
  const cs = csProp || (darkMode ? D : L);

  const handleSelect = (planId) => {
    if (onSelectPlan) onSelectPlan(planId, billing, region);
    else if (onSelect) onSelect(planId);
  };

  return (
    <div style={{ fontFamily: "Inter,sans-serif", padding: "40px 20px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: cs.text, marginBottom: 8 }}>
          {isAr ? "اختر خطتك" : "Choose Your Plan"}
        </div>
        <div style={{ fontSize: 14, color: cs.muted }}>
          {isAr ? "بدون عقود — ألغِ في أي وقت" : "No contracts — cancel anytime"}
        </div>
      </div>

      {/* B2C / B2B toggle */}
      <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:20 }}>
        {[
          { id:"b2c", label:isAr?"👤 أفراد":"👤 Individuals" },
          { id:"b2b", label:isAr?"🏢 شركات":"🏢 Companies" },
        ].map(s=>(
          <button key={s.id} onClick={()=>setSeg(s.id)} style={{
            padding:"8px 28px", borderRadius:10,
            background: seg===s.id ? "#6366f1" : "rgba(255,255,255,.05)",
            border:`1px solid ${seg===s.id ? "#6366f1":"rgba(255,255,255,.1)"}`,
            color: seg===s.id ? "#fff" : "#64748b",
            fontWeight:700, fontSize:14, cursor:"pointer",
          }}>{s.label}</button>
        ))}
      </div>

      {/* Region toggle */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
        {[
          { id: "egypt", label: "🇪🇬 مصر", sub: "EGP / PayMob" },
          { id: "gulf",  label: "🇸🇦🇦🇪 الخليج", sub: "USD / Stripe" },
        ].map(r => (
          <button key={r.id} onClick={() => setRegion(r.id)} style={{
            padding: "8px 20px", borderRadius: 10,
            background: region === r.id ? "#6366f1" : "rgba(255,255,255,.05)",
            border: `1px solid ${region === r.id ? "#6366f1" : "rgba(255,255,255,.1)"}`,
            color: region === r.id ? "#fff" : cs.muted,
            fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            {r.label} <span style={{ fontSize: 10, opacity: .7 }}>{r.sub}</span>
          </button>
        ))}
      </div>

      {/* Billing toggle */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 40 }}>
        {["monthly", "yearly"].map(b => (
          <button key={b} onClick={() => setBilling(b)} style={{
            padding: "7px 22px", borderRadius: 20,
            background: billing === b ? "#6366f1" : "transparent",
            border: `1px solid ${billing === b ? "#6366f1" : "rgba(255,255,255,.15)"}`,
            color: billing === b ? "#fff" : cs.muted,
            fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            {b === "monthly"
              ? (isAr ? "شهري" : "Monthly")
              : (isAr ? "سنوي — وفّر 20%" : "Yearly — Save 20%")}
          </button>
        ))}
      </div>

      {/* Plan cards */}
      <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
        {plans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            billing={billing}
            region={region}
            onSelect={handleSelect}
            currentPlan={currentPlan}
            lang={lang}
            cs={cs}
          />
        ))}
      </div>

      {/* Footer note */}
      <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: cs.muted }}>
        {isAr
          ? "الأسعار بالجنيه المصري (مصر) أو الدولار الأمريكي (الخليج) — مفيش رسوم خفية"
          : "Prices in EGP (Egypt) or USD (Gulf/Global) — no hidden fees"}
      </div>
    </div>
  );
}

export default PricingPage;
