import { useLayoutEffect, useRef, useState } from "react"

/** Keep the scene's pet target below the participant list as it grows or scrolls. */
export function useScenePetTarget(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [clip, setClip] = useState({ top: 0, hidden: false })
  useLayoutEffect(() => {
    if (!enabled) return
    const target = ref.current
    const list = document.getElementById("online-list")
    const sidebar = document.getElementById("chat-online-sidebar")
    if (!target || !list || !sidebar) return
    const measure = () => {
      const bounds = target.getBoundingClientRect()
      const listBottom = Math.min(list.getBoundingClientRect().bottom, sidebar.getBoundingClientRect().bottom)
      const top = Math.max(0, listBottom + 8 - bounds.top)
      const hidden = bounds.height > 0 && bounds.height - top < 24
      setClip((previous) => (previous.top === top && previous.hidden === hidden ? previous : { top, hidden }))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(target)
    observer.observe(list)
    observer.observe(sidebar)
    sidebar.addEventListener("scroll", measure)
    window.addEventListener("resize", measure)
    measure()
    return () => {
      observer.disconnect()
      sidebar.removeEventListener("scroll", measure)
      window.removeEventListener("resize", measure)
    }
  }, [enabled])
  return { ref, clip }
}
