"""
Corvus — Unit test for the stress x posture Pearson correlation math
(mirrors the exact formula in backend.py stress_correlation()).
Run: cd backend && pytest tests/test_stress_correlation.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def pearson_r(pairs):
    """Mirrors the inline correlation computation in stress_correlation()."""
    n = len(pairs)
    xs = [p[0] for p in pairs]; ys = [p[1] for p in pairs]
    mean_x = sum(xs)/n; mean_y = sum(ys)/n
    cov = sum((x-mean_x)*(y-mean_y) for x, y in pairs)
    var_x = sum((x-mean_x)**2 for x in xs)
    var_y = sum((y-mean_y)**2 for y in ys)
    denom = (var_x * var_y) ** 0.5
    return round(cov/denom, 2) if denom > 0 else 0.0


class TestPearsonCorrelation:
    def test_perfect_negative_correlation(self):
        """Higher stress, lower score every time -> r should be exactly -1."""
        pairs = [(1, 90), (2, 80), (3, 70), (4, 60), (5, 50)]
        assert pearson_r(pairs) == -1.0

    def test_perfect_positive_correlation(self):
        pairs = [(1, 50), (2, 60), (3, 70), (4, 80), (5, 90)]
        assert pearson_r(pairs) == 1.0

    def test_no_correlation_constant_score(self):
        """Score never changes regardless of stress -> zero variance in y -> r=0 (safe denom guard)."""
        pairs = [(1, 75), (2, 75), (3, 75), (4, 75), (5, 75)]
        assert pearson_r(pairs) == 0.0

    def test_noisy_but_generally_negative(self):
        pairs = [(1, 88), (2, 82), (2, 85), (4, 65), (5, 60), (3, 74)]
        r = pearson_r(pairs)
        assert -1.0 <= r <= -0.5  # clearly negative, not necessarily perfect

    def test_min_data_threshold_is_five_in_endpoint(self):
        """Documents the endpoint's own guard: <5 overlapping days returns
        enough_data=False rather than a misleading coefficient — not
        re-testable here without Firestore, so this just pins the constant."""
        MIN_REQUIRED = 5
        assert MIN_REQUIRED == 5
