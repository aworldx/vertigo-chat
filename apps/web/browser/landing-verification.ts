import assert from "node:assert/strict"
import { expect } from "@playwright/test"
import { launchBrowser } from "./coverage"

const origin = process.argv[2]
assert.ok(origin)
const browser = await launchBrowser({ headless: true })
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" })
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    assert.equal((await page.goto(origin))?.status(), 200)
    await expect(page.locator("#landing-section-games")).toContainText("Тетрис")
    await page.reload()
    await expect(page.locator("#landing-section-games")).toContainText("Google Maps")
    await expect(page.locator("#vertigo-landing")).not.toContainText(/Шашки|Морской бой|Дурак|Балда/)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width)

    // Exercise every advertised destination, including anchors and guest access.
    const selectors = await page
      .locator(".landing-directory > a")
      .evaluateAll((links) => links.map((link) => `#${link.id}`))
    selectors.push("#landing-open-games", ".landing-game-links a:first-child", ".landing-game-links a:last-child")
    for (const selector of selectors) {
      await page.goto(origin)
      const link = page.locator(selector)
      const href = await link.getAttribute("href")
      assert.ok(href)
      const destination: URL = new URL(href, origin)
      assert.equal((await context.request.get(destination.href)).status(), 200, href)
      await link.click()
      await expect(page).toHaveURL(destination.href)
      if (destination.hash) {
        await expect(page.locator(destination.hash)).toBeVisible()
        await page.locator(`${destination.hash} > summary`).click()
        await expect(page.locator(destination.hash)).toHaveAttribute("open", "")
      }
    }

    await page.goto(origin)
    await page.locator("#landing-register").click()
    await expect(page.locator("#registration-form")).toBeVisible()
    await page.locator("#show-login").click()
    await expect(page.locator("#entrance-form")).toBeVisible()
    await page.locator("#entrance-nickname").fill(`Гость${String(viewport.width)}л`)
    await page.locator("#enter-chat").click()
    await expect(page).toHaveURL(`${origin}/chat`)
    await expect(page.locator("#message-body")).toBeVisible()
    const message = `Проверка входа с главной ${String(viewport.width)}`
    await page.locator("#message-body").fill(message)
    await page.locator("#send-message").click()
    await expect(page.locator("#messages")).toContainText(message)
    await page.locator("#leave-chat").click()
    assert.deepEqual(errors, [])
    await context.close()
  }
  console.log("Landing: desktop/tablet/mobile destinations, help anchors, registration switch and guest chat passed")
} finally {
  await browser.close()
}
