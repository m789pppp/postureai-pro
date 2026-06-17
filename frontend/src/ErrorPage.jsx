import React from "react";
/**
 * Corvus — ErrorPage + NotFound + OfflinePage
 */
export function NotFound({ onHome, lang="en" }) {
  const isAr = lang==="ar";
  return (
    <div dir={isAr?"rtl":"ltr"} style={{minHeight:"100vh",background:"#030b14",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Inter',system-ui,sans-serif",color:"#f0f6ff",textAlign:"center"}}>
      <div style={{maxWidth:400}}>
        <div style={{fontSize:64,marginBottom:16,filter:"grayscale(20%)"}}>🧘</div>
        <div style={{fontSize:48,fontWeight:900,color:"rgba(148,163,184,.2)",marginBottom:8}}>404</div>
        <div style={{fontSize:20,fontWeight:800,marginBottom:8}}>{isAr?"الصفحة غير موجودة":"Page Not Found"}</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:24,lineHeight:1.6}}>
          {isAr?"الصفحة التي تبحث عنها غير موجودة أو تم نقلها.":"The page you're looking for doesn't exist or has been moved."}
        </div>
        <button onClick={onHome} style={{background:"#1a56db",border:"none",borderRadius:12,padding:"12px 28px",fontSize:13,fontWeight:700,color:"#fff",cursor:"pointer",boxShadow:"0 4px 20px rgba(26,86,219,.35)"}}>
          {isAr?"← الرئيسية":"← Go Home"}
        </button>
      </div>
    </div>
  );
}

export function BackendOffline({ onRetry, lang="en" }) {
  const isAr = lang==="ar";
  return (
    <div dir={isAr?"rtl":"ltr"} style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",borderRadius:12,padding:"12px 20px",display:"flex",alignItems:"center",gap:12,backdropFilter:"blur(8px)",maxWidth:380,boxShadow:"0 4px 20px rgba(0,0,0,.3)"}}>
      <span style={{fontSize:18,flexShrink:0}}>⚡</span>
      <div style={{flex:1}}>
        <div style={{fontSize:12,fontWeight:700,color:"#fca5a5"}}>{isAr?"الخادم غير متاح":"Backend Offline"}</div>
        <div style={{fontSize:10.5,color:"#94a3b8"}}>{isAr?"التحليل يعمل محلياً — الإحصائيات لن تُحفظ":"Analysis works locally — stats won't sync"}</div>
      </div>
      {onRetry&&<button onClick={onRetry} style={{background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.3)",borderRadius:8,padding:"5px 10px",fontSize:10,color:"#fca5a5",cursor:"pointer",fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>
        {isAr?"إعادة المحاولة":"Retry"}
      </button>}
    </div>
  );
}
