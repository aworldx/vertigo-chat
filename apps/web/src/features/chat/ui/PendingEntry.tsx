import type { PendingMessage } from "../model/storage"
export function PendingEntry({
  message,
  nickname,
  onRetry,
  onCancel,
}: {
  message: PendingMessage
  nickname: string
  onRetry: (id: string) => void
  onCancel: (id: string) => void
}) {
  const failed = message.state === "failed"
  const blocked = message.state === "blocked"
  return (
    <article
      id={`pending-message-${message.client_id}`}
      data-client-id={message.client_id}
      data-delivery-state={message.state}
      className="chat-message-entry relative rounded border border-dashed border-zinc-700 bg-zinc-900/70 px-3 pb-2 pt-5 opacity-80"
    >
      <span className="chat-message-author absolute -top-2 left-2 max-w-[65%] truncate rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] font-semibold leading-4 text-amber-200">
        {nickname}
      </span>
      <p className="chat-message-body break-words pr-12 text-sm leading-5 text-zinc-200">{message.body}</p>
      <div
        className={
          failed || blocked
            ? "mt-1 flex items-center gap-2 text-[11px] text-zinc-500"
            : "absolute right-2 top-1 text-[11px] text-zinc-500"
        }
      >
        <span
          aria-hidden="true"
          className={`inline-flex min-w-3 justify-center font-bold leading-none ${failed || blocked ? "text-red-400" : "text-zinc-500"}`}
        >
          {failed || blocked ? "!" : message.state === "confirmed" ? "✓✓" : "✓"}
        </span>
        <span className="sr-only">
          {blocked
            ? "Заблокировано лимитом — сообщение видно только вам"
            : message.state === "confirmed"
              ? "Принято сервером — ожидает публикации в истории"
              : failed
                ? "Не отправлено"
                : message.state === "retrying"
                  ? "Сохранено на устройстве — ждёт восстановления связи"
                  : "Сохранено на устройстве — отправляется на сервер"}
        </span>
        {blocked && <span className="text-red-300">Заблокировано лимитом</span>}
        {failed && (
          <>
            <button
              id={`retry-message-${message.client_id}`}
              type="button"
              onClick={() => {
                onRetry(message.client_id)
              }}
              className="font-semibold text-amber-200 hover:underline"
            >
              Повторить
            </button>
            <button
              id={`cancel-message-${message.client_id}`}
              type="button"
              onClick={() => {
                onCancel(message.client_id)
              }}
              className="text-zinc-400 hover:text-zinc-200 hover:underline"
            >
              Удалить
            </button>
          </>
        )}
      </div>
    </article>
  )
}
