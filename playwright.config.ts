import { defineConfig, devices } from "@playwright/test";

/**
 * QA suite for the Anything Piano library. Runs against the dev server on :3000
 * (reused if it's already running) and a REAL Supabase project, so tests run
 * serially and clean up every song they create. See tests/README.md.
 */
export default defineConfig({
  testDir: "./tests",
  // Vitest owns src/**/*.test.ts; Playwright only runs the e2e specs here.
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: "tests/.results",
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
