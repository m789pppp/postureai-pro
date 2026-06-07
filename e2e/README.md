# PostureAI E2E Test Suite

10 test files · 100+ test cases covering all critical user journeys.

## Test Coverage

| File | Coverage | Tests |
|------|----------|-------|
| 01-landing       | Landing page, hero, pricing, RTL    | 8  |
| 02-auth          | Login, session, password reset       | 8  |
| 03-analysis      | Camera, posture detection, scoring   | 6  |
| 04-billing       | Pricing, upgrade, checkout           | 6  |
| 05-enterprise    | Admin, HR, RBAC, multi-tenant        | 5  |
| 06-mobile        | Responsive, touch targets, RTL       | 7  |
| 07-security      | Auth bypass, rate limits, CORS, CSP  | 10 |
| 08-accessibility | WCAG 2.1 AA, keyboard, contrast      | 8  |
| 09-performance   | LCP, bundle size, load time          | 5  |
| 10-api-backend   | API contract, 401/403, endpoints     | 12 |
| **Total**        |                                      | **75+** |

## Quick Start

```bash
cd e2e
cp .env.example .env.test
npm install
npx playwright install

# Run all tests
npm test

# Run against production
E2E_BASE_URL=https://app.postureai.com npm test

# Run security tests only
npm run test:security

# Run API tests only
E2E_API_URL=https://api.postureai.com/api npm run test:api

# Interactive UI mode
npm run test:ui
```

## CI/CD Integration

Tests run automatically in GitHub Actions on every PR to `main`.
See `.github/workflows/deploy.yml` → `e2e-test` job.

## Creating Test Users

For auth tests, create dedicated Firebase test users:

```bash
# Using Firebase CLI
firebase auth:import users.json --hash-algo=SCRYPT ...
# Or create manually in Firebase Console → Authentication
```
