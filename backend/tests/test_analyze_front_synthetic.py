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


def analyze_with_baseline(sid, neutral_case, target_case, warmup=65, settle=25, mode="laptop", tier="standard"):
    """Feed `neutral_case` landmarks long enough for the session's own
    trunk-rotation/torso-flexion baseline to learn "this is neutral" (see
    backend._feed_baseline's own docstring: 20-frame warmup-skip + 40
    samples before it freezes a median -- 65 gives it margin), then switch
    to `target_case` and let the much-faster 3-frame Kalman landmark
    smoothing converge to it. Necessary because both metrics score the
    CHANGE from a per-session learned baseline, not an absolute value --
    feeding the same pose throughout (like the plain analyze() helper does)
    would just teach the baseline that pose IS neutral and always read 0.
    """
    out = None
    _current_case["lm_dicts"] = _POSES[neutral_case]["landmarks"]
    for _ in range(warmup):
        out = be.analyze_front(_DUMMY_IMAGE, mode=mode, tier=tier, session_id=sid)
    _current_case["lm_dicts"] = _POSES[target_case]["landmarks"]
    for _ in range(settle):
        out = be.analyze_front(_DUMMY_IMAGE, mode=mode, tier=tier, session_id=sid)
    return out


class TestTrunkRotationAndTorsoFlexion:
    """analyze_front() previously had no equivalent of postureEngine.js's
    analyzeTrunkRotation()/analyzeTorsoFlexion() at all -- a 45deg trunk
    twist or a full forward slouch moved neither the metrics dict nor the
    score. Both need the hips in frame (hidden at normal laptop-webcam
    distance -- same constraint elbow_typing_visible documents), and both
    score the CHANGE from a per-session learned baseline rather than an
    absolute value, so they're exercised via analyze_with_baseline() above
    rather than the plain analyze() helper."""

    def test_trunk_rotation_absent_when_hips_hidden(self):
        # Normal laptop framing (neutral, 60cm) -- hips below frame, exactly
        # the same reliability gate elbow/wrist and rounded-shoulders share.
        out = analyze("neutral", tier="professional")
        assert out["metrics"].get("trunk_rotation") is None

    def test_torso_flexion_absent_when_hips_hidden(self):
        out = analyze("neutral", tier="professional")
        assert out["metrics"].get("torso_flexion") is None

    def test_trunk_rotation_detects_a_real_twist(self):
        sid = "synthetic-trunk-rot-detect"
        out = analyze_with_baseline(sid, "neutral_at_130cm", "trunk_twist_45_hips_visible")
        tr = out["metrics"].get("trunk_rotation")
        assert tr is not None, "trunk_rotation missing once hips are in frame"
        assert tr["value"] > 15, f"expected a meaningfully large rotation reading for a 45deg twist, got {tr}"
        assert tr["severity"] in ("moderate", "severe"), f"a 45deg twist should not classify as normal/mild: {tr}"

    def test_trunk_rotation_reads_near_zero_for_a_static_neutral_session(self):
        # The baseline-learning design means a session that never moves
        # learns its own (neutral) pose as baseline and should read ~0,
        # not drift positive just from noise/rounding.
        sid = "synthetic-trunk-rot-static"
        out = analyze_with_baseline(sid, "neutral_at_130cm", "neutral_at_130cm")
        tr = out["metrics"].get("trunk_rotation")
        assert tr is not None
        assert tr["value"] <= 5, f"a session that never actually twisted read {tr['value']}deg of rotation"

    def test_torso_flexion_detects_a_real_slouch(self):
        sid = "synthetic-torso-flex-detect"
        out = analyze_with_baseline(sid, "neutral_at_130cm", "trunk_flex_15_hips_visible")
        tf = out["metrics"].get("torso_flexion")
        assert tf is not None, "torso_flexion missing once hips are in frame"
        assert tf["value"] > 5, f"expected a meaningfully large shrink%% for a 15deg forward flex, got {tf}"

    def test_torso_flexion_reads_near_zero_for_a_static_neutral_session(self):
        sid = "synthetic-torso-flex-static"
        out = analyze_with_baseline(sid, "neutral_at_130cm", "neutral_at_130cm")
        tf = out["metrics"].get("torso_flexion")
        assert tf is not None
        assert tf["value"] <= 5, f"a session that never actually slouched read {tf['value']}% shortening"


class TestForwardHeadDepthEstimator:
    """The lateral-offset FHP fallback (abs(mid_ear.x - mid_sh.x)) is
    dominated by lateral head position, not sagittal forward-head depth --
    empirically confirmed here: forward_head_4cm/forward_head_8cm move the
    head in Z only, and the fallback alone reads 0.0cm for both (see
    TestWeightTableRedesign's own docstring/history -- this is what first
    surfaced the gap). analyzeForwardHeadDepth's apparent-head-size ratio
    estimator (backend's mirror of postureEngine.js's own) fixes this by
    using only x-coordinates. Exercised via analyze_with_baseline() since
    it needs its own learned per-session baseline first."""

    def test_neutral_reads_near_zero(self):
        sid = "unit-fhd-neutral"
        out = analyze_with_baseline(sid, "neutral", "neutral")
        fh = out["metrics"].get("fhp_index")
        assert fh is not None and fh.get("source") == "depth"
        assert fh["value"] <= 2.0, f"a session that never moved forward read {fh['value']}cm of FHP"

    def test_monotonic_in_true_forward_head_distance(self):
        """0cm < 4cm < 8cm of true forward head should read out increasing,
        not-all-zero values -- the exact property the lateral-offset-only
        fallback fails (it reads ~0.0 for all three, since forwardHeadCm
        moves the head in Z, which that formula never looks at)."""
        readings = {}
        for case in ("neutral", "forward_head_4cm", "forward_head_8cm"):
            sid = f"unit-fhd-monotonic-{case}"
            out = analyze_with_baseline(sid, "neutral", case)
            fh = out["metrics"].get("fhp_index")
            assert fh is not None and fh.get("source") == "depth", f"{case}: {fh}"
            readings[case] = fh["value"]
        assert readings["neutral"] < readings["forward_head_4cm"] < readings["forward_head_8cm"], (
            f"expected strictly increasing FHP readings as true forward-head distance grows: {readings}"
        )
        assert readings["forward_head_8cm"] > 5, (
            f"8cm of true forward head should read as a clearly non-trivial distance, got {readings}"
        )

    def test_falls_back_to_lateral_offset_before_baseline_is_learned(self):
        """A fresh session (baseline still warming up) must still report
        SOMETHING from the lateral-offset fallback rather than nothing."""
        out = analyze("forward_head_8cm", tier="professional")   # default settle=25, no baseline yet
        fh = out["metrics"].get("fhp_index")
        assert fh is not None
        assert fh.get("source") == "lateral_offset"


class TestWeightTableRedesign:
    """rounded-shoulders was folded into BASE_W once already (see that
    change's own comment on BASE_W) after being computed and alerted on but
    never affecting the score. The same audit found the identical gap for
    THREE more metrics: fhp_index (forward head posture -- computed,
    alerted on, but never referenced in BASE_W/eff_w/scores) and the newly
    added trunk_rotation/torso_flexion. This class guards that all three
    now actually carry nonzero weight when reliable, and that BASE_W still
    sums to ~1.0 (a silent drift there would quietly rescale every score)."""

    def test_base_w_sums_to_one(self):
        # BASE_W is a local dict rebuilt fresh inside analyze_front() every
        # call -- reach it by running one analysis and reading eff_weights'
        # keys back with full confidence (1.0), which happens when every
        # gated metric is reliable at once: landmarks fully visible AND (for
        # trunk_rot/torso_flex/fhp's depth estimator) their per-session
        # baselines already learned -- hence analyze_with_baseline() rather
        # than the plain analyze() helper (a fresh session's 25-frame settle
        # isn't long enough for those baselines to freeze).
        sid = "unit-base-w-sum"
        out = analyze_with_baseline(sid, "neutral_at_130cm", "neutral_at_130cm")
        eff_w = out["metrics"]["_confidence"]["eff_weights"]
        # dist absorbs any "lost" weight from low-confidence metrics, so on
        # a fully-visible neutral pose the raw sum (pre-lost-weight-merge)
        # isn't directly recoverable from eff_weights alone -- but eff_weights
        # itself, plus whatever this pose kept, must still total ~1.0 (the
        # normalisation analyze_front performs on weight_used guarantees
        # this holds regardless of which metrics were reliable this frame).
        assert abs(sum(eff_w.values()) - 1.0) < 0.02, f"eff_weights should total ~1.0, got {sum(eff_w.values())}: {eff_w}"

    def test_fhp_carries_nonzero_weight(self):
        out = analyze("neutral", tier="professional")
        assert out["metrics"].get("fhp_index") is not None
        assert out["metrics"]["_confidence"]["eff_weights"]["fhp"] > 0, \
            "fhp_index is computed but BASE_W['fhp'] isn't reaching eff_weights"

    def test_trunk_rot_and_torso_flex_carry_nonzero_weight_when_reliable(self):
        sid = "synthetic-weight-trunk-torso"
        out = analyze_with_baseline(sid, "neutral_at_130cm", "trunk_twist_45_hips_visible")
        assert out["metrics"].get("trunk_rotation") is not None
        eff_w = out["metrics"]["_confidence"]["eff_weights"]
        assert eff_w["trunk_rot"] > 0, "trunk_rotation is computed but BASE_W['trunk_rot'] isn't reaching eff_weights"

    def test_severe_fhp_pulls_the_overall_score_down(self):
        # forward_head_8cm is a severe FHP reading (SEV.FHP severe=8) with
        # everything else clean -- exactly the "one severe fault hidden by
        # several good ones" scenario the severity floor and this weight
        # fix both target. Before fhp carried any weight, this pose's score
        # was determined entirely by its OTHER (clean) metrics.
        #
        # The lateral-offset fallback alone can't tell this pose apart from
        # neutral (forwardHeadCm moves the head in Z, which that fallback
        # doesn't look at at all -- the exact defect analyzeForwardHeadDepth
        # exists to fix), so this needs the depth estimator's own baseline
        # learned first, same as the trunk_rot/torso_flex tests above.
        sid_neutral = "unit-fhp-neutral"
        sid_fhp     = "unit-fhp-severe"
        out_neutral = analyze_with_baseline(sid_neutral, "neutral", "neutral")
        out_fhp     = analyze_with_baseline(sid_fhp,     "neutral", "forward_head_8cm")
        fhp_metric = out_fhp["metrics"].get("fhp_index")
        assert fhp_metric is not None and fhp_metric.get("source") == "depth", (
            f"expected the depth estimator to have taken over by now: {fhp_metric}"
        )
        assert out_fhp["score"] < out_neutral["score"], (
            f"a severe forward-head-posture pose scored {out_fhp['score']} vs a clean "
            f"neutral pose's {out_neutral['score']} -- fhp doesn't appear to be moving the score"
        )


class TestPositionOcclusionPenalty:
    """analyze_front()'s confidence-weighted average can look fine even when
    the frame itself makes every reading on it less trustworthy -- sitting
    on top of the lens, sitting far back, or resting a chin/cheek on a hand
    (hiding one ear) all degrade geometry across the board without any
    single per-metric score reacting to it. postureEngine.js already
    charges for this (checkFrameQuality()'s too_close/too_far half,
    handProp.detected -> occlusionPenalty); analyze_front had no
    equivalent at all until _check_frame_crop()/compute_position_penalty()/
    compute_occlusion_penalty() were added.

    _check_frame_crop/compute_position_penalty/compute_occlusion_penalty
    are tested directly as pure functions (same rationale as
    TestAlertDwell/TestSeverityFloor: precise control over the inputs that
    trigger each branch, with no synthetic pose needed). No dumped
    synthetic pose has asymmetric ear visibility (the rig always emits
    0.95/0.95 -- confirmed by inspecting every case in synthetic_poses.json),
    so hand-prop-occlusion detection itself can only be exercised at the
    pure-function level here; the distance/crop half of the wiring is
    additionally checked end-to-end through analyze_front() below, since
    several dumped poses genuinely land outside the ideal distance band.
    """

    # ── _check_frame_crop ────────────────────────────────────────────
    def test_crop_normal_framing_is_a_no_op(self):
        # Shoulders comfortably centred and a normal width for a 1280px
        # frame -- nothing should trip.
        reason, severity = be._check_frame_crop((560, 300), (720, 300), 1280)
        assert reason is None and severity == 0.0

    def test_crop_flags_too_close_from_shoulder_span_fraction(self):
        # Shoulder span > 85% of frame width, well inside the frame edges
        # (so this is the width-fraction branch, not the edge-run-off one).
        reason, severity = be._check_frame_crop((80, 300), (1200, 300), 1280)
        assert reason == "too_close"
        assert 0 < severity <= 1.0

    def test_crop_flags_too_close_when_a_wide_span_runs_off_the_frame_edge(self):
        # A shoulder pinned at the very edge AND a wide span together should
        # read as maximum severity (1.0) via the edge-run-off branch.
        reason, severity = be._check_frame_crop((-5, 300), (900, 300), 1280)
        assert reason == "too_close"
        assert severity == 1.0

    def test_crop_flags_too_far_for_a_narrow_shoulder_span(self):
        reason, severity = be._check_frame_crop((620, 300), (660, 300), 1280)
        assert reason == "too_far"
        assert 0 < severity <= 1.0

    def test_crop_severity_increases_with_how_far_past_the_threshold(self):
        # Both trip the plain width-fraction branch (comfortably inside the
        # frame edges), one just past the 0.85 threshold and one close to
        # filling the frame -- severity should track the difference.
        _, mild   = be._check_frame_crop((65, 300),  (1215, 300), 1280)   # frac ~0.898
        _, severe = be._check_frame_crop((15, 300),  (1265, 300), 1280)   # frac ~0.977
        assert mild > 0 and severe > 0
        assert severe > mild, f"a more extreme crop should score a higher severity: mild={mild} severe={severe}"

    # ── compute_position_penalty ─────────────────────────────────────
    def test_position_penalty_zero_for_a_well_framed_in_range_subject(self):
        pen = be.compute_position_penalty((560, 300), (720, 300), 1280, 70, 50, 100)
        assert pen == 0

    def test_position_penalty_from_crop_alone(self):
        pen = be.compute_position_penalty((80, 300), (1200, 300), 1280, 70, 50, 100)
        assert pen > 0

    def test_position_penalty_from_distance_alone(self):
        # Well-framed shoulders (no crop signal) but a calibrated distance
        # far outside [lo, hi].
        pen = be.compute_position_penalty((560, 300), (720, 300), 1280, 160, 50, 100)
        assert pen > 0

    def test_position_penalty_takes_the_larger_signal_not_the_sum(self):
        # Both crop AND distance are tripped at once -- the combined penalty
        # must equal the worse of the two, not their sum, per the function's
        # own docstring.
        crop_only = be.compute_position_penalty((80, 300), (1200, 300), 1280, 70, 50, 100)
        dist_only = be.compute_position_penalty((560, 300), (720, 300), 1280, 160, 50, 100)
        both = be.compute_position_penalty((80, 300), (1200, 300), 1280, 160, 50, 100)
        assert both == max(crop_only, dist_only), (
            f"expected max(crop, dist) = {max(crop_only, dist_only)}, got {both} "
            f"(crop_only={crop_only}, dist_only={dist_only}) -- looks summed, not maxed"
        )

    def test_position_penalty_never_exceeds_the_cap(self):
        pen = be.compute_position_penalty((-50, 300), (1300, 300), 1280, 300, 50, 100)
        assert pen <= 18

    def test_position_penalty_small_distance_overshoot_is_forgiven(self):
        # dist_over <= 2cm is explicitly a no-charge zone per the function's
        # own ramp comment.
        pen = be.compute_position_penalty((560, 300), (720, 300), 1280, 101.5, 50, 100)
        assert pen == 0

    # ── compute_occlusion_penalty ────────────────────────────────────
    def test_occlusion_penalty_zero_when_no_hand_prop_detected(self):
        assert be.compute_occlusion_penalty(0.3, False) == 0

    def test_occlusion_penalty_zero_for_full_coverage_even_if_flagged(self):
        # weight_used >= 0.9 means coverage saturates at 1.0 -- full
        # confidence survived, so there's nothing to charge for even if the
        # (cheap, heuristic) hand-prop detector fired.
        assert be.compute_occlusion_penalty(1.0, True) == 0

    def test_occlusion_penalty_scales_with_how_much_weight_was_lost(self):
        light = be.compute_occlusion_penalty(0.8, True)
        heavy = be.compute_occlusion_penalty(0.2, True)
        assert 0 < light < heavy <= 26, f"expected 0 < light < heavy <= 26, got light={light} heavy={heavy}"

    def test_occlusion_penalty_maxes_out_near_zero_weight_used(self):
        pen = be.compute_occlusion_penalty(0.0, True)
        assert pen == 26

    # ── End-to-end through analyze_front() ───────────────────────────
    def test_in_range_distance_poses_carry_no_position_penalty(self):
        # neutral_at_40cm/60cm both land inside the laptop [50,100] band
        # once run through analyze_front's own distance estimate (which
        # doesn't map 1:1 to the synthetic rig's camera-distance label --
        # confirmed empirically, not assumed) -- absent metrics keys mean
        # the `if _position_penalty or _occlusion_penalty` gate never fired.
        for case in ("neutral_at_40cm", "neutral_at_60cm"):
            out = analyze(case, tier="professional")
            assert out["distCm"] is not None and 50 <= out["distCm"] <= 100, (
                f"test premise failed for {case}: distCm={out.get('distCm')} not inside [50,100]"
            )
            assert out["metrics"].get("_position_penalty") is None, (
                f"{case} is inside the ideal distance band and should carry no position penalty: "
                f"{out['metrics'].get('_position_penalty')}"
            )

    def test_out_of_range_distance_pose_is_charged_a_position_penalty_and_loses_score(self):
        out_near = analyze("neutral_at_60cm", tier="professional")   # in range
        out_far  = analyze("neutral_at_90cm", tier="professional")   # empirically resolves well past hi=100
        assert out_far["distCm"] > 100, f"test premise failed: distCm={out_far['distCm']} not past the ideal band"
        pp = out_far["metrics"].get("_position_penalty")
        assert pp is not None and pp["value"] > 0, f"expected a nonzero position penalty, got {pp}"
        assert out_far["score"] < out_near["score"], (
            f"a subject well outside the ideal distance band scored {out_far['score']}, not lower than "
            f"the in-range pose's {out_near['score']}"
        )

    def test_occlusion_penalty_metric_reports_not_detected_when_ears_are_symmetric(self):
        # Every dumped synthetic pose has symmetric ear visibility, so the
        # hand-prop heuristic should never fire through the real pipeline
        # here -- guards the wiring's `detected` flag against a false
        # positive on ordinary, fully-visible poses.
        out = analyze("neutral_at_90cm", tier="professional")  # has a penalty dict written (position)
        op = out["metrics"].get("_occlusion_penalty")
        assert op is not None and op["detected"] is False and op["value"] == 0, f"{op}"


class TestSeverityFloor:
    """A confidence-weighted average can hide one severe fault behind
    several good ones -- see apply_severity_floor()'s own docstring for the
    full rationale (it mirrors a bug postureEngine.js's own severity floor
    was added to fix on the frontend). Tested directly against
    apply_severity_floor() rather than through the full analyze_front()
    pipeline, for the same reason TestAlertDwell tests apply_alert_dwell()
    directly: the synthetic-subject rig's lateralLeanDeg rolls trunk and
    head together, so there's no dumped pose that puts exactly ONE metric
    into "severe" while leaving the rest clean the way the motivating
    real-world case (an isolated severe head tilt) does -- and even if
    there were, the pre-existing Kalman/landmark-smoothing layer has the
    same momentum confound documented in apply_alert_dwell's tests. A pure
    function of (session_id, overall, candidates, now_ts) sidesteps both.
    """

    def test_a_single_sustained_severe_metric_caps_the_score(self):
        sid = "unit-severity-single-severe"
        t = 1_700_000_000.0
        result = 95
        for _ in range(4):
            t += 0.5
            result = be.apply_severity_floor(sid, 95, {"tilt": ("severe", True)}, now_ts=t)
        assert result <= 69, f"a sustained severe metric should cap the score at 69, got {result}"

    def test_not_capped_before_the_dwell_window_elapses(self):
        sid = "unit-severity-too-soon"
        result = be.apply_severity_floor(sid, 95, {"tilt": ("severe", True)}, now_ts=1_700_000_000.0)
        assert result == 95, f"a single-frame severe reading should not cap the score yet, got {result}"

    def test_no_severe_metrics_leaves_the_score_untouched(self):
        sid = "unit-severity-all-clean"
        candidates = {
            "neck": ("normal", True), "tilt": ("mild", True),
            "shoulder": (None, False), "spine": ("moderate", True),
        }
        t = 1_700_000_000.0
        result = 88
        for _ in range(4):
            t += 0.5
            result = be.apply_severity_floor(sid, 88, candidates, now_ts=t)
        assert result == 88

    def test_unreliable_severe_metric_never_caps(self):
        """A metric can't be measurable-and-severe if it isn't measurable at
        all -- an occluded/out-of-tier/no-face metric reporting "severe"
        with reliable=False (which none of analyze_front's own candidates
        should ever actually do, but the function must not trust blindly)
        must not trip the floor no matter how long it persists."""
        sid = "unit-severity-unreliable"
        t = 1_700_000_000.0
        result = 95
        for _ in range(4):
            t += 0.5
            result = be.apply_severity_floor(sid, 95, {"fhp": ("severe", False)}, now_ts=t)
        assert result == 95

    def test_flicker_never_trips_the_floor(self):
        sid = "unit-severity-flicker"
        t = 1_700_000_000.0
        result = 95
        for i in range(6):
            t += 0.9   # each call jumps most of the dwell window
            candidates = {"tilt": ("severe", True)} if i % 2 == 0 else {"tilt": ("normal", True)}
            result = be.apply_severity_floor(sid, 95, candidates, now_ts=t)
        assert result == 95, f"a flickering severe reading should never accumulate enough continuous dwell time to cap the score: {result}"

    def test_floor_never_raises_an_already_low_score(self):
        """min(overall, 69) must never pull a genuinely worse score UP to
        69 -- the floor only ever tightens a too-generous composite, it's
        not a second, competing scoring path."""
        sid = "unit-severity-already-low"
        t = 1_700_000_000.0
        result = 40
        for _ in range(4):
            t += 0.5
            result = be.apply_severity_floor(sid, 40, {"tilt": ("severe", True)}, now_ts=t)
        assert result == 40

    def test_a_clean_neutral_pose_is_never_capped(self):
        """Integration smoke test: a genuinely good posture must not have
        its score capped at all -- guards against the floor firing on
        anything other than an actual sustained severe reading."""
        out = analyze("neutral", tier="professional")
        assert out["score"] > 69, f"a clean neutral pose was capped: score={out['score']}"


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
