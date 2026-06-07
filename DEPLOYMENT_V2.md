# PostureAI Pro — Production Deployment Guide v2

## Architecture Overview

```
Browser/App
    │
    ▼
Vercel (Frontend · React · Vite)
    │
    ▼ HTTPS API calls
Railway (Backend · Flask · Gunicorn · 4 workers)
    │                    │
    ├──────────────────► Redis (Railway addon)
    │                         ↑ Celery tasks
    ├──────────────────► Supabase PostgreSQL
    │                    (users, sessions, billing, audit)
    │
    ├──────────────────► Firebase Auth + Firestore
    │                    (real-time auth, legacy data)
    │
    ├──────────────────► Stripe (billing)
    ├──────────────────► PayMob (MENA payments)
    ├──────────────────► Resend (email)
    ├──────────────────► Gemini AI (posture narratives)
    ├──────────────────► Sentry (error monitoring)
    └──────────────────► PostHog (analytics)
```

---

## Phase 1 — Database Setup (Supabase)

### 1.1 Create Supabase project
1. Go to https://supabase.com → New project
2. Name: `postureai-prod`, Region: `Middle East (Bahrain)` or `EU West`
3. Generate a strong database password — save it

### 1.2 Run schema
1. Go to SQL Editor in Supabase dashboard
2. Paste contents of `backend/models/schema.sql`
3. Click Run

### 1.3 Copy credentials
From Project Settings → API:
- `SUPABASE_URL` → `https://xxx.supabase.co`
- `SUPABASE_ANON_KEY` → `eyJhb...`
- `SUPABASE_SERVICE_ROLE_KEY` → `eyJhb...` (keep secret!)

---

## Phase 2 — Firebase Setup

### 2.1 Project (if not already set up)
1. https://console.firebase.google.com → Add project: `postureai-prod`
2. Enable Google Analytics (optional)

### 2.2 Authentication
1. Authentication → Sign-in method
2. Enable: Email/Password, Google

### 2.3 Firestore
1. Firestore Database → Create database → Production mode
2. Deploy rules: `firebase deploy --only firestore:rules`

### 2.4 Service Account (backend)
1. Project Settings → Service Accounts
2. Generate new private key → download JSON
3. Minify to one line: `python3 -c "import json,sys; print(json.dumps(json.load(open(sys.argv[1]))))" serviceAccount.json`
4. Set as `FIREBASE_SERVICE_ACCOUNT_JSON` env var

---

## Phase 3 — Stripe Setup

### 3.1 Create products
1. https://dashboard.stripe.com → Products → Add product
2. Create:
   - **Professional** — $9/month recurring + $7/month yearly plan
   - **Business** — $19/month recurring + $15/month yearly plan
3. Copy all 4 price IDs

### 3.2 Webhook
1. Developers → Webhooks → Add endpoint
2. URL: `https://your-backend.railway.app/api/stripe/webhook`
3. Events to listen:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`
4. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### 3.3 Test webhooks locally
```bash
stripe listen --forward-to localhost:5050/api/stripe/webhook
```

---

## Phase 4 — Email Setup (Resend)

### 4.1 Account & Domain
1. https://resend.com → Sign up
2. Domains → Add domain: `postureai.io`
3. Add DNS records (SPF, DKIM, DMARC) to your domain registrar
4. Wait for verification (usually <1 hour)

### 4.2 API Key
1. API Keys → Create API key
2. Permission: Sending access
3. Copy → `RESEND_API_KEY`

---

## Phase 5 — Backend Deployment (Railway)

### 5.1 New project
1. https://railway.app → New Project → Deploy from GitHub repo
2. Select your repo → set root to `/backend`

### 5.2 Add Redis
1. New → Database → Add Redis
2. Copy `REDIS_URL` from Redis Variables tab

### 5.3 Environment variables
Copy ALL backend variables from `.env.production.template` into Railway Variables tab.
**Critical variables:**
- `FLASK_ENV=production`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `SECRET_KEY` (generate: `python3 -c "import secrets; print(secrets.token_hex(32))"`)

### 5.4 Deploy settings
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn --config gunicorn.conf.py app:app`
- Port: `5050`

### 5.5 Verify deployment
```bash
curl https://your-backend.railway.app/api/health
# Expected: {"status":"ok","version":"...","firebase":true,"redis":true}
```

---

## Phase 6 — Frontend Deployment (Vercel)

### 6.1 Import project
1. https://vercel.com → Add New → Project
2. Import GitHub repo
3. Root directory: `frontend`
4. Framework: Vite

### 6.2 Environment variables
Add all `VITE_` variables from template.

### 6.3 vercel.json
Already included in `frontend/vercel.json`:
```json
{
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

### 6.4 Custom domain
1. Vercel → Project Settings → Domains
2. Add `postureai.io` and `www.postureai.io`
3. Update DNS at your registrar

---

## Phase 7 — Monitoring Setup

### 7.1 Sentry
1. https://sentry.io → Create React project → Copy DSN → `VITE_SENTRY_DSN`
2. Create Python/Flask project → Copy DSN → `SENTRY_DSN`

### 7.2 PostHog
1. https://app.posthog.com → Create project
2. Copy API key → `VITE_POSTHOG_KEY`

---

## Phase 8 — CI/CD (GitHub Actions)

### 8.1 Add secrets to GitHub repo
Settings → Secrets and variables → Actions → Add:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_API_URL
VITE_STRIPE_PUBLIC_KEY
VITE_SENTRY_DSN
VITE_POSTHOG_KEY
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
RAILWAY_TOKEN
BACKEND_URL
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_ID
SUPABASE_DB_URL
SLACK_WEBHOOK_URL
```

### 8.2 Copy workflow
```bash
cp infrastructure/docker/deploy.yml .github/workflows/deploy.yml
```

---

## Phase 9 — Production Checks

### Security checklist
- [ ] `FLASK_ENV=production` in backend
- [ ] No debug mode in production
- [ ] All secrets in env vars, not code
- [ ] Stripe webhook signature verified
- [ ] PayMob HMAC verified
- [ ] Firebase auth required on all protected routes
- [ ] Rate limiting active
- [ ] CORS restricted to allowed origins
- [ ] Sentry active
- [ ] Admin endpoints require `is_admin=true`

### Performance checklist
- [ ] Vite build minified and tree-shaken
- [ ] Images optimized (WebP where possible)
- [ ] Lazy loading for heavy components (MediaPipe)
- [ ] Redis caching active for repeated queries
- [ ] Gunicorn 4 workers (set `WORKERS` env var)
- [ ] Nginx gzip enabled

### After deploy
```bash
# Test auth
curl -X POST https://api.postureai.io/api/health

# Test Stripe webhook
stripe trigger checkout.session.completed

# Run smoke tests
cd e2e && npx playwright test tests/01-landing.spec.ts
```

---

## Rollback procedure

```bash
# Railway: rollback to previous deploy
railway up --service postureai-backend --detach --rollback

# Vercel: rollback via CLI or dashboard
vercel rollback
```

---

## Cost estimate (production)

| Service | Plan | Monthly cost |
|---------|------|-------------|
| Vercel | Pro | $20 |
| Railway | Hobby+ | $10-30 |
| Supabase | Pro | $25 |
| Redis (Railway) | — | $5-10 |
| Resend | Pro | $20 |
| Sentry | Team | $26 |
| PostHog | Scale | $0 (free tier) |
| **Total** | | **~$106-131/mo** |

Break-even: ~13 Professional plan customers ($9/mo each).
