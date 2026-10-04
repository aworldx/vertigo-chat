import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { expect, type Browser, type Page } from "@playwright/test"
import { record } from "../src/shared/api/json"
import { isGame, type Game } from "../src/features/tetris/api/protocol"

export async function canvasCells(page: Page) {
  return page.locator(".tetris-mine canvas").evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext("2d")
    if (!context) throw new Error("No canvas context")
    const cells: number[][] = []
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 10; x++) {
        const [r = 0, g = 0, b = 0] = context.getImageData(x * 24 + 12, y * 24 + 12, 1, 1).data
        if (Math.max(r, g, b) > 100 && Math.max(r, g, b) - Math.min(r, g, b) > 25) cells.push([x, y, r, g, b])
      }
    return cells
  })
}

// Controlled checkpoints exercise rare clear/lock boundaries through the actual UI.
// The regular suite separately exercises real authority, reconnect and results.
export async function verifyLocalCycle(browser: Browser, origin: string, screenshots: string) {
  const raw: unknown = JSON.parse(
    readFileSync(new URL("../../../contracts/fixtures/tetris-simulation.json", import.meta.url), "utf8"),
  )
  assert.ok(Array.isArray(raw))
  const first: unknown = raw[0]
  assert.ok(record(first) && isGame(first.initial))
  const initial: Game = first.initial
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  try {
    const page = await context.newPage()
    let deliver: ((game: Game) => void) | undefined
    const commands: unknown[] = []
    await page.routeWebSocket("**/api/v1/tetris/*/socket", (route) => {
      deliver = (game) => {
        route.send(JSON.stringify({ type: "state", game }))
      }
      route.onMessage((message) => {
        const value: unknown = JSON.parse(String(message))
        if (record(value) && value.type === "auth") deliver?.(initial)
        else commands.push(value)
      })
    })
    await page.goto(origin)
    await page.locator("#entrance-nickname").fill("local-cycle-" + Date.now().toString().slice(-5))
    await page.locator("#enter-chat").click()
    await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
    await page.evaluate((id) => {
      sessionStorage.setItem("vertigo.tetris", JSON.stringify({ id, join: false }))
    }, initial.id)
    await page.reload()
    await expect(page.locator("#tetris-control-drop")).toBeVisible()
    await expect.poll(async () => (await canvasCells(page)).length).toBe(4)
    // No further server frame: gravity must still advance.
    const top = Math.min(...(await canvasCells(page)).map((cell) => cell[1] ?? 0))
    await expect
      .poll(async () => Math.min(...(await canvasCells(page)).map((cell) => cell[1] ?? 0)), {
        timeout: 1500,
        intervals: [50],
      })
      .toBeGreaterThan(top)
    assert.ok(deliver)
    const clear = structuredClone(initial)
    clear.revision = 1000
    clear.elapsed_ms = 10000
    const p = clear.players[0]
    assert.ok(p?.simulation)
    p.sequence = 100
    p.simulation.piece_id = 10
    p.active = { kind: 1, rotation: 0, x: 3, y: 0 }
    p.ghost = { ...p.active, y: 18 }
    p.next = [2, 3, 4, 5, 6, 7]
    p.cells[19] = [7, 7, 7, 0, 0, 0, 0, 7, 7, 7]
    deliver(clear)
    await expect.poll(async () => (await canvasCells(page)).length).toBe(10)
    const started = Date.now()
    await page.locator("#tetris-control-drop").tap()
    await expect(page.locator(".tetris-player-footer")).toContainText("1 линий", { timeout: 500 })
    await expect.poll(async () => (await canvasCells(page)).length, { timeout: 500, intervals: [10] }).toBe(4)
    assert.ok(Date.now() - started < 500, "clear/spawn waited for network")
    await expect.poll(async () => (await canvasCells(page)).every((cell) => (cell[1] ?? 20) < 3)).toBe(true)
    assert.equal(
      commands.filter((value) => record(value) && value.type === "drop").length,
      1,
      "one touch must produce exactly one drop",
    )
    const drop = commands.find((value) => record(value) && value.type === "drop")
    assert.ok(record(drop) && drop.piece_id === 10)
    await page.locator("#tetris-control-rotate").tap()
    const rotate = commands.find((value) => record(value) && value.type === "rotate")
    assert.ok(record(rotate) && rotate.piece_id === 11)
    const ground = structuredClone(initial)
    ground.revision = 2000
    ground.elapsed_ms = 20000
    const grounded = ground.players[0]
    assert.ok(grounded?.simulation)
    grounded.sequence = 200
    grounded.simulation.piece_id = 20
    grounded.active = { kind: 3, rotation: 0, x: 3, y: 18 }
    grounded.ghost = { ...grounded.active }
    deliver(ground)
    await expect.poll(async () => (await canvasCells(page)).length).toBe(4)
    await expect.poll(async () => (await canvasCells(page)).length, { timeout: 1200, intervals: [50] }).toBe(8)
    const locked = (await canvasCells(page)).filter((cell) => (cell[1] ?? 0) >= 18)
    await page.locator("#tetris-control-rotate").tap()
    assert.deepEqual(
      (await canvasCells(page)).filter((cell) => (cell[1] ?? 0) >= 18),
      locked,
    )
    await page.screenshot({ path: `${screenshots}/local-lock-mobile.png` })
    console.log(
      "Local cycle: withheld server frames; gravity, immediate line clear/spawn, natural lock, immutable locked cells and piece-scoped input passed.",
    )
  } finally {
    await context.close()
  }
}
