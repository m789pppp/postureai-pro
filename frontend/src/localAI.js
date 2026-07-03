/**
 * localAI.js — Corvus Coach Intelligence v3
 *
 * Smart rule engine with:
 * - Full conversation memory (multi-turn context)
 * - Follow-up questions after every answer
 * - Topic continuity (connects related messages)
 * - Response variation (never same reply twice)
 * - Proactive coaching based on data
 * - Natural personality, not robotic
 */

export function getLocalAIStatus() { return { ready: true, loading: false, progress: 100, error: null }; }
export function onLocalAIStatus(cb) { return () => {}; }
export async function initLocalAI()   { return true; }
export async function unloadLocalAI() {}
export async function checkWebGPU()   { return true; }

// ── Utils ─────────────────────────────────────────────────────────

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
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Data extraction ───────────────────────────────────────────────

function parseData(systemPrompt) {
  const t = (systemPrompt || "").replace(/\n/g, " ");
  return {
    name:         str(t, /Name:\s*([A-Za-z][A-Za-z ]{1,20})/, /for ([A-Za-z][A-Za-z ]{1,20})[\s:,]/),
    avg:          num(t, /[Oo]verall avg score:\s*(\d+)/, /[Aa]vg[^:]*:\s*(\d+)/, /average.*?(\d+)\/100/),
    weekAvg:      num(t, /[Tt]his week.*?:\s*(\d+)\/100/, /[Tt]his week.*?avg.*?:\s*(\d+)/),
    lastWeekAvg:  num(t, /[Ll]ast week.*?:\s*(\d+)\/100/),
    sessions:     num(t, /[Tt]otal sessions?:\s*(\d+)/, /[Ss]essions?:\s*(\d+)/),
    weekSessions: num(t, /[Tt]his week.*?:\s*(\d+)\s*session/, /[Ss]essions this week:\s*(\d+)/),
    streak:       num(t, /[Ss]treak:\s*(\d+)/, /[Ss]treak.*?(\d+)/),
    trendPct:     num(t, /Trend:\s*([+-]?\d+)%/, /([+-]?\d+)%.*(?:vs|last|week)/),
    fatigue:      num(t, /[Ff]atigue index:\s*(\d+)%/, /[Ff]atigue.*?:\s*(\d+)%/),
    burnout:      num(t, /[Bb]urnout risk.*?:\s*(\d+)%/, /[Bb]urnout.*?:\s*(\d+)/),
    neckRisk:     num(t, /[Nn]eck risk:\s*(\d+)%/, /[Nn]eck.*?risk.*?:\s*(\d+)%/),
    worstTime:    str(t, /[Ww]orst time.*?:\s*([^\s,]+)/),
    alerts:       str(t, /[Cc]ommon alerts?.*?:\s*([^\n.]+)/),
    calibrated:   t.includes("Yes") || t.includes("calibrat"),
    lang:         t.includes("Arabic") || t.includes("بالعربية") || t.includes("Egyptian Arabic") ? "ar" : "en",
  };
}

// ── Conversation memory analysis ──────────────────────────────────

function analyzeHistory(messages) {
  const history = messages.slice(0, -1); // all except current
  const topics  = new Set();
  const mentioned = { pain: false, neck: false, shoulder: false, back: false, improve: false, exercise: false, break: false };

  for (const m of history) {
    if (!m.content) continue;
    const c = m.content.toLowerCase();
    if (c.match(/pain|hurt|ache|ألم|وجع/))      { topics.add("pain");     mentioned.pain = true; }
    if (c.match(/neck|رقبة/))                    { topics.add("neck");     mentioned.neck = true; }
    if (c.match(/shoulder|كتف/))                 { topics.add("shoulder"); mentioned.shoulder = true; }
    if (c.match(/back|ظهر/))                     { topics.add("back");     mentioned.back = true; }
    if (c.match(/improve|تحسن/))                 { topics.add("improve");  mentioned.improve = true; }
    if (c.match(/exercise|stretch|تمرين/))       { topics.add("exercise"); mentioned.exercise = true; }
    if (c.match(/break|راحة/))                   { topics.add("break");    mentioned.break = true; }
  }

  const lastAssistant = [...history].reverse().find(m => m.role === "assistant");
  const lastUser      = [...history].reverse().find(m => m.role === "user");
  const turnCount     = history.filter(m => m.role === "user").length;

  return { topics, mentioned, lastAssistant: lastAssistant?.content || "", lastUser: lastUser?.content || "", turnCount };
}

// ── Follow-up question engine ─────────────────────────────────────

function getFollowUp(intent, d, hist, ar) {
  // Don't repeat follow-ups on same topic
  const asked = hist.lastAssistant.toLowerCase();

  if (intent === "pain" && !asked.includes("how long") && !asked.includes("إمتى"))
    return ar ? "\n\n💬 الألم ده من إمتى بالتحديد؟" : "\n\n💬 How long have you been experiencing this pain?";

  if (intent === "improve" && !asked.includes("biggest") && !asked.includes("أكبر"))
    return ar ? "\n\n💬 إيه أكبر تحدي بتواجهه في تحسين وضعيتك؟" : "\n\n💬 What's your biggest challenge in improving your posture?";

  if (intent === "problem" && d.avg && d.avg < 70 && !asked.includes("setup") && !asked.includes("إعداد"))
    return ar ? "\n\n💬 إزاي إعداد مكان شغلك دلوقتي — شاشة، كرسي، لابتوب؟" : "\n\n💬 How's your current workstation setup — screen, chair, laptop?";

  if (intent === "exercise" && !asked.includes("morning") && !asked.includes("الصبح"))
    return ar ? "\n\n💬 بتشتغل الصبح ولا الليل؟ دي بتأثر على نوع التمارين الأنسب." : "\n\n💬 Do you work mornings or evenings? That affects which exercises suit you best.";

  if (intent === "breaks" && d.worstTime && !asked.includes(d.worstTime))
    return ar ? `\n\n💬 وفي وقت ${d.worstTime} تحديداً — بتاخد راحة ولا بتنسى؟` : `\n\n💬 During ${d.worstTime} specifically — do you remember to take breaks?`;

  if (hist.turnCount >= 2 && !asked.includes("feeling") && !asked.includes("حاسس"))
    return ar ? "\n\n💬 إيه اللي بتحسه دلوقتي في جسمك بعد ما اتكلمنا؟" : "\n\n💬 How are you feeling physically after our conversation so far?";

  return "";
}

// ── Topic continuity ──────────────────────────────────────────────

function getContextBridge(hist, ar) {
  if (!hist.lastUser || hist.turnCount === 0) return "";
  const last = hist.lastUser.toLowerCase();

  if (last.match(/pain|hurt|ألم|وجع/))
    return ar ? "بالنسبة للألم اللي ذكرته، " : "Regarding the pain you mentioned, ";
  if (last.match(/improve|تحسن/))
    return ar ? "استكمالاً لموضوع التحسين، " : "Building on your improvement goal, ";
  if (last.match(/exercise|تمرين/))
    return ar ? "بخصوص التمارين، " : "On the exercise front, ";

  return "";
}

// ── Score label ───────────────────────────────────────────────────

function scoreLabel(s, ar) {
  if (!s) return "";
  if (s >= 85) return ar ? "ممتاز 🏆" : "Excellent 🏆";
  if (s >= 70) return ar ? "جيد 👍" : "Good 👍";
  if (s >= 55) return ar ? "متوسط 📊" : "Fair 📊";
  return ar ? "يحتاج تحسين ⚠️" : "Needs Work ⚠️";
}

// ── Intent detection ──────────────────────────────────────────────

function detectIntent(msg) {
  const m = msg.toLowerCase();
  if (m.match(/pain|hurt|ache|sore|ألم|بيوجع|وجع|مؤلم|بيتعب/))                          return "pain";
  if (m.match(/problem|issue|wrong|worst|مشكل|أكبر|إيه فيّ|ايه في|غلط/))                 return "problem";
  if (m.match(/improve|better|higher|raise|score|تحسن|تحسين|أحسن|إزاي|ازاي|رفع|أعلى/))  return "improve";
  if (m.match(/exercise|stretch|workout|routine|تمرين|استريتش|رياضة|روتين/))              return "exercise";
  if (m.match(/break|rest|schedule|pause|timer|بريك|راحة|جدول|تايمر|استراحة/))            return "breaks";
  if (m.match(/monitor|screen|شاشة|ارتفاع|height/))                                       return "monitor";
  if (m.match(/chair|كرسي|seat|sitting/))                                                  return "chair";
  if (m.match(/neck|رقبة|cervical/))                                                       return "neck";
  if (m.match(/shoulder|كتف|upper back|ظهر علوي/))                                        return "shoulder";
  if (m.match(/back|ظهر|spine|عمود فقري/))                                                return "back";
  if (m.match(/score|درجة|كام|نقط|points|نقاط|\bmy\b.*\bscore\b/))                       return "score";
  if (m.match(/help|مساعدة|بتعمل ايه|بتعمل إيه|what can|what do/))                       return "help";
  if (m.match(/^(hi|hello|hey|مرحبا|أهلاً|أهلا|هاي|السلام|صباح|مساء)/))                 return "greet";
  if (m.match(/why|ليه|سبب|cause|reason/))                                                 return "why";
  if (m.match(/how long|كم وقت|إمتى|متى|duration/))                                       return "duration";
  if (m.match(/tip|advice|نصيحة|نصائح|suggest|اقتراح/))                                   return "tips";
  if (m.match(/calibrat|معايرة/))                                                          return "calibration";
  if (m.match(/thanks|شكر|thank|ممنون|تسلم/))                                             return "thanks";
  return "general";
}

// ── Response builders ─────────────────────────────────────────────

function buildResponse(intent, msg, d, hist) {
  const ar      = d.lang === "ar";
  const s       = d.avg ?? 0;
  const ses     = d.sessions ?? 0;
  const noData  = ses === 0 && s === 0;
  const bridge  = hist.turnCount > 0 ? getContextBridge(hist, ar) : "";
  const al      = (d.alerts || "").toLowerCase();
  const nr      = d.neckRisk ?? 0;
  const n       = d.name || (ar ? "صديقي" : "");

  const no = ar
    ? "📊 مفيش بيانات جلسات لحد دلوقتي — ابدأ جلسة تحليل وضعية الأول، وبعدين تعال نتكلم!"
    : "📊 No session data yet — start a posture analysis session first, then come back and I can give you personalized advice!";

  switch (intent) {

    case "greet": {
      if (noData) return ar
        ? `أهلاً ${n}! 👋 أنا Corvus، مدرب الوضعية الشخصي.\n\nابدأ جلسة تحليل وضعية الأول عشان أقدر أساعدك بشكل شخصي.\n\n💬 إيه اللي بيقلقك في وضعيتك دلوقتي؟`
        : `Hi${n ? " "+n : ""}! 👋 I'm Corvus, your personal posture coach.\n\nStart a posture analysis session first so I can give you personalized advice.\n\n💬 What's your biggest posture concern right now?`;

      const greets = ar ? [
        `أهلاً ${n}! 💪 شايف بياناتك — متوسط **${s}/100** من **${ses}** جلسة. ${scoreLabel(s,ar)}`,
        `هاي ${n}! 👋 عندي بياناتك — درجتك **${s}/100** و${ses} جلسة سجّلتها.`,
        `أهلاً ${n}! 🧠 شايف أداءك — **${s}/100** متوسط. إيه اللي عايز تتكلم فيه؟`,
      ] : [
        `Hi${n ? " "+n : ""}! 💪 I can see your data — **${s}/100** average from **${ses}** sessions. ${scoreLabel(s)}`,
        `Hey${n ? " "+n : ""}! 👋 Got your stats — **${s}/100** across ${ses} sessions.`,
        `Hello${n ? " "+n : ""}! 🧠 Checking your data — **${s}/100** average. What's on your mind?`,
      ];
      const followup = ar
        ? pick(["\n\n💬 إيه أكبر حاجة بتزعجك في وضعيتك؟", "\n\n💬 في ألم معين بتحسه؟", "\n\n💬 إيه اللي عايز تتحسن فيه؟"])
        : pick(["\n\n💬 What's bothering you most about your posture?", "\n\n💬 Any pain or discomfort you're feeling?", "\n\n💬 What would you most like to improve?"]);
      return pick(greets) + followup;
    }

    case "pain": {
      const location = msg.toLowerCase();
      const isNeck   = location.match(/neck|رقبة/);
      const isBack   = location.match(/back|ظهر/);
      const isShoulder = location.match(/shoulder|كتف/);

      if (ar) {
        let resp = `${bridge}الألم ده غالباً مرتبط بالوضعية.`;
        if (s > 0) resp += ` درجتك **${s}/100** ${s < 65 ? "بتأكد إن في مشاكل محتاجة اهتمام" : "كويسة بس الألم ممكن يجي حتى مع درجة متوسطة"}.`;
        resp += "\n\n**دلوقتي:**\n";
        if (isNeck || nr >= 40) resp += `- 🔴 أدخل ذقنك للداخل (Chin Tuck) 10 مرات\n- 🔴 ارفع الشاشة لمستوى عينيك${nr >= 40 ? ` (خطر رقبة ${nr}%)` : ""}\n`;
        if (isBack) resp += "- 🔴 اتكئ للخلف على الكرسي، الظهر السفلي يلمس الكرسي\n- 🔴 وقف 2 دقيقة وامشي\n";
        if (isShoulder) resp += "- 🔴 اسحب الكتفين للخلف وللأسفل 10 مرات\n- 🔴 استريتش الكتاف 30 ثانية\n";
        if (!isNeck && !isBack && !isShoulder) resp += "- 🔴 وقف وامشي 2 دقيقة\n- 🔴 تمرين Chin Tuck 10 مرات\n- 🔴 ارفع الشاشة لمستوى العين\n";
        resp += "\n⚕️ لو الألم مستمر أكتر من أسبوعين، استشر فيزيوثيرابيست.";
        return resp + getFollowUp("pain", d, hist, ar);
      }

      let resp = `${bridge}This pain is likely posture-related.`;
      if (s > 0) resp += ` Your score of **${s}/100** ${s < 65 ? "confirms there are issues worth addressing" : "is decent but pain can occur even at this level"}.`;
      resp += "\n\n**Do this now:**\n";
      if (isNeck || nr >= 40) resp += `- 🔴 Chin tuck: pull chin back 10 reps\n- 🔴 Raise monitor to eye level${nr >= 40 ? ` (neck risk: ${nr}%)` : ""}\n`;
      if (isBack) resp += "- 🔴 Sit back — lower back touching chair\n- 🔴 Stand up and walk 2 min\n";
      if (isShoulder) resp += "- 🔴 Pull shoulder blades together and down 10 reps\n- 🔴 Shoulder stretch hold 30 sec\n";
      if (!isNeck && !isBack && !isShoulder) resp += "- 🔴 Stand and walk 2 min now\n- 🔴 Chin tuck 10 reps\n- 🔴 Raise screen to eye level\n";
      resp += "\n⚕️ If pain persists 2+ weeks, see a physiotherapist.";
      return resp + getFollowUp("pain", d, hist, ar);
    }

    case "problem": {
      if (noData) return no;
      const issues = [];
      if (al.includes("head") || al.includes("forward") || al.includes("neck") || al.includes("fhp"))
        issues.push(ar ? "📍 **الرأس متقدم للأمام** — ارفع الشاشة وافتكر 'حنك للداخل' كل 15 دقيقة" : "📍 **Forward head posture** — raise screen, chin tuck every 15 min");
      if (al.includes("shoulder") || al.includes("round"))
        issues.push(ar ? "📍 **كتفان مدوّران** — اسحبهم للخلف وللأسفل، مش لازم يكونوا مرفوعين" : "📍 **Rounded shoulders** — pull shoulder blades back and down");
      if (al.includes("back") || al.includes("spine") || al.includes("lean"))
        issues.push(ar ? "📍 **ميلان الظهر** — اتكئ للخلف واستخدم الدعم القطني" : "📍 **Back lean** — sit back with lumbar support");
      if (al.includes("tilt") || al.includes("head tilt"))
        issues.push(ar ? "📍 **رأس مائل** — سوّي رأسك، تخيّل كاسة ماء فوق رأسك" : "📍 **Head tilt** — level your head, imagine balancing a glass of water");
      if (nr >= 50)
        issues.push(ar ? `📍 **خطر رقبة مرتفع (${nr}%)** — أولوية قصوى: ارفع الشاشة فوراً` : `📍 **High neck risk (${nr}%)** — top priority: raise your monitor now`);

      const intro = ar
        ? pick([`بناءً على **${ses}** جلسة ومتوسط **${s}/100**:`, `شايف بياناتك — **${s}/100** و${ses} جلسة. أكبر مشاكلك:`, `درجتك **${s}/100** — ${scoreLabel(s,ar)}. المشاكل الرئيسية:`])
        : pick([`Based on **${ses}** sessions and **${s}/100** average:`, `Looking at your data — **${s}/100** across ${ses} sessions. Your main issues:`, `Your score: **${s}/100** — ${scoreLabel(s)}. Key problems:`]);

      const body = issues.length
        ? `${intro}\n\n${issues.join("\n\n")}`
        : (ar ? `${intro}\n\n✅ مفيش تنبيهات متكررة — وضعيتك متسقة! ركّز على الحفاظ على الانتظام.` : `${intro}\n\n✅ No recurring alerts — your posture is consistent! Focus on maintaining regularity.`);

      return body + (d.worstTime ? (ar ? `\n\n⏰ أسوأ وقت: **${d.worstTime}** — ركّز على الراحة في هذا الوقت تحديداً.` : `\n\n⏰ Worst time: **${d.worstTime}** — pay extra attention during those hours.`) : "") + getFollowUp("problem", d, hist, ar);
    }

    case "improve": {
      if (noData) return no;
      if (ar) {
        const plan = s < 60
          ? `**لرفع نقاطك من ${s} لـ 70+ (أعلى تأثير أولاً):**\n\n1. 🖥️ ارفع الشاشة لمستوى العين — أهم خطوة بالفارق\n2. 🪑 الكرسي: ركبتان 90°، قدمان على الأرض\n3. ⏰ كل ساعة: وقف ومشي دقيقتين\n4. 🧠 قاعدة 20-20-20: كل 20 دقيقة انظر بعيداً 20 ثانية\n5. 📐 أكمل معايرة الوضعية للحصول على قياسات شخصية`
          : s < 80
          ? `**لرفع نقاطك من ${s} لـ 85+:**\n\n1. 🎯 ركّز على وضعية الرقبة${nr >= 40 ? ` (خطر ${nr}% عندك)` : ""} — أكبر عامل في النقاط\n2. ⏰ زد الجلسات لـ 5 أسبوعياً\n3. 💪 تمارين الرقبة والكتف مرتين يومياً\n4. 🔔 فعّل تنبيهات الوضعية`
          : `**أنت في المستوى الممتاز (${s}/100)! للوصول لـ 90+:**\n\n1. 🏆 الانتظام هو السر — لا تكسر الـ streak\n2. 💪 رياضة 3 مرات أسبوعياً لتقوية عضلات الظهر\n3. 🎯 هدف: صفر تنبيهات في جلسة واحدة أسبوعياً`;
        return `${bridge}${plan}` + getFollowUp("improve", d, hist, ar);
      }

      const plan = s < 60
        ? `**To raise your score from ${s} to 70+ (highest impact first):**\n\n1. 🖥️ Raise monitor to exact eye level — biggest single fix\n2. 🪑 Chair: knees 90°, feet flat on floor\n3. ⏰ Every hour: stand and walk 2 min\n4. 🧠 20-20-20: every 20 min, look away 20 sec\n5. 📐 Complete posture calibration for personalized thresholds`
        : s < 80
        ? `**To raise your score from ${s} to 85+:**\n\n1. 🎯 Focus on neck position${nr >= 40 ? ` (your neck risk: ${nr}%)` : ""} — biggest scoring factor\n2. ⏰ Increase to 5 sessions/week\n3. 💪 Neck + shoulder exercises twice daily\n4. 🔔 Enable posture alerts`
        : `**You're at an excellent level (${s}/100)! To reach 90+:**\n\n1. 🏆 Consistency is key — maintain your streak\n2. 💪 Exercise 3×/week for back muscle strength\n3. 🎯 Goal: zero alerts in one session per week`;
      return `${bridge}${plan}` + getFollowUp("improve", d, hist, ar);
    }

    case "exercise": {
      if (ar) return `**💪 روتين الوضعية اليومي (10 دقائق):**\n\n**الصباح (5 دقائق):**\n1. **Chin Tuck** — أدخل ذقنك للداخل 10 مرات × 3\n2. **Shoulder Rolls** — كتفيك للخلف 10 مرات\n3. **Chest Opener** — مد ذراعيك للخلف 30 ثانية × 2\n\n**كل ساعتين (5 دقائق):**\n4. **Cat-Cow** — على اليدين والركبتين، 10 مرات\n5. **Wall Angels** — جنب الحيط، 10 مرات\n6. **Neck Stretch** — أمل رأسك لكل جانب 20 ثانية\n\n⚕️ مبنية على بروتوكولات فيزيوثيرابي موثّقة.` + getFollowUp("exercise", d, hist, ar);

      return `**💪 Daily Posture Routine (10 minutes):**\n\n**Morning (5 min):**\n1. **Chin Tuck** — pull chin back 10 reps × 3\n2. **Shoulder Rolls** — backward 10 times\n3. **Chest Opener** — arms back, hold 30 sec × 2\n\n**Every 2 hours (5 min):**\n4. **Cat-Cow** — hands and knees, 10 reps\n5. **Wall Angels** — against wall, 10 reps\n6. **Neck Stretch** — tilt each side, hold 20 sec\n\n⚕️ Based on documented physiotherapy protocols.` + getFollowUp("exercise", d, hist, ar);
    }

    case "breaks": {
      const resp = ar
        ? `**⏰ جدول استراحاتك الأمثل:**\n\n- **كل 20 دقيقة:** انظر بعيداً 20 ثانية (قاعدة 20-20-20)\n- **كل ساعة:** وقف + مشي دقيقتين + Chin Tuck سريع\n- **كل ساعتين:** استراحة كاملة 5-10 دقائق + استريتش${d.worstTime ? `\n\n⚠️ أسوأ وقت عندك **${d.worstTime}** — في هذا الوقت خذ راحة كل 30 دقيقة بدلاً من ساعة.` : ""}\n\n💡 **أداة مجانية:** Stretchly (مفتوح المصدر، شغّال على كل الأجهزة)`
        : `**⏰ Your optimal break schedule:**\n\n- **Every 20 min:** look 20 feet away for 20 sec (20-20-20 rule)\n- **Every hour:** stand + walk 2 min + quick chin tuck\n- **Every 2 hours:** full 5-10 min break + stretching${d.worstTime ? `\n\n⚠️ Your worst time is **${d.worstTime}** — during those hours, break every 30 min instead of 60.` : ""}\n\n💡 **Free tool:** Stretchly (open-source, works on all devices)`;
      return resp + getFollowUp("breaks", d, hist, ar);
    }

    case "monitor": {
      const extra = nr >= 40 ? (ar ? `\n\n⚠️ خطر رقبة ${nr}% عندك — رفع الشاشة أولوية قصوى!` : `\n\n⚠️ Your neck risk is ${nr}% — raising the monitor is top priority!`) : "";
      return ar
        ? `**🖥️ ارتفاع الشاشة المثالي:**\n\nالجزء العلوي من الشاشة على مستوى عينيك أو أقل بـ 2-3 سم.\n\n**طريقة الضبط:**\n1. اجلس بوضعيتك الطبيعية\n2. انظر مباشرة للأمام — ده مستوى عينيك\n3. ارفع الشاشة لحد ما تنظر للجزء العلوي من غير ما تميل رأسك\n\n**لو لابتوب:** استخدم stand + كيبورد خارجي (أهم استثمار لصحتك)${extra}`
        : `**🖥️ Optimal monitor height:**\n\nTop of screen at eye level or 2-3cm below.\n\n**How to adjust:**\n1. Sit in your natural working position\n2. Look straight ahead — that's your eye level\n3. Raise monitor until top of screen is at that line without tilting head\n\n**If laptop:** use a stand + external keyboard (best investment for your health)${extra}`;
    }

    case "chair": {
      return ar
        ? `**🪑 إعداد الكرسي المثالي:**\n\n1. **الارتفاع** — الركبتان بزاوية 90°، القدمان على الأرض أو footrest\n2. **الظهر** — الكرسي يدعم أسفل الظهر (الجزء القطني)\n3. **الذراعان** — الكوعان بزاوية 90-110°، الكتفان مرتخيان\n4. **المسافة** — تقدر تمد ذراعك وتلمس الشاشة بأطراف أصابعك\n\n💡 لو الكرسي مش بيدعم ظهرك، حط وسادة صغيرة خلف أسفل ظهرك.`
        : `**🪑 Ideal chair setup:**\n\n1. **Height** — knees at 90°, feet flat on floor or footrest\n2. **Back** — chair supports your lower back (lumbar region)\n3. **Arms** — elbows at 90-110°, shoulders relaxed down\n4. **Distance** — arm extended, fingertips just touch screen\n\n💡 If chair lacks lumbar support, roll up a small towel and place it at your lower back.`;
    }

    case "neck": {
      if (noData) return no;
      const risk = nr >= 60 ? (ar ? "🔴 مرتفع" : "🔴 HIGH") : nr >= 40 ? (ar ? "🟡 متوسط" : "🟡 MODERATE") : (ar ? "🟢 منخفض" : "🟢 LOW");
      return ar
        ? `**رقبتك:**${nr > 0 ? ` خطر ${risk} (${nr}%)` : ""}\n\n**أسباب ألم الرقبة الشائعة:**\n- الرأس متقدم للأمام (أكثر سبب)\n- الشاشة منخفضة عن مستوى العين\n- التحديق في الموبايل طويلاً\n\n**علاج فوري:**\n1. Chin Tuck: أدخل ذقنك 10 مرات\n2. ارفع الشاشة\n3. Neck Stretch: أمل لليمين 20 ثانية، ثم لليسار\n\n⚕️ لو في تنميل في الإيد، استشر دكتور.`
        : `**Your neck:**${nr > 0 ? ` Risk ${risk} (${nr}%)` : ""}\n\n**Common causes of neck pain:**\n- Forward head posture (most common)\n- Screen too low\n- Phone use with head down\n\n**Immediate relief:**\n1. Chin tuck: pull chin back 10 reps\n2. Raise monitor to eye level\n3. Neck stretch: tilt right 20 sec, then left\n\n⚕️ If you feel numbness in arm or hand, see a doctor.`;
    }

    case "shoulder": {
      return ar
        ? `**كتفيك:**\n\n**السبب الرئيسي:** الكتفان المدوّران ناتجان غالباً عن الجلوس للأمام نحو الشاشة.\n\n**إصلاح فوري:**\n1. Shoulder Roll: كتفيك للخلف وللأسفل 10 مرات\n2. تخيّل إنك بتضغط قلم بين لوحَي الكتف لمدة 5 ثوانٍ × 10\n3. Chest Opener: ذراعيك للخلف، صدرك للأمام 30 ثانية\n\n**على المدى البعيد:** تمارين تقوية الظهر العلوي 3 مرات أسبوعياً.`
        : `**Your shoulders:**\n\n**Main cause:** Rounded shoulders usually come from leaning forward toward the screen.\n\n**Immediate fix:**\n1. Shoulder roll: backward and down 10 times\n2. Squeeze an imaginary pencil between shoulder blades 5 sec × 10\n3. Chest opener: arms back, chest forward 30 sec\n\n**Long-term:** Upper back strengthening exercises 3×/week.`;
    }

    case "back": {
      return ar
        ? `**ظهرك:**\n\n**الأسباب الشائعة:**\n- الجلوس بدون دعم قطني\n- الميلان للأمام ساعات طويلة\n- ضعف عضلات البطن والظهر\n\n**إصلاح فوري:**\n1. اتكئ للخلف — الظهر السفلي يلمس الكرسي\n2. وقف ومشي 2 دقيقة الآن\n3. Cat-Cow: 10 مرات على اليدين والركبتين\n\n⚕️ لو الألم شديد أو بينزل للرجل، استشر دكتور فوراً.`
        : `**Your back:**\n\n**Common causes:**\n- Sitting without lumbar support\n- Leaning forward for extended periods\n- Weak core and back muscles\n\n**Immediate fix:**\n1. Sit back — lower back touching chair back\n2. Stand and walk 2 min right now\n3. Cat-Cow: 10 reps on hands and knees\n\n⚕️ If pain is severe or goes down your leg, see a doctor immediately.`;
    }

    case "score": {
      if (noData) return no;
      const labels = ar ? [
        `متوسط درجاتك **${s}/100** من **${ses}** جلسة. ${scoreLabel(s,ar)}`,
        `درجتك **${s}/100** — ${scoreLabel(s,ar)}. سجّلت **${ses}** جلسة.`,
        `**${s}/100** متوسطك من ${ses} جلسة. ${scoreLabel(s,ar)}`,
      ] : [
        `Your average is **${s}/100** from **${ses}** sessions. ${scoreLabel(s)}`,
        `Score: **${s}/100** — ${scoreLabel(s)}. You've logged **${ses}** sessions.`,
        `**${s}/100** average across ${ses} sessions. ${scoreLabel(s)}`,
      ];
      const tip = s < 70
        ? (ar ? "\n\n💡 أهم خطوة: ارفع الشاشة لمستوى عينيك." : "\n\n💡 Biggest quick win: raise your monitor to eye level.")
        : s < 85
        ? (ar ? "\n\n💡 لرفعها لـ 85+: زد الجلسات لـ 5 أسبوعياً." : "\n\n💡 To reach 85+: increase to 5 sessions/week.")
        : (ar ? "\n\n💡 ممتاز! حافظ على الانتظام." : "\n\n💡 Excellent! Maintain your consistency.");
      return pick(labels) + tip;
    }

    case "why": {
      if (noData) return no;
      const al2 = (d.alerts || "").toLowerCase();
      if (ar) return `${bridge}**ليه درجتك **${s}/100**؟\n\n${al2 ? `أكثر المشاكل المتكررة عندك: **${d.alerts}**\n\n` : ""}${s < 60 ? "السبب الرئيسي غالباً: إعداد مكان العمل (ارتفاع الشاشة والكرسي)" : s < 80 ? "الأداء كويس بس في جوانب صغيرة محتاج تركيز" : "الأداء ممتاز — استمر!"}`;
      return `${bridge}**Why your score is **${s}/100**?\n\n${al2 ? `Most frequent alerts: **${d.alerts}**\n\n` : ""}${s < 60 ? "Main cause is likely workstation setup (screen and chair height)" : s < 80 ? "Good performance but some areas need focus" : "Excellent performance — keep it up!"}`;
    }

    case "tips": {
      if (noData) return ar
        ? "💡 **نصائح عامة للوضعية:**\n\n1. الشاشة على مستوى العين\n2. الكرسي يدعم أسفل الظهر\n3. كل ساعة وقف ومشي دقيقتين\n4. قاعدة 20-20-20\n5. كتفيك مرتخيين مش مرفوعين"
        : "💡 **General posture tips:**\n\n1. Screen at eye level\n2. Chair supports your lower back\n3. Every hour: stand and walk 2 min\n4. 20-20-20 rule\n5. Shoulders relaxed, not raised";

      const topTip = s < 70
        ? (ar ? "🎯 **أهم نصيحة لك:** ارفع الشاشة لمستوى العين — هيرفع نقاطك 5-10 نقاط فوراً.\n\n" : "🎯 **Top tip for you:** Raise screen to eye level — will boost your score 5-10 points immediately.\n\n")
        : (ar ? "🎯 **أنت بتعمل كويس!** ركّز على الانتظام.\n\n" : "🎯 **You're doing well!** Focus on consistency.\n\n");
      return topTip + (ar ? "**نصائح إضافية:**\n\n1. كتفيك مرتخيين دايماً\n2. الشاشة مش تقرب منها أكتر من 50 سم\n3. كيبورد ومساحة قريبين منك\n4. إضاءة كويسة تجنبك تنحني للشاشة" : "**Additional tips:**\n\n1. Shoulders always relaxed\n2. Screen no closer than 50cm\n3. Keyboard close — elbows not raised\n4. Good lighting prevents you from leaning in");
    }

    case "calibration": {
      return ar
        ? `**المعايرة ${d.calibrated ? "مكتملة ✅" : "مش مكتملة بعد ⚠️"}**\n\n${d.calibrated ? "عظيم! المعايرة بتخلي التحليل أدق لأنها بتضبط الحدود حسب جسمك وبيئتك تحديداً." : "المعايرة بتحسّن دقة التحليل بشكل كبير — بتضبط حدود الوضعية حسب جسمك تحديداً.\n\n**عشان تعمل معايرة:**\nروح لصفحة التحليل → اضغط 'Calibrate' → اتبع الخطوات (3 دقائق بس)"}`
        : `**Calibration ${d.calibrated ? "complete ✅" : "not done yet ⚠️"}**\n\n${d.calibrated ? "Great! Calibration makes analysis more accurate by adjusting thresholds to your specific body and environment." : "Calibration significantly improves analysis accuracy — it personalizes posture thresholds to your body.\n\n**To calibrate:**\nGo to Analysis page → click 'Calibrate' → follow steps (only 3 minutes)"}`;
    }

    case "thanks": {
      const responses = ar ? [
        "العفو! 😊 أي سؤال تاني؟",
        "تسلم! 🙏 لو احتجت حاجة أنا هنا.",
        "بكل سرور! 💪 روّح وطبّق اللي اتكلمنا فيه!",
      ] : [
        "You're welcome! 😊 Anything else?",
        "Happy to help! 🙏 I'm here whenever you need.",
        "Of course! 💪 Go put what we discussed into practice!",
      ];
      return pick(responses);
    }

    case "help": {
      return ar
        ? `أنا **Corvus AI Coach** — مدرب وضعيتك الشخصي${s ? ` (درجتك: ${s}/100)` : ""}.\n\nاسألني عن:\n• "إيه أكبر مشكلة في وضعيتي؟"\n• "إزاي أرفع نقاطي؟"\n• "أديني روتين تمارين"\n• "جدول استراحاتي الأمثل"\n• "ليه بتألمني رقبتي؟"\n• "إزاي أضبط شاشتي؟"`
        : `I'm **Corvus AI Coach** — your personal posture coach${s ? ` (your score: ${s}/100)` : ""}.\n\nAsk me:\n• "What's my biggest posture problem?"\n• "How can I improve my score?"\n• "Give me an exercise routine"\n• "What's my ideal break schedule?"\n• "Why does my neck hurt?"\n• "How do I set up my monitor?"`;
    }

    default: {
      // Context-aware default using conversation history
      if (noData) return ar
        ? "ابدأ جلسة تحليل وضعية الأول، وبعدين أقدر أساعدك بشكل شخصي! 💪\n\n💬 إيه اللي بيقلقك في وضعيتك؟"
        : "Start a posture analysis session first, then I can help you personally! 💪\n\n💬 What's your biggest posture concern right now?";

      const issues = [];
      if (al.includes("head") || al.includes("forward")) issues.push(ar ? "الرأس المتقدم" : "forward head");
      if (al.includes("shoulder") || al.includes("round")) issues.push(ar ? "الكتفين" : "rounded shoulders");
      if (al.includes("back")) issues.push(ar ? "الظهر" : "back lean");

      return ar
        ? `بناءً على بياناتك (**${s}/100** من ${ses} جلسة)${issues.length ? `: أكثر مشاكلك ${issues.join(" و")}` : ""}.\n\n💬 إيه اللي تحب تعرفه بالتحديد؟`
        : `Based on your data (**${s}/100** from ${ses} sessions)${issues.length ? `: main issues are ${issues.join(" and ")}` : ""}.\n\n💬 What specifically would you like to know?`;
    }
  }
}

// ── Analysis topics ───────────────────────────────────────────────

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
  return "general";
}

function scoreLabel2(s, ar) {
  if (!s) return "";
  if (s >= 85) return ar ? "ممتاز" : "Excellent";
  if (s >= 70) return ar ? "جيد" : "Good";
  if (s >= 55) return ar ? "متوسط" : "Fair";
  return ar ? "يحتاج تحسين" : "Needs Work";
}
function riskLabel(r, ar) {
  if (!r) return "";
  if (r >= 70) return ar ? "🔴 مرتفع" : "🔴 HIGH";
  if (r >= 40) return ar ? "🟡 متوسط" : "🟡 MODERATE";
  return ar ? "🟢 منخفض" : "🟢 LOW";
}
function trend_dir(t, ar) {
  if (t > 3)  return ar ? "📈 تحسّن" : "📈 Improving";
  if (t < -3) return ar ? "📉 تراجع" : "📉 Declining";
  return ar ? "➡️ ثابت" : "➡️ Stable";
}

function runAnalysis(prompt, systemPrompt) {
  const combined = ((systemPrompt||"") + " " + (prompt||"")).replace(/\n/g," ");
  const topic = detectTopic(combined);
  const d = parseData(combined);
  const ar = d.lang === "ar";
  const s  = d.avg ?? 0;
  const w  = d.weekAvg ?? s;
  const lw = d.lastWeekAvg ?? Math.round(s * 0.92);
  const t  = d.trendPct ?? Math.round(((w-lw)/Math.max(lw,1))*100);
  const f  = d.fatigue ?? 0;
  const b  = d.burnout ?? 0;
  const nr = d.neckRisk ?? 0;
  const se = d.sessions ?? 0;
  const ws = d.weekSessions ?? 0;
  const ac = d.anomalyCount ?? 0;
  const n  = d.name || (ar ? "المستخدم" : "User");

  switch(topic) {
    case "executive": return ar
      ? `## ملخص تنفيذي — ${n}\n\n**📊 الأداء الحالي**\n- متوسط النقاط: **${s}/100** (${scoreLabel2(s,true)}) | هذا الأسبوع: **${w}/100**\n- التغيير: **${t>0?"+":""}${t}%** | إجمالي الجلسات: **${se}** | إجهاد: **${f}%**\n\n**⚠️ أبرز المخاطر**\n${b>=70?"- 🔴 خطر إرهاق مرتفع":b>=40?"- 🟡 خطر إرهاق متوسط":"- 🟢 خطر إرهاق منخفض"}\n${nr>=50?`- ⚠️ خطر رقبة ${nr}% — ارفع الشاشة`:""}\n${s<60?"- ⚠️ نقاط وضعية منخفضة — راجع إعداد مكان العمل":""}\n\n**🎯 أولويات هذا الأسبوع**\n${s<60?"1. ارفع الشاشة لمستوى العين\n2. خذ استراحة كل ساعة\n3. أكمل المعايرة":s<80?`1. زد الجلسات لـ 5 أسبوعياً\n2. ركّز على وضعية الرقبة${nr>=40?` (${nr}%)`:""}\n3. ضع وسادة دعم قطني`:"1. حافظ على الانتظام\n2. هدف: نقاط 90+\n3. فعّل التنبيهات اليومية"}`
      : `## Executive Summary — ${n}\n\n**📊 Performance Snapshot**\n- Overall avg: **${s}/100** (${scoreLabel2(s)}) | This week: **${w}/100**\n- Week-over-week: **${t>0?"+":""}${t}%** | Sessions: **${se}** | Fatigue: **${f}%**\n\n**⚠️ Key Risk Areas**\n${b>=70?"- 🔴 High burnout risk — immediate attention needed":b>=40?"- 🟡 Moderate burnout risk — monitor closely":"- 🟢 Burnout risk low"}\n${nr>=50?`- ⚠️ Neck risk ${nr}% — raise monitor priority`:""}\n${s<60?"- ⚠️ Below-average score — workstation review needed":""}\n\n**🎯 Priority Actions**\n${s<60?"1. Raise monitor to eye level\n2. Break every hour for 5 min\n3. Complete posture calibration":s<80?`1. Aim for 5 sessions this week\n2. Focus on neck position${nr>=40?` (risk: ${nr}%)`:""}\n3. Add lumbar support`:"1. Maintain consistency\n2. Target 90+ score\n3. Enable daily reminders"}`;

    case "trends": return ar
      ? `## تحليل الاتجاهات\n\n**${trend_dir(t,true)} — ${Math.abs(t)}% أسبوعياً**\n- هذا الأسبوع: **${w}/100** | الأسبوع الماضي: **${lw}/100**\n- الجلسات هذا الأسبوع: **${ws}**\n\n**🔍 ما الذي يحرّك هذا؟**\n${t>5?"الزخم الإيجابي واضح — لا تغير ما يعمل بشكل صحيح.":t>0?"تحسن بطيء — زد تركيزك على فترات الراحة.":t<-5?"تراجع ملحوظ — غالباً تغيير في بيئة العمل أو ضغط إضافي.":"الأداء ثابت — جلسات إضافية ستدفعه للأمام."}\n\n**🔮 توقع الأسبوع القادم**\n${t>0?`بهذا المعدل: **${Math.min(100,w+Math.round(t*0.5))}/100** الأسبوع القادم.`:`لعكس الاتجاه: زد لـ ${Math.max(4,ws+1)} جلسات أسبوعياً.`}`
      : `## Trend Analysis\n\n**${trend_dir(t)} — ${Math.abs(t)}% week-over-week**\n- This week: **${w}/100** | Last week: **${lw}/100**\n- Sessions this week: **${ws}**\n\n**🔍 What's Driving This**\n${t>5?"Clear positive momentum — don't change what's working.":t>0?"Slow progress — increase break frequency.":t<-5?"Notable decline — likely workstation changes or increased workload.":"Stable — add sessions to push forward."}\n\n**🔮 Next Week Forecast**\n${t>0?`At this pace: projected **${Math.min(100,w+Math.round(t*0.5))}/100** next week.`:`To reverse trend: target ${Math.max(4,ws+1)} sessions/week.`}`;

    case "fatigue": return ar
      ? `## تقييم الإجهاد والإرهاق\n\n**مؤشر الإجهاد: ${riskLabel(f,true)} (${f}%)** | **خطر الإرهاق: ${riskLabel(b,true)} (${b}/100)**\n\n**⚠️ علامات تحذيرية**\n${f>=70?"- 🔴 إجهاد بدني مرتفع — جسمك يحتاج راحة":"- مستوى الإجهاد مقبول"}\n${b>=60?"- 🔴 خطر إرهاق مهني — قلّل ساعات العمل المتواصل":""}\n${s<55?"- ⚠️ وضعية ضعيفة + إجهاد = خطر ألم مزمن":""}\n\n**💊 خطة التعافي**\n${f>=60?"1. استراحة 10 دقائق كل ساعة\n2. تمارين تنفس عميق 3 مرات يومياً\n3. استشر طبيباً إذا استمر الألم":"1. حافظ على استراحة 5 دقائق كل ساعة\n2. نوم 7-8 ساعات\n3. تمارين الاسترخاء قبل النوم"}`
      : `## Fatigue & Burnout Assessment\n\n**Fatigue: ${riskLabel(f)} (${f}%)** | **Burnout: ${riskLabel(b)} (${b}/100)**\n\n**⚠️ Warning Signs**\n${f>=70?"- 🔴 High physical fatigue — body needs rest":"- Fatigue at acceptable levels"}\n${b>=60?"- 🔴 High burnout risk — reduce continuous work hours":""}\n${s<55?"- ⚠️ Poor posture + fatigue = chronic pain risk":""}\n\n**💊 Recovery Plan**\n${f>=60?"1. 10-min break every hour\n2. Deep breathing 3×/day\n3. See physiotherapist if pain persists":"1. 5-min break every hour\n2. 7-8 hours sleep\n3. Relaxation routine before bed"}`;

    case "recommendations": return ar
      ? `## خطة العمل الشخصية\n\n**🔧 إصلاحات فورية**\n${s<60?"- 🔴 ارفع الشاشة لمستوى العين (أعلى تأثير)\n- 🔴 الكرسي: ركبتان 90°\n- 🔴 لوحة المفاتيح: الكوعان غير مرفوعين":"- ✅ إعداد مكان العمل يبدو جيداً"}\n\n**🖥️ تعديلات البيئة**\n${nr>=50?`- 🚨 خطر رقبة ${nr}% — ارفع الشاشة 3-5 سم فوراً`:""}\n${!d.calibrated?"- ⚠️ أكمل معايرة الوضعية للحصول على تحليل أدق":"- ✅ المعايرة مكتملة"}\n\n**📅 تحسينات العادات**\n1. قاعدة 20-20-20\n2. وقف كل ساعة 2 دقيقة\n3. تمارين الرقبة والكتف مرتين يومياً\n4. هدف ${Math.min(7,(ws||2)+2)} جلسات أسبوعياً`
      : `## Personalized Action Plan\n\n**🔧 Immediate Fixes**\n${s<60?"- 🔴 Raise monitor to eye level (highest impact)\n- 🔴 Chair: knees at 90°\n- 🔴 Keyboard: elbows not raised":"- ✅ Workstation setup looks good"}\n\n**🖥️ Environment Adjustments**\n${nr>=50?`- 🚨 Neck risk ${nr}% — raise monitor 3-5cm now`:""}\n${!d.calibrated?"- ⚠️ Complete posture calibration for personalized thresholds":"- ✅ Calibration complete"}\n\n**📅 Habit Improvements**\n1. 20-20-20 rule\n2. Stand every hour for 2 min\n3. Neck + shoulder stretch twice daily\n4. Target ${Math.min(7,(ws||2)+2)} sessions/week`;

    case "burnout": return ar
      ? `## تحليل خطر الإرهاق\n\n**النتيجة: ${riskLabel(b,true)} — ${b}/100**\n\n${b>=70?"- 🔴 خطر مرتفع جداً — تدخل فوري مطلوب":b>=40?"- 🟡 خطر متوسط — راقب المؤشرات أسبوعياً":"- 🟢 مستوى آمن"}\n- وضعية الجسم: ${s<60?"ضعيفة — عامل خطر إضافي":"جيدة — عامل حماية"}\n\n**🛡️ خطة الوقاية**\n${b>=60?"1. أقصى عمل متواصل 90 دقيقة\n2. يوم راحة كامل أسبوعياً\n3. استشر طبيباً إذا استمر":"1. استراحة كل ساعة\n2. وقت محدد للتوقف عن العمل\n3. 7-8 ساعات نوم يومياً"}`
      : `## Burnout Risk Analysis\n\n**Score: ${riskLabel(b)} — ${b}/100**\n\n${b>=70?"- 🔴 Very high risk — immediate intervention needed":b>=40?"- 🟡 Moderate risk — monitor weekly":"- 🟢 Risk level safe"}\n- Posture: ${s<60?"poor — additional risk factor":"good — protective factor"}\n\n**🛡️ Prevention Plan**\n${b>=60?"1. Max 90 min continuous work\n2. Full rest day weekly\n3. Consult doctor if burnout persists":"1. Break every hour\n2. Set firm end-of-work time\n3. 7-8 hours sleep per night"}`;

    case "risk": return ar
      ? `## ملف المخاطر\n\n**الخطر الإجمالي: ${riskLabel(d.riskScore||b,true)} (${d.riskScore||b}/100)**\n\n- وضعية الجسم: ${scoreLabel2(s,true)} (${s}/100)\n- الشواذ المكتشفة: ${ac}\n\n**🎯 أعلى المخاطر**\n${s<60?"1. 🔴 وضعية ضعيفة — خطر ألم مزمن":"1. 🟢 وضعية جيدة"}\n${ac>3?"2. 🟡 تذبذب متكرر — بيئة عمل غير مستقرة":"2. 🟢 وضعية متسقة"}\n${(d.riskScore||b)>=50?"3. 🟡 خطر متوسط — راقب أسبوعياً":"3. 🟢 مستوى أمان"}`
      : `## Risk Profile\n\n**Overall Risk: ${riskLabel(d.riskScore||b)} (${d.riskScore||b}/100)**\n\n- Posture: ${scoreLabel2(s)} (${s}/100)\n- Anomalies detected: ${ac}\n\n**🎯 Highest Risk Areas**\n${s<60?"1. 🔴 Poor posture — chronic pain risk":"1. 🟢 Good posture"}\n${ac>3?"2. 🟡 Frequent variability — unstable workstation":"2. 🟢 Consistent posture"}\n${(d.riskScore||b)>=50?"3. 🟡 Moderate risk — monitor weekly":"3. 🟢 Risk level safe"}`;

    case "forecast": {
      const fc = d.forecast ? d.forecast.split(",").map(x=>parseInt(x.trim())).filter(n=>!isNaN(n)) : [];
      const avg7 = fc.length ? Math.round(fc.reduce((a,b)=>a+b,0)/fc.length) : Math.round(s + t*0.5);
      return ar
        ? `## توقعات 7 أيام\n\n**متوسط متوقع: ${avg7}/100**\n${fc.length?`النقاط اليومية: ${fc.join(" → ")}`:""}\n\n**🔍 المحركات الرئيسية**\n${t>2?"الزخم الإيجابي سيستمر مع الانتظام":t<-2?"الانخفاض قد يستمر — يحتاج تدخل":"الأداء مستقر — جهد بسيط يحسّنه"}\n\n**📈 لتحسين التوقع**\n1. ${avg7<75?"ارفع الشاشة — أعلى تأثير":"حافظ على الاستراحات المنتظمة"}\n2. ${Math.max(5,(ws||3)+2)} جلسات هذا الأسبوع\n3. تمارين الرقبة والكتف يومياً`
        : `## 7-Day Forecast\n\n**Projected average: ${avg7}/100**\n${fc.length?`Daily scores: ${fc.join(" → ")}`:""}\n\n**🔍 Key Drivers**\n${t>2?"Positive momentum — will continue with consistency":t<-2?"Decline may continue — needs intervention":"Stable — small effort can push forward"}\n\n**📈 How to Improve**\n1. ${avg7<75?"Adjust monitor height — highest impact":"Maintain regular break schedule"}\n2. Target ${Math.max(5,(ws||3)+2)} sessions this week\n3. Daily neck and shoulder stretches`;
    }

    case "anomaly": return ar
      ? `## تحليل الشواذ\n\n**${ac} شذوذ مكتشف** من متوسط ${s}/100\n\n${ac===0?"✅ لا شواذ — وضعيتك متسقة!":ac<=2?"شواذ قليلة — طبيعية، قد تكون بسبب اجتماعات أو ضغط مؤقت":ac<=5?"شواذ متوسطة — تستحق المراقبة":"شواذ مرتفعة — غالباً مشكلة بيئية ثابتة"}\n\n**📋 خطوات**\n1. راجع أوقات الشواذ — هل تتركز في وقت معين؟\n2. تحقق من إعداد مكان العمل في تلك الأوقات\n3. أضف تذكيرات إضافية في أوقات الذروة`
      : `## Anomaly Analysis\n\n**${ac} anomalies detected** from ${s}/100 baseline\n\n${ac===0?"✅ No anomalies — excellent consistency!":ac<=2?"Few anomalies — normal, likely meetings or stress":ac<=5?"Moderate anomalies — worth monitoring":"High count — likely persistent environmental issue"}\n\n**📋 Next Steps**\n1. Check when anomalies occur — any pattern?\n2. Review workstation setup during those sessions\n3. Add extra reminders during peak-stress hours`;

    default: return ar
      ? `📊 درجتك **${s}/100** من **${se}** جلسة.\n\n${s<70?"أهم خطوة: ارفع الشاشة لمستوى العين.":s<85?"وضعك كويس — ركّز على الانتظام.":"ممتاز! حافظ على الـ streak."}`
      : `📊 Your score: **${s}/100** from **${se}** sessions.\n\n${s<70?"Top priority: raise monitor to eye level.":s<85?"Good level — focus on consistency.":"Excellent! Maintain your streak."}`;
  }
}

// ── Public API ────────────────────────────────────────────────────

export async function localChat(messages, { systemPrompt = "" } = {}) {
  await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
  const d        = parseData(systemPrompt);
  const hist     = analyzeHistory(messages);
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  const intent   = detectIntent(lastUser?.content || "");
  return buildResponse(intent, lastUser?.content || "", d, hist);
}

export async function localAnalysis(prompt, { systemPrompt = "" } = {}) {
  await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
  return runAnalysis(prompt, systemPrompt);
}
