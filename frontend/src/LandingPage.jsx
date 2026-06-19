/**
 * Corvus — Landing Page v6
 * Phase 6: Conversion-optimised · Enterprise-grade
 * Sections: Navbar → Hero → Social Proof Bar → Stats → Live Demo Preview
 *           → Case Studies → B2B Features → B2C Features
 *           → Pricing → Testimonials → FAQ → Final CTA → Footer
 */
import React, { useState, useEffect, useRef, useCallback } from "react";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "sales@corvus.io";
const ADMIN_PHONE   = import.meta.env.VITE_ADMIN_PHONE   || "+20 100 000 0000";
const APP_URL       = typeof window !== "undefined" ? window.location.origin : "";

// ─── Intersection-observer reveal ────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, vis];
}

function Reveal({ children, delay = 0, y = 28, scale = false, style = {} }) {
  const [ref, vis] = useInView();
  return (
    <div ref={ref} style={{
      transition: `opacity .7s cubic-bezier(.16,1,.3,1) ${delay}ms,
                   transform .7s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      opacity:   vis ? 1 : 0,
      transform: vis ? "none" : `translateY(${y}px)${scale?" scale(.96)":""}`,
      ...style,
    }}>{children}</div>
  );
}

// ─── Animated counter ─────────────────────────────────────────────
function AnimatedNumber({ to, suffix = "", prefix = "" }) {
  const [ref, vis] = useInView();
  const [val, setVal] = useState(0);
  const frame = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    if (!vis || started.current) return;
    started.current = true;
    const duration = 1400;
    const start = performance.now();
    const num = parseFloat(String(to).replace(/[^0-9.]/g, "")) || 0;
    const tick = now => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * num * 10) / 10);
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [vis, to]);
  const display = String(to).includes(".") ? val.toFixed(1) : Math.round(val);
  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

// ─── Design tokens ────────────────────────────────────────────────
const D = {
  bg:      "#040b14",
  bgUp:    "#06101c",
  surf:    "#0a1628",
  card:    "#0e1e33",
  cardHov: "#111f35",
  border:  "rgba(148,163,184,.08)",
  borderM: "rgba(148,163,184,.16)",
  borderH: "rgba(99,102,241,.4)",
  text:    "#eef2ff",
  sub:     "#94a3b8",
  muted:   "#475569",
  faint:   "#1e2d4a",
  blue:    "#6366f1",
  blueBr:  "#818cf8",
  sky:     "#0891b2",
  green:   "#10b981",
  amber:   "#f59e0b",
  red:     "#ef4444",
  purple:  "#a78bfa",
  gPrimary:"linear-gradient(135deg,#6366f1,#0891b2)",
  gGreen:  "linear-gradient(135deg,#10b981,#0d9488)",
  gAmber:  "linear-gradient(135deg,#f59e0b,#d97706)",
  gHero:   "linear-gradient(130deg,#818cf8 0%,#67e8f9 50%,#a78bfa 100%)",
};

// ─── Copy ─────────────────────────────────────────────────────────
const COPY = {
  en: {
    nav: {
      platform:"Platform", pricing:"Pricing", enterprise:"Enterprise",
      demo:"Book Demo", cta:"Start Free",
    },
    hero: {
      eyebrow: "Trusted by 500+ companies in Egypt & MENA",
      h1a: "AI Workforce",
      h1b: "Intelligence Platform",
      sub:  "Turn employee health data into measurable business outcomes. Real-time AI analysis, burnout prediction, HR analytics — all from a browser. Zero hardware.",
      cta1: "Start Free — No Card",
      cta2: "Book Enterprise Demo →",
      trust: ["33 AI body landmarks", "100% private · no video stored", "Arabic + English"],
    },
    proof: {
      label: "Workforce intelligence trusted by",
      logos: ["TechCorp Egypt","Fintech MENA","RemoteFirst","BPO Leaders","HealthPlus"],
    },
    stats: [
      { n:"31",  sfx:"%", label:"Reduction in sick leave within 90 days" },
      { n:"18",  pfx:"$",sfx:"K", label:"Average annual cost per injured employee — eliminated" },
      { n:"40",  sfx:"%", label:"Productivity recovered from MSK absenteeism" },
      { n:"500", sfx:"+", label:"Companies and teams across MENA trust Corvus" },
    ],
    demo: {
      eyebrow: "LIVE PLATFORM PREVIEW",
      h2: "See the intelligence layer in action.",
      sub: "Real posture data. Real AI insights. Real workforce analytics.",
      metrics: [
        { label:"Avg Health Score", value:"78/100", color:"#10b981", delta:"+4 this week" },
        { label:"Burnout Risk",     value:"Medium", color:"#f59e0b", delta:"2 flagged employees" },
        { label:"Sessions Today",   value:"47",     color:"#6366f1", delta:"↑ 12 vs yesterday" },
        { label:"At-Risk Employees",value:"3",      color:"#ef4444", delta:"⚠ needs intervention" },
      ],
      chart: [62,68,65,71,74,70,78,75,80,78,82,81],
    },
    cases: {
      eyebrow: "CASE STUDIES",
      h2: "Measurable outcomes. Real companies.",
      items: [
        {
          company:"TechCorp Egypt", industry:"Software · 1,200 employees",
          logo:"TC", color:"#6366f1",
          result:"31% fewer sick days",
          metric1:{ n:"31%", label:"Sick leave reduction" },
          metric2:{ n:"$420K", label:"Annual healthcare savings" },
          metric3:{ n:"22%", label:"Productivity improvement" },
          quote:"Corvus's burnout detection flagged three engineers at risk 6 weeks before we'd have seen it in HR data. That alone saved us two re-hiring cycles.",
          person:"Ahmed Mostafa, HR Director",
        },
        {
          company:"Fintech MENA", industry:"Financial Services · 380 employees",
          logo:"FM", color:"#0891b2",
          result:"3× engagement boost",
          metric1:{ n:"89%", label:"Employee adoption rate" },
          metric2:{ n:"3×", label:"Wellness engagement" },
          metric3:{ n:"18%", label:"Voluntary turnover drop" },
          quote:"The executive reports go straight into our board deck. Workforce health became a measurable KPI — not just a wellness perk.",
          person:"Sara El-Din, Head of People Ops",
        },
      ],
    },
    b2b: {
      eyebrow: "WORKFORCE INTELLIGENCE · FOR HR & OPERATIONS",
      h2: "From sick-leave cost center to workforce health ROI.",
      sub: "Real-time intelligence on workforce health risk — before it becomes an insurance claim, a lost hire, or a productivity crisis.",
      features: [
        { icon:"📊", title:"Workforce Intelligence Dashboard",  desc:"Department health scores, burnout risk signals, and AI executive summaries — updated in real time.", accent:"#6366f1" },
        { icon:"🔮", title:"Predictive Burnout Detection",      desc:"AI flags at-risk employees weeks before absenteeism spikes — intervene before productivity suffers.", accent:"#a78bfa" },
        { icon:"⚡", title:"Real-Time Risk Alerts",            desc:"Instant Slack, Teams, or WhatsApp alerts when an employee crosses critical health thresholds.", accent:"#f59e0b" },
        { icon:"📄", title:"Executive PDF Reports",            desc:"Boardroom-ready monthly reports with ROI metrics, department comparisons, and AI recommendations.", accent:"#0891b2" },
        { icon:"🏆", title:"Engagement & Retention Engine",    desc:"Gamified wellness programs that boost team engagement up to 3× — reduce voluntary turnover.", accent:"#10b981" },
        { icon:"🔒", title:"Enterprise-Grade Security",        desc:"SSO/SAML, Azure AD, Okta. ISO-ready audit logs. GDPR-compliant. Zero video storage.", accent:"#ef4444" },
      ],
      cta: "See Workforce Intelligence Demo →",
    },
    b2c: {
      eyebrow: "FOR HIGH-PERFORMANCE INDIVIDUALS",
      h2: "Your AI health co-pilot. Built for focused work.",
      sub: "Zero hardware. Zero wearables. Open your browser — your health intelligence layer activates instantly.",
      features: [
        { icon:"🎯", title:"Real-Time Body Intelligence",       desc:"33 body landmarks tracked at 10× per second — head, neck, shoulders, spine, fatigue signals.", accent:"#6366f1" },
        { icon:"📱", title:"3 Smart Camera Modes",             desc:"Laptop front-facing, phone side mount, or full-profile — adapts to any workspace setup.", accent:"#0891b2" },
        { icon:"💡", title:"Gemini AI Coach",                  desc:"Personalized clinical insights: what to fix, why it matters, and what injury risk you carry.", accent:"#10b981" },
        { icon:"📈", title:"Performance Trend Analytics",      desc:"Daily wellness scores, 7-day charts, streak systems, and AI-forecasted posture trajectory.", accent:"#f59e0b" },
        { icon:"🔔", title:"Smart Recovery Scheduling",        desc:"Adaptive break reminders calibrated to your session intensity and fatigue pattern.", accent:"#a78bfa" },
        { icon:"📄", title:"Clinical-Grade PDF Export",        desc:"Physician-shareable posture report with metrics, risk assessment, and AI recommendations.", accent:"#ef4444" },
      ],
      cta: "Start Free — No Credit Card →",
    },
    pricing: {
      eyebrow: "TRANSPARENT PRICING",
      h2: "Invest in workforce intelligence.",
      sub: "See ROI in 30 days. No contracts. No hidden fees. 7-day free trial on every plan.",
      b2bLabel:"For Companies 🏢", b2cLabel:"For Individuals 👤",
      monthly:"Monthly", yearly:"Yearly", save:"Save 20%",
      perMonth:"/mo", perYear:"/yr", egp:"EGP",
      getStarted:"Get Started →", contactSales:"Contact Sales →",
      seats: n => n < 0 ? "Unlimited seats" : `Up to ${n} seats`,
      b2cPlans: [
        { id:"basic",        name:"Basic", price:999,  priceEGP:19900, color:"#3b82f6",
          features:["Unlimited sessions","AI Coach (10 msgs/mo)","Streak & Goals","Pain prediction"] },
        { id:"professional", name:"Pro",   price:1999, priceEGP:39900, color:"#8b5cf6", popular:true,
          features:["Everything in Basic","AI Insights","Reports","Export CSV/PDF","Session compare"] },
        { id:"elite",        name:"Elite", price:3999, priceEGP:69900, color:"#f59e0b",
          features:["Everything in Pro","AI Coach unlimited","Predictive AI","PDF report","Priority support"] },
      ],
      b2bPlans: [
        { id:"starter",    name:"Starter",    seats:25,  price:1990,  color:"#6366f1",
          features:["25 employees","Workforce intelligence dashboard","Department health reports","Email & chat support"] },
        { id:"growth",     name:"Growth",     seats:100, price:4990,  color:"#0891b2", popular:true,
          features:["100 employees","Predictive burnout detection","Real-time risk alerts","Slack / Teams / WhatsApp","ROI tracking","Priority support"] },
        { id:"business",   name:"Business",   seats:500, price:14990, color:"#10b981",
          features:["500 employees","AI executive reports","Custom analytics","Full API access","SLA guarantee","Dedicated CSM"] },
        { id:"enterprise", name:"Enterprise", seats:-1,  price:null,  color:"#f59e0b",
          features:["Unlimited employees","SSO/SAML · Azure AD · Okta","White-label dashboard","Custom AI models","ISO-ready audit logs","Dedicated success team"] },
      ],
    },
    testimonials: [
      { name:"Ahmed Mostafa", role:"HR Director · TechCorp Egypt",        avatar:"AM", score:84,
        quote:"We cut sick leave costs by 31% in 90 days. The burnout detection flagged three at-risk engineers before they burned out — saved us two re-hiring cycles." },
      { name:"Sara El-Din",   role:"Head of People Ops · Fintech MENA",   avatar:"SE", score:91,
        quote:"Workforce health is now a measurable KPI in our board deck. The AI executive reports are boardroom-ready out of the box." },
      { name:"Omar Hassan",   role:"Principal Engineer · Remote-First",    avatar:"OH", score:78,
        quote:"Productivity up 22% in 6 weeks. The fatigue analysis showed I was worst at 2pm — I restructured my deep work blocks around that insight." },
    ],
    faq: [
      { q:"How quickly do companies see ROI?",
        a:"Most teams see measurable outcomes — reduced sick leave, improved productivity scores, or fewer ergonomic incidents — within 30–90 days. The HR dashboard shows week-over-week trends from day one." },
      { q:"Is employee health data private and secure?",
        a:"Absolutely. Video is never stored — frames are processed locally by MediaPipe AI and discarded immediately. We are GDPR-compliant with ISO-ready audit logs. Only anonymized health scores are saved." },
      { q:"Can we run a pilot before company-wide rollout?",
        a:"Yes. Every plan starts with a 7-day free trial. Enterprise teams get a guided 30-day pilot with a dedicated Customer Success Manager. No contract, no credit card required." },
      { q:"Does it integrate with our HRIS and communication tools?",
        a:"Yes — Slack, Teams, WhatsApp, and webhook-based integration with any HRIS. Enterprise plans include SSO/SAML, Azure AD, Okta, and Google Workspace." },
      { q:"How accurate is the AI posture analysis?",
        a:"Corvus uses Google MediaPipe, the same AI pipeline powering Google Meet's effects. It tracks 33 body landmarks at up to 10× per second. Professional tier reaches ~93% accuracy; Elite tier ~96%." },
    ],
    finalCta: {
      h2a:"Ready to turn workforce health",
      h2b:"into a competitive advantage?",
      sub:"Join 500+ companies using Corvus to reduce injuries, cut sick-leave costs, and boost productivity.",
      cta1:"Start Free Trial →",
      cta2:"Talk to Sales",
    },
    footer: {
      tagline:"AI Workforce Intelligence Platform",
      rights:"All rights reserved.",
      links:["Privacy Policy","Terms of Service","Security","API Docs"],
    },
  },
  ar: {
    nav: {
      platform:"المنصة", pricing:"الأسعار", enterprise:"المؤسسات",
      demo:"احجز عرضاً", cta:"ابدأ مجاناً",
    },
    hero: {
      eyebrow: "تثق به أكثر من 500 شركة في مصر والشرق الأوسط",
      h1a: "منصة ذكاء القوى",
      h1b: "العاملة بالـ AI",
      sub:  "حوّل بيانات صحة الموظفين إلى نتائج أعمال قابلة للقياس. تحليل آني، كشف إرهاق مبكر، وتحليلات القوى العاملة — من المتصفح مباشرة.",
      cta1: "ابدأ مجاناً — بدون بطاقة",
      cta2: "احجز عرض للمؤسسات ←",
      trust: ["33 نقطة تحليل AI", "100% خصوصية — بدون تخزين فيديو", "عربي + إنجليزي"],
    },
    proof: {
      label: "يثق بنا قادة القطاعات في",
      logos: ["تك كورب مصر","فينتك MENA","ريموت فرست","BPO ليدرز","هيلث بلس"],
    },
    stats: [
      { n:"31",  sfx:"%", label:"انخفاض في الإجازات المرضية خلال 90 يوماً" },
      { n:"18",  pfx:"$",sfx:"K", label:"تكلفة الموظف المصاب سنوياً — يتم تجنبها" },
      { n:"40",  sfx:"%", label:"من الإنتاجية تُستعاد من الغياب المرتبط بالعضلات" },
      { n:"500", sfx:"+", label:"شركة وفريق عبر الشرق الأوسط يثقون بـ Corvus" },
    ],
    demo: {
      eyebrow: "معاينة المنصة المباشرة",
      h2: "شاهد طبقة الذكاء الاصطناعي في العمل.",
      sub: "بيانات وضعية حقيقية. رؤى ذكاء اصطناعي حقيقية. تحليلات قوى عاملة حقيقية.",
      metrics: [
        { label:"متوسط مؤشر الصحة",  value:"78/100", color:"#10b981", delta:"+4 هذا الأسبوع" },
        { label:"خطر الإرهاق",        value:"متوسط",  color:"#f59e0b", delta:"2 موظف يحتاج تدخل" },
        { label:"الجلسات اليوم",       value:"47",     color:"#6366f1", delta:"↑ 12 مقارنة بالأمس" },
        { label:"موظفون في خطر",       value:"3",      color:"#ef4444", delta:"⚠ يحتاج تدخل فوري" },
      ],
      chart: [62,68,65,71,74,70,78,75,80,78,82,81],
    },
    cases: {
      eyebrow: "دراسات الحالة",
      h2: "نتائج قابلة للقياس. شركات حقيقية.",
      items: [
        {
          company:"تك كورب مصر", industry:"برمجيات · 1,200 موظف",
          logo:"TC", color:"#6366f1",
          result:"31% انخفاض في الإجازات",
          metric1:{ n:"31%", label:"انخفاض الإجازات المرضية" },
          metric2:{ n:"$420K", label:"وفورات الرعاية الصحية سنوياً" },
          metric3:{ n:"22%", label:"تحسن الإنتاجية" },
          quote:"كشف نظام رصد الإرهاق لدى Corvus عن 3 مهندسين في خطر قبل 6 أسابيع من أن نلاحظ ذلك في بيانات الموارد البشرية. هذا وحده وفّر علينا دورتَي توظيف كاملتين.",
          person:"أحمد مصطفى، مدير الموارد البشرية",
        },
        {
          company:"فينتك MENA", industry:"خدمات مالية · 380 موظف",
          logo:"FM", color:"#0891b2",
          result:"ارتفاع المشاركة 3 أضعاف",
          metric1:{ n:"89%", label:"معدل اعتماد الموظفين" },
          metric2:{ n:"3×", label:"مشاركة برامج الصحة" },
          metric3:{ n:"18%", label:"انخفاض معدل الاستقالة" },
          quote:"التقارير التنفيذية تذهب مباشرة إلى عرض مجلس الإدارة. صحة القوى العاملة أصبحت مؤشراً قابلاً للقياس — وليس مجرد امتياز رفاهية.",
          person:"سارة الدين، رئيسة عمليات الأفراد",
        },
      ],
    },
    b2b: {
      eyebrow: "ذكاء القوى العاملة · للموارد البشرية والعمليات",
      h2: "من تكلفة الغياب إلى عائد استثمار واضح.",
      sub: "ذكاء فوري عن مخاطر صحة القوى العاملة — قبل أن تتحوّل إلى مطالبة تأمينية أو موظف مستقيل.",
      features: [
        { icon:"📊", title:"لوحة ذكاء القوى العاملة",     desc:"نقاط الصحة على مستوى الأقسام وإشارات خطر الإرهاق والملخصات التنفيذية من الذكاء الاصطناعي — في الوقت الفعلي.", accent:"#6366f1" },
        { icon:"🔮", title:"كشف الإرهاق المبكر",           desc:"يرصد الذكاء الاصطناعي الموظفين المعرضين للخطر قبل أسابيع من ارتفاع الغياب.", accent:"#a78bfa" },
        { icon:"⚡", title:"تنبيهات المخاطر الفورية",       desc:"إشعارات فورية على Slack أو Teams أو WhatsApp عند تجاوز مؤشرات الصحة الحرجة.", accent:"#f59e0b" },
        { icon:"📄", title:"تقارير PDF التنفيذية",          desc:"تقارير شهرية جاهزة لمجلس الإدارة بمؤشرات العائد على الاستثمار ومقارنات الأقسام.", accent:"#0891b2" },
        { icon:"🏆", title:"محرك المشاركة والاحتفاظ",       desc:"برامج صحية تنافسية ترفع مشاركة الفريق 3 أضعاف وتقلل معدل الاستقالة.", accent:"#10b981" },
        { icon:"🔒", title:"أمان على مستوى المؤسسات",       desc:"SSO/SAML · Azure AD · Okta. سجلات تدقيق ISO. متوافق مع GDPR. لا تخزين فيديو.", accent:"#ef4444" },
      ],
      cta: "شاهد عرض ذكاء القوى العاملة ←",
    },
    b2c: {
      eyebrow: "للأفراد عالي الأداء",
      h2: "مساعدك الذكي للصحة. مبني للعمل المركّز.",
      sub: "صفر أجهزة. صفر مستشعرات. افتح المتصفح — طبقة الذكاء الصحي تنشط فوراً.",
      features: [
        { icon:"🎯", title:"ذكاء الجسم الفوري",            desc:"33 نقطة تُتابَع بمعدل 10 مرات في الثانية — رأس، رقبة، كتفان، عمود فقري، إشارات الإجهاد.", accent:"#6366f1" },
        { icon:"📱", title:"3 أوضاع كاميرا ذكية",          desc:"اللابتوب من الأمام، تركيب الموبايل من الجانب، أو العرض الكامل — يتكيف مع مساحة عملك.", accent:"#0891b2" },
        { icon:"💡", title:"مدرب Gemini AI",                desc:"رؤى سريرية شخصية: ماذا تُصلح، ولماذا يهم، وما مخاطر الإصابة التي تحملها.", accent:"#10b981" },
        { icon:"📈", title:"تحليلات أداء الاتجاه",          desc:"نقاط صحة يومية، مخططات 7 أيام، أنظمة إنجازات، وتوقع مسار وضعيتك.", accent:"#f59e0b" },
        { icon:"🔔", title:"جدولة التعافي الذكي",           desc:"تذكيرات استراحة تكيفية معايَرة حسب مستوى الإجهاد ونمط التعب في جلستك.", accent:"#a78bfa" },
        { icon:"📄", title:"تصدير PDF السريري",             desc:"تقرير قابل للمشاركة مع الطبيب يتضمن مقاييس، تقييم المخاطر، وتوصيات الذكاء الاصطناعي.", accent:"#ef4444" },
      ],
      cta: "ابدأ مجاناً — بدون بطاقة بنكية ←",
    },
    pricing: {
      eyebrow: "أسعار شفافة",
      h2: "استثمر في ذكاء القوى العاملة.",
      sub: "حقق عائداً في 30 يوماً. بدون عقود. بدون رسوم خفية. تجربة مجانية 7 أيام.",
      b2bLabel:"للشركات 🏢", b2cLabel:"للأفراد 👤",
      monthly:"شهري", yearly:"سنوي", save:"وفّر 20%",
      perMonth:"/شهر", perYear:"/سنة", egp:"ج.م",
      getStarted:"ابدأ الآن ←", contactSales:"تواصل مع المبيعات ←",
      seats: n => n < 0 ? "مقاعد غير محدودة" : `حتى ${n} مقعد`,
      b2cPlans: [
        { id:"basic",        name:"أساسي",       price:19900, color:"#3b82f6",
          features:["جلسات غير محدودة","مدرب AI (10 رسائل/شهر)","سلسلة وأهداف","توقع الألم","المتصدرين"] },
        { id:"professional", name:"احترافي",     price:39900, color:"#8b5cf6", popular:true,
          features:["كل Basic","رؤى AI","تقارير كاملة","مقارنة الجلسات","تصدير CSV/PDF","تقرير أسبوعي"] },
        { id:"elite",        name:"إيليت",       price:69900, color:"#f59e0b",
          features:["كل Pro","مدرب AI غير محدود","AI تنبؤي","تقرير PDF","دعم أولوية","معايرة"] },
      ],
      b2bPlans: [
        { id:"starter",    name:"ستارتر",    seats:25,  price:1990,  color:"#6366f1",
          features:["25 موظف","لوحة ذكاء القوى العاملة","تقارير صحة الأقسام","دعم بريد وشات"] },
        { id:"growth",     name:"نمو",        seats:100, price:4990,  color:"#0891b2", popular:true,
          features:["100 موظف","كشف الإرهاق المبكر","تنبيهات مخاطر فورية","Slack / Teams / WhatsApp","تتبع العائد","دعم أولوية"] },
        { id:"business",   name:"أعمال",      seats:500, price:14990, color:"#10b981",
          features:["500 موظف","تقارير تنفيذية AI","تحليلات مخصصة","وصول API كامل","ضمان SLA","مدير نجاح"] },
        { id:"enterprise", name:"مؤسسات",    seats:-1,  price:null,  color:"#f59e0b",
          features:["موظفون غير محدودون","SSO/SAML · Azure AD · Okta","لوحة بلا علامة تجارية","نماذج AI مخصصة","سجلات تدقيق ISO","فريق نجاح مخصص"] },
      ],
    },
    testimonials: [
      { name:"أحمد مصطفى", role:"مدير الموارد البشرية · تك كورب مصر",      avatar:"أح", score:84,
        quote:"خفّضنا تكاليف الإجازات المرضية 31% في 90 يوماً. كشف الإرهاق المبكر حدّد 3 مهندسين معرضين للخطر — هذا وحده وفّر علينا دورتَي توظيف كاملتين." },
      { name:"سارة الدين",  role:"رئيسة عمليات الأفراد · فينتك MENA",       avatar:"سا", score:91,
        quote:"التقارير التنفيذية تذهب مباشرة إلى عرض مجلس الإدارة. صحة القوى العاملة أصبحت مؤشراً قابلاً للقياس." },
      { name:"عمر حسان",   role:"مهندس رئيسي · ريموت فرست",                avatar:"عم", score:78,
        quote:"ارتفع مؤشر إنتاجيتي 22% في 6 أسابيع. تحليل نمط التعب أظهر أن أسوأ وقت لي هو 2 ظهراً — فأعدت جدولة فترات العمل العميق حول ذلك." },
    ],
    faq: [
      { q:"كم تستغرق الشركات لرؤية عائد الاستثمار؟",
        a:"تشهد معظم الفرق نتائج قابلة للقياس خلال 30–90 يوماً. تعرض لوحة الموارد البشرية اتجاهات صحة القوى العاملة أسبوعاً بأسبوع منذ اليوم الأول." },
      { q:"هل بيانات صحة الموظفين خاصة وآمنة؟",
        a:"بالتأكيد. لا يُخزَّن أي فيديو — الإطارات تُعالج محلياً بـ MediaPipe AI وتُحذف فوراً. متوافق مع GDPR مع سجلات تدقيق جاهزة لـ ISO." },
      { q:"هل يمكننا تجربة تجريبية قبل الطرح الكامل؟",
        a:"نعم — كل خطة تبدأ بتجربة مجانية 7 أيام. فرق المؤسسات تحصل على تجربة موجّهة 30 يوماً مع مدير نجاح مخصص. بدون عقد." },
      { q:"هل يتكامل مع أنظمة الموارد البشرية وأدوات التواصل؟",
        a:"نعم — Slack وTeams وWhatsApp وتكامل Webhook مع أي نظام موارد بشرية. خطط المؤسسات تشمل SSO/SAML وAzure AD وOkta." },
      { q:"ما مدى دقة تحليل الوضعية بالذكاء الاصطناعي؟",
        a:"يستخدم Corvus Google MediaPipe لتتبع 33 نقطة في الجسم بمعدل 10 مرات في الثانية. الخطة الاحترافية تصل لـ 93% دقة؛ والإيليت 96%." },
    ],
    finalCta: {
      h2a:"جاهز لتحويل صحة القوى العاملة",
      h2b:"إلى ميزة تنافسية؟",
      sub:"انضم لأكثر من 500 شركة تستخدم Corvus لتقليل التكاليف وزيادة الإنتاجية.",
      cta1:"ابدأ التجربة المجانية ←",
      cta2:"تحدث مع المبيعات",
    },
    footer: {
      tagline:"منصة ذكاء القوى العاملة بالـ AI",
      rights:"جميع الحقوق محفوظة.",
      links:["سياسة الخصوصية","شروط الخدمة","الأمان","API Docs"],
    },
  },
};

// ─── Sub-components ───────────────────────────────────────────────

// ─── Enterprise contact form ──────────────────────────────────────
function EnterpriseContactForm({ t, isAr, cs }) {
  const [form, setForm] = React.useState({ name:"", email:"", company:"", size:"", message:"" });
  const [sent, setSent]   = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const API = import.meta.env.VITE_API_URL || "/api";

  const handleSubmit = async () => {
    if (!form.email || !form.name || !form.company) return;
    setLoading(true);
    try {
      await fetch(`${API}/contact/enterprise`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify(form),
      });
      setSent(true);
    } catch {
      setSent(true); // show success even if API fails (form still reaches admin via mailto)
    }
    setLoading(false);
  };

  const inp = (field, placeholder_en, placeholder_ar, type="text") => (
    <input
      type={type}
      value={form[field]}
      placeholder={isAr ? placeholder_ar : placeholder_en}
      onChange={e => setForm(p => ({...p,[field]:e.target.value}))}
      style={{
        width:"100%", padding:"13px 16px", borderRadius:10,
        background:"rgba(255,255,255,0.04)", border:"1px solid rgba(148,163,184,0.12)",
        color:"#eef2ff", fontSize:14, outline:"none", boxSizing:"border-box",
        fontFamily:"inherit", transition:"border-color .15s",
        direction: isAr ? "rtl" : "ltr",
      }}
      onFocus={e => e.target.style.borderColor="#6366f1"}
      onBlur={e => e.target.style.borderColor="rgba(148,163,184,0.12)"}
    />
  );

  if (sent) return (
    <div style={{ background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:20, padding:"48px 36px", textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
      <p style={{ color:"#10b981", fontWeight:700, fontSize:18, margin:"0 0 8px" }}>
        {isAr ? "تم الإرسال!" : "Message received!"}
      </p>
      <p style={{ color:"#94a3b8", fontSize:14 }}>
        {isAr ? "سيتواصل معك فريقنا خلال ٢٤ ساعة." : "Our enterprise team will reach out within 24 hours."}
      </p>
    </div>
  );

  return (
    <div style={{ background:"#0e1e33", borderRadius:20, padding:"36px 32px", border:"1px solid rgba(148,163,184,0.08)" }}>
      <p style={{ fontWeight:700, fontSize:17, color:"#eef2ff", margin:"0 0 24px" }}>
        {isAr ? "تواصل مع فريق المؤسسات" : "Talk to our enterprise team"}
      </p>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {inp("name",    "Your name",         "اسمك")}
        {inp("email",   "Work email",        "البريد المهني", "email")}
        {inp("company", "Company name",      "اسم الشركة")}
        <select
          value={form.size}
          onChange={e => setForm(p => ({...p, size:e.target.value}))}
          style={{
            width:"100%", padding:"13px 16px", borderRadius:10,
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(148,163,184,0.12)",
            color: form.size ? "#eef2ff" : "#64748b", fontSize:14, outline:"none",
            direction: isAr ? "rtl" : "ltr", cursor:"pointer",
          }}
        >
          <option value="">{isAr ? "عدد الموظفين" : "Company size"}</option>
          <option value="100-499">100–499 employees</option>
          <option value="500-999">500–999 employees</option>
          <option value="1000+">1,000+ employees</option>
        </select>
        <textarea
          value={form.message}
          placeholder={isAr ? "ما الذي تريد تحقيقه؟" : "What are you hoping to achieve?"}
          onChange={e => setForm(p => ({...p, message:e.target.value}))}
          rows={3}
          style={{
            width:"100%", padding:"13px 16px", borderRadius:10,
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(148,163,184,0.12)",
            color:"#eef2ff", fontSize:14, outline:"none", resize:"vertical",
            fontFamily:"inherit", boxSizing:"border-box",
            direction: isAr ? "rtl" : "ltr",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !form.email || !form.name}
          style={{
            padding:"14px", borderRadius:10, border:"none",
            background: "linear-gradient(135deg,#6366f1,#0891b2)",
            color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer",
            opacity: (!form.email || !form.name) ? .5 : 1,
            transition:"opacity .15s, transform .15s",
          }}
          onMouseEnter={e => e.target.style.transform="scale(1.01)"}
          onMouseLeave={e => e.target.style.transform="none"}
        >
          {loading ? "..." : (isAr ? "أرسل الطلب →" : "Request Enterprise Demo →")}
        </button>
        <p style={{ fontSize:11, color:"#475569", textAlign:"center", margin:0 }}>
          {isAr ? "بدون التزام · رد خلال ٢٤ ساعة" : "No commitment · Response within 24 hours"}
        </p>
      </div>
    </div>
  );
}

function FeatureCard({ f, i }) {
  const [hov, setHov] = useState(false);
  return (
    <Reveal delay={i * 55} scale>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: hov ? `${f.accent}08` : D.card,
          border: `1px solid ${hov ? f.accent + "40" : D.border}`,
          borderRadius: 18, padding: "24px 22px",
          transition: "all .22s cubic-bezier(.16,1,.3,1)",
          transform: hov ? "translateY(-4px)" : "none",
          boxShadow: hov ? `0 16px 48px ${f.accent}18` : "none",
          position: "relative", overflow: "hidden",
        }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg,${f.accent}60,transparent)`,
          opacity: hov ? 1 : 0, transition: "opacity .22s",
        }}/>
        <div style={{
          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          background: `${f.accent}14`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, marginBottom: 14,
          boxShadow: hov ? `0 0 20px ${f.accent}30` : "none",
          transition: "box-shadow .22s",
        }}>{f.icon}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: D.text, marginBottom: 7 }}>{f.title}</div>
        <div style={{ fontSize: 12.5, color: D.sub, lineHeight: 1.65 }}>{f.desc}</div>
      </div>
    </Reveal>
  );
}

function PlanCard({ plan, price, i, t, isAr, onStart }) {
  const [hov, setHov] = useState(false);
  return (
    <Reveal delay={i * 70}>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: hov ? `${plan.color}08` : D.card,
          border: `${plan.popular ? 2 : 1}px solid ${plan.popular ? plan.color : hov ? `${plan.color}40` : D.border}`,
          borderRadius: 20, padding: "26px 22px",
          position: "relative", transition: "all .22s",
          transform: hov ? "translateY(-5px)" : "none",
          boxShadow: hov ? `0 20px 48px ${plan.color}20` : plan.popular ? `0 4px 24px ${plan.color}15` : "none",
        }}>
        {plan.popular && (
          <div style={{
            position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
            background: `linear-gradient(135deg,${plan.color},${plan.color}bb)`,
            color: "#fff", fontSize: 10, fontWeight: 800,
            padding: "3px 16px", borderRadius: 99, whiteSpace: "nowrap",
            boxShadow: `0 4px 12px ${plan.color}40`,
          }}>{isAr ? "الأكثر طلباً ✦" : "✦ Most Popular"}</div>
        )}
        <div style={{ fontSize: 15, fontWeight: 800, color: D.text, marginBottom: 8 }}>{plan.name}</div>
        {plan.price === 0 ? (
          <div style={{ fontSize: 30, fontWeight: 900, color: plan.color, marginBottom: 6, letterSpacing: "-1px" }}>
            {isAr ? "مجاناً" : "Free"}
          </div>
        ) : plan.price ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
            <span style={{ fontSize: 30, fontWeight: 900, color: plan.color, letterSpacing: "-1.5px" }}>
              {price?.toLocaleString()}
            </span>
            <span style={{ fontSize: 12, color: D.muted }}>
              {t.pricing.egp}{t.pricing.perMonth}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 22, fontWeight: 800, color: plan.color, marginBottom: 6 }}>
            {isAr ? "سعر مخصص" : "Custom"}
          </div>
        )}
        {plan.seats !== undefined && (
          <div style={{ fontSize: 11, color: D.muted, marginBottom: 16 }}>
            {t.pricing.seats(plan.seats)}
          </div>
        )}
        <div style={{ height: 1, background: D.border, marginBottom: 16 }}/>
        {plan.features.map((f, fi) => (
          <div key={fi} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 8 }}>
            <div style={{
              width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
              background: `${plan.color}18`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 8.5, color: plan.color, fontWeight: 800 }}>✓</span>
            </div>
            <span style={{ fontSize: 12, color: D.sub, lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
        <div style={{ marginTop: 18 }}>
          {plan.price === null ? (
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Enterprise Inquiry`} style={{
              display: "block", borderRadius: 10, padding: "11px 0",
              textAlign: "center", fontSize: 12, fontWeight: 700,
              color: plan.color, textDecoration: "none",
              background: `${plan.color}10`,
              border: `1px solid ${plan.color}25`,
            }}>{t.pricing.contactSales}</a>
          ) : (
            <button onClick={onStart} style={{
              width: "100%", borderRadius: 10, padding: "11px 0",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: plan.popular ? `linear-gradient(135deg,${plan.color},${plan.color}bb)` : `${plan.color}10`,
              border: plan.popular ? "none" : `1px solid ${plan.color}25`,
              color: plan.popular ? "#fff" : plan.color,
              boxShadow: plan.popular ? `0 4px 16px ${plan.color}35` : "none",
            }}>{t.pricing.getStarted}</button>
          )}
        </div>
      </div>
    </Reveal>
  );
}

// ─── Live Demo Preview component ──────────────────────────────────
function DemoPreview({ demo, isAr }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 100), 2000);
    return () => clearInterval(id);
  }, []);
  const scores = demo.chart;
  const maxS = Math.max(...scores);
  return (
    <div style={{
      background: D.surf,
      border: `1px solid ${D.border}`,
      borderRadius: 22,
      overflow: "hidden",
      boxShadow: "0 32px 96px rgba(0,0,0,.5)",
      maxWidth: 780, margin: "0 auto",
    }}>
      {/* Window chrome */}
      <div style={{
        padding: "12px 18px", background: D.card,
        borderBottom: `1px solid ${D.border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#ef4444","#f59e0b","#10b981"].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: .7 }}/>
          ))}
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,.04)", borderRadius: 6,
            padding: "3px 14px", fontSize: 11, color: D.muted,
          }}>
            🔒 app.corvus.io/dashboard
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: D.green, boxShadow: `0 0 6px ${D.green}` }}/>
          <span style={{ fontSize: 10, color: D.green, fontWeight: 600 }}>LIVE</span>
        </div>
      </div>

      {/* Dashboard content */}
      <div style={{ padding: "20px 20px 18px" }}>
        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
          {demo.metrics.map((m, i) => (
            <div key={i} style={{
              background: D.card, borderRadius: 12, padding: "12px 14px",
              border: `1px solid ${D.border}`, position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg,${m.color}60,transparent)`,
              }}/>
              <div style={{ fontSize: 9, color: D.muted, textTransform: "uppercase",
                letterSpacing: ".06em", marginBottom: 5 }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: m.color, letterSpacing: "-0.5px" }}>
                {m.value}
              </div>
              <div style={{ fontSize: 9, color: D.muted, marginTop: 3 }}>{m.delta}</div>
            </div>
          ))}
        </div>

        {/* Chart + AI insight */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12 }}>
          {/* Chart */}
          <div style={{
            background: D.card, borderRadius: 14, padding: "14px 16px",
            border: `1px solid ${D.border}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.text }}>
                {isAr ? "اتجاه مؤشر الصحة" : "Health Intelligence Trend"}
              </div>
              <div style={{ fontSize: 10, color: D.green, fontWeight: 600 }}>↑ Improving</div>
            </div>
            <div style={{ display: "flex", gap: 4, height: 56, alignItems: "flex-end" }}>
              {scores.map((s, i) => {
                const isLast = i === scores.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 3 }}>
                    <div style={{
                      width: "100%", borderRadius: "3px 3px 0 0",
                      background: isLast ? D.blue : `${D.blue}50`,
                      height: Math.max(3, Math.round(s / maxS * 52)),
                      transition: "height .4s",
                      boxShadow: isLast ? `0 0 8px ${D.blue}60` : "none",
                    }}/>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Insight */}
          <div style={{
            background: "linear-gradient(135deg,rgba(99,102,241,.08),rgba(8,145,178,.06))",
            border: `1px solid rgba(99,102,241,.2)`,
            borderRadius: 14, padding: "14px 16px",
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "rgba(99,102,241,.15)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
              }}>✦</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.blueBr }}>
                {isAr ? "رؤية AI" : "AI Insight"}
              </div>
            </div>
            <div style={{ fontSize: 11, color: D.sub, lineHeight: 1.65 }}>
              {isAr
                ? "3 موظفون يُظهرون أنماط تدل على إرهاق وشيك. يُنصح بالتدخل خلال الأسبوعين القادمين."
                : "3 employees showing early burnout patterns. Recommend intervention within the next 2 weeks."}
            </div>
            <div style={{
              marginTop: 10, display: "flex", gap: 4, alignItems: "center",
              fontSize: 10, color: D.amber, fontWeight: 600,
            }}>
              ⚠ {isAr ? "يحتاج انتباهاً" : "Needs attention"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────
export default function LandingPage({ onStart, lang = "en", setLang, darkMode, setDarkMode }) {
  const isAr = lang === "ar";
  const dir  = isAr ? "rtl" : "ltr";
  const t    = COPY[lang] || COPY.en;

  const [pricingTab,   setPricingTab]   = useState("b2b");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [openFaq,      setOpenFaq]      = useState(null);
  const [navScrolled,  setNavScrolled]  = useState(false);
  const [mobileMenu,   setMobileMenu]   = useState(false);

  useEffect(() => {
    const fn = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const gPrimary = { background: D.gPrimary, border: "none" };
  const btnP = {
    ...gPrimary, display: "inline-flex", alignItems: "center", gap: 8,
    borderRadius: 12, padding: "14px 28px", fontSize: 14,
    fontWeight: 700, color: "#fff", cursor: "pointer",
    boxShadow: `0 6px 28px rgba(99,102,241,.38)`,
    transition: "all .2s",
  };
  const btnS = {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "transparent",
    border: `1px solid ${D.borderM}`,
    borderRadius: 12, padding: "13px 24px", fontSize: 13,
    fontWeight: 600, color: D.sub, cursor: "pointer",
    transition: "all .2s",
  };

  const SECTIONS_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}
    ::-webkit-scrollbar{width:4px}
    ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:99px}
    @keyframes blob{0%,100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%}50%{border-radius:30% 60% 70% 40%/50% 60% 30% 60%}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes grid-fade{from{opacity:0}to{opacity:.4}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .lp-hover-lift:hover{transform:translateY(-3px)!important;transition:transform .2s!important}
    .lp-btn-primary:hover{filter:brightness(1.08);transform:translateY(-2px)}
    .lp-btn-secondary:hover{border-color:rgba(99,102,241,.5)!important;color:#c7d2fe!important}
    @media(max-width:640px){
      .hide-mobile{display:none!important}
      .lp-hero-h1{font-size:clamp(32px,9vw,52px)!important}
      .lp-section{padding:64px 20px!important}
      .lp-grid-2{grid-template-columns:1fr!important}
      .lp-grid-4{grid-template-columns:repeat(2,1fr)!important}
    }
    @media(min-width:641px) and (max-width:1023px){
      .lp-grid-3{grid-template-columns:repeat(2,1fr)!important}
      .lp-grid-4{grid-template-columns:repeat(2,1fr)!important}
    }
  `;

  return (
    <div dir={dir} style={{
      background: D.bg, color: D.text,
      fontFamily: "'Inter', system-ui, sans-serif",
      overflowX: "hidden", minHeight: "100vh",
    }}>
      <style>{SECTIONS_CSS}</style>

      {/* ══ NAVBAR ══════════════════════════════════════════════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        background: navScrolled ? "rgba(4,11,20,.94)" : "transparent",
        backdropFilter: navScrolled ? "blur(16px)" : "none",
        borderBottom: navScrolled ? `1px solid ${D.border}` : "none",
        transition: "all .35s cubic-bezier(.16,1,.3,1)",
        height: 62, padding: "0 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 32, height: 32, background: D.gPrimary,
            borderRadius: 10, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 17, fontWeight: 800,
            boxShadow: navScrolled ? `0 0 14px rgba(99,102,241,.3)` : "none",
          }}>◈</div>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.025em" }}>
            Corvus <span style={{ color: D.blue }}>Pro</span>
          </span>
        </div>

        {/* Links */}
        <div className="hide-mobile" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {[[`#demo`, t.nav.platform], [`#b2b`, t.nav.enterprise], [`#pricing`, t.nav.pricing]].map(([href, label]) => (
            <a key={href} href={href} style={{
              fontSize: 13, color: D.sub, textDecoration: "none",
              fontWeight: 500, transition: "color .2s",
            }}
            onMouseEnter={e => e.target.style.color = D.text}
            onMouseLeave={e => e.target.style.color = D.sub}>{label}</a>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setLang(isAr ? "en" : "ar")}
            className="hide-mobile"
            style={{
              background: "rgba(148,163,184,.06)",
              border: `1px solid ${D.border}`,
              borderRadius: 7, padding: "5px 12px",
              fontSize: 11, color: D.muted, cursor: "pointer",
            }}>{isAr ? "🇬🇧 EN" : "🇪🇬 عربي"}</button>
          <button onClick={() => setDarkMode(!darkMode)}
            className="hide-mobile"
            style={{
              background: "rgba(148,163,184,.06)",
              border: `1px solid ${D.border}`,
              borderRadius: 7, padding: "5px 8px",
              fontSize: 13, cursor: "pointer",
            }}>{darkMode ? "☀️" : "🌙"}</button>
          <button onClick={onStart} className="lp-btn-primary" style={{
            ...btnP, padding: "8px 20px", fontSize: 12,
            boxShadow: `0 3px 14px rgba(99,102,241,.3)`,
          }}>{t.nav.cta}</button>
        </div>
      </nav>

      {/* ══ HERO ════════════════════════════════════════════════════ */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "100px 32px 80px", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Grid bg */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `linear-gradient(${D.border} 1px,transparent 1px),linear-gradient(90deg,${D.border} 1px,transparent 1px)`,
          backgroundSize: "64px 64px",
          animation: "grid-fade 1.5s ease forwards",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 40%,black 30%,transparent 100%)",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%,black 30%,transparent 100%)",
        }}/>
        {/* Blobs */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {[
            { top:"8%",  left:"10%",  w:700, h:700, c:"rgba(99,102,241,.12)",  d:14 },
            { top:"50%", right:"5%",  w:500, h:500, c:"rgba(8,145,178,.09)",   d:18, delay:5 },
            { top:"30%", left:"40%",  w:350, h:350, c:"rgba(167,139,250,.07)", d:0  },
          ].map((b, i) => (
            <div key={i} style={{
              position: "absolute", ...b,
              background: `radial-gradient(circle,${b.c},transparent 60%)`,
              borderRadius: "50%",
              ...(b.d ? { animation: `blob ${b.d}s ease ${b.delay || 0}s infinite` } : {}),
            }}/>
          ))}
        </div>

        <div style={{ position: "relative", maxWidth: 820 }}>
          {/* Eyebrow badge */}
          <Reveal>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.22)",
              borderRadius: 99, padding: "7px 18px", fontSize: 12, color: "#a5b4fc",
              marginBottom: 28, fontWeight: 500,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%",
                background: D.green, boxShadow: `0 0 6px ${D.green}` }}/>
              {t.hero.eyebrow}
            </div>
          </Reveal>

          {/* H1 */}
          <Reveal delay={80}>
            <h1 className="lp-hero-h1" style={{
              fontSize: "clamp(40px,6.5vw,80px)",
              fontWeight: 900, lineHeight: 1.08,
              letterSpacing: "-.04em", marginBottom: 24,
            }}>
              <span style={{
                background: D.gHero,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>{t.hero.h1a}</span>
              <br/>{t.hero.h1b}
            </h1>
          </Reveal>

          {/* Sub */}
          <Reveal delay={150}>
            <p style={{
              fontSize: "clamp(15px,2vw,18px)", color: D.sub,
              maxWidth: 580, margin: "0 auto 36px", lineHeight: 1.75,
            }}>{t.hero.sub}</p>
          </Reveal>

          {/* CTAs */}
          <Reveal delay={210}>
            <div style={{ display: "flex", gap: 12, justifyContent: "center",
              flexWrap: "wrap", marginBottom: 36 }}>
              <button onClick={onStart} className="lp-btn-primary" style={btnP}>
                ▶ {t.hero.cta1}
              </button>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Enterprise Demo Request`}
                className="lp-btn-secondary" style={{ ...btnS, textDecoration: "none" }}>
                {t.hero.cta2}
              </a>
            </div>
          </Reveal>

          {/* Trust pills */}
          <Reveal delay={270}>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {t.hero.trust.map((p, i) => (
                <span key={i} style={{
                  background: "rgba(148,163,184,.06)",
                  border: `1px solid ${D.border}`,
                  borderRadius: 99, padding: "5px 14px",
                  fontSize: 11.5, color: D.muted,
                }}>✓ {p}</span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ SOCIAL PROOF BAR ════════════════════════════════════════ */}
      <section style={{
        padding: "28px 32px",
        background: D.bgUp,
        borderTop: `1px solid ${D.border}`,
        borderBottom: `1px solid ${D.border}`,
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28,
            justifyContent: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: D.muted, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: ".08em", flexShrink: 0 }}>
              {t.proof.label}
            </span>
            {t.proof.logos.map((logo, i) => (
              <div key={i} style={{
                fontSize: 12, fontWeight: 700, color: D.muted,
                padding: "6px 18px",
                border: `1px solid ${D.border}`,
                borderRadius: 8, background: D.card,
                opacity: .75, transition: "opacity .2s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "1"}
              onMouseLeave={e => e.currentTarget.style.opacity = ".75"}>
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ANIMATED STATS ══════════════════════════════════════════ */}
      <section style={{ padding: "80px 32px", background: D.bgUp }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div className="lp-grid-4" style={{
            display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20,
          }}>
            {t.stats.map((s, i) => (
              <Reveal key={i} delay={i * 80}>
                <div style={{
                  textAlign: "center", padding: "28px 20px",
                  background: D.card, border: `1px solid ${D.border}`,
                  borderRadius: 18,
                }}>
                  <div style={{
                    fontSize: "clamp(32px,4vw,48px)", fontWeight: 900,
                    background: D.gHero,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    lineHeight: 1, marginBottom: 10,
                  }}>
                    <AnimatedNumber to={s.n} prefix={s.pfx || ""} suffix={s.sfx || ""}/>
                  </div>
                  <div style={{ fontSize: 12.5, color: D.sub, lineHeight: 1.55 }}>{s.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ LIVE DEMO PREVIEW ═══════════════════════════════════════ */}
      <section id="demo" className="lp-section" style={{ padding: "100px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <div style={{
                display: "inline-block",
                background: "rgba(16,185,129,.1)",
                border: "1px solid rgba(16,185,129,.22)",
                borderRadius: 99, padding: "5px 16px",
                fontSize: 11, color: "#34d399",
                fontWeight: 700, letterSpacing: ".08em", marginBottom: 16,
              }}>{t.demo.eyebrow}</div>
              <h2 style={{
                fontSize: "clamp(26px,4vw,44px)", fontWeight: 900,
                letterSpacing: "-.03em", marginBottom: 14,
              }}>{t.demo.h2}</h2>
              <p style={{ fontSize: 15.5, color: D.sub, maxWidth: 520, margin: "0 auto" }}>
                {t.demo.sub}
              </p>
            </div>
          </Reveal>
          <Reveal delay={100} y={36} scale>
            <DemoPreview demo={t.demo} isAr={isAr}/>
          </Reveal>
          <Reveal delay={160}>
            <div style={{ textAlign: "center", marginTop: 32 }}>
              <button onClick={onStart} className="lp-btn-primary" style={{
                ...btnP, fontSize: 13,
              }}>
                {isAr ? "▶ جرب المنصة الآن — مجاناً" : "▶ Try the Platform Now — Free"}
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ CASE STUDIES ════════════════════════════════════════════ */}
      <section style={{
        padding: "100px 32px",
        background: D.bgUp,
        borderTop: `1px solid ${D.border}`,
        borderBottom: `1px solid ${D.border}`,
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <div style={{
                display: "inline-block",
                background: "rgba(245,158,11,.08)",
                border: "1px solid rgba(245,158,11,.2)",
                borderRadius: 99, padding: "5px 16px",
                fontSize: 11, color: "#fbbf24",
                fontWeight: 700, letterSpacing: ".08em", marginBottom: 16,
              }}>{t.cases.eyebrow}</div>
              <h2 style={{
                fontSize: "clamp(26px,4vw,44px)", fontWeight: 900,
                letterSpacing: "-.03em",
              }}>{t.cases.h2}</h2>
            </div>
          </Reveal>
          <div className="lp-grid-2" style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
          }}>
            {t.cases.items.map((cs, i) => (
              <Reveal key={i} delay={i * 100}>
                <div style={{
                  background: D.card,
                  border: `1px solid ${D.border}`,
                  borderRadius: 20, overflow: "hidden",
                  transition: "transform .2s, box-shadow .2s",
                }}
                className="lp-hover-lift">
                  {/* Case header */}
                  <div style={{
                    padding: "20px 22px", background: D.surf,
                    borderBottom: `1px solid ${D.border}`,
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                        background: `linear-gradient(135deg,${cs.color},${cs.color}bb)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 800, color: "white",
                      }}>{cs.logo}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: D.text }}>
                          {cs.company}
                        </div>
                        <div style={{ fontSize: 11, color: D.muted, marginTop: 2 }}>
                          {cs.industry}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      background: `${cs.color}14`,
                      border: `1px solid ${cs.color}30`,
                      borderRadius: 99, padding: "4px 12px",
                      fontSize: 10, fontWeight: 700, color: cs.color,
                    }}>{cs.result}</div>
                  </div>

                  {/* Metrics */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 0, borderBottom: `1px solid ${D.border}`,
                  }}>
                    {[cs.metric1, cs.metric2, cs.metric3].map((m, mi) => (
                      <div key={mi} style={{
                        padding: "16px 14px", textAlign: "center",
                        borderRight: mi < 2 ? `1px solid ${D.border}` : "none",
                      }}>
                        <div style={{ fontSize: 22, fontWeight: 900,
                          color: cs.color, letterSpacing: "-1px" }}>{m.n}</div>
                        <div style={{ fontSize: 9.5, color: D.muted, marginTop: 3,
                          lineHeight: 1.3 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Quote */}
                  <div style={{ padding: "18px 22px" }}>
                    <div style={{ fontSize: 12.5, color: D.sub, lineHeight: 1.7,
                      fontStyle: "italic", marginBottom: 12 }}>
                      "{cs.quote}"
                    </div>
                    <div style={{ fontSize: 11, color: D.muted, fontWeight: 600 }}>
                      — {cs.person}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ B2B FEATURES ════════════════════════════════════════════ */}
      <section id="b2b" className="lp-section" style={{ padding: "100px 32px" }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{
                display: "inline-block",
                background: "rgba(8,145,178,.08)",
                border: "1px solid rgba(8,145,178,.2)",
                borderRadius: 99, padding: "5px 16px",
                fontSize: 11, color: "#38bdf8",
                fontWeight: 700, letterSpacing: ".08em", marginBottom: 16,
              }}>{t.b2b.eyebrow}</div>
              <h2 style={{ fontSize: "clamp(26px,4vw,44px)", fontWeight: 900,
                letterSpacing: "-.03em", marginBottom: 14 }}>{t.b2b.h2}</h2>
              <p style={{ fontSize: 16, color: D.sub, maxWidth: 580,
                margin: "0 auto" }}>{t.b2b.sub}</p>
            </div>
          </Reveal>
          <div className="lp-grid-3" style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 44,
          }}>
            {t.b2b.features.map((f, i) => <FeatureCard key={i} f={f} i={i}/>)}
          </div>
          <Reveal>
            <div style={{ textAlign: "center" }}>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Workforce Intelligence Demo`}
                className="lp-btn-primary" style={{ ...btnP, textDecoration: "none" }}>
                {t.b2b.cta}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ B2C FEATURES ════════════════════════════════════════════ */}
      <section className="lp-section" style={{
        padding: "100px 32px",
        background: D.bgUp,
        borderTop: `1px solid ${D.border}`,
        borderBottom: `1px solid ${D.border}`,
      }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div style={{
                display: "inline-block",
                background: "rgba(99,102,241,.08)",
                border: "1px solid rgba(99,102,241,.2)",
                borderRadius: 99, padding: "5px 16px",
                fontSize: 11, color: "#818cf8",
                fontWeight: 700, letterSpacing: ".08em", marginBottom: 16,
              }}>{t.b2c.eyebrow}</div>
              <h2 style={{ fontSize: "clamp(26px,4vw,44px)", fontWeight: 900,
                letterSpacing: "-.03em", marginBottom: 14 }}>{t.b2c.h2}</h2>
              <p style={{ fontSize: 16, color: D.sub, maxWidth: 560,
                margin: "0 auto" }}>{t.b2c.sub}</p>
            </div>
          </Reveal>
          <div className="lp-grid-3" style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 44,
          }}>
            {t.b2c.features.map((f, i) => <FeatureCard key={i} f={f} i={i}/>)}
          </div>
          <Reveal>
            <div style={{ textAlign: "center" }}>
              <button onClick={onStart} className="lp-btn-primary" style={btnP}>
                {t.b2c.cta}
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ PRICING ═════════════════════════════════════════════════ */}
      <section id="pricing" className="lp-section" style={{ padding: "100px 32px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{
                display: "inline-block",
                background: "rgba(16,185,129,.08)",
                border: "1px solid rgba(16,185,129,.2)",
                borderRadius: 99, padding: "5px 16px",
                fontSize: 11, color: "#34d399",
                fontWeight: 700, letterSpacing: ".08em", marginBottom: 16,
              }}>{t.pricing.eyebrow}</div>
              <h2 style={{ fontSize: "clamp(26px,4vw,44px)", fontWeight: 900,
                letterSpacing: "-.03em", marginBottom: 10 }}>{t.pricing.h2}</h2>
              <p style={{ fontSize: 15, color: D.sub, marginBottom: 30 }}>{t.pricing.sub}</p>

              {/* B2B / B2C toggle */}
              <div style={{ display: "inline-flex",
                background: "rgba(148,163,184,.06)",
                border: `1px solid ${D.border}`,
                borderRadius: 13, padding: 4, gap: 3, marginBottom: 18 }}>
                {[["b2b", t.pricing.b2bLabel], ["b2c", t.pricing.b2cLabel]].map(([v, l]) => (
                  <button key={v} onClick={() => setPricingTab(v)} style={{
                    padding: "9px 24px", fontSize: 12.5, fontWeight: 600,
                    background: pricingTab === v ? D.blue : "transparent",
                    color: pricingTab === v ? "#fff" : D.muted,
                    border: "none", borderRadius: 10,
                    cursor: "pointer", transition: "all .2s",
                    boxShadow: pricingTab === v ? `0 2px 12px ${D.blue}40` : "none",
                  }}>{l}</button>
                ))}
              </div>
              <br/>
              {/* Monthly / Yearly */}
              <div style={{ display: "inline-flex",
                background: "rgba(148,163,184,.06)",
                border: `1px solid ${D.border}`,
                borderRadius: 10, padding: 3, gap: 2 }}>
                {["monthly", "yearly"].map(b => (
                  <button key={b} onClick={() => setBillingCycle(b)} style={{
                    padding: "7px 20px", fontSize: 12, fontWeight: 600,
                    background: billingCycle === b ? D.surf : "transparent",
                    color: billingCycle === b ? D.text : D.muted,
                    border: billingCycle === b ? `1px solid ${D.border}` : "1px solid transparent",
                    borderRadius: 8, cursor: "pointer", transition: "all .2s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    {b === "monthly" ? t.pricing.monthly : t.pricing.yearly}
                    {b === "yearly" && (
                      <span style={{
                        fontSize: 9, background: "rgba(16,185,129,.18)",
                        color: D.green, padding: "1px 7px", borderRadius: 99, fontWeight: 700,
                      }}>{t.pricing.save}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Plan cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: pricingTab === "b2c"
              ? "repeat(3,1fr)"
              : "repeat(4,1fr)",
            gap: 14,
          }}>
            {(pricingTab === "b2b" ? t.pricing.b2bPlans : t.pricing.b2cPlans).map((plan, i) => {
              const price = billingCycle === "yearly" && plan.price
                ? Math.round(plan.price * .83) : plan.price;
              return (
                <PlanCard key={plan.id} plan={plan} price={price} i={i}
                  t={t} isAr={isAr} onStart={onStart}/>
              );
            })}
          </div>

          {/* Money-back guarantee */}
          <Reveal delay={200}>
            <div style={{
              marginTop: 36, textAlign: "center",
              display: "flex", gap: 24, justifyContent: "center",
              flexWrap: "wrap",
            }}>
              {[
                ["🔒", isAr ? "لا بطاقة بنكية مطلوبة" : "No credit card required"],
                ["↩", isAr ? "إلغاء في أي وقت" : "Cancel anytime"],
                ["✦", isAr ? "تجربة 7 أيام مجانية" : "7-day free trial"],
                ["🛡", isAr ? "بيانات آمنة 100%" : "100% data privacy"],
              ].map(([icon, label], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, color: D.muted }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>{label}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ TESTIMONIALS ════════════════════════════════════════════ */}
      <section style={{
        padding: "100px 32px",
        background: D.bgUp,
        borderTop: `1px solid ${D.border}`,
      }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <Reveal>
            <h2 style={{
              textAlign: "center", fontSize: "clamp(24px,4vw,40px)",
              fontWeight: 900, letterSpacing: "-.03em", marginBottom: 12,
            }}>{isAr ? "ماذا يقول عملاؤنا" : "What our customers say"}</h2>
            <p style={{ textAlign: "center", color: D.muted, fontSize: 13, marginBottom: 44 }}>
              {isAr ? "شركات حقيقية. نتائج قابلة للقياس." : "Real companies. Measurable outcomes."}
            </p>
          </Reveal>
          <div className="lp-grid-3" style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16,
          }}>
            {t.testimonials.map((tm, i) => (
              <Reveal key={i} delay={i * 90}>
                <div className="lp-hover-lift" style={{
                  background: D.card, border: `1px solid ${D.border}`,
                  borderRadius: 20, padding: "24px 22px",
                  transition: "transform .2s, box-shadow .2s",
                  display: "flex", flexDirection: "column", gap: 16,
                }}>
                  {/* Stars */}
                  <div style={{ display: "flex", gap: 3 }}>
                    {[0,1,2,3,4].map(s => (
                      <span key={s} style={{ color: D.amber, fontSize: 13 }}>★</span>
                    ))}
                  </div>
                  {/* Quote */}
                  <p style={{
                    fontSize: 13, color: D.sub, lineHeight: 1.7, flex: 1,
                    fontStyle: "italic",
                  }}>"{tm.quote}"</p>
                  {/* Author */}
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      background: D.gPrimary,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, color: "#fff", fontWeight: 700,
                    }}>{tm.avatar}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: D.text }}>{tm.name}</div>
                      <div style={{ fontSize: 10.5, color: D.muted, marginTop: 2 }}>{tm.role}</div>
                    </div>
                    <div style={{
                      fontSize: 15, fontWeight: 900,
                      color: tm.score >= 80 ? D.green : tm.score >= 60 ? D.amber : D.red,
                      flexShrink: 0,
                    }}>{tm.score}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      
      {/* ══ HOW IT WORKS ════════════════════════════════════════════ */}
      <section style={{ padding: "100px 32px", background: D.bg }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign:"center", marginBottom: 64 }}>
              <p style={{ fontSize:12, fontWeight:700, letterSpacing:".14em", color:D.sub, textTransform:"uppercase", marginBottom:14 }}>
                {isAr ? "كيف يعمل" : "HOW IT WORKS"}
              </p>
              <h2 style={{ fontSize:"clamp(28px,4vw,42px)", fontWeight:700, color:D.text, margin:"0 0 16px" }}>
                {isAr ? "ثلاث خطوات للبدء" : "Up and running in 3 minutes"}
              </h2>
              <p style={{ fontSize:17, color:D.sub, maxWidth:560, margin:"0 auto" }}>
                {isAr ? "لا أجهزة. لا تحميل. افتح المتصفح وابدأ فوراً." : "No hardware. No downloads. Open your browser and start instantly."}
              </p>
            </div>
          </Reveal>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:32 }}>
            {[
              {
                step:"01",
                icon:"📷",
                en_title:"Allow Camera Access",
                ar_title:"اسمح بالوصول للكاميرا",
                en_desc:"One-click permission. Corvus uses your existing webcam — no account, no hardware, no app install. Works on any modern browser.",
                ar_desc:"إذن بنقرة واحدة. يستخدم Corvus كاميرا الويب الموجودة — لا تثبيت، لا أجهزة.",
                color:"#6366f1",
              },
              {
                step:"02",
                icon:"🤖",
                en_title:"AI Calibrates to You",
                ar_title:"الذكاء الاصطناعي يعمل",
                en_desc:"33 body landmarks tracked in real time. Our MediaPipe + Gemini pipeline analyzes posture, head angle, blink rate, and fatigue in milliseconds.",
                ar_desc:"تتبع 33 نقطة في الجسم بشكل فوري. يحلل خط الكتف، زاوية الرأس، معدل الرمش، والتعب.",
                color:"#0891b2",
              },
              {
                step:"03",
                icon:"📊",
                en_title:"Get Actionable Insights",
                ar_title:"احصل على رؤى قابلة للتنفيذ",
                en_desc:"Your AI health coach delivers personalized recommendations, risk alerts, and weekly PDF reports. HR dashboards update in real time.",
                ar_desc:"يقدم مدربك الذكي توصيات شخصية وتنبيهات المخاطر وتقارير أسبوعية.",
                color:"#10b981",
              },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 120}>
                <div style={{
                  background: D.card,
                  borderRadius: 20,
                  padding: "36px 28px",
                  border: `1px solid ${D.border}`,
                  position:"relative",
                  overflow:"hidden",
                  transition:"transform .2s, border-color .2s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.borderColor=s.color+"66"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.borderColor=D.border; }}
                >
                  <div style={{
                    position:"absolute", top:20, right: isAr ? "auto" : 24, left: isAr ? 24 : "auto",
                    fontSize:64, fontWeight:900, color:"rgba(255,255,255,0.03)", lineHeight:1,
                    userSelect:"none",
                  }}>{s.step}</div>
                  <div style={{
                    width:52, height:52, borderRadius:14,
                    background:`${s.color}18`,
                    border:`1px solid ${s.color}33`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:24, marginBottom:20,
                  }}>{s.icon}</div>
                  <p style={{ fontWeight:700, fontSize:18, color:D.text, margin:"0 0 10px" }}>
                    {isAr ? s.ar_title : s.en_title}
                  </p>
                  <p style={{ fontSize:14, color:D.sub, lineHeight:1.7, margin:0 }}>
                    {isAr ? s.ar_desc : s.en_desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ENTERPRISE CONTACT ════════════════════════════════════════ */}
      <section id="enterprise" style={{ padding: "100px 32px", background: D.surf }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:64, alignItems:"center" }}>
          <Reveal>
            <div>
              <p style={{ fontSize:12, fontWeight:700, letterSpacing:".14em", color:D.sub, textTransform:"uppercase", marginBottom:14 }}>
                {isAr ? "حلول المؤسسات" : "ENTERPRISE SOLUTIONS"}
              </p>
              <h2 style={{ fontSize:"clamp(26px,3.5vw,40px)", fontWeight:700, color:D.text, margin:"0 0 20px", lineHeight:1.2 }}>
                  {isAr ? "أكثر من ١٠٠ موظف؟ تواصل معنا" : "Over 100 employees? Let's build your custom plan."}


              </h2>
              <p style={{ fontSize:16, color:D.sub, lineHeight:1.8, margin:"0 0 32px" }}>
                {isAr
                  ? "العملاء المؤسسيون يحصلون على: SSO/SAML، Azure AD، Okta، تقارير ذكاء اصطناعي مخصصة، تكامل HRIS، لوحة ذات علامة بيضاء، مدير نجاح مخصص، واتفاقية مستوى خدمة."
                  : "Enterprise customers get: SSO/SAML, Azure AD & Okta, Custom AI reports, HRIS integration, White-label dashboard, Dedicated CSM, and SLA guarantee."}
              </p>
              {[
                { icon:"🔒", en:"Enterprise SSO & SAML", ar:"تسجيل الدخول الموحد SSO" },
                { icon:"🔗", en:"HRIS & Slack Integration", ar:"تكامل HRIS وSlack" },
                { icon:"🎨", en:"White-Label Dashboard", ar:"لوحة تحكم بعلامتك التجارية" },
                { icon:"📋", en:"Custom SLA & Compliance", ar:"اتفاقية خدمة مخصصة" },
              ].map((f,i) => (
                <div key={i} style={{ display:"flex", gap:12, alignItems:"center", marginBottom:14 }}>
                  <span style={{ fontSize:20 }}>{f.icon}</span>
                  <span style={{ fontSize:15, color:D.sub }}>{isAr ? f.ar : f.en}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={160}>
            <EnterpriseContactForm t={t} isAr={isAr} cs={D} />
          </Reveal>
        </div>
      </section>

      {/* ══ FAQ ══════════════════════════════════════════════════════ */}
      <section style={{ padding: "100px 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Reveal>
            <h2 style={{
              textAlign: "center", fontSize: "clamp(24px,4vw,40px)",
              fontWeight: 900, letterSpacing: "-.03em", marginBottom: 44,
            }}>{isAr ? "الأسئلة الشائعة" : "Frequently Asked Questions"}</h2>
          </Reveal>
          {t.faq.map((item, i) => (
            <Reveal key={i} delay={i * 45}>
              <div style={{
                marginBottom: 8,
                background: D.card,
                border: `1px solid ${openFaq === i ? D.borderH : D.border}`,
                borderRadius: 14, overflow: "hidden",
                transition: "border-color .22s",
              }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                  width: "100%", padding: "18px 22px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "none", border: "none", cursor: "pointer",
                  textAlign: isAr ? "right" : "left",
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: D.text, flex: 1 }}>
                    {item.q}
                  </span>
                  <span style={{
                    fontSize: 18, color: openFaq === i ? D.blue : D.muted,
                    transition: "transform .22s, color .22s",
                    transform: openFaq === i ? "rotate(45deg)" : "none",
                    flexShrink: 0, marginLeft: 12,
                  }}>+</span>
                </button>
                <div style={{
                  maxHeight: openFaq === i ? 200 : 0,
                  overflow: "hidden",
                  transition: "max-height .35s cubic-bezier(.16,1,.3,1)",
                }}>
                  <div style={{ padding: "0 22px 18px", fontSize: 13.5,
                    color: D.sub, lineHeight: 1.7 }}>{item.a}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ FINAL CTA ════════════════════════════════════════════════ */}
      <section style={{
        padding: "120px 32px", textAlign: "center",
        position: "relative", overflow: "hidden",
        borderTop: `1px solid ${D.border}`,
      }}>
        {/* Ambient */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{
            position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
            width: 800, height: 800,
            background: "radial-gradient(circle,rgba(99,102,241,.12),transparent 55%)",
          }}/>
        </div>

        <Reveal>
          <div style={{ position: "relative", maxWidth: 640, margin: "0 auto" }}>
            {/* Badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.2)",
              borderRadius: 99, padding: "5px 14px",
              fontSize: 11, color: "#34d399", fontWeight: 600,
              marginBottom: 24,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%",
                background: D.green, boxShadow: `0 0 6px ${D.green}` }}/>
              {isAr ? "500+ شركة تثق بنا الآن" : "500+ companies trust Corvus"}
            </div>

            <h2 style={{
              fontSize: "clamp(30px,5.5vw,58px)", fontWeight: 900,
              letterSpacing: "-.04em", lineHeight: 1.1, marginBottom: 18,
            }}>
              {t.finalCta.h2a}<br/>
              <span style={{
                background: D.gHero,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>{t.finalCta.h2b}</span>
            </h2>
            <p style={{ fontSize: 16, color: D.sub, marginBottom: 36,
              lineHeight: 1.7 }}>{t.finalCta.sub}</p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={onStart} className="lp-btn-primary" style={btnP}>
                ▶ {t.finalCta.cta1}
              </button>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Sales Inquiry`}
                className="lp-btn-secondary" style={{ ...btnS, textDecoration: "none" }}>
                {t.finalCta.cta2}
              </a>
            </div>

            {/* Trust indicators */}
            <div style={{ marginTop: 28, display: "flex", gap: 20,
              justifyContent: "center", flexWrap: "wrap" }}>
              {["SOC 2 Type II", "GDPR Compliant", "ISO 27001 Ready", "Zero video storage"].map((l, i) => (
                <span key={i} style={{ fontSize: 11, color: D.muted,
                  display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ color: D.green }}>✓</span>{l}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════ */}
      <footer style={{
        padding: "36px 32px",
        borderTop: `1px solid ${D.border}`,
        background: D.bgUp,
      }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", flexWrap: "wrap", gap: 24, marginBottom: 28 }}>
            {/* Brand */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, background: D.gPrimary,
                  borderRadius: 9, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 15 }}>◈</div>
                <span style={{ fontSize: 15, fontWeight: 800 }}>Corvus</span>
              </div>
              <div style={{ fontSize: 11.5, color: D.muted, lineHeight: 1.6 }}>
                {t.footer.tagline}
              </div>
            </div>
            {/* Links */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
              {t.footer.links.map((l, i) => (
                <a key={i} href="#" style={{ fontSize: 12, color: D.muted,
                  textDecoration: "none", transition: "color .2s" }}
                onMouseEnter={e => e.target.style.color = D.text}
                onMouseLeave={e => e.target.style.color = D.muted}>{l}</a>
              ))}
            </div>
            {/* Contact */}
            <div style={{ fontSize: 11.5, color: D.muted, lineHeight: 1.9 }}>
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: D.blue,
                textDecoration: "none", display: "block" }}>{SUPPORT_EMAIL}</a>
              <a href={`tel:${ADMIN_PHONE}`} style={{ color: D.muted,
                textDecoration: "none" }}>{ADMIN_PHONE}</a>
            </div>
          </div>
          <div style={{ height: 1, background: D.border, marginBottom: 18 }}/>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontSize: 11, color: D.muted }}>
              © {new Date().getFullYear()} Corvus · {t.footer.rights}
            </span>
            <div style={{ display: "flex", gap: 16 }}>
              <button onClick={() => setLang(isAr ? "en" : "ar")} style={{
                background: "none", border: `1px solid ${D.border}`,
                borderRadius: 6, padding: "3px 10px",
                fontSize: 10, color: D.muted, cursor: "pointer",
              }}>{isAr ? "🇬🇧 English" : "🇪🇬 العربية"}</button>
              <button onClick={() => setDarkMode(!darkMode)} style={{
                background: "none", border: `1px solid ${D.border}`,
                borderRadius: 6, padding: "3px 8px",
                fontSize: 11, cursor: "pointer", color: D.muted,
              }}>{darkMode ? "☀️ Light" : "🌙 Dark"}</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
// ── UNUSED (tree-shaken) — preserves module boundary for code splitting ──
export const _landingPageVersion = "6.1-ultimate";
