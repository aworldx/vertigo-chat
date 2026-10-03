import { useState } from "react"
import { ArticleText } from "./ArticleText"
import { articleCover } from "../model/articleCover"
import { safeArticleLink } from "../model/articleText"
import type { Article } from "../api/library"

export function seriesURL(author: number, series: string) {
  return "/library?" + new URLSearchParams({ author: String(author), series }).toString()
}

export function ArticleCard({
  article: a,
  onEdit,
  navigate,
}: {
  article: Article
  onEdit: (a: Article) => void
  navigate: (url: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <article id={`articles-${String(a.id)}`} data-article-title={a.title} className="library-card">
      <div className="library-card-summary">
        <img className="library-cover" src={articleCover(a.id, a.cover_image)} alt="" width="120" height="144" />
        <div className="library-card-copy">
          {a.series ? (
            <a
              className="library-card-series"
              href={seriesURL(a.author_id, a.series)}
              onClick={(e) => {
                e.preventDefault()
                navigate(e.currentTarget.href)
              }}
            >
              {a.series + (a.part_number ? ` · часть ${String(a.part_number)}` : "")}
            </a>
          ) : (
            <span className="library-card-series">Отдельная история</span>
          )}
          <h2 className="library-article-title">{a.title}</h2>
          <div className="library-card-meta">
            {a.work_author ? (
              <>
                <span>Автор: {a.work_author}</span>
                <span>Опубликовал: {a.author}</span>
              </>
            ) : (
              <span>{a.author}</span>
            )}
            <span aria-hidden="true">·</span>
            <time>{a.date}</time>
          </div>
          {!expanded && (
            <div className="library-excerpt">
              <ArticleText body={a.body} compact />
            </div>
          )}
          <div className="library-card-actions">
            <button
              id={`read-article-${String(a.id)}`}
              type="button"
              aria-expanded={expanded}
              aria-controls={`article-text-${String(a.id)}`}
              onClick={() => {
                setExpanded(!expanded)
              }}
            >
              {expanded ? "Свернуть" : "Читать полностью"} <span aria-hidden="true">{expanded ? "↑" : "→"}</span>
            </button>
            {a.own && (
              <button
                id={`edit-article-${String(a.id)}`}
                type="button"
                className="library-edit"
                aria-label={`Редактировать ${a.title}`}
                onClick={() => {
                  onEdit(a)
                }}
              >
                Редактировать
              </button>
            )}
          </div>
        </div>
      </div>
      <div id={`article-text-${String(a.id)}`} hidden={!expanded} className="library-full-text">
        {expanded && <ArticleText body={a.body} />}
        {expanded && a.source_url && safeArticleLink(a.source_url) && (
          <p>
            <a href={a.source_url} target="_blank" rel="noopener noreferrer">
              Источник публикации
            </a>
          </p>
        )}
      </div>
    </article>
  )
}
