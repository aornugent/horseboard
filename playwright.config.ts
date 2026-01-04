import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for HorseBoard E2E tests
 *
 * Run tests:
 *   npm run test:e2e           - Run all tests
 *   npx playwright test        - Run all tests
 *   npx playwright test --ui   - Open UI mode
 */

export default defineConfig({
  testDir: './tests/e2e',

  // Global setup to clean database before tests
  globalSetup: './tests/e2e/global-setup.ts',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Run tests serially - shared SQLite database prevents parallel execution
  workers: 1,

  // Reporter to use
  reporter: 'html',

  // Shared settings for all the projects below
  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:5173',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'NODE_ENV=test npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
