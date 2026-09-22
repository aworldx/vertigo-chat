import { useEffect, useState } from "react"
import { getEmojis, type Emoji } from "../api/emojis"
export function useEmojis() {
  const [emojis, setEmojis] = useState<Emoji[]>([]),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void getEmojis(controller.signal)
      .then((data) => {
        setEmojis(data)
        setError("")
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Не удалось загрузить смайлы.")
      })
    return () => {
      controller.abort()
    }
  }, [revision])
  return {
    emojis,
    error,
    retry: () => {
      setRevision((r) => r + 1)
    },
  }
}
