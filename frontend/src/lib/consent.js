/**
 * Consent records.
 *
 * Before this file existed, nothing recorded that a user had agreed to
 * anything. The sign-up terms checkbox was validated as form state and then
 * discarded — `agreeTerms` never reached buildProfile(), so no field, no
 * timestamp and no policy version were stored. The camera was gated by a
 * medical disclaimer kept in localStorage, which made it per-browser rather
 * than per-account: the same person was re-prompted on a second device with
 * no link to the earlier acknowledgement, and a cleared browser silently
 * reset it.
 *
 * A university ethics committee reviewing a webcam study will ask to see a
 * given participant's consent record. That question needs an answer.
 *
 * Two separate consents are recorded, because they are separate things and
 * conflating them is precisely what a reviewer objects to:
 *   - `terms`  — the Terms of Service and Privacy Policy, accepted at sign-up.
 *   - `camera` — explicit permission to process camera images for posture
 *                analysis, accepted before the camera is first used.
 *
 * Bump the version when the substance of what the user agreed to changes.
 * A stored record whose version is older than the current one no longer
 * counts as consent, so the user is asked again.
 */

export const TERMS_VERSION  = "2026-08-30";
export const CAMERA_VERSION = "2026-08-30";

/** Firestore path for a user's consent record. */
export const consentDocPath = (uid) => ["user_consent", uid];

/**
 * Shape of one consent grant. Kept flat and boring so it reads clearly in a
 * data-subject access export and in the Firestore console.
 */
export function makeConsentGrant(version) {
  let ua = "";
  try { ua = (navigator?.userAgent || "").slice(0, 300); } catch { ua = ""; }
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { tz = ""; }
  return {
    granted:    true,
    version,
    granted_at: new Date().toISOString(),
    user_agent: ua,
    timezone:   tz,
  };
}

/** True when a stored record covers the current version of that consent. */
export function hasCurrentConsent(record, key, version) {
  const grant = record?.[key];
  return Boolean(grant && grant.granted === true && grant.version === version);
}

/**
 * Minimum age to use Corvus without additional arrangements.
 *
 * There was no age gate of any kind: no date of birth, no attestation, no
 * minimum-age clause in the Terms and no children's-data section in the
 * privacy policy — while the product does biometric-adjacent processing of a
 * webcam feed. First-year university students in Egypt can be 17, so this is
 * a live case for the pilot rather than a theoretical one.
 */
export const MIN_AGE = 18;

/** Years between a YYYY-MM-DD date of birth and today. Null if unparseable. */
export function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  if (d > now) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  // Guard against obvious typos (a 4-digit year mistyped as 1002).
  if (age < 0 || age > 120) return null;
  return age;
}

export function meetsMinimumAge(dob) {
  const age = ageFromDob(dob);
  return age !== null && age >= MIN_AGE;
}
