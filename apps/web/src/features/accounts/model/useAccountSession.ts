import { useCallback, useEffect, useRef, useState } from "react"
import { getSession, logout, type Session } from "../api/accounts"

export function useAccountSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const active = useRef<AbortController | null>(null)
  const refresh = useCallback(() => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    return getSession(controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) {
          setSession(value)
          setError("")
        }
      },
      () => {
        if (!controller.signal.aborted) setError("Не удалось загрузить сессию. Попробуй ещё раз.")
      },
    )
  }, [])
  useEffect(() => {
    void refresh()
    const channel = new BroadcastChannel("vertigo-account")
    const update = () => {
      void refresh()
    }
    channel.addEventListener("message", update)
    window.addEventListener("focus", update)
    return () => {
      active.current?.abort()
      channel.close()
      window.removeEventListener("focus", update)
    }
  }, [refresh])
  const signOut = async () => {
    if (!session) return
    setPending(true)
    try {
      await logout(session.csrf_token)
      setSession(null)
      const channel = new BroadcastChannel("vertigo-account")
      channel.postMessage("changed")
      channel.close()
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось выйти.")
    } finally {
      setPending(false)
    }
  }
  return { session, error, pending, refresh, signOut }
}
