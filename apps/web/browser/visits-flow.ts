import assert from "node:assert/strict"
import { expect, type Browser } from "@playwright/test"
export async function verifyVisits(browser: Browser, origin: string) {
  const context = await browser.newContext({ timezoneId: "Pacific/Honolulu" })
  const room = await context.newPage(),
    history = await context.newPage()
  await room.goto(origin + "/")
  await room.locator("#entrance-nickname").fill("visits-reader")
  await room.locator("#enter-chat").click()
  await expect(room.locator("#message-body")).toBeVisible()
  await history.goto(origin + "/visits")
  const row = history.locator('[data-visit-nickname="visits-reader"]')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText("Сейчас в чате")
  await room.locator("#leave-chat").click()
  await expect(room).toHaveURL(origin + "/")
  // Like legacy, history stays a snapshot until navigation/reload.
  await expect(row).toContainText("Сейчас в чате")
  await history.reload()
  await expect(row).toHaveCount(1)
  await expect(row).not.toContainText("Сейчас в чате")
  const response = await context.request.get(origin + "/api/v1/visits")
  assert.equal(response.headers()["cache-control"], "no-store")
  const payload = await response.text()
  for (const field of ["session_id", "identity_key", "user_id", "resume_secret", "email"])
    assert.ok(!payload.includes('"' + field + '"'))
  let release: () => void = () => {
    throw new Error("no pending request")
  }
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await history.route("**/api/v1/visits", async (route) => {
    await gate
    await route.continue()
  })
  await history.goto(origin + "/visits")
  await expect(history.getByRole("status")).toContainText("Загрузка")
  await expect(history.locator("#visits-empty")).toHaveCount(0)
  release()
  await expect(row).toHaveCount(1)
  await history.unroute("**/api/v1/visits")
  await history.route("**/api/v1/visits", (route) => route.fulfill({ status: 503, body: '{"error":"unavailable"}' }))
  await history.reload()
  await expect(history.locator("#visits-retry")).toBeVisible()
  await expect(history.locator("#visits-empty")).toHaveCount(0)
  await history.unroute("**/api/v1/visits")
  await history.locator("#visits-retry").click()
  await expect(row).toHaveCount(1)
  await history.locator("#visits-return-to-chat").focus()
  await expect(history.locator("#visits-return-to-chat")).toBeFocused()
  await expect(history.locator("#visits-return-to-chat")).toHaveAttribute("target", "vertigo-chat")
  await context.close()
}
