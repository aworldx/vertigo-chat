import { expect, type Page } from "@playwright/test"
export async function verifyBotAdmin(page: Page, origin: string) {
  await page.goto(origin + "/admin?section=bots")
  await expect(page.getByRole("heading", { name: "Боты", exact: true })).toBeVisible()
  await expect(page.locator("#bot-daily-tokens")).toBeVisible()
  await page.locator("#bot-daily-tokens").fill("64000")
  await page.locator("#bot-stop-percent").fill("85")
  await page.locator("#save-bot-budget").click()
  await expect(page.locator("#bot-budget-form [role=status]")).toHaveText("Изменения сохранены.")
  await page.locator("#claire-font").selectOption("serif")
  await page.locator("#claire-font-style").selectOption("italic")
  for (const [field, color] of [
    ["dark-nickname_color", "#ff8844"],
    ["dark-text_color", "#ddeeff"],
    ["light-nickname_color", "#663311"],
    ["light-text_color", "#223344"],
  ] as const)
    await page.locator(`#claire-${field}`).fill(color)
  await expect(page.locator("#claire-preview-dark")).toHaveCSS("font-style", "italic")
  await expect(page.locator("#claire-preview-dark span").first()).toHaveCSS("color", "rgb(255, 136, 68)")
  await page.locator("#save-claire-style").click()
  await expect(page.locator("#claire-style-form [role=status]")).toBeVisible()
  await page.reload()
  await expect(page.locator("#bot-daily-tokens")).toHaveValue("64000")
  await expect(page.locator("#bot-stop-percent")).toHaveValue("85")
  await expect(page.locator("#claire-font")).toHaveValue("serif")
  await expect(page.locator("#claire-dark-nickname_color")).toHaveValue("#ff8844")
  await expect(page.locator("#hitchcock-font")).toHaveValue("theme")
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    await expect(page.locator("#save-claire-style")).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `migration-results/community/${String(width)}-admin-bots.png`, fullPage: true })
  }
  await page.route("**/api/v1/admin/bots/*/style", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' })
  })
  await page.locator("#hitchcock-font").selectOption("display")
  await page.locator("#save-hitchcock-style").click()
  await expect(page.locator("#hitchcock-style-form [role=alert]")).toBeVisible()
  await expect(page.locator("#hitchcock-font")).toHaveValue("display")
  await page.unroute("**/api/v1/admin/bots/*/style")
  await page.locator("#save-hitchcock-style").click()
  await expect(page.locator("#hitchcock-style-form [role=status]")).toBeVisible()
  await page.route("**/api/v1/admin/bots", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' })
  })
  await page.reload()
  await expect(page.locator("#retry-bots")).toBeVisible()
  await page.unroute("**/api/v1/admin/bots")
  await page.locator("#retry-bots").click()
  await expect(page.locator("#bot-daily-tokens")).toHaveValue("64000")
  await page.getByRole("link", { name: "Теги", exact: true }).click()
  await expect(page.locator("#admin-emoji-tag-form")).toBeVisible()
  await page.goBack()
  await expect(page.locator("#bot-daily-tokens")).toHaveValue("64000")
}
