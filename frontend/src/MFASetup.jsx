/**
 * MFASetup.jsx — Corvus
 * Real MFA: TOTP (Google Authenticator) + SMS via Twilio + backup codes
 *
 * Wired to the real backend 2026-07-24. Previously this whole screen was
 * fake: a single hardcoded TOTP secret shared by every user, any 6-digit
 * code accepted as "valid," and mfaEnabled living only in local React
 * state — never saved anywhere, never checked at sign-in. A user could
 * walk through the whole flow, see "✅ enabled," and be completely
 * unprotected. The backend (backend/auth/mfa.py) already had a real,
 * complete implementation the whole time; this just connects to it.
 * A real sign-in-time challenge was also added (see App.jsx's
 * MFALoginChallenge + mfaChallengePending gate) — setup alone doesn't
 * mean anything without that.
 */
import { useState, useEffect } from "react";
import { getAuthToken } from "./firebase.js";
import { reauthenticate, getReauthMethod } from "./firebase.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";

export function MFASetup({ profile, cs, lang, onClose, onEnabled, onProfileChange }) {
  useBodyScrollLock();
  const isAr = lang === "ar";

  const mfaFetch = async (path, body = null) => {
    const tok = await getAuthToken().catch(() => "");
    const res = await fetch("/api/auth/mfa" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = Object.assign(new Error(d.error || "Request failed"), { status: res.status });
      throw err;
    }
    return d;
  };

  const [tab,        setTab]       = useState("overview");
  const [totpStep,   setTotpStep]  = useState(1);  // 1=scan, 2=verify, 3=done
  const [smsStep,    setSmsStep]   = useState(1);  // 1=phone, 2=verify, 3=done
  const [phone,      setPhone]     = useState(profile?.mfa_phone||"");
  const [code,       setCode]      = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(!!profile?.mfa_enabled);
  const [mfaMethod,  setMfaMethod]  = useState(profile?.mfa_method||"totp");
  const [secret,     setSecret]    = useState("");
  const [totpUri,    setTotpUri]   = useState("");
  const [backupCodes,setBackupCodes] = useState([]);
  const [copied,     setCopied]    = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [verifying,  setVerifying] = useState(false);
  const [error,      setError]     = useState("");
  const [smsUnavailable, setSmsUnavailable] = useState(false);

  const startTotpSetup = async () => {
    setLoadingSetup(true); setError("");
    try {
      const r = await mfaFetch("/totp/setup");
      setSecret(r.secret); setTotpUri(r.uri);
      setTotpStep(1);
    } catch(e) { setError(e?.message || (isAr?"تعذر بدء الإعداد":"Couldn't start setup")); }
    setLoadingSetup(false);
  };

  useEffect(() => { if (tab==="totp" && !mfaEnabled && !secret) startTotpSetup(); /* eslint-disable-line */ }, [tab]);

  const verifyTOTP = async () => {
    if (code.trim().length < 6) { setError(isAr?"أدخل الكود من 6 أرقام":"Enter the 6-digit code"); return; }
    setVerifying(true); setError("");
    try {
      const r = await mfaFetch("/totp/verify", { code: code.trim() });
      setMfaEnabled(true); setMfaMethod("totp");
      setBackupCodes(r.backup_codes||[]);
      setTotpStep(3);
      onProfileChange?.({ mfa_enabled:true, mfa_method:"totp" });
    } catch(e) { setError(e?.message || (isAr?"كود غير صحيح":"Invalid code")); }
    setVerifying(false);
    setCode("");
  };

  const sendSmsCode = async () => {
    if (!phone.trim()) return;
    setVerifying(true); setError(""); setSmsUnavailable(false);
    try {
      await mfaFetch("/sms/send", { phone: phone.trim() });
      setSmsStep(2);
    } catch(e) {
      if (e?.status === 503) setSmsUnavailable(true);
      setError(e?.message || (isAr?"تعذر إرسال الكود":"Couldn't send code"));
    }
    setVerifying(false);
  };

  const verifySMS = async () => {
    if (code.trim().length < 6) { setError(isAr?"أدخل الكود من 6 أرقام":"Enter the 6-digit code"); return; }
    setVerifying(true); setError("");
    try {
      const r = await mfaFetch("/sms/verify", { code: code.trim(), phone: phone.trim() });
      setMfaEnabled(true); setMfaMethod("sms");
      setBackupCodes(r.backup_codes||[]);
      setSmsStep(3);
      onProfileChange?.({ mfa_enabled:true, mfa_method:"sms", mfa_phone:phone.trim() });
    } catch(e) { setError(e?.message || (isAr?"كود غير صحيح":"Invalid code")); }
    setVerifying(false);
    setCode("");
  };

  const [reauthPrompt,  setReauthPrompt]  = useState(false);
  const [reauthPassword,setReauthPassword]= useState("");
  const [reauthError,   setReauthError]   = useState("");

  const finishDisable = async () => {
    setVerifying(true); setError("");
    try {
      await mfaFetch("/disable");
      setMfaEnabled(false);
      setBackupCodes([]);
      setTotpStep(1); setSmsStep(1); setSecret(""); setTotpUri("");
      onProfileChange?.({ mfa_enabled:false, mfa_method:null });
    } catch(e) {
      if (e?.status === 401 && e?.upgrade !== undefined) { /* not our case, keep generic below */ }
      setError(e?.message || (isAr?"تعذر الإلغاء":"Couldn't disable"));
    }
    setVerifying(false);
  };

  const disableMFA = () => {
    if (!window.confirm(isAr?"متأكد إنك عايز تلغي المصادقة الثنائية؟ حسابك هيبقى محمي بالباسورد بس.":"Are you sure you want to disable 2FA? Your account will only be protected by your password.")) return;
    const method = getReauthMethod();
    if (method === "password") {
      setReauthPassword(""); setReauthError(""); setReauthPrompt(true);
    } else if (method === "google" || method === "microsoft") {
      (async () => {
        setVerifying(true); setError("");
        try { await reauthenticate(); await finishDisable(); }
        catch(e) { setError(isAr?"لغيت إعادة التأكيد":"Re-authentication was cancelled"); }
        setVerifying(false);
      })();
    } else {
      setError(isAr?"سجّل خروج ورجع سجّل دخول تاني عشان تكمل":"Please sign out and back in to continue");
    }
  };

  const confirmReauthPassword = async () => {
    if (!reauthPassword) { setReauthError(isAr?"أدخل كلمة السر":"Enter your password"); return; }
    setVerifying(true); setReauthError("");
    try {
      await reauthenticate(reauthPassword);
      setReauthPrompt(false);
      await finishDisable();
    } catch(e) {
      setReauthError(isAr?"كلمة السر غير صحيحة":"Incorrect password");
    }
    setVerifying(false);
  };

  const regenerateBackupCodes = async () => {
    setVerifying(true); setError("");
    try {
      const r = await mfaFetch("/backup-codes/regenerate");
      setBackupCodes(r.backup_codes||[]);
    } catch(e) { setError(e?.message || (isAr?"تعذر إنشاء أكواد جديدة":"Couldn't regenerate codes")); }
    setVerifying(false);
  };

  const copySecret = () => {
    navigator.clipboard?.writeText(secret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyBackupCodes = () => {
    navigator.clipboard?.writeText(backupCodes.join("\n")).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id:"overview", label:isAr?"نظرة عامة":"Overview",        icon:"🛡" },
    { id:"totp",     label:isAr?"تطبيق المصادقة":"Authenticator",   icon:"📱" },
    { id:"sms",      label:"SMS",             icon:"💬" },
    { id:"backup",   label:isAr?"أكواد احتياطية":"Backup Codes",    icon:"🔑" },
  ];

  const CodeInputRow = ({ onVerify }) => (
    <div>
      <input
        value={code}
        onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,"").slice(0,6))}
        onKeyDown={e=>e.key==="Enter"&&onVerify()}
        placeholder="000000"
        maxLength={6}
        inputMode="numeric"
        style={{ width:"100%", boxSizing:"border-box", textAlign:"center", fontSize:26, letterSpacing:8, fontWeight:800, background:"rgba(255,255,255,0.06)", border:`1.5px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"14px", outline:"none", marginBottom:16 }}
        autoFocus
      />
      {error && <div style={{ color:"#ef4444", fontSize:12, textAlign:"center", marginBottom:12 }}>{error}</div>}
      <button onClick={onVerify} disabled={verifying} style={{ width:"100%", background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:800, fontSize:15 }}>
        {verifying ? (isAr?"جاري التحقق…":"Verifying…") : (isAr?"تحقق من الكود":"Verify Code")}
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
                <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>{isAr?"المصادقة الثنائية":"Two-Factor Authentication"}</div>
                <div style={{ fontSize:12, color:cs.textDim }}>{isAr?"احمِ حسابك بخطوة إضافية":"Protect your account with an extra layer of security"}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }} aria-label="Close">✕</button>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setError(""); setCode(""); }} style={{ background:tab===t.id?"rgba(99,102,241,0.12)":"transparent", border:"none", color:tab===t.id?"#6366f1":cs.textDim, padding:"8px 14px", cursor:"pointer", borderRadius:"8px 8px 0 0", fontWeight:tab===t.id?700:500, fontSize:13, borderBottom:tab===t.id?"2px solid #6366f1":"2px solid transparent" }}>
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
                🛡 {isAr?"المصادقة الثنائية بتضيف خطوة إضافية عند تسجيل الدخول. حتى لو حد عرف الباسورد، مش هيقدر يدخل من غير العامل التاني.":"Two-factor authentication (2FA) adds an extra step when signing in. Even if someone gets your password, they can't access your account without the second factor."}
              </div>
              {mfaEnabled ? (
                <div style={{ background:cs.bg, borderRadius:14, padding:18, border:"1px solid rgba(16,185,129,0.4)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontWeight:700, color:cs.text, fontSize:14, marginBottom:4 }}>✓ {isAr?"مفعّلة":"Enabled"} — {mfaMethod==="sms"?(isAr?"عبر SMS":"via SMS"):(isAr?"عبر تطبيق مصادقة":"via Authenticator App")}</div>
                      <div style={{ fontSize:12, color:cs.textDim }}>{isAr?"حسابك محمي بعامل ثاني حقيقي":"Your account is protected by a real second factor"}</div>
                    </div>
                    <button onClick={()=>disableMFA()} disabled={verifying} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444", borderRadius:9, padding:"8px 16px", cursor:"pointer", fontWeight:700, fontSize:12 }}>{isAr?"إلغاء":"Disable"}</button>
                  </div>
                </div>
              ) : (
                [
                  { key:"totp", label:isAr?"تطبيق مصادقة (TOTP)":"Authenticator App (TOTP)", icon:"📱", desc:isAr?"استخدم Google Authenticator أو Authy أو 1Password":"Use Google Authenticator, Authy, or 1Password to generate codes", recommended:true },
                  { key:"sms",  label:"SMS",          icon:"💬", desc:isAr?"استلم كود من 6 أرقام على رقمك":"Receive a 6-digit code via SMS to your phone number",            recommended:false },
                ].map(m => (
                  <div key={m.key} style={{ background:cs.bg, borderRadius:14, padding:18, border:`1px solid ${cs.border}`, display:"flex", gap:14, alignItems:"center" }}>
                    <div style={{ fontSize:32 }}>{m.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                        <span style={{ fontWeight:700, color:cs.text, fontSize:14 }}>{m.label}</span>
                        {m.recommended && <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(16,185,129,0.12)", color:"#10b981" }}>{isAr?"موصى به":"Recommended"}</span>}
                      </div>
                      <div style={{ fontSize:12, color:cs.textDim }}>{m.desc}</div>
                    </div>
                    <button onClick={() => setTab(m.key)} style={{ background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:9, padding:"8px 16px", cursor:"pointer", fontWeight:700, fontSize:12, whiteSpace:"nowrap" }}>{isAr?"إعداد":"Set up"}</button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── TOTP ── */}
          {tab==="totp" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {mfaEnabled && mfaMethod==="totp" ? (
                <div style={{ textAlign:"center", padding:24 }}>
                  <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
                  <div style={{ fontWeight:800, fontSize:20, color:"#10b981", marginBottom:8 }}>{isAr?"مفعّلة بالفعل":"Already enabled"}</div>
                  <button onClick={()=>disableMFA()} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444", borderRadius:9, padding:"10px 20px", cursor:"pointer", fontWeight:700, fontSize:13, marginTop:10 }}>{isAr?"إلغاء التفعيل":"Disable"}</button>
                </div>
              ) : totpStep === 1 && (
                <>
                  <div style={{ fontWeight:700, color:cs.text, fontSize:15, marginBottom:4 }}>{isAr?"الخطوة 1: أضف المفتاح":"Step 1: Add the key"}</div>
                  <p style={{ fontSize:13, color:cs.textDim, lineHeight:1.6, margin:0 }}>{isAr?"افتح تطبيق المصادقة → إضافة حساب → إدخال يدوي → الصق المفتاح ده":"Open your authenticator app → Add account → Enter manually → paste this key"}</p>
                  {loadingSetup ? (
                    <div style={{ textAlign:"center", padding:20, fontSize:12, color:cs.textDim }}>{isAr?"جاري التحضير…":"Preparing…"}</div>
                  ) : secret ? (
                    <div style={{ background:"rgba(0,0,0,0.2)", borderRadius:9, padding:12, display:"flex", gap:8, alignItems:"center" }}>
                      <code style={{ flex:1, fontSize:13, color:"#a5f3fc", letterSpacing:2, wordBreak:"break-all" }}>{secret}</code>
                      <button aria-label="Copy secret" onClick={copySecret} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:7, padding:"5px 12px", cursor:"pointer", fontSize:11, flexShrink:0 }}>{copied?"✓":(isAr?"نسخ":"Copy")}</button>
                    </div>
                  ) : (
                    <button onClick={startTotpSetup} style={{ background:"rgba(255,255,255,0.06)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"10px", cursor:"pointer", fontWeight:600, fontSize:13 }}>{isAr?"إعادة المحاولة":"Retry"}</button>
                  )}
                  {error && <div style={{ color:"#ef4444", fontSize:12, textAlign:"center" }}>{error}</div>}
                  <button onClick={() => setTotpStep(2)} disabled={!secret} style={{ background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:800, fontSize:15, opacity:secret?1:0.5 }}>{isAr?"أضفته →":"I've added it →"}</button>
                </>
              )}
              {!mfaEnabled && totpStep === 2 && (
                <>
                  <div style={{ fontWeight:700, color:cs.text, fontSize:15, marginBottom:4 }}>{isAr?"الخطوة 2: أدخل الكود من 6 أرقام":"Step 2: Enter the 6-digit code"}</div>
                  <p style={{ fontSize:13, color:cs.textDim, lineHeight:1.6, margin:"0 0 16px" }}>{isAr?"افتح تطبيق المصادقة وأدخل الكود الحالي":"Open your authenticator app and enter the current 6-digit code"}</p>
                  <CodeInputRow onVerify={verifyTOTP} />
                  <button onClick={() => setTotpStep(1)} style={{ background:"transparent", border:"none", color:cs.textDim, cursor:"pointer", fontSize:12, textAlign:"center" }}>← {isAr?"رجوع":"Back"}</button>
                </>
              )}
              {!mfaEnabled && totpStep === 3 && (
                <div style={{ textAlign:"center", padding:24 }}>
                  <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
                  <div style={{ fontWeight:800, fontSize:20, color:"#10b981", marginBottom:8 }}>{isAr?"تم تفعيل تطبيق المصادقة!":"Authenticator app enabled!"}</div>
                  <p style={{ fontSize:13, color:cs.textDim, lineHeight:1.6 }}>{isAr?"حسابك محمي دلوقتي. هتحتاج الكود في كل مرة تسجل دخول.":"Your account is now protected. You'll need your authenticator code each time you sign in."}</p>
                  <button onClick={() => { setTab("backup"); onEnabled?.(); }} style={{ background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"12px 28px", cursor:"pointer", fontWeight:700, fontSize:14, marginTop:16 }}>{isAr?"احفظ الأكواد الاحتياطية →":"Save Backup Codes →"}</button>
                </div>
              )}
            </div>
          )}

          {/* ── SMS ── */}
          {tab==="sms" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {mfaEnabled && mfaMethod==="sms" ? (
                <div style={{ textAlign:"center", padding:24 }}>
                  <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
                  <div style={{ fontWeight:800, fontSize:20, color:"#10b981", marginBottom:8 }}>{isAr?"مفعّلة بالفعل":"Already enabled"}</div>
                  <button onClick={()=>disableMFA()} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444", borderRadius:9, padding:"10px 20px", cursor:"pointer", fontWeight:700, fontSize:13, marginTop:10 }}>{isAr?"إلغاء التفعيل":"Disable"}</button>
                </div>
              ) : smsUnavailable ? (
                <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:12, padding:16, fontSize:13, color:"#f59e0b" }}>
                  {isAr?"الرسائل النصية مش متاحة دلوقتي — استخدم تطبيق المصادقة بدلاً منها.":"SMS isn't available right now — please use the Authenticator App instead."}
                </div>
              ) : smsStep === 1 && (
                <>
                  <div style={{ fontWeight:700, color:cs.text, fontSize:15, marginBottom:4 }}>{isAr?"أدخل رقم تليفونك":"Enter your phone number"}</div>
                  <p style={{ fontSize:13, color:cs.textDim, lineHeight:1.6, margin:0 }}>{isAr?"هنبعتلك كود من 6 أرقام على الرقم ده كل ما تسجل دخول":"We'll send a 6-digit code to this number each time you sign in"}</p>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+20 100 000 0000" style={{ background:"rgba(255,255,255,0.05)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"12px 14px", fontSize:16, outline:"none" }} />
                  {error && <div style={{ color:"#ef4444", fontSize:12 }}>{error}</div>}
                  <button onClick={sendSmsCode} disabled={!phone||verifying} style={{ background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:800, fontSize:15 }}>{verifying?(isAr?"جاري الإرسال…":"Sending…"):(isAr?"إرسال الكود →":"Send Code →")}</button>
                </>
              )}
              {!mfaEnabled && smsStep === 2 && (
                <>
                  <div style={{ fontWeight:700, color:cs.text, fontSize:15, marginBottom:4 }}>{isAr?"أدخل كود SMS":"Enter the SMS code"}</div>
                  <p style={{ fontSize:13, color:cs.textDim, margin:"0 0 16px" }}>{isAr?"بعتنا كود لـ":"We sent a code to"} <b style={{ color:cs.text }}>{phone}</b></p>
                  <CodeInputRow onVerify={verifySMS} />
                  <button onClick={() => setSmsStep(1)} style={{ background:"transparent", border:"none", color:cs.textDim, cursor:"pointer", fontSize:12, textAlign:"center" }}>← {isAr?"تغيير الرقم":"Change number"}</button>
                </>
              )}
              {!mfaEnabled && smsStep === 3 && (
                <div style={{ textAlign:"center", padding:24 }}>
                  <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
                  <div style={{ fontWeight:800, fontSize:20, color:"#10b981", marginBottom:8 }}>{isAr?"تم تفعيل SMS!":"SMS 2FA enabled!"}</div>
                  <p style={{ fontSize:13, color:cs.textDim, lineHeight:1.6 }}>{isAr?"هتستلم كود على رقمك كل ما تسجل دخول.":"You'll receive a text message code each time you sign in."}</p>
                  <button onClick={() => { setTab("backup"); onEnabled?.(); }} style={{ background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"12px 28px", cursor:"pointer", fontWeight:700, fontSize:14, marginTop:16 }}>{isAr?"احفظ الأكواد الاحتياطية →":"Save Backup Codes →"}</button>
                </div>
              )}
            </div>
          )}

          {/* ── BACKUP CODES ── */}
          {tab==="backup" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:12, padding:14, fontSize:13, color:cs.textDim, lineHeight:1.6 }}>
                ⚠️ {isAr?"احفظ الأكواد دي في مكان آمن. كل كود يُستخدم مرة واحدة بس. لو فقدت الوصول لتطبيق المصادقة، استخدم كود احتياطي لتسجيل الدخول.":"Save these backup codes somewhere safe. Each code can only be used once. If you lose access to your authenticator, use a backup code to sign in."}
              </div>
              {backupCodes.length>0 ? (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {backupCodes.map((c, i) => (
                      <div key={i} style={{ background:"rgba(0,0,0,0.2)", borderRadius:9, padding:"10px 14px", fontFamily:"monospace", fontSize:14, fontWeight:700, color:"#a5f3fc", textAlign:"center", letterSpacing:2 }}>{c}</div>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button aria-label="Copy backup codes" onClick={copyBackupCodes} style={{ flex:1, background:"rgba(255,255,255,0.06)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"11px", cursor:"pointer", fontWeight:700, fontSize:13 }}>{copied?(isAr?"✓ اتنسخت!":"✓ Copied!"):(isAr?"📋 نسخ كل الأكواد":"📋 Copy all codes")}</button>
                    <button onClick={() => window.print?.()} style={{ flex:1, background:"rgba(255,255,255,0.06)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"11px", cursor:"pointer", fontWeight:700, fontSize:13 }}>🖨 {isAr?"طباعة":"Print codes"}</button>
                  </div>
                  {mfaEnabled && <button onClick={() => { onClose(); }} style={{ background:"linear-gradient(135deg,#10b981,#6366f1)", border:"none", color:"#fff", borderRadius:10, padding:"13px", cursor:"pointer", fontWeight:800, fontSize:15 }}>✓ {isAr?"حفظتهم":"I've saved my codes"}</button>}
                </>
              ) : mfaEnabled ? (
                <div style={{ textAlign:"center", padding:20 }}>
                  <p style={{ fontSize:13, color:cs.textDim, marginBottom:14 }}>{isAr?"الأكواد بتتشفّر وبتتعرض مرة واحدة بس. لو ضيّعتها، تقدر تنشئ مجموعة جديدة (هتلغي القديمة).":"Codes are hashed and only ever shown once. If you've lost yours, generate a new set (this invalidates the old ones)."}</p>
                  <button onClick={regenerateBackupCodes} disabled={verifying} style={{ background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:10, padding:"12px 24px", cursor:"pointer", fontWeight:700, fontSize:14 }}>{verifying?(isAr?"جاري الإنشاء…":"Generating…"):(isAr?"إنشاء أكواد جديدة":"Generate new codes")}</button>
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:20, fontSize:13, color:cs.textDim }}>{isAr?"فعّل تطبيق المصادقة أو SMS الأول عشان تحصل على أكواد احتياطية":"Enable Authenticator or SMS first to get backup codes"}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {reauthPrompt && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:2100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ width:"100%", maxWidth:360, background:cs.card, border:`1px solid ${cs.border}`, borderRadius:16, padding:24 }}>
            <div style={{ fontWeight:800, fontSize:16, color:cs.text, marginBottom:6 }}>{isAr?"أكّد كلمة السر":"Confirm your password"}</div>
            <p style={{ fontSize:12, color:cs.textDim, lineHeight:1.6, marginBottom:16 }}>{isAr?"عشان نتأكد إنك إنت اللي بتلغي المصادقة الثنائية":"To confirm it's really you disabling two-factor authentication"}</p>
            <input
              type="password"
              value={reauthPassword}
              onChange={e=>setReauthPassword(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&confirmReauthPassword()}
              placeholder={isAr?"كلمة السر":"Password"}
              style={{ width:"100%", boxSizing:"border-box", background:"rgba(255,255,255,0.06)", border:`1.5px solid ${cs.border}`, color:cs.text, borderRadius:9, padding:"11px 14px", fontSize:14, outline:"none", marginBottom:10 }}
              autoFocus
            />
            {reauthError && <div style={{ color:"#ef4444", fontSize:12, marginBottom:10 }}>{reauthError}</div>}
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setReauthPrompt(false)} style={{ flex:1, background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:9, padding:"11px", cursor:"pointer", fontWeight:600, fontSize:13 }}>{isAr?"إلغاء":"Cancel"}</button>
              <button onClick={confirmReauthPassword} disabled={verifying} style={{ flex:1, background:"linear-gradient(135deg,#6366f1,#0ea5e9)", border:"none", color:"#fff", borderRadius:9, padding:"11px", cursor:"pointer", fontWeight:700, fontSize:13 }}>{verifying?(isAr?"…":"…"):(isAr?"تأكيد":"Confirm")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
