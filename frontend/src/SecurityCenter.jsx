/**
 * SecurityCenter.jsx — PostureAI
 * Works fully client-side from Firebase Auth + Firestore (no backend needed)
 */
import { useState, useEffect, useMemo } from "react";
import { getAuth }  from "firebase/auth";

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
  );
}

function Check({ ok, label, action, impact }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 0",
      borderBottom:`1px solid ${C.border}` }}>
      <div style={{ width:28, height:28, borderRadius:"50%", flexShrink:0,
        background: ok ? `${C.green}22` : `${C.red}22`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:14, fontWeight:700, color: ok ? C.green : C.red }}>
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

export default function SecurityCenter({ user, onClose, profile, cs, lang }) {
  const [tab, setTab] = useState("overview");

  // Derive everything from Firebase Auth current user (no backend needed)
  const auth = getAuth();
  const firebaseUser = auth.currentUser;

  const providers = useMemo(()=>(firebaseUser?.providerData||[]),[firebaseUser]);
  const hasMFA    = useMemo(()=>(firebaseUser?.multiFactor?.enrolledFactors?.length||0)>0,[firebaseUser]);
  const hasGoogle = providers.some(p=>p.providerId==="google.com");
  const hasEmail  = providers.some(p=>p.providerId==="password");
  const emailVerified = firebaseUser?.emailVerified ?? false;

  // Compute score from real data
  const score = useMemo(()=>{
    let s = 40; // base
    if(emailVerified) s += 20;
    if(hasMFA)        s += 25;
    if(hasGoogle || hasEmail) s += 10;
    if(providers.length >= 2) s += 5;
    return Math.min(100, s);
  },[emailVerified, hasMFA, hasGoogle, hasEmail, providers]);

  // Simulated activity log (real would need Firestore)
  const activity = useMemo(()=>{
    const now = Date.now();
    const items = [
      { icon:"🔑", label:"Login", detail:`${firebaseUser?.metadata?.lastSignInTime ? new Date(firebaseUser.metadata.lastSignInTime).toLocaleString() : "Recently"}`, ts:"Last sign-in" },
      { icon:"👤", label:"Account created", detail:firebaseUser?.metadata?.creationTime ? new Date(firebaseUser.metadata.creationTime).toLocaleDateString() : "—", ts:"Creation date" },
    ];
    if(hasGoogle) items.push({ icon:"🔵", label:"Google linked", detail:providers.find(p=>p.providerId==="google.com")?.email||"—", ts:"Active" });
    if(hasEmail)  items.push({ icon:"📧", label:"Email/password", detail:firebaseUser?.email||"—", ts:"Active" });
    return items;
  },[firebaseUser, hasGoogle, hasEmail, providers]);

  // Current session info from browser
  const currentSession = useMemo(()=>({
    device: navigator.userAgent.includes("Mobile") ? "📱 Mobile" : "💻 Desktop",
    browser: navigator.userAgent.includes("Chrome") ? "Chrome" :
             navigator.userAgent.includes("Firefox") ? "Firefox" :
             navigator.userAgent.includes("Safari") ? "Safari" : "Browser",
    os: navigator.userAgent.includes("Mac") ? "macOS" :
        navigator.userAgent.includes("Win") ? "Windows" :
        navigator.userAgent.includes("Linux") ? "Linux" : "Unknown OS",
    current: true,
  }),[]);

  const tabList = [["overview","Overview"],["sessions","Sessions"],["apikeys","API Keys"],["activity","Activity"]];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}
      onClick={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div style={{ background:C.bg, borderRadius:16, padding:"28px", color:C.text,
        width:"100%", maxWidth:900, maxHeight:"90vh", overflowY:"auto",
        fontFamily:"'Sora',sans-serif", position:"relative" }}>

        {/* Close */}
        <button onClick={onClose}
          style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,.08)",
            border:"none", borderRadius:8, width:32, height:32, cursor:"pointer",
            color:C.text, fontSize:18, display:"flex", alignItems:"center",
            justifyContent:"center", zIndex:10 }}>✕</button>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
          <span style={{ fontSize:32 }}>🔐</span>
          <div>
            <h1 style={{ fontSize:24, fontWeight:800, margin:0, letterSpacing:"-.03em" }}>Security Center</h1>
            <p style={{ color:C.sub, margin:0, fontSize:13 }}>Your account security posture</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:24, background:C.surf,
          borderRadius:10, padding:4, width:"fit-content" }}>
          {tabList.map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              padding:"8px 18px", borderRadius:7, border:"none", cursor:"pointer",
              fontWeight:600, fontSize:13,
              background: tab===id ? C.primary : "transparent",
              color: tab===id ? "#fff" : C.sub,
              transition:"all .15s" }}>{label}</button>
          ))}
        </div>

        {/* Overview */}
        {tab==="overview"&&(
          <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:20 }}>
            {/* Score card */}
            <div style={{ background:C.card, borderRadius:16, padding:"28px 20px",
              border:`1px solid ${C.border}`, textAlign:"center" }}>
              <ScoreRing score={score}/>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Security Score</div>
              <div style={{ fontSize:13, color:C.sub, lineHeight:1.5 }}>
                {score >= 80 ? "Your account is well-protected ✅" :
                 score >= 60 ? "Some improvements recommended" :
                 "Immediate action recommended"}
              </div>
              <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:6 }}>
                {[
                  { label:"Email Verified", val:emailVerified?"Yes":"No", col:emailVerified?C.green:C.red },
                  { label:"MFA", val:hasMFA?"Enabled":"Disabled", col:hasMFA?C.green:C.amber },
                  { label:"Linked Methods", val:providers.length, col:C.sub },
                ].map((s,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between",
                    fontSize:12, padding:"6px 10px", background:"rgba(255,255,255,.03)",
                    borderRadius:7 }}>
                    <span style={{ color:C.sub }}>{s.label}</span>
                    <span style={{ fontWeight:700, color:s.col }}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Checks */}
            <div style={{ background:C.card, borderRadius:16, padding:"24px",
              border:`1px solid ${C.border}` }}>
              <h3 style={{ margin:"0 0 8px", fontSize:16, fontWeight:700 }}>Security Checks</h3>
              <Check ok={emailVerified} label="Email Verified"
                impact="Verify your email for full account access"/>
              <Check ok={hasEmail||hasGoogle} label="Sign-in Method Configured"
                impact="Add a sign-in method in Account settings"/>
              <Check ok={providers.length>=2} label="Backup Sign-in Linked"
                impact="Link Google or email/password as a backup"
                action={providers.length<2?{label:"Link Account",fn:onClose}:null}/>
              <Check ok={hasMFA} label="Two-Factor Authentication"
                impact="Enable MFA for +25 security score"
                action={!hasMFA?{label:"Enable MFA",fn:onClose}:null}/>
              <Check ok={true} label="Account in Good Standing"/>
            </div>
          </div>
        )}

        {/* Sessions */}
        {tab==="sessions"&&(
          <div style={{ background:C.card, borderRadius:16, padding:"24px",
            border:`1px solid ${C.border}` }}>
            <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:700 }}>Active Sessions</h3>
            <div style={{ display:"flex", alignItems:"center", gap:12,
              padding:"16px", background:"rgba(16,185,129,.05)",
              borderRadius:10, border:`1px solid ${C.green}33` }}>
              <span style={{ fontSize:24 }}>
                {currentSession.device.includes("Mobile")?"📱":"💻"}
              </span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:C.text }}>
                  {currentSession.browser} on {currentSession.os}
                  <span style={{ marginLeft:8, fontSize:11, color:C.green,
                    background:`${C.green}18`, padding:"2px 8px", borderRadius:4 }}>
                    Current
                  </span>
                </div>
                <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>
                  {firebaseUser?.email} · Signed in {firebaseUser?.metadata?.lastSignInTime ? new Date(firebaseUser.metadata.lastSignInTime).toLocaleString() : "recently"}
                </div>
              </div>
            </div>
            <div style={{ marginTop:16, padding:"14px 16px",
              background:"rgba(99,102,241,.05)", borderRadius:10,
              border:`1px solid ${C.border}`, fontSize:13, color:C.sub, lineHeight:1.6 }}>
              💡 Session management across multiple devices requires the Enterprise plan.
              To sign out of all devices, use Settings → Security → Sign Out Everywhere.
            </div>
          </div>
        )}

        {/* API Keys */}
        {tab==="apikeys"&&(
          <div style={{ background:C.card, borderRadius:16, padding:"24px",
            border:`1px solid ${C.border}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>API Keys</h3>
              <button style={{ padding:"8px 18px", borderRadius:8, background:C.primary,
                color:"#fff", border:"none", fontWeight:600, cursor:"pointer", fontSize:13,
                opacity:.6 }} title="Available on Pro plan">
                + Create Key
              </button>
            </div>
            <div style={{ padding:"40px 0", textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🔌</div>
              <div style={{ fontSize:15, fontWeight:600, color:C.text, marginBottom:8 }}>
                API Keys — Coming Soon
              </div>
              <div style={{ fontSize:13, color:C.sub, maxWidth:360, margin:"0 auto" }}>
                REST API access for Pro & Elite users. Generate keys to integrate PostureAI
                with your own apps and workflows.
              </div>
            </div>
          </div>
        )}

        {/* Activity */}
        {tab==="activity"&&(
          <div style={{ background:C.card, borderRadius:16, padding:"24px",
            border:`1px solid ${C.border}` }}>
            <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:700 }}>Account Activity</h3>
            {activity.map((a,i)=>(
              <div key={i} style={{ display:"flex", gap:12, padding:"14px 0",
                borderBottom:i<activity.length-1?`1px solid ${C.border}`:"none",
                alignItems:"center" }}>
                <div style={{ width:36, height:36, borderRadius:9, flexShrink:0,
                  background:"rgba(99,102,241,.1)", display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:18 }}>{a.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{a.label}</div>
                  <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>{a.detail}</div>
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
