"""bench_train on simulated sessions: a biased, scaled camera estimate gets corrected."""
import json
import math
import os
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ai.bench_train import evaluate, load_samples, accuracy_report, agreement, load_participants, main  # noqa: E402


def fake_session(path, subject, rng, scale=0.8, bias=2.0, pipeline=None):
    """Head flexion: camera reads 0.8·truth + 2 + per-subject offset + noise."""
    offset = rng.normal(0, 1.0)
    steps = []
    for truth in (0, 10, 15, 20, 30, 35):
        frames = [{"t": i, "raw": None, "fused": None,
                   "head": [scale * truth + bias + offset + rng.normal(0, 0.8), 0.0, 0.0],
                   "iris": None, "dist": None, "prot": None} for i in range(10)]
        steps.append({"id": f"f{truth}", "target": "head_flexion_deg", "measured": truth, "frames": frames,
                      **({"pipeline": pipeline} if pipeline else {})})
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


class TestAccuracyReport(unittest.TestCase):
    def test_agreement_numbers(self):
        a = agreement([1.0, 3.0, -1.0, 1.0])
        self.assertEqual(a["n"], 4)
        self.assertAlmostEqual(a["bias"], 1.0)
        self.assertAlmostEqual(a["mae"], 1.5)
        self.assertAlmostEqual(a["max_abs"], 3.0)
        self.assertAlmostEqual(a["sd"], 1.633, places=3)
        self.assertAlmostEqual(a["loa_low"], 1.0 - 1.96 * 1.633, places=2)
        self.assertEqual(agreement([]), {"n": 0})
        self.assertIsNone(agreement([2.0])["sd"])

    def test_pipelines_are_never_pooled_and_conditions_split(self):
        rng = np.random.default_rng(5)
        with tempfile.TemporaryDirectory() as d:
            paths = []
            for k in range(4):                                   # camera reads truth + 2 on pipeline A
                p = os.path.join(d, f"a{k}.json"); fake_session(p, f"A{k}", rng, scale=1.0, bias=2.0, pipeline="A"); paths.append(p)
            for k in range(2):                                   # and truth + 8 on pipeline B
                p = os.path.join(d, f"b{k}.json"); fake_session(p, f"B{k}", rng, scale=1.0, bias=8.0, pipeline="B"); paths.append(p)
            pfile = os.path.join(d, "p.csv")
            with open(pfile, "w") as f:
                f.write("subject,glasses\nA0,yes\nA1,yes\nA2,no\nA3,no\nB0,no\nB1,\n")
            acc = accuracy_report(load_samples(paths), load_participants(pfile))
            self.assertEqual(sorted(acc), ["A", "B"])
            a, b = acc["A"]["targets"]["head_flexion_deg"], acc["B"]["targets"]["head_flexion_deg"]
            self.assertEqual((acc["A"]["subjects"], a["n"]), (4, 24))
            self.assertLess(abs(a["bias"] - 2.0), 1.2)           # per-subject offsets, SD 1
            self.assertGreater(b["bias"], 5.5)                   # not averaged into A
            self.assertEqual({k: v["subjects"] for k, v in a["by"]["glasses"].items()}, {"no": 2, "yes": 2})
            self.assertEqual(b["by"]["glasses"]["no"]["subjects"], 1)     # B1 has no value: left out

            out = os.path.join(d, "out")
            main(["--sessions", d, "--participants", pfile, "--out", out])
            md = open(os.path.join(out, "bench_report.md"), encoding="utf-8").read()
            self.assertIn("More than one pipeline", md)
            self.assertIn("not a validation study", md)
            corr = json.load(open(os.path.join(out, "correction.json")))
            self.assertEqual(corr["pipeline"], "A")              # most subjects

    def test_sessions_without_a_pipeline_field_still_load(self):
        rng = np.random.default_rng(2)
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "s.json"); fake_session(p, "S01", rng)
            self.assertEqual(list(accuracy_report(load_samples([p]))), ["unknown"])


if __name__ == "__main__":
    unittest.main()
