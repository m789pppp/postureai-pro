# Corvus Accuracy Validation Tool

`accuracy-validation.html` is a standalone, internal-only page — it is
**not** part of the deployed app and Vite never builds it (it lives
outside `frontend/`).

It runs the exact same MediaPipe model config and angle math as
production (`pose_landmarker_full` + GPU delegate, the same
nose-blended `neck_lean`, the same yaw-corrected distance estimate),
so the numbers it shows are what the real app would show.

## How to run it

Just double-click the file to open it in Chrome/Edge — `file://`
pages are treated as a secure context by Chromium, so camera access
should work directly.

If your browser blocks camera access on `file://`, serve the folder
locally instead:

```bash
cd tools
python3 -m http.server 8080
# then open http://localhost:8080/accuracy-validation.html
```

## How to actually validate accuracy

You need a real, independent way to know the *true* angle/distance —
the tool can't generate ground truth for you. Practical options:

- **Distance**: just use a ruler/tape measure from your eyes to the
  screen. This is the easiest metric to validate precisely.
- **Angles** (neck lean, head tilt, shoulder level, spine lean, head
  yaw): use a phone bubble-level/protractor app held against your
  head/shoulder/back, or mark known angles on a wall/floor with tape
  and align your body to them.

For each metric:
1. Position yourself at a known angle/distance.
2. Hold still 2–3 seconds (lets the smoothing settle).
3. Pick the metric, type in the known value, click "سجّل القراءة الآن".
4. Repeat at several different known values (e.g. 0°, 10°, 20°, 30°)
   per metric — more points = a more meaningful error estimate.

The right panel shows Mean Absolute Error (MAE) per metric once you
have a few logged points — that's a real, defensible accuracy number
instead of a guess. Export to CSV any time to keep the raw data.
