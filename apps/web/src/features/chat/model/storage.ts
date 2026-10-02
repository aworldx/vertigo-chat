import { record, type Entrance } from "../api/entrance"
import { isPendingDeliveryState, type PendingDeliveryState } from "./delivery"
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
export type PendingMessage = {
  client_id: string
  body: string
  reply_to_id?: number
  sent_at: string
  state: PendingDeliveryState
}
export function readOutbox(): PendingMessage[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`${key}.outbox`) ?? "[]")
    return Array.isArray(value)
      ? value.flatMap((item: unknown): PendingMessage[] => {
          if (
            !record(item) ||
            typeof item.client_id !== "string" ||
            typeof item.body !== "string" ||
            !(
              item.reply_to_id === undefined ||
              (typeof item.reply_to_id === "number" && Number.isSafeInteger(item.reply_to_id) && item.reply_to_id > 0)
            ) ||
            !isPendingDeliveryState(item.state)
          )
            return []
          return [
            {
              client_id: item.client_id,
              body: item.body,
              ...(typeof item.reply_to_id === "number" ? { reply_to_id: item.reply_to_id } : {}),
              sent_at:
                typeof item.sent_at === "string" && Number.isFinite(Date.parse(item.sent_at))
                  ? item.sent_at
                  : new Date().toISOString(),
              state: item.state,
            },
          ]
        })
      : []
  } catch {
    return []
  }
}
export function saveOutbox(messages: PendingMessage[]) {
  sessionStorage.setItem(`${key}.outbox`, JSON.stringify(messages))
}
