"""bench_train on simulated sessions: a biased, scaled camera estimate gets corrected."""
import json
import math
import os
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ai.bench_train import evaluate, load_samples  # noqa: E402


def fake_session(path, subject, rng, scale=0.8, bias=2.0):
    """Head flexion: camera reads 0.8·truth + 2 + per-subject offset + noise."""
    offset = rng.normal(0, 1.0)
    steps = []
    for truth in (0, 10, 15, 20, 30, 35):
        frames = [{"t": i, "raw": None, "fused": None,
                   "head": [scale * truth + bias + offset + rng.normal(0, 0.8), 0.0, 0.0],
                   "iris": None, "dist": None, "prot": None} for i in range(10)]
        steps.append({"id": f"f{truth}", "target": "head_flexion_deg", "measured": truth, "frames": frames})
    json.dump({"bench_version": 1, "subject": subject, "camera": {"width": 1280, "height": 720},
               "calib": {"head_pose_neutral": {"pitch": 0}}, "steps": steps}, open(path, "w"))


class TestBenchTrain(unittest.TestCase):
    def test_correction_beats_raw_on_unseen_subjects(self):
        rng = np.random.default_rng(3)
        with tempfile.TemporaryDirectory() as d:
            paths = []
            for k in range(6):
                p = os.path.join(d, f"s{k}.json"); fake_session(p, f"S{k:02d}", rng); paths.append(p)
            report, export = evaluate(load_samples(paths))
        r = report["head_flexion_deg"]
        self.assertTrue(r["improved"], r)
        # residual floor ≈ the per-subject offset the simulation adds on purpose (SD 1°/0.8)
        self.assertLess(r["mae_corrected_loso"], 0.6 * r["mae_raw"], r)
        w = export["head_flexion_deg"]["weights"][0]
        self.assertAlmostEqual(w, 1 / 0.8, delta=0.1)            # learned the inverse scale

    def test_needs_two_subjects(self):
        rng = np.random.default_rng(1)
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "s.json"); fake_session(p, "S01", rng)
            report, export = evaluate(load_samples([p]))
        self.assertIn("note", report["head_flexion_deg"])
        self.assertEqual(export, {})


if __name__ == "__main__":
    unittest.main()
