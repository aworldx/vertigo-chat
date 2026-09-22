import { expect, type Page } from "@playwright/test"

export const landingScenarios = [
  "landing",
  "landing-invalid-nickname",
  "landing-password-required",
  "landing-invalid-password",
  "landing-register",
  "landing-registration-nickname",
  "landing-registration-password",
  "landing-registration-email",
  "landing-registration-taken",
] as const

export async function prepareLanding(page: Page, origin: string, scenario: string, legacy: boolean) {
  // Every scenario starts from the same untouched form, independently of focus,
  // scroll anchoring and errors left by the preceding comparison.
  await page.goto(`${origin}/`)
  if (legacy) await expect(page.locator("[data-phx-main]")).toHaveClass(/phx-connected/)
  if (scenario === "landing") return
  if (scenario === "landing-register" || scenario.startsWith("landing-registration-")) {
    await page.locator("#landing-show-registration").click()
    await expect(page.locator("#registration-form")).toBeVisible()
    if (scenario === "landing-register") return
    const nickname =
      scenario === "landing-registration-nickname"
        ? "!"
        : scenario === "landing-registration-taken"
          ? "fixture01"
          : "новый-чатланин"
    await page.locator("#registration-nickname").fill(nickname)
    await page
      .locator("#registration-password")
      .fill(scenario === "landing-registration-password" ? "short" : "secret123")
    if (scenario === "landing-registration-email") await page.locator("#registration-email").fill("missing-dot@example")
    await page.locator("#register-user").click()
    const messages: Record<string, string> = {
      "landing-registration-nickname": "Ник должен быть свободным и состоять из 3–24 букв, цифр, _ или -.",
      "landing-registration-taken": "Ник должен быть свободным и состоять из 3–24 букв, цифр, _ или -.",
      "landing-registration-password": "Пароль должен быть не короче 6 символов.",
      "landing-registration-email": "Введи корректный email, который ещё не используется.",
    }
    await expect(page.locator("#registration-error")).toHaveText(messages[scenario] ?? "")
  } else {
    await page.locator("#entrance-nickname").fill(scenario === "landing-invalid-nickname" ? "!" : "fixture01")
    if (scenario === "landing-invalid-password") await page.locator("#entrance-password").fill("incorrect")
    await page.locator("#enter-chat").click()
    const messages: Record<string, string> = {
      "landing-invalid-nickname": "Введи ник из 3–24 букв, цифр, _ или -.",
      "landing-password-required": "Этот ник зарегистрирован. Введи пароль.",
      "landing-invalid-password": "Неверный пароль.",
    }
    await expect(page.locator("#entrance-error")).toHaveText(messages[scenario] ?? "")
  }
}
