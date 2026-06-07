/**
 * PostureAI Pro — InviteAccept
 * Shown when user opens ?invite=TOKEN link
 * Looks up invite in Firestore, links user to company, redirects to home
 */
import { useState, useEffect } from "react";
import {
  auth, db,
  getUserProfile, createUserProfile,
  getAuthToken,
} from "./firebase.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function InviteAccept({ token, cs, lang, onAccepted, onError }) {
  const [status, setStatus] = useState("loading"); // loading | found | accepted | error
  const [invite, setInvite] = useState(null);
  const [err,    setErr]    = useState("");
  const isAr = lang === "ar";

  useEffect(() => {
    if (!token) { setStatus("error"); setErr("No invite token"); return; }
    loadInvite();
  }, [token]);

  async function loadInvite() {
    try {
      const ref  = doc(db, "invites", token);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setStatus("error");
        setErr(isAr ? "الدعوة غير موجودة أو منتهية الصلاحية" : "Invite not found or expired");
        return;
      }
      const data = snap.data();
      if (data.status === "accepted") {
        setStatus("error");
        setErr(isAr ? "تم قبول هذه الدعوة مسبقاً" : "This invite has already been accepted");
        return;
      }
      setInvite({ id: token, ...data });
      setStatus("found");
    } catch (e) {
      setStatus("error");
      setErr(e.message);
    }
  }

  async function acceptInvite() {
    if (!invite || !auth.currentUser) return;
    setStatus("loading");
    try {
      const uid  = auth.currentUser.uid;
      const user = auth.currentUser;

      // 1. Ensure user profile exists
      let p = await getUserProfile(uid);
      if (!p) {
        await createUserProfile(uid, {
          email:      user.email,
          name:       user.displayName || "",
          company:    invite.company_id || "",
        });
        p = await getUserProfile(uid);
      }

      // 2. Link user to company
      await updateDoc(doc(db, "users", uid), {
        company_id:  invite.company_id,
        department:  invite.department || "",
        role:        invite.role       || "employee",
        updated_at:  serverTimestamp(),
      });

      // 3. Mark invite as accepted
      await updateDoc(doc(db, "invites", token), {
        status:      "accepted",
        accepted_by: uid,
        accepted_at: serverTimestamp(),
      });

      // 4. Try backend notification
      try {
        const tok = await getAuthToken();
        const API = import.meta.env.VITE_API_URL || "http://localhost:5050/api";
        await fetch(`${API}/org/invite/accept`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
          body:    JSON.stringify({ token, uid, company_id: invite.company_id }),
        });
      } catch {} // Non-critical

      setStatus("accepted");
      setTimeout(() => onAccepted?.({ company_id: invite.company_id, role: invite.role }), 1500);
    } catch (e) {
      setStatus("error");
      setErr(e.message);
    }
  }

  const BG = "linear-gradient(135deg, #020d1f 0%, #030b14 100%)";

  return (
    <div style={{
      minHeight: "100vh", background: BG,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "'Inter',system-ui,sans-serif",
      direction: isAr ? "rtl" : "ltr",
    }}>
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>

        {/* Logo */}
        <div style={{ width: 56, height: 56, background: "linear-gradient(135deg,#1a56db,#0891b2)", borderRadius: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 20, boxShadow: "0 8px 32px rgba(26,86,219,.35)" }}>◈</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f6ff", marginBottom: 6, letterSpacing: "-.025em" }}>PostureAI Pro</div>

        {/* Loading */}
        {status === "loading" && (
          <div style={{ marginTop: 32 }}>
            <div style={{ width: 36, height: 36, border: "3px solid rgba(26,86,219,.3)", borderTopColor: "#1a56db", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }}/>
            <div style={{ fontSize: 13, color: "#64748b" }}>{isAr ? "جاري التحقق من الدعوة..." : "Checking invite..."}</div>
          </div>
        )}

        {/* Invite found */}
        {status === "found" && invite && (
          <div style={{ marginTop: 32, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: 28 }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🏢</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f6ff", marginBottom: 8 }}>
              {isAr ? "تمت دعوتك للانضمام" : "You've been invited"}
            </div>
            <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24, lineHeight: 1.6 }}>
              {isAr
                ? <>انضم إلى فريق <strong style={{ color: "#60a5fa" }}>{invite.name || invite.email}</strong> على PostureAI Pro</>
                : <>Join <strong style={{ color: "#60a5fa" }}>{invite.name || invite.email}</strong>'s team on PostureAI Pro</>
              }
              {invite.role && <div style={{ marginTop: 8, fontSize: 12 }}>
                {isAr ? "دورك: " : "Role: "}
                <span style={{ background: "rgba(26,86,219,.15)", color: "#60a5fa", borderRadius: 6, padding: "2px 10px", fontWeight: 600 }}>{invite.role}</span>
              </div>}
            </div>

            {auth.currentUser ? (
              <button onClick={acceptInvite}
                style={{ width: "100%", background: "linear-gradient(135deg,#1a56db,#0891b2)", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 20px rgba(26,86,219,.4)" }}>
                {isAr ? "✓ قبول الدعوة والانضمام" : "✓ Accept Invite & Join"}
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
                  {isAr ? "سجّل دخولك أولاً لقبول الدعوة" : "Sign in first to accept this invite"}
                </div>
                <button onClick={() => {
                  // Store token for after-auth acceptance
                  sessionStorage.setItem("pending_invite", token);
                  window.location.hash = "auth";
                }}
                  style={{ width: "100%", background: "#1a56db", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                  {isAr ? "تسجيل الدخول" : "Sign In →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Accepted */}
        {status === "accepted" && (
          <div style={{ marginTop: 32, background: "rgba(16,185,129,.06)", border: "1px solid rgba(16,185,129,.2)", borderRadius: 20, padding: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginBottom: 8 }}>
              {isAr ? "تم الانضمام بنجاح!" : "Welcome to the team!"}
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              {isAr ? "جاري تحويلك إلى الداشبورد..." : "Redirecting to dashboard..."}
            </div>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div style={{ marginTop: 32, background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 20, padding: 28 }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fca5a5", marginBottom: 8 }}>
              {isAr ? "خطأ في الدعوة" : "Invite Error"}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>{err}</div>
            <button onClick={() => { window.location.hash = "home"; }}
              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 24px", fontSize: 13, color: "#94a3b8", cursor: "pointer" }}>
              {isAr ? "← الرئيسية" : "← Go Home"}
            </button>
          </div>
        )}

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
