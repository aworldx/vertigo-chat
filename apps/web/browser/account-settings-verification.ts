import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { chromium, expect, type Page } from "@playwright/test"
import { writeDiff } from "./compare-screenshots"
const [origin, legacy] = process.argv.slice(2)
assert.ok(origin && legacy)
const databases = [process.env.GO_ROOM_DATABASE, process.env.LEGACY_ROOM_DATABASE]
for (const database of databases) assert.ok(database && /^chat_web_(go|legacy)_\d+$/.test(database))
const output = "migration-results/account-settings"
await mkdir(output, { recursive: true })
const results: { width: number; scenario: string; differentPixels: number }[] = []
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] })
async function login(page: Page, base: string) {
  await page.goto(base + "/account/login")
  if (base === legacy) await page.addScriptTag({ url: base + "/assets/js/account_login.js" })
  await page.locator("#react-account-nickname").fill("fixture01")
  await page.locator("#react-account-password").fill("secret123")
  await page.locator("#react-account-login-form button[type=submit]").click()
  await expect(page.locator("#site-account-nickname")).toHaveText("fixture01")
  await page.goto(base + "/account")
  if (base === legacy) await expect(page.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
  await expect(page.locator("#forum-email")).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}
try {
  for (const width of [390, 639, 640, 768, 1440]) {
    for (const database of databases)
      execFileSync("psql", [
        database ?? "",
        "-v",
        "ON_ERROR_STOP=1",
        "-q",
        "-c",
        "UPDATE registered_users SET email=NULL WHERE nickname='fixture01'; UPDATE registered_users SET email='taken@example.test' WHERE nickname='fixture02';",
      ])
    const options = {
      viewport: { width, height: width === 390 ? 844 : width === 768 ? 1024 : 900 },
      locale: "ru-RU",
      reducedMotion: "reduce" as const,
    }
    const oldContext = await browser.newContext(options),
      newContext = await browser.newContext(options)
    const oldPage = await oldContext.newPage(),
      newPage = await newContext.newPage()
    await login(oldPage, legacy)
    await login(newPage, origin)
    const compare = async (scenario: string) => {
      for (const page of [oldPage, newPage]) await page.mouse.move(0, 0)
      const metrics = (element: Element) =>
        Array.from(element.querySelectorAll("h1,p,input,button")).map((el) => {
          const r = el.getBoundingClientRect(),
            s = getComputedStyle(el)
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            font: s.fontFamily,
            size: s.fontSize,
            lineHeight: s.lineHeight,
            color: s.color,
          }
        })
      assert.deepEqual(
        await newPage.locator("#account-settings-page").evaluate(metrics),
        await oldPage.locator("#account-settings-page").evaluate(metrics),
      )
      for (const page of [oldPage, newPage])
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width)
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
    await compare("empty")
    for (const page of [oldPage, newPage]) await page.locator("#forum-email").focus()
    await compare("focus")
    for (const [scenario, value, message] of [
      ["required", "", "can't be blank"],
      ["invalid", "invalid", "has invalid format"],
      ["taken", "TAKEN@example.test", "has already been taken"],
    ] as const) {
      for (const page of [oldPage, newPage]) {
        // Explicitly exercise server validation beyond the native email constraint.
        await page.locator("#forum-email-form").evaluate((form: HTMLFormElement) => {
          form.noValidate = true
        })
        await page.locator("#forum-email").fill(value)
        await page.locator("#save-forum-email").click()
        await expect(page.locator("#forum-email-form [role=alert]")).toHaveText(message)
        await page.locator("#save-forum-email").blur()
      }
      await compare(scenario)
    }
    for (const page of [oldPage, newPage]) {
      await page.locator("#forum-email").fill("Fixture01@Example.Test")
      await page.locator("#save-forum-email").click()
      await expect(page.locator("#forum-email")).toHaveValue("fixture01@example.test")
      await expect(page.locator("#flash-info")).toBeVisible()
      await page.locator("#save-forum-email").blur()
    }
    await compare("saved")
    for (const page of [oldPage, newPage]) {
      await page.locator("#flash-info button").click()
      await expect(page.locator("#flash-info")).toHaveCount(0)
      await page.reload()
      await expect(page.locator("#forum-email")).toHaveValue("fixture01@example.test")
    }
    await compare("reload")
    for (const database of databases)
      assert.equal(
        execFileSync(
          "psql",
          [database ?? "", "-At", "-c", "SELECT email FROM registered_users WHERE nickname='fixture01'"],
          { encoding: "utf8" },
        ).trim(),
        "fixture01@example.test",
      )
    await oldContext.close()
    await newContext.close()
  }
} finally {
  await writeFile(output + "/results.json", JSON.stringify({ legacy: process.env.LEGACY_SHA, results }, null, 2))
  await browser.close()
}
console.log("Account settings old/new parity passed", results.length)
