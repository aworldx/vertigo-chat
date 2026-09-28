import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { expect, type Browser, type Page } from "@playwright/test"
import { defaultPreferences } from "../src/features/chat/api/preferences"
import { record } from "../src/features/chat/api/entrance"
import type { Message, Snapshot } from "../src/features/chat/api/protocol"

const invitationID = "1234567890abcdef1234567890abcdef"
const baseMessage: Message = {
  id: 901,
  client_id: "controls-game",
  author: "Лиса",
  recipient: "",
  kind: "tetris",
  body: JSON.stringify({ id: invitationID, code: "ABC123", status: "lobby", players: ["Лиса"] }),
  sent_at: "2026-09-27T12:00:00Z",
  appearance: defaultPreferences.appearance,
  font_id: "theme",
  font_style: "normal",
  reactions: {},
  reacted: [],
}
async function command(page: Page, value: string) {
  await page.locator("#message-body").fill(value)
  await page.locator("#send-message").click()
}
async function capture(page: Page, path: string) {
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await page.screenshot({ path })
}

// All sessions, messages and media are local fixtures; no requests publish into a real room.
export async function verifyChatControls(browser: Browser, origin: string) {
  const audio = Buffer.alloc(44 + 8000 * 2 * 8)
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
  const baseline = process.env.CONTROLS_BASELINE_DIR
  const assets = baseline ?? new URL("../dist", import.meta.url).pathname
  const output = `migration-results/controls/${baseline ? "before" : "after"}`
  await mkdir(output, { recursive: true })
  for (const width of [320, 390, 767, 768, 1440]) {
    for (const theme of ["autumn", "newspaper"] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width === 768 ? 1024 : width < 768 ? 844 : 900 },
        hasTouch: width < 768,
        reducedMotion: "reduce",
        locale: "ru-RU",
        timezoneId: "Europe/Moscow",
      })
      try {
        await context.route("**/assets/*", async (route) => {
          const file = new URL(route.request().url()).pathname.split("/").at(-1)
          assert.ok(file)
          await route.fulfill({ path: join(assets, "assets", file) })
        })
        await context.route("**/youtube-proxy/**", async (route) => {
          await route.fulfill({
            path: new URL("./fixtures/player.webm", import.meta.url).pathname,
            contentType: "video/webm",
          })
        })
        await context.addInitScript(() => {
          sessionStorage.setItem("vertigo.go-chat", JSON.stringify({ nickname: "Проверка", resume_token: "fixture" }))
        })
        const preferences = {
          ...defaultPreferences,
          theme_id: theme,
          appearance: { ...defaultPreferences.appearance, use_player: true },
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
        const sent: string[] = []
        await context.routeWebSocket("**/api/v1/chat/socket", (socket) => {
          socket.onMessage((raw) => {
            const value: unknown = JSON.parse(String(raw))
            if (!record(value)) return
            if (value.type === "resume")
              socket.send(JSON.stringify({ type: "ready", snapshot, connection_id: "fixture", generation: 1 }))
            if (value.type === "send" && typeof value.client_id === "string") {
              socket.send(
                JSON.stringify({
                  type: "ack",
                  message: {
                    ...baseMessage,
                    id: 902,
                    client_id: value.client_id,
                    author: "Проверка",
                    kind: "text",
                    body: "Как включить музыку?",
                  },
                  help_topics: ["music"],
                }),
              )
            }
            if (value.type === "media") sent.push(String(raw))
          })
        })
        let failed = false
        let requests = 0
        await context.route("**/api/v1/chat/media/*", (route) => {
          const url = new URL(route.request().url())
          const kind = url.pathname.split("/").at(-1)
          requests++
          if (failed) return route.fulfill({ status: 503, json: {} })
          const query = url.searchParams.get("q")
          return route.fulfill({
            json: {
              data:
                query === "пусто"
                  ? []
                  : Array.from({ length: kind === "music" ? 6 : 3 }, (_, index) => ({
                      kind,
                      title: `Ночной поезд ${String(index + 1)}`,
                      artist: kind === "music" ? "Чатлане" : "",
                      duration: "3:20",
                      url:
                        kind === "music"
                          ? `https://sunproxy.net/file/test-${String(index)}`
                          : kind === "gif"
                            ? `https://static.klipy.com/test-${String(index)}.gif`
                            : `/youtube-proxy/abcdefghij${String(index)}`,
                      preview: "https://static.klipy.com/test.gif",
                      source: "fixture",
                    })),
            },
          })
        })
        await context.route("**/gif-proxy?*", (route) =>
          route.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#58706b"/><circle cx="60" cy="55" r="30" fill="#d8c39a"/></svg>',
          }),
        )
        await context.route("**/music-proxy?*", (route) => route.fulfill({ contentType: "audio/wav", body: audio }))
        const page = await context.newPage()
        await page.goto(`${origin}/chat`)
        await expect(page.locator("#message-body")).toBeVisible()
        if (!baseline) {
          await page.evaluate(() => document.fonts.ready)
          const controls = await page.locator("#emoji-composer-controls .ui-icon-button").evaluateAll((buttons) =>
            buttons.map((button) => {
              const box = button.getBoundingClientRect()
              return { id: button.id, height: box.height, center: box.y + box.height / 2 }
            }),
          )
          assert.equal(new Set(controls.map((button) => button.height)).size, 1, "composer buttons share one height")
          const row = controls.filter((button) => width >= 768 || button.id !== "send-message")
          assert.equal(new Set(row.map((button) => button.center)).size, 1, "composer buttons align within their row")
        }
        await expect(page.locator(`[data-game-id="${invitationID}"]`)).toBeVisible()
        await capture(page, `${output}/${String(width)}-${theme}-invitation.png`)
        await command(page, "/музыка поезд")
        await expect(page.locator("#media-result-0")).toBeVisible()
        if (!baseline) {
          const row = await page.locator("#media-result-0").boundingBox()
          assert.ok(row && row.height <= (width < 768 ? 56 : 48), "one track occupies one compact row")
          if (width < 768) {
            await page.locator("#media-search-0-play").click()
            const preview = page.locator("#media-search-0-audio")
            await expect
              .poll(() =>
                preview.evaluate(
                  (element) => element instanceof HTMLAudioElement && !element.paused && element.currentTime > 0,
                ),
              )
              .toBe(true)
            const seek = page.locator("#media-result-0 input[type=range]")
            await expect(seek).toBeEnabled()
            const seekBox = await seek.boundingBox()
            const titleBox = await page.locator("#media-result-0 .chat-playback-row-title").boundingBox()
            assert.ok(seekBox && titleBox && seekBox.width >= titleBox.width - 1)
            await seek.fill("3")
            await expect
              .poll(() => preview.evaluate((element: HTMLAudioElement) => element.currentTime))
              .toBeGreaterThanOrEqual(3)
            await page.locator("#media-search-0-play").click()
            await expect
              .poll(() => preview.evaluate((element) => element instanceof HTMLAudioElement && element.paused))
              .toBe(true)
          }
        }
        await capture(page, `${output}/${String(width)}-${theme}-music.png`)
        if (!baseline) {
          const close = await page.locator("#dismiss-media-search").boundingBox()
          const header = await page.locator("#chat-room > header").boundingBox()
          assert.ok(close && header && close.y >= header.y + header.height, "search close stays below navigation")
          const button = await page.locator("#send-media-0").boundingBox()
          assert.ok(button && button.height >= (width < 768 ? 44 : 36), "shared touch and desktop targets")
        }
        if (width >= 768) await page.locator("#media-search-0-enqueue").click()
        else await expect(page.locator("#media-search-0-audio")).toHaveCount(1)
        if (!baseline) {
          await expect(page.locator("#media-search-results")).toContainText("Только ты видишь")
          if (width >= 768) {
            const controlStyles = await page.evaluate(() => {
              const selectors = ["#dismiss-media-search", "#chat-tv-collapse"]
              return selectors.map((selector) => {
                const button = document.querySelector(selector)
                if (!button) throw new Error(`Missing control ${selector}`)
                const style = getComputedStyle(button)
                return [style.borderRadius, style.fontFamily, style.fontSize, style.borderColor, style.color]
              })
            })
            assert.deepEqual(
              controlStyles[0],
              controlStyles[1],
              "search and compact player controls share palette, typography and radius",
            )
          }
          await page.locator("#music-page-2").click()
          await expect(page.locator("#media-result-0")).toContainText("Ночной поезд 6")
          await page.locator("#music-page-1").click()
          assert.equal(sent.length, 0, "queue must stay private")
          await page.locator("#message-body").fill("Мой черновик")
          await page.locator("#dismiss-media-search").focus()
          await page.keyboard.press("Escape")
          await expect(page.locator("#media-search-results")).toHaveCount(0)
          await expect(page.locator("#message-body")).toBeFocused()
          await expect(page.locator("#message-body")).toHaveValue("Мой черновик")
          failed = true
          await command(page, "/музыка поезд")
          await expect(page.locator("#retry-media-search")).toBeVisible()
          const before = requests
          failed = false
          await page.locator("#retry-media-search").click()
          await expect(page.locator("#media-result-0")).toBeVisible()
          assert.equal(requests, before + 1)
          await expect(page.locator("#media-search-results")).toBeFocused()
          await command(page, "/музыка пусто")
          await expect(page.locator("#media-search-results")).toContainText("ничего не найдено")
        }
        await command(page, "/гиф привет")
        await expect(page.locator("#gif-result-0")).toBeVisible()
        await capture(page, `${output}/${String(width)}-${theme}-gif.png`)
        if (!baseline) {
          await expect(page.locator("#gif-result-0 span")).toBeVisible()
          await page.locator("#gif-result-0").click()
          assert.equal(sent.length, 1)
        }
        await command(page, "/ютуб поезд")
        await expect(page.locator("#media-result-0")).toBeVisible()
        await capture(page, `${output}/${String(width)}-${theme}-video.png`)
        if (!baseline) {
          const row = await page.locator("#media-result-0").boundingBox()
          assert.ok(row && row.height <= (width < 768 ? 56 : 48))
          const published = sent.length
          if (width < 768) {
            await expect(page.locator("#media-search-results video")).toHaveCount(0)
            await page.locator("#media-search-0-play").click()
            const video = page.locator("#media-search-results video")
            await expect
              .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
              .toBeGreaterThan(0)
            await capture(page, `${output}/${String(width)}-${theme}-video-preview.png`)
            await page.locator("#media-search-1-play").click()
            await expect(page.locator("#media-search-0-preview")).toHaveCount(0)
            await expect(video).toHaveCount(1)
            await expect
              .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
              .toBeGreaterThan(0)
            await page.locator("#media-search-1-play").click()
            await expect(video).toHaveCount(0)
          } else {
            await page.locator("#media-search-0-enqueue").click()
            await expect(page.locator("#media-search-0-enqueue")).toHaveAttribute("aria-label", "Ещё раз в очередь")
            await expect(page.locator("#media-search-results video")).toHaveCount(0)
          }
          assert.equal(sent.length, published)
        }

        await page.locator("#dismiss-media-search").click()
        await command(page, "/помощь")
        await expect(page.locator('[data-command-result="help"]')).toBeVisible()
        await capture(page, `${output}/${String(width)}-${theme}-commands.png`)
        if (!baseline) {
          await page.locator('[id^="dismiss-command-"]').click()
          await expect(page.locator("#message-body")).toBeFocused()
        }
        await command(page, "/очистить")
        await command(page, "Как включить музыку?")
        await expect(page.locator("#karmik-help-902")).toBeVisible()
        await capture(page, `${output}/${String(width)}-${theme}-hint.png`)
        await page.locator("#karmik-help-902-toggle").click()
        await expect(page.locator("#karmik-help-902-details")).toBeVisible()
        if (!baseline) {
          await page.keyboard.press("Escape")
          await expect(page.locator("#karmik-help-902-details")).toHaveCount(0)
          await expect(page.locator("#karmik-help-902-toggle")).toBeFocused()
          await page.keyboard.press("Escape")
          await expect(page.locator("#karmik-help-902")).toHaveCount(0)
          await expect(page.locator("#message-body")).toBeFocused()
        } else await page.locator("#karmik-help-902-dismiss").click()
        await page.locator("#message-body").fill("Черновик")
        await page.locator("#show-command-menu").click()
        await expect(page.locator("#command-autocomplete-menu")).toBeVisible()
        await capture(page, `${output}/${String(width)}-${theme}-menu.png`)
        await page.keyboard.press("Escape")
        await expect(page.locator("#message-body")).toHaveValue("Черновик")
        if (width >= 768) {
          await page.locator("#chat-tv-toggle").click()
          await expect(page.locator("#chat-tv")).toHaveAttribute("data-mode", "expanded")
          await capture(page, `${output}/${String(width)}-${theme}-player.png`)
          await page.locator("#chat-tv-collapse").click()
          await expect(page.locator("#chat-tv")).toHaveAttribute("data-mode", "compact")
        } else await expect(page.locator("#chat-tv-toggle")).toHaveCount(0)
      } finally {
        await context.close()
      }
    }
  }
}
