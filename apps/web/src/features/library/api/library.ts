import type { components } from "../../../shared/generated/community"
import { record, requestJSON, jsonMutation } from "../../../shared/api/json"
export type Article = components["schemas"]["LibraryArticle"]
export type Input = components["schemas"]["LibraryInput"]
export type Series = components["schemas"]["LibrarySeries"]
export type Library = components["schemas"]["Library"]
function article(v: unknown): v is Article {
  return (
    record(v) &&
    typeof v.id === "number" &&
    typeof v.author_id === "number" &&
    typeof v.author === "string" &&
    typeof v.date === "string" &&
    typeof v.own === "boolean" &&
    typeof v.title === "string" &&
    typeof v.body === "string" &&
    typeof v.series === "string" &&
    (v.part_number === null || typeof v.part_number === "number")
  )
}
function series(v: unknown): v is Series {
  return (
    record(v) &&
    typeof v.author_id === "number" &&
    typeof v.author === "string" &&
    typeof v.name === "string" &&
    typeof v.count === "number"
  )
}
export async function loadLibrary(query: string, signal: AbortSignal): Promise<Library> {
  const v = await requestJSON("/api/v1/library" + query, { signal })
  if (
    !record(v) ||
    !Array.isArray(v.data) ||
    !v.data.every(article) ||
    !Array.isArray(v.series) ||
    !v.series.every(series) ||
    typeof v.can_publish !== "boolean"
  )
    throw new Error("invalid_response")
  return { data: v.data, series: v.series, can_publish: v.can_publish }
}
export async function saveArticle(id: number | undefined, value: Input, csrf: string) {
  await requestJSON(`/api/v1/library${id ? `/${String(id)}` : ""}`, jsonMutation(id ? "PUT" : "POST", csrf, value))
}
export function libraryError(e: unknown) {
  const code = e instanceof Error ? e.message : "unavailable"
  const messages: Record<string, string> = {
    invalid_article: "Проверь название, текст, серию и номер части.",
    kinoman_required: "Добавлять статьи могут чатлане со званием «Киноман».",
    forbidden: "Редактировать статью может только автор.",
    daily_article_limit_reached: "За сутки можно добавить не больше 10 статей.",
    article_limit_reached: "Один автор может хранить не больше 50 статей.",
  }
  return messages[code] ?? "Не удалось загрузить библиотеку. Попробуй ещё раз."
}
