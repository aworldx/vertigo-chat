import { useEffect, useRef } from "react"
export function useKarmikPet(onPet: () => void) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const lastPet = useRef(0),
    lastPurr = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fade = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  useEffect(() => {
    const player = document.createElement("audio")
    player.src = "/sounds/karmik-purr.mp3"
    player.preload = "auto"
    audio.current = player
    return () => {
      clearTimeout(timer.current)
      clearInterval(fade.current)
      player.pause()
      audio.current = null
    }
  }, [])
  return (withSound = false) => {
    const now = Date.now()
    if (now - lastPet.current >= 10000) {
      lastPet.current = now
      onPet()
    }
    const player = audio.current
    if (!withSound || !player || now - lastPurr.current < 10000) return
    lastPurr.current = now
    clearTimeout(timer.current)
    clearInterval(fade.current)
    player.currentTime = 0
    player.volume = 0.75
    void player.play().catch(() => {})
    timer.current = setTimeout(() => {
      let steps = 5
      fade.current = setInterval(() => {
        steps--
        player.volume = (0.75 * steps) / 5
        if (steps === 0) {
          clearInterval(fade.current)
          player.pause()
          player.currentTime = 0
        }
      }, 60)
    }, 2500)
  }
}
