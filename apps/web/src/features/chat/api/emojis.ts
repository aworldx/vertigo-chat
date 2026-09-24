import type { components } from "../../../shared/generated/chat"
import { record } from "./entrance"
export type Emoji = components["schemas"]["Emoji"]

export function emojiToken(code: string): string {
  return `-${code
    .trim()
    .replace(/^[:-]+|[:-]+$/gu, "")
    .toLocaleLowerCase()}-`
}

export function legacyEmojiToken(code: string): string {
  return `:${code
    .trim()
    .replace(/^[:-]+|[:-]+$/gu, "")
    .toLocaleLowerCase()}:`
}

export async function getEmojis(signal: AbortSignal): Promise<Emoji[]> {
  const response = await fetch("/api/v1/chat/emojis", { signal, credentials: "same-origin" })
  const body: unknown = await response.json()
  if (!response.ok || !record(body) || !Array.isArray(body.data)) throw new Error("Не удалось загрузить смайлы.")
  return body.data.filter(
    (e: unknown): e is Emoji =>
      record(e) &&
      typeof e.id === "number" &&
      Number.isSafeInteger(e.id) &&
      typeof e.code === "string" &&
      typeof e.width === "number" &&
      typeof e.height === "number" &&
      Array.isArray(e.terms) &&
      e.terms.every((term: unknown) => typeof term === "string"),
  )
}
