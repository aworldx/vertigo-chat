import type { Message } from "../api/protocol"
import type { DeliveryState } from "./delivery"

export type TimelineEntry = {
  delivery: DeliveryState
  key: string
  message: Message
}

export function timelineKey(message: Pick<Message, "id" | "client_id" | "author">) {
  return message.id > 0
    ? `message:${String(message.id)}`
    : `pending:${JSON.stringify([message.author, message.client_id])}`
}

export function addTimelineEntry(entries: TimelineEntry[], entry: TimelineEntry) {
  const retained = entries.filter((current) => {
    if (current.key === entry.key) return false
    return !(
      entry.message.id > 0 &&
      current.message.id === 0 &&
      current.message.author === entry.message.author &&
      current.message.client_id === entry.message.client_id
    )
  })
  return [...retained, entry].sort(
    (left, right) => Date.parse(left.message.sent_at) - Date.parse(right.message.sent_at),
  )
}

export function publishTimeline(entries: TimelineEntry[], messages: Message[]) {
  const published = new Set(messages.map(timelineKey))
  let next = entries.filter((entry) => entry.delivery !== "published" || published.has(entry.key))
  for (const message of messages) {
    const key = timelineKey(message)
    next = addTimelineEntry(next, { key, message, delivery: "published" })
  }
  return next
}

export function setTimelineDelivery(entries: TimelineEntry[], clientID: string, delivery: DeliveryState) {
  return entries.map((entry) =>
    entry.message.id === 0 && entry.message.client_id === clientID ? { ...entry, delivery } : entry,
  )
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
        key: `ephemeral:${String(message.id)}`,
        message,
        delivery: "published",
      }),
    entries,
  )
}
