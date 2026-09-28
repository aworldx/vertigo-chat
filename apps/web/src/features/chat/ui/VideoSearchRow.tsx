import { Button } from "../../../shared/ui/Button"
import { Icon } from "../../../shared/ui/Icon"
import { ScrollingText } from "../../../shared/ui/ScrollingText"
import { usePlayer } from "../model/player/context"
import { mediaTrack } from "../model/player/tracks"
import type { MediaItem } from "../api/media"
import { YouTubePlayer } from "./YouTubePlayer"

export function VideoSearchRow({
  item,
  index,
  onSend,
  expanded,
  onToggle,
}: {
  item: MediaItem
  index: number
  onSend: (item: MediaItem) => void
  expanded: boolean
  onToggle: () => void
}) {
  const player = usePlayer()
  const track = mediaTrack(item)
  if (!track) return null
  const id = `media-search-${String(index)}`
  const preview = expanded && !player
  return (
    <article id={`media-result-${String(index)}`} className="chat-search-item chat-video-result">
      <div className="chat-playback-row">
        <Button
          id={`${id}-play`}
          variant="quiet"
          className="ui-icon-button"
          aria-label={preview ? "Закрыть предпросмотр" : "Воспроизвести"}
          title={preview ? "Закрыть предпросмотр" : "Воспроизвести"}
          aria-expanded={player ? undefined : preview}
          aria-controls={player ? undefined : `${id}-preview`}
          onClick={() => {
            if (player) player.dispatch({ type: "play", track })
            else onToggle()
          }}
        >
          <Icon name={preview ? "arrow-up" : "play"} className="size-5" />
        </Button>
        <div className="chat-playback-row-title" title={track.title}>
          <ScrollingText>{track.title}</ScrollingText>
        </div>
        <span className="chat-playback-duration">{item.duration}</span>
        {player && (
          <Button
            id={`${id}-enqueue`}
            variant="quiet"
            className="ui-icon-button"
            aria-label={
              player.state.queue.some((entry) => entry.source === track.source) ? "Ещё раз в очередь" : "В очередь"
            }
            title="Добавить в очередь"
            onClick={() => {
              player.dispatch({ type: "enqueue", track })
            }}
          >
            <span aria-hidden="true" className="text-xl">
              +
            </span>
          </Button>
        )}
        <Button
          id={`send-media-${String(index)}`}
          variant="primary"
          className="ui-icon-button"
          aria-label="Отправить в чат"
          title="Отправить в чат"
          onClick={() => {
            onSend(item)
          }}
        >
          <Icon name="paper-airplane" className="size-5" />
        </Button>
      </div>
      {preview && (
        <div id={`${id}-preview`} className="chat-video-preview">
          <YouTubePlayer source={track.source} author={track.author} id={id} autoStart />
        </div>
      )}
    </article>
  )
}
