import assert from "node:assert/strict"
import { expect, type Browser } from "@playwright/test"

export async function verifyLandingFlow(browser: Browser, origin: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  try {
    const page = await context.newPage()
    await page.goto(`${origin}/`)
    await page.locator("#landing-register-bottom").click()
    await expect(page.locator("#registration-form")).toBeVisible()
    await page.locator("#show-login").click()
    await expect(page.locator("#entrance-form")).toBeVisible()
    await page.locator("#entrance-nickname").focus()
    await page.keyboard.press("Tab")
    await expect(page.locator("#entrance-password")).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(page.locator("#enter-chat")).toBeFocused()

    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let requests = 0
    await page.route(
      "**/api/v1/chat/enter",
      async (route) => {
        requests++
        await gate
        await route.abort()
      },
      { times: 1 },
    )
    await page.locator("#entrance-nickname").fill("fixture01")
    await page.locator("#entrance-password").fill("secret123")
    await page.locator("#enter-chat").click()
    try {
      await expect.poll(() => requests).toBe(1)
      await expect(page.locator("#enter-chat")).toBeDisabled()
      await expect(page.locator("#enter-chat")).toHaveText("Входим…")
      // These links are outside the form and must not unmount a pending entrance.
      await page.locator("#landing-register").click()
      await page.locator("#landing-register-bottom").click()
      await expect(page.locator("#registration-form")).toHaveCount(0)
      await expect(page.locator("#enter-chat")).toBeDisabled()
      assert.equal(requests, 1)
    } finally {
      release()
    }
    await expect(page.locator("#entrance-error")).toContainText("Проверь соединение")
    await expect(page.locator("#enter-chat")).toBeEnabled()
    await page.locator("#enter-chat").click()
    await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
    await page.goto(`${origin}/`)
    await expect(page.locator("#site-account-nickname")).toHaveText("fixture01")
    await page.locator("#landing-resume-chat").click()
    await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
    await page.locator("#leave-chat").click()
    await expect(page).toHaveURL(`${origin}/`)
    await expect(page.locator("#landing-resume-chat")).toHaveCount(0)
  } finally {
    await context.close()
  }
}
