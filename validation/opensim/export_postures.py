"""
Pose the OpenSim model (build_model.py) in known desk postures, across body
sizes, and write the marker positions as MediaPipe-indexed 3D points in the
JS fixture's frame (syntheticSubject.mjs: centimetres, +X subject's left,
+Y up, +Z toward the camera, origin mid-hip).

The JS side (frontend/scripts/opensim-replay.mjs) projects them through the
same camera code the engine's own fixture uses, adds landmark noise, and
runs the engine.

    python3 validation/opensim/export_postures.py   # writes postures.json
"""
import json, math, os
import opensim as osim
from build_model import build

D = math.radians

# MediaPipe pose indices for each marker.
LM = {"nose": 0, "l_eye_inner": 1, "l_eye": 2, "l_eye_outer": 3, "r_eye_inner": 4, "r_eye": 5,
      "r_eye_outer": 6, "l_ear": 7, "r_ear": 8, "mouth_l": 9, "mouth_r": 10, "l_shoulder": 11,
      "r_shoulder": 12, "l_elbow": 13, "r_elbow": 14, "l_wrist": 15, "r_wrist": 16, "l_hip": 23, "r_hip": 24}

# Joint conventions (OpenSim frame, x forward, y up, z right):
#   *_rz  negative = flexion (forward / chin down), positive = extension
#   *_rx  positive = bend toward the subject's right
#   *_ry  positive = turn toward the subject's left
#   elev_* / prot_*  metres up / forward
# Each posture: coordinates, the engine metrics that SHOULD read non-normal
# ("expect"), and the ones that must stay normal ("clean").
POSTURES = [
    ("neutral",          {}, [], ["neck_lean", "head_tilt", "shoulder_level", "spine_lean", "fhp_index", "head_yaw", "shoulder_elevation", "torso_flexion", "slump_posture"]),
    ("head_down_15",     {"neck_rz": D(-8), "head_rz": D(-7)}, ["neck_lean|fhp_index|monitor_height"], ["head_tilt", "shoulder_level", "head_yaw"]),
    ("head_down_30",     {"neck_rz": D(-15), "head_rz": D(-15)}, ["neck_lean|fhp_index|monitor_height"], ["head_tilt", "shoulder_level", "head_yaw"]),
    ("look_up_20",       {"neck_rz": D(10), "head_rz": D(10)}, ["neck_lean|monitor_height"], ["head_tilt", "shoulder_level", "head_yaw"]),
    ("chin_poke",        {"neck_rz": D(-20), "head_rz": D(20)}, ["fhp_index"], ["head_tilt", "shoulder_level", "head_yaw"]),
    ("head_tilt_r_15",   {"neck_rx": D(15)}, ["head_tilt|neck_lean"], ["shoulder_level", "spine_lean", "shoulder_elevation", "slump_posture"]),
    ("head_turn_l_30",   {"neck_ry": D(30)}, ["head_yaw"], ["shoulder_level", "spine_lean", "shoulder_elevation", "slump_posture"]),
    ("trunk_lean_r_10",  {"lumbar_rx": D(10)}, ["spine_lean|shoulder_level"], []),
    ("shoulder_raise_l", {"elev_l_tx": 0.03}, ["shoulder_level|shoulder_elevation"], ["head_tilt", "neck_lean", "head_yaw"]),
    ("shrug_both",       {"elev_l_tx": 0.03, "elev_r_tx": 0.03}, ["shoulder_elevation"], ["shoulder_level", "head_tilt", "head_yaw", "slump_posture"]),
    ("round_shoulders",  {"prot_l_tx": 0.04, "prot_r_tx": 0.04}, ["rounded_shoulders"], ["shoulder_level", "head_tilt", "head_yaw"]),
    ("slouch_forward",   {"lumbar_rz": D(-20), "neck_rz": D(10)}, ["torso_flexion|fhp_index|neck_lean|slump_posture"], ["head_tilt", "head_yaw"]),
    # Sofa slump: pelvis rolls back, lower back rounds, neck flexes forward to
    # keep the eyes on the screen. The camp tester's R11.
    ("recline_slump",    {"pelvis_rz": D(15), "lumbar_rz": D(-10), "neck_rz": D(-12)}, ["fhp_index|neck_lean|torso_flexion|monitor_height|slump_posture"], ["head_tilt", "head_yaw"]),
    ("lean_to_screen",   {"pelvis_rz": D(-12)}, ["screen_distance|torso_flexion|fhp_index|slump_posture"], ["head_tilt", "head_yaw"]),
]

BODIES = {
    "mid":   {},
    "small": {"shoulder_width": 0.88, "torso_len": 0.9, "neck_len": 0.92, "hip_width": 0.9},
    "large": {"shoulder_width": 1.12, "torso_len": 1.08, "neck_len": 1.1, "hip_width": 1.1},
    "longneck": {"neck_len": 1.2},
    # Faces differ in how high the eyes sit above the ears. The engine's
    # landmark head-pitch proxy reads that offset, so these two bodies test
    # whether an ordinary anatomical difference reads as a posture.
    "eyes_high": {"eye_up": 1.67},   # 2.5 cm above the ear line
    "eyes_low":  {"eye_up": 0.33},   # 0.5 cm
}


def pose_points(model, state, coords):
    cs = model.getCoordinateSet()
    for i in range(cs.getSize()):
        cs.get(i).setValue(state, 0.0, False)
    for name, val in coords.items():
        cs.get(name).setValue(state, val, False)
    model.assemble(state)
    model.realizePosition(state)
    out = {}
    ms = model.getMarkerSet()
    for name, idx in LM.items():
        p = ms.get(name).getLocationInGround(state)
        # OpenSim (x fwd, y up, z right) -> fixture (X subject-left, Y up, Z toward camera), cm
        out[idx] = [round(-p.get(2) * 100, 3), round(p.get(1) * 100, 3), round(p.get(0) * 100, 3)]
    return out


def main():
    data = {"source": "validation/opensim/export_postures.py", "opensim": osim.GetVersion(),
            "units": "cm, +X subject-left, +Y up, +Z toward camera, origin mid-hip",
            "bodies": list(BODIES), "postures": []}
    for pid, coords, expect, clean in POSTURES:
        entry = {"id": pid, "coords": {k: round(v, 4) for k, v in coords.items()}, "expect": expect, "clean": clean, "bodies": {}}
        for bname, scale in BODIES.items():
            m = build(scale)
            s = m.initSystem()
            entry["bodies"][bname] = pose_points(m, s, coords)
        data["postures"].append(entry)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "postures.json")
    with open(out, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print("wrote", out, len(data["postures"]), "postures x", len(BODIES), "bodies")


if __name__ == "__main__":
    main()
