// ── Privacy face blur ───────────────────────────────────────────────
// Pixelates the face region on the overlay canvas so a stored or streamed
// posture view never shows a recognisable face. Bounds the face from the
// ear + nose/eye landmarks, downscales that slice of the source (live video)
// to a handful of pixels, then draws it back enlarged with smoothing off —
// a mosaic. `src` can be any CanvasImageSource (a <video> or a <canvas>).
let _blurCanvas = null;

export function drawFaceBlur(ctx, src, lms, W, H) {
  if (!lms || !src) return false;
  const g = i => lms[i];
  const vis = i => g(i) && (g(i).visibility == null || g(i).visibility > 0.5);
  const lEar = g(7), rEar = g(8), nose = g(0), lEye = g(2), rEye = g(5);
  if (!(vis(7) || vis(8))) return false;               // need at least one ear
  const earL = vis(7) ? lEar : rEye, earR = vis(8) ? rEar : lEye;
  let spanPx = Math.abs((earL?.x ?? 0) - (earR?.x ?? 0)) * W;
  if (spanPx < 12 && lEye && rEye) spanPx = Math.abs(lEye.x - rEye.x) * W * 1.8;
  if (spanPx < 12) return false;
  const cx = (((earL?.x ?? 0) + (earR?.x ?? 0)) / 2) * W;
  const cy = ((nose?.y ?? (((lEye?.y ?? 0) + (rEye?.y ?? 0)) / 2)) || 0.15) * H;
  const boxW = spanPx * 1.7, boxH = spanPx * 2.2;
  const x = Math.max(0, cx - boxW / 2), y = Math.max(0, cy - boxH * 0.6);
  const w = Math.min(boxW, W - x), h = Math.min(boxH, H - y);
  if (w <= 2 || h <= 2) return false;
  // ~10 blocks across the face — coarse enough that eyes/features aren't
  // individually distinguishable, so identity is obscured.
  const pxW = Math.max(5, Math.round(w / 10)), pxH = Math.max(5, Math.round(h / 10));
  if (!_blurCanvas) _blurCanvas = document.createElement("canvas");
  _blurCanvas.width = pxW; _blurCanvas.height = pxH;
  try {
    const tctx = _blurCanvas.getContext("2d");
    tctx.drawImage(src, x, y, w, h, 0, 0, pxW, pxH);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(_blurCanvas, 0, 0, pxW, pxH, x, y, w, h);
    ctx.restore();
    return true;
  } catch { return false; }
}
