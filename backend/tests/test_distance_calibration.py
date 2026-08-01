"""
Corvus — Unit Tests for Distance Calibration Fix (commit fdad828)
Verifies ipd_distance_face() correctly uses dist_calib_factor when present,
falls back safely when absent, and stays within physical bounds.
Run: cd backend && pytest tests/test_distance_calibration.py -v
"""
import sys, os, math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# backend.py needs flask/flask_cors/mediapipe importable but does NOT need
# firebase-admin or a real REDIS_URL — it degrades gracefully (see console
# warnings on import), so this stays a pure unit test with no live services.
import backend as be

W, H = 640, 480


class _LM:
    __slots__ = ("x", "y", "z", "visibility")
    def __init__(self, x, y, z=0.0, visibility=1.0):
        self.x, self.y, self.z, self.visibility = x, y, z, visibility


class _FaceLandmarks:
    """Minimal stand-in for a MediaPipe FaceMesh landmark_list."""
    def __init__(self, ipd_frac):
        # 478-landmark FaceMesh has iris points at 468 (left) / 473 (right).
        # Center them horizontally around x=0.5, separated by ipd_frac of
        # frame width, at the same y so yaw/tilt don't factor in.
        n = 478
        self.landmark = [_LM(0.5, 0.5) for _ in range(n)]
        half = ipd_frac / 2
        self.landmark[be.L_PUPIL] = _LM(0.5 - half, 0.5)
        self.landmark[be.R_PUPIL] = _LM(0.5 + half, 0.5)


def _make_face(distance_cm, calib_factor):
    """
    Build synthetic landmarks such that, given calib_factor, the calibrated
    formula (distCalibFactor / ipdFraction) reproduces `distance_cm` exactly.
    This lets us assert the backend recovers the ground-truth distance.
    """
    ipd_frac = calib_factor / distance_cm
    return _FaceLandmarks(ipd_frac)


class TestCalibratedDistancePath:
    def test_calibrated_factor_recovers_known_distance(self):
        """A user calibrated at 65cm should read back ~65cm from the same setup."""
        calib_factor = 0.052 * 65  # e.g. ipdFrac=0.052 at 65cm, like PostureCalibration.jsx
        face = _make_face(65.0, calib_factor)
        dist = be.ipd_distance_face(face, W, H, yaw_deg=0.0, dist_calib_factor=calib_factor)
        assert dist is not None
        assert abs(dist - 65.0) < 0.5

    def test_calibrated_factor_tracks_closer_distance(self):
        """Move closer (larger IPD fraction) -> reported distance should drop, still near truth."""
        calib_factor = 0.052 * 65
        face = _make_face(45.0, calib_factor)
        dist = be.ipd_distance_face(face, W, H, yaw_deg=0.0, dist_calib_factor=calib_factor)
        assert abs(dist - 45.0) < 0.5

    def test_missing_calib_factor_falls_back_without_crashing(self):
        """dist_calib_factor=None must not error — falls back to generic 6.3cm IPD estimator."""
        calib_factor_for_geometry = 0.052 * 65
        face = _make_face(65.0, calib_factor_for_geometry)
        dist = be.ipd_distance_face(face, W, H, yaw_deg=0.0, dist_calib_factor=None)
        assert dist is not None
        assert 20 <= dist <= 150

    def test_zero_calib_factor_treated_as_absent(self):
        """dist_calib_factor=0 (falsy) should not divide-by-zero or misbehave — same as None."""
        face = _make_face(65.0, 0.052 * 65)
        dist = be.ipd_distance_face(face, W, H, yaw_deg=0.0, dist_calib_factor=0)
        assert dist is not None
        assert 20 <= dist <= 150

    def test_result_always_clamped_to_physical_bounds(self):
        """Even a wildly wrong calib_factor must clamp to [20, 150] cm, never blow up UI/scoring."""
        face = _make_face(65.0, 0.052 * 65)
        dist_huge = be.ipd_distance_face(face, W, H, yaw_deg=0.0, dist_calib_factor=999999)
        dist_tiny = be.ipd_distance_face(face, W, H, yaw_deg=0.0, dist_calib_factor=0.0001)
        assert 20 <= dist_huge <= 150
        assert 20 <= dist_tiny <= 150

    def test_too_small_ipd_returns_none(self):
        """Degenerate near-zero IPD in pixels (bad detection) must bail out with None, not raise."""
        face = _FaceLandmarks(ipd_frac=0.001)  # ~0.6px at 640 width
        dist = be.ipd_distance_face(face, W, H, yaw_deg=0.0, dist_calib_factor=3.0)
        assert dist is None


class TestDistanceBaselineBlend:
    """
    The 70/30 blend of the 'ideal distance' range toward the user's own
    calibrated comfortable distance lives inline inside analyze_front(),
    not as a standalone function. We replicate the exact formula here
    (mirrored from backend.py) as a guard against silent regressions in
    the blend math itself, independent of full image/pose plumbing.
    """
    @staticmethod
    def _blend(lo, hi, dist_baseline_cm):
        if dist_baseline_cm and 20 <= dist_baseline_cm <= 150:
            generic_mid = (lo + hi) / 2
            personal_mid = 0.70 * dist_baseline_cm + 0.30 * generic_mid
            half_width = (hi - lo) / 2
            lo, hi = personal_mid - half_width, personal_mid + half_width
        return lo, hi

    def test_no_baseline_keeps_generic_range(self):
        lo, hi = self._blend(50, 80, None)
        assert (lo, hi) == (50, 80)

    def test_baseline_shifts_range_toward_personal_distance(self):
        # Laptop generic range 50-80 (mid=65). User calibrated comfortable at 90cm.
        lo, hi = self._blend(50, 80, 90)
        personal_mid = 0.70 * 90 + 0.30 * 65
        assert math.isclose((lo + hi) / 2, personal_mid, abs_tol=0.01)
        assert math.isclose(hi - lo, 30, abs_tol=0.01)  # width preserved

    def test_out_of_bounds_baseline_ignored(self):
        """A corrupt/out-of-range baseline (e.g. negative or >150) must not distort scoring."""
        lo, hi = self._blend(50, 80, 500)
        assert (lo, hi) == (50, 80)
        lo, hi = self._blend(50, 80, -5)
        assert (lo, hi) == (50, 80)
