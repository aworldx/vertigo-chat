import type { useHistorySummary } from "../model/useHistorySummary"

export function HistorySummary({ summary }: { summary: ReturnType<typeof useHistorySummary> }) {
  const result = summary.result
  return (
    <div aria-live="polite" aria-busy={summary.loading}>
      {summary.loading && (
        <p role="status" className="mb-4 text-sm text-amber-200">
          Готовим AI-саммари выбранного периода…
        </p>
      )}
      {summary.error && (
        <p role="alert" className="mb-4 text-sm text-red-300">
          {summary.error}
        </p>
      )}
      {result && (
        <section
          id="history-summary"
          aria-label="AI-саммари выбранного периода"
          className="mb-5 rounded-xl border border-amber-300/30 bg-zinc-900 p-4"
        >
          <h2 className="text-lg font-semibold text-amber-200">AI-саммари</h2>
          <p className="mt-2 break-words text-sm text-zinc-400">
            {result.period.from.replace("T", " ")} — {result.period.through.replace("T", " ")} (МСК)
            {result.period.author && <> · От: {result.period.author}</>}
            {result.period.recipient && <> · Кому: {result.period.recipient}</>}
            {" · "}Сообщений: {String(result.data.messages)}
          </p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{result.data.summary}</p>
        </section>
      )}
    </div>
  )
}
