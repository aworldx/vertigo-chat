import { Icon } from "../../../shared/ui/Icon"
import type { MediaItem } from "../api/media"
import type { MediaSearchResult } from "../model/useMediaSearch"
import { ListeningAudio } from "./ListeningAudio"
import { useFeedContentEvent } from "./feedContent"

type SearchListProps = { items: MediaItem[]; onSend: (item: MediaItem) => void }

function GifResults({ items, onSend }: SearchListProps) {
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {items.map((item, index) => (
        <button
          key={item.url}
          id={`gif-result-${String(index)}`}
          type="button"
          onClick={() => {
            onSend(item)
          }}
          aria-label={`Отправить GIF: ${item.title}`}
          className="group/gif relative size-24 shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 text-left transition hover:border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:size-28"
        >
          <img
            src={`/gif-proxy?url=${encodeURIComponent(item.preview)}`}
            alt={item.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-full object-cover transition duration-200 group-hover/gif:scale-[1.03]"
          />
          <span className="absolute inset-x-0 bottom-0 bg-zinc-950/75 px-1.5 py-1 text-center text-[10px] text-zinc-100 opacity-0 transition group-hover/gif:opacity-100">
            Отправить GIF
          </span>
        </button>
      ))}
    </div>
  )
}

function MusicResults({ items, onSend }: SearchListProps) {
  return (
    <div className="mt-3 space-y-1.5">
      {items.map((item, index) => (
        <article
          key={item.url}
          id={`media-result-${String(index)}`}
          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-md border border-zinc-800 bg-zinc-950/70 px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)_auto] sm:gap-3"
        >
          <div className="min-w-0 truncate text-xs leading-4 text-zinc-300">
            <span className="font-semibold text-zinc-100">{item.artist}</span>
            <span className="text-zinc-500"> — </span>
            <span>{item.title}</span> <span className="ml-1 text-[11px] text-zinc-500">{item.duration}</span>
          </div>
          <ListeningAudio
            id={`music-search-player-${String(index)}`}
            title={`${item.artist} — ${item.title}`}
            controls
            preload="none"
            controlsList="nodownload"
            src={`/music-proxy?url=${encodeURIComponent(item.url)}`}
            aria-label={`Воспроизвести ${item.artist} — ${item.title}`}
            className="col-span-2 h-8 w-full sm:col-span-1"
          />
          <SendMediaButton index={index} item={item} onSend={onSend} />
        </article>
      ))}
    </div>
  )
}

function VideoResults({ items, onSend }: SearchListProps) {
  return (
    <div className="mt-3 space-y-1.5">
      {items.map((item, index) => (
        <article
          key={item.url}
          id={`media-result-${String(index)}`}
          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950/70 px-2.5 py-2"
        >
          <div className="min-w-0 text-xs leading-4 text-zinc-300">
            <p className="truncate font-semibold text-zinc-100">{item.title}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{item.duration}</p>
          </div>
          <SendMediaButton index={index} item={item} onSend={onSend} />
        </article>
      ))}
    </div>
  )
}

function SendMediaButton({
  index,
  item,
  onSend,
}: {
  index: number
  item: MediaItem
  onSend: (item: MediaItem) => void
}) {
  return (
    <button
      id={`send-media-${String(index)}`}
      type="button"
      onClick={() => {
        onSend(item)
      }}
      className="shrink-0 rounded-md border border-amber-300/50 px-2 py-1 text-[11px] font-semibold text-amber-200 transition hover:border-amber-200 hover:bg-amber-300/10"
    >
      В чат
    </button>
  )
}

function SearchResultList({ result, items, onSend }: SearchListProps & { result: MediaSearchResult }) {
  if (result.kind === "gif") return <GifResults items={items} onSend={onSend} />
  if (result.kind === "music") return <MusicResults items={items} onSend={onSend} />
  return <VideoResults items={items} onSend={onSend} />
}

export function MediaSearchResults({
  result,
  frame = true,
  onSend,
  onClose,
  onPage,
}: {
  frame?: boolean
  result: MediaSearchResult | null
  onSend: (item: MediaItem) => void
  onClose: () => void
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
  const title = result.loading || result.error ? `Поиск ${label}` : result.kind === "music" ? "Музыка" : label
  const body = result.loading
    ? `Ищу «${result.query}»…`
    : result.error ||
      (items.length === 0
        ? "Ничего не найдено."
        : result.kind === "gif"
          ? "Выбери GIF — она будет отправлена в общую комнату."
          : result.kind === "music"
            ? "Выбери трек для общей комнаты."
            : "Выбери видео для общей комнаты.")
  return (
    <div
      data-message-kind="command"
      data-message-frame={frame}
      className={`chat-message-entry group/message relative px-1 py-1 transition-colors ${frame ? "border-zinc-800 bg-zinc-900" : ""}`}
    >
      <section
        id="media-search-results"
        data-command-result={result.kind === "youtube" ? "youtube_search" : result.kind}
        className="rounded-xl border border-amber-300/35 bg-zinc-900/95 px-4 py-3 shadow-lg shadow-black/20"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
          <Icon name="command-line" className="size-4" />
          <span>{title}</span>
          <button
            id="dismiss-media-search"
            type="button"
            onClick={onClose}
            aria-label={`Закрыть поиск ${label}`}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium normal-case tracking-normal text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <Icon name="x-mark" className="size-3.5" /> Закрыть
          </button>
          <time dateTime={result.time} className="text-[10px] font-normal normal-case tracking-normal text-zinc-500">
            {new Date(result.time).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </time>
        </div>
        <p
          className="mt-2 text-sm leading-5 text-zinc-300"
          role={result.loading ? "status" : result.error ? "alert" : undefined}
        >
          {body}
        </p>
        {items.length > 0 && <SearchResultList result={result} items={items} onSend={onSend} />}
        {pages > 1 && (
          <nav
            id="music-pagination"
            className="mt-2 flex items-center justify-center gap-1.5"
            aria-label="Страницы результатов музыки"
          >
            {Array.from({ length: pages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                id={`music-page-${String(page)}`}
                type="button"
                aria-current={page === result.page ? "page" : undefined}
                onClick={() => {
                  onPage(page)
                }}
                className={`flex size-7 items-center justify-center rounded-md border text-xs font-semibold transition ${page === result.page ? "border-amber-200 bg-amber-300/15 text-amber-100" : "border-zinc-700 text-zinc-400 hover:border-amber-300/60 hover:text-amber-100"}`}
              >
                {page}
              </button>
            ))}
          </nav>
        )}
      </section>
    </div>
  )
}
