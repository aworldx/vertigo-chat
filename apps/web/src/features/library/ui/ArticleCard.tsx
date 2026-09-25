import { ArticleText } from "./ArticleText"
import { Icon } from "../../../shared/ui/Icon"
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
  const body = Array.from(a.body)
  return (
    <article
      id={`articles-${String(a.id)}`}
      data-article-title={a.title}
      className="overflow-hidden rounded-2xl border border-amber-950/60 bg-[linear-gradient(135deg,rgba(28,20,16,0.96),rgba(12,9,7,0.96))] shadow-2xl transition hover:border-amber-800/70"
    >
      <div className="border-b border-amber-950/50 px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span>{a.author}</span>
              <span aria-hidden="true">·</span>
              <time>{a.date}</time>
              {a.series && (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    href={seriesURL(a.author_id, a.series)}
                    onClick={(e) => {
                      e.preventDefault()
                      navigate(e.currentTarget.href)
                    }}
                    className="text-amber-400 transition hover:text-amber-200"
                  >
                    {a.series + (a.part_number ? ` · часть ${String(a.part_number)}` : "")}
                  </a>
                </>
              )}
            </div>
            <h2 className="mt-2 text-2xl leading-tight text-amber-50 sm:text-3xl">{a.title}</h2>
          </div>
          {a.own && (
            <button
              id={`edit-article-${String(a.id)}`}
              type="button"
              onClick={() => {
                onEdit(a)
              }}
              className="shrink-0 rounded-lg border border-stone-700 p-2 text-stone-400 transition hover:border-amber-400 hover:text-amber-200"
              aria-label={`Редактировать ${a.title}`}
            >
              <Icon name="pencil" className="size-4" />
            </button>
          )}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-7">
        <div className="text-sm leading-7 text-stone-300">
          <ArticleText body={a.body} compact={body.length > 360} />
        </div>
        {body.length > 360 && (
          <details className="group mt-4 border-t border-amber-950/40 pt-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-amber-400 transition hover:text-amber-200">
              <span className="group-open:hidden">Читать полностью</span>
              <span className="hidden group-open:inline">Свернуть</span>
            </summary>
            <div className="mt-5 text-sm leading-7 text-stone-300">
              <ArticleText body={a.body} />
            </div>
          </details>
        )}
      </div>
    </article>
  )
}
