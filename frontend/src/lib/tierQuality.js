/**
 * tierQuality.js — Canonical FEATURE-TIER quality matrix
 * ─────────────────────────────────────────────────────────────────
 * This is the SINGLE SOURCE OF TRUTH for "how good is the analysis /
 * AI coaching for this user", across every B2C and B2B plan.
 *
 * IMPORTANT — this is NOT the same thing as App.jsx's normalizeTier():
 *   - App.jsx normalizeTier()  → billing/pricing ID cleanup. Deliberately
 *     KEEPS b2b_* IDs distinct (never collide with B2C IDs — see the
 *     comment there). Used for payments, plan display, Firestore writes.
 *   - featureTier() (this file) → feature/quality GATING only. Collapses
 *     every plan (B2C legacy aliases AND B2B plans) onto one 4-rung
 *     ladder: standard < basic < professional < elite. Mirrors
 *     backend/auth/middleware.py _TIER_ALIASES + backend/config/tier_quality.py
 *     — keep all three in sync if the ladder ever changes.
 *
 * Why this file exists: every ad-hoc `tier === "elite"` check in the
 * app only ever matched the literal B2C string, so paying B2B Growth/
 * Enterprise customers (tier = "b2b_growth"/"b2b_enterprise") were
 * silently treated as the lowest tier for live backend-assisted
 * analysis, PredictiveAI, and AI Coach limits/depth — despite paying
 * $79–499+/mo. Route every tier check in the app through here instead.
 */

// ── Ladder ──────────────────────────────────────────────────────────
export const LEVELS = ["standard", "basic", "professional", "elite"];
export const LEVEL_ORDER = { standard: 0, basic: 1, professional: 2, elite: 3 };

// ── Raw tier string → feature level ─────────────────────────────────
// Covers: real B2C plans, legacy B2C aliases (pro/premium/starter/growth/
// enterprise from older code/Firestore docs), and real B2B plans.
const FEATURE_LEVEL = {
  // B2C — current
  standard: "standard",
  basic: "basic",
  professional: "professional",
  elite: "elite",
  // B2C — legacy aliases (old Firestore docs / older code paths)
  pro: "professional",
  premium: "elite",
  personal_basic: "basic",
  personal_pro: "professional",
  personal_elite: "elite",
  starter: "basic",
  growth: "professional",
  enterprise: "elite",
  // Legacy "business" tier — still actively used in backend.py (pose model
  // selection, SEAT_LIMITS, etc.) but was missing here, so featureTier()
  // silently collapsed it to "standard" (lowest level) for any user still
  // on this plan. Mirrors how it's treated in backend.py (full pose model,
  // same bracket as professional/elite).
  business: "elite",
  // B2B — company plans collapse onto the equivalent individual feature
  // level (mirrors backend/auth/middleware.py _TIER_ALIASES exactly)
  b2b_starter: "standard",
  b2b_growth: "professional",
  b2b_enterprise: "elite",
};

/** Any raw tier string (B2C, legacy alias, or B2B plan) → one of the 4 feature levels. */
export function featureTier(rawTier) {
  if (!rawTier) return "standard";
  // Normalize case — Firestore sometimes stores "Elite", "ELITE", "Professional" etc.
  const t = String(rawTier).toLowerCase().trim();
  return FEATURE_LEVEL[t] || "standard";
}

/** True if rawTier's feature level is >= minLevel (e.g. tierAtLeast("b2b_enterprise","elite") === true). */
export function tierAtLeast(rawTier, minLevel) {
  return LEVEL_ORDER[featureTier(rawTier)] >= (LEVEL_ORDER[minLevel] ?? 0);
}

// ── Quality matrix — keyed by FEATURE LEVEL, not raw tier ───────────
// Numeric AI Coach monthly limits intentionally match the existing,
// already-working backend Redis counters in backend.py coach_chat()
// (standard:5, basic:10, professional:30, elite:-1) and maxTokens
// mirrors backend/config/tier_quality.py's AI_COACH_QUALITY (both
// files' own docstrings require this). Local-only AI (Ollama): every
// tier shares the same model, only token budget/persona differ.
//
// BUG FIX: professional's monthlyLimit here was 50 and maxTokens was
// out of sync with all four tiers' backend values. Commit 59da920
// already found and fixed this exact 50-vs-30 drift once — but only in
// backend/config/tier_quality.py and PricingPage.jsx ("AI Coach (30
// msgs/mo)"), never here. Since AICoach.jsx (~line 431) reads this
// monthlyLimit to decide client-side whether the user has messages
// left — `${coachLimit-msgCount} left`, and only blocks sending at
// coachLimit — a Professional user who'd sent 30-49 messages this month
// saw a "left" count telling them they could keep going, then had every
// one of those sends rejected by the backend's real 30-message cap
// (coach_limit_reached). maxTokens (used directly by AICoach.jsx's
// localChatStream()/geminiChat() calls) was off for every tier, giving
// a shorter reply on this client-direct path than the backend-routed
// path intends for the same tier.
export const QUALITY = {
  standard: {
    label: { en: "Free", ar: "مجاني" },
    smoothingAlpha: 0.85,       // Bug #12 fix: was 0.5 — raw/fast, responsive to posture changes
    outlierMaxConsecutive: 2,
    sessionInsights: { creep: false, asymmetry: false, breathing: false },
    backendAssist: false,       // no live AI-powered backend pass during session
    predictiveAI: false,
    pdfDetail: "none",
    aiCoach: { monthlyLimit: 5, maxTokens: 550, depth: "brief" },
  },
  basic: {
    label: { en: "Basic", ar: "أساسي" },
    smoothingAlpha: 0.80,       // Bug #12 fix: was 0.45
    outlierMaxConsecutive: 3,
    sessionInsights: { creep: false, asymmetry: false, breathing: false },
    backendAssist: false,
    predictiveAI: false,
    pdfDetail: "none",
    aiCoach: { monthlyLimit: 10, maxTokens: 650, depth: "brief" },
  },
  professional: {
    label: { en: "Professional", ar: "احترافي" },
    smoothingAlpha: 0.75,       // Bug #12 fix: was 0.4 — smoother than basic
    outlierMaxConsecutive: 3,
    sessionInsights: { creep: true, asymmetry: true, breathing: false },
    backendAssist: false,       // local MediaPipe is already accurate; backend stays Elite-exclusive
    predictiveAI: false,
    pdfDetail: "standard",
    aiCoach: { monthlyLimit: 30, maxTokens: 900, depth: "standard" },
  },
  elite: {
    label: { en: "Elite", ar: "إيليت" },
    smoothingAlpha: 0.65,       // Bug #12 fix: was 0.3 — steadiest feel with good responsiveness
    outlierMaxConsecutive: 4,
    sessionInsights: { creep: true, asymmetry: true, breathing: true },
    backendAssist: true,        // live local-AI-powered backend pass + PDF snapshots
    predictiveAI: true,
    pdfDetail: "full",
    aiCoach: { monthlyLimit: -1, maxTokens: 1400, depth: "clinical" },
  },
};

/** Full quality config for any raw tier string. */
export function qualityFor(rawTier) {
  return QUALITY[featureTier(rawTier)];
}

/** Human label for the AI Coach's "X msgs/month" UI string. */
export function coachLimitLabel(rawTier, lang = "en") {
  const limit = qualityFor(rawTier).aiCoach.monthlyLimit;
  if (limit === -1) return lang === "ar" ? "غير محدود" : "Unlimited";
  return `${limit} ${lang === "ar" ? "رسالة/شهر" : "msgs/month"}`;
}
