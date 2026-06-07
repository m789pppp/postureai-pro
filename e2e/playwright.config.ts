import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir:      "./tests",
  timeout:      45_000,
  retries:      process.env.CI ? 2 : 0,
  workers:      process.env.CI ? 2 : 4,
  reporter:     [["html", { outputFolder: "playwright-report" }], ["list"]],
  use: {
    baseURL:       process.env.E2E_BASE_URL || "http://localhost:5173",
    trace:         "on-first-retry",
    screenshot:    "only-on-failure",
    video:         "retain-on-failure",
    locale:        "en-US",
    timezoneId:    "Africa/Cairo",
    viewport:      { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use:  { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use:  { ...devices["Desktop Firefox"] },
    },
    {
      name: "mobile-safari",
      use:  { ...devices["iPhone 14"] },
    },
    {
      name: "rtl-arabic",
      use:  { ...devices["Desktop Chrome"], locale: "ar-EG" },
    },
  ],
});
