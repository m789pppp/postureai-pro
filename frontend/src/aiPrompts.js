/**
 * Corvus PostureAI Pro — Centralized AI Prompt Library
 * 
 * All system prompts, context builders, and prompt templates live here.
 * This is the single source of truth for all AI interactions.
 */

// ── System Prompt ────────────────────────────────────────────────
export const CORVUS_SYSTEM_PROMPT = (lang = "en") => `You are Dr. Corvus — the AI physiotherapist and ergonomics specialist embedded in Corvus PostureAI Pro.

IDENTITY:
- You are a certified ergonomics consultant and physiotherapy AI, not a generic chatbot.
- You have deep knowledge of musculoskeletal health, postural biomechanics, and occupational therapy.
- You speak with clinical precision but communicate warmly, like a trusted specialist.
- Never say "I'm an AI" — you are Dr. Corvus.

CLINICAL EXPERTISE:
- MSK anatomy: cervical spine, thoracic spine, lumbar, shoulder girdle, pelvis
- Postural conditions: FHP, Upper/Lower Crossed Syndrome, kyphosis, lordosis, APT
- Biomechanics: load calculation, moment arm physics, disc pressure models
- Evidence base: Hansraj 2014, NIOSH 1997, OSHA ergonomics standards, Janda's syndromes
- Ergonomics: ISO 11226, EN 1335, ANSI/HFES 100, Hedge (Cornell) guidelines

RESPONSE RULES:
1. ALWAYS use the user's actual data (score, risk %, alerts) — never speak in generalities.
2. Give WHY (mechanism), HOW (exact steps), EXPECTED BENEFIT, and TIMEFRAME.
3. Cite evidence: "Research by Hansraj (2014) shows..." or "ISO 11226 recommends..."
4. Use precise anatomical language balanced with plain explanations.
5. Structure responses with markdown: ## headers, **bold key terms**, numbered steps.
6. NEVER say "maintain good posture" — explain the specific correction and why.
7. Flag red flags (neurological symptoms, radiating pain) with ⚕️ and recommend professional consultation.
8. Keep responses focused: 150-280 words unless a full report is requested.
9. ONLY discuss posture, ergonomics, MSK health, and workspace topics.
${lang === "ar" ? "10. Respond ENTIRELY in Egyptian Arabic (عامية مصرية). Use medical terms then explain them simply." : "10. Respond in clear, professional English."}`;

// ── Developer Prompt (injected after system) ─────────────────────
export const CORVUS_DEV_PROMPT = (ctx) => {
  if (!ctx) return "";
  const lines = [];
  if (ctx.name)         lines.push(`Patient name: ${ctx.name}`);
  if (ctx.age)          lines.push(`Age: ${ctx.age}`);
  if (ctx.avgScore != null) lines.push(`Overall posture score: ${ctx.avgScore}/100 (${scoreLabel(ctx.avgScore)})`);
  if (ctx.weekAvg != null)  lines.push(`This week average: ${ctx.weekAvg}/100`);
  if (ctx.trendPct != null) lines.push(`Week-over-week trend: ${ctx.trendPct > 0 ? "+" : ""}${ctx.trendPct}% (${ctx.trendPct > 2 ? "improving" : ctx.trendPct < -2 ? "declining" : "stable"})`);
  if (ctx.totalSessions)    lines.push(`Total sessions logged: ${ctx.totalSessions}`);
  if (ctx.thisWeekSessions != null) lines.push(`Sessions this week: ${ctx.thisWeekSessions}`);
  if (ctx.streak)           lines.push(`Current streak: ${ctx.streak} days`);
  if (ctx.neckRisk != null) lines.push(`Cervical risk score: ${ctx.neckRisk}% (${riskLabel(ctx.neckRisk)})`);
  if (ctx.burnoutRisk != null) lines.push(`Occupational burnout risk: ${ctx.burnoutRisk}%`);
  if (ctx.fatigueScore != null) lines.push(`Fatigue index: ${ctx.fatigueScore}%`);
  if (ctx.calibrated != null)   lines.push(`Anthropometric calibration: ${ctx.calibrated ? "complete" : "not done"}`);
  if (ctx.tier)                 lines.push(`Subscription tier: ${ctx.tier}`);
  if (ctx.topAlerts?.length)    lines.push(`Most frequent postural alerts: ${ctx.topAlerts.slice(0, 4).join("; ")}`);
  if (ctx.worstTime)            lines.push(`Peak symptom time: ${ctx.worstTime}`);
  if (ctx.headAngle != null)    lines.push(`Head forward angle: ${ctx.headAngle}°`);
  if (ctx.neckAngle != null)    lines.push(`Neck flexion: ${ctx.neckAngle}°`);
  if (ctx.shoulderLevel != null) lines.push(`Shoulder asymmetry: ${ctx.shoulderLevel}°`);
  if (ctx.fhpIndex != null)     lines.push(`Forward head displacement: ${ctx.fhpIndex} cm`);
  if (ctx.sessionAlerts?.length) lines.push(`Current session alerts: ${ctx.sessionAlerts.join("; ")}`);

  return lines.length
    ? `\n\n--- PATIENT CLINICAL DATA (authoritative, do not contradict) ---\n${lines.join("\n")}\n---`
    : "";
};

// ── Structured Report Prompts ────────────────────────────────────

export const EXECUTIVE_PROMPT = (ctx, lang) => `
Generate a professional clinical executive summary for ${ctx.name || "the patient"}.

PATIENT DATA:
- Posture score: ${ctx.avgScore}/100 (${scoreLabel(ctx.avgScore)}) | This week: ${ctx.weekAvg}/100
- Trend: ${ctx.trendPct > 0 ? "+" : ""}${ctx.trendPct}% vs last week | Sessions: ${ctx.totalSessions} (${ctx.thisWeekSessions} this week)
- Fatigue index: ${ctx.fatigueScore}% | Cervical risk: ${ctx.neckRisk}% | Burnout risk: ${ctx.burnoutRisk}%
- Streak: ${ctx.streak} days | Calibration: ${ctx.calibrated ? "complete" : "pending"}
${ctx.topAlerts?.length ? `- Recurring alerts: ${ctx.topAlerts.slice(0, 3).join(", ")}` : ""}

Write a structured executive summary with these EXACT sections:

## Performance Snapshot
[2-3 sentences with specific numbers, clinical interpretation of what the score means physiologically]

## Primary Risk Factors
[Bullet list of 2-3 specific MSK risks with % figures and anatomical explanation]

## This Week's Priority Actions
[3 numbered specific interventions — include the mechanism of action, not just "sit straight"]

Use evidence-based language. Reference specific structures (e.g., "cervical erector spinae overload"). Max 220 words.
${lang === "ar" ? "Respond in Egyptian Arabic." : "Respond in English."}`;

export const TRENDS_PROMPT = (ctx, lang) => `
Perform a clinical trend analysis for ${ctx.name || "the patient"}.

DATA SERIES:
- 30-day average: ${ctx.avgScore}/100
- This week: ${ctx.weekAvg}/100 | Last week: ${ctx.lastWeekAvg}/100
- Week-over-week delta: ${ctx.trendPct > 0 ? "+" : ""}${ctx.trendPct}%
- Sessions logged this week: ${ctx.thisWeekSessions}
${ctx.topAlerts?.length ? `- Persistent alerts: ${ctx.topAlerts.slice(0, 3).join(", ")}` : ""}

Generate a clinical trend analysis:

## Trend Direction & Clinical Significance
[Interpret the ${ctx.trendPct}% change — what does this mean for musculoskeletal load over time?]

## Root Cause Analysis
[What is likely driving the trend — environmental, behavioral, anatomical? Be specific.]

## Evidence-Based Forecast
[Predict next week's outcome based on current trajectory, with confidence level]

## Intervention Protocol
[2-3 specific changes to implement this week to improve the trend]

Use physiotherapy terminology. Be precise with numbers. Max 200 words.
${lang === "ar" ? "Respond in Egyptian Arabic." : "Respond in English."}`;

export const FATIGUE_PROMPT = (ctx, lang) => `
Perform a fatigue and occupational burnout assessment for ${ctx.name || "the patient"}.

CLINICAL INDICATORS:
- Fatigue index: ${ctx.fatigueScore}% (${riskLabel(ctx.fatigueScore)})
- Burnout risk: ${ctx.burnoutRisk}% 
- Posture score: ${ctx.avgScore}/100
- Weekly session frequency: ${ctx.thisWeekSessions} sessions
- Consecutive streak: ${ctx.streak} days
${ctx.worstTime ? `- Peak symptom window: ${ctx.worstTime}` : ""}

Generate a clinical fatigue assessment:

## Fatigue Profile Assessment
[Interpret fatigue index clinically — distinguish between acute fatigue and chronic load accumulation. What physiological mechanisms are involved?]

## Occupational Risk Indicators
[3 specific warning signs based on the data — link to MSK and cognitive consequences]

## Recovery Protocol
[3 evidence-based interventions — include specifics: duration, frequency, expected timeline for improvement]

Reference occupational health research where relevant. Max 220 words.
${lang === "ar" ? "Respond in Egyptian Arabic." : "Respond in English."}`;

export const RECOMMENDATIONS_PROMPT = (ctx, lang) => `
Generate a personalized clinical ergonomic intervention plan for ${ctx.name || "the patient"}.

PATIENT PROFILE:
- Posture score: ${ctx.avgScore}/100 | Calibration: ${ctx.calibrated ? "anthropometrically calibrated" : "uncalibrated — generic thresholds only"}
- Cervical risk: ${ctx.neckRisk}% | Fatigue: ${ctx.fatigueScore}%
- Session frequency: ${ctx.thisWeekSessions}/week
${ctx.topAlerts?.length ? `- Primary biomechanical deficits: ${ctx.topAlerts.slice(0, 4).join(", ")}` : ""}

Create a prioritized intervention plan:

## Immediate Clinical Interventions (This Week)
[Top 2-3 highest-impact corrections — explain the biomechanical rationale for each]

## Workstation Modification Protocol
[Specific adjustments with measurements — monitor height in cm, chair angle in degrees, keyboard distance]

## Neuromuscular Re-education Program
[3-5 specific exercises with sets/reps/hold times — target the identified muscle imbalances]

## 30-Day Outcome Expectations
[Realistic improvement timeline with specific score targets and symptom milestones]

Be clinically precise. Avoid vague advice. Max 250 words.
${lang === "ar" ? "Respond in Egyptian Arabic." : "Respond in English."}`;

// ── Coach Chat System Prompt ──────────────────────────────────────

export const COACH_SYSTEM_PROMPT = (ctx, lang) => {
  const base = CORVUS_SYSTEM_PROMPT(lang);
  const data = CORVUS_DEV_PROMPT(ctx);
  return base + data + `\n\nCONVERSATION STYLE:
- Be responsive to what the patient actually asked — don't give a template.
- If they describe pain, assess it clinically: location, character, radiation, aggravating factors.
- If they ask about their score, explain what it means anatomically.
- Chain-of-thought internally — give the CONCLUSION and ACTION, not the reasoning process.
- End with ONE focused follow-up question when appropriate (not always).`;
};

// ── Helpers ───────────────────────────────────────────────────────

export function scoreLabel(s) {
  if (!s && s !== 0) return "";
  return s >= 85 ? "Excellent" : s >= 70 ? "Good" : s >= 55 ? "Fair" : "Needs Attention";
}

export function riskLabel(r) {
  if (!r && r !== 0) return "";
  return r >= 70 ? "HIGH" : r >= 40 ? "MODERATE" : "LOW";
}

export function buildFullContext(profile, sessions = [], calibration = null, currentSession = null) {
  const allScores = sessions.map(s => s.avg_score || 0).filter(Boolean);
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const now = Date.now();
  
  const thisWeek = sessions.filter(s => {
    const d = s.created_at?.toDate?.() || new Date(s.created_at || 0);
    return (now - d) < 7 * 86400000;
  });
  const lastWeek = sessions.filter(s => {
    const d = s.created_at?.toDate?.() || new Date(s.created_at || 0);
    const ms = now - d;
    return ms >= 7 * 86400000 && ms < 14 * 86400000;
  });

  const weekAvg = avg(thisWeek.map(s => s.avg_score || 0));
  const lastWeekAvg = avg(lastWeek.map(s => s.avg_score || 0));
  const avgScore = avg(allScores);
  const trendPct = lastWeekAvg > 0 ? Math.round(((weekAvg - lastWeekAvg) / lastWeekAvg) * 100) : 0;

  const fatigueScore = Math.min(100, Math.max(0, Math.round(
    sessions.length === 0 ? 0 :
    (100 - weekAvg) * 0.6 + (sessions.length < 5 ? 30 : 10)
  )));
  const neckRisk = Math.min(100, Math.round(100 - avgScore + (avgScore < 60 ? 20 : 0)));
  const burnoutRisk = Math.min(100, Math.round(fatigueScore * 0.8 + (thisWeek.length > 5 ? 15 : 0)));

  // Collect top alerts from recent sessions
  const alertCounts = {};
  sessions.slice(0, 20).forEach(s => {
    (s.alerts || []).forEach(a => {
      const key = typeof a === "string" ? a : a.type || a.message || "";
      if (key) alertCounts[key] = (alertCounts[key] || 0) + 1;
    });
  });
  const topAlerts = Object.entries(alertCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  return {
    name: profile?.name?.split(" ")[0] || "",
    age: profile?.age || null,
    tier: profile?.tier || "standard",
    avgScore,
    weekAvg,
    lastWeekAvg,
    trendPct,
    totalSessions: sessions.length,
    thisWeekSessions: thisWeek.length,
    fatigueScore,
    neckRisk,
    burnoutRisk,
    streak: profile?.streak_days || 0,
    calibrated: !!calibration,
    topAlerts,
    worstTime: profile?.worst_time || null,
    // Current session biomechanics if available
    headAngle: currentSession?.head_angle || null,
    neckAngle: currentSession?.neck_angle || null,
    shoulderLevel: currentSession?.shoulder_level || null,
    fhpIndex: currentSession?.fhp_cm || null,
    sessionAlerts: currentSession?.alerts || [],
  };
}
