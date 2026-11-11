# Live pipeline performance

How the live posture pipeline is measured, what the first measurement found, and what was
changed because of it. Numbers here are speed, memory and stability. None of them is
accuracy on people: the only ground truth in this repository is the synthetic subject.

## How to measure

| What | Command | Measures |
|---|---|---|
| Browser pipeline | `npm run build && npm run bench:perf -- --image <person.jpg> --label <name>` (from `frontend/`) | load time, time to first score, analyses per second, frame cost, memory, jitter of a still subject |
| Same, on a real device | open `/perf.html` on the deployment, press Start, sit still, download the JSON | the same numbers with the real camera, GPU and network |
| Smoothing | `npm run bench:smoothing` | jitter, lag and tracking error of each smoother against known truth (synthetic subject) |
| Engine accuracy | `npm run test:posture` | 89 checks of the scoring engine against the synthetic subject |

`bench:perf` drives `/perf.html` in headless Chromium. The page runs the same steps as the
live session loop (pose, fusion, smoothing, engine, precision layer, 20 analyses/s ceiling).
The still photo is drawn into a 1280×720 stream with seeded sensor noise, so every run sees
the same frames; each pipeline runs cold (empty profile) then warm, three times, and the
median is reported. Memory is the peak PSS of the browser's processes. Frames stay on the
machine; the result is numbers only.

Jitter is the standard deviation of the nose, ear and shoulder landmarks while the subject
does not move, in pixels of a 1280×720 frame.

## Test machine

Cloud container: 4 CPU cores, no GPU. WebGL is a software rasteriser (SwiftShader) and
WebGPU is absent. This stands in for a laptop **without working hardware acceleration**
(virtual desktops, blocklisted or missing GPU drivers). It is not a typical laptop, and it
is not a phone. The RTMW-x path on WebGPU could not be run here at all.

## Before and after

Median of 3 runs, 15 s each. "Before" is `main` at 6783c76 with only the benchmark added.

| | MediaPipe only, before | MediaPipe only, after | Precision layer, before | Precision layer, after |
|---|---|---|---|---|
| Pose model ready (cold) | 0.80 s | 1.08 s | 0.88 s | 1.03 s |
| First score (cold) | 4.25 s | 1.44 s | 4.67 s | 1.41 s |
| All models settled (cold / warm) | n/a | n/a | 27.9 s / 18.6 s | 3.0 s / 3.0 s |
| Downloaded on first use | 10 MB | 10 MB | 240 MB | 19 MB |
| Kept in Cache Storage | 0 | 0 | 219 MB | 0 |
| Analyses per second | 3.6 | 15.1 | 3.1 | 12.2 |
| Frame cost, median / p95 | 270 / 306 ms | 61 / 85 ms | 333 / 391 ms | 77 / 114 ms |
| Page stalls over 100 ms in 15 s | 54 | 0 | 46 | 32 |
| Peak browser memory | 807 MB | 1069 MB | 1751 to 1976 MB | 1165 MB |
| Landmark jitter, raw | 1.69 px | 1.24 px | 1.70 px | 1.29 px |
| Landmark jitter, smoothed | 1.55 px | 1.18 px | 1.58 px | 1.17 px |
| Neck angle SD | 0.38° | 0.22° | 0.46° | 0.25° |
| Head tilt SD | 0.58° | 0.50° | 0.74° | 0.54° |
| Shoulder level SD | 0.45° | 0.34° | 0.45° | 0.34° |
| Synthetic accuracy (`test:posture`) | 89 / 89 | 89 / 89 | 89 / 89 | 89 / 89 |

Two things got worse and are accepted: the pose model takes about 0.2 s longer to create on
the CPU delegate, and MediaPipe-only memory is about 260 MB higher on it. Both apply only
to devices whose WebGL is software.

## What the baseline showed

1. **229 MB downloaded to be thrown away.** The precision layer downloaded RTMW-x, built
   the session and only then timed it. Without WebGPU one inference took about 1.5 s
   against a 400 ms limit, so the model was rejected after the download, and again on every
   later session (from cache, costing 18 s and about 950 MB each time).
2. **"GPU" was the slow path.** With software WebGL the MediaPipe GPU delegate loads without
   error and runs at 3.6 analyses/s. The CPU delegate on the same machine runs at 15 to 18.
   The old code only fell back to CPU when GPU creation failed.
3. **The runtime was downloaded twice.** The precision layer imported MediaPipe from the CDN
   although the app had already loaded the self-hosted copy, and the face model came from
   the CDN only, so a filtered network had no precision layer.

## What changed

| Change | File | Kept because |
|---|---|---|
| Decide before downloading: no WebGPU, phone, under 8 GB, data saver, 2G/3G, mobile data or too little free storage means RTMW-x is not fetched | `rtmwPolicy.js`, `liveEnhancer.js` | 240 MB → 19 MB, settle 27.9 s → 3.0 s, memory −600 to −800 MB |
| A device measured too slow is remembered for 30 days | `rtmwPolicy.js` | removes the repeat 18 s / 950 MB attempt on every session |
| CPU delegate when WebGL is a software rasteriser | `mediapipeLoader.js`, `App.jsx`, `SmartCalibration.jsx`, bench pages | 3.6 → 15.1 analyses/s, first score 4.25 s → 1.44 s |
| One MediaPipe runtime, self-hosted first; face model staged at build time | `mediapipeLoader.js`, `scripts/fetch-mediapipe.mjs` | face model ready 10.9 s → 2.4 s; works on filtered networks |
| Model bytes read into one buffer instead of chunks plus a joined copy | `rtmwWorker.js` | one copy of the weights fewer at the end of a download. Not measured here: this machine no longer downloads the model |
| Runner and worker take a model spec | `rtmwCore.js`, `rtmwWeb.js`, `rtmwWorker.js` | needed to benchmark other models; default unchanged |

`MEASURE_VERSION` moves from `clinical-1.0` to `clinical-1.1`: the delegate change alters
the arithmetic on affected devices. The pose model and the MediaPipe version are unchanged.

## What was tried and not kept

**A smaller refinement model on WASM.** RTMPose-t / s / m (body7, 256×192, 13 / 22 / 54 MB)
were run through the same fusion, forced onto WASM, one run of 12 s each:

| Model | Inference | Raw jitter | Fused jitter | Memory |
|---|---|---|---|---|
| RTMPose-t | 46 ms | 1.44 px | 2.51 px | 1288 MB |
| RTMPose-s | 58 ms | 1.42 px | 1.60 px | 1303 MB |
| RTMPose-m | 190 ms | 1.26 px | 1.56 px | 1429 MB |
| RTMW-x | 1309 ms | 1.46 px | 2.56 px | 2103 MB |

They are fast enough, but in every case the fused landmarks were less stable than
MediaPipe's own, and the neck, head-tilt and shoulder SDs did not improve. With no ground
truth for a real person there is no measured benefit to set against 120 to 260 MB of
memory, so no small model ships.

**One Euro filter in place of the per-tier EMA.** On the synthetic subject (One Euro 1.0 /
100 against EMA 0.85) landmark jitter fell from 1.81 to 1.14 px at the same 100 ms lag. On
the real pipeline it fell from 1.17 to 1.07 px and the angle SDs did not move (neck 0.32°
vs 0.31°, head tilt 0.50° vs 0.51°). Too small to justify changing what every reading is
computed from. `/perf.html?smoother=euro:1,100` reruns the comparison.

## Open finding

In all four runs above, fusion made a still subject's landmarks noisier, not steadier. That
includes RTMW-x, though only at 1.3 s per inference, far slower than it would run on
WebGPU. Whether fusion helps on a WebGPU laptop is unmeasured. Run
`/perf.html?pipeline=mp` and `/perf.html?pipeline=fused&wait=rtmw` on one and compare
`jitter.raw` with `jitter.fused` before relying on the third model.

## Not tested

- Any real device: no laptop with a GPU, no phone, no real camera.
- RTMW-x on WebGPU: speed, memory, and whether the 8 GB / not-a-phone limits are the right ones.
- Safari and Firefox. Only headless Chromium 153 was run.
- Download time on a real connection. At 10 Mbit/s, 229 MB is about 3 minutes; that is arithmetic, not a measurement.
- Moving subjects in the browser. Lag was measured on the synthetic subject only.
- Accuracy on people. A still photo with added noise measures stability, not correctness.
