# 🚀 Corvus — Launch Checklist
> آخر تحديث: $(date +%Y-%m-%d)

---

## 🔴 REQUIRED — مش هيشتغل من غيرهم

### 1️⃣ Firebase (Auth + Database)
**مصدر:** console.firebase.google.com → اختار مشروعك → Project Settings → General

| Variable | وين تلاقيه |
|---|---|
| `VITE_FIREBASE_API_KEY` | Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Default Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging → Sender ID |
| `VITE_FIREBASE_APP_ID` | Your Web App → App ID |

**Firebase Admin (Backend):**
> Firebase Console → Project Settings → **Service Accounts** → Generate New Private Key → حمّل الـ JSON

| Variable | القيمة |
|---|---|
| `FIREBASE_PROJECT_ID` | نفس VITE_FIREBASE_PROJECT_ID |
| `FIREBASE_CLIENT_EMAIL` | `client_email` من الـ JSON |
| `FIREBASE_PRIVATE_KEY` | `private_key` من الـ JSON (كامل مع \n) |

---

### 2️⃣ Stripe (الدفع العالمي)
**مصدر:** dashboard.stripe.com → Developers → API Keys

| Variable | القيمة |
|---|---|
| `VITE_STRIPE_PUBLIC_KEY` | Publishable key يبدأ بـ `pk_live_` |
| `STRIPE_SECRET_KEY` | Secret key يبدأ بـ `sk_live_` |
| `STRIPE_WEBHOOK_SECRET` | Webhooks → endpoint → Signing secret يبدأ بـ `whsec_` |

**إنشاء الـ Products في Stripe:**
1. Stripe Dashboard → Products → Add Product
2. اسم: "Corvus" — Price: $19/month → احفظ الـ price ID
3. اسم: "Corvus Elite" — Price: $49/month → احفظ الـ price ID

| Variable | القيمة |
|---|---|
| `VITE_STRIPE_PRICE_PRO_MONTHLY` | `price_xxxxx` للـ Pro شهري |
| `VITE_STRIPE_PRICE_PRO_YEARLY` | `price_xxxxx` للـ Pro سنوي |
| `VITE_STRIPE_PRICE_ELITE_MONTHLY` | `price_xxxxx` للـ Elite شهري |
| `VITE_STRIPE_PRICE_ELITE_YEARLY` | `price_xxxxx` للـ Elite سنوي |

**Webhook Setup في Stripe:**
1. Stripe → Developers → Webhooks → Add endpoint
2. URL: `https://YOUR-BACKEND.railway.app/api/stripe/webhook`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`

---

### 3️⃣ PayMob (الدفع في مصر)
**مصدر:** accept.paymob.com → Dashboard

| Variable | وين تلاقيه |
|---|---|
| `VITE_PAYMOB_PUBLIC_KEY` | Settings → Account Info → Public Key |
| `VITE_PAYMOB_IFRAME_ID` | Accept → iFrame → رقم الـ iFrame |
| `PAYMOB_SECRET_KEY` | Settings → Account Info → Secret Key |
| `PAYMOB_INTEGRATION_CARD` | Accept → Payment Integrations → Card → ID |
| `PAYMOB_INTEGRATION_WALLET` | Accept → Payment Integrations → Mobile Wallet → ID |
| `PAYMOB_HMAC_SECRET` | Settings → Account Info → HMAC Secret |

---

### 4️⃣ Gemini AI
**مصدر:** aistudio.google.com → Get API Key

| Variable | القيمة |
|---|---|
| `GEMINI_API_KEY` | `AIza...` |

---

### 5️⃣ Email (SendGrid)
**مصدر:** app.sendgrid.com → Settings → API Keys → Create API Key

| Variable | القيمة |
|---|---|
| `SENDGRID_API_KEY` | `SG.xxxxx` |
| `SUPPORT_EMAIL` | البريد المتحقق منه في SendGrid مثال: `support@corvus.io` |

> ⚠️ لازم تتحقق من الـ domain في SendGrid Sender Authentication

---

### 6️⃣ Backend URL
| Variable | القيمة |
|---|---|
| `VITE_API_URL` | `https://YOUR-BACKEND.railway.app/api` |
| `APP_URL` | `https://corvus-omega-nine.vercel.app` |
| `ALLOWED_ORIGINS` | `https://corvus-omega-nine.vercel.app` |
| `FLASK_ENV` | `production` |

---

## 🟡 IMPORTANT — موصى بيهم للإنتاج

| Variable | وين تلاقيه | ليه مهم |
|---|---|---|
| `REDIS_URL` | upstash.com → Create Database → REST URL | Rate limiting + session caching |
| `VITE_SENTRY_DSN` | sentry.io → Project → Settings → DSN | Error tracking في production |
| `SENTRY_DSN` | نفس الـ DSN | Backend error tracking |
| `VITE_POSTHOG_KEY` | app.posthog.com → Project Settings | Analytics + فهم behavior اليوزر |
| `VITE_POSTHOG_HOST` | `https://app.posthog.com` | |
| `VITE_CRISP_WEBSITE_ID` | app.crisp.chat → Settings → Website ID | Live chat support |
| `ADMIN_EMAIL` | بريدك | تلقي notifications |
| `VITE_SUPPORT_EMAIL` | `support@corvus.io` | ظاهر للـ users |
| `VITE_AUTO_APPROVE_DOMAIN` | `corvus.io` | Auto-approve HR from your domain |

---

## 🟢 ENTERPRISE — للشركات الكبيرة

| Variable | وين تلاقيه |
|---|---|
| `VITE_SAML_AZURE_PROVIDER_ID` | Azure AD → App Registrations → Directory (tenant) ID |
| `VITE_SAML_OKTA_PROVIDER_ID` | Okta Admin → Applications → your app → Sign On |
| `SCIM_BEARER_TOKEN` | اعمل random string: `openssl rand -hex 32` |
| `SLACK_WEBHOOK_URL` | Slack → Apps → Incoming Webhooks |
| `TEAMS_WEBHOOK_URL` | MS Teams → Channel → Connectors |
| `WA_ACCESS_TOKEN` | Meta Developers → WhatsApp |
| `WA_PHONE_NUMBER_ID` | Meta Developers → WhatsApp |

---

## ✅ أين تحط الـ Variables

### Vercel (Frontend):
1. vercel.com → Your Project → Settings → **Environment Variables**
2. اضيف كل `VITE_*` variable
3. Environment: **Production** + **Preview**

### Railway (Backend):
1. railway.app → Your Service → **Variables**
2. اضيف كل الـ backend variables
3. Redeploy بعد إضافة أي variable جديد

---

## 🔥 أقل حاجة تشتغل بيها Production

```
# Frontend (Vercel)
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_STRIPE_PUBLIC_KEY
VITE_STRIPE_PRICE_PRO_MONTHLY
VITE_STRIPE_PRICE_PRO_YEARLY
VITE_STRIPE_PRICE_ELITE_MONTHLY
VITE_STRIPE_PRICE_ELITE_YEARLY
VITE_PAYMOB_PUBLIC_KEY
VITE_PAYMOB_IFRAME_ID
VITE_API_URL
VITE_SUPPORT_EMAIL

# Backend (Railway)
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
GEMINI_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
PAYMOB_SECRET_KEY
PAYMOB_INTEGRATION_CARD
PAYMOB_INTEGRATION_WALLET
PAYMOB_HMAC_SECRET
SENDGRID_API_KEY
SUPPORT_EMAIL
APP_URL
ALLOWED_ORIGINS
FLASK_ENV=production
```

---

## 🔍 تحقق إن كل حاجة شغالة

بعد إضافة الـ variables:

1. **Firebase:** افتح الـ app وجرب تسجّل — لو اشتغل Firebase OK
2. **Stripe:** اضغط Upgrade → لو ظهر Stripe checkout → OK
3. **PayMob:** اختار Egypt billing → لو ظهر PayMob iframe → OK
4. **Gemini:** شغّل session وانتهيها → لو ظهر AI analysis → OK
5. **Email:** سجّل account جديد → لو وصل welcome email → OK
6. **PDF:** اضغط Download PDF بعد session → لو نزل PDF → OK

