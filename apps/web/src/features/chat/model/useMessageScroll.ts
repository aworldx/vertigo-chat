import { useCallback, useLayoutEffect, useRef } from "react"

type FeedPosition = "following" | "detached"

const bottomDistance = (element: HTMLElement) => element.scrollHeight - element.clientHeight - element.scrollTop
const smoothScrollDuration = 440

// The frame owns whether it follows new content. Producers only publish that
// content appeared; they never read or alter the frame's scroll position.
export function useMessageScroll(entryVersion: string) {
  const list = useRef<HTMLDivElement>(null)
  const position = useRef<FeedPosition>("following")
  const previousEntries = useRef<string | undefined>(undefined)
  const followingTarget = useRef<number | null>(null)
  const animationFrame = useRef<number | undefined>(undefined)

  const publishContent = useCallback(() => {
    const element = list.current
    if (!element || position.current !== "following") return
    const target = Math.max(0, element.scrollHeight - element.clientHeight)
    if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      followingTarget.current = null
      element.scrollTop = target
      return
    }
    followingTarget.current = target
    const start = element.scrollTop
    const distance = target - start
    const startedAt = performance.now()
    const follow = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / smoothScrollDuration)
      element.scrollTop = start + distance * (1 - (1 - progress) ** 3)
      if (progress < 1) animationFrame.current = requestAnimationFrame(follow)
      else {
        animationFrame.current = undefined
        followingTarget.current = null
        position.current = "following"
      }
    }
    animationFrame.current = requestAnimationFrame(follow)
  }, [])

  useLayoutEffect(() => {
    const previous = previousEntries.current
    previousEntries.current = entryVersion
    if (previous !== undefined && previous !== entryVersion) publishContent()
  }, [entryVersion, publishContent])

  useLayoutEffect(() => {
    const element = list.current
    if (!element) return

    const updatePosition = () => {
      const target = followingTarget.current
      if (target !== null) {
        if (Math.abs(element.scrollTop - target) <= 1) {
          followingTarget.current = null
          position.current = "following"
        }
        return
      }
      position.current = bottomDistance(element) <= 24 ? "following" : "detached"
    }
    const cancelFollowing = () => {
      if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current)
      animationFrame.current = undefined
      followingTarget.current = null
    }

    element.scrollTop = element.scrollHeight
    element.addEventListener("scroll", updatePosition, { passive: true })
    element.addEventListener("wheel", cancelFollowing, { passive: true })
    element.addEventListener("touchstart", cancelFollowing, { passive: true })
    return () => {
      if (animationFrame.current !== undefined) cancelAnimationFrame(animationFrame.current)
      element.removeEventListener("scroll", updatePosition)
      element.removeEventListener("wheel", cancelFollowing)
      element.removeEventListener("touchstart", cancelFollowing)
    }
  }, [])

  return { list, publishContent }
}
