import type { components } from "../../../shared/generated/chat"
export type Comment = components["schemas"]["ChartComment"]
export type Track = components["schemas"]["ChartTrack"]
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
function comment(value: unknown): value is Comment {
  return (
    record(value) &&
    Number.isSafeInteger(value.id) &&
    typeof value.author === "string" &&
    typeof value.body === "string"
  )
}
function track(value: unknown): value is Track {
  return (
    record(value) &&
    Number.isSafeInteger(value.id) &&
    typeof value.title === "string" &&
    typeof value.author === "string" &&
    typeof value.own === "boolean" &&
    typeof value.liked === "boolean" &&
    typeof value.likes_count === "number" &&
    Array.isArray(value.comments) &&
    value.comments.every(comment)
  )
}
export async function listTracks(signal: AbortSignal): Promise<Track[]> {
  const response = await fetch("/api/v1/music-chart", { signal })
  if (!response.ok) throw new Error("Не удалось загрузить хит-парад.")
  const body: unknown = await response.json()
  if (!record(body) || !Array.isArray(body.data) || !body.data.every(track))
    throw new Error("Некорректный ответ хит-парада.")
  return body.data
}
export async function changeTrack(path: string, method: string, body: FormData | object, csrf: string) {
  const form = body instanceof FormData
  const response = await fetch(`/api/v1/music-chart${path}`, {
    method,
    headers: form ? { "X-CSRF-Token": csrf } : { "X-CSRF-Token": csrf, "Content-Type": "application/json" },
    body: form ? body : JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
}
