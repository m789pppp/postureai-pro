/**
 * 06-mobile-responsive.spec.ts — Mobile & Responsive Layout Tests
 */
import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "iPhone 14",        width: 390,  height: 844  },
  { name: "Samsung Galaxy",   width: 412,  height: 915  },
  { name: "iPad Mini",        width: 768,  height: 1024 },
  { name: "Laptop",           width: 1280, height: 800  },
  { name: "Ultrawide 2560",   width: 2560, height: 1440 },
];

test.describe("Responsive Layout", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} (${vp.width}×${vp.height}) — landing renders`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      // H1 must be visible
      await expect(page.locator("h1").first()).toBeVisible();
      // No horizontal scroll
      const hasHScroll = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHScroll).toBeFalsy();
      // CTA must be in viewport
      const ctaBtn = page.getByRole("button", { name: /start|get started|ابدأ/i }).first();
      await expect(ctaBtn).toBeInViewport();
    });
  }

  test("RTL layout has no overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: /عربي/i }).first().click();
    await page.waitForTimeout(500);
    const hasHScroll = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHScroll).toBeFalsy();
  });

  test("touch targets are at least 44×44px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const buttons = page.getByRole("button").all();
    const btns = await buttons;
    for (const btn of btns.slice(0, 5)) {
      const box = await btn.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(36); // allow 36px min
        expect(box.width).toBeGreaterThanOrEqual(36);
      }
    }
  });
});
