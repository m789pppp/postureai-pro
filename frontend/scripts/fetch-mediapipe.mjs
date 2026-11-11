#!/usr/bin/env node
/**
 * Stage MediaPipe assets into public/mediapipe so the app can run without
 * reaching a CDN at runtime.
 *
 * Why: the pose landmarker used to be imported straight from
 * cdn.jsdelivr.net, with the model pulled from storage.googleapis.com. On a
 * network that filters either host — common on university and corporate
 * wifi — MediaPipe fails to load and the app falls back to server-side
 * analysis, which is both slower and a privacy regression (it uploads
 * frames). Self-hosting removes the dependency entirely.
 *
 * These files are ~32MB, so they are gitignored and fetched at build time
 * rather than committed. Runs automatically via the `prebuild` script.
 */
import { mkdir, copyFile, access, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "public", "mediapipe");
const WASM_OUT = join(OUT, "wasm");
const WASM_SRC = join(ROOT, "node_modules", "@mediapipe", "tasks-vision", "wasm");

const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

const GCS = "https://storage.googleapis.com/mediapipe-models";
// minBytes: anything smaller than the real file is an error page, not a model
const MODELS = [
  { name: "pose_landmarker_full.task", minBytes: 5_000_000, // ~9MB
    url: `${GCS}/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task` },
  // Face model of the live precision layer (head pose, iris distance). It used to be
  // fetched from the CDN at runtime only, so filtered networks had no precision layer.
  { name: "face_landmarker.task", minBytes: 2_000_000,      // ~3.7MB
    url: `${GCS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task` },
];

const exists = async (p) => {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
};

const PKG_SRC = join(ROOT, "node_modules", "@mediapipe", "tasks-vision");

async function copyRuntime() {
  if (!(await exists(WASM_SRC))) {
    throw new Error(
      "@mediapipe/tasks-vision is not installed. Run `npm install` first."
    );
  }
  await mkdir(WASM_OUT, { recursive: true });
  for (const f of WASM_FILES) {
    await copyFile(join(WASM_SRC, f), join(WASM_OUT, f));
  }
  // The ESM bundle itself, so the dynamic import() in App.jsx resolves
  // locally too — copying only the wasm would still leave the loader
  // reaching out to jsdelivr for the module.
  await copyFile(join(PKG_SRC, "vision_bundle.mjs"), join(OUT, "vision_bundle.mjs"));
  console.log(`[mediapipe] copied bundle + ${WASM_FILES.length} wasm files`);
}

async function fetchModel({ name, url, minBytes }) {
  const dest = join(OUT, name);
  if (await exists(dest)) {
    const { size } = await stat(dest);
    if (size >= minBytes) {
      console.log(`[mediapipe] ${name} already present (${(size / 1e6).toFixed(1)}MB)`);
      return;
    }
    console.log(`[mediapipe] cached ${name} looks truncated — refetching`);
  }
  await mkdir(OUT, { recursive: true });
  console.log(`[mediapipe] downloading ${name}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name} download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) {
    throw new Error(`${name} download too small (${buf.length} bytes) — refusing to write`);
  }
  await writeFile(dest, buf);
  console.log(`[mediapipe] ${name} saved (${(buf.length / 1e6).toFixed(1)}MB)`);
}

try {
  await copyRuntime();
  for (const m of MODELS) await fetchModel(m);
  console.log("[mediapipe] assets ready in public/mediapipe");
} catch (err) {
  // Do NOT fail the build. The app falls back to the CDN when a local asset
  // is missing, so a offline/blocked build still produces a working bundle —
  // it just loses the self-hosting benefit. Make the warning loud.
  console.warn("\n[mediapipe] WARNING — could not stage local assets:", err.message);
  console.warn("[mediapipe] The build will continue and the app will fall back to the CDN.");
  console.warn("[mediapipe] On a filtered network (campus wifi) that fallback may not work.\n");
}
