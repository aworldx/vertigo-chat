import { posterRoundingOnly, writeDiff } from "./compare-screenshots"
import { verifyFlow } from "./accounts-flow"
import { landingScenarios, prepareLanding } from "./landing-comparison"
import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium, expect, type Page } from "@playwright/test"

const [origin, legacy] = process.argv.slice(2)
assert.ok(origin && legacy)
const output = "migration-results/go-web"
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ["--disable-gpu"] })
const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
  ...[430, 431, 639, 640, 760, 761, 767, 1000, 1001].map((width) => ({
    name: `breakpoint-${String(width)}`,
    width,
    height: 900,
  })),
]
const results: {
  scenario: string
  viewport: (typeof viewports)[number]
  oldMetrics: Awaited<ReturnType<typeof metrics>>
  newMetrics: Awaited<ReturnType<typeof metrics>>
  differentPixels: number
  identicalPNG: boolean
  posterRounding: boolean
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
    const scenarios = viewport.name.startsWith("breakpoint-")
      ? ["landing", "landing-register"]
      : [...landingScenarios, "login", "register", "profiles", "profile-dialog"]
    for (const scenario of scenarios) {
      if (scenario.startsWith("landing")) {
        await prepareLanding(oldPage, legacy, scenario, true)
        await prepareLanding(newPage, origin, scenario, false)
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
      // Pointer state survives navigation; keep it away from cards and buttons
      // so a previous form click cannot add an accidental hover to one version.
      await oldPage.mouse.move(0, 0)
      await newPage.mouse.move(0, 0)
      await oldPage.evaluate(() => {
        window.scrollTo(0, 0)
      })
      await newPage.evaluate(() => {
        window.scrollTo(0, 0)
      })
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
      let posterRounding = false
      if (differentPixels > 0 && viewport.name.startsWith("breakpoint-")) {
        const oldPoster = await posterMetrics(oldPage)
        const newPoster = await posterMetrics(newPage)
        assert.deepEqual(newPoster, oldPoster, "Poster geometry and compositing styles")
        const oldAsset = await oldPage.request.get(`${legacy}/images/vertigo-poster.png`)
        const newAsset = await newPage.request.get(`${origin}/images/vertigo-poster.png`)
        assert.ok((await oldAsset.body()).equals(await newAsset.body()), "Poster source PNG must be identical")
        posterRounding = posterRoundingOnly(oldImage, newImage, oldPoster)
      }
      results.push({
        scenario,
        viewport,
        oldMetrics,
        newMetrics,
        differentPixels,
        identicalPNG: oldImage.equals(newImage),
        posterRounding,
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
    results.filter((result) => result.differentPixels !== 0 && !result.posterRounding),
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

async function posterMetrics(page: Page) {
  return page.locator("#landing-poster").evaluate((element) => {
    const box = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      objectFit: style.objectFit,
      objectPosition: style.objectPosition,
      opacity: style.opacity,
    }
  })
}

async function metrics(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible()
  await page.waitForLoadState("networkidle")
  await page.evaluate(async () => {
    await document.fonts.ready
    for (const family of ["Vertigo Text", "Vertigo Display"]) {
      const loaded = await document.fonts.load(`16px "${family}"`)
      if (loaded.length === 0 || loaded.some((font) => font.status !== "loaded")) {
        throw new Error(`Required font did not load: ${family}`)
      }
    }
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
