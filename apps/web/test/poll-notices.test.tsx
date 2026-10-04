import assert from "node:assert/strict"
import { test } from "node:test"
import { renderHook } from "@testing-library/react"
import { JSDOM } from "jsdom"
import { defaultPreferences } from "../src/features/chat/api/preferences"
import { positionPollNotices, usePollNoticePositions } from "../src/features/chat/model/pollNoticeTimeline"
import { mergeMediaTimeline } from "../src/features/chat/model/mediaTimeline"
import { publishTimeline } from "../src/features/chat/model/timeline"
import { readDismissedNotices, saveDismissedNotices } from "../src/features/polls/model/dismissedNotices"

const message = (id: number, client_id = "") => ({
  id,
  client_id,
  author: "guest",
  recipient: "",
  body: "message",
  kind: "text",
  reactions: {},
  reacted: [],
  sent_at: "2026-10-04T12:00:00Z",
  font_id: "theme" as const,
  font_style: "normal" as const,
  appearance: defaultPreferences.appearance,
})
test("poll invite keeps its original place across polling, new messages and deleted anchors", () => {
  const initial = publishTimeline([], [message(1), message(2)])
  const polls = [{ id: 7, question: "Question" }]
  const notice = positionPollNotices(polls, [], initial)
  const later = publishTimeline(initial, [message(1), message(2), message(3)])
  const refreshed = positionPollNotices([...polls], notice, later)
  assert.deepEqual(
    mergeMediaTimeline(later, [], refreshed).map((item) => item.kind),
    ["message", "message", "notice", "message"],
  )
  const deleted = publishTimeline(later, [message(1), message(3)], [2])
  assert.deepEqual(
    mergeMediaTimeline(deleted, [], refreshed).map((item) => item.kind),
    ["message", "notice", "message"],
  )
  const rolled = publishTimeline(deleted, [message(3)], [1])
  assert.equal(mergeMediaTimeline(rolled, [], refreshed)[0]?.kind, "notice")
})
test("dismissal survives reload only for the current tab and nickname", () => {
  const dom = new JSDOM("", { url: "https://example.test" })
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: dom.window.sessionStorage })
  try {
    saveDismissedNotices("guest-a", [7])
    assert.deepEqual(readDismissedNotices("guest-a"), [7])
    assert.deepEqual(readDismissedNotices("guest-b"), [])
    dom.window.sessionStorage.setItem("vertigo.poll-notices.dismissed:guest-a", '["7",-1,null,8]')
    assert.deepEqual(readDismissedNotices("guest-a"), [8])
  } finally {
    Reflect.deleteProperty(globalThis, "sessionStorage")
    dom.window.close()
  }
})

test("an invitation arriving before the socket waits for the initial history before anchoring", () => {
  const dom = new JSDOM("", { url: "https://example.test" })
  const keys = ["window", "document"] as const
  const previous = keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
  for (const key of keys)
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: key === "window" ? dom.window : dom.window.document,
    })
  try {
    const polls = [{ id: 7, question: "Question" }]
    const entries = publishTimeline([], [message(1), message(2)])
    const hook = renderHook(({ ready }) => usePollNoticePositions(polls, ready ? entries : [], "guest", ready), {
      initialProps: { ready: false },
    })
    assert.equal(hook.result.current.length, 0)
    hook.rerender({ ready: true })
    assert.deepEqual(
      hook.result.current[0]?.after,
      entries.map((entry) => entry.key),
    )
    hook.unmount()
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
    dom.window.close()
  }
})
