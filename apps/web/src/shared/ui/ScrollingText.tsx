import { useEffect, useRef, useState, type CSSProperties } from "react"

export function ScrollingText({ children }: { children: string }) {
  const frame = useRef<HTMLSpanElement>(null)
  const text = useRef<HTMLSpanElement>(null)
  const [distance, setDistance] = useState(0)
  useEffect(() => {
    const viewport = frame.current
    const content = text.current
    if (!viewport || !content) return
    const measure = () => {
      setDistance(Math.max(0, content.scrollWidth - viewport.clientWidth))
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(content)
    measure()
    return () => {
      observer.disconnect()
    }
  }, [children])
  return (
    <span
      ref={frame}
      className="ui-scrolling-text"
      data-overflow={distance > 1}
      style={
        {
          "--text-travel": `${String(-distance)}px`,
          "--text-duration": `${String(Math.max(6, distance / 24 + 4))}s`,
        } as CSSProperties
      }
    >
      <span ref={text}>{children}</span>
    </span>
  )
}
