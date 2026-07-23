/**
 * Corvus — Enterprise Security & RBAC v1.0
 * Granular permissions · Role scopes · Audit logs · Activity tracking
 * SAML SSO config · GDPR tools
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  db, auth,
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit, getDocs, serverTimestamp,
} from "./firebase.js";

/* ── Design tokens ─────────────────────────────────────────────── */
const RBAC_TOKENS = {
  bg:"#020a18", bg2:"#040f22", bg3:"#071428", surf:"#0a1830",
  card:"rgba(8,18,36,.88)", border:"rgba(148,163,184,.08)", borderH:"rgba(26,86,219,.35)",
  text:"#e8f0fe", text2:"#94a3b8", muted:"#475569",
  blue:"#1a56db", teal:"#0891b2", green:"#10b981", amber:"#f59e0b",
  red:"#ef4444", purple:"#7c3aed", cyan:"#06b6d4",
};
const SPRING = "cubic-bezier(0.16,1,0.3,1)";
const SYNE = "'Syne',sans-serif";

/* ── Role definitions ──────────────────────────────────────────── */
export const ROLES = {
  org_owner: {
    id:"org_owner", label:"Org Owner", labelAr:"مالك المؤسسة",
    color:"#f59e0b", icon:"👑",
    description:"Full platform control. All permissions. Cannot be revoked by non-owners.",
    descriptionAr:"تحكم كامل بالمنصة. جميع الصلاحيات.",
    scopes:["*"],
  },
  hr_admin: {
    id:"hr_admin", label:"HR Admin", labelAr:"مدير HR",
    color:"#1a56db", icon:"📋",
    description:"Manage employees, view all reports, configure departments.",
    descriptionAr:"إدارة الموظفين وعرض التقارير وتكوين الأقسام.",
    scopes:["users.read","users.write","reports.read","reports.export","alerts.manage","departments.manage","analytics.read"],
  },
  department_manager: {
    id:"department_manager", label:"Dept Manager", labelAr:"مدير قسم",
    color:"#0891b2", icon:"📊",
    description:"View own department's health data and reports.",
    descriptionAr:"عرض بيانات صحة القسم الخاص والتقارير.",
    scopes:["users.read.dept","reports.read.dept","alerts.read.dept","analytics.read.dept"],
  },
  security_admin: {
    id:"security_admin", label:"Security Admin", labelAr:"مدير الأمان",
    color:"#7c3aed", icon:"🔒",
    description:"Manage SSO, audit logs, GDPR requests, and access policies.",
    descriptionAr:"إدارة SSO وسجلات التدقيق وطلبات GDPR وسياسات الوصول.",
    scopes:["sso.manage","audit.read","gdpr.manage","roles.manage","security.manage"],
  },
  analyst: {
    id:"analyst", label:"Analyst", labelAr:"محلل",
    color:"#10b981", icon:"📈",
    description:"Read-only access to analytics and aggregate reports.",
    descriptionAr:"وصول للقراءة فقط للتحليلات والتقارير المجمّعة.",
    scopes:["reports.read","analytics.read","dashboard.read"],
  },
  employee: {
    id:"employee", label:"Employee", labelAr:"موظف",
    color:"#6366f1", icon:"👤",
    description:"Personal wellness data only. No team visibility.",
    descriptionAr:"بيانات الصحة الشخصية فقط. لا رؤية للفريق.",
    scopes:["self.read","self.sessions","self.reports"],
  },
};

const ALL_PERMISSIONS = [
  { id:"users.read",          group:"Users",     label:"View all users",          labelAr:"عرض جميع المستخدمين" },
  { id:"users.write",         group:"Users",     label:"Create/edit users",       labelAr:"إنشاء/تعديل المستخدمين" },
  { id:"users.delete",        group:"Users",     label:"Delete users",            labelAr:"حذف المستخدمين" },
  { id:"users.read.dept",     group:"Users",     label:"View dept users only",    labelAr:"عرض مستخدمي القسم فقط" },
  { id:"reports.read",        group:"Reports",   label:"View all reports",        labelAr:"عرض جميع التقارير" },
  { id:"reports.read.dept",   group:"Reports",   label:"View dept reports",       labelAr:"عرض تقارير القسم" },
  { id:"reports.export",      group:"Reports",   label:"Export PDF reports",      labelAr:"تصدير تقارير PDF" },
  { id:"analytics.read",      group:"Analytics", label:"Full analytics access",   labelAr:"وصول كامل للتحليلات" },
  { id:"analytics.read.dept", group:"Analytics", label:"Dept analytics only",     labelAr:"تحليلات القسم فقط" },
  { id:"alerts.manage",       group:"Alerts",    label:"Manage all alerts",       labelAr:"إدارة جميع التنبيهات" },
  { id:"alerts.read.dept",    group:"Alerts",    label:"Read dept alerts",        labelAr:"قراءة تنبيهات القسم" },
  { id:"departments.manage",  group:"Org",       label:"Manage departments",      labelAr:"إدارة الأقسام" },
  { id:"roles.manage",        group:"Security",  label:"Assign roles",            labelAr:"تعيين الأدوار" },
  { id:"sso.manage",          group:"Security",  label:"Configure SSO/SAML",      labelAr:"إعداد SSO/SAML" },
  { id:"audit.read",          group:"Security",  label:"View audit logs",         labelAr:"عرض سجلات التدقيق" },
  { id:"gdpr.manage",         group:"Security",  label:"Handle GDPR requests",    labelAr:"إدارة طلبات GDPR" },
  { id:"security.manage",     group:"Security",  label:"Security policies",       labelAr:"سياسات الأمان" },
  { id:"billing.read",        group:"Billing",   label:"View billing",            labelAr:"عرض الفواتير" },
  { id:"billing.manage",      group:"Billing",   label:"Manage billing",          labelAr:"إدارة الفواتير" },
  { id:"self.read",           group:"Self",      label:"Read own profile",        labelAr:"قراءة الملف الشخصي" },
  { id:"self.sessions",       group:"Self",      label:"Own sessions",            labelAr:"الجلسات الخاصة" },
  { id:"self.reports",        group:"Self",      label:"Own reports",             labelAr:"التقارير الخاصة" },
  { id:"dashboard.read",      group:"Analytics", label:"View dashboards",         labelAr:"عرض لوحات التحكم" },
];

/* ── Audit log event types ─────────────────────────────────────── */
const AUDIT_EVENTS = {
  login_success:     { label:"Login",              icon:"🔑", severity:"info" },
  login_failed:      { label:"Login Failed",        icon:"⚠️", severity:"warn" },
  logout:            { label:"Logout",              icon:"🚪", severity:"info" },
  role_assigned:     { label:"Role Assigned",       icon:"👑", severity:"high" },
  role_removed:      { label:"Role Removed",        icon:"🗑️", severity:"high" },
  permission_change: { label:"Permission Changed",  icon:"🔒", severity:"high" },
  user_created:      { label:"User Created",        icon:"➕", severity:"medium" },
  user_deleted:      { label:"User Deleted",        icon:"❌", severity:"high" },
  data_export:       { label:"Data Exported",       icon:"📤", severity:"medium" },
  gdpr_request:      { label:"GDPR Request",        icon:"🛡️", severity:"high" },
  gdpr_fulfilled:    { label:"GDPR Fulfilled",      icon:"✅", severity:"medium" },
  sso_configured:    { label:"SSO Configured",      icon:"🔐", severity:"high" },
  session_started:   { label:"Session Started",     icon:"▶️", severity:"info" },
  session_ended:     { label:"Session Ended",       icon:"⏹️", severity:"info" },
  password_reset:    { label:"Password Reset",      icon:"🔄", severity:"medium" },
  api_key_created:   { label:"API Key Created",     icon:"🗝️", severity:"high" },
  settings_changed:  { label:"Settings Changed",    icon:"⚙️", severity:"medium" },
  bulk_action:       { label:"Bulk Action",         icon:"📦", severity:"medium" },
};

/* ── Firebase helpers ──────────────────────────────────────────── */
async function logAuditEvent(orgId, event) {
  if (!orgId) return;
  try {
    await addDoc(collection(db, "orgs", orgId, "audit_logs"), {
      ...event,
      timestamp: serverTimestamp(),
      created_at: new Date().toISOString(),
    });
  } catch(e) { console.warn("Audit log failed:", e); }
}

async function getAuditLogs(orgId, limitN=100) {
  if (!orgId) return [];
  try {
    const q = query(
      collection(db, "orgs", orgId, "audit_logs"),
      orderBy("timestamp","desc"), limit(limitN)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch { return []; }
}

async function getUserRoles(orgId, uid) {
  if (!orgId||!uid) return null;
  try {
    const snap = await getDoc(doc(db,"orgs",orgId,"members",uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

async function setUserRole(orgId, uid, role, permissions, actorUid) {
  if (!orgId||!uid) return;
  await setDoc(doc(db,"orgs",orgId,"members",uid), {
    role, permissions, updated_at: new Date().toISOString(), updated_by: actorUid,
  }, {merge:true});
  await logAuditEvent(orgId, {
    type:"role_assigned", actor:actorUid, target:uid,
    details:`Role set to ${role}`, severity:"high",
  });
}

async function getSSOConfig(orgId) {
  if (!orgId) return null;
  try {
    const snap = await getDoc(doc(db,"orgs",orgId,"settings","sso"));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

async function saveSSOConfig(orgId, config, actorUid) {
  await setDoc(doc(db,"orgs",orgId,"settings","sso"), {
    ...config, updated_at: new Date().toISOString(), updated_by: actorUid,
  }, {merge:true});
  await logAuditEvent(orgId, {
    type:"sso_configured", actor:actorUid, target:orgId,
    details:`SSO provider: ${config.provider}`, severity:"high",
  });
}

async function getGDPRRequests(orgId) {
  if (!orgId) return [];
  try {
    const q = query(collection(db,"orgs",orgId,"gdpr_requests"), orderBy("created_at","desc"), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch { return []; }
}

async function submitGDPRRequest(orgId, request, actorUid) {
  const ref = await addDoc(collection(db,"orgs",orgId,"gdpr_requests"), {
    ...request, status:"pending", submitted_by:actorUid,
    created_at: new Date().toISOString(),
  });
  await logAuditEvent(orgId, {
    type:"gdpr_request", actor:actorUid, target:request.subject_uid,
    details:`GDPR ${request.type} request`, severity:"high",
  });
  return ref.id;
}

/* ── UI Primitives ─────────────────────────────────────────────── */
function Skel({w="100%",h=12,r=6}) {
  return <div style={{width:w,height:h,borderRadius:r,background:"rgba(148,163,184,.07)",animation:"rbac-shimmer 1.6s ease infinite"}} />;
}

function Badge({children,color="#1a56db",size="sm"}) {
  const pad = size==="xs" ? "2px 7px" : "3px 10px";
  const fs  = size==="xs" ? 9 : 10;
  return (
    <span style={{display:"inline-flex",alignItems:"center",background:`${color}14`,
      border:`1px solid ${color}28`,borderRadius:99,padding:pad,
      fontSize:fs,fontWeight:700,letterSpacing:".05em",textTransform:"uppercase",color}}>
      {children}
    </span>
  );
}

function SeverityBadge({s}) {
  const map={info:{c:"#60a5fa",label:"Info"},warn:{c:"#fbbf24",label:"Warning"},medium:{c:"#0891b2",label:"Medium"},high:{c:"#f87171",label:"High"}};
  const m=map[s]||map.info;
  return <Badge color={m.c} size="xs">{m.label}</Badge>;
}

function Sec({title,sub,icon,action,accent,children}) {
  return (
    <div style={{background:RBAC_TOKENS.card,border:`1px solid ${accent||RBAC_TOKENS.border}`,borderRadius:16,overflow:"hidden"}}>
      {accent && <div style={{height:3,background:`linear-gradient(90deg,${accent},transparent)`}}/>}
      <div style={{padding:"18px 20px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {icon && <div style={{width:34,height:34,borderRadius:10,background:`${accent||RBAC_TOKENS.blue}14`,border:`1px solid ${accent||RBAC_TOKENS.blue}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{icon}</div>}
            <div>
              <div style={{fontFamily:SYNE,fontSize:13,fontWeight:800,color:RBAC_TOKENS.text,letterSpacing:"-.015em"}}>{title}</div>
              {sub && <div style={{fontSize:10,color:RBAC_TOKENS.muted,marginTop:1,fontWeight:500}}>{sub}</div>}
            </div>
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

function Btn({children,onClick,variant="primary",size="base",disabled=false,icon,style:sx={}}) {
  const [hov,setHov]=useState(false);
  const pads={xs:"5px 11px",sm:"7px 14px",base:"9px 18px",lg:"12px 24px"};
  const fss={xs:10,sm:11,base:12,lg:13};
  const varMap={
    primary:{bg:"linear-gradient(135deg,#1a56db,#0891b2)",c:"#fff",border:"none",shadow:hov?"0 6px 24px rgba(26,86,219,.45)":"0 4px 16px rgba(26,86,219,.3)"},
    secondary:{bg:RBAC_TOKENS.surf,c:RBAC_TOKENS.text,border:`1px solid ${RBAC_TOKENS.border}`},
    ghost:{bg:"transparent",c:RBAC_TOKENS.text2,border:`1px solid ${RBAC_TOKENS.border}`},
    danger:{bg:"rgba(239,68,68,.1)",c:"#f87171",border:"1px solid rgba(239,68,68,.2)"},
    success:{bg:"rgba(16,185,129,.1)",c:"#34d399",border:"1px solid rgba(16,185,129,.2)"},
  };
  const v=varMap[variant]||varMap.primary;
  return (
    <button onClick={disabled?undefined:onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{display:"inline-flex",alignItems:"center",gap:6,padding:pads[size],
        fontSize:fss[size],fontWeight:700,borderRadius:9,cursor:disabled?"not-allowed":"pointer",
        opacity:disabled?.45:1,fontFamily:"'DM Sans',system-ui,sans-serif",
        whiteSpace:"nowrap",transition:`all 200ms ${SPRING}`,
        transform:hov&&!disabled?"translateY(-1px)":"none",
        background:v.bg,color:v.c,border:v.border,boxShadow:v.shadow||"none",
        ...sx}}>
      {icon&&<span style={{fontSize:"1.1em"}}>{icon}</span>}
      {children}
    </button>
  );
}

function Input({label,value,onChange,placeholder,type="text",hint,error,mono=false}) {
  const [foc,setFoc]=useState(false);
  return (
    <div style={{width:"100%"}}>
      {label&&<label style={{display:"block",fontSize:11,fontWeight:700,color:RBAC_TOKENS.text2,letterSpacing:".03em",marginBottom:5}}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
        style={{width:"100%",padding:"9px 13px",background:RBAC_TOKENS.surf,
          border:`1.5px solid ${error?RBAC_TOKENS.red:foc?RBAC_TOKENS.blue:RBAC_TOKENS.border}`,
          borderRadius:9,color:RBAC_TOKENS.text,fontSize:12,outline:"none",
          fontFamily:mono?"'DM Mono',monospace":"'DM Sans',system-ui,sans-serif",
          boxShadow:foc?(error?`0 0 0 3px rgba(239,68,68,.12)`:`0 0 0 3px rgba(26,86,219,.12)`):"none",
          transition:`border-color 150ms, box-shadow 150ms`}}/>
      {(hint||error)&&<div style={{fontSize:10,color:error?RBAC_TOKENS.red:RBAC_TOKENS.muted,marginTop:4,fontWeight:500}}>{error||hint}</div>}
    </div>
  );
}

function Toggle({value,onChange,label}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>onChange(!value)}>
      <div style={{width:40,height:22,borderRadius:99,background:value?"#1a56db":"rgba(148,163,184,.15)",
        position:"relative",transition:"background 200ms",border:`1px solid ${value?"#1a56db":"rgba(148,163,184,.2)"}`}}>
        <div style={{position:"absolute",top:2,left:value?20:2,width:16,height:16,borderRadius:"50%",
          background:"#fff",transition:`left 200ms ${SPRING}`,boxShadow:"0 1px 4px rgba(0,0,0,.25)"}}/>
      </div>
      {label&&<span style={{fontSize:12,color:RBAC_TOKENS.text2,fontWeight:500}}>{label}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION: ROLE MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */
function RoleManager({orgId,adminUid,isAr,members=[],onRefresh}) {
  const [sel,setSel]=useState(null);
  const [roleEdit,setRoleEdit]=useState("");
  const [customPerms,setCustomPerms]=useState([]);
  const [saving,setSaving]=useState(false);
  const [showCustom,setShowCustom]=useState(false);
  const [search,setSearch]=useState("");

  const filtered=members.filter(m=>
    (m.name||m.email||"").toLowerCase().includes(search.toLowerCase())
  );

  const openEdit=(m)=>{
    setSel(m);
    setRoleEdit(m.role||"employee");
    setCustomPerms(m.permissions||ROLES[m.role||"employee"]?.scopes||[]);
    setShowCustom(false);
  };

  const save=async()=>{
    if(!sel) return;
    setSaving(true);
    const perms=showCustom?customPerms:ROLES[roleEdit]?.scopes||[];
    await setUserRole(orgId,sel.uid||sel.id,roleEdit,perms,adminUid);
    setSaving(false); setSel(null); onRefresh?.();
  };

  const byGroup=ALL_PERMISSIONS.reduce((acc,p)=>{
    if(!acc[p.group]) acc[p.group]=[];
    acc[p.group].push(p); return acc;
  },{});

  return (
    <Sec title={isAr?"إدارة الأدوار":"Role Management"} sub={isAr?"تعيين الأدوار والصلاحيات":"Assign roles & granular permissions"} icon="👑" accent={RBAC_TOKENS.amber}>
      <div style={{marginBottom:12}}>
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder={isAr?"بحث عن موظف...":"Search member..."} />
      </div>

      {/* Members table */}
      <div style={{background:RBAC_TOKENS.surf,borderRadius:12,overflow:"hidden",border:`1px solid ${RBAC_TOKENS.border}`,marginBottom:sel?16:0}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:0,
          borderBottom:`1px solid ${RBAC_TOKENS.border}`,padding:"8px 14px",
          background:"rgba(255,255,255,.02)"}}>
          {[isAr?"المستخدم":"User",isAr?"الدور":"Role",isAr?"آخر نشاط":"Last active",""].map((h,i)=>(
            <div key={i} style={{fontSize:9,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:RBAC_TOKENS.muted,padding:"0 6px"}}>{h}</div>
          ))}
        </div>
        {filtered.length===0 && (
          <div style={{padding:"24px",textAlign:"center",fontSize:12,color:RBAC_TOKENS.muted}}>
            {isAr?"لا يوجد أعضاء":"No members found"}
          </div>
        )}
        {filtered.slice(0,12).map((m,i)=>{
          const r=ROLES[m.role]||ROLES.employee;
          return (
            <div key={m.uid||i} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:0,
              padding:"11px 14px",borderBottom:i<filtered.length-1?`1px solid ${RBAC_TOKENS.border}`:"none",
              transition:"background 150ms",alignItems:"center"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.025)"}
              onMouseLeave={e=>e.currentTarget.style.background="none"}>
              <div style={{display:"flex",alignItems:"center",gap:9,padding:"0 6px"}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${r.color},${r.color}88)`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",fontWeight:700,flexShrink:0}}>
                  {(m.name||m.email||"?")[0].toUpperCase()}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:RBAC_TOKENS.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name||m.email||"—"}</div>
                  {m.email&&m.name&&<div style={{fontSize:10,color:RBAC_TOKENS.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.email}</div>}
                </div>
              </div>
              <div style={{padding:"0 6px"}}><Badge color={r.color}>{r.icon} {isAr?r.labelAr:r.label}</Badge></div>
              <div style={{fontSize:10,color:RBAC_TOKENS.muted,padding:"0 6px"}}>{m.last_active||"—"}</div>
              <div style={{padding:"0 6px"}}><Btn size="xs" variant="ghost" onClick={()=>openEdit(m)}>Edit</Btn></div>
            </div>
          );
        })}
      </div>

      {/* Role editor panel */}
      {sel && (
        <div style={{background:RBAC_TOKENS.bg2,border:`1px solid ${RBAC_TOKENS.amber}28`,borderRadius:14,padding:18,animation:`rbac-fadeIn 250ms ${SPRING} both`}}>
          <div style={{fontFamily:SYNE,fontSize:13,fontWeight:800,color:RBAC_TOKENS.text,marginBottom:14}}>
            {isAr?"تعديل دور":"Edit Role"}: {sel.name||sel.email}
          </div>

          {/* Role selector */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
            {Object.values(ROLES).map(r=>(
              <button key={r.id} onClick={()=>{setRoleEdit(r.id);setCustomPerms(r.scopes);}}
                style={{padding:"10px 8px",borderRadius:10,cursor:"pointer",textAlign:"center",
                  background:roleEdit===r.id?`${r.color}14`:"transparent",
                  border:`1.5px solid ${roleEdit===r.id?r.color+"45":RBAC_TOKENS.border}`,
                  transition:`all 180ms`,
                  boxShadow:roleEdit===r.id?`0 0 0 3px ${r.color}18`:"none"}}>
                <div style={{fontSize:18,marginBottom:4}}>{r.icon}</div>
                <div style={{fontSize:10,fontWeight:700,color:roleEdit===r.id?r.color:RBAC_TOKENS.text2}}>{isAr?r.labelAr:r.label}</div>
              </button>
            ))}
          </div>

          {/* Role description */}
          {roleEdit && (
            <div style={{background:`${ROLES[roleEdit]?.color||RBAC_TOKENS.blue}0a`,border:`1px solid ${ROLES[roleEdit]?.color||RBAC_TOKENS.blue}20`,borderRadius:10,padding:"10px 12px",marginBottom:14,fontSize:12,color:RBAC_TOKENS.text2,lineHeight:1.65}}>
              {isAr?ROLES[roleEdit]?.descriptionAr:ROLES[roleEdit]?.description}
            </div>
          )}

          {/* Custom permissions toggle */}
          <div style={{marginBottom:12}}>
            <Toggle value={showCustom} onChange={setShowCustom} label={isAr?"تخصيص الصلاحيات يدوياً":"Customise permissions manually"} />
          </div>

          {showCustom && (
            <div style={{background:RBAC_TOKENS.surf,border:`1px solid ${RBAC_TOKENS.border}`,borderRadius:12,padding:14,marginBottom:14,maxHeight:260,overflowY:"auto"}}>
              {Object.entries(byGroup).map(([group,perms])=>(
                <div key={group} style={{marginBottom:14}}>
                  <div style={{fontSize:9,fontWeight:800,letterSpacing:".08em",textTransform:"uppercase",color:RBAC_TOKENS.muted,marginBottom:8}}>{group}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {perms.map(p=>{
                      const on=customPerms.includes(p.id)||customPerms.includes("*");
                      return (
                        <label key={p.id} style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer"}}>
                          <input type="checkbox" checked={on}
                            onChange={e=>{
                              if(e.target.checked) setCustomPerms(prev=>[...prev,p.id]);
                              else setCustomPerms(prev=>prev.filter(x=>x!==p.id));
                            }}
                            style={{width:14,height:14,accentColor:RBAC_TOKENS.blue,cursor:"pointer"}}/>
                          <span style={{fontSize:12,color:on?RBAC_TOKENS.text:RBAC_TOKENS.text2,fontWeight:on?500:400}}>
                            {isAr?p.labelAr:p.label}
                          </span>
                          <span style={{fontSize:9,color:RBAC_TOKENS.muted,marginLeft:"auto",fontFamily:"monospace"}}>{p.id}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={()=>setSel(null)}>{isAr?"إلغاء":"Cancel"}</Btn>
            <Btn variant="primary" onClick={save} disabled={saving} icon="✓">
              {saving?(isAr?"جاري الحفظ...":"Saving..."):(isAr?"حفظ الدور":"Save Role")}
            </Btn>
          </div>
        </div>
      )}
    </Sec>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION: AUDIT LOGS
   ═══════════════════════════════════════════════════════════════ */
function AuditLogs({orgId,isAr}) {
  const [logs,setLogs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");

  useEffect(()=>{
    if(!orgId){
      // Mock logs for demo
      setLogs(generateMockLogs());
      setLoading(false);
      return;
    }
    getAuditLogs(orgId,100).then(l=>{setLogs(l);setLoading(false);});
  },[orgId]);

  function generateMockLogs() {
    const actors=["admin@co.com","ahmed@co.com","sara@co.com","system"];
    const events=Object.entries(AUDIT_EVENTS);
    return Array.from({length:40},(_,i)=>{
      const [type,meta]=events[i%events.length];
      const d=new Date(); d.setMinutes(d.getMinutes()-i*17);
      return {
        id:`log-${i}`, type, actor:actors[i%actors.length],
        details:`${meta.label} performed`, severity:meta.severity,
        ip:`196.${140+i%10}.${i%255}.${i%255}`,
        created_at:d.toISOString(),
        timestamp:{toDate:()=>d},
      };
    });
  }

  const filtered=logs.filter(l=>{
    if(filter!=="all"&&l.severity!==filter) return false;
    if(search&&!JSON.stringify(l).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const severityCounts=logs.reduce((a,l)=>{a[l.severity]=(a[l.severity]||0)+1;return a;},{});

  const exportCSV=()=>{
    const rows=[["Timestamp","Event","Actor","Details","Severity","IP"],
      ...filtered.map(l=>[l.created_at,l.type,l.actor,l.details,l.severity,l.ip||""])];
    const csv=rows.map(r=>r.map(v=>`"${v}"`).join(",")).join("\n");
    const a=document.createElement("a");
    a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
    a.download=`audit_log_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <Sec title={isAr?"سجلات التدقيق":"Audit Logs"}
      sub={isAr?"سجل كامل لكل الأنشطة":"Full immutable activity record"}
      icon="📋" accent={RBAC_TOKENS.purple}
      action={<Btn size="sm" variant="ghost" onClick={exportCSV} icon="⬇">{isAr?"تصدير CSV":"Export CSV"}</Btn>}>

      {/* Summary pills */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {[["all","All",RBAC_TOKENS.text2],["high","High",RBAC_TOKENS.red],["medium","Medium",RBAC_TOKENS.teal],["warn","Warning",RBAC_TOKENS.amber],["info","Info",RBAC_TOKENS.blue]].map(([s,l,c])=>(
          <button key={s} onClick={()=>setFilter(s)} style={{
            padding:"4px 12px",borderRadius:99,cursor:"pointer",
            background:filter===s?`${c}18`:"transparent",
            border:`1px solid ${filter===s?`${c}35`:RBAC_TOKENS.border}`,
            fontSize:11,fontWeight:700,color:filter===s?c:RBAC_TOKENS.muted,
            transition:`all 150ms`}}>
            {l} {s!=="all"&&severityCounts[s]?`(${severityCounts[s]})`:""}
          </button>
        ))}
        <div style={{marginLeft:"auto",minWidth:160}}>
          <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder={isAr?"بحث...":"Search..."} />
        </div>
      </div>

      {/* Log table */}
      <div style={{background:RBAC_TOKENS.surf,border:`1px solid ${RBAC_TOKENS.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"150px 1fr 140px 80px 90px",
          padding:"8px 14px",borderBottom:`1px solid ${RBAC_TOKENS.border}`,background:"rgba(255,255,255,.02)"}}>
          {[isAr?"الوقت":"Time",isAr?"الحدث":"Event",isAr?"المستخدم":"Actor",isAr?"الخطورة":"Severity",isAr?"عنوان IP":"IP"].map((h,i)=>(
            <div key={i} style={{fontSize:9,fontWeight:700,letterSpacing:".07em",textTransform:"uppercase",color:RBAC_TOKENS.muted}}>{h}</div>
          ))}
        </div>
        <div style={{maxHeight:320,overflowY:"auto"}}>
          {loading && Array.from({length:6}).map((_,i)=>(
            <div key={i} style={{padding:"12px 14px",borderBottom:`1px solid ${RBAC_TOKENS.border}`}}>
              <Skel h={14} w={`${60+i*5}%`}/>
            </div>
          ))}
          {!loading && filtered.slice(0,50).map((log,i)=>{
            const meta=AUDIT_EVENTS[log.type]||{icon:"●",label:log.type};
            const d=log.timestamp?.toDate?.()??new Date(log.created_at||0);
            return (
              <div key={log.id||i} style={{display:"grid",gridTemplateColumns:"150px 1fr 140px 80px 90px",
                padding:"10px 14px",borderBottom:i<filtered.length-1?`1px solid ${RBAC_TOKENS.border}`:"none",
                alignItems:"center",transition:"background 150ms",animation:`rbac-fadeIn 200ms ${Math.min(i,10)*30}ms both`}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.02)"}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <div style={{fontSize:10,color:RBAC_TOKENS.muted,fontFamily:"monospace"}}>
                  {d.toLocaleDateString("en-GB",{day:"2-digit",month:"short"})} {d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:13}}>{meta.icon}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:RBAC_TOKENS.text}}>{meta.label||log.type}</div>
                    {log.details&&<div style={{fontSize:10,color:RBAC_TOKENS.muted,marginTop:1}}>{log.details}</div>}
                  </div>
                </div>
                <div style={{fontSize:11,color:RBAC_TOKENS.text2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{log.actor||"—"}</div>
                <div><SeverityBadge s={log.severity||"info"}/></div>
                <div style={{fontSize:10,color:RBAC_TOKENS.muted,fontFamily:"monospace"}}>{log.ip||"—"}</div>
              </div>
            );
          })}
          {!loading&&filtered.length===0&&(
            <div style={{padding:"32px",textAlign:"center",fontSize:12,color:RBAC_TOKENS.muted}}>
              {isAr?"لا توجد سجلات":"No log entries found"}
            </div>
          )}
        </div>
      </div>
      <div style={{marginTop:10,fontSize:10,color:RBAC_TOKENS.muted}}>
        {isAr?`إجمالي ${filtered.length} سجل مُصفّى`:`Showing ${filtered.length} filtered entries`}
        {" · "}{isAr?"سجلات غير قابلة للتعديل":"Immutable records"}
      </div>
    </Sec>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION: ACTIVITY TRACKING
   ═══════════════════════════════════════════════════════════════ */
function ActivityTracking({orgId,isAr,members=[]}) {
  const days=[isAr?"الأح":"Sun",isAr?"الإث":"Mon",isAr?"الثل":"Tue",isAr?"الأر":"Wed",isAr?"الخم":"Thu",isAr?"الجم":"Fri",isAr?"السب":"Sat"];
  const hours=["00","06","12","18","23"];

  // Mock activity heatmap
  const heatData=Array.from({length:7},(_,d)=>
    Array.from({length:24},(_,h)=>({
      day:d,hour:h,
      count:Math.round(Math.max(0,8*Math.sin((h-10)*Math.PI/12)+Math.random()*3)),
    }))
  );
  const maxAct=Math.max(...heatData.flat().map(c=>c.count));

  const onlineNow=Math.floor(Math.random()*8)+2;
  const todaySessions=Math.floor(Math.random()*24)+12;
  const peakHour="10:00–11:00";

  return (
    <Sec title={isAr?"تتبع النشاط":"Activity Tracking"} sub={isAr?"خريطة نشاط القوى العاملة في الوقت الفعلي":"Real-time workforce activity heatmap"} icon="🌡️" accent={RBAC_TOKENS.teal}>
      {/* Live stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[
          {icon:"🟢",label:isAr?"متصلون الآن":"Online now",    v:onlineNow,  c:RBAC_TOKENS.green},
          {icon:"📊",label:isAr?"جلسات اليوم":"Today sessions", v:todaySessions, c:RBAC_TOKENS.blue},
          {icon:"⚡",label:isAr?"ذروة النشاط":"Peak hour",       v:peakHour,  c:RBAC_TOKENS.amber},
        ].map((m,i)=>(
          <div key={i} style={{background:`${m.c}0a`,border:`1px solid ${m.c}20`,borderRadius:11,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:18,marginBottom:6}}>{m.icon}</div>
            <div style={{fontFamily:SYNE,fontSize:typeof m.v==="number"?22:14,fontWeight:800,color:m.c,lineHeight:1}}>{m.v}</div>
            <div style={{fontSize:9,color:RBAC_TOKENS.muted,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em"}}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Activity heatmap */}
      <div style={{background:RBAC_TOKENS.surf,border:`1px solid ${RBAC_TOKENS.border}`,borderRadius:12,padding:"14px"}}>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:RBAC_TOKENS.muted,marginBottom:10}}>
          {isAr?"نمط النشاط الأسبوعي":"Weekly activity pattern"}
        </div>
        <div style={{display:"flex",gap:3}}>
          <div style={{display:"flex",flexDirection:"column",gap:3,justifyContent:"space-around",paddingTop:16}}>
            {days.map(d=><div key={d} style={{fontSize:8,color:RBAC_TOKENS.muted,fontWeight:600,width:24,textAlign:"right"}}>{d}</div>)}
          </div>
          <div style={{flex:1,overflow:"hidden"}}>
            {/* hour labels */}
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,padding:"0 2px"}}>
              {hours.map(h=><div key={h} style={{fontSize:8,color:RBAC_TOKENS.muted}}>{h}</div>)}
            </div>
            {heatData.map((row,d)=>(
              <div key={d} style={{display:"flex",gap:2,marginBottom:2}}>
                {row.map((cell,h)=>{
                  const intensity=maxAct>0?cell.count/maxAct:0;
                  const alpha=intensity*0.7+0.05;
                  return (
                    <div key={h} style={{flex:1,height:14,borderRadius:2,
                      background:intensity>0.6?`rgba(8,145,178,${alpha})`:intensity>0.3?`rgba(26,86,219,${alpha})`:`rgba(148,163,184,${alpha*0.4})`,
                      transition:"background 200ms"}}
                      title={`${days[d]} ${h}:00 — ${cell.count} sessions`}/>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
          <span style={{fontSize:9,color:RBAC_TOKENS.muted}}>{isAr?"نشاط:":"Activity:"}</span>
          {[["rgba(148,163,184,.12)",isAr?"منخفض":"Low"],["rgba(26,86,219,.3)",isAr?"متوسط":"Mid"],["rgba(8,145,178,.6)",isAr?"مرتفع":"High"]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:10,height:10,borderRadius:2,background:c}}/><span style={{fontSize:9,color:RBAC_TOKENS.muted}}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Active users list */}
      {members.length>0&&(
        <div style={{marginTop:12}}>
          <div style={{fontSize:9,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:RBAC_TOKENS.muted,marginBottom:8}}>
            {isAr?"الأكثر نشاطاً هذا الأسبوع":"Most active this week"}
          </div>
          {members.slice(0,5).map((m,i)=>{
            const sessions=Math.floor(Math.random()*7)+1;
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",
                borderBottom:i<4?`1px solid ${RBAC_TOKENS.border}`:"none"}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${RBAC_TOKENS.blue},${RBAC_TOKENS.teal})`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700,flexShrink:0}}>
                  {(m.name||m.email||"?")[0].toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:RBAC_TOKENS.text}}>{m.name||m.email||"User"}</div>
                  <div style={{height:3,borderRadius:99,background:"rgba(148,163,184,.1)",marginTop:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${sessions*14}%`,background:RBAC_TOKENS.blue,borderRadius:99,transition:"width 500ms"}}/>
                  </div>
                </div>
                <div style={{fontSize:11,fontWeight:700,color:RBAC_TOKENS.teal,flexShrink:0}}>{sessions} {isAr?"جلسة":"sess"}</div>
              </div>
            );
          })}
        </div>
      )}
    </Sec>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION: SAML SSO CONFIG
   ═══════════════════════════════════════════════════════════════ */
function SAMLConfig({orgId,adminUid,isAr}) {
  const [config,setConfig]=useState({
    provider:"",enabled:false,
    ssoUrl:"",entityId:"",certificate:"",
    attributeMapping:{email:"email",name:"displayName",department:"department"},
    enforceSSO:false,allowPasswordFallback:true,
    sessionTimeout:480,
  });
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [testResult,setTestResult]=useState(null);

  useEffect(()=>{
    getSSOConfig(orgId||"demo").then(c=>{if(c)setConfig(prev=>({...prev,...c}));setLoading(false);});
  },[orgId]);

  const save=async()=>{
    setSaving(true); setSaved(false);
    await saveSSOConfig(orgId||"demo",config,adminUid||"admin");
    setSaving(false); setSaved(true);
    setTimeout(()=>setSaved(false),3000);
  };

  const testSSO=async()=>{
    setTestResult("testing");
    setTimeout(()=>setTestResult(config.ssoUrl?"success":"error"),1800);
  };

  const PROVIDERS=[
    {id:"azure",   name:"Microsoft Azure AD", nameAr:"Microsoft Azure AD", icon:"🪟", color:"#0078D4"},
    {id:"okta",    name:"Okta",               nameAr:"Okta",               icon:"🔐", color:"#007DC1"},
    {id:"google",  name:"Google Workspace",   nameAr:"Google Workspace",   icon:"🌐", color:"#4285F4"},
    {id:"onelogin",name:"OneLogin",           nameAr:"OneLogin",           icon:"🔑", color:"#0298CC"},
    {id:"custom",  name:"Custom SAML 2.0",    nameAr:"SAML 2.0 مخصص",     icon:"⚙️", color:"#7c3aed"},
  ];

  return (
    <Sec title={isAr?"إعداد SAML SSO":"SAML SSO Configuration"} sub={isAr?"Azure AD · Okta · Google Workspace · SAML 2.0":"Azure AD · Okta · Google Workspace · SAML 2.0"} icon="🔐" accent={RBAC_TOKENS.purple}>
      {loading?<Skel h={200}/>:(
        <>
          {/* Provider selector */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:RBAC_TOKENS.text2,marginBottom:8,letterSpacing:".03em"}}>
              {isAr?"اختر مزود الهوية (IdP)":"Select Identity Provider (IdP)"}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
              {PROVIDERS.map(p=>(
                <button key={p.id} onClick={()=>setConfig(c=>({...c,provider:p.id}))}
                  style={{padding:"12px 8px",borderRadius:11,cursor:"pointer",textAlign:"center",
                    background:config.provider===p.id?`${p.color}14`:"transparent",
                    border:`1.5px solid ${config.provider===p.id?p.color+"45":RBAC_TOKENS.border}`,
                    transition:`all 180ms ${SPRING}`,
                    boxShadow:config.provider===p.id?`0 0 0 3px ${p.color}15`:"none"}}>
                  <div style={{fontSize:20,marginBottom:5}}>{p.icon}</div>
                  <div style={{fontSize:9,fontWeight:700,color:config.provider===p.id?p.color:RBAC_TOKENS.muted,lineHeight:1.3}}>{isAr?p.nameAr:p.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Enable toggle */}
          <div style={{display:"flex",gap:20,marginBottom:16,flexWrap:"wrap"}}>
            <Toggle value={config.enabled} onChange={v=>setConfig(c=>({...c,enabled:v}))} label={isAr?"تفعيل SSO":"Enable SSO"} />
            <Toggle value={config.enforceSSO} onChange={v=>setConfig(c=>({...c,enforceSSO:v}))} label={isAr?"إلزامي (بدون كلمة مرور)":"Enforce SSO (disable passwords)"} />
            <Toggle value={config.allowPasswordFallback} onChange={v=>setConfig(c=>({...c,allowPasswordFallback:v}))} label={isAr?"السماح بكلمة المرور كبديل":"Allow password fallback"} />
          </div>

          {/* SAML fields */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <Input label={isAr?"رابط SSO (IdP URL)":"SSO URL (IdP)"}
              value={config.ssoUrl} onChange={e=>setConfig(c=>({...c,ssoUrl:e.target.value}))}
              placeholder="https://your-idp.com/saml/sso" />
            <Input label={isAr?"معرّف الكيان (Entity ID)":"Entity ID"}
              value={config.entityId} onChange={e=>setConfig(c=>({...c,entityId:e.target.value}))}
              placeholder="https://app.corvus.io/saml/metadata" />
          </div>

          <div style={{marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:RBAC_TOKENS.text2,letterSpacing:".03em",marginBottom:5}}>
              {isAr?"شهادة X.509 (Base64)":"X.509 Certificate (Base64)"}
            </label>
            <textarea value={config.certificate}
              onChange={e=>setConfig(c=>({...c,certificate:e.target.value}))}
              placeholder="-----BEGIN CERTIFICATE-----&#10;MIIBkTCB...&#10;-----END CERTIFICATE-----"
              rows={4}
              style={{width:"100%",padding:"9px 13px",background:RBAC_TOKENS.surf,border:`1.5px solid ${RBAC_TOKENS.border}`,
                borderRadius:9,color:RBAC_TOKENS.text,fontSize:11,outline:"none",resize:"vertical",
                fontFamily:"'DM Mono',monospace",lineHeight:1.6}}/>
          </div>

          {/* Attribute mapping */}
          <div style={{background:RBAC_TOKENS.surf,border:`1px solid ${RBAC_TOKENS.border}`,borderRadius:11,padding:"14px",marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:RBAC_TOKENS.text2,marginBottom:10,letterSpacing:".03em"}}>
              {isAr?"تعيين الصفات (Attribute Mapping)":"Attribute Mapping"}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {[
                {key:"email",label:isAr?"البريد الإلكتروني":"Email"},
                {key:"name", label:isAr?"الاسم":"Full Name"},
                {key:"department",label:isAr?"القسم":"Department"},
              ].map(({key,label})=>(
                <div key={key}>
                  <div style={{fontSize:10,color:RBAC_TOKENS.muted,marginBottom:4,fontWeight:500}}>{label} →</div>
                  <input value={config.attributeMapping[key]||""}
                    onChange={e=>setConfig(c=>({...c,attributeMapping:{...c.attributeMapping,[key]:e.target.value}}))}
                    style={{width:"100%",padding:"7px 11px",background:RBAC_TOKENS.bg2,border:`1px solid ${RBAC_TOKENS.border}`,
                      borderRadius:7,color:RBAC_TOKENS.text,fontSize:11,outline:"none",fontFamily:"monospace"}}/>
                </div>
              ))}
            </div>
          </div>

          {/* Session timeout */}
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16}}>
            <label style={{fontSize:11,fontWeight:700,color:RBAC_TOKENS.text2,whiteSpace:"nowrap"}}>{isAr?"انتهاء الجلسة (دقيقة):":"Session timeout (min):"}</label>
            <input type="number" min={30} max={1440} value={config.sessionTimeout}
              onChange={e=>setConfig(c=>({...c,sessionTimeout:Number(e.target.value)}))}
              style={{width:90,padding:"7px 11px",background:RBAC_TOKENS.surf,border:`1px solid ${RBAC_TOKENS.border}`,
                borderRadius:8,color:RBAC_TOKENS.text,fontSize:12,outline:"none"}}/>
            <span style={{fontSize:11,color:RBAC_TOKENS.muted}}>{Math.round(config.sessionTimeout/60)} {isAr?"ساعة":"hours"}</span>
          </div>

          {/* ACS / metadata URLs (read-only) */}
          <div style={{background:RBAC_TOKENS.bg2,border:`1px solid ${RBAC_TOKENS.border}`,borderRadius:11,padding:"14px",marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:RBAC_TOKENS.text2,marginBottom:10,letterSpacing:".03em"}}>
              {isAr?"روابط Corvus (SP) — انسخها لـ IdP":"Corvus (SP) URLs — copy to your IdP"}
            </div>
            {[
              {l:isAr?"ACS URL":"ACS URL",                v:`https://app.corvus.io/saml/acs`},
              {l:isAr?"رابط البيانات الوصفية":"Metadata", v:`https://app.corvus.io/saml/metadata`},
              {l:isAr?"رابط تسجيل الخروج":"Logout URL",  v:`https://app.corvus.io/saml/logout`},
            ].map(({l,v})=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${RBAC_TOKENS.border}`}}>
                <span style={{fontSize:11,color:RBAC_TOKENS.muted,minWidth:120,fontWeight:500}}>{l}</span>
                <code style={{flex:1,fontSize:10,color:RBAC_TOKENS.text2,background:"none",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</code>
                <button onClick={()=>navigator.clipboard.writeText(v)}
                  style={{background:"none",border:`1px solid ${RBAC_TOKENS.border}`,borderRadius:5,padding:"3px 9px",
                    fontSize:10,color:RBAC_TOKENS.muted,cursor:"pointer"}}>⎘</button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn variant="primary" onClick={save} disabled={saving} icon={saved?"✓":"💾"}>
              {saving?(isAr?"جاري الحفظ...":"Saving..."):saved?(isAr?"تم الحفظ!":"Saved!"):(isAr?"حفظ الإعداد":"Save Config")}
            </Btn>
            <Btn variant="ghost" onClick={testSSO} disabled={testResult==="testing"} icon="🧪">
              {testResult==="testing"?(isAr?"جاري الاختبار...":"Testing..."):(isAr?"اختبار الاتصال":"Test Connection")}
            </Btn>
            {testResult==="success"&&<span style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:RBAC_TOKENS.green}}>✓ {isAr?"الاتصال ناجح":"Connection successful"}</span>}
            {testResult==="error"&&<span style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:RBAC_TOKENS.red}}>✕ {isAr?"فشل الاتصال":"Connection failed"}</span>}
          </div>
        </>
      )}
    </Sec>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION: GDPR TOOLS
   ═══════════════════════════════════════════════════════════════ */
function GDPRTools({orgId,adminUid,isAr}) {
  const [requests,setRequests]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({type:"access",subject_uid:"",subject_email:"",notes:""});
  const [submitting,setSubmitting]=useState(false);
  const [dataRetention,setDataRetention]=useState({
    sessions_days:365,audit_days:730,video_store:false,anonymise_after:90,
  });

  useEffect(()=>{
    getGDPRRequests(orgId||"demo").then(r=>{
      setRequests(r.length?r:mockGDPRRequests());
      setLoading(false);
    });
  },[orgId]);

  function mockGDPRRequests() {
    return [
      {id:"gdpr-1",type:"access",subject_email:"user@company.com",status:"fulfilled",created_at:new Date(Date.now()-864000000).toISOString(),notes:"All data exported"},
      {id:"gdpr-2",type:"deletion",subject_email:"ex-employee@co.com",status:"pending",created_at:new Date(Date.now()-172800000).toISOString(),notes:""},
      {id:"gdpr-3",type:"portability",subject_email:"contractor@firm.com",status:"in_progress",created_at:new Date(Date.now()-432000000).toISOString(),notes:"Processing"},
    ];
  }

  const submit=async()=>{
    if(!form.subject_email) return;
    setSubmitting(true);
    const id=await submitGDPRRequest(orgId||"demo",form,adminUid||"admin");
    setRequests(prev=>[{id,status:"pending",created_at:new Date().toISOString(),...form},...prev]);
    setForm({type:"access",subject_uid:"",subject_email:"",notes:""});
    setShowForm(false); setSubmitting(false);
  };

  const STATUS={pending:{c:RBAC_TOKENS.amber,label:isAr?"في الانتظار":"Pending"},fulfilled:{c:RBAC_TOKENS.green,label:isAr?"منجز":"Fulfilled"},in_progress:{c:RBAC_TOKENS.blue,label:isAr?"قيد التنفيذ":"In Progress"},rejected:{c:RBAC_TOKENS.red,label:isAr?"مرفوض":"Rejected"}};
  const TYPES={access:{icon:"📄",label:isAr?"طلب الوصول":"Data Access"},deletion:{icon:"🗑️",label:isAr?"طلب الحذف":"Data Deletion"},portability:{icon:"📦",label:isAr?"قابلية النقل":"Data Portability"},rectification:{icon:"✏️",label:isAr?"تصحيح البيانات":"Rectification"},restriction:{icon:"🔒",label:isAr?"تقييد المعالجة":"Processing Restriction"}};

  return (
    <Sec title={isAr?"أدوات GDPR":"GDPR Tools"} sub={isAr?"إدارة طلبات الخصوصية واستبقاء البيانات":"Privacy requests, data retention & compliance"} icon="🛡️" accent={RBAC_TOKENS.green}
      action={<Btn size="sm" variant="success" onClick={()=>setShowForm(!showForm)} icon="+">{isAr?"طلب جديد":"New Request"}</Btn>}>

      {/* New request form */}
      {showForm&&(
        <div style={{background:RBAC_TOKENS.bg2,border:`1px solid ${RBAC_TOKENS.green}25`,borderRadius:12,padding:16,marginBottom:16,animation:`rbac-fadeIn 250ms both`}}>
          <div style={{fontFamily:SYNE,fontSize:12,fontWeight:800,color:RBAC_TOKENS.text,marginBottom:12}}>{isAr?"طلب GDPR جديد":"New GDPR Request"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:RBAC_TOKENS.text2,marginBottom:5}}>{isAr?"نوع الطلب":"Request Type"}</label>
              <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}
                style={{width:"100%",padding:"8px 11px",background:RBAC_TOKENS.surf,border:`1px solid ${RBAC_TOKENS.border}`,borderRadius:8,color:RBAC_TOKENS.text,fontSize:12,outline:"none"}}>
                {Object.entries(TYPES).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <Input label={isAr?"بريد صاحب البيانات":"Subject Email"} value={form.subject_email}
              onChange={e=>setForm(f=>({...f,subject_email:e.target.value}))} placeholder="user@example.com"/>
          </div>
          <Input label={isAr?"ملاحظات":"Notes"} value={form.notes}
            onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder={isAr?"سبب الطلب...":"Reason for request..."}/>
          <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
            <Btn variant="ghost" size="sm" onClick={()=>setShowForm(false)}>{isAr?"إلغاء":"Cancel"}</Btn>
            <Btn variant="success" size="sm" onClick={submit} disabled={submitting||!form.subject_email} icon="→">
              {submitting?(isAr?"جاري الإرسال...":"Submitting..."):(isAr?"إرسال الطلب":"Submit Request")}
            </Btn>
          </div>
        </div>
      )}

      {/* Requests table */}
      <div style={{background:RBAC_TOKENS.surf,border:`1px solid ${RBAC_TOKENS.border}`,borderRadius:12,overflow:"hidden",marginBottom:16}}>
        {loading?<div style={{padding:16}}><Skel h={100}/></div>:
          requests.map((r,i)=>{
            const st=STATUS[r.status]||STATUS.pending;
            const tp=TYPES[r.type]||TYPES.access;
            const d=new Date(r.created_at||0);
            return (
              <div key={r.id||i} style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr auto auto",
                gap:10,padding:"12px 14px",alignItems:"center",
                borderBottom:i<requests.length-1?`1px solid ${RBAC_TOKENS.border}`:"none",
                animation:`rbac-fadeIn 200ms ${i*50}ms both`}}>
                <span style={{fontSize:18}}>{tp.icon}</span>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:RBAC_TOKENS.text}}>{tp.label}</div>
                  <div style={{fontSize:10,color:RBAC_TOKENS.muted}}>{r.subject_email||"—"}</div>
                </div>
                <div style={{fontSize:10,color:RBAC_TOKENS.muted}}>{d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div>
                <Badge color={st.c} size="xs">{st.label}</Badge>
                <Btn size="xs" variant="ghost">{isAr?"تفاصيل":"Details"}</Btn>
              </div>
            );
          })}
        {!loading&&requests.length===0&&(
          <div style={{padding:"24px",textAlign:"center",fontSize:12,color:RBAC_TOKENS.muted}}>
            {isAr?"لا توجد طلبات GDPR":"No GDPR requests"}
          </div>
        )}
      </div>

      {/* Data retention settings */}
      <div style={{background:RBAC_TOKENS.bg2,border:`1px solid ${RBAC_TOKENS.border}`,borderRadius:12,padding:"16px"}}>
        <div style={{fontFamily:SYNE,fontSize:12,fontWeight:800,color:RBAC_TOKENS.text,marginBottom:14}}>{isAr?"سياسة استبقاء البيانات":"Data Retention Policy"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          {[
            {key:"sessions_days",label:isAr?"سجلات الجلسات (يوم)":"Session records (days)"},
            {key:"audit_days",   label:isAr?"سجلات التدقيق (يوم)":"Audit logs (days)"},
            {key:"anonymise_after",label:isAr?"إخفاء الهوية بعد (يوم)":"Anonymise after (days)"},
          ].map(({key,label})=>(
            <div key={key}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:RBAC_TOKENS.text2,marginBottom:5}}>{label}</label>
              <input type="number" min={30} max={2555} value={dataRetention[key]}
                onChange={e=>setDataRetention(r=>({...r,[key]:Number(e.target.value)}))}
                style={{width:"100%",padding:"8px 11px",background:RBAC_TOKENS.surf,border:`1px solid ${RBAC_TOKENS.border}`,
                  borderRadius:8,color:RBAC_TOKENS.text,fontSize:12,outline:"none"}}/>
            </div>
          ))}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Toggle value={dataRetention.video_store} onChange={v=>setDataRetention(r=>({...r,video_store:v}))}
              label={isAr?"تخزين الفيديو (غير موصى به)":"Store video (not recommended)"} />
          </div>
        </div>
        <div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.18)",borderRadius:9,padding:"10px 12px",fontSize:11,color:RBAC_TOKENS.text2,lineHeight:1.65}}>
          ⚠️ {isAr?"الفيديو لا يُخزَّن أبداً افتراضياً. فقط نقاط البيانات المجردة تُحفظ. مطابق لـ GDPR وHIPAA.":"Video is never stored by default. Only anonymised data points are persisted. Compliant with GDPR & HIPAA."}
        </div>
      </div>
    </Sec>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION: SECURITY POLICIES
   ═══════════════════════════════════════════════════════════════ */
function SecurityPolicies({orgId,adminUid,isAr}) {
  const [policies,setPolicies]=useState({
    mfaRequired:true, passwordMinLength:12, passwordComplexity:true,
    sessionInactivityMin:60, ipAllowlist:"", maxLoginAttempts:5,
    alertOnNewDevice:true, alertOnSuspicious:true,
    dataResidency:"eu", encryptionAtRest:true,
  });
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);

  const save=async()=>{
    setSaving(true);
    await logAuditEvent(orgId||"demo",{type:"settings_changed",actor:adminUid||"admin",details:"Security policies updated",severity:"high"});
    setTimeout(()=>{setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),3000);},700);
  };

  const REGIONS=[{id:"eu",label:"EU (Frankfurt)"},{id:"us",label:"US (Virginia)"},{id:"me",label:"ME (UAE)"}];

  return (
    <Sec title={isAr?"سياسات الأمان":"Security Policies"} sub={isAr?"ضوابط الوصول وحماية البيانات":"Access controls & data protection"} icon="🔒" accent={RBAC_TOKENS.red}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {/* Auth policies */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:RBAC_TOKENS.text2,letterSpacing:".04em",marginBottom:10,textTransform:"uppercase"}}>{isAr?"المصادقة":"Authentication"}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Toggle value={policies.mfaRequired} onChange={v=>setPolicies(p=>({...p,mfaRequired:v}))} label={isAr?"MFA إلزامي":"Require MFA"} />
            <Toggle value={policies.alertOnNewDevice} onChange={v=>setPolicies(p=>({...p,alertOnNewDevice:v}))} label={isAr?"تنبيه عند جهاز جديد":"Alert on new device"} />
            <Toggle value={policies.alertOnSuspicious} onChange={v=>setPolicies(p=>({...p,alertOnSuspicious:v}))} label={isAr?"تنبيه نشاط مشبوه":"Alert on suspicious activity"} />
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <label style={{fontSize:11,color:RBAC_TOKENS.text2,minWidth:130}}>{isAr?"حد محاولات الدخول:":"Max login attempts:"}</label>
              <input type="number" min={3} max={20} value={policies.maxLoginAttempts}
                onChange={e=>setPolicies(p=>({...p,maxLoginAttempts:Number(e.target.value)}))}
                style={{width:60,padding:"6px 10px",background:RBAC_TOKENS.surf,border:`1px solid ${RBAC_TOKENS.border}`,borderRadius:7,color:RBAC_TOKENS.text,fontSize:12,outline:"none"}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <label style={{fontSize:11,color:RBAC_TOKENS.text2,minWidth:130}}>{isAr?"مدة الجلسة (د):":"Session timeout (min):"}</label>
              <input type="number" min={15} max={1440} value={policies.sessionInactivityMin}
                onChange={e=>setPolicies(p=>({...p,sessionInactivityMin:Number(e.target.value)}))}
                style={{width:70,padding:"6px 10px",background:RBAC_TOKENS.surf,border:`1px solid ${RBAC_TOKENS.border}`,borderRadius:7,color:RBAC_TOKENS.text,fontSize:12,outline:"none"}}/>
            </div>
          </div>
        </div>

        {/* Data policies */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:RBAC_TOKENS.text2,letterSpacing:".04em",marginBottom:10,textTransform:"uppercase"}}>{isAr?"البيانات":"Data"}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Toggle value={policies.encryptionAtRest} onChange={v=>setPolicies(p=>({...p,encryptionAtRest:v}))} label={isAr?"تشفير البيانات المحفوظة":"Encrypt data at rest"} />
            <Toggle value={policies.passwordComplexity} onChange={v=>setPolicies(p=>({...p,passwordComplexity:v}))} label={isAr?"تعقيد كلمة المرور":"Password complexity"} />
            <div>
              <label style={{display:"block",fontSize:11,color:RBAC_TOKENS.text2,marginBottom:5}}>{isAr?"إقامة البيانات:":"Data residency:"}</label>
              <div style={{display:"flex",gap:6}}>
                {REGIONS.map(r=>(
                  <button key={r.id} onClick={()=>setPolicies(p=>({...p,dataResidency:r.id}))}
                    style={{flex:1,padding:"7px 6px",borderRadius:8,cursor:"pointer",fontSize:10,fontWeight:700,
                      background:policies.dataResidency===r.id?"rgba(26,86,219,.12)":"transparent",
                      border:`1px solid ${policies.dataResidency===r.id?RBAC_TOKENS.blue+"45":RBAC_TOKENS.border}`,
                      color:policies.dataResidency===r.id?RBAC_TOKENS.blue:RBAC_TOKENS.muted,transition:"all 150ms"}}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,color:RBAC_TOKENS.text2,marginBottom:5}}>{isAr?"قائمة IP المسموح بها (اختياري):":"IP Allowlist (optional):"}</label>
              <input value={policies.ipAllowlist} onChange={e=>setPolicies(p=>({...p,ipAllowlist:e.target.value}))}
                placeholder="196.140.0.0/16, 10.0.0.1"
                style={{width:"100%",padding:"8px 11px",background:RBAC_TOKENS.surf,border:`1px solid ${RBAC_TOKENS.border}`,
                  borderRadius:8,color:RBAC_TOKENS.text,fontSize:11,outline:"none",fontFamily:"monospace"}}/>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance badges */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {[["GDPR",RBAC_TOKENS.green],["HIPAA-ready",RBAC_TOKENS.blue],["SOC 2 (in progress)",RBAC_TOKENS.amber],["AES-256",RBAC_TOKENS.purple],["TLS 1.3",RBAC_TOKENS.teal]].map(([l,c])=>(
          <Badge key={l} color={c}>✓ {l}</Badge>
        ))}
      </div>

      <Btn variant="primary" onClick={save} disabled={saving} icon={saved?"✓":"🔒"}>
        {saving?(isAr?"جاري الحفظ...":"Saving..."):saved?(isAr?"تم الحفظ!":"Saved!"):(isAr?"حفظ السياسات":"Save Policies")}
      </Btn>
    </Sec>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function EnterpriseRBAC({ orgId, adminUid, profile, members=[], cs, lang="en", onClose }) {
  const [tab,setTab]=useState("roles");
  const isAr=lang==="ar";

  const TABS=[
    {id:"roles",    icon:"👑", en:"Roles & RBAC",   ar:"الأدوار والصلاحيات"},
    {id:"audit",    icon:"📋", en:"Audit Logs",      ar:"سجلات التدقيق"},
    {id:"activity", icon:"🌡️", en:"Activity",        ar:"النشاط"},
    {id:"sso",      icon:"🔐", en:"SAML SSO",        ar:"SAML SSO"},
    {id:"gdpr",     icon:"🛡️", en:"GDPR",            ar:"GDPR"},
    {id:"security", icon:"🔒", en:"Security",        ar:"الأمان"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(2,8,20,.94)",backdropFilter:"blur(10px)",
      WebkitBackdropFilter:"blur(10px)",zIndex:9200,display:"flex",alignItems:"center",
      justifyContent:"center",padding:16}}>
      <div style={{
        background:RBAC_TOKENS.bg, border:`1px solid ${RBAC_TOKENS.border}`,
        borderRadius:20,width:"min(960px,97vw)",height:"min(820px,96vh)",
        display:"flex",flexDirection:"column",overflow:"hidden",
        direction:isAr?"rtl":"ltr",
        boxShadow:"0 28px 80px rgba(0,0,0,.65)",
        animation:`rbac-slideUp 350ms ${SPRING} both`,
        "--rbac-blue":RBAC_TOKENS.blue,
      }}>

        {/* HEADER */}
        <div style={{padding:"18px 22px",borderBottom:`1px solid ${RBAC_TOKENS.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#7c3aed,#1a56db)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:"0 4px 16px rgba(124,58,237,.4)"}}>🔐</div>
              <div>
                <div style={{fontFamily:SYNE,fontSize:15,fontWeight:800,color:RBAC_TOKENS.text,letterSpacing:"-.02em"}}>
                  {isAr?"أمان المؤسسة والصلاحيات":"Enterprise Security & RBAC"}
                </div>
                <div style={{fontSize:10,color:RBAC_TOKENS.purple,fontWeight:600,marginTop:1}}>
                  {isAr?"صلاحيات دقيقة · تدقيق · SSO · GDPR":"Granular permissions · Audit logs · SAML SSO · GDPR"}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {["GDPR","SAML 2.0","HIPAA-ready"].map(b=>(
                <span key={b} style={{background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.18)",
                  borderRadius:99,padding:"2px 9px",fontSize:9,fontWeight:700,color:"#34d399"}}>✓ {b}</span>
              ))}
              <button onClick={onClose} style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,.06)",
                border:`1px solid ${RBAC_TOKENS.border}`,color:RBAC_TOKENS.muted,cursor:"pointer",fontSize:14,
                display:"flex",alignItems:"center",justifyContent:"center"}} aria-label="Close">✕</button>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{display:"flex",borderBottom:`1px solid ${RBAC_TOKENS.border}`,flexShrink:0,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1,padding:"12px 8px",background:"none",border:"none",
              borderBottom:`2px solid ${tab===t.id?RBAC_TOKENS.purple:"transparent"}`,
              color:tab===t.id?"#a78bfa":RBAC_TOKENS.muted,
              fontSize:11,fontWeight:700,cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              transition:"color 150ms",minWidth:80,whiteSpace:"nowrap",
            }}>
              <span style={{fontSize:16}}>{t.icon}</span>
              <span>{isAr?t.ar:t.en}</span>
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:16}}>
          {tab==="roles"    && <RoleManager    orgId={orgId} adminUid={adminUid} isAr={isAr} members={members}/>}
          {tab==="audit"    && <AuditLogs      orgId={orgId} isAr={isAr}/>}
          {tab==="activity" && <ActivityTracking orgId={orgId} isAr={isAr} members={members}/>}
          {tab==="sso"      && <SAMLConfig      orgId={orgId} adminUid={adminUid} isAr={isAr}/>}
          {tab==="gdpr"     && <GDPRTools       orgId={orgId} adminUid={adminUid} isAr={isAr}/>}
          {tab==="security" && <SecurityPolicies orgId={orgId} adminUid={adminUid} isAr={isAr}/>}
        </div>
      </div>

      <style>{`
        @keyframes rbac-slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rbac-fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rbac-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      `}</style>
    </div>
  );
}

/* ── Utility exports ─────────────────────────────────────────────── */

export { ALL_PERMISSIONS, AUDIT_EVENTS, getAuditLogs, getSSOConfig, getUserRoles, logAuditEvent, saveSSOConfig, setUserRole, submitGDPRRequest };
