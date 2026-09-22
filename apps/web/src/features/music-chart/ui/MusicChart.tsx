import type { ReactNode } from "react"
import { useChart } from "../model/useChart"
import type { Track } from "../api/chart"
import { TrackCard } from "./TrackCard"
export function MusicChart({
  csrf,
  registered,
  login,
  player,
}: {
  csrf: string
  registered: boolean
  login: ReactNode
  player: (track: Track) => ReactNode
}) {
  const chart = useChart(csrf)
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
      <section className="music-chart-hero rounded-3xl border border-fuchsia-300/25 px-6 py-10 sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-200">Музыка Vertigo</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Хит-парад</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
          Все мы любим слушать музыку. Загружайте сюда любимые треки, близкие вашему сердечку.
        </p>
      </section>
      {chart.error && (
        <p id="music-chart-error" role="alert" className="mt-4 text-red-300">
          {chart.error}
        </p>
      )}
      <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-semibold">Любимые треки чата</h2>
            <span className="text-sm text-zinc-500">Сначала больше всего сердечек</span>
          </div>
          <div id="music-chart-tracks" className="space-y-3">
            {chart.tracks.map((track) => (
              <TrackCard key={track.id} track={track} registered={registered} chart={chart} player={player(track)} />
            ))}
            <p
              id="music-chart-empty"
              className="hidden rounded-2xl border border-dashed border-zinc-700 px-6 py-16 text-center text-zinc-400 only:block"
            >
              Пока тихо. Добавь первый трек.
            </p>
          </div>
        </div>
        <aside className={registered ? "h-fit rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5" : "h-fit"}>
          {registered ? (
            <>
              <h2 className="text-lg font-semibold">Добавить в топ</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">До 5 треков от одного чатланина.</p>
              <form
                id="music-chart-upload-form"
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  const form = event.currentTarget
                  void chart.mutate("", "POST", new FormData(form)).then((ok) => {
                    if (ok) form.reset()
                  })
                }}
              >
                <div>
                  <label htmlFor="music-chart-title" className="block text-sm font-medium text-zinc-200">
                    Название
                  </label>
                  <input
                    id="music-chart-title"
                    name="title"
                    maxLength={120}
                    placeholder="Если оставить пустым — возьмём имя файла"
                    className="mt-2 block w-full rounded-xl border border-zinc-700 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 shadow-sm outline-none transition [color-scheme:dark] placeholder:text-zinc-600 hover:border-zinc-600 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-not-allowed disabled:bg-zinc-950/40 disabled:text-zinc-500"
                  />
                </div>
                <input
                  id="music-chart-audio"
                  name="audio"
                  type="file"
                  required
                  accept=".mp3,.ogg,.wav"
                  className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-300 file:px-3 file:py-2 file:font-semibold file:text-zinc-950"
                />
                <p className="text-xs leading-5 text-zinc-500">MP3, OGG или WAV, до 20 МБ.</p>
                <button
                  id="upload-music-track"
                  disabled={chart.pending}
                  className="hit-parade-button w-full justify-center"
                >
                  {chart.pending ? "Загрузка…" : "Добавить трек"}
                </button>
              </form>
            </>
          ) : (
            login
          )}
        </aside>
      </section>
    </main>
  )
}
