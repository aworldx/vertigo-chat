import { useCallback, useState } from "react"
import type { Preferences } from "../api/preferences"
import type { ChatConnection } from "./connection"
export function usePreferences(current: Preferences, connection: ChatConnection) {
  const [draft, setDraft] = useState<Preferences | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("")
  const close = useCallback(() => {
    if (!saving) setDraft(null)
  }, [saving])
  const show = () => {
    setError("")
    setDraft(structuredClone(current))
  }
  const save = async () => {
    if (!draft || saving) return
    setSaving(true)
    setError("")
    try {
      await connection.savePreferences(draft)
      setDraft(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось сохранить настройки.")
    } finally {
      setSaving(false)
    }
  }
  return { draft, setDraft, saving, error, close, show, save }
}
