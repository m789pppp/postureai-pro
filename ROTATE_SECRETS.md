# 🚨 CRITICAL: Rotate These Credentials Immediately

The following credentials were committed to the git repository and MUST be rotated NOW.

## 1. Firebase API Key
**Exposed key:** `AIzaSyADLL_muc6ooQnfr1cKDCZFX3FKYknTxiI`
**Action required:**
1. Go to https://console.firebase.google.com → corvusd → Project Settings → General
2. Under "Your apps" → Web app → click the settings gear
3. Scroll to "Web API Key" → click "Rotate API key"
4. Update VITE_FIREBASE_API_KEY in Vercel environment settings
5. Update your local frontend/.env.local

## 2. Firebase Project Details
**Exposed:** Project ID `corvusd`, App ID, Messaging Sender ID
These are used for Firebase Auth. While less sensitive than the API key,
review your Firebase Security Rules to ensure they're production-hardened.

## 3. PayMob Test Public Key
**Exposed key:** `egy_pk_test_dLCSqj9kWac4I6wRNiH0wac666K6LKQJ`
**Action required:**
1. Go to https://accept.paymob.com/portal2/en/settings
2. This is a TEST key — ensure production keys are NEVER in source code
3. Add VITE_PAYMOB_PUBLIC_KEY to Vercel environment variables

## 4. PayMob iFrame ID
**Exposed:** `991659`
This is a configuration ID, not a secret. Low risk but replace anyway.

## Steps After Rotation
1. Update all secrets in Railway (backend) environment panel
2. Update all secrets in Vercel (frontend) environment panel
3. Run: `git rm --cached frontend/.env.local` to untrack the file
4. Commit the updated .gitignore
5. Consider using `git filter-repo` to remove the key from history

## Going Forward
- Use Vercel/Railway secret panels for all production values
- Use GitHub Actions secrets for CI/CD
- Never `echo` secrets in build logs
