import { defineConfig, devices } from '@playwright/test'

// E2E runs against the real dashboard in MOCK mode — no API key required.
// The web server seeds a fresh ledger, then serves the churn board on :5173.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // the app has a single shared JSON store; keep specs serial
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run start:demo',
    url: 'http://localhost:5173/api/state',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
