import { chromium, expect, type Page } from "@playwright/test"
import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
const origin = process.argv[2] ?? "http://127.0.0.1:4094"
const mode = process.argv[3] ?? "game"
const output = "/app/docs/design/geo-chat/verification/functional"
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
async function enter(page: Page, name: string, password = "") {
  await page.goto(origin + "/chat")
  await expect(page.locator("#chat-login-link")).toBeVisible()
  await page.goto(origin)
  await page.locator("#entrance-nickname").fill(name)
  await page.locator("#entrance-password").fill(password)
  await page.locator("#enter-chat").click()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
}
async function open(page: Page) {
  await page.locator("#message-body").fill("/гео")
  await page.locator("#send-message").click()
  await expect(page.locator("#geo-game")).toBeVisible()
}
try {
  const first = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await first.newPage()
  const errors: string[] = []
  page.on("pageerror", (e) => {
    errors.push(e.message)
  })
  await page.route("https://maps.googleapis.com/maps/api/streetview?**", (route) =>
    route.fulfill({ path: "/app/docs/design/geo-chat/reference-v1/assets/location.jpg" }),
  )
  await mockPanorama(page)
  await enter(
    page,
    mode === "game" ? "fixture01" : "geo-a-" + Date.now().toString().slice(-6),
    mode === "game" ? "secret123" : "",
  )
  await expect(page.locator("#geo-game")).toHaveCount(0)
  await open(page)
  if (mode === "unconfigured") {
    await expect(page.locator("#geo-game")).toContainText("Снимки пока недоступны")
    await expect(page.locator("#geo-game .geo-photo")).toHaveCount(0)
    await page.screenshot({ path: output + "/unconfigured.png" })
    await page.reload()
    await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
    await open(page)
    await expect(page.locator("#geo-game")).toContainText("Снимки пока недоступны")
  } else {
    await expect(page.locator("#geo-game")).toContainText("Угадайте место вместе")
    await page.getByRole("button", { name: "Начать игру", exact: true }).click()
    await expect(page.locator("#geo-answer")).toBeVisible()
    await expect(page.locator(".geo-time")).toHaveText(/0[45]:[0-5][0-9]/)
    await expect(page.locator(".geo-return")).toBeEnabled()
    const second = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const other = await second.newPage()
    other.on("pageerror", (e) => {
      errors.push(e.message)
    })
    await other.route("https://maps.googleapis.com/maps/api/streetview?**", (route) =>
      route.fulfill({ path: "/app/docs/design/geo-chat/reference-v1/assets/location.jpg" }),
    )
    await mockPanorama(other)
    await enter(other, "geo-b-" + Date.now().toString().slice(-6))
    await expect(other.locator("#geo-game")).toHaveClass(/collapsed/, { timeout: 10000 })
    await expect(other.locator(".geo-panorama")).toHaveCount(0)
    await other.locator(".geo-mini").click()
    await expect(other.locator("#geo-answer")).toBeVisible({ timeout: 10000 })
    await expect(other.locator(".geo-tabs")).toBeHidden()
    await page.locator("#geo-answer").fill("Италия")
    await page.getByRole("button", { name: "Ответить", exact: true }).click()
    await expect(page.locator(".geo-answer-saved")).toContainText("Италия")
    await expect(other.locator(".geo-answer-saved")).toHaveCount(0)
    await expect(other.locator("#messages")).not.toContainText("Италия")
    await page.getByRole("button", { name: "Изменить ответ", exact: true }).click()
    await page.locator("#geo-answer").fill("Италия, Манарола")
    await expect.poll(() => page.evaluate(() => Date.now())).toBeGreaterThan(Date.now() + 1100)
    await page.getByRole("button", { name: "Ответить", exact: true }).click()
    await expect(page.locator(".geo-answer-saved")).toContainText("Манарола")
    await other.locator("#geo-answer").fill("Italy")
    await other.getByRole("button", { name: "Ответить", exact: true }).click()
    await expect(other.locator(".geo-answer-saved")).toContainText("Italy")
    await page.reload()
    await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
    await expect(page.locator("#geo-game")).toHaveClass(/collapsed/, { timeout: 10000 })
    await page.locator(".geo-mini").click()
    await expect(page.locator(".geo-answer-saved")).toContainText("Манарола", { timeout: 10000 })
    await page.getByRole("button", { name: "Закрыть игру", exact: true }).click()
    await expect(page.locator("#geo-game")).toHaveCount(0)
    await expect(page.locator(".chat-room-sidebar")).toBeVisible()
    await open(page)
    await expect(page.locator("#geo-game")).not.toHaveClass(/collapsed/)
    await expect(page.locator(".chat-room-sidebar")).toBeHidden()
    await page.getByRole("button", { name: "Увеличить игру", exact: true }).click()
    await expect(page.locator("#geo-game")).toHaveClass(/expanded/)
    await page.keyboard.press("Escape")
    await expect(page.locator("#geo-game")).not.toHaveClass(/expanded/)
    await page.locator("#message-body").fill("Обсуждаем место вместе")
    await page.locator("#send-message").click()
    await expect(other.locator("#messages")).toContainText("Обсуждаем место вместе")
    await other.setViewportSize({ width: 844, height: 390 })
    await expect(other.locator(".geo-tabs")).toBeHidden()
    await other.screenshot({ path: output + "/mobile-landscape.png" })
    await page.screenshot({ path: output + "/desktop-answered.png" })
    await other.setViewportSize({ width: 390, height: 844 })
    await other.screenshot({ path: output + "/mobile-answered.png" })
    await page.request.post(origin + "/__test/geo/advance")
    await expect(page.locator(".geo-reveal")).toContainText("+3", { timeout: 10000 })
    await expect(other.locator(".geo-reveal")).toContainText("+1", { timeout: 10000 })
    await page.screenshot({ path: output + "/reveal.png" })
    for (let round = 2; round <= 5; round++) {
      await page.request.post(origin + "/__test/geo/advance")
      await expect(page.locator(".geo-kicker")).toContainText(`Раунд ${String(round)} из 5`, { timeout: 10000 })
      await expect(page.locator("#geo-answer")).toHaveValue("")
      await page.request.post(origin + "/__test/geo/advance")
      await expect(page.locator(".geo-reveal")).toBeVisible({ timeout: 10000 })
    }
    await page.request.post(origin + "/__test/geo/advance")
    await expect(page.locator("#geo-game")).toContainText("Игра завершена", { timeout: 10000 })
    await expect(page.locator("#geo-game")).toContainText("3 балла")
    await page.screenshot({ path: output + "/finished.png" })
    await other.reload()
    await expect(other.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
    await expect(other.locator("#geo-game")).toHaveCount(0)
    const rankingPromise = page.waitForEvent("popup")
    await page.locator("#menu-rankings").click()
    const ranking = await rankingPromise
    await expect(ranking.locator("#game-rankings table")).toContainText("fixture01")
    await expect(ranking.locator("#game-rankings tbody tr")).toHaveCount(1)
    await expect(ranking.locator("#game-rankings tbody tr td").nth(2)).toHaveText("3")
    await ranking.reload()
    await expect(ranking.locator("#game-rankings tbody tr td").nth(2)).toHaveText("3")
    await page.request.post(origin + "/__test/geo/reset")
    await open(page)
    await page.getByRole("button", { name: "Начать игру", exact: true }).click()
    await page.locator("#geo-answer").fill("Manarola")
    await page.getByRole("button", { name: "Ответить", exact: true }).click()
    await expect(page.locator(".geo-answer-saved")).toBeVisible()
    await page.request.post(origin + "/__test/geo/advance")
    await ranking.reload()
    await expect(ranking.locator("#game-rankings tbody tr td").nth(2)).toHaveText("6")
    await ranking.screenshot({ path: output + "/persistent-ranking.png" })
    await ranking.close()
    await second.close()
  }
  assert.deepEqual(errors, [])
  await first.close()
  console.log("PASS geo browser", mode)
} finally {
  await browser.close()
}

// Explicit SDK fixture for lifecycle/game tests. Real Google walking is covered
// separately by geo-live-verification, never inferred from this adapter.
async function mockPanorama(page: Page) {
  await page.route("https://maps.googleapis.com/maps/api/js?**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.google={maps:{StreetViewPanorama:class {constructor(el,o){this.id=o.pano;el.innerHTML='<img alt="Тестовая панорама" src="/geo-test-location" style="width:100%;height:100%;object-fit:cover">'}addListener(n,fn){const t=setTimeout(fn,0);return {remove(){clearTimeout(t)}}}getStatus(){return 'OK'}getLinks(){return [{pano:'next'}]}setPano(id){this.id=id}setPov(){}setZoom(){}setVisible(){}},event:{trigger(){}}}};`,
    }),
  )
  await page.route("**/geo-test-location", (route) =>
    route.fulfill({ path: "/app/docs/design/geo-chat/reference-v1/assets/location.jpg" }),
  )
}
