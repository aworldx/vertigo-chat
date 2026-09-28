import { ListeningAudio } from "../ListeningAudio"
import { YouTubePlayer } from "../YouTubePlayer"
import { Button } from "../../../../shared/ui/Button"
import { usePlayer } from "../../model/player/context"
import type { Track } from "../../model/player/queue"
export function MediaActions({ track, id }: { track: Track; id: string }) {
  const player = usePlayer()
  if (!player)
    return track.kind === "video" ? (
      <div className="mt-2 w-full max-w-md">
        <YouTubePlayer key={track.source} source={track.source} author={track.author} id={id} />
      </div>
    ) : (
      <ListeningAudio
        id={`${id}-audio`}
        title={track.title}
        src={track.source}
        controls
        preload="none"
        className="mt-2 w-full max-w-md"
      />
    )
  const queued = player.state.queue.some((entry) => entry.source === track.source)
  return (
    <div className="chat-media-actions">
      <Button
        id={`${id}-play`}
        type="button"
        onClick={() => {
          player.dispatch({ type: "play", track })
        }}
      >
        Воспроизвести
      </Button>
      <Button
        id={`${id}-enqueue`}
        type="button"
        onClick={() => {
          player.dispatch({ type: "enqueue", track })
        }}
      >
        {queued ? "Ещё раз в очередь" : "В очередь"}
      </Button>
    </div>
  )
}
