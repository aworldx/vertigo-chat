import { jsonMutation, record, requestJSON } from "../../../shared/api/json"

export type Note = { id: number; sender: string; recipient: string; body: string; read: boolean; inserted_at: string }
export type Notes = { incoming: Note[]; outgoing: Note[] }
function note(v: unknown): v is Note {
  return (
    record(v) &&
    typeof v.id === "number" &&
    typeof v.sender === "string" &&
    typeof v.recipient === "string" &&
    typeof v.body === "string" &&
    typeof v.read === "boolean" &&
    typeof v.inserted_at === "string"
  )
}
export async function notesSummary(signal?: AbortSignal) {
  const value = await requestJSON("/api/v1/notes/summary", signal ? { signal } : {})
  if (!record(value) || typeof value.unread !== "number") throw new Error("invalid_response")
  return value.unread
}
export async function loadNotes(signal: AbortSignal): Promise<Notes> {
  const value = await requestJSON("/api/v1/notes", { signal })
  if (
    !record(value) ||
    !Array.isArray(value.incoming) ||
    !value.incoming.every(note) ||
    !Array.isArray(value.outgoing) ||
    !value.outgoing.every(note)
  )
    throw new Error("invalid_response")
  return { incoming: value.incoming, outgoing: value.outgoing }
}
export async function sendNote(recipient: string, body: string, csrf: string) {
  await requestJSON("/api/v1/notes", jsonMutation("POST", csrf, { recipient, body }))
}
export function notesError(value: unknown) {
  const code = value instanceof Error ? value.message : "unavailable"
  return (
    (
      {
        recipient_not_found: "Такого зарегистрированного чатлана нет.",
        invalid_note: "Укажи чатлана и текст до 1000 символов.",
        note_daily_limit: "За сутки можно оставить не больше 30 записок.",
      } as Record<string, string>
    )[code] ?? "Не удалось открыть записную книжку."
  )
}
