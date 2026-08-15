import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["react", "react-dom", "firebase/app", "firebase/auth", "firebase/firestore"],
    exclude: ["mediapipe", "@mediapipe/tasks-vision"],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.warn', 'console.info', 'console.debug'],
        passes: 2,
        collapse_vars: true,
        reduce_vars: true,
      },
      mangle: { safari10: true },
      format: { comments: false },
    },
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {

          // ── 1. npm Firebase sub-packages ──────────────────────────
          if (id.includes('node_modules/firebase/auth'))          return 'firebase-auth';
          if (id.includes('node_modules/firebase/firestore'))     return 'firebase-firestore';
          if (id.includes('node_modules/firebase/storage'))       return 'firebase-storage';
          if (id.includes('node_modules/firebase/analytics'))     return 'firebase-analytics';
          if (id.includes('node_modules/firebase/messaging'))     return 'firebase-messaging';
          if (id.includes('node_modules/firebase'))               return 'firebase-core';

          // ── 2. React vendor ───────────────────────────────────────
          if (id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/'))                 return 'react-vendor';

          // ── 3. Heavy 3rd-party libs ───────────────────────────────
          if (id.includes('node_modules/jspdf'))                  return 'jspdf';
          if (id.includes('node_modules/html2canvas'))            return 'html2canvas';
          if (id.includes('node_modules/framer-motion'))          return 'framer-motion';
          if (id.includes('node_modules/mediapipe') ||
              id.includes('node_modules/@mediapipe'))             return 'mediapipe';
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-'))                    return 'charts';

          // ── 4. Our local shared utilities — MUST be named so they
          //       don't get sucked into multiple chunks and create
          //       circular chunk dependencies ────────────────────────
          // pdfReports is heavy — keep with the jsPDF/html2canvas chunks
          if (id.includes('/src/lib/pdfReports') ||
              id.includes('/src/assets/cairoFont'))               return 'pdf-engine';
          // Everything else in /src/lib/ + our firebase wrapper
          if (id.includes('/src/lib/useBodyScrollLock') ||
              id.includes('/src/lib/tierQuality') ||
              id.includes('/src/lib/'))                           return 'shared-utils';

          // Our local firebase.js wrapper (≠ npm firebase package):
          // Pin it to shared-utils so every feature chunk can import
          // it without pulling the whole App chunk as a dependency.
          if (id.includes('/src/firebase.js') ||
              id.includes('/src/config/api'))                     return 'shared-utils';

          if (id.includes('/src/localAI') ||
              id.includes('/src/gemini') ||
              id.includes('/src/aiPreloader'))                    return 'ai-engine';

          // ── 4b. Posture analysis engine + utils ───────────────────
          // postureEngine.js is the heaviest non-lazy import after App.jsx
          // itself. Pinning it to its own chunk lets the browser cache it
          // independently since it changes rarely.
          if (id.includes('/src/features/analysis/postureEngine') ||
              id.includes('/src/PostureUtils') ||
              id.includes('/src/CustomAlertRules'))               return 'posture-engine';

          // ── 4c. Auth-flow pages (none needed until sign-in) ───────
          if (id.includes('/src/AuthPage') ||
              id.includes('/src/ResetPasswordPage') ||
              id.includes('/src/EmailVerificationPage') ||
              id.includes('/src/ChangePasswordPage') ||
              id.includes('/src/TrialExpiredPage') ||
              id.includes('/src/InviteAccept') ||
              id.includes('/src/AccountSwitcher'))                return 'auth';

          // ── 4d. Demo mode (guest/demo users only) ─────────────────
          if (id.includes('/src/DemoMode') ||
              id.includes('/src/DemoModeUI'))                     return 'demo';

          // ── 4e. Miscellaneous on-demand features ──────────────────
          if (id.includes('/src/AnnouncementsBar') ||
              id.includes('/src/EmbedWidget') ||
              id.includes('/src/FeatureFlags') ||
              id.includes('/src/ShareCard'))                      return 'extras';

          if (id.includes('/src/HelpCenter') ||
              id.includes('/src/APIChangelog'))                   return 'help';

          if (id.includes('/src/sentry'))                        return 'shared-utils';

          if (id.includes('/src/services/api') ||
              id.includes('/src/lib/voiceCoach') ||
              id.includes('/src/lib/i18n') ||
              id.includes('/src/lib/faceBlur'))                   return 'shared-utils';

          if (id.includes('/src/BreakPage'))                     return 'break';
          if (id.includes('/src/PricingPage'))                   return 'page-pricing';
          if (id.includes('/src/EnterpriseAdminTools'))          return 'enterprise';
          if (id.includes('/src/SecurityCenter') ||
              id.includes('/src/AccountActivity') ||
              id.includes('/src/OnboardingAnalytics'))           return 'security';

          // ── 5. Marketing / standalone pages ───────────────────────
          if (id.includes('/src/LandingPageV7') ||
              id.includes('/src/StandaloneLayout') ||
              id.includes('/src/sharedTokens') ||
              id.includes('/src/lpShared'))                       return 'landing';
          if (id.includes('/src/ProductPage'))                    return 'page-product';
          if (id.includes('/src/SolutionsPage'))                  return 'page-solutions';
          if (id.includes('/src/PricingPageLP'))                  return 'page-pricing';
          if (id.includes('/src/HowItWorksPage'))                 return 'page-how';
          if (id.includes('/src/FAQPage'))                        return 'page-faq';

          // ── 6. App feature chunks ──────────────────────────────────
          if (id.includes('/src/AdminDashboard'))                 return 'admin';

          if (id.includes('/src/EnterpriseRBAC') ||
              id.includes('/src/EnterpriseSSO') ||
              id.includes('/src/MultiTenantManager') ||
              id.includes('/src/EnterpriseAdminTools'))           return 'enterprise';

          if (id.includes('/src/AnalyticsDashboard') ||
              id.includes('/src/WorkforceAnalytics') ||
              id.includes('/src/AIReports') ||
              id.includes('/src/PredictiveAI') ||
              id.includes('/src/AIInsights'))                     return 'analytics';

          // hr + calibration together — they share firebase.js hooks
          // and were causing ai-features ↔ hr circular chunk dep
          if (id.includes('/src/HRPanel') ||
              id.includes('/src/CompanySystem') ||
              id.includes('/src/PostureCalibration'))             return 'hr';

          if (id.includes('/src/AICoach'))                        return 'ai-coach';

          if (id.includes('/src/pdf-engine') ||
              id.includes('/src/assets/cairoFont'))               return 'pdf-engine';

          if (id.includes('/src/NotificationsHub'))               return 'notifications';

          if (id.includes('/src/UsageBilling') ||
              id.includes('/src/BillingDashboard') ||
              id.includes('/src/Billing.jsx'))                    return 'billing';

          if (id.includes('/src/ChurnPrediction') ||
              id.includes('/src/CustomerSuccess') ||
              id.includes('/src/GrowthHub') ||
              id.includes('/src/ReferralProgram'))                return 'growth';

          if (id.includes('/src/IntegrationsHub') ||
              id.includes('/src/APIMarketplace') ||
              id.includes('/src/WhiteLabel'))                     return 'integrations';

          if (id.includes('/src/AuditSystem') ||
              id.includes('/src/MFASetup') ||
              id.includes('/src/LegalCompliance'))                return 'security';

          if (id.includes('/src/ProductTour') ||
              id.includes('/src/OnboardingWizard'))               return 'onboarding';
        }
      }
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '3.0.0'),
  }
})
