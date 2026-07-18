import { initializeApp } from "firebase/app";
import { API_BASE_URL } from "./config/api.js";
import {
  getAuth, signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, OAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  onAuthStateChanged as _onAuthStateChanged,
  sendPasswordResetEmail, sendEmailVerification,
  confirmPasswordReset, verifyPasswordResetCode, applyActionCode,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  browserLocalPersistence, browserSessionPersistence, setPersistence,
  deleteUser as _deleteAuthUser,
} from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where, orderBy, limit, getDocs,
  onSnapshot, serverTimestamp as _serverTimestamp, increment, writeBatch,
} from "firebase/firestore";
import { tierAtLeast } from "./lib/tierQuality.js";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "AIzaSyADLL_muc6ooQnfr1cKDCZFX3FKYknTxiI",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "postureai-prod.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "postureai-prod",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "postureai-prod.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| "1055930005121",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "1:1055930005121:web:0964a6e53cd590988a3f80",
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID     || "G-2R7SKP0V95",
};
if (!firebaseConfig.apiKey) console.error("❌ Firebase config missing — check .env.local");

// Admin status is determined ONLY from Firestore profile.is_admin (set server-side).
// Exposing admin email in the client bundle allows role discovery attacks.
export const SUPPORT_EMAIL       = import.meta.env.VITE_SUPPORT_EMAIL       || "m789pppp@gmail.com";
export const ADMIN_PHONE         = import.meta.env.VITE_ADMIN_PHONE         || "";
export const AUTO_APPROVE_DOMAIN = import.meta.env.VITE_AUTO_APPROVE_DOMAIN || "";
export const PAYMOB_IFRAME_ID    = import.meta.env.VITE_PAYMOB_IFRAME_ID    || "";
export const PAYMOB_PUBLIC_KEY   = import.meta.env.VITE_PAYMOB_PUBLIC_KEY   || "";

const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
export const db   = getFirestore(fbApp);
export const serverTimestamp = _serverTimestamp;

// Re-export Firestore SDK functions so other modules can import from firebase.js
// This avoids duplicate Firebase app initialization across the codebase
export {
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where, orderBy, limit, getDocs,
  onSnapshot, increment, writeBatch,
} from "firebase/firestore";

const gProvider = new GoogleAuthProvider();
gProvider.addScope('email');
gProvider.addScope('profile');
gProvider.setCustomParameters({ prompt: 'select_account' });

const msProvider = new OAuthProvider('microsoft.com');
msProvider.addScope('email');
msProvider.addScope('profile');
msProvider.setCustomParameters({ prompt: 'select_account' });

export const signInGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, gProvider);
    return result;
  } catch (e) {
    const code = e.code || '';
    // All cases where redirect is better than showing an error
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/internal-error' ||
      code === 'auth/network-request-failed'
    ) {
      try {
        sessionStorage.setItem("__pendingOAuth", "1");
        await signInWithRedirect(auth, gProvider);
      } catch {}
      return null;
    }
    throw e;
  }
};

export const getGoogleRedirectResult = () => getRedirectResult(auth);

export const signInMicrosoft = async () => {
  try {
    const result = await signInWithPopup(auth, msProvider);
    return result;
  } catch (e) {
    const code = e.code || '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/internal-error' ||
      code === 'auth/network-request-failed'
    ) {
      try {
        sessionStorage.setItem("__pendingOAuth", "1");
        await signInWithRedirect(auth, msProvider);
      } catch {}
      return null;
    }
    throw e;
  }
};
export const signInEmail        = (e, p) => signInWithEmailAndPassword(auth, e, p);
export const signUpEmail        = (e, p) => createUserWithEmailAndPassword(auth, e, p);
// Deletes the currently signed-in Firebase Auth user — used as a rollback
// when signup succeeds but profile creation in Firestore fails critically.
export const deleteAuthUser     = () => _deleteAuthUser(auth.currentUser);
export const logOut             = () => signOut(auth);
const APP_URL = window.location.origin;

export const resetPassword = (email) =>
  sendPasswordResetEmail(auth, email, {
    url: `${APP_URL}/?action=resetPassword`,
    handleCodeInApp: false,
  });

export const sendVerificationEmail = (user) =>
  sendEmailVerification(user || auth.currentUser, {
    url: `${APP_URL}/?action=verified`,
    handleCodeInApp: false,
  });

// Called when user arrives from reset-password email link
export const verifyResetCode  = (oobCode) => verifyPasswordResetCode(auth, oobCode);
export const confirmReset     = (oobCode, newPass) => confirmPasswordReset(auth, oobCode, newPass);
export const applyAction      = (oobCode) => applyActionCode(auth, oobCode);

// Change password for logged-in user (requires re-auth)
export const changePassword = async (currentPass, newPass) => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("Not authenticated");
  const cred = EmailAuthProvider.credential(user.email, currentPass);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPass);
};

// Persistence — remember me
export const setRememberMe = (remember) =>
  setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
export const onAuthStateChanged = (cb) => _onAuthStateChanged(auth, cb);

export const COMPANY_DOMAINS = AUTO_APPROVE_DOMAIN ? [AUTO_APPROVE_DOMAIN] : [];
export const isCompanyDomain    = (email) => COMPANY_DOMAINS.some(d => email?.toLowerCase().endsWith("@" + d));
export const isHREmail          = (email) => isCompanyDomain(email); // HR check via domain only; role comes from Firestore
export const isAutoApproveEmail = (email) => isCompanyDomain(email);

// ── User Profile ──────────────────────────────────────────────────
export async function createUserProfile(uid, data, referredBy = null) {
  const isAuto  = isAutoApproveEmail(data.email);
  const isAdmin = false; // SECURITY: is_admin is set ONLY by server-side admin action, never on signup
  const isCoDom = isCompanyDomain(data.email);
  const trialExpires = new Date();
  trialExpires.setDate(trialExpires.getDate() + 7); // 7-day trial

  // Tier logic:
  // - Auto-approve domain (e.g. tkh.edu.eg) → elite (also elevated server-side)
  // - Everyone else → standard with 14-day professional trial
  // Previously was 'professional' + is_trial=true which was contradictory
  const baseTier = isAuto ? "elite" : "standard";

  const profile = {
    uid, email: data.email||"", name: data.name||"",
    company: data.company||(isCoDom?data.email.split("@")[1]:""),
    tier: baseTier,
    acct_type: isCoDom?"company":"personal",
    is_admin: isAdmin, auto_approved: isAuto,
    is_trial: !isAuto,
    trial_tier: "professional",  // what they experience during trial
    trial_expires_at: isAuto ? null : trialExpires,
    setup_complete: false,
    onboarding_done: [], sessions_count: 0, avg_score: 0,
    email_day2_sent: false, email_day5_sent: false,
    email_day6_sent: false, email_day7_sent: false,
    email_week3_sent: false,
    referral_code: uid.slice(0,8),
    referred_by: referredBy||null,
    referral_count: 0, referral_credits: 0,
    department_id: null, company_id: null,
    created_at: _serverTimestamp(), updated_at: _serverTimestamp(),
  };
  await setDoc(doc(db,"users",uid), profile);
  if (referredBy) { try { await applyReferralCredit(referredBy, uid, data.email); } catch(e){} }

  // Fire welcome drip sequence — fire-and-forget, never blocks profile creation
  const _API = API_BASE_URL;

// Top-level backend URL — single source of truth (used by invite, notify, email functions)
const BACKEND_URL = API_BASE_URL;
  try {
    const { getAuth } = await import("firebase/auth");
    const _tok = await getAuth().currentUser?.getIdToken?.();
    if (_tok) {
      fetch(`${_API}/user/onboard`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${_tok}`, "Content-Type": "application/json" },
      }).catch(() => {});
    }
  } catch (_) {}

  return profile;
}

// ── Referral ──────────────────────────────────────────────────────
export async function applyReferralCredit(referrerUid, newUserUid, newUserEmail) {
  const q = query(collection(db,"users"), where("uid","==",referrerUid), limit(1));
  const snaps = await getDocs(q);
  if (snaps.empty) return { ok:false };
  const referrerDoc = snaps.docs[0];
  const referrer    = referrerDoc.data();
  const existQ = query(collection(db,"referrals"), where("referred_uid","==",newUserUid), limit(1));
  const existing = await getDocs(existQ);
  if (!existing.empty) return { ok:false, reason:"Already credited" };
  const batch = writeBatch(db);
  batch.set(doc(collection(db,"referrals")), {
    referrer_uid: referrerUid, referrer_email: referrer.email||"",
    referred_uid: newUserUid, referred_email: newUserEmail,
    status: "pending", discount_pct: 20, commission_egp: 0,
    created_at: _serverTimestamp(),
  });
  batch.update(doc(db,"users",referrerDoc.id), { referral_count: increment(1), updated_at: _serverTimestamp() });
  await batch.commit();
  return { ok:true, discount_pct:20 };
}

export async function convertReferral(newUserUid, amountPaid) {
  const q = query(collection(db,"referrals"), where("referred_uid","==",newUserUid), where("status","==","pending"), limit(1));
  const snaps = await getDocs(q);
  if (snaps.empty) return;
  const refDoc = snaps.docs[0]; const referral = refDoc.data();
  const commission = Math.round(amountPaid * 0.10);
  const batch = writeBatch(db);
  batch.update(doc(db,"referrals",refDoc.id), { status:"converted", commission_egp:commission, converted_at:_serverTimestamp() });
  batch.update(doc(db,"users",referral.referrer_uid), { referral_credits:increment(commission), updated_at:_serverTimestamp() });
  await batch.commit();
}

export async function getReferralStats(uid) {
  const q = query(collection(db,"referrals"), where("referrer_uid","==",uid), orderBy("created_at","desc"), limit(50));
  const snaps = await getDocs(q);
  const refs  = snaps.docs.map(d=>({id:d.id,...d.data()}));
  return { total:refs.length, converted:refs.filter(r=>r.status==="converted").length,
           pending:refs.filter(r=>r.status==="pending").length,
           earned:refs.reduce((a,r)=>a+(r.commission_egp||0),0), referrals:refs };
}

export async function getReferralDiscount(referralCode) {
  if (!referralCode) return null;
  const q = query(collection(db,"users"), where("referral_code","==",referralCode), limit(1));
  const snaps = await getDocs(q);
  if (snaps.empty) return null;
  return { discount_pct:20, referrer_uid:snaps.docs[0].data().uid };
}

// ── Email Nurture ─────────────────────────────────────────────────
// session guard: prevents running more than once per browser session per uid
const _nurtureRan = new Set();

export async function checkAndSendNurtureEmails(uid, profile, apiUrl) {
  if (!profile?.is_trial) return;
  if (_nurtureRan.has(uid)) return; // already ran this session
  _nurtureRan.add(uid);

  const created   = profile.created_at?.toDate?.() || new Date();
  const daysSince = Math.floor((Date.now() - created) / 86400000);
  const send = async (day, flag) => {
    if (profile[flag]) return; // already sent (Firestore flag)
    try {
      await fetch(`${apiUrl}/email/sequence`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ email:profile.email, name:profile.name||"there",
          day, avg_score:profile.avg_score||0, session_count:profile.sessions_count||0,
          tier:profile.tier||"professional",
          upgrade_url:`${window.location.origin}?plan=professional` }),
      });
      await updateDoc(doc(db,"users",uid), { [flag]:true, updated_at:_serverTimestamp() });
    } catch(e) { console.warn(`Email day ${day}:`, e); }
  };
  if (daysSince>=2)  await send(2,  "email_day2_sent");
  if (daysSince>=5)  await send(5,  "email_day5_sent");
  if (daysSince>=6)  await send(6,  "email_day6_sent");
  if (daysSince>=7)  await send(7,  "email_day7_sent");
  if (daysSince>=21) await send(21, "email_week3_sent");
}

// ── Trial ─────────────────────────────────────────────────────────
export async function checkAndDowngradeTrial(uid) {
  try {
    const snap = await getDoc(doc(db,"users",uid));
    if (!snap.exists()) return null;
    // Same shape + elite elevation as getUserProfile — App.jsx replaces the
    // profile state with this return value, so a raw doc here silently
    // stripped the elevation and locked Elite features right after login.
    const data = _applyEliteElevation({ id: snap.id, ...snap.data() });
    if (!data.is_trial) return data;
    const expires = data.trial_expires_at?.toDate?.() || new Date(0);
    if (new Date() > expires) {
      // End the trial experience, but NEVER wipe a paid/elevated tier —
      // a stale is_trial flag on an elite/professional account must not
      // hard-downgrade it to standard.
      const stored   = String(data.tier||"standard").toLowerCase();
      const keepTier = !["standard","basic",""].includes(stored);
      const newTier  = _shouldElevateToElite(data.email) ? "elite" : (keepTier ? data.tier : "standard");
      await updateDoc(doc(db,"users",uid), { tier:newTier, is_trial:false, trial_expires_at:null, updated_at:_serverTimestamp() });
      return { ...data, tier:newTier, is_trial:false, trial_expires_at:null };
    }
    return data;
  } catch(e) { return null; }
}

// ── Calibration ───────────────────────────────────────────────────
export async function saveCalibration(uid, calibData) {
  await setDoc(doc(db,"calibrations",uid), { uid, ...calibData, calibrated_at:_serverTimestamp() });
}
export async function getCalibration(uid) {
  const snap = await getDoc(doc(db,"calibrations",uid));
  return snap.exists() ? snap.data() : null;
}

// ── User CRUD ─────────────────────────────────────────────────────
// ── Elite email/domain elevation — mirrors backend/auth/middleware.py ──
// Keep in sync with ELITE_EMAILS + ELITE_DOMAINS in middleware.py
const _ELITE_EMAILS = [
  "judyayman36@gmail.com",
  "m789pppp@gmail.com",
  // add individual emails here as needed
];
const _ELITE_DOMAINS = [
  "coventry.ac.uk", "coventry-university.ac.uk",
  "city.ac.uk", "tkh.edu.eg",
];
function _shouldElevateToElite(email) {
  if (!email) return false;
  const em = email.trim().toLowerCase();
  if (_ELITE_EMAILS.includes(em)) return true;
  const domain = em.includes("@") ? em.split("@").pop() : "";
  return _ELITE_DOMAINS.some(d => domain === d || domain.endsWith("." + d));
}

// Client-side elite elevation — mirrors backend middleware.
// Only elevates UP, never downgrades a paying user. Every function that
// returns a profile doc to the app MUST pass it through here, otherwise
// setProfile() with the raw doc strips Elite from elevated accounts.
function _applyEliteElevation(data) {
  if (!data) return data;
  const TIER_LEVEL = { standard:0, basic:1, professional:2, elite:3 };
  if (_shouldElevateToElite(data.email || "")) {
    const current = TIER_LEVEL[String(data.tier||"standard").toLowerCase()] ?? 0;
    if (current < 3) {
      data.tier = "elite";
      data.is_trial = false;
    }
  }
  return data;
}

export const getUserProfile = async (uid) => {
  const s = await getDoc(doc(db, "users", uid));
  if (!s.exists()) return null;
  return _applyEliteElevation({ id: s.id, ...s.data() });
};
export const updateUserProfile = async (uid, data) => {
  // Strip ALL protected fields that Firestore rules block client from changing
  const { is_admin, tier, is_hr, is_org_owner, user_type, company_id, uid: _uid, email: _email, ...safe } = data;
  const payload = { ...safe, updated_at: _serverTimestamp() };
  try {
    // updateDoc fails if doc doesn't exist — setDoc merge always works
    return await updateDoc(doc(db,"users",uid), payload);
  } catch(err) {
    if(err?.code === "not-found") {
      // Doc doesn't exist yet — create it
      return setDoc(doc(db,"users",uid), payload, { merge: true });
    }
    throw err;
  }
};
export const completeOnboardingStep = async (uid, step) => {
  const snap = await getDoc(doc(db,"users",uid));
  if (!snap.exists()) return;
  const done = snap.data().onboarding_done||[];
  if (!done.includes(step)) await updateDoc(doc(db,"users",uid),{onboarding_done:[...done,step],updated_at:_serverTimestamp()});
};

export async function updateUserTier(uid, tier, months) {
  const expires = months ? new Date(Date.now() + months*30*24*3600*1000) : null;
  await updateDoc(doc(db,"users",uid), { tier, is_trial:false, ...(expires?{tier_expires:expires}:{}), updated_at:_serverTimestamp() });
}

// ── Sessions ──────────────────────────────────────────────────────
export async function saveSession(uid, data) {
  // Compute the true lifetime session number BEFORE creating the doc.
  // Previously this was computed after creation from userSessions array
  // (50-doc cap, sorted newest-first) so the most recent session was
  // labeled "#1" and froze at "#51" for long-time users.
  let newCount = 1, prof = null;
  try {
    prof = await getUserProfile(uid);
    newCount = (prof?.sessions_count||0)+1;
  } catch(e) { console.warn("saveSession profile read:", e.code||e.message); }

  const ref = await addDoc(collection(db,"sessions"), {
    uid, ...data, session_number: newCount, created_at:_serverTimestamp(),
  });
  try {
    const newAvg   = Math.round(((prof?.avg_score||0)*(newCount-1)+(data.avg_score||0))/newCount);
    const streak   = prof?.last_session_at ? (() => {
      const last = prof.last_session_at.toDate ? prof.last_session_at.toDate() : new Date(prof.last_session_at);
      return (Date.now()-last.getTime()) < 1.5*86400000 ? (prof.streak_days||0)+1 : 1;
    })() : 1;
    // setDoc merge — works even if user doc doesn't exist yet
    await setDoc(doc(db,"users",uid), {
      sessions_count: newCount, avg_score: newAvg, streak_days: streak,
      last_session_at: _serverTimestamp(), updated_at: _serverTimestamp(),
    }, { merge: true });
  } catch(e) { console.warn("saveSession stats:", e.code||e.message); }
  return ref.id;
}

export async function getUserSessions(uid) {
  // Simple query — no orderBy, no composite index needed
  // Sort client-side instead
  const q = query(
    collection(db,"sessions"),
    where("uid","==",uid),
    limit(50)
  );
  const snaps = await getDocs(q);
  return snaps.docs
    .map(d=>({id:d.id,...d.data()}))
    .sort((a,b)=>{
      const ta = a.created_at?.toDate?.()?.getTime?.() ?? a.created_at?.seconds*1000 ?? 0;
      const tb = b.created_at?.toDate?.()?.getTime?.() ?? b.created_at?.seconds*1000 ?? 0;
      return tb - ta;
    });
}

export async function deleteSession(sessionId) {
  await deleteDoc(doc(db, "sessions", sessionId));
}

// Real-time listener version — keeps sessions always fresh
export function onUserSessions(uid, callback) {
  const q = query(
    collection(db,"sessions"),
    where("uid","==",uid),
    limit(50)
  );
  return onSnapshot(q, snap => {
    const sessions = snap.docs
      .map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>{
        const ta = a.created_at?.toDate?.()?.getTime?.() ?? a.created_at?.seconds*1000 ?? 0;
        const tb = b.created_at?.toDate?.()?.getTime?.() ?? b.created_at?.seconds*1000 ?? 0;
        return tb - ta;
      });
    callback(sessions);
  }, err => {
    console.warn("onUserSessions error:", err.code);
  });
}

// ── Departments (isolated) ────────────────────────────────────────
export async function getDepartments(companyId) {
  const q = query(collection(db,"departments"), where("company_id","==",companyId));
  const snaps = await getDocs(q);
  return snaps.docs.map(d=>({id:d.id,...d.data()}));
}
export const createDepartment  = async (data) => { const r=await addDoc(collection(db,"departments"),{...data,created_at:_serverTimestamp()}); return r.id; };
export const deleteDepartment  = async (did) => deleteDoc(doc(db,"departments",did));

export async function getDepartmentEmployees(companyId, departmentId) {
  const constraints = [where("company_id","==",companyId)];
  if (departmentId && departmentId!=="all") constraints.push(where("department_id","==",departmentId));
  const q = query(collection(db,"users"), ...constraints, orderBy("name","asc"), limit(500));
  const snaps = await getDocs(q);
  return snaps.docs.map(d=>({id:d.id,...d.data()}));
}

// ── Payments ──────────────────────────────────────────────────────
export async function recordPayment(uid, data) {
  const ref = await addDoc(collection(db,"payments"), { uid,...data,status:"pending",created_at:_serverTimestamp(),updated_at:_serverTimestamp() });
  return ref.id;
}
export async function confirmPayment(paymentId, uid, tier, months) {
  await updateDoc(doc(db,"payments",paymentId), { status:"confirmed", confirmed_at:_serverTimestamp(), updated_at:_serverTimestamp() });
  await updateUserTier(uid, tier, months);
  try { const p=(await getDoc(doc(db,"payments",paymentId))).data(); await convertReferral(uid, p?.amount||0); } catch(e){}
}
export async function rejectPayment(paymentId, reason) {
  await updateDoc(doc(db,"payments",paymentId), { status:"rejected", reject_reason:reason||"Not verified", rejected_at:_serverTimestamp(), updated_at:_serverTimestamp() });
}
export const listenToPayment = (paymentId, cb) => onSnapshot(doc(db,"payments",paymentId), snap=>{ if(snap.exists()) cb({id:snap.id,...snap.data()}); });

export async function getAllPayments(statusFilter, dateFrom, dateTo) {
  let q = statusFilter && statusFilter!=="all"
    ? query(collection(db,"payments"), where("status","==",statusFilter), orderBy("created_at","desc"), limit(300))
    : query(collection(db,"payments"), orderBy("created_at","desc"), limit(300));
  let payments = (await getDocs(q)).docs.map(d=>({id:d.id,...d.data()}));
  if (dateFrom) { const f=new Date(dateFrom); payments=payments.filter(p=>p.created_at?.toDate?.()>=f); }
  if (dateTo)   { const t=new Date(dateTo); t.setHours(23,59,59); payments=payments.filter(p=>p.created_at?.toDate?.()<=t); }
  return payments;
}
export async function getPaymentHistory(uid) {
  const q = query(collection(db,"payments"), where("uid","==",uid), orderBy("created_at","desc"), limit(20));
  return (await getDocs(q)).docs.map(d=>({id:d.id,...d.data()}));
}

// ── Admin ─────────────────────────────────────────────────────────
export async function getAllUsers(companyId = null) {
  // SECURITY: always scope by company_id unless caller is platform admin
  const q = companyId
    ? query(collection(db,"users"), where("company_id","==",companyId), orderBy("created_at","desc"), limit(500))
    : query(collection(db,"users"), orderBy("created_at","desc"), limit(500));
  const snaps = await getDocs(q);
  return snaps.docs.map(d=>({id:d.id,...d.data()}));
}

// ── Companies ─────────────────────────────────────────────────────
export async function createCompany(uid, data) {
  const ref = await addDoc(collection(db,"companies"), { admin_uid:uid,...data,created_at:_serverTimestamp() });
  await updateDoc(doc(db,"users",uid), { company_id:ref.id, updated_at:_serverTimestamp() });
  return ref.id;
}
export async function getCompany(cid) {
  if (!cid) return null;
  const snap = await getDoc(doc(db,"companies",cid));
  return snap.exists()?{id:snap.id,...snap.data()}:null;
}
export const updateCompany = async (cid,data) => updateDoc(doc(db,"companies",cid),{...data,updated_at:_serverTimestamp()});

// ── Invites ───────────────────────────────────────────────────────
export async function bulkInviteEmployees(employees, companyId, invitedBy) {
  const results = [];
  for (const emp of employees) {
    try {
      // 1. Create invite record in Firestore
      const ref = await addDoc(collection(db,"invites"), {
        ...emp,
        company_id:  companyId,
        invited_by:  invitedBy,
        status:      "pending",
        created_at:  _serverTimestamp(),
      });
      const inviteId = ref.id;

      // 2. Trigger backend to send invite email (fire-and-forget)
      const inviteUrl = `${window.location.origin}?invite=${inviteId}`;
      const tok = auth.currentUser ? await auth.currentUser.getIdToken(false).catch(()=>null) : null;
      fetch(`${BACKEND_URL}/org/send-invite`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body:    JSON.stringify({ invite_id: inviteId, email: emp.email, name: emp.name, company_id: companyId, invite_url: inviteUrl }),
      }).catch(() => {}); // non-blocking

      results.push({ ...emp, invite_id: inviteId, ok: true });
    } catch(e) {
      results.push({ ...emp, ok: false, error: e.message });
    }
  }
  return results;
}

// ── Auth token helper ──────────────────────────────────────────────
export async function getAuthToken() {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken(false);
  } catch {
    return null;
  }
}

// ── Backend triggers ──────────────────────────────────────────────
async function _authHeader() {
  try {
    const token = await auth.currentUser?.getIdToken();
    return token ? { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
  } catch { return { "Content-Type": "application/json" }; }
}

export async function notifyPaymentPending(data)   { try { await fetch(`${BACKEND_URL}/notify/payment`,  {method:"POST",headers:await _authHeader(),body:JSON.stringify(data)}); } catch(e){} }
export async function notifyPaymentConfirmed(data) { try { await fetch(`${BACKEND_URL}/notify/confirmed`,{method:"POST",headers:await _authHeader(),body:JSON.stringify(data)}); } catch(e){} }

/**
 * sendWeeklyProgressEmails — sends a weekly posture report email via backend.
 * Called from HRPanel to trigger progress emails for department employees.
 * @param {Object} params - { email, name, score_this_week, score_last_week, sessions_count, streak, insights, lang, new_achievements }
 * @returns {Promise<{ok: boolean}>}
 */
export async function sendWeeklyProgressEmails(params) {
  try {
    const headers = await _authHeader();
    const res = await fetch(`${BACKEND_URL}/email/weekly-progress`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("[sendWeeklyProgressEmails] backend error:", err);
      return { ok: false, error: err?.error || `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (e) {
    console.warn("[sendWeeklyProgressEmails] fetch error:", e.message);
    return { ok: false, error: e.message };
  }
}

// ── Demo Data Seeder ──────────────────────────────────────────────
export async function seedDemoUser(uid, type) {
  const base = {
    updated_at: _serverTimestamp(),
    setup_complete: true,
    last_session_at: _serverTimestamp(),
  };

  if (type === "individual") {
    // 12 demo sessions
    const sessions = [];
    for (let i = 11; i >= 0; i--) {
      const score = Math.round(65 + Math.random() * 25);
      const d = new Date(); d.setDate(d.getDate() - i);
      sessions.push({
        uid, avg_score: score, duration_sec: 1200 + Math.round(Math.random()*1800),
        created_at: d, feedback: score > 80 ? "great" : score > 65 ? "good" : "needs_work",
      });
    }
    for (const s of sessions) {
      await import("firebase/firestore").then(({addDoc,collection}) =>
        addDoc(collection(db,"sessions"), s).catch(()=>{})
      );
    }
    const scores = sessions.map(s=>s.avg_score||0).filter(n=>n>0);
    const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    await import("firebase/firestore").then(({updateDoc,doc:_doc}) =>
      updateDoc(_doc(db,"users",uid), { ...base, avg_score:avg, sessions_count:12, streak_days:5 }).catch(()=>{})
    );
  }

  if (type === "hr_admin") {
    // 5 demo employees
    const employees = [
      { name:"Ahmed Hassan",    email:"ahmed@democorp.com",   department:"Engineering", avg_score:82, sessions_count:18 },
      { name:"Sara Mohamed",    email:"sara@democorp.com",    department:"Design",      avg_score:71, sessions_count:9  },
      { name:"Omar Khalil",     email:"omar@democorp.com",    department:"Engineering", avg_score:44, sessions_count:3  },
      { name:"Nada Youssef",    email:"nada@democorp.com",    department:"Marketing",   avg_score:88, sessions_count:22 },
      { name:"Karim Farouk",    email:"karim@democorp.com",   department:"Sales",       avg_score:55, sessions_count:6  },
    ];
    const companyRef = await import("firebase/firestore").then(({addDoc,collection}) =>
      addDoc(collection(db,"companies"), {
        name:"Corvus Demo Co.", owner_uid:uid, tier:"professional",
        created_at:_serverTimestamp(), employee_count:employees.length,
      }).catch(()=>({id:"demo-co"}))
    );
    const companyId = companyRef?.id || "demo-co";
    for (const emp of employees) {
      await import("firebase/firestore").then(({addDoc,collection}) =>
        addDoc(collection(db,"users"), {
          ...emp, company_id:companyId, user_type:"employee",
          is_active:true, created_at:_serverTimestamp(),
          last_session_at:_serverTimestamp(),
        }).catch(()=>{})
      );
    }
    await import("firebase/firestore").then(({updateDoc,doc:_doc}) =>
      updateDoc(_doc(db,"users",uid), {
        ...base, company_id:companyId, company:"Corvus Demo Co.",
        user_type:"hr_admin", is_org_owner:true, tier:"professional",
        avg_score:68, sessions_count:3, streak_days:1,
      }).catch(()=>{})
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// METRIC LABEL MAP — human-readable labels for every engine key
// ─────────────────────────────────────────────────────────────────
const METRIC_LABELS = {
  neck_lean:      "Neck Lean",
  neck_lean_side: "Neck Lean (Side)",
  head_tilt:      "Head Tilt",
  head_yaw:       "Head Rotation",
  shoulder:       "Shoulder Balance",
  spine_lean:     "Spine Lean",
  spine_align:    "Spine Alignment",
  fhp:            "Forward Head Posture",
  fhp_side:       "Forward Head (Side)",
  rounded:        "Rounded Shoulders",
  elbow:          "Elbow Angle",
  monitor:        "Monitor Height",
  distance:       "Viewing Distance",
  trunk_lean:     "Trunk Lean",
  hip_angle:      "Hip Angle",
  knee_angle:     "Knee Angle",
};
const METRIC_LABELS_AR = {
  neck_lean:      "ميل الرقبة",
  neck_lean_side: "ميل الرقبة (جانبي)",
  head_tilt:      "انحناء الرأس",
  head_yaw:       "دوران الرأس",
  shoulder:       "توازن الكتفين",
  spine_lean:     "ميل العمود الفقري",
  spine_align:    "محاذاة العمود الفقري",
  fhp:            "تقدم الرأس للأمام",
  fhp_side:       "تقدم الرأس (جانبي)",
  rounded:        "تقريس الأكتاف",
  elbow:          "زاوية الكوع",
  monitor:        "ارتفاع الشاشة",
  distance:       "مسافة المشاهدة",
  trunk_lean:     "ميل الجذع",
  hip_angle:      "زاوية الورك",
  knee_angle:     "زاوية الركبة",
};

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// CORVUS PDF DESIGN SYSTEM v5 — World-Class Medical Intelligence
// Philosophy: Apple Health × Bloomberg Terminal × WHO Medical Reports
// Every component is purpose-built. Nothing is decorative without meaning.
// ═══════════════════════════════════════════════════════════════════

// ── Extended Design Tokens ─────────────────────────────────────────
const FB_TOKENS = {
  // Core brand
  primary:   [37,99,235],   primaryDk:[30,64,175],  primaryLt:[239,246,255],
  success:   [34,197,94],   successDk:[21,128,61],  successLt:[240,253,244],
  warning:   [245,158,11],  warningDk:[180,83,9],   warningLt:[255,251,235],
  danger:    [239,68,68],   dangerDk:[185,28,28],   dangerLt:[254,242,242],
  // Neutrals — editorial grade
  ink:       [11,17,32],    ink2:[24,33,54],   sub:[44,55,82],
  muted:     [96,108,135],  light:[152,165,190], ghost:[210,218,235],
  // Surfaces
  bg:        [247,249,252], bgAlt:[242,245,251], bgDeep:[236,240,248],
  card:      [255,255,255], cardHover:[252,253,255],
  border:    [224,229,240], borderSoft:[237,240,248], borderStrong:[196,206,224],
  // Dark surfaces (cover pages)
  slate:     [10,17,35],    slateM:[18,28,52],  slateLt:[28,40,70],
  slateAccent:[38,55,95],
  // Semantic tints
  successBg: [220,252,231], dangerBg:[254,226,226], warningBg:[254,243,199], primaryBg:[219,234,254],
  // Medical spectrum
  riskLow:   [16,185,129],  riskMed:[245,158,11],  riskHigh:[239,68,68],
  // Data viz palette
  indigo:    [99,102,241],  violet:[139,92,246],
  cyan:      [6,182,212],   teal:[20,184,166],
  rose:      [244,63,94],   amber:[251,191,36],
  // Elevation (for layering effect simulation)
  elev1:     [250,251,255], elev2:[245,247,254], elev3:[240,244,252],
};

// ── Typography Scale — 8pt baseline grid ──────────────────────────
const FB_FLAGS = {
  display:   28,   // Hero numbers, cover title
  h1:        17,   // Page section title
  h2:        13,   // Subsection
  h3:        10.5, // Card title
  body:       9,   // Body text
  small:      7.5, // Labels, captions
  micro:      6,   // Footnotes, page refs
  data:      11,   // Data numbers (tabular)
  dataLg:    18,   // Large KPI numbers
  dataXl:    26,   // Hero scores
};

// ── Spacing — 8pt grid ────────────────────────────────────────────
const SP = { xs:2, sm:4, md:8, lg:12, xl:20, xxl:32, page:18 };


// ── Core helpers ───────────────────────────────────────────────────
function _sc(s){ return s>=80?FB_TOKENS.success:s>=60?FB_TOKENS.warning:FB_TOKENS.danger; }
function _scLt(s){ return s>=80?FB_TOKENS.successLt:s>=60?FB_TOKENS.warningLt:FB_TOKENS.dangerLt; }
function _sl(s,ar){ return s>=80?(ar?"ممتاز":"Excellent"):s>=60?(ar?"جيد":"Good"):(ar?"يحتاج تحسين":"Needs Work"); }
function _riskLabel(v,ar){ return v>=70?(ar?"عالي":"High"):v>=40?(ar?"متوسط":"Moderate"):(ar?"منخفض":"Low"); }
function _riskColor(v){ return v>=70?FB_TOKENS.danger:v>=40?FB_TOKENS.warning:FB_TOKENS.success; }
function _fmtDur(s){ if(!s)return"—"; const m=Math.floor(s/60),r=s%60; return m>0?`${m}m ${r}s`:`${r}s`; }
function _fmtDate(ts,ar){
  if(!ts)return"—";
  try{ const d=ts?.toDate?ts.toDate():new Date(ts);
    return d.toLocaleDateString(ar?"ar-EG":"en-US",{year:"numeric",month:"short",day:"numeric"}); }
  catch{return"—";}
}
function _fmtDateLong(ts,ar){
  if(!ts)return"—";
  try{ const d=ts?.toDate?ts.toDate():new Date(ts);
    return d.toLocaleDateString(ar?"ar-EG":"en-US",{year:"numeric",month:"long",day:"numeric"}); }
  catch{return"—";}
}
const _gc = _sc; // legacy alias
const _gl = _sl; // legacy alias

// ── Draw primitives ────────────────────────────────────────────────
function dc(doc,...c){doc.setDrawColor(...c);}
function fc(doc,...c){doc.setFillColor(...c);}
function tc(doc,...c){doc.setTextColor(...c);}
function lw(doc,w){doc.setLineWidth(w);}
function rr(doc,x,y,w,h,r=3,m="F"){doc.roundedRect(x,y,w,h,r,r,m);}
function hr(doc,x,y,w,col=FB_TOKENS.border,thickness=0.18){dc(doc,...col);lw(doc,thickness);doc.line(x,y,x+w,y);lw(doc,0.3);}
function vl(doc,x,y,h,col=FB_TOKENS.border){dc(doc,...col);lw(doc,0.18);doc.line(x,y,x,y+h);lw(doc,0.3);}

// ── Font helper ────────────────────────────────────────────────────
let _cairoLoaded=false, _cairoCachedB64=null;
async function _ensureCairoFont(doc){
  try{
    if(!_cairoCachedB64){const{CAIRO_B64}=await import("./assets/cairoFont.js");_cairoCachedB64=CAIRO_B64;}
    doc.addFileToVFS("Cairo-Regular.ttf",_cairoCachedB64);
    doc.addFont("Cairo-Regular.ttf","cairo","normal");
    doc.addFileToVFS("Cairo-Bold.ttf",_cairoCachedB64);
    doc.addFont("Cairo-Bold.ttf","cairo","bold");
    _cairoLoaded=true;
  }catch(e){console.warn("Cairo font failed:",e?.message||e);}
}
async function _loadCairo(doc){await _ensureCairoFont(doc);return _cairoLoaded;}

function font(doc,size,style="normal",isAr=false){
  doc.setFont(isAr&&_cairoLoaded?"cairo":"helvetica",style);
  doc.setFontSize(size);
}
function fontAr(doc,size,style="normal",useAr=false){
  doc.setFont(useAr&&_cairoLoaded?"cairo":"helvetica",style);
  doc.setFontSize(size);
}

// ── Logo ───────────────────────────────────────────────────────────
let _logoSm=null,_logoMd=null,_logoLg=null;
async function _ensureLogo(){
  if(_logoSm)return;
  try{const{LOGO_SM_B64,LOGO_MD_B64,LOGO_LG_B64}=await import("./assets/corvusLogo.js");
    _logoSm=LOGO_SM_B64;_logoMd=LOGO_MD_B64;_logoLg=LOGO_LG_B64;}
  catch(e){console.warn("Logo load failed:",e);}
}
function _logo(doc,x,y,sz,b64){
  if(b64){try{doc.addImage(b64,"PNG",x,y,sz,sz);return;}catch{}}
  fc(doc,3,11,20);rr(doc,x,y,sz,sz,sz*.14,"F");
  fc(doc,...FB_TOKENS.primary);rr(doc,x+sz*.19,y+sz*.19,sz*.62,sz*.62,sz*.12,"F");
  font(doc,sz*.42,"bold");tc(doc,...FB_TOKENS.card);doc.text("P",x+sz/2,y+sz*.72,{align:"center"});
}

// ── _zonalRisk ─────────────────────────────────────────────────────
function _zonalRisk(metrics){
  if(!metrics) return{cervical:0,thoracic:0,lumbar:0};
  const sc=k=>typeof metrics[k]==="number"?metrics[k]:(metrics[k]?.score??100);
  return{
    cervical:Math.round(100-Math.min(100,(sc("neck_lean")+sc("head_tilt")+sc("head_yaw"))/3)),
    thoracic:Math.round(100-Math.min(100,(sc("shoulder")+sc("rounded_shoulders")+sc("spine_lean"))/3)),
    lumbar:  Math.round(100-Math.min(100,(sc("spine_align")+sc("hip_angle")+sc("trunk_lean"))/3)),
  };
}

// ══════════════════════════════════════════════════════════════════
// v5 PREMIUM COMPONENTS
// ══════════════════════════════════════════════════════════════════

// ── COVER HEADER — cinematic dark with brand gradient ─────────────
function _coverV5(doc,W,ml,tier,tierCol,name,label,sub,now){
  // Full bleed dark
  fc(doc,...FB_TOKENS.slate);doc.rect(0,0,W,76,"F");
  // Layered depth circles (brand feel)
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.05}));
  doc.circle(W*.88,38,68,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.03}));
  doc.circle(W*.88,38,90,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.015}));
  doc.circle(W*.88,38,112,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Top accent
  fc(doc,...tierCol);doc.rect(0,0,W,2.5,"F");
  // Logo
  _logo(doc,ml,16,28,_logoMd);
  // Brand
  font(doc,13.5,"bold");tc(doc,...FB_TOKENS.card);doc.text("CORVUS",ml+36,30);
  font(doc,6.5,"normal");tc(doc,130,148,180);doc.text("Health Intelligence Platform",ml+36,38);
  // Tier badge
  const tw=doc.getTextWidth(tier.toUpperCase())+12;
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.16}));
  rr(doc,ml+36,43,tw,10,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,7,"bold");tc(doc,...tierCol);
  doc.text(tier.toUpperCase(),ml+36+tw/2,49.5,{align:"center"});
  // Right: date + label
  font(doc,6.5,"normal");tc(doc,130,148,180);doc.text(now,W-ml,27,{align:"right"});
  font(doc,7.5,"bold");tc(doc,...FB_TOKENS.card);doc.text(label,W-ml,37,{align:"right"});
  if(sub){font(doc,6.5,"normal");tc(doc,130,148,180);doc.text(sub,W-ml,45,{align:"right"});}
  // Bottom divider
  fc(doc,...tierCol);doc.rect(0,73.5,W,2.5,"F");
}

// ── INNER PAGE HEADER ──────────────────────────────────────────────
function _hdr(doc,W,ml,mr,label,isAr){
  fc(doc,...FB_TOKENS.bg);doc.rect(0,0,W,15,"F");
  fc(doc,...FB_TOKENS.primary);doc.rect(0,15,W,.35,"F");
  _logo(doc,ml,3.5,8,_logoSm);
  font(doc,7.5,"bold");tc(doc,...FB_TOKENS.ink2);doc.text("Corvus",ml+12,10);
  font(doc,6.5,"normal");tc(doc,...FB_TOKENS.muted);doc.text("Health Intelligence",ml+28,10);
  font(doc,7,"bold");tc(doc,...FB_TOKENS.primary);doc.text(label,W-mr,10,{align:"right"});
}

// ── FOOTER ─────────────────────────────────────────────────────────
function _ftr(doc,W,ml,mr,H,p,total,name){
  hr(doc,0,H-10,W,FB_TOKENS.border);
  fc(doc,...FB_TOKENS.bg);doc.rect(0,H-9.5,W,9.5,"F");
  font(doc,FB_FLAGS.micro,"normal");tc(doc,...FB_TOKENS.ghost);
  doc.text("Corvus Health Intelligence · Confidential · Not a medical diagnosis",ml,H-3.5);
  font(doc,FB_FLAGS.micro,"bold");tc(doc,...FB_TOKENS.muted);
  doc.text(name,W/2,H-3.5,{align:"center"});
  doc.text(`${p} / ${total}`,W-mr,H-3.5,{align:"right"});
}

// ── SECTION HEADING with left accent ─────────────────────────────
function _sh(doc,ml,y,title,sub="",col=FB_TOKENS.primary,isAr=false){
  fc(doc,...col);doc.rect(ml,y,2.2,sub?14:9.5,"F");
  font(doc,FB_FLAGS.h2,"bold",isAr);tc(doc,...FB_TOKENS.ink);doc.text(title,ml+7,y+(sub?7:7));
  if(sub){font(doc,FB_FLAGS.small,"normal",isAr);tc(doc,...FB_TOKENS.light);doc.text(sub,ml+7,y+13);}
  return y+(sub?21:14);
}

// ── SCORE RING v5 — with inner glow simulation ─────────────────────
function _ring(doc,cx,cy,r,score,isAr,showGrade=true){
  const col=_sc(score),lbl=_sl(score,isAr);
  // Outer track
  dc(doc,...FB_TOKENS.borderSoft);lw(doc,3.5);doc.circle(cx,cy,r,"S");lw(doc,0.3);
  // Inner tint
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.06}));
  doc.circle(cx,cy,r-2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Score arc
  dc(doc,...col);lw(doc,3.5);doc.circle(cx,cy,r,"S");lw(doc,0.3);
  // Number
  font(doc,FB_FLAGS.dataXl,"bold");tc(doc,...col);
  doc.text(String(score),cx,cy+4,{align:"center"});
  font(doc,FB_FLAGS.micro+.5,"normal");tc(doc,...FB_TOKENS.muted);
  doc.text("/100",cx,cy+10,{align:"center"});
  if(showGrade){font(doc,FB_FLAGS.small+.5,"bold",isAr);tc(doc,...col);doc.text(lbl,cx,cy+r+8,{align:"center"});}
}

// ── METRIC ROW v5 ─────────────────────────────────────────────────
function _mRow(doc,x,y,w,lbl,value,unit,score,isAr,idx=0){
  const col=_sc(score),colLt=_scLt(score),h=22;
  fc(doc,...(idx%2===0?FB_TOKENS.card:FB_TOKENS.bg));rr(doc,x,y,w,h,3,"F");
  dc(doc,...FB_TOKENS.borderSoft);lw(doc,0.15);rr(doc,x,y,w,h,3,"S");lw(doc,0.3);
  // Left accent
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  // Score chip
  fc(doc,...colLt);rr(doc,x+6,y+5,16,12,2,"F");
  font(doc,8.5,"bold");tc(doc,...col);
  doc.text(String(Math.round(score)),x+14,y+12.5,{align:"center"});
  // Label
  font(doc,9,"bold",isAr);tc(doc,...FB_TOKENS.ink);doc.text(lbl,x+27,y+9.5);
  // Value
  if(value!==undefined&&value!==null){
    font(doc,7.5,"normal");tc(doc,...FB_TOKENS.muted);
    doc.text(`${Math.round(value*10)/10}${unit||""}`,x+27,y+16.5);
  }
  // Progress bar
  const bx=x+w*.52,bw=w*.44,bh=5;
  fc(doc,...FB_TOKENS.borderSoft);rr(doc,bx,y+8.5,bw,bh,2,"F");
  fc(doc,...col);rr(doc,bx,y+8.5,Math.max(bw*(score/100),3),bh,2,"F");
  // Grade
  const gl=_sl(score,isAr);
  const gw=doc.getTextWidth(gl)+7;
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.1}));
  rr(doc,x+w-gw-3,y+14.5,gw,6,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,FB_FLAGS.micro+.5,"bold",isAr);tc(doc,...col);
  doc.text(gl,x+w-gw/2-3,y+18.5,{align:"center"});
}

// ── KPI CHIP v5 — elevated with top accent ─────────────────────────
function _kpi(doc,x,y,w,h,val,label,col,sub=""){
  fc(doc,...FB_TOKENS.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...FB_TOKENS.border);lw(doc,0.15);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  // Top color accent
  fc(doc,...col);rr(doc,x,y,w,3,2,"F");doc.rect(x,y+1.5,w,1.5,"F");
  // Value
  font(doc,FB_FLAGS.dataLg,"bold");tc(doc,...col);
  doc.text(String(val),x+w/2,y+h*.56,{align:"center"});
  // Label
  font(doc,FB_FLAGS.small,"bold");tc(doc,...FB_TOKENS.muted);
  doc.text(label,x+w/2,y+h*.78,{align:"center"});
  if(sub){font(doc,FB_FLAGS.micro,"normal");tc(doc,...FB_TOKENS.light);doc.text(sub,x+w/2,y+h*.9,{align:"center"});}
}

// ── SPARKLINE v5 ─────────────────────────────────────────────────
function _spark(doc,hist,x,y,w,h,col){
  const pts=hist.length>80?hist.filter((_,i)=>i%Math.ceil(hist.length/80)===0):hist;
  if(pts.length<2)return;
  const lo=Math.max(0,Math.min(...pts)-5),hi=Math.min(100,Math.max(...pts)+5);
  const rng=Math.max(hi-lo,10);
  const co=pts.map((s,i,a)=>({px:x+(i/Math.max(a.length-1,1))*w,py:y+h-((s-lo)/rng)*h}));
  // Grid lines
  [50,65,80].forEach(v=>{
    if(v<lo||v>hi)return;
    const gy=y+h-((v-lo)/rng)*h;
    dc(doc,...FB_TOKENS.borderSoft);lw(doc,0.12);doc.line(x,gy,x+w,gy);
    font(doc,5,"normal");tc(doc,...FB_TOKENS.ghost);doc.text(String(v),x-2,gy+1.5,{align:"right"});
  });lw(doc,0.3);
  // Area
  try{
    const segs=co.slice(1).map((p,i)=>[p.px-co[i].px,p.py-co[i].py]);
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.07}));
    doc.lines([...segs,[0,h],[-(co[co.length-1].px-co[0].px),0]],co[0].px,co[0].py,[1,1],"F",false);
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  }catch{}
  // Line
  dc(doc,...col);lw(doc,1.4);
  co.forEach((p,i)=>{if(i>0)doc.line(co[i-1].px,co[i-1].py,p.px,p.py);});lw(doc,0.3);
  // Endpoints
  fc(doc,...FB_TOKENS.card);doc.circle(co[0].px,co[0].py,2,"F");
  dc(doc,...col);lw(doc,0.8);doc.circle(co[0].px,co[0].py,2,"S");lw(doc,0.3);
  fc(doc,...col);doc.circle(co[co.length-1].px,co[co.length-1].py,2.5,"F");
  font(doc,6.5,"bold");tc(doc,...col);
  doc.text(String(pts[0]),co[0].px,co[0].py-4,{align:"center"});
  doc.text(String(pts[pts.length-1]),co[co.length-1].px,co[co.length-1].py-4,{align:"center"});
}

// ── CALLOUT STRIP ─────────────────────────────────────────────────
function _callout(doc,x,y,w,text,type="info",isAr=false){
  const cols={info:FB_TOKENS.primary,success:FB_TOKENS.success,warning:FB_TOKENS.warning,danger:FB_TOKENS.danger};
  const col=cols[type]||FB_TOKENS.primary;
  const colBg={info:FB_TOKENS.primaryBg,success:FB_TOKENS.successBg,warning:FB_TOKENS.warningBg,danger:FB_TOKENS.dangerBg};
  const lines=doc.splitTextToSize(text.replace(/[#*`]/g,""),w-14);
  const h=Math.max(14,lines.length*5.2+8);
  fc(doc,...(colBg[type]||FB_TOKENS.bg));rr(doc,x,y,w,h,3,"F");
  dc(doc,...col);lw(doc,0.2);rr(doc,x,y,w,h,3,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  font(doc,FB_FLAGS.body,"normal",isAr);tc(doc,...FB_TOKENS.sub);
  lines.forEach((l,i)=>doc.text(l,x+7,y+7+(i*5.2)));
  return y+h+6;
}

// ── STEP CARD v5 ─────────────────────────────────────────────────
function _step(doc,x,y,w,num,title,score,steps,isAr){
  const col=_sc(score),colLt=_scLt(score),h=46;
  fc(doc,...FB_TOKENS.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...FB_TOKENS.border);lw(doc,0.15);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  // Number circle
  fc(doc,...colLt);doc.circle(x+15,y+14,9,"F");
  dc(doc,...col);lw(doc,.8);doc.circle(x+15,y+14,9,"S");lw(doc,0.3);
  font(doc,10,"bold");tc(doc,...col);doc.text(String(num),x+15,y+17.5,{align:"center"});
  // Title + score
  font(doc,10,"bold",isAr);tc(doc,...FB_TOKENS.ink);doc.text(title,x+30,y+12);
  const sb=`${Math.round(score)}/100`;const sw=doc.getTextWidth(sb)+7;
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.1}));
  rr(doc,x+w-sw-4,y+5,sw,8,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,6.5,"bold");tc(doc,...col);doc.text(sb,x+w-sw/2-4,y+10.5,{align:"center"});
  // Steps
  font(doc,7.5,"normal",isAr);tc(doc,...FB_TOKENS.sub);
  steps.slice(0,3).forEach((s,i)=>{
    font(doc,7.5,"bold");tc(doc,...col);doc.text(`${i+1}.`,x+30,y+22+(i*7));
    font(doc,7.5,"normal",isAr);tc(doc,...FB_TOKENS.sub);
    doc.text(doc.splitTextToSize(s,w-40)[0],x+36,y+22+(i*7));
  });
  return y+h+8;
}

// ── ZONE CARD v5 ─────────────────────────────────────────────────
function _zone(doc,x,y,w,name,region,risk,desc,mlist,isAr){
  const col=_riskColor(risk);
  const lines=doc.splitTextToSize(desc,w-50);
  const h=Math.max(48,lines.length*5+34);
  fc(doc,...FB_TOKENS.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...col);lw(doc,0.25);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,2.5,h,"F");rr(doc,x,y,2.5,h,1.2,"F");
  // Risk badge
  fc(doc,...col);doc.circle(x+18,y+h/2,11,"F");
  font(doc,9.5,"bold");tc(doc,...FB_TOKENS.card);doc.text(`${risk}%`,x+18,y+h/2+3.5,{align:"center"});
  // Title
  font(doc,10,"bold",isAr);tc(doc,...FB_TOKENS.ink);doc.text(name,x+35,y+12);
  font(doc,7.5,"bold");tc(doc,...FB_TOKENS.primary);doc.text(region,x+35,y+19);
  // Risk label
  const rlbl=_riskLabel(risk,isAr);
  const rw=doc.getTextWidth(rlbl)+8;
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:.12}));
  rr(doc,x+w-rw-4,y+6,rw,9,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,7.5,"bold",isAr);tc(doc,...col);doc.text(rlbl,x+w-rw/2-4,y+12,{align:"center"});
  // Bar
  const bx=x+35,bw=w*.52;
  fc(doc,...FB_TOKENS.borderSoft);rr(doc,bx,y+23,bw,4.5,2,"F");
  fc(doc,...col);rr(doc,bx,y+23,Math.max(bw*(risk/100),3),4.5,2,"F");
  // Desc
  font(doc,7.5,"normal",isAr);tc(doc,...FB_TOKENS.sub);
  lines.forEach((l,i)=>doc.text(l,x+7,y+32+(i*5)));
  font(doc,6,"bold");tc(doc,...FB_TOKENS.ghost);
  doc.text(`Sources: ${mlist}`,x+7,y+h-4);
  return y+h+6;
}

// ── INFO TABLE ROW ────────────────────────────────────────────────
function _iRow(doc,x,y,w,key,val,even,isAr){
  fc(doc,...(even?FB_TOKENS.bg:FB_TOKENS.card));doc.rect(x,y,w,8.5,"F");
  font(doc,FB_FLAGS.small,"normal",isAr);tc(doc,...FB_TOKENS.muted);doc.text(key,x+5,y+5.8);
  font(doc,FB_FLAGS.small,"bold");tc(doc,...FB_TOKENS.ink);doc.text(String(val),x+w-5,y+5.8,{align:"right"});
}

// ── _drawSparkline alias ──────────────────────────────────────────
function _drawSparkline(doc,hist,x,y,w,h,col){_spark(doc,hist,x,y,w,h,col);}








export async function createShareableReport({ session, profile, user, lang="en", allSessions=[], effectiveTier }) {
  const tier = effectiveTier || profile?.tier || session?.tier || "standard";
  // Normalize tier aliases (personal_elite → elite, etc.)
  const normalizedTier = tier.includes("elite") ? "elite" : tier.includes("pro") || tier.includes("professional") ? "professional" : tier;
  if (!tierAtLeast(normalizedTier,"elite")) throw new Error("Shareable reports require Elite tier");

  const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
  const allKeys = Object.keys(session.metrics || {}).filter(k => !k.startsWith("_"));
  const metricSnap = {};
  for (const k of allKeys) {
    const v = session.metrics[k];
    metricSnap[k] = typeof v === "number" ? v : {
      score: v?.score ?? 100,
      value: v?.value ?? null,
      unit:  v?.unit  ?? "",
      label: (METRIC_LABELS[k] || k),
    };
  }

  const payload = {
    // Identity (non-PII — use display name only)
    owner_uid:    user?.uid || null,
    display_name: profile?.name || user?.displayName || "User",
    // Session data snapshot
    session_id:   session.session_id || session.id || null,
    avg_score:    Math.round(session.avg_score || 0),
    good_pct:     session.good_pct || 0,
    duration_s:   session.duration_s || session.duration_sec || 0,
    alerts_count: session.alerts_count || 0,
    mode:         session.mode || "laptop",
    metrics:      metricSnap,
    score_history: (session.score_history || []).slice(-120), // max 120 frames
    ai_tip:       session.ai_tip || session.ai_insight || "",
    improvement_tip: session.improvement_tip || "",
    pain_summary: session.pain_summary || "",
    created_at:   session.created_at || new Date(),
    session_num:  allSessions.length > 0
      ? allSessions.length - allSessions.findIndex(s => (s.id||s.session_id) === (session.id||session.session_id))
      : 1,
    lang,
    // Sharing meta
    shared_at:    serverTimestamp(),
    expires_at:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    view_count:   0,
  };

  const docRef = await addDoc(collection(db, "shared_reports"), payload);
  const shareUrl = `${window.location.origin}/report/${docRef.id}`;
  return { url: shareUrl, token: docRef.id, expiresAt: payload.expires_at };
}

export async function getSharedReport(token) {
  const { doc, getDoc, updateDoc, increment } = await import("firebase/firestore");
  const snap = await getDoc(doc(db, "shared_reports", token));
  if (!snap.exists()) throw new Error("Report not found or expired");
  const data = snap.data();
  // Check expiry
  const exp = data.expires_at?.toDate?.() || new Date(data.expires_at);
  if (exp < new Date()) throw new Error("This report link has expired (30-day limit)");
  // Increment view count (fire-and-forget)
  updateDoc(doc(db, "shared_reports", token), { view_count: increment(1) }).catch(()=>{});
  return data;
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 3 — FEATURE 2: Longitudinal Risk Report PDF
// 90-day posture trend analysis — requires 10+ sessions
// Shows trajectory, weekly patterns, time-of-day analysis, AI narrative
// ═══════════════════════════════════════════════════════════════════
