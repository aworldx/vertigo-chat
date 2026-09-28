import { useEffect, useRef, useState } from "react"
import { loadHistory, type HistoryPage, type HistoryPeriod } from "../api/history"
export function useMessageHistory() {
  const [page, setPage] = useState<HistoryPage | null>(null)
  const [period, setPeriod] = useState<HistoryPeriod | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function search(selected: HistoryPeriod, after = 0) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError("")
    if (after === 0) {
      setPage(null)
      setPeriod(selected)
    }
    try {
      const result = await loadHistory(selected, after, controller.signal)
      if (!controller.signal.aborted) setPage(result)
    } catch {
      if (!controller.signal.aborted) setError("Не удалось загрузить историю. Повтори поиск.")
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }
  return {
    page,
    period,
    loading,
    error,
    search,
    removed: (id: number) => {
      setPage((current) => (current ? { ...current, data: current.data.filter((item) => item.id !== id) } : null))
    },
  }
}
