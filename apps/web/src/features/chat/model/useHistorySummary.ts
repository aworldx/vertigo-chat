import { useEffect, useRef, useState } from "react"
import { summarizeHistory, type HistorySummaryResult } from "../api/historySummary"
import type { HistoryPeriod } from "../api/history"

const errors: Record<string, string> = {
  invalid_period: "Проверь выбранные дату и время.",
  forbidden: "Для AI-саммари войди на сайт и обнови страницу.",
  summary_period_too_large: "Слишком большой период для одной сводки. Сузь даты, время или фильтры и попробуй ещё раз.",
  summary_empty: "В выбранном периоде нет сообщений для сводки. Системные события и приглашения в игры пропускаются.",
  summary_busy: "AI занят или с прошлого запроса ещё не прошла минута. Попробуй немного позже.",
  summary_unavailable:
    "Не удалось подготовить саммари: AI недоступен или исчерпан общий бюджет токенов. Попробуй позже.",
}
export function useHistorySummary(csrf: string | undefined) {
  const [result, setResult] = useState<{ period: HistoryPeriod; data: HistorySummaryResult } | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const clear = () => {
    request.current?.abort()
    setResult(null)
    setError("")
    setLoading(false)
  }
  const run = async (period: HistoryPeriod) => {
    if (!csrf) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const data = await summarizeHistory(period, csrf, controller.signal)
      if (!controller.signal.aborted) setResult({ period, data })
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          errors[reason instanceof Error ? reason.message : ""] ?? "Не удалось получить саммари. Попробуй позже.",
        )
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }
  return { result, error, loading, run, clear }
}
