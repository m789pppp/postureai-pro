/**
 * Corvus — Corporate Wellness Quarterly Report Modal
 * + Corvus for Schools package
 *
 * Exports:
 *   QuarterlyReportModal  — HR generates executive quarterly PDF
 *   SchoolsModal          — School/university package info + enrollment
 */
import React, { useState, useEffect } from "react";
import { generateQuarterlyWellnessReport } from "./lib/pdfReports.js";
import { getCompany } from "./firebase.js";
import { updateUserProfile } from "./firebase.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";

// ── QUARTERLY WELLNESS REPORT MODAL ─────────────────────────────
export function QuarterlyReportModal({ profile, allUsers = [], cs, isAr, onClose, addToast }) {
  useBodyScrollLock();
  const [generating, setGenerating] = useState(false);
  const [aiSummary, setAiSummary]   = useState("");
  const [loadingAI, setLoadingAI]   = useState(false);
  const [quarter, setQuarter]       = useState(() => {
    const d = new Date();
    const q = Math.ceil((d.getMonth() + 1) / 3);
    return `Q${q} ${d.getFullYear()}`;
  });

  const users        = allUsers.filter(u => (u.avg_score || 0) > 0);
  const totalU       = users.length;
  const teamAvg      = totalU > 0 ? Math.round(users.reduce((s, u) => s + (u.avg_score || 0), 0) / totalU) : 0;
  const atRisk       = users.filter(u => (u.avg_score || 0) < 55).length;
  const excellent    = users.filter(u => (u.avg_score || 0) >= 80).length;
  const company      = profile?.company || profile?.name || "Company";

  // Auto-generate AI executive summary
  async function generateAISummary() {
    setLoadingAI(true);
    try {
      const prompt = `You are Dr. Corvus, Chief Ergonomics Officer at Corvus Health Intelligence. 
Write a 3-sentence executive summary for a corporate wellness report.
Data: Company="${company}", Quarter="${quarter}", Employees=${totalU}, TeamAvgScore=${teamAvg}/100, AtRisk=${atRisk}, Excellent=${excellent}.
Be concise, professional, and action-oriented. ${isAr ? "Write in Arabic." : "Write in English."}`;

      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], max_tokens: 200 }),
      });
      const data = await res.json();
      // /api/llm (backend.py llm_proxy()) responds {ok, text, model} —
      // this was reading data.choices[...]/data.content[...], neither of
      // which that endpoint ever returns, so a successful call silently
      // produced an empty summary instead of throwing into the catch below.
      const text = data?.ok && data?.text ? data.text : "";
      if (!text) throw new Error("empty AI summary");
      setAiSummary(text.trim());
    } catch {
      setAiSummary(isAr
        ? `شهدت ${company} أداءً متوسطاً بدرجة ${teamAvg}/100 خلال ${quarter}، مع ${atRisk} موظف في خطر يستلزمون تدخلاً فورياً. يُنصح بجلسات إرجونوميكس جماعية وتفعيل Dr. Corvus AI لدعم الفريق.`
        : `${company} achieved an average posture score of ${teamAvg}/100 in ${quarter}, with ${atRisk} at-risk employees requiring immediate intervention. Group ergonomics training and AI coaching activation are recommended.`
      );
    }
    setLoadingAI(false);
  }

  useEffect(() => { if (totalU > 0) generateAISummary(); }, [totalU]);

  async function handleGenerate() {
    if (!totalU) {
      addToast?.(isAr ? "مفيش بيانات موظفين بعد" : "No employee data yet", "warn");
      return;
    }
    setGenerating(true);
    try {
      // The financial projection is computed only from figures the
      // organisation entered on its own company document — average salary,
      // the extra sick days it attributes to an at-risk employee, and the
      // productivity loss it assigns to one. Fetch that document so an org
      // that HAS set them gets its projection; one that has not gets a
      // report that says so instead of one built from our constants.
      let orgDoc = null;
      try { if (profile?.company_id) orgDoc = await getCompany(profile.company_id); } catch {}
      await generateQuarterlyWellnessReport({
        users, company, quarter,
        lang: isAr ? "ar" : "en",
        profile, org: orgDoc, aiExecutiveSummary: aiSummary,
      });
      addToast?.(isAr ? "✅ تم إنشاء التقرير بنجاح" : "✅ Report generated successfully", "success");
      // Log generation for billing
      await updateUserProfile(profile.uid, {
        last_quarterly_report_at: new Date().toISOString(),
        quarterly_reports_count: (profile?.quarterly_reports_count || 0) + 1,
      }).catch(() => {});
    } catch (e) {
      addToast?.(isAr ? "خطأ في إنشاء التقرير" : "Report generation failed", "error");
    }
    setGenerating(false);
  }

  const scoreColor = teamAvg >= 80 ? "#10b981" : teamAvg >= 60 ? "#f59e0b" : "#ef4444";

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,.50)",zIndex:9999,
    display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const modal = { background:cs.card,border:`1px solid ${cs.border}`,borderRadius:20,
    padding:28,maxWidth:540,width:"100%",maxHeight:"90dvh",overflowY:"auto",
    fontFamily:"'IBM Plex Sans Arabic',system-ui,sans-serif" };

  return (
    <div style={overlay} onClick={e=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div style={modal}>

        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:22 }}>
          <div style={{ width:46,height:46,borderRadius:13,
            background:"linear-gradient(135deg,rgba(212,175,55,.2),rgba(212,175,55,.08))",
            border:"1px solid rgba(212,175,55,.3)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>📈</div>
          <div>
            <div style={{ fontSize:16,fontWeight:800,color:cs.text }}>
              {isAr ? "التقرير الربع سنوي للصحة المؤسسية" : "Corporate Wellness Quarterly Report"}
            </div>
            <div style={{ fontSize:11,color:cs.muted,marginTop:2 }}>
              {isAr ? "PDF تنفيذي شامل للـ C-suite والـ HR" : "Executive PDF for C-suite & HR leadership"}
            </div>
          </div>
          <button onClick={onClose} style={{ marginInlineStart:"auto",background:"none",
            border:"none",color:cs.muted,fontSize:20,cursor:"pointer",padding:4 }}>✕</button>
        </div>

        {/* Quarter selector */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11,color:cs.muted,display:"block",marginBottom:6 }}>
            {isAr ? "الربع الزمني" : "Quarter"}
          </label>
          <input value={quarter} onChange={e=>setQuarter(e.target.value)}
            placeholder="Q3 2026"
            style={{ width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,.04)",
              border:`1px solid ${cs.border}`,borderRadius:9,padding:"9px 13px",
              fontSize:13,color:cs.text,outline:"none" }} />
        </div>

        {/* KPI preview */}
        {totalU > 0 ? (
          <>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16 }}>
              {[
                [String(totalU),    isAr?"موظف":"Employees",   "#60a5fa"],
                [String(teamAvg),   isAr?"متوسط":"Avg Score",   scoreColor],
                [String(atRisk),    isAr?"في خطر":"At Risk",    atRisk>0?"#ef4444":"#10b981"],
                [String(excellent), isAr?"ممتاز":"Excellent",   "#10b981"],
              ].map(([v,l,c])=>(
                <div key={l} style={{ background:"rgba(255,255,255,.04)",borderRadius:10,padding:"12px 8px",textAlign:"center" }}>
                  <div style={{ fontSize:20,fontWeight:900,color:c,lineHeight:1 }}>{v}</div>
                  <div style={{ fontSize:9.5,color:cs.muted,marginTop:4 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* AI Summary preview */}
            <div style={{ background:"rgba(26,86,219,.08)",border:"1px solid rgba(26,86,219,.2)",
              borderRadius:11,padding:"14px 16px",marginBottom:20 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"#60a5fa",marginBottom:8 }}>
                🧠 {isAr?"الملخص التنفيذي (AI)":"AI Executive Summary"}
              </div>
              {loadingAI ? (
                <div style={{ fontSize:12,color:cs.muted }}>
                  {isAr?"جاري توليد الملخص...":"Generating summary..."}
                </div>
              ) : (
                <textarea value={aiSummary} onChange={e=>setAiSummary(e.target.value)}
                  rows={4} style={{ width:"100%",boxSizing:"border-box",background:"transparent",
                    border:"none",resize:"vertical",fontSize:12,color:cs.muted,
                    outline:"none",fontFamily:"inherit",lineHeight:1.6 }} />
              )}
            </div>

            {/* What's included */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11,fontWeight:700,color:cs.text,marginBottom:10 }}>
                {isAr?"محتوى التقرير:":"Report includes:"}
              </div>
              {[
                [isAr?"ملخص تنفيذي بالذكاء الاصطناعي":"AI executive summary","🧠"],
                [isAr?"KPIs مع مقاييس الأداء":"KPIs with performance metrics","📊"],
                [isAr?"تحليل المخاطر والتوزيع":"Risk analysis & score distribution","⚠️"],
                [isAr?"التأثير المالي المتوقع وROI":"Projected financial impact & ROI","💰"],
                [isAr?"تفاصيل الأقسام":"Department breakdown","🏢"],
                [isAr?"قائمة الموظفين الأكثر عرضة للخطر":"Top at-risk employees","🔴"],
                [isAr?"توصيات قابلة للتنفيذ":"Actionable recommendations","✅"],
              ].map(([text,icon])=>(
                <div key={text} style={{ display:"flex",alignItems:"center",gap:9,
                  padding:"6px 0",borderBottom:`1px solid ${cs.border}` }}>
                  <span style={{ fontSize:14 }}>{icon}</span>
                  <span style={{ fontSize:12,color:cs.muted }}>{text}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign:"center",padding:"30px 20px",color:cs.muted,fontSize:13 }}>
            {isAr
              ? "لازم يكون عندك موظفين بجلسات مسجلة عشان تولد التقرير"
              : "You need employees with recorded sessions to generate the report"}
          </div>
        )}

        {/* Generate button */}
        <button onClick={handleGenerate} disabled={generating || !totalU}
          style={{ width:"100%",padding:"14px",
            background:totalU?"linear-gradient(135deg,#d4af37,#b8960c)":"rgba(255,255,255,.05)",
            border:"none",borderRadius:12,color:totalU?"#1a1200":"#8896ac",
            fontSize:14,fontWeight:800,cursor:(!totalU||generating)?"not-allowed":"pointer",
            opacity:generating?.7:1 }}>
          {generating
            ? (isAr?"جاري الإنشاء...":"Generating...")
            : (isAr?"⬇️ تحميل التقرير PDF":"⬇️ Download Quarterly Report PDF")}
        </button>

        <div style={{ fontSize:10,color:cs.muted,textAlign:"center",marginTop:10 }}>
          {isAr
            ? "PDF سري بـ watermark · لاستخدام الـ C-suite والـ HR فقط"
            : "Confidential watermarked PDF · For C-suite & HR use only"}
        </div>
      </div>
    </div>
  );
}

// ── CORVUS FOR SCHOOLS MODAL ─────────────────────────────────────
export function SchoolsModal({ cs, isAr, onClose, addToast }) {
  useBodyScrollLock();
  const [step, setStep]       = useState("info"); // info | enroll | done
  const [form, setForm]       = useState({ name:"", email:"", institution:"", students:"", role:"" });
  const [sending, setSending] = useState(false);

  async function handleEnroll() {
    if (!form.name || !form.email || !form.institution) {
      addToast?.(isAr ? "اكمل البيانات المطلوبة" : "Fill required fields", "warn");
      return;
    }
    setSending(true);
    try {
      await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "sales@corvus.io",
          subject: `[Corvus for Schools] ${form.institution}`,
          html: `<h2>New School Enrollment Request</h2>
<p><b>Name:</b> ${form.name}</p>
<p><b>Email:</b> ${form.email}</p>
<p><b>Institution:</b> ${form.institution}</p>
<p><b>Students:</b> ${form.students}</p>
<p><b>Role:</b> ${form.role}</p>`,
        }),
      });
      setStep("done");
      addToast?.(isAr ? "✅ تم إرسال طلبك! سنتواصل معك خلال 24 ساعة" : "✅ Request sent! We'll contact you within 24h", "success");
    } catch {
      addToast?.(isAr ? "خطأ في الإرسال" : "Send failed", "error");
    }
    setSending(false);
  }

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,.50)",zIndex:9999,
    display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const modal = { background:cs.card,border:`1px solid ${cs.border}`,borderRadius:20,
    padding:28,maxWidth:520,width:"100%",maxHeight:"90dvh",overflowY:"auto",
    fontFamily:"'IBM Plex Sans Arabic',system-ui,sans-serif" };
  const inp = { width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,.04)",
    border:`1px solid ${cs.border}`,borderRadius:9,padding:"10px 13px",
    fontSize:13,color:cs.text,outline:"none",marginBottom:10 };

  return (
    <div style={overlay} onClick={e=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div style={modal}>

        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:22 }}>
          <div style={{ width:46,height:46,borderRadius:13,
            background:"linear-gradient(135deg,rgba(99,102,241,.2),rgba(99,102,241,.05))",
            border:"1px solid rgba(99,102,241,.3)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>🎓</div>
          <div>
            <div style={{ fontSize:16,fontWeight:800,color:cs.text }}>
              {isAr ? "Corvus للمدارس والجامعات" : "Corvus for Schools"}
            </div>
            <div style={{ fontSize:11,color:cs.muted,marginTop:2 }}>
              {isAr ? "سعر خاص بالجملة للمؤسسات التعليمية" : "Special bulk pricing for educational institutions"}
            </div>
          </div>
          <button onClick={onClose} style={{ marginInlineStart:"auto",background:"none",
            border:"none",color:cs.muted,fontSize:20,cursor:"pointer",padding:4 }}>✕</button>
        </div>

        {step === "done" ? (
          <div style={{ textAlign:"center",padding:"30px 20px" }}>
            <div style={{ fontSize:48,marginBottom:16 }}>🎉</div>
            <div style={{ fontSize:18,fontWeight:800,color:"#10b981",marginBottom:8 }}>
              {isAr ? "تم استلام طلبك!" : "Request received!"}
            </div>
            <div style={{ fontSize:13,color:cs.muted,lineHeight:1.6 }}>
              {isAr
                ? "فريق Corvus هيتواصل معاك خلال 24 ساعة لترتيب عرض مخصص لمؤسستك."
                : "The Corvus team will contact you within 24 hours to arrange a custom demo for your institution."}
            </div>
          </div>
        ) : step === "info" ? (
          <>
            {/* Pricing card */}
            <div style={{ background:"linear-gradient(135deg,rgba(99,102,241,.1),rgba(99,102,241,.04))",
              border:"1px solid rgba(99,102,241,.25)",borderRadius:14,padding:"20px",marginBottom:20,textAlign:"center" }}>
              <div style={{ fontSize:36,fontWeight:900,color:"#a5b4fc",lineHeight:1 }}>49</div>
              <div style={{ fontSize:14,color:"#8896ac",marginBottom:12 }}>
                {isAr ? "جنيه / طالب / شهر" : "EGP / student / month"}
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,textAlign:isAr?"right":"left" }}>
                {[
                  [isAr?"500 طالب":"500 students",      isAr?"24,500 جنيه":"24,500 EGP/mo"],
                  [isAr?"1,000 طالب":"1,000 students",  isAr?"49,000 جنيه":"49,000 EGP/mo"],
                  [isAr?"5,000 طالب":"5,000 students",  isAr?"245,000 جنيه":"245,000 EGP/mo"],
                  [isAr?"سعر مخصص لأكثر":"Custom 10k+", isAr?"تفاوض":"Negotiable"],
                ].map(([size,price])=>(
                  <div key={size} style={{ background:"rgba(255,255,255,.04)",borderRadius:8,padding:"8px 10px" }}>
                    <div style={{ fontSize:11,fontWeight:700,color:cs.text }}>{size}</div>
                    <div style={{ fontSize:11,color:"#a5b4fc",marginTop:2 }}>{price}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div style={{ marginBottom:20 }}>
              {[
                [isAr?"كل مميزات Pro لكل طالب":"Full Pro features for every student","⭐"],
                [isAr?"لوحة إدارة للمشرف الأكاديمي":"Academic admin dashboard","🏫"],
                [isAr?"تقارير صحية دورية للإدارة":"Periodic wellness reports for management","📊"],
                [isAr?"Dr. Corvus AI Coach للطلاب":"Dr. Corvus AI Coach for students","🤖"],
                [isAr?"شهادات إرجونوميكس للخريجين":"Ergonomics certificates for graduates","🏅"],
                [isAr?"دعم تقني مخصص على واتساب":"Dedicated WhatsApp support","📱"],
              ].map(([text,icon])=>(
                <div key={text} style={{ display:"flex",alignItems:"center",gap:10,
                  padding:"8px 0",borderBottom:`1px solid ${cs.border}` }}>
                  <span style={{ fontSize:16 }}>{icon}</span>
                  <span style={{ fontSize:12,color:cs.muted }}>{text}</span>
                </div>
              ))}
            </div>

            <button onClick={()=>setStep("enroll")}
              style={{ width:"100%",padding:"13px",
                background:"linear-gradient(135deg,#6366f1,#4f46e5)",
                border:"none",borderRadius:12,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer" }}>
              {isAr ? "🎓 احجز عرض لمؤسستك" : "🎓 Book a Demo for Your Institution"}
            </button>
          </>
        ) : (
          /* Enroll form */
          <>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
              placeholder={isAr?"اسمك الكامل *":"Your full name *"} style={inp} />
            <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}
              placeholder={isAr?"البريد الإلكتروني *":"Email address *"} style={inp} type="email" dir="ltr" />
            <input value={form.institution} onChange={e=>setForm(f=>({...f,institution:e.target.value}))}
              placeholder={isAr?"اسم المؤسسة التعليمية *":"Institution name *"} style={inp} />
            <input value={form.students} onChange={e=>setForm(f=>({...f,students:e.target.value}))}
              placeholder={isAr?"عدد الطلاب المتوقع":"Expected number of students"} style={inp} type="number" />
            <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
              style={{ ...inp,cursor:"pointer" }}>
              <option value="">{isAr?"صفتك في المؤسسة":"Your role"}</option>
              <option value="dean">{isAr?"عميد":"Dean"}</option>
              <option value="admin">{isAr?"مدير إداري":"Academic Admin"}</option>
              <option value="it">{isAr?"مدير IT":"IT Manager"}</option>
              <option value="other">{isAr?"أخرى":"Other"}</option>
            </select>

            <div style={{ display:"flex",gap:10 }}>
              <button onClick={()=>setStep("info")}
                style={{ flex:1,padding:"11px",background:"rgba(255,255,255,.05)",
                  border:`1px solid ${cs.border}`,borderRadius:10,color:cs.muted,fontSize:13,cursor:"pointer" }}>
                {isAr?"رجوع":"Back"}
              </button>
              <button onClick={handleEnroll} disabled={sending}
                style={{ flex:2,padding:"11px",background:"linear-gradient(135deg,#6366f1,#4f46e5)",
                  border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,
                  cursor:sending?"not-allowed":"pointer",opacity:sending?.7:1 }}>
                {sending?"...":(isAr?"إرسال الطلب →":"Send Request →")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
