import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { expect, type Browser } from "@playwright/test"

export async function verifyHistorySummary(browser: Browser, origin: string) {
  const context = await browser.newContext({ locale: "ru-RU" })
  try {
    const page = await context.newPage()
    await page.goto(`${origin}/history`)
    await expect(page.locator("#history-summarize")).toBeDisabled()
    const denied = await page.evaluate(
      async () =>
        (
          await fetch("/api/v1/chat/history/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          })
        ).status,
    )
    assert.equal(denied, 401)
    await page.goto(`${origin}/account`)
    await page.locator("#react-account-nickname").fill("fixture07")
    await page.locator("#react-account-password").fill("secret123")
    await page.locator("#react-account-submit").click()
    await expect(page.locator("#forum-email")).toBeVisible()
    await page.goto(`${origin}/history`)
    await expect(page.locator("#history-summarize")).toBeEnabled()
    const csrfDenied = await page.evaluate(
      async () =>
        (
          await fetch("/api/v1/chat/history/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-CSRF-Token": "wrong" },
            body: "{}",
          })
        ).status,
    )
    assert.equal(csrfDenied, 403)
    await page.locator("#history-from").fill("2000-01-01T00:00")
    await page.locator("#history-through").fill("2000-01-01T23:59")
    await page.locator("#history-summarize").click()
    await expect(page.getByRole("alert")).toContainText("нет сообщений для сводки")
    let responseError = ""
    let calls = 0
    let release: () => void = () => {
      throw new Error("not pending")
    }
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route("**/api/v1/chat/history/summary", async (route) => {
      calls++
      const body: unknown = route.request().postDataJSON()
      assert.deepEqual(body, {
        from: "2026-09-28T10:15",
        through: "2026-09-28T11:45",
        author: "Автор",
        recipient: "Кому",
      })
      assert.ok(route.request().headers()["x-csrf-token"])
      if (calls === 1) await gate
      await route.fulfill(
        responseError
          ? { status: responseError === "summary_busy" ? 429 : 422, json: { error: responseError } }
          : {
              json: {
                summary: "• Обсудили фильмы и актёров.\n• Договорились вернуться к выбору фильма вечером.",
                messages: 205,
              },
            },
      )
    })
    await page.locator("#history-from").fill("2026-09-28T10:15")
    await page.locator("#history-through").fill("2026-09-28T11:45")
    await page.locator("#history-author").fill(" Автор ")
    await page.locator("#history-recipient").fill("Кому")
    await page.locator("#history-summarize").click()
    await expect(page.locator("#history-summarize")).toBeDisabled()
    await expect(page.getByRole("status").filter({ hasText: "Готовим AI-саммари" })).toBeVisible()
    release()
    await expect(page.locator("#history-summary")).toContainText("Сообщений: 205")
    await expect(page.locator("#history-summary")).toContainText("От: Автор")
    await expect(page.locator("#history-messages")).toHaveCount(0)
    await mkdir("migration-results/history-summary", { recursive: true })
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.locator("#history-summarize").scrollIntoViewIfNeeded()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.screenshot({ path: `migration-results/history-summary/${String(width)}.png` })
    }
    responseError = "summary_period_too_large"
    await page.locator("#history-summarize").click()
    await expect(page.getByRole("alert")).toContainText("Слишком большой период")
    responseError = "summary_busy"
    await page.locator("#history-summarize").click()
    await expect(page.getByRole("alert")).toContainText("ещё не прошла минута")
    responseError = "summary_unavailable"
    await page.locator("#history-summarize").click()
    await expect(page.getByRole("alert")).toContainText("общий бюджет токенов")
  } finally {
    await context.close()
  }
}
