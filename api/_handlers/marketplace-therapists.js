/**
 * Corvus Marketplace — therapist listing + booking
 *
 * GET  /api/marketplace/therapists?city=Cairo
 * POST /api/marketplace/therapists?action=book
 * GET  /api/marketplace/therapists?action=my-bookings
 * POST /api/marketplace/therapists?action=cancel
 */
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomBytes } from "crypto";

function getAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY||"").replace(/\\n/g,"\n"),
    })});
  }
  return { db: getFirestore(), auth: getAuth() };
}

async function verifyUser(req) {
  const token = (req.headers.authorization||"").replace("Bearer ","");
  if (!token) return null;
  try {
    const { auth } = getAdmin();
    return (await auth.verifyIdToken(token)).uid;
  } catch { return null; }
}

// Same convention as api/_handlers/billing-analytics.js's admin check.
async function isAdmin(db, uid) {
  const caller = await db.collection("users").doc(uid).get();
  return ["platform_admin","admin"].includes(caller.data()?.user_type) || !!caller.data()?.is_admin;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization");
  if (req.method==="OPTIONS") return res.status(200).end();

  let db;
  try { ({ db } = getAdmin()); }
  catch (e) { console.error("[marketplace-therapists] Firebase Admin init failed:", e.message); return res.status(500).json({error:"Server misconfiguration — Firebase Admin credentials"}); }
  const action = req.query.action;

  // ── GET therapists list ─────────────────────────────────────────
  if (req.method==="GET" && !action) {
    const city = req.query.city;
    let q = db.collection("therapists").where("status","==","active");
    if (city) q = q.where("city","==",city);
    const snap = await q.orderBy("rating","desc").limit(20).get();

    if (snap.empty) {
      // Seed default therapists on first use
      return res.status(200).json({ therapists: [], seeded: false });
    }

    const therapists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.status(200).json({ therapists });
  }

  // ── GET my bookings ─────────────────────────────────────────────
  if (req.method==="GET" && action==="my-bookings") {
    const uid = await verifyUser(req);
    if (!uid) return res.status(401).json({error:"Auth required"});

    const snap = await db.collection("bookings")
      .where("patient_uid","==",uid)
      .orderBy("created_at","desc")
      .limit(20).get();

    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.status(200).json({ bookings });
  }

  // ── POST book session ───────────────────────────────────────────
  if (req.method==="POST" && action==="book") {
    const uid = await verifyUser(req);
    if (!uid) return res.status(401).json({error:"Auth required"});

    const { therapist_id, preferred_time, notes, slot_datetime } = req.body||{};
    if (!therapist_id) return res.status(400).json({error:"therapist_id required"});

    const therapistSnap = await db.collection("therapists").doc(therapist_id).get();
    if (!therapistSnap.exists) return res.status(404).json({error:"Therapist not found"});
    const therapist = therapistSnap.data();

    const booking_id = "BK-" + randomBytes(4).toString("hex").toUpperCase();
    const booking = {
      booking_id,
      patient_uid:    uid,
      therapist_id,
      therapist_name: therapist.name,
      therapist_photo:therapist.photo_url || null,
      preferred_time: preferred_time || null,
      slot_datetime:  slot_datetime  || null,
      notes:          notes          || null,
      status:         "pending",
      fee_egp:        therapist.session_fee_egp || 0,
      created_at:     new Date().toISOString(),
      server_ts:      FieldValue.serverTimestamp(),
    };

    await db.collection("bookings").doc(booking_id).set(booking);

    // Notify therapist (fire-and-forget)
    db.collection("notifications").add({
      uid: therapist_id, type: "new_booking",
      title: "طلب حجز جديد", body: `مريض جديد طلب جلسة`,
      booking_id, created_at: new Date().toISOString(),
    }).catch(()=>{});

    return res.status(200).json({ ok: true, booking });
  }

  // ── POST cancel booking ─────────────────────────────────────────
  if (req.method==="POST" && action==="cancel") {
    const uid = await verifyUser(req);
    if (!uid) return res.status(401).json({error:"Auth required"});

    const { booking_id } = req.body||{};
    if (!booking_id) return res.status(400).json({error:"booking_id required"});

    const ref = db.collection("bookings").doc(booking_id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({error:"Not found"});
    if (snap.data().patient_uid !== uid) return res.status(403).json({error:"Not your booking"});

    await ref.update({ status: "cancelled", cancelled_at: new Date().toISOString() });
    return res.status(200).json({ ok: true });
  }

  // ── GET booking chat messages ───────────────────────────────────
  // Previously unimplemented — the frontend's Chat button (BookingChat in
  // TherapistMarketplace.jsx) has always called this action, but there was
  // no handler for it here, so every open of a booking's chat 400'd with
  // "Invalid request" (silently swallowed by the frontend's fallback-to-
  // demo-messages catch, so it looked empty rather than errored).
  if (req.method==="GET" && action==="messages") {
    const uid = await verifyUser(req);
    if (!uid) return res.status(401).json({error:"Auth required"});

    const booking_id = req.query.booking_id;
    if (!booking_id) return res.status(400).json({error:"booking_id required"});

    const bookingSnap = await db.collection("bookings").doc(booking_id).get();
    if (!bookingSnap.exists) return res.status(404).json({error:"Booking not found"});
    const bookingData = bookingSnap.data();
    if (bookingData.patient_uid !== uid && !(await isAdmin(db, uid))) {
      return res.status(403).json({error:"Not your booking"});
    }

    const snap = await db.collection("bookings").doc(booking_id)
      .collection("messages").orderBy("created_at","asc").limit(200).get();
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data(), therapist_name: bookingData.therapist_name }));
    return res.status(200).json({ messages });
  }

  // ── POST send booking chat message ──────────────────────────────
  if (req.method==="POST" && action==="message") {
    const uid = await verifyUser(req);
    if (!uid) return res.status(401).json({error:"Auth required"});

    const { booking_id, text } = req.body||{};
    if (!booking_id || !text?.trim()) return res.status(400).json({error:"booking_id and text required"});

    const bookingRef = db.collection("bookings").doc(booking_id);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) return res.status(404).json({error:"Booking not found"});
    const bookingData = bookingSnap.data();
    const callerIsAdmin = await isAdmin(db, uid);
    if (bookingData.patient_uid !== uid && !callerIsAdmin) {
      return res.status(403).json({error:"Not your booking"});
    }

    const message = {
      sender_uid:  uid,
      sender_role: callerIsAdmin && bookingData.patient_uid !== uid ? "admin" : "patient",
      text:        text.trim().slice(0, 2000),
      created_at:  new Date().toISOString(),
      server_ts:   FieldValue.serverTimestamp(),
    };
    const ref = await bookingRef.collection("messages").add(message);

    // Notify the other party (fire-and-forget, same pattern as the new-booking notify above)
    db.collection("notifications").add({
      uid: message.sender_role === "admin" ? bookingData.patient_uid : bookingData.therapist_id,
      type: "chat_message", title: "رسالة جديدة",
      body: message.text.slice(0, 120), booking_id, created_at: message.created_at,
    }).catch(()=>{});

    return res.status(200).json({ ok: true, message: { id: ref.id, ...message, therapist_name: bookingData.therapist_name } });
  }

  return res.status(400).json({error:"Invalid request"});
}
