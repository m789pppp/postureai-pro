#!/usr/bin/env node
/**
 * run-live-session.mjs — smoke test of the REAL live session (App.jsx) in a browser.
 *
 *   npx vite build --config scripts/livetest/vite.config.livetest.js
 *   node scripts/livetest/run-live-session.mjs --image <person.jpg> [--seconds 20] [--shots dir] [--exp worker,adaptive,head3d]
 *
 * The build signs in a fake user (scripts/livetest/src/firebase.js). The camera is replaced by a still
 * photo with sensor noise, served from this machine. Nothing is uploaded.
 * It checks that the app loads, a session starts, a skeleton is drawn, a score appears and
 * the precision layer reports. It does not check that any reading is correct. PERF_CHROMIUM=<path> uses a specific Chromium binary.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const IMAGE = arg("image"), SECONDS = Number(arg("seconds", 20)), SHOTS = arg("shots");
const EXP = arg("exp", "");                 // e.g. --exp worker,adaptive,head3d (experiments.js); default: none, as shipped
if (!IMAGE) { console.error("usage: node scripts/livetest/run-live-session.mjs --image <person.jpg>"); process.exit(2); }
process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK ??= "1";

const server = spawn("npx", ["vite", "preview", "--outDir", "dist-livetest", "--port", "5198", "--strictPort"], { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"], detached: true });
await new Promise((ok, bad) => { server.stdout.on("data", d => String(d).includes("5198") && ok()); server.on("exit", () => bad(new Error("vite preview exited"))); });
const stop = () => { try { process.kill(-server.pid); } catch { server.kill(); } };

const img = await readFile(IMAGE);
const browser = await chromium.launch({ executablePath: process.env.PERF_CHROMIUM || undefined,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 }, permissions: ["camera"], serviceWorkers: "block" });   // the app's service worker would answer the test image request itself
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e.stack || e.message).slice(0, 500)));
page.on("requestfailed", r => { if (r.url().includes("localhost")) errors.push(`request failed: ${r.url().slice(-70)} ${r.failure()?.errorText}`); });
page.on("response", r => { if (r.url().includes("localhost") && r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url().slice(-70)}`); });
await page.route(/__live_subject/, r => r.fulfill({ body: img, contentType: /png$/i.test(IMAGE) ? "image/png" : "image/jpeg" }));
// camera → still photo with seeded noise (same idea as /perf.html)
await page.addInitScript(exp => { try { if (exp) localStorage.setItem("posmoz_exp", exp); else localStorage.removeItem("posmoz_exp"); } catch { /* ignore */ } }, EXP);
await page.addInitScript(() => {
  // a chunk that fails to load is otherwise swallowed by the app's stale-deploy handler
  window.addEventListener("vite:preloadError", e => { (window.__preloadErrors ||= []).push(String(e.payload?.stack || e.payload?.message || e.payload)); }, true);
  const make = async () => {
    const im = new Image(); im.src = "/__live_subject"; await im.decode();
    const W = 1280, H = 720, c = Object.assign(document.createElement("canvas"), { width: W, height: H }), x = c.getContext("2d");
    const s = Math.min(W / im.width, H / im.height) * 1.5;
    const draw = () => { x.fillStyle = "#777"; x.fillRect(0, 0, W, H); x.drawImage(im, (W - im.width * s) / 2 + (Math.random() - 0.5), H * 0.04 + (Math.random() - 0.5), im.width * s, im.height * s); };
    draw(); setInterval(draw, 1000 / 30);
    return c.captureStream(30);
  };
  navigator.mediaDevices.getUserMedia = async () => make();
  navigator.mediaDevices.enumerateDevices = async () => [{ kind: "videoinput", deviceId: "livetest", label: "Live test camera", groupId: "g" }];
  try { localStorage.setItem("cookie_consent", "all"); localStorage.setItem("posmoz_was_logged", "1"); } catch { /* ignore */ }   // main.jsx loads the app (not the landing page) for a returning visitor
});

const shot = async name => { if (SHOTS) { await mkdir(SHOTS, { recursive: true }); await page.screenshot({ path: join(SHOTS, `${name}.png`) }); } };
const out = { errors };
try {
  await page.goto("http://localhost:5198/#home");
  await page.waitForTimeout(6000);
  await shot("01-home");
  out.preloadErrors = await page.evaluate(() => (window.__preloadErrors || []).map(x => x.slice(0, 400)));
  const dump = async () => ({
    text: (await page.evaluate(() => document.body.innerText)).slice(0, 700).replace(/\s+/g, " "),
    buttons: await page.evaluate(() => [...document.querySelectorAll("button")].filter(b => b.offsetParent).map(b => (b.innerText || b.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40)).filter(Boolean).slice(0, 40)),
    video: await page.evaluate(() => { const v = document.querySelector("video"); return v ? { ready: v.readyState, w: v.videoWidth, h: v.videoHeight } : null; }),
  });
  out.cameraProbe = await page.evaluate(() => navigator.mediaDevices.getUserMedia({ video: true }).then(s => { const t = s.getVideoTracks(); const r = `ok ${t.length} track(s)`; t.forEach(x => x.stop()); return r; }, e => `FAILED ${e?.name}: ${e?.message}`));
  await page.getByRole("button", { name: /^Start Session$/ }).first().click();
  await page.waitForTimeout(4000);
  await shot("02-after-start");
  const agree = page.getByRole("button", { name: /I agree to both/ });
  if (await agree.isVisible().catch(() => false)) { await agree.click(); await page.waitForTimeout(2500); }
  const startA = page.getByRole("button", { name: /^Start Analysis$/ });
  if (await startA.isVisible().catch(() => false)) { await startA.click(); }
  await page.waitForTimeout(3000);
  const go = page.getByRole("button", { name: /Start session now/ });
  if (await go.isVisible().catch(() => false)) await go.click();
  // sample the running session once a second
  const samples = [];
  for (let i = 0; i < SECONDS; i++) {
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(() => {
      const canv = [...document.querySelectorAll("canvas")].map(c => {
        try { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 3; k < d.length; k += 4 * 16) if (d[k]) n++; return { w: c.width, drawn: n }; } catch { return { w: c.width, drawn: -1 }; }
      });
      const t = document.body.innerText;
      return { skeleton: Math.max(0, ...canv.filter(c => c.w >= 640).map(c => c.drawn)), text: t.replace(/\s+/g, " ").slice(0, 2500) };
    }));
    if (i === 5) await shot("03-session-early");
  }
  await shot("04-session-late");
  out.session = await dump();
  out.skeletonDrawn = samples.map(x => x.skeleton);
  out.lastText = samples.at(-1)?.text;
} catch (e) { out.fatal = String(e.message || e); }
// ── verdict ──
const skel = out.skeletonDrawn || [], late = skel.slice(6);
const text = out.lastText || "";
const score = Number(/(\d{1,3})\s*\/100/.exec(text)?.[1]);
const secs = (() => { const m = /(\d+):(\d{2}) Session Time/.exec(text); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; })();
const appErrors = errors.filter(e => !/\/api\/|localhost:5050/.test(e));         // the backend is not running here; its calls fail by design
const checks = [
  ["the app loaded without a script or chunk error", !out.fatal && appErrors.length === 0 && !(out.preloadErrors || []).length, appErrors.concat(out.preloadErrors || []).join(" | ").slice(0, 300)],
  ["the fake camera opened", /^ok/.test(out.cameraProbe || ""), out.cameraProbe],
  ["the session clock is running", secs >= SECONDS - 6, `${secs}s after ${SECONDS}s`],
  ["a skeleton is drawn on most frames once the session is going", late.length > 0 && late.filter(n => n > 100).length >= 0.8 * late.length, `${late.filter(n => n > 100).length}/${late.length} samples`],
  ["a score between 1 and 100 is on screen", score >= 1 && score <= 100, String(score)],
  ["the precision layer is reporting", /Confidence/.test(text) && /Head flexion/.test(text), /(\d) models?/.exec(text)?.[0] || "no HUD"],
];
let failed = 0;
for (const [name, ok, detail] of checks) { if (!ok) failed++; console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}${detail ? " — " + detail : ""}`); }
if (process.argv.includes("--verbose") || failed) console.log(JSON.stringify(out, null, 1).slice(0, 6000));
console.log(`\n${checks.length - failed} passed · ${failed} failed   (experiments: ${EXP || "none"})`);
await browser.close(); stop(); process.exit(failed ? 1 : 0);
