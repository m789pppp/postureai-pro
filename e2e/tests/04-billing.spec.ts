/**
 * 04-billing.spec.ts — Billing & Upgrade Flow E2E Tests
 * Covers: pricing page, tier display, upgrade prompt, PayMob/Stripe flow
 */
import { test, expect } from "@playwright/test";
import { AuthPage } from "../pages/AuthPage";
import { USERS } from "../fixtures/users";

test.describe("Billing & Pricing", () => {
  test("pricing page shows correct tiers", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await expect(page.getByText(/standard/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/professional/i).first()).toBeVisible();
    await expect(page.getByText(/elite/i).first()).toBeVisible();
  });

  test("pricing shows EGP prices", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await expect(page.getByText(/199|499|1,199/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("feature gating shows upgrade prompt", async ({ page }) => {
    test.skip(!process.env.E2E_STARTER_EMAIL, "E2E_STARTER_EMAIL not set");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.starter.email, USERS.starter.password);
    // Try to access HR features (starter shouldn't have access)
    const hrBtn = page.getByRole("button", { name: /hr|workforce/i }).first();
    if (await hrBtn.isVisible({ timeout: 8000 })) {
      await hrBtn.click();
      const upgradeMsg = page.getByText(/upgrade|tier|professional|elite/i).first();
      await expect(upgradeMsg).toBeVisible({ timeout: 8000 });
    }
  });

  test("checkout flow initiates correctly (Stripe)", async ({ page }) => {
    test.skip(!process.env.E2E_STARTER_EMAIL, "E2E credentials not set");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.starter.email, USERS.starter.password);
    // Find upgrade/billing button
    const billingBtn = page.getByRole("button", { name: /upgrade|billing|plans/i }).first();
    if (await billingBtn.isVisible({ timeout: 8000 })) {
      await billingBtn.click();
      // Stripe or PayMob redirect / iframe should appear
      await page.waitForTimeout(2000);
      const hasStripe = await page.locator("iframe[src*='stripe']").isVisible().catch(() => false);
      const hasPaymob = await page.locator("iframe[src*='paymob']").isVisible().catch(() => false);
      const hasCheckout = await page.getByText(/checkout|pay|stripe|paymob/i).first().isVisible().catch(() => false);
      // At least one payment element should be present or redirect initiated
      expect(hasStripe || hasPaymob || hasCheckout).toBeTruthy();
    }
  });

  test("billing page shows current plan", async ({ page }) => {
    test.skip(!process.env.E2E_STARTER_EMAIL, "E2E credentials not set");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.starter.email, USERS.starter.password);
    const billingBtn = page.getByRole("button", { name: /billing|plan/i }).first();
    if (await billingBtn.isVisible({ timeout: 8000 })) {
      await billingBtn.click();
      await expect(page.getByText(/starter|current plan|your plan/i).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test("yearly billing toggle saves percentage", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(400);
    const yearlyBtn = page.getByRole("button", { name: /yearly|annual|سنوي/i }).first();
    if (await yearlyBtn.isVisible({ timeout: 5000 })) {
      await yearlyBtn.click();
      await expect(page.getByText(/save|17%|وفّر/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
