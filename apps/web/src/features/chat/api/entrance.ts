import type { components } from "../../../shared/generated/chat"
export type Entrance = components["schemas"]["Entrance"]
export type Credentials = components["schemas"]["Credentials"]
const errors: Record<string, string> = {
  invalid_nickname: "Введи ник из 3–24 букв, цифр, _ или -.",
  nickname_online: "Этот ник уже используется в чате. Вернись в открытую вкладку или выбери другой.",
  password_required: "Этот ник зарегистрирован. Введи пароль.",
  not_found: "Такой ник не зарегистрирован.",
  invalid_password: "Неверный пароль.",
  invalid_registration: "Ник должен быть свободным; пароль — не короче 6 символов. Проверь также email.",
  registration_limited: "С этого адреса уже создавали аккаунт. Повторная регистрация доступна через сутки.",
  forbidden: "Сессия изменилась. Повтори вход.",
}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
export async function enter(credentials: Credentials, registering: boolean, csrf: string): Promise<Entrance> {
  const response = await fetch(`/api/v1/chat/${registering ? "register" : "enter"}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: JSON.stringify(credentials),
  }).catch(() => {
    throw new Error("Не удалось связаться с сервером. Проверь соединение и повтори вход.")
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok)
    throw new Error(
      record(body) && typeof body.error === "string"
        ? (errors[body.error] ?? "Не удалось войти. Попробуй ещё раз.")
        : "Не удалось войти. Попробуй ещё раз.",
    )
  if (
    !record(body) ||
    !record(body.data) ||
    typeof body.data.resume_token !== "string" ||
    typeof body.data.nickname !== "string"
  )
    throw new Error("Сервер вернул некорректную сессию.")
  return { resume_token: body.data.resume_token, nickname: body.data.nickname }
}

// If browser storage becomes unavailable after the server commits, release the
// newly created session using the credential still held only in this function.
export async function cancelEntrance(token: string): Promise<void> {
  const url = new URL("/api/v1/chat/socket", window.location.origin)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  const socket = new WebSocket(url)
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Не удалось завершить вход. Ник освободится после потери связи."))
      }, 5000)
      const fail = () => {
        clearTimeout(timeout)
        reject(new Error("Не удалось завершить вход. Ник освободится после потери связи."))
      }
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "resume", resume_token: token }))
      }
      socket.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data !== "string") return
        const frame: unknown = JSON.parse(event.data)
        if (!record(frame)) return
        if (frame.type === "ready") socket.send(JSON.stringify({ type: "leave" }))
        if (frame.type === "left") {
          clearTimeout(timeout)
          resolve()
        }
      }
      socket.onerror = fail
      socket.onclose = fail
    })
  } finally {
    socket.close()
  }
}
