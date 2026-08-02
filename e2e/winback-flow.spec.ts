import { test, expect } from '@playwright/test'

// Core journey: the creator announces a change → the Mind autonomously wins back
// the members whose reason it resolves, quoting their own words, and recovered MRR ticks up.
test('announcing a resolved change triggers autonomous win-backs quoting own words', async ({ page }) => {
  await page.goto('/')

  await page.locator('#change').fill('the deep-dive interviews are back, weekly')
  await page.getByRole('button', { name: /announce change/i }).click()

  // At least one win-back card appears in the feed.
  const cards = page.locator('#feed .wb')
  await expect(cards.first()).toBeVisible()

  // The Mind quotes the member's own words back to them (recall).
  await expect(page.locator('#feed .wb .msg').first()).toContainText(/told me/i)

  // Recovered MRR is no longer zero — the ROI metric moved.
  await expect(page.locator('#mrr')).not.toHaveText('$0.00')

  // The audit trail recorded the change the Mind acted on.
  await expect(page.locator('#audit .bar').first()).toBeVisible()
})
