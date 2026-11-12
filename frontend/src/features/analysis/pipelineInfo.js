/**
 * pipelineInfo.js — names the measuring pipeline a reading came from.
 *
 * MEASURE_VERSION says which code produced a number. It does not say which models ran:
 * one device runs MediaPipe alone on the CPU, another fuses a third model on WebGPU, and
 * both would export under the same version. Trials and bench sessions therefore carry
 * this id as well, so data from different pipelines is never pooled by accident.
 * Pure — unit-tested.
 */
import { MP_VERSION } from "./mediapipeLoader.js";

export const POSE_MODEL = "pose_full";

/**
 * @param {object} o
 * @param {{mode?: string, delegate?: string}|null} [o.vision]  from visionClient / createTask
 * @param {object|null} [o.precision]  the enhancer's process() result, or null without it
 * @returns {string} e.g. "mp0.10.14-pose_full/cpu/worker+face+rtmw-x:webgpu"
 */
export function pipelineId({ vision = null, precision = null } = {}) {
  const delegate = (vision?.delegate || "unknown").toLowerCase();
  const where = vision?.mode || "main";
  let id = `mp${MP_VERSION}-${POSE_MODEL}/${delegate}/${where}`;
  if (precision?.faceModel === "on") id += "+face";
  const r = precision?.rtmw;
  if (r?.state === "on") id += `+${r.model || "refine"}:${r.ep || "unknown"}`;
  return id;
}

/**
 * The pipeline of a recording: the one id every frame agrees on, or "mixed(a|b)" when the
 * pipeline changed while recording (a model finished loading, the worker fell back).
 */
export function pipelineOfFrames(ids) {
  const u = [...new Set((ids || []).filter(Boolean))].sort();
  return u.length === 0 ? "unknown" : u.length === 1 ? u[0] : `mixed(${u.join("|")})`;
}
