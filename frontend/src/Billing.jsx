import { useState, useEffect, useCallback } from "react";

import { apiFetch, getAuthToken } from "./services/api.js";
const API = import.meta.env.VITE_API_URL || "http://localhost:5050/api";
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || "";

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

// ── Pricing config — MUST match TIERS in App.jsx exactly (single source of truth) ──
export const PLANS = {
  standard: {
    id:          "standard",
    name:        "Starter",
    nameAr:      "ستارتر",
    priceEGP:    { monthly: 2499, yearly: 23990 },
    priceUSD:    { monthly: 79,   yearly: 758 },
    stripePriceId: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_STANDARD_MONTHLY || "",
      yearly:  import.meta.env.VITE_STRIPE_PRICE_STANDARD_YEARLY  || "",
    },
    color:       "#6366f1",
    features:    ["33-landmark pose detection", "Head tilt & neck lean", "IPD screen distance", "PDF reports", "30 employees", "HR dashboard", "Email support"],
    featuresAr:  ["كشف 33 نقطة بالـAI", "ميل الرأس والرقبة", "مسافة الشاشة IPD", "تقارير PDF", "30 موظف", "لوحة تحكم HR", "دعم بالبريد"],
    limit:       -1,
  },
  professional: {
    id:          "professional",
    name:        "Growth",
    nameAr:      "جروث",
    priceEGP:    { monthly: 6999, yearly: 67190 },
    priceUSD:    { monthly: 199,  yearly: 1910 },
    stripePriceId: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY || "",
      yearly:  import.meta.env.VITE_STRIPE_PRICE_PRO_YEARLY  || "",
    },
    color:       "#0ea5e9",
    popular:     true,
    features:    ["Everything in Starter", "FaceMesh 478 landmarks", "3D solvePnP head pose", "Iris IPD precision", "Spine + shoulder analysis", "Advanced HR analytics", "Clinical PDF + 3D", "100 employees", "Priority support"],
    featuresAr:  ["كل مزايا ستارتر", "كشف 478 نقطة FaceMesh", "وضع رأس 3D solvePnP", "دقة IPD بالقزحية", "تحليل العمود الفقري والكتف", "تحليلات HR متقدمة", "تقرير PDF سريري + 3D", "100 موظف", "دعم أولوية"],
    limit:       -1,
  },
  elite: {
    id:          "elite",
    name:        "Enterprise",
    nameAr:      "إنتربرايز",
    priceEGP:    { monthly: null, yearly: null },
    priceUSD:    { monthly: null, yearly: null, startingAt: 499 },
    stripePriceId: {
      monthly: import.meta.env.VITE_STRIPE_PRICE_ELITE_MONTHLY || "",
      yearly:  import.meta.env.VITE_STRIPE_PRICE_ELITE_YEARLY  || "",
    },
    color:       "#10b981",
    features:    ["Everything in Growth", "Gemini AI clinical narrative", "Unlimited employees", "White-label branding", "Custom SLA", "API access", "SSO/SAML", "Dedicated success manager"],
    featuresAr:  ["كل مزايا جروث", "تحليل سردي بالـ Gemini AI", "موظفون غير محدودون", "علامة تجارية White-label", "ضمان SLA مخصص", "وصول API", "SSO/SAML", "مدير نجاح مخصص"],
    limit:       -1,
  },
};

// ── Stripe Checkout ───────────────────────────────────────────────
export async function createStripeCheckout({ planId, billing, userEmail, userId, lang = "en" }) {
  if (!STRIPE_KEY) {
    throw new Error("Stripe not configured — add VITE_STRIPE_PUBLIC_KEY to .env.local");
  }
  const plan = PLANS[planId];
  if (!plan) throw new Error("Invalid plan");
  const priceId = plan.stripePriceId[billing];
  if (!priceId) {
    // Elite (Enterprise) is contact-sales / custom-priced — doesn't go through Stripe checkout
    if (planId === "elite") {
      throw new Error("Enterprise plan requires a custom contract — contact sales@corvus.io");
    }
    throw new Error(
      `Stripe price ID not configured for ${planId}/${billing}. ` +
      `Add VITE_STRIPE_PRICE_${planId.toUpperCase()}_${billing.toUpperCase()} to .env.local`
    );
  }

  const tok = await getAuthToken();
  const resp = await fetch(`${API}/stripe/create-session`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
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
  const resp = await fetch(`${API}/stripe/portal`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: userId, return_url: window.location.href }),
  });
  const data = await resp.json();
  if (data.url) window.location.href = data.url;
  else throw new Error(data.error || "Failed to open billing portal");
}

// ── BillingModal Component ────────────────────────────────────────
export function BillingModal({ profile, currentPlan, cs, lang = "en", onClose, onSuccess }) {
  const [billing,  setBilling]  = useState("monthly");
  const [loading,  setLoading]  = useState(null); // planId being processed
  const [error,    setError]    = useState("");
  const [currency, setCurrency] = useState("EGP");

  const isAr  = lang === "ar";
  const DARK  = cs || { bg: "#030b14", card: "#05101f", border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b" };

  const T = {
    en: { title: "Choose your plan", billing: "Billing", monthly: "Monthly", yearly: "Yearly", save: "Save 20%", current: "Current plan", upgrade: "Upgrade", downgrade: "Downgrade", contact: "Contact sales", free: "Free forever", perMonth: "/mo", perYear: "/yr", stripeNote: "Secure payment via Stripe — cancel anytime", paymobNote: "Secure payment via PayMob — Egypt cards & wallets", or: "or pay with" },
    ar: { title: "اختر خطتك", billing: "الفوترة", monthly: "شهري", yearly: "سنوي", save: "وفر 20%", current: "خطتك الحالية", upgrade: "ترقية", downgrade: "تخفيض", contact: "تواصل مع المبيعات", free: "مجاني للأبد", perMonth: "/شهر", perYear: "/سنة", stripeNote: "دفع آمن عبر Stripe — إلغاء في أي وقت", paymobNote: "دفع آمن عبر PayMob — بطاقات ومحافظ مصرية", or: "أو ادفع بـ" },
  };
  const t = T[lang] || T.en;

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
      setError(e.message);
      // Fallback to PayMob if Stripe not configured
      if (e.message.includes("not configured")) {
        setError("Stripe not set up — use PayMob below ↓");
      }
    } finally {
      setLoading(null);
    }
  }, [billing, profile, lang]);

  const handlePayMob = useCallback(async (planId) => {
    setError(""); setLoading(`pm_${planId}`);
    try {
      const plan   = PLANS[planId];
      const amount = billing === "yearly" ? plan.priceEGP.yearly : plan.priceEGP.monthly;
      if (!amount) { setError("Contact sales for Enterprise pricing"); setLoading(null); return; }
      const tok3 = await getAuthToken();
      const resp = await fetch(`${API}/paymob/create-payment`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(tok3 ? { Authorization: `Bearer ${tok3}` } : {}) },
        body: JSON.stringify({
          amount_cents:  amount * 100,
          currency:      "EGP",
          tier:          planId,
          billing,
          payment_type:  "card",
          billing_data:  {
            email:      profile?.email || "",
            first_name: profile?.name?.split(" ")[0] || "Customer",
            last_name:  profile?.name?.split(" ").slice(1).join(" ") || "",
          },
        }),
      });
      const data = await resp.json();
      if (data.payment_key) {
        const iframeId = import.meta.env.VITE_PAYMOB_IFRAME_ID;
        if (iframeId) window.location.href = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${data.payment_key}`;
        else setError("PayMob iframe ID not configured");
      } else {
        setError(data.error || "PayMob error");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }, [billing, profile]);

  const planList = ["standard", "professional", "elite"];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9500, backdropFilter: "blur(12px)", overflowY: "auto", padding: 20 }}>
      <div style={{ background: DARK.card, border: `0.5px solid ${DARK.border}`, borderRadius: 22, width: "min(960px,98vw)", maxHeight: "94vh", overflowY: "auto", direction: isAr ? "rtl" : "ltr" }}>

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
              {["monthly", "yearly"].map(b => (
                <button key={b} onClick={() => setBilling(b)} style={{ background: billing === b ? "#1a56db" : "none", border: "none", padding: "5px 12px", fontSize: 11, fontWeight: 600, color: billing === b ? "white" : DARK.muted, cursor: "pointer" }}>
                  {b === "monthly" ? t.monthly : `${t.yearly} 🏷 ${t.save}`}
                </button>
              ))}
            </div>
            <button onClick={onClose} style={{ background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 11, color: DARK.muted, cursor: "pointer" }}>✕</button>
          </div>
        </div>

        {/* Plans grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, padding: 20 }}>
          {planList.map(planId => {
            const plan   = PLANS[planId];
            const price  = currency === "USD" ? plan.priceUSD[billing] : plan.priceEGP[billing];
            const isCurr = currentPlan === planId;
            const isEnt  = planId === "elite"; // Elite tier = Enterprise, custom pricing
            const isFree = false; // No free tier — Starter is the entry-level paid plan
            const name   = isAr ? plan.nameAr : plan.name;
            const feats  = isAr ? plan.featuresAr : plan.features;
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
                  ) : isEnt ? (
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
                      {billing === "yearly" && <div style={{ fontSize: 9, color: "#10b981", marginTop: 2 }}>{t.save}</div>}
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
                ) : isEnt ? (
                  <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL || "sales@corvus.io"}?subject=Enterprise%20Inquiry`} style={{ display: "block", width: "100%", background: col, border: "none", borderRadius: 9, padding: "10px 0", fontSize: 12, fontWeight: 600, color: "white", cursor: "pointer", textDecoration: "none", textAlign: "center" }}>
                    {t.contact}
                  </a>
                ) : isCurr ? (
                  <button onClick={() => openStripePortal(profile?.uid).catch(e => setError(e.message))} style={{ width: "100%", background: "none", border: `1px solid ${col}50`, borderRadius: 9, padding: "10px 0", fontSize: 12, fontWeight: 600, color: col, cursor: "pointer" }}>
                    {isAr ? "إدارة الاشتراك" : "Manage subscription"}
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* Stripe button */}
                    {STRIPE_KEY && (
                      <button onClick={() => handleStripe(planId)} disabled={loading === planId} style={{ width: "100%", background: loading === planId ? `${col}60` : col, border: "none", borderRadius: 9, padding: "10px 0", fontSize: 12, fontWeight: 600, color: "white", cursor: loading === planId ? "wait" : "pointer" }}>
                        {loading === planId ? "..." : `${t.upgrade} — Stripe 💳`}
                      </button>
                    )}
                    {/* PayMob button */}
                    <button onClick={() => handlePayMob(planId)} disabled={loading === `pm_${planId}`} style={{ width: "100%", background: loading === `pm_${planId}` ? "rgba(16,185,129,.3)" : "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.3)", borderRadius: 9, padding: "9px 0", fontSize: 11, fontWeight: 600, color: "#10b981", cursor: "pointer" }}>
                      {loading === `pm_${planId}` ? "..." : `PayMob 🇪🇬 (${isAr ? "بطاقة/محفظة" : "Card/Wallet"})`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{ margin: "0 20px 16px", padding: "10px 14px", background: "rgba(239,68,68,.08)", border: "0.5px solid rgba(239,68,68,.2)", borderRadius: 8, fontSize: 12, color: "#ef4444" }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ padding: "12px 20px 20px", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", borderTop: `0.5px solid ${DARK.border}` }}>
          <div style={{ fontSize: 10, color: DARK.muted, display: "flex", gap: 6, alignItems: "center" }}>
            🔒 {STRIPE_KEY ? t.stripeNote : t.paymobNote}
          </div>
          <div style={{ fontSize: 10, color: DARK.muted }}>
            {isAr ? "الأسعار شاملة الضريبة • إلغاء في أي وقت" : "Prices include VAT • Cancel anytime"}
          </div>
        </div>
      </div>
    </div>
  );
}
