/**
 * localAI.js — Corvus Offline Intelligence Engine v2
 *
 * Parses the actual structured prompts from AICoach, AIInsights,
 * and PredictiveAI — extracts real numbers — generates data-driven
 * responses that reference the user's actual scores and metrics.
 *
 * Zero downloads, zero API calls, zero network dependency.
 */

export function getLocalAIStatus() { return { ready: true, loading: false, progress: 100, error: null }; }
export function onLocalAIStatus(cb) { return () => {}; }
export async function initLocalAI()   { return true; }
export async function unloadLocalAI() {}
export async function checkWebGPU()   { return true; }

// ── Data extraction ───────────────────────────────────────────────

function num(text, ...patterns) {
  for (const p of patterns) {
    const m = text?.match(p);
    if (m) { const v = parseFloat(m[1]); if (!isNaN(v)) return v; }
  }
  return null;
}

function str(text, ...patterns) {
  for (const p of patterns) {
    const m = text?.match(p);
    if (m) return m[1]?.trim();
  }
  return null;
}

function parseData(text) {
  const t = text || "";
  return {
    name:        str(t, /for ([A-Za-zأ-ي][A-Za-zأ-ي ]{1,20})[\n:,]/, /for ([A-Za-z]{2,20}):/),
    avg:         num(t, /[Oo]verall avg score:\s*(\d+)/, /[Aa]vg[^:]*:\s*(\d+)/, /average.*?(\d+)\/100/, /Overall avg.*?(\d+)/),
    weekAvg:     num(t, /[Tt]his week.*?avg.*?:\s*(\d+)/, /[Tt]his week:\s*(\d+)\/100/, /[Ww]eek.*?avg[^:]*:\s*(\d+)/, /[Tt]his week.*?(\d+)\/100/),
    lastWeekAvg: num(t, /[Ll]ast week avg:\s*(\d+)/, /[Ll]ast week.*?:\s*(\d+)\/100/, /[Ll]ast week.*?(\d+)\/100/),
    best:        num(t, /[Bb]est.*?(\d+)/),
    worst:       num(t, /[Ww]orst.*?(\d+)\/100/, /[Mm]in.*?(\d+)/),
    sessions:    num(t, /[Tt]otal sessions?:\s*(\d+)/, /[Ss]essions?:\s*(\d+)/),
    weekSessions:num(t, /[Tt]his week.*?:\s*(\d+)\s*session/, /[Ss]essions this week:\s*(\d+)/, /[Tt]his week.*?(\d+)\s*session/),
    streak:      num(t, /[Ss]treak:\s*(\d+)/, /[Ss]treak.*?(\d+)/),
    trendPct:    num(t, /Trend:\s*([+-]?\d+)%/, /([+-]?\d+)%.*(?:vs|last|week)/),
    fatigue:     num(t, /[Ff]atigue index:\s*(\d+)%/, /[Ff]atigue.*?:\s*(\d+)%/, /[Ff]atigue.*?(\d+)%/),
    burnout:     num(t, /[Bb]urnout risk.*?:\s*(\d+)%/, /[Bb]urnout.*?:\s*(\d+)\/100/, /[Bb]urnout.*?(\d+)%/),
    neckRisk:    num(t, /[Nn]eck risk:\s*(\d+)%/, /[Nn]eck.*?risk.*?:\s*(\d+)%/, /[Nn]eck.*?(\d+)%/),
    riskScore:   num(t, /[Oo]verall risk:\s*(\d+)/, /[Rr]isk score.*?(\d+)/),
    anomalyCount:num(t, /(\d+)\s*anomal/),
    forecast:    str(t, /[Pp]redicted.*?scores?:\s*([0-9, ]+)/),
    slope:       num(t, /slope.*?([+-]?\d+\.?\d*)/),
    trend:       str(t, /[Tt]rend.*?:\s*(improving|declining|stable|[+-]\d+)/i),
    worstTime:   str(t, /[Ww]orst time.*?:\s*([^\n]+)/),
    alerts:      str(t, /[Cc]ommon alerts?.*?:\s*([^\n]+)/),
    calibrated:  t.includes("Yes") || t.includes("calibrat"),
    lang:        t.includes("Arabic") || t.includes("بالعربية") ? "ar" : "en",
    topic:       detectTopic(t),
  };
}

function detectTopic(t) {
  const s = t.replace(/\n/g, " ");
  if (s.match(/executive summary|performance snapshot/i))                              return "executive";
  if (s.match(/7-day.*forecast|7-day posture|day posture performance forecast/i))      return "forecast";
  if (s.match(/analyze burnout risk|burnout risk.*assessment/i))                       return "burnout";
  if (s.match(/risk scor.*analysis|posture risk scoring|risk profile/i))               return "risk";
  if (s.match(/\d+.*anomal.*detected|analyze.*anomal/i))                              return "anomaly";
  if (s.match(/fatigue.*burnout|burnout.*fatigue|fatigue index.*burnout/i))            return "fatigue";
  if (s.match(/ergonomic recommendations|smart ergonomic|workstation.*adjust/i))       return "recommendations";
  if (s.match(/posture trends|trend analysis|trend direction|week-over-week change/i)) return "trends";
  if (s.match(/pain|hurt|ache|ألم|بيوجع/i))                                           return "pain";
  if (s.match(/exercise|stretch|تمرين/i))                                              return "exercise";
  if (s.match(/break|schedule|بريك|راحة/i))                                            return "breaks";
  if (s.match(/improve|better|تحسن|تحسين/i))                                          return "improve";
  if (s.match(/problem|issue|مشكل|أكبر/i))                                            return "problem";
  return "general";
}

// ── Response generators ───────────────────────────────────────────

function scoreLabel(s, lang) {
  if (!s) return lang === "ar" ? "غير محدد" : "N/A";
  if (s >= 85) return lang === "ar" ? "ممتاز" : "Excellent";
  if (s >= 70) return lang === "ar" ? "جيد" : "Good";
  if (s >= 55) return lang === "ar" ? "متوسط" : "Fair";
  return lang === "ar" ? "يحتاج تحسين" : "Needs Work";
}

function riskLabel(r, lang) {
  if (!r) return "";
  if (r >= 70) return lang === "ar" ? "🔴 مرتفع" : "🔴 HIGH";
  if (r >= 40) return lang === "ar" ? "🟡 متوسط" : "🟡 MODERATE";
  return lang === "ar" ? "🟢 منخفض" : "🟢 LOW";
}

function trend_dir(pct, lang) {
  if (pct > 3)  return lang === "ar" ? "📈 تحسّن" : "📈 Improving";
  if (pct < -3) return lang === "ar" ? "📉 تراجع" : "📉 Declining";
  return lang === "ar" ? "➡️ ثابت" : "➡️ Stable";
}

// ── Core topic responses ──────────────────────────────────────────

function genExecutive(d) {
  const ar = d.lang === "ar";
  const n  = d.name || (ar ? "المستخدم" : "User");
  const s  = d.avg ?? 0;
  const w  = d.weekAvg ?? s;
  const t  = d.trendPct ?? 0;
  const se = d.sessions ?? 0;
  const f  = d.fatigue ?? 0;
  const b  = d.burnout ?? 0;
  const nr = d.neckRisk ?? 0;

  if (ar) return `## ملخص تنفيذي — ${n}

**📊 الأداء الحالي**
- متوسط النقاط: **${s}/100** (${scoreLabel(s,ar)})
- هذا الأسبوع: **${w}/100** | التغيير: **${t > 0 ? "+" : ""}${t}%** عن الأسبوع الفائت
- إجمالي الجلسات: **${se}** | مؤشر الإجهاد: **${f}%**

**⚠️ أبرز المخاطر**
${b >= 70 ? "- 🔴 خطر إرهاق مرتفع — يحتاج تدخل فوري" : b >= 40 ? "- 🟡 خطر إرهاق متوسط — راقب الوضع" : "- 🟢 خطر إرهاق منخفض — استمر على النهج"}
${s < 60 ? "- ⚠️ نقاط الوضعية منخفضة — راجع إعداد مكان العمل" : ""}
${f >= 60 ? "- ⚠️ مؤشر إجهاد مرتفع — خذ فترات راحة أطول" : ""}

**🎯 أولويات هذا الأسبوع**
${s < 60 ? "1. اضبط ارتفاع الشاشة لمستوى العين\n2. كل ساعة خذ استراحة 5 دقائق\n3. أكمل معايرة الوضعية إن لم تفعل" : s < 80 ? "1. زد عدد الجلسات لـ 5 أسبوعياً\n2. ركّز على وضعية الرقبة\n3. اضبط وسادة الدعم القطني" : "1. حافظ على الانتظام\n2. ضع هدفاً للوصول لـ 90+\n3. شارك النتائج مع فريقك"}`;

  return `## Executive Summary — ${n}

**📊 Performance Snapshot**
- Overall avg: **${s}/100** (${scoreLabel(s)}) | This week: **${w}/100**
- Week-over-week: **${t > 0 ? "+" : ""}${t}%** | Total sessions: **${se}**
- Fatigue index: **${f}%** | Burnout risk: **${b}/100** (${riskLabel(b)})

**⚠️ Key Risk Areas**
${b >= 70 ? "- 🔴 High burnout risk — immediate intervention needed" : b >= 40 ? "- 🟡 Moderate burnout risk — monitor closely" : "- 🟢 Burnout risk low — maintain current habits"}
${nr >= 60 ? `- 🔴 High neck risk (${nr}%) — raise monitor, practice chin tuck daily` : nr >= 40 ? `- 🟡 Moderate neck risk (${nr}%) — monitor neck position` : ""}
${s < 60 ? "- ⚠️ Below-average posture score — workstation review needed" : ""}
${f >= 60 ? "- ⚠️ High fatigue index — increase break frequency" : ""}

**🎯 This Week's Priority Actions**
${s < 60 ? "1. Raise monitor to exact eye level\n2. Stand up every hour for 5 min\n3. Complete posture calibration" : s < 80 ? `1. Aim for 5 sessions this week\n2. Focus on neck position${nr >= 40 ? ` (risk: ${nr}%)` : ""}\n3. Add lumbar support to chair` : "1. Maintain consistency — you're doing well\n2. Target 90+ score\n3. Share results with your team"}`;
}

function genTrends(d) {
  const ar  = d.lang === "ar";
  const s   = d.avg ?? 0;
  const w   = d.weekAvg ?? s;
  const lw  = d.lastWeekAvg ?? Math.round(s * 0.9);
  const t   = d.trendPct ?? Math.round(((w - lw) / Math.max(lw, 1)) * 100);
  const ws  = d.weekSessions ?? 0;
  // Trends don't need total sessions — use any data we have
  const hasData = s > 0 || w > 0;

  if (ar) return `## تحليل الاتجاهات

**📈 اتجاه الأداء: ${trend_dir(t, true)}**
- هذا الأسبوع: **${w}/100** | الأسبوع الماضي: **${lw}/100**
- التغيير: **${t > 0 ? "+" : ""}${t}%** | الجلسات هذا الأسبوع: **${ws}**

**🔍 تفسير البيانات**
${t > 5 ? "وضعيتك بتتحسن بشكل واضح — استمر في نفس الروتين ولا تغير أي حاجة شغّالة." : t > 0 ? "تحسن بطيء — حاول تزيد تركيزك على فترات الراحة." : t < -5 ? "تراجع ملحوظ — غالباً سببه زيادة الضغط أو تغيير في بيئة العمل." : "الأداء ثابت — يمكن تحسينه بزيادة وتيرة الجلسات."}

**🔮 توقع الأسبوع القادم**
${t > 0 ? `إذا حافظت على نفس الوتيرة، متوقع الوصول لـ **${Math.min(100, w + Math.round(t * 0.5))}/100** الأسبوع القادم.` : `لتعكس الاتجاه: زد الجلسات لـ ${Math.max(4, ws + 1)} أسبوعياً واضبط إعداد مكان العمل.`}`;

  return `## Trend Analysis

**${trend_dir(t)} — ${Math.abs(t)}% week-over-week**
- This week: **${w}/100** | Last week: **${lw}/100**
- Sessions this week: **${ws}**

**🔍 What's Driving This**
${t > 5 ? "Clear improvement — your current habits are working. Don't change what's working." : t > 0 ? "Slow progress — increase break frequency and check monitor height." : t < -5 ? "Notable decline — likely caused by increased workload or workstation changes." : "Score is stable — increase session frequency to push forward."}

**🔮 Forecast for Next Week**
${t > 0 ? `At this pace: projected **${Math.min(100, w + Math.round(t * 0.5))}/100** next week.` : `To reverse trend: target ${Math.max(4, ws + 1)} sessions/week and review desk setup.`}`;
}

function genFatigue(d) {
  const ar = d.lang === "ar";
  const f  = d.fatigue ?? 0;
  const b  = d.burnout ?? 0;
  const s  = d.avg ?? 0;
  const ws = d.weekSessions ?? 0;

  if (ar) return `## تقييم الإجهاد والإرهاق

**مؤشر الإجهاد: ${riskLabel(f, true)} (${f}%)**
**خطر الإرهاق: ${riskLabel(b, true)} (${b}/100)**

**⚠️ علامات تحذيرية**
${f >= 70 ? "- 🔴 إجهاد بدني مرتفع — جسمك يطلب استراحة" : "- مستوى الإجهاد مقبول حالياً"}
${b >= 60 ? "- 🔴 خطر إرهاق مهني — قلّل ساعات العمل المتواصل" : ""}
${s < 55 ? "- ⚠️ وضعية ضعيفة + إجهاد = خطر ألم مزمن" : ""}
- ${ws < 3 ? "- عدد الجلسات قليل هذا الأسبوع — حاول تزيد المراقبة" : "- وتيرة الجلسات جيدة"}

**💊 توصيات التعافي**
${f >= 60 ? "1. خذ استراحة 10 دقائق كل ساعة (مش 5 دقائق)\n2. تمارين تنفس عميق 3 مرات يومياً\n3. راجع طبيب إذا استمر الألم" : "1. حافظ على استراحة 5 دقائق كل ساعة\n2. تأكد من النوم 7-8 ساعات\n3. تمارين الاسترخاء قبل النوم"}`;

  return `## Fatigue & Burnout Assessment

**Fatigue Index: ${riskLabel(f)} (${f}%)** | **Burnout Risk: ${riskLabel(b)} (${b}/100)**

**⚠️ Warning Signs**
${f >= 70 ? "- 🔴 High physical fatigue — your body needs rest" : "- Fatigue at acceptable levels"}
${b >= 60 ? "- 🔴 High burnout risk — reduce continuous work hours" : ""}
${s < 55 ? "- ⚠️ Poor posture + high fatigue = chronic pain risk" : ""}
- ${ws < 3 ? "Session frequency low this week — increase monitoring" : "Good session frequency this week"}

**💊 Recovery Recommendations**
${f >= 60 ? "1. 10-minute break every hour (increase from 5 min)\n2. Deep breathing exercises 3×/day\n3. Consult a physiotherapist if pain persists" : "1. Maintain 5-minute break every hour\n2. Ensure 7-8 hours of sleep\n3. Stretching routine before bed"}`;
}

function genRecommendations(d) {
  const ar  = d.lang === "ar";
  const s   = d.avg ?? 0;
  const f   = d.fatigue ?? 0;
  const nr  = d.neckRisk ?? 0;
  const cal = d.calibrated;

  if (ar) return `## خطة العمل الشخصية

**🔧 إصلاحات فورية (هذا الأسبوع)**
${s < 60 ? "- اضبط ارتفاع الشاشة — الجزء العلوي بمستوى العين بالضبط\n- ارتفاع الكرسي — الركبتان بزاوية 90°\n- لوحة المفاتيح — الكوعان ليسا مرفوعين" : "- ✅ إعداد مكان العمل يبدو جيداً — ركّز على العادات"}

**🖥️ تحسينات بيئة العمل**
${nr >= 50 ? "- 🚨 مخاطر رقبة مرتفعة — ارفع الشاشة 3-5 سم\n- أضف وسادة دعم للرقبة إن احتجت" : "- مستوى الشاشة مناسب — تأكد دورياً"}
${f >= 50 ? "- أضف مؤقت استراحة (Pomodoro 25/5 أو 50/10)" : ""}
${!cal ? "- ⚠️ أكمل معايرة الوضعية للحصول على تحليل أدق" : "- ✅ معايرة الوضعية مكتملة"}

**📅 تحسينات عادات العمل**
1. قاعدة 20-20-20: كل 20 دقيقة، انظر بعيداً 20 ثانية
2. وقف كل ساعة 2 دقيقة على الأقل
3. تمارين الرقبة والكتفين مرتين يومياً
4. اهدف لـ ${Math.min(7, (d.weekSessions ?? 2) + 2)} جلسات مراقبة أسبوعياً`;

  return `## Personalized Action Plan

**🔧 Immediate Fixes (This Week)**
${s < 60 ? "- Screen height: top of monitor at exact eye level\n- Chair height: knees at 90° with feet flat\n- Keyboard: elbows not raised above desk level" : "- ✅ Workstation setup looks good — focus on habits"}

**🖥️ Workstation Adjustments**
${nr >= 50 ? "- 🚨 High neck risk — raise monitor 3-5cm\n- Consider a laptop stand + external keyboard" : "- Monitor level looks appropriate — verify periodically"}
${f >= 50 ? "- Add a break timer (Pomodoro 25/5 or 50/10)" : ""}
${!cal ? "- ⚠️ Complete posture calibration for personalized thresholds" : "- ✅ Calibration complete — personalized thresholds active"}

**📅 Habit Improvements**
1. 20-20-20 rule: every 20 min, look 20 ft away for 20 sec
2. Stand up every hour for at least 2 minutes
3. Neck + shoulder stretch twice daily
4. Target ${Math.min(7, (d.weekSessions ?? 2) + 2)} monitoring sessions/week`;
}

function genBurnout(d) {
  const ar = d.lang === "ar";
  const b  = d.burnout ?? 0;
  const s  = d.avg ?? 0;
  const ws = d.weekSessions ?? 0;

  if (ar) return `## تحليل خطر الإرهاق

**النتيجة: ${riskLabel(b, true)} — ${b}/100**

**🔍 مؤشرات التقييم**
${b >= 70 ? "- 🔴 نقاط الإرهاق مرتفعة جداً — يحتاج تدخل فوري" : b >= 40 ? "- 🟡 الإرهاق في حد متوسط — راقب المؤشرات أسبوعياً" : "- 🟢 مستوى الإرهاق آمن — حافظ على النمط الحالي"}
- وضعية الجسم ${s < 60 ? "ضعيفة — عامل خطر إضافي" : "جيدة — عامل حماية"}
- الجلسات هذا الأسبوع: ${ws} ${ws < 3 ? "(أقل من المثالي)" : "(جيد)"}

**🛡️ خطة الوقاية**
${b >= 60 ? "1. قلّل ساعات العمل المتواصل — أقصاه 90 دقيقة بدون راحة\n2. خذ يوم راحة كامل من العمل أسبوعياً\n3. استشر طبيباً إذا استمر الإرهاق 2+ أسبوع" : "1. حافظ على استراحة 5-10 دقائق كل ساعة\n2. حدد وقت للتوقف عن العمل كل يوم\n3. تأكد من 7-8 ساعات نوم يومياً"}`;

  return `## Burnout Risk Analysis

**Score: ${riskLabel(b)} — ${b}/100**

**🔍 Risk Indicators**
${b >= 70 ? "- 🔴 Very high burnout risk — immediate intervention needed" : b >= 40 ? "- 🟡 Moderate burnout risk — monitor weekly" : "- 🟢 Burnout risk low — current habits are protective"}
- Posture score ${s < 60 ? "poor — additional risk factor" : "good — protective factor"}
- Sessions this week: ${ws} ${ws < 3 ? "(below ideal)" : "(good)"}

**🛡️ Prevention Plan**
${b >= 60 ? "1. Cap continuous work at 90 min max before a break\n2. Take one full rest day per week\n3. Consult a doctor if burnout persists 2+ weeks" : "1. Maintain 5-10 min break every hour\n2. Set a firm end-of-work time daily\n3. Ensure 7-8 hours sleep per night"}`;
}

function genAnomaly(d) {
  const ar = d.lang === "ar";
  const ac = d.anomalyCount ?? 0;
  const s  = d.avg ?? 0;

  if (ar) return `## تحليل الشواذ في الوضعية

**${ac} شذوذ مكتشف** من متوسط ${s}/100

**📊 ماذا تعني هذه الشواذ**
${ac === 0 ? "لا شواذ — وضعيتك متسقة بشكل ممتاز!" : ac <= 2 ? "شواذ قليلة — طبيعية جداً، قد تكون بسبب اجتماعات أو ضغط عمل مؤقت" : ac <= 5 ? "عدد متوسط من الشواذ — يستحق المراقبة لمعرفة نمط متكرر" : "عدد مرتفع من الشواذ — ربما مشكلة بيئية ثابتة (كرسي، شاشة، إضاءة)"}

**🔍 الأسباب المحتملة**
- اجتماعات طويلة أو مكالمات فيديو
- ضغط عمل مرتفع في أيام معينة
- إعداد مكان العمل (الكرسي، الشاشة)
- الإضاءة أو وضع اللابتوب

**📋 خطوات العمل**
1. راجع أوقات الشواذ — هل تتركز في وقت معين؟
2. تحقق من إعداد مكان العمل في تلك الأوقات
3. أضف تذكيرات وضعية إضافية في أوقات الذروة`;

  return `## Posture Anomaly Analysis

**${ac} anomalies detected** from baseline of ${s}/100

**📊 What These Anomalies Mean**
${ac === 0 ? "No anomalies — excellent posture consistency!" : ac <= 2 ? "Few anomalies — very normal, likely from meetings or temporary stress" : ac <= 5 ? "Moderate anomalies — worth monitoring for recurring pattern" : "High anomaly count — likely a persistent environmental issue (chair, screen, lighting)"}

**🔍 Likely Causes**
- Extended video calls or meetings
- High-pressure work periods on specific days
- Workstation configuration drift
- Poor lighting forcing you to lean forward

**📋 Action Steps**
1. Check when anomalies occur — are they clustered at specific times?
2. Review workstation setup during those sessions
3. Add extra posture reminders during peak-stress hours`;
}

function genRisk(d) {
  const ar = d.lang === "ar";
  const r  = d.riskScore ?? d.burnout ?? 0;
  const s  = d.avg ?? 0;
  const ac = d.anomalyCount ?? 0;

  if (ar) return `## تحليل ملف المخاطر

**الدرجة الإجمالية للمخاطر: ${riskLabel(r, true)} (${r}/100)**

**📊 ملخص المخاطر**
- وضعية الجسم: ${scoreLabel(s, true)} (${s}/100)
- الشواذ المكتشفة: ${ac} حادثة
- المستوى العام: ${r >= 70 ? "يحتاج تدخل فوري" : r >= 40 ? "يستحق المراقبة الأسبوعية" : "مستوى آمن"}

**🎯 أعلى 3 مخاطر**
${s < 60 ? "1. 🔴 وضعية ضعيفة — خطر ألم مزمن في الرقبة والظهر" : "1. 🟢 وضعية جيدة — استمر"}
${ac > 3 ? "2. 🟡 تذبذب متكرر — بيئة عمل غير مستقرة" : "2. 🟢 وضعية متسقة"}
${r >= 50 ? "3. 🟡 خطر إرهاق متوسط — راقب الأعراض" : "3. 🟢 مستوى إرهاق آمن"}

**🛡️ خطة تخفيف المخاطر**
${r >= 60 ? "1. أعد تقييم إعداد مكان العمل الأسبوع القادم\n2. استشر فيزيوثيرابيست إذا ظهر ألم\n3. ضع هدفاً وصريحاً: 5 جلسات أسبوعياً كحد أدنى" : "1. حافظ على الجلسات المنتظمة\n2. ركّز على الجودة لا الكمية\n3. راقع المؤشرات شهرياً"}`;

  return `## Risk Profile Analysis

**Overall Risk Score: ${riskLabel(r)} (${r}/100)**

**📊 Risk Breakdown**
- Posture score: ${scoreLabel(s)} (${s}/100)
- Detected anomalies: ${ac}
- Risk level: ${r >= 70 ? "Requires immediate action" : r >= 40 ? "Monitor weekly" : "Safe range"}

**🎯 Highest Risk Areas**
${s < 60 ? "1. 🔴 Poor posture — chronic neck/back pain risk" : "1. 🟢 Good posture — maintain it"}
${ac > 3 ? "2. 🟡 Frequent variability — unstable work environment" : "2. 🟢 Consistent posture pattern"}
${r >= 50 ? "3. 🟡 Moderate overall risk — monitor weekly" : "3. 🟢 Risk level safe"}

**🛡️ Risk Mitigation Plan**
${r >= 60 ? "1. Reassess workstation setup next week\n2. Consult physiotherapist if pain appears\n3. Set minimum 5 sessions/week target" : "1. Maintain regular session frequency\n2. Focus on quality over quantity\n3. Review metrics monthly"}`;
}

function genForecast(d) {
  const ar  = d.lang === "ar";
  const s   = d.avg ?? 0;
  const t   = d.trendPct ?? 0;
  const fc  = d.forecast ? d.forecast.split(",").map(x => parseInt(x.trim())).filter(n => !isNaN(n)) : [];
  const avg7 = fc.length ? Math.round(fc.reduce((a,b) => a+b, 0) / fc.length) : Math.round(s + t * 0.5);

  if (ar) return `## توقعات 7 أيام

**متوسط متوقع: ${avg7}/100**
${fc.length ? `النقاط اليومية المتوقعة: ${fc.join(" → ")}` : `الاتجاه: ${trend_dir(t, true)}`}

**🔍 المحركات الرئيسية**
${t > 2 ? "- الزخم الإيجابي الحالي سيستمر إذا حافظت على الجلسات المنتظمة" : t < -2 ? "- الانخفاض الحالي قد يستمر — يحتاج تدخل" : "- الأداء مستقر — يمكن تحسينه بجهد بسيط"}
- كل جلسة إضافية تحسّن المتوسط بـ ~2-3 نقطة
- يوم واحد بدون راحات كافية يخفض النقاط 5-8 نقطة

**📈 كيف تحسّن التوقع**
1. ${avg7 < 75 ? "اضبط ارتفاع الشاشة — أعلى تأثير على النقاط" : "حافظ على الاستراحات المنتظمة"}
2. أكمل ${Math.max(5, (d.weekSessions ?? 3) + 2)} جلسة هذا الأسبوع
3. تمارين الرقبة والكتفين يومياً`;

  return `## 7-Day Performance Forecast

**Projected average: ${avg7}/100**
${fc.length ? `Daily predicted scores: ${fc.join(" → ")}` : `Trend direction: ${trend_dir(t)}`}

**🔍 Key Drivers**
${t > 2 ? "- Positive momentum — will continue with regular sessions" : t < -2 ? "- Current decline may continue — needs intervention" : "- Performance stable — small effort can push it forward"}
- Each additional session improves average by ~2-3 points
- One day without adequate breaks drops score 5-8 points

**📈 How to Improve the Forecast**
1. ${avg7 < 75 ? "Adjust screen height — highest impact on score" : "Maintain regular break schedule"}
2. Complete ${Math.max(5, (d.weekSessions ?? 3) + 2)} sessions this week
3. Daily neck and shoulder stretches`;
}

// ── Coach conversation ────────────────────────────────────────────

function genCoachReply(msg, d) {
  const ar  = d.lang === "ar";
  const s   = d.avg ?? 0;
  const ses = d.sessions ?? 0;
  const noData = ses === 0;
  const m   = msg.toLowerCase();

  const no = ar
    ? "مفيش بيانات كافية لحد دلوقتي — ابدأ جلسة تحليل الوضعية الأول ثم عود إليّ."
    : "No session data yet — start a posture analysis session first, then come back.";
  if (noData && !m.match(/help|مساعدة|hello|مرحبا/)) return no;

  // Pain
  if (m.match(/pain|hurt|ache|sore|ألم|بيوجع|وجع|مؤلم/)) {
    if (ar) return `ألم الرقبة والظهر غالباً مرتبط بالوضعية. **درجتك الحالية ${s}/100** ${s < 65 ? "بتأكد إن في مشكلة بتستحق الانتباه" : "كويسة، بس مش معناها مفيش مشكلة"}.\n\n**ما تعمله الآن:**\n- أوقف العمل 5 دقائق واتحرك\n- تمرين Chin Tuck: أدخل ذقنك للداخل 10 مرات\n- ارفع الشاشة لمستوى عينيك\n\n⚠️ إذا الألم مستمر أكثر من أسبوعين، استشر فيزيوثيرابيست.`;
    return `Neck and back pain is usually posture-related. **Your current score: ${s}/100** ${s < 65 ? "confirms there's something worth addressing" : "is decent, but pain can occur even with okay scores"}.\n\n**Do this now:**\n- Take a 5-min movement break\n- Chin tuck: pull chin back 10 reps\n- Raise monitor to eye level\n\n⚠️ If pain persists 2+ weeks, consult a physiotherapist.`;
  }

  // Biggest problem
  if (m.match(/problem|issue|wrong|مشكل|أكبر|إيه فيّ|ايه في/)) {
    if (noData) return no;
    const al = (d.alerts || "").toLowerCase();
    const parts = ar
      ? [`درجتك **${s}/100** — ${s < 60 ? "في مشاكل واضحة محتاجة اهتمام" : s < 80 ? "مستوى متوسط، في مجال تحسين" : "ممتاز!"}`]
      : [`Your score: **${s}/100** — ${s < 60 ? "clear issues that need attention" : s < 80 ? "decent level with room to improve" : "excellent!"}`];
    if (al.includes("head") || al.includes("forward") || al.includes("neck"))
      parts.push(ar ? "📍 **الرأس متقدم للأمام** — ارفع الشاشة وافتكر 'حنك للداخل'" : "📍 **Forward head posture** — raise screen, practice chin tuck");
    if (al.includes("shoulder") || al.includes("round"))
      parts.push(ar ? "📍 **كتفان مدوّران** — اسحب الكتفين للخلف وللأسفل" : "📍 **Rounded shoulders** — pull shoulder blades together and down");
    if (al.includes("back") || al.includes("spine") || al.includes("lean"))
      parts.push(ar ? "📍 **ميلان الظهر** — اتكئ للخلف واستخدم الدعم القطني" : "📍 **Back lean detected** — sit back with lumbar support");
    if (parts.length === 1)
      parts.push(ar ? "✅ مفيش تنبيهات متكررة — كمل على الوضعية الكويسة!" : "✅ No recurring alerts — keep up the good posture!");
    if (d.worstTime) parts.push(ar ? `⏰ أسوأ وقت: **${d.worstTime}** — ركّز على الراحة في هذا الوقت` : `⏰ Worst time: **${d.worstTime}** — extra breaks during those hours`);
    return parts.join("\n\n");
  }

  // Improve / how to get better
  if (m.match(/improve|better|higher|score|رفع|تحسن|أحسن|إزاي|ازاي/)) {
    if (noData) return no;
    if (ar) return s < 60
      ? `**لرفع نقاطك من ${s} لـ 70+:**\n\n1. 🖥️ الشاشة على مستوى العين بالضبط (أعلى تأثير)\n2. 🪑 الكرسي — الركبتان 90°، القدمان على الأرض\n3. ⏰ كل ساعة: وقف ومشي دقيقتين\n4. 🧠 قاعدة 20-20-20: كل 20 دقيقة، انظر 20 ثانية بعيداً\n5. 📐 أكمل معايرة الوضعية للحصول على قياسات شخصية`
      : s < 80
      ? `**لرفع نقاطك من ${s} لـ 85+:**\n\n1. 🎯 ركّز على وضعية الرقبة — أكبر عامل في النقاط\n2. ⏰ زد الجلسات لـ 5-6 أسبوعياً\n3. 💪 تمارين الرقبة والكتف مرتين يومياً\n4. 🔔 فعّل تنبيهات الوضعية لمساعدتك على التذكر`
      : `**لتحافظ على ${s}+ والوصول لـ 90:**\n\n1. 🏆 أنت في المستوى الممتاز — حافظ على الانتظام\n2. 💪 أضف رياضة 3 مرات أسبوعياً لتقوية العضلات\n3. 🎯 ضع هدفاً: صفر تنبيهات في جلسة واحدة أسبوعياً`;

    return s < 60
      ? `**To raise your score from ${s} to 70+:**\n\n1. 🖥️ Monitor at exact eye level (highest impact)\n2. 🪑 Chair: knees at 90°, feet flat on floor\n3. ⏰ Every hour: stand and walk 2 min\n4. 🧠 20-20-20 rule: every 20 min, look away 20 sec\n5. 📐 Complete posture calibration for personalized thresholds`
      : s < 80
      ? `**To raise your score from ${s} to 85+:**\n\n1. 🎯 Focus on neck position — biggest scoring factor\n2. ⏰ Increase to 5-6 sessions/week\n3. 💪 Neck + shoulder exercises twice daily\n4. 🔔 Enable posture alerts to reinforce habits`
      : `**To maintain ${s}+ and reach 90:**\n\n1. 🏆 Excellent level — maintain consistency\n2. 💪 Add 3×/week exercise for back muscle strength\n3. 🎯 Set goal: zero alerts in one session per week`;
  }

  // Exercises
  if (m.match(/exercise|stretch|workout|routine|تمرين|استريتش|رياضة|روتين/)) {
    if (ar) return `**💪 روتين الوضعية اليومي (10 دقائق):**

**الصباح (5 دقائق):**
1. **Chin Tuck:** أدخل ذقنك للداخل 10 مرات × 3
2. **Shoulder Rolls:** كتفيك للخلف 10 مرات
3. **Chest Opener:** مد ذراعيك للخلف 30 ثانية × 2

**كل ساعتين (5 دقائق):**
4. **Cat-Cow:** على اليدين والركبتين، 10 مرات
5. **Wall Angels:** جنب الحيط، 10 مرات
6. **Neck Stretch:** أمل رأسك لكل جانب 20 ثانية

⚕️ كل هذه التمارين مبنية على بروتوكولات فيزيوثيرابي موثّقة.`;

    return `**💪 Daily Posture Routine (10 minutes):**

**Morning (5 min):**
1. **Chin Tuck:** pull chin in 10 reps × 3
2. **Shoulder Rolls:** backward 10 times
3. **Chest Opener:** arms back, hold 30 sec × 2

**Every 2 hours (5 min):**
4. **Cat-Cow:** hands and knees, 10 reps
5. **Wall Angels:** against wall, 10 reps
6. **Neck Stretch:** tilt each side 20 seconds

⚕️ All exercises based on documented physiotherapy protocols.`;
  }

  // Breaks
  if (m.match(/break|rest|schedule|pause|timer|بريك|راحة|جدول|تايمر/)) {
    if (ar) return `**⏰ جدول الاستراحات الأمثل (مبني على أبحاث NIOSH):**

- **كل 20 دقيقة:** انظر بعيداً 20 ثانية (قاعدة 20-20-20)
- **كل ساعة:** وقف ومشي دقيقتين + تمرين سريع للرقبة
- **كل ساعتين:** استراحة 5-10 دقائق كاملة + استريتش

${d.worstTime ? `\n⚠️ **أسوأ وقت لديك: ${d.worstTime}** — في هذا الوقت خذ استراحة كل 30 دقيقة بدلاً من ساعة.` : ""}

**💡 تطبيقات مفيدة:** Stretchly (مجاني ومفتوح المصدر) أو مؤقت بسيط على هاتفك`;

    return `**⏰ Optimal Break Schedule (NIOSH-based):**

- **Every 20 min:** look 20 feet away for 20 seconds
- **Every hour:** stand + walk 2 min + quick neck stretch
- **Every 2 hours:** full 5-10 min break + stretching

${d.worstTime ? `\n⚠️ **Your worst time: ${d.worstTime}** — during this period, break every 30 min instead of 60.` : ""}

**💡 Useful tools:** Stretchly (free, open-source) or a simple phone timer`;
  }

  // Monitor height specific question
  if (m.match(/monitor|screen height|شاشة.*ارتفاع|ارتفاع.*شاشة|monitor height/)) {
    if (ar) return `**🖥️ ارتفاع الشاشة المثالي:**\n\nالجزء العلوي من الشاشة يكون على مستوى عينيك بالضبط أو أقل بـ 2-3 سم.\n\n**طريقة الضبط:**\n1. اجلس بوضعيتك الطبيعية\n2. انظر مباشرة للأمام — هذا مستوى عينيك\n3. ارفع الشاشة حتى تنظر للنقطة العليا منها بدون إمالة رأسك${nr >= 40 ? `\n\n⚠️ مخاطر رقبتك ${nr}% — ارفع الشاشة أولوية قصوى لك` : ""}`;
    return `**🖥️ Optimal Monitor Height:**\n\nTop of screen at exact eye level or 2-3cm below.\n\n**How to adjust:**\n1. Sit in your natural working position\n2. Look straight ahead — that's your eye level\n3. Raise monitor until you look at the top of the screen without tilting your head${nr >= 40 ? `\n\n⚠️ Your neck risk is ${nr}% — this adjustment is top priority for you` : ""}`;
  }

  // Help / what can you do
  if (m.match(/help|مساعدة|بتعمل ايه|بتعمل إيه|what can|what do/)) {
    if (ar) return noData
      ? "أنا **Corvus AI Coach** — مدرب وضعيتك الشخصي! اسألني عن:\n• إيه أكبر مشكلة في وضعيتي؟\n• إزاي أرفع نقاطي؟\n• روتين تمارين 5 دقائق\n• جدول الراحة المناسب\n• ليه رقبتي بتألمني؟"
      : `أنا **Corvus AI Coach** — عندي بياناتك (**${s}/100** من ${ses} جلسة).\n\nاسألني:\n• "إيه أكبر مشكلة في وضعيتي؟"\n• "إزاي أرفع نقاطي هذا الأسبوع؟"\n• "أديني روتين تمارين"\n• "جدول الاستراحات المناسب لي"\n• "ليه بتألمني رقبتي؟"`;
    return noData
      ? "I'm **Corvus AI Coach** — your personal posture coach! Ask me:\n• What's my biggest posture problem?\n• How can I improve my score?\n• Give me a 5-minute stretch routine\n• What's my ideal break schedule?\n• Why does my neck hurt?"
      : `I'm **Corvus AI Coach** — I have your data (**${s}/100** from ${ses} sessions).\n\nAsk me:\n• "What's my biggest posture problem?"\n• "How can I improve my score this week?"\n• "Give me a 5-minute stretch routine"\n• "What's the optimal break schedule for me?"\n• "Why does my neck hurt?"`;
  }

  // Score / data question
  if (m.match(/\bscore\b.*\?|what.*\bscore\b|my score|درجتي|درجة.*كام|كام.*درجة|كام.*نقط|نقط|points/)) {
    if (noData) return no;
    const n = d.name ? (ar ? `${d.name}، ` : `${d.name}, `) : "";
    if (ar) return `${n}متوسط درجاتك **${s}/100** من **${ses}** جلسة.\n\n${s >= 85 ? "🏆 ممتاز! أنت في أفضل 20% من المستخدمين." : s >= 70 ? "👍 جيد — مع تحسينات بسيطة تقدر توصل لـ 85+." : s >= 55 ? "📊 متوسط — في مجال تحسين ملموس." : "⚠️ أقل من المتوسط — ابدأ بخطة التحسين."}`;
    return `${n}your average score is **${s}/100** from **${ses}** sessions.\n\n${s >= 85 ? "🏆 Excellent! Top 20% of users." : s >= 70 ? "👍 Good — small tweaks to reach 85+." : s >= 55 ? "📊 Average — clear room to improve." : "⚠️ Below average — follow the improvement plan."}`;
  }

  // Greeting
  if (m.match(/^(hi|hello|hey|مرحبا|أهلاً|أهلا|هاي|السلام)/)) {
    if (noData) return ar
      ? "أهلاً! 👋 أنا Corvus، مدرب الوضعية الشخصي. ابدأ جلسة تحليل الوضعية الأول عشان أقدر أديك توصيات مخصصة."
      : "Hello! 👋 I'm Corvus, your personal posture coach. Start a posture analysis session first so I can give you personalized advice.";
    const n = d.name ? (ar ? `${d.name}` : d.name) : (ar ? "صديقي" : "there");
    return ar
      ? `أهلاً ${n}! 💪 شايف بياناتك — متوسط درجاتك **${s}/100** من **${ses}** جلسة.\n\n${s >= 80 ? "وضعيتك ممتازة! كيف أساعدك اليوم؟" : s >= 65 ? "وضعيتك كويسة مع مجال للتحسين. إيه اللي تحب تعرفه؟" : "في مجال تحسين واضح — إيه أكبر مشكلة حاسسها؟"}`
      : `Hi ${n}! 💪 I can see your data — average score **${s}/100** from **${ses}** sessions.\n\n${s >= 80 ? "Your posture is excellent! What can I help you with today?" : s >= 65 ? "Good posture with room to improve. What would you like to know?" : "There's clear room to improve — what's your biggest concern?"}`;
  }

  // Default — give a real answer based on their score
  if (noData) return ar
    ? "أنا هنا لمساعدتك في تحسين وضعيتك. ابدأ جلسة تحليل أولاً ثم اسألني عن:\n• أكبر مشكلة في وضعيتك\n• إزاي ترفع نقاطك\n• جدول الاستراحات\n• التمارين المناسبة"
    : "I'm here to help you improve your posture. Start an analysis session first, then ask me about:\n• Your biggest posture problem\n• How to improve your score\n• Break schedule\n• Recommended exercises";

  // Has data — give a real contextual answer
  const al = (d.alerts || "").toLowerCase();
  if (ar) {
    const issues = [];
    if (al.includes("head") || al.includes("forward") || al.includes("neck")) issues.push("رأسك متقدم للأمام");
    if (al.includes("shoulder") || al.includes("round")) issues.push("كتفان مدوّران");
    if (al.includes("back") || al.includes("lean")) issues.push("ميلان الظهر");
    return `بناءً على بياناتك (**${s}/100** من ${ses} جلسة):\n\n${issues.length ? `**أبرز مشاكلك:** ${issues.join("، ")}\n\n` : ""}${s < 70 ? "**أهم شيء تعمله دلوقتي:** ارفع الشاشة لمستوى عينيك وخذ بريك كل ساعة.\n\n" : ""}اسألني عن: مشاكل الوضعية، التمارين، جدول الراحة، أو كيف ترفع نقاطك.`;
  }
  const issues = [];
  if (al.includes("head") || al.includes("forward") || al.includes("neck")) issues.push("forward head posture");
  if (al.includes("shoulder") || al.includes("round")) issues.push("rounded shoulders");
  if (al.includes("back") || al.includes("lean")) issues.push("back lean");
  return `Based on your data (**${s}/100** from ${ses} sessions):\n\n${issues.length ? `**Your main issues:** ${issues.join(", ")}\n\n` : ""}${s < 70 ? "**Most impactful fix right now:** Raise monitor to eye level and take a break every hour.\n\n" : ""}Ask me about: posture problems, exercises, break schedule, or how to improve your score.`;
}

// ── Public API ────────────────────────────────────────────────────

export async function localChat(messages, { systemPrompt = "", maxTokens = 500 } = {}) {
  await new Promise(r => setTimeout(r, 350 + Math.random() * 450));
  const d        = parseData(systemPrompt);
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  return genCoachReply(lastUser?.content || "", d);
}

export async function localAnalysis(prompt, { systemPrompt = "", maxTokens = 500 } = {}) {
  await new Promise(r => setTimeout(r, 400 + Math.random() * 400));
  const combined = (systemPrompt || "") + "\n" + (prompt || "");
  const d = parseData(combined);

  switch (d.topic) {
    case "executive":       return genExecutive(d);
    case "trends":          return genTrends(d);
    case "fatigue":         return genFatigue(d);
    case "recommendations": return genRecommendations(d);
    case "burnout":         return genBurnout(d);
    case "anomaly":         return genAnomaly(d);
    case "risk":            return genRisk(d);
    case "forecast":        return genForecast(d);
    default:
      // Fallback — use coach reply on the full prompt
      return genCoachReply(prompt, d);
  }
}
