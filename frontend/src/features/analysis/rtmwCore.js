/**
 * rtmwCore.js — pure RTMW pre/post-processing shared by the main thread and the
 * worker (kept separate so the worker bundle does not import itself).
 * Mirrors rtmlib (Python) so browser output can be checked against it.
 */

export const INPUT_W = 288, INPUT_H = 384, K = 133, SPLIT = 2;
export const MEAN = [123.675, 116.28, 103.53];   // applied in B,G,R order — same as rtmlib
export const STD = [58.395, 57.12, 57.375];

// ── pure helpers (unit-tested in Node) ─────────────────────────────────────
/** rtmlib bbox_xyxy2cs + top_down_affine aspect fix → crop rect in source px. */
export function cropRect([x1, y1, x2, y2], padding = 1.25) {
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  let w = (x2 - x1) * padding, h = (y2 - y1) * padding;
  const aspect = INPUT_W / INPUT_H;
  if (w > h * aspect) h = w / aspect; else w = h * aspect;
  return { sx: cx - w / 2, sy: cy - h / 2, sw: w, sh: h };
}

/** SimCC decode: argmax per axis, score = mean of the two maxima (rtmlib default). */
export function decodeSimcc(simccX, simccY, k = K, wx = INPUT_W * SPLIT, wy = INPUT_H * SPLIT) {
  const locs = new Float32Array(k * 2), scores = new Float32Array(k);
  for (let j = 0; j < k; j++) {
    let bx = 0, vx = -Infinity, by = 0, vy = -Infinity;
    const ox = j * wx, oy = j * wy;
    for (let i = 0; i < wx; i++) { const v = simccX[ox + i]; if (v > vx) { vx = v; bx = i; } }
    for (let i = 0; i < wy; i++) { const v = simccY[oy + i]; if (v > vy) { vy = v; by = i; } }
    const s = (vx + vy) / 2;
    scores[j] = s;
    locs[2 * j] = s > 0 ? bx / SPLIT : -1;
    locs[2 * j + 1] = s > 0 ? by / SPLIT : -1;
  }
  return { locs, scores };
}

/** Map decoded input-space points back to source pixels. */
export function toSource(locs, { sx, sy, sw, sh }) {
  const out = new Float32Array(locs.length);
  for (let j = 0; j < locs.length; j += 2) {
    out[j] = sx + (locs[j] * sw) / INPUT_W;
    out[j + 1] = sy + (locs[j + 1] * sh) / INPUT_H;
  }
  return out;
}

/** Person box from MediaPipe landmarks (normalised) in source px; null if not enough points. */
export function bboxFromPose(lms, W, H, minVis = 0.4) {
  if (!lms) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, n = 0;
  for (const p of lms) {
    if ((p.visibility ?? 1) < minVis || p.x < -0.2 || p.x > 1.2 || p.y < -0.2 || p.y > 1.2) continue;
    x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y); n++;
  }
  if (n < 5) return null;
  // MediaPipe has no head-top point: extend upward by ~60 % of eye→shoulder height
  const eyeY = Math.min(lms[2]?.y ?? y1, lms[5]?.y ?? y1);
  const shY = Math.max(lms[11]?.y ?? y2, lms[12]?.y ?? y2);
  y1 = Math.min(y1, eyeY - 0.6 * Math.max(0.02, shY - eyeY));
  return [x1 * W, y1 * H, x2 * W, y2 * H];
}

/** Integer crop rect (createImageBitmap takes whole pixels); mapping uses the same numbers. */
export function cropRectInt(bbox) {
  const r = cropRect(bbox);
  return { sx: Math.round(r.sx), sy: Math.round(r.sy), sw: Math.max(1, Math.round(r.sw)), sh: Math.max(1, Math.round(r.sh)) };
}
