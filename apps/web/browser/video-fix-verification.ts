import { chromium, expect } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import { verifyChatControls } from "./chat-controls-verification"
import { verifyDeliveryStates } from "./delivery-status-verification"
import { verifyMessageScroll } from "./message-scroll-verification"
import { verifyPlayer } from "./player-verification"

const origin = process.argv[2]
if (!origin) throw new Error("Origin is required")
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] })
try {
  if (process.argv[3] !== "--help-only") {
    await verifyPlayer(browser, origin)
    await verifyChatControls(browser, origin)
    await verifyDeliveryStates(browser, origin)
    await verifyMessageScroll(browser, origin)
  }
  await mkdir("migration-results/video-fix", { recursive: true })
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport })
    await page.goto(`${origin}/help`)
    await page.reload()
    await page.locator("#help-topic-video > summary").click()
    await expect(page.locator("#help-topic-video")).toContainText("за три минуты")
    await page.screenshot({ path: `migration-results/video-fix/help-${String(viewport.width)}.png` })
    await page.close()
  }
} finally {
  await browser.close()
}
