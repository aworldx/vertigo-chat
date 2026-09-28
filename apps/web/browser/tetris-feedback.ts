import assert from "node:assert/strict"
import { expect, type Page } from "@playwright/test"

export async function installFeedbackProbe(page: Page) {
  await page.addInitScript(() => {
    const starts: number[] = []
    Object.defineProperty(window, "tetrisSoundStarts", { value: starts })
    const create = Reflect.get(AudioContext.prototype, "createOscillator")
    AudioContext.prototype.createOscillator = function () {
      const oscillator = create.call(this)
      const start = oscillator.start.bind(oscillator)
      oscillator.start = (when) => {
        starts.push(oscillator.frequency.value)
        start(when)
      }
      return oscillator
    }
  })
  let paused = false
  const releases = new Set<() => void>()
  await page.routeWebSocket("**/api/v1/tetris/*/socket", (route) => {
    const server = route.connectToServer()
    let queued: string | Buffer | null = null
    releases.add(() => {
      if (queued !== null) route.send(queued)
      queued = null
    })
    server.onMessage((message) => {
      if (paused) queued = message
      else route.send(message)
    })
  })
  return async () => {
    await page.locator("#tetris-settings-toggle").click()
    await page.locator("#tetris-music-volume").focus()
    await page.keyboard.press("Home")
    await page.locator("#tetris-settings-toggle").click()
    await page.locator("#tetris-audio-toggle").click()
    await expect(page.locator("#tetris-audio-toggle")).toHaveAttribute("aria-pressed", "true")
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "tetrisSoundStarts") as number[])).toContain(1046.5)
    await page.locator("#tetris-keyboard").focus()
    paused = true
    try {
      const latency = await page.evaluate(async () => {
        const canvas = document.querySelector(".tetris-mine canvas")
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error("No game canvas")
        const context = canvas.getContext("2d")
        if (!context) throw new Error("No canvas context")
        const pixels = {
          position() {
            let sum = 0,
              count = 0
            for (let y = 0; y < 20; y++)
              for (let x = 0; x < 10; x++) {
                const [r = 0, g = 0, b = 0] = context.getImageData(x * 24 + 12, y * 24 + 12, 1, 1).data
                if (Math.max(r, g, b) > 100 && Math.max(r, g, b) - Math.min(r, g, b) > 25) {
                  sum += x
                  count++
                }
              }
            return count ? sum / count : -1
          },
        }
        const before = pixels.position()
        if (before < 0) throw new Error("Active piece is not painted")
        const start = performance.now()
        window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight" }))
        window.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowRight" }))
        while (pixels.position() === before && performance.now() - start < 300) {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => {
              resolve()
            }),
          )
        }
        return pixels.position() !== before ? performance.now() - start : 999
      })
      assert.ok(latency < 250, `Local movement waited ${String(latency)}ms with server replies withheld`)
      await expect.poll(() => page.evaluate(() => Reflect.get(window, "tetrisSoundStarts") as number[])).toContain(600)
      console.log(
        `Tetris feedback: local canvas moved in ${String(Math.round(latency))}ms without a server reply; Web Audio preview and movement scheduled.`,
      )
    } finally {
      paused = false
      releases.forEach((release) => {
        release()
      })
    }
    await page.locator("#tetris-control-drop").click()
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "tetrisSoundStarts") as number[])).toContain(90)
    await page.locator("#tetris-audio-toggle").click()
  }
}
