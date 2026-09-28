import { ScrollingText } from "../../../../shared/ui/ScrollingText"
import { Icon } from "../../../../shared/ui/Icon"
import { Button } from "../../../../shared/ui/Button"
import { usePlayer } from "../../model/player/context"
export function PlayerQueue() {
  const player = usePlayer()
  if (!player) return null
  const { state, dispatch } = player
  if (!state.queue.length) return null
  return (
    <section aria-label="Очередь воспроизведения" id="chat-tv-queue" className="chat-tv-queue">
      <ol>
        {state.queue.map((track, index) => (
          <li key={track.key}>
            <Button
              id={`tv-queue-play-${String(track.key)}`}
              type="button"
              title={track.title}
              className="chat-tv-queue-title"
              variant="quiet"
              onClick={() => {
                dispatch({ type: "select", key: track.key })
              }}
            >
              <ScrollingText>{track.title}</ScrollingText>
              <small>
                {track.kind === "video" ? "Видео" : "Музыка"}
                {track.author ? ` · ${track.author}` : ""}
              </small>
            </Button>
            <div
              className="chat-tv-queue-actions ui-button-group ui-controls-dense"
              role="group"
              aria-label={`Управление записью: ${track.title}`}
            >
              <Button
                id={`tv-queue-up-${String(track.key)}`}
                className="ui-icon-button"
                variant="quiet"
                type="button"
                disabled={index === 0}
                aria-label={`Выше: ${track.title}`}
                onClick={() => {
                  dispatch({ type: "move", key: track.key, direction: -1 })
                }}
              >
                <Icon name="arrow-up" className="size-5" />
              </Button>
              <Button
                id={`tv-queue-down-${String(track.key)}`}
                className="ui-icon-button"
                variant="quiet"
                type="button"
                disabled={index === state.queue.length - 1}
                aria-label={`Ниже: ${track.title}`}
                onClick={() => {
                  dispatch({ type: "move", key: track.key, direction: 1 })
                }}
              >
                <Icon name="arrow-down" className="size-5" />
              </Button>
              <Button
                id={`tv-queue-remove-${String(track.key)}`}
                className="ui-icon-button"
                variant="quiet"
                type="button"
                aria-label={`Убрать: ${track.title}`}
                onClick={() => {
                  dispatch({ type: "remove", key: track.key })
                }}
              >
                <Icon name="trash" className="size-5" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
