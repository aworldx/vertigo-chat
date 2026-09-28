import { useState } from "react"
import { VideoSearchRow } from "./VideoSearchRow"
import { MusicSearchRow } from "./MusicSearchRow"
import { Button } from "../../../shared/ui/Button"
import { DismissTool, ToolCard } from "./ToolCard"
import type { MediaItem } from "../api/media"
import type { MediaSearchResult } from "../model/useMediaSearch"
import { useFeedContentEvent } from "./feedContent"

type SearchListProps = { items: MediaItem[]; onSend: (item: MediaItem) => void }

function GifResults({ items, onSend }: SearchListProps) {
  return (
    <div className="chat-gif-list">
      {items.map((item, index) => (
        <Button
          key={item.url}
          id={`gif-result-${String(index)}`}
          onClick={() => {
            onSend(item)
          }}
          aria-label={`Отправить GIF в чат: ${item.title}`}
          className="chat-gif-result"
        >
          <img
            src={`/gif-proxy?url=${encodeURIComponent(item.preview)}`}
            alt={item.title}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <span>Отправить в чат</span>
        </Button>
      ))}
    </div>
  )
}

function PlaybackResults({ items, onSend }: SearchListProps) {
  const [preview, setPreview] = useState<string | null>(null)
  return (
    <div className="chat-search-list">
      {items.map((item, index) =>
        item.kind === "music" ? (
          <MusicSearchRow key={item.url} item={item} index={index} onSend={onSend} />
        ) : (
          <VideoSearchRow
            key={item.url}
            item={item}
            index={index}
            onSend={onSend}
            expanded={preview === item.url}
            onToggle={() => {
              setPreview(preview === item.url ? null : item.url)
            }}
          />
        ),
      )}
    </div>
  )
}

function SearchResultList({ result, items, onSend }: SearchListProps & { result: MediaSearchResult }) {
  if (result.kind === "gif") return <GifResults items={items} onSend={onSend} />
  return <PlaybackResults items={items} onSend={onSend} />
}

export function MediaSearchResults({
  result,
  frame = true,
  onSend,
  onClose,
  onPage,
  onRetry,
}: {
  frame?: boolean
  result: MediaSearchResult | null
  onSend: (item: MediaItem) => void
  onClose: () => void
  onRetry: () => void
  onPage: (page: number) => void
}) {
  useFeedContentEvent(
    result
      ? [result.time, result.loading, result.error, result.page, ...result.items.map((item) => item.url)].join(":")
      : null,
  )
  if (!result) return null
  const label = result.kind === "gif" ? "GIF" : result.kind === "music" ? "музыки" : "YouTube"
  const pages = result.kind === "music" ? Math.ceil(result.items.length / 5) : 1
  const items = result.kind === "music" ? result.items.slice((result.page - 1) * 5, result.page * 5) : result.items
  const title = `Поиск ${label}`
  const body = result.loading
    ? `Ищу «${result.query}»…`
    : result.error ||
      (items.length === 0
        ? `По запросу «${result.query}» ничего не найдено. Попробуй другой запрос.`
        : result.kind === "gif"
          ? "Нажми «Отправить в чат» под GIF — её увидят все в комнате."
          : "Воспроизведение и очередь — только для тебя. «Отправить в чат» публикует запись для всех.")
  return (
    <div
      data-message-kind="command"
      data-message-frame={frame}
      className={`chat-message-entry group/message relative px-1 py-1 transition-colors ${frame ? "border-zinc-800 bg-zinc-900" : ""}`}
    >
      <ToolCard
        id="media-search-results"
        tabIndex={-1}
        aria-label={title}
        data-command-result={result.kind === "youtube" ? "youtube_search" : result.kind}
        title={title}
        description={`Только ты видишь результаты · «${result.query}»`}
        actions={<DismissTool id="dismiss-media-search" label={`Закрыть поиск ${label}`} onClick={onClose} />}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation()
            onClose()
          }
        }}
      >
        <p
          className={
            result.kind !== "gif" && items.length > 0 && !result.error && !result.loading
              ? "sr-only"
              : "chat-tool-status"
          }
          role={result.loading ? "status" : result.error ? "alert" : undefined}
        >
          {body}
        </p>
        {result.error && (
          <div className="chat-tool-actions">
            <Button
              id="retry-media-search"
              onClick={(event) => {
                event.currentTarget.closest("section")?.focus()
                onRetry()
              }}
            >
              Повторить поиск
            </Button>
          </div>
        )}
        {items.length > 0 && <SearchResultList result={result} items={items} onSend={onSend} />}
        {pages > 1 && (
          <nav id="music-pagination" className="chat-tool-pagination" aria-label="Страницы результатов музыки">
            {Array.from({ length: pages }, (_, index) => index + 1).map((page) => (
              <Button
                key={page}
                id={`music-page-${String(page)}`}
                type="button"
                aria-current={page === result.page ? "page" : undefined}
                onClick={() => {
                  onPage(page)
                }}
                className="ui-icon-button"
              >
                {page}
              </Button>
            ))}
          </nav>
        )}
      </ToolCard>
    </div>
  )
}
