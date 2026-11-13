/**
 * Build of the real app with src/firebase.js replaced by scripts/livetest/src/firebase.js, for the
 * live-session smoke test only. Output goes to dist-livetest, never to dist.
 *   npx vite build --config scripts/livetest/vite.config.livetest.js
 */
import { defineConfig, mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import base from "../../vite.config.js";

const here = dirname(fileURLToPath(import.meta.url));
const real = join(here, "../../src/firebase.js");
// The mock lives at .../src/firebase.js on purpose: vite.config.js pins any id containing
// "/src/firebase.js" to its own chunk. Under another name Rollup placed it inside the "hr"
// chunk and the app died on load with a chunk-cycle "Cannot access before initialization".
const mockPath = join(here, "src/firebase.js");

// fail the build if the mock has fallen behind the real module
const names = f => new Set([...readFileSync(f, "utf8").matchAll(/^export (?:const|async function|function|let|class) (\w+)/gm)].map(m => m[1]));
// the mock declares several names per `export const` line: accept a name that appears anywhere as `name =`
const mockSrc = readFileSync(mockPath, "utf8");
const missing = [...names(real)].filter(n => !new RegExp(`\\b${n}\\s*=`).test(mockSrc));
if (missing.length) throw new Error(`scripts/livetest/src/firebase.js lacks exports of src/firebase.js: ${missing.join(", ")}`);

export default mergeConfig(base, defineConfig({
  root: join(here, "../.."),
  plugins: [{
    name: "livetest-firebase-mock", enforce: "pre",
    async resolveId(source, importer) {
      if (!importer || !/firebase(\.js)?$/.test(source) || source.startsWith("firebase/") || source === "firebase") return null;
      const r = await this.resolve(source, importer, { skipSelf: true });
      return r && r.id === real ? mockPath : null;
    },
  }],
  build: { outDir: "dist-livetest", emptyOutDir: true, sourcemap: false },
}));
