import { record } from "./entrance"
import { readSession, saveSession, checkStorage } from "../model/storage"
export async function roomRequest(path: string, csrf: string, payload: object | FormData): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers:
      payload instanceof FormData
        ? { "X-CSRF-Token": csrf }
        : { "X-CSRF-Token": csrf, "Content-Type": "application/json" },
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  })
  const value: unknown = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(
      record(value) && typeof value.error === "string"
        ? value.error
        : "Не удалось выполнить действие. Проверь данные и повтори.",
    )
  return value
}
export async function upgrade(csrf: string, generation: number, password: string, email: string) {
  const session = readSession()
  if (!session) throw new Error("Сессия завершена.")
  checkStorage()
  const value = await roomRequest("/api/v1/chat/upgrade", csrf, { ...session, generation, password, email })
  if (
    !record(value) ||
    !record(value.data) ||
    typeof value.data.resume_token !== "string" ||
    typeof value.data.nickname !== "string"
  )
    throw new Error("Некорректный ответ сервера.")
  saveSession({ resume_token: value.data.resume_token, nickname: value.data.nickname })
  return value.data.resume_token
}
