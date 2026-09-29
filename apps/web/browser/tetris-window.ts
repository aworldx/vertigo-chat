import assert from "node:assert/strict"
import { expect, type Page, type WebSocket } from "@playwright/test"
import { record } from "../src/shared/api/json"

export async function openTetrisAndReturn(page: Page, launch: () => Promise<void>) {
  const opened = page.waitForEvent("popup")
  await launch()
  const popup = await opened
  await expect(popup.locator("#tetris-game")).toBeVisible()
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  await expect(page.locator("#tetris-game")).toHaveCount(0)
  await popup.close({ runBeforeUnload: true })
  await expect(page.locator("#tetris-game")).toBeVisible()
}

export async function verifyTetrisWindow(page: Page, screenshots: string) {
  let sockets = 0
  const count = () => {
    sockets++
  }
  page.on("websocket", count)
  try {
    const opened = page.waitForEvent("popup")
    await page.locator("#tetris-popout").click()
    const popup = await opened
    await expect(popup.locator(".tetris-match-state")).toHaveText("Пауза")
    await expect(popup.locator("#chat-room, #tetris-popout, #tetris-window-return")).toHaveCount(0)
    await expect(page.locator("#tetris-window-notice")).toBeVisible()
    await popup.locator("#tetris-keyboard").focus()
    await popup.keyboard.press("KeyP")
    await expect(popup.locator(".tetris-match-state")).not.toHaveText("Пауза")
    await popup.keyboard.press("Space")
    await expect(popup.locator(".tetris-mine .tetris-player-footer")).not.toContainText(/^0 очков/u)
    await popup.keyboard.press("KeyP")
    await expect(popup.locator(".tetris-match-state")).toHaveText("Пауза")
    const score = await popup.locator(".tetris-mine .tetris-player-footer").textContent()
    assert.ok(score)
    await expect(popup.locator(".tetris-mine canvas")).toBeVisible()
    assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await popup.screenshot({ path: `${screenshots}/separate-window.png` })
    await popup.close({ runBeforeUnload: true })
    await expect(page.locator(".tetris-match-state")).toHaveText("Пауза")
    await expect(page.locator(".tetris-mine .tetris-player-footer")).toHaveText(score)
    await expect(page.locator("#tetris-window-notice")).toHaveCount(0)
    assert.equal(sockets, 0, "moving the game must preserve both game and chat connections")
  } finally {
    page.off("websocket", count)
  }
}

export async function verifyMobileTetris(page: Page, screenshots: string) {
  await page.setViewportSize({ width: 390, height: 844 })
  let popups = 0
  const count = () => {
    popups++
  }
  page.on("popup", count)
  try {
    await page.locator("#message-body").fill("/тетрис соло")
    await page.locator("#send-message").click()
    await expect(page.locator("#tetris-pause")).toBeVisible({ timeout: 10000 })
    await expect(page.locator("#tetris-popout")).toBeHidden()
    await expect(page.locator(".tetris-connection")).toHaveText("")
    assert.equal(popups, 0)
    for (const action of ["left", "rotate", "right", "drop"]) await page.locator(`#tetris-control-${action}`).tap()
    await expect(page.locator(".tetris-mine .tetris-player-footer")).not.toContainText(/^0 очков/u)
    await page.locator("#tetris-pause").tap()
    await verifyTouchControls(page)
    await page.screenshot({ path: `${screenshots}/mobile-inline.png` })
  } finally {
    page.off("popup", count)
  }
}

export async function verifyTouchControls(page: Page) {
  const boxes = await Promise.all(
    ["left", "rotate", "right", "drop"].map((name) => page.locator(`#tetris-control-${name}`).boundingBox()),
  )
  const [left, rotate, right, drop] = boxes
  assert.ok(left && rotate && right && drop)
  for (const box of [left, rotate, right, drop])
    assert.ok(box.height >= 56 && box.width >= 80, "primary touch targets must be large")
  assert.ok(Math.abs(left.y - rotate.y) < 1 && Math.abs(right.y - rotate.y) < 1)
  assert.ok(left.x + left.width + 7 <= rotate.x && rotate.x + rotate.width + 7 <= right.x, "movement buttons need gaps")
  assert.ok(
    drop.y >= left.y + left.height + 7 && drop.width >= right.x + right.width - left.x - 1,
    "hard drop gets its own full-width row",
  )
  const board = await page.locator(".tetris-mine .tetris-board").boundingBox()
  const secondary = await page.locator("#tetris-control-hold").boundingBox()
  assert.ok(board && secondary && board.y + board.height <= left.y && secondary.y >= drop.y + drop.height + 7)
  assert.ok(secondary.height >= 44)
  assert.ok(secondary.y + secondary.height <= (page.viewportSize()?.height ?? 0), "all controls stay on screen")
}

export async function verifyBlockedTetris(page: Page) {
  let pauseConfirmed = false
  const observe = (socket: WebSocket) => {
    if (!socket.url().includes("/api/v1/tetris/")) return
    socket.on("framereceived", ({ payload }) => {
      const frame: unknown = JSON.parse(String(payload))
      if (record(frame) && record(frame.game) && frame.game.paused === true) pauseConfirmed = true
    })
  }
  page.on("websocket", observe)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => {
    window.open = () => null
  })
  await page.locator("#message-body").fill("/тетрис соло")
  await page.locator("#send-message").click()
  await expect(page.locator("#tetris-pause")).toBeVisible({ timeout: 10000 })
  await expect(page.locator(".tetris-connection")).toContainText("Браузер заблокировал окно")
  await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
  await page.locator("#tetris-pause").click()
  await expect.poll(() => pauseConfirmed).toBe(true)
  page.off("websocket", observe)
  await page.reload()
  await expect(page.locator(".tetris-match-state")).toHaveText("Пауза")
}
