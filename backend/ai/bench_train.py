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

It also writes bench_report.md: how far the camera estimate is from the hand measurement
per target (bias, spread, 95 % limits of agreement, worst case), and the same broken down
by any condition you supply:

    python -m ai.bench_train --sessions data/bench --participants data/participants.csv

participants.csv has a `subject` column (the code typed into the recorder) and one column
per condition, e.g. `hijab,glasses,lighting,device`.

Sessions recorded with different pipelines (different models or delegates, see the
`pipeline` field of each step) are never pooled: each pipeline is reported on its own, and
the correction is trained on the one with the most subjects.

These are agreement figures on the people recorded. They are not a validation study and
must not be quoted as product accuracy.
"""
from __future__ import annotations

import argparse
import csv
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
                        "step": s.get("id"), "pipeline": s.get("pipeline") or d.get("pipeline") or "unknown",
                        "measure_version": d.get("measure_version") or "unknown",
                        "y": float(s["measured"]), **step_features(s["frames"], d.get("calib"), W, H)})
    return out


def load_participants(path):
    """participants.csv → {subject: {condition: level}}. Empty cells are left out."""
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if rows and "subject" not in rows[0]:
        raise SystemExit("participants file needs a 'subject' column")
    return {r["subject"].strip(): {k: v.strip() for k, v in r.items() if k != "subject" and v and v.strip()} for r in rows}


def agreement(errors):
    """Camera estimate minus hand measurement, summarised. `errors` is a list of floats."""
    e = np.asarray(errors, dtype=float)
    n = len(e)
    if n == 0:
        return {"n": 0}
    bias = float(np.mean(e))
    sd = float(np.std(e, ddof=1)) if n > 1 else None
    out = {"n": n, "bias": round(bias, 3), "mae": round(float(np.mean(np.abs(e))), 3),
           "max_abs": round(float(np.max(np.abs(e))), 3), "sd": None if sd is None else round(sd, 3)}
    if sd is not None:
        out["loa_low"], out["loa_high"] = round(bias - 1.96 * sd, 3), round(bias + 1.96 * sd, 3)
    return out


def accuracy_report(samples, participants=None):
    """
    Raw camera estimate against the hand measurement, per pipeline and target, and per
    level of every condition in `participants`. Nothing is pooled across pipelines.
    """
    participants = participants or {}
    conditions = sorted({k for v in participants.values() for k in v})
    report = {}
    for pipe in sorted({s["pipeline"] for s in samples}):
        P = [s for s in samples if s["pipeline"] == pipe]
        targets = {}
        for target, raw_f in RAW_FEATURE.items():
            S = [s for s in P if s["target"] == target and np.isfinite(s[raw_f])]
            if not S:
                continue
            row = {**agreement([s[raw_f] - s["y"] for s in S]), "subjects": len({s["subject"] for s in S}), "by": {}}
            for c in conditions:
                levels = {}
                for s in S:
                    lv = participants.get(s["subject"], {}).get(c)
                    if lv is not None:
                        levels.setdefault(lv, []).append(s)
                row["by"][c] = {lv: {**agreement([x[raw_f] - x["y"] for x in xs]), "subjects": len({x["subject"] for x in xs})}
                                for lv, xs in sorted(levels.items())}
            targets[target] = row
        report[pipe] = {"subjects": len({s["subject"] for s in P}), "steps": len(P), "targets": targets}
    return report


def report_markdown(acc, corr_report, meta):
    f = lambda v: "" if v is None else (f"{v:+.2f}" if isinstance(v, float) else str(v))
    L = ["# Posmoz Bench report", "", f"Created {meta['created']} from {meta['sessions']} session files.",
         f"Measure version: {', '.join(meta['measure_versions'])}", ""]
    if len(meta["measure_versions"]) > 1:
        L += ["**WARNING: sessions from different measure versions are mixed in this folder.**", ""]
    if len(acc) > 1:
        L += ["**More than one pipeline was recorded. Each is reported separately below; do not add them up.**", ""]
    L += ["Error = camera estimate minus hand measurement. These are agreement figures for the people",
          "recorded here, not a validation study, and must not be quoted as product accuracy.", ""]
    for pipe, P in acc.items():
        L += [f"## Pipeline `{pipe}`", "", f"{P['subjects']} subjects, {P['steps']} recorded steps.", "",
              "| Target | Steps | Subjects | Bias | SD | 95% limits of agreement | Mean abs error | Worst |", "|---|---|---|---|---|---|---|---|"]
        for t, r in P["targets"].items():
            loa = f"{f(r.get('loa_low'))} to {f(r.get('loa_high'))}" if r.get("sd") is not None else ""
            L.append(f"| {t} | {r['n']} | {r['subjects']} | {f(r['bias'])} | {'' if r['sd'] is None else r['sd']} | {loa} | {r['mae']} | {r['max_abs']} |")
        for t, r in P["targets"].items():
            for c, levels in r["by"].items():
                if not levels:
                    continue
                L += ["", f"### {t} by {c}", "", "| Level | Steps | Subjects | Bias | Mean abs error | Worst |", "|---|---|---|---|---|---|"]
                for lv, a in levels.items():
                    L.append(f"| {lv} | {a['n']} | {a['subjects']} | {f(a['bias'])} | {a['mae']} | {a['max_abs']} |")
        L.append("")
    L += [f"## Correction (pipeline `{meta['correction_pipeline']}`, leave-one-subject-out)", "",
          "| Target | Steps | Subjects | Mean abs error, raw | Mean abs error, corrected | Exported |", "|---|---|---|---|---|---|"]
    for t, r in corr_report.items():
        if "note" in r:
            L.append(f"| {t} | {r['n']} | {r['subjects']} | | | no: {r['note']} |")
        else:
            L.append(f"| {t} | {r['n']} | {r['subjects']} | {r['mae_raw']} | {r['mae_corrected_loso']} | {'yes' if t in meta['exported'] else 'no'} |")
    L += ["", f"A correction is exported only when it beats the raw estimate on unseen subjects and at least {MIN_EXPORT_SUBJECTS} people were recorded.", ""]
    return "\n".join(L)


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
    ap = argparse.ArgumentParser(description="Posmoz Bench → accuracy report and correction model")
    ap.add_argument("--sessions", required=True, help="folder with posmoz-bench-*.json")
    ap.add_argument("--participants", help="CSV with a 'subject' column and one column per condition")
    ap.add_argument("--out", default="reports/bench")
    ap.add_argument("--alpha", type=float, default=1.0)
    a = ap.parse_args(argv)
    paths = sorted(glob.glob(os.path.join(a.sessions, "*.json")))
    samples = load_samples(paths)
    acc = accuracy_report(samples, load_participants(a.participants) if a.participants else None)
    # the correction is trained on ONE pipeline: the one with the most subjects
    pipe = max(acc, key=lambda k: (acc[k]["subjects"], acc[k]["steps"])) if acc else "unknown"
    report, export = evaluate([s for s in samples if s["pipeline"] == pipe], a.alpha)
    os.makedirs(a.out, exist_ok=True)
    meta = {"created": datetime.now(timezone.utc).isoformat(timespec="seconds"), "sessions": len(paths),
            "measure_versions": sorted({s["measure_version"] for s in samples}) or ["unknown"],
            "correction_pipeline": pipe, "exported": sorted(export)}
    json.dump({"meta": meta, "report": report, "accuracy": acc}, open(os.path.join(a.out, "bench_report.json"), "w"), indent=2)
    json.dump({"version": 1, **meta, "pipeline": pipe, "targets": export}, open(os.path.join(a.out, "correction.json"), "w"), indent=2)
    with open(os.path.join(a.out, "bench_report.md"), "w", encoding="utf-8") as fh:
        fh.write(report_markdown(acc, report, meta))
    for t, r in report.items():
        print(t, r)
    if len(acc) > 1:
        print(f"NOTE: {len(acc)} pipelines recorded; correction trained on {pipe} only")
    print(f"Wrote {os.path.join(a.out, 'bench_report.md')}")


if __name__ == "__main__":
    main()
