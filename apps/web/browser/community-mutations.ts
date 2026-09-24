import { expect } from "@playwright/test"
import type { Pair } from "./community-flows"
export async function uploadAndModerate(p: Pair) {
  const { oldPage, newPage, origin, legacy, ready, compare } = p
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await ready(page, base, "/gallery")
    await page.locator("#gallery-photo-caption").fill("Загруженный снимок")
    await page.locator("#gallery-upload-form input[type=file]").setInputFiles("migration-results/community/photo.png")
    if (base === legacy && p.legacyPhoenix !== false)
      await expect(page.locator("#gallery-photo-thumbnail")).not.toHaveValue("")
    await page.locator("#upload-gallery-photo").click()
    await expect(page.locator("#photos-3")).toContainText("Загруженный снимок")
    await expect(page.locator("#photos-3 img")).toHaveAttribute("src", "/gallery/photos/3/thumbnail")
    await page.locator("#flash-info button").click()
  }
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await ready(page, base, "/admin?section=emojis")
    await page.locator("#emoji-code").fill("ТЕСТ_КОТ")
    await page.locator("#emoji-image").setInputFiles("migration-results/community/emoji.png")
    await page.locator("#admin-emoji-submit").click()
    await expect(page.locator("#admin-emoji-1")).toBeVisible()
    await page.locator("#admin-emoji-1").click()
    await expect(page.locator("#admin-emoji-editor-modal")).toBeVisible()
    await page.locator("#emoji-code-1").focus()
  }
  await compare("admin-emoji-editor")
  await newPage.locator("#close-emoji-editor").focus()
  await newPage.keyboard.press("Shift+Tab")
  await expect(newPage.locator("#admin-emoji-editor-1 button").filter({ hasText: "Сохранить" })).toBeFocused()
  await newPage.keyboard.press("Tab")
  await expect(newPage.locator("#close-emoji-editor")).toBeFocused()
  for (const page of [oldPage, newPage]) {
    await page.locator("#emoji-tags-1 summary").click()
    await page.locator("#emoji-1-tag-1").check()
    await page.locator("#emoji-status-1").selectOption("approved")
    await page.locator("#admin-emoji-editor-1 button").filter({ hasText: "Сохранить" }).click()
    await expect(page.locator("#admin-emojis-approved #admin-emoji-1")).toBeVisible()
  }
  await compare("admin-approved")
  await expect
    .poll(async () => {
      const response = await newPage.request.get(origin + "/api/v1/chat/emojis")
      return response.text()
    })
    .toContain("грустно")
  for (const page of [oldPage, newPage]) {
    await page.locator("#admin-emoji-1").click()
    await page.locator("#emoji-status-1").selectOption("rejected")
    await page.locator("#admin-emoji-editor-1 button").filter({ hasText: "Сохранить" }).click()
    await expect(page.locator("#admin-emojis-rejected #admin-emoji-1")).toBeVisible()
    await page.locator("#admin-emoji-1").click()
    await page.locator("#admin-emoji-editor-1 button").filter({ hasText: "Удалить" }).click()
    await expect(page.locator("#admin-emoji-1")).toHaveCount(0)
  }
  for (const [page, base] of [
    [oldPage, legacy],
    [newPage, origin],
  ] as const) {
    await ready(page, base, "/admin?section=tags")
    await page.locator("#admin-emoji-tag-1 summary").click()
    await page.locator("#delete-emoji-tag-1").click()
    await expect(page.locator("#admin-emoji-tag-1")).toHaveCount(0)
  }
}
export async function failureRecovery(p: Pair) {
  const { newPage: page, origin } = p
  for (const [route, api] of [
    ["gallery", "gallery"],
    ["library", "library"],
    ["admin?section=tags", "admin/emojis"],
  ] as const) {
    const match = `**/api/v1/${api}*`
    await page.route(match, (r) =>
      r.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' }),
    )
    await page.goto(origin + "/" + route)
    if (!route.startsWith("admin")) await expect(page.locator("#site-account-nickname")).toHaveText("fixture01")
    const retry = page.locator(route.startsWith("admin") ? "#admin-retry" : `#${route}-retry`)
    await expect(retry).toBeVisible()
    await page.unroute(match)
    await retry.click()
    await expect(retry).toHaveCount(0)
  }
  await page.goto(origin + "/gallery")
  await page.locator("#site-account-logout-submit").click()
  await expect(page.locator("#gallery-login-hint")).toBeVisible()
  await expect(page.locator("#gallery-upload-form")).toHaveCount(0)
  await page.goto(origin + "/admin")
  await expect(page.locator("#admin-login-required")).toBeVisible()
  await page.locator("#admin-login-nickname").fill("fixture02")
  await page.locator("#admin-login-password").fill("secret123")
  await page.locator("#admin-login-submit").click()
  await expect(page.locator("#emojis")).toBeVisible()
  await expect(page.getByRole("link", { name: "Данные", exact: true })).toHaveCount(0)
  await page.goto(origin + "/admin?section=database")
  await expect(page.locator("#emojis")).toBeVisible()
  expect((await page.request.get(origin + "/api/v1/admin/database")).status()).toBe(403)
}
