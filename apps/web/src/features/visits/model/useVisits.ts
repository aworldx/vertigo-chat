import { useEffect, useState } from "react"
import { loadVisits, type Visit } from "../api/visits"
export function useVisits() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void loadVisits(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setVisits(result.data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Не удалось загрузить историю. Попробуй ещё раз.")
          setLoading(false)
        }
      })
    return () => {
      controller.abort()
    }
  }, [attempt])
  return {
    visits,
    loading,
    error,
    retry: () => {
      setLoading(true)
      setError("")
      setAttempt((value) => value + 1)
    },
  }
}
