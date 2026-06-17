/**
 * WhiteLabel.jsx — Corvus Phase 12
 * Complete white-label configuration: branding, domain, colors, emails, login page
 */
import { useState, useRef } from "react";

const DEFAULT_CONFIG = {
  companyName: "Corvus",
  tagline: "Smart Posture Intelligence",
  primaryColor: "#6366f1",
  accentColor: "#0ea5e9",
  bgColor: "#0f172a",
  logoUrl: "",
  faviconUrl: "",
  customDomain: "",
  supportEmail: "support@corvus.com",
  privacyUrl: "",
  termsUrl: "",
  hideCorvusBranding: false,
  customLoginBg: "",
  emailFromName: "Corvus",
  emailFromAddress: "noreply@corvus.com",
  footerText: "© 2026 Corvus. All rights reserved.",
  welcomeMessage: "Welcome to your posture dashboard",
  loginBtnText: "Sign in with Google",
  fontFamily: "Inter",
  borderRadius: "12",
  showPoweredBy: true,
};

const FONT_OPTIONS = ["Inter","Poppins","Roboto","Nunito","DM Sans","Plus Jakarta Sans"];
const PRESET_THEMES = [
  { name:"Ocean",    primary:"#0ea5e9", accent:"#6366f1", bg:"#0a1628" },
  { name:"Forest",   primary:"#10b981", accent:"#f59e0b", bg:"#071a13" },
  { name:"Sunset",   primary:"#f59e0b", accent:"#ef4444", bg:"#1a0e07" },
  { name:"Lavender", primary:"#8b5cf6", accent:"#ec4899", bg:"#120a1a" },
  { name:"Midnight", primary:"#64748b", accent:"#94a3b8", bg:"#0a0a0f" },
  { name:"Rose",     primary:"#f43f5e", accent:"#fb923c", bg:"#1a070e" },
];

export function WhiteLabel({ profile, cs, lang, onClose }) {
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG, companyName: profile?.company || "Corvus" });
  const [tab, setTab] = useState("branding");
  const [saved, setSaved] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const logoRef = useRef();
  const faviconRef = useRef();

  const set = (k, v) => setConfig(p => ({ ...p, [k]: v }));

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const applyPreset = (t) => {
    setConfig(p => ({ ...p, primaryColor: t.primary, accentColor: t.accent, bgColor: t.bg }));
  };

  const tabs = [
    { id: "branding", label: "Branding", icon: "🎨" },
    { id: "domain",   label: "Domain",   icon: "🌐" },
    { id: "login",    label: "Login Page",icon: "🔐" },
    { id: "emails",   label: "Emails",   icon: "📧" },
    { id: "advanced", label: "Advanced", icon: "⚙️" },
  ];

  const InputRow = ({ label, value, onChange, placeholder, type="text", hint }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: cs.textDim, display: "block", marginBottom: 5 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${cs.border}`, color: cs.text, borderRadius: 9, padding: "9px 13px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
      />
      {hint && <div style={{ fontSize: 11, color: cs.textDim, marginTop: 4 }}>{hint}</div>}
    </div>
  );

  const Toggle = ({ label, value, onChange, hint }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${cs.border}` }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: cs.text }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: cs.textDim, marginTop: 2 }}>{hint}</div>}
      </div>
      <div onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, background: value ? config.primaryColor : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 3, left: value ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: cs.card, borderRadius: 20, width: "100%", maxWidth: 1060, height: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", border: `1px solid ${cs.border}`, boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding: "20px 28px 0", borderBottom: `1px solid ${cs.border}`, background: `linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.05))` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#8b5cf6,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏷️</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 20, color: cs.text }}>White-Label Configuration</div>
                <div style={{ fontSize: 12, color: cs.textDim }}>Fully rebrand Corvus for your clients</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPreviewMode(p => !p)} style={{ background: previewMode ? "rgba(139,92,246,0.15)" : "transparent", border: `1px solid ${previewMode ? "#8b5cf6" : cs.border}`, color: previewMode ? "#8b5cf6" : cs.text, borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {previewMode ? "✓ Preview On" : "👁 Preview"}
              </button>
              <button onClick={save} style={{ background: saved ? "#10b981" : "linear-gradient(135deg,#8b5cf6,#ec4899)", border: "none", color: "#fff", borderRadius: 10, padding: "8px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "background .3s" }}>
                {saved ? "✓ Saved!" : "Save Changes"}
              </button>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.07)", border: `1px solid ${cs.border}`, color: cs.text, borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background: tab === t.id ? "rgba(139,92,246,0.15)" : "transparent", border: "none", color: tab === t.id ? "#8b5cf6" : cs.textDim, padding: "8px 14px", cursor: "pointer", borderRadius: "8px 8px 0 0", fontWeight: tab === t.id ? 700 : 500, fontSize: 13, borderBottom: tab === t.id ? "2px solid #8b5cf6" : "2px solid transparent" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body — split: form + live preview */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Form side */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

            {/* ── BRANDING ── */}
            {tab === "branding" && (
              <div>
                <InputRow label="Company / Brand Name" value={config.companyName} onChange={v => set("companyName", v)} placeholder="Acme Corp" />
                <InputRow label="Tagline" value={config.tagline} onChange={v => set("tagline", v)} placeholder="Your brand tagline" />

                {/* Logo upload */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: cs.textDim, display: "block", marginBottom: 5 }}>Logo</label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, background: "rgba(255,255,255,0.07)", border: `1px dashed ${cs.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: config.logoUrl ? 28 : 22, overflow: "hidden" }}>
                      {config.logoUrl ? <img src={config.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : "🖼"}
                    </div>
                    <div>
                      <button onClick={() => logoRef.current?.click()} style={{ background: "transparent", border: `1px solid ${cs.border}`, color: cs.text, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, display: "block", marginBottom: 5 }}>Upload Logo</button>
                      <InputRow label="" value={config.logoUrl} onChange={v => set("logoUrl", v)} placeholder="or paste URL" />
                    </div>
                  </div>
                </div>

                {/* Color pickers */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: cs.textDim, display: "block", marginBottom: 8 }}>Brand Colors</label>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {[["Primary", "primaryColor"], ["Accent", "accentColor"], ["Background", "bgColor"]].map(([lbl, k]) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="color" value={config[k]} onChange={e => set(k, e.target.value)} style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", background: "none" }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: cs.text }}>{lbl}</div>
                          <div style={{ fontSize: 11, color: cs.textDim, fontFamily: "monospace" }}>{config[k]}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preset themes */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: cs.textDim, display: "block", marginBottom: 8 }}>Quick Theme Presets</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {PRESET_THEMES.map(t => (
                      <button key={t.name} onClick={() => applyPreset(t)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: `1px solid ${cs.border}`, color: cs.text, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", background: t.primary }} />
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: cs.textDim, display: "block", marginBottom: 5 }}>Font Family</label>
                  <select value={config.fontFamily} onChange={e => set("fontFamily", e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${cs.border}`, color: cs.text, borderRadius: 9, padding: "9px 13px", fontSize: 13, outline: "none" }}>
                    {FONT_OPTIONS.map(f => <option key={f} value={f} style={{ background: "#1e293b" }}>{f}</option>)}
                  </select>
                </div>

                {/* Border radius */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: cs.textDim, display: "block", marginBottom: 5 }}>Border Radius — {config.borderRadius}px</label>
                  <input type="range" min={0} max={24} value={config.borderRadius} onChange={e => set("borderRadius", e.target.value)} style={{ width: "100%" }} />
                </div>

                <Toggle label="Hide 'Powered by Corvus'" hint="Remove all Corvus branding from the UI" value={config.hideCorvusBranding} onChange={v => set("hideCorvusBranding", v)} />
                <Toggle label="Show 'Powered by' footer link" hint="Show a small link in the footer" value={config.showPoweredBy} onChange={v => set("showPoweredBy", v)} />

                <InputRow label="Footer Text" value={config.footerText} onChange={v => set("footerText", v)} placeholder="© 2026 Your Company" />
              </div>
            )}

            {/* ── DOMAIN ── */}
            {tab === "domain" && (
              <div>
                <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 12, padding: 14, marginBottom: 20, fontSize: 13, color: cs.textDim, lineHeight: 1.6 }}>
                  ℹ️ To use a custom domain, add a <b style={{ color: cs.text }}>CNAME record</b> pointing to <code style={{ color: "#a5f3fc" }}>whitelabel.corvus.com</code> from your DNS provider. SSL is provisioned automatically.
                </div>
                <InputRow label="Custom Domain" value={config.customDomain} onChange={v => set("customDomain", v)} placeholder="app.yourcompany.com" hint="e.g. app.acme.com — must have CNAME to whitelabel.corvus.com" />
                <InputRow label="Support Email" value={config.supportEmail} onChange={v => set("supportEmail", v)} placeholder="support@yourcompany.com" />
                <InputRow label="Privacy Policy URL" value={config.privacyUrl} onChange={v => set("privacyUrl", v)} placeholder="https://yourcompany.com/privacy" />
                <InputRow label="Terms of Service URL" value={config.termsUrl} onChange={v => set("termsUrl", v)} placeholder="https://yourcompany.com/terms" />

                {/* DNS status checker */}
                <div style={{ background: cs.bg, borderRadius: 12, padding: 16, border: `1px solid ${cs.border}`, marginTop: 8 }}>
                  <div style={{ fontWeight: 700, color: cs.text, marginBottom: 12, fontSize: 13 }}>DNS Status</div>
                  {[
                    { record: "CNAME", host: config.customDomain || "app.yourcompany.com", value: "whitelabel.corvus.com", status: config.customDomain ? "pending" : "not_set" },
                    { record: "SSL",   host: config.customDomain || "—", value: "Auto-provisioned", status: config.customDomain ? "provisioning" : "not_set" },
                  ].map(r => (
                    <div key={r.record} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${cs.border}` }}>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: "#a5f3fc", width: 48 }}>{r.record}</span>
                      <span style={{ flex: 1, fontSize: 12, color: cs.textDim, fontFamily: "monospace" }}>{r.host}</span>
                      <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: r.status === "active" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)", color: r.status === "active" ? "#10b981" : "#f59e0b", fontWeight: 600 }}>
                        {r.status === "active" ? "✓ Active" : r.status === "pending" ? "⏳ Pending" : r.status === "provisioning" ? "⏳ Provisioning" : "— Not set"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── LOGIN PAGE ── */}
            {tab === "login" && (
              <div>
                <InputRow label="Welcome Message" value={config.welcomeMessage} onChange={v => set("welcomeMessage", v)} placeholder="Welcome to your posture dashboard" />
                <InputRow label="Login Button Text" value={config.loginBtnText} onChange={v => set("loginBtnText", v)} placeholder="Sign in with Google" />
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: cs.textDim, display: "block", marginBottom: 5 }}>Login Page Background</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input type="color" value={config.bgColor} onChange={e => set("bgColor", e.target.value)} style={{ width: 42, height: 42, borderRadius: 8, border: "none", cursor: "pointer" }} />
                    <input value={config.customLoginBg} onChange={e => set("customLoginBg", e.target.value)} placeholder="Or background image URL" style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid ${cs.border}`, color: cs.text, borderRadius: 9, padding: "9px 13px", fontSize: 13, outline: "none" }} />
                  </div>
                </div>

                {/* SSO options */}
                <div style={{ background: cs.bg, borderRadius: 12, padding: 16, border: `1px solid ${cs.border}`, marginTop: 8 }}>
                  <div style={{ fontWeight: 700, color: cs.text, marginBottom: 12, fontSize: 13 }}>Login Methods</div>
                  {["Google SSO", "Microsoft SSO", "SAML 2.0", "Email / Password", "Magic Link"].map(m => (
                    <Toggle key={m} label={m} value={["Google SSO", "Email / Password"].includes(m)} onChange={() => {}} />
                  ))}
                </div>
              </div>
            )}

            {/* ── EMAILS ── */}
            {tab === "emails" && (
              <div>
                <InputRow label="From Name" value={config.emailFromName} onChange={v => set("emailFromName", v)} placeholder="Corvus" />
                <InputRow label="From Address" value={config.emailFromAddress} onChange={v => set("emailFromAddress", v)} placeholder="noreply@yourcompany.com" hint="Must be verified in your SMTP settings" type="email" />

                <div style={{ background: cs.bg, borderRadius: 12, padding: 16, border: `1px solid ${cs.border}`, marginTop: 8 }}>
                  <div style={{ fontWeight: 700, color: cs.text, marginBottom: 12, fontSize: 13 }}>Email Templates</div>
                  {["Welcome Email", "Weekly Report", "Alert Notification", "Invoice", "Password Reset", "Invite Team Member"].map(t => (
                    <div key={t} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${cs.border}` }}>
                      <span style={{ fontSize: 13, color: cs.text }}>📧 {t}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={{ background: "transparent", border: `1px solid ${cs.border}`, color: cs.textDim, borderRadius: 7, padding: "4px 11px", cursor: "pointer", fontSize: 11 }}>Preview</button>
                        <button style={{ background: "transparent", border: `1px solid ${cs.border}`, color: "#8b5cf6", borderRadius: 7, padding: "4px 11px", cursor: "pointer", fontSize: 11 }}>Edit</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, background: cs.bg, borderRadius: 12, padding: 16, border: `1px solid ${cs.border}` }}>
                  <div style={{ fontWeight: 700, color: cs.text, marginBottom: 10, fontSize: 13 }}>SMTP Configuration</div>
                  <InputRow label="SMTP Host" value="" onChange={() => {}} placeholder="smtp.yourcompany.com" />
                  <InputRow label="SMTP Port" value="" onChange={() => {}} placeholder="587" />
                  <InputRow label="SMTP Username" value="" onChange={() => {}} placeholder="apikey" />
                  <InputRow label="SMTP Password" value="" onChange={() => {}} placeholder="••••••••••" type="password" />
                  <button style={{ background: "linear-gradient(135deg,#8b5cf6,#ec4899)", border: "none", color: "#fff", borderRadius: 9, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Test Connection</button>
                </div>
              </div>
            )}

            {/* ── ADVANCED ── */}
            {tab === "advanced" && (
              <div>
                <div style={{ background: cs.bg, borderRadius: 12, padding: 16, border: `1px solid ${cs.border}`, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: cs.text, marginBottom: 12, fontSize: 13 }}>Feature Visibility</div>
                  {[
                    ["AI Coaching panel", true],
                    ["Gamification & Leaderboard", true],
                    ["Billing Dashboard", true],
                    ["Team Invites", true],
                    ["Export CSV/PDF", true],
                    ["API Marketplace", false],
                  ].map(([label, on]) => (
                    <Toggle key={label} label={label} value={on} onChange={() => {}} />
                  ))}
                </div>

                <div style={{ background: cs.bg, borderRadius: 12, padding: 16, border: `1px solid ${cs.border}`, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: cs.text, marginBottom: 12, fontSize: 13 }}>Custom CSS / JS</div>
                  <label style={{ fontSize: 12, color: cs.textDim, display: "block", marginBottom: 5 }}>Custom CSS injection</label>
                  <textarea rows={5} placeholder=":root { --brand: #ff0066; } .sidebar { display: none; }" style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: `1px solid ${cs.border}`, color: "#a5f3fc", borderRadius: 9, padding: "10px 13px", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                  <label style={{ fontSize: 12, color: cs.textDim, display: "block", margin: "10px 0 5px" }}>Custom JS (head)</label>
                  <textarea rows={3} placeholder="window.analytics.init('UA-XXXXX')" style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: `1px solid ${cs.border}`, color: "#fde68a", borderRadius: 9, padding: "10px 13px", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                </div>

                <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 700, color: "#ef4444", marginBottom: 10, fontSize: 13 }}>⚠️ Danger Zone</div>
                  <button style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 9, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Reset to Default Branding</button>
                </div>
              </div>
            )}
          </div>

          {/* ── LIVE PREVIEW ── */}
          <div style={{ width: 340, borderLeft: `1px solid ${cs.border}`, padding: 20, overflowY: "auto", background: "rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: cs.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Live Preview</div>

            {/* Mini login preview */}
            <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${cs.border}`, marginBottom: 14 }}>
              <div style={{ background: config.bgColor, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: config.primaryColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {config.logoUrl ? <img src={config.logoUrl} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} /> : "💡"}
                </div>
                <div style={{ fontFamily: config.fontFamily, fontWeight: 800, fontSize: 16, color: "#fff", textAlign: "center" }}>{config.companyName}</div>
                <div style={{ fontFamily: config.fontFamily, fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>{config.tagline}</div>
                <div style={{ fontFamily: config.fontFamily, fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>{config.welcomeMessage}</div>
                <button style={{ fontFamily: config.fontFamily, background: config.primaryColor, border: "none", color: "#fff", borderRadius: parseInt(config.borderRadius), padding: "10px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13, width: "100%" }}>{config.loginBtnText}</button>
                {config.showPoweredBy && !config.hideCorvusBranding && (
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: config.fontFamily }}>Powered by Corvus</div>
                )}
              </div>
            </div>

            {/* Mini dashboard preview */}
            <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${cs.border}` }}>
              <div style={{ background: config.bgColor, padding: 14 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, background: config.primaryColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>💡</div>
                  <div style={{ fontFamily: config.fontFamily, fontSize: 11, fontWeight: 700, color: "#fff" }}>{config.companyName}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {["Score", "Sessions", "Streak", "Rank"].map((m, i) => (
                    <div key={m} style={{ background: "rgba(255,255,255,0.05)", borderRadius: parseInt(config.borderRadius) * 0.6, padding: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: i === 0 ? config.primaryColor : i === 1 ? config.accentColor : "#fff", fontFamily: config.fontFamily }}>{["84", "12", "7d", "#3"][i]}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: config.fontFamily }}>{m}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,0.25)", fontFamily: config.fontFamily, textAlign: "center" }}>
                  {!config.hideCorvusBranding && config.showPoweredBy ? "Powered by Corvus" : config.footerText}
                </div>
              </div>
            </div>

            {/* Color swatch */}
            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              {[config.primaryColor, config.accentColor, config.bgColor].map((c, i) => (
                <div key={i} style={{ flex: 1, height: 32, borderRadius: 8, background: c, border: `1px solid ${cs.border}`, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4 }}>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.7)", fontFamily: "monospace" }}>{c}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14, fontSize: 11, color: cs.textDim, lineHeight: 1.6 }}>
              Font: <b style={{ color: cs.text }}>{config.fontFamily}</b><br />
              Radius: <b style={{ color: cs.text }}>{config.borderRadius}px</b><br />
              Domain: <b style={{ color: config.customDomain ? "#10b981" : cs.textDim }}>{config.customDomain || "Not configured"}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
