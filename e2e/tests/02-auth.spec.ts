/**
 * 02-auth.spec.ts — Authentication E2E Tests
 * Covers: login, invalid credentials, session persistence, password reset
 */
import { test, expect } from "@playwright/test";
import { AuthPage } from "../pages/AuthPage";
import { USERS } from "../fixtures/users";

test.describe("Authentication", () => {
  test("landing CTA navigates to auth", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.clickGetStarted();
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("login form validation — empty fields", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start|get started|ابدأ/i }).first().click();
    const signIn = page.getByRole("button", { name: /sign in|login/i }).first();
    if (await signIn.isVisible()) {
      await signIn.click();
      await expect(page.getByText(/required|email.*required|fill/i).first()).toBeVisible({ timeout: 6000 });
    }
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.clickGetStarted();
    await page.getByPlaceholder(/email/i).fill("notauser@invalid.com");
    await page.getByPlaceholder(/password/i).fill("wrongpassword123");
    const signIn = page.getByRole("button", { name: /sign in|login/i }).first();
    await signIn.click();
    await expect(page.getByText(/invalid|incorrect|not found|error/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("login with starter user", async ({ page }) => {
    test.skip(!process.env.E2E_STARTER_EMAIL, "E2E_STARTER_EMAIL not set — skip");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.starter.email, USERS.starter.password);
    await expect(page).not.toHaveURL(/auth|login/i, { timeout: 15000 });
  });

  test("login with admin user", async ({ page }) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL not set — skip");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.admin.email, USERS.admin.password);
    await expect(page).not.toHaveURL(/auth|login/i, { timeout: 15000 });
    // Admin-only controls visible
    await expect(page.getByText(/admin|🛡️/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("session persists on page refresh", async ({ page }) => {
    test.skip(!process.env.E2E_STARTER_EMAIL, "E2E_STARTER_EMAIL not set — skip");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.starter.email, USERS.starter.password);
    await page.waitForTimeout(2000);
    await page.reload();
    await page.waitForLoadState("networkidle");
    // Should still be logged in (Firebase persists auth state)
    await expect(page.getByText(/dashboard|session|welcome/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("sign-out works", async ({ page }) => {
    test.skip(!process.env.E2E_STARTER_EMAIL, "E2E_STARTER_EMAIL not set — skip");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.starter.email, USERS.starter.password);
    // Find sign-out button
    const avatar = page.locator('[data-testid="user-avatar"], [aria-label="user menu"]').first();
    if (await avatar.isVisible({ timeout: 5000 })) {
      await avatar.click();
      await page.getByRole("button", { name: /sign out|logout|خروج/i }).first().click();
    }
    await expect(page.getByPlaceholder(/email/i).first().or(
      page.getByRole("button", { name: /start free|ابدأ/i }).first()
    )).toBeVisible({ timeout: 10000 });
  });

  test("password reset link visible", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start|get started|ابدأ/i }).first().click();
    const resetLink = page.getByRole("link", { name: /forgot|reset|نسيت/i }).first()
      .or(page.getByText(/forgot|reset/i).first());
    await expect(resetLink).toBeVisible({ timeout: 8000 });
  });

  test("auth page RTL when Arabic selected", async ({ page }) => {
    await page.goto("/");
    const arabicBtn = page.getByRole("button", { name: /عربي/i }).first();
    if (await arabicBtn.isVisible()) {
      await arabicBtn.click();
      await page.getByRole("button", { name: /ابدأ/i }).first().click();
      await expect(page.locator("[dir='rtl']").first()).toBeAttached({ timeout: 5000 });
    }
  });
});
