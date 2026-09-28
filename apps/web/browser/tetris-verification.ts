import { launchBrowser } from "./coverage"
import { expect, type Dialog, type Page } from "@playwright/test"
import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { installFeedbackProbe } from "./tetris-feedback"

const targetOrigin = process.argv[2]
assert.ok(targetOrigin)
const origin: string = targetOrigin
const browser = await launchBrowser({ headless: true })
const screenshots = "test-results/tetris"
await mkdir(screenshots, { recursive: true })
async function enter(page: Page, nickname: string, password = "") {
  await page.goto(`${origin}/`)
  await page.locator("#entrance-nickname").fill(nickname)
  await page.locator("#entrance-password").fill(password)
  await page.locator("#enter-chat").click()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
}
async function command(page: Page, text: string) {
  await page.locator("#message-body").fill(text)
  await page.locator("#send-message").click()
}
async function leave(page: Page) {
  const accept = (dialog: Dialog) => {
    void dialog.accept()
  }
  page.on("dialog", accept)
  try {
    await page.locator("#tetris-close").click()
    await expect(page.locator("#tetris-dialog")).toHaveCount(0)
  } finally {
    page.off("dialog", accept)
  }
}
try {
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () =>
      browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" }),
    ),
  )
  const pages = await Promise.all(contexts.map((context) => context.newPage()))
  const [host, second, third, observer] = pages
  assert.ok(host && second && third && observer)
  const verifyFeedback = await installFeedbackProbe(host)
  const errors: string[] = []
  pages.forEach((page) => {
    page.on("pageerror", (error) => {
      errors.push(error.message)
    })
  })
  await enter(host, "fixture01", "secret123")
  await enter(second, "fixture02", "secret123")
  await enter(third, "tetris-third")
  await enter(observer, "tetris-observer")
  await command(host, "/тетрис")
  await expect(host.locator(".tetris-lobby")).toContainText("1/3")
  const invitation = second.locator(".chat-game-invitation").last()
  await expect(invitation).toContainText("fixture01")
  const id = await invitation.getAttribute("data-game-id")
  assert.ok(id)
  await second.locator(`#game-join-${id}`).click()
  await expect(second.locator(".tetris-lobby")).toContainText("2/3")
  await third.locator(`#game-join-${id}`).click()
  await expect(host.locator(".tetris-lobby")).toContainText("3/3")
  await expect(observer.locator(`#game-join-${id}`)).toHaveCount(0)
  await observer.locator(`#game-watch-${id}`).click()
  await expect(observer.locator(".tetris-lobby")).toContainText("Ты наблюдаешь")
  await expect(observer.locator("#tetris-start")).toHaveCount(0)
  await expect(host.locator("#tetris-start")).toBeDisabled()
  await host.locator("#tetris-ready").click()
  await second.locator("#tetris-ready").click()
  await third.locator("#tetris-ready").click()
  await host.screenshot({ path: `${screenshots}/lobby-desktop.png` })
  await host.locator("#tetris-start").click()
  await expect(host.locator("#tetris-control-drop")).toBeVisible({ timeout: 10000 })
  await expect(host.locator(".tetris-board canvas")).toHaveCount(3)
  await expect(observer.locator("#tetris-control-drop")).toHaveCount(0)
  await verifyFeedback()
  for (const [width, height] of [
    [1440, 900],
    [768, 1024],
    [390, 844],
  ] as const) {
    await host.setViewportSize({ width, height })
    await expect.poll(() => host.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await host.screenshot({ path: `${screenshots}/match-${String(width)}.png`, fullPage: true })
  }
  await host.setViewportSize({ width: 1440, height: 1100 })
  await host.reload()
  await expect(host.locator("#tetris-control-drop")).toBeVisible({ timeout: 10000 })
  await expect(host.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  await host.locator("#tetris-keyboard").focus()
  await host.keyboard.press("ArrowLeft")
  await host.keyboard.press("ArrowUp")
  await host.locator("#tetris-control-left").click()
  await host.locator("#tetris-control-rotate").click()
  await host.locator("#tetris-control-drop").click()
  await expect(host.locator(".tetris-mine .tetris-player-footer")).not.toContainText(/^0 очков/u)
  await leave(third)
  await leave(second)
  await expect(host.locator(".tetris-results")).toContainText("fixture01")
  await expect(observer.locator(".tetris-results")).toBeVisible()
  await host.locator("#tetris-rematch").click()
  await expect(host.locator(".tetris-lobby")).toContainText("3/3")
  await expect(host.locator("#tetris-start")).toBeDisabled()
  await leave(host)
  await expect(third.locator(".chat-game-invitation")).toHaveCount(2)
  // Solo is private, and starting it never publishes another invitation.
  const before = await third.locator(".chat-game-invitation").count()
  await command(host, "/тетрис соло")
  await expect(host.locator("#tetris-pause")).toBeVisible({ timeout: 10000 })
  await host.locator("#tetris-pause").click()
  await expect(host.locator(".tetris-match-state")).toHaveText("Пауза")
  await host.locator("#tetris-pause").click()
  await host.locator("#tetris-control-drop").click()
  await expect(host.locator(".tetris-mine .tetris-player-footer")).not.toContainText(/^0 очков/u)
  assert.equal(await third.locator(".chat-game-invitation").count(), before)
  await leave(host)
  const ranking = await contexts[0]?.newPage()
  assert.ok(ranking)
  await ranking.goto(`${origin}/games/tetris/leaderboard`)
  await ranking.locator("#tetris-ranking-solo").click()
  await expect(ranking.locator("table")).toContainText("fixture01", { timeout: 10000 })
  await ranking.locator("#tetris-ranking-period").selectOption("month")
  await expect(ranking.locator("table")).toContainText("fixture01", { timeout: 10000 })
  await ranking.screenshot({ path: `${screenshots}/leaderboard.png` })
  // A fresh two-player match may start without waiting for a third seat.
  await leave(observer)
  await command(observer, "/тетрис")
  await expect(observer.locator(".tetris-lobby")).toContainText("1/3")
  const pair = host.locator(".chat-game-invitation").last()
  await expect(pair).toContainText("tetris-observer")
  const pairID = await pair.getAttribute("data-game-id")
  assert.ok(pairID)
  await host.locator(`#game-join-${pairID}`).click()
  await host.locator("#tetris-ready").click()
  await observer.locator("#tetris-ready").click()
  await expect(observer.locator("#tetris-start")).toHaveText("Начать вдвоём")
  await observer.locator("#tetris-start").click()
  await expect(host.locator("#tetris-control-drop")).toBeVisible({ timeout: 10000 })
  await expect(host.locator(".tetris-board canvas")).toHaveCount(2)
  assert.deepEqual(errors, [])
  console.log(
    "Tetris verified: command, invitation, 3-player cap, observer, readiness, early 2-player start, rematch, solo privacy, score, pause, audio, leaderboard, responsive screenshots.",
  )
} finally {
  await browser.close()
}
