# Camp session: guided testing in the browser

Read this first when a session starts the camp testing. It carries the state that the
earlier session built up, so the new one does not have to rediscover it.

## Where things stand

- Live site: https://postureai-pro-omega-nine.vercel.app
- Pushes to `main` deploy to production (about 11 minutes, built on Vercel). The
  "Deploy Firestore rules" job always fails until the `FIREBASE_SERVICE_ACCOUNT_JSON` and
  `FIREBASE_PROJECT_ID` repository secrets exist; look at the "Deploy production" job.
- Real users reported errors, freezing and worse readings after #7, #10 and #11. Those
  changes were then put behind switches that are **off by default** (#12). Whether that
  fixed the reports is not yet confirmed.

## Switches (`frontend/src/features/analysis/experiments.js`)

Off for everyone. A device turns them on by opening the site once with `?exp=a,b`
(remembered on that device); `?exp=off` clears them.

| Switch | What it does |
|---|---|
| `diag` | on-screen panel: analyses/s or STALLED, pipeline id, experiments, head-pitch method, third-model state, script errors, Copy button |
| `worker` | pose and face inference in a Web Worker |
| `adaptive` | lower analysis rate while the person is still |
| `head3d` | head pitch scored from the face model's 3-D pose with a neutral learned over the first 30 s; score capped at 84 while a moderate fault lasts |

## Tool pages on the live site

- `/perf.html`: repeatable speed / memory / stability benchmark. Sit still, press Start,
  download the JSON. `?pipeline=mp` or `?pipeline=fused&wait=rtmw`.
- `/bench.html`: Posmoz Bench recorder. Nine postures, each with a hand-measured value
  (phone inclinometer for angles, ruler for cm). Downloads one JSON per person.
  `python -m ai.bench_train --sessions <dir> --participants participants.csv` (from
  `backend/`) writes `bench_report.md` and `correction.json`.

## Known weaknesses

- The face model runs on the main thread beside the pose model (from #6). On a weak
  machine this stalled the page (33 stalls over 100 ms in 15 s in the benchmark). Likely
  part of the freezing. Options: run it less often, or put it behind a switch.
- Head pitch without `head3d` comes from a landmark proxy that reads a true 30° as about
  9.5° and does not react to looking up.
- Everything was measured on one cloud machine without a GPU, on still photographs.

## How to run the guided test

Use the built-in browser on the live site. One step at a time; after each step write the
result to `docs/CAMP_FINDINGS.md` (date, device, browser, switches, what happened, diag
text, screenshot description). Do not change code until a problem is reproduced and
written down.

1. **Baseline, switches off.** Sign in, start a session, one minute still. Record whether
   it runs, analyses/s from `?exp=diag`, any errors, and how the score behaves.
2. **Movements.** Look down slowly, look up, tilt left and right, lean in, lean back,
   slouch. For each: does the skeleton follow, does the right alert appear, how long does
   it take, does anything freeze.
3. **Each switch alone** (`diag,worker`, `diag,adaptive`, `diag,head3d`), repeating 1–2.
4. **Long run.** Ten minutes with switches off: memory and analyses/s at the start and end.
5. **Bench.** If the person has an inclinometer app, record `/bench.html` for them.

## Rules that do not change

- Follow `CLAUDE.md`. Work on a branch, open a PR.
- Nothing new reaches every user until it has been tried on a real device with `?exp=`.
- No accuracy percentages, diagnosis wording or "clinically proven" claims in UI text.
- Bump `MEASURE_VERSION` in `clinicalMeasure.js` when what reaches it can change.
