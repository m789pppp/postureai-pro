/**
 * Test user fixtures — use Firebase test project or emulator.
 * Set E2E_* env vars in CI/local .env.test
 */
export const USERS = {
  admin: {
    email:    process.env.E2E_ADMIN_EMAIL    || "admin@test.postureai.com",
    password: process.env.E2E_ADMIN_PASSWORD || "TestAdmin123!",
    plan:     "enterprise",
    is_admin: true,
  },
  hr: {
    email:    process.env.E2E_HR_EMAIL       || "hr@test.postureai.com",
    password: process.env.E2E_HR_PASSWORD    || "TestHR123!",
    plan:     "professional",
    is_hr:    true,
  },
  professional: {
    email:    process.env.E2E_PRO_EMAIL      || "pro@test.postureai.com",
    password: process.env.E2E_PRO_PASSWORD   || "TestPro123!",
    plan:     "professional",
  },
  starter: {
    email:    process.env.E2E_STARTER_EMAIL  || "starter@test.postureai.com",
    password: process.env.E2E_STARTER_PASSWORD || "TestStarter123!",
    plan:     "starter",
  },
};
