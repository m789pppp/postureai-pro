/**
 * Corvus — Physiotherapist Marketplace v2
 * Polished UI + fixed demo-mode chat + specialty filter + better cards
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { MarketplaceAPI } from "./services/api.js";
import { tierAtLeast } from "./lib/tierQuality.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";
import {
  DEMO_THERAPISTS, getDemoBookings, createDemoBooking,
  updateDemoBooking, getDemoMessages, addDemoMessage,
} from "./marketplaceDemo.js";

/* ── Design tokens ─────────────────────────────────────────── */
/* tokens resolved per render — passed as args to mkT() */
const TEAL  = "#0d9488";
const TEALLT= "#5eead4";

/* ── Launch status ─────────────────────────────────────────── */
// We don't have signed clinic/therapist partnerships live yet — every
// "therapist" a visitor sees right now is either demo data (backend
// unreachable) or admin-seeded placeholder data, not a real, vetted
// physiotherapist who can actually take a booking. Rather than let people
// go through a full "Confirm & Pay" flow that can't really be fulfilled,
// the Book action shows a "Coming Soon" notice instead — we're actively
// contracting with clinics, and real booking opens once that's signed.
// Flip this to `true` (and nothing else needs to change — the full
// BookingModal/payment flow below is untouched and still wired up) once
// the first real clinic contract is live.
const BOOKING_LIVE = false;

function mkT(cs) {
  const BORDER = cs.border;
  const TEXT   = cs.text;
  const MUTED  = cs.muted;
  const SUB    = cs.muted;
  const CARD   = cs.card;
  return {
    BORDER, TEXT, MUTED, SUB, CARD,
    card : { background:CARD, border:`1px solid ${BORDER}`, borderRadius:16, padding:"18px 20px" },
    lbl  : { fontSize:10.5, color:MUTED, fontWeight:700, marginBottom:5, textTransform:"uppercase", letterSpacing:".06em" },
    inp  : { width:"100%", background:cs.inp, border:`1px solid ${cs.inpB||BORDER}`, borderRadius:9,
             color:TEXT, padding:"9px 13px", fontSize:13, outline:"none", boxSizing:"border-box" },
    btnP : { background:`linear-gradient(135deg,${TEAL},#0891b2)`, color:"#fff", border:"none",
             borderRadius:10, padding:"10px 20px", fontSize:13, fontWeight:700, cursor:"pointer",
             boxShadow:"0 4px 14px rgba(13,148,136,.35)" },
    btnG : { background:"transparent", color:MUTED, border:`0.5px solid ${BORDER}`,
             borderRadius:7, padding:"7px 14px", fontSize:11, cursor:"pointer" },
    btnGh: { background:"transparent", color:MUTED, border:`1px solid ${BORDER}`,
             borderRadius:10, padding:"9px 16px", fontSize:13, fontWeight:600, cursor:"pointer" },
  };
}

/* ── Helpers ───────────────────────────────────────────────── */
function money(cents, currency, isAr) {
  if (cents == null) return "—";
  if (cents === 0)   return isAr ? "مجانية" : "Free";
  return `${(cents/100).toLocaleString()} ${currency||"EGP"}`;
}
function fmtDate(iso, isAr) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleString(isAr ? "ar-EG" : "en-US", { dateStyle:"medium", timeStyle:"short" }); }
  catch { return iso; }
}
const STATUS_COLORS = { confirmed:"#10b981", confirmed_demo:"#6366f1", pending:"#f59e0b", cancelled:"#ef4444" };

function Pill({ text, color="#5eead4", bg }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:99,
      background: bg || `${color}15`, border:`1px solid ${color}30`, color, whiteSpace:"nowrap" }}>
      {text}
    </span>
  );
}
function Tab({ active, onClick, children, cs }) {
  const border = cs?.border || "rgba(255,255,255,.07)";
  return (
    <button onClick={onClick} style={{
      background: active ? "rgba(13,148,136,.15)" : "transparent",
      color:      active ? TEALLT : (cs?.muted||"#64748b"),
      border:     active ? "1px solid rgba(13,148,136,.35)" : `1px solid ${border}`,
      borderRadius:10, padding:"8px 18px", fontSize:13, fontWeight:700, cursor:"pointer",
      transition:"all .2s",
    }}>{children}</button>
  );
}

/* ── Avatar ─────────────────────────────────────────────────── */
const AVATAR_COLORS = ["#6366f1","#0891b2","#0d9488","#7c3aed","#1d4ed8","#0f766e"];
function Avatar({ name, size=44 }) {
  const idx = (name?.charCodeAt(0)||0) % AVATAR_COLORS.length;
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`linear-gradient(135deg,${AVATAR_COLORS[idx]},${AVATAR_COLORS[(idx+2)%AVATAR_COLORS.length]})`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.38, fontWeight:800, color:"#fff" }}>
      {name?.[0]?.toUpperCase()||"?"}
    </div>
  );
}

/* ── Stars ───────────────────────────────────────────────────── */
function Stars({ rating, count, muted="#64748b" }) {
  if (!rating) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
      <div style={{ display:"flex" }}>
        {[1,2,3,4,5].map(n => (
          <span key={n} style={{ fontSize:12, color: n<=Math.round(rating) ? "#fbbf24" : "#334155" }}>★</span>
        ))}
      </div>
      <span style={{ fontSize:11, color:muted }}>{rating} {count ? `(${count})` : ""}</span>
    </div>
  );
}

/* ── Therapist card ──────────────────────────────────────────── */
function TherapistCard({ th, onBook, eliteCredit, isAr, cs, tk }) {
  if(!cs||!tk){ cs={card:"#111827",border:"rgba(255,255,255,.07)",inp:"rgba(0,0,0,.3)",inpB:"rgba(255,255,255,.15)",muted:"#64748b",text:"#e2e8f0",bg:"#0a0f1e"}; tk=mkT(cs); }
  const { BORDER, TEXT, MUTED, SUB } = tk;
  const btnP = tk.btnP; const card = tk.card;
  const [expanded, setExpanded] = useState(false);
  // Inline React styles can't express ":hover" as an object key — that was
  // dead, silently-ignored CSS (React just renders it as a literal, inert
  // style property) and every card had zero hover feedback despite the
  // apparent intent. Real hover state instead.
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{ ...card, display:"flex", flexDirection:"column", gap:0,
        transition:"border-color .2s", borderColor: hovered ? "rgba(13,148,136,.3)" : BORDER }}>
      <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
        <Avatar name={th.name} size={48}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontWeight:800, fontSize:15, color:TEXT }}>{th.name}</span>
            {th.status === "active" && (
              <Pill text={isAr?"متاح":"Available"} color="#10b981"/>
            )}
            {eliteCredit && (
              <Pill text={isAr?"مجاني Elite":"Elite Free"} color="#d4af37"/>
            )}
          </div>
          <div style={{ fontSize:12, color:MUTED, marginTop:2 }}>
            {[th.city, th.years_experience && `${th.years_experience}${isAr?" سنة خبرة":"y exp"}`].filter(Boolean).join(" · ")}
          </div>
          <Stars rating={th.rating} count={th.review_count} muted={MUTED}/>
        </div>
        <div style={{ textAlign:"end", flexShrink:0 }}>
          {eliteCredit ? (
            <div>
              <div style={{ fontSize:11, color:MUTED, textDecoration:"line-through" }}>{money(th.session_fee_cents,th.currency,isAr)}</div>
              <div style={{ fontSize:14, fontWeight:800, color:"#d4af37" }}>{isAr?"مجاني":"FREE"}</div>
            </div>
          ) : (
            <div style={{ fontSize:15, fontWeight:800, color:TEALLT }}>{money(th.session_fee_cents,th.currency,isAr)}</div>
          )}
        </div>
      </div>

      {th.specialties?.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:10 }}>
          {th.specialties.map(s => (
            <span key={s} style={{ fontSize:10.5, background:"rgba(13,148,136,.1)", border:"1px solid rgba(13,148,136,.2)",
              borderRadius:6, padding:"3px 9px", color:"#5eead4" }}>{s}</span>
          ))}
        </div>
      )}

      {th.bio && (
        <div style={{ fontSize:12.5, color:SUB, marginTop:10, lineHeight:1.55 }}>
          {expanded || th.bio.length <= 100 ? th.bio : th.bio.slice(0,100)+"…"}
          {th.bio.length > 100 && (
            <button onClick={()=>setExpanded(e=>!e)}
              style={{ background:"none", border:"none", color:TEALLT, fontSize:11.5, cursor:"pointer", marginInlineStart:4 }}>
              {expanded ? (isAr?"أقل":"less") : (isAr?"المزيد":"more")}
            </button>
          )}
        </div>
      )}

      <div style={{ marginTop:14, display:"flex", justifyContent:"flex-end" }}>
        <button style={btnP} onClick={()=>onBook(th)}>
          {isAr ? "📅 احجز جلسة" : "📅 Book session"}
        </button>
      </div>
    </div>
  );
}

/* ── Booking card (My Bookings) ──────────────────────────────── */
function BookingCard({ b, isAr, currentUid, demoMode, onCancel, cancellingId,
                       ratingId, setRatingId, submitReview, submittingReview, cs, tk }) {
  if(!cs||!tk){ cs={card:"#111827",border:"rgba(255,255,255,.07)",inp:"rgba(0,0,0,.3)",inpB:"rgba(255,255,255,.15)",muted:"#64748b",text:"#e2e8f0",bg:"#0a0f1e"}; tk=mkT(cs); }
  const { BORDER, TEXT, MUTED, SUB, CARD } = tk;
  const card = tk.card; const btnG = tk.btnGh; const lbl = tk.lbl;
  const [chatOpen, setChatOpen] = useState(false);
  const sc = STATUS_COLORS[b.status] || MUTED;

  return (
    <div style={{ ...card, display:"flex", flexDirection:"column", gap:0 }}>
      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
        <Avatar name={b.therapist_name} size={42}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:TEXT }}>{b.therapist_name}</div>
          <div style={{ fontSize:12, color:MUTED, marginTop:2 }}>
            {b.preferred_time
              ? fmtDate(b.preferred_time, isAr) || b.preferred_time
              : (isAr ? "الميعاد لسه بيتحدد" : "Time being confirmed")}
          </div>
          {b.notes && (
            <div style={{ fontSize:11.5, color:SUB, marginTop:4, fontStyle:"italic" }}>📝 {b.notes}</div>
          )}
        </div>
        <div style={{ textAlign:"end", flexShrink:0 }}>
          <div style={{ fontWeight:800, color:TEALLT }}>{money(b.amount_cents,b.currency,isAr)}</div>
          <div style={{ marginTop:4 }}>
            <Pill text={b.status?.replace(/_/g," ")} color={sc}/>
          </div>
        </div>
      </div>

      {/* Rating display */}
      {b.rating && (
        <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:6 }}>
          <Stars rating={b.rating} muted={MUTED}/>
          {b.review_text && <span style={{ fontSize:11.5, color:SUB }}>"{b.review_text}"</span>}
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop:12, borderTop:`1px solid ${BORDER}`, paddingTop:12,
        display:"flex", gap:8, flexWrap:"wrap" }}>
        <button style={{ ...btnG, fontSize:12, padding:"6px 14px" }}
          onClick={()=>setChatOpen(o=>!o)}>
          {chatOpen ? (isAr?"إغلاق":"Close chat") : `💬 ${isAr?"محادثة":"Chat"}`}
        </button>
        {b.status !== "cancelled" && (
          <button style={{ ...btnG, fontSize:12, padding:"6px 14px", color:"#f87171", borderColor:"rgba(248,113,113,.25)" }}
            onClick={()=>onCancel(b)} disabled={cancellingId===b.id}>
            {cancellingId===b.id ? "…" : (isAr?"إلغاء":"Cancel")}
          </button>
        )}
        {b.status !== "cancelled" && !b.rating && (
          <button style={{ ...btnG, fontSize:12, padding:"6px 14px", color:"#fbbf24", borderColor:"rgba(251,191,36,.25)" }}
            onClick={()=>setRatingId(ratingId===b.id ? null : b.id)}>
            ⭐ {isAr?"قيّم":"Rate"}
          </button>
        )}
      </div>

      {ratingId === b.id && (
        <ReviewForm booking={b} isAr={isAr} submitting={submittingReview} tk={tk}
          onCancel={()=>setRatingId(null)}
          onSubmit={(r,c)=>submitReview(b,r,c)}/>
      )}

      {chatOpen && (
        <BookingChat bookingId={b.id} isAr={isAr} currentUid={currentUid}
          demoMode={demoMode} cs={cs} tk={tk}/>
      )}
    </div>
  );
}

/* ── Chat ─────────────────────────────────────────────────────── */
function BookingChat({ bookingId, isAr, currentUid, demoMode, cs, tk }) {
  if(!cs||!tk){ cs={card:"#111827",border:"rgba(255,255,255,.07)",inp:"rgba(0,0,0,.3)",inpB:"rgba(255,255,255,.15)",muted:"#64748b",text:"#e2e8f0",bg:"#0a0f1e"}; tk=mkT(cs); }
  const { BORDER, TEXT, MUTED } = tk;
  const inp = tk.inp; const btnP = tk.btnP;
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(() => {
    if (demoMode) {
      setMessages(getDemoMessages(bookingId));
      setLoading(false);
      return;
    }
    MarketplaceAPI.getMessages(bookingId)
      .then(d => setMessages(d?.messages || []))
      .catch(() => {
        // fallback to demo messages on API failure
        setMessages(getDemoMessages(bookingId));
      })
      .finally(() => setLoading(false));
  }, [bookingId, demoMode]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const optimistic = {
      id: `opt-${Date.now()}`, sender_uid: currentUid,
      sender_role:"patient", text: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages(m => [...m, optimistic]);
    setText("");
    try {
      if (demoMode) {
        addDemoMessage(bookingId, optimistic);
      } else {
        await MarketplaceAPI.sendMessage(bookingId, trimmed);
      }
      load();
    } catch {
      // keep optimistic message
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ marginTop:12, borderTop:`1px solid ${BORDER}`, paddingTop:12 }}>
      <div style={{ maxHeight:240, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
        {loading && (
          <div style={{ fontSize:12, color:MUTED, textAlign:"center", padding:8 }}>
            {isAr ? "جاري التحميل…" : "Loading…"}
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign:"center", padding:"20px 12px" }}>
            <div style={{ fontSize:24, marginBottom:6 }}>💬</div>
            <div style={{ fontSize:12.5, color:MUTED }}>
              {isAr ? "ابدأ المحادثة — اسأل عن الجلسة أو غيّر الميعاد" : "Start the conversation — ask about your session or reschedule"}
            </div>
          </div>
        )}
        {messages.map((m,i) => {
          const mine = m.sender_uid === currentUid;
          return (
            <div key={m.id||i} style={{ display:"flex", justifyContent: mine?"flex-end":"flex-start", gap:8 }}>
              {!mine && <Avatar name={m.sender_role==="admin"?"S":m.therapist_name||"T"} size={26}/>}
              <div style={{ maxWidth:"76%", display:"flex", flexDirection:"column",
                alignItems: mine?"flex-end":"flex-start", gap:2 }}>
                {!mine && (
                  <div style={{ fontSize:9.5, color:TEALLT, fontWeight:700, paddingInlineStart:4 }}>
                    {m.sender_role==="admin" ? (isAr?"فريق الدعم":"Support") : (isAr?"المعالج":"Therapist")}
                  </div>
                )}
                <div style={{
                  padding:"9px 13px", borderRadius: mine?"14px 14px 4px 14px":"14px 14px 14px 4px",
                  background: mine?"rgba(13,148,136,.2)":"rgba(255,255,255,.05)",
                  border: mine?"1px solid rgba(13,148,136,.3)":`1px solid ${BORDER}`,
                }}>
                  <div style={{ fontSize:13, color:TEXT, lineHeight:1.5, whiteSpace:"pre-wrap" }}>{m.text}</div>
                </div>
                {m.created_at && (
                  <div style={{ fontSize:9.5, color:MUTED }}>
                    {fmtDate(m.created_at, isAr)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <input style={{ ...inp, flex:1 }}
          placeholder={isAr ? "اكتب رسالتك…" : "Type a message…"}
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); } }}/>
        <button style={{ ...btnP, padding:"9px 18px" }} onClick={send} disabled={sending||!text.trim()}>
          {isAr?"إرسال":"Send"}
        </button>
      </div>
    </div>
  );
}

/* ── Review form ─────────────────────────────────────────────── */
function ReviewForm({ booking, isAr, submitting, onCancel, onSubmit, tk }) {
  if(!tk){ tk = mkT({card:"#111827",border:"rgba(255,255,255,.07)",inp:"rgba(0,0,0,.3)",inpB:"rgba(255,255,255,.15)",muted:"#64748b",text:"#e2e8f0",bg:"#0a0f1e"}); }
  const { TEXT } = tk; const inp = tk.inp; const btnP = tk.btnP; const btnG = tk.btnGh;
  const [rating, setRating]   = useState(0);
  const [hover, setHover]     = useState(0);
  const [comment, setComment] = useState("");
  return (
    <div style={{ marginTop:10, padding:"14px 16px", background:"rgba(251,191,36,.05)",
      border:"1px solid rgba(251,191,36,.18)", borderRadius:12 }}>
      <div style={{ fontSize:13, fontWeight:700, color:TEXT, marginBottom:10 }}>
        {isAr ? `قيّم جلستك مع ${booking.therapist_name}` : `Rate your session with ${booking.therapist_name}`}
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        {[1,2,3,4,5].map(n=>(
          <button key={n} onClick={()=>setRating(n)}
            onMouseEnter={()=>setHover(n)} onMouseLeave={()=>setHover(0)}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:28, padding:0,
              color: n<=(hover||rating) ? "#fbbf24" : "#334155", transition:"color .15s" }}>
            {n<=(hover||rating)?"★":"☆"}
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={e=>setComment(e.target.value)}
        placeholder={isAr ? "احكيلنا عن تجربتك (اختياري)" : "Tell us about your experience (optional)"}
        style={{ ...inp, minHeight:60, resize:"vertical", marginBottom:10 }}/>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button style={btnG} onClick={onCancel} disabled={submitting}>{isAr?"إلغاء":"Cancel"}</button>
        <button style={{ ...btnP, opacity: rating===0||submitting ? .5 : 1 }}
          disabled={submitting||rating===0}
          onClick={()=>onSubmit(rating,comment)}>
          {submitting ? (isAr?"جاري…":"Sending…") : (isAr?"إرسال التقييم":"Submit review")}
        </button>
      </div>
    </div>
  );
}

/* ── Booking modal ───────────────────────────────────────────── */
function BookingModal({ therapist, isAr, loading, eliteCredit, cs, tk, onClose, onSubmit }) {
  if(!cs||!tk){ cs={card:"#0d1a2e",border:"rgba(255,255,255,.07)",inp:"rgba(0,0,0,.3)",inpB:"rgba(255,255,255,.15)",muted:"#64748b",text:"#e2e8f0",bg:"#0a0f1e"}; tk=mkT(cs); }
  const { BORDER, TEXT, MUTED, SUB } = tk;
  const card = tk.card; const inp = tk.inp; const btnP = tk.btnP; const btnG = tk.btnGh; const lbl = tk.lbl;
  const [preferredTime, setPreferredTime] = useState("");
  const [notes, setNotes]                 = useState("");
  const [slots, setSlots]                 = useState(null);
  const [hasTemplate, setHasTemplate]     = useState(false);
  const [selectedSlot, setSelectedSlot]   = useState(null);
  const [discountCode, setDiscountCode]   = useState("");
  const [discountInfo, setDiscountInfo]   = useState(null);
  const [checkingCode, setCheckingCode]   = useState(false);

  useEffect(()=>{
    MarketplaceAPI.getSlots(therapist.id)
      .then(d=>{ setSlots(d?.slots||[]); setHasTemplate(!!d?.has_template); })
      .catch(()=>{ setSlots([]); setHasTemplate(false); });
  },[therapist.id]);

  const checkCode = async ()=>{
    if(!discountCode.trim()){ setDiscountInfo(null); return; }
    setCheckingCode(true);
    try{ const r = await MarketplaceAPI.validateDiscountCode(discountCode.trim()); setDiscountInfo(r?.valid?r:{valid:false}); }
    catch{ setDiscountInfo({valid:false}); }
    setCheckingCode(false);
  };

  const slotsByDay = {};
  (slots||[]).forEach(iso=>{ const k=new Date(iso).toDateString(); (slotsByDay[k]=slotsByDay[k]||[]).push(iso); });
  const fmtDay  = k => new Date(k).toLocaleDateString(isAr?"ar-EG":"en-US",{weekday:"short",month:"short",day:"numeric"});
  const fmtTime = iso => new Date(iso).toLocaleTimeString(isAr?"ar-EG":"en-US",{hour:"numeric",minute:"2-digit"});
  const canSubmit = hasTemplate ? !!selectedSlot : true;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", display:"flex",
      alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
      <div style={{ ...card, background:"#0d1a2e", width:"100%", maxWidth:480,
        maxHeight:"88dvh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,.5)" }}>

        {/* Header */}
        <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:18 }}>
          <Avatar name={therapist.name} size={48}/>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:TEXT }}>{isAr?"حجز مع":"Book with"} {therapist.name}</div>
            <div style={{ fontSize:12, color:MUTED }}>{therapist.city}{therapist.specialties?.[0] ? ` · ${therapist.specialties[0]}`:""}</div>
          </div>
        </div>

        {/* Price */}
        <div style={{ padding:"12px 16px", borderRadius:10, marginBottom:16,
          background: eliteCredit?"rgba(212,175,55,.08)":"rgba(13,148,136,.08)",
          border: `1px solid ${eliteCredit?"rgba(212,175,55,.25)":"rgba(13,148,136,.2)"}` }}>
          {eliteCredit ? (
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18 }}>🎁</span>
              <div>
                <div style={{ fontWeight:700, color:"#d4af37" }}>{isAr?"مجاني — جزء من عضوية Elite بتاعتك":"Free — included in your Elite membership"}</div>
                <div style={{ fontSize:11.5, color:MUTED, textDecoration:"line-through" }}>{money(therapist.session_fee_cents,therapist.currency,isAr)}</div>
              </div>
            </div>
          ) : (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:11, color:MUTED }}>{isAr?"رسوم الجلسة":"Session fee"}</div>
                <div style={{ fontSize:18, fontWeight:800, color:TEALLT }}>
                  {discountInfo?.valid
                    ? money(Math.round(therapist.session_fee_cents*(1-discountInfo.discount_pct/100)),therapist.currency,isAr)
                    : money(therapist.session_fee_cents,therapist.currency,isAr)}
                </div>
                {discountInfo?.valid && (
                  <div style={{ fontSize:11, color:MUTED, textDecoration:"line-through" }}>{money(therapist.session_fee_cents,therapist.currency,isAr)}</div>
                )}
              </div>
              <div style={{ textAlign:"end" }}>
                <div style={lbl}>{isAr?"كود خصم":"Discount code"}</div>
                <div style={{ display:"flex", gap:6 }}>
                  <input style={{ ...inp, width:130 }} placeholder="CLINIC-XXXX"
                    value={discountCode}
                    onChange={e=>{setDiscountCode(e.target.value.toUpperCase());setDiscountInfo(null);}}
                    onKeyDown={e=>e.key==="Enter"&&checkCode()}/>
                  <button style={{ ...btnG, padding:"6px 10px", fontSize:12 }}
                    onClick={checkCode} disabled={checkingCode||!discountCode.trim()}>
                    {checkingCode?"…":(isAr?"تطبيق":"Apply")}
                  </button>
                </div>
                {discountInfo && (
                  <div style={{ fontSize:11, marginTop:4, color:discountInfo.valid?"#5eead4":"#f87171" }}>
                    {discountInfo.valid
                      ? `✓ ${discountInfo.discount_pct}% off`
                      : (isAr?"كود غير صحيح":"Invalid code")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Slots */}
        {slots===null && <div style={{ fontSize:12.5, color:MUTED, marginBottom:14 }}>{isAr?"جاري تحميل المواعيد…":"Loading times…"}</div>}
        {slots!==null && hasTemplate && (
          <div style={{ marginBottom:14 }}>
            <div style={lbl}>{isAr?"اختار ميعاد متاح":"Pick a time slot"}</div>
            {Object.keys(slotsByDay).length===0
              ? <div style={{ fontSize:12.5, color:MUTED }}>{isAr?"مفيش مواعيد قريبًا":"No upcoming slots"}</div>
              : <div style={{ display:"flex", flexDirection:"column", gap:10, maxHeight:200, overflowY:"auto" }}>
                  {Object.entries(slotsByDay).map(([day,times])=>(
                    <div key={day}>
                      <div style={{ fontSize:11, color:MUTED, fontWeight:700, marginBottom:5 }}>{fmtDay(day)}</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {times.map(iso=>(
                          <button key={iso} onClick={()=>setSelectedSlot(iso)}
                            style={{ padding:"6px 13px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
                              background: selectedSlot===iso?"rgba(13,148,136,.22)":"rgba(255,255,255,.03)",
                              border: selectedSlot===iso?"1px solid rgba(13,148,136,.5)":`1px solid ${BORDER}`,
                              color: selectedSlot===iso?TEALLT:SUB }}>
                            {fmtTime(iso)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}
        {slots!==null && !hasTemplate && (
          <div style={{ marginBottom:14 }}>
            <div style={lbl}>{isAr?"الميعاد المفضل":"Preferred time"}</div>
            <input style={inp} placeholder={isAr?"مثال: الخميس بعد الظهر":"e.g. Thursday afternoon"}
              value={preferredTime} onChange={e=>setPreferredTime(e.target.value)}/>
            <div style={{ fontSize:11, color:MUTED, marginTop:5 }}>
              {isAr?"المعالج هيتواصل معاك لتأكيد الميعاد":"Therapist will follow up to confirm"}
            </div>
          </div>
        )}

        <div style={{ marginBottom:16 }}>
          <div style={lbl}>{isAr?"ملاحظات":"Notes (optional)"}</div>
          <textarea style={{ ...inp, minHeight:70, resize:"vertical" }}
            placeholder={isAr?"صف حالتك أو طلبك الخاص…":"Describe your issue or any special requests…"}
            value={notes} onChange={e=>setNotes(e.target.value)}/>
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={btnG} onClick={onClose} disabled={loading}>{isAr?"إلغاء":"Cancel"}</button>
          <button style={{ ...btnP, opacity:canSubmit?1:.5 }} disabled={loading||!canSubmit}
            onClick={()=>onSubmit(
              hasTemplate ? `${fmtDay(new Date(selectedSlot).toDateString())} ${fmtTime(selectedSlot)}` : preferredTime,
              notes, selectedSlot, discountInfo?.valid?discountCode:"")}>
            {loading ? (isAr?"جاري الحجز…":"Booking…") : (isAr?"تأكيد الحجز والدفع":"Confirm & Pay")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Coming Soon (booking not live yet) ──────────────────────── */
function ComingSoonModal({ therapistName, isAr, cs, tk, onClose }) {
  if(!cs||!tk){ cs={card:"#111827",border:"rgba(255,255,255,.07)",inp:"rgba(0,0,0,.3)",inpB:"rgba(255,255,255,.15)",muted:"#64748b",text:"#e2e8f0",bg:"#0a0f1e"}; tk=mkT(cs); }
  const { TEXT, MUTED } = tk;
  const btnP = tk.btnP;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.65)", display:"flex",
      alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#0d1a2e", border:"1px solid rgba(13,148,136,.3)", borderRadius:18,
        width:"100%", maxWidth:400, padding:"32px 26px", textAlign:"center",
        boxShadow:"0 24px 64px rgba(0,0,0,.5)" }}>
        <div style={{ width:56, height:56, borderRadius:16, margin:"0 auto 16px",
          background:"linear-gradient(135deg,#0d9488,#0891b2)", display:"flex",
          alignItems:"center", justifyContent:"center", fontSize:26,
          boxShadow:"0 8px 20px rgba(13,148,136,.35)" }}>🚀</div>
        <div style={{ fontSize:17, fontWeight:800, color:TEXT, marginBottom:8 }}>
          {isAr ? "الحجز قريبًا" : "Booking is coming soon"}
        </div>
        <div style={{ fontSize:13, color:MUTED, lineHeight:1.6, marginBottom:22 }}>
          {isAr
            ? <>إحنا حاليًا بنتعاقد مع عيادات علاج طبيعي معتمدة عشان نقدملك حجز حقيقي وآمن{therapistName?<> — حجزك مع <strong style={{color:TEALLT}}>{therapistName}</strong> هيبقى متاح أول ما نطلق</>:""}. تابعنا، مش هياخد وقت طويل!</>
            : <>We're currently partnering with certified physiotherapy clinics to bring you real, secure bookings{therapistName?<> — booking with <strong style={{color:TEALLT}}>{therapistName}</strong> will open the moment we launch</>:""}. Stay tuned, it won't be long!</>}
        </div>
        <button style={{ ...btnP, width:"100%" }} onClick={onClose}>
          {isAr ? "تمام" : "Got it"}
        </button>
      </div>
    </div>
  );
}

/* ── Admin panels (unchanged logic, minor style cleanup) ──────── */
// NOTE: these 4 components previously referenced bare `card`/`MUTED`/`SUB`/
// `TEALLT`(ok, that one's a module const)/`btnP`/`btnG`/`lbl`/`inp`/`border`
// identifiers that were never defined in their own scope (not props, not
// module-level consts, not local vars) — every one of `AdminMarketplaceManager`
// / `AdminPayoutsManager` / `AdminBookingsManager` / `AdminTherapistManager`
// threw `ReferenceError` the instant a real admin opened the "Manage" tab,
// which is what actually made that whole tab unusable, not a styling issue.
// Fixed by threading `cs`/`tk` through the same way every other component in
// this file already does (mkT(cs) once, destructure the pieces each
// component needs).
function AdminMarketplaceManager({ isAr, addToast, adminUid, cs }) {
  if(!cs){ cs={card:"#111827",border:"rgba(255,255,255,.07)",inp:"rgba(0,0,0,.3)",inpB:"rgba(255,255,255,.15)",muted:"#64748b",text:"#e2e8f0",bg:"#0a0f1e"}; }
  const tk = mkT(cs);
  const [subTab, setSubTab] = useState("therapists");
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <Tab active={subTab==="therapists"} onClick={()=>setSubTab("therapists")} cs={cs}>{isAr?"الأخصائيون":"Therapists"}</Tab>
        <Tab active={subTab==="bookings"}   onClick={()=>setSubTab("bookings")} cs={cs}>{isAr?"الحجوزات":"Bookings"}</Tab>
        <Tab active={subTab==="payouts"}    onClick={()=>setSubTab("payouts")} cs={cs}>{isAr?"المستحقات":"Payouts"}</Tab>
      </div>
      {subTab==="therapists" && <AdminTherapistManager isAr={isAr} addToast={addToast} cs={cs} tk={tk}/>}
      {subTab==="bookings"   && <AdminBookingsManager  isAr={isAr} addToast={addToast} adminUid={adminUid} cs={cs} tk={tk}/>}
      {subTab==="payouts"    && <AdminPayoutsManager   isAr={isAr} addToast={addToast} cs={cs} tk={tk}/>}
    </div>
  );
}

/* Reuse existing admin sub-components with minimal wiring */
function AdminPayoutsManager({ isAr, addToast, tk }) {
  const { MUTED } = tk; const card = tk.card; const btnP = tk.btnP;
  const [payouts,setPayouts]=useState([]); const [loading,setLoading]=useState(true); const [payingId,setPayingId]=useState(null);
  const load=()=>{setLoading(true);MarketplaceAPI.adminPayouts().then(d=>setPayouts(d?.payouts||[])).catch(e=>addToast?.(e.message,"error")).finally(()=>setLoading(false));};
  useEffect(()=>{load();},[]);
  const markPaid=async p=>{
    if(!window.confirm(isAr?`تأكيد الدفع لـ ${p.therapist_name}؟`:`Confirm paid to ${p.therapist_name}?`))return;
    setPayingId(p.therapist_id);
    try{await MarketplaceAPI.adminMarkPaid(p.booking_ids);addToast?.(isAr?"اتسجل الدفع":"Marked paid","success");load();}
    catch(e){addToast?.(e.message,"error");}finally{setPayingId(null);}
  };
  if(loading)return<div style={{color:MUTED}}>{isAr?"جاري التحميل…":"Loading…"}</div>;
  if(!payouts.length)return<div style={{...card,textAlign:"center",color:MUTED}}>{isAr?"مفيش مستحقات معلقة":"No pending payouts"}</div>;
  return(<div style={{display:"flex",flexDirection:"column",gap:10}}>
    {payouts.map(p=>(<div key={p.therapist_id} style={{...card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div><div style={{fontWeight:700}}>{p.therapist_name}</div><div style={{fontSize:12,color:MUTED}}>{p.booking_count} sessions · {money(p.gross_cents,p.currency,isAr)} gross</div></div>
      <div style={{textAlign:"end"}}><div style={{fontWeight:800,color:TEALLT,fontSize:16}}>{money(p.payout_cents,p.currency,isAr)}</div>
      <button style={{...btnP,fontSize:11.5,padding:"5px 12px",marginTop:6}} onClick={()=>markPaid(p)} disabled={payingId===p.therapist_id}>{payingId===p.therapist_id?"…":(isAr?"تم الدفع":"Mark paid")}</button></div>
    </div>))}
  </div>);
}

function AdminBookingsManager({ isAr, addToast, adminUid, tk }) {
  const { MUTED, SUB } = tk; const card = tk.card;
  const [bookings,setBookings]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{MarketplaceAPI.adminListBookings().then(d=>setBookings(d?.bookings||[])).catch(e=>addToast?.(e.message,"error")).finally(()=>setLoading(false));},[]);
  if(loading)return<div style={{color:MUTED}}>{isAr?"جاري التحميل…":"Loading…"}</div>;
  if(!bookings.length)return<div style={{...card,textAlign:"center",color:MUTED}}>{isAr?"مفيش حجوزات":"No bookings"}</div>;
  return(<div style={{display:"flex",flexDirection:"column",gap:10}}>
    {bookings.map(b=>(<div key={b.id} style={card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontWeight:700}}>{b.therapist_name}</div><div style={{fontSize:12,color:MUTED}}>{b.preferred_time||(isAr?"الميعاد لسه مش متحدد":"Time not set")}</div></div>
        <div style={{textAlign:"end"}}><div style={{fontWeight:700,color:TEALLT}}>{money(b.amount_cents,b.currency,isAr)}</div><Pill text={b.status?.replace(/_/g," ")} color={STATUS_COLORS[b.status]||MUTED}/></div>
      </div>
      {b.notes&&<div style={{fontSize:12.5,color:SUB,marginTop:8}}>📝 {b.notes}</div>}
    </div>))}
  </div>);
}

function AdminTherapistManager({ isAr, addToast, tk }) {
  const { MUTED, SUB, BORDER } = tk; const card = tk.card; const inp = tk.inp;
  const btnP = tk.btnP; const btnG = tk.btnG; const lbl = tk.lbl; const border = BORDER;
  const [list,setList]=useState([]); const [showNew,setShowNew]=useState(false);
  const [form,setForm]=useState({name:"",city:"",bio:"",specialties:"",session_fee_cents:"",currency:"EGP",years_experience:"",partner_type:"individual",discount_pct:"",bulk_seats:""});
  const [availability,setAvailability]=useState({}); const [saving,setSaving]=useState(false);
  const DAYS=[{key:"mon",en:"Mon",ar:"إثنين"},{key:"tue",en:"Tue",ar:"ثلاثاء"},{key:"wed",en:"Wed",ar:"أربعاء"},{key:"thu",en:"Thu",ar:"خميس"},{key:"fri",en:"Fri",ar:"جمعة"},{key:"sat",en:"Sat",ar:"سبت"},{key:"sun",en:"Sun",ar:"أحد"}];
  const SLOTS=["09:00","11:00","13:00","15:00","17:00","19:00"];
  const toggleSlot=(day,time)=>setAvailability(prev=>{const cur=prev[day]||[];return{...prev,[day]:cur.includes(time)?cur.filter(t=>t!==time):[...cur,time].sort()};});
  const load=()=>MarketplaceAPI.adminListTherapists().then(d=>setList(d?.therapists||[])).catch(()=>{});
  useEffect(()=>{load();},[]);
  const save=async()=>{
    if(!form.name.trim()||!form.session_fee_cents){addToast?.(isAr?"الاسم والسعر مطلوبين":"Name and fee required","error");return;}
    setSaving(true);
    try{
      const res=await MarketplaceAPI.adminCreateTherapist({...form,session_fee_cents:Math.round(parseFloat(form.session_fee_cents)*100),years_experience:parseInt(form.years_experience)||0,specialties:form.specialties.split(",").map(s=>s.trim()).filter(Boolean),availability_template:Object.fromEntries(Object.entries(availability).filter(([,v])=>v.length>0)),discount_pct:form.partner_type==="clinic"?(parseFloat(form.discount_pct)||0):undefined,bulk_seats:form.partner_type==="clinic"?(parseInt(form.bulk_seats)||0):undefined});
      setForm({name:"",city:"",bio:"",specialties:"",session_fee_cents:"",currency:"EGP",years_experience:"",partner_type:"individual",discount_pct:"",bulk_seats:""});setAvailability({});setShowNew(false);load();
      addToast?.(res?.discount_code?(isAr?`تمت الإضافة — كود العيادة: ${res.discount_code}`:`Added — clinic code: ${res.discount_code}`):(isAr?"تمت الإضافة":"Added"),"success");
    }catch(e){addToast?.(e.message,"error");}finally{setSaving(false);}
  };
  const toggleStatus=async th=>{await MarketplaceAPI.adminUpdateTherapist(th.id,{status:th.status==="active"?"paused":"active"}).catch(()=>{});load();};
  return(
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
        <button style={btnP} onClick={()=>setShowNew(s=>!s)}>{showNew?(isAr?"إغلاق":"Close"):(isAr?"+ إضافة أخصائي":"+ Add Therapist")}</button>
      </div>
      {showNew&&(
        <div style={{...card,marginBottom:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><div style={lbl}>{isAr?"الاسم":"Name"}</div><input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
          <div><div style={lbl}>{isAr?"المدينة":"City"}</div><input style={inp} value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/></div>
          <div><div style={lbl}>{isAr?"سعر الجلسة (EGP)":"Fee (EGP)"}</div><input style={inp} type="number" value={form.session_fee_cents} onChange={e=>setForm(f=>({...f,session_fee_cents:e.target.value}))}/></div>
          <div><div style={lbl}>{isAr?"سنوات الخبرة":"Years exp"}</div><input style={inp} type="number" value={form.years_experience} onChange={e=>setForm(f=>({...f,years_experience:e.target.value}))}/></div>
          <div style={{gridColumn:"1 / -1"}}><div style={lbl}>{isAr?"التخصصات (فاصلة)":"Specialties (comma)"}</div><input style={inp} value={form.specialties} onChange={e=>setForm(f=>({...f,specialties:e.target.value}))}/></div>
          <div style={{gridColumn:"1 / -1"}}><div style={lbl}>{isAr?"نبذة":"Bio"}</div><textarea style={{...inp,minHeight:60}} value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))}/></div>
          <div style={{gridColumn:"1 / -1",borderTop:`1px solid ${BORDER}`,paddingTop:12}}>
            <div style={lbl}>{isAr?"نوع الشريك":"Partner type"}</div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              {[["individual",isAr?"فردي":"Individual"],["clinic",isAr?"عيادة":"Clinic"]].map(([v,l])=>(
                <button key={v} style={{...btnG,background:form.partner_type===v?"rgba(94,234,212,.1)":undefined,borderColor:form.partner_type===v?TEALLT:undefined}} onClick={()=>setForm(f=>({...f,partner_type:v}))}>{l}</button>
              ))}
            </div>
            {form.partner_type==="clinic"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><div style={lbl}>{isAr?"خصم المرضى %":"Patient discount %"}</div><input style={inp} type="number" min="0" max="100" value={form.discount_pct} onChange={e=>setForm(f=>({...f,discount_pct:e.target.value}))}/></div>
                <div><div style={lbl}>{isAr?"مقاعد جماعية":"Bulk seats"}</div><input style={inp} type="number" min="0" value={form.bulk_seats} onChange={e=>setForm(f=>({...f,bulk_seats:e.target.value}))}/></div>
              </div>
            )}
          </div>
          <div style={{gridColumn:"1 / -1"}}>
            <div style={lbl}>{isAr?"المواعيد الأسبوعية (اختياري)":"Weekly availability (optional)"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {DAYS.map(d=>(
                <div key={d.key} style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:40,fontSize:11,color:SUB,flexShrink:0}}>{isAr?d.ar:d.en}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {SLOTS.map(t=>{const a=(availability[d.key]||[]).includes(t);return(
                      <button key={t} type="button" onClick={()=>toggleSlot(d.key,t)}
                        style={{padding:"3px 8px",borderRadius:6,fontSize:10.5,fontWeight:600,cursor:"pointer",
                          background:a?"rgba(13,148,136,.2)":"transparent",border:a?"1px solid rgba(13,148,136,.5)":border,color:a?TEALLT:MUTED}}>
                        {t}
                      </button>
                    );})}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{gridColumn:"1 / -1",textAlign:"end"}}>
            <button style={btnP} onClick={save} disabled={saving}>{saving?"…":(isAr?"حفظ":"Save")}</button>
          </div>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {list.map(th=>(
          <div key={th.id} style={{...card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700}}>{th.name} <Pill text={th.status} color={th.status==="active"?TEALLT:"#f87171"}/></div>
              <div style={{fontSize:12,color:MUTED}}>{th.city} · {money(th.session_fee_cents,th.currency,isAr)}</div>
            </div>
            <button style={btnG} onClick={()=>toggleStatus(th)}>{th.status==="active"?(isAr?"إيقاف":"Pause"):(isAr?"تفعيل":"Activate")}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══ Main component ═════════════════════════════════════════════ */
export function TherapistMarketplace({ cs, t, darkMode, lang="en", user, isAdmin, tier, onBack, addToast }) {
  useBodyScrollLock();
  const isAr = lang === "ar";
  const tk = mkT(cs);
  const { BORDER, TEXT, MUTED, SUB, CARD } = tk;
  const card = tk.card; const lbl = tk.lbl; const inp = tk.inp;
  const btnP = tk.btnP; const btnG = tk.btnGh;
  const [tab, setTab]               = useState("browse");
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [err, setErr]               = useState(null);
  const [cityFilter, setCityFilter] = useState("");
  const [specFilter, setSpecFilter] = useState("");
  const [selected, setSelected]     = useState(null);
  const [comingSoonFor, setComingSoonFor] = useState(null); // therapist clicked while booking isn't live
  const [booking, setBooking]       = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [demoMode, setDemoMode]     = useState(false);
  const [cancellingId, setCancellingId]   = useState(null);
  const [eliteCredit, setEliteCredit]     = useState(false);
  const [ratingId, setRatingId]           = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(()=>{
    if(!tierAtLeast(tier,"elite")) return;
    MarketplaceAPI.eliteCreditStatus().then(d=>setEliteCredit(!!d?.available)).catch(()=>{});
  },[tier]);

  const load = useCallback(()=>{
    setLoading(true); setErr(null);
    MarketplaceAPI.listTherapists(cityFilter?{city:cityFilter}:{})
      .then(d=>{ setTherapists(d?.therapists||[]); setDemoMode(false); })
      .catch(e=>{
        // Previously only e.isBackendDown (network failure / 404 / non-JSON
        // response) fell back to demo data — any other failure (e.g. a real
        // 500 from the backend, like the Firebase Admin credentials
        // misconfiguration this actually hit in production) fell through to
        // setErr and rendered the raw server error message as the entire
        // page content, with no therapists shown and no way to recover.
        // Any failure now degrades to the same demo experience instead —
        // the user always sees a working (if demo-labeled) marketplace, and
        // the real error is still logged for whoever's watching the console
        // / error monitoring, just not dumped onto the page.
        console.error("[Marketplace] listTherapists failed, showing demo data:", e);
        const f = cityFilter
          ? DEMO_THERAPISTS.filter(t=>t.city.toLowerCase().includes(cityFilter.toLowerCase()))
          : DEMO_THERAPISTS;
        setTherapists(f); setDemoMode(true);
      })
      .finally(()=>setLoading(false));
  },[cityFilter]);

  // Debounced: cityFilter changes on every keystroke, and load()'s identity
  // (useCallback deps) changes with it — without debouncing this fired one
  // full network request per keystroke while typing a city name.
  useEffect(()=>{
    if(tab!=="browse") return;
    const t = setTimeout(load, 350);
    return ()=>clearTimeout(t);
  },[tab,load]);

  useEffect(()=>{
    if(tab==="mine"){
      if(demoMode){ setMyBookings(getDemoBookings()); return; }
      MarketplaceAPI.myBookings()
        .then(d=>setMyBookings(d?.bookings||[]))
        .catch(e=>{
          // Was gated on e.isBackendDown only — any other failure (e.g. the
          // same Firebase Admin misconfiguration listTherapists can hit)
          // silently left myBookings as [], which renders identically to
          // "you genuinely have zero bookings" — misleading, not just ugly.
          // Same policy as listTherapists now: degrade to demo, don't lie
          // about the reason by looking like an empty state.
          console.error("[Marketplace] myBookings failed, showing demo data:", e);
          setDemoMode(true); setMyBookings(getDemoBookings());
        });
    }
  },[tab,demoMode]);

  const handleBookClick = (th) => {
    if (!BOOKING_LIVE) { setComingSoonFor(th); return; }
    setSelected(th);
  };

  const submitBooking = async(preferredTime,notes,slotDatetime,discountCode)=>{
    if(!selected) return;
    setBooking(true);
    try{
      if(demoMode){
        createDemoBooking({therapist:selected,preferredTime,notes});
        addToast?.(isAr?"✓ حجز تجريبي اتأكد":"✓ Demo booking confirmed","success");
        setSelected(null); return;
      }
      const res = await MarketplaceAPI.createBooking({therapist_id:selected.id,preferred_time:preferredTime,slot_datetime:slotDatetime||undefined,notes,discount_code:discountCode||undefined,billing_data:{email:user?.email||""}});
      if(res?.payment?.redirect_url){ window.open(res.payment.redirect_url,"_blank"); addToast?.(isAr?"افتحنا صفحة الدفع":"Payment page opened","success"); }
      else if(res?.covered_by_corvus){ addToast?.(isAr?"🎉 اتحجزت مجانًا — Elite":"🎉 Booked free — Elite membership","success"); setEliteCredit(false); }
      else addToast?.(isAr?"اتسجل الحجز":"Booking recorded","success");
      setSelected(null);
    }catch(e){
      if(e.isBackendDown){ setDemoMode(true); createDemoBooking({therapist:selected,preferredTime,notes}); addToast?.(isAr?"✓ حجز تجريبي":"✓ Demo booking","success"); setSelected(null); }
      else addToast?.(e.message||(isAr?"خطأ":"Error"),"error");
    }finally{ setBooking(false); }
  };

  const cancelBooking = async b=>{
    if(!window.confirm(isAr?"تأكيد إلغاء الحجز؟":"Confirm cancellation?")) return;
    setCancellingId(b.id);
    try{
      await MarketplaceAPI.cancelBooking(b.id);
      setMyBookings(p=>p.map(x=>x.id===b.id?{...x,status:"cancelled"}:x));
      addToast?.(isAr?"تم الإلغاء":"Cancelled","success");
    }catch(e){ addToast?.(e.message||(isAr?"تعذر الإلغاء":"Couldn't cancel"),"error"); }
    finally{ setCancellingId(null); }
  };

  const submitReview = async(b,rating,comment)=>{
    setSubmittingReview(true);
    try{
      if(b.is_demo){ const all=updateDemoBooking(b.id,{rating,review_text:comment}); setMyBookings(all); }
      else{ await MarketplaceAPI.reviewBooking(b.id,{rating,comment}); setMyBookings(p=>p.map(x=>x.id===b.id?{...x,rating,review_text:comment}:x)); }
      addToast?.(isAr?"شكرًا على تقييمك":"Thanks for your review","success");
      setRatingId(null);
    }catch(e){ addToast?.(e.message||(isAr?"تعذر":"Error"),"error"); }
    finally{ setSubmittingReview(false); }
  };

  /* All unique specialties for filter chips */
  const allSpecs = [...new Set(therapists.flatMap(t=>t.specialties||[]))];
  const filtered = therapists.filter(t =>
    (!specFilter || t.specialties?.includes(specFilter))
  );

  return (
    <div dir={isAr?"rtl":"ltr"} style={{ color:TEXT, background:cs.bg, minHeight:"100vh" }}>

      {/* ── Header — full-bleed bar, edge to edge, like the rest of the
          site's page chrome (HomePage's topbar, HRPanel's tab bar) — the
          page used to be one single maxWidth:1000 column floating in the
          middle of the viewport with the raw page background exposed as
          two big flat gutters on either side; only the scrollable content
          below is width-capped now, same convention those pages use. ── */}
      <div style={{ borderBottom:`1px solid ${BORDER}`, background:cs.card }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"18px 20px",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          gap:16, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:12, flexShrink:0,
              background:`linear-gradient(135deg,${TEAL},#0891b2)`, display:"flex",
              alignItems:"center", justifyContent:"center", fontSize:20,
              boxShadow:"0 4px 14px rgba(13,148,136,.3)" }}>🩺</div>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <h1 style={{ margin:0, fontSize:19, fontWeight:900, color:TEXT }}>
                  {isAr?"دليل أخصائيي العلاج الطبيعي":"Physiotherapist Marketplace"}
                </h1>
                {demoMode && (
                  <span style={{ fontSize:10, fontWeight:700, color:MUTED, background:"rgba(255,255,255,.05)",
                    border:`1px solid ${BORDER}`, borderRadius:6, padding:"3px 8px" }}>
                    {isAr?"وضع تجريبي":"Demo"}
                  </span>
                )}
              </div>
              <p style={{ margin:"3px 0 0", fontSize:12.5, color:MUTED }}>
                {isAr?"احجز جلسة مع أخصائي معتمد — دفع آمن عبر Kashier":"Book with a vetted therapist — secure payment via Kashier"}
              </p>
            </div>
          </div>
          {onBack && (
            <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:6,
              background:cs.inp, border:`0.5px solid ${BORDER}`, borderRadius:9,
              padding:"8px 15px", fontSize:12, fontWeight:600, color:MUTED, cursor:"pointer",
              flexShrink:0, transition:"color .15s, border-color .15s" }}
              onMouseEnter={e=>{e.currentTarget.style.color=TEXT;e.currentTarget.style.borderColor="rgba(13,148,136,.4)";}}
              onMouseLeave={e=>{e.currentTarget.style.color=MUTED;e.currentTarget.style.borderColor=BORDER;}}>
              <span>{isAr?"→":"←"}</span>{isAr?"رجوع":"Back"}
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 20px" }}>

      {/* ── Coming soon notice — booking isn't live yet ── */}
      {!BOOKING_LIVE && (
        <div style={{ marginBottom:18, padding:"12px 18px", borderRadius:12,
          background:"linear-gradient(135deg,rgba(13,148,136,.1),rgba(8,145,178,.05))",
          border:"1px solid rgba(13,148,136,.25)", display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:20 }}>🚀</span>
          <div style={{ fontSize:12.5, color:MUTED, lineHeight:1.5 }}>
            <strong style={{ color:TEALLT }}>{isAr?"قريبًا":"Coming soon"}</strong>{" — "}
            {isAr
              ? "إحنا حاليًا بنتعاقد مع عيادات علاج طبيعي معتمدة. اللي تحت ده معاينة لشكل الخدمة — الحجز الفعلي هيتفعّل قريب."
              : "We're currently contracting with certified physiotherapy clinics. What's below is a preview of the service — real booking opens soon."}
          </div>
        </div>
      )}

      {/* ── Elite free credit banner ── */}
      {BOOKING_LIVE && eliteCredit && (
        <div style={{ marginBottom:18, padding:"12px 18px", borderRadius:12,
          background:"linear-gradient(135deg,rgba(212,175,55,.12),rgba(184,134,11,.06))",
          border:"1px solid rgba(212,175,55,.3)", display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:22 }}>🎁</span>
          <div style={{ fontSize:13, color:"#e2e8f0" }}>
            <strong style={{ color:"#d4af37" }}>{isAr?"جلسة مجانية متاحة!":"Free session available!"}</strong>
            {" "}{isAr?"عندك جلسة مجانية مع أي أخصائي الشهر ده — جزء من عضوية Elite بتاعتك":"Your Elite membership includes one free physio session this month"}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        <Tab active={tab==="browse"} onClick={()=>setTab("browse")} cs={cs}>{isAr?"تصفح الأخصائيين":"Browse"}</Tab>
        <Tab active={tab==="mine"}   onClick={()=>setTab("mine")} cs={cs}>
          {isAr?"حجوزاتي":"My Bookings"}
          {myBookings.filter(b=>b.status!=="cancelled").length > 0 && (
            <span style={{ marginInlineStart:6, background:TEAL, color:"#fff", borderRadius:99,
              fontSize:10, fontWeight:800, padding:"1px 6px" }}>
              {myBookings.filter(b=>b.status!=="cancelled").length}
            </span>
          )}
        </Tab>
        {isAdmin && <Tab active={tab==="admin"} onClick={()=>setTab("admin")} cs={cs}>{isAr?"إدارة":"Manage"}</Tab>}
      </div>

      {/* ══ Browse tab ══ */}
      {tab==="browse" && (
        <>
          {/* Filters */}
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"flex-end" }}>
            <div style={{ minWidth:180 }}>
              <div style={lbl}>{isAr?"المدينة":"City"}</div>
              <input style={{ ...inp, paddingInlineStart:32, backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\")",
                backgroundRepeat:"no-repeat", backgroundPosition:"10px center" }}
                placeholder={isAr?"مثال: القاهرة":"e.g. Cairo"}
                value={cityFilter} onChange={e=>setCityFilter(e.target.value)}/>
            </div>
          </div>

          {/* Specialty filter chips */}
          {allSpecs.length > 0 && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
              <button onClick={()=>setSpecFilter("")}
                style={{ padding:"5px 13px", borderRadius:99, fontSize:11.5, fontWeight:600, cursor:"pointer",
                  background:!specFilter?"rgba(13,148,136,.2)":"rgba(255,255,255,.04)",
                  border:`1px solid ${!specFilter?"rgba(13,148,136,.5)":BORDER}`,
                  color:!specFilter?TEALLT:MUTED }}>
                {isAr?"الكل":"All"}
              </button>
              {allSpecs.map(s=>(
                <button key={s} onClick={()=>setSpecFilter(specFilter===s?"":s)}
                  style={{ padding:"5px 13px", borderRadius:99, fontSize:11.5, fontWeight:600, cursor:"pointer",
                    background:specFilter===s?"rgba(13,148,136,.2)":"rgba(255,255,255,.04)",
                    border:`1px solid ${specFilter===s?"rgba(13,148,136,.5)":BORDER}`,
                    color:specFilter===s?TEALLT:MUTED }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div style={{ textAlign:"center", padding:"40px 0", color:MUTED }}>
              <div style={{ fontSize:24, marginBottom:8 }}>⏳</div>
              {isAr?"جاري التحميل…":"Loading therapists…"}
            </div>
          )}
          {err && (
            <div style={{ padding:"14px 18px", borderRadius:10, background:"rgba(248,113,113,.08)",
              border:"1px solid rgba(248,113,113,.2)", color:"#f87171", fontSize:13 }}>⚠ {err}</div>
          )}
          {!loading && demoMode && (
            <div style={{ padding:"11px 16px", borderRadius:10, marginBottom:14,
              background:"rgba(255,255,255,.03)", border:`1px solid ${BORDER}`,
              color:MUTED, fontSize:12.5, display:"flex", alignItems:"center", gap:8 }}>
              <span>ℹ️</span>
              <span>{isAr
                ? "مش قادرين نوصل لقائمة الأخصائيين الحقيقية دلوقتي — ده وضع تجريبي للاستعراض بس، محدش هيشوف حجزك ولا هيتحصّل عليه فلوس."
                : "We couldn't reach the real therapist list right now — this is demo data for browsing only. Bookings made here aren't real and won't charge you."}</span>
            </div>
          )}
          {!loading && !err && filtered.length===0 && (
            <div style={{ ...card, textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
              <div style={{ color:TEXT, fontWeight:700, marginBottom:4 }}>
                {isAr?"مفيش أخصائيين بالمواصفات دي":"No therapists match your filters"}
              </div>
              <div style={{ color:MUTED, fontSize:13 }}>
                {isAr?"جرب تغيير المدينة أو التخصص":"Try changing the city or specialty"}
              </div>
            </div>
          )}
          {/* CSS grid's `auto-fill` reserves a track for every column that
              COULD fit the container, even with far fewer cards than that —
              with 1-2 filtered results (e.g. a specialty chip active) the
              real card(s) got squeezed into one narrow left-aligned column
              while the rest of the row sat empty, reading as a broken/
              half-built layout. Flex-wrap with centered justification fixes
              this at any count: a full row lays out left-to-right exactly
              like before, but 1-2 results land centered on the page instead
              of stranded in the top-left corner. */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:14, justifyContent:"center" }}>
            {filtered.map(th=>(
              <div key={th.id} style={{ flex:"1 1 300px", maxWidth:380 }}>
                <TherapistCard th={th} isAr={isAr}
                  eliteCredit={BOOKING_LIVE && eliteCredit} onBook={handleBookClick} cs={cs} tk={tk}/>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══ My Bookings tab ══ */}
      {tab==="mine" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {myBookings.length===0 ? (
            <div style={{ ...card, textAlign:"center", padding:"48px 24px" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📅</div>
              <div style={{ fontWeight:700, color:TEXT, marginBottom:6 }}>
                {isAr?"مفيش حجوزات لسه":"No bookings yet"}
              </div>
              <div style={{ color:MUTED, fontSize:13, marginBottom:18 }}>
                {isAr?"اتصفح الأخصائيين واحجز جلستك الأولى":"Browse therapists and book your first session"}
              </div>
              <button style={btnP} onClick={()=>setTab("browse")}>
                {isAr?"تصفح الأخصائيين →":"Browse therapists →"}
              </button>
            </div>
          ) : (
            myBookings.map(b=>(
              <BookingCard key={b.id} b={b} isAr={isAr}
                currentUid={user?.uid} demoMode={demoMode}
                onCancel={cancelBooking} cancellingId={cancellingId}
                ratingId={ratingId} setRatingId={setRatingId}
                submitReview={submitReview} submittingReview={submittingReview}
                cs={cs} tk={tk}/>
            ))
          )}
        </div>
      )}

      {/* ══ Admin tab ══ */}
      {tab==="admin" && isAdmin && (
        <AdminMarketplaceManager isAr={isAr} addToast={addToast} adminUid={user?.uid} cs={cs}/>
      )}

      </div>

      {/* ══ Booking modal — only reachable once BOOKING_LIVE is true ══ */}
      {BOOKING_LIVE && selected && (
        <BookingModal therapist={selected} isAr={isAr} loading={booking}
          eliteCredit={eliteCredit} cs={cs} tk={tk}
          onClose={()=>setSelected(null)} onSubmit={submitBooking}/>
      )}

      {/* ══ Coming soon notice ══ */}
      {comingSoonFor !== null && (
        <ComingSoonModal therapistName={comingSoonFor?.name} isAr={isAr} cs={cs} tk={tk}
          onClose={()=>setComingSoonFor(null)}/>
      )}
    </div>
  );
}

export default TherapistMarketplace;
