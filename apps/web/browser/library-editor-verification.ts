import { expect, type Page } from "@playwright/test"

async function verifyLibraryListDesign(page: Page, origin: string) {
  const originalViewport = page.viewportSize()
  const states = [
    ["top", 0],
    ["viewport", "viewport"],
    ["bottom", "bottom"],
  ] as const
  for (const [width, height] of [
    [1440, 900],
    [1280, 676],
    [768, 1024],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto(origin + "/library")
    await expect(page.locator("#articles-3")).toBeVisible()
    await expect(page.locator("#library-articles article")).toHaveCount(3)
    await page.mouse.move(0, 0)
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all(Array.from(document.images).map((image) => image.decode().catch(() => undefined)))
      await new Promise<void>((resolve, reject) => {
        const background = new Image()
        background.onload = () => {
          resolve()
        }
        background.onerror = () => {
          reject(new Error("Library background did not load"))
        }
        background.src = "/images/library-room-v2.png"
      })
    })
    const intro = page.locator(".library-intro")
    await expect(intro).toBeVisible()
    await expect(
      page.locator("#library-page").evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).resolves.toBe(true)
    const introBox = await intro.boundingBox()
    expect(introBox).not.toBeNull()
    expect(introBox?.height).toBeLessThanOrEqual(width > 760 ? 160 : 220)
    const firstCard = await page.locator("#library-articles article").first().boundingBox()
    expect(firstCard?.y).toBeLessThan(height - 100)
    await expect(page.locator("#library-series")).toBeVisible()

    const room = page.locator(".library-reading-room")
    await expect(room).toBeVisible()
    await expect(room.evaluate((element) => getComputedStyle(element).backgroundImage)).resolves.toContain(
      "library-room-v2.png",
    )
    await expect(room).toHaveCSS("position", "fixed")
    await expect(page.locator(".library-title")).toHaveCSS("font-family", '"Library Serif", serif')
    await expect(page.locator(".library-intro-lamp")).toHaveCount(0)

    for (const [state, target] of states) {
      await page.evaluate((scrollTarget) => {
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        const y = scrollTarget === "viewport" ? Math.min(window.innerHeight, max) : scrollTarget === "bottom" ? max : 0
        window.scrollTo(0, y)
      }, target)
      await page.screenshot({
        path: `migration-results/community/library-list-${String(width)}-${state}.png`,
        animations: "disabled",
      })
      await expect(page.locator("#library-page")).toBeVisible()
      await expect(page.locator("[data-return-to-chat]")).toHaveCount(1)
    }
  }
  if (originalViewport) await page.setViewportSize(originalViewport)
}

export async function verifyLibraryEditor(page: Page, origin: string) {
  await verifyLibraryListDesign(page, origin)
  await verifyEditorDesign(page, origin)
  await page.goto(origin + "/library")
  await page.locator("#new-library-article").click()
  await page.locator("#article_title").fill("Форматирование и сохранение")
  await page.locator("#article_work_author").fill(" Uniform ")
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
  await expect(page.locator("#save-library-article-mobile")).toBeVisible()
  await expect(page.locator("#save-library-article-mobile")).toHaveCSS("min-height", "44px")
  await page.locator("#library-preview-tab").click()
  await expect(page.locator("#library-preview-tab")).toHaveAttribute("aria-selected", "true")
  await expect(page.locator("#article_body")).toBeHidden()
  await page.locator("#library-editor-tab").click()
  await expect(page.locator("#article_body")).toBeVisible()
  await page.screenshot({ path: "migration-results/community/library-rich-editor-mobile.png", fullPage: true })
  expect(await page.locator("#library-editor").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  )
  if (viewport) await page.setViewportSize(viewport)
  await page.locator("#save-library-article").click()
  await expect(page.locator("#library-editor")).toHaveCount(0)
  await page.reload()
  const article = page.locator('[data-article-title="Форматирование и сохранение"]')
  await expect(article.locator(".library-card-meta")).toContainText("Автор: Uniform")
  await expect(article.locator(".library-card-meta")).toContainText("Опубликовал: fixture01")
  await expect(article.locator("strong")).toHaveText("Важный текст")
  await expect(article.locator("em")).toHaveText("Важный текст")
  await expect(article.locator('a[href="https://example.com/article"]')).toHaveCount(1)
  await article.getByRole("button", { name: "Редактировать Форматирование и сохранение" }).click()
  await expect(page.locator("#article_work_author")).toHaveValue("Uniform")
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
  await expect(page.locator("#library-discard-title")).toBeVisible()
  await page.locator("#keep-editing-library-article").click()
  await expect(page.locator("#library-discard-title")).toHaveCount(0)
  await page.locator("#cancel-library-editor").click()
  await page.locator("#discard-library-article").click()
  await expect(page.locator("#library-editor")).toHaveCount(0)
}

async function verifyEditorDesign(page: Page, origin: string) {
  const originalViewport = page.viewportSize()
  for (const [width, height] of [
    [1440, 900],
    [1280, 676],
    [768, 1024],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto(origin + "/library")
    await page.locator("#new-library-article").click()
    const modal = page.locator("#library-editor")
    await expect(modal).toBeVisible()
    await expect(page.locator("#article_body")).toBeVisible()
    await page.evaluate(async () => {
      await document.fonts.ready
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      await new Promise<void>((resolve, reject) => {
        const image = new Image()
        image.onload = () => {
          resolve()
        }
        image.onerror = () => {
          reject(new Error("Editor backdrop did not load"))
        }
        image.src = "/images/library-room-v2.png"
      })
    })
    await page.mouse.move(0, 0)
    for (const state of ["top", "viewport", "bottom"] as const) {
      await modal.evaluate((element, target) => {
        element.scrollTop = target === "top" ? 0 : target === "viewport" ? window.innerHeight : element.scrollHeight
      }, state)
      await page.screenshot({
        path: `migration-results/community/library-editor-${String(width)}-${state}.png`,
        animations: "disabled",
      })
      expect(await modal.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    }
    // Screenshots deliberately blur focus; restore it to the dialog before testing Escape.
    await page.locator("#cancel-library-editor").focus()
    await page.keyboard.press("Escape")
    await expect(modal).toHaveCount(0)
  }
  if (originalViewport) await page.setViewportSize(originalViewport)
}
