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
    sourcemap: true,
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

          // Vite's own dynamic-import/preload runtime helper has no
          // manualChunks rule of its own, so Rollup was free to physically
          // place it inside whichever chunk it built first — which turned
          // out to be 'jspdf' (380KB raw). Every single dynamic import()
          // anywhere in the app, including the landing page's, then had to
          // import that one helper binding from the jspdf chunk, which
          // meant fetching and evaluating the entire jsPDF library just to
          // get a tiny internal polyfill function. Checked first and given
          // its own near-empty chunk instead.
          if (id.includes('vite/preload-helper'))                 return 'vite-helpers';

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
          // findings.js imports from postureEngine.js and is only used by
          // the admin-only FindingsPanel — must be checked before the
          // generic '/src/lib/' catch-all below, which would otherwise
          // match first and silently swallow this rule, pulling
          // postureEngine into every page that needs anything else in
          // 'shared-utils' (exactly what happened the first time this was
          // added further down the if-chain, after the catch-all).
          if (id.includes('/src/lib/findings'))                   return 'posture-engine';
          // Everything else in /src/lib/ + our firebase wrapper
          if (id.includes('/src/lib/useBodyScrollLock') ||
              id.includes('/src/lib/tierQuality') ||
              id.includes('/src/lib/'))                           return 'shared-utils';

          // Our local firebase.js wrapper (≠ npm firebase package): own
          // chunk, not 'shared-utils' and not 'App'. It was pinned to
          // 'shared-utils' so every feature chunk could import it without
          // pulling in the whole App chunk as a dependency — that part is
          // still true here. But 'shared-utils' is also where small,
          // genuinely-shared helpers like useBodyScrollLock/i18n live, and
          // every public marketing page (landing, product, pricing, faq,
          // how-it-works) needs one of those for its contact/legal modals.
          // Bundled together, needing a scroll-lock hook forced the full
          // Firebase SDK (firebase-core + firebase-firestore, ~150KB gzip)
          // to load on pages that never touch Firestore. Its own chunk
          // keeps both properties: no App coupling, and no forcing
          // Firebase onto pages that only need the small utils.
          if (id.includes('/src/firebase.js') ||
              id.includes('/src/config/api'))                     return 'firebase-wrapper';

          if (id.includes('/src/localAI') ||
              id.includes('/src/gemini') ||
              id.includes('/src/aiPreloader'))                    return 'ai-engine';

          // Hand-rolled SVG icon set — imported by both the landing page
          // and the standalone marketing pages (ProductPage, etc.), which
          // land in two different manual chunks ('landing' and
          // 'page-product'/'page-solutions'/...). Left unassigned, Rollup
          // has to pick one of those two chunks to physically hold this
          // shared module, which makes the OTHER chunk statically depend
          // on it — e.g. loading the landing page was also eagerly
          // fetching the page-product chunk. Giving it its own stable
          // chunk breaks that cross-dependency.
          if (id.includes('/src/LiveUI'))                        return 'shared-utils';

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

          // Own chunk, not 'shared-utils' — main.jsx calls initSentry()
          // unconditionally on every single page (landing, 404, /verify/,
          // every standalone marketing page). 'shared-utils' also holds
          // firebase.js (our wrapper, which touches firebase/app +
          // firebase/firestore) and the postureEngine-adjacent lib/ catch-all,
          // so bundling sentry.js into it meant every page load forced a
          // static, unconditional fetch of the Firebase + posture-engine
          // chunks (~150KB gzip) just to initialize error reporting, which
          // itself only needs @sentry/react. Isolating it removes that
          // forced load from every route, not just the landing page.
          if (id.includes('/src/sentry'))                        return 'sentry';

          // services/api.js imports firebase.js (for the auth token) and is
          // only ever used from inside App.jsx. Grouping it with the small,
          // genuinely page-agnostic lib/ helpers below meant any page that
          // needed one of those (useBodyScrollLock, salesWhatsapp, ...) also
          // pulled in services/api.js's own static firebase.js import in the
          // same physical chunk file — paired with 'firebase-wrapper'
          // instead, which is where that dependency actually belongs.
          if (id.includes('/src/services/api'))                   return 'firebase-wrapper';

          if (id.includes('/src/lib/voiceCoach') ||
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
              id.includes('/src/MFASetup'))                       return 'security';

          // LegalCompliance was grouped into 'security' with AuditSystem and
          // MFASetup — both admin-only tools that import firebase.js for
          // real Firestore reads. LegalCompliance's LegalModal/CookieConsent
          // are what every public marketing page (landing, product,
          // pricing, faq, how-it-works) uses for its Privacy/Terms/Refund
          // modal, so bundling it with two Firebase-dependent admin tools
          // forced the Firebase SDK onto every one of those pages just to
          // show a legal modal that itself needs no Firebase at all.
          if (id.includes('/src/LegalCompliance'))                return 'legal';

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
