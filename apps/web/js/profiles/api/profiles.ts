import type { components, operations } from "../../shared/generated/profiles"

export type Profile = components["schemas"]["Profile"]
type APIErrorResponse = components["schemas"]["Error"]
export type ListProfilesResponse = operations["listProfiles"]["responses"][200]["content"]["application/json"]
export type GetProfileResponse = operations["getProfile"]["responses"][200]["content"]["application/json"]

export class APIError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = "APIError"
  }
}

async function request(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    signal,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })

  const body: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const error = isErrorResponse(body) ? body.error : undefined
    throw new APIError(error?.message ?? "Не удалось загрузить анкеты. Попробуй ещё раз.", error?.code ?? "unavailable")
  }

  return body
}

export async function listProfiles(query: string, page: number, signal: AbortSignal): Promise<ListProfilesResponse> {
  const params = new URLSearchParams({ q: query, page: String(page) })
  const body = await request(`/api/v1/profiles?${params}`, signal)
  if (!isListProfilesResponse(body)) throw new APIError("Сервер вернул некорректный список анкет.", "invalid_response")
  return body
}

export async function getProfile(nickname: string, signal: AbortSignal): Promise<GetProfileResponse> {
  const body = await request(`/api/v1/profiles/${encodeURIComponent(nickname)}`, signal)
  if (!isGetProfileResponse(body)) throw new APIError("Сервер вернул некорректную анкету.", "invalid_response")
  return body
}

function isProfile(value: unknown): value is Profile {
  if (
    !isRecord(value) ||
    typeof value.nickname !== "string" ||
    (typeof value.name !== "string" && value.name !== null) ||
    !isNullableString(value.gender) ||
    !isNullableString(value.birth_date) ||
    !isNullableString(value.about) ||
    !isNullableString(value.photo_url) ||
    !isNullableString(value.thumbnail_url)
  )
    return false
  return (
    isRecord(value.rank) &&
    typeof value.rank.title === "string" &&
    typeof value.rank.icon_url === "string" &&
    isRecord(value.progress) &&
    Number.isInteger(value.progress.public_messages) &&
    Number.isInteger(value.progress.chat_hours)
  )
}

function isListProfilesResponse(value: unknown): value is ListProfilesResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.data) &&
    value.data.every(isProfile) &&
    isRecord(value.meta) &&
    Number.isInteger(value.meta.page) &&
    Number.isInteger(value.meta.page_size) &&
    Number.isInteger(value.meta.total) &&
    Number.isInteger(value.meta.total_pages) &&
    typeof value.meta.query === "string"
  )
}

function isGetProfileResponse(value: unknown): value is GetProfileResponse {
  return isRecord(value) && isProfile(value.data)
}

function isErrorResponse(value: unknown): value is APIErrorResponse {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  )
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
