import { useEffect, useState } from "react"
import { leaders } from "../api/games"
import type { Leader } from "../api/protocol"
export function useLeaderboard() {
  const [mode, updateMode] = useState("versus"),
    [period, updatePeriod] = useState("all"),
    [rows, setRows] = useState<Leader[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const load = () =>
      leaders(mode, period, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) {
            setRows(data)
            setError("")
          }
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted)
            setError(reason instanceof Error ? reason.message : "Не удалось загрузить результаты.")
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    void load()
    const timer = setInterval(() => {
      if (!document.hidden) void load()
    }, 5000)
    return () => {
      clearInterval(timer)
      controller.abort()
    }
  }, [mode, period, retry])
  const setMode = (value: string) => {
    if (value === mode) return
    setLoading(true)
    setError("")
    updateMode(value)
  }
  const setPeriod = (value: string) => {
    if (value === period) return
    setLoading(true)
    setError("")
    updatePeriod(value)
  }
  const reload = () => {
    setLoading(true)
    setError("")
    setRetry((v) => v + 1)
  }
  return { mode, setMode, period, setPeriod, rows, error, loading, reload }
}
