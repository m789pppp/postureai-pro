/**
 * Corvus AI Preloader — background generation on login
 * Cache hierarchy:
 *   1. Memory (fastest — in-process, survives re-renders)
 *   2. Firestore (persistent — survives reloads, tab close, browser restart)
 *   3. SessionStorage (fallback when Firestore unavailable)
 * Invalidation: only when session count changes (new posture session recorded)
 */
import { geminiAnalysis } from "./gemini.js";
import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ── TTLs ─────────────────────────────────────────────────────────
const FIRESTORE_TTL = 24 * 60 * 60 * 1000; // 24 hours — persist across days
const MEMORY_TTL    = 60 * 60 * 1000;       // 1 hour in-memory cache

// ── In-memory L1 cache (fastest, per-session) ──────────────────
const _memCache = new Map();

// sessionCount is folded into the key itself (not compared after the
// fact) so a new posture session naturally misses the old cache entry —
// no separate invalidation logic needed for these two layers. Previously
// only Firestore's own session_count field was checked (see
// getFirestoreCached below), but getCachedAsync short-circuits on a
// mem/session hit BEFORE ever reaching that Firestore check (and the
// sync getCached() used for instant reads never reaches Firestore at
// all), so a still-TTL-valid mem/sessionStorage entry from before the
// new session kept being served as current for up to an hour (mem) or
// until the tab closed (sessionStorage) — no invalidation trigger ever
// fired. sessionCount defaults to "" so a caller that genuinely has no
// count handy still gets a stable (if less precise) key rather than a
// crash.
function cacheKey(uid, tab, lang, sessionCount = "") {
  return `corvus_ai_${uid}_${tab}_${lang}_${sessionCount}`;
}

// ── Memory cache ───────────────────────────────────────────────
function getMemCached(uid, tab, lang, sessionCount) {
  const key = cacheKey(uid, tab, lang, sessionCount);
  const entry = _memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > MEMORY_TTL) { _memCache.delete(key); return null; }
  return entry.text;
}

function setMemCache(uid, tab, lang, text, sessionCount) {
  _memCache.set(cacheKey(uid, tab, lang, sessionCount), { text, ts: Date.now() });
}

// ── SessionStorage L2 fallback ─────────────────────────────────
function getSessionCached(uid, tab, lang, sessionCount) {
  try {
    const key = cacheKey(uid, tab, lang, sessionCount);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { text, ts } = JSON.parse(raw);
    if (Date.now() - ts > FIRESTORE_TTL) { sessionStorage.removeItem(key); return null; }
    return text;
  } catch { return null; }
}

function setSessionCache(uid, tab, lang, text, sessionCount) {
  try {
    sessionStorage.setItem(cacheKey(uid, tab, lang, sessionCount), JSON.stringify({ text, ts: Date.now() }));
  } catch {}
}

// ── Firestore L3 cache (persistent) ───────────────────────────
async function getFirestoreCached(uid, tab, lang, sessionCount) {
  try {
    const ref = doc(db, "users", uid, "ai_insights", `${tab}_${lang}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const { text, ts, session_count } = snap.data();
    // Invalidate if: expired OR session count changed
    if (Date.now() - ts > FIRESTORE_TTL) return null;
    if (session_count !== undefined && session_count !== sessionCount) return null;
    return text;
  } catch { return null; }
}

async function setFirestoreCache(uid, tab, lang, text, sessionCount) {
  try {
    const ref = doc(db, "users", uid, "ai_insights", `${tab}_${lang}`);
    await setDoc(ref, {
      text,
      ts: Date.now(),
      session_count: sessionCount,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[AIPreloader] Firestore write failed:", e.message);
  }
}

// ── Unified getCached — checks all 3 layers ────────────────────
async function getCachedAsync(uid, tab, lang, sessionCount) {
  // L1: memory
  const mem = getMemCached(uid, tab, lang, sessionCount);
  if (mem) return mem;

  // L2: sessionStorage
  const sess = getSessionCached(uid, tab, lang, sessionCount);
  if (sess) { setMemCache(uid, tab, lang, sess, sessionCount); return sess; }

  // L3: Firestore
  const fs = await getFirestoreCached(uid, tab, lang, sessionCount);
  if (fs) {
    setMemCache(uid, tab, lang, fs, sessionCount);
    setSessionCache(uid, tab, lang, fs, sessionCount);
    return fs;
  }

  return null;
}

// Sync version (memory + session only — for immediate reads).
// sessionCount is optional here (callers that don't have it handy yet
// still get mem/session lookups, just scoped to the "" bucket) — pass it
// whenever available so a fresh session count actually misses old text.
function getCached(uid, tab, lang, sessionCount) {
  return getMemCached(uid, tab, lang, sessionCount) || getSessionCached(uid, tab, lang, sessionCount);
}

function setCache(uid, tab, lang, text, sessionCount) {
  setMemCache(uid, tab, lang, text, sessionCount);
  setSessionCache(uid, tab, lang, text, sessionCount);
}

export { getCached, setCache, cacheKey, getCachedAsync, setFirestoreCache };

// ── Build context for preloader ─────────────────────────────────────
function buildCtx(profile, sessions, calibration, effectiveTier) {
  const _avg = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
  const allScores = (sessions||[]).map(s=>s.avg_score||0).filter(Boolean);
  const avgScore = _avg(allScores);
  const now = Date.now();
  const thisWeek = (sessions||[]).filter(s => {
    const d = s.created_at?.toDate?.()||new Date(s.created_at||0);
    return (now-d)<7*86400000;
  });
  const lastWeek = (sessions||[]).filter(s => {
    const d = s.created_at?.toDate?.()||new Date(s.created_at||0);
    const ms=now-d; return ms>=7*86400000&&ms<14*86400000;
  });
  const weekAvg = _avg(thisWeek.map(s=>s.avg_score||0));
  const lastWeekAvg = _avg(lastWeek.map(s=>s.avg_score||0));
  const trendPct = lastWeekAvg>0?Math.round(((weekAvg-lastWeekAvg)/lastWeekAvg)*100):0;
  const fatigueScore = Math.min(100,Math.max(0,Math.round((100-weekAvg)*0.6+(sessions?.length<5?30:10))));
  const neckRisk = Math.min(100,Math.round(100-avgScore+(avgScore<60?20:0)));
  const burnoutRisk = Math.min(100,Math.round(fatigueScore*0.8+(thisWeek.length>5?15:0)));
  const alertCounts = {};
  (sessions||[]).slice(0,20).forEach(s=>(s.alerts||[]).forEach(a=>{
    const k=typeof a==="string"?a:(a?.label||a?.type||""); if(k) alertCounts[k]=(alertCounts[k]||0)+1;
  }));
  const topAlerts = Object.entries(alertCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k);
  const _tier = effectiveTier||profile?.tier||"standard";
  const _name = profile?.name?.split(" ")[0]||"Patient";
  return { avgScore, weekAvg, lastWeekAvg, trendPct, totalSessions:sessions?.length||0,
    thisWeekSessions:thisWeek.length, fatigueScore, neckRisk, burnoutRisk,
    calibrated:!!calibration, topAlerts, name:_name, tier:_tier };
}

// ── Tab prompts (same as AIInsights) ────────────────────────────────
function buildPrompts(ctx, lang) {
  const isAr = lang === "ar";
  const scoreLabel = ctx.avgScore>=85?"Excellent":ctx.avgScore>=70?"Good":ctx.avgScore>=55?"Fair":"Needs Attention";

  const system = `You are Dr. Corvus — the clinical AI physiotherapist inside Corvus PostureAI Pro.

PATIENT — ${ctx.name} | Tier: ${ctx.tier}
Score: ${ctx.avgScore}/100 (${scoreLabel}) | This week: ${ctx.weekAvg}/100 | Last week: ${ctx.lastWeekAvg}/100
Trend: ${ctx.trendPct>0?"+":""}${ctx.trendPct}% | Sessions: ${ctx.totalSessions} | This week: ${ctx.thisWeekSessions}
Cervical risk: ${ctx.neckRisk}% | Fatigue: ${ctx.fatigueScore}% | Burnout: ${ctx.burnoutRisk}%
Calibration: ${ctx.calibrated?"COMPLETE":"NOT DONE"}
Alerts: ${ctx.topAlerts?.join("; ")||"None"}

${isAr?"اللغة: عامية مصرية كاملة.":"LANGUAGE: Clear professional English."}
CONCISE: Max 200 words. Start answer immediately — no preamble.

[CTXDATA:${JSON.stringify({avg:ctx.avgScore||0, sessions:ctx.totalSessions||0, weekAvg:ctx.weekAvg||0, weekSessions:ctx.thisWeekSessions||0, trendPct:ctx.trendPct||0, neckRisk:ctx.neckRisk||0, fatigue:ctx.fatigueScore||0, burnout:ctx.burnoutRisk||0, calibrated:!!ctx.calibrated, alerts:(ctx.topAlerts||[]).join("; "), lang})}]`;
  // ^ The prose above is free-form and was never matched by localAI.js's
  // parseData() regex fallback (it expects phrases like "Overall avg
  // score:"/"Neck risk:"/"Fatigue index:" that don't appear here — see
  // AICoach.jsx's buildSystemPrompt for the established fix: emit a
  // stable [CTXDATA:{...}] JSON marker that parseData() prefers over
  // regex-matching prose). Without it, if the primary LLM path ever
  // failed and this fell through to the rule-based fallback, that
  // fallback would report fabricated data — a genuinely calibrated user
  // told "Calibration: NOT DONE", real risk/fatigue/burnout percentages
  // silently replaced with 0 — instead of erroring or matching reality.

  return {
    executive: `Generate a clinical executive summary for ${ctx.name}.
## Performance Snapshot
[Interpret ${ctx.avgScore}/100 clinically — MSK load implication]
## Primary Risk Factors  
[2-3 specific risks with % and anatomical consequence]
## Priority Actions This Week
[3 numbered specific interventions — mechanism + benefit]
Max 200 words.`,

    trends: `Clinical trend analysis for ${ctx.name}.
Scores: ${ctx.avgScore}/100 overall | ${ctx.weekAvg}/100 this week | ${ctx.lastWeekAvg}/100 last week | ${ctx.trendPct>0?"+":""}${ctx.trendPct}% trend
## Trend Direction
[Interpret the ${ctx.trendPct}% change clinically]
## Root Cause
[What's driving this trend — behavioral/anatomical]
## Next Week Protocol
[2-3 specific interventions]
Max 180 words.`,

    fatigue: `Fatigue assessment for ${ctx.name}.
Fatigue: ${ctx.fatigueScore}% | Burnout: ${ctx.burnoutRisk}% | Sessions: ${ctx.thisWeekSessions}/week
## Fatigue Profile
[Acute vs chronic — physiological state at ${ctx.fatigueScore}%]
## Warning Signs
[3 specific clinical indicators from the data]
## Recovery Protocol
[3 evidence-based interventions with timeline]
Max 200 words.`,

    recommendations: `Clinical ergonomic plan for ${ctx.name}.
Score: ${ctx.avgScore}/100 | Calibration: ${ctx.calibrated?"personalized":"generic thresholds"} | Alerts: ${ctx.topAlerts?.slice(0,3).join(", ")||"none"}
## Immediate Interventions
[Top 2-3 with biomechanical rationale]
## Workstation Protocol
[Specific measurements — monitor height, chair angle, keyboard distance]
## Exercise Program
[4 exercises with sets×reps, target muscle, frequency]
## 30-Day Milestones
[Week 1/2/4 score targets]
Max 250 words.`,

    _system: system,
  };
}

// ── Main preloader ──────────────────────────────────────────────────
// Was a single shared boolean, not scoped per user — calling this for
// user A and then (before A's generation finished, e.g. an account
// switch without a full reload) for user B made B's call silently no-op
// against A's in-flight guard, generating nothing for B. Scope it by uid
// instead so concurrent/successive users don't block each other.
const _preloadingUids = new Set();

export async function preloadAIInsights(uid, profile, sessions, calibration, effectiveTier, lang = "en") {
  if (!uid || !sessions?.length || sessions.length < 1) return;
  if (_preloadingUids.has(uid)) return;

  const sessionCount = sessions.length;
  const tabs = ["executive", "trends", "fatigue", "recommendations"];

  // ── Check Firestore cache first (all 3 layers) ────────────────
  const cachedResults = await Promise.all(
    tabs.map(t => getCachedAsync(uid, t, lang, sessionCount))
  );
  const allCached = cachedResults.every(r => r !== null);
  if (allCached) {
    console.info("[AIPreloader] All tabs served from cache ✓ (no generation needed)");
    return;
  }

  // ── Generate missing tabs only ────────────────────────────────
  _preloadingUids.add(uid);
  console.info("[AIPreloader] Generating missing tabs...");

  const ctx     = buildCtx(profile, sessions, calibration, effectiveTier);
  const prompts = buildPrompts(ctx, lang);

  // Was tabs.forEach(async ...) (fire-and-forget, never awaited) plus a
  // fixed setTimeout(…, 15000) to clear the guard — but the tabs are
  // staggered up to 3*800=2400ms apart before even starting, and each
  // geminiAnalysis call can itself take up to ~22s (see localAI.js's
  // hardDeadline), so the last tab's generation routinely outlived the
  // 15s timer. That let the guard clear while work was still in flight,
  // allowing an overlapping second preloadAIInsights call to start and
  // duplicate outbound LLM requests. Await the real work instead, so the
  // guard's lifetime always matches how long generation actually took.
  try {
    await Promise.allSettled(tabs.map(async (tab, i) => {
      // Skip if already cached
      if (cachedResults[i] !== null) return;

      try {
        // Stagger requests to avoid rate limits
        await new Promise(r => setTimeout(r, i * 800));

        const text = await geminiAnalysis(prompts[tab], {
          systemPrompt: prompts._system,
          lang,
          maxTokens: 500,
        });

        if (text && text.length > 30) {
          // Save to all cache layers
          setMemCache(uid, tab, lang, text, sessionCount);
          setSessionCache(uid, tab, lang, text, sessionCount);
          // Save to Firestore (persists across reloads)
          await setFirestoreCache(uid, tab, lang, text, sessionCount);
          console.info(`[AIPreloader] ✅ ${tab} generated + saved to Firestore`);
        }
      } catch(e) {
        console.warn(`[AIPreloader] ${tab} failed:`, e.message);
      }
    }));
  } finally {
    _preloadingUids.delete(uid);
  }
}
