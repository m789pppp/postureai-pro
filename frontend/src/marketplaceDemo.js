/**
 * marketplaceDemo.js — local fallback data for the Physiotherapist Marketplace
 * ─────────────────────────────────────────────────────────────────────────
 * When the backend is unreachable (VITE_API_URL misconfigured, Railway not
 * running, etc. — see apiFetch's isBackendDown flag), TherapistMarketplace
 * falls back to this instead of showing an error, so the feature is still
 * demoable/showcaseable with zero backend dependency.
 *
 * Same philosophy as DemoMode.js: clearly-labeled, isolated in its own
 * localStorage namespace, zero effect on any real account or real booking.
 * This is NOT a substitute for the real backend — bookings made here are
 * not real, no payment is taken, and nothing here is visible to therapists
 * or admins in the real system.
 */

const NS = "corvus_demo_marketplace_";
const BOOKINGS_KEY = NS + "bookings";
const MESSAGES_KEY = NS + "messages";

export const DEMO_THERAPISTS = [
  {
    id: "demo-th-1", name: "Dr. Nourhan El-Sayed", city: "Cairo",
    specialties: ["Neck & Shoulder", "Desk Posture"], years_experience: 7,
    bio: "Specializes in tech-worker posture rehab and cervical spine care.",
    session_fee_cents: 45000, currency: "EGP", rating: 4.8, review_count: 62,
  },
  {
    id: "demo-th-2", name: "Dr. Ahmed Farouk", city: "Giza",
    specialties: ["Lower Back Pain", "Sports Injury"], years_experience: 11,
    bio: "Former national athletics team physio, focuses on functional movement.",
    session_fee_cents: 60000, currency: "EGP", rating: 4.9, review_count: 118,
  },
  {
    id: "demo-th-3", name: "Dr. Mariam Adel", city: "Alexandria",
    specialties: ["Postural Correction", "Ergonomics"], years_experience: 5,
    bio: "Works closely with remote/hybrid employees on home-office setup.",
    session_fee_cents: 40000, currency: "EGP", rating: 4.7, review_count: 34,
  },
];

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function getDemoBookings() {
  return read(BOOKINGS_KEY, []);
}

export function createDemoBooking({ therapist, preferredTime, notes }) {
  const bookings = getDemoBookings();
  const booking = {
    id: `demo-book-${Date.now()}`,
    therapist_id: therapist.id,
    therapist_name: therapist.name,
    preferred_time: preferredTime || "",
    notes: notes || "",
    amount_cents: therapist.session_fee_cents,
    currency: therapist.currency,
    status: "confirmed_demo",
    created_at: new Date().toISOString(),
    is_demo: true,
  };
  bookings.unshift(booking);
  write(BOOKINGS_KEY, bookings);
  return booking;
}

export function getDemoMessages(bookingId) {
  const all = read(MESSAGES_KEY, {});
  return all[bookingId] || [];
}

export function addDemoMessage(bookingId, message) {
  const all = read(MESSAGES_KEY, {});
  all[bookingId] = [...(all[bookingId] || []), message];
  write(MESSAGES_KEY, all);
  return all[bookingId];
}
