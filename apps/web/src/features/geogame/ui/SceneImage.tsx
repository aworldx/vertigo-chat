import { useEffect, useRef, useState } from "react"
import { sceneURL, type GeoSnapshot } from "../api/game"

// Match the API image to its visible box so the embedded Google attribution is not cropped.
export function SceneImage({ game, onError }: { game: GeoSnapshot; onError: () => void }) {
  const image = useRef<HTMLImageElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    const parent = image.current?.parentElement
    if (!parent) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return
      const next = { width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }
      clearTimeout(timer)
      timer = setTimeout(() => {
        setSize((previous) => (previous?.width === next.width && previous.height === next.height ? previous : next))
      }, 150)
    })
    observer.observe(parent)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [])
  return (
    <img
      ref={image}
      className="geo-photo"
      src={size ? sceneURL(game, size) : undefined}
      alt="Место текущего раунда"
      style={{ visibility: size ? "visible" : "hidden" }}
      onError={onError}
    />
  )
}
