import { useRef, useState } from "react"
import { libraryError, type Article } from "../api/library"
import { setArticleReaction } from "../api/reading"
export function useArticleActions(article: Article, csrf: string, onChanged: () => void) {
  const [saved, setSaved] = useState<{ source: Article; value: Article } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const busy = useRef(false)
  const value = saved?.source === article ? saved.value : article
  async function toggle(kind: "like" | "bookmark") {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError("")
    const active = !(kind === "like" ? value.liked : value.bookmarked)
    try {
      await setArticleReaction(article.id, kind, active, csrf)
      setSaved({
        source: article,
        value:
          kind === "like"
            ? { ...value, liked: active, likes: value.likes + (active ? 1 : -1) }
            : { ...value, bookmarked: active },
      })
      onChanged()
    } catch (error) {
      setError(libraryError(error))
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return { value, pending, error, toggle }
}
