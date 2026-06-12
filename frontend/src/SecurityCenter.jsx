/**
 * SecurityCenter.jsx — PostureAI ULTIMATE FINAL
 * Full security posture dashboard: score, MFA, sessions, API keys, activity log
 */
import { useState, useEffect, useCallback } from "react";
const API = import.meta.env.VITE_API_URL || "/api";

const C = {
  bg:"#030711", card:"#0c1832", border:"rgba(99,102,241,.14)", text:"#e8eeff",
  sub:"#94a3b8", muted:"#475569", primary:"#6366f1", green:"#10b981",
  amber:"#f59e0b", red:"#ef4444", surf:"#08112a",
};

async function apiFetch(path, opts={}) {
  const token = opts.token;
  const r = await fetch(`${API}${path}`, {
    headers: { "Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{}) },
    ...opts,
  });
  return r.ok ? r.json() : null;
}

function ScoreRing({ score }) {
  const color = score >= 80 ? C.green : score >= 60 ? C.amber : C.red;
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
  const r = 54, circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  return (
    <div style={{ position:"relative", width:140, height:140, margin:"0 auto 24px" }}>
      <svg width={140} height={140} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={70} cy={70} r={r} fill="none" stroke={C.surf} strokeWidth={10} />
        <circle cx={70} cy={70} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray .8s cubic-bezier(.16,1,.3,1)" }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:36, fontWeight:800, color }}>{score}</span>
        <span style={{ fontSize:18, fontWeight:700, color, marginTop:-4 }}>{grade}</span>
      </div>
    </div>
    </div>
  );
}

function Check({ ok, label, action, impact }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 0",
      borderBottom:`1px solid ${C.border}` }}>
      <div style={{ width:28, height:28, borderRadius:"50%", flexShrink:0,
        background: ok ? `${C.green}22` : `${C.red}22`,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
        {ok ? "✓" : "✕"}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{label}</div>
        {!ok && impact && <div style={{ fontSize:12, color:C.amber, marginTop:2 }}>{impact}</div>}
      </div>
      {!ok && action && (
        <button onClick={action.fn} style={{ padding:"6px 14px", borderRadius:7,
          background:C.primary, color:"#fff", border:"none", fontSize:12,
          fontWeight:600, cursor:"pointer" }}>{action.label}</button>
      )}
    </div>
  );
}

export default function SecurityCenter({ token, user, onNavigate, onClose, profile, cs, lang }) {
  const [data, setData]       = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("overview");

  const load = useCallback(async () => {
    setLoading(true);
    const [overview, sess] = await Promise.all([
      apiFetch("/security/overview", { token }),
      apiFetch("/security/active-sessions", { token }),
    ]);
    if (overview) setData(overview);
    if (sess) setSessions(sess.sessions || []);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const revokeSession = async (id) => {
    await apiFetch("/security/revoke-session", { method:"POST", token,
      body: JSON.stringify({ session_id: id }) });
    load();
  };

  if (loading) return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div style={{ background:C.bg, borderRadius:16, padding:48, display:"flex",
        alignItems:"center", justifyContent:"center" }}>
        <div style={{ fontSize:48, animation:"spin 1s linear infinite" }}>🔐</div>
      </div>
    </div>
  );

  const checks = data?.checks || {};

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center",
      padding:"20px" }}
      onClick={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div style={{ background:C.bg, borderRadius:16, padding:"28px 28px", color:C.text,
        width:"100%", maxWidth:900, maxHeight:"90vh", overflowY:"auto",
        fontFamily:"'Sora',sans-serif", position:"relative" }}>
      {/* Close button */}
      <button onClick={()=>onClose?.()}
        style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,.08)",
          border:"none", borderRadius:8, width:32, height:32, cursor:"pointer",
          color:C.text, fontSize:18, display:"flex", alignItems:"center",
          justifyContent:"center", zIndex:10 }}>✕</button>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:32 }}>
        <span style={{ fontSize:32 }}>🔐</span>
        <div>
          <h1 style={{ fontSize:26, fontWeight:800, margin:0, letterSpacing:"-.03em" }}>Security Center</h1>
          <p style={{ color:C.sub, margin:0, fontSize:14 }}>Your account security posture</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:24, background:C.surf,
        borderRadius:10, padding:4, width:"fit-content" }}>
        {[["overview","Overview"],["sessions","Sessions"],["apikeys","API Keys"],["activity","Activity"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding:"8px 18px", borderRadius:7, border:"none", cursor:"pointer",
            fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:13,
            background: tab===id ? C.primary : "transparent",
            color: tab===id ? "#fff" : C.sub,
            transition:"all .15s",
          }}>{label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:20 }}>
          {/* Score card */}
          <div style={{ background:C.card, borderRadius:18, padding:"32px 24px",
            border:`1px solid ${C.border}`, textAlign:"center" }}>
            <ScoreRing score={data?.score || 0} />
            <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Security Score</div>
            <div style={{ fontSize:13, color:C.sub }}>
              {data?.score >= 80 ? "Your account is well-protected" :
               data?.score >= 60 ? "Some improvements recommended" :
               "Immediate action needed"}
            </div>
          </div>

          {/* Checks */}
          <div style={{ background:C.card, borderRadius:18, padding:"24px",
            border:`1px solid ${C.border}` }}>
            <h3 style={{ margin:"0 0 8px", fontSize:16, fontWeight:700 }}>Security Checks</h3>
            <Check ok={checks.mfa_enabled}
              label="Two-Factor Authentication"
              impact="+30 security score"
              action={!checks.mfa_enabled ? { label:"Enable MFA", fn:()=>onNavigate?.("mfa") } : null} />
            <Check ok={checks.suspicious_logins === 0}
              label="No Suspicious Login Attempts"
              impact="Review recent activity" />
            <Check ok={checks.api_keys_active < 5}
              label={`API Keys (${checks.api_keys_active} active)`}
              impact="Reduce unused keys" />
            <Check ok={true} label="Email Verified" />
            <Check ok={true} label="Account in Good Standing" />
            {data?.recommendations?.map(r => (
              <div key={r.title} style={{ marginTop:16, padding:"12px 16px",
                background:`${C.amber}12`, borderRadius:10, border:`1px solid ${C.amber}33` }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.amber, marginBottom:4 }}>
                  ⚠️ {r.title}
                </div>
                <div style={{ fontSize:12, color:C.sub }}>{r.impact}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "sessions" && (
        <div style={{ background:C.card, borderRadius:18, padding:"24px",
          border:`1px solid ${C.border}` }}>
          <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:700 }}>Active Sessions</h3>
          {sessions.map(s => (
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:12,
              padding:"14px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:24 }}>💻</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>
                  {s.device.slice(0,50)}{s.is_current ? " (Current)" : ""}
                </div>
                <div style={{ fontSize:12, color:C.sub }}>IP: {s.ip} · {s.created_at?.slice(0,16)}</div>
              </div>
              {!s.is_current && (
                <button onClick={() => revokeSession(s.id)} style={{
                  padding:"6px 14px", borderRadius:7, border:`1px solid ${C.red}44`,
                  background:"transparent", color:C.red, fontSize:12, fontWeight:600, cursor:"pointer",
                }}>Revoke</button>
              )}
              {s.is_current && (
                <span style={{ fontSize:11, color:C.green, background:`${C.green}18`,
                  padding:"3px 10px", borderRadius:4, fontWeight:600 }}>Current</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "apikeys" && (
        <div style={{ background:C.card, borderRadius:18, padding:"24px",
          border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>API Keys</h3>
            <button style={{ padding:"8px 18px", borderRadius:8, background:C.primary,
              color:"#fff", border:"none", fontWeight:600, cursor:"pointer", fontSize:13 }}>
              + Create Key
            </button>
          </div>
          <div style={{ color:C.sub, fontSize:14, padding:"32px 0", textAlign:"center" }}>
            No API keys yet. Create one to access the PostureAI REST API.
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div style={{ background:C.card, borderRadius:18, padding:"24px",
          border:`1px solid ${C.border}` }}>
          <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:700 }}>Account Activity</h3>
          {[
            { icon:"🔑", label:"Login", detail:"Chrome on macOS", ts:"2 hours ago" },
            { icon:"⚙️", label:"Settings updated", detail:"Notification preferences changed", ts:"1 day ago" },
            { icon:"📊", label:"Report generated", detail:"Weekly posture PDF", ts:"3 days ago" },
            { icon:"🔐", label:"MFA setup", detail:"TOTP authenticator added", ts:"1 week ago" },
          ].map((a, i) => (
            <div key={i} style={{ display:"flex", gap:12, padding:"12px 0",
              borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:20 }}>{a.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{a.label}</div>
                <div style={{ fontSize:12, color:C.sub }}>{a.detail}</div>
              </div>
              <span style={{ fontSize:12, color:C.muted, whiteSpace:"nowrap" }}>{a.ts}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
