import assert from "node:assert/strict"
import { chromium, expect } from "@playwright/test"
const origin = process.argv[2]
assert.ok(origin)
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(origin)
  await page.locator("#entrance-nickname").fill("media-live-reader")
  await page.locator("#enter-chat").click()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  const command = async (body: string) => {
    await page.locator("#message-body").fill(body)
    await page.locator("#send-message").click()
  }
  await command("/музыка Radiohead")
  const results = page.locator("#media-search-results")
  await expect(results.locator("audio")).toHaveCount(5, { timeout: 45000 })
  await expect
    .poll(() =>
      page.locator("#messages").evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop),
    )
    .toBeLessThanOrEqual(1)
  await results.getByRole("button", { name: "2", exact: true }).click()
  await expect(results.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-current", "page")
  await results.getByRole("button", { name: "1", exact: true }).click()
  const audio = results.locator("audio").first()
  await audio.evaluate(async (element) => {
    if (element instanceof HTMLAudioElement) await element.play()
  })
  await expect
    .poll(() => audio.evaluate((element) => element instanceof HTMLAudioElement && element.currentTime > 0), {
      timeout: 30000,
    })
    .toBe(true)
  await expect(page.locator('[data-peer-nickname="media-live-reader"] [id^="listening-chatlan-"]')).toBeVisible()
  await audio.evaluate((element) => {
    if (element instanceof HTMLAudioElement) element.pause()
  })
  await results.getByRole("button", { name: "В чат", exact: true }).first().click()
  await expect(page.locator('[data-message-kind="music"]')).toHaveCount(1)
  await results.getByRole("button", { name: "Закрыть поиск музыки" }).click()
  await command("/гиф hello")
  await expect(results.locator('button[id^="gif-result-"]')).toHaveCount(12, { timeout: 20000 })
  await results.locator('button[id^="gif-result-"]').first().click()
  const gif = page.locator('[data-message-kind="gif"] img')
  await expect
    .poll(
      () =>
        gif.evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0),
      { timeout: 30000 },
    )
    .toBe(true)
  await results.getByRole("button", { name: "Закрыть поиск GIF" }).click()
  await command("/ютуб https://youtu.be/jNQXAC9IVRw")
  const videoMessage = page.locator('[data-message-kind="youtube"]')
  await expect(videoMessage).toBeVisible({ timeout: 35000 })
  await videoMessage.getByRole("button", { name: "Воспроизвести", exact: true }).click()
  await expect(videoMessage.getByRole("status")).toContainText("Подготавливаю")
  await expect
    .poll(
      () =>
        videoMessage
          .locator("video")
          .evaluate((element) => element instanceof HTMLVideoElement && element.currentTime > 0),
      { timeout: 145000 },
    )
    .toBe(true)
  await page.locator("#leave-chat").click()
  await expect(page).toHaveURL(`${origin}/`)
  console.log(
    "Live media passed: proxied music search/pagination/playback/listening, GIF search/publication/image load, YouTube direct-link preparation/publication/playback",
  )
} finally {
  await browser.close()
}
