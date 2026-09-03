/**
 * The manual activation route, in one place.
 *
 * Online checkout is off until a provider is explicitly enabled, so the way
 * someone actually buys today is a WhatsApp message. That message has to
 * carry which plan they want — otherwise every sale opens with a round trip
 * asking, which is exactly the friction this is meant to avoid.
 *
 * This lived as three copies of the same constants and helper in Billing.jsx,
 * PricingPage.jsx and PricingPageLP.jsx. Three copies of a phone number and a
 * commitment ("within 30 minutes") is three chances for one of them to be
 * changed and the others not, on a page that promises something a human then
 * has to honour by hand.
 */

/** True when a real checkout provider is switched on; hides the manual route. */
export const ONLINE_PAYMENT_LIVE =
  !!import.meta.env.VITE_STRIPE_PUBLIC_KEY ||
  import.meta.env.VITE_KASHIER_ENABLED === "true";

/** Digits only — wa.me rejects "+" and spaces. */
export const SALES_WHATSAPP =
  (import.meta.env.VITE_SALES_WHATSAPP || "201210271841").replace(/\D/g, "");

/** How the number is printed for a human to read. */
export const SALES_WHATSAPP_DISPLAY =
  import.meta.env.VITE_SALES_WHATSAPP_DISPLAY || "01210271841";

/**
 * A wa.me link, optionally carrying the plan the person picked.
 *
 * Called with no plan (the general "talk to us" button) it still opens a
 * ready-to-send message, so the person is never staring at an empty
 * conversation wondering what to type.
 */
export function whatsappActivationLink({
  planName = "", billing = "", price = null, currency = "EGP", email = "", isAr = false,
} = {}) {
  const period = billing === "yearly" ? (isAr ? "سنوي" : "yearly")
               : billing === "monthly" ? (isAr ? "شهري" : "monthly")
               : "";
  const amount = price != null ? `${price.toLocaleString()} ${currency}` : "";

  const lines = isAr
    ? [
        "السلام عليكم، عايز أفعّل اشتراك Corvus.",
        planName ? `الباقة: ${planName}` : "",
        period ? `الاشتراك: ${period}${amount ? ` — ${amount}` : ""}` : "",
        email ? `بريد الحساب: ${email}` : "",
      ]
    : [
        "Hi, I'd like to activate a Corvus subscription.",
        planName ? `Plan: ${planName}` : "",
        period ? `Billing: ${period}${amount ? ` — ${amount}` : ""}` : "",
        email ? `Account email: ${email}` : "",
      ];

  return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(lines.filter(Boolean).join("\n"))}`;
}

/** "Activated within 30 minutes of your message." */
export const activationPromise = (isAr) =>
  isAr ? "التفعيل خلال 30 دقيقة من إرسال الرسالة."
       : "Activated within 30 minutes of your message.";

/** Label for the button itself. */
export const activateLabel = (isAr) => (isAr ? "فعّل عبر واتساب" : "Activate on WhatsApp");

/**
 * The same route, for the things that are not a plan purchase.
 *
 * Every payment surface in the app should end here while ONLINE_PAYMENT_LIVE is
 * false, and several did not: "Change Plan" posted to an endpoint that wrote a
 * pending payment row and returned a toast (no money, no follow-up, nothing
 * happened next); "Manage subscription" opened a Stripe portal that 503s
 * without a key; the certificate purchase called Kashier directly with a body
 * that endpoint rejects; and the therapist booking had its own hardcoded
 * `BOOKING_LIVE = false` instead of the shared switch. Each was a dead end
 * wearing a working button, on the paths where someone was trying to give the
 * business money.
 *
 * `kind` picks the opening line so the person on the other end knows what the
 * message is about without asking.
 */
export function whatsappRequestLink({
  kind = "general", detail = "", planName = "", billing = "", price = null,
  currency = "EGP", email = "", isAr = false,
} = {}) {
  const OPENERS = {
    general:     [ "Hi, I'd like to activate a Corvus subscription.", "السلام عليكم، عايز أفعّل اشتراك Corvus." ],
    change_plan: [ "Hi, I'd like to change my Corvus plan.",          "السلام عليكم، عايز أغيّر باقة Corvus بتاعتي." ],
    manage:      [ "Hi, I'd like to manage my Corvus subscription.",  "السلام عليكم، عايز أدير اشتراك Corvus بتاعي." ],
    renew:       [ "Hi, I'd like to renew my Corvus subscription.",   "السلام عليكم، عايز أجدّد اشتراك Corvus." ],
    certificate: [ "Hi, I'd like to order my Corvus posture certificate.", "السلام عليكم، عايز أطلب شهادة الوضعية من Corvus." ],
    booking:     [ "Hi, I'd like to book a physiotherapy session.",   "السلام عليكم، عايز أحجز جلسة علاج طبيعي." ],
    b2b:         [ "Hi, I'd like to talk about a Corvus team plan.",  "السلام عليكم، عايز أتكلم عن باقة فرق العمل في Corvus." ],
    api:         [ "Hi, I'd like to subscribe to the Corvus API.",    "السلام عليكم، عايز أشترك في Corvus API." ],
  };
  const opener = (OPENERS[kind] || OPENERS.general)[isAr ? 1 : 0];
  const period = billing === "yearly"  ? (isAr ? "سنوي" : "yearly")
               : billing === "monthly" ? (isAr ? "شهري" : "monthly")
               : "";
  const _p = (price === null || price === undefined || price === "") ? NaN
           : typeof price === "number" ? price : Number(price);
  const amount = Number.isFinite(_p) ? `${_p.toLocaleString()} ${currency}`
               : (typeof price === "string" && price.trim()) ? price.trim() : "";

  const lines = [
    opener,
    planName ? (isAr ? `الباقة: ${planName}` : `Plan: ${planName}`) : "",
    period   ? (isAr ? `الاشتراك: ${period}${amount ? ` — ${amount}` : ""}`
                     : `Billing: ${period}${amount ? ` — ${amount}` : ""}`) : "",
    !period && amount ? (isAr ? `المبلغ: ${amount}` : `Amount: ${amount}`) : "",
    detail   ? (isAr ? `التفاصيل: ${detail}` : `Details: ${detail}`) : "",
    email    ? (isAr ? `بريد الحساب: ${email}` : `Account email: ${email}`) : "",
  ];
  return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(lines.filter(Boolean).join("\n"))}`;
}

/** Open the WhatsApp route in a new tab. For onClick handlers. */
export function openWhatsapp(opts) {
  window.open(whatsappRequestLink(opts), "_blank", "noopener,noreferrer");
}
