"""
bench_train.py — learn a correction from camera estimates to hand-measured ground truth
using Posmoz Bench sessions (frontend /bench.html → posmoz-bench-*.json).

    python -m ai.bench_train --sessions data/bench --out reports/bench

Per target it fits a small ridge regression  truth ≈ w·features + b  and reports, with
LEAVE-ONE-SUBJECT-OUT cross-validation (each person is predicted by a model that never
saw them), MAE of the raw estimate vs the corrected one. Writes correction.json, which
frontend/src/features/analysis/correction.js applies in the browser.

A correction is only exported for a target when it beats the raw estimate in CV
and at least MIN_EXPORT_SUBJECTS people were recorded (LOSO on 2 people is fragile).
"""
from __future__ import annotations

import argparse
import glob
import json
import math
import os
from datetime import datetime, timezone

import numpy as np

# feature names per target — computed by step_features()
FEATURES = {
    "head_flexion_deg": ["pitch_rel"],
    "head_tilt_deg": ["roll", "eye_line_deg"],
    "shoulder_level_deg": ["shoulder_line_deg"],
    "protraction_cm": ["prot"],
}
MIN_EXPORT_SUBJECTS = 3
RAW_FEATURE = {"head_flexion_deg": "pitch_rel", "head_tilt_deg": "roll",
               "shoulder_level_deg": "shoulder_line_deg", "protraction_cm": "prot"}


def _line_deg(a, b):
    """Signed angle of the right→left line (+ = subject's left side lower), image y down."""
    dx, dy = a[0] - b[0], a[1] - b[1]
    if dx < 0:
        dx, dy = -dx, -dy
    return math.degrees(math.atan2(dy, dx))


def step_features(frames, calib, W, H):
    """Median of per-frame features over a recorded step."""
    neutral = ((calib or {}).get("head_pose_neutral") or {}).get("pitch", 0.0)
    rows = {k: [] for k in ("pitch_rel", "roll", "eye_line_deg", "shoulder_line_deg", "prot")}
    for f in frames:
        if f.get("head"):
            rows["pitch_rel"].append(f["head"][0] - neutral)
            rows["roll"].append(f["head"][2])
        L = f.get("fused") or f.get("raw")
        if L:
            P = lambda i: (L[i][0] * W, L[i][1] * H)
            rows["eye_line_deg"].append(_line_deg(P(2), P(5)))
            rows["shoulder_line_deg"].append(_line_deg(P(11), P(12)))
        if f.get("prot") is not None:
            rows["prot"].append(f["prot"])
    return {k: (float(np.median(v)) if v else math.nan) for k, v in rows.items()}


def load_samples(paths):
    out = []
    for p in paths:
        d = json.load(open(p, encoding="utf-8"))
        cam = d.get("camera") or {}
        W, H = cam.get("width") or 1280, cam.get("height") or 720
        for s in d["steps"]:
            out.append({"subject": d.get("subject", os.path.basename(p)), "target": s["target"],
                        "y": float(s["measured"]), **step_features(s["frames"], d.get("calib"), W, H)})
    return out


def ridge(X, y, alpha=1.0):
    Xa = np.column_stack([X, np.ones(len(X))])
    reg = alpha * np.eye(Xa.shape[1]); reg[-1, -1] = 0           # don't shrink the intercept
    w = np.linalg.solve(Xa.T @ Xa + reg, Xa.T @ y)
    return w[:-1], w[-1]


def evaluate(samples, alpha=1.0):
    report, export = {}, {}
    for target, feats in FEATURES.items():
        S = [s for s in samples if s["target"] == target and all(np.isfinite(s[f]) for f in feats)]
        subjects = sorted({s["subject"] for s in S})
        if len(S) < 4 or len(subjects) < 2:
            report[target] = {"n": len(S), "subjects": len(subjects), "note": "need ≥4 steps from ≥2 subjects"}
            continue
        X = np.array([[s[f] for f in feats] for s in S]); y = np.array([s["y"] for s in S])
        raw = np.array([s[RAW_FEATURE[target]] for s in S])
        pred = np.full(len(S), np.nan)
        for subj in subjects:                                     # leave-one-subject-out
            test = np.array([s["subject"] == subj for s in S])
            w, b = ridge(X[~test], y[~test], alpha)
            pred[test] = X[test] @ w + b
        mae_raw, mae_cv = float(np.mean(np.abs(raw - y))), float(np.mean(np.abs(pred - y)))
        w, b = ridge(X, y, alpha)                                 # final model on everything
        report[target] = {"n": len(S), "subjects": len(subjects), "mae_raw": round(mae_raw, 3),
                          "mae_corrected_loso": round(mae_cv, 3), "improved": mae_cv < mae_raw}
        if mae_cv < mae_raw and len(subjects) >= MIN_EXPORT_SUBJECTS:
            export[target] = {"features": feats, "weights": [round(float(v), 6) for v in w],
                              "intercept": round(float(b), 6), "mae_loso": round(mae_cv, 3)}
    return report, export


def main(argv=None):
    ap = argparse.ArgumentParser(description="Posmoz Bench → correction model")
    ap.add_argument("--sessions", required=True, help="folder with posmoz-bench-*.json")
    ap.add_argument("--out", default="reports/bench")
    ap.add_argument("--alpha", type=float, default=1.0)
    a = ap.parse_args(argv)
    paths = sorted(glob.glob(os.path.join(a.sessions, "*.json")))
    report, export = evaluate(load_samples(paths), a.alpha)
    os.makedirs(a.out, exist_ok=True)
    meta = {"created": datetime.now(timezone.utc).isoformat(timespec="seconds"), "sessions": len(paths)}
    json.dump({"meta": meta, "report": report}, open(os.path.join(a.out, "bench_report.json"), "w"), indent=2)
    json.dump({"version": 1, **meta, "targets": export}, open(os.path.join(a.out, "correction.json"), "w"), indent=2)
    for t, r in report.items():
        print(t, r)


if __name__ == "__main__":
    main()
