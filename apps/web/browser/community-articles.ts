import assert from "node:assert/strict"
import type { Browser } from "@playwright/test"
import { expect } from "@playwright/test"
export async function articlesWithoutJS(browser: Browser, origin: string) {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  for (const path of [
    "/articles",
    "/articles/chats-vs-messengers",
    "/articles/chat-platforms-russia",
    "/articles/how-vertigo-chat-works",
  ]) {
    const response = await page.goto(origin + path)
    assert.equal(response?.status(), 200)
    await expect(page.locator("h1")).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", origin + path)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow")
  }
  await context.close()
}
