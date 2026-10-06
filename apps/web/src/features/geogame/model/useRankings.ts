import { useEffect, useState } from "react"
import { readRankings, type GeoRanking } from "../api/rankings"
export function useRankings() {
  const [rows, setRows] = useState<GeoRanking[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const data = await readRankings(controller.signal)
        if (!controller.signal.aborted) {
          setRows(data)
          setError("")
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Не удалось загрузить рейтинг.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    const timer = window.setInterval(() => {
      if (!document.hidden) void load()
    }, 10000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [retry])
  return {
    rows,
    error,
    loading,
    reload: () => {
      setLoading(true)
      setRetry((v) => v + 1)
    },
  }
}
