import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdir } from "node:fs/promises"
import { chromium, expect, type Page } from "@playwright/test"
import { PNG } from "pngjs"

const [originArgument, databaseArgument] = process.argv.slice(2)
assert.ok(originArgument && databaseArgument)
const origin = originArgument
const database = databaseArgument
assert.match(new URL(database).pathname, /^\/chat_rank_limits_\d+$/)
const output = "migration-results/rank-limits"
await mkdir(output, { recursive: true })
function sql(command: string) {
  execFileSync("psql", [database, "-v", "ON_ERROR_STOP=1", "-q", "-c", command], { stdio: "pipe" })
}
const picture = new PNG({ width: 80, height: 60 })
picture.data.fill(190)
const photo = { name: "rank.png", mimeType: "image/png", buffer: PNG.sync.write(picture) }
const audio = { name: "rank.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("ID3-rank-fixture") }
const browser = await chromium.launch({ headless: true })
async function ready(page: Page, route: string) {
  await page.goto(origin + route)
  await expect(page.locator("h1").first()).toBeVisible()
  await page.reload()
  await expect(page.locator("h1").first()).toBeVisible()
}
async function signIn(page: Page) {
  await page.goto(origin + "/account/login")
  await page.locator("#react-account-nickname").fill("fixture01")
  await page.locator("#react-account-password").fill("secret123")
  await page.locator("#react-account-login-form button[type=submit]").click()
  await expect(page.locator("#site-account-nickname")).toHaveText("fixture01")
}
async function addPhoto(page: Page, title: string) {
  await page.locator("#gallery-photo-caption").fill(title)
  await page.locator("#gallery-upload-form input[type=file]").setInputFiles(photo)
  await page.locator("#upload-gallery-photo").click()
}
async function addArticle(page: Page, title: string, width: number) {
  await page.locator("#new-library-article").click()
  await page.locator("#article_title").fill(title)
  await page.locator("#article_body").fill("Текст статьи для проверки лимитов звания.")
  await page.locator(width < 1024 ? "#save-library-article-mobile" : "#save-library-article").click()
}
async function addTrack(page: Page, title: string) {
  await page.locator("#music-chart-title").fill(title)
  await page.locator("#music-chart-audio").setInputFiles(audio)
  await page.locator("#upload-music-track").click()
}
const resources = [
  { route: "/gallery", cards: "#gallery-photos figure", text: "фотографий", add: addPhoto },
  { route: "/library", cards: "#library-articles article", text: "статей", add: addArticle },
  { route: "/music-chart", cards: "#music-chart-tracks article", text: "треков", add: addTrack },
]
try {
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
  ] as const) {
    sql(
      "TRUNCATE gallery_photos,library_articles,music_chart_tracks RESTART IDENTITY CASCADE; UPDATE registered_users SET public_message_count=0,chat_seconds=0;",
    )
    const context = await browser.newContext({ viewport: { width, height } })
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await ready(page, "/help")
    await expect(page.locator("#rank-1")).toContainText("хит-парад — 1, статьи — 1, фото — 1")
    await expect(page.locator("#rank-10")).toContainText("хит-парад — 50, статьи — 50, фото — 50")
    await page.locator("#help-topic-ranks summary").click()
    await expect(page.locator("#help-topic-ranks")).toContainText("1 → 2 → 3 → 5 → 8 → 12 → 18 → 25 → 35 → 50")
    await ready(page, "/gallery")
    await expect(page.locator("#gallery-upload-form")).toHaveCount(0)
    await ready(page, "/library")
    await expect(page.locator("#new-library-article")).toHaveCount(0)
    await signIn(page)
    for (const resource of resources) {
      await ready(page, resource.route)
      await resource.add(page, "Первый материал", width)
      await expect(page.locator(resource.cards)).toHaveCount(1)
      await expect(page.locator(resource.cards)).toContainText("Первый материал")
      await page.reload()
      await expect(page.locator(resource.cards)).toHaveCount(1)
      await resource.add(page, "Лишний материал", width)
      const error = page.getByRole("alert").filter({ hasText: `Достигнут общий лимит ${resource.text}` })
      await expect(error).toBeVisible()
      await error.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${output}/${String(width)}-${resource.text}-limit.png` })
      await page.reload()
      await expect(page.locator(resource.cards)).toHaveCount(1)
    }
    // One threshold alone must not increase capacity.
    sql("UPDATE registered_users SET public_message_count=50 WHERE nickname='fixture01';")
    await ready(page, "/music-chart")
    await addTrack(page, "Пока рано")
    await expect(page.locator("#music-chart-error")).toContainText("Достигнут общий лимит")
    sql("UPDATE registered_users SET chat_seconds=18000 WHERE nickname='fixture01';")
    for (const resource of resources) {
      await ready(page, resource.route)
      await resource.add(page, "После повышения", width)
      await expect(page.locator(resource.cards)).toHaveCount(2)
      await expect(page.locator(resource.cards).first()).toContainText("После повышения")
      await page.reload()
      await expect(page.locator(resource.cards)).toHaveCount(2)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `${output}/${String(width)}-${resource.text}-promoted.png` })
    }
    assert.deepEqual(errors, [])
    await context.close()
    console.log(
      `PASS ${String(width)}×${String(height)}: direct/reload, guest access, three writes, quota rejection, both thresholds, promotion, persistence, no overflow`,
    )
  }
} finally {
  await browser.close()
}
