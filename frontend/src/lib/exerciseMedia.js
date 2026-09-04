/**
 * exerciseMedia.js — the break-routine images and the credit each one requires.
 *
 * These are real illustrations sourced from Wikimedia Commons under licences
 * that permit commercial use, downloaded into the repo rather than hotlinked:
 * a remote URL rots, needs the network at exactly the moment someone has walked
 * away from their desk, and hands a third party a log of when our users take
 * breaks. All seven files together are about 156 KB.
 *
 * THE CREDIT LINE IS A LICENCE TERM.
 *
 * The six exercise illustrations are CC BY-SA 4.0, which requires attribution,
 * a link to the licence, and a note that the file was changed, wherever the
 * image is shown. `CREDIT` below is rendered under the image in BreakPage —
 * removing it is a licence breach, not a design tidy-up. The posture reference
 * is CC0 and carries no such obligation; it is credited anyway because it costs
 * one line and it tells the next person where it came from.
 *
 * See public/exercises/CREDITS.md for the full record and the share-alike
 * consequences before adding or compositing anything here.
 */

/** Shown under every CC BY-SA image. */
export const CREDIT = {
  author: "BruceBlaus",
  authorUrl: "https://commons.wikimedia.org/wiki/User:BruceBlaus",
  licence: "CC BY-SA 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  changed: true,   // resized and converted to WebP
};

/** The sitting reference. CC0 — free of the obligations above. */
export const POSTURE_REFERENCE = {
  src: "/exercises/sitting-posture-reference.webp",
  width: 505, height: 760,
  alt: {
    en: "Ergonomic workstation reference: seated at a computer with the screen at eye level, elbows and knees at 90 degrees, lower back supported and feet flat on the floor",
    ar: "مرجع الجلسة الصحيحة على المكتب: الشاشة في مستوى العين، الكوع والركبة بزاوية ٩٠°، دعم لأسفل الظهر، والقدمان مستويتان على الأرض",
  },
  credit: { author: "Yamavu / Berkeley Lab", licence: "CC0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
};

/**
 * The rules the reference diagram is showing, in words.
 *
 * The diagram's own labels are baked into the image in English, so an Arabic
 * user gets an English picture. This list is the same information in their own
 * language, sitting beside it — which is also what a screen-reader user gets,
 * since text in an image reaches neither of them.
 */
export function postureChecklist(isAr) {
  return isAr
    ? [
        "الشاشة: حافتها العليا في مستوى عينيك، على بُعد ذراع تقريباً",
        "الأذن فوق الكتف مباشرة — مش قدّامه",
        "المرفقان قريبان من الجسم بزاوية ٩٠° والرسغان مستقيمان",
        "أسفل الظهر مدعوم، والقدمان مستويتان على الأرض بركبتين ٩٠°",
      ]
    : [
        "Screen top edge at eye level, about an arm's length away",
        "Ear stacked over the shoulder — not in front of it",
        "Elbows near the body at 90°, wrists straight",
        "Lower back supported, feet flat, knees at 90°",
      ];
}

/**
 * The break routine.
 *
 * Chosen partly around what exists under a free licence — see CREDITS.md. Every
 * entry that can be illustrated is, from one illustrator, so the screen reads as
 * one thing; the eye break has no image because it needs none, and a drawn
 * stand-in beside photographic illustrations would look like a mistake.
 *
 * `reps` is its own field rather than the tail of the description sentence: it
 * is the one number the person has to follow while they are already moving.
 */
export const BREAK_ROUTINE = [
  {
    id: "neck_glide", icon: "⬅️", img: "/exercises/neck-glide.webp",
    en: "Chin Tuck", ar: "سحب الذقن",
    dens: "Draw your chin straight back over your shoulders — make a double chin. Don't tip your head down.",
    dar: "ارجع بذقنك لورا فوق كتفيك — اعمل دقن مزدوجة. متنزلش راسك لتحت.",
    reps: "10× — hold 3s", repsAr: "١٠ مرات — اثبت ٣ ثوانٍ", dur: 30,
    // This one is first on purpose: forward head is the fault the engine
    // measures most often, and the chin tuck is its direct counter.
    targets: ["fhp", "neck", "mon_low"],
  },
  {
    id: "neck_bends", icon: "↔️", img: "/exercises/neck-bends.webp",
    en: "Side Neck Stretch", ar: "شد الرقبة الجانبي",
    dens: "Tilt one ear toward that shoulder. Let the opposite shoulder stay down.",
    dar: "ميّل ودنك ناحية كتفك. سيب الكتف التاني نازل.",
    reps: "20s each side", repsAr: "٢٠ ثانية لكل جهة", dur: 40,
    targets: ["tilt", "neck", "sh"],
  },
  {
    id: "shoulder_shrugs", icon: "⬆️", img: "/exercises/shoulder-shrugs.webp",
    en: "Shoulder Shrugs", ar: "رفع الأكتاف",
    dens: "Lift both shoulders toward your ears, then let them drop and settle back.",
    dar: "ارفع كتفيك ناحية ودانك، وبعدين سيبهم ينزلوا ويرجعوا لورا.",
    reps: "10× — hold 3s at the top", repsAr: "١٠ مرات — اثبت ٣ ثوانٍ فوق", dur: 30,
    targets: ["shrug", "round", "sh"],
  },
  {
    id: "wrist_extensor", icon: "✋", img: "/exercises/wrist-extensor.webp",
    en: "Wrist Stretch", ar: "شد الرسغ",
    dens: "Straighten one arm, palm down, and gently pull the fingers back toward you.",
    dar: "مُدّ دراعك وكفّك لتحت، واسحب صوابعك ناحيتك بلطف.",
    reps: "15s each hand", repsAr: "١٥ ثانية لكل يد", dur: 30,
    targets: ["elbow"],
  },
  {
    id: "finger_extensions", icon: "🖐️", img: "/exercises/finger-extensions.webp",
    en: "Finger Spread", ar: "فرد الأصابع",
    dens: "Spread your fingers wide against light resistance — a rubber band works, or press against your other hand.",
    dar: "افرد صوابعك بالعافية شوية — بأستيك أو بالضغط على إيدك التانية.",
    reps: "10× each hand", repsAr: "١٠ مرات لكل يد", dur: 20,
    targets: ["elbow"],
  },
  {
    id: "chair_squat", icon: "🧍", img: "/exercises/chair-squat.webp",
    en: "Stand & Sit", ar: "قوم واقعد",
    dens: "Stand up from the chair without using your hands, then sit back down slowly.",
    dar: "قوم من الكرسي من غير ما تستعين بإيديك، وبعدين اقعد بالراحة.",
    reps: "8× slowly", repsAr: "٨ مرات بالراحة", dur: 30,
    targets: ["slouch", "spine", "posture"],
  },
  {
    id: "eyes_202020", icon: "👁️", img: null,   // needs no illustration
    en: "Eyes: 20-20-20", ar: "العينان: 20-20-20",
    dens: "Look at something about 6 metres away and let your eyes relax. Blink normally.",
    dar: "بصّ لحاجة بعيدة حوالي ٦ أمتار وسيب عينيك ترتاح. طرّف عادي.",
    reps: "20 seconds", repsAr: "٢٠ ثانية", dur: 20,
    targets: ["dist"],
  },
];

/**
 * Reorder the routine so whatever the session actually flagged comes first.
 *
 * The routine used to be a fixed array in a fixed order: someone whose whole
 * session was rounded shoulders got the same seven exercises, starting with the
 * same one, as someone whose problem was their wrists. `causes` are the engine's
 * alert cause keys from the session that just ended.
 *
 * Nothing is removed — a break is worth doing in full — but the exercise that
 * addresses the measured fault is the one on screen when the timer starts.
 */
export function routineFor(causes = []) {
  if (!causes.length) return BREAK_ROUTINE;
  const norm = causes.map(c => String(c).replace(/_(sev|mid|cl|c|f|hi|lo|low)$/, ""));
  const score = ex => ex.targets.reduce((n, t) => n + norm.filter(c => c === t).length, 0);
  return [...BREAK_ROUTINE].sort((a, b) => score(b) - score(a));
}
