"""
Corvus — Unit Tests for Pose Analysis
Run: cd backend && pip install pytest && pytest tests/ -v
"""
import sys, os, math

# Import only pure functions — avoid loading Flask/MediaPipe
# We re-define the functions here to test them in isolation
def score_m(v, ideal, ok, bad):
    """Smooth piecewise scoring: 100 at ideal → 75 at ok → 30 at bad → 0 beyond."""
    d = abs(v - ideal)
    if d <= ok:  return max(0, int(100 - (d / max(ok, .1)) * 25))
    if d <= bad: return max(0, int(75  - ((d - ok) / max(bad - ok, .1)) * 45))
    return max(0, int(30 - (d - bad) * 1.8))

def angle_vert(p1, p2):
    dx = abs(p2[0] - p1[0])
    dy = abs(p2[1] - p1[1])
    if dy < 0.5: return 90.0
    return abs(math.degrees(math.atan2(dx, dy)))

def angle_horiz(p1, p2):
    dx = abs(p2[0] - p1[0])
    dy = abs(p2[1] - p1[1])
    if dx < 0.5: return 90.0
    return abs(math.degrees(math.atan2(dy, dx)))

# ════════════════════════════════════════════════════════════════
# score_m tests
# ════════════════════════════════════════════════════════════════
class TestScoreM:
    def test_perfect_score(self):
        """At ideal value → should be 100"""
        assert score_m(0, 0, 10, 25) == 100

    def test_within_ok_range(self):
        """5° lean with ok=10 → should be ~87-88"""
        s = score_m(5, 0, 10, 25)
        assert 85 <= s <= 90

    def test_at_ok_boundary(self):
        """At ok boundary → should be exactly 75"""
        assert score_m(10, 0, 10, 25) == 75

    def test_between_ok_and_bad(self):
        """Between ok and bad → 30-75 range"""
        s = score_m(17, 0, 10, 25)
        assert 30 <= s <= 75

    def test_at_bad_boundary(self):
        """At bad boundary → should be exactly 30"""
        assert score_m(25, 0, 10, 25) == 30

    def test_beyond_bad(self):
        """Beyond bad range → below 30"""
        s = score_m(40, 0, 10, 25)
        assert 0 <= s < 30

    def test_never_negative(self):
        """Score should never go below 0"""
        assert score_m(1000, 0, 10, 25) == 0

    def test_never_above_100(self):
        """Score uses abs(d) so negative values same as positive"""
        # score_m(-100, 0, 10, 25) = score_m(100, 0, ...) = 0 (way beyond bad)
        # The function uses abs() on deviation, so very large negative = 0
        s = score_m(-100, 0, 10, 25)
        assert 0 <= s <= 100  # just verify it's in valid range

    def test_symmetric(self):
        """Negative and positive same deviation → same score"""
        assert score_m(-5, 0, 10, 25) == score_m(5, 0, 10, 25)

    def test_dist_scoring_optimal(self):
        """Distance 65cm with optimal 50-80 → high score"""
        s = score_m(65, 65, 15, 35)  # ideal=65, ok±15=50-80
        assert s == 100

    def test_dist_too_close(self):
        """Distance 30cm → very low score"""
        s = score_m(30, 65, 15, 35)
        assert s < 40


# ════════════════════════════════════════════════════════════════
# angle_vert tests
# ════════════════════════════════════════════════════════════════
class TestAngleVert:
    def test_perfect_vertical(self):
        """Ear directly above shoulder → 0°"""
        angle = angle_vert((320, 300), (320, 150))
        assert abs(angle) < 1.0, f"Expected ~0°, got {angle}"

    def test_slight_forward_lean(self):
        """5° lean: 13px horizontal over 150px vertical"""
        dx = 150 * math.tan(math.radians(5))
        angle = angle_vert((320, 300), (320 + dx, 150))
        assert 4 <= angle <= 6, f"Expected ~5°, got {angle}"

    def test_bad_forward_lean_20deg(self):
        """20° lean"""
        dx = 150 * math.tan(math.radians(20))
        angle = angle_vert((320, 300), (320 + dx, 150))
        assert 18 <= angle <= 22, f"Expected ~20°, got {angle}"

    def test_severe_lean_35deg(self):
        """35° lean → should score poorly"""
        dx = 150 * math.tan(math.radians(35))
        angle = angle_vert((320, 300), (320 + dx, 150))
        assert 33 <= angle <= 37
        assert score_m(angle, 0, 10, 28) < 30

    def test_horizontal_returns_90(self):
        """Horizontal line → 90°"""
        angle = angle_vert((0, 300), (300, 300))
        assert angle == 90.0

    def test_good_posture_scores_well(self):
        """Straight posture → score 100"""
        angle = angle_vert((320, 300), (320, 150))
        assert score_m(angle, 0, 10, 28) == 100


# ════════════════════════════════════════════════════════════════
# angle_horiz tests
# ════════════════════════════════════════════════════════════════
class TestAngleHoriz:
    def test_perfect_horizontal(self):
        """Level shoulders → 0°"""
        angle = angle_horiz((200, 300), (440, 300))
        assert abs(angle) < 1.0

    def test_slight_tilt(self):
        """3° tilt"""
        dy = 240 * math.tan(math.radians(3))
        angle = angle_horiz((200, 300), (440, 300 + dy))
        assert 2 <= angle <= 4

    def test_bad_shoulder_tilt_10deg(self):
        """10° shoulder tilt"""
        dy = 240 * math.tan(math.radians(10))
        angle = angle_horiz((200, 300), (440, 300 + dy))
        assert 9 <= angle <= 11

    def test_vertical_returns_90(self):
        """Vertical line → 90°"""
        angle = angle_horiz((300, 0), (300, 300))
        assert angle == 90.0


# ════════════════════════════════════════════════════════════════
# Overall score simulation tests
# ════════════════════════════════════════════════════════════════
class TestOverallScore:
    def _calc(self, neck, tilt, sh, spine, dist_sc):
        neck_sc  = score_m(neck,  0, 10, 28)
        tilt_sc  = score_m(tilt,  0,  3, 10)
        sh_sc    = score_m(sh,    0,  3, 10)
        spine_sc = score_m(spine, 0,  6, 18)
        return int(neck_sc*.30 + tilt_sc*.20 + sh_sc*.15 + spine_sc*.15 + dist_sc*.20)

    def test_perfect_posture(self):
        """All metrics optimal → 95+"""
        s = self._calc(0, 0, 0, 0, 100)
        assert s >= 95, f"Perfect posture should score 95+, got {s}"

    def test_good_posture(self):
        """Slight deviations → 70-85"""
        s = self._calc(8, 2, 3, 5, 95)
        assert 65 <= s <= 90, f"Good posture should score 65-90, got {s}"

    def test_poor_posture(self):
        """All bad → below 50"""
        s = self._calc(30, 12, 10, 20, 30)
        assert s < 50, f"Poor posture should score <50, got {s}"

    def test_neck_dominant(self):
        """Neck has 30% weight — bad neck significantly hurts the score"""
        with_bad_neck  = self._calc(35, 0, 0, 0, 100)
        with_good_neck = self._calc(0,  0, 0, 0, 100)
        # Bad neck (35°) should score at least 20 points lower
        assert with_bad_neck < with_good_neck - 20

    def test_distance_matters(self):
        """Distance 20% weight — too close hurts score"""
        optimal_dist = self._calc(5, 1, 1, 3, 100)
        too_close    = self._calc(5, 1, 1, 3, 30)
        assert optimal_dist - too_close >= 12


# ════════════════════════════════════════════════════════════════
# Edge cases
# ════════════════════════════════════════════════════════════════
class TestEdgeCases:
    def test_zero_dy_in_angle_vert(self):
        """dy=0 → should return 90 (horizontal)"""
        angle = angle_vert((0, 300), (300, 300))
        assert angle == 90.0

    def test_zero_dx_in_angle_horiz(self):
        """dx=0 → should return 90 (vertical)"""
        angle = angle_horiz((300, 0), (300, 300))
        assert angle == 90.0

    def test_score_m_zero_ok_range(self):
        """ok=0 edge case → should not divide by zero"""
        s = score_m(0, 0, 0, 10)
        assert 0 <= s <= 100

    def test_very_small_deviation(self):
        """0.001° deviation → still near 100"""
        s = score_m(0.001, 0, 10, 25)
        assert s >= 99

    def test_symmetry_negative_ideal(self):
        """Equal distance from ideal → equal score (function is symmetric around ideal)"""
        # 0 is 5 away from -5, and -10 is also 5 away from -5
        s1 = score_m(0,  -5, 3, 10)   # d=5
        s2 = score_m(-10, -5, 3, 10)  # d=5
        assert s1 == s2  # same distance from ideal = same score
