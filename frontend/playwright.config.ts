import { defineConfig, devices } from '@playwright/test';

// Real browser e2e tests, run against a dedicated backend+frontend pair pointed at the
// isolated test database (backend/.env.test, the same postgres-test Docker service used by
// the backend's own supertest e2e suite) — never the real dev/production database.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:8086',
    trace: 'retain-on-failure',
    // Feature 22: a brand-new user gets the interactive guide opened automatically. Every spec that
    // registers a fresh user would then be blocked by its overlay, so auto-start is switched off for
    // the suite; interactive-guide.spec.ts clears this to test the real first-run behaviour.
    storageState: {
      cookies: [],
      origins: [{ origin: 'http://localhost:8086', localStorage: [{ name: 'guide-auto-start-off', value: '1' }] }],
    },
  },
  webServer: [
    {
      command: 'npm run start:e2e --prefix ../backend',
      url: 'http://localhost:5006',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run web:e2e',
      url: 'http://localhost:8086',
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
