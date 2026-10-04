import { expect, type Browser } from "@playwright/test"

export async function verifyPolls(browser: Browser, origin: string) {
  const adminContext = await browser.newContext()
  const admin = await adminContext.newPage()
  const question = "Какой сценарий проверить?"
  try {
    await admin.goto(`${origin}/account/login`)
    await admin.locator("#react-account-nickname").fill("fixture01")
    await admin.locator("#react-account-password").fill("secret123")
    await admin.locator("#react-account-submit").click()
    await expect(admin.locator("#site-account-nickname")).toHaveText("fixture01")
    await admin.goto(`${origin}/admin?section=polls`)
    for (const [id, title] of [
      [1, question],
      [2, "Приглашение можно закрыть"],
    ] as const) {
      await admin.locator("#poll-question").fill(title)
      await admin.locator("#poll-option-1").fill("Создание")
      await admin.locator("#poll-option-2").fill("Голосование")
      await admin.locator("#create-poll").click()
      await expect(admin.locator(`#admin-poll-${String(id)}`)).toContainText(title)
    }

    for (const width of [1440, 390]) {
      const guestContext = await browser.newContext({ viewport: { width, height: 900 } })
      try {
        const guest = await guestContext.newPage()
        await guest.goto(origin)
        // Reproduce a named polls window opened before the chat session exists.
        const popupPromise = guestContext.waitForEvent("page")
        await guest.evaluate(() => {
          window.open("/polls", "vertigo-polls")
        })
        const pollsPage = await popupPromise
        await expect(pollsPage.locator("#poll-1-option-2")).toBeDisabled()
        await guest.locator("#entrance-nickname").fill(`poll-browser-${String(width)}`)
        await guest.locator("#enter-chat").click()
        await expect(guest.locator("#poll-system-notice-1")).toContainText(question)
        await expect(guest.locator("#poll-system-notice-1")).toHaveAttribute("data-private-notice", "true")
        await guest.locator("#dismiss-poll-2").click()
        await expect(guest.locator("#poll-system-notice-2")).toHaveCount(0)
        await guest.reload()
        await expect(guest.locator("#poll-system-notice-1")).toBeVisible()
        await expect(guest.locator("#poll-system-notice-2")).toHaveCount(0)

        await guest.locator("#message-body").fill("Сообщение после приглашения")
        await guest.locator("#send-message").click()
        const message = guest
          .locator('[data-message-kind="text"]')
          .filter({ hasText: "Сообщение после приглашения" })
          .last()
        await expect(message).toBeVisible()
        await expect
          .poll(async () => {
            const noticeBox = await guest.locator("#poll-system-notice-1").boundingBox()
            const messageBox = await message.boundingBox()
            return noticeBox !== null && messageBox !== null && noticeBox.y + noticeBox.height <= messageBox.y
          })
          .toBe(true)

        await guest.locator("#poll-system-notice-1 a").click()
        await expect(pollsPage.locator("#poll-1-option-2")).toBeEnabled()
        const voteResponse = pollsPage.waitForResponse((response) => response.url().includes("/api/v1/polls/1/votes"))
        await pollsPage.locator("#poll-1-option-2").click()
        expect((await voteResponse).status()).toBe(201)
        await expect(pollsPage.locator("#poll-1")).toContainText("Ваш выбор")
        await expect(guest.locator("#poll-system-notice-1")).toHaveCount(0)
        await pollsPage.reload()
        await expect(pollsPage.locator("#poll-1")).toContainText("Ваш выбор")
        await expect(pollsPage.locator("#poll-1 .poll-result[data-selected=true]")).toContainText("Голосование")
        await guest.reload()
        await expect(guest.locator("#chat-logo")).toBeVisible()
        await expect(guest.locator("#poll-system-notice-1")).toHaveCount(0)
        await expect(guest.locator("#poll-system-notice-2")).toHaveCount(0)
        await expect(pollsPage.locator("#poll-2-option-3")).toBeEnabled()
      } finally {
        await guestContext.close()
      }
    }
    await admin.locator("#close-poll-1").click()
    await expect(admin.locator("#close-poll-1")).toHaveCount(0)
    await admin.goto(`${origin}/polls`)
    await expect(admin.locator("#poll-1")).toContainText("Завершён")
  } finally {
    await adminContext.close()
  }
}
