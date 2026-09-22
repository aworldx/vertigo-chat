import { useEffect, useRef, useState } from "react"
import { searchMedia, type MediaItem } from "../api/media"
export function useMediaSearch(generation: number, publish: (item: MediaItem) => void) {
  const [result, setResult] = useState<{
    time: string
    page: number
    kind: MediaItem["kind"]
    query: string
    items: MediaItem[]
    loading: boolean
    error: string
  } | null>(null)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  const search = (kind: MediaItem["kind"], query: string) => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    const time = new Date().toISOString()
    setResult({ time, page: 1, kind, query, items: [], loading: true, error: "" })
    void searchMedia(kind, query, generation, controller.signal).then(
      (items) => {
        if (controller.signal.aborted) return
        const first = items[0]
        if (kind === "youtube" && items.length === 1 && first?.source === query && /^https?:\/\//u.test(query)) {
          publish(first)
          setResult(null)
        } else setResult({ time, page: 1, kind, query, items, loading: false, error: "" })
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            time,
            page: 1,
            kind,
            query,
            items: [],
            loading: false,
            error: error instanceof Error ? error.message : "Поиск недоступен.",
          })
      },
    )
  }
  return {
    result,
    search,
    close: () => {
      active.current?.abort()
      setResult(null)
    },
    page: (page: number) => {
      setResult((previous) => (previous ? { ...previous, page } : previous))
    },
  }
}
