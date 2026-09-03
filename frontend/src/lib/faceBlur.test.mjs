/**
 * Face blur coverage.
 *
 * A privacy control that silently under-covers is worse than none, so this
 * asserts the property that matters — the mosaic actually contains the head —
 * across the head rotations a posture session puts a user through, and pins
 * the old single-axis geometry as the regression it was.
 *
 *   node src/lib/faceBlur.test.mjs
 */
import { faceBlurBox } from "./faceBlur.js";
import { renderSubject } from "../features/analysis/syntheticSubject.mjs";

const W = 1280, H = 720;
let pass = 0, fail = 0;
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) { pass++; }
  else { fail++; failures.push(`${name}${detail ? " — " + detail : ""}`); }
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const fmt = v => Number.isFinite(v) ? (Math.round(v * 10) / 10).toString() : "—";

/** The geometry as it shipped: ear x-separation only. */
function oldBox(lms) {
  const g = i => lms[i];
  const vis = i => g(i) && (g(i).visibility == null || g(i).visibility > 0.5);
  const lEar = g(7), rEar = g(8), nose = g(0), lEye = g(2), rEye = g(5);
  if (!(vis(7) || vis(8))) return null;
  const earL = vis(7) ? lEar : rEye, earR = vis(8) ? rEar : lEye;
  let spanPx = Math.abs((earL?.x ?? 0) - (earR?.x ?? 0)) * W;
  if (spanPx < 12 && lEye && rEye) spanPx = Math.abs(lEye.x - rEye.x) * W * 1.8;
  if (spanPx < 12) return null;
  const cx = (((earL?.x ?? 0) + (earR?.x ?? 0)) / 2) * W;
  const cy = ((nose?.y ?? 0.15)) * H;
  const boxW = spanPx * 1.7, boxH = spanPx * 2.2;
  const x = Math.max(0, cx - boxW / 2), y = Math.max(0, cy - boxH * 0.6);
  const w = Math.min(boxW, W - x), h = Math.min(boxH, H - y);
  if (w <= 2 || h <= 2) return null;
  return { x, y, w, h };
}

const HEAD = [0, 1, 2, 3, 4, 5, 6, 7, 8];
/** Every visible head landmark that the box fails to contain. */
function uncovered(box, lms) {
  if (!box) return HEAD.filter(i => lms[i] && (lms[i].visibility ?? 0) > 0.5);
  return HEAD.filter(i => {
    const p = lms[i];
    if (!p || (p.visibility ?? 0) <= 0.5) return false;
    const x = p.x * W, y = p.y * H;
    // A landmark outside the frame is not on screen and cannot be exposed by
    // a mosaic that stops at the frame edge. Only what is actually visible
    // counts, or a head half out of shot fails a coverage test it passes.
    if (x < 0 || x > W || y < 0 || y > H) return false;
    return x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h;
  });
}

const POSES = [
  ["facing the camera",        {}],
  ["head turned 20°",          { headYawDeg: 20 }],
  ["head turned 45°",          { headYawDeg: 45 }],
  ["leaning 25° to one side",  { lateralLeanDeg: 25 }],
  ["leaning 40° to one side",  { lateralLeanDeg: 40 }],
  ["looking down 25°",         { neckFlexDeg: 25 }],
  ["turned 30° and leaning 25°",{ headYawDeg: 30, lateralLeanDeg: 25 }],
  ["close to the lens",        {}, { distCm: 35 }],
  ["far from the lens",        {}, { distCm: 110 }],
];

console.log("\n══ Face blur — does the mosaic actually cover the head? ══\n");
console.log("  pose                            old box        new box");
for (const [label, pose, cam = {}] of POSES) {
  const lms = renderSubject(pose, {}, cam);
  const o = oldBox(lms), n = faceBlurBox(lms, W, H);
  const uo = uncovered(o, lms).length, un = uncovered(n, lms).length;
  console.log(`  ${label.padEnd(30)} ${String(uo).padStart(2)} exposed    ${String(un).padStart(2)} exposed`
    + `   ${o ? `${fmt(o.w)}×${fmt(o.h)}` : "NOT DRAWN"} → ${n ? `${fmt(n.w)}×${fmt(n.h)}` : "NOT DRAWN"}`);
}
console.log("");

for (const [label, pose, cam = {}] of POSES) {
  const lms = renderSubject(pose, {}, cam);
  const miss = uncovered(faceBlurBox(lms, W, H), lms);
  check(`Every head landmark is covered — ${label}`, miss.length === 0,
        miss.length ? `landmarks outside the mosaic: ${miss.join(", ")}` : "");
}

// The box must not collapse under rotation, which is what the ear-x geometry
// did. Compared against the facing-forward box rather than an absolute size.
{
  const base = faceBlurBox(renderSubject({}, {}, {}), W, H);
  const area = b => b ? b.w * b.h : 0;
  for (const [label, pose] of [["turned 45°", { headYawDeg: 45 }], ["leaning 40°", { lateralLeanDeg: 40 }]]) {
    const b = faceBlurBox(renderSubject(pose, {}, {}), W, H);
    const ratio = area(b) / area(base);
    check(`The mosaic does not shrink away when the head moves — ${label}`,
          ratio > 0.7, `${Math.round(ratio * 100)}% of the forward-facing area`);
  }
}

// Landmark containment alone cannot see the real failure: the synthetic head
// carries points only at the eyes, ears and nose, and the old box's 1.7x/2.2x
// multipliers happen to contain those. What it never contained was the hair,
// jaw and chin, none of which have a landmark. So the property to assert is
// SCALE — the box has to stay proportional to the head's true size however the
// head is rotated, which is exactly what measuring one axis of one pair could
// not do.
{
  const trueHeadScale = (lms) => {
    const l = lms[7], r = lms[8];
    return Math.hypot((l.x - r.x) * W, (l.y - r.y) * H);   // 2D, not |dx|
  };
  console.log("");
  // Scale is asserted at 90cm so the box has room in frame — at the rig's
  // default 60cm the (now larger) box runs into the border on most poses and
  // the assertion would skip itself, which is how a scale test quietly stops
  // testing anything.
  for (const [label, pose] of POSES.map(([l, p]) => [l, p])) {
    const cam = { distCm: 90 };
    const lms = renderSubject(pose, {}, cam);
    const scale = trueHeadScale(lms);
    const o = oldBox(lms), n = faceBlurBox(lms, W, H);
    // A box that runs into a frame edge is clipped by the frame, not by the
    // geometry — the head itself is partly out of shot. Nothing to assert.
    const clipped = n && (n.x <= 0 || n.y <= 0 || n.x + n.w >= W || n.y + n.h >= H);
    if (clipped) { console.log(`  --    ${label} — head partly out of frame, scale not asserted`); continue; }
    const ratio = n ? Math.min(n.w, n.h) / scale : 0;
    const oRatio = o ? Math.min(o.w, o.h) / scale : 0;
    // Raised from 1.5 after a real subject at 88cm still showed jaw and beard
    // below the mosaic: 1.7x covered every landmark and not the anatomy the
    // landmarks stop short of.
    check(`The mosaic stays proportional to the head — ${label}`, ratio >= 2.0,
          `${fmt(ratio)}x the true ear separation (the shipped geometry gave ${fmt(oRatio)}x)`);
  }
}

// And it must still refuse rather than draw a token box when the head is not
// really there — silent partial coverage is the failure being fixed.
{
  const lms = renderSubject({}, {}, {}).map((p, i) =>
    HEAD.includes(i) && i !== 0 ? { ...p, visibility: 0.1 } : p);
  check("With the head barely detected, it declines instead of half-covering",
        faceBlurBox(lms, W, H) === null, "");
}

console.log(`\n${"─".repeat(58)}\n${pass} passed · ${fail} failed\n${"─".repeat(58)}`);
if (fail) { console.log("\nFailures:"); failures.forEach(f => console.log("  · " + f)); process.exit(1); }
