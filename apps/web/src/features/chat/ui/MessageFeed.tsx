import type { Message } from "../api/protocol"
import type { PendingMessage } from "../model/storage"
import { useMessageScroll } from "../model/useMessageScroll"
import { MessageEntry } from "./MessageEntry"
import { PendingEntry } from "./PendingEntry"
export function MessageFeed({
  messages,
  outbox,
  nickname,
  onAddress,
  onRetry,
  onCancel,
}: {
  messages: Message[]
  outbox: PendingMessage[]
  nickname: string
  onAddress: (nickname: string) => void
  onRetry: (id: string) => void
  onCancel: (id: string) => void
}) {
  const list = useMessageScroll()
  return (
    <div
      id="messages"
      ref={list}
      role="log"
      aria-label="Сообщения чата"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3"
    >
      {messages.map((message) => (
        <MessageEntry key={message.id} message={message} nickname={nickname} onAddress={onAddress} />
      ))}
      <div id="pending-messages" className="order-last" aria-live="polite">
        {outbox.map((message) => (
          <PendingEntry
            key={message.client_id}
            message={message}
            nickname={nickname}
            onRetry={onRetry}
            onCancel={onCancel}
          />
        ))}
      </div>
    </div>
  )
}
