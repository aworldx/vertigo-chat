import { useContext, useEffect, useRef, useState, useReducer } from "react"
import { ListeningContext } from "../listeningContext"
import type { QueueEntry } from "./queue"
export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error"
export function usePlayback(current: QueueEntry | null, requested: boolean, onEnded: () => void) {
  const ref = useRef<HTMLVideoElement>(null)
  const [revision, retry] = useReducer((value: number) => value + 1, 0)
  const connection = useContext(ListeningContext)
  const [status, setStatus] = useState<PlaybackStatus>("idle")
  const [time, setTime] = useState({ position: 0, duration: 0 })
  const [volume, setVolume] = useState(0.7)
  useEffect(() => {
    const element = ref.current
    if (!element || !current) return
    let disposed = false,
      attempt = 0,
      hasPlayed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const listening = (active: boolean) => connection?.listening(current.title, active)
    const updateTime = () => {
      setTime({ position: element.currentTime, duration: Number.isFinite(element.duration) ? element.duration : 0 })
    }
    const play = () => {
      void element.play().catch((error: unknown) => {
        if (disposed) return
        if (error instanceof DOMException && error.name === "NotAllowedError") setStatus("blocked")
        else if (!(error instanceof DOMException && error.name === "AbortError") && !current.prepare) setStatus("error")
      })
    }
    const loading = () => {
      setStatus("loading")
    }
    const playing = () => {
      if (!requested || disposed) return
      hasPlayed = true
      clearTimeout(timer)
      setStatus("playing")
      listening(true)
    }
    const pause = () => {
      setStatus("paused")
      listening(false)
    }
    const ended = () => {
      if (!requested || disposed) return
      listening(false)
      onEnded()
    }
    const error = () => {
      listening(false)
      if (!requested || disposed) return
      if (!current.prepare || hasPlayed || attempt >= 120) {
        setStatus("error")
        return
      }
      setStatus("loading")
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (disposed) return
        attempt++
        element.src = `${current.source}?attempt=${String(attempt)}`
        element.load()
        play()
      }, 1000)
    }
    element.addEventListener("loadstart", loading)
    element.addEventListener("waiting", loading)
    element.addEventListener("playing", playing)
    element.addEventListener("pause", pause)
    element.addEventListener("ended", ended)
    element.addEventListener("error", error)
    element.addEventListener("timeupdate", updateTime)
    element.addEventListener("durationchange", updateTime)
    if (element.dataset.trackKey !== String(current.key) || element.error) {
      element.dataset.trackKey = String(current.key)
      element.src = current.source
      element.load()
    }
    if (requested) play()
    else element.pause()
    return () => {
      disposed = true
      clearTimeout(timer)
      element.removeEventListener("loadstart", loading)
      element.removeEventListener("waiting", loading)
      element.removeEventListener("playing", playing)
      element.removeEventListener("pause", pause)
      element.removeEventListener("ended", ended)
      element.removeEventListener("error", error)
      element.removeEventListener("timeupdate", updateTime)
      element.removeEventListener("durationchange", updateTime)
      element.pause()
      listening(false)
    }
  }, [current, requested, connection, onEnded, revision])
  const seek = (position: number) => {
    if (ref.current) {
      ref.current.currentTime = position
      setTime((value) => ({ ...value, position }))
    }
  }
  const changeVolume = (value: number) => {
    setVolume(value)
    if (ref.current) ref.current.volume = value
  }
  useEffect(() => {
    if (ref.current) ref.current.volume = volume
  }, [volume])
  const resume = () => {
    const element = ref.current
    if (!element) return
    if (element.error) {
      retry()
      return
    }
    void element.play().catch(() => {
      setStatus("blocked")
    })
  }
  return { ref, status: current && requested ? status : "paused", time, volume, changeVolume, seek, resume }
}
