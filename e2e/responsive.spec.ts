import { test, expect } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

for (const vp of viewports) {
  test(`no horizontal overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto('/')

    // Header is present and the page body never scrolls horizontally.
    await expect(page.locator('header h1')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(1)
  })
}
