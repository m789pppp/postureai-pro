# Posmoz

Posture-analysis SaaS for MENA. Pre-launch. On-device MediaPipe, Firebase, Vercel. Pushes to `main` deploy to production: work on a branch and open a PR.

## Where things are
- `frontend/src/App.jsx`: main app, about 9,400 lines
- `frontend/src/LandingPageV7.jsx`, `HomePage.jsx`: marketing pages
- `frontend/src/features/analysis/postureEngine.js`: scoring engine
- `frontend/src/features/analysis/clinicalMeasure.js`: clinical measurements
- `frontend/src/lib/`: i18n, PDF reports, Arabic shaper, claims and consent
- `api/*.js`, `api/_handlers/`: Vercel functions
- `backend/backend.py`: Flask backend, about 20,000 lines
- `validation/`, `VALIDATION_PROTOCOL.md`: real-person validation
- Launch status: `GO_LIVE_READINESS.md`, `LAUNCH_CHECKLIST.md`

## Reading large files
Never read `backend/backend.py`, `App.jsx`, `pdfReports.js`, `HomePage.jsx`, or `postureEngine.js` whole. Locate first, then read only that line range:
- `rg -n '^def |^@app.route' backend/backend.py`
- `rg -n '^(export )?(default )?(async )?function [A-Z]' frontend/src/App.jsx`
- `rg -n 'name_you_need' <file>`

## Commands
Run from `frontend/`:
- `npm run build`
- `npm run test:posture`: engine and accuracy
- `npm run test:measure`, `npm run test:clinical`, `npm run test:findings`
- `npm run test:claims`: run after changing any user-facing text
- `npm run test:validation`

Run from the repo root: `npm run test:guard`

## Rules
- Reply in Arabic when the user writes in Arabic.
- Do not change the MediaPipe version or pose model without being asked; validation results depend on them.
- Engine accuracy figures come from a synthetic subject until validated on real people. Never add accuracy percentages, diagnosis wording, or "clinically proven" claims.
- Arabic UI: no `letter-spacing`, use logical CSS properties, isolate numbers and Latin text.
- Do not add a dependency when existing code covers the need.
- Do not guess APIs, flags, or package names; check the code or docs.
- A change is finished only after the relevant command above passes.
