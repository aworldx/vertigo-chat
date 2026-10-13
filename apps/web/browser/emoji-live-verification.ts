import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { expect } from "@playwright/test"
import { launchBrowser } from "./coverage"
import { wideEmojiImage } from "./fixtures/emoji-wide"

const origin = process.argv[2] ?? "http://127.0.0.1:4080"
const database = process.env.EMOJI_LIVE_DATABASE_URL
assert.ok(database)
assert.equal(new URL(database).pathname, "/emoji_test", "only the dedicated disposable fixture DB is allowed")
const bytes = wideEmojiImage
execFileSync("psql", [
  database,
  "-v",
  "ON_ERROR_STOP=1",
  "-q",
  "-c",
  `INSERT INTO emojis(code,image,content_type,inserted_at,updated_at,status,width,height) VALUES ('livewide',decode('${bytes.toString("hex")}','hex'),'image/png',now(),now(),'approved',78,24) ON CONFLICT (code) DO NOTHING`,
])
const browser = await launchBrowser({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(origin)
  await page.locator("#entrance-nickname").fill(`emoji-${String(Date.now())}`)
  await page.locator("#enter-chat").click()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  await page.locator("#toggle-emoji-picker").click()
  await page.locator("[data-emoji-code='-livewide-']").click()
  await expect(page.locator("#message-body")).toHaveValue("-livewide-")
  const marker = `Проверка ${String(Date.now())}`
  const body = `${marker} -livewide- рядом с текстом`
  await page.locator("#message-body").fill(body)
  await page.locator("#send-message").click()
  const message = page.locator("#messages [data-message-kind='text']").filter({ hasText: marker })
  await expect(message).toHaveCount(1)
  await expect(message.locator('[data-delivery-state="published"]')).toBeAttached()
  await page.reload()
  await expect(message).toHaveCount(1)
  const image = message.locator("img[alt='-livewide-']")
  await expect(image).toBeVisible()
  const box = await image.boundingBox()
  assert.ok(box)
  assert.equal(box.width, 78)
  assert.equal(box.height, 24)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.deepEqual(errors, [])
  await page.screenshot({ path: "/tmp/emoji-design/live-postgres-mobile.png" })
  await context.close()
} finally {
  await browser.close()
}
console.log("Live Go/PostgreSQL emoji: palette, insert, publish, reload, 78×24 and mobile overflow passed")
