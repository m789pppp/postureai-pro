#!/usr/bin/env node
/**
 * API route coverage check.
 *
 * vercel.json routes are matched in order and the first match is terminal —
 * there is no fall-through. So a broad prefix route like
 *
 *     { "src": "/api/notify/(.*)", "dest": "/api/misc.js" }
 *
 * swallows EVERY path under that prefix and hands it to a JS router that only
 * implements one of them (`/notify/dispatch`). The rest hit the router's final
 * `res.status(404)` and never reach `/api/(.*)` -> `/api/main.py`, which loads
 * the Flask app that does implement them. That is how 46 backend endpoints —
 * including the whole MFA login path — were dead in production while their
 * code sat in backend.py working fine.
 *
 * This script re-derives the mapping from the files themselves and fails if any
 * caller-visible path resolves to a router that cannot serve it. Run in CI so
 * the class of bug cannot come back.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// ── vercel.json routes, in order ──────────────────────────────────────────
const routes = JSON.parse(read("vercel.json")).routes
  .filter((r) => typeof r.src === "string" && r.dest)
  .map((r) => ({ re: new RegExp(`^${r.src}$`), src: r.src, dest: r.dest }));

const resolve = (path) => routes.find((r) => r.re.test(path)) || null;

// ── what each JS router actually dispatches ───────────────────────────────
const dispatch = {};
for (const f of readdirSync(join(ROOT, "api")).filter((f) => f.endsWith(".js"))) {
  const s = read(`api/${f}`);
  dispatch[`/api/${f}`] = {
    ends: [...s.matchAll(/path\.endsWith\("([^"]+)"\)/g)].map((m) => m[1]),
    incs: [...s.matchAll(/path\.includes\("([^"]+)"\)/g)].map((m) => m[1]),
  };
}
const routerServes = (dest, path) => {
  const d = dispatch[dest];
  if (!d) return true; // main.py / unknown — assume the Flask app handles it
  return d.ends.some((e) => path.replace(/\/$/, "").endsWith(e)) ||
         d.incs.some((i) => path.includes(i));
};

// ── every path a caller can reach ─────────────────────────────────────────
const paths = new Set();

// 1. Flask routes in backend.py (served by /api/main.py)
for (const m of read("backend/backend.py").matchAll(/@app\.route\(\s*"(\/api\/[^"]*)"/g)) {
  // substitute a concrete value for <converter:name> segments
  paths.add(m[1].replace(/<[^>]+>/g, "x"));
}

// 2. Literal paths the frontend fetches
const walk = (dir, acc = []) => {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|jsx|ts|tsx|mjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
};
for (const f of walk("frontend/src")) {
  const s = read(f);
  for (const m of s.matchAll(/\$\{(?:API_BASE_URL|BACKEND_URL|API)\}(\/[a-zA-Z0-9/_-]+)/g)) paths.add("/api" + m[1]);
  for (const m of s.matchAll(/apiFetch\(\s*"(\/[a-zA-Z0-9/_-]+)"/g))                        paths.add("/api" + m[1]);
  for (const m of s.matchAll(/"(\/api\/[a-zA-Z0-9/_-]+)"/g))                                paths.add(m[1]);
}

// 3. Vercel cron targets
for (const c of JSON.parse(read("vercel.json")).crons || []) paths.add(c.path);

// ── check ─────────────────────────────────────────────────────────────────
const broken = [];
for (const p of [...paths].sort()) {
  const r = resolve(p);
  if (!r) { broken.push([p, "—", "no vercel route at all"]); continue; }
  if (!routerServes(r.dest, p)) broken.push([p, r.dest, `matched "${r.src}" — router has no branch, returns 404`]);
}

if (broken.length) {
  console.error(`\n✗ ${broken.length} API path(s) resolve to a handler that cannot serve them:\n`);
  for (const [p, d, why] of broken) console.error(`  ${p.padEnd(44)} -> ${String(d).padEnd(14)} ${why}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ all ${paths.size} API paths resolve to a handler that implements them`);
