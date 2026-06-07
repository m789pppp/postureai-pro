/**
 * PostureAI Pro — Enterprise SSO / SAML 2.0
 * Supports: Azure AD, Okta, Google Workspace, Auth0, OneLogin
 * Firebase handles the OIDC/SAML flow — this file manages the UI + config
 */
import { useState, useEffect } from "react";
import {
  getAuth, signInWithPopup,
  OAuthProvider, GoogleAuthProvider,
  signInWithRedirect, getRedirectResult,
} from "firebase/auth";

// SAMLAuthProvider — Firebase enterprise SSO (requires Firebase Console setup)
// Falls back to OAuthProvider for non-SAML providers
import { db } from "./firebase.js";
import {
  doc, getDoc, setDoc, collection, query, where, getDocs, limit,
} from "firebase/firestore";

const auth = getAuth();

// ── SSO Provider configs ──────────────────────────────────────────
export const SSO_PROVIDERS = {
  azure: {
    id:       "azure",
    name:     "Microsoft / Azure AD",
    nameAr:   "مايكروسوفت / Azure AD",
    icon:     "🪟",
    color:    "#0078D4",
    hint:     "For companies using Microsoft 365 / Azure Active Directory",
    hintAr:   "للشركات التي تستخدم Microsoft 365 / Azure AD",
    // Firebase SAML provider ID — configured in Firebase Console
    providerId: import.meta.env.VITE_SAML_AZURE_PROVIDER_ID || "saml.azure-ad",
    type:     "saml",
  },
  okta: {
    id:       "okta",
    name:     "Okta",
    nameAr:   "Okta",
    icon:     "🔐",
    color:    "#007DC1",
    hint:     "For companies using Okta identity management",
    hintAr:   "للشركات التي تستخدم Okta",
    providerId: import.meta.env.VITE_SAML_OKTA_PROVIDER_ID || "saml.okta",
    type:     "saml",
  },
  google_workspace: {
    id:       "google_workspace",
    name:     "Google Workspace",
    nameAr:   "Google Workspace",
    icon:     "🇬",
    color:    "#4285F4",
    hint:     "For companies using Google Workspace / G Suite",
    hintAr:   "للشركات التي تستخدم Google Workspace",
    providerId: "google.com",
    type:     "oidc",
  },
};

// ── Domain-to-provider mapping (stored in Firestore) ─────────────
export async function getProviderForDomain(domain) {
  try {
    const q = query(
      collection(db, "sso_configs"),
      where("domain", "==", domain.toLowerCase()),
      where("active", "==", true),
      limit(1)
    );
    const snaps = await getDocs(q);
    if (snaps.empty) return null;
    return snaps.docs[0].data();
  } catch {
    return null;
  }
}

export async function saveSSOConfig(data) {
  await setDoc(doc(db, "sso_configs", data.domain.replace(/\./g, "_")), {
    ...data,
    domain:     data.domain.toLowerCase(),
    active:     true,
    created_at: new Date().toISOString(),
  });
}

// ── SSO Sign In ───────────────────────────────────────────────────
export async function signInWithSSO(providerId, type = "saml") {
  let provider;
  if (type === "saml") {
    // SAML 2.0 via Firebase Auth — requires SAML provider configured in Firebase Console
    try {
      const { SAMLAuthProvider } = await import("firebase/auth");
      provider = new SAMLAuthProvider(providerId);
    } catch {
      // Fallback: use OAuthProvider if SAMLAuthProvider unavailable
      provider = new OAuthProvider(providerId);
    }
  } else if (type === "oidc") {
    provider = new OAuthProvider(providerId);
  } else {
    // Google Workspace
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: "*" });
  }

  // Try popup first, fallback to redirect
  try {
    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (e) {
    if (e.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, provider);
      return null; // redirect will handle it
    }
    throw e;
  }
}

// Handle redirect result on page load
export async function handleSSORedirect() {
  try {
    const result = await getRedirectResult(auth);
    return result;
  } catch {
    return null;
  }
}

// ── SSO Login Component ───────────────────────────────────────────
export function SSOLoginPanel({ cs, lang = "en", onSuccess, onError }) {
  const [domain,  setDomain]  = useState("");
  const [loading, setLoading] = useState(false);
  const [config,  setConfig]  = useState(null);
  const [step,    setStep]    = useState("email"); // email | provider | loading

  const isAr = lang === "ar";
  const DARK = cs || { card: "#05101f", border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b" };

  const T = {
    en: {
      title:       "Enterprise SSO Sign In",
      sub:         "Sign in with your company account",
      emailLabel:  "Work email",
      emailPh:     "you@company.com",
      detectBtn:   "Continue →",
      detecting:   "Detecting SSO configuration…",
      noSSO:       "No SSO configured for this domain. Use email/password instead.",
      providerTitle: "Sign in with",
      or:          "or sign in with a specific provider",
      setupSSO:    "Set up SSO for my organization →",
    },
    ar: {
      title:       "تسجيل الدخول المؤسسي SSO",
      sub:         "سجّل الدخول بحساب شركتك",
      emailLabel:  "البريد الوظيفي",
      emailPh:     "you@company.com",
      detectBtn:   "متابعة →",
      detecting:   "جاري التحقق من إعدادات SSO…",
      noSSO:       "لا يوجد SSO مُعدّ لهذا النطاق. استخدم البريد وكلمة المرور.",
      providerTitle: "تسجيل الدخول بـ",
      or:          "أو اختر مزوداً محدداً",
      setupSSO:    "إعداد SSO لمؤسستي →",
    },
  };
  const t = T[lang] || T.en;

  const detectSSO = async () => {
    if (!domain.includes("@")) return;
    const d = domain.split("@")[1];
    setLoading(true);
    setStep("detecting");
    try {
      const cfg = await getProviderForDomain(d);
      if (cfg) {
        setConfig(cfg);
        setStep("provider");
      } else {
        setStep("no_sso");
      }
    } catch {
      setStep("no_sso");
    } finally {
      setLoading(false);
    }
  };

  const doSSO = async (providerId, type) => {
    setLoading(true);
    try {
      const result = await signInWithSSO(providerId, type);
      if (result) onSuccess?.(result.user);
    } catch (e) {
      onError?.(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: DARK.card, border: `0.5px solid ${DARK.border}`, borderRadius: 16, padding: 24, maxWidth: 420, width: "100%", direction: isAr ? "rtl" : "ltr" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🏢</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: DARK.text }}>{t.title}</div>
        <div style={{ fontSize: 12, color: DARK.muted, marginTop: 4 }}>{t.sub}</div>
      </div>

      {(step === "email" || step === "no_sso") && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: DARK.muted, display: "block", marginBottom: 6 }}>{t.emailLabel}</label>
            <input
              type="email" value={domain} onChange={e => setDomain(e.target.value)}
              placeholder={t.emailPh} onKeyDown={e => e.key === "Enter" && detectSSO()}
              style={{ width: "100%", background: "rgba(148,163,184,.06)", border: `0.5px solid ${DARK.border}`, borderRadius: 9, padding: "10px 14px", fontSize: 13, color: DARK.text, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {step === "no_sso" && (
            <div style={{ fontSize: 11, color: "#f59e0b", padding: "8px 12px", background: "rgba(245,158,11,.08)", borderRadius: 7, marginBottom: 12 }}>
              ⚠️ {t.noSSO}
            </div>
          )}
          <button onClick={detectSSO} disabled={loading || !domain.includes("@")} style={{ width: "100%", background: "#1a56db", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
            {loading ? t.detecting : t.detectBtn}
          </button>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, color: DARK.muted, textAlign: "center", marginBottom: 12 }}>{t.or}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.values(SSO_PROVIDERS).map(p => (
                <button key={p.id} onClick={() => doSSO(p.providerId, p.type)} style={{ display: "flex", gap: 10, alignItems: "center", background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 9, padding: "10px 14px", cursor: "pointer", color: DARK.text, fontSize: 12 }}>
                  <span style={{ fontSize: 16 }}>{p.icon}</span>
                  <span>{isAr ? p.nameAr : p.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 9, color: DARK.muted }}>{isAr ? p.hintAr : p.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === "detecting" && (
        <div style={{ textAlign: "center", padding: "20px 0", color: DARK.muted, fontSize: 12 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          {t.detecting}
        </div>
      )}

      {step === "provider" && config && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: DARK.muted, marginBottom: 16 }}>
            {t.providerTitle} <strong style={{ color: DARK.text }}>{config.provider_name}</strong>
          </div>
          <button onClick={() => doSSO(config.provider_id, config.provider_type)} disabled={loading} style={{ width: "100%", background: config.color || "#1a56db", border: "none", borderRadius: 9, padding: "13px 0", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
            {loading ? "Signing in…" : `Continue with ${config.provider_name}`}
          </button>
          <button onClick={() => setStep("email")} style={{ marginTop: 10, background: "none", border: "none", fontSize: 11, color: DARK.muted, cursor: "pointer" }}>← Back</button>
        </div>
      )}
    </div>
  );
}

// ── SSO Setup Panel (Admin) ───────────────────────────────────────
export function SSOSetupPanel({ companyId, cs, lang = "en", onSaved }) {
  const [form, setForm] = useState({ domain: "", provider_id: "", provider_type: "saml", provider_name: "", color: "#0078D4" });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const isAr = lang === "ar";
  const DARK = cs || { card: "#05101f", border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b" };

  const save = async () => {
    if (!form.domain || !form.provider_id) return;
    setSaving(true);
    try {
      await saveSSOConfig({ ...form, company_id: companyId });
      setSaved(true);
      onSaved?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "rgba(26,86,219,.05)", border: `0.5px solid rgba(26,86,219,.2)`, borderRadius: 14, padding: 20, direction: isAr ? "rtl" : "ltr" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: DARK.text, marginBottom: 4 }}>🔐 {isAr ? "إعداد SSO للمؤسسة" : "Enterprise SSO Setup"}</div>
      <div style={{ fontSize: 11, color: DARK.muted, marginBottom: 16 }}>
        {isAr ? "اضبط Firebase SAML Provider أولاً في Firebase Console → Authentication → Sign-in providers" : "Configure Firebase SAML Provider first in Firebase Console → Authentication → Sign-in providers"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          ["domain", isAr ? "نطاق الشركة" : "Company domain", "company.com"],
          ["provider_name", isAr ? "اسم المزود" : "Provider name", "Azure AD / Okta"],
          ["provider_id", isAr ? "Firebase Provider ID" : "Firebase Provider ID", "saml.my-company"],
          ["color", isAr ? "لون الزرار" : "Button color", "#0078D4"],
        ].map(([field, label, ph]) => (
          <div key={field}>
            <label style={{ fontSize: 10, color: DARK.muted, display: "block", marginBottom: 4 }}>{label}</label>
            <input
              value={form[field] || ""} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              placeholder={ph}
              style={{ width: "100%", background: "rgba(148,163,184,.06)", border: `0.5px solid ${DARK.border}`, borderRadius: 7, padding: "8px 10px", fontSize: 12, color: DARK.text, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 10, color: DARK.muted, display: "block", marginBottom: 4 }}>
          {isAr ? "نوع المزود" : "Provider type"}
        </label>
        <select value={form.provider_type} onChange={e => setForm(f => ({ ...f, provider_type: e.target.value }))}
          style={{ background: "rgba(148,163,184,.06)", border: `0.5px solid ${DARK.border}`, borderRadius: 7, padding: "8px 10px", fontSize: 12, color: DARK.text, outline: "none" }}>
          <option value="saml">SAML 2.0 (Azure AD, Okta, OneLogin)</option>
          <option value="oidc">OIDC (Google Workspace, Auth0)</option>
        </select>
      </div>
      {saved ? (
        <div style={{ fontSize: 12, color: "#10b981", padding: "8px 12px", background: "rgba(16,185,129,.08)", borderRadius: 7 }}>✅ {isAr ? "تم حفظ إعدادات SSO" : "SSO configuration saved"}</div>
      ) : (
        <button onClick={save} disabled={saving} style={{ background: "#1a56db", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 12, fontWeight: 600, color: "white", cursor: "pointer" }}>
          {saving ? "Saving…" : (isAr ? "حفظ الإعدادات" : "Save SSO Config")}
        </button>
      )}
      <div style={{ fontSize: 10, color: DARK.muted, marginTop: 12, lineHeight: 1.6 }}>
        📖 {isAr ? "تعليمات:" : "Setup guide:"} Firebase Console → Authentication → Sign-in providers → SAML → Add provider → Paste metadata URL from Azure/Okta
      </div>
    </div>
  );
}
