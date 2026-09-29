import { useEffect, useRef, useState } from "react"
import { sendChartQueue, type ChartQueueTrack } from "../../../shared/chartQueue"

export function useChartQueue(nickname: string) {
  const active = useRef<AbortController | null>(null)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState("")
  useEffect(() => () => active.current?.abort(), [])
  const enqueue = async (tracks: ChartQueueTrack[]) => {
    if (active.current || !tracks.length) return
    const controller = new AbortController()
    active.current = controller
    setPending(true)
    setNotice("")
    try {
      await sendChartQueue(
        nickname,
        tracks.map(({ id, title, author }) => ({ id, title, author })),
        controller.signal,
      )
      if (!controller.signal.aborted)
        setNotice("Треки добавлены в плеер чата по порядку рейтинга. Уже добавленные записи не дублируются.")
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Не удалось добавить треки.")
    } finally {
      if (!controller.signal.aborted) {
        active.current = null
        setPending(false)
      }
    }
  }
  return { enqueue, pending, notice }
}
