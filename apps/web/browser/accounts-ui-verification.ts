import { verifyAccountSettings } from "./account-settings-flow"
import assert from "node:assert/strict"
import { chromium } from "@playwright/test"
import { verifyFlow } from "./accounts-flow"
const origin = process.argv[2]
assert.ok(origin)
const browser = await chromium.launch({ headless: true })
try {
  await verifyFlow(browser, origin)
  await verifyAccountSettings(browser, origin)
  console.log("Go React UI: registration, login, profile edit/upload, CSRF and two-tab logout passed")
} finally {
  await browser.close()
}
