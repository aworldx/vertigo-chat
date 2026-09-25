import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { JSDOM } from "jsdom"
import { mergeMediaTimeline, updateSharedFile } from "../src/features/chat/model/mediaTimeline"
import type { SharedFile } from "../src/features/chat/model/mediaTransfer"
import { timelineKey, type TimelineEntry } from "../src/features/chat/model/timeline"
import { defaultPreferences } from "../src/features/chat/api/preferences"

const dom = new JSDOM("<html><body></body></html>", { url: "https://chat.example/chat" })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  MutationObserver: dom.window.MutationObserver,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const React = (await import("react")).default
const { render, fireEvent, screen, cleanup } = await import("@testing-library/react")
const { SharedMedia } = await import("../src/features/chat/ui/SharedMedia")
afterEach(cleanup)
const file: SharedFile = {
  id: "image-1",
  author: "alice",
  name: "screen.png",
  type: "image/png",
  size: 100,
  url: "blob:local-preview",
  error: "",
  progress: 100,
  status: "ready",
}
function entry(id: number, client = ""): TimelineEntry {
  const message = {
    id,
    client_id: client,
    author: "alice",
    body: "message",
    kind: "text",
    recipient: "",
    reactions: {},
    reacted: [],
    sent_at: "2026-09-25T10:00:00Z",
    appearance: defaultPreferences.appearance,
    font_id: "theme" as const,
    font_style: "normal" as const,
  }
  return { key: timelineKey(message), message, delivery: id ? "published" : "sending" }
}
test("own ready image stays hidden until explicitly opened and stays open during updates", () => {
  let requests = 0
  const onRequest = () => {
    requests++
  }
  const view = render(<SharedMedia file={file} onRequest={onRequest} />)
  assert.equal(screen.queryByRole("img"), null)
  fireEvent.click(screen.getByRole("button", { name: "Показать изображение" }))
  assert.equal(screen.getByRole("img").getAttribute("src"), file.url)
  assert.equal(requests, 0)
  view.rerender(<SharedMedia file={{ ...file, author: "Alice" }} onRequest={onRequest} />)
  assert.ok(screen.getByRole("img"))
})
test("recipient requests hidden image on click and opens it when the transfer finishes", () => {
  let requests = 0
  const onRequest = () => {
    requests++
  }
  const view = render(<SharedMedia file={{ ...file, status: "waiting", url: "" }} onRequest={onRequest} />)
  assert.equal(screen.queryByRole("img"), null)
  fireEvent.click(screen.getByRole("button", { name: "Показать изображение" }))
  assert.equal(requests, 1)
  view.rerender(<SharedMedia file={{ ...file, status: "loading", url: "", progress: 50 }} onRequest={onRequest} />)
  assert.equal(screen.getByRole("button").hasAttribute("disabled"), true)
  view.rerender(<SharedMedia file={file} onRequest={onRequest} />)
  assert.ok(screen.getByRole("img"))
})
test("attachments retain their place across new messages, transfer updates and pending acknowledgements", () => {
  const first = entry(1),
    pending = entry(0, "outbox"),
    next = entry(3)
  let files = updateSharedFile([], file, [first, pending])
  files = updateSharedFile(files, { ...file, id: "second" }, [first, pending, next])
  files = updateSharedFile(files, { ...file, progress: 50 }, [first, entry(2, "outbox"), next])
  const merged = mergeMediaTimeline([first, entry(2, "outbox"), next, entry(4)], files)
  assert.deepEqual(
    merged.map((item) => item.key),
    ["message:1", "message:2", "file:image-1", "message:3", "file:second", "message:4"],
  )
  assert.deepEqual(
    mergeMediaTimeline([first, next], files).map((item) => item.key),
    ["message:1", "file:image-1", "message:3", "file:second"],
  )
  assert.deepEqual(
    mergeMediaTimeline([entry(4)], files).map((item) => item.key),
    ["file:image-1", "file:second", "message:4"],
  )
})
