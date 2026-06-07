import { Page, expect } from "@playwright/test";

export class AuthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/");
    // Wait for landing or app to load
    await this.page.waitForLoadState("networkidle");
  }

  async clickGetStarted() {
    await this.page.getByRole("button", { name: /start free|get started|ابدأ/i }).first().click();
  }

  async fillEmail(email: string) {
    await this.page.getByPlaceholder(/email/i).fill(email);
  }

  async fillPassword(password: string) {
    await this.page.getByPlaceholder(/password|كلمة/i).fill(password);
  }

  async submitLogin() {
    await this.page.getByRole("button", { name: /sign in|login|تسجيل/i }).click();
  }

  async login(email: string, password: string) {
    await this.clickGetStarted();
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submitLogin();
    // Wait for dashboard to appear
    await expect(this.page.getByText(/dashboard|session|analyze/i).first()).toBeVisible({ timeout: 15000 });
  }

  async expectLoginError() {
    await expect(this.page.getByText(/invalid|incorrect|error|خطأ/i).first()).toBeVisible({ timeout: 8000 });
  }
}
