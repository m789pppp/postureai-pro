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
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// CORVUS PDF DESIGN SYSTEM v3 — Premium Healthcare Report
// Inspired by: Apple, Stripe, Linear, WHO, top HealthTech startups
// ═══════════════════════════════════════════════════════════════════

// ── Design Tokens ──────────────────────────────────────────────────
const T = {
  // Primary palette
  primary:    [37,99,235],    // #2563EB
  primaryDk:  [30,64,175],   // #1E40AF
  success:    [34,197,94],   // #22C55E
  successDk:  [21,128,61],
  warning:    [245,158,11],  // #F59E0B
  warningDk:  [180,83,9],
  danger:     [239,68,68],   // #EF4444
  dangerDk:   [185,28,28],
  // Neutral
  ink:        [17,24,39],    // #111827
  sub:        [55,65,81],    // #374151
  muted:      [107,114,128], // #6B7280
  light:      [156,163,175], // #9CA3AF
  // Surfaces
  bg:         [248,250,252], // #F8FAFC
  card:       [255,255,255],
  border:     [229,231,235], // #E5E7EB
  borderSoft: [243,244,246], // #F3F4F6
  // Accents
  indigo:     [99,102,241],
  purple:     [168,85,247],
  cyan:       [6,182,212],
  teal:       [20,184,166],
};

// ── Spacing system ─────────────────────────────────────────────────
const S = { xs:3, sm:6, md:10, lg:16, xl:24, xxl:36 };

// ── Typography ─────────────────────────────────────────────────────
const F = {
  display: 28, h1:18, h2:14, h3:11, body:9, small:7.5, micro:6.5,
};

// ── Helpers ────────────────────────────────────────────────────────
function _scoreColor(s){ return s>=80?T.success:s>=60?T.warning:T.danger; }
function _scoreLabel(s,ar){ return s>=80?(ar?"ممتاز":"Excellent"):s>=60?(ar?"جيد":"Good"):(ar?"يحتاج تحسين":"Needs Improvement"); }
function _fmtDur(s){ if(!s)return"—"; const m=Math.floor(s/60),sec=s%60; return`${m>0?m+"m ":""}${sec}s`; }
function _fmtDate(ts,ar){
  if(!ts)return"—";
  try{ const d=ts?.toDate?ts.toDate():new Date(ts);
    return d.toLocaleDateString(ar?"ar-EG":"en-US",{year:"numeric",month:"long",day:"numeric"}); }
  catch{return"—";}
}
function _clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function _rgb(arr){return arr;}

// ── Cairo font — loaded lazily for Arabic PDF rendering ───────────
let _cairoLoaded = false;
async function _ensureCairoFont(doc) {
  if (_cairoLoaded) return;
  try {
    const { CAIRO_B64 } = await import("./assets/cairoFont.js");
    // jsPDF addFont: (base64data, fontName, fontStyle, fontWeight?)
    doc.addFileToVFS("Cairo-Regular.ttf", CAIRO_B64);
    doc.addFont("Cairo-Regular.ttf", "cairo", "normal");
    doc.addFileToVFS("Cairo-Bold.ttf", CAIRO_B64);
    doc.addFont("Cairo-Bold.ttf", "cairo", "bold");
    _cairoLoaded = true;
  } catch(e) {
    console.warn("Cairo font load failed — falling back to helvetica:", e);
  }
}

// ── Font setter — uses Cairo for Arabic, helvetica otherwise ───────
function font(doc, size, style="normal", isAr=false) {
  const face = isAr && _cairoLoaded ? "cairo" : "helvetica";
  doc.setFont(face, style);
  doc.setFontSize(size);
}

// ── Low-level draw helpers ─────────────────────────────────────────
function dc(doc,...c){doc.setDrawColor(...c);}
function fc(doc,...c){doc.setFillColor(...c);}
function tc(doc,...c){doc.setTextColor(...c);}
function lw(doc,w){doc.setLineWidth(w);}

// ── Rounded filled rect helper ─────────────────────────────────────
function rr(doc,x,y,w,h,r=3,mode="F"){
  doc.roundedRect(x,y,w,h,r,r,mode);
}

// ── Divider ────────────────────────────────────────────────────────
function divider(doc,x,y,w,col=T.border){
  dc(doc,...col);lw(doc,0.2);doc.line(x,y,x+w,y);lw(doc,0.3);
}

// ── Logo mark ─────────────────────────────────────────────────────
function _logo(doc,x,y,sz=20){
  fc(doc,...T.primary);rr(doc,x,y,sz,sz,sz*0.18,"F");
  // Inner diamond
  fc(doc,...T.card);
  const cx=x+sz/2,cy=y+sz/2,hs=sz*0.26;
  doc.lines([[hs,hs],[-hs,hs],[-hs,-hs],[hs,-hs]],cx,cy-hs,[1,1],"F",true);
  // Center dot
  fc(doc,...T.primary);doc.circle(cx,cy,sz*0.1,"F");
}

// ── Page header (inner pages) ──────────────────────────────────────
function _hdr(doc,W,ml,mr,pageLabel){
  fc(doc,...T.card);doc.rect(0,0,W,14,"F");
  fc(doc,...T.primary);doc.rect(0,14,W,0.5,"F");
  // Mini logo
  fc(doc,...T.primary);rr(doc,ml,3.5,8,8,1.5,"F");
  fc(doc,...T.card);font(doc,5.5,"bold");
  doc.text("◈",ml+4,9.2,{align:"center"});
  // Brand
  font(doc,7,"bold");tc(doc,...T.ink);
  doc.text("Corvus Health",ml+11,9.2);
  font(doc,7,"normal");tc(doc,...T.muted);
  doc.text("Posture Intelligence Platform",ml+45,9.2);
  // Right label
  font(doc,6.5,"bold");tc(doc,...T.primary);
  doc.text(pageLabel,W-mr,9.2,{align:"right"});
}

// ── Page footer ────────────────────────────────────────────────────
function _ftr(doc,W,ml,mr,H,pg,total,name){
  divider(doc,0,H-10,W);
  fc(doc,...T.borderSoft);doc.rect(0,H-9.5,W,9.5,"F");
  font(doc,6.5,"normal");tc(doc,...T.light);
  doc.text(`Corvus Health Intelligence · corvus.ai`,ml,H-3.5);
  font(doc,6.5,"bold");tc(doc,...T.muted);
  doc.text(name,W/2,H-3.5,{align:"center"});
  doc.text(`${pg} / ${total}`,W-mr,H-3.5,{align:"right"});
}

// ── Cover header gradient (page 1) ────────────────────────────────
function _coverHdr(doc,W,ml,H,tier,tierCol,name,sessionNum,dateStr){
  // Dark gradient-feel background
  fc(doc,...T.ink);doc.rect(0,0,W,72,"F");
  // Accent overlay band
  fc(doc,...tierCol);
  doc.lines([[0,0],[W*0.6,0],[W*0.4,72],[0,72]],0,0,[1,1],"F",false);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.08}));
  fc(doc,...T.card);doc.rect(0,0,W,72,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Geometric accent
  fc(doc,...tierCol);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.15}));
  doc.circle(W*0.82,36,40,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.08}));
  doc.circle(W*0.82,36,56,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Logo
  _logo(doc,ml,16,26);
  // Brand name
  font(doc,13,"bold");tc(doc,...T.card);
  doc.text("CORVUS",ml+34,28);
  font(doc,7,"normal");tc(doc,148,163,184);
  doc.text("Health Intelligence Platform",ml+34,35);
  // Report type
  font(doc,7.5,"bold");
  const tierStr=tier.toUpperCase();
  const tw=doc.getTextWidth(tierStr)+10;
  fc(doc,...tierCol);rr(doc,ml+34,40,tw,9,2,"F");
  tc(doc,...T.card);doc.text(tierStr,ml+34+tw/2,46,{align:"center"});
  // Right info
  font(doc,7,"normal");tc(doc,148,163,184);
  doc.text(dateStr,W-18,26,{align:"right"});
  font(doc,7.5,"bold");tc(doc,...T.card);
  doc.text(`Session #${sessionNum}`,W-18,35,{align:"right"});
  // Bottom color bar
  fc(doc,...tierCol);doc.rect(0,71.5,W,0.5,"F");
}

// ── Section heading with accent bar ───────────────────────────────
function _secHead(doc,ml,y,title,sub="",col=T.primary,isAr=false){
  fc(doc,...col);doc.rect(ml,y,2.5,sub?14:10,"F");
  font(doc,F.h2,"bold",isAr);tc(doc,...T.ink);
  doc.text(title,ml+8,y+(sub?7:7));
  if(sub){font(doc,F.small,"normal",isAr);tc(doc,...T.muted);doc.text(sub,ml+8,y+13);}
  return y+(sub?20:15);
}

// ── Score ring ────────────────────────────────────────────────────
function _ring(doc,cx,cy,r,score,isAr){
  const col=_scoreColor(score);
  const lbl=_scoreLabel(score,isAr);
  // Outer track
  dc(doc,...T.border);lw(doc,3);doc.circle(cx,cy,r,"S");
  // Score arc (full circle tinted)
  dc(doc,...col);lw(doc,3);doc.circle(cx,cy,r,"S");
  lw(doc,0.3);
  // Inner fill
  fc(doc,col[0],col[1],col[2]);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.07}));
  doc.circle(cx,cy,r-1.5,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  // Score number
  font(doc,20,"bold");tc(doc,...col);
  doc.text(String(score),cx,cy+3.5,{align:"center"});
  // /100 small
  font(doc,6.5,"normal");tc(doc,...T.muted);
  doc.text("/100",cx,cy+9.5,{align:"center"});
  // Grade label below
  font(doc,8.5,"bold");tc(doc,...col);
  doc.text(lbl,cx,cy+r+7,{align:"center"});
}

// ── Metric card — premium redesign ────────────────────────────────
function _metCard(doc,x,y,w,lbl,value,unit,score,isAr){
  const col=_scoreColor(score);
  const h=20;
  fc(doc,...T.card);rr(doc,x,y,w,h,3,"F");
  dc(doc,...T.border);lw(doc,0.2);rr(doc,x,y,w,h,3,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,3,h,"F");
  rr(doc,x,y,3,h,1.5,"F");
  fc(doc,...col);rr(doc,x+7,y+4,14,12,2,"F");
  font(doc,8.5,"bold",false);tc(doc,...T.card);
  doc.text(String(Math.round(score)),x+14,y+11.5,{align:"center"});
  font(doc,8.5,"bold",isAr);tc(doc,...T.ink);
  doc.text(lbl,x+25,y+8.5);
  if(value!==undefined&&value!==null){
    font(doc,7.5,"normal",false);tc(doc,...T.muted);
    doc.text(`${Math.round(value*10)/10}${unit||""}`,x+25,y+15);
  }
  // Progress bar (right side)
  const bx=x+w*0.53,bw2=w*0.43,bh=4.5;
  fc(doc,...T.borderSoft);rr(doc,bx,y+7.5,bw2,bh,2,"F");
  fc(doc,...col);rr(doc,bx,y+7.5,Math.max(bw2*(score/100),3),bh,2,"F");
  // Grade pill
  const glbl=_scoreLabel(score,isAr);
  const gw=doc.getTextWidth(glbl)+6;
  fc(doc,col[0],col[1],col[2]);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
  rr(doc,x+w-gw-4,y+13,gw,6,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,6.5,"bold");tc(doc,...col);
  doc.text(glbl,x+w-gw/2-4,y+17.5,{align:"center"});
}

// ── Stat card (for summary row) ───────────────────────────────────
function _statCard(doc,x,y,w,h,value,label,col,sub=""){
  fc(doc,...T.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...T.border);lw(doc,0.2);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  // Top accent
  fc(doc,...col);rr(doc,x,y,w,3,2,"F");doc.rect(x,y+1.5,w,1.5,"F");
  // Value
  font(doc,16,"bold");tc(doc,...col);
  doc.text(String(value),x+w/2,y+h*0.56,{align:"center"});
  // Label
  font(doc,7,"bold");tc(doc,...T.muted);
  doc.text(label,x+w/2,y+h*0.76,{align:"center"});
  if(sub){font(doc,6.5,"normal");tc(doc,...T.light);doc.text(sub,x+w/2,y+h*0.9,{align:"center"});}
}

// ── Info row (alternating table) ──────────────────────────────────
function _infoRow(doc,x,y,w,key,value,even){
  fc(doc,...(even?T.borderSoft:T.card));doc.rect(x,y,w,8.5,"F");
  font(doc,7.5,"normal");tc(doc,...T.muted);doc.text(key,x+4,y+5.8);
  font(doc,7.5,"bold");tc(doc,...T.ink);doc.text(String(value),x+w-4,y+5.8,{align:"right"});
}

// ── Sparkline (premium) ───────────────────────────────────────────
function _spark(doc,hist,x,y,w,h,col){
  const pts=hist.length>80?hist.filter((_,i)=>i%Math.ceil(hist.length/80)===0):hist;
  if(pts.length<2)return;
  const lo=Math.max(0,Math.min(...pts)-8),hi=Math.min(100,Math.max(...pts)+8);
  const rng=Math.max(hi-lo,10);
  const coords=pts.map((s,i,a)=>({
    px:x+(i/Math.max(a.length-1,1))*w,
    py:y+h-((s-lo)/rng)*h,
  }));
  // Grid
  [40,60,75,90].forEach(v=>{
    if(v<lo||v>hi)return;
    const gy=y+h-((v-lo)/rng)*h;
    dc(doc,...T.border);lw(doc,0.15);doc.line(x,gy,x+w,gy);
    font(doc,5,"normal");tc(doc,...T.light);
    doc.text(String(v),x-2,gy+1.5,{align:"right"});
  });
  lw(doc,0.3);
  // Area fill
  try{
    const poly=[coords[0].px,coords[0].py,...coords.flatMap(p=>[p.px,p.py]),coords[coords.length-1].px,y+h,coords[0].px,y+h];
    fc(doc,...col);
    doc.setGState&&doc.setGState(new doc.GState({opacity:0.1}));
    const segs=coords.slice(1).map((p,i)=>[p.px-coords[i].px,p.py-coords[i].py]);
    doc.lines(segs,coords[0].px,coords[0].py,[1,1],"F",false);
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  }catch{}
  // Line
  dc(doc,...col);lw(doc,1.5);
  coords.forEach((p,i)=>{if(i>0)doc.line(coords[i-1].px,coords[i-1].py,p.px,p.py);});
  // Endpoints
  fc(doc,...T.card);doc.circle(coords[0].px,coords[0].py,2,"F");
  dc(doc,...col);lw(doc,1);doc.circle(coords[0].px,coords[0].py,2,"S");
  fc(doc,...col);doc.circle(coords[coords.length-1].px,coords[coords.length-1].py,2.5,"F");
  // Labels
  font(doc,6.5,"bold");tc(doc,...col);
  doc.text(String(pts[0]),coords[0].px,coords[0].py-4,{align:"center"});
  doc.text(String(pts[pts.length-1]),coords[coords.length-1].px,coords[coords.length-1].py-4,{align:"center"});
}

// ── Callout box ───────────────────────────────────────────────────
function _callout(doc,x,y,w,text,type="info"){
  const cols={info:T.primary,success:T.success,warning:T.warning,danger:T.danger};
  const col=cols[type]||T.primary;
  const lines=doc.splitTextToSize(text,w-16);
  const h=Math.max(14,lines.length*5.5+8);
  fc(doc,col[0],col[1],col[2]);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.06}));
  rr(doc,x,y,w,h,3,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  dc(doc,...col);lw(doc,0.25);rr(doc,x,y,w,h,3,"S");lw(doc,0.3);
  doc.rect(x,y,3,h,"F");rr(doc,x,y,3,h,1.5,"F");
  font(doc,8,"normal");tc(doc,...T.sub);
  lines.forEach((l,i)=>doc.text(l,x+8,y+7+(i*5.5)));
  return y+h+6;
}

// ── Zone risk card ────────────────────────────────────────────────
function _zoneCard(doc,x,y,w,title,region,risk,desc,mlist,isAr){
  const col=_riskColor(risk);
  const lines=doc.splitTextToSize(desc,w-44);
  const h=Math.max(52,lines.length*5+36);
  // Card
  fc(doc,...T.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...col);lw(doc,0.3);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  // Left accent
  fc(doc,...col);doc.rect(x,y,3,h,"F");rr(doc,x,y,3,h,1.5,"F");
  // Risk badge circle
  fc(doc,...col);doc.circle(x+18,y+18,12,"F");
  font(doc,10,"bold");tc(doc,...T.card);
  doc.text(`${risk}%`,x+18,y+21,{align:"center"});
  // Title
  font(doc,10,"bold");tc(doc,...T.ink);doc.text(title,x+36,y+13);
  font(doc,7.5,"bold");tc(doc,...T.primary);doc.text(region,x+36,y+20);
  // Risk bar
  const bx=x+36,bw2=w*0.55;
  fc(doc,...T.borderSoft);rr(doc,bx,y+24,bw2,4,2,"F");
  fc(doc,...col);rr(doc,bx,y+24,Math.max(bw2*(risk/100),3),4,2,"F");
  font(doc,7,"bold");tc(doc,...col);
  doc.text(_riskLabel(risk,isAr),x+36+bw2+3,y+27.5);
  // Description
  font(doc,7.5,"normal");tc(doc,...T.sub);
  lines.forEach((l,i)=>doc.text(l,x+7,y+34+(i*5)));
  // Metrics source
  font(doc,6.5,"bold");tc(doc,...T.light);
  doc.text(`Metrics: ${mlist}`,x+7,h+y-4);
  return y+h+8;
}

// ── Next step card ────────────────────────────────────────────────
function _stepCard(doc,x,y,w,idx,title,score,steps,isAr){
  const col=_scoreColor(score);
  const h=44;
  fc(doc,...T.card);rr(doc,x,y,w,h,4,"F");
  dc(doc,...T.border);lw(doc,0.2);rr(doc,x,y,w,h,4,"S");lw(doc,0.3);
  fc(doc,...col);doc.rect(x,y,3,h,"F");rr(doc,x,y,3,h,1.5,"F");
  // Number circle
  fc(doc,...col);doc.circle(x+14,y+14,8,"F");
  font(doc,9,"bold");tc(doc,...T.card);doc.text(String(idx),x+14,y+17.5,{align:"center"});
  // Title + score badge
  font(doc,9.5,"bold");tc(doc,...T.ink);doc.text(title,x+28,y+11);
  const sbadge=`Score ${Math.round(score)}`;
  const sw=doc.getTextWidth(sbadge)+6;
  fc(doc,col[0],col[1],col[2]);
  doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
  rr(doc,x+w-sw-4,y+5,sw,8,2,"F");
  doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
  font(doc,6.5,"bold");tc(doc,...col);doc.text(sbadge,x+w-sw/2-4,y+10.5,{align:"center"});
  // Steps
  font(doc,7.5,"normal");tc(doc,...T.sub);
  steps.slice(0,3).forEach((s,i)=>{
    doc.text(`${i+1}.`,x+28,y+21+(i*7));
    doc.text(s,x+34,y+21+(i*7));
  });
  return y+h+8;
}

// ═══════════════════════════════════════════════════════════════════
// SESSION PDF v3 — Elite: full premium report | Non-Elite: preview
// ═══════════════════════════════════════════════════════════════════
export async function generateSessionPDF({ session, profile, user, lang="en", sessionIndex, allSessions=[] }) {
  const { jsPDF } = await import("jspdf");
  const isAr  = lang==="ar";
  const tier  = profile?.tier||session?.tier||"standard";
  const isElite = tierAtLeast(tier,"elite");
  const isPro   = !isElite && tierAtLeast(tier,"professional");
  const doc   = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  await _ensureCairoFont(doc);
  const W=210, H=297, ml=18, mr=18, cw=W-ml-mr;

  const tierCol = isElite?T.success:isPro?T.cyan:T.indigo;
  const avg     = Math.round(session.avg_score||0);
  const dur     = session.duration_s||session.duration_sec||0;
  const goodPct = Math.round(session.good_pct||0);
  const gradeC  = _scoreColor(avg);
  const gradeL  = _scoreLabel(avg,isAr);
  const metrics = session.metrics||{};
  const hist    = session.score_history||[];
  const aiText  = session.ai_tip||session.ai_insight||session.claude_analysis||"";
  const painSum = session.pain_summary||"";
  const impTip  = session.improvement_tip||"";
  const name    = profile?.name||user?.displayName||user?.email?.split("@")[0]||(isAr?"مستخدم":"User");
  const email   = user?.email||"";
  const dateStr = _fmtDate(session.created_at||new Date(),isAr);

  const realIndex = (()=>{
    if(sessionIndex) return sessionIndex;
    if(allSessions.length){const i=allSessions.findIndex(s=>(s.id||s.session_id)===(session.id||session.session_id));if(i>=0)return allSessions.length-i;}
    return 1;
  })();

  const metricEntries = Object.entries(metrics)
    .filter(([k])=>!k.startsWith("_")&&metrics[k])
    .map(([k,v])=>{
      const sc=typeof v==="number"?v:(v?.score??100);
      const lbl=(isAr?METRIC_LABELS_AR[k]:METRIC_LABELS[k])||v?.label||k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      return{key:k,sc,lbl,value:v?.value,unit:v?.unit||""};
    }).sort((a,b)=>a.sc-b.sc);

  // ── NON-ELITE: Premium preview + upsell ───────────────────────
  if(!isElite){
    // COVER
    _coverHdr(doc,W,ml,H,tier,tierCol,name,realIndex,dateStr);
    let y=80;

    // Title block
    font(doc,F.h1,"bold");tc(doc,...T.ink);
    doc.text(isAr?"تقرير تحليل الوضعية":"Posture Analysis Report",ml,y);
    font(doc,F.body,"normal");tc(doc,...T.muted);
    doc.text(isAr?`${name} · ${dateStr}`:`${name} · ${dateStr}`,ml,y+8); y+=18;
    divider(doc,ml,y,cw); y+=12;

    // Score ring + stat cards row
    _ring(doc,ml+22,y+22,18,avg,isAr);
    [[`${goodPct}%`,isAr?"جيدة":"Good",T.success],[String(session.alerts_count||0),isAr?"تنبيهات":"Alerts",T.warning],[_fmtDur(dur),isAr?"المدة":"Duration",T.primary]]
      .forEach(([v,l,col],i)=>_statCard(doc,ml+54+i*50,y+2,44,32,v,l,col));
    y+=56; divider(doc,ml,y,cw); y+=12;

    // Sparkline
    if(hist.length>2){
      y=_secHead(doc,ml,y,isAr?"مسار النقاط":"Score Timeline",isAr?"خلال الجلسة":"During session",gradeC,isAr);
      fc(doc,...T.bg);rr(doc,ml,y,cw,36,4,"F");dc(doc,...T.border);lw(doc,0.2);rr(doc,ml,y,cw,36,4,"S");lw(doc,0.3);
      _spark(doc,hist,ml+10,y+5,cw-20,26,gradeC);
      y+=44;
    }

    // Top 3 metrics
    y=_secHead(doc,ml,y,isAr?"أبرز المقاييس":"Key Metrics",isAr?"الأسوأ أداءً":"Worst performing",gradeC,isAr);
    metricEntries.slice(0,3).forEach(({lbl,value,unit,sc})=>{
      if(y>H-55)return;
      _metCard(doc,ml,y,cw,lbl,value,unit,sc,isAr);y+=24;
    });
    if(metricEntries.length>3){
      fc(doc,...T.bg);rr(doc,ml,y,cw,12,2,"F");
      font(doc,7.5,"normal");tc(doc,...T.muted);
      doc.text(`+ ${metricEntries.length-3} ${isAr?"مقاييس أخرى":"more metrics"} — ${isAr?"رقّي لـ Elite":"upgrade to Elite"}`,ml+cw/2,y+8,{align:"center"});
      y+=16;
    }

    // PAGE 2 — Dark premium upsell
    doc.addPage();
    fc(doc,...T.ink);doc.rect(0,0,W,H,"F");
    fc(doc,...T.primary);doc.rect(0,0,W,3,"F");
    // Geometric decorations
    fc(doc,...T.primary);doc.setGState&&doc.setGState(new doc.GState({opacity:0.06}));
    doc.circle(W*0.85,H*0.25,70,"F");doc.circle(W*0.1,H*0.75,50,"F");
    doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
    _logo(doc,W/2-13,44,26);
    font(doc,F.display,"bold");tc(doc,...T.card);
    doc.text(isAr?"افتح تقريرك الكامل":"Unlock Your Full Report",W/2,90,{align:"center"});
    font(doc,F.body,"normal");tc(doc,148,163,184);
    doc.text(isAr?"رقّي لـ Elite للوصول لكل المزايا":"Upgrade to Elite for the complete experience",W/2,100,{align:"center"});
    divider(doc,ml+20,108,cw-40,[55,65,81]);

    const feats=[
      [T.success,isAr?"تفاصيل كل المقاييس":"Complete Metrics Breakdown",isAr?"كل مقاييس الوضعية بالزوايا والتوصيات":"All posture metrics with angles, trends & recommendations"],
      [T.primary,isAr?"تحليل Corvus AI":"Corvus AI Analysis",isAr?"سرد AI مخصص لجلستك":"Personalised AI-generated clinical narrative"],
      [T.warning,isAr?"خريطة مناطق الخطر":"Spinal Zone Risk Map",isAr?"تقييم الرقبة / الصدر / القطن":"Cervical · Thoracic · Lumbar risk assessment"],
      [T.cyan,isAr?"الخطوات العملية":"Prioritised Next Steps",isAr?"3 إجراءات مخصصة بناءً على بياناتك":"3 tailored actions from your worst metrics"],
      [T.purple,isAr?"PDF سريري":"Clinical PDF",isAr?"تقرير جاهز للطبيب أو الأخصائي":"Physiotherapist-ready report with medical detail"],
    ];
    let fy=118;
    feats.forEach(([col,title,desc])=>{
      fc(doc,...col);doc.setGState&&doc.setGState(new doc.GState({opacity:0.12}));
      rr(doc,ml,fy,6,22,3,"F");
      doc.setGState&&doc.setGState(new doc.GState({opacity:1}));
      fc(doc,...col);rr(doc,ml,fy,6,22,3,"F");
      font(doc,9.5,"bold");tc(doc,...T.card);doc.text(title,ml+12,fy+9);
      font(doc,7.5,"normal");tc(doc,100,116,139);doc.text(desc,ml+12,fy+17);
      fy+=28;
    });
    // CTA button
    fy+=4;
    fc(doc,...T.success);rr(doc,ml,fy,cw,16,4,"F");
    font(doc,10,"bold");tc(doc,...T.card);
    doc.text("postureai-pro-omega-nine.vercel.app → Upgrade to Elite",W/2,fy+10.5,{align:"center"});

    const tot=doc.internal.getNumberOfPages();
    for(let p=1;p<=tot;p++){doc.setPage(p);_ftr(doc,W,ml,mr,H,p,tot,name);}
    const fn=`Corvus_Session${realIndex}_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(fn);return fn;
  }

  // ═══════════════════════════════════════════════════════════════
  // ELITE FULL REPORT — Page 1: Cover Summary
  // ═══════════════════════════════════════════════════════════════
  _coverHdr(doc,W,ml,H,tier,tierCol,name,realIndex,dateStr);
  let y=80;

  // Report title
  font(doc,F.h1,"bold");tc(doc,...T.ink);
  doc.text(isAr?"تقرير وضعية احترافي":"Professional Posture Report",ml,y);
  font(doc,F.body,"normal");tc(doc,...T.muted);
  doc.text(`${name} · ${email||"—"} · ${dateStr}`,ml,y+8); y+=18;
  divider(doc,ml,y,cw); y+=12;

  // Score ring + 4 stat cards
  _ring(doc,ml+22,y+22,19,avg,isAr);
  [[`${goodPct}%`,isAr?"وضعية جيدة":"Good posture",T.success,""],
   [String(session.alerts_count||0),isAr?"تنبيهات":"Alerts",T.warning,""],
   [_fmtDur(dur),isAr?"المدة":"Duration",T.primary,""],
   [`#${realIndex}`,isAr?"الجلسة":"Session",T.indigo,""]]
    .forEach(([v,l,col,s],i)=>_statCard(doc,ml+54+i*38,y+2,34,30,v,l,col,s));
  y+=58; divider(doc,ml,y,cw); y+=12;

  // Sparkline section
  if(hist.length>2){
    y=_secHead(doc,ml,y,isAr?"مسار النقاط":"Score Timeline",isAr?"الجلسة الكاملة":"Full session recording",gradeC,isAr);
    fc(doc,...T.bg);rr(doc,ml,y,cw,40,4,"F");dc(doc,...T.border);lw(doc,0.2);rr(doc,ml,y,cw,40,4,"S");lw(doc,0.3);
    _spark(doc,hist,ml+12,y+6,cw-24,28,gradeC);
    y+=48;
  }

  // Callouts
  if(painSum){y=_callout(doc,ml,y,cw,painSum,"warning");}
  if(impTip) {y=_callout(doc,ml,y,cw,impTip,"success");}

  // Top 4 metrics on page 1
  if(metricEntries.length>0){
    y=_secHead(doc,ml,y,isAr?"أبرز المقاييس":"Key Metrics",isAr?"مرتبة من الأسوأ":"Sorted worst first",gradeC,isAr);
    metricEntries.slice(0,4).forEach(({lbl,value,unit,sc})=>{
      if(y>H-48)return;
      _metCard(doc,ml,y,cw,lbl,value,unit,sc,isAr);y+=24;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ELITE PAGE 2 — All Metrics + Zonal Map
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();_hdr(doc,W,ml,mr,isAr?"تفاصيل المقاييس":"Metrics Detail");y=22;
  y=_secHead(doc,ml,y,isAr?"جميع مقاييس الوضعية":"Complete Metrics Breakdown",isAr?"مرتبة من الأسوأ":"All measurements · worst first",gradeC,isAr);

  metricEntries.forEach(({lbl,value,unit,sc})=>{
    if(y>H-38){doc.addPage();_hdr(doc,W,ml,mr,isAr?"تابع":"Continued");y=22;}
    _metCard(doc,ml,y,cw,lbl,value,unit,sc,isAr);y+=24;
  });

  // Zonal map
  y+=6;if(y>H-100){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خريطة المخاطر":"Risk Map");y=22;}
  y=_secHead(doc,ml,y,isAr?"خريطة مناطق الخطر":"Spinal Zone Risk Map",isAr?"مشتق من مقاييس الجلسة":"Derived from session metrics — not a diagnosis",T.danger);
  const zonal=_zonalRisk(metrics);
  [
    {k:"cervical",en:"Cervical (Neck)",ar:"عنق الرحم",r:"C1–C7",desc:"Head position, neck lean, FHP, and rotational deviation. Risk elevation correlates with cervical disc load and potential tension-type headache.",m:"Neck Lean, FHP, Head Tilt, Head Yaw"},
    {k:"thoracic",en:"Thoracic (Upper Back)",ar:"الصدر",r:"T1–T12",desc:"Shoulder symmetry, rounded shoulders, and upper spinal curvature. Chronic elevation indicates thoracic kyphosis risk or rotator cuff impingement.",m:"Shoulder Balance, Rounded Shoulders, Spine Lean"},
    {k:"lumbar",en:"Lumbar (Lower Back)",ar:"القطن",r:"L1–S1",desc:"Sagittal and coronal spinal alignment, hip angle, and pelvic positioning. Elevated risk may indicate lumbar disc load asymmetry or flexion intolerance.",m:"Spine Alignment, Hip Angle, Trunk Lean"},
  ].forEach(({k,en,ar,r,desc,m})=>{
    if(y>H-68){doc.addPage();_hdr(doc,W,ml,mr,isAr?"خريطة المخاطر":"Risk Map");y=22;}
    y=_zoneCard(doc,ml,y,cw,isAr?ar:en,r,zonal[k]||0,desc,m,isAr);
  });

  // ═══════════════════════════════════════════════════════════════
  // ELITE PAGE 3 — AI Analysis + Next Steps + Session Stats
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();_hdr(doc,W,ml,mr,isAr?"تحليل AI":"AI Analysis");y=22;

  // AI narrative
  if(aiText){
    y=_secHead(doc,ml,y,isAr?"تحليل Corvus AI":"Corvus AI Analysis",isAr?"مولّد خصيصاً لجلستك":"Generated specifically for this session",T.primary);
    fc(doc,...T.bg);rr(doc,ml,y,cw,8,2,"F");y+=10;
    const aiLines=doc.splitTextToSize(aiText.replace(/[#*`]/g,"").trim(),cw-8);
    font(doc,F.body,"normal");tc(doc,...T.sub);
    aiLines.forEach(l=>{
      if(y>H-30){doc.addPage();_hdr(doc,W,ml,mr,"AI Analysis");y=22;}
      doc.text(l,ml+4,y);y+=5.5;
    });
    y+=10;
  }

  // Next steps
  if(y>H-100){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الخطوات التالية":"Next Steps");y=22;}
  y=_secHead(doc,ml,y,isAr?"الخطوات العملية المقترحة":"Prioritised Next Steps",isAr?"بناءً على أسوأ نقاط الأداء":"Based on your worst-performing metrics",T.success);

  const NXT={
    neck:["Raise monitor so top edge aligns with eye level","Tuck chin gently — ear over shoulder","Set a posture alert every 20 min"],
    neck_lean:["Raise monitor so top edge aligns with eye level","Tuck chin gently — ear over shoulder","Set a posture alert every 20 min"],
    yaw:["Centre monitor directly in front","Avoid sustained head rotation to secondary screen","Chin tucks: 10 reps × 3 sets daily"],
    dist:["Maintain 50–70cm from screen","Increase font size to avoid forward lean","20-20-20: look 20ft away every 20 min"],
    posture:["Sit back fully against lumbar support","Feet flat, knees at 90°","Take a 2-min stand break every 45 min"],
    shoulder:["Adjust armrests to equal height","Roll shoulders back 10 reps × 3 sets","Doorway chest stretch 2× daily"],
    spine:["Align ear, shoulder, hip vertically","Use lumbar roll or support cushion","Core brace hold 30s × 5 reps daily"],
    rounded:["Retract shoulder blades together and down","Band pull-aparts 15 reps × 3 sets","Pec stretch in doorway 30s × 2 daily"],
    elbow:["Lower keyboard so elbows rest at 90°","Keep keyboard close to body","Wrist break every 45 min"],
    monitor:["Top of screen at eye level","Use laptop stand + external keyboard","Reduce neck flexion with tray adjustment"],
    distance:["Screen 50-80cm from eyes","Larger font = less squinting = less lean","20-20-20 rule every 20 min"],
    default:["Take 2-min stretch breaks every 30 min","Roll shoulders backward 5 times","Stand and walk 5 min per hour"],
  };

  metricEntries.slice(0,3).forEach(({key,lbl,sc},idx)=>{
    if(y>H-52){doc.addPage();_hdr(doc,W,ml,mr,isAr?"الخطوات التالية":"Next Steps");y=22;}
    const steps=NXT[key]||NXT.default;
    y=_stepCard(doc,ml,y,cw,idx+1,lbl,sc,steps,isAr);
  });

  // Session stats table
  y+=4;if(y>H-72){doc.addPage();_hdr(doc,W,ml,mr,isAr?"إحصائيات":"Statistics");y=22;}
  y=_secHead(doc,ml,y,isAr?"إحصائيات الجلسة":"Session Statistics","",gradeC,isAr);
  fc(doc,...T.card);rr(doc,ml,y,cw,metricEntries.length>0?68:60,4,"F");
  dc(doc,...T.border);lw(doc,0.2);rr(doc,ml,y,cw,68,4,"S");lw(doc,0.3);
  [
    [isAr?"النتيجة الكلية":"Overall Score",`${avg}/100 — ${gradeL}`],
    [isAr?"المدة":"Duration",_fmtDur(dur)],
    [isAr?"وضعية جيدة":"Good Posture",`${goodPct}%`],
    [isAr?"التنبيهات":"Alerts",String(session.alerts_count||0)],
    [isAr?"وضع الكاميرا":"Camera Mode",(session.mode||"laptop").toUpperCase()],
    [isAr?"المستوى":"Tier",tier.toUpperCase()],
    [isAr?"تاريخ الجلسة":"Session Date",dateStr],
    [isAr?"رقم الجلسة":"Session #",String(realIndex)],
  ].forEach(([k,v],i)=>{_infoRow(doc,ml,y,cw,k,v,i%2===0);y+=8.5;});

  // Page numbers
  const tot2=doc.internal.getNumberOfPages();
  for(let p=1;p<=tot2;p++){doc.setPage(p);_ftr(doc,W,ml,mr,H,p,tot2,name);}
  const fn=`Corvus_Elite_Report_${realIndex}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(fn);return fn;
}


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
