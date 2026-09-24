import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { JSDOM } from "jsdom"
import { searchMedia, type MediaItem } from "../src/features/chat/api/media"
import { saveSession } from "../src/features/chat/model/storage"
const dom = new JSDOM("<html><body></body></html>", { url: "https://chat.example" })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  sessionStorage: dom.window.sessionStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const { renderHook, act, cleanup, waitFor } = await import("@testing-library/react")
const { useMediaSearch } = await import("../src/features/chat/model/useMediaSearch")
const { useVideoPlayback } = await import("../src/features/chat/model/useVideoPlayback")
const originalFetch = globalThis.fetch
afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  sessionStorage.clear()
})
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const item = (title = "Song"): MediaItem => ({
  kind: "music",
  title,
  url: "https://sunproxy.net/file/song.mp3",
  preview: "",
  artist: "Artist",
  duration: "3:00",
  source: "search",
})
test("media search sends session fencing and filters unsafe or malformed results", async () => {
  saveSession({ nickname: "Alice", resume_token: "token" })
  const controller = new AbortController()
  globalThis.fetch = (url, init) => {
    assert.equal(url, "/api/v1/chat/media/music?q=rock%20%26%20roll")
    assert.equal(new Headers(init?.headers).get("X-Chat-Session"), "token")
    assert.equal(new Headers(init?.headers).get("X-Chat-Generation"), "7")
    assert.equal(init?.signal, controller.signal)
    return Promise.resolve(
      response({
        data: [
          item(),
          null,
          { ...item(), kind: "gif" },
          { ...item(), title: 3 },
          { ...item(), url: "https://sunproxy.net.evil.example/file/a" },
          { ...item(), url: "https://user:password@sunproxy.net/file/a" },
        ],
      }),
    )
  }
  assert.deepEqual(await searchMedia("music", "rock & roll", 7, controller.signal), [item()])
})
test("media search rejects failed and malformed responses without a session", async () => {
  for (const [body, status, message] of [
    [{}, 503, /недоступен/u],
    [{ data: {} }, 200, /Некорректный/u],
    [null, 200, /Некорректный/u],
  ] as const) {
    globalThis.fetch = (_url, init) => {
      assert.equal(new Headers(init?.headers).get("X-Chat-Session"), "")
      return Promise.resolve(response(body, status))
    }
    await assert.rejects(searchMedia("gif", "cats", 1, new AbortController().signal), message)
  }
})
test("a newer search aborts the old one and ignores its late response; close and unmount cancel work", async () => {
  const requests: { signal: AbortSignal; resolve: (value: Response) => void }[] = []
  globalThis.fetch = (_url, init) => {
    const signal = init?.signal
    assert.ok(signal instanceof AbortSignal)
    return new Promise((resolve) => {
      requests.push({ signal, resolve })
    })
  }
  const request = (index: number) => {
    const value = requests[index]
    assert.ok(value)
    return value
  }
  const { result, unmount } = renderHook(() => useMediaSearch(1, () => {}))
  act(() => {
    result.current.search("music", "old")
    result.current.search("music", "new")
  })
  assert.equal(request(0).signal.aborted, true)
  await act(async () => {
    request(0).resolve(response({ data: [item("old")] }))
    await Promise.resolve()
  })
  assert.equal(result.current.result?.query, "new")
  assert.equal(result.current.result.loading, true)
  await act(async () => {
    request(1).resolve(response({ data: [item("new")] }))
    await Promise.resolve()
  })
  await waitFor(() => {
    assert.equal(result.current.result?.items[0]?.title, "new")
  })
  act(() => {
    result.current.page(2)
  })
  assert.equal(result.current.result.page, 2)
  act(() => {
    result.current.close()
  })
  assert.equal(result.current.result, null)
  assert.equal(request(1).signal.aborted, true)
  act(() => {
    result.current.page(3)
    result.current.search("music", "last")
  })
  unmount()
  assert.equal(request(2).signal.aborted, true)
})
test("a direct YouTube result publishes once; server errors stay visible and retryable", async () => {
  const query = "https://youtu.be/abcdefghijk"
  const video: MediaItem = { ...item(), kind: "youtube", url: "/youtube-proxy/abcdefghijk", source: query }
  const published: MediaItem[] = []
  globalThis.fetch = () => Promise.resolve(response({ data: [video] }))
  const { result } = renderHook(() =>
    useMediaSearch(2, (value) => {
      published.push(value)
    }),
  )
  await act(async () => {
    result.current.search("youtube", query)
    await Promise.resolve()
  })
  await waitFor(() => {
    assert.deepEqual(published, [video])
  })
  assert.equal(result.current.result, null)
  globalThis.fetch = () => Promise.resolve(response({}, 503))
  await act(async () => {
    result.current.search("music", "failed")
    await Promise.resolve()
  })
  await waitFor(() => {
    assert.match(result.current.result?.error ?? "", /недоступен/u)
  })
  globalThis.fetch = () => Promise.reject(new Error("offline"))
  await act(async () => {
    result.current.search("music", "retry")
    await Promise.resolve()
  })
  await waitFor(() => {
    assert.equal(result.current.result?.error, "offline")
  })
})
test("video preparation retries are bounded and a successful playback cancels the retry", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const video = document.createElement("video")
  const load = t.mock.method(video, "load", () => {})
  t.mock.method(video, "play", () => Promise.reject(new Error("not ready")))
  const { result, unmount } = renderHook(() => useVideoPlayback("/youtube-proxy/abcdefghijk"))
  result.current.videoRef.current = video
  act(() => {
    result.current.retry()
    result.current.start()
    result.current.start()
  })
  assert.equal(load.mock.callCount(), 1)
  assert.equal(result.current.state, "preparing")
  for (let attempt = 0; attempt < 120; attempt++)
    act(() => {
      result.current.retry()
      t.mock.timers.tick(1000)
    })
  act(() => {
    result.current.retry()
  })
  assert.equal(result.current.state, "failed")
  assert.equal(load.mock.callCount(), 121)
  act(() => {
    result.current.start()
    result.current.retry()
    result.current.playing()
    t.mock.timers.tick(1000)
  })
  assert.equal(result.current.state, "playing")
  assert.equal(load.mock.callCount(), 122)
  act(() => {
    result.current.start()
    result.current.retry()
  })
  unmount()
  t.mock.timers.tick(1000)
  assert.equal(load.mock.callCount(), 123)
})
