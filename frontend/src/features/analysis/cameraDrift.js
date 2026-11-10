/**
 * cameraDrift.js — detect that the laptop screen (= camera) was tilted after calibration.
 *
 * Every angle is measured relative to the calibrated neutral, which cancels the camera's
 * own tilt — until the user tilts the screen. Then head pitch and head/shoulder tilt
 * baselines are off by exactly the camera's pitch/roll change.
 *
 * Method: a tiny grayscale signature of the BACKGROUND (person masked out) is kept on
 * the device at calibration. Live, the background's vertical shift on the left and right
 * halves gives camera pitch (mean shift) and roll (shift difference); the horizontal shift
 * gives yaw. Profiles are edge-weighted and cross-correlated — cheap enough for 1 Hz.
 * Nothing leaves the device: the signature stays in localStorage, never in the cloud.
 */

export const SIG_W = 160, SIG_H = 90;

/** Grayscale signature + person mask from an RGBA buffer of SIG_W×SIG_H. */
export function makeSignature(rgba, personBoxNorm = null, pad = 0.15) {
  const g = new Float32Array(SIG_W * SIG_H), mask = new Uint8Array(SIG_W * SIG_H);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  if (personBoxNorm) {
    const [x1, y1, x2, y2] = personBoxNorm, w = x2 - x1, h = y2 - y1;
    const X1 = Math.max(0, Math.floor((x1 - pad * w) * SIG_W)), X2 = Math.min(SIG_W, Math.ceil((x2 + pad * w) * SIG_W));
    const Y1 = Math.max(0, Math.floor((y1 - pad * h) * SIG_H)), Y2 = SIG_H;          // person reaches the bottom edge
    for (let y = Y1; y < Y2; y++) for (let x = X1; x < X2; x++) mask[y * SIG_W + x] = 1;
  }
  return { g, mask };
}

/** Row (axis 0) or column (axis 1) profile of vertical/horizontal edges over unmasked pixels in [x0,x1). */
function profile(sig, axis, x0 = 0, x1 = SIG_W) {
  const { g, mask } = sig;
  const n = axis === 0 ? SIG_H : SIG_W, out = new Float32Array(n), cnt = new Float32Array(n);
  let wx = 0, w = 0;                                            // edge-weighted x centroid of what was used
  for (let y = 1; y < SIG_H - 1; y++) for (let x = Math.max(1, x0); x < Math.min(SIG_W - 1, x1); x++) {
    const i = y * SIG_W + x;
    if (mask[i] || mask[i - SIG_W] || mask[i + SIG_W] || mask[i - 1] || mask[i + 1]) continue;
    const v = axis === 0 ? g[i + SIG_W] - g[i - SIG_W] : g[i + 1] - g[i - 1];        // edge across the axis
    const k = axis === 0 ? y : x;
    out[k] += Math.abs(v); cnt[k]++; wx += Math.abs(v) * x; w += Math.abs(v);
  }
  for (let k = 0; k < n; k++) out[k] = cnt[k] >= 4 ? out[k] / cnt[k] : NaN;
  out.cx = w > 0 ? wx / w : (x0 + x1) / 2;
  return out;
}

/** Best shift s (cur[k] ≈ ref[k − s]) by normalised cross-correlation, sub-pixel. */
export function bestShift(ref, cur, maxShift) {
  const score = s => {
    let sxy = 0, sx = 0, sy = 0, sxx = 0, syy = 0, n = 0;
    for (let k = 0; k < cur.length; k++) {
      const a = ref[k - s], b = cur[k];
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      sxy += a * b; sx += a; sy += b; sxx += a * a; syy += b * b; n++;
    }
    if (n < 10) return -1;
    const cov = sxy - (sx * sy) / n, va = sxx - (sx * sx) / n, vb = syy - (sy * sy) / n;
    return va > 1e-6 && vb > 1e-6 ? cov / Math.sqrt(va * vb) : -1;
  };
  let best = 0, bestV = -2;
  const vals = {};
  for (let s = -maxShift; s <= maxShift; s++) { vals[s] = score(s); if (vals[s] > bestV) { bestV = vals[s]; best = s; } }
  let sub = best;
  const a = vals[best - 1], b = vals[best], c = vals[best + 1];
  if (a != null && c != null && a > -1 && c > -1) { const den = a - 2 * b + c; if (Math.abs(den) > 1e-9) sub = best + 0.5 * (a - c) / den; }
  return { shift: sub, corr: bestV };
}

/**
 * Camera rotation since the reference, in degrees.
 * @param {number} focalPx focal length at the SIGNATURE resolution's source frame width W
 * @param {number} W source frame width (px) — signature is a W/SIG_W downscale
 * @returns {{pitch:number, roll:number, yaw:number, corr:number, ok:boolean}|null}
 */
export function cameraChange(ref, cur, focalPx, W) {
  if (!ref || !cur || !(focalPx > 0)) return null;
  // compare the same pixels in both: background visible in BOTH frames
  const union = new Uint8Array(ref.mask.length);
  for (let i = 0; i < union.length; i++) union[i] = ref.mask[i] | cur.mask[i];
  ref = { g: ref.g, mask: union }; cur = { g: cur.g, mask: union };
  const scale = W / SIG_W;                                    // signature px → source px
  const third = Math.round(SIG_W / 3);
  const pL = profile(ref, 0, 0, third), pR = profile(ref, 0, SIG_W - third, SIG_W);
  const L = bestShift(pL, profile(cur, 0, 0, third), 12);
  const R = bestShift(pR, profile(cur, 0, SIG_W - third, SIG_W), 12);
  const X = bestShift(profile(ref, 1), profile(cur, 1), 16);
  const dy = ((L.shift + R.shift) / 2) * scale, dx = X.shift * scale;
  const baseline = Math.max(10, pR.cx - pL.cx) * scale;      // where the background texture actually is
  const deg = r => (r * 180) / Math.PI;
  return {
    pitch: deg(Math.atan(dy / focalPx)),                     // background moved DOWN → camera tilted UP
    yaw: deg(Math.atan(dx / focalPx)),
    roll: deg(Math.atan(((L.shift - R.shift) * scale) / baseline)),   // + = image rotated counter-clockwise
    corr: Math.min(L.corr, R.corr),
    ok: Math.min(L.corr, R.corr) > 0.6,                      // textured enough to trust pitch/roll
    yawOk: X.corr > 0.6,                                     // yaw needs vertical structure too
  };
}

// ── capture / persist (browser) ────────────────────────────────────────────
const STORE_KEY = "posmoz_bg_signature_v1";

/** Draw the source into a SIG_W×SIG_H canvas and build a signature. */
export function captureSignature(source, personBoxNorm, holder) {
  try {
    if (!holder.canvas) {
      holder.canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(SIG_W, SIG_H)
        : Object.assign(document.createElement("canvas"), { width: SIG_W, height: SIG_H });
      holder.ctx = holder.canvas.getContext("2d", { willReadFrequently: true });
    }
    holder.ctx.drawImage(source, 0, 0, SIG_W, SIG_H);
    return makeSignature(holder.ctx.getImageData(0, 0, SIG_W, SIG_H).data, personBoxNorm);
  } catch { return null; }
}

/** Keep the calibration-time background signature on this device only. */
export function saveReferenceSignature(sig, meta = {}) {
  try {
    const g = Uint8Array.from(sig.g, v => Math.max(0, Math.min(255, Math.round(v))));
    const pack = a => btoa(String.fromCharCode(...a));
    localStorage.setItem(STORE_KEY, JSON.stringify({ g: pack(g), m: pack(sig.mask), ...meta }));
  } catch { /* storage blocked */ }
}

export function loadReferenceSignature() {
  try {
    const o = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (!o) return null;
    const unpack = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    return { g: Float32Array.from(unpack(o.g)), mask: unpack(o.m), meta: o };
  } catch { return null; }
}
