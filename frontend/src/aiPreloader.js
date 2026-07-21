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

function cacheKey(uid, tab, lang) {
  return `corvus_ai_${uid}_${tab}_${lang}`;
}

// ── Memory cache ───────────────────────────────────────────────
function getMemCached(uid, tab, lang) {
  const key = cacheKey(uid, tab, lang);
  const entry = _memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > MEMORY_TTL) { _memCache.delete(key); return null; }
  return entry.text;
}

function setMemCache(uid, tab, lang, text) {
  _memCache.set(cacheKey(uid, tab, lang), { text, ts: Date.now() });
}

// ── SessionStorage L2 fallback ─────────────────────────────────
function getSessionCached(uid, tab, lang) {
  try {
    const raw = sessionStorage.getItem(cacheKey(uid, tab, lang));
    if (!raw) return null;
    const { text, ts } = JSON.parse(raw);
    if (Date.now() - ts > FIRESTORE_TTL) { sessionStorage.removeItem(cacheKey(uid, tab, lang)); return null; }
    return text;
  } catch { return null; }
}

function setSessionCache(uid, tab, lang, text) {
  try {
    sessionStorage.setItem(cacheKey(uid, tab, lang), JSON.stringify({ text, ts: Date.now() }));
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
  const mem = getMemCached(uid, tab, lang);
  if (mem) return mem;

  // L2: sessionStorage
  const sess = getSessionCached(uid, tab, lang);
  if (sess) { setMemCache(uid, tab, lang, sess); return sess; }

  // L3: Firestore
  const fs = await getFirestoreCached(uid, tab, lang, sessionCount);
  if (fs) {
    setMemCache(uid, tab, lang, fs);
    setSessionCache(uid, tab, lang, fs);
    return fs;
  }

  return null;
}

// Sync version (memory + session only — for immediate reads)
function getCached(uid, tab, lang) {
  return getMemCached(uid, tab, lang) || getSessionCached(uid, tab, lang);
}

function setCache(uid, tab, lang, text) {
  setMemCache(uid, tab, lang, text);
  setSessionCache(uid, tab, lang, text);
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
CONCISE: Max 200 words. Start answer immediately — no preamble.`;

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
let _preloading = false;

export async function preloadAIInsights(uid, profile, sessions, calibration, effectiveTier, lang = "en") {
  if (!uid || !sessions?.length || sessions.length < 1) return;
  if (_preloading) return;

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
  _preloading = true;
  console.info("[AIPreloader] Generating missing tabs...");

  const ctx     = buildCtx(profile, sessions, calibration, effectiveTier);
  const prompts = buildPrompts(ctx, lang);

  tabs.forEach(async (tab, i) => {
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
        setMemCache(uid, tab, lang, text);
        setSessionCache(uid, tab, lang, text);
        // Save to Firestore (persists across reloads)
        await setFirestoreCache(uid, tab, lang, text, sessionCount);
        console.info(`[AIPreloader] ✅ ${tab} generated + saved to Firestore`);
      }
    } catch(e) {
      console.warn(`[AIPreloader] ${tab} failed:`, e.message);
    }
  });

  setTimeout(() => { _preloading = false; }, 15000);
}
