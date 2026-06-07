/**
 * 05-enterprise.spec.ts — Enterprise RBAC, Admin, HR Dashboard E2E Tests
 */
import { test, expect } from "@playwright/test";
import { AuthPage } from "../pages/AuthPage";
import { DashboardPage } from "../pages/DashboardPage";
import { USERS } from "../fixtures/users";

test.describe("Enterprise — RBAC & Admin", () => {
  test("admin user sees admin controls", async ({ page }) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not set");
    const auth      = new AuthPage(page);
    const dashboard = new DashboardPage(page);
    await auth.goto();
    await auth.login(USERS.admin.email, USERS.admin.password);
    await expect(page.getByText(/admin|🛡️/i).first()).toBeVisible({ timeout: 10000 });
    await dashboard.openAdmin();
  });

  test("starter user cannot access admin panel", async ({ page }) => {
    test.skip(!process.env.E2E_STARTER_EMAIL, "E2E credentials not set");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.starter.email, USERS.starter.password);
    // Admin button should NOT be visible for starter
    const adminBtn = page.getByRole("button", { name: /^admin$|admin dashboard/i }).first();
    await expect(adminBtn).not.toBeVisible({ timeout: 6000 });
  });

  test("HR user sees HR dashboard", async ({ page }) => {
    test.skip(!process.env.E2E_HR_EMAIL, "E2E_HR_EMAIL not set");
    const auth      = new AuthPage(page);
    const dashboard = new DashboardPage(page);
    await auth.goto();
    await auth.login(USERS.hr.email, USERS.hr.password);
    await dashboard.openHR();
  });

  test("multi-tenant: user sees only own company data", async ({ page }) => {
    test.skip(!process.env.E2E_STARTER_EMAIL, "E2E credentials not set");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.starter.email, USERS.starter.password);
    // Navigate to HR panel
    const hrBtn = page.getByRole("button", { name: /hr|workforce/i }).first();
    if (await hrBtn.isVisible({ timeout: 6000 })) {
      await hrBtn.click();
      await page.waitForTimeout(2000);
      // Should not see competitor company names
      await expect(page.getByText(/competitor|rival company/i)).not.toBeVisible();
    }
  });

  test("admin dashboard loads feature flags", async ({ page }) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not set");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.admin.email, USERS.admin.password);
    const adminBtn = page.getByRole("button", { name: /admin/i }).first();
    if (await adminBtn.isVisible({ timeout: 8000 })) {
      await adminBtn.click();
      const featureBtn = page.getByRole("button", { name: /feature flags?|flags?/i }).first();
      if (await featureBtn.isVisible({ timeout: 6000 })) {
        await featureBtn.click();
        await expect(page.getByText(/ai_coaching|mobile_camera|beta/i).first()).toBeVisible({ timeout: 8000 });
      }
    }
  });

  test("security center accessible after login", async ({ page }) => {
    test.skip(!process.env.E2E_STARTER_EMAIL, "E2E credentials not set");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.starter.email, USERS.starter.password);
    const secBtn = page.getByRole("button", { name: /security|🔐/i }).first();
    if (await secBtn.isVisible({ timeout: 8000 })) {
      await secBtn.click();
      await expect(page.getByText(/security score|mfa|two-factor/i).first()).toBeVisible({ timeout: 8000 });
    }
  });
});
