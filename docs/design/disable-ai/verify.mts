import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { chromium, expect } from "/app/apps/web/node_modules/@playwright/test/index.mjs"
import { verifyHistorySummary } from "/app/apps/web/browser/history-summary.ts"
const origin = "http://127.0.0.1:4081"
const output = "/tmp/disable-ai-actual"
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] })
try {
  await verifyHistorySummary(browser, origin)
  for (const [name, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]] as const) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: "ru-RU", timezoneId: "Europe/Moscow" })
    const page = await context.newPage()
    await page.clock.install({ time: new Date("2026-10-08T09:00:00Z") })
    await page.goto(origin + "/history")
    await page.reload()
    await page.waitForLoadState("networkidle")
    await page.evaluate(() => document.fonts.ready)
    await expect(page.locator("#history-summarize")).toHaveCount(0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: output + "/history-" + name + "-actual.png", animations: "disabled" })
    await page.goto(origin + "/")
    await page.locator("#entrance-nickname").fill("bots-check-" + name)
    await page.locator("#enter-chat").click()
    await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
    await page.reload()
    await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
    await expect(page.locator("#online-row-bot-claire")).toHaveCount(0)
    await expect(page.locator("#online-row-bot-hitchcock")).toHaveCount(1)
    await page.locator("#message-body").fill("Клэр, привет")
    await page.locator("#send-message").click()
    await expect(page.locator("#messages")).toContainText("Клэр, привет")
    await page.screenshot({ path: output + "/chat-" + name + "-actual.png", animations: "disabled" })
    await page.goto(origin + "/help")
    await expect(page.locator("body")).toContainText("AI-саммари отключено")
    await expect(page.locator("body")).toContainText("Клэр и фоновые диалоги между ботами отключены")
    await context.close()
  }
  console.log("PASS: guest/account history, refresh, search, disabled API, desktop/mobile chat presence, sending, help")
} finally { await browser.close() }
