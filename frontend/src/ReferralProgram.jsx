/**
 * ReferralProgram.jsx — Corvus
 * User-facing referral: real stats from the backend, real EGP credit,
 * share links. (Previously rendered fully hardcoded mock referrals, a
 * fake points/milestone system, and an invented leaderboard with made-up
 * names and dollar amounts — none of it backed by anything real. Replaced
 * 2026-07-23 once the backend referral system was actually wired up.)
 */
import { useState, useEffect } from "react";
import { getReferralStats } from "./firebase.js";

const STATUS_COLORS = { active:"#10b981", pending:"#f59e0b", expired:"#ef4444" };

export function ReferralProgram({ profile, cs, lang, onClose }) {
  const isAr = lang === "ar";
  const [tab, setTab]         = useState("dashboard");
  const [copied, setCopied]   = useState(false);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    getReferralStats(profile?.uid).then(d => { if (live) { setStats(d); setLoading(false); } });
    return () => { live = false; };
  }, [profile?.uid]);

  const refCode = stats?.ref_code || "";
  const refLink = refCode ? `${window.location.origin}?ref=${refCode}` : "";
  const referrals = stats?.referrals || [];
  const totalReferrals = stats?.converted || 0;
  const pendingReferrals = stats?.pending || 0;
  const credits = stats?.credits || 0;

  const copy = () => {
    if (!refLink) return;
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
    { id:"dashboard", label:isAr?"إحالاتي":"My Referrals", icon:"📊" },
    { id:"share",     label:isAr?"مشاركة":"Share",        icon:"🔗" },
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
                <div style={{ fontWeight:800, fontSize:20, color:cs.text }}>{isAr?"برنامج الإحالة":"Referral Program"}</div>
                <div style={{ fontSize:12, color:cs.textDim }}>{isAr?"ادعُ أصدقاءك · اكسب رصيد · انموا مع بعض":"Invite friends · Earn EGP credit · Grow together"}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {[
                { label:isAr?"محوّلة":"Converted", value:totalReferrals, color:"#10b981" },
                { label:isAr?"معلّقة":"Pending",   value:pendingReferrals, color:"#f59e0b" },
                { label:isAr?"الرصيد":"Credit",    value:`${credits} EGP`, color:"#6366f1" },
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
                <div style={{ fontWeight:700, color:cs.text, marginBottom:12, fontSize:14 }}>{isAr?"رابط الإحالة الخاص بك":"Your Referral Link"}</div>
                <div style={{ display:"flex", gap:8 }}>
                  <code style={{ flex:1, background:"rgba(0,0,0,0.25)", padding:"10px 14px", borderRadius:9, color:"#a5f3fc", fontSize:13, wordBreak:"break-all" }}>{loading ? "…" : (refLink || "—")}</code>
                  <button onClick={copy} disabled={!refLink} style={{ background:copied?"#10b981":"linear-gradient(135deg,#10b981,#6366f1)", border:"none", color:"#fff", borderRadius:9, padding:"10px 18px", cursor:refLink?"pointer":"default", fontWeight:700, fontSize:13, whiteSpace:"nowrap", transition:"background .3s", opacity:refLink?1:0.5 }}>
                    {copied ? (isAr?"✓ تم النسخ!":"✓ Copied!") : (isAr?"نسخ الرابط":"Copy Link")}
                  </button>
                </div>
                <div style={{ marginTop:10, fontSize:12, color:cs.textDim }}>
                  {isAr?"الكود:":"Code:"} <b style={{ color:cs.text, fontFamily:"monospace" }}>{refCode || "…"}</b> · {isAr?"من يسجل برابطك يحصل على 50 جنيه رصيد فوراً":"Anyone who signs up with your link gets 50 EGP credit right away"}
                </div>
              </div>

              {/* How it works */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:12, fontSize:14 }}>{isAr?"كيف يعمل":"How It Works"}</div>
                {[
                  { step:1, text:isAr?"شارك رابطك الفريد مع الزملاء أو على السوشيال ميديا":"Share your unique link with colleagues or on social media" },
                  { step:2, text:isAr?"يسجلون برابطك ويحصلون على 50 جنيه رصيد فوراً":"They sign up using your link and get 50 EGP credit immediately" },
                  { step:3, text:isAr?"لما يشتركوا بخطة مدفوعة، إنت تكسب رصيد كمان":"When they become a paying customer, you earn credit too" },
                  { step:4, text:isAr?"الرصيد يُطبَّق تلقائياً في عملية الدفع القادمة":"Credit is applied automatically at your next checkout" },
                ].map(s => (
                  <div key={s.step} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
                    <div style={{ width:22, height:22, borderRadius:"50%", background:"rgba(99,102,241,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#6366f1", flexShrink:0 }}>{s.step}</div>
                    <div style={{ fontSize:12, color:cs.textDim, lineHeight:1.5 }}>{s.text}</div>
                  </div>
                ))}
              </div>

              {/* Your referrals list */}
              <div style={{ background:cs.bg, borderRadius:14, padding:20, border:`1px solid ${cs.border}` }}>
                <div style={{ fontWeight:700, color:cs.text, marginBottom:12, fontSize:14 }}>{isAr?"إحالاتك":"Your Referrals"}</div>
                {loading && <div style={{ fontSize:12, color:cs.textDim }}>{isAr?"جاري التحميل...":"Loading..."}</div>}
                {!loading && referrals.length===0 && <div style={{ fontSize:12, color:cs.textDim }}>{isAr?"لسه مفيش إحالات — شارك رابطك عشان تبدأ":"No referrals yet — share your link to get started"}</div>}
                {!loading && referrals.map(r => (
                  <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${cs.border}` }}>
                    <div style={{ fontSize:12, color:cs.text }}>{r.referred_email || r.referred_uid}</div>
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      {r.earned>0 && <span style={{ fontSize:12, fontWeight:700, color:"#f59e0b" }}>+{r.earned} EGP</span>}
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 9px", borderRadius:20, background:`${STATUS_COLORS[r.status]||cs.border}22`, color:STATUS_COLORS[r.status]||cs.textDim }}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SHARE ── */}
          {tab==="share" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontWeight:700, color:cs.text, fontSize:16 }}>🔗 {isAr?"شارك رابطك":"Share Your Link"}</div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[
                  { id:"email",    label:"📧 Email",    color:"#ea4335", href:shareLinks.email },
                  { id:"linkedin", label:"💼 LinkedIn", color:"#0a66c2", href:shareLinks.linkedin },
                  { id:"twitter",  label:"𝕏 Twitter",   color:"#1da1f2", href:shareLinks.twitter },
                  { id:"whatsapp", label:"💬 WhatsApp", color:"#25d366", href:shareLinks.whatsapp },
                ].map(s => (
                  <a key={s.id} href={refLink?s.href:undefined} target="_blank" rel="noreferrer" style={{ pointerEvents:refLink?"auto":"none", opacity:refLink?1:0.5, textDecoration:"none", display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:`${s.color}12`, border:`1px solid ${s.color}33`, borderRadius:12, padding:18, cursor:"pointer", fontWeight:700, fontSize:14, color:s.color }}>
                    {s.label}
                  </a>
                ))}
              </div>

              {/* Pre-written messages */}
              <div style={{ fontWeight:700, color:cs.text, fontSize:14, marginBottom:4 }}>📝 {isAr?"رسائل جاهزة":"Pre-written Messages"}</div>
              {[
                { label:isAr?"احترافي":"Professional",  text:`I've been using Corvus at work and my neck pain has significantly reduced. It uses AI to monitor and coach your posture in real time. Try it free: ${refLink}` },
                { label:isAr?"عادي":"Casual",           text:`This posture app is actually really good lol. Uses your camera to track posture and gives you AI coaching. Check it out: ${refLink}` },
                { label:isAr?"لمدير الموارد البشرية":"For HR/Managers", text:`If you're looking for a scalable employee wellness tool, Corvus has been great for our team. AI-powered posture monitoring with team dashboards: ${refLink}` },
              ].map(m => (
                <div key={m.label} style={{ background:cs.bg, borderRadius:12, padding:16, border:`1px solid ${cs.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:cs.textDim }}>{m.label}</span>
                    <button onClick={() => { navigator.clipboard?.writeText(m.text).catch(() => {}); }} disabled={!refLink} style={{ background:"transparent", border:`1px solid ${cs.border}`, color:cs.textDim, borderRadius:6, padding:"3px 10px", cursor:refLink?"pointer":"default", fontSize:11 }}>{isAr?"نسخ":"Copy"}</button>
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
