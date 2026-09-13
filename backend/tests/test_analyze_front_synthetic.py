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
