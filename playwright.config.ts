import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a real `next start` server backed by a dedicated
 * SQLite file (prisma/e2e.db) seeded with demo data — see
 * package.json's `test:e2e` script for the migrate/seed/build/start
 * sequence. Not run against `next dev` to avoid HMR flakiness.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3801",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "cross-env DATABASE_URL=file:./prisma/e2e.db AUTH_SECRET=e2e-test-secret next start -p 3801",
    url: "http://localhost:3801/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
