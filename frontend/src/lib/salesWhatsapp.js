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
