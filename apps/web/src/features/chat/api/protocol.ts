import type { components } from "../../../shared/generated/chat"
import { record } from "./entrance"
export type Message = components["schemas"]["Message"]
export type Snapshot = components["schemas"]["Snapshot"]
export type Frame =
  | { type: "ready"; snapshot: Snapshot; connection_id: string; generation: number }
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "ack"; message: Message }
  | { type: "left" }
  | { type: "error"; code: string; client_id: string }
function message(value: unknown): value is Message {
  return (
    record(value) &&
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    typeof value.client_id === "string" &&
    typeof value.kind === "string" &&
    typeof value.author === "string" &&
    typeof value.body === "string" &&
    typeof value.sent_at === "string"
  )
}
function snapshot(value: unknown): value is Snapshot {
  return (
    record(value) &&
    Array.isArray(value.messages) &&
    value.messages.every(message) &&
    Array.isArray(value.peers) &&
    value.peers.every(
      (p: unknown) =>
        record(p) &&
        typeof p.id === "string" &&
        typeof p.nickname === "string" &&
        (p.status === "active" || p.status === "reconnecting"),
    )
  )
}
export function decodeFrame(raw: string): Frame | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!record(value)) return null
  if (
    value.type === "ready" &&
    snapshot(value.snapshot) &&
    typeof value.connection_id === "string" &&
    typeof value.generation === "number"
  )
    return { type: "ready", snapshot: value.snapshot, connection_id: value.connection_id, generation: value.generation }
  if (value.type === "snapshot" && snapshot(value.snapshot)) return { type: "snapshot", snapshot: value.snapshot }
  if (value.type === "ack" && message(value.message)) return { type: "ack", message: value.message }
  if (value.type === "left") return { type: "left" }
  if (value.type === "error" && typeof value.code === "string")
    return { type: "error", code: value.code, client_id: typeof value.client_id === "string" ? value.client_id : "" }
  return null
}
export function socketURL() {
  const url = new URL("/api/v1/chat/socket", window.location.origin)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.href
}
