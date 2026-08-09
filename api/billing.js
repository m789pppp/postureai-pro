// Router for /api/billing/analytics, /payments, /prorate,
// /api/company/branding, /api/marketplace/seed, /api/marketplace/therapists.
// These 6 landed as separate top-level files and pushed the function count
// back over the Hobby-plan's 12-function limit (again) — same fix as
// api/kashier.js, api/session.js, etc.: move to _handlers/, dispatch here.
import billingAnalyticsHandler from "./_handlers/billing-analytics.js";
import billingPaymentsHandler from "./_handlers/billing-payments.js";
import billingProrateHandler from "./_handlers/billing-prorate.js";
import companyBrandingHandler from "./_handlers/company-branding.js";
import marketplaceSeedHandler from "./_handlers/marketplace-seed.js";
import marketplaceTherapistsHandler from "./_handlers/marketplace-therapists.js";

export default async function handler(req, res) {
  const path = (req.url || "").split("?")[0];
  if (path.endsWith("/billing/analytics")) return billingAnalyticsHandler(req, res);
  if (path.endsWith("/billing/payments")) return billingPaymentsHandler(req, res);
  if (path.endsWith("/billing/prorate")) return billingProrateHandler(req, res);
  if (path.endsWith("/company/branding")) return companyBrandingHandler(req, res);
  if (path.endsWith("/marketplace/seed")) return marketplaceSeedHandler(req, res);
  if (path.endsWith("/marketplace/therapists")) return marketplaceTherapistsHandler(req, res);
  return res.status(404).json({ error: "Unknown route: " + path });
}
