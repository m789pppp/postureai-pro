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

// ─────────────────────────────────────────────────────────────────
// ZONAL PAIN MAP — cervical/thoracic/lumbar risk from metrics
// ─────────────────────────────────────────────────────────────────
function _zonalRisk(metrics) {
  const sc = k => metrics?.[k]?.score ?? 100;
  return {
    cervical:  Math.round((100 - (sc("neck_lean") + sc("neck_lean_side") + sc("head_tilt") + sc("head_yaw") + sc("fhp") + sc("fhp_side")) / 6)),
    thoracic:  Math.round((100 - (sc("shoulder") + sc("rounded") + sc("spine_lean") + sc("trunk_lean")) / 4)),
    lumbar:    Math.round((100 - (sc("spine_align") + sc("hip_angle") + sc("spine_lean")) / 3)),
  };
}
function _riskLabel(v, isAr) {
  if (v < 20) return isAr ? "منخفض"   : "Low";
  if (v < 45) return isAr ? "متوسط"   : "Moderate";
  if (v < 70) return isAr ? "مرتفع"   : "High";
  return              isAr ? "مرتفع جداً" : "Very High";
}
function _riskColor(v) {
  if (v < 20) return [16, 185, 129];
  if (v < 45) return [245, 158, 11];
  if (v < 70) return [249, 115, 22];
  return              [239, 68, 68];
}

// ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// CORVUS PDF DESIGN SYSTEM v4
// Premium healthcare report — logo from site, refined typography,
// structured white space, clinical-grade visual hierarchy
// ═══════════════════════════════════════════════════════════════════

// ── Design Tokens ──────────────────────────────────────────────────
const T = {
  primary:   [37,99,235],   primaryDk:[30,64,175],
  success:   [34,197,94],   successDk:[21,128,61],
  warning:   [245,158,11],  warningDk:[180,83,9],
  danger:    [239,68,68],   dangerDk:[185,28,28],
  ink:       [17,24,39],    sub:[55,65,81],
  muted:     [107,114,128], light:[156,163,175],
  bg:        [248,250,252], bgAlt:[241,245,249],
  card:      [255,255,255], border:[229,231,235],
  borderSoft:[243,244,246], ink2:[30,41,59],
  indigo:    [99,102,241],  cyan:[6,182,212],
  slate:     [15,23,42],    slateM:[30,41,59],
};
const F = { display:26, h1:16, h2:13, h3:10.5, body:9, small:7.5, micro:6 };

// ── Color helpers ──────────────────────────────────────────────────
function _sc(s){ return s>=80?T.success:s>=60?T.warning:T.danger; }
function _sl(s,ar){ return s>=80?(ar?"ممتاز":"Excellent"):s>=60?(ar?"جيد":"Good"):(ar?"يحتاج تحسين":"Needs Work"); }
function _fmtDur(s){ if(!s)return"—"; const m=Math.floor(s/60),r=s%60; return m>0?`${m}m ${r}s`:`${r}s`; }
function _fmtDate(ts,ar){
  if(!ts)return"—";
  try{ const d=ts?.toDate?ts.toDate():new Date(ts);
    return d.toLocaleDateString(ar?"ar-EG":"en-US",{year:"numeric",month:"long",day:"numeric"}); }
  catch{return"—";}
}

// ── Cairo font (Arabic) ────────────────────────────────────────────
let _cairoLoaded=false;
async function _ensureCairoFont(doc){
  if(_cairoLoaded)return;
  try{
    const{CAIRO_B64}=await import("./assets/cairoFont.js");
    doc.addFileToVFS("Cairo-Regular.ttf",CAIRO_B64);
    doc.addFont("Cairo-Regular.ttf","cairo","normal");
    doc.addFileToVFS("Cairo-Bold.ttf",CAIRO_B64);
    doc.addFont("Cairo-Bold.ttf","cairo","bold");
    _cairoLoaded=true;
  }catch(e){console.warn("Cairo font failed:",e);}
}

// ── Logo image cache ───────────────────────────────────────────────
let _logoSm=null,_logoMd=null,_logoLg=null;
async function _ensureLogo(){
  if(_logoSm)return;
  try{
    const{LOGO_SM_B64,LOGO_MD_B64,LOGO_LG_B64}=await import("./assets/corvusLogo.js");
    _logoSm=LOGO_SM_B64; _logoMd=LOGO_MD_B64; _logoLg=LOGO_LG_B64;
  }catch(e){console.warn("Logo load failed:",e);}
}

// ── Font helper ────────────────────────────────────────────────────
function font(doc,size,style="normal",isAr=false){
  doc.setFont(isAr&&_cairoLoaded?"cairo":"helvetica",style);
  doc.setFontSize(size);
}
// ── Draw primitives ────────────────────────────────────────────────
function dc(doc,...c){doc.setDrawColor(...c);}
function fc(doc,...c){doc.setFillColor(...c);}
function tc(doc,...c){doc.setTextColor(...c);}
function lw(doc,w){doc.setLineWidth(w);}
// ── Cairo Arabic font loader (call once per jsPDF doc instance) ───
let _cairoCached = null; // module-level cache — avoid re-fetching on every PDF
async function _loadCairo(doc) {
  try {
    if (!_cairoCached) {
      const { CAIRO_FONT_B64 } = await import("./lib/cairoFont.js");
      _cairoCached = CAIRO_FONT_B64;
    }
    doc.addFileToVFS("Cairo.ttf", _cairoCached);
    doc.addFont("Cairo.ttf", "cairo", "normal");
    doc.addFileToVFS("Cairo-Bold.ttf", _cairoCached);
    doc.addFont("Cairo-Bold.ttf", "cairo", "bold");
    return true;
  } catch(e) {
    console.warn("Cairo font load failed:", e.message);
    return false;
  }
}

function rr(doc,x,y,w,h,r=3,m="F"){doc.roundedRect(x,y,w,h,r,r,m);}
function hr(doc,x,y,w,col=T.border){dc(doc,...col);lw(doc,0.18);doc.line(x,y,x+w,y);lw(doc,0.3);}

// ── Logo draw ──────────────────────────────────────────────────────
function _logo(doc,x,y,sz,b64){
  if(b64){
    try{ doc.addImage(b64,"PNG",x,y,sz,sz); return; }catch{}
  }
  // Fallback: draw from SVG primitives
  fc(doc,3,11,20); rr(doc,x,y,sz,sz,sz*0.14,"F");
  fc(doc,...T.primary); rr(doc,x+sz*.19,y+sz*.19,sz*.62,sz*.62,sz*.12,"F");
  font(doc,sz*.42,"bold"); tc(doc,...T.card);
  doc.text("P",x+sz/2,y+sz*.72,{align:"center"});
}

// ── Cover (page 1) ─────────────────────────────────────────────────
function _cover(doc,W,ml,tier,tierCol,name,sessionNum,dateStr,avg,isAr){
  // Full-bleed dark header — slate gradient feel
  fc(doc,...T.slate); doc.rect(0,0,W,68,"F");
  // Geometric circles for depth
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.07}));
  doc.circle(W*0.88,34,55,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.04}));
  doc.circle(W*0.88,34,80,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Thin top accent
  fc(doc,...tierCol); doc.rect(0,0,W,2.5,"F");

  // Logo
  _logo(doc,ml,18,32,_logoMd);

  // Brand + tagline
  font(doc,14,"bold"); tc(doc,...T.card);
  doc.text("CORVUS",ml+40,30);
  font(doc,7,"normal"); tc(doc,148,163,184);
  doc.text("Health Intelligence Platform",ml+40,38);

  // Tier badge — pill
  const tl=tier.toUpperCase();
  font(doc,7,"bold"); tc(doc,...tierCol);
  const tw=doc.getTextWidth(tl)+10;
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.18}));
  rr(doc,ml+40,42,tw,10,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  tc(doc,...tierCol); font(doc,7,"bold");
  doc.text(tl,ml+40+tw/2,49,{align:"center"});

  // Right: date + session number
  font(doc,7,"normal"); tc(doc,148,163,184);
  doc.text(dateStr,W-ml,28,{align:"right"});
  font(doc,8,"bold"); tc(doc,...T.card);
  doc.text(`Session #${sessionNum}`,W-ml,37,{align:"right"});

  // Bottom accent bar
  fc(doc,...tierCol); doc.rect(0,65.5,W,2.5,"F");
}

// ── Inner page header ──────────────────────────────────────────────
function _hdr(doc,W,ml,mr,label,isAr){
  fc(doc,...T.card); doc.rect(0,0,W,16,"F");
  fc(doc,...T.primary); doc.rect(0,16,W,0.4,"F");
  fc(doc,...T.borderSoft); doc.rect(0,0,W,16,"F");
  _logo(doc,ml,3.5,9,_logoSm);
  font(doc,7.5,"bold"); tc(doc,...T.ink);
  doc.text("Corvus",ml+13,10);
  font(doc,7,"normal"); tc(doc,...T.muted);
  doc.text("Health Intelligence",ml+29,10);
  font(doc,7,"bold"); tc(doc,...T.primary);
  doc.text(label,W-mr,10,{align:"right"});
}

// ── Footer ─────────────────────────────────────────────────────────
function _ftr(doc,W,ml,mr,H,pg,total,name){
  hr(doc,0,H-10,W,T.border);
  fc(doc,...T.bg); doc.rect(0,H-9.5,W,9.5,"F");
  font(doc,F.micro,"normal"); tc(doc,...T.light);
  doc.text("Corvus Health Intelligence · Confidential",ml,H-3.5);
  font(doc,F.micro,"bold"); tc(doc,...T.muted);
  doc.text(name,W/2,H-3.5,{align:"center"});
  doc.text(`${pg} / ${total}`,W-mr,H-3.5,{align:"right"});
}

// ── Section heading ────────────────────────────────────────────────
function _sh(doc,ml,y,title,sub="",col=T.primary,isAr=false){
  fc(doc,...col); doc.rect(ml,y,2,sub?14:10,"F");
  font(doc,F.h2,"bold",isAr); tc(doc,...T.ink);
  doc.text(title,ml+7,y+(sub?7:7));
  if(sub){ font(doc,F.small,"normal",isAr); tc(doc,...T.light); doc.text(sub,ml+7,y+13); }
  return y+(sub?21:14);
}

// ── Score ring ─────────────────────────────────────────────────────
function _ring(doc,cx,cy,r,score,isAr){
  const col=_sc(score),lbl=_sl(score,isAr);
  // BG circle (track)
  dc(doc,...T.border); lw(doc,2.5); doc.circle(cx,cy,r,"S"); lw(doc,0.3);
  // Score arc
  dc(doc,...col); lw(doc,2.5); doc.circle(cx,cy,r,"S"); lw(doc,0.3);
  // Inner tint
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.06}));
  doc.circle(cx,cy,r-1.5,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Number
  font(doc,18,"bold",false); tc(doc,...col);
  doc.text(String(score),cx,cy+3,{align:"center"});
  font(doc,6,"normal",false); tc(doc,...T.muted);
  doc.text("/100",cx,cy+9,{align:"center"});
  // Grade below ring
  font(doc,8,"bold",isAr); tc(doc,...col);
  doc.text(lbl,cx,cy+r+7,{align:"center"});
}

// ── KPI chip (compact square) ──────────────────────────────────────
function _kpi(doc,x,y,w,h,val,label,col){
  fc(doc,...T.card); rr(doc,x,y,w,h,3,"F");
  dc(doc,...T.border); lw(doc,0.15); rr(doc,x,y,w,h,3,"S"); lw(doc,0.3);
  // Top accent strip
  fc(doc,...col); rr(doc,x,y,w,2.5,1.5,"F"); doc.rect(x,y+1.5,w,1,"F");
  // Value
  font(doc,13,"bold",false); tc(doc,...col);
  doc.text(String(val),x+w/2,y+h*0.56,{align:"center"});
  // Label
  font(doc,F.small,"bold",false); tc(doc,...T.muted);
  doc.text(label,x+w/2,y+h*0.78,{align:"center"});
}

// ── Metric row card ────────────────────────────────────────────────
function _mRow(doc,x,y,w,lbl,value,unit,score,isAr,idx=0){
  const col=_sc(score); const h=21;
  // Alternating subtle bg
  fc(doc,...(idx%2===0?T.card:T.bg)); rr(doc,x,y,w,h,3,"F");
  dc(doc,...T.border); lw(doc,0.15); rr(doc,x,y,w,h,3,"S"); lw(doc,0.3);
  // Left accent
  fc(doc,...col); doc.rect(x,y,2.5,h,"F"); rr(doc,x,y,2.5,h,1.2,"F");
  // Score badge
  fc(doc,...col); rr(doc,x+6,y+4.5,15,12,2,"F");
  font(doc,8.5,"bold",false); tc(doc,...T.card);
  doc.text(String(Math.round(score)),x+13.5,y+12,{align:"center"});
  // Label
  font(doc,9,"bold",isAr); tc(doc,...T.ink);
  doc.text(lbl,x+26,y+9.5);
  // Value + unit
  if(value!==undefined&&value!==null){
    font(doc,7.5,"normal",false); tc(doc,...T.muted);
    doc.text(`${Math.round(value*10)/10}${unit||""}`,x+26,y+16);
  }
  // Progress bar
  const bx=x+w*0.52, bw=w*0.44, bh=5;
  fc(doc,...T.borderSoft); rr(doc,bx,y+8,bw,bh,2,"F");
  fc(doc,...col); rr(doc,bx,y+8,Math.max(bw*(score/100),3),bh,2,"F");
  // Grade pill
  const gl=_sl(score,isAr);
  const gw=doc.getTextWidth(gl)+8;
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.1}));
  rr(doc,x+w-gw-3,y+14,gw,6,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,6,"bold",isAr); tc(doc,...col);
  doc.text(gl,x+w-gw/2-3,y+18.5,{align:"center"});
}

// ── Sparkline ──────────────────────────────────────────────────────
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
    dc(doc,...T.border); lw(doc,0.12); doc.line(x,gy,x+w,gy);
    font(doc,5,"normal"); tc(doc,...T.light);
    doc.text(String(v),x-2,gy+1.5,{align:"right"});
  }); lw(doc,0.3);
  // Area fill
  try{
    const segs=co.slice(1).map((p,i)=>[p.px-co[i].px,p.py-co[i].py]);
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.08}));
    doc.lines([...segs,[0,h],[-(co[co.length-1].px-co[0].px),0]],co[0].px,co[0].py,[1,1],"F",false);
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  }catch{}
  // Line
  dc(doc,...col); lw(doc,1.2);
  co.forEach((p,i)=>{if(i>0)doc.line(co[i-1].px,co[i-1].py,p.px,p.py);}); lw(doc,0.3);
  // Endpoints
  fc(doc,...T.card); doc.circle(co[0].px,co[0].py,2,"F");
  dc(doc,...col); lw(doc,0.8); doc.circle(co[0].px,co[0].py,2,"S"); lw(doc,0.3);
  fc(doc,...col); doc.circle(co[co.length-1].px,co[co.length-1].py,2.5,"F");
  // Labels
  font(doc,6.5,"bold",false); tc(doc,...col);
  doc.text(String(pts[0]),co[0].px,co[0].py-4,{align:"center"});
  doc.text(String(pts[pts.length-1]),co[co.length-1].px,co[co.length-1].py-4,{align:"center"});
}

// ── Callout strip ──────────────────────────────────────────────────
function _callout(doc,x,y,w,text,type="info",isAr=false){
  const cols={info:T.primary,success:T.success,warning:T.warning,danger:T.danger};
  const col=cols[type]||T.primary;
  const lines=doc.splitTextToSize(text.replace(/[#*`]/g,""),w-16);
  const h=Math.max(14,lines.length*5.2+8);
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.07}));
  rr(doc,x,y,w,h,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  dc(doc,...col); lw(doc,0.2); rr(doc,x,y,w,h,3,"S"); lw(doc,0.3);
  fc(doc,...col); doc.rect(x,y,2.5,h,"F"); rr(doc,x,y,2.5,h,1.2,"F");
  font(doc,F.body,"normal",isAr); tc(doc,...T.sub);
  lines.forEach((l,i)=>doc.text(l,x+7,y+7+(i*5.2)));
  return y+h+6;
}

// ── Zone card ──────────────────────────────────────────────────────
function _zone(doc,x,y,w,name,region,risk,desc,mlist,isAr){
  const col=_riskColor(risk);
  const lines=doc.splitTextToSize(desc,w-50);
  const h=Math.max(48,lines.length*5+32);
  fc(doc,...T.card); rr(doc,x,y,w,h,4,"F");
  dc(doc,...col); lw(doc,0.25); rr(doc,x,y,w,h,4,"S"); lw(doc,0.3);
  fc(doc,...col); doc.rect(x,y,2.5,h,"F"); rr(doc,x,y,2.5,h,1.2,"F");
  // Risk circle
  fc(doc,...col); doc.circle(x+18,y+h/2,11,"F");
  font(doc,9,"bold",false); tc(doc,...T.card);
  doc.text(`${risk}%`,x+18,y+h/2+3.5,{align:"center"});
  // Title
  font(doc,10,"bold",isAr); tc(doc,...T.ink); doc.text(name,x+35,y+12);
  font(doc,7.5,"bold",false); tc(doc,...T.primary); doc.text(region,x+35,y+19);
  // Bar
  const bx=x+35,bw=w*0.52;
  fc(doc,...T.borderSoft); rr(doc,bx,y+23,bw,4,2,"F");
  fc(doc,...col); rr(doc,bx,y+23,Math.max(bw*(risk/100),3),4,2,"F");
  font(doc,7,"bold",isAr); tc(doc,...col);
  doc.text(_riskLabel(risk,isAr),x+35+bw+4,y+26.5);
  // Desc
  font(doc,7.5,"normal",isAr); tc(doc,...T.sub);
  lines.forEach((l,i)=>doc.text(l,x+7,y+32+(i*5)));
  font(doc,6,"bold",false); tc(doc,...T.light);
  doc.text(`Sources: ${mlist}`,x+7,y+h-4);
  return y+h+6;
}

// ── Next step card ─────────────────────────────────────────────────
function _step(doc,x,y,w,num,title,score,steps,isAr){
  const col=_sc(score); const h=46;
  fc(doc,...T.card); rr(doc,x,y,w,h,4,"F");
  dc(doc,...T.border); lw(doc,0.15); rr(doc,x,y,w,h,4,"S"); lw(doc,0.3);
  fc(doc,...col); doc.rect(x,y,2.5,h,"F"); rr(doc,x,y,2.5,h,1.2,"F");
  // Number
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.15}));
  doc.circle(x+15,y+14,9,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  fc(doc,...col); doc.circle(x+15,y+14,9,"S"); // ring
  dc(doc,...col); lw(doc,1); doc.circle(x+15,y+14,9,"S"); lw(doc,0.3);
  font(doc,9.5,"bold",false); tc(doc,...col);
  doc.text(String(num),x+15,y+17.5,{align:"center"});
  // Title + badge
  font(doc,10,"bold",isAr); tc(doc,...T.ink); doc.text(title,x+30,y+12);
  const sb=`${Math.round(score)}/100`;
  const sw=doc.getTextWidth(sb)+7;
  fc(doc,...col);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
  rr(doc,x+w-sw-4,y+5,sw,8,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,6.5,"bold",false); tc(doc,...col);
  doc.text(sb,x+w-sw/2-4,y+10.5,{align:"center"});
  // Steps
  font(doc,7.5,"normal",isAr); tc(doc,...T.sub);
  steps.slice(0,3).forEach((s,i)=>{
    font(doc,7.5,"bold",false); tc(doc,...col);
    doc.text(`${i+1}.`,x+30,y+22+(i*7));
    font(doc,7.5,"normal",isAr); tc(doc,...T.sub);
    const maxW=w-36;
    const sl=doc.splitTextToSize(s,maxW);
    doc.text(sl[0],x+36,y+22+(i*7));
  });
  return y+h+7;
}

// ── Info table row ─────────────────────────────────────────────────
function _iRow(doc,x,y,w,key,val,even,isAr){
  fc(doc,...(even?T.bg:T.card)); doc.rect(x,y,w,8.5,"F");
  font(doc,F.small,"normal",isAr); tc(doc,...T.muted); doc.text(key,x+5,y+5.8);
  font(doc,F.small,"bold",false); tc(doc,...T.ink); doc.text(String(val),x+w-5,y+5.8,{align:"right"});
}

// ═══════════════════════════════════════════════════════════════════
// generateSessionPDF — v4
// ═══════════════════════════════════════════════════════════════════
export async function generateSessionPDF({ session, profile, user, lang="en", sessionIndex, allSessions=[] }) {
  const { jsPDF } = await import("jspdf");
  const isAr  = lang==="ar";
  const tier  = profile?.tier||session?.tier||"standard";
  const isElite = tierAtLeast(tier,"elite");
  const isPro   = !isElite && tierAtLeast(tier,"professional");
  const doc   = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});

  // Load assets (parallel)
  await Promise.all([_ensureCairoFont(doc), _ensureLogo()]);

  const W=210, H=297, ml=18, mr=18, cw=W-ml-mr;
  const tierCol = isElite?T.success:isPro?T.cyan:T.indigo;
  const avg     = Math.round(session.avg_score||0);
  const dur     = session.duration_s||session.duration_sec||0;
  const goodPct = Math.round(session.good_pct||0);
  const gradeC  = _sc(avg);
  const metrics = session.metrics||{};
  const hist    = session.score_history||[];
  const aiText  = session.ai_tip||session.ai_insight||session.claude_analysis||"";
  const painSum = session.pain_summary||"";
  const impTip  = session.improvement_tip||"";
  const name    = profile?.name||user?.displayName||user?.email?.split("@")[0]||(isAr?"مستخدم":"User");
  const email   = user?.email||"";
  const dateStr = _fmtDate(session.created_at||new Date(), isAr);
  const realIdx = (()=>{
    if(sessionIndex)return sessionIndex;
    if(allSessions.length){const i=allSessions.findIndex(s=>(s.id||s.session_id)===(session.id||session.session_id));if(i>=0)return allSessions.length-i;}
    return 1;
  })();

  const mEntries = Object.entries(metrics)
    .filter(([k])=>!k.startsWith("_")&&metrics[k])
    .map(([k,v])=>{
      const sc=typeof v==="number"?v:(v?.score??100);
      const lbl=(isAr?METRIC_LABELS_AR[k]:METRIC_LABELS[k])||v?.label||k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      return{key:k,sc,lbl,value:v?.value,unit:v?.unit||""};
    }).sort((a,b)=>a.sc-b.sc);

  // ── NON-ELITE: premium preview + upsell ───────────────────────
  if(!isElite){
    _cover(doc,W,ml,tier,tierCol,name,realIdx,dateStr,avg,isAr);
    let y=76;

    // Report title
    font(doc,F.h1,"bold",isAr); tc(doc,...T.ink);
    doc.text(isAr?"تقرير تحليل الوضعية":"Posture Analysis Report",ml,y);
    font(doc,F.body,"normal",isAr); tc(doc,...T.muted);
    doc.text(`${name} · ${dateStr}`,ml,y+8); y+=20;
    hr(doc,ml,y,cw); y+=12;

    // Score ring + KPI chips
    _ring(doc,ml+22,y+24,19,avg,isAr);
    [[`${goodPct}%`,isAr?"جيدة":"Good",T.success],
     [String(session.alerts_count||0),isAr?"تنبيهات":"Alerts",T.warning],
     [_fmtDur(dur),isAr?"المدة":"Duration",T.primary]]
      .forEach(([v,l,col],i)=>_kpi(doc,ml+54+i*52,y+4,46,30,v,l,col));
    y+=62; hr(doc,ml,y,cw); y+=12;

    // Sparkline
    if(hist.length>2){
      y=_sh(doc,ml,y,isAr?"مسار النقاط":"Score Timeline","",gradeC,isAr);
      fc(doc,...T.bg); rr(doc,ml,y,cw,40,4,"F");
      dc(doc,...T.border); lw(doc,0.15); rr(doc,ml,y,cw,40,4,"S"); lw(doc,0.3);
      _spark(doc,hist,ml+12,y+7,cw-24,26,gradeC);
      y+=48;
    }

    // Top 3 metrics
    y=_sh(doc,ml,y,isAr?"أبرز المقاييس":"Key Metrics",isAr?"الأسوأ أداءً":"Worst first",gradeC,isAr);
    mEntries.slice(0,3).forEach(({lbl,value,unit,sc},i)=>{
      if(y>H-52)return;
      _mRow(doc,ml,y,cw,lbl,value,unit,sc,isAr,i); y+=25;
    });
    if(mEntries.length>3){
      fc(doc,...T.bg); rr(doc,ml,y,cw,12,2,"F");
      font(doc,F.small,"normal",isAr); tc(doc,...T.muted);
      doc.text(`+ ${mEntries.length-3} ${isAr?"مقاييس — رقّي لـ Elite":"more metrics — upgrade to Elite"}`,ml+cw/2,y+8,{align:"center"});
      y+=16;
    }

    // PAGE 2 — Upsell
    doc.addPage();
    fc(doc,...T.slate); doc.rect(0,0,W,H,"F");
    fc(doc,...T.primary);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.05}));
    doc.circle(W*.85,H*.3,90,"F"); doc.circle(W*.1,H*.75,60,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    fc(doc,...T.primary); doc.rect(0,0,W,3,"F");
    _logo(doc,W/2-16,42,32,_logoMd);
    font(doc,F.display,"bold",isAr); tc(doc,...T.card);
    doc.text(isAr?"افتح تقريرك الكامل":"Unlock Your Full Report",W/2,92,{align:"center"});
    font(doc,F.body+1,"normal",isAr); tc(doc,148,163,184);
    doc.text(isAr?"رقّي لـ Elite للوصول لكامل تجربة Corvus":"Upgrade to Corvus Elite for the complete experience",W/2,101,{align:"center"});
    hr(doc,ml+24,109,cw-48,[55,65,81]);
    const feats=[
      [T.success,"Complete Metrics Breakdown","All posture metrics with angles, trends & scores"],
      [T.primary,"Corvus AI Analysis","Personalised AI-generated clinical narrative"],
      [T.warning,"Spinal Zone Risk Map","Cervical · Thoracic · Lumbar risk assessment"],
      [T.cyan,"Prioritised Next Steps","3 tailored action cards from worst metrics"],
      [T.indigo,"Clinical PDF Report","Physiotherapist-ready report with full clinical detail"],
    ];
    let fy=117;
    feats.forEach(([col,title,desc])=>{
      fc(doc,...col); rr(doc,ml,fy,3,22,1.5,"F");
      font(doc,9.5,"bold",false); tc(doc,...T.card); doc.text(title,ml+10,fy+10);
      font(doc,7.5,"normal",false); tc(doc,100,116,139); doc.text(desc,ml+10,fy+17);
      fy+=27;
    });
    fy+=6;
    fc(doc,...T.success); rr(doc,ml,fy,cw,16,4,"F");
    font(doc,10,"bold",false); tc(doc,...T.card);
    doc.text("postureai-pro-omega-nine.vercel.app  →  Upgrade to Elite",W/2,fy+10.5,{align:"center"});

    const tot=doc.internal.getNumberOfPages();
    for(let p=1;p<=tot;p++){doc.setPage(p);_ftr(doc,W,ml,mr,H,p,tot,name);}
    doc.save(`Corvus_Session${realIdx}_${new Date().toISOString().slice(0,10)}.pdf`); return;
  }

  // ═══════════════════════════════════════════════════════════════
  // ELITE PAGE 1 — Cover + Summary
  // ═══════════════════════════════════════════════════════════════
  _cover(doc,W,ml,tier,tierCol,name,realIdx,dateStr,avg,isAr);
  let y=76;

  font(doc,F.h1,"bold",isAr); tc(doc,...T.ink);
  doc.text(isAr?"تقرير وضعية احترافي":"Professional Posture Report",ml,y);
  font(doc,F.body,"normal",isAr); tc(doc,...T.muted);
  doc.text(`${name} · ${email||"—"} · ${dateStr}`,ml,y+8); y+=20;
  hr(doc,ml,y,cw); y+=12;

  // Ring + 4 KPI chips
  _ring(doc,ml+22,y+24,19,avg,isAr);
  [[`${goodPct}%`,isAr?"جيدة":"Good",T.success],
   [String(session.alerts_count||0),isAr?"تنبيهات":"Alerts",T.warning],
   [_fmtDur(dur),isAr?"المدة":"Duration",T.primary],
   [`#${realIdx}`,isAr?"الجلسة":"Session",T.indigo]]
    .forEach(([v,l,col],i)=>_kpi(doc,ml+54+i*40,y+4,36,30,v,l,col));
  y+=62; hr(doc,ml,y,cw); y+=12;

  // Sparkline
  if(hist.length>2){
    y=_sh(doc,ml,y,isAr?"مسار النقاط":"Score Timeline",isAr?"الجلسة الكاملة":"Full session",gradeC,isAr);
    fc(doc,...T.bg); rr(doc,ml,y,cw,42,4,"F");
    dc(doc,...T.border); lw(doc,0.15); rr(doc,ml,y,cw,42,4,"S"); lw(doc,0.3);
    _spark(doc,hist,ml+12,y+7,cw-24,28,gradeC);
    y+=50;
  }

  if(painSum){ y=_callout(doc,ml,y,cw,painSum,"warning",isAr); }
  if(impTip)  { y=_callout(doc,ml,y,cw,impTip,"success",isAr); }

  y=_sh(doc,ml,y,isAr?"أبرز المقاييس":"Key Metrics",isAr?"مرتبة من الأسوأ":"Sorted worst first",gradeC,isAr);
  mEntries.slice(0,4).forEach(({lbl,value,unit,sc},i)=>{
    if(y>H-46)return;
    _mRow(doc,ml,y,cw,lbl,value,unit,sc,isAr,i); y+=25;
  });

  // ═══════════════════════════════════════════════════════════════
  // ELITE PAGE 2 — All metrics + Zonal map
  // ═══════════════════════════════════════════════════════════════
  doc.addPage(); _hdr(doc,W,ml,mr,isAr?"تفاصيل المقاييس":"Metrics Detail",isAr); y=24;
  y=_sh(doc,ml,y,isAr?"جميع مقاييس الوضعية":"Complete Posture Metrics",isAr?"مرتبة من الأسوأ":"Worst to best",gradeC,isAr);
  mEntries.forEach(({lbl,value,unit,sc},i)=>{
    if(y>H-38){doc.addPage();_hdr(doc,W,ml,mr,isAr?"تابع":"Continued",isAr);y=24;}
    _mRow(doc,ml,y,cw,lbl,value,unit,sc,isAr,i); y+=25;
  });

  y+=4; if(y>H-100){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خريطة المخاطر":"Risk Map",isAr);y=24;}
  y=_sh(doc,ml,y,isAr?"خريطة مناطق الخطر":"Spinal Zone Risk Map",isAr?"من بيانات الجلسة — ليس تشخيصاً طبياً":"Derived from session data · not a medical diagnosis",T.danger,isAr);
  const zonal=_zonalRisk(metrics);
  [{k:"cervical",en:"Cervical (Neck)",ar:"منطقة الرقبة",r:"C1–C7",
    desc:"Neck lean, FHP, and rotational deviation. Elevation increases cervical disc load and headache risk.",m:"Neck Lean, FHP, Head Tilt/Yaw"},
   {k:"thoracic",en:"Thoracic (Upper Back)",ar:"الظهر العلوي",r:"T1–T12",
    desc:"Shoulder symmetry and upper spinal curvature. Sustained elevation indicates kyphosis or rotator cuff risk.",m:"Shoulder Balance, Rounded Shoulders, Spine"},
   {k:"lumbar",en:"Lumbar (Lower Back)",ar:"أسفل الظهر",r:"L1–S1",
    desc:"Spinal alignment, hip angle, and pelvic positioning. Risk elevation may indicate disc asymmetry or flexion intolerance.",m:"Spine Alignment, Hip Angle, Trunk Lean"},
  ].forEach(({k,en,ar,r,desc,m})=>{
    if(y>H-65){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خريطة المخاطر":"Risk Map",isAr);y=24;}
    y=_zone(doc,ml,y,cw,isAr?ar:en,r,zonal[k]||0,desc,m,isAr);
  });

  // ═══════════════════════════════════════════════════════════════
  // ELITE PAGE 3 — AI + Next Steps + Stats
  // ═══════════════════════════════════════════════════════════════
  doc.addPage(); _hdr(doc,W,ml,mr,isAr?"التحليل والتوصيات":"Analysis & Recommendations",isAr); y=24;

  if(aiText){
    y=_sh(doc,ml,y,isAr?"تحليل Corvus AI":"Corvus AI Analysis",isAr?"مولّد خصيصاً لجلستك":"Generated specifically for this session",T.primary,isAr);
    fc(doc,...T.bg); rr(doc,ml,y,cw,6,2,"F"); y+=9;
    const aiLines=doc.splitTextToSize(aiText.replace(/[#*`]/g,"").trim(),cw-6);
    font(doc,F.body,"normal",isAr); tc(doc,...T.sub);
    aiLines.forEach(l=>{
      if(y>H-28){doc.addPage();_hdr(doc,W,ml,mr,"AI Analysis",isAr);y=24;}
      doc.text(l,ml+3,y); y+=5.2;
    });
    y+=10; hr(doc,ml,y,cw); y+=12;
  }

  if(y>H-110){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الخطوات التالية":"Next Steps",isAr);y=24;}
  y=_sh(doc,ml,y,isAr?"الخطوات العملية المقترحة":"Prioritised Next Steps",isAr?"بناءً على أسوأ المقاييس":"Based on worst-performing metrics",T.success,isAr);

  const NXT={
    neck:["Raise monitor: top edge at eye level","Chin tuck gently — ear over shoulder","Set a posture alert every 20 min"],
    neck_lean:["Raise monitor: top edge at eye level","Chin tuck gently — ear over shoulder","Cervical retraction: 10 reps × 3 sets daily"],
    yaw:["Centre monitor directly in front","Avoid sustained head rotation","Chin tucks: 10 reps × 3 sets daily"],
    dist:["Maintain 50–70cm screen distance","Increase font size to avoid leaning","20-20-20 rule: every 20 min look 20ft away"],
    posture:["Sit fully back against lumbar support","Feet flat, knees at 90°","Stand 5 min every 45 min"],
    shoulder:["Level armrests to equal height","Shoulder rolls backward 10 reps × 3","Doorway chest stretch 30s × 2 daily"],
    spine:["Align ear, shoulder, hip vertically","Use lumbar roll or support cushion","Core brace 30s × 5 reps daily"],
    rounded:["Retract shoulder blades together","Band pull-aparts 15 reps × 3","Pec doorway stretch 30s × 2 daily"],
    elbow:["Lower keyboard so elbows rest at 90°","Keep keyboard close to body","Wrist break every 45 min"],
    monitor:["Top of screen at eye level","Use laptop stand + external keyboard","Reduce neck flexion with tray adjustment"],
    distance:["Screen 50-80cm from eyes","Larger font = less lean","20-20-20 rule every 20 min"],
    default:["2-min stretch break every 30 min","Roll shoulders backward 5 times","Walk 5 min every hour"],
  };
  mEntries.slice(0,3).forEach(({key,lbl,sc},i)=>{
    if(y>H-54){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الخطوات التالية":"Next Steps",isAr);y=24;}
    y=_step(doc,ml,y,cw,i+1,lbl,sc,NXT[key]||NXT.default,isAr);
  });

  y+=4; if(y>H-75){doc.addPage();_hdr(doc,W,ml,mr,isAr?"إحصائيات":"Statistics",isAr);y=24;}
  y=_sh(doc,ml,y,isAr?"إحصائيات الجلسة":"Session Statistics","",gradeC,isAr);
  fc(doc,...T.card); rr(doc,ml,y,cw,72,4,"F");
  dc(doc,...T.border); lw(doc,0.15); rr(doc,ml,y,cw,72,4,"S"); lw(doc,0.3);
  [
    [isAr?"النتيجة الكلية":"Overall Score",`${avg}/100 — ${_sl(avg,isAr)}`],
    [isAr?"المدة":"Duration",_fmtDur(dur)],
    [isAr?"وضعية جيدة":"Good Posture",`${goodPct}%`],
    [isAr?"التنبيهات":"Alerts",String(session.alerts_count||0)],
    [isAr?"وضع الكاميرا":"Camera Mode",(session.mode||"laptop").toUpperCase()],
    [isAr?"المستوى":"Tier",tier.toUpperCase()],
    [isAr?"تاريخ الجلسة":"Date",dateStr],
    [isAr?"رقم الجلسة":"Session #",String(realIdx)],
  ].forEach(([k,v],i)=>{_iRow(doc,ml,y,cw,k,v,i%2===0,isAr);y+=8.5;});

  const tot2=doc.internal.getNumberOfPages();
  for(let p=1;p<=tot2;p++){doc.setPage(p);_ftr(doc,W,ml,mr,H,p,tot2,name);}
  doc.save(`Corvus_Elite_Report_${realIdx}_${new Date().toISOString().slice(0,10)}.pdf`);
}


export async function generateClinicalPDF({ session, profile, user, lang="en", sessionIndex, allSessions=[] }) {
  const { jsPDF } = await import("jspdf");
  const isAr  = lang === "ar";
  const doc   = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W=210, H=297, ml=18, mr=18, cw=W-ml-mr;

  const tier    = profile?.tier || session.tier || "standard";
  if (!tierAtLeast(tier,"elite")) throw new Error("Clinical PDF requires Elite tier");

  // Load Cairo for Arabic support
  const cairo = await _loadCairo(doc);
  const fnt = (size, style="normal") => cairo && isAr ? fontAr(doc,size,style,true) : font(doc,size,style);

  const avg     = Math.round(session.avg_score || 0);
  const dur     = session.duration_s || session.duration_sec || 0;
  const goodPct = session.good_pct || 0;
  const metrics = session.metrics || {};
  const hist    = session.score_history || [];
  const name    = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Patient";
  const email   = user?.email || "";
  const dob     = profile?.dob || "—";
  const gradeC  = _gc(avg);
  const zonal   = _zonalRisk(metrics);
  const now     = new Date();
  const dateStr = now.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});

  const realIndex = (() => {
    if (sessionIndex) return sessionIndex;
    if (allSessions.length) {
      const idx = allSessions.findIndex(s=>(s.id||s.session_id)===(session.id||session.session_id));
      if (idx>=0) return allSessions.length - idx;
    }
    return 1;
  })();

  const metricEntries = Object.entries(metrics)
    .filter(([k])=>!k.startsWith("_") && metrics[k])
    .map(([k,v])=>{
      const sc  = typeof v==="number" ? v : (v?.score ?? 100);
      const lbl = METRIC_LABELS[k] || v?.label || k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      return { key:k, sc, lbl, value:v?.value, unit:v?.unit||"" };
    })
    .sort((a,b)=>a.sc-b.sc);

  let y=0;

  // ── PAGE 1: Clinical Header + Patient Info ────────────────────
  // Clinical header — formal white + navy
  doc.setFillColor(15,23,42); doc.rect(0,0,W,36,"F");
  doc.setFontSize(14); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text("CORVUS POSTURE HEALTH", ml, 16);
  doc.setFontSize(8.5); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal");
  doc.text("AI-Assisted Workplace Ergonomics & Posture Assessment", ml, 23);
  doc.text("For Clinical Review — Not for Diagnostic Purposes", ml, 29.5);

  // Document type badge
  doc.setFillColor(14,165,233); doc.roundedRect(W-mr-42,10,42,14,2,2,"F");
  doc.setFontSize(8); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text("CLINICAL SUMMARY", W-mr-21, 18.5, {align:"center"});
  doc.setFontSize(6.5); doc.setTextColor(186,230,253); doc.setFont("helvetica","normal");
  doc.text("PHYSIOTHERAPIST REPORT", W-mr-21, 23.5, {align:"center"});

  y=46;

  // Patient Info block
  doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,32,3,3,"F");
  doc.setDrawColor(226,232,240); doc.setLineWidth(0.4); doc.roundedRect(ml,y,cw,32,3,3,"S"); doc.setLineWidth(0.3);

  doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","bold");
  doc.text("PATIENT INFORMATION", ml+4, y+7);
  doc.setFontSize(8.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","normal");
  [
    [`Patient Name:`, name, ml+4],
    [`Email:`, email, ml+4],
    [`Date of Assessment:`, dateStr, ml+cw/2+4],
    [`Session Reference:`, `#${realIndex}`, ml+cw/2+4],
    [`Session Duration:`, _fmtDur(dur), ml+4],
    [`Recording Mode:`, session.mode||"Laptop Camera", ml+cw/2+4],
  ].forEach(([lbl,val,x],i) => {
    const row = Math.floor(i/2);
    const yy = y+13+(row*8);
    doc.setFont("helvetica","bold"); doc.setTextColor(100,116,139); doc.setFontSize(7.5);
    doc.text(lbl, x, yy);
    doc.setFont("helvetica","normal"); doc.setTextColor(15,23,42); doc.setFontSize(8.5);
    doc.text(val||"—", x+32, yy);
  });
  y+=40;

  // ── Overall score clinical interpretation ─────────────────────
  doc.setFontSize(11); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Overall Posture Score", ml, y); y+=6;

  doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,36,3,3,"F");
  doc.setDrawColor(...gradeC); doc.setLineWidth(0.5); doc.roundedRect(ml,y,cw,36,3,3,"S"); doc.setLineWidth(0.3);

  const cx2=ml+20, cy2=y+18;
  doc.setFillColor(...gradeC); doc.circle(cx2,cy2,13,"F");
  doc.setFontSize(15); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text(String(avg), cx2, cy2+5.5, {align:"center"});
  doc.setFontSize(7); doc.text("/100", cx2, cy2+10.5, {align:"center"});

  const interpretation = avg>=80
    ? "Posture quality is consistently good. Preventive ergonomic advice appropriate."
    : avg>=60
    ? "Moderate posture deviations observed. Targeted ergonomic intervention recommended."
    : "Significant postural deficits detected across multiple planes. Clinical assessment advised.";
  doc.setFontSize(9); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text(_gl(avg,false), ml+38, y+12);
  doc.setFontSize(8); doc.setTextColor(51,65,85); doc.setFont("helvetica","normal");
  const interpLines = doc.splitTextToSize(interpretation, cw-44);
  interpLines.forEach((l,i)=>doc.text(l, ml+38, y+20+(i*6)));
  doc.setFontSize(7.5); doc.setTextColor(100,116,139);
  doc.text(`Good posture maintained: ${goodPct}% of session  |  Alerts triggered: ${session.alerts_count||0}`, ml+38, y+33);
  y+=44;

  // ── Score timeline ────────────────────────────────────────────
  if (hist.length>2) {
    doc.setFontSize(10); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text("Posture Score Timeline (Full Session)", ml, y); y+=4;
    doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text("Continuous posture quality measurement from session start to end", ml, y); y+=5;
    const sh=28;
    doc.setFillColor(241,245,249); doc.roundedRect(ml,y,cw,sh,2,2,"F");
    [50,65,80,95].forEach(v=>{
      const gy=y+sh-2-((v-40)/60)*(sh-4);
      doc.setDrawColor(200,210,220); doc.setLineWidth(0.15); doc.line(ml+2,gy,ml+cw-2,gy);
      doc.setFontSize(4.5); doc.setTextColor(160,174,192); doc.text(String(v),ml,gy+1.5,{align:"right"});
    });
    _drawSparkline(doc,hist,ml+3,y+2,cw-6,sh-4,gradeC);
    y+=sh+10;
  }

  // ── PAGE 2: Zonal Pain Map ────────────────────────────────────
  doc.addPage();
  doc.setFillColor(15,23,42); doc.rect(0,0,W,12,"F");
  doc.setFontSize(8); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal");
  doc.text("Corvus Posture Health — Clinical Summary", ml, 8.5);
  doc.setFontSize(7.5); doc.setTextColor(14,165,233); doc.setFont("helvetica","bold");
  doc.text("PHYSIOTHERAPIST REPORT", W-mr, 8.5, {align:"right"});
  y=22;

  doc.setFontSize(12); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Spinal Zone Risk Assessment", ml, y); y+=5;
  doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text("Risk percentages are derived computationally from posture metrics. They are not medical diagnoses.", ml, y); y+=9;

  const clinicalZones = [
    {
      key:"cervical", region:"C1–C7", title:"Cervical Spine (Neck)",
      desc:"Assesses head position, neck lean, forward head posture, and rotational deviation. Elevated risk correlates with increased load on cervical discs and potential for tension-type headache, cervicogenic dizziness, or upper trapezius hypertonicity.",
      metrics:"Neck Lean, Forward Head Posture, Head Tilt, Head Rotation",
    },
    {
      key:"thoracic", region:"T1–T12", title:"Thoracic Spine (Upper Back)",
      desc:"Evaluates shoulder symmetry, rounded shoulder posture, and upper spinal curvature. Chronic elevation indicates risk for thoracic kyphosis progression, intercostal restriction, or rotator cuff impingement patterns.",
      metrics:"Shoulder Balance, Rounded Shoulders, Spine Lean, Trunk Lean",
    },
    {
      key:"lumbar", region:"L1–S1", title:"Lumbar Spine (Lower Back)",
      desc:"Measures sagittal and coronal spinal alignment, hip angle, and pelvic positioning relative to trunk. Risk elevation may indicate posterior chain tightness, lumbar flexion intolerance, or disc load asymmetry.",
      metrics:"Spine Alignment, Hip Angle, Trunk Lean",
    },
  ];

  clinicalZones.forEach(({key,region,title,desc,metrics:mlist})=>{
    if(y>H-72){doc.addPage();y=22;}
    const risk=zonal[key]||0;
    const rcol=_riskColor(risk);
    const rlbl=_riskLabel(risk,false);

    doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,52,3,3,"F");
    doc.setDrawColor(...rcol); doc.setLineWidth(0.5); doc.roundedRect(ml,y,cw,52,3,3,"S"); doc.setLineWidth(0.3);

    // Zone identifier
    doc.setFillColor(...rcol); doc.roundedRect(ml+2,y+2,22,22,2,2,"F");
    doc.setFontSize(13); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    doc.text(`${risk}%`, ml+13, y+13.5, {align:"center"});
    doc.setFontSize(6); doc.text("RISK", ml+13, y+20, {align:"center"});

    doc.setFontSize(9.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(title, ml+28, y+8);
    doc.setFontSize(7.5); doc.setTextColor(14,165,233); doc.setFont("helvetica","bold");
    doc.text(region, ml+28, y+14);
    doc.setFontSize(7); doc.setTextColor(...rcol); doc.setFont("helvetica","bold");
    doc.text(`Risk Level: ${rlbl}`, ml+28, y+20);

    // Risk bar
    const bx=ml+cw*0.52, bw2=cw*0.46;
    doc.setFillColor(226,232,240); doc.roundedRect(bx,y+15,bw2,4,1,1,"F");
    doc.setFillColor(...rcol); doc.roundedRect(bx,y+15,Math.max(bw2*(risk/100),3),4,1,1,"F");

    // Description
    doc.setFontSize(7.5); doc.setTextColor(51,65,85); doc.setFont("helvetica","normal");
    const descLines = doc.splitTextToSize(desc, cw-8);
    descLines.slice(0,4).forEach((l,i)=>doc.text(l, ml+4, y+30+(i*5.5)));

    // Metrics source
    doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","bold");
    doc.text("Contributing metrics: ", ml+4, y+53.5);
    doc.setFont("helvetica","normal"); doc.text(mlist, ml+38, y+53.5);

    y+=58;
  });

  // ── PAGE 3: Metrics Detail + Clinical Recommendations ─────────
  doc.addPage();
  doc.setFillColor(15,23,42); doc.rect(0,0,W,12,"F");
  doc.setFontSize(8); doc.setTextColor(148,163,184); doc.setFont("helvetica","normal");
  doc.text("Corvus Posture Health — Clinical Summary", ml, 8.5);
  doc.setFontSize(7.5); doc.setTextColor(14,165,233); doc.setFont("helvetica","bold");
  doc.text("PHYSIOTHERAPIST REPORT", W-mr, 8.5, {align:"right"});
  y=22;

  // All metrics in clinical table style
  doc.setFontSize(11); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Posture Metrics Detail", ml, y); y+=7;

  // Table header
  doc.setFillColor(15,23,42); doc.roundedRect(ml,y,cw,9,2,2,"F");
  doc.setFontSize(7); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  ["Measurement","Value","Score","Status"].forEach((h,i)=>{
    const xs=[ml+3, ml+cw*0.38, ml+cw*0.56, ml+cw*0.72];
    doc.text(h, xs[i], y+6);
  });
  y+=11;

  metricEntries.forEach(({lbl,value,unit,sc},i)=>{
    if(y>H-40){doc.addPage();y=22;}
    doc.setFillColor(i%2===0?248:255, i%2===0?250:255, i%2===0?252:255);
    doc.rect(ml,y,cw,9,"F");
    const col=_gc(sc);
    doc.setFontSize(8); doc.setTextColor(15,23,42); doc.setFont("helvetica","normal");
    doc.text(lbl, ml+3, y+6);
    doc.setTextColor(...col); doc.setFont("helvetica","bold");
    if(value!==undefined&&value!==null) doc.text(`${Math.round(value*10)/10}${unit}`, ml+cw*0.38, y+6);
    doc.text(String(Math.round(sc)), ml+cw*0.56, y+6);
    doc.setFontSize(7.5); doc.text(_gl(sc,false), ml+cw*0.72, y+6);
    y+=9;
  });

  y+=10;

  // Clinical recommendations
  if(y>H-80){doc.addPage();y=22;}
  doc.setFontSize(11); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Clinical Notes & Recommendations", ml, y); y+=5;
  doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text("Suggested focus areas based on session measurements. Please apply clinical judgment.", ml, y); y+=9;

  const clinicalRecos = [
    avg < 60
      ? "Multiple significant postural deviations recorded. A full postural assessment with manual palpation is recommended to correlate screen findings with physical examination."
      : avg < 80
      ? "Moderate postural deviations identified in one or more planes. Targeted manual therapy and corrective exercise programming are likely to yield measurable improvement."
      : "Posture quality is broadly good during monitored sessions. Reinforce current patterns and provide guidance on ergonomic optimisation for unmonitored work periods.",
    zonal.cervical > 45
      ? "Cervical zone shows elevated risk. Assess for upper cervical hypomobility, scalene/SCM tightness, and forward head posture. Chin tuck + deep neck flexor strengthening indicated."
      : "Cervical zone within acceptable range. Monitor for creep during extended work sessions.",
    zonal.thoracic > 45
      ? "Thoracic zone elevated. Assess for thoracic extension restriction and pectoralis minor tightness. Thoracic mobilisation and posterior chain activation recommended."
      : "Thoracic zone acceptable. Encourage thoracic extension breaks during prolonged sitting.",
    zonal.lumbar > 45
      ? "Lumbar zone shows concern. Assess lumbar flexion/extension range, hip flexor length, and lumbar stabiliser activation. Consider ergonomic chair and sit-stand desk assessment."
      : "Lumbar zone within expected range. Advise on maintaining lumbar lordosis during seated work.",
  ];

  clinicalRecos.forEach((rec,i)=>{
    if(y>H-35){doc.addPage();y=22;}
    doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,22,2,2,"F");
    doc.setFontSize(8); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    const zones2 = ["General Assessment","Cervical Focus","Thoracic Focus","Lumbar Focus"];
    doc.text(`${i+1}. ${zones2[i]}`, ml+4, y+7);
    doc.setFont("helvetica","normal"); doc.setTextColor(51,65,85);
    const recLines = doc.splitTextToSize(rec, cw-10);
    recLines.slice(0,2).forEach((l,li)=>doc.text(l, ml+4, y+13+(li*5.5)));
    y+=26;
  });

  // ── Disclaimer + Signature block ─────────────────────────────
  y+=8;
  if(y>H-50){doc.addPage();y=22;}
  doc.setFillColor(254,243,199); doc.roundedRect(ml,y,cw,20,2,2,"F");
  doc.setFontSize(7.5); doc.setTextColor(146,64,14); doc.setFont("helvetica","bold");
  doc.text("IMPORTANT DISCLAIMER", ml+4, y+7);
  doc.setFont("helvetica","normal"); doc.setTextColor(120,53,15);
  const disc="This report is generated by an AI-based postural monitoring system and is intended to supplement, not replace, professional clinical assessment. Findings should be interpreted alongside a full physical examination by a qualified physiotherapist or medical professional.";
  const discLines=doc.splitTextToSize(disc,cw-8);
  discLines.forEach((l,i)=>doc.text(l,ml+4,y+13+(i*4.5)));
  y+=26;

  // Signature block
  y+=8;
  doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,28,3,3,"F");
  doc.setFontSize(8); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text("Reviewing Clinician:", ml+4, y+8);
  doc.text("Signature:", ml+cw/2+4, y+8);
  doc.setDrawColor(100,116,139); doc.setLineWidth(0.3);
  doc.line(ml+4, y+18, ml+cw/2-4, y+18);
  doc.line(ml+cw/2+4, y+18, ml+cw-4, y+18);
  doc.setFontSize(7); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text("Name / Clinic", ml+4, y+23);
  doc.text("Date reviewed", ml+cw/2+4, y+23);

  // Page numbers
  const totalPages2=doc.internal.getNumberOfPages();
  for(let p=1;p<=totalPages2;p++){
    doc.setPage(p);
    doc.setFillColor(15,23,42); doc.rect(0,H-8,W,8,"F");
    doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text(`Corvus Posture Health — Clinical Report — ${dateStr} — Confidential`, ml, H-2.5);
    doc.text(`${p} / ${totalPages2}`, W-mr, H-2.5, {align:"right"});
  }

  const filename=`Corvus_Clinical_Report_Session${realIndex}_${now.toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
  return filename;
}
