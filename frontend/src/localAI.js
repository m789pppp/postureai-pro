/**
 * localAI.js — Offline AI Posture Coach
 * Zero downloads, zero API calls, zero network dependency.
 * Uses user's real session data to generate personalized responses.
 */

let _ready     = true;   // always ready — no init needed
let _loading   = false;
let _progress  = 100;
let _error     = null;
let _listeners = new Set();

export function getLocalAIStatus() { return { ready: _ready, loading: false, progress: 100, error: null }; }
export function onLocalAIStatus(cb) { _listeners.add(cb); return () => _listeners.delete(cb); }
export async function initLocalAI()  { return true; }
export async function unloadLocalAI() {}
export async function checkWebGPU()  { return true; }

// ── Response engine ────────────────────────────────────────────────
function extractContext(systemPrompt) {
  const ctx = {};
  const m = (pattern) => { const r = systemPrompt?.match(pattern); return r ? r[1] : null; };
  ctx.avg     = parseInt(m(/[Aa]vg[^:]*:\s*(\d+)/)) || parseInt(m(/average score[^:]*:\s*(\d+)/i)) || 0;
  ctx.sessions= parseInt(m(/[Ss]essions?[^:]*:\s*(\d+)/)) || 0;
  ctx.alerts  = (systemPrompt?.match(/Common alerts[^:]*:(.*?)(?:\n|$)/i)?.[1] || "").split(",").map(s=>s.trim()).filter(Boolean);
  ctx.worst   = m(/[Ww]orst time[^:]*:\s*([^\n]+)/) || "";
  ctx.trend   = m(/[Tt]rend[^:]*:\s*([^\n]+)/) || "";
  ctx.name    = m(/[Uu]ser[^:]*:\s*([^,\n]+)/) || "";
  ctx.lang    = systemPrompt?.includes("Egyptian Arabic") ? "ar" : "en";
  return ctx;
}

const AR = {
  greet: (n,s,ses) => `أهلاً ${n||""}! 💪 شايف بياناتك — متوسط درجتك ${s}/100 من ${ses} جلسة.`,
  nodata: "مفيش بيانات جلسات كفاية لحد دلوقتي — ابدأ جلسة تحليل الوضعية الأول وبعدين رجّعلي.",
  low:    (s) => `درجة ${s}/100 بتقول إن في مشاكل واضحة في الوضعية محتاج تتعامل معاها.`,
  mid:    (s) => `درجة ${s}/100 كويسة بس في مجال للتحسين.`,
  high:   (s) => `درجة ${s}/100 ممتازة! الهدف يبقى فوق 85 باستمرار.`,
  improve_low:  "🔴 الأولويات دلوقتي:\n1. كل ساعة وقف من الكرسي 5 دقايق\n2. الشاشة على مستوى عيونك بالظبط\n3. وسادة دعم للظهر السفلي\n4. كتفك مش لازم يكونوا مرفوعين — خليهم ريلاكس\n5. اشتري تايمر — كل 20 دقيقة تبص بعيد 20 ثانية",
  improve_mid:  "🟡 عشان توصل لـ 80+:\n1. راجع ارتفاع الكرسي — ركبتك لازم 90 درجة\n2. كيبورد قريب منك — كوعك مش مرفوع\n3. استريتش كتافك كل ساعتين\n4. شيل الموبايل من على المكتب وانت بتتكلم",
  improve_high: "🟢 عشان تحافظ على الممتاز:\n1. استمر في البريكات المنتظمة\n2. الرياضة 3x أسبوع (خصوصًا تقوية الظهر)\n3. تاكد إن الإضاءة مش بتخليك تنحني للشاشة",
  worst:  (w) => w ? `وقت الأسوأ عندك هو ${w} — في الوقت ده تأكد إنك بتاخد بريك كل ساعة.` : "",
  head:   "📍 رأسك بيميل للأمام كتير — الحل: ارفع الشاشة وافتكر قاعدة 'حنك للداخل' كل ربع ساعة.",
  shoulder:"📍 كتافك مرفوعين — استرخي وطنّش الكتاف كل ما تفتكر.",
  back:   "📍 ظهرك بيتقوّس — اتكي للوراء على الكرسي مش للأمام، والكرسي يدعم الظهر السفلي.",
  neck:   "📍 رقبتك بتتعب — الشاشة لازم تكون على مستوى عينيك، مش نازلة ولا طالعة.",
  trend_up:   "📈 وضعيتك بتتحسن — كمل على نفس النهج!",
  trend_down: "📉 لاحظت إن وضعيتك اتراجعت — حاول تعمل بريكات أكتر وراجع وضعية الكرسي.",
  pain:   "الألم في الظهر والرقبة جاي من الوضعية الغلط. إذا الألم مستمر أكتر من أسبوعين، حلو تستشير فيزيوثيرابيست.",
  break_sched: "⏰ جدول البريكات المثالي:\n• كل 20 دقيقة: بص بعيد 20 ثانية\n• كل ساعة: وقف وامشي دقيقتين\n• كل ساعتين: استريتش الرقبة والكتاف 5 دقايق",
  exercise: "💪 تمارين مناسبة لمشاكل الوضعية:\n1. Chin tuck: حنك للداخل 10 مرات × 3\n2. Shoulder rolls: كتافك للخلف 10 مرات\n3. Cat-cow stretch: 10 مرات على الأرض\n4. Wall angels: 10 مرات جنب الحيط",
  default: "أنا هنا أساعدك تحسّن وضعيتك! اسألني عن:\n• إيه أكبر مشكلة في وضعيتك\n• إزاي تتحسن\n• جدول البريكات\n• التمارين المناسبة",
};

const EN = {
  greet: (n,s,ses) => `Hi ${n||""}! 💪 I can see your data — your average score is ${s}/100 from ${ses} sessions.`,
  nodata: "No session data yet — start a posture analysis session first, then come back and I can give you personalized advice.",
  low:    (s) => `Your score of ${s}/100 indicates clear posture issues that need attention.`,
  mid:    (s) => `Your score of ${s}/100 is decent but there's room to improve.`,
  high:   (s) => `Your score of ${s}/100 is excellent! Aim to keep it above 85 consistently.`,
  improve_low:  "🔴 Priority actions right now:\n1. Stand up every hour for 5 minutes\n2. Screen at exact eye level\n3. Lumbar support cushion behind lower back\n4. Shoulders relaxed — not raised\n5. 20-20-20 rule: every 20 min, look 20 feet away for 20 seconds",
  improve_mid:  "🟡 To reach 80+:\n1. Check chair height — knees at 90°\n2. Keyboard close — elbows not raised\n3. Shoulder stretch every 2 hours\n4. Don't tuck phone under ear when calling",
  improve_high: "🟢 To maintain excellence:\n1. Keep regular breaks\n2. Exercise 3x/week (especially back strengthening)\n3. Ensure lighting doesn't make you lean toward the screen",
  worst:  (w) => w ? `Your worst time is ${w} — during those hours make sure to take a break every hour.` : "",
  head:   "📍 Your head leans too far forward — fix: raise your screen and practice 'chin tuck' every 15 minutes.",
  shoulder:"📍 Your shoulders are raised — consciously relax and drop your shoulders whenever you notice.",
  back:   "📍 Your back is rounding — lean back against the chair, not forward, and support your lower back.",
  neck:   "📍 Neck strain detected — your screen needs to be at eye level, not too low or high.",
  trend_up:   "📈 Your posture is improving — keep up the good work!",
  trend_down: "📉 Your posture has declined recently — try more frequent breaks and reassess your chair setup.",
  pain:   "Back and neck pain often comes from poor posture. If pain persists more than 2 weeks, consider seeing a physiotherapist.",
  break_sched: "⏰ Optimal break schedule:\n• Every 20 min: look away for 20 seconds\n• Every hour: stand and walk for 2 minutes\n• Every 2 hours: neck and shoulder stretch for 5 minutes",
  exercise: "💪 Exercises for posture problems:\n1. Chin tuck: pull chin in 10 reps × 3\n2. Shoulder rolls: roll backward 10 times\n3. Cat-cow stretch: 10 reps on all fours\n4. Wall angels: 10 reps against a wall",
  default: "I'm here to help you improve your posture! Ask me about:\n• Your biggest posture problem\n• How to improve your score\n• Break schedule\n• Recommended exercises",
};

function buildReply(userMsg, ctx) {
  const T       = ctx.lang === "ar" ? AR : EN;
  const msg     = userMsg.toLowerCase();
  const score   = ctx.avg;
  const noData  = !ctx.sessions;
  const alertsL = ctx.alerts.map(a => a.toLowerCase()).join(" ");

  // Greeting / intro
  if (msg.match(/^(hi|hello|hey|مرحبا|أهلا|هاي|كيف|how are)/)) {
    if (noData) return T.nodata;
    return T.greet(ctx.name, score, ctx.sessions) + "\n\n" +
      (score < 50 ? T.low(score) : score < 75 ? T.mid(score) : T.high(score));
  }

  // Biggest problem
  if (msg.match(/problem|issue|wrong|مشكل|غلط|أكبر/)) {
    if (noData) return T.nodata;
    const parts = [score < 50 ? T.low(score) : score < 75 ? T.mid(score) : T.high(score)];
    if (alertsL.includes("head") || alertsL.includes("forward") || alertsL.includes("رأس")) parts.push(T.head);
    if (alertsL.includes("shoulder") || alertsL.includes("كتف"))   parts.push(T.shoulder);
    if (alertsL.includes("back") || alertsL.includes("ظهر"))       parts.push(T.back);
    if (alertsL.includes("neck") || alertsL.includes("رقبة"))      parts.push(T.neck);
    if (ctx.worst) parts.push(T.worst(ctx.worst));
    if (parts.length === 1) parts.push(ctx.lang === "ar" ? "مفيش تنبيهات متكررة ظاهرة في بياناتك — كمل على الوضعية الكويسة!" : "No recurring alerts in your data — keep up the good posture!");
    return parts.join("\n\n");
  }

  // How to improve
  if (msg.match(/improve|better|higher|score|تحسن|تحسين|أحسن|رفع/)) {
    if (noData) return T.nodata;
    return (score < 50 ? T.improve_low : score < 75 ? T.improve_mid : T.improve_high);
  }

  // Pain
  if (msg.match(/pain|hurt|ache|ألم|بيوجع|وجع/)) {
    return T.pain + (noData ? "" : "\n\n" + (score < 60 ? (ctx.lang === "ar" ? "\nدرجتك " + score + " بتأكد إن في مشاكل في الوضعية محتاجة اهتمام." : "\nYour score of " + score + " confirms posture issues that need attention.") : ""));
  }

  // Break schedule
  if (msg.match(/break|rest|schedule|pause|بريك|راحة|جدول/)) {
    return T.break_sched + (ctx.worst ? "\n\n" + T.worst(ctx.worst) : "");
  }

  // Exercises
  if (msg.match(/exercise|stretch|workout|تمرين|استريتش|رياضة/)) {
    return T.exercise;
  }

  // Trend
  if (msg.match(/trend|progress|getting|تحسن|اتحسن|بيتراجع/)) {
    if (noData) return T.nodata;
    const trendLow = ctx.trend?.toLowerCase() || "";
    return trendLow.includes("improv") || trendLow.includes("تحسن") ? T.trend_up : trendLow.includes("declin") || trendLow.includes("راجع") ? T.trend_down : (ctx.lang === "ar" ? "وضعيتك ثابتة — حاول تحافظ على البريكات المنتظمة." : "Your posture is stable — keep maintaining regular breaks.");
  }

  // Score question
  if (msg.match(/score|درجة|كام|what.*my/)) {
    if (noData) return T.nodata;
    return T.greet(ctx.name, score, ctx.sessions);
  }

  // Worst time
  if (msg.match(/worst|أسوأ|when/)) {
    if (noData) return T.nodata;
    return ctx.worst ? T.worst(ctx.worst) + (ctx.lang === "ar" ? "\n\nركّز على البريكات في الأوقات دي أكتر من غيرها." : "\n\nFocus on breaks especially during those hours.") : (ctx.lang === "ar" ? "مفيش بيانات كافية عن أوقات بعينها لحد دلوقتي." : "Not enough time-specific data yet.");
  }

  // Default
  return T.default;
}

// ── Public API ─────────────────────────────────────────────────────
export async function localChat(messages, { systemPrompt = "", maxTokens = 500 } = {}) {
  // Simulate a tiny delay so it feels like "thinking" not instant
  await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
  const ctx      = extractContext(systemPrompt);
  const lastUser = [...messages].reverse().find(m => m.role === "user");
  return buildReply(lastUser?.content || "", ctx);
}

export async function localAnalysis(prompt, { systemPrompt = "", maxTokens = 500 } = {}) {
  await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
  const ctx = extractContext(systemPrompt || prompt);
  // For analysis prompts, return a structured summary
  const T   = ctx.lang === "ar" ? AR : EN;
  const s   = ctx.avg;
  if (!ctx.sessions) return ctx.lang === "ar" ? "📊 مفيش بيانات كافية لحد دلوقتي." : "📊 Not enough data yet.";
  const lines = [
    s < 50 ? T.low(s) : s < 75 ? T.mid(s) : T.high(s),
    s < 50 ? T.improve_low : s < 75 ? T.improve_mid : T.improve_high,
  ];
  if (ctx.worst) lines.push(T.worst(ctx.worst));
  return lines.join("\n\n");
}
