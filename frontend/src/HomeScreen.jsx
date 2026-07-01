/**
 * Corvus — HomeScreen v3
 * Full redesign using Design System tokens
 * Inline JSX block — rendered directly inside App.jsx
 * All variables (user, profile, cs, t, etc.) are in parent scope.
 */
import { useState, useEffect, useCallback } from "react";
import { qualityFor } from "./lib/tierQuality.js";
import { COLORS as C, TYPE as TY, SPACE as SP, RADIUS as R, SHADOW as SH,
         GLOBAL_CSS, scoreColor, scoreGrade, tierMeta, COMP } from "./DesignSystem.js";
import { getUserSessions, getAllUsers, completeOnboardingStep,
         SUPPORT_EMAIL, ADMIN_PHONE } from "./firebase.js";
import { useBreakpoint, SkeletonHome, ZeroDashboard, AchievementToast,
         SuccessCheck, PulseRing, CountUp, ProgressBar,
         BottomSheet, Confetti } from "./ui/index.jsx";

// ─────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────
function Chip({ label, color, bg, border }) {
  return (
    <span style={{
      ...COMP.badge(color, bg),
      border: `1px solid ${border || "transparent"}`,
    }}>{label}</span>
  );
}

function AccentBar({ color }) {
  return <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
    background:`linear-gradient(90deg,${color}70,transparent)` }} />;
}

function ScoreRing({ score, size = 68 }) {
  const r    = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const col  = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(255,255,255,.06)" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={col} strokeWidth={6}
        strokeDasharray={`${circ*(score/100)} ${circ}`}
        strokeLinecap="round"
        style={{ transition:"stroke-dasharray .9s cubic-bezier(.16,1,.3,1)" }}/>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ transform:"rotate(90deg)", transformOrigin:"center",
          fontFamily:TY.fontSans, fontSize:size*.26, fontWeight:TY.extrabold, fill:col }}>
        {score}
      </text>
    </svg>
  );
}

function StatCard({ label, value, sub, color, accentIcon }) {
  return (
    <div style={{
      ...COMP.card, padding:"14px 14px 12px",
      position:"relative", overflow:"hidden", flex:1, minWidth:0,
    }}>
      <AccentBar color={color} />
      <div style={{ fontSize:TY.xs, fontWeight:TY.bold, color:C.muted,
        letterSpacing:".08em", textTransform:"uppercase", marginBottom:8 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:4 }}>
        {accentIcon && <span style={{ fontSize:16 }}>{accentIcon}</span>}
        <span style={{ fontSize:TY["2xl"], fontWeight:TY.extrabold, color,
          letterSpacing:"-1.5px", lineHeight:1 }}>{value}</span>
      </div>
      {sub && <div style={{ fontSize:TY.xs+.5, color, fontWeight:TY.medium }}>{sub}</div>}
    </div>
  );
}

function WeekBar({ days }) {
  return (
    <div style={{ display:"flex", gap:5, height:56, alignItems:"flex-end", direction:"ltr" }}>
      {days.map((d, i) => {
        const isToday = i === days.length - 1;
        const col = d.has ? scoreColor(d.score) : C.faint;
        const h   = d.has ? Math.max(8, Math.round((d.score / 100) * 48)) : 4;
        return (
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
            alignItems:"center", gap:5 }}>
            <div style={{
              width:"100%", borderRadius:"4px 4px 0 0",
              background: col,
              height: h,
              opacity: d.has ? 1 : .25,
              transition:"height .5s cubic-bezier(.16,1,.3,1)",
              boxShadow: d.has && d.score >= 75 ? `0 0 8px ${col}50` : "none",
            }}/>
            <span style={{ fontSize:9, fontWeight: isToday ? TY.bold : TY.regular,
              color: isToday ? C.text : C.muted }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ShortcutBtn({ icon, label, sub, color, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...COMP.card,
        padding:"15px 14px",
        display:"flex", alignItems:"center", gap:12,
        cursor:"pointer", textAlign:"left",
        borderColor: hov ? `${color}35` : C.border,
        background: hov ? `${color}08` : C.surface,
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov ? `0 6px 20px rgba(0,0,0,.3)` : "none",
        transition:"all .18s ease",
      }}>
      <div style={{
        width:42, height:42, borderRadius:R.md, flexShrink:0,
        background:`${color}14`,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:20,
      }}>{icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:TY.base, fontWeight:TY.bold, color:C.text, lineHeight:TY.tight }}>{label}</div>
        {sub && <div style={{ fontSize:TY.xs+.5, color:C.muted, marginTop:3 }}>{sub}</div>}
      </div>
      <span style={{ color:C.faint, fontSize:13, flexShrink:0 }}>›</span>
    </button>
  );
}

function ModeBtn({ id, icon, label, active, onClick }) {
  return (
    <button onClick={() => onClick(id)} style={{
      flex:1, padding:"10px 4px",
      borderRadius:R.md,
      border:`1.5px solid ${active ? C.blue : C.border}`,
      background: active ? C.blueDim : C.surface,
      display:"flex", flexDirection:"column", alignItems:"center", gap:5,
      cursor:"pointer",
      boxShadow: active ? `0 0 0 3px ${C.blueGlow}` : "none",
      transition:"all .18s ease",
    }}>
      <span style={{ fontSize:20, filter: active ? "none" : "grayscale(1) opacity(.4)" }}>{icon}</span>
      <span style={{ fontSize:10, fontWeight: active ? TY.bold : TY.medium,
        color: active ? "#a5b4fc" : C.muted }}>{label}</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// TOP NAV
// ─────────────────────────────────────────────────────────────────
function TopNav({ user, profile, isAr, darkMode, setDarkMode, setLang,
                  isAdmin, isHRAdmin, t, cs, lang,
                  NavAvatarDropdown, setPage, setUser, setProfile, logOut,
                  getUserSessions: _gus, setUserSessions, getAllUsers: _gau, setAllUsers,
                  setAcctType, setDevicePref }) {
  return (
    <header style={{
      position:"sticky", top:0, zIndex:50,
      background:"rgba(7,11,18,.92)",
      borderBottom:`1px solid ${C.border}`,
      backdropFilter:"blur(16px)",
      WebkitBackdropFilter:"blur(16px)",
      height:54, padding:`0 ${SP[5]}px`,
      display:"flex", alignItems:"center", justifyContent:"space-between",
    }}>
      {/* Logo */}
      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
        <div style={{
          width:32, height:32,
          background:"linear-gradient(135deg,#6366f1,#0891b2)",
          borderRadius:R.sm+2, display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:16, color:"white", fontWeight:TY.extrabold,
        }}>◈</div>
        <span style={{ fontSize:15, fontWeight:TY.extrabold, color:C.text, letterSpacing:"-.03em" }}>
          Corvus <span style={{ color:C.blue }}>Pro</span>
        </span>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
        <button onClick={() => setLang(isAr ? "en" : "ar")} style={{
          ...COMP.btnGhost, padding:"4px 10px", fontSize:TY.xs, borderRadius:R.xs,
        }}>{isAr ? "EN" : "عربي"}</button>
        <button onClick={() => setDarkMode(!darkMode)} style={{
          ...COMP.btnGhost, padding:"5px 9px", fontSize:14,
        }}>{darkMode ? "☀" : "⏾"}</button>
        <NavAvatarDropdown
          user={user} profile={profile} cs={cs} t={t} lang={lang} isAr={isAr}
          isAdmin={isAdmin} isHRAdmin={isHRAdmin}
          onProfile={() => { _gus(user.uid).then(setUserSessions); setPage("profile"); }}
          onLeaderboard={() => { _gau().then(setAllUsers); setPage("leaderboard"); }}
          onHR={() => setPage("hr")}
          onAdmin={() => setPage("admin")}
          onSetup={() => { setAcctType?.(null); setDevicePref?.(null); setPage("setup"); }}
          onSignOut={() => { logOut(); setUser(null); setProfile(null); setPage("landing"); }}
        />
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────
// BOTTOM NAV
// ─────────────────────────────────────────────────────────────────
function BottomNav({ setPage, startCamera, setMode, mode, isAr, companyId, profile }) {
  const goSession = () => {
    const m = mode || (()=>{try{return localStorage.getItem("last_mode");}catch(e){return null;}})() || "laptop";
    setMode(m);
    setPage("live");
    setTimeout(() => startCamera?.(), 150);
  };
  const tabs = [
    { id:"home",    en:"Home",    ar:"الرئيسية", icon:"⌂",   action:() => setPage("home") },
    { id:"session", en:"Session", ar:"جلسة",     icon:"▶",   action:goSession, special:true },
    { id:"profile", en:"Profile", ar:"حسابي",    icon:"◉",   action:() => setPage("profile") },
  ];
  return (
    <nav style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:100,
      background:"rgba(7,11,18,.97)",
      borderTop:`1px solid ${C.border}`,
      backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
      display:"flex", alignItems:"center",
      padding:`8px 0 max(10px,env(safe-area-inset-bottom))`,
      fontFamily:TY.fontSans,
    }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={tab.action} style={{
          flex:1, display:"flex", flexDirection:"column", alignItems:"center",
          gap: tab.special ? 0 : 3,
          padding:"4px 0",
          background:"none", border:"none", cursor:"pointer",
        }}>
          {tab.special ? (
            <div style={{
              width:50, height:50, borderRadius:"50%",
              background:"linear-gradient(135deg,#6366f1,#0891b2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, color:"white", marginTop:-20,
              boxShadow:SH.blue,
              animation:"ds-glow 2.5s ease infinite",
            }}>{tab.icon}</div>
          ) : (
            <span style={{ fontSize:21, lineHeight:1, color:C.muted }}>{tab.icon}</span>
          )}
          <span style={{ fontSize:TY.xs, fontWeight:TY.medium, color:C.muted }}>
            {isAr ? tab.ar : tab.en}
          </span>
        </button>
      ))}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN EXPORT (inline render block)
// ─────────────────────────────────────────────────────────────────

/**
 * USAGE IN App.jsx:
 * Replace `if(page==="home") return ( ... )` with:
 * import HomeScreen from "./HomeScreen.jsx";
 * if(page==="home") return <HomeScreen {...allProps} />;
 */
export default function HomeScreen(props) {
  const {
    user, profile, userSessions = [], setUserSessions,
    allUsers, setAllUsers,
    cs, lang, isAr, dir, t,
    tier, setTier, mode, setMode,
    setPage, startCamera, addToast,
    darkMode, setDarkMode, setLang,
    setShowDashboard, setShowCoach, setShowGamification,
    setShowBilling, setShowCompanyOnboard, setShowAdmin,
    isAdmin, isHRAdmin, companyId,
    logOut, setUser, setProfile,
    setAcctType, setDevicePref,
    showCalibWizard, setShowCalibWizard,
    showBreak, dismissBreak,
    showDashboard, showCoach, showGamification,
    showBilling, showCompanyOnboard, showAdmin,
    AnalyticsDashboard, AICoach, GamificationPanel,
    BillingModal, CompanyOnboarding, AdminDashboard,
    calibData, setCalibData,
    Toasts, toasts, dismissToast,
    NavAvatarDropdown, UpgradePrompt,
    showUpgrade, upgradeReason, setShowUpgrade,
    BreakTimer, CalibrationWizard, toast, ErrorBoundary,
  } = props;

  // ── Computed ─────────────────────────────────────────────────
  const { isMobile, isTablet, bp } = useBreakpoint();
  const savedMode = (()=>{try{return localStorage.getItem("last_mode");}catch(e){return null;}})() || "laptop";
  const curMode   = mode || savedMode;
  const [achievement, setAchievement] = useState(null);
  const [showConfetti, setConfetti]   = useState(false);

  // Detect first session completion → achievement toast
  useEffect(() => {
    if (userSessions.length === 1 && !profile?.onboarding_done?.includes("first_session")) {
      setTimeout(() => {
        setConfetti(true);
        setAchievement({
          icon:"🎯", title: isAr?"أول جلسة مكتملة!":"First Session Complete!",
          desc: isAr?"وضعيتك تُتابع الآن — استمر كل يوم!":"Your posture is now tracked — keep it up!",
        });
      }, 800);
    }
  }, [userSessions.length]);

  const avgAll = userSessions.length
    ? Math.round(userSessions.reduce((a,s)=>a+(s.avg_score||0),0)/userSessions.length)
    : (profile?.avg_score || 0);

  const sessMonth = userSessions.filter(s => {
    const d = s.created_at?.toDate?.() ?? new Date(s.created_at||0);
    const n = new Date();
    return d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
  }).length;

  const streak   = profile?.streak_days || (userSessions.length>0?1:0);
  const lastSess = userSessions[0];
  const lastScore= lastSess?.avg_score || 0;
  const firstName= (profile?.name||user?.email?.split("@")[0]||"").split(" ")[0];

  const lastTime = (() => {
    if (!lastSess) return null;
    const d = lastSess.created_at?.toDate?.() ?? new Date(lastSess.created_at||0);
    const h = Math.floor((Date.now()-d)/3600000);
    if (h<1)  return isAr?"منذ قليل":"just now";
    if (h<24) return isAr?`منذ ${h}س`:`${h}h ago`;
    return isAr?`منذ ${Math.floor(h/24)} يوم`:`${Math.floor(h/24)}d ago`;
  })();

  const last7 = (() => {
    const out=[];
    for(let i=6;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i);
      const ds=d.toDateString();
      const ss=userSessions.filter(s=>(s.created_at?.toDate?.()??new Date(s.created_at||0)).toDateString()===ds);
      const avg=ss.length?Math.round(ss.reduce((a,s)=>a+(s.avg_score||0),0)/ss.length):0;
      out.push({label:["S","M","T","W","T","F","S"][d.getDay()],score:avg,has:ss.length>0});
    }
    return out;
  })();

  const hour  = new Date().getHours();
  const greet = isAr
    ?(hour<12?"صباح الخير":hour<17?"مساء الخير":"مساء النور")
    :(hour<12?"Good morning":hour<17?"Good afternoon":"Good evening");

  const insight = !avgAll ? null
    :avgAll>=80?(isAr?"وضعيتك ممتازة هذا الأسبوع 💪":"Posture excellent this week 💪")
    :avgAll>=60?(isAr?`متوسطك ${avgAll}/100 — اضبط ارتفاع الشاشة`:`Avg ${avgAll}/100 — try adjusting monitor height`)
    :(isAr?`⚠️ متوسطك ${avgAll}/100 — وضعية الرقبة تحتاج اهتمام`:`⚠️ Avg ${avgAll}/100 — neck posture needs attention`);

  const trialExp  = profile?.trial_expires_at?.toDate?.();
  const trialDays = trialExp?Math.max(0,Math.ceil((trialExp-Date.now())/86400000)):null;
  const showTrial = profile?.is_trial && trialDays!==null;
  const trialCol  = trialDays<=1?C.red:trialDays<=3?C.amber:C.blue;

  // onboarding steps
  const done       = profile?.onboarding_done||[];
  const shareOk    = done.some(d=>["invite_team","referral_link","share_referral"].includes(d));
  const ob = [
    {id:"first_session", en:"First session", ar:"أول جلسة",    icon:"🎯", ok:done.includes("first_session"),
      action:()=>{setMode(curMode);setPage("live");startCamera?.();}},
    {id:"pdf_download",  en:"Download PDF",  ar:"تحميل PDF",   icon:"📄", ok:done.includes("pdf_download"), action:null},
    {id:"share_referral",en:"Invite friend", ar:"دعوة زميل",   icon:"🔗", ok:shareOk,
      action:()=>{const url=`${window.location.origin}?ref=${user?.uid?.slice(0,8)}`;
        navigator.clipboard.writeText(url).then(()=>addToast?.(isAr?"✅ رابط الدعوة منسوخ":"✅ Invite link copied!","success"));
        completeOnboardingStep(user.uid,"share_referral").catch(()=>{});}},
  ];
  const obDone  = ob.filter(o=>o.ok).length;
  const showOB  = obDone < 3;

  const goLive = () => {
    setMode(curMode);
    (()=>{try{localStorage.setItem("last_mode",curMode);}catch(e){}})();
    setPage("live");
    setTimeout(()=>startCamera?.(),150);
  };

  const tm = tierMeta[profile?.tier] || tierMeta.standard;

  return (
    <div dir={dir} style={{
      minHeight:"100vh", background:C.bg, color:C.text,
      fontFamily:TY.fontSans, paddingBottom:80,
    }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── MODALS ─────────────────────────────────────────────── */}
      {Toasts && <Toasts toasts={toasts} dismiss={dismissToast} isAr={isAr}/>}
      {showCalibWizard&&CalibrationWizard&&(
        <CalibrationWizard uid={profile?.uid} cs={cs} lang={lang}
          onDone={d=>{setCalibData?.(d);setShowCalibWizard(false);toast?.("Calibration saved ✓","success");}}
          onSkip={()=>setShowCalibWizard(false)}/>)}
      {showBreak&&BreakTimer&&(
        <BreakTimer cs={cs} lang={lang} intervalMin={30} onDismiss={dismissBreak}
          onComplete={()=>{dismissBreak?.();toast?.("Break done! 🎉","success");}}/>)}
      {showDashboard&&AnalyticsDashboard&&(
        <AnalyticsDashboard uid={profile?.uid} profile={profile} cs={cs} lang={lang} onBack={()=>setShowDashboard(false)}/>)}
      {showCoach&&AICoach&&(
        <AICoach profile={profile} sessions={userSessions} calibration={calibData} cs={cs} lang={lang} onClose={()=>setShowCoach(false)}/>)}
      {showGamification&&GamificationPanel&&(
        <GamificationPanel profile={profile} sessions={userSessions} calibration={calibData} cs={cs} lang={lang} onClose={()=>setShowGamification(false)}/>)}
      {showBilling&&BillingModal&&(
        <BillingModal profile={profile} currentPlan={profile?.tier||"standard"} cs={cs} lang={lang}
          onClose={()=>setShowBilling(false)} onSuccess={p=>{setShowBilling(false);toast?.(`Upgraded to ${p}! 🎉`,"success");}}/>)}
      {showAdmin&&AdminDashboard&&(
        <AdminDashboard adminProfile={profile} cs={cs} lang={lang} onBack={()=>setShowAdmin(false)}/>)}
      {showCompanyOnboard&&CompanyOnboarding&&(
        <CompanyOnboarding profile={profile} cs={cs} lang={lang} onComplete={()=>setShowCompanyOnboard(false)}/>)}

      {/* ── TOP NAV ─────────────────────────────────────────────── */}
      <TopNav {...{user,profile,isAr,darkMode,setDarkMode,setLang,isAdmin,isHRAdmin,
        t,cs,lang,NavAvatarDropdown,setPage,setUser,setProfile,logOut,
        "getUserSessions":getUserSessions,"setUserSessions":setUserSessions,
        "getAllUsers":getAllUsers,"setAllUsers":setAllUsers,
        setAcctType,setDevicePref}}/>

      {/* ── CONTENT ─────────────────────────────────────────────── */}
      <div style={{
        maxWidth: isTablet ? 680 : 520,
        margin:"0 auto",
        padding:`${SP[5]}px ${isMobile ? SP[3] : SP[4]}px 0`,
      }}>

        {/* Upgrade prompt */}
        {showUpgrade&&UpgradePrompt&&(
          <UpgradePrompt cs={cs} t={t} reason={upgradeReason}
            onUpgrade={()=>{setShowUpgrade(false);setPage("pricing");}}
            onDismiss={()=>setShowUpgrade(false)}/>)}

        {/* ── Trial banner ───────────────────────────────────────── */}
        {showTrial&&(
          <div className="ds-fade-1" style={{
            background:`${trialCol}0e`, border:`1px solid ${trialCol}30`,
            borderRadius:R.md, padding:`${SP[3]}px ${SP[4]}px`,
            marginBottom:SP[3],
            display:"flex", alignItems:"center", justifyContent:"space-between", gap:8,
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14 }}>{trialDays<=1?"⏰":"⚑"}</span>
              <span style={{ fontSize:TY.sm, fontWeight:TY.semibold, color:trialCol }}>
                {trialDays<=0
                  ?(isAr?"انتهت فترة التجربة":"Trial expired")
                  :`${trialDays} ${isAr?"أيام متبقية":"days left in trial"}`}
              </span>
            </div>
            <button onClick={()=>setPage("pricing")} style={{
              background:trialCol, border:"none", borderRadius:R.xs,
              padding:`${SP[1]+2}px ${SP[3]}px`, fontSize:TY.xs,
              fontWeight:TY.bold, color:"white", cursor:"pointer",
            }}>{isAr?"ترقية →":"Upgrade →"}</button>
          </div>
        )}

        {/* ── GREETING CARD ──────────────────────────────────────── */}
        <div className="ds-fade-1" style={{
          ...COMP.card, padding:`${SP[5]}px`,
          marginBottom:SP[3], position:"relative", overflow:"hidden",
        }}>
          {/* ambient glow */}
          <div style={{ position:"absolute", top:-80, right:-60, width:220, height:220,
            background:`radial-gradient(circle,${C.blue}14,transparent 70%)`,
            pointerEvents:"none" }}/>
          <div style={{ position:"absolute", bottom:-60, left:-40, width:160, height:160,
            background:`radial-gradient(circle,${C.sky}08,transparent 70%)`,
            pointerEvents:"none" }}/>

          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"flex-start", position:"relative", gap:12 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:TY.xs, fontWeight:TY.bold, color:C.muted,
                letterSpacing:TY.widest, textTransform:"uppercase", marginBottom:6 }}>
                {greet}
              </div>
              <div style={{ fontSize:TY.xl, fontWeight:TY.extrabold, color:C.text,
                letterSpacing:TY.tighter, lineHeight:TY.tight, marginBottom:8 }}>
                {firstName?(isAr?`مرحباً، ${firstName}`:firstName):(isAr?"مرحباً 👋":"Welcome back 👋")}
              </div>

              {/* Last session info */}
              {lastSess?(
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%",
                    background:scoreColor(lastScore),
                    boxShadow:`0 0 6px ${scoreColor(lastScore)}` }}/>
                  <span style={{ fontSize:TY.sm, color:C.muted }}>
                    {isAr?"آخر جلسة":"Last session"}{lastTime&&` · ${lastTime}`}
                    {lastScore>0&&` · ${lastScore}/100`}
                  </span>
                </div>
              ):(
                <div style={{ fontSize:TY.sm, color:C.muted, marginBottom:10 }}>
                  {isAr?"ابدأ جلستك الأولى وتتبع وضعيتك 🚀":"Start your first session to track posture 🚀"}
                </div>
              )}

              {/* Tier badge */}
              <Chip label={qualityFor(profile?.tier).label[isAr?"ar":"en"].toUpperCase()}
                color={tm.color} bg={tm.bg} border={tm.border}/>
            </div>

            {/* Score ring — only when data exists */}
            {lastScore>0&&(
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                gap:4, flexShrink:0 }}>
                <ScoreRing score={lastScore} size={72}/>
                <span style={{ fontSize:TY.xs, color:C.muted, fontWeight:TY.medium }}>
                  {scoreGrade(lastScore,isAr)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── START SESSION ──────────────────────────────────────── */}
        <button className="ds-fade-2" onClick={goLive}
          style={{
            width:"100%",
            background:C.gradPrimary,
            border:"none", borderRadius:R.xl,
            padding:`${SP[4]+1}px ${SP[5]}px`,
            display:"flex", alignItems:"center", gap:SP[3],
            cursor:"pointer", marginBottom:SP[3],
            boxShadow:SH.blue,
            transition:"filter .18s, transform .18s",
          }}
          onMouseEnter={e=>{e.currentTarget.style.filter="brightness(1.08)";e.currentTarget.style.transform="translateY(-2px)";}}
          onMouseLeave={e=>{e.currentTarget.style.filter="none";e.currentTarget.style.transform="none";}}>
          <div style={{
            width:48, height:48, borderRadius:R.md+2, flexShrink:0,
            background:"rgba(255,255,255,.15)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:23,
          }}>▶</div>
          <div style={{ textAlign:"left", flex:1 }}>
            <div style={{ fontSize:TY.md, fontWeight:TY.extrabold, color:"white",
              letterSpacing:TY.tighter }}>
              {isAr?"ابدأ جلسة جديدة":"Start New Session"}
            </div>
            <div style={{ fontSize:TY.xs+.5, color:"rgba(255,255,255,.6)", marginTop:2 }}>
              {curMode.charAt(0).toUpperCase()+curMode.slice(1)} mode
              {profile?.calibration?(isAr?" · معاير":" · Calibrated"):""}
            </div>
          </div>
          <span style={{ color:"rgba(255,255,255,.4)", fontSize:20 }}>›</span>
        </button>

        {/* ── MODE SELECTOR ──────────────────────────────────────── */}
        <div className="ds-fade-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
          gap:SP[2], marginBottom:SP[4] }}>
          {[
            {id:"laptop",icon:"💻",en:"Laptop",ar:"لابتوب"},
            {id:"phone", icon:"📱",en:"Phone", ar:"موبايل"},
            {id:"side",  icon:"🪑",en:"Side",  ar:"جانب" },
          ].map(m=>(
            <ModeBtn key={m.id} {...m} label={isAr?m.ar:m.en}
              active={curMode===m.id}
              onClick={id=>{setMode(id);(()=>{try{localStorage.setItem("last_mode",id);}catch(e){}})();}}/>
          ))}
        </div>

        {/* ── STATS ──────────────────────────────────────────────── */}
        <div className="ds-fade-3" style={{ display:"grid",
          gridTemplateColumns: isTablet ? "repeat(6,1fr)" : "1fr 1fr 1fr",
          gap:SP[2], marginBottom:SP[3] }}>
          <StatCard label={isAr?"متوسط النقاط":"AVG SCORE"}
            value={avgAll||"—"} color={avgAll?scoreColor(avgAll):C.muted}
            sub={avgAll?scoreGrade(avgAll,isAr):null}/>
          <StatCard label={isAr?"جلسات الشهر":"SESSIONS"}
            value={sessMonth||userSessions.length||0}
            color={C.sky} sub={isAr?"هذا الشهر":"this month"}/>
          <StatCard label={isAr?"أيام متتالية":"STREAK"}
            value={streak>0?streak:"—"}
            color={C.amber}
            accentIcon={streak>1?"🔥":undefined}
            sub={streak>0?(isAr?"يوم":"days"):null}/>
        </div>

        {/* ── LAST 7 DAYS ────────────────────────────────────────── */}
        {userSessions.length===0&&(
          <ZeroDashboard isAr={isAr} onStart={goLive}/>
        )}
        {userSessions.length>0&&(
          <div className="ds-fade-3" style={{
            ...COMP.card, padding:`${SP[4]}px ${SP[4]}px ${SP[3]}px`,
            marginBottom:SP[3],
          }}>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:SP[3] }}>
              <span style={{ fontSize:TY.sm, fontWeight:TY.bold, color:C.text }}>
                {isAr?"آخر 7 أيام":"Last 7 days"}
              </span>
              {avgAll>0&&(
                <span style={{ fontSize:TY.xs, color:C.muted,
                  background:"rgba(255,255,255,.04)",
                  border:`1px solid ${C.border}`,
                  borderRadius:R.full, padding:`2px ${SP[3]-2}px` }}>
                  Avg {avgAll}/100
                </span>
              )}
            </div>
            <WeekBar days={last7}/>
          </div>
        )}

        {/* ── AI INSIGHT ─────────────────────────────────────────── */}
        {insight&&(
          <div className="ds-fade-3" style={{
            background:C.greenDim, border:`1px solid ${C.greenBorder}`,
            borderRadius:R.md, padding:`${SP[3]}px ${SP[3]+2}px`,
            marginBottom:SP[3], display:"flex", gap:10, alignItems:"flex-start",
          }}>
            <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>💡</span>
            <span style={{ fontSize:TY.sm, color:C.text, lineHeight:TY.normal }}>{insight}</span>
          </div>
        )}

        {/* ── ONBOARDING CHECKLIST ────────────────────────────────── */}
        {showOB&&profile&&(
          <div className="ds-fade-4" style={{
            ...COMP.card, padding:`${SP[3]+1}px ${SP[4]}px`, marginBottom:SP[3],
          }}>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:SP[2]+2 }}>
              <span style={{ fontSize:TY.sm, fontWeight:TY.bold, color:C.text }}>
                {isAr?"خطوات البداية":"Getting started"}
              </span>
              <span style={{ fontSize:TY.xs, color:C.muted }}>{obDone}/3 {isAr?"مكتملة":"done"}</span>
            </div>
            {/* progress bar */}
            <div style={{ height:3, background:C.border, borderRadius:99, marginBottom:SP[3], overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(obDone/3)*100}%`,
                background:C.gradPrimary, borderRadius:99, transition:"width .6s ease" }}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:SP[2] }}>
              {ob.map(s=>(
                <div key={s.id} onClick={()=>!s.ok&&s.action?.()}
                  style={{
                    padding:`${SP[2]+1}px ${SP[2]}px`, borderRadius:R.sm,
                    background:s.ok?C.greenDim:"rgba(255,255,255,.02)",
                    border:`1px solid ${s.ok?C.greenBorder:C.border}`,
                    cursor:s.ok?"default":"pointer", textAlign:"center",
                    transition:TY.base, opacity:s.ok?.7:1,
                  }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{s.ok?"✅":s.icon}</div>
                  <div style={{ fontSize:TY.xs, color:s.ok?"#6ee7b7":C.textSub, lineHeight:1.35 }}>
                    {isAr?s.ar:s.en}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SHORTCUTS ──────────────────────────────────────────── */}
        <div className="ds-fade-4" style={{ display:"grid",
          gridTemplateColumns: isTablet ? "1fr 1fr 1fr 1fr" : "1fr 1fr",
          gap:SP[2+1], marginBottom:SP[3] }}>
          <ShortcutBtn icon="📊" label={isAr?"التحليلات":"Analytics"}
            sub={isAr?"تقرير الوضعية الكامل":"Full posture report"}
            color={C.blue}
            onClick={()=>{getUserSessions(user.uid).then(setUserSessions);setShowDashboard(true);}}/>
          <ShortcutBtn icon="🤖" label={isAr?"مدرب AI":"AI Coach"}
            sub={isAr?"نصائح مخصصة لك":"Personalized tips"}
            color={C.sky}
            onClick={()=>{getUserSessions(user.uid).then(setUserSessions);setShowCoach(true);}}/>
          <ShortcutBtn icon="🏆" label={isAr?"لوحة الصدارة":"Leaderboard"}
            sub={isAr?"تنافس مع الفريق":"Compete with team"}
            color={C.amber}
            onClick={()=>{getAllUsers().then(setAllUsers);setPage("leaderboard");}}/>
          <ShortcutBtn icon="✦" label={isAr?"الإنجازات":"Achievements"}
            sub={isAr?"نقاطك وشاراتك":"Streaks & badges"}
            color={C.purple}
            onClick={()=>{getUserSessions(user.uid).then(setUserSessions);setShowGamification(true);}}/>
        </div>

        {/* ── COMPANY / SETUP CARD ────────────────────────────────── */}
        {companyId?(
          <div className="ds-fade-5" style={{
            ...COMP.card, padding:`${SP[4]}px ${SP[4]}px`,
            marginBottom:SP[3], borderColor:C.blueBorder,
            background:C.blueDim, display:"flex", alignItems:"center",
            justifyContent:"space-between", gap:SP[3],
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:SP[3] }}>
              <div style={{ width:42, height:42, background:C.blueDim,
                borderRadius:R.md, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:20 }}>⬛</div>
              <div>
                <div style={{ fontSize:TY.base, fontWeight:TY.bold, color:C.text }}>
                  {isAr?"مساحة الشركة":"Company Workspace"}
                </div>
                <div style={{ fontSize:TY.xs+.5, color:C.muted, marginTop:2 }}>
                  {isAr?"إدارة الفريق والتقارير":"Team management & reports"}
                </div>
              </div>
            </div>
            <button onClick={()=>setPage("hr")} style={{
              ...COMP.btnSecondary, padding:`${SP[2]}px ${SP[4]}px`,
              whiteSpace:"nowrap", flexShrink:0,
            }}>HR Panel →</button>
          </div>
        ):!["professional","elite"].includes(profile?.tier)&&(
          <div className="ds-fade-5" style={{
            background:`linear-gradient(135deg,${C.blueDim},rgba(8,145,178,.05))`,
            border:`1px solid ${C.blueBorder}`,
            borderRadius:R.xl, padding:`${SP[4]}px ${SP[5]}px`,
            marginBottom:SP[3],
            display:"flex", alignItems:"center", gap:SP[4],
          }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:TY.base, fontWeight:TY.bold, color:C.text, marginBottom:SP[1] }}>
                {isAr?"ارفع مستواك مع Professional":"Unlock Professional"}
              </div>
              <div style={{ fontSize:TY.sm, color:C.muted, lineHeight:TY.normal }}>
                {isAr
                  ?"AI coaching · تقارير HR · 25 موظف · تحليلات متقدمة"
                  :"AI coaching · HR reports · 25 employees · advanced analytics"}
              </div>
            </div>
            <button onClick={()=>setPage("pricing")} style={{
              ...COMP.btnPrimary, padding:`${SP[2]+1}px ${SP[4]}px`,
              whiteSpace:"nowrap", flexShrink:0, fontSize:TY.sm,
            }}>{isAr?"ترقية →":"Upgrade →"}</button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign:"center", padding:`${SP[2]}px 0 ${SP[2]}px`,
          fontSize:TY.xs, color:C.muted }}>
          <a href={`mailto:${SUPPORT_EMAIL}`}
            style={{ color:C.blue, textDecoration:"none" }}>{SUPPORT_EMAIL}</a>
          {ADMIN_PHONE&&<> · <a href={`tel:${ADMIN_PHONE}`}
            style={{ color:C.blue, textDecoration:"none" }}>{ADMIN_PHONE}</a></>}
        </div>
      </div>

      {/* ── ACHIEVEMENT TOAST ──────────────────────────────────── */}
      {achievement && (
        <AchievementToast
          title={achievement.title}
          desc={achievement.desc}
          icon={achievement.icon}
          isAr={isAr}
          onClose={() => setAchievement(null)}
        />
      )}
      {showConfetti && <Confetti count={30} onDone={() => setConfetti(false)}/>}

      {/* ── BOTTOM NAV ──────────────────────────────────────────── */}
      <BottomNav setPage={setPage} startCamera={startCamera}
        setMode={setMode} mode={mode} isAr={isAr}
        companyId={companyId} profile={profile}/>
    </div>
  );
}

// backward-compat for inline export used in App.jsx
export const HOME_SCREEN_JSX = "// use <HomeScreen {...props}/> instead";
