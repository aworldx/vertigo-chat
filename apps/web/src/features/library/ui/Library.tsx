import { Notice } from "../../../shared/ui/Notice"
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
              <h2>{selected || "Все статьи"}</h2>
              {selected ? (
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
            <div id="library-articles">
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
              {data?.data.length === 0 && (
                <div id="library-empty" className="library-empty">
                  В библиотеке пока тихо. Станьте первым автором.
                </div>
              )}
            </div>
          </section>
          <SeriesList series={data?.series ?? []} selected={selected} author={author} navigate={navigate} />
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
