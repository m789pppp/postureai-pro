/**
 * 08-accessibility.spec.ts — WCAG 2.1 AA Accessibility Tests
 */
import { test, expect } from "@playwright/test";

test.describe("Accessibility", () => {
  test("landing page has descriptive title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/postureai|posture/i);
  });

  test("landing page has main landmark", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main, [role='main']").first()).toBeAttached();
  });

  test("all images have alt text", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const imgs = await page.locator("img").all();
    for (const img of imgs) {
      const alt = await img.getAttribute("alt");
      expect(alt).not.toBeNull();
    }
  });

  test("buttons have accessible labels", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const buttons = await page.getByRole("button").all();
    for (const btn of buttons.slice(0, 10)) {
      const label = await btn.textContent();
      const ariaLabel = await btn.getAttribute("aria-label");
      expect((label?.trim() || ariaLabel?.trim() || "").length).toBeGreaterThan(0);
    }
  });

  test("color contrast — primary CTA text is readable", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("button", { name: /start free|get started/i }).first();
    if (await cta.isVisible()) {
      const color = await cta.evaluate(el => getComputedStyle(el).color);
      // Should be white text (#fff)
      expect(color).toMatch(/255,\s*255,\s*255|rgb\(255/);
    }
  });

  test("keyboard navigation works on landing", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Tab through first 5 focusable elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
    }
    const focused = page.locator(":focus");
    await expect(focused).toBeAttached();
  });

  test("focus styles visible", async ({ page }) => {
    await page.goto("/");
    const firstBtn = page.getByRole("button").first();
    await firstBtn.focus();
    const outline = await firstBtn.evaluate(el => getComputedStyle(el).outline);
    // Should have visible focus ring
    expect(outline).not.toBe("none");
    expect(outline.length).toBeGreaterThan(0);
  });

  test("RTL Arabic layout is keyboard accessible", async ({ page }) => {
    await page.goto("/");
    const arabicBtn = page.getByRole("button", { name: /عربي/i }).first();
    if (await arabicBtn.isVisible()) {
      await arabicBtn.click();
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused).toBeAttached();
    }
  });
});
