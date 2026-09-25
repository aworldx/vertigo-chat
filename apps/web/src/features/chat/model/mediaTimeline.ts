import type { SharedFile } from "./mediaTransfer"
import { timelineKey, type TimelineEntry } from "./timeline"

export type PositionedFile = SharedFile & { after: string[] }
export type FeedItem =
  { kind: "message"; key: string; entry: TimelineEntry } | { kind: "file"; key: string; file: PositionedFile }

export function updateSharedFile(files: PositionedFile[], file: SharedFile, entries: TimelineEntry[]) {
  const existing = files.find((item) => item.id === file.id)
  if (existing) return files.map((item) => (item.id === file.id ? { ...file, after: item.after } : item))
  return [...files, { ...file, after: entries.map((entry) => entry.key) }].slice(-20)
}

// Anchor to the messages present when the announcement arrived, not client/server
// clocks. Keep pending-message aliases across acknowledgements and fall back to
// earlier anchors when a message is deleted or the history window advances.
export function mergeMediaTimeline(entries: TimelineEntry[], files: PositionedFile[]): FeedItem[] {
  const positions = new Map<string, number>()
  entries.forEach((entry, index) => {
    positions.set(entry.key, index)
    if (entry.message.client_id) positions.set(timelineKey({ ...entry.message, id: 0 }), index)
  })
  const slots = new Map<number, PositionedFile[]>()
  for (const file of files) {
    const position = Math.max(-1, ...file.after.map((key) => positions.get(key) ?? -1))
    slots.set(position, [...(slots.get(position) ?? []), file])
  }
  const attachments = (index: number): FeedItem[] =>
    (slots.get(index) ?? []).map((file) => ({ kind: "file", key: `file:${file.id}`, file }))
  return [
    ...attachments(-1),
    ...entries.flatMap((entry, index): FeedItem[] => [
      { kind: "message", key: entry.key, entry },
      ...attachments(index),
    ]),
  ]
}
