import { useEffect, useRef, useState } from "react"
export function useVideoPlayback(source: string) {
  const videoRef = useRef<HTMLVideoElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    attempt = useRef(0),
    wanted = useRef(false)
  const [state, setState] = useState<"idle" | "preparing" | "playing" | "failed">("idle")
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      wanted.current = false
    },
    [source],
  )
  const load = () => {
    const element = videoRef.current
    if (!element) return
    element.src = `${source}?attempt=${String(attempt.current)}`
    element.load()
    void element.play().catch(() => {})
  }
  const start = () => {
    if (wanted.current) return
    wanted.current = true
    attempt.current = 0
    setState("preparing")
    load()
  }
  const retry = () => {
    if (!wanted.current) return
    if (attempt.current >= 120) {
      wanted.current = false
      setState("failed")
      return
    }
    attempt.current++
    clearTimeout(timer.current)
    timer.current = setTimeout(load, 1000)
  }
  const playing = () => {
    wanted.current = false
    clearTimeout(timer.current)
    setState("playing")
  }
  return { videoRef, state, start, retry, playing }
}
