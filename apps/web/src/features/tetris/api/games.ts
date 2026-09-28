import { isGame, isLeader } from "./protocol"

async function request(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    credentials: "same-origin",
  })
  if (!response.ok) throw new Error((await response.text()).slice(0, 200))
  const value: unknown = await response.json()
  return value
}
export async function openGame(token: string, argument: string, signal: AbortSignal, rematch = false) {
  if (!token) throw new Error("Сначала войди в чат.")
  const create = argument === "" || argument.toLowerCase() === "соло"
  const value = await request(
    rematch
      ? `/api/v1/tetris/${encodeURIComponent(argument)}/rematch`
      : create
        ? "/api/v1/tetris"
        : `/api/v1/tetris/${encodeURIComponent(argument)}`,
    token,
    {
      signal,
      ...(create || rematch ? { method: "POST", body: JSON.stringify({ mode: argument ? "solo" : "versus" }) } : {}),
    },
  )
  if (!isGame(value)) throw new Error("Некорректное состояние игры.")
  return value
}
export async function leaders(mode: string, period: string, signal: AbortSignal) {
  const value = await request(`/api/v1/tetris/leaderboard?mode=${mode}&period=${period}`, "", { signal })
  if (!Array.isArray(value) || !value.every(isLeader)) throw new Error("Не удалось прочитать таблицу лидеров.")
  return value
}
