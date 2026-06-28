import { initializeApp } from "firebase/app";
import {
  getAuth, signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, OAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  onAuthStateChanged as _onAuthStateChanged,
  sendPasswordResetEmail, sendEmailVerification,
  confirmPasswordReset, verifyPasswordResetCode, applyActionCode,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  browserLocalPersistence, browserSessionPersistence, setPersistence,
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
export const SUPPORT_EMAIL       = import.meta.env.VITE_SUPPORT_EMAIL       || "support@corvus.io";
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
        await signInWithRedirect(auth, msProvider);
      } catch {}
      return null;
    }
    throw e;
  }
};
export const signInEmail        = (e, p) => signInWithEmailAndPassword(auth, e, p);
export const signUpEmail        = (e, p) => createUserWithEmailAndPassword(auth, e, p);
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
  trialExpires.setDate(trialExpires.getDate() + 14);

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
  const _API = import.meta.env.VITE_API_URL || "/api";
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
    const data = snap.data();
    if (!data.is_trial) return data;
    const expires = data.trial_expires_at?.toDate?.() || new Date(0);
    if (new Date() > expires) {
      await updateDoc(doc(db,"users",uid), { tier:"standard", is_trial:false, trial_expires_at:null, updated_at:_serverTimestamp() });
      return { ...data, tier:"standard", is_trial:false };
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
export const getUserProfile   = async (uid) => { const s=await getDoc(doc(db,"users",uid)); return s.exists()?{id:s.id,...s.data()}:null; };
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
  const ref = await addDoc(collection(db,"sessions"), { uid, ...data, created_at:_serverTimestamp() });
  try {
    const prof = await getUserProfile(uid);
    const newCount = (prof?.sessions_count||0)+1;
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
  const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

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
const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

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

// ── Client-side PDF Report Generator ─────────────────────────────
export async function generateSessionPDF({ session, profile, user, lang="en", sessionIndex }) {
  const { jsPDF } = await import("jspdf");
  const isAr  = lang === "ar";
  const tier  = session.tier || profile?.tier || "standard";
  const isElite = tierAtLeast(tier, "elite");
  const doc   = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W=210, H=297, ml=18, mr=18, cw=W-ml-mr;

  // ── helpers ─────────────────────────────────────────────────
  const gc = s => s>=80?[16,185,129]:s>=60?[245,158,11]:[239,68,68];
  const gl = s => s>=80?(isAr?"ممتاز":"Excellent"):s>=60?(isAr?"جيد":"Good"):(isAr?"يحتاج تحسين":"Needs Work");
  const fmtDur = s => { if(!s) return "—"; const m=Math.floor(s/60),sec=s%60; return `${m>0?m+"m ":""}${sec}s`; };
  const fmtDate = ts => {
    if(!ts) return "—";
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString(isAr?"ar-EG":"en-US",{weekday:"short",year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
    } catch { return "—"; }
  };

  const avg     = Math.round(session.avg_score || 0);
  const dur     = session.duration_s || session.duration_sec || 0;
  const goodPct = session.good_pct || 0;
  const gradeC  = gc(avg);
  const metrics = session.metrics || {};
  const hist    = session.score_history || [];
  const aiText  = session.ai_tip || session.ai_insight || session.claude_analysis || "";
  const painSum = session.pain_summary || "";
  const impTip  = session.improvement_tip || "";
  const name    = profile?.name || user?.displayName || user?.email?.split("@")[0] || (isAr?"مستخدم":"User");
  const email   = user?.email || "";

  let y = 0;

  // ══════════════════════════════════════════════════════════════
  // PAGE 1 — Cover + Score Summary
  // ══════════════════════════════════════════════════════════════

  // Header bar
  doc.setFillColor(3,11,20); doc.rect(0,0,W,42,"F");

  // Corvus logo area
  doc.setFillColor(79,124,249); doc.roundedRect(ml,8,22,22,3,3,"F");
  doc.setFontSize(18); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text("C", ml+11, 23.5, {align:"center"});

  // Title
  doc.setFontSize(22); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text("Corvus", ml+28, 18);
  doc.setFontSize(9); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text(isAr?"تقرير تحليل الوضعية الشخصي":"Personal Posture Analysis Report", ml+28, 26);
  doc.text(isAr?`تاريخ الإنشاء: ${new Date().toLocaleDateString("ar-EG")}`:`Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}`, ml+28, 32.5);

  // Tier badge
  const tierColor = isElite ? [16,185,129] : tierAtLeast(tier,"professional") ? [14,165,233] : [99,102,241];
  doc.setFillColor(...tierColor); doc.roundedRect(W-mr-30,12,30,10,2,2,"F");
  doc.setFontSize(7.5); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text(tier.toUpperCase(), W-mr-15, 18.8, {align:"center"});

  y = 52;

  // Session header
  doc.setFontSize(16); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text(isAr?`جلسة رقم ${sessionIndex||""}`:`Session #${sessionIndex||""}`, ml, y); y+=7;
  doc.setFontSize(9); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text(fmtDate(session.created_at), ml, y); y+=12;

  // ── Score card ───────────────────────────────────────────────
  doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,48,5,5,"F");
  doc.setDrawColor(...gradeC); doc.setLineWidth(0.6); doc.roundedRect(ml,y,cw,48,5,5,"S");
  doc.setLineWidth(0.3);

  // Grade circle
  const cx=ml+30, cy=y+24;
  doc.setFillColor(...gradeC); doc.circle(cx,cy,18,"F");
  doc.setFontSize(avg>=100?15:20); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text(String(avg), cx, cy+7, {align:"center"});
  doc.setFontSize(8); doc.text(isAr?"/100":"/100", cx, cy+13, {align:"center"});

  // Grade label
  doc.setFontSize(20); doc.setTextColor(...gradeC); doc.setFont("helvetica","bold");
  doc.text(gl(avg), ml+56, y+20);
  doc.setFontSize(10); doc.setTextColor(71,85,105); doc.setFont("helvetica","normal");
  doc.text(isAr?"نقاط الوضعية الكلية":"Overall Posture Score", ml+56, y+30);
  doc.setFontSize(9); doc.text(isAr?`المدة: ${fmtDur(dur)}`:`Duration: ${fmtDur(dur)}`, ml+56, y+40);

  // 3 mini stats (right side)
  [[isAr?"وضعية جيدة":"Good Posture",`${goodPct}%`],[isAr?"تنبيهات":"Alerts",String(session.alerts_count||0)],[isAr?"الجلسة":"Session",`#${sessionIndex||1}`]].forEach(([lbl,val],i)=>{
    const sx = cw - 60 + i*22 + ml;
    doc.setFontSize(15); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(val, sx, y+22, {align:"center"});
    doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text(lbl, sx, y+30, {align:"center"});
  });
  y += 58;

  // ── Score sparkline ──────────────────────────────────────────
  if(hist.length>2){
    doc.setFontSize(10); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(isAr?"سجل النقاط خلال الجلسة":"Score Timeline", ml, y); y+=5;

    const bh=28;
    doc.setFillColor(241,245,249); doc.roundedRect(ml,y,cw,bh,3,3,"F");
    // Guide lines
    [50,65,80,95].forEach(v=>{
      const gy = y+bh-3 - ((v-40)/Math.max(60,1))*(bh-6);
      doc.setDrawColor(200,210,220); doc.setLineWidth(0.2);
      doc.line(ml+3,gy,ml+cw-3,gy);
      doc.setFontSize(5.5); doc.setTextColor(160,174,192);
      doc.text(String(v), ml+1, gy+1.5, {align:"right"});
    });
    const slice = hist.slice(-60);
    const maxS = Math.max(...slice,100), minS = Math.min(...slice,0);
    const range = Math.max(maxS-minS,10);
    const pts = slice.map((s,i,a)=>({
      x: ml+5+(i/Math.max(a.length-1,1))*(cw-10),
      y: y+bh-4-((s-minS)/range)*(bh-8),
    }));
    // Gradient fill under line
    doc.setFillColor(...gradeC.map(c=>Math.min(255,c+120)));
    // Simple area approximation
    doc.setDrawColor(...gradeC); doc.setLineWidth(1.2);
    pts.forEach((p,i)=>{ if(i>0) doc.line(pts[i-1].x,pts[i-1].y,p.x,p.y); });
    // End points
    if(pts.length>0){
      doc.setFillColor(...gradeC); doc.circle(pts[0].x,pts[0].y,1.2,"F");
      doc.circle(pts[pts.length-1].x,pts[pts.length-1].y,1.8,"F");
    }
    y += bh + 10;
  }

  // ── Pain prediction (if available) ──────────────────────────
  if(painSum){
    doc.setFillColor(254,243,199); doc.roundedRect(ml,y,cw,12,2,2,"F");
    doc.setFontSize(8.5); doc.setTextColor(146,64,14); doc.setFont("helvetica","bold");
    doc.text(painSum, ml+4, y+8);
    y += 18;
  }

  // ── Improvement tip ──────────────────────────────────────────
  if(impTip){
    doc.setFillColor(220,252,231); doc.roundedRect(ml,y,cw,12,2,2,"F");
    doc.setFontSize(8.5); doc.setTextColor(20,83,45); doc.setFont("helvetica","bold");
    doc.text(`💡 ${impTip}`, ml+4, y+8);
    y += 18;
  }

  // ── Key metrics summary (top 5 only on page 1) ──────────────
  const metricEntries = Object.entries(metrics)
    .filter(([k])=>!k.startsWith("_"))
    .sort(([,a],[,b])=>((a?.score??100)-(b?.score??100)));

  if(metricEntries.length>0){
    doc.setFontSize(11); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(isAr?"أبرز مقاييس الوضعية":"Key Posture Metrics", ml, y); y+=7;

    const showTop = Math.min(metricEntries.length, 6);
    metricEntries.slice(0, showTop).forEach(([key,val])=>{
      if(y > H-50){ return; }
      const sc  = typeof val==="number" ? val : (val?.score ?? 0);
      const col = gc(sc);
      const lbl = val?.label || key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      const vlu = val?.value!==undefined ? `${Math.round(val.value*10)/10}${val.unit||""}` : "";

      doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,14,2,2,"F");
      // Label
      doc.setFontSize(8.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","normal");
      doc.text(lbl, ml+3, y+9.5);
      // Value
      if(vlu){ doc.setFontSize(8); doc.setTextColor(...col); doc.setFont("helvetica","bold"); doc.text(vlu, ml+70, y+9.5); }
      // Bar
      const bx=ml+82, bw2=cw-84;
      doc.setFillColor(226,232,240); doc.roundedRect(bx,y+5,bw2,4,1,1,"F");
      doc.setFillColor(...col); doc.roundedRect(bx,y+5,Math.max(bw2*(sc/100),1),4,1,1,"F");
      // Score
      doc.setFontSize(8); doc.setTextColor(...col); doc.setFont("helvetica","bold");
      doc.text(`${Math.round(sc)}`, W-mr-1, y+9.5, {align:"right"});
      y += 17;
    });
  }

  // ── User info footer strip ───────────────────────────────────
  const footerY = H-28;
  doc.setFillColor(241,245,249); doc.rect(0,footerY,W,18,"F");
  doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text(isAr?`الاسم: ${name}`:`Name: ${name}`, ml, footerY+8);
  doc.text(isAr?`البريد: ${email}`:`Email: ${email}`, ml, footerY+14);
  doc.text(isAr?`الشركة: ${profile?.company||"—"}`:`Company: ${profile?.company||"—"}`, W-mr, footerY+8, {align:"right"});
  doc.text(`ID: ${(session.session_id||session.id||"—").slice?.(0,14)||"—"}`, W-mr, footerY+14, {align:"right"});

  // ══════════════════════════════════════════════════════════════
  // PAGE 2 — Full Metrics Breakdown (Elite) OR Prompt to Upgrade
  // ══════════════════════════════════════════════════════════════
  if(isElite && metricEntries.length > 0){
    doc.addPage(); y=18;

    // Header
    doc.setFillColor(3,11,20); doc.rect(0,0,W,14,"F");
    doc.setFontSize(9); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text("Corvus — " + (isAr?"تقرير مفصّل":"Detailed Metrics Report"), ml, 9.5);
    doc.setFontSize(8); doc.setTextColor(...tierColor); doc.setFont("helvetica","bold");
    doc.text(tier.toUpperCase(), W-mr, 9.5, {align:"right"});
    y = 24;

    doc.setFontSize(14); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(isAr?"تفاصيل كافة مقاييس الوضعية":"Complete Posture Metrics Breakdown", ml, y); y+=10;

    // All metrics
    metricEntries.forEach(([key,val])=>{
      if(y > H-45){ doc.addPage(); y=20; }
      const sc  = typeof val==="number" ? val : (val?.score ?? 0);
      const col = gc(sc);
      const lbl = val?.label || key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      const vlu = val?.value!==undefined ? `${Math.round(val.value*10)/10}${val.unit||""}` : "";

      // Card
      doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,20,2,2,"F");
      doc.setDrawColor(226,232,240); doc.setLineWidth(0.3); doc.roundedRect(ml,y,cw,20,2,2,"S");

      // Score badge
      doc.setFillColor(...col); doc.roundedRect(ml+1,y+1,18,18,2,2,"F");
      doc.setFontSize(10); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
      doc.text(String(Math.round(sc)), ml+10, y+12, {align:"center"});

      // Label + value
      doc.setFontSize(9.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
      doc.text(lbl, ml+22, y+8);
      if(vlu){ doc.setFontSize(9); doc.setTextColor(...col); doc.text(vlu, ml+22, y+15); }

      // Bar (right side)
      const bx = ml+80, bw2 = cw-82;
      doc.setFillColor(226,232,240); doc.roundedRect(bx,y+8,bw2,4,1,1,"F");
      doc.setFillColor(...col); doc.roundedRect(bx,y+8,Math.max(bw2*(sc/100),2),4,1,1,"F");

      // Grade label
      const gLabel = sc>=80?( isAr?"ممتاز":"Excellent"):sc>=60?(isAr?"جيد":"Good"):(isAr?"يحتاج تحسين":"Needs Work");
      doc.setFontSize(7.5); doc.setTextColor(...col); doc.setFont("helvetica","normal");
      doc.text(gLabel, W-mr-1, y+16, {align:"right"});

      y += 24;
    });

    // ── AI Narrative section ─────────────────────────────────────
    if(aiText){
      if(y > H-60){ doc.addPage(); y=20; }
      y += 4;
      doc.setFillColor(...gradeC.map(c=>Math.min(255,c+130)));
      doc.roundedRect(ml,y,cw,8,2,2,"F");
      doc.setFontSize(10); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
      doc.text(isAr?"🤖 تحليل الذكاء الاصطناعي (Gemini)":"🤖 AI Analysis (Gemini)", ml+4, y+5.5);
      y += 12;

      // Wrap AI text properly
      doc.setFontSize(9); doc.setTextColor(30,41,59); doc.setFont("helvetica","normal");
      const lines = doc.splitTextToSize(aiText.replace(/[#*`]/g,"").trim(), cw-6);
      lines.forEach(line=>{
        if(y>H-25){ doc.addPage(); y=20; }
        doc.text(line, ml+3, y);
        y += 5.5;
      });
      y += 4;
    }

    // ── Session stats summary table ──────────────────────────────
    if(y < H-60){
      y += 4;
      doc.setFontSize(10); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
      doc.text(isAr?"إحصائيات الجلسة":"Session Statistics", ml, y); y+=8;

      const stats = [
        [isAr?"النقاط الكلية":"Overall Score", `${avg}/100 — ${gl(avg)}`],
        [isAr?"مدة الجلسة":"Duration", fmtDur(dur)],
        [isAr?"نسبة الوضعية الجيدة":"Good Posture %", `${goodPct}%`],
        [isAr?"عدد التنبيهات":"Alert Count", String(session.alerts_count||0)],
        [isAr?"وضع الكاميرا":"Camera Mode", session.mode||"laptop"],
        [isAr?"المستوى":"Tier", tier.toUpperCase()],
      ];
      stats.forEach(([k,v],i)=>{
        doc.setFillColor(i%2===0?248:255,i%2===0?250:255,i%2===0?252:255);
        doc.rect(ml,y,cw,9,"F");
        doc.setFontSize(8.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
        doc.text(k, ml+3, y+6.5);
        doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
        doc.text(v, W-mr-3, y+6.5, {align:"right"});
        y += 9;
      });
    }
  } else if(!isElite) {
    // Upgrade prompt for non-Elite
    doc.addPage(); y=80;
    doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,80,8,8,"F");
    doc.setFontSize(28); doc.setTextColor(99,102,241); doc.setFont("helvetica","bold");
    doc.text("⭐", W/2, y+25, {align:"center"});
    doc.setFontSize(16); doc.setTextColor(15,23,42);
    doc.text(isAr?"ترقية إلى Elite لتفعيل:":"Upgrade to Elite to unlock:", W/2, y+42, {align:"center"});
    const features = isAr
      ? ["تحليل Gemini AI المفصّل","تقرير PDF كامل متعدد الصفحات","توقع الألم المهني","مقارنة بخط الأساس الشخصي"]
      : ["Detailed Gemini AI analysis","Full multi-page PDF report","Professional pain prediction","Personal baseline comparison"];
    doc.setFontSize(11); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    features.forEach((f,i)=>{ doc.text(`✓ ${f}`, W/2, y+56+(i*10), {align:"center"}); });
  }

  // ── Page numbers ────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for(let i=1;i<=pages;i++){
    doc.setPage(i);
    doc.setFillColor(3,11,20); doc.rect(0,H-8,W,8,"F");
    doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text("Corvus Health Intelligence — Confidential", ml, H-2.5);
    doc.text(`${i} / ${pages}`, W-mr, H-2.5, {align:"right"});
  }

  const filename = `Corvus_Session${sessionIndex?"_"+sessionIndex:""}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
  return filename;
}
