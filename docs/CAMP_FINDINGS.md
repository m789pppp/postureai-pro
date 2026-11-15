# Camp findings

Each entry: date, device, browser, switches, what happened, numbers.
Guide: `docs/CAMP_SESSION.md` (on `origin/main`). No code changes until a problem is reproduced and written here.

## Session 2026-11-15 — step 1: live check (switches off, `diag` only)

- Live URL: https://postureai-pro-omega-nine.vercel.app/?exp=diag
- Deploy marker in localStorage (`__posmoz_deploy__`): `v583b5e9`
- `origin/main` at session start: `1a9f996`
- Browser: Claude desktop built-in browser — Chrome 156.0.8078.75 (Electron, `Claude/5.11492.5`), Windows 10/11 x64
- Device: tester's Windows laptop (model / CPU / GPU: to fill)

### F0 — housekeeping (not an app bug)
- The local project folder is on `cf7ebd2`, behind `origin/main` (`1a9f996`): it has no `CLAUDE.md`, no `docs/CAMP_SESSION.md`. Pull before any code change.

### Observations

#### F1: the `?exp=` switch is lost on the way to the app (reproduced, app bug)
- Steps: open `/?exp=diag` (landing page) → sign in → app goes to `/auth#live`.
- Result: `localStorage.posmoz_exp` = `null`, no diag panel in the DOM.
- Cause (from the code): `experiments.js` reads `location.search` and saves it only the first time `experimentEnabled()` runs, and nothing on the landing page calls it. By the time the analysis code first runs, the URL is `/auth#live` with no `?exp=`, so nothing gets saved.
- Effect: the documented way to turn on a switch ("open the site once with `?exp=a,b`") fails from the home page. Workaround for now: open `/auth?exp=diag#live` after signing in.

#### F2: the built-in browser blocks the camera (tooling, not an app bug)
- `/auth#live` shows "Camera access denied". `navigator.permissions` camera = `denied`. A `videoinput` device is present, but the Claude desktop browser pane does not allow capture.
- The app's error handling works: clear message, Retry button, "Low quality frame" under live metrics, no crash.
- Effect: step 1 (live check) cannot run in the built-in browser. It needs the tester's real Chrome.

#### F3: live check in Edge, 1 minute sitting still (switches off except `diag`)
- Browser: Microsoft Edge (Windows), opened at `/auth?exp=diag#live`. Diag panel showed, so the F1 workaround works.
- Diag readout (tester pasted from the Copy button):
  - analyses/s: **9.8** (not STALLED)
  - pipeline: `mp0.10.14-pose_full/gpu/main+face` (MediaPipe 0.10.14, full pose model, GPU delegate, main thread, face model also on)
  - experiments: `diag`
  - head pitch: `landmark_proxy` (head3d off, as expected)
  - third model: off (`slow_network`), set by `rtmwPolicy.js` from `navigator.connection.effectiveType`
  - script errors: none
- Rate vs target: with `adaptive` off the app aims for one analysis every 50 ms (`App.jsx` `analysisIntervalRef` = 50 → 20/s). Measured 9.8/s, about **half the target**. This fits the known weakness: pose + face on the main thread. The landing page says "~20 fps on-device", and this device does not reach that.
- Still to fill: skeleton tracking, score behaviour, any visible freeze.

#### F4: analysis rate drops over the session (seen, cause not confirmed yet)
- Same Edge session, read from the diag panel by screenshot (computer use, view only), 02:05–02:07:
  - session ~1 min: **9.8**/s (tester's paste)
  - ~5:00: 5.2 → 4.2 → 4.0 → 2.3 → 3.0 (one reading every ~10 s) → 4.1 at 6:02
- No STALLED and no script errors at any point. Pipeline unchanged (`gpu/main+face`).
- Possible confounds, to rule out before calling it an app bug:
  1. The Claude window covered half of the Edge window during part of the readings. Chromium on Windows can slow a partly hidden window.
  2. The screen captures themselves use CPU.
  3. The tester was moving around (adaptive is off, so stillness should not change the target rate).
- Retest needed: Edge maximised, nothing on top, 2 minutes still, no captures; read the rate at 0:30, 1:00, 2:00 (and 5:00 if possible).

#### F5: what the session showed (posture readings, tester on a sofa)
- Setup: laptop on a sofa, tester close to the camera, head and shoulders in frame, hips out of frame.
- Session summary at 4:57: average score 64, 76% good posture, 2 alerts:
  - "Very close (27cm) — move back to 50–100cm". The on-screen distance badge read ~45 cm and later ~64 cm. Need to measure the real distance with a ruler and compare (possible under-reading, or a brief lean-in).
  - "Both shoulders raised (15.2%)". The card said "Shoulders held up — Moderate, ~9.5% above relaxed position". At ~5:48 the ergonomic card had "Shoulder shrug: High" while the tester looked relaxed. It may be a false shrug when sitting close / low in the frame; to check against the bench "raise one shoulder" step.
- Also shown: "Head roll — Needs attention, eye line ~11° off level"; FHP badge 5.6 cm (+0.3 kg load).
- "Back lean" and "Rounding" showed "no view" with the hips out of frame. That is correct behaviour: unmeasured, not guessed.
- Skeleton: head and shoulder lines on the body in the capture at 5:48 (single frame, smoothness not judged).

#### F6: posture-by-posture walk-through, live app, watched by screenshot (02:10–02:14)
- Edge, `?exp=diag`, not calibrated (the tester skipped Calibrate), sofa, rate 4.4–4.7/s for the whole walk-through.
- Screenshots: `validation/camp/screens/` (not committed).
- Only postures 1–3 were captured. The tester did the rest faster than the capture loop ran, so postures 4–13 have **no record** and need a rerun.

| # | Posture asked | Time | Score | Biggest drop | Neck tilt | Sh. level | Sh. shrug | FHP | Dist | Alert / banner | an/s | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Neutral (sofa, not calibrated) | 0:51–0:59 | 69→82 | Forward head → Monitor height offset | Low→Med | Low | Low | 4.5 cm | ~74→~60 cm | none | 4.7/4.4 | FHP 4.5 cm while sitting upright; score moves 13 pts with no posture change |
| 2 | Head down ~15° (tester leaned in instead: face fills frame, head rolled ~25–30°, shoulders out of frame) | 1:30 | 60 | Shoulder elevation (shrug) | **Low** | Low | **High** | – | ~26 cm "back up" | "Too close — readings approximate" + bottom banner "…own" (start hidden behind diag panel) | 4.7 | **Shoulders not visible but shoulder level/shrug still scored (shrug High)**; neck tilt Low despite big visible head roll |
| 2b | Head down 15° (retry; head looks near level in frame, hand on chin) | 2:02 | 70 | Shoulder elevation (shrug) | Low | Low | **High** | – | ~36 cm "back up" | "Too close" + bottom banner "…own" still shown (hidden behind diag) | 4.7 | Shrug High holds whenever the shoulders sit at the bottom edge of the frame; banner "…own" persists across postures |
| 3 | Head down ~30° (one arm raised, hand behind head) | 2:34–2:37 | **76 "Good"** | Shoulder level → Forward head posture | **Low** | High | Med→High | **19.5 cm** (+2.9 kg) | ~61–62 cm | bottom banner "…own" | 4.6 | **Head down 30° not caught as neck tilt (Low)**: matches the landmark-proxy hypothesis. The drop shows up as FHP 19.5 cm instead (cross-talk). Score stays "Good". Shoulder level High is real (arm raised, shoulder line 9°) |

Takeaways from this walk-through (to check on the bench before any change):
- **A. Head down is missed as neck tilt** (posture 3): neck tilt Low, score "Good" 76. The drop moves into forward head (FHP 19.5 cm). Matches the CAMP_SESSION hypothesis for the landmark proxy. `head3d` should be tried on the same posture.
- **B. Shoulders are scored when they are not in the frame** (posture 2): shrug "High" with the shoulders out of view. Shrug stays High while the shoulders sit on the bottom edge (2b). This goes against "an unmeasurable metric is reported as unmeasured".
- **C. Neck tilt Low with a large visible head roll** (posture 2, ~25–30° roll).
- **D. The score moves 13 points while sitting still** (posture 1: 69→82), and FHP reads 4.5 cm sitting upright (not calibrated).
- **E. The diag panel covers the start of the bottom alert banner** ("…own"). The alert text can't be read while `diag` is on, and the banner stayed on screen across postures 2–3.
- **F. Rate** 4.4–4.7/s for the whole walk-through (target 20/s). See F4.

- Note: the local `.gitignore` (old checkout) does not list `validation/camp/`; `origin/main` does. Pull before committing so the screens stay out of git.

### Round 2 (02:19–, turn by turn, Edge normal window, not calibrated)
| # | Posture asked | Sess. time | Score | Neck tilt | Sh. level | Sh. shrug | Dist | Alert / strain | an/s | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | Neutral | 0:05 | 37 avg, 41 now "Poor" | Low | Low | "Settling" | ~41 cm (too close) | **"Forward head 31.1cm (~64° pitch, +5.9kg neck load) — raise monitor" Critical** | 3.1 | FHP 31 cm / 64° pitch claimed while sitting upright at ~41 cm. Not physically plausible; closeness likely inflates FHP |
| R2 | Head down 15° (looked more like ~30°, chin down) | 0:47 | **72 "Good"** (biggest drop: neck lean) | **High** ✓ | Low | **High** | ~35 cm | "Too close" | 3.9 | Neck tilt caught this time (round 1, p3: Low). Score still "Good" with a High neck fault; shrug High again with the shoulders at the bottom of the frame |
| R3 | Look up (tester did a big extension, ~40°+) | 1:21 | 67→70 "Good" (biggest drop: monitor height offset) | **Low** ✗ | Low | Low | **~104 cm "move in"** (was ~35 cm) | none for the neck | 3.8 | **Looking up is not caught at all** (matches the hypothesis). **Distance jumps 35→104 cm** when the head tilts back: the face looks smaller, so it reads as farther (cross-talk to distance) |
| R4 | Forward head (chin poke) | 1:58–2:00 | 75 "Good" (biggest drop: forward head) | Low | Low | Low | ~42 cm (too close) | FHP badge 7.7–7.9 cm (+0.8 kg); skeleton turns orange; no strain alert | 3.7 | Direction is right (FHP up, biggest drop = forward head), but the score stays "Good". Compare R1: 31 cm FHP claimed while sitting upright, so FHP is not consistent between neutral and an actual chin poke |
| R5 | Head tilt right (tester did a big ~35–40° side bend) | 2:34 | **52 "Poor"** (biggest drop: neck lean) | **High** ✓ | Low ✓ (shoulder line 2°) | Low ✓ | ~76 cm | – | 4.4 | Caught correctly, no cross-talk to the shoulders. (Compare round 1 p2: a ~25–30° roll read Low, so a smaller tilt may be missed) |
| R6 | Head tilt left, small 15° (tester bent the whole upper body sideways instead) | 3:12 | **40 "Poor"** (neck lean) | High | **High** (line 10°) | **High** | ~74 cm | – | 4.2 | Whole-body side lean reads as neck tilt + uneven shoulders + shrug. Back lean shows "no view", so the trunk lean itself is never named (matches the "lean sideways 12°" hypothesis). Shrug High is likely cross-talk |
| R7 | Turn head right ~30° (in frame: small turn, head a little down, hand on cheek) | 3:47 | 83 "Good" (biggest drop: **head turn** ✓) | Low | Low | Low | ~76 cm | – | 4.4 | Turn is noticed as the biggest drop and nothing else lights up. Hand on face may affect the face landmarks |
| R8 | Turn head left ~30° (in frame: small turn, eyes down) | 4:23 | 69 "Fair" (biggest drop: head turn ✓) | Med | Low | Low | ~63 cm | – | 4.6 | Turn noticed; neck tilt Med, probably from the slight head-down |
| R9 | Raise one shoulder (tester raised the whole arm behind his head) | 4:56 | 68 "Fair" (biggest drop: forward head) | Low | **Low ✗** (line 3°) | **Low ✗** | ~59 cm | FHP badge 11.7 cm (+1.2 kg) | 4.5 | **Raised shoulder not caught**: the shoulder line reads 3°. FHP rises to 11.7 cm instead (cross-talk). Compare round 1 p3: the same arm-behind-head pose gave shoulder level High, so the result is not repeatable |
| R9b | Raise right shoulder, hands down | 5:32 | 68 "Fair" (biggest drop: **forward head** ✗) | Med | **Med** (line **15°**) | Med | ~63 cm | – | 3.3 | Seen, but a 15° shoulder line only gets "Med", and the headline cause is forward head, not the shoulder. Neck tilt Med is cross-talk |
| R10 | Lean toward the screen | 6:06–6:09 | 77 "Good" (forward head) | Low | Low | Low | **~31–35 cm "back up"** ✓ | "Too close" banner ✓, FHP 7.7→6.2 cm | 3.4 | Closeness caught correctly; the rest stays Low. A whole-body lean-in also reads as forward head (FHP 6–8 cm) |
| R11 | Slouch (slumped low into the sofa, farther from the camera) | 6:44–6:46 | **77 "Good"** | Low | Low | Low | **badge ~31→25 cm "back up"** while the face is clearly smaller/farther than in R10 | "Too close" banner still on | 3.2 | **Slouch not detected at all**: everything Low, FHP falls to 2.4 cm, Rounding/Back lean "no view". **The distance badge is wrong or stuck**: it says too close while the tester has moved back. The "Too close" banner stays after leaning back |
| R12 | Neutral again (same as R1) | 7:21–7:24 | 77 "Good" (forward head) | Low | Low | Low | badge ~31→35 cm "back up" | "Too close" banner | 3.1 | **The ergonomic card has shown the same thing for R10, R11 and R12 (~80 s)**: 77 "Good", forward head, all Low, "Too close". The skeleton still follows the body. Card and distance badge look **stuck** (or very slow) while the pose overlay updates. Rate has slid from 4.6 to 3.1/s |
| R13 | Check for a stuck card: big head tilt right (also turned) | 7:54–8:02 | **93 "Excellent"** (biggest drop: head turn) | **High** | Low | Low | ~56 cm (badge updated) | – | 3.2 | **The card is not stuck**: it changed within 15 s, so R10–R12 were real (if odd) readings. New contradiction: **neck tilt High with "Excellent" 93** |

Round 2 takeaways (rank by impact; each needs a bench recording before any change):
1. **The score does not follow the faults.** "Good"/"Excellent" (72–93) with neck tilt High (R2, R13); "Good" 76–77 with a missed slouch (R11) and head-down (round 1 p3). Look at how the score is built from the metric severities.
2. **Slouch not detected at all** (R11): all Low, FHP even drops. Rounding/Back lean are always "no view" with hips out of frame, so a laptop user sitting on a sofa has nothing that catches slouch.
3. **Looking up not detected** (R3), and head-down detection is not repeatable (round 1 p3 Low vs R2 High). This is the landmark-proxy weakness: try `head3d` on the same postures.
4. **Distance tied to face size**: 35→104 cm when looking up (R3); "too close 25 cm" while slumped back (R11). Every distance-based alert and the FHP cm estimate inherit this.
5. **FHP not consistent**: 31 cm / 64° claimed sitting upright at ~41 cm (R1), 7.7 cm for a real chin poke (R4); rises with head-down (19.5 cm), arm-raise (11.7 cm) and lean-in (6–8 cm). Too many postures leak into FHP.
6. **Shoulder**: 15° line only "Med" and not the headline (R9b); arm-behind-head 3° Low in R9 vs High in round 1, not repeatable; shrug "High" when the shoulders are at the frame edge (round 1). Matches the "moderate but alert only above 10°" hypothesis.
7. **Side lean** of the trunk is split into neck tilt + shoulder level + shrug, never named (R6).
8. **Works**: big head tilt (R5), head turn L/R (R7, R8), lean toward the screen → "too close" (R10).
9. **Rate** 3.1–4.6/s across 8 minutes (target 20). The diag panel says STALLED while paused, which is expected but reads like an error.
- Caveats: not calibrated, sofa, distance often under 50 cm, tester's postures often bigger than asked, and no hand-measured angles. The bench recording (`/bench.html`, chair, inclinometer) is still needed before any change.

## Proposed priority order (2026-11-15, waiting for the tester's agreement, no code changed)

Ranked by what a user sees wrong × how often × how sure we are of the cause. Each fix goes behind a switch and is judged with `replay-bench.mjs --compare` on a bench recording first.

| # | Problem | Evidence | Likely cause (from the code, to confirm) | First move |
|---|---|---|---|---|
| P1 | Score says Good/Excellent while a fault reads High | R2 72, R13 93 with neck High; R11, round 1 p3 | `analyzeMP` score is a weighted average (neck 0.14, tilt 0.067…). The "severity floor" caps the score at 69 only for a **severe** fault held for `ALERT_DWELL_MS`, so a moderate/"High" fault barely moves the score | Switch: extend the floor to a sustained moderate fault (cap at Fair). Replay must show no new false lows on neutral |
| P2 | Head pitch: looking up missed, head-down not repeatable | R3, R2 vs round 1 p3 | Landmark proxy (known: reads 30° as ~9.5°, blind to looking up) | Already built: test `?exp=head3d` live and on the bench. No new code |
| P3 | Distance follows face size | R3 35→104 cm, R11 "25 cm" while slumped back | `estimateDistanceCm` uses eye spacing corrected for yaw only, not pitch or lean; feeds the "too close" alert and the FHP cm estimate | After P2: correct for pitch, or hold distance while the head is pitched |
| P4 | Forward-head (FHP) unstable and leaks from other postures | R1 31 cm upright; 19.5 / 11.7 / 6–8 cm from head-down, arm-raise, lean-in | Partly inherits P2/P3; Z channel noisy | Re-measure after P2+P3 before touching it |
| P5 | Slouch not caught with hips out of frame | R11 all Low | Rounding/back lean need hips; nothing else carries slouch for a laptop-on-sofa user | Design: a calibrated-neutral signal (head/shoulder drop vs the user's own neutral). Biggest piece of work |
| P6 | Shoulder: 15° only "Med", not the headline; shrug false at frame edge | R9b, round 1 p2 | Thresholds (alert above 10°, known); shoulders near the frame edge still treated as reliable | Threshold switch + mark shoulders unreliable near the frame edge |
| P7 | Trunk side lean spread over neck/shoulder/shrug | R6 | Spine lean needs hips | Comes with P5 |
| T1 | Analysis rate 3–5/s vs 20 target | F3, F4, round 2 | Pose + face on the main thread | Already built: test `?exp=worker` live, then `/perf.html` |
| T2 | `?exp=` lost on the way from landing to app | F1 | `experiments.js` reads the URL lazily | Small fix: read `?exp=` once on first page load |
| T3 | Diag panel covers the start of the alert banner | round 1 E | Overlay position | Small CSS move |

Suggested order: T2 → P2 + T1 (switches that already exist, live check only) → bench recording (chair, inclinometer) → P1 → P3 → P4 → P6 → P5/P7.

## Camp plan: field-ready model (started 2026-11-15)

Branch: `camp/field-ready` (from `origin/main` 9e9a7cc). One PR per step; nothing reaches everyone before it is tried live with `?exp=`.

**Field-ready exit criteria** (internal targets for the bench replay and live tests; never shown as accuracy figures in the UI):
1. Each of the 13 bench postures: the expected alert holds for most participants, and cross-talk to other postures is rare.
2. Neutral, 2 minutes still, calibrated: no alert, score steady (spread within a few points).
3. A sustained moderate or severe fault never shows as Good/Excellent.
4. Distance and FHP do not jump when only the head pitches or the trunk leans.
5. A metric whose body part is out of frame reads as unmeasured.
6. Live rate on the tester's laptop at least 15/s, no STALLED, no freeze over a 10-minute session.
7. Every `CLAUDE.md` check passes.

**Phases**
- 0. Sync + tooling: T2 (done on branch), T3.
- 1. Try the switches that already exist live: `head3d` (P2), `worker` (T1).
- 2. Data: `/bench.html` on a chair with an inclinometer. Tester first, then as many other people as possible (5–10), saved under `validation/camp/`.
- 3. Engine, one switch each, judged with `replay-bench.mjs --compare`: P1 → P3 → P4 → P6 → P5/P7.
- 4. Performance: T1 follow-up (face model rate, worker), `/perf.html` before/after.
- 5. Field trial: switches on for the testers for a few days; diag Copy reports collected here.
- 6. Separate PRs turn the proven switches on by default, with before/after tables.

### Progress
- 2026-11-15: T2 fixed: `main.jsx` reads `?exp=` on first load. `test:posture` 114/114, `test:guard` 9/9, `test:claims` 35/35, `vite build` OK (built in a clean clone; the local `node_modules` were installed on Windows and can't run vite in the Linux shell).
- 2026-11-15: **End-of-session summary shortened**: score ring, three stats, then "Your top issues", at most 3, each a title + severity + one short line on what to do (`FindingsPanel` variant `summary`, `shortAction()`). Removed from the modal: top-issue box (a duplicate), full finding cards, trend badge, improvement tip, pain summary. Full detail stays on the live screen and in the PDF.
- 2026-11-15: **Summary accuracy bug found and fixed**: the summary's findings came from the **last analysed frame** (`lastAnalRef`), i.e. the moment of reaching for Stop & Save. New `lib/sessionFindings.js` aggregates every frame. A metric is reported at the worst severity it held for at least 20% of its measured frames; never-measured stays unmeasured. Tests: `sessionFindings.test.mjs` 10/10. All `CLAUDE.md` checks pass; build OK (clean clone).
- 2026-11-15: **P1 cause found**: the engine already caps the score (84 while a moderate fault lasts, 69 for severe). But the live HUD's Low/Med/High rows come from **score bands** (score < 55 = "High"), not from the engine's severity. A row can read "High" while the engine calls it mild, so no cap applies and the score shows "Excellent" (R13). Two graders on one screen. New switch **`sevlabel`**: the rows use the engine's severity (normal/mild → Low, moderate → Med, severe → High). Off by default; try with `?exp=diag,sevlabel`. Checks pass, build OK.
- 2026-11-15: **False shrug with the shoulders out of shot, reproduced and fixed behind a switch.** With the face close, the shoulders leave the frame downwards and the tracker pins them to the bottom border. The ear-to-shoulder gap shrinks and reads as a shrug: the shipped engine reads **11.1% "moderate"** on the synthetic subject. `shAtEdge` only checked the left/right borders. New switch **`edge`**: a shoulder at the bottom border makes shoulder shrug and shoulder level unmeasured. 3 new checks in `postureEngine.accuracy.mjs` (117/117). `replay-bench.mjs --compare edge` supported.
- 2026-11-15: **Diag panel moved to bottom-right** (above the full-screen button) so it no longer covers the alert banner.
- 2026-11-15: **Probed on the synthetic subject, not changed:**
  - Distance moves only 54→65 cm when looking up 45°; the real 35→104 cm jump (R3) is not reproduced, likely eye landmarks lost with glasses/extension.
  - A synthetic forward slouch (trunk 20°) is caught via FHP (score 66). The tester's R11 was a recline / sacral slump, which reads all-normal (97).
  - These need the bench recording before any change: P2 head pitch (`head3d` exists), P3 distance, P4 FHP, P5 slouch/recline.
- 2026-11-15: **Implausible forward head, reproduced and guarded behind a switch.** R1's "Forward head 31.1cm (~64° pitch)" Critical alert, 5 s into the session sitting upright: `atan2(31.1, 15)` = 64°, so the number was the FHP cm. The depth path is capped at 25 cm, so it came from the `analyzeFHP` fallback used before the depth baseline exists. That fallback has no upper bound: the shipped engine reads **52.5 cm** for a synthetic 30 cm forward head at 60 cm. New switch **`fhpguard`**: past 15 cm (beyond what a seated person can hold) FHP is unmeasured. Below that the fallback still counts, because for someone who sits head-forward from the start it is the only FHP reading. 2 new checks (`test:posture` 119/119).
- 2026-11-15: **"Biggest drop" headline under `sevlabel`** ranks by the engine's severity first, as the findings do, then by score. By score alone, R9b's severe 15° shoulder lost the headline to a moderate forward head.

### Screenshot → finding → action map (all camp screenshots, 2026-11-15)
| Screenshot | What it shows | Action |
|---|---|---|
| f2_builtin_browser_camera_denied | Camera blocked in the Claude browser pane; app error handling fine | none (tooling) |
| f5_session_summary_4m57 | Summary listed a 27 cm "very close" alert while the badge read 45–64 cm | summary now from the whole session (`sessionFindings`) |
| f4_live_5m48, p2_head_down15_too_close, p2b | Shrug "High" with the shoulders out of / at the bottom of the frame | `edge` switch |
| p3_head_down30, r2_head_down | Head down: neck Low once, High once; FHP 19.5 cm cross-talk | `head3d` (exists) + `fhpguard` caps the 19.5 |
| r1_neutral_fhp31 | 31.1 cm / 64° Critical sitting upright at session start | `fhpguard` |
| r3_look_up | Looking up not caught; distance 35→104 cm | `head3d`; distance needs a bench recording (not reproduced on the synthetic subject) |
| r4_forward_head | Real chin poke 7.7 cm, direction right, score still "Good" | `sevlabel` + score caps |
| r5_tilt_right | Big head tilt caught correctly | – |
| r6_side_lean | Trunk lean split into neck + shoulder + shrug | needs hips or a new signal (P7) |
| r7/r8_turn | Head turn caught correctly | – |
| r9_arm_raised, r9b_shoulder_raised | 15° shoulder only "Med", headline forward head | `sevlabel` (rows + headline) |
| r10_lean_in | Too close caught correctly | – |
| r11_slouch | Recline/sacral slump: everything Low, distance "25 cm" while farther | P5: needs a bench recording + design |
| r12_neutral_again | Same card as R10/R11 (looked stuck) | checked in R13: not stuck |
| r13_tilt_excellent93 | Neck High with score 93 "Excellent" | `sevlabel` |
- 2026-11-15: **Trunk side lean (P7), reproduced and fixed behind a switch.** At laptop distance spine lean is unmeasured even on the synthetic subject. A 10° whole-trunk lean read as head tilt **severe** + shoulder level moderate + neck lean mild (score 79): the user was told to fix the neck while the real cause, sitting off-centre, was never named. New switch **`trunklean`**: when the eye line and the shoulder line tilt the same way by about the same angle (within 4°, at least 5°), it is one spine-lean finding estimated from the shoulders, and head tilt and neck lean are measured relative to the shoulders. One raised shoulder with a level head stays a shoulder finding. 4 checks.
- 2026-11-15: **`modcap` switch**: the score is capped at 84 while a moderate fault lasts (until now only `head3d` did this). With `trunklean` alone a moderate lean still scored 95; with both it is ≤ 84. 1 check (`test:posture` 124/124).
- 2026-11-15: **`?exp=camp`** turns on every camp switch plus diag: `diag, sevlabel, edge, fhpguard, trunklean, modcap, head3d`.
- Not changed, with reasons:
  - **Distance jump (P3)**: the eye-landmark fallback gives the right distance on the synthetic subject (45/60/80 cm), so the real 104 cm is not reproduced.
  - **Recline/sacral slump (P5)**: there is no way to tell it from simply sitting farther back without a recording.
  - **Rate (T1)**: the face model already runs every 2nd frame; the `worker` switch exists and should be measured live with `/perf.html` before any change.

## OpenSim fixture (2026-11-15)

A second, independent synthetic subject built in OpenSim 4.6 (`validation/opensim/`): a seated upper-body model with pelvis, lumbar, lower-neck (C7) and head-nod (C1) joints, shoulder elevation and protraction, and markers at the MediaPipe landmark sites. It covers 14 postures × 6 bodies (including two eye heights) × 3 cameras, replayed through the engine's own camera projection (`frontend/scripts/opensim-replay.mjs`). It tests geometry only, not clinical accuracy.

**What it found in the shipped engine**
1. **A head tilt reads as a shrug.** A 15° head tilt raised a "mild" shoulder elevation in every body and camera. Elevation is the larger of the two ear-to-shoulder gaps' shrinkage, and a tilt brings one ear down. Fixed behind **`tiltguard`**: when the eye line is tilted against the shoulder line, only the gap change common to both sides counts.
2. **The landmark head-pitch proxy depends on face anatomy.** With the eyes 1 cm higher or lower above the ears than the engine's own fixture, `monitor_height` reads ~14° ("mild") sitting upright. When the fixture first placed the eyes 2.5 cm lower by mistake it read 40° (severe), which caps the score at 69. This is the same weakness as the camp's "monitor height offset" headlines. `head3d` (learned personal neutral from the face model) reads 0 at neutral in every body.
3. **Recline/sofa slump** was caught in 50% of cases, and only through other metrics. Rounded shoulders: 0% (needs the hips).

**Learned layer: `slump` switch (experimental)**
- `features/analysis/slumpModel.js`: six scale-free face/shoulder features against the user's first seconds, softmax regression over neutral / slouch forward / recline / lean to screen / head down.
- Trained on OpenSim samples only (`scripts/train-slump.mjs`): held-out 88%, out-of-distribution bodies and cameras 79%. Neutral is almost never flagged (held-out 0/200, OOD 3/190).
- Never seen a real person, so it must be checked on real recordings before it goes to anyone. It produces the `slump_posture` finding (no number shown), and head-down is left to the neck metrics.
- Replay, camp switches: recline 50% → **100%**, slouch 67% → 78%, lean to screen 61% → 83%; no slump finding at neutral or on tilt/turn/shrug.

**Still weak on this fixture:** head down 15° (camp 33%, shipped 44% via the anatomy-biased proxy), chin poke (44%), rounded shoulders (0%). Head-tilt noise at the 3° mild threshold shows in 2 of 18 cases.

`?exp=camp` now also turns on `tiltguard` and `slump`. New checks: `npm run test:opensim` (6 replay checks + 9 slump-model checks).
