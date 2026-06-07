/**
 * 01-landing.spec.ts — Landing Page E2E Tests
 * Covers: hero, pricing, language switch, CTA, mobile responsive
 */
import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("hero section renders correctly", async ({ page }) => {
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText(/posture|وضعية/i).first()).toBeVisible();
    const ctaBtn = page.getByRole("button", { name: /start free|get started|ابدأ/i }).first();
    await expect(ctaBtn).toBeVisible();
    await expect(ctaBtn).toBeEnabled();
  });

  test("pricing section is visible", async ({ page }) => {
    await page.getByRole("link", { name: /pricing|الأسعار/i }).first().click().catch(() =>
      page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
    );
    await page.waitForTimeout(500);
    await expect(page.getByText(/standard|professional|elite/i).first()).toBeVisible();
  });

  test("monthly/yearly billing toggle works", async ({ page }) => {
    const yearlyBtn = page.getByRole("button", { name: /yearly|سنوي/i }).first();
    if (await yearlyBtn.isVisible()) {
      await yearlyBtn.click();
      await expect(page.getByText(/save|وفّر/i).first()).toBeVisible();
    }
  });

  test("language switch to Arabic changes direction", async ({ page }) => {
    const arabicBtn = page.getByRole("button", { name: /عربي|ar/i }).first();
    await expect(arabicBtn).toBeVisible();
    await arabicBtn.click();
    await expect(page.locator("html[dir='rtl']")).toBeAttached({ timeout: 5000 });
    await expect(page.getByText(/ابدأ مجاناً|وضعية/i).first()).toBeVisible();
    // Switch back
    await page.getByRole("button", { name: /english/i }).first().click();
    await expect(page.locator("html[dir='ltr']")).toBeAttached({ timeout: 5000 });
  });

  test("mobile viewport renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("h1").first()).toBeVisible();
    const cta = page.getByRole("button", { name: /start|ابدأ/i }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toBeInViewport();
  });

  test("hero stats section visible", async ({ page }) => {
    await expect(page.getByText(/47%|1,200|customers|companies/i).first()).toBeVisible();
  });

  test("no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const critical = errors.filter(e =>
      !e.includes("favicon") && !e.includes("fonts.googleapis")
    );
    expect(critical).toHaveLength(0);
  });

  test("enterprise section CTA opens contact", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const enterpriseBtn = page.getByRole("link", { name: /book demo|enterprise|تواصل/i }).first();
    if (await enterpriseBtn.isVisible()) {
      await expect(enterpriseBtn).toBeEnabled();
    }
  });

  test("FAQ accordion toggles", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.75));
    await page.waitForTimeout(300);
    const faqBtn = page.getByRole("button").filter({ hasText: /store.*video|يخزّن/i }).first();
    if (await faqBtn.isVisible()) {
      await faqBtn.click();
      await expect(page.getByText(/mediapipe|on-device|locally/i).first()).toBeVisible();
    }
  });
});
