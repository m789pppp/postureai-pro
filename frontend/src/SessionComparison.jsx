/**
 * SessionComparison — آخر 3 جلسات جنب بعض مع diff في كل metric
 */
import React, { useMemo } from "react";
import { useBodyScrollLock } from "./lib/useBodyScrollLock.js";
import { tierAtLeast } from "./lib/tierQuality.js";

const METRICS = [
  { key: "neck_lean",       label: "Neck Lean",       labelAr: "ميل الرقبة",    unit: "°",  low_good: true  },
  { key: "head_tilt",       label: "Head Tilt",       labelAr: "ميل الرأس",     unit: "°",  low_good: true  },
  { key: "shoulder_level",  label: "Shoulder Level",  labelAr: "مستوى الكتفين", unit: "°",  low_good: true  },
  { key: "spine_lean",      label: "Spine Lean",      labelAr: "ميل العمود",    unit: "°",  low_good: true  },
  { key: "head_yaw",        label: "Head Turn",       labelAr: "دوران الرأس",   unit: "°",  low_good: true  },
  { key: "screen_distance", label: "Screen Distance", labelAr: "بُعد الشاشة",   unit: "cm", low_good: false },
];

function sc(s) { return s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444"; }

function MiniBar({ score }) {
  const c = sc(score);
  return (
    <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,.07)", borderRadius: 99, overflow: "hidden", marginTop: 4 }}>
      <div style={{ width: `${score}%`, height: "100%", background: c, borderRadius: 99, transition: "width .6s" }}/>
    </div>
  );
}

function DiffBadge({ diff, lowGood, isAr }) {
  if (diff === null || diff === undefined) return null;
  const improved = lowGood ? diff < 0 : diff > 0;
  const neutral  = Math.abs(diff) < 0.5;
  if (neutral) return <span style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>—</span>;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "1px 6px",
      background: improved ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)",
      color: improved ? "#10b981" : "#ef4444",
    }}>
      {improved ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}
    </span>
  );
}

export default function SessionComparison({ sessions = [], cs, lang, onClose, effectiveTier, onUpgrade }) {
  useBodyScrollLock();
  const isAr = lang === "ar";
  // Take last 3 sessions newest→oldest — must run before any conditional
  // return below (Rules of Hooks: every hook call must happen on every
  // render, unconditionally, in the same order).
  const s3 = useMemo(() => sessions.slice(0, 3), [sessions]);

  // Was gated only at the sidebar nav level (locked:!pro), which was
  // removed in favor of an "open the feature, upsell inside" pattern —
  // but this component never had any internal gate of its own, so
  // removing the sidebar block made it fully free for every tier.
  if (!tierAtLeast(effectiveTier, "professional")) return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9200, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "rgba(8,14,28,.98)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: "36px 28px", maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>🔒</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: cs.text, marginBottom: 8 }}>{isAr ? "مقارنة الجلسات — Pro" : "Session Comparison — Pro"}</div>
        <div style={{ fontSize: 13, color: cs.muted, marginBottom: 22 }}>{isAr ? "قارن آخر 3 جلسات جنب بعض وشوف التحسن في كل metric" : "Compare your last 3 sessions side by side across every metric"}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", background: "rgba(255,255,255,.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{isAr ? "إغلاق" : "Close"}</button>
          <button onClick={()=>{ onClose?.(); onUpgrade?.(); }} style={{ padding: "10px 20px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{isAr ? "الترقية لـ Pro" : "Upgrade to Pro"}</button>
        </div>
      </div>
    </div>
  );

  if (s3.length < 2) return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9200, background: "rgba(0,0,0,.50)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "rgba(8,14,28,.98)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: "36px 28px", maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>📋</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: cs.text, marginBottom: 8 }}>{isAr ? "تحتاج جلستين على الأقل" : "Need at least 2 sessions"}</div>
        <div style={{ fontSize: 13, color: cs.muted, marginBottom: 22 }}>{isAr ? "أكمل جلسة أخرى لتظهر المقارنة" : "Complete another session to enable comparison"}</div>
        <button onClick={onClose} style={{ padding: "10px 28px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>OK</button>
      </div>
    </div>
  );

  const labels = s3.map((s, i) => {
    const d = s.created_at?.toDate?.() ?? new Date(s.created_at || 0);
    const label = i === 0 ? (isAr ? "الأخيرة" : "Latest") : i === 1 ? (isAr ? "السابقة" : "Previous") : (isAr ? "قبلها" : "Oldest");
    const date  = d.toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric" });
    return `${label} · ${date}`;
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9200, background: "rgba(0,0,0,.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div style={{ background: "rgba(15,23,42,.98)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, width: "100%", maxWidth: 700, maxHeight: "92dvh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,.7)", direction: isAr ? "rtl" : "ltr" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: cs.text }}>{isAr ? "مقارنة الجلسات" : "Session Comparison"}</div>
            <div style={{ fontSize: 12, color: cs.muted, marginTop: 2 }}>{isAr ? `آخر ${s3.length} جلسات` : `Last ${s3.length} sessions`}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "#94a3b8", fontSize: 16, cursor: "pointer" }} aria-label="Close">✕</button>
        </div>

        <div style={{ overflowY: "auto", padding: "20px 24px 24px" }}>

          {/* Overall score row */}
          <div style={{ display: "grid", gridTemplateColumns: `180px repeat(${s3.length}, 1fr)`, gap: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: cs.muted, textTransform: "uppercase", letterSpacing: ".07em" }}>{isAr ? "المجموع" : "Overall Score"}</span>
            </div>
            {s3.map((s, i) => {
              const score = s.avg_score || 0;
              const prev  = s3[i + 1]?.avg_score;
              const diff  = prev != null ? score - prev : null;
              return (
                <div key={i} style={{ background: "rgba(255,255,255,.03)", border: `1px solid ${sc(score)}30`, borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: cs.muted, marginBottom: 4, fontWeight: 500 }}>{labels[i]}</div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: sc(score), lineHeight: 1 }}>{score}</div>
                  <MiniBar score={score}/>
                  {diff !== null && (
                    <div style={{ marginTop: 6 }}>
                      <DiffBadge diff={diff} lowGood={false} isAr={isAr}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick stats row */}
          <div style={{ display: "grid", gridTemplateColumns: `180px repeat(${s3.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
            {[
              { label: isAr ? "المدة" : "Duration",     fn: s => { const d = s.duration_s || 0; return `${Math.floor(d/60)}:${String(d%60).padStart(2,"0")}`; }, neutral: true },
              { label: isAr ? "وضعية جيدة" : "Good %", fn: s => `${s.good_pct || 0}%`, neutral: false, high_good: true },
              { label: isAr ? "التنبيهات" : "Alerts",   fn: s => s.alerts_count || 0,   neutral: false, high_good: false },
            ].map((row, ri) => (
              <React.Fragment key={ri}>
                <div style={{ display: "flex", alignItems: "center", gridColumn: ri === 0 ? "1" : undefined }}>
                  {ri === 0 && <span style={{ fontSize: 11, fontWeight: 600, color: cs.muted, textTransform: "uppercase", letterSpacing: ".07em" }}>{isAr ? "إحصائيات" : "Stats"}</span>}
                </div>
                {ri === 0 && s3.map((s, si) => (
                  <div key={si} style={{ background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, padding: "10px 12px" }}>
                    {[
                      { label: isAr ? "المدة" : "Duration",    val: (() => { const d = s.duration_s||0; return `${Math.floor(d/60)}:${String(d%60).padStart(2,"0")}`; })() },
                      { label: isAr ? "وضعية جيدة" : "Good",   val: `${s.good_pct||0}%`,        color: (s.good_pct||0) >= 70 ? "#10b981" : "#f59e0b" },
                      { label: isAr ? "التنبيهات" : "Alerts",  val: s.alerts_count || 0,         color: (s.alerts_count||0) === 0 ? "#10b981" : "#f59e0b" },
                    ].map((stat, stj) => (
                      <div key={stj} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: stj < 2 ? "1px solid rgba(255,255,255,.04)" : "none" }}>
                        <span style={{ fontSize: 11, color: cs.muted }}>{stat.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: stat.color || cs.text }}>{stat.val}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* Metrics comparison table */}
          <div style={{ fontSize: 11, fontWeight: 600, color: cs.muted, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 12 }}>
            {isAr ? "تفصيل المقاييس" : "Metric Breakdown"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {METRICS.map(m => {
              // reliable===false means the camera could not see what this
              // metric is derived from — every hip-based metric, in every
              // laptop session. The stored document keeps the key with a
              // module default in it, so without this check the table showed
              // "spine lean 0° → 0° → 0°" as three readings and the diff badge
              // underneath called it unchanged. Comparing two numbers that
              // were never measured is the one thing this screen must not do.
              const vals = s3.map(s => {
                const met = s.metrics?.[m.key];
                if (!met || met.reliable === false) return null;
                return { value: met.value, score: met.score };
              });
              // skip if no session has this metric
              if (vals.every(v => v === null)) return null;
              return (
                <div key={m.key} style={{ display: "grid", gridTemplateColumns: `180px repeat(${s3.length}, 1fr)`, gap: 10, alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,.05)" }}>
                  {/* Label */}
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{isAr ? m.labelAr : m.label}</div>
                  {/* Values */}
                  {vals.map((v, vi) => {
                    if (!v) return <div key={vi} style={{ textAlign: "center", color: cs.muted, fontSize: 12 }}>—</div>;
                    const prev   = vals[vi + 1];
                    const diff   = prev ? v.value - prev.value : null;
                    return (
                      <div key={vi} style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 3 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: sc(v.score) }}>{v.value != null ? Math.round(v.value) : "—"}</span>
                          <span style={{ fontSize: 10, color: cs.muted }}>{m.unit}</span>
                        </div>
                        <MiniBar score={v.score}/>
                        <div style={{ marginTop: 4 }}>
                          {diff !== null && <DiffBadge diff={diff} lowGood={m.low_good} isAr={isAr}/>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Most improved / most regressed summary */}
          {s3.length >= 2 && (() => {
            const diffs = METRICS.map(m => {
              const m0 = s3[0]?.metrics?.[m.key], m1 = s3[1]?.metrics?.[m.key];
              if (!m0 || !m1 || m0.reliable === false || m1.reliable === false) return null;
              const v0 = m0.value, v1 = m1.value;
              if (v0 == null || v1 == null) return null;
              const diff = v0 - v1;
              const improved = m.low_good ? diff < 0 : diff > 0;
              return { label: isAr ? m.labelAr : m.label, diff: Math.abs(diff), improved };
            }).filter(Boolean);
            const best  = diffs.filter(d => d.improved).sort((a, b) => b.diff - a.diff)[0];
            const worst = diffs.filter(d => !d.improved && d.diff > 0.5).sort((a, b) => b.diff - a.diff)[0];
            if (!best && !worst) return null;
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
                {best && (
                  <div style={{ background: "rgba(16,185,129,.07)", border: "1px solid rgba(16,185,129,.2)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                      {isAr ? "أكثر تحسناً" : "Most Improved"}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: cs.text }}>{best.label}</div>
                    <div style={{ fontSize: 12, color: "#10b981", marginTop: 2 }}>▲ {best.diff.toFixed(1)} {isAr ? "تحسن" : "better"}</div>
                  </div>
                )}
                {worst && (
                  <div style={{ background: "rgba(239,68,68,.07)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                      {isAr ? "يحتاج انتباه" : "Needs Attention"}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: cs.text }}>{worst.label}</div>
                    <div style={{ fontSize: 12, color: "#ef4444", marginTop: 2 }}>▼ {worst.diff.toFixed(1)} {isAr ? "تراجع" : "declined"}</div>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
