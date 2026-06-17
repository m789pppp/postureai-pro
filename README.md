# Corvus — v50 MERGED (Billing + Onboarding)

## 🚀 What's in this version?

This is the **ultimate merged version** combining:
- **v43 Billing** — BillingDashboard, DesignSystem, complete payment flows, advanced backend
- **v12 Onboarding** — OnboardingWizard, AI layer (AIInsights, AIReports, PredictiveAI), WorkforceAnalytics, EnterpriseRBAC, NotificationsHub, EmailTemplates, UI interactions/states

---

## 📦 New Files Added (from Onboarding)

| File | Description |
|------|-------------|
| `OnboardingWizard.jsx` | Multi-step wizard for new users — collects name, type, goals |
| `AIInsights.jsx` | Real-time AI-powered posture insights panel |
| `AIReports.jsx` | AI-generated health reports with recommendations |
| `PredictiveAI.jsx` | Predictive posture risk modeling |
| `WorkforceAnalytics.jsx` | Workforce-level posture analytics for HR/enterprise |
| `EnterpriseRBAC.jsx` | Role-based access control for enterprise orgs |
| `NotificationsHub.jsx` | Centralized notifications center |
| `EmailTemplates.jsx` | Email template editor |
| `ui/interactions.jsx` | Reusable interaction components |
| `ui/states.jsx` | Loading/error/empty state components |

## 💳 Kept from Billing (v43)

| File | Description |
|------|-------------|
| `BillingDashboard.jsx` | Full billing management dashboard |
| `DesignSystem.js` | Design tokens and system constants |
| `AnalyticsDashboard.jsx` | Advanced analytics (808 lines vs 315) |
| `LandingPage.jsx` | Richer landing page (1505 lines vs 1378) |
| `HomeScreen.jsx` | Full home screen (766 lines vs 369) |
| `AdminDashboard.jsx` | Admin panel (1107 lines vs 1055) |
| `backend.py` | More complete backend (5382 lines vs 4505) |

---

## 🛠️ Quick Start

```bash
# Frontend
cd frontend
npm install
cp .env.local.example .env.local  # fill in your keys
npm run dev

# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # fill in your keys
python backend.py
```

## 🏗️ Deploy

- **Frontend**: Vercel (vercel.json included)
- **Backend**: Railway (railway.json + Dockerfile included)
- **DB**: Firebase Firestore (firestore.rules included)
- **Cache**: Redis (redis_service.py included)

## ✅ Features

- 📷 Real-time posture analysis (front + side camera)
- 🤖 AI coaching + Gemini AI narrative
- 🧠 AIInsights, PredictiveAI, AIReports
- 💳 Billing + Stripe/PayMob payment flows
- 📊 Analytics dashboard + Workforce analytics
- 🏢 Enterprise: RBAC, SSO, HR panel, team invite
- 🔔 Notifications hub
- 🎮 Gamification + achievements
- 🌍 Arabic/English i18n
- 📱 PWA support
- 🔐 Firebase Auth + Firestore
