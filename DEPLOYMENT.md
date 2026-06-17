# Corvus — Production Deployment Guide

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vercel        │    │   Railway       │    │   Firebase      │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│   (Firestore)   │
│   React/Vite    │    │   Flask/Gunicorn│    │   Auth + DB     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
     ┌────────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
     │  Celery Worker│ │ Celery Beat │ │   Redis    │
     │  (analysis,   │ │ (scheduled  │ │  (cache,   │
     │   email,      │ │  email jobs)│ │  sessions) │
     │   webhooks)   │ └─────────────┘ └────────────┘
     └───────────────┘
```

## Railway Setup (3 services)

### 1. Web Service (required)
```
Build: NIXPACKS
Start: gunicorn --config gunicorn.conf.py "backend:app"
Health: /api/health
```

### 2. Worker Service (recommended for production)
```
Build: NIXPACKS (same repo)
Start: celery -A services.celery_app worker --concurrency=2 --loglevel=info --queues=analysis,email,webhooks
Env: CELERY_ENABLED=true
```

### 3. Beat Service (for scheduled emails)
```
Build: NIXPACKS (same repo)
Start: celery -A services.celery_app beat --loglevel=info
```

## Required Environment Variables

```bash
# Core
FLASK_ENV=production
FLASK_SECRET_KEY=<32-char random>

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Redis (Railway Redis plugin)
REDIS_URL=redis://...

# AI
GEMINI_API_KEY=AIza...

# Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYMOB_API_KEY=...
PAYMOB_HMAC_SECRET=...

# Email
SENDGRID_API_KEY=SG...
EMAIL_FROM=noreply@corvus.com

# Security
RESULT_SIGNING_SECRET=<32-char random>
CORS_ORIGINS=https://app.corvus.com,https://corvus.com

# Feature flags
CELERY_ENABLED=true
SOCKETIO_ENABLED=false  # enable when flask-socketio is deployed
```

## Vercel Setup (Frontend)

```bash
# Build settings
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm ci

# Environment variables
VITE_BACKEND_URL=https://api.corvus.com
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_POSTHOG_KEY=phc_...   # optional
```

## Cloudflare Setup

1. Point domain to Vercel (frontend) and Railway (API)
2. Import `cloudflare.json` WAF rules
3. Enable Brotli compression
4. Set cache rules for /assets/* (1 year browser cache)

## Database Indexes

Deploy Firestore indexes:
```bash
firebase deploy --only firestore:indexes
```

## First Deploy Checklist

- [ ] Firebase project created + service account JSON exported
- [ ] Railway: web + worker + beat services configured
- [ ] Vercel: frontend deployed with env vars
- [ ] Cloudflare: DNS + WAF rules configured
- [ ] SendGrid: domain verified + API key set
- [ ] Stripe: webhooks endpoint registered (`/api/stripe/webhook`)
- [ ] PayMob: webhook URL registered
- [ ] Redis: Railway plugin added + REDIS_URL set
- [ ] `RESULT_SIGNING_SECRET` generated and set
- [ ] `FLASK_SECRET_KEY` generated and set
- [ ] `firestore.rules` deployed: `firebase deploy --only firestore:rules`
- [ ] `firestore.indexes.json` deployed: `firebase deploy --only firestore:indexes`
