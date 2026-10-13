import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { expect, type Locator } from "@playwright/test"
import { PNG } from "pngjs"
import { launchBrowser } from "./coverage"
import { wideEmojiImage } from "./fixtures/emoji-wide"
import { defaultPreferences } from "../src/features/chat/api/preferences"
import { record } from "../src/features/chat/api/entrance"
import type { Message, Snapshot } from "../src/features/chat/api/protocol"

const origin = process.argv[2] ?? "http://127.0.0.1:4080"
const mode = process.env.EMOJI_CAPTURE_MODE ?? "actual"
assert.ok(["baseline", "mock", "actual"].includes(mode))
const output = process.env.EMOJI_ARTIFACT_DIR ?? "/tmp/emoji-design"
await mkdir(`${output}/${mode}`, { recursive: true })
const wide = wideEmojiImage
const specs = [
  { id: 901, code: "сарказм", width: 78, height: 24, expected: [78, 24] },
  { id: 902, code: "wide", width: 100, height: 20, expected: [80, 16] },
  { id: 903, code: "tall", width: 20, height: 100, expected: [4.8, 24] },
  { id: 904, code: "square", width: 100, height: 100, expected: [24, 24] },
  { id: 905, code: "small", width: 12, height: 12, expected: [12, 12] },
]
const images = new Map<number, Buffer>([[901, wide]])
for (const spec of specs.slice(1)) {
  const png = new PNG({ width: spec.width, height: spec.height })
  for (let i = 0; i < png.data.length; i += 4) png.data.set([232, 172, 56, 255], i)
  images.set(spec.id, PNG.sync.write(png))
}
const body = "Вот это отличная идея -сарказм- Текст после смайла.\nРазмеры: -wide- -tall- -square- -small-"
const baseMessage: Message = {
  id: 901,
  client_id: "fixture-message",
  author: "Лиса",
  recipient: "",
  kind: "text",
  body,
  sent_at: "2026-10-13T12:00:00Z",
  appearance: defaultPreferences.appearance,
  font_id: "theme",
  font_style: "normal",
  reactions: {},
  reacted: [],
}
async function assertSize(image: Locator, expected: number[]) {
  await expect(image).toBeVisible()
  const box = await image.boundingBox()
  assert.ok(box)
  assert.ok(Math.abs(box.width - (expected[0] ?? 0)) < 0.1, `width ${String(box.width)} != ${String(expected[0])}`)
  assert.ok(Math.abs(box.height - (expected[1] ?? 0)) < 0.1, `height ${String(box.height)} != ${String(expected[1])}`)
}
const browser = await launchBrowser({ headless: true })
const results: object[] = []
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    for (const frame of [true, false]) {
      const name = `${String(viewport.width)}-${frame ? "framed" : "compact"}`
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        locale: "ru-RU",
        timezoneId: "Europe/Moscow",
      })
      const preferences = {
        ...defaultPreferences,
        appearance: { ...defaultPreferences.appearance, message_frame: frame, hide_karmik: true },
      }
      const snapshot: Snapshot = {
        preferences,
        admin: false,
        typing: [],
        messages: [baseMessage],
        peers: [
          {
            id: "fixture",
            nickname: "Проверка",
            registered: false,
            self: true,
            bot: false,
            status: "active",
            rank: null,
            preferences,
          },
        ],
      }
      await context.addInitScript(() => {
        sessionStorage.setItem("vertigo.go-chat", JSON.stringify({ nickname: "Проверка", resume_token: "fixture" }))
      })
      await context.route("**/api/v1/chat/emojis", (route) =>
        route.fulfill({
          json: { data: specs.map(({ id, code, width, height }) => ({ id, code, width, height, terms: [] })) },
        }),
      )
      await context.route("**/emojis/*", (route) => {
        const id = Number(new URL(route.request().url()).pathname.split("/").at(-1))
        const image = images.get(id)
        assert.ok(image)
        return route.fulfill({ contentType: "image/png", body: image })
      })
      await context.routeWebSocket("**/api/v1/chat/socket", (socket) => {
        socket.onMessage((raw) => {
          const value: unknown = JSON.parse(String(raw))
          if (!record(value)) return
          if (value.type === "resume")
            socket.send(JSON.stringify({ type: "ready", snapshot, connection_id: "fixture", generation: 1 }))
          if (value.type === "send" && typeof value.body === "string" && typeof value.client_id === "string") {
            const existing = snapshot.messages.find((message) => message.client_id === value.client_id)
            const message = existing ?? {
              ...baseMessage,
              id: 902,
              author: "Проверка",
              body: value.body,
              client_id: value.client_id,
            }
            if (!existing) snapshot.messages.push(message)
            socket.send(JSON.stringify({ type: "ack", message }))
            socket.send(JSON.stringify({ type: "snapshot", snapshot }))
          }
        })
      })
      const page = await context.newPage()
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      await page.goto(`${origin}/chat`)
      await expect(page.locator("#message-body")).toBeVisible()
      await page.reload()
      await expect(page.locator("#messages")).toContainText("Вот это отличная идея")
      await page.locator("#toggle-emoji-picker").click()
      await expect(page.locator("#emoji-picker-list img")).toHaveCount(5)
      if (mode === "mock") {
        // Design proposal applied to the baseline before production source changes.
        await page.addStyleTag({
          content:
            ".chat-inline-emoji img, #emoji-picker-list img { max-width:80px; max-height:24px; flex-shrink:0; } #emoji-picker-list > button { width:auto; min-width:40px; height:40px; padding-left:8px; padding-right:8px; transform:none; }",
        })
      }
      await page.evaluate(() => document.fonts.ready)
      await expect
        .poll(() =>
          page
            .locator("img[src^='/emojis/']")
            .evaluateAll((nodes) =>
              nodes.every((n) => n instanceof HTMLImageElement && n.complete && n.naturalWidth > 0),
            ),
        )
        .toBe(true)
      await page.mouse.move(0, 0)
      await page.screenshot({ path: `${output}/${mode}/${name}.png`, animations: "disabled" })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      if (mode !== "baseline") {
        for (const spec of specs) {
          await assertSize(page.locator(`#messages img[src='/emojis/${String(spec.id)}']`), spec.expected)
          const pickerImage = page.locator(`#emoji-picker-list img[src='/emojis/${String(spec.id)}']`)
          await pickerImage.scrollIntoViewIfNeeded()
          await assertSize(pickerImage, spec.expected)
        }
        const button = page.locator("[data-emoji-code='-сарказм-']")
        await button.hover()
        await assertSize(button.locator("img"), [78, 24])
        await button.click()
        await expect(page.locator("#message-body")).toHaveValue("-сарказм-")
        await page.locator("#message-body").fill("Отправка -сарказм- рядом с текстом")
        await page.locator("#send-message").click()
        const sent = page.locator("#messages [data-message-kind='text']").filter({ hasText: "Отправка" })
        await expect(sent).toContainText("рядом с текстом")
        await expect(sent).toHaveCount(1)
        await expect(sent).toHaveAttribute("data-message-id", "902")
        if (frame) await expect(sent.locator('[data-delivery-state="published"]')).toBeAttached()
        await assertSize(sent.locator(".chat-inline-emoji img[alt='-сарказм-']"), [78, 24])
        if (mode === "actual") {
          await page.reload()
          await expect(page.locator("#messages")).toContainText("Отправка")
          await assertSize(
            page
              .locator("#messages [data-message-kind='text']")
              .filter({ hasText: "Отправка" })
              .locator(".chat-inline-emoji img[alt='-сарказм-']"),
            [78, 24],
          )
        }
      }
      assert.deepEqual(errors, [])
      results.push({ viewport, frame, mode, route: "/chat", auth: "guest fixture", passed: true })
      await context.close()
    }
  }
} finally {
  await browser.close()
}
await writeFile(`${output}/${mode}/results.json`, JSON.stringify(results, null, 2))
console.log(`Emoji ${mode}: ${String(results.length)} viewport/mode scenarios passed`)
