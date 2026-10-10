import assert from "node:assert/strict"
import { chromium, expect } from "@playwright/test"
import { articlesWithoutJS } from "./community-articles"

const origin = process.argv[2]
assert.ok(origin)
const routes = [
  "/articles",
  "/articles/chats-vs-messengers",
  "/articles/chat-platforms-russia",
  "/articles/how-vertigo-chat-works",
]
const browser = await chromium.launch({ headless: true })
try {
  await articlesWithoutJS(browser, origin)
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" })
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    for (const path of routes) {
      assert.equal((await page.goto(origin + path))?.status(), 200)
      await expect(page.locator("h1")).toBeVisible()
      if (path !== "/articles") {
        assert.ok((await page.title()).startsWith(await page.locator("h1").innerText()))
      }
      await page.reload()
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", origin + path)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width)
      const images = page.locator("main img")
      for (const image of await images.all()) {
        await expect(image).toBeVisible()
        await expect
          .poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0))
          .toBe(true)
        assert.ok(await image.getAttribute("alt"))
      }
      for (const anchor of await page.locator('a[href^="#"]').all()) {
        const href = await anchor.getAttribute("href")
        assert.ok(href && href.length > 1)
        await anchor.click()
        await expect(page.locator(href)).toBeInViewport()
      }
      for (const href of await page
        .locator('main a[href^="/"]')
        .evaluateAll((elements) => [...new Set(elements.map((element) => element.getAttribute("href")))])) {
        assert.ok(href)
        assert.equal((await context.request.get(origin + href)).status(), 200, href)
      }
    }
    await page.goto(origin + "/articles")
    for (const route of routes.slice(1)) {
      await page.locator(`a[href="${route}"]`).click()
      await expect(page).toHaveURL(origin + route)
      await page.goBack()
    }
    assert.deepEqual(errors, [])
    await context.close()
    console.log("Articles passed:", viewport.width)
  }
  // Exercise the article's command example; the music provider is a deterministic fixture.
  const context = await browser.newContext()
  let query = ""
  await context.route("**/api/v1/chat/media/music?*", async (route) => {
    query = new URL(route.request().url()).searchParams.get("q") ?? ""
    await route.fulfill({
      json: {
        data: [
          {
            kind: "music",
            title: "Проверка поиска",
            artist: "Кино",
            duration: "3:20",
            url: "https://sunproxy.net/file/article-fixture",
            preview: "",
            source: "fixture",
          },
        ],
      },
    })
  })
  const page = await context.newPage()
  await page.goto(origin)
  await page.locator("#entrance-nickname").fill("Редактор")
  await page.locator("#enter-chat").click()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  await page.locator("#message-body").fill("/музыка Кино")
  await page.locator("#send-message").click()
  await expect(page.locator("#media-search-results")).toContainText("Проверка поиска")
  assert.equal(query, "Кино")
  await expect(page.locator("#messages [data-message-kind=music]").filter({ hasText: "Проверка поиска" })).toHaveCount(
    0,
  )
  await page.locator("#leave-chat").click()
  await context.close()
  console.log("Article music command opened private search with the expected query")
} finally {
  await browser.close()
}
