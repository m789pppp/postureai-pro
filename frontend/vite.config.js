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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase'))              return 'firebase-sdk';
          if (id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/'))                return 'react-vendor';
          if (id.includes('/src/AdminDashboard'))                return 'admin';
          if (id.includes('/src/EnterpriseRBAC') ||
              id.includes('/src/EnterpriseSSO') ||
              id.includes('/src/MultiTenantManager') ||
              id.includes('/src/EnterpriseAdminTools'))          return 'enterprise';
          if (id.includes('/src/AnalyticsDashboard') ||
              id.includes('/src/WorkforceAnalytics') ||
              id.includes('/src/AIReports') ||
              id.includes('/src/PredictiveAI') ||
              id.includes('/src/AIInsights'))                    return 'analytics';
          if (id.includes('/src/HRPanel') ||
              id.includes('/src/CompanySystem'))                 return 'hr';
          if (id.includes('/src/LandingPage') ||
              id.includes('/src/PricingPage'))                   return 'marketing';
          if (id.includes('/src/AICoach') ||
              id.includes('/src/PostureCalibration'))            return 'ai-features';
          if (id.includes('/src/UsageBilling') ||
              id.includes('/src/BillingDashboard') ||
              id.includes('/src/Billing.jsx'))                   return 'billing';
          if (id.includes('/src/ChurnPrediction') ||
              id.includes('/src/CustomerSuccess') ||
              id.includes('/src/GrowthHub') ||
              id.includes('/src/ReferralProgram'))               return 'growth';
          if (id.includes('/src/IntegrationsHub') ||
              id.includes('/src/APIMarketplace') ||
              id.includes('/src/WhiteLabel'))                    return 'integrations';
          if (id.includes('/src/AuditSystem') ||
              id.includes('/src/MFASetup') ||
              id.includes('/src/LegalCompliance'))               return 'security';
          if (id.includes('/src/ProductTour') ||
              id.includes('/src/OnboardingWizard'))              return 'onboarding';
        }
      }
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '3.0.0'),
  }
})
