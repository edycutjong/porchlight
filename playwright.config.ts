import { defineConfig, devices } from '@playwright/test'

// E2E runs against the real dashboard. No API key required: the curated changes replay
// verdicts the real Mind already produced, and each browser context gets its own session.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // keep specs serial so the shared dev server stays predictable
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
    // Plain `npm start`: the server serves the PINNED src/demoSeed.json, and re-seeding
    // would rewrite .data/ with fresh UUIDs that no captured verdict is keyed to.
    command: 'npm start',
    url: 'http://localhost:5173/api/state',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
