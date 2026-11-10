# Posmoz pose ensemble + validation

Runs MediaPipe Pose **heavy** and **RTMW-x** (whole-body, 133 pts) on the same
photo, maps both to the MediaPipe 33-point layout, fuses them, flags photos
where the models disagree, and compares every source with the doctor.

Not used by `backend.py` and not deployed to Vercel (weights ≈ 360 MB).

## Setup (once, from `backend/`, in a separate venv)
```powershell
python -m venv .venv-ml
.venv-ml\Scripts\activate
pip install -r requirements-ml.txt
python -m ai.download_models        # needs a network that FortiGate doesn't block
```

## Validation data
`data/validation.csv` next to the photos:
```
image,view,head_tilt_deg,shoulder_level_deg,pelvic_level_deg,trunk_lean_deg,cva_proxy_deg
p01_front.jpg,front,2.1,-1.5,0.8,1.2,
p01_side.jpg,side,,,,4.0,48.5
```
Signs: level/tilt + = subject's left side lower; trunk lean + = toward image right.
`cva_proxy_deg` = shoulder→ear line vs horizontal (a proxy for C7–tragus CVA).

## Run
```powershell
python -m ai.validation --csv data\validation.csv --models pose_models --out reports --holdout 0.3
```
Outputs in `reports/`:
- `validation_report.md` — MAE, bias, 95 % limits of agreement, ICC(2,1) per metric
  for `mp`, `rtmw`, `fused` (landmark fusion) and `weighted` (learned per-metric blend), ★ = best.
- `ensemble_weights.json` — learned weights; pass it to `PoseEnsemble(weights_json=…)`.
- `validation_report.json` — same numbers + photos where models disagree > 5°.

Use `--holdout 0.3` for numbers you report: without it, weights are fitted and
scored on the same photos (optimistic).

## Tests
```powershell
python -m pytest tests\test_pose_ensemble.py -q
$env:POSMOZ_TEST_IMAGE="path\to\photo.jpg"   # also runs the rotation check
```
