import assert from "node:assert/strict"
import { expect, type Browser } from "@playwright/test"
import { chatHelp } from "../src/shared/chatHelp"
export async function verifyChatGuide(browser: Browser, origin: string) {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    await page.goto(`${origin}/help#chat-guide`)
    await expect(page.locator("#chat-guide-topics details")).toHaveCount(Object.keys(chatHelp).length)
    await page.getByLabel("Найти инструкцию").fill("ютуб")
    await expect(page.locator("#chat-guide-topics details")).toHaveCount(1)
    await page.locator("#help-topic-video summary").click()
    await expect(page.locator("#help-topic-video p")).toBeVisible()
    await expect(page.locator("#help-topic-video p")).toHaveText(chatHelp.video.body)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width)
    await page
      .locator("#chat-guide")
      .screenshot({ path: `migration-results/community/${String(width)}-chat-guide.png` })
    await context.close()
  }
}
