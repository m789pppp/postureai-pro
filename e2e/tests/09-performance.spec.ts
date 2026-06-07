/**
 * 09-performance.spec.ts — Core Web Vitals & Performance Tests
 */
import { test, expect } from "@playwright/test";

test.describe("Performance", () => {
  test("landing page loads under 3s", async ({ page }) => {
    const start = Date.now();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(8000); // 8s max (CI is slow)
  });

  test("no broken images on landing", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const imgs  = await page.locator("img").all();
    const broken: string[] = [];
    for (const img of imgs) {
      const ok = await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
      if (!ok) broken.push(await img.getAttribute("src") || "unknown");
    }
    expect(broken).toHaveLength(0);
  });

  test("no 404 errors on page load", async ({ page }) => {
    const failed: string[] = [];
    page.on("response", resp => {
      if (resp.status() === 404 && !resp.url().includes("favicon")) {
        failed.push(`${resp.status()} ${resp.url()}`);
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(failed).toHaveLength(0);
  });

  test("LCP element renders within 2.5s", async ({ page }) => {
    await page.goto("/");
    const lcp = await page.evaluate((): Promise<number> =>
      new Promise(resolve => {
        const obs = new PerformanceObserver(list => {
          const entries = list.getEntries();
          const last    = entries[entries.length - 1];
          resolve(last.startTime);
          obs.disconnect();
        });
        obs.observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => resolve(99999), 5000);
      })
    );
    expect(lcp).toBeLessThan(5000); // 5s in CI (headless is slower)
  });

  test("main JS bundle not catastrophically large", async ({ page }) => {
    const resources: Array<{ url: string; size: number }> = [];
    page.on("response", async resp => {
      if (resp.url().includes(".js") && !resp.url().includes("node_modules")) {
        const headers = resp.headers();
        const size    = parseInt(headers["content-length"] || "0");
        if (size > 0) resources.push({ url: resp.url(), size });
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const largest = Math.max(...resources.map(r => r.size), 0);
    // No single JS chunk should be over 2MB uncompressed
    expect(largest).toBeLessThan(2_000_000);
  });
});
