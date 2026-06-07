/**
 * PostureAI Pro — PricingPage v5.0
 * Positioning: "AI Workforce Intelligence Platform"
 * Focus: ROI · productivity · workforce intelligence
 */
import { useState } from "react";
import { SUPPORT_EMAIL } from "./firebase.js";

const PLANS = [
  {
    id: "standard",
    name: { en: "Starter", ar: "ستارتر" },
    tagline: { en: "Teams getting started with workforce health", ar: "فرق تبدأ في إدارة صحة القوى العاملة" },
    price: { monthly: 1990, yearly: 19900 },
    color: "#6366f1",
    seats: 25,
    badge: null,
    features: {
      en: [
        "25 employees",
        "Real-time AI posture intelligence",
        "HR Analytics Dashboard",
        "Department health reports",
        "Basic fatigue index",
        "PDF wellness reports",
        "Email support",
        "7-day free trial",
      ],
      ar: [
        "25 موظف",
        "ذكاء وضعي آني بالـ AI",
        "لوحة تحليلات HR",
        "تقارير صحة الأقسام",
        "مؤشر إرهاق أساسي",
        "تقارير PDF صحية",
        "دعم بالبريد",
        "تجربة مجانية 7 أيام",
      ],
    },
    roi: { en: "Avg. 18% reduction in sick days", ar: "تراجع 18% في المتوسط في أيام المرض" },
  },
  {
    id: "professional",
    name: { en: "Growth", ar: "جروث" },
    tagline: { en: "For HR teams serious about workforce ROI", ar: "لفرق HR الجادة في عائد الاستثمار" },
    price: { monthly: 4990, yearly: 49900 },
    color: "#1a56db",
    seats: 100,
    badge: { en: "Most Popular", ar: "الأكثر طلباً" },
    features: {
      en: [
        "100 employees",
        "Full AI Intelligence Layer",
        "Predictive burnout alerts",
        "Anomaly detection & risk scoring",
        "Executive PDF reports (auto-generated)",
        "Slack / Teams / WhatsApp alerts",
        "Manager insight reports",
        "Priority support + SLA",
      ],
      ar: [
        "100 موظف",
        "طبقة الذكاء الاصطناعي الكاملة",
        "تنبيهات إرهاق تنبؤية",
        "اكتشاف الشذوذات وتقييم المخاطر",
        "تقارير PDF تنفيذية (تلقائية)",
        "تنبيهات Slack / Teams / WhatsApp",
        "تقارير رؤى المدير",
        "دعم أولوية + SLA",
      ],
    },
    roi: { en: "Avg. 31% reduction in sick leave (our data)", ar: "تراجع 31% في الإجازات المرضية (بياناتنا)" },
  },
  {
    id: "elite",
    name: { en: "Business", ar: "بيزنس" },
    tagline: { en: "Enterprise-grade workforce intelligence", ar: "ذكاء قوى عاملة على مستوى المؤسسات" },
    price: { monthly: 14990, yearly: 149900 },
    color: "#10b981",
    seats: 500,
    badge: { en: "Enterprise", ar: "مؤسسات" },
    features: {
      en: [
        "500 employees",
        "Custom AI workforce models",
        "Department comparison analytics",
        "C-suite ROI dashboards",
        "API + Webhooks",
        "White-label reporting option",
        "Dedicated success manager",
        "Custom SLA guarantee",
      ],
      ar: [
        "500 موظف",
        "نماذج AI مخصصة للقوى العاملة",
        "تحليلات مقارنة الأقسام",
        "لوحات ROI للإدارة العليا",
        "API + Webhooks",
        "خيار تقارير White-label",
        "مدير نجاح مخصص",
        "ضمان SLA مخصص",
      ],
    },
    roi: { en: "Full 3–5× ROI guarantee within 6 months", ar: "ضمان 3-5 أضعاف ROI خلال 6 أشهر" },
  },
  {
    id: "enterprise",
    name: { en: "Enterprise", ar: "إنتربرايز" },
    tagline: { en: "For large organisations & global teams", ar: "للمنظمات الكبرى والفرق العالمية" },
    price: { monthly: null, yearly: null },
    color: "#f59e0b",
    seats: -1,
    badge: { en: "Custom", ar: "مخصص" },
    features: {
      en: [
        "Unlimited employees",
        "SSO / SAML / Azure AD / Okta",
        "Custom AI models & training",
        "Full white-label platform",
        "HIPAA + data residency options",
        "Dedicated implementation team",
        "Board-ready ROI reporting",
        "24/7 dedicated support",
      ],
      ar: [
        "موظفون غير محدودون",
        "SSO / SAML / Azure AD / Okta",
        "نماذج AI مخصصة وتدريب",
        "منصة White-label كاملة",
        "HIPAA + خيارات إقامة البيانات",
        "فريق تنفيذ مخصص",
        "تقارير ROI جاهزة للمجلس",
        "دعم مخصص 24/7",
      ],
    },
    roi: { en: "Fully custom ROI modelling for your org", ar: "نمذجة ROI مخصصة بالكامل لمؤسستك" },
  },
];

const B2C_PLANS = [
  {
    id: "free",
    name: { en: "Free", ar: "مجاني" },
    tagline: { en: "Get started, no commitment", ar: "ابدأ بلا التزامات" },
    price: { monthly: 0, yearly: 0 },
    color: "#6366f1",
    features: {
      en: ["5 sessions/month", "Real-time posture score", "7-day history", "Basic analytics"],
      ar: ["5 جلسات/شهر", "نقاط الوضعية الآنية", "سجل 7 أيام", "تحليلات أساسية"],
    },
  },
  {
    id: "professional",
    name: { en: "Professional", ar: "بروفيشنال" },
    tagline: { en: "For serious remote workers", ar: "للعاملين عن بُعد بجدية" },
    price: { monthly: 499, yearly: 4990 },
    color: "#1a56db",
    badge: { en: "Most Popular", ar: "الأكثر طلباً" },
    features: {
      en: ["Unlimited sessions", "AI Posture Coach (Claude)", "Fatigue index", "Burnout tracking", "PDF wellness reports", "Priority support"],
      ar: ["جلسات غير محدودة", "مدرب AI للوضعية (Claude)", "مؤشر الإرهاق", "تتبع الإنهاك", "تقارير PDF صحية", "دعم أولوية"],
    },
  },
  {
    id: "elite",
    name: { en: "Elite", ar: "إيليت" },
    tagline: { en: "Full intelligence stack", ar: "حزمة الذكاء الكاملة" },
    price: { monthly: 999, yearly: 9990 },
    color: "#10b981",
    features: {
      en: ["Everything in Professional", "Predictive burnout AI", "7-day performance forecast", "AI executive summaries", "API access"],
      ar: ["كل مزايا Professional", "AI تنبؤي للإرهاق", "توقع أداء 7 أيام", "ملخصات تنفيذية بالـ AI", "وصول API"],
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
          <div style={{ fontFamily: "Syne,sans-serif", fontSize: 24, fontWeight: 800, color: cs.text }}>{isAr ? "تواصل معنا" : "Custom"}</div>
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
            {isAr ? "✓ وفّر 17% سنوياً" : "✓ Save 17% annually"}
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

export function PricingPage({ lang = "en", darkMode, currentPlan, onSelect, onBack, cs: csProp }) {
  const [billing, setBilling] = useState("monthly");
  const [seg, setSeg]         = useState("b2b");
  const isAr  = lang === "ar";

  const D = { bg:"#030812", surf:"#060e1c", card:"#0a1428", border:"rgba(148,163,184,.08)", borderH:"rgba(148,163,184,.2)", text:"#eef2ff", sub:"#94a3b8", muted:"#475569" };
  const L = { bg:"#f8faff", surf:"#f0f4ff", card:"#ffffff", border:"rgba(15,23,42,.07)", borderH:"rgba(15,23,42,.18)", text:"#0f172a", sub:"#334155", muted:"#64748b" };
  const cs = csProp || (darkMode ? D : L);

  const plans = seg === "b2b" ? PLANS : B2C_PLANS;

  const handleContact = () => {
    window.open(`mailto:${SUPPORT_EMAIL}?subject=Enterprise Inquiry — PostureAI Workforce Intelligence`, "_blank");
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
            onSelect={onSelect} onContact={handleContact}
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
