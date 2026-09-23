import { useCallback, useEffect, useState } from "react"
export function usePageQuery() {
  const [query, setQuery] = useState(window.location.search)
  useEffect(() => {
    const change = () => {
      setQuery(window.location.search)
    }
    window.addEventListener("popstate", change)
    return () => {
      window.removeEventListener("popstate", change)
    }
  }, [])
  const navigate = useCallback((url: string) => {
    window.history.pushState(null, "", url)
    setQuery(window.location.search)
  }, [])
  return { query, navigate }
}
