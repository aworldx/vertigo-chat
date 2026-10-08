import assert from "node:assert/strict"
import { expect, type Browser } from "@playwright/test"

export async function verifyHistorySummary(browser: Browser, origin: string) {
  const context = await browser.newContext({ locale: "ru-RU" })
  try {
    const page = await context.newPage()
    for (const signedIn of [false, true]) {
      if (signedIn) {
        await page.goto(`${origin}/account`)
        await page.locator("#react-account-nickname").fill("fixture07")
        await page.locator("#react-account-password").fill("secret123")
        await page.locator("#react-account-submit").click()
        await expect(page.locator("#forum-email")).toBeVisible()
      }
      await page.goto(`${origin}/history`)
      await page.reload()
      await expect(page.locator("#history-search")).toBeVisible()
      await expect(page.locator("#history-summarize")).toHaveCount(0)
      await expect(page.locator("#message-history-page")).not.toContainText("AI-саммари")
      const denied = await page.evaluate(async () => {
        const response = await fetch("/api/v1/chat/history/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
        return { status: response.status, body: await response.text() }
      })
      assert.equal(denied.status, 503)
      assert.match(denied.body, /summary_unavailable/)
      await page.locator("#history-author").fill("NoSuchAuthor")
      await page.locator("#history-search").click()
      await expect(page.getByText("За этот период сообщений нет.", { exact: false })).toBeVisible()
    }
  } finally {
    await context.close()
  }
}
