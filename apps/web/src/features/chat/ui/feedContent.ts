import { createContext, useContext, useLayoutEffect } from "react"

export const FeedContentContext = createContext<(() => void) | null>(null)

export function useFeedContentEvent(version: string | null) {
  const publishContent = useContext(FeedContentContext)
  useLayoutEffect(() => {
    if (version) publishContent?.()
  }, [publishContent, version])
}
