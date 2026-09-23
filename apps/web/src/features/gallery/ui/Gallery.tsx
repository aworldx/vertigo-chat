import { Notice } from "../../../shared/ui/Notice"
import { useState, useCallback, type ReactNode } from "react"
import { useGallery } from "../model/useGallery"
import type { Photo } from "../api/gallery"
import { Upload } from "./Upload"
import { PhotoCard } from "./PhotoCard"
import { Lightbox } from "./Lightbox"
export function Gallery({ nickname, csrf, login }: { nickname: string; csrf: string; login: ReactNode }) {
  const { data, error, loading, refresh } = useGallery(),
    [selected, setSelected] = useState<Photo | null>(null)
  const [notice, setNotice] = useState("")
  const close = useCallback(() => {
    setSelected(null)
  }, [])
  return (
    <section
      id="gallery-page"
      className="chat-shell min-h-screen bg-zinc-950 text-zinc-100"
      data-chat-theme="vertigo"
      data-chat-mode="dark"
    >
      <header className="flex min-h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 sm:px-8">
        <a href="/chat" target="vertigo-chat" data-return-to-chat className="flex items-center gap-3">
          <span className="vertigo-mark" aria-hidden="true" />
          <span className="vertigo-wordmark uppercase">Vertigo</span>
        </a>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
        <div className="flex flex-col gap-6 border-b border-zinc-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-300">Моменты Vertigo</p>
            <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Фотоальбом</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
              Общая коллекция снимков чатлан. Загружать фотографии могут участники со званием «Статист».
            </p>
          </div>
          {nickname ? (
            data?.can_upload ? (
              <Upload
                nickname={nickname}
                csrf={csrf}
                onSaved={() => {
                  setNotice("Фотография добавлена в альбом.")
                  refresh()
                }}
              />
            ) : (
              <div
                id="gallery-rank-hint"
                className="max-w-md rounded-2xl border border-zinc-700 bg-zinc-900/70 px-5 py-4 text-sm leading-6 text-zinc-400"
              >
                Добавлять снимки можно со звания «Статист».
              </div>
            )
          ) : (
            login
          )}
        </div>
        {loading && <p role="status">Загрузка фотоальбома…</p>}
        {error && (
          <p role="alert">
            {error}{" "}
            <button
              id="gallery-retry"
              onClick={() => {
                refresh()
              }}
            >
              Повторить
            </button>
          </p>
        )}
        <div id="gallery-photos" className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">
          {data?.data.length === 0 && (
            <div
              id="gallery-empty"
              className="rounded-2xl border border-dashed border-zinc-700 px-6 py-20 text-center text-zinc-400"
            >
              В альбоме пока нет фотографий. Станьте первым автором.
            </div>
          )}
          {data?.data.map((p) => (
            <PhotoCard
              key={p.id}
              photo={p}
              csrf={csrf}
              signedIn={!!nickname}
              onOpen={setSelected}
              onChanged={(message) => {
                setNotice(message)
                refresh()
              }}
            />
          ))}
        </div>
      </main>
      <Notice
        message={notice}
        onClose={() => {
          setNotice("")
        }}
      />
      {selected && <Lightbox photo={selected} onClose={close} />}
    </section>
  )
}
