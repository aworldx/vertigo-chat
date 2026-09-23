import { createContext, useContext, useLayoutEffect, type ReactNode } from "react"
import type { Emoji } from "../api/emojis"
import type { Peer } from "../api/protocol"
import type { TimelineEntry } from "../model/timeline"
import { useMessageScroll } from "../model/useMessageScroll"
import { MessageEntry } from "./MessageEntry"

const FeedContentContext = createContext<(() => void) | null>(null)

export function useFeedContentEvent(version: string | null) {
  const publishContent = useContext(FeedContentContext)
  useLayoutEffect(() => {
    if (version) publishContent?.()
  }, [publishContent, version])
}

export function MessageFeed({
  entries,
  nickname,
  onAddress,
  frame = true,
  emojis = [],
  peers = [],
  children,
  onReaction,
  onDelete,
  onRetry,
  onCancel,
}: {
  onReaction?: (id: number, emoji: string, active: boolean) => void
  onRetry: (id: string) => void
  onCancel: (id: string) => void
  onDelete?: ((id: number) => void) | undefined
  frame?: boolean
  emojis?: Emoji[]
  peers?: Peer[]
  children?: ReactNode
  entries: TimelineEntry[]
  nickname: string
  onAddress: (nickname: string) => void
}) {
  const entryVersion = entries.map((entry) => `${entry.key}:${entry.delivery}`).join(",")
  const { list, publishContent } = useMessageScroll(entryVersion)
  return (
    <div
      id="messages"
      ref={list}
      role="log"
      aria-label="Сообщения чата"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3"
    >
      <FeedContentContext.Provider value={publishContent}>
        {entries.map((entry) => (
          <MessageEntry
            key={entry.key}
            message={entry.message}
            frame={frame}
            emojis={emojis}
            peers={peers}
            nickname={nickname}
            onAddress={onAddress}
            onReaction={onReaction}
            onDelete={onDelete}
            delivery={entry.message.author === nickname ? entry.delivery : undefined}
            domID={entry.message.author === nickname && entry.message.client_id ? entry.message.client_id : undefined}
            onRetry={
              entry.delivery === "failed"
                ? () => {
                    onRetry(entry.message.client_id)
                  }
                : undefined
            }
            onCancel={
              entry.delivery === "failed"
                ? () => {
                    onCancel(entry.message.client_id)
                  }
                : undefined
            }
          />
        ))}
        {children}
      </FeedContentContext.Provider>
    </div>
  )
}
