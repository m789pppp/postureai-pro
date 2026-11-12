#!/usr/bin/env node
/**
 * perf-bench.mjs — runs /perf.html in headless Chromium and writes a results file.
 *
 *   node scripts/perf-bench.mjs --image <person.jpg> [--label baseline] [--runs 3]
 *        [--seconds 20] [--pipelines mp,fused] [--rtmw '{"force":true}'] [--params "delegate=gpu"]
 *        [--serve name=/local/file] [--url http://localhost:4173]
 *
 * The image is a still photo of one person (upper body, facing the camera). It is served
 * to the page from this machine only and is drawn into a 1280×720 stream with seeded
 * sensor noise, so every run sees the same frames. Without --url the script serves the
 * production build with `vite preview`, so run `npm run build` first.
 * PERF_CHROMIUM=<path> uses a specific Chromium binary instead of Playwright's own.
 *
 * Each pipeline is run cold (empty browser profile: every model is downloaded) and then
 * warm (same profile again: models come from the HTTP cache / Cache Storage).
 * Memory is the peak proportional set size (PSS) summed over the browser's processes;
 * CPU is what those processes used during the measured window, in percent of one core.
 *
 * Numbers describe THIS machine. A cloud container has no GPU, so MediaPipe runs on
 * the CPU delegate and WebGPU is unavailable — treat it as a weak laptop, not a typical one.
 */
import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { medianOfRuns } from "../src/bench/perfCore.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const IMAGE = arg("image"), LABEL = arg("label", "run"), RUNS = Number(arg("runs", 3)), SECONDS = Number(arg("seconds", 20));
const PIPELINES = arg("pipelines", "mp,fused").split(",");
const RTMW = arg("rtmw", "");
const OUT = arg("out", join(ROOT, "perf-results"));
if (!IMAGE) { console.error("usage: node scripts/perf-bench.mjs --image <person.jpg> [--label name]"); process.exit(2); }

// Local files served to the page, e.g. --serve model.onnx=/path/to/model.onnx → /__perf_file/model.onnx
const SERVE = (arg("serve", "") || "").split(",").filter(Boolean).map(x => x.split("="));
// Extra page parameters, e.g. --params "delegate=cpu&tier=elite"
const EXTRA = new URLSearchParams(arg("params", ""));
// Playwright otherwise sends localhost through the proxy too.
process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK ??= "1";

let server = null, base = arg("url");
if (!base) {
  // `vite preview` serves the production build (run `npm run build` first): the dev server
  // cannot import the self-hosted MediaPipe bundle from /public, and dev code is slower.
  server = spawn("npx", ["vite", "preview", "--port", "5199", "--strictPort"], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"], detached: true });
  await new Promise((ok, bad) => { server.stdout.on("data", d => String(d).includes("5199") && ok()); server.on("exit", () => bad(new Error("vite exited"))); });
  base = "http://localhost:5199";
}

/**
 * Peak memory (MB) of a process tree, sampled twice a second. Uses PSS where the kernel
 * exposes it (Linux): RSS counts the pages Chromium's processes share once per process.
 */
function watchMemory(rootPid) {
  let peak = 0, kind = "pss";
  const sample = () => {
    try {
      const rows = execSync("ps -eo pid=,ppid=,rss=,comm=", { encoding: "utf8" }).trim().split("\n")
        .map(l => l.trim().split(/\s+/)).map(([a, b, c, comm]) => [Number(a), Number(b), Number(c), comm || ""]);
      const kids = new Set([rootPid]); let grew = true;
      while (grew) { grew = false; for (const [pid, ppid] of rows) if (kids.has(ppid) && !kids.has(pid)) { kids.add(pid); grew = true; } }
      let kb = 0;
      for (const [pid, , rss, comm] of rows) {
        if (!kids.has(pid) || !/chrom|headless/i.test(comm)) continue;      // the browser only, not this script or vite
        let v = null;
        if (kind === "pss") { try { v = Number(/^Pss:\s+(\d+)/m.exec(readFileSync(`/proc/${pid}/smaps_rollup`, "utf8"))?.[1]); } catch { v = null; } }
        if (!Number.isFinite(v)) { v = rss; kind = "rss"; }
        kb += v;
      }
      peak = Math.max(peak, kb / 1024);
    } catch { /* ps unavailable */ }
  };
  const t = setInterval(sample, 500);
  return () => { clearInterval(t); sample(); return { mb: Math.round(peak), kind }; };
}

/** CPU time (seconds) used so far by the browser's processes. Linux only; null elsewhere. */
function browserCpuSeconds() {
  try {
    const rows = execSync("ps -eo pid=,ppid=,comm=", { encoding: "utf8" }).trim().split("\n").map(l => l.trim().split(/\s+/));
    const kids = new Set([process.pid]); let grew = true;
    while (grew) { grew = false; for (const [pid, ppid] of rows) if (kids.has(+ppid) && !kids.has(+pid)) { kids.add(+pid); grew = true; } }
    let ticks = 0;
    for (const [pid, , comm] of rows) {
      if (!kids.has(+pid) || !/chrom|headless/i.test(comm || "")) continue;
      try { const f = readFileSync(`/proc/${pid}/stat`, "utf8"); const a = f.slice(f.lastIndexOf(")") + 2).split(" "); ticks += Number(a[11]) + Number(a[12]); } catch { /* exited */ }
    }
    return ticks / 100;                                   // USER_HZ
  } catch { return null; }
}

const imgBody = await readFile(IMAGE);
const imgType = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[extname(IMAGE).toLowerCase()] || "image/jpeg";

async function once(pipeline, profile) {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: true, proxy, executablePath: process.env.PERF_CHROMIUM || undefined, viewport: { width: 1280, height: 800 },
    args: ["--autoplay-policy=no-user-gesture-required", "--enable-precise-memory-info"],
  });
  const stop = watchMemory(process.pid);
  const page = ctx.pages()[0] || await ctx.newPage();
  let bytes = 0;
  page.on("response", async r => { const n = Number((await r.allHeaders().catch(() => ({})))["content-length"]); if (Number.isFinite(n)) bytes += n; });
  await page.route("**/__perf_subject", r => r.fulfill({ body: imgBody, contentType: imgType }));
  for (const [name, path] of SERVE) await page.route(`**/__perf_file/${name}`, r => r.fulfill({ path, contentType: "application/octet-stream" }));
  const q = new URLSearchParams({ pipeline, src: "/__perf_subject", seconds: String(SECONDS), auto: "1", wait: "rtmw" });
  if (RTMW) q.set("rtmw", RTMW);
  for (const [k, v] of EXTRA) q.set(k, v);
  await page.goto(`${base}/perf.html?${q}`);
  await page.waitForFunction(() => window.__perfMeasuring || window.__perfResult, null, { timeout: 15 * 60 * 1000 });
  const c0 = browserCpuSeconds(), w0 = Date.now();
  await page.waitForFunction(() => window.__perfResult, null, { timeout: 15 * 60 * 1000 });
  const c1 = browserCpuSeconds(), wall = (Date.now() - w0) / 1000;
  const res = await page.evaluate(() => window.__perfResult);
  const mem = stop();
  res.memPeakMb = mem.mb; res.memKind = mem.kind;
  // CPU the browser used while measuring, as a percentage of one core (400 = four cores busy)
  res.cpuPct = c0 != null && c1 != null && wall > 1 ? Math.round(100 * (c1 - c0) / wall) : null;
  res.downloadedMb = Math.round(bytes / 1048576 * 10) / 10;
  await ctx.close();
  return res;
}

const all = { label: LABEL, at: new Date().toISOString(), runs: RUNS, seconds: SECONDS, results: {} };
try {
  for (const p of PIPELINES) {
    const cold = [], warm = [];
    for (let i = 0; i < RUNS; i++) {
      const profile = await mkdtemp(join(tmpdir(), "posmoz-perf-"));
      cold.push(await once(p, profile));
      warm.push(await once(p, profile));
      await rm(profile, { recursive: true, force: true });
      const c = cold.at(-1), w = warm.at(-1);
      console.log(`${p} #${i + 1}: cold first score ${c.timings?.firstScoreMs} ms, ${c.downloadedMb} MB · warm ${w.timings?.firstScoreMs} ms · ${w.pacing?.fps} fps · mem ${w.memPeakMb} MB (${w.memKind}) · rtmw ${w.precision?.rtmw?.state ?? "-"}${c.error ? " · ERROR " + c.error : ""}`);
    }
    all.results[p] = { cold: medianOfRuns(cold), warm: medianOfRuns(warm), raw: { cold, warm } };
  }
} finally { if (server) { try { process.kill(-server.pid); } catch { server.kill(); } } }

await mkdir(OUT, { recursive: true });
const file = join(OUT, `${LABEL}.json`);
await writeFile(file, JSON.stringify(all, null, 2));
console.log(`\nwrote ${file}`);
process.exit(0);
