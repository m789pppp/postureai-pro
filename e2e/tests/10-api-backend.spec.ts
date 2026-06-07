/**
 * 10-api-backend.spec.ts — Backend API Contract Tests
 * Tests the actual Flask API endpoints directly.
 */
import { test, expect } from "@playwright/test";

const API = process.env.E2E_API_URL || "http://localhost:5050/api";

test.describe("Backend API", () => {
  test("GET /health returns ok", async ({ request }) => {
    const resp = await request.get(`${API}/health`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("timestamp");
  });

  test("GET /health returns firebase status", async ({ request }) => {
    const resp = await request.get(`${API}/health`);
    const body = await resp.json();
    expect(body).toHaveProperty("firebase");
  });

  test("POST /waitlist/join accepts valid email", async ({ request }) => {
    const resp = await request.post(`${API}/waitlist/join`, {
      data: {
        email:    `test_${Date.now()}@playwright.test`,
        name:     "Playwright Test",
        company:  "Test Corp",
        use_case: "E2E testing",
      },
    });
    expect([200, 201, 429]).toContain(resp.status()); // 429 if rate-limited
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body.success).toBe(true);
    }
  });

  test("POST /waitlist/join rejects invalid email", async ({ request }) => {
    const resp = await request.post(`${API}/waitlist/join`, {
      data: { email: "not-an-email", name: "Test" },
    });
    expect([400, 422]).toContain(resp.status());
  });

  test("POST /contact/enterprise accepts form submission", async ({ request }) => {
    const resp = await request.post(`${API}/contact/enterprise`, {
      data: {
        name:     "Playwright Test",
        email:    `e2e_${Date.now()}@test.com`,
        company:  "Test Corp",
        message:  "E2E automated test submission",
        employees: "50-200",
      },
    });
    expect([200, 201, 429]).toContain(resp.status());
  });

  test("GET /announcements without token returns 401", async ({ request }) => {
    const resp = await request.get(`${API}/announcements`);
    expect([401, 403]).toContain(resp.status());
  });

  test("GET /feature-flags without token returns 401", async ({ request }) => {
    const resp = await request.get(`${API}/feature-flags`);
    expect([401, 403]).toContain(resp.status());
  });

  test("GET /security/overview without token returns 401", async ({ request }) => {
    const resp = await request.get(`${API}/security/overview`);
    expect([401, 403]).toContain(resp.status());
  });

  test("POST /analyze without token returns 401", async ({ request }) => {
    const resp = await request.post(`${API}/analyze`, {
      data: { frame_b64: "data:image/jpeg;base64,abc", uid: "test" },
    });
    expect([401, 403]).toContain(resp.status());
  });

  test("POST /auth/mfa/totp/setup without token returns 401", async ({ request }) => {
    const resp = await request.post(`${API}/auth/mfa/totp/setup`);
    expect([401, 403]).toContain(resp.status());
  });

  test("GET /admin/feature-flags without token returns 401", async ({ request }) => {
    const resp = await request.get(`${API}/admin/feature-flags`);
    expect([401, 403]).toContain(resp.status());
  });
});
