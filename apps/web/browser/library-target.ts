import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { expect } from "@playwright/test"
import { launchBrowser } from "./coverage"
import { verifyLibraryEditor } from "./library-editor-verification"
import { verifyLibraryActions } from "./library-actions-verification"
const origin = process.argv[2]
assert.ok(origin)
await mkdir("migration-results/community", { recursive: true })
await mkdir("migration-results/library-actions", { recursive: true })
const browser = await launchBrowser({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(origin + "/account/login")
  await page.locator("#react-account-nickname").fill("fixture01")
  await page.locator("#react-account-password").fill("secret123")
  await page.locator("#react-account-login-form button[type=submit]").click()
  await expect(page.locator("#site-account-nickname")).toHaveText("fixture01")
  await verifyLibraryEditor(page, origin)
  await page.close()
  await verifyLibraryActions(browser, origin)
  console.log("Library editor, images, series, likes, bookmarks and access checks passed")
} finally {
  await browser.close()
}
