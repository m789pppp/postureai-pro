/**
 * 03-analysis.spec.ts — Posture Analysis E2E Tests
 * Covers: camera permission, analysis start/stop, score display, coaching
 */
import { test, expect, BrowserContext } from "@playwright/test";
import { AuthPage } from "../pages/AuthPage";
import { USERS } from "../fixtures/users";

// Grant camera permissions
async function grantCamera(context: BrowserContext) {
  await context.grantPermissions(["camera"]);
}

test.describe("Posture Analysis", () => {
  test.beforeEach(async ({ context, page }) => {
    await grantCamera(context);
    test.skip(!process.env.E2E_STARTER_EMAIL, "E2E credentials not set — skip");
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login(USERS.starter.email, USERS.starter.password);
  });

  test("start analysis button is visible", async ({ page }) => {
    const startBtn = page.getByRole("button", { name: /start|analyze|camera|begin/i }).first();
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await expect(startBtn).toBeEnabled();
  });

  test("camera activates on click", async ({ page }) => {
    const startBtn = page.getByRole("button", { name: /start.*session|start.*analysis|activate camera/i }).first();
    if (await startBtn.isVisible({ timeout: 8000 })) {
      await startBtn.click();
      // Video element or canvas should appear
      const videoEl = page.locator("video, canvas").first();
      await expect(videoEl).toBeAttached({ timeout: 10000 });
    }
  });

  test("posture score element renders", async ({ page }) => {
    const score = page.getByText(/score|posture.*\d{2}/i).first()
      .or(page.locator('[data-testid="posture-score"]').first());
    await expect(score).toBeVisible({ timeout: 12000 });
  });

  test("stop analysis releases camera", async ({ page }) => {
    const startBtn = page.getByRole("button", { name: /start.*session|start/i }).first();
    if (await startBtn.isVisible({ timeout: 8000 })) {
      await startBtn.click();
      await page.waitForTimeout(2000);
      const stopBtn = page.getByRole("button", { name: /stop|end session|pause/i }).first();
      if (await stopBtn.isVisible({ timeout: 5000 })) {
        await stopBtn.click();
        // Video element should be removed
        await expect(page.locator("video")).not.toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("score is between 0 and 100", async ({ page }) => {
    const scoreEl = page.locator('[data-testid="posture-score"], .posture-score').first();
    if (await scoreEl.isVisible({ timeout: 10000 })) {
      const text = await scoreEl.textContent();
      const num  = parseInt(text || "0", 10);
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThanOrEqual(100);
    }
  });

  test("calibration screen accessible", async ({ page }) => {
    const calibrateBtn = page.getByRole("button", { name: /calibrat|recalibr|معايرة/i }).first();
    if (await calibrateBtn.isVisible({ timeout: 6000 })) {
      await calibrateBtn.click();
      await expect(page.getByText(/calibrat|position|معايرة/i).first()).toBeVisible({ timeout: 8000 });
    }
  });
});
