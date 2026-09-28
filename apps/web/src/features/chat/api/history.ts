import type { paths } from "../../../shared/generated/chat"
import { record, requestJSON, jsonMutation } from "../../../shared/api/json"
import { message, type Message } from "./protocol"
export type HistoryPage = paths["/api/v1/chat/history"]["get"]["responses"][200]["content"]["application/json"]
export type HistoryPeriod = { from: string; through: string }
export async function loadHistory(period: HistoryPeriod, after: number, signal: AbortSignal): Promise<HistoryPage> {
  const query = new URLSearchParams({ ...period, after: String(after) })
  const value = await requestJSON(`/api/v1/chat/history?${query.toString()}`, { signal })
  if (
    !record(value) ||
    !Array.isArray(value.data) ||
    value.data.length > 100 ||
    !value.data.every(
      (item: unknown): item is Message =>
        message(item) && ["text", "system", "gif", "music", "youtube", "tetris"].includes(item.kind),
    ) ||
    !(value.next === null || (typeof value.next === "number" && Number.isSafeInteger(value.next) && value.next > after))
  ) {
    throw new Error("invalid_history")
  }
  return { data: value.data, next: value.next }
}

export async function deleteHistoryMessage(id: number, csrf: string): Promise<void> {
  await requestJSON(`/api/v1/chat/history/${String(id)}`, jsonMutation("DELETE", csrf, {}))
}
