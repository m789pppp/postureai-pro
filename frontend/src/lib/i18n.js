/**
 * Corvus — i18n v5.0
 * Positioning: "AI Workforce Intelligence Platform"
 * All strings updated: productivity · ROI · workforce intelligence
 */

export const translations = {
  en: {
    // ── App meta ──────────────────────────────────────────────────
    appName:      "Corvus",
    tagline:      "AI Workforce Intelligence Platform",
    taglineSub:   "Turn employee health into measurable business ROI",

    // ── Navigation ────────────────────────────────────────────────
    landing:      "Home",
    analysis:     "Intelligence",
    profile:      "Profile",
    settings:     "Settings",
    logout:       "Sign out",
    hrPanel:      "Workforce Hub",
    admin:        "Admin Console",

    // ── Auth ──────────────────────────────────────────────────────
    signIn:       "Sign in",
    signUp:       "Start Free Trial",
    email:        "Work email",
    password:     "Password",
    fullName:     "Full name",
    company:      "Organisation name",
    google:       "Continue with Google",
    haveAccount:  "Already have an account?",
    noAccount:    "New to Corvus?",

    // ── Camera modes ──────────────────────────────────────────────
    laptopMode:   "Desk Setup",
    phoneMode:    "Mobile View",
    sideMode:     "Side Analysis",

    // ── Session / Analysis ────────────────────────────────────────
    startCamera:  "Start Workforce Intelligence Session",
    stopCamera:   "End Session",
    score:        "Wellness Score",
    goodPosture:  "Optimal posture",
    totalTime:    "Session duration",
    alerts:       "Risk alerts",
    analysis_:    "AI Analysis",
    noDetection:  "Position yourself in front of the camera to begin analysis",

    // ── Metrics ───────────────────────────────────────────────────
    neckLean:     "Neck alignment",
    headTilt:     "Head tilt",
    shoulderLvl:  "Shoulder balance",
    spineLean:    "Spinal alignment",
    screenDist:   "Screen distance",
    eyeStrain:    "Eye strain risk",
    rsiRisk:      "RSI risk index",
    fatigueIdx:   "Fatigue index",
    burnoutRisk:  "Burnout risk",
    productivity: "Productivity score",

    // ── Score grades ──────────────────────────────────────────────
    excellent:    "Excellent",
    good:         "Good",
    fair:         "Fair",
    poor:         "Needs attention",

    // ── Plan tiers ────────────────────────────────────────────────
    standard:     "Starter",
    professional: "Growth",
    elite:        "Business",
    enterprise:   "Enterprise",
    free:         "Free",
    freeTrial:    "7-day free trial",

    // ── Dashboard actions ─────────────────────────────────────────
    download:       "Export Wellness Report",
    upgrade:        "Upgrade Plan",
    calibrate:      "Calibrate Workstation",
    dashboard:      "Workforce Analytics",
    coach:          "AI Health Coach",
    progress:       "Performance Hub",
    aiInsights:     "AI Insights",
    predictive:     "Predictive Intelligence",
    reports:        "Executive Reports",

    // ── AI Intelligence Layer ─────────────────────────────────────
    aiLayerTitle:   "AI Intelligence Layer",
    aiLayerSub:     "Executive summaries · Predictive analytics · Workforce reports",
    execSummary:    "Executive Summary",
    trendAnalysis:  "Trend Analysis",
    fatigueAnalysis:"Fatigue & Risk",
    smartRecs:      "Smart Recommendations",
    burnoutPred:    "Burnout Prediction",
    anomalyDet:     "Anomaly Detection",
    riskScoring:    "Risk Scoring",
    forecast7d:     "7-Day Forecast",
    weeklySummary:  "Weekly Summary",
    managerInsights:"Manager Insights",
    deptComparison: "Department Comparison",
    exportPDF:      "Export Executive PDF",

    // ── HR / Workforce ────────────────────────────────────────────
    workforceHealth:  "Workforce Health",
    deptHealth:       "Department Health",
    riskAlerts:       "Risk Alerts",
    employeeWellness: "Employee Wellness",
    sickDayReduction: "Sick Day Reduction",
    roiMetrics:       "ROI Metrics",
    teamEngagement:   "Team Engagement",

    // ── Sound ─────────────────────────────────────────────────────
    soundOn:      "Alerts ON",
    muted:        "Alerts muted",

    // ── Break ─────────────────────────────────────────────────────
    breakTime:    "Wellness break!",
    breakSub:     "Optimal productivity requires a 2-minute movement break",

    // ── PDF ───────────────────────────────────────────────────────
    downloading:  "Generating executive report…",
    downloaded:   "Report exported ✓",

    // ── Errors ────────────────────────────────────────────────────
    cameraErr:    "Camera access required for posture analysis — please allow access in browser settings",
    backendErr:   "Cannot connect to the intelligence server",
    authRequired: "Please sign in to access your workforce intelligence dashboard",
    tierRequired: "Upgrade your plan to unlock this intelligence feature",

    // ── Status ────────────────────────────────────────────────────
    loading:      "Loading intelligence data…",
    saving:       "Saving…",
    saved:        "Saved ✓",
    error:        "Error",
    retry:        "Retry",
    cancel:       "Cancel",
    confirm:      "Confirm",
    close:        "Close",
    back:         "Back",
    next:         "Next",
    skip:         "Skip",
    done:         "Done",
    send:         "Send",
    generating:   "Generating AI analysis…",

    // ── Sessions ──────────────────────────────────────────────────
    scoreHist:    "Performance history",
    aiAnalysis:   "Corvus AI analysis",
    noSessions:   "No sessions yet — start your first intelligence session",

    // ── Onboarding ────────────────────────────────────────────────
    onboardTitle: "Set up your workstation",
    onboard1T:    "Workstation Position",
    onboard1S:    "Position device so your full upper body and head are visible",
    onboard2T:    "Optimal Sitting Posture",
    onboard2S:    "Back straight, chin parallel to floor, feet flat on ground",
    onboard3T:    "Understanding Your Intelligence Score",
    onboard3S:    "85+ Excellent · 70–85 Good · 50–70 Needs work · <50 High risk",

    // ── Profile ───────────────────────────────────────────────────
    profileTitle: "My Wellness Profile",
    profileStats: "Performance Statistics",
    sessionHist:  "Session History",
    avgScore:     "Avg wellness score",
    totalSess:    "Total intelligence sessions",
    planLabel:    "Workforce plan",
    memberSince:  "Member since",
    referralCode: "Referral code",
    copyLink:     "Copy invite link",
    copied:       "Copied!",

    // ── Setup / Account Type ──────────────────────────────────────
    acctType:         "Account Type",
    acctCompany:      "Company",
    acctCompanyDesc:  "Monitor your whole team's workforce health",
    acctPersonal:     "Individual",
    acctPersonalDesc: "Track and improve your own posture & wellness",
    deviceType:       "Your Device",
    deviceLaptop:     "Laptop / Desktop",
    deviceLaptopDesc: "Use your webcam for desk-posture analysis",
    devicePhone:      "Mobile Phone",
    devicePhoneDesc:  "Use your phone camera for on-the-go analysis",
    choosePlan:    "Choose Your Plan",
    monthly:       "Monthly",
    yearly:        "Yearly",
    planActive:    "Current Plan",
    applyCoupon:   "Apply Coupon",
    couponOK:      "Coupon applied ✓",
    couponBad:     "Invalid coupon code",
    continuePay:   "Continue to Payment",
    allPay:        "All payment methods accepted",
    payOK:         "Payment successful ✓",
    payFail:       "Payment failed — please try again",
    backToApp:     "Back to App",
    adminReview:   "Awaiting admin approval",
    waitConfirm:   "Waiting for confirmation…",
    pending:       "Pending",
    ob1:  "Welcome",         ob1d: "Let's set up your profile",
    ob2:  "Your Device",     ob2d: "How will you use Corvus?",
    ob3:  "Your Goals",      ob3d: "What do you want to achieve?",
    ob4:  "All Set!",        ob4d: "You're ready to start tracking",
    save:       "Save",       finish:     "Finish",
    signOut:    "Sign out",   sure:       "Are you sure?",
    tryAgain:   "Try again",  selectAll:  "Select all",
    editProfile:"Edit Profile", exportCSV: "Export CSV",
    leaderboard:"Leaderboard", referral:  "Referral Programme",
    referralDesc:"Share Corvus and earn free months",
    revenue:    "Revenue",    users:      "Users",
    title:      "Title",      desc:       "Description",
    btn:        "Button",     reject:     "Reject",

  },

  ar: {
    // ── App meta ──────────────────────────────────────────────────
    appName:      "Corvus",
    tagline:      "منصة ذكاء القوى العاملة بالـ AI",
    taglineSub:   "حوّل صحة موظفيك إلى عائد استثمار قابل للقياس",

    // ── Navigation ────────────────────────────────────────────────
    landing:      "الرئيسية",
    analysis:     "الذكاء",
    profile:      "الملف الشخصي",
    settings:     "الإعدادات",
    logout:       "تسجيل الخروج",
    hrPanel:      "مركز القوى العاملة",
    admin:        "لوحة الإدارة",

    // ── Auth ──────────────────────────────────────────────────────
    signIn:       "تسجيل الدخول",
    signUp:       "ابدأ التجربة المجانية",
    email:        "البريد المهني",
    password:     "كلمة المرور",
    fullName:     "الاسم الكامل",
    company:      "اسم المؤسسة",
    google:       "المتابعة بـ Google",
    haveAccount:  "لديك حساب بالفعل؟",
    noAccount:    "جديد في Corvus؟",

    // ── Camera modes ──────────────────────────────────────────────
    laptopMode:   "وضع المكتب",
    phoneMode:    "العرض المحمول",
    sideMode:     "التحليل الجانبي",

    // ── Session / Analysis ────────────────────────────────────────
    startCamera:  "بدء جلسة ذكاء القوى العاملة",
    stopCamera:   "إنهاء الجلسة",
    score:        "نقاط الصحة",
    goodPosture:  "وضعية مثالية",
    totalTime:    "مدة الجلسة",
    alerts:       "تنبيهات المخاطر",
    analysis_:    "التحليل الذكي",
    noDetection:  "ضع نفسك أمام الكاميرا لبدء التحليل",

    // ── Metrics ───────────────────────────────────────────────────
    neckLean:     "محاذاة الرقبة",
    headTilt:     "ميل الرأس",
    shoulderLvl:  "توازن الكتفين",
    spineLean:    "محاذاة العمود الفقري",
    screenDist:   "مسافة الشاشة",
    eyeStrain:    "مخاطر إجهاد العين",
    rsiRisk:      "مؤشر خطر RSI",
    fatigueIdx:   "مؤشر الإرهاق",
    burnoutRisk:  "خطر الإنهاك الوظيفي",
    productivity: "نقاط الإنتاجية",

    // ── Score grades ──────────────────────────────────────────────
    excellent:    "ممتاز",
    good:         "جيد",
    fair:         "مقبول",
    poor:         "يحتاج اهتماماً",

    // ── Plan tiers ────────────────────────────────────────────────
    standard:     "ستارتر",
    professional: "جروث",
    elite:        "بيزنس",
    enterprise:   "إنتربرايز",
    free:         "مجاني",
    freeTrial:    "تجربة مجانية 7 أيام",

    // ── Dashboard actions ─────────────────────────────────────────
    download:       "تصدير تقرير الصحة",
    upgrade:        "ترقية الخطة",
    calibrate:      "معايرة مكان العمل",
    dashboard:      "تحليلات القوى العاملة",
    coach:          "مدرب الصحة الذكي",
    progress:       "مركز الأداء",
    aiInsights:     "رؤى الذكاء الاصطناعي",
    predictive:     "الذكاء التنبؤي",
    reports:        "التقارير التنفيذية",

    // ── AI Intelligence Layer ─────────────────────────────────────
    aiLayerTitle:   "طبقة الذكاء الاصطناعي",
    aiLayerSub:     "ملخصات تنفيذية · تحليلات تنبؤية · تقارير القوى العاملة",
    execSummary:    "الملخص التنفيذي",
    trendAnalysis:  "تحليل الاتجاهات",
    fatigueAnalysis:"الإرهاق والمخاطر",
    smartRecs:      "التوصيات الذكية",
    burnoutPred:    "التنبؤ بالإنهاك",
    anomalyDet:     "اكتشاف الشذوذات",
    riskScoring:    "تقييم المخاطر",
    forecast7d:     "توقع 7 أيام",
    weeklySummary:  "الملخص الأسبوعي",
    managerInsights:"رؤى المدير",
    deptComparison: "مقارنة الأقسام",
    exportPDF:      "تصدير PDF تنفيذي",

    // ── HR / Workforce ────────────────────────────────────────────
    workforceHealth:  "صحة القوى العاملة",
    deptHealth:       "صحة الأقسام",
    riskAlerts:       "تنبيهات المخاطر",
    employeeWellness: "صحة الموظفين",
    sickDayReduction: "تراجع أيام المرض",
    roiMetrics:       "مقاييس عائد الاستثمار",
    teamEngagement:   "تفاعل الفريق",

    // ── Sound ─────────────────────────────────────────────────────
    soundOn:      "التنبيهات مفعّلة",
    muted:        "التنبيهات مكتومة",

    // ── Break ─────────────────────────────────────────────────────
    breakTime:    "استراحة صحية!",
    breakSub:     "الإنتاجية المثالية تتطلب استراحة حركة دقيقتين",

    // ── PDF ───────────────────────────────────────────────────────
    downloading:  "جاري إنشاء التقرير التنفيذي…",
    downloaded:   "تم تصدير التقرير ✓",

    // ── Errors ────────────────────────────────────────────────────
    cameraErr:    "مطلوب الوصول للكاميرا لتحليل الوضعية — يرجى السماح في إعدادات المتصفح",
    backendErr:   "لا يمكن الاتصال بخادم الذكاء",
    authRequired: "يرجى تسجيل الدخول للوصول إلى لوحة ذكاء القوى العاملة",
    tierRequired: "قم بترقية خطتك لفتح هذه الميزة الذكية",

    // ── Status ────────────────────────────────────────────────────
    loading:      "جاري تحميل بيانات الذكاء…",
    saving:       "جاري الحفظ…",
    saved:        "تم الحفظ ✓",
    error:        "خطأ",
    retry:        "إعادة المحاولة",
    cancel:       "إلغاء",
    confirm:      "تأكيد",
    close:        "إغلاق",
    back:         "رجوع",
    next:         "التالي",
    skip:         "تخطي",
    done:         "تم",
    send:         "إرسال",
    generating:   "جاري إنشاء التحليل الذكي…",

    // ── Sessions ──────────────────────────────────────────────────
    scoreHist:    "سجل الأداء",
    aiAnalysis:   "تحليل Corvus AI",
    noSessions:   "لا توجد جلسات بعد — ابدأ جلسة الذكاء الأولى",

    // ── Onboarding ────────────────────────────────────────────────
    onboardTitle: "إعداد مكان عملك",
    onboard1T:    "وضعية مكان العمل",
    onboard1S:    "ضع الجهاز بحيث يظهر جسمك العلوي ورأسك بالكامل",
    onboard2T:    "الجلسة الصحيحة المثلى",
    onboard2S:    "ظهر مستقيم، ذقن موازٍ للأرض، قدمان مسطحتان على الأرض",
    onboard3T:    "فهم نقاط الذكاء",
    onboard3S:    "85+ ممتاز · 70-85 جيد · 50-70 يحتاج عمل · أقل من 50 خطر مرتفع",

    // ── Profile ───────────────────────────────────────────────────
    profileTitle: "ملف الصحة الخاص بي",
    profileStats: "إحصائيات الأداء",
    sessionHist:  "سجل الجلسات",
    avgScore:     "متوسط نقاط الصحة",
    totalSess:    "إجمالي جلسات الذكاء",
    planLabel:    "خطة القوى العاملة",
    memberSince:  "عضو منذ",
    referralCode: "كود الإحالة",
    copyLink:     "نسخ رابط الدعوة",
    copied:       "تم النسخ!",
  },
  fr: {
    "app_name":           "Corvus",
    "score":              "Score",
    "session":            "Séance",
    "sessions":           "Séances",
    "analyze":            "Analyser",
    "dashboard":          "Tableau de bord",
    "settings":           "Paramètres",
    "billing":            "Facturation",
    "upgrade":            "Mettre à niveau",
    "sign_in":            "Se connecter",
    "sign_out":           "Se déconnecter",
    "loading":            "Chargement…",
    "save":               "Enregistrer",
    "cancel":             "Annuler",
    "confirm":            "Confirmer",
    "delete":             "Supprimer",
    "team":               "Équipe",
    "analytics":          "Analytique",
    "profile":            "Profil",
    "notifications":      "Notifications",
    "security":           "Sécurité",
    "plan_starter":       "Débutant",
    "plan_professional":  "Professionnel",
    "plan_enterprise":    "Entreprise",
    "posture_good":       "Bonne posture",
    "posture_fair":       "Posture correcte",
    "posture_poor":       "Mauvaise posture",
    "alert_neck":         "Inclinaison du cou",
    "alert_shoulder":     "Déséquilibre des épaules",
    "alert_forward_head": "Tête en avant",
    "alert_body_lean":    "Inclinaison du corps",
    "streak_days":        "jours consécutifs",
    "weekly_avg":         "Moyenne hebdomadaire",
    "start_session":      "Démarrer une séance",
    "end_session":        "Terminer la séance",
    "ai_coach":           "Coach IA",
    "leaderboard":        "Classement",
    "report":             "Rapport",
    "export":             "Exporter",
  },
  de: {
    "app_name":           "Corvus",
    "score":              "Bewertung",
    "session":            "Sitzung",
    "sessions":           "Sitzungen",
    "analyze":            "Analysieren",
    "dashboard":          "Dashboard",
    "settings":           "Einstellungen",
    "billing":            "Abrechnung",
    "upgrade":            "Upgrade",
    "sign_in":            "Anmelden",
    "sign_out":           "Abmelden",
    "loading":            "Lädt…",
    "save":               "Speichern",
    "cancel":             "Abbrechen",
    "confirm":            "Bestätigen",
    "delete":             "Löschen",
    "team":               "Team",
    "analytics":          "Analysen",
    "profile":            "Profil",
    "notifications":      "Benachrichtigungen",
    "security":           "Sicherheit",
    "plan_starter":       "Starter",
    "plan_professional":  "Professionell",
    "plan_enterprise":    "Unternehmen",
    "posture_good":       "Gute Haltung",
    "posture_fair":       "Mittelmäßige Haltung",
    "posture_poor":       "Schlechte Haltung",
    "alert_neck":         "Nackenschräge",
    "alert_shoulder":     "Schulterungleichgewicht",
    "alert_forward_head": "Kopf nach vorne",
    "alert_body_lean":    "Körperneigung",
    "streak_days":        "Tage in Folge",
    "weekly_avg":         "Wochendurchschnitt",
    "start_session":      "Sitzung starten",
    "end_session":        "Sitzung beenden",
    "ai_coach":           "KI-Coach",
    "leaderboard":        "Rangliste",
    "report":             "Bericht",
    "export":             "Exportieren",
  },
};

export function getT(lang = "en") {
  return translations[lang] || translations.en;
}

export function t(lang = "en", key) {
  const dict = translations[lang] || translations.en;
  return dict[key] || translations.en[key] || key;
}
