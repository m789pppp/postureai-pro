#!/usr/bin/env node
/**
 * Switch an organisation to aggregate-only reporting.
 *
 *   node scripts/set-pilot-privacy.mjs <company_id> [--min 5]
 *   node scripts/set-pilot-privacy.mjs <company_id> --off
 *   node scripts/set-pilot-privacy.mjs --list
 *
 * Why this exists as a script rather than a note in a checklist: the
 * mechanism defaults to OFF, so until this flag is set the HR dashboard still
 * returns a named posture leaderboard — every participant with their email,
 * average score, an A–D grade, an alert count and an "At Risk" status, plus an
 * explicit worst-five list. For a commercial B2B customer that is the product.
 * For a university cohort it is the single thing most likely to fail an ethics
 * review, and the gap between "we described aggregate reporting in the
 * submission" and "the flag was never set" is one forgotten field.
 *
 * What the flag does (enforced server-side in backend.py):
 *   - top_performers / needs_attention / at_risk / all_employees return empty
 *   - a k-anonymity floor (min_group_size, default 5) hides reporting entirely
 *     until that many people have recorded a session in the period — because
 *     removing names is not enough on its own: with three participants, a
 *     company average plus your own score usually identifies the rest
 *   - /api/company/alert-employees refuses to target individuals by score, so
 *     the suppression cannot be sidestepped one call to the left
 *
 * Requires the same Admin SDK credentials the API uses:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

const args = process.argv.slice(2);
const wantsList = args.includes("--list");
const turnOff   = args.includes("--off");
const companyId = args.find(a => !a.startsWith("--"));
const minIdx    = args.indexOf("--min");
const minGroup  = minIdx !== -1 ? parseInt(args[minIdx + 1], 10) : 5;

if (!wantsList && !companyId) {
  console.error("Usage: node scripts/set-pilot-privacy.mjs <company_id> [--min 5] [--off]");
  console.error("       node scripts/set-pilot-privacy.mjs --list");
  process.exit(2);
}
if (!wantsList && (!Number.isFinite(minGroup) || minGroup < 2)) {
  console.error("--min must be an integer of 2 or more. A floor of 1 suppresses nothing.");
  process.exit(2);
}

for (const v of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]) {
  if (!process.env[v]) {
    console.error(`Missing ${v}. Set the Admin SDK credentials before running this.`);
    process.exit(2);
  }
}

// Imported here, not at the top: a static import runs before any of the
// guards above, so a missing dependency swallowed the usage and
// credential messages and printed a module-resolution stack instead.
let initializeApp, getApps, cert, getFirestore;
try {
  ({ initializeApp, getApps, cert } = await import("firebase-admin/app"));
  ({ getFirestore } = await import("firebase-admin/firestore"));
} catch {
  console.error("firebase-admin is not installed. From the repository root:\n  npm install");
  process.exit(2);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

console.log(`Firebase project: ${process.env.FIREBASE_PROJECT_ID}\n`);

if (wantsList) {
  const snap = await db.collection("companies").limit(50).get();
  if (snap.empty) {
    console.log("No companies found.");
    process.exit(0);
  }
  console.log("id".padEnd(26) + "name".padEnd(28) + "reporting");
  console.log("─".repeat(72));
  snap.docs.forEach(d => {
    const c = d.data() || {};
    const mode = c.aggregate_only
      ? `aggregate-only (min ${c.min_group_size || 5})`
      : "individual (named leaderboard)";
    console.log(d.id.slice(0, 24).padEnd(26) + String(c.name || "—").slice(0, 26).padEnd(28) + mode);
  });
  process.exit(0);
}

const ref = db.collection("companies").doc(companyId);
const snap = await ref.get();
if (!snap.exists) {
  console.error(`No company with id "${companyId}". Run with --list to see them.`);
  process.exit(1);
}
const before = snap.data() || {};

if (turnOff) {
  await ref.update({
    aggregate_only: false,
    privacy_mode_updated_at: new Date().toISOString(),
  });
  console.log(`"${before.name || companyId}" → individual reporting.`);
  console.log("HR can once again see named per-person scores. Make sure that is what you intend.");
  process.exit(0);
}

await ref.update({
  aggregate_only: true,
  min_group_size: minGroup,
  privacy_mode_updated_at: new Date().toISOString(),
});

console.log(`"${before.name || companyId}" → aggregate-only reporting.`);
console.log(`Minimum group size: ${minGroup}\n`);
console.log("From now on, for this organisation:");
console.log("  · no individual is named to anyone but themselves");
console.log("  · no top-performer, worst-five or at-risk list is returned");
console.log(`  · all reporting is hidden until ${minGroup} people have recorded a session`);
console.log("  · HR cannot message people selected by posture score (broadcast still works)");
console.log("\nVerify by loading the HR dashboard: it should report");
console.log('privacy_mode: "aggregate_only" and empty employee lists.');
