/**
 * Corvus — Physiotherapist Marketplace v1
 * Admin-curated therapist directory + booking flow (PayMob per-session payment).
 * No public self-serve therapist signup yet — see admin "Manage Therapists" tab.
 */
import { useState, useEffect, useCallback } from "react";
import { MarketplaceAPI } from "./services/api.js";
import { DEMO_THERAPISTS, getDemoBookings, createDemoBooking, updateDemoBooking, getDemoMessages, addDemoMessage } from "./marketplaceDemo.js";

const border = "1px solid rgba(255,255,255,.08)";
const card   = { background:"rgba(255,255,255,.03)", border, borderRadius:16, padding:20 };
const label  = { fontSize:11, color:"#64748b", fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:".04em" };
const input  = { width:"100%", background:"rgba(0,0,0,.25)", border, borderRadius:9, color:"#e2e8f0", padding:"9px 12px", fontSize:13, outline:"none", boxSizing:"border-box" };
const btnPrimary = { background:"#0f766e", color:"#fff", border:"none", borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:700, cursor:"pointer" };
const btnGhost   = { background:"transparent", color:"#94a3b8", border, borderRadius:10, padding:"9px 16px", fontSize:13, fontWeight:600, cursor:"pointer" };

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "rgba(15,118,110,.18)" : "transparent",
      color: active ? "#5eead4" : "#94a3b8",
      border: active ? "1px solid rgba(15,118,110,.4)" : border,
      borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
    }}>{children}</button>
  );
}

function money(cents, currency, isAr) {
  if (cents == null) return "—";
  if (cents === 0) return isAr ? "مجانية" : "Free";
  return `${(cents/100).toLocaleString()} ${currency||"EGP"}`;
}

export function TherapistMarketplace({ cs, t, lang="en", user, isAdmin, onBack, addToast }) {
  const isAr = lang === "ar";
  const [tab, setTab]           = useState("browse"); // browse | mine | admin
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [cityFilter, setCityFilter] = useState("");
  const [selected, setSelected] = useState(null);      // therapist being booked
  const [booking, setBooking]   = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [chatBooking, setChatBooking] = useState(null); // booking whose chat thread is open
  const [demoMode, setDemoMode] = useState(false); // true once we've fallen back to local demo data
  const [cancellingId, setCancellingId] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setErr(null);
    MarketplaceAPI.listTherapists(cityFilter ? { city: cityFilter } : {})
      .then(d => { setTherapists(d?.therapists || []); setDemoMode(false); })
      .catch(e => {
        if (e.isBackendDown) {
          // Backend unreachable — fall back to local demo data instead of
          // showing an error, so the feature is still showcaseable.
          const filtered = cityFilter
            ? DEMO_THERAPISTS.filter(t => t.city.toLowerCase().includes(cityFilter.toLowerCase()))
            : DEMO_THERAPISTS;
          setTherapists(filtered);
          setDemoMode(true);
        } else {
          setErr(e.message || "Failed to load");
        }
      })
      .finally(() => setLoading(false));
  }, [cityFilter]);

  useEffect(() => { if (tab === "browse") load(); }, [tab, load]);
  useEffect(() => {
    if (tab === "mine") {
      if (demoMode) { setMyBookings(getDemoBookings()); return; }
      MarketplaceAPI.myBookings()
        .then(d => setMyBookings(d?.bookings || []))
        .catch(e => { if (e.isBackendDown) { setDemoMode(true); setMyBookings(getDemoBookings()); } });
    }
  }, [tab, demoMode]);

  const submitBooking = async (preferredTime, notes, slotDatetime) => {
    if (!selected) return;
    setBooking(true);
    try {
      if (demoMode) {
        // Simulate a confirmed booking locally — no real payment, no real
        // therapist notified. Purely for showcasing the flow end-to-end.
        createDemoBooking({ therapist: selected, preferredTime, notes });
        addToast?.(isAr ? "✓ حجز تجريبي اتأكد (Demo — من غير دفع حقيقي)" : "✓ Demo booking confirmed (no real payment taken)", "success");
        setSelected(null);
        return;
      }
      const res = await MarketplaceAPI.createBooking({
        therapist_id: selected.id,
        preferred_time: preferredTime,
        slot_datetime: slotDatetime || undefined,
        notes,
        billing_data: { email: user?.email || "" },
      });
      if (res?.payment?.iframe_url) {
        window.open(res.payment.iframe_url, "_blank");
        addToast?.(isAr ? "افتحنا صفحة الدفع في تاب جديد" : "Payment page opened in a new tab", "success");
      } else {
        addToast?.(isAr ? "اتسجل طلب الحجز، هيتواصل معاك فريقنا" : "Booking recorded — our team will follow up", "success");
      }
      setSelected(null);
    } catch (e) {
      if (e.isBackendDown) {
        // Retry as a demo booking rather than just showing an error
        setDemoMode(true);
        createDemoBooking({ therapist: selected, preferredTime, notes });
        addToast?.(isAr ? "✓ حجز تجريبي اتأكد (Demo — من غير دفع حقيقي)" : "✓ Demo booking confirmed (no real payment taken)", "success");
        setSelected(null);
      } else {
        addToast?.(e.message || (isAr ? "حصل خطأ" : "Something went wrong"), "error");
      }
    } finally {
      setBooking(false);
    }
  };

  const cancelBooking = async (b) => {
    const wasPaid = b.status === "confirmed";
    const msg = wasPaid
      ? (isAr ? "الحجز ده مدفوع بالفعل — لو ألغيته، فريقنا هيتواصل معاك بخصوص الاسترداد. تأكيد الإلغاء؟"
              : "This booking is already paid — cancelling will flag it for our team to process a refund. Confirm cancellation?")
      : (isAr ? "تأكيد إلغاء الحجز؟" : "Confirm cancelling this booking?");
    if (!window.confirm(msg)) return;
    setCancellingId(b.id);
    try {
      await MarketplaceAPI.cancelBooking(b.id);
      setMyBookings(prev => prev.map(x => x.id === b.id ? { ...x, status: "cancelled" } : x));
      addToast?.(isAr ? "تم إلغاء الحجز" : "Booking cancelled", "success");
    } catch (e) {
      addToast?.(e.message || (isAr ? "تعذر الإلغاء" : "Couldn't cancel"), "error");
    } finally {
      setCancellingId(null);
    }
  };

  const [ratingBookingId, setRatingBookingId] = useState(null); // booking currently showing the rating form
  const [submittingReview, setSubmittingReview] = useState(false);

  const submitReview = async (booking, rating, comment) => {
    setSubmittingReview(true);
    try {
      if (booking.is_demo) {
        // Demo bookings live only in localStorage — update them there directly.
        const all = updateDemoBooking(booking.id, { rating, review_text: comment });
        setMyBookings(all);
      } else {
        await MarketplaceAPI.reviewBooking(booking.id, { rating, comment });
        setMyBookings(prev => prev.map(x => x.id === booking.id ? { ...x, rating, review_text: comment } : x));
      }
      addToast?.(isAr ? "شكرًا على تقييمك" : "Thanks for your review", "success");
      setRatingBookingId(null);
    } catch (e) {
      addToast?.(e.message || (isAr ? "تعذر إرسال التقييم" : "Couldn't submit review"), "error");
    } finally {
      setSubmittingReview(false);
    }
  };


  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px", color: "#e2e8f0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:22, fontWeight:900 }}>{isAr ? "🩺 دليل أخصائيي العلاج الطبيعي" : "🩺 Physiotherapist Marketplace"}</div>
            {demoMode && (
              <span style={{ fontSize:10.5, fontWeight:700, color:"#f59e0b", background:"rgba(245,158,11,.12)",
                border:"1px solid rgba(245,158,11,.3)", borderRadius:6, padding:"3px 8px" }}>
                {isAr ? "⚠ وضع تجريبي — الباك إند مش متاح" : "⚠ Demo Mode — backend unreachable"}
              </span>
            )}
          </div>
          <div style={{ fontSize:13, color:"#64748b", marginTop:4 }}>
            {isAr ? "احجز جلسة مع أخصائي معتمد" : "Book a session with a vetted physiotherapist"}
          </div>
        </div>
        {onBack && <button onClick={onBack} style={btnGhost}>{isAr ? "رجوع" : "Back"}</button>}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        <Tab active={tab==="browse"} onClick={()=>setTab("browse")}>{isAr ? "تصفح" : "Browse"}</Tab>
        <Tab active={tab==="mine"}   onClick={()=>setTab("mine")}>{isAr ? "حجوزاتي" : "My Bookings"}</Tab>
        {isAdmin && <Tab active={tab==="admin"} onClick={()=>setTab("admin")}>{isAr ? "إدارة" : "Manage Therapists"}</Tab>}
      </div>

      {tab === "browse" && (
        <>
          <div style={{ marginBottom:16, maxWidth:260 }}>
            <div style={label}>{isAr ? "المدينة" : "City"}</div>
            <input style={input} placeholder={isAr ? "مثال: القاهرة" : "e.g. Cairo"} value={cityFilter}
                   onChange={e=>setCityFilter(e.target.value)} />
          </div>
          {loading && <div style={{ color:"#64748b" }}>{isAr ? "جاري التحميل…" : "Loading…"}</div>}
          {err && <div style={{ color:"#f87171" }}>{err}</div>}
          {!loading && !err && therapists.length === 0 && (
            <div style={{ ...card, textAlign:"center", color:"#64748b" }}>
              {isAr ? "لا يوجد أخصائيين متاحين دلوقتي" : "No therapists available right now"}
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
            {therapists.map(th => (
              <div key={th.id} style={card}>
                <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:10 }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(15,118,110,.25)",
                                display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800 }}>
                    {th.name?.[0] || "?"}
                  </div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:15 }}>{th.name}</div>
                    <div style={{ fontSize:12, color:"#64748b" }}>{th.city}{th.years_experience ? ` · ${th.years_experience}${isAr?" سنة خبرة":"y exp"}` : ""}</div>
                    {th.rating && (
                      <div style={{ fontSize:11.5, color:"#fbbf24", marginTop:2 }}>
                        {"★".repeat(Math.round(th.rating))}{"☆".repeat(5-Math.round(th.rating))}
                        <span style={{ color:"#64748b", marginLeft:4 }}>{th.rating} ({th.review_count})</span>
                      </div>
                    )}
                  </div>
                </div>
                {th.specialties?.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                    {th.specialties.map(s => (
                      <span key={s} style={{ fontSize:10.5, background:"rgba(255,255,255,.06)", borderRadius:6, padding:"3px 8px", color:"#a5f3fc" }}>{s}</span>
                    ))}
                  </div>
                )}
                {th.bio && <div style={{ fontSize:12.5, color:"#94a3b8", marginBottom:12, lineHeight:1.5 }}>{th.bio}</div>}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontWeight:800, fontSize:14, color:"#5eead4" }}>{money(th.session_fee_cents, th.currency, isAr)}</div>
                  <button style={btnPrimary} onClick={()=>setSelected(th)}>{isAr ? "احجز" : "Book"}</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "mine" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {myBookings.length === 0 && <div style={{ ...card, textAlign:"center", color:"#64748b" }}>{isAr ? "مفيش حجوزات لسه" : "No bookings yet"}</div>}
          {myBookings.map(b => (
            <div key={b.id} style={card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:700 }}>{b.therapist_name}</div>
                  <div style={{ fontSize:12, color:"#64748b" }}>{b.preferred_time || (isAr ? "الميعاد لسه مش متحدد" : "Time not set")}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:700, color:"#5eead4" }}>{money(b.amount_cents, b.currency, isAr)}</div>
                  <div style={{ fontSize:11, color:"#94a3b8", textTransform:"capitalize" }}>{b.status?.replace(/_/g," ")}</div>
                </div>
              </div>
              <div style={{ marginTop:12, borderTop:border, paddingTop:12, display:"flex", gap:8, flexWrap:"wrap" }}>
                <button style={{ ...btnGhost, fontSize:12, padding:"6px 14px" }}
                        onClick={()=>setChatBooking(chatBooking?.id===b.id ? null : b)}>
                  {chatBooking?.id===b.id ? (isAr?"إغلاق المحادثة":"Close chat") : `💬 ${isAr?"محادثة":"Chat"}`}
                </button>
                {b.status !== "cancelled" && (
                  <button style={{ ...btnGhost, fontSize:12, padding:"6px 14px", color:"#f87171", borderColor:"rgba(248,113,113,.3)" }}
                          onClick={()=>cancelBooking(b)} disabled={cancellingId===b.id}>
                    {cancellingId===b.id ? "…" : (isAr?"إلغاء الحجز":"Cancel booking")}
                  </button>
                )}
                {b.status !== "cancelled" && !b.rating && (
                  <button style={{ ...btnGhost, fontSize:12, padding:"6px 14px", color:"#fbbf24", borderColor:"rgba(251,191,36,.3)" }}
                          onClick={()=>setRatingBookingId(ratingBookingId===b.id ? null : b.id)}>
                    ⭐ {isAr?"قيّم الجلسة":"Rate this session"}
                  </button>
                )}
                {b.rating && (
                  <div style={{ fontSize:12, color:"#fbbf24", padding:"6px 4px" }}>
                    {"★".repeat(b.rating)}{"☆".repeat(5-b.rating)}
                  </div>
                )}
              </div>
              {ratingBookingId === b.id && (
                <ReviewForm booking={b} isAr={isAr} submitting={submittingReview}
                            onCancel={()=>setRatingBookingId(null)}
                            onSubmit={(rating, comment)=>submitReview(b, rating, comment)} />
              )}
              {chatBooking?.id === b.id && (
                <BookingChat bookingId={b.id} isAr={isAr} currentUid={user?.uid} addToast={addToast} />
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "admin" && isAdmin && <AdminMarketplaceManager isAr={isAr} addToast={addToast} adminUid={user?.uid} />}

      {selected && (
        <BookingModal therapist={selected} isAr={isAr} loading={booking}
                      onClose={()=>setSelected(null)} onSubmit={submitBooking} />
      )}
    </div>
  );
}

function ReviewForm({ booking, isAr, submitting, onCancel, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover]   = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div style={{ marginTop:10, padding:14, background:"rgba(251,191,36,.05)",
                  border:"1px solid rgba(251,191,36,.2)", borderRadius:10 }}>
      <div style={{ fontSize:12.5, color:"#e2e8f0", marginBottom:8, fontWeight:600 }}>
        {isAr ? `تقييمك لجلستك مع ${booking.therapist_name}` : `Rate your session with ${booking.therapist_name}`}
      </div>
      <div style={{ display:"flex", gap:4, marginBottom:10 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={()=>setRating(n)}
            onMouseEnter={()=>setHover(n)} onMouseLeave={()=>setHover(0)}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:24, padding:0,
                     color: n <= (hover||rating) ? "#fbbf24" : "#475569" }}>
            {n <= (hover||rating) ? "★" : "☆"}
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={e=>setComment(e.target.value)}
        placeholder={isAr ? "احكيلنا عن تجربتك (اختياري)" : "Tell us about your experience (optional)"}
        style={{ ...input, minHeight:60, resize:"vertical", marginBottom:10 }} />
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button style={btnGhost} onClick={onCancel} disabled={submitting}>{isAr?"إلغاء":"Cancel"}</button>
        <button style={btnPrimary} disabled={submitting || rating===0}
                onClick={()=>onSubmit(rating, comment)}>
          {submitting ? (isAr?"جاري الإرسال…":"Submitting…") : (isAr?"إرسال التقييم":"Submit review")}
        </button>
      </div>
    </div>
  );
}

function BookingChat({ bookingId, isAr, currentUid, addToast }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    MarketplaceAPI.getMessages(bookingId)
      .then(d => setMessages(d?.messages || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    load();
    // Simple polling while the thread is open — matches this app's existing
    // pattern of not using websockets for any other feature either.
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await MarketplaceAPI.sendMessage(bookingId, trimmed);
      setText("");
      load();
    } catch (e) {
      addToast?.(e.message || (isAr ? "تعذر إرسال الرسالة" : "Couldn't send message"), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ marginTop:12, borderTop:border, paddingTop:12 }}>
      <div style={{ maxHeight:220, overflowY:"auto", display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
        {loading && <div style={{ fontSize:12, color:"#64748b" }}>{isAr?"جاري التحميل…":"Loading…"}</div>}
        {!loading && messages.length === 0 && (
          <div style={{ fontSize:12, color:"#64748b", textAlign:"center", padding:"12px 0" }}>
            {isAr ? "ابدأ المحادثة — اسأل أي سؤال عن الحجز ده" : "Start the conversation — ask anything about this booking"}
          </div>
        )}
        {messages.map(m => {
          const mine = m.sender_uid === currentUid;
          return (
            <div key={m.id} style={{ display:"flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth:"78%", padding:"8px 12px", borderRadius:12,
                background: mine ? "rgba(15,118,110,.22)" : "rgba(255,255,255,.06)",
                border: mine ? "1px solid rgba(15,118,110,.35)" : border,
              }}>
                {!mine && (
                  <div style={{ fontSize:9.5, color:"#5eead4", fontWeight:700, marginBottom:2, textTransform:"uppercase" }}>
                    {m.sender_role === "admin" ? (isAr?"فريق الدعم":"Support team") : (isAr?"المريض":"Patient")}
                  </div>
                )}
                <div style={{ fontSize:13, color:"#e2e8f0", lineHeight:1.5, whiteSpace:"pre-wrap" }}>{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <input style={{ ...input, flex:1 }}
               placeholder={isAr ? "اكتب رسالتك…" : "Type a message…"}
               value={text}
               onChange={e=>setText(e.target.value)}
               onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } }} />
        <button style={{ ...btnPrimary, padding:"9px 16px" }} onClick={send} disabled={sending || !text.trim()}>
          {isAr ? "إرسال" : "Send"}
        </button>
      </div>
    </div>
  );
}

function BookingModal({ therapist, isAr, loading, onClose, onSubmit }) {
  const [preferredTime, setPreferredTime] = useState("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState(null);       // null = loading, [] = none/no template
  const [hasTemplate, setHasTemplate] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // ISO string

  useEffect(() => {
    MarketplaceAPI.getSlots(therapist.id)
      .then(d => { setSlots(d?.slots || []); setHasTemplate(!!d?.has_template); })
      .catch(() => { setSlots([]); setHasTemplate(false); });
  }, [therapist.id]);

  // Group slots by calendar day for a readable picker
  const slotsByDay = {};
  (slots || []).forEach(iso => {
    const d = new Date(iso);
    const dayKey = d.toDateString();
    (slotsByDay[dayKey] = slotsByDay[dayKey] || []).push(iso);
  });

  const fmtDay = (dayKey) => new Date(dayKey).toLocaleDateString(isAr ? "ar-EG" : "en-US", { weekday: "short", month: "short", day: "numeric" });
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString(isAr ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" });

  const canSubmit = hasTemplate ? !!selectedSlot : true;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", display:"flex",
                  alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
      <div style={{ ...card, width:"100%", maxWidth:460, background:"#111827", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>{isAr ? "حجز جلسة مع" : "Book a session with"} {therapist.name}</div>
        <div style={{ fontSize:13, color:"#5eead4", fontWeight:700, marginBottom:16 }}>{money(therapist.session_fee_cents, therapist.currency, isAr)}</div>

        {slots === null && (
          <div style={{ fontSize:12.5, color:"#64748b", marginBottom:16 }}>{isAr?"جاري تحميل المواعيد المتاحة…":"Loading available times…"}</div>
        )}

        {slots !== null && hasTemplate && (
          <div style={{ marginBottom:16 }}>
            <div style={label}>{isAr ? "اختار ميعاد متاح" : "Choose an available time"}</div>
            {Object.keys(slotsByDay).length === 0 ? (
              <div style={{ fontSize:12.5, color:"#94a3b8" }}>{isAr?"مفيش مواعيد متاحة قريبًا":"No available slots coming up"}</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10, maxHeight:220, overflowY:"auto" }}>
                {Object.entries(slotsByDay).map(([dayKey, times]) => (
                  <div key={dayKey}>
                    <div style={{ fontSize:11, color:"#64748b", fontWeight:700, marginBottom:5 }}>{fmtDay(dayKey)}</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {times.map(iso => (
                        <button key={iso} onClick={()=>setSelectedSlot(iso)}
                          style={{ padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
                            border: selectedSlot===iso ? "1px solid rgba(15,118,110,.6)" : border,
                            background: selectedSlot===iso ? "rgba(15,118,110,.25)" : "rgba(255,255,255,.03)",
                            color: selectedSlot===iso ? "#5eead4" : "#cbd5e1" }}>
                          {fmtTime(iso)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {slots !== null && !hasTemplate && (
          <div style={{ marginBottom:12 }}>
            <div style={label}>{isAr ? "الميعاد المفضل" : "Preferred time"}</div>
            <input style={input} placeholder={isAr ? "مثال: الخميس بعد الظهر" : "e.g. Thursday afternoon"}
                   value={preferredTime} onChange={e=>setPreferredTime(e.target.value)} />
            <div style={{ fontSize:11, color:"#64748b", marginTop:4 }}>
              {isAr ? "المعالج ده لسه مسجلش مواعيد ثابتة — هيتواصل معاك لتحديد الميعاد" : "This therapist hasn't set fixed availability yet — they'll follow up to confirm a time"}
            </div>
          </div>
        )}

        <div style={{ marginBottom:16 }}>
          <div style={label}>{isAr ? "ملاحظات (اختياري)" : "Notes (optional)"}</div>
          <textarea style={{ ...input, minHeight:70, resize:"vertical" }}
                    value={notes} onChange={e=>setNotes(e.target.value)} />
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={btnGhost} onClick={onClose} disabled={loading}>{isAr ? "إلغاء" : "Cancel"}</button>
          <button style={{ ...btnPrimary, opacity: canSubmit ? 1 : .5 }} disabled={loading || !canSubmit}
                  onClick={()=>onSubmit(hasTemplate ? fmtDay(new Date(selectedSlot).toDateString())+" "+fmtTime(selectedSlot) : preferredTime, notes, selectedSlot)}>
            {loading ? (isAr ? "جاري الحجز…" : "Booking…") : (isAr ? "تأكيد الحجز والدفع" : "Confirm & Pay")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminMarketplaceManager({ isAr, addToast, adminUid }) {
  const [subTab, setSubTab] = useState("therapists"); // therapists | bookings
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <Tab active={subTab==="therapists"} onClick={()=>setSubTab("therapists")}>{isAr?"الأخصائيون":"Therapists"}</Tab>
        <Tab active={subTab==="bookings"}   onClick={()=>setSubTab("bookings")}>{isAr?"الحجوزات":"Bookings"}</Tab>
      </div>
      {subTab === "therapists"
        ? <AdminTherapistManager isAr={isAr} addToast={addToast} />
        : <AdminBookingsManager isAr={isAr} addToast={addToast} adminUid={adminUid} />}
    </div>
  );
}

function AdminBookingsManager({ isAr, addToast, adminUid }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatBooking, setChatBooking] = useState(null);

  useEffect(() => {
    MarketplaceAPI.adminListBookings()
      .then(d => setBookings(d?.bookings || []))
      .catch(e => addToast?.(e.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color:"#64748b" }}>{isAr?"جاري التحميل…":"Loading…"}</div>;
  if (bookings.length === 0) return <div style={{ ...card, textAlign:"center", color:"#64748b" }}>{isAr?"مفيش حجوزات لسه":"No bookings yet"}</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {bookings.map(b => (
        <div key={b.id} style={card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontWeight:700 }}>{b.therapist_name}</div>
              <div style={{ fontSize:12, color:"#64748b" }}>{b.preferred_time || (isAr?"الميعاد لسه مش متحدد":"Time not set")} · {b.user_id?.slice(0,8)}…</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontWeight:700, color:"#5eead4" }}>{money(b.amount_cents, b.currency, isAr)}</div>
              <div style={{ fontSize:11, color:"#94a3b8", textTransform:"capitalize" }}>{b.status?.replace(/_/g," ")}</div>
            </div>
          </div>
          {b.notes && <div style={{ fontSize:12.5, color:"#94a3b8", marginTop:8 }}>📝 {b.notes}</div>}
          <div style={{ marginTop:12, borderTop:border, paddingTop:12 }}>
            <button style={{ ...btnGhost, fontSize:12, padding:"6px 14px" }}
                    onClick={()=>setChatBooking(chatBooking?.id===b.id ? null : b)}>
              {chatBooking?.id===b.id ? (isAr?"إغلاق المحادثة":"Close chat") : `💬 ${isAr?"محادثة":"Chat"}`}
            </button>
          </div>
          {chatBooking?.id === b.id && (
            <BookingChat bookingId={b.id} isAr={isAr} currentUid={adminUid} addToast={addToast} />
          )}
        </div>
      ))}
    </div>
  );
}

function AdminTherapistManager({ isAr, addToast }) {
  const [list, setList] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name:"", city:"", bio:"", specialties:"", session_fee_cents:"", currency:"EGP", years_experience:"" });
  const [availability, setAvailability] = useState({}); // {mon:["09:00",...], ...}
  const [saving, setSaving] = useState(false);

  const DAYS = [
    { key:"mon", en:"Mon", ar:"إثنين" }, { key:"tue", en:"Tue", ar:"ثلاثاء" },
    { key:"wed", en:"Wed", ar:"أربعاء" }, { key:"thu", en:"Thu", ar:"خميس" },
    { key:"fri", en:"Fri", ar:"جمعة" }, { key:"sat", en:"Sat", ar:"سبت" }, { key:"sun", en:"Sun", ar:"أحد" },
  ];
  const SLOT_TIMES = ["09:00","11:00","13:00","15:00","17:00","19:00"];

  const toggleSlot = (day, time) => {
    setAvailability(prev => {
      const cur = prev[day] || [];
      const next = cur.includes(time) ? cur.filter(t=>t!==time) : [...cur, time].sort();
      return { ...prev, [day]: next };
    });
  };

  const load = () => MarketplaceAPI.adminListTherapists().then(d=>setList(d?.therapists||[])).catch(()=>{});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim() || !form.session_fee_cents) {
      addToast?.(isAr ? "الاسم والسعر مطلوبين" : "Name and fee are required", "error");
      return;
    }
    setSaving(true);
    try {
      await MarketplaceAPI.adminCreateTherapist({
        ...form,
        session_fee_cents: Math.round(parseFloat(form.session_fee_cents) * 100),
        years_experience: parseInt(form.years_experience) || 0,
        specialties: form.specialties.split(",").map(s=>s.trim()).filter(Boolean),
        availability_template: Object.fromEntries(Object.entries(availability).filter(([,v])=>v.length>0)),
      });
      setForm({ name:"", city:"", bio:"", specialties:"", session_fee_cents:"", currency:"EGP", years_experience:"" });
      setAvailability({});
      setShowNew(false);
      load();
      addToast?.(isAr ? "تمت الإضافة" : "Therapist added", "success");
    } catch (e) {
      addToast?.(e.message, "error");
    } finally { setSaving(false); }
  };

  const toggleStatus = async (th) => {
    const next = th.status === "active" ? "paused" : "active";
    await MarketplaceAPI.adminUpdateTherapist(th.id, { status: next }).catch(()=>{});
    load();
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
        <button style={btnPrimary} onClick={()=>setShowNew(s=>!s)}>
          {showNew ? (isAr ? "إغلاق" : "Close") : (isAr ? "+ إضافة أخصائي" : "+ Add Therapist")}
        </button>
      </div>

      {showNew && (
        <div style={{ ...card, marginBottom:16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div><div style={label}>{isAr?"الاسم":"Name"}</div><input style={input} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
          <div><div style={label}>{isAr?"المدينة":"City"}</div><input style={input} value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/></div>
          <div><div style={label}>{isAr?"سعر الجلسة":"Session fee"}</div><input style={input} type="number" value={form.session_fee_cents} onChange={e=>setForm(f=>({...f,session_fee_cents:e.target.value}))}/></div>
          <div><div style={label}>{isAr?"سنوات الخبرة":"Years experience"}</div><input style={input} type="number" value={form.years_experience} onChange={e=>setForm(f=>({...f,years_experience:e.target.value}))}/></div>
          <div style={{ gridColumn:"1 / -1" }}><div style={label}>{isAr?"التخصصات (مفصولة بفاصلة)":"Specialties (comma-separated)"}</div><input style={input} value={form.specialties} onChange={e=>setForm(f=>({...f,specialties:e.target.value}))}/></div>
          <div style={{ gridColumn:"1 / -1" }}><div style={label}>{isAr?"نبذة":"Bio"}</div><textarea style={{...input,minHeight:60}} value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))}/></div>
          <div style={{ gridColumn:"1 / -1" }}>
            <div style={label}>{isAr?"المواعيد المتاحة أسبوعيًا (اختياري)":"Weekly availability (optional)"}</div>
            <div style={{ fontSize:11, color:"#64748b", marginBottom:8 }}>
              {isAr?"من غير ده، المريض هيكتب ميعاده المفضل نص حر وهيتم التواصل معاه.":"Without this, patients type a free-text preferred time and get followed up with instead."}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {DAYS.map(d => (
                <div key={d.key} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:44, fontSize:11.5, color:"#94a3b8", flexShrink:0 }}>{isAr?d.ar:d.en}</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {SLOT_TIMES.map(t => {
                      const active = (availability[d.key]||[]).includes(t);
                      return (
                        <button key={t} type="button" onClick={()=>toggleSlot(d.key,t)}
                          style={{ padding:"3px 8px", borderRadius:6, fontSize:10.5, fontWeight:600, cursor:"pointer",
                            border: active ? "1px solid rgba(15,118,110,.5)" : border,
                            background: active ? "rgba(15,118,110,.2)" : "transparent",
                            color: active ? "#5eead4" : "#64748b" }}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ gridColumn:"1 / -1", textAlign:"right" }}>
            <button style={btnPrimary} onClick={save} disabled={saving}>{saving ? "…" : (isAr?"حفظ":"Save")}</button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {list.map(th => (
          <div key={th.id} style={{ ...card, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontWeight:700 }}>{th.name} <span style={{ fontSize:11, color: th.status==="active"?"#5eead4":"#f87171" }}>({th.status})</span></div>
              <div style={{ fontSize:12, color:"#64748b" }}>{th.city} · {money(th.session_fee_cents, th.currency, isAr)}</div>
            </div>
            <button style={btnGhost} onClick={()=>toggleStatus(th)}>
              {th.status === "active" ? (isAr?"إيقاف":"Pause") : (isAr?"تفعيل":"Activate")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TherapistMarketplace;
