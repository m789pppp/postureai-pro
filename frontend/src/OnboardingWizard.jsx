/**
 * Corvus — Onboarding Wizard v1.0
 * Phase 11: Onboarding Experience
 * Setup wizard · Guided onboarding · Demo workspace
 * Sample analytics · Interactive walkthroughs
 */
import { useState, useEffect, useRef, useCallback } from "react";

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
        opacity: disabled ? .45 : 1,
        fontFamily: "'DM Sans',system-ui,sans-serif",
        whiteSpace: "nowrap", width: fullWidth ? "100%" : undefined,
        transition: `all 220ms ${SPRING}`,
        transform: hov && !disabled && !loading ? "translateY(-1px)" : "none",
        background: v.bg, color: v.c, border: v.border, boxShadow: v.sh || "none",
        ...sx,
      }}>
      {loading
        ? <span style={{ animation: "ob-spin 750ms linear infinite", display: "inline-block" }}>⟳</span>
        : icon && <span style={{ fontSize: "1.1em" }}>{icon}</span>}
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
  const dash = (score / 100) * c, col = sc(score);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,163,184,.1)" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={sw}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 700ms cubic-bezier(.4,0,.2,1)" }} />
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
      {hint && <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>{hint}</div>}
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
      id:"individual", icon:"🧑‍💻",
      en:"Individual", ar:"مستخدم فردي",
      desc:"Personal posture tracking, AI coaching, and wellness reports — just for you.",
      descAr:"تتبع وضعيتك الشخصية، AI Coach، وتقارير صحية شخصية.",
      color:"#3b82f6",
      features:["Personal dashboard","AI Coach","PDF reports","Progress tracking"],
      featuresAr:["داشبورد شخصي","AI Coach","تقارير PDF","تتبع التقدم"],
    },
    {
      id:"company", icon:"🏢",
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
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{fontSize:36,marginBottom:12}}>🎯</div>
        <h2 style={{fontFamily:SYNE,fontSize:22,fontWeight:800,letterSpacing:"-.02em",marginBottom:8,color:"#e8f0fe"}}>
          {isAr?"كيف ستستخدم Corvus؟":"How will you use Corvus?"}
        </h2>
        <p style={{fontSize:13,color:"#64748b",lineHeight:1.6}}>
          {isAr?"اختر نوع حسابك — التجربة مختلفة تماماً لكل نوع":"Choose your account type — each gets a fully different experience"}
        </p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:28}}>
        {types.map(t=>(
          <button key={t.id} onClick={()=>setChosen(t.id)} style={{
            width:"100%",textAlign:"left",padding:"18px 20px",borderRadius:14,cursor:"pointer",
            background:chosen===t.id?`linear-gradient(135deg,${t.color}18,${t.color}08)`:"rgba(255,255,255,.02)",
            border:`2px solid ${chosen===t.id?t.color:"rgba(148,163,184,.1)"}`,
            transition:`all 200ms ${SPRING}`,
            boxShadow:chosen===t.id?`0 0 0 4px ${t.color}18`:"none",
          }}>
            <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
              <div style={{width:48,height:48,borderRadius:12,flexShrink:0,
                background:chosen===t.id?`${t.color}22`:"rgba(255,255,255,.06)",
                border:`1.5px solid ${chosen===t.id?t.color+"44":"rgba(148,163,184,.1)"}`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{t.icon}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontFamily:SYNE,fontSize:16,fontWeight:800,color:chosen===t.id?t.color:"#e8f0fe"}}>
                    {isAr?t.ar:t.en}
                  </span>
                  {chosen===t.id&&(
                    <span style={{fontSize:10,fontWeight:700,color:t.color,
                      background:`${t.color}18`,border:`1px solid ${t.color}44`,
                      borderRadius:99,padding:"2px 8px"}}>
                      {isAr?"✓ تم الاختيار":"✓ Selected"}
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
                      color:chosen===t.id?t.color:"#475569",
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
        {isAr?"التالي ←":"Continue →"}
      </Btn>
      {!chosen&&(
        <div style={{textAlign:"center",fontSize:11,color:"#475569",marginTop:10}}>
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
        }}>{isCompany?"🏢":"◈"}</div>
      </div>
      <div style={{opacity:show?1:0,transform:show?"none":"translateY(16px)",transition:`all 500ms 150ms ${SPRING}`}}>
        <div style={{fontSize:10,fontWeight:800,letterSpacing:".16em",textTransform:"uppercase",
          color:isCompany?"#34d399":"#60a5fa",marginBottom:12}}>
          {isCompany?(isAr?"منصة HR للقوى العاملة":"HR WORKFORCE PLATFORM"):(isAr?"منصة ذكاء الوضعية بالـ AI":"AI POSTURE INTELLIGENCE")}
        </div>
        <h1 style={{fontFamily:SYNE,fontSize:"clamp(24px,5vw,38px)",fontWeight:800,letterSpacing:"-.035em",lineHeight:1.1,marginBottom:16}}>
          {isAr?`أهلاً ${firstName}! 👋`:`Welcome, ${firstName}! 👋`}
        </h1>
        <p style={{fontSize:14,color:"#94a3b8",lineHeight:1.75,maxWidth:460,margin:"0 auto 28px"}}>
          {isCompany
            ?(isAr?"سنعدّ لك لوحة HR كاملة لمراقبة صحة فريقك وتحليل البيانات وإرسال التنبيهات.":"We'll set up your HR dashboard to monitor team health, analyze data, and send smart alerts.")
            :(isAr?"سنعدّ لك تجربة تتبع شخصية مخصصة بالـ AI لتحسين وضعيتك وصحتك.":"We'll set up your personal AI-powered posture tracking experience.")}
        </p>
      </div>
      <div style={{opacity:show?1:0,transition:"opacity 500ms 300ms",display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:32}}>
        {(isCompany
          ?(isAr?["👥 نظرة عامة للفريق","📊 HR Analytics","🔔 تنبيهات الخطر","📋 تقارير المؤسسة","🔒 أمان مؤسسي"]:["👥 Team overview","📊 HR Analytics","🔔 At-risk alerts","📋 Org reports","🔒 Enterprise security"])
          :(isAr?["🧠 ذكاء AI فوري","📈 تحليلات شخصية","🤖 AI Coach","📋 تقارير PDF","🏆 تتبع التقدم"]:["🧠 Real-time AI","📈 Personal analytics","🤖 AI Coach","📋 PDF reports","🏆 Progress tracking"])
        ).map((f,i)=>(
          <span key={i} style={{
            background:isCompany?"rgba(5,150,105,.1)":"rgba(26,86,219,.1)",
            border:`1px solid ${isCompany?"rgba(5,150,105,.22)":"rgba(26,86,219,.22)"}`,
            borderRadius:99,padding:"6px 14px",fontSize:12,fontWeight:600,
            color:isCompany?"#34d399":"#60a5fa",
            animation:show?`ob-fadeIn 300ms ${400+i*60}ms both`:"none",
          }}>{f}</span>
        ))}
      </div>
      <div style={{opacity:show?1:0,transition:"opacity 500ms 500ms"}}>
        <Btn size="lg" onClick={onNext} fullWidth icon="→">
          {isAr?"هيا نبدأ ←":"Let's get started →"}
        </Btn>
        <div style={{fontSize:11,color:"#475569",marginTop:12}}>
          {isAr?"⏱ سيستغرق الإعداد أقل من 3 دقائق":"⏱ Setup takes less than 3 minutes"}
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
        <span style={{fontSize:18}}>{isCompany?"🏢":"🧑‍💻"}</span>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:isCompany?"#34d399":"#60a5fa"}}>
            {isCompany?(isAr?"حساب شركة":"Company Account"):(isAr?"حساب فردي":"Individual Account")}
          </div>
          <div style={{fontSize:10,color:"#475569"}}>
            {isCompany
              ?(isAr?"سيُفعَّل HR Panel والـ Team Analytics بعد الإعداد":"HR Panel and Team Analytics will be activated after setup")
              :(isAr?"سيُفعَّل الداشبورد الشخصي والـ AI Coach":"Personal dashboard and AI Coach will be activated")}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onBack} size="base">{isAr?"← رجوع":"← Back"}</Btn>
        <Btn onClick={onNext} fullWidth>{isAr?"التالي ←":"Continue →"}</Btn>
      </div>
    </div>
  );
}

/* ── Step 2: Device + mode setup ─────────────────────────────────── */
function StepDevice({ isAr, profile, setProfile, onNext, onBack }) {
  const [mode, setMode] = useState("laptop");
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

  const modes = [
    { id: "laptop", icon: "💻", en: "Laptop / Desktop", ar: "لابتوب / كمبيوتر",
      desc: "Front camera, sitting at desk", descAr: "كاميرا أمامية، جلوس على المكتب" },
    { id: "phone",  icon: "📱", en: "Mobile (propped)",  ar: "موبايل (مثبّت)",
      desc: "Phone camera at eye level", descAr: "كاميرا الهاتف على مستوى العين" },
    { id: "side",   icon: "🪑", en: "Side view",         ar: "عرض جانبي",
      desc: "Camera to your side for posture analysis", descAr: "كاميرا من الجانب لتحليل الوضعية" },
  ];

  return (
    <div style={{ padding: "8px 0" }}>
      <h2 style={{ fontFamily: SYNE, fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 6 }}>
        {isAr ? "إعداد الجهاز" : "Device Setup"}
      </h2>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24 }}>
        {isAr ? "اختر وضع الكاميرا المناسب لعملك" : "Choose the camera mode that fits your work setup"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {modes.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
            borderRadius: 12, cursor: "pointer", textAlign: "left",
            background: mode === m.id ? "rgba(26,86,219,.1)" : "rgba(255,255,255,.03)",
            border: `1.5px solid ${mode === m.id ? "rgba(26,86,219,.45)" : "rgba(148,163,184,.1)"}`,
            transition: `all 200ms ${SPRING}`,
          }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>{m.icon}</span>
            <div>
              <div style={{ fontFamily: SYNE, fontSize: 13, fontWeight: 700, color: mode === m.id ? "#60a5fa" : "#e8f0fe", marginBottom: 2 }}>
                {isAr ? m.ar : m.en}
              </div>
              <div style={{ fontSize: 11, color: "#475569" }}>{isAr ? m.descAr : m.desc}</div>
            </div>
            {mode === m.id && <div style={{ marginLeft: "auto", fontSize: 16, color: "#60a5fa" }}>✓</div>}
          </button>
        ))}
      </div>

      {/* Camera check */}
      <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(148,163,184,.1)", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ fontFamily: SYNE, fontSize: 12, fontWeight: 700, color: "#e8f0fe", marginBottom: 10 }}>
          {isAr ? "فحص الكاميرا" : "Camera Permission Check"}
        </div>
        {cameraOk === null && (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 11, color: "#475569", flex: 1 }}>
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
            <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
              {isAr
                ? "اذهب إلى إعدادات المتصفح ← الخصوصية ← الكاميرا وأضف corvus.io للمواقع المسموح بها"
                : "Go to browser Settings → Privacy → Camera → allow corvus.io"}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onBack}>{isAr ? "← رجوع" : "← Back"}</Btn>
        <Btn onClick={() => { setProfile(p => ({ ...p, mode })); onNext(); }} fullWidth>
          {isAr ? "التالي ←" : "Continue →"}
        </Btn>
      </div>
    </div>
  );
}

/* ── Step 3: Goals ───────────────────────────────────────────────── */
function StepGoals({ isAr, profile, setProfile, onNext, onBack }) {
  const [selected, setSelected] = useState([]);

  const goals = [
    { id: "reduce_pain",    icon: "💪", en: "Reduce back/neck pain",          ar: "تقليل آلام الظهر والرقبة" },
    { id: "productivity",   icon: "⚡", en: "Improve productivity",            ar: "تحسين الإنتاجية" },
    { id: "team_health",    icon: "👥", en: "Track team wellness",             ar: "تتبع صحة الفريق" },
    { id: "prevent_burnout",icon: "🔥", en: "Prevent employee burnout",        ar: "منع الإنهاك الوظيفي" },
    { id: "roi",            icon: "📈", en: "Prove wellness ROI",              ar: "إثبات عائد الاستثمار الصحي" },
    { id: "habits",         icon: "🎯", en: "Build healthy work habits",       ar: "بناء عادات عمل صحية" },
    { id: "remote",         icon: "🏠", en: "Support remote work wellness",    ar: "دعم صحة العمل عن بُعد" },
    { id: "compliance",     icon: "🛡️", en: "HR compliance & reporting",       ar: "الامتثال وتقارير HR" },
  ];

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
              <span style={{ fontSize: 20 }}>{g.icon}</span>
              <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? "#34d399" : "#94a3b8", lineHeight: 1.3 }}>
                {isAr ? g.ar : g.en}
              </span>
              {on && <span style={{ marginLeft: "auto", fontSize: 13, color: "#34d399" }}>✓</span>}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: "#475569", marginBottom: 20 }}>
        {selected.length === 0 ? (isAr ? "اختر هدفاً واحداً على الأقل" : "Select at least one goal") : `${selected.length} ${isAr ? "أهداف مختارة" : "goals selected"}`}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onBack}>{isAr ? "← رجوع" : "← Back"}</Btn>
        <Btn onClick={() => { setProfile(p => ({ ...p, goals: selected })); onNext(); }} fullWidth disabled={selected.length === 0}>
          {isAr ? "التالي ←" : "Continue →"}
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
  const avgScore = Math.round(bars.reduce((a, b) => a + b, 0) / bars.length);

  useEffect(() => { setTimeout(() => setAnimating(true), 100); }, []);

  const TABS = [
    { id: "dashboard", icon: "⊞",  en: "Dashboard",   ar: "لوحة التحكم" },
    { id: "analytics", icon: "📊", en: "Analytics",    ar: "التحليلات" },
    { id: "ai",        icon: "🧠", en: "AI Insights",  ar: "رؤى AI" },
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
            color: tab === t.id ? "#60a5fa" : "#475569",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            transition: "color 150ms",
          }}>
            <span>{t.icon}</span> {isAr ? t.ar : t.en}
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
              { l: isAr ? "السلسلة" : "Streak",          v: 4,         sfx: " 🔥",  c: "#f59e0b"    },
            ].map((m, i) => (
              <div key={i} style={{ background: `${m.c}0a`, border: `1px solid ${m.c}20`, borderRadius: 12, padding: "12px 14px", textAlign: "center", animation: animating ? `ob-fadeIn 350ms ${i * 80}ms both` : "none" }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#475569", marginBottom: 6 }}>{m.l}</div>
                <div style={{ fontFamily: SYNE, fontSize: 22, fontWeight: 800, color: m.c, lineHeight: 1 }}>{m.v}{m.sfx}</div>
              </div>
            ))}
          </div>
          {/* Bar chart */}
          <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(148,163,184,.08)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#475569", marginBottom: 10 }}>{isAr ? "آخر 7 أيام" : "Last 7 days"}</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
              {bars.map((v, i) => {
                const pct = Math.round((v / maxB) * 100);
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
                    <div style={{ fontSize: 8, color: "#475569" }}>{"SMTWTFS"[i]}</div>
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
            { icon: "💡", color: "#10b981", title: isAr ? "وضعيتك تتحسن" : "Your posture is improving", body: isAr ? "تحسّن بنسبة 8% مقارنةً بالأسبوع الماضي. حافظ على هذا المستوى!" : "You've improved 8% vs last week. Keep this momentum going!" },
            { icon: "⚠️", color: "#f59e0b", title: isAr ? "اضبط ارتفاع الشاشة" : "Adjust your monitor height", body: isAr ? "كاميرا الجانب تشير إلى ميل الرأس للأمام. ارفع الشاشة 3-4 سم." : "Side camera detects forward head tilt. Raise monitor by 3-4cm." },
            { icon: "🔮", color: "#7c3aed", title: isAr ? "توقع الأسبوع القادم" : "Next week forecast", body: isAr ? "بناءً على الاتجاه الحالي، متوسطك سيصل 80/100 الأسبوع القادم." : "Based on your current trend, you'll hit 80/100 next week." },
          ].map((item, i) => (
            <div key={i} style={{ background: `${item.color}08`, border: `1px solid ${item.color}18`, borderRadius: 11, padding: "12px 14px", marginBottom: 10, display: "flex", gap: 10, animation: `ob-fadeIn 300ms ${i * 100}ms both` }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${item.color}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{item.icon}</div>
              <div>
                <div style={{ fontFamily: SYNE, fontSize: 12, fontWeight: 700, color: "#e8f0fe", marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <Btn variant="ghost" onClick={onBack}>{isAr ? "← رجوع" : "← Back"}</Btn>
        <Btn onClick={onNext} fullWidth>
          {isAr ? "يبدو رائعاً! التالي ←" : "Looks great! Continue →"}
        </Btn>
      </div>
    </div>
  );
}

/* ── Step 5: Interactive walkthrough ─────────────────────────────── */
function StepWalkthrough({ isAr, onNext, onBack }) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState([]);

  const tours = [
    {
      id: "session", icon: "▶", color: "#1a56db",
      title:   isAr ? "بدء جلسة" : "Start a Session",
      titleAr: "بدء جلسة",
      steps: isAr
        ? ["اضغط زر 'ابدأ جلسة جديدة' في الصفحة الرئيسية", "ستشتغل الكاميرا تلقائياً وتبدأ التحليل", "شاهد نقاطك الآنية على الشاشة"]
        : ["Press 'Start New Session' on the home screen", "Camera will start and begin analysis automatically", "Watch your real-time score on screen"],
    },
    {
      id: "insights", icon: "🧠", color: "#7c3aed",
      title:   isAr ? "رؤى AI" : "AI Insights",
      titleAr: "رؤى AI",
      steps: isAr
        ? ["من الصفحة الرئيسية، اضغط 'رؤى AI'", "اختر التبويب المطلوب: ملخص تنفيذي، اتجاهات، إرهاق", "اضغط 'توليد تحليل' لتلقي توصيات مخصصة"]
        : ["From home screen, tap 'AI Insights'", "Choose a tab: Executive Summary, Trends, or Fatigue", "Press 'Generate Analysis' for personalised recommendations"],
    },
    {
      id: "hr",      icon: "📊", color: "#0891b2",
      title:   isAr ? "لوحة HR" : "HR Dashboard",
      titleAr: "لوحة HR",
      steps: isAr
        ? ["اضغط 'تحليلات QW' أو زر HR في القائمة السفلية", "استعرض صحة الأقسام ومؤشرات المخاطر", "صدّر تقريراً PDF جاهزاً للإدارة العليا"]
        : ["Tap 'Workforce Intel' or HR in the bottom nav", "Browse department health and risk indicators", "Export a PDF report ready for your C-suite"],
    },
    {
      id: "alerts",  icon: "🔔", color: "#10b981",
      title:   isAr ? "الإشعارات" : "Notifications",
      titleAr: "الإشعارات",
      steps: isAr
        ? ["اضغط على أيقونة الجرس في الأعلى", "اربط Slack أو Teams لتلقي التنبيهات التلقائية", "ضع جدولاً للملخصات الأسبوعية"]
        : ["Tap the bell icon at the top", "Connect Slack or Teams for automatic alerts", "Schedule your weekly digest reports"],
    },
  ];

  const current = tours[step];
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
        <div style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>
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
              background: step === i ? `${t.color}14` : done ? "rgba(16,185,129,.08)" : "transparent",
              border: `1.5px solid ${step === i ? `${t.color}45` : done ? "rgba(16,185,129,.3)" : "rgba(148,163,184,.12)"}`,
              color: step === i ? t.color : done ? "#34d399" : "#475569",
              transition: `all 180ms`,
            }}>
              {done ? "✓" : t.icon} {isAr ? t.titleAr : t.title}
            </button>
          );
        })}
      </div>

      {/* Current tour */}
      <div key={current.id} style={{ background: `${current.color}08`, border: `1px solid ${current.color}20`, borderRadius: 14, padding: 18, marginBottom: 16, animation: "ob-fadeIn 250ms both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: `${current.color}14`, border: `1px solid ${current.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{current.icon}</div>
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
            {completed.includes(current.id) ? `✓ ${isAr ? "مكتمل" : "Done!"}` : (isAr ? "✓ فهمت!" : "✓ Got it!")}
          </Btn>
        </div>
      </div>

      {/* Progress */}
      <ProgressBar value={completed.length} max={tours.length} h={5} />
      <div style={{ fontSize: 10, color: "#475569", marginTop: 6, marginBottom: 16 }}>
        {isAr ? `${completed.length} من ${tours.length} جولات مكتملة` : `${completed.length} of ${tours.length} tours complete`}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onBack}>{isAr ? "← رجوع" : "← Back"}</Btn>
        <Btn onClick={onNext} fullWidth variant={allDone ? "primary" : "secondary"}>
          {allDone ? (isAr ? "ممتاز! التالي ←" : "Excellent! Continue →") : (isAr ? "تخطي للآن ←" : "Skip for now →")}
        </Btn>
      </div>
    </div>
  );
}

/* ── Step 6: Integrations quick connect ──────────────────────────── */
function StepIntegrations({ isAr, profile, setProfile, onNext, onBack }) {
  const [connected, setConnected] = useState([]);
  const [connecting, setConnecting] = useState(null);

  const options = [
    { id: "slack",  icon: "💬", name: "Slack",               desc: isAr ? "تنبيهات في قنواتك" : "Alerts in your channels",       color: "#4A154B" },
    { id: "teams",  icon: "🟦", name: "Microsoft Teams",     desc: isAr ? "تحديثات الفريق" : "Team health updates",              color: "#6264A7" },
    { id: "gcal",   icon: "📅", name: "Google Calendar",     desc: isAr ? "جدولة الجلسات تلقائياً" : "Auto-schedule sessions",    color: "#1A73E8" },
    { id: "jira",   icon: "🔵", name: "Jira",                desc: isAr ? "تذاكر HR تلقائية" : "Auto HR tickets",                 color: "#0052CC" },
  ];

  const connect = async (id) => {
    setConnecting(id);
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 600));
    setConnected(prev => [...prev, id]);
    setConnecting(null);
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <h2 style={{ fontFamily: SYNE, fontSize: 20, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 6 }}>
        {isAr ? "ربط منصاتك" : "Connect Your Platforms"}
      </h2>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24, lineHeight: 1.6 }}>
        {isAr ? "ربط اختياري — تقدر تربطهم دائماً من الإعدادات لاحقاً" : "Optional — you can always connect these later from Settings"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {options.map((opt, i) => {
          const isConnected = connected.includes(opt.id);
          const isConnecting = connecting === opt.id;
          return (
            <div key={opt.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
              background: isConnected ? `${opt.color}0a` : "rgba(255,255,255,.03)",
              border: `1.5px solid ${isConnected ? `${opt.color}35` : "rgba(148,163,184,.1)"}`,
              borderRadius: 12, transition: `all 200ms ${SPRING}`,
              animation: `ob-fadeIn 300ms ${i * 70}ms both`,
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{opt.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SYNE, fontSize: 13, fontWeight: 700, color: "#e8f0fe" }}>{opt.name}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>{opt.desc}</div>
              </div>
              {isConnected
                ? <span style={{ fontSize: 12, fontWeight: 700, color: "#34d399", display: "flex", alignItems: "center", gap: 5 }}>✓ {isAr ? "متصل" : "Connected"}</span>
                : <Btn size="xs" variant="secondary" loading={isConnecting} onClick={() => connect(opt.id)}>
                    {isAr ? "ربط" : "Connect"}
                  </Btn>
              }
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={onBack}>{isAr ? "← رجوع" : "← Back"}</Btn>
        <Btn onClick={() => { setProfile(p => ({ ...p, connectedIntegrations: connected })); onNext(); }} fullWidth>
          {connected.length > 0 ? (isAr ? `${connected.length} تكاملات متصلة ← التالي` : `${connected.length} connected → Continue`) : (isAr ? "تخطي للآن ←" : "Skip for now →")}
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
    { icon: "🎯", label: isAr ? "الدور" : "Role",          value: profile.userType || "Individual" },
    { icon: "💻", label: isAr ? "وضع الكاميرا" : "Mode",   value: profile.mode || "Laptop" },
    { icon: "🎯", label: isAr ? "الأهداف" : "Goals",       value: `${(profile.goals||[]).length} ${isAr ? "أهداف" : "selected"}` },
    { icon: "🔌", label: isAr ? "التكاملات" : "Integrations", value: `${(profile.connectedIntegrations||[]).length} ${isAr ? "متصلة" : "connected"}` },
  ];

  return (
    <div style={{ textAlign: "center", padding: "24px 16px" }}>
      {/* Celebration */}
      <div style={{ fontSize: 64, marginBottom: 16, animation: confetti ? "ob-bounceIn 600ms cubic-bezier(.16,1,.3,1) both" : "none" }}>
        🎉
      </div>

      <div style={{ background: "linear-gradient(135deg,#1a56db,#0891b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", fontFamily: SYNE, fontSize: "clamp(24px,4vw,36px)", fontWeight: 800, letterSpacing: "-.03em", marginBottom: 8 }}>
        {isAr ? "جاهز تماماً!" : "You're all set!"}
      </div>

      <div style={{ fontFamily: SYNE, fontSize: 15, color: "#94a3b8", marginBottom: 24, lineHeight: 1.7 }}>
        {isAr ? `تم إعداد حسابك يا ${firstName}. حان وقت بدء أول جلسة!` : `Your workspace is ready, ${firstName}. Time to start your first session!`}
      </div>

      {/* Setup summary */}
      <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(148,163,184,.1)", borderRadius: 14, padding: "16px 20px", marginBottom: 24, textAlign: "left" }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".09em", color: "#475569", marginBottom: 12 }}>{isAr ? "ملخص الإعداد" : "Setup Summary"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {summary.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", animation: `ob-fadeIn 300ms ${i * 80}ms both` }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e8f0fe" }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What's next */}
      <div style={{ marginBottom: 28, textAlign: "left" }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".09em", color: "#475569", marginBottom: 12 }}>{isAr ? "الخطوات التالية" : "What's Next"}</div>
        {[
          { icon: "▶", text: isAr ? "ابدأ أول جلسة — سيعطيك الذكاء الاصطناعي تحليلاً فورياً" : "Start your first session — our AI will give you instant analysis", color: "#1a56db" },
          { icon: "📊", text: isAr ? "بعد 3 جلسات ستُفتح التحليلات المتقدمة" : "After 3 sessions, advanced analytics will unlock", color: "#0891b2" },
          { icon: "🔮", text: isAr ? "بعد أسبوع ستبدأ التنبيهات التنبؤية" : "After a week, predictive burnout alerts will activate", color: "#7c3aed" },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: i < 2 ? "1px solid rgba(148,163,184,.08)" : "none", animation: `ob-fadeIn 300ms ${i * 100}ms both` }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${item.color}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: item.color, flexShrink: 0 }}>{item.icon}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, paddingTop: 4 }}>{item.text}</div>
          </div>
        ))}
      </div>

      <Btn size="lg" fullWidth onClick={onComplete} icon="▶">
        {isAr ? "ابدأ أول جلسة الآن ←" : "Start My First Session →"}
      </Btn>
      <div style={{ marginTop: 10, fontSize: 11, color: "#475569" }}>
        {isAr ? "يمكنك دائماً إعادة هذا الإعداد من الإعدادات" : "You can always redo this setup from Settings"}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN WIZARD COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export function OnboardingWizard({ user, lang = "en", onComplete, onSkip }) {
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
          // Save partial profile data progressively
          ...(profile.name  ? { name:  profile.name  } : {}),
          ...(profile.goals ? { goals: profile.goals } : {}),
          ...(profile.userType ? { user_type: profile.userType } : {}),
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
          const saved = snap.data()?.onboarding_step;
          if (saved && saved > 0 && saved < 8) { // don't resume from finish step
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

  const goNext = () => { setDir("forward"); setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const goBack = () => { setDir("back");    setStep(s => Math.max(s - 1, 0)); };

  const STEP_COMPS = [
    <StepAccountType isAr={isAr} setProfile={setProfile} onNext={goNext} />,
    <StepWelcome      isAr={isAr} name={profile.name} acctType={profile.acct_type} onNext={goNext} />,
    <StepProfile      isAr={isAr} profile={profile} setProfile={setProfile} onNext={goNext} onBack={goBack} />,
    <StepDevice       isAr={isAr} profile={profile} setProfile={setProfile} onNext={goNext} onBack={goBack} />,
    <StepGoals        isAr={isAr} profile={profile} setProfile={setProfile} onNext={goNext} onBack={goBack} />,
    <StepDemoWorkspace isAr={isAr} onNext={goNext} onBack={goBack} />,
    <StepWalkthrough  isAr={isAr} onNext={goNext} onBack={goBack} />,
    <StepIntegrations isAr={isAr} profile={profile} setProfile={setProfile} onNext={goNext} onBack={goBack} />,
    <StepFinish       isAr={isAr} profile={profile} onComplete={() => onComplete?.(profile)} />,
  ];

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(2,8,20,.96)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      <div style={{
        background: "linear-gradient(145deg,#0a1428 0%,#07112a 100%)",
        border: "1px solid rgba(148,163,184,.09)",
        borderRadius: 22, width: "min(580px,96vw)", maxHeight: "92vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(26,86,219,.12)",
        direction: isAr ? "rtl" : "ltr",
        animation: "ob-slideUp 400ms cubic-bezier(0.16,1,0.3,1) both",
      }}>

        {/* ── Header ── */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid rgba(148,163,184,.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#1a56db,#0891b2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>◈</div>
              <span style={{ fontFamily: SYNE, fontSize: 14, fontWeight: 800, letterSpacing: "-.025em", color: "#e8f0fe" }}>Corvus <span style={{ color: "#60a5fa" }}>Pro</span></span>
            </div>
            {/* Step indicator + skip */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>
                {step + 1} / {STEPS.length}
              </span>
              {step < STEPS.length - 1 && (
                <button onClick={onSkip} style={{ background: "none", border: "none", fontSize: 11, color: "#475569", cursor: "pointer", fontWeight: 600, padding: "4px 0" }}>
                  {isAr ? "تخطي الإعداد" : "Skip setup"}
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <ProgressBar value={progress} h={3} color="linear-gradient(90deg,#1a56db,#0891b2)" />

          {/* Step pills */}
          <div style={{ display: "flex", gap: 4, marginTop: 12, overflowX: "auto" }}>
            {STEPS.map((s, i) => (
              <div key={s.id} style={{
                flexShrink: 0, fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
                background: i === step ? "rgba(26,86,219,.18)" : i < step ? "rgba(16,185,129,.1)" : "transparent",
                border: `1px solid ${i === step ? "rgba(26,86,219,.35)" : i < step ? "rgba(16,185,129,.25)" : "rgba(148,163,184,.08)"}`,
                color: i === step ? "#60a5fa" : i < step ? "#34d399" : "#475569",
                transition: "all 250ms",
              }}>
                {i < step ? "✓ " : ""}{s.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div key={step} style={{ animation: `ob-${dir === "forward" ? "slideInRight" : "slideInLeft"} 280ms ${SPRING} both` }}>
            {STEP_COMPS[step]}
          </div>
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
