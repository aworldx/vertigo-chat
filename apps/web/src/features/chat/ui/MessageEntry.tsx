import { useState } from "react"
import { appearanceStyle, MessageTime } from "./MessagePresentation"
import { MediaBody } from "./MediaBody"
import { Icon } from "../../../shared/ui/Icon"
import type { Emoji } from "../api/emojis"
import type { Peer } from "../api/protocol"
import type { Message } from "../api/protocol"
import type { DeliveryState } from "../model/delivery"

const deliveryLabels: Record<DeliveryState, string> = {
  sending: "Сообщение отправляется",
  retrying: "Сообщение ждёт восстановления связи",
  confirmed: "Принято сервером — ожидает публикации в истории",
  blocked: "Заблокировано лимитом",
  failed: "Не отправлено",
  published: "Опубликовано в истории",
}

function DeliveryStatus({
  state,
  id,
  onRetry,
  onCancel,
}: {
  state: DeliveryState
  id: string
  onRetry?: (() => void) | undefined
  onCancel?: (() => void) | undefined
}) {
  const marker =
    state === "failed" || state === "blocked" ? "!" : state === "retrying" ? "↻" : state === "sending" ? "✓" : "✓✓"
  const color =
    state === "failed" || state === "blocked"
      ? "text-red-400"
      : state === "published"
        ? "text-sky-400"
        : "text-zinc-500"
  return (
    <span
      id={`message-delivery-${id}`}
      data-delivery-state={state}
      className={`absolute right-2 top-1 text-[11px] font-bold leading-none ${color}`}
      aria-label={deliveryLabels[state]}
    >
      <span aria-hidden="true">{marker}</span>
      <span className="sr-only">{deliveryLabels[state]}</span>
      {state === "failed" && (
        <>
          <button type="button" onClick={onRetry} className="ml-1 font-semibold text-amber-200 hover:underline">
            Повторить
          </button>
          <button type="button" onClick={onCancel} className="ml-1 text-zinc-400 hover:text-zinc-200 hover:underline">
            Удалить
          </button>
        </>
      )}
    </span>
  )
}

function MessageBody({ body, emojis }: { body: string; emojis: Emoji[] }) {
  const codes = new Map(emojis.map((e) => [e.code, e]))
  return body.split(/((?:https?:\/\/|www\.)[^\s<>"']+|:[\p{Ll}\p{Nd}_]{2,30}:)/giu).map((part, index) =>
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
    ) : codes.has(part) ? (
      <img
        key={index}
        src={`/emojis/${String(codes.get(part)?.id)}`}
        alt={part}
        className="inline-block h-auto w-auto max-h-8 max-w-8 align-text-bottom"
      />
    ) : (
      part
    ),
  )
}
export function MessageEntry({
  message,
  nickname,
  onAddress,
  frame = true,
  emojis = [],
  peers = [],
  onReaction,
  onDelete,
  delivery,
  domID,
  onRetry,
  onCancel,
}: {
  onReaction?: ((id: number, emoji: string, active: boolean) => void) | undefined
  onDelete?: ((id: number) => void) | undefined
  delivery?: DeliveryState | undefined
  domID?: string | undefined
  onRetry?: (() => void) | undefined
  onCancel?: (() => void) | undefined
  frame?: boolean
  emojis?: Emoji[]
  peers?: Peer[]
  message: Message
  nickname: string
  onAddress: (nickname: string) => void
}) {
  const [reactionsOpen, setReactionsOpen] = useState(false)
  const privateMessage = message.kind === "private"
  const addressed = message.recipient === nickname
  const mediaLayout = message.kind === "music" || message.kind === "youtube"
  const system = message.kind === "system"
  if (privateMessage) frame = true
  const entryID = domID ?? String(message.id)
  return (
    <div
      id={`message-${entryID}`}
      data-message-id={message.id}
      data-client-id={message.client_id}
      data-message-kind={message.kind}
      data-private={privateMessage}
      data-addressed-to-me={addressed}
      data-message-font={message.font_id}
      data-message-font-style={message.font_style}
      data-message-frame={frame}
      className={`chat-message-entry group/message relative transition-colors ${system ? "px-3 py-0.5 text-center" : message.kind === "music" ? `ml-auto w-full max-w-xl ${frame ? "border-zinc-700 bg-zinc-950/90 px-3 py-2.5" : "px-1"}` : message.kind === "youtube" ? "ml-auto w-full max-w-sm" : frame ? `rounded border px-3 pb-2 pt-5 shadow-sm ${addressed ? "border-amber-300 bg-amber-300/20 ring-1 ring-inset ring-amber-200/30" : privateMessage ? "border-sky-400/50 bg-sky-400/10" : "border-zinc-800 bg-zinc-900"}` : addressed ? "px-1 rounded bg-amber-300/20" : "px-1"} ${message.kind === "gif" ? "ml-auto w-fit max-w-full" : ""}`}
    >
      {system ? (
        <p className="inline-flex items-center gap-2 text-xs leading-4 text-zinc-500">
          <span>{message.body}</span>
          <MessageTime message={message} className="text-[10px] text-zinc-600" />
        </p>
      ) : mediaLayout ? (
        <MediaBody message={message} onAddress={onAddress} />
      ) : !frame && message.kind === "gif" ? (
        <MediaBody message={message} onAddress={onAddress} frame={false} />
      ) : !frame ? (
        <p className="break-words text-sm leading-5" data-compact-message>
          <button
            type="button"
            onDoubleClick={() => {
              onAddress(`^${message.author}`)
            }}
            onClick={() => {
              onAddress(message.author)
            }}
            className="chat-message-author font-semibold hover:underline"
            style={appearanceStyle(message.appearance)}
          >
            {message.author}:
          </button>
          <span className="chat-message-body" style={appearanceStyle(message.appearance)}>
            {" "}
            <MessageBody body={message.body} emojis={emojis} />
          </span>
        </p>
      ) : (
        <>
          <button
            id={`message-author-${entryID}`}
            type="button"
            onDoubleClick={() => {
              onAddress(`^${message.author}`)
            }}
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
            id={entryID}
            className={`absolute top-1 text-[10px] text-zinc-500 ${delivery ? "right-8" : "right-2"}`}
          />
          {delivery && <DeliveryStatus state={delivery} id={entryID} onRetry={onRetry} onCancel={onCancel} />}
          {privateMessage && (
            <p className="mb-0.5 pr-12 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              {message.recipient === nickname ? "Лично вам" : `Лично для ${message.recipient}`}
            </p>
          )}
          {["music", "gif", "youtube"].includes(message.kind) ? (
            <MediaBody message={message} onAddress={onAddress} />
          ) : (
            <p
              className="chat-message-body break-words pr-12 text-sm leading-5"
              style={appearanceStyle(message.appearance)}
            >
              <AddressedBody body={message.body} emojis={emojis} peers={peers} />
            </p>
          )}
        </>
      )}
      {!system && !privateMessage && frame && (
        <div className="absolute -bottom-2.5 right-2 z-20 flex max-w-[90%] flex-wrap items-center justify-end gap-1">
          {Object.entries(message.reactions)
            .filter(([, count]) => count > 0)
            .map(([emoji, count]) => (
              <button
                key={emoji}
                type="button"
                aria-pressed={message.reacted.includes(emoji)}
                disabled={message.author === nickname}
                onClick={() => onReaction?.(message.id, emoji, !message.reacted.includes(emoji))}
                className={`chat-reaction-entry inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] shadow-sm transition ${
                  message.reacted.includes(emoji)
                    ? "border-amber-300/70 bg-amber-950 text-amber-100"
                    : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {emoji} {count}
              </button>
            ))}
          {onReaction && message.author !== nickname && (
            <button
              type="button"
              aria-label="Добавить реакцию"
              onClick={() => {
                setReactionsOpen(!reactionsOpen)
              }}
              className="flex size-5 cursor-pointer items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-400 shadow-sm transition hover:border-amber-300/60 hover:text-amber-200"
            >
              <Icon name="face-smile" className="size-3" />
            </button>
          )}
          {reactionsOpen &&
            ["👍", "❤️", "😂", "😮", "😢", "🔥"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={emoji}
                onClick={() => {
                  onReaction?.(message.id, emoji, !message.reacted.includes(emoji))
                  setReactionsOpen(false)
                }}
              >
                {emoji}
              </button>
            ))}
          {onDelete && (
            <button
              type="button"
              aria-label="Удалить сообщение"
              onClick={() => {
                if (window.confirm("Удалить это сообщение для всех?")) onDelete(message.id)
              }}
              className="text-xs text-red-300 opacity-0 group-hover/message:opacity-100 focus:opacity-100"
            >
              Удалить
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function AddressedBody({ body, emojis, peers }: { body: string; emojis: Emoji[]; peers: Peer[] }) {
  const match = Array.from(body.matchAll(/[\p{L}\p{N}_-]+,/gu)).find((value) =>
    peers.some((peer) => peer.nickname === value[0].slice(0, -1)),
  )
  const peer = peers.find((value) => value.nickname === match?.[0].slice(0, -1))
  if (!match || !peer) return <MessageBody body={body} emojis={emojis} />
  return (
    <>
      <MessageBody body={body.slice(0, match.index)} emojis={emojis} />
      <strong className="chat-message-recipient font-semibold" style={appearanceStyle(peer.preferences.appearance)}>
        {match[0]}
      </strong>
      <MessageBody body={body.slice(match.index + match[0].length)} emojis={emojis} />
    </>
  )
}
