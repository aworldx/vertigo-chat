import { expect, type Browser, type Page } from "@playwright/test"
import { PNG } from "pngjs"

async function login(page: Page, origin: string, nickname: string) {
  await page.goto(origin + "/account/login")
  await page.locator("#react-account-nickname").fill(nickname)
  await page.locator("#react-account-password").fill("secret123")
  await page.locator("#react-account-login-form button[type=submit]").click()
  await expect(page.locator("#site-account-nickname")).toHaveText(nickname)
  await page.goto(origin + "/library")
  await expect(page.locator("#new-library-article")).toBeVisible()
}
async function save(page: Page, width: number) {
  await page.locator(width < 1024 ? "#save-library-article-mobile" : "#save-library-article").click()
  await expect(page.locator("#library-editor")).toHaveCount(0)
  await page.locator("#flash-info button").click()
}
export async function verifyLibraryActions(browser: Browser, origin: string) {
  const png = new PNG({ width: 80, height: 60 })
  png.data.fill(160)
  const file = { name: "illustration.png", mimeType: "image/png", buffer: PNG.sync.write(png) }
  await verifyGuest(browser, origin)
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await login(page, origin, "fixture01")
    expect((await page.request.put(origin + "/api/v1/library/1/like", { data: { active: true } })).status()).toBe(403)
    const title = `Иллюстрации ${String(width)}`,
      series = `Серия ${String(width)}`
    await page.locator("#new-library-article").click()
    await page.locator("#article_title").fill(title)
    await page.locator("#article_series").fill(series)
    await page.locator("#article_part_number").fill("1")
    await page.locator("#article_body").fill("Текст перед иллюстрацией")
    await page
      .locator("#library-cover-file")
      .setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: Buffer.from("not a PNG") })
    await expect(page.getByRole("alert")).toContainText("JPEG или PNG")
    await page.locator("#library-cover-file").setInputFiles(file)
    await expect(page.locator(".library-cover-field img")).toBeVisible()
    await page.locator("#article_body").click()
    await page.locator("#article_body").press("ControlOrMeta+End")
    const chooserPromise = page.waitForEvent("filechooser")
    await page.locator("#article-format-image").click()
    await (await chooserPromise).setFiles(file)
    await expect(page.locator("#article_body img")).toHaveCount(1)
    await expect(page.locator(width < 1024 ? "#save-library-article-mobile" : "#save-library-article")).toBeEnabled()
    if (width < 1024) {
      await page.locator("#library-preview-tab").click()
      await expect(page.locator(".library-editor-preview img")).toHaveCount(2)
      await page.locator("#library-editor-tab").click()
    }
    await save(page, width)
    await page.reload()
    const card = page.locator(`[data-article-title="${title}"]`)
    await expect(card).toBeVisible()
    await expect(card.locator(".library-cover")).toHaveAttribute("src", /^\/library\/images\//)
    await card.getByRole("button", { name: /Читать полностью/ }).click()
    await expect(card.locator(".library-full-text img")).toBeVisible()
    const imageURL = await card.locator(".library-full-text img").getAttribute("src")
    expect((await page.request.get(origin + String(imageURL))).headers()["content-type"]).toBe("image/png")
    await card.getByRole("button", { name: "Нравится", exact: true }).click()
    await expect(card.getByRole("button", { name: "Убрать лайк" })).toHaveText("♥ 1")
    await card.getByRole("button", { name: "Добавить в закладки" }).click()
    await expect(card.getByRole("button", { name: "Убрать из закладок" })).toHaveAttribute("aria-pressed", "true")
    await page.locator("#library-bookmarks").click()
    await expect(page.locator("#library-articles article")).toHaveCount(1)
    await page.reload()
    await expect(card).toBeVisible()
    await expect(card.getByRole("button", { name: "Убрать лайк" })).toBeVisible()
    await card.getByRole("button", { name: "Убрать лайк" }).click()
    await expect(card.getByRole("button", { name: "Нравится", exact: true })).toHaveText("♡ 0")
    await card.getByRole("button", { name: "Убрать из закладок" }).click()
    await expect(page.locator("#library-empty")).toContainText("В закладках пока пусто")
    await page.reload()
    await expect(page.locator("#library-empty")).toBeVisible()
    await page.locator("#all-library-articles").click()
    await card.getByRole("button", { name: `Редактировать ${title}`, exact: true }).click()
    await expect(page.locator("#article_body img")).toHaveCount(1)
    await page.locator("#library-cover-remove").click()
    await save(page, width)
    await page.reload()
    await expect(card.locator(".library-cover")).toHaveAttribute("src", /^\/images\/library-cover-/)
    await card.locator(".library-card-series").click()
    await page.locator("#edit-library-series").click()
    await page.locator("#library-series-name").fill(series + " — новое название")
    await page.locator("#library-series-description").fill("Описание всей серии.\nВторая строка.")
    await page.locator("#save-library-series").click()
    await expect(page.locator("#library-series-editor")).toHaveCount(0)
    await expect(page.locator(".library-section-heading h2")).toHaveText(series + " — новое название")
    await page.reload()
    await expect(page.locator(".library-section-description p")).toContainText("Описание всей серии.")
    await expect(card.locator(".library-card-series")).toContainText("новое название")
    const ownURL = page.url()
    await card.getByRole("button", { name: "Добавить в закладки" }).click()
    await expect(card.getByRole("button", { name: "Убрать из закладок" })).toBeVisible()
    await verifyOtherReader(browser, origin, ownURL)
    await verifyFailureRetry(page, title)
    await card.getByRole("button", { name: "Убрать из закладок" }).click()
    await expect(card.getByRole("button", { name: "Добавить в закладки" })).toBeVisible()
    expect(errors).toEqual([])
    await page.screenshot({ path: `migration-results/library-actions/${String(width)}-series.png`, fullPage: true })
    await context.close()
  }
}
async function verifyOtherReader(browser: Browser, origin: string, seriesURL: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await login(page, origin, "fixture02")
  await page.goto(seriesURL)
  await expect(page.locator("#library-articles article")).toHaveCount(1)
  await expect(page.locator("#edit-library-series")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Добавить в закладки" })).toBeVisible()
  await page.locator("#library-bookmarks").click()
  await expect(page.locator("#library-empty")).toBeVisible()
  await context.close()
}
async function verifyFailureRetry(page: Page, title: string) {
  const card = page.locator(`[data-article-title="${title}"]`)
  await page.route("**/api/v1/library/*/like", (route) =>
    route.fulfill({ status: 503, json: { error: "unavailable" } }),
  )
  await card.getByRole("button", { name: "Нравится", exact: true }).click()
  await expect(card.getByRole("alert")).toBeVisible()
  await expect(card.getByRole("button", { name: "Нравится", exact: true })).toHaveAttribute("aria-pressed", "false")
  await page.unroute("**/api/v1/library/*/like")
  await card.getByRole("button", { name: "Нравится", exact: true }).click()
  await expect(card.getByRole("button", { name: "Убрать лайк" })).toBeVisible()
}

async function verifyGuest(browser: Browser, origin: string) {
  const context = await browser.newContext(),
    page = await context.newPage()
  await page.goto(origin + "/library")
  await page.reload()
  await expect(page.locator("#new-library-article")).toHaveCount(0)
  for (const path of ["/api/v1/library/1/like", "/api/v1/library/1/bookmark", "/api/v1/library/series"]) {
    const response = await page.request.put(origin + path, { data: { active: true } })
    expect(response.status()).toBe(401)
  }
  expect(
    (
      await page.request.post(origin + "/api/v1/library/images", {
        multipart: { image: { name: "image.png", mimeType: "image/png", buffer: Buffer.from("bad") } },
      })
    ).status(),
  ).toBe(401)
  await context.close()
}
