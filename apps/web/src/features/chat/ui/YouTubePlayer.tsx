import { useVideoPlayback } from "../model/useVideoPlayback"
import { Icon } from "../../../shared/ui/Icon"
export function YouTubePlayer({ source, author, id }: { source: string; author: string; id: string }) {
  const { videoRef, state, start, retry, playing } = useVideoPlayback(source)
  return (
    <div className="relative">
      <video
        id={`youtube-message-player-${id}`}
        ref={videoRef}
        onError={retry}
        onPlaying={playing}
        controls
        preload="none"
        controlsList="nodownload"
        crossOrigin="anonymous"
        aria-label={`Воспроизвести YouTube-видео от ${author}`}
        className="aspect-video w-full bg-zinc-950"
      >
        <track kind="captions" label="Субтитры" />
      </video>
      {(state === "idle" || state === "failed") && (
        <button
          id={`youtube-message-play-${id}`}
          type="button"
          onClick={start}
          className="absolute inset-0 m-auto flex h-11 w-fit items-center gap-2 self-center rounded-full bg-zinc-100 px-5 text-sm font-semibold text-zinc-950 shadow-lg transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Icon name="play" className="size-4" />
          <span>{state === "failed" ? "Повторить" : "Воспроизвести"}</span>
        </button>
      )}
      {state === "preparing" && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-0 m-auto flex h-11 w-fit items-center gap-2 self-center rounded-full bg-zinc-950/90 px-5 text-sm font-medium text-zinc-100 shadow-lg"
        >
          <Icon name="arrow-path" className="size-4 animate-spin" />
          <span>Подготавливаю…</span>
        </div>
      )}
    </div>
  )
}
