import assert from "node:assert/strict"
import { mkdir, readFile } from "node:fs/promises"
import { expect, type Browser, type Page } from "@playwright/test"

async function enter(page: Page, origin: string, nickname: string) {
  await page.goto(origin)
  await page.locator("#entrance-nickname").fill(nickname)
  await page.locator("#enter-chat").click()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
}
async function enablePlayer(page: Page) {
  await page.locator("#toggle-settings").click()
  await page.locator("#use-player").check()
  await page.locator("#save-preferences").click()
  await expect(page.locator("#settings-modal")).toHaveCount(0)
}

export async function verifyChartQueue(browser: Browser, origin: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ru-RU" })
  try {
    const tracks = [3, 1, 2].map((id) => ({
      id,
      title: `Трек хит-парада ${String(id)}`,
      author: "Автор",
      own: false,
      liked: false,
      likes_count: 10 - id,
      comments: [],
    }))
    let empty = false
    await context.route("**/api/v1/music-chart", (route) => route.fulfill({ json: { data: empty ? [] : tracks } }))
    const media = await readFile(new URL("./fixtures/player.webm", import.meta.url))
    await context.route("**/music-chart/tracks/*", (route) => route.fulfill({ body: media, contentType: "audio/webm" }))
    const chat = await context.newPage()
    await enter(chat, origin, "chart-queue-owner")
    const other = await context.newPage()
    await enter(other, origin, "chart-queue-other")
    await enablePlayer(other)
    const popup = chat.waitForEvent("popup")
    await chat.locator('a[href="/music-chart"]').first().click()
    const chart = await popup
    const add = chart.locator("#music-chart-enqueue-all")
    const notice = chart.locator("#music-chart-queue-notice")
    await expect(add).toBeEnabled()
    await add.click()
    await expect(notice).toContainText("Включи «Использовать плеер»")
    await enablePlayer(chat)
    await add.click()
    await expect(notice).toContainText("Треки добавлены")
    await chat.locator("#chat-tv-expand").click()
    const queue = chat.locator("#chat-tv-queue li")
    await expect(queue).toHaveCount(3)
    await expect(chat.locator(".chat-tv-queue-title")).toHaveText(tracks.map((track) => `${track.title}Музыка · Автор`))
    await expect(other.locator("#chat-tv-queue li")).toHaveCount(0)
    await expect(chat.locator(".chat-tv-title")).toHaveText("Выбери музыку или видео")
    await add.click()
    await expect(notice).toContainText("Треки добавлены")
    await expect(queue).toHaveCount(3)
    await chat.locator(".chat-tv-queue-title").first().click()
    await expect(chat.locator(".chat-tv-title")).toHaveText("Трек хит-парада 3")
    await expect(queue).toHaveCount(2)
    await add.click()
    await expect(notice).toContainText("Треки добавлены")
    await expect(queue).toHaveCount(2)
    await expect(chat.locator(".chat-tv-title")).toHaveText("Трек хит-парада 3")
    await expect(other.locator("#messages")).not.toContainText("Трек хит-парада")
    await mkdir("migration-results/chart-queue", { recursive: true })
    await chart.screenshot({ path: "migration-results/chart-queue/1440.png" })
    await chart.setViewportSize({ width: 390, height: 844 })
    await add.scrollIntoViewIfNeeded()
    const box = await add.boundingBox()
    assert.ok(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= 390)
    assert.equal(await chart.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await chart.screenshot({ path: "migration-results/chart-queue/390.png" })
    await chat.setViewportSize({ width: 390, height: 844 })
    await add.click()
    await expect(notice).toContainText("на компьютере")
    await chat.locator("#leave-chat").click()
    await expect(chat.locator("#chat-room")).toHaveCount(0)
    await add.click()
    await expect(notice).toContainText("Не удалось связаться с плеером")
    empty = true
    await expect(add).toBeDisabled()
    await other.locator("#leave-chat").click()
  } finally {
    await context.close()
  }
}
