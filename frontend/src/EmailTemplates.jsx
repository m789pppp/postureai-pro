import React from "react";
/**
 * Corvus — Email Templates v1.0
 * Positioning: "AI Workforce Intelligence Platform"
 * Templates: Welcome · Weekly Report · Risk Alert · Trial Expiry
 * · Manager Summary · Onboarding · Upgrade
 */

// ── HTML email builder ────────────────────────────────────────────
const BASE = (content, lang = "en") => {
  const isAr = lang === "ar";
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${isAr ? "rtl" : "ltr"}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Corvus</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f0f4fb; font-family: 'DM Sans', -apple-system, system-ui, sans-serif; color: #0d1b35; -webkit-font-smoothing: antialiased; }
  .wrapper { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
  .header { background: linear-gradient(135deg, #0c1528 0%, #0f1e36 100%); padding: 28px 36px; }
  .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .logo-mark { width: 34px; height: 34px; background: linear-gradient(135deg,#1a56db,#0891b2); border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #fff; flex-shrink: 0; }
  .logo-name { font-size: 17px; font-weight: 700; color: #fff; letter-spacing: -0.03em; }
  .logo-name span { color: #60a5fa; }
  .logo-tag { font-size: 9px; font-weight: 700; color: #475569; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 2px; }
  .body { padding: 36px; }
  .eyebrow { font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #1a56db; margin-bottom: 12px; }
  h1 { font-size: 26px; font-weight: 700; color: #0d1b35; letter-spacing: -0.025em; line-height: 1.25; margin-bottom: 14px; }
  h2 { font-size: 17px; font-weight: 700; color: #0d1b35; letter-spacing: -0.015em; margin: 28px 0 10px; }
  p { font-size: 14px; color: #334d6e; line-height: 1.75; margin-bottom: 14px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin: 24px 0; }
  .kpi { background: #f0f4fb; border-radius: 10px; padding: 14px; text-align: center; border-top: 3px solid #1a56db; }
  .kpi-val { font-size: 26px; font-weight: 700; color: #1a56db; line-height: 1; margin-bottom: 5px; }
  .kpi-lbl { font-size: 9px; font-weight: 700; color: #7890b0; letter-spacing: 0.08em; text-transform: uppercase; }
  .cta-btn { display: block; background: linear-gradient(135deg,#1a56db,#0891b2); color: #fff; text-align: center; padding: 14px 28px; border-radius: 10px; font-size: 14px; font-weight: 700; text-decoration: none; margin: 28px 0; letter-spacing: -0.01em; }
  .cta-btn-outline { display: block; background: transparent; color: #1a56db; text-align: center; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; margin: 12px 0; border: 1.5px solid #1a56db; }
  .divider { height: 1px; background: #e8eef9; margin: 28px 0; }
  .risk-box { padding: 16px 18px; border-radius: 12px; margin: 16px 0; }
  .risk-high { background: #fff5f5; border: 1px solid #fecaca; }
  .risk-med  { background: #fffbeb; border: 1px solid #fde68a; }
  .risk-low  { background: #ecfdf5; border: 1px solid #6ee7b7; }
  .risk-title { font-size: 12px; font-weight: 700; margin-bottom: 6px; }
  .risk-desc  { font-size: 12px; color: #334d6e; line-height: 1.6; }
  .score-badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; }
  .score-green  { background: #ecfdf5; color: #059669; }
  .score-amber  { background: #fffbeb; color: #d97706; }
  .score-red    { background: #fff5f5; color: #dc2626; }
  .feature-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
  .feature-icon { width: 32px; height: 32px; border-radius: 9px; background: #f0f4fb; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
  .feature-text { flex: 1; }
  .feature-title { font-size: 13px; font-weight: 700; color: #0d1b35; margin-bottom: 2px; }
  .feature-desc  { font-size: 12px; color: #7890b0; line-height: 1.5; }
  .footer { background: #f8faff; border-top: 1px solid #e8eef9; padding: 20px 36px; text-align: center; }
  .footer p { font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.6; }
  .footer a { color: #1a56db; text-decoration: none; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo">
      <div class="logo-mark">◈</div>
      <div>
        <div class="logo-name">Corvus <span>Pro</span></div>
        <div class="logo-tag">${isAr ? "منصة ذكاء القوى العاملة" : "AI Workforce Intelligence Platform"}</div>
      </div>
    </div>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    <p>${isAr ? "بريد الدعم" : "Support"}: <a href="mailto:support@corvus.io">support@corvus.io</a> &nbsp;·&nbsp; <a href="#">${isAr ? "إلغاء الاشتراك" : "Unsubscribe"}</a></p>
    <p style="margin-top:4px">© ${new Date().getFullYear()} Corvus. ${isAr ? "جميع الحقوق محفوظة." : "All rights reserved."}</p>
  </div>
</div>
</body>
</html>`;
};

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE BUILDERS
// ═══════════════════════════════════════════════════════════════════

/**
 * 1. Welcome Email
 */
export function welcomeEmail({ name, tier = "professional", lang = "en" }) {
  const isAr = lang === "ar";
  const firstName = name?.split(" ")[0] || (isAr ? "زميلي" : "there");
  const content = isAr ? `
    <div class="eyebrow">مرحباً بك في Corvus</div>
    <h1>أهلاً ${firstName}، منصة ذكاء القوى العاملة جاهزة 🎉</h1>
    <p>حسابك على <strong>Corvus — منصة ذكاء القوى العاملة بالـ AI</strong> جاهز. لقد انضممت إلى أكثر من 500 شركة تستخدم Corvus لتحويل صحة موظفيها إلى ميزة تنافسية.</p>
    <a href="https://app.corvus.io" class="cta-btn">ابدأ جلستك الأولى ←</a>
    <h2>ما يمكنك فعله الآن:</h2>
    <div class="feature-row"><div class="feature-icon">🧠</div><div class="feature-text"><div class="feature-title">طبقة الذكاء الاصطناعي</div><div class="feature-desc">ملخصات تنفيذية، تحليل إرهاق، وتوصيات مخصصة — مدعومة بـ Claude AI</div></div></div>
    <div class="feature-row"><div class="feature-icon">🔮</div><div class="feature-text"><div class="feature-title">الذكاء التنبؤي</div><div class="feature-desc">التنبؤ بالإرهاق الوظيفي واكتشاف الشذوذات قبل أن تتحول إلى مشاكل</div></div></div>
    <div class="feature-row"><div class="feature-icon">📊</div><div class="feature-text"><div class="feature-title">تقارير تنفيذية</div><div class="feature-desc">تقارير PDF مؤتمتة جاهزة للإدارة العليا ومقارنة الأقسام</div></div></div>
    <div class="feature-row"><div class="feature-icon">💡</div><div class="feature-text"><div class="feature-title">مدرب AI شخصي</div><div class="feature-desc">خطة إرغونومية مخصصة بناءً على بياناتك الفعلية</div></div></div>
    <div class="divider"></div>
    <p style="font-size:12px;color:#94a3b8">خطتك: <strong>${tier}</strong> · تجربة مجانية 7 أيام · بلا بطاقة بنكية مطلوبة</p>
  ` : `
    <div class="eyebrow">Welcome to Corvus</div>
    <h1>Welcome, ${firstName}. Your workforce intelligence is ready. 🎉</h1>
    <p>Your <strong>Corvus — AI Workforce Intelligence Platform</strong> account is active. You've joined 500+ companies using Corvus to turn employee health into a competitive advantage.</p>
    <a href="https://app.corvus.io" class="cta-btn">Start Your First Session →</a>
    <h2>What you can do right now:</h2>
    <div class="feature-row"><div class="feature-icon">🧠</div><div class="feature-text"><div class="feature-title">AI Intelligence Layer</div><div class="feature-desc">Executive summaries, fatigue analysis, and personalised recommendations — powered by Claude AI</div></div></div>
    <div class="feature-row"><div class="feature-icon">🔮</div><div class="feature-text"><div class="feature-title">Predictive Intelligence</div><div class="feature-desc">Burnout prediction and anomaly detection before issues become costly</div></div></div>
    <div class="feature-row"><div class="feature-icon">📊</div><div class="feature-text"><div class="feature-title">Executive Reports</div><div class="feature-desc">Auto-generated PDF reports ready for leadership and department comparisons</div></div></div>
    <div class="feature-row"><div class="feature-icon">💡</div><div class="feature-text"><div class="feature-title">Personal AI Coach</div><div class="feature-desc">A custom ergonomic action plan built from your actual session data</div></div></div>
    <div class="divider"></div>
    <p style="font-size:12px;color:#94a3b8">Your plan: <strong>${tier}</strong> · 7-day free trial · No credit card required</p>
  `;
  return BASE(content, lang);
}

/**
 * 2. Weekly Workforce Intelligence Report
 */
export function weeklyReportEmail({ name, avgScore = 0, sessCount = 0, trendPct = 0, fatigueLevel = 0, topRec = "", lang = "en" }) {
  const isAr = lang === "ar";
  const firstName = name?.split(" ")[0] || (isAr ? "زميلي" : "there");
  const scoreColor = avgScore >= 75 ? "#059669" : avgScore >= 50 ? "#d97706" : "#dc2626";
  const trendLabel = trendPct > 0 ? `+${trendPct}%` : `${trendPct}%`;
  const fatLabel   = fatigueLevel >= 70 ? (isAr ? "مرتفع" : "High") : fatigueLevel >= 45 ? (isAr ? "متوسط" : "Moderate") : (isAr ? "منخفض" : "Low");

  const content = isAr ? `
    <div class="eyebrow">تقرير الذكاء الأسبوعي</div>
    <h1>تقرير صحة القوى العاملة الأسبوعي — ${firstName}</h1>
    <p>إليك ملخص أداء وضعيتك هذا الأسبوع، مدعوم بتحليل Claude AI.</p>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val" style="color:${scoreColor}">${avgScore}</div><div class="kpi-lbl">المتوسط</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#1a56db">${sessCount}</div><div class="kpi-lbl">الجلسات</div></div>
      <div class="kpi"><div class="kpi-val" style="color:${trendPct >= 0 ? "#059669" : "#dc2626"}">${trendLabel}</div><div class="kpi-lbl">الاتجاه</div></div>
    </div>
    ${fatigueLevel >= 45 ? `<div class="risk-box ${fatigueLevel >= 70 ? "risk-high" : "risk-med"}"><div class="risk-title" style="color:${fatigueLevel >= 70 ? "#dc2626" : "#d97706"}">${fatigueLevel >= 70 ? "⚠️ مؤشر إرهاق مرتفع" : "⚡ مؤشر إرهاق متوسط"}</div><div class="risk-desc">مؤشر الإرهاق هذا الأسبوع: ${fatigueLevel}%. ${fatigueLevel >= 70 ? "يُوصى بأخذ استراحات أكثر وتقليل وقت الجلوس." : "راقب وضعيتك واحرص على الاستراحات المنتظمة."}</div></div>` : ""}
    ${topRec ? `<h2>توصية الذكاء الأسبوعية</h2><div class="risk-box risk-low"><div class="risk-desc">💡 ${topRec}</div></div>` : ""}
    <a href="https://app.corvus.io" class="cta-btn">عرض التحليل الكامل ←</a>
    <a href="https://app.corvus.io" class="cta-btn-outline">فتح رؤى الذكاء الاصطناعي</a>
  ` : `
    <div class="eyebrow">Weekly Workforce Intelligence Report</div>
    <h1>Your Weekly Workforce Health Report — ${firstName}</h1>
    <p>Here's your weekly posture performance summary, powered by Claude AI analysis.</p>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val" style="color:${scoreColor}">${avgScore}</div><div class="kpi-lbl">Avg Score</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#1a56db">${sessCount}</div><div class="kpi-lbl">Sessions</div></div>
      <div class="kpi"><div class="kpi-val" style="color:${trendPct >= 0 ? "#059669" : "#dc2626"}">${trendLabel}</div><div class="kpi-lbl">Trend</div></div>
    </div>
    ${fatigueLevel >= 45 ? `<div class="risk-box ${fatigueLevel >= 70 ? "risk-high" : "risk-med"}"><div class="risk-title" style="color:${fatigueLevel >= 70 ? "#dc2626" : "#d97706"}">${fatigueLevel >= 70 ? "⚠️ High Fatigue Index" : "⚡ Moderate Fatigue Index"}</div><div class="risk-desc">Your fatigue index this week: ${fatigueLevel}%. ${fatigueLevel >= 70 ? "We recommend more frequent breaks and reducing continuous sitting time." : "Monitor your posture and maintain regular break intervals."}</div></div>` : ""}
    ${topRec ? `<h2>This Week's AI Recommendation</h2><div class="risk-box risk-low"><div class="risk-desc">💡 ${topRec}</div></div>` : ""}
    <a href="https://app.corvus.io" class="cta-btn">View Full Intelligence Report →</a>
    <a href="https://app.corvus.io" class="cta-btn-outline">Open AI Insights Dashboard</a>
  `;
  return BASE(content, lang);
}

/**
 * 3. Manager / HR Risk Alert
 */
export function riskAlertEmail({ managerName, employeeName, riskType = "burnout", riskScore = 75, deptName = "", lang = "en" }) {
  const isAr = lang === "ar";
  const isHigh = riskScore >= 70;
  const firstName = managerName?.split(" ")[0] || (isAr ? "مدير" : "Manager");

  const riskLabels = {
    burnout: { en: "Burnout Risk", ar: "خطر الإنهاك الوظيفي" },
    posture: { en: "Posture Risk", ar: "خطر الوضعية" },
    fatigue: { en: "Fatigue Risk", ar: "خطر الإرهاق" },
  };
  const riskLabel = riskLabels[riskType]?.[lang] || riskLabels.burnout[lang];

  const content = isAr ? `
    <div class="eyebrow">تنبيه مخاطر القوى العاملة</div>
    <h1>${isHigh ? "⚠️" : "⚡"} تنبيه ${riskLabel} — ${isHigh ? "مستوى مرتفع" : "مستوى متوسط"}</h1>
    <p>مرحباً ${firstName}، رصد نظام الذكاء التنبؤي في Corvus مؤشرات ${riskLabel.toLowerCase()} لدى موظف في ${deptName || "فريقك"}.</p>
    <div class="risk-box ${isHigh ? "risk-high" : "risk-med"}">
      <div class="risk-title" style="color:${isHigh ? "#dc2626" : "#d97706"}">الموظف: ${employeeName || "—"} · نقاط الخطر: ${riskScore}/100</div>
      <div class="risk-desc">رصد الذكاء الاصطناعي أنماطاً تشير إلى ${riskType === "burnout" ? "إنهاك وظيفي محتمل" : riskType === "fatigue" ? "مستويات إرهاق مرتفعة" : "مخاطر وضعية عالية"}. يُنصح بالتدخل خلال 48 ساعة لمنع تطور المشكلة.</div>
    </div>
    <h2>الإجراءات الموصى بها:</h2>
    <div class="feature-row"><div class="feature-icon">💬</div><div class="feature-text"><div class="feature-title">اجتماع فردي</div><div class="feature-desc">جدول اجتماعاً خلال 48 ساعة لمناقشة عبء العمل ومستويات الضغط</div></div></div>
    <div class="feature-row"><div class="feature-icon">🔧</div><div class="feature-text"><div class="feature-title">مراجعة بيئة العمل</div><div class="feature-desc">تحقق من إعدادات مكان العمل والإضاءة والشاشة</div></div></div>
    <div class="feature-row"><div class="feature-icon">📅</div><div class="feature-text"><div class="feature-title">مراجعة عبء العمل</div><div class="feature-desc">قيّم الأولويات وإعادة توزيع المهام إذا لزم الأمر</div></div></div>
    <a href="https://app.corvus.io/hr" class="cta-btn">عرض لوحة صحة القوى العاملة ←</a>
  ` : `
    <div class="eyebrow">Workforce Risk Alert</div>
    <h1>${isHigh ? "⚠️" : "⚡"} ${riskLabel} Alert — ${isHigh ? "High Level" : "Moderate Level"}</h1>
    <p>Hi ${firstName}, Corvus's predictive intelligence has detected ${riskLabel.toLowerCase()} indicators for an employee in ${deptName || "your team"}.</p>
    <div class="risk-box ${isHigh ? "risk-high" : "risk-med"}">
      <div class="risk-title" style="color:${isHigh ? "#dc2626" : "#d97706"}">Employee: ${employeeName || "—"} · Risk score: ${riskScore}/100</div>
      <div class="risk-desc">AI detected patterns indicating ${riskType === "burnout" ? "potential burnout" : riskType === "fatigue" ? "elevated fatigue levels" : "high posture risk"}. Early intervention within 48 hours is recommended to prevent escalation.</div>
    </div>
    <h2>Recommended Actions:</h2>
    <div class="feature-row"><div class="feature-icon">💬</div><div class="feature-text"><div class="feature-title">1:1 Check-in</div><div class="feature-desc">Schedule a conversation within 48 hours to discuss workload and stress levels</div></div></div>
    <div class="feature-row"><div class="feature-icon">🔧</div><div class="feature-text"><div class="feature-title">Workstation Review</div><div class="feature-desc">Verify ergonomic setup — monitor height, lighting, chair position</div></div></div>
    <div class="feature-row"><div class="feature-icon">📅</div><div class="feature-text"><div class="feature-title">Workload Assessment</div><div class="feature-desc">Review current priorities and redistribute tasks if needed</div></div></div>
    <a href="https://app.corvus.io/hr" class="cta-btn">View Workforce Health Dashboard →</a>
  `;
  return BASE(content, lang);
}

/**
 * 4. Trial Expiry / Upgrade Nudge
 */
export function trialExpiryEmail({ name, daysLeft = 2, avgScore = 0, sessCount = 0, lang = "en" }) {
  const isAr = lang === "ar";
  const firstName = name?.split(" ")[0] || (isAr ? "زميلي" : "there");
  const urgent = daysLeft <= 1;

  const content = isAr ? `
    <div class="eyebrow">${urgent ? "⏰ ينتهي اليوم" : `${daysLeft} أيام متبقية`}</div>
    <h1>${urgent ? "تجربتك تنتهي اليوم — لا تفقد ذكاءك!" : `${daysLeft} أيام فقط على انتهاء التجربة`}</h1>
    <p>مرحباً ${firstName}، ${urgent ? "تجربتك المجانية تنتهي اليوم." : `تبقى لك ${daysLeft} أيام في تجربتك المجانية.`} لقد بنيت ${sessCount} جلسة وحققت متوسط ${avgScore}/100 — استمر في تحسّنك بدون انقطاع.</p>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val" style="color:#1a56db">${sessCount}</div><div class="kpi-lbl">الجلسات</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#10b981">${avgScore}/100</div><div class="kpi-lbl">المتوسط</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#f59e0b">${daysLeft}</div><div class="kpi-lbl">أيام متبقية</div></div>
    </div>
    <h2>ماذا ستفقد بعد انتهاء التجربة؟</h2>
    <div class="risk-box risk-high"><div class="risk-desc">❌ طبقة الذكاء الاصطناعي · ❌ الذكاء التنبؤي · ❌ التقارير التنفيذية · ❌ مدرب AI الشخصي · ❌ سجل الجلسات الكامل</div></div>
    <a href="https://app.corvus.io/pricing" class="cta-btn">ترقية الآن واحتفظ ببياناتك ←</a>
    <p style="font-size:12px;color:#94a3b8;text-align:center">شركات Corvus تخفض أيام المرض 31% في المتوسط. عائد الاستثمار يبدأ من الشهر الأول.</p>
  ` : `
    <div class="eyebrow">${urgent ? "⏰ Expires Today" : `${daysLeft} Days Left`}</div>
    <h1>${urgent ? "Your trial ends today — don't lose your intelligence!" : `${daysLeft} days left in your free trial`}</h1>
    <p>Hi ${firstName}, ${urgent ? "your free trial expires today." : `you have ${daysLeft} days left in your free trial.`} You've built ${sessCount} sessions and achieved an average of ${avgScore}/100 — don't lose your momentum.</p>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val" style="color:#1a56db">${sessCount}</div><div class="kpi-lbl">Sessions</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#10b981">${avgScore}/100</div><div class="kpi-lbl">Avg Score</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#f59e0b">${daysLeft}</div><div class="kpi-lbl">Days Left</div></div>
    </div>
    <h2>What you'll lose when your trial ends:</h2>
    <div class="risk-box risk-high"><div class="risk-desc">❌ AI Intelligence Layer · ❌ Predictive analytics · ❌ Executive PDF reports · ❌ Personal AI Coach · ❌ Full session history</div></div>
    <a href="https://app.corvus.io/pricing" class="cta-btn">Upgrade Now & Keep Your Data →</a>
    <p style="font-size:12px;color:#94a3b8;text-align:center">Corvus companies reduce sick days by 31% on average. ROI starts from month one.</p>
  `;
  return BASE(content, lang);
}

/**
 * 5. Onboarding Day 3 — Engagement nudge
 */
export function onboardingNudgeEmail({ name, sessCount = 0, lang = "en" }) {
  const isAr = lang === "ar";
  const firstName = name?.split(" ")[0] || (isAr ? "زميلي" : "there");
  const hasSessions = sessCount > 0;

  const content = isAr ? `
    <div class="eyebrow">اليوم الثالث من رحلتك</div>
    <h1>${hasSessions ? `رائع، ${firstName}! ${sessCount} جلسة وأنت في الطريق الصحيح ✅` : `${firstName}، ذكاؤك في انتظارك 🧠`}</h1>
    <p>${hasSessions
      ? `لقد أكملت ${sessCount} جلسة حتى الآن. اكتمل 3 جلسات لفتح تحليل AI الكامل والتوقعات التنبؤية.`
      : "لم تبدأ جلستك الأولى بعد. خصص 10 دقائق الآن لتكتشف ما يقوله الذكاء الاصطناعي عن وضعيتك."
    }</p>
    <div class="risk-box risk-low">
      <div class="risk-title" style="color:#059669">💡 لماذا الآن؟</div>
      <div class="risk-desc">الشركات التي تستخدم Corvus بانتظام تشهد تراجعاً 31% في أيام المرض وزيادة 22% في إنتاجية الفريق خلال 60 يوماً.</div>
    </div>
    <a href="https://app.corvus.io" class="cta-btn">${hasSessions ? "أكمل ذكاءك الكامل ←" : "ابدأ جلستك الأولى الآن ←"}</a>
  ` : `
    <div class="eyebrow">Day 3 of Your Journey</div>
    <h1>${hasSessions ? `Great start, ${firstName}! ${sessCount} session${sessCount !== 1 ? "s" : ""} in ✅` : `${firstName}, your intelligence is waiting for you 🧠`}</h1>
    <p>${hasSessions
      ? `You've completed ${sessCount} session${sessCount !== 1 ? "s" : ""} so far. Complete 3 sessions to unlock full AI analysis and predictive forecasting.`
      : "You haven't started your first session yet. Spend 10 minutes now to discover what AI says about your posture."
    }</p>
    <div class="risk-box risk-low">
      <div class="risk-title" style="color:#059669">💡 Why now?</div>
      <div class="risk-desc">Organisations that use Corvus consistently see a 31% reduction in sick days and a 22% increase in team productivity within 60 days.</div>
    </div>
    <a href="https://app.corvus.io" class="cta-btn">${hasSessions ? "Unlock Your Full Intelligence →" : "Start Your First Session Now →"}</a>
  `;
  return BASE(content, lang);
}

/**
 * 6. HR Manager Monthly Summary
 */
export function hrMonthlySummaryEmail({ managerName, orgName, teamAvg = 0, teamSize = 0, highRiskCount = 0, sickDayChange = 0, lang = "en" }) {
  const isAr = lang === "ar";
  const firstName = managerName?.split(" ")[0] || (isAr ? "مدير" : "Manager");
  const avgColor  = teamAvg >= 75 ? "#059669" : teamAvg >= 50 ? "#d97706" : "#dc2626";

  const content = isAr ? `
    <div class="eyebrow">تقرير HR الشهري — ${orgName || "مؤسستك"}</div>
    <h1>تقرير صحة القوى العاملة الشهري — ${firstName}</h1>
    <p>إليك ملخص أداء صحة القوى العاملة لشهر ${new Date().toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}, مدعوم بتحليل Claude AI.</p>
    <div class="kpi-grid">
      <div class="kpi" style="border-color:${avgColor}"><div class="kpi-val" style="color:${avgColor}">${teamAvg}/100</div><div class="kpi-lbl">متوسط الفريق</div></div>
      <div class="kpi" style="border-color:#1a56db"><div class="kpi-val" style="color:#1a56db">${teamSize}</div><div class="kpi-lbl">إجمالي الموظفين</div></div>
      <div class="kpi" style="border-color:${highRiskCount > 0 ? "#dc2626" : "#059669"}"><div class="kpi-val" style="color:${highRiskCount > 0 ? "#dc2626" : "#059669"}">${highRiskCount}</div><div class="kpi-lbl">موظفون في المنطقة الحمراء</div></div>
    </div>
    ${sickDayChange !== 0 ? `<div class="risk-box ${sickDayChange < 0 ? "risk-low" : "risk-med"}"><div class="risk-title" style="color:${sickDayChange < 0 ? "#059669" : "#d97706"}">${sickDayChange < 0 ? `📉 تراجع في أيام المرض: ${Math.abs(sickDayChange)}%` : `📈 زيادة في أيام المرض: ${sickDayChange}%`}</div><div class="risk-desc">${sickDayChange < 0 ? "أداء ممتاز! استمر في هذا المستوى من الرقابة." : "يُوصى بمراجعة الأقسام ذات الأداء المنخفض."}</div></div>` : ""}
    ${highRiskCount > 0 ? `<div class="risk-box risk-high"><div class="risk-title" style="color:#dc2626">⚠️ ${highRiskCount} موظف يحتاج اهتماماً فورياً</div><div class="risk-desc">يُنصح بمراجعة تقارير المخاطر الفردية في لوحة HR واتخاذ إجراءات استباقية خلال الأسبوع الجاري.</div></div>` : ""}
    <a href="https://app.corvus.io/hr" class="cta-btn">فتح لوحة صحة القوى العاملة ←</a>
    <a href="https://app.corvus.io/hr/reports" class="cta-btn-outline">تحميل التقرير التنفيذي PDF</a>
  ` : `
    <div class="eyebrow">Monthly HR Report — ${orgName || "Your Organisation"}</div>
    <h1>Monthly Workforce Health Report — ${firstName}</h1>
    <p>Here's your workforce health performance summary for ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}, powered by Claude AI analysis.</p>
    <div class="kpi-grid">
      <div class="kpi" style="border-color:${avgColor}"><div class="kpi-val" style="color:${avgColor}">${teamAvg}/100</div><div class="kpi-lbl">Team Avg</div></div>
      <div class="kpi" style="border-color:#1a56db"><div class="kpi-val" style="color:#1a56db">${teamSize}</div><div class="kpi-lbl">Employees</div></div>
      <div class="kpi" style="border-color:${highRiskCount > 0 ? "#dc2626" : "#059669"}"><div class="kpi-val" style="color:${highRiskCount > 0 ? "#dc2626" : "#059669"}">${highRiskCount}</div><div class="kpi-lbl">In Red Zone</div></div>
    </div>
    ${sickDayChange !== 0 ? `<div class="risk-box ${sickDayChange < 0 ? "risk-low" : "risk-med"}"><div class="risk-title" style="color:${sickDayChange < 0 ? "#059669" : "#d97706"}">${sickDayChange < 0 ? `📉 Sick day reduction: ${Math.abs(sickDayChange)}%` : `📈 Sick day increase: ${sickDayChange}%`}</div><div class="risk-desc">${sickDayChange < 0 ? "Excellent progress. Maintain this monitoring level." : "Department-level review recommended for underperforming teams."}</div></div>` : ""}
    ${highRiskCount > 0 ? `<div class="risk-box risk-high"><div class="risk-title" style="color:#dc2626">⚠️ ${highRiskCount} employee${highRiskCount !== 1 ? "s" : ""} need immediate attention</div><div class="risk-desc">Review individual risk reports in the HR dashboard and take proactive steps this week.</div></div>` : ""}
    <a href="https://app.corvus.io/hr" class="cta-btn">Open Workforce Health Dashboard →</a>
    <a href="https://app.corvus.io/hr/reports" class="cta-btn-outline">Download Executive PDF Report</a>
  `;
  return BASE(content, lang);
}

// ── Preview renderer (for internal use / testing) ─────────────────
export function previewTemplate(name, params = {}) {
  const templates = {
    welcome:         welcomeEmail,
    weeklyReport:    weeklyReportEmail,
    riskAlert:       riskAlertEmail,
    trialExpiry:     trialExpiryEmail,
    onboardingNudge: onboardingNudgeEmail,
    hrMonthlySummary:hrMonthlySummaryEmail,
  };
  return templates[name]?.(params) || "";
}

export const EMAIL_TEMPLATES = [
  { id: "welcome",          name: "Welcome Email",              icon: "👋" },
  { id: "weeklyReport",     name: "Weekly Workforce Report",    icon: "📊" },
  { id: "riskAlert",        name: "Risk Alert (HR)",            icon: "⚠️" },
  { id: "trialExpiry",      name: "Trial Expiry",               icon: "⏰" },
  { id: "onboardingNudge",  name: "Onboarding Day 3 Nudge",     icon: "🚀" },
  { id: "hrMonthlySummary", name: "HR Monthly Summary",         icon: "📋" },
];
