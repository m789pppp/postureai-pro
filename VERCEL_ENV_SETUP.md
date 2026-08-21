# Vercel Environment Variables — Required Setup

Go to: https://vercel.com/dashboard → postureai-pro → Settings → Environment Variables

## 🔴 CRITICAL (site won't work without these)

### Firebase Frontend (all VITE_ prefixed)
| Variable | Where to get it |
|----------|----------------|
| VITE_FIREBASE_API_KEY | Firebase Console → Project Settings → General → Web API Key |
| VITE_FIREBASE_AUTH_DOMAIN | `postureai-prod.firebaseapp.com` |
| VITE_FIREBASE_PROJECT_ID | `postureai-prod` |
| VITE_FIREBASE_STORAGE_BUCKET | `postureai-prod.appspot.com` |
| VITE_FIREBASE_MESSAGING_SENDER_ID | Firebase Console → Project Settings → Cloud Messaging |
| VITE_FIREBASE_APP_ID | Firebase Console → Project Settings → General → App ID |

### Firebase Admin (for serverless functions)
| Variable | Value |
|----------|-------|
| FIREBASE_PROJECT_ID | `postureai-prod` |
| FIREBASE_CLIENT_EMAIL | `firebase-adminsdk-fbsvc@postureai-prod.iam.gserviceaccount.com` |
| FIREBASE_PRIVATE_KEY | The private_key from the JSON file (include -----BEGIN/END PRIVATE KEY----- and \n) |

## 🟠 PAYMENT (required to accept payments)

| Variable | Where to get it |
|----------|----------------|
| KASHIER_MERCHANT_ID | Kashier Dashboard → Account |
| KASHIER_API_KEY | Kashier Dashboard → API Keys |
| KASHIER_MODE | `live` or `test` |
| VITE_KASHIER_MERCHANT_ID | Same as KASHIER_MERCHANT_ID |

## 🟡 OPTIONAL (features degrade gracefully without these)

| Variable | Purpose |
|----------|---------|
| TWILIO_ACCOUNT_SID | SMS MFA (without it: demo mode returns OTP in response) |
| TWILIO_AUTH_TOKEN | SMS MFA |
| TWILIO_PHONE_NUMBER | SMS MFA sender number |
| VITE_STRIPE_PUBLIC_KEY | Stripe payments (shows "Coming Soon" if absent) |
| VITE_APP_URL | `https://postureai-pro-omega-nine.vercel.app` |
| VITE_SUPPORT_EMAIL | `support@corvus.io` |
| VITE_AUTO_APPROVE_DOMAIN | `tkh.edu.eg` — auto-elite for this domain |

## How to set FIREBASE_PRIVATE_KEY in Vercel
The private key has \n characters. In Vercel:
1. Copy the entire private_key value from the JSON
2. Paste it AS-IS (Vercel handles the \n correctly)
OR:
1. In the Value field, paste the key with actual newlines (not \n)

## 📧 EMAIL (Resend — required for invoice/welcome/weekly emails)

| Variable | Where to get it |
|----------|----------------|
| RESEND_API_KEY | [resend.com](https://resend.com) → API Keys → Create API Key (free: 3000/mo) |
| EMAIL_FROM | `Corvus PostureAI <noreply@yourdomain.com>` — must match your Resend verified domain |

## 🔔 WEB PUSH (Firebase Cloud Messaging)

| Variable | Where to get it |
|----------|----------------|
| VITE_FIREBASE_VAPID_KEY | Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair |

## 🐍 PYTHON BACKEND (backend/backend.py, now deployed as a Vercel Function)

The Flask backend that powers AI Coach/Insights/Predictive/Reports,
posture analysis, symptom log, gamification, and everything else under
`/api/*` not already covered by the smaller `api/*.js` functions now
deploys as **one Vercel Python Function** (see `main.py` + `pyproject.toml`
at the repo root, and the `/api/(.*)` route in `vercel.json`). It used to
run on a separate Railway service — that's gone; everything is on Vercel
now.

### 🔴 REQUIRED — won't start without this
| Variable | Where to get it |
|----------|----------------|
| SECRET_KEY | Any long random string (`openssl rand -hex 32`) |
| FLASK_ENV | Set to `production` |
| REDIS_URL | **Required in production** — the app refuses to start without it (shared rate limiting across function instances needs it). Easiest: Vercel Dashboard → Storage → Marketplace → add **Upstash Redis** → copy its `redis://`/`rediss://` connection string (not the REST URL) into `REDIS_URL`. |

### 🟠 AI quality (Coach/Insights/Predictive/Reports) — free, strongly recommended
| Variable | Where to get it |
|----------|----------------|
| GEMINI_API_KEY | [aistudio.google.com](https://aistudio.google.com) → "Get API key" → Create API key. Free tier, no cost. This is now the primary AI provider for every AI feature. |
| GROQ_API_KEY | [console.groq.com](https://console.groq.com) → API Keys → Create API Key. Free tier, used as the fast fallback if Gemini is rate-limited/down. |

Without either set, AI features fall back to a much lower-quality local
rule-based response instead of a real model — not broken, just worse.

### ⚙️ One-time project setting (not an env var — Project Settings toggle)
The Python function's deployed size (~1GB, mostly MediaPipe/OpenCV/their
dependencies) is over Vercel's standard 500MB Python limit, so:
1. Vercel Dashboard → your project → Settings → Environment Variables
2. Add `VERCEL_SUPPORT_LARGE_FUNCTIONS` = `1` (enables the "Large
   Functions" beta, up to 5GB — free, officially supported, just not GA yet)

### 🟡 Same optional vars as before
FIREBASE_SERVICE_ACCOUNT_JSON (or the FIREBASE_PROJECT_ID/CLIENT_EMAIL/
PRIVATE_KEY trio above — the Python backend accepts either), STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET, PAYMOB_*, SENDGRID_API_KEY/SUPPORT_EMAIL, and anything
else already listed in `backend/.env.example` — all optional, each feature
degrades gracefully without its specific key rather than crashing the app.

## 🏁 AFTER DEPLOYMENT — Run Once

Seed the feature flags collection (run from browser console after login as admin):
```javascript
const tok = await firebase.auth().currentUser.getIdToken();
fetch("/api/admin/seed-flags", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
  body: JSON.stringify({ force: false })
}).then(r => r.json()).then(console.log);
```
