/**
 * visionWorker.js — MediaPipe pose (and, on request, face) inference off the main thread.
 *
 * A CLASSIC worker on purpose: MediaPipe loads its WASM glue with importScripts(), which
 * does not exist in module workers. The ES bundle is brought in with dynamic import().
 * Keep this file free of static imports so it also runs unbundled.
 *
 * Protocol (postMessage):
 *   main → { type: "init", sources, delegates, poseOptions }
 *   worker → { type: "ready", delegate, source } | { type: "error", message }
 *   main → { type: "frame", id, bitmap, ts, face }          (bitmap transferred)
 *   worker → { type: "result", id, pose, face, ms }           (buffers transferred)
 *     pose  Float32Array(33 × 4: x, y, z, visibility) or null when nobody is in frame
 *     face  { lm: Float32Array(n × 3), m: Float32Array(16) } or null; absent if not requested/ready
 */
let mod = null, fileset = null, source = null, delegates = ["CPU"], pose = null, face = null, faceState = "idle", lastTs = 0;

async function create(Cls, urls, options) {
  let last = null;
  for (const model of urls) for (const delegate of delegates) {
    try { return { task: await Cls.createFromOptions(fileset, { baseOptions: { modelAssetPath: model, delegate }, ...options }), delegate }; }
    catch (e) { last = e; }
  }
  throw last || new Error("could not create the MediaPipe task");
}
const urlsFor = (sources, k) => [...new Set([source[k], ...sources.map(s => s[k])])];

async function init({ sources, delegates: d, poseOptions }) {
  delegates = d;
  let last = null;
  for (const s of sources) {
    try { mod = await import(/* @vite-ignore */ s.bundle); fileset = await mod.FilesetResolver.forVisionTasks(s.wasm); source = s; break; }
    catch (e) { last = e; }
  }
  if (!source) throw last || new Error("MediaPipe runtime unavailable");
  const r = await create(mod.PoseLandmarker, urlsFor(sources, "pose"), poseOptions);
  pose = r.task;
  self.__sources = sources;
  return { delegate: r.delegate, source: source.name };
}

function loadFace() {
  faceState = "loading";
  create(mod.FaceLandmarker, urlsFor(self.__sources, "face"),
    { runningMode: "VIDEO", numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: false })
    .then(r => { face = r.task; faceState = "on"; }, () => { faceState = "failed"; });
}

function packPose(l) {
  if (!l) return null;
  const a = new Float32Array(l.length * 4);
  for (let i = 0; i < l.length; i++) { const p = l[i]; a[4 * i] = p.x; a[4 * i + 1] = p.y; a[4 * i + 2] = p.z ?? 0; a[4 * i + 3] = p.visibility ?? 0; }
  return a;
}
function packFace(r) {
  const l = r.faceLandmarks?.[0], m = r.facialTransformationMatrixes?.[0];
  if (!l || !m) return null;
  const lm = new Float32Array(l.length * 3);
  for (let i = 0; i < l.length; i++) { lm[3 * i] = l[i].x; lm[3 * i + 1] = l[i].y; lm[3 * i + 2] = l[i].z ?? 0; }
  return { lm, m: new Float32Array(m.data) };
}

self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try { postMessage({ type: "ready", ...(await init(data)) }); }
    catch (e) { postMessage({ type: "error", message: String(e?.message || e) }); }
  } else if (data.type === "frame") {
    const t0 = performance.now(), out = { type: "result", id: data.id }, transfer = [];
    try {
      const ts = Math.max(lastTs + 1, data.ts); lastTs = ts;          // MediaPipe needs strictly increasing timestamps
      out.pose = packPose(pose.detectForVideo(data.bitmap, ts).landmarks?.[0]);
      if (out.pose) transfer.push(out.pose.buffer);
      if (data.face) {
        if (faceState === "idle") loadFace();
        if (face) { out.face = packFace(face.detectForVideo(data.bitmap, ts)); if (out.face) transfer.push(out.face.lm.buffer, out.face.m.buffer); }
        out.faceState = faceState;
      }
    } catch (e) { out.error = String(e?.message || e); }
    data.bitmap.close();
    out.ms = performance.now() - t0;
    postMessage(out, transfer);
  }
};
