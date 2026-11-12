/**
 * mediapipeLoader.js — one place that knows where the MediaPipe runtime and models live
 * and which delegate (GPU or CPU) a task should be created on.
 *
 *  - Self-hosted assets (public/mediapipe, staged at build time) are tried first, the
 *    CDN second. The precision layer used to import the same runtime a second time from
 *    the CDN: ~10 MB downloaded twice, and no face model at all on networks that filter it.
 *  - A browser without hardware acceleration still offers WebGL through a software
 *    rasteriser (SwiftShader, llvmpipe, Microsoft Basic Render Driver). MediaPipe's
 *    "GPU" delegate then succeeds and runs several times slower than its CPU delegate,
 *    so the CPU delegate is chosen up front on those devices.
 */

export const MP_VERSION = "0.10.14";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const GCS = "https://storage.googleapis.com/mediapipe-models";

export const MP_SOURCES = [
  { name: "self-hosted", bundle: "/mediapipe/vision_bundle.mjs", wasm: "/mediapipe/wasm",
    pose: "/mediapipe/pose_landmarker_full.task", face: "/mediapipe/face_landmarker.task" },
  { name: "cdn", bundle: `${CDN}/vision_bundle.mjs`, wasm: `${CDN}/wasm`,
    pose: `${GCS}/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
    face: `${GCS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task` },
];

/** True for WebGL renderer strings that are software rasterisers. Pure — unit-tested. */
export function isSoftwareRenderer(name) {
  return /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render|\bswrast\b/i.test(String(name || ""));
}

/** Unmasked WebGL renderer string, or null when WebGL is unavailable. */
export function webglRendererName() {
  try {
    const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return String(name || "");
  } catch { return null; }
}

/** Delegates to try, in order. Pure given the renderer string. */
export function delegateOrder(renderer) {
  return renderer == null || isSoftwareRenderer(renderer) ? ["CPU"] : ["GPU", "CPU"];
}

let rendererMemo;
export function preferredDelegates() {
  if (rendererMemo === undefined) rendererMemo = webglRendererName();
  return delegateOrder(rendererMemo);
}

let visionMemo = null;
/** Import the runtime once (self-hosted, then CDN). Resolves { mod, fileset, source }. */
export function loadVision() {
  visionMemo ||= (async () => {
    let last = null;
    for (const source of MP_SOURCES) {
      try {
        const mod = await import(/* @vite-ignore */ source.bundle);
        return { mod, fileset: await mod.FilesetResolver.forVisionTasks(source.wasm), source };
      } catch (e) { last = e; }
    }
    visionMemo = null;                       // let a later call retry (e.g. the network came back)
    throw last || new Error("MediaPipe runtime unavailable");
  })();
  return visionMemo;
}

/**
 * Create a task on the best delegate, trying each model URL in turn.
 * @returns {Promise<{ task: object, delegate: "GPU"|"CPU", model: string }>}
 */
export async function createTask(Cls, fileset, modelUrls, options, delegates = preferredDelegates()) {
  let last = null;
  for (const model of [].concat(modelUrls)) {
    for (const delegate of delegates) {
      try {
        return { task: await Cls.createFromOptions(fileset, { baseOptions: { modelAssetPath: model, delegate }, ...options }), delegate, model };
      } catch (e) { last = e; }
    }
  }
  throw last || new Error("could not create the MediaPipe task");
}
