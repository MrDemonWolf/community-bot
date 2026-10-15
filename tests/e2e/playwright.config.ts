import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 30_000 },
  outputDir: "../../test-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-webkit", grep: /mobile setup/, use: { ...devices["iPhone 13"] } },
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "on",
    navigationTimeout: 180_000,
  },
});
