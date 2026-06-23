/**
 * DemoMode.js — Storage & profile helpers for Corvus Demo Mode
 *
 * COMPLETELY ISOLATED from the real product:
 *  - No Firebase Auth, no Firestore, no network calls of any kind
 *  - No billing, no tiers, no company/HR concepts
 *  - All data lives in localStorage under the `corvus_demo_*` namespace
 *  - Has zero effect on any real user's account, session, or data
 *
 * Purpose: let anyone (university demos, sales walkthroughs, quick trials)
 * try the real live posture-tracking engine instantly, with just a name —
 * no signup, no email, no credit card.
 */

const NS = "corvus_demo_";
const PROFILE_KEY  = NS + "profile";
const SESSIONS_KEY = NS + "sessions";

// ── Permanent showcase account — always available, pre-populated ───
// Used for instant demos (e.g. "show me what this looks like with real data"
// at a conference or sales call) without anyone needing to run a live session
// first. Resetting/clearing demo data never deletes this — it's regenerated
// fresh each time it's selected.
export const DEMO_SHOWCASE_NAME = "Coventry University Demo";

function makeShowcaseSessions() {
  // 14 days of realistic, gently-improving sample sessions — tells a believable
  // "this product works" story without claiming clinical/diagnostic accuracy.
  const now = Date.now();
  const DAY = 86400000;
  const sessions = [];
  let baseScore = 58;
  for (let i = 13; i >= 0; i--) {
    if (i % 3 === 0) continue; // skip some days, like a real person would
    baseScore = Math.min(91, baseScore + (Math.random() * 4 - 0.5));
    const score = Math.round(baseScore + (Math.random() * 6 - 3));
    const duration = 600 + Math.round(Math.random() * 2400); // 10–50 min
    sessions.push({
      id: `demo_${now}_${i}`,
      created_at: new Date(now - i * DAY - Math.random() * 3600000).toISOString(),
      mode: Math.random() > 0.5 ? "laptop" : "side",
      avg_score: Math.max(30, Math.min(98, score)),
      good_pct: Math.max(20, Math.min(95, Math.round(score - 5 + Math.random() * 10))),
      duration_s: duration,
      duration_sec: duration,
      alerts_count: Math.max(0, Math.round((100 - score) / 12)),
      score_history: Array.from({ length: 8 }, () =>
        Math.max(20, Math.min(99, Math.round(score + (Math.random() * 16 - 8))))
      ),
      metrics: {},
      isShowcaseSample: true,
    });
  }
  return sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// ── Profile ──────────────────────────────────────────────────────
export function getDemoProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function startDemoProfile(name) {
  const profile = {
    name: (name || "Guest").trim().slice(0, 60),
    started_at: new Date().toISOString(),
    isDemo: true,
  };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {}
  return profile;
}

export function startShowcaseProfile() {
  const profile = {
    name: DEMO_SHOWCASE_NAME,
    started_at: new Date().toISOString(),
    isDemo: true,
    isShowcase: true,
  };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    // Always regenerate fresh showcase sessions — this account is a living
    // sample, not something a real demo-giver needs to "preserve".
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(makeShowcaseSessions()));
  } catch {}
  return profile;
}

export function endDemoSession() {
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(SESSIONS_KEY);
  } catch {}
}

// ── Sessions ─────────────────────────────────────────────────────
export function getDemoSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveDemoSession(data) {
  try {
    const list = getDemoSessions();
    const entry = {
      id: `demo_${Date.now()}`,
      created_at: new Date().toISOString(),
      ...data,
    };
    list.unshift(entry);
    // Cap at 100 sessions — this is a demo, not a database
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, 100)));
    return entry;
  } catch {
    return null;
  }
}

export function deleteDemoSession(id) {
  try {
    const list = getDemoSessions().filter(s => s.id !== id);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
  } catch {}
}

export function isDemoActive() {
  return !!getDemoProfile();
}
