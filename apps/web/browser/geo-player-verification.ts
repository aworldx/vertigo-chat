import assert from "node:assert/strict"
import { chromium, expect } from "@playwright/test"
import { decodeFrame, type Message } from "../src/features/chat/api/protocol"
import { defaultPreferences } from "../src/features/chat/api/preferences"

const origin = process.argv[2] ?? "http://127.0.0.1:4094"
const browser = await chromium.launch({ headless: true })
const audio = Buffer.alloc(44 + 8000 * 2 * 60)
audio.write("RIFF", 0)
audio.writeUInt32LE(audio.length - 8, 4)
audio.write("WAVEfmt ", 8)
audio.writeUInt32LE(16, 16)
audio.writeUInt16LE(1, 20)
audio.writeUInt16LE(1, 22)
audio.writeUInt32LE(8000, 24)
audio.writeUInt32LE(16000, 28)
audio.writeUInt16LE(2, 32)
audio.writeUInt16LE(16, 34)
audio.write("data", 36)
audio.writeUInt32LE(audio.length - 44, 40)
const music: Message = {
  id: 90010,
  client_id: "geo-player",
  kind: "music",
  author: "moon",
  recipient: "",
  body: "Ночной трамвай",
  artist: "Чатлане",
  duration: "1:00",
  media_url: "https://sunproxy.net/file/geo-fixture",
  sent_at: "2026-10-07T10:00:00Z",
  appearance: defaultPreferences.appearance,
  font_id: "sans",
  font_style: "normal",
  reactions: {},
  reacted: [],
}
try {
  for (const theme of ["autumn", "vertigo_glass"]) {
    for (const [width, height] of [
      [1440, 900],
      [1280, 678],
      [1024, 678],
      [768, 1024],
      [390, 844],
      [844, 390],
      [390, 544],
      [320, 740],
    ] as const) {
      const desktopPlayer = width >= 768 && height >= 481
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" })
      const page = await context.newPage()
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      let ownAnswer = ""
      await page.route("**/api/v1/geo**", (route) => {
        if (route.request().method() === "PUT") {
          const body: unknown = route.request().postDataJSON()
          assert.ok(body && typeof body === "object" && "text" in body && typeof body.text === "string")
          ownAnswer = body.text
        }
        return route.fulfill({
          json: {
            id: "geo-player",
            phase: "active",
            round: 2,
            total: 5,
            configured: true,
            deadline: new Date(Date.now() + 278000).toISOString(),
            server_time: new Date().toISOString(),
            cooldown: new Date().toISOString(),
            browser_key: "fixture",
            own_answer: ownAnswer,
            answered: ownAnswer ? 1 : 0,
            leaders: [],
            scene: { pano_id: "fixture", heading: 0, pitch: 0 },
          },
        })
      })
      await page.route("**/music-proxy?*", (route) => route.fulfill({ contentType: "audio/wav", body: audio }))
      await page.route("https://maps.googleapis.com/maps/api/js?**", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: `window.google={maps:{StreetViewPanorama:class {constructor(el){el.innerHTML='<img alt="Тестовая панорама" src="/geo-test-location" style="width:100%;height:100%;object-fit:cover">'}addListener(n,fn){const t=setTimeout(fn,0);return {remove(){clearTimeout(t)}}}getStatus(){return 'OK'}setPano(){}setPov(){}setZoom(){}setVisible(){}},event:{trigger(){}}}};`,
        }),
      )
      await page.route("**/geo-test-location", (route) =>
        route.fulfill({ path: "/app/docs/design/geo-chat/reference-v1/assets/location.jpg" }),
      )
      await context.routeWebSocket("**/api/v1/chat/socket", (socket) => {
        const server = socket.connectToServer()
        server.onMessage((raw) => {
          const frame = typeof raw === "string" ? decodeFrame(raw) : null
          if (frame?.type === "ready" || frame?.type === "snapshot") {
            const preferences = frame.snapshot.preferences
            socket.send(
              JSON.stringify({
                ...frame,
                snapshot: {
                  ...frame.snapshot,
                  messages: [music],
                  preferences: {
                    ...preferences,
                    theme_id: theme,
                    appearance: { ...preferences.appearance, use_player: true },
                  },
                },
              }),
            )
          } else socket.send(raw)
        })
      })
      try {
        await page.goto(origin + "/chat")
        await expect(page.locator("#chat-login-link")).toBeVisible()
        await page.goto(origin)
        await page.locator("#entrance-nickname").fill("geo-ui-" + Date.now().toString().slice(-9))
        await page.locator("#enter-chat").click()
        await expect(page.locator("#chat-room")).toHaveAttribute("data-chat-joined", "true")
        await expect(page.locator("#geo-game")).toHaveClass(/collapsed/)
        const video = page.locator(desktopPlayer ? "#chat-tv-media" : "#media-message-90010-audio")
        if (desktopPlayer) {
          await page.locator("#media-message-90010-play").click()
          await expect
            .poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && !e.paused && e.currentTime > 0))
            .toBe(true)
          await video.evaluate((e) => {
            e.setAttribute("data-geo-stable", "true")
            if (e instanceof HTMLMediaElement) e.loop = true
          })
        }
        if (!desktopPlayer) {
          await expect(page.locator("#chat-tv")).toHaveCount(0)
          await video.evaluate(async (e) => {
            if (e instanceof HTMLMediaElement) {
              e.loop = true
              await e.play()
            }
          })
          await expect
            .poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && !e.paused && e.currentTime > 0))
            .toBe(true)
        }
        await page.locator(".geo-mini").click()
        await expect(page.locator(".geo-return")).toBeEnabled()
        await expect(page.locator(".chat-room-sidebar")).toBeHidden()
        const room = await page.locator(".chat-room-content").boundingBox()
        const main = await page.locator("#dialogue-frame").boundingBox()
        assert.ok(
          room && main && main.width >= room.width - 3,
          "open game uses the whole row, with no player-created sidebar column",
        )
        await page.getByRole("button", { name: "Свернуть игру", exact: true }).click()
        await expect(page.locator("#geo-game")).toHaveClass(/collapsed/)
        if (width >= 768) await expect(page.locator(".chat-room-sidebar")).toBeVisible()
        await page.locator(".geo-mini").click()
        if (desktopPlayer) {
          await page.locator("#chat-tv-expand").click()
          await expect(page.locator("#chat-tv")).toHaveAttribute("data-mode", "expanded")
          await expect(page.locator("#chat-tv .chat-tv-mini")).toBeHidden()
          await expect(page.locator(".chat-room-sidebar")).toBeHidden()
          const panel = await page.locator("#chat-tv-panel").boundingBox()
          assert.ok(panel && panel.x >= room.x && panel.x + panel.width <= room.x + room.width + 1)
          await page.getByRole("button", { name: "Свернуть игру", exact: true }).click()
          await page.locator("#chat-tv-collapse").click()
          await expect(page.locator(".chat-room-sidebar")).toBeVisible()
          await page.locator(".geo-mini").click()
          await page.locator("#chat-tv-expand").click()
          await page.locator("#chat-tv-collapse").click()
          await expect(video).toHaveAttribute("data-geo-stable", "true")
          await expect.poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && !e.paused)).toBe(true)
        }
        await expect(page.locator("#karmik")).toBeHidden()
        await page.locator("#geo-answer").fill("USA")
        await page.getByRole("button", { name: "Ответить", exact: true }).click()
        await expect(page.locator(".geo-answer-saved")).toContainText("USA")
        const scene = await page.locator(".geo-scene").boundingBox()
        const game = await page.locator("#geo-game").boundingBox()
        assert.ok(
          scene && game && scene.height >= game.height * (height <= 500 ? 0.45 : height <= 650 ? 0.5 : 0.58),
          "panorama remains the main part of the game after submitting an answer",
        )
        await page.getByRole("button", { name: "Увеличить игру", exact: true }).click()
        const enlarged = await page.locator(".geo-scene").boundingBox()
        assert.ok(enlarged && enlarged.height > scene.height + 20)
        await page.getByRole("button", { name: "Свернуть игру", exact: true }).click()
        await expect(page.locator("#geo-game")).not.toHaveClass(/expanded/)
        await expect(page.locator(".geo-mini")).toBeVisible()
        await page.locator(".geo-mini").click()
        await page.getByRole("button", { name: "Закрыть игру", exact: true }).click()
        await expect(page.locator("#geo-game")).toHaveCount(0)
        if (desktopPlayer) {
          await expect(page.locator(".chat-room-sidebar")).toBeVisible()
          await expect(video).toHaveAttribute("data-geo-stable", "true")
          await expect.poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && !e.paused)).toBe(true)
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        assert.deepEqual(errors, [])
        console.log(`PASS geo/player ${theme} ${String(width)}x${String(height)}`)
      } finally {
        await context.close()
      }
    }
  }
} finally {
  await browser.close()
}
