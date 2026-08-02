/**
 * Corvus — Custom Alert Rules (Pro tier)
 * ─────────────────────────────────────────────────────────────────
 * Lets a Pro user define their own trigger instead of the fixed
 * built-in thresholds, e.g. "if my back bends more than 15° for 5
 * continuous minutes, alert me."
 *
 * Exports:
 *  - ALERT_METRICS            metric catalogue (id, label, which
 *    engine metric key it reads per view mode, unit)
 *  - CustomAlertRulesPanel    settings modal: list / add / edit /
 *    delete rules, persisted by the caller via onSave(rules)
 *  - useCustomAlertRuleEngine hook: checkRules(metrics, mode) called
 *    once per analysis tick from the live session loop; tracks how
 *    long each rule's condition has held continuously and fires
 *    onTrigger(rule) once the duration threshold is crossed, with
 *    its own per-rule cooldown so it can't spam every frame.
 */
import { useState, useRef, useCallback } from "react";

export const ALERT_METRICS = [
  { id: "spine_lean",    label: "Back/Spine lean",   label_ar: "انحناء الظهر",     keys: ["spine_lean", "spine_align"],       unit: "°" },
  { id: "neck_lean",     label: "Neck lean",          label_ar: "انحناء الرقبة",    keys: ["neck_lean", "neck_lean_side"],     unit: "°" },
  { id: "shoulder_level",label: "Shoulder tilt",      label_ar: "ميل الكتفين",      keys: ["shoulder_level"],                  unit: "°" },
  { id: "head_tilt",     label: "Head tilt",          label_ar: "ميل الرأس",        keys: ["head_tilt"],                       unit: "°" },
  { id: "trunk_lean",    label: "Trunk lean (side)",  label_ar: "ميل الجذع (جانبي)",keys: ["trunk_lean"],                      unit: "°" },
];

function metricValue(metrics, ruleMetricId) {
  const cfg = ALERT_METRICS.find(m => m.id === ruleMetricId);
  if (!cfg || !metrics) return null;
  for (const k of cfg.keys) {
    const v = metrics[k]?.value;
    if (typeof v === "number") return Math.abs(v);
  }
  return null;
}

let _ruleIdSeq = 1;
export function newRuleId() { return `rule_${Date.now()}_${_ruleIdSeq++}`; }

/* ────────────────────────────────────────────────────────────────
   Live rule engine — called once per analysis tick
   ──────────────────────────────────────────────────────────────── */
export function useCustomAlertRuleEngine(rules, { onTrigger, cooldownMs = 180000 } = {}) {
  // holdSinceRef[ruleId] = timestamp condition started being true (continuously)
  const holdSinceRef = useRef({});
  // lastFiredRef[ruleId] = timestamp rule last fired (for cooldown)
  const lastFiredRef = useRef({});
  // BUG FIX: onTrigger is passed as an inline arrow function by the one
  // caller (App.jsx), so it's a brand-new reference every single render.
  // Previously it sat directly in checkRules' useCallback deps below, so
  // checkRules itself got a new identity every render too — and since
  // checkRules is a dependency of App.jsx's runLoop useCallback, which is
  // in turn the sole dependency of the effect that (re)starts the live
  // session's requestAnimationFrame loop, every render was cancelling and
  // re-requesting the RAF loop. Each frame's analysis triggers a state
  // update -> re-render -> new onTrigger -> new checkRules -> new runLoop
  // -> effect fires -> cancels+restarts RAF again: a tight thrash cycle
  // that degrades to the live page visibly freezing/hanging under load,
  // with no thrown error (nothing crashes — it just can't keep up).
  // Fix: read the latest onTrigger through a ref so checkRules' identity
  // depends only on rules/cooldownMs, which are genuinely stable between
  // frames (rules only changes when the user actually edits a rule).
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  const checkRules = useCallback((metrics) => {
    if (!rules || !rules.length || !metrics) return;
    const now = Date.now();
    for (const rule of rules) {
      if (!rule.enabled) { delete holdSinceRef.current[rule.id]; continue; }
      const val = metricValue(metrics, rule.metric);
      const breached = val != null && val >= rule.thresholdDeg;

      if (!breached) {
        delete holdSinceRef.current[rule.id];
        continue;
      }
      if (!holdSinceRef.current[rule.id]) holdSinceRef.current[rule.id] = now;

      const heldMs = now - holdSinceRef.current[rule.id];
      const lastFired = lastFiredRef.current[rule.id] || 0;
      if (heldMs >= rule.durationSec * 1000 && (now - lastFired) >= cooldownMs) {
        lastFiredRef.current[rule.id] = now;
        onTriggerRef.current?.(rule, val);
      }
    }
  }, [rules, cooldownMs]);

  return { checkRules };
}

/* ────────────────────────────────────────────────────────────────
   Settings panel — list / add / edit / delete rules
   ──────────────────────────────────────────────────────────────── */
const DEFAULT_RULE = () => ({
  id: newRuleId(), metric: "spine_lean", thresholdDeg: 15, durationSec: 300,
  enabled: true, voice: true, toast: true,
});

export function CustomAlertRulesPanel({ isAr, cs, rules = [], onSave, onClose }) {
  const [localRules, setLocalRules] = useState(rules);
  const [editing, setEditing] = useState(null); // rule being added/edited, or null

  const persist = (next) => { setLocalRules(next); onSave?.(next); };
  const remove = (id) => persist(localRules.filter(r => r.id !== id));
  const toggle = (id) => persist(localRules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  const startAdd = () => setEditing(DEFAULT_RULE());
  const startEdit = (r) => setEditing({ ...r });
  const saveEditing = () => {
    if (!editing) return;
    const exists = localRules.some(r => r.id === editing.id);
    persist(exists ? localRules.map(r => r.id === editing.id ? editing : r) : [...localRules, editing]);
    setEditing(null);
  };

  const metricLabel = (id) => {
    const m = ALERT_METRICS.find(x => x.id === id);
    return m ? (isAr ? m.label_ar : m.label) : id;
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: cs.card, border: `1px solid ${cs.border}`, borderRadius: 20, maxWidth: 460, width: "100%",
        maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.45)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          background: "linear-gradient(135deg,#7c3aed,#1a56db)", padding: "18px 22px",
          display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0,
        }}>
          <div>
            <div style={{ color: "rgba(255,255,255,.8)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>
              PRO
            </div>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 800, marginTop: 2 }}>
              {isAr ? "قواعد تنبيه مخصصة" : "Custom Alert Rules"}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28,
            color: "#fff", cursor: "pointer", fontSize: 14, flexShrink: 0,
          }}>✕</button>
        </div>

        <div style={{ padding: "18px 22px" }}>
          {!editing ? (
            <>
              {localRules.length === 0 ? (
                <div style={{ fontSize: 12.5, color: cs.muted, textAlign: "center", padding: "24px 0" }}>
                  {isAr
                    ? "مفيش قواعد لسه. اعمل قاعدة زي: \"لو ظهري اتنحنى أكتر من 15° لمدة 5 دقايق، صوّتلي\"."
                    : "No rules yet. Try one like: \"If my back bends more than 15° for 5 minutes, alert me.\""}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {localRules.map(r => (
                    <div key={r.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "rgba(148,163,184,.06)", border: `1px solid ${cs.border}`,
                      borderRadius: 10, padding: "10px 12px",
                    }}>
                      <button onClick={() => toggle(r.id)} title={r.enabled ? "On" : "Off"} style={{
                        width: 34, height: 20, borderRadius: 99, border: "none", cursor: "pointer", flexShrink: 0,
                        background: r.enabled ? "#10b981" : "rgba(148,163,184,.3)", position: "relative",
                      }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute",
                          top: 2, [isAr ? "right" : "left"]: r.enabled ? 16 : 2, transition: "all 160ms",
                        }} />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: cs.text }}>
                          {metricLabel(r.metric)} {">"} {r.thresholdDeg}°
                        </div>
                        <div style={{ fontSize: 11, color: cs.muted, marginTop: 1 }}>
                          {isAr
                            ? `لمدة ${Math.round(r.durationSec/60)} دقيقة متواصلة · ${r.voice?"🔊 صوت":"🔕"}`
                            : `for ${Math.round(r.durationSec/60)} min continuous · ${r.voice?"🔊 voice":"🔕 silent"}`}
                        </div>
                      </div>
                      <button onClick={() => startEdit(r)} style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        {isAr ? "تعديل" : "Edit"}
                      </button>
                      <button onClick={() => remove(r.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14 }}>
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={startAdd} style={{
                width: "100%", padding: "11px", background: "linear-gradient(135deg,#7c3aed,#1a56db)", color: "#fff",
                border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
                {isAr ? "+ قاعدة جديدة" : "+ New Rule"}
              </button>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: cs.muted, display: "block", marginBottom: 6 }}>
                  {isAr ? "المقياس" : "Metric"}
                </label>
                <select value={editing.metric} onChange={e => setEditing({ ...editing, metric: e.target.value })}
                  style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: `1px solid ${cs.border}`, background: cs.bg, color: cs.text, fontSize: 13 }}>
                  {ALERT_METRICS.map(m => <option key={m.id} value={m.id}>{isAr ? m.label_ar : m.label}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: cs.muted, display: "block", marginBottom: 6 }}>
                    {isAr ? "أكتر من (درجة)" : "More than (degrees)"}
                  </label>
                  <input type="number" min={1} max={90} value={editing.thresholdDeg}
                    onChange={e => setEditing({ ...editing, thresholdDeg: Number(e.target.value) || 1 })}
                    style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: `1px solid ${cs.border}`, background: cs.bg, color: cs.text, fontSize: 13 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: cs.muted, display: "block", marginBottom: 6 }}>
                    {isAr ? "لمدة (دقايق)" : "For (minutes)"}
                  </label>
                  <input type="number" min={1} max={60} value={Math.round(editing.durationSec/60)}
                    onChange={e => setEditing({ ...editing, durationSec: (Number(e.target.value) || 1) * 60 })}
                    style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: `1px solid ${cs.border}`, background: cs.bg, color: cs.text, fontSize: 13 }} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: cs.text, cursor: "pointer" }}>
                <input type="checkbox" checked={editing.voice} onChange={e => setEditing({ ...editing, voice: e.target.checked })} />
                {isAr ? "🔊 صوّتلي كمان (مش بس إشعار)" : "🔊 Also speak it out loud (not just a toast)"}
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => setEditing(null)} style={{
                  flex: 1, padding: "10px", background: "none", border: `1px solid ${cs.border}`, borderRadius: 9,
                  fontSize: 12.5, fontWeight: 600, color: cs.muted, cursor: "pointer",
                }}>
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button onClick={saveEditing} style={{
                  flex: 2, padding: "10px", background: "linear-gradient(135deg,#7c3aed,#1a56db)", color: "#fff",
                  border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                }}>
                  {isAr ? "حفظ القاعدة" : "Save Rule"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
