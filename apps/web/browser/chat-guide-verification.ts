import assert from "node:assert/strict"
import { expect, type Browser } from "@playwright/test"
import { chatHelp } from "../src/shared/chatHelp"
export async function verifyChatGuide(browser: Browser, origin: string) {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    await page.goto(`${origin}/help#chat-guide`)
    await expect(page.locator("#chat-guide-topics > details")).toHaveCount(Object.keys(chatHelp).length)
    await page.getByLabel("Найти инструкцию").fill("ютуб")
    await expect(page.locator("#chat-guide-topics > details")).toHaveCount(1)
    await page.locator("#help-topic-video > summary").click()
    await expect(page.locator("#help-topic-video > .chat-help-content > ul > li")).toHaveCount(3)
    await expect(page.locator("#help-topic-video code").first()).toHaveText("/ютуб название видео")
    await expect(page.locator("#help-topic-video .chat-help-more")).not.toHaveAttribute("open", "")
    await page.locator("#help-topic-video .chat-help-more summary").click()
    await expect(page.locator("#help-topic-video .chat-help-more > p").first()).toBeVisible()
    await page.locator("#help-topic-video .chat-help-more summary").click()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width)
    await page
      .locator("#chat-guide")
      .screenshot({ path: `migration-results/community/${String(width)}-chat-guide.png` })
    await context.close()
  }
}
