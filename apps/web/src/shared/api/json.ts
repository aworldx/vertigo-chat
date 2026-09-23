export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
export async function requestJSON(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(path, { credentials: "same-origin", ...init })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(record(body) && typeof body.error === "string" ? body.error : "unavailable")
  return body
}
export function jsonMutation(method: string, csrf: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(body) }
}
