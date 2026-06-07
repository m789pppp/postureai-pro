/**
 * LegalCompliance.jsx — PostureAI Phase 14
 * Cookie consent banner, ToS, Privacy Policy, DPA — GDPR/CCPA compliant
 */
import { useState, useEffect } from "react";

const COOKIE_KEY = "postureai_cookie_consent_v1";

// ── Cookie Consent Banner ───────────────────────────────────────
export function CookieConsent({ cs }) {
  const [show, setShow]     = useState(false);
  const [detail, setDetail] = useState(false);
  const [prefs, setPrefs]   = useState({ necessary: true, analytics: false, marketing: false });

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) setShow(true);
  }, []);

  const acceptAll = () => {
    const consent = { necessary: true, analytics: true, marketing: true, ts: Date.now() };
    localStorage.setItem(COOKIE_KEY, JSON.stringify(consent));
    setShow(false);
  };

  const acceptSelected = () => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ ...prefs, ts: Date.now() }));
    setShow(false);
  };

  const rejectAll = () => {
    const consent = { necessary: true, analytics: false, marketing: false, ts: Date.now() };
    localStorage.setItem(COOKIE_KEY, JSON.stringify(consent));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, padding: 16, pointerEvents: "none" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", background: cs?.card || "#1e293b", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 -8px 40px rgba(0,0,0,0.4)", pointerEvents: "all" }}>
        <div style={{ fontWeight: 700, color: cs?.text || "#fff", marginBottom: 8, fontSize: 15 }}>🍪 Cookie Preferences</div>
        <p style={{ fontSize: 13, color: cs?.textDim || "#94a3b8", marginBottom: 14, lineHeight: 1.6 }}>
          We use cookies to analyse usage and improve your experience. Necessary cookies cannot be disabled. See our{" "}
          <a href="/privacy" style={{ color: "#6366f1" }}>Privacy Policy</a>.
        </p>

        {detail && (
          <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { key: "necessary", label: "Necessary", desc: "Session auth, security — always on", locked: true },
              { key: "analytics", label: "Analytics",  desc: "Usage stats, error tracking (Sentry)" },
              { key: "marketing", label: "Marketing",  desc: "Affiliate tracking, retargeting" },
            ].map(cat => (
              <div key={cat.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: cs?.text || "#fff" }}>{cat.label}</div>
                  <div style={{ fontSize: 11, color: cs?.textDim || "#94a3b8" }}>{cat.desc}</div>
                </div>
                <div onClick={() => !cat.locked && setPrefs(p => ({ ...p, [cat.key]: !p[cat.key] }))}
                  style={{ width: 40, height: 22, borderRadius: 11, background: (prefs[cat.key] || cat.locked) ? "#6366f1" : "rgba(255,255,255,0.1)", cursor: cat.locked ? "default" : "pointer", position: "relative", flexShrink: 0, transition: "background .2s", opacity: cat.locked ? 0.6 : 1 }}>
                  <div style={{ position: "absolute", top: 3, left: (prefs[cat.key] || cat.locked) ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={acceptAll} style={{ background: "linear-gradient(135deg,#6366f1,#0ea5e9)", border: "none", color: "#fff", borderRadius: 9, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Accept All</button>
          <button onClick={acceptSelected} style={{ background: "transparent", border: "1px solid rgba(99,102,241,0.4)", color: "#6366f1", borderRadius: 9, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Accept Selected</button>
          <button onClick={rejectAll} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: cs?.textDim || "#94a3b8", borderRadius: 9, padding: "9px 14px", cursor: "pointer", fontSize: 13 }}>Reject All</button>
          <button onClick={() => setDetail(p => !p)} style={{ background: "transparent", border: "none", color: cs?.textDim || "#94a3b8", cursor: "pointer", fontSize: 12, marginLeft: "auto", textDecoration: "underline" }}>
            {detail ? "Hide details" : "Customise"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Legal Modal (ToS / Privacy / DPA) ──────────────────────────
export function LegalModal({ doc, cs, onClose }) {
  const docs = {
    tos: {
      title: "Terms of Service",
      lastUpdated: "2026-06-01",
      sections: [
        { heading: "1. Acceptance", body: "By accessing or using PostureAI, you agree to be bound by these Terms. If you do not agree, do not use the Service." },
        { heading: "2. Service Description", body: "PostureAI provides AI-powered posture analysis via camera, health reporting, and related enterprise tools. The Service is not a medical device and does not provide medical advice." },
        { heading: "3. Account Obligations", body: "You are responsible for maintaining the security of your account credentials. You agree not to share your login or API keys with unauthorised parties." },
        { heading: "4. Acceptable Use", body: "You may not use the Service to: (a) violate laws; (b) infringe IP rights; (c) transmit malware; (d) reverse-engineer proprietary models; (e) scrape data without authorisation." },
        { heading: "5. Data & Privacy", body: "Camera frames are processed in-memory and never stored on our servers. Session scores and metadata are stored per our Privacy Policy. You retain ownership of your data and may export or delete it at any time." },
        { heading: "6. Billing", body: "Subscriptions are billed monthly or annually. Overages are charged at metered rates shown in the Billing dashboard. Refunds are at our discretion within 14 days of charge." },
        { heading: "7. Uptime & SLA", body: "We target 99.9% monthly uptime for Enterprise plans. Credits are issued for downtime exceeding 0.1% in a calendar month, up to one month's base fee." },
        { heading: "8. IP Rights", body: "PostureAI owns all IP in the Service. We grant you a limited, non-exclusive licence to use the Service per your plan. Nothing here transfers ownership of our models or code." },
        { heading: "9. Limitation of Liability", body: "To the maximum extent permitted by law, PostureAI is not liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the fees paid in the 3 months preceding the claim." },
        { heading: "10. Governing Law", body: "These Terms are governed by the laws of England and Wales. Disputes shall be resolved in the courts of London, UK." },
        { heading: "11. Changes", body: "We may update these Terms with 30 days' notice. Continued use after the effective date constitutes acceptance." },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "2026-06-01",
      sections: [
        { heading: "1. Data We Collect", body: "Email, name, company (on signup). Session metadata: posture scores, timestamps, device type. Usage analytics: page views, feature clicks. Payment info: handled by Stripe — we never store card numbers." },
        { heading: "2. Camera & Biometric Data", body: "Video frames are processed locally in your browser using MediaPipe. Raw frames are never transmitted to our servers. Only the derived score (a number 0-100) and anonymised keypoint coordinates are sent." },
        { heading: "3. How We Use Data", body: "To provide the Service; improve AI models (aggregate only, never individual frames); send reports and alerts you configure; process billing; comply with legal obligations." },
        { heading: "4. Data Sharing", body: "We share data with: Stripe (payments), SendGrid (email), Sentry (error logs), Google Firebase (database), and your employer if you use an enterprise plan. We never sell personal data." },
        { heading: "5. Data Retention", body: "Session data: 2 years. Audit logs: 7 years. AI frames: never stored. Payment records: 10 years (legal requirement). You may request deletion at any time." },
        { heading: "6. Your Rights (GDPR)", body: "Right to access, rectify, erase, restrict, portability, and object. Submit requests to privacy@postureai.com. We respond within 30 days." },
        { heading: "7. CCPA Rights", body: "California residents may opt out of sale of personal information (we don't sell), request disclosure, and request deletion. Email privacy@postureai.com." },
        { heading: "8. Cookies", body: "We use necessary cookies (session), analytics cookies (with consent), and no third-party advertising cookies. Manage preferences via the cookie banner." },
        { heading: "9. Security", body: "Data is encrypted in transit (TLS 1.3) and at rest (AES-256). Access is restricted by RBAC. We hold SOC 2 Type II and ISO 27001 certifications." },
        { heading: "10. Contact", body: "Data Controller: PostureAI Ltd, London, UK. DPO: dpo@postureai.com. Privacy team: privacy@postureai.com." },
      ],
    },
    dpa: {
      title: "Data Processing Agreement",
      lastUpdated: "2026-06-01",
      sections: [
        { heading: "1. Parties", body: "This DPA is between PostureAI Ltd ('Processor') and the Customer ('Controller'). It supplements the main Terms of Service." },
        { heading: "2. Subject Matter", body: "PostureAI processes personal data on behalf of the Customer solely to provide the Service described in the Terms of Service." },
        { heading: "3. Categories of Data", body: "Employee names and emails; posture session scores; usage metadata. Special category data (health-related scores) is processed under Article 9(2)(b) GDPR (employment context)." },
        { heading: "4. Customer Obligations", body: "The Customer warrants it has lawful basis to provide employee data; has informed employees of processing; has obtained necessary consents where required." },
        { heading: "5. PostureAI Obligations", body: "Process data only on documented Customer instructions; ensure personnel are bound by confidentiality; implement Article 32 security measures; assist with DSAR requests within 5 business days." },
        { heading: "6. Sub-processors", body: "Current sub-processors: Google Firebase (Ireland), Stripe (Ireland), SendGrid (USA — SCCs in place), Sentry (USA — SCCs in place). 30 days' notice given for changes." },
        { heading: "7. International Transfers", body: "Transfers outside the EEA are protected by Standard Contractual Clauses (2021/914/EU). Data is primarily stored in EU-West (Ireland)." },
        { heading: "8. Data Breach", body: "PostureAI will notify the Customer within 72 hours of becoming aware of a personal data breach, with information per Article 33(3) GDPR." },
        { heading: "9. Deletion", body: "On termination, PostureAI will delete or return all personal data within 30 days, unless retention is required by law." },
        { heading: "10. Audit", body: "PostureAI will provide information necessary to demonstrate compliance and allow Customer audits (or third-party auditor) with 30 days' notice, at Customer's cost." },
      ],
    },
  };

  const content = docs[doc];
  if (!content) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: cs?.card || "#1e293b", borderRadius: 20, width: "100%", maxWidth: 760, height: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: cs?.text || "#fff" }}>{content.title}</div>
            <div style={{ fontSize: 12, color: cs?.textDim || "#94a3b8", marginTop: 3 }}>Last updated: {content.lastUpdated} · PostureAI Ltd</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => window.print?.()} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: cs?.textDim || "#94a3b8", borderRadius: 9, padding: "7px 14px", cursor: "pointer", fontSize: 12 }}>🖨 Print</button>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: cs?.text || "#fff", borderRadius: 9, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          {content.sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 22 }}>
              <div style={{ fontWeight: 700, color: cs?.text || "#fff", fontSize: 14, marginBottom: 6 }}>{s.heading}</div>
              <p style={{ fontSize: 13, color: cs?.textDim || "#94a3b8", lineHeight: 1.7, margin: 0 }}>{s.body}</p>
            </div>
          ))}
          <div style={{ marginTop: 32, padding: 16, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, fontSize: 12, color: cs?.textDim || "#94a3b8", lineHeight: 1.6 }}>
            Questions? Contact <a href="mailto:legal@postureai.com" style={{ color: "#6366f1" }}>legal@postureai.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Footer links that open legal modals ────────────────────────
export function LegalFooter({ cs }) {
  const [open, setOpen] = useState(null);
  return (
    <>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", padding: "12px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        {[["tos","Terms of Service"],["privacy","Privacy Policy"],["dpa","DPA"]].map(([k,l]) => (
          <button key={k} onClick={() => setOpen(k)} style={{ background: "none", border: "none", color: cs?.textDim || "#94a3b8", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>{l}</button>
        ))}
        <a href="mailto:privacy@postureai.com" style={{ color: cs?.textDim || "#94a3b8", fontSize: 11, textDecoration: "underline" }}>Privacy Requests</a>
      </div>
      {open && <LegalModal doc={open} cs={cs} onClose={() => setOpen(null)} />}
    </>
  );
}
