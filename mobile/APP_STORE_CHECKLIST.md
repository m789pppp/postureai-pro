# PostureAI Pro — App Store Submission Checklist

## Prerequisites (do these first)

### Apple Developer Account
- [ ] Enroll at https://developer.apple.com ($99/year)
- [ ] Create App ID: com.postureai.pro
- [ ] Enable: Push Notifications, Camera Access
- [ ] Create Distribution Certificate + Provisioning Profile

### Google Play Console
- [ ] Register at https://play.google.com/console ($25 one-time)
- [ ] Create new app: "PostureAI Pro"
- [ ] Create Service Account for EAS → download JSON → save as `eas/google-play-service-account.json`

### EAS Setup
```bash
npm install -g eas-cli
eas login
eas init  # links to your Expo account, generates projectId
```
Update `app.json` → `extra.eas.projectId` with the generated ID.

---

## Environment Variables (set in EAS Dashboard)

Go to: https://expo.dev → your project → Secrets

```
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_API_URL=https://api.postureai.com/api
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=REPLACE.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=REPLACE.apps.googleusercontent.com
EXPO_PUBLIC_SENTRY_DSN
```

---

## Build Commands

```bash
cd mobile

# 1. Test locally
npx expo start

# 2. Build for TestFlight (iOS) + Internal Testing (Android)
eas build --platform all --profile preview

# 3. Build for production
eas build --platform all --profile production

# 4. Submit to App Store + Play Store
eas submit --platform all --profile production
```

---

## Required Assets

| Asset | Size | Path |
|-------|------|------|
| App Icon | 1024×1024 PNG | `assets/icon.png` |
| Splash Screen | 1284×2778 PNG | `assets/splash.png` |
| Android Adaptive Icon | 1024×1024 PNG | `assets/adaptive-icon.png` |
| Screenshots (iPhone 6.7") | 1290×2796 | `eas/screenshots/ios/` |
| Screenshots (iPad 12.9") | 2048×2732 | `eas/screenshots/ios-ipad/` |
| Screenshots (Android phone) | 1080×1920 | `eas/screenshots/android/` |

---

## App Store Review Notes

**Camera Permission Justification** (required by Apple):
> "PostureAI Pro uses the camera to analyze posture in real time. All processing happens on-device using MediaPipe. No video frames are stored, uploaded, or transmitted."

**Sign-In with Apple** — Required if you offer Google Sign-In:
- Add `expo-apple-authentication` to dependencies
- Implement `AuthScreen.tsx` Apple Sign-In button

---

## Timeline Estimate

| Step | Time |
|------|------|
| Developer enrollment (Apple) | 1-2 days |
| EAS setup + first build | 1 day |
| TestFlight beta testing | 1 week |
| App Store review | 1-3 days |
| Google Play internal → production | 2-7 days |
| **Total** | **2-3 weeks** |

---

## After Submission

- [ ] Set up App Store Connect analytics
- [ ] Configure push notification certificates in Firebase
- [ ] Set up crash reporting (Sentry mobile SDK)
- [ ] Monitor reviews and respond within 24h
