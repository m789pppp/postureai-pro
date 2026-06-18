/**
 * Corvus — PricingPage v5.0
 * Positioning: "AI Workforce Intelligence Platform"
 * Focus: ROI · productivity · workforce intelligence
 */
import { useState } from "react";
import { SUPPORT_EMAIL } from "./firebase.js";

const PLANS = [
  {
    id: "standard",
    name: { en: "Free", ar: "مجاني" },
    tagline: { en: "Get started with posture tracking", ar: "ابدأ مع تتبع الوضعية" },
    price: { monthly: 0, yearly: 0, egp_monthly: 0, egp_yearly: 0 },
    color: "#6366f1", badge: null,
    features: {
      en: ["5 sessions/month", "Posture score", "Basic alerts", "Streak tracking"],
      ar: ["5 جلسات/شهر", "درجة الوضعية", "تنبيهات أساسية", "تتبع السلسلة"],
    },
  },
  {
    id: "basic",
    name: { en: "Basic", ar: "أساسي" },
    tagline: { en: "For individuals starting their posture journey", ar: "للأفراد الذين يبدأون رحلة الوضعية" },
    price: { monthly: 999, yearly: 7999, egp_monthly: 19900, egp_yearly: 159000 },
    color: "#3b82f6", badge: null,
    features: {
      en: ["Unlimited sessions", "AI Coach (10 msgs/mo)", "Streak & Goals", "Pain prediction", "Leaderboard"],
      ar: ["جلسات غير محدودة", "مدرب AI (10 رسائل/شهر)", "سلسلة وأهداف", "توقع الألم", "المتصدرين"],
    },
  },
  {
    id: "professional",
    name: { en: "Pro", ar: "احترافي" },
    tagline: { en: "For those serious about posture improvement", ar: "لمن يريد تحسين وضعيته بجدية" },
    price: { monthly: 1999, yearly: 15999, egp_monthly: 39900, egp_yearly: 319000 },
    color: "#8b5cf6", badge: { en: "Most Popular", ar: "الأكثر طلباً" },
    features: {
      en: ["Everything in Basic", "AI Insights", "Full Reports", "Session compare", "Export CSV/PDF", "Weekly report"],
      ar: ["كل Basic", "رؤى AI", "تقارير كاملة", "مقارنة الجلسات", "تصدير CSV/PDF", "تقرير أسبوعي"],
    },
  },
  {
    id: "elite",
    name: { en: "Elite", ar: "إيليت" },
    tagline: { en: "Maximum AI power for your posture health", ar: "أقصى قوة AI لصحة وضعيتك" },
    price: { monthly: 3999, yearly: 29999, egp_monthly: 69900, egp_yearly: 559000 },
    color: "#f59e0b", badge: { en: "Best Value", ar: "أفضل قيمة" },
    features: {
      en: ["Everything in Pro", "AI Coach unlimited", "Predictive AI", "PDF reports", "Priority support", "Calibration"],
      ar: ["كل Pro", "مدرب AI غير محدود", "AI تنبؤي", "تقارير PDF", "دعم أولوية", "معايرة"],
    },
  },
];

// Individual plans use the SAME ids & prices as company plans (single source of truth —
// see TIERS in App.jsx). Only taglines/features differ to speak to a solo user vs HR buyer.
const B2C_PLANS = [
  {
    id: "standard",
    name: { en: "Starter", ar: "ستارتر" },
    tagline: { en: "For individuals getting started", ar: "للأفراد المبتدئين" },
    price: { monthly: 2499, yearly: 23990 },
    color: "#6366f1",
    badge: null,
    features: {
      en: ["Unlimited sessions", "Real-time posture score", "33-landmark detection", "PDF wellness reports", "7-day free trial", "Email support"],
      ar: ["جلسات غير محدودة", "نقاط الوضعية الآنية", "كشف 33 نقطة", "تقارير PDF صحية", "تجربة مجانية 7 أيام", "دعم بالبريد"],
    },
  },
  {
    id: "professional",
    name: { en: "Growth", ar: "جروث" },
    tagline: { en: "For serious remote professionals", ar: "للمحترفين الجادين عن بُعد" },
    price: { monthly: 6999, yearly: 67190 },
    color: "#1a56db",
    badge: { en: "Most Popular", ar: "الأكثر طلباً" },
    features: {
      en: ["Everything in Starter", "AI Posture Coach", "Fatigue index", "Burnout tracking", "478-landmark FaceMesh", "Priority support"],
      ar: ["كل مزايا ستارتر", "مدرب AI للوضعية", "مؤشر الإرهاق", "تتبع الإنهاك", "كشف 478 نقطة FaceMesh", "دعم أولوية"],
    },
  },
  {
    id: "elite",
    name: { en: "Enterprise", ar: "إنتربرايز" },
    tagline: { en: "Full intelligence stack, custom pricing", ar: "حزمة الذكاء الكاملة، سعر مخصص" },
    price: { monthly: null, yearly: null, startingUsd: 499 },
    color: "#10b981",
    badge: { en: "Custom", ar: "مخصص" },
    features: {
      en: ["Everything in Growth", "Gemini AI clinical narrative", "Predictive burnout AI", "API access", "Dedicated support"],
      ar: ["كل مزايا جروث", "تحليل سردي بالـ Gemini AI", "AI تنبؤي للإرهاق", "وصول API", "دعم مخصص"],
    },
  },
];

function PlanCard({ plan, billing, lang, cs, currentPlan, onSelect, onContact }) {
  const [hov, setHov] = useState(false);
  const isAr      = lang === "ar";
  const isCurrent = currentPlan === plan.id;
  const isEnterprise = plan.price?.monthly === null;
  const price     = isEnterprise ? null : billing === "yearly" ? plan.price?.yearly : plan.price?.monthly;
  const name      = plan.name?.[lang] || plan.name?.en;
  const tagline   = plan.tagline?.[lang] || plan.tagline?.en;
  const features  = plan.features?.[lang] || plan.features?.en || [];
  const badge     = plan.badge?.[lang] || plan.badge?.en;
  const roi       = plan.roi?.[lang] || plan.roi?.en;
  const isPopular = !!plan.badge?.en && plan.badge.en !== "Custom" && plan.badge.en !== "Enterprise";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: isPopular
          ? `linear-gradient(145deg,rgba(26,86,219,.1),rgba(8,145,178,.06))`
          : cs.card,
        border: `1.5px solid ${isCurrent ? plan.color + "70" : hov ? plan.color + "45" : cs.border}`,
        borderRadius: 18,
        padding: "26px 22px",
        position: "relative",
        display: "flex", flexDirection: "column",
        transition: "all 280ms cubic-bezier(.16,1,.3,1)",
        transform: hov ? "translateY(-4px)" : "none",
        boxShadow: hov ? "0 16px 48px rgba(0,0,0,.18)" : "none",
      }}>

      {/* Top accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${plan.color},transparent)`, borderRadius: "18px 18px 0 0" }} />

      {/* Popular badge */}
      {isPopular && (
        <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: `linear-gradient(135deg,${plan.color},#0891b2)`, borderRadius: 99, padding: "4px 16px", fontSize: 10, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
          ★ {badge}
        </div>
      )}

      {/* Name + tagline */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontFamily: "Syne,sans-serif", fontSize: 17, fontWeight: 800, color: cs.text, letterSpacing: "-0.02em" }}>{name}</span>
          {badge && !isPopular && (
            <span style={{ background: `${plan.color}15`, border: `1px solid ${plan.color}30`, borderRadius: 99, padding: "2px 9px", fontSize: 9, fontWeight: 700, color: plan.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{badge}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: cs.muted }}>{tagline}</div>
      </div>

      {/* Seats badge */}
      {plan.seats !== undefined && (
        <div style={{ background: `${plan.color}10`, border: `1px solid ${plan.color}22`, borderRadius: 7, padding: "4px 10px", fontSize: 10, fontWeight: 700, color: plan.color, marginBottom: 14, display: "inline-block" }}>
          {plan.seats < 0 ? (isAr ? "غير محدود" : "Unlimited seats") : `${isAr ? "حتى" : "Up to"} ${plan.seats} ${isAr ? "موظف" : "seats"}`}
        </div>
      )}

      {/* Price */}
      <div style={{ marginBottom: 20 }}>
        {isEnterprise ? (
          <div>
            <div style={{ fontFamily: "Syne,sans-serif", fontSize: 24, fontWeight: 800, color: cs.text }}>{isAr ? "تواصل معنا" : "Custom"}</div>
            {plan.price?.startingUsd && (
              <div style={{ fontSize: 11, color: cs.muted, marginTop: 3 }}>
                {isAr ? `يبدأ من $${plan.price.startingUsd}/شهر` : `Starting at $${plan.price.startingUsd}/mo`}
              </div>
            )}
          </div>
        ) : price === 0 ? (
          <div style={{ fontFamily: "Syne,sans-serif", fontSize: 34, fontWeight: 800, color: cs.text }}>{isAr ? "مجاني" : "Free"}</div>
        ) : (
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 12, color: cs.muted }}>EGP</span>
            <span style={{ fontFamily: "Syne,sans-serif", fontSize: 36, fontWeight: 800, color: plan.color, lineHeight: 1, letterSpacing: "-0.03em" }}>{price?.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: cs.muted }}>{billing === "yearly" ? (isAr ? "/سنة" : "/yr") : (isAr ? "/شهر" : "/mo")}</span>
          </div>
        )}
        {billing === "yearly" && !isEnterprise && price > 0 && (
          <div style={{ fontSize: 10, color: "#10b981", fontWeight: 600, marginTop: 4 }}>
            {isAr ? "✓ وفّر 20% سنوياً (شهرين مجاناً)" : "✓ Save 20% annually (2 months free)"}
          </div>
        )}
      </div>

      {/* Features */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12.5, color: cs.sub }}>
            <span style={{ fontSize: 12, color: plan.color, flexShrink: 0, marginTop: 1 }}>✓</span>
            <span style={{ lineHeight: 1.5 }}>{f}</span>
          </div>
        ))}
      </div>

      {/* ROI note */}
      {roi && (
        <div style={{ background: `${plan.color}08`, border: `1px solid ${plan.color}18`, borderRadius: 9, padding: "8px 12px", fontSize: 11, color: plan.color, fontWeight: 600, marginBottom: 16, lineHeight: 1.5 }}>
          📈 {roi}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={isEnterprise ? onContact : () => onSelect(plan.id)}
        style={{
          width: "100%",
          background: isCurrent ? `${plan.color}15` : isPopular ? `linear-gradient(135deg,${plan.color},#0891b2)` : `${plan.color}15`,
          border: `1.5px solid ${plan.color}`,
          borderRadius: 10, padding: "12px 0",
          fontSize: 13, fontWeight: 700,
          color: isPopular && !isCurrent ? "#fff" : plan.color,
          cursor: "pointer", transition: "all 200ms",
          boxShadow: isPopular && !isCurrent ? `0 6px 24px ${plan.color}40` : "none",
        }}>
        {isCurrent
          ? (isAr ? "خطتك الحالية" : "Your Current Plan")
          : isEnterprise
          ? (isAr ? "تحدّث مع المبيعات ←" : "Talk to Sales →")
          : (isAr ? "ابدأ الآن ←" : "Get Started →")}
      </button>
    </div>
  );
}

export function PricingPage({ lang = "en", darkMode, currentPlan, onSelect, onSelectPlan, onBack, cs: csProp, profile }) {
  const [billing, setBilling] = useState("monthly");
  const isAr  = lang === "ar";

  // Auto-detect segment from profile — if logged in, no need for manual toggle
  const profileIsCompany = profile?.user_type === "hr_admin"
    || profile?.user_type === "employee"
    || !!profile?.is_org_owner
    || !!profile?.company_id
    || profile?.acct_type === "company";
  const [seg, setSeg] = useState(profile ? (profileIsCompany ? "b2b" : "b2c") : "b2b");

  // App.jsx passes onSelectPlan(planId, billing) — support both prop names safely
  const handleSelect = (planId) => {
    if (onSelectPlan) onSelectPlan(planId, billing);
    else if (onSelect) onSelect(planId, billing);
  };

  const D = { bg:"#030812", surf:"#060e1c", card:"#0a1428", border:"rgba(148,163,184,.08)", borderH:"rgba(148,163,184,.2)", text:"#eef2ff", sub:"#94a3b8", muted:"#475569" };
  const L = { bg:"#f8faff", surf:"#f0f4ff", card:"#ffffff", border:"rgba(15,23,42,.07)", borderH:"rgba(15,23,42,.18)", text:"#0f172a", sub:"#334155", muted:"#64748b" };
  const cs = csProp || (darkMode ? D : L);

  const plans = seg === "b2b" ? PLANS : B2C_PLANS;

  const handleContact = () => {
    window.open(`mailto:${SUPPORT_EMAIL}?subject=Enterprise Inquiry — Corvus Workforce Intelligence`, "_blank");
  };

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ background: cs.bg, color: cs.text, minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", padding: "40px 5vw 80px" }}>

      {/* Back */}
      {onBack && (
        <button onClick={onBack} style={{ background: "none", border: "none", color: cs.muted, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 32 }}>
          {isAr ? "→" : "←"} {isAr ? "رجوع" : "Back"}
        </button>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 48px" }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#1a56db", marginBottom: 12 }}>
          {isAr ? "الأسعار" : "PRICING"}
        </div>
        <h1 style={{ fontFamily: "Syne,sans-serif", fontSize: "clamp(26px,4vw,44px)", fontWeight: 800, letterSpacing: "-0.035em", marginBottom: 14, lineHeight: 1.15 }}>
          {isAr ? "أسعار شفافة. عائد استثمار قابل للقياس." : "Transparent pricing. Measurable ROI."}
        </h1>
        <p style={{ fontSize: 15, color: cs.sub, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 20px" }}>
          {isAr
            ? "بدون عقود. بدون رسوم خفية. إلغاء في أي وقت. كل خطة تتضمن تجربة مجانية 7 أيام."
            : "No contracts. No hidden fees. Cancel anytime. Every plan includes a 7-day free trial."}
        </p>

        {/* ROI callout */}
        <div style={{ background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.18)", borderRadius: 12, padding: "12px 20px", display: "inline-block", fontSize: 12.5, color: "#10b981", fontWeight: 500, marginBottom: 28, lineHeight: 1.6 }}>
          💡 {isAr
            ? "توفر الشركات في المتوسط 12K$ – 18K$ لكل موظف سنوياً من خلال الإدارة الاستباقية لمخاطر العضلات والهيكل العظمي."
            : "Companies save an average of $12K–$18K per employee per year by proactively managing MSK risk."}
        </div>

        {/* Segment toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ background: cs.card, border: `1px solid ${cs.border}`, borderRadius: 12, padding: 4, display: "inline-flex", gap: 4 }}>
            {["b2b", "b2c"].map(s => (
              <button key={s} onClick={() => setSeg(s)} style={{
                padding: "9px 22px", borderRadius: 9, border: "none",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: seg === s ? "linear-gradient(135deg,#1a56db,#0891b2)" : "transparent",
                color: seg === s ? "#fff" : cs.muted,
                transition: "all 220ms",
              }}>
                {s === "b2b" ? (isAr ? "للمؤسسات والفرق" : "Enterprise & Teams") : (isAr ? "للأفراد" : "Individual Plans")}
              </button>
            ))}
          </div>
        </div>

        {/* Billing toggle */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: billing === "monthly" ? cs.text : cs.muted }}>{isAr ? "شهري" : "Monthly"}</span>
          <button onClick={() => setBilling(b => b === "monthly" ? "yearly" : "monthly")} style={{ width: 46, height: 26, borderRadius: 99, background: billing === "yearly" ? "#1a56db" : cs.border, border: "none", cursor: "pointer", position: "relative", transition: "background 200ms" }}>
            <span style={{ position: "absolute", top: 4, left: billing === "yearly" ? 24 : 4, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 220ms", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: billing === "yearly" ? cs.text : cs.muted }}>{isAr ? "سنوي" : "Annual"}</span>
          {billing === "yearly" && (
            <span style={{ background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.25)", borderRadius: 99, padding: "3px 11px", fontSize: 11, fontWeight: 700, color: "#10b981" }}>
              {isAr ? "وفّر 17%" : "Save 17%"}
            </span>
          )}
        </div>
      </div>

      {/* Plan grid */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(plans.length, 4)}, minmax(240px, 1fr))`, gap: 16, maxWidth: 1200, margin: "0 auto 48px" }}>
        {plans.map((plan, i) => (
          <PlanCard
            key={plan.id} plan={plan} billing={billing} lang={lang}
            cs={cs} currentPlan={currentPlan}
            onSelect={handleSelect} onContact={handleContact}
          />
        ))}
      </div>

      {/* Enterprise CTA strip */}
      <div style={{ maxWidth: 760, margin: "0 auto", background: "linear-gradient(135deg,rgba(26,86,219,.1),rgba(8,145,178,.06))", border: "1px solid rgba(26,86,219,.18)", borderRadius: 18, padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Syne,sans-serif", fontSize: 17, fontWeight: 800, color: cs.text, marginBottom: 6 }}>
            {isAr ? "مؤسسة كبيرة؟ نبني لك نموذجاً مخصصاً." : "Large organisation? We'll build a custom model for you."}
          </div>
          <div style={{ fontSize: 13, color: cs.sub, lineHeight: 1.65, maxWidth: 480 }}>
            {isAr
              ? "فرق من 500+ موظف تحصل على نماذج AI مخصصة، وتكامل HR، وتقارير ROI جاهزة للمجلس."
              : "Teams of 500+ get custom AI models, HR system integration, and board-ready ROI reports."}
          </div>
        </div>
        <button onClick={handleContact} style={{ background: "linear-gradient(135deg,#1a56db,#0891b2)", border: "none", borderRadius: 12, padding: "13px 26px", fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer", boxShadow: "0 6px 24px rgba(26,86,219,.4)", whiteSpace: "nowrap", fontFamily: "Syne,sans-serif" }}>
          {isAr ? "تحدّث مع فريق المبيعات →" : "Talk to Sales Team →"}
        </button>
      </div>
    </div>
  );
}

export default PricingPage;
