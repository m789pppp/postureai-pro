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

## The analysis loop

The session acts as the scientific analyst: the tester moves, the session measures, keeps
the record, finds the problems, fixes them, and the tester checks the fix. Every finding
is written to `docs/CAMP_FINDINGS.md` (date, device, browser, switches, what happened,
numbers). No code changes until a problem has been reproduced and written down.

### 1. Live check (switches off)

Built-in browser on `/?exp=diag`. Sign in, start a session, one minute still. Record
analyses/s, any errors, whether the skeleton follows and how the score behaves. If it
stalls or errors, that is the first problem; stop and fix it before measuring accuracy.

### 2. Record every posture with `/bench.html`

Thirteen steps (bench v2): neutral, head down 15° and 30°, look up, forward head, tilt
left and right, turn left and right, lean sideways, raise one shoulder, lean toward the
screen, slouch. For each the tester holds the posture and types the value measured by
hand: a phone inclinometer held flat against the side of the head (zeroed while sitting
upright) for angles, a ruler along the desk edge for centimetres. Looking up is entered
as a negative number. Each person gives one JSON file: save them under
`validation/camp/` (not committed; it is in `.gitignore`).

### 3. Replay the engine over the recordings

```
cd frontend
node scripts/replay-bench.mjs ../validation/camp                    # engine as shipped
node scripts/replay-bench.mjs ../validation/camp --compare head3d   # same frames, with and without a switch
```

For every posture of every person: whether an expected alert held (≥40% of the frames
after the first 1.5 s), cross-talk (an alert that belongs to another posture), the
engine's reading against the measured value, and the score. This runs the same pipeline
as the live app after the camera (smoothing, then `analyzeMP`), so a change to the engine
can be judged on the same real people without recording again.

### 4. Fix, compare, ship behind a switch

1. Take the worst row of the summary (most people missed, or most cross-talk).
2. Change the engine behind a new switch in `experiments.js`.
3. `replay-bench.mjs --compare <switch>`: the target posture must improve, and no other
   posture may get worse (catches, cross-talk). Add a synthetic check to
   `postureEngine.accuracy.mjs`.
4. Run every check in `CLAUDE.md`, open a PR, merge.
5. The tester tries `/?exp=<switch>` live and repeats step 2 for that posture.
6. Only when both the replay and the live retest are better: a separate PR turns the
   switch on by default, with the before/after table.

### Hypotheses to check first (seen on the synthetic subject, not yet on people)

Run on a synthetic bench session; each needs a real recording before anything changes.

| Posture | What the engine did |
|---|---|
| Head down 30° | read about 9°, no alert (landmark proxy); `head3d` reads 30° and alerts |
| Look up 20° | read about −5°, no alert; `head3d` reads −20° and alerts |
| Head down 30°, forward head 5 cm | "too close" (`dist_c`) fired: the face gets bigger in the frame |
| Forward head 5 cm | reading right (4.7 cm), no forward-head alert |
| One shoulder 7–10° higher | severity "moderate", but the alert only fires above 10° |
| Lean sideways 12° | hips out of frame: reported as uneven shoulders and head tilt, spine lean reads 0 |
| `head3d` neutral | the 30 s learner averages whatever the person does in the first 30 s; several postures in that window pull it |

## Rules that do not change

- Follow `CLAUDE.md`. Work on a branch, open a PR.
- Nothing new reaches every user until it has been tried on a real device with `?exp=`.
- No accuracy percentages, diagnosis wording or "clinically proven" claims in UI text.
- Bump `MEASURE_VERSION` in `clinicalMeasure.js` when what reaches it can change.
