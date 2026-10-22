/**
 * tierQuality — the feature/AI-Coach quality matrix every tier check in the
 * app is supposed to route through.
 *
 * This pins the one number this file's own docstring says must match three
 * other places (backend/config/tier_quality.py's AI_COACH_QUALITY, the
 * backend.py Redis counters it's derived from, and PricingPage.jsx's
 * advertised copy) after finding it hadn't, for Professional specifically:
 * QUALITY.professional.aiCoach.monthlyLimit was 50 here while backend
 * enforced 30 and the pricing page advertised "AI Coach (30 msgs/mo)".
 * Commit 59da920 already fixed that exact drift once, in
 * config/tier_quality.py and PricingPage.jsx -- never here, so AICoach.jsx's
 * "`${coachLimit-msgCount} left`" counter kept telling Professional users
 * they had messages left for 20 messages that the backend would reject.
 *
 *   node src/lib/tierQuality.test.mjs
 */
import { featureTier, tierAtLeast, QUALITY, qualityFor, coachLimitLabel } from "./tierQuality.js";

let pass = 0, fail = 0; const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) pass++; else { fail++; failures.push(`${name}${detail ? " — " + detail : ""}`); }
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const eq = (name, got, want) =>
  check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

console.log("\n== featureTier / tierAtLeast ==");
eq("b2b_enterprise collapses to elite", featureTier("b2b_enterprise"), "elite");
eq("b2b_growth collapses to professional", featureTier("b2b_growth"), "professional");
eq("legacy 'pro' collapses to professional", featureTier("pro"), "professional");
eq("legacy 'business' collapses to elite", featureTier("business"), "elite");
eq("unknown/missing tier falls back to standard", featureTier("something_made_up"), "standard");
check("tierAtLeast: a B2B plan meets its equivalent B2C floor",
  tierAtLeast("b2b_enterprise", "elite") === true);
check("tierAtLeast: standard does not meet professional",
  tierAtLeast("standard", "professional") === false);

console.log("\n== AI Coach monthly limits — must match backend/config/tier_quality.py AI_COACH_QUALITY and PricingPage.jsx's advertised copy ==");
// backend's AI_COACH_QUALITY, copied here as the comparison ground truth —
// not imported, since this is a JS file with no access to the Python
// source; drift between this literal and the real backend file is exactly
// what the module's own doc comment (and this test) exist to keep visible.
const BACKEND_AI_COACH_QUALITY = {
  standard:     { monthly_limit: 5,  max_tokens: 550,  depth: "brief" },
  basic:        { monthly_limit: 10, max_tokens: 650,  depth: "brief" },
  professional: { monthly_limit: 30, max_tokens: 900,  depth: "standard" },
  elite:        { monthly_limit: -1, max_tokens: 1400, depth: "clinical" },
};
for (const level of ["standard", "basic", "professional", "elite"]) {
  const fe = QUALITY[level].aiCoach;
  const be = BACKEND_AI_COACH_QUALITY[level];
  eq(`${level}: monthlyLimit matches backend's monthly_limit`, fe.monthlyLimit, be.monthly_limit);
  eq(`${level}: maxTokens matches backend's max_tokens`, fe.maxTokens, be.max_tokens);
  eq(`${level}: depth matches backend's depth`, fe.depth, be.depth);
}
// The specific regression this file was written for.
eq("Professional's monthlyLimit is 30, matching PricingPage.jsx's 'AI Coach (30 msgs/mo)' — not 50",
   qualityFor("professional").aiCoach.monthlyLimit, 30);
eq("the legacy 'pro' alias resolves to the same, correct limit",
   qualityFor("pro").aiCoach.monthlyLimit, 30);

console.log("\n== coachLimitLabel ==");
eq("professional label", coachLimitLabel("professional", "en"), "30 msgs/month");
eq("elite label is 'Unlimited', not a number", coachLimitLabel("elite", "en"), "Unlimited");

console.log(`\n${pass} passed · ${fail} failed`);
if (fail) { failures.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
