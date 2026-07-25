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
