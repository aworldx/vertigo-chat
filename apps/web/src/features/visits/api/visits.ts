import type { operations } from "../../../shared/generated/chat"
type Response = operations["listVisits"]["responses"][200]["content"]["application/json"]
export type Visit = Response["data"][number]
const timestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value.replace("Z", ".000Z")
function isVisit(value: unknown): value is Visit {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    "nickname" in value &&
    typeof value.nickname === "string" &&
    "entered_at" in value &&
    timestamp(value.entered_at) &&
    "left_at" in value &&
    (value.left_at === null || timestamp(value.left_at))
  )
}
export async function loadVisits(signal: AbortSignal): Promise<Response> {
  const response = await fetch("/api/v1/visits", { signal, headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error("Не удалось загрузить историю. Попробуй ещё раз.")
  const body: unknown = await response.json()
  if (
    typeof body !== "object" ||
    body === null ||
    !("data" in body) ||
    !Array.isArray(body.data) ||
    !body.data.every(isVisit) ||
    !("meta" in body) ||
    typeof body.meta !== "object" ||
    body.meta === null ||
    !("history_hours" in body.meta) ||
    body.meta.history_hours !== 48
  )
    throw new Error("Сервер вернул некорректную историю.")
  if (new Set(body.data.map((visit) => visit.id)).size !== body.data.length)
    throw new Error("Сервер вернул повторяющиеся визиты.")
  return { data: body.data, meta: { history_hours: 48 } }
}
