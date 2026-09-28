import type { RefObject } from "react"
export function MediaScreen({
  videoRef,
  music,
  playing,
  onAspectRatio,
}: {
  videoRef: RefObject<HTMLVideoElement | null>
  music: boolean
  playing: boolean
  onAspectRatio: (ratio: number) => void
}) {
  return (
    <div className="chat-player-screen" data-playing={playing} data-music={music}>
      <video
        id="chat-tv-media"
        ref={videoRef}
        playsInline
        preload="none"
        aria-label="Видео в плеере"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget
          if (video.videoWidth && video.videoHeight) onAspectRatio(video.videoWidth / video.videoHeight)
        }}
        crossOrigin="anonymous"
      >
        <track kind="captions" label="Субтитры" />
      </video>
      {music && (
        <div className="chat-tv-visualizer" aria-label="Музыкальная визуализация" role="img">
          <span className="chat-tv-aurora" />
          <div className="chat-tv-spectrum" aria-hidden="true">
            {Array.from({ length: 24 }, (_, n) => (
              <span
                key={n}
                style={{
                  height: `${String(35 + ((n * 23) % 65))}%`,
                  animationDelay: `${String(-n * 0.17)}s`,
                  animationDuration: `${String(0.7 + (n % 5) * 0.19)}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
