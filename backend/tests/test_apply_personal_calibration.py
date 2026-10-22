"""
apply_personal_calibration() -- /api/analyze's post-processing step that
re-scores neck_lean/head_tilt/shoulder_level/spine_lean against a user's
personal calibration tolerances, then folds that change back into the
overall score.

This logic lived inline inside the analyze() Flask route (no test could
reach it without a request/auth context) until it was extracted into this
standalone function specifically so it could be tested -- the bug these
tests pin down was found by reading that inline code, not by a test that
caught it first.

The bug: the final blend used to be `raw_score*0.40 + calib_avg*0.60`,
where calib_avg is a flat, UNWEIGHTED average of just the four
recalibrated metrics. raw_score already counts those same four at their
real BASE_W weight (~0.465 of the model when every metric is fully
visible, not 0.60) alongside the other ~0.535 of weight (dist, eye,
wrist, rounded, fhp, torso_flex, trunk_rot, shoulder_elev) -- so the old
blend double-counted neck/tilt/shoulder/spine and roughly halved every
other metric's real influence, for every user who had ever run the
calibration wizard. The fix adjusts raw_score by exactly the WEIGHTED
delta recalibration introduced for those four metrics (eff_weight x
(recalibrated_score - original_score)) and leaves everything else alone.

Run: cd backend && pytest tests/test_apply_personal_calibration.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from backend import apply_personal_calibration

# A representative eff_weights snapshot at full confidence/visibility --
# matches BASE_W in analyze_front() as of this writing (sums to 1.0).
EFF_W = {
    "neck": 0.204, "tilt": 0.072, "sh": 0.058, "spine": 0.131, "dist": 0.160,
    "eye": 0.036, "wrist": 0.066, "rounded": 0.063, "fhp": 0.095,
    "torso_flex": 0.048, "trunk_rot": 0.019, "shoulder_elev": 0.048,
}


def _result(raw_score, neck=70, tilt=70, sh=70, spine=70, eff_w=None):
    """A result dict shaped like analyze_front()'s output, with just the
    fields apply_personal_calibration() actually reads."""
    return {
        "detected": True,
        "score": raw_score,
        "metrics": {
            "neck_lean":      {"value": 12.0, "score": neck},
            "head_tilt":      {"value": 5.0,  "score": tilt},
            "shoulder_level": {"value": 4.0,  "score": sh},
            "spine_lean":     {"value": 8.0,  "score": spine},
            "_confidence": {"eff_weights": dict(eff_w or EFF_W)},
        },
    }


RAW_VAL = {"neck_angle": 12.0, "head_tilt": 5.0, "shoulder_tilt": 4.0, "spine_angle": 8.0}
# Deviations (raw_val - ideal) chosen to land the recalibrated score at a
# known value via apply_personal_calibration's own d<=ok/elif d<=bad
# piecewise formula (ok=7, bad=20 below) -- not re-derived from score_m,
# since this inline calc intentionally has its own ok_eff/bad_eff and this
# is what's actually under test.
DEV_FOR_SCORE_70 = 8.3   # ok=7 < d<=20 branch: 75-((8.3-7)/13)*45 ~ 70.5 -> int 70
DEV_FOR_SCORE_85 = 4.1   # d<=ok=7 branch: 100-(4.1/7)*25 ~ 85.4 -> int 85


def _calib(deviations=None):
    """Tolerances with ok=7/bad=20 and `ideal` set so each metric's
    deviation (raw_val - ideal) is the given value (default: DEV_FOR_SCORE_70
    for all four, i.e. every metric recalibrates to a score of 70)."""
    devs = {"neck_angle": DEV_FOR_SCORE_70, "head_tilt": DEV_FOR_SCORE_70,
            "shoulder_tilt": DEV_FOR_SCORE_70, "spine_angle": DEV_FOR_SCORE_70}
    devs.update(deviations or {})
    return {
        "tolerances": {k: {"ideal": RAW_VAL[k] - d, "ok": 7, "bad": 20} for k, d in devs.items()},
        "offsets": {},
    }


class TestNoOp:
    def test_missing_calibration_is_a_no_op(self):
        r = _result(86)
        out = apply_personal_calibration(r, None)
        assert out["score"] == 86
        assert "calibration_applied" not in out

    def test_undetected_pose_is_a_no_op(self):
        r = _result(86); r["detected"] = False
        apply_personal_calibration(r, _calib())
        assert r["score"] == 86
        assert "calibration_applied" not in r


class TestWeightedRescoreReplacesFlatBlend:
    def test_unchanged_recalibration_leaves_overall_unchanged(self):
        """If recalibration doesn't actually move any of the four scores,
        the overall score must not move either -- the old 0.40/0.60 blend
        failed this: blending raw_score with calib_avg still perturbed the
        result even when calib_avg happened to equal the metrics' own
        pre-calibration average, any time that average differed from
        raw_score (which it does here: 70 vs 86)."""
        r = _result(86, neck=70, tilt=70, sh=70, spine=70)
        c = _calib()   # every metric recalibrates to a score of 70 (default)
        apply_personal_calibration(r, c)
        for k in ("neck_lean", "head_tilt", "shoulder_level", "spine_lean"):
            assert r["metrics"][k]["score"] == 70, r["metrics"][k]
        assert r["score"] == 86, (
            f"recalibration reproduced the SAME four scores (70) as before, "
            f"so overall should stay at raw_score (86), got {r['score']}"
        )

    def test_recalibration_improvement_moves_overall_by_its_real_weight_only(self):
        """neck_lean recalibrates from a harsh 50 to a kind 85 (e.g. this
        user's natural neutral sits where the generic threshold read them
        as off-center). Only neck's own eff_weight (0.204) worth of that
        35-point swing should reach `overall` -- not 60% of it averaged
        against three untouched metrics."""
        r = _result(raw_score=82, neck=50, tilt=70, sh=70, spine=70)
        # Only neck recalibrates to a different score (85); the other
        # three reproduce their already-70 original score unchanged.
        c = _calib({"neck_angle": DEV_FOR_SCORE_85})
        apply_personal_calibration(r, c)
        assert r["metrics"]["neck_lean"]["score"] == 85
        expected_delta = EFF_W["neck"] * (85 - 50)   # = 7.14
        expected_score = round(82 + expected_delta)   # ~89
        assert r["score"] == expected_score, (
            f"expected raw_score(82) + neck's own weight({EFF_W['neck']}) x "
            f"delta(35) = {expected_score}, got {r['score']}"
        )
        # The bug this guards against: the old flat 0.40/0.60 blend against
        # an unweighted 4-metric average would have landed far from this.
        old_buggy_calib_avg = (85 + 70 + 70 + 70) / 4  # 73.75
        old_buggy_score = int(82 * 0.40 + old_buggy_calib_avg * 0.60)
        assert r["score"] != old_buggy_score, (
            "fixed result should not coincidentally match the old buggy formula"
        )

    def test_calibrated_flags_set(self):
        r = _result(86)
        apply_personal_calibration(r, _calib())
        assert r["calibration_applied"] is True
        assert r["asymmetric_correction"] is True
        assert r["metrics"]["neck_lean"]["calibrated"] is True

    def test_score_stays_in_bounds(self):
        # Push neck's recalibrated score to the extreme and confirm the
        # final blended score still clamps to [0, 100].
        r = _result(raw_score=95, neck=5, tilt=100, sh=100, spine=100)
        c = _calib({"neck_angle": 12.0 + 200})  # huge deviation -> score near 5
        apply_personal_calibration(r, c)
        assert 0 <= r["score"] <= 100
