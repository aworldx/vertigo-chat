import type { operations } from "../../../shared/generated/accounts"
import { AccountError } from "./accounts"
type Settings = operations["getAccountSettings"]["responses"][200]["content"]["application/json"]["data"]
export async function readSettings(signal: AbortSignal): Promise<Settings> {
  return request("/api/v1/account/settings", { signal })
}
export async function saveEmail(email: string, csrf: string, signal: AbortSignal): Promise<Settings> {
  return request("/api/v1/account/settings/email", {
    method: "PUT",
    signal,
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify({ email }),
  })
}
async function request(path: string, init: RequestInit): Promise<Settings> {
  const response = await fetch(path, { credentials: "same-origin", ...init })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const code =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : "unavailable"
    const messages: Record<string, string> = {
      email_required: "can't be blank",
      email_invalid: "has invalid format",
      email_taken: "has already been taken",
      email_too_long: "Email должен быть не длиннее 254 символов.",
      unauthorized: "Сначала войди в аккаунт чата.",
      forbidden: "Сессия изменилась. Обнови страницу и попробуй ещё раз.",
    }
    throw new AccountError(code, messages[code] ?? "Не удалось сохранить email. Попробуй ещё раз.")
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("data" in body) ||
    typeof body.data !== "object" ||
    body.data === null ||
    !("email" in body.data) ||
    !(body.data.email === null || typeof body.data.email === "string")
  )
    throw new AccountError("invalid_response", "Сервер вернул некорректные настройки.")
  return { email: body.data.email }
}
