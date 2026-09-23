import type { components } from "../../../shared/generated/community"
import { record, requestJSON, jsonMutation } from "../../../shared/api/json"
export type Photo = components["schemas"]["GalleryPhoto"]
export type Gallery = components["schemas"]["Gallery"]
function photo(v: unknown): v is Photo {
  return (
    record(v) &&
    typeof v.id === "number" &&
    Number.isSafeInteger(v.id) &&
    v.id > 0 &&
    typeof v.author === "string" &&
    typeof v.caption === "string" &&
    typeof v.date === "string" &&
    typeof v.own === "boolean" &&
    typeof v.likes === "number" &&
    typeof v.liked === "boolean" &&
    v.image === `/gallery/photos/${String(v.id)}` &&
    (v.thumbnail === v.image || v.thumbnail === `${v.image}/thumbnail`)
  )
}
export async function loadGallery(signal: AbortSignal): Promise<Gallery> {
  const v = await requestJSON("/api/v1/gallery", { signal })
  if (!record(v) || !Array.isArray(v.data) || !v.data.every(photo) || typeof v.can_upload !== "boolean")
    throw new Error("invalid_response")
  return { data: v.data, can_upload: v.can_upload }
}
export async function saveCaption(id: number, caption: string, csrf: string) {
  await requestJSON(`/api/v1/gallery/${String(id)}/caption`, jsonMutation("PUT", csrf, { caption }))
}
export async function likePhoto(id: number, active: boolean, csrf: string) {
  await requestJSON(`/api/v1/gallery/${String(id)}/like`, jsonMutation("PUT", csrf, { active }))
}
export async function uploadPhoto(image: Blob, thumbnail: Blob, caption: string, csrf: string) {
  const body = new FormData()
  body.set("image", image, "photo.webp")
  body.set("thumbnail", thumbnail, "thumbnail.webp")
  body.set("caption", caption)
  await requestJSON("/api/v1/gallery", { method: "POST", headers: { "X-CSRF-Token": csrf }, body })
}
export function galleryError(e: unknown): string {
  const code = e instanceof Error ? e.message : "unavailable"
  const messages: Record<string, string> = {
    statist_required: "Добавлять фото могут чатлане со званием «Статист».",
    photo_limit_reached: "В альбоме одного автора может быть не больше 20 фотографий.",
    daily_photo_limit_reached: "Дневной лимит — 5 фотографий. Попробуй завтра.",
    invalid_caption: "Название должно быть не длиннее 280 символов.",
    invalid_photo: "Не удалось прочитать изображение. Выберите исправный JPG, PNG или WebP.",
    forbidden: "Сессия изменилась. Обнови страницу и попробуй ещё раз.",
  }
  return messages[code] ?? "Не удалось загрузить фотоальбом. Попробуй ещё раз."
}
