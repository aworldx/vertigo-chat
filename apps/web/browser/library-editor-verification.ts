import { expect, type Page } from "@playwright/test"

export async function verifyLibraryEditor(page: Page, origin: string) {
  await page.goto(origin + "/library")
  await page.locator("#new-library-article").click()
  await page.locator("#article_title").fill("Форматирование и сохранение")
  const text = page.locator("#article_body")
  await text.fill("Важный текст")
  await text.press("ControlOrMeta+a")
  await page.locator("#article-format-bold").click()
  await expect(text.locator("strong")).toHaveText("Важный текст")
  await page.locator("#article-format-italic").click()
  await expect(text.locator("em")).toHaveText("Важный текст")
  await page.locator("#article-format-strike").click()
  await expect(text.locator("s")).toHaveText("Важный текст")
  await page.locator("#article-format-strike").click()
  await page.locator("#article-format-link").click()
  await page.locator("#article-link-url").fill("javascript:alert(1)")
  await page.locator("#article-link-apply").click()
  await expect(page.getByRole("alert")).toContainText("http://")
  await page.locator("#article-link-url").fill("https://example.com/article")
  await page.locator("#article-link-apply").click()
  await expect(text.locator("a")).toHaveAttribute("href", "https://example.com/article")
  await page.screenshot({ path: "migration-results/community/library-rich-editor-desktop.png", fullPage: true })
  const viewport = page.viewportSize()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: "migration-results/community/library-rich-editor-mobile.png", fullPage: true })
  expect(await page.locator("#library-editor").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  )
  if (viewport) await page.setViewportSize(viewport)
  await page.locator("#save-library-article").click()
  await expect(page.locator("#library-editor")).toHaveCount(0)
  await page.reload()
  const article = page.locator('[data-article-title="Форматирование и сохранение"]')
  await expect(article.locator("strong")).toHaveText("Важный текст")
  await expect(article.locator("em")).toHaveText("Важный текст")
  await expect(article.locator('a[href="https://example.com/article"]')).toHaveCount(1)
  await article.getByRole("button", { name: "Редактировать Форматирование и сохранение" }).click()
  await expect(text.locator("strong")).toHaveText("Важный текст")
  await text.click()
  await text.press("ControlOrMeta+a")
  await page.locator("#article-format-clear").click()
  await expect(text.locator("strong")).toHaveCount(0)
  await page.locator("#article-format-undo").click()
  await expect(text.locator("strong")).toHaveCount(1)
  await page.locator("#article-format-redo").click()
  await expect(text.locator("strong")).toHaveCount(0)
  for (const [control, tag] of [
    ["heading", "h2"],
    ["subheading", "h3"],
    ["bullet", "ul"],
    ["ordered", "ol"],
    ["quote", "blockquote"],
    ["code", "pre"],
  ] as const) {
    await text.fill("Оформленный абзац")
    await text.press("ControlOrMeta+a")
    await page.locator(`#article-format-${control}`).click()
    await expect(text.locator(tag)).toHaveCount(1)
    await page.locator("#article-format-clear").click()
  }
  await text.fill("x".repeat(12001))
  await expect(page.locator("#save-library-article")).toBeDisabled()
  await text.fill("")
  await expect(page.locator("#save-library-article")).toBeDisabled()
  await page.locator("#cancel-library-editor").click()
}
