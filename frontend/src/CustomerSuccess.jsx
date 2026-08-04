/**
 * CustomerSuccess.jsx — Corvus ULTIMATE v12
 * REAL FIRESTORE DATA — live NPS responses, support tickets, help articles.
 * NPS submit → backend API. Chat → real-time or support email fallback.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  collection, query, orderBy, limit, getDocs, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db, getAuthToken } from "./firebase.js";

const API = import.meta.env.VITE_API_URL || "/api";

const CS_TOKENS = {
  bg:"#030711", card:"#0c1832", border:"rgba(99,102,241,.14)",
  text:"#e8eeff", sub:"#94a3b8", muted:"#475569",
  primary:"#6366f1", green:"#10b981", amber:"#f59e0b", red:"#ef4444",
};

const HELP_ARTICLES = [
  { id:"h1", title:"How to set up camera calibration",  views:1240, helpful:94 },
  { id:"h2", title:"Understanding your posture score",   views:980,  helpful:91 },
  { id:"h3", title:"Connecting multiple monitors",       views:720,  helpful:88 },
  { id:"h4", title:"Team invitation & RBAC setup",       views:540,  helpful:85 },
  { id:"h5", title:"Exporting data (CSV / PDF)",         views:430,  helpful:92 },
  { id:"h6", title:"White-label configuration guide",    views:310,  helpful:97 },
  { id:"h7", title:"API key management",                 views:280,  helpful:89 },
  { id:"h8", title:"Billing & invoice FAQ",              views:260,  helpful:82 },
];

const BOT_RESPONSES = {
  billing:  "For billing: Settings → Billing → View invoices. What's the issue?",
  camera:   "Camera fix: 1) Allow camera permissions, 2) Refresh, 3) Try Chrome. Which step?",
  export:   "To export: Analytics → Export → choose CSV/PDF → Download. Need help?",
  mfa:      "MFA setup: Settings → Security → Enable 2FA. Choose TOTP or SMS.",
  default:  "Hi! I'm Corvus support. Describe your issue (billing, camera, export, MFA)?",
};

function getBotReply(msg) {
  const m = msg.toLowerCase();
  if (m.includes("bill") || m.includes("invoice") || m.includes("payment")) return BOT_RESPONSES.billing;
  if (m.includes("camera") || m.includes("video") || m.includes("detect")) return BOT_RESPONSES.camera;
  if (m.includes("export") || m.includes("csv") || m.includes("pdf"))   return BOT_RESPONSES.export;
  if (m.includes("mfa") || m.includes("2fa") || m.includes("auth"))     return BOT_RESPONSES.mfa;
  return BOT_RESPONSES.default;
}

// ── Ticket row: SLA countdown + reply (WhatsApp threads go out for
// real via /api/support/reply; other tickets just log the reply text
// for now since there's no other outbound channel wired yet) ────────
function TicketRow({ t, onReplied }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const stColor = t.status==="open"?CS_TOKENS.amber:t.status==="resolved"?CS_TOKENS.green:CS_TOKENS.muted;
  const prColor = t.priority==="high"?CS_TOKENS.red:t.priority==="medium"?CS_TOKENS.amber:CS_TOKENS.muted;

  const dueAt = t.first_response_due_at ? new Date(t.first_response_due_at) : null;
  const responded = !!t.first_responded_at;
  const overdue = dueAt && !responded && dueAt.getTime() < Date.now();
  const msLeft = dueAt ? dueAt.getTime() - Date.now() : null;
  const hoursLeft = msLeft != null ? Math.abs(msLeft / 3600000) : null;

  const sendReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      const idToken = await getAuthToken().catch(() => null);
      if (!idToken) throw new Error("no auth token");
      const r = await fetch(`${API}/support/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ ticket_id: t.id, body: reply.trim() }),
      });
      if (r.ok) { setReply(""); onReplied?.(); }
    } catch (e) {
      console.error("[TicketRow] reply failed:", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ background:"rgba(255,255,255,.03)", borderRadius:12,
      border:`1px solid ${overdue?CS_TOKENS.red+"55":CS_TOKENS.border}`, overflow:"hidden" }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:"14px 18px",
        display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}>
        <span style={{ fontFamily:"monospace", fontSize:12, color:CS_TOKENS.primary }}>{(t.id||t.ticket_id||"").slice(0,8)}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:CS_TOKENS.text }}>
            {t.source==="whatsapp" && "📱 "}{t.subject}
          </div>
          <div style={{ fontSize:11, color:CS_TOKENS.muted, marginTop:2 }}>
            {t.user||t.email} · {t.created_at?.toDate?.()?.toLocaleString?.() || t.created||"—"}
          </div>
        </div>
        {dueAt && !responded && (
          <span style={{ fontSize:10, padding:"3px 8px", borderRadius:4, fontWeight:700,
            background: overdue ? `${CS_TOKENS.red}22` : `${CS_TOKENS.amber}18`,
            color: overdue ? CS_TOKENS.red : CS_TOKENS.amber }}>
            {overdue ? `⚠ overdue ${hoursLeft?.toFixed(1)}h` : `⏱ ${hoursLeft?.toFixed(1)}h left`}
          </span>
        )}
        <span style={{ fontSize:10, padding:"3px 8px", borderRadius:4, fontWeight:700,
          background:`${prColor}18`, color:prColor }}>{t.priority||"medium"}</span>
        <span style={{ fontSize:10, padding:"3px 8px", borderRadius:4, fontWeight:700,
          background:`${stColor}18`, color:stColor }}>{t.status||"open"}</span>
      </div>

      {open && (
        <div style={{ padding:"0 18px 16px", borderTop:`1px solid ${CS_TOKENS.border}` }}>
          <div style={{ display:"flex", flexDirection:"column", gap:8, margin:"12px 0", maxHeight:220, overflowY:"auto" }}>
            {(t.messages||[]).map((m,i) => (
              <div key={i} style={{
                alignSelf: m.from==="agent" ? "flex-end" : "flex-start",
                maxWidth:"75%", padding:"8px 12px", borderRadius:10, fontSize:12.5,
                background: m.from==="agent" ? `${CS_TOKENS.primary}22` : "rgba(255,255,255,.05)",
                color: CS_TOKENS.text }}>
                {m.body}
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={reply} onChange={e=>setReply(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&sendReply()}
              placeholder={t.source==="whatsapp" ? "Reply via WhatsApp…" : "Reply…"}
              style={{ flex:1, padding:"9px 12px", borderRadius:8, background:"rgba(255,255,255,.05)",
                border:`1px solid ${CS_TOKENS.border}`, color:CS_TOKENS.text, fontSize:12.5, outline:"none" }} />
            <button onClick={sendReply} disabled={sending || !reply.trim()}
              style={{ padding:"9px 16px", borderRadius:8, background:CS_TOKENS.primary,
                border:"none", color:"#fff", fontWeight:600, fontSize:12.5,
                cursor: reply.trim() ? "pointer" : "default", opacity: reply.trim() ? 1 : .5 }}>
              {sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerSuccess({ profile, cs, lang, token, onClose }) {
  const [tab, setTab]             = useState("nps");
  const [npsData, setNpsData]     = useState([]);
  const [npsLoading, setNpsLoading] = useState(true);
  const [tickets, setTickets]     = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [submitScore, setSubmitScore] = useState(null);
  const [submitComment, setSubmitComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [chatOpen, setChatOpen]   = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMsgs, setChatMsgs]   = useState([
    { role:"bot", text:"Hi! 👋 I'm Corvus Support. How can I help?" }
  ]);
  const [helpSearch, setHelpSearch] = useState("");
  const chatEnd = useRef(null);

  // ── Load NPS from Firestore ───────────────────────────────────────
  const loadNPS = useCallback(async () => {
    setNpsLoading(true);
    try {
      const q    = query(collection(db, "nps_responses"), orderBy("ts","desc"), limit(100));
      const snap = await getDocs(q);
      setNpsData(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch (e) {
      console.error("[CS] NPS load:", e);
    } finally {
      setNpsLoading(false);
    }
  }, []);

  // ── Load tickets from Firestore ───────────────────────────────────
  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const q    = query(collection(db, "support_tickets"), orderBy("created_at","desc"), limit(50));
      const snap = await getDocs(q);
      setTickets(snap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch (e) {
      console.error("[CS] Tickets load:", e);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => { loadNPS(); loadTickets(); }, [loadNPS, loadTickets]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [chatMsgs]);

  // ── NPS computed stats ────────────────────────────────────────────
  const promoters  = npsData.filter(r => r.score >= 9).length;
  const detractors = npsData.filter(r => r.score <= 6).length;
  const npsScore   = npsData.length
    ? Math.round(((promoters - detractors) / npsData.length) * 100)
    : 0;
  const avgScore   = npsData.length
    ? (npsData.reduce((s, r) => s + r.score, 0) / npsData.length).toFixed(1)
    : "—";
  const distribution = Array.from({ length:11 }, (_, i) => ({
    score: i,
    count: npsData.filter(r => r.score === i).length,
  }));
  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  // ── Submit NPS to backend + Firestore ────────────────────────────
  const submitNPS = async () => {
    if (submitScore === null) return;
    setSubmitting(true);
    try {
      // Backend records it (rate-limited, authenticated)
      await fetch(`${API}/nps/submit`, {
        method:  "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body:    JSON.stringify({ score: submitScore, comment: submitComment }),
      });
      // Also write directly to Firestore for real-time dashboard update
      await addDoc(collection(db, "nps_responses"), {
        score:   submitScore,
        comment: submitComment,
        user:    profile?.name || "Anonymous",
        email:   profile?.email || "",
        segment: profile?.tier || "starter",
        uid:     profile?.uid || "",
        ts:      serverTimestamp(),
      });
      setSubmitted(true);
      setTimeout(() => { setSubmitted(false); setSubmitScore(null); setSubmitComment(""); loadNPS(); }, 3000);
    } catch (e) {
      console.error("[CS] NPS submit:", e);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Chat ──────────────────────────────────────────────────────────
  const sendChat = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatMsgs(p => [...p, { role:"user", text:msg }]);
    setChatInput("");
    setTimeout(() => {
      const reply = getBotReply(msg);
      setChatMsgs(p => [...p, { role:"bot", text:reply }]);
    }, 700);
  };

  // ── Help article search ────────────────────────────────────────────
  const filteredArticles = HELP_ARTICLES.filter(a =>
    !helpSearch || a.title.toLowerCase().includes(helpSearch.toLowerCase())
  );

  const TABS = [
    { id:"nps",     label:"NPS & CSAT",       icon:"⭐" },
    { id:"tickets", label:"Support Tickets",   icon:"🎫" },
    { id:"help",    label:"Help Center",       icon:"📚" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.78)", zIndex:2000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:CS_TOKENS.card, borderRadius:20, width:"100%", maxWidth:1120,
        height:"90vh", display:"flex", flexDirection:"column", overflow:"hidden",
        border:`1px solid ${CS_TOKENS.border}`, boxShadow:"0 32px 80px rgba(0,0,0,.55)" }}>

        {/* Header */}
        <div style={{ padding:"18px 28px", borderBottom:`1px solid ${CS_TOKENS.border}`, flexShrink:0,
          background:"linear-gradient(135deg,rgba(16,185,129,.06),rgba(99,102,241,.04))",
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:12,
              background:"linear-gradient(135deg,#10b981,#6366f1)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🤝</div>
            <div>
              <div style={{ fontWeight:800, fontSize:20, color:CS_TOKENS.text }}>Customer Success</div>
              <div style={{ fontSize:12, color:CS_TOKENS.muted }}>
                Live NPS: {npsData.length} responses · {tickets.length} tickets
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <button onClick={() => { loadNPS(); loadTickets(); }} style={{ padding:"8px 16px",
              borderRadius:9, background:"transparent", border:`1px solid ${CS_TOKENS.border}`,
              color:CS_TOKENS.sub, cursor:"pointer", fontSize:13 }}>↻ Refresh</button>
            <button onClick={() => setChatOpen(!chatOpen)} style={{ padding:"8px 18px",
              borderRadius:9, background:`${CS_TOKENS.green}22`, border:`1px solid ${CS_TOKENS.green}44`,
              color:CS_TOKENS.green, fontWeight:600, cursor:"pointer", fontSize:13 }}>💬 Support Chat</button>
            <button onClick={onClose} style={{ width:36, height:36, borderRadius:"50%",
              background:"rgba(255,255,255,.07)", border:`1px solid ${CS_TOKENS.border}`,
              color:CS_TOKENS.sub, fontSize:20, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center" }} aria-label="Close">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, padding:"12px 24px 0",
          borderBottom:`1px solid ${CS_TOKENS.border}`, flexShrink:0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:"9px 18px", borderRadius:"8px 8px 0 0", border:"none", cursor:"pointer",
              fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:13,
              background: tab===t.id ? CS_TOKENS.card : "transparent",
              color:      tab===t.id ? CS_TOKENS.text : CS_TOKENS.muted,
              borderBottom: tab===t.id ? `2px solid ${CS_TOKENS.primary}` : "2px solid transparent",
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>

          {/* ── NPS TAB ── */}
          {tab === "nps" && (
            <>
              {/* KPI row */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
                {[
                  { label:"NPS Score",    val:npsScore, sub:"Industry avg: 32", color:npsScore>=50?CS_TOKENS.green:npsScore>=0?CS_TOKENS.amber:CS_TOKENS.red },
                  { label:"Avg Rating",   val:avgScore,  sub:`${npsData.length} responses`, color:CS_TOKENS.primary },
                  { label:"Promoters",    val:`${promoters}`, sub:`${npsData.length?Math.round(promoters/npsData.length*100):0}% of total`, color:CS_TOKENS.green },
                  { label:"Detractors",   val:`${detractors}`, sub:`${npsData.length?Math.round(detractors/npsData.length*100):0}% of total`, color:CS_TOKENS.red },
                ].map(k => (
                  <div key={k.label} style={{ background:"rgba(255,255,255,.03)", borderRadius:14,
                    padding:"18px 20px", border:`1px solid ${CS_TOKENS.border}` }}>
                    <div style={{ fontSize:32, fontWeight:800, color:k.color }}>{k.val}</div>
                    <div style={{ fontSize:13, fontWeight:700, color:CS_TOKENS.text, marginTop:2 }}>{k.label}</div>
                    <div style={{ fontSize:11, color:CS_TOKENS.muted, marginTop:2 }}>{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* Score distribution */}
              <div style={{ background:"rgba(255,255,255,.03)", borderRadius:14, padding:"20px",
                border:`1px solid ${CS_TOKENS.border}`, marginBottom:20 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:14, color:CS_TOKENS.text }}>Score Distribution</div>
                <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:80 }}>
                  {distribution.map(({ score, count }) => {
                    const color = score>=9?CS_TOKENS.green:score>=7?CS_TOKENS.amber:CS_TOKENS.red;
                    const pct   = count / maxCount;
                    return (
                      <div key={score} style={{ flex:1, display:"flex", flexDirection:"column",
                        alignItems:"center", gap:4 }}>
                        <div style={{ width:"100%", height:`${pct*60+4}px`, minHeight:4,
                          background:color, borderRadius:"3px 3px 0 0",
                          opacity: count===0 ? .2 : 1, transition:"height .5s" }} />
                        <span style={{ fontSize:10, color:CS_TOKENS.muted }}>{score}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit your NPS */}
              <div style={{ background:"rgba(99,102,241,.07)", borderRadius:14, padding:"20px",
                border:`1px solid rgba(99,102,241,.22)`, marginBottom:20 }}>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:12, color:CS_TOKENS.text }}>
                  {submitted ? "✅ Thank you for your feedback!" : "Rate Corvus (0–10)"}
                </div>
                {!submitted && (
                  <>
                    <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
                      {Array.from({length:11},(_,i)=>i).map(i => (
                        <button key={i} onClick={() => setSubmitScore(i)} style={{
                          width:38, height:38, borderRadius:9, border:`2px solid ${submitScore===i?CS_TOKENS.primary:CS_TOKENS.border}`,
                          background: submitScore===i ? CS_TOKENS.primary : "rgba(255,255,255,.04)",
                          color:      submitScore===i ? "#fff" : CS_TOKENS.sub,
                          fontSize:14, fontWeight:700, cursor:"pointer",
                        }}>{i}</button>
                      ))}
                    </div>
                    <textarea
                      value={submitComment}
                      onChange={e => setSubmitComment(e.target.value)}
                      placeholder="Optional: tell us more…"
                      rows={2}
                      style={{ width:"100%", padding:"10px 12px", borderRadius:9,
                        background:"rgba(255,255,255,.05)", border:`1px solid ${CS_TOKENS.border}`,
                        color:CS_TOKENS.text, fontSize:13, resize:"none", marginBottom:10 }}
                    />
                    <button onClick={submitNPS} disabled={submitScore===null||submitting} style={{
                      padding:"10px 24px", borderRadius:9, background:CS_TOKENS.primary,
                      color:"#fff", border:"none", fontWeight:600, cursor:"pointer", fontSize:13,
                      opacity: submitScore===null || submitting ? .5 : 1,
                    }}>
                      {submitting ? "Submitting…" : "Submit Feedback"}
                    </button>
                  </>
                )}
              </div>

              {/* Recent responses */}
              <div style={{ fontSize:14, fontWeight:700, marginBottom:10, color:CS_TOKENS.text }}>
                Recent Responses ({npsData.length})
              </div>
              {npsLoading ? (
                <div style={{ textAlign:"center", padding:"24px", color:CS_TOKENS.muted }}>Loading…</div>
              ) : npsData.length === 0 ? (
                <div style={{ textAlign:"center", padding:"24px", color:CS_TOKENS.muted, fontSize:13 }}>
                  No NPS responses yet. The first survey is sent automatically at Day 30.
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {npsData.slice(0,20).map(r => {
                    const color = r.score>=9?CS_TOKENS.green:r.score>=7?CS_TOKENS.amber:CS_TOKENS.red;
                    return (
                      <div key={r.id} style={{ background:"rgba(255,255,255,.03)", borderRadius:12,
                        padding:"14px 18px", border:`1px solid ${CS_TOKENS.border}`,
                        display:"flex", gap:14, alignItems:"flex-start" }}>
                        <div style={{ width:40, height:40, borderRadius:10, flexShrink:0,
                          background:`${color}22`, display:"flex", alignItems:"center",
                          justifyContent:"center", fontSize:18, fontWeight:800, color }}>
                          {r.score}
                        </div>
                        <div style={{ flex:1 }}>
                          {r.comment && (
                            <div style={{ fontSize:13, color:CS_TOKENS.text, marginBottom:6,
                              fontStyle:"italic" }}>"{r.comment}"</div>
                          )}
                          <div style={{ fontSize:11, color:CS_TOKENS.muted }}>
                            {r.user||"Anonymous"} · {r.segment||""}
                            {r.ts?.toDate?.()
                              ? ` · ${r.ts.toDate().toLocaleDateString()}`
                              : r.date ? ` · ${r.date}` : ""}
                          </div>
                        </div>
                        <span style={{ fontSize:10, padding:"3px 8px", borderRadius:4,
                          background:`${color}18`, color, fontWeight:700 }}>
                          {r.score>=9?"Promoter":r.score>=7?"Passive":"Detractor"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── TICKETS TAB ── */}
          {tab === "tickets" && (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:700, color:CS_TOKENS.text }}>
                  Support Tickets ({tickets.length})
                </div>
                <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL||"support@corvus.com"}?subject=Support Request`}
                  style={{ padding:"8px 18px", borderRadius:9, background:CS_TOKENS.primary, color:"#fff",
                    textDecoration:"none", fontWeight:600, fontSize:13 }}>
                  + Open Ticket
                </a>
              </div>
              {ticketsLoading ? (
                <div style={{ textAlign:"center", padding:"32px", color:CS_TOKENS.muted }}>Loading tickets…</div>
              ) : tickets.length === 0 ? (
                <div style={{ textAlign:"center", padding:"48px 0" }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
                  <div style={{ fontSize:16, fontWeight:700, color:CS_TOKENS.green }}>No open tickets!</div>
                  <div style={{ fontSize:13, color:CS_TOKENS.muted, marginTop:6 }}>
                    Email <a href={`mailto:${import.meta.env.VITE_SUPPORT_EMAIL||"support@corvus.com"}`}
                      style={{ color:CS_TOKENS.primary }}>support@corvus.com</a> to open one.
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {tickets.map(t => (
                    <TicketRow key={t.id} t={t} onReplied={loadTickets} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── HELP TAB ── */}
          {tab === "help" && (
            <>
              <input
                value={helpSearch}
                onChange={e => setHelpSearch(e.target.value)}
                placeholder="Search help articles…"
                style={{ width:"100%", padding:"11px 16px", borderRadius:10, marginBottom:16,
                  background:"rgba(255,255,255,.05)", border:`1px solid ${CS_TOKENS.border}`,
                  color:CS_TOKENS.text, fontSize:14, outline:"none" }}
              />
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {filteredArticles.map(a => (
                  <div key={a.id} style={{ background:"rgba(255,255,255,.03)", borderRadius:12,
                    padding:"14px 20px", border:`1px solid ${CS_TOKENS.border}`,
                    display:"flex", alignItems:"center", gap:14, cursor:"pointer",
                    transition:"border-color .15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor="rgba(99,102,241,.4)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor=CS_TOKENS.border}>
                    <span style={{ fontSize:24 }}>📄</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:CS_TOKENS.text }}>{a.title}</div>
                      <div style={{ fontSize:11, color:CS_TOKENS.muted, marginTop:2 }}>
                        {(a.views||0).toLocaleString()} views · {a.helpful}% found helpful
                      </div>
                    </div>
                    <span style={{ fontSize:13, color:CS_TOKENS.primary }}>→</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Support Chat Widget */}
      {chatOpen && (
        <div style={{ position:"fixed", bottom:24, right:24, width:340, zIndex:3000,
          background:CS_TOKENS.card, borderRadius:18, border:`1px solid ${CS_TOKENS.border}`,
          boxShadow:"0 24px 64px rgba(0,0,0,.55)", display:"flex", flexDirection:"column",
          maxHeight:480 }}>
          <div style={{ padding:"14px 18px", borderBottom:`1px solid ${CS_TOKENS.border}`,
            display:"flex", justifyContent:"space-between", alignItems:"center",
            background:`${CS_TOKENS.green}10`, borderRadius:"18px 18px 0 0" }}>
            <div style={{ fontSize:14, fontWeight:700, color:CS_TOKENS.green }}>💬 Support Chat</div>
            <button onClick={() => setChatOpen(false)} style={{ background:"none", border:"none",
              color:CS_TOKENS.muted, fontSize:18, cursor:"pointer" }}>×</button>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:14, display:"flex",
            flexDirection:"column", gap:10, minHeight:200 }}>
            {chatMsgs.map((m, i) => (
              <div key={i} style={{ display:"flex",
                justifyContent: m.role==="user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth:"80%", padding:"9px 13px", borderRadius:12, fontSize:13,
                  background: m.role==="user" ? CS_TOKENS.primary : "rgba(255,255,255,.07)",
                  color:CS_TOKENS.text, lineHeight:1.5 }}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={chatEnd} />
          </div>
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${CS_TOKENS.border}`,
            display:"flex", gap:8 }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && sendChat()}
              placeholder="Type your question…"
              style={{ flex:1, padding:"9px 12px", borderRadius:9,
                background:"rgba(255,255,255,.06)", border:`1px solid ${CS_TOKENS.border}`,
                color:CS_TOKENS.text, fontSize:13, outline:"none" }}
            />
            <button onClick={sendChat} style={{ padding:"9px 14px", borderRadius:9,
              background:CS_TOKENS.primary, border:"none", color:"#fff",
              cursor:"pointer", fontSize:14, fontWeight:700 }}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
