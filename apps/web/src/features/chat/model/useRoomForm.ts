import { useCallback, useState } from "react"
import { roomRequest, upgrade } from "../api/forms"
import type { ChatConnection, RoomState } from "./connection"
function field(data: FormData, key: string, fallback = "") {
  const value = data.get(key)
  return typeof value === "string" ? value : fallback
}
export type RoomFormKind = "register" | "feedback" | "emoji" | "attachment"
export function useRoomForm(
  csrf: string,
  state: RoomState,
  connection: ChatConnection,
  share: (file: File) => Promise<void>,
) {
  const [kind, setKind] = useState<RoomFormKind | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("")
  const open = useCallback((value: RoomFormKind) => {
    setKind(value)
    setError("")
    setSuccess("")
  }, [])
  const close = useCallback(() => {
    if (!busy) setKind(null)
  }, [busy])
  const submit = async (data: FormData) => {
    setBusy(true)
    setError("")
    try {
      if (!csrf) throw new Error("Не удалось загрузить сессию. Обнови страницу.")
      if (kind === "register") {
        if (state.status !== "ready" || state.outbox.length > 0)
          throw new Error("Дождись подключения и отправки всех сообщений.")
        const token = await upgrade(csrf, state.generation, field(data, "password"), field(data, "email"))
        connection.replaceCredential(token)
        setKind(null)
      } else if (kind === "feedback") {
        await roomRequest("/api/v1/chat/feedback", csrf, {
          name: field(data, "name", state.nickname),
          body: field(data, "body"),
        })
        setSuccess("Сообщение отправлено. Спасибо за обратную связь!")
      } else if (kind === "attachment") {
        const file = data.get("file")
        if (!(file instanceof File)) throw new Error("Выбери файл.")
        await share(file)
        setKind(null)
      } else if (kind === "emoji") {
        await roomRequest("/api/v1/chat/emojis", csrf, data)
        setSuccess("Смайлик отправлен на модерацию.")
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось выполнить действие.")
    } finally {
      setBusy(false)
    }
  }
  return { kind, busy, error, success, open, close, submit }
}
