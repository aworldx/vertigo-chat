import { useEffect, useRef, useState } from "react"
import { AccountError } from "../api/accounts"
import { readSettings, saveEmail } from "../api/settings"

export function useEmailSettings(csrf: string, onSessionChanged: () => void) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const active = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const sessionChanged = useRef(onSessionChanged)
  useEffect(() => {
    sessionChanged.current = onSessionChanged
  }, [onSessionChanged])
  useEffect(() => {
    const controller = new AbortController()
    active.current = controller
    void readSettings(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setEmail(data.email ?? "")
          setLoading(false)
        }
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setLoading(false)
        setLoadError("Не удалось загрузить настройки. Попробуй ещё раз.")
        if (reason instanceof AccountError && reason.code === "unauthorized") sessionChanged.current()
      })
    return () => {
      controller.abort()
      active.current?.abort()
    }
  }, [attempt])
  async function submit() {
    if (busy.current || loading || loadError) return
    busy.current = true
    setSaving(true)
    setError("")
    setNotice(false)
    const controller = new AbortController()
    active.current = controller
    try {
      const data = await saveEmail(email, csrf, controller.signal)
      if (!controller.signal.aborted) {
        setEmail(data.email ?? "")
        setNotice(true)
      }
    } catch (reason: unknown) {
      if (!controller.signal.aborted) {
        if (reason instanceof AccountError && reason.code.startsWith("email_"))
          setEmail((value) => value.trim().toLowerCase())
        setError(reason instanceof AccountError ? reason.message : "Не удалось сохранить email. Попробуй ещё раз.")
        if (reason instanceof AccountError && (reason.code === "unauthorized" || reason.code === "forbidden"))
          sessionChanged.current()
      }
    } finally {
      busy.current = false
      if (!controller.signal.aborted) setSaving(false)
    }
  }
  return {
    email,
    setEmail,
    loading,
    loadError,
    error,
    notice,
    saving,
    submit,
    dismiss: () => {
      setNotice(false)
    },
    retry: () => {
      setLoading(true)
      setLoadError("")
      setAttempt((value) => value + 1)
    },
  }
}
