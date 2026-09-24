import assert from "node:assert/strict"
import { test } from "node:test"
import { defaultPreferences } from "../src/features/chat/api/preferences"
import type { Message } from "../src/features/chat/api/protocol"
import {
  addTimelineEntry,
  feedTimeline,
  publishTimeline,
  setTimelineDelivery,
  timelineKey,
  timelineMessages,
  type TimelineEntry,
} from "../src/features/chat/model/timeline"

const message = (id: number, author: string, client_id = "same-id"): Message => ({
  id,
  author,
  client_id,
  body: `${author}: ${String(id)}`,
  recipient: "",
  reactions: {},
  reacted: [],
  kind: "text",
  sent_at: `2026-09-24T10:00:${String(Math.max(0, id)).padStart(2, "0")}Z`,
  font_id: "theme",
  font_style: "normal",
  appearance: defaultPreferences.appearance,
})
function entry(value: Message, delivery: TimelineEntry["delivery"]): TimelineEntry {
  return { message: value, key: timelineKey(value), delivery }
}
test("published messages retain server identity even when authors reuse client IDs", () => {
  const alice = message(1, "alice"),
    bob = message(2, "bob")
  const entries = publishTimeline([], [alice, bob])
  assert.deepEqual(timelineMessages(entries), [alice, bob])
  assert.equal(new Set(entries.map((item) => item.key)).size, 2)
  assert.deepEqual(
    publishTimeline(entries, [bob]).map((item) => item.message.author),
    ["bob"],
  )
})
test("an acknowledgement replaces only its own pending entry", () => {
  const pending = entry(message(0, "alice"), "sending")
  const other = entry(message(0, "bob"), "retrying")
  const acknowledged = entry(message(1, "alice"), "confirmed")
  const entries = addTimelineEntry([pending, other], acknowledged)
  assert.equal(entries.length, 2)
  assert.ok(entries.some((item) => item === other))
  assert.ok(!entries.includes(pending))
  assert.deepEqual(timelineMessages(entries), [acknowledged.message])
})
test("history reconciliation replaces pending and confirmed entries without duplicates", () => {
  const pending = entry(message(0, "alice"), "retrying")
  const acknowledged = entry(message(2, "alice"), "confirmed")
  const entries = publishTimeline([pending, acknowledged], [message(1, "bob"), acknowledged.message])
  assert.deepEqual(
    entries.map((item) => item.message.id),
    [1, 2],
  )
  assert.ok(entries.every((item) => item.delivery === "published"))
  assert.equal(publishTimeline([], [acknowledged.message, acknowledged.message]).length, 1)
})
test("a pending delivery update cannot alter a persisted message with a matching client ID", () => {
  const pending = entry(message(0, "alice"), "sending"),
    published = entry(message(1, "bob"), "published")
  const entries = setTimelineDelivery([pending, published], "same-id", "failed")
  assert.equal(entries[0]?.delivery, "failed")
  assert.equal(entries[1], published)
  assert.deepEqual(setTimelineDelivery(entries, "unknown", "failed"), entries)
})
test("private messages use distinct server IDs and are ordered with the public feed", () => {
  const publicMessage = entry(message(2, "alice"), "published")
  const first = { ...message(1, "bob"), id: -1 },
    second = { ...message(3, "carol"), id: -2 }
  const entries = feedTimeline([publicMessage], [first, second, first])
  assert.deepEqual(
    entries.map((item) => item.message.id),
    [-1, 2, -2],
  )
})
