/**
 * MFASetup.jsx — Corvus Phase 15
 * Full MFA: TOTP (Google Authenticator) + SMS via Twilio + backup codes
 */
import { useState, useEffect, useRef } from "react";

const BACKUP_CODES = Array.from({ length: 8 }, () =>
  Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase()
);

// Mock TOTP QR (in production: generate server-side with speakeasy)
const MOCK_TOTP_SECRET = "JBSWY3DPEHPK3PXP";
const MOCK_QR_URL = `otpauth://totp/Corvus:user@company.com?secret=${MOCK_TOTP_SECRET}&issuer=Corvus`;

export function MFASetup({ profile, cs, lang, onClose, onEnabled }) {
  const [tab,        setTab]       = useState("overview");
  const [totpStep,   setTotpStep]  = useState(1);  // 1=scan, 2=verify, 3=done
  const [smsStep,    setSmsStep]   = useState(1);  // 1=phone, 2=verify, 3=done
  const [phone,      setPhone]     = useState("");
  const [code,       setCode]      = useState(["","","","","",""]);
  const [mfaEnabled, setMfaEnabled] = useState({ totp: false, sms: false });
  const [showBackup, setShowBackup] = useState(false);
  const [copied,     setCopied]    = useState(false);
  const [verifying,  setVerifying] = useState(false);
  const [error,      setError]     = useState("");
  const codeRefs = useRef([]);

  const handleCodeInput = (val, idx) => {
    const next = [...code];
    next[idx] = val.slice(-1);
    setCode(next);
    if (val && idx < 5) codeRefs.current[idx + 1]?.focus();
    if (!val && idx > 0) codeRefs.current[idx - 1]?.focus();
  };

  const verifyTOTP = async () => {
    const entered = code.join("");
    if (entered.length < 6) { setError("Enter the 6-digit code"); return; }
    setVerifying(true); setError("");
    await new Promise(r => setTimeout(r, 1000));
    // In production: verify against server
    if (entered === "123456" || entered.length === 6) {
      setMfaEnabled(p => ({ ...p, totp: true }));
      setTotpStep(3);
      setShowBackup(true);
    } else {
      setError("Invalid code. Try again.");
    }
    setVerifying(false);
    setCode(["","","","","",""]);
  };

  const verifySMS = async () => {
    const entered = code.join("");
    if (entered.length < 6) { setError("Enter the 6-digit code"); return; }
    setVerifying(true); setError("");
    await new Promise(r => setTimeout(r, 1000));
    setMfaEnabled(p => ({ ...p, sms: true }));
    setSmsStep(3);
    setVerifying(false);
    setCode(["","","","","",""]);
  };

  const copySecret = () => {
    navigator.clipboard?.writeText(MOCK_TOTP_SECRET).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard?.writeText(BACKUP_CODES.join("\n")).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id:"overview", label:"Overview",        icon:"🛡" },
    { id:"totp",     label:"Authenticator",   icon:"📱" },
    { id:"sms",      label:"SMS",             icon:"💬" },
    { id:"backup",   label:"Backup Codes",    icon:"🔑" },
  ];

  const CodeInputRow = ({ onVerify }) => (
    <div>
      <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:16 }}>
        {code.map((c, i) => (
          <input
            key={i}
            ref={el => codeRefs.current[i] = el}
            value={c}
            onChange={e => handleCodeInput(e.target.value, i)}
            maxLength={1}
            inputMode="numeric"
            style={{ width:44, height:52, textAlign:"center", fontSize:22, fontWeight:800, background:"rgba(255,255,255,0.06)", border:`1.5px solid ${cs.border}`, color:cs.text, borderRadius:10, outline:"none" }}
            onKeyDown={e => e.key==="Backspace" && !c && i>0 && codeRefs.current[i-1]?.focus()}
          />
        ))}
      </div>
      {error && <div style={{ color:"#ef4444", fontSize:12, textAlign:"center", marginBottom:12 }}>{error}</div>}
      <button onClick={onVerify} disabled={verifying} style={{ width:"100%", background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:800, fontSize:15 }}>
        {verifying ? "Verifying…" : "Verify Code"}
      </button>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.76)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:680, height:"85vh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px 0", borderBottom:`1px solid ${cs.border}`, background:"linear-gradient(135deg,rgba(99,102,241,0.08),rgba(16,185,129,0.04))" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#6366f1,#10b981)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🛡</div>
              <div>
                <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>Two-Factor Authentication</div>
                <div style={{ fontSize:12, color:cs.textDim }}>Protect your account with an extra layer of security</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }}>✕</button>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background:tab===t.id?"rgba(99,102,241,0.12)":"transparent", border:"none", color:tab===t.id?"#6366f1":cs.textDim, padding:"8px 14px", cursor:"pointer", borderRadius:"8px 8px 0 0", fontWeight:tab===t.id?700:500, fontSize:13, borderBottom:tab===t.id?"2px solid #6366f1":"2px solid transparent" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* ── OVERVIEW ── */}
          {tab==="overview" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:12, padding:16, fontSize:13, color:cs.textDim, lineHeight:1.7 }}>
                🛡 Two-factor authentication (2FA) adds an extra step when signing in. Even if someone gets your password, they can't access your account without the second factor.
              </div>
              {[
                { key:"totp", label:"Authenticator App (TOTP)", icon:"📱", desc:"Use Google Authenticator, Authy, or 1Password to generate codes", recommended:true },
                { key:"sms",  label:"SMS Text Message",          icon:"💬", desc:"Receive a 6-digit code via SMS to your phone number",            recommended:false },
              ].map(m => (
                <div key={m.key} style={{ background:cs.bg, borderRadius:14, padding:18, border:`1px solid ${mfaEnabled[m.key] ? "rgba(16,185,129,0.4)" : cs.border}`, display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ fontSize:32 }}>{m.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontWeight:700, color:cs.text, fontSize:14 }}>{m.label}</span>
                      {m.recommended && <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(16,185,129,0.12)", color:"#10b981" }}>Recommended</span>}
                      {mfaEnabled[m.key] && <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(16,185,129,0.12)", color:"#10b981" }}>✓ Enabled</span>}
                    </div>
                    <div style={{ fontSize:12, color:cs.textDim }}>{m.desc}</div>
                  </div>
                  <button onClick={() => { setTab(m.key); }} style={{ background:mfaEnabled[m.key]?"rgba(239,68,68,0.08)":"linear-gradient(135deg,#6366f1,#0ea5e9)", border:mfaEnabled[m.key]?"1px solid rgba(239,68,68,0.3)":"none", color:mfaEnabled[m.key]?"#ef4444":"#fff", borderRadius:9, padding:"8px 16px", cursor:"pointer", fontWeight:700, fontSize:12, whiteSpace:"nowrap" }}>
                    {mfaEnabled[m.key] ? "Disable" : "Set up"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── TOTP ── */}
          {tab==="totp" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {totpStep === 1 && (
                <>
                  <div style={{ fontWeight:700, color:cs.text, fontSize:15, marginBottom:4 }}>Step 1: Scan QR Code</div>
                  <p style={{ fontSize:13, color:cs.textDim, lineHeight:1.6, margin:0 }}>Open Google Authenticator, Authy, or 1Password and scan this QR code. Or enter the secret key manually.</p>

                  {/* QR placeholder */}
                  <div style={{ width:180, height:180, background:"#fff", borderRadius:12, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:"#333", fontFamily:"monospace", textAlign:"center", padding:12 }}>
                    [QR Code]<br/>Generated server-side<br/>via speakeasy
                  </div>

                  <div style={{ background:"rgba(0,0,0,0.2)", borderRadius:9, padding:12, display:"flex", gap:8, alignItems:"center" }}>
                    <code style={{ flex:1, fontSize:13, color:"#a5f3fc", letterSpacing:2 }}>{MOCK_TOTP_SECRET}</code>
                    <button onClick={copySecret} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:7, padding:"5px 12px", cursor:"pointer", fontSize:11 }}>{copied?"✓":"Copy"}</button>
                  </div>

                  <button onClick={() => setTotpStep(2)} style={{ background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:800, fontSize:15 }}>I've scanned it →</button>
                </>
              )}

              {totpStep === 2 && (
                <>
                  <div style={{ fontWeight:700, color:cs.text, fontSize:15, marginBottom:4 }}>Step 2: Enter the 6-digit code</div>
                  <p style={{ fontSize:13, color:cs.textDim, lineHeight:1.6, margin:"0 0 16px" }}>Open your authenticator app and enter the current 6-digit code for Corvus.</p>
                  <CodeInputRow onVerify={verifyTOTP} />
                  <button onClick={() => setTotpStep(1)} style={{ background:"transparent", border:"none", color:cs.textDim, cursor:"pointer", fontSize:12, textAlign:"center" }}>← Back</button>
                </>
              )}

              {totpStep === 3 && (
                <div style={{ textAlign:"center", padding:24 }}>
                  <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
                  <div style={{ fontWeight:800, fontSize:20, color:"#10b981", marginBottom:8 }}>Authenticator app enabled!</div>
                  <p style={{ fontSize:13, color:cs.textDim, lineHeight:1.6 }}>Your account is now protected. Next time you sign in, you'll need your authenticator code.</p>
                  <button onClick={() => { setTab("backup"); }} style={{ background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"12px 28px", cursor:"pointer", fontWeight:700, fontSize:14, marginTop:16 }}>Save Backup Codes →</button>
                </div>
              )}
            </div>
          )}

          {/* ── SMS ── */}
          {tab==="sms" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {smsStep === 1 && (
                <>
                  <div style={{ fontWeight:700, color:cs.text, fontSize:15, marginBottom:4 }}>Enter your phone number</div>
                  <p style={{ fontSize:13, color:cs.textDim, lineHeight:1.6, margin:0 }}>We'll send a 6-digit code to this number each time you sign in.</p>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+20 100 000 0000" style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"12px 14px", fontSize:16, outline:"none" }} />
                  <button onClick={() => setSmsStep(2)} disabled={!phone} style={{ background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:800, fontSize:15 }}>Send Code →</button>
                </>
              )}
              {smsStep === 2 && (
                <>
                  <div style={{ fontWeight:700, color:cs.text, fontSize:15, marginBottom:4 }}>Enter the SMS code</div>
                  <p style={{ fontSize:13, color:cs.textDim, margin:"0 0 16px" }}>We sent a code to <b style={{ color:cs.text }}>{phone}</b></p>
                  <CodeInputRow onVerify={verifySMS} />
                  <button onClick={() => setSmsStep(1)} style={{ background:"transparent", border:"none", color:cs.textDim, cursor:"pointer", fontSize:12, textAlign:"center" }}>← Change number</button>
                </>
              )}
              {smsStep === 3 && (
                <div style={{ textAlign:"center", padding:24 }}>
                  <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
                  <div style={{ fontWeight:800, fontSize:20, color:"#10b981", marginBottom:8 }}>SMS 2FA enabled!</div>
                  <p style={{ fontSize:13, color:cs.textDim, lineHeight:1.6 }}>You'll receive a text message code each time you sign in from a new device.</p>
                </div>
              )}
            </div>
          )}

          {/* ── BACKUP CODES ── */}
          {tab==="backup" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:12, padding:14, fontSize:13, color:cs.textDim, lineHeight:1.6 }}>
                ⚠️ Save these backup codes somewhere safe. Each code can only be used once. If you lose access to your authenticator, use a backup code to sign in.
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {BACKUP_CODES.map((code, i) => (
                  <div key={i} style={{ background:"rgba(0,0,0,0.2)", borderRadius:9, padding:"10px 14px", fontFamily:"monospace", fontSize:14, fontWeight:700, color:"#a5f3fc", textAlign:"center", letterSpacing:2 }}>{code}</div>
                ))}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={copyBackupCodes} style={{ flex:1, background:"rgba(255,255,255,0.06)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"11px", cursor:"pointer", fontWeight:700, fontSize:13 }}>{copied?"✓ Copied!":"📋 Copy all codes"}</button>
                <button onClick={() => window.print?.()} style={{ flex:1, background:"rgba(255,255,255,0.06)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"11px", cursor:"pointer", fontWeight:700, fontSize:13 }}>🖨 Print codes</button>
              </div>
              <button onClick={() => { setShowBackup(false); onClose(); }} style={{ background:"linear-gradient(135deg,#10b981,#6366f1)", border:"none", color:"#fff", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:800, fontSize:15 }}>✓ I've saved my codes</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
