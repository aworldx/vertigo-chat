import { jsonMutation, record, requestJSON } from "../../../shared/api/json"
export type Option = { id: number; body: string; position: number; votes: number }
export type Poll = {
  id: number
  question: string
  status: "open" | "closed"
  options: Option[]
  totalVotes: number
  selectedOptionID: number
  createdAt: string
  closedAt: string | null
}
function poll(value: unknown): value is Poll {
  return (
    record(value) &&
    typeof value.id === "number" &&
    typeof value.question === "string" &&
    (value.status === "open" || value.status === "closed") &&
    Array.isArray(value.options) &&
    typeof value.totalVotes === "number" &&
    typeof value.selectedOptionID === "number"
  )
}
export async function loadPolls(token: string, admin = false, signal?: AbortSignal): Promise<Poll[]> {
  const v = await requestJSON(admin ? "/api/v1/admin/polls" : "/api/v1/polls", {
    ...(signal ? { signal } : {}),
    headers: token ? { "X-Chat-Session": token } : {},
  })
  if (!record(v) || !Array.isArray(v.polls) || !v.polls.every(poll)) throw new Error("unavailable")
  return v.polls
}
export async function loadPollNotices(token: string, signal?: AbortSignal): Promise<Poll[]> {
  if (!token) return []
  const v = await requestJSON("/api/v1/polls/notices", {
    ...(signal ? { signal } : {}),
    headers: { "X-Chat-Session": token },
  })
  if (!record(v) || !Array.isArray(v.polls) || !v.polls.every(poll)) throw new Error("unavailable")
  return v.polls
}
export async function vote(id: number, optionID: number, token: string, csrf: string) {
  await requestJSON(`/api/v1/polls/${String(id)}/votes`, {
    ...jsonMutation("POST", csrf, { option_id: optionID }),
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, "X-Chat-Session": token },
  })
}
export async function createPoll(question: string, options: string[], csrf: string) {
  await requestJSON("/api/v1/admin/polls", jsonMutation("POST", csrf, { question, options }))
}
export async function closePoll(id: number, csrf: string) {
  await requestJSON(`/api/v1/admin/polls/${String(id)}/close`, jsonMutation("POST", csrf, {}))
}
export function pollError(reason: unknown) {
  const code = reason instanceof Error ? reason.message : ""
  return code === "already_voted"
    ? "Вы уже голосовали в этом опросе."
    : code === "poll_closed"
      ? "Этот опрос уже завершён."
      : code === "forbidden"
        ? "Откройте страницу из активного чата."
        : "Не удалось выполнить действие."
}
