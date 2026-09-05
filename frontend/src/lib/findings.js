/**
 * findings.js — turns a metrics object into things a person can act on.
 *
 * The product measured thirteen things well and then showed them as thirteen
 * numbers: "Neck lean 17.4°". A number is not a finding. It does not say
 * whether 17.4 is bad, why it would matter, or what to do differently, and
 * every screen that displayed one invented its own answer to those questions —
 * or skipped them.
 *
 * One finding, five layers, in the order a person actually needs them:
 *
 *   1  WHAT IS WRONG      a plain-language name, not a metric id
 *   2  HOW SERIOUS        the engine's own severity, never re-derived here
 *   3  WHY IT MATTERS     the mechanism, in one sentence
 *   4  WHAT TO DO         a specific correction, using the measured value
 *   5  TECHNICAL          the number, its unit, its score, its reliability
 *
 * Rules this module holds to, because the screens that used to do this each
 * broke at least one of them:
 *
 *   · A metric the camera could not measure is NOT a finding about posture.
 *     It is a finding about the camera, and it says so and how to fix it.
 *     It never borrows a default score and renders as healthy.
 *   · Severity comes from the engine, which classifies each metric against its
 *     own clinical thresholds. Deriving seriousness from the 0-100 score here
 *     would be a second answer to the same question, and the two would drift.
 *   · Findings are ranked by how much each is actually costing the score —
 *     weight x shortfall — so the top of the list is the thing worth fixing
 *     first, not whichever metric happens to be declared first in the engine.
 *   · Nothing here diagnoses. These are observations about how someone is
 *     sitting, with the ergonomic reasoning stated so they can judge it. The
 *     copy says "linked to" and "associated with", never "you have".
 */
import { WEIGHTS_FRONT } from "../features/analysis/postureEngine.js";

/** Internal adjustments, not observations about the body. */
export const NON_POSTURAL = new Set(["session_fatigue", "position_penalty", "confidence_val"]);

/** Metric id -> the weight key it is scored under, for ranking by real cost. */
const WEIGHT_KEY = {
  neck_lean: "neck", head_tilt: "tilt", shoulder_level: "shoulder", spine_lean: "spine",
  screen_distance: "distance", head_yaw: "yaw", rounded_shoulders: "rounded",
  fhp_index: "fhp", monitor_height: "monitor", shoulder_elevation: "shElev",
  torso_flexion: "torso", trunk_rotation: "twist", elbow_angle: "elbow",
};

export const SEVERITY_ORDER = { severe: 3, moderate: 2, mild: 1, normal: 0 };

export const SEVERITY_LABEL = {
  severe:   { en: "Needs attention", ar: "محتاج انتباه" },
  moderate: { en: "Moderate",        ar: "متوسط" },
  mild:     { en: "Mild",            ar: "بسيط" },
  normal:   { en: "In range",        ar: "في المدى الطبيعي" },
};

export const SEVERITY_COLOR = { severe: "#C6604F", moderate: "#D6A24C", mild: "#B8923F", normal: "#4FAE8E" };

const n1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

/**
 * A sentence must never contain the word "null".
 *
 * The copy below interpolates measured values directly, which is what makes it
 * specific — "your head sits 6.2cm in front of your shoulders" rather than
 * "your head is forward". The cost is that a metric arriving with a score but
 * no value renders "about nullcm", which is worse than saying nothing. This is
 * the net under all thirteen strings, so a future copy edit cannot reintroduce
 * it: if the generated sentence contains a non-value, the value-free fallback
 * is used instead.
 */
function safeText(fn, m, ar, fallback) {
  try {
    const out = fn(m, ar);
    return /\b(null|NaN|undefined)\b|nullcm|NaNcm/.test(out) ? fallback : out;
  } catch { return fallback; }
}

/**
 * The library. `what` describes the observation using the measured value,
 * `why` gives the mechanism, `act` gives the correction. All three take the
 * metric so the copy can be specific rather than generic.
 *
 * `unmeasured` explains what the camera needs in order to read this at all —
 * for a laptop user the hip-derived metrics are genuinely unmeasurable, and
 * saying so is more useful than a grey row.
 */
const LIB = {
  fhp_index: {
    title: { en: "Forward head position", ar: "الرأس للأمام" },
    what: (m, ar) => ar
      ? `راسك مُتقدّمة حوالي ${n1(m.value)} سم قدّام خط كتفيك.`
      : `Your head sits about ${n1(m.value)}cm in front of your shoulder line.`,
    why: (m, ar) => {
      const kg = m.extra_load_kg;
      const load = Number.isFinite(kg) && kg > 0
        ? (ar ? ` عند الزاوية دي، رقبتك بتشيل حوالي ${kg} كجم زيادة عن وزن الرأس الطبيعي.`
              : ` At this angle your neck carries roughly ${kg}kg more than the head's resting weight.`)
        : "";
      return ar
        ? `كل ما الرأس تتقدّم عن الكتفين، عضلات الرقبة الخلفية بتشتغل أكتر عشان تمسكها.${load} ده الوضع الأكتر ارتباطاً بشد الرقبة وأعلى الظهر في شغل المكتب.`
        : `The further the head sits ahead of the shoulders, the harder the muscles at the back of the neck work to hold it there.${load} This is the pattern most commonly associated with neck and upper-back strain in desk work.`;
    },
    act: (m, ar) => ar
      ? `ادخل دقنك للداخل (مش لتحت) لحد ما ودنك تبقى فوق كتفك. لو رجعت تتقدّم كل شوية، غالباً الشاشة بعيدة أو الخط صغير — قرّبها أو كبّر الخط.`
      : `Tuck your chin straight back — not down — until your ear sits over your shoulder. If it keeps drifting forward, the screen is usually too far or the text too small: move it closer or increase the font size.`,
    unmeasured: { en: "Needs both ears and both shoulders visible. Face the camera squarely and make sure your head isn't turned.",
                  ar: "محتاج الودنين والكتفين يبانوا. واجه الكاميرا مباشرة ومتلفّش راسك." },
  },

  neck_lean: {
    title: { en: "Head tilted to one side", ar: "الرأس مايلة لجنب" },
    what: (m, ar) => ar
      ? `راسك مايلة حوالي ${n1(m.value)}° عن الخط الرأسي فوق كتفيك.`
      : `Your head is leaning about ${n1(m.value)}° off vertical over your shoulders.`,
    why: (m, ar) => ar
      ? `الميل المستمر لجنب واحد بيخلّي عضلات جنب واحد من الرقبة شغّالة طول الوقت والتانية مرتخية — وده مصدر شائع لشد من ناحية واحدة.`
      : `Holding a sideways lean keeps the muscles on one side of the neck working continuously while the other side stays slack — a common source of one-sided tightness.`,
    act: (m, ar) => ar
      ? `الميل الجانبي المستمر غالباً مش عادة — غالباً الشاشة مش في نص مجال نظرك، أو إنك مستند على إيد واحدة. حط الشاشة في النص وسيب دراعينك على المكتب بالتساوي.`
      : `A persistent sideways lean is usually not a habit — it is usually the screen sitting off-centre, or leaning on one arm. Centre the monitor and rest both forearms evenly on the desk.`,
    unmeasured: { en: "Needs both ears and both shoulders in frame.",
                  ar: "محتاج الودنين والكتفين في الكادر." },
  },

  head_tilt: {
    title: { en: "Head roll", ar: "دوران الرأس" },
    what: (m, ar) => ar
      ? `خط عينيك مايل حوالي ${n1(m.value)}° عن الأفقي.`
      : `Your eye line is about ${n1(m.value)}° off level.`,
    why: (m, ar) => ar
      ? `مفيش مشكلة في الميل اللحظي، لكن الثبات عليه بيخلّي العين والرقبة بيصحّحوا طول الوقت عشان يحافظوا على صورة مستقيمة.`
      : `A momentary tilt is nothing, but holding one makes the eyes and neck correct continuously to keep the image level.`,
    act: (m, ar) => ar
      ? `شوف لو الشاشة نفسها مايلة أو لو انت مستند على جنب. أسهل تصحيح: خلّي حافة الشاشة العليا موازية لعينيك.`
      : `Check whether the screen itself is tilted, or whether you are propped on one side. The quickest fix is to make the top edge of the screen parallel with your eye line.`,
    unmeasured: { en: "Needs both eyes visible — move out of shadow or improve the lighting.",
                  ar: "محتاج العينين يبانوا — اخرج من الضل أو حسّن الإضاءة." },
  },

  shoulder_level: {
    title: { en: "Uneven shoulders", ar: "الكتفين مش متساويين" },
    what: (m, ar) => {
      const side = Number.isFinite(m.signed) ? (m.signed > 0 ? (ar ? "اليمين" : "right") : (ar ? "الشمال" : "left")) : null;
      return ar
        ? `كتفيك مش على نفس المستوى — فرق حوالي ${n1(m.value)}°${side ? `، الكتف ${side} أوطى` : ""}.`
        : `Your shoulders are about ${n1(m.value)}° out of level${side ? `, the ${side} one lower` : ""}.`;
    },
    why: (m, ar) => ar
      ? `فرق بسيط بين الكتفين طبيعي عند أغلب الناس. اللي بيفرق هو استمراره طول الجلسة — ساعتها غالباً السبب إعداد المكتب مش الجسم.`
      : `A small difference between shoulders is normal in most people. What matters is holding it for a whole session — when that happens the cause is usually the desk setup rather than the body.`,
    act: (m, ar) => ar
      ? `اظبط مسندي الذراع على نفس الارتفاع، وشوف لو ماوس أو كيبورد بيخلّيك ترفع كتف واحد. لو الفرق مستمر عبر جلسات كتير، يستاهل تسأل أخصائي علاج طبيعي — مش تشخيص.`
      : `Set both armrests to the same height and check whether the mouse or keyboard is making you lift one shoulder. If it persists across many sessions it is worth mentioning to a physiotherapist — this is an observation, not a diagnosis.`,
    unmeasured: { en: "Needs both shoulders in frame — sit back a little or tilt the camera up.",
                  ar: "محتاج الكتفين في الكادر — ارجع لورا شوية أو ارفع الكاميرا." },
  },

  spine_lean: {
    title: { en: "Trunk leaning sideways", ar: "الجذع مايل لجنب" },
    what: (m, ar) => {
      const side = Number.isFinite(m.signed) ? (m.signed > 0 ? (ar ? "اليمين" : "your right") : (ar ? "الشمال" : "your left")) : null;
      return ar
        ? `جذعك مايل حوالي ${n1(m.value)}°${side ? ` ناحية ${side}` : ""} عن الرأسي.`
        : `Your trunk is leaning about ${n1(m.value)}°${side ? ` to ${side}` : ""} off vertical.`;
    },
    why: (m, ar) => ar
      ? `الميل من الوسط بينقل وزنك على نصف الحوض، فجنب واحد من عضلات أسفل الظهر بيفضل شغّال عشان يمنعك من الميل أكتر.`
      : `Leaning from the waist shifts your weight onto one side of the pelvis, so one side of the lower back stays engaged to stop you tipping further.`,
    act: (m, ar) => ar
      ? `وزّع وزنك على عظمتي الجلوس بالتساوي وادفع حوضك لآخر الكرسي. الميل المستمر غالباً بسبب مسند ذراع واحد أو إن الشاشة مش في النص.`
      : `Put equal weight on both sitting bones and push your hips to the back of the chair. A persistent lean is usually one armrest, or a screen that is not centred.`,
    unmeasured: { en: "Needs your hips in frame. On a laptop they are usually below the picture — this metric is often unavailable while seated close, which is expected, not a fault.",
                  ar: "محتاج الحوض يبان في الكادر. على اللابتوب غالباً بيكون تحت الصورة — فالمقياس ده كتير مش متاح وانت قاعد قريب، وده طبيعي." },
  },

  torso_flexion: {
    title: { en: "Slouching forward", ar: "انحناء لقدّام" },
    what: (m, ar) => ar
      ? `جذعك مائل لقدّام — الطول الظاهر لجذعك أقصر بحوالي ${n1(m.value)}٪ من وضعك المستقيم.`
      : `Your trunk is folding forward — its visible length is about ${n1(m.value)}% shorter than when you sit tall.`,
    why: (m, ar) => ar
      ? `لما القفص الصدري ينزل ناحية الحوض، الأقراص في أسفل الظهر بتشيل ضغط أعلى منها وانت قاعد مستقيم، والحجاب الحاجز بيتضغط فالنَفَس بيبقى أقصر.`
      : `When the ribcage drops toward the pelvis, the discs in the lower back take more load than they do sitting tall, and the diaphragm is compressed so breathing gets shallower.`,
    act: (m, ar) => ar
      ? `ادفع حوضك لآخر الكرسي وخلّي ضهرك مستند على المسند، وارفع قفصك الصدري شوية. لو الكرسي مفيهوش دعم لأسفل الظهر، منشفة ملفوفة بتعمل الشغل.`
      : `Push your hips to the back of the chair so your back meets the backrest, and lift your ribcage slightly. If the chair has no lumbar support, a rolled towel does the job.`,
    unmeasured: { en: "Needs shoulders and hips both in frame, and a few seconds of sitting still first to learn your upright baseline.",
                  ar: "محتاج الكتفين والحوض في الكادر، وكام ثانية ثبات في الأول عشان يتعلّم وضعك المستقيم." },
  },

  trunk_rotation: {
    title: { en: "Torso turned", ar: "الجذع ملفوف" },
    what: (m, ar) => ar
      ? `جذعك مِلفوف حوالي ${n1(m.value)}° عن مواجهة الكاميرا.`
      : `Your torso is turned about ${n1(m.value)}° away from facing the camera.`,
    why: (m, ar) => ar
      ? `اللف المستمر بيخلي الجذع في وضع غير متماثل لفترة طويلة، وده غالباً بيرجع لإعداد المكتب أكتر من العادة.`
      : `Sustained rotation holds the trunk asymmetrically for long stretches, and it usually traces back to the desk layout rather than to habit.`,
    act: (m, ar) => ar
      ? `صَفّ الكرسي مواجه للشاشة بدل ما تلف جسمك ليها. لو بتشتغل على شاشتين، حط اللي بتستخدمها أكتر قدّامك مباشرة.`
      : `Square the chair to the screen instead of turning your body toward it. On a dual-monitor setup, put the one you use most directly in front of you.`,
    unmeasured: { en: "Needs shoulders and hips in frame together.", ar: "محتاج الكتفين والحوض مع بعض في الكادر." },
  },

  rounded_shoulders: {
    title: { en: "Rounded shoulders", ar: "كتفين مدوّرين" },
    what: (m, ar) => ar
      ? `كتفيك مدوّرين لقدّام أكتر من وضعهم المحايد.`
      : `Your shoulders are rolled further forward than their neutral position.`,
    why: (m, ar) => ar
      ? `تدوير الكتفين بيقفل مساحة الصدر ويسحب لوح الكتف لقدّام، وده بيخلّي رفع الدراع فوق مستوى الكتف أقل راحة مع الوقت.`
      : `Rolling the shoulders forward closes the chest and draws the shoulder blades apart, which over time makes raising the arm overhead less comfortable.`,
    act: (m, ar) => ar
      ? `اسحب لوحي الكتف لبعض ولتحت — مش لفوق. لو المكتب عالي وبتوصل بدراعك لقدّام، نزّله أو قرّب الكيبورد.`
      : `Draw your shoulder blades together and down — not up. If the desk is high and you are reaching forward, lower it or bring the keyboard closer.`,
    unmeasured: { en: "Needs both ears and both shoulders visible.", ar: "محتاج الودنين والكتفين يبانوا." },
  },

  shoulder_elevation: {
    title: { en: "Shoulders held up", ar: "الكتفين مرفوعين" },
    what: (m, ar) => ar
      ? `كتفيك مرفوعين حوالي ${n1(m.value)}٪ فوق وضعهم المرتخي.`
      : `Your shoulders are held about ${n1(m.value)}% above their relaxed position.`,
    why: (m, ar) => ar
      ? `رفع الكتفين شغل عضلي مستمر — عضلة الترابيس العليا بتفضل مشدودة طول ما انت قاعد كده، وغالباً من غير ما تحس.`
      : `Holding the shoulders up is continuous muscular work: the upper trapezius stays contracted for as long as you sit that way, usually without you noticing.`,
    act: (m, ar) => ar
      ? `خد نَفَس، وارفع كتفيك لفوق بالكامل، وسيبهم ينزلوا. لو رجعوا يتشدّوا تاني بسرعة، المكتب أو مسند الذراع غالباً عالي أوي.`
      : `Take a breath, shrug all the way up, then let them drop. If they creep back up quickly, the desk or armrests are probably too high.`,
    unmeasured: { en: "Needs ears and shoulders visible, plus a few seconds of stillness to learn your relaxed height.",
                  ar: "محتاج الودنين والكتفين، وكام ثانية ثبات عشان يتعلّم ارتفاعك المرتاح." },
  },

  head_yaw: {
    title: { en: "Head turned", ar: "الرأس ملفوفة" },
    what: (m, ar) => ar
      ? `راسك ملفوفة حوالي ${n1(m.value)}° عن مواجهة الكاميرا.`
      : `Your head is turned about ${n1(m.value)}° away from facing the camera.`,
    why: (m, ar) => ar
      ? `اللف المستمر للرأس بيقصّر عضلات جنب واحد من الرقبة، وبيقلّل كمان دقة باقي القياسات لأن نص الوجه بيختفي عن الكاميرا.`
      : `Sustained head rotation shortens the muscles on one side of the neck, and it also degrades the other readings, because half the face turns away from the camera.`,
    act: (m, ar) => ar
      ? `حط الشاشة قدّامك مباشرة. لو بتبص على ورق أو شاشة تانية على جنب، حطهم في النص وقت ما تشتغل عليهم بدل ما تفضل لافف.`
      : `Put the screen directly in front of you. If you are looking at paper or a second display off to the side, move it in front of you while you use it instead of staying turned.`,
    unmeasured: { en: "Needs your face toward the camera. If it stays unmeasured, the camera is likely off to one side.",
                  ar: "محتاج وشك ناحية الكاميرا. لو فضل مش متقاس، غالباً الكاميرا على جنب." },
  },

  screen_distance: {
    title: { en: "Screen distance", ar: "مسافة الشاشة" },
    what: (m, ar) => ar
      ? `انت على بُعد حوالي ${n1(m.value)} سم من الكاميرا.`
      : `You are sitting about ${n1(m.value)}cm from the camera.`,
    why: (m, ar) => ar
      ? `القرب الزيادة بيخلّي العين تركّز أكتر وبيسحب الرأس لقدّام؛ والبُعد الزيادة بيخلّيك تميل بجسمك عشان تقرا. المدى المريح لأغلب الناس 50-70 سم.`
      : `Sitting too close increases eye strain and pulls the head forward; too far and you lean in to read. For most people 50-70cm is the comfortable range.`,
    act: (m, ar) => {
      const v = n1(m.value);
      if (v != null && v < 50) return ar ? `ابعد الشاشة شوية لحد ما توصل 50-70 سم. لو ده بيصعّب القراية، كبّر الخط بدل ما تقرّب.`
                                         : `Move back until you are 50-70cm away. If that makes text hard to read, increase the font size rather than moving closer.`;
      if (v != null && v > 70) return ar ? `قرّب الشاشة لحد 50-70 سم عشان متضطرش تميل بجسمك.`
                                         : `Bring the screen to 50-70cm so you are not leaning in to read.`;
      return ar ? `المسافة في المدى المريح — خليها كده.` : `You are in the comfortable range — keep it there.`;
    },
    unmeasured: { en: "Needs both shoulders in frame to estimate scale.", ar: "محتاج الكتفين في الكادر عشان يقدّر المقياس." },
  },

  monitor_height: {
    title: { en: "Monitor height", ar: "ارتفاع الشاشة" },
    what: (m, ar) => {
      const dir = m.direction === "below" ? (ar ? "تحت" : "below") : (ar ? "فوق" : "above");
      return ar ? `مستوى نظرك حوالي ${n1(m.value)} سم ${dir} مستوى العين.`
                : `Your gaze line is about ${n1(m.value)}cm ${dir} eye level.`;
    },
    why: (m, ar) => ar
      ? `الشاشة الواطية بتخلّيك تبص لتحت طول اليوم، وده أشهر سبب ميكانيكي لتقدّم الرأس. الشاشة العالية أوي بتخلّيك ترفع دقنك، وده بيضغط خلف الرقبة.`
      : `A low screen makes you look down all day, which is the most common mechanical cause of forward head position. Too high and you tip your chin up, which compresses the back of the neck.`,
    act: (m, ar) => ar
      ? `خلّي أعلى الشاشة عند مستوى عينك تقريباً. كتاب أو اتنين تحت اللابتوب بيحلّوها — ولو عملت كده استخدم كيبورد خارجي.`
      : `Set the top of the screen at roughly eye level. A couple of books under a laptop does it — and if you raise a laptop, use an external keyboard.`,
    unmeasured: { en: "Needs eyes and ears visible. Without calibration this reading carries a face-shape bias, so it is only reported when clearly off.",
                  ar: "محتاج العينين والودنين يبانوا. من غير معايرة القراءة فيها انحياز لشكل الوش، فبتتقال بس لما تكون واضحة." },
  },

  elbow_angle: {
    title: { en: "Elbow angle", ar: "زاوية الكوع" },
    what: (m, ar) => ar ? `زاوية كوعك حوالي ${n1(m.value)}°.` : `Your elbow is at about ${n1(m.value)}°.`,
    why: (m, ar) => ar
      ? `الكوع المفرود زيادة معناه إنك بتوصل لقدّام للماوس، وده بيشيّل الكتف؛ والمقفول زيادة معناه المكتب عالي.`
      : `Too open and you are reaching forward for the mouse, which loads the shoulder; too closed and the desk is too high.`,
    act: (m, ar) => ar
      ? `اظبط ارتفاع الكرسي لحد ما كوعك يبقى حوالي 90-110° ودراعك مستريح، وقرّب الماوس لجنب الكيبورد.`
      : `Set the chair height so your elbow rests near 90-110° with the forearm supported, and bring the mouse alongside the keyboard.`,
    unmeasured: { en: "Needs your elbows in frame — on a laptop your hands are usually below the picture, so this is often unavailable.",
                  ar: "محتاج الكوعين في الكادر — على اللابتوب إيديك غالباً تحت الصورة، فالمقياس ده كتير مش متاح." },
  },
};

/**
 * Build the ranked findings for one metrics object.
 *
 * @param {object} metrics  the engine's `metrics` payload
 * @param {{lang?:string, calibrated?:boolean, limit?:number, includeNormal?:boolean}} opts
 */
export function buildFindings(metrics, { lang = "en", calibrated = false, limit = 0, includeNormal = false } = {}) {
  const ar = lang === "ar";
  const out = [], unmeasured = [];
  let measured = 0;

  for (const [id, m] of Object.entries(metrics || {})) {
    if (NON_POSTURAL.has(id)) continue;
    const lib = LIB[id];
    if (!lib || !m) continue;

    if (m.reliable === false) {
      // Not a posture problem — a visibility problem, and the fix is the camera.
      unmeasured.push({
        id, kind: "unmeasured",
        title: lib.title[ar ? "ar" : "en"],
        severity: "unmeasured",
        why: lib.unmeasured[ar ? "ar" : "en"],
        technical: { score: null, value: null, unit: m.unit, label: m.label, reliable: false },
      });
      continue;
    }
    measured++;

    // The engine's classification, never a second one derived from the score.
    const severity = m.severity || "normal";
    if (severity === "normal" && !includeNormal) continue;

    const w = WEIGHTS_FRONT[WEIGHT_KEY[id]] ?? 0.05;
    const title = lib.title[ar ? "ar" : "en"];
    // Value-free fallbacks, used only when the measured value is missing.
    const noValue = ar
      ? `${title}: القراءة برّه المدى الطبيعي، بس القيمة نفسها مش متاحة في اللقطة دي.`
      : `${title}: outside its normal range, though the exact value wasn't available in this reading.`;
    out.push({
      id,
      kind: "finding",
      title,
      severity,
      severityLabel: SEVERITY_LABEL[severity][ar ? "ar" : "en"],
      color:    SEVERITY_COLOR[severity],
      headline: safeText(lib.what, m, ar, noValue),
      why:      safeText(lib.why,  m, ar, ""),
      action:   safeText(lib.act,  m, ar, ar ? "اظبط وضعتك وارجع للمحايد." : "Reset to a neutral position."),
      // Ranked by what it is actually costing, so the first row is the one
      // worth fixing first rather than whichever the engine declares first.
      impact:   w * Math.max(0, 100 - (m.score ?? 100)),
      technical: {
        value: n1(m.value), unit: m.unit, score: m.score, label: m.label,
        reliable: true,
        // Whether this was judged against the user's own calibrated neutral or
        // a population default — the single most useful piece of context for
        // deciding how much to trust a borderline reading.
        personalised: !!(m.personalised || calibrated),
        extra: {
          ...(Number.isFinite(m.extra_load_kg)  ? { extra_load_kg: m.extra_load_kg } : {}),
          ...(Number.isFinite(m.neck_angle_deg) ? { neck_angle_deg: m.neck_angle_deg } : {}),
          ...(Number.isFinite(m.signed)         ? { signed: m.signed } : {}),
          ...(m.direction ? { direction: m.direction } : {}),
        },
      },
    });
  }

  out.sort((a, b) =>
    (SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]) || (b.impact - a.impact));

  return {
    findings: limit > 0 ? out.slice(0, limit) : out,
    total: out.length,
    unmeasured,
    measured,
    // "Nothing is wrong" is only sayable if something was actually measured.
    // Saying it because every metric was unreadable is the failure this
    // distinction exists to prevent.
    allClear: out.length === 0 && measured > 0,
    nothingMeasured: measured === 0,
  };
}

/** One-line summary for a header or a notification. */
export function findingsSummary(res, lang = "en") {
  const ar = lang === "ar";
  if (res.nothingMeasured) return ar ? "مفيش قياس كافي — اظبط الكاميرا" : "Nothing measurable yet — check the camera";
  if (res.allClear)        return ar ? "كل المقاييس في المدى الطبيعي" : "Everything measured is in range";
  const worst = res.findings[0];
  const n = res.total - 1;
  if (n <= 0) return ar ? `${worst.title} — ${worst.severityLabel}` : `${worst.title} — ${worst.severityLabel}`;
  return ar ? `${worst.title} — ${worst.severityLabel}، و${n} حاجة تانية`
            : `${worst.title} — ${worst.severityLabel}, and ${n} more`;
}
