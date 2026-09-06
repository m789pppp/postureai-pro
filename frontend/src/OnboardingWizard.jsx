/**
 * Corvus — Onboarding Wizard v1.0
 * Phase 11: Onboarding Experience
 * Setup wizard · Guided onboarding · Demo workspace
 * Sample analytics · Interactive walkthroughs
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";
import { Icon } from "./LiveUI.jsx";

/* ── Design tokens ───────────────────────────────────────────────── */
const SPRING = "cubic-bezier(0.16,1,0.3,1)";
const SYNE   = "'Syne',sans-serif";

const sc = v => v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";

/* ── Demo data (sample analytics) ───────────────────────────────── */
const DEMO_SESSIONS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - 13 + i);
  const base = 55 + i * 2.5 + Math.sin(i) * 8;
  return {
    id: `demo-${i}`,
    avg_score: Math.round(Math.min(95, Math.max(45, base))),
    created_at: { toDate: () => d },
    duration_min: Math.round(20 + Math.random() * 40),
  };
});

const DEMO_PROFILE = {
  name: "", tier: "professional", streak_days: 4,
  avg_score: 72, company: "", department: "",
};

/* ── Primitive components ────────────────────────────────────────── */
// Names Btn should draw as line icons rather than print as text.
const ICON_NAMES = new Set(["forward","back","play","checkCircle","target","user",
  "building","sparkle","clock","camera","trophy","chevronDown","refresh","plug","shield"]);

function Btn({ children, onClick, variant = "primary", size = "base", disabled, icon, loading, fullWidth, style: sx = {} }) {
  const [hov, setHov] = useState(false);
  const pad = { xs: "5px 12px", sm: "8px 16px", base: "11px 22px", lg: "14px 30px" };
  const fs  = { xs: 10, sm: 11, base: 13, lg: 14 };
  const v = {
    primary:   { bg: "linear-gradient(135deg,#1a56db,#0891b2)", c: "#fff", border: "none", sh: hov ? "0 10px 32px rgba(26,86,219,.5)" : "0 6px 20px rgba(26,86,219,.35)" },
    secondary: { bg: "rgba(255,255,255,.06)", c: "#e8f0fe", border: "1px solid rgba(255,255,255,.12)" },
    ghost:     { bg: "transparent", c: "#94a3b8", border: "1px solid rgba(148,163,184,.15)" },
    success:   { bg: "rgba(16,185,129,.14)", c: "#34d399", border: "1px solid rgba(16,185,129,.25)" },
    danger:    { bg: "rgba(239,68,68,.1)", c: "#f87171", border: "1px solid rgba(239,68,68,.2)" },
  }[variant] || {};
  return (
    <button onClick={disabled || loading ? undefined : onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      disabled={disabled || loading}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: 7, padding: pad[size], fontSize: fs[size], fontWeight: 700,
        borderRadius: 10, cursor: disabled || loading ? "not-allowed" : "pointer",
        // A disabled primary kept its full-saturation gradient AND its glow at
        // 45% opacity, which reads as an enabled button that is broken rather
        // than one that is waiting for you. Desaturate it too.
        opacity: disabled ? .5 : 1,
        filter: disabled ? "grayscale(.7)" : "none",
        fontFamily: "'DM Sans',system-ui,sans-serif",
        whiteSpace: "nowrap", width: fullWidth ? "100%" : undefined,
        transition: `all 220ms ${SPRING}`,
        transform: hov && !disabled && !loading ? "translateY(-1px)" : "none",
        background: v.bg, color: v.c, border: v.border, boxShadow: v.sh || "none",
        ...sx,
      }}>
      {/* `icon` used to be a raw string rendered as text, which is how
          "→ Let's get started →" ended up with an arrow on both sides. It now
          takes an Icon name; anything else still renders as text so existing
          call sites are unaffected. */}
      {loading
        ? <span style={{ animation: "ob-spin 750ms linear infinite", display: "inline-block" }}>⟳</span>
        : icon && (ICON_NAMES.has(icon)
            ? <Icon name={icon} size={size === "lg" ? 15 : 13} color="currentColor" />
            : <span style={{ fontSize: "1.1em" }}>{icon}</span>)}
      {children}
    </button>
  );
}

function ProgressBar({ value, max = 100, color = "#1a56db", h = 5 }) {
  return (
    <div style={{ height: h, borderRadius: 99, background: "rgba(148,163,184,.1)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.round((value / max) * 100)}%`, background: color, borderRadius: 99, transition: `width 500ms ${SPRING}` }} />
    </div>
  );
}

function Ring({ score, size = 70, sw = 7 }) {
  const r = (size / 2) - sw, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  const dash = (pct / 100) * c, col = sc(pct);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,163,184,.1)" strokeWidth={sw} />
        {/* A round line cap on a zero-length dash still paints a dot — see
            the same fix in HomePage's Ring and ui/index.jsx's. */}
        {pct > 0 && (
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={sw}
            strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 700ms cubic-bezier(.4,0,.2,1)" }} />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: SYNE, fontSize: size > 60 ? 18 : 14, fontWeight: 800, color: col, lineHeight: 1 }}>{score}</span>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", hint }) {
  const [foc, setFoc] = useState(false);
  return (
    <div style={{ width: "100%" }}>
      {label && <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: ".03em", marginBottom: 5 }}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
        style={{ width: "100%", padding: "10px 13px", background: "rgba(255,255,255,.05)", border: `1.5px solid ${foc ? "#1a56db" : "rgba(148,163,184,.12)"}`, borderRadius: 9, color: "#e8f0fe", fontSize: 13, outline: "none", fontFamily: "'DM Sans',system-ui,sans-serif", boxShadow: foc ? "0 0 0 3px rgba(26,86,219,.14)" : "none", transition: "border-color 150ms, box-shadow 150ms" }} />
      {hint && <div style={{ fontSize: 10, color: "#8b9bb4", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STEP COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/* ── Step 0: Account Type Picker ────────────────────────────────── */
function StepAccountType({ isAr, onNext, setProfile }) {
  const [chosen, setChosen] = useState(null);
  const types = [
    {
      id:"individual", ico:"user",
      en:"Individual", ar:"مستخدم فردي",
      desc:"Personal posture tracking, AI coaching, and wellness reports — just for you.",
      descAr:"تتبع وضعيتك الشخصية، AI Coach، وتقارير صحية شخصية.",
      color:"#3b82f6",
      features:["Personal dashboard","AI Coach","PDF reports","Progress tracking"],
      featuresAr:["داشبورد شخصي","AI Coach","تقارير PDF","تتبع التقدم"],
    },
    {
      id:"company", ico:"building",
      en:"Company / Team", ar:"شركة / فريق",
      desc:"Monitor your entire team, HR analytics, at-risk alerts, and org-level reports.",
      descAr:"راقب الفريق كاملاً، HR analytics، تنبيهات الخطر، وتقارير المؤسسة.",
      color:"#10b981",
      features:["Team overview dashboard","HR Panel + Analytics","At-risk alerts","Team PDF reports"],
      featuresAr:["داشبورد الفريق","HR Panel + Analytics","تنبيهات الخطر","تقارير PDF للفريق"],
    },
  ];
  return (
    <div style={{padding:"8px 0"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{width:52,height:52,borderRadius:15,margin:"0 auto 14px",
          background:"rgba(26,86,219,.14)",border:"1px solid rgba(26,86,219,.28)",
          display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon name="target" size={25} color="#60a5fa"/>
        </div>
        <h2 style={{fontFamily:SYNE,fontSize:22,fontWeight:800,letterSpacing:"-.02em",marginBottom:8,color:"#e8f0fe"}}>
          {isAr?"كيف ستستخدم Corvus؟":"How will you use Corvus?"}
        </h2>
        <p style={{fontSize:13,color:"#64748b",lineHeight:1.6}}>
          {isAr?"اختر نوع حسابك — التجربة مختلفة تماماً لكل نوع":"Choose your account type — each gets a fully different experience"}
        </p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
        {types.map(t=>(
          <button key={t.id} onClick={()=>setChosen(t.id)} style={{
            width:"100%",textAlign:isAr?"right":"left",padding:"15px 17px",borderRadius:14,cursor:"pointer",
            background:chosen===t.id?`linear-gradient(135deg,${t.color}18,${t.color}08)`:"rgba(255,255,255,.02)",
            border:`2px solid ${chosen===t.id?t.color:"rgba(148,163,184,.1)"}`,
            transition:`all 200ms ${SPRING}`,
            boxShadow:chosen===t.id?`0 0 0 4px ${t.color}18`:"none",
          }}>
            <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
              <div style={{width:48,height:48,borderRadius:12,flexShrink:0,
                background:chosen===t.id?`${t.color}22`:"rgba(255,255,255,.06)",
                border:`1.5px solid ${chosen===t.id?t.color+"44":"rgba(148,163,184,.1)"}`,
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Icon name={t.ico} size={22} color={chosen===t.id?t.color:"#8b9bb4"}/>
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontFamily:SYNE,fontSize:16,fontWeight:800,color:chosen===t.id?t.color:"#e8f0fe"}}>
                    {isAr?t.ar:t.en}
                  </span>
                  {chosen===t.id&&(
                    <span style={{fontSize:10,fontWeight:700,color:t.color,
                      background:`${t.color}18`,border:`1px solid ${t.color}44`,
                      borderRadius:99,padding:"2px 8px"}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                        <Icon name="checkCircle" size={10} color={t.color}/>{isAr?"تم الاختيار":"Selected"}
                      </span>
                    </span>
                  )}
                </div>
                <div style={{fontSize:12,color:"#64748b",lineHeight:1.6,marginBottom:10}}>
                  {isAr?t.descAr:t.desc}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {(isAr?t.featuresAr:t.features).map((f,i)=>(
                    <span key={i} style={{fontSize:10,fontWeight:600,padding:"3px 9px",borderRadius:99,
                      background:chosen===t.id?`${t.color}15`:"rgba(255,255,255,.04)",
                      color:chosen===t.id?t.color:"#8b9bb4",
                      border:`1px solid ${chosen===t.id?t.color+"30":"rgba(148,163,184,.08)"}`}}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <Btn fullWidth size="lg" disabled={!chosen}
        onClick={()=>{
          setProfile(p=>({...p,
            acct_type:chosen,
            user_type:chosen==="company"?"hr_admin":"individual",
            is_org_owner:chosen==="company",
          }));
          onNext();
        }}>
        {isAr?"التالي":"Continue"}
      </Btn>
      {!chosen&&(
        <div style={{textAlign:"center",fontSize:11.5,color:"#8b9bb4",marginTop:10}}>
          {isAr?"اختر نوع الحساب للمتابعة":"Select an account type to continue"}
        </div>
      )}
    </div>
  );
}

/* ── Step 1: Welcome splash ───────────────────────────────────────── */
function StepWelcome({ isAr, onNext, name, acctType }) {
  const [show, setShow] = useState(false);
  useEffect(()=>{setTimeout(()=>setShow(true),80);},[]);
  const firstName = name?.split(" ")[0]||(isAr?"صديقي":"there");
  const isCompany = acctType==="company";
  return (
    <div style={{textAlign:"center",padding:"32px 24px 24px"}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:24}}>
        <div style={{
          width:88,height:88,borderRadius:24,
          background:isCompany?"linear-gradient(135deg,#059669,#0891b2)":"linear-gradient(135deg,#1a56db,#0891b2)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:42,boxShadow:isCompany?"0 12px 40px rgba(5,150,105,.45)":"0 12px 40px rgba(26,86,219,.45)",
          animation:show?"ob-bounceIn 600ms cubic-bezier(.16,1,.3,1) both":"none",
        }}>{isCompany?<Icon name="building" size={40} color="#fff"/>:"◈"}</div>
      </div>
      <div style={{opacity:show?1:0,transform:show?"none":"translateY(16px)",transition:`all 500ms 150ms ${SPRING}`}}>
        <div style={{fontSize:10,fontWeight:800,letterSpacing:".16em",textTransform:"uppercase",
          color:isCompany?"#34d399":"#60a5fa",marginBottom:12}}>
          {isCompany?(isAr?"منصة HR للقوى العاملة":"HR WORKFORCE PLATFORM"):(isAr?"منصة ذكاء الوضعية بالـ AI":"AI POSTURE INTELLIGENCE")}
        </div>
        <h1 style={{fontFamily:SYNE,fontSize:"clamp(24px,5vw,38px)",fontWeight:800,letterSpacing:"-.035em",lineHeight:1.1,marginBottom:16}}>
          {isAr?`أهلاً ${firstName}!`:`Welcome, ${firstName}!`}
        </h1>
        <p style={{fontSize:14,color:"#94a3b8",lineHeight:1.75,maxWidth:460,margin:"0 auto 28px"}}>
          {isCompany
            ?(isAr?"سنعدّ لك لوحة HR كاملة لمراقبة صحة فريقك وتحليل البيانات وإرسال التنبيهات.":"We'll set up your HR dashboard to monitor team health, analyze data, and send smart alerts.")
            :(isAr?"سنعدّ لك تجربة تتبع شخصية مخصصة بالـ AI لتحسين وضعيتك وصحتك.":"We'll set up your personal AI-powered posture tracking experience.")}
        </p>
      </div>
      <div style={{opacity:show?1:0,transition:"opacity 500ms 300ms",display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:32}}>
        {(isCompany
          /* The chips carried an emoji each — 🧠 📈 🤖 📋 🏆, and ☑️ which
              renders as a bare white box on several platforms. Same five
              claims, one icon language. */
          ?(isAr?[["users","نظرة عامة للفريق"],["barChart","HR Analytics"],["bell","تنبيهات الخطر"],["fileText","تقارير المؤسسة"],["lock","أمان مؤسسي"]]
                :[["users","Team overview"],["barChart","HR Analytics"],["bell","At-risk alerts"],["fileText","Org reports"],["lock","Enterprise security"]])
          :(isAr?[["eye","ذكاء AI فوري"],["trend","تحليلات شخصية"],["sparkle","AI Coach"],["fileText","تقارير PDF"],["trophy","تتبع التقدم"]]
                :[["eye","Real-time AI"],["trend","Personal analytics"],["sparkle","AI Coach"],["fileText","PDF reports"],["trophy","Progress tracking"]])
        ).map(([ico,f],i)=>(
          <span key={i} style={{
            background:isCompany?"rgba(5,150,105,.1)":"rgba(26,86,219,.1)",
            border:`1px solid ${isCompany?"rgba(5,150,105,.22)":"rgba(26,86,219,.22)"}`,
            borderRadius:99,padding:"6px 14px",fontSize:12,fontWeight:600,
            color:isCompany?"#34d399":"#60a5fa",
            animation:show?`ob-fadeIn 300ms ${400+i*60}ms both`:"none",
            display:"inline-flex",alignItems:"center",gap:6,
          }}><Icon name={ico} size={14} color="currentColor"/>{f}</span>
        ))}
      </div>
      <div style={{opacity:show?1:0,transition:"opacity 500ms 500ms"}}>
        {/* Was icon="→" AND a "→" in the label, so the button read
             "→ Let's get started →". */}
        <Btn size="lg" onClick={onNext} fullWidth>
          {isAr?"هيا نبدأ":"Let's get started"}
        </Btn>
        <div style={{fontSize:11.5,color:"#8b9bb4",marginTop:12,
          display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <Icon name="clock" size={12} color="#8b9bb4"/>
          {isAr?"سيستغرق الإعداد أقل من 3 دقائق":"Setup takes less than 3 minutes"}
        </div>
      </div>
      <style>{`
        @keyframes ob-bounceIn{0%{opacity:0;transform:scale(.6) rotate(-10deg)}60%{transform:scale(1.12) rotate(3deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
        @keyframes ob-fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ob-spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

/* ── Step 2: Profile setup ───────────────────────────────────────── */
function StepProfile({ isAr, profile, setProfile, onNext, onBack }) {
  const isCompany = profile.acct_type==="company";
  return (
    <div style={{padding:"8px 0"}}>
      <h2 style={{fontFamily:SYNE,fontSize:20,fontWeight:800,letterSpacing:"-.02em",marginBottom:6}}>
        {isCompany?(isAr?"بيانات شركتك":"Your company details"):(isAr?"أخبرنا عنك":"Tell us about you")}
      </h2>
      <p style={{fontSize:13,color:"#94a3b8",marginBottom:24,lineHeight:1.6}}>
        {isCompany
          ?(isAr?"سنستخدم هذه البيانات لإعداد لوحة HR الخاصة بك":"We'll use this to set up your HR dashboard")
          :(isAr?"سنخصّص تجربتك بناءً على بيانات ملفك":"We'll personalise your experience based on your profile")}
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:24}}>
        <Input label={isAr?"اسمك":"Your name"} value={profile.name||""}
          onChange={e=>setProfile(p=>({...p,name:e.target.value}))}
          placeholder={isAr?"أحمد مصطفى":"Jane Smith"}/>
        {isCompany?(
          <div style={{animation:`ob-fadeIn 250ms ${SPRING} both`}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Input label={isAr?"اسم الشركة":"Company name"} value={profile.company||""}
                onChange={e=>setProfile(p=>({...p,company:e.target.value}))}
                placeholder={isAr?"TechCorp Egypt":"Acme Corp"}/>
              <Input label={isAr?"عدد الموظفين":"Team size"} value={profile.teamSize||""}
                onChange={e=>setProfile(p=>({...p,teamSize:e.target.value}))}
                placeholder="50" type="number"/>
            </div>
            <div style={{marginTop:12}}>
              <Input label={isAr?"قطاع الصناعة":"Industry"} value={profile.industry||""}
                onChange={e=>setProfile(p=>({...p,industry:e.target.value}))}
                placeholder={isAr?"تقنية / مالية / رعاية صحية...":"Tech / Finance / Healthcare..."}/>
            </div>
          </div>
        ):(
          <div style={{animation:`ob-fadeIn 250ms ${SPRING} both`}}>
            <Input label={isAr?"تخصصك / وظيفتك":"Your role / job"} value={profile.jobTitle||""}
              onChange={e=>setProfile(p=>({...p,jobTitle:e.target.value}))}
              placeholder={isAr?"مطور، محاسب، مصمم...":"Developer, accountant, designer..."}/>
          </div>
        )}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
        background:isCompany?"rgba(16,185,129,.06)":"rgba(59,130,246,.06)",
        border:`1px solid ${isCompany?"rgba(16,185,129,.2)":"rgba(59,130,246,.2)"}`,
        borderRadius:10,marginBottom:24}}>
        <span style={{display:"inline-flex",flexShrink:0}}>
          <Icon name={isCompany?"building":"user"} size={18} color={isCompany?"#34d399":"#60a5fa"}/>
        </span>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:isCompany?"#34d399":"#60a5fa"}}>
            {isCompany?(isAr?"حساب شركة":"Company Account"):(isAr?"حساب فردي":"Individual Account")}
          </div>
          <div style={{fontSize:10,color:"#8b9bb4"}}>
            {isCompany
              ?(isAr?"سيُفعَّل HR Panel والـ Team Analytics بعد الإعداد":"HR Panel and Team Analytics will be activated after setup")
              :(isAr?"سيُفعَّل الداشبورد الشخصي والـ AI Coach":"Personal dashboard and AI Coach will be activated")}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:10}}>
        {/* Arrows were typed into the labels, so they never mirrored with the
             layout and they drifted between steps ("Continue →", "Looks great!
             Continue →", "Skip for now →", "3 selected → Continue"). The icon
             carries the direction and flips with `isAr`. */}
        <Btn variant="ghost" onClick={onBack} size="base" icon={isAr?"forward":"back"}>{isAr?"رجوع":"Back"}</Btn>
        <Btn onClick={onNext} fullWidth>{isAr?"التالي":"Continue"}</Btn>
      </div>
    </div>
  );
}

/* ── Step 2: Device + mode setup ─────────────────────────────────── */
function StepDevice({ isAr, profile, setProfile, onNext, onBack }) {
  const [mode] = useState("laptop"); // fixed — Phone/Side removed app-wide
  const [cameraOk, setCameraOk] = useState(null);
  const [checking, setChecking] = useState(false);
  const videoRef = useRef(null);

  const checkCamera = async () => {
    setChecking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraOk(true);
      stream.getTracks().forEach(t => t.stop());
    } catch {
      setCameraOk(false);
    }
    setChecking(false);
  };

  // Camera mode picker removed — Laptop (front camera at your desk) is the
  // only mode app-wide now. `mode` stays "laptop" (see useState above) so
  // every downstream consumer of this wizard's output is unaffected.

  return (
    <div style={{ padding: "8px 0" }}>
      <h2 style={{ fontFamily: SYNE, fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 6 }}>
        {isAr ? "إعداد الجهاز" : "Device Setup"}
      </h2>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
        {isAr ? "Corvus بيشتغل بكاميرا اللابتوب الأمامية" : "Corvus works with your laptop's front camera"}
      </p>

      <div style={{
        display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
        borderRadius: 12, marginBottom: 24,
        background: "rgba(26,86,219,.1)", border: "1.5px solid rgba(26,86,219,.45)",
      }}>
        <span style={{ display:"inline-flex", flexShrink: 0 }}>
          <Icon name="laptop" size={26} color="#60a5fa"/>
        </span>
        <div>
          <div style={{ fontFamily: SYNE, fontSize: 13, fontWeight: 700, color: "#60a5fa", marginBottom: 2 }}>
            {isAr ? "لابتوب / كمبيوتر" : "Laptop / Desktop"}
          </div>
          <div style={{ fontSize: 11, color: "#8b9bb4" }}>
            {isAr ? "كاميرا أمامية، جلوس على المكتب" : "Front camera, sitting at desk"}
          </div>
        </div>
      </div>

      {/* Camera check */}
      <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(148,163,184,.1)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ fontFamily: SYNE, fontSize: 12, fontWeight: 700, color: "#e8f0fe", marginBottom: 10 }}>
          {isAr ? "فحص الكاميرا" : "Camera Permission Check"}
        </div>
        {cameraOk === null && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 11, color: "#8b9bb4", flex: 1 }}>
              {isAr ? "تحتاج Corvus للوصول إلى كاميرتك للتحليل الآني" : "Corvus needs camera access for real-time analysis"}
            </div>
            <Btn size="sm" variant="secondary" onClick={checkCamera} loading={checking} icon="📷">
              {isAr ? "فحص" : "Check"}
            </Btn>
          </div>
        )}
        {cameraOk === true && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#34d399", fontSize: 13, fontWeight: 600 }}>
            <span>✓</span> {isAr ? "الكاميرا تعمل بشكل ممتاز!" : "Camera is working perfectly!"}
          </div>
        )}
        {cameraOk === false && (
          <div>
            <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>
              ⚠️ {isAr ? "تعذّر الوصول للكاميرا" : "Camera access denied"}
            </div>
            <div style={{ fontSize: 11, color: "#8b9bb4", lineHeight: 1.6 }}>
              {isAr
                ? "اذهب إلى إعدادات المتصفح ← الخصوصية ← الكاميرا وأضف corvus.io للمواقع المسموح بها"
                : "Go to browser Settings → Privacy → Camera → allow corvus.io"}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onBack} icon={isAr?"forward":"back"}>{isAr ? "رجوع" : "Back"}</Btn>
        <Btn onClick={() => { setProfile(p => ({ ...p, mode })); onNext(); }} fullWidth>
          {isAr ? "التالي" : "Continue"}
        </Btn>
      </div>
    </div>
  );
}

/* ── Step 3: Goals ───────────────────────────────────────────────── */
function StepGoals({ isAr, profile, setProfile, onNext, onBack }) {
  // BUG FIX: this always started empty, even when `profile.goals` already
  // had a value — every step in this wizard mounts/unmounts fresh as the
  // user moves between steps (each step index renders a different
  // component type, so React tears down the old one), so navigating
  // forward then back to this step silently threw away everything the
  // user had already selected here.
  const [selected, setSelected] = useState(profile.goals || []);
  const isCompany = profile.acct_type === "company";

  const individualGoals = [
    { id: "reduce_pain",    ico: "heartPulse", en: "Reduce back/neck pain",     ar: "تقليل آلام الظهر والرقبة" },
    { id: "productivity",   ico: "trend",      en: "Improve productivity",       ar: "تحسين الإنتاجية" },
    { id: "habits",         ico: "target",     en: "Build healthy work habits",  ar: "بناء عادات عمل صحية" },
    { id: "remote",         ico: "laptop",     en: "Support remote work wellness", ar: "دعم صحة العمل عن بُعد" },
  ];
  const companyGoals = [
    { id: "reduce_pain",    ico: "heartPulse", en: "Reduce back/neck pain",     ar: "تقليل آلام الظهر والرقبة" },
    { id: "productivity",   ico: "trend",      en: "Improve productivity",       ar: "تحسين الإنتاجية" },
    { id: "team_health",    ico: "users",      en: "Track team wellness",        ar: "تتبع صحة الفريق" },
    { id: "prevent_burnout",ico: "crystal",    en: "Prevent employee burnout",   ar: "منع الإنهاك الوظيفي" },
    { id: "roi",            ico: "barChart",   en: "Prove wellness ROI",         ar: "إثبات عائد الاستثمار الصحي" },
    { id: "habits",         ico: "target",     en: "Build healthy work habits",  ar: "بناء عادات عمل صحية" },
    { id: "remote",         ico: "laptop",     en: "Support remote work wellness", ar: "دعم صحة العمل عن بُعد" },
    { id: "compliance",     ico: "shield",     en: "HR compliance & reporting",  ar: "الامتثال وتقارير HR" },
  ];
  // BUG FIX: this used to be one flat list shown to everyone — an
  // individual user would see "Track team wellness", "Prevent employee
  // burnout", "HR compliance & reporting" right after choosing an
  // individual (not company) account in the previous step. Every other
  // step in this wizard already branches on isCompany; this one didn't.
  const goals = isCompany ? companyGoals : individualGoals;

  const toggle = id => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  return (
    <div style={{ padding: "8px 0" }}>
      <h2 style={{ fontFamily: SYNE, fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 6 }}>
        {isAr ? "ما هي أهدافك؟" : "What are your goals?"}
      </h2>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
        {isAr ? "اختر كل ما ينطبق — سنخصص تجربتك بناءً على اختياراتك" : "Select all that apply — we'll tailor your experience accordingly"}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
        {goals.map((g, i) => {
          const on = selected.includes(g.id);
          return (
            <button key={g.id} onClick={() => toggle(g.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 13px",
              borderRadius: 11, cursor: "pointer", textAlign: "left",
              background: on ? "rgba(16,185,129,.1)" : "rgba(255,255,255,.03)",
              border: `1.5px solid ${on ? "rgba(16,185,129,.4)" : "rgba(148,163,184,.1)"}`,
              transition: `all 180ms ${SPRING}`,
              animation: `ob-fadeIn 300ms ${i * 40}ms both`,
              transform: on ? "scale(1.02)" : "scale(1)",
            }}>
              <span style={{ display:"inline-flex", flexShrink:0 }}>
                <Icon name={g.ico} size={18} color={on ? "#34d399" : "#8b9bb4"}/>
              </span>
              <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? "#34d399" : "#94a3b8", lineHeight: 1.3 }}>
                {isAr ? g.ar : g.en}
              </span>
              {on && <span style={{ marginInlineStart: "auto", display:"inline-flex" }}>
                <Icon name="checkCircle" size={14} color="#34d399"/>
              </span>}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: "#8b9bb4", marginBottom: 20 }}>
        {selected.length === 0 ? (isAr ? "اختر هدفاً واحداً على الأقل" : "Select at least one goal") : `${selected.length} ${isAr ? "أهداف مختارة" : "goals selected"}`}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onBack} icon={isAr?"forward":"back"}>{isAr ? "رجوع" : "Back"}</Btn>
        <Btn onClick={() => { setProfile(p => ({ ...p, goals: selected })); onNext(); }} fullWidth disabled={selected.length === 0}>
          {isAr ? "التالي" : "Continue"}
        </Btn>
      </div>
    </div>
  );
}

/* ── Step 4: Demo workspace (sample analytics) ────────────────────── */
function StepDemoWorkspace({ isAr, onNext, onBack }) {
  const [tab, setTab] = useState("dashboard");
  const [animating, setAnimating] = useState(false);
  const bars = DEMO_SESSIONS.slice(-7).map(s => s.avg_score);
  const maxB = Math.max(...bars);
  // Bars were drawn as v/max — with seven scores all between 78 and 95 that
  // is 82%..100%, so the "preview of your real data" rendered as seven
  // identical full-height blocks: a chart shape with no chart in it. Scaling
  // across the observed range instead (with a floor so the lowest bar is
  // still a bar) is what makes the week read as a week.
  const minB = Math.min(...bars);
  const span = Math.max(1, maxB - minB);
  const avgScore = Math.round(bars.reduce((a, b) => a + b, 0) / bars.length);

  useEffect(() => { setTimeout(() => setAnimating(true), 100); }, []);

  const TABS = [
    { id: "dashboard", ico: "grid", en: "Dashboard",   ar: "لوحة التحكم" },
    { id: "analytics", ico: "barChart", en: "Analytics",    ar: "التحليلات" },
    { id: "ai",        ico: "brain",    en: "AI Insights",  ar: "رؤى AI" },
  ];

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <h2 style={{ fontFamily: SYNE, fontSize: 20, fontWeight: 800, letterSpacing: "-.02em" }}>
            {isAr ? "مساحة العمل التجريبية" : "Your Demo Workspace"}
          </h2>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
            {isAr ? "شوف كيف ستبدو بياناتك الحقيقية" : "Preview what your real data will look like"}
          </p>
        </div>
        <span style={{ background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.25)", borderRadius: 99, padding: "4px 12px", fontSize: 10, fontWeight: 700, color: "#34d399" }}>
          {isAr ? "بيانات تجريبية" : "Sample Data"}
        </span>
      </div>

      {/* Demo tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid rgba(148,163,184,.1)", paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "9px 14px", background: "none", border: "none",
            borderBottom: `2px solid ${tab === t.id ? "#1a56db" : "transparent"}`,
            color: tab === t.id ? "#60a5fa" : "#8b9bb4",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            transition: "color 150ms",
          }}>
            <Icon name={t.ico} size={13} color="currentColor"/> {isAr ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === "dashboard" && (
        <div style={{ animation: "ob-fadeIn 250ms both" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { l: isAr ? "متوسط الصحة" : "Health Avg", v: avgScore, sfx: "/100", c: sc(avgScore) },
              { l: isAr ? "الجلسات" : "Sessions",       v: 14,        sfx: "",      c: "#1a56db"    },
              { l: isAr ? "السلسلة" : "Streak",          v: 4,         sfx: isAr ? " أيام" : "d", c: "#f59e0b" },
            ].map((m, i) => (
              <div key={i} style={{ background: `${m.c}0a`, border: `1px solid ${m.c}20`, borderRadius: 12, padding: "12px 14px", textAlign: "center", animation: animating ? `ob-fadeIn 350ms ${i * 80}ms both` : "none" }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#8b9bb4", marginBottom: 6 }}>{m.l}</div>
                <div style={{ fontFamily: SYNE, fontSize: 22, fontWeight: 800, color: m.c, lineHeight: 1 }}>{m.v}{m.sfx}</div>
              </div>
            ))}
          </div>
          {/* Bar chart */}
          <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(148,163,184,.08)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#8b9bb4", marginBottom: 10 }}>{isAr ? "آخر 7 أيام" : "Last 7 days"}</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
              {bars.map((v, i) => {
                const pct = Math.round(30 + ((v - minB) / span) * 70);
                const color = sc(v);
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
                    <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                      <div style={{
                        width: "100%", background: color, borderRadius: "3px 3px 0 0",
                        height: animating ? `${pct}%` : "0%",
                        transition: `height 600ms ${i * 60}ms ${SPRING}`, opacity: .85,
                      }} />
                    </div>
                    <div style={{ fontSize: 8, color: "#8b9bb4" }}>{"SMTWTFS"[i]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Analytics tab */}
      {tab === "analytics" && (
        <div style={{ animation: "ob-fadeIn 250ms both", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: isAr ? "خطر الإرهاق" : "Burnout Risk",      value: 28, color: "#10b981" },
            { label: isAr ? "مؤشر التركيز" : "Focus Index",       value: 74, color: "#1a56db" },
            { label: isAr ? "الإنتاجية" : "Productivity Index",   value: 81, color: "#0891b2" },
            { label: isAr ? "نقاط الرقبة" : "Neck Risk",          value: 42, color: "#f59e0b" },
          ].map((m, i) => (
            <div key={i} style={{ animation: `ob-fadeIn 300ms ${i * 70}ms both` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{m.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.value}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "rgba(148,163,184,.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: animating ? `${m.value}%` : "0%", background: m.color, borderRadius: 99, transition: `width 700ms ${i * 80}ms ${SPRING}` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Insights tab */}
      {tab === "ai" && (
        <div style={{ animation: "ob-fadeIn 250ms both" }}>
          {[
            { ico: "bulb", color: "#10b981", title: isAr ? "وضعيتك تتحسن" : "Your posture is improving", body: isAr ? "تحسّن بنسبة 8% مقارنةً بالأسبوع الماضي. حافظ على هذا المستوى!" : "You've improved 8% vs last week. Keep this momentum going!" },
            { ico: "alertTriangle", color: "#f59e0b", title: isAr ? "اضبط ارتفاع الشاشة" : "Adjust your monitor height", body: isAr ? "كاميرا الجانب تشير إلى ميل الرأس للأمام. ارفع الشاشة 3-4 سم." : "Side camera detects forward head tilt. Raise monitor by 3-4cm." },
            { ico: "crystal", color: "#7c3aed", title: isAr ? "توقع الأسبوع القادم" : "Next week forecast", body: isAr ? "بناءً على الاتجاه الحالي، متوسطك سيصل 80/100 الأسبوع القادم." : "Based on your current trend, you'll hit 80/100 next week." },
          ].map((item, i) => (
            <div key={i} style={{ background: `${item.color}08`, border: `1px solid ${item.color}18`, borderRadius: 11, padding: "12px 14px", marginBottom: 10, display: "flex", gap: 10, animation: `ob-fadeIn 300ms ${i * 100}ms both` }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${item.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={item.ico} size={16} color={item.color}/></div>
              <div>
                <div style={{ fontFamily: SYNE, fontSize: 12, fontWeight: 700, color: "#e8f0fe", marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onBack} icon={isAr?"forward":"back"}>{isAr ? "رجوع" : "Back"}</Btn>
        <Btn onClick={onNext} fullWidth>
          {isAr ? "يبدو رائعاً! التالي" : "Looks great! Continue"}
        </Btn>
      </div>
    </div>
  );
}

/* ── Step 5: Interactive walkthrough ─────────────────────────────── */
function StepWalkthrough({ isAr, profile, onNext, onBack }) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState([]);

  const isCompany = profile?.acct_type === "company";
  // The HR-dashboard tour ("Workforce Intel", department health, a PDF for
  // your C-suite) was shown to everyone, so an individual who had just chosen
  // a personal account in step 1 was walked through a screen they do not have
  // — the same gap already fixed in StepGoals and StepIntegrations.
  const allTours = [
    {
      id: "session", ico: "play", color: "#1a56db",
      title:   isAr ? "بدء جلسة" : "Start a Session",
      titleAr: "بدء جلسة",
      steps: isAr
        ? ["اضغط زر 'ابدأ جلسة جديدة' في الصفحة الرئيسية", "ستشتغل الكاميرا تلقائياً وتبدأ التحليل", "شاهد نقاطك الآنية على الشاشة"]
        : ["Press 'Start New Session' on the home screen", "Camera will start and begin analysis automatically", "Watch your real-time score on screen"],
    },
    {
      id: "insights", ico: "brain", color: "#7c3aed",
      title:   isAr ? "رؤى AI" : "AI Insights",
      titleAr: "رؤى AI",
      steps: isAr
        ? ["من الصفحة الرئيسية، اضغط 'رؤى AI'", "اختر التبويب المطلوب: ملخص تنفيذي، اتجاهات، إرهاق", "اضغط 'توليد تحليل' لتلقي توصيات مخصصة"]
        : ["From home screen, tap 'AI Insights'", "Choose a tab: Executive Summary, Trends, or Fatigue", "Press 'Generate Analysis' for personalised recommendations"],
    },
    {
      id: "hr",      ico: "barChart", color: "#0891b2",
      title:   isAr ? "لوحة HR" : "HR Dashboard",
      titleAr: "لوحة HR",
      steps: isAr
        ? ["اضغط 'تحليلات QW' أو زر HR في القائمة السفلية", "استعرض صحة الأقسام ومؤشرات المخاطر", "صدّر تقريراً PDF جاهزاً للإدارة العليا"]
        : ["Tap 'Workforce Intel' or HR in the bottom nav", "Browse department health and risk indicators", "Export a PDF report ready for your C-suite"],
    },
    {
      id: "alerts",  ico: "bell", color: "#10b981",
      title:   isAr ? "الإشعارات" : "Notifications",
      titleAr: "الإشعارات",
      steps: isAr
        ? ["اضغط على أيقونة الجرس في الأعلى", "اربط Slack أو Teams لتلقي التنبيهات التلقائية", "ضع جدولاً للملخصات الأسبوعية"]
        : ["Tap the bell icon at the top", "Connect Slack or Teams for automatic alerts", "Schedule your weekly digest reports"],
    },
  ];

  const tours = allTours.filter(t => isCompany || t.id !== "hr");
  // `step` is an index into a list whose length depends on account type, and
  // a user can go Back and change that. Clamp rather than index off the end.
  const safeStep = Math.min(step, tours.length - 1);
  const current = tours[safeStep];
  const allDone = completed.length === tours.length;

  const markDone = (id) => { if (!completed.includes(id)) setCompleted(p => [...p, id]); };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <h2 style={{ fontFamily: SYNE, fontSize: 20, fontWeight: 800, letterSpacing: "-.02em" }}>
            {isAr ? "جولة تفاعلية" : "Interactive Walkthrough"}
          </h2>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
            {isAr ? "تعلّم كيفية استخدام أهم الميزات" : "Learn how to use the key features"}
          </p>
        </div>
        <div style={{ fontSize: 11, color: "#8b9bb4", fontWeight: 600 }}>
          {completed.length}/{tours.length} {isAr ? "مكتمل" : "done"}
        </div>
      </div>

      {/* Tour selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {tours.map((t, i) => {
          const done = completed.includes(t.id);
          return (
            <button key={t.id} onClick={() => setStep(i)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "7px 13px",
              borderRadius: 99, cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: safeStep === i ? `${t.color}14` : done ? "rgba(16,185,129,.08)" : "transparent",
              border: `1.5px solid ${safeStep === i ? `${t.color}45` : done ? "rgba(16,185,129,.3)" : "rgba(148,163,184,.12)"}`,
              color: safeStep === i ? t.color : done ? "#34d399" : "#8b9bb4",
              transition: `all 180ms`,
            }}>
              <Icon name={done ? "checkCircle" : t.ico} size={13} color="currentColor"/>
              {isAr ? t.titleAr : t.title}
            </button>
          );
        })}
      </div>

      {/* Current tour */}
      <div key={current.id} style={{ background: `${current.color}08`, border: `1px solid ${current.color}20`, borderRadius: 14, padding: 18, marginBottom: 16, animation: "ob-fadeIn 250ms both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: `${current.color}14`, border: `1px solid ${current.color}25`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={current.ico} size={19} color={current.color}/></div>
          <div style={{ fontFamily: SYNE, fontSize: 14, fontWeight: 800, color: "#e8f0fe" }}>{isAr ? current.titleAr : current.title}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {current.steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: `ob-fadeIn 250ms ${i * 80}ms both` }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${current.color}14`, border: `1px solid ${current.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: current.color, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, paddingTop: 2 }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <Btn variant="success" size="sm" onClick={() => markDone(current.id)} disabled={completed.includes(current.id)}>
            <Icon name="checkCircle" size={13} color="currentColor"/>
            {completed.includes(current.id) ? (isAr ? "مكتمل" : "Done!") : (isAr ? "فهمت!" : "Got it!")}
          </Btn>
        </div>
      </div>

      {/* Progress */}
      <ProgressBar value={completed.length} max={tours.length} h={5} />
      <div style={{ fontSize: 10, color: "#8b9bb4", marginTop: 6, marginBottom: 16 }}>
        {isAr ? `${completed.length} من ${tours.length} جولات مكتملة` : `${completed.length} of ${tours.length} tours complete`}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onBack} icon={isAr?"forward":"back"}>{isAr ? "رجوع" : "Back"}</Btn>
        <Btn onClick={onNext} fullWidth variant={allDone ? "primary" : "secondary"}>
          {allDone ? (isAr ? "ممتاز! التالي" : "Excellent! Continue") : (isAr ? "تخطي للآن" : "Skip for now")}
        </Btn>
      </div>
    </div>
  );
}

/* ── Step 6: Integrations quick connect ──────────────────────────── */
function StepIntegrations({ isAr, profile, setProfile, onNext, onBack }) {
  // BUG FIX: same remount-drops-state issue as StepGoals — hydrate from
  // whatever was already saved to profile.interestedIntegrations instead
  // of always starting from an empty selection.
  const [selected, setSelected] = useState(profile.interestedIntegrations || []);
  const isCompany = profile.acct_type === "company";

  // BUG FIX: Teams ("Team health updates") and Jira ("Auto HR tickets") are
  // company/HR-oriented and don't make sense for an individual account —
  // same gap as StepGoals had.
  const individualOptions = [
    { id: "slack",  mark: "S", name: "Slack",               desc: isAr ? "تنبيهات في قنواتك" : "Alerts in your channels",       color: "#7C3AED" },
    { id: "gcal",   mark: "G", name: "Google Calendar",     desc: isAr ? "جدولة الجلسات تلقائياً" : "Auto-schedule sessions",    color: "#1A73E8" },
  ];
  const companyOptions = [
    { id: "slack",  mark: "S", name: "Slack",               desc: isAr ? "تنبيهات في قنواتك" : "Alerts in your channels",       color: "#7C3AED" },
    { id: "teams",  mark: "T", name: "Microsoft Teams",     desc: isAr ? "تحديثات الفريق" : "Team health updates",              color: "#6264A7" },
    { id: "gcal",   mark: "G", name: "Google Calendar",     desc: isAr ? "جدولة الجلسات تلقائياً" : "Auto-schedule sessions",    color: "#1A73E8" },
    { id: "jira",   mark: "J", name: "Jira",                desc: isAr ? "تذاكر HR تلقائية" : "Auto HR tickets",                 color: "#0052CC" },
  ];
  const options = isCompany ? companyOptions : individualOptions;

  // BUG FIX: this used to fake a real connection — a random 1.2-1.8s delay
  // then a green "✓ Connected" badge, with zero actual OAuth/API call ever
  // happening. It actively misled users into thinking Slack/Teams/Jira were
  // live-linked, and that false state got saved and echoed back on the
  // Summary step. This is now an honest interest picker — instant toggle,
  // no fake "connecting" animation, and wording that matches what actually
  // happens (real setup later, in Settings).
  const toggle = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  return (
    <div style={{ padding: "8px 0" }}>
      <h2 style={{ fontFamily: SYNE, fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 6 }}>
        {isAr ? "ربط منصاتك" : "Connect Your Platforms"}
      </h2>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24, lineHeight: 1.6 }}>
        {isAr ? "اختياري — الربط الفعلي بيتم من الإعدادات بعد كده" : "Optional — the actual connection happens in Settings after this"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {options.map((opt, i) => {
          const isSelected = selected.includes(opt.id);
          return (
            <div key={opt.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
              background: isSelected ? `${opt.color}0a` : "rgba(255,255,255,.03)",
              border: `1.5px solid ${isSelected ? `${opt.color}35` : "rgba(148,163,184,.1)"}`,
              borderRadius: 12, transition: `all 200ms ${SPRING}`,
              animation: `ob-fadeIn 300ms ${i * 70}ms both`,
            }}>
              {/* Was an emoji per service, two of which (🟦 Teams, 🔵 Jira)
                   were literally coloured squares. A monogram in the brand's
                   colour says which service it is without pretending to be
                   the logo. */}
              <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: `${opt.color}22`, border: `1px solid ${opt.color}45`,
                color: "#e8f0fe", fontWeight: 800, fontSize: 14,
                display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {opt.mark}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SYNE, fontSize: 13, fontWeight: 700, color: "#e8f0fe" }}>{opt.name}</div>
                <div style={{ fontSize: 11, color: "#8b9bb4" }}>{opt.desc}</div>
              </div>
              {isSelected
                ? <span style={{ fontSize: 12, fontWeight: 700, color: "#34d399", display: "flex", alignItems: "center", gap: 5 }}>✓ {isAr ? "مُختار" : "Selected"}</span>
                : <Btn size="xs" variant="secondary" onClick={() => toggle(opt.id)}>
                    {isAr ? "اختيار" : "Select"}
                  </Btn>
              }
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onBack} icon={isAr?"forward":"back"}>{isAr ? "رجوع" : "Back"}</Btn>
        <Btn onClick={() => { setProfile(p => ({ ...p, interestedIntegrations: selected })); onNext(); }} fullWidth>
          {selected.length > 0 ? (isAr ? `التالي · ${selected.length} مُختارة` : `Continue · ${selected.length} selected`) : (isAr ? "تخطي للآن" : "Skip for now")}
        </Btn>
      </div>
    </div>
  );
}

/* ── Step 7: All set! ────────────────────────────────────────────── */
function StepFinish({ isAr, profile, onComplete }) {
  const [confetti, setConfetti] = useState(false);
  const [count, setCount] = useState(0);
  const firstName = profile.name?.split(" ")[0] || (isAr ? "أنت" : "you");

  useEffect(() => {
    setConfetti(true);
    // Animate count
    let n = 0;
    const interval = setInterval(() => {
      n++;
      setCount(n);
      if (n >= 100) clearInterval(interval);
    }, 12);
    return () => clearInterval(interval);
  }, []);

  const summary = [
    // BUG FIX: was reading `profile.userType`, a field nothing in this
    // wizard ever sets (the account-type step writes `acct_type`) — this
    // always showed "Individual" here, even for company signups.
    // Role and Goals both used 🎯, so two of the four summary rows carried
    // the same glyph.
    { ico: "user",    label: isAr ? "الدور" : "Role",          value: profile.acct_type === "company" ? (isAr ? "شركة" : "Company") : (isAr ? "فردي" : "Individual") },
    { ico: "laptop",  label: isAr ? "وضع الكاميرا" : "Mode",   value: profile.mode || "Laptop" },
    { ico: "target",  label: isAr ? "الأهداف" : "Goals",       value: `${(profile.goals||[]).length} ${isAr ? "أهداف" : "selected"}` },
    { ico: "plug",    label: isAr ? "التكاملات" : "Integrations", value: `${(profile.interestedIntegrations||[]).length} ${isAr ? "مُختارة" : "selected"}` },
  ];

  return (
    <div style={{ textAlign: "center", padding: "24px 16px" }}>
      {/* Celebration */}
      <div style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto 18px",
        background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: confetti ? "ob-bounceIn 600ms cubic-bezier(.16,1,.3,1) both" : "none" }}>
        <Icon name="checkCircle" size={36} color="#10b981"/>
      </div>

      <div style={{ background: "linear-gradient(135deg,#1a56db,#0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontFamily: SYNE, fontSize: "clamp(24px,4vw,36px)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 8 }}>
        {isAr ? "جاهز تماماً!" : "You're all set!"}
      </div>

      <div style={{ fontFamily: SYNE, fontSize: 15, color: "#94a3b8", marginBottom: 24, lineHeight: 1.7 }}>
        {isAr ? `تم إعداد حسابك يا ${firstName}. حان وقت بدء أول جلسة!` : `Your workspace is ready, ${firstName}. Time to start your first session!`}
      </div>

      {/* Setup summary */}
      <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(148,163,184,.1)", borderRadius: 14, padding: "16px 20px", marginBottom: 24, textAlign: "left" }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".09em", color: "#8b9bb4", marginBottom: 12 }}>{isAr ? "ملخص الإعداد" : "Setup Summary"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {summary.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", animation: `ob-fadeIn 300ms ${i * 80}ms both` }}>
              <span style={{ display:"inline-flex", flexShrink:0 }}>
                <Icon name={s.ico} size={16} color="#60a5fa"/>
              </span>
              <div>
                <div style={{ fontSize: 10.5, color: "#8b9bb4", fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e8f0fe" }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What's next */}
      <div style={{ marginBottom: 28, textAlign: "left" }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".09em", color: "#8b9bb4", marginBottom: 12 }}>{isAr ? "الخطوات التالية" : "What's Next"}</div>
        {[
          { ico: "play",     text: isAr ? "ابدأ أول جلسة — سيعطيك الذكاء الاصطناعي تحليلاً فورياً" : "Start your first session — our AI will give you instant analysis", color: "#1a56db" },
          { ico: "barChart", text: isAr ? "بعد 3 جلسات ستُفتح التحليلات المتقدمة" : "After 3 sessions, advanced analytics will unlock", color: "#0891b2" },
          { ico: "crystal",  text: isAr ? "بعد أسبوع ستبدأ التنبيهات التنبؤية" : "After a week, predictive burnout alerts will activate", color: "#7c3aed" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: i < 2 ? "1px solid rgba(148,163,184,.08)" : "none", animation: `ob-fadeIn 300ms ${i * 100}ms both` }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${item.color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={item.ico} size={14} color={item.color}/></div>
            <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, paddingTop: 4 }}>{item.text}</div>
          </div>
        ))}
      </div>

      <Btn size="lg" fullWidth onClick={onComplete} icon="play">
        {isAr ? "ابدأ أول جلسة الآن" : "Start My First Session"}
      </Btn>
      <div style={{ marginTop: 10, fontSize: 11, color: "#8b9bb4" }}>
        {isAr ? "يمكنك دائماً إعادة هذا الإعداد من الإعدادات" : "You can always redo this setup from Settings"}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN WIZARD COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export function OnboardingWizard({ user, lang = "en", onComplete, onSkip }) {
  useBodyScrollLock();
  const [step, setStep]       = useState(0);
  const [profile, setProfile] = useState({ ...DEMO_PROFILE, name: user?.displayName || "" });
  const [dir, setDir]         = useState("forward");
  const isAr = lang === "ar";

  // ── Persist onboarding step mid-flow (resume if user closes tab) ──
  useEffect(() => {
    if (!user?.uid || step === 0) return;
    import("firebase/firestore").then(({ doc, updateDoc, serverTimestamp }) =>
      import("./firebase.js").then(({ db }) =>
        updateDoc(doc(db, "users", user.uid), {
          onboarding_step:         step,
          onboarding_step_at:      new Date().toISOString(),
          // Save partial profile data progressively. BUG FIX: this used to
          // save `profile.userType`, a field this wizard never actually
          // sets (the real field is `acct_type`) — so account type was
          // silently never persisted, and interestedIntegrations wasn't
          // saved either, even though both are needed to resume correctly.
          ...(profile.name  ? { name:  profile.name  } : {}),
          ...(profile.goals ? { goals: profile.goals } : {}),
          ...(profile.acct_type ? { onboarding_acct_type: profile.acct_type } : {}),
          ...(profile.interestedIntegrations ? { onboarding_integrations: profile.interestedIntegrations } : {}),
        }).catch(() => {}) // silent — don't block UI
      )
    );
  }, [step, user?.uid]);

  // ── Resume from saved step on re-mount ───────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    import("firebase/firestore").then(({ doc, getDoc }) =>
      import("./firebase.js").then(({ db }) =>
        getDoc(doc(db, "users", user.uid)).then(snap => {
          const data  = snap.data();
          const saved = data?.onboarding_step;
          if (saved && saved > 0 && saved < 8) { // don't resume from finish step
            // BUG FIX: this jumped straight to the saved step but never
            // restored the profile fields that went with it — a user who
            // closed the tab on the Goals/Integrations step and came back
            // landed there again with an EMPTY profile: no name, no
            // account type (so company accounts silently saw the
            // individual goal/integration list — see StepGoals/
            // StepIntegrations), and none of their previously saved
            // selections.
            setProfile(p => ({
              ...p,
              ...(data.name ? { name: data.name } : {}),
              ...(data.goals ? { goals: data.goals } : {}),
              ...(data.onboarding_acct_type ? { acct_type: data.onboarding_acct_type } : {}),
              ...(data.onboarding_integrations ? { interestedIntegrations: data.onboarding_integrations } : {}),
            }));
            setStep(saved);
          }
        }).catch(() => {})
      )
    );
  }, [user?.uid]);

  const STEPS = [
    { id: "account",      label: isAr ? "نوع الحساب" : "Account type"  },
    { id: "welcome",      label: isAr ? "مرحباً"     : "Welcome"        },
    { id: "profile",      label: isAr ? "ملفك"       : "Profile"        },
    { id: "device",       label: isAr ? "الجهاز"     : "Device"         },
    { id: "goals",        label: isAr ? "الأهداف"    : "Goals"          },
    { id: "demo",         label: isAr ? "تجريبي"     : "Demo"           },
    { id: "walkthrough",  label: isAr ? "جولة"       : "Tour"           },
    { id: "integrations", label: isAr ? "تكاملات"    : "Integrations"   },
    { id: "finish",       label: isAr ? "اكتمل!"     : "All set!"       },
  ];

  const progress = Math.round((step / (STEPS.length - 1)) * 100);

  // Whether the step content is scrolled short of its end — drives the fade
  // at the bottom of the content region.
  const scrollRef = useRef(null);
  const [fade, setFade] = useState(false);
  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setFade(el.scrollHeight - el.scrollTop - el.clientHeight > 12);
  }, []);
  useEffect(() => {
    // Re-measure on step change and on resize; the step is swapped in with an
    // animation, so measure after it has laid out.
    const t = setTimeout(updateFade, 320);
    updateFade();
    window.addEventListener("resize", updateFade);
    return () => { clearTimeout(t); window.removeEventListener("resize", updateFade); };
  }, [step, updateFade]);

  const goNext = () => { setDir("forward"); setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const goBack = () => { setDir("back");    setStep(s => Math.max(s - 1, 0)); };

  const STEP_COMPS = [
    <StepAccountType isAr={isAr} setProfile={setProfile} onNext={goNext} />,
    <StepWelcome      isAr={isAr} name={profile.name} acctType={profile.acct_type} onNext={goNext} />,
    <StepProfile      isAr={isAr} profile={profile} setProfile={setProfile} onNext={goNext} onBack={goBack} />,
    <StepDevice       isAr={isAr} profile={profile} setProfile={setProfile} onNext={goNext} onBack={goBack} />,
    <StepGoals        isAr={isAr} profile={profile} setProfile={setProfile} onNext={goNext} onBack={goBack} />,
    <StepDemoWorkspace isAr={isAr} onNext={goNext} onBack={goBack} />,
    <StepWalkthrough  isAr={isAr} profile={profile} onNext={goNext} onBack={goBack} />,
    <StepIntegrations isAr={isAr} profile={profile} setProfile={setProfile} onNext={goNext} onBack={goBack} />,
    <StepFinish       isAr={isAr} profile={profile} onComplete={() => onComplete?.(profile)} />,
  ];

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(2,8,20,.96)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center",
      // 16px of page padding on a 390px phone cost the modal 32px of the
      // height it was already short of — step 1's Continue button sat below
      // the fold with no sign it was there.
      padding: "10px",
    }}>
      <div style={{
        background: "linear-gradient(145deg,#0a1428 0%,#07112a 100%)",
        border: "1px solid rgba(148,163,184,.09)",
        borderRadius: 22, width: "min(580px,96vw)", maxHeight: "96dvh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(26,86,219,.12)",
        direction: isAr ? "rtl" : "ltr",
        animation: "ob-slideUp 400ms cubic-bezier(0.16,1,0.3,1) both",
      }}>

        {/* ── Header ──
            Was three progress indicators stacked on top of each other: a
            "1 / 9" counter, a thin progress bar, and a row of nine labelled
            pills. Nine pills never fit — the row clipped mid-word ("…
            Integrations | A") on every screen size, which is the first thing
            a new user saw of the product. One indicator instead: the current
            step named in words, and a nine-segment rail that always fits
            because it carries no text. */}
        <div style={{ padding: "16px 22px 14px", borderBottom: "1px solid rgba(148,163,184,.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#1a56db,#0891b2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", flexShrink: 0 }}>◈</div>
              <span style={{ fontFamily: SYNE, fontSize: 14, fontWeight: 800, letterSpacing: "-.025em", color: "#e8f0fe", whiteSpace: "nowrap" }}>Corvus <span style={{ color: "#60a5fa" }}>Pro</span></span>
            </div>
            {/* Skip is the escape hatch from a nine-step wizard, and it was
                #475569 on #0a1428 — about 2.4:1, under half the minimum
                readable contrast, on the one control someone in a hurry is
                looking for. */}
            {step < STEPS.length - 1 && (
              <button onClick={onSkip} style={{
                background: "rgba(148,163,184,.07)", border: "1px solid rgba(148,163,184,.16)",
                borderRadius: 8, fontSize: 11.5, color: "#94a3b8", cursor: "pointer",
                fontWeight: 600, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {isAr ? "تخطي الإعداد" : "Skip setup"}
              </button>
            )}
          </div>

          {/* Segmented rail — one segment per step, no labels to clip. */}
          <div style={{ display: "flex", gap: 3, marginTop: 14 }} role="progressbar"
            aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}
            aria-label={isAr ? "تقدّم الإعداد" : "Setup progress"}>
            {STEPS.map((s, i) => (
              <div key={s.id} style={{
                flex: 1, height: 3, borderRadius: 99,
                background: i < step ? "#10b981"
                          : i === step ? "linear-gradient(90deg,#1a56db,#0891b2)"
                          : "rgba(148,163,184,.14)",
                transition: "background 300ms",
              }}/>
            ))}
          </div>

          {/* The step you are on, named — which is what the nine pills were
              trying and failing to say. */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 9 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#e8f0fe" }}>
              {STEPS[step].label}
            </span>
            <span style={{ fontSize: 11, color: "#8b9bb4", fontWeight: 600 }}>
              {isAr ? `خطوة ${step + 1} من ${STEPS.length}` : `Step ${step + 1} of ${STEPS.length}`}
            </span>
          </div>
        </div>

        {/* ── Content ──
            Nine steps of varying height inside a capped modal: on a phone the
            taller ones scroll, and a scrolling region whose bottom edge is a
            hard line gives no hint that the primary button is below it. The
            fade appears only while there is actually more to scroll to. */}
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <div ref={scrollRef} onScroll={updateFade}
            style={{ height: "100%", overflowY: "auto", padding: "18px 22px" }}>
            <div key={step} style={{ animation: `ob-${dir === "forward" ? "slideInRight" : "slideInLeft"} 280ms ${SPRING} both` }}>
              {STEP_COMPS[step]}
            </div>
          </div>
          <div aria-hidden="true" style={{
            position: "absolute", left: 0, right: 0, bottom: 0, height: 44,
            background: "linear-gradient(to top,#08122b 15%,rgba(8,18,43,0))",
            pointerEvents: "none", opacity: fade ? 1 : 0, transition: "opacity 180ms",
          }}/>
        </div>
      </div>

      <style>{`
        @keyframes ob-slideUp{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes ob-slideInRight{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}
        @keyframes ob-slideInLeft{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:translateX(0)}}
        @keyframes ob-bounceIn{0%{opacity:0;transform:scale(.6) rotate(-10deg)}60%{transform:scale(1.15) rotate(3deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
        @keyframes ob-fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ob-spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

/* ── Demo data exports (used by WorkforceAnalytics for demo mode) ── */
export { DEMO_SESSIONS, DEMO_PROFILE };
