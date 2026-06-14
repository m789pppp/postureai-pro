/**
 * AccountSwitcher — Multi-Account System
 * Allows a user to link and switch between multiple Firebase accounts
 * without signing out. Uses a secondary Firebase App instance per linked account.
 *
 * Storage: Firestore `linked_accounts/{primaryUid}__{linkedUid}` docs
 * Security: only the primary uid can read/write their linked accounts
 */

import React, { useState, useEffect, useRef } from "react";
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, onAuthStateChanged,
} from "firebase/auth";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore, collection, query, where, getDocs,
  setDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase.js";

// ── Secondary Firebase App (for signing in linked accounts without touching primary auth)
const FB_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

function getSecondaryApp() {
  try { return getApp("secondary"); }
  catch { return initializeApp(FB_CONFIG, "secondary"); }
}

// ── Firestore helpers ─────────────────────────────────────────────
async function getLinkedAccounts(primaryUid) {
  const q = query(
    collection(db, "linked_accounts"),
    where("primary_uid", "==", primaryUid)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function linkAccount(primaryUid, linkedAccount) {
  const id = `${primaryUid}__${linkedAccount.uid}`;
  await setDoc(doc(db, "linked_accounts", id), {
    primary_uid:  primaryUid,
    linked_uid:   linkedAccount.uid,
    email:        linkedAccount.email,
    display_name: linkedAccount.displayName || linkedAccount.email.split("@")[0],
    provider:     linkedAccount.provider || "email",
    added_at:     serverTimestamp(),
  });
}

async function unlinkAccount(primaryUid, linkedUid) {
  await deleteDoc(doc(db, "linked_accounts", `${primaryUid}__${linkedUid}`));
}

// ── Avatar initial ────────────────────────────────────────────────
function Avatar({ name, email, size = 32, style = {} }) {
  const initials = (name || email || "?").slice(0, 1).toUpperCase();
  const hue = [...(email || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue},60%,45%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, color: "#fff",
      flexShrink: 0, ...style,
    }}>{initials}</div>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function AccountSwitcher({
  user, cs, isAr, addToast, onSwitchAccount,
}) {
  const [open,        setOpen]        = useState(false);
  const [accounts,    setAccounts]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [addMode,     setAddMode]     = useState(null); // null | "google" | "email"
  const [email,       setEmail]       = useState("");
  const [pass,        setPass]        = useState("");
  const [adding,      setAdding]      = useState(false);
  const [removing,    setRemoving]    = useState(null);
  const dropRef = useRef(null);

  // Load linked accounts when open
  useEffect(() => {
    if (!open || !user?.uid) return;
    setLoading(true);
    getLinkedAccounts(user.uid)
      .then(setAccounts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, user?.uid]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Add via Google ──────────────────────────────────────────────
  async function addGoogle() {
    setAdding(true);
    try {
      const secondaryApp  = getSecondaryApp();
      const secondaryAuth = getAuth(secondaryApp);
      const provider      = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(secondaryAuth, provider);
      const linked = result.user;

      if (linked.uid === user.uid) {
        addToast(isAr ? "هذا هو أكونتك الحالي بالفعل" : "This is already your current account", "warn");
        await secondaryAuth.signOut();
        setAdding(false);
        return;
      }

      // Check not already linked
      if (accounts.find(a => a.linked_uid === linked.uid)) {
        addToast(isAr ? "الأكونت ده مضاف بالفعل" : "Account already linked", "warn");
        await secondaryAuth.signOut();
        setAdding(false);
        return;
      }

      await linkAccount(user.uid, {
        uid: linked.uid, email: linked.email,
        displayName: linked.displayName, provider: "google",
      });
      await secondaryAuth.signOut();

      const fresh = await getLinkedAccounts(user.uid);
      setAccounts(fresh);
      setAddMode(null);
      addToast(isAr ? `✅ تم إضافة ${linked.email}` : `✅ Added ${linked.email}`, "success");
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        addToast(isAr ? `خطأ: ${err.message}` : `Error: ${err.message}`, "error");
      }
    }
    setAdding(false);
  }

  // ── Add via Email/Password ──────────────────────────────────────
  async function addEmail() {
    if (!email || !pass) { addToast(isAr ? "أدخل البريد وكلمة السر" : "Enter email and password", "warn"); return; }
    setAdding(true);
    try {
      const secondaryApp  = getSecondaryApp();
      const secondaryAuth = getAuth(secondaryApp);
      const result = await signInWithEmailAndPassword(secondaryAuth, email.trim(), pass);
      const linked = result.user;

      if (linked.uid === user.uid) {
        addToast(isAr ? "هذا هو أكونتك الحالي" : "This is already your current account", "warn");
        await secondaryAuth.signOut();
        setAdding(false);
        return;
      }
      if (accounts.find(a => a.linked_uid === linked.uid)) {
        addToast(isAr ? "الأكونت ده مضاف بالفعل" : "Account already linked", "warn");
        await secondaryAuth.signOut();
        setAdding(false);
        return;
      }

      await linkAccount(user.uid, {
        uid: linked.uid, email: linked.email,
        displayName: linked.displayName, provider: "email",
      });
      await secondaryAuth.signOut();

      const fresh = await getLinkedAccounts(user.uid);
      setAccounts(fresh);
      setAddMode(null);
      setEmail(""); setPass("");
      addToast(isAr ? `✅ تم إضافة ${linked.email}` : `✅ Added ${linked.email}`, "success");
    } catch (err) {
      const msg = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
        ? (isAr ? "كلمة السر غلط" : "Wrong password")
        : err.code === "auth/user-not-found"
          ? (isAr ? "البريد ده مش موجود" : "Email not found")
          : err.message;
      addToast(msg, "error");
    }
    setAdding(false);
  }

  // ── Switch to linked account ────────────────────────────────────
  async function switchTo(account) {
    setOpen(false);
    addToast(
      isAr ? `جاري التبديل إلى ${account.email}...` : `Switching to ${account.email}...`,
      "info"
    );
    // Store the current account info so user can switch back
    try { localStorage.setItem("postureai_prev_uid", user.uid); } catch(e) {}
    // Call parent to handle sign-in of the linked account
    onSwitchAccount?.(account);
  }

  // ── Remove linked account ───────────────────────────────────────
  async function removeAccount(account) {
    if (!window.confirm(isAr ? `إزالة ${account.email}؟` : `Remove ${account.email}?`)) return;
    setRemoving(account.linked_uid);
    try {
      await unlinkAccount(user.uid, account.linked_uid);
      setAccounts(p => p.filter(a => a.linked_uid !== account.linked_uid));
      addToast(isAr ? "تم إزالة الأكونت" : "Account removed", "success");
    } catch (err) {
      addToast(err.message, "error");
    }
    setRemoving(null);
  }

  const currentEmail = user?.email || "";
  const currentName  = user?.displayName || currentEmail.split("@")[0] || "User";

  return (
    <div ref={dropRef} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        title={isAr ? "تبديل الأكونت" : "Switch account"}
        style={{
          display: "flex", alignItems: "center", gap: 7, padding: "6px 10px",
          background: open ? "rgba(59,130,246,.15)" : "rgba(255,255,255,.05)",
          border: `1px solid ${open ? "rgba(59,130,246,.4)" : cs.border}`,
          borderRadius: 9, cursor: "pointer", transition: "all .2s",
        }}>
        <Avatar name={currentName} email={currentEmail} size={26} />
        <span style={{ fontSize: 12, color: cs.text, fontWeight: 600, maxWidth: 120,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {currentName}
        </span>
        {accounts.length > 0 && (
          <span style={{ fontSize: 10, background: "#3b82f6", color: "#fff",
            borderRadius: 99, padding: "1px 6px", fontWeight: 700 }}>
            +{accounts.length}
          </span>
        )}
        <span style={{ fontSize: 10, color: cs.muted, marginLeft: 2 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)",
          right: isAr ? "auto" : 0, left: isAr ? 0 : "auto",
          width: 300, background: cs.card,
          border: `1px solid ${cs.border}`,
          borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,.4)",
          zIndex: 9999, overflow: "hidden",
        }}>
          {/* Current account */}
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${cs.border}` }}>
            <div style={{ fontSize: 10, color: cs.muted, fontWeight: 600, marginBottom: 8,
              textTransform: "uppercase", letterSpacing: 1 }}>
              {isAr ? "الأكونت الحالي" : "Current Account"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={currentName} email={currentEmail} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: cs.text,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentName}
                </div>
                <div style={{ fontSize: 11, color: cs.muted,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentEmail}
                </div>
              </div>
              <span style={{ fontSize: 10, background: "rgba(16,185,129,.15)",
                color: "#10b981", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>
                {isAr ? "نشط" : "Active"}
              </span>
            </div>
          </div>

          {/* Linked accounts */}
          {loading ? (
            <div style={{ padding: "16px", textAlign: "center", color: cs.muted, fontSize: 12 }}>
              {isAr ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : accounts.length > 0 && (
            <div style={{ padding: "10px 0", borderBottom: `1px solid ${cs.border}` }}>
              <div style={{ fontSize: 10, color: cs.muted, fontWeight: 600, padding: "0 16px 8px",
                textTransform: "uppercase", letterSpacing: 1 }}>
                {isAr ? "الأكونتات المضافة" : "Linked Accounts"}
              </div>
              {accounts.map(acc => (
                <div key={acc.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 16px", cursor: "pointer",
                  transition: "background .15s",
                  opacity: removing === acc.linked_uid ? 0.4 : 1,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.04)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <Avatar name={acc.display_name} email={acc.email} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => switchTo(acc)}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: cs.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {acc.display_name}
                    </div>
                    <div style={{ fontSize: 11, color: cs.muted,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {acc.email}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => switchTo(acc)}
                      style={{ padding: "4px 10px", background: "rgba(59,130,246,.12)",
                        border: "1px solid rgba(59,130,246,.25)", borderRadius: 7,
                        color: "#60a5fa", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {isAr ? "تبديل" : "Switch"}
                    </button>
                    <button onClick={() => removeAccount(acc)}
                      disabled={removing === acc.linked_uid}
                      style={{ padding: "4px 8px", background: "rgba(239,68,68,.1)",
                        border: "1px solid rgba(239,68,68,.2)", borderRadius: 7,
                        color: "#f87171", fontSize: 11, cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add account section */}
          <div style={{ padding: "12px 16px" }}>
            {!addMode ? (
              <>
                <div style={{ fontSize: 11, color: cs.muted, marginBottom: 10,
                  textAlign: "center" }}>
                  {isAr ? "أضف أكونت تاني" : "Add another account"}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addGoogle}
                    disabled={adding}
                    style={{ flex: 1, padding: "9px", background: "rgba(255,255,255,.06)",
                      border: `1px solid ${cs.border}`, borderRadius: 9,
                      color: cs.text, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {adding ? "⏳" : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Google
                      </>
                    )}
                  </button>
                  <button onClick={() => setAddMode("email")}
                    style={{ flex: 1, padding: "9px", background: "rgba(255,255,255,.06)",
                      border: `1px solid ${cs.border}`, borderRadius: 9,
                      color: cs.text, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    ✉️ {isAr ? "بريد" : "Email"}
                  </button>
                </div>
              </>
            ) : (
              /* Email/Password add form */
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: cs.text, marginBottom: 2 }}>
                  {isAr ? "أدخل بيانات الأكونت التاني" : "Enter account credentials"}
                </div>
                <input
                  type="email" placeholder={isAr ? "البريد الإلكتروني" : "Email"}
                  value={email} onChange={e => setEmail(e.target.value)}
                  style={{ padding: "9px 12px", background: "rgba(255,255,255,.06)",
                    border: `1px solid ${cs.border}`, borderRadius: 8,
                    color: cs.text, fontSize: 12, outline: "none" }}
                />
                <input
                  type="password" placeholder={isAr ? "كلمة السر" : "Password"}
                  value={pass} onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addEmail()}
                  style={{ padding: "9px 12px", background: "rgba(255,255,255,.06)",
                    border: `1px solid ${cs.border}`, borderRadius: 8,
                    color: cs.text, fontSize: 12, outline: "none" }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addEmail} disabled={adding}
                    style={{ flex: 1, padding: "9px", background: "#1a56db",
                      border: "none", borderRadius: 8, color: "#fff",
                      fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {adding ? (isAr ? "جاري الإضافة..." : "Adding...") : (isAr ? "إضافة" : "Add")}
                  </button>
                  <button onClick={() => { setAddMode(null); setEmail(""); setPass(""); }}
                    style={{ padding: "9px 14px", background: "rgba(255,255,255,.06)",
                      border: `1px solid ${cs.border}`, borderRadius: 8,
                      color: cs.muted, fontSize: 12, cursor: "pointer" }}>
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
