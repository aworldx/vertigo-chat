import assert from "node:assert/strict"
import { expect, type Browser, type Page } from "@playwright/test"
import { decodeFrame, type Message, type Snapshot } from "../src/features/chat/api/protocol"
import { defaultPreferences } from "../src/features/chat/api/preferences"
function fixtureMessage(id: number): Message {
  return {
    id,
    client_id: `scroll-${String(id)}`,
    author: "scroll-sender",
    recipient: "",
    kind: "text",
    body: `Строка ${String(id)} — проверка плавного появления.`,
    sent_at: new Date(1800000000000 + id * 1000).toISOString(),
    appearance: defaultPreferences.appearance,
    font_id: "theme",
    font_style: "normal",
    reactions: {},
    reacted: [],
  }
}
async function observeScroll(page: Page) {
  await page.locator("#messages").evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error("missing feed")
    delete element.dataset.scrollSamples
    const observer = new MutationObserver(() => {
      observer.disconnect()
      const samples: number[] = []
      const started = performance.now()
      samples.push(element.scrollHeight - element.clientHeight - element.scrollTop)
      const timer = setInterval(() => {
        samples.push(element.scrollHeight - element.clientHeight - element.scrollTop)
        if (performance.now() - started >= 550) {
          clearInterval(timer)
          element.dataset.scrollSamples = JSON.stringify(samples)
        }
      }, 16)
    })
    observer.observe(element, { childList: true })
  })
}
async function assertSmooth(page: Page) {
  await expect(page.locator("#messages")).toHaveAttribute("data-scroll-samples", /.+/)
  const samples: unknown = JSON.parse((await page.locator("#messages").getAttribute("data-scroll-samples")) ?? "null")
  assert.ok(Array.isArray(samples) && samples.every((v: unknown) => typeof v === "number"))
  assert.ok(
    samples.some((v: unknown) => typeof v === "number" && v > 5),
    "New message jumped straight to the bottom",
  )
  assert.ok(
    samples.some((v: unknown, i: number) => i > 0 && typeof v === "number" && v > 1 && v < Number(samples[0]) - 1),
    "No intermediate scroll positions",
  )
  assert.ok(Number(samples.at(-1)) < 1, "Scroll did not settle at the bottom")
}
export async function verifyMessageScroll(browser: Browser, origin: string) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, reducedMotion: "no-preference" })
  let messages = Array.from({ length: 100 }, (_, i) => fixtureMessage(10000 + i))
  let publish: (() => void) | undefined
  await context.routeWebSocket("**/api/v1/chat/socket", (socket) => {
    const server = socket.connectToServer()
    let current: Snapshot | undefined
    server.onMessage((raw) => {
      const frame = typeof raw === "string" ? decodeFrame(raw) : null
      if (frame?.type === "ready" || frame?.type === "snapshot") {
        current = { ...frame.snapshot, messages }
        socket.send(JSON.stringify({ ...frame, snapshot: current }))
      } else socket.send(raw)
    })
    publish = () => {
      if (current) socket.send(JSON.stringify({ type: "snapshot", snapshot: { ...current, messages } }))
    }
  })
  const page = await context.newPage()
  try {
    await page.goto(origin)
    await page.locator("#entrance-nickname").fill(`scroll-${String(Date.now())}`)
    await page.locator("#enter-chat").click()
    await expect(page.locator("#messages > [data-message-id]")).toHaveCount(100)
    await expect
      .poll(() => page.locator("#messages").evaluate((e) => e.scrollHeight - e.clientHeight - e.scrollTop))
      .toBeLessThan(1)
    assert.ok(publish)
    await observeScroll(page)
    messages = [...messages.slice(1), fixtureMessage(10100)]
    publish()
    await expect(page.locator('[data-message-id="10100"]')).toBeAttached()
    await assertSmooth(page)
    // Reading older messages keeps the same visible content when the window rolls.
    await page.locator("#messages").evaluate((e) => {
      e.scrollTop -= 300
    })
    await page.evaluate(() => new Promise(requestAnimationFrame))
    const anchor = page.locator('[data-message-id="10095"]')
    const before = await anchor.boundingBox()
    assert.ok(before)
    await observeScroll(page)
    messages = [...messages.slice(1), fixtureMessage(10101)]
    publish()
    await expect(page.locator('[data-message-id="10101"]')).toBeAttached()
    const after = await anchor.boundingBox()
    assert.ok(after)
    assert.ok(Math.abs(before.y - after.y) < 1, "Incoming message moved the history being read")
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.locator("#messages").evaluate((e) => {
      e.scrollTop = e.scrollHeight
    })
    await page.evaluate(() => new Promise(requestAnimationFrame))
    await expect
      .poll(() => page.locator("#messages").evaluate((e) => e.scrollHeight - e.clientHeight - e.scrollTop))
      .toBeLessThan(1)
    messages = [...messages.slice(1), fixtureMessage(10102)]
    publish()
    await expect(page.locator('[data-message-id="10102"]')).toBeAttached()
    await expect
      .poll(() => page.locator("#messages").evaluate((e) => e.scrollHeight - e.clientHeight - e.scrollTop))
      .toBeLessThan(1)
    await page.locator("#leave-chat").click()
  } finally {
    await context.close()
  }
}
