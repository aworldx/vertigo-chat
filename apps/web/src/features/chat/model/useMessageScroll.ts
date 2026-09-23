import { useLayoutEffect, useRef } from "react"

const bottomDistance = (element: HTMLElement) => element.scrollHeight - element.clientHeight - element.scrollTop

// This mirrors the LiveView feed: only a reader who was already at the bottom
// follows a new entry. A wheel, pointer or touch interaction immediately hands
// the scroll position back to the reader.
export function useMessageScroll(entryVersion: string) {
  const list = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const autoScrolling = useRef(false)
  const animationFrame = useRef<number | undefined>(undefined)
  const expectedScrollTop = useRef<number | null>(null)
  const previousEntries = useRef<string | undefined>(undefined)

  useLayoutEffect(() => {
    const element = list.current
    const previousEntryVersion = previousEntries.current
    previousEntries.current = entryVersion

    if (!element || previousEntryVersion === undefined || previousEntryVersion === entryVersion || !following.current)
      return

    if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current)
    expectedScrollTop.current = null
    const target = Math.max(0, element.scrollHeight - element.clientHeight)

    if (Math.abs(target - element.scrollTop) < 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.scrollTop = target
      return
    }

    autoScrolling.current = true
    const follow = () => {
      const currentTarget = Math.max(0, element.scrollHeight - element.clientHeight)
      const distance = currentTarget - element.scrollTop
      if (Math.abs(distance) < 1) {
        element.scrollTop = currentTarget
        autoScrolling.current = false
        expectedScrollTop.current = null
        following.current = true
        return
      }
      const nextScrollTop = element.scrollTop + distance * 0.28
      expectedScrollTop.current = nextScrollTop
      element.scrollTop = nextScrollTop
      animationFrame.current = requestAnimationFrame(follow)
    }
    animationFrame.current = requestAnimationFrame(follow)
  }, [entryVersion])

  useLayoutEffect(() => {
    const element = list.current
    if (!element) return

    const updateFollowing = () => {
      const expected = expectedScrollTop.current
      if (autoScrolling.current && expected !== null && Math.abs(element.scrollTop - expected) < 1) return

      if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current)
      autoScrolling.current = false
      expectedScrollTop.current = null
      following.current = bottomDistance(element) <= 24
    }
    const cancelFollow = () => {
      if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current)
      autoScrolling.current = false
      expectedScrollTop.current = null
      following.current = bottomDistance(element) <= 24
    }

    element.scrollTop = element.scrollHeight
    element.addEventListener("scroll", updateFollowing, { passive: true })
    element.addEventListener("wheel", cancelFollow, { passive: true })
    element.addEventListener("pointerdown", cancelFollow, { passive: true })
    element.addEventListener("touchstart", cancelFollow, { passive: true })
    return () => {
      if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current)
      element.removeEventListener("scroll", updateFollowing)
      element.removeEventListener("wheel", cancelFollow)
      element.removeEventListener("pointerdown", cancelFollow)
      element.removeEventListener("touchstart", cancelFollow)
    }
  }, [])

  return list
}
