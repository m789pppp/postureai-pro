/**
 * Corvus — Notifications & Integrations Hub v3.0
 * Real-time Firestore · Smart Queue · Slack/Teams/Jira · AI Alerts
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { geminiAnalysis } from "./gemini.js";
import { getAuthToken } from "./firebase.js";
import {
  db, doc, getDoc, setDoc, addDoc, updateDoc, collection,
  query, where, orderBy, limit, onSnapshot, getDocs,
} from "./firebase.js";

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────
const C = {
  bg:     "#04080e",
  surf:   "#080f1a",
  card:   "#0b1420",
  cardH:  "#0e1929",
  border: "rgba(56,139,253,.1)",
  borderB:"rgba(56,139,253,.22)",
  text:   "#e6edf3",
  text2:  "#8b949e",
  muted:  "#6e7681",
  blue:   "#388bfd",
  teal:   "#06b6d4",
  green:  "#3fb950",
  amber:  "#d29922",
  red:    "#f85149",
  purple: "#a78bfa",
  spring: "cubic-bezier(.16,1,.3,1)",
};

const GLOBAL_CSS = `
  @keyframes nhIn  { from { opacity:0; transform:translateY(20px) scale(.96) } to { opacity:1; transform:none } }
  @keyframes nhFd  { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
  @keyframes nhPls { 0%  { transform:scale(1);opacity:.9 } 100% { transform:scale(3.5);opacity:0 } }
  @keyframes nhSpin{ to  { transform:rotate(360deg) } }
  @keyframes nhShm { 0%  { background-position:-400% 0 } 100% { background-position:400% 0 } }
  @keyframes nhSlide{ from{ opacity:0;max-height:0;transform:translateY(-8px) } to{ opacity:1;max-height:2000px;transform:none } }
  .nh-scroll::-webkit-scrollbar { width:3px }
  .nh-scroll::-webkit-scrollbar-thumb { background:rgba(56,139,253,.2);border-radius:99px }
  .nh-scroll::-webkit-scrollbar-track { background:transparent }
  .nh-card { transition:background 150ms,border-color 150ms,transform 120ms }
  .nh-card:hover { background:rgba(14,25,41,.95) !important; border-color:rgba(56,139,253,.22) !important }
  .nh-tab { transition:color 150ms,border-color 150ms }
  .nh-btn { transition:all 180ms cubic-bezier(.16,1,.3,1) }
  .nh-btn:hover:not(:disabled) { filter:brightness(1.12); transform:translateY(-1px) }
  .nh-btn:active:not(:disabled) { transform:scale(.97) }
  .nh-chip { transition:all 150ms }
  .nh-chip:hover { border-color:rgba(56,139,253,.4) !important; background:rgba(56,139,253,.1) !important }
`;

// ─────────────────────────────────────────────────────────────
// NOTIFICATION TYPES
// ─────────────────────────────────────────────────────────────
const NTYPES = {
  burnout_alert:    { icon:"🔥", label:"Burnout Alert",     labelAr:"تنبيه إنهاك",    color:"#f85149", pri:1 },
  risk_alert:       { icon:"🚨", label:"Risk Alert",        labelAr:"تنبيه خطر",       color:"#f85149", pri:1 },
  posture_warning:  { icon:"⚠️", label:"Posture Warning",   labelAr:"تحذير وضعية",    color:"#d29922", pri:2 },
  gdpr_request:     { icon:"🛡️", label:"GDPR Request",      labelAr:"طلب بيانات",     color:"#06b6d4", pri:1 },
  ai_insight:       { icon:"🧠", label:"AI Insight",        labelAr:"رؤية AI",         color:"#a78bfa", pri:3 },
  weekly_digest:    { icon:"📊", label:"Weekly Digest",     labelAr:"ملخص أسبوعي",    color:"#388bfd", pri:3 },
  achievement:      { icon:"🏆", label:"Achievement",       labelAr:"إنجاز",           color:"#3fb950", pri:4 },
  session_reminder: { icon:"⏰", label:"Session Reminder",  labelAr:"تذكير جلسة",     color:"#06b6d4", pri:4 },
  team_milestone:   { icon:"🎯", label:"Team Milestone",    labelAr:"إنجاز الفريق",   color:"#3fb950", pri:4 },
};

const mkEntry = (type, payload, channels = ["in_app"], scheduledFor = null) => ({
  id: "q_" + Date.now() + "_" + Math.random().toString(36).slice(2,7),
  type, payload, channels,
  status: scheduledFor ? "scheduled" : "queued",
  priority: NTYPES[type]?.pri || 5,
  attempts: 0, maxAttempts: 3,
  created_at: new Date().toISOString(),
  scheduled_for: scheduledFor,
  sent_at: null, error: null,
});

// ─────────────────────────────────────────────────────────────
// DISPATCH QUEUE (singleton)
// ─────────────────────────────────────────────────────────────
class DispatchQueue {
  constructor() { this._q = []; this._running = false; this._subs = new Set(); }
  subscribe(fn) { this._subs.add(fn); fn([...this._q]); return () => this._subs.delete(fn); }
  _emit() { this._subs.forEach(fn => fn([...this._q])); }

  enqueue(e) {
    this._q.push(e);
    this._q.sort((a,b) => a.priority - b.priority);
    this._emit();
    if (!this._running) this._run();
  }

  async _run() {
    const ready = this._q.filter(e =>
      e.status === "queued" &&
      (!e.scheduled_for || new Date(e.scheduled_for) <= new Date())
    );
    if (!ready.length) { this._running = false; return; }
    this._running = true;
    const e = ready[0];
    e.status = "processing"; this._emit();
    try {
      await this._dispatch(e);
      e.status = "sent"; e.sent_at = new Date().toISOString();
    } catch (err) {
      e.attempts++;
      e.error = err.message;
      e.status = e.attempts >= e.maxAttempts ? "failed" : "queued";
      if (e.status === "queued")
        setTimeout(() => this._run(), 1000 * Math.pow(2, e.attempts));
    }
    this._emit();
    setTimeout(() => this._run(), 150);
  }

  async _dispatch(entry) {
    let token = null;
    try { token = await getAuthToken(); } catch(_) {}
    const res = await fetch("/api/notify/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: JSON.stringify(entry),
      signal: AbortSignal.timeout(14000),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "http_" + res.status);
    }
    const d = await res.json();
    (d.results || []).filter(r => !r.ok).forEach(r => console.warn("[Queue]", r.channel, r.error));
  }

  retry(id) {
    const e = this._q.find(e => e.id === id);
    if (e) { e.status = "queued"; e.attempts = 0; e.error = null; this._emit(); this._run(); }
  }
  remove(id) { this._q = this._q.filter(e => e.id !== id); this._emit(); }
  get all() { return [...this._q]; }
  get pending() { return this._q.filter(e => ["queued","scheduled","processing"].includes(e.status)); }
}

const Q = new DispatchQueue();

// ─────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ─────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const map = {
    connected:    { c: C.green,  pulse: true  },
    testing:      { c: C.amber,  pulse: true  },
    error:        { c: C.red,    pulse: false },
    disconnected: { c: C.muted,  pulse: false },
  };
  const s = map[status] || map.disconnected;
  return (
    <div style={{ position:"relative", width:8, height:8, flexShrink:0 }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:s.c, position:"absolute" }}/>
      {s.pulse && <div style={{ width:8, height:8, borderRadius:"50%", background:s.c, position:"absolute", animation:"nhPls 1.8s ease-out infinite", opacity:.8 }}/>}
    </div>
  );
}

function Chip({ label, color, onRemove }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:9.5, padding:"2px 9px", borderRadius:99,
      background: (color||C.blue) + "12", border:`1px solid ${(color||C.blue)}25`, color:color||C.blue, fontWeight:700, whiteSpace:"nowrap" }}>
      {label}
      {onRemove && <span onClick={onRemove} style={{ cursor:"pointer", opacity:.6, fontSize:10, lineHeight:1 }}>✕</span>}
    </span>
  );
}

function NBtn({ children, onClick, variant="primary", size="md", disabled=false, loading=false, icon, style:sx={} }) {
  const sizes = { xs:"4px 9px", sm:"6px 13px", md:"9px 16px", lg:"11px 22px" };
  const fonts = { xs:10, sm:11, md:12, lg:13 };
  const styles = {
    primary: { background:"linear-gradient(135deg,#1158c7,#0891b2)", color:"#fff", border:"none", boxShadow:"0 4px 12px rgba(17,88,199,.35)" },
    ghost:   { background:"transparent", color:C.text2, border:`1px solid ${C.border}` },
    danger:  { background:"rgba(248,81,73,.07)", color:C.red, border:"1px solid rgba(248,81,73,.18)" },
    success: { background:"rgba(63,185,80,.07)", color:C.green, border:"1px solid rgba(63,185,80,.18)" },
    subtle:  { background:C.card, color:C.text2, border:`1px solid ${C.border}` },
  };
  const v = styles[variant] || styles.primary;
  return (
    <button className="nh-btn" onClick={disabled||loading ? undefined : onClick} disabled={disabled||loading}
      style={{ display:"inline-flex", alignItems:"center", gap:5, padding:sizes[size], fontSize:fonts[size],
        fontWeight:700, borderRadius:8, cursor:disabled||loading?"not-allowed":"pointer", opacity:disabled?.42:1,
        fontFamily:"inherit", whiteSpace:"nowrap", ...v, ...sx }}>
      {loading
        ? <span style={{ animation:"nhSpin 600ms linear infinite", display:"inline-block", lineHeight:1 }}>⟳</span>
        : icon && <span style={{ fontSize:"1.1em" }}>{icon}</span>}
      {children}
    </button>
  );
}

function NInput({ label, value, onChange, placeholder, type="text", hint, error }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <div style={{ fontSize:10, fontWeight:700, color:C.text2, textTransform:"uppercase",
        letterSpacing:".05em", marginBottom:5 }}>{label}</div>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width:"100%", padding:"8px 12px", background:C.surf,
          border:`1.5px solid ${error ? C.red : focused ? C.blue : C.border}`,
          borderRadius:8, color:C.text, fontSize:12, outline:"none",
          fontFamily:"inherit", boxSizing:"border-box",
          boxShadow: focused ? `0 0 0 3px ${error ? "rgba(248,81,73,.1)" : "rgba(56,139,253,.1)"}` : "none",
          transition:"border-color 150ms, box-shadow 150ms" }}/>
      {(hint||error) && <div style={{ fontSize:10, color:error?C.red:C.muted, marginTop:4 }}>{error||hint}</div>}
    </div>
  );
}

function NToggle({ value, onChange, label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={() => onChange(!value)}>
      <div style={{ width:36, height:19, borderRadius:99, position:"relative",
        background: value ? C.blue : "rgba(110,118,129,.25)",
        border:`1px solid ${value ? C.blue : "rgba(110,118,129,.3)"}`,
        transition:"background 180ms, border-color 180ms", flexShrink:0 }}>
        <div style={{ position:"absolute", top:2, left: value ? 18 : 2, width:13, height:13, borderRadius:"50%",
          background:"#fff", transition:`left 180ms ${C.spring}`, boxShadow:"0 1px 4px rgba(0,0,0,.4)" }}/>
      </div>
      {label && <span style={{ fontSize:11, color:C.text2, fontWeight:500, userSelect:"none" }}>{label}</span>}
    </div>
  );
}

function Shimmer({ lines=3 }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {Array.from({length:lines}).map((_,i) => (
        <div key={i} style={{ height:12, width:`${65+i*10%30}%`, borderRadius:6,
          background:"linear-gradient(90deg,rgba(56,139,253,.04) 0%,rgba(56,139,253,.1) 50%,rgba(56,139,253,.04) 100%)",
          backgroundSize:"400% 100%", animation:"nhShm 1.6s ease infinite", animationDelay:`${i*.1}s` }}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: FEED  (real-time Firestore)
// ─────────────────────────────────────────────────────────────
function FeedTab({ profile, isAr }) {
  const [notifs, setNotifs]   = useState(null); // null = loading
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [expanded, setExpanded] = useState(null);

  // Real-time Firestore listener
  useEffect(() => {
    const uid = profile?.uid || profile?.id;
    if (!uid) {
      // Fallback demo data when no uid
      setNotifs([
        { id:"d1", type:"burnout_alert",   icon:"🔥", title:isAr?"تنبيه إنهاك":"Burnout Risk Alert",    body:isAr?"مؤشر الإرهاق 76%":"Fatigue index at 76% — consider a break",     color:"#f85149", read:false, created_at:new Date(Date.now()-900000).toISOString(),   actions:[{label:"View",key:"view"},{label:"Dismiss",key:"dismiss"}] },
        { id:"d2", type:"achievement",     icon:"🏆", title:isAr?"إنجاز جديد":"New Achievement!",        body:isAr?"٧ أيام متتالية 🔥":"7-day streak — keep it up!",                  color:"#3fb950", read:false, created_at:new Date(Date.now()-3600000).toISOString(),  actions:[{label:"Share",key:"share"}] },
        { id:"d3", type:"ai_insight",      icon:"🧠", title:isAr?"رؤية Corvus AI":"AI Insight",          body:isAr?"وضعيتك تحسّنت 8% هذا الأسبوع":"Posture improved 8% this week 💪", color:"#a78bfa", read:false, created_at:new Date(Date.now()-7200000).toISOString(),  actions:[{label:"Details",key:"view"}] },
        { id:"d4", type:"weekly_digest",   icon:"📊", title:isAr?"ملخصك الأسبوعي":"Weekly Digest",      body:isAr?"٧٩/١٠٠ · ٥ جلسات · أفضل يوم: الأربعاء":"79/100 · 5 sessions · Best: Wednesday", color:"#388bfd", read:true, created_at:new Date(Date.now()-86400000).toISOString(), actions:[{label:"Full Report",key:"report"}] },
        { id:"d5", type:"posture_warning", icon:"⚠️", title:isAr?"تحذير وضعية":"Posture Warning",       body:isAr?"درجتك انخفضت ١٢ نقطة اليوم":"Score dropped 12pts today — check your setup", color:"#d29922", read:true, created_at:new Date(Date.now()-172800000).toISOString(), actions:[{label:"Check Setup",key:"setup"}] },
        { id:"d6", type:"session_reminder",icon:"⏰", title:isAr?"وقت جلستك":"Session Reminder",        body:isAr?"حان وقت جلسة وضعيتك اليومية":"Time for your daily posture session!",   color:"#06b6d4", read:true, created_at:new Date(Date.now()-259200000).toISOString(), actions:[{label:"Start",key:"start"}] },
      ]);
      return;
    }

    const q = query(
      collection(db, "users", uid, "notifications"),
      orderBy("created_at", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      if (items.length === 0) {
        // Show demo data for new users
        setNotifs([
          { id:"d1", type:"ai_insight", icon:"🧠", title:"Welcome to Corvus!", body:"Your AI health coach is ready. Start a posture session to get personalized insights.", color:"#a78bfa", read:false, created_at:new Date().toISOString(), actions:[{label:"Start Session",key:"start"}] },
        ]);
      } else {
        setNotifs(items);
      }
    }, () => setNotifs([]));

    return unsub;
  }, [profile?.uid]);

  const markRead = async (id) => {
    setNotifs(p => p.map(n => n.id === id ? {...n, read:true} : n));
    const uid = profile?.uid || profile?.id;
    if (uid && !id.startsWith("d")) {
      updateDoc(doc(db, "users", uid, "notifications", id), { read:true }).catch(() => {});
    }
  };

  const dismiss = async (id) => {
    setNotifs(p => p.filter(n => n.id !== id));
  };

  const markAll = () => setNotifs(p => p.map(n => ({...n, read:true})));

  const timeAgo = (iso) => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return isAr ? "الآن" : "now";
    if (s < 3600) return isAr ? `${Math.round(s/60)}د` : `${Math.round(s/60)}m`;
    if (s < 86400) return isAr ? `${Math.round(s/3600)}س` : `${Math.round(s/3600)}h`;
    if (s < 604800) return isAr ? `${Math.round(s/86400)}ي` : `${Math.round(s/86400)}d`;
    return new Date(iso).toLocaleDateString("en-GB", {day:"numeric",month:"short"});
  };

  const filtered = useMemo(() => {
    if (!notifs) return [];
    return notifs.filter(n => {
      if (filter === "unread" && n.read) return false;
      if (filter !== "all" && filter !== "unread" && n.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (n.title||"").toLowerCase().includes(q) || (n.body||"").toLowerCase().includes(q);
      }
      return true;
    });
  }, [notifs, filter, search]);

  const unread = (notifs||[]).filter(n => !n.read).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Header row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <span style={{ fontFamily:"'Syne',system-ui,sans-serif", fontSize:15, fontWeight:800, color:C.text }}>
            {isAr ? "الإشعارات" : "Notifications"}
          </span>
          {unread > 0 && (
            <span style={{ background:C.red, borderRadius:99, padding:"2px 9px", fontSize:10, fontWeight:800, color:"#fff",
              animation:"nhPls 2s ease-out infinite" }}>
              {unread}
            </span>
          )}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          {/* Type filter */}
          <div style={{ display:"flex", gap:4 }}>
            {["all","unread"].map(f => (
              <button key={f} className="nh-chip" onClick={() => setFilter(f)} style={{
                padding:"4px 12px", borderRadius:99, cursor:"pointer", fontSize:11, fontWeight:700,
                background: filter===f ? "rgba(56,139,253,.12)" : "transparent",
                border:`1px solid ${filter===f ? "rgba(56,139,253,.3)" : C.border}`,
                color: filter===f ? C.blue : C.muted,
              }}>
                {f === "all" ? (isAr?"الكل":"All") : (isAr?"غير مقروء":"Unread")}
              </button>
            ))}
          </div>
          <NBtn size="sm" variant="ghost" onClick={markAll}>{isAr?"تحديد الكل":"Mark all read"}</NBtn>
        </div>
      </div>

      {/* Search */}
      <div style={{ position:"relative" }}>
        <span style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", fontSize:13, color:C.muted, pointerEvents:"none", zIndex:1 }}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={isAr ? "بحث في الإشعارات..." : "Search notifications..."}
          style={{ width:"100%", padding:"9px 12px 9px 35px", background:C.surf,
            border:`1px solid ${C.border}`, borderRadius:10, color:C.text,
            fontSize:12, outline:"none", boxSizing:"border-box",
            transition:"border-color 150ms" }}/>
      </div>

      {/* Type pills */}
      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
        {Object.entries(NTYPES).slice(0,6).map(([k,v]) => (
          <button key={k} className="nh-chip" onClick={() => setFilter(filter===k?"all":k)} style={{
            padding:"3px 11px", borderRadius:99, cursor:"pointer", fontSize:10, fontWeight:700,
            background: filter===k ? `${v.color}18` : "transparent",
            border:`1px solid ${filter===k ? v.color+"40" : C.border}`,
            color: filter===k ? v.color : C.muted, display:"flex", alignItems:"center", gap:4,
          }}>
            {v.icon} {isAr ? v.labelAr : v.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="nh-scroll" style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:440, overflowY:"auto" }}>
        {notifs === null && <Shimmer lines={5}/>}

        {notifs !== null && filtered.length === 0 && (
          <div style={{ padding:"52px 24px", textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🎉</div>
            <div style={{ fontSize:13, color:C.muted }}>{isAr ? "لا توجد إشعارات" : "You're all caught up!"}</div>
          </div>
        )}

        {filtered.map((n, i) => {
          const isOpen = expanded === n.id;
          const meta   = NTYPES[n.type] || { icon:"🔔", color:C.blue };
          const color  = n.color || meta.color || C.blue;

          return (
            <div key={n.id} className="nh-card" onClick={() => { markRead(n.id); setExpanded(isOpen ? null : n.id); }}
              style={{ background: n.read ? C.card : `${color}08`,
                border:`1px solid ${n.read ? C.border : color+"25"}`,
                borderRadius:12, padding:"13px 15px", cursor:"pointer",
                position:"relative", overflow:"hidden",
                animation:`nhFd 220ms ${Math.min(i*.04,.2)}s both` }}>

              {/* Unread left bar */}
              {!n.read && (
                <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3,
                  background:`linear-gradient(180deg,${color},${color}80)`, borderRadius:"0 2px 2px 0" }}/>
              )}

              <div style={{ display:"flex", gap:11, alignItems:"flex-start" }}>
                {/* Icon */}
                <div style={{ width:40, height:40, borderRadius:11, background:`${color}14`,
                  border:`1px solid ${color}22`, display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:19, flexShrink:0 }}>
                  {n.icon || meta.icon}
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  {/* Title row */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                    <span style={{ fontFamily:"'Syne',system-ui,sans-serif", fontSize:12, fontWeight:800,
                      color: n.read ? C.text2 : C.text }}>
                      {n.title}
                    </span>
                    <div style={{ display:"flex", gap:5, alignItems:"center", flexShrink:0 }}>
                      <span style={{ fontSize:10, color:C.muted, whiteSpace:"nowrap" }}>{timeAgo(n.created_at)}</span>
                      {!n.read && <div style={{ width:7, height:7, borderRadius:"50%", background:color }}/>}
                      <button onClick={e=>{e.stopPropagation();dismiss(n.id);}} style={{
                        background:"none", border:"none", color:C.muted, cursor:"pointer",
                        fontSize:13, padding:"0 3px", lineHeight:1, opacity:.6,
                      }}>✕</button>
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ fontSize:12, color:n.read?C.muted:C.text2, lineHeight:1.6, marginTop:3 }}>
                    {n.body}
                  </div>

                  {/* Expanded content */}
                  {isOpen && n.detail && (
                    <div style={{ marginTop:9, padding:"10px 13px", background:"rgba(255,255,255,.03)",
                      border:`1px solid ${C.border}`, borderRadius:9, fontSize:11, color:C.text2, lineHeight:1.65,
                      animation:"nhSlide 220ms ease both" }}>
                      {n.detail}
                    </div>
                  )}

                  {/* Actions */}
                  {(n.actions||[]).length > 0 && (
                    <div style={{ display:"flex", gap:5, marginTop:9 }}>
                      {n.actions.map(a => (
                        <button key={a.key} onClick={e=>{e.stopPropagation();markRead(n.id);}} style={{
                          fontSize:10, padding:"3px 11px", borderRadius:6, cursor:"pointer", fontWeight:700,
                          background:`${color}12`, border:`1px solid ${color}28`, color, transition:"all 150ms",
                        }}>{a.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: QUEUE
// ─────────────────────────────────────────────────────────────
function QueueTab({ isAr }) {
  const [items,   setItems]   = useState([]);
  const [filter,  setFilter]  = useState("all");
  const [compose, setCompose] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = Q.subscribe(setItems);
    // Seed demo if empty
    if (Q.all.length === 0) {
      [
        { type:"burnout_alert",  payload:{ user:"Ahmed M.", score:72, dept:"Engineering" }, channels:["slack","in_app"] },
        { type:"weekly_digest",  payload:{ period:"This week" }, channels:["slack","email"], scheduled_for:new Date(Date.now()+7200000).toISOString() },
        { type:"ai_insight",     payload:{ text:"Posture improved 8% this week" }, channels:["in_app"] },
        { type:"risk_alert",     payload:{ user:"Omar K.", risk:78 }, channels:["slack","jira"] },
      ].forEach(s => Q.enqueue(mkEntry(s.type, s.payload, s.channels, s.scheduled_for||null)));
    }
    return unsub;
  }, []);

  const stats = useMemo(() => ({
    all:       items.length,
    queued:    items.filter(i=>i.status==="queued").length,
    sent:      items.filter(i=>i.status==="sent").length,
    scheduled: items.filter(i=>i.status==="scheduled").length,
    failed:    items.filter(i=>i.status==="failed").length,
    processing:items.filter(i=>i.status==="processing").length,
  }), [items]);

  const SC = { queued:C.amber, processing:C.blue, sent:C.green, failed:C.red, scheduled:C.purple };
  const SL = { queued:isAr?"انتظار":"Queued", processing:isAr?"إرسال":"Sending",
    sent:isAr?"تم":"Sent", failed:isAr?"فشل":"Failed", scheduled:isAr?"مجدول":"Scheduled" };

  const filtered = filter==="all" ? items : items.filter(i=>i.status===filter);

  const sendTest = async () => {
    setSending(true);
    Q.enqueue(mkEntry("ai_insight", { text:"Corvus test — "+new Date().toLocaleString("en-GB") }, ["in_app","slack"]));
    await new Promise(r=>setTimeout(r,400));
    setSending(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
        {[
          {k:"all",       l:isAr?"الكل":"Total",     c:C.text2 },
          {k:"queued",    l:isAr?"انتظار":"Queued",   c:C.amber },
          {k:"sent",      l:isAr?"تم":"Sent",         c:C.green },
          {k:"scheduled", l:isAr?"مجدول":"Scheduled", c:C.purple},
          {k:"failed",    l:isAr?"فشل":"Failed",      c:C.red   },
        ].map(m => (
          <div key={m.k} onClick={()=>setFilter(m.k)} className="nh-card" style={{
            background:`${m.c}07`, border:`1px solid ${filter===m.k ? m.c+"40" : m.c+"15"}`,
            borderRadius:12, padding:"12px 8px", textAlign:"center", cursor:"pointer",
          }}>
            <div style={{ fontFamily:"'Syne',system-ui,sans-serif", fontSize:24, fontWeight:900, color:m.c, lineHeight:1 }}>{stats[m.k]}</div>
            <div style={{ fontSize:9, color:C.muted, marginTop:5, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em" }}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div style={{ display:"flex", gap:7, justifyContent:"space-between", alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {Object.entries(SL).map(([k,v]) => (
            <button key={k} className="nh-chip" onClick={()=>setFilter(k)} style={{
              padding:"4px 11px", borderRadius:99, cursor:"pointer", fontSize:11, fontWeight:700,
              background:filter===k?"rgba(56,139,253,.1)":"transparent",
              border:`1px solid ${filter===k?"rgba(56,139,253,.3)":C.border}`,
              color:filter===k?C.blue:C.muted,
            }}>{v}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <NBtn size="sm" variant="subtle" icon="✏️" onClick={()=>setCompose(!compose)}>{isAr?"إنشاء":"Compose"}</NBtn>
          <NBtn size="sm" variant="primary" icon="▶" loading={sending} onClick={sendTest}>{isAr?"إرسال اختبار":"Send Test"}</NBtn>
        </div>
      </div>

      {/* Compose panel */}
      {compose && <ComposePanel isAr={isAr} onSend={e=>{Q.enqueue(e);setCompose(false);}} onClose={()=>setCompose(false)}/>}

      {/* Queue table */}
      <div style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"28px 1fr 130px 110px 55px 60px",
          padding:"8px 14px", borderBottom:`1px solid ${C.border}`, background:"rgba(255,255,255,.018)" }}>
          {["","Notification","Channels","Status","Tries",""].map((h,i) => (
            <div key={i} style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:C.muted }}>
              {isAr&&h==="Notification"?"التنبيه":isAr&&h==="Channels"?"القنوات":isAr&&h==="Status"?"الحالة":isAr&&h==="Tries"?"المحاولات":h}
            </div>
          ))}
        </div>

        <div className="nh-scroll" style={{ maxHeight:320, overflowY:"auto" }}>
          {filtered.length === 0 && (
            <div style={{ padding:"32px", textAlign:"center", fontSize:12, color:C.muted }}>
              {isAr ? "الطابور فارغ" : "Queue is empty"}
            </div>
          )}
          {filtered.map((item, i) => {
            const meta = NTYPES[item.type] || { icon:"●", label:item.type, color:C.muted };
            return (
              <div key={item.id} className="nh-card" style={{
                display:"grid", gridTemplateColumns:"28px 1fr 130px 110px 55px 60px",
                padding:"10px 14px", borderBottom:i<filtered.length-1?`1px solid ${C.border}`:"none",
                alignItems:"center", background:C.surf,
              }}>
                <span style={{ fontSize:15 }}>{meta.icon}</span>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:C.text }}>{isAr?meta.labelAr||meta.label:meta.label}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {item.payload?.user && item.payload.user + " · "}
                    {item.payload?.text || item.payload?.period || ""}
                    {item.error && <span style={{ color:C.red }}> ✕ {item.error.slice(0,40)}</span>}
                    {item.scheduled_for && item.status==="scheduled" &&
                      " · 🕐 " + new Date(item.scheduled_for).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                  </div>
                </div>
                <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                  {(item.channels||[]).map(ch => <Chip key={ch} label={ch} color={C.blue}/>)}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <StatusDot status={item.status==="sent"?"connected":item.status==="failed"?"error":item.status==="processing"?"testing":"disconnected"}/>
                  <span style={{ fontSize:10, fontWeight:700, color:SC[item.status]||C.muted }}>{SL[item.status]||item.status}</span>
                </div>
                <div style={{ fontSize:10, color:C.muted, textAlign:"center" }}>{item.attempts}/{item.maxAttempts}</div>
                <div style={{ display:"flex", gap:3 }}>
                  {item.status==="failed" && (
                    <button onClick={()=>Q.retry(item.id)} style={{ fontSize:10, padding:"2px 7px", borderRadius:5,
                      background:"rgba(56,139,253,.1)", border:"1px solid rgba(56,139,253,.2)",
                      color:C.blue, cursor:"pointer", fontWeight:700 }}>↺</button>
                  )}
                  <button onClick={()=>Q.remove(item.id)} style={{ fontSize:10, padding:"2px 7px", borderRadius:5,
                    background:"rgba(248,81,73,.07)", border:"1px solid rgba(248,81,73,.18)",
                    color:C.red, cursor:"pointer", fontWeight:700 }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ComposePanel({ isAr, onSend, onClose }) {
  const [type,     setType]     = useState("ai_insight");
  const [text,     setText]     = useState("");
  const [channels, setChannels] = useState(["in_app"]);
  const [schedule, setSchedule] = useState("");
  const ALL = ["in_app","slack","teams","email","jira"];

  const send = () => { if (!text.trim()) return; onSend(mkEntry(type, {text}, channels, schedule||null)); };

  return (
    <div style={{ background:C.card, border:`1px solid ${C.borderB}`, borderRadius:14, padding:18,
      animation:"nhSlide 220ms ease both" }}>
      <div style={{ fontFamily:"'Syne',system-ui,sans-serif", fontSize:13, fontWeight:800, color:C.text, marginBottom:14 }}>
        {isAr ? "إنشاء إشعار" : "Compose Notification"}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:C.text2, textTransform:"uppercase", letterSpacing:".05em", marginBottom:5 }}>
            {isAr?"النوع":"Type"}
          </div>
          <select value={type} onChange={e=>setType(e.target.value)}
            style={{ width:"100%", padding:"8px 12px", background:C.surf, border:`1.5px solid ${C.border}`,
              borderRadius:8, color:C.text, fontSize:12, outline:"none" }}>
            {Object.entries(NTYPES).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
          <NInput label={isAr?"جدول (اختياري)":"Schedule (optional)"} type="datetime-local" value={schedule}
            onChange={e=>setSchedule(e.target.value)} hint={isAr?"فارغ = فوري":"Empty = immediate"}/>
        </div>
      </div>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:10, fontWeight:700, color:C.text2, textTransform:"uppercase", letterSpacing:".05em", marginBottom:5 }}>
          {isAr?"الرسالة":"Message"}
        </div>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={3}
          placeholder={isAr?"اكتب رسالتك...":"Write your message..."}
          style={{ width:"100%", padding:"9px 12px", background:C.surf, border:`1.5px solid ${C.border}`,
            borderRadius:8, color:C.text, fontSize:12, outline:"none", resize:"vertical",
            fontFamily:"inherit", boxSizing:"border-box" }}/>
      </div>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:C.text2, textTransform:"uppercase", letterSpacing:".05em", marginBottom:7 }}>
          {isAr?"القنوات":"Channels"}
        </div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {ALL.map(ch => {
            const on = channels.includes(ch);
            return (
              <button key={ch} className="nh-chip" onClick={()=>setChannels(p=>on?p.filter(c=>c!==ch):[...p,ch])} style={{
                padding:"4px 12px", borderRadius:99, cursor:"pointer", fontSize:11, fontWeight:700,
                background:on?"rgba(56,139,253,.12)":"transparent",
                border:`1px solid ${on?"rgba(56,139,253,.3)":C.border}`,
                color:on?C.blue:C.muted,
              }}>{on?"✓ ":""}{ch}</button>
            );
          })}
        </div>
      </div>
      <div style={{ display:"flex", gap:7, justifyContent:"flex-end" }}>
        <NBtn variant="ghost" size="sm" onClick={onClose}>{isAr?"إلغاء":"Cancel"}</NBtn>
        <NBtn variant="primary" size="sm" icon="▶" onClick={send} disabled={!text.trim()}>
          {isAr?"أضف للطابور":"Add to Queue"}
        </NBtn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: INTEGRATIONS
// ─────────────────────────────────────────────────────────────
const INTEGRATIONS = {
  slack: { id:"slack", name:"Slack", icon:"💬", color:"#4A154B",
    desc:"Send real-time alerts to Slack channels",
    descAr:"إرسال تنبيهات فورية لقنوات Slack",
    fields:[
      { key:"webhook_url", label:"Webhook URL", labelAr:"رابط Webhook", placeholder:"https://hooks.slack.com/services/...", type:"url" },
      { key:"channel",     label:"Channel",     labelAr:"القناة",       placeholder:"#hr-posture" },
      { key:"bot_name",    label:"Bot Name",    labelAr:"اسم البوت",    placeholder:"Corvus" },
    ],
    events:["burnout_alert","risk_alert","weekly_digest","achievement","team_milestone"],
    docs:"https://api.slack.com/messaging/webhooks",
  },
  teams: { id:"teams", name:"Microsoft Teams", icon:"🟦", color:"#6264A7",
    desc:"Post updates to Teams channels",
    descAr:"نشر التحديثات في قنوات Teams",
    fields:[
      { key:"webhook_url", label:"Connector URL", labelAr:"رابط الموصّل", placeholder:"https://outlook.office.com/webhook/...", type:"url" },
      { key:"team_name",   label:"Team Name",     labelAr:"اسم الفريق",   placeholder:"HR Team" },
    ],
    events:["burnout_alert","risk_alert","weekly_digest","team_milestone"],
    docs:"https://learn.microsoft.com/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using",
  },
  jira: { id:"jira", name:"Jira", icon:"🔵", color:"#0052CC",
    desc:"Auto-create tickets for high-risk cases",
    descAr:"إنشاء تذاكر تلقائياً للحالات عالية الخطورة",
    fields:[
      { key:"base_url",    label:"Jira URL",     labelAr:"رابط Jira",        placeholder:"https://org.atlassian.net", type:"url" },
      { key:"api_token",   label:"API Token",    labelAr:"رمز API",           placeholder:"ATATT3x...", type:"password" },
      { key:"project_key", label:"Project Key",  labelAr:"مفتاح المشروع",    placeholder:"HR" },
      { key:"issue_type",  label:"Issue Type",   labelAr:"نوع التذكرة",      placeholder:"Task" },
    ],
    events:["burnout_alert","risk_alert","gdpr_request"],
    docs:"https://developer.atlassian.com/cloud/jira/platform/rest/v3",
  },
  gcalendar: { id:"gcalendar", name:"Google Calendar", icon:"📅", color:"#1A73E8",
    desc:"Auto-schedule wellness check-ins",
    descAr:"جدولة جلسات الصحة تلقائياً",
    fields:[
      { key:"calendar_id", label:"Calendar ID", labelAr:"معرف التقويم", placeholder:"primary" },
      { key:"api_key",     label:"API Key",     labelAr:"مفتاح API",    placeholder:"AIza...", type:"password" },
    ],
    events:["session_reminder","weekly_digest"],
    docs:"https://developers.google.com/calendar/api",
  },
  zoom: { id:"zoom", name:"Zoom", icon:"📹", color:"#2D8CFF",
    desc:"Auto-generate wellness meeting links",
    descAr:"إنشاء روابط اجتماعات رفاهية تلقائياً",
    fields:[
      { key:"api_key",    label:"API Key",    labelAr:"مفتاح API",  placeholder:"...", type:"password" },
      { key:"api_secret", label:"API Secret", labelAr:"سر API",     placeholder:"...", type:"password" },
    ],
    events:["burnout_alert","team_milestone"],
    docs:"https://marketplace.zoom.us/docs/api-reference",
  },
};

function IntegrationsTab({ orgId, isAr }) {
  const [configs,  setConfigs]  = useState({});
  const [statuses, setStatuses] = useState({});
  const [open,     setOpen]     = useState(null);
  const [saving,   setSaving]   = useState(null);
  const [testing,  setTesting]  = useState(null);
  const [saved,    setSaved]    = useState(null);

  useEffect(() => {
    if (!orgId) return;
    getDoc(doc(db,"orgs",orgId,"settings","integrations"))
      .then(s => { if (s.exists()) { const d=s.data(); setConfigs(d); Object.keys(d).forEach(k=>{ if(d[k]?.enabled) setStatuses(p=>({...p,[k]:"connected"})); }); } })
      .catch(() => {});
  }, [orgId]);

  const setField = (id, key, val) =>
    setConfigs(p => ({...p, [id]:{...(p[id]||{}), field_values:{...(p[id]?.field_values||{}), [key]:val}}}));

  const save = async (id) => {
    setSaving(id);
    const updated = { ...configs, [id]:{ ...(configs[id]||{}), enabled:true, connected_at:new Date().toISOString() } };
    if (orgId) await setDoc(doc(db,"orgs",orgId,"settings","integrations"), updated, { merge:true }).catch(()=>{});
    setConfigs(updated);
    setStatuses(p => ({...p,[id]:"connected"}));
    setSaving(null); setSaved(id);
    setTimeout(() => setSaved(p => p===id ? null : p), 2500);
  };

  const test = async (id) => {
    setTesting(id); setStatuses(p => ({...p,[id]:"testing"}));
    try {
      const token = await getAuthToken().catch(()=>null);
      const res = await fetch("/api/notify/dispatch", {
        method:"POST",
        headers:{ "Content-Type":"application/json", ...(token?{Authorization:"Bearer "+token}:{}) },
        body:JSON.stringify({ id:"test_"+Date.now(), type:"ai_insight", channels:[id],
          payload:{ text:"Corvus connection test — "+new Date().toLocaleString("en-GB") } }),
        signal:AbortSignal.timeout(12000),
      });
      const d = await res.json().catch(()=>({}));
      const r = (d.results||[]).find(r=>r.channel===id);
      setStatuses(p => ({...p,[id]: res.ok && r?.ok!==false ? "connected":"error"}));
    } catch { setStatuses(p => ({...p,[id]:"error"})); }
    setTesting(null);
  };

  const disconnect = (id) => {
    setConfigs(p => ({...p,[id]:{...(p[id]||{}),enabled:false}}));
    setStatuses(p => ({...p,[id]:"disconnected"}));
  };

  const connected = Object.values(statuses).filter(s=>s==="connected").length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
        <div>
          <div style={{ fontFamily:"'Syne',system-ui,sans-serif", fontSize:15, fontWeight:800, color:C.text }}>
            {isAr ? "التكاملات" : "Integrations"}
          </div>
          <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>
            {connected}/{Object.keys(INTEGRATIONS).length} {isAr?"متصل":"connected"}
            {" · "}{isAr?"ربط Corvus مع منصاتك":"Connect Corvus with your platforms"}
          </div>
        </div>
      </div>

      {/* Integration cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))", gap:11 }}>
        {Object.values(INTEGRATIONS).map((intg, idx) => {
          const cfg    = configs[intg.id] || {};
          const status = statuses[intg.id] || (cfg.enabled ? "connected" : "disconnected");
          const isOpen = open === intg.id;

          return (
            <div key={intg.id} style={{
              background:C.card, border:`1px solid ${status==="connected" ? intg.color+"35" : C.border}`,
              borderRadius:14, overflow:"hidden", transition:"border-color 200ms",
              animation:`nhFd 260ms ${idx*55}ms both`,
            }}>
              {/* Card header */}
              <div onClick={() => setOpen(isOpen ? null : intg.id)} style={{
                padding:"14px 16px", display:"flex", alignItems:"center", gap:11, cursor:"pointer",
                borderBottom: isOpen ? `1px solid ${C.border}` : "none",
                background: status==="connected" ? `${intg.color}05` : "none",
                transition:"background 200ms",
              }}>
                <div style={{ width:42, height:42, borderRadius:12, background:`${intg.color}14`,
                  border:`1px solid ${intg.color}25`, display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:20, flexShrink:0 }}>{intg.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
                    <span style={{ fontFamily:"'Syne',system-ui,sans-serif", fontSize:12, fontWeight:800, color:C.text }}>{intg.name}</span>
                    <StatusDot status={status}/>
                    {status==="connected" && <Chip label="Connected" color={C.green}/>}
                    {status==="error"     && <Chip label="Error"     color={C.red}/>}
                  </div>
                  <div style={{ fontSize:11, color:C.muted }}>{isAr ? intg.descAr : intg.desc}</div>
                </div>
                <span style={{ color:C.muted, fontSize:13, transform:isOpen?"rotate(180deg)":"none", transition:"transform 200ms" }}>▾</span>
              </div>

              {/* Expanded config */}
              {isOpen && (
                <div style={{ padding:"15px 16px", animation:"nhSlide 200ms ease both" }}>
                  {/* Supported events */}
                  <div style={{ marginBottom:13 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>
                      {isAr?"أحداث مدعومة":"Supported Events"}
                    </div>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {intg.events.map(ev => {
                        const m = NTYPES[ev];
                        return m ? <Chip key={ev} label={`${m.icon} ${isAr?m.labelAr:m.label}`} color={m.color}/> : null;
                      })}
                    </div>
                  </div>

                  {/* Fields */}
                  <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:13 }}>
                    {intg.fields.map(f => (
                      <NInput key={f.key}
                        label={isAr ? f.labelAr : f.label}
                        value={cfg.field_values?.[f.key] || ""}
                        onChange={e => setField(intg.id, f.key, e.target.value)}
                        placeholder={f.placeholder}
                        type={f.type || "text"}/>
                    ))}
                  </div>

                  {/* Status banner */}
                  {status==="connected" && (
                    <div style={{ background:"rgba(63,185,80,.06)", border:"1px solid rgba(63,185,80,.18)",
                      borderRadius:9, padding:"8px 12px", marginBottom:11, fontSize:11, color:C.green }}>
                      ✓ {isAr ? "متصل — الإشعارات تُرسل عبر هذا القناة" : "Connected — notifications dispatched via this channel"}
                    </div>
                  )}
                  {status==="error" && (
                    <div style={{ background:"rgba(248,81,73,.06)", border:"1px solid rgba(248,81,73,.18)",
                      borderRadius:9, padding:"8px 12px", marginBottom:11, fontSize:11, color:C.red }}>
                      ✕ {isAr ? "فشل الاتصال — تحقق من الإعدادات" : "Connection failed — check your configuration"}
                    </div>
                  )}
                  {saved===intg.id && (
                    <div style={{ background:"rgba(63,185,80,.06)", border:"1px solid rgba(63,185,80,.18)",
                      borderRadius:9, padding:"8px 12px", marginBottom:11, fontSize:11, color:C.green, animation:"nhFd 200ms" }}>
                      ✓ {isAr ? "تم الحفظ بنجاح" : "Saved successfully"}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display:"flex", gap:7, justifyContent:"space-between", alignItems:"center" }}>
                    <a href={intg.docs} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize:11, color:C.blue, textDecoration:"none" }}>
                      📖 {isAr?"وثائق":"Docs ↗"}
                    </a>
                    <div style={{ display:"flex", gap:6 }}>
                      {status==="connected" && (
                        <NBtn size="xs" variant="danger" onClick={()=>disconnect(intg.id)}>
                          {isAr?"قطع":"Disconnect"}
                        </NBtn>
                      )}
                      <NBtn size="xs" variant="subtle" loading={testing===intg.id} onClick={()=>test(intg.id)} icon="🧪">
                        {isAr?"اختبار":"Test"}
                      </NBtn>
                      <NBtn size="xs" variant="primary" loading={saving===intg.id} onClick={()=>save(intg.id)} icon="💾">
                        {isAr?"حفظ":"Save"}
                      </NBtn>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: AI ALERTS
// ─────────────────────────────────────────────────────────────
function AlertsTab({ sessions=[], allUsers=[], isAr }) {
  const [rules, setRules] = useState([
    { id:"r1", name:isAr?"تنبيه إنهاك مرتفع":"High Burnout Alert",
      condition:"burnout_risk > 70", action:"notify:slack,email",
      severity:"critical", enabled:true, triggered:3, lastAt:"14 Jan 09:12" },
    { id:"r2", name:isAr?"تحذير وضعية منخفضة":"Low Posture Warning",
      condition:"avg_score < 50", action:"notify:in_app",
      severity:"warning", enabled:true, triggered:8, lastAt:"13 Jan 15:44" },
    { id:"r3", name:isAr?"ملخص أسبوعي تلقائي":"Auto Weekly Digest",
      condition:"schedule:monday_09:00", action:"digest:slack,email",
      severity:"info", enabled:true, triggered:12, lastAt:"13 Jan 09:00" },
    { id:"r4", name:isAr?"كشف الشذوذ":"Anomaly Detection",
      condition:"z_score > 2.0", action:"notify:slack,jira",
      severity:"high", enabled:false, triggered:1, lastAt:"10 Jan 11:30" },
    { id:"r5", name:isAr?"جلسات ناقصة":"Insufficient Sessions",
      condition:"week_sessions < 3", action:"notify:in_app,slack",
      severity:"warning", enabled:false, triggered:5, lastAt:"09 Jan 14:20" },
  ]);

  const [aiRules,   setAiRules]   = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState("");
  const [addOpen,   setAddOpen]   = useState(false);
  const [newRule,   setNewRule]   = useState({ name:"", condition:"", action:"notify:in_app", severity:"warning" });

  const SC = { critical:C.red, high:C.amber, warning:"#fbbf24", info:C.blue };

  const generateRules = async () => {
    setAiLoading(true); setAiRules([]); setAiError("");
    try {
      const avgScore = sessions.length
        ? Math.round(sessions.reduce((a,s)=>a+(s.avg_score||0),0)/sessions.length) : 72;
      const prompt = `Generate exactly 3 smart alert rules for Corvus PostureAI workforce health platform.
Context: ${sessions.length} sessions, ${allUsers.length} employees, avg posture score ${avgScore}/100.
Respond ONLY with a valid JSON array (no markdown, no explanation):
[
  {
    "name": "rule name (${isAr?"in Arabic":"in English"})",
    "condition": "e.g. burnout_risk > 70 or avg_score < 55 or week_sessions < 2",
    "action": "notify:slack,in_app",
    "severity": "critical|high|warning|info",
    "rationale": "one sentence why (${isAr?"in Arabic":"in English"})"
  }
]`;
      const raw = await geminiAnalysis(prompt, { lang:isAr?"ar":"en", maxTokens:600 });
      // Strip possible markdown fences
      const clean = raw.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/,"").trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) setAiRules(parsed.slice(0,3));
      else setAiError(isAr?"صيغة غير صحيحة":"Invalid format from AI");
    } catch(e) {
      setAiError(isAr ? "⚠️ خطأ في التوليد — جرب مرة أخرى" : "⚠️ Generation failed — try again");
    }
    setAiLoading(false);
  };

  const addAiRule = (r) => {
    setRules(p => [...p, { ...r, id:"ai_"+Date.now(), enabled:true, triggered:0, lastAt:"—" }]);
    setAiRules(p => p.filter(x => x.name !== r.name));
  };

  const addRule = () => {
    if (!newRule.name || !newRule.condition) return;
    setRules(p => [...p, { ...newRule, id:"r"+Date.now(), enabled:true, triggered:0, lastAt:"—" }]);
    setNewRule({ name:"", condition:"", action:"notify:in_app", severity:"warning" });
    setAddOpen(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* AI Generator */}
      <div style={{ background:"linear-gradient(135deg,rgba(167,139,250,.06),rgba(56,139,253,.04))",
        border:"1px solid rgba(167,139,250,.2)", borderRadius:16, padding:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:aiOutput||aiLoading?14:0 }}>
          <div>
            <div style={{ fontFamily:"'Syne',system-ui,sans-serif", fontSize:13, fontWeight:800, color:C.text }}>
              {isAr ? "مولّد القواعد بالذكاء الاصطناعي" : "AI Rule Generator"}
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
              {isAr ? "Corvus يحلل بياناتك ويقترح قواعد مخصصة" : "AI analyzes your workforce data and suggests smart rules"}
            </div>
          </div>
          <NBtn size="sm" variant="primary" loading={aiLoading} onClick={generateRules} icon="🧠">
            {isAr ? "توليد" : "Generate"}
          </NBtn>
        </div>
        {aiLoading && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:8 }}>
              {isAr ? "Corvus يحلل بياناتك..." : "Analyzing your workforce data..."}
            </div>
            <Shimmer lines={4}/>
          </div>
        )}
        {aiError && !aiLoading && (
          <div style={{ marginTop:12, fontSize:11, color:C.red,
            background:"rgba(248,81,73,.06)", border:"1px solid rgba(248,81,73,.15)",
            borderRadius:9, padding:"9px 13px", animation:"nhFd 200ms" }}>
            {aiError}
          </div>
        )}
        {aiRules.length > 0 && !aiLoading && (
          <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase",
              letterSpacing:".06em", marginBottom:2 }}>
              {isAr ? "قواعد مقترحة — اضغط + لإضافة" : "Suggested rules — click + to add"}
            </div>
            {aiRules.map((r, i) => (
              <div key={i} style={{ background:"rgba(167,139,250,.06)", border:"1px solid rgba(167,139,250,.2)",
                borderRadius:11, padding:"12px 14px", display:"flex", gap:12, alignItems:"flex-start",
                animation:`nhFd 200ms ${i*70}ms both` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5, flexWrap:"wrap" }}>
                    <span style={{ fontFamily:"Syne,system-ui,sans-serif", fontSize:12, fontWeight:800, color:C.text }}>{r.name}</span>
                    <span style={{ fontSize:9, padding:"2px 8px", borderRadius:99, fontWeight:700,
                      background:`${SC[r.severity]||C.blue}18`, border:`1px solid ${SC[r.severity]||C.blue}30`,
                      color:SC[r.severity]||C.blue }}>{(r.severity||"info").toUpperCase()}</span>
                  </div>
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:5 }}>
                    <span style={{ fontSize:10, color:C.muted }}>
                      <span style={{ color:C.text2 }}>if </span>
                      <code style={{ fontFamily:"monospace", fontSize:10, color:"#a78bfa" }}>{r.condition}</code>
                    </span>
                    <span style={{ fontSize:10, color:C.muted }}>
                      <span style={{ color:C.text2 }}>→ </span>{r.action}
                    </span>
                  </div>
                  {r.rationale && (
                    <div style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>{r.rationale}</div>
                  )}
                </div>
                <button onClick={() => addAiRule(r)} style={{
                  width:32, height:32, borderRadius:8, flexShrink:0,
                  background:"linear-gradient(135deg,#1158c7,#0891b2)",
                  border:"none", color:"#fff", fontSize:17, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:"0 3px 10px rgba(17,88,199,.4)", transition:"all 150ms",
                }} title={isAr?"إضافة":"Add rule"}>+</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rules list */}
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div>
            <span style={{ fontFamily:"'Syne',system-ui,sans-serif", fontSize:14, fontWeight:800, color:C.text }}>
              {isAr?"قواعد التنبيه":"Alert Rules"}
            </span>
            <span style={{ fontSize:11, color:C.muted, marginLeft:9 }}>
              {rules.filter(r=>r.enabled).length}/{rules.length} {isAr?"مفعّل":"active"}
            </span>
          </div>
          <NBtn size="sm" variant="subtle" icon="+" onClick={()=>setAddOpen(!addOpen)}>
            {isAr?"قاعدة جديدة":"New Rule"}
          </NBtn>
        </div>

        {/* Add rule panel */}
        {addOpen && (
          <div style={{ background:C.card, border:`1px solid ${C.borderB}`, borderRadius:12,
            padding:16, marginBottom:12, animation:"nhSlide 200ms ease both" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:9 }}>
              <NInput label={isAr?"اسم القاعدة":"Rule Name"} value={newRule.name}
                onChange={e=>setNewRule(p=>({...p,name:e.target.value}))} placeholder={isAr?"مثال: تنبيه درجة منخفضة":"e.g. Low Score Alert"}/>
              <NInput label={isAr?"الشرط":"Condition"} value={newRule.condition}
                onChange={e=>setNewRule(p=>({...p,condition:e.target.value}))} placeholder="avg_score < 60"/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:12 }}>
              <NInput label={isAr?"الإجراء":"Action"} value={newRule.action}
                onChange={e=>setNewRule(p=>({...p,action:e.target.value}))} placeholder="notify:slack,in_app"/>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:C.text2, textTransform:"uppercase", letterSpacing:".05em", marginBottom:5 }}>
                  {isAr?"الخطورة":"Severity"}
                </div>
                <select value={newRule.severity} onChange={e=>setNewRule(p=>({...p,severity:e.target.value}))}
                  style={{ width:"100%", padding:"8px 12px", background:C.surf, border:`1.5px solid ${C.border}`,
                    borderRadius:8, color:C.text, fontSize:12, outline:"none" }}>
                  {["critical","high","warning","info"].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:7, justifyContent:"flex-end" }}>
              <NBtn size="sm" variant="ghost" onClick={()=>setAddOpen(false)}>{isAr?"إلغاء":"Cancel"}</NBtn>
              <NBtn size="sm" variant="primary" icon="+" onClick={addRule} disabled={!newRule.name||!newRule.condition}>
                {isAr?"إضافة":"Add Rule"}
              </NBtn>
            </div>
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {rules.map((rule, i) => (
            <div key={rule.id} style={{
              background:C.card, border:`1px solid ${rule.enabled?C.border:"rgba(110,118,129,.05)"}`,
              borderRadius:12, padding:"13px 15px",
              display:"flex", alignItems:"center", gap:13,
              opacity:rule.enabled?1:.48, transition:"opacity 200ms",
              animation:`nhFd 200ms ${i*45}ms both`,
            }}>
              <div style={{ width:9, height:9, borderRadius:"50%", background:SC[rule.severity]||C.muted, flexShrink:0,
                animation:rule.enabled&&rule.severity==="critical"?"nhPls 2s ease-out infinite":"none" }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5, flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"'Syne',system-ui,sans-serif", fontSize:12, fontWeight:800, color:C.text }}>{rule.name}</span>
                  <Chip label={rule.severity.toUpperCase()} color={SC[rule.severity]}/>
                </div>
                <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, color:C.muted }}>
                    <span style={{ color:C.text2 }}>if </span>
                    <code style={{ fontFamily:"monospace", fontSize:10, color:"#a78bfa" }}>{rule.condition}</code>
                  </span>
                  <span style={{ fontSize:10, color:C.muted }}>
                    <span style={{ color:C.text2 }}>→ </span>{rule.action}
                  </span>
                  <span style={{ fontSize:10, color:C.muted }}>
                    {rule.triggered}× · {rule.lastAt}
                  </span>
                </div>
              </div>
              <div style={{ display:"flex", gap:7, alignItems:"center", flexShrink:0 }}>
                <NToggle value={rule.enabled} onChange={v=>setRules(p=>p.map(r=>r.id===rule.id?{...r,enabled:v}:r))}/>
                <NBtn size="xs" variant="danger" onClick={()=>setRules(p=>p.filter(r=>r.id!==rule.id))}>✕</NBtn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────
export function NotificationsHub({ orgId, profile, sessions=[], allUsers=[], lang="en", onClose }) {
  const isAr = lang === "ar";
  const [tab, setTab] = useState("feed");

  const TABS = [
    { id:"feed",         icon:"🔔", en:"Notifications",  ar:"الإشعارات"    },
    { id:"queue",        icon:"📬", en:"Queue",           ar:"الطابور"      },
    { id:"integrations", icon:"🔌", en:"Integrations",    ar:"التكاملات"    },
    { id:"alerts",       icon:"🤖", en:"AI Alerts",       ar:"تنبيهات AI"  },
  ];

  const pending = Q.pending.length;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(3,6,14,.93)", backdropFilter:"blur(14px)",
      WebkitBackdropFilter:"blur(14px)", zIndex:9200, display:"flex", alignItems:"center",
      justifyContent:"center", padding:14 }}>
      <style>{GLOBAL_CSS}</style>

      <div dir={isAr?"rtl":"ltr"} style={{
        background:C.bg, border:`0.5px solid ${C.borderB}`,
        borderRadius:22, width:"min(1020px,98vw)", height:"min(880px,96vh)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        boxShadow:"0 40px 120px rgba(0,0,0,.8), 0 0 0 0.5px rgba(56,139,253,.06) inset",
        animation:"nhIn .3s "+C.spring+" both",
      }}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ padding:"16px 22px", flexShrink:0,
          background:"linear-gradient(135deg,rgba(56,139,253,.07),rgba(6,182,212,.03))",
          borderBottom:`0.5px solid ${C.border}` }}>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:12, flexShrink:0,
                background:"linear-gradient(135deg,#388bfd,#06b6d4)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:20, boxShadow:"0 4px 18px rgba(56,139,253,.45)" }}>🔔</div>
              <div>
                <div style={{ fontFamily:"'Syne',system-ui,sans-serif", fontSize:15, fontWeight:900, color:C.text, letterSpacing:"-.02em" }}>
                  {isAr ? "مركز الإشعارات" : "Notifications Hub"}
                </div>
                <div style={{ fontSize:10, color:C.teal, fontWeight:600, marginTop:2 }}>
                  {isAr
                    ? "طابور ذكي · Slack · Teams · Jira · إشعارات حقيقية"
                    : "Real-time Firestore · Smart Queue · Slack · Teams · Jira"}
                </div>
              </div>
            </div>

            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {/* Live queue counter */}
              <div style={{ display:"flex", alignItems:"center", gap:6,
                background:"rgba(63,185,80,.07)", border:"1px solid rgba(63,185,80,.2)",
                borderRadius:99, padding:"5px 13px" }}>
                <StatusDot status={pending>0?"testing":"connected"}/>
                <span style={{ fontSize:10, fontWeight:700, color:C.green }}>
                  {pending} {isAr?"في الطابور":"in queue"}
                </span>
              </div>

              {/* Integration status row */}
              {Object.values(INTEGRATIONS).slice(0,3).map(intg => (
                <div key={intg.id} style={{ display:"flex", alignItems:"center", gap:5,
                  background:"rgba(255,255,255,.04)", border:`0.5px solid ${C.border}`,
                  borderRadius:99, padding:"4px 11px" }}>
                  <span style={{ fontSize:12 }}>{intg.icon}</span>
                  <span style={{ fontSize:9.5, fontWeight:600, color:C.muted }}>{intg.name}</span>
                  <StatusDot status="disconnected"/>
                </div>
              ))}

              <button onClick={onClose} style={{
                width:30, height:30, borderRadius:8, background:"rgba(255,255,255,.05)",
                border:`0.5px solid ${C.border}`, color:C.muted, cursor:"pointer",
                fontSize:15, display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 150ms",
              }} aria-label="Close">✕</button>
            </div>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <div style={{ display:"flex", borderBottom:`0.5px solid ${C.border}`, flexShrink:0,
          overflowX:"auto", background:C.surf }}>
          {TABS.map(t => (
            <button key={t.id} className="nh-tab" onClick={()=>setTab(t.id)} style={{
              flex:1, padding:"11px 8px", background:"none", border:"none",
              borderBottom:`2.5px solid ${tab===t.id?C.blue:"transparent"}`,
              color:tab===t.id?"#79c0ff":C.muted,
              fontSize:11, fontWeight:700, cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", gap:3,
              minWidth:90, whiteSpace:"nowrap",
            }}>
              <span style={{ fontSize:17 }}>{t.icon}</span>
              <span>{isAr?t.ar:t.en}</span>
              {t.id==="queue" && pending>0 && (
                <span style={{ background:C.amber, borderRadius:99, padding:"0px 5px",
                  fontSize:8, fontWeight:900, color:"#fff", lineHeight:"14px" }}>{pending}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ────────────────────────────────────────────── */}
        <div className="nh-scroll" style={{ flex:1, overflowY:"auto", padding:22 }}>
          {tab==="feed"         && <FeedTab         profile={profile} isAr={isAr}/>}
          {tab==="queue"        && <QueueTab         isAr={isAr}/>}
          {tab==="integrations" && <IntegrationsTab  orgId={orgId} isAr={isAr}/>}
          {tab==="alerts"       && <AlertsTab        sessions={sessions} allUsers={allUsers} isAr={isAr}/>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────
export function useNotifications() {
  const push = useCallback((type, payload, channels=["in_app"]) => {
    Q.enqueue(mkEntry(type, payload, channels));
  }, []);
  return { push, queue: Q };
}
