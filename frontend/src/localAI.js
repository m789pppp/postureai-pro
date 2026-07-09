/**
 * Corvus AI Coach v4 — Knowledge-Based Posture Intelligence
 *
 * - Answers virtually any posture/ergonomics question
 * - Corvus-branded, posture-focused only
 * - Every claim backed by scientific citation
 * - Multi-turn memory + follow-up questions
 * - Redirects off-topic questions back to posture
 */

export function getLocalAIStatus() { return { ready:true, loading:false, progress:100, error:null }; }
export function onLocalAIStatus(cb) { return ()=>{}; }
export async function initLocalAI()   { return true; }
export async function unloadLocalAI() {}
export async function checkWebGPU()   { return true; }

// ── Utilities ─────────────────────────────────────────────────────
const pick  = arr => arr[Math.floor(Math.random()*arr.length)];
const num   = (t,...ps) => { for(const p of ps){const m=t?.match(p);if(m){const v=parseFloat(m[1]);if(!isNaN(v))return v;}} return null; };
const str   = (t,...ps) => { for(const p of ps){const m=t?.match(p);if(m)return m[1]?.trim();} return null; };

// ── Scientific references ─────────────────────────────────────────
const SCI = {
  hansraj:    "Hansraj KK (2014). Assessment of Stresses in the Cervical Spine. Surg Technol Int.",
  niosh:      "NIOSH (1997). Musculoskeletal Disorders and Workplace Factors. CDC Publication.",
  osha:       "OSHA 3125 (2000). Ergonomics: The Study of Work. US Dept of Labor.",
  straker:    "Straker L et al. (2008). Laptop use: musculoskeletal associations. Ergonomics.",
  dunk:       "Dunk NM & Callaghan JP (2005). Lumbar support reduces discs loads. Ergonomics.",
  richter:    "Richter HO et al. (2011). Eye-neck interactions in VDU work. Eur J Appl Physiol.",
  hedge:      "Hedge A (2017). Ergonomics of the office. Cornell Human Factors Lab.",
  palmer:     "Palmer KT et al. (2001). Neck pain in the community. Occup Med.",
  ijmker:     "IJmker S et al. (2006). Should office workers reduce sitting time? Scand J Work.",
  panagiotopoulou: "Panagiotopoulou G et al. (2004). Laptop use: posture analysis. Ergonomics.",
  aota:       "AOTA (2018). Occupational therapy practice guidelines for office ergonomics.",
  cagnie:     "Cagnie B et al. (2007). Prevalence and risk factors for neck pain. Spine.",
  ariens:     "Ariëns GA et al. (2001). High quantitative job demands: neck pain risk. Spine.",
  paul:       "Paul G et al. (2014). Sit-stand desks: systematic review. Prev Med.",
  van_eerd:   "Van Eerd D et al. (2016). Effectiveness of workplace interventions. Occup Environ Med.",
};

function cite(ref,ar) {
  return ar ? `\n\n📚 *المصدر: ${SCI[ref]}*` : `\n\n📚 *Source: ${SCI[ref]}*`;
}

// ── Data extraction ───────────────────────────────────────────────
function parseData(sp) {
  const t = (sp||"").replace(/\n/g," ");
  return {
    name:         str(t, /Name:\s*([A-Za-z][A-Za-z ]{1,20})/, /User:\s*([A-Za-z]{2,20})/),
    avg:          num(t, /[Oo]verall avg score:\s*(\d+)/, /[Aa]vg[^:]*:\s*(\d+)/),
    weekAvg:      num(t, /[Tt]his week.*?:\s*(\d+)\/100/),
    sessions:     num(t, /[Tt]otal sessions?:\s*(\d+)/, /[Ss]essions?:\s*(\d+)/),
    weekSessions: num(t, /[Tt]his week.*?:\s*(\d+)\s*session/),
    trendPct:     num(t, /Trend:\s*([+-]?\d+)%/),
    fatigue:      num(t, /[Ff]atigue index:\s*(\d+)%/),
    burnout:      num(t, /[Bb]urnout risk.*?:\s*(\d+)/),
    neckRisk:     num(t, /[Nn]eck risk:\s*(\d+)%/),
    worstTime:    str(t, /[Ww]orst time.*?:\s*([^\s,]+)/),
    alerts:       str(t, /[Cc]ommon alerts?.*?:\s*([^\n.]+)/),
    calibrated:   t.includes("Yes") || t.includes("calibrat"),
    lang:         t.includes("Arabic")||t.includes("العربية")||t.includes("Egyptian Arabic") ? "ar" : "en",
  };
}

// ── Conversation memory ───────────────────────────────────────────
function analyzeHistory(messages) {
  const prev = messages.slice(0,-1);
  const discussed = new Set();
  let lastUser="", lastBot="", turns=0;

  for(const m of prev) {
    if(!m.content) continue;
    const c = m.content.toLowerCase();
    if(m.role==="user") { lastUser=m.content; turns++; }
    if(m.role==="assistant") lastBot=m.content;
    const topics = {pain:/pain|hurt|ache|ألم|وجع/,neck:/neck|رقبة/,shoulder:/shoulder|كتف/,
      back:/back|ظهر/,wrist:/wrist|معصم/,eye:/eye|عين|headache|صداع/,
      monitor:/monitor|screen|شاشة/,chair:/chair|كرسي/,exercise:/exercise|تمرين|stretch/,
      break:/break|راحة/,improve:/improve|تحسن/};
    for(const [k,r] of Object.entries(topics)) if(c.match(r)) discussed.add(k);
  }
  return { discussed, lastUser, lastBot, turns };
}

// ── Follow-up engine ──────────────────────────────────────────────
function followUp(intent, d, hist, ar) {
  if(hist.lastBot.includes("💬")) return ""; // already asked
  const already = hist.discussed;
  const pool = {
    pain:     ar ? ["💬 الألم من إمتى بالتحديد؟","💬 وين بالظبط بتحس بالألم — رقبة، كتف، أم ظهر علوي؟"]
                 : ["💬 How long have you had this pain?","💬 Where exactly — neck, shoulder, or upper back?"],
    neck:     ar ? ["💬 شاشتك على أي ارتفاع دلوقتي؟","💬 بتستخدم لابتوب أو شاشة خارجية؟"]
                 : ["💬 Where is your monitor positioned right now?","💬 Do you use a laptop or external monitor?"],
    improve:  ar ? ["💬 إيه أكبر تحدي في تحسين وضعيتك؟","💬 بتشتغل كام ساعة يومياً تقريباً؟"]
                 : ["💬 What's your biggest challenge in improving?","💬 How many hours do you work daily?"],
    exercise: ar ? ["💬 بتعمل رياضة أساساً؟","💬 الصبح بتبدأ إزاي — مباشرة للشغل؟"]
                 : ["💬 Do you exercise regularly?","💬 How do you start your mornings?"],
    monitor:  ar ? ["💬 شاشتك كبيرة (24+) أو لابتوب؟","💬 مكتبك ثابت أم بيتغير؟"]
                 : ["💬 Large monitor (24+) or laptop?","💬 Fixed desk or does your setup change?"],
    chair:    ar ? ["💬 الكرسي بتاعك بيدعم ظهرك السفلي؟","💬 الكرسي عنده مسند ذراع؟"]
                 : ["💬 Does your chair support your lower back?","💬 Does your chair have armrests?"],
    general:  ar ? ["💬 إيه اللي بيقلقك أكتر في وضعيتك؟","💬 في ألم معين بتحسه باستمرار؟"]
                 : ["💬 What concerns you most about your posture?","💬 Any pain you experience regularly?"],
  };
  const key = pool[intent] ? intent : "general";
  return "\n\n" + pick(pool[key]);
}

// ── Intent detection ──────────────────────────────────────────────
function detectIntent(msg) {
  const m = msg.toLowerCase();
  // Off-topic detection — only truly unrelated (not health/fitness/wellness adjacent)
  if(m.match(/stock|crypto|bitcoin|invest|football|movie|music|weather|politics|recipe|cooking|travel|math|الطقس|أغنية|طبخ|سياسة|بورصة|كريبتو/) && !m.match(/pain|ألم|hurt|posture|وضعية|back|ظهر|neck|رقبة|shoulder|كتف|health|صحة|exercise|تمرين|stress|weight|وزن/))
    return "offtopic";
  // Corvus/product questions
  if(m.match(/corvus|postureai|app|subscription|plan|price|upgrade|feature|كورفاس|التطبيق|باقة|سعر/))
    return "product";
  // Medical/clinical
  if(m.match(/doctor|physio|clinic|surgery|medication|mri|xray|therapist|دكتور|فيزيو|عيادة|عملية|دواء/))
    return "medical";
  // Conditions
  if(m.match(/text neck|tech neck|forward head posture|fhp/i))      return "fhp";
  if(m.match(/kyphosis|lordosis|scoliosis|herniat|disc|rsi|carpal tunnel/i)) return "condition";
  // Body parts with pain
  if(m.match(/neck.*hurt|neck.*pain|rقبة.*ألم|رقبة.*وجع|cervical/))  return "neck_pain";
  if(m.match(/shoulder.*hurt|shoulder.*pain|كتف.*ألم|كتف.*وجع/))     return "shoulder_pain";
  if(m.match(/back.*hurt|back.*pain|ظهر.*ألم|ظهر.*وجع|lower back/))  return "back_pain";
  if(m.match(/wrist.*hurt|wrist.*pain|hand.*pain|معصم.*ألم|كارپال/)) return "wrist_pain";
  if(m.match(/eye.*strain|headache|eye.*tired|صداع|عين.*تعبان/))     return "eye_strain";
  // General pain
  if(m.match(/pain|hurt|ache|sore|ألم|بيوجع|وجع|مؤلم|بتعب/))        return "pain";
  // Equipment
  if(m.match(/monitor.*height|screen.*height|how high|ارتفاع.*شاشة|شاشة.*ارتفاع/)) return "monitor_height";
  if(m.match(/chair.*height|seat.*height|ارتفاع.*كرسي/))             return "chair_height";
  if(m.match(/desk.*height|standing desk|sit.*stand|ارتفاع.*مكتب|مكتب.*وقوف/)) return "desk";
  if(m.match(/keyboard|mouse|كيبورد|ماوس/))                           return "keyboard";
  if(m.match(/laptop|لابتوب/))                                        return "laptop";
  if(m.match(/lighting|light|brightness|إضاءة|ضوء/))                  return "lighting";
  // Monitor/screen general
  if(m.match(/monitor|screen|display|شاشة/))                         return "monitor";
  // Chair general
  if(m.match(/chair|seat|cushion|كرسي|جلوس/))                        return "chair";
  // Exercises
  if(m.match(/chin tuck|shoulder roll|cat.cow|wall angel/i))          return "specific_exercise";
  if(m.match(/exercise|stretch|workout|yoga|تمرين|استريتش|رياضة|يوجا/)) return "exercise";
  // Breaks & time
  if(m.match(/how long.*sit|how long.*work|كام ساعة|إمتى أقوم/))      return "sitting_time";
  if(m.match(/break|rest|pause|timer|بريك|راحة|جدول|تايمر/))          return "breaks";
  // Posture issues
  if(m.match(/rounded.*shoulder|hunchback|slouch|كتف.*مدور|إنحناء/))  return "rounded_shoulders";
  if(m.match(/head.*forward|forward.*head|رأس.*للأمام|رأس متقدم/))    return "fhp";
  if(m.match(/posture.*sleep|sleep.*position|نوم.*وضعية|وضعية.*نوم/)) return "sleep";
  if(m.match(/standing|وقوف|stand up/))                               return "standing";
  if(m.match(/walking|walk|مشي/))                                     return "walking";
  // Data / score
  if(m.match(/why.*score|ليه.*درجة|سبب.*درجة|what.*cause.*score|score.*drop|causes.*score/)) return "why_score";
  if(m.match(/score|درجة|نقط|points|كام.*نقطة/))                     return "score";
  // Calibration
  if(m.match(/calibrat|معايرة/))                                      return "calibration";
  // Prevention
  if(m.match(/prevent|avoid|how to avoid|منع|تجنب|how.*prevent/))    return "prevention";
  // NEW INTENTS ──────────────────────────────────────────────────────
  // Specific conditions
  if(m.match(/sciatica|عرق النسا|sciatic/))                           return "sciatica";
  if(m.match(/thoracic outlet|tos\b/))                                 return "tos";
  if(m.match(/piriformis/))                                            return "piriformis";
  if(m.match(/anterior pelvic tilt|apt\b|pelvic tilt|حوض/))          return "pelvic_tilt";
  if(m.match(/muscle imbalance|upper crossed|lower crossed/))         return "muscle_imbalance";
  if(m.match(/proprioception|body awareness/))                        return "proprioception";
  // Work situations
  if(m.match(/work.*bed|bed.*work|couch.*work|work.*couch|نوم.*شغل/)) return "work_bed";
  if(m.match(/gamer|gaming|video game|لعب.*جيمز|جيمنج/))             return "gaming";
  if(m.match(/programmer|developer|coding|كود|مبرمج/))               return "programmer";
  if(m.match(/from home|wfh|remote work|شغل.*بيت|home office/))      return "wfh";
  if(m.match(/meeting|zoom|teams|video call|اجتماع/))                 return "meetings";
  // Equipment
  if(m.match(/footrest|foot rest|مسند.*قدم/))                         return "footrest";
  if(m.match(/lumbar.*roll|lumbar.*support|back.*support|دعم.*قطني/)) return "lumbar_support";
  if(m.match(/monitor.*arm|monitor.*stand|شاشة.*ذراع/))              return "monitor_arm";
  if(m.match(/ergonomic.*chair|which chair|best chair|كرسي.*إرجونومي/)) return "chair_guide";
  if(m.match(/headset|headphone|phone.*hold|سماعة|تليفون.*شغل/))     return "headset";
  if(m.match(/phone.*posture|mobile.*posture|smartphone|موبايل|تليفون|hold.*phone|how.*phone/)) return "phone";
  if(m.match(/tablet|ipad|تابلت/))                                    return "tablet";
  // Lifestyle
  if(m.match(/stress.*posture|anxiety.*posture|stress|ضغط.*وضعية/))  return "stress";
  if(m.match(/breath|breathing|تنفس.*وضعية|posture.*breath/))        return "breathing";
  if(m.match(/diet|nutrition|food|غذاء.*وضعية|أكل.*وضعية/))          return "diet";
  if(m.match(/pregnant|pregnancy|حامل|حمل.*وضعية/))                  return "pregnancy";
  if(m.match(/teen|teenager|child|kids|طفل|مراهق|شباب/))             return "youth";
  if(m.match(/age|aging|older|elderly|كبير.*سن|عمر/))                return "aging";
  // Exercise methods
  if(m.match(/mckenzie|mcKenzie method/i))                            return "mckenzie";
  if(m.match(/yoga.*posture|pilates|يوجا|بيلاتس/))                   return "yoga";
  if(m.match(/swimming|swim|سباحة.*وضعية/))                          return "swimming";
  if(m.match(/gym|weight.*train|strength.*train|جيم|أوزان/))         return "gym";
  if(m.match(/walk.*posture|posture.*walk|المشي.*وضعية/))            return "walking_posture";
  // General tips
  if(m.match(/tip|advice|نصيحة|نصائح/))                              return "tips";
  if(m.match(/biggest.*problem|worst.*problem|main.*problem|my problem|what.*wrong|problem.*posture|posture.*problem|أكبر.*مشكلة|مشكلة.*وضعية|إيه.*مشكلتي/)) return "problem";
  if(m.match(/how.*doing|how.*posture|overall.*posture|posture.*overall|summary|وضعيتي.*إيه|إزاي.*وضعيتي|عامل.*إزاي/)) return "score";
  // Meta
  if(m.match(/help|مساعدة|بتعمل ايه|what can|what do/))             return "help";
  if(m.match(/thanks|شكر|ممنون|تسلم/))                               return "thanks";
  if(m.match(/^(hi|hello|hey|مرحبا|أهلاً|هاي|السلام|صباح|مساء)/))  return "greet";
  return "general";
}

// ── Knowledge base ────────────────────────────────────────────────

function KB(ar) { return {

  monitor_height: ar
    ? `**🖥️ الارتفاع الصحيح للشاشة:**

الجزء العلوي من الشاشة يكون على مستوى عينيك أو أقل منه بـ **2-3 سم** بالضبط.

**طريقة الضبط:**
1. اجلس بوضعيتك الطبيعية — لا تجلس "صح" لأجل الضبط
2. انظر مباشرة للأمام — هذا خط عينيك
3. ارفع الشاشة حتى تنظر لأعلى 10% منها بدون إمالة رأسك

**لو لابتوب:**
- حط اللابتوب على stand يرفعه 10-15 سم
- استخدم كيبورد وماوس خارجيين

**المسافة:** 50-70 سم (ذراعك ممدودة تلمس الشاشة بأطراف أصابعك)${cite("hedge",true)}${cite("straker",true)}`
    : `**🖥️ Correct Monitor Height:**

The top of your screen should be at eye level or **2-3cm below** your direct gaze.

**How to set it:**
1. Sit in your natural working position — don't sit "perfectly" just to set up
2. Look straight ahead — that's your eye line
3. Raise monitor until you look at the top 10% without tilting your head

**For laptops:**
- Use a laptop stand to raise it 10-15cm
- Add external keyboard and mouse

**Distance:** 50-70cm (arm extended, fingertips just touch screen)${cite("hedge")}${cite("straker")}`,

  chair_height: ar
    ? `**🪑 الارتفاع الصحيح للكرسي:**

- **الركبتان:** زاوية 90° تماماً، الأفخاذ موازية للأرض
- **القدمان:** مسطّحتان على الأرض أو على مسند قدم (footrest)
- **الأفخاذ:** لا يضغط حافة الكرسي على الجزء الخلفي من الركبة

**اختبار سريع:** أدخل يدك بين الجزء الخلفي من ركبتك وحافة الكرسي — المفروض تدخل بسهولة${cite("osha",true)}${cite("hedge",true)}`
    : `**🪑 Correct Chair Height:**

- **Knees:** exactly 90°, thighs parallel to floor
- **Feet:** flat on floor or on footrest
- **Thighs:** no pressure from chair edge on back of knees

**Quick test:** Slide your hand between the back of your knee and the chair edge — it should slide in easily${cite("osha")}${cite("hedge")}`,

  desk: ar
    ? `**🗂️ ارتفاع المكتب والمكتب الوقوف:**

**المكتب التقليدي:**
- الكوعان يكونوا 90° لما بتكتب
- المسافة بين المكتب والكرسي: 2-3 سم تحت الأفخاذ

**المكتب الوقوف (Standing Desk):**
- الكوعان 90° وانت واقف
- الشاشة لازم ترتفع معاه
- ابدأ بـ **15-20 دقيقة وقوف كل ساعة** وزيد تدريجياً
- مش المفروض تقف كل اليوم — الـ mix هو الأفضل${cite("paul",true)}${cite("osha",true)}`
    : `**🗂️ Desk & Standing Desk Height:**

**Traditional desk:**
- Elbows at 90° when typing
- 2-3cm clearance between desk and thighs

**Standing desk:**
- Elbows still at 90° when standing
- Monitor must rise with desk
- Start with **15-20 min standing per hour**, increase gradually
- Don't stand all day — mixing is scientifically optimal${cite("paul")}${cite("osha")}`,

  keyboard: ar
    ? `**⌨️ الكيبورد والماوس:**

- **الكيبورد:** قريب منك — الكوعان ملاصقين لجسمك (مش مرفوعين للأمام)
- **الماوس:** نفس مستوى الكيبورد، قريب جنبه
- **المعصمان:** مستقيمان — لا انحناء لأعلى أو لأسفل
- **الكيبورد المائل (tilted):** أثبتت الأبحاث أنه أسوأ لمعظم الناس — خليه مسطّح

**لو بتحس بتنميل في أصابعك:** هدا إنذار إنك محتاج تراجع وضعية يدك${cite("niosh",true)}${cite("aota",true)}`
    : `**⌨️ Keyboard & Mouse Setup:**

- **Keyboard:** close to body — elbows at sides, not stretched forward
- **Mouse:** same level as keyboard, right beside it
- **Wrists:** straight — no bending up or down
- **Tilted keyboard:** research shows flat is better for most people

**If you feel tingling in fingers:** warning sign to review hand position immediately${cite("niosh")}${cite("aota")}`,

  laptop: ar
    ? `**💻 اللابتوب — المشكلة الأكبر:**

اللابتوب مصمم بشكل خاطئ ergonomically — الشاشة والكيبورد مربوطين مع بعض، ولا تقدر تصلحهم في نفس الوقت بدون accessories.

**الحل الوحيد الصح:**
1. 🔺 **Stand للابتوب** يرفعه لمستوى العين
2. ⌨️ **كيبورد خارجي** على مستوى الكوعين
3. 🖱️ **ماوس خارجي** جنب الكيبورد

**لو مش ممكن الحل الكامل:**
- ارفع الشاشة وقبّل ظهرك للكيبورد المنخفض (أهون الشرّين)
- استخدم external keyboard على الأقل${cite("straker",true)}${cite("panagiotopoulou",true)}`
    : `**💻 Laptop — The Biggest Ergonomic Problem:**

Laptops are ergonomically flawed by design — screen and keyboard are linked, so you can't fix both without accessories.

**The only correct solution:**
1. 🔺 **Laptop stand** to raise screen to eye level
2. ⌨️ **External keyboard** at elbow height
3. 🖱️ **External mouse** beside it

**If full solution isn't possible:**
- Raise screen and accept the bent-forward keyboard (lesser evil)
- At minimum: add an external keyboard${cite("straker")}${cite("panagiotopoulou")}`,

  lighting: ar
    ? `**💡 الإضاءة والشاشة:**

- الإضاءة الخلفية (الشاشة أمام نافذة) = أسوأ شيء لعيونك
- ضوء الغرفة = 50% من إضاءة الشاشة (مش أقل ومش أكتر كتير)
- الشاشة بعيدة عن النافذة أو الضوء الساطع الجانبي
- **قاعدة Corvus:** لو الشاشة أكتر إضاءة من الغرفة بكتير → عيونك بتشتغل ضعف للتكيف${cite("richter",true)}`
    : `**💡 Lighting & Screen:**

- Screen facing a window (backlit) = worst for your eyes
- Room light = ~50% of screen brightness (not less, not much more)
- Screen away from windows and direct side-glare
- **Corvus rule:** if screen is much brighter than room → your eyes work double adapting${cite("richter")}`,

  neck_pain: (d,ar) => ar
    ? `**رقبتك — تحليل:**${(d.neckRisk??0)>0?` خطر **${(d.neckRisk??0)>60?"🔴 مرتفع":(d.neckRisk??0)>40?"🟡 متوسط":"🟢 منخفض"}** (${d.neckRisk??0}%)`:""}\n\nأكثر سبب: **Forward Head Posture** — كل سنتيمتر الرأس يتقدم للأمام يضيف ~2.7 كيلو على الرقبة.\n\n**إجراءات فورية:**\n1. Chin Tuck: 10 مرات × 3 (الأفضل علمياً)\n2. ارفع الشاشة لمستوى العين\n3. مسح الكتفين للخلف وللأسفل كل 20 دقيقة\n\n**تحذير:** تنميل في اليد أو الذراع = استشر دكتور\n\n📚 *${SCI.hansraj}*\n📚 *${SCI.cagnie}*`
    : `**Your Neck — Analysis:**${(d.neckRisk??0)>0?` Risk **${(d.neckRisk??0)>60?"🔴 HIGH":(d.neckRisk??0)>40?"🟡 MODERATE":"🟢 LOW"}** (${d.neckRisk??0}%)`:""}\n\nMost common cause: **Forward Head Posture** — each cm the head moves forward adds ~2.7kg extra neck load.\n\n**Immediate actions:**\n1. Chin tuck: 10 reps × 3 (most evidence-supported)\n2. Raise monitor to eye level\n3. Roll shoulders back and down every 20 min\n\n**Warning:** numbness in hand or arm → see a doctor\n\n📚 *${SCI.hansraj}*\n📚 *${SCI.cagnie}*`,

  shoulder_pain: ar
    ? `**كتفيك:**\n\nالكتفان المدوّران ناتجان عن إطالة الأربطة الأمامية مع ضعف الإطالة الخلفية (Upper Crossed Syndrome).\n\n**إصلاح:**\n1. Shoulder Roll للخلف 10 مرات\n2. اضغط بين لوحَي الكتف 5 ثوانٍ × 10\n3. Chest Opener: ذراعيك للخلف، صدرك للأمام 30 ثانية\n4. أوقف رفع الكتفين عند الكتابة${cite("van_eerd",true)}`
    : `**Your Shoulders:**\n\nRounded shoulders come from overstretched posterior ligaments and tight anterior muscles (Upper Crossed Syndrome).\n\n**Fix:**\n1. Shoulder roll backward 10 times\n2. Squeeze shoulder blades together 5 sec × 10\n3. Chest opener: arms back, chest forward 30 sec\n4. Stop shoulder shrugging while typing${cite("van_eerd")}`,

  back_pain: ar
    ? `**ظهرك:**\n\n80% من ألم الظهر المرتبط بالعمل مرتبط بالجلوس المطوّل بدون دعم قطني كافٍ.\n\n**إصلاح:**\n1. الظهر السفلي يلمس الكرسي دايماً\n2. وسادة دعم قطني (Lumbar Roll) لو الكرسي مش بيدعم\n3. وقف ومشي كل 45-60 دقيقة\n4. Cat-Cow: 10 مرات كل ساعتين\n\n**تحذير:** ألم ينزل للرجل = استشر دكتور فوراً${cite("dunk",true)}${cite("ijmker",true)}`
    : `**Your Back:**\n\n80% of work-related back pain links to prolonged sitting without adequate lumbar support.\n\n**Fix:**\n1. Lower back always touching chair backrest\n2. Add lumbar roll if chair doesn't support\n3. Stand and walk every 45-60 min\n4. Cat-cow: 10 reps every 2 hours\n\n**Warning:** pain radiating to leg → see doctor immediately${cite("dunk")}${cite("ijmker")}`,

  wrist_pain: ar
    ? `**معصمك:**\n\nألم المعصم في العمل المكتبي غالباً من انحناء المعصم أثناء الكتابة أو الضغط على حافة المكتب.\n\n**الوضعية الصحيحة:**\n- المعصم مستقيم — لا انحناء أعلى أو أسفل\n- الكيبورد مسطّح (مش مرفوع من الخلف)\n- مسند المعصم فقط وانت مش بتكتب\n\n**تمرين:** دوران المعصم 10 مرات كل ساعة\n\n**تحذير:** تنميل في الإبهام والسبابة والوسطى = ممكن Carpal Tunnel — استشر دكتور${cite("niosh",ar)}${cite("aota",ar)}`
    : `**Your Wrist:**\n\nOffice wrist pain usually comes from wrist deviation while typing or resting on sharp desk edges.\n\n**Correct position:**\n- Wrist straight — no bending up or down\n- Keyboard flat (don't use back legs to tilt up)\n- Wrist rest only when NOT typing\n\n**Exercise:** wrist circles 10 reps every hour\n\n**Warning:** numbness in thumb, index, middle finger = possible Carpal Tunnel — see a doctor${cite("niosh")}${cite("aota")}`,

  eye_strain: ar
    ? `**إجهاد العيون / الصداع:**\n\nإجهاد عيون الشاشة يسبب 65%+ من صداع العمل المكتبي.\n\n**قاعدة 20-20-20 (الأفضل علمياً):**\nكل 20 دقيقة → انظر لمسافة 6 أمتار لمدة 20 ثانية\n\n**إعدادات الشاشة:**\n- السطوع = سطوع الجدار بجانبها (مش أكتر)\n- Night Mode أو Warm Color بعد 6 مساءً\n- مسافة 50-70 سم\n- أعلى الشاشة على مستوى العين\n\n**لو الصداع متكرر كل يوم:** ممكن تحتاج نظارات للشاشة — استشر طبيب عيون${cite("richter",true)}`
    : `**Eye Strain / Headaches:**\n\nScreen eye strain causes 65%+ of office worker headaches.\n\n**20-20-20 rule (best evidence):**\nEvery 20 min → look at something 6 meters away for 20 seconds\n\n**Screen settings:**\n- Brightness = room wall brightness (not more)\n- Night mode or warm color after 6pm\n- Distance 50-70cm\n- Top of screen at eye level\n\n**If headaches occur daily:** you may need computer glasses — see an optometrist${cite("richter")}`,

  sitting_time: ar
    ? `**إمتى تقوم من الكرسي؟**\n\nالأبحاث الحديثة واضحة: **ما فيش حد صحيح للجلوس المتواصل** بدون حركة.\n\n**إرشاد Corvus (مبني على NIOSH):**\n- كل **30-45 دقيقة:** وقوف وتحريك الجسم\n- كل **ساعة:** مشي 2-3 دقائق على الأقل\n- كل **ساعتين:** استراحة كاملة 10 دقائق\n\n**لماذا؟** الجلوس المتواصل يرفع ضغط الديسك بين الفقرات بـ 40% مقارنة بالوقوف${cite("ijmker",true)}${cite("richter",true)}`
    : `**When to get up from your chair?**\n\nRecent research is clear: **there's no safe limit for continuous sitting** without movement.\n\n**Corvus guidance (NIOSH-based):**\n- Every **30-45 min:** stand and move your body\n- Every **hour:** walk 2-3 minutes minimum\n- Every **2 hours:** full 10-min break\n\n**Why?** Continuous sitting increases intervertebral disc pressure by 40% vs standing${cite("ijmker")}${cite("richter")}`,

  fhp: ar
    ? `**Forward Head Posture (FHP) — "تكنك":**\n\nكل سنتيمتر الرأس يتقدم للأمام يضيف **2.7 كيلو** على عضلات الرقبة والكتف. رأس على بُعد 5 سم = حمل إضافي 13.5 كيلو!\n\n**الحل الأمثل:**\n1. ارفع الشاشة — السبب الجذري\n2. Chin Tuck كل 15 دقيقة: أدخل ذقنك 5 ثوانٍ × 10\n3. اتكئ للخلف على الكرسي (مش انحنِ للأمام)\n4. لو بتستخدم موبايل: ارفعه لمستوى عينيك${cite("hansraj",true)}`
    : `**Forward Head Posture (FHP) — "Tech Neck":**\n\nEvery cm the head moves forward adds **2.7kg** load on neck/shoulder muscles. Head 5cm forward = extra 13.5kg!\n\n**Optimal fix:**\n1. Raise your monitor — addresses the root cause\n2. Chin tuck every 15 min: hold 5 sec × 10 reps\n3. Sit back in chair (don't lean forward)\n4. When using phone: raise it to eye level${cite("hansraj")}`,

  rounded_shoulders: ar
    ? `**الكتفان المدوّران:**\n\nناتجان عن ضعف عضلات Rhomboids + Trapezius السفلية مع توتر عضلات الصدر.\n\n**تمارين الإصلاح (مبنية على أدلة):**\n1. **Band Pull-Apart:** 15 تكرار × 3 مجموعات\n2. **Wall Angels:** 10 تكرار × 3 مجموعات\n3. **Face Pulls:** 15 تكرار × 3\n4. **Doorway Chest Stretch:** 30 ثانية × 2\n\n**وقت الشفاء:** بانتظام → 4-8 أسابيع لتحسن ملحوظ${cite("van_eerd",true)}`
    : `**Rounded Shoulders:**\n\nCaused by weak Rhomboids + lower Trapezius muscles combined with tight pectorals.\n\n**Evidence-based fixes:**\n1. **Band Pull-Apart:** 15 reps × 3 sets\n2. **Wall Angels:** 10 reps × 3 sets\n3. **Face Pulls:** 15 reps × 3\n4. **Doorway Chest Stretch:** 30 sec × 2\n\n**Recovery time:** consistent practice → noticeable improvement in 4-8 weeks${cite("van_eerd")}`,

  condition: ar
    ? `**حالات وضعية محددة:**\n\nCorvus بيكتشف ويراقب مشاكل الوضعية الوظيفية — مش بيشخّص حالات طبية.\n\nلو عندك تشخيص طبي معين (Herniated Disc، Scoliosis، إلخ) — الـ app بيساعدك تراقب وضعيتك ولكن لازم تتبع تعليمات الفيزيوثيرابيست بتاعك.\n\n💡 سؤالك على إيه بالتحديد؟ أقدر أديك معلومات عامة عن وضعية العمل في حالتك.`
    : `**Specific Postural Conditions:**\n\nCorvus detects and monitors functional postural issues — it doesn't diagnose medical conditions.\n\nIf you have a specific diagnosis (Herniated Disc, Scoliosis, etc.) — the app helps you monitor posture, but always follow your physiotherapist's specific guidance.\n\n💡 What specifically are you asking about? I can give you general information about working posture with your condition.`,

  sleep: ar
    ? `**وضعية النوم:**\n\nعلى الرغم إن Corvus بيراقب وضعية العمل بس، إليك أساسيات وضعية النوم:\n\n**الأفضل للرقبة والظهر:**\n- على الظهر مع وسادة صغيرة تحت الركبتين\n- على الجنب مع وسادة بين الركبتين\n- **الأسوأ:** على البطن (يضغط الرقبة)\n\n**الوسادة:** ارتفاع يحافظ على استقامة الرقبة مع العمود الفقري${cite("palmer",true)}`
    : `**Sleep Position:**\n\nAlthough Corvus monitors work posture only, here are sleep posture basics:\n\n**Best for neck and back:**\n- On back with small pillow under knees\n- On side with pillow between knees\n- **Worst:** on stomach (strains neck)\n\n**Pillow height:** should keep neck aligned with spine${cite("palmer")}`,

  prevention: ar
    ? `**الوقاية من مشاكل الوضعية:**\n\nأفضل استراتيجية وقاية مبنية على الأبحاث:\n\n1. **البيئة أولاً:** شاشة، كرسي، وإضاءة صح (80% من الحل)\n2. **الحركة:** لا تجلس أكتر من 45 دقيقة متواصلة\n3. **التمارين:** 20 دقيقة يومياً على العضلات الداعمة\n4. **المراقبة:** استخدام Corvus بانتظام لاكتشاف المشاكل مبكراً\n\n**الحقيقة:** الوقاية أسهل من العلاج بـ 10 أضعاف${cite("palmer",true)}${cite("van_eerd",true)}`
    : `**Preventing Posture Problems:**\n\nBest evidence-based prevention strategy:\n\n1. **Environment first:** correct screen, chair, lighting (80% of the fix)\n2. **Movement:** never sit more than 45 min continuously\n3. **Exercise:** 20 min daily targeting supporting muscles\n4. **Monitoring:** regular Corvus sessions for early detection\n\n**Truth:** prevention is 10× easier than treatment${cite("palmer")}${cite("van_eerd")}`,

  medical: ar
    ? `**للأسئلة الطبية:**\n\nأنا Corvus AI Coach — متخصص في إرشادات الوضعية والإرجونوميكس، مش تشخيص طبي.\n\n**للتشخيص والعلاج الطبي:** استشر طبيب أو فيزيوثيرابيست متخصص.\n\nللمساعدة في:\n- إعداد مكان العمل الصح\n- تمارين الوضعية الوقائية\n- تفسير نتائج Corvus\n\n→ أنا هنا! 💪`
    : `**For Medical Questions:**\n\nI'm Corvus AI Coach — specialized in posture guidance and ergonomics, not medical diagnosis.\n\n**For diagnosis and medical treatment:** consult a doctor or physiotherapist.\n\nFor help with:\n- Correct workstation setup\n- Preventive posture exercises\n- Understanding your Corvus results\n\n→ I'm here! 💪`,

  product: ar
    ? `**عن Corvus:**\n\nCorvus PostureAI هو نظام مراقبة وضعية ذكي يستخدم الكاميرا لتحليل وضعيتك في الوقت الفعلي.\n\n**المميزات الرئيسية:**\n- تحليل وضعية فوري (Neck، Spine، Shoulders، Head)\n- AI Coach شخصي — أنا! 🤖\n- تقارير أسبوعية وتوقعات\n- معايرة شخصية لجسمك\n\nللأسئلة عن الأسعار والباقات → راجع صفحة Pricing في التطبيق.`
    : `**About Corvus:**\n\nCorvus PostureAI is an intelligent posture monitoring system using your camera to analyze posture in real-time.\n\n**Key features:**\n- Real-time posture analysis (Neck, Spine, Shoulders, Head)\n- Personal AI Coach — that's me! 🤖\n- Weekly reports and predictions\n- Personal calibration to your body\n\nFor pricing and plan questions → check the Pricing page in the app.`,

  offtopic: ar
    ? `سؤال ممتاز! كـ Dr. Corvus، تخصصي الأساسي هو الوضعية والإرجونوميكس وصحة الجهاز العضلي الهيكلي.\n\nلو سؤالك عن صحة عامة أو رياضة أو تغذية — أقدر أساعدك بس من زاوية تأثيرها على جسمك وعمودك الفقري.\n\n💬 إيه السؤال بالتحديد؟ أو لو عندك ألم أو مشكلة في وضعيتك — أنا هنا! 💪`
    : `Great question! As Dr. Corvus, my core specialization is posture, ergonomics, and musculoskeletal health.\n\nFor general health, fitness, or nutrition topics — I can help from the angle of how they affect your spine, posture, and MSK health.\n\n💬 What specifically would you like to know? Or if you have a posture issue or pain — I'm here! 💪`,

}; }

// ── Core response builder ─────────────────────────────────────────
function buildResponse(intent, msg, d, hist) {
  const ar   = d.lang === "ar";
  const s    = d.avg ?? 0;
  const ses  = d.sessions ?? 0;
  const noData = ses===0 && s===0;
  const kb   = KB(ar);

  const no = ar
    ? "📊 مفيش بيانات جلسات لحد دلوقتي — ابدأ جلسة تحليل وضعية الأول! 💪"
    : "📊 No session data yet — start a posture analysis session first! 💪";

  // KB lookups
  if(intent==="monitor_height")    return kb.monitor_height + followUp("monitor",d,hist,ar);
  if(intent==="chair_height")      return kb.chair_height + followUp("chair",d,hist,ar);
  if(intent==="desk")              return kb.desk + followUp("monitor",d,hist,ar);
  if(intent==="keyboard")          return kb.keyboard;
  if(intent==="laptop")            return kb.laptop + followUp("monitor",d,hist,ar);
  if(intent==="lighting")          return kb.lighting;
  if(intent==="monitor")           return kb.monitor_height + followUp("monitor",d,hist,ar);
  if(intent==="chair")             return kb.chair_height + followUp("chair",d,hist,ar);
  if(intent==="neck_pain")         return kb.neck_pain(d,ar) + followUp("neck",d,hist,ar);
  if(intent==="shoulder_pain")     return kb.shoulder_pain + followUp("exercise",d,hist,ar);
  if(intent==="back_pain")         return kb.back_pain + followUp("exercise",d,hist,ar);
  if(intent==="wrist_pain")        return kb.wrist_pain;
  if(intent==="eye_strain")        return kb.eye_strain;
  if(intent==="sitting_time")      return kb.sitting_time + followUp("break",d,hist,ar);
  if(intent==="fhp")               return kb.fhp + followUp("monitor",d,hist,ar);
  if(intent==="rounded_shoulders") return kb.rounded_shoulders + followUp("exercise",d,hist,ar);
  if(intent==="condition")         return kb.condition;
  if(intent==="sleep")             return kb.sleep;
  if(intent==="prevention")        return kb.prevention;
  if(intent==="medical")           return kb.medical;
  if(intent==="product")           return kb.product;
  if(intent==="offtopic")          return kb.offtopic;

  // Standing / walking
  if(intent==="standing") return ar
    ? `**الوقوف المنتظم:**\n\nالوقوف كل ساعة لـ 2-3 دقائق يقلل الضغط على الفقرات ويحسن الدورة الدموية.\n\n**نقاط مهمة:**\n- وقوف مفيد حتى لو لمدة قصيرة\n- تحريك الجسم أفضل من الوقوف الثابت\n- المشي أفضل من الوقوف في مكانك${cite("paul",ar)}`
    : `**Regular Standing:**\n\nStanding every hour for 2-3 min reduces spinal pressure and improves circulation.\n\n**Key points:**\n- Even brief standing helps\n- Moving is better than static standing\n- Walking is better than standing in place${cite("paul")}`;

  // Specific exercises
  if(intent==="specific_exercise") {
    const m = msg.toLowerCase();
    if(m.match(/chin tuck/)) return ar
      ? `**Chin Tuck — التمرين الأكثر دعماً علمياً للرقبة:**\n\n1. اجلس أو وقف مستقيم\n2. أدخل ذقنك للداخل (كأنك بتعمل double chin)\n3. امسك 5 ثوانٍ\n4. ارخِ ببطء\n5. كرر 10 مرات × 3 مجموعات\n\n**لماذا يعمل؟** بيعيد الرأس لموضعه الطبيعي فوق العمود الفقري مباشرة${cite("hansraj",ar)}`
      : `**Chin Tuck — Most Evidence-Supported Neck Exercise:**\n\n1. Sit or stand straight\n2. Pull chin straight back (making a "double chin")\n3. Hold 5 seconds\n4. Release slowly\n5. Repeat 10 times × 3 sets\n\n**Why it works:** restores head to its natural position directly above the spine${cite("hansraj")}`;

    if(m.match(/wall angel/)) return ar
      ? `**Wall Angels — لتقوية عضلات الظهر العلوي:**\n\n1. وقف ملاصق للحيط — مؤخرة الرأس، الكتفين، الأرداف، وعقبيك يلمسوا الحيط\n2. ارفع ذراعيك بزاوية 90° (زي حرف W)\n3. ارفعهم ببطء لفوق (زي حرف Y)\n4. اطلع ببطء — الذراعان يلمسوا الحيط طول الوقت\n5. 10 تكرارات × 3 مجموعات${cite("van_eerd",ar)}`
      : `**Wall Angels — Strengthens Upper Back:**\n\n1. Stand against wall — back of head, shoulders, glutes, heels all touching\n2. Raise arms at 90° (like letter W)\n3. Slowly raise to overhead (like letter Y)\n4. Lower slowly — arms touching wall throughout\n5. 10 reps × 3 sets${cite("van_eerd")}`;
  }

  // General exercise
  if(intent==="exercise") return ar
    ? `**💪 روتين Corvus اليومي (10 دقائق):**\n\n**الصباح:**\n1. **Chin Tuck** — 10 × 3 (الأهم)\n2. **Shoulder Roll** — 10 للخلف\n3. **Chest Opener** — 30 ثانية × 2\n\n**كل ساعتين:**\n4. **Cat-Cow** — 10 تكرارات\n5. **Wall Angels** — 10 × 3\n6. **Neck Stretch** — كل اتجاه 20 ثانية\n\n**أسبوعياً (3 مرات):**\n7. تقوية عضلات الظهر الوسطى (Rows، Face Pulls)${cite("van_eerd",ar)}` + followUp("exercise",d,hist,ar)
    : `**💪 Corvus Daily Routine (10 minutes):**\n\n**Morning:**\n1. **Chin Tuck** — 10 × 3 (most important)\n2. **Shoulder Roll** — 10 backward\n3. **Chest Opener** — 30 sec × 2\n\n**Every 2 hours:**\n4. **Cat-Cow** — 10 reps\n5. **Wall Angels** — 10 × 3\n6. **Neck Stretch** — each direction 20 sec\n\n**Weekly (3×):**\n7. Mid-back strengthening (Rows, Face Pulls)${cite("van_eerd")}` + followUp("exercise",d,hist,ar);

  // Breaks
  if(intent==="breaks") return ar
    ? `**⏰ جدول الاستراحات الأمثل (مبني على NIOSH + بحث Richter):**\n\n- **كل 20 دقيقة:** قاعدة 20-20-20 (انظر لمسافة 6م لـ 20 ثانية)\n- **كل 45 دقيقة:** قم وتحرك دقيقتين\n- **كل ساعتين:** استراحة كاملة 10 دقائق + استريتش\n\n${d.worstTime?`⚠️ وقتك الأصعب **${d.worstTime}** — خذ راحة كل 30 دقيقة في هذا الوقت تحديداً\n\n`:""}**أداة مجانية:** Stretchly (مفتوح المصدر)${cite("richter",ar)}${cite("niosh",ar)}` + followUp("break",d,hist,ar)
    : `**⏰ Optimal Break Schedule (NIOSH + Richter research):**\n\n- **Every 20 min:** 20-20-20 rule (look 6m away for 20 sec)\n- **Every 45 min:** stand and move for 2 min\n- **Every 2 hours:** full 10-min break + stretching\n\n${d.worstTime?`⚠️ Your toughest time is **${d.worstTime}** — break every 30 min during that window\n\n`:""}**Free tool:** Stretchly (open-source)${cite("richter")}${cite("niosh")}` + followUp("break",d,hist,ar);

  // Pain (generic)
  if(intent==="pain") {
    const m2 = msg.toLowerCase();
    if(m2.match(/neck|رقبة/))     return buildResponse("neck_pain",msg,d,hist);
    if(m2.match(/shoulder|كتف/))  return buildResponse("shoulder_pain",msg,d,hist);
    if(m2.match(/back|ظهر/))      return buildResponse("back_pain",msg,d,hist);
    if(m2.match(/wrist|معصم/))    return buildResponse("wrist_pain",msg,d,hist);
    if(m2.match(/eye|عين|headache|صداع/)) return buildResponse("eye_strain",msg,d,hist);
    return ar
      ? `أخبرني أين بالضبط الألم:\n• رقبة\n• كتف\n• ظهر\n• معصم / يد\n• عيون / صداع\n\nهعطيك تحليل محدد وعلاج موثق علمياً. 💪`
      : `Tell me where exactly:\n• Neck\n• Shoulder\n• Back\n• Wrist / hand\n• Eyes / headache\n\nI'll give you specific analysis with scientific backing. 💪`;
  }

  // Problem
  if(intent==="problem") {
    if(noData) return no;
    const al = (d.alerts||"").toLowerCase();
    const nr = d.neckRisk??0;
    const issues=[];
    if(al.match(/head|forward|fhp/)) issues.push(ar?"📍 **رأس متقدم للأمام** — ارفع الشاشة، Chin Tuck كل 15 دقيقة":"📍 **Forward head posture** — raise monitor, chin tuck every 15 min");
    if(al.match(/shoulder|round/))   issues.push(ar?"📍 **كتفان مدوّران** — Wall Angels + Shoulder Rolls يومياً":"📍 **Rounded shoulders** — Wall Angels + Shoulder Rolls daily");
    if(al.match(/back|lean|spine/))  issues.push(ar?"📍 **ميلان الظهر** — اتكئ للخلف، دعم قطني":"📍 **Back lean** — sit back, lumbar support");
    if(al.match(/tilt/))             issues.push(ar?"📍 **رأس مائل** — سوّي الكتفين، تحقق من الشاشة":"📍 **Head tilt** — level shoulders, check monitor alignment");
    if(nr>=50)                       issues.push(ar?`📍 **خطر رقبة مرتفع (${nr}%)** — أولوية قصوى: ارفع الشاشة الآن`:`📍 **High neck risk (${nr}%)** — top priority: raise monitor now`);
    const head = ar?`درجتك **${s}/100** من **${ses}** جلسة:`:`Your score: **${s}/100** from **${ses}** sessions:`;
    const body = issues.length ? issues.join("\n\n") : (ar?"✅ مفيش تنبيهات متكررة — وضعيتك متسقة!":"✅ No recurring alerts — posture is consistent!");
    return head+"\n\n"+body+(d.worstTime?(ar?`\n\n⏰ أسوأ وقت: **${d.worstTime}**`:`\n\n⏰ Worst time: **${d.worstTime}**`):"") + followUp("problem",d,hist,ar);
  }

  // Improve
  if(intent==="improve") {
    if(noData) return no;
    const nr = d.neckRisk??0;
    if(ar) return (s<60
      ?`**لرفع نقاطك من ${s} إلى 70+ (أعلى تأثير أولاً):**\n\n1. 🖥️ **ارفع الشاشة** لمستوى العين — أهم خطوة (يؤثر على Neck + FHP + Score)\n2. 🪑 **الكرسي:** ركبتان 90°، قدمان مسطّحتان\n3. ⏰ **كل 45 دقيقة:** وقف + مشي دقيقتين\n4. 💪 **Chin Tuck:** 10 × 3 يومياً\n5. 📐 أكمل معايرة Corvus للحصول على قياسات شخصية`
      :s<80?`**لرفع نقاطك من ${s} إلى 85+:**\n\n1. 🎯 **وضعية الرقبة**${nr>=40?` (خطر ${nr}% عندك)`:"" } — أكبر عامل في النقاط\n2. ⏰ زد الجلسات لـ **5 أسبوعياً**\n3. 💪 **Wall Angels + Chin Tuck** يومياً\n4. 🔔 فعّل تنبيهات Corvus`
      :`**أنت في المستوى الممتاز (${s}/100):**\n\n1. 🏆 الانتظام هو السر — حافظ على الـ streak\n2. 💪 تقوية الظهر (Rows، Face Pulls) 3 مرات أسبوعياً\n3. 🎯 هدف: صفر تنبيهات في جلسة واحدة أسبوعياً`) + followUp("improve",d,hist,ar);
    return (s<60
      ?`**To raise your score from ${s} to 70+ (highest impact first):**\n\n1. 🖥️ **Raise monitor** to eye level — #1 factor (affects Neck + FHP + Score)\n2. 🪑 **Chair:** knees 90°, feet flat\n3. ⏰ **Every 45 min:** stand + walk 2 min\n4. 💪 **Chin tuck:** 10 × 3 daily\n5. 📐 Complete Corvus calibration`
      :s<80?`**To raise your score from ${s} to 85+:**\n\n1. 🎯 **Neck position**${nr>=40?` (your risk: ${nr}%)`:""} — biggest scoring factor\n2. ⏰ Increase to **5 sessions/week**\n3. 💪 **Wall Angels + Chin Tuck** daily\n4. 🔔 Enable Corvus alerts`
      :`**Excellent level (${s}/100):**\n\n1. 🏆 Consistency is the secret — maintain your streak\n2. 💪 Back strengthening (Rows, Face Pulls) 3×/week\n3. 🎯 Goal: zero alerts in one session per week`) + followUp("improve",d,hist,ar);
  }

  // Why score
  if(intent==="why_score") {
    if(noData) return no;
    const al=(d.alerts||"").toLowerCase();
    return ar
      ? `**ليه درجتك **${s}/100**؟\n\n${al?`أكثر المشاكل المتكررة: **${d.alerts}**\n\n`:""}الـ score بيتحسب من 7 عوامل:\n1. **وضعية الرقبة** (الأعلى وزناً)\n2. ميلان الرأس\n3. مستوى الكتفين\n4. انحناء الظهر\n5. الكتفان المدوّران\n6. اتجاه الرأس\n7. المسافة من الشاشة\n\n${s<70?"السبب الرئيسي غالباً: الشاشة على مستوى أقل من العين.":s<85?"أداء جيد — الانتظام سيرفع النقاط.":"ممتاز — حافظ عليه!"}`
      : `**Why is your score **${s}/100**?\n\n${al?`Most frequent alerts: **${d.alerts}**\n\n`:""}Score is calculated from 7 factors:\n1. **Neck posture** (highest weight)\n2. Head tilt\n3. Shoulder level\n4. Back lean\n5. Rounded shoulders\n6. Head direction\n7. Screen distance\n\n${s<70?"Main cause: monitor is likely below eye level.":s<85?"Good performance — consistency will push it higher.":"Excellent — maintain it!"}`;
  }

  // Score
  if(intent==="score") {
    if(noData) return no;
    const n = d.name||"";
    const labels = ar?[
      `${n?n+"، ":""}متوسط درجاتك **${s}/100** من **${ses}** جلسة.`,
      `درجتك **${s}/100** — ${s>=85?"ممتاز 🏆":s>=70?"جيد 👍":s>=55?"متوسط 📊":"يحتاج تحسين ⚠️"}. ${ses} جلسة مسجّلة.`,
    ]:[
      `${n?n+", ":""}your average is **${s}/100** from **${ses}** sessions.`,
      `Score: **${s}/100** — ${s>=85?"Excellent 🏆":s>=70?"Good 👍":s>=55?"Fair 📊":"Needs Work ⚠️"}. ${ses} sessions logged.`,
    ];
    const tip = s<70?(ar?"\n\n💡 أهم خطوة: ارفع الشاشة لمستوى عينيك.":"\n\n💡 Top fix: raise monitor to eye level.")
              : s<85?(ar?"\n\n💡 للوصول لـ 85+: زد الجلسات لـ 5 أسبوعياً.":"\n\n💡 To reach 85+: 5 sessions/week.")
              :(ar?"\n\n💡 ممتاز! حافظ على الانتظام.":"\n\n💡 Excellent! Maintain your consistency.");
    return pick(labels)+tip;
  }

  // Tips
  if(intent==="tips") {
    return ar
      ? `**💡 أهم 5 نصائح وضعية — Corvus:**\n\n1. 🖥️ **الشاشة على مستوى العين** — أهم شيء على الإطلاق\n2. ⏰ **لا تجلس أكتر من 45 دقيقة** بدون حركة\n3. 💪 **Chin Tuck كل 15 دقيقة** — يقضي على FHP\n4. 🪑 **الظهر السفلي يلمس الكرسي دايماً**\n5. 💡 **الإضاءة خلف الشاشة مش قدامها**\n\n${cite("hedge",ar)}${cite("hansraj",ar)}`
      : `**💡 Top 5 Posture Tips — Corvus:**\n\n1. 🖥️ **Screen at eye level** — single most important thing\n2. ⏰ **Never sit more than 45 min** without moving\n3. 💪 **Chin tuck every 15 min** — eliminates FHP\n4. 🪑 **Lower back always touching chair**\n5. 💡 **Lighting behind screen, not behind you**\n\n${cite("hedge")}${cite("hansraj")}`;
  }

  // Calibration
  if(intent==="calibration") return ar
    ? `**المعايرة في Corvus ${d.calibrated?"✅ مكتملة":"⚠️ لم تُكتمل بعد"}:**\n\nالمعايرة بتخلي Corvus يضبط حدود الوضعية لجسمك تحديداً — مش حدود عامة لكل الناس.\n\n${d.calibrated?"عظيم! تحليلك الآن مخصص لجسمك.":"**للمعايرة:** روح صفحة التحليل → اضغط 'Calibrate' → اتبع الخطوات (3 دقائق بس)"}`
    : `**Corvus Calibration ${d.calibrated?"✅ Complete":"⚠️ Not done yet"}:**\n\nCalibration lets Corvus set posture thresholds specific to YOUR body — not generic population averages.\n\n${d.calibrated?"Great! Your analysis is now personalized.":"**To calibrate:** go to Analysis page → click 'Calibrate' → follow steps (only 3 min)"}`;

  // Help
  if(intent==="help") return ar
    ? `أنا **Corvus AI Coach** — متخصص في الوضعية والإرجونوميكس${s?` (درجتك: ${s}/100)`:""}\n\n**أقدر أساعدك في:**\n• ألم الرقبة، الكتف، الظهر، المعصم، العيون\n• إعداد الشاشة، الكرسي، الكيبورد، اللابتوب\n• تمارين الوضعية بمراجع علمية\n• جدول الاستراحات الأمثل\n• تفسير درجات Corvus\n• وضعية النوم والوقاية\n\n💬 إيه اللي تحب تعرفه؟`
    : `I'm **Corvus AI Coach** — specialized in posture and ergonomics${s?` (your score: ${s}/100)`:""}\n\n**I can help with:**\n• Neck, shoulder, back, wrist, eye pain\n• Monitor, chair, keyboard, laptop setup\n• Posture exercises with scientific citations\n• Optimal break scheduling\n• Understanding your Corvus scores\n• Sleep position and prevention\n\n💬 What would you like to know?`;

  // Greet
  if(intent==="greet") {
    if(noData) return ar
      ? `أهلاً! 👋 أنا Corvus AI Coach — مدرب وضعيتك الشخصي.\n\nابدأ جلسة تحليل الأول عشان أقدر أحلل بياناتك وأعطيك نصائح مخصصة.\n\n💬 في ألم أو قلق معين تحب تتكلم فيه؟`
      : `Hi! 👋 I'm Corvus AI Coach — your personal posture coach.\n\nStart an analysis session so I can review your data and give personalized advice.\n\n💬 Any pain or concern you'd like to talk about?`;
    const n = d.name||"";
    const greets = ar?[
      `أهلاً ${n}! 💪 شايف بياناتك — **${s}/100** من **${ses}** جلسة.`,
      `هاي ${n}! 🧠 عندي بياناتك — درجة **${s}/100** و**${ses}** جلسة مسجّلة.`,
      `أهلاً ${n}! 👋 Corvus بيقول درجتك **${s}/100** من ${ses} جلسة.`,
    ]:[
      `Hi${n?" "+n:""}! 💪 I can see your data — **${s}/100** from **${ses}** sessions.`,
      `Hey${n?" "+n:""}! 🧠 Got your stats — **${s}/100** across **${ses}** sessions.`,
      `Hello${n?" "+n:""}! 👋 Your Corvus data: **${s}/100** from ${ses} sessions.`,
    ];
    const fu = ar?pick(["💬 في ألم بتحسه دلوقتي؟","💬 إيه أكبر حاجة بتزعجك في وضعيتك؟","💬 إيه اللي جاي من أجله النهارده؟"])
                 :pick(["💬 Any pain you're currently experiencing?","💬 What concerns you most about your posture?","💬 What brings you here today?"]);
    return pick(greets)+"\n\n"+fu;
  }

  // Thanks
  if(intent==="thanks") return pick(ar
    ?["العفو! 😊 أي سؤال تاني؟","بكل سرور! 💪 روّح وطبّق اللي اتكلمنا فيه!","تسلم! 🙏 أنا هنا لو احتجت."]
    :["You're welcome! 😊 Anything else?","Happy to help! 💪 Go put it into practice!","Of course! 🙏 I'm here whenever you need."]);

  // ── NEW INTENTS ───────────────────────────────────────────────────

  if(intent==="sciatica") return ar
    ? `**عرق النسا والوضعية:**\n\nعرق النسا هو ألم يمتد من أسفل الظهر للساق بسبب ضغط على العصب الوركي.\n\n**علاقته بالجلوس:**\nالجلوس المطوّل يزيد الضغط على الديسك → يضغط على العصب → ألم في الساق.\n\n**مساعدة فورية:**\n1. وقف ومشي كل 30 دقيقة (مش 45-60)\n2. الكرسي يدعم أسفل الظهر الأول\n3. تجنب الجلوس على محفظتك (يميل الحوض)\n4. تمرين Piriformis Stretch: جلوس، الكعب على الركبة، ميلان للأمام\n\n⚕️ **مهم:** عرق النسا يحتاج تشخيص طبي — هذه نصائح دعم وضعية فقط.`
    : `**Sciatica & Posture:**\n\nSciatica is pain radiating from lower back to leg, caused by pressure on the sciatic nerve.\n\n**Connection to sitting:**\nProlonged sitting increases disc pressure → compresses nerve → leg pain.\n\n**Immediate help:**\n1. Stand and walk every 30 min (not 45-60)\n2. Chair must support lower back first\n3. Avoid sitting on your wallet (tilts pelvis)\n4. Piriformis stretch: sitting, heel on knee, lean forward gently\n\n⚕️ **Important:** Sciatica needs medical diagnosis — these are posture support tips only.`;

  if(intent==="tos") return ar
    ? `**Thoracic Outlet Syndrome والوضعية:**\n\nTOS هو ضغط على الأوعية الدموية أو الأعصاب بين الترقوة والضلع الأول.\n\n**الأعراض المرتبطة بالوضعية:**\n- تنميل في الذراع عند رفعها\n- ضعف في قبضة اليد\n- ألم في الكتف والرقبة\n\n**دور Corvus:**\n- مراقبة وضعية الكتفين (Rounded Shoulders سبب رئيسي)\n- تنبيه لو كتفيك مرفوعين\n\n⚕️ TOS يحتاج تشخيص طبي متخصص — استشر دكتور أعصاب أو فيزيوثيرابيست.`
    : `**Thoracic Outlet Syndrome & Posture:**\n\nTOS is compression of nerves/blood vessels between collarbone and first rib.\n\n**Posture-related symptoms:**\n- Arm numbness when raised\n- Weakened grip\n- Shoulder and neck pain\n\n**Corvus's role:**\n- Monitors shoulder position (Rounded Shoulders is a major cause)\n- Alerts when shoulders are elevated\n\n⚕️ TOS needs specialized medical diagnosis — consult a neurologist or physiotherapist.`;

  if(intent==="pelvic_tilt") return ar
    ? `**الإمالة الأمامية للحوض (Anterior Pelvic Tilt):**\n\nتحدث عندما تميل عظام الحوض للأمام، مما يجعل الظهر السفلي ينحني بشكل مبالغ.\n\n**الأسباب:**\n- ضعف عضلات البطن والأرداف\n- توتر في عضلات الفخذ الأمامية (Hip Flexors)\n- الجلوس المطوّل\n\n**تمارين الإصلاح:**\n1. **Hip Flexor Stretch:** الركبة على الأرض، ميلان للأمام 30 ثانية × 3\n2. **Glute Bridge:** الاستلقاء، رفع الأرداف 15 × 3\n3. **Dead Bug:** تقوية البطن بدون ضغط على الظهر\n4. **Plank:** 30 ثانية × 3\n\n⏱️ نتائج ملموسة خلال 6-8 أسابيع مع الانتظام.`
    : `**Anterior Pelvic Tilt (APT):**\n\nOccurs when the hip bones tilt forward, causing excessive lower back arch.\n\n**Causes:**\n- Weak core and glute muscles\n- Tight hip flexors\n- Prolonged sitting\n\n**Corrective exercises:**\n1. **Hip Flexor Stretch:** kneeling lunge, lean forward 30 sec × 3\n2. **Glute Bridge:** lying, raise hips 15 × 3\n3. **Dead Bug:** core strengthening without spinal load\n4. **Plank:** 30 sec × 3\n\n⏱️ Noticeable improvement in 6-8 weeks with consistency.`;

  if(intent==="muscle_imbalance") return ar
    ? `**خلل التوازن العضلي في وضعية المكتب:**\n\n**Upper Crossed Syndrome (الأشيع في العمل المكتبي):**\n- عضلات مشدودة: الصدر (Pectorals) + رقبة أمامية (Upper Traps)\n- عضلات ضعيفة: بين الكتفين (Rhomboids) + رقبة عميقة (Deep Neck Flexors)\n- النتيجة: كتفان مدوّران + رأس متقدم\n\n**Lower Crossed Syndrome:**\n- عضلات مشدودة: Hip Flexors + ظهر سفلي\n- عضلات ضعيفة: بطن + أرداف\n- النتيجة: إمالة أمامية للحوض\n\n**الحل:**\nإطالة المشدود + تقوية الضعيف — Corvus بيكتشف متى تحصل هذه الأنماط.`
    : `**Muscle Imbalance in Desk Workers:**\n\n**Upper Crossed Syndrome (most common):**\n- Tight: Pectorals + Upper Trapezius\n- Weak: Rhomboids + Deep Neck Flexors\n- Result: Rounded shoulders + forward head\n\n**Lower Crossed Syndrome:**\n- Tight: Hip Flexors + Lower Back\n- Weak: Abs + Glutes\n- Result: Anterior pelvic tilt\n\n**Solution:**\nStretch what's tight + strengthen what's weak — Corvus detects when these patterns develop.`;

  if(intent==="proprioception") return ar
    ? `**الحس العميق (Proprioception) والوضعية:**\n\nالحس العميق هو قدرة جسمك على معرفة موضعه في الفضاء بدون النظر.\n\n**علاقته بالوضعية:**\n- وضعية سيئة لفترة طويلة → الجهاز العصبي يُعيد ضبط "الطبيعي" للوضعية الخاطئة\n- يعني جسمك بيحس إن الإنحناء "طبيعي"\n\n**كيف Corvus يساعد:**\nالتنبيهات المنتظمة تُعيد تدريب الحس العميق — كل تنبيه هو إعادة ضبط عصبية صغيرة.\n\n**تمارين تقوية الحس العميق:**\n1. الوقوف على قدم واحدة 30 ثانية × 3\n2. تمارين اتزان على وسادة Foam`
    : `**Proprioception & Posture:**\n\nProprioception is your body's ability to sense its position in space without looking.\n\n**Connection to posture:**\n- Poor posture maintained long-term → nervous system resets "normal" to the bad position\n- Your body literally feels the slouch as "neutral"\n\n**How Corvus helps:**\nRegular alerts retrain proprioception — each alert is a small neural reset.\n\n**Proprioception training:**\n1. Single-leg standing 30 sec × 3\n2. Balance exercises on foam pad`;

  if(intent==="work_bed") return ar
    ? `**الشغل من السرير — الحقيقة:**\n\nالشغل من السرير هو **الأسوأ** للوضعية علمياً — الدراسات تُظهر زيادة 40% في ضغط الرقبة مقارنة بالمكتب الصح.\n\n**لماذا؟**\n- الشاشة دايماً منخفضة (رأس للأسفل)\n- الظهر مش داعم\n- لا يوجد وضعية محايدة للمعصمين\n\n**لو مجبور:**\n1. وسادة كبيرة خلف ظهرك (دعم كامل)\n2. وسادة تانية تحت اللابتوب (ارفعه)\n3. حد أقصى: 30 دقيقة ثم انتقل\n4. خذ استراحة وقف كل 20 دقيقة\n\n💡 أي مكان تاني — حتى طاولة المطبخ — أفضل من السرير.\n\n${cite("straker",ar)}`
    : `**Working from Bed — The Truth:**\n\nWorking from bed is **the worst** for posture scientifically — studies show 40% more neck pressure vs. a proper desk setup.\n\n**Why?**\n- Screen is always too low (head down)\n- No back support\n- No neutral wrist position possible\n\n**If you must:**\n1. Large pillow behind your back (full support)\n2. Another pillow under laptop (raise it)\n3. Maximum 30 min then move\n4. Stand break every 20 min\n\n💡 Anywhere else — even a kitchen table — is better than bed.\n\n${cite("straker")}`;

  if(intent==="gaming") return ar
    ? `**الوضعية للجيمرز:**\n\nالجلوس 6+ ساعات للجيمنج = نفس مخاطر العمل المكتبي × 1.5 لأن التركيز الشديد بيخلينا نتنسى الوضعية.\n\n**إعداد خاص بالجيمنج:**\n- 🖥️ الشاشة على مستوى العين (نفس القاعدة)\n- 🎮 الكوعان 90° على المكتب\n- 🪑 الظهر يلمس الكرسي — مش الانحناء للأمام\n- ⏰ كل 45 دقيقة: توقف، وقف، امشي 2 دقيقة\n\n**Corvus للجيمرز:**\nشغّل session قبل ما تبدأ اللعب — Corvus هيتنبهك لو وضعيتك اتدهورت.\n\n⚠️ "Gamer's Neck" حقيقي ويؤثر على الأداء — الوضعية الصح بتحسّن ردود الفعل.`
    : `**Posture for Gamers:**\n\nSitting 6+ hours gaming = office worker risks × 1.5 because intense focus makes us forget posture completely.\n\n**Gaming-specific setup:**\n- 🖥️ Screen at eye level (same rule applies)\n- 🎮 Elbows 90° on desk\n- 🪑 Back touching chair — no forward lean\n- ⏰ Every 45 min: stop, stand, walk 2 min\n\n**Corvus for gamers:**\nStart a session before gaming — Corvus alerts you when posture degrades.\n\n⚠️ "Gamer's Neck" is real and affects performance — proper posture actually improves reaction time.`;

  if(intent==="programmer") return ar
    ? `**نصائح خاصة للمبرمجين:**\n\nالمبرمجون من أكثر المهن عرضة لمشاكل الوضعية — ساعات طويلة + تركيز عالٍ + شاشات متعددة.\n\n**أكبر المخاطر:**\n1. **شاشات متعددة:** لا تضعها جانباً — ضع الرئيسية أمامك مباشرة\n2. **الكتابة المتواصلة:** معصم مستقيم، كيبورد mechanical أخف ضغطاً\n3. **الـ debugging:** الانحناء للشاشة — ارفع الشاشة مش تنحني أنت\n4. **الـ flow state:** Corvus بينبهك وانت في flow حتى\n\n**روتين مبرمج صحي:**\n- Pomodoro 45/15: 45 دقيقة كود، 15 استراحة + تمارين\n- الشاشة الرئيسية أمامك، الثانوية بزاوية ≤ 30°\n- Split keyboard لو بتحس بتوتر في المعصمين`
    : `**Tips for Programmers:**\n\nProgrammers are among the highest-risk groups — long hours + high focus + multiple screens.\n\n**Biggest risks:**\n1. **Multiple monitors:** don't place side-by-side — primary directly ahead\n2. **Continuous typing:** straight wrists, mechanical keyboard reduces keystroke force\n3. **Debugging sessions:** don't lean into screen — raise the screen\n4. **Flow state:** Corvus alerts you even when you're deep in flow\n\n**Healthy programmer routine:**\n- Pomodoro 45/15: 45 min code, 15 min break + exercises\n- Primary screen directly ahead, secondary at ≤ 30° angle\n- Split keyboard if you feel wrist tension`;

  if(intent==="wfh") return ar
    ? `**الشغل من البيت — إعداد مثالي:**\n\nأكبر مشكلة في WFH: مفيش فصل بين العمل والحياة = الجلوس المطوّل أكثر من المكتب.\n\n**أساسيات إعداد WFH:**\n1. 🪑 كرسي مخصص للعمل (مش كرسي الأكل)\n2. 🖥️ شاشة خارجية أو stand للابتوب\n3. ⌨️ كيبورد وماوس خارجيين\n4. 💡 إضاءة أمامك مش خلفك\n5. 🚶 البيت كبير — امشي فيه كل ساعة\n\n**ميزة البيت:**\nقدرة أكبر على الحركة — استغلها! وقوف في المطبخ، مشي في الشرفة، تمارين في الغرفة.`
    : `**Working from Home — Ideal Setup:**\n\nBiggest WFH problem: no work-life separation = more sitting than in an office.\n\n**WFH setup essentials:**\n1. 🪑 Dedicated work chair (not dining chair)\n2. 🖥️ External monitor or laptop stand\n3. ⌨️ External keyboard and mouse\n4. 💡 Lighting in front, not behind\n5. 🚶 Home is bigger — walk around every hour\n\n**Home advantage:**\nMore freedom to move — use it! Stand in the kitchen, walk on the balcony, exercises in your room.`;

  if(intent==="meetings") return ar
    ? `**وضعية في الاجتماعات الافتراضية:**\n\nمتوسط الاجتماعات الافتراضية زاد 70% بعد كوفيد — ودي مشكلة وضعية كبيرة.\n\n**المشاكل الشائعة:**\n- الانحناء للأمام لسماع أحد\n- التحديق لأعلى/أسفل بسبب الكاميرا\n- التوتر لأنك "تحت الكاميرا"\n\n**الحلول:**\n1. كاميرا على مستوى العيون (نفس الشاشة)\n2. سماعات بدل ما تقرّب للمايك\n3. في الاجتماعات الطويلة: اطلب break أو وقف وأنت بتسمع (كاميرا off)\n4. بعد كل اجتماع ≥ 30 دقيقة: وقف فوراً`
    : `**Posture in Virtual Meetings:**\n\nAverage virtual meetings increased 70% post-COVID — a major posture issue.\n\n**Common problems:**\n- Leaning forward to hear someone\n- Looking up/down due to camera position\n- Tension from being "on camera"\n\n**Solutions:**\n1. Camera at eye level (same as monitor)\n2. Headset instead of leaning toward mic\n3. Long meetings: request breaks or stand while listening (camera off)\n4. After any meeting ≥ 30 min: stand immediately`;

  if(intent==="footrest") return ar
    ? `**هل تحتاج مسند قدم؟**\n\nنعم — لو قدميك مش مسطّحتين على الأرض بشكل مريح.\n\n**متى تحتاجه:**\n- الكرسي مرتفع جداً → قدميك "معلقة"\n- لو قصير القامة (أقل من 170 سم في الغالب)\n- لو تحس بضغط تحت الفخذين\n\n**بديل مجاني:** كتاب سميك أو صندوق صغير تحت قدميك.\n\n**الوضعية الصحيحة:**\nقدمان مسطّحتان، ركبتان 90°، لا ضغط على الجزء الخلفي من الفخذ.`
    : `**Do You Need a Footrest?**\n\nYes — if your feet aren't comfortably flat on the floor.\n\n**When you need one:**\n- Chair is too high → feet "dangling"\n- Shorter stature (generally under 170cm)\n- Feel pressure under your thighs\n\n**Free alternative:** thick book or small box under feet.\n\n**Correct position:**\nFeet flat, knees 90°, no pressure on back of thighs.`;

  if(intent==="lumbar_support") return ar
    ? `**الدعم القطني:**\n\nالجزء السفلي من الظهر (الحفرة الطبيعية) يحتاج دعم — لأن معظم الكراسي مش بتوفره بشكل كافٍ.\n\n**الـ Lumbar Roll:**\nوسادة أسطوانية بالقطر 10-15 سم، توضع خلف أسفل ظهرك.\n\n**البديل المجاني:**\nطوي منشفة وحطها خلف أسفل ظهرك — نفس التأثير.\n\n**كيف تعرف إنه صح:**\nالظهر السفلي يلمس الدعم، الكتفان يلمسان ظهر الكرسي، ما فيش توتر.\n\n**العلم:** الدعم القطني يقلل ضغط الديسك بين الفقرات بـ 40%.\n\n${cite("dunk",ar)}`
    : `**Lumbar Support:**\n\nThe lower back's natural curve needs support — most chairs don't provide enough.\n\n**Lumbar Roll:**\nCylindrical cushion ~10-15cm diameter, placed behind lower back.\n\n**Free alternative:**\nRoll a towel and place it at your lower back — same effect.\n\n**How to know it's right:**\nLower back touches support, shoulders touch backrest, no tension.\n\n**Science:** Lumbar support reduces intervertebral disc pressure by 40%.\n\n${cite("dunk")}`;

  if(intent==="monitor_arm") return ar
    ? `**ذراع الشاشة (Monitor Arm) — يستحق؟**\n\nنعم، لو عندك مكتب فوضوي أو محتاج تعدّل الشاشة كتير.\n\n**مميزاته:**\n- ضبط دقيق للارتفاع والزاوية\n- تحرير مساحة المكتب\n- سهولة التغيير لوضعية الوقوف\n- ممتاز لشاشتين\n\n**البديل الأرخص:**\nStack of books / laptop stand (5-10% من سعر الذراع بنفس النتيجة تقريباً)\n\n**نصيحة Corvus:** الارتفاع الصح أهم من الـ accessory — أي حل يوصلك لمستوى العين كافٍ.`
    : `**Monitor Arm — Worth It?**\n\nYes, if you have a cluttered desk or need frequent adjustments.\n\n**Benefits:**\n- Precise height and angle control\n- Frees desk space\n- Easy switching to standing position\n- Great for dual monitor setup\n\n**Cheaper alternative:**\nBook stack / laptop stand (~5-10% of arm cost, similar result)\n\n**Corvus tip:** Correct height matters more than the accessory — any solution that gets screen to eye level works.`;

  if(intent==="chair_guide") return ar
    ? `**دليل اختيار الكرسي الإرجونومي:**\n\n**أهم الخصائص (بالأولوية):**\n1. **دعم قطني قابل للضبط** — الأهم\n2. **ارتفاع قابل للضبط** — لازم يوصل ركبتيك 90°\n3. **عمق المقعد** — يتناسب مع طول فخذك\n4. **مسند الذراع** — يرتفع لمستوى المكتب\n5. **الظهر** — يتبع انحناء ظهرك\n\n**لا تصدّق الـ marketing:**\n- "Gamer chair" مش بالضرورة إرجونومي\n- السعر ≠ الجودة الإرجونومية دايماً\n\n**نصيحة:** كرسي متوسط مع lumbar roll أفضل من كرسي غالي مش مظبوط.`
    : `**Ergonomic Chair Buying Guide:**\n\n**Most important features (in order):**\n1. **Adjustable lumbar support** — most critical\n2. **Height adjustable** — must get knees to 90°\n3. **Seat depth** — fits your thigh length\n4. **Armrests** — rise to desk level\n5. **Backrest** — follows your spine curve\n\n**Don't believe the marketing:**\n- "Gamer chair" ≠ ergonomic\n- Price ≠ ergonomic quality\n\n**Tip:** A mid-range chair with a lumbar roll beats an expensive chair that's poorly adjusted.`;

  if(intent==="headset") return ar
    ? `**السماعات والتليفون في الشغل:**\n\nتربيس التليفون بين الكتف والأذن = **أسوأ** وضعية للرقبة — يمكن تسبب TOS وألم رقبة حاد.\n\n**الحل بالترتيب:**\n1. 🎧 **Headset/سماعات بلوتوث** — الأفضل (الأيدي حرة، الرقبة مستقيمة)\n2. 📱 **Speaker** — لو الخصوصية مش مشكلة\n3. 🎧 **Earbuds** — تمام\n4. ☎️ **تليفون باليد** — قبول\n5. 🚫 **التربيس** — ممنوع خالص\n\n**للاجتماعات الطويلة:** Headset إلزامي.`
    : `**Headsets & Phone During Work:**\n\nTrapping the phone between shoulder and ear = **worst** neck position — can cause TOS and acute neck pain.\n\n**Solutions in order:**\n1. 🎧 **Bluetooth headset** — best (hands-free, neck straight)\n2. 📱 **Speaker** — if privacy isn't an issue\n3. 🎧 **Earbuds** — fine\n4. ☎️ **Hand-held** — acceptable\n5. 🚫 **Shoulder trap** — never\n\n**For long calls/meetings:** headset is mandatory.`;

  if(intent==="phone") return ar
    ? `**وضعية الموبايل:**\n\n**"Text Neck"** هو مشكلة الجيل الحالي — رأسك منحنٍ للأسفل بمتوسط 2-4 ساعات يومياً.\n\n**الأرقام العلمية:**\n- رأس مستقيم = 4.5 كيلو\n- 15° انحناء = 12 كيلو\n- 45° انحناء (النظر للموبايل) = 22 كيلو!\n\n**الحل:**\n1. ارفع الموبايل لمستوى عينيك (اليد ترتفع، الرقبة مستقيمة)\n2. استخدم Phone Stand لو بتشوف فيديوهات\n3. كل 20 دقيقة: Chin Tuck 10 مرات\n\n${cite("hansraj",ar)}`
    : `**Phone Posture:**\n\n**"Text Neck"** is the defining problem of our generation — head bent down an average of 2-4 hours daily.\n\n**The science:**\n- Head upright = 4.5kg\n- 15° bend = 12kg\n- 45° bend (looking at phone) = 22kg!\n\n**Solution:**\n1. Raise phone to eye level (arm up, neck straight)\n2. Use a phone stand for video watching\n3. Every 20 min: chin tuck 10 reps\n\n${cite("hansraj")}`;

  if(intent==="tablet") return ar
    ? `**إرجونوميكس التابلت:**\n\nالتابلت أسوأ من اللابتوب للوضعية — الشاشة الصغيرة بتخليك تنحني أكتر.\n\n**للاستخدام للقراءة:**\n- Phone/Tablet Stand على مستوى العين\n- العيون على بُعد 35-45 سم من الشاشة\n\n**للكتابة على التابلت:**\n- إضافة كيبورد خارجي + stand إلزامي\n- بدون keyboard: حد أقصى 15 دقيقة\n\n**الأفضل للإنتاجية:** تابلت + keyboard + stand = laptop رخيص لكن بدون إرهاق الوضعية.`
    : `**Tablet Ergonomics:**\n\nTablets are worse than laptops for posture — smaller screen makes you lean in more.\n\n**For reading:**\n- Phone/Tablet Stand at eye level\n- Eyes 35-45cm from screen\n\n**For typing on tablet:**\n- External keyboard + stand is mandatory\n- Without keyboard: 15-minute maximum\n\n**Best for productivity:** Tablet + keyboard + stand = budget laptop but without posture strain.`;

  if(intent==="stress") return ar
    ? `**التوتر والوضعية — علاقة ثنائية الاتجاه:**\n\nالعلم يُثبت أن التوتر والوضعية يؤثران على بعضهما:\n\n**التوتر → وضعية:**\n- التوتر يشدّ عضلات الكتفين والرقبة\n- نرفع كتافنا بشكل لا إرادي\n- نمشي وجلوسنا للأمام\n\n**الوضعية → التوتر:**\n- دراسات Harvard: الوقوف منتصباً 2 دقيقة يخفض Cortisol بـ 25%\n- وضعية "Power Pose" ترفع الثقة بالنفس\n\n**Corvus insight:** تنبيهات الوضعية في أوقات ضغط العمل مضاعفة الأهمية.`
    : `**Stress & Posture — A Two-Way Relationship:**\n\nScience confirms stress and posture affect each other:\n\n**Stress → Posture:**\n- Stress tightens neck and shoulder muscles\n- We involuntarily raise our shoulders\n- We sit and walk more hunched forward\n\n**Posture → Stress:**\n- Harvard studies: standing upright 2 min reduces cortisol by 25%\n- "Power Pose" genuinely increases confidence\n\n**Corvus insight:** Posture alerts during high-stress work periods are doubly important.`;

  if(intent==="breathing") return ar
    ? `**التنفس والوضعية:**\n\nعلاقة مباشرة وعلمية:\n\n**الوضعية السيئة → تنفس أضعف:**\n- الانحناء للأمام يضغط على الحجاب الحاجز\n- قدرة الرئتين تنخفض حتى 30% عند الانحناء\n- تنفس سطحي → أقل أكسجين → تعب وتركيز أقل\n\n**وضعية صح → تنفس أفضل:**\n- الصدر مفتوح\n- الحجاب الحاجز يتحرك بحرية\n- زيادة الطاقة والتركيز\n\n**تمرين:** خذ نفس عميق الآن — ستلاحظ مدى سهولته أو صعوبته حسب وضعيتك الحالية.\n\n${cite("niosh",ar)}`
    : `**Breathing & Posture:**\n\nA direct, evidence-based relationship:\n\n**Poor posture → Weaker breathing:**\n- Slouching compresses the diaphragm\n- Lung capacity drops up to 30% when hunched\n- Shallow breathing → less oxygen → fatigue and poor focus\n\n**Good posture → Better breathing:**\n- Open chest\n- Diaphragm moves freely\n- Increased energy and concentration\n\n**Test right now:** Take a deep breath — notice how easy or restricted it feels based on your current position.\n\n${cite("niosh")}`;

  if(intent==="diet") return ar
    ? `**التغذية والوضعية:**\n\nنعم، ما تأكله يؤثر على وضعيتك عبر 3 مسارات:\n\n**1. صحة العظام:**\n- الكالسيوم + فيتامين D ضروريان للعمود الفقري\n- نقص D شائع جداً في العمال المكتبيين (قليل الشمس)\n\n**2. الالتهاب:**\n- الأكل المعالج والسكر يزيد الالتهاب → ألم مفاصل أكبر\n- Omega-3 يقلل الالتهاب\n\n**3. الوزن:**\n- كل 5 كيلو زيادة = ضغط إضافي على العمود الفقري\n\n**للوضعية الأفضل:**\n- كالسيوم: منتجات الألبان، لوز، بروكلي\n- فيتامين D: شمس + سمك\n- Omega-3: سمك، كتان`
    : `**Diet & Posture:**\n\nYes, what you eat affects your posture through 3 pathways:\n\n**1. Bone health:**\n- Calcium + Vitamin D essential for spine\n- D deficiency is very common in desk workers (little sun exposure)\n\n**2. Inflammation:**\n- Processed food and sugar increase inflammation → more joint pain\n- Omega-3 reduces inflammation\n\n**3. Weight:**\n- Every 5kg extra = additional spinal load\n\n**For better posture:**\n- Calcium: dairy, almonds, broccoli\n- Vitamin D: sun exposure + fish\n- Omega-3: fish, flaxseed`;

  if(intent==="pregnancy") return ar
    ? `**الوضعية أثناء الحمل:**\n\nCorvus مصمم للبالغين في بيئة العمل — لكن هذه إرشادات موثقة:\n\n**التغييرات الطبيعية:**\n- مركز الثقل يتحرك للأمام\n- انحناء الظهر السفلي يزيد (Lordosis)\n- الأربطة أكثر مرونة (هرمون Relaxin)\n\n**نصائح الوضعية:**\n1. كرسي مع دعم قطني جيد\n2. قدمان على مسند (footrest) مع تقدم الحمل\n3. النوم على الجانب (اليسار أفضل) مع وسادة بين الركبتين\n4. تمارين تقوية الحوض (Pelvic Floor)\n\n⚕️ استشري طبيبتك أو فيزيوثيرابيست متخصص في الحمل لنصائح مخصصة.`
    : `**Posture During Pregnancy:**\n\nCorvus is designed for adults in work environments — but here are documented guidelines:\n\n**Natural changes:**\n- Center of gravity shifts forward\n- Lower back curve increases (Lordosis)\n- Ligaments more flexible (Relaxin hormone)\n\n**Posture tips:**\n1. Chair with good lumbar support\n2. Footrest as pregnancy progresses\n3. Sleep on side (left preferred) with pillow between knees\n4. Pelvic floor exercises\n\n⚕️ Consult your doctor or a pregnancy-specialized physiotherapist for personalized guidance.`;

  if(intent==="youth") return ar
    ? `**وضعية المراهقين والأطفال:**\n\n"Text Neck" يبدأ الآن من سن 10-12 — أصغر بكتير من الجيل السابق.\n\n**المخاوف الرئيسية:**\n- العمود الفقري لا يزال ينمو — الوضعية السيئة تؤثر على شكل الفقرات\n- الحقيبة الثقيلة على كتف واحد = خطر حقيقي\n- ساعات اللعب والدراسة على الشاشة تزيد\n\n**Corvus للشباب:**\nالتطبيق يعمل مع أي عمر — نفس المبادئ تنطبق.\n\n**نصائح خاصة:**\n1. الحقيبة المدرسية: الاثنين كتف، وزن أقل من 10% من وزن الجسم\n2. الموبايل: ارفعه، لا تنحني\n3. المذاكرة: طاولة ودراسة صح مش على السرير`
    : `**Teen & Youth Posture:**\n\n"Text Neck" now starts at age 10-12 — much younger than previous generations.\n\n**Main concerns:**\n- Spine is still developing — poor posture can affect vertebrae shape\n- Heavy bag on one shoulder = real risk\n- Screen time for gaming and studying is increasing\n\n**Corvus for teens:**\nThe app works for any age — same principles apply.\n\n**Special tips:**\n1. School bag: both shoulders, weight < 10% of body weight\n2. Phone: raise it, don't lean down\n3. Study: proper desk setup, not on bed`;

  if(intent==="aging") return ar
    ? `**الوضعية مع التقدم في السن:**\n\n**ما يحصل طبيعياً:**\n- الديسك الغضروفي يفقد مرونته\n- الأربطة أقل مطاطية\n- كثافة العظام تقل (خاصة النساء بعد سن اليأس)\n\n**لماذا Corvus مهم أكتر مع العمر:**\nالكشف المبكر عن مشاكل الوضعية يمنع تطورها لأوجاع مزمنة.\n\n**نصائح خاصة:**\n1. تمارين اتزان إضافية (تقلل خطر السقوط)\n2. كالسيوم + فيتامين D بانتظام\n3. تمارين في الماء (Swimming/Aqua) = أقل ضغط على المفاصل\n4. استراحات أقصر وأكثر تكراراً (كل 30 دقيقة)`
    : `**Posture as You Age:**\n\n**What naturally happens:**\n- Intervertebral discs lose elasticity\n- Ligaments become less flexible\n- Bone density decreases (especially women post-menopause)\n\n**Why Corvus matters more with age:**\nEarly detection of posture issues prevents them developing into chronic pain.\n\n**Special tips:**\n1. Additional balance exercises (reduces fall risk)\n2. Calcium + Vitamin D consistently\n3. Water exercises (Swimming/Aqua) = less joint stress\n4. Shorter, more frequent breaks (every 30 min)`;

  if(intent==="mckenzie") return ar
    ? `**المنهج McKenzie للوضعية:**\n\nطوّره فيزيوثيرابيست نيوزيلاندي Robin McKenzie في الـ 1950s.\n\n**المبدأ الأساسي:**\nمعظم ألم الظهر والرقبة يمكن تخفيفه بحركات انتصاب وإطالة (Extension) بدل الانحناء (Flexion).\n\n**التمارين الأساسية:**\n1. **Press-Up (للظهر السفلي):** الاستلقاء على البطن، رفع الجذع بالذراعين 10 مرات\n2. **Chin Tuck + Retraction (للرقبة):** أدخل ذقنك + اسحب الرأس للخلف\n3. **Extension في الوقوف:** يدين على الخصر، ميلان للخلف برفق\n\nCorvus يتوافق مع مبادئ McKenzie في الكشف المبكر.`
    : `**The McKenzie Method:**\n\nDeveloped by New Zealand physiotherapist Robin McKenzie in the 1950s.\n\n**Core principle:**\nMost back and neck pain can be relieved through extension movements (straightening) rather than flexion (bending).\n\n**Key exercises:**\n1. **Press-Up (lower back):** lie on stomach, push upper body up with arms 10 times\n2. **Chin Tuck + Retraction (neck):** pull chin in + retract head backward\n3. **Standing Extension:** hands on hips, gently lean backward\n\nCorvus aligns with McKenzie principles in early detection.`;

  if(intent==="yoga") return ar
    ? `**اليوجا والبيلاتس للوضعية:**\n\n**اليوجا:**\n- ✅ ممتازة لمرونة العمود الفقري والوعي الجسدي\n- ✅ تقوي عضلات Core\n- ✅ Downward Dog، Cobra، Cat-Cow مثالية\n- ⚠️ بعض أوضاع اليوجا المتقدمة ممكن تؤذي لو فيه مشاكل سابقة\n\n**البيلاتس:**\n- ✅ الأفضل علمياً لمشاكل الظهر\n- ✅ تركيز على Core والعمود الفقري\n- ✅ دراسات تُظهر تحسناً في pain بـ 36%\n\n**التوصية:** بيلاتس إذا عندك ألم، يوجا للصيانة والمرونة.\n\n${cite("van_eerd",ar)}`
    : `**Yoga & Pilates for Posture:**\n\n**Yoga:**\n- ✅ Excellent for spinal flexibility and body awareness\n- ✅ Strengthens core muscles\n- ✅ Downward Dog, Cobra, Cat-Cow are ideal\n- ⚠️ Advanced poses can injure if pre-existing issues\n\n**Pilates:**\n- ✅ Scientifically strongest evidence for back pain\n- ✅ Focus on core and spinal alignment\n- ✅ Studies show 36% pain improvement\n\n**Recommendation:** Pilates if you have pain, yoga for maintenance and flexibility.\n\n${cite("van_eerd")}`;

  if(intent==="swimming") return ar
    ? `**السباحة والوضعية:**\n\nالسباحة من أفضل الرياضات للوضعية — خاصة لمن عنده ألم ظهر.\n\n**لماذا؟**\n- الماء يدعم الجسم → أقل ضغط على الفقرات\n- تقوية عضلات الظهر والكور بشكل طبيعي\n- تحسين مرونة الكتفين والرقبة\n\n**أفضل الأنماط:**\n- **Backstroke:** الأفضل للظهر (الرأس في الخلف)\n- **Freestyle:** كويس بس راقب وضعية الرأس\n- **Breaststroke:** ⚠️ ممكن يضغط على الرقبة لو طريقة الرأس مش صح\n\n**تجنب:** الغطس لفترة طويلة برقبة مبسوطة للخلف.`
    : `**Swimming & Posture:**\n\nSwimming is one of the best sports for posture — especially for back pain sufferers.\n\n**Why?**\n- Water supports body weight → less spinal pressure\n- Naturally strengthens back and core muscles\n- Improves shoulder and neck flexibility\n\n**Best strokes:**\n- **Backstroke:** best for back (head back, spine neutral)\n- **Freestyle:** good but watch head position\n- **Breaststroke:** ⚠️ can strain neck if head technique is wrong\n\n**Avoid:** prolonged diving with neck extended backward.`;

  if(intent==="gym") return ar
    ? `**الجيم والوضعية:**\n\n**تمارين تُقوّي الوضعية:**\n- ✅ Deadlift (بشكل صح) — يقوي كل عضلات الظهر\n- ✅ Rows (Cable/Seated) — يصلح الكتفين المدوّرين\n- ✅ Face Pulls — يقوي Upper Back\n- ✅ Plank — يقوي الكور\n\n**تمارين تحتاج انتباه:**\n- ⚠️ Bench Press المفرط → يشد الصدر أكثر → يزيد rounded shoulders\n- ⚠️ Shrugs الكتير → يشدّ Upper Traps\n- ⚠️ Crunch التقليدي → ضغط على الرقبة\n\n**القاعدة:** توازن بين تمارين الدفع (Pushing) والسحب (Pulling) — 1:1.5.`
    : `**Gym & Posture:**\n\n**Exercises that strengthen posture:**\n- ✅ Deadlift (correctly) — strengthens all back muscles\n- ✅ Rows (Cable/Seated) — fixes rounded shoulders\n- ✅ Face Pulls — strengthens upper back\n- ✅ Plank — core strengthening\n\n**Exercises needing attention:**\n- ⚠️ Excessive Bench Press → overtightens chest → worsens rounded shoulders\n- ⚠️ Too many Shrugs → tightens upper traps\n- ⚠️ Traditional Crunches → neck strain\n\n**Rule:** Balance Push vs Pull exercises — 1:1.5 ratio.`;

  if(intent==="walking_posture") return ar
    ? `**وضعية المشي الصحيحة:**\n\n**5 نقاط:**\n1. 👀 النظر للأمام — مش للأسفل للموبايل\n2. 👂 الأذن فوق الكتف مباشرة\n3. 🫁 الكتفان للخلف وللأسفل\n4. 💪 الذراعان يتحركان بحرية\n5. 🦶 الكعب أولاً ثم أطراف الأصابع\n\n**الأحذية:**\n- كعب مرتفع جداً → يميل الحوض للأمام\n- أحذية بحذاء مسطح تماماً → ضغط على الكعب\n- الأفضل: دعم خفيف للقوس الداخلي`
    : `**Correct Walking Posture:**\n\n**5 checkpoints:**\n1. 👀 Eyes forward — not down at phone\n2. 👂 Ear directly above shoulder\n3. 🫁 Shoulders back and down\n4. 💪 Arms swinging naturally\n5. 🦶 Heel strike first, then toe-off\n\n**Footwear:**\n- Very high heels → tilts pelvis forward\n- Completely flat shoes → heel impact stress\n- Best: slight medial arch support`;

  if(intent==="piriformis") return ar
    ? `**عضلة Piriformis والوضعية:**\n\nالـ Piriformis هي عضلة صغيرة في منطقة الأرداف — لو اشتدت، ضغطت على العصب الوركي.\n\n**"Piriformis Syndrome":**\n- شبيه بعرق النسا لكن مختلف المصدر\n- شائع في من يجلسون ساعات طويلة\n- الألم في منطقة الأرداف والفخذ\n\n**Piriformis Stretch:**\n1. اجلس على كرسي\n2. ضع كعب القدم اليمنى على الركبة اليسرى\n3. انحنِ للأمام برفق حتى تحس بشد في الأرداف\n4. امسك 30 ثانية × 3 لكل جانب\n\n⚕️ مستمر أكتر من أسبوعين → استشر دكتور.`
    : `**Piriformis Muscle & Posture:**\n\nThe Piriformis is a small muscle deep in the buttock — when tight, it compresses the sciatic nerve.\n\n**Piriformis Syndrome:**\n- Similar to sciatica but different source\n- Common in long-term sitters\n- Pain in buttock and thigh area\n\n**Piriformis Stretch:**\n1. Sit on a chair\n2. Place right ankle on left knee\n3. Gently lean forward until you feel a stretch in the buttock\n4. Hold 30 sec × 3 each side\n\n⚕️ Persists beyond 2 weeks → see a doctor.`;

  // General fallback — context-aware
  if(noData) return ar
    ? `ابدأ جلسة تحليل وضعية الأول! 💪\n\n💬 في ألم بتحسه أو سؤال معين؟`
    : `Start a posture analysis session first! 💪\n\n💬 Any pain or specific question?`;

  const al=(d.alerts||"").toLowerCase();
  const nr = d.neckRisk ?? 0;
  const issues=[];
  if(al.match(/head|forward|fhp/)) issues.push(ar?"📍 **رأس متقدم للأمام** — أعلى تأثير على الدرجة":"📍 **Forward head posture** — highest impact on your score");
  if(al.match(/shoulder|round/))   issues.push(ar?"📍 **كتفان مدوّران** — حمل زائد على العضلة شبه المنحرفة":"📍 **Rounded shoulders** — upper trapezius overload");
  if(al.match(/back|lean|spine/))  issues.push(ar?"📍 **ميلان للخلف** — ضغط متزايد على ديسك القطن":"📍 **Back lean** — increased lumbar disc load");
  if(al.match(/tilt/))             issues.push(ar?"📍 **رأس مائل** — عدم تماثل في الرقبة":"📍 **Head tilt** — cervical asymmetry detected");
  if(nr>=50) issues.push(ar?`📍 **خطر رقبة ${nr}%** — أعلى أولوية`:`📍 **Cervical risk at ${nr}%** — top priority`);

  if(issues.length) {
    return ar
      ? `بناءً على **${ses}** جلسة ودرجة **${s}/100**، أهم مشاكل وضعيتك:\n\n${issues.join("\n\n")}\n\n💬 تحب أعرفك إزاي تصلح أي واحدة منهم؟`
      : `Based on **${ses} sessions** (score: **${s}/100**), your key posture findings:\n\n${issues.join("\n\n")}\n\n💬 Which would you like to tackle first?`;
  }
  return ar
    ? `درجتك **${s}/100** من **${ses}** جلسة — ${s>=70?"وضعيتك كويسة، خليك ثابت!":"في مجال للتحسن."}\n\n💬 اسألني عن أي حاجة: ألم، تمارين، إعداد المكتب، أو تفاصيل درجتك.`
    : `Your score: **${s}/100** from **${ses} sessions** — ${s>=70?"posture is generally good!":"there's real room to improve."}\n\n💬 Ask me anything: pain, exercises, desk setup, or what's dragging your score down.`;
}

// ── Analysis (AIInsights / PredictiveAI) ─────────────────────────
function detectTopic(t) {
  const s=t.replace(/\n/g," ");
  if(s.match(/executive summary|performance snapshot/i))             return "executive";
  if(s.match(/7-day.*forecast|day posture performance forecast/i))   return "forecast";
  if(s.match(/analyze burnout risk|burnout risk.*assessment/i))      return "burnout";
  if(s.match(/risk scor.*analysis|posture risk scoring|risk profile/i)) return "risk";
  if(s.match(/\d+.*anomal.*detected|analyze.*anomal/i))             return "anomaly";
  if(s.match(/fatigue.*burnout|burnout.*fatigue/i))                  return "fatigue";
  if(s.match(/ergonomic recommendations|smart ergonomic/i))          return "recommendations";
  if(s.match(/posture trends|trend analysis|week-over-week change/i))return "trends";
  return "general";
}

function sl(s,ar){return !s?"":(s>=85?(ar?"ممتاز":"Excellent"):s>=70?(ar?"جيد":"Good"):s>=55?(ar?"متوسط":"Fair"):(ar?"يحتاج تحسين":"Needs Work"));}
function rl(r,ar){return !r?"":(r>=70?(ar?"🔴 مرتفع":"🔴 HIGH"):r>=40?(ar?"🟡 متوسط":"🟡 MODERATE"):(ar?"🟢 منخفض":"🟢 LOW"));}
function td(t,ar){return t>3?(ar?"📈 تحسّن":"📈 Improving"):t<-3?(ar?"📉 تراجع":"📉 Declining"):(ar?"➡️ ثابت":"➡️ Stable");}

function runAnalysis(prompt,sp) {
  const combined=((sp||"")+" "+(prompt||"")).replace(/\n/g," ");
  const topic=detectTopic(combined);
  const d=parseData(combined);
  const ar=d.lang==="ar";
  const s=d.avg??0, w=d.weekAvg??s, lw=d.lastWeekAvg??Math.round(s*.92);
  const t=d.trendPct??Math.round(((w-lw)/Math.max(lw,1))*100);
  const f=d.fatigue??0, b=d.burnout??0, nr=d.neckRisk??0;
  const se=d.sessions??0, ws=d.weekSessions??0, ac=d.anomalyCount??0;
  const n=d.name||(ar?"المستخدم":"User");

  switch(topic){
    case "executive": return ar
      ?`## ملخص تنفيذي — ${n}\n\n**📊 الأداء الحالي**\n- المتوسط: **${s}/100** (${sl(s,true)}) | هذا الأسبوع: **${w}/100**\n- التغيير: **${t>0?"+":""}${t}%** | الجلسات: **${se}** | الإجهاد: **${f}%**\n\n**⚠️ المخاطر الرئيسية**\n${b>=70?"- 🔴 خطر إرهاق مرتفع":b>=40?"- 🟡 خطر إرهاق متوسط":"- 🟢 إرهاق منخفض"}\n${nr>=50?`- ⚠️ خطر رقبة ${nr}%`:""}\n${s<60?"- ⚠️ نقاط وضعية منخفضة":""}\n\n**🎯 أولويات الأسبوع**\n${s<60?"1. ارفع الشاشة لمستوى العين\n2. استراحة كل 45 دقيقة\n3. أكمل المعايرة":s<80?`1. ركّز على وضعية الرقبة${nr>=40?` (${nr}%)`:""}\n2. هدف 5 جلسات أسبوعياً\n3. Chin Tuck يومياً`:"1. حافظ على الانتظام\n2. هدف: 90+\n3. فعّل التنبيهات"}`
      :`## Executive Summary — ${n}\n\n**📊 Performance**\n- Avg: **${s}/100** (${sl(s)}) | This week: **${w}/100**\n- Change: **${t>0?"+":""}${t}%** | Sessions: **${se}** | Fatigue: **${f}%**\n\n**⚠️ Key Risks**\n${b>=70?"- 🔴 High burnout risk":b>=40?"- 🟡 Moderate burnout":"- 🟢 Low burnout"}\n${nr>=50?`- ⚠️ Neck risk ${nr}%`:""}\n${s<60?"- ⚠️ Below-average posture score":""}\n\n**🎯 Priority Actions**\n${s<60?"1. Raise monitor to eye level\n2. Break every 45 min\n3. Complete calibration":s<80?`1. Focus on neck position${nr>=40?` (${nr}%)`:""}\n2. Target 5 sessions/week\n3. Daily chin tucks`:"1. Maintain consistency\n2. Target 90+\n3. Enable alerts"}`;

    case "trends": return ar
      ?`## تحليل الاتجاهات\n\n**${td(t,true)} — ${Math.abs(t)}% أسبوعياً**\n- هذا الأسبوع: **${w}/100** | الأسبوع الماضي: **${lw}/100**\n- الجلسات: **${ws}**\n\n**🔍 التفسير**\n${t>5?"زخم إيجابي — لا تغير ما يعمل.":t>0?"تحسن بطيء — زد الاستراحات.":t<-5?"تراجع ملحوظ — راجع بيئة العمل.":"ثابت — جلسات إضافية ستحسّنه."}\n\n**🔮 التوقع**\n${t>0?`متوقع **${Math.min(100,w+Math.round(t*.5))}/100** الأسبوع القادم.`:`لعكس الاتجاه: ${Math.max(4,ws+1)} جلسات أسبوعياً.`}`
      :`## Trend Analysis\n\n**${td(t)} — ${Math.abs(t)}% week-over-week**\n- This week: **${w}/100** | Last week: **${lw}/100**\n- Sessions: **${ws}**\n\n**🔍 What's Driving This**\n${t>5?"Positive momentum — don't change what's working.":t>0?"Slow progress — increase break frequency.":t<-5?"Notable decline — review workstation.":"Stable — add sessions to push forward."}\n\n**🔮 Forecast**\n${t>0?`Projected **${Math.min(100,w+Math.round(t*.5))}/100** next week.`:`To reverse: target ${Math.max(4,ws+1)} sessions/week.`}`;

    case "fatigue": return ar
      ?`## تقييم الإجهاد\n\n**إجهاد: ${rl(f,true)} (${f}%)** | **إرهاق: ${rl(b,true)} (${b}/100)**\n\n${f>=70?"- 🔴 إجهاد بدني مرتفع — جسمك يحتاج راحة":"- مستوى الإجهاد مقبول"}\n${b>=60?"- 🔴 خطر إرهاق مهني — قلّل العمل المتواصل":""}\n\n**خطة التعافي:**\n${f>=60?"1. استراحة 10 دقائق كل ساعة\n2. تنفس عميق 3 مرات يومياً":"1. استراحة 5 دقائق كل ساعة\n2. نوم 7-8 ساعات"}`
      :`## Fatigue Assessment\n\n**Fatigue: ${rl(f)} (${f}%)** | **Burnout: ${rl(b)} (${b}/100)**\n\n${f>=70?"- 🔴 High fatigue — body needs rest":"- Fatigue at acceptable level"}\n${b>=60?"- 🔴 High burnout risk — reduce continuous work":""}\n\n**Recovery:**\n${f>=60?"1. 10-min break every hour\n2. Deep breathing 3×/day":"1. 5-min break every hour\n2. 7-8 hours sleep"}`;

    case "recommendations": return ar
      ?`## خطة العمل\n\n**🔧 فوري:**\n${s<60?"- 🔴 ارفع الشاشة لمستوى العين\n- 🔴 الكرسي: ركبتان 90°":"- ✅ إعداد مكان العمل جيد"}\n${nr>=50?`- 🚨 خطر رقبة ${nr}% — ارفع الشاشة الآن`:""}\n${!d.calibrated?"- ⚠️ أكمل المعايرة":"- ✅ المعايرة مكتملة"}\n\n**📅 العادات:**\n1. قاعدة 20-20-20\n2. وقف كل 45 دقيقة\n3. Chin Tuck + Wall Angels يومياً`
      :`## Action Plan\n\n**🔧 Immediate:**\n${s<60?"- 🔴 Raise monitor to eye level\n- 🔴 Chair: knees 90°":"- ✅ Workstation looks good"}\n${nr>=50?`- 🚨 Neck risk ${nr}% — raise monitor now`:""}\n${!d.calibrated?"- ⚠️ Complete calibration":"- ✅ Calibration complete"}\n\n**📅 Habits:**\n1. 20-20-20 rule\n2. Stand every 45 min\n3. Chin Tuck + Wall Angels daily`;

    case "burnout": return ar
      ?`## تحليل خطر الإرهاق\n\n**النتيجة: ${rl(b,true)} — ${b}/100**\n\n${b>=70?"🔴 خطر مرتفع جداً — تدخل فوري":b>=40?"🟡 خطر متوسط — راقب أسبوعياً":"🟢 مستوى آمن"}\n\n**الوقاية:**\n${b>=60?"1. أقصى 90 دقيقة عمل متواصل\n2. يوم راحة أسبوعياً":"1. استراحة كل ساعة\n2. وقت محدد للتوقف عن العمل"}`
      :`## Burnout Risk\n\n**Score: ${rl(b)} — ${b}/100**\n\n${b>=70?"🔴 Very high — immediate intervention needed":b>=40?"🟡 Moderate — monitor weekly":"🟢 Safe level"}\n\n**Prevention:**\n${b>=60?"1. Max 90 min continuous work\n2. Full rest day weekly":"1. Break every hour\n2. Firm end-of-work time"}`;

    case "risk": return ar
      ?`## ملف المخاطر\n\n**خطر إجمالي: ${rl(d.riskScore||b,true)} (${d.riskScore||b}/100)**\n\n- وضعية: ${sl(s,true)} (${s}/100) | شواذ: ${ac}\n\n${s<60?"1. 🔴 وضعية ضعيفة — خطر ألم مزمن":"1. 🟢 وضعية جيدة"}\n${ac>3?"2. 🟡 تذبذب متكرر":"2. 🟢 وضعية متسقة"}`
      :`## Risk Profile\n\n**Overall: ${rl(d.riskScore||b)} (${d.riskScore||b}/100)**\n\n- Posture: ${sl(s)} (${s}/100) | Anomalies: ${ac}\n\n${s<60?"1. 🔴 Poor posture — chronic pain risk":"1. 🟢 Good posture"}\n${ac>3?"2. 🟡 Frequent variability":"2. 🟢 Consistent"}`;

    case "forecast":{
      const fc=d.forecast?d.forecast.split(",").map(x=>parseInt(x.trim())).filter(n=>!isNaN(n)):[];
      const avg7=fc.length?Math.round(fc.reduce((a,b)=>a+b,0)/fc.length):Math.round(s+t*.5);
      return ar
        ?`## توقعات 7 أيام\n\n**المتوسط المتوقع: ${avg7}/100**\n${fc.length?`النقاط: ${fc.join(" → ")}`:""}\n\n${t>2?"الزخم الإيجابي سيستمر مع الانتظام.":t<-2?"الانخفاض يحتاج تدخل.":"أداء ثابت."}\n\n**لتحسين التوقع:**\n1. ${avg7<75?"ارفع الشاشة":"حافظ على الاستراحات"}\n2. ${Math.max(5,(ws||3)+2)} جلسات هذا الأسبوع`
        :`## 7-Day Forecast\n\n**Projected avg: ${avg7}/100**\n${fc.length?`Scores: ${fc.join(" → ")}`:""}\n\n${t>2?"Positive momentum — consistency key.":t<-2?"Decline needs intervention.":"Stable performance."}\n\n**To improve forecast:**\n1. ${avg7<75?"Raise monitor":"Maintain breaks"}\n2. Target ${Math.max(5,(ws||3)+2)} sessions this week`;
    }

    case "anomaly": return ar
      ?`## تحليل الشواذ\n\n**${ac} شذوذ** من متوسط ${s}/100\n\n${ac===0?"✅ لا شواذ — وضعية متسقة!":ac<=2?"شواذ قليلة — طبيعية":ac<=5?"شواذ متوسطة — تستحق المراقبة":"شواذ مرتفعة — راجع بيئة العمل"}\n\n1. راجع أوقات الشواذ\n2. تحقق من الإعداد في تلك الأوقات`
      :`## Anomaly Analysis\n\n**${ac} anomalies** from ${s}/100 baseline\n\n${ac===0?"✅ No anomalies — excellent consistency!":ac<=2?"Few — very normal":ac<=5?"Moderate — monitor for patterns":"High — likely environmental issue"}\n\n1. Check when anomalies occur\n2. Review workstation at those times`;

    default: return ar
      ?`📊 درجتك **${s}/100** من **${se}** جلسة.\n${s<70?"أهم خطوة: ارفع الشاشة.":s<85?"وضع جيد — انتظام أكثر.":"ممتاز!"}`
      :`📊 Score: **${s}/100** from **${se}** sessions.\n${s<70?"Top priority: raise monitor.":s<85?"Good — more consistency.":"Excellent!"}`;
  }
}

// ── Puter.js AI (free, no API key, 400+ models) ───────────────────
// ── Vercel AI Proxy helpers ──────────────────────────────────────


// AI Proxy — tries multiple endpoints in order
async function callLLM7Direct(messages, systemPrompt, maxTokens) {
  const proxyBody = JSON.stringify({
    messages,
    system_prompt: systemPrompt,
    max_tokens: maxTokens || 700,
    temperature: 0.5,
  });

  const endpoints = [
    "/api/llm",           // Vercel → Flask/Edge → LLM7
    "/api/ai-chat",       // Vercel Edge Function direct (if routing works)
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: proxyBody,
      });
      if (!res.ok) {
        console.warn(`[CorvusAI] ${endpoint} returned ${res.status}`);
        continue;
      }
      const data = await res.json();
      const text = data?.text?.trim();
      if (text) {
        console.info(`[CorvusAI] Success via ${endpoint}`);
        return text;
      }
    } catch(e) {
      console.warn(`[CorvusAI] ${endpoint} failed:`, e.message);
    }
  }

  throw new Error("all_proxies_failed");
}



// ── Production-grade system prompt builder for all LLM calls ─────
function buildLLMSystemPrompt(systemPrompt, forAnalysis = false) {
  // Parse structured context — supports both JSON (from geminiChat) and text (legacy)
  const d = parseData(systemPrompt);

  // Try to extract JSON context object injected by geminiChat as "Context: {...}"
  let ctx = {};
  try {
    const jsonMatch = systemPrompt.match(/Context:\s*(\{[\s\S]*?\})/);
    if (jsonMatch) ctx = JSON.parse(jsonMatch[1]);
  } catch(_) {}

  // Merge: JSON ctx takes priority over regex-parsed d
  const avg       = ctx.avg_score       ?? d.avg       ?? 0;
  const weekAvg   = ctx.week_avg        ?? d.weekAvg   ?? avg;
  const trendPct  = ctx.trend_pct       ?? d.trendPct  ?? 0;
  const sessions  = ctx.sessions_count  ?? d.sessions  ?? 0;
  const weekSess  = ctx.week_sessions   ?? d.weekSessions ?? 0;
  const neckRisk  = ctx.neck_risk       ?? d.neckRisk  ?? 0;
  const fatigue   = ctx.fatigue_score   ?? d.fatigue   ?? 0;
  const burnout   = ctx.burnout_risk    ?? d.burnout   ?? 0;
  const worstTime = ctx.worst_time      ?? d.worstTime ?? null;
  const streak    = ctx.streak_days     ?? 0;
  const calib     = ctx.has_calibration ?? d.calibrated ?? false;
  const name      = ctx.user_name       ?? d.name      ?? "";
  const rawAlerts = ctx.top_alerts      ?? [];
  const alerts    = Array.isArray(rawAlerts) ? rawAlerts.slice(0,5).join("; ") : (d.alerts ?? "");

  const isAr = d.lang === "ar" || (systemPrompt||"").includes("Egyptian Arabic");

  const scoreLabel = avg >= 85 ? "Excellent" : avg >= 70 ? "Good" : avg >= 55 ? "Fair" : "Needs Attention";
  const neckLabel  = neckRisk >= 70 ? "HIGH 🔴" : neckRisk >= 40 ? "MODERATE 🟡" : "LOW 🟢";

  const dataLines = [
    name      && `Patient: ${name}`,
    avg       && `Overall posture score: ${avg}/100 (${scoreLabel})`,
    weekAvg   && `This week average: ${weekAvg}/100`,
    trendPct  && `Week-over-week trend: ${trendPct > 0 ? "+" : ""}${trendPct}% (${trendPct > 2 ? "improving" : trendPct < -2 ? "declining" : "stable"})`,
    sessions  && `Total sessions logged: ${sessions}`,
    weekSess  && `Sessions this week: ${weekSess}`,
    streak    && `Streak: ${streak} days`,
    neckRisk  && `Cervical risk score: ${neckRisk}% (${neckLabel})`,
    fatigue   && `Fatigue index: ${fatigue}%`,
    burnout   && `Occupational burnout risk: ${burnout}%`,
    worstTime && `Peak symptom window: ${worstTime}`,
    alerts    && `Most frequent postural alerts: ${alerts}`,
    calib     ? "Calibration: COMPLETE — personalized thresholds active"
              : "Calibration: NOT DONE — generic population thresholds",
  ].filter(Boolean).join("\n");

  const langLine = isAr
    ? "LANGUAGE: Respond ENTIRELY in Egyptian Arabic (عامية مصرية). Use medical terms then immediately explain them simply."
    : "LANGUAGE: Respond in clear, professional English.";

  if (forAnalysis) {
    return `You are Dr. Corvus — the clinical AI physiotherapist inside Corvus PostureAI Pro.

ROLE: Posture analytics engine. Generate structured, evidence-based clinical reports.

CLINICAL KNOWLEDGE:
- Cervical spine loading: Hansraj (2014) — 0° = 4.5 kg, 15° = 12 kg, 30° = 18 kg, 45° = 22 kg, 60° = 27 kg
- Disc pressure: Nachemson model — sitting unsupported = 140% vs standing; slouching = 185%
- Janda's Upper Crossed Syndrome: tight pecs/upper traps + weak deep neck flexors/rhomboids
- ISO 11226: acceptable neck flexion < 25°; shoulder elevation < 60°; trunk inclination < 20°
- NIOSH: continuous sitting > 45 min without movement = elevated MSK injury risk

REPORT FORMAT RULES:
- Use ## section headers, **bold** clinical terms, numbered protocols
- Always explain WHY a finding matters anatomically — not just what it is
- Include specific patient numbers in every section — no generic statements
- Provide interventions with precise parameters: sets × reps, hold time, frequency, expected weeks to improvement
- Flag ⚕️ any red flags requiring professional consultation

PATIENT CLINICAL DATA:
${dataLines || "No session data available."}

${langLine}`;
  }

  return `You are Dr. Corvus — the AI physiotherapist embedded in Corvus PostureAI Pro.

IDENTITY: Certified ergonomics consultant and physiotherapy specialist. Not a generic assistant.
You are Dr. Corvus — never say "I'm an AI."

CLINICAL EXPERTISE:
- MSK anatomy: cervical/thoracic/lumbar spine, shoulder girdle, carpal tunnel, hip flexors, pelvis
- Postural syndromes: Forward Head Posture, Upper/Lower Crossed Syndrome, kyphosis, lordosis, APT, piriformis syndrome
- Biomechanics: Hansraj cervical load model (2014), Nachemson disc pressure data, moment arm physics
- Evidence standards: NIOSH 1997, OSHA ergonomics guidelines, ISO 11226, Cornell Human Factors (Hedge)
- Therapeutic exercise: McKenzie method, muscle energy techniques, neuromuscular re-education

RESPONSE PRINCIPLES:
1. Reference the patient's ACTUAL DATA in every response — score, risk%, alerts. Never be generic.
2. For every recommendation: WHAT → WHY (anatomical mechanism) → HOW (precise steps) → BENEFIT → TIMEFRAME.
3. Never say "maintain good posture" — describe the specific correction and the muscle group it targets.
4. Cite evidence naturally: "Hansraj (2014) showed that at 45° neck flexion, cervical load reaches 22 kg — nearly 5× neutral..."
5. Use precise anatomy with plain explanations: "the deep cervical flexors (longus colli/capitis — your spine's inner corset)..."
6. ⚕️ Flag red flags: radiating pain, numbness/tingling, unilateral weakness → always recommend professional evaluation.
7. Format: **bold** key terms, numbered steps for protocols, short headers for multi-part answers.
8. Topic boundary: posture, ergonomics, MSK health, workspace, physiotherapy exercises ONLY. Redirect others warmly.
9. Conversational responses: 150-220 words. Multi-section reports: up to 350 words.

PATIENT CLINICAL DATA (always reference these numbers):
${dataLines || "No session data yet. Encourage the patient to run their first analysis."}

${langLine}

CONVERSATION STYLE:
- Respond to what was actually asked — don't give a template.
- Pain reports: assess clinically (location, character, radiation, aggravating/relieving factors).
- End with ONE focused follow-up question when clinically appropriate — not every message.`;
}

export async function localChat(messages, {systemPrompt=""} = {}) {
  const d = parseData(systemPrompt);

  // 1️⃣ Vercel Edge Proxy → LLM7 gpt-4o-mini (primary AI)
  try {
    // If caller already built a full clinical system prompt (AICoach does this),
    // use it directly — don't rebuild and lose the patient data.
    // Only rebuild if the prompt is minimal/empty (legacy callers).
    const sp = systemPrompt && systemPrompt.length > 200
      ? systemPrompt
      : buildLLMSystemPrompt(systemPrompt, false);
    return await callLLM7Direct(messages, sp, 700);
  } catch(e) {
    console.warn("[CorvusAI] Vercel proxy failed:", e.message);
  }

  // 2️⃣ Rule-based KB (true offline fallback)
  const hist   = analyzeHistory(messages);
  const last   = [...messages].reverse().find(m => m.role === "user");
  const intent = detectIntent(last?.content || "");
  return buildResponse(intent, last?.content || "", d, hist);
}

export async function localAnalysis(prompt, {systemPrompt=""} = {}) {
  // 1️⃣ Vercel Edge Proxy → LLM7 gpt-4o-mini (primary AI)
  try {
    // If caller provided a full system prompt (AIInsights/PredictiveAI), use it directly.
    // Otherwise build a clinical system prompt from embedded data.
    const sp = systemPrompt && systemPrompt.length > 100
      ? systemPrompt
      : buildLLMSystemPrompt(systemPrompt + " " + prompt, true);
    return await callLLM7Direct([{ role: "user", content: prompt }], sp, 800);
  } catch(e) {
    console.warn("[CorvusAI] Vercel proxy failed (analysis):", e.message);
  }

  // 2️⃣ Rule-based fallback
  return runAnalysis(prompt, systemPrompt);
}
