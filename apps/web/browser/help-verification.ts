import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium, expect, type Page } from "@playwright/test"
import { writeDiff } from "./compare-screenshots"
const [origin, legacy] = process.argv.slice(2)
assert.ok(origin && legacy)
const output = "migration-results/help"
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] })
const results: { scenario: string; width: number; differentPixels: number }[] = []
async function ready(page: Page, base: string, path: string) {
  await page.goto(base + path)
  await expect(page.locator("#rank-10")).toBeVisible()
  if (base === legacy) await expect(page.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await expect(page.locator("#commands-list > div")).toHaveCount(10)
  await expect(page.locator("#ranks-list > li")).toHaveCount(10)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), page.viewportSize()?.width)
}
try {
  for (const width of [390, 639, 640, 768, 1023, 1024, 1440]) {
    const options = {
      viewport: { width, height: width === 390 ? 844 : width === 768 ? 1024 : 900 },
      locale: "ru-RU",
      timezoneId: "Europe/Moscow",
      reducedMotion: "reduce" as const,
    }
    const oldContext = await browser.newContext(options),
      newContext = await browser.newContext(options)
    const oldPage = await oldContext.newPage(),
      newPage = await newContext.newPage()
    for (const path of ["/help", "/ranks"]) {
      await ready(oldPage, legacy, path)
      await ready(newPage, origin, path)
      assert.equal(await newPage.locator("#help-page").innerText(), await oldPage.locator("#help-page").innerText())
      const metrics = (element: Element) =>
        Array.from(element.querySelectorAll("h1,h2,dd,img")).map((item) => {
          const rect = item.getBoundingClientRect(),
            style = getComputedStyle(item)
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            font: style.fontFamily,
            size: style.fontSize,
            lineHeight: style.lineHeight,
          }
        })
      assert.deepEqual(
        await newPage.locator("#help-page").evaluate(metrics),
        await oldPage.locator("#help-page").evaluate(metrics),
      )
      await oldPage.mouse.move(0, 0)
      await newPage.mouse.move(0, 0)
      const scenario = path.slice(1)
      const oldImage = await oldPage.screenshot({
        path: output + "/" + String(width) + "-" + scenario + "-old.png",
        fullPage: true,
      })
      const newImage = await newPage.screenshot({
        path: output + "/" + String(width) + "-" + scenario + "-new.png",
        fullPage: true,
      })
      const differentPixels = await writeDiff(
        oldImage,
        newImage,
        output + "/" + String(width) + "-" + scenario + "-diff.png",
      )
      results.push({ scenario, width, differentPixels })
      assert.equal(differentPixels, 0)
      await newPage.reload()
      await expect(newPage.locator("#rank-10")).toBeVisible()
    }
    await newContext.close()
    await oldContext.close()
  }

  for (const width of [390, 768, 1440]) {
    const oldContext = await browser.newContext({
      viewport: { width, height: 900 },
      locale: "ru-RU",
      reducedMotion: "reduce",
    })
    const newContext = await browser.newContext({
      viewport: { width, height: 900 },
      locale: "ru-RU",
      reducedMotion: "reduce",
    })
    const oldPage = await oldContext.newPage(),
      newPage = await newContext.newPage()
    for (const [page, base] of [
      [oldPage, legacy],
      [newPage, origin],
    ] as const) {
      await page.goto(base + "/account/login")
      // Pinned legacy layout omits its unchanged account login entry.
      if (base === legacy) await page.addScriptTag({ url: base + "/assets/js/account_login.js" })
      await page.locator("#react-account-nickname").fill("fixture01")
      await page.locator("#react-account-password").fill("secret123")
      await page.locator("#react-account-login-form button[type=submit]").click()
      await expect(page.locator("#site-account-nickname")).toHaveText("fixture01")
      await ready(page, base, "/help")
      await expect(page.locator("#site-account-nickname")).toHaveText("fixture01")
      await page.mouse.move(0, 0)
    }
    for (const page of [oldPage, newPage])
      await page.evaluate(() => {
        window.scrollTo(0, 0)
      })
    const oldBar = await oldPage.locator("#site-account").boundingBox()
    assert.ok(oldBar)
    assert.deepEqual(await newPage.locator("#site-account").boundingBox(), oldBar)
    assert.equal(await newPage.locator("#site-account").innerText(), await oldPage.locator("#site-account").innerText())
    const oldImage = await oldPage.screenshot({ path: `${output}/${String(width)}-account-old.png`, fullPage: true })
    const newImage = await newPage.screenshot({ path: `${output}/${String(width)}-account-new.png`, fullPage: true })
    // Preserve the full diff. Only the pre-existing AccountBar stacking fix
    // is excluded from the exact content comparison, never any part of Help.
    await writeDiff(oldImage, newImage, `${output}/${String(width)}-account-diff.png`)
    // Diagnostic control: applying the same existing stacking fix to legacy
    // must explain every remaining pixel, including compositor changes below it.
    await oldPage.locator("#site-account").evaluate((el) => {
      el.classList.add("relative", "z-10")
    })
    const correctedOld = await oldPage.screenshot({
      path: `${output}/${String(width)}-account-legacy-stacking-fix.png`,
      fullPage: true,
    })
    const differentPixels = await writeDiff(
      correctedOld,
      newImage,
      `${output}/${String(width)}-account-stacking-control-diff.png`,
    )
    await oldPage.locator("#site-account").evaluate((el) => {
      el.classList.remove("relative", "z-10")
    })
    results.push({ scenario: "account", width, differentPixels })
    assert.equal(differentPixels, 0)
    for (const page of [oldPage, newPage]) {
      if (page === oldPage) {
        // Legacy's overlay intercepts pointer events; keyboard remains usable.
        await page.locator("#site-account-logout-submit").focus()
        await page.keyboard.press("Enter")
      } else await page.locator("#site-account-logout-submit").click()
      await expect(page.locator("#site-account")).toHaveCount(0)
      await expect(page.locator("#rank-10")).toBeVisible()
    }
    await oldContext.close()
    await newContext.close()
  }
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.route("**/api/v1/ranks", (route) => route.fulfill({ status: 503, body: "unavailable" }))
  await page.goto(origin + "/help")
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(page.locator("#commands-list > div")).toHaveCount(10)
  await page.unroute("**/api/v1/ranks")
  await page.locator("#help-retry").click()
  await expect(page.locator("#rank-10")).toBeVisible()
  await expect(page.getByRole("alert")).toHaveCount(0)
  await page.keyboard.press("Control+Home")
  const link = page.locator("[data-return-to-chat]")
  await expect(link).toHaveAttribute("href", "/chat")
  await expect(link).toHaveAttribute("target", "vertigo-chat")
  await link.focus()
  await expect(link).toBeFocused()
  await context.close()
} finally {
  await writeFile(output + "/results.json", JSON.stringify({ legacy: process.env.LEGACY_SHA, results }, null, 2))
  await browser.close()
}
console.log("Help parity and browser scenarios passed", results.length)
