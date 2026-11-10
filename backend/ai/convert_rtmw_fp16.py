"""
Convert RTMW-x to fp16 for the browser (≈229 MB → ≈115 MB, faster on WebGPU)
and check it against fp32 before it is used.

    python -m ai.convert_rtmw_fp16            # from backend/, after ai.download_models

Tested: onnx 1.23.2, onnxconverter-common 1.16.0 → sha256 9ba5cd56637e1a54…
On two images the fp16 keypoints matched fp32 within 0.11–0.16 px on average
(max 2.2 px on a hand point); head/shoulder points within 1.2 px.
Host the output yourself and set RTMW_MODEL_URL / RTMW_SHA256 in
frontend/src/features/analysis/rtmwWeb.js to the new file.
"""
import hashlib
import os
import sys

import numpy as np

SRC = os.path.join("pose_models", "rtmw_x.onnx")
DST = os.path.join("pose_models", "rtmw_x_fp16.onnx")


def main():
    import onnx
    from onnxconverter_common import float16

    m = onnx.load(SRC)
    onnx.save(float16.convert_float_to_float16(m, keep_io_types=True), DST)
    digest = hashlib.sha256(open(DST, "rb").read()).hexdigest()
    print(f"{DST}: {os.path.getsize(DST) / 1e6:.1f} MB  sha256 {digest}")

    # parity check on a synthetic input (no image needed)
    import onnxruntime as ort
    x = np.random.default_rng(0).standard_normal((1, 3, 384, 288)).astype(np.float32)
    s32, s16 = ort.InferenceSession(SRC), ort.InferenceSession(DST)
    name = s32.get_inputs()[0].name
    a, b = s32.run(None, {name: x}), s16.run(None, {name: x})
    ax, bx = np.argmax(a[0], -1), np.argmax(b[0], -1)
    same = float((np.abs(ax - bx) <= 2).mean())
    print(f"SimCC argmax within 1 px (x): {same:.1%}")
    sys.exit(0 if same > 0.95 else 1)


if __name__ == "__main__":
    main()
