import { technologyArticle, articlesWithoutJS } from "./community-articles"
import { uploadAndModerate, failureRecovery } from "./community-mutations"
import {
  galleryCornerRoundingOnly,
  libraryCornerRoundingOnly,
  adminCornerRoundingOnly,
  libraryEditorRoundingOnly,
} from "./community-rounding"
import { galleryFlows, libraryFlows, adminFlows } from "./community-flows"
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { chromium, expect, type Page } from "@playwright/test"
import { PNG } from "pngjs"
import { writeDiff } from "./compare-screenshots"
const [origin, legacy] = process.argv.slice(2)
assert.ok(origin && legacy)
const databases = [process.env.GO_ROOM_DATABASE, process.env.LEGACY_ROOM_DATABASE]
for (const db of databases) assert.ok(db && /^chat_web_(go|legacy)_\d+$/.test(db))
const widths = (process.env.COMMUNITY_WIDTHS ?? "390,768,1440").split(",").map(Number)
assert.ok(widths.length > 0 && widths.every((w) => [390, 768, 1440].includes(w)))
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
    execFileSync("psql", [db ?? "", "-v", "ON_ERROR_STOP=1", "-q", "-c", command], { stdio: "pipe" })
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
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] })
const results: { width: number; scenario: string; pixels: number }[] = []
async function ready(page: Page, base: string, path: string) {
  await page.goto(base + path)
  if (base === legacy && !path.startsWith("/admin"))
    await expect(page.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(Array.from(document.images).map((i) => i.decode().catch(() => undefined)))
  })
}
try {
  await articlesWithoutJS(browser, origin)
  for (const width of widths) {
    const options = {
      viewport: { width, height: width === 390 ? 844 : width === 768 ? 1024 : 900 },
      locale: "ru-RU",
      reducedMotion: "reduce" as const,
    }
    const oldContext = await browser.newContext(options),
      newContext = await browser.newContext(options),
      oldPage = await oldContext.newPage(),
      newPage = await newContext.newPage()
    async function compare(scenario: string) {
      for (const p of [oldPage, newPage]) {
        await p.mouse.move(0, 0)
        await p.evaluate(async () => {
          await document.fonts.ready
          await Promise.all(
            document
              .getAnimations()
              .filter((a) => a.effect?.getTiming().iterations !== Infinity)
              .map((a) => a.finished.catch(() => undefined)),
          )
          await new Promise(requestAnimationFrame)
          await new Promise(requestAnimationFrame)
        })
      }
      if (scenario === "library-editor") {
        await oldPage.screenshot({ path: `${output}/${String(width)}-library-editor-old-original.png` })
        // Legacy lacks dialog semantics: the theme's direct-child rule overrides fixed to relative.
        // Preserve the raw evidence, then isolate content/style parity with the same dialog semantics.
        await oldPage.locator("#library-editor").evaluate((el) => {
          el.setAttribute("role", "dialog")
          el.scrollTop = 0
          window.scrollTo(0, 0)
        })
        await newPage.locator("#library-editor").evaluate((el) => {
          el.scrollTop = 0
          window.scrollTo(0, 0)
        })
      }
      if (scenario === "admin-emoji-editor" || scenario === "admin-approved") {
        for (const page of [oldPage, newPage])
          await page.evaluate(() => {
            window.scrollTo(0, 0)
          })
      }
      if (scenario === "admin-database-empty") {
        await oldPage.screenshot({ path: `${output}/${String(width)}-database-old-original.png`, fullPage: true })
        await newPage.screenshot({ path: `${output}/${String(width)}-database-new-original.png`, fullPage: true })
        const extras = [
          "account_sessions",
          "bot_request_receipts",
          "chatlan_preferences",
          "feedback_rate_events",
          "go_schema_migrations",
        ]
        const oldTables = await oldPage.locator("#admin-table-list a").allTextContents(),
          newTables = await newPage.locator("#admin-table-list a").allTextContents()
        assert.deepEqual(newTables.filter((t) => !oldTables.includes(t)).sort(), extras.slice().sort())
        await newPage.locator("#admin-table-list a").evaluateAll((links, names) => {
          for (const link of links) if (names.includes(link.textContent.trim())) link.remove()
        }, extras)
      }
      if (!scenario.includes("editor"))
        await expect
          .poll(
            async () =>
              (await newPage.evaluate(() => document.documentElement.scrollHeight)) -
              (await oldPage.evaluate(() => document.documentElement.scrollHeight)),
          )
          .toBe(0)
      const hasAccount = (await oldPage.locator("#site-account").count()) > 0
      if (hasAccount && !(await oldPage.locator("#site-account").evaluate((el) => el.classList.contains("relative")))) {
        await oldPage.screenshot({
          path: `${output}/${String(width)}-${scenario}-old-original.png`,
          fullPage: !scenario.includes("editor"),
          animations: "disabled",
        })
        await oldPage.locator("#site-account").evaluate((el) => {
          el.classList.add("relative", "z-10")
        })
      }
      const before = await oldPage.screenshot({
          path: `${output}/${String(width)}-${scenario}-old.png`,
          fullPage: !scenario.includes("editor"),
          animations: "disabled",
        }),
        after = await newPage.screenshot({
          path: `${output}/${String(width)}-${scenario}-new.png`,
          fullPage: !scenario.includes("editor"),
          animations: "disabled",
        })
      const pixels = await writeDiff(before, after, `${output}/${String(width)}-${scenario}-diff.png`)
      results.push({ width, scenario, pixels })
      console.log(width, scenario, pixels)
      if (pixels && scenario.startsWith("gallery-")) {
        const bounds = async (page: Page) => {
          const full = !scenario.includes("editor")
          const boxes = await page
            .locator("#gallery-upload-form,#gallery-photos figure,#gallery-photo-caption,[id^=gallery-photo-caption-]")
            .evaluateAll(
              (items, full) =>
                items.map((el) => {
                  const r = el.getBoundingClientRect()
                  return {
                    x: r.x + (full ? window.scrollX : 0),
                    y: r.y + (full ? window.scrollY : 0),
                    width: r.width,
                    height: r.height,
                  }
                }),
              full,
            )
          const file = page.locator("#gallery-upload-form input[type=file]")
          if (await file.count())
            boxes.push(
              await file.evaluate((el, full) => {
                const r = el.getBoundingClientRect(),
                  style = getComputedStyle(el, "::file-selector-button")
                const ctx = document.createElement("canvas").getContext("2d")
                if (!ctx) throw new Error("missing canvas")
                ctx.font = style.font || `${style.fontSize} ${style.fontFamily}`
                const width =
                  ctx.measureText("Choose File").width +
                  parseFloat(style.paddingLeft) +
                  parseFloat(style.paddingRight) +
                  parseFloat(style.borderLeftWidth) +
                  parseFloat(style.borderRightWidth)
                return {
                  x: r.x + (full ? window.scrollX : 0),
                  y: r.y + (full ? window.scrollY : 0),
                  width,
                  height: r.height,
                }
              }, full),
            )
          return boxes
        }
        const a = await bounds(oldPage),
          b = await bounds(newPage)
        assert.deepEqual(a, b)
        assert.ok(galleryCornerRoundingOnly(before, after, a, scenario === "gallery-caption-editor"), scenario)
      } else if (pixels && scenario === "library-expanded") {
        const bounds = async (page: Page) =>
          page.locator("#all-library-articles,#library-series a").evaluateAll((items) =>
            items.map((el) => {
              const r = el.getBoundingClientRect()
              return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height }
            }),
          )
        const a = await bounds(oldPage),
          b = await bounds(newPage)
        assert.deepEqual(a, b)
        assert.ok(libraryCornerRoundingOnly(before, after, a), scenario)
      } else if (pixels && scenario === "library-editor") {
        const bounds = async (page: Page) =>
          page.locator("#library-editor > div,#article_series,#article_part_number").evaluateAll((items) =>
            items.map((el) => {
              const r = el.getBoundingClientRect()
              return { x: r.x, y: r.y, width: r.width, height: r.height }
            }),
          )
        const a = await bounds(oldPage),
          b = await bounds(newPage)
        assert.deepEqual(a, b)
        const panel = a[0]
        assert.ok(panel)
        assert.ok(libraryEditorRoundingOnly(before, after, a.slice(1), panel), scenario)
      } else if (pixels && scenario.startsWith("admin-")) {
        const bounds = async (page: Page) =>
          page
            .locator(
              "#admin-page aside,#admin-page section,#admin-page details,#admin-page input:not([type=hidden]),#admin-page textarea,#admin-emoji-editor-1",
            )
            .evaluateAll(
              (items, full) =>
                items.map((el) => {
                  const r = el.getBoundingClientRect()
                  return {
                    x: r.x + (full ? window.scrollX : 0),
                    y: r.y + (full ? window.scrollY : 0),
                    width: r.width,
                    height: r.height,
                  }
                }),
              !scenario.includes("editor"),
            )
        const a = await bounds(oldPage),
          b = await bounds(newPage)
        assert.deepEqual(a, b)
        assert.ok(adminCornerRoundingOnly(before, after, a, scenario === "admin-tag-editor"), scenario)
      } else assert.equal(pixels, 0, scenario)
    }
    fixtures(false)
    for (const route of ["gallery", "library"]) {
      await ready(oldPage, legacy, "/" + route)
      await ready(newPage, origin, "/" + route)
      await expect(newPage.locator(`#${route}-empty`)).toBeVisible()
      await compare(route + "-empty")
    }
    fixtures(true)
    for (const route of ["gallery", "library"]) {
      await ready(oldPage, legacy, "/" + route)
      await ready(newPage, origin, "/" + route)
      await expect(newPage.locator(route === "gallery" ? "#photos-2" : "#articles-2")).toBeVisible()
      await compare(route + "-populated")
    }
    await ready(oldPage, legacy, "/admin")
    await ready(newPage, origin, "/admin")
    await compare("admin-login")
    for (const route of ["/articles", "/articles/chats-vs-messengers", "/articles/chat-platforms-russia"]) {
      await ready(oldPage, legacy, route)
      await ready(newPage, origin, route)
      await compare(route.replaceAll("/", "-"))
    }
    const pair = { oldPage, newPage, origin, legacy, compare, ready }
    await technologyArticle(pair, width, output)
    await galleryFlows(pair)
    await libraryFlows(pair)
    await adminFlows(pair)
    await uploadAndModerate(pair)
    await failureRecovery(pair)
    await oldContext.close()
    await newContext.close()
  }
} finally {
  await writeFile(output + "/results.json", JSON.stringify({ legacy: process.env.LEGACY_SHA, results }, null, 2))
  await browser.close()
}
console.log("Community parity", results.length)
