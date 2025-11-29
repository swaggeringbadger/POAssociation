import { defineConfig, devices } from '@playwright/test';

/**
 * Simplified Playwright Config for Replit/CI Environments
 * Runs only on Chromium with minimal configuration
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false, // Run sequentially to avoid resource issues
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker for Replit
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:5000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Only Chromium for simplicity
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
  ],

  // Don't start server automatically - assume it's running
  webServer: undefined,
});
