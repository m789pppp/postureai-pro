import React from "react";
/**
 * Corvus — Observability & Advanced Detection
 * 1. Sentry error monitoring (frontend)
 * 2. RSI / Wrist / Elbow detection
 * 3. Multi-person detection (MediaPipe Holistic multi-pose)
 */

// ══════════════════════════════════════════════════════════════════
// SENTRY MONITORING
// ══════════════════════════════════════════════════════════════════
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "";

export async function initSentry() {
  if (!SENTRY_DSN) return;
  try {
    // Dynamic import to keep bundle small
    const Sentry = await import("https://browser.sentry-cdn.com/7.99.0/bundle.min.js").catch(() => null);
    if (!Sentry) return;
    Sentry.init({
      dsn:         SENTRY_DSN,
      environment: import.meta.env.MODE || "production",
      release:     `corvus@${import.meta.env.VITE_APP_VERSION || "27.0.0"}`,
      tracesSampleRate: 0.1,
      beforeSend(event) {
        // Strip PII
        if (event.user) { delete event.user.email; delete event.user.ip_address; }
        return event;
      },
      integrations: [],
    });
    window.__sentry = Sentry;
    console.log("✅ Sentry initialized");
  } catch {}
}

export function captureError(err, context = {}) {
  if (window.__sentry) {
    window.__sentry.withScope(scope => {
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
      window.__sentry.captureException(err);
    });
  } else {
    console.error("[Corvus Error]", err, context);
  }
}

export function captureMessage(msg, level = "info") {
  if (window.__sentry) window.__sentry.captureMessage(msg, level);
}

// ══════════════════════════════════════════════════════════════════
// RSI / WRIST / ELBOW DETECTION
// ══════════════════════════════════════════════════════════════════
const LM = {
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW:    13, R_ELBOW:    14,
  L_WRIST:    15, R_WRIST:    16,
  L_PINKY:    17, R_PINKY:    18,
  L_INDEX:    19, R_INDEX:    20,
  L_THUMB:    21, R_THUMB:    22,
};

function angle3pt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const n1 = Math.sqrt(v1.x**2 + v1.y**2);
  const n2 = Math.sqrt(v2.x**2 + v2.y**2);
  if (n1 < 0.001 || n2 < 0.001) return 90;
  const cos = (v1.x*v2.x + v1.y*v2.y) / (n1 * n2);
  return Math.round(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI);
}

function dist(a, b) {
  return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
}

/**
 * analyzeRSI — compute wrist, elbow, arm elevation from pose landmarks
 * @param {Array} lms — MediaPipe pose landmarks (normalized 0-1)
 * @returns {Object} RSI analysis
 */
export function analyzeRSI(lms) {
  if (!lms || lms.length < 23) return null;

  const get = idx => lms[idx];
  const visOk = idx => (lms[idx]?.visibility || 0) > 0.5;

  // Wrist deviation angles
  let wristL = null, wristR = null;
  if (visOk(LM.L_ELBOW) && visOk(LM.L_WRIST) && visOk(LM.L_INDEX)) {
    wristL = angle3pt(get(LM.L_ELBOW), get(LM.L_WRIST), get(LM.L_INDEX));
  }
  if (visOk(LM.R_ELBOW) && visOk(LM.R_WRIST) && visOk(LM.R_INDEX)) {
    wristR = angle3pt(get(LM.R_ELBOW), get(LM.R_WRIST), get(LM.R_INDEX));
  }
  const wristAngle = wristL !== null && wristR !== null
    ? Math.round((wristL + wristR) / 2)
    : (wristL ?? wristR ?? null);

  // Elbow angles (shoulder-elbow-wrist)
  let elbowL = null, elbowR = null;
  if (visOk(LM.L_SHOULDER) && visOk(LM.L_ELBOW) && visOk(LM.L_WRIST)) {
    elbowL = angle3pt(get(LM.L_SHOULDER), get(LM.L_ELBOW), get(LM.L_WRIST));
  }
  if (visOk(LM.R_SHOULDER) && visOk(LM.R_ELBOW) && visOk(LM.R_WRIST)) {
    elbowR = angle3pt(get(LM.R_SHOULDER), get(LM.R_ELBOW), get(LM.R_WRIST));
  }

  // Arm elevation (how high are hands relative to elbows)
  let armElevation = 0;
  if (visOk(LM.L_WRIST) && visOk(LM.L_ELBOW)) {
    const elevL = (get(LM.L_ELBOW).y - get(LM.L_WRIST).y); // positive = hand higher than elbow
    const elevR = visOk(LM.R_WRIST) ? (get(LM.R_ELBOW).y - get(LM.R_WRIST).y) : elevL;
    armElevation = Math.round(((elevL + elevR) / 2) * 100);
  }

  // RSI Risk Score
  let rsiRisk = 0;
  const alerts = [];

  if (wristAngle !== null) {
    if (wristAngle > 25) {
      rsiRisk += 40;
      alerts.push(`⚠️ Wrist deviation ${wristAngle}° — high Carpal Tunnel risk. Keep wrists straight.`);
    } else if (wristAngle > 15) {
      rsiRisk += 20;
      alerts.push(`Wrist angle ${wristAngle}° — moderate deviation. Try neutral wrist position.`);
    }
  }
  if (elbowL !== null) {
    if (elbowL < 70 || elbowL > 135) {
      rsiRisk += 20;
      alerts.push(`Elbow angle ${elbowL}° (ideal 90-120°) — adjust desk/chair height.`);
    }
  }
  if (armElevation > 10) {
    rsiRisk += 25;
    alerts.push(`Arms elevated ${armElevation} units — lower keyboard/mouse. Shoulder strain risk.`);
  } else if (armElevation < -10) {
    rsiRisk += 15;
    alerts.push(`Hands below elbow level — raise desk or keyboard tray.`);
  }

  const rsiScore = Math.max(0, 100 - rsiRisk);
  const rsiLevel = rsiScore >= 75 ? "low" : rsiScore >= 50 ? "medium" : "high";

  return {
    wrist_angle:    wristAngle,
    elbow_angle_l:  elbowL,
    elbow_angle_r:  elbowR,
    arm_elevation:  armElevation,
    rsi_score:      rsiScore,
    rsi_risk_level: rsiLevel,
    alerts,
    compliance_notes: rsiLevel === "high"
      ? "OSHA ergonomic intervention recommended — employee at high RSI risk."
      : rsiLevel === "medium"
        ? "Monitor wrist and elbow positioning. Consider ergonomic keyboard/mouse."
        : "RSI risk within acceptable range.",
  };
}

// ── RSI Display Widget ────────────────────────────────────────────
export function RSIWidget({ rsiData, cs, lang = "en" }) {
  if (!rsiData) return null;
  const DARK  = cs || { border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b" };
  const col   = rsiData.rsi_score >= 75 ? "#10b981" : rsiData.rsi_score >= 50 ? "#f59e0b" : "#ef4444";
  const isAr  = lang === "ar";

  return (
    <div style={{ background: `${col}0a`, border: `0.5px solid ${col}30`, borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: DARK.text }}>
          🖐 {isAr ? "خطر RSI والمعصم" : "RSI & Wrist Risk"}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: col }}>{rsiData.rsi_score}/100</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: rsiData.alerts.length ? 8 : 0 }}>
        {[
          [isAr ? "زاوية المعصم" : "Wrist angle", rsiData.wrist_angle, "°"],
          [isAr ? "كوع يسار" : "Left elbow",  rsiData.elbow_angle_l, "°"],
          [isAr ? "رفع الذراع" : "Arm elev.",  rsiData.arm_elevation, ""],
        ].map(([label, val, unit]) => (
          <div key={label} style={{ textAlign: "center", padding: "5px 4px", background: "rgba(148,163,184,.05)", borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: DARK.text }}>{val !== null ? `${val}${unit}` : "—"}</div>
            <div style={{ fontSize: 8, color: DARK.muted }}>{label}</div>
          </div>
        ))}
      </div>
      {rsiData.alerts.slice(0, 2).map((a, i) => (
        <div key={i} style={{ fontSize: 10, color: DARK.muted, padding: "4px 8px", background: "rgba(148,163,184,.04)", borderRadius: 5, marginBottom: 3, lineHeight: 1.5 }}>
          {a}
        </div>
      ))}
      <div style={{ fontSize: 9, color: DARK.muted, marginTop: 6, fontStyle: "italic" }}>{rsiData.compliance_notes}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MULTI-PERSON DETECTION
// ══════════════════════════════════════════════════════════════════

// Kalman filter for smooth tracking
class KalmanFilter1D {
  constructor(R = 0.01, Q = 3) {
    this.R = R; this.Q = Q; this.P = 1; this.x = 0; this.k = 0;
  }
  update(z) {
    this.P += this.Q;
    this.k  = this.P / (this.P + this.R);
    this.x += this.k * (z - this.x);
    this.P *= (1 - this.k);
    return this.x;
  }
}

const _personTracks = new Map(); // trackId -> { bbox, kalman, lastSeen, score }
let _nextId = 1;

function iou(a, b) {
  const ix1 = Math.max(a.x, b.x), iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x+a.w, b.x+b.w), iy2 = Math.min(a.y+a.h, b.y+b.h);
  if (ix2 <= ix1 || iy2 <= iy1) return 0;
  const inter = (ix2-ix1)*(iy2-iy1);
  return inter / ((a.w*a.h + b.w*b.h) - inter);
}

/**
 * processMultiPerson — simple IoU-based tracking for multiple people
 * @param {Array} detections — [{bbox: {x,y,w,h}, score, landmarks}]
 * @returns {Array} tracked persons with stable IDs
 */
export function processMultiPerson(detections) {
  const now = Date.now();
  const MAX_AGE_MS = 2000;

  // Remove stale tracks
  for (const [id, track] of _personTracks) {
    if (now - track.lastSeen > MAX_AGE_MS) _personTracks.delete(id);
  }

  const assigned = new Set();
  const result   = [];

  for (const det of detections) {
    let bestId  = null;
    let bestIoU = 0.3; // min IoU threshold

    for (const [id, track] of _personTracks) {
      if (assigned.has(id)) continue;
      const overlap = iou(det.bbox, track.bbox);
      if (overlap > bestIoU) { bestIoU = overlap; bestId = id; }
    }

    if (bestId !== null) {
      // Update existing track
      const track = _personTracks.get(bestId);
      track.bbox     = det.bbox;
      track.lastSeen = now;
      track.score    = det.score;
      track.landmarks= det.landmarks;
      assigned.add(bestId);
      result.push({ id: bestId, ...track });
    } else {
      // New person
      const id = _nextId++;
      const track = {
        bbox:      det.bbox,
        lastSeen:  now,
        score:     det.score,
        landmarks: det.landmarks,
        kalman:    { x: new KalmanFilter1D(), y: new KalmanFilter1D() },
        firstSeen: now,
      };
      _personTracks.set(id, track);
      result.push({ id, ...track });
    }
  }

  return result;
}

/**
 * MultiPersonOverlay — draw bounding boxes + scores on canvas
 */
export function drawMultiPersonOverlay(canvas, persons, w, h) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const COLORS = ["#10b981","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#0891b2"];

  persons.forEach((person, i) => {
    const col   = COLORS[i % COLORS.length];
    const { x, y, w: bw, h: bh } = person.bbox;
    const px = x * w, py = y * h, pw = bw * w, ph = bh * h;

    // Bounding box
    ctx.strokeStyle = col;
    ctx.lineWidth   = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(px, py, pw, ph);

    // Label background
    const label = `P${person.id} — ${person.score}/100`;
    ctx.font     = "bold 11px system-ui";
    const tw     = ctx.measureText(label).width + 12;
    ctx.fillStyle= col;
    ctx.fillRect(px, py - 20, tw, 18);

    // Label text
    ctx.fillStyle = "white";
    ctx.fillText(label, px + 6, py - 6);

    // Corner accents
    const cl = 12;
    ctx.lineWidth = 3;
    [
      [px,    py,    cl, 0,  0,  cl ],
      [px+pw, py,   -cl, 0,  0,  cl ],
      [px,    py+ph,  cl, 0,  0, -cl],
      [px+pw, py+ph, -cl, 0,  0, -cl],
    ].forEach(([sx, sy, dx1, dy1, dx2, dy2]) => {
      ctx.beginPath();
      ctx.moveTo(sx+dx1, sy+dy1);
      ctx.lineTo(sx, sy);
      ctx.lineTo(sx+dx2, sy+dy2);
      ctx.stroke();
    });
  });
}

// ── Multi-Person Dashboard Widget ────────────────────────────────
export function MultiPersonWidget({ persons, cs, lang = "en" }) {
  const DARK = cs || { border: "rgba(148,163,184,.1)", text: "#f0f4f8", muted: "#64748b" };
  const isAr = lang === "ar";
  const COLORS = ["#10b981","#3b82f6","#f59e0b","#8b5cf6","#ef4444","#0891b2"];

  if (!persons || persons.length === 0) return null;

  const avgScore = persons.length ? Math.round(persons.reduce((a, p) => a + (p.score||0), 0) / persons.length) : 0;
  const sc = v => v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ background: "rgba(148,163,184,.04)", border: `0.5px solid ${DARK.border}`, borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: DARK.text }}>
          👥 {isAr ? `${persons.length} أشخاص` : `${persons.length} people`}
        </div>
        <div style={{ fontSize: 11, color: sc(avgScore) }}>{isAr ? "متوسط:" : "Avg:"} {avgScore}/100</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {persons.map((p, i) => (
          <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: DARK.muted, flex: 1 }}>
              {isAr ? `شخص` : "Person"} {p.id}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: sc(p.score || 0) }}>{p.score || "—"}</div>
            <div style={{ width: 50, height: 4, background: "rgba(148,163,184,.1)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${p.score || 0}%`, background: sc(p.score || 0), borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
