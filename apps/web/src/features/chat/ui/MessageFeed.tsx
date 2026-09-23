import type { ReactNode } from "react"
import type { Emoji } from "../api/emojis"
import type { Peer } from "../api/protocol"
import type { Message } from "../api/protocol"
import type { PendingMessage } from "../model/storage"
import { useMessageScroll } from "../model/useMessageScroll"
import { MessageEntry } from "./MessageEntry"

type FeedItem = {
  delivery?: PendingMessage["state"] | "published" | undefined
  domID?: string | undefined
  key: string
  message: Message
}

function pendingMessage(
  message: PendingMessage,
  nickname: string,
  appearance: Message["appearance"],
  fontID: Message["font_id"],
  fontStyle: Message["font_style"],
): Message {
  return {
    id: 0,
    client_id: message.client_id,
    kind: "text",
    author: nickname,
    body: message.body,
    sent_at: message.sent_at,
    recipient: "",
    reactions: {},
    reacted: [],
    appearance,
    font_id: fontID,
    font_style: fontStyle,
  }
}
export function MessageFeed({
  messages,
  outbox,
  nickname,
  onAddress,
  frame = true,
  emojis = [],
  peers = [],
  children,
  onReaction,
  onDelete,
  appearance,
  fontID,
  fontStyle,
  onRetry,
  onCancel,
}: {
  appearance: Message["appearance"]
  onReaction?: (id: number, emoji: string, active: boolean) => void
  onRetry: (id: string) => void
  onCancel: (id: string) => void
  onDelete?: ((id: number) => void) | undefined
  frame?: boolean
  fontID: Message["font_id"]
  fontStyle: Message["font_style"]
  emojis?: Emoji[]
  peers?: Peer[]
  children?: ReactNode
  messages: Message[]
  outbox: PendingMessage[]
  nickname: string
  onAddress: (nickname: string) => void
}) {
  const pendingByClientID = new Map(outbox.map((message) => [message.client_id, message]))
  const receivedClientIDs = new Set(messages.map((message) => message.client_id).filter(Boolean))
  const items: FeedItem[] = messages.map((message) => {
    const pending = pendingByClientID.get(message.client_id)
    const outgoing = message.author === nickname && message.client_id !== ""
    return {
      key: outgoing ? `client:${message.client_id}` : `message:${String(message.id)}`,
      domID: outgoing ? message.client_id : undefined,
      message,
      delivery: outgoing ? (pending?.state ?? "published") : undefined,
    }
  })
  for (const pending of outbox) {
    if (receivedClientIDs.has(pending.client_id)) continue
    items.push({
      key: `client:${pending.client_id}`,
      domID: pending.client_id,
      message: pendingMessage(pending, nickname, appearance, fontID, fontStyle),
      delivery: pending.state,
    })
  }
  const entryVersion = items.map((item) => item.key).join(",")
  const list = useMessageScroll(entryVersion)
  return (
    <div
      id="messages"
      ref={list}
      role="log"
      aria-label="Сообщения чата"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3"
    >
      {items.map((item) => (
        <MessageEntry
          key={item.key}
          message={item.message}
          frame={frame}
          emojis={emojis}
          peers={peers}
          nickname={nickname}
          onAddress={onAddress}
          onReaction={onReaction}
          onDelete={onDelete}
          delivery={item.delivery}
          domID={item.domID}
          onRetry={
            item.delivery === "failed"
              ? () => {
                  onRetry(item.message.client_id)
                }
              : undefined
          }
          onCancel={
            item.delivery === "failed"
              ? () => {
                  onCancel(item.message.client_id)
                }
              : undefined
          }
        />
      ))}
      {children}
    </div>
  )
}
