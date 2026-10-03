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
    await expect(admin.locator("#admin-polls-form")).toBeVisible()
    await admin.locator("#poll-question").fill(question)
    await admin.locator("#poll-option-1").fill("Создание")
    await admin.locator("#poll-option-2").fill("Голосование")
    await admin.locator("#create-poll").click()
    await expect(admin.locator("#admin-poll-1")).toContainText(question)

    const guestContext = await browser.newContext()
    try {
      const guest = await guestContext.newPage()
      await guest.goto(origin)
      await guest.locator("#entrance-nickname").fill("poll-browser-guest")
      await guest.locator("#enter-chat").click()
      await expect(guest.locator("#chat-logo")).toBeVisible()
      await expect(guest.locator("#poll-system-notice-1")).toContainText(question)
      await expect(guest.locator("#poll-system-notice-1")).toHaveAttribute("data-private-notice", "true")
      await guest.goto(`${origin}/polls`)
      const pollsPage = guest
      await expect(pollsPage.locator("#poll-1")).toContainText(question)
      await expect(pollsPage.locator("#poll-1-option-1")).toBeEnabled()
      const voteResponse = pollsPage.waitForResponse((response) => response.url().includes("/api/v1/polls/1/votes"))
      await pollsPage.locator("#poll-1-option-1").click()
      expect((await voteResponse).status()).toBe(201)
      await expect(pollsPage.locator("#poll-1")).toContainText("Ваш выбор")
      await expect(pollsPage.locator("#poll-1")).toContainText("Всего голосов 1")
      await pollsPage.reload()
      await expect(pollsPage.locator("#poll-1")).toContainText("Ваш выбор")
      await pollsPage.goto(`${origin}/chat`)
      await expect(guest.locator("#poll-system-notice-1")).toHaveCount(0)
      await guest.goto(`${origin}/polls`)
      await admin.locator("#close-poll-1").click()
      await expect(admin.locator("#close-poll-1")).toHaveCount(0)
      await pollsPage.reload()
      await expect(pollsPage.locator("#poll-1")).toContainText("Завершён")
    } finally {
      await guestContext.close()
    }
  } finally {
    await adminContext.close()
  }
}
