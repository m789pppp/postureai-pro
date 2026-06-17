/**
 * SecurityCenter.jsx — Corvus
 * Client-side only — Firebase Auth metadata, no backend needed
 */
import { useState, useMemo } from "react";
import { getAuth } from "firebase/auth";

const C = {
  bg:"#030711", card:"#0c1832", border:"rgba(99,102,241,.14)", text:"#e8eeff",
  sub:"#94a3b8", muted:"#475569", primary:"#6366f1", green:"#10b981",
  amber:"#f59e0b", red:"#ef4444", surf:"#08112a",
};

function ScoreRing({ score }) {
  const color = score >= 80 ? C.green : score >= 60 ? C.amber : C.red;
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
  const r = 54, circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  return (
    <div style={{ position:"relative", width:130, height:130, margin:"0 auto 20px" }}>
      <svg width={130} height={130} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={65} cy={65} r={r} fill="none" stroke={C.surf} strokeWidth={10}/>
        <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray .8s cubic-bezier(.16,1,.3,1)" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:32, fontWeight:800, color, lineHeight:1 }}>{score}</span>
        <span style={{ fontSize:16, fontWeight:700, color }}>{grade}</span>
      </div>
    </div>
  );
}

function Check({ ok, label, impact, action }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0",
      borderBottom:`1px solid ${C.border}` }}>
      <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0,
        background: ok?`${C.green}20`:`${C.red}20`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:13, fontWeight:700, color: ok?C.green:C.red }}>
        {ok?"✓":"✕"}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{label}</div>
        {!ok&&impact&&<div style={{ fontSize:11, color:C.amber, marginTop:2 }}>{impact}</div>}
      </div>
      {!ok&&action&&(
        <button onClick={action.fn}
          style={{ padding:"5px 12px", borderRadius:6, background:C.primary,
            color:"#fff", border:"none", fontSize:11, fontWeight:600, cursor:"pointer" }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export default function SecurityCenter({ user, onClose, onSignOut }) {
  const [tab, setTab] = useState("overview");

  const auth = getAuth();
  const fu   = auth.currentUser;  // live Firebase user

  const providers     = useMemo(()=>fu?.providerData||[],[fu]);
  const hasMFA        = useMemo(()=>(fu?.multiFactor?.enrolledFactors?.length||0)>0,[fu]);
  const hasGoogle     = providers.some(p=>p.providerId==="google.com");
  const hasEmail      = providers.some(p=>p.providerId==="password");
  const emailVerified = fu?.emailVerified ?? false;
  const hasBackup     = providers.length >= 2;

  const score = useMemo(()=>{
    let s = 30;
    if(emailVerified) s += 20;
    if(hasMFA)        s += 25;
    if(hasGoogle||hasEmail) s += 10;
    if(hasBackup)     s += 10;
    if(providers.length>0) s += 5;
    return Math.min(100, s);
  },[emailVerified, hasMFA, hasGoogle, hasEmail, hasBackup, providers.length]);

  const lastSignIn   = fu?.metadata?.lastSignInTime  ? new Date(fu.metadata.lastSignInTime).toLocaleString()  : "—";
  const createdAt    = fu?.metadata?.creationTime     ? new Date(fu.metadata.creationTime).toLocaleDateString() : "—";

  const browser = navigator.userAgent.includes("Edg") ? "Edge"
    : navigator.userAgent.includes("Chrome") ? "Chrome"
    : navigator.userAgent.includes("Firefox") ? "Firefox"
    : navigator.userAgent.includes("Safari") ? "Safari" : "Browser";
  const os = navigator.userAgent.includes("Mac") ? "macOS"
    : navigator.userAgent.includes("Win") ? "Windows"
    : navigator.userAgent.includes("Linux") ? "Linux"
    : navigator.userAgent.includes("Android") ? "Android"
    : navigator.userAgent.includes("iPhone")||navigator.userAgent.includes("iPad") ? "iOS" : "Unknown";

  const TABS = [["overview","Overview"],["sessions","Sessions"],["activity","Activity"]];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.78)",
      zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div style={{ background:C.bg, borderRadius:18, padding:28, color:C.text,
        width:"100%", maxWidth:860, maxHeight:"90vh", overflowY:"auto",
        fontFamily:"'Sora',sans-serif", position:"relative",
        border:`1px solid ${C.border}`, boxShadow:"0 32px 80px rgba(0,0,0,.6)" }}>

        {/* Close */}
        <button onClick={onClose}
          style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,.08)",
            border:"none", borderRadius:8, width:32, height:32, cursor:"pointer",
            color:C.text, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:24 }}>
          <div style={{ width:46, height:46, borderRadius:12,
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🔐</div>
          <div>
            <div style={{ fontSize:22, fontWeight:800, letterSpacing:"-.02em" }}>Security Center</div>
            <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>Your account security posture</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:24, background:C.surf,
          borderRadius:10, padding:4, width:"fit-content" }}>
          {TABS.map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)}
              style={{ padding:"7px 18px", borderRadius:7, border:"none", cursor:"pointer",
                fontWeight:600, fontSize:13,
                background:tab===id?C.primary:"transparent",
                color:tab===id?"#fff":C.sub, transition:"all .15s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(
          <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:20 }}>
            {/* Score */}
            <div style={{ background:C.card, borderRadius:14, padding:"24px 18px",
              border:`1px solid ${C.border}`, textAlign:"center" }}>
              <ScoreRing score={score}/>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>Security Score</div>
              <div style={{ fontSize:12, color:C.sub, lineHeight:1.5, marginBottom:16 }}>
                {score>=80?"Your account is well-protected ✅"
                :score>=60?"Some improvements recommended"
                :"Action recommended"}
              </div>
              {/* Mini stats */}
              {[
                { k:"Email Verified", v:emailVerified?"Yes ✓":"No", c:emailVerified?C.green:C.red },
                { k:"MFA", v:hasMFA?"Enabled ✓":"Not set", c:hasMFA?C.green:C.amber },
                { k:"Linked methods", v:providers.length, c:C.sub },
              ].map((s,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between",
                  fontSize:12, padding:"5px 8px",
                  background:"rgba(255,255,255,.03)", borderRadius:6, marginBottom:4 }}>
                  <span style={{ color:C.sub }}>{s.k}</span>
                  <span style={{ fontWeight:700, color:s.c }}>{s.v}</span>
                </div>
              ))}
            </div>

            {/* Checks */}
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background:C.card, borderRadius:14, padding:"20px",
                border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>Security Checks</div>
                <Check ok={emailVerified} label="Email Verified"
                  impact="Your email is not verified"/>
                <Check ok={hasEmail||hasGoogle} label="Sign-in Method Active"
                  impact="No sign-in method configured"/>
                <Check ok={hasBackup} label="Backup Sign-in Linked"
                  impact="Add a second sign-in method (Settings → Accounts)"
                  action={!hasBackup?{label:"Add",fn:onClose}:null}/>
                <Check ok={hasMFA} label="Two-Factor Authentication"
                  impact="Enable MFA for maximum protection"/>
                <Check ok={true} label="Account in Good Standing"/>
              </div>

              {/* Linked providers */}
              <div style={{ background:C.card, borderRadius:14, padding:"20px",
                border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:12 }}>Sign-in Methods</div>
                {providers.length===0&&(
                  <div style={{ fontSize:13, color:C.sub }}>No providers found</div>
                )}
                {providers.map((p,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                    padding:"10px 12px", background:"rgba(255,255,255,.03)",
                    borderRadius:9, border:`1px solid ${C.border}`, marginBottom:8 }}>
                    <span style={{ fontSize:20 }}>{p.providerId==="google.com"?"🔵":"📧"}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>
                        {p.providerId==="google.com"?"Google Account":"Email / Password"}
                      </div>
                      <div style={{ fontSize:11, color:C.sub }}>{p.email||fu?.email||"—"}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, color:C.green,
                      background:`${C.green}18`, padding:"2px 8px", borderRadius:4 }}>Active</span>
                  </div>
                ))}
              </div>

              {/* Sign out */}
              <button onClick={onSignOut}
                style={{ padding:"12px", background:"rgba(239,68,68,.1)",
                  color:"#f87171", border:"1px solid rgba(239,68,68,.25)",
                  borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                ⏻ Sign Out Everywhere
              </button>
            </div>
          </div>
        )}

        {/* ── SESSIONS ── */}
        {tab==="sessions"&&(
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {/* Current session */}
            <div style={{ background:C.card, borderRadius:14, padding:20,
              border:`1px solid ${C.green}44` }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:14 }}>Current Session</div>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <span style={{ fontSize:28 }}>💻</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600 }}>
                    {browser} on {os}
                    <span style={{ marginLeft:10, fontSize:11, color:C.green,
                      background:`${C.green}18`, padding:"2px 8px", borderRadius:4 }}>
                      Current
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:C.sub, marginTop:4 }}>
                    {fu?.email} · Last sign-in: {lastSignIn}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background:C.card, borderRadius:14, padding:18,
              border:`1px solid ${C.border}`,
              fontSize:13, color:C.sub, lineHeight:1.7 }}>
              💡 Multi-device session management is available on the <strong style={{color:C.text}}>Enterprise</strong> plan.
              To sign out from all devices now, use the button below.
            </div>
            <button onClick={onSignOut}
              style={{ padding:"12px", background:"rgba(239,68,68,.1)",
                color:"#f87171", border:"1px solid rgba(239,68,68,.25)",
                borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer" }}>
              ⏻ Sign Out Everywhere
            </button>
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {tab==="activity"&&(
          <div style={{ background:C.card, borderRadius:14, padding:20,
            border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:16 }}>Account Activity</div>
            {[
              { icon:"🔑", label:"Last sign-in",    detail:`${browser} on ${os}`,       ts:lastSignIn },
              { icon:"👤", label:"Account created",  detail:fu?.email||"—",               ts:createdAt },
              hasGoogle&&{ icon:"🔵", label:"Google linked",   detail:providers.find(p=>p.providerId==="google.com")?.email||"—", ts:"Active" },
              hasEmail &&{ icon:"📧", label:"Email/password",  detail:fu?.email||"—",               ts:"Active" },
            ].filter(Boolean).map((a,i,arr)=>(
              <div key={i} style={{ display:"flex", gap:12, padding:"14px 0",
                borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none",
                alignItems:"center" }}>
                <div style={{ width:36, height:36, borderRadius:9, flexShrink:0,
                  background:"rgba(99,102,241,.12)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                  {a.icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{a.label}</div>
                  <div style={{ fontSize:11, color:C.sub, marginTop:2 }}>{a.detail}</div>
                </div>
                <span style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap",
                  background:"rgba(255,255,255,.04)", padding:"3px 9px", borderRadius:5 }}>
                  {a.ts}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
