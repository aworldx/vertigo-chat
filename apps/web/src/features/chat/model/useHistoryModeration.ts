import { useState } from "react"
import { deleteHistoryMessage } from "../api/history"
export function useHistoryModeration(csrf: string | undefined, removed: (id: number) => void) {
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState("")
  async function remove(id: number) {
    if (!csrf || deleting !== null || !window.confirm("Удалить это сообщение для всех?")) return
    setDeleting(id)
    setError("")
    try {
      await deleteHistoryMessage(id, csrf)
      removed(id)
    } catch {
      setError("Не удалось удалить сообщение. Проверь права администратора и повтори попытку.")
    } finally {
      setDeleting(null)
    }
  }
  return { deleting, error, remove }
}
