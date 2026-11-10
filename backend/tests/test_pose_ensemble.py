"""
Tests for ai/validation.py (stats) and ai/ensemble_pose.py (geometry).
The geometry test needs mediapipe + rtmlib + weights in backend/pose_models and an
image in POSMOZ_TEST_IMAGE; it is skipped otherwise.

Run from backend/:  python -m pytest tests/test_pose_ensemble.py -q
"""
import math
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ai.validation import agreement, compute_metrics, icc_2_1  # noqa: E402


class TestAgreementStats(unittest.TestCase):
    def test_icc_perfect(self):
        a = [10.0, 20.0, 30.0, 40.0, 50.0]
        self.assertAlmostEqual(icc_2_1(a, a), 1.0, places=6)

    def test_icc_penalises_constant_bias(self):
        a = [10.0, 20.0, 30.0, 40.0, 50.0]
        b = [x + 10 for x in a]       # same ranking, absolute disagreement
        self.assertLess(icc_2_1(a, b), 0.9)

    def test_icc_shrout_fleiss_reference(self):
        # two raters with a large constant offset; value computed independently
        # with a plain-loop two-way ANOVA (Shrout & Fleiss ICC(2,1))
        a = [9, 6, 8, 7, 10, 6]
        b = [2, 1, 4, 1, 5, 2]
        self.assertAlmostEqual(icc_2_1(a, b), 0.1257, places=3)

    def test_agreement_fields(self):
        r = agreement([1.0, 2.0, 3.0], [0.0, 2.0, 4.0])
        self.assertEqual(r["n"], 3)
        self.assertAlmostEqual(r["mae"], 2 / 3)
        self.assertAlmostEqual(r["bias"], 0.0)


class TestMetricGeometry(unittest.TestCase):
    def _pts(self):
        p = np.full((33, 4), np.nan)
        # frontal person, image y down; subject's left is on image right
        p[11] = (300, 200, 0, 1); p[12] = (200, 200, 0, 1)    # shoulders level
        p[23] = (290, 400, 0, 1); p[24] = (210, 400, 0, 1)    # hips
        p[2] = (265, 100, 0, 1);  p[5] = (235, 100, 0, 1)     # eyes
        return p

    def test_level_is_zero(self):
        m = compute_metrics(self._pts(), "front")
        self.assertAlmostEqual(m["shoulder_level_deg"], 0.0)
        self.assertAlmostEqual(m["trunk_lean_deg"], 0.0)

    def test_left_shoulder_lower_is_positive(self):
        p = self._pts()
        p[11][1] = 200 + 100 * math.tan(math.radians(5))
        self.assertAlmostEqual(compute_metrics(p, "front")["shoulder_level_deg"], 5.0, places=4)

    def test_turned_head_not_measured(self):
        p = self._pts()
        p[2][0] = 252; p[5][0] = 248     # eyes almost overlapping → head turned
        self.assertIsNone(compute_metrics(p, "front")["head_tilt_deg"])


IMG = os.environ.get("POSMOZ_TEST_IMAGE")
MODELS = os.path.join(os.path.dirname(__file__), "..", "pose_models")


@unittest.skipUnless(IMG and os.path.exists(MODELS), "needs POSMOZ_TEST_IMAGE and pose_models/")
class TestRotationConsistency(unittest.TestCase):
    """Rotating the photo by θ must change shoulder level and trunk lean by -θ."""

    def test_rotation(self):
        import cv2
        from ai.ensemble_pose import PoseEnsemble
        img = cv2.imread(IMG)
        h, w = img.shape[:2]
        ens = PoseEnsemble(MODELS)
        try:
            base = compute_metrics(ens.run(img)["fused"], "front")
            for theta in (-6, 6):
                M = cv2.getRotationMatrix2D((w / 2, h / 2), theta, 1.0)
                rot = cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REFLECT)
                m = compute_metrics(ens.run(rot)["fused"], "front")
                for k in ("shoulder_level_deg", "trunk_lean_deg"):
                    self.assertAlmostEqual(m[k] - base[k], -theta, delta=1.5, msg=k)
        finally:
            ens.close()


if __name__ == "__main__":
    unittest.main()
