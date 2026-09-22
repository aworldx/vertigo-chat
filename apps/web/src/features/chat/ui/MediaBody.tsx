import { ListeningAudio } from "./ListeningAudio"
import { YouTubePlayer } from "./YouTubePlayer"
import { appearanceStyle, MessageTime } from "./MessagePresentation"
import { Icon } from "../../../shared/ui/Icon"
import type { Message } from "../api/protocol"
import { safeMediaURL } from "../api/media"
export function MediaBody({
  message,
  onAddress,
  frame = true,
}: {
  message: Message
  onAddress: (nickname: string) => void
  frame?: boolean
}) {
  if (!safeMediaURL(message.kind, message.media_url)) return <p>{message.body}</p>
  const author = (
    <button
      id={`message-author-${String(message.id)}`}
      type="button"
      onClick={() => {
        onAddress(message.author)
      }}
      onDoubleClick={() => {
        onAddress(`^${message.author}`)
      }}
      className="chat-message-author min-w-0 truncate font-semibold hover:underline"
      style={appearanceStyle(message.appearance)}
    >
      {message.author}
    </button>
  )
  if (message.kind === "gif")
    return (
      <figure className="mt-2 max-w-48 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80">
        <img
          id={`gif-message-${String(message.id)}`}
          src={`/gif-proxy?url=${encodeURIComponent(message.media_url)}`}
          alt={message.body}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="max-h-48 w-full object-contain"
        />
        <figcaption className="px-2 py-1 text-xs text-zinc-500">
          {!frame && (
            <>
              {author}:<span className="mr-1" />
            </>
          )}
          {message.body}
        </figcaption>
      </figure>
    )
  if (message.kind === "youtube")
    return (
      <figure
        id={`youtube-message-${String(message.id)}`}
        className="overflow-hidden rounded-xl border border-zinc-700 bg-black shadow-sm"
      >
        <YouTubePlayer id={String(message.id)} source={message.media_url} author={message.author} />
        <figcaption className="flex items-center justify-between gap-3 px-2 py-1.5 text-xs text-zinc-400">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-100" title={message.body}>
              {message.body}
            </p>
            {author}
          </div>
          <MessageTime message={message} className="shrink-0 text-zinc-500" />
        </figcaption>
      </figure>
    )
  const title = `${message.artist ?? ""} — ${message.body}`
  return (
    <article className="max-w-xl">
      <div className="flex items-center justify-between gap-3 text-[11px] leading-4">
        {author}
        <MessageTime message={message} className="shrink-0 text-zinc-500" />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-300/10 text-amber-200">
          <Icon name="musical-note" className="size-4" />
        </span>
        <span
          className="shrink-0 text-base leading-none motion-safe:animate-spin motion-reduce:animate-none"
          role="img"
          aria-label="Музыка играет"
          title="Музыка играет"
        >
          💿
        </span>
        <p className="min-w-0 flex-1 truncate text-sm text-zinc-300">
          <span className="font-semibold text-zinc-100">{message.artist}</span>
          <span className="text-zinc-500"> — </span>
          <span>{message.body}</span>
        </p>
        <span className="shrink-0 text-xs text-emerald-200">{message.duration}</span>
      </div>
      <ListeningAudio
        id={`music-message-player-${String(message.id)}`}
        title={title}
        controls
        preload="none"
        controlsList="nodownload"
        src={`/music-proxy?url=${encodeURIComponent(message.media_url)}`}
        aria-label={`Воспроизвести ${title}`}
        className="mt-2 h-9 w-full"
      />
    </article>
  )
}
