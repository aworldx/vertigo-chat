import assert from "node:assert/strict"
import { expect, type Page } from "@playwright/test"
export type Pair = {
  legacyPhoenix?: boolean
  oldPage: Page
  newPage: Page
  origin: string
  legacy: string
  compare: (scenario: string) => Promise<void>
  ready: (page: Page, base: string, path: string) => Promise<void>
}
export async function galleryFlows(p: Pair) {
  const { oldPage, newPage, origin, legacy, compare, ready } = p
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await ready(page, base, "/gallery")
    await page.locator("#photos-2 [data-gallery-lightbox-open]").click()
    await expect(page.locator("#gallery-lightbox-image")).toBeVisible()
    await page.locator("#gallery-lightbox-image").evaluate(async (e) => {
      if (e instanceof HTMLImageElement) await e.decode()
    })
  }
  await compare("gallery-lightbox")
  for (const page of [oldPage, newPage]) {
    await page.keyboard.press("Escape")
    await expect(page.locator("#photos-2 [data-gallery-lightbox-open]")).toBeFocused()
  }
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await page.goto(base + "/account/login")
    if (base === legacy && p.legacyPhoenix !== false)
      await page.addScriptTag({ url: base + "/assets/js/account_login.js" })
    await page.locator("#react-account-nickname").fill("fixture01")
    await page.locator("#react-account-password").fill("secret123")
    await page.locator("#react-account-login-form button[type=submit]").click()
    await expect(page.locator("#site-account-nickname")).toHaveText("fixture01")
    await ready(page, base, "/gallery")
    await expect(page.locator("#gallery-upload-form")).toBeVisible()
  }
  await compare("gallery-account")
  for (const page of [oldPage, newPage]) {
    await page.locator("#gallery-like-2").click()
    await expect(page.locator("#gallery-like-2")).toHaveAttribute("aria-pressed", "true")
  }
  await compare("gallery-liked")
  for (const page of [oldPage, newPage]) {
    await page.locator("#edit-gallery-photo-1").click()
    await page.locator("#gallery-photo-caption-1").fill("Новое название")
  }
  await compare("gallery-caption-editor")
  for (const page of [oldPage, newPage]) {
    await page.locator("#save-gallery-photo-caption-1").click()
    await expect(page.locator("#photos-1")).toContainText("Новое название")
    await expect(page.locator("#flash-info")).toBeVisible()
    await page.locator("#flash-info button").click()
  }
  await compare("gallery-caption-saved")
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await ready(page, base, "/gallery")
    await expect(page.locator("#photos-1")).toContainText("Новое название")
  }
}
export async function libraryFlows(p: Pair) {
  const { oldPage, newPage, origin, legacy, compare, ready } = p
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await ready(page, base, "/library")
    await expect(page.locator("#new-library-article")).toBeVisible()
    await page.locator("#library-series a").first().click()
    await expect(page.locator("#library-articles article").first()).toHaveAttribute("id", "articles-1")
  }
  await compare("library-series")
  for (const page of [oldPage, newPage]) {
    await page.locator("#articles-1 summary").click()
  }
  await compare("library-expanded")
  for (const page of [oldPage, newPage]) {
    await page.locator("#articles-1 summary").click()
    await page.locator("#new-library-article").click()
    await expect(page.locator("#library-editor")).toBeVisible()
    await page.locator("#article_title").fill("Новая глава")
    await page.locator("#article_series").fill("Хроники Vertigo")
    await page.locator("#article_part_number").fill("3")
    await page.locator("#article_body").fill("Проверка авторского редактора.\nВторая строка.")
    await expect(page.locator("#article-character-count")).toContainText(
      page === oldPage && p.legacyPhoenix !== false ? "45 / 12000" : "72 / 12000",
    )
    await page.locator("#article_title").focus()
    await page.locator("#library-editor").evaluate((el) => {
      el.scrollTop = 0
    })
  }
  await compare("library-editor")
  await newPage.locator("#cancel-library-editor").focus()
  await newPage.keyboard.press("Shift+Tab")
  await expect(newPage.locator("#save-library-article")).toBeFocused()
  await newPage.keyboard.press("Tab")
  await expect(newPage.locator("#cancel-library-editor")).toBeFocused()
  for (const page of [oldPage, newPage]) {
    await page.locator("#save-library-article").click()
    await expect(page.locator("#library-editor")).toHaveCount(0)
    await expect(page.locator("#articles-3")).toContainText("Новая глава")
    await page.locator("#flash-info button").click()
    await page.locator("#edit-article-3").click()
    await page.locator("#article_title").fill("Исправленная глава")
    await page.locator("#save-library-article").click()
    await expect(page.locator("#articles-3")).toContainText("Исправленная глава")
    await page.locator("#flash-info button").click()
  }
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await ready(page, base, "/library")
    await expect(page.locator("#articles-3")).toContainText("Исправленная глава")
  }
  await compare("library-saved")
}
export async function adminFlows(p: Pair) {
  const { oldPage, newPage, origin, legacy, compare, ready } = p
  await ready(oldPage, legacy, "/admin")
  if (p.legacyPhoenix !== false) {
    await oldPage.locator("#admin-login-nickname").fill("fixture01")
    await oldPage.locator("#admin-login-password").fill("secret123")
    await oldPage.locator("#admin-login-submit").click()
  }
  await expect(oldPage.locator("#database")).toBeVisible()
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await ready(page, base, "/admin?section=tags")
    await expect(page.locator("#admin-emoji-tag-form")).toBeVisible()
  }
  await compare("admin-tags-empty")
  for (const page of [oldPage, newPage]) {
    await page.locator("#emoji-tag-name").fill("Грусть")
    await page.locator("#emoji-tag-triggers").fill("Печаль\nгрустно\n😢")
    await page.locator("#admin-emoji-tag-form button").click()
    await expect(page.locator("#admin-emoji-tag-1")).toContainText("грусть")
    await page.locator("#admin-emoji-tag-1 summary").click()
    await page.locator("#emoji-tag-name-1").focus()
  }
  await compare("admin-tag-editor")
  for (const page of [oldPage, newPage]) {
    await page.locator("#emoji-tag-name-1").fill("радость")
    await page.locator("#edit-emoji-tag-1 button").click()
    await expect(page.locator("#admin-emoji-tag-1")).toContainText("радость")
  }
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await ready(page, base, "/admin?section=emojis")
    await expect(page.locator("#admin-emoji-form")).toBeVisible()
  }
  await compare("admin-emojis-empty")
  // Table contents differ for account sessions; compare a deterministic content table separately.
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await ready(page, base, "/admin?table=emoji_tags")
    await expect(page.locator("#admin-database-table")).toContainText("радость")
  }
  assert.equal(await newPage.locator("#admin-database-table tbody tr").count(), 1)
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await ready(page, base, "/admin?table=emoji_tag_assignments")
    await expect(page.locator("#admin-database-table caption")).toHaveText("emoji_tag_assignments")
  }
  await compare("admin-database-empty")
}
