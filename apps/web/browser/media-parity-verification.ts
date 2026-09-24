import { launchBrowser } from "./coverage"
import { execFileSync } from "node:child_process"
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { expect } from "@playwright/test"
import { writeDiff } from "./compare-screenshots"
const [origin, legacy] = process.argv.slice(2)
assert.ok(origin && legacy)
const browser = await launchBrowser({ headless: true, args: ["--disable-gpu"] })
const output = "migration-results/chat-media"
await mkdir(output, { recursive: true })
const runID = String(Date.now()).slice(-4)
const results: { viewport: number; kind: string; differentPixels: number }[] = []
try {
  for (const width of [390, 768, 1440]) {
    for (const database of [process.env.GO_ROOM_DATABASE, process.env.LEGACY_ROOM_DATABASE]) {
      assert.ok(database && /^chat_web_(go|legacy)_\d+$/u.test(database))
      execFileSync("psql", [
        "postgresql://localhost/" + database,
        "-v",
        "ON_ERROR_STOP=1",
        "-qc",
        "TRUNCATE room_messages RESTART IDENTITY",
      ])
    }
    const contexts = await Promise.all([
      browser.newContext({
        viewport: { width, height: 1024 },
        reducedMotion: "reduce",
        locale: "ru-RU",
        timezoneId: "Europe/Moscow",
      }),
      browser.newContext({
        viewport: { width, height: 1024 },
        reducedMotion: "reduce",
        locale: "ru-RU",
        timezoneId: "Europe/Moscow",
      }),
    ])
    const pages = await Promise.all(contexts.map((context) => context.newPage()))
    await Promise.all(
      pages.map(async (page, index) => {
        await page.goto(index === 0 ? legacy : origin)
        if (index === 0) await expect(page.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
        await page.locator("#entrance-nickname").fill(`media-${String(width)}-${runID}`)
        await page.locator("#enter-chat").click()
        await expect(page.locator("#message-body")).toBeVisible()
        await page.evaluate(async () => {
          await document.fonts.ready
        })
      }),
    )
    for (const [kind, command] of [
      ["music", "/музыка Radiohead"],
      ["youtube_search", "/ютуб Me at the zoo"],
    ] as const) {
      const oldPage = pages[0],
        newPage = pages[1]
      assert.ok(oldPage && newPage)
      await oldPage.locator("#message-body").fill(command)
      await oldPage.locator("#send-message").click()
      const oldResults = oldPage.locator(`[data-command-result="${kind}"]`)
      await expect(oldResults.locator("article").first()).toBeVisible({ timeout: 45000 })
      const items: {
        kind: string
        url: string
        source: string
        title: string
        artist: string
        duration: string
        preview: string
      }[] = []
      const collect = async () =>
        oldResults.locator("article").evaluateAll((articles) =>
          articles.map((article) => {
            const audio = article.querySelector("audio")
            if (audio) {
              const spans = article.querySelectorAll("div > span")
              return {
                kind: "music",
                url: new URL(audio.src).searchParams.get("url") ?? "",
                source: "",
                title: spans[2]?.textContent ?? "",
                artist: spans[0]?.textContent ?? "",
                duration: spans[3]?.textContent ?? "",
                preview: "",
              }
            }
            const id = article.id.slice(-11),
              paragraphs = article.querySelectorAll("p")
            return {
              kind: "youtube",
              url: "/youtube-proxy/" + id,
              source: "https://www.youtube.com/watch?v=" + id,
              title: paragraphs[0]?.textContent ?? "",
              duration: paragraphs[1]?.textContent ?? "",
              artist: "",
              preview: "",
            }
          }),
        )
      items.push(...(await collect()))
      const pagination = oldResults.getByRole("navigation", { name: "Страницы результатов музыки" })
      const pageCount = await pagination.locator("button").count()
      for (let number = 2; number <= pageCount; number++) {
        await pagination.getByRole("button", { name: String(number), exact: true }).click()
        await expect(pagination.getByRole("button", { name: String(number), exact: true })).toHaveAttribute(
          "aria-current",
          "page",
        )
        items.push(...(await collect()))
      }
      if (pageCount > 1) {
        await pagination.getByRole("button", { name: "1", exact: true }).click()
        await expect(pagination.getByRole("button", { name: "1", exact: true })).toHaveAttribute("aria-current", "page")
      }
      const timestamp = await oldResults.locator("time").getAttribute("datetime")
      assert.ok(timestamp)
      await newPage.clock.setFixedTime(new Date(timestamp))
      const route = "**/api/v1/chat/media/**"
      await newPage.route(route, async (request) => request.fulfill({ json: { data: items } }))
      await newPage.locator("#message-body").fill(command)
      await newPage.locator("#send-message").click()
      await expect(newPage.locator(`[data-command-result="${kind}"] article`)).toHaveCount(Math.min(5, items.length))
      await newPage.unroute(route)
      await Promise.all(
        pages.map(async (page) => {
          await page.mouse.move(0, 0)
          await page.locator("#message-body").focus()
        }),
      )
      await writeFile(
        `${output}/${String(width)}-${kind}-geometry.json`,
        JSON.stringify(
          await Promise.all(
            pages.map((page) =>
              page.locator(`[data-command-result="${kind}"]`).evaluate((element) => {
                const r = element.getBoundingClientRect(),
                  style = getComputedStyle(element)
                return {
                  x: r.x,
                  y: r.y,
                  width: r.width,
                  height: r.height,
                  background: style.backgroundColor,
                  font: style.font,
                  lineHeight: style.lineHeight,
                  children: Array.from(element.children).map((child) => {
                    const b = child.getBoundingClientRect()
                    return {
                      tag: child.tagName,
                      x: b.x,
                      y: b.y,
                      w: b.width,
                      h: b.height,
                      font: getComputedStyle(child).font,
                    }
                  }),
                }
              }),
            ),
          ),
          null,
          2,
        ),
      )
      const shots = await Promise.all(
        pages.map(async (page, index) =>
          page.locator(`[data-command-result="${kind}"]`).screenshot({
            path: `${output}/${String(width)}-${kind}-${index === 0 ? "old" : "new"}.png`,
            animations: "disabled",
          }),
        ),
      )
      assert.ok(shots[0] && shots[1])
      results.push({
        viewport: width,
        kind,
        differentPixels: await writeDiff(shots[0], shots[1], `${output}/${String(width)}-${kind}-diff.png`),
      })
      await Promise.all(
        pages.map((page) =>
          page
            .getByRole("button", { name: kind === "music" ? "Закрыть поиск музыки" : "Закрыть поиск YouTube" })
            .click(),
        ),
      )
    }
    await Promise.all(pages.map((page) => page.locator("#leave-chat").click()))
    await Promise.all(contexts.map((context) => context.close()))
  }
  await writeFile(`${output}/report.json`, JSON.stringify(results, null, 2) + "\n")
  console.log(JSON.stringify(results))
  assert.ok(
    results.every((r) => r.differentPixels === 0),
    "Media search UI differs from legacy",
  )
} finally {
  await browser.close()
}
