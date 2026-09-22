import { useEffect, useState } from "react"
import { loadRanks, type Rank } from "../api/ranks"
export function useRanks() {
  const [ranks, setRanks] = useState<Rank[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void loadRanks(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setRanks(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("Не удалось загрузить звания.")
          setLoading(false)
        }
      })
    return () => {
      controller.abort()
    }
  }, [attempt])
  return {
    ranks,
    loading,
    error,
    retry: () => {
      setError("")
      setLoading(true)
      setAttempt((value) => value + 1)
    },
  }
}
