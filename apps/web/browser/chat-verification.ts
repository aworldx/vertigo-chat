import assert from "node:assert/strict"
import { chromium, expect, type Page } from "@playwright/test"
const targetOrigin = process.argv[2]
assert.ok(targetOrigin)
const origin: string = targetOrigin
const browser = await chromium.launch({ headless: true })
async function enter(page: Page, nickname: string, password = "") {
  await page.goto(`${origin}/`)
  await page.locator("#entrance-nickname").fill(nickname)
  await page.locator("#entrance-password").fill(password)
  await page.locator("#enter-chat").click()
  await expect(page.locator("#chat-connection-status")).toContainText("В чате")
}
try {
  const context = await browser.newContext()
  const first = await context.newPage(),
    second = await context.newPage()
  const localAlias = new URL(origin)
  localAlias.hostname = "localhost"
  localAlias.hash = "landing-login"
  await first.goto(localAlias.href)
  await expect(first).toHaveURL(`${origin}/#landing-login`)
  await expect(first.locator("#landing-title")).toHaveText("У каждогосвоя история.")
  await first.locator("#entrance-nickname").fill("fixture01")
  await first.locator("#enter-chat").click()
  await expect(first.locator("#entrance-error")).toContainText("Введи пароль")
  await first.locator("#entrance-password").fill("incorrect")
  await first.locator("#enter-chat").click()
  await expect(first.locator("#entrance-error")).toContainText("Неверный пароль")
  await enter(first, "browser-guest-one")
  await second.goto(`${origin}/`)
  await second.locator("#entrance-nickname").fill("browser-guest-one")
  await second.locator("#enter-chat").click()
  await expect(second.locator("#entrance-error")).toContainText("уже используется")
  await enter(second, "browser-guest-two")
  await expect(first.locator("#online-list")).toContainText("browser-guest-two")
  await first.locator("#message-body").fill("Привет из первой вкладки")
  await first.locator("#send-message").click()
  await expect(second.locator("#messages")).toContainText("Привет из первой вкладки")
  await first.reload()
  await expect(first.locator("#chat-connection-status")).toContainText("В чате")
  await expect(first.locator("#messages")).toContainText("Привет из первой вкладки")
  const copied = await first.evaluate(() => sessionStorage.getItem("vertigo.go-chat"))
  assert.ok(copied)
  const duplicate = await context.newPage()
  await duplicate.goto(`${origin}/`)
  await duplicate.evaluate((value) => {
    sessionStorage.setItem("vertigo.go-chat", value)
  }, copied)
  await duplicate.goto(`${origin}/chat`)
  await expect(duplicate.locator("#chat-entrance-screen")).toContainText("уже открыт в другой вкладке")
  await expect(first.locator("#chat-connection-status")).toContainText("В чате")
  await duplicate.close()
  await context.setOffline(true)
  await expect(first.locator("#chat-connection-status")).toContainText("Восстанавливаем", { timeout: 15000 })
  await first.locator("#message-body").fill("Сообщение после обрыва")
  await first.locator("#send-message").click()
  await expect(first.locator('[data-delivery-state="retrying"]')).toContainText("Сообщение после обрыва")
  await context.setOffline(false)
  await expect(first.locator("#chat-connection-status")).toContainText("В чате", { timeout: 15000 })
  await expect(
    second.locator('#messages [data-message-kind="text"]').filter({ hasText: "Сообщение после обрыва" }),
  ).toHaveCount(1)
  await first.locator("#leave-chat").click()
  await expect(first).toHaveURL(`${origin}/`)
  assert.equal(await first.evaluate(() => sessionStorage.getItem("vertigo.go-chat")), null)
  await first.goto(`${origin}/chat`)
  await expect(first.locator("#chat-login-link")).toBeVisible()
  await second.locator("#leave-chat").click()
  await expect(second).toHaveURL(`${origin}/`)
  await context.close()

  const registered = await browser.newContext()
  const page = await registered.newPage()
  await page.goto(`${origin}/`)
  await page.locator("#landing-show-registration").click()
  await page.locator("#registration-nickname").fill("browser-registered")
  await page.locator("#registration-password").fill("secret123")
  await page.locator("#register-user").click()
  await expect(page.locator("#chat-connection-status")).toContainText("browser-registered")
  const account = await registered.newPage()
  await account.goto(`${origin}/profiles`)
  await expect(account.locator("#site-account-nickname")).toHaveText("browser-registered")
  await account.locator("#site-account-logout-submit").click()
  await expect(account.locator("#site-account-nickname")).toHaveCount(0)
  await page.reload()
  await expect(page.locator("#chat-connection-status")).toContainText("В чате")
  await page.locator("#leave-chat").click()
  await expect(page).toHaveURL(`${origin}/`)
  await registered.close()
  const blocked = await browser.newContext()
  await blocked.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked", "SecurityError")
    }
  })
  const storagePage = await blocked.newPage()
  await storagePage.goto(`${origin}/`)
  await storagePage.locator("#entrance-nickname").fill("blocked-storage")
  await storagePage.locator("#enter-chat").click()
  await expect(storagePage.locator("#entrance-error")).toContainText("Разреши хранение")
  await blocked.close()
  console.log(
    "Go chat browser: guest/registered entrance, reserved nickname, two tabs, messages, reload, duplicate-tab lock, offline outbox, site logout independence, terminal leave and denied storage passed",
  )
} finally {
  await browser.close()
}
