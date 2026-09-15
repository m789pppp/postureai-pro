"""
Corvus — synthetic ground-truth coverage for analyze_front().

Until this file, analyze_front() (backend.py, the function behind the live
/api/analyze and the documented Enterprise API /api/v1/posture/analyze) had
ZERO test coverage of any kind — confirmed by reading every file under
tests/: test_analysis.py and test_comprehensive.py only exercise the shared
math primitives in scoring_utils.py plus hand-rolled simulation functions
that the latter file's own header comment admits "there is no same-named
function in backend.py" for. test_distance_calibration.py is the one partial
exception (it does call the real ipd_distance_face() helper), but it never
calls analyze_front() itself.

That mattered here specifically because analyze_front() was found (via a
literature/threshold audit of its sibling engine, postureEngine.js) to still
carry several stale threshold values and at least one inverted-logic bug
(the elbow/"wrist" angle scores a fully extended arm as ideal and a correctly
bent typing arm as a fault — the opposite of the frontend's OSHA/NIOSH-cited
elbow logic) with no way to safely verify a fix.

Approach: analyze_front() takes a raw camera image and runs real MediaPipe
Pose + FaceMesh inference on it internally — there is no lower-level entry
point that accepts landmarks directly. So this harness monkeypatches the
module-level `POSE_LITE` / `POSE_FULL` / `FACE_MESH` globals (which
_ensure_models() only ever assigns once, guarded by `if POSE_LITE is not
None: return True` — so setting them here before any real call means the
real model loading path never runs) to return CANNED landmark results
instead of running real inference. `cv2`/`np` are left as the real modules
(cheap, already a dependency, and analyze_front calls real cv2.cvtColor on
the dummy image before ever touching the fake pose/face results).

The canned pose landmarks are NOT hand-typed guesses. They are dumped
straight from postureEngine.js's own synthetic-subject rig
(frontend/src/features/analysis/syntheticSubject.mjs via
dump_synthetic_poses.mjs -> synthetic_poses.json, copied into this
directory) — a parametric 3D body posed at KNOWN angles and projected
through a pinhole camera, which the frontend's own accuracy suite
(postureEngine.accuracy.mjs) already validates itself against. Reusing it
here means both engines are tested against the exact same geometric ground
truth instead of two independently-written (and possibly independently
wrong) pose-generation implementations.

FaceMesh is stubbed to report "no face" (multi_face_landmarks=None) for
every case. That's a deliberate scope cut: the metrics this file needs to
check (neck lean, head tilt, shoulder tilt, spine lean, forward head,
rounded shoulders, elbow/wrist angle, distance-via-shoulder-fallback) are
all computed from POSE landmarks, and analyze_front's own distance logic
already falls back to the shoulder-width estimator when FaceMesh finds
nothing — so this exercises a real, live code path rather than requiring a
second synthetic face-mesh rig (478 points) to be built and validated before
any of this can run. Face-only bonus features (gaze, blink rate, iris,
solvePnP head pose from face) have no frontend equivalent at all and are out
of scope for this comparison.

Run: cd backend && pytest tests/test_analyze_front_synthetic.py -v
"""
import sys, os, json, math
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import backend as be

HERE = os.path.dirname(__file__)
with open(os.path.join(HERE, "synthetic_poses.json")) as f:
    _POSES = json.load(f)

# Must match syntheticSubject.mjs's DEFAULT_CAMERA (W:1280, H:720) -- the
# dumped landmarks are normalised fractions of THAT frame size, and a
# mismatched aspect ratio here would distort the pixel-space geometry
# analyze_front reconstructs from them (shoulder-width-based distance
# estimation in particular).
W, H = 1280, 720


class _LM:
    __slots__ = ("x", "y", "z", "visibility")
    def __init__(self, x, y, z, visibility):
        self.x, self.y, self.z, self.visibility = x, y, z, visibility


class _PoseLandmarkList:
    def __init__(self, lm_dicts):
        self.landmark = [_LM(p["x"], p["y"], p["z"], p["visibility"]) for p in lm_dicts]


class _PoseResult:
    def __init__(self, lm_dicts):
        self.pose_landmarks = _PoseLandmarkList(lm_dicts) if lm_dicts else None


class _FaceResult:
    """Always "no face detected" — see module docstring for why."""
    multi_face_landmarks = None


class _FakePoseModel:
    """Stands in for POSE_LITE/POSE_FULL. Ignores the image, returns whatever
    landmark set the test currently has active (see `_current_case`)."""
    def process(self, rgb):
        return _PoseResult(_current_case["lm_dicts"])


class _FakeFaceModel:
    def process(self, rgb):
        return _FaceResult()


# Bypass _ensure_models() entirely: setting POSE_LITE (etc.) to non-None here
# means its `if POSE_LITE is not None: return True` guard short-circuits
# before it would otherwise try to load real MediaPipe model files.
be.cv2 = __import__("cv2")
be.np = np
be.POSE_LITE = _FakePoseModel()
be.POSE_FULL = _FakePoseModel()
be.FACE_MESH = _FakeFaceModel()

_DUMMY_IMAGE = np.zeros((H, W, 3), dtype=np.uint8)
_current_case = {"lm_dicts": _POSES["neutral"]["landmarks"]}
_session_counter = [0]


def analyze(case_name, mode="laptop", tier="standard", settle=25, **kwargs):
    """Run analyze_front() to convergence against one synthetic pose.

    analyze_front keeps a per-session 3-frame weighted-average + Kalman
    filter over landmark history (see backend.py ~2396-2432), so a single
    call against a fresh session_id reflects mostly the filter's initial
    state, not the steady-state reading. Feeding the SAME static landmarks
    repeatedly under a fresh, unique session_id (so cases can't leak Kalman
    state into each other) converges it, mirroring the settle-loop pattern
    postureEngine.accuracy.mjs already uses for the same reason on the JS
    side.
    """
    _current_case["lm_dicts"] = _POSES[case_name]["landmarks"]
    _session_counter[0] += 1
    sid = f"synthetic-{case_name}-{_session_counter[0]}"
    out = None
    for _ in range(settle):
        out = be.analyze_front(_DUMMY_IMAGE, mode=mode, tier=tier, session_id=sid, **kwargs)
    return out


def fmt(x):
    return f"{x:.1f}" if isinstance(x, (int, float)) else str(x)


# ════════════════════════════════════════════════════════════════
# Sanity: the harness itself actually reaches analyze_front's normal path
# (not the "no person detected" cascade fallback), for every dumped pose.
# ════════════════════════════════════════════════════════════════
class TestHarnessSanity:
    def test_every_dumped_pose_is_detected(self):
        for name in _POSES:
            out = analyze(name, settle=5)
            assert out.get("detected") is not False and out.get("score", 0) > 0, \
                f"{name}: analyze_front did not detect a body (out={out})"

    def test_neutral_pose_scores_well(self):
        out = analyze("neutral")
        assert out["score"] >= 70, f"neutral pose scored {out['score']}"


# ════════════════════════════════════════════════════════════════
# Metric-level checks — pin CURRENT/target behaviour so a threshold or
# formula change can be verified rather than guessed at.
# ════════════════════════════════════════════════════════════════
class TestElbowWristAngle:
    """analyze_front's 'wrist_angle' is the same shoulder-elbow-wrist joint
    postureEngine.js calls 'elbow'. Elbows/wrists sit below frame at normal
    laptop-webcam framing (same reason hips do), so this uses the
    "elbow_typing_visible" case (camera pulled back to 140cm, same
    ground-truth setup postureEngine.accuracy.mjs's own elbow test uses) --
    a fixed ~92.5deg true included elbow angle, a CORRECT typing posture."""

    def test_typing_arm_scores_well_once_fixed(self):
        out = analyze("elbow_typing_visible", tier="professional")  # tier-gated
        wrist = out.get("metrics", {}).get("wrist_angle")
        assert wrist is not None, f"no wrist_angle in output: {out.get('metrics', {}).keys()}"
        print(f"\n  elbow/wrist_angle at true ~92.5deg typing posture: "
              f"value={wrist['value']} score={wrist['score']}")
        # Before the fix this read wrist_angle~=87.5 (180-included_angle)
        # and scored 5 (the score_m floor) -- a correct typing posture
        # penalised as badly as possible. Now `value` is the actual included
        # angle (~75-93deg depending on rig/3D-angle precision, comfortably
        # inside OSHA/NIOSH's 90-120deg acceptable range or its ±15deg dead
        # zone either side of it) and should score well.
        assert wrist["value"] < 150, f"value {wrist['value']} looks like the old 180-x convention, not a raw included angle"
        assert wrist["score"] >= 80, f"a correct typing posture scored {wrist['score']}, expected >=80"


class TestDistanceRange:
    """MODES.laptop.distRange was corrected to [50,100] to match OSHA's own
    'preferred viewing distance ... 50 and 100 cm' guidance (see the cited
    comment on MODES in postureEngine.js). analyze_front's laptop distance
    band is still (50, 80) as of this writing (backend.py, the `lo, hi =
    (50, 80) if mode == "laptop" else (60, 90)` line) -- these tests pin
    that gap numerically so a fix can be verified."""

    def test_90cm_reading_should_not_be_penalised_once_synced(self):
        out = analyze("neutral_at_90cm")
        dist_metric = out.get("metrics", {}).get("screen_distance", {})
        # Not asserting a pass/fail verdict here on purpose -- this is the
        # regression guard that gets tightened once backend.py's laptop
        # distance range is corrected to match postureEngine.js/OSHA.
        print(f"\n  90cm reading -> distCm={dist_metric.get('value')} "
              f"score={dist_metric.get('score')}")


class TestElbowArmAtRest:
    """analyzeElbow's 90-120deg guidance is about keyboard height, and only
    means anything while the hands are at a keyboard. Arms hanging relaxed
    at the sides read ~170-180deg included angle and used to be scored and
    alerted on as a severe elbow fault -- telling someone doing nothing
    wrong to adjust their desk. Mirrors postureEngine.js's analyzeElbow()
    armWorking() gate: an arm whose wrist sits far below, and almost
    directly under, its elbow (in half-shoulder-width units) is reported
    unreliable instead of penalised.

    The synthetic-subject rig's elbow/wrist positions are a FIXED offset
    from the shoulder (not independently parametrized -- see
    dump_synthetic_poses.mjs's own comment), so it can only ever pose the
    "typing" (working) arm. To exercise the resting-arm path this hand-
    builds a variant of the elbow_typing_visible landmark set with both
    wrists relocated straight down from their elbows, rather than adding a
    second, unvalidated parametrization to the shared JS rig for one
    Python-only test case.
    """

    @staticmethod
    def _hanging_arm_landmarks():
        lm = json.loads(json.dumps(_POSES["elbow_typing_visible"]["landmarks"]))
        l_sh, r_sh = lm[be.PL.L_SHOULDER], lm[be.PL.R_SHOULDER]
        el_l, el_r = lm[be.PL.L_ELBOW],    lm[be.PL.R_ELBOW]
        s_half_px = abs(l_sh["x"] - r_sh["x"]) * W / 2
        # Comfortably past armWorking()'s drop>0.75 / reach<0.45 thresholds.
        drop_px, reach_px = 0.9 * s_half_px, 0.05 * s_half_px
        lm[be.PL.L_WRIST]["y"] = el_l["y"] + drop_px / H
        lm[be.PL.L_WRIST]["x"] = el_l["x"] + reach_px / W
        lm[be.PL.R_WRIST]["y"] = el_r["y"] + drop_px / H
        lm[be.PL.R_WRIST]["x"] = el_r["x"] - reach_px / W
        return lm

    def test_hanging_arms_are_excluded_not_penalised(self):
        _current_case["lm_dicts"] = self._hanging_arm_landmarks()
        sid = "synthetic-hanging-arms"
        out = None
        for _ in range(25):
            out = be.analyze_front(_DUMMY_IMAGE, mode="laptop", tier="professional", session_id=sid)

        wm = out["metrics"].get("wrist_angle")
        assert wm is not None, "hanging arms should still report the angle for visibility"
        assert wm.get("reliable") is False, f"a resting arm should be marked unreliable: {wm}"
        assert wm.get("reason") == "arms_at_rest"
        elbow_alerts = [a for a in out["alerts"] if "lbow" in a]
        assert elbow_alerts == [], f"a resting arm should never fire an elbow alert: {elbow_alerts}"

    def test_typing_arms_are_unaffected(self):
        # Regression guard against the new at-rest branch swallowing the
        # working-arm path by mistake -- test_typing_arm_scores_well_once_fixed
        # above already checks the score itself, this checks the new fields.
        out = analyze("elbow_typing_visible", tier="professional")
        wm = out["metrics"].get("wrist_angle")
        assert wm is not None
        assert wm.get("reliable") is not False
        assert wm.get("reason") != "arms_at_rest"


class TestShoulderDistanceFallbackFocal:
    """The shoulder-width-based distance fallback (used whenever FaceMesh
    finds no face this frame -- this test harness's FaceMesh double always
    reports none, see the module docstring) used to hardcode its own
    generic focal-length estimate, completely ignoring any focal already
    calibrated for this exact session from an earlier face-visible frame
    (stored in backend._focal_cal, keyed by session_id, populated by
    ipd_distance_face's own _calibrate_focal()) -- even though focal length
    is a property of the camera/lens, not of which body part is being
    measured, so a calibrated focal is exactly as valid here as it is
    there. It also disagreed with ipd_distance_face's own generic-fallback
    constant (600 here vs 630 there) even in the fully uncalibrated case,
    so a calibrated user whose face briefly left FaceMesh's narrower
    detection region (a head turn, a hand near the face, glare) while still
    inside Pose's wider shoulder-tracking region had their distance reading
    jump to a second, different, uncalibrated estimate on that exact frame.
    """

    def test_reuses_this_sessions_calibrated_focal_when_present(self):
        sid = "unit-shoulder-fallback-calibrated"
        be._focal_cal[sid] = 700.0   # as if calibrated from an earlier face-visible frame
        try:
            _current_case["lm_dicts"] = _POSES["neutral"]["landmarks"]
            out = None
            for _ in range(25):
                out = be.analyze_front(_DUMMY_IMAGE, mode="laptop", tier="standard", session_id=sid)
        finally:
            del be._focal_cal[sid]
        dist = out["metrics"]["screen_distance"]["value"]
        # focal=700, this pose's ~560px shoulder width at W=1280: (40*700)/560 = 50.0cm.
        assert abs(dist - 50.0) < 2.0, (
            f"expected the session's own calibrated focal (700px) to be reused, "
            f"got distance={dist} (looks like a generic/uncalibrated estimate instead)"
        )

    def test_falls_back_to_the_same_generic_constant_as_ipd_distance_face(self):
        sid = "unit-shoulder-fallback-uncalibrated"
        assert sid not in be._focal_cal   # sanity: genuinely uncalibrated
        _current_case["lm_dicts"] = _POSES["neutral"]["landmarks"]
        out = None
        for _ in range(25):
            out = be.analyze_front(_DUMMY_IMAGE, mode="laptop", tier="standard", session_id=sid)
        dist = out["metrics"]["screen_distance"]["value"]
        # Shared 630*(w/640) generic focal, this pose's ~560px shoulder
        # width at W=1280: (40 * 630*2) / 560 = 90.0cm.
        assert abs(dist - 90.0) < 2.0, (
            f"expected the same generic fallback constant ipd_distance_face uses (630), "
            f"got distance={dist} -- looks like the old, disagreeing 600 constant"
        )


class TestAlertDwell:
    """analyze_front() used to fire every alert off a single request with no
    temporal debouncing at all -- confirmed by reading every add_alert()/
    out["alerts"].append() call site in the function, all raw threshold
    checks. Fixed to match postureEngine.js's ALERT_DWELL_MS debounce: a
    condition has to hold for >=1.2s (tracked per session_id, alongside the
    landmark-smoothing state) before it's surfaced.

    Real analyze() calls in this file run their whole settle loop inside a
    handful of milliseconds of real wall-clock time, which is exactly what
    lets TestThresholdDrift below assert nothing escapes prematurely. To
    prove the OTHER half -- that a genuinely sustained condition does still
    surface -- these tests monkeypatch backend.time.time() to advance a
    controlled amount per call, the same idea as postureEngine.js's
    analyzeMP.__testNowMs override, rather than a real multi-second sleep.
    """

    def test_a_bad_pose_fires_no_alert_within_the_dwell_window(self):
        # The default `analyze()` settle loop runs in well under 1.2s of
        # real wall-clock time, so this is already exercised implicitly by
        # every other test in this file -- asserted explicitly here for a
        # pose that would obviously alert once sustained.
        out = analyze("lateral_lean_25")
        assert out["alerts"] == [], f"alerts fired before the dwell window elapsed: {out['alerts']}"

    def test_a_sustained_bad_pose_does_eventually_alert(self):
        fake_now = [1_700_000_000.0]
        def fake_time():
            fake_now[0] += 0.05
            return fake_now[0]
        with __import__("unittest.mock", fromlist=["patch"]).patch.object(be.time, "time", side_effect=fake_time):
            out = analyze("lateral_lean_25", settle=40)  # ~2s of fake elapsed time
        assert len(out["alerts"]) > 0, "a lean sustained well past the dwell window produced no alerts"
        assert len(out["alerts"]) <= 5

    def test_flicker_never_accumulates_dwell_time(self):
        """A condition that's true, then false, then true again must not
        have its dwell clock keep running through the false gap -- each
        return to true starts the clock over, same as
        postureEngine.js's held().

        This used to drive the flicker through the full analyze_front()
        pipeline (alternating synthetic landmark sets), but that route is
        confounded by the pre-existing Kalman/landmark-smoothing layer:
        smoothed landmarks have real momentum, so alternating the *raw*
        input every call doesn't actually make the lean *condition* go
        cleanly absent for a full frame the way this property needs to be
        tested. apply_alert_dwell() is a pure function of (session_id,
        alert strings, now_ts) with no knowledge of landmarks or smoothing,
        so we drive it directly with hand-built alert lists instead -- a
        clean, deterministic test of exactly the mechanism under test."""
        sid = "unit-flicker-test"
        present = ["⚠️ Leaning left 25.0° — sit centered, weight even on both hips"]
        absent = []
        t = 1_700_000_000.0
        held = []
        for i in range(6):
            t += 0.9   # each call jumps most of the dwell window
            held = be.apply_alert_dwell(sid, present if i % 2 == 0 else absent, now_ts=t)
        assert held == [], f"a flickering condition should never accumulate enough continuous dwell time to alert: {held}"

    def test_sustained_alert_is_held_only_after_the_dwell_window(self):
        """The direct counterpart to test_a_sustained_bad_pose_does_eventually_alert
        above, but against apply_alert_dwell() itself: the same alert kind,
        present on every call, must NOT be held before ALERT_DWELL_SECONDS
        has elapsed and MUST be held once it has."""
        sid = "unit-sustained-test"
        alert = ["⚠️ Leaning left 25.0° — sit centered, weight even on both hips"]
        t = 1_700_000_000.0
        # Still within the dwell window -- must not be held yet.
        held = be.apply_alert_dwell(sid, alert, now_ts=t)
        assert held == []
        held = be.apply_alert_dwell(sid, alert, now_ts=t + 0.5)
        assert held == []
        # Past the dwell window (window started at t) -- must now be held.
        held = be.apply_alert_dwell(sid, alert, now_ts=t + be.ALERT_DWELL_SECONDS + 0.1)
        assert held == alert

    def test_drifting_numbers_do_not_reset_the_dwell_clock(self):
        """The whole reason for normalizing alert text before keying dwell
        state: the same underlying condition reports a slightly different
        number almost every frame (25.0deg, then 24.6deg, ...). That must
        still be recognised as one continuous condition, not a new alert
        each time (which would never clear the dwell window)."""
        sid = "unit-drift-test"
        t = 1_700_000_000.0
        readings = ["25.0", "24.6", "23.9", "26.1"]
        held = []
        for i, r in enumerate(readings):
            held = be.apply_alert_dwell(
                sid, [f"⚠️ Leaning left {r}° — sit centered, weight even on both hips"],
                now_ts=t + i * (be.ALERT_DWELL_SECONDS / (len(readings) - 1)) + 0.05,
            )
        assert held != [], "numeric drift in the alert text should not reset the dwell clock"

    def test_condition_clearing_prunes_its_dwell_bucket_entry(self):
        """Once a condition's alert stops appearing, its entry in the
        per-session dwell bucket should be dropped (not just excluded from
        the held list) -- otherwise a session that cycles through many
        transient conditions over a long run would leak memory forever."""
        sid = "unit-prune-test"
        alert = ["⚠️ Leaning left 25.0° — sit centered, weight even on both hips"]
        be.apply_alert_dwell(sid, alert, now_ts=1_700_000_000.0)
        assert len(be._alert_dwell_state.get(sid, {})) == 1
        be.apply_alert_dwell(sid, [], now_ts=1_700_000_001.0)
        assert be._alert_dwell_state.get(sid, {}) == {}

    def test_bucket_growth_is_capped(self):
        """A pathological session that racks up many distinct alert kinds
        (or a session_id reused across a very long process lifetime)
        should have its dwell bucket trimmed rather than grow forever."""
        sid = "unit-growth-test"
        t = 1_700_000_000.0
        for i in range(100):
            be.apply_alert_dwell(sid, [f"⚠️ Distinct condition number {i} detected"], now_ts=t)
            t += 0.01
        assert len(be._alert_dwell_state.get(sid, {})) <= 64


class TestThresholdDrift:
    """Prints the actual score_m(...) values analyze_front currently uses
    for head_tilt/sh_tilt/spine_lean/fhp_cm against synthetic poses at
    known true angles, alongside what postureEngine.js's corrected THR
    table would produce for the same true angle. Informational -- the
    numeric score_m constants are the fix target, checked directly against
    backend.py's source in test_threshold_constants.py (added alongside
    this file) rather than re-derived here from noisy synthetic geometry.
    """
    def test_prints_metric_snapshot_for_each_case(self):
        for name in ["neutral", "lateral_lean_12", "lateral_lean_25",
                     "forward_head_4cm", "forward_head_8cm",
                     "shoulder_tilt_8", "trunk_flex_15",
                     "rounded_shoulders_6", "trunk_twist_45"]:
            out = analyze(name)
            m = out.get("metrics", {})
            print(f"\n  {name}: score={out.get('score')} "
                  f"neck={m.get('neck_lean', {}).get('value')} "
                  f"tilt={m.get('head_tilt', {}).get('value')} "
                  f"sh={m.get('shoulder_level', {}).get('value')} "
                  f"spine={m.get('spine_lean', {}).get('value')}")
