import assert from "node:assert/strict"
import { expect, type Browser, type Page } from "@playwright/test"

export async function verifyModeration(browser: Browser, origin: string) {
  const adminContext = await browser.newContext()
  const guestContext = await browser.newContext()
  try {
    const admin = await adminContext.newPage()
    const guest = await guestContext.newPage()
    for (const [page, nickname, password] of [
      [admin, "fixture13", "secret123"],
      [guest, "moderation-guest", ""],
    ] as const) {
      await page.goto(`${origin}/`)
      await page.locator("#entrance-nickname").fill(nickname)
      await page.locator("#entrance-password").fill(password)
      await page.locator("#enter-chat").click()
      await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
    }
    for (const width of [390, 1440]) {
      for (const frame of [true, false]) {
        await admin.setViewportSize({ width: 1440, height: 900 })
        await admin.locator("#toggle-settings").click()
        await admin.locator("#message-frame").selectOption(String(frame))
        await admin.locator("#save-preferences").click()
        await expect(admin.locator("#settings-modal")).toHaveCount(0)
        await admin.setViewportSize({ width, height: 900 })
        assert.equal(
          await admin.locator("#messages").evaluate((el) => getComputedStyle(el).rowGap),
          frame ? "12px" : "6px",
        )
        const body = `moderation ${String(width)} ${String(frame)}`
        await guest.locator("#message-body").fill(body)
        await guest.locator("#send-message").click()
        const message = admin.locator(".chat-message-entry").filter({ hasText: body })
        await expect(message).toHaveAttribute("data-message-frame", String(frame))
        await message.hover()
        await expect.poll(() => message.evaluate((el) => getComputedStyle(el, "::after").opacity)).toBe("1")
        await message.getByRole("button", { name: "Добавить реакцию" }).click()
        await message.getByRole("button", { name: "Поставить реакцию 👍", exact: true }).click()
        const reaction = message.getByRole("button", { name: "👍 1", exact: true })
        await expect(reaction).toHaveAttribute("aria-pressed", "true")
        const authored = guest.locator(".chat-message-entry").filter({ hasText: body })
        await expect(authored.getByRole("button", { name: "👍 1", exact: true })).toBeDisabled()
        await expect(authored.getByRole("button", { name: "Добавить реакцию" })).toHaveCount(0)
        assert.equal(await message.evaluate((el) => el.scrollWidth > el.clientWidth), false)
        await reaction.click()
        await expect(reaction).toHaveCount(0)
        const remove = message.getByRole("button", { name: "Удалить сообщение" })
        await expect(remove).toBeVisible()
        assert.equal(await remove.evaluate((el) => getComputedStyle(el).opacity), "1")
        await admin.screenshot({ path: `test-results/moderation-${String(width)}-${String(frame)}.png` })
        await expect(guest.getByRole("button", { name: "Удалить сообщение" })).toHaveCount(0)
        admin.once("dialog", (dialog) => {
          void dialog.dismiss()
        })
        await remove.click()
        await expect(message).toBeVisible()
        admin.once("dialog", (dialog) => {
          void dialog.accept()
        })
        await remove.click()
        await expect(message).toHaveCount(0)
        await expect(guest.locator(".chat-message-entry").filter({ hasText: body })).toHaveCount(0)
      }
    }
    await verifyArchiveDeletion(admin, guest, origin)
    await Promise.all([admin.waitForURL(origin + "/", { waitUntil: "load" }), admin.locator("#leave-chat").click()])
    await Promise.all([guest.waitForURL(origin + "/", { waitUntil: "load" }), guest.locator("#leave-chat").click()])
    console.log(
      "Moderation verified: visible admin deletion in both layouts and widths, confirmation, cancellation and removal for all participants.",
    )
  } finally {
    await adminContext.close()
    await guestContext.close()
  }
}

async function verifyArchiveDeletion(admin: Page, guest: Page, origin: string) {
  const body = "Удаление из архива для всех"
  await guest.locator("#message-body").fill(body)
  await guest.locator("#send-message").click()
  await expect(admin.locator("#messages")).toContainText(body)
  const archive = await admin.context().newPage()
  await archive.goto(origin + "/history")
  await archive.locator("#history-search").click()
  const row = archive.locator("li").filter({ hasText: body })
  await expect(row).toBeVisible()
  const button = row.getByRole("button", { name: "Удалить сообщение" })
  await expect(button).toBeVisible()
  await archive.screenshot({ path: "test-results/history-admin.png" })
  const id = (await button.getAttribute("id"))?.replace("history-delete-", "")
  assert.ok(id)
  assert.equal((await admin.request.delete(origin + "/api/v1/chat/history/" + id)).status(), 403)
  assert.equal((await guest.request.delete(origin + "/api/v1/chat/history/" + id)).status(), 401)
  await expect(archive.locator('[data-message-kind="system"] button')).toHaveCount(0)
  archive.once("dialog", (dialog) => {
    void dialog.dismiss()
  })
  await button.click()
  await expect(row).toBeVisible()
  archive.once("dialog", (dialog) => {
    void dialog.accept()
  })
  await button.click()
  await expect(row).toHaveCount(0)
  await expect(guest.locator(".chat-message-entry").filter({ hasText: body })).toHaveCount(0)
  await expect(admin.locator(".chat-message-entry").filter({ hasText: body })).toHaveCount(0)
  await archive.reload()
  await archive.locator("#history-search").click()
  await expect(archive.getByRole("status")).toContainText("На странице")
  await expect(row).toHaveCount(0)
  await archive.close()
}
