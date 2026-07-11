# Posmoz PostureAI Pro — Product Compliance & Intended Use

> **Audience:** enterprise procurement, legal review, HR/EHS teams, and anyone
> writing marketing or sales copy for this product.
> **Status:** living document — update whenever claims, models, or thresholds change.

---

## 1. Intended Use Statement

Posmoz PostureAI Pro is a **wellness and workplace-ergonomics product**. It uses
camera-based pose estimation to provide **screening-grade** posture monitoring,
trend analytics, and ergonomic guidance for desk-based work.

Posmoz is **NOT a medical device**. It does **not** diagnose, treat, cure,
mitigate, or prevent any disease or medical condition, and its output must never
be presented as a medical diagnosis or a basis for treatment decisions.

This positioning is embedded in the product itself:

| Where | What |
|---|---|
| Engine output | Every analysis result carries `measurement_grade: "screening"` (`MEASUREMENT_DISCLOSURE` in `frontend/src/features/analysis/postureEngine.js`) |
| Session/Elite PDF | Footer: "Not a medical diagnosis"; risk map: "not a medical diagnosis" |
| Clinical PDF | Full screening-grade disclaimer block + "For Clinical Review — Not for Diagnostic Purposes" header |
| Shared report pages | "Not a medical diagnosis" on zone map and footer |
| Terms of Service | `LegalCompliance.jsx` §2: "The Service is not a medical device and does not provide medical advice." |

## 2. Measurement Grade — what the technology can and cannot do

**Basis:** MediaPipe Pose estimates 33 body landmarks from a 2D camera image
(with approximate pseudo-3D depth). Absolute joint angles from this method carry
single-digit-degree uncertainty and vary with camera placement, lighting, and
clothing.

**What Posmoz measures reliably (its actual job):**
- Trends and patterns over time (posture creep, slouch cycles, session-to-session change)
- Relative deviations from a user's own baseline
- Sustained-posture events for real-time ergonomic alerts

**What Posmoz is not (and does not claim to be):**
- A replacement for goniometry, radiographic assessment, or physical examination
- A diagnostic instrument of any kind

**Engineering safeguards that keep the numbers honest** (postureEngine v4):
- Unreliable landmarks are *excluded* from scoring, never guessed (confidence-weighted scoring)
- Head rotation > 28° marks depth-based metrics unreliable instead of emitting corrupted values
- Alerts require multi-frame persistence — single-frame artifacts cannot trigger them
- The cervical-load metric interpolates the published Hansraj (2014) table and is clamped
  at the study's validated 60° maximum
- "RULA-lite" is explicitly labelled as a simplified adaptation, not a full RULA assessment

## 3. Scientific References Used

| Feature | Source | How it is used |
|---|---|---|
| Cervical spine load (kg) | Hansraj, K. (2014), *Surgical Technology International* 25:277-9 | Piecewise-linear interpolation of published values (0°=4.5 kg … 60°=27 kg), clamped at 60° |
| RULA-lite ergonomic risk | McAtamney & Corlett (1993), *Applied Ergonomics* 24(2) | Simplified seated-desk subset (neck/trunk/arm bands + twist penalties); labelled "lite" |
| Fatigue accumulation model | Richter et al. (2011) | Informational non-linear fatigue penalty; never reduces the displayed score |
| Elbow range 90–120° | OSHA/NIOSH ergonomic guidance | Ergonomic alert thresholds |
| Viewing distance 50–70 cm, 20-20-20 rule | Standard optometric/ergonomic guidance | Distance scoring and break reminders |

## 4. Marketing Language Guardrails

Regulatory reality: the moment marketing claims the product **diagnoses,
treats, or prevents a medical condition**, it becomes a medical device under
FDA (US), MDR/CE (EU), and SFDA (KSA) rules — a completely different and
far heavier compliance regime. The safe harbor is *general wellness* positioning.

### ✅ Allowed claims (wellness / ergonomics)
- "Monitors your posture and alerts you to slouching"
- "Screening-grade ergonomic risk assessment for desk workers"
- "Tracks posture trends and helps build healthier sitting habits"
- "Reduces ergonomic risk factors associated with desk work"
- "Physiotherapist-ready summary report" (a report a clinician *may review* — the clinician does the clinical work)
- AR: «يراقب وضعية جلوسك وينبهك للانحناء» · «فحص أولي لمخاطر بيئة العمل» · «يتتبع أنماط وضعيتك مع الوقت»

### ❌ Forbidden claims (medical device territory)
- "Diagnoses forward head posture / kyphosis / scoliosis / any condition"
- "Treats/cures/prevents neck pain, back pain, or any disease"
- "Clinically accurate measurements" / "medical-grade accuracy"
- "Replaces a physiotherapist assessment"
- Any specific outcome promise ("eliminates back pain in 30 days")
- AR: «يشخّص»، «يعالج»، «يمنع الإصابة بـ…»، «دقة طبية/سريرية»

### Gray zone — always route through legal
- Pain *prediction* features: keep phrased as "discomfort likelihood based on
  sustained posture patterns", never as a medical prognosis.
- The word "clinical": acceptable only in "for clinical review by a professional",
  never as "clinical measurement/accuracy".

## 5. Data & Privacy posture (summary)

- Video frames are processed locally in the browser (MediaPipe WASM); raw video
  is not uploaded during standard analysis.
- Stored session data: numeric scores, metric values, and timestamps (Firestore).
- Enterprise deployments: see `SECURITY_HARDENING.md` and `firestore.rules`.

## 6. Change control

Any change to the following requires updating this document **and** the in-product
disclaimers in the same PR:
- Scoring thresholds or scientific models (engine `THR`, Hansraj table, RULA bands)
- Any report/PDF wording touching medical claims
- Marketing copy on landing pages that describes what the product "does"
