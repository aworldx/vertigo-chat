import { verifyVisits } from "./visits-flow"
import { readFileSync } from "node:fs"
import { record } from "../src/features/chat/api/entrance"
import assert from "node:assert/strict"
import { verifyDeliveryStates } from "./delivery-status-verification"
import { verifyLandingFlow } from "./landing-flow"
import { chromium, expect, type Page } from "@playwright/test"
const targetOrigin = process.argv[2]
assert.ok(targetOrigin)
const origin: string = targetOrigin
const browser = await chromium.launch({ headless: true, args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] })
async function enter(page: Page, nickname: string, password = "") {
  await page.goto(`${origin}/`)
  await page.locator("#entrance-nickname").fill(nickname)
  await page.locator("#entrance-password").fill(password)
  await page.locator("#enter-chat").click()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
}
try {
  await verifyLandingFlow(browser, origin)
  await verifyDeliveryStates(browser, origin)
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
  const observer = await context.newPage()
  await enter(observer, "browser-observer")
  await expect(first.locator("#online-list")).toContainText("browser-guest-two")
  await expect(first.locator("#current-chatlan-online")).toHaveText("В сети")
  await first.locator("#online-list button").filter({ hasText: "browser-guest-two" }).click()
  await expect(first.locator("#message-body")).toHaveValue("browser-guest-two, ")
  await expect(first.locator("#message-body")).toBeFocused()
  await first.locator("#message-body").fill("Привет из первой вкладки")
  await first.locator("#send-message").click()
  await expect(second.locator("#messages")).toContainText("Привет из первой вкладки")
  await first.locator("#toggle-settings").click()
  await first.locator("#font-id").selectOption("serif")
  await first.locator("#save-preferences").click()
  await expect(first.locator("#settings-modal")).toHaveCount(0)
  await first.locator("#message-body").fill("^browser-guest-two, Секрет только адресату")
  await first.locator("#send-message").click()
  await expect(second.locator('[data-message-kind="private"]')).toContainText("Секрет только адресату")
  await expect(first.locator('[data-message-kind="private"]')).toContainText("Секрет только адресату")
  await expect(first.locator('[data-message-kind="private"]')).toHaveAttribute("data-message-font", "serif")
  await expect(first.locator('[data-message-kind="private"]')).toHaveClass(/border-sky-400/)
  await expect(second.locator('[data-message-kind="private"]')).toHaveClass(/border-amber-300/)
  await expect(observer.locator("#messages")).not.toContainText("Секрет только адресату")
  const received = second.locator('[data-message-kind="text"]').filter({ hasText: "Привет из первой вкладки" })
  await received.getByRole("button", { name: "Добавить реакцию" }).click()
  await received.getByRole("button", { name: "👍", exact: true }).click()
  await expect(received.getByRole("button", { name: "👍 1" })).toHaveAttribute("aria-pressed", "true")
  await first.locator("#message-body").fill("Привет, browser-guest-two, адресное сообщение")
  await first.locator("#send-message").click()
  const addressed = second.locator('[data-message-kind="text"]').filter({ hasText: "адресное сообщение" })
  await expect(addressed).toHaveAttribute("data-addressed-to-me", "true")
  await expect(addressed).toHaveClass(/border-amber-300/)
  await expect(
    observer.locator('[data-message-kind="text"]').filter({ hasText: "адресное сообщение" }),
  ).toHaveAttribute("data-addressed-to-me", "false")
  await first.locator("#message-body").fill("/кто")
  await first.locator("#send-message").click()
  await expect(first.locator("#messages")).toContainText("Сейчас онлайн")
  await first.locator('[data-command-result="who"] button', { hasText: "browser-guest-two" }).click()
  await expect(first.locator('[data-command-result="who"]')).toHaveCount(0)
  await expect(first.locator("#message-body")).toHaveValue("browser-guest-two, ")
  await first.reload()
  await expect(first.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  await expect(first.locator("#messages")).toContainText("Привет из первой вкладки")
  await expect(first.locator('[data-message-kind="private"]')).toHaveCount(0)
  await first.locator("#toggle-settings").click()
  await expect(first.locator("#font-id")).toHaveValue("serif")
  await first.locator("#close-settings").click()
  const copied = await first.evaluate(() => sessionStorage.getItem("vertigo.go-chat"))
  assert.ok(copied)
  const duplicate = await context.newPage()
  await duplicate.goto(`${origin}/`)
  await duplicate.evaluate((value) => {
    sessionStorage.setItem("vertigo.go-chat", value)
  }, copied)
  await duplicate.goto(`${origin}/chat`)
  await expect(duplicate.locator("#chat-entrance-screen")).toContainText("уже открыт в другой вкладке")
  await expect(first.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  await duplicate.close()
  await context.setOffline(true)
  await expect(first.locator("#chat-connection-status")).toContainText("Восстанавливаем", { timeout: 15000 })
  await expect(first.locator("#current-chatlan-reconnecting")).toBeVisible()
  await expect(first.locator("#current-chatlan-online")).toHaveCount(0)
  await first.locator("#message-body").fill("Сообщение после обрыва")
  await first.locator("#send-message").click()
  await expect(
    first
      .locator("#messages > [data-client-id]")
      .filter({ hasText: "Сообщение после обрыва" })
      .locator('[data-delivery-state="retrying"]'),
  ).toBeVisible()
  await context.setOffline(false)
  await expect(first.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true", { timeout: 15000 })
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

  const delivery = await browser.newContext()
  let rejected = false
  await delivery.routeWebSocket("**/api/v1/chat/socket", (socket) => {
    const server = socket.connectToServer()
    socket.onMessage((raw) => {
      if (typeof raw === "string") {
        const value: unknown = JSON.parse(raw)
        if (
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          value.type === "send" &&
          "client_id" in value &&
          !rejected
        ) {
          rejected = true
          socket.send(JSON.stringify({ type: "error", code: "message_rejected", client_id: value.client_id }))
          return
        }
      }
      server.send(raw)
    })
  })
  const deliveryPage = await delivery.newPage()
  await enter(deliveryPage, "delivery-guest")
  await deliveryPage.locator("#message-body").fill("Повтор после отказа")
  await deliveryPage.locator("#send-message").click()
  const retried = deliveryPage.locator("#messages > [data-client-id]").filter({ hasText: "Повтор после отказа" })
  await expect(retried.locator('[data-delivery-state="failed"]')).toHaveCount(1)
  await retried.getByRole("button", { name: "Повторить" }).click()
  await expect(retried).toHaveCount(1)
  await expect(retried.locator("[data-delivery-state]")).toHaveAttribute("data-delivery-state", "published")
  rejected = false
  await deliveryPage.locator("#message-body").fill("Удаление из очереди")
  await deliveryPage.locator("#send-message").click()
  const removable = deliveryPage.locator("#messages > [data-client-id]").filter({ hasText: "Удаление из очереди" })
  await expect(removable.locator('[data-delivery-state="failed"]')).toHaveCount(1)
  await removable.getByRole("button", { name: "Удалить" }).click()
  await expect(removable).toHaveCount(0)
  await deliveryPage.reload()
  await expect(deliveryPage.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  await expect(deliveryPage.locator("#messages")).not.toContainText("Удаление из очереди")
  await deliveryPage.locator("#leave-chat").click()
  await expect(deliveryPage).toHaveURL(`${origin}/`)
  await delivery.close()

  const registered = await browser.newContext()
  const page = await registered.newPage()
  await page.goto(`${origin}/`)
  await page.locator("#landing-show-registration").click()
  await page.locator("#registration-nickname").fill("browser-registered")
  await page.locator("#registration-password").fill("secret123")
  await page.locator("#register-user").click()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  await expect(page.locator("#online-list")).toContainText("browser-registered")
  await expect(page.locator('[id^="profile-link-"]')).toHaveCount(1)
  {
    const recipientContext = await browser.newContext()
    let releaseAudio: (() => void) | undefined
    let holdAudio = true
    await recipientContext.routeWebSocket("**/api/v1/chat/socket", (socket) => {
      const server = socket.connectToServer()
      server.onMessage((raw) => {
        if (typeof raw === "string") {
          const frame: unknown = JSON.parse(raw)
          if (record(frame) && frame.type === "signal" && typeof frame.body === "string") {
            const signal: unknown = JSON.parse(frame.body)
            if (record(signal) && signal.type === "offer") return // Exercise the legacy relay fallback deterministically.
            if (record(signal) && signal.type === "relay_chunk" && signal.index === 3 && holdAudio) {
              releaseAudio = () => {
                holdAudio = false
                socket.send(raw)
              }
              return
            }
          }
        }
        socket.send(raw)
      })
    })
    const recipientPage = await recipientContext.newPage()
    await enter(recipientPage, "file-recipient")
    await expect(page.locator("#online-list")).toContainText("file-recipient")
    await page.locator("#attach-media").click()
    await page.locator('input[name="file"]').setInputFiles({
      name: "pixel.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9JkAAAAASUVORK5CYII=",
        "base64",
      ),
    })
    await page.locator('#room-action-form button[type="submit"]').click()
    await recipientPage.getByRole("button", { name: "Показать изображение" }).click()
    await expect(recipientPage.locator('[id^="shared-media-"] img')).toBeVisible({ timeout: 45000 })
    await expect
      .poll(() =>
        recipientPage
          .locator('[id^="shared-media-"] img')
          .evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth === 1),
      )
      .toBe(true)
    await page.locator("#attach-media").click()
    await page.locator('input[name="file"]').setInputFiles({
      name: "purr.mp3",
      mimeType: "audio/mpeg",
      buffer: readFileSync("public/sounds/karmik-purr.mp3"),
    })
    await page.locator('#room-action-form button[type="submit"]').click()
    const streamed = recipientPage.locator('[id^="shared-media-"]').filter({ hasText: "purr.mp3" })
    await streamed.getByRole("button", { name: "Слушать", exact: true }).click()
    await expect.poll(() => !!releaseAudio, { timeout: 45000 }).toBe(true)
    const streamedAudio = streamed.locator("audio")
    await expect
      .poll(() => streamedAudio.evaluate((element) => element instanceof HTMLAudioElement && element.readyState >= 2))
      .toBe(true)
    await expect(streamed.getByRole("status")).toContainText("Получаем файл")
    await streamedAudio.evaluate(async (element) => {
      if (element instanceof HTMLAudioElement) await element.play()
    })
    assert.ok(releaseAudio)
    releaseAudio()
    await expect(streamed.getByRole("status")).toHaveCount(0, { timeout: 15000 })
    await streamedAudio.evaluate((element) => {
      if (element instanceof HTMLAudioElement) element.pause()
    })
    const chartPage = await registered.newPage()
    await chartPage.goto(`${origin}/music-chart`)
    await expect(chartPage.locator("#music-chart-upload-form")).toBeVisible()
    const wav = Buffer.alloc(44 + 8000 * 2 * 30)
    wav.write("RIFF", 0)
    wav.writeUInt32LE(wav.length - 8, 4)
    wav.write("WAVEfmt ", 8)
    wav.writeUInt32LE(16, 16)
    wav.writeUInt16LE(1, 20)
    wav.writeUInt16LE(1, 22)
    wav.writeUInt32LE(8000, 24)
    wav.writeUInt32LE(16000, 28)
    wav.writeUInt16LE(2, 32)
    wav.writeUInt16LE(16, 34)
    wav.write("data", 36)
    wav.writeUInt32LE(wav.length - 44, 40)
    await chartPage.locator("#music-chart-title").fill("Проверка музыки")
    await chartPage
      .locator("#music-chart-audio")
      .setInputFiles({ name: "test.wav", mimeType: "audio/wav", buffer: wav })
    await chartPage.locator("#upload-music-track").click()
    const track = chartPage.locator("#music-chart-tracks article").first()
    await expect(track).toBeVisible()
    await track.getByRole("button", { name: "Изменить название трека" }).click()
    await track.getByRole("textbox", { name: "Название трека", exact: true }).fill("Проверка музыки — новое название")
    await track.getByRole("button", { name: "Сохранить" }).click()
    await expect(track.locator("h3")).toHaveText("Проверка музыки — новое название")
    await track.locator('input[name="body"]').fill("Проверка комментария")
    await track.getByRole("button", { name: "Отправить", exact: true }).click()
    await expect(track).toContainText("Проверка комментария")
    const audio = track.locator("audio")
    const source = await audio.getAttribute("src")
    assert.ok(source)
    const range = await registered.request.get(`${origin}${source}`, { headers: { Range: "bytes=0-43" } })
    assert.equal(range.status(), 206)
    assert.equal((await range.body()).length, 44)
    await audio.evaluate(async (element) => {
      if (element instanceof HTMLAudioElement) await element.play()
    })
    const listening = recipientPage.locator('[data-peer-nickname="browser-registered"] [id^="listening-chatlan-"]')
    await expect(listening).toHaveAttribute("title", "Слушает: Проверка музыки — новое название")
    await audio.evaluate((element) => {
      if (element instanceof HTMLAudioElement) element.pause()
    })
    await expect(listening).toHaveCount(0)
    await chartPage.close()
    const popup = recipientPage.waitForEvent("popup")
    await recipientPage.getByRole("link", { name: "Хит-парад", exact: true }).click()
    const guestChart = await popup
    const guestAudio = guestChart.locator("#music-chart-tracks audio").first()
    await guestAudio.evaluate(async (element) => {
      if (element instanceof HTMLAudioElement) await element.play()
    })
    const guestListening = page.locator('[data-peer-nickname="file-recipient"] [id^="listening-chatlan-"]')
    await expect(guestListening).toHaveAttribute("title", "Слушает: Проверка музыки — новое название")
    await guestChart.close()
    await expect(guestListening).toHaveCount(0)
    await recipientPage.locator("#leave-chat").click()
    await expect(recipientPage).toHaveURL(`${origin}/`)
    await recipientContext.close()
  }
  const account = await registered.newPage()
  await account.goto(`${origin}/profiles`)
  await expect(account.locator("#site-account-nickname")).toHaveText("browser-registered")
  await account.locator("#site-account-logout-submit").click()
  await expect(account.locator("#site-account-nickname")).toHaveCount(0)
  await page.reload()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
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
  await verifyVisits(browser, origin)
  console.log(
    "Go chat browser: guest/registered entrance, reserved nickname, two tabs, messages, reload, duplicate-tab lock, offline outbox, site logout independence, terminal leave and denied storage passed",
  )
} finally {
  await browser.close()
}
