import { jsonMutation, record, requestJSON } from "../../../shared/api/json"
import type { components } from "../../../shared/generated/community"
export type SeriesInput = components["schemas"]["LibrarySeriesInput"]
export async function saveSeries(value: SeriesInput, csrf: string) {
  await requestJSON("/api/v1/library/series", jsonMutation("PUT", csrf, value))
}
export async function setArticleReaction(id: number, kind: "like" | "bookmark", active: boolean, csrf: string) {
  await requestJSON(`/api/v1/library/${String(id)}/${kind}`, jsonMutation("PUT", csrf, { active }))
}
export async function uploadLibraryImage(file: File, csrf: string): Promise<string> {
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 2_000_000 || file.size === 0)
    throw new Error("invalid_image")
  const body = new FormData()
  body.append("image", file)
  const value = await requestJSON("/api/v1/library/images", { method: "POST", headers: { "X-CSRF-Token": csrf }, body })
  if (!record(value) || typeof value.url !== "string" || !/^\/library\/images\/[1-9][0-9]*$/.test(value.url))
    throw new Error("invalid_response")
  return value.url
}
