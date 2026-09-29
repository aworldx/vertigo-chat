import assert from "node:assert/strict"
import { expect, type Browser, type Page } from "@playwright/test"

async function piecePosition(page: Page) {
  return page.locator(".tetris-mine canvas").evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext("2d")
    if (!context) throw new Error("Missing canvas context")
    let sum = 0,
      count = 0
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 10; x++) {
        const [r = 0, g = 0, b = 0] = context.getImageData(x * 24 + 12, y * 24 + 12, 1, 1).data
        if (Math.max(r, g, b) > 100 && Math.max(r, g, b) - Math.min(r, g, b) > 25) {
          sum += x
          count++
        }
      }
    }
    return count ? sum / count : -1
  })
}

export async function verifyFirstSoloWindow(browser: Browser, origin: string, screenshots: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  try {
    const page = await context.newPage()
    await page.goto(origin)
    await page.locator("#entrance-nickname").fill("first-solo-window")
    await page.locator("#enter-chat").click()
    await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
    // A background opener may stop producing animation frames while the popup stays visible.
    await page.evaluate(() => {
      window.requestAnimationFrame = () => 0
    })
    const opened = page.waitForEvent("popup")
    await page.locator("#message-body").fill("/тетрис соло")
    await page.locator("#send-message").click()
    const popup = await opened
    await expect(popup.locator("#tetris-pause")).toBeVisible({ timeout: 10000 })
    await expect.poll(() => piecePosition(popup)).toBeGreaterThanOrEqual(0)
    const before = await piecePosition(popup)
    await popup.locator("#tetris-keyboard").focus()
    await popup.keyboard.press("ArrowRight")
    await expect.poll(() => piecePosition(popup)).toBeGreaterThan(before)
    await popup.keyboard.press("KeyP")
    await expect(popup.locator(".tetris-match-state")).toHaveText("Пауза")
    await popup.setViewportSize({ width: 520, height: 760 })
    await expect.poll(() => piecePosition(popup)).toBeGreaterThanOrEqual(0)
    const box = await popup.locator(".tetris-mine canvas").boundingBox()
    assert.ok(box && box.width > 100 && box.height > 200)
    await popup.screenshot({ path: `${screenshots}/first-solo-window.png` })
    await popup.close({ runBeforeUnload: true })
    await expect(page.locator(".tetris-match-state")).toHaveText("Пауза")
    await expect.poll(() => piecePosition(page)).toBeGreaterThanOrEqual(0)
  } finally {
    await context.close()
  }
}
