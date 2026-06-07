/**
 * PostureAI Pro — HRPanel v32 (B2B Complete)
 * Full HR dashboard: Overview · Departments · Employees · Billing · Invite
 */
import { useState, useEffect, useRef } from "react";
import {
  getDepartments, createDepartment, deleteDepartment,
  getDepartmentEmployees, bulkInviteEmployees,
  getCompany, updateCompany,
  getUserSessions, getAllUsers,
  getAuthToken, SUPPORT_EMAIL,
} from "./firebase.js";

const sc = v => v>=75?"#10b981":v>=50?"#f59e0b":"#ef4444";
const grade = (v,ar) => v>=85?(ar?"ممتاز":"Excellent"):v>=70?(ar?"جيد":"Good"):v>=50?(ar?"مقبول":"Fair"):(ar?"ضعيف":"Poor");
const API = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

// ── Mini components ────────────────────────────────────────────────
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

// ── Employee row ───────────────────────────────────────────────────
function EmpRow({ emp, isAr, onInvite }) {
  const avg = emp.avg_score || (emp.scores?.length ? Math.round(emp.scores.reduce((a,b)=>a+b,0)/emp.scores.length) : 0);
  const isRisk = avg > 0 && avg < 50;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.06)", borderRadius:12, transition:"background .15s" }}
      onMouseEnter={e=>e.currentTarget.style.background="rgba(26,86,219,.06)"}
      onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.02)"}>
      <div style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,${sc(avg)},${sc(avg)}88)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#fff", fontWeight:700, flexShrink:0 }}>
        {(emp.name||emp.email||"?")[0].toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:"#f0f6ff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{emp.name||emp.email?.split("@")[0]||"Employee"}</div>
        <div style={{ fontSize:10.5, color:"#64748b" }}>{emp.email} {emp.department&&`· ${emp.department}`}</div>
      </div>
      <div style={{ textAlign:"center", flexShrink:0 }}>
        <div style={{ fontSize:18, fontWeight:800, color:avg?sc(avg):"#475569" }}>{avg||"—"}</div>
        {avg>0&&<div style={{ fontSize:9, color:sc(avg) }}>{grade(avg,isAr)}</div>}
      </div>
      <div style={{ fontSize:10.5, color:"#64748b", flexShrink:0 }}>{emp.sessions_count||emp.sessions||0} {isAr?"جلسة":"sess"}</div>
      {isRisk&&<span style={{ background:"rgba(239,68,68,.12)", color:"#ef4444", fontSize:9.5, fontWeight:700, padding:"2px 9px", borderRadius:99, flexShrink:0 }}>⚠️ {isAr?"خطر":"Risk"}</span>}
      {emp.status==="invited"&&<span style={{ background:"rgba(245,158,11,.1)", color:"#f59e0b", fontSize:9.5, padding:"2px 9px", borderRadius:99 }}>{isAr?"مدعو":"Invited"}</span>}
    </div>
  );
}

// ── Dept card ──────────────────────────────────────────────────────
function DeptCard({ dept, allSessions, isAr, onDelete }) {
  const ds = allSessions.filter(s=>(s.department||s.dept)===dept.name);
  const avg = ds.length ? Math.round(ds.reduce((a,s)=>a+(s.avg_score||0),0)/ds.length) : 0;
  const risk = ds.filter(s=>(s.avg_score||0)<50).length;
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
        {[[isAr?"جلسات":"Sessions",ds.length,"#60a5fa"],[isAr?"متوسط":"Avg",avg?`${avg}/100`:"—",avg?sc(avg):"#475569"],[isAr?"خطر":"Risk",risk,risk>0?"#ef4444":"#10b981"]].map(([l,v,c])=>(
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

// ── BILLING PLANS ──────────────────────────────────────────────────
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
          <span style={{color:plan.color,fontSize:10}}>✓</span>
          <span style={{fontSize:11.5,color:"#94a3b8"}}>{f}</span>
        </div>
      ))}
      <div style={{marginTop:14}}>
        {isCur?(
          <div style={{background:`${plan.color}12`,border:`1px solid ${plan.color}25`,borderRadius:8,padding:"8px 0",textAlign:"center",fontSize:12,fontWeight:600,color:plan.color}}>
            {isAr?"خطتك الحالية ✓":"Current Plan ✓"}
          </div>
        ):plan.price_mo?(
          <button onClick={()=>addToast(isAr?"تواصل معنا للترقية":"Contact us to upgrade","info")}
            style={{width:"100%",background:`linear-gradient(135deg,${plan.color},${plan.color}cc)`,border:"none",borderRadius:8,padding:"9px 0",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer"}}>
            {isAr?"ترقية ←":"Upgrade →"}
          </button>
        ):(
          <a href={`mailto:support@postureai.io?subject=Enterprise Plan`}
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
          <div style={{ fontSize:12, color:"#64748b" }}>{isAr?"أسعار مخصصة لفرق العمل":"Team pricing — billed per company"}</div>
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
            [isAr?"المقاعد":"Seats", company?.seats_used||"—", "#10b981"],
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

// ── MAIN COMPONENT ─────────────────────────────────────────────────
export function HRPanel({ user, profile, companyId: cid, cs, t, addToast, onBack, lang="en" }) {
  const isAr = lang==="ar";
  const companyId = cid || profile?.company_id;

  const [tab,        setTab]      = useState("overview");
  const [company,    setCompany]  = useState(null);
  const [depts,      setDepts]    = useState([]);
  const [employees,  setEmployees]= useState([]);
  const [allSessions,setAllSess]  = useState([]);
  const [loading,    setLoading]  = useState(true);
  const [newDept,    setNewDept]  = useState({name:"",manager:""});
  const [inviteText, setInvite]   = useState("");
  const [inviteRole, setInvRole]  = useState("employee");
  const [importEmps, setImportE]  = useState([]);
  const [sending,    setSending]  = useState(false);
  const [deptFilter, setDeptF]    = useState("all");
  const [search,     setSearch]   = useState("");
  const fileRef = useRef();

  // Load everything
  useEffect(()=>{
    if(!companyId){ setLoading(false); return; }
    Promise.all([
      getCompany(companyId),
      getDepartments(companyId),
      getDepartmentEmployees(companyId, null),
    ]).then(([co,dp,em])=>{
      setCompany(co);
      setDepts(dp||[]);
      setEmployees(em||[]);
      // Load sessions for each employee
      Promise.allSettled((em||[]).slice(0,50).map(e=>getUserSessions(e.id||e.uid)))
        .then(results=>{
          const all=results.flatMap(r=>r.status==="fulfilled"?r.value:[]);
          setAllSess(all);
        });
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[companyId]);

  // Derived stats
  const totalSess  = allSessions.length;
  const avgScore   = totalSess ? Math.round(allSessions.reduce((a,s)=>a+(s.avg_score||0),0)/totalSess) : 0;
  const highRisk   = employees.filter(e=>(e.avg_score||0)>0&&(e.avg_score||0)<50).length;
  const activeThisWeek = employees.filter(e=>{
    const d=e.last_active?.toDate?.()??new Date(e.last_active||0);
    return Date.now()-d<7*86400000;
  }).length;

  // Filtered employees
  const filtEmp = employees.filter(e=>{
    const matchDept = deptFilter==="all" || (e.department||e.dept)===deptFilter;
    const matchSearch = !search || (e.name||"").toLowerCase().includes(search.toLowerCase()) || (e.email||"").toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  }).sort((a,b)=>(b.avg_score||0)-(a.avg_score||0));

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
    try {
      const emps = emails.map(email=>({name:email.split("@")[0], email, department:"", role:inviteRole}));
      const results = await bulkInviteEmployees(emps, companyId, user.uid);
      const ok = results.filter(r=>r.ok).length;
      addToast(`${ok} ${isAr?"دعوة تم إرسالها":"invites sent"}${results.length-ok>0?` · ${results.length-ok} failed`:""}`, ok>0?"success":"error");
      setInvite("");
    } catch { addToast("Error sending invites","error"); }
    setSending(false);
  }

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
        addToast(isAr ? "فشل التحليل — جرب ملف CSV" : "Parse failed — try a CSV file", "error");
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
    const results=await bulkInviteEmployees(importEmps, companyId, user.uid);
    const ok=results.filter(r=>r.ok).length;
    addToast(`${ok} ${isAr?"دعوة تم إرسالها":"invites sent"}`, "success");
    setImportE([]);
    setSending(false);
  }

  async function downloadReport() {
    setSending(true);
    try {
      const tok=await getAuthToken();
      const r=await fetch(`${API}/hr/monthly-report`,{
        method:"POST",
        headers:{"Content-Type":"application/json",...(tok?{Authorization:`Bearer ${tok}`}:{})},
        body:JSON.stringify({company_name:company?.name||"Company",sessions:allSessions,employees,month:new Date().toLocaleString("default",{month:"long"}),year:new Date().getFullYear()}),
      });
      if(r.ok){const blob=await r.blob();const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`HR_Report_${Date.now()}.pdf`;a.click();addToast(isAr?"تم تحميل التقرير":"Report downloaded","success");}
      else addToast(isAr?"الباك اند مش شغال — شغّل backend أولاً":"Backend not running","error");
    } catch { addToast(isAr?"الباك اند مش شغال":"Backend not running","error"); }
    setSending(false);
  }

  const dark = { bg:"#030b14", card:"#05101f", border:"rgba(255,255,255,.07)", text:"#f0f6ff", muted:"#64748b" };

  if(loading) return (
    <div style={{minHeight:"100vh",background:"#030b14",display:"flex",alignItems:"center",justifyContent:"center",color:"#f0f6ff",fontFamily:"'Inter',system-ui"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:36,height:36,border:"3px solid rgba(26,86,219,.3)",borderTopColor:"#1a56db",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 16px"}}/>
        <div style={{fontSize:13,color:"#64748b"}}>{isAr?"جاري التحميل...":"Loading..."}</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(!companyId) return (
    <div style={{minHeight:"100vh",background:"#030b14",display:"flex",alignItems:"center",justifyContent:"center",color:"#f0f6ff",fontFamily:"'Inter',system-ui",padding:24}}>
      <div style={{textAlign:"center",maxWidth:360}}>
        <div style={{fontSize:40,marginBottom:16}}>🏢</div>
        <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>{isAr?"لم تنضم لأي شركة بعد":"No Company Yet"}</div>
        <div style={{fontSize:13,color:"#64748b",lineHeight:1.6,marginBottom:20}}>
          {isAr?"أنشئ مساحة عمل شركتك من الداشبورد الرئيسي":"Create your company workspace from the home dashboard"}
        </div>
        <button onClick={onBack} style={{background:"#1a56db",border:"none",borderRadius:10,padding:"11px 24px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>
          {isAr?"← رجوع للداشبورد":"← Back to Dashboard"}
        </button>
      </div>
    </div>
  );

  return (
    <div dir={isAr?"rtl":"ltr"} style={{minHeight:"100vh",background:"#030b14",color:"#f0f6ff",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── TOP NAV ── */}
      <div style={{
        padding:"0 20px", height:56,
        borderBottom:"1px solid rgba(255,255,255,.07)",
        background:"rgba(5,16,31,.95)",
        backdropFilter:"blur(12px)",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:50,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:500,color:"#94a3b8",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            ← {isAr?"رجوع":"Back"}
          </button>
          <div style={{width:1,height:20,background:"rgba(255,255,255,.08)"}}/>
          <div style={{width:26,height:26,background:"linear-gradient(135deg,#1a56db,#0891b2)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>◈</div>
          <div>
            <div style={{fontSize:13,fontWeight:700}}>{company?.name||"Company"} · HR</div>
            <div style={{fontSize:10,color:"#64748b"}}>{employees.length} {isAr?"موظف":"employees"} · {isAr?"مدير:":"Manager:"} {profile?.name||user?.email?.split("@")[0]}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={downloadReport} disabled={sending}
            style={{background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.25)",borderRadius:8,padding:"7px 14px",fontSize:11,fontWeight:600,color:"#10b981",cursor:"pointer"}}>
            {sending?"...":"📄 "}{isAr?"التقرير الشهري":"Monthly Report"}
          </button>
        </div>
      </div>

      {/* ── TABS ── */}
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

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:24}}>
              <KPI icon="👥" label={isAr?"إجمالي الموظفين":"Total Employees"} value={employees.length} color="#60a5fa"/>
              <KPI icon="📊" label={isAr?"متوسط النقاط":"Avg Score"} value={avgScore?`${avgScore}/100`:"—"} color={avgScore?sc(avgScore):"#475569"} sub={avgScore?grade(avgScore,isAr):null}/>
              <KPI icon="🏢" label={isAr?"الأقسام":"Departments"} value={depts.length} color="#a5b4fc"/>
              <KPI icon="⚠️" label={isAr?"عالي الخطورة":"High Risk"} value={highRisk} color={highRisk>0?"#ef4444":"#10b981"} sub={highRisk>0?(isAr?"يحتاج تدخل":"Needs attention"):null}/>
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
                  const ds=allSessions.filter(s=>(s.department||s.dept)===d.name);
                  const avg=ds.length?Math.round(ds.reduce((a,s)=>a+(s.avg_score||0),0)/ds.length):0;
                  const risk=employees.filter(e=>(e.department||e.dept)===d.name&&(e.avg_score||0)>0&&(e.avg_score||0)<50).length;
                  return(
                    <div key={d.id} style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:13,fontWeight:600}}>{d.name}</span>
                          {d.manager&&<span style={{fontSize:10,color:"#64748b"}}>— {d.manager}</span>}
                          <span style={{fontSize:10,color:"#475569",background:"rgba(148,163,184,.08)",borderRadius:99,padding:"1px 8px"}}>{employees.filter(e=>(e.department||e.dept)===d.name).length} {isAr?"موظف":"emp"}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          {risk>0&&<span style={{fontSize:10,color:"#ef4444",fontWeight:600}}>⚠️ {risk} {isAr?"خطر":"at risk"}</span>}
                          <span style={{fontSize:16,fontWeight:800,color:avg?sc(avg):"#475569"}}>{avg?`${avg}/100`:"—"}</span>
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

            {/* Top & risk employees */}
            {employees.length>0&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div style={{background:"rgba(16,185,129,.04)",border:"1px solid rgba(16,185,129,.15)",borderRadius:14,padding:18}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#10b981",marginBottom:12}}>🏆 {isAr?"أفضل 5 موظفين":"Top 5 Employees"}</div>
                  {[...employees].sort((a,b)=>(b.avg_score||0)-(a.avg_score||0)).slice(0,5).map((e,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <span style={{fontSize:12,color:"#64748b",width:16,textAlign:"center",flexShrink:0}}>#{i+1}</span>
                      <div style={{flex:1,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name||e.email?.split("@")[0]}</div>
                      <span style={{fontSize:12,fontWeight:700,color:sc(e.avg_score||0),flexShrink:0}}>{e.avg_score||"—"}</span>
                    </div>
                  ))}
                </div>
                <div style={{background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.15)",borderRadius:14,padding:18}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#ef4444",marginBottom:12}}>⚠️ {isAr?"يحتاجون اهتمام":"Need Attention"}</div>
                  {employees.filter(e=>(e.avg_score||0)>0&&(e.avg_score||0)<50).slice(0,5).map((e,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <div style={{flex:1,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name||e.email?.split("@")[0]}</div>
                      <span style={{fontSize:10,color:"#64748b"}}>{e.department||"—"}</span>
                      <span style={{fontSize:12,fontWeight:700,color:"#ef4444",flexShrink:0}}>{e.avg_score}</span>
                    </div>
                  ))}
                  {employees.filter(e=>(e.avg_score||0)>0&&(e.avg_score||0)<50).length===0&&(
                    <div style={{fontSize:12,color:"#64748b",textAlign:"center",padding:"16px 0"}}>✅ {isAr?"الكل بخير!":"All good!"}</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── DEPARTMENTS ── */}
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
                {isAr?"لا توجد أقسام — أضف قسماً أعلاه":"No departments yet — add one above"}
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                {depts.map(d=><DeptCard key={d.id} dept={d} allSessions={allSessions} isAr={isAr} onDelete={removeDept}/>)}
              </div>
            )}
          </>
        )}

        {/* ── EMPLOYEES ── */}
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
            <div style={{fontSize:11,color:"#475569",marginBottom:10}}>{filtEmp.length} {isAr?"موظف":"employees"} · {isAr?"مرتب حسب الأعلى نقاطاً":"sorted by score"}</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {filtEmp.length===0?(
                <div style={{textAlign:"center",padding:60,color:"#475569",fontSize:13}}>{isAr?"لا توجد نتائج":"No results"}</div>
              ):filtEmp.map((e,i)=><EmpRow key={i} emp={e} isAr={isAr}/>)}
            </div>
          </>
        )}

        {/* ── INVITE ── */}
        {tab==="invite"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
            {/* Email invite */}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>✉️ {isAr?"دعوة بالإيميل":"Invite by Email"}</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:16}}>{isAr?"إيميل واحد في كل سطر أو مفصولة بفاصلة":"One email per line or comma-separated"}</div>
              <textarea value={inviteText} onChange={e=>setInvite(e.target.value)}
                placeholder={isAr?"ahmed@company.com\nfatma@company.com":"ahmed@company.com\nfatma@company.com"}
                rows={5}
                style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,padding:"10px 14px",fontSize:12,color:"#f0f6ff",outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                {[["employee",isAr?"موظف":"Employee"],["manager",isAr?"مدير":"Manager"],["hr",isAr?"HR":"HR"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setInvRole(v)}
                    style={{flex:1,padding:"7px 0",fontSize:11,fontWeight:600,border:`1px solid ${inviteRole===v?"#1a56db":"rgba(255,255,255,.08)"}`,background:inviteRole===v?"rgba(26,86,219,.12)":"transparent",color:inviteRole===v?"#60a5fa":"#64748b",borderRadius:8,cursor:"pointer"}}>
                    {l}
                  </button>
                ))}
              </div>
              <button onClick={sendInvites} disabled={sending||!inviteText.trim()}
                style={{width:"100%",background:inviteText.trim()?"#1a56db":"rgba(148,163,184,.1)",border:"none",borderRadius:9,padding:"11px 0",fontSize:13,fontWeight:700,color:inviteText.trim()?"#fff":"#64748b",cursor:inviteText.trim()?"pointer":"not-allowed"}}>
                {sending?"...":(isAr?"✉️ إرسال الدعوات":"✉️ Send Invites")}
              </button>
            </div>

            {/* CSV import */}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:22}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>📥 {isAr?"استيراد CSV":"Bulk CSV Import"}</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:16}}>
                {isAr?"أعمدة: name, email, department":"Columns: name, email, department"}
              </div>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleCSV} style={{display:"none"}}/>
              <button onClick={()=>fileRef.current?.click()}
                style={{width:"100%",background:"rgba(26,86,219,.1)",border:"1px solid rgba(26,86,219,.25)",borderRadius:9,padding:"11px 0",fontSize:12,fontWeight:600,color:"#60a5fa",cursor:"pointer",marginBottom:8}}>
                📂 {isAr?"اختر ملف CSV":"Choose CSV File"}
              </button>
              <button onClick={()=>{const csv="name,email,department\nAhmed,ahmed@co.com,Engineering\nFatma,fatma@co.com,HR";const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download="template.csv";a.click();}}
                style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:9,padding:"9px 0",fontSize:11,color:"#64748b",cursor:"pointer",marginBottom:16}}>
                ↓ {isAr?"تحميل نموذج":"Download Template"}
              </button>
              {importEmps.length>0&&(
                <>
                  <div style={{fontSize:11,color:"#10b981",marginBottom:10}}>✓ {importEmps.length} {isAr?"موظف جاهز":"employees ready"}</div>
                  <div style={{maxHeight:180,overflowY:"auto",marginBottom:12,display:"flex",flexDirection:"column",gap:4}}>
                    {importEmps.slice(0,10).map((e,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"rgba(255,255,255,.03)",borderRadius:7}}>
                        <span style={{fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</span>
                        <span style={{fontSize:10,color:"#64748b"}}>{e.email}</span>
                      </div>
                    ))}
                    {importEmps.length>10&&<div style={{textAlign:"center",fontSize:10,color:"#64748b"}}>+{importEmps.length-10} {isAr?"آخرين":"more"}</div>}
                  </div>
                  <button onClick={sendImportInvites} disabled={sending}
                    style={{width:"100%",background:"#10b981",border:"none",borderRadius:9,padding:"11px 0",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer"}}>
                    {sending?"...":(isAr?"✓ إرسال الدعوات":"✓ Send Invites")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── BILLING ── */}
        {tab==="billing"&&<BillingTab company={company} isAr={isAr} addToast={addToast}/>}

      </div>
    </div>
  );
}

export default HRPanel;
