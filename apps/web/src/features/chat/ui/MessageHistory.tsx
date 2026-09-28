import { Icon } from "../../../shared/ui/Icon"
import { useHistoryModeration } from "../model/useHistoryModeration"
import { useState } from "react"
import { useMessageHistory } from "../model/useMessageHistory"
import type { Message } from "../api/protocol"
import { appearanceStyle } from "./MessagePresentation"
import { MessageBody } from "./MessageEntry"
const timestamp = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Europe/Moscow",
  dateStyle: "short",
  timeStyle: "medium",
})
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
function HistoryEntry({
  message,
  onDelete,
  deleting,
}: {
  message: Message
  onDelete?: ((id: number) => void) | undefined
  deleting: boolean
}) {
  return (
    <li
      id={`history-message-${String(message.id)}`}
      data-message-kind={message.kind}
      data-message-font={message.font_id}
      data-message-font-style={message.font_style}
      className="chat-message-entry min-w-0 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
    >
      <time dateTime={message.sent_at} className="mb-1 block text-xs text-zinc-500">
        {timestamp.format(new Date(message.sent_at))} МСК
      </time>
      {message.kind === "system" ? (
        <p className="text-sm text-zinc-400">{message.body}</p>
      ) : (
        <>
          <span className="chat-message-author font-semibold" style={appearanceStyle(message.appearance)}>
            {message.author}
          </span>
          <p
            className="chat-message-body whitespace-pre-wrap break-words text-sm"
            style={appearanceStyle(message.appearance)}
          >
            {message.kind === "tetris" ? "Приглашение в Тетрис" : <MessageBody body={message.body} emojis={[]} />}
          </p>
        </>
      )}
      {onDelete && message.kind !== "system" && (
        <button
          type="button"
          id={`history-delete-${String(message.id)}`}
          aria-label="Удалить сообщение"
          title="Удалить для всех"
          disabled={deleting}
          onClick={() => {
            onDelete(message.id)
          }}
          className="mt-2 flex size-8 items-center justify-center rounded border border-zinc-700 text-zinc-400 hover:border-red-300 hover:text-red-300 disabled:opacity-50"
        >
          <Icon name="trash" className="size-4" />
        </button>
      )}
    </li>
  )
}
export function MessageHistory({ csrf }: { csrf?: string | undefined }) {
  const [from, setFrom] = useState(today)
  const [through, setThrough] = useState(today)
  const { page, period, loading, error, search, removed } = useMessageHistory()
  const moderation = useHistoryModeration(csrf, removed)
  return (
    <div className="min-h-screen bg-zinc-950">
      <main id="message-history-page" className="mx-auto min-h-screen max-w-4xl px-4 py-6 text-zinc-200">
        <a href="/chat" className="text-sm text-amber-300 hover:underline">
          ← В чат
        </a>
        <h1 className="mt-4 text-2xl font-semibold">История сообщений</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Публичные сообщения и системные события за три календарных месяца. Личные сообщения и персональные подсказки
          скрыты. Даты включены целиком, время московское.
        </p>
        <a href="/help" target="vertigo-help" className="mt-2 inline-block text-sm text-amber-300 underline">
          Помощь по просмотру истории
        </a>
        <form
          id="history-period"
          className="my-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void search({ from, through })
          }}
        >
          <label className="grid gap-1 text-sm" htmlFor="history-from">
            С
            <input
              id="history-from"
              type="date"
              required
              value={from}
              max={through || today()}
              onChange={(event) => {
                setFrom(event.target.value)
              }}
              className="rounded border border-zinc-700 bg-zinc-900 p-2"
            />
          </label>
          <label className="grid gap-1 text-sm" htmlFor="history-through">
            По
            <input
              id="history-through"
              type="date"
              required
              value={through}
              min={from}
              max={today()}
              onChange={(event) => {
                setThrough(event.target.value)
              }}
              className="rounded border border-zinc-700 bg-zinc-900 p-2"
            />
          </label>
          <button
            id="history-search"
            type="submit"
            disabled={loading}
            className="rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-200 disabled:opacity-50"
          >
            Показать историю
          </button>
        </form>
        <div role="status" aria-live="polite" className="mb-4 text-sm text-zinc-400">
          {loading
            ? "Загружаем историю…"
            : page
              ? `На странице: ${String(page.data.length)}. От старых к новым.`
              : "Выбери период и нажми «Показать историю»."}
        </div>
        {moderation.error && (
          <p role="alert" className="mb-4 text-red-400">
            {moderation.error}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 text-red-400">
            {error}
          </p>
        )}
        {page && period && (
          <section aria-label="Сообщения за выбранный период" aria-busy={loading}>
            <p className="mb-3 text-sm text-zinc-400">
              Период: {period.from} — {period.through} (МСК)
            </p>
            {page.data.length === 0 ? (
              <p>За этот период сообщений нет. Сообщения старше трёх месяцев и удалённые сообщения недоступны.</p>
            ) : (
              <ol id="history-messages" className="space-y-3">
                {page.data.map((message) => (
                  <HistoryEntry
                    key={message.id}
                    message={message}
                    deleting={moderation.deleting !== null}
                    onDelete={
                      csrf
                        ? (id) => {
                            void moderation.remove(id)
                          }
                        : undefined
                    }
                  />
                ))}
              </ol>
            )}
            {page.next !== null && (
              <button
                id="history-next"
                type="button"
                disabled={loading}
                className="my-5 rounded border border-zinc-600 px-4 py-2 hover:border-amber-300 disabled:opacity-50"
                onClick={() => {
                  void search(period, page.next ?? 0)
                }}
              >
                Следующие 100
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
