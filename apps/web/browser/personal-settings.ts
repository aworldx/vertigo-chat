import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { expect, type Browser, type Page } from "@playwright/test"

async function openSettings(page: Page) {
  await page.locator("#message-body").fill("/настр")
  await page.locator('[data-command="/настройки"]').tap()
  await expect(page.locator("#message-body")).toHaveValue("/настройки")
  await page.locator("#send-message").tap()
  await expect(page.locator("#settings-modal")).toBeVisible()
  await expect(page.locator("#messages")).not.toContainText("/настройки")
}

async function checkLayout(page: Page, width: number, height: number) {
  for (const selector of ["#settings-panel", "#close-settings", "#save-preferences"]) {
    const box = await page.locator(selector).boundingBox()
    assert.ok(box)
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height)
    if (selector !== "#settings-panel") assert.ok(box.width >= 44 && box.height >= 44)
  }
  assert.equal(await page.locator("#settings-content").evaluate((node) => node.scrollWidth > node.clientWidth), false)
}

export async function verifyPersonalSettings(browser: Browser, origin: string) {
  await mkdir("migration-results/settings", { recursive: true })
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      locale: "ru-RU",
    })
    try {
      const page = await context.newPage()
      await page.goto(origin)
      await page.locator("#entrance-nickname").fill(`settings-${String(width)}`)
      await page.locator("#enter-chat").tap()
      await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
      await page.locator("#show-command-menu").tap()
      await expect(page.locator('[data-command="/настройки"]')).toBeVisible()
      await page.locator('[data-command="/настройки"]').tap()
      await page.locator("#send-message").tap()
      await expect(page.locator("#settings-modal")).toBeVisible()
      await checkLayout(page, width, height)
      await page.screenshot({ path: `migration-results/settings/${String(width)}-top.png` })
      await page.locator('label[for="show-typing"]').tap()
      await expect(page.locator("#show-typing")).not.toBeChecked()
      await page.locator("#theme-id").selectOption("vertigo_glass")
      await page.locator("#appearance-colors summary").tap()
      await page.locator("#light-text-color").scrollIntoViewIfNeeded()
      await page.locator("#light-text-color").fill("#234567")
      await checkLayout(page, width, height)
      await page.screenshot({ path: `migration-results/settings/${String(width)}-colors.png` })
      await page.locator("#save-preferences").tap()
      await expect(page.locator("#settings-modal")).toHaveCount(0)
      await page.reload()
      await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
      await openSettings(page)
      await expect(page.locator("#show-typing")).not.toBeChecked()
      await expect(page.locator("#theme-id")).toHaveValue("vertigo_glass")
      await expect(page.locator("#light-text-color")).toHaveValue("#234567")
      await page.locator('label[for="show-typing"]').tap()
      await page.locator("#close-settings").tap()
      await openSettings(page)
      await expect(page.locator("#show-typing")).not.toBeChecked()
      await page.locator("#close-settings").tap()
      await page.locator("#leave-chat").tap()
    } finally {
      await context.close()
    }
  }
}
