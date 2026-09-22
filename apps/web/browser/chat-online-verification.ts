import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium, expect, type Page, type Locator } from "@playwright/test"
import { writeDiff, nativeFocusRoundingOnly } from "./compare-screenshots"

const [origin, legacy] = process.argv.slice(2)
assert.ok(origin && legacy)
const output = "migration-results/chat-online"
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] })
const results: { viewport: string; scenario: string; differentPixels: number; nativeFocusRounding: boolean }[] = []
const row = (page: Page, nickname: string) =>
  page.locator("#online-list .chat-online-row").filter({ hasText: nickname })
// Native focus outlines can settle after layout. Require consecutive identical
// captures of each page independently; never retry until old/new happen to match.
async function stableScreenshot(locator: Locator, path: string) {
  let previous = await locator.screenshot({ animations: "disabled" })
  await expect
    .poll(async () => {
      const next = await locator.screenshot({ animations: "disabled" })
      const stable = next.equals(previous)
      previous = next
      return stable
    })
    .toBe(true)
  await writeFile(path, previous)
  return previous
}
async function enter(page: Page, base: string, nickname: string) {
  await page.goto(base)
  if (base === legacy) await expect(page.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
  await page.locator("#entrance-nickname").fill(nickname)
  await page.locator("#enter-chat").click()
  await expect(page.locator("#message-body")).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}
try {
  for (const viewport of [
    { name: "phone", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
    { name: "below-sidebar", width: 767, height: 900 },
  ]) {
    const options = { viewport, locale: "ru-RU", timezoneId: "Europe/Moscow", reducedMotion: "reduce" as const }
    const oldContext = await browser.newContext(options),
      newContext = await browser.newContext(options)
    const oldPeerContext = await browser.newContext(options),
      newPeerContext = await browser.newContext(options)
    const oldPage = await oldContext.newPage(),
      newPage = await newContext.newPage()
    const oldPeer = await oldPeerContext.newPage(),
      newPeer = await newPeerContext.newPage()
    const nickname = "online-guest-with-long-n"
    await enter(oldPage, legacy, "online-reader")
    await enter(newPage, origin, "online-reader")
    await enter(oldPeer, legacy, nickname)
    await enter(newPeer, origin, nickname)
    for (const page of [oldPage, newPage]) {
      await expect(row(page, nickname)).toHaveCount(1)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width)
      await page.mouse.move(0, 0)
      await page.screenshot({
        path: `${output}/${viewport.name}-${page === oldPage ? "old" : "new"}-room.png`,
        animations: "disabled",
      })
    }
    if (viewport.width < 768) {
      await expect(row(oldPage, nickname)).toBeHidden()
      await expect(row(newPage, nickname)).toBeHidden()
    } else {
      const compare = async (scenario: string, name = nickname) => {
        const oldRow = row(oldPage, name),
          newRow = row(newPage, name)
        const metrics = (element: Element) => {
          const nick = element.querySelector(".flex-1")
          if (!nick) throw new Error("Missing nickname")
          const style = getComputedStyle(nick)
          const box = element.getBoundingClientRect()
          const nickBox = nick.getBoundingClientRect()
          return {
            x: box.x,
            y: box.y,
            control: { x: nickBox.x - box.x, y: nickBox.y - box.y, width: nickBox.width, height: nickBox.height },
            focusVisible: nick.matches(":focus-visible"),
            outline: style.outline,
            outlineOffset: style.outlineOffset,
            width: box.width,
            height: box.height,
            font: style.fontFamily,
            size: style.fontSize,
            weight: style.fontWeight,
            lineHeight: style.lineHeight,
            color: style.color,
            textOverflow: style.textOverflow,
          }
        }
        const oldMetrics = await oldRow.evaluate(metrics)
        assert.deepEqual(await newRow.evaluate(metrics), oldMetrics)
        const before = await stableScreenshot(oldRow, `${output}/${viewport.name}-${scenario}-old.png`)
        const after = await stableScreenshot(newRow, `${output}/${viewport.name}-${scenario}-new.png`)
        const differentPixels = await writeDiff(before, after, `${output}/${viewport.name}-${scenario}-diff.png`)
        results.push({
          viewport: viewport.name,
          scenario,
          differentPixels,
          nativeFocusRounding:
            differentPixels > 0 &&
            scenario === "keyboard-focus" &&
            oldMetrics.focusVisible &&
            oldMetrics.outline.includes("auto") &&
            nativeFocusRoundingOnly(before, after, oldMetrics.control),
        })
      }
      await compare("active-long-nickname")
      await compare("self", "online-reader")
      for (const page of [oldPage, newPage])
        await row(page, nickname).getByRole("button", { name: nickname, exact: true }).hover()
      await compare("hover")
      for (const page of [oldPage, newPage]) {
        await page.mouse.move(0, 0)
        const button = row(page, nickname).getByRole("button", { name: nickname, exact: true })
        await button.focus()
        await page.keyboard.press("Tab")
        await page.keyboard.press("Shift+Tab")
        await expect(button).toBeFocused()
      }
      await compare("keyboard-focus")
      for (const page of [oldPage, newPage]) {
        await page.keyboard.press("Enter")
        await expect(page.locator("#message-body")).toHaveValue(`${nickname}, `)
        await expect(page.locator("#message-body")).toBeFocused()
        await page.locator("#message-body").fill("")
      }
      await newPeerContext.setOffline(true)
      await expect(newPeer.locator("#current-chatlan-reconnecting")).toBeVisible()
      await expect(newPeer.locator("#current-chatlan-online")).toHaveCount(0)
      // Navigating the same tab closes the real transport in both implementations;
      // Chromium offline alone does not reliably close an existing legacy socket.
      await oldPeer.goto("about:blank")
      await newPeer.goto("about:blank")
      for (const page of [oldPage, newPage]) {
        await expect(row(page, nickname).locator(".chat-presence:visible")).toHaveText(/Нет связи/u, { timeout: 15000 })
        await expect(row(page, nickname).getByRole("button", { name: nickname, exact: true })).toHaveCount(0)
        await expect(row(page, nickname).locator(".chat-presence:visible")).not.toHaveText(/В сети/u)
      }
      await compare("reconnecting")
      await newPeerContext.setOffline(false)
      await oldPeer.goto(`${legacy}/chat`)
      await newPeer.goto(`${origin}/chat`)
      for (const page of [oldPage, newPage])
        await expect(row(page, nickname).locator(".chat-presence:visible")).toHaveText(/В сети/u, { timeout: 15000 })
      await compare("restored")
    }
    await oldPeer.locator("#leave-chat").click()
    await newPeer.locator("#leave-chat").click()
    for (const page of [oldPage, newPage]) await expect(row(page, nickname)).toHaveCount(0)
    await expect(newPage.locator("#online-count")).toHaveText("1")
    await oldPage.locator("#leave-chat").click()
    await newPage.locator("#leave-chat").click()
    await expect(oldPage).toHaveURL(`${legacy}/`)
    await expect(newPage).toHaveURL(`${origin}/`)
    for (const context of [oldPeerContext, newPeerContext, oldContext, newContext]) await context.close()
  }
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ legacySHA: process.env.LEGACY_SHA, origin, legacy, results }, null, 2),
  )
  assert.deepEqual(
    results.filter((result) => result.differentPixels !== 0 && !result.nativeFocusRounding),
    [],
    "Presence row differences; see migration-results/chat-online",
  )
  console.log(
    `Chat online: ${String(results.length)} comparisons (${String(results.filter((result) => result.differentPixels === 0).length)} pixel-exact); responsive visibility, addressing, reconnect and leave passed`,
  )
} finally {
  await browser.close()
}
