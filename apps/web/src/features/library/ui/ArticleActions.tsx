import type { Article } from "../api/library"
import { useArticleActions } from "../model/useArticleActions"
export function ArticleActions({
  article,
  csrf,
  signedIn,
  onChanged,
}: {
  article: Article
  csrf: string
  signedIn: boolean
  onChanged: () => void
}) {
  const { value, pending, error, toggle } = useArticleActions(article, csrf, onChanged)
  return (
    <>
      <div className="library-reading-actions">
        <button
          id={`library-like-${String(article.id)}`}
          className="library-action"
          type="button"
          aria-label={value.liked ? "Убрать лайк" : "Нравится"}
          aria-pressed={value.liked}
          disabled={!signedIn || pending}
          title={signedIn ? undefined : "Войди в аккаунт, чтобы поставить лайк"}
          onClick={() => {
            void toggle("like")
          }}
        >
          {value.liked ? "♥" : "♡"} {value.likes}
        </button>
        <button
          id={`library-bookmark-${String(article.id)}`}
          className="library-action"
          type="button"
          aria-label={value.bookmarked ? "Убрать из закладок" : "Добавить в закладки"}
          aria-pressed={value.bookmarked}
          disabled={!signedIn || pending}
          title={signedIn ? undefined : "Войди в аккаунт, чтобы сохранить закладку"}
          onClick={() => {
            void toggle("bookmark")
          }}
        >
          {value.bookmarked ? "В закладках" : "В закладки"}
        </button>
      </div>
      {error && (
        <p role="alert" className="library-feedback">
          {error}
        </p>
      )}
    </>
  )
}
