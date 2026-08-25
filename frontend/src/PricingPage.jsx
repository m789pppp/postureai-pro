import React, { useState } from "react";

// ═══════════════════════════════════════════════════════════════════
// PricingPage.jsx — SINGLE SOURCE OF TRUTH for B2C + B2B pricing
// B2C: basic/professional/elite (199/399/699 EGP | $9.99/$19.99/$39.99)
// B2B: b2b_starter/b2b_growth/b2b_enterprise — FLAT-RATE platform fee
//      (2,499/6,999 EGP | $79/$199), NOT per-seat. Enterprise = Custom from $499/mo.
// Egypt: Kashier EGP | Gulf/Global: Stripe USD
// !! DO NOT change prices here without updating App.jsx TIERS/B2B_TIERS and
//    Billing.jsx PLANS/B2B_PLANS and backend _KASHIER_PRICES/_STRIPE_PRICES !!
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
      en: ["Unlimited sessions", "Daily Check-in", "Weekly Challenge",
           "Pain Prediction Card", "Streak Freeze", "Posture Habit Score",
           "WhatsApp Reminders", "AI Coach (10 msgs/mo)"],
      ar: ["جلسات غير محدودة", "تسجيل يومي", "تحدي أسبوعي",
           "بطاقة توقع الألم", "تجميد الـ Streak", "درجة عادة الوضعية",
           "تذكيرات واتساب", "مدرب AI (10 رسائل/شهر)"],
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
      en: ["Everything in Basic", "AI Coach (30 msgs/mo)", "Weekly Intelligence Report",
           "Shareable PDF Report", "Body Heatmap", "Focus Mode Integration",
           "Custom Alert Rules", "Family/Partner Mode (+1)"],
      ar: ["كل Basic", "مدرب AI (30 رسائل/شهر)", "تقرير ذكاء أسبوعي",
           "تقرير PDF قابل للمشاركة", "خريطة حرارة الجسم", "تكامل وضع التركيز",
           "قواعد تنبيه مخصصة", "وضع الأسرة (+1)"],
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
      en: ["Everything in Pro", "AI Coach (Unlimited)", "Predictive AI (detailed)",
           "Voice Coach (Arabic)", "Monthly Physiotherapist",
           "Posture DNA Report (quarterly)", "Priority WhatsApp Support", "Elite Early Access"],
      ar: ["كل Pro", "مدرب AI غير محدود", "ذكاء اصطناعي تنبؤي تفصيلي",
           "مدرب صوتي عربي", "أخصائي علاج طبيعي شهري",
           "تقرير Posture DNA (ربع سنوي)", "دعم واتساب أولوية", "وصول مبكر Elite"],
    },
  },
];

const B2B_PAID_PLANS = [
  {
    id: "b2b_starter",
    name:    { en: "Starter",    ar: "ستارتر" },
    tagline: { en: "For small teams getting started", ar: "للفرق الصغيرة في البداية" },
    color:   "#6366f1", badge: null,
    price: { egp_monthly: 2499, egp_yearly: 23990, usd_monthly: 79, usd_yearly: 758 },
    features: {
      en: ["Up to 30 employees", "33-landmark AI pose detection", "Real-time posture score", "PDF wellness reports", "HR analytics dashboard", "Email support"],
      ar: ["حتى 30 موظف", "كشف 33 نقطة بالـAI", "نقاط الوضعية الآنية", "تقارير PDF صحية", "لوحة تحليلات HR", "دعم بالبريد"],
    },
  },
  {
    id: "b2b_growth",
    name:    { en: "Growth",     ar: "جروث" },
    tagline: { en: "For growing teams that need deeper insight", ar: "للفرق المتنامية التي تحتاج رؤى أعمق" },
    color:   "#1a56db", badge: { en: "Most Popular", ar: "الأكثر طلباً" },
    price: { egp_monthly: 6999, egp_yearly: 67190, usd_monthly: 199, usd_yearly: 1910 },
    features: {
      en: ["Up to 100 employees", "Everything in Starter", "FaceMesh 478 landmarks", "3D solvePnP head pose", "Advanced HR analytics", "Priority support"],
      ar: ["حتى 100 موظف", "كل مزايا ستارتر", "كشف 478 نقطة FaceMesh", "وضع رأس 3D solvePnP", "تحليلات HR متقدمة", "دعم أولوية"],
    },
  },
  {
    id: "b2b_enterprise",
    name:    { en: "Enterprise", ar: "إنتربرايز" },
    tagline: { en: "For large organisations & global teams", ar: "للمنظمات الكبرى والفرق العالمية" },
    color:   "#10b981", badge: { en: "Custom",       ar: "مخصص" },
    price: null, startingAtUsd: 499,  // Custom pricing — starting at $499/mo
    features: {
      en: ["Unlimited employees", "Everything in Growth", "AI clinical narrative", "SSO/SAML/Azure AD/Okta", "White-label branding", "API access", "Dedicated success manager"],
      ar: ["موظفون غير محدودون", "كل مزايا جروث", "تحليل سردي بالذكاء الاصطناعي", "SSO/SAML/Azure AD/Okta", "علامة تجارية White-label", "وصول API", "مدير نجاح مخصص"],
    },
  },
];

function PlanCard({ plan, billing, region, onSelect, currentPlan, highlighted, lang, cs }) {
  const isAr    = lang === "ar";
  const isEGP   = region === "egypt";
  const isCurr  = currentPlan === plan.id;
  const isPopular = !!plan.badge;

  const price     = plan.price
    ? (isEGP
        ? (billing==="yearly" ? plan.price.egp_yearly : plan.price.egp_monthly)
        : (billing==="yearly" ? plan.price.usd_yearly : plan.price.usd_monthly))
    : null;
  const currency  = isEGP ? "EGP" : "$";
  const perMonth  = (billing==="yearly" && price)
    ? (isEGP ? Math.round(price/12) : (price/12).toFixed(2))
    : null;
  // Was a hardcoded "Save 20%" — B2C plans are actually priced at 8x
  // monthly (~33% off, e.g. Basic: 199*12=2,388 vs 1,590 charged), while
  // B2B plans really are ~20% off. Computing it from the real numbers
  // means the label is correct for both and can't drift from the price.
  const monthlyPrice = plan.price
    ? (isEGP ? plan.price.egp_monthly : plan.price.usd_monthly)
    : null;
  const discountPct = (billing==="yearly" && price && monthlyPrice)
    ? Math.round((1 - price/(monthlyPrice*12)) * 100)
    : null;

  return (
    <div style={{
      background: isPopular ? `${plan.color}08` : "rgba(255,255,255,.03)",
      // A deep-linked plan (?plan=... in the URL) gets its own ring instead
      // of piggybacking on isPopular's border color — a link to a
      // non-"popular" plan (e.g. Elite) used to land on a page where nothing
      // visually distinguished which plan the visitor actually clicked.
      border: highlighted ? `2px solid ${plan.color}` : `1.5px solid ${isPopular ? plan.color : "rgba(255,255,255,.08)"}`,
      boxShadow: highlighted ? `0 0 0 4px ${plan.color}22` : "none",
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
      <div style={{ fontSize: 11, color: cs.muted, marginBottom: 20 }}>
        {isAr ? plan.tagline.ar : plan.tagline.en}
      </div>

      {/* Price */}
      <div style={{ marginBottom: 20 }}>
        {price == null ? (
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:cs.text }}>
              {isAr ? "تواصل معنا" : "Contact Sales"}
            </div>
            {plan.startingAtUsd && (
              <div style={{ fontSize: 11, color: cs.muted, marginTop: 4 }}>
                {isAr ? `يبدأ من $${plan.startingAtUsd}/شهر` : `Starting at $${plan.startingAtUsd}/mo`}
              </div>
            )}
          </div>
        ) : (
          <>
            <span style={{ fontSize: 40, fontWeight: 900, color: cs.text }}>
              {!isEGP && "$"}{billing === "yearly" ? perMonth : price}
            </span>
            <span style={{ fontSize: 13, color: cs.muted, marginLeft: isAr?0:4, marginRight: isAr?4:0 }}>
              {isEGP && "EGP "}/{isAr?"شهر":"mo"}
            </span>
            {billing === "yearly" && discountPct != null && (
              <div style={{ fontSize: 11, color: "#10b981", marginTop: 4 }}>
                {isAr ? `${isEGP?price+" EGP":"$"+price} / سنة — وفّر ${discountPct}%`
                       : `${isEGP?price+" EGP":"$"+price} / year — Save ${discountPct}%`}
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
          background: isCurr ? cs.border : plan.color,
          color: isCurr ? cs.muted : "#fff", fontWeight: 700, fontSize: 14,
          cursor: isCurr ? "default" : "pointer",
        }}
      >
        {isCurr
          ? (isAr ? "خطتك الحالية" : "Current Plan")
          : price == null
          ? (isAr ? "تواصل مع المبيعات" : "Contact Sales")
          : (isAr ? "اشترك الآن" : "Get Started")}
      </button>
    </div>
  );
}

export function PricingPage({ lang = "en", darkMode, currentPlan, onSelect, onSelectPlan, cs: csProp, defaultSeg, defaultBilling, highlightPlanId }) {
  // defaultBilling/highlightPlanId let a caller pre-select the billing cycle
  // and visually point at a specific plan when the visitor arrived via a
  // ?plan=&billing= deep link (App.jsx passes these from deepPlan/
  // deepBilling) — previously ignored, so a link like
  // "/auth?mode=signup&plan=elite&billing=yearly" always landed on this
  // page's hardcoded monthly/B2C default regardless of what was clicked.
  const [billing, setBilling] = useState(defaultBilling || "monthly");
  const [region,  setRegion]  = useState("gulf");
  const [seg,     setSeg]     = useState(defaultSeg || "b2c");  // "b2c" | "b2b"
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

  // Same "hardcoded 20%" bug as PlanCard above, at the toggle-button level —
  // B2C is really ~33% off, B2B really is ~20% off. Derived from the first
  // priced plan in whichever segment is active.
  const _refPlan = plans.find(p => p.price);
  const segDiscountPct = _refPlan
    ? Math.round((1 - _refPlan.price.usd_yearly/(_refPlan.price.usd_monthly*12)) * 100)
    : 20;

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
          { id: "egypt", label: "🇪🇬 مصر", sub: "EGP / Kashier" },
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
              : (isAr ? `سنوي — وفّر ${segDiscountPct}%` : `Yearly — Save ${segDiscountPct}%`)}
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
            highlighted={highlightPlanId === plan.id}
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
