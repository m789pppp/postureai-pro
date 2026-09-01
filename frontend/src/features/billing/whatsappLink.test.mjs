/**
 * The WhatsApp activation link is the only working payment path while
 * Stripe and Kashier are marked coming-soon, so the message it carries has
 * to be right: which plan, which billing period, how much, and which
 * account — otherwise every sale starts with a round trip asking.
 *
 * The helper lives in src/Billing.jsx, which imports React. Rather than pull
 * that in, this re-implements nothing: it extracts the function's source and
 * evaluates it, so a change to the real one that breaks these assertions is
 * caught rather than quietly diverging.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "../../Billing.jsx"), "utf8");

// Pull the constants and the function out of the module, without React.
const consts = src.match(/const SALES_WHATSAPP = [\s\S]*?;\nconst SALES_WHATSAPP_DISPLAY = .*?;/)[0]
  .replace(/import\.meta\.env\.[A-Z_]+ \|\| /g, "");
const fnSrc = src.match(/export function whatsappActivationLink\([\s\S]*?\n\}/)[0]
  .replace("export ", "");
const whatsappActivationLink = new Function(`${consts}\n${fnSrc}\nreturn whatsappActivationLink;`)();

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

t("points at the sales number, digits only", () => {
  const u = new URL(en);
  if (u.host !== "wa.me") throw new Error("host is " + u.host);
  if (!/^\/\d+$/.test(u.pathname)) throw new Error("path is " + u.pathname);
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

t("Arabic message is Arabic, not a translation of the labels only", () => {
  const m = decoded(ar);
  if (!m.includes("عايز أفعّل")) throw new Error(m);
});

t("survives a missing email and a missing price", () => {
  const m = decoded(whatsappActivationLink({
    planName: "Elite", billing: "monthly", price: null, currency: "EGP", email: "", isAr: false,
  }));
  if (m.includes("undefined") || m.includes("null")) throw new Error(m);
  if (!m.includes("Elite")) throw new Error(m);
});

t("is a valid URL after encoding (newlines and Arabic included)", () => {
  for (const u of [en, ar]) {
    if (/\s/.test(u)) throw new Error("unencoded whitespace in link");
    new URL(u);
  }
});

console.log(`\n${"─".repeat(48)}\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
