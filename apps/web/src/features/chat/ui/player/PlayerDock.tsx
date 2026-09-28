import { ScrollingText } from "../../../../shared/ui/ScrollingText"
import { Button } from "../../../../shared/ui/Button"
import { VolumeControl } from "./VolumeControl"
import { Icon } from "../../../../shared/ui/Icon"
import { usePlayerPanel } from "../../model/player/usePlayerPanel"
import { useCallback, useRef, useState, type CSSProperties } from "react"
import { usePlayer } from "../../model/player/context"
import { usePlayback } from "../../model/player/usePlayback"
import { MediaScreen } from "./MediaScreen"
import { PlayerQueue } from "./PlayerQueue"
function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(value / 60))}:${String(value % 60).padStart(2, "0")}`
}
export function PlayerDock() {
  const player = usePlayer()
  if (!player) return null
  return <ConnectedDock />
}
function ConnectedDock() {
  const player = usePlayer()
  const dispatch = player?.dispatch
  const next = useCallback(() => {
    dispatch?.({ type: "next" })
  }, [dispatch])
  const playback = usePlayback(player?.state.current ?? null, player?.state.requested ?? false, next)
  const [mediaRatio, setMediaRatio] = useState(16 / 9)
  const [notice, setNotice] = useState({ key: -1, text: "" })
  const expandButton = useRef<HTMLButtonElement>(null)
  const touchStart = useRef<number | null>(null)
  usePlayerPanel(player?.state.mode ?? "off", dispatch)
  if (!player) return null
  const { state } = player
  const close = () => {
    dispatch?.({ type: "mode", mode: "compact" })
    requestAnimationFrame(() => {
      expandButton.current?.focus()
    })
  }
  const powerOff = () => {
    dispatch?.({ type: "mode", mode: "off" })
    requestAnimationFrame(() => {
      document.getElementById("chat-tv-toggle")?.focus()
    })
    if (document.pictureInPictureElement === playback.ref.current)
      void document.exitPictureInPicture().catch(() => {
        /* Playback is already paused if the browser keeps its window open. */
      })
  }
  const toggle = () => {
    if (["blocked", "error", "paused"].includes(playback.status) && state.requested) playback.resume()
    else dispatch?.({ type: "request", value: !state.requested })
  }
  const playing = playback.status === "playing" && state.requested
  const pauseIntent = state.requested && ["loading", "playing"].includes(playback.status)
  const picture = async () => {
    const video = playback.ref.current
    if (!video) return
    try {
      if (document.pictureInPictureEnabled) await video.requestPictureInPicture()
      else await video.requestFullscreen()
    } catch {
      setNotice({
        key: state.current?.key ?? -1,
        text: "Сначала запусти видео. Если отдельное окно недоступно, смотри его в телевизоре.",
      })
    }
  }
  const origin = () => {
    const entry = state.current?.messageID
      ? document.querySelector<HTMLElement>(`[data-message-id="${String(state.current.messageID)}"]`)
      : null
    if (entry) {
      entry.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      })
      close()
    } else setNotice({ key: state.current?.key ?? -1, text: "Исходного сообщения уже нет в загруженной ленте." })
  }
  return (
    <section id="chat-tv" className="chat-tv" data-mode={state.mode} aria-label="Личный плеер Чатлан ТВ">
      <div className="chat-tv-mini">
        <Button
          id="chat-tv-expand"
          ref={expandButton}
          type="button"
          className="chat-tv-mini-title"
          variant="quiet"
          aria-expanded={state.mode === "expanded"}
          aria-controls="chat-tv-panel"
          onClick={() => dispatch?.({ type: "mode", mode: "expanded" })}
        >
          <span aria-hidden="true">📺</span>
          <span>
            {state.current?.title ?? `Очередь · ${String(state.queue.length)}`}
            <small>
              {playback.status === "error"
                ? "Запись недоступна · нажми ▶ для повтора"
                : playback.status === "blocked"
                  ? "Нажми ▶, чтобы включить"
                  : playback.status === "loading"
                    ? "Подготавливаем…"
                    : state.current?.kind === "video"
                      ? "Видео · только звук"
                      : ""}
            </small>
          </span>
        </Button>
        <Button
          id="chat-tv-mini-play"
          className="ui-icon-button"
          type="button"
          disabled={!state.current && !state.queue.length}
          onClick={toggle}
          aria-label={pauseIntent ? "Пауза" : "Воспроизвести"}
        >
          <Icon name={pauseIntent ? "pause" : "play"} className="size-6" />
        </Button>
        <Button
          id="chat-tv-mini-next"
          className="ui-icon-button"
          type="button"
          disabled={!state.queue.length}
          onClick={next}
          aria-label="Следующий"
        >
          <Icon name="forward-step" className="size-6" />
        </Button>
        <Button
          id="chat-tv-mini-off"
          className="ui-icon-button"
          type="button"
          onClick={powerOff}
          aria-label="Выключить телевизор"
        >
          <Icon name="power" className="size-6" />
        </Button>
      </div>
      <div
        id="chat-tv-panel"
        className="chat-tv-panel"
        style={{ "--media-ratio": state.current?.kind === "video" ? mediaRatio : 16 / 9 } as CSSProperties}
      >
        <div
          className="chat-tv-heading ui-controls-compact"
          onTouchStart={(event) => {
            touchStart.current = event.touches[0]?.clientY ?? null
          }}
          onTouchEnd={(event) => {
            const y = event.changedTouches[0]?.clientY
            if (touchStart.current !== null && y !== undefined && y - touchStart.current > 60) close()
            touchStart.current = null
          }}
        >
          <div className="chat-tv-controls">
            <Button
              id="chat-tv-play"
              className="ui-icon-button"
              variant="quiet"
              type="button"
              disabled={!state.current && !state.queue.length}
              onClick={toggle}
              aria-label={pauseIntent ? "Пауза" : "Воспроизвести"}
            >
              <Icon name={pauseIntent ? "pause" : "play"} className="size-6" />
            </Button>
            <Button
              id="chat-tv-next"
              className="ui-icon-button"
              variant="quiet"
              type="button"
              disabled={!state.queue.length}
              onClick={next}
              aria-label="Следующий"
            >
              <Icon name="forward-step" className="size-6" />
            </Button>
            <VolumeControl volume={playback.volume} onChange={playback.changeVolume} />
          </div>
          <span className="chat-tv-grip" aria-hidden="true" />
          {state.current?.kind === "video" && (
            <Button
              id="chat-tv-picture"
              className="ui-icon-button"
              variant="quiet"
              type="button"
              aria-label="Отдельное окно"
              title="Отдельное окно"
              onClick={() => {
                void picture()
              }}
            >
              <Icon name="picture-in-picture" className="size-5" />
            </Button>
          )}
          <Button
            id="chat-tv-collapse"
            className="ui-icon-button"
            variant="quiet"
            type="button"
            onClick={close}
            aria-label="Свернуть телевизор"
            title="Свернуть телевизор"
          >
            <Icon name="chevron-down" className="size-5" />
          </Button>
          <Button
            id="chat-tv-off"
            className="ui-icon-button"
            variant="quiet"
            type="button"
            onClick={powerOff}
            aria-label="Выключить телевизор"
            title="Выключить телевизор"
          >
            <Icon name="power" className="size-5" />
          </Button>
        </div>
        <div className="chat-tv-layout">
          <MediaScreen
            videoRef={playback.ref}
            music={state.current?.kind !== "video"}
            playing={playing}
            onAspectRatio={setMediaRatio}
          />
          <div className="chat-tv-dashboard">
            {state.current?.messageID !== undefined ? (
              <Button
                id="chat-tv-origin"
                variant="quiet"
                onClick={origin}
                className="chat-tv-title chat-tool-title"
                title="К сообщению"
                aria-label={`К сообщению: ${state.current.title}`}
              >
                <ScrollingText>{state.current.title}</ScrollingText>
              </Button>
            ) : (
              <div className="chat-tv-title chat-tool-title">{state.current?.title ?? "Выбери музыку или видео"}</div>
            )}
            {state.current?.author && <div className="chat-tool-description">От {state.current.author}</div>}
            <div className="chat-tv-timeline">
              <label className="chat-tv-progress">
                <span>
                  {clock(playback.time.position)} / {clock(playback.time.duration)}
                </span>
                <input
                  id="chat-tv-seek"
                  className="ui-focus-ring"
                  aria-label="Позиция воспроизведения"
                  type="range"
                  min="0"
                  max={playback.time.duration || 1}
                  step="1"
                  disabled={!playback.time.duration}
                  value={Math.min(playback.time.position, playback.time.duration)}
                  onChange={(event) => {
                    playback.seek(Number(event.target.value))
                  }}
                />
              </label>
            </div>
            <p id="chat-tv-status" className="chat-tool-status" role="status">
              {playback.status === "loading"
                ? "Подготавливаем…"
                : playback.status === "error"
                  ? "Запись недоступна. Нажми ▶ для повтора или пропусти её."
                  : playback.status === "blocked"
                    ? "Нажми ▶, чтобы разрешить воспроизведение."
                    : notice.key === state.current?.key
                      ? notice.text
                      : ""}
            </p>
          </div>
          <PlayerQueue />
        </div>
      </div>
    </section>
  )
}
