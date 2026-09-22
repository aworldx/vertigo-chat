import type { components } from "../../../shared/generated/accounts"

export type Session = components["schemas"]["Session"]["data"]
export type Principal = components["schemas"]["Principal"]
export type Credentials = components["schemas"]["Credentials"]

export class AccountError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "AccountError"
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function principal(value: unknown): value is Principal {
  return (
    record(value) &&
    typeof value.user_id === "number" &&
    Number.isSafeInteger(value.user_id) &&
    value.user_id > 0 &&
    typeof value.nickname === "string" &&
    Array.isArray(value.roles) &&
    value.roles.every((role: unknown) => role === "admin" || role === "emoji_moderator")
  )
}
function session(value: unknown): Session {
  if (
    !record(value) ||
    !record(value.data) ||
    typeof value.data.csrf_token !== "string" ||
    !(value.data.principal === null || principal(value.data.principal))
  ) {
    throw new AccountError("invalid_response", "Сервер вернул некорректную сессию.")
  }
  return { csrf_token: value.data.csrf_token, principal: value.data.principal }
}
async function request(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(`/api/v1/auth/${path}`, { credentials: "same-origin", ...init }).catch(
    (reason: unknown) => {
      if (init.signal?.aborted) throw reason
      throw new AccountError("unavailable", "Не удалось связаться с сервером. Попробуй ещё раз.")
    },
  )
  const body: unknown = response.status === 204 ? null : await response.json().catch(() => undefined)
  if (!response.ok) {
    const code = record(body) && typeof body.error === "string" ? body.error : "unavailable"
    const messages: Record<string, string> = {
      unauthorized: "Неверный ник или пароль. Если сессия истекла, попробуй ещё раз.",
      forbidden: "Сессия изменилась. Обнови страницу и попробуй ещё раз.",
      invalid_registration: "Не удалось зарегистрироваться. Проверь данные; ник или email могут быть заняты.",
      registration_limited: "С этого адреса сегодня уже зарегистрирован аккаунт. Попробуй завтра.",
    }
    throw new AccountError(code, messages[code] ?? "Не удалось связаться с сервером. Попробуй ещё раз.")
  }
  return body
}
export async function getSession(signal?: AbortSignal): Promise<Session> {
  return session(await request("session", { ...(signal ? { signal } : {}) }))
}
export async function authenticate(
  registering: boolean,
  values: Credentials & { email: string },
  csrf: string,
): Promise<Session> {
  const body = registering ? values : { nickname: values.nickname, password: values.password }
  return session(
    await request(registering ? "register" : "login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: JSON.stringify(body),
    }),
  )
}
export async function logout(csrf: string): Promise<void> {
  await request("logout", { method: "POST", headers: { "X-CSRF-Token": csrf } })
}
