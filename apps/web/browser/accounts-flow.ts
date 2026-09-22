import assert from "node:assert/strict"
import { expect, type Browser } from "@playwright/test"

export async function verifyFlow(browser: Browser, origin: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${origin}/account/login`)
  await page.locator("#react-account-nickname").fill("fixture01")
  await page.locator("#react-account-password").fill("wrong-password")
  await page.locator("#react-account-submit").click()
  await expect(page.getByRole("alert")).toContainText("Неверный ник")
  assert.equal(new URL(page.url()).pathname, "/account/login")
  await page.route("**/api/v1/auth/session", (route) => route.abort(), { times: 1 })
  await page.locator("#react-account-submit").click()
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(page.locator("#react-account-submit")).toBeEnabled()
  await page.goto(`${origin}/account/register`)
  await page.locator("#react-account-nickname").fill("новый-пользователь")
  await page.locator("#react-account-password").fill("secret123")
  await page.locator("#react-account-submit").click()
  await expect(page.locator("#site-account-nickname")).toHaveText("новый-пользователь")
  await expect(page.locator("#account-profile-editor")).toBeVisible()
  await page.locator("#account-profile-name").fill("Новое имя")
  await page.locator("#account-profile-save").click()
  await expect(page.getByRole("status").filter({ hasText: "Анкета сохранена." })).toBeVisible()
  await page.reload()
  await expect(page.locator("#account-profile-name")).toHaveValue("Новое имя")
  await page.locator("#account-profile-name").fill("")
  await page.locator("#account-profile-save").click()
  await expect(page.getByRole("status").filter({ hasText: "Анкета сохранена." })).toBeVisible()
  await page.reload()
  await expect(page.locator("#account-profile-name")).toHaveValue("")
  await page.locator("#account-profile-photo").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement("canvas")
        canvas.width = 2
        canvas.height = 2
        const context = canvas.getContext("2d")
        if (!context) throw new Error("Canvas unavailable")
        context.fillStyle = "red"
        context.fillRect(0, 0, 2, 2)
        return canvas.toDataURL("image/png").split(",")[1] ?? ""
      }),
      "base64",
    ),
  })
  await expect(page.locator("#account-profile-editor [role=status]")).toHaveText("Фото обновлено.")
  const photo = await context.request.get(`${origin}/profiles/${encodeURIComponent("новый-пользователь")}/photo`)
  assert.equal(photo.status(), 200)
  const thumbnail = await context.request.get(
    `${origin}/profiles/${encodeURIComponent("новый-пользователь")}/photo/thumbnail`,
  )
  assert.equal(thumbnail.headers()["content-type"], "image/webp")
  assert.equal(
    (await context.request.patch(`${origin}/api/v1/account/profile`, { data: { profile: { name: "CSRF" } } })).status(),
    403,
  )
  const second = await context.newPage()
  await second.goto(`${origin}/profiles`)
  await expect(second.locator("#site-account-nickname")).toHaveText("новый-пользователь")
  await page.evaluate(() => {
    sessionStorage.setItem("chat-session-proof", "unchanged")
  })
  await second.locator("#site-account-logout-submit").click()
  await expect(second.locator("#site-account-nickname")).toHaveCount(0)
  await expect(page.locator("#site-account-nickname")).toHaveCount(0)
  await expect(page.locator("#account-profile-editor")).toHaveCount(0)
  assert.equal(await page.evaluate(() => sessionStorage.getItem("chat-session-proof")), "unchanged")
  await page.goto(`${origin}/account/login`)
  await page.locator("#react-account-nickname").fill("fixture01")
  await page.locator("#react-account-password").fill("secret123")
  await page.locator("#react-account-submit").click()
  await expect(page.locator("#site-account-nickname")).toHaveText("fixture01")
  await expect(page.locator("#account-profile-name")).toHaveValue("Тестовая анкета")
  await context.close()
}
