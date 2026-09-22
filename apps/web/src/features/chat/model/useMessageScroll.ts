import { useLayoutEffect, useRef } from "react"

// Observe both the viewport and its entries: fonts and wrapping can change
// content height after the snapshot is rendered. Never pull a reader downward.
export function useMessageScroll() {
  const list = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = list.current
    if (!element) return
    let following = true
    let frame = 0
    const follow = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (following) element.scrollTop = element.scrollHeight
      })
    }
    const onScroll = () => {
      following = element.scrollHeight - element.clientHeight - element.scrollTop <= 24
    }
    const resize = new ResizeObserver(follow)
    const observe = () => {
      resize.disconnect()
      resize.observe(element)
      for (const child of element.children) resize.observe(child)
      follow()
    }
    const changes = new MutationObserver(observe)
    changes.observe(element, { childList: true, subtree: true, characterData: true })
    element.addEventListener("scroll", onScroll, { passive: true })
    observe()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      changes.disconnect()
      element.removeEventListener("scroll", onScroll)
    }
  }, [])
  return list
}
