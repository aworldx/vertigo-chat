import type { Message } from "../api/protocol"
import type { DeliveryState } from "./delivery"

export type TimelineEntry = {
  delivery: DeliveryState
  key: string
  message: Message
}

function keyFor(message: Message) {
  return message.client_id ? `client:${message.client_id}` : `message:${String(message.id)}`
}

export function addTimelineEntry(entries: TimelineEntry[], entry: TimelineEntry) {
  return [...entries.filter((current) => current.key !== entry.key), entry].sort(
    (left, right) => Date.parse(left.message.sent_at) - Date.parse(right.message.sent_at),
  )
}

export function publishTimeline(entries: TimelineEntry[], messages: Message[]) {
  const published = new Set(messages.map(keyFor))
  let next = entries.filter((entry) => entry.delivery !== "published" || published.has(entry.key))
  for (const message of messages) {
    const key = keyFor(message)
    next = addTimelineEntry(next, { key, message, delivery: "published" })
  }
  return next
}

export function setTimelineDelivery(entries: TimelineEntry[], clientID: string, delivery: DeliveryState) {
  return entries.map((entry) => (entry.message.client_id === clientID ? { ...entry, delivery } : entry))
}

export function timelineMessages(entries: TimelineEntry[]) {
  return entries
    .filter((entry) => entry.delivery === "confirmed" || entry.delivery === "published")
    .map((entry) => entry.message)
}

export function feedTimeline(entries: TimelineEntry[], ephemeral: Message[]) {
  return ephemeral.reduce(
    (next, message) =>
      addTimelineEntry(next, {
        key: `ephemeral:${message.client_id || String(message.id)}`,
        message,
        delivery: "published",
      }),
    entries,
  )
}
