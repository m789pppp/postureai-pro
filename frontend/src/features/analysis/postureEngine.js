/**
 * PostureAI Pro — Posture Analysis Feature Module
 * Extracts all analysis logic from App.jsx
 * Preserves EXACT same math — no changes to scoring
 */

// ── MediaPipe Landmark helpers ────────────────────────────────────
export const PL = {
  NOSE: 0, L_EYE_INNER: 1, L_EYE: 2, L_EYE_OUTER: 3,
  R_EYE_INNER: 4, R_EYE: 5, R_EYE_OUTER: 6,
  L_EAR: 7, R_EAR: 8,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
};

// ── Geometry ──────────────────────────────────────────────────────
export function angleVert(p1, p2) {
  const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y);
  return dy < 0.001 ? 90 : Math.abs(Math.atan2(dx, dy) * 180 / Math.PI);
}

export function angleHoriz(p1, p2) {
  const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y);
  return dx < 0.001 ? 90 : Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
}

export function angle3pt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const n1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const n2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
  if (n1 < 0.001 || n2 < 0.001) return 90;
  const cos = (v1.x * v2.x + v1.y * v2.y) / (n1 * n2);
  return Math.round(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI);
}

// ── Score helpers ─────────────────────────────────────────────────
export function scoreMetric(v, ideal, ok, bad) {
  const d = Math.abs(v - ideal);
  if (d <= ok)  return Math.max(0, Math.round(100 - (d / Math.max(ok, 0.1)) * 25));
  if (d <= bad) return Math.max(0, Math.round(75 - ((d - ok) / Math.max(bad - ok, 0.1)) * 45));
  return Math.max(0, Math.round(30 - (d - bad) * 1.8));
}

export function gradeScore(s) {
  return s >= 85 ? "Excellent" : s >= 70 ? "Good" : s >= 50 ? "Fair" : "Poor";
}
export function gradeScoreAr(s) {
  return s >= 85 ? "ممتاز" : s >= 70 ? "جيد" : s >= 50 ? "مقبول" : "ضعيف";
}
export function scoreColor(s) {
  return s >= 75 ? "#10b981" : s >= 50 ? "#f59e0b" : "#ef4444";
}

// ── Front-camera analysis (MediaPipe) ─────────────────────────────
export function analyzeMP(lms, W, H, mode) {
  if (!lms || lms.length < 25) return null;
  const g  = idx => lms[idx];
  const px = idx => ({ x: g(idx).x * W, y: g(idx).y * H });
  const vis = idx => (g(idx)?.visibility || 0) > 0.45;

  const nose  = px(PL.NOSE);
  const lSh   = px(PL.L_SHOULDER), rSh = px(PL.R_SHOULDER);
  const lEar  = px(PL.L_EAR),      rEar = px(PL.R_EAR);
  const lEye  = px(PL.L_EYE),      rEye = px(PL.R_EYE);
  const lHip  = px(PL.L_HIP),      rHip = px(PL.R_HIP);

  const midSh  = { x: (lSh.x + rSh.x) / 2,  y: (lSh.y + rSh.y) / 2 };
  const midEar = { x: (lEar.x + rEar.x) / 2, y: (lEar.y + rEar.y) / 2 };
  const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };

  const neckLean   = angleVert(midSh, midEar);
  const headTilt   = angleHoriz(lEye, rEye);
  const shTilt     = angleHoriz(lSh, rSh);
  const spineLean  = angleVert(midHip, midSh);

  // Distance estimation
  const shW   = Math.sqrt((lSh.x - rSh.x) ** 2 + (lSh.y - rSh.y) ** 2);
  const focal = 600 * (W / 640);
  let distCm  = shW > 5 ? Math.round((40 * focal) / shW) : 65;
  distCm = Math.max(20, Math.min(150, distCm));

  const lo = mode === "laptop" ? 50 : 60;
  const hi = mode === "laptop" ? 80 : 90;
  const distSc = distCm >= lo && distCm <= hi ? 100 : (distCm >= lo - 12 && distCm <= hi + 18) ? 72 : 30;

  const neckSc  = scoreMetric(neckLean, 0, 9, 26);
  const tiltSc  = scoreMetric(headTilt, 0, 3, 10);
  const shSc    = scoreMetric(shTilt, 0, 3, 10);
  const spineSc = scoreMetric(spineLean, 0, 6, 18);

  const overall = Math.max(0, Math.min(100, Math.round(
    neckSc * 0.28 + tiltSc * 0.15 + shSc * 0.12 + spineSc * 0.13 + distSc * 0.18 + 70 * 0.14
  )));

  return {
    score: overall,
    metrics: {
      neck_lean:       { value: Math.round(neckLean),  score: neckSc,  unit: "°",  label: "Neck lean" },
      head_tilt:       { value: Math.round(headTilt),  score: tiltSc,  unit: "°",  label: "Head tilt" },
      shoulder_level:  { value: Math.round(shTilt),    score: shSc,    unit: "°",  label: "Shoulder level" },
      spine_lean:      { value: Math.round(spineLean), score: spineSc, unit: "°",  label: "Spine lean" },
      screen_distance: { value: distCm,                score: distSc,  unit: "cm", label: "Screen distance" },
    },
    alerts: [
      neckLean > 25 && `⚠️ Severe neck lean ${Math.round(neckLean)}° — raise monitor`,
      neckLean > 15 && neckLean <= 25 && `Neck lean ${Math.round(neckLean)}° — check monitor height`,
      headTilt > 10 && `Head tilt ${Math.round(headTilt)}° — level your head`,
      shTilt > 10 && `Shoulder imbalance ${Math.round(shTilt)}° — adjust armrests`,
      distCm < lo - 10 && `⚠️ Very close (${distCm}cm) — move back to ${lo}–${hi}cm`,
      distCm < lo && distCm >= lo - 10 && `Too close (${distCm}cm) — ideal ${lo}–${hi}cm`,
      distCm > hi + 15 && `Too far (${distCm}cm) — ideal ${lo}–${hi}cm`,
      spineLean > 20 && `⚠️ Spine lean ${Math.round(spineLean)}° — use lumbar support`,
    ].filter(Boolean),
    recommendations: [
      `Overall: ${gradeScore(overall)} (${overall}/100)`,
      `Screen distance: ${distCm >= lo && distCm <= hi ? "✓ Optimal" : `Move to ${lo}–${hi}cm`} (${distCm}cm)`,
      "Keep ears directly above shoulders, chin parallel to floor",
      "Lumbar support: lower back fully touching chair back",
      "Every 30 min: stand and stretch for 2 minutes",
    ],
    detected:   true,
    confidence: Math.min(94, 78 + (vis(PL.L_SHOULDER) && vis(PL.R_SHOULDER) ? 10 : 0) + (vis(PL.L_EAR) ? 6 : 0)),
  };
}

// ── Side-camera analysis ──────────────────────────────────────────
export function analyzeSideMP(lms, W, H) {
  if (!lms || lms.length < 28) return null;
  const g  = idx => lms[idx];
  const px = idx => ({ x: g(idx).x * W, y: g(idx).y * H });
  const vis = idx => (g(idx)?.visibility || 0) > 0.45;

  const lVis = g(PL.L_SHOULDER)?.visibility || 0;
  const rVis = g(PL.R_SHOULDER)?.visibility || 0;
  const S    = lVis >= rVis ? "L" : "R";

  const ear   = px(S === "L" ? PL.L_EAR      : PL.R_EAR);
  const sh    = px(S === "L" ? PL.L_SHOULDER  : PL.R_SHOULDER);
  const hip   = px(S === "L" ? PL.L_HIP       : PL.R_HIP);
  const knee  = px(S === "L" ? PL.L_KNEE      : PL.R_KNEE);
  const ankle = px(S === "L" ? PL.L_ANKLE     : PL.R_ANKLE);

  const neckLean  = angleVert(sh, ear);
  const trunkLean = angleVert(hip, sh);
  const hipAngle  = angle3pt(sh, hip, knee);
  const kneeAngle = angle3pt(hip, knee, ankle);
  const spineAlign = Math.abs(ear.x - ankle.x) / W * 100;

  const neckSc  = scoreMetric(neckLean, 0, 10, 28);
  const trunkSc = scoreMetric(trunkLean, 0, 8, 22);
  const hipSc   = scoreMetric(Math.abs(hipAngle - 90), 0, 15, 35);
  const kneeSc  = scoreMetric(Math.abs(kneeAngle - 90), 0, 15, 40);
  const spineSc = scoreMetric(spineAlign, 0, 4, 12);

  const overall = Math.max(0, Math.min(100, Math.round(
    neckSc * 0.28 + trunkSc * 0.26 + hipSc * 0.18 + kneeSc * 0.14 + spineSc * 0.14
  )));

  return {
    score: overall,
    metrics: {
      neck_lean_side: { value: Math.round(neckLean),   score: neckSc,  unit: "°", label: "Neck lean" },
      trunk_lean:     { value: Math.round(trunkLean),  score: trunkSc, unit: "°", label: "Trunk lean" },
      hip_angle:      { value: Math.round(hipAngle),   score: hipSc,   unit: "°", label: "Hip angle" },
      knee_angle:     { value: Math.round(kneeAngle),  score: kneeSc,  unit: "°", label: "Knee angle" },
      spine_align:    { value: Math.round(spineAlign), score: spineSc, unit: "%", label: "Spine alignment" },
    },
    alerts: [
      neckLean > 20 && `Forward head ${Math.round(neckLean)}° — align ear above shoulder`,
      trunkLean > 15 && `Trunk lean ${Math.round(trunkLean)}° — sit back to backrest`,
      Math.abs(hipAngle - 90) > 20 && `Hip angle ${Math.round(hipAngle)}° (ideal 90°) — adjust seat`,
      Math.abs(kneeAngle - 90) > 25 && `Knee angle ${Math.round(kneeAngle)}° (ideal 90°)`,
    ].filter(Boolean),
    recommendations: [
      `${gradeScore(overall)} lateral posture — ear→shoulder→hip should align vertically`,
      `Hip angle ${Math.round(hipAngle)}° — ${Math.abs(hipAngle - 90) < 15 ? "ideal" : "adjust chair height"}`,
      "Feet flat on floor, lumbar support engaged",
    ],
    detected:   true,
    confidence: Math.min(92, 75 + (Math.max(lVis, rVis) > 0.7 ? 17 : 0)),
  };
}

// ── Apply calibration to result ───────────────────────────────────
export function applyCalibrationToResult(result, calibration) {
  if (!calibration?.tolerances || !result?.metrics) return result;

  const tols   = calibration.tolerances;
  const newMet = { ...result.metrics };
  const map    = {
    neck_lean:       "neck_angle",
    head_tilt:       "head_tilt",
    shoulder_level:  "shoulder_tilt",
    spine_lean:      "spine_angle",
  };

  let totalScore = 0, count = 0;

  Object.entries(map).forEach(([metKey, calibKey]) => {
    if (newMet[metKey] !== undefined && tols[calibKey]) {
      const { ideal, ok, bad } = tols[calibKey];
      const val = newMet[metKey].value;
      const d   = Math.abs(val - ideal);
      let calibrated;
      if (d <= ok)       calibrated = Math.max(0, Math.round(100 - (d / Math.max(ok, 0.1)) * 25));
      else if (d <= bad) calibrated = Math.max(0, Math.round(75 - ((d - ok) / Math.max(bad - ok, 0.1)) * 45));
      else               calibrated = Math.max(0, Math.round(30 - (d - bad) * 1.2));
      newMet[metKey] = { ...newMet[metKey], score: calibrated, calibrated: true };
    }
    if (newMet[metKey]?.score !== undefined) {
      totalScore += newMet[metKey].score; count++;
    }
  });

  // Blend calibrated score with raw (60/40)
  const calibScore = count ? Math.round(totalScore / count) : result.score;
  const finalScore = Math.round(result.score * 0.4 + calibScore * 0.6);

  return { ...result, score: finalScore, metrics: newMet };
}

// ── Canvas drawing helpers ────────────────────────────────────────
export function drawFrontOverlay(ctx, result, W, H) {
  if (!ctx || !result?.landmarks?.length) return;
  const col = result.score >= 75 ? "#10b981" : result.score >= 50 ? "#f59e0b" : "#ef4444";

  // Skeleton connections
  const conns = [
    ["l_ear","r_ear"], ["l_ear","l_sh"], ["r_ear","r_sh"],
    ["l_sh","r_sh"], ["l_sh","l_hip"], ["r_sh","r_hip"], ["l_hip","r_hip"],
  ];
  const pts = {};
  result.landmarks.forEach(lm => { pts[lm.name] = { x: lm.x * W, y: lm.y * H }; });

  ctx.setLineDash([]);
  conns.forEach(([a, b]) => {
    if (pts[a] && pts[b]) {
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.strokeStyle = col + "88";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  Object.entries(pts).forEach(([, pt]) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  });
}

export function drawSideOverlay(ctx, result, W, H) {
  if (!ctx || !result?.landmarks?.length) return;
  const col  = result.score >= 75 ? "#10b981" : result.score >= 50 ? "#f59e0b" : "#ef4444";
  const pts  = {};
  result.landmarks.forEach(lm => { pts[lm.name] = { x: lm.x * W, y: lm.y * H }; });

  const order = ["ear", "sh", "hip", "knee", "ankle"];
  ctx.setLineDash([]);
  for (let i = 0; i < order.length - 1; i++) {
    const a = pts[order[i]], b = pts[order[i + 1]];
    if (a && b) {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = col + "88"; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  Object.values(pts).forEach(pt => {
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  });

  // Ideal alignment line
  if (pts.ear && pts.ankle) {
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(pts.ear.x, 0); ctx.lineTo(pts.ear.x, H);
    ctx.strokeStyle = "rgba(99,102,241,.4)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ── Mode helpers ──────────────────────────────────────────────────
export const MODES = {
  laptop: { label: "Laptop Camera", labelAr: "كاميرا اللابتوب", icon: "💻", distRange: [50, 80] },
  phone:  { label: "Phone Camera",  labelAr: "كاميرا الموبايل",  icon: "📱", distRange: [60, 90] },
  side:   { label: "Side Camera",   labelAr: "كاميرا جانبية",    icon: "🎥", distRange: [80, 120] },
};

// ── Sound helpers ─────────────────────────────────────────────────
let _lastBeepMs = 0;
const BEEP_COOLDOWN = 45000;

export function playBeep(muted = false) {
  if (muted) return;
  const now = Date.now();
  if (now - _lastBeepMs < BEEP_COOLDOWN) return;
  _lastBeepMs = now;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [[440, 0, 0.08], [360, 0.3, 0.26]].forEach(([freq, delay, stop]) => {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.frequency.value = freq; osc.type = "sine";
      gain.gain.setValueAtTime(0, ac.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.14, ac.currentTime + delay + 0.06);
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + delay + stop);
      osc.start(ac.currentTime + delay); osc.stop(ac.currentTime + delay + stop + 0.05);
    });
  } catch {}
}

export function sendDesktopNotif(msg, score) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const icon = score < 50 ? "🔴" : score < 70 ? "🟡" : "🟢";
  new Notification("PostureAI Pro", { body: `${icon} ${msg}`, icon: "/icon-192.png", tag: "postureai-alert" });
}
