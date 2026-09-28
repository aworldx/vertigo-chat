import { MediaActions } from "./player/MediaActions"
import { messageTrack } from "../model/player/tracks"
import { appearanceStyle, MessageTime } from "./MessagePresentation"
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
  const track = messageTrack(message)
  if (!track) return <p>{message.body}</p>
  return (
    <article
      id={`${message.kind}-message-${String(message.id)}`}
      className="w-full rounded-lg border border-zinc-700 px-3 py-2"
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        {author}
        <MessageTime message={message} className="text-zinc-500" />
      </div>
      <p className="mt-1 break-words text-sm">
        {track.kind === "video" ? "📺" : "♫"} {track.title}
      </p>
      <p className="text-xs text-zinc-500">
        {track.kind === "video" ? "Видео" : "Музыка"} · {message.duration}
      </p>
      <MediaActions track={track} id={`media-message-${String(message.id)}`} />
    </article>
  )
}
