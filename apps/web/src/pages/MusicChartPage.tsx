import { useEffect, useRef, useCallback, useState } from "react"
import { readSession } from "../features/chat"
import { MusicChart } from "../features/music-chart"
import { AccountBar, InlineLogin, useAccountSession } from "../features/accounts"
import { broadcastListening } from "../shared/listening"
function Player({ id, title, nickname }: { id: number; title: string; nickname: string }) {
  const playing = useRef(false)
  const stop = useCallback(() => {
    if (playing.current) broadcastListening(nickname, title, false)
    playing.current = false
  }, [nickname, title])
  useEffect(() => {
    const timer = setInterval(() => {
      if (playing.current) broadcastListening(nickname, title, true)
    }, 10000)
    window.addEventListener("pagehide", stop)
    return () => {
      clearInterval(timer)
      window.removeEventListener("pagehide", stop)
      stop()
    }
  }, [nickname, title, stop])
  return (
    <audio
      id={`music-chart-player-${String(id)}`}
      data-track-title={title}
      className="mt-3 w-full"
      controls
      preload="metadata"
      src={`/music-chart/tracks/${String(id)}`}
      onPlay={() => {
        playing.current = true
        broadcastListening(nickname, title, true)
      }}
      onPause={stop}
      onEnded={stop}
      onError={stop}
    >
      <track kind="captions" label="Субтитры" />
      Твой браузер не поддерживает воспроизведение аудио.
    </audio>
  )
}
export function MusicChartPage() {
  const { session, pending, refresh, signOut } = useAccountSession()
  const [chatSession] = useState(readSession)
  return (
    <>
      {session?.principal && (
        <AccountBar
          principal={session.principal}
          pending={pending}
          onLogout={() => {
            void signOut()
          }}
        />
      )}
      <section id="music-chart-page" className="chat-shell min-h-screen bg-zinc-950 text-zinc-100">
        <header className="flex min-h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 sm:px-8">
          <a href="/" className="flex items-center gap-3" aria-label="Vertigo — главная">
            <span className="vertigo-mark" aria-hidden="true" />
            <span className="vertigo-wordmark uppercase">Vertigo</span>
          </a>
        </header>
        <MusicChart
          csrf={session?.csrf_token ?? ""}
          registered={!!session?.principal}
          login={
            <InlineLogin
              id="music-chart"
              onAuthenticated={() => {
                void refresh()
              }}
            />
          }
          player={(track) => (
            <Player
              id={track.id}
              title={track.title}
              nickname={session?.principal?.nickname ?? chatSession?.nickname ?? ""}
            />
          )}
        />
      </section>
    </>
  )
}
