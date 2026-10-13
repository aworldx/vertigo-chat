import { useCallback, useEffect, useRef, useState } from "react"
import { waitForVideoReady } from "./videoReadiness"

const playbackAttempts = 3

export function useVideoPlayback(source: string, autoStart = false) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const request = useRef<AbortController | undefined>(undefined)
  const attempt = useRef(0)
  const wanted = useRef(false)
  const [state, setState] = useState<"idle" | "preparing" | "playing" | "failed">("idle")

  const stop = useCallback(() => {
    clearTimeout(timer.current)
    request.current?.abort()
    request.current = undefined
    wanted.current = false
  }, [])

  useEffect(() => {
    const element = videoRef.current
    return () => {
      stop()
      element?.pause()
    }
  }, [source, stop])

  const prepare = useCallback(async () => {
    if (!wanted.current) return
    const controller = new AbortController()
    request.current = controller
    const ready = await waitForVideoReady(source, controller.signal)
    if (request.current !== controller) return
    request.current = undefined
    if (!ready) {
      stop()
      setState("failed")
      return
    }
    const element = videoRef.current
    if (!element) return
    element.src = `${source}?attempt=${String(attempt.current)}`
    element.load()
    void element.play().catch(() => {})
  }, [source, stop])

  const start = useCallback(() => {
    if (wanted.current) return
    wanted.current = true
    attempt.current = 0
    setState("preparing")
    void prepare()
  }, [prepare])

  useEffect(() => {
    if (autoStart) start()
  }, [autoStart, start])

  const retry = () => {
    if (!wanted.current) return
    attempt.current++
    if (attempt.current >= playbackAttempts) {
      stop()
      setState("failed")
      return
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void prepare(), 2_000)
  }

  const playing = () => {
    stop()
    setState("playing")
  }

  return { videoRef, state, start, retry, playing }
}
