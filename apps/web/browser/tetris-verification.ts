import { verifyLocalCycle } from "./tetris-cycle"
import { verifyFirstSoloWindow } from "./tetris-first-open"
import { launchBrowser } from "./coverage"
import { expect, type Dialog, type Page } from "@playwright/test"
import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { installFeedbackProbe } from "./tetris-feedback"
import {
  openTetrisAndReturn,
  verifyTetrisWindow,
  verifyMobileTetris,
  verifyBlockedTetris,
  verifyTouchControls,
} from "./tetris-window"

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
  await openTetrisAndReturn(page, () => page.locator("#send-message").click())
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
async function verifyResults(page: Page, mode: string) {
  await expect(page.locator("#tetris-keyboard")).toHaveCount(0)
  await expect(page.locator(".tetris-controls")).toHaveCount(0)
  await expect(page.locator(".tetris-connection")).toHaveText("")
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
  ] as const) {
    await page.setViewportSize({ width, height })
    const box = await page.locator("#tetris-game").boundingBox()
    assert.ok(box && box.height < 550 && box.y >= 0 && box.y + box.height <= height, "result must be compact and fit")
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.locator("#tetris-rematch")).toBeInViewport()
    await page.screenshot({ path: screenshots + "/result-" + mode + "-" + String(width) + ".png" })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
}
try {
  await verifyLocalCycle(browser, origin, screenshots)
  await verifyFirstSoloWindow(browser, origin, screenshots)
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
  await openTetrisAndReturn(second, () => second.locator(`#game-join-${id}`).click())
  await expect(second.locator(".tetris-lobby")).toContainText("2/3")
  await openTetrisAndReturn(third, () => third.locator(`#game-join-${id}`).click())
  await expect(host.locator(".tetris-lobby")).toContainText("3/3")
  await expect(observer.locator(`#game-join-${id}`)).toHaveCount(0)
  await openTetrisAndReturn(observer, () => observer.locator(`#game-watch-${id}`).click())
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
    [320, 568],
    [844, 390],
  ] as const) {
    await host.setViewportSize({ width, height })
    await expect.poll(() => host.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect
      .poll(() => host.locator("#tetris-dialog").evaluate((el) => el.scrollHeight <= el.clientHeight + 1))
      .toBe(true)
    for (const target of [".tetris-mine .tetris-board", "#tetris-control-drop"]) {
      const box = await host.locator(target).boundingBox()
      assert.ok(
        box && box.y >= 0 && box.y + box.height <= height,
        `${target} must fit ${String(width)}x${String(height)}`,
      )
    }
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
  await host.locator("#tetris-control-hold").click()
  await expect(host.locator(".tetris-held svg")).toHaveCount(1)
  await host.locator("#tetris-control-drop").click()
  await expect(host.locator(".tetris-mine .tetris-player-footer")).not.toContainText(/^0 очков/u)
  await leave(third)
  await leave(second)
  await expect(host.locator(".tetris-results")).toContainText("fixture01")
  await expect(observer.locator(".tetris-results")).toBeVisible()
  await verifyResults(host, "match")
  await openTetrisAndReturn(host, () => host.locator("#tetris-rematch").click())
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
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 660 },
    { width: 768, height: 650 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await host.setViewportSize(viewport)
    const board = await host.locator(".tetris-mine .tetris-board").boundingBox()
    assert.ok(
      board && board.height > viewport.height * (viewport.width < 768 ? 0.38 : 0.55),
      `solo board ${String(board?.height)} should use most of ${String(viewport.width)}x${String(viewport.height)}`,
    )
    await expect(host.locator(".tetris-upcoming svg")).toHaveCount(5)
    const preview = await host.locator(".tetris-upcoming li").last().boundingBox()
    const controls = await host.locator(".tetris-controls").boundingBox()
    assert.ok(
      preview && controls && preview.y + preview.height <= controls.y,
      "all next pieces must fit above controls",
    )
    await expect(host.locator("#tetris-settings")).not.toBeVisible()
    await expect(host.locator(".tetris-held")).toContainText("Пока пусто")
    if (viewport.width < 768) await verifyTouchControls(host)
    await host.screenshot({ path: `${screenshots}/solo-${String(viewport.width)}.png` })
  }
  await host.setViewportSize({ width: 1440, height: 900 })
  await verifyTetrisWindow(host, screenshots)
  const canvas = await host.locator(".tetris-mine canvas").elementHandle()
  await host.context().setOffline(true)
  await expect(host.locator(".tetris-connection")).toContainText("Синхронизация", { timeout: 15000 })
  await expect(host.locator("#tetris-control-left")).toBeVisible()
  await host.context().setOffline(false)
  await expect(host.locator(".tetris-connection")).toHaveText("", { timeout: 10000 })
  assert.ok(await canvas?.evaluate((element) => element.isConnected), "reconnect must preserve the canvas")
  await host.locator("#tetris-pause").click()
  await host.locator("#tetris-control-hold").click()
  await expect(host.locator(".tetris-held svg")).toHaveCount(1)
  await host.locator("#tetris-control-drop").click()
  await expect(host.locator(".tetris-mine .tetris-player-footer")).not.toContainText(/^0 очков/u)
  assert.equal(await third.locator(".chat-game-invitation").count(), before)
  await host.locator("#tetris-keyboard").focus()
  await expect
    .poll(
      async () => {
        if (await host.locator(".tetris-results").count()) return true
        await host.keyboard.press("Space")
        return false
      },
      { timeout: 15000, intervals: [100] },
    )
    .toBe(true)
  await expect(host.locator("#tetris-rematch")).toHaveText("Сыграть ещё")
  await verifyResults(host, "solo")
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
  await openTetrisAndReturn(host, () => host.locator(`#game-join-${pairID}`).click())
  await host.locator("#tetris-ready").click()
  await observer.locator("#tetris-ready").click()
  await expect(observer.locator("#tetris-start")).toHaveText("Начать вдвоём")
  await observer.locator("#tetris-start").click()
  await expect(host.locator("#tetris-control-drop")).toBeVisible({ timeout: 10000 })
  await expect(host.locator(".tetris-board canvas")).toHaveCount(2)
  await leave(host)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const mobile = await mobileContext.newPage()
  await enter(mobile, "tetris-mobile")
  await verifyMobileTetris(mobile, screenshots)
  await leave(mobile)
  await mobileContext.close()
  await verifyBlockedTetris(host)
  await leave(host)
  assert.deepEqual(errors, [])
  console.log(
    "Tetris verified: command, invitation, 3-player cap, observer, readiness, early 2-player start, rematch, solo privacy, score, pause, audio, leaderboard, responsive screenshots.",
  )
} finally {
  await browser.close()
}
