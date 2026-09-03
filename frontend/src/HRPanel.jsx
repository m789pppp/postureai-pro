/**
 * Corvus - HRPanel v32 (B2B Complete)
 * Full HR dashboard: Overview . Departments . Employees . Billing . Invite
 */
import { API_BASE_URL } from "./config/api.js";
import { useState, useEffect, useRef } from "react";
import {
  getDepartments, createDepartment, deleteDepartment,
  getDepartmentEmployees, bulkInviteEmployees,
  getCompany, updateCompany,
  getAllUsers,
  getAuthToken, SUPPORT_EMAIL,
} from "./firebase.js";

const sc = v => v>=75?"#10b981":v>=50?"#f59e0b":"#ef4444";
const grade = (v,ar) => v>=85?(ar?"ممتاز":"Excellent"):v>=70?(ar?"جيد":"Good"):v>=50?(ar?"مقبول":"Fair"):(ar?"ضعيف":"Poor");
const API = API_BASE_URL;

// -- Mini components ------------------------------------------------
function KPI({ icon, label, value, color, sub }) {
  return (
    <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:14, padding:"16px 18px" }}>
      <div style={{ fontSize:20, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:26, fontWeight:900, color, lineHeight:1, letterSpacing:"-.02em" }}>{value}</div>
      <div style={{ fontSize:11, color:"#64748b", marginTop:5, fontWeight:500 }}>{label}</div>
      {sub&&<div style={{ fontSize:10, color, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding:"11px 18px", fontSize:12, fontWeight:active?700:500,
      color:active?"#fff":"#64748b",
      background:active?"#1a56db":"transparent",
      border:"none", borderRadius:8, cursor:"pointer",
      transition:"all .18s", whiteSpace:"nowrap",
    }}>{children}</button>
  );
}

function Inp({ value, onChange, placeholder, style={} }) {
  return (
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{ background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.08)", borderRadius:9, padding:"10px 14px", fontSize:12, color:"#f0f6ff", outline:"none", fontFamily:"inherit", ...style }}/>
  );
}

// -- Employee row ---------------------------------------------------
// `showScore` separates the two jobs this row does. The roster itself is a
// management tool — an HR admin has to see who is in the company to assign a
// department or send an invite — but the score, grade and Risk badge beside
// each name are the named per-person reporting that aggregate_only exists to
// suppress. The Overview tab was gated and this tab was not, so the notice
// said "each employee's score is visible only to them" and the next tab along
// listed every one of them, sorted by score.
function EmpRow({ emp, isAr, onInvite, showScore = true }) {
  const avg = showScore ? (emp.avg_score || (emp.scores?.length ? Math.round(emp.scores.reduce((a,b)=>a+b,0)/emp.scores.length) : 0)) : 0;
  const isRisk = showScore && avg > 0 && avg < 50;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.06)", borderRadius:12, transition:"background .15s" }}
      onMouseEnter={e=>e.currentTarget.style.background="rgba(26,86,219,.06)"}
      onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.02)"}>
      <div style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,${sc(avg)},${sc(avg)}88)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#fff", fontWeight:700, flexShrink:0 }}>
        {(emp.name||emp.email||"?")[0].toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:"#f0f6ff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{emp.name||emp.email?.split("@")[0]||"Employee"}</div>
        <div style={{ fontSize:10.5, color:"#64748b" }}>{emp.email} {emp.department&&`. ${emp.department}`}</div>
      </div>
      <div style={{ textAlign:"center", flexShrink:0 }}>
        <div style={{ fontSize:18, fontWeight:800, color:avg?sc(avg):"#475569" }}>{avg||"-"}</div>
        {avg>0&&<div style={{ fontSize:9, color:sc(avg) }}>{grade(avg,isAr)}</div>}
      </div>
      <div style={{ fontSize:10.5, color:"#64748b", flexShrink:0 }}>{emp.sessions_count||emp.sessions||0} {isAr?"جلسة":"sess"}</div>
      {isRisk&&<span style={{ background:"rgba(239,68,68,.12)", color:"#ef4444", fontSize:9.5, fontWeight:700, padding:"2px 9px", borderRadius:99, flexShrink:0 }}>!️ {isAr?"خطر":"Risk"}</span>}
      {emp.status==="invited"&&<span style={{ background:"rgba(245,158,11,.1)", color:"#f59e0b", fontSize:9.5, padding:"2px 9px", borderRadius:99 }}>{isAr?"مدعو":"Invited"}</span>}
    </div>
  );
}

// -- Dept card ------------------------------------------------------
function DeptCard({ dept, employees = [], isAr, onDelete }) {
  // Averaged over the department's employee records rather than over their
  // individual session documents — same figure, without the client reading
  // fifty people's posture histories to compute it.
  const de = employees.filter(e=>(e.department||e.dept)===dept.name && (e.avg_score||0)>0);
  const avg = de.length ? Math.round(de.reduce((a,e)=>a+(e.avg_score||0),0)/de.length) : 0;
  const risk = de.filter(e=>(e.avg_score||0)<50).length;
  const [del, setDel] = useState(false);
  return (
    <div style={{ background:"rgba(255,255,255,.03)", border:`1px solid ${del?"rgba(239,68,68,.3)":"rgba(255,255,255,.07)"}`, borderRadius:14, padding:18, transition:"all .2s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#f0f6ff" }}>{dept.name}</div>
          {dept.manager&&<div style={{ fontSize:10.5, color:"#64748b", marginTop:2 }}>{isAr?"المدير:":"Manager:"} {dept.manager}</div>}
        </div>
        {del ? (
          <div style={{ display:"flex", gap:5 }}>
            <button onClick={()=>{onDelete(dept.id);setDel(false);}} style={{ background:"rgba(239,68,68,.15)", border:"1px solid rgba(239,68,68,.3)", borderRadius:6, padding:"3px 10px", fontSize:10, color:"#fca5a5", cursor:"pointer", fontWeight:600 }}>{isAr?"تأكيد":"Confirm"}</button>
            <button onClick={()=>setDel(false)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:10, color:"#64748b" }}>{isAr?"إلغاء":"Cancel"}</button>
          </div>
        ):(
          <button onClick={()=>setDel(true)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:"#475569", lineHeight:1 }}>✕</button>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:avg>0?12:0 }}>
        {[[isAr?"جلسات":"Sessions",ds.length,"#60a5fa"],[isAr?"متوسط":"Avg",avg?`${avg}/100`:"-",avg?sc(avg):"#475569"],[isAr?"خطر":"Risk",risk,risk>0?"#ef4444":"#10b981"]].map(([l,v,c])=>(
          <div key={l} style={{ background:"rgba(0,0,0,.2)", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#475569", marginBottom:3, textTransform:"uppercase", letterSpacing:".06em" }}>{l}</div>
            <div style={{ fontSize:16, fontWeight:700, color:c }}>{v}</div>
          </div>
        ))}
      </div>
      {avg>0&&(
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:9.5, color:"#475569" }}>
            <span>{isAr?"الأداء":"Performance"}</span>
            <span style={{ color:sc(avg) }}>{avg}/100</span>
          </div>
          <div style={{ height:5, borderRadius:99, background:"rgba(148,163,184,.1)", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${avg}%`, background:sc(avg), borderRadius:99, transition:"width .6s" }}/>
          </div>
        </div>
      )}
    </div>
  );
}

// -- BILLING PLANS --------------------------------------------------
const B2B_PLANS = [
  { id:"starter",  name:{en:"Starter",  ar:"ستارتر"}, seats:25,  price_mo:1990,  price_yr:19900, color:"#6366f1" },
  { id:"growth",   name:{en:"Growth",   ar:"جروث"},   seats:100, price_mo:4990,  price_yr:49900, color:"#0ea5e9", popular:true },
  { id:"business", name:{en:"Business", ar:"بيزنس"},  seats:500, price_mo:14990, price_yr:149900,color:"#10b981" },
  { id:"enterprise",name:{en:"Enterprise",ar:"إنتربرايز"},seats:-1,price_mo:null,price_yr:null,  color:"#f59e0b" },
];


function B2BPlanCard({ plan, billing, current, isAr, addToast }) {
  const [hov, setHov] = useState(false);
  const isCur = current === plan.id;
  const price = billing==="monthly" ? plan.price_mo : plan.price_yr;
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:hov?`${plan.color}10`:"rgba(255,255,255,.03)",border:`${isCur?"2":"1"}px solid ${isCur?plan.color:hov?`${plan.color}40`:"rgba(255,255,255,.07)"}`,borderRadius:16,padding:"20px 18px",position:"relative",transition:"all .22s",transform:hov?"translateY(-3px)":"none",boxShadow:hov?`0 8px 32px ${plan.color}20`:"none"}}>
      {plan.popular&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${plan.color},${plan.color}cc)`,color:"#fff",fontSize:10,fontWeight:700,padding:"2px 12px",borderRadius:99,whiteSpace:"nowrap"}}>{isAr?"الأكثر طلباً":"Most Popular"}</div>}
      <div style={{fontSize:15,fontWeight:800,color:"#f0f6ff",marginBottom:6}}>{isAr?plan.name:plan.name}</div>
      {price?(
        <div style={{display:"flex",alignItems:"baseline",gap:3,marginBottom:6}}>
          <span style={{fontSize:28,fontWeight:900,color:plan.color}}>{price.toLocaleString()}</span>
          <span style={{fontSize:11,color:"#64748b"}}>EGP/{billing==="monthly"?(isAr?"شهر":"mo"):(isAr?"سنة":"yr")}</span>
        </div>
      ):(
        <div style={{fontSize:20,fontWeight:800,color:plan.color,marginBottom:6}}>{isAr?"سعر مخصص":"Custom"}</div>
      )}
      <div style={{fontSize:11,color:"#64748b",marginBottom:16}}>{plan.seats<0?(isAr?"غير محدود":"Unlimited"):`≤${plan.seats}`} {isAr?"موظف":"emp"}</div>
      {plan.features.map((f,fi)=>(
        <div key={fi} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <span style={{color:plan.color,fontSize:10}}>v</span>
          <span style={{fontSize:11.5,color:"#94a3b8"}}>{f}</span>
        </div>
      ))}
      <div style={{marginTop:14}}>
        {isCur?(
          <div style={{background:`${plan.color}12`,border:`1px solid ${plan.color}25`,borderRadius:8,padding:"8px 0",textAlign:"center",fontSize:12,fontWeight:600,color:plan.color}}>
            {isAr?"خطتك الحالية v":"Current Plan v"}
          </div>
        ):plan.price_mo?(
          <a href={`mailto:support@corvus.io?subject=Upgrade to ${encodeURIComponent(plan.name||plan.id)}`}
            style={{display:"block",width:"100%",boxSizing:"border-box",background:`linear-gradient(135deg,${plan.color},${plan.color}cc)`,border:"none",borderRadius:8,padding:"9px 0",textAlign:"center",fontSize:12,fontWeight:700,color:"#fff",textDecoration:"none",cursor:"pointer"}}>
            {isAr?"ترقية <-":"Upgrade ->"}
          </a>
        ):(
          <a href={`mailto:support@corvus.io?subject=Enterprise Plan`}
            style={{display:"block",background:`${plan.color}12`,border:`1px solid ${plan.color}25`,borderRadius:8,padding:"9px 0",textAlign:"center",fontSize:12,fontWeight:700,color:plan.color,textDecoration:"none"}}>
            {isAr?"تواصل معنا":"Contact Sales"}
          </a>
        )}
      </div>
    </div>
  );
}

function BillingTab({ company, isAr, addToast }) {
  const [billing, setBilling] = useState("monthly");
  const current = company?.plan || "starter";

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:"#f0f6ff", marginBottom:4 }}>{isAr?"خطط الشركات":"Company Plans"}</div>
          <div style={{ fontSize:12, color:"#64748b" }}>{isAr?"أسعار مخصصة لفرق العمل":"Team pricing - billed per company"}</div>
        </div>
        <div style={{ display:"flex", background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.08)", borderRadius:10, padding:3, gap:2 }}>
          {["monthly","yearly"].map(b=>(
            <button key={b} onClick={()=>setBilling(b)} style={{ padding:"7px 16px", fontSize:11, fontWeight:600, background:billing===b?"#1a56db":"transparent", color:billing===b?"#fff":"#64748b", border:"none", borderRadius:7, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              {b==="monthly"?(isAr?"شهري":"Monthly"):(isAr?"سنوي":"Yearly")}
              {b==="yearly"&&<span style={{ fontSize:9, background:"rgba(16,185,129,.2)", color:"#10b981", padding:"1px 6px", borderRadius:99, fontWeight:700 }}>-17%</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14, marginBottom:24 }}>
        {B2B_PLANS.map(plan=>(
          <B2BPlanCard key={plan.id} plan={plan} billing={billing} current={current} isAr={isAr} addToast={addToast}/>
        ))}
      </div>

      {/* Current plan details */}
      <div style={{ background:"rgba(26,86,219,.06)", border:"1px solid rgba(26,86,219,.2)", borderRadius:14, padding:"18px 20px" }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#f0f6ff", marginBottom:12 }}>{isAr?"تفاصيل الخطة الحالية":"Current Plan Details"}</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
          {[
            [isAr?"الباقة":"Plan", (B2B_PLANS.find(p=>p.id===current)?.name[isAr?"ar":"en"])||current, "#60a5fa"],
            [isAr?"الفوترة":"Billing", company?.billing==="yearly"?(isAr?"سنوي":"Yearly"):(isAr?"شهري":"Monthly"), "#a5b4fc"],
            [isAr?"تجديد":"Renewal", company?.renewal_date||(isAr?"غير محدد":"Not set"), "#94a3b8"],
            [isAr?"المقاعد":"Seats", company?.seats_used||"-", "#10b981"],
          ].map(([l,v,c])=>(
            <div key={l}>
              <div style={{ fontSize:10, color:"#475569", marginBottom:3, textTransform:"uppercase", letterSpacing:".06em" }}>{l}</div>
              <div style={{ fontSize:14, fontWeight:700, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -- MAIN COMPONENT -------------------------------------------------
export function HRPanel({ user, profile, companyId: cid, cs, t, addToast, onBack, lang="en" }) {
  const isAr = lang==="ar";
  const companyId = cid || profile?.company_id;

  const [tab,        setTab]      = useState("overview");
  const [company,    setCompany]  = useState(null);
  const [depts,      setDepts]    = useState([]);
  const [employees,  setEmployees]= useState([]);
  const [dash,setDash]            = useState(null);
  // The server decides. "individual" only when the organisation opted in
  // explicitly; anything else — including an unreachable endpoint — is treated
  // as aggregate-only, because failing open on a privacy control is the wrong
  // direction to fail.
  const namedOK = dash?.privacy_mode === "individual";
  const [loading,    setLoading]  = useState(true);
  const [loadError,  setLoadError]= useState(false);
  const [retryTick,  setRetryTick]= useState(0);
  const [newDept,    setNewDept]  = useState({name:"",manager:""});
  const [inviteText, setInvite]   = useState("");
  const [inviteRole, setInvRole]  = useState("employee");
  const [inviteLink, setInviteLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [importEmps, setImportE]  = useState([]);
  const [sending,    setSending]  = useState(false);
  const [alertMsg,      setAlertMsg]      = useState("");
  const [alertSending,  setAlertSending]  = useState(false);
  const [showAlertBox,  setShowAlertBox]  = useState(false);
  const [deptFilter, setDeptF]    = useState("all");
  const [search,     setSearch]   = useState("");
  const fileRef = useRef();

  // Load everything
  useEffect(()=>{
    if(!companyId){ setLoading(false); return; }
    setLoadError(false);
    Promise.all([
      getCompany(companyId),
      getDepartments(companyId),
      getDepartmentEmployees(companyId, null),
    ]).then(([co,dp,em])=>{
      setCompany(co);
      setDepts(dp||[]);
      setEmployees(em||[]);

      // This used to fetch up to FIFTY employees' individual session
      // documents straight from Firestore, one request each, and use them
      // only to compute company-wide averages.
      //
      // That made the organisation's privacy setting decorative. Switching a
      // company to aggregate_only changes what /api/company/dashboard
      // returns — and this screen never asked it. The HR admin's browser read
      // every employee's posture history directly, because the Firestore rule
      // let an HR account read any session in its own company. A control the
      // client can walk around is not a control.
      //
      // The same aggregates come from the guarded endpoint, which applies
      // aggregate_only and its k-anonymity floor server-side, so nothing is
      // lost by asking it instead. The cross-user session rule has been
      // removed to match.
      (async () => {
        try {
          const tok = await getAuthToken();
          // Without lang the endpoint defaults to Arabic and privacy_note
          // comes back in one language only — which then wins over the
          // client's own bilingual fallback and puts Arabic body text under an
          // English heading.
          const r = await fetch(`${API}/company/dashboard?days=30&lang=${isAr?"ar":"en"}`, {
            headers: { Authorization: `Bearer ${tok}` },
          });
          if (!r.ok) throw new Error(String(r.status));
          setDash(await r.json());
        } catch {
          // Endpoint unreachable: the panel still manages the roster, it just
          // shows no analytics. It must NOT fall back to reading the data
          // directly — that is the hole this closes.
          setDash({ unavailable: true });
        }
      })();
    // BUG FIX: this used to be `.catch(()=>{})` — a failed load (permission
    // error, network drop) silently fell through to render the full
    // dashboard with company=null / 0 employees / 0 departments, which is
    // visually identical to a legitimately empty new company. An HR admin
    // had no way to tell "you have no team yet" from "something's broken."
    }).catch(()=>{ setLoadError(true); }).finally(()=>setLoading(false));
  },[companyId, retryTick]);

  // Derived stats
  // Aggregates now come from the endpoint. The employee-document fallback
  // keeps the tiles populated while it loads and is aggregate by nature.
  const totalSess  = dash?.kpis?.total_sessions ?? 0;
  const _scored    = employees.filter(e=>(e.avg_score||0)>0);
  const avgScore   = dash?.kpis?.company_avg_score
    ?? (_scored.length ? Math.round(_scored.reduce((a,e)=>a+(e.avg_score||0),0)/_scored.length) : 0);
  const highRisk   = dash?.kpis?.at_risk_count ?? _scored.filter(e=>(e.avg_score||0)<50).length;
  const activeThisWeek = employees.filter(e=>{
    const d=e.last_active?.toDate?.()??new Date(e.last_active||0);
    return Date.now()-d<7*86400000;
  }).length;

  // Filtered employees
  const filtEmp = employees.filter(e=>{
    const matchDept = deptFilter==="all" || (e.department||e.dept)===deptFilter;
    const matchSearch = !search || (e.name||"").toLowerCase().includes(search.toLowerCase()) || (e.email||"").toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  // Sorting by score ranks people even with the number hidden, so under
  // aggregate reporting the roster is alphabetical.
  }).sort((a,b)=> namedOK
      ? (b.avg_score||0)-(a.avg_score||0)
      : String(a.name||a.email||"").localeCompare(String(b.name||b.email||"")));

  // Dept names
  const deptNames = [...new Set(employees.map(e=>e.department||e.dept||"").filter(Boolean))];

  async function addDept() {
    if(!newDept.name.trim()) return;
    try {
      await createDepartment({...newDept, company_id:companyId, created_by:user.uid});
      addToast(isAr?"تم إنشاء القسم":"Department created","success");
      setNewDept({name:"",manager:""});
      const d=await getDepartments(companyId); setDepts(d||[]);
    } catch { addToast("Error","error"); }
  }

  async function removeDept(did) {
    try { await deleteDepartment(did); addToast(isAr?"تم الحذف":"Deleted","warn"); const d=await getDepartments(companyId); setDepts(d||[]); }
    catch { addToast("Error","error"); }
  }

  async function sendInvites() {
    const emails = inviteText.split(/[\n,]+/).map(e=>e.trim()).filter(e=>e.includes("@"));
    if(!emails.length) { addToast(isAr?"أدخل إيميل واحد على الأقل":"Enter at least one email","error"); return; }
    setSending(true);
    // BUG FIX: this never called setSending(false) on any path — success or
    // failure — so after the very first "Send Invites" click, the button
    // (and, since `sending` is shared, the Import-invite Send button and
    // the Monthly Report download button too) stayed permanently disabled
    // for the rest of the session.
    try {
      const emps = emails.map(email=>({name:email.split("@")[0], email, department:"", role:inviteRole}));
      const results = await bulkInviteEmployees(emps, companyId, user.uid);
      const ok = results.filter(r=>r.ok).length;
      addToast(`${ok} ${isAr?"دعوة تم إرسالها":"invites sent"}${results.length-ok>0?` . ${results.length-ok} failed`:""}`, ok>0?"success":"error");
      setInvite("");
    } catch { addToast("Error sending invites","error"); }
    finally { setSending(false); }
  }

  const generateInviteLink = async () => {
    if (!companyId) { addToast(isAr?"مفيش company ID":"No company ID","error"); return; }
    setLinkLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/org/create-invite", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer " + token},
        body: JSON.stringify({ company_id: companyId, role: "employee", expires_days: 7 }),
      }).catch(e => { throw new Error("Network error: " + e.message); });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || "Failed to create invite ("+res.status+")");
      if (res.ok && (data.token || data.invite_id)) {
        const code = data.token || data.invite_id;
        const link = window.location.origin + "/auth?invite=" + code;
        setInviteLink(link);
      } else {
        // BUG FIX: this used to silently fall back to a fake link
        // (?company=X&role=employee) that nothing in the app actually
        // reads — an HR admin would share it with employees and it would
        // just do nothing on signup, with zero indication of failure.
        setInviteLink("");
        addToast(isAr?"تعذر إنشاء رابط الدعوة — جرب تاني":"Couldn't create invite link — try again","error");
      }
    } catch {
      setInviteLink("");
      addToast(isAr?"تعذر إنشاء رابط الدعوة — جرب تاني":"Couldn't create invite link — try again","error");
    }
    setLinkLoading(false);
  };

  const copyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  async function handleCSV(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      // Try backend parse first (supports .xlsx + validation)
      let emps = [];
      let parseOk = false;
      try {
        const { getAuthToken } = await import("./firebase.js");
        const tok = await getAuthToken();
        const res = await fetch(`${API}/hr/parse-csv`, {
          method: "POST",
          headers: tok ? { Authorization: `Bearer ${tok}` } : {},
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          emps = data.valid || [];
          if (data.invalid?.length) {
            addToast(`${data.invalid.length} ${isAr ? "صف غير صالح تم تجاهله" : "invalid rows skipped"}`, "warning");
          }
          parseOk = true;
        }
      } catch (_) { /* fallback to client-side */ }

      // Client-side CSV fallback (CSV only, no .xlsx)
      if (!parseOk && file.name.toLowerCase().endsWith(".csv")) {
        const text  = await file.text();
        const lines = text.split("\n");
        const hdr   = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g,""));
        const ni    = hdr.indexOf("name"),   ei = hdr.indexOf("email"),
              di    = hdr.indexOf("department"), ii = hdr.indexOf("employee_id");
        emps = lines.slice(1).map(l => {
          const cols = l.split(",").map(v => v.trim().replace(/^"|"$/g,""));
          return {
            name:        ni >= 0 ? cols[ni] : cols[0] || "",
            email:       ei >= 0 ? cols[ei] : cols[1] || "",
            department:  di >= 0 ? cols[di] : cols[2] || "General",
            employee_id: ii >= 0 ? cols[ii] : cols[3] || "",
          };
        }).filter(e => e.email?.includes("@") && e.name);
      } else if (!parseOk) {
        addToast(isAr ? "فشل التحليل - جرب ملف CSV" : "Parse failed - try a CSV file", "error");
        setSending(false); e.target.value = ""; return;
      }

      setImportE(emps);
      addToast(`${emps.length} ${isAr ? "موظف جاهز للاستيراد" : "employees ready to import"}`, "success");
    } catch (err) {
      addToast(isAr ? "خطأ في قراءة الملف" : "Error reading file", "error");
      console.error("CSV parse error:", err);
    }
    setSending(false); e.target.value = "";
  }

  async function sendImportInvites() {
    if(!importEmps.length) return;
    setSending(true);
    // BUG FIX: the network call had no try/catch — if it rejected, every
    // line after it (including setSending(false)) was skipped, leaving
    // the Send Invites button stuck disabled/spinning forever with no
    // error shown and no way to retry short of reloading the page.
    try {
      const results = await bulkInviteEmployees(importEmps, companyId, user.uid);
      const ok = results.filter(r=>r.ok).length;
      addToast(`${ok} ${isAr?"دعوة تم إرسالها":"invites sent"}${results.length-ok>0?` . ${results.length-ok} failed`:""}`, ok>0?"success":"error");
      setImportE([]);
    } catch { addToast(isAr?"فشل إرسال الدعوات":"Failed to send invites","error"); }
    finally { setSending(false); }
  }

  async function downloadReport() {
    setSending(true);
    try {
      const tok=await getAuthToken();
      const r=await fetch(`${API}/hr/monthly-report`,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(tok?{Authorization:`Bearer ${tok}`}:{})},
        // `sessions` was every employee's raw session documents, collected by
        // the fan-out this screen no longer does. The server has them already.
        body:JSON.stringify({company_name:company?.name||"Company",employees,month:new Date().toLocaleString("default",{month:"long"}),year:new Date().getFullYear()}),
      });
      if(r.ok){const blob=await r.blob();const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`HR_Report_${Date.now()}.pdf`;a.click();addToast(isAr?"تم تحميل التقرير":"Report downloaded","success");}
      else addToast(isAr?"الباك اند مش شغال - شغّل backend أولاً":"Backend not running","error");
    } catch { addToast(isAr?"الباك اند مش شغال":"Backend not running","error"); }
    setSending(false);
  }

  async function sendAtRiskAlert() {
    if(!alertMsg.trim()) { addToast(isAr?"اكتب رسالة أولاً":"Write a message first","error"); return; }
    setAlertSending(true);
    try {
      const tok = await getAuthToken();
      const r = await fetch(`${API}/company/alert-employees`,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(tok?{Authorization:`Bearer ${tok}`}:{})},
        body: JSON.stringify({ target:"at_risk", message:alertMsg.trim(), lang: isAr?"ar":"en" }),
      });
      const d = await r.json().catch(()=>({}));
      if(r.ok) {
        addToast(isAr?`تم إرسال التنبيه لـ ${d.sent||0} موظف`:`Alert sent to ${d.sent||0} employees`,"success");
        setAlertMsg(""); setShowAlertBox(false);
      } else {
        addToast(d?.error||(isAr?"فشل إرسال التنبيه":"Failed to send alert"),"error");
      }
    } catch { addToast(isAr?"الباك اند مش شغال":"Backend not running","error"); }
    setAlertSending(false);
  }

  const dark = { bg:"#0d1a2e", card:"#05101f", border:"rgba(255,255,255,.07)", text:"#f0f6ff", muted:"#64748b" };

  if(loading) return (
    <div style={{minHeight:"100dvh",background:"#0d1a2e",display:"flex",alignItems:"center",justifyContent:"center",color:"#f0f6ff",fontFamily:"'IBM Plex Sans Arabic','Inter',system-ui"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:36,height:36,border:"3px solid rgba(26,86,219,.3)",borderTopColor:"#1a56db",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/>
        <div style={{fontSize:13,color:"#64748b"}}>{isAr?"جاري التحميل...":"Loading..."}</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(!companyId) return (
    <div style={{minHeight:"100dvh",background:"#0d1a2e",display:"flex",alignItems:"center",justifyContent:"center",color:"#f0f6ff",fontFamily:"'IBM Plex Sans Arabic','Inter',system-ui",padding:24}}>
      <div style={{textAlign:"center",maxWidth:360}}>
        <div style={{fontSize:40,marginBottom:16}}>🏢</div>
        <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>{isAr?"لم تنضم لأي شركة بعد":"No Company Yet"}</div>
        <div style={{fontSize:13,color:"#64748b",lineHeight:1.6,marginBottom:20}}>
          {isAr?"أنشئ مساحة عمل شركتك من الداشبورد الرئيسي":"Create your company workspace from the home dashboard"}
        </div>
        <button onClick={onBack} style={{background:"#1a56db",border:"none",borderRadius:10,padding:"11px 24px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>
          {/* BUG FIX: was a hardcoded "<-" glyph even in Arabic — reads
              backwards next to RTL text. Mirrored to match the convention
              already used elsewhere in this app (e.g. InviteAccept.jsx). */}
          {isAr?"رجوع للداشبورد ->":"<- Back to Dashboard"}
        </button>
      </div>
    </div>
  );

  // BUG FIX: was no error state at all — a failed load (see the .catch above)
  // used to render straight through to the full dashboard looking like a
  // legitimately empty company. This makes the failure visible and gives
  // the admin a way to retry instead of assuming there's simply no data.
  if(loadError) return (
    <div style={{minHeight:"100dvh",background:"#0d1a2e",display:"flex",alignItems:"center",justifyContent:"center",color:"#f0f6ff",fontFamily:"'IBM Plex Sans Arabic','Inter',system-ui",padding:24}}>
      <div style={{textAlign:"center",maxWidth:360}}>
        <div style={{fontSize:40,marginBottom:16}}>⚠️</div>
        <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>{isAr?"تعذّر تحميل بيانات الشركة":"Couldn't Load Company Data"}</div>
        <div style={{fontSize:13,color:"#64748b",lineHeight:1.6,marginBottom:20}}>
          {isAr?"حدث خطأ في الاتصال — حاول مرة أخرى":"Something went wrong connecting to the server — please try again"}
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button onClick={()=>{setLoading(true);setRetryTick(t=>t+1);}} style={{background:"#1a56db",border:"none",borderRadius:10,padding:"11px 24px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>
            {isAr?"إعادة المحاولة":"Retry"}
          </button>
          <button onClick={onBack} style={{background:"transparent",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"11px 24px",fontSize:13,fontWeight:700,color:"#f0f6ff",cursor:"pointer"}}>
            {isAr?"رجوع":"Back"}
          </button>
        </div>
      </div>
    </div>
  );


    function renderInviteTab() {
      return (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
  
          {/* Invite Link Card */}
          <div style={{
            background:"linear-gradient(135deg,rgba(26,86,219,.08),rgba(8,145,178,.05))",
            border:"1px solid rgba(26,86,219,.25)",borderRadius:18,padding:"24px",
          }}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{fontSize:20}}>&#128279;</span>
              <div style={{fontSize:15,fontWeight:700,color:"#f0f6ff"}}>
                {isAr ? "رابط الدعوة (الأسرع)" : "Invite Link (Fastest)"}
              </div>
            </div>
            <p style={{fontSize:12.5,color:"#64748b",lineHeight:1.6,margin:"0 0 18px"}}>
              {isAr ? "ولد رابط دعوة وابعته للفريق - صالح 7 أيام." : "Generate a unique invite link and share with your team. Valid for 7 days."}
            </p>
  
            {inviteLink ? (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,0,0,.3)",border:"1px solid rgba(26,86,219,.3)",borderRadius:10,padding:"10px 14px"}}>
                  <span style={{fontSize:11.5,color:"#60a5fa",fontFamily:"monospace",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {inviteLink}
                  </span>
                  <button onClick={copyInviteLink} style={{
                    flexShrink:0,background:linkCopied?"rgba(16,217,160,.15)":"rgba(26,86,219,.2)",
                    border:"1px solid " + (linkCopied?"rgba(16,217,160,.4)":"rgba(26,86,219,.4)"),
                    borderRadius:7,padding:"5px 12px",fontSize:12,fontWeight:700,
                    color:linkCopied?"#10d9a0":"#60a5fa",cursor:"pointer",
                  }}>
                    {linkCopied ? (isAr ? "v تم النسخ" : "v Copied!") : (isAr ? "نسخ" : "Copy")}
                  </button>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <a href={"https://wa.me/?text=" + encodeURIComponent((isAr?"انضم لـ Corvus: ":"Join Corvus: ")+inviteLink)}
                    target="_blank" rel="noopener noreferrer"
                    style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                      padding:"8px 12px",borderRadius:8,textDecoration:"none",
                      background:"rgba(37,211,102,.1)",border:"1px solid rgba(37,211,102,.25)",
                      color:"#4ade80",fontSize:12,fontWeight:600,minWidth:80}}>
                    WhatsApp
                  </a>
                  <button onClick={function() {
                    var subject = encodeURIComponent(isAr?"دعوة لـ Corvus PostureAI":"Join our Corvus workspace");
                    var body = encodeURIComponent((isAr?"انضم: ":"Join: ")+inviteLink);
                    window.open("mailto:?subject=" + subject + "&body=" + body);
                  }} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                    padding:"8px 12px",borderRadius:8,border:"1px solid rgba(79,124,249,.25)",
                    background:"rgba(79,124,249,.1)",color:"#818cf8",fontSize:12,fontWeight:600,
                    cursor:"pointer",fontFamily:"inherit",minWidth:80}}>
                    {isAr ? "ايميل" : "Email"}
                  </button>
                  <button onClick={generateInviteLink} style={{
                    padding:"8px 14px",borderRadius:8,
                    background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",
                    color:"#475569",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                  }}>
                    {isAr ? "جديد" : "Regenerate"}
                  </button>
                </div>
                <div style={{fontSize:11,color:"#334155"}}>
                  {isAr ? "صالح 7 أيام" : "Valid for 7 days - multiple uses"}
                </div>
              </div>
            ) : (
              <button onClick={generateInviteLink} disabled={linkLoading} style={{
                width:"100%",padding:"13px 0",borderRadius:10,border:"none",
                background:linkLoading?"rgba(255,255,255,.05)":"linear-gradient(135deg,#1a56db,#0891b2)",
                color:linkLoading?"#475569":"#fff",fontSize:14,fontWeight:700,
                cursor:linkLoading?"not-allowed":"pointer",fontFamily:"inherit",
              }}>
                {linkLoading ? "Generating..." : (isAr ? "ولد رابط الدعوة" : "Generate Invite Link")}
              </button>
            )}
          </div>
  
          {/* Email + CSV row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
            {/* Email invite */}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>{isAr ? "دعوة بالإيميل" : "Invite by Email"}</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:16}}>{isAr ? "إيميل في كل سطر أو بفاصلة" : "One email per line or comma-separated"}</div>
              <textarea value={inviteText} onChange={function(e){setInvite(e.target.value);}}
                placeholder="ahmed@company.com"
                rows={5}
                style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,padding:"10px 14px",fontSize:12,color:"#f0f6ff",outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[["employee",isAr?"موظف":"Employee"],["manager",isAr?"مدير":"Manager"],["hr","HR"]].map(function(item) {
                  var v = item[0], l = item[1];
                  return (
                    <button key={v} onClick={function(){setInvRole(v);}}
                      style={{flex:1,padding:"7px 0",fontSize:11,fontWeight:600,
                        border:"1px solid " + (inviteRole===v?"#1a56db":"rgba(255,255,255,.08)"),
                        background:inviteRole===v?"rgba(26,86,219,.12)":"transparent",
                        color:inviteRole===v?"#60a5fa":"#64748b",borderRadius:8,cursor:"pointer"}}>
                      {l}
                    </button>
                  );
                })}
              </div>
              <button onClick={sendInvites} disabled={sending||!inviteText.trim()}
                style={{width:"100%",background:inviteText.trim()?"#1a56db":"rgba(148,163,184,.1)",border:"none",borderRadius:9,padding:"11px 0",fontSize:13,fontWeight:700,color:inviteText.trim()?"#fff":"#64748b",cursor:inviteText.trim()?"pointer":"not-allowed"}}>
                {sending ? "..." : (isAr ? "إرسال الدعوات" : "Send Invites")}
              </button>
            </div>
  
            {/* CSV import */}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>{isAr ? "استيراد CSV" : "Bulk CSV Import"}</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:16}}>Columns: name, email, department</div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleCSV} style={{display:"none"}}/>
              <button onClick={function(){if(fileRef.current) fileRef.current.click();}}
                style={{width:"100%",background:"rgba(26,86,219,.1)",border:"1px solid rgba(26,86,219,.25)",borderRadius:9,padding:"11px 0",fontSize:12,fontWeight:600,color:"#60a5fa",cursor:"pointer",marginBottom:8}}>
                {isAr ? "اختر ملف CSV" : "Choose CSV File"}
              </button>
              <button onClick={function(){var csv="name,email,department\nAhmed,ahmed@co.com,Engineering";var a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download="template.csv";a.click();}}
                style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,padding:"9px 0",fontSize:11,color:"#64748b",cursor:"pointer",marginBottom:16}}>
                {isAr ? "تحميل نموذج" : "Download Template"}
              </button>
              {importEmps.length > 0 && (
                <div>
                  <div style={{fontSize:11,color:"#10b981",marginBottom:10}}>v {importEmps.length} {isAr ? "موظف جاهز" : "employees ready"}</div>
                  <div style={{maxHeight:180,overflowY:"auto",marginBottom:12,display:"flex",flexDirection:"column",gap:4}}>
                    {importEmps.slice(0,10).map(function(e,i) {
                      return (
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"rgba(255,255,255,.03)",borderRadius:7}}>
                          <span style={{fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</span>
                          <span style={{fontSize:10,color:"#64748b"}}>{e.email}</span>
                        </div>
                      );
                    })}
                    {importEmps.length > 10 && <div style={{textAlign:"center",fontSize:10,color:"#64748b"}}>+{importEmps.length-10} {isAr ? "آخرين" : "more"}</div>}
                  </div>
                  <button onClick={sendImportInvites} disabled={sending}
                    style={{width:"100%",background:"#10b981",border:"none",borderRadius:9,padding:"11px 0",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>
                    {sending ? "..." : (isAr ? "إرسال الدعوات" : "Send Invites")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

  return (
    <div dir={isAr?"rtl":"ltr"} style={{minHeight:"100dvh",background:"#0d1a2e",color:"#f0f6ff",fontFamily:"'IBM Plex Sans Arabic','Inter',system-ui,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* -- TOP NAV -- */}
      <div style={{
        padding:"0 20px", height:56,
        borderBottom:"1px solid rgba(255,255,255,.07)",
        background:"rgba(5,16,31,.95)",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:50,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:500,color:"#94a3b8",cursor:"pointer",display:"flex",alignItems:"center",gap:5,flexDirection:isAr?"row-reverse":"row"}}>
            {/* BUG FIX: arrow was hardcoded "<-" even in Arabic, reading
                backwards next to RTL text ("رجوع"). */}
            {isAr?"->":"<-"} {isAr?"رجوع":"Back"}
          </button>
          <div style={{width:1,height:20,background:"rgba(255,255,255,.08)"}}/>
          <div style={{width:26,height:26,background:"linear-gradient(135deg,#1a56db,#0891b2)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>◈</div>
          <div>
            <div style={{fontSize:13,fontWeight:700}}>{company?.name||"Company"} . HR</div>
            <div style={{fontSize:10,color:"#64748b"}}>{employees.length} {isAr?"موظف":"employees"} . {isAr?"مدير:":"Manager:"} {profile?.name||user?.email?.split("@")[0]}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={downloadReport} disabled={sending}
            style={{background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.25)",borderRadius:8,padding:"7px 14px",fontSize:11,fontWeight:600,color:"#10b981",cursor:"pointer"}}>
            {sending?"...":"📄 "}{isAr?"التقرير الشهري":"Monthly Report"}
          </button>
        </div>
      </div>

      {/* -- TABS -- */}
      <div style={{display:"flex",gap:4,padding:"12px 20px",borderBottom:"1px solid rgba(255,255,255,.06)",overflowX:"auto",background:"rgba(5,16,31,.5)"}}>
        {[
          ["overview", isAr?"📊 نظرة عامة":"📊 Overview"],
          ["departments", isAr?"🏢 الأقسام":"🏢 Departments"],
          ["employees", isAr?"👥 الموظفون":"👥 Employees"],
          ["invite", isAr?"✉️ دعوة":"✉️ Invite"],
          ["billing", isAr?"💳 الفواتير":"💳 Billing"],
        ].map(([tt,l])=><Tab key={tt} active={tab===tt} onClick={()=>setTab(tt)}>{l}</Tab>)}
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 20px 60px"}}>

        {/* -- OVERVIEW -- */}
        {tab==="overview"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:24}}>
              <KPI icon="👥" label={isAr?"إجمالي الموظفين":"Total Employees"} value={employees.length} color="#60a5fa"/>
              <KPI icon="📊" label={isAr?"متوسط النقاط":"Avg Score"} value={avgScore?`${avgScore}/100`:"-"} color={avgScore?sc(avgScore):"#475569"} sub={avgScore?grade(avgScore,isAr):null}/>
              <KPI icon="🏢" label={isAr?"الأقسام":"Departments"} value={depts.length} color="#a5b4fc"/>
              <KPI icon="!️" label={isAr?"عالي الخطورة":"High Risk"} value={highRisk} color={highRisk>0?"#ef4444":"#10b981"} sub={highRisk>0?(isAr?"يحتاج تدخل":"Needs attention"):null}/>
              <KPI icon="🔥" label={isAr?"نشط هذا الأسبوع":"Active This Week"} value={activeThisWeek} color="#f59e0b"/>
              <KPI icon="📅" label={isAr?"جلسات الشهر":"Sessions / Mo"} value={totalSess} color="#6ee7b7"/>
            </div>

            {/* Department performance */}
            {depts.length>0&&(
              <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:22,marginBottom:20}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>{isAr?"أداء الأقسام":"Department Performance"}</span>
                  <span style={{fontSize:11,color:"#64748b"}}>{isAr?"الأحمر = يحتاج تدخل":"Red = needs attention"}</span>
                </div>
                {depts.map(d=>{
                  const de=employees.filter(e=>(e.department||e.dept)===d.name&&(e.avg_score||0)>0);
                  const avg=de.length?Math.round(de.reduce((a,e)=>a+(e.avg_score||0),0)/de.length):0;
                  const risk=de.filter(e=>(e.avg_score||0)<50).length;
                  return(
                    <div key={d.id} style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:13,fontWeight:600}}>{d.name}</span>
                          {d.manager&&<span style={{fontSize:10,color:"#64748b"}}>- {d.manager}</span>}
                          <span style={{fontSize:10,color:"#475569",background:"rgba(148,163,184,.08)",borderRadius:99,padding:"1px 8px"}}>{employees.filter(e=>(e.department||e.dept)===d.name).length} {isAr?"موظف":"emp"}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          {risk>0&&<span style={{fontSize:10,color:"#ef4444",fontWeight:600}}>!️ {risk} {isAr?"خطر":"at risk"}</span>}
                          <span style={{fontSize:16,fontWeight:800,color:avg?sc(avg):"#475569"}}>{avg?`${avg}/100`:"-"}</span>
                        </div>
                      </div>
                      <div style={{height:6,borderRadius:99,background:"rgba(148,163,184,.08)",overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${avg}%`,background:avg?`linear-gradient(90deg,${sc(avg)},${sc(avg)}cc)`:"transparent",borderRadius:99,transition:"width .7s"}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Named per-person reporting — a ranked "Top 5" and a list of
                people scoring under 50, both by name, plus a button that
                messages exactly those people. This is what aggregate_only
                exists to suppress, and it was rendering regardless because
                the panel never asked the server what mode the organisation
                was in. Shown only when the server says "individual". */}
            {employees.length>0 && !namedOK && (
              <div style={{background:"rgba(148,163,184,.05)",border:"1px solid rgba(148,163,184,.15)",borderRadius:14,padding:18}}>
                <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",marginBottom:6}}>
                  🔒 {isAr?"التقارير مجمّعة لهذه المؤسسة":"Aggregate reporting for this organisation"}
                </div>
                <div style={{fontSize:11.5,color:"#64748b",lineHeight:1.6}}>
                  {dash?.privacy_note
                    || (isAr
                      ? "درجة كل موظف بيشوفها هو بس. الأرقام فوق مجمّعة على مستوى الشركة والأقسام. لو مؤسستك محتاجة تقارير بالأسماء، ده إعداد بيتغيّر على مستوى الشركة وبقرار صريح."
                      : "Each employee's score is visible only to them. The figures above are company and department aggregates. Named reporting is a deliberate, organisation-level setting.")}
                </div>
                {dash?.suppressed && (
                  <div style={{fontSize:11,color:"#64748b",marginTop:8}}>
                    {isAr ? (dash.message_ar || "") : (dash.message || "")}
                  </div>
                )}
              </div>
            )}
            {employees.length>0 && namedOK && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{background:"rgba(16,185,129,.04)",border:"1px solid rgba(16,185,129,.15)",borderRadius:14,padding:18}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#10b981",marginBottom:12}}>🏆 {isAr?"أفضل 5 موظفين":"Top 5 Employees"}</div>
                  {[...employees].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0)).slice(0,5).map((e,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <span style={{fontSize:12,color:"#64748b",width:16,textAlign:"center",flexShrink:0}}>#{i+1}</span>
                      <div style={{flex:1,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name||e.email?.split("@")[0]}</div>
                      <span style={{fontSize:12,fontWeight:700,color:sc(e.avg_score||0),flexShrink:0}}>{e.avg_score||"-"}</span>
                    </div>
                  ))}
                </div>
                <div style={{background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.15)",borderRadius:14,padding:18}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#ef4444"}}>!️ {isAr?"يحتاجون اهتمام":"Need Attention"}</div>
                    {employees.filter(e=>(e.avg_score||0)>0&&(e.avg_score||0)<50).length>0&&!showAlertBox&&(
                      <button onClick={()=>setShowAlertBox(true)}
                        style={{background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",borderRadius:7,padding:"4px 10px",fontSize:10.5,fontWeight:700,color:"#fca5a5",cursor:"pointer",whiteSpace:"nowrap"}}>
                        📣 {isAr?"إرسال تنبيه":"Send Alert"}
                      </button>
                    )}
                  </div>
                  {employees.filter(e=>(e.avg_score||0)>0&&(e.avg_score||0)<50).map((e,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <div style={{flex:1,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name||e.email?.split("@")[0]}</div>
                      <span style={{fontSize:10,color:"#64748b"}}>{e.department||"-"}</span>
                      <span style={{fontSize:12,fontWeight:700,color:"#ef4444",flexShrink:0}}>{e.avg_score}</span>
                    </div>
                  ))}
                  {employees.filter(e=>(e.avg_score||0)>0&&(e.avg_score||0)<50).length===0&&(
                    <div style={{fontSize:12,color:"#64748b",textAlign:"center",padding:"16px 0"}}>✅ {isAr?"الكل بخير!":"All good!"}</div>
                  )}
                  {showAlertBox&&(
                    <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid rgba(239,68,68,.15)"}}>
                      <textarea value={alertMsg} onChange={e=>setAlertMsg(e.target.value)}
                        placeholder={isAr?"اكتب رسالة التنبيه - هتوصل للموظفين اللي في خطر (Push notification)":"Write the alert message - sent as a push notification to at-risk employees"}
                        rows={3}
                        style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,padding:"10px 12px",fontSize:12,color:"#f0f6ff",outline:"none",fontFamily:"inherit",boxSizing:"border-box",resize:"vertical"}}/>
                      <div style={{display:"flex",gap:8,marginTop:10}}>
                        <button onClick={()=>{setShowAlertBox(false);setAlertMsg("");}} disabled={alertSending}
                          style={{background:"rgba(148,163,184,.1)",border:"1px solid rgba(148,163,184,.2)",borderRadius:8,padding:"7px 14px",fontSize:11.5,color:"#94a3b8",cursor:"pointer",fontWeight:600}}>
                          {isAr?"إلغاء":"Cancel"}
                        </button>
                        <button onClick={sendAtRiskAlert} disabled={alertSending||!alertMsg.trim()}
                          style={{background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.4)",borderRadius:8,padding:"7px 14px",fontSize:11.5,color:"#fca5a5",cursor:"pointer",fontWeight:700,opacity:(alertSending||!alertMsg.trim())?.5:1}}>
                          {alertSending?"...":(isAr?`📣 إرسال لـ ${employees.filter(e=>(e.avg_score||0)>0&&(e.avg_score||0)<50).length} موظف`:`📣 Send to ${employees.filter(e=>(e.avg_score||0)>0&&(e.avg_score||0)<50).length} employees`)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* -- DEPARTMENTS -- */}
        {tab==="departments"&&(
          <>
            <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
              <Inp value={newDept.name} onChange={v=>setNewDept(p=>({...p,name:v}))} placeholder={isAr?"اسم القسم *":"Department name *"} style={{flex:"1 1 180px"}}/>
              <Inp value={newDept.manager} onChange={v=>setNewDept(p=>({...p,manager:v}))} placeholder={isAr?"المدير (اختياري)":"Manager (optional)"} style={{flex:"1 1 150px"}}/>
              <button onClick={addDept} disabled={!newDept.name.trim()}
                style={{background:newDept.name.trim()?"#1a56db":"rgba(148,163,184,.1)",border:"none",borderRadius:9,padding:"10px 18px",fontSize:12,fontWeight:700,color:newDept.name.trim()?"#fff":"#64748b",cursor:newDept.name.trim()?"pointer":"not-allowed"}}>
                + {isAr?"إضافة قسم":"Add Dept"}
              </button>
            </div>
            {depts.length===0?(
              <div style={{textAlign:"center",padding:60,color:"#475569",fontSize:13}}>
                {isAr?"لا توجد أقسام - أضف قسماً أعلاه":"No departments yet - add one above"}
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                {depts.map(d=><DeptCard key={d.id} dept={d} employees={employees} isAr={isAr} onDelete={removeDept}/>)}
              </div>
            )}
          </>
        )}

        {/* -- EMPLOYEES -- */}
        {tab==="employees"&&(
          <>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={isAr?"بحث...":"Search..."}
                style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,padding:"9px 14px",fontSize:12,color:"#f0f6ff",outline:"none",flex:1,minWidth:180}}/>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["all",...deptNames].map(d=>(
                  <button key={d} onClick={()=>setDeptF(d)}
                    style={{background:deptFilter===d?"#1a56db":"transparent",color:deptFilter===d?"#fff":"#64748b",border:`1px solid ${deptFilter===d?"#1a56db":"rgba(255,255,255,.08)"}`,borderRadius:99,padding:"5px 12px",fontSize:10,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>
                    {d==="all"?(isAr?"الكل":"All"):d}
                  </button>
                ))}
              </div>
            </div>
            <div style={{fontSize:11,color:"#475569",marginBottom:10}}>
              {filtEmp.length} {isAr?"موظف":"employees"}
              {namedOK ? ` · ${isAr?"مرتب حسب الأعلى نقاطاً":"sorted by score"}`
                       : ` · ${isAr?"مرتب أبجديًا":"sorted by name"}`}
            </div>
            {!namedOK && (
              <div style={{fontSize:11,color:"#64748b",background:"rgba(148,163,184,.05)",border:"1px solid rgba(148,163,184,.15)",borderRadius:10,padding:"10px 12px",marginBottom:10,lineHeight:1.6}}>
                🔒 {isAr
                  ? "الدرجات مخفية — المؤسسة دي مضبوطة على التقارير المجمّعة. القايمة دي للإدارة (الأقسام والدعوات) بس."
                  : "Scores hidden — this organisation is set to aggregate reporting. This list is for roster management only."}
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {filtEmp.length===0?(
                <div style={{textAlign:"center",padding:60,color:"#475569",fontSize:13}}>{isAr?"لا توجد نتائج":"No results"}</div>
              ):filtEmp.map((e,i)=><EmpRow key={i} emp={e} isAr={isAr} showScore={namedOK}/>)}
            </div>
          </>
        )}

        {/* INVITE */}
        {tab==="invite" && renderInviteTab()}

        {/* BILLING */}
        {tab==="billing"&&<BillingTab company={company} isAr={isAr} addToast={addToast}/>}

      </div>
    </div>
  );
}

export default HRPanel;
