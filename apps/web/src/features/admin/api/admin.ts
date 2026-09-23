import type { components } from "../../../shared/generated/community"
import { record, requestJSON, jsonMutation } from "../../../shared/api/json"
export type Emoji = components["schemas"]["AdminEmoji"]
export type Tag = components["schemas"]["AdminTag"]
export type Content = components["schemas"]["AdminEmojis"]
export type Database = components["schemas"]["AdminDatabase"]
export type Moderation = components["schemas"]["AdminModeration"]
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s: unknown) => typeof s === "string")
function emoji(v: unknown): v is Emoji {
  return (
    record(v) &&
    typeof v.id === "number" &&
    typeof v.author === "string" &&
    typeof v.code === "string" &&
    (v.status === "pending" || v.status === "approved" || v.status === "rejected") &&
    typeof v.content_type === "string" &&
    typeof v.rejection_reason === "string" &&
    typeof v.width === "number" &&
    typeof v.height === "number" &&
    typeof v.animated === "boolean" &&
    Array.isArray(v.tag_ids) &&
    v.tag_ids.every((id: unknown) => typeof id === "number")
  )
}
function tag(v: unknown): v is Tag {
  return record(v) && typeof v.id === "number" && typeof v.name === "string" && strings(v.triggers)
}
export async function loadContent(signal: AbortSignal): Promise<Content> {
  const v = await requestJSON("/api/v1/admin/emojis", { signal })
  if (!record(v) || !Array.isArray(v.emojis) || !v.emojis.every(emoji) || !Array.isArray(v.tags) || !v.tags.every(tag))
    throw new Error("invalid_response")
  return { emojis: v.emojis, tags: v.tags }
}
export async function loadDatabase(table: string, signal: AbortSignal): Promise<Database> {
  const v = await requestJSON("/api/v1/admin/database?" + new URLSearchParams({ table }).toString(), { signal })
  if (
    !record(v) ||
    !strings(v.tables) ||
    !strings(v.columns) ||
    !Array.isArray(v.rows) ||
    !v.rows.every(strings) ||
    typeof v.selected_table !== "string"
  )
    throw new Error("invalid_response")
  return { tables: v.tables, columns: v.columns, rows: v.rows, selected_table: v.selected_table }
}
export async function moderate(id: number, v: Moderation, csrf: string) {
  await requestJSON(`/api/v1/admin/emojis/${String(id)}`, jsonMutation("PUT", csrf, v))
}
export async function remove(kind: "emojis" | "emoji-tags", id: number, csrf: string) {
  await requestJSON(`/api/v1/admin/${kind}/${String(id)}`, jsonMutation("DELETE", csrf, {}))
}
export async function saveTag(id: number, name: string, triggers: string, csrf: string) {
  await requestJSON(
    `/api/v1/admin/emoji-tags${id ? `/${String(id)}` : ""}`,
    jsonMutation(id ? "PUT" : "POST", csrf, { name, triggers: triggers.split(/\r\n|\r|\n/) }),
  )
}
export async function uploadEmoji(body: FormData, csrf: string) {
  await requestJSON("/api/v1/admin/emojis", { method: "POST", headers: { "X-CSRF-Token": csrf }, body })
}
export function adminError(e: unknown) {
  return e instanceof Error && e.message === "forbidden"
    ? "Недостаточно прав. Обновите страницу."
    : "Не удалось сохранить или загрузить данные. Проверьте поля и повторите."
}
