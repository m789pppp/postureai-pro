/**
 * Arabic for the standalone marketing pages.
 *
 * These five pages — Pricing, Product, Solutions, How it works, FAQ — were
 * written in English only, and every one of them still rendered the shared
 * header's "عربي" button. Pressing it translated the two nav buttons and
 * nothing else, on a product whose landing page is fully bilingual and whose
 * market is Egypt. The toggle was a promise the pages could not keep.
 *
 * Keyed on the English string rather than on invented ids, for one reason: a
 * page's copy can then be wrapped in place, at the point it is rendered,
 * without restructuring its data tables into { en, ar } pairs. A missing key
 * falls through to the English, so a new line of copy degrades to untranslated
 * rather than to a blank or a raw key on the page.
 *
 * Register matches LandingPageV7: Egyptian Arabic, not Modern Standard. The
 * landing page says "قلّل إجازات الأمراض", not "قم بتقليل". These pages sit one
 * click away from it and should not read as though a different company wrote
 * them.
 *
 * Plan names follow PricingPage.jsx, which already ships أساسي / احترافي /
 * إيليت — the same tier should not have two Arabic names in one product.
 */

export const AR = {
  // ── Plan names and blurbs ───────────────────────────────────────────
  "Free": "مجاني",
  "Basic": "أساسي",
  "Pro": "احترافي",
  "Elite": "إيليت",
  "Starter": "ستارتر",
  "Growth": "جروث",
  "Enterprise": "إنتربرايز",
  "Team": "فرق",
  "Business": "شركات",

  "Try Corvus with no commitment.": "جرّب Corvus من غير أي التزام.",
  "For individuals building better posture habits.": "للأفراد اللي بيبنوا عادات وضعية أحسن.",
  "For individuals serious about posture health.": "للأفراد اللي واخدين صحة وضعيتهم بجدّية.",
  "For power users and health professionals.": "للمستخدمين المحترفين وأخصائيي الصحة.",
  "Flat-rate, for teams up to 30 employees.": "سعر ثابت، لفرق حتى 30 موظف.",
  "Flat-rate, for teams up to 100 employees.": "سعر ثابت، لفرق حتى 100 موظف.",
  "For unlimited-headcount organisations. Starting at $499/mo.":
    "للمؤسسات بعدد موظفين غير محدود. يبدأ من 499$ شهريًا.",

  // ── Feature rows ────────────────────────────────────────────────────
  "Sessions / month": "الجلسات / الشهر",
  "Posture Score": "درجة الوضعية",
  "Demo Session": "جلسة تجريبية",
  "Pain Self-Report": "تسجيل الألم ذاتيًا",
  "First Session Badge": "شارة أول جلسة",
  "Weekly Email Report": "تقرير أسبوعي بالإيميل",
  "AI Coach": "مدرب AI",
  "AI Coach messages": "رسائل مدرب AI",
  "WhatsApp Reminders": "تذكيرات واتساب",
  "Unlimited": "غير محدود",
  "Daily Check-in": "تسجيل يومي",
  "Weekly Challenge": "تحدي أسبوعي",
  "Pain Prediction Card": "بطاقة توقّع الألم",
  "Streak Freeze": "تجميد السلسلة",
  "Posture Habit Score": "درجة عادات الوضعية",
  "Sessions Countdown": "عدّاد الجلسات",
  "Everything in Basic": "كل مزايا أساسي",
  "Everything in Pro": "كل مزايا احترافي",
  "Everything in Starter": "كل مزايا ستارتر",
  "Everything in Growth": "كل مزايا جروث",
  "Weekly Intelligence Report": "تقرير أسبوعي تحليلي",
  "Shareable PDF Report": "تقرير PDF قابل للمشاركة",
  "Body Heatmap": "خريطة حرارية للجسم",
  "Focus Mode Integration": "تكامل مع وضع التركيز",
  "Custom Alert Rules": "قواعد تنبيه مخصّصة",
  "Family / Partner Mode (+1)": "وضع العائلة / الشريك (+1)",
  "Predictive AI (detailed)": "ذكاء تنبؤي (تفصيلي)",
  "Voice Coach (Arabic)": "مدرب صوتي (بالعربي)",
  "Monthly Physiotherapist": "جلسة علاج طبيعي شهريًا",
  "Posture DNA Report (quarterly)": "تقرير Posture DNA (كل 3 شهور)",
  "Priority WhatsApp Support": "دعم واتساب بأولوية",
  "Elite Early Access": "وصول مبكر لمزايا إيليت",
  "Employees": "الموظفين",
  "Up to 30": "حتى 30",
  "Up to 100": "حتى 100",
  "HR analytics dashboard": "لوحة تحليلات الموارد البشرية",
  "Advanced HR analytics": "تحليلات HR متقدّمة",
  "Executive HR reports": "تقارير HR للإدارة",
  "Weekly auto-reports": "تقارير أسبوعية تلقائية",
  "Slack / Teams alerts": "تنبيهات Slack / Teams",
  "CSV import": "استيراد CSV",
  "SSO / SAML 2.0": "تسجيل دخول موحّد SSO / SAML 2.0",
  "HR system connectors": "موصّلات أنظمة HR",
  "FaceMesh 478-landmark detection": "تتبّع 478 نقطة بـ FaceMesh",
  "Priority support": "دعم بأولوية",
  "Corvus AI clinical narrative": "تحليل سردي إكلينيكي من Corvus AI",
  "SAML SSO (Azure AD / Okta) — provisioned with our team":
    "SAML SSO (Azure AD / Okta) — بيتظبط مع فريقنا",
  "White-label branding": "علامة تجارية خاصة بيك",
  "API + Webhooks access": "وصول API و Webhooks",
  "Dedicated success manager": "مدير حساب مخصّص",
  "Custom SLA guarantee": "اتفاقية مستوى خدمة مخصّصة",

  // ── Buttons ─────────────────────────────────────────────────────────
  "Get started free": "ابدأ مجانًا",
  "Start 7-day trial": "ابدأ تجربة 7 أيام",
  "Start free trial": "ابدأ التجربة المجانية",
  "Contact sales": "كلّم المبيعات",
  "Contact us for pricing": "كلّمنا للسعر",

  // ── Section headings and labels ─────────────────────────────────────
  "Pricing": "الأسعار",
  "Simple, transparent": "أسعار واضحة",
  "pricing": "وبسيطة",
  "Compare all features": "قارن كل المزايا",
  "Feature": "الميزة",
  "Pricing FAQ": "أسئلة شائعة عن الأسعار",
  "Start for free today": "ابدأ مجانًا النهاردة",
  "Join teams across Egypt and MENA cutting sick leave with AI posture coaching.":
    "انضم لفرق في مصر والمنطقة بتقلّل إجازات الأمراض بتدريب الوضعية بالذكاء الاصطناعي.",
  "Core": "الأساسيات",
  "Basic Habits": "العادات الأساسية",
  "Pro Intelligence": "تحليلات احترافي",
  "Elite Exclusive": "حصري لإيليت",
  "Custom": "حسب الطلب",
  "Save": "وفّر",
  "No credit card needed": "من غير بطاقة ائتمان",
  "Monthly": "شهري",
  "Yearly": "سنوي",
  "Individual": "فردي",
  "For Teams": "للفرق",
  "Most Popular": "الأكثر طلبًا",
  "Start free. Scale when you're ready.": "ابدأ مجانًا، وكبّر لما تجهز.",
  "No hidden fees, no lock-in.": "مفيش رسوم خفية ولا ارتباط.",
  "Prices shown in Egyptian Pounds.": "الأسعار بالجنيه المصري.",
  "7-day free trial": "تجربة مجانية 7 أيام",
  "No credit card": "من غير بطاقة ائتمان",
  "Cancel anytime": "إلغاء في أي وقت",
  "Free plan forever": "خطة مجانية للأبد",
  "See all FAQ": "شوف كل الأسئلة",

  // ── Pricing FAQ ─────────────────────────────────────────────────────
  "Can I switch plans anytime?": "أقدر أغيّر الباقة في أي وقت؟",
  "What payment methods?": "طرق الدفع إيه؟",
  "What happens after the trial?": "إيه اللي بيحصل بعد التجربة؟",
  "Discounts for NGOs or universities?": "فيه خصم للجمعيات أو الجامعات؟",
  "Is the company plan per active user?": "باقة الشركات بتتحسب على المستخدم النشط؟",
  "Can I get a custom quote?": "أقدر أطلب عرض سعر مخصّص؟",

  // ── Pricing FAQ answers ─────────────────────────────────────────────
  "Yes. Upgrades are instant and pro-rated. Downgrades take effect at end of billing period. No penalties.":
    "أيوه. الترقية فورية وبتتحسب بالتناسب. التخفيض بيسري في آخر دورة الفوترة. مفيش أي غرامات.",
  "Online payment is coming soon. For now we activate subscriptions manually over WhatsApp — send us the plan you want and it is active within 30 minutes.":
    "الدفع الإلكتروني لسه قريبًا. دلوقتي بنفعّل الاشتراكات يدويًا عن طريق واتساب — ابعتلنا الباقة اللي عايزها وبنفعّلها خلال 30 دقيقة.",
  "You choose a paid plan or move to Free automatically. All your data and history is preserved either way.":
    "يا إما تختار باقة مدفوعة، يا إما تتحوّل للمجانية تلقائيًا. بياناتك وسجلك محفوظين في الحالتين.",
  "Yes — 50% off for verified educational institutions and NGOs. Contact us with your organisation details.":
    "أيوه — خصم 50% للمؤسسات التعليمية والجمعيات الموثّقة. كلّمنا ببيانات مؤسستك.",
  "No — company plans are flat-rate: one fixed monthly price covers your whole team up to that plan's employee cap (30 for Starter, 100 for Growth), regardless of how many are actively using it.":
    "لأ — باقات الشركات سعر ثابت: سعر شهري واحد بيغطي الفريق كله لحد الحد الأقصى للباقة (30 لستارتر، 100 لجروث)، مهما كان عدد اللي بيستخدموها فعليًا.",
  "Yes. For teams over 200 employees we offer volume discounts. Book a call and we'll build a package for you.":
    "أيوه. للفرق فوق 200 موظف عندنا خصومات على الحجم. احجز مكالمة وهنبنيلك باقة على مقاسك.",

  // ── Payment, kept in step with lib/salesWhatsapp.js ─────────────────
  "Online payment is coming soon — to start a paid plan now, send us the plan you want on WhatsApp":
    "الدفع الإلكتروني قريبًا — عشان تبدأ باقة مدفوعة دلوقتي، ابعتلنا الباقة اللي عايزها على واتساب",
  "Activate on WhatsApp": "فعّل عبر واتساب",
  "Activated within 30 minutes of your message.": "التفعيل خلال 30 دقيقة من إرسال الرسالة.",
};

/**
 * Translate one string. Falls through to the English when there is no entry,
 * which is the correct failure for marketing copy: an untranslated line still
 * reads, a missing key does not.
 *
 * In development it says which strings it could not find, so a page that has
 * drifted ahead of this file is noticeable while working on it rather than
 * after it ships.
 */
const missing = new Set();
export function tr(text, isAr) {
  if (!isAr || typeof text !== "string") return text;
  const hit = AR[text];
  if (hit) return hit;
  if (import.meta.env?.DEV && text.trim() && !missing.has(text)) {
    missing.add(text);
    console.warn("[copy] no Arabic for:", JSON.stringify(text));
  }
  return text;
}
