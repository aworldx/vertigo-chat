import { execFileSync } from "node:child_process"
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium, expect, type Page } from "@playwright/test"
import { writeDiff, darkCompositorRoundingOnly } from "./compare-screenshots"
const [origin, legacy] = process.argv.slice(2)
assert.ok(origin && legacy)
const output = "migration-results/chat-room"
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] })
const results: { viewport: string; scenario: string; differentPixels: number; compositorRounding?: boolean }[] = []
async function compositorRounding(pages: [Page, Page], images: [Buffer, Buffer], scenario: string, viewport: string) {
  if (!["registration", "feedback", "profile", "chart-filled"].includes(scenario)) return false
  const selectors =
    scenario === "chart-filled"
      ? ["#music-chart-tracks article", "#music-chart-login-hint"]
      : ["header:has(#chat-logo)"]
  const regions: { x: number; y: number; width: number; height: number }[] = []
  for (const selector of selectors) {
    const evidence = await Promise.all(
      pages.map((page) =>
        page
          .locator(selector)
          .first()
          .evaluate((element) => {
            const r = element.getBoundingClientRect(),
              style = getComputedStyle(element)
            return {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              background: style.background,
              border: style.border,
              radius: style.borderRadius,
              shadow: style.boxShadow,
              font: style.font,
              opacity: style.opacity,
            }
          }),
      ),
    )
    assert.deepEqual(evidence[0], evidence[1], "Rounding allowance requires identical geometry and computed styles")
    const rect = evidence[0]
    assert.ok(rect)
    if (scenario === "chart-filled") {
      for (const x of [rect.x, rect.x + rect.width - 16]) {
        for (const y of [rect.y, rect.y + rect.height - 16]) regions.push({ x, y, width: 16, height: 16 })
      }
    } else regions.push(rect)
    await writeFile(
      `${output}/${viewport}-${scenario}-${selectors.indexOf(selector).toString()}-compositor.json`,
      JSON.stringify(evidence, null, 2),
    )
  }
  return darkCompositorRoundingOnly(images[0], images[1], regions)
}
async function enter(page: Page, base: string) {
  await page.goto(base)
  if (base === legacy) await expect(page.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
  await page.locator("#entrance-nickname").fill("room-reader")
  await page.locator("#enter-chat").click()
  await expect(page.locator("#message-body")).toBeVisible()
  await expect(page.locator("#online-list")).toContainText("room-reader")
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.waitForTimeout(1200)
  await page.mouse.move(0, 0)
}
try {
  for (const viewport of [
    { name: "phone", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    const options = { viewport, locale: "ru-RU", timezoneId: "Europe/Moscow", reducedMotion: "reduce" as const }
    const oldContext = await browser.newContext(options),
      newContext = await browser.newContext(options)
    const oldPage = await oldContext.newPage(),
      newPage = await newContext.newPage()
    for (const database of [process.env.GO_ROOM_DATABASE, process.env.LEGACY_ROOM_DATABASE]) {
      assert.ok(database && /^chat_web_(go|legacy)_\d+$/u.test(database))
      execFileSync("psql", [
        "postgresql://localhost/" + database,
        "-v",
        "ON_ERROR_STOP=1",
        "-qc",
        "TRUNCATE room_messages, music_chart_tracks RESTART IDENTITY CASCADE",
      ])
      execFileSync("psql", [
        "postgresql://localhost/" + database,
        "-v",
        "ON_ERROR_STOP=1",
        "-q",
        "-f",
        "../../script/fixtures/chat-feed.sql",
      ])
    }
    await enter(oldPage, legacy)
    await enter(newPage, origin)
    for (const database of [process.env.GO_ROOM_DATABASE, process.env.LEGACY_ROOM_DATABASE]) {
      assert.ok(database && /^chat_web_(go|legacy)_\d+$/u.test(database))
      execFileSync("psql", [
        "postgresql://localhost/" + database,
        "-v",
        "ON_ERROR_STOP=1",
        "-qc",
        "UPDATE room_messages SET sent_at='2026-09-22 12:00:00'",
      ])
    }
    for (const page of [oldPage, newPage]) {
      await page.reload()
      await expect(page.locator("#message-body")).toBeVisible()
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      await page.waitForTimeout(1200)
    }
    for (const scenario of ["room", "emoji", "settings", "registration", "feedback", "profile"]) {
      if (scenario === "settings" && viewport.width < 768) continue
      if (scenario === "emoji")
        for (const page of [oldPage, newPage]) await page.locator("#toggle-emoji-picker").click()
      if (scenario === "settings")
        for (const page of [oldPage, newPage]) {
          await page.locator("#toggle-emoji-picker").click()
          await page.locator("#toggle-settings").click()
        }
      if (scenario === "registration")
        for (const page of [oldPage, newPage]) {
          if (await page.locator("#close-settings").isVisible()) await page.locator("#close-settings").click()
          if (viewport.width < 768) await page.locator("#toggle-emoji-picker").click()
          if (viewport.width < 1024) {
            await page.locator("#mobile-main-menu > summary").click()
            await page.locator("#mobile-show-registration").click()
          } else await page.locator("#show-registration").click()
        }
      if (scenario === "feedback")
        for (const page of [oldPage, newPage]) {
          await page.locator("#close-registration").click()
          if (viewport.width < 1024) {
            if (!(await page.locator("#mobile-main-menu").evaluate((el) => el.hasAttribute("open"))))
              await page.locator("#mobile-main-menu > summary").click()
            await page.locator("#mobile-about-menu > summary").click()
            await page.locator("#mobile-show-feedback").click()
          } else {
            await page.locator("#about-main-menu > summary").click()
            await page.locator("#show-feedback").click()
          }
        }
      if (scenario === "profile")
        for (const page of [oldPage, newPage]) {
          await page.locator("#close-feedback").click()
          await page.locator("#message-body").fill("/инфо fixture01")
          await page.locator("#send-message").click()
          await expect(page.locator("#profile-modal")).toBeVisible()
          await expect(page.locator("#profile-modal")).toContainText("fixture01")
          await page.waitForTimeout(300)
        }
      const images = []
      for (const [name, page] of [
        ["old", oldPage],
        ["new", newPage],
      ] as const) {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width)
        await page.locator("#messages").evaluate((element) => {
          element.scrollTop = 0
        })
        await page.mouse.move(0, 0)
        await page.waitForTimeout(300)
        images.push(
          await page.screenshot({
            path: `${output}/${viewport.name}-${scenario}-${name}.png`,
            animations: "disabled",
          }),
        )
      }
      const old = images[0],
        current = images[1]
      assert.ok(old && current)
      results.push({
        viewport: viewport.name,
        scenario,
        differentPixels: await writeDiff(old, current, `${output}/${viewport.name}-${scenario}-diff.png`),
        compositorRounding:
          viewport.name === "tablet" &&
          (await compositorRounding([oldPage, newPage], [old, current], scenario, viewport.name)),
      })
    }
    for (const page of [oldPage, newPage]) {
      if (await page.locator("#close-profile").isVisible()) await page.locator("#close-profile").click()
      if (await page.locator("#close-settings").isVisible()) await page.locator("#close-settings").click()
      await page.locator("#leave-chat").click()
      await expect(page).toHaveURL(/\/$/)
    }
    const chartImages: Buffer[] = []
    for (const [name, page, base] of [
      ["old", oldPage, legacy],
      ["new", newPage, origin],
    ] as const) {
      await page.goto(`${base}/music-chart`)
      if (name === "old") await expect(page.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
      await expect(page.locator("#music-chart-empty")).toBeVisible()
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      chartImages.push(
        await page.screenshot({ path: `${output}/${viewport.name}-chart-empty-${name}.png`, animations: "disabled" }),
      )
    }
    assert.ok(chartImages[0] && chartImages[1])
    results.push({
      viewport: viewport.name,
      scenario: "chart-empty",
      differentPixels: await writeDiff(
        chartImages[0],
        chartImages[1],
        `${output}/${viewport.name}-chart-empty-diff.png`,
      ),
    })
    for (const database of [process.env.GO_ROOM_DATABASE, process.env.LEGACY_ROOM_DATABASE]) {
      assert.ok(database && /^chat_web_(go|legacy)_\d+$/u.test(database))
      execFileSync("psql", [
        "postgresql://localhost/" + database,
        "-v",
        "ON_ERROR_STOP=1",
        "-qc",
        "INSERT INTO music_chart_tracks(user_id,title,audio,content_type,inserted_at,updated_at) SELECT id,'Тестовый трек',decode('494433','hex'),'audio/mpeg','2026-09-22 12:00:00','2026-09-22 12:00:00' FROM registered_users WHERE nickname='fixture01'; INSERT INTO music_chart_comments(track_id,user_id,body,inserted_at,updated_at) SELECT 1,id,'Отличная музыка','2026-09-22 12:00:00','2026-09-22 12:00:00' FROM registered_users WHERE nickname='fixture02';",
      ])
    }
    const filledImages: Buffer[] = []
    for (const [name, page] of [
      ["old", oldPage],
      ["new", newPage],
    ] as const) {
      await page.reload()
      if (name === "old") await expect(page.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
      await expect(page.locator("#music-chart-tracks")).toContainText("Тестовый трек")
      await page.evaluate(async () => {
        await document.fonts.ready
      })
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("audio")).every((audio) => audio.error !== null),
      )
      filledImages.push(
        await page.screenshot({ path: `${output}/${viewport.name}-chart-filled-${name}.png`, animations: "disabled" }),
      )
    }
    assert.ok(filledImages[0] && filledImages[1])
    results.push({
      viewport: viewport.name,
      scenario: "chart-filled",
      compositorRounding:
        viewport.name !== "phone" &&
        (await compositorRounding(
          [oldPage, newPage],
          [filledImages[0], filledImages[1]],
          "chart-filled",
          viewport.name,
        )),
      differentPixels: await writeDiff(
        filledImages[0],
        filledImages[1],
        `${output}/${viewport.name}-chart-filled-diff.png`,
      ),
    })
    await oldContext.close()
    await newContext.close()
  }
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        legacySHA: process.env.LEGACY_SHA,
        mask: "none; fixture timestamps are equal in both disposable databases",
        results,
      },
      null,
      2,
    ) + "\n",
  )
  console.log(JSON.stringify(results))
  assert.ok(
    results.every((result) => result.differentPixels === 0 || result.compositorRounding),
    "Full room screenshots must match; inspect saved old/new/diff artifacts",
  )
} finally {
  await browser.close()
}
