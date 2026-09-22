import { writeDiff } from "./compare-screenshots"
import { verifyFlow } from "./accounts-flow"
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium, expect, type Page } from "@playwright/test"

const [origin, legacy] = process.argv.slice(2)
assert.ok(origin && legacy)
const output = "migration-results/go-web"
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
]
const results: {
  scenario: string
  viewport: (typeof viewports)[number]
  oldMetrics: Awaited<ReturnType<typeof metrics>>
  newMetrics: Awaited<ReturnType<typeof metrics>>
  differentPixels: number
  identicalPNG: boolean
}[] = []
try {
  for (const viewport of viewports) {
    const oldContext = await browser.newContext({
      viewport,
      locale: "ru-RU",
      timezoneId: "Europe/Moscow",
      colorScheme: "dark",
    })
    const newContext = await browser.newContext({
      viewport,
      locale: "ru-RU",
      timezoneId: "Europe/Moscow",
      colorScheme: "dark",
    })
    const oldPage = await oldContext.newPage()
    const newPage = await newContext.newPage()
    for (const scenario of ["landing", "landing-register", "login", "register", "profiles", "profile-dialog"]) {
      if (scenario === "landing") {
        await oldPage.goto(`${legacy}/`)
        await newPage.goto(`${origin}/`)
        await expect(oldPage.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
      } else if (scenario === "landing-register") {
        await oldPage.locator("#landing-show-registration").click()
        await newPage.locator("#landing-show-registration").click()
        await expect(oldPage.locator("#registration-form")).toBeVisible()
        await expect(newPage.locator("#registration-form")).toBeVisible()
      } else if (scenario === "login") {
        await oldPage.goto(`${legacy}/account/login`)
        // The pinned legacy root omits its existing account_login entry. Mount
        // that unchanged legacy bundle to compare the intended form, not a loader.
        await oldPage.addScriptTag({ url: `${legacy}/assets/js/account_login.js` })
        await newPage.goto(`${origin}/account/login`)
      } else if (scenario === "register") {
        await oldPage.getByRole("button", { name: "Создать аккаунт", exact: true }).click()
        await newPage.getByRole("button", { name: "Создать аккаунт", exact: true }).click()
      } else if (scenario === "profiles") {
        await oldPage.goto(`${legacy}/profiles`)
        await newPage.goto(`${origin}/profiles`)
        await expect(oldPage.locator("#profiles button").first()).toBeVisible()
        await expect(newPage.locator("#profiles button").first()).toBeVisible()
      } else {
        await oldPage.getByRole("button", { name: "Открыть анкету fixture01", exact: true }).click()
        await newPage.getByRole("button", { name: "Открыть анкету fixture01", exact: true }).click()
        await expect(oldPage.locator("#profile-viewer")).toBeVisible()
        await expect(newPage.locator("#profile-viewer")).toBeVisible()
        await expect(oldPage.locator("#profile-viewer-title")).toHaveText("fixture01")
        await expect(newPage.locator("#profile-viewer-title")).toHaveText("fixture01")
      }
      const selector = scenario.startsWith("landing")
        ? "#vertigo-landing"
        : scenario.includes("profile")
          ? "#profiles-content"
          : "#react-account-login-form"
      const oldMetrics = await metrics(oldPage, selector)
      const newMetrics = await metrics(newPage, selector)
      assert.deepEqual(newMetrics, oldMetrics, `${scenario} geometry/fonts at ${viewport.name}`)
      assert.equal(newMetrics.scrollWidth, viewport.width)
      if (scenario === "profile-dialog") {
        assert.deepEqual(await metrics(newPage, "#profile-viewer"), await metrics(oldPage, "#profile-viewer"))
      }
      // Modal backdrops cover the viewport, not the full scrollable catalogue.
      // Capture what a user can see; full-page capture composites content behind
      // the modal outside that viewport inconsistently in Chromium.
      const fullPage = scenario !== "profile-dialog"
      const oldImage = await oldPage.screenshot({
        path: `${output}/${viewport.name}-${scenario}-old.png`,
        fullPage,
        animations: "disabled",
      })
      const newImage = await newPage.screenshot({
        path: `${output}/${viewport.name}-${scenario}-new.png`,
        fullPage,
        animations: "disabled",
      })
      const differentPixels = await writeDiff(oldImage, newImage, `${output}/${viewport.name}-${scenario}-diff.png`)
      results.push({
        scenario,
        viewport,
        oldMetrics,
        newMetrics,
        differentPixels,
        identicalPNG: oldImage.equals(newImage),
      })
    }
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
    "Legacy and Go screenshots must match; see migration-results/go-web for old/new/diff",
  )
  await verifyFlow(browser, origin)
  console.log(
    `Go web: ${String(results.length)} visual comparisons and registration/login/profile edit/upload/logout scenarios passed`,
  )
} finally {
  await browser.close()
}

async function metrics(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible()
  await page.waitForLoadState("networkidle")
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  return page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    const heading = document.querySelector("h1")
    const headingStyle = heading ? getComputedStyle(heading) : null
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      font: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      headingFont: headingStyle?.fontFamily,
      headingSize: headingStyle?.fontSize,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })
}
