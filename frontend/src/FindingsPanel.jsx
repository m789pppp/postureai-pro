import { useState } from "react";
import { buildFindings, findingsSummary } from "./lib/findings.js";

/**
 * FindingsPanel — how a measurement becomes something someone can act on.
 *
 * The product used to render thirteen rows of "label … value … bar". That is
 * a readout, not a finding: it never said whether the number was bad, why it
 * would matter, or what to do differently.
 *
 * The hierarchy here is deliberate and always in this order:
 *
 *   severity chip + title     what is wrong, and how serious
 *   headline                  the observation, in the user's own terms
 *   action                    what to do — visible without expanding, because
 *                             it is the only part that changes anything
 *   why it matters            the mechanism, one tap away
 *   technical                 the number, its unit, its score, its basis
 *
 * Severity is never carried by colour alone: every chip pairs its colour with
 * a word and a shape, so it survives colour-blindness and a projector.
 */

const DOT = { severe: "●", moderate: "◑", mild: "○", normal: "✓", unmeasured: "–" };

function Chip({ label, color, sev }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
      padding: "2px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 700,
      color, background: `${color}1A`, border: `1px solid ${color}40`, letterSpacing: ".01em",
    }}>
      <span aria-hidden="true" style={{ fontSize: 9 }}>{DOT[sev] || "●"}</span>{label}
    </span>
  );
}

export function FindingCard({ finding: f, cs, isAr, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const border = cs?.border || "rgba(148,163,184,.14)";
  const text   = cs?.text   || "#e6edf3";
  const muted  = cs?.muted  || "#94a3b8";
  const t = f.technical || {};

  return (
    <div style={{
      border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px",
      background: "rgba(148,163,184,.035)",
      // A hairline of the severity colour on the leading edge: enough to scan
      // a list by, without tinting the whole card.
      borderInlineStartWidth: 3, borderInlineStartColor: f.color || border, borderInlineStartStyle: "solid",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: text, lineHeight: 1.35 }}>{f.title}</div>
        <Chip label={f.severityLabel} color={f.color} sev={f.severity} />
      </div>

      <div style={{ fontSize: 12.5, color: text, opacity: .9, lineHeight: 1.65, marginBottom: 8 }}>
        {f.headline}
      </div>

      {/* The correction stays visible. Hiding the one part that changes
          anything behind a disclosure defeats the point of the card. */}
      <div style={{
        fontSize: 12.5, color: text, lineHeight: 1.7,
        background: "rgba(79,174,142,.08)", border: "1px solid rgba(79,174,142,.22)",
        borderRadius: 9, padding: "9px 11px",
      }}>
        <span style={{ fontWeight: 700, color: "#4FAE8E" }}>{isAr ? "اعمل إيه: " : "Do this: "}</span>
        {f.action}
      </div>

      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="link-btn"
        style={{
          marginTop: 9, background: "none", border: "none", padding: 0,
          color: muted, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
        {open ? (isAr ? "إخفاء التفاصيل" : "Hide detail")
              : (isAr ? "ليه ده مهم + الأرقام" : "Why this matters + the numbers")}
        <span aria-hidden="true" style={{ fontSize: 9 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${border}` }}>
          <div style={{ fontSize: 12, color: muted, lineHeight: 1.75, marginBottom: 10 }}>{f.why}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              [isAr ? "القياس" : "Measured", t.value != null ? `${t.value}${t.unit || ""}` : "—"],
              [isAr ? "الدرجة" : "Score",    t.score != null ? `${t.score}/100` : "—"],
              ...(t.extra?.extra_load_kg  ? [[isAr ? "حِمل إضافي على الرقبة" : "Extra neck load", `${t.extra.extra_load_kg} kg`]] : []),
              ...(t.extra?.neck_angle_deg ? [[isAr ? "زاوية الرقبة" : "Neck angle", `${t.extra.neck_angle_deg}°`]] : []),
            ].map(([k, v]) => (
              <div key={k} style={{
                padding: "5px 9px", borderRadius: 7, background: "rgba(148,163,184,.06)",
                border: `1px solid ${border}`, fontSize: 11,
              }}>
                <span style={{ color: muted }}>{k} </span>
                <span style={{ color: text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{v}</span>
              </div>
            ))}
          </div>
          {/* Whether this was judged against the user's own neutral or a
              population default is the single most useful thing for deciding
              how much to trust a borderline reading — so it is stated, always,
              rather than left for the user to assume. */}
          <div style={{ fontSize: 10.5, color: muted, marginTop: 8, lineHeight: 1.6 }}>
            {t.personalised
              ? (isAr ? "متقاس مقابل وضعيتك الطبيعية المُعايَرة." : "Measured against your own calibrated neutral.")
              : (isAr ? "متقاس مقابل متوسط عام — عايِر نفسك عشان يبقى مضبوط عليك انت."
                      : "Measured against a population average — calibrate to compare against your own neutral.")}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @param metrics   the engine's `metrics` payload
 * @param limit     0 = all
 * @param variant   "full" (session summary) | "compact" (live, beside the camera)
 */
export default function FindingsPanel({
  metrics, cs, isAr = false, calibrated = false, limit = 0,
  variant = "full", showUnmeasured = true, onCalibrate,
}) {
  const [showAll, setShowAll] = useState(false);
  const lang = isAr ? "ar" : "en";
  const res  = buildFindings(metrics, { lang, calibrated });
  const muted  = cs?.muted || "#94a3b8";
  const text   = cs?.text  || "#e6edf3";
  const border = cs?.border || "rgba(148,163,184,.14)";

  const cap = showAll ? 0 : (limit || (variant === "compact" ? 2 : 0));
  const shown = cap > 0 ? res.findings.slice(0, cap) : res.findings;
  const hidden = res.findings.length - shown.length;

  // Nothing measured is NOT "everything is fine". Reporting an all-clear from
  // an unreadable frame is the exact failure this branch exists to prevent —
  // and the fix belongs to the camera, so that is what it talks about.
  if (res.nothingMeasured) {
    return (
      <div style={{ padding: "18px 16px", border: `1px solid ${border}`, borderRadius: 12, background: "rgba(214,162,76,.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#D6A24C", marginBottom: 6 }}>
          {isAr ? "مفيش حاجة اتقاست لسه" : "Nothing measured yet"}
        </div>
        <div style={{ fontSize: 12, color: muted, lineHeight: 1.7 }}>
          {isAr ? "الكاميرا مش شايفة النقط اللي محتاجينها. اقعد بحيث إن كتفيك وراسك يبانوا بالكامل في الكادر، وشوف الإضاءة."
                : "The camera can't see the landmarks it needs. Sit so your head and both shoulders are fully in frame, and check the lighting."}
        </div>
      </div>
    );
  }

  if (res.allClear) {
    return (
      <div style={{ padding: "18px 16px", border: "1px solid rgba(79,174,142,.25)", borderRadius: 12, background: "rgba(79,174,142,.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#4FAE8E", marginBottom: 6 }}>
          {isAr ? "✓ كل المقاييس في المدى الطبيعي" : "✓ Everything measured is in range"}
        </div>
        <div style={{ fontSize: 12, color: muted, lineHeight: 1.7 }}>
          {isAr ? `${res.measured} مقياس اتقاسوا ومفيش فيهم حاجة برّه المدى. حافظ على وضعك.`
                : `${res.measured} metrics measured, none outside their range. Hold this position.`}
        </div>
      </div>
    );
  }

  return (
    <div>
      {variant === "full" && (
        <div style={{ fontSize: 11, fontWeight: 700, color: muted, letterSpacing: ".06em",
                      textTransform: "uppercase", marginBottom: 10 }}>
          {isAr ? "محتاج انتباه" : "What needs attention"}
          <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, marginInlineStart: 8 }}>
            {findingsSummary(res, lang)}
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shown.map(f => <FindingCard key={f.id} finding={f} cs={cs} isAr={isAr} />)}
      </div>

      {hidden > 0 && (
        <button onClick={() => setShowAll(true)} className="link-btn"
          style={{ marginTop: 9, width: "100%", background: "none", border: `1px solid ${border}`,
                   borderRadius: 9, padding: "8px 0", fontSize: 11.5, fontWeight: 600,
                   color: muted, cursor: "pointer" }}>
          {isAr ? `+ ${hidden} حاجة تانية` : `+ ${hidden} more`}
        </button>
      )}

      {/* Unmeasured metrics are listed apart from the findings, because they
          are not observations about the body — they are the camera telling you
          what it cannot see. Folding them in with real findings is what made
          four permanently-unreadable metrics render as healthy green rows. */}
      {showUnmeasured && res.unmeasured.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 11.5, color: muted, cursor: "pointer", listStyle: "none" }}>
            {isAr ? `${res.unmeasured.length} مقياس مش ظاهر للكاميرا` : `${res.unmeasured.length} not visible to the camera`}
          </summary>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7 }}>
            {res.unmeasured.map(u => (
              <div key={u.id} style={{ fontSize: 11.5, color: muted, lineHeight: 1.65,
                                       paddingInlineStart: 10, borderInlineStart: `2px solid ${border}` }}>
                <span style={{ color: text, fontWeight: 600 }}>{u.title}</span> — {u.why}
              </div>
            ))}
          </div>
        </details>
      )}

      {!res.findings.some(f => f.technical?.personalised) && onCalibrate && (
        <button onClick={onCalibrate} className="link-btn"
          style={{ marginTop: 10, background: "none", border: "none", padding: 0,
                   color: "#4FAE8E", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
          {isAr ? "عايِر وضعيتك الطبيعية عشان القياس يبقى عليك انت ←"
                : "Calibrate your neutral so these are measured against you →"}
        </button>
      )}
    </div>
  );
}
