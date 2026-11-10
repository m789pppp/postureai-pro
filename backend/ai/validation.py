"""
validation.py — compare each pose engine (and the ensemble) with the doctor's
measurements, learn ensemble weights, and report agreement statistics.

CSV (one row per photo, UTF-8):
    image,view,head_tilt_deg,shoulder_level_deg,pelvic_level_deg,trunk_lean_deg,cva_proxy_deg
    p01_front.jpg,front,2.1,-1.5,0.8,1.2,
    p01_side.jpg,side,,,,4.0,48.5
  - image: path relative to the CSV file
  - view : front | side
  - metric columns: doctor's value in degrees; leave empty if not measured.
    Any subset of METRICS may be present.

Sign convention (2-D image, y down):
  *_level / head_tilt : + = subject's LEFT side lower      (front view)
  trunk_lean          : + = shoulders toward image right    (front: lateral, side: sagittal)
  cva_proxy           : angle between horizontal and the shoulder→ear line on the
                        visible side (side view). Clinical CVA uses C7–tragus; this is
                        a landmark PROXY and must be validated against the doctor.

Run (from backend/):
    python -m ai.validation --csv data/validation.csv --models pose_models --out reports
    python -m ai.validation ... --holdout 0.3    # fit on 70 %, report on unseen 30 %
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import random
from datetime import datetime, timezone

import numpy as np

# metric → (views it is valid in, landmark indices it uses)
METRICS = {
    "head_tilt_deg":      ({"front"}, (2, 5)),
    "shoulder_level_deg": ({"front"}, (11, 12)),
    "pelvic_level_deg":   ({"front"}, (23, 24)),
    "trunk_lean_deg":     ({"front", "side"}, (11, 12, 23, 24)),
    "cva_proxy_deg":      ({"side"}, (7, 8, 11, 12)),
}


# ── metric computation (signed, pixel coords) ─────────────────────────────
def _ok(p):
    return p is not None and not np.isnan(p[0])


def _tilt(right, left):
    """Signed angle of right→left line vs horizontal; + = left point lower."""
    dx, dy = left[0] - right[0], left[1] - right[1]
    if dx < 0:                       # mirrored / side view: keep direction consistent
        dx, dy = -dx, -dy
    return math.degrees(math.atan2(dy, dx))


def compute_metrics(pts: np.ndarray, view: str) -> dict:
    """pts: (33,4) x,y,z,conf in pixels. Returns {metric: value or None}."""
    P = lambda i: pts[i] if not np.isnan(pts[i][0]) else None
    out = {m: None for m in METRICS}
    if view == "front":
        sw = (math.hypot(*(pts[11][:2] - pts[12][:2]))
              if _ok(P(11)) and _ok(P(12)) else 0.0)
        # eyes must be clearly apart (face toward camera); a turned head makes
        # the eye line meaningless, so report "not measurable" instead of a number
        if _ok(P(2)) and _ok(P(5)) and sw and \
                math.hypot(*(pts[2][:2] - pts[5][:2])) >= 0.12 * sw:
            out["head_tilt_deg"] = _tilt(P(5), P(2))
        if _ok(P(11)) and _ok(P(12)):
            out["shoulder_level_deg"] = _tilt(P(12), P(11))
        if _ok(P(23)) and _ok(P(24)):
            out["pelvic_level_deg"] = _tilt(P(24), P(23))
    if all(_ok(P(i)) for i in (11, 12, 23, 24)):
        sm = (pts[11][:2] + pts[12][:2]) / 2
        hm = (pts[23][:2] + pts[24][:2]) / 2
        dx, dy = sm[0] - hm[0], hm[1] - sm[1]        # dy > 0 when shoulders above hips
        if dy > 1:
            out["trunk_lean_deg"] = math.degrees(math.atan2(dx, dy))
    if view == "side":
        # use the side the camera sees best (higher ear+shoulder confidence)
        sides = [(7, 11), (8, 12)]
        best = max(sides, key=lambda s: np.nan_to_num(pts[s[0]][3] + pts[s[1]][3]))
        ear, sh = P(best[0]), P(best[1])
        if _ok(ear) and _ok(sh):
            dx, dy = abs(ear[0] - sh[0]), sh[1] - ear[1]
            if dy > 0:
                out["cva_proxy_deg"] = math.degrees(math.atan2(dy, dx))
    return out


# ── agreement statistics ──────────────────────────────────────────────────
def icc_2_1(a, b) -> float:
    """ICC(2,1): two-way random, absolute agreement, single measure (Shrout & Fleiss)."""
    x = np.column_stack([a, b]).astype(float)
    n, k = x.shape
    if n < 3:
        return float("nan")
    gm = x.mean()
    ss_r = k * ((x.mean(1) - gm) ** 2).sum()
    ss_c = n * ((x.mean(0) - gm) ** 2).sum()
    ss_e = ((x - gm) ** 2).sum() - ss_r - ss_c
    msr, msc, mse = ss_r / (n - 1), ss_c / (k - 1), ss_e / ((n - 1) * (k - 1))
    den = msr + (k - 1) * mse + k * (msc - mse) / n
    return float((msr - mse) / den) if den else float("nan")


def agreement(pred, ref) -> dict:
    pred, ref = np.asarray(pred, float), np.asarray(ref, float)
    d = pred - ref
    n = len(d)
    if n == 0:
        return {"n": 0}
    sd = float(d.std(ddof=1)) if n > 1 else float("nan")
    bias = float(d.mean())
    return {
        "n": n,
        "mae": float(np.abs(d).mean()),
        "rmse": float(math.sqrt((d ** 2).mean())),
        "bias": bias,
        "loa_low": bias - 1.96 * sd,
        "loa_high": bias + 1.96 * sd,
        "icc_2_1": icc_2_1(pred, ref),
    }


# ── pipeline ──────────────────────────────────────────────────────────────
def load_rows(csv_path):
    base = os.path.dirname(os.path.abspath(csv_path))
    rows = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            ref = {}
            for m in METRICS:
                v = (r.get(m) or "").strip()
                if v:
                    ref[m] = float(v)
            rows.append({"image": os.path.join(base, r["image"].strip()),
                         "view": (r.get("view") or "front").strip().lower(),
                         "ref": ref})
    return rows


def predict_all(rows, ensemble):
    """Adds row['pred'][source][metric] for every engine + 'fused'."""
    import cv2
    for r in rows:
        img = cv2.imread(r["image"])
        r["pred"], r["reliable"] = {}, None
        if img is None:
            r["error"] = "cannot read image"
            continue
        res = ensemble.run(img)
        r["reliable"] = res["reliable"]
        for name, pts in res["engines"].items():
            r["pred"][name] = compute_metrics(pts, r["view"])
        r["pred"]["fused"] = compute_metrics(res["fused"], r["view"])
        r["spread"] = metric_spread({n: r["pred"][n] for n in res["engines"]})
    return rows


SPREAD_FLAG_DEG = 5.0   # engines disagreeing more than this → metric needs review


def metric_spread(per_engine: dict) -> dict:
    """{metric: max-min across engines} — a per-metric reliability signal."""
    out = {}
    for m in METRICS:
        vals = [p.get(m) for p in per_engine.values() if p.get(m) is not None]
        if len(vals) >= 2:
            out[m] = float(max(vals) - min(vals))
    return out


def _pairs(rows, source, metric):
    p, t = [], []
    for r in rows:
        v = r.get("pred", {}).get(source, {}).get(metric)
        if v is not None and metric in r["ref"]:
            p.append(v); t.append(r["ref"][metric])
    return p, t


def fit_weights(rows, engine_names) -> dict:
    """Per metric: engine weight ∝ 1/MSE vs doctor. Landmark weights = mean of the
    weights of the metrics that use that landmark (1.0 where no metric uses it)."""
    metric_w = {}
    for m in METRICS:
        inv = {}
        for e in engine_names:
            p, t = _pairs(rows, e, m)
            if len(p) >= 3:
                mse = float(np.mean((np.asarray(p) - np.asarray(t)) ** 2))
                inv[e] = 1.0 / max(mse, 1e-6)
        if inv:
            s = sum(inv.values())
            metric_w[m] = {e: v / s for e, v in inv.items()}
    lm = {e: np.ones(33) for e in engine_names}
    for i in range(33):
        using = [m for m, (_, idx) in METRICS.items() if i in idx and m in metric_w]
        for e in engine_names:
            vals = [metric_w[m].get(e, 0.0) for m in using]
            if vals:
                lm[e][i] = float(np.mean(vals)) * len(engine_names)  # mean ≈ 1
    return {"metric_weights": metric_w,
            "landmark_weights": {e: v.round(4).tolist() for e, v in lm.items()}}


def apply_metric_weights(rows, metric_w):
    """Adds a 'weighted' source: metric-level blend of engines by learned weights."""
    for r in rows:
        out = {}
        for m, w in metric_w.items():
            vals = [(r["pred"].get(e, {}).get(m), wt) for e, wt in w.items()]
            vals = [(v, wt) for v, wt in vals if v is not None]
            if vals:
                tw = sum(wt for _, wt in vals)
                out[m] = sum(v * wt for v, wt in vals) / tw
        r.setdefault("pred", {})["weighted"] = out


def report(rows, sources) -> dict:
    rep = {}
    for m in METRICS:
        rep[m] = {s: agreement(*_pairs(rows, s, m)) for s in sources}
        rep[m] = {s: v for s, v in rep[m].items() if v.get("n")}
    return {k: v for k, v in rep.items() if v}


def to_markdown(rep, title) -> str:
    lines = [f"## {title}", "",
             "| Metric | Source | n | MAE° | Bias° | 95% LoA° | ICC(2,1) |",
             "|---|---|---|---|---|---|---|"]
    for m, by in rep.items():
        best = min(by, key=lambda s: by[s]["mae"])
        for s, a in by.items():
            star = " ★" if s == best else ""
            lines.append(f"| {m} | {s}{star} | {a['n']} | {a['mae']:.2f} | {a['bias']:+.2f} | "
                         f"{a['loa_low']:+.1f} … {a['loa_high']:+.1f} | {a['icc_2_1']:.3f} |")
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description="Posmoz pose-ensemble validation")
    ap.add_argument("--csv", required=True)
    ap.add_argument("--models", default="pose_models")
    ap.add_argument("--out", default="reports")
    ap.add_argument("--holdout", type=float, default=0.0,
                    help="fraction of photos kept unseen for the final report (e.g. 0.3)")
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args(argv)

    from .ensemble_pose import PoseEnsemble
    ens = PoseEnsemble(models_dir=a.models)
    names = [e.name for e in ens.engines]
    rows = predict_all(load_rows(a.csv), ens)

    idx = list(range(len(rows)))
    random.Random(a.seed).shuffle(idx)
    cut = int(len(idx) * (1 - a.holdout)) if a.holdout > 0 else len(idx)
    train = [rows[i] for i in idx[:cut]]
    test = [rows[i] for i in idx[cut:]] if a.holdout > 0 else train

    weights = fit_weights(train, names)
    apply_metric_weights(rows, weights["metric_weights"])
    sources = names + ["fused", "weighted"]
    rep = report(test, sources)

    os.makedirs(a.out, exist_ok=True)
    meta = {"created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "photos": len(rows), "train": len(train),
            "test": len(test) if a.holdout > 0 else "same as train (no holdout)",
            "engines": names, "skipped": ens.skipped,
            "unreliable_photos": sum(1 for r in rows if r.get("reliable") is False),
            "flagged_metrics": {m: sum(1 for r in rows
                                       if r.get("spread", {}).get(m, 0) > SPREAD_FLAG_DEG)
                                for m in METRICS},
            "errors": [r["image"] for r in rows if r.get("error")]}
    with open(os.path.join(a.out, "ensemble_weights.json"), "w", encoding="utf-8") as f:
        json.dump({**weights, **{k: meta[k] for k in ("created", "photos", "engines")}}, f, indent=2)
    with open(os.path.join(a.out, "validation_report.json"), "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "agreement": rep}, f, indent=2)
    title = "Agreement with doctor — " + ("held-out photos" if a.holdout > 0
                                          else "all photos (no holdout: optimistic)")
    md = to_markdown(rep, title)
    with open(os.path.join(a.out, "validation_report.md"), "w", encoding="utf-8") as f:
        f.write(md)
    print(md)
    print(json.dumps(meta, ensure_ascii=False))
    ens.close()


if __name__ == "__main__":
    main()
