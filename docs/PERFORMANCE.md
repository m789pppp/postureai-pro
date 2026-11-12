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
| Pose and face inference in a worker | `visionWorker.js`, `visionClient.js`, `App.jsx`, `liveEnhancer.js` | main-thread time per frame 59 to 112 ms → under 1 ms, no stalls, see below |
| Analysis rate follows movement | `analysisRate.js`, `App.jsx`, `visionClient.js` | CPU on a still subject 121% → 60% of a core, see below |
| Pipeline id on every trial and bench step | `pipelineInfo.js`, `clinicalMeasure.js`, `ClinicalCapture.jsx`, `BenchRecorder.jsx`, `validation/analyze.mjs` | keeps data from different pipelines apart |
| Second model's offset averaged over time; weight no longer fades between inferences | `liveEnhancer.js` | fused jitter back to MediaPipe's own level, see below |
| Runner and worker take a model spec | `rtmwCore.js`, `rtmwWeb.js`, `rtmwWorker.js` | needed to benchmark other models; default unchanged |

`MEASURE_VERSION` moves from `clinical-1.0` to `clinical-1.1`: the delegate change alters
the arithmetic on affected devices, and the fusion change alters fused landmarks wherever
the third model runs. The pose model and the MediaPipe version are unchanged.

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
MediaPipe's own (fixed since, see below). With no ground truth for a real person there is
still no measured benefit to set against 120 to 260 MB of memory, so no small model ships.

**One Euro filter in place of the per-tier EMA.** On the synthetic subject (One Euro 1.0 /
100 against EMA 0.85) landmark jitter fell from 1.81 to 1.14 px at the same 100 ms lag. On
the real pipeline it fell from 1.17 to 1.07 px and the angle SDs did not move (neck 0.32°
vs 0.31°, head tilt 0.50° vs 0.51°). Too small to justify changing what every reading is
computed from. `/perf.html?smoother=euro:1,100` reruns the comparison.

## Inference off the main thread

After the changes above, each analysed frame still blocked the page for 60 to 115 ms,
because MediaPipe ran on the main thread. Pose and face inference now run in a worker
(`visionWorker.js`, `visionClient.js`). The live loop makes the same call as before; it
returns the newest finished result, or "pending" when there is nothing new. If the worker
cannot start or stops answering, the client continues on the main thread by itself.

Same build, worker off and on, median of 3 runs of 15 s:

| | MediaPipe only, main thread | MediaPipe only, worker | Precision layer, main thread | Precision layer, worker |
|---|---|---|---|---|
| Main-thread time per analysed frame, median / p95 | 59 / 75 ms | 0.2 / 0.3 ms | 75 / 112 ms | 0.2 / 0.4 ms |
| Gap between animation frames, p95 | 78 ms | 19 ms | 113 ms | 19 ms |
| Page stalls over 100 ms in 15 s | 0 | 0 | 33 | 0 |
| Analyses per second | 15.8 | 16.3 | 12.3 | 14.2 |
| First score (cold) | 1.40 s | 1.39 s | 1.37 s | 1.32 s |
| Peak browser memory | 1076 MB | 1075 MB | 1166 MB | 1173 MB |
| Landmark jitter, smoothed | 1.19 px | 1.29 px | 1.24 px | 1.19 px |
| Neck angle SD | 0.31° | 0.31° | 0.30° | 0.22° |

Cost: a reading describes a frame about one inference old (50 to 70 ms here). The jitter
and angle differences are within run-to-run variation. Measured through `/perf.html`
only; `App.jsx` uses the same client but its signed-in session was not run. The GPU
delegate was forced on once inside the worker: pose and face both produced results (313 ms
per inference on software WebGL, page still painting every 19 ms). A real GPU was not tried.
The client's own logic (pending, one result handed out once, rate cap, pause, face every
second frame, worker that fails or stalls) is covered by `visionClient.test.mjs` with a fake
worker.
`/perf.html?worker=0` reruns the main-thread path.

## Adaptive analysis rate

The loop analysed up to 20 frames a second for as long as a session ran, whether or not the
person moved. `analysisRate.js` keeps that rate while the nose, ears or shoulders move more
than 5% of the shoulder width (about 2 cm) from where they last settled, and drops to one
analysis per 150 ms after 2 s of stillness. Movement, including a slow drift, returns to
the full rate on the next sample. Validation captures keep the full rate.

Still subject, worker on, median of 3 runs of 20 s. CPU is what the browser's processes used
while measuring, in percent of one core:

| | MediaPipe only, fixed | MediaPipe only, adaptive | Precision layer, fixed | Precision layer, adaptive |
|---|---|---|---|---|
| CPU | 121% | 60% | 122% | 67% |
| Analyses per second | 17.0 | 7.3 | 15.0 | 7.0 |
| Share of analyses at the slow rate | 0 | 80% | 0 | 84% |
| Landmark jitter, smoothed | 1.15 px | 1.35 px | 1.22 px | 1.27 px |
| Neck angle SD | 0.25° | 0.38° | 0.26° | 0.27° |
| Head tilt SD | 0.44° | 0.60° | 0.48° | 0.51° |
| Shoulder level SD | 0.36° | 0.39° | 0.34° | 0.44° |
| Score SD | 1.07 | 1.00 | 1.15 | 1.16 |

The cost is real: readings of a still subject are slightly less steady, because fewer
samples go into each smoothing window. The displayed score is not affected. A slow rate of
250 ms saved more CPU (46 to 61%) and cost more stability (landmark jitter up to 1.57 px),
100 ms saved less (85%); 150 ms was the middle. `/perf.html?rate=fixed` reruns the fixed rate.

Not measured: a real person. Someone who sways or fidgets will spend less time at the slow
rate than a photograph does, so the saving on people will be smaller than in this table.

## Which pipeline produced a reading

`MEASURE_VERSION` names the code. It does not say which models ran: one device runs
MediaPipe alone on the CPU, another fuses a third model on WebGPU. Every validation trial
(`pipeline` column of the CSV) and every bench step now carries an id such as
`mp0.10.14-pose_full/cpu/worker+face`. A recording during which the pipeline changed is
marked `mixed(...)`. `validation/analyze.mjs` and `backend/ai/bench_train.py` warn about, and
never pool, data from different pipelines.

## Bench report

`python -m ai.bench_train --sessions <folder> [--participants participants.csv]` (from
`backend/`) now writes `bench_report.md` next to `correction.json`: per target the bias,
SD, 95% limits of agreement, mean absolute error and worst case of the camera estimate
against the hand measurement, and the same split by every column of `participants.csv`
(`subject` plus conditions such as `hijab`, `glasses`, `lighting`, `device`). The correction
is trained on the pipeline with the most subjects only. The figures describe the people
recorded; they are not a validation study.

## Fusion made landmarks noisier, and why

In every fusion run above the fused landmarks were less stable than MediaPipe's own. The
cause is in the arithmetic: the fused point is `mediapipe + w · (second model − mediapipe at
inference time)`. That offset is measured once per inference and then held, so it carries
the noise of both models at one instant into every frame until the next inference. The
result can only be noisier than MediaPipe alone. The weight also faded with the age of the
result inside every inference interval, which added a saw-tooth at the inference rate.

What the second model can contribute is a correction of MediaPipe's slowly varying bias.
So the offset and its confidence are now averaged over time (1.5 s, or about 8 results for
a slower model, at most 8 s), and the weight fades only when results stop arriving on
schedule. MediaPipe still drives every frame, so movement is not delayed; only a change in
the bias is.

Same build, smoothing off and on, median of 2 runs of 15 s, models forced onto WASM:

| Model (inference) | Raw | Fused, before | Fused, after | Neck SD before → after |
|---|---|---|---|---|
| RTMPose-t (40 ms) | 1.37 px | 2.58 px | 1.32 to 1.48 px | 0.66° → 0.47 to 0.49° |
| RTMPose-s (70 to 90 ms) | 1.32 px | 1.56 px | 1.27 to 1.31 px | 0.48° → 0.30 to 0.35° |
| RTMPose-m (165 ms) | 1.41 px | 1.72 px | 1.28 px | 0.52° → 0.27° |
| RTMW-x (1.4 s, one run) | 1.28 px | 2.43 px | 2.18 px | 0.71° → 0.60° |

Up to the 400 ms that the device check allows, fusion is now as stable as MediaPipe alone.
At 1.4 s per inference it is not, which is one more reason that configuration stays blocked.
This removes a cost of fusion. It does not show a benefit: whether the second model makes
readings more correct needs reference measurements on people, and RTMW-x on WebGPU is still
unmeasured. The small models stay out of the product for the same reason.

## Not tested

- Any real device: no laptop with a GPU, no phone, no real camera.
- The signed-in live session in `App.jsx` (it needs an account on the production Firebase project), and MediaPipe's GPU delegate in a worker on a real GPU.
- RTMW-x on WebGPU: speed, memory, and whether the 8 GB / not-a-phone limits are the right ones.
- Safari and Firefox. Only headless Chromium 153 was run.
- Download time on a real connection. At 10 Mbit/s, 229 MB is about 3 minutes; that is arithmetic, not a measurement.
- Moving subjects in the browser. Lag was measured on the synthetic subject only.
- Accuracy on people. A still photo with added noise measures stability, not correctness.
