/**
 * Corvus — Physiotherapist Marketplace v1
 * Admin-curated therapist directory + booking flow (PayMob per-session payment).
 * No public self-serve therapist signup yet — see admin "Manage Therapists" tab.
 */
import { useState, useEffect, useCallback } from "react";
import { MarketplaceAPI } from "./services/api.js";

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

function money(cents, currency) {
  if (!cents) return "—";
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

  const load = useCallback(() => {
    setLoading(true); setErr(null);
    MarketplaceAPI.listTherapists(cityFilter ? { city: cityFilter } : {})
      .then(d => setTherapists(d?.therapists || []))
      .catch(e => setErr(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [cityFilter]);

  useEffect(() => { if (tab === "browse") load(); }, [tab, load]);
  useEffect(() => {
    if (tab === "mine") {
      MarketplaceAPI.myBookings().then(d => setMyBookings(d?.bookings || [])).catch(()=>{});
    }
  }, [tab]);

  const submitBooking = async (preferredTime, notes) => {
    if (!selected) return;
    setBooking(true);
    try {
      const res = await MarketplaceAPI.createBooking({
        therapist_id: selected.id,
        preferred_time: preferredTime,
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
      addToast?.(e.message || (isAr ? "حصل خطأ" : "Something went wrong"), "error");
    } finally {
      setBooking(false);
    }
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 20px", color: "#e2e8f0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:900 }}>{isAr ? "🩺 دليل أخصائيي العلاج الطبيعي" : "🩺 Physiotherapist Marketplace"}</div>
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
                  <div style={{ fontWeight:800, fontSize:14, color:"#5eead4" }}>{money(th.session_fee_cents, th.currency)}</div>
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
            <div key={b.id} style={{ ...card, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:700 }}>{b.therapist_name}</div>
                <div style={{ fontSize:12, color:"#64748b" }}>{b.preferred_time || (isAr ? "الميعاد لسه مش متحدد" : "Time not set")}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontWeight:700, color:"#5eead4" }}>{money(b.amount_cents, b.currency)}</div>
                <div style={{ fontSize:11, color:"#94a3b8", textTransform:"capitalize" }}>{b.status?.replace(/_/g," ")}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "admin" && isAdmin && <AdminTherapistManager isAr={isAr} addToast={addToast} />}

      {selected && (
        <BookingModal therapist={selected} isAr={isAr} loading={booking}
                      onClose={()=>setSelected(null)} onSubmit={submitBooking} />
      )}
    </div>
  );
}

function BookingModal({ therapist, isAr, loading, onClose, onSubmit }) {
  const [preferredTime, setPreferredTime] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", display:"flex",
                  alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
      <div style={{ ...card, width:"100%", maxWidth:420, background:"#111827" }}>
        <div style={{ fontWeight:800, fontSize:16, marginBottom:4 }}>{isAr ? "حجز جلسة مع" : "Book a session with"} {therapist.name}</div>
        <div style={{ fontSize:13, color:"#5eead4", fontWeight:700, marginBottom:16 }}>{money(therapist.session_fee_cents, therapist.currency)}</div>

        <div style={{ marginBottom:12 }}>
          <div style={label}>{isAr ? "الميعاد المفضل" : "Preferred time"}</div>
          <input style={input} placeholder={isAr ? "مثال: الخميس بعد الظهر" : "e.g. Thursday afternoon"}
                 value={preferredTime} onChange={e=>setPreferredTime(e.target.value)} />
        </div>
        <div style={{ marginBottom:16 }}>
          <div style={label}>{isAr ? "ملاحظات (اختياري)" : "Notes (optional)"}</div>
          <textarea style={{ ...input, minHeight:70, resize:"vertical" }}
                    value={notes} onChange={e=>setNotes(e.target.value)} />
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button style={btnGhost} onClick={onClose} disabled={loading}>{isAr ? "إلغاء" : "Cancel"}</button>
          <button style={btnPrimary} onClick={()=>onSubmit(preferredTime, notes)} disabled={loading}>
            {loading ? (isAr ? "جاري الحجز…" : "Booking…") : (isAr ? "تأكيد الحجز والدفع" : "Confirm & Pay")}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminTherapistManager({ isAr, addToast }) {
  const [list, setList] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name:"", city:"", bio:"", specialties:"", session_fee_cents:"", currency:"EGP", years_experience:"" });
  const [saving, setSaving] = useState(false);

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
      });
      setForm({ name:"", city:"", bio:"", specialties:"", session_fee_cents:"", currency:"EGP", years_experience:"" });
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
              <div style={{ fontSize:12, color:"#64748b" }}>{th.city} · {money(th.session_fee_cents, th.currency)}</div>
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
