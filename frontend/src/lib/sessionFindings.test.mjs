/**
 * sessionFindings — the end-of-session summary reports the session, not its
 * last frame.
 *   node src/lib/sessionFindings.test.mjs
 */
import { createSessionAggregator } from "./sessionFindings.js";
import { buildFindings } from "./findings.js";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? " — " + detail : ""}`); };
const M = (severity, value = 5, extra = {}) => ({ value, score: severity === "normal" ? 95 : 50, unit: "cm", label: "X", reliable: true, severity, ...extra });

{
  const a = createSessionAggregator();
  for (let i = 0; i < 90; i++) a.add({ fhp_index: M("moderate", 6), head_yaw: M("normal") });
  for (let i = 0; i < 10; i++) a.add({ fhp_index: M("normal", 1), head_yaw: M("severe") });
  const s = a.summarize();
  check("a fault held most of the session is reported even if the last frames were fine",
    s.fhp_index.severity === "moderate", s.fhp_index.severity);
  check("a brief fault at the end (last 10%) is not reported", s.head_yaw.severity === "normal", s.head_yaw.severity);
  check("the reported value is a typical reading of that severity", s.fhp_index.value === 6, String(s.fhp_index.value));
  check("share is attached", s.fhp_index.share === 0.9, String(s.fhp_index.share));
  const f = buildFindings(s).findings.map(x => x.id);
  check("buildFindings accepts the summary unchanged", f.length === 1 && f[0] === "fhp_index", JSON.stringify(f));
}
{
  const a = createSessionAggregator();
  for (let i = 0; i < 50; i++) a.add({ neck_lean: M(i % 2 ? "severe" : "mild") });
  check("mixed severities: reported at the worst one that held at least 20%",
    a.summarize().neck_lean.severity === "severe");
  const b = createSessionAggregator();
  for (let i = 0; i < 100; i++) b.add({ neck_lean: M(i < 15 ? "severe" : i < 40 ? "moderate" : "normal") });
  check("severe 15% + moderate 25%: reported as moderate (40% at least moderate)",
    b.summarize().neck_lean.severity === "moderate", b.summarize().neck_lean.severity);
}
{
  const a = createSessionAggregator();
  for (let i = 0; i < 20; i++) a.add({ rounded_shoulders: { ...M("normal"), reliable: false } });
  const s = a.summarize();
  check("never measured stays unmeasured", s.rounded_shoulders.reliable === false);
  check("and is listed as unmeasured, not as a finding", buildFindings(s).unmeasured.length === 1);
  a.reset();
  check("reset clears the session", Object.keys(a.summarize()).length === 0);
}

console.log(`\n${pass} passed · ${fail} failed`);
if (fail) process.exit(1);
