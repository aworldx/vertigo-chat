import { useCallback, useEffect, useRef, useState } from "react"
export function useVideoPlayback(source: string, autoStart = false) {
  const videoRef = useRef<HTMLVideoElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    attempt = useRef(0),
    wanted = useRef(false)
  const [state, setState] = useState<"idle" | "preparing" | "playing" | "failed">("idle")
  useEffect(() => {
    const element = videoRef.current
    return () => {
      clearTimeout(timer.current)
      wanted.current = false
      element?.pause()
    }
  }, [source])
  const load = useCallback(() => {
    const element = videoRef.current
    if (!element) return
    element.src = `${source}?attempt=${String(attempt.current)}`
    element.load()
    void element.play().catch(() => {})
  }, [source])
  const start = useCallback(() => {
    if (wanted.current) return
    wanted.current = true
    attempt.current = 0
    setState("preparing")
    load()
  }, [load])
  useEffect(() => {
    if (autoStart) start()
  }, [autoStart, start])
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
