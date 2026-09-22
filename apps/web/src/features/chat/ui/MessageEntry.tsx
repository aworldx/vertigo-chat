import type { CSSProperties } from "react"
import type { Message } from "../api/protocol"

function appearanceStyle(appearance: Message["appearance"]): CSSProperties & Record<`--${string}`, string> {
  return {
    "--nick-dark": appearance.dark.nickname_color,
    "--text-dark": appearance.dark.text_color,
    "--nick-light": appearance.light.nickname_color,
    "--text-light": appearance.light.text_color,
  }
}
function MessageTime({ message, className }: { message: Message; className: string }) {
  return (
    <time id={`message-time-${String(message.id)}`} dateTime={message.sent_at} className={className}>
      {new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
        new Date(message.sent_at),
      )}
    </time>
  )
}
function MessageBody({ body }: { body: string }) {
  return body.split(/((?:https?:\/\/|www\.)[^\s<>"']+)/giu).map((part, index) =>
    /^(?:https?:\/\/|www\.)/iu.test(part) ? (
      <a
        key={index}
        href={/^www\./iu.test(part) ? `https://${part}` : part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-200 underline decoration-amber-300/50 underline-offset-2 transition hover:text-amber-100"
      >
        {part}
      </a>
    ) : (
      part
    ),
  )
}
export function MessageEntry({
  message,
  nickname,
  onAddress,
}: {
  message: Message
  nickname: string
  onAddress: (nickname: string) => void
}) {
  const system = message.kind === "system"
  const published = message.kind === "text" && message.author === nickname && message.client_id !== ""
  return (
    <div
      id={`message-${String(message.id)}`}
      data-message-id={message.id}
      data-client-id={message.client_id}
      data-message-kind={message.kind}
      data-message-font={message.font_id}
      data-message-font-style={message.font_style}
      data-message-frame="true"
      className={`chat-message-entry group/message relative transition-colors ${system ? "px-3 py-0.5 text-center" : "rounded border border-zinc-800 bg-zinc-900 px-3 pb-2 pt-5 shadow-sm"}`}
    >
      {system ? (
        <p className="inline-flex items-center gap-2 text-xs leading-4 text-zinc-500">
          <span>{message.body}</span>
          <MessageTime message={message} className="text-[10px] text-zinc-600" />
        </p>
      ) : (
        <>
          <button
            id={`message-author-${String(message.id)}`}
            type="button"
            onClick={() => {
              onAddress(message.author)
            }}
            className="chat-message-author absolute -top-2 left-2 z-10 max-w-[65%] truncate rounded-full border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] font-semibold leading-4 shadow-sm transition hover:border-zinc-500 hover:underline"
            style={appearanceStyle(message.appearance)}
          >
            {message.author}
          </button>
          <MessageTime
            message={message}
            className={`absolute top-1 text-[10px] text-zinc-500 ${published ? "right-8" : "right-2"}`}
          />
          {published && (
            <span
              id={`message-delivery-${String(message.id)}`}
              data-delivery-state="published"
              className="absolute right-2 top-1 text-[11px] font-bold leading-none text-sky-400"
              aria-label="Опубликовано в истории"
            >
              <span aria-hidden="true">✓✓</span>
            </span>
          )}
          <p
            className="chat-message-body break-words pr-12 text-sm leading-5"
            style={appearanceStyle(message.appearance)}
          >
            <MessageBody body={message.body} />
          </p>
        </>
      )}
    </div>
  )
}
