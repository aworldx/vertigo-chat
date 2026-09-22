import { useCallback, useEffect, useRef, useState } from "react"
import { listTracks, changeTrack, type Track } from "../api/chart"
export function useChart(csrf: string) {
  const [tracks, setTracks] = useState<Track[]>([]),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false)
  const active = useRef<AbortController | null>(null)
  const refresh = useCallback(() => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    return listTracks(controller.signal).then(
      (items) => {
        if (!controller.signal.aborted) setTracks(items)
      },
      (reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Не удалось загрузить хит-парад.")
      },
    )
  }, [])
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => {
      void refresh()
    }, 3000)
    return () => {
      clearInterval(timer)
      active.current?.abort()
    }
  }, [refresh, csrf])
  const mutate = async (path: string, method: string, body: FormData | object) => {
    if (pending) return false
    setPending(true)
    setError("")
    try {
      await changeTrack(path, method, body, csrf)
      await refresh()
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить.")
      return false
    } finally {
      setPending(false)
    }
  }
  return { tracks, error, pending, mutate }
}
