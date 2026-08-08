/**
 * Corvus — Certificate System
 *
 * Exports:
 *   CertVerifyPage    — public /verify/:id page (no auth needed)
 *   CertBadgeModal    — buy + download badge modal (in-app)
 *   generateCertPDF   — jsPDF badge generator
 */
import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { installArabicText } from "./lib/arabicShaper.js";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";

// ── QR Code (lightweight, no dependency) ─────────────────────────
// Uses Google Charts API for QR — no npm package needed
function qrDataURL(text, size=200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=ffffff&color=0a1628&margin=4`;
}

// ── PDF Badge Generator ──────────────────────────────────────────
export async function generateCertPDF({ cert_id, name, company_name, type, issued_at, lang="en" }) {
  const isAr = lang === "ar";
  const doc = new jsPDF({ orientation:"landscape", unit:"mm", format:[210,148] }); // A5 landscape
  installArabicText(doc);

  const W=210, H=148;

  // ── Background: deep navy ──
  doc.setFillColor(10,15,30);
  doc.rect(0,0,W,H,"F");

  // ── Gold border frame ──
  doc.setDrawColor(212,175,55); doc.setLineWidth(0.8);
  doc.rect(6,6,W-12,H-12,"S");
  doc.setLineWidth(0.3);
  doc.rect(8,8,W-16,H-16,"S");

  // ── Corner ornaments ──
  const corners = [[10,10],[W-10,10],[10,H-10],[W-10,H-10]];
  corners.forEach(([x,y])=>{
    doc.setFillColor(212,175,55);
    doc.circle(x,y,1.5,"F");
  });

  // ── Corvus logo text ──
  doc.setFont("helvetica","bold");
  doc.setFontSize(9); doc.setTextColor(212,175,55);
  doc.text("🦅 CORVUS HEALTH INTELLIGENCE", W/2, 18, {align:"center"});

  // ── Title ──
  doc.setFontSize(7); doc.setTextColor(140,150,170);
  doc.text(
    isAr ? "شهادة إرجونوميكس معتمدة" : "CERTIFIED ERGONOMIST BADGE",
    W/2, 24, {align:"center"}
  );

  // ── Decorative line ──
  doc.setDrawColor(212,175,55); doc.setLineWidth(0.4);
  doc.line(30, 27, W-30, 27);

  // ── Cert type label ──
  doc.setFontSize(8); doc.setTextColor(99,102,241);
  doc.text(
    type==="company"
      ? (isAr ? "شهادة مؤسسية" : "CORPORATE CERTIFICATE")
      : (isAr ? "شهادة فردية" : "INDIVIDUAL CERTIFICATE"),
    W/2, 33, {align:"center"}
  );

  // ── "This certifies that" ──
  doc.setFontSize(7.5); doc.setTextColor(140,150,170);
  doc.text(
    isAr ? "تُشهد Corvus Health Intelligence بأن" : "This certifies that",
    W/2, 42, {align:"center"}
  );

  // ── Name (big) ──
  doc.setFont("helvetica","bold");
  doc.setFontSize(22); doc.setTextColor(240,246,255);
  doc.text(name, W/2, 56, {align:"center"});

  // ── Company name if corporate ──
  if (company_name) {
    doc.setFont("helvetica","normal");
    doc.setFontSize(10); doc.setTextColor(212,175,55);
    doc.text(company_name, W/2, 64, {align:"center"});
  }

  // ── Description ──
  doc.setFont("helvetica","normal");
  doc.setFontSize(7); doc.setTextColor(140,150,170);
  const desc = isAr
    ? "قد استوفى معايير الإرجونوميكس وبيئة العمل الصحية وفقاً لمعيار ISO 9241-110"
    : "has met the ergonomics & healthy workplace standards per ISO 9241-110";
  doc.text(desc, W/2, company_name?72:68, {align:"center", maxWidth:160});

  // ── Gold divider ──
  doc.setDrawColor(212,175,55); doc.setLineWidth(0.3);
  doc.line(50, 80, W-50, 80);

  // ── Cert ID + Date ──
  const issueDate = new Date(issued_at).toLocaleDateString(isAr?"ar-EG":"en-US",{year:"numeric",month:"long",day:"numeric"});
  doc.setFontSize(7); doc.setTextColor(140,150,170);
  doc.text(`Certificate ID: ${cert_id}`, W/2-30, 88, {align:"center"});
  doc.text(isAr ? `تاريخ الإصدار: ${issueDate}` : `Issued: ${issueDate}`, W/2+30, 88, {align:"center"});

  // ── QR Code (fetch and embed) ──
  const verifyUrl = `${window.location.origin}/verify/${cert_id}`;
  try {
    const qrUrl = qrDataURL(verifyUrl, 120);
    const qrImg = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        c.getContext("2d").drawImage(img,0,0);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = qrUrl;
    });
    // QR box background
    doc.setFillColor(255,255,255);
    doc.roundedRect(W-42, H-48, 34, 34, 2, 2, "F");
    doc.addImage(qrImg, "PNG", W-41, H-47, 32, 32);
  } catch {}

  // ── Verify text under QR ──
  doc.setFontSize(5.5); doc.setTextColor(140,150,170);
  doc.text(isAr?"امسح للتحقق":"Scan to verify", W-25, H-12, {align:"center"});

  // ── Issuer stamp (left bottom) ──
  doc.setFont("helvetica","bold");
  doc.setFontSize(6.5); doc.setTextColor(212,175,55);
  doc.text("Dr. Corvus AI", 25, H-22, {align:"center"});
  doc.setFont("helvetica","normal");
  doc.setFontSize(5.5); doc.setTextColor(140,150,170);
  doc.text(isAr?"رئيس قسم تقييم الإرجونوميكس":"Chief Ergonomics Officer", 25, H-17, {align:"center"});
  doc.setDrawColor(140,150,170); doc.setLineWidth(0.2);
  doc.line(12, H-14, 38, H-14);

  // ── Watermark diagonal ──
  doc.setFont("helvetica","bold");
  doc.setFontSize(48); doc.setTextColor(255,255,255);
  doc.saveGraphicsState();
  // jsPDF doesn't support rotation natively for text, use transform
  doc.text("CORVUS", W/2, H/2+10, {align:"center", renderingMode:"invisible"});
  doc.restoreGraphicsState();

  doc.save(`Corvus-Certificate-${cert_id}.pdf`);
}

// ── PUBLIC VERIFY PAGE ───────────────────────────────────────────
export function CertVerifyPage({ certId: propCertId }) {
  const certId = propCertId || window.location.pathname.split("/verify/")[1];
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!certId) { setError("No certificate ID"); setLoading(false); return; }
    fetch(`/api/cert/verify?id=${encodeURIComponent(certId)}`)
      .then(r=>r.json())
      .then(d=>{ setData(d); setLoading(false); })
      .catch(()=>{ setError("Could not verify certificate"); setLoading(false); });
  }, [certId]);

  const cs = { bg:"#0a0f1e", card:"#111827", border:"rgba(255,255,255,.08)", text:"#f0f6ff", muted:"#8896ac" };

  if (loading) return (
    <div style={{minHeight:"100vh",background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:cs.muted,fontSize:14}}>Verifying certificate...</div>
    </div>
  );

  const valid = data?.valid;
  const color = valid ? "#10b981" : "#ef4444";
  const icon  = valid ? "✅" : "❌";

  return (
    <div style={{minHeight:"100vh",background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"system-ui,sans-serif"}}>
      <div style={{maxWidth:480,width:"100%",background:cs.card,border:`1px solid ${valid?"rgba(16,185,129,.3)":"rgba(239,68,68,.3)"}`,borderRadius:20,padding:36,textAlign:"center"}}>

        {/* Corvus header */}
        <div style={{fontSize:13,fontWeight:700,color:"#8896ac",letterSpacing:2,marginBottom:24}}>
          🦅 CORVUS HEALTH INTELLIGENCE
        </div>

        {/* Valid/Invalid badge */}
        <div style={{width:80,height:80,borderRadius:"50%",background:`${color}15`,border:`3px solid ${color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px"}}>
          {icon}
        </div>

        <div style={{fontSize:22,fontWeight:800,color:valid?"#10b981":"#ef4444",marginBottom:8}}>
          {valid ? "Valid Certificate" : "Invalid Certificate"}
        </div>

        {valid && (
          <>
            <div style={{fontSize:26,fontWeight:900,color:cs.text,margin:"16px 0 4px"}}>{data.name}</div>
            {data.company_name && <div style={{fontSize:14,color:"#f59e0b",marginBottom:4}}>{data.company_name}</div>}
            <div style={{fontSize:12,color:cs.muted,marginBottom:20,lineHeight:1.6}}>
              {data.type==="company" ? "Corporate Ergonomics Certificate" : "Individual Ergonomics Certificate"}
            </div>

            <div style={{background:"rgba(255,255,255,.04)",borderRadius:12,padding:"16px 20px",textAlign:"left",marginBottom:20}}>
              {[
                ["Certificate ID", data.cert_id],
                ["Standard", "ISO 9241-110"],
                ["Issuer", data.issuer],
                ["Issue Date", new Date(data.issued_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})],
                data.expires_at && ["Valid Until", new Date(data.expires_at).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})],
              ].filter(Boolean).map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                  <span style={{fontSize:11,color:cs.muted}}>{k}</span>
                  <span style={{fontSize:11,fontWeight:600,color:cs.text}}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{fontSize:11,color:"#10b981",background:"rgba(16,185,129,.08)",borderRadius:8,padding:"8px 14px"}}>
              ✓ This certificate is authentic and was issued by Corvus Health Intelligence
            </div>
          </>
        )}

        {!valid && (
          <div style={{fontSize:13,color:cs.muted,marginTop:12,lineHeight:1.6}}>
            {data?.reason==="expired"
              ? `This certificate for "${data?.name}" has expired.`
              : "This certificate ID does not exist or has been revoked."}
          </div>
        )}

        <div style={{marginTop:24,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.06)"}}>
          <a href="/" style={{fontSize:11,color:"#1a56db",textDecoration:"none"}}>← Back to Corvus PostureAI</a>
        </div>
      </div>
    </div>
  );
}

// ── IN-APP CERT BADGE MODAL ──────────────────────────────────────
export function CertBadgeModal({ profile, cs, isAr, onClose, addToast }) {
  useBodyScrollLock();
  const [step, setStep]       = useState("info"); // info | paying | done
  const [certData, setCertData] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const hasCert = !!profile?.has_cert;
  const type    = "individual"; // only individual for now; company via sales
  const price   = isAr ? "١٥٠ جنيه" : "150 EGP";

  // If already has cert, fetch it
  useEffect(() => {
    if (hasCert && profile.cert_id) {
      fetch(`/api/cert/verify?id=${profile.cert_id}`)
        .then(r=>r.json())
        .then(d=>{ if(d.valid) setCertData(d); })
        .catch(()=>{});
    }
  }, [hasCert]);

  async function handleBuy() {
    setStep("paying");
    try {
      // Create Kashier payment
      const order = await fetch("/api/kashier/create-order", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          uid: profile.uid,
          amount: 150,
          currency: "EGP",
          description: isAr ? "شهادة إرجونوميكس Corvus" : "Corvus Ergonomist Certificate",
          metadata: { cert_type:"individual", cert_name: profile.name||profile.email },
          success_url: `${window.location.origin}/?cert_issued=1`,
          failure_url: `${window.location.origin}/?cert_failed=1`,
        }),
      }).then(r=>r.json());

      if (order.payment_url) {
        window.location.href = order.payment_url;
      } else {
        throw new Error("No payment URL");
      }
    } catch(e) {
      addToast?.(isAr?"حدث خطأ في الدفع":"Payment error", "error");
      setStep("info");
    }
  }

  async function handleDownload() {
    if (!profile?.cert_id) return;
    setDownloading(true);
    try {
      await generateCertPDF({
        cert_id: profile.cert_id,
        name: profile.name || profile.email,
        company_name: null,
        type: "individual",
        issued_at: profile.cert_issued_at || new Date().toISOString(),
        lang: isAr ? "ar" : "en",
      });
      addToast?.(isAr?"✅ تم تحميل الشهادة":"✅ Certificate downloaded","success");
    } catch(e) {
      addToast?.(isAr?"خطأ في التحميل":"Download failed","error");
    }
    setDownloading(false);
  }

  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:9999,
    display:"flex",alignItems:"center",justifyContent:"center",padding:16 };
  const modal = { background:cs.card,border:`1px solid ${cs.border}`,borderRadius:20,
    padding:32,maxWidth:460,width:"100%",fontFamily:"system-ui,sans-serif" };

  return (
    <div style={overlay} onClick={e=>{if(e.target===e.currentTarget)onClose?.()}}>
      <div style={modal}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <div style={{width:48,height:48,borderRadius:14,background:"linear-gradient(135deg,#f59e0b,#d97706)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🏅</div>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:cs.text}}>
              {isAr?"شهادة إرجونوميكس Corvus":"Corvus Ergonomist Certificate"}
            </div>
            <div style={{fontSize:11,color:cs.muted,marginTop:2}}>
              {isAr?"أثبت بيئة عملك الصحية":"Prove your healthy workplace"}
            </div>
          </div>
          <button onClick={onClose} style={{marginInlineStart:"auto",background:"none",border:"none",
            color:cs.muted,fontSize:20,cursor:"pointer",padding:4}}>✕</button>
        </div>

        {/* Already has cert */}
        {hasCert ? (
          <div>
            <div style={{background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",
              borderRadius:12,padding:16,marginBottom:20,textAlign:"center"}}>
              <div style={{fontSize:28,marginBottom:8}}>✅</div>
              <div style={{fontSize:14,fontWeight:700,color:"#10b981",marginBottom:4}}>
                {isAr?"عندك شهادة معتمدة!":"You have a valid certificate!"}
              </div>
              <div style={{fontSize:11,color:cs.muted}}>
                {isAr?`رقم الشهادة: ${profile.cert_id}`:`Certificate ID: ${profile.cert_id}`}
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={handleDownload} disabled={downloading}
                style={{padding:"12px",background:"linear-gradient(135deg,#f59e0b,#d97706)",
                  border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,
                  cursor:downloading?"not-allowed":"pointer",opacity:downloading?.7:1}}>
                {downloading?"...":(isAr?"⬇️ تحميل شهادة PDF":"⬇️ Download PDF Badge")}
              </button>

              <button onClick={()=>{
                  const url=`${window.location.origin}/verify/${profile.cert_id}`;
                  navigator.clipboard?.writeText(url);
                  addToast?.(isAr?"✅ تم نسخ رابط التحقق":"✅ Verify link copied","success");
                }}
                style={{padding:"12px",background:"rgba(255,255,255,.05)",
                  border:`1px solid ${cs.border}`,borderRadius:10,color:cs.text,
                  fontSize:13,fontWeight:600,cursor:"pointer"}}>
                {isAr?"🔗 نسخ رابط التحقق للـ LinkedIn":"🔗 Copy LinkedIn verify link"}
              </button>
            </div>
          </div>
        ) : (
          /* Buy flow */
          <div>
            {/* Benefits */}
            <div style={{marginBottom:20}}>
              {[
                [isAr?"PDF رسمي بـ QR code قابل للتحقق":"Official PDF badge with verifiable QR code","📄"],
                [isAr?"رابط تحقق لـ LinkedIn وموقعك":"Verify link for LinkedIn & your website","🔗"],
                [isAr?"معتمد بمعيار ISO 9241-110":"Certified per ISO 9241-110","🏆"],
                [isAr?"ساري مدى الحياة للأفراد":"Lifetime validity for individuals","♾️"],
              ].map(([text,icon])=>(
                <div key={text} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",
                  borderBottom:`1px solid ${cs.border}`}}>
                  <span style={{fontSize:16}}>{icon}</span>
                  <span style={{fontSize:12,color:cs.muted}}>{text}</span>
                </div>
              ))}
            </div>

            {/* Price */}
            <div style={{textAlign:"center",marginBottom:20,padding:"16px",
              background:"rgba(245,158,11,.06)",borderRadius:12,border:"1px solid rgba(245,158,11,.2)"}}>
              <div style={{fontSize:32,fontWeight:900,color:"#f59e0b"}}>{price}</div>
              <div style={{fontSize:11,color:cs.muted,marginTop:4}}>
                {isAr?"دفعة واحدة — مدى الحياة":"One-time payment — lifetime validity"}
              </div>
            </div>

            <button onClick={handleBuy} disabled={step==="paying"}
              style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#f59e0b,#d97706)",
                border:"none",borderRadius:12,color:"#fff",fontSize:14,fontWeight:800,
                cursor:step==="paying"?"not-allowed":"pointer",opacity:step==="paying"?.7:1}}>
              {step==="paying"?"...":(isAr?"🏅 احصل على شهادتك — ١٥٠ جنيه":"🏅 Get Your Certificate — 150 EGP")}
            </button>

            <div style={{fontSize:10,color:cs.muted,textAlign:"center",marginTop:10}}>
              {isAr?"دفع آمن عبر Kashier · الشهادة فورية بعد الدفع":"Secure payment via Kashier · Instant certificate after payment"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
