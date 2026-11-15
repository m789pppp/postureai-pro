# OpenSim test fixture

A second synthetic subject for the posture engine, built in OpenSim. It is
independent of `frontend/src/features/analysis/syntheticSubject.mjs`, which the
engine was tuned against, so it finds faults that fixture cannot.

It is a kinematic test rig, not a validated anatomical model. Results from it
describe the engine's geometry and the consistency of its findings. They are
not accuracy figures and must not be shown to users (see `CLAUDE.md`).

```
pip install opensim                                  # 4.6, Python 3.13
python3 validation/opensim/export_postures.py        # postures.json (committed)
python3 validation/opensim/export_training.py 2500 11 # training.json (not committed)
cd frontend
node scripts/opensim-replay.mjs --detail             # shipped vs camp switches
node scripts/train-slump.mjs                         # retrain slumpModel.js
npm run test:opensim                                 # regression checks
```

| File | What it does |
|---|---|
| `build_model.py` | Seated upper-body model: pelvis, lumbar, lower neck (C7) and head nod (C1) joints; shoulder elevation and protraction; markers at the MediaPipe landmark sites |
| `export_postures.py` | 14 desk postures × 6 bodies (including two eye heights) → `postures.json`, with the metrics each posture should and should not raise |
| `export_training.py` | Randomised samples for the slump classifier |
