import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium, expect, type Page } from "@playwright/test"
import { writeDiff } from "./compare-screenshots"
const [origin, legacy] = process.argv.slice(2)
assert.ok(origin && legacy)
const output = "migration-results/chat-feed"
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] })
const results: { viewport: string; scenario: string; differentPixels: number }[] = []
async function enter(page: Page, base: string) {
  await page.goto(base)
  if (base === legacy) await expect(page.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
  await page.locator("#entrance-nickname").fill("feed-reader")
  await page.locator("#enter-chat").click()
  await expect(page.locator('#messages [data-client-id="feed-fixture-1"]'))
    .toBeVisible()
    .catch(async (error: unknown) => {
      console.log(base, page.url(), await page.locator("body").innerText())
      throw error
    })
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  // Legacy ChatMessages intentionally follows layout for its first 1000 ms.
  await page.waitForTimeout(1100)
  await page.mouse.move(0, 0)
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
    const oldPage = await oldContext.newPage(),
      newPage = await newContext.newPage()
    await enter(oldPage, legacy)
    await enter(newPage, origin)
    // Compare the migrated message cards, not the still-unmigrated surrounding
    // shell/composer. Full viewport images are retained as explicit scope evidence.
    for (const page of [oldPage, newPage]) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width)
      await page.screenshot({
        path: `${output}/${viewport.name}-${page === oldPage ? "old" : "new"}-room.png`,
        animations: "disabled",
      })
    }
    // The untouched translucent feed uses a backdrop gradient sized to its
    // parent. Give both dialogue frames the same test viewport while composer
    // migration is pending. This changes only the surrounding frame geometry.
    const frameStyles = await Promise.all(
      [oldPage, newPage].map((page) =>
        page.addStyleTag({
          content: `
      #messages { padding-bottom: 100vh; }
      #chat-room > div { flex: none; height: calc(100dvh - 176px); }
      #message-form { height: 120px; }
    `,
        }),
      ),
    )
    for (const scenario of ["1", "2", "3", "4", "5", "system"]) {
      const selector =
        scenario === "system"
          ? '#messages [data-message-kind="system"]'
          : `#messages [data-client-id="feed-fixture-${scenario}"]`
      const oldCard = oldPage.locator(selector).first(),
        newCard = newPage.locator(selector).first()
      for (const card of [oldCard, newCard]) {
        await card.evaluate((element) => {
          const parent = element.parentElement
          if (parent) parent.scrollTop += element.getBoundingClientRect().top - parent.getBoundingClientRect().top - 12
        })
      }
      assert.deepEqual(await newCard.boundingBox(), await oldCard.boundingBox(), "Equal crop position")
      const styles = (element: Element) => {
        const style = getComputedStyle(element)
        const body = element.querySelector(".chat-message-body")
        const bodyStyle = body ? getComputedStyle(body) : null
        return {
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
          font: style.fontFamily,
          size: style.fontSize,
          style: style.fontStyle,
          color: bodyStyle?.color,
          background: style.backgroundColor,
          border: style.border,
          radius: style.borderRadius,
          shadow: style.boxShadow,
          bodyFont: bodyStyle?.fontFamily,
          bodySize: bodyStyle?.fontSize,
        }
      }
      assert.deepEqual(
        await newCard.evaluate(styles),
        await oldCard.evaluate(styles),
        `${viewport.name}/${scenario} geometry and fonts`,
      )
      const box = await oldCard.boundingBox()
      assert.ok(box)
      const clip = { x: box.x - 8, y: box.y - 10, width: box.width + 16, height: box.height + 12 }
      const before = await oldPage.screenshot({
        clip,
        path: `${output}/${viewport.name}-${scenario}-old.png`,
        animations: "disabled",
      })
      const after = await newPage.screenshot({
        clip,
        path: `${output}/${viewport.name}-${scenario}-new.png`,
        animations: "disabled",
      })
      results.push({
        viewport: viewport.name,
        scenario,
        differentPixels: await writeDiff(before, after, `${output}/${viewport.name}-${scenario}-diff.png`),
      })
    }
    for (const style of frameStyles)
      await style.evaluate((element) => {
        element.parentNode?.removeChild(element)
      })
    for (const page of [oldPage, newPage]) {
      await page.locator("#message-body").fill("старый черновик")
      await page.locator('[data-client-id="feed-fixture-1"] button').first().click()
      if (page === oldPage) {
        // Known legacy bug: the server changes the value attribute but LiveView
        // preserves the edited input property. React applies the intended draft.
        await expect(page.locator("#message-body")).toHaveAttribute("value", "feed-reader, ")
        await expect(page.locator("#message-body")).toHaveValue("старый черновик")
      } else await expect(page.locator("#message-body")).toHaveValue("feed-reader, ")
      await expect(page.locator("#message-body")).toBeFocused()
      await page.locator("#message-body").fill("")
    }
    assert.ok(
      await newPage.locator("#messages").evaluate((e) => e.scrollHeight > e.clientHeight),
      "History must overflow at every viewport",
    )
    // With overflow, a new snapshot must preserve the reader's position and DOM.
    await newPage.locator("#messages").evaluate((element) => {
      element.scrollTop = 0
    })
    await expect.poll(() => newPage.locator("#messages").evaluate((e) => e.scrollTop)).toBe(0)
    const retained = await newPage.locator('[data-client-id="feed-fixture-1"]').elementHandle()
    assert.ok(retained)
    await newPage.locator("#message-body").fill(`Новое сообщение без перехвата прокрутки ${viewport.name}`)
    await newPage.locator("#send-message").click()
    await expect(newPage.locator('[data-delivery-state="published"]').last()).toBeAttached()
    await expect(
      newPage
        .locator('#messages [data-message-kind="text"]')
        .filter({ hasText: `Новое сообщение без перехвата прокрутки ${viewport.name}` }),
    ).toHaveCount(1)
    await expect.poll(() => newPage.locator("#messages").evaluate((e) => e.scrollTop)).toBe(0)
    assert.ok(await retained.evaluate((element) => element.isConnected))
    await newPage.locator("#messages").evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await newPage.locator("#message-body").fill(`Следуем за нижним краем ${viewport.name}`)
    await newPage.locator("#send-message").click()
    await expect(
      newPage
        .locator('#messages [data-message-kind="text"]')
        .filter({ hasText: `Следуем за нижним краем ${viewport.name}` }),
    ).toHaveCount(1)
    await expect
      .poll(() => newPage.locator("#messages").evaluate((e) => e.scrollHeight - e.clientHeight - e.scrollTop))
      .toBeLessThanOrEqual(1)
    await oldPage.locator("#leave-chat").click()
    await newPage.locator("#leave-chat").click()
    await expect(oldPage).toHaveURL(`${legacy}/`)
    await expect(newPage).toHaveURL(`${origin}/`)
    await oldContext.close()
    await newContext.close()
  }
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ legacySHA: process.env.LEGACY_SHA, origin, legacy, results }, null, 2),
  )
  assert.deepEqual(
    results.filter((result) => result.differentPixels !== 0),
    [],
    "Message card differences; see migration-results/chat-feed",
  )
  console.log(
    `Chat feed: ${String(results.length)} pixel-exact card comparisons; scroll, stable DOM and public addressing passed`,
  )
} finally {
  await browser.close()
}
