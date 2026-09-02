// ── Privacy face blur ───────────────────────────────────────────────
// Pixelates the face region on the overlay canvas so a stored or streamed
// posture view never shows a recognisable face. `src` can be any
// CanvasImageSource (a <video> or a <canvas>).
//
// The previous version sized and centred the box from the ear pair's
// HORIZONTAL separation alone:
//
//     spanPx = |lEar.x - rEar.x| * W
//     boxW = spanPx * 1.7 ; boxH = spanPx * 2.2
//     cx = midpoint of the two ears in x
//
// which fails in exactly the two situations a posture app puts a head into.
//
//   Head tilted. The ears separate mostly in Y, so |Δx| collapses toward zero
//   as the roll angle grows — at 40° it is 77% of the true separation, and the
//   box shrinks with it while the face has swung sideways away from the ear
//   midpoint. Seen on camera: the mosaic sitting up and to one side with the
//   jaw and beard fully visible underneath it.
//
//   Head turned. Yaw converges the ears in X too (cos of the yaw angle), so
//   the box shrinks again — and below the 12px floor the function returns
//   false and blurs NOTHING.
//
// And every failure path returns false, which no caller has ever checked, so
// the toggle stayed lit while nothing was being hidden. A privacy control that
// reports success by staying silent is worse than no control.
//
// Now: the box is sized from the true 2D head extent (every visible head
// landmark, not one axis of one pair), padded for the hair and jaw that carry
// no landmarks at all, and centred on that extent rather than on the ears. The
// return value tells the caller whether the frame is actually covered.

let _blurCanvas = null;

// MediaPipe head landmarks: nose, the six eye points, both ears, both mouth
// corners. Whichever of them are visible bound the head in both axes, so no
// single rotation can collapse the measurement.
const HEAD_IDX = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function drawFaceBlur(ctx, src, lms, W, H) {
  if (!lms || !src) return false;
  const g = i => lms[i];
  const vis = i => g(i) && (g(i).visibility == null || g(i).visibility > 0.5);

  const pts = HEAD_IDX.filter(vis).map(i => ({ x: g(i).x * W, y: g(i).y * H }));
  // Two points can be collinear and give a degenerate box; three is the
  // minimum that bounds an area, and a head that shows fewer than three of
  // eleven landmarks is not being tracked well enough to blur reliably.
  if (pts.length < 3) return false;

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const spanX = x1 - x0, spanY = y1 - y0;
  // Scale reference: the largest dimension of the landmark cloud. Rotation
  // moves extent between the axes but cannot remove it from both, which is the
  // property the old single-axis measurement lacked.
  const span = Math.max(spanX, spanY);
  if (span < 10) return false;

  // Landmarks cover eyes-to-ears and the nose. They stop well short of the
  // scalp, the jaw and the chin, none of which have a landmark, so the box has
  // to be grown past them — generously, because under-covering a face is the
  // failure that matters here and over-covering costs nothing but a slightly
  // larger mosaic.
  const padX = span * 0.55, padY = span * 0.70;
  const bx = x0 - padX, by = y0 - padY * 1.15;   // more headroom above: hair
  const bw = spanX + padX * 2, bh = spanY + padY * 2.1;

  // Clamp by INTERSECTING with the frame, not by subtracting the overflow
  // from the size — subtracting takes the overhang off the far edge too, so a
  // box pushed past the left edge lost the same amount from its right side and
  // left part of the face uncovered. Caught by the coverage test at 35cm and
  // at a 40° lean, where the box overhangs by hundreds of pixels.
  const x = Math.max(0, bx), y = Math.max(0, by);
  const w = Math.min(W, bx + bw) - x;
  const h = Math.min(H, by + bh) - y;
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

/**
 * The box drawFaceBlur() would cover for these landmarks, without drawing
 * anything — so the coverage can be asserted in a test, and so the caller can
 * tell the user when the blur is not actually protecting them.
 * Returns null whenever drawFaceBlur() would return false.
 */
export function faceBlurBox(lms, W, H) {
  if (!lms) return null;
  const g = i => lms[i];
  const vis = i => g(i) && (g(i).visibility == null || g(i).visibility > 0.5);
  const pts = HEAD_IDX.filter(vis).map(i => ({ x: g(i).x * W, y: g(i).y * H }));
  if (pts.length < 3) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const spanX = x1 - x0, spanY = y1 - y0;
  const span = Math.max(spanX, spanY);
  if (span < 10) return null;
  const padX = span * 0.55, padY = span * 0.70;
  const bx = x0 - padX, by = y0 - padY * 1.15;
  const bw = spanX + padX * 2, bh = spanY + padY * 2.1;
  // Clamp by INTERSECTING with the frame, not by subtracting the overflow
  // from the size — subtracting takes the overhang off the far edge too, so a
  // box pushed past the left edge lost the same amount from its right side and
  // left part of the face uncovered. Caught by the coverage test at 35cm and
  // at a 40° lean, where the box overhangs by hundreds of pixels.
  const x = Math.max(0, bx), y = Math.max(0, by);
  const w = Math.min(W, bx + bw) - x;
  const h = Math.min(H, by + bh) - y;
  if (w <= 2 || h <= 2) return null;
  return { x, y, w, h };
}
