import { SeriesEditor } from "./SeriesEditor"
import { seriesURL } from "./ArticleCard"
import { Notice } from "../../../shared/ui/Notice"
import { useState, useCallback, type ReactNode } from "react"
import { usePageQuery } from "../../../shared/model/usePageQuery"
import { useLibrary } from "../model/useLibrary"
import type { Article, Series } from "../api/library"
import { ArticleCard } from "./ArticleCard"
import { Editor } from "./Editor"
import { SeriesList } from "./SeriesList"
export function Library({ nickname, csrf, login }: { nickname: string; csrf: string; login: ReactNode }) {
  const { query, navigate } = usePageQuery(),
    { data, error, refresh } = useLibrary(query),
    [editor, setEditor] = useState<{ article: Article | null } | null>(null)
  const [notice, setNotice] = useState("")
  const [seriesEditor, setSeriesEditor] = useState<Series | null>(null)
  const close = useCallback(() => {
      setEditor(null)
    }, []),
    params = new URLSearchParams(query),
    author = Number(params.get("author")),
    selected = author > 0 ? (params.get("series")?.trim() ?? "") : ""
  const bookmarks = params.get("bookmarks") === "1"
  const selectedSeries = data?.series.find((s) => s.author_id === author && s.name === selected)
  return (
    <section
      id="library-page"
      className="library-shell chat-shell relative min-h-screen overflow-hidden text-stone-100"
      data-chat-theme="vertigo"
      data-chat-mode="dark"
    >
      <div className="library-reading-room pointer-events-none fixed inset-0" aria-hidden="true" />
      <header className="relative z-10 flex min-h-16 items-center justify-between border-b border-amber-950/70 bg-stone-950/85 px-4 shadow-xl backdrop-blur-sm sm:px-8">
        <a href="/chat" target="vertigo-chat" data-return-to-chat className="flex items-center gap-3">
          <span className="vertigo-mark" aria-hidden="true" />
          <span className="vertigo-wordmark uppercase">Vertigo</span>
        </a>
        <a
          href="/chat"
          target="vertigo-chat"
          className="inline-flex min-h-11 items-center text-sm text-stone-400 transition hover:text-amber-200 focus-visible:text-amber-200"
        >
          ← Вернуться в чат
        </a>
      </header>
      <main className="library-main">
        <div className="library-intro">
          <div>
            <p className="library-kicker">Читальный зал Vertigo</p>
            <h1 className="library-title">Библиотека</h1>
            <p className="library-description">
              Публичные тексты чатлан. Большие истории — по главам, короткие — за чашкой чая.
            </p>
          </div>
          {nickname &&
            (data?.can_publish ? (
              <button
                id="new-library-article"
                type="button"
                onClick={() => {
                  setEditor({ article: null })
                }}
                className="library-create"
              >
                Новая статья
              </button>
            ) : (
              <p id="library-rank-hint" className="max-w-sm text-sm leading-6 text-stone-400">
                Добавлять статьи можно со звания «Киноман».
              </p>
            ))}
        </div>
        {!nickname && <div className="mt-5">{login}</div>}
        {error && (
          <p role="alert" className="library-status">
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
        {!data && !error && (
          <p role="status" className="library-status">
            Загрузка библиотеки…
          </p>
        )}
        <div className="library-grid">
          <section className="library-feed" aria-label="Статьи библиотеки">
            <div className="library-section-heading">
              <h2>{selected || (bookmarks ? "Мои закладки" : "Все статьи")}</h2>
              {selected || bookmarks ? (
                <a
                  href="/library"
                  onClick={(e) => {
                    e.preventDefault()
                    navigate("/library")
                  }}
                >
                  Показать всё
                </a>
              ) : (
                <span>Сначала новые</span>
              )}
            </div>
            {selectedSeries && (selectedSeries.description || selectedSeries.own) && (
              <div className="library-section-description">
                {selectedSeries.description && <p>{selectedSeries.description}</p>}
                {selectedSeries.own && (
                  <button
                    id="edit-library-series"
                    type="button"
                    className="library-action"
                    onClick={() => {
                      setSeriesEditor(selectedSeries)
                    }}
                  >
                    Редактировать серию
                  </button>
                )}
              </div>
            )}
            <div id="library-articles">
              {data?.data.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  csrf={csrf}
                  signedIn={Boolean(nickname)}
                  onChanged={refresh}
                  navigate={navigate}
                  onEdit={(article) => {
                    setEditor({ article })
                  }}
                />
              ))}
              {data?.data.length === 0 && (
                <div id="library-empty" className="library-empty">
                  {bookmarks
                    ? "В закладках пока пусто. Нажми «В закладки» у понравившейся статьи."
                    : "В библиотеке пока тихо. Станьте первым автором."}
                </div>
              )}
            </div>
          </section>
          <SeriesList
            bookmarks={bookmarks}
            signedIn={Boolean(nickname)}
            series={data?.series ?? []}
            selected={selected}
            author={author}
            navigate={navigate}
          />
        </div>
      </main>
      <Notice
        message={notice}
        onClose={() => {
          setNotice("")
        }}
      />
      {seriesEditor && (
        <SeriesEditor
          series={seriesEditor}
          csrf={csrf}
          onClose={() => {
            setSeriesEditor(null)
          }}
          onSaved={(name) => {
            setSeriesEditor(null)
            setNotice("Серия сохранена.")
            navigate(seriesURL(seriesEditor.author_id, name))
            refresh()
          }}
        />
      )}
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
