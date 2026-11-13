/**
 * scripts/livetest/src/firebase.js — stands in for src/firebase.js in the live-session smoke test
 * (scripts/livetest). It signs in a fixed fake user and returns empty data, so the real
 * App.jsx session loop can run in a browser with no account and no network.
 * Never part of a production build: only vite.config.livetest.js aliases it in.
 * GENERATED stubs below cover every export of src/firebase.js; the test fails at build
 * time if firebase.js gains an export this file lacks.
 */
import { initializeApp } from "firebase/app";
// Some feature modules call getFirestore() / getAuth() directly when they load. They need a
// default app to exist; this one points at nothing and is never used for a request here.
initializeApp({ apiKey: "livetest", projectId: "livetest", appId: "1:0:web:livetest" });

const USER = { uid: "livetest-user", email: "livetest@example.invalid", displayName: "Live Test", emailVerified: true,
  providerData: [{ providerId: "password" }], metadata: {}, getIdToken: async () => "livetest-token", reload: async () => {} };
const PROFILE = { uid: USER.uid, email: USER.email, name: "Live Test", company: "", setup_complete: true, tier: "elite",
  is_trial: false, onboarding_complete: true, lang: "en", role: "user", approved: true, created_at: Date.now() };

export const SUPPORT_EMAIL = "support@example.invalid", ADMIN_PHONE = "", AUTO_APPROVE_DOMAIN = "", KASHIER_MERCHANT_ID = "";
export const auth = { currentUser: USER };
export const db = {};
export const serverTimestamp = () => new Date();
export const onAuthStateChanged = cb => { const t = setTimeout(() => cb(USER), 0); return () => clearTimeout(t); };
export const getUserProfile = async () => ({ ...PROFILE });
export const COMPANY_DOMAINS = [];
export const isCompanyDomain = () => false, isHREmail = () => false, isAutoApproveEmail = () => false;
export const getAuthToken = async () => "livetest-token";
export const onUserProfile = (_uid, cb) => { setTimeout(() => cb?.({ ...PROFILE }), 0); return () => {}; };
export const onUserSessions = (_uid, cb) => { setTimeout(() => cb?.([]), 0); return () => {}; };
export const listenToPayment = () => () => {};
export const getUserSessions = async () => [];
export const getCalibration = async () => null;
export const checkAndDowngradeTrial = async () => null;
export const getGoogleRedirectResult = async () => null;

// firestore re-exports: inert
const noop = () => ({});
export const doc = noop, collection = noop, query = noop, where = noop, orderBy = noop, limit = noop, increment = noop;
export const getDoc = async () => ({ exists: () => false, data: () => null });
export const getDocs = async () => ({ docs: [], empty: true, forEach() {} });
export const setDoc = async () => {}, updateDoc = async () => {}, deleteDoc = async () => {}, addDoc = async () => ({ id: "livetest" });
export const onSnapshot = () => () => {};
export const writeBatch = () => ({ set() {}, update() {}, delete() {}, commit: async () => {} });

// ── generated: every other export resolves to null ──
export const signInGoogle = async () => null;
export const signInMicrosoft = async () => null;
export const signInEmail = async () => null;
export const signUpEmail = async () => null;
export const deleteAuthUser = async () => null;
export const logOut = async () => null;
export const resetPassword = async () => null;
export const sendVerificationEmail = async () => null;
export const verifyResetCode = async () => null;
export const confirmReset = async () => null;
export const applyAction = async () => null;
export const changePassword = async () => null;
export const getReauthMethod = async () => null;
export const reauthenticate = async () => null;
export const setRememberMe = async () => null;
export const createUserProfile = async () => null;
export const trackReferral = async () => null;
export const getReferralStats = async () => null;
export const checkAndSendNurtureEmails = async () => null;
export const saveCalibration = async () => null;
export const updateUserProfile = async () => null;
export const completeOnboardingStep = async () => null;
export const updateUserTier = async () => null;
export const saveSession = async () => null;
export const deleteSession = async () => null;
export const getDepartments = async () => null;
export const createDepartment = async () => null;
export const deleteDepartment = async () => null;
export const getDepartmentEmployees = async () => null;
export const recordPayment = async () => null;
export const confirmPayment = async () => null;
export const rejectPayment = async () => null;
export const getAllPayments = async () => null;
export const getPaymentHistory = async () => null;
export const getAllUsers = async () => null;
export const createCompany = async () => null;
export const getCompany = async () => null;
export const updateCompany = async () => null;
export const bulkInviteEmployees = async () => null;
export const notifyPaymentPending = async () => null;
export const notifyPaymentConfirmed = async () => null;
export const sendWeeklyProgressEmails = async () => null;
export const seedDemoUser = async () => null;
export const createShareableReport = async () => null;
export const getSharedReport = async () => null;
