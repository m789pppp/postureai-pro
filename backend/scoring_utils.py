"""
scoring_utils.py — Corvus posture-scoring primitives

Pure-Python, zero heavy dependencies (no Flask/MediaPipe/Firebase/numpy).
This exists so backend.py and tests/*.py can import the exact SAME
implementation of these functions, instead of the test suite maintaining
its own hand-copied duplicate that can silently drift from what's actually
running in production. (That drift is exactly how a real bug — swapped
ok/bad thresholds in a score_m() call — shipped to production while a
same-named-but-different local copy in the test suite kept passing.)

If you change scoring behavior, change it here — backend.py imports these
directly, it does not have its own copies.
"""
import math


def dist2d_sq(a, b):
    """Squared distance — use for comparisons to avoid sqrt overhead."""
    return (a[0]-b[0])**2 + (a[1]-b[1])**2


def angle_vert(p1, p2):
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    if abs(dy) < 0.5:
        return 90.0
    return abs(math.degrees(math.atan2(abs(dx), abs(dy))))


def angle_horiz(p1, p2):
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    if abs(dx) < 0.5:
        return 90.0
    return abs(math.degrees(math.atan2(abs(dy), abs(dx))))


def angle_3pt(a, b, c):
    """Angle at point b in triangle abc — pure Python, no numpy overhead."""
    v1x, v1y = a[0]-b[0], a[1]-b[1]
    v2x, v2y = c[0]-b[0], c[1]-b[1]
    n1 = math.sqrt(v1x*v1x + v1y*v1y)
    n2 = math.sqrt(v2x*v2x + v2y*v2y)
    if n1 < 0.001 or n2 < 0.001: return 90.0
    cos_a = (v1x*v2x + v1y*v2y) / (n1 * n2)
    return math.degrees(math.acos(max(-1.0, min(1.0, cos_a))))


def angle_3pt_3d(a, b, c):
    """3D angle at b using landmark (x,y,z) — more accurate for wrist/elbow."""
    v1x,v1y,v1z = a[0]-b[0], a[1]-b[1], a[2]-b[2]
    v2x,v2y,v2z = c[0]-b[0], c[1]-b[1], c[2]-b[2]
    n1 = math.sqrt(v1x*v1x + v1y*v1y + v1z*v1z)
    n2 = math.sqrt(v2x*v2x + v2y*v2y + v2z*v2z)
    if n1 < 0.001 or n2 < 0.001: return 90.0
    cos_a = (v1x*v2x + v1y*v2y + v1z*v2z) / (n1 * n2)
    return math.degrees(math.acos(max(-1.0, min(1.0, cos_a))))


def score_m(v, ideal, ok, bad):
    """
    Piecewise ergonomic score (0-100):
    - ok zone  [0, ok]:       100 -> 75  (linear — comfortable range)
    - bad zone [ok, bad]:     75  -> 30  (linear — attention needed)
    - beyond bad:             30  -> 5   (quadratic — injury risk zone)

    Quadratic beyond bad: small extra deviations are forgiven,
    large ones (e.g. 40 degree neck lean) hit 5 fast.
    Mirrors ergonomic research: MSK injury risk is non-linear.
    """
    d = abs(v - ideal)
    if bad < ok:
        # Defensive: a swapped ok/bad call (like the shoulder-elevation bug
        # this was written to prevent from recurring) would otherwise skip
        # the middle "attention needed" zone entirely and produce a scoring
        # cliff — auto-correct the order instead of failing silently.
        ok, bad = bad, ok
    if d <= ok:
        return max(0, int(100 - (d / max(ok, .1)) * 25))
    if d <= bad:
        return max(0, int(75  - ((d - ok) / max(bad - ok, .1)) * 45))
    # Beyond bad: quadratic decay -> floor 5
    excess = d - bad
    decay  = min(25, excess ** 1.6 * 0.9)  # quadratic, capped at 25
    return max(5, int(30 - decay))
