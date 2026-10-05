import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { expect, type Page } from "@playwright/test"
import { launchBrowser } from "./coverage"
import { verifyPersonalSettings } from "./personal-settings"

const origin = process.argv[2] ?? "http://127.0.0.1:4063"
const output = "/app/docs/design/chat-glass/functional"
await mkdir(output, { recursive: true })
const browser = await launchBrowser({ headless: true, args: ["--no-sandbox"] })
async function settings(page: Page) {
  await page.locator("#message-body").fill("/настройки")
  await page.locator("#send-message").click()
  await expect(page.locator("#settings-panel")).toBeVisible()
}
try {
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [844, 390],
    [320, 568],
  ] as const) {
    const context = await browser.newContext({ viewport: { width, height }, locale: "ru-RU", reducedMotion: "reduce" })
    const page = await context.newPage()
    try {
      await page.goto(`${origin}/chat`)
      await expect(page.locator("#chat-login-link")).toBeVisible()
      await page.locator("#chat-login-link").click()
      await page.locator("#entrance-nickname").fill(`glass-${String(width)}-${String(Date.now()).slice(-6)}`)
      await page.locator("#enter-chat").click()
      await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
      await settings(page)
      await page.locator("#theme-id").selectOption("vertigo_glass")
      await page.locator("#message-frame").selectOption("true")
      await page.locator("#save-preferences").click()
      await page.reload()
      await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-theme", "vertigo_glass")
      await expect(page.locator("#message-body")).toBeEnabled()
      await expect(page.locator("#messages")).toHaveAttribute("data-message-frame", "true")
      await expect(page.locator("#dialogue-frame")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
      await expect(page.locator("#dialogue-frame")).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)")
      if (width < 1024) {
        const menu = page.locator("#mobile-main-menu > summary")
        const box = await menu.boundingBox()
        assert.ok(box && box.x >= 0 && box.x + box.width <= width, "Mobile navigation fits inside the screen")
      }
      if (width >= 768 && height > 480) {
        const cat = page.locator("#karmik-sprite")
        await expect(cat).toBeVisible()
        await expect(cat).toHaveCSS("background-image", "none")
        assert.ok(
          await page
            .locator("#chat-room")
            .evaluate((el) => getComputedStyle(el).backgroundImage.includes("vertigo-glass-lap-v3")),
        )
        const box = await cat.boundingBox()
        assert.ok(box && box.x >= width - 320 && box.x + box.width <= width && box.y > 0 && box.y + box.height < height)
        await page.emulateMedia({ reducedMotion: "no-preference" })
        await cat.click()
        await expect(page.locator("#karmik")).toHaveAttribute("data-mood", "happy")
        await expect(page.locator("#karmik-purr")).toBeVisible()
        assert.equal(await cat.evaluate((el) => getComputedStyle(el).animationName), "karmik-glass-pet")
        await page.screenshot({ path: `${output}/karmik-happy.png` })
        await page.emulateMedia({ reducedMotion: "reduce" })
        assert.equal(await cat.evaluate((el) => getComputedStyle(el).animationName), "none")
        await page.mouse.move(0, 0)
        await page.reload()
        await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
        await expect(cat).toBeVisible()
        await cat.focus()
        await expect(cat).toBeFocused()
        await page.keyboard.press("Enter")
        await expect(page.locator("#karmik")).toHaveAttribute("data-mood", "happy")
        await settings(page)
        await page.locator("#use-player").check()
        await page.locator("#save-preferences").click()
        await page.locator("#chat-tv-toggle").click()
        await expect(page.locator("#chat-tv")).toHaveAttribute("data-mode", "expanded")
        await expect(cat).toBeHidden()
        await expect(page.locator("#chat-tv-panel")).toHaveCSS("backdrop-filter", "blur(5px) saturate(1.1)")
        await page.locator("#chat-tv-collapse").click()
        await expect(cat).toBeVisible()
        await page.locator("#chat-tv-mini-off").click()
      }
      await settings(page)
      await page.locator("#hide-karmik").check()
      await page.locator("#save-preferences").click()
      await expect(page.locator("#karmik")).toHaveCount(0)
      await expect(page.locator("#chat-room")).toHaveAttribute("data-hide-karmik", "true")
      assert.ok(
        await page
          .locator("#chat-room")
          .evaluate((el) => getComputedStyle(el).backgroundImage.includes("lap-empty-v5")),
      )
      await page.reload()
      await expect(page.locator("#chat-room")).toHaveAttribute("data-hide-karmik", "true")
      await settings(page)
      await page.locator("#hide-karmik").uncheck()
      await page.locator("#save-preferences").click()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const input = await page.locator("#message-body").boundingBox()
      assert.ok(input && input.x >= 0 && input.y + input.height <= height)
      await page.locator("#show-command-menu").click()
      const option = page.locator('[data-command="/настройки"]')
      await expect(option).toBeVisible()
      assert.equal(
        await option.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          return target !== null && element.contains(target)
        }),
        true,
        "The rounded composer must not clip or cover autocomplete",
      )
      await page.screenshot({ path: `${output}/${String(width)}-commands.png` })
      await option.click()
      await page.locator("#send-message").click()
      await expect(page.locator("#settings-panel")).toBeVisible()
      await page.locator("#close-settings").click()
      await page.locator("#toggle-emoji-picker").click()
      await expect(page.locator("#emoji-picker")).toBeVisible()
      await page.locator("#toggle-emoji-picker").click()
      const message = `Проверка стеклянной темы ${String(width)} · ${String(Date.now())}`
      await page.locator("#message-body").fill(message)
      await page.locator("#send-message").click()
      await expect(page.locator("#messages")).toContainText(message)
      await page.reload()
      await expect(page.locator("#messages")).toContainText(message)
      const card = page.locator("#messages > .chat-message-entry").filter({ hasText: message })
      await expect(card).toHaveCSS("border-top-width", "1px")
      await expect(card).toHaveCSS("border-radius", "12px")
      await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-theme", "vertigo_glass")
      await page.screenshot({ path: `${output}/${String(width)}-sent.png` })
      await settings(page)
      await page.locator("#message-frame").selectOption("false")
      await page.locator("#save-preferences").click()
      await expect(page.locator("#messages")).toHaveAttribute("data-message-frame", "false")
      await expect(page.locator("#messages")).toContainText(message)
      await expect(page.locator("#dialogue-frame")).toHaveCSS("border-radius", width < 768 ? "17px" : "20px")
      assert.notEqual(
        await page.locator("#dialogue-frame").evaluate((el) => getComputedStyle(el).backgroundImage),
        "none",
      )
      await page.reload()
      await expect(page.locator("#messages")).toHaveAttribute("data-message-frame", "false")
      await page.screenshot({ path: `${output}/${String(width)}-plain.png` })
      await settings(page)
      await page.locator("#theme-id").selectOption("dark")
      await page.locator("#save-preferences").click()
      await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-theme", "dark")
      assert.equal(await page.locator("#chat-room").evaluate((element) => getComputedStyle(element).padding), "0px")
      assert.equal(
        await page
          .locator("#chat-room")
          .evaluate((element) => getComputedStyle(element).backgroundImage.includes("glass-evening")),
        false,
      )
      await page.locator("#leave-chat").click()
      console.log(`Glass ${String(width)}×${String(height)}: reload, send, menus, settings, theme isolation OK`)
    } finally {
      await context.close()
    }
  }
  await verifyPersonalSettings(browser, origin)
  console.log("Existing personal-settings boundary scenarios OK")
} finally {
  await browser.close()
}
