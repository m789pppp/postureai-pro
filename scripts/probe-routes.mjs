/**
 * Post-deploy probe: do the endpoints that used to 404 now reach a handler?
 *
 * Unauthenticated on purpose. We are not testing that they work — we are
 * testing that they are REACHED. A 401/403 (auth required), 400 (bad body) or
 * 405 (wrong method) all prove the request got to the Flask app. A 404 means
 * it is still being swallowed by a JS router.
 */
const BASE = (process.argv[2] || process.env.PREFLIGHT_URL || "").replace(/\/+$/, "");
if (!BASE) {
  console.error("Usage: node scripts/probe-routes.mjs https://your-deployment.example.app");
  process.exit(2);
}

// [path, method, label] — every one of these returned 404 before the fix
const PROBES = [
  ["/api/auth/mfa/login-verify",     "POST", "MFA login verify   (lockout bug)"],
  ["/api/auth/mfa/sms/send",         "POST", "MFA SMS send       (lockout bug)"],
  ["/api/auth/mfa/totp/setup",       "POST", "MFA TOTP setup"],
  ["/api/auth/mfa/disable",          "POST", "MFA disable"],
  ["/api/admin/feature-flags",       "GET",  "Admin feature flags"],
  ["/api/admin/users",               "GET",  "Admin users"],
  ["/api/admin/system/health",       "GET",  "Admin system health"],
  ["/api/org/create-invite",         "POST", "Org create invite"],
  ["/api/org/send-invite",           "POST", "Org send invite"],
  ["/api/org/health-scores",         "GET",  "Org health scores"],
  ["/api/email/weekly-progress",     "POST", "Weekly progress email"],
  ["/api/notify/payment",            "POST", "Payment notification"],
  ["/api/notify/slack",              "POST", "Slack notification"],
  ["/api/notify/teams",              "POST", "Teams notification"],
  ["/api/notify/whatsapp",           "POST", "WhatsApp notification"],
  ["/api/gamification/leaderboard",  "GET",  "Leaderboard"],
  ["/api/stress/log",                "POST", "Stress log"],
];

// Controls: paths that were always fine. If these break, the route rewrite
// took something working with it — the only real risk of this change.
const CONTROLS = [
  ["/api/health",              "GET",  "Health"],
  ["/api/announcements",       "GET",  "Announcements list"],
  ["/api/auth/whoami",         "GET",  "whoami"],
  ["/api/notify/dispatch",     "POST", "Notify dispatch"],
  ["/api/account/delete",      "POST", "Account delete"],
  ["/api/metrics/revenue",     "GET",  "Metrics revenue"],
  ["/api/org/invite/accept",   "POST", "Invite accept"],
  ["/api/email/send",          "POST", "Email send"],
  ["/api/gamification/compute","POST", "Gamification compute"],
  ["/api/stress/correlation",  "POST", "Stress correlation"],
  ["/api/referral/stats",      "GET",  "Referral stats"],
  ["/api/cert/verify",         "POST", "Cert verify"],
];

const hit = async ([p, method]) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 20000);
  try {
    const r = await fetch(BASE + p, {
      method,
      headers: { "content-type": "application/json" },
      body: method === "POST" ? "{}" : undefined,
      signal: c.signal,
    });
    return r.status;
  } catch (e) { return `ERR ${e.name}`; }
  finally { clearTimeout(t); }
};

const run = async (list, title, expectReached) => {
  console.log(`\n${title}`);
  let bad = 0;
  for (const probe of list) {
    const s = await hit(probe);
    const reached = typeof s === "number" && s !== 404;
    const ok = expectReached ? reached : reached;
    if (!ok) bad++;
    console.log(`  ${ok ? "ok  " : "FAIL"}  ${String(s).padEnd(9)} ${probe[1].padEnd(5)} ${probe[2]}`);
  }
  return bad;
};

const a = await run(PROBES,   "Was 404 before the fix — must now reach a handler", true);
const b = await run(CONTROLS, "Worked before — must still work (regression check)", true);
console.log(`\n${"─".repeat(60)}`);
console.log(a === 0 && b === 0
  ? `all ${PROBES.length + CONTROLS.length} endpoints reach a handler (no 404s)`
  : `${a} previously-broken and ${b} previously-working endpoints still 404`);
process.exit(a + b ? 1 : 0);
