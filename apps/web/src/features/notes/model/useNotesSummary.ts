import { useEffect, useState } from "react"
import { notesSummary } from "../api/notes"
export function useNotesSummary(enabled: boolean) {
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void notesSummary(controller.signal)
      .then((value) => {
        setUnread(value)
      })
      .catch(() => {
        setUnread(0)
      })
    return () => {
      controller.abort()
    }
  }, [enabled])
  return unread
}
