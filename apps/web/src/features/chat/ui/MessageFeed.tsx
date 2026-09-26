import { Fragment, type ReactNode } from "react"
import type { Emoji } from "../api/emojis"
import { KarmikHelp } from "./KarmikHelp"
import type { HelpTopic, Peer } from "../api/protocol"
import type { TimelineEntry } from "../model/timeline"
import { useMessageScroll } from "../model/useMessageScroll"
import { MessageEntry } from "./MessageEntry"
import { SharedMedia } from "./SharedMedia"
import { mergeMediaTimeline, type PositionedFile } from "../model/mediaTimeline"
import { FeedContentContext } from "./feedContent"

export function MessageFeed({
  help = [],
  onSettings,
  entries,
  nickname,
  onAddress,
  frame = true,
  emojis = [],
  peers = [],
  children,
  files = [],
  onRequestFile,
  onReaction,
  onDelete,
  onRetry,
  onCancel,
}: {
  help?: { messageID: number; topics: HelpTopic[] }[]
  onSettings?: () => void
  onReaction?: (id: number, emoji: string, active: boolean) => void
  onRetry: (id: string) => void
  onCancel: (id: string) => void
  onDelete?: ((id: number) => void) | undefined
  frame?: boolean
  emojis?: Emoji[]
  peers?: Peer[]
  children?: ReactNode
  files?: PositionedFile[]
  onRequestFile?: (id: string) => void
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
        {mergeMediaTimeline(entries, files).map((item) => {
          if (item.kind === "file")
            return <SharedMedia key={item.key} file={item.file} onRequest={() => onRequestFile?.(item.file.id)} />
          const { entry } = item
          return (
            <Fragment key={entry.key}>
              <MessageEntry
                message={entry.message}
                frame={frame}
                emojis={emojis}
                peers={peers}
                nickname={nickname}
                onAddress={onAddress}
                onReaction={onReaction}
                onDelete={onDelete}
                delivery={entry.message.author === nickname ? entry.delivery : undefined}
                domID={
                  entry.message.author === nickname && entry.message.client_id ? entry.message.client_id : undefined
                }
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
              {entry.message.author === nickname &&
                help
                  .filter((hint) => hint.messageID === entry.message.id)
                  .map((hint) => (
                    <KarmikHelp
                      key={hint.messageID}
                      messageID={hint.messageID}
                      topics={hint.topics}
                      onSettings={onSettings}
                    />
                  ))}
            </Fragment>
          )
        })}
        {children}
      </FeedContentContext.Provider>
    </div>
  )
}
