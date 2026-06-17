/**
 * ReferralProgram.jsx — Corvus Phase 15
 * User-facing referral: unique links, rewards, leaderboard, redemption
 */
import { useState, useEffect } from "react";

const REWARDS = [
  { milestone: 1,  reward: "1 month free",      icon: "🎁",  color: "#10b981", points: 100 },
  { milestone: 3,  reward: "3 months free",      icon: "🌟",  color: "#0ea5e9", points: 300 },
  { milestone: 5,  reward: "Upgrade to Growth",  icon: "🚀",  color: "#6366f1", points: 500 },
  { milestone: 10, reward: "1 year free + swag", icon: "👑",  color: "#f59e0b", points: 1000 },
];

const MOCK_REFERRALS = [
  { id:"r1", email:"ahmed@company.com",  status:"active",  joined:"2026-05-20", plan:"growth",  earned:49 },
  { id:"r2", email:"sara@startup.io",    status:"active",  joined:"2026-05-28", plan:"starter", earned:0  },
  { id:"r3", email:"omar@corp.com",      status:"pending", joined:null,         plan:null,       earned:0  },
];

const LEADERBOARD = [
  { rank:1, name:"Karim M.",   referrals:14, earned:"$686",  badge:"🥇" },
  { rank:2, name:"Sarah J.",   referrals:9,  earned:"$441",  badge:"🥈" },
  { rank:3, name:"You",        referrals:2,  earned:"$49",   badge:"⭐", isMe:true },
  { rank:4, name:"Priya S.",   referrals:1,  earned:"$0",    badge:"4️⃣" },
];

const STATUS_COLORS = { active:"#10b981", pending:"#f59e0b", expired:"#ef4444" };

export function ReferralProgram({ profile, cs, lang, onClose }) {
  const [tab, setTab]         = useState("dashboard");
  const [copied, setCopied]   = useState(false);
  const [shareMethod, setShare] = useState(null);

  const refCode = `PAI-${(profile?.uid || "USER").slice(0,6).toUpperCase()}`;
  const refLink = `https://corvus.com?ref=${refCode}`;
  const totalReferrals = MOCK_REFERRALS.filter(r => r.status === "active").length;
  const totalEarned    = MOCK_REFERRALS.reduce((s, r) => s + r.earned, 0);
  const nextMilestone  = REWARDS.find(r => r.milestone > totalReferrals) || REWARDS[REWARDS.length - 1];
  const progressPct    = Math.min(100, (totalReferrals / nextMilestone.milestone) * 100);

  const copy = () => {
    navigator.clipboard?.writeText(refLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLinks = {
    email:    `mailto:?subject=Try Corvus free&body=Hey! I've been using Corvus to fix my posture and it's amazing. Try it free: ${refLink}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(refLink)}`,
    twitter:  `https://twitter.com/intent/tweet?text=${encodeURIComponent("I've been using @Corvus to fix my posture. Try it free → " + refLink)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent("Check out Corvus — AI posture analysis that actually works! Free trial: " + refLink)}`,
  };

  const tabs = [
    { id:"dashboard", label:"My Referrals", icon:"📊" },
    { id:"rewards",   label:"Rewards",      icon:"🎁" },
    { id:"leaderboard",label:"Leaderboard", icon:"🏆" },
    { id:"share",     label:"Share",        icon:"🔗" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.76)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:cs.card, borderRadius:20, width:"100%", maxWidth:860, height:"88vh", display:"flex", flexDirection:"column", overflow:"hidden", border:`1px solid ${cs.border}`, boxShadow:"0 32px 80px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding:"20px 28px 0", borderBottom:`1px solid ${cs.border}`, background:"linear-gradient(135deg,rgba(16,185,129,0.08),rgba(99,102,241,0.04))" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#10b981,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🎯</div>
              <div>
                <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>Referral Program</div>
                <div style={{ fontSize:12, color:cs.textDim }}>Invite friends · Earn free months · Grow together</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {[
                { label:"Referred",   value:totalReferrals, color:"#10b981" },
                { label:"Earned",     value:`$${totalEarned}`, color:"#f59e0b" },
              ].map(m => (
                <div key={m.label} style={{ textAlign:"center", padding:"6px 14px", background:"rgba(255,255,255,0.04)", borderRadius:10 }}>
                  <div style={{ fontSize:17, fontWeight:800, color:m.color }}>{m.value}</div>
                  <div style={{ fontSize:10, color:cs.textDim }}>{m.label}</div>
                </div>
              ))}
              <button onClick={onClose} style={{ background:"rgba(255,255,255,0.07)", border:`1px solid ${cs.border}`, color:cs.text, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:13 }}>✕</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ background:tab===t.id?"rgba(16,185,129,0.12)":"transparent", border:"none", color:tab===t.id?"#10b981":cs.textDim, padding:"8px 14px", cursor:"pointer", borderRadius:"8px 8px 0 0", fontWeight:tab===t.id?700:500, fontSize:13, borderBottom:tab===t.id?"2px solid #10b981":"2px solid transparent" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:24 }}>

          {/* ── DASHBOARD ── */}
          {tab==="dashboard" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {/* Ref link */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:12, fontSize:14 }}>Your Referral Link</div>
                <div style={{ display:"flex", gap:8 }}>
                  <code style={{ flex:1, background:"rgba(0,0,0,0.25)", padding:"10px 14px", borderRadius:9, color:"#a5f3fc", fontSize:13, wordBreak:"break-all" }}>{refLink}</code>
                  <button onClick={copy} style={{ background:copied?"#10b981":"linear-gradient(135deg,#10b981,#6366f1)", border:"none", color:"#fff", borderRadius:9, padding:"10px 18px", cursor:"pointer", fontWeight:700, fontSize:13, whiteSpace:"nowrap", transition:"background .3s" }}>
                    {copied ? "✓ Copied!" : "Copy Link"}
                  </button>
                </div>
                <div style={{ marginTop:10, fontSize:12, color:cs.textDim }}>Code: <b style={{ color:cs.text, fontFamily:"monospace" }}>{refCode}</b> · Every signup using your link gets 1 month free</div>
              </div>

              {/* Progress to next reward */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ fontWeight:700, color:cs.text, fontSize:14 }}>Next Reward</div>
                  <div style={{ fontSize:13, color:nextMilestone.color, fontWeight:700 }}>{nextMilestone.icon} {nextMilestone.reward}</div>
                </div>
                <div style={{ fontSize:12, color:cs.textDim, marginBottom:10 }}>
                  {totalReferrals} of {nextMilestone.milestone} referrals · {nextMilestone.milestone - totalReferrals} more to go
                </div>
                <div style={{ height:10, background:"rgba(255,255,255,0.07)", borderRadius:5, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${progressPct}%`, borderRadius:5, background:`linear-gradient(90deg,#10b981,${nextMilestone.color})`, transition:"width .6s" }} />
                </div>
              </div>

              {/* Referred users */}
              <div style={{ fontWeight:700, color:cs.text, fontSize:15, marginBottom:4 }}>People You Referred ({MOCK_REFERRALS.length})</div>
              {MOCK_REFERRALS.map(r => (
                <div key={r.id} style={{ background:cs.bg, borderRadius:12, padding:"14px 16px", border:`1px solid ${cs.border}`, display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:`${STATUS_COLORS[r.status]}18`, border:`2px solid ${STATUS_COLORS[r.status]}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:STATUS_COLORS[r.status], flexShrink:0 }}>
                    {r.email[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, color:cs.text, fontSize:13 }}>{r.email}</div>
                    <div style={{ fontSize:11, color:cs.textDim, marginTop:2 }}>
                      {r.joined ? `Joined ${r.joined}` : "Invite pending"} {r.plan ? `· ${r.plan} plan` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:13, fontWeight:700, color:r.earned > 0 ? "#f59e0b" : cs.textDim }}>
                      {r.earned > 0 ? `+$${r.earned}` : "—"}
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:`${STATUS_COLORS[r.status]}18`, color:STATUS_COLORS[r.status] }}>{r.status}</span>
                  </div>
                </div>
              ))}

              {/* How it works */}
              <div style={{ background:"rgba(99,102,241,0.07)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:12, padding:16 }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:12, fontSize:13 }}>How It Works</div>
                {[
                  { step:1, text:"Share your unique link with colleagues or on social media" },
                  { step:2, text:"They sign up using your link and get 1 free month" },
                  { step:3, text:"When they become a paying customer, you earn rewards" },
                  { step:4, text:"Rewards are credited automatically to your account" },
                ].map(s => (
                  <div key={s.step} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
                    <div style={{ width:22, height:22, borderRadius:"50%", background:"rgba(99,102,241,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#6366f1", flexShrink:0 }}>{s.step}</div>
                    <div style={{ fontSize:12, color:cs.textDim, lineHeight:1.5 }}>{s.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── REWARDS ── */}
          {tab==="rewards" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16, marginBottom:4 }}>🎁 Reward Milestones</div>
              {REWARDS.map(r => {
                const reached = totalReferrals >= r.milestone;
                return (
                  <div key={r.milestone} style={{ background:cs.bg, borderRadius:14, padding:18, border:`1px solid ${reached ? r.color + "44" : cs.border}`, display:"flex", alignItems:"center", gap:16, opacity:reached||totalReferrals < r.milestone ? 1 : 0.5 }}>
                    <div style={{ fontSize:36 }}>{r.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                        <span style={{ fontWeight:800, color:cs.text, fontSize:15 }}>{r.milestone} Referral{r.milestone > 1 ? "s" : ""}</span>
                        {reached && <span style={{ fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20, background:"rgba(16,185,129,0.12)", color:"#10b981" }}>✓ Earned!</span>}
                      </div>
                      <div style={{ fontSize:14, fontWeight:700, color:r.color }}>{r.reward}</div>
                      <div style={{ fontSize:11, color:cs.textDim, marginTop:2 }}>{r.points} points</div>
                    </div>
                    {!reached && (
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:20, fontWeight:900, color:cs.textDim }}>{Math.max(0, r.milestone - totalReferrals)}</div>
                        <div style={{ fontSize:10, color:cs.textDim }}>to go</div>
                      </div>
                    )}
                    {reached && (
                      <button style={{ background:`${r.color}18`, border:`1px solid ${r.color}44`, color:r.color, borderRadius:9, padding:"8px 16px", cursor:"pointer", fontWeight:700, fontSize:12 }}>Redeem</button>
                    )}
                  </div>
                );
              })}

              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, fontSize:14, marginBottom:12 }}>💰 Your Balance</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:32, fontWeight:900, color:"#f59e0b" }}>${totalEarned}</div>
                    <div style={{ fontSize:12, color:cs.textDim, marginTop:4 }}>Total earned from {totalReferrals} active referrals</div>
                  </div>
                  <button style={{ background:"linear-gradient(135deg,#f59e0b,#10b981)", border:"none", color:"#fff", borderRadius:10, padding:"10px 20px", cursor:"pointer", fontWeight:700, fontSize:13 }}>Withdraw</button>
                </div>
              </div>
            </div>
          )}

          {/* ── LEADERBOARD ── */}
          {tab==="leaderboard" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16, marginBottom:4 }}>🏆 Top Referrers This Month</div>
              {LEADERBOARD.map(u => (
                <div key={u.rank} style={{ background:u.isMe ? "rgba(16,185,129,0.05)" : cs.bg, borderRadius:12, padding:"14px 18px", border:`1px solid ${u.isMe ? "rgba(16,185,129,0.4)" : cs.border}`, display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ fontSize:28 }}>{u.badge}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, color:u.isMe ? "#10b981" : cs.text, fontSize:14 }}>{u.name}{u.isMe ? " (You)" : ""}</div>
                    <div style={{ fontSize:11, color:cs.textDim, marginTop:2 }}>{u.referrals} referral{u.referrals !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ fontWeight:800, fontSize:16, color:"#f59e0b" }}>{u.earned}</div>
                </div>
              ))}
              <div style={{ background:"rgba(99,102,241,0.07)", border:"1px solid rgba(99,102,241,0.2)", borderRadius:12, padding:14, fontSize:12, color:cs.textDim, lineHeight:1.6 }}>
                🏆 Top 3 referrers each month receive bonus rewards + featured in our newsletter. Competition resets on the 1st.
              </div>
            </div>
          )}

          {/* ── SHARE ── */}
          {tab==="share" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>🔗 Share Your Link</div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[
                  { id:"email",    label:"📧 Email",    color:"#ea4335", href:shareLinks.email },
                  { id:"linkedin", label:"💼 LinkedIn", color:"#0a66c2", href:shareLinks.linkedin },
                  { id:"twitter",  label:"𝕏 Twitter",   color:"#1da1f2", href:shareLinks.twitter },
                  { id:"whatsapp", label:"💬 WhatsApp", color:"#25d366", href:shareLinks.whatsapp },
                ].map(s => (
                  <a key={s.id} href={s.href} target="_blank" rel="noreferrer" style={{ textDecoration:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:`${s.color}12`, border:`1px solid ${s.color}33`, borderRadius:12, padding:18, cursor:"pointer", fontWeight:700, fontSize:14, color:s.color }}>
                    {s.label}
                  </a>
                ))}
              </div>

              {/* Pre-written messages */}
              <div style={{ fontWeight:700, color:cs.text, fontSize:14, marginBottom:4 }}>📝 Pre-written Messages</div>
              {[
                { label:"Professional",  text:`I've been using Corvus at work and my neck pain has significantly reduced. It uses AI to monitor and coach your posture in real time. Try it free: ${refLink}` },
                { label:"Casual",        text:`This posture app is actually really good lol. Uses your camera to track posture and gives you AI coaching. Check it out: ${refLink}` },
                { label:"For HR/Managers", text:`If you're looking for a scalable employee wellness tool, Corvus has been great for our team. AI-powered posture monitoring with team dashboards: ${refLink}` },
              ].map(m => (
                <div key={m.label} style={{ background:cs.bg, borderRadius:12, padding:16, border:`1px solid ${cs.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:cs.textDim }}>{m.label}</span>
                    <button onClick={() => { navigator.clipboard?.writeText(m.text).catch(() => {}); }} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:6, padding:"3px 10px", cursor:"pointer", fontSize:11 }}>Copy</button>
                  </div>
                  <div style={{ fontSize:12, color:cs.text, lineHeight:1.6 }}>{m.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
