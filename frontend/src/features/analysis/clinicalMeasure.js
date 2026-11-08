/**
 * clinicalMeasure — exact readings and trial export for the validation study.
 *
 * Output from this file is the INDEX measurement in a reader-vs-reference
 * comparison. Nothing here establishes that a value is correct, and the
 * numbers must not appear in marketing copy until the study reports them.
 *
 * Side view exists because sagittal head position cannot be read reliably from
 * a front camera: from the front it lies along the depth axis, which MediaPipe
 * only estimates.
 *
 * CVA here is a PROXY. The clinical definition uses the tragus and the C7
 * spinous process. MediaPipe Pose has an ear landmark and a shoulder landmark
 * and no C7, so this is the ear-to-shoulder line. The study should report it
 * under this name and establish its agreement with the marker-based angle.
 */
import { PL } from "./postureEngine.js";

export const MEASURE_VERSION = "clinical-1.0";

const VIS_MIN = 0.55;
/** Shoulder span / torso length above this means the subject is not in profile. */
const MAX_SIDE_SPAN_RATIO = 0.25;
const DEG = 180 / Math.PI;
const r1 = v => Math.round(v * 10) / 10;

const SIDE_METHOD = "2d_image_plane_side_view";
const sideEntry = (value, unit = "deg") => ({
  value: value == null ? null : r1(value),
  signed: value == null ? null : r1(value),
  unit, method: SIDE_METHOD, reliable: value != null,
});
const SIDE_KEYS = ["cva_proxy_deg", "head_sagittal_deg", "trunk_inclination_deg"];
const emptySide = reason => ({
  reason, viewOk: false,
  values: Object.fromEntries(SIDE_KEYS.map(k => [k, sideEntry(null)])),
});

/**
 * Sagittal angles from a camera placed at the subject's side.
 *
 *  cva_proxy_deg          shoulder-to-ear line against horizontal. 90 = ear
 *                         directly above shoulder; lower = head further forward.
 *  head_sagittal_deg      ear-to-eye line against horizontal; positive = eye
 *                         above ear. Includes the anatomical offset between
 *                         those landmarks, so it is not zero with a level head.
 *  trunk_inclination_deg  hip-to-shoulder line against vertical; positive = forward.
 */
export function measureSideView(lms, W, H) {
  if (!lms || lms.length < 25 || !(W > 0) || !(H > 0)) return emptySide("no_landmarks");
  const vis = i => lms[i]?.visibility ?? 0;
  const score = (e, s, h) => vis(e) + vis(s) + vis(h);
  const leftNear = score(PL.L_EAR, PL.L_SHOULDER, PL.L_HIP) >= score(PL.R_EAR, PL.R_SHOULDER, PL.R_HIP);
  const idx = leftNear
    ? { ear: PL.L_EAR, sh: PL.L_SHOULDER, hip: PL.L_HIP, eye: PL.L_EYE }
    : { ear: PL.R_EAR, sh: PL.R_SHOULDER, hip: PL.R_HIP, eye: PL.R_EYE };

  if (vis(idx.ear) < VIS_MIN || vis(idx.sh) < VIS_MIN) return emptySide("ear_or_shoulder_not_visible");
  if (vis(idx.hip) < VIS_MIN) return emptySide("hip_not_visible");
  if (vis(PL.NOSE) < VIS_MIN) return emptySide("nose_not_visible");

  const px = i => ({ x: lms[i].x * W, y: lms[i].y * H });
  const ear = px(idx.ear), sh = px(idx.sh), hip = px(idx.hip), nose = px(PL.NOSE);

  const torso = Math.hypot(sh.x - hip.x, sh.y - hip.y);
  const span  = Math.abs(lms[PL.L_SHOULDER].x - lms[PL.R_SHOULDER].x) * W;
  const spanRatio = torso > 0 ? span / torso : Infinity;
  if (spanRatio > MAX_SIDE_SPAN_RATIO) return { ...emptySide("not_side_view"), spanRatio };

  const facing = Math.sign(nose.x - ear.x) || 1;
  if (sh.y - ear.y <= 0 || hip.y - sh.y <= 0) return { ...emptySide("subject_not_upright"), spanRatio };

  const cva   = Math.atan2(sh.y - ear.y, (ear.x - sh.x) * facing) * DEG;
  const trunk = Math.atan2((sh.x - hip.x) * facing, hip.y - sh.y) * DEG;
  let head = null;
  if (vis(idx.eye) >= VIS_MIN) {
    const eye = px(idx.eye);
    head = Math.atan2(ear.y - eye.y, (eye.x - ear.x) * facing) * DEG;
  }
  return {
    reason: null, viewOk: true, spanRatio, side: leftNear ? "left" : "right",
    values: {
      cva_proxy_deg: sideEntry(cva),
      head_sagittal_deg: sideEntry(head),
      trunk_inclination_deg: sideEntry(trunk),
    },
  };
}

const median = xs => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * One held posture to one row per metric. Each frame is { t, values }.
 * The settling period is dropped, and a metric with too few valid frames is
 * marked unusable rather than reported from thin data.
 */
export function summarizeTrial(frames, { settleMs = 2000, minFrames = 20 } = {}) {
  if (!frames?.length) return {};
  const t0 = frames[0].t;
  const held = frames.filter(f => f.t - t0 >= settleMs);
  const keys = new Set(held.flatMap(f => Object.keys(f.values || {})));
  const out = {};
  for (const k of keys) {
    let unit = null, method = null;
    const xs = [];
    for (const f of held) {
      const e = f.values?.[k];
      if (!e) continue;
      unit = e.unit; method = e.method;
      const v = e.signed ?? e.value;
      if (e.reliable && Number.isFinite(v)) xs.push(v);
    }
    const n = xs.length;
    const mean = n ? xs.reduce((a, b) => a + b, 0) / n : null;
    const sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : null;
    const usable = n >= minFrames;
    out[k] = {
      unit, method, n, excluded: held.length - n, usable,
      median: usable ? r1(median(xs)) : null,
      mean:   usable ? r1(mean) : null,
      sd:     usable && sd != null ? Math.round(sd * 100) / 100 : null,
    };
  }
  return out;
}

/** Quote CSV text and neutralise spreadsheet formulas in free-text fields. */
const csvText = v => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
const csvNum = v => (v == null ? "" : String(v));

const CSV_HEADER = ["participant_id","trial","view","posture","rater","captured_at","measure_version","metric","unit","method","median","mean","sd","n_frames","n_excluded","usable","reference_value","notes"];

/** Long format, one row per metric, with reference_value left for the assessor. */
export function trialsToCsv(trials) {
  const rows = [CSV_HEADER.join(",")];
  for (const t of trials || []) {
    for (const [metric, m] of Object.entries(t.summary || {})) {
      rows.push([
        csvText(t.participantId), csvNum(t.trial), csvText(t.view), csvText(t.posture), csvText(t.rater),
        csvText(t.capturedAt), csvText(MEASURE_VERSION), csvText(metric), csvText(m.unit), csvText(m.method),
        csvNum(m.median), csvNum(m.mean), csvNum(m.sd), csvNum(m.n), csvNum(m.excluded),
        m.usable ? "1" : "0", "", "",
      ].join(","));
    }
  }
  return "\uFEFF" + rows.join("\r\n") + "\r\n";
}
