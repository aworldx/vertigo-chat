import { useEffect, useRef } from "react"
import type { Message } from "../api/protocol"
export function useNotification(messages: Message[], nickname: string, enabled: boolean) {
  const seen = useRef<Set<number> | null>(null)
  useEffect(() => {
    const previous = seen.current
    seen.current = new Set(messages.map((m) => m.id))
    if (
      !enabled ||
      !previous ||
      !messages.some(
        (m) => !previous.has(m.id) && m.author !== nickname && (m.kind === "private" || m.recipient === nickname),
      ) ||
      !navigator.userActivation.hasBeenActive
    )
      return
    const context = new AudioContext(),
      start = context.currentTime
    for (const [index, frequency] of [880, 1320].entries()) {
      const oscillator = context.createOscillator(),
        gain = context.createGain(),
        at = start + index * 0.12
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(frequency, at)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.045, at + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.11)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.12)
    }
    const timer = setTimeout(() => {
      void context.close()
    }, 350)
    return () => {
      clearTimeout(timer)
      void context.close()
    }
  }, [messages, nickname, enabled])
}
