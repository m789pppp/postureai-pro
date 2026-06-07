/**
 * PostureAI Pro — Multi-Tenant Company System
 * Company onboarding, workspace setup, employee invites
 */
import { useState, useEffect, useCallback } from "react";
import {
  createCompany, getCompany, updateCompany,
  getDepartments, createDepartment, deleteDepartment,
  bulkInviteEmployees, getDepartmentEmployees,
  updateUserProfile, db,
} from "./firebase.js";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

const API = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

// ── Company Setup Wizard ──────────────────────────────────────────
export function CompanyOnboarding({ profile, cs, lang = "en", onComplete }) {
  const [step,    setStep]    = useState(1); // 1=info, 2=depts, 3=invite, 4=done
  const [company, setCompany] = useState({ name: "", industry: "", size: "", website: "", country: "Egypt" });
  const [depts,   setDepts]   = useState([{ name: "Engineering", manager: "" }, { name: "HR", manager: "" }]);
  const [invites, setInvites] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyId, setCid]   = useState(null);
  const isAr = lang === "ar";

  const DARK = cs || { bg: "#030b14", card: "#05101f", border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b" };

  const T = {
    en: {
      step1: "Company Information",
      step2: "Departments",
      step3: "Invite Employees",
      step4: "You're ready!",
      companyName: "Company name", industry: "Industry", size: "Company size",
      website: "Website (optional)", addDept: "+ Add department",
      inviteDesc: "Enter employee emails (one per line or comma-separated)",
      invitePh: "ahmed@company.com\nfatma@company.com\n...",
      next: "Continue →", back: "← Back", finish: "Launch workspace →",
      skip: "Skip for now",
      industries: ["Technology", "Banking & Finance", "Healthcare", "Manufacturing", "Retail", "Government", "Education", "Other"],
      sizes: ["1-10", "11-50", "51-200", "201-500", "500-1000", "1000+"],
    },
    ar: {
      step1: "معلومات الشركة",
      step2: "الأقسام",
      step3: "دعوة الموظفين",
      step4: "أنت جاهز!",
      companyName: "اسم الشركة", industry: "القطاع", size: "حجم الشركة",
      website: "الموقع الإلكتروني (اختياري)", addDept: "+ إضافة قسم",
      inviteDesc: "أدخل إيميلات الموظفين (كل إيميل في سطر أو مفصول بفاصلة)",
      invitePh: "ahmed@company.com\nfatma@company.com\n...",
      next: "متابعة ←", back: "→ رجوع", finish: "إطلاق مساحة العمل ←",
      skip: "تخطي الآن",
      industries: ["التكنولوجيا", "البنوك والمالية", "الرعاية الصحية", "التصنيع", "التجزئة", "الحكومة", "التعليم", "أخرى"],
      sizes: ["1-10", "11-50", "51-200", "201-500", "500-1000", "1000+"],
    },
  };
  const t = T[lang] || T.en;

  const saveStep1 = async () => {
    if (!company.name.trim()) return;
    setLoading(true);
    try {
      const cid = await createCompany(profile.uid, {
        name:     company.name.trim(),
        industry: company.industry,
        size:     company.size,
        website:  company.website,
        country:  company.country,
        plan:     profile.tier || "professional",
      });
      setCid(cid);
      setStep(2);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveStep2 = async () => {
    if (!companyId) { setStep(2); return; }
    setLoading(true);
    try {
      for (const dept of depts.filter(d => d.name.trim())) {
        await createDepartment({ name: dept.name.trim(), manager: dept.manager, company_id: companyId });
      }
      setStep(3);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveStep3 = async () => {
    setLoading(true);
    try {
      if (invites.trim() && companyId) {
        const emails = invites.split(/[\n,;]/).map(e => e.trim().toLowerCase()).filter(e => e.includes("@"));
        const employees = emails.map(email => ({ email, name: email.split("@")[0], company_id: companyId }));
        await bulkInviteEmployees(employees, companyId, profile.uid);
      }
      setStep(4);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const inputStyle = {
    width: "100%", background: "rgba(148,163,184,.06)", border: `0.5px solid ${DARK.border}`,
    borderRadius: 9, padding: "10px 14px", fontSize: 13, color: DARK.text, outline: "none", boxSizing: "border-box",
  };
  const selectStyle = { ...inputStyle };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9800, backdropFilter: "blur(12px)" }}>
      <div style={{ background: DARK.card, border: `0.5px solid ${DARK.border}`, borderRadius: 22, width: "min(580px,96vw)", maxHeight: "92vh", overflowY: "auto", direction: isAr ? "rtl" : "ltr" }}>

        {/* Header */}
        <div style={{ padding: "22px 24px 16px", borderBottom: `0.5px solid ${DARK.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: DARK.text }}>🏢 {isAr ? "إعداد مساحة عمل الشركة" : "Set up Company Workspace"}</div>
            <div style={{ fontSize: 11, color: DARK.muted }}>{step}/4</div>
          </div>
          {/* Progress */}
          <div style={{ display: "flex", gap: 6 }}>
            {[1,2,3,4].map(s => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 99, background: s <= step ? "#1a56db" : "rgba(148,163,184,.15)", transition: "background .3s" }} />
            ))}
          </div>
        </div>

        <div style={{ padding: "24px" }}>

          {/* Step 1: Company Info */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: DARK.text, marginBottom: 4 }}>{t.step1}</div>
              <div>
                <label style={{ fontSize: 11, color: DARK.muted, display: "block", marginBottom: 5 }}>{t.companyName} *</label>
                <input value={company.name} onChange={e => setCompany(c => ({...c, name: e.target.value}))} style={inputStyle} placeholder={isAr ? "مثال: شركة الأهرام للتكنولوجيا" : "e.g. Acme Corporation"} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: DARK.muted, display: "block", marginBottom: 5 }}>{t.industry}</label>
                  <select value={company.industry} onChange={e => setCompany(c => ({...c, industry: e.target.value}))} style={selectStyle}>
                    <option value="">{isAr ? "اختر القطاع" : "Select industry"}</option>
                    {t.industries.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: DARK.muted, display: "block", marginBottom: 5 }}>{t.size}</label>
                  <select value={company.size} onChange={e => setCompany(c => ({...c, size: e.target.value}))} style={selectStyle}>
                    <option value="">{isAr ? "حجم الشركة" : "Company size"}</option>
                    {t.sizes.map(s => <option key={s} value={s}>{s} {isAr ? "موظف" : "employees"}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: DARK.muted, display: "block", marginBottom: 5 }}>{t.website}</label>
                <input value={company.website} onChange={e => setCompany(c => ({...c, website: e.target.value}))} style={inputStyle} placeholder="https://yourcompany.com" />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={onComplete} style={{ flex: 1, background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 9, padding: "11px 0", fontSize: 12, color: DARK.muted, cursor: "pointer" }}>{t.skip}</button>
                <button onClick={saveStep1} disabled={loading || !company.name.trim()} style={{ flex: 2, background: "#1a56db", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
                  {loading ? "…" : t.next}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Departments */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: DARK.text, marginBottom: 4 }}>{t.step2}</div>
              {depts.map((dept, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input value={dept.name} onChange={e => setDepts(d => d.map((x, j) => j===i ? {...x, name: e.target.value} : x))}
                    style={{ ...inputStyle, flex: 2 }} placeholder={isAr ? "اسم القسم" : "Department name"} />
                  <input value={dept.manager} onChange={e => setDepts(d => d.map((x, j) => j===i ? {...x, manager: e.target.value} : x))}
                    style={{ ...inputStyle, flex: 1 }} placeholder={isAr ? "المدير" : "Manager"} />
                  {depts.length > 1 && (
                    <button onClick={() => setDepts(d => d.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: DARK.muted, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => setDepts(d => [...d, { name: "", manager: "" }])}
                style={{ background: "rgba(26,86,219,.06)", border: "0.5px solid rgba(26,86,219,.2)", borderRadius: 9, padding: "9px 0", fontSize: 12, color: "#93c5fd", cursor: "pointer" }}>
                {t.addDept}
              </button>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 9, padding: "11px 0", fontSize: 12, color: DARK.muted, cursor: "pointer" }}>{t.back}</button>
                <button onClick={saveStep2} disabled={loading} style={{ flex: 2, background: "#1a56db", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
                  {loading ? "…" : t.next}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Invite */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: DARK.text, marginBottom: 4 }}>{t.step3}</div>
              <div style={{ fontSize: 12, color: DARK.muted, lineHeight: 1.6 }}>{t.inviteDesc}</div>
              <textarea value={invites} onChange={e => setInvites(e.target.value)} rows={6}
                placeholder={t.invitePh}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace" }} />
              <div style={{ fontSize: 10, color: DARK.muted }}>
                {invites.trim() ? `${invites.split(/[\n,;]/).filter(e => e.trim().includes("@")).length} ${isAr ? "إيميل صالح" : "valid emails"}` : ""}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => setStep(2)} style={{ flex: 1, background: "none", border: `0.5px solid ${DARK.border}`, borderRadius: 9, padding: "11px 0", fontSize: 12, color: DARK.muted, cursor: "pointer" }}>{t.back}</button>
                <button onClick={saveStep3} disabled={loading} style={{ flex: 2, background: "#1a56db", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" }}>
                  {loading ? "…" : t.next}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: DARK.text, marginBottom: 8 }}>{t.step4}</div>
              <div style={{ fontSize: 13, color: DARK.muted, marginBottom: 28, lineHeight: 1.7 }}>
                {isAr
                  ? `تم إنشاء مساحة العمل لـ "${company.name}". يمكنك الآن مراقبة وضعية فريقك بالكامل.`
                  : `Workspace created for "${company.name}". You can now monitor your entire team's posture.`}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {[
                  [isAr ? "✅ مساحة العمل أُنشئت" : "✅ Workspace created",            true],
                  [isAr ? "✅ الأقسام أُضيفت"      : "✅ Departments added",            depts.filter(d=>d.name).length > 0],
                  [isAr ? "✅ الدعوات أُرسلت"      : "✅ Invites sent",                 invites.trim().length > 0],
                  [isAr ? "✅ لوحة HR جاهزة"       : "✅ HR dashboard ready",           true],
                ].map(([label, done]) => done ? (
                  <div key={label} style={{ fontSize: 12, color: "#10b981", padding: "7px 14px", background: "rgba(16,185,129,.08)", borderRadius: 8 }}>{label}</div>
                ) : null)}
              </div>
              <button onClick={onComplete} style={{ background: "linear-gradient(135deg,#1a56db,#0891b2)", border: "none", borderRadius: 10, padding: "13px 36px", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer", boxShadow: "0 8px 28px rgba(26,86,219,.3)" }}>
                {t.finish}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Company Context Bar (shown in app when user has company) ──────
export function CompanyBar({ profile, company, cs, lang = "en", onHRPanel }) {
  if (!company) return null;
  const isAr = lang === "ar";
  const DARK = cs || { border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b" };
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 12px", background: "rgba(26,86,219,.06)", border: `0.5px solid rgba(26,86,219,.15)`, borderRadius: 10, marginBottom: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#1a56db,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🏢</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: DARK.text }}>{company.name}</div>
        <div style={{ fontSize: 9, color: DARK.muted }}>{company.plan?.toUpperCase()} · {company.industry}</div>
      </div>
      {(profile?.is_admin || profile?.acct_type === "company") && (
        <button onClick={onHRPanel} style={{ background: "rgba(26,86,219,.1)", border: "0.5px solid rgba(26,86,219,.2)", borderRadius: 7, padding: "4px 10px", fontSize: 10, fontWeight: 600, color: "#93c5fd", cursor: "pointer", whiteSpace: "nowrap" }}>
          {isAr ? "لوحة HR" : "HR Panel"}
        </button>
      )}
    </div>
  );
}

// ── useCompany hook ───────────────────────────────────────────────
export function useCompany(profile) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile?.company_id) return;
    setLoading(true);
    getCompany(profile.company_id)
      .then(c => setCompany(c))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile?.company_id]);

  return { company, loading };
}
