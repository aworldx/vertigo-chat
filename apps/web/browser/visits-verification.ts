import { launchBrowser } from "./coverage"
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { expect, type Page } from "@playwright/test"
import { writeDiff } from "./compare-screenshots"
const [origin, legacy] = process.argv.slice(2)
assert.ok(origin && legacy)
const databases = [process.env.GO_ROOM_DATABASE, process.env.LEGACY_ROOM_DATABASE]
for (const database of databases) assert.ok(database && /^chat_web_(go|legacy)_\d+$/.test(database))
const output = "migration-results/visits"
await mkdir(output, { recursive: true })
const browser = await launchBrowser({ headless: true, args: ["--disable-gpu"] })
const results: { width: number; scenario: string; differentPixels: number }[] = []
const now = new Date()
now.setUTCSeconds(0, 0)
function fixtures(populated: boolean) {
  // Fixture-only future heartbeat prevents legacy cleanup of synthetic active rows.
  let sql = "TRUNCATE visits RESTART IDENTITY CASCADE;"
  if (populated) {
    const rows = [
      [1, "старый", 49 * 60, false],
      [2, "вчера", 47 * 60 + 59, true],
      [3, "повтор", 120, false],
      [4, "повтор", 60, false],
      [5, "повтор", 60, true],
      [6, "<ник>&", 30, true],
      [7, "очень-длинный-ник-123456", 10, false],
    ] as const
    for (const [id, nick, minutes, finished] of rows) {
      const entered = new Date(now.getTime() - minutes * 60000).toISOString()
      const left = finished
        ? "'" + new Date(now.getTime() - 5 * 60000).toISOString() + "'::timestamptz AT TIME ZONE 'UTC'"
        : "NULL"
      sql += `INSERT INTO visits(id,nickname,identity_key,entered_at,left_at,inserted_at,updated_at) VALUES(${String(id)},'${nick}','fixture:${String(id)}','${entered}'::timestamptz AT TIME ZONE 'UTC',${left},NOW() AT TIME ZONE 'UTC',(NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day');`
    }
  }
  for (const database of databases)
    execFileSync("psql", [database ?? "", "-v", "ON_ERROR_STOP=1", "-q", "-c", sql], { stdio: "pipe" })
}
async function ready(page: Page, base: string) {
  const response = await page.goto(base + "/visits")
  assert.equal(response?.status(), 200)
  if (base === origin) assert.equal(response.headers()["x-robots-tag"], "noindex, nofollow")
  if (base === legacy) await expect(page.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
  await expect(page.locator("#visits")).toBeAttached()
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}
try {
  for (const width of [390, 639, 640, 768, 1440]) {
    const options = {
      viewport: { width, height: width === 390 ? 844 : width === 768 ? 1024 : 900 },
      locale: "ru-RU",
      timezoneId: "America/Los_Angeles",
      reducedMotion: "reduce" as const,
    }
    const oldContext = await browser.newContext(options),
      newContext = await browser.newContext(options)
    const oldPage = await oldContext.newPage(),
      newPage = await newContext.newPage()
    const compare = async (scenario: string) => {
      for (const page of [oldPage, newPage]) {
        await page.mouse.move(0, 0)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width)
      }
      const metrics = (el: Element) =>
        Array.from(el.querySelectorAll("h1,th,td,.chat-user-nickname"))
          .filter((item) => item.getClientRects().length > 0)
          .map((item) => {
            const box = item.getBoundingClientRect(),
              style = getComputedStyle(item)
            return {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              font: style.fontFamily,
              size: style.fontSize,
              lineHeight: style.lineHeight,
            }
          })
      assert.deepEqual(
        await newPage.locator("#visits-page").evaluate(metrics),
        await oldPage.locator("#visits-page").evaluate(metrics),
      )
      assert.equal(await newPage.locator("#visits-page").innerText(), await oldPage.locator("#visits-page").innerText())
      const before = await oldPage.screenshot({
        path: `${output}/${String(width)}-${scenario}-old.png`,
        fullPage: true,
        animations: "disabled",
      })
      const after = await newPage.screenshot({
        path: `${output}/${String(width)}-${scenario}-new.png`,
        fullPage: true,
        animations: "disabled",
      })
      const differentPixels = await writeDiff(before, after, `${output}/${String(width)}-${scenario}-diff.png`)
      results.push({ width, scenario, differentPixels })
      assert.equal(differentPixels, 0, scenario)
    }
    fixtures(false)
    await ready(oldPage, legacy)
    await ready(newPage, origin)
    await expect(newPage.locator("#visits-empty")).toBeVisible()
    await compare("empty")
    fixtures(true)
    await ready(oldPage, legacy)
    await ready(newPage, origin)
    for (const page of [oldPage, newPage]) {
      await expect(page.locator("#visits [data-visit-nickname]")).toHaveCount(5)
      assert.deepEqual(
        await page.locator("#visits [data-visit-nickname]").evaluateAll((rows) => rows.map((row) => row.id)),
        ["visits-7", "visits-6", "visits-5", "visits-4", "visits-2"],
      )
      await expect(page.locator("#visits-empty")).toBeHidden()
      await expect(page.locator("#visits-6")).toContainText("<ник>&")
      await expect(page.locator("#visits-6 script")).toHaveCount(0)
    }
    await compare("history")
    if (width < 672) {
      for (const page of [oldPage, newPage])
        await page.locator("#visits-page .overflow-x-auto").evaluate((el) => {
          el.scrollLeft = el.scrollWidth
        })
      await compare("scrolled")
    }
    await newPage.reload()
    await expect(newPage.locator("#visits-7")).toBeVisible()

    if ([390, 768, 1440].includes(width)) {
      for (const [page, base] of [
        [oldPage, legacy],
        [newPage, origin],
      ] as const) {
        await page.goto(base + "/account/login")
        if (base === legacy) await page.addScriptTag({ url: base + "/assets/js/account_login.js" })
        await page.locator("#react-account-nickname").fill("fixture01")
        await page.locator("#react-account-password").fill("secret123")
        await page.locator("#react-account-login-form button[type=submit]").click()
        await expect(page.locator("#site-account-nickname")).toHaveText("fixture01")
        await ready(page, base)
        await expect(page.locator("#visits [data-visit-nickname]")).toHaveCount(5)
        await page.mouse.move(0, 0)
      }
      // Keep unmodified evidence of the pre-existing AccountBar overlay fix.
      await oldPage.screenshot({
        path: `${output}/${String(width)}-account-old.png`,
        fullPage: true,
        animations: "disabled",
      })
      const current = await newPage.screenshot({
        path: `${output}/${String(width)}-account-new.png`,
        fullPage: true,
        animations: "disabled",
      })
      await oldPage.locator("#site-account").evaluate((el) => {
        el.classList.add("relative", "z-10")
      })
      const corrected = await oldPage.screenshot({
        path: `${output}/${String(width)}-account-legacy-stacking-fix.png`,
        fullPage: true,
        animations: "disabled",
      })
      const differentPixels = await writeDiff(
        corrected,
        current,
        `${output}/${String(width)}-account-stacking-control-diff.png`,
      )
      results.push({ width, scenario: "account-stacking-control", differentPixels })
      assert.equal(differentPixels, 0)
      await newPage.locator("#site-account-logout-submit").click()
      await expect(newPage.locator("#site-account")).toHaveCount(0)
      await expect(newPage.locator("#visits [data-visit-nickname]")).toHaveCount(5)
    }
    await newContext.close()
    await oldContext.close()
  }
} finally {
  await writeFile(
    output + "/results.json",
    JSON.stringify({ legacy: process.env.LEGACY_SHA, fixtureNow: now.toISOString(), results }, null, 2),
  )
  await browser.close()
}
console.log("Visits old/new parity passed", results.length)
