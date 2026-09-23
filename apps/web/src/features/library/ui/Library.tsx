import { Notice } from "../../../shared/ui/Notice"
import { Icon } from "../../../shared/ui/Icon"
import { useState, useCallback, type ReactNode } from "react"
import { usePageQuery } from "../../../shared/model/usePageQuery"
import { useLibrary } from "../model/useLibrary"
import type { Article } from "../api/library"
import { ArticleCard } from "./ArticleCard"
import { Editor } from "./Editor"
import { SeriesList } from "./SeriesList"
export function Library({ nickname, csrf, login }: { nickname: string; csrf: string; login: ReactNode }) {
  const { query, navigate } = usePageQuery(),
    { data, error, refresh } = useLibrary(query),
    [editor, setEditor] = useState<{ article: Article | null } | null>(null)
  const [notice, setNotice] = useState("")
  const close = useCallback(() => {
      setEditor(null)
    }, []),
    params = new URLSearchParams(query),
    author = Number(params.get("author")),
    selected = author > 0 ? (params.get("series")?.trim() ?? "") : ""
  return (
    <section
      id="library-page"
      className="library-shell chat-shell relative min-h-screen overflow-hidden text-stone-100"
      data-chat-theme="vertigo"
      data-chat-mode="dark"
    >
      <div className="library-shelves pointer-events-none fixed inset-0 opacity-35" aria-hidden="true" />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_10%,transparent_0,rgba(12,7,5,0.35)_48%,rgba(5,3,2,0.88)_100%)]"
        aria-hidden="true"
      />
      <header className="relative z-10 flex min-h-16 items-center justify-between border-b border-amber-950/70 bg-stone-950/85 px-4 shadow-xl backdrop-blur-sm sm:px-8">
        <a href="/chat" target="vertigo-chat" data-return-to-chat className="flex items-center gap-3">
          <span className="vertigo-mark" aria-hidden="true" />
          <span className="vertigo-wordmark uppercase">Vertigo</span>
        </a>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
        <div className="rounded-3xl border border-amber-900/40 bg-stone-950/80 p-6 shadow-2xl backdrop-blur-md sm:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-400">Читальный зал Vertigo</p>
              <h1 className="mt-2 text-4xl font-semibold text-amber-50 sm:text-6xl">Библиотека</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-400">
                Публичные тексты чатлан. Собирай большие истории в серии и читай их части по порядку.
              </p>
            </div>
            <div className="min-h-11">
              {nickname ? (
                data?.can_publish ? (
                  <button
                    id="new-library-article"
                    type="button"
                    onClick={() => {
                      setEditor({ article: null })
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-stone-950 shadow-lg shadow-amber-950/30 transition hover:-translate-y-0.5 hover:bg-amber-200"
                  >
                    <Icon name="pencil-square" className="size-5" /> Новая статья
                  </button>
                ) : (
                  <p id="library-rank-hint" className="max-w-sm text-sm leading-6 text-stone-400">
                    Добавлять статьи можно со звания «Киноман».
                  </p>
                )
              ) : (
                login
              )}
            </div>
          </div>
        </div>
        {error && (
          <p role="alert">
            {error}{" "}
            <button
              id="library-retry"
              onClick={() => {
                refresh()
              }}
            >
              Повторить
            </button>
          </p>
        )}
        {!data && !error && <p role="status">Загрузка библиотеки…</p>}
        <div className="mt-8 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <SeriesList series={data?.series ?? []} selected={selected} author={author} navigate={navigate} />
          <section className="min-w-0">
            {selected && (
              <div className="mb-5 flex items-end justify-between gap-4 rounded-2xl border border-amber-900/40 bg-stone-950/80 p-5 backdrop-blur-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Выбранная серия</p>
                  <h2 className="mt-1 text-3xl text-amber-100">{selected}</h2>
                </div>
                <a
                  href="/library"
                  onClick={(e) => {
                    e.preventDefault()
                    navigate("/library")
                  }}
                  className="text-sm text-stone-400 transition hover:text-amber-300"
                >
                  Показать всё
                </a>
              </div>
            )}
            <div id="library-articles" className="space-y-5">
              {data?.data.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  navigate={navigate}
                  onEdit={(article) => {
                    setEditor({ article })
                  }}
                />
              ))}
              {data && (
                <div
                  id="library-empty"
                  className="hidden only:block rounded-2xl border border-dashed border-amber-900/50 bg-stone-950/75 px-6 py-20 text-center text-stone-500"
                >
                  В библиотеке пока тихо. Станьте первым автором.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <Notice
        message={notice}
        onClose={() => {
          setNotice("")
        }}
      />
      {editor && (
        <Editor
          article={editor.article}
          nickname={nickname}
          csrf={csrf}
          series={data?.series ?? []}
          onClose={close}
          onSaved={() => {
            close()
            setNotice("Статья сохранена.")
            refresh()
          }}
        />
      )}
    </section>
  )
}
