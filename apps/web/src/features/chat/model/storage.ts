import { record, type Entrance } from "../api/entrance"
const key = "vertigo.go-chat"
export function readSession(): Entrance | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null")
    return record(value) && typeof value.resume_token === "string" && typeof value.nickname === "string"
      ? { resume_token: value.resume_token, nickname: value.nickname }
      : null
  } catch {
    return null
  }
}
export function checkStorage() {
  const probe = `${key}.probe`
  sessionStorage.setItem(probe, "1")
  sessionStorage.removeItem(probe)
}
export function saveSession(session: Entrance) {
  sessionStorage.setItem(key, JSON.stringify(session))
}
export function clearSession() {
  sessionStorage.removeItem(key)
  sessionStorage.removeItem(`${key}.outbox`)
}
export type PendingMessage = { client_id: string; body: string; state: "sending" | "retrying" | "failed" }
export function readOutbox(): PendingMessage[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`${key}.outbox`) ?? "[]")
    return Array.isArray(value)
      ? value.filter(
          (item: unknown): item is PendingMessage =>
            record(item) &&
            typeof item.client_id === "string" &&
            typeof item.body === "string" &&
            (item.state === "sending" || item.state === "retrying" || item.state === "failed"),
        )
      : []
  } catch {
    return []
  }
}
export function saveOutbox(messages: PendingMessage[]) {
  sessionStorage.setItem(`${key}.outbox`, JSON.stringify(messages))
}
