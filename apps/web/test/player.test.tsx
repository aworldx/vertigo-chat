import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { JSDOM } from "jsdom"
import { initialPlayer, playerReducer, type Track } from "../src/features/chat/model/player/queue"
import { mediaTrack } from "../src/features/chat/model/player/tracks"
const dom = new JSDOM("<html><body></body></html>", { url: "https://chat.example/chat" })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  DOMException: dom.window.DOMException,
  HTMLElement: dom.window.HTMLElement,
  requestAnimationFrame: (fn: FrameRequestCallback) =>
    setTimeout(() => {
      fn(0)
    }, 0),
  cancelAnimationFrame: clearTimeout,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const React = (await import("react")).default
const { render, renderHook, act, cleanup, fireEvent } = await import("@testing-library/react")
const { usePlayback } = await import("../src/features/chat/model/player/usePlayback")
const { PlayerProvider } = await import("../src/features/chat/ui/player/PlayerProvider")
const { PlayerDock } = await import("../src/features/chat/ui/player/PlayerDock")
const { MediaActions } = await import("../src/features/chat/ui/player/MediaActions")
const { PlayerToggle } = await import("../src/features/chat/ui/player/PlayerToggle")
afterEach(cleanup)
const track: Track = { kind: "music", title: "Песня", source: "/music-proxy?url=test", author: "Лиса" }
test("queue is explicit, ordered and survives power-off; removing history is independent", () => {
  let state = playerReducer(initialPlayer, { type: "enqueue", track })
  assert.equal(state.current, null)
  assert.equal(state.requested, false)
  state = playerReducer(state, { type: "enqueue", track: { ...track, title: "Видео", kind: "video" } })
  state = playerReducer(state, { type: "move", key: 2, direction: -1 })
  assert.deepEqual(
    state.queue.map((entry) => entry.title),
    ["Видео", "Песня"],
  )
  assert.equal(playerReducer(state, { type: "move", key: 2, direction: -1 }), state)
  state = playerReducer(state, { type: "request", value: true })
  assert.equal(state.current?.title, "Видео")
  assert.equal(state.requested, true)
  state = playerReducer(state, { type: "mode", mode: "off" })
  assert.equal(state.requested, false)
  assert.equal(state.queue.length, 1)
  state = playerReducer(state, { type: "mode", mode: "expanded" })
  assert.equal(state.requested, false)
  state = playerReducer(state, { type: "play", track: { ...track, title: "Сейчас" } })
  assert.equal(state.queue.length, 1)
  state = playerReducer(state, { type: "select", key: 1 })
  assert.equal(state.current?.title, "Песня")
  state = playerReducer(state, { type: "next" })
  assert.equal(state.requested, false)
  assert.equal(playerReducer(state, { type: "select", key: 999 }), state)
  assert.equal(playerReducer(state, { type: "remove", key: 999 }).queue.length, 0)
})
test("sources use the existing allowlist and never turn GIFs into player entries", () => {
  const item = {
    kind: "music" as const,
    url: "https://sunproxy.net/file/music",
    title: "Песня",
    artist: "Кино",
    duration: "3:00",
    source: "",
    preview: "",
  }
  assert.equal(mediaTrack(item)?.title, "Кино — Песня")
  assert.equal(mediaTrack({ ...item, url: "https://evil.example/" }), null)
  assert.equal(mediaTrack({ ...item, kind: "gif" }), null)
  assert.equal(mediaTrack({ ...item, kind: "youtube", url: "/youtube-proxy/abcdefghijk" })?.prepare, true)
})
test("playback handles seek, volume, queue advance, pause and cleanup without reloading on pause", async (t) => {
  const element = document.createElement("video")
  const load = t.mock.method(element, "load", () => {})
  const pause = t.mock.method(element, "pause", () => {})
  t.mock.method(element, "play", () => {
    element.dispatchEvent(new dom.window.Event("playing"))
    return Promise.resolve()
  })
  Object.defineProperty(element, "duration", { value: 90, configurable: true })
  let ended = 0
  const onEnded = () => {
    ended++
  }
  const entry = { ...track, key: 1 }
  const view = renderHook(({ current, requested }) => usePlayback(current, requested, onEnded), {
    initialProps: { current: null as typeof entry | null, requested: false },
  })
  view.result.current.ref.current = element
  await act(async () => {
    view.rerender({ current: entry, requested: true })
  })
  assert.equal(view.result.current.status, "playing")
  act(() => {
    element.dispatchEvent(new dom.window.Event("durationchange"))
    view.result.current.seek(42)
    view.result.current.changeVolume(0.2)
  })
  assert.equal(element.volume, 0.2)
  assert.equal(view.result.current.time.position, 42)
  assert.equal(view.result.current.time.duration, 90)
  act(() => {
    element.dispatchEvent(new dom.window.Event("ended"))
  })
  assert.equal(ended, 1)
  act(() => {
    view.rerender({ current: entry, requested: false })
  })
  assert.equal(view.result.current.status, "paused")
  act(() => {
    element.dispatchEvent(new dom.window.Event("ended"))
    element.dispatchEvent(new dom.window.Event("playing"))
  })
  assert.equal(ended, 1, "late ended event after stopping must not start the queue")
  assert.equal(load.mock.callCount(), 1)
  view.unmount()
  assert.ok(pause.mock.callCount() > 0)
})
test("YouTube retry is bounded and cancelled by switching tracks and powering off", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const element = document.createElement("video")
  const load = t.mock.method(element, "load", () => {})
  t.mock.method(element, "pause", () => {})
  t.mock.method(element, "play", () => Promise.resolve())
  const end = () => {}
  const video = { ...track, key: 1, source: "/youtube-proxy/abcdefghijk", kind: "video" as const, prepare: true }
  const view = renderHook(({ current, requested }) => usePlayback(current, requested, end), {
    initialProps: { current: null as typeof video | null, requested: false },
  })
  view.result.current.ref.current = element
  await act(async () => {
    view.rerender({ current: video, requested: true })
  })
  for (let n = 0; n <= 120; n++)
    act(() => {
      element.dispatchEvent(new dom.window.Event("error"))
      t.mock.timers.tick(1000)
    })
  assert.equal(view.result.current.status, "error")
  assert.equal(load.mock.callCount(), 121)
  Object.defineProperty(element, "error", { value: { code: 2, message: "Network" }, configurable: true })
  load.mock.mockImplementation(() => {
    Object.defineProperty(element, "error", { value: null, configurable: true })
    element.dispatchEvent(new dom.window.Event("loadstart"))
  })
  await act(async () => {
    view.result.current.resume()
  })
  assert.equal(view.result.current.status, "loading")
  act(() => {
    element.dispatchEvent(new dom.window.Event("error"))
    t.mock.timers.tick(1000)
  })
  assert.equal(load.mock.callCount(), 123, "manual retry starts a fresh bounded preparation cycle")
  act(() => {
    view.rerender({ current: { ...video, key: 2 }, requested: true })
    element.dispatchEvent(new dom.window.Event("error"))
  })
  act(() => {
    view.rerender({ current: { ...video, key: 3 }, requested: false })
    t.mock.timers.tick(1000)
  })
  const count = load.mock.callCount()
  view.unmount()
  t.mock.timers.tick(2000)
  assert.equal(load.mock.callCount(), count)
})
test("autoplay rejection is visible and a user gesture can resume", async (t) => {
  const element = document.createElement("video")
  t.mock.method(element, "load", () => {})
  t.mock.method(element, "pause", () => {})
  const play = t.mock.method(element, "play", () =>
    Promise.reject(new dom.window.DOMException("Blocked", "NotAllowedError")),
  )
  const end = () => {}
  const entry = { ...track, key: 1 }
  const view = renderHook(({ current }) => usePlayback(current, true, end), {
    initialProps: { current: null as typeof entry | null },
  })
  view.result.current.ref.current = element
  await act(async () => {
    view.rerender({ current: entry })
  })
  assert.equal(view.result.current.status, "blocked")
  play.mock.mockImplementation(() => {
    element.dispatchEvent(new dom.window.Event("playing"))
    return Promise.resolve()
  })
  await act(async () => {
    view.result.current.resume()
  })
  assert.equal(view.result.current.status, "playing")
})
test("one media node survives collapse, power-off, reopening and message removal", async (t) => {
  t.mock.method(dom.window.HTMLMediaElement.prototype, "load", () => {})
  t.mock.method(dom.window.HTMLMediaElement.prototype, "pause", () => {})
  t.mock.method(dom.window.HTMLMediaElement.prototype, "play", () => Promise.resolve())
  const children = (show: boolean) => (
    <PlayerProvider>
      <PlayerToggle />
      <PlayerDock />
      {show && <MediaActions track={track} id="fixture" />}
    </PlayerProvider>
  )
  const view = render(children(true))
  const media = document.getElementById("chat-tv-media")
  const click = (id: string) => {
    const element = document.getElementById(id)
    assert.ok(element)
    fireEvent.click(element)
  }
  await act(async () => {
    click("fixture-play")
    click("fixture-enqueue")
  })
  assert.equal(document.getElementById("chat-tv")?.dataset.mode, "compact")
  act(() => {
    click("chat-tv-toggle")
  })
  assert.equal(document.getElementById("chat-tv")?.dataset.mode, "expanded")
  act(() => {
    click("chat-tv-collapse")
    click("chat-tv-mini-off")
    view.rerender(children(false))
  })
  assert.equal(document.getElementById("chat-tv")?.dataset.mode, "off")
  assert.equal(document.getElementById("chat-tv-media"), media)
  act(() => {
    click("chat-tv-toggle")
  })
  assert.equal(view.container.querySelectorAll(".chat-tv-queue li").length, 1)
})

test("disabled player restores inline audio and video and hides the shared controls", async (t) => {
  t.mock.method(dom.window.HTMLMediaElement.prototype, "load", () => {})
  t.mock.method(dom.window.HTMLMediaElement.prototype, "pause", () => {})
  const content = (enabled: boolean) => (
    <PlayerProvider enabled={enabled}>
      <PlayerToggle />
      <PlayerDock />
      <MediaActions id="inline-audio" track={track} />
      <MediaActions
        id="inline-video"
        track={{ ...track, kind: "video", source: "/youtube-proxy/abcdefghijk", prepare: true }}
      />
    </PlayerProvider>
  )
  const view = render(content(false))
  assert.equal(view.container.querySelectorAll("audio").length, 1)
  assert.equal(view.container.querySelectorAll("video").length, 1)
  assert.equal(view.container.querySelector("#chat-tv"), null)
  assert.equal(view.container.querySelector("#chat-tv-toggle"), null)
  view.rerender(content(true))
  assert.equal(view.container.querySelectorAll("audio").length, 0)
  assert.ok(view.container.querySelector("#chat-tv"))
  view.rerender(content(false))
  assert.equal(view.container.querySelectorAll("audio").length, 1)
  assert.equal(view.container.querySelector("#chat-tv"), null)
})
