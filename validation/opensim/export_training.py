"""
Randomised training samples from the OpenSim model, for the slump classifier
(frontend/scripts/train-slump.mjs). Each sample is one body in its neutral
pose and in a posture of one class, with random magnitudes and body sizes.

    python3 validation/opensim/export_training.py [N] [seed]   # writes training.json (not committed)

Classes: neutral (small natural sway), slouch_forward, recline_slump,
lean_to_screen, head_down.
"""
import json, math, os, random, sys
import opensim as osim
from build_model import build
from export_postures import LM, pose_points

D = math.radians
CLASSES = ["neutral", "slouch_forward", "recline_slump", "lean_to_screen", "head_down"]


def sample_coords(cls, r):
    u = lambda a, b: r.uniform(a, b)
    sway = {"neck_rx": D(u(-3, 3)), "neck_ry": D(u(-6, 6)), "lumbar_rx": D(u(-2, 2)), "neck_rz": D(u(-3, 3))}
    if cls == "neutral":
        return sway
    if cls == "slouch_forward":
        return {**sway, "lumbar_rz": D(-u(10, 30)), "neck_rz": D(u(0, 15)), "prot_l_tx": u(0, 0.03), "prot_r_tx": u(0, 0.03)}
    if cls == "recline_slump":
        return {**sway, "pelvis_rz": D(u(8, 25)), "lumbar_rz": D(-u(5, 15)), "neck_rz": D(-u(5, 20)), "head_rz": D(u(-5, 5))}
    if cls == "lean_to_screen":
        return {**sway, "pelvis_rz": D(-u(8, 20)), "neck_rz": D(u(-5, 5))}
    if cls == "head_down":
        a = u(12, 35)
        return {**sway, "neck_rz": D(-a * 0.5), "head_rz": D(-a * 0.5)}
    raise ValueError(cls)


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1500
    r = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 11)
    out = []
    cache = {}
    for i in range(n):
        scale = {"shoulder_width": round(r.uniform(0.85, 1.15), 2), "torso_len": round(r.uniform(0.88, 1.1), 2),
                 "neck_len": round(r.uniform(0.85, 1.2), 2), "eye_up": round(r.uniform(0.3, 1.7), 1)}
        key = tuple(sorted(scale.items()))
        if key not in cache:
            m = build(scale); cache[key] = (m, m.initSystem())
        m, s = cache[key]
        cls = CLASSES[i % len(CLASSES)]
        out.append({"cls": cls, "scale": scale,
                    "neutral": pose_points(m, s, {}),
                    "pose": pose_points(m, s, sample_coords(cls, r))})
        if len(cache) > 64: cache.clear()
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "training.json")
    with open(path, "w") as f:
        json.dump({"classes": CLASSES, "opensim": osim.GetVersion(), "samples": out}, f, separators=(",", ":"))
    print("wrote", path, len(out), "samples")


if __name__ == "__main__":
    main()
