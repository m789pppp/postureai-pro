import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
    chunkSizeWarningLimit: 600,
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.warn'],
      }
    },
    rollupOptions: {
      output: {
        // Better cache hashing
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          // ── Critical: split Firebase into sub-packages ────────────
          if (id.includes('node_modules/firebase/auth'))          return 'firebase-auth';
          if (id.includes('node_modules/firebase/firestore'))     return 'firebase-firestore';
          if (id.includes('node_modules/firebase/storage'))       return 'firebase-storage';
          if (id.includes('node_modules/firebase/analytics'))     return 'firebase-analytics';
          if (id.includes('node_modules/firebase/messaging'))     return 'firebase-messaging';
          if (id.includes('node_modules/firebase'))               return 'firebase-core';

          // ── React vendor (small, cached long-term) ────────────────
          if (id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/'))                 return 'react-vendor';

          // ── Heavy libs — only loaded when needed ──────────────────
          if (id.includes('node_modules/jspdf'))                  return 'jspdf';
          if (id.includes('node_modules/html2canvas'))            return 'html2canvas';
          if (id.includes('node_modules/framer-motion'))          return 'framer-motion';
          if (id.includes('node_modules/mediapipe') ||
              id.includes('node_modules/@mediapipe'))             return 'mediapipe';
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-'))                    return 'charts';

          // ── App chunks ────────────────────────────────────────────
          // Standalone marketing pages (loaded only on their routes)
          if (id.includes('/src/LandingPageV7') ||
              id.includes('/src/StandaloneLayout') ||
              id.includes('/src/sharedTokens') ||
              id.includes('/src/lpShared'))                       return 'landing';
          if (id.includes('/src/ProductPage'))                    return 'page-product';
          if (id.includes('/src/SolutionsPage'))                  return 'page-solutions';
          if (id.includes('/src/PricingPageLP'))                  return 'page-pricing';
          if (id.includes('/src/HowItWorksPage'))                 return 'page-how';
          if (id.includes('/src/FAQPage'))                        return 'page-faq';

          // App features
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
          if (id.includes('/src/HRPanel') ||
              id.includes('/src/CompanySystem'))                  return 'hr';
          if (id.includes('/src/AICoach') ||
              id.includes('/src/PostureCalibration'))             return 'ai-features';
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
