import { useContext, useEffect, useRef, useState } from "react"
import { Button } from "../../../shared/ui/Button"
import { Icon } from "../../../shared/ui/Icon"
import { ScrollingText } from "../../../shared/ui/ScrollingText"
import { ListeningContext } from "../model/listeningContext"
import { usePlayer } from "../model/player/context"
import { mediaTrack } from "../model/player/tracks"
import type { MediaItem } from "../api/media"

export function MusicSearchRow({
  item,
  index,
  onSend,
}: {
  item: MediaItem
  index: number
  onSend: (item: MediaItem) => void
}) {
  const player = usePlayer()
  const connection = useContext(ListeningContext)
  const audio = useRef<HTMLAudioElement>(null)
  const active = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)
  const [time, setTime] = useState({ position: 0, duration: 0 })
  const track = mediaTrack(item)
  const title = track?.title ?? item.title
  const source = track?.source
  const shared = !!player
  useEffect(() => {
    const element = audio.current
    return () => {
      element?.pause()
      if (active.current) connection?.listening(title, false)
      active.current = false
    }
  }, [connection, title, source, shared])
  if (!track) return null
  const stop = () => {
    active.current = false
    setPlaying(false)
    connection?.listening(title, false)
  }
  const play = () => {
    if (player) {
      player.dispatch({ type: "play", track })
      return
    }
    const element = audio.current
    if (!element) return
    setError(false)
    if (!element.paused) element.pause()
    else
      void element.play().catch(() => {
        setError(true)
      })
  }
  return (
    <article id={`media-result-${String(index)}`} className="chat-search-item chat-playback-row">
      <Button
        id={`media-search-${String(index)}-play`}
        variant="quiet"
        className="ui-icon-button"
        onClick={play}
        aria-label={playing && !player ? "Пауза" : error ? "Повторить воспроизведение" : "Воспроизвести"}
        title={error ? "Не удалось воспроизвести. Повторить" : playing && !player ? "Пауза" : "Воспроизвести"}
      >
        <Icon
          name={error && !player ? "exclamation-circle" : playing && !player ? "pause" : "play"}
          className="size-5"
        />
      </Button>
      <div className="chat-playback-row-title" title={title}>
        <ScrollingText>{title}</ScrollingText>
        {!player && (
          <input
            className="chat-music-seek ui-focus-ring"
            type="range"
            min="0"
            max={time.duration || 1}
            step="1"
            aria-label={`Позиция воспроизведения: ${title}`}
            title={item.duration}
            disabled={!time.duration}
            value={Math.min(time.position, time.duration)}
            onChange={(event) => {
              if (audio.current) audio.current.currentTime = Number(event.target.value)
            }}
          />
        )}
      </div>
      {player ? (
        <>
          <span className="chat-playback-duration">{item.duration}</span>
          <Button
            id={`media-search-${String(index)}-enqueue`}
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
        </>
      ) : (
        <>
          <audio
            id={`media-search-${String(index)}-audio`}
            ref={audio}
            src={track.source}
            preload="none"
            hidden
            onPlay={() => {
              active.current = true
              setPlaying(true)
              connection?.listening(title, true)
            }}
            onPause={stop}
            onEnded={stop}
            onError={() => {
              stop()
              setError(true)
            }}
            onTimeUpdate={(event) => {
              const element = event.currentTarget
              setTime({
                position: element.currentTime,
                duration: Number.isFinite(element.duration) ? element.duration : 0,
              })
            }}
          >
            <track kind="captions" label="Субтитры" />
          </audio>

          {error && (
            <span className="sr-only" role="status">
              Не удалось воспроизвести. Нажми повтор.
            </span>
          )}
        </>
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
    </article>
  )
}
