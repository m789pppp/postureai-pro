"""
Download the pose-ensemble weights into backend/pose_models and verify SHA-256.
Run from backend/:   python -m ai.download_models
(~360 MB. On the office network FortiGate blocks these hosts — use a hotspot.)
"""
import hashlib
import os
import sys
import urllib.request

MODELS = {
    "pose_landmarker_heavy.task": (
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
        "pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
        "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b"),
    # OpenMMLab ONNX SDK files, mirrored verbatim on Hugging Face (Apache-2.0)
    "yolox_m.onnx": (
        "https://huggingface.co/SceneWorks/dwpose-onnx/resolve/main/"
        "yolox_m_8xb8-300e_humanart-c2c7a14a.onnx",
        "3dea6513388889f0fff4b77bf7a26013600321b9eb9ceb0e9a400a82572f5f23"),
    "rtmw_x.onnx": (
        "https://huggingface.co/SceneWorks/dwpose-onnx/resolve/main/"
        "rtmw-dw-x-l_simcc-cocktail14_270e-384x288_20231122.onnx",
        "bd033156e5104c4f5d2edfe0453e02661e30a2f3da453ec93c8764d561b83054"),
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(dst="pose_models"):
    os.makedirs(dst, exist_ok=True)
    ok = True
    for name, (url, digest) in MODELS.items():
        path = os.path.join(dst, name)
        if os.path.exists(path) and sha256(path) == digest:
            print(f"✓ {name} (already present)")
            continue
        print(f"↓ {name} …", flush=True)
        tmp = path + ".part"
        urllib.request.urlretrieve(url, tmp)
        if sha256(tmp) != digest:
            os.replace(tmp, path + ".bad")
            print(f"✗ {name}: checksum mismatch — kept as {name}.bad, not used")
            ok = False
            continue
        os.replace(tmp, path)
        print(f"✓ {name}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "pose_models")
