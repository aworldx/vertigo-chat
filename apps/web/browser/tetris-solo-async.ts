import assert from "node:assert/strict"
import { expect, type Browser } from "@playwright/test"
import { isGame, type Game } from "../src/features/tetris/api/protocol"
import { record } from "../src/shared/api/json"
import { canvasCells } from "./tetris-cycle"

export async function verifySoloAsync(browser: Browser, origin: string, screenshots: string) {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      hasTouch: mobile,
    })
    const page = await context.newPage()
    let latest: Game | null = null
    let withheld = false
    let release = () => {}
    const received = () => latest
    await page.routeWebSocket("**/api/v1/tetris/*/socket", (route) => {
      const server = route.connectToServer()
      let queued: string | Buffer | null = null
      release = () => {
        if (queued !== null) route.send(queued)
        queued = null
      }
      server.onMessage((message) => {
        const value: unknown = JSON.parse(message.toString())
        if (record(value) && value.type === "state" && isGame(value.game)) latest = value.game
        if (withheld) queued = message
        else route.send(message)
      })
    })
    try {
      await page.goto(origin)
      await page.locator("#entrance-nickname").fill(mobile ? "async-solo-mobile" : "async-solo-popup")
      await page.locator("#enter-chat").click()
      await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
      const opened = mobile ? null : page.waitForEvent("popup")
      await page.locator("#message-body").fill("/тетрис соло")
      await page.locator("#send-message").click()
      const game = opened ? await opened : page
      await expect(game.locator("#tetris-pause")).toBeVisible({ timeout: 10000 })
      await expect.poll(() => received()?.client_clock).toBe(true)
      withheld = true
      // Explicitly cross the former 2-second hard stop without delivering snapshots.
      await game.waitForTimeout(3200)
      await game.locator("#tetris-keyboard").focus()
      await game.keyboard.press("Space")
      await expect.poll(async () => (await canvasCells(game)).length).toBe(8)
      await expect(game.locator(".tetris-connection")).toHaveText("")
      const cells = await canvasCells(game)
      await game.keyboard.press("ArrowRight")
      await expect.poll(async () => JSON.stringify(await canvasCells(game))).not.toBe(JSON.stringify(cells))
      withheld = false
      release()
      await expect.poll(() => received()?.players[0]?.simulation?.piece_id).toBe(2)
      await game.keyboard.press("KeyP")
      await expect.poll(() => received()?.paused).toBe(true)
      await context.setOffline(true)
      // Notify the transport deterministically; the browser also rejects reconnects.
      await page.evaluate(() => window.dispatchEvent(new Event("offline")))
      await game.waitForTimeout(mobile ? 3200 : 22500)
      await game.keyboard.press("KeyP")
      await game.keyboard.press("Space")
      await expect.poll(async () => (await canvasCells(game)).length).toBe(12)
      await game.keyboard.press("KeyP")
      await expect(game.locator(".tetris-match-state")).toHaveText("Пауза")
      await expect(game.locator(".tetris-connection")).toContainText("Синхронизация")
      const footer = await game.locator(".tetris-player-footer").textContent()
      await context.setOffline(false)
      await page.evaluate(() => window.dispatchEvent(new Event("online")))
      await expect.poll(() => received()?.paused, { timeout: 15000 }).toBe(true)
      await expect.poll(() => received()?.players[0]?.simulation?.piece_id).toBe(3)
      assert.ok(footer?.includes(String(received()?.players[0]?.score)))
      await expect(game.locator(".tetris-player-footer")).toHaveText(footer ?? "")
      await game.screenshot({ path: `${screenshots}/async-${mobile ? "mobile" : "popup"}.png` })
      if (game !== page) await game.close({ runBeforeUnload: true })
      await page.reload()
      await expect(page.locator(".tetris-match-state")).toHaveText("Пауза", { timeout: 10000 })
      await expect(page.locator(".tetris-player-footer")).toHaveText(footer ?? "")
      page.on("dialog", (dialog) => {
        void dialog.accept()
      })
      await page.locator("#tetris-close").click()
      console.log(
        `Async solo ${mobile ? "mobile" : "popup"}: delayed acknowledgements, offline controls, replay verification and reload PASS`,
      )
    } finally {
      await context.close()
    }
  }
}
