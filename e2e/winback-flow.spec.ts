import { test, expect } from '@playwright/test'

// Core journey: the creator announces a change → the Mind autonomously wins back the
// members whose reason it resolves, quoting their own words, and recovered MRR ticks up.
//
// The curated buttons replay verdicts the REAL Mind produced (src/liveCache.json), so this
// exercises genuine model output without needing credentials or waiting on a live turn.
test('announcing a resolved change triggers autonomous win-backs quoting own words', async ({ page }) => {
  await page.goto('/')

  // The curated changes are rendered from the captured cache.
  const curated = page.locator('#curated button')
  await expect(curated.first()).toBeVisible()
  await curated.first().click()

  // At least one win-back card appears in the feed.
  const cards = page.locator('#feed .wb')
  await expect(cards.first()).toBeVisible()

  // The Mind quotes the member's own words back to them (recall) — real drafts wrap the
  // member's phrasing in quotes rather than using any fixed template.
  await expect(page.locator('#feed .wb .msg').first()).toContainText(/["“”]/)

  // Recovered MRR is no longer zero — the ROI metric moved.
  await expect(page.locator('#mrr')).not.toHaveText('$0.00')

  // The audit trail recorded the change the Mind acted on.
  await expect(page.locator('#audit .bar').first()).toBeVisible()
})

// The product thesis, asserted: at least one recovered member is one a keyword matcher
// would never have contacted. If this ever stops being true the differentiation is gone.
test('at least one win-back is one only the semantic match could find', async ({ page }) => {
  await page.goto('/')
  await page.locator('#curated button').first().click()
  await expect(page.locator('#feed .wb').first()).toBeVisible()
  await expect(page.getByText(/semantic-only · keywords miss/i).first()).toBeVisible()
})

// Each visitor must get their own demo. Before per-session state, one person announcing a
// change rewrote the board for everyone who arrived after them.
test('a second visitor starts from a clean board', async ({ browser }) => {
  const first = await browser.newContext()
  const pageA = await first.newPage()
  await pageA.goto('/')
  await pageA.locator('#curated button').first().click()
  await expect(pageA.locator('#feed .wb').first()).toBeVisible()
  await expect(pageA.locator('#mrr')).not.toHaveText('$0.00')

  const second = await browser.newContext() // new context = new cookie jar = new session
  const pageB = await second.newPage()
  await pageB.goto('/')
  await expect(pageB.locator('#mrr')).toHaveText('$0.00')

  await first.close()
  await second.close()
})
