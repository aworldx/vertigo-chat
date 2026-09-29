import { HistoryPeriodFields } from "./HistoryPeriodFields"
import { historyPreset } from "../model/historyPeriod"
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
      className="chat-message-entry flex min-w-0 items-start gap-2 py-0.5 text-sm leading-5"
    >
      <div className="min-w-0 flex-1 break-words">
        <time dateTime={message.sent_at} className="mr-2 text-[11px] not-italic text-zinc-500">
          {timestamp.format(new Date(message.sent_at))} МСК
        </time>
        {message.kind === "system" ? (
          <span className="text-xs text-zinc-500">{message.body}</span>
        ) : (
          <>
            <span className="chat-message-author mr-1 font-semibold" style={appearanceStyle(message.appearance)}>
              {message.author}:
            </span>
            <span className="chat-message-body whitespace-pre-wrap" style={appearanceStyle(message.appearance)}>
              {message.kind === "tetris" ? "Приглашение в Тетрис" : <MessageBody body={message.body} emojis={[]} />}
            </span>
          </>
        )}
      </div>
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
          className="flex size-6 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-red-300 disabled:opacity-50"
        >
          <Icon name="trash" className="size-4" />
        </button>
      )}
    </li>
  )
}
export function MessageHistory({ csrf }: { csrf?: string | undefined }) {
  const [from, setFrom] = useState(() => historyPreset("today").from)
  const [through, setThrough] = useState(() => historyPreset("today").through)
  const [author, setAuthor] = useState("")
  const [recipient, setRecipient] = useState("")
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
          скрыты. Выбери даты и время по Москве.
        </p>
        <a href="/help" target="vertigo-help" className="mt-2 inline-block text-sm text-amber-300 underline">
          Помощь по просмотру истории
        </a>
        <form
          id="history-period"
          className="my-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void search({ from, through, author: author.trim(), recipient: recipient.trim() })
          }}
        >
          <HistoryPeriodFields from={from} through={through} onFrom={setFrom} onThrough={setThrough} />
          <label className="grid min-w-0 gap-1 text-sm" htmlFor="history-author">
            Фразы от кого
            <input
              id="history-author"
              type="text"
              maxLength={24}
              value={author}
              placeholder="Любой автор"
              aria-describedby="history-filter-help"
              onChange={(event) => {
                setAuthor(event.target.value)
              }}
              className="w-full rounded border border-zinc-700 bg-zinc-900 p-2"
            />
          </label>
          <label className="grid min-w-0 gap-1 text-sm" htmlFor="history-recipient">
            Фразы кому
            <input
              id="history-recipient"
              type="text"
              maxLength={24}
              value={recipient}
              placeholder="Любой адресат"
              aria-describedby="history-filter-help"
              onChange={(event) => {
                setRecipient(event.target.value)
              }}
              className="w-full rounded border border-zinc-700 bg-zinc-900 p-2"
            />
          </label>
          <p id="history-filter-help" className="w-full text-xs text-zinc-400">
            Ники целиком, без учёта регистра. Оба поля необязательны и работают вместе. «Кому» — адресат публичного
            обращения. Очисти поле, чтобы снять фильтр, и нажми «Показать историю».
          </p>
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
              Период: {period.from.replace("T", " ")} — {period.through.replace("T", " ")} (МСК)
              {period.author && <> · От: {period.author}</>}
              {period.recipient && <> · Кому: {period.recipient}</>}
            </p>
            {page.data.length === 0 ? (
              <p>За этот период сообщений нет. Сообщения старше трёх месяцев и удалённые сообщения недоступны.</p>
            ) : (
              <ol id="history-messages" className="space-y-1">
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
