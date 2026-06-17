/**
 * Corvus — In-App Help Center
 * FAQ + quick start guides, bilingual AR/EN
 * No external deps — pure React with search
 */
import React, { useState, useMemo } from "react";

const FAQ = [
  {
    category: "camera",      category_ar: "الكاميرا",
    q_en: "Why is my camera not working?",
    q_ar: "لماذا لا تعمل كاميرتي؟",
    a_en: "Click 'Allow' when your browser asks for camera permission. If you already denied it, click the camera icon in your browser's address bar and select 'Allow'. Make sure no other app is using your camera at the same time.",
    a_ar: "انقر على 'السماح' عندما يطلب منك المتصفح إذن الكاميرا. إذا رفضت سابقاً، انقر على أيقونة الكاميرا في شريط العنوان واختر 'السماح'. تأكد من أن تطبيقاً آخر لا يستخدم الكاميرا.",
  },
  {
    category: "score",       category_ar: "النتيجة",
    q_en: "How is my posture score calculated?",
    q_ar: "كيف تُحسب نتيجة وضعيتي؟",
    a_en: "Corvus uses 33 body landmarks and 478 face landmarks detected by our AI. It measures: shoulder alignment (30%), head angle (25%), spine curve (25%), and eye fatigue (20%). 100 = perfect, 0 = very poor.",
    a_ar: "يستخدم Corvus 33 نقطة في الجسم و478 نقطة في الوجه. يقيس: محاذاة الكتفين (30٪)، زاوية الرأس (25٪)، انحناء العمود الفقري (25٪)، وتعب العينين (20٪).",
  },
  {
    category: "billing",     category_ar: "الفواتير",
    q_en: "Can I switch from monthly to annual billing?",
    q_ar: "هل يمكنني التحويل من الفوترة الشهرية إلى السنوية؟",
    a_en: "Yes! Go to Settings → Billing and click 'Switch to Annual'. You'll save 17% (2 months free) and we'll prorate your current month.",
    a_ar: "نعم! اذهب إلى الإعدادات ← الفواتير وانقر 'التحويل للاشتراك السنوي'. ستوفر 17٪ وسنحسب الفرق تلقائياً.",
  },
  {
    category: "billing",     category_ar: "الفواتير",
    q_en: "How do I cancel my subscription?",
    q_ar: "كيف ألغي اشتراكي؟",
    a_en: "Go to Settings → Billing → Cancel Subscription. Your access continues until the end of your current billing period. You can re-subscribe at any time.",
    a_ar: "اذهب إلى الإعدادات ← الفواتير ← إلغاء الاشتراك. يستمر وصولك حتى نهاية دورة الفوترة الحالية.",
  },
  {
    category: "privacy",     category_ar: "الخصوصية",
    q_en: "Does Corvus record or store my video?",
    q_ar: "هل يسجل Corvus أو يحفظ الفيديو الخاص بي؟",
    a_en: "No. Corvus processes your camera feed locally in your browser. We only send anonymized posture scores and measurements to our servers — never video or images.",
    a_ar: "لا. يعالج Corvus صورة الكاميرا محلياً في متصفحك. نرسل فقط نتائج وضعية الجسم المجهولة — وليس الفيديو أو الصور أبداً.",
  },
  {
    category: "enterprise",  category_ar: "المؤسسات",
    q_en: "How do I add my team members?",
    q_ar: "كيف أضيف أعضاء فريقي؟",
    a_en: "HR admins can add team members in two ways: 1) Send individual email invitations from the HR Panel, 2) Bulk import via CSV upload (up to 500 employees at once).",
    a_ar: "يمكن لمسؤولي HR إضافة أعضاء الفريق بطريقتين: 1) إرسال دعوات بريد إلكتروني فردية من لوحة HR، 2) استيراد مجمع عبر CSV (حتى 500 موظف دفعة واحدة).",
  },
  {
    category: "enterprise",  category_ar: "المؤسسات",
    q_en: "Does Corvus support Single Sign-On (SSO)?",
    q_ar: "هل يدعم Corvus تسجيل الدخول الموحد SSO؟",
    a_en: "Yes. Corvus supports Google Workspace, Microsoft Azure AD, Okta, and custom OIDC/SAML providers. Contact your account manager or go to Settings → Security → SSO Configuration.",
    a_ar: "نعم. يدعم Corvus Google Workspace، Microsoft Azure AD، Okta، ومزودي OIDC/SAML المخصصين. تواصل مع مدير حسابك أو اذهب إلى الإعدادات ← الأمان ← إعداد SSO.",
  },
  {
    category: "ai",          category_ar: "الذكاء الاصطناعي",
    q_en: "What is the AI Coach?",
    q_ar: "ما هو مدرب الذكاء الاصطناعي؟",
    a_en: "The AI Coach is a Gemini-powered conversational assistant that analyzes your posture data and provides personalized recommendations, exercise tips, and ergonomic advice. Available on Professional and Elite plans.",
    a_ar: "مدرب الذكاء الاصطناعي هو مساعد محادثة مدعوم بـ Gemini يحلل بيانات وضعيتك ويقدم توصيات شخصية ونصائح تمارين وإرشادات إرغونومية. متاح في الخطط الاحترافية والمتميزة.",
  },
];

export function HelpCenter({ cs, lang, onClose }) {
  const [search, setSearch] = useState("");
  const [open, setOpen]     = useState(null);
  const isAr = lang === "ar";

  const categories = [...new Set(FAQ.map(f => isAr ? f.category_ar : f.category))];
  const [activeCat, setActiveCat] = useState("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return FAQ.filter(f => {
      const matchQ = !q || (isAr ? f.q_ar : f.q_en).toLowerCase().includes(q) ||
                           (isAr ? f.a_ar : f.a_en).toLowerCase().includes(q);
      const matchC = activeCat === "all" || (isAr ? f.category_ar : f.category) === activeCat;
      return matchQ && matchC;
    });
  }, [search, activeCat, isAr]);

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const box = { background:"#0b1120",border:"1px solid rgba(148,163,184,.1)",borderRadius:20,padding:"28px 24px",maxWidth:700,width:"100%",maxHeight:"85vh",overflowY:"auto",direction:isAr?"rtl":"ltr" };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{margin:0,color:"#eef2ff",fontSize:20,fontWeight:700}}>
            {isAr ? "❓ مركز المساعدة" : "❓ Help Center"}
          </h2>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.06)",border:"none",borderRadius:8,color:"#94a3b8",cursor:"pointer",padding:"6px 12px",fontSize:13}}>
            {isAr ? "إغلاق" : "Close"}
          </button>
        </div>

        {/* Search */}
        <input
          value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={isAr ? "ابحث في الأسئلة..." : "Search help articles..."}
          style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid rgba(148,163,184,.15)",background:"rgba(255,255,255,.04)",color:"#eef2ff",fontSize:14,outline:"none",marginBottom:16,boxSizing:"border-box",direction:isAr?"rtl":"ltr"}}
        />

        {/* Category pills */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
          {["all", ...categories].map(cat => (
            <button key={cat} onClick={()=>setActiveCat(cat)} style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${activeCat===cat?"#6366f1":"rgba(148,163,184,.15)"}`,background:activeCat===cat?"rgba(99,102,241,.15)":"transparent",color:activeCat===cat?"#a5b4fc":"#64748b",cursor:"pointer",fontSize:12,fontWeight:500,textTransform:"capitalize"}}>
              {cat === "all" ? (isAr ? "الكل" : "All") : cat}
            </button>
          ))}
        </div>

        {/* FAQ items */}
        {filtered.length === 0 && (
          <p style={{color:"#475569",textAlign:"center",padding:24}}>
            {isAr ? "لا توجد نتائج" : "No results found"} — <a href="mailto:support@corvus.io" style={{color:"#6366f1"}}>Contact support</a>
          </p>
        )}

        {filtered.map((f, i) => (
          <div key={i} style={{borderBottom:"1px solid rgba(148,163,184,.08)",marginBottom:4}}>
            <button
              onClick={()=>setOpen(open===i ? null : i)}
              style={{width:"100%",textAlign:isAr?"right":"left",background:"none",border:"none",padding:"14px 4px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}
            >
              <span style={{fontSize:14,fontWeight:500,color:"#e2e8f0"}}>{isAr ? f.q_ar : f.q_en}</span>
              <span style={{color:"#6366f1",fontSize:16,flexShrink:0}}>{open===i ? "−" : "+"}</span>
            </button>
            {open===i && (
              <p style={{margin:"0 0 14px 4px",fontSize:13,color:"#94a3b8",lineHeight:1.7}}>
                {isAr ? f.a_ar : f.a_en}
              </p>
            )}
          </div>
        ))}

        {/* Contact support CTA */}
        <div style={{marginTop:24,padding:"16px 20px",background:"rgba(99,102,241,.08)",borderRadius:12,border:"1px solid rgba(99,102,241,.15)",textAlign:"center"}}>
          <p style={{margin:"0 0 10px",color:"#94a3b8",fontSize:13}}>
            {isAr ? "لم تجد إجابتك؟" : "Didn't find what you need?"}
          </p>
          <a href="mailto:support@corvus.io"
             style={{padding:"9px 20px",borderRadius:8,background:"#6366f1",color:"#fff",textDecoration:"none",fontSize:13,fontWeight:600}}>
            {isAr ? "تواصل مع الدعم ←" : "Contact Support →"}
          </a>
        </div>
      </div>
    </div>
  );
}
