import assert from "node:assert/strict"
import { launchBrowser } from "./coverage"
import { verifyPolls } from "./polls-verification"

const origin = process.argv[2]
assert.ok(origin)
const browser = await launchBrowser({ headless: true })
try {
  await verifyPolls(browser, origin)
  console.log("Polls verified: admin creation, guest vote, reload and close.")
} finally {
  await browser.close()
}
