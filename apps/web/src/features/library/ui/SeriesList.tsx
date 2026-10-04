import type { Series } from "../api/library"
import { seriesURL } from "./ArticleCard"

export function SeriesList({
  series,
  selected,
  author,
  navigate,
  bookmarks,
  signedIn,
}: {
  series: Series[]
  bookmarks: boolean
  signedIn: boolean
  selected: string
  author: number
  navigate: (url: string) => void
}) {
  return (
    <aside className="library-series-panel">
      <div className="library-series-head">
        <h2 className="library-series-title">Серии</h2>
        <span className="library-series-count">{series.length}</span>
      </div>
      <a
        id="all-library-articles"
        className="library-all"
        data-selected={!selected && !bookmarks}
        aria-current={!selected && !bookmarks ? "page" : undefined}
        href="/library"
        onClick={(e) => {
          e.preventDefault()
          navigate("/library")
        }}
      >
        Все статьи <span aria-hidden="true">↗</span>
      </a>
      {signedIn && (
        <a
          id="library-bookmarks"
          className="library-all"
          data-selected={bookmarks || undefined}
          aria-current={bookmarks ? "page" : undefined}
          href="/library?bookmarks=1"
          onClick={(e) => {
            e.preventDefault()
            navigate("/library?bookmarks=1")
          }}
        >
          Мои закладки <span aria-hidden="true">↗</span>
        </a>
      )}
      <nav id="library-series" aria-label="Серии статей">
        {series.map((s) => (
          <a
            key={seriesURL(s.author_id, s.name)}
            href={seriesURL(s.author_id, s.name)}
            onClick={(e) => {
              e.preventDefault()
              navigate(e.currentTarget.href)
            }}
            data-series-name={s.name}
            aria-current={selected === s.name && author === s.author_id ? "page" : undefined}
            className="library-series-link"
          >
            <img src="/images/library-cover-books.png" alt="" width="48" height="60" />
            <span>
              <strong>{s.name}</strong>
              <small>{s.author}</small>
              <small>Статей: {s.count}</small>
            </span>
          </a>
        ))}
      </nav>
    </aside>
  )
}
