import assert from "node:assert/strict"
import { expect, type Browser } from "@playwright/test"
export async function verifyAccountSettings(browser: Browser, origin: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(origin + "/account")
  await expect(page.locator("#react-account-login-form")).toBeVisible()
  await page.locator("#react-account-nickname").fill("fixture01")
  await page.locator("#react-account-password").fill("secret123")
  await page.locator("#react-account-submit").click()
  await expect(page.locator("#forum-email")).toBeVisible()
  assert.equal(new URL(page.url()).pathname, "/account")
  const csrf = await page.evaluate(async () => {
    const response = await fetch("/api/v1/auth/session")
    const body: unknown = await response.json()
    if (
      typeof body !== "object" ||
      body === null ||
      !("data" in body) ||
      typeof body.data !== "object" ||
      body.data === null ||
      !("csrf_token" in body.data) ||
      typeof body.data.csrf_token !== "string"
    )
      throw new Error("session")
    return body.data.csrf_token
  })
  const api = async (body: unknown, token = csrf) =>
    page.evaluate(
      async ({ body, token }) => {
        const response = await fetch("/api/v1/account/settings/email", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
          body: JSON.stringify(body),
        })
        return { status: response.status, body: await response.text(), cache: response.headers.get("cache-control") }
      },
      { body, token },
    )
  assert.equal((await api({ email: "private@example.test" }, "wrong")).status, 403)
  assert.equal((await api({ email: "private@example.test", user_id: 2 })).status, 422)
  assert.equal((await api({ email: null })).status, 422)
  assert.equal((await api({ email: "a".repeat(255) + "@example.test" })).status, 422)
  assert.equal((await api({ email: "  Private@Example.Test  " })).status, 200)
  await page.reload()
  await expect(page.locator("#forum-email")).toHaveValue("private@example.test")
  const publicData = await context.request.get(origin + "/api/v1/profiles/fixture01")
  assert.ok(!(await publicData.text()).includes("private@example.test"))
  let release: () => void = () => {
    throw new Error("request not pending")
  }
  let calls = 0
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/v1/account/settings/email", async (route) => {
    calls++
    await gate
    await route.continue()
  })
  await page.locator("#forum-email").fill("updated@example.test")
  await page.locator("#save-forum-email").click()
  await expect(page.locator("#save-forum-email")).toBeDisabled()
  await expect(page.locator("#save-forum-email")).toHaveText("Сохраняем…")
  await page.locator("#forum-email-form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit()
  })
  assert.equal(calls, 1)
  release()
  await expect(page.locator("#flash-info")).toBeVisible()
  await page.unroute("**/api/v1/account/settings/email")
  await page.locator("#account-notice-close").click()
  await page.route("**/api/v1/account/settings/email", (route) => route.abort())
  await page.locator("#forum-email").fill("retry@example.test")
  await page.locator("#save-forum-email").click()
  await expect(page.locator("#forum-email-error")).toBeVisible()
  await expect(page.locator("#forum-email")).toHaveValue("retry@example.test")
  await page.unroute("**/api/v1/account/settings/email")
  await page.locator("#save-forum-email").click()
  await expect(page.locator("#flash-info")).toBeVisible()
  await page.locator("#account-notice-close").click()
  await page.route("**/api/v1/account/settings", (route) =>
    route.fulfill({ status: 503, body: '{"error":"unavailable"}' }),
  )
  await page.reload()
  await expect(page.locator("#account-settings-retry")).toBeVisible()
  await expect(page.locator("#forum-email")).toHaveCount(0)
  await page.unroute("**/api/v1/account/settings")
  await page.locator("#account-settings-retry").click()
  await expect(page.locator("#forum-email")).toHaveValue("retry@example.test")
  const other = await context.newPage()
  await other.goto(origin + "/account")
  await expect(other.locator("#forum-email")).toBeVisible()
  await other.locator("#site-account-logout-submit").click()
  await expect(page.locator("#react-account-login-form")).toBeVisible()
  await expect(page.locator("#forum-email")).toHaveCount(0)
  assert.equal((await context.request.get(origin + "/api/v1/account/settings")).status(), 401)
  await context.close()
}
