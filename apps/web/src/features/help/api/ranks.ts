import type { operations } from "../../../shared/generated/profiles"
export type Rank = operations["listRanks"]["responses"][200]["content"]["application/json"]["data"][number]
export async function loadRanks(signal: AbortSignal): Promise<Rank[]> {
  const response = await fetch("/api/v1/ranks", { signal, headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error("Не удалось загрузить звания.")
  const body: unknown = await response.json()
  if (
    typeof body !== "object" ||
    body === null ||
    !("data" in body) ||
    !Array.isArray(body.data) ||
    !body.data.every(isRank)
  )
    throw new Error("Некорректный ответ сервера.")
  return body.data
}
function isRank(value: unknown): value is Rank {
  if (typeof value !== "object" || value === null) return false
  return (
    "title" in value &&
    typeof value.title === "string" &&
    "icon_url" in value &&
    typeof value.icon_url === "string" &&
    /^\/images\/ranks\/[a-z-]+\.svg$/.test(value.icon_url) &&
    "messages" in value &&
    typeof value.messages === "number" &&
    Number.isInteger(value.messages) &&
    value.messages >= 0 &&
    "hours" in value &&
    typeof value.hours === "number" &&
    Number.isInteger(value.hours) &&
    value.hours >= 0 &&
    "feature_unlock" in value &&
    typeof value.feature_unlock === "string"
  )
}
