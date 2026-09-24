import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { expect, type Page } from "@playwright/test"
import { PNG } from "pngjs"
import { launchBrowser } from "./coverage"
import { galleryFlows, libraryFlows, adminFlows } from "./community-flows"
import { uploadAndModerate, failureRecovery } from "./community-mutations"
import { articlesWithoutJS } from "./community-articles"
const [origin, legacy, ...databases] = process.argv.slice(2)
assert.ok(origin && legacy && databases.length === 2)
for (const database of databases) assert.match(new URL(database).pathname, /^\/chat_coverage_web_[ab]_\d+$/)
const output = "migration-results/community"
await mkdir(output, { recursive: true })
const png = new PNG({ width: 480, height: 560 })
for (let y = 0; y < 560; y++)
  for (let x = 0; x < 480; x++) {
    const i = (y * 480 + x) * 4
    png.data.set([30 + Math.floor(x / 3), 45 + Math.floor(y / 4), 90, 255], i)
  }
const bytes = PNG.sync.write(png)
await writeFile(output + "/photo.png", bytes)
const emoji = new PNG({ width: 32, height: 32 })
emoji.data.fill(255)
await writeFile(output + "/emoji.png", PNG.sync.write(emoji))
function sql(command: string) {
  for (const db of databases)
    execFileSync("psql", [db, "-v", "ON_ERROR_STOP=1", "-q", "-c", command], { stdio: "pipe" })
}
function fixtures(populated: boolean) {
  sql(
    "TRUNCATE gallery_photos,library_articles,emojis,emoji_tags RESTART IDENTITY CASCADE; UPDATE registered_users SET public_message_count=200,chat_seconds=72000,is_admin=(nickname='fixture01'),can_moderate_emojis=(nickname='fixture02');",
  )
  if (populated)
    sql(
      `INSERT INTO gallery_photos(user_id,caption,image,content_type,inserted_at,updated_at) SELECT id,'Осенний вечер',decode('${bytes.toString("hex")}','hex'),'image/png','2026-09-01','2026-09-01' FROM registered_users WHERE nickname IN ('fixture01','fixture02'); INSERT INTO library_articles(user_id,title,body,series,part_number,inserted_at,updated_at) SELECT id,'Первая история','${"Тихий вечер в читальном зале. ".repeat(20)}','Хроники Vertigo',1,'2026-09-01','2026-09-01' FROM registered_users WHERE nickname='fixture01'; INSERT INTO library_articles(user_id,title,body,series,part_number,inserted_at,updated_at) SELECT id,'Продолжение','Короткая история.','Хроники Vertigo',2,'2026-09-02','2026-09-02' FROM registered_users WHERE nickname='fixture01';`,
    )
}

const browser = await launchBrowser({ headless: true })
try {
  await articlesWithoutJS(browser, origin)
  const first = await browser.newContext(),
    second = await browser.newContext()
  const oldPage = await first.newPage(),
    newPage = await second.newPage()
  const ready = async (page: Page, base: string, path: string) => {
    await page.goto(base + path)
    await expect(page.locator("#root")).not.toBeEmpty()
  }
  const compare = (scenario: string) => {
    console.log("Functional scenario:", scenario)
    return Promise.resolve()
  }
  const pair = { oldPage, newPage, origin, legacy, ready, compare, legacyPhoenix: false }
  fixtures(false)
  for (const page of [oldPage, newPage]) {
    const base = page === oldPage ? legacy : origin
    for (const route of ["gallery", "library"]) {
      await ready(page, base, "/" + route)
      await expect(page.locator(`#${route}-empty`)).toBeVisible()
    }
  }
  fixtures(true)
  for (const page of [oldPage, newPage]) {
    const base = page === oldPage ? legacy : origin
    for (const route of [
      "/articles",
      "/articles/chats-vs-messengers",
      "/articles/chat-platforms-russia",
      "/articles/how-vertigo-chat-works",
      "/help",
      "/ranks",
      "/visits",
      "/music-chart",
    ]) {
      await ready(page, base, route)
      await expect(page.locator("h1").first()).toBeVisible()
    }
  }
  await galleryFlows(pair)
  await libraryFlows(pair)
  await adminFlows(pair)
  await uploadAndModerate(pair)
  await failureRecovery(pair)
  await first.close()
  await second.close()
} finally {
  await browser.close()
}
