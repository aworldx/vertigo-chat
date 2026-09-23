import { Icon } from "../../../shared/ui/Icon"
import type { Series } from "../api/library"
import { seriesURL } from "./ArticleCard"
export function SeriesList({
  series,
  selected,
  author,
  navigate,
}: {
  series: Series[]
  selected: string
  author: number
  navigate: (url: string) => void
}) {
  return (
    <aside className="self-start rounded-2xl border border-amber-950/60 bg-stone-950/85 p-5 shadow-xl backdrop-blur-sm lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg text-amber-100">Серии</h2>
        <span className="rounded-full bg-amber-300/10 px-2 py-1 text-xs text-amber-300">{series.length}</span>
      </div>
      <a
        id="all-library-articles"
        href="/library"
        onClick={(e) => {
          e.preventDefault()
          navigate("/library")
        }}
        className={`mt-4 flex items-center justify-between rounded-xl border px-3 py-3 text-sm transition ${selected ? "border-stone-800 text-stone-400 hover:border-amber-700" : "border-amber-400/60 bg-amber-300/10 text-amber-100"}`}
      >
        Все статьи <Icon name="book-open" className="size-4" />
      </a>
      <nav id="library-series" className="mt-3 space-y-2" aria-label="Серии статей">
        {series.map((s) => (
          <a
            key={seriesURL(s.author_id, s.name)}
            href={seriesURL(s.author_id, s.name)}
            onClick={(e) => {
              e.preventDefault()
              navigate(e.currentTarget.href)
            }}
            data-series-name={s.name}
            className={`block rounded-xl border px-3 py-3 transition ${selected === s.name && author === s.author_id ? "border-amber-400/60 bg-amber-300/10" : "border-stone-800 bg-stone-900/60 hover:border-amber-800"}`}
          >
            <span className="block truncate text-sm text-amber-100">{s.name}</span>
            <span className="mt-1 flex justify-between gap-2 text-xs text-stone-500">
              <span className="truncate">{s.author}</span>
              <span>{s.count}</span>
            </span>
          </a>
        ))}
      </nav>
    </aside>
  )
}
