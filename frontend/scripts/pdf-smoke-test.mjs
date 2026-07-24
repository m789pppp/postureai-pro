/**
 * pdf-smoke-test.mjs — actually generates every PDF report type with
 * realistic (and deliberately edge-case) data and verifies the output
 * is a real, non-empty, valid PDF. Run after touching pdfReports.js:
 *
 *   node scripts/pdf-smoke-test.mjs
 *
 * This is not a replacement for opening the files and eyeballing the
 * layout — it catches "throws an exception" / "produces an empty or
 * corrupt file" bugs, and deliberately stresses the text-overflow
 * fixes (very long names, long emails, long AI-generated text, both
 * English and Arabic) so a regression there fails loudly instead of
 * silently rendering off the page.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "pdf-smoke-output");
fs.mkdirSync(outDir, { recursive: true });

const {
  exportPDFReport,
  generateSessionPDF,
  generateClinicalPDF,
  generateComparisonPDF,
  generateTeamPDF,
  generateLongitudinalPDF,
  generateAIPDF,
} = await import("../src/lib/pdfReports.js");

// ── Realistic + deliberately-long mock data ─────────────────────────
const LONG_NAME = "Mohamed Abdel-Rahman Yasser El-Sayed Ibrahim Hassan Al-Masri";
const LONG_EMAIL = "mohamed.yasser.very.long.employee.identifier@some-extremely-long-company-domain-name.com";
const LONG_COMPANY = "Al-Ahram Advanced Engineering, Manufacturing & Logistics Solutions Group W.L.L.";
const LONG_AR_NAME = "محمد عبد الرحمن ياسر السيد إبراهيم حسن المصري الطويل جداً";

const now = Date.now();
const metrics = {
  neck_lean: 62, head_tilt: 71, head_yaw: 55, shoulder_level: 68,
  spine_lean: 74, fhp_index: 48, rounded_shoulders: 59, elbow_angle: 82,
  monitor_height: 77, screen_distance: 65, trunk_lean: 70, hip_angle: 60, knee_angle: 88,
};
const scoreHistory = Array.from({ length: 24 }, (_, i) => 40 + Math.round(30 * Math.sin(i / 3) + 20));

function mkSession(overrides = {}) {
  return {
    id: "sess_" + Math.random().toString(36).slice(2),
    avg_score: 63, duration_s: 1830, good_pct: 58, alerts_count: 7,
    score_history: scoreHistory, metrics,
    ai_tip: "Your neck posture noticeably degrades after ~25 minutes of continuous screen time; consider a movement break every 20 minutes. ".repeat(3),
    pain_summary: "Reported mild tension in the upper trapezius and base of the neck, worse toward the end of long sessions.",
    created_at: new Date(now),
    tier: "personal_elite",
    ...overrides,
  };
}

const profileLong = {
  name: LONG_NAME, tier: "personal_elite",
  company_name: LONG_COMPANY, organization: LONG_COMPANY,
};
const profileAr = { name: LONG_AR_NAME, tier: "b2b_enterprise", company_name: "شركة الأهرام للهندسة المتقدمة والتصنيع" };
const userLong = { displayName: LONG_NAME, email: LONG_EMAIL };

const aiSummaryLong =
  "Executive summary: across the review period, posture quality showed a gradual decline correlated with " +
  "afternoon meeting-heavy days, with the most significant risk concentrated in the cervical and thoracic " +
  "regions. Forward head posture and rounded shoulders were the two most consistent contributors to lower " +
  "scores, particularly during long, uninterrupted desk sessions exceeding ninety minutes.";

const usersLong = [
  { name: LONG_NAME, avg_score: 41, last_session: new Date(now) },
  { email: LONG_EMAIL, avg_score: 38, last_session: new Date(now) }, // no name -> falls back to email
  { name: "Sara Ali", avg_score: 77, last_session: new Date(now) },
  { name: null, email: "a@b.com", avg_score: 22, last_session: new Date(now) },
];

const allSessions = Array.from({ length: 8 }, (_, i) => mkSession({ created_at: new Date(now - i * 86400000) }));

const cases = [
  ["generateSessionPDF (EN, long name/email)", () => generateSessionPDF({
    session: mkSession(), profile: profileLong, user: userLong, lang: "en",
    allSessions, aiSummary: aiSummaryLong,
  })],
  ["generateSessionPDF (AR, long Arabic name)", () => generateSessionPDF({
    session: mkSession(), profile: profileAr, user: userLong, lang: "ar",
    allSessions, aiSummary: aiSummaryLong,
  })],
  ["generateClinicalPDF (EN)", () => generateClinicalPDF({
    session: mkSession(), profile: profileLong, user: userLong, lang: "en",
    allSessions, aiSummary: aiSummaryLong,
  })],
  ["generateComparisonPDF (EN)", () => generateComparisonPDF({
    session1: mkSession(), session2: mkSession({ avg_score: 74 }),
    sessions: allSessions, profile: profileLong, user: userLong, lang: "en",
    allSessions, aiSummary: aiSummaryLong,
  })],
  ["generateTeamPDF (EN, mixed long names/emails)", () => generateTeamPDF({
    users: usersLong, company: LONG_COMPANY, dateRange: 30, profile: profileLong,
    lang: "en", aiSummary: aiSummaryLong,
  })],
  ["generateLongitudinalPDF (EN)", () => generateLongitudinalPDF({
    sessions: allSessions, profile: profileLong, user: userLong, lang: "en", aiSummary: aiSummaryLong,
  })],
  ["generateAIPDF (EN, elite)", () => generateAIPDF({
    sessions: allSessions, profile: { ...profileLong, tier: "personal_elite" },
    aiSummary: aiSummaryLong, lang: "en",
  })],
];

let pass = 0, fail = 0;
for (const [label, fn] of cases) {
  try {
    const t0 = Date.now();
    process.chdir(outDir); // jsPDF's doc.save() in Node writes via fs relative to CWD
    const filename = await fn();
    if (typeof filename !== "string" || !filename) {
      throw new Error("generator didn't return a filename string: " + JSON.stringify(filename));
    }
    const filePath = path.join(outDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`doc.save() didn't produce a file at expected path: ${filePath}`);
    }
    const buf = fs.readFileSync(filePath);
    const isValidPdf = buf.subarray(0, 5).toString("ascii") === "%PDF-";
    if (!isValidPdf || buf.length < 1000) {
      throw new Error(`output doesn't look like a real PDF (valid header=${isValidPdf}, size=${buf.length}b)`);
    }
    console.log(`✅ ${label} — "${filename}" — ${buf.length.toLocaleString()} bytes, ${Date.now() - t0}ms`);
    pass++;
  } catch (e) {
    console.error(`❌ ${label} — ${e?.message || e}`);
    if (e?.stack) console.error(e.stack.split("\n").slice(1, 4).join("\n"));
    fail++;
  }
}

console.log(`\n${pass}/${pass + fail} PDF generators passed. Output in ${outDir}`);
if (fail > 0) process.exit(1);
