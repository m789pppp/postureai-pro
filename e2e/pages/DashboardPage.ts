import { Page, expect } from "@playwright/test";

export class DashboardPage {
  constructor(private page: Page) {}

  async expectLoaded() {
    await expect(this.page.getByText(/posture score|dashboard|session/i).first()).toBeVisible({ timeout: 15000 });
  }

  async startAnalysis() {
    await this.page.getByRole("button", { name: /start|analyze|camera|ابدأ/i }).first().click();
  }

  async openPricing() {
    await this.page.getByRole("button", { name: /pricing|upgrade|plans/i }).first().click();
  }

  async openAdmin() {
    await this.page.getByRole("button", { name: /admin|🛡/i }).first().click();
    await expect(this.page.getByText(/admin dashboard|tenant/i).first()).toBeVisible({ timeout: 10000 });
  }

  async openHR() {
    await this.page.getByRole("button", { name: /hr|workforce/i }).first().click();
    await expect(this.page.getByText(/hr dashboard|analytics/i).first()).toBeVisible({ timeout: 10000 });
  }

  async switchToArabic() {
    const langBtn = this.page.getByRole("button", { name: /عربي|arabic|ar/i }).first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await expect(this.page.getByText(/ابدأ|لوحة/i).first()).toBeVisible({ timeout: 8000 });
    }
  }
}
