import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { expect, type Page } from "@playwright/test"
import { launchBrowser } from "./coverage"

const origin = process.argv[2] ?? "http://127.0.0.1:4092"
const output = "/app/docs/design/nice/functional"
await mkdir(output, { recursive: true })
const browser = await launchBrowser({ headless: true, args: ["--no-sandbox"] })
async function settings(page: Page) {
  await page.locator("#message-body").fill("/настройки")
  await page.locator("#send-message").click()
  await expect(page.locator("#settings-panel")).toBeVisible()
}
async function save(page: Page) {
  await page.locator("#save-preferences").click()
  await expect(page.locator("#settings-panel")).toHaveCount(0)
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
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    try {
      await page.goto(`${origin}/chat`)
      await expect(page.locator("#chat-login-link")).toBeVisible()
      await page.reload()
      await page.locator("#chat-login-link").click()
      await page.locator("#entrance-nickname").fill(`nice-${String(width)}-${String(Date.now()).slice(-7)}`)
      await page.locator("#enter-chat").click()
      await expect(page.locator("#message-body")).toBeEnabled()
      await settings(page)
      await page.locator("#theme-id").selectOption("nice")
      await save(page)
      await page.reload()
      await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-theme", "nice")
      await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-mode", "light")
      await expect(page.locator("#message-body")).toBeEnabled()
      const message = `Ницца ${String(width)} ${String(Date.now())}`
      await page.locator("#message-body").fill(message)
      await page.locator("#send-message").click()
      await expect(page.locator("#messages")).toContainText(message)
      await page.reload()
      await expect(page.locator("#messages")).toContainText(message)
      for (const state of ["top", "viewport", "bottom"]) {
        await page.locator("#messages").evaluate((el, state) => {
          el.scrollTop = state === "top" ? 0 : state === "viewport" ? el.clientHeight : el.scrollHeight
        }, state)
        await page.screenshot({ path: `${output}/${String(width)}-${state}.png` })
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const input = await page.locator("#message-body").boundingBox()
      assert.ok(input && input.x >= 0 && input.y + input.height <= height)
      await page.locator("#show-command-menu").click()
      const option = page.locator('[data-command="/настройки"]')
      await expect(option).toBeVisible()
      assert.ok(
        await option.evaluate((el) => {
          const b = el.getBoundingClientRect()
          return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2))
        }),
      )
      await option.click()
      await page.locator("#send-message").click()
      await expect(page.locator("#settings-panel")).toBeVisible()
      await page.locator("#message-frame").selectOption("false")
      await page.locator("#appearance-colors summary").click()
      await page.locator("#light-text-color").fill("#234567")
      await save(page)
      await expect(page.locator("#messages")).toHaveAttribute("data-message-frame", "false")
      const colored = `Цвет ${String(width)} ${String(Date.now())}`
      await page.locator("#message-body").fill(colored)
      await page.locator("#send-message").click()
      await expect(page.locator(".chat-message-body").filter({ hasText: colored })).toHaveCSS(
        "color",
        "rgb(35, 69, 103)",
      )
      await page.locator("#toggle-emoji-picker").click()
      await expect(page.locator("#emoji-picker")).toBeVisible()
      await page.locator("#toggle-emoji-picker").click()
      if (width >= 768 && height > 480) {
        const pet = page.locator("#karmik-sprite")
        await expect(pet).toBeVisible()
        await expect(pet).toHaveCSS("background-image", "none")
        await pet.click()
        await expect(page.locator("#karmik-purr")).toBeVisible()
        await page.screenshot({ path: `${output}/${String(width)}-pet.png` })
        await page.reload()
        await expect(page.locator("#message-body")).toBeEnabled()
        await pet.focus()
        await page.keyboard.press("Enter")
        await expect(page.locator("#karmik-purr")).toBeVisible()
        await settings(page)
        await page.locator("#use-player").check()
        await save(page)
        await page.locator("#chat-tv-toggle").click()
        await expect(pet).toBeHidden()
        await page.screenshot({ path: `${output}/${String(width)}-player.png` })
        await page.locator("#chat-tv-collapse").click()
        await expect(pet).toBeVisible()
        await page.locator("#chat-tv-mini-off").click()
      }
      await settings(page)
      await page.locator("#hide-karmik").check()
      await save(page)
      await expect(page.locator("#karmik")).toHaveCount(0)
      assert.ok(
        await page
          .locator("#chat-room")
          .evaluate((el) => getComputedStyle(el).backgroundImage.includes("nice-promenade-empty-v1")),
      )
      await page.reload()
      await expect(page.locator("#chat-room")).toHaveAttribute("data-hide-karmik", "true")
      await settings(page)
      await page.locator("#theme-id").selectOption("dark")
      await save(page)
      await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-theme", "dark")
      assert.ok(
        await page
          .locator("#chat-room")
          .evaluate((el) => !getComputedStyle(el).backgroundImage.includes("nice-promenade")),
      )
      await settings(page)
      await page.locator("#theme-id").selectOption("nice")
      await page.locator("#hide-karmik").uncheck()
      await save(page)
      assert.deepEqual(errors, [])
      await page.locator("#leave-chat").click()
    } finally {
      await context.close()
    }
  }
  const senderContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const receiverContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  try {
    const sender = await senderContext.newPage()
    const receiver = await receiverContext.newPage()
    const recipient = `nice-private-${String(Date.now()).slice(-7)}`
    for (const [page, name] of [
      [sender, `${recipient}-a`],
      [receiver, recipient],
    ] as const) {
      await page.goto(origin)
      await page.locator("#entrance-nickname").fill(name)
      await page.locator("#enter-chat").click()
      await expect(page.locator("#message-body")).toBeEnabled()
      await settings(page)
      await page.locator("#theme-id").selectOption("nice")
      await save(page)
    }
    const secret = `Личное ${String(Date.now())}`
    await sender.locator("#message-body").fill(`^${recipient}, ${secret}`)
    await sender.locator("#send-message").click()
    const privateEntry = receiver.locator('.chat-message-entry[data-private="true"]').filter({ hasText: secret })
    await expect(privateEntry).toBeVisible()
    await expect(privateEntry).toHaveCSS("background-color", "rgb(232, 243, 250)")
    await privateEntry.scrollIntoViewIfNeeded()
    await receiver.screenshot({ path: `${output}/private.png` })
    await receiver.reload()
    await expect(receiver.locator("#message-body")).toBeEnabled()
    await expect(receiver.locator("#messages")).not.toContainText(secret)
    const addressed = `Обращение ${String(Date.now())}`
    await sender.locator("#message-body").fill(`${recipient}, ${addressed}`)
    await sender.locator("#send-message").click()
    await expect(
      receiver.locator('.chat-message-entry[data-addressed-to-me="true"]').filter({ hasText: addressed }),
    ).toHaveCSS("background-color", "rgb(255, 242, 217)")
    await receiver.locator("#leave-chat").click()
    await sender.locator("#leave-chat").click()
  } finally {
    await senderContext.close()
    await receiverContext.close()
  }
  console.log(
    "Nice verifier: five viewports, persistence, send, menus, custom colours, pet, player, hide and theme isolation PASS",
  )
} finally {
  await browser.close()
}
