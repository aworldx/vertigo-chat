import type { components } from "../../../shared/generated/chat"
import { colors, isPreferences, type Preferences } from "./preferences"
import { record } from "./entrance"
export type Message = components["schemas"]["Message"]
export type Peer = components["schemas"]["Peer"]
export type Snapshot = components["schemas"]["Snapshot"]
export type Frame =
  | { type: "signal"; sender: string; body: string }
  | { type: "ready"; snapshot: Snapshot; connection_id: string; generation: number }
  | { type: "snapshot"; snapshot: Snapshot }
  | { type: "ack"; message: Message }
  | { type: "private"; message: Message }
  | { type: "left" }
  | { type: "preferences"; preferences: Preferences }
  | { type: "error"; code: string; client_id: string }
function message(value: unknown): value is Message {
  return (
    record(value) &&
    typeof value.recipient === "string" &&
    record(value.reactions) &&
    Object.values(value.reactions).every(
      (count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0,
    ) &&
    Array.isArray(value.reacted) &&
    value.reacted.every((emoji: unknown) => typeof emoji === "string") &&
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    typeof value.client_id === "string" &&
    typeof value.kind === "string" &&
    typeof value.author === "string" &&
    typeof value.body === "string" &&
    typeof value.sent_at === "string" &&
    Number.isFinite(Date.parse(value.sent_at)) &&
    record(value.appearance) &&
    colors(value.appearance.dark) &&
    colors(value.appearance.light) &&
    ["theme", "sans", "display", "serif"].includes(String(value.font_id)) &&
    (value.font_style === "normal" || value.font_style === "italic")
  )
}
function snapshot(value: unknown): value is Snapshot {
  return (
    record(value) &&
    isPreferences(value.preferences) &&
    typeof value.admin === "boolean" &&
    Array.isArray(value.typing) &&
    value.typing.every((nickname: unknown) => typeof nickname === "string") &&
    Array.isArray(value.messages) &&
    value.messages.every(message) &&
    Array.isArray(value.peers) &&
    value.peers.every(
      (p: unknown) =>
        record(p) &&
        typeof p.id === "string" &&
        typeof p.nickname === "string" &&
        typeof p.registered === "boolean" &&
        typeof p.self === "boolean" &&
        typeof p.bot === "boolean" &&
        (p.bot_busy === undefined || typeof p.bot_busy === "boolean") &&
        (p.listening_track === undefined ||
          (typeof p.listening_track === "string" && Array.from(p.listening_track).length <= 200)) &&
        isPreferences(p.preferences) &&
        (p.rank === null ||
          (record(p.rank) &&
            typeof p.rank.title === "string" &&
            typeof p.rank.icon_url === "string" &&
            /^\/images\/ranks\/[a-z-]+\.svg$/u.test(p.rank.icon_url))) &&
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
  if (value.type === "signal" && typeof value.sender === "string" && typeof value.body === "string")
    return { type: "signal", sender: value.sender, body: value.body }
  if (value.type === "snapshot" && snapshot(value.snapshot)) return { type: "snapshot", snapshot: value.snapshot }
  if (value.type === "private" && message(value.message)) return { type: "private", message: value.message }
  if (value.type === "ack" && message(value.message)) return { type: "ack", message: value.message }
  if (value.type === "preferences" && isPreferences(value.preferences))
    return { type: "preferences", preferences: value.preferences }
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
