import type { components } from "../../../shared/generated/chat"
import { record } from "./entrance"
import { readSession } from "../model/storage"
export type MediaItem = components["schemas"]["MediaItem"]
export async function searchMedia(
  kind: MediaItem["kind"],
  query: string,
  generation: number,
  signal: AbortSignal,
): Promise<MediaItem[]> {
  const response = await fetch(`/api/v1/chat/media/${kind}?q=${encodeURIComponent(query)}`, {
    signal,
    headers: { "X-Chat-Session": readSession()?.resume_token ?? "", "X-Chat-Generation": String(generation) },
  })
  const body: unknown = await response.json()
  if (!response.ok) throw new Error("Поиск сейчас недоступен. Попробуй позже.")
  if (!record(body) || !Array.isArray(body.data)) throw new Error("Некорректный ответ поиска.")
  return body.data.filter(
    (item: unknown): item is MediaItem =>
      record(item) &&
      item.kind === kind &&
      [item.title, item.url, item.preview, item.artist, item.duration, item.source].every(
        (value) => typeof value === "string",
      ) &&
      safeMediaURL(kind, item.url),
  )
}
export function safeMediaURL(kind: string, value: unknown): value is string {
  if (typeof value !== "string") return false
  if (kind === "youtube") return /^\/youtube-proxy\/[A-Za-z0-9_-]{11}$/u.test(value)
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password) return false
    if (kind === "music")
      return (
        (url.hostname === "sunproxy.net" || url.hostname.endsWith(".sunproxy.net")) && url.pathname.startsWith("/file/")
      )
    return (
      (url.hostname === "gifsnap.com" && url.pathname.startsWith("/api/v1/media/")) ||
      ((url.hostname === "static.klipy.com" || /^pub-[a-z0-9-]+\.r2\.dev$/u.test(url.hostname)) &&
        /\.(gif|webp)$/u.test(url.pathname))
    )
  } catch {
    return false
  }
}
