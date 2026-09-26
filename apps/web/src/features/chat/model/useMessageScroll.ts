import { useCallback, useLayoutEffect, useRef } from "react"
import { feedOffsets, retainedOffset } from "./feedAnchor"

type FeedPosition = "following" | "detached"

const bottomDistance = (element: HTMLElement) => element.scrollHeight - element.clientHeight - element.scrollTop
const smoothScrollDuration = 440

// The frame owns whether it follows new content. Producers only publish that
// content appeared; they never read or alter the frame's scroll position.
export function useMessageScroll(entryVersion: string) {
  const list = useRef<HTMLDivElement>(null)
  const position = useRef<FeedPosition>("following")
  const offsets = useRef(new Map<Element, number>())
  const previousScroll = useRef(0)
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
      previousScroll.current = element.scrollTop
      return
    }
    followingTarget.current = target
    const start = element.scrollTop
    const distance = target - start
    const startedAt = performance.now()
    const follow = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / smoothScrollDuration)
      element.scrollTop = start + distance * (1 - (1 - progress) ** 3)
      previousScroll.current = element.scrollTop
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
    const element = list.current
    if (!element) return
    if (previous !== undefined && previous !== entryVersion) {
      // Replacing the oldest row can leave scrollHeight unchanged. Keep the
      // retained content in place first, then follow the newly appended row.
      const shift = retainedOffset(element, offsets.current, previousScroll.current)
      if (Math.abs(shift) > 0.5) element.scrollTop = previousScroll.current + shift
      previousScroll.current = element.scrollTop
      publishContent()
    }
    offsets.current = feedOffsets(element)
  }, [entryVersion, publishContent])

  useLayoutEffect(() => {
    const element = list.current
    if (!element) return

    const updatePosition = () => {
      previousScroll.current = element.scrollTop
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
    previousScroll.current = element.scrollTop
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
