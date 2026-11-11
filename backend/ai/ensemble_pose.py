"""
ensemble_pose.py — Posmoz multi-model pose ensemble (validation / clinical-report path).

Runs several commercially-licensed pose models on the SAME image, maps every
model to the MediaPipe 33-landmark layout (so the existing PL indices keep
working), fuses them, and reports how much the models disagree.

Engines (all Apache-2.0 code/weights; check dataset terms before resale):
  - "mp"   : MediaPipe Pose Landmarker HEAVY (33 pts, has z)
  - "rtmw" : RTMW-x whole-body (133 pts) + YOLOX-m person detector, via rtmlib

This module is NOT imported by backend.py and NOT shipped to Vercel
(the weights are ~360 MB). Use it offline, or on a dedicated server.

Usage:
    from ai.ensemble_pose import PoseEnsemble
    ens = PoseEnsemble(models_dir="pose_models")          # loads available engines
    res = ens.run(bgr_image)                          # dict, see run()
    res["fused"][PL.NOSE]  -> (x_px, y_px, z, conf)
"""
from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass

import numpy as np

N_MP = 33
FUSE_MIN_CONF = 0.30   # a model's point is ignored below this confidence

# ── COCO-WholeBody-133 → MediaPipe-33 ─────────────────────────────────────
# Body 0-16 (COCO), feet 17-22, face 23-90 (dlib-68 order, face k = 23+k),
# left hand 91-111, right hand 112-132 (hand k = base+k). "left" = subject's left.
_FACE = lambda k: 23 + k
_LH = lambda k: 91 + k
_RH = lambda k: 112 + k
WB133_TO_MP33 = {
    0: 0,             # nose
    1: _FACE(42),     # left eye inner
    2: 1,             # left eye
    3: _FACE(45),     # left eye outer
    4: _FACE(39),     # right eye inner
    5: 2,             # right eye
    6: _FACE(36),     # right eye outer
    7: 3, 8: 4,       # ears
    9: _FACE(54),     # mouth left
    10: _FACE(48),    # mouth right
    11: 5, 12: 6,     # shoulders
    13: 7, 14: 8,     # elbows
    15: 9, 16: 10,    # wrists
    17: _LH(17), 18: _RH(17),   # pinky (MCP)
    19: _LH(5),  20: _RH(5),    # index (MCP)
    21: _LH(4),  22: _RH(4),    # thumb tip
    23: 11, 24: 12,   # hips
    25: 13, 26: 14,   # knees
    27: 15, 28: 16,   # ankles
    29: 19, 30: 22,   # heels
    31: 17, 32: 20,   # foot index (big toe)
}


@dataclass
class EngineResult:
    name: str
    pts: np.ndarray        # (33, 4): x_px, y_px, z (nan if none), conf 0..1
    ok: bool


# ── Engines ───────────────────────────────────────────────────────────────
class MediaPipeHeavy:
    name = "mp"

    def __init__(self, model_path: str):
        import mediapipe as mp
        from mediapipe.tasks.python import BaseOptions
        from mediapipe.tasks.python import vision
        self._mp = mp
        opts = vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_path),
            running_mode=vision.RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.5,
        )
        self._det = vision.PoseLandmarker.create_from_options(opts)

    def __call__(self, bgr: np.ndarray) -> EngineResult:
        h, w = bgr.shape[:2]
        rgb = np.ascontiguousarray(bgr[:, :, ::-1])
        img = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb)
        out = self._det.detect(img)
        pts = np.full((N_MP, 4), np.nan)
        if not out.pose_landmarks:
            return EngineResult(self.name, pts, False)
        for i, lm in enumerate(out.pose_landmarks[0][:N_MP]):
            vis = getattr(lm, "visibility", None)
            pts[i] = (lm.x * w, lm.y * h, lm.z * w, 1.0 if vis is None else float(vis))
        return EngineResult(self.name, pts, True)

    def close(self):
        try:
            self._det.close()
        except Exception:
            pass


class RTMWWholebody:
    name = "rtmw"

    def __init__(self, det_path: str, pose_path: str, device: str = "cpu"):
        from rtmlib import Wholebody
        self._m = Wholebody(det=det_path, det_input_size=(640, 640),
                            pose=pose_path, pose_input_size=(288, 384),
                            backend="onnxruntime", device=device)

    def __call__(self, bgr: np.ndarray) -> EngineResult:
        kpts, scores = self._m(bgr)
        pts = np.full((N_MP, 4), np.nan)
        if kpts is None or len(kpts) == 0:
            return EngineResult(self.name, pts, False)
        # pick the most confident person (largest mean body score)
        p = int(np.argmax(scores[:, :17].mean(axis=1)))
        k, s = kpts[p], np.clip(scores[p], 0.0, 1.0)
        for mp_i, wb_i in WB133_TO_MP33.items():
            pts[mp_i] = (k[wb_i, 0], k[wb_i, 1], np.nan, s[wb_i])
        return EngineResult(self.name, pts, True)


# ── Ensemble ──────────────────────────────────────────────────────────────
class PoseEnsemble:
    """Loads every engine whose weights are present in models_dir."""

    FILES = {
        "mp": ("pose_landmarker_heavy.task",),
        "rtmw": ("yolox_m.onnx", "rtmw_x.onnx"),
    }

    def __init__(self, models_dir: str = "pose_models", weights_json: str | None = None,
                 engines: tuple = ("mp", "rtmw")):
        self.engines = []
        self.skipped = {}
        for name in engines:
            paths = [os.path.join(models_dir, f) for f in self.FILES[name]]
            missing = [p for p in paths if not os.path.exists(p)]
            if missing:
                self.skipped[name] = f"missing {', '.join(missing)}"
                continue
            try:
                self.engines.append(MediaPipeHeavy(*paths) if name == "mp"
                                    else RTMWWholebody(*paths))
            except Exception as e:                     # keep the others usable
                self.skipped[name] = repr(e)
        if not self.engines:
            raise RuntimeError(f"No pose engine could load: {self.skipped}")
        # per-engine, per-landmark weights (learned by validation.fit_weights);
        # default = equal trust
        self.w = {e.name: np.ones(N_MP) for e in self.engines}
        if weights_json and os.path.exists(weights_json):
            with open(weights_json, encoding="utf-8") as f:
                for name, vals in json.load(f).get("landmark_weights", {}).items():
                    if name in self.w and len(vals) == N_MP:
                        self.w[name] = np.asarray(vals, dtype=float)

    def run(self, bgr: np.ndarray) -> dict:
        """
        Returns {
          "engines":  {name: (33,4) array},
          "fused":    (33,4) array  x_px, y_px, z, conf,
          "disagreement": (33,) array — max distance between engines,
                           in shoulder-widths (nan if <2 engines saw the point),
          "reliable": bool — False if key upper-body points disagree > 0.15 SW,
        }
        """
        results = [e(bgr) for e in self.engines]
        per = {r.name: r.pts for r in results if r.ok}
        fused = np.full((N_MP, 4), np.nan)
        disagree = np.full(N_MP, np.nan)
        for i in range(N_MP):
            xs, ws, zs, cs = [], [], [], []
            for name, pts in per.items():
                x, y, z, c = pts[i]
                if np.isnan(x) or c < FUSE_MIN_CONF:
                    continue
                xs.append((x, y)); ws.append(self.w[name][i] * c); cs.append(c)
                if not np.isnan(z):
                    zs.append(z)
            if not xs:
                continue
            xy = np.asarray(xs); wv = np.asarray(ws)
            if wv.sum() <= 0:
                wv = np.ones_like(wv)
            fx, fy = (xy * wv[:, None]).sum(0) / wv.sum()
            fused[i] = (fx, fy, np.mean(zs) if zs else np.nan, float(np.max(cs)))
            if len(xy) >= 2:
                d = np.linalg.norm(xy[:, None] - xy[None], axis=-1).max()
                disagree[i] = d
        sw = _shoulder_width(fused)
        if sw and sw > 1:
            disagree = disagree / sw
        key = [0, 7, 8, 11, 12, 23, 24]   # nose, ears, shoulders, hips
        kd = disagree[key]
        reliable = bool(np.all(np.isnan(kd) | (kd <= 0.15)))
        return {"engines": per, "fused": fused, "disagreement": disagree,
                "reliable": reliable, "skipped": dict(self.skipped)}


    def close(self):
        for e in self.engines:
            if hasattr(e, "close"):
                e.close()


def _shoulder_width(pts: np.ndarray) -> float | None:
    a, b = pts[11], pts[12]
    if np.isnan(a[0]) or np.isnan(b[0]):
        return None
    return float(math.hypot(a[0] - b[0], a[1] - b[1]))
