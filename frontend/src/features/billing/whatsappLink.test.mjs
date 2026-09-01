/**
 * The WhatsApp activation link is the only working payment path while Stripe
 * and Kashier are marked coming-soon, so the message it carries has to be
 * right: which plan, which billing period, how much, and which account —
 * otherwise every sale starts with a round trip asking.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The module reads import.meta.env, which only exists under Vite. Evaluate it
// with that substituted so the real source is what gets tested, not a copy.
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "../../lib/salesWhatsapp.js"), "utf8")
  .replace(/import\.meta\.env/g, "({})");
const mod = await import("data:text/javascript," + encodeURIComponent(src));
const { whatsappActivationLink, SALES_WHATSAPP, SALES_WHATSAPP_DISPLAY,
        ONLINE_PAYMENT_LIVE, activationPromise, activateLabel } = mod;

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); pass++; }
  catch (e) { console.log(`  FAIL  ${name}\n          ${e.message}`); fail++; }
};
const decoded = (url) => decodeURIComponent(new URL(url).searchParams.get("text"));

const en = whatsappActivationLink({
  planName: "Professional", billing: "yearly", price: 3990,
  currency: "EGP", email: "student@tkh.edu.eg", isAr: false,
});
const ar = whatsappActivationLink({
  planName: "Professional", billing: "monthly", price: 499,
  currency: "EGP", email: "student@tkh.edu.eg", isAr: true,
});

console.log("\nWhatsApp activation link");

t("online payment is off by default, so the manual route shows", () => {
  if (ONLINE_PAYMENT_LIVE) throw new Error("expected false with no provider configured");
});

t("points at wa.me with digits only", () => {
  const u = new URL(en);
  if (u.host !== "wa.me") throw new Error("host is " + u.host);
  if (!/^\/\d+$/.test(u.pathname)) throw new Error("path is " + u.pathname);
  if (/\D/.test(SALES_WHATSAPP)) throw new Error("number has non-digits: " + SALES_WHATSAPP);
});

t("the displayed number is the local form", () => {
  if (!SALES_WHATSAPP_DISPLAY) throw new Error("no display number");
  if (SALES_WHATSAPP_DISPLAY === SALES_WHATSAPP) throw new Error("display should be the local form");
});

t("carries the plan name", () => {
  if (!decoded(en).includes("Professional")) throw new Error(decoded(en));
});

t("carries the billing period in each language", () => {
  if (!decoded(en).includes("yearly")) throw new Error(decoded(en));
  if (!decoded(ar).includes("شهري")) throw new Error(decoded(ar));
});

t("carries the price and currency", () => {
  if (!decoded(en).includes("3,990 EGP")) throw new Error(decoded(en));
});

t("carries the account email so it can be matched", () => {
  if (!decoded(en).includes("student@tkh.edu.eg")) throw new Error(decoded(en));
});

t("Arabic message is Arabic, not English labels", () => {
  if (!decoded(ar).includes("عايز أفعّل")) throw new Error(decoded(ar));
});

t("survives a missing email and price without printing undefined/null", () => {
  const m = decoded(whatsappActivationLink({
    planName: "Elite", billing: "monthly", price: null, currency: "EGP", email: "", isAr: false,
  }));
  if (/undefined|null|NaN/.test(m)) throw new Error(m);
  if (!m.includes("Elite")) throw new Error(m);
});

t("with no plan at all it is still a ready-to-send message", () => {
  const m = decoded(whatsappActivationLink({ isAr: true }));
  if (!m.trim()) throw new Error("empty message");
  if (/undefined|null|:\s*$/m.test(m)) throw new Error(m);
});

t("is a valid URL after encoding (newlines and Arabic included)", () => {
  for (const u of [en, ar, whatsappActivationLink()]) {
    if (/\s/.test(u)) throw new Error("unencoded whitespace in link");
    new URL(u);
  }
});

t("the 30-minute commitment and button label exist in both languages", () => {
  for (const f of [activationPromise, activateLabel]) {
    if (!f(true).trim() || !f(false).trim()) throw new Error("missing string");
    if (f(true) === f(false)) throw new Error("not translated: " + f(false));
  }
  if (!/30/.test(activationPromise(true)) || !/30/.test(activationPromise(false)))
    throw new Error("the promise must state the 30 minutes");
});

console.log(`\n${"─".repeat(48)}\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
