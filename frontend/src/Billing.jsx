import { API_BASE_URL } from "./config/api.js";
import { SALES_WHATSAPP, SALES_WHATSAPP_DISPLAY, whatsappActivationLink,
         activationPromise, activateLabel, openWhatsapp,
         ONLINE_PAYMENT_LIVE } from "./lib/salesWhatsapp.js";
import { useState, useEffect, useCallback } from "react";

import { apiFetch, getAuthToken } from "./services/api.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";
const API = API_BASE_URL;
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || "";

// Kashier is off until VITE_KASHIER_ENABLED is explicitly "true".
//
// It used to be assumed live: the button always rendered and always fired
// /api/kashier/create-order, which returns 503 when the merchant credentials
// are not set — which they are not. So the one payment route the UI actually
// offered was a button that failed every time it was pressed. Stripe already
// had a "Coming Soon" state for exactly this situation; Kashier now has the
// same, and both are opt-in rather than opt-out.
const KASHIER_LIVE = import.meta.env.VITE_KASHIER_ENABLED === "true";
// Was a second, local definition of the same switch (!!STRIPE_KEY ||
// KASHIER_LIVE). It agreed with ONLINE_PAYMENT_LIVE by coincidence rather than
// by construction; one of them would eventually have been changed alone.
const ANY_ONLINE_PAYMENT = ONLINE_PAYMENT_LIVE;

// ── Stripe loader ─────────────────────────────────────────────────
let stripeInstance = null;
async function getStripe() {
  if (stripeInstance) return stripeInstance;
  if (!STRIPE_KEY) return null;
  if (!window.Stripe) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://js.stripe.com/v3/";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  stripeInstance = window.Stripe(STRIPE_KEY);
  return stripeInstance;
}

// ── Pricing config — B2C Egypt + Gulf ────────────────────────────
// Egypt: Kashier EGP | Gulf/Global: Stripe USD
// Amounts in CENTS
export const PLANS = {
  standard: {
    id:"standard", name:"Free", nameAr:"مجاني",
    priceEGP: { monthly: 0,     yearly: 0 },
    priceUSD: { monthly: 0,     yearly: 0 },
    stripePriceId: { monthly: "", yearly: "" },
    color:"#6366f1",
    features:   ["5 sessions/month", "Posture Score", "Demo Session", "Pain Self-Report", "First Session Badge", "Weekly Email Report"],
    featuresAr: ["5 جلسات/شهر", "درجة الوضعية", "جلسة تجريبية", "تقرير الألم الذاتي", "شارة الجلسة الأولى", "تقرير أسبوعي بالإيميل"],
    limit: -1,
  },
  basic: {
    id:"basic", name:"Basic", nameAr:"أساسي",
    priceEGP: { monthly: 199, yearly: 1590 },  // 199 EGP/mo | 1,590/yr
    priceUSD: { monthly: 9.99,   yearly: 79.99 },    // $9.99/mo  | $79.99/yr
    stripePriceId: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_BASIC_MONTHLY || "",
      yearly:  import.meta.env.VITE_STRIPE_PRICE_BASIC_YEARLY  || "",
    },
    color:"#3b82f6",
    features:   ["Unlimited sessions", "Daily Check-in", "Weekly Challenge", "Pain Prediction Card", "Streak Freeze", "Posture Habit Score", "WhatsApp Reminders", "AI Coach (10 msgs/mo)"],
    featuresAr: ["جلسات غير محدودة", "تسجيل يومي", "تحدي أسبوعي", "بطاقة توقع الألم", "تجميد الـ Streak", "درجة عادة الوضعية", "تذكيرات واتساب", "مدرب AI (10 رسائل/شهر)"],
    limit: -1,
  },
  professional: {
    id:"professional", name:"Pro", nameAr:"احترافي",
    priceEGP: { monthly: 399, yearly: 3190 },  // 399 EGP/mo | 3,190/yr
    priceUSD: { monthly: 19.99,  yearly: 159.99 },   // $19.99/mo | $159.99/yr
    stripePriceId: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY || "",
      yearly:  import.meta.env.VITE_STRIPE_PRICE_PRO_YEARLY  || "",
    },
    color:"#8b5cf6", popular:true,
    features:   ["Everything in Basic", "AI Coach (30 msgs/mo)", "Weekly Intelligence Report", "Shareable PDF Report", "Body Heatmap", "Focus Mode Integration", "Custom Alert Rules", "Family/Partner Mode (+1)"],
    featuresAr: ["كل Basic", "مدرب AI (30 رسائل/شهر)", "تقرير ذكاء أسبوعي", "تقرير PDF قابل للمشاركة", "خريطة حرارة الجسم", "تكامل وضع التركيز", "قواعد تنبيه مخصصة", "وضع الأسرة (+1)"],
    limit: -1,
  },
  elite: {
    id:"elite", name:"Elite", nameAr:"إيليت",
    priceEGP: { monthly: 699, yearly: 5590 },
    priceUSD: { monthly: 39.99,  yearly: 299.99 },
    stripePriceId: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_ELITE_MONTHLY || "",
      yearly:  import.meta.env.VITE_STRIPE_PRICE_ELITE_YEARLY  || "",
    },
    color:"#f59e0b",
    features:   ["Everything in Pro", "AI Coach (Unlimited)", "Predictive AI (detailed)", "Voice Coach (Arabic)", "Monthly Physiotherapist", "Posture DNA Report (quarterly)", "Priority WhatsApp Support", "Elite Early Access"],
    featuresAr: ["كل Pro", "مدرب AI غير محدود", "ذكاء اصطناعي تنبؤي تفصيلي", "مدرب صوتي عربي", "أخصائي علاج طبيعي شهري", "تقرير Posture DNA (ربع سنوي)", "دعم واتساب أولوية", "وصول مبكر Elite"],
    limit: -1,
  },
};

// ══════════════════════════════════════════════════════════════════
// B2B_PLANS — Companies only. IDs start with "b2b_"
// Never merge with PLANS — completely separate checkout flows.
// FLAT-RATE pricing — one price for the whole plan up to a seat cap, NOT per-seat.
// Egypt: Kashier EGP | Gulf: Stripe USD.
// ══════════════════════════════════════════════════════════════════
export const B2B_PLANS = {
  b2b_starter: {
    id:"b2b_starter", name:"Starter", nameAr:"ستارتر",
    priceEGP: { monthly: 2499, yearly: 23990 },  // 2,499 EGP/mo flat
    priceUSD: { monthly: 79,   yearly: 758 },    // $79/mo flat
    stripePriceId: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_B2B_STARTER_MONTHLY || "",
      yearly:  import.meta.env.VITE_STRIPE_PRICE_B2B_STARTER_YEARLY  || "",
    },
    color:"#6366f1", seats:30,
    features:   ["Up to 30 employees","33-landmark AI pose detection","Real-time posture score","PDF wellness reports","HR analytics dashboard","Email support"],
    featuresAr: ["حتى 30 موظف","كشف 33 نقطة بالـAI","نقاط الوضعية الآنية","تقارير PDF صحية","لوحة تحليلات HR","دعم بالبريد"],
  },
  b2b_growth: {
    id:"b2b_growth", name:"Growth", nameAr:"جروث",
    priceEGP: { monthly: 6999, yearly: 67190 },  // 6,999 EGP/mo flat
    priceUSD: { monthly: 199,  yearly: 1910 },   // $199/mo flat
    stripePriceId: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_B2B_GROWTH_MONTHLY || "",
      yearly:  import.meta.env.VITE_STRIPE_PRICE_B2B_GROWTH_YEARLY  || "",
    },
    color:"#1a56db", seats:100, popular:true,
    features:   ["Up to 100 employees","Everything in Starter","Custom alert rules","Clinical PDF reports","Advanced HR analytics","Priority support"],
    featuresAr: ["حتى 100 موظف","كل مزايا ستارتر","قواعد تنبيه مخصّصة","تقارير PDF إكلينيكية","تحليلات HR متقدمة","دعم أولوية"],
  },
  b2b_enterprise: {
    id:"b2b_enterprise", name:"Enterprise", nameAr:"إنتربرايز",
    priceEGP: { monthly: null, yearly: null },
    priceUSD: { monthly: null, yearly: null, startingAt: 499 }, // Starting at $499/mo
    stripePriceId: { monthly: "", yearly: "" }, // Always custom/contact-sales
    color:"#10b981", seats:-1,
    features:   ["Unlimited employees","Everything in Growth","AI clinical narrative","SAML SSO (set up with our team)","White-label","API access","Dedicated success manager"],
    featuresAr: ["موظفون غير محدودون","كل مزايا جروث","تحليل سردي بالذكاء الاصطناعي","SAML SSO (بإعداد من فريقنا)","White-label","وصول API","مدير نجاح مخصص"],
  },
};

// Helper: get the right plan set based on account type
export function getActivePlans(isCompany = false) {
  return isCompany ? B2B_PLANS : PLANS;
}
export const B2C_PLAN_LIST = ["standard", "basic", "professional", "elite"];
export const B2B_PLAN_LIST = ["b2b_starter", "b2b_growth", "b2b_enterprise"];

// ── Stripe Checkout ───────────────────────────────────────────────
export async function createStripeCheckout({ planId, billing, userEmail, userId, lang = "en" }) {
  if (!STRIPE_KEY) {
    throw new Error("Stripe not configured — add VITE_STRIPE_PUBLIC_KEY to .env.local");
  }
  const plan = PLANS[planId] || B2B_PLANS[planId];
  if (!plan) throw new Error("Invalid plan");
  const priceId = plan.stripePriceId[billing];
  if (!priceId) {
    // Enterprise (company tier) is contact-sales / custom-priced — doesn't go through Stripe checkout
    if (planId === "b2b_enterprise") {
      throw new Error("Enterprise plan requires a custom contract — contact us at support@corvus.io");
    }
    throw new Error(
      `Stripe price ID not configured for ${planId}/${billing}. ` +
      `Add VITE_STRIPE_PRICE_${planId.toUpperCase()}_${billing.toUpperCase()} to .env.local`
    );
  }

  const tok = await getAuthToken();
  // `tok` was fetched but never actually attached — the backend route
  // (/api/stripe/create-session) is decorated with @require_auth, which
  // returns 401 "Missing Authorization header" immediately if no Bearer
  // token is present. Every Stripe checkout attempt was 401ing before it
  // ever reached Stripe, silently breaking the entire Stripe payment path
  // (used for non-Kashier/international customers).
  const resp = await fetch(`${API}/stripe/create-session`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tok}` },
    body: JSON.stringify({
      price_id:      priceId,
      customer_email: userEmail,
      uid:            userId,
      plan_id:        planId,
      billing,
      success_url:    `${window.location.origin}?payment=success&plan=${planId}&session={CHECKOUT_SESSION_ID}`,
      cancel_url:     `${window.location.origin}?payment=cancelled`,
      locale:         lang === "ar" ? "ar" : "auto",
    }),
  });
  const data = await resp.json();
  if (!data.session_id) throw new Error(data.error || "Failed to create Stripe session");

  const stripe = await getStripe();
  const { error } = await stripe.redirectToCheckout({ sessionId: data.session_id });
  if (error) throw new Error(error.message);
}

// ── Stripe Portal (manage subscription) ──────────────────────────
export async function openStripePortal(userId) {
  const tok2 = await getAuthToken();
  // Same missing-auth-header bug as create-session above — /api/stripe/portal
  // is also @require_auth-gated, so this always 401ed before attaching the
  // token, meaning no existing Stripe subscriber could open the billing
  // portal to manage or cancel their subscription.
  const resp = await fetch(`${API}/stripe/portal`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tok2}` },
    body: JSON.stringify({ uid: userId, return_url: window.location.href }),
  });
  const data = await resp.json();
  if (data.url) window.location.href = data.url;
  else throw new Error(data.error || "Failed to open billing portal");
}

// ── BillingModal Component ────────────────────────────────────────
export function BillingModal({ profile, currentPlan, cs, lang = "en", onClose, onSuccess }) {
  useBodyScrollLock();
  const [billing,  setBilling]  = useState("monthly");
  const [loading,  setLoading]  = useState(null); // planId being processed
  const [error,    setError]    = useState("");
  const [currency, setCurrency] = useState("EGP");

  const isAr  = lang === "ar";
  const DARK  = cs || { bg: "#0d1a2e", card: "#05101f", border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b" };

  // Feature lists are tier-identical in price, but worded for who's actually buying.
  // Individuals never see employee counts, HR dashboards, or "Contact sales" —
  // a solo user has no procurement process and should be able to pay immediately.
  const INDIVIDUAL_FEATURES = {
    // B2C tier features — must match planList = ["basic","professional","elite"]
    standard: {
      en: ["5 sessions/month", "Posture score", "Basic alerts", "Streak tracking"],
      ar: ["5 جلسات/شهر", "درجة الوضعية", "تنبيهات أساسية", "تتبع السلسلة"],
    },
    basic: {
      en: ["Unlimited sessions", "AI Coach (10 msgs/mo)", "Streak & Goals", "Pain prediction", "Leaderboard"],
      ar: ["جلسات غير محدودة", "مدرب AI (10 رسائل/شهر)", "سلسلة وأهداف", "توقع الألم", "المتصدرين"],
    },
    professional: {
      en: ["Everything in Basic", "AI Insights", "Full Reports", "Session compare", "Export CSV/PDF", "Weekly report"],
      ar: ["كل Basic", "رؤى AI", "تقارير كاملة", "مقارنة الجلسات", "تصدير CSV/PDF", "تقرير أسبوعي"],
    },
    elite: {
      en: ["Everything in Pro", "AI Coach unlimited", "Predictive AI", "PDF report", "Priority support", "Calibration"],
      ar: ["كل Pro", "مدرب AI غير محدود", "AI تنبؤي", "تقرير PDF", "دعم أولوية", "معايرة"],
    },
    elite_old: {
      en: ["Everything in Growth", "AI clinical narrative", "Predictive burnout AI", "Unlimited session history", "API access", "Dedicated support"],
      ar: ["كل مزايا جروث", "تحليل سردي بالذكاء الاصطناعي", "AI تنبؤي للإرهاق", "سجل جلسات غير محدود", "وصول API", "دعم مخصص"],
    },
  };

  const T = {
    en: { title: "Choose your plan", billing: "Billing", monthly: "Monthly", yearly: "Yearly", save: "Save 20%", current: "Current plan", upgrade: "Upgrade", downgrade: "Downgrade", contact: "Contact sales", free: "Free forever", perMonth: "/mo", perYear: "/yr", stripeNote: "Secure payment via Stripe — cancel anytime", kashierNote: "Secure payment via Kashier — Egypt cards & wallets", or: "or pay with",
      errGeneric: "Something went wrong starting checkout. Please try again in a moment.",
      errStripeUnavailable: "Card payment isn't available right now — try Kashier below instead.",
      errEnterpriseContact: "Enterprise pricing is custom — please contact sales.",
      errPaymentUnavailable: "Payment isn't available right now. Please try again shortly or contact support.",
      errPortal: "Couldn't open your billing portal. Please try again in a moment.",
      soonCard: "Credit Card — Coming Soon", soonKashier: "Kashier — Coming Soon",
      waNote: "Online payment is coming soon. To start now, send us the plan you want on WhatsApp",
    },
    ar: { title: "اختر خطتك", billing: "الفوترة", monthly: "شهري", yearly: "سنوي", save: "وفر 20%", current: "خطتك الحالية", upgrade: "ترقية", downgrade: "تخفيض", contact: "تواصل مع المبيعات", free: "مجاني للأبد", perMonth: "/شهر", perYear: "/سنة", stripeNote: "دفع آمن عبر Stripe — إلغاء في أي وقت", kashierNote: "دفع آمن عبر Kashier — بطاقات ومحافظ مصرية", or: "أو ادفع بـ",
      errGeneric: "حصلت مشكلة في بدء الدفع. حاول تاني بعد لحظات.",
      errStripeUnavailable: "الدفع بالبطاقة مش متاح دلوقتي — جرب Kashier تحت.",
      errEnterpriseContact: "أسعار خطة Enterprise مخصصة — تواصل مع فريق المبيعات.",
      errPaymentUnavailable: "الدفع مش متاح دلوقتي. حاول تاني بعد شوية أو تواصل مع الدعم.",
      errPortal: "تعذر فتح صفحة الفوترة. حاول تاني بعد لحظات.",
      soonCard: "بطاقة ائتمان — قريباً", soonKashier: "Kashier — قريباً",
      waNote: "الدفع الإلكتروني قريباً. لو عايز تبدأ دلوقتي، ابعتلنا الباقة اللي عايزها على واتساب",
    },
  };
  const t = T[lang] || T.en;

  // ── Individual vs Company — drives plan grid, feature copy, Enterprise checkout ──
  // Only HR admins and org owners see B2B pricing — they're the decision-makers.
  // Regular employees (user_type=employee) and individual users with a company_id
  // still see B2C pricing: they're not the ones purchasing plans.
  const isCompanyAccount = profile?.user_type === "hr_admin"
    || !!profile?.is_org_owner
    || profile?.acct_type === "company"
    || profile?.acct_type === "hr";

  const activePlans  = isCompanyAccount ? B2B_PLANS : PLANS;
  const planList     = isCompanyAccount ? B2B_PLAN_LIST : B2C_PLAN_LIST;

  const handleStripe = useCallback(async (planId) => {
    setError(""); setLoading(planId);
    try {
      await createStripeCheckout({
        planId, billing,
        userEmail: profile?.email || "",
        userId:    profile?.uid   || "",
        lang,
      });
    } catch (e) {
      console.error("[Billing] Stripe checkout error:", e.message);
      // Fallback hint to Kashier if Stripe isn't configured; otherwise a
      // generic, friendly, bilingual message — never the raw error text.
      setError(e.message?.includes("not configured") ? t.errStripeUnavailable : t.errGeneric);
    } finally {
      setLoading(null);
    }
  }, [billing, profile, lang, t]);

  const handleKashier = useCallback(async (planId) => {
    setError(""); setLoading("ks_" + planId);
    try {
      const plan   = activePlans[planId];
      const amount = billing === "yearly" ? plan.priceEGP.yearly : plan.priceEGP.monthly;
      if (!amount) { setError(t.errEnterpriseContact); setLoading(null); return; }
      const tok3 = await getAuthToken();
      const resp = await fetch("/api/kashier/create-order", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(tok3 ? { Authorization: "Bearer " + tok3 } : {}) },
        body: JSON.stringify({
          tier:       planId,
          billing,
          uid:        profile?.uid || profile?.id || "",
          user_count: profile?.team_size_num || 1,
          billing_data: {
            email:      profile?.email || "",
            first_name: (profile?.name || "Customer").split(" ")[0],
            last_name:  (profile?.name || "").split(" ").slice(1).join(" ") || "",
          },
        }),
      });
      const data = await resp.json();
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        console.error("[Billing] Kashier create-order error:", data.error);
        setError(t.errPaymentUnavailable);
      }
    } catch (e) {
      console.error("[Billing] Kashier checkout error:", e.message);
      setError(t.errGeneric);
    } finally {
      setLoading(null);
    }
  }, [billing, profile, t]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500, backdropFilter: "blur(4px)", overflowY: "auto", padding: 20 }}>
      <div style={{ background: DARK.card, border: `0.5px solid ${DARK.border}`, borderRadius: 22, width: "min(960px,98vw)", maxHeight: "94dvh", overflowY: "auto", direction: isAr ? "rtl" : "ltr" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px 16px", borderBottom: `0.5px solid ${DARK.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: DARK.text }}>{t.title}</div>
            <div style={{ fontSize: 11, color: DARK.muted, marginTop: 2 }}>Corvus</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Currency toggle */}
            <div style={{ display: "flex", background: "rgba(148,163,184,.06)", border: `0.5px solid ${DARK.border}`, borderRadius: 8, overflow: "hidden" }}>
              {["EGP", "USD"].map(c => (
                <button key={c} onClick={() => setCurrency(c)} style={{ background: currency === c ? "#1a56db" : "none", border: "none", padding: "5px 12px", fontSize: 11, fontWeight: 600, color: currency === c ? "white" : DARK.muted, cursor: "pointer" }}>{c}</button>
              ))}
            </div>
            {/* Billing toggle */}
            <div style={{ display: "flex", background: "rgba(148,163,184,.06)", border: `0.5px solid ${DARK.border}`, borderRadius: 8, overflow: "hidden" }}>
              {/* This toggle isn't tied to any one plan, so it can't show a
                  single accurate discount badge here — the real % differs
                  per plan (B2C individual plans are ~33% off annually,
                  B2B plans ~20%, see the per-plan discountPct computed
                  below). The old static "Save 20%" badge on this button
                  was simply wrong for every B2C plan; the correct,
                  plan-specific % is shown next to each plan's own price
                  instead. */}
              {["monthly", "yearly"].map(b => (
                <button key={b} onClick={() => setBilling(b)} style={{ background: billing === b ? "#1a56db" : "none", border: "none", padding: "5px 12px", fontSize: 11, fontWeight: 600, color: billing === b ? "white" : DARK.muted, cursor: "pointer" }}>
                  {b === "monthly" ? t.monthly : t.yearly}
                </button>
              ))}
            </div>
            <button onClick={onClose} style={{ background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 11, color: DARK.muted, cursor: "pointer" }} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Plans grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, padding: 20 }}>
          {planList.map(planId => {
            const plan   = activePlans[planId];
            if (!plan) return null;  // safety guard
            const price  = currency === "USD" ? plan.priceUSD?.[billing] : plan.priceEGP?.[billing];
            const isCurr = currentPlan === planId;
            const isEnt  = planId === "b2b_enterprise";
            const isEntCustom = isEnt && (price == null || !plan.stripePriceId?.[billing]);
            // Was hardcoded `false` — the Free ("standard", price 0) plan
            // never hit the isFree branch below, so it displayed
            // "0 EGP/mo" instead of "Free forever" and its payment button
            // stayed live: clicking it for a $0 plan fell into the
            // no-price-configured branch and showed "Enterprise pricing is
            // custom — please contact sales" to someone just trying to use
            // the free tier.
            const isFree = price === 0;
            // Was a hardcoded "Save 20%" everywhere — B2C individual plans
            // are actually priced at 8x monthly (~33% off, e.g. Basic:
            // 199*12=2,388 vs 1,590 charged), while B2B plans really are
            // ~20% off. Computed from the real numbers so it can't drift
            // from the actual price, mirroring PricingPage.jsx's PlanCard.
            const monthlyPriceForDiscount = currency === "USD" ? plan.priceUSD?.monthly : plan.priceEGP?.monthly;
            const discountPct = (billing === "yearly" && price && monthlyPriceForDiscount)
              ? Math.round((1 - price / (monthlyPriceForDiscount * 12)) * 100)
              : null;
            const name   = isAr ? plan.nameAr : plan.name;
            // B2C individuals: use INDIVIDUAL_FEATURES for cleaner copy
            // B2B companies: use plan's own features
            const feats  = isCompanyAccount
              ? (isAr ? plan.featuresAr : plan.features)
              : (INDIVIDUAL_FEATURES[planId]
                  ? (isAr ? INDIVIDUAL_FEATURES[planId].ar : INDIVIDUAL_FEATURES[planId].en)
                  : (isAr ? plan.featuresAr : plan.features));
            const col    = plan.color;

            return (
              <div key={planId} style={{
                background: plan.popular ? `linear-gradient(170deg,${DARK.card},rgba(14,165,233,.05))` : "rgba(148,163,184,.03)",
                border:     `${plan.popular ? "1.5px" : "0.5px"} solid ${plan.popular ? `${col}40` : DARK.border}`,
                borderRadius: 16, padding: 20, position: "relative",
                boxShadow: plan.popular ? `0 8px 32px ${col}18` : "none",
              }}>
                {plan.popular && (
                  <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: col, color: "white", fontSize: 10, fontWeight: 700, padding: "3px 12px", borderRadius: 99, whiteSpace: "nowrap" }}>
                    {isAr ? "الأكثر شعبية" : "Most Popular"}
                  </div>
                )}
                {isCurr && (
                  <div style={{ position: "absolute", top: 10, right: isAr ? "auto" : 10, left: isAr ? 10 : "auto", background: "#10b981", color: "white", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{t.current}</div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: col, marginBottom: 6 }}>{name}</div>
                <div style={{ marginBottom: 16 }}>
                  {isFree ? (
                    <span style={{ fontSize: 22, fontWeight: 700, color: DARK.text }}>{t.free}</span>
                  ) : isEntCustom ? (
                    <div>
                      <span style={{ fontSize: 18, fontWeight: 700, color: col }}>{isAr ? "حسب الطلب" : "Custom"}</span>
                      {plan.priceUSD?.startingAt && (
                        <div style={{ fontSize: 10, color: DARK.muted, marginTop: 3 }}>
                          {isAr ? `يبدأ من $${plan.priceUSD.startingAt}/شهر` : `Starting at $${plan.priceUSD.startingAt}/mo`}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: 28, fontWeight: 800, color: DARK.text }}>{price?.toLocaleString()}</span>
                      <span style={{ fontSize: 11, color: DARK.muted }}> {currency} {billing === "monthly" ? t.perMonth : t.perYear}</span>
                      {billing === "yearly" && discountPct != null && (
                        <div style={{ fontSize: 9, color: "#10b981", marginTop: 2 }}>
                          {isAr ? `وفر ${discountPct}%` : `Save ${discountPct}%`}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
                  {feats.slice(0, 5).map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <span style={{ color: "#10b981", fontSize: 11, flexShrink: 0, marginTop: 2 }}>✓</span>
                      <span style={{ fontSize: 11, color: DARK.muted, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                  {feats.length > 5 && <div style={{ fontSize: 10, color: DARK.muted, marginTop: 2 }}>+{feats.length - 5} {isAr ? "مزيد" : "more"}</div>}
                </div>

                {/* Action buttons */}
                {isFree ? (
                  <button onClick={onClose} style={{ width: "100%", background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 9, padding: "10px 0", fontSize: 12, color: DARK.muted, cursor: "pointer" }}>
                    {isAr ? "الاستمرار مجاناً" : "Continue free"}
                  </button>
                ) : isEntCustom ? (
                  <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || "support@corvus.io"}?subject=Enterprise%20Inquiry`} style={{ display: "block", width: "100%", background: col, border: "none", borderRadius: 9, padding: "10px 0", fontSize: 12, fontWeight: 600, color: "white", cursor: "pointer", textDecoration: "none", textAlign: "center" }}>
                    {t.contact}
                  </a>
                ) : isCurr ? (
                  ONLINE_PAYMENT_LIVE ? (
                    <button onClick={() => openStripePortal(profile?.uid).catch(e => { console.error("[Billing] portal error:", e.message); setError(t.errPortal); })} style={{ width: "100%", background: "none", border: `1px solid ${col}50`, borderRadius: 9, padding: "10px 0", fontSize: 12, fontWeight: 600, color: col, cursor: "pointer" }}>
                      {isAr ? "إدارة الاشتراك" : "Manage subscription"}
                    </button>
                  ) : (
                    <button onClick={() => openWhatsapp({ kind: "manage", planName: name, billing, email: profile?.email || "", isAr })} style={{ width: "100%", background: "none", border: `1px solid ${col}50`, borderRadius: 9, padding: "10px 0", fontSize: 12, fontWeight: 600, color: col, cursor: "pointer" }}>
                      {isAr ? "إدارة الاشتراك على واتساب" : "Manage subscription on WhatsApp"}
                    </button>
                  )
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* Stripe/Kashier buttons used to only disable themselves
                        for their OWN exact loading key (planId vs "ks_"+planId)
                        — clicking Stripe didn't disable the Kashier button for
                        the same plan, so a user could fire both checkouts
                        concurrently before either redirect completed. Both
                        now disable whenever ANY checkout is in flight. */}
                    {/* Stripe button — shown as "coming soon" if not configured */}
                    {STRIPE_KEY ? (
                      <button onClick={() => handleStripe(planId)} disabled={!!loading} style={{ width: "100%", background: loading === planId ? `${col}60` : col, border: "none", borderRadius: 9, padding: "10px 0", fontSize: 12, fontWeight: 600, color: "white", cursor: loading ? "wait" : "pointer" }}>
                        {loading === planId ? "..." : `${t.upgrade} — Stripe 💳`}
                      </button>
                    ) : (
                      <button disabled style={{ width: "100%", background: "rgba(148,163,184,.06)", border: `1px dashed ${DARK.border}`, borderRadius: 9, padding: "10px 0", fontSize: 11, color: DARK.muted, cursor: "not-allowed" }}>
                        💳 {t.soonCard}
                      </button>
                    )}
                    {/* Kashier — live only when explicitly enabled */}
                    {KASHIER_LIVE ? (
                      <button onClick={() => handleKashier(planId)} disabled={!!loading} style={{ width: "100%", background: loading === ("ks_" + planId) ? "rgba(16,185,129,.3)" : "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 9, padding: "9px 0", fontSize: 11, fontWeight: 600, color: "#10b981", cursor: "pointer" }}>
                        {loading === ("ks_" + planId) ? "..." : "Kashier \uD83C\uDDEA\uD83C\uDDEC (" + (isAr ? "\u0628\u0637\u0627\u0642\u0629/\u0645\u062D\u0641\u0638\u0629" : "Card/Wallet") + ")"}
                      </button>
                    ) : (
                      <button disabled style={{ width: "100%", background: "rgba(148,163,184,.06)", border: `1px dashed ${DARK.border}`, borderRadius: 9, padding: "10px 0", fontSize: 11, color: DARK.muted, cursor: "not-allowed" }}>
                        {t.soonKashier}
                      </button>
                    )}

                    {/* The route that actually works today. Carries the plan,
                        the billing period, the price and the account email
                        into the message, so the reply can be "done" rather
                        than "which plan?". */}
                    {!ANY_ONLINE_PAYMENT && (
                      <a href={whatsappActivationLink({
                            planName: name, billing, price, currency,
                            email: profile?.email || "", isAr,
                          })}
                         target="_blank" rel="noopener noreferrer"
                         style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                           width: "100%", background: "#25D366", border: "none", borderRadius: 9,
                           padding: "11px 0", fontSize: 12, fontWeight: 700, color: "#06281a",
                           textDecoration: "none", marginTop: 2 }}>
                        <span aria-hidden="true">🟢</span>{activateLabel(isAr)}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Said once, in full, rather than repeated on every card. */}
        {!ANY_ONLINE_PAYMENT && (
          <div style={{ margin: "0 20px 16px", padding: "14px 16px", borderRadius: 12,
            background: "rgba(37,211,102,.06)", border: "1px solid rgba(37,211,102,.22)",
            fontSize: 12, color: DARK.text, lineHeight: 1.75 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.waNote}</div>
            <a href={whatsappActivationLink({ isAr })} target="_blank" rel="noopener noreferrer"
                 style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:9,
                   width:"100%", maxWidth:340, margin:"10px auto 0", boxSizing:"border-box",
                   background:"#25D366", border:"none", borderRadius:12,
                   padding:"13px 18px", fontSize:14.5, fontWeight:800, color:"#06281a",
                   textDecoration:"none", direction:"ltr", cursor:"pointer",
                   boxShadow:"0 4px 16px rgba(37,211,102,.28)", transition:"transform .18s, box-shadow .18s" }}
                 onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 22px rgba(37,211,102,.36)"; }}
                 onMouseLeave={e=>{ e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="0 4px 16px rgba(37,211,102,.28)"; }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink:0 }}><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.470 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z"/><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.22-8.24 8.22z"/></svg>
                <span>{activateLabel(isAr)}</span>
                <span style={{ opacity:.72, fontWeight:700 }}>· {SALES_WHATSAPP_DISPLAY}</span>
              </a>
            <div style={{ color: DARK.muted, marginTop: 8, textAlign: "center" }}>{activationPromise(isAr)}</div>
          </div>
        )}

        {error && (
          <div style={{ margin: "0 20px 16px", padding: "10px 14px", background: "rgba(239,68,68,.08)", border: "0.5px solid rgba(239,68,68,.2)", borderRadius: 8, fontSize: 12, color: "#ef4444" }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ padding: "12px 20px 20px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", borderTop: `0.5px solid ${DARK.border}` }}>
          <div style={{ fontSize: 10, color: DARK.muted, display: "flex", gap: 6, alignItems: "center" }}>
            🔒 {STRIPE_KEY ? t.stripeNote : KASHIER_LIVE ? t.kashierNote : activationPromise(isAr)}
          </div>
          <div style={{ fontSize: 10, color: DARK.muted }}>
            {isAr ? "الأسعار شاملة الضريبة • إلغاء في أي وقت" : "Prices include VAT • Cancel anytime"}
          </div>
        </div>
      </div>
    </div>
  );
}
