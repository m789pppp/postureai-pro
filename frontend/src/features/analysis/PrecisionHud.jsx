/**
 * PrecisionHud — compact overlay on the camera view showing the live
 * precision layer: confidence, iris distance, head flexion vs. the user's
 * calibrated neutral, and time spent in each risk zone.
 */
const fmt = sec => {
  const s = Math.floor(sec || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function PrecisionHud({ data, isAr = false, calibrated = false }) {
  if (!data) return null;
  const T = isAr
    ? { conf: "الثقة", dist: "المسافة", head: "انحناء الراس", time: "وقت الخطر", flex: "راس منحنية", close: "قريب جدًا",
        cal: "معايرة", est: "تقديري", models: ["", "موديل واحد", "موديلين", "٣ موديلات"][data.models || 1], neutral: "عن وضعك الطبيعي",
        agree: "اتفاق الموديلات", loading: "تحميل RTMW", fwd: "الراس لقدام", load: "حِمل الرقبة (تقدير)", camMoved: "الكاميرا اتحركت — أعد المعايرة" }
    : { conf: "Confidence", dist: "Distance", head: "Head flexion", time: "Time at risk", flex: "Head down", close: "Too close",
        cal: "calibrated", est: "estimated", models: `${data.models || 1} model${(data.models || 1) > 1 ? "s" : ""}`, neutral: "vs your neutral",
        agree: "Model agreement", loading: "Loading RTMW", fwd: "Forward head", load: "Neck load (est.)", camMoved: "Camera moved — recalibrate" };
  const c = data.confidence;
  const confCol = c >= 80 ? "#10b981" : c >= 60 ? "#38bdf8" : "#f59e0b";
  const hf = data.headFlexion;
  const hfCol = hf == null ? "#b4c2d6" : hf > 15 ? "#ef4444" : hf > 8 ? "#f59e0b" : "#10b981";
  const ex = data.exposure || {};
  const row = { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, lineHeight: 1.7 };
  const R = 15, L = 2 * Math.PI * R;
  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{
      position: "absolute", top: 10, insetInlineEnd: 10, zIndex: 3, width: 190, padding: "10px 12px",
      borderRadius: 14, background: "rgba(2,8,16,.84)", backdropFilter: "blur(8px)",
      border: "1px solid rgba(148,163,184,.18)", color: "#e2e8f0", pointerEvents: "none",
      fontVariantNumeric: "tabular-nums",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
          <circle cx="19" cy="19" r={R} fill="none" stroke="rgba(148,163,184,.25)" strokeWidth="4" />
          <circle cx="19" cy="19" r={R} fill="none" stroke={confCol} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${(c / 100) * L} ${L}`} transform="rotate(-90 19 19)" style={{ transition: "stroke-dasharray .4s" }} />
          <text x="19" y="23" textAnchor="middle" fontSize="11" fontWeight="700" fill={confCol}>{c}</text>
        </svg>
        <div>
          <div style={{ fontSize: 11, color: "#b4c2d6" }}>{T.conf}</div>
          <div style={{ fontSize: 11, fontWeight: 600 }}>{T.models}{calibrated ? ` · ${T.cal}` : ""}</div>
        </div>
      </div>
      <div style={row}>
        <span style={{ color: "#b4c2d6" }}>{T.dist}</span>
        <span><bdi dir="ltr">{data.distCm != null ? `${data.distCm} cm` : "—"}</bdi> <span style={{ color: "#8a9bb3" }}>{data.distSource === "calibrated" ? T.cal : T.est}</span></span>
      </div>
      <div style={row}>
        <span style={{ color: "#b4c2d6" }}>{T.head}</span>
        <span style={{ color: hfCol, fontWeight: 700 }}><bdi dir="ltr">{hf == null ? "—" : `${hf > 0 ? "+" : ""}${hf}°`}</bdi></span>
      </div>
      {calibrated && <div style={{ fontSize: 10, color: "#8a9bb3", marginTop: -2 }}>{T.neutral}</div>}
      {data.protractionCm != null && (
        <div style={row}><span style={{ color: "#b4c2d6" }}>{T.fwd}</span>
          <bdi dir="ltr" style={{ fontWeight: 700, color: data.protractionCm > 4 ? "#ef4444" : data.protractionCm > 2 ? "#f59e0b" : "#10b981" }}>
            {`${data.protractionCm > 0 ? "+" : ""}${data.protractionCm} cm`}</bdi></div>
      )}
      {data.neckLoadKg != null && (
        <div style={row}><span style={{ color: "#b4c2d6" }}>{T.load}</span><bdi dir="ltr">{`~${data.neckLoadKg} kg`}</bdi></div>
      )}
      {data.agreement != null && (
        <div style={row}><span style={{ color: "#b4c2d6" }}>{T.agree}</span><bdi dir="ltr" style={{ color: data.agreement >= 70 ? "#10b981" : "#f59e0b", fontWeight: 600 }}>{data.agreement}%</bdi></div>
      )}
      {data.camera?.moved && (
        <div style={{ fontSize: 10.5, color: "#f59e0b", fontWeight: 600, marginTop: 3 }}>⚠ {T.camMoved}</div>
      )}
      {data.rtmw?.state === "loading" && (
        <div style={{ fontSize: 10, color: "#8a9bb3", marginTop: 2 }}>{T.loading} <bdi dir="ltr">{data.rtmw.progress}%</bdi></div>
      )}
      <div style={{ borderTop: "1px solid rgba(148,163,184,.15)", marginTop: 6, paddingTop: 5 }}>
        <div style={{ fontSize: 10, color: "#b4c2d6", marginBottom: 2 }}>{T.time}</div>
        <div style={row}><span>{T.flex}</span><bdi dir="ltr">{fmt(ex.head_flexion?.totalSec)}</bdi></div>
        <div style={row}><span>{T.close}</span><bdi dir="ltr">{fmt(ex.too_close?.totalSec)}</bdi></div>
      </div>
    </div>
  );
}
