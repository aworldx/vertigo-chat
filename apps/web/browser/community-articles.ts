import assert from "node:assert/strict"
import type { Browser } from "@playwright/test"
import { expect } from "@playwright/test"
import type { Pair } from "./community-flows"
export async function technologyArticle(p: Pair, width: number, output: string) {
  const { oldPage, newPage, origin, legacy, ready, compare } = p
  const route = "/articles/how-vertigo-chat-works"
  await ready(oldPage, legacy, route)
  await ready(newPage, origin, route)
  await oldPage.screenshot({ path: `${output}/${String(width)}-technology-old-original.png`, fullPage: true })
  await newPage.screenshot({ path: `${output}/${String(width)}-technology-new-original.png`, fullPage: true })
  await expect(newPage.locator("#article-how-vertigo-chat-works")).toContainText("React")
  // Content intentionally describes the current stack. Isolate unchanged layout using exact legacy copy.
  const before = await oldPage.locator("#article-how-vertigo-chat-works p").allTextContents()
  const after = await newPage.locator("#article-how-vertigo-chat-works p").allTextContents()
  assert.equal(before.length, after.length)
  const changes = before.map((text, i) => ({ text, i })).filter(({ text, i }) => text !== after[i])
  assert.equal(changes.length, 4)
  for (const { text, i } of changes) {
    assert.match(text, /Phoenix|LiveView/)
    assert.match(after[i] ?? "", /Go|React|подключения/)
  }
  for (const { text, i } of changes)
    await newPage
      .locator("#article-how-vertigo-chat-works p")
      .nth(i)
      .evaluate((el, copy) => {
        el.textContent = copy
      }, text)
  await compare("technology-layout")
}
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
