import assert from "node:assert/strict"
import { mkdir, readFile } from "node:fs/promises"
import { expect, type Browser, type Route } from "@playwright/test"
import { decodeFrame, type Message, type Snapshot } from "../src/features/chat/api/protocol"
import { defaultPreferences } from "../src/features/chat/api/preferences"
function fixture(id: number, video = false): Message {
  return {
    id,
    client_id: `player-${String(id)}`,
    author: "Лиса",
    recipient: "",
    kind: video ? "youtube" : "music",
    body: video
      ? "Тестовый концерт с очень длинным названием для проверки плавной прокрутки"
      : `Ночной трамвай ${String(id)}`,
    artist: "Чатлане",
    duration: "0:12",
    media_url: video ? "/youtube-proxy/abcdefghijk" : `https://sunproxy.net/file/test-${String(id)}`,
    sent_at: "2026-09-26T16:00:00Z",
    appearance: defaultPreferences.appearance,
    font_id: "theme",
    font_style: "normal",
    reactions: {},
    reacted: [],
  }
}
async function serveMedia(route: Route, bytes: Buffer, contentType: string) {
  const range = /^bytes=(\d+)-(\d*)$/u.exec(route.request().headers().range ?? "")
  if (!range) return route.fulfill({ contentType, body: bytes, headers: { "Accept-Ranges": "bytes" } })
  const start = Number(range[1]),
    end = Math.min(Number(range[2] || bytes.length - 1), bytes.length - 1)
  if (start > end)
    return route.fulfill({ status: 416, headers: { "Content-Range": `bytes */${String(bytes.length)}` } })
  return route.fulfill({
    status: 206,
    contentType,
    body: bytes.subarray(start, end + 1),
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${String(start)}-${String(end)}/${String(bytes.length)}`,
    },
  })
}
export async function verifyPlayer(browser: Browser, origin: string) {
  const bytes = await readFile(new URL("./fixtures/player.webm", import.meta.url))
  await mkdir("migration-results/player", { recursive: true })
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
  for (const width of [320, 390, 767, 768, 1024, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 768 ? 844 : 900 },
      reducedMotion: "reduce",
      hasTouch: width < 768,
    })
    let attempts = 0
    await context.route("**/music-proxy?*", (route) => serveMedia(route, audio, "audio/wav"))
    await context.route("**/youtube-proxy/*", (route) => {
      attempts++
      return attempts === 1 ? route.fulfill({ status: 503, body: "Preparing" }) : serveMedia(route, bytes, "video/webm")
    })
    let messages = [fixture(20001), fixture(20002, true), fixture(20003)]
    let publish: (() => void) | undefined
    await context.routeWebSocket("**/api/v1/chat/socket", (socket) => {
      const server = socket.connectToServer()
      let snapshot: Snapshot | undefined
      server.onMessage((raw) => {
        const frame = typeof raw === "string" ? decodeFrame(raw) : null
        if (frame?.type === "ready" || frame?.type === "snapshot") {
          snapshot =
            width === 768
              ? { ...frame.snapshot, preferences: { ...frame.snapshot.preferences, theme_id: "newspaper" } }
              : frame.snapshot
          socket.send(JSON.stringify({ ...frame, snapshot: { ...snapshot, messages } }))
        } else {
          if (frame?.type === "preferences" && snapshot) snapshot = { ...snapshot, preferences: frame.preferences }
          socket.send(raw)
        }
      })
      publish = () => {
        if (snapshot) socket.send(JSON.stringify({ type: "snapshot", snapshot: { ...snapshot, messages } }))
      }
    })
    const page = await context.newPage()
    try {
      await page.goto(origin)
      await page.locator("#entrance-nickname").fill(`tv-${String(width)}-${String(Date.now())}`)
      await page.locator("#enter-chat").click()
      await expect(page.locator("#message-body")).toBeVisible()
      await expect(page.locator("#chat-tv-toggle")).toHaveCount(0)
      await expect(page.locator("#messages audio")).toHaveCount(2)
      await expect(page.locator("#messages video")).toHaveCount(1)
      if (width < 768) {
        const audio = page.locator("#media-message-20001-audio")
        await audio.evaluate(async (element) => {
          if (element instanceof HTMLAudioElement) await element.play()
        })
        await expect
          .poll(() => audio.evaluate((element) => element instanceof HTMLAudioElement && element.currentTime > 0))
          .toBe(true)
        await audio.evaluate((element) => {
          if (element instanceof HTMLAudioElement) element.pause()
        })
        await page.locator("#youtube-message-play-media-message-20002").click()
        const inlineVideo = page.locator("#youtube-message-player-media-message-20002")
        await expect
          .poll(
            () => inlineVideo.evaluate((element) => element instanceof HTMLVideoElement && element.currentTime > 0),
            { timeout: 10000 },
          )
          .toBe(true)
        await expect(page.locator("#chat-tv")).toHaveCount(0)
        await page.screenshot({ path: `migration-results/player/${String(width)}-inline.png` })
        await page.locator("#leave-chat").click()
        continue
      }
      await page.locator("#toggle-settings").click()
      await expect(page.locator("#use-player")).not.toBeChecked()
      await page.locator("#use-player").check()
      await page.locator("#save-preferences").click()
      await expect(page.locator("#settings-modal")).toHaveCount(0)
      await page.reload()
      await expect(page.locator("#chat-tv-toggle")).toBeVisible()
      const dock = page.locator("#chat-tv"),
        video = page.locator("#chat-tv-media")
      if (width < 768) {
        const menu = await page.locator("#mobile-main-menu > summary").boundingBox()
        assert.ok(menu && menu.x >= 0 && menu.x + menu.width <= width, "mobile navigation must remain inside viewport")
      }
      await expect(page.locator("#message-form #chat-tv-toggle")).toHaveCount(1)
      await expect(page.locator("header #chat-tv-toggle")).toHaveCount(0)
      if (width < 768) {
        const toggle = await page.locator("#chat-tv-toggle").boundingBox()
        const input = await page.locator("#message-body").boundingBox()
        const commands = await page.locator("#show-command-menu").boundingBox()
        assert.ok(toggle && input && commands && toggle.y >= input.y + input.height)
        assert.equal(toggle.y, commands.y, "player button belongs to the bottom controls row")
      }
      await expect(page.locator(".chat-room-content > #chat-tv")).toHaveCount(1)
      await expect(page.locator(".chat-room-sidebar #chat-tv")).toHaveCount(0)
      await expect(dock).toHaveAttribute("data-mode", "off")
      if (width >= 1024) await expect(page.locator("#karmik")).toBeVisible()
      await expect(page.locator("#messages audio, #messages video")).toHaveCount(0)
      await page.locator("#media-message-20001-play").click()
      await expect
        .poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && !e.paused && e.currentTime > 0))
        .toBe(true)
      await page.locator("#media-message-20002-enqueue").click()
      await page.locator("#media-message-20003-enqueue").click()
      await page.locator("#chat-tv-toggle").click()
      await expect(dock).toHaveAttribute("data-mode", "expanded")
      const volumeToggle = page.locator("#chat-tv-volume-toggle")
      const popup = page.locator("#chat-tv-volume-popup")
      await volumeToggle.scrollIntoViewIfNeeded()
      const controlsBefore = await page.locator(".chat-tv-controls").boundingBox()
      await expect(popup).toBeHidden()
      if (width < 768) await volumeToggle.tap()
      else await volumeToggle.hover()
      await expect(popup).toBeVisible()
      assert.deepEqual(await page.locator(".chat-tv-controls").boundingBox(), controlsBefore)
      await page.locator("#chat-tv-volume").focus()
      await page.keyboard.press("ArrowUp")
      await page.keyboard.press("Escape")
      await expect(popup).toBeHidden()
      await expect(dock).toHaveAttribute("data-mode", "expanded")
      await expect(page.locator("#chat-tv-queue summary")).toHaveCount(0)
      await expect(page.locator(".chat-tv-queue li")).toHaveCount(2)
      await page.locator('[id^="tv-queue-up-"]').last().click()
      await expect(page.locator(".chat-tv-queue-title").first()).toContainText("Ночной трамвай 20003")
      await page.locator('[id^="tv-queue-down-"]').first().click()
      await page.locator("#chat-tv-play").click()
      await expect.poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && e.paused)).toBe(true)
      await page.evaluate(() => document.fonts.ready)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      if (width >= 768) {
        const panel = await page.locator("#chat-tv-panel").boundingBox()
        const dialogue = await page.locator("#dialogue-frame").boundingBox()
        const room = await page.locator(".chat-room-content").boundingBox()
        const sidebar = await page.locator(".chat-room-sidebar").boundingBox()
        assert.ok(panel && dialogue && room && sidebar)
        assert.ok(panel.x >= dialogue.x + dialogue.width, "desktop player occupies the chatlan column")
        assert.ok(panel.y >= sidebar.y + sidebar.height - 1, "desktop player sits below the chatlans")
        assert.ok(Math.abs(dialogue.height - room.height) < 1, "desktop player preserves the full dialogue height")
        await expect(page.locator("#karmik")).toBeHidden()
      }
      const heading = await page.locator(".chat-tv-heading").boundingBox()
      const mediaScreen = await page.locator(".chat-player-screen").boundingBox()
      assert.ok(
        heading && mediaScreen && heading.y + heading.height <= mediaScreen.y + 1,
        "toolbar must not overlap video",
      )
      assert.ok(heading.height <= 32, "compact toolbar height")
      const nextButton = await page.locator("#chat-tv-next").boundingBox()
      const queueButton = await page.locator('[id^="tv-queue-remove-"]').first().boundingBox()
      assert.ok(nextButton && nextButton.height === 28)
      assert.ok(queueButton && queueButton.height === 24)
      const scrollingTitle = page.locator(".chat-tv-queue-title .ui-scrolling-text").first()
      await expect(scrollingTitle).toHaveAttribute("data-overflow", "true")
      await page.emulateMedia({ reducedMotion: "no-preference" })
      await expect
        .poll(() => scrollingTitle.locator("span").evaluate((element) => getComputedStyle(element).animationName))
        .toBe("ui-text-scroll")
      await page.emulateMedia({ reducedMotion: "reduce" })
      await expect
        .poll(() => scrollingTitle.locator("span").evaluate((element) => getComputedStyle(element).animationName))
        .toBe("none")
      await page.screenshot({ path: `migration-results/player/${String(width)}-music.png` })
      await page.locator("#chat-tv-play").click()
      await page.locator("#chat-tv-collapse").click()
      await expect(dock).toHaveAttribute("data-mode", "compact")
      await video.evaluate((e) => {
        e.setAttribute("data-preserved-node", "true")
      })
      const before = await video.evaluate((e) => (e instanceof HTMLMediaElement ? e.currentTime : -1))
      assert.ok(publish)
      messages = []
      publish()
      await expect(page.locator("#messages [data-message-kind=music]")).toHaveCount(0)
      await expect
        .poll(() => video.evaluate((e, position) => e instanceof HTMLMediaElement && e.currentTime > position, before))
        .toBe(true)
      await expect(video).toHaveAttribute("data-preserved-node", "true")
      await page.locator("#chat-tv-mini-next").click()
      await expect
        .poll(() => video.evaluate((e) => e instanceof HTMLVideoElement && e.videoWidth > 0 && e.currentTime > 0), {
          timeout: 10000,
        })
        .toBe(true)
      assert.ok(attempts >= 2)
      await expect(page.locator("#chat-tv-expand")).toContainText("Видео · только звук")
      await page.locator("#chat-tv-expand").click()
      await expect(video).toBeVisible()
      const screenRatio = await page.locator(".chat-player-screen").evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width / rect.height
      })
      const sourceRatio = await video.evaluate((element) =>
        element instanceof HTMLVideoElement ? element.videoWidth / element.videoHeight : 0,
      )
      assert.ok(Math.abs(screenRatio - sourceRatio) < 0.02, "video area follows the source aspect ratio")
      if (width < 768) {
        // Opening a tall panel must never put its controls behind the chat header.
        for (const height of [568, 844]) {
          await page.setViewportSize({ width, height })
          const room = await page.locator(".chat-room-content").boundingBox()
          const panel = await page.locator("#chat-tv-panel").boundingBox()
          const collapse = await page.locator("#chat-tv-collapse").boundingBox()
          assert.ok(room && panel && collapse)
          assert.ok(panel.height <= room.height * 0.55 + 1, "mobile player leaves at least 45% of the dialogue visible")
          assert.ok(collapse.y >= room.y && collapse.y + collapse.height <= room.y + room.height)
          await page.locator("#chat-tv-collapse").click({ trial: true })
        }
      }
      await page.locator("#chat-tv-play").click()
      await page.screenshot({ path: `migration-results/player/${String(width)}-video.png` })
      await page.locator("#chat-tv-origin").click()
      await expect(page.locator("#chat-tv-status")).toContainText("уже нет")
      if (width < 768) {
        await page.locator("#message-body").focus()
        await expect(dock).toHaveAttribute("data-mode", "compact")
        await page.locator("#chat-tv-expand").click()
      }
      await page.locator("#chat-tv-off").click()
      await expect(dock).toHaveAttribute("data-mode", "off")
      if (width >= 1024) await expect(page.locator("#karmik")).toBeVisible()
      await expect.poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && e.paused)).toBe(true)
      await page.locator("#chat-tv-toggle").click()
      await expect(page.locator(".chat-tv-queue li")).toHaveCount(1)
      await expect.poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && e.paused)).toBe(true)
      await video.evaluate((e) => {
        if (!(e instanceof HTMLMediaElement)) return
        const events: string[] = []
        for (const type of ["play", "playing", "pause", "ended", "seeking", "seeked", "error"])
          e.addEventListener(type, () => {
            events.push(`${type}:${String(e.currentTime)}:${String(e.paused)}`)
            e.dataset.events = events.join("|")
          })
      })
      await page.locator("#chat-tv-play").click()
      await expect.poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && !e.paused)).toBe(true)
      await video.evaluate((e) => {
        if (e instanceof HTMLMediaElement) e.currentTime = e.duration - 0.1
      })
      try {
        await expect(page.locator(".chat-tv-title")).toContainText("Ночной трамвай 20003")
      } catch (error) {
        console.error(
          await video.evaluate((e) =>
            e instanceof HTMLMediaElement
              ? {
                  time: e.currentTime,
                  duration: e.duration,
                  paused: e.paused,
                  ended: e.ended,
                  events: e.dataset.events,
                  error: e.error?.message,
                }
              : null,
          ),
        )
        throw error
      }

      await expect.poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && e.currentTime > 0)).toBe(true)
      await video.evaluate((e) => {
        if (e instanceof HTMLMediaElement) e.currentTime = e.duration - 0.1
      })
      await expect.poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && e.ended)).toBe(true)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      assert.equal(overflow, false)
      await page.locator("#chat-tv-collapse").click()
      await page.screenshot({ path: `migration-results/player/${String(width)}-compact.png` })
      await context.route("**/api/v1/chat/media/music?*", (route) =>
        route.fulfill({
          json: {
            data: [
              {
                kind: "music",
                url: "https://sunproxy.net/file/search",
                title: "Из поиска",
                artist: "Чатлане",
                duration: "1:00",
                source: "fixture",
                preview: "",
              },
            ],
          },
        }),
      )
      await page.locator("#message-body").fill("/музыка тест")
      await page.locator("#send-message").click()
      await page.locator("#media-search-0-play").click()
      await expect.poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && !e.paused)).toBe(true)
      await page.locator("#media-search-0-enqueue").click()
      if (width >= 768) {
        for (let index = 0; index < 7; index++) await page.locator("#media-search-0-enqueue").click()
        await page.locator("#chat-tv-toggle").click()
        const queue = page.locator("#chat-tv-panel")
        await expect(queue).toBeVisible()
        assert.equal(await queue.evaluate((element) => element.scrollHeight > element.clientHeight), true)
        const panel = await page.locator("#chat-tv-panel").boundingBox()
        assert.ok(panel && panel.height <= 521, "long queues stay bounded within the chatlan column")
        for (const height of [480, 640, 900]) {
          await page.setViewportSize({ width, height })
          await queue.evaluate((element) => {
            element.scrollTop = element.scrollHeight
          })
          const last = await page.locator(".chat-tv-queue li").last().boundingBox()
          const viewport = await queue.boundingBox()
          assert.ok(
            last && viewport && last.y >= viewport.y && last.y + last.height <= viewport.y + viewport.height + 1,
            "the final queue item is fully reachable without scrolling another container",
          )
        }
        await page.locator('[id^="tv-queue-remove-"]').last().click()
        await expect(page.locator(".chat-tv-queue li")).toHaveCount(7)
        await page.locator("#chat-tv-collapse").click()
      }
      await page.getByRole("button", { name: "Закрыть поиск музыки" }).click()
      await expect(page.locator("#chat-tv-expand")).toContainText("Из поиска")
      await expect.poll(() => video.evaluate((e) => e instanceof HTMLMediaElement && e.currentTime > 0)).toBe(true)
      await page.setViewportSize({ width: 390, height: 844 })
      await expect(page.locator("#chat-tv")).toHaveCount(0)
      await page.setViewportSize({ width, height: 900 })
      await expect(page.locator("#chat-tv")).toHaveAttribute("data-mode", "off")
      await page.locator("#toggle-settings").click()
      await expect(page.locator("#use-player")).toBeChecked()
      await page.locator("#use-player").uncheck()
      await page.locator("#save-preferences").click()
      await expect(page.locator("#chat-tv")).toHaveCount(0)
      await page.locator("#leave-chat").click()
    } finally {
      await context.close()
    }
  }
  console.log(
    "Player passed: inline mobile media, default-off preference, persisted opt-in, sidebar queue, Karmik restoration, mode changes and screenshots",
  )
}
