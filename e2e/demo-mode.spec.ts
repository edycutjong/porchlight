import { test, expect } from '@playwright/test'

// Smoke: the dashboard loads and renders with no API key (MOCK mode), no console errors.
test('dashboard loads in demo mode and renders the churn board', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.goto('/')

  await expect(page).toHaveTitle(/Porchlight/i)

  // Mode badge is populated (MOCK offline, or LIVE if a key is set).
  const mode = page.locator('#mode')
  await expect(mode).toHaveText(/MOCK|LIVE/)

  // The churn board rendered at least one reason bar from the seeded ledger.
  await expect(page.locator('#reasons .bar').first()).toBeVisible()

  // Recovered-MRR tile is present.
  await expect(page.locator('#mrr')).toBeVisible()

  expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0)
})
