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
// PDF HELPERS (shared by both generators)
// ─────────────────────────────────────────────────────────────────
function _gc(s) { return s>=80?[16,185,129]:s>=60?[245,158,11]:[239,68,68]; }
function _gl(s, isAr) {
  return s>=80?(isAr?"ممتاز":"Excellent"):s>=60?(isAr?"جيد":"Good"):(isAr?"يحتاج تحسين":"Needs Work");
}
function _fmtDur(s) {
  if (!s) return "—";
  const m = Math.floor(s/60), sec = s%60;
  return `${m>0?m+"m ":""}${sec}s`;
}
function _fmtDate(ts, isAr) {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString(isAr?"ar-EG":"en-US",{weekday:"short",year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
  } catch { return "—"; }
}

// ── Corvus ◈ logo drawn with primitives (no external image needed)
function _drawLogo(doc, x, y, size=22) {
  const half = size/2;
  doc.setFillColor(26, 86, 219);
  doc.roundedRect(x, y, size, size, 3, 3, "F");
  doc.setFontSize(Math.round(size*0.7));
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.text("◈", x + half, y + half*1.38, { align:"center" });
}

// ── Draw sparkline with filled area
function _drawSparkline(doc, hist, x, y, w, h, color) {
  const slice = hist.length > 80 ? hist.filter((_,i)=> i % Math.ceil(hist.length/80) === 0) : hist;
  if (slice.length < 2) return;
  const minS = Math.max(0,  Math.min(...slice) - 5);
  const maxS = Math.min(100, Math.max(...slice) + 5);
  const rng  = Math.max(maxS - minS, 10);
  const pts  = slice.map((s,i,a) => ({
    px: x + (i / Math.max(a.length-1,1)) * w,
    py: y + h - ((s - minS) / rng) * (h - 2),
  }));
  // Filled area polygon (close at bottom)
  const polyPts = [
    ...pts.map(p => [p.px, p.py]),
    [pts[pts.length-1].px, y+h],
    [pts[0].px, y+h],
  ];
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setGState(doc.GState ? new doc.GState({opacity:0.18}) : {});
  try { doc.lines(polyPts.map(([px,py],i)=> i===0?[px,py]:[px-polyPts[i-1][0], py-polyPts[i-1][1]]), polyPts[0][0], polyPts[0][1], [1,1], "F", true); } catch {}
  doc.setGState(doc.GState ? new doc.GState({opacity:1}) : {});
  // Line
  doc.setDrawColor(...color); doc.setLineWidth(1.0);
  pts.forEach((p,i) => { if (i>0) doc.line(pts[i-1].px, pts[i-1].py, p.px, p.py); });
  // Start / end dots
  doc.setFillColor(...color);
  doc.circle(pts[0].px, pts[0].py, 1.2, "F");
  doc.circle(pts[pts.length-1].px, pts[pts.length-1].py, 1.8, "F");
  // Score labels at start and end
  doc.setFontSize(6); doc.setTextColor(...color); doc.setFont("helvetica","bold");
  doc.text(String(slice[0]), pts[0].px, pts[0].py - 2.5, {align:"center"});
  doc.text(String(slice[slice.length-1]), pts[pts.length-1].px, pts[pts.length-1].py - 2.5, {align:"center"});
}

// ── Metric bar card
function _metricCard(doc, x, y, w, lbl, value, unit, score, isAr) {
  const col = _gc(score);
  const gLbl = _gl(score, isAr);
  doc.setFillColor(248,250,252); doc.roundedRect(x, y, w, 16, 2, 2, "F");
  // Score badge left
  doc.setFillColor(...col); doc.roundedRect(x+1, y+1, 14, 14, 2, 2, "F");
  doc.setFontSize(8); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text(String(Math.round(score)), x+8, y+10, {align:"center"});
  // Label
  doc.setFontSize(8.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","normal");
  doc.text(lbl, x+18, y+7);
  // Value
  if (value !== undefined && value !== null) {
    doc.setFontSize(8); doc.setTextColor(...col); doc.setFont("helvetica","bold");
    doc.text(`${Math.round(value*10)/10}${unit||""}`, x+18, y+13.5);
  }
  // Grade
  doc.setFontSize(7); doc.setTextColor(...col); doc.setFont("helvetica","normal");
  doc.text(gLbl, x+w-2, y+7, {align:"right"});
  // Bar
  const bx = x+w*0.45, bw2 = w*0.52;
  doc.setFillColor(226,232,240); doc.roundedRect(bx, y+5.5, bw2, 3.5, 1, 1, "F");
  doc.setFillColor(...col); doc.roundedRect(bx, y+5.5, Math.max(bw2*(score/100), 2), 3.5, 1, 1, "F");
}

// ── Page header strip (for page 2+)
function _pageHeader(doc, W, ml, mr, tier, tierColor, isAr) {
  doc.setFillColor(3,11,20); doc.rect(0,0,W,12,"F");
  doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text("Corvus — " + (isAr?"تقرير الوضعية":"Posture Report"), ml, 8.5);
  doc.setFontSize(7.5); doc.setTextColor(...tierColor); doc.setFont("helvetica","bold");
  doc.text(tier.toUpperCase(), W-mr, 8.5, {align:"right"});
}

// ─────────────────────────────────────────────────────────────────
// SESSION PDF (Elite: full report. Non-elite: locked + upsell)
// ─────────────────────────────────────────────────────────────────
export async function generateSessionPDF({ session, profile, user, lang="en", sessionIndex, allSessions=[] }) {
  const { jsPDF } = await import("jspdf");
  const isAr    = lang === "ar";
  // Always use the CURRENT profile tier — not the session's saved tier —
  // so that users who upgraded see Elite PDF for old sessions too.
  const tier    = profile?.tier || session.tier || "standard";
  const isElite = tierAtLeast(tier, "elite");
  const doc   = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W=210, H=297, ml=18, mr=18, cw=W-ml-mr;
  const tierColor = isElite?[16,185,129]:tierAtLeast(tier,"professional")?[14,165,233]:[99,102,241];

  const avg     = Math.round(session.avg_score || 0);
  const dur     = session.duration_s || session.duration_sec || 0;
  const goodPct = session.good_pct || 0;
  const gradeC  = _gc(avg);
  const metrics = session.metrics || {};
  const hist    = session.score_history || [];
  const aiText  = session.ai_tip || session.ai_insight || session.claude_analysis || "";
  const painSum = session.pain_summary || "";
  const impTip  = session.improvement_tip || "";
  const name    = profile?.name || user?.displayName || user?.email?.split("@")[0] || (isAr?"مستخدم":"User");
  const email   = user?.email || "";

  // ── Correct session index: look up real position in history
  const realIndex = (() => {
    if (sessionIndex) return sessionIndex;
    if (allSessions.length) {
      const idx = allSessions.findIndex(s=>(s.id||s.session_id)===(session.id||session.session_id));
      if (idx>=0) return allSessions.length - idx;
    }
    return 1;
  })();

  // ── Metric entries sorted worst → best with proper labels
  const metricEntries = Object.entries(metrics)
    .filter(([k])=>!k.startsWith("_") && metrics[k])
    .map(([k,v])=>{
      const sc  = typeof v==="number" ? v : (v?.score ?? 100);
      const lbl = (isAr ? METRIC_LABELS_AR[k] : METRIC_LABELS[k])
        || v?.label
        || k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      return { key:k, sc, lbl, value:v?.value, unit:v?.unit||"" };
    })
    .sort((a,b)=>a.sc-b.sc);

  // ── NON-ELITE: 1-page locked report + upsell page ─────────────
  if (!isElite) {
    // Page 1 — Blurred/locked preview
    doc.setFillColor(3,11,20); doc.rect(0,0,W,42,"F");
    _drawLogo(doc, ml, 10, 20);
    doc.setFontSize(20); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    doc.text("Corvus", ml+26, 18);
    doc.setFontSize(8.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text("Personal Posture Analysis Report", ml+26, 26);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}`, ml+26, 32.5);
    doc.setFillColor(...tierColor); doc.roundedRect(W-mr-28,13,28,9,2,2,"F");
    doc.setFontSize(7); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    doc.text(tier.toUpperCase(), W-mr-14, 19.5, {align:"center"});

    let y = 52;
    doc.setFontSize(14); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(`Session #${realIndex}`, ml, y); y+=6;
    doc.setFontSize(8.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text(_fmtDate(session.created_at, isAr), ml, y); y+=12;

    // Score card
    doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,40,4,4,"F");
    doc.setDrawColor(...gradeC); doc.setLineWidth(0.5); doc.roundedRect(ml,y,cw,40,4,4,"S");
    doc.setLineWidth(0.3);
    const cx=ml+26, cy=y+20;
    doc.setFillColor(...gradeC); doc.circle(cx,cy,15,"F");
    doc.setFontSize(17); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    doc.text(String(avg), cx, cy+6, {align:"center"});
    doc.setFontSize(7); doc.text("/100", cx, cy+11.5, {align:"center"});
    doc.setFontSize(17); doc.setTextColor(...gradeC); doc.setFont("helvetica","bold");
    doc.text(_gl(avg, isAr), ml+48, y+16);
    doc.setFontSize(9); doc.setTextColor(71,85,105); doc.setFont("helvetica","normal");
    doc.text("Overall Posture Score", ml+48, y+25);
    doc.setFontSize(8.5); doc.text(`Duration: ${_fmtDur(dur)}`, ml+48, y+33);
    [[`${goodPct}%`,"Good"],[String(session.alerts_count||0),"Alerts"],[`#${realIndex}`,"Session"]].forEach(([v,l],i)=>{
      const sx = cw-52+i*20+ml;
      doc.setFontSize(13); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold"); doc.text(v,sx,y+18,{align:"center"});
      doc.setFontSize(6); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal"); doc.text(l,sx,y+25,{align:"center"});
    });
    y+=50;

    // Sparkline (full session, not just last 60)
    if (hist.length>2) {
      doc.setFontSize(9); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
      doc.text("Score Timeline", ml, y); y+=4;
      doc.setFillColor(241,245,249); doc.roundedRect(ml,y,cw,26,3,3,"F");
      [50,65,80].forEach(v=>{
        const gy=y+26-3-((v-40)/60)*22;
        doc.setDrawColor(200,210,220); doc.setLineWidth(0.15); doc.line(ml+2,gy,ml+cw-2,gy);
        doc.setFontSize(5); doc.setTextColor(160,174,192); doc.text(String(v),ml,gy+1.5,{align:"right"});
      });
      _drawSparkline(doc,hist,ml+3,y+2,cw-6,22,gradeC);
      y+=32;
    }

    // Top 3 metrics (blurred feel — low opacity labels)
    if (metricEntries.length>0) {
      doc.setFontSize(9.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
      doc.text("Key Posture Metrics", ml, y); y+=6;
      metricEntries.slice(0,3).forEach(({lbl,value,unit,sc})=>{
        if(y>H-70) return;
        _metricCard(doc,ml,y,cw,lbl,value,unit,sc,isAr);
        y+=19;
      });
      // Blurred/locked indicator for remaining
      if (metricEntries.length>3) {
        doc.setFillColor(241,245,249); doc.roundedRect(ml,y,cw,12,2,2,"F");
        doc.setFontSize(8.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
        doc.text(`+ ${metricEntries.length-3} more metrics locked — upgrade to Elite to see full breakdown`, ml+cw/2, y+8, {align:"center"});
        y+=16;
      }
    }

    // Footer
    const footerY=H-22;
    doc.setFillColor(241,245,249); doc.rect(0,footerY,W,22,"F");
    doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text(`Name: ${name}`, ml, footerY+7);
    doc.text(`Email: ${email}`, ml, footerY+13);
    doc.text(`Company: ${profile?.company||"—"}`, W-mr, footerY+7, {align:"right"});
    doc.text(`ID: ${(session.session_id||session.id||"—").slice(0,14)||"—"}`, W-mr, footerY+13, {align:"right"});

    // Page 2 — Upsell
    doc.addPage();
    doc.setFillColor(3,11,20); doc.rect(0,0,W,H,"F");
    _drawLogo(doc, W/2-11, 48, 22);
    doc.setFontSize(22); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    doc.text("Unlock Your Full Report", W/2, 90, {align:"center"});
    doc.setFontSize(10); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text("Upgrade to Corvus Elite to access:", W/2, 102, {align:"center"});

    const features = [
      ["📊","Complete Metrics Breakdown","All posture metrics with scores, angles & trends"],
      ["🤖","Corvus AI Analysis","Personalised AI-generated narrative for your session"],
      ["🗺️","Zonal Pain Map","Cervical / Thoracic / Lumbar risk assessment"],
      ["🎯","Next Steps","3 prioritised actions built from your worst metrics"],
      ["📈","Score Timeline","Full session sparkline, not just a snapshot"],
      ["🩺","Clinical PDF","Share a physiotherapist-ready report with your doctor"],
    ];

    let fy = 116;
    features.forEach(([icon, title, desc])=>{
      doc.setFillColor(255,255,255); doc.setFillColor(26,36,56);
      doc.roundedRect(ml, fy, cw, 20, 3, 3, "F");
      doc.setFontSize(13); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
      doc.text(icon, ml+8, fy+13);
      doc.setFontSize(9.5); doc.setTextColor(248,250,252); doc.setFont("helvetica","bold");
      doc.text(title, ml+18, fy+9);
      doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
      doc.text(desc, ml+18, fy+16);
      fy+=24;
    });

    doc.setFillColor(16,185,129); doc.roundedRect(ml, fy+6, cw, 16, 3, 3, "F");
    doc.setFontSize(11); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    doc.text("Upgrade to Elite at postureai-pro-omega-nine.vercel.app", W/2, fy+16.5, {align:"center"});

    // Page number
    doc.setFillColor(3,11,20); doc.rect(0,H-8,W,8,"F");
    doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text("Corvus Health Intelligence — Confidential", ml, H-2.5);
    doc.text("1 / 2", W-mr, H-2.5, {align:"right"});

    const filename = `Corvus_Session${realIndex}_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
    return filename;
  }

  // ══════════════════════════════════════════════════════════════
  // ELITE PDF — Page 1: Cover + Score Summary
  // ══════════════════════════════════════════════════════════════
  let y=0;

  // Header bar
  doc.setFillColor(3,11,20); doc.rect(0,0,W,44,"F");
  _drawLogo(doc, ml, 11, 22);
  doc.setFontSize(20); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text("Corvus", ml+28, 20);
  doc.setFontSize(8.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text(isAr?"تقرير الوضعية الشخصي — Elite":"Personal Posture Analysis — Elite", ml+28, 28);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}`, ml+28, 34.5);

  // Elite badge (gold)
  doc.setFillColor(16,185,129); doc.roundedRect(W-mr-32,13,32,12,2,2,"F");
  doc.setFontSize(7.5); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text("✦ ELITE", W-mr-16, 20.5, {align:"center"});

  y=54;

  // Session title
  doc.setFontSize(15); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text(isAr?`جلسة رقم ${realIndex}`:`Session #${realIndex}`, ml, y); y+=6;
  doc.setFontSize(8.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text(_fmtDate(session.created_at,isAr), ml, y); y+=11;

  // Score card
  doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,44,4,4,"F");
  doc.setDrawColor(...gradeC); doc.setLineWidth(0.6); doc.roundedRect(ml,y,cw,44,4,4,"S");
  doc.setLineWidth(0.3);
  const cx=ml+26, cy=y+22;
  doc.setFillColor(...gradeC); doc.circle(cx,cy,16,"F");
  doc.setFontSize(18); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
  doc.text(String(avg), cx, cy+6.5, {align:"center"});
  doc.setFontSize(7); doc.text("/100", cx, cy+12, {align:"center"});
  doc.setFontSize(18); doc.setTextColor(...gradeC); doc.setFont("helvetica","bold");
  doc.text(_gl(avg,isAr), ml+50, y+18);
  doc.setFontSize(9.5); doc.setTextColor(71,85,105); doc.setFont("helvetica","normal");
  doc.text(isAr?"نقاط الوضعية الكلية":"Overall Posture Score", ml+50, y+27);
  doc.setFontSize(8.5); doc.text(isAr?`المدة: ${_fmtDur(dur)}`:`Duration: ${_fmtDur(dur)}`, ml+50, y+36);
  [[`${goodPct}%`,isAr?"وضعية جيدة":"Good"],[String(session.alerts_count||0),isAr?"تنبيهات":"Alerts"],[`#${realIndex}`,isAr?"الجلسة":"Session"]].forEach(([v,l],i)=>{
    const sx=cw-52+i*20+ml;
    doc.setFontSize(13); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold"); doc.text(v,sx,y+20,{align:"center"});
    doc.setFontSize(6); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal"); doc.text(l,sx,y+28,{align:"center"});
  });
  y+=54;

  // Score Timeline — full session
  if (hist.length>2) {
    doc.setFontSize(9.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(isAr?"مسار النقاط خلال الجلسة":"Score Timeline", ml, y); y+=4;
    const sh=30;
    doc.setFillColor(241,245,249); doc.roundedRect(ml,y,cw,sh,3,3,"F");
    [50,65,80,95].forEach(v=>{
      const gy=y+sh-3-((v-40)/60)*(sh-6);
      doc.setDrawColor(200,210,220); doc.setLineWidth(0.15); doc.line(ml+3,gy,ml+cw-3,gy);
      doc.setFontSize(5); doc.setTextColor(160,174,192); doc.text(String(v),ml+1,gy+1.5,{align:"right"});
    });
    _drawSparkline(doc,hist,ml+4,y+2,cw-8,sh-4,gradeC);
    y+=sh+10;
  }

  // Pain prediction
  if (painSum) {
    if(y>H-50){doc.addPage();y=20;}
    doc.setFillColor(254,243,199); doc.roundedRect(ml,y,cw,11,2,2,"F");
    doc.setFontSize(8.5); doc.setTextColor(146,64,14); doc.setFont("helvetica","bold");
    doc.text(painSum, ml+4, y+7.5); y+=16;
  }

  // Improvement tip
  if (impTip) {
    if(y>H-50){doc.addPage();y=20;}
    doc.setFillColor(220,252,231); doc.roundedRect(ml,y,cw,11,2,2,"F");
    doc.setFontSize(8.5); doc.setTextColor(20,83,45); doc.setFont("helvetica","bold");
    doc.text(`${impTip}`, ml+4, y+7.5); y+=16;
  }

  // Top metrics preview (worst 4) on page 1
  if (metricEntries.length>0) {
    if(y>H-80){doc.addPage();_pageHeader(doc,W,ml,mr,tier,tierColor,isAr);y=22;}
    doc.setFontSize(9.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(isAr?"أبرز نقاط الوضعية":"Key Posture Metrics", ml, y); y+=5;
    metricEntries.slice(0,4).forEach(({lbl,value,unit,sc})=>{
      if(y>H-40){return;}
      _metricCard(doc,ml,y,cw,lbl,value,unit,sc,isAr); y+=19;
    });
  }

  // Footer page 1
  const fp1Y=H-22;
  doc.setFillColor(241,245,249); doc.rect(0,fp1Y,W,22,"F");
  doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text(`Name: ${name}`, ml, fp1Y+7);
  doc.text(`Email: ${email}`, ml, fp1Y+13);
  doc.text(`Company: ${profile?.company||"—"}`, W-mr, fp1Y+7, {align:"right"});
  doc.text(`ID: ${(session.session_id||session.id||"—").slice(0,14)||"—"}`, W-mr, fp1Y+13, {align:"right"});

  // ══════════════════════════════════════════════════════════════
  // ELITE PAGE 2 — Full Metrics Breakdown + Zonal Pain Map
  // ══════════════════════════════════════════════════════════════
  doc.addPage(); _pageHeader(doc,W,ml,mr,tier,tierColor,isAr); y=22;

  doc.setFontSize(13); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text(isAr?"تفاصيل كافة مقاييس الوضعية":"Complete Posture Metrics Breakdown", ml, y); y+=9;

  metricEntries.forEach(({lbl,value,unit,sc})=>{
    if(y>H-40){doc.addPage();_pageHeader(doc,W,ml,mr,tier,tierColor,isAr);y=22;}
    _metricCard(doc,ml,y,cw,lbl,value,unit,sc,isAr); y+=20;
  });

  // Zonal Pain Map
  y+=6;
  if(y>H-80){doc.addPage();_pageHeader(doc,W,ml,mr,tier,tierColor,isAr);y=22;}
  doc.setFontSize(11); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
  doc.text(isAr?"خريطة مخاطر الألم الوظيفي":"Spinal Zone Risk Map", ml, y); y+=4;
  doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
  doc.text(isAr?"مشتق من مقاييس الجلسة — ليس تشخيصاً طبياً":"Derived from session metrics — not a medical diagnosis", ml, y); y+=8;

  const zones = [
    { key:"cervical", en:"Cervical (Neck)", ar:"عنق الرحم (الرقبة)", metrics:"Neck lean, FHP, head tilt & yaw" },
    { key:"thoracic", en:"Thoracic (Upper Back)", ar:"الصدر (أعلى الظهر)", metrics:"Shoulder balance, rounded shoulders, spine lean" },
    { key:"lumbar",   en:"Lumbar (Lower Back)", ar:"القطن (أسفل الظهر)", metrics:"Spine alignment, hip angle, trunk lean" },
  ];
  const zonal = _zonalRisk(metrics);
  zones.forEach(({key,en,ar,metrics:mlist})=>{
    if(y>H-40){doc.addPage();_pageHeader(doc,W,ml,mr,tier,tierColor,isAr);y=22;}
    const risk = zonal[key]||0;
    const rcol = _riskColor(risk);
    const rlbl = _riskLabel(risk,isAr);
    doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,22,3,3,"F");
    doc.setDrawColor(...rcol); doc.setLineWidth(0.4); doc.roundedRect(ml,y,cw,22,3,3,"S"); doc.setLineWidth(0.3);
    // Risk %
    doc.setFillColor(...rcol); doc.roundedRect(ml+1,y+1,20,20,2,2,"F");
    doc.setFontSize(9.5); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold");
    doc.text(`${risk}%`, ml+11, y+13.5, {align:"center"});
    // Zone name
    doc.setFontSize(9.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(isAr?ar:en, ml+24, y+8);
    doc.setFontSize(7.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text(mlist, ml+24, y+14.5);
    // Risk bar
    const bx=ml+cw*0.52, bw2=cw*0.46;
    doc.setFillColor(226,232,240); doc.roundedRect(bx,y+7.5,bw2,5,1,1,"F");
    doc.setFillColor(...rcol); doc.roundedRect(bx,y+7.5,Math.max(bw2*(risk/100),3),5,1,1,"F");
    // Risk label
    doc.setFontSize(8); doc.setTextColor(...rcol); doc.setFont("helvetica","bold");
    doc.text(rlbl, W-mr-2, y+17, {align:"right"});
    y+=26;
  });

  // ══════════════════════════════════════════════════════════════
  // ELITE PAGE 3 — AI Analysis + Next Steps
  // ══════════════════════════════════════════════════════════════
  doc.addPage(); _pageHeader(doc,W,ml,mr,tier,tierColor,isAr); y=22;

  // AI Narrative
  if (aiText) {
    doc.setFillColor(26,36,56); doc.roundedRect(ml,y,cw,9,2,2,"F");
    doc.setFontSize(10); doc.setTextColor(248,250,252); doc.setFont("helvetica","bold");
    doc.text(isAr?"🤖 تحليل Corvus AI":"🤖 Corvus AI Analysis", ml+4, y+6.5); y+=13;

    doc.setFontSize(9); doc.setTextColor(30,41,59); doc.setFont("helvetica","normal");
    const aiLines = doc.splitTextToSize(aiText.replace(/[#*`]/g,"").trim(), cw-6);
    aiLines.forEach(line=>{ if(y>H-30){doc.addPage();_pageHeader(doc,W,ml,mr,tier,tierColor,isAr);y=22;} doc.text(line,ml+3,y); y+=5.5; });
    y+=8;
  } else {
    // AI tip placeholder
    doc.setFillColor(241,245,249); doc.roundedRect(ml,y,cw,20,2,2,"F");
    doc.setFontSize(9); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text("AI analysis not available for this session.", ml+cw/2, y+10, {align:"center"});
    doc.text("Use AI Coach during your next session to generate a personalised narrative.", ml+cw/2, y+16, {align:"center"});
    y+=26;
  }

  // Next Steps (built from worst 3 metrics)
  if(y>H-80){doc.addPage();_pageHeader(doc,W,ml,mr,tier,tierColor,isAr);y=22;}
  y+=4;
  doc.setFillColor(26,36,56); doc.roundedRect(ml,y,cw,9,2,2,"F");
  doc.setFontSize(10); doc.setTextColor(248,250,252); doc.setFont("helvetica","bold");
  doc.text(isAr?"🎯 الخطوات التالية":"🎯 Next Steps", ml+4, y+6.5); y+=14;

  const nextStepMap = {
    neck_lean:      ["Raise your monitor to eye level","Tuck chin slightly when sitting","Set a posture reminder every 20 min"],
    neck_lean_side: ["Ensure screen is directly in front of you","Tuck chin and retract head over shoulders","Use a cervical pillow at night"],
    head_tilt:      ["Adjust chair height so feet are flat","Level your monitor or laptop stand","Check for monitor glare causing compensations"],
    head_yaw:       ["Position monitor directly in front","Move secondary screen closer to centre","Take a 2-min stretch break every 30 min"],
    fhp:            ["Pull head back until ears are over shoulders","Raise monitor 3-5cm","Chin tucks: 10 reps × 3 sets daily"],
    fhp_side:       ["Bring ear directly above shoulder","Raise screen to reduce forward lean","Strengthen deep neck flexors with a physio"],
    shoulder:       ["Adjust armrests to equal height","Check bag carry habits outside work","Shrug and drop shoulders 10 reps"],
    spine_lean:     ["Engage lumbar support fully","Sit back in your chair, not on the edge","Core bracing: 30s hold, 5 reps daily"],
    spine_align:    ["Align ear, shoulder, hip in one vertical line","Adjust seat depth so knees are at 90°","Walk 5 min every hour"],
    rounded:        ["Pull shoulder blades together and down","Open chest: doorway stretch 2× daily","Reduce forward arm reach at keyboard"],
    elbow:          ["Lower keyboard so elbows are at 90-100°","Position keyboard close to body","Take wrist breaks every 45 min"],
    monitor:        ["Raise/lower monitor so top is at eye level","Use a laptop stand + external keyboard","Reduce neck flexion by adjusting chair tilt"],
    distance:       ["Position screen 50-80cm from eyes","Increase font size to reduce squinting","Apply the 20-20-20 rule: look 20ft away every 20 min"],
    trunk_lean:     ["Engage core, sit back in chair","Use full lumbar support","Avoid leaning forward when typing"],
    hip_angle:      ["Adjust seat height so hips are at 90°","Feet flat on floor or use footrest","Stand up and walk every 45 min"],
    knee_angle:     ["Adjust seat depth: 2-3 fingers between knee and seat edge","Use footrest if feet don't reach floor","Hip flexor stretch 30s each side daily"],
  };

  const top3 = metricEntries.slice(0,3);
  top3.forEach(({key,lbl,sc},idx)=>{
    if(y>H-40){doc.addPage();_pageHeader(doc,W,ml,mr,tier,tierColor,isAr);y=22;}
    const steps = nextStepMap[key] || ["Reduce strain on this area","Take regular movement breaks","Consult a physiotherapist if persistent"];
    doc.setFillColor(248,250,252); doc.roundedRect(ml,y,cw,34,3,3,"F");
    doc.setDrawColor(..._gc(sc)); doc.setLineWidth(0.4); doc.roundedRect(ml,y,cw,34,3,3,"S"); doc.setLineWidth(0.3);
    doc.setFontSize(9.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(`${idx+1}. ${lbl} (Score: ${Math.round(sc)})`, ml+4, y+8);
    doc.setFontSize(8); doc.setTextColor(51,65,85); doc.setFont("helvetica","normal");
    steps.forEach((s,si)=>{ doc.text(`• ${s}`, ml+6, y+16+(si*7)); });
    y+=38;
  });

  // Session stats table
  if(y<H-60){
    y+=6;
    doc.setFontSize(9.5); doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
    doc.text(isAr?"إحصائيات الجلسة":"Session Statistics", ml, y); y+=7;
    [
      [isAr?"النقاط الكلية":"Overall Score", `${avg}/100 — ${_gl(avg,isAr)}`],
      [isAr?"مدة الجلسة":"Duration",         _fmtDur(dur)],
      [isAr?"وضعية جيدة":"Good Posture %",   `${goodPct}%`],
      [isAr?"التنبيهات":"Alerts",             String(session.alerts_count||0)],
      [isAr?"وضع الكاميرا":"Camera Mode",     session.mode||"laptop"],
      [isAr?"المستوى":"Tier",                 tier.toUpperCase()],
    ].forEach(([k,v],i)=>{
      doc.setFillColor(i%2===0?248:255, i%2===0?250:255, i%2===0?252:255);
      doc.rect(ml,y,cw,8,"F");
      doc.setFontSize(8); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
      doc.text(k, ml+3, y+5.5);
      doc.setTextColor(15,23,42); doc.setFont("helvetica","bold");
      doc.text(v, W-mr-3, y+5.5, {align:"right"});
      y+=8;
    });
  }

  // Page numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let p=1; p<=totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(3,11,20); doc.rect(0,H-8,W,8,"F");
    doc.setFontSize(6.5); doc.setTextColor(100,116,139); doc.setFont("helvetica","normal");
    doc.text("Corvus Health Intelligence — Elite Report — Confidential", ml, H-2.5);
    doc.text(`${p} / ${totalPages}`, W-mr, H-2.5, {align:"right"});
  }

  const filename = `Corvus_Elite_Session${realIndex}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
  return filename;
}




// ─────────────────────────────────────────────────────────────────
// CLINICAL PDF — Physiotherapist-shareable (Elite only)
// Professional clinical language, zonal map, no pricing/branding
// ─────────────────────────────────────────────────────────────────
export async function generateClinicalPDF({ session, profile, user, lang="en", sessionIndex, allSessions=[] }) {
  const { jsPDF } = await import("jspdf");
  const isAr  = lang === "ar";
  const doc   = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const W=210, H=297, ml=18, mr=18, cw=W-ml-mr;

  const tier    = profile?.tier || session.tier || "standard";
  if (!tierAtLeast(tier,"elite")) throw new Error("Clinical PDF requires Elite tier");

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
